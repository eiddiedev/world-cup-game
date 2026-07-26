#!/usr/bin/env python3
"""Kit pattern rendering system for 16 playable teams + 32 opponents.

Supports pattern types: solid, v_stripes, h_bands, cross, trim, sash
Each playable team has a detailed real-world-inspired configuration.
"""

from __future__ import annotations

import numpy as np
from PIL import Image

OUTLINE_COLOR = (18, 23, 25, 255)

# ---------------------------------------------------------------------------
# Detailed pattern configs for 16 playable teams (home kits)
# ---------------------------------------------------------------------------
KIT_PATTERNS: dict[str, dict] = {
    'france': {
        'type': 'trim',
        'base': '#1F4AA8',
        'trim_color': '#FFFFFF',
        'trim_width': 2,  # collar + sleeve edge
    },
    'brazil': {
        'type': 'trim',
        'base': '#F5D742',
        'trim_color': '#009739',
        'trim_width': 2,
    },
    'argentina': {
        'type': 'v_stripes',
        'colors': ['#75AADB', '#FFFFFF'],
        'stripe_width': 4,
    },
    'portugal': {
        'type': 'trim',
        'base': '#B51D2A',
        'trim_color': '#006600',
        'trim_width': 2,
    },
    'germany': {
        'type': 'h_bands',
        'base': '#FFFFFF',
        'bands': [
            {'color': '#000000', 'y_start': 0.30, 'y_end': 0.40},
            {'color': '#DD0000', 'y_start': 0.40, 'y_end': 0.50},
            {'color': '#FFCC00', 'y_start': 0.50, 'y_end': 0.60},
        ],
    },
    'japan': {
        'type': 'trim',
        'base': '#174FBC',
        'trim_color': '#FFFFFF',
        'trim_width': 1,
    },
    'norway': {
        'type': 'cross',
        'colors': ['#C8313D', '#002868', '#FFFFFF'],
    },
    'morocco': {
        'type': 'trim',
        'base': '#C1272D',
        'trim_color': '#006233',
        'trim_width': 2,
    },
    'newzealand': {
        'type': 'trim',
        'base': '#FFFFFF',
        'trim_color': '#000000',
        'trim_width': 2,
    },
    'curacao': {
        'type': 'h_bands',
        'base': '#003DA5',
        'bands': [
            {'color': '#FCD116', 'y_start': 0.35, 'y_end': 0.50},
        ],
    },
    'spain': {
        'type': 'h_bands',
        'base': '#C60B1E',
        'bands': [
            {'color': '#F5D742', 'y_start': 0.30, 'y_end': 0.45},
        ],
    },
    'england': {
        'type': 'trim',
        'base': '#FFFFFF',
        'trim_color': '#CF081F',
        'trim_width': 2,
    },
    'colombia': {
        'type': 'sash',
        'base': '#FCD116',
        'sash_color': '#003893',
        'sash_width': 4,
    },
    'usa': {
        'type': 'trim',
        'base': '#FFFFFF',
        'trim_color': '#3C3B6E',
        'trim_width': 2,
    },
    'canada': {
        'type': 'trim',
        'base': '#D52B1E',
        'trim_color': '#FFFFFF',
        'trim_width': 2,
    },
    'mexico': {
        'type': 'trim',
        'base': '#006847',
        'trim_color': '#FFFFFF',
        'trim_width': 1,
    },
    'capeverde': {
        'type': 'h_bands',
        'base': '#003893',
        'bands': [
            {'color': '#CF202A', 'y_start': 0.55, 'y_end': 0.65},
            {'color': '#FCD116', 'y_start': 0.65, 'y_end': 0.72},
        ],
    },
}

