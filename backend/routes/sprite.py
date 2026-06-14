import io
import os

import numpy as np
from fastapi import APIRouter, HTTPException
from google import genai
from google.genai import types
from PIL import Image
from pydantic import BaseModel

from routes.generate import STYLES
from utils import flood_fill_transparent, image_to_b64, b64_to_image, remap_to_palette

router = APIRouter()

_api_key = os.environ.get("GEMINI_API_KEY")
client = genai.Client(api_key=_api_key) if _api_key else None

IMAGEN_MODELS = {"imagen-4.0-generate-001", "imagen-4.0-fast-generate-001"}

ANIM_SPECS: dict[str, dict] = {
    "idle":   {"frames": 4, "cols": 4, "rows": 1, "fps": 6,  "loop": True},
    "walk":   {"frames": 6, "cols": 3, "rows": 2, "fps": 10, "loop": True},
    "run":    {"frames": 6, "cols": 3, "rows": 2, "fps": 12, "loop": True},
    "attack": {"frames": 4, "cols": 4, "rows": 1, "fps": 12, "loop": False},
    "hurt":   {"frames": 2, "cols": 2, "rows": 1, "fps": 10, "loop": False},
    "death":  {"frames": 4, "cols": 4, "rows": 1, "fps": 8,  "loop": False},
}

ANIM_DESC: dict[str, str] = {
    "idle":   "subtle breathing idle, very slight up-down sway, feet stay planted",
    "walk":   "smooth walk cycle, legs alternating, arms swinging naturally",
    "run":    "fast run cycle, exaggerated leg stride, arms pumping",
    "attack": "single attack swing, windup then strike forward, return to stance",
    "hurt":   "flinch recoil, lean backward in pain, arms raised",
    "death":  "character toppling and falling to the ground, final frame flat",
}


class LockCharacterRequest(BaseModel):
    description: str
    style_key: str = "stardew"
    model: str = "imagen-4.0-generate-001"
    locked_palette: list[str] | None = None


class GenerateSheetRequest(BaseModel):
    anchor_image_base64: str
    animation: str = "idle"
    style_key: str = "stardew"
    tile_size: int = 64
    locked_palette: list[str] | None = None


def _chroma_key(img: Image.Image, tolerance: int = 40) -> Image.Image:
    arr  = np.array(img.convert("RGBA"), dtype=np.int32)
    key  = np.array([255, 0, 255])
    diff = np.abs(arr[:, :, :3] - key)
    mask = diff.max(axis=2) <= tolerance
    arr[mask, 3] = 0
    return Image.fromarray(arr.astype(np.uint8))


@router.post("/sprite/lock-character")
def lock_character(req: LockCharacterRequest):
    if client is None:
        raise HTTPException(status_code=503, detail="GEMINI_API_KEY 未設定")

    style_suffix = STYLES.get(req.style_key, STYLES["stardew"])
    model = req.model if req.model in IMAGEN_MODELS else "imagen-4.0-generate-001"
    prompt = (
        f"{req.description}, pixel art character sprite, "
        f"front-facing standing idle pose, full body visible from head to feet, "
        f"centered on transparent background. {style_suffix}"
    )

    try:
        resp = client.models.generate_images(
            model=model,
            prompt=prompt,
            config=types.GenerateImagesConfig(number_of_images=1, aspect_ratio="1:1"),
        )
        img = Image.open(io.BytesIO(resp.generated_images[0].image.image_bytes)).convert("RGBA")
        result = flood_fill_transparent(img)
        if req.locked_palette:
            result = remap_to_palette(result, req.locked_palette)
        return {"character_base64": image_to_b64(result)}
    except Exception as e:
        err = str(e)
        if "RESOURCE_EXHAUSTED" in err or "quota" in err.lower():
            raise HTTPException(status_code=429, detail="Gemini API 配額已達上限")
        if "PERMISSION_DENIED" in err or "API_KEY" in err:
            raise HTTPException(status_code=403, detail="API Key 無效或無 Imagen 存取權限")
        raise HTTPException(status_code=500, detail=err)


@router.post("/sprite/generate-sheet")
def generate_sheet(req: GenerateSheetRequest):
    if client is None:
        raise HTTPException(status_code=503, detail="GEMINI_API_KEY 未設定")
    if req.animation not in ANIM_SPECS:
        raise HTTPException(status_code=400, detail=f"animation 必須是 {list(ANIM_SPECS)} 其中之一")

    spec      = ANIM_SPECS[req.animation]
    frames_n: int = spec["frames"]
    cols: int     = spec["cols"]
    rows: int     = spec["rows"]
    tile_size     = max(32, min(128, req.tile_size))
    style_suffix  = STYLES.get(req.style_key, STYLES["stardew"])

    if not req.anchor_image_base64:
        raise HTTPException(status_code=400, detail="anchor_image_base64 不能為空，請先 Lock Character")
    try:
        anchor_img = b64_to_image(req.anchor_image_base64).convert("RGBA")
    except Exception:
        raise HTTPException(status_code=400, detail="anchor_image_base64 無法解析為圖片，請重新 Lock Character")
    anchor_buf = io.BytesIO()
    anchor_img.save(anchor_buf, format="PNG")

    painter_prompt = (
        f"The attached image is a pixel art character reference. "
        f"Draw a {frames_n}-frame '{req.animation}' animation sprite sheet for this exact character. "
        f"Layout: {cols} columns × {rows} rows grid, frames ordered left-to-right then top-to-bottom. "
        f"Animation: {ANIM_DESC[req.animation]}. "
        f"Use solid magenta (#FF00FF) as the background/transparent colour. "
        f"{style_suffix}\n\n"
        f"Rules:\n"
        f"- Character design (colours, outfit, proportions) must match the reference image exactly.\n"
        f"- Each frame in its own equal-size cell, character centred and fully visible.\n"
        f"- No grid lines, no labels, no borders — only the raw sprite sheet."
    )

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash-image",
            contents=[
                types.Part.from_bytes(data=anchor_buf.getvalue(), mime_type="image/png"),
                types.Part.from_text(text=painter_prompt),
            ],
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
        sheet  = Image.open(io.BytesIO(sheet_bytes)).convert("RGBA")
        sw, sh = sheet.size
        cell_w, cell_h = sw // cols, sh // rows

        processed: list[Image.Image] = []
        for i in range(frames_n):
            r, c = divmod(i, cols)
            cell   = sheet.crop((c * cell_w, r * cell_h, (c + 1) * cell_w, (r + 1) * cell_h))
            keyed  = _chroma_key(cell, tolerance=40)
            filled = flood_fill_transparent(keyed, tolerance=25)
            frame  = filled.resize((tile_size, tile_size), Image.NEAREST)
            if req.locked_palette:
                frame = remap_to_palette(frame, req.locked_palette)
            processed.append(frame)

        # Grid sheet
        grid = Image.new("RGBA", (cols * tile_size, rows * tile_size), (0, 0, 0, 0))
        for i, frame in enumerate(processed):
            r, c = divmod(i, cols)
            grid.paste(frame, (c * tile_size, r * tile_size))

        # Horizontal strip
        strip = Image.new("RGBA", (frames_n * tile_size, tile_size), (0, 0, 0, 0))
        for i, frame in enumerate(processed):
            strip.paste(frame, (i * tile_size, 0))

        return {
            "frames":     [image_to_b64(f) for f in processed],
            "grid_sheet": image_to_b64(grid),
            "strip":      image_to_b64(strip),
            "manifest": {
                "animation":   req.animation,
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
