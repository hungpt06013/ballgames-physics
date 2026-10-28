import math, os, sys
from PIL import Image, ImageDraw
S = 1024
INK = (29, 29, 31, 255)
def icon(size):
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    pad = 40
    d.rounded_rectangle([pad, pad, S - pad, S - pad], radius=210, fill=(92, 192, 79, 255), outline=INK, width=34)
    # clip layer for contents
    layer = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    l = ImageDraw.Draw(layer)
    # sky band
    # ball top-left
    cx, cy, r = 360, 360, 250
    l.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 255, 255, 255), outline=INK, width=34)
    def pent(x, y, rr, rot):
        pts = [(x + rr * math.cos(rot + k * 2 * math.pi / 5 - math.pi / 2), y + rr * math.sin(rot + k * 2 * math.pi / 5 - math.pi / 2)) for k in range(5)]
        l.polygon(pts, fill=INK)
    pent(cx, cy, 92, 0)
    for k in range(5):
        a = k * 2 * math.pi / 5 - math.pi / 2
        pent(cx + math.cos(a) * 235, cy + math.sin(a) * 235, 80, math.pi / 5)
    # re-draw ball rim over the outer pentagons, and cut what lies outside the ball
    mask = Image.new('L', (S, S), 0); ImageDraw.Draw(mask).ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
    ball = Image.new('RGBA', (S, S), (0, 0, 0, 0)); ball.paste(layer, (0, 0), mask)
    bd = ImageDraw.Draw(ball); bd.ellipse([cx - r, cy - r, cx + r, cy + r], outline=INK, width=34)
    # motion lines
    for i, (x1, y1, x2, y2) in enumerate([(640, 210, 720, 150), (690, 300, 790, 270), (660, 400, 760, 410)]):
        bd.line([x1, y1, x2, y2], fill=INK, width=30)
    # impact burst between ball and shoe
    for a in range(5):
        ang = -0.2 + a * 0.55
        bd.line([600 + 40 * math.cos(ang), 540 + 40 * math.sin(ang) * -1, 600 + 95 * math.cos(ang), 540 - 95 * math.sin(ang)], fill=(255, 255, 255, 255), width=24)
    # leg: red shorts + skin leg + black shoe, kicking up-left
    leg = Image.new('RGBA', (S, S), (0, 0, 0, 0)); g = ImageDraw.Draw(leg)
    hx, hy = 860, 900; fx, fy = 560, 640
    g.line([hx, hy, fx, fy], fill=INK, width=150)
    g.line([hx, hy, fx, fy], fill=(248, 226, 192, 255), width=96)
    sx, sy = fx + (hx - fx) * 0.18, fy + (hy - fy) * 0.18
    g.line([fx, fy, sx, sy], fill=(255, 255, 255, 255), width=96)
    g.ellipse([fx - 95, fy - 70, fx + 60, fy + 75], fill=INK)
    g.ellipse([hx - 150, hy - 150, hx + 150, hy + 150], fill=(239, 91, 91, 255), outline=INK, width=34)
    content = Image.alpha_composite(ball, leg)
    clip = Image.new('L', (S, S), 0); ImageDraw.Draw(clip).rounded_rectangle([pad + 17, pad + 17, S - pad - 17, S - pad - 17], radius=195, fill=255)
    im.paste(content, (0, 0), Image.composite(content.split()[3], Image.new('L', (S, S), 0), clip))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([pad, pad, S - pad, S - pad], radius=210, outline=INK, width=34)
    return im.resize((size, size), Image.LANCZOS)

out = sys.argv[1]
for name, px in [('mdpi', 48), ('hdpi', 72), ('xhdpi', 96), ('xxhdpi', 144), ('xxxhdpi', 192)]:
    dd = os.path.join(out, 'mipmap-' + name); os.makedirs(dd, exist_ok=True)
    icon(px).save(os.path.join(dd, 'ic_launcher.png'))
icon(512).save(os.path.join(out, '..', 'icon512.png'))
print('ok')
