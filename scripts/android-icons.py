# Regenerates the Android launcher icons and splash images from icon-512.png.
# Usage: python3 scripts/android-icons.py   (needs Pillow)
import glob, os
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(__file__), '..')
RES = os.path.join(ROOT, 'android/app/src/main/res')
BG = (20, 16, 15)
src = Image.open(os.path.join(ROOT, 'icon-512.png')).convert('RGBA')

for d, px in {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}.items():
    folder = os.path.join(RES, 'mipmap-' + d)
    icon = src.resize((px, px), Image.LANCZOS)
    icon.save(os.path.join(folder, 'ic_launcher.png'))
    mask = Image.new('L', (px * 4, px * 4), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, px * 4 - 1, px * 4 - 1), fill=255)
    rnd = Image.new('RGBA', (px, px), (0, 0, 0, 0))
    rnd.paste(icon, (0, 0), mask.resize((px, px), Image.LANCZOS))
    rnd.save(os.path.join(folder, 'ic_launcher_round.png'))
    fg = round(px * 108 / 48)  # adaptive icon layer is 108dp
    src.resize((fg, fg), Image.LANCZOS).save(os.path.join(folder, 'ic_launcher_foreground.png'))

for path in glob.glob(os.path.join(RES, 'drawable*', 'splash.png')):
    w, h = Image.open(path).size
    s = round(min(w, h) * 0.42)
    canvas = Image.new('RGBA', (w, h), BG + (255,))
    canvas.alpha_composite(src.resize((s, s), Image.LANCZOS), ((w - s) // 2, (h - s) // 2))
    canvas.convert('RGB').save(path)
print('icons and splash updated')
