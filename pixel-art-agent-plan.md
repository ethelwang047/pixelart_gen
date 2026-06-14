# Godot 遊戲美術輔助工具 — 完整規劃 v2

## 專案現況（已完成）

**Phase 1–3 全部驗收通過。** 以下為現有能力：

| 功能 | 狀態 |
|---|---|
| 文字 prompt → Imagen 4 生成 | ✅ |
| proper-pixel-art 像素化（flood fill 去背） | ✅ |
| 風格標籤、比例選擇、pixel/color 滑桿 | ✅ |
| 5 步 undo、localStorage 歷史紀錄 | ✅ |
| Toast 錯誤處理、離線偵測 | ✅ |
| SQLite 用量紀錄 | ✅ |

**技術棧**
- 前端：React + TypeScript + Vite + Tailwind（port 5173）
- 後端：Python FastAPI（port 8070），conda 環境 `pixagen`（Python 3.12）
- AI 生成：`google-genai` SDK
- 可用模型確認：
  - `imagen-4.0-generate-001`（純文字轉圖，現在用的）
  - `imagen-4.0-fast-generate-001`（快速版）
  - `gemini-2.5-flash-image`（✅ 支援圖片輸入＋輸出，新功能關鍵）
  - `gemini-2.5-flash`（純文字，作 art director 用）
  - `gemini-3.1-flash-image`（最新圖片模型）

---

## 開發路線圖

```
Phase 4 — 上傳像素化 + 批次生成 + 風格庫     ← 快速擴充，沿用現有架構
Phase 5 — Workspace UI 重構                    ← 為後續多模式做地基
Phase 6 — Props 批次生成器                     ← art director 雙 call 模式
Phase 7 — Tile Set 生成器                      ← 切換 gemini-2.5-flash-image
Phase 8 — Sprite 動畫 Sheet 生成器             ← 兩 pass，anchor 鎖角色
```

---

## Phase 4 — 快速擴充（沿用現有架構）

### 4A：上傳圖片直接像素化

不走 AI，讓用戶把已有的素材（截圖、參考圖）直接轉像素風。

**後端**：不需要新 route，`/api/pixelate` 直接支援，只需前端加入口。

**前端變更**：
- `PromptPanel` 的 Generate 按鈕旁加「Upload」按鈕（或拖曳放到 CanvasPreview）
- 上傳後直接進 `runPixelate()` 流程，不呼叫 generate
- 上傳的原圖也要顯示在左側（setOriginalImage）

**驗收**：拖一張 PNG 進去，右側出現像素化結果，可調整參數、匯出。

---

### 4B：批次生成 N 張 + 挑選

Imagen 4 單次最多回傳 4 張，現在鎖死 1 張。改成 2-4 張讓用戶挑。

**後端 `/api/generate` 修改**：
```python
class GenerateRequest(BaseModel):
    prompt: str
    style: str = "cozy pixel art"
    aspect_ratio: str = "1:1"
    num_images: int = 2  # 新增，範圍 1-4

# 回傳改成 list
response = client.models.generate_images(
    model=MODEL,
    prompt=full_prompt,
    config=types.GenerateImagesConfig(
        number_of_images=req.num_images,  # 2-4 張
        aspect_ratio=req.aspect_ratio,
    ),
)
images = [
    base64.b64encode(img.image.image_bytes).decode()
    for img in response.generated_images
]
return {"images": images, "mime_type": "image/png"}
```

**前端變更**：
- `App.tsx` 改存 `originalImages: string[]`（陣列）
- CanvasPreview 上方加縮圖列（最多 4 個）+ 選中高亮
- 選中哪張就對那張進 pixelate

**驗收**：生成後顯示 2 張縮圖，點選切換，右側即時像素化。

---

### 4C：風格庫解鎖

現在 STYLE_SUFFIX 寫死「星露谷 × Eastward」。改成可選多種遊戲美術風格。

