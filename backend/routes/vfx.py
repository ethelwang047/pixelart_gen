import io
import os

import numpy as np
from fastapi import APIRouter, HTTPException
from google import genai
from google.genai import types
from PIL import Image
from pydantic import BaseModel

from routes.generate import STYLES
from utils import flood_fill_transparent, image_to_b64, remap_to_palette

router = APIRouter()

_api_key = os.environ.get("GEMINI_API_KEY")
client = genai.Client(api_key=_api_key) if _api_key else None

VFX_SPECS: dict[str, dict] = {
    "explosion": {"frames": 6, "cols": 3, "rows": 2, "fps": 12, "loop": False,
                  "desc": "explosion burst — small spark → full fiery blast expanding outward → dissipating smoke cloud"},
    "sparkle":   {"frames": 6, "cols": 3, "rows": 2, "fps": 10, "loop": True,
                  "desc": "sparkling glitter twinkle — small star points appearing, brightening, then fading in sequence"},
    "heal":      {"frames": 4, "cols": 4, "rows": 1, "fps": 8,  "loop": True,
                  "desc": "healing glow — soft green light rising upward with small cross or leaf shapes, getting brighter then fading"},
    "smoke":     {"frames": 6, "cols": 3, "rows": 2, "fps": 8,  "loop": True,
                  "desc": "smoke puff — grey wispy cloud rising and expanding, getting thinner and dissipating"},
    "slash":     {"frames": 4, "cols": 4, "rows": 1, "fps": 14, "loop": False,
                  "desc": "sword slash arc — quick diagonal energy streak sweeping across the frame, brief afterglow then gone"},
    "fire":      {"frames": 6, "cols": 3, "rows": 2, "fps": 12, "loop": True,
                  "desc": "flickering flame — hot orange and yellow fire growing from ember, dancing at peak, cycling"},
    "ice":       {"frames": 4, "cols": 4, "rows": 1, "fps": 10, "loop": False,
                  "desc": "ice burst — blue frost crystal forming, spreading outward, then shattering into shards"},
    "magic":     {"frames": 6, "cols": 3, "rows": 2, "fps": 10, "loop": True,
                  "desc": "arcane swirl — purple or multi-colour magical energy circle with rune patterns, rotating and pulsing"},
}


def _chroma_key(img: Image.Image, tolerance: int = 40) -> Image.Image:
    arr  = np.array(img.convert("RGBA"), dtype=np.int32)
    key  = np.array([255, 0, 255])
    diff = np.abs(arr[:, :, :3] - key)
    mask = diff.max(axis=2) <= tolerance
    arr[mask, 3] = 0
    return Image.fromarray(arr.astype(np.uint8))


class VfxGenerateRequest(BaseModel):
    effect_type:        str = "explosion"
    custom_description: str = ""
    style_key:          str = "stardew"
    tile_size:          int = 64
    locked_palette:     list[str] | None = None


@router.post("/vfx/generate")
def vfx_generate(req: VfxGenerateRequest):
    if client is None:
        raise HTTPException(status_code=503, detail="GEMINI_API_KEY 未設定")
    if req.effect_type not in VFX_SPECS:
        raise HTTPException(status_code=400, detail=f"effect_type 必須是 {list(VFX_SPECS)} 其中之一")

    spec          = VFX_SPECS[req.effect_type]
    frames_n: int = spec["frames"]
    cols: int     = spec["cols"]
    rows: int     = spec["rows"]
    tile_size     = max(32, min(128, req.tile_size))
    style_suffix  = STYLES.get(req.style_key, STYLES["stardew"])
    effect_desc   = spec["desc"]
    if req.custom_description.strip():
        effect_desc = f"{req.custom_description.strip()}, {effect_desc}"

    sheet_prompt = (
        f"Draw a {frames_n}-frame pixel art VFX sprite sheet for a '{req.effect_type}' effect. "
        f"{style_suffix}\n\n"
        f"Effect: {effect_desc}.\n"
        f"Layout: {cols} columns × {rows} rows grid, frames ordered left-to-right then top-to-bottom. "
        f"Frame 1 = effect start, frame {frames_n} = effect end.\n"
        f"Use solid magenta (#FF00FF) for all transparent/empty areas.\n\n"
        f"Rules:\n"
        f"- Each frame must show a clearly distinct stage of the animation.\n"
        f"- Centre the effect in each equal-size cell.\n"
        f"- No grid lines, no borders, no labels — only the raw sprite sheet."
    )

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash-image",
            contents=[types.Part.from_text(text=sheet_prompt)],
            config=types.GenerateContentConfig(response_modalities=["IMAGE", "TEXT"]),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini 呼叫失敗：{e}")

    sheet_bytes = None
    for part in response.candidates[0].content.parts:
        if getattr(part, "inline_data", None) and part.inline_data.mime_type.startswith("image/"):
            sheet_bytes = part.inline_data.data
            break
    if not sheet_bytes:
        raise HTTPException(status_code=500, detail="Gemini 未回傳圖片")

    try:
        sheet       = Image.open(io.BytesIO(sheet_bytes)).convert("RGBA")
        sw, sh      = sheet.size
        cell_w, cell_h = sw // cols, sh // rows

        processed: list[Image.Image] = []
        for i in range(frames_n):
            r, c   = divmod(i, cols)
            cell   = sheet.crop((c * cell_w, r * cell_h, (c + 1) * cell_w, (r + 1) * cell_h))
            keyed  = _chroma_key(cell, tolerance=40)
            filled = flood_fill_transparent(keyed, tolerance=25)
            frame  = filled.resize((tile_size, tile_size), Image.NEAREST)
            if req.locked_palette:
                frame = remap_to_palette(frame, req.locked_palette)
            processed.append(frame)

        grid = Image.new("RGBA", (cols * tile_size, rows * tile_size), (0, 0, 0, 0))
        for i, frame in enumerate(processed):
            r, c = divmod(i, cols)
            grid.paste(frame, (c * tile_size, r * tile_size))

        strip = Image.new("RGBA", (frames_n * tile_size, tile_size), (0, 0, 0, 0))
        for i, frame in enumerate(processed):
            strip.paste(frame, (i * tile_size, 0))

        return {
            "frames":     [image_to_b64(f) for f in processed],
            "grid_sheet": image_to_b64(grid),
            "strip":      image_to_b64(strip),
            "manifest": {
                "effect":      req.effect_type,
                "frame_count": frames_n,
                "fps":         spec["fps"],
                "loop":        spec["loop"],
                "tile_size":   tile_size,
                "cols":        cols,
                "rows":        rows,
                "grid_size":   [cols * tile_size, rows * tile_size],
                "strip_size":  [frames_n * tile_size, tile_size],
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"切割失敗：{e}")
