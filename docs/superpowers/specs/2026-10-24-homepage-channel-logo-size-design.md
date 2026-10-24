# Homepage Channel Logo Size Design

## Intent

Make channel logos more prominent on the regular homepage cards so they use more of the available image area.

## Goals and non-goals

- Increase the rendered size of homepage logos while retaining the current cinematic backdrop and glass emblem plate.
- Preserve each logo's aspect ratio and contained fit.
- Do not change US TV cards, card dimensions, playback, or the plate treatment.

## Approaches

- **Enlarge the logo only (selected):** increase the logo image's maximum dimensions while leaving the existing plate unchanged. This directly addresses the undersized marks without changing the card's visual structure.
- **Enlarge the logo and plate:** gives the logo more room, but changes both its scale and the surrounding card treatment.
- **Remove the plate and use a large overlay:** maximizes logo area but reduces backdrop visibility and changes the established card look.

The user selected enlarging the logo only. Keep `object-fit: contain` so wide and compact channel marks retain their proportions. Enlarge the rendered mark with a transform rather than changing its layout dimensions, so the automatically sized glass plate does not grow with it.

## Constraints

The regular homepage cards are built with shared markup in `js/ui.js` and styled in `css/components.css`. Their logo image uses `.card-channel-logo-img`; the enclosing `.card-logo-emblem-plate` remains unchanged. Ranked cards share these styles. Do not alter the separate US TV logo styles.

## Validation

Check the rendered logos on desktop and mobile card widths, confirm the plate and card geometry remain unchanged, and run the relevant JavaScript syntax and diff checks.
