#!/usr/bin/env python3
"""Génère les icônes PNG pour le manifest PWA (FridgeStock)."""
import zlib, struct, math, os

# ── Palette ───────────────────────────────────────────────────────────────────
BG      = (11,  22,  40)   # #0b1628
OUTSIDE = ( 6,  13,  26)   # #060d1a
BLUE    = (59, 158, 255)   # #3b9eff
CYAN    = ( 0, 229, 255)   # #00e5ff

# ── Encodeur PNG RGB minimaliste ──────────────────────────────────────────────
def write_png(path, width, height, draw):
    sig = b'\x89PNG\r\n\x1a\n'
    def chunk(tag, data):
        crc = zlib.crc32(tag + data) & 0xffffffff
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', crc)
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0))
    raw  = bytearray()
    for y in range(height):
        raw.append(0)                           # filtre = None
        for x in range(width):
            raw.extend(draw(x, y))
    idat = chunk(b'IDAT', zlib.compress(bytes(raw), 9))
    iend = chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(sig + ihdr + idat + iend)

# ── SDF segment ───────────────────────────────────────────────────────────────
def sdf_seg(px, py, ax, ay, bx, by):
    """Distance signée du point (px,py) au segment (ax,ay)-(bx,by)."""
    abx, aby = bx - ax, by - ay
    l2 = abx*abx + aby*aby
    t  = max(0.0, min(1.0, ((px-ax)*abx + (py-ay)*aby) / l2)) if l2 else 0.0
    return math.hypot(px - ax - t*abx, py - ay - t*aby)

# ── Dessinateur ───────────────────────────────────────────────────────────────
def make_draw(size, maskable=False):
    cx = cy = size / 2
    half     = size / 2
    s        = 0.72 if maskable else 1.0   # facteur d'échelle snowflake
    cr       = 0.0  if maskable else size * 0.22   # rayon des coins
    arm_hw   = size * 0.025                         # demi-largeur bras
    arm_hl   = size * 0.345 * s                     # demi-longueur bras
    br_hw    = size * 0.015 * s                     # demi-largeur branche
    br_len   = size * 0.085 * s                     # longueur branche
    br_off   = size * 0.19  * s                     # position branche sur le bras
    aa       = 1.4                                  # largeur anti-aliasing

    # 3 directions de bras (60° d'écart) à partir de la verticale
    dirs = [
        (0.0,            1.0),
        ( math.sqrt(3)/2, 0.5),
        ( math.sqrt(3)/2,-0.5),
    ]

    def in_bg(x, y):
        if maskable:
            return True
        ax, ay = abs(x - cx), abs(y - cy)
        ex = max(0.0, ax - (half - cr))
        ey = max(0.0, ay - (half - cr))
        return math.hypot(ex, ey) <= cr

    def lerp_color(t):
        t = max(0.0, min(1.0, t))
        return (
            int(BLUE[0] + t*(CYAN[0]-BLUE[0])),
            int(BLUE[1] + t*(CYAN[1]-BLUE[1])),
            int(BLUE[2] + t*(CYAN[2]-BLUE[2])),
        )

    def draw(x, y):
        if not in_bg(x, y):
            return OUTSIDE

        px, py  = x - cx, y - cy
        d_center = math.hypot(px, py)
        min_d    = float('inf')

        for (dx, dy) in dirs:
            # Bras principal
            d = sdf_seg(px, py, -dx*arm_hl, -dy*arm_hl, dx*arm_hl, dy*arm_hl)
            d -= arm_hw
            min_d = min(min_d, d)

            # Branches symétriques sur chaque côté du bras
            for sign in (-1, 1):
                mx, my = sign*dx*br_off, sign*dy*br_off   # point sur le bras
                px2, py2 = -dy, dx                         # perpendiculaire
                for bs in (-1, 1):
                    d = sdf_seg(px, py,
                                mx, my,
                                mx + bs*px2*br_len,
                                my + bs*py2*br_len)
                    d -= br_hw
                    min_d = min(min_d, d)

        t = min(1.0, d_center / arm_hl)

        if min_d <= 0:
            return lerp_color(t)
        if min_d < aa:
            alpha = 1.0 - min_d / aa
            fc    = lerp_color(t)
            return (
                int(fc[0]*alpha + BG[0]*(1-alpha)),
                int(fc[1]*alpha + BG[1]*(1-alpha)),
                int(fc[2]*alpha + BG[2]*(1-alpha)),
            )
        return BG

    return draw

# ── Génération ────────────────────────────────────────────────────────────────
os.makedirs('icons', exist_ok=True)

for sz in (192, 512):
    p = f'icons/icon-{sz}.png'
    write_png(p, sz, sz, make_draw(sz, maskable=False))
    print(f'✓  {p}')

write_png('icons/icon-maskable.png', 512, 512, make_draw(512, maskable=True))
print('✓  icons/icon-maskable.png')
print('Done.')
