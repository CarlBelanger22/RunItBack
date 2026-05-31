import { TEAM_ICON_MAX_BYTES } from './teamIcon';

export type TeamIconBgMode = 'auto' | 'white' | 'black';

export interface ProcessTeamIconOptions {
  bgMode?: TeamIconBgMode;
  paddingPx?: number;
  maxSize?: number;
}

const BLACK_FLOOD_MAX = 45;
const WHITE_FLOOD_MIN = 240;
const DEFAULT_MAX_SIZE = 512;

function detectBgMode(imageData: ImageData): 'white' | 'black' {
  const { width, height, data } = imageData;
  const corners = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ] as const;

  let sum = 0;
  for (const [x, y] of corners) {
    const i = (y * width + x) * 4;
    sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
  }

  return sum / corners.length > 128 ? 'white' : 'black';
}

function isBackgroundPixel(
  data: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
  mode: 'white' | 'black'
): boolean {
  const i = (y * width + x) * 4;
  if (data[i + 3] < 128) return false;

  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];

  if (mode === 'white') {
    return Math.min(r, g, b) >= WHITE_FLOOD_MIN;
  }

  return Math.max(r, g, b) <= BLACK_FLOOD_MAX;
}

export function removeBorderBackground(
  imageData: ImageData,
  bgMode: TeamIconBgMode
): ImageData {
  const output = new ImageData(
    new Uint8ClampedArray(imageData.data),
    imageData.width,
    imageData.height
  );
  const { width, height, data } = output;
  const mode = bgMode === 'auto' ? detectBgMode(output) : bgMode;
  const removed = new Uint8Array(width * height);
  const queue: number[] = [];

  const tryPush = (x: number, y: number) => {
    const index = y * width + x;
    if (removed[index]) return;
    if (!isBackgroundPixel(data, width, x, y, mode)) return;
    removed[index] = 1;
    queue.push(index);
  };

  for (let x = 0; x < width; x++) {
    tryPush(x, 0);
    tryPush(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    tryPush(0, y);
    tryPush(width - 1, y);
  }

  while (queue.length > 0) {
    const index = queue.pop()!;
    const x = index % width;
    const y = Math.floor(index / width);

    if (x > 0) tryPush(x - 1, y);
    if (x < width - 1) tryPush(x + 1, y);
    if (y > 0) tryPush(x, y - 1);
    if (y < height - 1) tryPush(x, y + 1);
  }

  for (let index = 0; index < width * height; index++) {
    if (removed[index]) {
      data[index * 4 + 3] = 0;
    }
  }

  return output;
}

function imageDataToCanvas(imageData: ImageData): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  canvas.getContext('2d')!.putImageData(imageData, 0, 0);
  return canvas;
}

export function trimAndResize(
  imageData: ImageData,
  paddingPx = 0,
  maxSize = DEFAULT_MAX_SIZE
): ImageData {
  const { width, height, data } = imageData;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 0) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (minX > maxX || minY > maxY) {
    throw new Error('No visible logo content after background removal.');
  }

  minX = Math.max(0, minX - paddingPx);
  minY = Math.max(0, minY - paddingPx);
  maxX = Math.min(width - 1, maxX + paddingPx);
  maxY = Math.min(height - 1, maxY + paddingPx);

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;
  const sourceCanvas = imageDataToCanvas(imageData);

  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = cropW;
  cropCanvas.height = cropH;
  const cropCtx = cropCanvas.getContext('2d')!;
  cropCtx.drawImage(sourceCanvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);

  const scale = maxSize / Math.max(cropW, cropH);
  const outW = Math.max(1, Math.round(cropW * scale));
  const outH = Math.max(1, Math.round(cropH * scale));

  const outCanvas = document.createElement('canvas');
  outCanvas.width = outW;
  outCanvas.height = outH;
  const outCtx = outCanvas.getContext('2d')!;
  outCtx.imageSmoothingEnabled = true;
  outCtx.imageSmoothingQuality = 'high';
  outCtx.drawImage(cropCanvas, 0, 0, outW, outH);

  return outCtx.getImageData(0, 0, outW, outH);
}

export function imageDataToPngDataUrl(imageData: ImageData): string {
  const canvas = imageDataToCanvas(imageData);
  return canvas.toDataURL('image/png');
}

export function dataUrlByteSize(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1] ?? '';
  return Math.ceil(base64.length * 0.75);
}

export async function loadImageDataFromSource(src: string): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not process image.'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
    };
    img.onerror = () => reject(new Error('Could not load image.'));
    img.src = src;
  });
}

export async function processTeamIcon(
  sourceDataUrl: string,
  options: ProcessTeamIconOptions = {}
): Promise<string> {
  const bgMode = options.bgMode ?? 'auto';
  const paddingPx = options.paddingPx ?? 0;
  const maxSize = options.maxSize ?? DEFAULT_MAX_SIZE;

  let imageData = await loadImageDataFromSource(sourceDataUrl);
  imageData = removeBorderBackground(imageData, bgMode);
  imageData = trimAndResize(imageData, paddingPx, maxSize);
  return imageDataToPngDataUrl(imageData);
}

export async function processTeamIconWithSizeLimit(
  sourceDataUrl: string,
  options: ProcessTeamIconOptions = {},
  maxBytes = TEAM_ICON_MAX_BYTES
): Promise<string> {
  let maxSize = options.maxSize ?? DEFAULT_MAX_SIZE;
  let result = await processTeamIcon(sourceDataUrl, { ...options, maxSize });

  while (dataUrlByteSize(result) > maxBytes && maxSize > 128) {
    maxSize = Math.floor(maxSize * 0.85);
    result = await processTeamIcon(sourceDataUrl, { ...options, maxSize });
  }

  if (dataUrlByteSize(result) > maxBytes) {
    throw new Error(
      'Processed logo is still too large. Try a smaller source image.'
    );
  }

  return result;
}

/** Regression guard: interior dark pixels must not be keyed when disconnected from border. */
export function countInteriorDarkPixels(imageData: ImageData): number {
  const { width, height, data } = imageData;
  let count = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] > 128 && Math.max(data[i], data[i + 1], data[i + 2]) < 50) {
        count++;
      }
    }
  }

  return count;
}
