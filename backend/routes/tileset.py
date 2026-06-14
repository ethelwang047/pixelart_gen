import io
import os

import numpy as np
from fastapi import APIRouter, HTTPException
from google import genai
from google.genai import types
from PIL import Image, ImageDraw
from pydantic import BaseModel

from routes.generate import STYLES
from utils import flood_fill_transparent, image_to_b64, remap_to_palette

router = APIRouter()

_api_key = os.environ.get("GEMINI_API_KEY")
client = genai.Client(api_key=_api_key) if _api_key else None

# ── Tile registry ──────────────────────────────────────────────────────────────
# (name, row, col) in the 4×4 template grid
TILES = [
    ("outer_tl",  0, 0),
    ("top_edge",  0, 1),
    ("outer_tr",  0, 2),
    # (0,3) empty
    ("left_edge", 1, 0),
    ("body",      1, 1),
    ("right_edge",1, 2),
    # (1,3) empty
    ("outer_bl",  2, 0),
    ("bot_edge",  2, 1),
    ("outer_br",  2, 2),
    # (2,3) empty
    ("inner_tl",  3, 0),
    ("inner_tr",  3, 1),
    ("inner_bl",  3, 2),
    ("inner_br",  3, 3),
]

MAG   = (255,   0, 255, 255)   # magenta  → transparent area
SOLID = ( 55,  65,  75, 255)   # dark     → terrain interior
EDGE  = (180, 200, 210, 255)   # light    → visible tile edge/cap


