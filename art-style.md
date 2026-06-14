# 美術風格定版文件 — Art Style Bible

## 風格定調

**一句話定義**
「星露谷的生活感 × Eastward 的手繪溫度，住在一個充滿爐火與蒸汽的工坊小鎮。」

**參考座標**
- 星露谷（Stardew Valley）：生活節奏、農場物件、NPC 表情豐富度
- Eastward：輪廓線的厚度感、角色的圓潤比例、暖色光源的處理方式
- 自身特色加分項：workshop / 工坊氛圍，機械零件與自然元素並存

---

## 色盤規範

### 主色盤（16 色）

工具生成時 `num_colors` 鎖定 **16**，以下為目標色域：

| 色群 | 用途 | 色調描述 |
|---|---|---|
| 爐火橘 × 3 | 光源、火焰、高光 | 深磚紅 → 焦糖橘 → 鵝黃 |
| 木棕 × 3 | 木頭、土地、傢俱 | 深咖 → 中棕 → 沙褐 |
| 石灰灰 × 2 | 石材、金屬底色 | 深炭灰 → 淺石灰 |
| 苔蘚綠 × 2 | 植物、苔蘚、點綴 | 深橄欖 → 草綠 |
| 奶油白 × 1 | 最亮高光、蠟燭光 | 暖白（帶黃） |
| 深夜藍 × 2 | 陰影、夜空、窗外 | 深靛藍 → 暗紫灰 |
| 皮膚色 × 2 | 角色臉部、手部 | 米色 → 淺桃 |
| 點綴紅 × 1 | UI 強調、物件特色 | 深磚紅 |

**禁用**：純黑（#000000）、純白（#FFFFFF）。陰影用深靛藍代替黑，高光用暖白代替純白。

### 光影規則
- 光源方向：**左上角 45°**（爐火感，暖橘打亮）
- 每個物件最少 **3 個明度層次**：陰影 / 中間調 / 高光
- 高光點用 **1-2 px** 的奶油白，不要大面積留白
- 陰影邊緣允許 **1px 的深藍輪廓**（Eastward 特色）

---

## Sprite 規格

### 基本單位
- **角色**：32×32 px（含腳底空間）
- **物件 / 道具**：16×16 px（小）、32×32 px（中）
- **場景元素**：32×32 或 32×48（高型，如樹木、機器）
- **Tile**：16×16 px

### 角色比例
```
頭部：約 10-12 px 高（佔全身 1/3）
身體：約 12 px 高
腿部：約 8 px 高
寬度：約 16-20 px（有點 chibi 感）
```
→ 比星露谷稍圓潤，比 Eastward 稍小，介於兩者之間。

### 輪廓線
- 使用 **1px 深色輪廓**（非純黑，用深咖啡或深靛藍）
- 內部結構線可以用比輪廓淺 1-2 色階的顏色
- 禁止：無輪廓（太現代）、2px 以上輪廓（太粗糙）

---

## 場景氛圍

### 室內（工坊 / 家）
- 地板：木板紋，棕色系，斜向光澤感
- 牆壁：磚塊或木板，帶歲月感的紋理
- 光源：爐火 / 燈籠 / 蠟燭打出的暖橘漸層
- 道具：齒輪、工具、藥瓶、書本混搭農場物件

### 室外（村莊 / 農場）
- 白天：暖黃天光，草地帶淺棕土色
- 傍晚（主要時段）：天空深靛藍，地面保留爐火橘反光
- 植物：苔蘚綠為主，少量點綴花色

---

## AI 生成 Prompt 定版

### 主 Prompt 結構
```
{素材描述}, {視角}, {光源},
cozy pixel art, stardew valley style with eastward warmth,
32x32 sprite, warm amber and brown palette, hand-crafted pixel shading,
soft candlelight glow, whimsical workshop atmosphere,
1px dark outline, 16 colors, transparent background, game asset
```

### 視角關鍵字對照
| 素材類型 | 視角用語 |
|---|---|
| 角色 | `front-facing idle pose` / `side view walking` |
| 道具 / 物件 | `top-down view` / `isometric view` |
| 場景元素 | `side view` / `slight top-down angle` |
| 建築 | `isometric view, slight top-down` |

### 範例 Prompt（角色）
```
a cheerful female engineer character, front-facing idle pose, holding a wrench,
cozy pixel art, stardew valley style with eastward warmth,
32x32 sprite, warm amber and brown palette, hand-crafted pixel shading,
soft candlelight glow, whimsical workshop atmosphere,
1px dark outline, 16 colors, transparent background, game asset
```

### 範例 Prompt（道具）
```
a small wooden toolbox with brass fittings, top-down view, slightly open lid,
cozy pixel art, stardew valley style with eastward warmth,
32x32 sprite, warm amber and brown palette, hand-crafted pixel shading,
soft candlelight glow, whimsical workshop atmosphere,
1px dark outline, 16 colors, transparent background, game asset
```

### 範例 Prompt（場景物件）
```
a stone fireplace with burning fire, side view, warm glowing embers,
cozy pixel art, stardew valley style with eastward warmth,
32x48 sprite, warm amber and brown palette, hand-crafted pixel shading,
soft candlelight glow, whimsical workshop atmosphere,
1px dark outline, 16 colors, transparent background, game asset
```

---

## 工具設定對照

在你的 pixel-art-agent 工具裡，建議預設值：

| 參數 | 預設值 | 說明 |
|---|---|---|
| block_size | 8 | 對應 32x32 sprite 的顆粒感 |
| num_colors | 16 | 符合定版色盤 |
| upscale | 4x | 輸出 128x128，Godot import 後縮放 |
| transparent_bg | on | 方便 Godot 直接用 |

---

## 禁止事項（保持風格一致）

- 禁止：寫實光影、照片質感描述（如 `photorealistic`, `4K`, `detailed texture`）
- 禁止：純黑陰影或純白高光
- 禁止：超過 16 色的色盤（會失去復古感）
- 禁止：無輪廓線的 flat 風格
- 禁止：日系 RPG Maker 風格描述（如 `JRPG style`，會跑掉）
