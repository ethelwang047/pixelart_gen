import numpy as np
from fastapi import APIRouter, HTTPException
from PIL import Image
from pydantic import BaseModel

from utils import b64_to_image

router = APIRouter()


class PaletteExtractRequest(BaseModel):
    image_base64: str
    max_colors: int = 24


@router.post("/palette/extract")
def palette_extract(req: PaletteExtractRequest):
    try:
        img = b64_to_image(req.image_base64)
    except Exception:
        raise HTTPException(status_code=400, detail="無法解析圖片")

    max_colors = max(2, min(64, req.max_colors))
    rgba = np.array(img.convert("RGBA"), dtype=np.uint8)
    mask = rgba[:, :, 3] > 128

    if not mask.any():
        raise HTTPException(status_code=400, detail="圖片沒有不透明像素")

    pixels = rgba[mask][:, :3]
    unique_rgb = np.unique(pixels, axis=0)

    if len(unique_rgb) <= max_colors:
        # 已量化的像素圖：直接回傳唯一色彩
        colors = [f"#{r:02x}{g:02x}{b:02x}" for r, g, b in unique_rgb]
    else:
        # 色彩過多（未像素化的原圖）：先量化再擷取
        rgb_img = Image.fromarray(rgba[:, :, :3])
        quantized = rgb_img.quantize(colors=max_colors, method=Image.Quantize.MEDIANCUT)
        pal = quantized.getpalette()[:max_colors * 3]
        seen: set[str] = set()
        colors = []
        for i in range(0, len(pal), 3):
            h = f"#{pal[i]:02x}{pal[i+1]:02x}{pal[i+2]:02x}"
            if h not in seen:
                seen.add(h)
                colors.append(h)

    return {"palette": colors}
