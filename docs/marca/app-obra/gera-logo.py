"""Gera o logo do APP OBRA (SVG com letras em contorno). Uso: python3 -I gera.py <pasta_saida> <versões...>"""
import sys, os
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

F = os.environ.get("FONTES", "fontes")  # Playfair-Black.ttf e Montserrat-Bold.ttf (Google Fonts)
MARINHO, ROYAL, OURO, OURO_E, CREME = "#0A1F4D", "#1E40AF", "#E5B339", "#B8862B", "#F7EFDC"

class Fonte:
    def __init__(self, arq):
        self.f = TTFont(os.path.join(F, arq)); self.gs = self.f.getGlyphSet()
        self.cmap = self.f.getBestCmap(); self.upm = self.f["head"].unitsPerEm
        self.hmtx = self.f["hmtx"]
    def largura(self, txt, tam, trk=0):
        s = tam / self.upm
        return sum(self.hmtx[self.cmap[ord(c)]][0] * s + trk for c in txt) - trk
    def caminho(self, txt, tam, x, y, trk=0):
        s = tam / self.upm; d = []
        for c in txt:
            g = self.cmap[ord(c)]
            pen = SVGPathPen(self.gs)
            self.gs[g].draw(TransformPen(pen, (s, 0, 0, -s, x, y)))
            d.append(pen.getCommands())
            x += self.hmtx[g][0] * s + trk
        return " ".join(d)

PF, MS = Fonte("Playfair-Black.ttf"), Fonte("Montserrat-Bold.ttf")

DEFS = f'''<defs>
<linearGradient id="azul" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{ROYAL}"/><stop offset="1" stop-color="{MARINHO}"/></linearGradient>
<radialGradient id="azul3d" cx="0.36" cy="0.28" r="0.85"><stop offset="0" stop-color="{ROYAL}"/><stop offset="0.55" stop-color="#14307E"/><stop offset="1" stop-color="{MARINHO}"/></radialGradient>
<linearGradient id="crista" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="{MARINHO}"/><stop offset="0.45" stop-color="{ROYAL}"/><stop offset="1" stop-color="{MARINHO}"/></linearGradient>
<linearGradient id="ouro" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{OURO}"/><stop offset="1" stop-color="{OURO_E}"/></linearGradient>
<linearGradient id="ouro3d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{OURO_E}"/><stop offset="0.28" stop-color="{OURO}"/><stop offset="0.45" stop-color="{CREME}"/><stop offset="0.62" stop-color="{OURO}"/><stop offset="1" stop-color="{OURO_E}"/></linearGradient>
<linearGradient id="aba" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{ROYAL}"/><stop offset="0.5" stop-color="{MARINHO}"/><stop offset="1" stop-color="#06143A"/></linearGradient>
<radialGradient id="bola" cx="0.35" cy="0.3" r="0.75"><stop offset="0" stop-color="{CREME}"/><stop offset="0.35" stop-color="{OURO}"/><stop offset="1" stop-color="{OURO_E}"/></radialGradient>
<radialGradient id="sombra" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="{MARINHO}" stop-opacity="0.35"/><stop offset="1" stop-color="{MARINHO}" stop-opacity="0"/></radialGradient>
<linearGradient id="reflexo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{CREME}" stop-opacity="0.55"/><stop offset="1" stop-color="{CREME}" stop-opacity="0"/></linearGradient>
</defs>'''

def estrela(cx, cy, r):
    k = r * 0.28
    return f'<path d="M{cx} {cy-r} Q{cx+k} {cy-k} {cx+r} {cy} Q{cx+k} {cy+k} {cx} {cy+r} Q{cx-k} {cy+k} {cx-r} {cy} Q{cx-k} {cy-k} {cx} {cy-r}Z" fill="{OURO}"/>'