**後端 `/api/generate` 修改**：
```python
STYLES: dict[str, str] = {
    "stardew":    "cozy pixel art, stardew valley style with eastward warmth, warm amber and brown palette, hand-crafted pixel shading, soft candlelight glow, 1px dark outline, 16 colors, transparent background, game asset",
    "cave_story": "retro pixel art, cave story style, limited palette, strong black outlines, atmospheric lighting, transparent background, game asset",
    "undertale":  "simple pixel art, undertale style, minimal shading, bold outlines, flat colors, expressive, transparent background, game asset",
    "rpg_map":    "top-down RPG pixel art, SNES era style, rich tileable textures, warm earthy palette, transparent background, game asset",
    "sci_fi":     "pixel art, sci-fi cyberpunk style, neon accent colors, dark metallic surfaces, glowing edges, transparent background, game asset",
    "horror":     "pixel art, dark horror game style, desaturated palette, high contrast, eerie atmosphere, transparent background, game asset",
}

# req.style 從前端傳 key，對到 STYLES dict
style_suffix = STYLES.get(req.style, STYLES["stardew"])
full_prompt = f"{req.prompt}, {style_suffix}"
```

**前端變更**：
- `StyleTags.tsx` 改成風格卡片選擇器（radio-style，一次選一種）
- 每個風格卡片顯示名稱 + 一行描述

---

## Phase 5 — Workspace UI 重構

在加入 Tile / Props / Sprite 三個新模式前，先把 UI 結構改好，避免後面大改。

### 目標架構

```
┌─────────────────────────────────────────────────────────┐
│  ⚒ Pixel Art Studio    [Sprite] [Tile Set] [Props]      │  ← header + mode tabs
├───────────┬─────────────────────────────────────────────┤
│           │                                             │
│  左側面板  │           主畫布區域                        │
│  (依模式   │           (依模式切換)                      │
│   切換)    │                                             │
│           │                                             │
└───────────┴─────────────────────────────────────────────┘
```

### 前端重構

**`App.tsx`**：
- 加入 `mode: 'sprite' | 'tileset' | 'props'` state
- 根據 mode 渲染對應的左側面板和主畫布
- 各模式 state 獨立（Sprite state / Tileset state / Props state），不互相干擾

**Header**：
- 現有 `⚒ Pixel Art Generator` 改成 `⚒ Pixel Art Studio`
- 加入模式切換 pill tabs（參考 image-extender 的 TopBar）

**共用元件保留**：
- `Toast` — 所有模式共用
- `ExportPanel` — 改成各模式各自有匯出區塊，不抽共用

---

## Phase 6 — Props 批次生成器

**目的**：一次生成 4-8 個場景裝飾道具（樹、石頭、箱子、燈籠……），Art Director 確保多樣性不重複。

### 流程設計

```
用戶輸入 biome（如「forest glade」）+ 已有 props 清單
        │
        ▼
Call 1：gemini-2.5-flash（純文字）
  → Art Director：「給我 8 個適合 forest glade 的裝飾道具，
    已有：[mushroom, rock, log]，
    請避免重複，要橫跨不同分類（植物/礦物/骨頭/容器/光源）」
  → 回傳 JSON：[{name: "lantern", description: "old iron lantern with warm glow"}, ...]
        │
        ▼
Call 2：imagen-4.0-generate-001
  → Painter：生成 8 個道具排列在透明背景的 2×4 grid 圖
        │
        ▼
後端切割 grid → 8 張獨立透明 PNG
        │
        ▼
前端顯示 8 個卡片，可單獨重生或刪除
        │
        ▼
匯出：個別 PNG + atlas + manifest.json
```

### 後端 `/api/props/generate`