# ---------------------------------------------------------------------------
# Full kit colors for ALL 48 teams (for non-pattern parts + opponents)
# ---------------------------------------------------------------------------
TEAM_KIT_COLORS: dict[str, dict[str, str]] = {
    'france':     {'shirt': '#1F4AA8', 'shorts': '#F4F0E8', 'socks': '#B34235', 'shoes': '#161412'},
    'brazil':     {'shirt': '#F5D742', 'shorts': '#174FBC', 'socks': '#F4F0E8', 'shoes': '#161412'},
    'argentina':  {'shirt': '#75AADB', 'shorts': '#F4F0E8', 'socks': '#75AADB', 'shoes': '#161412'},
    'portugal':   {'shirt': '#B51D2A', 'shorts': '#174F3A', 'socks': '#B51D2A', 'shoes': '#161412'},
    'germany':    {'shirt': '#F4F0E8', 'shorts': '#111111', 'socks': '#F4F0E8', 'shoes': '#161412'},
    'japan':      {'shirt': '#174FBC', 'shorts': '#174FBC', 'socks': '#174FBC', 'shoes': '#161412'},
    'norway':     {'shirt': '#C8313D', 'shorts': '#263B78', 'socks': '#C8313D', 'shoes': '#161412'},
    'morocco':    {'shirt': '#C1272D', 'shorts': '#C1272D', 'socks': '#C1272D', 'shoes': '#161412'},
    'newzealand': {'shirt': '#F4F0E8', 'shorts': '#F4F0E8', 'socks': '#F4F0E8', 'shoes': '#161412'},
    'curacao':    {'shirt': '#003DA5', 'shorts': '#003DA5', 'socks': '#003DA5', 'shoes': '#161412'},
    'spain':      {'shirt': '#C60B1E', 'shorts': '#174FBC', 'socks': '#C60B1E', 'shoes': '#161412'},
    'england':    {'shirt': '#F4F0E8', 'shorts': '#263B78', 'socks': '#F4F0E8', 'shoes': '#161412'},
    'colombia':   {'shirt': '#FCD116', 'shorts': '#003893', 'socks': '#C8313D', 'shoes': '#161412'},
    'usa':        {'shirt': '#F4F0E8', 'shorts': '#3C3B6E', 'socks': '#B34235', 'shoes': '#161412'},
    'canada':     {'shirt': '#D52B1E', 'shorts': '#F4F0E8', 'socks': '#D52B1E', 'shoes': '#161412'},
    'mexico':     {'shirt': '#006847', 'shorts': '#F4F0E8', 'socks': '#006847', 'shoes': '#161412'},
    'capeverde':  {'shirt': '#003893', 'shorts': '#F4F0E8', 'socks': '#003893', 'shoes': '#161412'},
    # 32 opponents
    'southafrica':  {'shirt': '#FFB612', 'shorts': '#007A4D', 'socks': '#FFB612', 'shoes': '#161412'},
    'southkorea':   {'shirt': '#C60C30', 'shorts': '#C60C30', 'socks': '#C60C30', 'shoes': '#161412'},
    'czech':        {'shirt': '#D7141A', 'shorts': '#D7141A', 'socks': '#D7141A', 'shoes': '#161412'},
    'bosnia':       {'shirt': '#002395', 'shorts': '#002395', 'socks': '#002395', 'shoes': '#161412'},
    'qatar':        {'shirt': '#8A1538', 'shorts': '#8A1538', 'socks': '#8A1538', 'shoes': '#161412'},
    'switzerland':  {'shirt': '#FF0000', 'shorts': '#FF0000', 'socks': '#FF0000', 'shoes': '#161412'},
    'haiti':        {'shirt': '#00209F', 'shorts': '#00209F', 'socks': '#00209F', 'shoes': '#161412'},
    'scotland':     {'shirt': '#003399', 'shorts': '#003399', 'socks': '#003399', 'shoes': '#161412'},
    'paraguay':     {'shirt': '#D52B1E', 'shorts': '#D52B1E', 'socks': '#D52B1E', 'shoes': '#161412'},
    'australia':    {'shirt': '#FFCD00', 'shorts': '#FFCD00', 'socks': '#FFCD00', 'shoes': '#161412'},
    'turkey':       {'shirt': '#E30A17', 'shorts': '#E30A17', 'socks': '#E30A17', 'shoes': '#161412'},
    'ivorycoast':   {'shirt': '#F77F00', 'shorts': '#F77F00', 'socks': '#F77F00', 'shoes': '#161412'},
    'ecuador':      {'shirt': '#FFD100', 'shorts': '#0033A0', 'socks': '#FFD100', 'shoes': '#161412'},
    'netherlands':  {'shirt': '#FF6600', 'shorts': '#FF6600', 'socks': '#FF6600', 'shoes': '#161412'},
    'sweden':       {'shirt': '#006AA7', 'shorts': '#006AA7', 'socks': '#006AA7', 'shoes': '#161412'},
    'tunisia':      {'shirt': '#E70013', 'shorts': '#E70013', 'socks': '#E70013', 'shoes': '#161412'},
    'belgium':      {'shirt': '#D20F1A', 'shorts': '#D20F1A', 'socks': '#D20F1A', 'shoes': '#161412'},
    'egypt':        {'shirt': '#CE1126', 'shorts': '#CE1126', 'socks': '#CE1126', 'shoes': '#161412'},
    'iran':         {'shirt': '#239F40', 'shorts': '#239F40', 'socks': '#239F40', 'shoes': '#161412'},
    'saudi':        {'shirt': '#006C35', 'shorts': '#006C35', 'socks': '#006C35', 'shoes': '#161412'},
    'uruguay':      {'shirt': '#75AADB', 'shorts': '#75AADB', 'socks': '#75AADB', 'shoes': '#161412'},
    'senegal':      {'shirt': '#00853F', 'shorts': '#00853F', 'socks': '#00853F', 'shoes': '#161412'},
    'iraq':         {'shirt': '#007A3D', 'shorts': '#007A3D', 'socks': '#007A3D', 'shoes': '#161412'},
    'algeria':      {'shirt': '#006233', 'shorts': '#006233', 'socks': '#006233', 'shoes': '#161412'},
    'austria':      {'shirt': '#EF3340', 'shorts': '#EF3340', 'socks': '#EF3340', 'shoes': '#161412'},
    'jordan':       {'shirt': '#CE1126', 'shorts': '#CE1126', 'socks': '#CE1126', 'shoes': '#161412'},
    'congo':        {'shirt': '#007FFF', 'shorts': '#007FFF', 'socks': '#007FFF', 'shoes': '#161412'},
    'uzbekistan':   {'shirt': '#0099B5', 'shorts': '#0099B5', 'socks': '#0099B5', 'shoes': '#161412'},
    'croatia':      {'shirt': '#FF0000', 'shorts': '#FF0000', 'socks': '#FF0000', 'shoes': '#161412'},
    'panama':       {'shirt': '#D21034', 'shorts': '#D21034', 'socks': '#D21034', 'shoes': '#161412'},
    'ghana':        {'shirt': '#CE1126', 'shorts': '#006B3F', 'socks': '#CE1126', 'shoes': '#161412'},
}

