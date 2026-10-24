/* ==========================================================================
   IVTV UI RENDERER & INTERACTION CONTROLLER
   ========================================================================== */

class UIController {
  constructor() {
    this.currentHeroIndex = 0;
    this.activeFilter = 'all';
    this.activeEPGCategory = 'all';
    this.searchQuery = '';
    this.heroTimer = null;
    this.videoEndedHandler = null;
    this.videoFallbackTimer = null;
    this.epgClockTimer = null;
    this.epgScrolled = false;

    // All UK Channels Directory State
    this.allChannelsCategory = 'all';
    this.allChannelsSort = 'lcn'; // 'lcn' | 'views' | 'name' | 'rating'
    this.allChannelsView = 'grid'; // 'grid' | 'carousel'
    this.allChannelsQuery = '';
    this.justDraggedLiveChannels = false;
  }

  init() {
    this.setupHeroActions();
    this.renderHero();
    this.renderTopRanked();
    this.renderUsTvDirectory();
    this.renderFreeviewSection();
    this.renderProvidersBar();
    this.renderCategorySections();
    this.renderEPG();
    this.setupEPGClock();
    this.setupHeroAutoSlide();
    this.setupEventListeners();

    // Expose global hero tuner for buttons and hotkeys
    window.tuneHeroChannel = () => this.tuneHeroChannel();
  }

  tuneHeroChannel() {
    const showcases = window.IVTV_DATA?.heroShowcases;
    if (!showcases || showcases.length === 0) return;
    const current = showcases[this.currentHeroIndex] || showcases[0];
    if (current && window.ivtvPlayer) {
      window.ivtvPlayer.openPlayer(current.channelId);
    }
  }

  // ==========================================================================
  // HERO SHOWCASE SECTION
  // ==========================================================================

