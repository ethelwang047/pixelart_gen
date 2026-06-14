# Pixel Art Studio

Godot 遊戲美術輔助工具，四種生成模式一站搞定 sprite、tile set、props、動畫 sheet。

## 功能

| 模式 | 說明 |
|------|------|
| **SPRITE** | 文字 prompt → Imagen 4 生成 → 像素化 → PNG 匯出 |
| **TILE SET** | material 描述 → Gemini Flash Image 生成 13 格 autotile sheet → Godot TileSet |
| **PROPS** | biome 描述 → Art Director 規劃 → Imagen 4 生成 grid → 切割 8 個道具 PNG |
| **ANIM** | 角色描述 → Imagen 4 鎖定 anchor → Gemini Flash Image 生成動畫 sheet → frames + manifest |
| **GALLERY** | 收集所有生成結果，可拖曳排版成場景預覽 |

### 額外功能

- **調色盤鎖定**：從任何素材擷取調色盤並鎖定，讓跨分頁生成的素材保持色彩一致
- **Erase / Swap 工具**：純前端 flood fill 去背、顏色替換，支援 5 步復原
- **Game Unit 設定**：設定 tile size，影響各模式的匯出尺寸

## 環境需求

- Python 3.12+（conda 環境 `pixagen`）
- Node.js 18+
- Google Cloud 帳號（Gemini API Key）

## 安裝

### 1. 後端

```powershell
cd backend
conda activate pixagen
pip install -r requirements.txt
```

`proper-pixel-art` 是本地 clone，需另外安裝：

```powershell
pip install -e ../proper-pixel-art
```

建立 `backend/.env`：

```
GEMINI_API_KEY=your_key_here
```

### 2. 前端

```powershell
cd frontend
npm install
```

## 啟動

**後端**（port 8070）：

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

開啟 http://localhost:5173

## 技術棧

| 層 | 技術 |
|----|------|
| 前端 | React 18 + TypeScript + Vite + Tailwind CSS |
| 後端 | Python FastAPI + uvicorn |
| 圖片生成 | Imagen 4 (`imagen-4.0-generate-001`) |
| 圖片理解/生成 | Gemini 2.5 Flash Image |
| 文字 Art Director | Gemini 2.5 Flash |
| 像素化 | proper-pixel-art（本地 clone） |
| 用量紀錄 | SQLite (`backend/usage.db`) |

## API 端點

| 方法 | 路徑 | 用途 |
|------|------|------|
| POST | `/api/generate` | Imagen 4 文字轉圖 |
| POST | `/api/pixelate` | 像素化 |
| POST | `/api/palette/extract` | 從圖片擷取調色盤 |
| POST | `/api/props/generate` | Props 批次生成 |
| POST | `/api/props/reroll` | 單一道具重生 |
| POST | `/api/tileset/generate` | Tile set 生成 |
| POST | `/api/sprite/lock-character` | 鎖定角色 anchor |
| POST | `/api/sprite/generate-sheet` | 生成動畫 sheet |
| GET  | `/api/usage` | 用量統計 |

## 匯出格式

所有模式均支援透明背景 PNG，並附 `manifest.json`（Godot 友善格式，記錄 tile size、frame 座標等）。
