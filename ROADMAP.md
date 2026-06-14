# Pixel Art Studio — 開發路線圖

> 以實際遊戲美術製作角度規劃。優先解決「素材放進遊戲後風格不統一」的核心問題。

---

## Phase 9 — 調色盤鎖定系統 ✅

**目標：** 讓所有分頁生成的素材共用同一組顏色，解決視覺一致性問題。

### 後端

- [ ] `routes/palette.py`：新增 `POST /api/palette/extract`
  - 輸入：`image_base64`
  - 輸出：從圖片量化擷取的調色盤（最多 32 色，hex 陣列）
- [ ] `utils.py`：新增 `remap_to_palette(img, palette, dither=False)`
  - 將任意圖片強制重新量化到指定調色盤
- [ ] 所有生成端點加入可選參數 `locked_palette: list[str] | None`
  - 有傳入時，生成完成後執行 `remap_to_palette`

### 前端

- [ ] `hooks/usePalette.ts`：全局 Palette state（localStorage 持久化）
  - `palette: string[]`（hex 色碼陣列）
  - `isLocked: boolean`
  - `setPalette / lockPalette / clearPalette`
- [ ] `components/PaletteBar/`：頂部 header 右側常駐的調色盤顯示列
  - 色塊點擊可移除單色
  - 🔒 Lock 按鈕切換鎖定狀態
  - 「從目前素材擷取」按鈕
  - 鎖定後所有分頁生成自動帶入 `locked_palette`
- [ ] SPRITE 分頁：生成成功後提示「要不要鎖定這個調色盤？」

### 驗收標準

- 鎖定後，SPRITE / PROPS / TILE SET / ANIM 生成出來的素材共用同一組顏色
- PaletteBar 在所有分頁都可見
- 調色盤鎖定狀態跨頁面切換不遺失

---

## Phase 10 — 前端素材編輯工具 ✅

**目標：** 不需要重新生成就能做常見的後製調整。純前端 Canvas，零 API 費用。

### 功能清單

- [ ] **Palette Swap（換色）**
  - 點擊圖片中的顏色 → 用 color picker 換成另一色 → flood fill 全圖替換
  - 用途：紅色騎士 → 藍色騎士，不同陣營的 recolor
- [ ] **Mirror（翻轉）**
  - 水平 / 垂直翻轉按鈕
  - 用途：一張圖生成左右兩個方向
- [ ] **Trim（自動裁切）**
  - 自動裁到最小非透明邊界（Godot 匯入時常需要）
- [ ] **Outline（外框）**
  - 在非透明像素邊緣加一圈指定顏色的外框
  - 用途：讓角色在背景上更清晰

### UI

- SPRITE 分頁的右側操作列新增「EDIT TOOLS」區塊
- 所有編輯操作支援 `Ctrl+Z` 還原（接現有的 `pixelImageHistory`）

### 驗收標準

- Palette Swap 可以換掉任意顏色並即時預覽
- Mirror 結果正確，像素不模糊
- Trim 後匯出的 PNG 邊界乾淨

---

## Phase 11 — 遊戲基準尺寸系統 ✅

**目標：** 設定全局 tile 基準，讓角色、道具、磚塊放在遊戲裡比例正確。

### 設計

- 「Game Unit」概念：1 unit = N px（base resolution）
  - 角色 = 1×2 units
  - 道具 = 0.5×0.5 units
  - Tile = 1×1 unit
- 設定頁面（或 header 下拉）選 base resolution：**8 / 16 / 32 px per unit**
- 匯出時統一換算，所有素材以相同 scale factor 輸出

### 後端

- [ ] 各端點匯出前加入 `export_size` 換算邏輯（目前是固定 32/64/128，改為從 game unit 推導）

### 前端

- [ ] `components/GameSettings/`：header 右側設定 popover
  - Base Unit 選擇
  - 顯示各素材在此 unit 下的實際匯出尺寸
- [ ] 匯出時在檔名加入尺寸標記（例如 `knight_32x64.png`）

### 驗收標準

- 設定 16px base 後，SPRITE 匯出 32×64px，TILE SET 匯出 16×16px，PROPS 匯出 8×8px
- 所有匯出素材放進 Godot 後比例一致

---

## Phase 12 — 素材庫與場景預覽

**目標：** 讓所有生成過的素材可以統一瀏覽，並拖放到預覽場景中確認風格和比例。

### Asset Gallery 頁面（新增第 5 個分頁：GALLERY）

- [ ] 顯示所有 session 內生成過的素材（SPRITE / PROPS / TILE SET frames / ANIM frames）
- [ ] 按類型篩選、按時間排序
- [ ] 點任意素材可下載 PNG

### Scene Preview

- [ ] Gallery 內可拖放素材到「預覽畫布」
- [ ] 畫布背景可選色或貼 tileset body 填充
- [ ] 素材可移動、縮放（維持像素比），用來確認比例關係
- [ ] 截圖匯出整個預覽場景

### 驗收標準

