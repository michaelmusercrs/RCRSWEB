"""Generate simple, clean, color-coded inventory item tiles (square, dark theme)
for the warehouse/inventory portal. Each tile: item name + category icon + accent.
Deterministic and unique per item; regenerate anytime by re-running."""
import os, re
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join('public', 'uploads', 'inventory')
os.makedirs(OUT, exist_ok=True)
SZ = 800
FB = 'C:/Windows/Fonts/arialbd.ttf'
FBLK = 'C:/Windows/Fonts/ariblk.ttf'
FR = 'C:/Windows/Fonts/arial.ttf'

# category -> accent color + icon key
CAT = {
    'Fasteners':    ((59, 130, 246),  'nail'),      # blue
    'Underlayment': ((57, 255, 20),   'roll'),      # brand green
    'Ventilation':  ((34, 211, 238),  'vent'),      # cyan
    'Flashing':     ((245, 158, 11),  'boot'),      # amber
    'Sealants':     ((167, 139, 250), 'tube'),      # violet
}

def font(path, size):
    return ImageFont.truetype(path, size)

def bg(d):
    top, bot = (43, 43, 48), (20, 20, 22)
    for y in range(SZ):
        t = y / SZ
        c = tuple(round(top[i] + (bot[i] - top[i]) * t) for i in range(3))
        d.line([(0, y), (SZ, y)], fill=c)

def rounded(d, box, r, **kw):
    d.rounded_rectangle(box, radius=r, **kw)

def icon(d, key, color):
    cx, cy = SZ // 2, 330
    if key == 'nail':                                   # shaft + head
        rounded(d, [cx - 26, cy - 150, cx + 26, cy + 150], 14, fill=color)
        d.ellipse([cx - 78, cy - 175, cx + 78, cy - 120], fill=color)
        d.polygon([(cx - 26, cy + 150), (cx + 26, cy + 150), (cx, cy + 195)], fill=color)
    elif key == 'roll':                                 # cylinder/roll
        rounded(d, [cx - 120, cy - 150, cx + 120, cy + 150], 24, fill=color)
        d.ellipse([cx - 120, cy - 178, cx + 120, cy - 122], fill=(255, 255, 255))
        d.ellipse([cx - 46, cy - 162, cx + 46, cy - 138], fill=color)
        d.line([cx + 70, cy - 150, cx + 70, cy + 150], fill=(0, 0, 0), width=6)
    elif key == 'vent':                                 # ridge/roof peak + slots
        d.polygon([(cx - 175, cy + 70), (cx, cy - 120), (cx + 175, cy + 70)], fill=color)
        d.rectangle([cx - 200, cy + 70, cx + 200, cy + 120], fill=color)
        for i in range(-2, 3):
            d.rectangle([cx + i * 60 - 14, cy + 82, cx + i * 60 + 14, cy + 108], fill=(20, 20, 22))
    elif key == 'boot':                                 # pipe boot (cone on base)
        d.polygon([(cx - 34, cy - 150), (cx + 34, cy - 150), (cx + 96, cy + 70), (cx - 96, cy + 70)], fill=color)
        d.ellipse([cx - 34, cy - 168, cx + 34, cy - 132], fill=(20, 20, 22))
        rounded(d, [cx - 150, cy + 70, cx + 150, cy + 150], 16, fill=color)
    elif key == 'tube':                                 # caulk tube
        rounded(d, [cx - 70, cy - 120, cx + 70, cy + 170], 18, fill=color)
        d.polygon([(cx - 30, cy - 120), (cx + 30, cy - 120), (cx + 12, cy - 210), (cx - 12, cy - 210)], fill=color)
        d.rectangle([cx - 70, cy - 60, cx + 70, cy - 40], fill=(20, 20, 22))

def wrap(d, text, fnt, maxw):
    words, lines, cur = text.split(), [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if d.textlength(t, font=fnt) <= maxw:
            cur = t
        else:
            if cur: lines.append(cur)
            cur = w
    if cur: lines.append(cur)
    return lines

def tile(name, category, path):
    color, ikey = CAT[category]
    img = Image.new('RGB', (SZ, SZ))
    d = ImageDraw.Draw(img)
    bg(d)
    # header mark
    d.rectangle([56, 56, 82, 82], fill=(57, 255, 20))
    d.text((96, 58), 'RCRS  INVENTORY', font=font(FB, 26), fill=(150, 150, 155))
    # accent bottom bar
    d.rectangle([0, SZ - 14, SZ, SZ], fill=color)
    icon(d, ikey, color)
    # name (wrapped, centered)
    nf = font(FBLK, 60)
    lines = wrap(d, name, nf, SZ - 120)
    if len(lines) > 2:  # shrink if long
        nf = font(FBLK, 48); lines = wrap(d, name, nf, SZ - 100)
    y = 560
    for ln in lines:
        w = d.textlength(ln, font=nf)
        d.text(((SZ - w) / 2, y), ln, font=nf, fill=(255, 255, 255))
        y += nf.size + 8
    # category pill
    cf = font(FB, 28)
    ct = category.upper()
    cw = d.textlength(ct, font=cf)
    px, py = (SZ - cw) / 2 - 24, 700
    rounded(d, [px, py, px + cw + 48, py + 50], 25, fill=color)
    d.text((px + 24, py + 10), ct, font=cf, fill=(15, 15, 17))
    img.save(path, 'JPEG', quality=88, optimize=True, progressive=True)

s = open('lib/inventoryData.ts', encoding='utf-8').read()
items = re.findall(r"productName:\s*'([^']+)'[\s\S]*?imageUrl:\s*'([^']+)'[\s\S]*?category:\s*'([^']+)'", s)
for name, url, cat in items:
    path = os.path.join('public', url.lstrip('/'))
    tile(name, cat, path)
    print(f'  {os.path.basename(path):26s} <- {name} [{cat}]')
print(f'Generated {len(items)} inventory tiles.')