def _build_template(cell: int = 64) -> Image.Image:
    """Draw a 4×4 magenta-backed template showing each tile's silhouette."""
    img  = Image.new("RGBA", (cell * 4, cell * 4), MAG)
    draw = ImageDraw.Draw(img)
    E    = max(2, cell // 8)   # edge thickness
    H    = cell // 2           # half cell

    def box(r, c, x1, y1, x2, y2, fill):
        ox, oy = c * cell, r * cell
        draw.rectangle([ox + x1, oy + y1, ox + x2, oy + y2], fill=fill)

    def solid(r, c): box(r, c, 0, 0, cell-1, cell-1, SOLID)
    def edge_strip(r, c, side):          # paint light edge on one side
        if   side == "T": box(r, c, 0,      0,      cell-1, E-1,    EDGE)
        elif side == "B": box(r, c, 0,      cell-E, cell-1, cell-1, EDGE)
        elif side == "L": box(r, c, 0,      0,      E-1,    cell-1, EDGE)
        elif side == "R": box(r, c, cell-E, 0,      cell-1, cell-1, EDGE)

    # ── Row 0 ─────────────────────────────────────────────────────
    # outer_tl (0,0): only bottom-right quadrant is solid
    box(0, 0, H, H, cell-1, cell-1, SOLID)
    box(0, 0, H, H, cell-1, H+E-1, EDGE)     # top rim of solid chunk
    box(0, 0, H, H, H+E-1, cell-1, EDGE)     # left rim

    # top_edge (0,1): full width, top strip is edge cap
    solid(0, 1);  edge_strip(0, 1, "T")

    # outer_tr (0,2): only bottom-left quadrant solid
    box(0, 2, 0, H, H-1, cell-1, SOLID)
    box(0, 2, 0, H, H-1, H+E-1, EDGE)
    box(0, 2, H-E, H, H-1, cell-1, EDGE)

    # ── Row 1 ─────────────────────────────────────────────────────
    solid(1, 0);  edge_strip(1, 0, "L")      # left_edge
    solid(1, 1)                               # body — fully solid
    solid(1, 2);  edge_strip(1, 2, "R")      # right_edge

    # ── Row 2 ─────────────────────────────────────────────────────
    # outer_bl (2,0): only top-right quadrant solid
    box(2, 0, H, 0, cell-1, H-1, SOLID)
    box(2, 0, H, H-E, cell-1, H-1, EDGE)
    box(2, 0, H, 0, H+E-1, H-1, EDGE)

    # bot_edge (2,1): full width, bottom strip is edge cap
    solid(2, 1);  edge_strip(2, 1, "B")

    # outer_br (2,2): only top-left quadrant solid
    box(2, 2, 0, 0, H-1, H-1, SOLID)
    box(2, 2, 0, H-E, H-1, H-1, EDGE)
    box(2, 2, H-E, 0, H-1, H-1, EDGE)

    # ── Row 3 — inner corners (solid with a magenta notch) ─────────
    # inner_tl (3,0): notch top-left
    solid(3, 0)
    box(3, 0, 0,   0,   H-1,  H-1,  MAG)
    edge_strip(3, 0, "L");  edge_strip(3, 0, "T")

    # inner_tr (3,1): notch top-right
    solid(3, 1)
    box(3, 1, H,   0,   cell-1, H-1, MAG)
    edge_strip(3, 1, "R");  edge_strip(3, 1, "T")

    # inner_bl (3,2): notch bottom-left
    solid(3, 2)
    box(3, 2, 0,   H,   H-1,  cell-1, MAG)
    edge_strip(3, 2, "L");  edge_strip(3, 2, "B")

    # inner_br (3,3): notch bottom-right
    solid(3, 3)
    box(3, 3, H,   H,   cell-1, cell-1, MAG)
    edge_strip(3, 3, "R");  edge_strip(3, 3, "B")

    return img


def _chroma_key(img: Image.Image, tolerance: int = 40) -> Image.Image:
    """Remove magenta background via colour keying."""
    arr  = np.array(img.convert("RGBA"), dtype=np.int32)
    key  = np.array([255, 0, 255])
    diff = np.abs(arr[:, :, :3] - key)
    mask = diff.max(axis=2) <= tolerance
    arr[mask, 3] = 0
    return Image.fromarray(arr.astype(np.uint8))


def _cut_tiles(sheet: Image.Image) -> dict[str, Image.Image]:
    """Cut the 4×4 sheet into individual tiles."""
    sw, sh = sheet.size
    cs = min(sw, sh) // 4          # cell size in output image
    out = {}
    for name, row, col in TILES:
        x, y = col * cs, row * cs
        out[name] = sheet.crop((x, y, x + cs, y + cs))
    return out


def _build_atlas(tiles: dict[str, Image.Image], extrude: int = 2) -> Image.Image:
    """Pack tiles into a 4×4 atlas with 2px extrude border per tile."""
    sizes   = [t.size[0] for t in tiles.values()]
    ts      = max(sizes) if sizes else 64
    cell    = ts + 2 * extrude
    atlas   = Image.new("RGBA", (cell * 4, cell * 4), (0, 0, 0, 0))

    for name, row, col in TILES:
        if name not in tiles:
            continue
        tile = tiles[name].resize((ts, ts), Image.NEAREST)
        x, y = col * cell + extrude, row * cell + extrude
        atlas.paste(tile, (x, y))
        # Extrude edges (duplicate border pixels)
        if extrude > 0:
            # top / bottom
            atlas.paste(tile.crop((0, 0, ts, 1)).resize((ts, extrude), Image.NEAREST), (x, y - extrude))
            atlas.paste(tile.crop((0, ts-1, ts, ts)).resize((ts, extrude), Image.NEAREST), (x, y + ts))
            # left / right (including corners)
            atlas.paste(tile.crop((0, 0, 1, ts)).resize((extrude, ts), Image.NEAREST), (x - extrude, y))
            atlas.paste(tile.crop((ts-1, 0, ts, ts)).resize((extrude, ts), Image.NEAREST), (x + ts, y))

    return atlas


# ── Request / Response ─────────────────────────────────────────────────────────

class TilesetRerollTileRequest(BaseModel):
    material:  str
    tile_name: str
    style_key: str = "stardew"
    tile_size: int = 64
    locked_palette: list[str] | None = None


class TilesetGenerateRequest(BaseModel):
    material:  str = "mossy stone"
    style_key: str = "stardew"
    tile_size: int = 64          # target per-tile output size (32 / 64 / 128)
    locked_palette: list[str] | None = None


@router.post("/tileset/reroll-tile")
def tileset_reroll_tile(req: TilesetRerollTileRequest):
    if client is None:
        raise HTTPException(status_code=503, detail="GEMINI_API_KEY 未設定")

    tile_info = next((t for t in TILES if t[0] == req.tile_name), None)
    if not tile_info:
        raise HTTPException(status_code=400, detail=f"Unknown tile: {req.tile_name}")

    name, row, col = tile_info
    style_suffix = STYLES.get(req.style_key, STYLES["stardew"])
    tile_size    = max(32, min(128, req.tile_size))

    # Crop just this cell from the template
    template  = _build_template(cell=64)
    cs        = 64
    cell_crop = template.crop((col * cs, row * cs, (col + 1) * cs, (row + 1) * cs))
    buf       = io.BytesIO()
    cell_crop.save(buf, format="PNG")
    cell_bytes = buf.getvalue()

    painter_prompt = (
        f"Restyle this single '{name}' tile as '{req.material}' pixel art. {style_suffix}\n"
        f"Keep magenta (#FF00FF) as the transparent background. Keep the silhouette shape exactly.\n"
        f"Match the texture and palette of a '{req.material}' autotile set.\n"
        f"Output exactly one tile image, same dimensions as input."
    )

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash-image",
            contents=[
                types.Part.from_bytes(data=cell_bytes, mime_type="image/png"),
                types.Part.from_text(text=painter_prompt),
            ],
            config=types.GenerateContentConfig(response_modalities=["IMAGE", "TEXT"]),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini 呼叫失敗：{e}")

    tile_bytes = None
    for part in response.candidates[0].content.parts:
        if getattr(part, "inline_data", None) and part.inline_data.mime_type.startswith("image/"):
            tile_bytes = part.inline_data.data
            break

    if not tile_bytes:
        raise HTTPException(status_code=500, detail="Gemini 未回傳圖片")

    try:
        raw    = Image.open(io.BytesIO(tile_bytes)).convert("RGBA")
        keyed  = _chroma_key(raw)
        filled = flood_fill_transparent(keyed, tolerance=25)
        resized = filled.resize((tile_size, tile_size), Image.NEAREST)
        if req.locked_palette:
            resized = remap_to_palette(resized, req.locked_palette)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"處理失敗：{e}")

    return {"name": name, "row": row, "col": col, "image_base64": image_to_b64(resized)}


