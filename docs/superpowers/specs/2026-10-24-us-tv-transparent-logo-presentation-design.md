# US TV Logo Presentation Design

## Intent

Make US TV channel logos fit the site's dark visual style by removing the white presentation plate behind each logo.

## Goals and boundaries

- Render the current supplied logo images directly over the card's dark media panel.
- Preserve each image's original colors and proportions.
- Keep the existing fallback behavior and card layout.
- Do not alter source image files or apply color filters.

## Approaches

1. **Remove the CSS plate (selected)** — minimal change, preserves source logos and brand colors. Logos with white baked into their image remain white.
2. **Monochrome CSS treatment** — blends white away, but changes brand colors and can reduce contrast.
3. **Create transparent local assets** — can remove baked-in backgrounds, but requires processing individual logos and maintaining new assets.

## Constraints

Use the existing card implementation and keep image loading, logo fallback, search, and carousel behavior unchanged. The design retains white areas that are part of the source image itself.

## Validation

Check the rendered US TV cards in the browser to confirm there is no added white plate, source colors remain unchanged, and failed images still reveal their text fallback. Run JavaScript syntax and whitespace checks.