# Alternative colors for clash resolution (away = simple solid)
AWAY_ALTERNATIVES: dict[str, str] = {
    'portugal': '#FFFFFF', 'morocco': '#FFFFFF', 'canada': '#FFFFFF',
    'spain': '#174FBC', 'southkorea': '#FFFFFF', 'czech': '#FFFFFF',
    'switzerland': '#FFFFFF', 'turkey': '#FFFFFF', 'tunisia': '#FFFFFF',
    'belgium': '#FFCC00', 'egypt': '#FFFFFF', 'austria': '#FFFFFF',
    'jordan': '#FFFFFF', 'croatia': '#003399', 'panama': '#FFFFFF',
    'ghana': '#FFCC00', 'paraguay': '#FFFFFF', 'haiti': '#FFFFFF',
    'england': '#CF081F', 'germany': '#111111', 'newzealand': '#111111',
    'usa': '#3C3B6E', 'france': '#FFFFFF', 'brazil': '#174FBC',
    'colombia': '#003893', 'mexico': '#FFFFFF', 'argentina': '#263B78',
    'norway': '#FFFFFF', 'japan': '#FFFFFF', 'curacao': '#FCD116',
    'capeverde': '#FFFFFF',
}


def hex_to_rgb(hex_str: str) -> tuple[int, int, int]:
    h = hex_str.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def shade(rgb: tuple[int, int, int], factor: float) -> tuple[int, int, int]:
    return tuple(max(0, min(255, round(c * factor))) for c in rgb)


def extract_masks(master_region: Image.Image) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    arr = np.array(master_region.convert('RGB'))
    r, g, b = arr[:, :, 0].astype(int), arr[:, :, 1].astype(int), arr[:, :, 2].astype(int)
    magenta = (r > 185) & (b > 135) & (g < 115)
    outline = (r < 30) & (g < 30) & (b < 30)
    body = ~magenta & ~outline
    return outline, body, magenta


