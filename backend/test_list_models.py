from dotenv import load_dotenv
load_dotenv()

from google import genai

client = genai.Client()

print("=== 支援圖片生成的模型 ===")
for m in client.models.list():
    if "generat" in m.name.lower() and any(
        "image" in str(a).lower() for a in (m.supported_actions or [])
    ):
        print(f"  {m.name}  actions={m.supported_actions}")

print("\n=== 所有名稱含 imagen 的模型 ===")
for m in client.models.list():
    if "imagen" in m.name.lower():
        print(f"  {m.name}  actions={m.supported_actions}")