# Símbolo em 300 x 250, com volume (3D): capacete de obra azul brilhante com contorno e
# aba dourados, crista central, emblema creme com prédio dourado, reflexos e sombra;
# coroa DNM dourada metálica assentada no topo.
SIMBOLO = f'''<g>
<ellipse cx="150" cy="232" rx="128" ry="12" fill="url(#sombra)"/>
<path d="M42 196 C38 118 92 74 150 74 C208 74 262 118 258 196 Z" fill="url(#azul3d)" stroke="url(#ouro)" stroke-width="6" stroke-linejoin="round"/>
<path d="M140 75 Q150 73 160 75 Q170 130 172 196 L128 196 Q130 130 140 75 Z" fill="url(#crista)" stroke="url(#ouro)" stroke-width="2.5" stroke-linejoin="round"/>
<path d="M66 150 C70 112 100 88 128 82 C104 100 88 124 84 158 Z" fill="url(#reflexo)"/>
<ellipse cx="104" cy="104" rx="9" ry="5" transform="rotate(-38 104 104)" fill="{CREME}" opacity="0.75"/>
<path d="M150 118 L176 128 L176 156 Q176 174 150 184 Q124 174 124 156 L124 128 Z" fill="{CREME}" stroke="url(#ouro)" stroke-width="3"/>
<path d="M139 172 L139 140 L150 133 L161 140 L161 172 Z" fill="url(#ouro)"/>
<rect x="143" y="145" width="4" height="5" fill="{CREME}"/><rect x="153" y="145" width="4" height="5" fill="{CREME}"/>
<rect x="143" y="156" width="4" height="5" fill="{CREME}"/><rect x="153" y="156" width="4" height="5" fill="{CREME}"/>
<path d="M14 204 Q14 190 34 190 L266 190 Q286 190 286 204 Q286 222 150 226 Q14 222 14 204 Z" fill="url(#aba)" stroke="url(#ouro)" stroke-width="6" stroke-linejoin="round"/>
<path d="M34 197 L266 197" stroke="{CREME}" stroke-opacity="0.35" stroke-width="3" stroke-linecap="round"/>
{estrela(224, 120, 12)}{estrela(64, 182, 7)}{estrela(238, 150, 5)}
<path d="M98 62 L98 30 L116 50 L125 20 L138 47 L150 8 L162 47 L175 20 L184 50 L202 30 L202 62 Z" fill="url(#ouro3d)" stroke="{OURO_E}" stroke-width="2" stroke-linejoin="round"/>
<path d="M150 14 L156 46 L150 52 Z" fill="{CREME}" opacity="0.45"/>
<circle cx="98" cy="28" r="6.5" fill="url(#bola)" stroke="{OURO_E}" stroke-width="1.2"/>
<circle cx="125" cy="18" r="6.5" fill="url(#bola)" stroke="{OURO_E}" stroke-width="1.2"/>
<circle cx="150" cy="8" r="8" fill="url(#bola)" stroke="{OURO_E}" stroke-width="1.2"/>
<circle cx="175" cy="18" r="6.5" fill="url(#bola)" stroke="{OURO_E}" stroke-width="1.2"/>
<circle cx="202" cy="28" r="6.5" fill="url(#bola)" stroke="{OURO_E}" stroke-width="1.2"/>
<rect x="92" y="60" width="116" height="17" rx="6" fill="url(#ouro3d)" stroke="{OURO_E}" stroke-width="2"/>
<rect x="100" y="64" width="100" height="2.5" rx="1.2" fill="{CREME}" opacity="0.8"/>
<rect x="100" y="71" width="100" height="2" rx="1" fill="{OURO_E}" opacity="0.8"/>
</g>'''
SIM_W, SIM_H, SIM_Y0 = 300, 246, -2  # topo da bolinha central em y=0.5

