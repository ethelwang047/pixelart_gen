const BASE = "http://localhost:8070/api";
const TIMEOUT_MS = 60_000;

function withTimeout(ms: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return { signal: controller.signal, clear: () => clearTimeout(timer) }
}

async function handleResponse(res: Response): Promise<unknown> {
  if (res.ok) return res.json()
  const body = await res.text()
  let detail = body
  try {
    detail = JSON.parse(body)?.detail ?? body
  } catch { /* keep raw text */ }
  throw new ApiError(res.status, String(detail))
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export function friendlyError(e: unknown): string {
  if (e instanceof DOMException && e.name === 'AbortError') return '請求超時（60 秒），請重試'
  if (e instanceof ApiError) {
    if (e.status === 429) return 'API 配額已達上限，請等候約 1 分鐘後再試'
    if (e.status === 403) return 'API Key 無效或無 Imagen 存取權限'
    if (e.status === 503) return 'GEMINI_API_KEY 未設定，請檢查後端環境變數'
    return e.message
  }
  if (e instanceof Error) return e.message
  return '未知錯誤'
}

export async function generateImage(
  prompt: string,
  style_key: string = "stardew",
  aspect_ratio: string = "1:1",
  num_images: number = 2,
  model: string = "imagen-4.0-generate-001",
  locked_palette?: string[],
) {
  const { signal, clear } = withTimeout(60_000)
  try {
    const res = await fetch(`${BASE}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, style_key, aspect_ratio, num_images, model, locked_palette }),
      signal,
    })
    return handleResponse(res)
  } finally {
    clear()
  }
}

export async function generateTileset(params: {
  material: string
  style_key: string
  tile_size: number
  locked_palette?: string[]
}) {
  const { signal, clear } = withTimeout(120_000)
  try {
    const res = await fetch(`${BASE}/tileset/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      signal,
    })
    return handleResponse(res)
  } finally {
    clear()
  }
}

export async function generateProps(params: {
  biome: string
  style_key: string
  existing_names: string[]
  batch_size?: number
  model?: string
  locked_palette?: string[]
}) {
  const { signal, clear } = withTimeout(120_000)
  try {
    const res = await fetch(`${BASE}/props/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batch_size: 8, ...params }),
      signal,
    })
    return handleResponse(res)
  } finally {
    clear()
  }
}

export async function rerollProp(params: {
  name: string
  description: string
  biome: string
  style_key: string
  model?: string
  locked_palette?: string[]
}) {
  const { signal, clear } = withTimeout(60_000)
  try {
    const res = await fetch(`${BASE}/props/reroll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      signal,
    })
    return handleResponse(res)
  } finally {
    clear()
  }
}

export async function lockCharacter(params: {
  description: string
  style_key: string
  model?: string
  locked_palette?: string[]
}) {
  const { signal, clear } = withTimeout(60_000)
  try {
    const res = await fetch(`${BASE}/sprite/lock-character`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "imagen-4.0-generate-001", ...params }),
      signal,
    })
    return handleResponse(res)
  } finally {
    clear()
  }
}

export async function generateSheet(params: {
  anchor_image_base64: string
  animation: string
  style_key: string
  tile_size: number
  locked_palette?: string[]
}) {
  const { signal, clear } = withTimeout(120_000)
  try {
    const res = await fetch(`${BASE}/sprite/generate-sheet`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      signal,
    })
    return handleResponse(res)
  } finally {
    clear()
  }
}

export async function pixelateImage(params: {
  image_base64: string;
  pixel_width: number;
  num_colors: number;
  scale_result: number;
  transparent_background: boolean;
  locked_palette?: string[];
}) {
  const { signal, clear } = withTimeout(TIMEOUT_MS)
  try {
    const res = await fetch(`${BASE}/pixelate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      signal,
    })
    return handleResponse(res)
  } finally {
    clear()
  }
}

export async function rerollTile(params: {
  material: string
  tile_name: string
  style_key: string
  tile_size: number
  locked_palette?: string[]
}) {
  const { signal, clear } = withTimeout(60_000)
  try {
    const res = await fetch(`${BASE}/tileset/reroll-tile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal,
    })
    return handleResponse(res)
  } finally {
    clear()
  }
}

export async function getUsage() {
  const { signal, clear } = withTimeout(10_000)
  try {
    const res = await fetch(`${BASE}/usage`, { signal })
    return handleResponse(res)
  } finally {
    clear()
  }
}

export async function extractPalette(image_base64: string, max_colors: number = 24) {
  const { signal, clear } = withTimeout(TIMEOUT_MS)
  try {
    const res = await fetch(`${BASE}/palette/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64, max_colors }),
      signal,
    })
    return handleResponse(res)
  } finally {
    clear()
  }
}