- 所有生成過的素材在 GALLERY 都看得到
- 可以把一個角色、幾個道具、一組 tile 拖到同個畫面確認搭配

---

## Phase 13 — 背景層生成器（新分頁：BG）

**目標：** 生成可水平捲動的 Parallax 背景，2–3 層。

### 後端

- [ ] `routes/background.py`：`POST /api/background/generate`
  - 輸入：`scene_description`, `style_key`, `num_layers`(2–3), `aspect_ratio`
  - 流程：Imagen 4 生成寬幅場景圖 → 各層自動去背（天空層留天空、中景層去地面等）
  - 輸出：`layers: [{ name, image_base64, scroll_speed_hint }]`

### 前端

- [ ] `components/BackgroundWorkspace/`
  - 場景描述輸入
  - 層數選擇
  - 預覽：模擬 Parallax 捲動效果（CSS animation）
  - 各層個別匯出 PNG

### 驗收標準

- 生成 2 層背景（遠景 + 中景），預覽中可看到 Parallax 差速捲動效果

---

## Phase 14 — 素材關聯性強化

**目標：** 讓各分頁共享素材資訊，生成時互相參考，提升整體一致性。

- [ ] **SPRITE → ANIM 連動**：SPRITE 分頁鎖定的角色可直接帶入 ANIM 分頁，不用重新描述
- [ ] **ANIM 多動畫連貫**：Lock Character 一次後，連續生成多個動畫（IDLE / WALK / RUN）時 anchor 不重置，避免角色造型漂移
- [ ] **PROPS 參考角色尺寸**：生成 PROPS 時可選擇「以目前角色為尺寸參考」，讓 AI 生成比例合理的道具
- [ ] **跨分頁 Character Context**：`App.tsx` 新增 `globalCharacter` state，可從 SPRITE 或 ANIM 設定，供其他分頁讀取

---

## Phase 15 — VFX Sprite Sheet 生成器（新分頁或 ANIM 子功能）

**目標：** 生成效果動畫素材（爆炸、閃光、魔法、煙霧等）。

- [ ] `routes/vfx.py`：`POST /api/vfx/generate`
  - 輸入：`effect_type`（explosion / sparkle / heal / smoke / slash），`style_key`, `tile_size`
  - 流程：直接用 Gemini Flash Image 生成 N-frame sheet（不需 anchor，效果不需一致角色）
  - 輸出：`frames`, `strip`, `manifest`
- [ ] `components/VfxWorkspace/`
  - 效果類型選擇（預設 + 自訂描述）
  - 動畫播放器（同 ANIM）
  - 匯出 strip / frames

---

## 技術債 / 小改善

這些項目工程量小，可穿插在各 Phase 之間處理：

- [ ] Props 歷史紀錄上限從 3 筆提升到 5 筆，並支援刪除單筆
- [ ] ANIM 分頁：Lock Character 完成後自動捲到主區域，不用手動往下看
- [ ] TILE SET：生成後支援單一 tile 的 reroll（類似 PROPS 的 REROLL）
- [ ] 所有分頁加入 `/api/usage` 用量顯示（目前有 API 但前端沒有接）
- [ ] 錯誤訊息改善：API 429 時顯示預估等待時間
- [ ] 匯出 ZIP：一鍵打包所有素材（需前端 JSZip）

---

## 完成記錄

| Phase | 內容 | 狀態 |
|---|---|---|
| Phase 1 | 骨架（FastAPI + Vite + CORS） | ✅ 完成 |
| Phase 2A | Imagen 4 生成 + 用量紀錄 | ✅ 完成 |
| Phase 2B | proper-pixel-art 像素化串接 | ✅ 完成 |
| Phase 2C | 前端四元件 + Erase 模式 | ✅ 完成 |
| Phase 3A | 錯誤處理（toast、quota、斷線） | ✅ 完成 |
| Phase 3B | 歷史紀錄（localStorage） | ✅ 完成 |
| Phase 3C | Prompt 範本 + 風格庫 | ✅ 完成 |
| Phase 4A | 上傳圖片直接像素化 | ✅ 完成 |
| Phase 4B | 批次生成 2 張 + 縮圖挑選 | ✅ 完成 |
| Phase 4C | 6 種遊戲風格 style_key | ✅ 完成 |
| Phase 5 | Workspace UI 重構（四分頁） | ✅ 完成 |
| Phase 6 | Props 批次生成器 | ✅ 完成 |
| Phase 7 | Tile Set 生成器 | ✅ 完成 |
| Phase 8 | Sprite 動畫 Sheet 生成器 | ✅ 完成 |
| Phase 9 | 調色盤鎖定系統 | ✅ 完成 |
| Phase 10 | 前端素材編輯工具（Flip/Trim/Outline/Swap） | ✅ 完成 |
| Phase 11 | 遊戲基準尺寸系統（GameSettings + useGameUnit） | ✅ 完成 |
| Phase 10 | 前端素材編輯工具 | ✅ 完成 |
| Phase 12 | 素材庫（GALLERY）+ 拖放場景預覽 | ✅ 完成 |
