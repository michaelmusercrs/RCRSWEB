"""Perceptual near-duplicate image scanner (dHash).

Catches images that are VISUALLY near-identical even when their bytes differ
(e.g. the same stock photo downloaded at different sizes/quality). Byte-identical
duplicates are caught by scan-served-image-dupes.mjs; this catches the rest.

Usage:
  python scripts/scan-perceptual-dupes.py           # served images (blog + city/service)
  python scripts/scan-perceptual-dupes.py --all      # every image in public/uploads
"""
import os, re, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(ROOT, 'public')
THRESHOLD = 8  # Hamming distance <= this => visually near-identical


def dhash(path, size=8):
    try:
        img = Image.open(path).convert('L').resize((size + 1, size), Image.LANCZOS)
    except Exception:
        return None
    bits = 0
    idx = 0
    px = img.load()
    for y in range(size):
        for x in range(size):
            bits |= (1 if px[x, y] > px[x + 1, y] else 0) << idx
            idx += 1
    return bits


def ham(a, b):
    return bin(a ^ b).count('1')


def served_items():
    idx = open(os.path.join(ROOT, 'lib/blogPostIndex.ts'), encoding='utf-8').read()
    svc = open(os.path.join(ROOT, 'lib/servicesData.ts'), encoding='utf-8').read()
    items = []
    for src, kind in [(idx, 'blog'), (svc, 'svc')]:
        for m in re.finditer(r"slug:\s*['\"]([a-z0-9-]+)['\"][\s\S]{0,600}?image:\s*['\"]([^'\"]+)['\"]", src):
            slug, img = m.group(1), m.group(2)
            if img.startswith('/uploads'):
                items.append((f'{kind}:{slug}', img))
    return items


def all_items():
    up = os.path.join(PUB, 'uploads')
    out = []
    for f in sorted(os.listdir(up)):
        if f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')):
            out.append((f, '/uploads/' + f))
    return out


mode_all = '--all' in sys.argv
items = all_items() if mode_all else served_items()

hashes = []
for label, ref in items:
    p = os.path.join(PUB, ref.lstrip('/'))
    h = dhash(p) if os.path.exists(p) else None
    if h is not None:
        hashes.append((label, ref, h))

# union-find grouping by near-duplicate distance
n = len(hashes)
parent = list(range(n))
def find(i):
    while parent[i] != i:
        parent[i] = parent[parent[i]]
        i = parent[i]
    return i
def union(i, j):
    parent[find(i)] = find(j)

for i in range(n):
    for j in range(i + 1, n):
        if ham(hashes[i][2], hashes[j][2]) <= THRESHOLD:
            union(i, j)

groups = {}
for i in range(n):
    groups.setdefault(find(i), []).append(hashes[i])
near = [g for g in groups.values() if len(g) > 1]
near.sort(key=lambda g: -len(g))

print(f"\n===== PERCEPTUAL NEAR-DUPLICATE SCAN ({'all uploads' if mode_all else 'served images'}) =====")
print(f"Compared {n} images (dHash, Hamming <= {THRESHOLD}).")
print(f"Near-duplicate groups: {len(near)}\n")
affected = 0
for g in near:
    affected += len(g)
    # distinct source files in this group (byte-identical share a file; we care about distinct refs)
    print(f"[{len(g)} images visually near-identical]")
    for label, ref, h in g:
        print(f"   {label:52s} {ref}")
    print()
print(f"Pages/files in a near-dupe group: {affected}")
if not mode_all:
    print("\n(These are on real public pages. Byte-identical ones are already handled by scan:images.)")
