"""Builds every FitMate logo image from one design (the "Activity Ring" mark).

Run:  python3 scripts/make-logo.py   (needs rsvg-convert)
Writes PNGs into assets/ and assets/splash/.
"""
import os, subprocess, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, '..', 'assets')

DEFS = """
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#22105E"/><stop offset="0.55" stop-color="#4B1FD6"/><stop offset="1" stop-color="#1A63FF"/>
  </linearGradient>
  <radialGradient id="glow" cx="0.72" cy="0.22" r="0.7">
    <stop offset="0" stop-color="#A88BFF" stop-opacity="0.8"/><stop offset="1" stop-color="#A88BFF" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="fig" gradientUnits="userSpaceOnUse" x1="330" y1="230" x2="700" y2="790">
    <stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#CFF4FF"/>
  </linearGradient>
  <linearGradient id="ring" gradientUnits="userSpaceOnUse" x1="170" y1="860" x2="860" y2="170">
    <stop offset="0" stop-color="#7FF3FF" stop-opacity="0.12"/><stop offset="1" stop-color="#7FF3FF"/>
  </linearGradient>
</defs>"""

def mark(mono=False):
    """The ring + runner, drawn in a 1024 box centred on 512,512."""
    ring_col = '#FFFFFF' if mono else 'url(#ring)'
    fig = '#FFFFFF' if mono else 'url(#fig)'
    track = '' if mono else '<circle cx="512" cy="512" r="330" fill="none" stroke="#FFFFFF" stroke-opacity="0.12" stroke-width="56"/>'
    return f"""{track}
<path d="M278 745 A330 330 0 1 1 798 677" fill="none" stroke="{ring_col}" stroke-width="56" stroke-linecap="round"/>
<circle cx="798" cy="677" r="42" fill="#FFFFFF"/>
<g transform="translate(512 512) scale(0.97) translate(-510 -530)">
  <g fill="none" stroke="{fig}" stroke-width="60" stroke-linecap="round" stroke-linejoin="round">
    <path d="M548 410 L478 578"/>
    <path d="M540 435 L622 495 L690 450"/>
    <path d="M530 445 L445 480 L410 555"/>
    <path d="M478 578 L590 635 L566 755"/>
    <path d="M478 578 L425 690 L330 700"/>
  </g>
  <circle cx="585" cy="330" r="54" fill="#FFFFFF"/>
</g>"""

def svg(body, size=1024, defs=True):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 1024 1024">{DEFS if defs else ""}{body}</svg>'

def scaled(body, s):
    return f'<g transform="translate(512 512) scale({s}) translate(-512 -512)">{body}</g>'

BG = '<rect width="1024" height="1024" fill="url(#bg)"/><rect width="1024" height="1024" fill="url(#glow)"/>'

def render(svg_text, out, px):
    with tempfile.NamedTemporaryFile('w', suffix='.svg', delete=False) as f:
        f.write(svg_text)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    subprocess.run(['rsvg-convert', '-w', str(px), '-h', str(px), f.name, '-o', out], check=True)
    os.unlink(f.name)

if __name__ == '__main__':
    a = lambda *p: os.path.join(ASSETS, *p)
    render(svg(BG + mark()), a('icon.png'), 1024)
    render(svg(BG), a('android-icon-background.png'), 1024)
    # Adaptive icons: keep the mark inside the 66/108 safe circle.
    render(svg(scaled(mark(), 0.82)), a('android-icon-foreground.png'), 1024)
    render(svg(scaled(mark(mono=True), 0.82)), a('android-icon-monochrome.png'), 1024)
    render(svg(BG + mark()), a('favicon.png'), 48)
    # Opening screen. Android 12+ shows the icon inside a circle 2/3 of the image.
    render(svg(scaled(mark(), 0.92)), a('splash', 'splash-icon-android12.png'), 1152)
    # Android 8-11: the mark centred on the dark background (640px = 160dp at xxxhdpi).
    render(svg(mark()), a('splash', 'splash-logo.png'), 640)
    if os.path.exists(a('splash-icon.png')):
        os.remove(a('splash-icon.png'))
    print('logo images written')