  renderHero() {
    const showcases = window.IVTV_DATA.heroShowcases;
    const current = showcases[this.currentHeroIndex];
    if (!current) return;

    // Update Backdrop Media (Video & Image)
    const backdropImg = document.getElementById('hero-backdrop-img');
    const backdropVideo = document.getElementById('hero-backdrop-video');

    if (current.video && backdropVideo) {
      // Ensure completely silent
      backdropVideo.muted = true;
      backdropVideo.volume = 0;

      // Load source if changed
      if (!backdropVideo.currentSrc || !backdropVideo.currentSrc.includes('ivtv-intro')) {
        backdropVideo.src = current.video;
        backdropVideo.load();
      }
      backdropVideo.currentTime = 0;
      backdropVideo.style.opacity = '1';
      const playPromise = backdropVideo.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {});
      }
      if (backdropImg) {
        backdropImg.style.opacity = '0';
      }
    } else {
      if (backdropVideo) {
        backdropVideo.style.opacity = '0';
        backdropVideo.pause();
      }
      if (backdropImg) {
        backdropImg.style.opacity = '0';
        setTimeout(() => {
          backdropImg.src = current.image;
          backdropImg.style.opacity = '1';
        }, 200);
      }
    }

    // Update Hero Content
    const titleEl = document.getElementById('hero-title');
    const descEl = document.getElementById('hero-desc');
    const badgesEl = document.getElementById('hero-badges');
    const playBtn = document.getElementById('hero-play-btn');
    const favBtn = document.getElementById('hero-fav-btn');

    if (titleEl) titleEl.textContent = current.title;
    if (descEl) descEl.textContent = current.synopsis;

    if (badgesEl) {
      badgesEl.innerHTML = '';
    }

    // Render hero slide pagination
    this.renderHeroPagination();
  }

  setupHeroActions() {
    const playBtn = document.getElementById('hero-play-btn');
    const guideBtn = document.getElementById('hero-guide-btn');
    const browseBtn = document.getElementById('hero-browse-btn');

    if (playBtn) {
      this.updateHeroPlayButtonHint();
      playBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = this.getPrimaryLiveChannel();
        if (window.ivtvPlayer) {
          window.ivtvPlayer.openPlayer(targetId);
          const ch = window.IVTV_DATA?.channels?.find(c => c.id === targetId);
          if (ch && window.showToast) {
            window.showToast(`Starting Live Broadcast: ${ch.name}`, 'success');
          }
        }
      });

      // Keep button hint in sync if recent channels change
      window.addEventListener('ivtv:recent-changed', () => {
        this.updateHeroPlayButtonHint();
      });
    }

    if (guideBtn) {
      guideBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.openTVGuide();
      });
    }

    if (browseBtn) {
      browseBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const skySection = document.getElementById('sky-channels-section');
        if (skySection) {
          skySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }


  }

  getPrimaryLiveChannel() {
    try {
      const last = localStorage.getItem('ivtv_last_channel_v1');
      if (last) {
        const found = window.IVTV_DATA?.channels?.find(c => c.id === last);
        if (found && !this.isSportsChannel(found)) {
          return last;
        }
      }
      if (window.ivtvStorage) {
        const recent = window.ivtvStorage.getRecent();
        if (recent && recent.length > 0) {
          const found = window.IVTV_DATA?.channels?.find(c => c.id === recent[0] && !this.isSportsChannel(c));
          if (found) return found.id;
        }
      }
    } catch (e) {}
    // Rock-solid flagship verified live broadcast channel
    return 'sky-atlantic-uk';
  }

  updateHeroPlayButtonHint() {
    const hintEl = document.getElementById('hero-play-channel-hint');
    if (!hintEl) return;
    const targetId = this.getPrimaryLiveChannel();
    const ch = window.IVTV_DATA?.channels?.find(c => c.id === targetId);
    if (ch) {
      hintEl.textContent = ch.chNumber ? `CH ${ch.chNumber} • ${ch.name}` : ch.name;
    }
  }

  renderHeroPagination() {
    const showcases = window.IVTV_DATA.heroShowcases;
    const paginationContainer = document.getElementById('hero-pagination');

    if (paginationContainer) {
      paginationContainer.innerHTML = showcases.map((_, idx) => `
        <div class="hero-dot-bar ${idx === this.currentHeroIndex ? 'active' : ''}" data-index="${idx}"></div>
      `).join('');

      paginationContainer.querySelectorAll('.hero-dot-bar').forEach(dot => {
        dot.addEventListener('click', () => {
          this.setHeroSlide(parseInt(dot.dataset.index, 10));
        });
      });
    }

    this.initCarouselMouseNavigation();
  }

  setHeroSlide(index) {
    this.currentHeroIndex = index;
    this.renderHero();
    this.resetHeroTimer();
  }

  nextHeroSlide() {
    const total = window.IVTV_DATA.heroShowcases.length;
    this.currentHeroIndex = (this.currentHeroIndex + 1) % total;
    this.renderHero();
    this.resetHeroTimer();
  }

  prevHeroSlide() {
    const total = window.IVTV_DATA.heroShowcases.length;
    this.currentHeroIndex = (this.currentHeroIndex - 1 + total) % total;
    this.renderHero();
    this.resetHeroTimer();
  }

  setupHeroAutoSlide() {
    this.resetHeroTimer();
  }

  resetHeroTimer() {
    if (this.heroTimer) {
      clearInterval(this.heroTimer);
      this.heroTimer = null;
    }

    const backdropVideo = document.getElementById('hero-backdrop-video');
    if (this.videoEndedHandler && backdropVideo) {
      backdropVideo.removeEventListener('ended', this.videoEndedHandler);
      this.videoEndedHandler = null;
    }
    if (this.videoFallbackTimer) {
      clearTimeout(this.videoFallbackTimer);
      this.videoFallbackTimer = null;
    }

    const showcases = window.IVTV_DATA?.heroShowcases;
    const current = showcases ? showcases[this.currentHeroIndex] : null;

    if (current && current.video && backdropVideo) {
      // Intro video plays completely to the end before switching to the next slide
      this.videoEndedHandler = () => {
        this.nextHeroSlide();
      };
      backdropVideo.addEventListener('ended', this.videoEndedHandler, { once: true });

      // Fallback timer in case autoplay/ended event is delayed or interrupted
      const fallbackMs = (backdropVideo.duration && !isNaN(backdropVideo.duration) && backdropVideo.duration > 0)
        ? Math.ceil((backdropVideo.duration + 1) * 1000)
        : 11000;
      this.videoFallbackTimer = setTimeout(() => {
        this.nextHeroSlide();
      }, fallbackMs);
      return;
    }

    // Standard auto-slide interval for image slides
    this.heroTimer = setInterval(() => {
      this.nextHeroSlide();
    }, 7500);
  }

  // Helper for category and channel icon
  getChannelIcon(ch) {
    const name = ch.name;
    if (name.includes('F1') || name.includes('Racing')) return '🏎️';
    if (name.includes('Premier League') || name.includes('Football') || name.includes('LaLiga')) return '⚽';
    if (name.includes('Tennis')) return '🎾';
    if (name.includes('Golf')) return '⛳';
    if (name.includes('Cricket')) return '🏏';
    if (name.includes('Action')) return '💥';
    if (name.includes('Horror') || name.includes('Sci-Fi')) return '🛸';
    if (name.includes('Comedy')) return '🎭';
    if (name.includes('Crime')) return '🔍';
    if (name.includes('Drama') || name.includes('Atlantic')) return '🎬';
    if (name.includes('News')) return '📡';
    if (name.includes('Arts')) return '🎨';
    if (name.includes('History')) return '🏛️';
    if (ch.category === 'Cinema') return '🍿';
    return '📺';
  }

  isSportsChannel(c) {
    if (!c) return false;
    const cat = (c.category || '').toLowerCase();
    const name = (c.name || '').toLowerCase();
    const genre = (c.genre || '').toLowerCase();
    const id = (c.id || '').toLowerCase();
    return cat === 'sports' || 
           name.includes('sport') || 
           name.includes('premier league') || 
           name.includes('laliga') || 
           name.includes('tnt') || 
           name.includes('racing') || 
           name.includes('rally') || 
           name.includes('cricket') || 
           name.includes('golf') || 
           name.includes('tennis') || 
           id.includes('sport') ||
           id.includes('f1') ||
           id.includes('tnt') ||
           id.includes('racing') ||
           id.includes('rally') ||
           id.includes('cricket') ||
           id.includes('golf') ||
           id.includes('tennis') ||
           genre.includes('motorsport') ||
           genre.includes('football') ||
           genre.includes('racing') ||
           genre.includes('cricket') ||
           genre.includes('golf') ||
           genre.includes('tennis') ||
           genre.includes('sports');
  }

  getHomeChannels() {
    return (window.IVTV_DATA?.channels || []).filter(c => !this.isSportsChannel(c));
  }

  // ==========================================================================
  // CHANNEL CARD BACKDROP RESOLVER (RELEVANT CINEMATIC BROADCAST IMAGES)
  // ==========================================================================

  getChannelBackdrop(ch) {
    if (ch.backdrop) return ch.backdrop;
    const id = (ch.id || '').toLowerCase();
    const cat = (ch.category || '').toLowerCase();
    const genre = (ch.genre || '').toLowerCase();

    if (id.includes('f1') || id.includes('racing') || genre.includes('motorsport')) {
      return 'assets/images/cards/card-f1.jpg';
    }
    if (id.includes('premier-league') || id.includes('football') || id.includes('main-event') || id.includes('tnt') || genre.includes('football')) {
      return 'assets/images/cards/card-stadium.jpg';
    }
    if (cat === 'sports' || genre.includes('tennis') || genre.includes('golf') || genre.includes('cricket') || genre.includes('combat') || genre.includes('action')) {
      return 'assets/images/cards/card-sports.jpg';
    }
    if (id.includes('bloomberg') || genre.includes('financial') || genre.includes('market')) {
      return 'assets/images/cards/card-finance.jpg';
    }
    if (cat === 'news' || id.includes('cnn') || id.includes('sky-news') || id.includes('fox') || id.includes('msnbc') || id.includes('russia-today') || id.includes('rt') || genre.includes('news')) {
      return 'assets/images/cards/card-newsroom.jpg';
    }
    if (id.includes('nature') || id.includes('documentar') || id.includes('history') || genre.includes('nature') || genre.includes('wildlife') || genre.includes('factual')) {
      return 'assets/images/cards/card-nature.jpg';
    }
    if (id.includes('sci-fi') || id.includes('scifi') || genre.includes('sci-fi')) {
      return 'assets/images/cards/card-scifi.jpg';
    }
    if (id.includes('action') || genre.includes('action') || genre.includes('thriller')) {
      return 'assets/images/cards/card-action.jpg';
    }
    if (cat === 'cinema') {
      return 'assets/images/cards/card-cinema.jpg';
    }
    if (cat === 'entertainment' || id.includes('atlantic') || id.includes('showcase') || id.includes('max') || id.includes('hbo') || id.includes('channel')) {
      return 'assets/images/cards/card-drama.jpg';
    }
    return 'assets/images/cards/card-cinema.jpg';
  }

  // ==========================================================================
  // CHANNEL CARD BUILDER WITH ACCURATE LIVE BROADCAST METADATA
  // ==========================================================================

  buildChannelCardInner(ch, isFav, rank = null, isDraggable = false) {
    const icon = this.getChannelIcon(ch);
    const prog = window.ivtvEPG ? window.ivtvEPG.getCurrentProgram(ch.id) : null;
    const progTitle = prog ? prog.title : 'Live Television Broadcast';
    const progTime = prog ? `${prog.startTimeFormatted} - ${prog.endTimeFormatted}` : '24/7 Live HD';
    const progLeft = prog ? `${prog.minutesLeft}m left` : 'Live';
    const progPercent = prog ? (prog.progressPercent || 35) : 35;
    const chNum = ch.chNumber ? `CH ${ch.chNumber}` : '';
    const logoSrc = ch.logo || (ch.logoUrl || '');
    const fallbackLogoSrc = ch.logoUrl || '';
    const backdropSrc = this.getChannelBackdrop(ch);

    const liveBadge = rank
      ? `<span class="card-live-chip most-viewed-pill"><span class="live-pulse-dot" style="width:5px;height:5px;"></span> #${rank} MOST VIEWED</span>`
      : `<span class="card-live-chip"><span class="live-pulse-dot" style="width:5px;height:5px;"></span> LIVE</span>`;

    const dragBadge = isDraggable
      ? `<span class="card-drag-chip" title="Drag to rearrange position">
           <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="8" cy="6" r="2.2"/><circle cx="16" cy="6" r="2.2"/><circle cx="8" cy="12" r="2.2"/><circle cx="16" cy="12" r="2.2"/><circle cx="8" cy="18" r="2.2"/><circle cx="16" cy="18" r="2.2"/></svg>
           <span>DRAG</span>
         </span>`
      : '';

    const viewsBadge = rank
      ? `<span class="card-views-count highlight-views">🔥 ${ch.views} viewers</span>`
      : `<span class="card-views-count">👁 ${ch.views}</span>`;

    return `
      <div class="card-media">
        <div class="card-media-bg card-media-logo-wrap">
          <img class="card-bg-backdrop-img" src="${backdropSrc}" alt="${ch.name} Broadcast" loading="lazy">
          <div class="card-backdrop-overlay"></div>
          <div class="card-logo-ambient-glow" style="background: ${ch.gradient};"></div>
          <div class="card-logo-emblem-plate">
            <img class="card-channel-logo-img" 
                 src="${logoSrc}" 
                 alt="${ch.name} Logo" 
                 loading="lazy"
                 onerror="if (this.dataset.fb !== '1' && '${fallbackLogoSrc}') { this.dataset.fb = '1'; this.src = '${fallbackLogoSrc}'; } else { this.style.display='none'; this.nextElementSibling.style.display='flex'; }">
            <div class="card-logo-fallback-badge" style="display: none;">
              <span style="font-size: 1.6rem; filter: drop-shadow(0 2px 6px rgba(0,0,0,0.6));">${icon}</span>
              <span style="text-shadow: 0 2px 8px rgba(0,0,0,0.7);">${ch.name}</span>
            </div>
          </div>
        </div>
        <div class="card-media-overlay">
          <div class="card-play-icon">
            <svg width="18" height="18" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </div>
        </div>
        <div class="card-top-badges">
          <div class="card-top-badges-left">
            ${liveBadge}
            ${dragBadge}
          </div>
          <button class="card-fav-btn ${isFav ? 'active' : ''}" title="${isFav ? 'Remove from Watchlist' : 'Add to Watchlist'}" onclick="event.stopPropagation(); window.UIControllerInstance.handleFavClick('${ch.id}', this)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          </button>
        </div>
      </div>
      <div class="card-body">
        <div class="card-header-line">
          <span class="card-title">${ch.name}</span>
          ${chNum ? `<span class="card-ch-num-badge">${chNum}</span>` : ''}
        </div>

        <!-- Real-Time Broadcast Programme Details -->
        <div class="card-live-now-block">
          <div class="card-now-playing-title" title="${progTitle}">
            <span class="card-now-pulse-dot"></span>
            <span class="card-now-text">${progTitle}</span>
          </div>
          <div class="card-prog-meta-row">
            <span class="card-prog-time">${progTime}</span>
            <span class="card-prog-remaining">${progLeft}</span>
          </div>
          <div class="card-prog-progress-wrap">
            <div class="card-prog-progress-fill" style="width: ${progPercent}%;"></div>
          </div>
        </div>

        <div class="card-subinfo">
          <span class="card-category-tag">${ch.genre || ch.category}</span>
          ${viewsBadge}
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // TOP RANKED CHANNELS WITH GIANT OUTLINED NUMERALS (1, 2, 3...)
  // ==========================================================================

  renderTopRanked() {
    const track = document.getElementById('ranked-channels-track');
    if (!track) return;

    // Strictly non-sports channels sorted by views descending
    const sorted = this.getHomeChannels()
      .sort((a, b) => (b.viewsNum || 0) - (a.viewsNum || 0))
      .slice(0, 10);

    track.innerHTML = sorted.map((ch, index) => {
      const isFav = window.ivtvStorage && window.ivtvStorage.isFavorite(ch.id);
      const rank = index + 1;
      return this.buildRankedPosterCard(ch, rank, isFav);
    }).join('');

    this.initCarouselMouseNavigation();
  }

  buildRankedPosterCard(ch, rank, isFav) {
    const icon = this.getChannelIcon(ch);
    const chNum = ch.chNumber ? `CH ${ch.chNumber}` : '';
    const logoSrc = ch.logo || (ch.logoUrl || '');
    const fallbackLogoSrc = ch.logoUrl || '';
    const backdropSrc = this.getChannelBackdrop(ch);

    return `
      <div class="ranked-card-wrapper" data-channel-id="${ch.id}">
        <div class="giant-rank-numeral rank-${rank}">${rank}</div>
        <div class="ranked-poster-item" onclick="window.ivtvPlayer.openPlayer('${ch.id}')">
          <div class="ranked-poster-media">
            <div class="card-media-bg card-media-logo-wrap">
              <img class="card-bg-backdrop-img" src="${backdropSrc}" alt="${ch.name} Broadcast" loading="lazy">
              <div class="card-backdrop-overlay"></div>
              <div class="card-logo-ambient-glow" style="background: ${ch.gradient};"></div>
              <div class="card-logo-emblem-plate">
                <img class="card-channel-logo-img" 
                     src="${logoSrc}" 
                     alt="${ch.name} Logo" 
                     loading="lazy"
                     onerror="if (this.dataset.fb !== '1' && '${fallbackLogoSrc}') { this.dataset.fb = '1'; this.src = '${fallbackLogoSrc}'; } else { this.style.display='none'; this.nextElementSibling.style.display='flex'; }">
                <div class="card-logo-fallback-badge" style="display: none;">
                  <span style="font-size: 1.6rem;">${icon}</span>
                  <span>${ch.name}</span>
                </div>
              </div>
            </div>
            <div class="card-media-overlay">
              <div class="card-play-icon">
                <svg width="20" height="20" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              </div>
            </div>
            <div class="ranked-badge-overlay">
              <span class="ranked-pill">#${rank}</span>
            </div>
            <button class="card-fav-btn ${isFav ? 'active' : ''}" title="${isFav ? 'Remove from Watchlist' : 'Add to Watchlist'}" onclick="event.stopPropagation(); window.UIControllerInstance.handleFavClick('${ch.id}', this)">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            </button>
          </div>
          <div class="ranked-poster-meta">
            <div class="ranked-poster-title">${ch.name}</div>
            <div class="ranked-poster-sub">
              <span class="ranked-cat">${ch.category}</span>
              ${chNum ? `<span class="ranked-chnum">${chNum}</span>` : ''}
              <span class="ranked-views">🔥 ${ch.views}</span>
              <span class="ranked-rating">★ ${ch.rating || 4.9}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // STREAMING PROVIDERS / NETWORK PILLS BAR
  // ==========================================================================

  renderProvidersBar() {
    const bar = document.getElementById('providers-bar');
    if (!bar) return;

    bar.innerHTML = window.IVTV_DATA.networks.map(net => {
      const iconContent = net.icon 
        ? `<img src="${net.icon}" class="provider-logo-img" alt="${net.name}" onerror="this.outerHTML='${net.name.charAt(0)}'">` 
        : net.name.charAt(0);

      return `
        <button class="provider-badge-btn ${this.activeFilter === net.id ? 'active' : ''}" data-filter="${net.id}">
          <div class="provider-logo-circle ${net.badgeClass || ''}">${iconContent}</div>
          <span>${net.name}</span>
        </button>
      `;
    }).join('');

    bar.querySelectorAll('.provider-badge-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeFilter = btn.dataset.filter;
        this.renderProvidersBar();
        this.applyFilter();
      });
    });
  }

  // ==========================================================================
  // ==========================================================================
  // WATCH LIVE CHANNELS COMPLETE DIRECTORY CONTROLLER
  // ==========================================================================

  getDefaultLiveChannelsOrder() {
    return this.getHomeChannels().map(c => c.id);
  }

  getLiveChannelsOrder() {
    const defaultOrder = this.getDefaultLiveChannelsOrder();
    try {
      const saved = localStorage.getItem('ivtv_live_channels_order');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const list = parsed.filter(id => {
            const ch = window.IVTV_DATA?.channels?.find(c => c.id === id);
            return ch && !this.isSportsChannel(ch);
          });
          defaultOrder.forEach(id => {
            if (!list.includes(id)) list.push(id);
          });
          return list;
        }
      }
    } catch (e) {
      console.warn('Failed to parse saved live channels order:', e);
    }
    return defaultOrder;
  }

  saveLiveChannelsOrder(orderArray) {
    try {
      localStorage.setItem('ivtv_live_channels_order', JSON.stringify(orderArray));
    } catch (e) {
      console.warn('Failed to save live channels order:', e);
    }
  }

  resetLiveChannelsOrder() {
    try {
      localStorage.removeItem('ivtv_live_channels_order');
    } catch (e) {}
    this.renderAllUKChannels();
    if (window.showToast) {
      window.showToast('Watch Live Channels order reset to default', 'info');
    }
  }

  renderAllUKChannels() {
    const grid = document.getElementById('all-channels-grid');
    const track = document.getElementById('all-channels-track');
    const carouselWrapper = document.getElementById('all-channels-carousel-wrapper');
    const emptyState = document.getElementById('all-channels-empty');
    const statusText = document.getElementById('all-channels-status-text');
    const counterBadge = document.getElementById('all-uk-channels-counter');

    if (!grid) return;

    let channels = this.getHomeChannels();

    // Filter by Category
    if (this.allChannelsCategory === 'most-viewed') {
      channels.sort((a, b) => (b.viewsNum || 0) - (a.viewsNum || 0));
      channels = channels.slice(0, 10);
    } else if (this.allChannelsCategory === 'freeview') {
      const fvOrder = this.getFreeviewOrder();
      channels = fvOrder
        .map(id => window.IVTV_DATA?.channels?.find(c => c.id === id && !this.isSportsChannel(c)))
        .filter(Boolean);
    } else if (this.allChannelsCategory && this.allChannelsCategory !== 'all') {
      channels = channels.filter(ch => ch.category === this.allChannelsCategory && !this.isSportsChannel(ch));
    } else {
      // 'all' category: respect user's custom dragged order if saved
      const savedOrder = this.getLiveChannelsOrder();
      const map = new Map(channels.map(c => [c.id, c]));
      const ordered = [];
      savedOrder.forEach(id => {
        if (map.has(id)) {
          ordered.push(map.get(id));
          map.delete(id);
        }
      });
      for (const ch of map.values()) {
        ordered.push(ch);
      }
      channels = ordered;
    }

    // Filter by In-Section Search Query
    if (this.allChannelsQuery) {
      const q = this.allChannelsQuery.toLowerCase().trim();
      channels = channels.filter(ch => {
        return ch.name.toLowerCase().includes(q) ||
               (ch.chNumber && ch.chNumber.toString().includes(q)) ||
               (ch.genre && ch.genre.toLowerCase().includes(q)) ||
               (ch.category && ch.category.toLowerCase().includes(q)) ||
               (Array.isArray(ch.tags) && ch.tags.some(t => t.toLowerCase().includes(q)));
      });
    }

    // Sort Channels (apply when sort dropdown changed)
    if (this.allChannelsCategory === 'most-viewed') {
      channels.sort((a, b) => (b.viewsNum || 0) - (a.viewsNum || 0));
    } else if (this.allChannelsSort === 'views') {
      channels.sort((a, b) => (b.viewsNum || 0) - (a.viewsNum || 0));
    } else if (this.allChannelsSort === 'name') {
      channels.sort((a, b) => a.name.localeCompare(b.name));
    } else if (this.allChannelsSort === 'rating') {
      channels.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (this.allChannelsSort === 'lcn' && this.allChannelsCategory !== 'all') {
      channels.sort((a, b) => (a.chNumber || 999) - (b.chNumber || 999));
    }

    // Update Counts & Badges
    const totalCount = this.getHomeChannels().length;
    if (counterBadge) {
      counterBadge.textContent = `${totalCount} Live Channels`;
    }
    if (statusText) {
      statusText.textContent = `Showing ${channels.length} of ${totalCount} UK Channels`;
    }

    // Update Pill Count Badges
    const mostViewedCount = 10;
    const freeviewCount = this.getDefaultFreeviewOrder().length;
    const cinemaCount = this.getHomeChannels().filter(c => c.category === 'Cinema').length;
    const entCount = this.getHomeChannels().filter(c => c.category === 'Entertainment').length;
    const newsCount = this.getHomeChannels().filter(c => c.category === 'News').length;

    const countAll = document.getElementById('count-pill-all');
    const countMostViewed = document.getElementById('count-pill-most-viewed');
    const countFreeview = document.getElementById('count-pill-freeview');
    const countCinema = document.getElementById('count-pill-cinema');
    const countEnt = document.getElementById('count-pill-entertainment');
    const countNews = document.getElementById('count-pill-news');

    if (countAll) countAll.textContent = totalCount;
    if (countMostViewed) countMostViewed.textContent = mostViewedCount;
    if (countFreeview) countFreeview.textContent = freeviewCount;
    if (countCinema) countCinema.textContent = cinemaCount;
    if (countEnt) countEnt.textContent = entCount;
    if (countNews) countNews.textContent = newsCount;

    // Handle Empty State
    if (channels.length === 0) {
      if (grid) grid.style.display = 'none';
      if (carouselWrapper) carouselWrapper.style.display = 'none';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    // Render Cards HTML (Draggable cards with drag indicator)
    const isSortingByViews = this.allChannelsSort === 'views' || this.allChannelsCategory === 'most-viewed';
    const cardsHtml = channels.map((ch, idx) => {
      const isFav = window.ivtvStorage && window.ivtvStorage.isFavorite(ch.id);
      const rank = isSortingByViews ? (idx + 1) : null;
      return `
        <div class="channel-card live-channels-draggable-card" 
             draggable="true" 
             data-channel-id="${ch.id}" 
             data-index="${idx}"
             title="Drag to rearrange position • Click to watch"
             onclick="if(!window.UIControllerInstance?.justDraggedLiveChannels) window.ivtvPlayer?.openPlayer('${ch.id}')">
          ${this.buildChannelCardInner(ch, isFav, rank, true)}
        </div>
      `;
    }).join('');

    // Update Layout Mode (Grid vs Carousel)
    if (this.allChannelsView === 'carousel') {
      if (grid) grid.style.display = 'none';
      if (carouselWrapper) {
        carouselWrapper.style.display = 'block';
        if (track) {
          track.classList.add('live-channels-drag-track');
          track.innerHTML = cardsHtml;
          this.setupLiveChannelsDragAndDrop(track);
        }
      }
    } else {
      if (carouselWrapper) carouselWrapper.style.display = 'none';
      if (grid) {
        grid.style.display = 'grid';
        grid.classList.add('live-channels-drag-track');
        grid.innerHTML = cardsHtml;
        this.setupLiveChannelsDragAndDrop(grid);
      }
    }

    this.initCarouselMouseNavigation();
  }

  setupLiveChannelsDragAndDrop(container) {
    if (!container) return;

    let draggedCard = null;
    let isDragging = false;
    let dragJustEnded = false;

    const cards = container.querySelectorAll('.live-channels-draggable-card');

    cards.forEach(card => {
      // Desktop HTML5 Drag Start
      card.addEventListener('dragstart', (e) => {
        draggedCard = card;
        isDragging = true;
        dragJustEnded = false;
        this.justDraggedLiveChannels = true;
        card.classList.add('is-dragging-card');
        container.classList.add('track-is-reordering');

        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          try {
            e.dataTransfer.setData('text/plain', card.dataset.channelId || '');
          } catch (err) {}
        }

        setTimeout(() => {
          if (card.classList.contains('is-dragging-card')) {
            card.classList.add('drag-ghost');
          }
        }, 10);
      });

      // Drag End
      card.addEventListener('dragend', () => {
        if (draggedCard) {
          draggedCard.classList.remove('is-dragging-card', 'drag-ghost');
        }
        container.classList.remove('track-is-reordering');

        // Persist current DOM order
        const newOrder = [...container.querySelectorAll('.live-channels-draggable-card')].map(c => c.dataset.channelId).filter(Boolean);
        this.saveLiveChannelsOrder(newOrder);

        isDragging = false;
        dragJustEnded = true;
        draggedCard = null;

        setTimeout(() => {
          dragJustEnded = false;
          this.justDraggedLiveChannels = false;
        }, 250);
      });

      // Drag Over on card
      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'move';
        }

        if (!draggedCard || draggedCard === card) return;

        const rect = card.getBoundingClientRect();
        const midPoint = rect.left + rect.width / 2;

        if (e.clientX < midPoint) {
          if (card.previousElementSibling !== draggedCard) {
            container.insertBefore(draggedCard, card);
          }
        } else {
          if (card.nextElementSibling !== draggedCard) {
            container.insertBefore(draggedCard, card.nextElementSibling);
          }
        }
      });

      card.addEventListener('drop', (e) => {
        e.preventDefault();
        if (window.showToast) {
          window.showToast('Watch Live channel order updated', 'info');
        }
      });

      // Mobile Touch Drag Support
      let touchStartX = 0;
      let touchStartY = 0;
      let touchMoved = false;

      card.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1 || e.target.closest('.card-fav-btn')) return;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchMoved = false;
      }, { passive: true });

      card.addEventListener('touchmove', (e) => {
        if (!e.touches || e.touches.length !== 1) return;
        const touch = e.touches[0];
        const dx = touch.clientX - touchStartX;
        const dy = touch.clientY - touchStartY;

        if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) {
          touchMoved = true;
          this.justDraggedLiveChannels = true;
          card.classList.add('is-dragging-card');

          const elemBelow = document.elementFromPoint(touch.clientX, touch.clientY);
          const targetCard = elemBelow ? elemBelow.closest('.live-channels-draggable-card') : null;
          if (targetCard && targetCard !== card && targetCard.parentElement === container) {
            const rect = targetCard.getBoundingClientRect();
            const midPoint = rect.left + rect.width / 2;
            if (touch.clientX < midPoint) {
              if (targetCard.previousElementSibling !== card) {
                container.insertBefore(card, targetCard);
              }
            } else {
              if (targetCard.nextElementSibling !== card) {
                container.insertBefore(card, targetCard.nextElementSibling);
              }
            }
          }
        }
      }, { passive: true });

      card.addEventListener('touchend', () => {
        if (touchMoved) {
          card.classList.remove('is-dragging-card');
          const newOrder = [...container.querySelectorAll('.live-channels-draggable-card')].map(c => c.dataset.channelId).filter(Boolean);
          this.saveLiveChannelsOrder(newOrder);
          setTimeout(() => {
            this.justDraggedLiveChannels = false;
          }, 250);
        }
        touchMoved = false;
      });
    });

    container.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'move';
      }
    });
  }

  setupAllChannelsEventListeners() {
    // Reset Order Button
    const resetOrderBtn = document.getElementById('live-channels-reset-order-btn');
    if (resetOrderBtn) {
      resetOrderBtn.addEventListener('click', () => {
        this.resetLiveChannelsOrder();
      });
    }

    // View Toggle Buttons (Grid vs Carousel)
    const btnGrid = document.getElementById('view-toggle-grid');
    const btnCarousel = document.getElementById('view-toggle-carousel');

    if (btnGrid) {
      btnGrid.addEventListener('click', () => {
        btnGrid.classList.add('active');
        btnCarousel?.classList.remove('active');
        this.allChannelsView = 'grid';
        this.renderAllUKChannels();
      });
    }

    if (btnCarousel) {
      btnCarousel.addEventListener('click', () => {
        btnCarousel.classList.add('active');
        btnGrid?.classList.remove('active');
        this.allChannelsView = 'carousel';
        this.renderAllUKChannels();
      });
    }

    // Sort Dropdown
    const sortSelect = document.getElementById('all-channels-sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.allChannelsSort = e.target.value;
        this.renderAllUKChannels();
      });
    }

    // Subfilter Category Pills
    const filterPills = document.querySelectorAll('#all-channels-filter-pills .filter-pill');
    filterPills.forEach(pill => {
      pill.addEventListener('click', () => {
        filterPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.allChannelsCategory = pill.dataset.category;
        this.renderAllUKChannels();
      });
    });

    // In-Section Quick Search Input
    const quickInput = document.getElementById('all-channels-quick-input');
    const quickClear = document.getElementById('all-channels-quick-clear');

    if (quickInput) {
      quickInput.addEventListener('input', (e) => {
        this.allChannelsQuery = e.target.value;
        if (quickClear) {
          quickClear.style.display = this.allChannelsQuery ? 'flex' : 'none';
        }
        this.renderAllUKChannels();
      });
    }

    if (quickClear) {
      quickClear.addEventListener('click', () => {
        if (quickInput) quickInput.value = '';
        this.allChannelsQuery = '';
        quickClear.style.display = 'none';
        this.renderAllUKChannels();
      });
    }
  }

  resetAllChannelsFilters() {
    this.allChannelsCategory = 'all';
    this.allChannelsQuery = '';
    const quickInput = document.getElementById('all-channels-quick-input');
    const quickClear = document.getElementById('all-channels-quick-clear');
    if (quickInput) quickInput.value = '';
    if (quickClear) quickClear.style.display = 'none';

    document.querySelectorAll('#all-channels-filter-pills .filter-pill').forEach(p => {
      p.classList.toggle('active', p.dataset.category === 'all');
    });

    this.renderAllUKChannels();
  }

  // ==========================================================================
  // US TV DIRECTORY
  // ==========================================================================

  renderUsTvDirectory(query = '') {
    const railsContainer = document.getElementById('us-tv-rails');
    const count = document.getElementById('us-tv-channel-count');
    const empty = document.getElementById('us-tv-empty');
    if (!railsContainer) return;

    const channels = window.IVTV_US_TV_CHANNELS || [];
    const groups = window.IVTV_US_TV_GROUPS || [];
    const normalizedQuery = query.trim().toLowerCase();
    const filteredChannels = channels.filter(channel =>
      `${channel.name} ${channel.category}`.toLowerCase().includes(normalizedQuery)
    );
    const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[char]);

    if (count) {
      count.textContent = normalizedQuery
        ? `${filteredChannels.length} of ${channels.length} Channels`
        : `${channels.length} Channels`;
    }
    if (empty) empty.hidden = filteredChannels.length > 0;

    railsContainer.innerHTML = groups.map(group => {
      const groupChannels = filteredChannels.filter(channel => group.slugs.includes(channel.slug));
      if (groupChannels.length === 0) return '';

      const trackId = `us-tv-track-${group.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      const headingId = `${trackId}-heading`;
      const cards = groupChannels.map(channel => {
        const logoUrl = channel.logoUrl.replace('/512px-', '/500px-');
        const fallbackDomain = window.IVTV_US_TV_LOGO_FALLBACK_DOMAINS?.[channel.slug];
        const fallbackUrl = fallbackDomain
          ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(fallbackDomain)}&sz=128`
          : '';
        return `
          <article class="us-tv-card" role="listitem">
            <div class="us-tv-card-media">
              <span class="us-tv-card-tag">US CHANNEL</span>
              <div class="us-tv-logo-plate" aria-hidden="true">
                <span class="us-tv-logo-fallback">${escapeHtml(channel.name.slice(0, 2).toUpperCase())}</span>
                <img src="${escapeHtml(logoUrl)}" alt="" loading="lazy" decoding="async" data-fallback-src="${escapeHtml(fallbackUrl)}" onerror="if(this.dataset.fallbackSrc &amp;&amp; !this.dataset.fallback){this.dataset.fallback='1';this.src=this.dataset.fallbackSrc}else{this.remove()}">
              </div>
              <div class="us-tv-media-shade"></div>
            </div>
            <div class="us-tv-card-copy">
              <h4>${escapeHtml(channel.name)}</h4>
              <p>${escapeHtml(channel.category)}</p>
            </div>
          </article>
        `;
      }).join('');

      return `
        <section class="us-tv-category-row" aria-labelledby="${headingId}">
          <div class="us-tv-category-heading">
            <h3 id="${headingId}">${escapeHtml(group.name)}</h3>
            <span class="us-tv-category-count">${groupChannels.length}</span>
          </div>
          <div class="carousel-track-wrapper">
            <button class="carousel-nav-btn prev" data-target="${trackId}" title="Previous ${escapeHtml(group.name)} channels" aria-label="Scroll ${escapeHtml(group.name)} channels left">‹</button>
            <div class="carousel-track us-tv-rail-track" id="${trackId}" role="list" aria-labelledby="${headingId}" tabindex="0">
              ${cards}
            </div>
            <button class="carousel-nav-btn next" data-target="${trackId}" title="Next ${escapeHtml(group.name)} channels" aria-label="Scroll ${escapeHtml(group.name)} channels right">›</button>
          </div>
        </section>
      `;
    }).join('');

    this.initCarouselMouseNavigation();
  }

  // ==========================================================================
  // CATEGORY CAROUSEL ROWS
  // ==========================================================================

  renderCategorySections() {
    this.renderFreeviewSection();
    this.renderSkyChannels(this.skySubfilter || 'all');
    this.renderNewsSection();
    this.renderRow('cinema-track', ch => ch.category === 'Cinema');
    this.renderRow('entertainment-track', ch => ch.category === 'Entertainment');
    this.renderFavoritesRow();
    this.initCarouselMouseNavigation();
  }

  // ==========================================================================
  // UK FREEVIEW & TERRESTRIAL SECTION (DRAGGABLE & REORDERABLE)
  // Default Order: BBC 1, ITV1, Channel 4, Channel 5, then other BBC channels,
  // followed by ITV2, ITV3, ITV4, Film4, Sky News, GB News.
  // ==========================================================================

  getDefaultFreeviewOrder() {
    return [
      'bbc-one-uk',
      'itv1-uk',
      'channel4',
      'channel5',
      'bbc-two-uk',
      'bbc-three-uk',
      'bbc-news-uk',
      'itv2-uk',
      'itv3-uk',
      'itv4-uk',
      'film4-uk',
      'sky-news',
      'gb-news'
    ];
  }

  getFreeviewOrder() {
    const defaultOrder = this.getDefaultFreeviewOrder();
    try {
      const saved = localStorage.getItem('ivtv_freeview_order');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const list = [...parsed];
          defaultOrder.forEach(id => {
            if (!list.includes(id)) list.push(id);
          });
          return list;
        }
      }
    } catch (e) {
      console.warn('Failed to parse saved Freeview order:', e);
    }
    return defaultOrder;
  }

  saveFreeviewOrder(orderArray) {
    try {
      localStorage.setItem('ivtv_freeview_order', JSON.stringify(orderArray));
    } catch (e) {
      console.warn('Failed to save Freeview order:', e);
    }
  }

  resetFreeviewOrder() {
    try {
      localStorage.removeItem('ivtv_freeview_order');
    } catch (e) {}
    this.renderFreeviewSection();
    if (window.showToast) {
      window.showToast('Freeview order reset to default (BBC 1, ITV1, Channel 4, Channel 5...)', 'info');
    }
  }

  renderFreeviewSection() {
    const track = document.getElementById('freeview-track');
    if (!track) return;

    const order = this.getFreeviewOrder();
    const channels = order
      .map(id => window.IVTV_DATA?.channels?.find(c => c.id === id && !this.isSportsChannel(c)))
      .filter(Boolean);

    const counter = document.getElementById('freeview-channels-counter');
    if (counter) counter.textContent = `${channels.length} Channels`;

    track.innerHTML = channels.map((ch, idx) => {
      const isFav = window.ivtvStorage && window.ivtvStorage.isFavorite(ch.id);
      return `
        <div class="channel-card freeview-draggable-card" 
             draggable="true" 
             data-channel-id="${ch.id}" 
             data-index="${idx}"
             title="Drag to rearrange position • Click to watch">
          ${this.buildChannelCardInner(ch, isFav, null, true)}
        </div>
      `;
    }).join('');

    this.setupFreeviewDragAndDrop(track);
    this.initCarouselMouseNavigation();
  }

  setupFreeviewDragAndDrop(track) {
    if (!track) return;

    let draggedCard = null;
    let isDragging = false;
    let dragJustEnded = false;

    const cards = track.querySelectorAll('.freeview-draggable-card');

    cards.forEach(card => {
      // Click handling on card: ONLY open player if NOT dragged!
      card.addEventListener('click', (e) => {
        if (dragJustEnded || isDragging || this.justDraggedFreeview) {
          e.stopImmediatePropagation();
          e.preventDefault();
          return;
        }
        if (e.target.closest('.card-fav-btn')) return;
        const chId = card.dataset.channelId;
        if (chId && window.ivtvPlayer) {
          window.ivtvPlayer.openPlayer(chId);
        }
      });

      // Desktop HTML5 Drag Start
      card.addEventListener('dragstart', (e) => {
        draggedCard = card;
        isDragging = true;
        dragJustEnded = false;
        this.justDraggedFreeview = true;
        card.classList.add('is-dragging-card');
        track.classList.add('track-is-reordering');

        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', card.dataset.channelId);

        setTimeout(() => {
          if (card.classList.contains('is-dragging-card')) {
            card.classList.add('drag-ghost');
          }
        }, 10);
      });

      // Drag End
      card.addEventListener('dragend', () => {
        if (draggedCard) {
          draggedCard.classList.remove('is-dragging-card', 'drag-ghost');
        }
        track.classList.remove('track-is-reordering');

        // Persist current DOM order
        const newOrder = [...track.querySelectorAll('.freeview-draggable-card')].map(c => c.dataset.channelId);
        this.saveFreeviewOrder(newOrder);

        isDragging = false;
        dragJustEnded = true;
        this.justDraggedFreeview = true;
        draggedCard = null;

        setTimeout(() => {
          dragJustEnded = false;
          this.justDraggedFreeview = false;
        }, 200);
      });

      // Drag Over on card
      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        if (!draggedCard || draggedCard === card) return;

        const rect = card.getBoundingClientRect();
        const midPoint = rect.left + rect.width / 2;

        if (e.clientX < midPoint) {
          if (card.previousElementSibling !== draggedCard) {
            track.insertBefore(draggedCard, card);
          }
        } else {
          if (card.nextElementSibling !== draggedCard) {
            track.insertBefore(draggedCard, card.nextElementSibling);
          }
        }
      });

      card.addEventListener('drop', (e) => {
        e.preventDefault();
        if (window.showToast) {
          window.showToast('Freeview channel order updated', 'info');
        }
      });

      // Mobile Touch Drag Support
      let touchStartX = 0;
      let touchStartY = 0;
      let touchMoved = false;

      card.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1 || e.target.closest('.card-fav-btn')) return;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchMoved = false;
      }, { passive: true });

      card.addEventListener('touchmove', (e) => {
        if (!e.touches || e.touches.length !== 1) return;
        const touch = e.touches[0];
        const dx = touch.clientX - touchStartX;
        const dy = touch.clientY - touchStartY;

        if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) {
          touchMoved = true;
          this.justDraggedFreeview = true;
          card.classList.add('is-dragging-card');

          const elemBelow = document.elementFromPoint(touch.clientX, touch.clientY);
          const targetCard = elemBelow ? elemBelow.closest('.freeview-draggable-card') : null;
          if (targetCard && targetCard !== card && targetCard.parentElement === track) {
            const rect = targetCard.getBoundingClientRect();
            const midPoint = rect.left + rect.width / 2;
            if (touch.clientX < midPoint) {
              if (targetCard.previousElementSibling !== card) {
                track.insertBefore(card, targetCard);
              }
            } else {
              if (targetCard.nextElementSibling !== card) {
                track.insertBefore(card, targetCard.nextElementSibling);
              }
            }
          }
        }
      }, { passive: true });

      card.addEventListener('touchend', () => {
        if (touchMoved) {
          card.classList.remove('is-dragging-card');
          const newOrder = [...track.querySelectorAll('.freeview-draggable-card')].map(c => c.dataset.channelId);
          this.saveFreeviewOrder(newOrder);
          setTimeout(() => {
            this.justDraggedFreeview = false;
          }, 250);
        }
        touchMoved = false;
      });
    });

    track.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });
  }

  renderSkyChannels(subfilter = 'all') {
    this.skySubfilter = subfilter;
    const track = document.getElementById('sky-channels-track');
    if (!track) return;

    let skyChannels = this.getHomeChannels().filter(c => {
      const name = c.name.toLowerCase();
      const id = c.id.toLowerCase();
      return name.includes('sky') || id.includes('sky');
    });

    if (subfilter === 'Cinema') {
      skyChannels = skyChannels.filter(c => c.category === 'Cinema' || c.name.toLowerCase().includes('cinema'));
    } else if (subfilter === 'Entertainment') {
      skyChannels = skyChannels.filter(c => c.category === 'Entertainment' || c.name.includes('Atlantic') || c.name.includes('Showcase') || c.name.includes('Max') || c.name.includes('Comedy') || c.name.includes('Arts'));
    }

    const counter = document.getElementById('sky-channels-counter');
    if (counter) counter.textContent = `${skyChannels.length} Channels`;

    track.innerHTML = skyChannels.map(ch => {
      const isFav = window.ivtvStorage && window.ivtvStorage.isFavorite(ch.id);
      return `
        <div class="channel-card" data-channel-id="${ch.id}" onclick="window.ivtvPlayer.openPlayer('${ch.id}')">
          ${this.buildChannelCardInner(ch, isFav)}
        </div>
      `;
    }).join('');

    this.initCarouselMouseNavigation();
  }

  renderSportsSection(subfilter = 'all') {
    this.sportsSubfilter = subfilter;
    const track = document.getElementById('sports-track');
    if (!track) return;

    let sports = window.IVTV_DATA.channels.filter(c => c.category === 'Sports' || c.name.toLowerCase().includes('sport'));

    if (subfilter === 'Football') {
      sports = sports.filter(c => c.name.toLowerCase().includes('premier') || c.name.toLowerCase().includes('football') || c.name.toLowerCase().includes('laliga'));
    } else if (subfilter === 'F1') {
      sports = sports.filter(c => c.name.toLowerCase().includes('f1') || c.name.toLowerCase().includes('racing') || c.name.toLowerCase().includes('rally'));
    } else if (subfilter === 'Tennis') {
      sports = sports.filter(c => c.name.toLowerCase().includes('tennis'));
    } else if (subfilter === 'Action') {
      sports = sports.filter(c => c.name.toLowerCase().includes('action') || c.name.toLowerCase().includes('wwe') || c.name.toLowerCase().includes('extreme'));
    }

    const counter = document.getElementById('sports-channels-counter');
    if (counter) counter.textContent = `${sports.length} Channels`;

    track.innerHTML = sports.map(ch => {
      const isFav = window.ivtvStorage && window.ivtvStorage.isFavorite(ch.id);
      return `
        <div class="channel-card" data-channel-id="${ch.id}" onclick="window.ivtvPlayer.openPlayer('${ch.id}')">
          ${this.buildChannelCardInner(ch, isFav)}
        </div>
      `;
    }).join('');

    this.initCarouselMouseNavigation();
  }

  renderNewsSection() {
    const track = document.getElementById('news-track');
    if (!track) return;

    const news = this.getHomeChannels().filter(c => c.category === 'News' || c.name.toLowerCase().includes('news') || c.name.toLowerCase().includes('bloomberg') || c.name.toLowerCase().includes('cnbc') || c.name.toLowerCase().includes('cnn'));

    const counter = document.getElementById('news-channels-counter');
    if (counter) counter.textContent = `${news.length} Channels`;

    track.innerHTML = news.map(ch => {
      const isFav = window.ivtvStorage && window.ivtvStorage.isFavorite(ch.id);
      return `
        <div class="channel-card" data-channel-id="${ch.id}" onclick="window.ivtvPlayer.openPlayer('${ch.id}')">
          ${this.buildChannelCardInner(ch, isFav)}
        </div>
      `;
    }).join('');

    this.initCarouselMouseNavigation();
  }

  renderRow(containerId, filterFn) {
    const track = document.getElementById(containerId);
    if (!track) return;

    const channels = this.getHomeChannels().filter(filterFn);

    track.innerHTML = channels.map(ch => {
      const isFav = window.ivtvStorage && window.ivtvStorage.isFavorite(ch.id);
      return `
        <div class="channel-card" data-channel-id="${ch.id}" onclick="window.ivtvPlayer.openPlayer('${ch.id}')">
          ${this.buildChannelCardInner(ch, isFav)}
        </div>
      `;
    }).join('');
  }

  renderFavoritesRow() {
    const container = document.getElementById('favorites-section');
    const track = document.getElementById('favorites-track');
    const emptyState = document.getElementById('favorites-empty-state');
    const counterBadge = document.getElementById('favorites-counter-badge');
    const trackWrapper = container ? container.querySelector('.carousel-track-wrapper') : null;
    if (!container || !track) return;

    const favIds = window.ivtvStorage ? window.ivtvStorage.getFavorites() : [];
    const favChannels = this.getHomeChannels().filter(c => favIds.includes(c.id));

    container.style.display = 'block';

    if (favChannels.length === 0) {
      track.innerHTML = '';
      if (trackWrapper) trackWrapper.style.display = 'none';
      if (emptyState) emptyState.style.display = 'block';
      if (counterBadge) counterBadge.textContent = '0 Saved';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (trackWrapper) trackWrapper.style.display = 'block';
    if (counterBadge) {
      counterBadge.textContent = `${favChannels.length} ${favChannels.length === 1 ? 'Channel' : 'Channels'}`;
    }

    track.innerHTML = favChannels.map(ch => `
      <div class="channel-card" data-channel-id="${ch.id}" onclick="window.ivtvPlayer.openPlayer('${ch.id}')">
        ${this.buildChannelCardInner(ch, true)}
      </div>
    `).join('');

    this.initCarouselMouseNavigation();
  }

  // ==========================================================================
  // SEARCH & FILTERING LOGIC
  // ==========================================================================

  handleSearch(query) {
    this.searchQuery = query.toLowerCase().trim();
    const searchSection = document.getElementById('search-results-section');
    const searchGrid = document.getElementById('search-results-grid');
    const mainSections = document.getElementById('main-content-flow');

    if (!this.searchQuery) {
      if (searchSection) searchSection.classList.remove('active');
      if (mainSections) mainSections.style.display = 'block';
      return;
    }

    if (mainSections) mainSections.style.display = 'none';
    if (searchSection) searchSection.classList.add('active');

    const matches = this.getHomeChannels().filter(ch => {
      const q = this.searchQuery;
      return ch.name.toLowerCase().includes(q) ||
             (ch.chNumber && ch.chNumber.toString().includes(q)) ||
             ch.category.toLowerCase().includes(q) ||
             (ch.genre && ch.genre.toLowerCase().includes(q)) ||
             (Array.isArray(ch.tags) && ch.tags.some(t => t.toLowerCase().includes(q)));
    });

    const titleEl = document.getElementById('search-results-title');
    if (titleEl) {
      titleEl.textContent = `Search results for "${query}" (${matches.length})`;
    }

    if (searchGrid) {
      if (matches.length === 0) {
        searchGrid.innerHTML = `
          <div class="empty-state" style="grid-column: 1 / -1;">
            <div class="empty-state-icon">🔍</div>
            <div class="empty-state-title">No channels found</div>
            <div class="empty-state-desc">Try searching for "BBC", "ITV", "Sky Cinema", "Sky Atlantic", or channel numbers like "101"</div>
          </div>
        `;
      } else {
        searchGrid.innerHTML = matches.map(ch => {
          const isFav = window.ivtvStorage && window.ivtvStorage.isFavorite(ch.id);
          return `
            <div class="channel-card" style="flex: auto;" data-channel-id="${ch.id}" onclick="window.ivtvPlayer.openPlayer('${ch.id}')">
              ${this.buildChannelCardInner(ch, isFav)}
            </div>
          `;
        }).join('');
      }
    }
  }

  applyFilter() {
    const filter = this.activeFilter;
    const cinemaSection = document.getElementById('cinema-section');
    const entertainmentSection = document.getElementById('entertainment-section');
    const newsSection = document.getElementById('news-section');

    const showAll = () => {
      if (cinemaSection) cinemaSection.style.display = 'block';
      if (entertainmentSection) entertainmentSection.style.display = 'block';
      if (newsSection) newsSection.style.display = 'block';
    };

    if (filter === 'all') {
      showAll();
    } else if (filter === 'sky-cinema' || filter === 'film4' || filter === 'Cinema') {
      if (cinemaSection) cinemaSection.style.display = 'block';
      if (entertainmentSection) entertainmentSection.style.display = 'none';
      if (newsSection) newsSection.style.display = 'none';
      cinemaSection.scrollIntoView({ behavior: 'smooth' });
    } else if (filter === 'news-network' || filter === 'News' || filter === 'sky-news') {
      if (cinemaSection) cinemaSection.style.display = 'none';
      if (entertainmentSection) entertainmentSection.style.display = 'none';
      if (newsSection) newsSection.style.display = 'block';
      newsSection.scrollIntoView({ behavior: 'smooth' });
    } else {
      // Entertainment (BBC, ITV, Sky Atlantic, Sky Showcase, etc.)
      if (cinemaSection) cinemaSection.style.display = 'none';
      if (entertainmentSection) entertainmentSection.style.display = 'block';
      if (newsSection) newsSection.style.display = 'none';
      entertainmentSection.scrollIntoView({ behavior: 'smooth' });
    }
  }

  handleFavClick(channelId, btn) {
    const added = window.ivtvStorage.toggleFavorite(channelId);
    btn.classList.toggle('active', added);
    this.renderFavoritesRow();
    window.showToast(added ? 'Added to Favorites' : 'Removed from Favorites', added ? 'success' : 'info');
  }

  // ==========================================================================
  // LIVE TV GUIDE (EPG) RENDERING & TIMELINE CONTROLLER
  // ==========================================================================

  renderEPG() {
    const gridLayout = document.getElementById('epg-grid-layout');
    if (!gridLayout || !window.ivtvEPG) return;

    const now = new Date();
    // Dynamically start timeline 1 hour prior to current hour for immediate live visibility
    const windowStart = new Date(now);
    windowStart.setHours(Math.max(0, now.getHours() - 1), 0, 0, 0);

    const windowHours = 6;
    const windowDurationMinutes = windowHours * 60;
    const pixelsPerHour = 220;
    const totalTimelineWidth = windowHours * pixelsPerHour;

    // Time slots
    const slots = window.ivtvEPG.getTimeSlots(windowStart, windowHours);

    // Channels to show
    let channels = window.IVTV_DATA.channels;
    if (this.activeEPGCategory && this.activeEPGCategory !== 'all') {
      channels = channels.filter(c => c.category === this.activeEPGCategory);
    }

    // Calculate NOW line offset (240px channel column + minute progress)
    const nowMinutes = (now.getTime() - windowStart.getTime()) / (60 * 1000);
    const nowLeftPx = 240 + Math.round(nowMinutes * (pixelsPerHour / 60));

    let html = `
      <!-- Time Header Row -->
      <div class="epg-time-header-row">
        <div class="epg-channel-header-spacer">CHANNELS (${channels.length})</div>
        <div class="epg-time-slots-container">
          ${slots.map(s => `
            <div class="epg-time-slot" style="flex: 0 0 ${pixelsPerHour}px; width: ${pixelsPerHour}px;">
              <span>🕒</span>
              <span>${s.label}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Red Vertical NOW Marker Line -->
      <div class="epg-now-marker-line" id="epg-now-marker" style="left: ${nowLeftPx}px;"></div>
    `;

    html += channels.map(ch => {
      const icon = this.getChannelIcon(ch);
      const programs = window.ivtvEPG.getProgramsInWindow(ch.id, windowStart, windowDurationMinutes, pixelsPerHour);
      const logoSrc = ch.logo || (ch.logoUrl || '');
      const fallbackLogo = ch.logoUrl || '';
      const logoHtml = logoSrc 
        ? `<img src="${logoSrc}" class="epg-channel-logo-img" alt="${ch.name}" loading="lazy" onerror="if(this.dataset.fb!=='1'&&'${fallbackLogo}'){this.dataset.fb='1';this.src='${fallbackLogo}';}else{this.outerHTML='<span class=\\'epg-channel-icon\\'>${icon}</span>';}">`
        : `<span class="epg-channel-icon">${icon}</span>`;

      return `
        <div class="epg-channel-row" data-channel-id="${ch.id}">
          <div class="epg-channel-col">
            <div class="epg-channel-meta">
              ${logoHtml}
              <div class="epg-channel-name-group">
                <span class="epg-channel-name" title="${ch.name}">${ch.name}</span>
                <span class="epg-channel-cat">${ch.category}${ch.chNumber ? ` • CH ${ch.chNumber}` : ''}</span>
              </div>
            </div>
            <button class="epg-channel-play-btn" title="Watch ${ch.name} Live" onclick="window.ivtvPlayer.openPlayer('${ch.id}')">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </button>
          </div>

          <div class="epg-programs-track">
            ${programs.map(prog => `
              <div class="epg-program-block ${prog.isLive ? 'is-live' : ''}" 
                   style="width: ${prog.widthPx}px; --progress: ${prog.progressPercent}%;"
                   data-channel-id="${ch.id}"
                   onclick="window.UIControllerInstance.handleProgramClick('${ch.id}', '${prog.id}')">
                <div class="epg-program-header">
                  <span class="epg-program-time">${prog.startTimeFormatted} - ${prog.endTimeFormatted}</span>
                  ${prog.isLive ? '<span class="epg-program-badge live-tag">LIVE</span>' : (prog.tag ? `<span class="epg-program-badge">${prog.tag}</span>` : '')}
                </div>
                <div class="epg-program-title">${prog.title}</div>
                <div class="epg-program-desc">${prog.desc}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');

    gridLayout.innerHTML = html;
    gridLayout.style.minWidth = `${240 + totalTimelineWidth}px`;

    // Horizontal scroll gently on initial load to place the NOW marker in comfortable view
    if (!this.epgScrolled) {
      this.epgScrolled = true;
      const scrollWindow = document.getElementById('epg-scroll-window');
      if (scrollWindow && nowMinutes > 20) {
        setTimeout(() => {
          scrollWindow.scrollTo({ left: Math.max(0, nowLeftPx - 240 - 100), behavior: 'smooth' });
        }, 150);
      }
    }
  }

  handleProgramClick(channelId, progId) {
    const channel = window.IVTV_DATA.channels.find(c => c.id === channelId);
    if (!channel || !window.ivtvEPG) return;

    const schedule = window.ivtvEPG.getScheduleForChannel(channelId);
    const prog = schedule.find(p => p.id === progId) || window.ivtvEPG.getCurrentProgram(channelId);
    if (!prog) return;

    const modal = document.getElementById('epg-details-modal');
    if (!modal) return;

    const tagEl = document.getElementById('epg-modal-tag');
    const titleEl = document.getElementById('epg-modal-title');
    const chEl = document.getElementById('epg-modal-channel');
    const timeEl = document.getElementById('epg-modal-time');
    const descEl = document.getElementById('epg-modal-desc');
    const watchBtn = document.getElementById('epg-modal-watch-btn');
    const actionText = document.getElementById('epg-modal-action-text');

    const now = Date.now();
    const isLive = now >= prog.startTime.getTime() && now < prog.endTime.getTime();

    if (tagEl) {
      tagEl.textContent = isLive ? 'NOW LIVE' : (prog.tag || 'UPCOMING');
      tagEl.className = `epg-program-badge ${isLive ? 'live-tag' : ''}`;
    }
    if (titleEl) titleEl.textContent = prog.title;
    if (chEl) chEl.textContent = `${channel.name} • ${prog.source || 'Official Guide'}`;
    if (timeEl) timeEl.textContent = `${prog.startTimeFormatted} - ${prog.endTimeFormatted} (${prog.durationMinutes} mins)`;
    if (descEl) descEl.textContent = prog.desc;
    if (actionText) actionText.textContent = isLive ? 'Watch Live Now' : 'Tune in to Channel';

    if (watchBtn) {
      watchBtn.onclick = () => {
        this.hideProgramDetails();
        this.closeTVGuide();
        window.ivtvPlayer.openPlayer(channelId);
      };
    }

    modal.classList.add('active');
  }

  hideProgramDetails() {
    const modal = document.getElementById('epg-details-modal');
    if (modal) modal.classList.remove('active');
  }

  // ==========================================================================
  // DEDICATED TV GUIDE MODAL CONTROLLERS
  // ==========================================================================

  openTVGuide() {
    const modal = document.getElementById('tv-guide-modal');
    if (modal) {
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
      this.renderEPG();
      setTimeout(() => {
        const marker = document.getElementById('epg-now-marker');
        const scrollWin = document.getElementById('epg-scroll-window');
        if (marker && scrollWin) {
          const markerLeft = parseInt(marker.style.left, 10) || 240;
          scrollWin.scrollTo({ left: Math.max(0, markerLeft - 360), behavior: 'smooth' });
        }
      }, 120);
    }
  }

  closeTVGuide() {
    const modal = document.getElementById('tv-guide-modal');
    if (modal) {
      modal.classList.remove('active');
      if (!window.ivtvPlayer || !window.ivtvPlayer.isOpen) {
        document.body.style.overflow = '';
      }
    }
  }

  toggleTVGuide() {
    const modal = document.getElementById('tv-guide-modal');
    if (modal && modal.classList.contains('active')) {
      this.closeTVGuide();
    } else {
      this.openTVGuide();
    }
  }

  setupEPGClock() {
    const update = () => {
      const now = new Date();
      const clockDigits = document.getElementById('epg-clock-digits');
      if (clockDigits) {
        const h = now.getHours().toString().padStart(2, '0');
        const m = now.getMinutes().toString().padStart(2, '0');
        const s = now.getSeconds().toString().padStart(2, '0');
        clockDigits.textContent = `${h}:${m}:${s}`;
      }

      // Update position of red NOW marker line
      const marker = document.getElementById('epg-now-marker');
      if (marker) {
        const windowStart = new Date(now);
        if (now.getHours() >= 18) {
          windowStart.setHours(18, 0, 0, 0);
        } else {
          windowStart.setMinutes(0, 0, 0);
        }
        const nowMinutes = (now.getTime() - windowStart.getTime()) / (60 * 1000);
        const nowLeftPx = 240 + Math.round(nowMinutes * (220 / 60));
        marker.style.left = `${nowLeftPx}px`;
      }
    };

    update();
    if (this.epgClockTimer) clearInterval(this.epgClockTimer);
    this.epgClockTimer = setInterval(update, 1000);
  }

  // ==========================================================================
  // EVENT LISTENERS & HORIZONTAL SCROLL BUTTONS
  // ==========================================================================

  setupEventListeners() {
    const usTvSearchInput = document.getElementById('us-tv-search-input');
    if (usTvSearchInput) {
      usTvSearchInput.addEventListener('input', () => {
        this.renderUsTvDirectory(usTvSearchInput.value);
      });
    }
    // Remote Live EPG Sync Listener
    window.addEventListener('ivtv:epg-updated', () => {
      this.renderTopRanked();
      this.renderCategorySections();
      if (this.searchQuery) {
        this.handleSearch(this.searchQuery);
      }
      const modal = document.getElementById('tv-guide-modal');
      if (modal && modal.classList.contains('active')) {
        this.renderEPG();
      }
    });

    // Real-Time Views & Watch Tracking Listener
    window.addEventListener('ivtv:views-updated', () => {
      this.renderTopRanked();
    });

    // Hero Nav Buttons
    const heroPrev = document.getElementById('hero-prev-btn');
    const heroNext = document.getElementById('hero-next-btn');
    if (heroPrev) heroPrev.onclick = () => this.prevHeroSlide();
    if (heroNext) heroNext.onclick = () => this.nextHeroSlide();

    // Nav Category Pills
    // Brand Logo Home Link
    const brandLink = document.getElementById('brand-home-link');
    if (brandLink) {
      brandLink.addEventListener('click', (e) => {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        document.querySelectorAll('.nav-pill-btn, .nav-burger-item').forEach(b => b.classList.remove('active'));
        const homeBurgerItem = document.querySelector('.nav-burger-item[data-nav="home"]');
        if (homeBurgerItem) homeBurgerItem.classList.add('active');
        const burgerBtn = document.getElementById('nav-burger-btn');
        if (burgerBtn) burgerBtn.classList.add('active');
      });
    }

    // Navbar Minimize & Expand on Click Controller (Half-width, aligned right)
    const navbarGlass = document.getElementById('navbar-glass');
    const navExpandBtn = document.getElementById('nav-expand-btn');
    const navMinimizeBtn = document.getElementById('nav-minimize-btn');
    const burgerWrapper = document.getElementById('nav-burger-wrapper');
    const burgerBtn = document.getElementById('nav-burger-btn');

    if (navbarGlass) {
      const expandNavbar = () => {
        navbarGlass.classList.remove('minimized');
        if (navExpandBtn) navExpandBtn.setAttribute('aria-expanded', 'true');
      };

      const minimizeNavbar = () => {
        navbarGlass.classList.add('minimized');
        if (navExpandBtn) navExpandBtn.setAttribute('aria-expanded', 'false');
        if (burgerWrapper) {
          burgerWrapper.classList.remove('open');
          if (burgerBtn) burgerBtn.setAttribute('aria-expanded', 'false');
        }
      };

      if (navExpandBtn) {
        navExpandBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          expandNavbar();
        });
      }

      if (navMinimizeBtn) {
        navMinimizeBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          minimizeNavbar();
        });
      }

      // Clicking outside the navbar minimizes it
      document.addEventListener('click', (e) => {
        if (!navbarGlass.classList.contains('minimized') && !navbarGlass.contains(e.target)) {
          minimizeNavbar();
        }
      });

      // Escape key minimizes navbar
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !navbarGlass.classList.contains('minimized')) {
          minimizeNavbar();
        }
        // "/" shortcut opens search and expands navbar if minimized
        if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && (!window.ivtvPlayer || !window.ivtvPlayer.isOpen)) {
          e.preventDefault();
          expandNavbar();
          const searchInput = document.getElementById('nav-search-input');
          if (searchInput) {
            setTimeout(() => searchInput.focus(), 120);
          }
        }
      });
    }

    // Burger Menu Trigger & Dropdown Handler
    if (burgerBtn && burgerWrapper) {
      burgerBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isOpen = burgerWrapper.classList.toggle('open');
        burgerBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });

      // Close burger dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!burgerWrapper.contains(e.target)) {
          burgerWrapper.classList.remove('open');
          burgerBtn.setAttribute('aria-expanded', 'false');
        }
      });

      // Close on Escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && burgerWrapper.classList.contains('open')) {
          burgerWrapper.classList.remove('open');
          burgerBtn.setAttribute('aria-expanded', 'false');
          burgerBtn.focus();
        }
      });
    }

    // Nav Category Pills & Burger Navigation Items
    document.querySelectorAll('.nav-pill-btn, .nav-burger-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        // Close burger dropdown if clicked inside
        if (burgerWrapper) {
          burgerWrapper.classList.remove('open');
          if (burgerBtn) burgerBtn.setAttribute('aria-expanded', 'false');
        }

        document.querySelectorAll('.nav-pill-btn, .nav-burger-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.dataset.nav;

        if (filter === 'home') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
          if (burgerBtn) burgerBtn.classList.add('active');
          const homeBurger = document.querySelector('.nav-burger-item[data-nav="home"]');
          if (homeBurger) homeBurger.classList.add('active');
          return;
        }

        // If not home, remove active highlight from burger button
        if (burgerBtn) burgerBtn.classList.remove('active');

        if (filter === 'guide') {
          this.openTVGuide();
          return;
        }

        if (filter === 'favorites') {
          const favSection = document.getElementById('favorites-section');
          if (favSection) {
            this.renderFavoritesRow();
            favSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
          return;
        }

        if (filter === 'most-viewed') {
          const topSec = document.getElementById('top-ranked-section');
          if (topSec) topSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }

        if (filter === 'freeview') {
          const fvSec = document.getElementById('freeview-section');
          if (fvSec) fvSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }

        if (filter === 'us-tv') {
          const usTvSection = document.getElementById('us-tv-section');
          if (usTvSection) usTvSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }

        if (filter === 'sky') {
          const skySec = document.getElementById('sky-channels-section');
          if (skySec) skySec.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }

        this.activeFilter = filter;
        const secMap = {
          'Entertainment': 'entertainment-section',
          'Cinema': 'cinema-section',
          'News': 'news-section'
        };
        const targetId = secMap[filter];
        const sec = targetId ? document.getElementById(targetId) : null;
        if (sec) {
          sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });

    // Reset Freeview Order Action
    const resetFreeviewBtn = document.getElementById('freeview-reset-order-btn');
    if (resetFreeviewBtn) {
      resetFreeviewBtn.addEventListener('click', () => {
        this.resetFreeviewOrder();
      });
    }

    // Automatic Navbar ScrollSpy to keep active button in sync with scroll position
    let scrollSpyTimer = null;
    window.addEventListener('scroll', () => {
      if (scrollSpyTimer) return;
      scrollSpyTimer = setTimeout(() => {
        scrollSpyTimer = null;
        const scrollY = window.scrollY;
        if (scrollY < 450) {
          document.querySelectorAll('.nav-pill-btn, .nav-burger-item').forEach(b => b.classList.remove('active'));
          const homeBurger = document.querySelector('.nav-burger-item[data-nav="home"]');
          if (homeBurger) homeBurger.classList.add('active');
          const burgerBtnEl = document.getElementById('nav-burger-btn');
          if (burgerBtnEl) burgerBtnEl.classList.add('active');
          return;
        }

        const burgerBtnEl = document.getElementById('nav-burger-btn');
        if (burgerBtnEl) burgerBtnEl.classList.remove('active');

        const sections = [
          { id: 'cinema-section', nav: 'Cinema' },
          { id: 'news-section', nav: 'News' },
          { id: 'entertainment-section', nav: 'Entertainment' },
          { id: 'sky-channels-section', nav: 'sky' },
          { id: 'us-tv-section', nav: 'us-tv' },
          { id: 'freeview-section', nav: 'freeview' },
          { id: 'top-ranked-section', nav: 'most-viewed' },
          { id: 'favorites-section', nav: 'favorites' }
        ];

        for (const secInfo of sections) {
          const el = document.getElementById(secInfo.id);
          if (el) {
            const rect = el.getBoundingClientRect();
            if (rect.top <= 200 && rect.bottom > 120) {
              document.querySelectorAll('.nav-pill-btn, .nav-burger-item').forEach(b => b.classList.remove('active'));
              const targetBtn = document.querySelector(`.nav-pill-btn[data-nav="${secInfo.nav}"]`);
              if (targetBtn) targetBtn.classList.add('active');
              break;
            }
          }
        }
      }, 100);
    }, { passive: true });

    // Sky Channels Subcategory Pills
    document.querySelectorAll('#sky-subpills .subpill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#sky-subpills .subpill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.renderSkyChannels(btn.dataset.skyFilter);
      });
    });

    // Sports Arena Subcategory Pills
    document.querySelectorAll('#sports-subpills .subpill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#sports-subpills .subpill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.renderSportsSection(btn.dataset.sportsFilter);
      });
    });

    // Dedicated TV Guide Modal Close Trigger
    const guideCloseBtn = document.getElementById('tv-guide-modal-close-btn');
    const guideModal = document.getElementById('tv-guide-modal');
    if (guideCloseBtn) guideCloseBtn.addEventListener('click', () => this.closeTVGuide());
    if (guideModal) {
      guideModal.addEventListener('click', (e) => {
        if (e.target === guideModal) this.closeTVGuide();
      });
    }

    // TV Guide On-Demand Live Sync Button
    const epgSyncBtn = document.getElementById('epg-sync-btn');
    if (epgSyncBtn) {
      epgSyncBtn.addEventListener('click', async () => {
        const icon = document.getElementById('epg-sync-icon');
        const text = document.getElementById('epg-sync-text');
        if (icon) icon.classList.add('rotating');
        if (text) text.textContent = 'Syncing...';
        epgSyncBtn.disabled = true;

        try {
          if (window.ivtvEPG && typeof window.ivtvEPG.refreshLiveEPG === 'function') {
            await window.ivtvEPG.refreshLiveEPG();
          }
          if (text) text.textContent = 'Synced ✓';
          this.showToast('TV Guide updated with latest live broadcast schedules', 'success');
        } catch (err) {
          if (text) text.textContent = 'Sync Failed';
          this.showToast('Failed to refresh TV guide', 'error');
        } finally {
          setTimeout(() => {
            if (icon) icon.classList.remove('rotating');
            if (text) text.textContent = 'Sync Guide';
            epgSyncBtn.disabled = false;
          }, 2000);
        }
      });
    }

    // Keyboard shortcuts for TV Guide
    window.addEventListener('keydown', (e) => {
      if ((e.key === 'g' || e.key === 'G') && document.activeElement.tagName !== 'INPUT' && (!window.ivtvPlayer || !window.ivtvPlayer.isOpen)) {
        this.toggleTVGuide();
      }
      if (e.key === 'Escape' && guideModal && guideModal.classList.contains('active')) {
        this.closeTVGuide();
      }
    });

    // EPG Category Filters
    document.querySelectorAll('.epg-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.epg-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeEPGCategory = btn.dataset.category;
        this.renderEPG();
      });
    });

    // EPG Details Modal Close Handlers
    const modalClose = document.getElementById('epg-modal-close-btn');
    const modalDismiss = document.getElementById('epg-modal-dismiss-btn');
    const modalOverlay = document.getElementById('epg-details-modal');
    if (modalClose) modalClose.addEventListener('click', () => this.hideProgramDetails());
    if (modalDismiss) modalDismiss.addEventListener('click', () => this.hideProgramDetails());
    if (modalOverlay) {
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) this.hideProgramDetails();
      });
    }

    // Search Input
    const searchInput = document.getElementById('nav-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
    }

    // Carousel Scroll Nav Buttons (Robust event delegation across all carousels)
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.carousel-nav-btn');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const targetId = btn.dataset.target;
      const track = targetId ? document.getElementById(targetId) : null;
      if (track) {
        const scrollAmount = Math.max(320, track.clientWidth * 0.75);
        track.scrollBy({
          left: btn.classList.contains('prev') ? -scrollAmount : scrollAmount,
          behavior: 'smooth'
        });
      }
    });

    // Listen to storage changes
    window.addEventListener('ivtv:favorites-changed', () => {
      this.renderFavoritesRow();
      this.renderTopRanked();
    });

    // Initialize Mouse Wheel & Drag-to-Scroll on all carousels
    this.initCarouselMouseNavigation();
  }

  // ==========================================================================
  // CAROUSEL MOUSE WHEEL & DRAG-TO-SCROLL ENGINE
  // ==========================================================================

  initCarouselMouseNavigation() {
    // Select all horizontal tracks across home, hero, categories, and player
    const tracks = document.querySelectorAll('.carousel-track, .ranked-channels-track, #theater-surf-list, #header-nav-pills');
    tracks.forEach(track => this.enableHorizontalScrollAndDrag(track));
  }

  enableHorizontalScrollAndDrag(track) {
    if (!track || track._hasScrollDragInit) return;
    track._hasScrollDragInit = true;

    // 1. Mouse Wheel Scroll -> Responsive, Silk-Smooth Horizontal Scroll
    track.addEventListener('wheel', (e) => {
      const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (!delta) return;

      const canScrollLeft = track.scrollLeft > 0;
      const canScrollRight = track.scrollLeft < (track.scrollWidth - track.clientWidth - 2);

      if ((delta < 0 && canScrollLeft) || (delta > 0 && canScrollRight)) {
        e.preventDefault();

        // Temporarily suspend CSS scroll-snap and smooth behavior to prevent animation conflict & stutter
        if (!track._isWheelScrolling) {
          track._isWheelScrolling = true;
          track._origScrollSnap = track.style.scrollSnapType;
          track._origScrollBehavior = track.style.scrollBehavior;
          track.style.scrollSnapType = 'none';
          track.style.scrollBehavior = 'auto';
        }

        // Apply scroll delta directly for immediate 60/120fps response
        track.scrollLeft += delta * 1.18;

        // Restore CSS scroll snap when user stops scrolling
        clearTimeout(track._wheelSnapTimeout);
        track._wheelSnapTimeout = setTimeout(() => {
          track._isWheelScrolling = false;
          track.style.scrollSnapType = track._origScrollSnap || '';
          track.style.scrollBehavior = track._origScrollBehavior || '';
        }, 160);
      }
    }, { passive: false });

    // Freeview cards have dedicated drag-and-drop to rearrange
    if (track.id === 'freeview-track') {
      return;
    }

    // 2. Mouse Click-and-Drag (Kinetic Grab-to-Scroll)
    let isDown = false;
    let startX = 0;
    let startScrollLeft = 0;
    let hasDragged = false;
    let velocity = 0;
    let lastX = 0;
    let lastTime = 0;

    track.addEventListener('mousedown', (e) => {
      if (e.target.closest('button') || e.target.closest('input') || e.button !== 0) return;
      isDown = true;
      hasDragged = false;
      startX = e.pageX;
      startScrollLeft = track.scrollLeft;
      lastX = e.pageX;
      lastTime = Date.now();
      velocity = 0;
      // Do NOT add is-dragging on mousedown! Only add it once the user actually moves > 5px.
    });

    const onMouseMove = (e) => {
      if (!isDown) return;
      const x = e.pageX;
      const walk = x - startX;
      if (Math.abs(walk) > 5) {
        hasDragged = true;
        track.classList.add('is-dragging');
      }
      if (hasDragged) {
        e.preventDefault();
        track.scrollLeft = startScrollLeft - walk;
        const now = Date.now();
        const dt = now - lastTime;
        if (dt > 0) {
          velocity = (x - lastX) / dt;
        }
        lastX = x;
        lastTime = now;
      }
    };

    const onMouseUp = () => {
      if (!isDown) return;
      isDown = false;
      track.classList.remove('is-dragging');

      if (hasDragged && Math.abs(velocity) > 0.2) {
        const momentumScroll = -velocity * 220;
        track.scrollBy({
          left: momentumScroll,
          behavior: 'smooth'
        });
      }

      if (hasDragged) {
        const captureClick = (ev) => {
          ev.stopImmediatePropagation();
          ev.preventDefault();
        };
        track.addEventListener('click', captureClick, { capture: true, once: true });
        setTimeout(() => {
          track.removeEventListener('click', captureClick, { capture: true });
        }, 120);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `
      background: rgba(14, 24, 18, 0.95);
      border: 1px solid ${type === 'success' ? '#00f076' : type === 'error' ? '#ff5252' : '#38bdf8'};
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(16px);
      color: #ffffff;
      padding: 0.85rem 1.25rem;
      border-radius: 12px;
      margin-bottom: 0.75rem;
      font-size: 0.88rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 0.65rem;
      animation: toastIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      pointer-events: auto;
    `;
    const icon = type === 'success' ? '✓' : type === 'error' ? '⚠' : 'ℹ';
    toast.innerHTML = `<span style="color:${type === 'success' ? '#00f076' : type === 'error' ? '#ff5252' : '#38bdf8'}; font-weight:800; font-size:1.1rem;">${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
}

// Global UI controller instance
window.UIControllerInstance = new UIController();
window.enableHorizontalScrollAndDrag = (el) => window.UIControllerInstance.enableHorizontalScrollAndDrag(el);
