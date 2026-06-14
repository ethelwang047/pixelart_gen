import base64
import io
import os

from fastapi import APIRouter, HTTPException
from google import genai
from google.genai import types
from PIL import Image
from pydantic import BaseModel

from db import log_generation
from utils import remap_to_palette, image_to_b64

router = APIRouter()

_api_key = os.environ.get("GEMINI_API_KEY")
client = genai.Client(api_key=_api_key) if _api_key else None

STYLES: dict[str, str] = {
    "stardew": (
        "cozy pixel art, stardew valley style with eastward warmth, "
        "warm amber and brown palette, hand-crafted pixel shading, "
        "soft candlelight glow, whimsical workshop atmosphere, "
        "1px dark outline, 16 colors, transparent background, game asset"
    ),
    "cave_story": (
        "retro pixel art, cave story style, limited 8-color palette, "
        "strong black outlines, crisp pixel edges, atmospheric lighting, "
        "16-bit era aesthetic, transparent background, game asset"
    ),
    "undertale": (
        "simple pixel art, undertale style, minimal shading, "
        "bold dark outlines, flat limited colors, expressive and charming, "
        "8-bit feel, transparent background, game asset"
    ),
    "rpg_map": (
        "top-down RPG pixel art, SNES era style, rich tileable textures, "
        "warm earthy palette, detailed shading, final fantasy vi aesthetic, "
        "transparent background, game asset"
    ),
    "sci_fi": (
        "pixel art, sci-fi cyberpunk style, neon accent colors on dark surfaces, "
        "glowing edges and holographic details, metallic textures, "
        "1px dark outline, transparent background, game asset"
    ),
    "horror": (
        "pixel art, dark horror game style, desaturated muted palette, "
        "high contrast shadows, eerie unsettling atmosphere, "
        "scratchy textures, 1px dark outline, transparent background, game asset"
    ),
}

IMAGEN_MODELS = {"imagen-4.0-generate-001", "imagen-4.0-fast-generate-001"}
ASPECT_RATIOS = {"1:1", "3:4", "4:3", "9:16", "16:9"}


class GenerateRequest(BaseModel):
    prompt: str
    style_key: str = "stardew"
    aspect_ratio: str = "1:1"
    num_images: int = 2
    model: str = "imagen-4.0-generate-001"
    locked_palette: list[str] | None = None


@router.post("/generate")
def generate_image(req: GenerateRequest):
    if client is None:
        raise HTTPException(status_code=503, detail="GEMINI_API_KEY 未設定")

    if req.aspect_ratio not in ASPECT_RATIOS:
        raise HTTPException(
            status_code=400,
            detail=f"aspect_ratio 必須是 {ASPECT_RATIOS} 其中之一",
        )

    num = max(1, min(4, req.num_images))
    model = req.model if req.model in IMAGEN_MODELS else "imagen-4.0-generate-001"
    style_suffix = STYLES.get(req.style_key, STYLES["stardew"])
    full_prompt = f"{req.prompt}, {style_suffix}"

    try:
        response = client.models.generate_images(
            model=model,
            prompt=full_prompt,
            config=types.GenerateImagesConfig(
                number_of_images=num,
                aspect_ratio=req.aspect_ratio,
            ),
        )
    except Exception as e:
        err = str(e)
        log_generation(model, req.prompt, req.aspect_ratio, success=False, error=err[:500])
        if "RESOURCE_EXHAUSTED" in err or "quota" in err.lower():
            raise HTTPException(status_code=429, detail="Gemini API 配額已達上限，請稍後再試")
        if "PERMISSION_DENIED" in err or "API_KEY" in err:
            raise HTTPException(status_code=403, detail="API Key 無效或無 Imagen 存取權限")
        raise HTTPException(status_code=500, detail=err)

    log_generation(model, req.prompt, req.aspect_ratio, success=True)

    images = []
    for gen_img in response.generated_images:
        if req.locked_palette:
            pil = Image.open(io.BytesIO(gen_img.image.image_bytes)).convert("RGBA")
            images.append(image_to_b64(remap_to_palette(pil, req.locked_palette)))
        else:
            images.append(base64.b64encode(gen_img.image.image_bytes).decode())
    return {"images": images, "mime_type": "image/png"}
