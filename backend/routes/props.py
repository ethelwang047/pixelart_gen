import io
import json
import os

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

GRID_COLS = 4
IMAGEN_MODELS = {"imagen-4.0-generate-001", "imagen-4.0-fast-generate-001"}


class PropsGenerateRequest(BaseModel):
    biome: str = "forest glade"
    style_key: str = "stardew"
    existing_names: list[str] = []
    batch_size: int = 8
    model: str = "imagen-4.0-generate-001"
    locked_palette: list[str] | None = None


class PropRerollRequest(BaseModel):
    name: str
    description: str
    biome: str
    style_key: str = "stardew"
    model: str = "imagen-4.0-generate-001"
    locked_palette: list[str] | None = None


def _cut_grid(img: Image.Image, cols: int, rows: int) -> list[Image.Image]:
    w, h = img.size
    cw, ch = w // cols, h // rows
    return [
        img.crop((col * cw, row * ch, (col + 1) * cw, (row + 1) * ch))
        for row in range(rows)
        for col in range(cols)
    ]


def _parse_art_director_json(raw: str) -> list[dict]:
    text = raw.strip()
    # Strip markdown code fences
    if text.startswith("```"):
        lines = text.splitlines()
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    # Find the JSON array
    start = text.find("[")
    end = text.rfind("]") + 1
    if start == -1 or end == 0:
        raise ValueError("No JSON array found in response")
    return json.loads(text[start:end])


@router.post("/props/generate")
def props_generate(req: PropsGenerateRequest):
    if client is None:
        raise HTTPException(status_code=503, detail="GEMINI_API_KEY 未設定")

    batch_size = max(1, min(8, req.batch_size))
    style_suffix = STYLES.get(req.style_key, STYLES["stardew"])
    avoid = ", ".join(req.existing_names[:50]) or "none yet"

    # ── Step 1: Art Director ────────────────────────────────────────────────
    art_prompt = f"""You are an art director for a pixel art game.
Biome: {req.biome}
Already in library: {avoid}

Generate exactly {batch_size} decoration prop ideas for this biome scene.
Rules:
- Do NOT repeat or resemble anything already in the library
- Spread across different categories: plants, rocks, containers, bones/debris, light sources, fungi, creature traces, structures
- Each prop is a small standalone object (not a large background element)
- Descriptions must be visual and specific: shape, size, color, key details

Return ONLY a valid JSON array, no other text:
[{{"name": "snake_case_slug", "description": "painter instruction sentence", "category": "category_word"}}]"""

    try:
        text_resp = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=art_prompt,
        )
        props_plan = _parse_art_director_json(text_resp.text)[:batch_size]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Art Director 失敗：{e}")

    if not props_plan:
        raise HTTPException(status_code=500, detail="Art Director 回傳空列表")

    count = len(props_plan)
    rows = max(1, (count + GRID_COLS - 1) // GRID_COLS)
    aspect = "4:3" if rows <= 2 else "1:1"

    # ── Step 2: Painter ─────────────────────────────────────────────────────
    prop_lines = "\n".join(
        f"{i + 1}. {p['name']}: {p['description']}" for i, p in enumerate(props_plan)
    )
    paint_prompt = (
        f"A {GRID_COLS}×{rows} sprite sheet of {count} small standalone decoration props "
        f"for a {req.biome} pixel art game scene. {style_suffix}\n"
        f"Props left-to-right, top-to-bottom:\n{prop_lines}\n"
        f"Each prop centered and isolated in its own equal cell on a flat solid light-gray background. "
        f"No grid lines, no borders, no text labels."
    )

    imagen_model = req.model if req.model in IMAGEN_MODELS else "imagen-4.0-generate-001"
    try:
        paint_resp = client.models.generate_images(
            model=imagen_model,
            prompt=paint_prompt,
            config=types.GenerateImagesConfig(number_of_images=1, aspect_ratio=aspect),
        )
        sheet = Image.open(io.BytesIO(paint_resp.generated_images[0].image.image_bytes)).convert("RGBA")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Painter 失敗：{e}")

    # ── Step 3: Cut + transparency ──────────────────────────────────────────
    cells = _cut_grid(sheet, GRID_COLS, rows)[:count]
    props_out = []
    for i, (cell, plan) in enumerate(zip(cells, props_plan)):
        processed = flood_fill_transparent(cell)
        if req.locked_palette:
            processed = remap_to_palette(processed, req.locked_palette)
        props_out.append({
            "name": plan.get("name", f"prop_{i + 1}"),
            "description": plan.get("description", ""),
            "category": plan.get("category", "misc"),
            "image_base64": image_to_b64(processed),
        })

    return {"props": props_out}


@router.post("/props/reroll")
def prop_reroll(req: PropRerollRequest):
    if client is None:
        raise HTTPException(status_code=503, detail="GEMINI_API_KEY 未設定")

    style_suffix = STYLES.get(req.style_key, STYLES["stardew"])
    prompt = (
        f"A single small standalone decoration prop: {req.name} — {req.description}. "
        f"For a {req.biome} game scene. {style_suffix} "
        f"Centered on a flat solid light-gray background. Isolated object only, no scenery."
    )

    imagen_model = req.model if req.model in IMAGEN_MODELS else "imagen-4.0-generate-001"
    try:
        resp = client.models.generate_images(
            model=imagen_model,
            prompt=prompt,
            config=types.GenerateImagesConfig(number_of_images=1, aspect_ratio="1:1"),
        )
        img = Image.open(io.BytesIO(resp.generated_images[0].image.image_bytes)).convert("RGBA")
        processed = flood_fill_transparent(img)
        if req.locked_palette:
            processed = remap_to_palette(processed, req.locked_palette)
        return {"image_base64": image_to_b64(processed)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