```python
class PropsGenerateRequest(BaseModel):
    biome: str           # "forest glade", "volcanic", "snowy peaks" …
    style_key: str = "stardew"
    existing_names: list[str] = []   # 已有 props 的名稱，用於去重
    batch_size: int = 8

# Step 1: Art Director call
art_director_prompt = f"""
You are an art director for a pixel art game.
Biome: {req.biome}
Already in library: {', '.join(req.existing_names) or 'none'}
Generate exactly {req.batch_size} decoration prop ideas.
Rules:
- Avoid duplicating existing items
- Spread across: plants, minerals, containers, bones/debris, light sources, creature traces
- Each prop should work as a standalone transparent sprite
Return JSON array: [{{"name": "slug_name", "description": "short visual description for a painter"}}]
"""

text_response = client.models.generate_content(
    model="gemini-2.5-flash",
    contents=art_director_prompt,
)
props_plan = json.loads(text_response.text)   # [{name, description}]

# Step 2: Painter call
cols, rows = 4, (req.batch_size + 3) // 4
painter_prompt = f"""
{cols}×{rows} sprite sheet of {req.batch_size} decoration props for a {req.biome} scene.
{style_suffix}
Props (left-to-right, top-to-bottom):
{chr(10).join(f"{i+1}. {p['description']}" for i, p in enumerate(props_plan))}
Each prop in its own cell, transparent background, no grid lines, no labels.
"""
# imagen 生成 grid 圖 → 切割 → 回傳
```

### 前端 Props 工作區

- 左側：biome 選擇（8 個預設 + 自訂文字）、風格選擇、「Add More」按鈕
- 主區：道具卡片牆（含名稱標籤）
  - 每張卡片 hover 顯示：重生（單獨）/ 刪除
  - 卡片支援拖曳排序（optional）
- 匯出區：「Download ZIP」（個別 PNG + atlas + manifest.json）

---

## Phase 7 — Tile Set 生成器

**目的**：一次 AI call 生成 13 格 autotile set，可直接 import 進 Godot TileSet。

### 13 格 autotile 結構

```
┌────┬────┬────┬────┐
│ TL │ TE │ TE │ TR │   TL=Top-Left outer corner
├────┼────┼────┼────┤   TE=Top Edge
│ LE │ IC │ IC │ RE │   LE=Left Edge / RE=Right Edge
├────┼────┼────┼────┤   IC=Inner Corner
│ LE │ IC │ IC │ RE │   BL=Bottom-Left / BR=Bottom-Right
├────┼────┼────┼────┤   BE=Bottom Edge / BF=Body Fill
│ BL │ BE │ BE │ BR │
└────┴────┴────┴────┘

實際 13 格：Body(1) + Top/Bottom/Left/Right Edge(4) + 4 Outer Corners(4) + 4 Inner Corners(4)
```

### 流程設計

```
用戶輸入 material（如「mossy stone」）
        │
        ▼
後端生成 4×4 template 圖（程式畫：圓角矩形排列，標出每格角色）
        │
        ▼
gemini-2.5-flash-image（圖片輸入 + 圖片輸出）
  → "Restyle this template as [material] pixel art tiles.
    Keep the exact same cell layout and positions.
    Use magenta #FF00FF as background."
        │
        ▼
後端切割 4×4 sheet → 13 個 cell
        │
        ▼
chroma key（去掉 magenta → 透明）
        │
        ▼
各 tile 個別做像素化（proper-pixel-art）
        │
        ▼
Corner 修正：用 edge tile 的紋理縫合 outer/inner corner 接縫
        │
        ▼
回傳：13 張個別 tile + atlas（含 2px extrude）+ manifest.json
```

### 後端 `/api/tileset/generate`

```python
class TilesetGenerateRequest(BaseModel):
    material: str       # "mossy stone", "red brick", "oak planks", "snow" …
    tile_size: int = 64 # 生成時的 cell 解析度
    style_key: str = "stardew"
    pixel_width: int = 8
    num_colors: int = 16
```

**template 生成**：用 Pillow 程式畫出 4×4 格子，每格用圓角矩形示意，填 magenta 背景，用深色標出每格的 tile 角色（Body、TEdge、LEdge……）。

**gemini-2.5-flash-image 呼叫**：
```python
from google.genai import types

response = client.models.generate_content(
    model="gemini-2.5-flash-image",
    contents=[
        types.Part.from_bytes(data=template_bytes, mime_type="image/png"),
        types.Part.from_text(painter_prompt),
    ],
    config=types.GenerateContentConfig(
        response_modalities=["IMAGE", "TEXT"],
    ),
)
```

### 前端 Tileset 工作區

