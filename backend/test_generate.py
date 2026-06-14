import requests
import base64
from pathlib import Path

url = "http://localhost:8000/api/generate"
payload = {
    "prompt": "a small wooden toolbox with brass fittings, top-down view",
    "style": "cozy pixel art",
    "aspect_ratio": "1:1",
}

print(f"POST {url}")
print(f"prompt: {payload['prompt']}\n")

resp = requests.post(url, json=payload, timeout=60)
print(f"Status: {resp.status_code}")

if resp.status_code == 200:
    data = resp.json()
    b64 = data["image_base64"]
    print(f"image_base64 length: {len(b64)} chars")

    out = Path("test_output.png")
    out.write_bytes(base64.b64decode(b64))
    print(f"Saved: {out.resolve()}")
else:
    print(f"Error: {resp.text}")
