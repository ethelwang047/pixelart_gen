export interface GenerateRequest {
  prompt: string;
  style: string;
  aspect_ratio: string;
}

export interface PixelateRequest {
  image_base64: string;
  pixel_width: number;
  num_colors: number;
  scale_result: number;
  transparent_background: boolean;
}

export interface AppState {
  prompt: string;
  styleTag: string;
  originalImage: string | null;
  pixelImage: string | null;
  pixelWidth: number;
  numColors: number;
  isGenerating: boolean;
  isPixelating: boolean;
  error: string | null;
}
