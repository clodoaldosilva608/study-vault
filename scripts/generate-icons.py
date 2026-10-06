"""Generate PWA icons (192, 512, maskable, apple-touch) for Study Vault."""
from PIL import Image, ImageDraw
import os

OUT_DIR = '/home/z/my-project/public/icons'
os.makedirs(OUT_DIR, exist_ok=True)

BG = (10, 11, 13)
FG = (16, 185, 129)


def draw_icon(size: int, maskable: bool = False) -> Image.Image:
    img = Image.new('RGB', (size, size), BG)
    d = ImageDraw.Draw(img)
    pad = int(size * 0.1) if maskable else 0
    cx, cy = size // 2, size // 2
    rect_size = int(size * (0.7 if maskable else 0.78))
    box = (cx - rect_size // 2 + pad // 2, cy - rect_size // 2 + pad // 2,
           cx + rect_size // 2 - pad // 2, cy + rect_size // 2 - pad // 2)
    d.rounded_rectangle(box, radius=int(size * 0.18), fill=(20, 24, 28))
    v_top_y = cy - int(size * 0.18)
    v_bot_y = cy + int(size * 0.18)
    v_half_w = int(size * 0.13)
    v_thickness = max(2, int(size * 0.05))
    d.line([(cx - v_half_w, v_top_y), (cx, v_bot_y)], fill=FG, width=v_thickness)
    d.line([(cx, v_bot_y), (cx + v_half_w, v_top_y)], fill=FG, width=v_thickness)
    d.ellipse([cx - v_thickness // 2 - 1, v_bot_y - 2, cx + v_thickness // 2 + 1, v_bot_y + 2], fill=FG)
    return img


for size in [192, 512]:
    img = draw_icon(size)
    img.save(os.path.join(OUT_DIR, f'icon-{size}.png'), 'PNG', optimize=True)

draw_icon(512, maskable=True).save(os.path.join(OUT_DIR, 'icon-maskable-512.png'), 'PNG', optimize=True)
draw_icon(180).save('/home/z/my-project/public/icons/apple-touch-icon.png', 'PNG', optimize=True)

print('Icons generated:', sorted(os.listdir(OUT_DIR)))
