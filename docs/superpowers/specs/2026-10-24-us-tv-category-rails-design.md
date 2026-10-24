# US TV Category Rails Design

## Intent

Make the US TV directory feel like the rest of the IVTV homepage by replacing its standalone grid with horizontally scrolling channel rails grouped by category. Keep the 40 supplied channel names and logos, directory-only behavior, and in-section search.

## Goals and boundaries

- Use the existing homepage section headings, poster-style channel cards, horizontal scrolling, and carousel navigation.
- Show each channel exactly once, in a curated primary category rail.
- Keep search across channel names and genre labels; update category rails and counts as the query changes.
- Keep channel cards informational; do not add playback.
- Do not change other channel sections or their ordering.

## Constraints

- Reuse the existing CSS carousel track, card, and navigation patterns.
- The source labels can include multiple genres; using each term as a separate rail would repeat channels and create a long section.
- Preserve the responsive layout and lazy-loaded logo behavior.

## Approaches

1. **One US TV rail** — closest to a single existing homepage section and compact, but gives no category-based discovery.
2. **Curated category rails (selected)** — each channel appears once in a broad primary category. Best supports browsing by content while using homepage conventions; requires a small explicit category mapping.
3. **One rail per source genre** — uses the source labels directly, but creates many small rows and may duplicate channels for combined genres.

## Design

Use curated primary rows: News, Entertainment, Movies, Documentary & Science, Lifestyle & Reality, Music & Business, and Classic & Public TV. Assign each source channel to one row. Each row uses the existing carousel track and arrow controls; retain the US TV heading, total/filtered channel count, search field, and the directory-only note. Empty search results show the existing US TV empty-state message.

## Validation

Verify all 40 source channels appear exactly once with their logo and genre text; search filters the rails and count correctly; empty searches show the empty state; rails work at desktop and mobile widths; no card opens playback.
