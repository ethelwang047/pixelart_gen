import base64
import io

from fastapi import APIRouter, HTTPException
from PIL import Image
from pydantic import BaseModel
from proper_pixel_art.pixelate import pixelate

from utils import flood_fill_transparent, image_to_b64, remap_to_palette

router = APIRouter()


class PixelateRequest(BaseModel):
    image_base64: str
    pixel_width: int = 8
    num_colors: int = 16
    scale_result: int = 4
    transparent_background: bool = True
    locked_palette: list[str] | None = None


@router.post("/pixelate")
def pixelate_image(req: PixelateRequest):
    try:
        img_bytes = base64.b64decode(req.image_base64)
        image = Image.open(io.BytesIO(img_bytes)).convert("RGBA")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"圖片解碼失敗：{e}")

    try:
        result = pixelate(
            image,
            num_colors=req.num_colors,
            scale_result=req.scale_result,
            transparent_background=False,
            pixel_width=req.pixel_width,
        )
        if req.transparent_background:
            result = flood_fill_transparent(result)
        if req.locked_palette:
            result = remap_to_palette(result, req.locked_palette)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"像素化失敗：{e}")

    return {"image_base64": image_to_b64(result)}
