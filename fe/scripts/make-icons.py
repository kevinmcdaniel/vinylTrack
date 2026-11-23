"""Draw the placeholder app icon (#9): a record on the classic theme's primary
blue. Regenerate with `python3 fe/scripts/make-icons.py` after changing it.

Everything sits inside the central 80% circle, so the same art works as a
maskable icon (Android crops to a circle or squircle) and as iOS's square
home-screen icon (iOS rounds the corners itself).
"""
from pathlib import Path
from PIL import Image, ImageDraw

PRIMARY = (0x1A, 0x60, 0xEB)  # themes.ts classic.primary
DISC = (0x14, 0x20, 0x31)     # classic.text
GROOVE = (0x2B, 0x3A, 0x50)
LABEL = (0xFF, 0xFF, 0xFF)

FE = Path(__file__).resolve().parent.parent
TARGETS = {
    FE / 'public/icons/icon-192.png': 192,
    FE / 'public/icons/icon-512.png': 512,
    FE / 'public/icons/maskable-512.png': 512,
    FE / 'src/app/apple-icon.png': 180,
    FE / 'src/app/icon.png': 32,
}


def draw(size: int) -> Image.Image:
    scale = 4  # draw big, then shrink, for smooth edges
    n = size * scale
    img = Image.new('RGB', (n, n), PRIMARY)
    d = ImageDraw.Draw(img)
    c = n / 2

    def circle(r: float, fill=None, outline=None, width=0):
        d.ellipse([c - r * n, c - r * n, c + r * n, c + r * n], fill=fill, outline=outline, width=width)

    circle(0.36, fill=DISC)
    for r in (0.31, 0.26, 0.21):
        circle(r, outline=GROOVE, width=max(1, int(0.006 * n)))
    circle(0.12, fill=LABEL)
    circle(0.025, fill=PRIMARY)
    return img.resize((size, size), Image.LANCZOS)


for path, size in TARGETS.items():
    path.parent.mkdir(parents=True, exist_ok=True)
    draw(size).save(path, optimize=True)
    print(f'{path.relative_to(FE)}  {size}x{size}')
