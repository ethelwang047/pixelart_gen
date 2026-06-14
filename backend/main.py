from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.generate import router as generate_router
from routes.pixelate import router as pixelate_router
from routes.props import router as props_router
from routes.tileset import router as tileset_router
from routes.sprite import router as sprite_router
from routes.usage import router as usage_router
from routes.palette import router as palette_router
from routes.vfx import router as vfx_router

from db import init_db

app = FastAPI(title="Pixel Art Generator API")

init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(generate_router, prefix="/api")
app.include_router(pixelate_router, prefix="/api")
app.include_router(props_router, prefix="/api")
app.include_router(tileset_router, prefix="/api")
app.include_router(sprite_router, prefix="/api")
app.include_router(usage_router, prefix="/api")
app.include_router(palette_router, prefix="/api")
app.include_router(vfx_router, prefix="/api")
