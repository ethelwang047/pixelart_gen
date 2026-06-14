import base64
import requests
from pathlib import Path


def load_image_as_b64(path: str) -> str:
    return base64.b64encode(Path(path).read_bytes()).decode()


# 用上一步生成的測試圖當輸入
input_path = "test_output.png"
if not Path(input_path).exists():
    print(f"找不到 {input_path}，請先跑 test_generate.py")
    raise SystemExit(1)

image_b64 = load_image_as_b64(input_path)

url = "http://localhost:8000/api/pixelate"

test_cases = [
    {"pixel_width": 4,  "num_colors": 8,  "scale_result": 8, "label": "fine"},
    {"pixel_width": 8,  "num_colors": 16, "scale_result": 4, "label": "mid"},
    {"pixel_width": 16, "num_colors": 32, "scale_result": 2, "label": "coarse"},
]

for tc in test_cases:
    label = tc.pop("label")
    payload = {"image_base64": image_b64, "transparent_background": True, **tc}

    print(f"Testing pixel_width={tc['pixel_width']} ...", end=" ")
    resp = requests.post(url, json=payload, timeout=60)

    if resp.status_code == 200:
        out = Path(f"test_pixelated_{label}.png")
        out.write_bytes(base64.b64decode(resp.json()["image_base64"]))
        print(f"OK → {out}")
    else:
        print(f"FAIL {resp.status_code}: {resp.text}")