def nome(x, y, escuro, centro=False):
    """'APP OBRA' + 'BY DNM&LTDA' com filetes. Devolve (svg, largura, altura). (x,y) = canto superior esquerdo."""
    T1, T2, TRK = 116, 30, 9
    TRK1 = 5
    w1 = PF.largura("APP OBRA", T1, TRK1); w2 = MS.largura("BY DNM&LTDA", T2, TRK)
    fil, gap = 46, 16
    wl = max(w1, w2 + 2 * (fil + gap)); h = 190
    cor1 = CREME if escuro else MARINHO; cor2 = OURO if escuro else OURO_E
    x1 = x + (wl - w1) / 2 if centro else x
    lx = x + (wl - (w2 + 2 * (fil + gap))) / 2 if centro else x + (w1 - (w2 + 2 * (fil + gap))) / 2
    b1 = y + 112; b2 = y + 172
    s = f'<path d="{PF.caminho("APP OBRA", T1, x1, b1, TRK1)}" fill="{cor1}"/>'
    s += f'<path d="{MS.caminho("BY DNM&LTDA", T2, lx + fil + gap, b2, TRK)}" fill="{cor2}"/>'
    ly = b2 - 11
    for xa in (lx, lx + fil + gap + w2 + gap):
        s += f'<rect x="{xa:.1f}" y="{ly-1.5:.1f}" width="{fil}" height="3" rx="1.5" fill="{cor2}"/>'
        cx = xa + (fil if xa == lx else 0)
        s += f'<path d="M{cx:.1f} {ly-5:.1f} l5 5 -5 5 -5 -5z" fill="{cor2}"/>'
    return s, max(wl, w1), h

def svg(w, h, corpo, fundo=None):
    bg = f'<rect width="{w:.0f}" height="{h:.0f}" fill="{fundo}"/>' if fundo else ""
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" width="{w:.0f}" height="{h:.0f}">{DEFS}{bg}{corpo}</svg>\n'

def horizontal(escuro):
    m = 40; esc = 0.78
    sw, sh = SIM_W * esc, SIM_H * esc
    t, tw, th = nome(m + sw + 36, 0, escuro)
    H = sh + 2 * m; ty = (H - th) / 2 + 8
    t, tw, th = nome(m + sw + 36, ty, escuro)
    W = m + sw + 36 + tw + m
    corpo = f'<g transform="translate({m},{m}) scale({esc})">{SIMBOLO}</g>{t}'
    return svg(W, H, corpo, MARINHO if escuro else None)

def vertical(escuro):
    m = 40; esc = 0.9
    sw, sh = SIM_W * esc, SIM_H * esc
    _, tw, th = nome(0, 0, escuro, True)
    W = max(sw, tw) + 2 * m
    t, _, _ = nome((W - tw) / 2, m + sh + 18, escuro, True)
    H = m + sh + 18 + th + m - 10
    corpo = f'<g transform="translate({(W-sw)/2},{m}) scale({esc})">{SIMBOLO}</g>{t}'
    return svg(W, H, corpo, MARINHO if escuro else None)

def simbolo():
    return svg(SIM_W, SIM_H, SIMBOLO)

def icone_cheio():
    """Ícone sem cantos (o celular recorta): símbolo menor, na área segura."""
    L = 512; esc = 0.95
    sw, sh = SIM_W * esc, SIM_H * esc
    return svg(L, L, f'<rect width="{L}" height="{L}" fill="{MARINHO}"/><g transform="translate({(L-sw)/2},{(L-sh)/2+6}) scale({esc})">{SIMBOLO}</g>')

def icone():
    L = 512; esc = 1.18
    sw, sh = SIM_W * esc, SIM_H * esc
    corpo = (f'<rect x="10" y="10" width="{L-20}" height="{L-20}" rx="100" fill="{MARINHO}" stroke="url(#ouro)" stroke-width="12"/>'
             f'<g transform="translate({(L-sw)/2},{(L-sh)/2+4}) scale({esc})">{SIMBOLO}</g>')
    return svg(L, L, corpo)

VERSOES = {
    "app-obra-horizontal-claro": lambda: horizontal(False),
    "app-obra-horizontal-escuro": lambda: horizontal(True),
    "app-obra-vertical-claro": lambda: vertical(False),
    "app-obra-vertical-escuro": lambda: vertical(True),
    "app-obra-icone": icone,
    "app-obra-simbolo": simbolo,
    "app-obra-icone-ajustavel": icone_cheio,
}
if __name__ == "__main__":
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    for n in sys.argv[2:] or VERSOES:
        open(os.path.join(out, n + ".svg"), "w").write(VERSOES[n]()); print(n)
