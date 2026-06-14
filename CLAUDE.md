# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案目的

Godot 遊戲美術輔助工具。四個工作模式：
- **SPRITE**：文字 prompt → Imagen 4 生成 → proper-pixel-art 像素化 → PNG 匯出
- **TILE SET**：material 描述 → Gemini Flash Image 生成 13 格 autotile sheet → Godot TileSet 匯出
- **PROPS**：biome 描述 → Art Director（Gemini Flash）規劃 → Imagen 4 生成 grid → 切割 8 個道具 PNG
- **ANIM**：角色描述 → Imagen 4 鎖定 anchor → Gemini Flash Image 生成動畫 sheet → frames + manifest 匯出

## 啟動開發環境

**後端**（conda 環境 `pixagen`，port 8070）：
```powershell
cd backend
conda activate pixagen
uvicorn main:app --reload --port 8070
```

**前端**（port 5173）：
```powershell
cd frontend
npm run dev
```

**型別檢查**：
```powershell
cd frontend
npx tsc --noEmit
```

## 環境設定

`backend/.env` 需要：
```
GEMINI_API_KEY=your_key_here
```

`proper-pixel-art` 是本地 clone（非 PyPI），需手動安裝一次：
```powershell
pip install -e ../proper-pixel-art
```

## 架構說明

### 後端（Python FastAPI）

```
backend/
├── main.py              # FastAPI app，CORS 設定，所有 router 註冊
├── db.py                # SQLite usage.db，記錄每次生成的 model、cost、prompt
├── utils.py             # 共用工具：flood_fill_transparent、image_to_b64、b64_to_image
└── routes/
    ├── generate.py      # POST /api/generate — Imagen 4，支援 num_images(1-4)、style_key、model
    ├── pixelate.py      # POST /api/pixelate — proper-pixel-art 像素化 + flood fill 去背
    ├── props.py         # POST /api/props/generate、/api/props/reroll
    ├── tileset.py       # POST /api/tileset/generate — gemini-2.5-flash-image 13 格 autotile
    ├── sprite.py        # POST /api/sprite/lock-character、/api/sprite/generate-sheet
    └── usage.py         # GET /api/usage — 用量統計摘要
```

**關鍵決策**：
- `transparent_background`：proper-pixel-art 原生去背不穩，改用自製 flood fill（`utils.flood_fill_transparent`）從四角連通填充，`tolerance=30`。
- 模型選擇：`generate.py` / `props.py` / `sprite.py` 都接受 `model` 參數，白名單為 `{"imagen-4.0-generate-001", "imagen-4.0-fast-generate-001"}`，非白名單自動 fallback 到 quality 版。
- `gemini-2.5-flash-image` 呼叫：`types.Part.from_text(text=...)` 需用 keyword argument（`text=` 不可省略，否則 TypeError）。
- Tileset：`_build_template` 用 Pillow 程式畫 4×4 magenta 底板，再讓 AI restyle；chroma key（tolerance=40）去背後接 flood fill。
- Props grid 切割：flood fill 依賴四角背景色，若 AI 把道具畫到角落會失效。
- Sprite Anim：Pass 1 Imagen 4 鎖 anchor → Pass 2 gemini-2.5-flash-image 生成 N-frame sheet，chroma key + flood fill 去背，組合 grid + strip。

### 前端（React + TypeScript + Vite + Tailwind）

