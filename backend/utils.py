import io
import base64
from collections import deque

import numpy as np
from PIL import Image


def flood_fill_transparent(image: Image.Image, tolerance: int = 30) -> Image.Image:
    """從四角連通 flood fill，將背景色設為透明。"""
    img = image.convert("RGBA")
    data = np.array(img, dtype=np.uint8)
    h, w = data.shape[:2]

    corner_coords = [(0, 0), (0, w - 1), (h - 1, 0), (h - 1, w - 1)]
    corner_colors = np.array([data[y, x, :3] for y, x in corner_coords], dtype=np.int32)
    bg_ref = corner_colors.mean(axis=0)

    def _near_bg(y: int, x: int) -> bool:
        diff = np.abs(data[y, x, :3].astype(np.int32) - bg_ref)
        return bool(diff.max() <= tolerance)

    visited = np.zeros((h, w), dtype=bool)
    queue: deque[tuple[int, int]] = deque()

    for y, x in corner_coords:
        if not visited[y, x] and _near_bg(y, x):
            visited[y, x] = True
            queue.append((y, x))

    while queue:
        y, x = queue.popleft()
        if not _near_bg(y, x):
            continue
        data[y, x, 3] = 0
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx]:
                visited[ny, nx] = True
                queue.append((ny, nx))

    return Image.fromarray(data)


def image_to_b64(img: Image.Image) -> str:
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


def b64_to_image(b64: str) -> Image.Image:
    return Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGBA")


def remap_to_palette(img: Image.Image, palette_hex: list[str]) -> Image.Image:
    """將圖片每個不透明像素重新映射到 palette_hex 裡最近的顏色，保留 alpha 通道。"""
    if not palette_hex:
        return img

    pal_rgb = []
    for h in palette_hex:
        h = h.lstrip("#")
        pal_rgb.append([int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)])
    pal_arr = np.array(pal_rgb, dtype=np.int32)  # (N, 3)

    rgba = np.array(img.convert("RGBA"), dtype=np.uint8)
    alpha = rgba[:, :, 3].copy()
    H, W = rgba.shape[:2]
    flat = rgba[:, :, :3].reshape(-1, 3).astype(np.int32)  # (P, 3)

    # 分塊計算最近色，避免 (P, N, 3) 佔用過多記憶體
    chunk = 8192
    nearest = np.empty(H * W, dtype=np.int32)
    for start in range(0, H * W, chunk):
        end = min(start + chunk, H * W)
        diff = flat[start:end, np.newaxis, :] - pal_arr[np.newaxis, :, :]  # (c, N, 3)
        nearest[start:end] = (diff ** 2).sum(axis=2).argmin(axis=1)

    remapped = pal_arr[nearest].reshape(H, W, 3).astype(np.uint8)
    result = np.dstack([remapped, alpha])
    return Image.fromarray(result, "RGBA")
