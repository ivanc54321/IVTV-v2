# IVTV — Cinematic UK & Sky Channel IPTV Web Player

An ultra-modern, dark-glass live streaming web application inspired by the **CinemaOS** dark aesthetic. Aggregates and streams **45 live UK & Sky TV channels** in high definition with official broadcast logos, theater playback, live status indicators, giant outlined rankings, real-time EPG TV Guide, and instant in-player channel-surfing.

---

## 🌟 Key Features

1. **Dark-Glass Cinema Aesthetics & Official Channel Logos**:
   - Deep obsidian canvas (`#060908`) with emerald radial glows and frosted glass surfaces (`backdrop-filter: blur(20px)`).
   - High-fidelity **official channel logos** on every channel card, in the Top 10 rankings, in the EPG TV Guide, and inside the theater player.
   - Dual-mode asset pipeline: zero-latency local logos (`assets/logos/*.png`) with remote CDN fallback.
   - Floating glassmorphic navbar with live HD badge, category filters (Sports, Cinema, Entertainment, News), and instant search.

2. **All UK Channels Directory Section**:
   - Comprehensive directory showcasing **all 49 verified UK & Sky channels** in one dedicated homepage section.
   - Interactive subcategory filter tabs (**All**, **Sports**, **Cinema**, **Entertainment**, **News**) with live channel count badges.
   - Dual layout mode: responsive **Multi-Row CSS Grid** or smooth horizontal **Carousel Track**.
   - Flexible sorting: **Channel Number (LCN)**, **Most Viewed 🔥**, **Name (A–Z)**, and **Top Rated ★**.
   - Instant in-section quick filter search for rapid channel discovery.

3. **US TV Channel Directory**:
   - Browse 40 US channels in seven homepage-style category carousels, with logos and genre labels.
   - Search the directory by channel name or genre; matching rows update as you type.
   - Directory-only listing; playback is not configured.

4. **Top 10 Channels with Giant Outlined Numerals**:
   - Signature hollow stroke numbers (`1`, `2`, `3`...) sitting beside top-ranked channels sorted dynamically by viewership.
   - Interactive hover cards with glowing neon borders, live pulse dots, view counts, and 1-click play triggers.

5. **Cinema Theater Stream Player**:
   - 16:9 responsive theater modal with smooth zoom transitions and loading spinners.
   - Displays active channel logo, channel number (LCN), and real-time broadcast ticker.
   - Fullscreen mode, pop-out external player, stream reload button, and favorite toggle.
   - **In-Player Quick Channel Surf Drawer**: Switch between live channels without closing playback mode!
   - Built-in VPN / ISP streaming advisory helper.

6. **49 Verified UK & Sky Channels**:
   - **Live Sports Arena (14 Channels)**: Sky Sports F1, Premier League, Main Event, Tennis, Football, Cricket, Golf, Action, Racing, News, Mix, Plus, LaLiga, Rally TV, Trace Sports.
   - **Sky Cinema & Movies (11 Channels)**: Premiere, Select, Hits, Greats, Family, Action, Comedy, Thriller, Drama, Sci-Fi Horror, Film4.
   - **UK Entertainment & Series (15 Channels)**: BBC One, BBC Two, BBC Three, ITV1, ITV2, ITV3, ITV4, Sky Atlantic, Sky Showcase, Sky Comedy, Sky Crime, Sky Arts, Sky History, Gold, S4C.
   - **News & Current Affairs (9 Channels)**: Sky News, BBC News UK, Bloomberg Television, CNN International, Russia Today (RT), GB News, Al Jazeera English, Reuters Live.

7. **Live TV Guide (EPG)**:
   - Full schedule timeline grid with red vertical real-time "NOW" marker.
   - Sticky channel column featuring official logos and channel numbers.
   - Detailed program modals with synopses, remaining runtime, and direct tune-in buttons.

8. **Real-Time Search & Watchlist**:
   - Instant search across channel names, LCN numbers (e.g. `101`, `402`), genres, and categories (press `/` to focus).
   - Persistent LocalStorage favorites and recently watched history.

---

## 🚀 How to Run Locally (Standalone / No IDE Required)

You do **not** need Antigravity or any IDE open to watch IV - TV. Everything runs completely standalone on your Windows PC:

### Option 1: Desktop & Start Menu Shortcuts (Easiest — 1-Click)
Shortcuts have been configured directly on your Windows Desktop and Start Menu:
- **`IV - TV`**: Double-click to silently start the background server (zero console flashing) and launch the frameless standalone desktop TV player with unmuted audio playback enabled.
- **`Stop IV - TV`**: 1-click shortcut to stop and close the background server when you are done watching.
- **Start Menu**: Type `IV - TV` or `IVTV` in the Windows Start Menu or search bar to launch instantly.

*(To re-create or update desktop shortcuts at any time, run `create_desktop_shortcut.bat`)*.

---

### Option 2: From File Explorer
Simply double-click the helper scripts inside the project directory:
- **[launch.bat](file:///c:/Users/ivanc/IV%20-%20TV/launch.bat)** (or `launch.vbs`): Starts the server silently in the background and opens `http://localhost:5173`. Python 3 must be installed; the launcher uses the Windows Python launcher when available, so VS Code does not need to be open.
- **[stop.bat](file:///c:/Users/ivanc/IV%20-%20TV/stop.bat)** (or `stop.vbs`): Cleanly terminates the background server listening on port 5173.

---

---

## 📴 Full Offline & Standalone PWA Support

IVTV is fully engineered for zero-latency offline use with zero external CDN dependencies:

1. **Local Bundled Assets**:
   - **HLS.js**: Bundled locally at [js/hls.min.js](file:///c:/Users/ivanc/IV%20-%20TV/js/hls.min.js) — streams boot instantly without CDN queries.
   - **Modern Typography**: Outfit & Plus Jakarta Sans webfonts stored locally in `assets/fonts/` and served via [css/fonts.css](file:///c:/Users/ivanc/IV%20-%20TV/css/fonts.css).
   - **All 70 Channel Logos**: 100% stored locally in `assets/logos/` — zero missing or broken external image links.
   - **Local Hero Visuals**: All featured streaming hero backdrops saved in `assets/images/`.

2. **Progressive Web App (PWA) & Service Worker**:
   - [manifest.webmanifest](file:///c:/Users/ivanc/IV%20-%20TV/manifest.webmanifest): Configured for frameless desktop standalone window launch.
   - [sw.js](file:///c:/Users/ivanc/IV%20-%20TV/sw.js): Pre-caches 98 application shell assets for instant startup even with no network connection.

3. **Dynamic Offline Detection & Visual Status Pill**:
   - Real-time connectivity monitor in navbar: displays **ONLINE** (green pulse) when connected and **OFFLINE** (amber) when disconnected.
   - When offline, the complete **24-hour EPG TV Guide**, **Watchlist & Favorites**, **All UK Channels Directory**, and instant search remain 100% operational.
   - The theater player provides intelligent offline notifications with direct 1-click access to the TV Guide.