```
frontend/src/
├── App.tsx              # mode state（sprite/tileset/props/anim）、Sprite workspace 狀態、鍵盤快捷鍵
│                        # 四個 workspace 皆 always mounted（CSS hidden 切換，避免切分頁失狀態）
├── api.ts               # fetch 封裝，AbortController timeout
│                        # generate/lockCharacter: 60s｜generateSheet/generateProps/generateTileset: 120s｜pixelate: 60s
├── hooks/
│   ├── useHistory.ts    # Sprite 歷史紀錄（localStorage，最多 10 筆，key: pixelart_history）
│   └── usePropsHistory.ts  # Props 歷史紀錄（localStorage，最多 3 筆，key: props_history）
└── components/
    ├── PromptPanel/     # prompt textarea、style tags、比例按鈕、IMAGE MODEL 切換、Generate/Upload
    ├── CanvasPreview/   # 縮圖列（多張時）、原圖/像素化對比、Erase 模式、拖曳上傳
    ├── PixelControls/   # pixel_width / num_colors / scale_result / transparent_bg 滑桿
    ├── ExportPanel/     # 下載 PNG（原始尺寸 / 32×32 / 64×64 / 128×128）
    ├── HistoryPanel/    # Sprite 歷史紀錄縮圖列表
    ├── PropsWorkspace/  # PROPS 分頁：biome 選擇、ART STYLE、IMAGE MODEL、歷史紀錄、道具卡片牆
    ├── TilesetWorkspace/# TILE SET 分頁：material 選擇、4×4 grid 預覽、atlas 預覽、platform 預覽
    ├── SpriteAnimWorkspace/ # ANIM 分頁：Lock Character → Generate Sheet → 動畫播放器
    └── Toast/           # 錯誤/警告/資訊 toast
```

**關鍵決策**：
- `originalImages: string[]` + `selectedIdx: number`：Generate 回傳多張後存陣列，切換縮圖時觸發重新 pixelate。
- 滑桿變動 → `debouncedPixelate`（300ms）自動重新像素化。
- Erase 模式：純前端 Canvas flood fill，支援 5 步 `pixelImageHistory` 復原。
- 四個 workspace 用 `className={mode !== 'xxx' ? 'hidden' : 'flex flex-1 overflow-hidden'}` 切換，永遠 mounted，切分頁不失狀態。
- Props 後端回傳欄位為 `image_base64`，前端接收時需明確映射到 `imageB64`（不可用 spread）。

## API 端點速查

| 方法 | 路徑 | 重要參數 |
|---|---|---|
| POST | `/api/generate` | `prompt`, `aspect_ratio`, `num_images`(1-4), `style_key`, `model` |
| POST | `/api/pixelate` | `image_base64`, `pixel_width`, `num_colors`, `scale_result`, `transparent_background` |
| POST | `/api/props/generate` | `biome`, `style_key`, `existing_names`, `batch_size`(預設 8), `model` |
| POST | `/api/props/reroll` | `name`, `description`, `biome`, `style_key`, `model` |
| POST | `/api/tileset/generate` | `material`, `style_key`, `tile_size`(32/64/128) |
| POST | `/api/sprite/lock-character` | `description`, `style_key`, `model` |
| POST | `/api/sprite/generate-sheet` | `anchor_image_base64`, `animation`, `style_key`, `tile_size` |
| GET  | `/api/usage` | — |

## 可用 AI 模型

| 模型 | 用途 | 費用 |
|---|---|---|
| `imagen-4.0-generate-001` | 文字轉圖（預設，Quality）| $0.04/張 |
| `imagen-4.0-fast-generate-001` | 文字轉圖（Fast，前端可切換）| 較低 |
| `gemini-2.5-flash-image` | 圖片輸入＋輸出（Tileset、Sprite Anim）| token 計費 |
| `gemini-2.5-flash` | 純文字（Props Art Director）| 極低 |

## 動畫規格（ANIM 分頁）

| 動畫 | Frames | Cols×Rows | FPS | Loop |
|---|---|---|---|---|
| idle | 4 | 4×1 | 6 | true |
| walk | 6 | 3×2 | 10 | true |
| run | 6 | 3×2 | 12 | true |
| attack | 4 | 4×1 | 12 | false |
| hurt | 2 | 2×1 | 10 | false |
| death | 4 | 4×1 | 8 | false |

## 開發路線圖

`pixel-art-agent-plan.md` 所有 Phase 1–8 已全部完成。
