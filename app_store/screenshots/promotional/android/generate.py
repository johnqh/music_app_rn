#!/usr/bin/env python3
"""Generate Android promotional image (1024x500) with blue textured background.

Layout: text centered at top, 4 phone screenshots below (extending off bottom).
"""

from PIL import Image, ImageDraw, ImageFont
import os

# --- Config ---
WIDTH, HEIGHT = 1024, 500
BG_COLOR = (30, 59, 140)
LINE_COLOR = (46, 73, 148)
LINE_SPACING = 25
LINE_WIDTH = 4

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
RAW_DIR = os.path.join(SCRIPT_DIR, "..", "..", "raw", "android_phone", "en")
OUTPUT = os.path.join(SCRIPT_DIR, "promotional.png")

TITLE = "Master"
SUBTITLE = "60+ Sudoku solving skills"
CORNER_RADIUS = 14

# --- Create background with diagonal texture ---
img = Image.new("RGB", (WIDTH, HEIGHT), BG_COLOR)
draw = ImageDraw.Draw(img)

for offset in range(-HEIGHT, WIDTH + HEIGHT, LINE_SPACING):
    draw.line([(offset, 0), (offset + HEIGHT, HEIGHT)], fill=LINE_COLOR, width=LINE_WIDTH)

# Subtle gradient darkening toward bottom
gradient = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
gdraw = ImageDraw.Draw(gradient)
for y in range(HEIGHT):
    alpha = int(20 * (y / HEIGHT))
    gdraw.line([(0, y), (WIDTH, y)], fill=(0, 0, 0, alpha))
img = Image.alpha_composite(img.convert("RGBA"), gradient).convert("RGB")

# --- Load screenshots ---
screenshots = []
for i in range(1, 5):
    path = os.path.join(RAW_DIR, f"{i}.png")
    screenshots.append(Image.open(path))

# --- Layout: text on top, phones below ---
TEXT_TOP_MARGIN = 30
TEXT_BOTTOM_GAP = 20  # gap between subtitle and phones

# Load fonts
try:
    title_font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 52)
    subtitle_font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 20)
except Exception:
    title_font = ImageFont.load_default()
    subtitle_font = ImageFont.load_default()

# Measure text
tmp_draw = ImageDraw.Draw(img)
title_bbox = tmp_draw.textbbox((0, 0), TITLE, font=title_font)
title_w = title_bbox[2] - title_bbox[0]
title_h = title_bbox[3] - title_bbox[1]

sub_bbox = tmp_draw.textbbox((0, 0), SUBTITLE, font=subtitle_font)
sub_w = sub_bbox[2] - sub_bbox[0]
sub_h = sub_bbox[3] - sub_bbox[1]

text_block_h = title_h + 10 + sub_h  # title + gap + subtitle
phones_top_y = TEXT_TOP_MARGIN + text_block_h + TEXT_BOTTOM_GAP

# Phone sizing: fill remaining height, let them extend off-canvas bottom
PHONE_GAP = 14
PHONE_MARGIN_SIDE = 30

sc_w, sc_h = screenshots[0].size
aspect = sc_w / sc_h

# Size phones so they extend below canvas (show ~80% of phone)
phone_visible_h = HEIGHT - phones_top_y
phone_full_h = int(phone_visible_h / 0.75)
phone_w = int(phone_full_h * aspect)

total_phones_width = 4 * phone_w + 3 * PHONE_GAP
phones_offset_x = (WIDTH - total_phones_width) // 2


# --- Rounded corners helper ---
def round_corners(im, radius):
    im = im.convert("RGBA")
    mask = Image.new("L", im.size, 0)
    mdraw = ImageDraw.Draw(mask)
    mdraw.rounded_rectangle([(0, 0), (im.width - 1, im.height - 1)], radius=radius, fill=255)
    im.putalpha(mask)
    return im


# --- Paste screenshots ---
img_rgba = img.convert("RGBA")

shadow_offset = 4
shadow_color = (10, 25, 70, 120)

for idx, sc in enumerate(screenshots):
    resized = sc.resize((phone_w, phone_full_h), Image.LANCZOS)
    rounded = round_corners(resized, CORNER_RADIUS)
    x = phones_offset_x + idx * (phone_w + PHONE_GAP)
    y = phones_top_y

    # Shadow
    shadow = Image.new("RGBA", (phone_w, phone_full_h), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow)
    sdraw.rounded_rectangle(
        [(0, 0), (phone_w - 1, phone_full_h - 1)],
        radius=CORNER_RADIUS,
        fill=shadow_color,
    )
    img_rgba.paste(
        Image.alpha_composite(
            Image.new("RGBA", (phone_w, phone_full_h), (0, 0, 0, 0)), shadow
        ),
        (x + shadow_offset, y + shadow_offset),
        shadow,
    )

    # Phone screenshot
    img_rgba.paste(rounded, (x, y), rounded)

# --- Add text (centered horizontally) ---
fdraw = ImageDraw.Draw(img_rgba)

title_x = (WIDTH - title_w) // 2
title_y = TEXT_TOP_MARGIN

# Shadow then white
fdraw.text((title_x + 2, title_y + 2), TITLE, font=title_font, fill=(15, 30, 90))
fdraw.text((title_x, title_y), TITLE, font=title_font, fill="white")

sub_x = (WIDTH - sub_w) // 2
sub_y = title_y + title_h + 10

fdraw.text((sub_x + 1, sub_y + 1), SUBTITLE, font=subtitle_font, fill=(15, 30, 90))
fdraw.text((sub_x, sub_y), SUBTITLE, font=subtitle_font, fill=(225, 230, 245))

# --- Crop to canvas size (phones extend beyond) ---
final = img_rgba.crop((0, 0, WIDTH, HEIGHT))

# --- Save ---
final_rgb = final.convert("RGB")
final_rgb.save(OUTPUT, "PNG")
print(f"Saved promotional image to {OUTPUT}")
print(f"Size: {final_rgb.size}")