def _spatial_shade(base_rgb, y, body_top, body_height):
    """Apply subtle top-light/bottom-dark gradient."""
    progress = (y - body_top) / max(1, body_height)
    if progress < 0.2:
        return shade(base_rgb, 1.10)
    elif progress > 0.8:
        return shade(base_rgb, 0.82)
    return base_rgb


def _get_body_bounds(body_mask):
    rows = np.where(body_mask.any(axis=1))[0]
    if len(rows) == 0:
        return 0, 1
    return int(rows[0]), max(1, int(rows[-1] - rows[0]))


def render_solid(body_mask, outline_mask, color_hex, **kw):
    h, w = body_mask.shape
    rgb = hex_to_rgb(color_hex)
    bt, bh = _get_body_bounds(body_mask)
    result = np.zeros((h, w, 4), dtype=np.uint8)
    result[outline_mask] = OUTLINE_COLOR
    for y in range(h):
        for x in range(w):
            if body_mask[y, x]:
                result[y, x] = (*_spatial_shade(rgb, y, bt, bh), 255)
    return result


def render_trim(body_mask, outline_mask, base_hex, trim_hex, trim_width=2, **kw):
    """Solid base with colored collar and sleeve edges."""
    h, w = body_mask.shape
    base_rgb = hex_to_rgb(base_hex)
    trim_rgb = hex_to_rgb(trim_hex)
    bt, bh = _get_body_bounds(body_mask)
    result = np.zeros((h, w, 4), dtype=np.uint8)
    result[outline_mask] = OUTLINE_COLOR

    # Find body bounds per row for edge detection
    for y in range(h):
        row_body = np.where(body_mask[y, :])[0]
        if len(row_body) == 0:
            continue
        left = row_body[0]
        right = row_body[-1]
        row_width = right - left + 1
        for x in row_body:
            # Collar: top rows
            is_collar = (y - bt) < trim_width + 1
            # Sleeve edges: left/right edges in upper portion
            is_edge = (x - left < trim_width or right - x < trim_width) and (y - bt) < bh * 0.5
            if is_collar or is_edge:
                result[y, x] = (*_spatial_shade(trim_rgb, y, bt, bh), 255)
            else:
                result[y, x] = (*_spatial_shade(base_rgb, y, bt, bh), 255)
    return result