- 左側：material 描述輸入、14 個預設 material chips（mossy stone / red brick / oak planks / snow / …）、tile size 選擇（32/64）、Generate 按鈕
- 主區：4×4 grid 預覽（每格可點選單獨重生）+ 右側平台預覽（tile 拼成平台效果圖）
- 匯出區：「Download Atlas」（含 2px extrude）、「Download ZIP」（個別 PNG + manifest）

**manifest.json 格式**（Godot 友善）：
```json
{
  "tile_size": 64,
  "atlas_size": [256, 256],
  "tiles": {
    "body":           {"x": 0, "y": 0},
    "top_edge":       {"x": 64, "y": 0},
    "right_edge":     {"x": 128, "y": 0},
    "bottom_edge":    {"x": 0, "y": 64},
    "left_edge":      {"x": 64, "y": 64},
    "outer_tl":       {"x": 128, "y": 64},
    "outer_tr":       {"x": 0, "y": 128},
    "outer_bl":       {"x": 64, "y": 128},
    "outer_br":       {"x": 128, "y": 128},
    "inner_tl":       {"x": 0, "y": 192},
    "inner_tr":       {"x": 64, "y": 192},
    "inner_bl":       {"x": 128, "y": 192},
    "inner_br":       {"x": 192, "y": 192}
  }
}
```

---

## Phase 8 — Sprite 動畫 Sheet 生成器

**目的**：兩 pass 工作流，先鎖角色外觀，再生成動畫 sheet，輸出 Godot AnimatedSprite2D 可直接用的格式。

### 兩 Pass 工作流

```
Pass 1 — Lock Character（建立角色錨點）
  用戶描述角色 → Imagen 4 生成單張站立正面圖 → 顯示 anchor
  用戶點「Confirm Character」才進 Pass 2
        │
        ▼
Pass 2 — Generate Animation Sheet（以 anchor 為參考）
  選動畫類型（idle / walk / run / attack / hurt / death）
  gemini-2.5-flash-image（圖片輸入 = anchor 圖）
    → "The attached image is the character reference.
       Generate a [N]-frame [animation] sprite sheet,
       [cols]×[rows] grid, each cell [tile_size]px,
       magenta background."
        │
        ▼
後端切割 frames → 個別去背 → 像素化
        │
        ▼
對齊修正：腳底對齊基線、水平置中
        │
        ▼
回傳：frame 陣列 + grid sheet + horizontal strip + manifest.json
```

### 動畫規格

| 動畫 | 幀數 | FPS | 備註 |
|---|---|---|---|
| idle | 4 | 6 | 輕微呼吸起伏 |
| walk | 6 | 10 | 左右腳交替 |
| run | 6 | 12 | 幅度更大 |
| attack | 4 | 12 | 一次性（loop=false）|
| hurt | 2 | 10 | 一次性 |
| death | 4 | 8 | 一次性 |

### 後端 `/api/sprite/lock-character` + `/api/sprite/generate-sheet`

```python
# Pass 1
class LockCharacterRequest(BaseModel):
    description: str       # 角色描述，如 "a cheerful female engineer holding a wrench"
    style_key: str = "stardew"
    aspect_ratio: str = "1:1"

# 回傳單張角色圖（base64）

# Pass 2
class GenerateSheetRequest(BaseModel):
    anchor_image_base64: str   # Pass 1 的結果
    animation: str             # "idle" | "walk" | "run" | "attack" | "hurt" | "death"
    style_key: str = "stardew"
    pixel_width: int = 8
    num_colors: int = 16
    tile_size: int = 64

# 回傳：frames (list[str]), grid_sheet (str), strip (str), manifest (dict)
```

### 前端 Sprite 工作區

- 左側：
  - 角色描述 textarea + 快捷預設 chips（knight / engineer / mage / goblin / slime）
  - 「Lock Character」按鈕（跑 Pass 1）
  - anchor 縮圖 + 「Re-roll Character」按鈕
  - 動畫選擇 chips（idle / walk / run / attack / hurt / death）
  - 「Generate Sheet」按鈕（跑 Pass 2）
- 主區：
  - 動畫播放器（loop / one-shot，FPS 滑桿）
  - 下方 grid sheet 完整預覽
