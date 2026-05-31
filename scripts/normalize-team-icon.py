#!/usr/bin/env python3
"""Normalize team logo PNGs: border flood-fill bg removal, square canvas, optional bake."""

from __future__ import annotations

import argparse
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

CANVAS_SIZE = 512
PADDING_PX = 0
BLACK_FLOOD_MAX = 45
WHITE_FLOOD_MIN = 240


def detect_bg_mode(rgb: np.ndarray) -> str:
    h, w, _ = rgb.shape
    corners = np.array(
        [rgb[0, 0], rgb[0, w - 1], rgb[h - 1, 0], rgb[h - 1, w - 1]],
        dtype=np.int16,
    )
    if np.mean(corners) > 128:
        return 'white'
    return 'black'


def _flood_border_mask(rgb: np.ndarray, alpha: np.ndarray, mode: str) -> np.ndarray:
    h, w, _ = rgb.shape
    remove = np.zeros((h, w), dtype=bool)
    q: deque[tuple[int, int]] = deque()

    def is_bg(r: int, c: int) -> bool:
        if alpha[r, c] < 128:
            return False
        px = rgb[r, c].astype(np.int16)
        if mode == 'white':
            return int(np.min(px)) >= WHITE_FLOOD_MIN
        return int(np.max(px)) <= BLACK_FLOOD_MAX

    for x in range(w):
        for y in (0, h - 1):
            if is_bg(y, x):
                remove[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if not remove[y, x] and is_bg(y, x):
                remove[y, x] = True
                q.append((y, x))

    while q:
        y, x = q.popleft()
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not remove[ny, nx] and is_bg(ny, nx):
                remove[ny, nx] = True
                q.append((ny, nx))

    return remove


def remove_border_background(data: np.ndarray, bg_mode: str) -> np.ndarray:
    out = data.copy()
    rgb = out[:, :, :3]
    alpha = out[:, :, 3]
    mode = bg_mode if bg_mode != 'auto' else detect_bg_mode(rgb)
    remove = _flood_border_mask(rgb, alpha, mode)
    out[:, :, 3] = np.where(remove, 0, alpha)
    return out


def trim_and_resize(
    data: np.ndarray,
    padding_px: int = PADDING_PX,
    max_size: int = CANVAS_SIZE,
) -> Image.Image:
    alpha = data[:, :, 3]
    ys, xs = np.where(alpha > 0)
    if len(xs) == 0:
        raise ValueError('No visible content after background removal')

    x0 = max(0, int(xs.min()) - padding_px)
    x1 = min(data.shape[1], int(xs.max()) + 1 + padding_px)
    y0 = max(0, int(ys.min()) - padding_px)
    y1 = min(data.shape[0], int(ys.max()) + 1 + padding_px)
    cropped = data[y0:y1, x0:x1]

    img = Image.fromarray(cropped)
    w, h = img.size
    scale = max_size / max(w, h)
    new_w = max(1, int(round(w * scale)))
    new_h = max(1, int(round(h * scale)))
    if (new_w, new_h) != (w, h):
        img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    return img


def bake_background(img: Image.Image, hex_color: str) -> Image.Image:
    hex_color = hex_color.lstrip('#')
    bg = tuple(int(hex_color[i : i + 2], 16) for i in (0, 2, 4))
    base = Image.new('RGBA', img.size, bg + (255,))
    base.paste(img, (0, 0), img)
    return base.convert('RGBA')


def normalize_image(
    input_path: Path,
    output_path: Path | None = None,
    *,
    bg_mode: str = 'auto',
    bake_bg: str | None = None,
    padding_px: int = PADDING_PX,
) -> None:
    output_path = output_path or input_path
    img = Image.open(input_path).convert('RGBA')
    data = np.array(img)
    data = remove_border_background(data, bg_mode)
    img = trim_and_resize(data, padding_px=padding_px)

    if bake_bg:
        img = bake_background(img, bake_bg)

    img.save(output_path, 'PNG', optimize=True)
    print(
        f'Normalized {input_path.name} -> {img.size[0]}x{img.size[1]} '
        f'(bg={bg_mode}, bake={bake_bg or "none"})'
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Normalize team logo PNGs')
    parser.add_argument(
        'files',
        nargs='*',
        help='PNG paths (default: public/team-logos/team-*.png)',
    )
    parser.add_argument(
        '--bg',
        choices=('auto', 'black', 'white'),
        default='auto',
        help='Background flood-fill mode (default: auto from corners)',
    )
    parser.add_argument(
        '--padding',
        type=int,
        default=PADDING_PX,
        help='Pixel padding around trimmed crest (default: 0)',
    )
    parser.add_argument(
        '--bake-bg',
        default='',
        help='Composite onto opaque background hex color (default: none - transparent outside crest)',
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    root = Path(__file__).resolve().parent.parent / 'public' / 'team-logos'
    bake = args.bake_bg.strip() or None

    if args.files:
        files = [Path(f) for f in args.files]
    else:
        files = sorted(root.glob('team-*.png'))

    if not files:
        print('No team-*.png files found.')
        sys.exit(1)

    for path in files:
        if not path.is_file():
            print(f'Skip missing file: {path}')
            continue
        normalize_image(path, bg_mode=args.bg, bake_bg=bake, padding_px=args.padding)


if __name__ == '__main__':
    main()