def render_v_stripes(body_mask, outline_mask, colors, stripe_width=4, **kw):
    h, w = body_mask.shape
    rgb_colors = [hex_to_rgb(c) for c in colors]
    n = len(rgb_colors)
    bt, bh = _get_body_bounds(body_mask)
    result = np.zeros((h, w, 4), dtype=np.uint8)
    result[outline_mask] = OUTLINE_COLOR
    for y in range(h):
        for x in range(w):
            if body_mask[y, x]:
                idx = (x // stripe_width) % n
                c = _spatial_shade(rgb_colors[idx], y, bt, bh)
                result[y, x] = (*c, 255)
    return result


def render_h_bands(body_mask, outline_mask, base_hex, bands, **kw):
    """Horizontal bands at specified y-ratios (e.g. Germany flag stripes)."""
    h, w = body_mask.shape
    base_rgb = hex_to_rgb(base_hex)
    bt, bh = _get_body_bounds(body_mask)
    result = np.zeros((h, w, 4), dtype=np.uint8)
    result[outline_mask] = OUTLINE_COLOR
    for y in range(h):
        for x in range(w):
            if not body_mask[y, x]:
                continue
            progress = (y - bt) / max(1, bh)
            color = base_rgb
            for band in bands:
                if band['y_start'] <= progress <= band['y_end']:
                    color = hex_to_rgb(band['color'])
                    break
            result[y, x] = (*_spatial_shade(color, y, bt, bh), 255)
    return result


def render_cross(body_mask, outline_mask, colors, **kw):
    h, w = body_mask.shape
    bg_rgb = hex_to_rgb(colors[0])
    cross_rgb = hex_to_rgb(colors[1])
    border_rgb = hex_to_rgb(colors[2]) if len(colors) > 2 else (255, 255, 255)
    bt, bh = _get_body_bounds(body_mask)
    cross_v = int(w * 0.35)
    cross_h = int(h * 0.42)
    arm_w = max(2, int(w * 0.13))
    result = np.zeros((h, w, 4), dtype=np.uint8)
    result[outline_mask] = OUTLINE_COLOR
    for y in range(h):
        for x in range(w):
            if not body_mask[y, x]:
                continue
            in_v = abs(x - cross_v) <= arm_w // 2
            in_h = abs(y - cross_h) <= arm_w // 2
            in_cross = in_v or in_h
            in_border = (abs(x - cross_v) <= arm_w // 2 + 1 or abs(y - cross_h) <= arm_w // 2 + 1) and not in_cross
            if in_cross:
                c = cross_rgb
            elif in_border:
                c = border_rgb
            else:
                c = bg_rgb
            result[y, x] = (*_spatial_shade(c, y, bt, bh), 255)
    return result


def render_sash(body_mask, outline_mask, base_hex, sash_color, sash_width=4, **kw):
    """Diagonal sash across the shirt (e.g. Colombia)."""
    h, w = body_mask.shape
    base_rgb = hex_to_rgb(base_hex)
    sash_rgb = hex_to_rgb(sash_color)
    bt, bh = _get_body_bounds(body_mask)
    result = np.zeros((h, w, 4), dtype=np.uint8)
    result[outline_mask] = OUTLINE_COLOR
    for y in range(h):
        for x in range(w):
            if not body_mask[y, x]:
                continue
            # Diagonal: x + y = const lines
            progress = (y - bt) / max(1, bh)
            diag_center = int(w * 0.3 + progress * w * 0.4)
            if abs(x - diag_center) <= sash_width // 2:
                c = sash_rgb
            else:
                c = base_rgb
            result[y, x] = (*_spatial_shade(c, y, bt, bh), 255)
    return result


def render_pattern(team_id: str, master_region: Image.Image) -> Image.Image:
    outline_mask, body_mask, _ = extract_masks(master_region)
    config = KIT_PATTERNS.get(team_id)
    if config is None:
        return Image.new('RGBA', master_region.size, (0, 0, 0, 0))

    t = config['type']
    if t == 'solid':
        arr = render_solid(body_mask, outline_mask, config['colors'][0])
    elif t == 'trim':
        arr = render_trim(body_mask, outline_mask, config['base'], config['trim_color'], config.get('trim_width', 2))
    elif t == 'v_stripes':
        arr = render_v_stripes(body_mask, outline_mask, config['colors'], config.get('stripe_width', 4))
    elif t == 'h_bands':
        arr = render_h_bands(body_mask, outline_mask, config['base'], config['bands'])
    elif t == 'cross':
        arr = render_cross(body_mask, outline_mask, config['colors'])
    elif t == 'sash':
        arr = render_sash(body_mask, outline_mask, config['base'], config['sash_color'], config.get('sash_width', 4))
    else:
        arr = render_solid(body_mask, outline_mask, config.get('base', config.get('colors', ['#888888'])[0]))
    return Image.fromarray(arr, 'RGBA')


def render_solid_from_color(master_region: Image.Image, color_hex: str) -> Image.Image:
    outline_mask, body_mask, _ = extract_masks(master_region)
    arr = render_solid(body_mask, outline_mask, color_hex)
    return Image.fromarray(arr, 'RGBA')


def color_distance(hex1: str, hex2: str) -> float:
    r1, g1, b1 = hex_to_rgb(hex1)
    r2, g2, b2 = hex_to_rgb(hex2)
    return ((r1-r2)**2 + (g1-g2)**2 + (b1-b2)**2) ** 0.5


def resolve_clash(home_id: str, away_id: str) -> tuple[str, str]:
    """Return (home_shirt_color, away_shirt_color) resolving clashes."""
    home_color = TEAM_KIT_COLORS.get(home_id, {}).get('shirt', '#888888')
    away_color = TEAM_KIT_COLORS.get(away_id, {}).get('shirt', '#888888')
    if color_distance(home_color, away_color) < 100:
        # Clash! Give away team their alternative
        away_color = AWAY_ALTERNATIVES.get(away_id, '#FFFFFF')
    return home_color, away_color