@router.post("/tileset/generate")
def tileset_generate(req: TilesetGenerateRequest):
    if client is None:
        raise HTTPException(status_code=503, detail="GEMINI_API_KEY 未設定")

    style_suffix = STYLES.get(req.style_key, STYLES["stardew"])
    tile_size    = max(32, min(128, req.tile_size))

    # ── Step 1: Build template ─────────────────────────────────────
    template = _build_template(cell=64)
    buf      = io.BytesIO()
    template.save(buf, format="PNG")
    template_bytes = buf.getvalue()

    # ── Step 2: Restyle via gemini-2.5-flash-image ─────────────────
    painter_prompt = (
        f"Restyle this 4×4 tile template as '{req.material}' pixel art. {style_suffix}\n\n"
        f"RULES — follow exactly:\n"
        f"- Keep EVERY tile's silhouette shape (magenta vs solid) pixel-perfect.\n"
        f"- Replace the gray placeholder with a convincing '{req.material}' texture.\n"
        f"- Keep magenta (#FF00FF) as the transparent background in each cell.\n"
        f"- Palette and lighting must be consistent across ALL 13 tiles.\n"
        f"- No grid lines, no labels, no UI chrome — just the raw tile sheet.\n\n"
        f"Grid layout (left→right, top→bottom):\n"
        f"Row 0: outer-TL corner | top edge   | outer-TR corner | [empty]\n"
        f"Row 1: left edge       | body fill  | right edge      | [empty]\n"
        f"Row 2: outer-BL corner | bottom edge| outer-BR corner | [empty]\n"
        f"Row 3: inner-TL corner | inner-TR   | inner-BL corner | inner-BR corner"
    )

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash-image",
            contents=[
                types.Part.from_bytes(data=template_bytes, mime_type="image/png"),
                types.Part.from_text(text=painter_prompt),
            ],
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE", "TEXT"],
            ),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini 呼叫失敗：{e}")

    # Extract generated image
    sheet_bytes = None
    for part in response.candidates[0].content.parts:
        if getattr(part, "inline_data", None) and part.inline_data.mime_type.startswith("image/"):
            sheet_bytes = part.inline_data.data
            break

    if not sheet_bytes:
        raise HTTPException(status_code=500, detail="Gemini 未回傳圖片")

    # ── Step 3: Cut + process ──────────────────────────────────────
    try:
        sheet = Image.open(io.BytesIO(sheet_bytes)).convert("RGBA")
        raw_tiles = _cut_tiles(sheet)

        processed: dict[str, Image.Image] = {}
        for name, raw in raw_tiles.items():
            keyed = _chroma_key(raw)
            filled = flood_fill_transparent(keyed, tolerance=25)
            resized = filled.resize((tile_size, tile_size), Image.NEAREST)
            if req.locked_palette:
                resized = remap_to_palette(resized, req.locked_palette)
            processed[name] = resized

        atlas = _build_atlas(processed)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"切割失敗：{e}")

    # ── Step 4: Build response ─────────────────────────────────────
    atlas_size = atlas.size
    tiles_out  = []
    for name, row, col in TILES:
        if name not in processed:
            continue
        tiles_out.append({
            "name":        name,
            "row":         row,
            "col":         col,
            "image_base64": image_to_b64(processed[name]),
        })

    return {
        "tiles":      tiles_out,
        "atlas_base64": image_to_b64(atlas),
        "tile_size":  tile_size,
        "atlas_size": list(atlas_size),
        "manifest": {
            "material":   req.material,
            "style":      req.style_key,
            "tile_size":  tile_size,
            "atlas_size": list(atlas_size),
            "extrude_px": 2,
            "tiles": {
                name: {"row": row, "col": col,
                       "atlas_x": col * (tile_size + 4) + 2,
                       "atlas_y": row * (tile_size + 4) + 2}
                for name, row, col in TILES
            },
        },
    }
