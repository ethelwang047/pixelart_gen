from fastapi import APIRouter
from db import get_usage_summary

router = APIRouter()


@router.get("/usage")
def usage_summary():
    return get_usage_summary()
