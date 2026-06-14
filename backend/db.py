import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(__file__).parent / "usage.db"

# 每張圖片的 USD 費用（付費方案）
MODEL_COSTS: dict[str, float] = {
    "imagen-4.0-generate-001": 0.04,
    "imagen-4.0-fast-generate-001": 0.02,
    "imagen-4.0-ultra-generate-001": 0.06,
}


def init_db() -> None:
    with _conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS generations (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp    TEXT    NOT NULL,
                model        TEXT    NOT NULL,
                prompt       TEXT    NOT NULL,
                aspect_ratio TEXT    NOT NULL,
                cost_usd     REAL    NOT NULL,
                success      INTEGER NOT NULL,
                error        TEXT
            )
        """)


@contextmanager
def _conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def log_generation(
    model: str,
    prompt: str,
    aspect_ratio: str,
    success: bool,
    error: str | None = None,
) -> None:
    cost = MODEL_COSTS.get(model, 0.04) if success else 0.0
    with _conn() as conn:
        conn.execute(
            """
            INSERT INTO generations (timestamp, model, prompt, aspect_ratio, cost_usd, success, error)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                datetime.now(timezone.utc).isoformat(),
                model,
                prompt[:300],   # 只存前 300 字，避免 db 過肥
                aspect_ratio,
                cost,
                1 if success else 0,
                error,
            ),
        )


def get_usage_summary() -> dict:
    with _conn() as conn:
        total = conn.execute(
            "SELECT COUNT(*) as calls, SUM(cost_usd) as total_cost FROM generations WHERE success=1"
        ).fetchone()

        by_model = conn.execute(
            """
            SELECT model, COUNT(*) as calls, SUM(cost_usd) as cost
            FROM generations WHERE success=1
            GROUP BY model ORDER BY cost DESC
            """
        ).fetchall()

        recent = conn.execute(
            """
            SELECT id, timestamp, model, prompt, aspect_ratio, cost_usd, success, error
            FROM generations ORDER BY id DESC LIMIT 20
            """
        ).fetchall()

    return {
        "total_calls": total["calls"] or 0,
        "total_cost_usd": round(total["total_cost"] or 0, 4),
        "by_model": [
            {"model": r["model"], "calls": r["calls"], "cost_usd": round(r["cost"], 4)}
            for r in by_model
        ],
        "recent": [
            {
                "id": r["id"],
                "timestamp": r["timestamp"],
                "model": r["model"],
                "prompt": r["prompt"],
                "aspect_ratio": r["aspect_ratio"],
                "cost_usd": r["cost_usd"],
                "success": bool(r["success"]),
                "error": r["error"],
            }
            for r in recent
        ],
    }