- 匯出區：Grid Sheet PNG、Horizontal Strip PNG、ZIP（全部 + manifest.json）

**manifest.json 格式**（Godot 友善）：
```json
{
  "tile_size": 64,
  "animation": "walk",
  "frame_count": 6,
  "fps": 10,
  "loop": true,
  "strip_size": [384, 64],
  "grid_size": [192, 128],
  "grid_cols": 3,
  "grid_rows": 2,
  "frames": [
    {"index": 0, "grid_x": 0, "grid_y": 0, "strip_x": 0}
  ]
}
```

---

## 實作優先順序

```
4A 上傳像素化        → 1-2 天，完全不動後端
4B 批次生成          → 1 天，後端小改、前端加縮圖列
4C 風格庫            → 0.5 天，純後端 dict + 前端 UI
──────────────────────────────────────────────
5  Workspace UI 重構  → 1-2 天，前端架構調整
──────────────────────────────────────────────
6  Props 生成器       → 3-4 天
7  Tile Set 生成器    → 4-5 天（含 template 生成 + corner 修正）
8  Sprite 動畫 Sheet  → 5-7 天（含 2-pass + 對齊修正）
```

---

## 目錄結構（Phase 8 完成時）

```
pixelart-generation/
├── pixel-art-agent-plan.md
├── art-style.md
├── image-extender/         # 參考用，不整合
├── proper-pixel-art/       # 本地 clone
│
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── db.py
│   └── routes/
│       ├── generate.py     # /api/generate（Imagen 4，支援 num_images + style_key）
│       ├── pixelate.py     # /api/pixelate
│       ├── usage.py        # /api/usage
│       ├── props.py        # /api/props/generate（新）
│       ├── tileset.py      # /api/tileset/generate（新）
│       └── sprite.py       # /api/sprite/lock-character + /api/sprite/generate-sheet（新）
│
└── frontend/
    └── src/
        ├── App.tsx             # mode state + workspace 切換
        ├── types.ts
        ├── api.ts
        ├── hooks/
        │   └── useHistory.ts
        └── components/
            ├── TopBar/             # mode tabs
            ├── Toast/
            ├── workspace/
            │   ├── SpriteWorkspace/    # Phase 4 現有功能 + Phase 8
            │   │   ├── index.tsx
            │   │   ├── PromptPanel/
            │   │   ├── CanvasPreview/
            │   │   ├── PixelControls/
            │   │   └── ExportPanel/
            │   ├── TilesetWorkspace/   # Phase 7
            │   │   ├── index.tsx
            │   │   ├── MaterialPanel/
            │   │   ├── TileGrid/
            │   │   └── PlatformPreview/
            │   └── PropsWorkspace/     # Phase 6
            │       ├── index.tsx
            │       ├── BiomePanel/
            │       └── PropCard/
            └── shared/
                ├── StyleSelector/
                └── PixelControls/
```

---

## 注意事項 / 技術決策紀錄

- **`gemini-2.5-flash-image` 呼叫方式**：使用 `client.models.generate_content()`，`response_modalities=["IMAGE", "TEXT"]`，圖片從 `response.candidates[0].content.parts` 裡找 `part.inline_data`。
- **Imagen 4 透明背景**：prompt 加 `transparent background` 有機率出透明圖，但不穩定。Sprite 和 Props 建議仍走 flood fill 去背確保品質。
- **Tile corner 修正**：corner tile 接縫直接拼接會有 artifact，最簡單的修正是從相鄰 edge tile 取材做 feathered blend，或接受 AI 直接生成的結果（品質通常夠）。
- **`image-extender` 作為參考**：`app/utils/imageProcessor.ts`（Poisson blend、chroma key、sprite 對齊）、`app/utils/rigs/`（pose rig 結構）、`app/lib/tileset.ts`（tile 切割邏輯）都可以當實作參考，但移植時要改成 Python 後端邏輯。
- **成本估算**：
  - Imagen 4 生成：$0.04/張
  - Gemini 2.5 Flash Image：依 token 計費，約 $0.01-0.05/call
  - Gemini 2.5 Flash（純文字 art director）：極低，約 $0.001/call
