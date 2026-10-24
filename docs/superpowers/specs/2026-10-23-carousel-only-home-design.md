# Carousel-Only Homepage Design

## Intent

Simplify the IVTV home page into the hero showcase and channel carousels, remove
the Prime Broadcasts spotlight and other non-carousel homepage sections, make
the hero actions easier to use, and ensure the installed standalone app loads
the updated experience.

## Goals

- Keep the hero showcase and these carousel rows: Most Viewed, Favorites,
  Freeview, Sky, News, Cinema, and Entertainment.
- Remove the Prime Broadcasts spotlight and its three featured channel cards.
- Remove the genre tile grid, platform/network badge grid, and Watch Live
  Channels directory from the homepage.
- Remove the standalone Live Wire ticker from the news section so the section
  contains only its channel carousel.
- Preserve the underlying channel catalog, search, player, TV guide, carousel
  filtering, favorites, and hero slide behavior.
- Update the hero's All Channels action to a truthful Browse Channels action
  that scrolls to the Sky carousel.
- Enlarge the hero action buttons and slide-navigation buttons while retaining
  responsive layout and usable mobile sizing.
- Bump the standalone build and service-worker cache versions so installed
  desktop clients refresh the new shell.
- Push the completed app changes to the `origin` remote.

## Non-goals and anti-goals

- Do not remove channel records or disable search, playback, favorites, or the
  TV guide.
- Do not remove the seven carousel rows or alter their channel membership.
- Do not leave navigation links that point to removed homepage sections.
- Do not stage or publish the pre-existing README and launcher edits.
- Do not commit or push unless the design is approved and the targeted
  validation passes.

## Current behavior and constraints

- Homepage section markup is in `index.html`; the UI controller renders the
  spotlight, channel carousels, genre grid, and all-channel directory.
- Header and footer navigation include links to the directory and genres.
- The hero's All Channels action currently targets the directory, with a Sky
  carousel fallback.
- The all-channel directory has grid and carousel modes, but the user chose a
  home page that keeps only the carousel rows.
- The desktop hero already fills the viewport; smaller-screen sizing remains
  distinct.
- Standalone clients clear their caches when `APP_BUILD_VER` changes. The
  service-worker cache and registration URL also have independent versions.
- The worktree already contains earlier playback and desktop-hero changes made
  for the user, as well as pre-existing README and launcher edits. Only app
  changes made for these requests will be included in the requested push; the
  README and launcher edits remain untouched and excluded.
- The project has two remotes. Publish to `origin` (`ivanc54321/iv-tv`), not
  the alternate `ivtv-v1` remote.

## Approaches

1. **Remove non-carousel sections from the homepage and clean up their
   navigation/render entry points.** Preserve catalog data and shared
   functionality. This directly achieves the requested homepage without
   retaining dead sections or links. **Selected.**
2. **Hide the sections with CSS.** This is easy to reverse but continues to
   render unused UI, can leave stale navigation targets, and makes the
   carousel-only intent less clear.

## Decisions

- Remove Prime Broadcasts, genre tiles, platform badges, the Live Wire ticker,
  and the all-channel directory from homepage markup and initialization.
- Keep the seven named carousel rows and preserve shared channel records and
  interactions.
- Remove directory/genre navigation items and footer links; ensure remaining
  navigation targets existing carousel sections.
- Rename the hero action from All Channels to Browse Channels and send it to
  the Sky carousel rather than a removed directory.
- Increase hero CTA and slide-arrow target sizes, using responsive sizing that
  avoids crowding smaller screens.
- Bump `APP_BUILD_VER`, the service-worker cache name, and the service-worker
  registration query together to refresh installed clients.
- Validate desktop and narrow-screen behavior in the browser, JavaScript
  syntax, and the rendered homepage before publishing.
- Push a commit containing app changes made for the playback fix, full-screen
  hero, and this request. Exclude the pre-existing `README.md` and `launch.vbs`
  worktree edits.

## Remaining implementation choices

- Choose exact responsive button dimensions that fit the existing hero layout.
- Remove only section-specific render/listener paths that become unreachable;
  retain helpers still used by carousel rows, search, or the TV guide.
- Use a concise commit message with the repository-required Copilot co-author
  trailer, then push to `origin/main` after confirming it is safe to push.
