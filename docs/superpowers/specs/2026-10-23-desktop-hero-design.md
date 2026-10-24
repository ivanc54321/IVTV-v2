# Desktop Full-Viewport Hero Design

## Intent

Give the desktop landing page a cinematic full-browser-screen hero and remove
the hero thumbnail cards without losing access to the rotating featured slides.

## Goals

- On desktop, make the hero fill the viewport height, with the fixed navbar
  overlaid on top.
- Remove the thumbnail cards and their card-specific interactions.
- Preserve featured-slide content, automatic rotation, pagination, and previous /
  next controls.
- Keep existing smaller-screen hero sizing and behavior.

## Non-goals and anti-goals

- Do not change slide content, timing, backgrounds, or Watch Live / guide /
  directory actions.
- Do not add a separate fullscreen mode or alter other page sections.
- Do not remove pagination or navigation controls along with the cards.

## Constraints

- The hero currently uses a 74vh minimum height.
- The navbar is fixed and already overlays the hero.
- Slide content and pagination are rendered in `js/ui.js`; thumbnail cards are
  rendered in a separate container.

## Approaches

1. Hide the thumbnail strip with CSS. This is minimal but leaves unused card
   markup and rendering code.
2. Remove the thumbnail strip and its renderer while retaining pagination and
   slide controls. This cleanly removes the card UI and is the recommended
   approach.

## Decision

Use approach 2. Apply full-viewport sizing only at desktop breakpoints, with the
fixed navbar layered over the hero. Preserve mobile/tablet sizing, automatic
slide rotation, pagination bars, and arrow controls.

## Builder choices

- Use viewport-relative height with a modern small-viewport fallback where
  supported.
- Keep the existing 16:9 backdrop treatment (`object-fit: cover`) rather than
  distorting imagery to a fixed aspect ratio.
- Validate CSS/JS syntax and confirm the markup and renderer no longer create
  hero cards while slide controls remain.
