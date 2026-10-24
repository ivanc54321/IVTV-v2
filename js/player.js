/* ==========================================================================
   IVTV AD-FREE CINEMA THEATER PLAYER CONTROLLER
   Pure HTML5 Video + HLS.js with Crystal-Clear Audio Controls
   ========================================================================== */

class PlayerController {
  constructor() {
    this.modal = null;
    this.modalContainer = null;
    this.screenArea = null;
    this.video = null;
    this.youtubeIframe = null;
    this.loader = null;
    this.unmuteBadge = null;
    this.errorOverlay = null;
    this.engineBtn = null;
    this.engineIcon = null;
    this.engineLabel = null;
    this.volumeBtn = null;
    this.volumeSlider = null;
    this.volIcon = null;
    this.savedVolume = parseFloat(localStorage.getItem('ivtv_player_volume') || '0.85');
    this.isUserMuted = localStorage.getItem('ivtv_player_muted') === 'true';
    this.isAutoplayMuted = false;
    this.volumeHud = null;
    this.volumeHudFill = null;
    this.volumeHudText = null;
    this.volumeHudIcon = null;
    this.volumeHudTimer = null;
    this.currentChannel = null;
    this.hls = null;
    this.isOpen = false;
    this.refreshTimer = null;
    this.watchdogTimer = null;
    this.watchTimeTicker = null;
    this.consecutiveStallCount = 0;
    this.lastStallTime = 0;
    this.engineMode = 'direct'; // 'direct' | 'mirror' | 'youtube'
    this.fallbackEmbedUrl = '';
    this.aspectRatioMode = localStorage.getItem('ivtv_player_aspect') || 'stretch'; // Default 'stretch' ('stretch' | 'fit' | 'fill')
    this.surfQuery = '';
    this.osdTimer = null;
    this.controlsHideTimer = null;
    this.isSideGuideOpen = false;
    this.sideGuideCategory = 'all';
    this.sideGuideQuery = '';
    this.sideGuideClockTimer = null;
    this.justDraggedSideGuide = false;
  }

  init() {
    this.modal = document.getElementById('theater-modal');
    this.modalContainer = document.getElementById('theater-modal-container');
    this.screenArea = document.getElementById('theater-screen-area');
    this.video = document.getElementById('theater-video');
    this.youtubeIframe = document.getElementById('theater-youtube-iframe');
    this.loader = document.getElementById('theater-loader');
    this.unmuteBadge = document.getElementById('theater-unmute-badge');
    this.errorOverlay = document.getElementById('theater-error-overlay');
    this.engineBtn = document.getElementById('theater-engine-btn');
    this.engineIcon = document.getElementById('theater-engine-icon');
    this.engineLabel = document.getElementById('theater-engine-label');
    this.volumeBtn = document.getElementById('theater-volume-btn');
    this.volumeSlider = document.getElementById('theater-volume-slider');
    this.volIcon = document.getElementById('theater-vol-icon');
    this.volumeHud = document.getElementById('theater-volume-hud');
    this.volumeHudFill = document.getElementById('theater-volume-hud-fill');
    this.volumeHudText = document.getElementById('theater-volume-hud-text');
    this.volumeHudIcon = document.getElementById('theater-volume-hud-icon');

    // Close button
    const closeBtn = document.getElementById('theater-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closePlayer());
    }

    // Modal background click
    if (this.modal) {
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) {
          this.closePlayer();
        }
      });
    }

    // Double-click screen area to toggle fullscreen
    if (this.screenArea) {
      this.screenArea.addEventListener('dblclick', (e) => {
        if (e.target.closest('button') || e.target.closest('input')) return;
        this.toggleFullscreen();
      });
    }

    // Fullscreen change events to update button state & CSS classes across all browser engines
    document.addEventListener('fullscreenchange', () => this.handleFullscreenChange());
    document.addEventListener('webkitfullscreenchange', () => this.handleFullscreenChange());
    document.addEventListener('mozfullscreenchange', () => this.handleFullscreenChange());
    document.addEventListener('MSFullscreenChange', () => this.handleFullscreenChange());

    // Unmute badge click
    if (this.unmuteBadge) {
      this.unmuteBadge.addEventListener('click', () => this.unmute());
    }

    // Video events for smooth playback tracking
    if (this.video) {
      this.video.addEventListener('click', () => {
        if (this.video.muted) {
          this.unmute();
        }
      });

      this.video.addEventListener('volumechange', () => {
        this.updateVolumeUI();
      });

      this.video.addEventListener('playing', () => {
        if (this.loader) this.loader.classList.add('hidden');
        if (this.errorOverlay) this.errorOverlay.classList.add('hidden');
        if (this.watchdogTimer) {
          clearTimeout(this.watchdogTimer);
          this.watchdogTimer = null;
        }
      });

      this.video.addEventListener('timeupdate', () => {
        if (this.video.currentTime > 0) {
          if (this.loader && !this.loader.classList.contains('hidden')) {
            this.loader.classList.add('hidden');
          }
          if (this.watchdogTimer) {
            clearTimeout(this.watchdogTimer);
            this.watchdogTimer = null;
          }
        }
      });

      this.video.addEventListener('playing', () => {
        this.mediaErrorRecoveries = 0;
        this.stallCount = 0;
        this.fatalErrorCount = 0;
        if (this.loader && !this.loader.classList.contains('hidden')) {
          this.loader.classList.add('hidden');
        }
        if (this.watchdogTimer) {
          clearTimeout(this.watchdogTimer);
          this.watchdogTimer = null;
        }
      });

      // Video stalled or waiting: nudge forward into live buffer window
      this.video.addEventListener('waiting', () => {
        if (this.hls && this.video.buffered && this.video.buffered.length > 0) {
          const bufStart = this.video.buffered.start(0);
          if (this.video.currentTime < bufStart) {
            console.log(`[IVTV Player] Stalled behind buffer, nudging to live start: ${bufStart + 0.1}`);
            this.video.currentTime = bufStart + 0.1;
          }
        }
      });
    }

    // Stream Engine Toggle Button
    if (this.engineBtn) {
      this.engineBtn.addEventListener('click', () => this.toggleEngine());
    }

    // Error Overlay Buttons
    const errSwitchBtn = document.getElementById('theater-error-switch-btn');
    if (errSwitchBtn) {
      errSwitchBtn.addEventListener('click', () => this.switchToEmbedMirror());
    }

    const errRetryBtn = document.getElementById('theater-error-retry-btn');
    if (errRetryBtn) {
      errRetryBtn.addEventListener('click', () => {
        if (this.errorOverlay) this.errorOverlay.classList.add('hidden');
        this.reloadStream();
      });
    }

    const errExtBtn = document.getElementById('theater-error-external-btn');
    if (errExtBtn) {
      errExtBtn.addEventListener('click', () => {
        if (this.fallbackEmbedUrl) {
          window.open(this.fallbackEmbedUrl, '_blank');
        } else if (this.currentChannel) {
          window.open(`https://freeshot.live/embed/${this.currentChannel.id}.php`, '_blank');
        }
      });
    }

    // Dedicated Mute/Unmute button
    if (this.volumeBtn) {
      this.volumeBtn.addEventListener('click', () => this.toggleMute());
    }

    // Dedicated Volume Slider
    if (this.volumeSlider) {
      this.volumeSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.setVolume(val);
      });
    }

    // Mouse wheel volume control on video screen area
    if (this.screenArea) {
      this.screenArea.addEventListener('wheel', (e) => {
        if (!this.isOpen) return;
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.05 : -0.05;
        this.adjustVolume(delta);
      }, { passive: false });
    }

    // Reload stream button
    const reloadBtn = document.getElementById('theater-reload-btn');
    if (reloadBtn) {
      reloadBtn.addEventListener('click', () => this.reloadStream());
    }

    // Fullscreen button
    const fsBtn = document.getElementById('theater-fs-btn');
    if (fsBtn) {
      fsBtn.addEventListener('click', () => this.toggleFullscreen());
    }

    // Pop-out Menu Dropdown Trigger & Outside Click
    const popmenuWrapper = document.getElementById('theater-popmenu-wrapper');
    const popmenuTrigger = document.getElementById('theater-popmenu-trigger');
    if (popmenuTrigger && popmenuWrapper) {
      popmenuTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = popmenuWrapper.classList.toggle('open');
        popmenuTrigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });

      // Close popmenu when clicking outside
      document.addEventListener('click', (e) => {
        if (!popmenuWrapper.contains(e.target)) {
          popmenuWrapper.classList.remove('open');
          popmenuTrigger.setAttribute('aria-expanded', 'false');
        }
      });
    }

    // Popout external button (inside popmenu)
    const popoutBtn = document.getElementById('theater-popout-btn');
    if (popoutBtn) {
      popoutBtn.addEventListener('click', () => {
        if (popmenuWrapper) {
          popmenuWrapper.classList.remove('open');
          if (popmenuTrigger) popmenuTrigger.setAttribute('aria-expanded', 'false');
        }
        this.openInNewWindow();
      });
    }

    // Picture-in-Picture Button (inside popmenu)
    const pipBtn = document.getElementById('theater-pip-btn');
    if (pipBtn) {
      pipBtn.addEventListener('click', () => {
        if (popmenuWrapper) {
          popmenuWrapper.classList.remove('open');
          if (popmenuTrigger) popmenuTrigger.setAttribute('aria-expanded', 'false');
        }
        this.togglePiP();
      });
    }

    // Favorite toggle button inside player
    const favBtn = document.getElementById('theater-fav-btn');
    if (favBtn) {
      favBtn.addEventListener('click', () => this.togglePlayerFavorite());
    }

    // Play / Pause Toggle Button
    const playPauseBtn = document.getElementById('theater-play-pause-btn');
    if (playPauseBtn) {
      playPauseBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.togglePlayPause();
      });
    }

    if (this.video) {
      this.video.addEventListener('click', (e) => {
        if (e.target !== this.video) return;
        e.stopPropagation();
        this.togglePlayPause();
      });
      this.video.addEventListener('play', () => this.updatePlayPauseUI(true));
      this.video.addEventListener('pause', () => this.updatePlayPauseUI(false));
    }

    // Prev / Next Channel Zapper Buttons
    const prevChBtn = document.getElementById('theater-prev-ch-btn');
    if (prevChBtn) {
      prevChBtn.addEventListener('click', () => this.zapChannel(-1));
    }
    const nextChBtn = document.getElementById('theater-next-ch-btn');
    if (nextChBtn) {
      nextChBtn.addEventListener('click', () => this.zapChannel(1));
    }

    // Aspect Ratio Toggler Button
    const aspectBtn = document.getElementById('theater-aspect-btn');
    if (aspectBtn) {
      aspectBtn.addEventListener('click', () => this.toggleAspectRatio());
    }
    // Initialize aspect ratio mode
    this.applyAspectRatio(this.aspectRatioMode, false);

    // Channel Surf Drawer Category Filter Pills
    const surfCats = document.getElementById('theater-surf-cats');
    if (surfCats) {
      surfCats.querySelectorAll('.surf-cat-pill').forEach(pill => {
        pill.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          surfCats.querySelectorAll('.surf-cat-pill').forEach(p => p.classList.remove('active'));
          pill.classList.add('active');
          this.surfCategory = pill.dataset.category || 'all';
          this.renderInPlayerSurfList(this.currentChannel?.category, this.currentChannel?.id);
        });
      });
    }

    // Channel Surf Drawer Real-time Search
    const surfSearch = document.getElementById('theater-surf-search');
    if (surfSearch) {
      surfSearch.addEventListener('click', (e) => e.stopPropagation());
      surfSearch.addEventListener('keydown', (e) => e.stopPropagation());
      surfSearch.addEventListener('input', (e) => {
        e.stopPropagation();
        this.surfQuery = e.target.value.toLowerCase().trim();
        this.renderInPlayerSurfList(this.currentChannel?.category, this.currentChannel?.id);
      });
    }

    // Channel Surf Drawer Toggle Button
    const surfToggleBtn = document.getElementById('theater-surf-toggle-btn');
    if (surfToggleBtn) {
      surfToggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleSurfDrawer();
      });
    }

    // Channel Surf Drawer Close Button
    const surfCloseBtn = document.getElementById('theater-surf-close-btn');
    if (surfCloseBtn) {
      surfCloseBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleSurfDrawer();
      });
    }

    // Channel Surf Drawer Carousel Navigation Buttons (‹ and ›)
    const surfPrevBtn = document.getElementById('theater-surf-prev-btn');
    if (surfPrevBtn) {
      surfPrevBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const list = document.getElementById('theater-surf-list');
        if (list) {
          list.scrollBy({ left: -360, behavior: 'smooth' });
        }
      });
    }

    const surfNextBtn = document.getElementById('theater-surf-next-btn');
    if (surfNextBtn) {
      surfNextBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const list = document.getElementById('theater-surf-list');
        if (list) {
          list.scrollBy({ left: 360, behavior: 'smooth' });
        }
      });
    }

    // In-Player Pop-from-Left TV Guide Drawer Toggle Button
    const sideGuideBtn = document.getElementById('theater-guide-toggle-btn');
    if (sideGuideBtn) {
      sideGuideBtn.addEventListener('click', () => this.toggleSideGuide());
    }

    // Side TV Guide Close Button
    const sideGuideCloseBtn = document.getElementById('theater-side-guide-close-btn');
    if (sideGuideCloseBtn) {
      sideGuideCloseBtn.addEventListener('click', () => this.toggleSideGuide(false));
    }

    // Side TV Guide Category Filter Pills
    const sideGuideCats = document.getElementById('side-guide-categories');
    if (sideGuideCats) {
      sideGuideCats.querySelectorAll('.side-guide-cat-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          sideGuideCats.querySelectorAll('.side-guide-cat-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.sideGuideCategory = btn.dataset.category || 'all';
          this.renderSideGuideList();
        });
      });
    }

    // Side TV Guide Live Search Input
    const sideGuideSearch = document.getElementById('side-guide-search-input');
    if (sideGuideSearch) {
      sideGuideSearch.addEventListener('input', (e) => {
        this.sideGuideQuery = e.target.value.toLowerCase().trim();
        this.renderSideGuideList();
      });
    }

    // Initialize TV Guide slide out mouse scrolling & grab-to-scroll engine
    this.initSideGuideMouseNavigation();

    // Side Guide Clock Timer
    setInterval(() => {
      if (this.isOpen && this.isSideGuideOpen) {
        this.updateSideGuideClock();
      }
    }, 1000);

    // Auto-hide controls when user is idle during playback
    const resetControlsTimer = () => {
      if (!this.isOpen || !this.modalContainer) return;
      this.modalContainer.classList.remove('controls-hidden');
      if (this.controlsHideTimer) clearTimeout(this.controlsHideTimer);

      this.controlsHideTimer = setTimeout(() => {
        if (!this.isOpen || !this.modalContainer) return;
        const drawer = document.getElementById('theater-surf-drawer');
        const isDrawerOpen = drawer && !drawer.classList.contains('collapsed');
        const popmenu = document.getElementById('theater-popmenu-wrapper');
        const isPopmenuOpen = popmenu && popmenu.classList.contains('open');
        const isSideGuideOpen = this.isSideGuideOpen;

        // Never auto-hide controls during iframe / mirror playback (e.g. Channel 5)
        const isIframeActive = this.modalContainer.classList.contains('has-iframe-active') ||
                               (this.youtubeIframe && this.youtubeIframe.style.display !== 'none') ||
                               this.engineMode === 'mirror' || 
                               this.engineMode === 'embed';

        // Keep bottom controls permanently visible in standard windowed theater mode
        const isFs = !!(
          document.fullscreenElement || 
          document.webkitFullscreenElement ||
          document.mozFullScreenElement ||
          document.msFullscreenElement ||
          this.modalContainer?.classList.contains('is-fullscreen')
        );

        if (isIframeActive || !isFs) {
          this.modalContainer.classList.remove('controls-hidden');
          return;
        }

        if (!isDrawerOpen && !isPopmenuOpen && !isSideGuideOpen) {
          this.modalContainer.classList.add('controls-hidden');
        }
      }, 3500);
    };

    if (this.modalContainer) {
      this.modalContainer.addEventListener('mousemove', resetControlsTimer);
      this.modalContainer.addEventListener('mousedown', resetControlsTimer);
    }

    const bottomOverlay = document.getElementById('theater-bottom-overlay') || document.getElementById('theater-controls-bar');
    if (bottomOverlay) {
      bottomOverlay.addEventListener('mouseenter', () => {
        if (!this.isOpen || !this.modalContainer) return;
        this.modalContainer.classList.remove('controls-hidden');
        if (this.controlsHideTimer) clearTimeout(this.controlsHideTimer);
      });
      bottomOverlay.addEventListener('mouseleave', resetControlsTimer);
    }

    const header = this.modalContainer ? this.modalContainer.querySelector('.theater-header') : null;
    if (header) {
      header.addEventListener('mouseenter', () => {
        if (!this.isOpen || !this.modalContainer) return;
        this.modalContainer.classList.remove('controls-hidden');
        if (this.controlsHideTimer) clearTimeout(this.controlsHideTimer);
      });
      header.addEventListener('mouseleave', resetControlsTimer);
    }

    // Keyboard controls
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        if (this.isSideGuideOpen) {
          this.toggleSideGuide(false);
          return;
        }

        const popmenuWrapper = document.getElementById('theater-popmenu-wrapper');
        if (popmenuWrapper && popmenuWrapper.classList.contains('open')) {
          popmenuWrapper.classList.remove('open');
          const popmenuTrigger = document.getElementById('theater-popmenu-trigger');
          if (popmenuTrigger) popmenuTrigger.setAttribute('aria-expanded', 'false');
          return;
        }

        const isFs = !!(
          document.fullscreenElement ||
          document.webkitFullscreenElement ||
          this.modalContainer?.classList.contains('is-fullscreen') ||
          this.modal?.classList.contains('is-fullscreen')
        );
        if (isFs) {
          this.toggleFullscreen();
          return;
        }

        this.closePlayer();
      }
      if ((e.key === 'g' || e.key === 'G') && this.isOpen && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        this.toggleSideGuide();
      }
      if ((e.key === ' ' || e.key === 'k' || e.key === 'K') && this.isOpen) {
        if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'BUTTON')) {
          // Do not hijack spacebar if user is interacting with an input or button
          return;
        }
        e.preventDefault();
        this.togglePlayPause();
      }
      if ((e.key === 'f' || e.key === 'F') && this.isOpen && document.activeElement.tagName !== 'INPUT') {
        this.toggleFullscreen();
      }
      if ((e.key === 'm' || e.key === 'M') && this.isOpen && document.activeElement.tagName !== 'INPUT') {
        this.toggleMute();
      }
      if ((e.key === 'w' || e.key === 'W') && this.isOpen && document.activeElement.tagName !== 'INPUT') {
        this.toggleFullscreen();
      }
      if ((e.key === 'c' || e.key === 'C') && this.isOpen && document.activeElement.tagName !== 'INPUT') {
        this.toggleSurfDrawer();
      }
      if ((e.key === 'e' || e.key === 'E') && this.isOpen && document.activeElement.tagName !== 'INPUT') {
        this.toggleEngine();
      }
      if ((e.key === 'a' || e.key === 'A') && this.isOpen && document.activeElement.tagName !== 'INPUT') {
        this.toggleAspectRatio();
      }
      if ((e.key === 'p' || e.key === 'P') && this.isOpen && document.activeElement.tagName !== 'INPUT') {
        this.togglePiP();
      }
      if (e.key === 'ArrowUp' && this.isOpen && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        this.adjustVolume(0.05);
      }
      if (e.key === 'ArrowDown' && this.isOpen && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        this.adjustVolume(-0.05);
      }
      if ((e.key === 'PageUp' || e.key === '[') && this.isOpen && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        this.zapChannel(-1);
      }
      if ((e.key === 'PageDown' || e.key === ']') && this.isOpen && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        this.zapChannel(1);
      }
    });

    // Listen to favorite change events
    window.addEventListener('ivtv:favorites-changed', () => {
      if (this.currentChannel) {
        this.updatePlayerFavState();
      }
    });

    // Auto-resume stream on network restore
    window.addEventListener('online', () => {
      if (this.isOpen && this.currentChannel) {
        console.log('[IVTV Player] Network restored, resetting error state and reloading stream...');
        this.resetErrorOverlayUI();
        if (this.errorOverlay) this.errorOverlay.classList.add('hidden');
        this.reloadStream();
      }
    });

    // Auto-pause and show offline guidance if connection drops
    window.addEventListener('offline', () => {
      if (this.isOpen) {
        this.showOfflineOverlay();
      }
    });
  }

  toggleCinemaWide() {
    this.toggleFullscreen();
  }

  toggleSurfDrawer(forceState) {
    const drawer = document.getElementById('theater-surf-drawer');
    const toggleBtn = document.getElementById('theater-surf-toggle-btn');
    const closeBtn = document.getElementById('theater-surf-close-btn');
    if (!drawer) return;

    if (forceState !== undefined) {
      if (forceState) {
        drawer.classList.remove('collapsed');
      } else {
        drawer.classList.add('collapsed');
      }
    } else {
      drawer.classList.toggle('collapsed');
    }

    const isVisible = !drawer.classList.contains('collapsed');
    if (toggleBtn) toggleBtn.classList.toggle('active', isVisible);
    if (closeBtn) closeBtn.textContent = isVisible ? 'Hide ▲' : 'Show ▼';

    // Auto-scroll active channel into center view when opening drawer
    if (isVisible) {
      setTimeout(() => {
        const activeItem = drawer.querySelector('.surf-channel-item.active');
        if (activeItem) {
          activeItem.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
      }, 100);
    }
  }

  toggleSideGuide(forceState) {
    const drawer = document.getElementById('theater-side-guide');
    const toggleBtn = document.getElementById('theater-guide-toggle-btn');
    if (!drawer) return;

    const nextState = forceState !== undefined ? forceState : !drawer.classList.contains('open');
    this.isSideGuideOpen = nextState;

    drawer.classList.toggle('open', nextState);
    if (toggleBtn) toggleBtn.classList.toggle('active', nextState);

    if (nextState) {
      this.initSideGuideMouseNavigation();
      this.renderSideGuideList();
      this.updateSideGuideClock();
      // Ensure controls stay visible while side guide is open
      if (this.modalContainer) {
        this.modalContainer.classList.remove('controls-hidden');
      }
      // If bottom surf drawer is open, collapse it
      this.toggleSurfDrawer(false);
      // Auto-scroll active card into view
      setTimeout(() => {
        const activeCard = drawer.querySelector('.side-guide-card.is-active');
        if (activeCard) {
          activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 120);
    }
  }

  // ==========================================================================
  // TV GUIDE SLIDE-OUT MOUSE SCROLL & DRAG ENGINE
  // ==========================================================================
  initSideGuideMouseNavigation() {
    const drawer = document.getElementById('theater-side-guide');
    const listWrap = document.getElementById('side-guide-list-wrap');
    const catsEl = document.getElementById('side-guide-categories');

    // 1. Isolate wheel events within entire drawer so they never leak to background or trigger volume changes
    if (drawer && !drawer._hasMouseScrollInit) {
      drawer._hasMouseScrollInit = true;
      drawer.addEventListener('wheel', (e) => {
        e.stopPropagation();
      }, { passive: false });
    }

    // 2. Mouse Wheel on Category Filter Pills (Translate vertical wheel to horizontal scroll)
    if (catsEl && !catsEl._hasWheelInit) {
      catsEl._hasWheelInit = true;
      catsEl.addEventListener('wheel', (e) => {
        e.stopPropagation();
        const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
        if (!delta) return;

        const canScrollLeft = catsEl.scrollLeft > 0;
        const canScrollRight = catsEl.scrollLeft < (catsEl.scrollWidth - catsEl.clientWidth - 1);

        if ((delta < 0 && canScrollLeft) || (delta > 0 && canScrollRight)) {
          e.preventDefault();
          catsEl.scrollLeft += delta * 1.15;
        }
      }, { passive: false });
    }

    // 3. Mouse Wheel and Kinetic Click-and-Drag (Grab-to-Scroll) on Listings
    if (listWrap && !listWrap._hasMouseScrollInit) {
      listWrap._hasMouseScrollInit = true;

      // Mouse Wheel -> Smooth vertical scroll through channel listings
      listWrap.addEventListener('wheel', (e) => {
        e.stopPropagation();
        const delta = e.deltaY;
        if (!delta) return;

        const canScrollUp = listWrap.scrollTop > 0;
        const canScrollDown = listWrap.scrollTop < (listWrap.scrollHeight - listWrap.clientHeight - 1);

        if ((delta < 0 && canScrollUp) || (delta > 0 && canScrollDown)) {
          e.preventDefault();
          listWrap.scrollTop += delta * 1.1;
        }
      }, { passive: false });

      // Kinetic Click-and-Drag (Grab-to-Scroll)
      let isDown = false;
      let startY = 0;
      let startScrollTop = 0;
      let hasDragged = false;
      let velocity = 0;
      let lastY = 0;
      let lastTime = 0;

      listWrap.addEventListener('mousedown', (e) => {
        if (e.target.closest('button') || e.target.closest('input') || e.button !== 0) return;
        isDown = true;
        hasDragged = false;
        startY = e.pageY;
        startScrollTop = listWrap.scrollTop;
        lastY = e.pageY;
        lastTime = Date.now();
        velocity = 0;
      });

      const onMouseMove = (e) => {
        if (!isDown) return;
        const y = e.pageY;
        const walk = y - startY;
        if (Math.abs(walk) > 5) {
          hasDragged = true;
          this.justDraggedSideGuide = true;
          listWrap.classList.add('is-dragging');
        }
        if (hasDragged) {
          e.preventDefault();
          listWrap.scrollTop = startScrollTop - walk;
          const now = Date.now();
          const dt = now - lastTime;
          if (dt > 0) {
            velocity = (y - lastY) / dt;
          }
          lastY = y;
          lastTime = now;
        }
      };

      const onMouseUp = () => {
        if (!isDown) return;
        isDown = false;
        listWrap.classList.remove('is-dragging');

        if (hasDragged && Math.abs(velocity) > 0.2) {
          const momentum = -velocity * 180;
          listWrap.scrollBy({
            top: momentum,
            behavior: 'smooth'
          });
        }

        if (hasDragged) {
          setTimeout(() => {
            this.justDraggedSideGuide = false;
          }, 140);
        }
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    }
  }

  updateSideGuideClock() {
    const clockEl = document.getElementById('side-guide-clock');
    if (!clockEl) return;
    const now = new Date();
    const h = now.getHours().toString().padStart(2, '0');
    const m = now.getMinutes().toString().padStart(2, '0');
    const s = now.getSeconds().toString().padStart(2, '0');
    clockEl.textContent = `${h}:${m}:${s}`;
  }

  renderSideGuideList() {
    const listEl = document.getElementById('theater-side-guide-list');
    const counterEl = document.getElementById('side-guide-counter');
    if (!listEl) return;

    if (!window.IVTV_DATA?.channels) {
      listEl.innerHTML = '<div class="side-guide-empty">No channels loaded</div>';
      return;
    }

    let channels = [...window.IVTV_DATA.channels];

    // Filter by Category
    if (this.sideGuideCategory === 'Favorites') {
      const favIds = window.ivtvStorage ? window.ivtvStorage.getFavorites() : [];
      channels = channels.filter(c => favIds.includes(c.id));
    } else if (this.sideGuideCategory && this.sideGuideCategory !== 'all') {
      channels = channels.filter(c => c.category === this.sideGuideCategory);
    }

    // Filter by Search Query
    if (this.sideGuideQuery) {
      channels = channels.filter(c => {
        const nameMatch = c.name.toLowerCase().includes(this.sideGuideQuery);
        const numMatch = c.chNumber && c.chNumber.toString().includes(this.sideGuideQuery);
        const catMatch = c.category && c.category.toLowerCase().includes(this.sideGuideQuery);
        let progMatch = false;
        if (window.ivtvEPG) {
          const prog = window.ivtvEPG.getCurrentProgram(c.id);
          if (prog && prog.title && prog.title.toLowerCase().includes(this.sideGuideQuery)) {
            progMatch = true;
          }
        }
        return nameMatch || numMatch || catMatch || progMatch;
      });
    }

    if (counterEl) {
      counterEl.textContent = `${channels.length} ${channels.length === 1 ? 'Guide' : 'Guides'}`;
    }

    if (channels.length === 0) {
      listEl.innerHTML = `
        <div class="side-guide-empty">
          <div class="side-guide-empty-icon">📡</div>
          <div style="font-weight: 700; color: #fff; margin-bottom: 0.25rem;">No channels found</div>
          <div style="font-size: 0.78rem;">Try a different search term or category filter</div>
        </div>
      `;
      return;
    }

    const currentId = this.currentChannel?.id;

    listEl.innerHTML = channels.map(ch => {
      const isActive = ch.id === currentId;
      const isFav = window.ivtvStorage && window.ivtvStorage.isFavorite(ch.id);
      const logoSrc = ch.logo || ch.logoUrl || '';
      const fallbackLogo = ch.logoUrl || '';
      const logoHtml = logoSrc
        ? `<img src="${logoSrc}" class="side-guide-logo-img" alt="${ch.name}" loading="lazy" onerror="if(this.dataset.fb!=='1'&&'${fallbackLogo}'){this.dataset.fb='1';this.src='${fallbackLogo}';}else{this.style.display='none';}">`
        : `<span style="font-size:0.65rem;font-weight:800;color:var(--accent-emerald);">${ch.name.substring(0, 3)}</span>`;

      // Get real-time EPG program data
      let nowTitle = 'Live Television Broadcast';
      let nowTimeRange = 'Broadcasting Live';
      let progressPercent = 50;
      let minsLeft = 'LIVE';
      let nextTitle = 'Upcoming Broadcast Schedule';
      let nextTimeRange = 'Up Next';
      let nextDuration = '';

      if (window.ivtvEPG) {
        const prog = window.ivtvEPG.getCurrentProgram(ch.id);
        if (prog) {
          nowTitle = prog.title || nowTitle;
          nowTimeRange = `${prog.startTimeFormatted} - ${prog.endTimeFormatted}`;
          progressPercent = prog.progressPercent !== undefined ? prog.progressPercent : 50;
          minsLeft = prog.minutesLeft ? `${prog.minutesLeft}m left` : 'LIVE';

          if (prog.next && prog.next.title) {
            nextTitle = prog.next.title;
            nextTimeRange = `${prog.next.startTimeFormatted || ''} - ${prog.next.endTimeFormatted || ''}`.trim();
            if (prog.next.durationMinutes) {
              nextDuration = `${prog.next.durationMinutes}m`;
            }
          } else {
            // Find next upcoming show in schedule
            const schedule = window.ivtvEPG.getScheduleForChannel(ch.id);
            if (Array.isArray(schedule) && schedule.length > 1) {
              const currentIdx = schedule.findIndex(s => s.title === prog.title);
              const upcoming = (currentIdx >= 0 && schedule[currentIdx + 1]) ? schedule[currentIdx + 1] : schedule[1];
              if (upcoming && upcoming.title) {
                nextTitle = upcoming.title;
                nextTimeRange = `${upcoming.startTimeFormatted || ''} - ${upcoming.endTimeFormatted || ''}`.trim();
                if (upcoming.durationMinutes) {
                  nextDuration = `${upcoming.durationMinutes}m`;
                }
              }
            }
          }
        }
      }

      return `
        <div class="side-guide-card ${isActive ? 'is-active' : ''}" data-channel-id="${ch.id}">
          <div class="side-guide-card-top">
            <div class="side-guide-channel-identity">
              <div class="side-guide-logo-wrap">
                ${logoHtml}
              </div>
              <div class="side-guide-channel-meta">
                ${ch.chNumber ? `<span class="side-guide-channel-num">CH ${ch.chNumber}</span>` : ''}
                <span class="side-guide-channel-name" title="${ch.name}">${ch.name}</span>
              </div>
            </div>
            <div class="side-guide-badges-group">
              ${isActive ? `<span class="side-guide-watching-pill"><span class="live-pulse-dot" style="width:5px;height:5px;"></span> WATCHING</span>` : ''}
              <button type="button" class="side-guide-fav-btn ${isFav ? 'is-fav' : ''}" data-fav-id="${ch.id}" title="${isFav ? 'Remove from favorites' : 'Add to favorites'}">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="${isFav ? '#fbbf24' : 'none'}" stroke="currentColor" stroke-width="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Dual Schedule Grid: NOW and NEXT -->
          <div class="side-guide-epg-dual-block">
            <!-- 1. NOW PLAYING BLOCK -->
            <div class="side-guide-now-box">
              <div class="side-guide-section-header">
                <span class="side-guide-now-tag">
                  <span class="live-pulse-dot" style="width:5px;height:5px;background:#ef4444;box-shadow:0 0 6px #ef4444;"></span>
                  NOW
                </span>
                <span class="side-guide-time-pill">${nowTimeRange}</span>
              </div>
              <div class="side-guide-prog-title" title="${nowTitle}">${nowTitle}</div>
              <div class="side-guide-progress-wrap">
                <div class="side-guide-progress-track">
                  <div class="side-guide-progress-fill" style="width: ${progressPercent}%;"></div>
                </div>
                <span class="side-guide-mins-left">${minsLeft}</span>
              </div>
            </div>

            <!-- 2. UP NEXT BLOCK -->
            <div class="side-guide-next-box">
              <div class="side-guide-section-header">
                <span class="side-guide-next-tag">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
                  NEXT
                </span>
                <span class="side-guide-time-pill next-time-pill">${nextTimeRange}</span>
              </div>
              <div class="side-guide-next-title" title="${nextTitle}">${nextTitle}</div>
              ${nextDuration ? `
                <div class="side-guide-next-meta">
                  <span class="side-guide-next-duration">${nextDuration}</span>
                </div>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Attach click listeners to cards
    listEl.querySelectorAll('.side-guide-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (this.justDraggedSideGuide) return;
        if (e.target.closest('.side-guide-fav-btn')) return;
        const targetId = card.dataset.channelId;
        if (targetId && targetId !== this.currentChannel?.id) {
          this.openPlayer(targetId);
        }
      });
    });

    // Attach favorite toggle listeners
    listEl.querySelectorAll('.side-guide-fav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const chId = btn.dataset.favId;
        if (chId && window.ivtvStorage) {
          const added = window.ivtvStorage.toggleFavorite(chId);
          btn.classList.toggle('is-fav', added);
          const svg = btn.querySelector('svg');
          if (svg) svg.setAttribute('fill', added ? '#fbbf24' : 'none');
          if (this.currentChannel?.id === chId) {
            this.updatePlayerFavState();
          }
          if (this.sideGuideCategory === 'Favorites') {
            this.renderSideGuideList();
          }
        }
      });
    });
  }

  togglePlayPause() {
    if (!this.video) return;

    if (this.video.paused) {
      this.video.play().then(() => {
        this.updatePlayPauseUI(true);
        if (window.showToast) window.showToast('Playback Resumed', 'info');
      }).catch(err => {
        console.warn('Play error:', err);
      });
    } else {
      this.video.pause();
      this.updatePlayPauseUI(false);
      if (window.showToast) window.showToast('Playback Paused', 'info');
    }
  }

  updatePlayPauseUI(isPlaying) {
    const btn = document.getElementById('theater-play-pause-btn');
    const icon = document.getElementById('theater-play-pause-icon');
    const label = document.getElementById('theater-play-pause-label');

    if (isPlaying) {
      if (icon) {
        icon.innerHTML = `
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1"/>
            <rect x="14" y="4" width="4" height="16" rx="1"/>
          </svg>
        `;
      }
      if (label) label.textContent = 'Pause';
      if (btn) {
        btn.classList.remove('is-paused');
        btn.title = 'Pause Live Stream (Space or K)';
      }
    } else {
      if (icon) {
        icon.innerHTML = `
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="6 4 20 12 6 20 6 4"/>
          </svg>
        `;
      }
      if (label) label.textContent = 'Play';
      if (btn) {
        btn.classList.add('is-paused');
        btn.title = 'Play Live Stream (Space or K)';
      }
    }
  }

  openPlayer(channelId) {
    const channel = window.IVTV_DATA.channels.find(c => c.id === channelId);
    if (!channel) return;

    this.currentChannel = channel;
    this.isOpen = true;
    this.engineMode = 'direct'; // Default to pristine direct stream

    // Synchronous User Gesture: prime sound to active using user preference
    if (this.video) {
      this.video.volume = this.savedVolume;
      this.video.muted = this.isUserMuted;
    }

    // Track recently watched
    if (window.ivtvStorage) {
      window.ivtvStorage.addToRecent(channel.id);
    }

    // Update Player UI details
    const chNumStr = channel.chNumber ? ` • CH ${channel.chNumber}` : '';
    const logoSrc = channel.logo || channel.logoUrl || '';
    const logoTag = logoSrc ? `<img src="${logoSrc}" class="theater-channel-logo" alt="${channel.name}">` : '';
    document.getElementById('theater-channel-title').innerHTML = `${logoTag}<span>${channel.name}${chNumStr}</span>`;
    this.updateTheaterViewerCount(channel);
    this.updatePlayerFavState();
    this.updatePlayerEPGTicker(channel.id);
    this.updatePlayPauseUI(true);
    this.applyAspectRatio(this.aspectRatioMode, false);

    // Dismiss any open EPG details modal or TV Guide modal
    if (window.UIControllerInstance) {
      window.UIControllerInstance.hideProgramDetails();
      window.UIControllerInstance.closeTVGuide();
    }

    // Show modal
    this.modal.classList.add('active');
    document.body.classList.add('theater-active');
    document.body.style.overflow = 'hidden';

    // Start playing ad-free stream
    this.playChannel(channel.id);

    // Show Broadcast Channel OSD HUD
    this.showChannelOSD(channel);

    // Reset controls visibility
    if (this.modalContainer) {
      this.modalContainer.classList.remove('controls-hidden');
    }

    // Populate in-player channel switcher and ensure bottom surf drawer is open
    this.renderInPlayerSurfList(channel.category, channel.id);
    this.toggleSurfDrawer(true);
    if (this.isSideGuideOpen) {
      this.renderSideGuideList();
    }
  }

  updatePlayerEPGTicker(channelId) {
    const tickerTitle = document.getElementById('theater-ticker-title');
    const tickerProgress = document.getElementById('theater-ticker-progress');
    const tickerTime = document.getElementById('theater-ticker-time');
    const tickerNext = document.getElementById('theater-ticker-next');

    if (!window.ivtvEPG) return;
    const current = window.ivtvEPG.getCurrentProgram(channelId);
    if (!current) return;

    if (tickerTitle) tickerTitle.textContent = current.title;
    if (tickerProgress) tickerProgress.style.width = `${current.progressPercent || 0}%`;
    if (tickerTime) {
      tickerTime.textContent = `${current.startTimeFormatted} - ${current.endTimeFormatted} (${current.minutesLeft}m left)`;
    }
    if (tickerNext) {
      if (current.next) {
        tickerNext.textContent = `${current.next.title} (${current.next.startTimeFormatted})`;
      } else {
        tickerNext.textContent = 'Stay tuned for upcoming broadcast';
      }
    }
  }

  showOfflineOverlay() {
    if (this.loader) this.loader.classList.add('hidden');
    if (this.errorOverlay) {
      this.errorOverlay.classList.remove('hidden');
      const icon = document.getElementById('theater-error-icon');
      const title = document.getElementById('theater-error-title');
      const desc = document.getElementById('theater-error-desc');
      const switchBtn = document.getElementById('theater-error-switch-btn');
      const guideBtn = document.getElementById('theater-error-guide-btn');
      const extBtn = document.getElementById('theater-error-external-btn');
      const retryBtn = document.getElementById('theater-error-retry-btn');

      if (icon) {
        icon.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.58 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>`;
      }
      if (title) title.textContent = 'Offline Mode Active';
      if (desc) desc.textContent = 'Live video streams require an active internet connection. Your complete 24-hour EPG TV Guide, saved Watchlist, and channel catalog remain fully functional offline.';
      if (switchBtn) switchBtn.style.display = 'none';
      if (extBtn) extBtn.style.display = 'none';
      if (guideBtn) {
        guideBtn.style.display = 'inline-block';
        guideBtn.onclick = () => {
          this.closePlayer();
          if (window.UIControllerInstance) {
            window.UIControllerInstance.openTVGuide();
          }
        };
      }
      if (retryBtn) {
        retryBtn.textContent = 'Check Connection';
        retryBtn.onclick = () => {
          if (navigator.onLine) {
            this.resetErrorOverlayUI();
            this.reloadStream();
          } else {
            window.showToast('Currently offline — connect to the internet to resume stream', 'info');
          }
        };
      }
    }
  }

  resetErrorOverlayUI() {
    const icon = document.getElementById('theater-error-icon');
    const title = document.getElementById('theater-error-title');
    const desc = document.getElementById('theater-error-desc');
    const switchBtn = document.getElementById('theater-error-switch-btn');
    const guideBtn = document.getElementById('theater-error-guide-btn');
    const extBtn = document.getElementById('theater-error-external-btn');
    const retryBtn = document.getElementById('theater-error-retry-btn');

    if (icon) {
      icon.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/><path d="M19.1 4.9C23 8.8 23 15.2 19.1 19.1"/></svg>`;
    }
    if (title) title.textContent = 'Live Stream Connecting...';
    if (desc) desc.textContent = 'If direct HD playback is slow to connect or throttled by your ISP, switch to the Mirror Player for instant broadcast.';
    if (switchBtn) switchBtn.style.display = 'inline-block';
    if (extBtn) extBtn.style.display = 'inline-block';
    if (guideBtn) guideBtn.style.display = 'none';
    if (retryBtn) {
      retryBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> <span>Retry Direct</span>`;
      retryBtn.onclick = () => {
        if (this.errorOverlay) this.errorOverlay.classList.add('hidden');
        this.reloadStream();
      };
    }
  }

  async playChannel(channelId) {
    this.resetErrorOverlayUI();
    if (!navigator.onLine) {
      this.showOfflineOverlay();
      return;
    }
    if (this.loader) {
      this.loader.classList.remove('hidden');
    }
    if (this.errorOverlay) {
      this.errorOverlay.classList.add('hidden');
    }
    this.hideUnmuteBadge();
    this.fatalErrorCount = 0;
    this.consecutiveStallCount = 0;
    this.lastStallTime = 0;
    this.stopWatchTicker();

    // Track accurate view event
    if (window.ivtvStorage && typeof window.ivtvStorage.trackChannelView === 'function') {
      window.ivtvStorage.trackChannelView(channelId);
    }

    // Destroy existing Hls instance
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }



    // If user explicitly chose Mirror Player engine
    if (this.engineMode === 'mirror') {
      this.loadEmbedMirror(channelId);
      return;
    }

    // Direct HD Native Video + Hls.js Mode
    this.setEngineUI('direct', 'Direct HD');
    if (this.modalContainer) {
      this.modalContainer.classList.remove('has-iframe-active');
    }
    if (this.youtubeIframe) {
      this.youtubeIframe.src = '';
      this.youtubeIframe.style.display = 'none';
      this.youtubeIframe.classList.remove('crop-channel5-nav');
    }
    if (this.video) {
      this.video.style.display = 'block';
      this.video.currentTime = 0;
    }

    // Set 6.5-second Black Screen Watchdog: If no video frames arrive or stream is stalled, auto-switch to mirror
    this.watchdogTimer = setTimeout(() => {
      if (this.isOpen && this.engineMode === 'direct') {
        const isActuallyRendering = this.video && !this.video.paused && this.video.videoWidth > 0 && this.video.currentTime > 0.1;
        if (!isActuallyRendering) {
          console.warn('[IVTV Player] Black screen / stalled stream detected by 6.5s watchdog.');
          const ch = this.currentChannel;
          const fallback = this.fallbackEmbedUrl || (ch && ch.iframeUrl);
          console.log('[IVTV Player] Watchdog: Auto-recovering via Mirror Player.');
          window.showToast('Stream recovered via Mirror Player ⚡', 'info');
          this.loadEmbedMirror(channelId, fallback);
        }
      }
    }, 6500);

    try {
      // Query clean stream URL from local server API
      const res = await fetch(`/api/stream?channel=${channelId}`);
      const data = await res.json();

      if (data && data.success && data.type === 'youtube' && data.streamUrl) {
        this.setEngineUI('youtube', 'YouTube HD');
        if (this.modalContainer) {
          this.modalContainer.classList.add('has-iframe-active');
          this.modalContainer.classList.remove('controls-hidden');
        }
        if (this.video) {
          this.video.pause();
          this.video.style.display = 'none';
        }
        if (this.youtubeIframe) {
          this.youtubeIframe.classList.remove('crop-channel5-nav');
          this.youtubeIframe.style.display = 'block';
          this.youtubeIframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation allow-forms allow-fullscreen');
          this.youtubeIframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen');
          this.youtubeIframe.setAttribute('allowfullscreen', 'true');
          this.youtubeIframe.src = data.streamUrl;
        }
        setTimeout(() => {
          if (this.loader) this.loader.classList.add('hidden');
        }, 800);
        return;
      }

      if (data && data.success && (data.type === 'iframe' || data.type === 'embed') && data.streamUrl) {
        this.setEngineUI('embed', 'Official Player');
        if (this.video) {
          this.video.pause();
          this.video.style.display = 'none';
        }
        this.loadEmbedMirror(channelId, data.streamUrl);
        return;
      }

      if (data && data.success && (data.type === 'hls' || data.type === 'hls-proxy') && data.streamUrl) {
        this.fallbackEmbedUrl = data.fallbackEmbedUrl || '';
        this.initHlsStream(data.streamUrl, data.channelSlug, data.currentToken, data.fallbackEmbedUrl);
      } else if (data && data.fallbackEmbedUrl) {
        console.log('[IVTV Player] Direct HLS unavailable, auto-switching to Mirror Player.');
        this.loadEmbedMirror(channelId, data.fallbackEmbedUrl);
      } else {
        throw new Error((data && data.error) || 'Stream lookup failed');
      }
    } catch (err) {
      if (!navigator.onLine) {
        this.showOfflineOverlay();
        return;
      }
      console.warn('[IVTV Player] API lookup error, falling back to mirror:', err);
      this.loadEmbedMirror(channelId);
    }
  }

  initHlsStream(streamUrl, slug, token, fallbackEmbedUrl) {
    if (!this.video) return;

    const resolvedUrl = (typeof streamUrl === 'string' && streamUrl.startsWith('/'))
      ? (window.location.origin + streamUrl)
      : streamUrl;

    if (window.Hls && Hls.isSupported()) {
      this.hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 30, // Prune segments >30s behind playhead to eliminate RAM bloat and QuotaExceededError
        maxBufferLength: 20, // 20s forward buffer prevents starvation while conserving memory
        maxMaxBufferLength: 30,
        maxBufferSize: 30 * 1000 * 1000, // 30MB SourceBuffer limit
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 10,
        liveDurationInfinity: true,
        maxBufferHole: 0.5,
        highBufferWatchdogPeriod: 2,
        nudgeOffset: 0.2,
        nudgeMaxRetry: 8,
        enableSoftwareAES: true,
        manifestLoadingTimeOut: 10000,
        manifestLoadingMaxRetry: 5,
        manifestLoadingRetryDelay: 1000,
        levelLoadingTimeOut: 10000,
        levelLoadingMaxRetry: 5,
        levelLoadingRetryDelay: 1000,
        fragLoadingTimeOut: 15000,
        fragLoadingMaxRetry: 5,
        fragLoadingRetryDelay: 1000
      });

      this.hls.loadSource(resolvedUrl);
      this.hls.attachMedia(this.video);

      // Verify active video decoding before dismissing loader and watchdog
      const onRenderSuccess = () => {
        if (this.video && this.video.videoWidth > 0 && this.video.currentTime > 0.1 && !this.video.paused) {
          if (this.loader) this.loader.classList.add('hidden');
          if (this.errorOverlay) this.errorOverlay.classList.add('hidden');
          if (this.watchdogTimer) {
            clearTimeout(this.watchdogTimer);
            this.watchdogTimer = null;
          }
          this.stallCount = 0;
          this.consecutiveStallCount = 0;
          this.fatalErrorCount = 0;

          if (!this.watchTimeTicker && this.isOpen) {
            this.startWatchTicker();
          }
        }
      };

      this.video.addEventListener('timeupdate', onRenderSuccess, { passive: true });
      this.video.addEventListener('playing', onRenderSuccess, { passive: true });

      const startPlayback = () => {
        if (!this.video) return;

        // Apply user's saved volume and mute preference
        this.video.volume = this.savedVolume;
        this.video.muted = this.isUserMuted;

        const playPromise = this.video.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            // Playback started!
            this.isAutoplayMuted = false;
            this.hideUnmuteBadge();
            this.updateVolumeUI();
            this.startWatchTicker();
          }).catch((err) => {
            console.log('[IVTV Player] Autoplay restricted by browser, engaging muted play with sound badge:', err.name);
            this.isAutoplayMuted = true;
            this.video.muted = true;
            this.video.play().then(() => {
              this.showUnmuteBadge();
              this.updateVolumeUI();
              this.startWatchTicker();
            }).catch(e => console.warn('[IVTV Player] Muted play attempt notice:', e));
          });
        }
      };

      this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
        startPlayback();
      });

      this.hls.on(Hls.Events.BUFFER_APPENDED, () => {
        // One-time seek past dead zero timestamp if live stream buffer starts ahead
        if (this.video && this.video.buffered && this.video.buffered.length > 0) {
          const bufStart = this.video.buffered.start(0);
          if (this.video.currentTime < bufStart - 0.5) {
            try {
              this.video.currentTime = bufStart + 0.2;
            } catch (e) { }
          }
        }
        if (this.video && this.video.paused) {
          startPlayback();
        }
      });

      this.hls.on(Hls.Events.ERROR, (event, data) => {
        const now = Date.now();
        const upstreamHttpCode = data && data.response && Number(data.response.code);
        const isForbiddenStream = [403, 404, 410].includes(upstreamHttpCode) ||
          (data &&
            data.type === Hls.ErrorTypes.NETWORK_ERROR &&
            data.details === Hls.ErrorDetails.HTTP_ERROR &&
            data.response &&
            [403, 404, 410].includes(data.response.code));

        if (isForbiddenStream) {
          console.warn('[IVTV Player] Upstream HLS media rejected or expired, switching to Mirror Player.');
          const ch = this.currentChannel;
          const fallback = fallbackEmbedUrl || (ch && ch.iframeUrl);
          if (fallback) {
            this.loadEmbedMirror(this.currentChannel?.id, fallback);
            return;
          }
        }

        // 1. Buffer stall handling
        if (data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR) {
          if (now - this.lastStallTime > 15000) {
            this.consecutiveStallCount = 0;
          }
          this.consecutiveStallCount = (this.consecutiveStallCount || 0) + 1;
          this.lastStallTime = now;
          console.warn(`[IVTV Player] Stream buffer stall #${this.consecutiveStallCount}`);

          // Nudge playhead forward within buffer window or align with live sync position
          if (this.video && this.video.buffered && this.video.buffered.length > 0) {
            const bufEnd = this.video.buffered.end(this.video.buffered.length - 1);
            if (this.video.currentTime < bufEnd - 0.4) {
              console.log('[IVTV Player] Nudging playhead forward to jump buffer gap');
              this.video.currentTime += 0.2;
            } else if (this.hls && this.hls.liveSyncPosition) {
              console.log('[IVTV Player] Aligning playhead to liveSyncPosition');
              this.video.currentTime = this.hls.liveSyncPosition;
            }
          }

          if (this.hls) {
            this.hls.startLoad();
          }

          // Only switch to Mirror Player if stalls persist repeatedly for >= 5 cycles within a short window
          if (this.consecutiveStallCount >= 5) {
            const ch = this.currentChannel;
            const fallback = fallbackEmbedUrl || (ch && ch.iframeUrl);
            if (fallback) {
              console.warn('[IVTV Player] Buffer stalled repeatedly, auto-switching to Mirror Player.');
              this.loadEmbedMirror(this.currentChannel?.id, fallback);
              return;
            }
          }
        }

        // 2. Buffer full handling (prevent QuotaExceededError during long watching)
        if (data.details === Hls.ErrorDetails.BUFFER_FULL_ERROR) {
          console.warn('[IVTV Player] Buffer full warning, cleaning up buffer memory...');
          try {
            if (this.hls) {
              this.hls.cleanUpBuffer(15);
            }
          } catch (e) { }
        }

        // 3. Fatal errors handling
        if (data.fatal) {
          this.fatalErrorCount++;
          console.warn(`[IVTV Player] Fatal HLS error #${this.fatalErrorCount} (${data.type}/${data.details})`);

          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              if (!navigator.onLine) {
                this.showOfflineOverlay();
                return;
              }
              if (this.fatalErrorCount >= 3) {
                console.warn('[IVTV Player] Multiple network errors, auto-switching to Mirror Player.');
                const ch = this.currentChannel;
                const fallback = fallbackEmbedUrl || (ch && ch.iframeUrl);
                this.loadEmbedMirror(this.currentChannel?.id, fallback);
                return;
              }
              console.log('[IVTV Player] Attempting HLS network recovery (startLoad)...');
              setTimeout(() => {
                if (this.hls) this.hls.startLoad();
              }, 1000);
              break;

            case Hls.ErrorTypes.MEDIA_ERROR:
              if (!this.mediaErrorRecoveries) this.mediaErrorRecoveries = 0;
              this.mediaErrorRecoveries++;
              if (this.mediaErrorRecoveries === 1) {
                console.warn('[IVTV Player] Media decode error #1, attempting recoverMediaError()...');
                this.hls.recoverMediaError();
              } else if (this.mediaErrorRecoveries === 2) {
                console.warn('[IVTV Player] Media decode error #2, swapping audio codec and recovering...');
                try { this.hls.swapAudioCodec(); } catch (e) { }
                this.hls.recoverMediaError();
              } else {
                console.warn('[IVTV Player] Persistent media error, auto-falling back to Mirror Player...');
                this.mediaErrorRecoveries = 0;
                const ch = this.currentChannel;
                const fallback = fallbackEmbedUrl || (ch && ch.iframeUrl);
                this.loadEmbedMirror(this.currentChannel?.id, fallback);
              }
              break;

            default:
              if (this.fatalErrorCount >= 2) {
                const ch = this.currentChannel;
                const fallback = fallbackEmbedUrl || (ch && ch.iframeUrl);
                this.loadEmbedMirror(this.currentChannel?.id, fallback);
              } else {
                this.reloadStream();
              }
              break;
          }
        }
      });

      // Background token heartbeat refresh every 3 minutes (keeps server token cache fresh without tearing down player)
      if (slug && token) {
        this.scheduleTokenRefresh(slug, token);
      }
    } else if (this.video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native Apple Safari HLS playback
      this.video.src = streamUrl;
      this.video.volume = this.savedVolume;
      this.video.muted = this.isUserMuted;
      this.video.play().catch(() => {
        this.isAutoplayMuted = true;
        this.video.muted = true;
        this.video.play();
        this.showUnmuteBadge();
      });
      this.video.addEventListener('loadeddata', () => {
        if (this.loader) this.loader.classList.add('hidden');
      }, { once: true });
    }
  }

  loadEmbedMirror(channelId, customUrl) {
    this.engineMode = 'mirror';
    this.setEngineUI('mirror', 'Mirror Player');

    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    if (this.video) {
      this.video.pause();
      this.video.src = '';
      this.video.style.display = 'none';
    }
    this.hideUnmuteBadge();
    if (this.errorOverlay) {
      this.errorOverlay.classList.add('hidden');
    }
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }

    const ch = (window.IVTV_DATA && window.IVTV_DATA.channels.find(c => c.id === channelId)) || this.currentChannel;
    let embedUrl = customUrl || this.fallbackEmbedUrl || (ch && ch.iframeUrl) || `https://freeshot.live/embed/${channelId}.php`;

    // Strictly route external mirrors through the ad-sanitizing reverse proxy (bypass for official Channel 5)
    if (embedUrl && !embedUrl.includes('youtube') && !embedUrl.includes('channel5.com') && !embedUrl.startsWith('/api/proxy/embed')) {
      embedUrl = `/api/proxy/embed?url=${encodeURIComponent(embedUrl)}`;
    }

    const isChannel5 = channelId === 'channel5' || 
                       channelId === 'channel5-uk' || 
                       (embedUrl && embedUrl.includes('channel5.com'));

    if (this.modalContainer) {
      this.modalContainer.classList.add('has-iframe-active');
      this.modalContainer.classList.remove('controls-hidden');
    }

    if (this.youtubeIframe) {
      this.youtubeIframe.style.display = 'block';
      this.youtubeIframe.classList.toggle('crop-channel5-nav', Boolean(isChannel5));
      this.youtubeIframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation allow-forms allow-fullscreen allow-popups');
      this.youtubeIframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen');
      this.youtubeIframe.setAttribute('allowfullscreen', 'true');
      this.youtubeIframe.src = embedUrl;
    }

    setTimeout(() => {
      if (this.loader) this.loader.classList.add('hidden');
    }, 1200);

    window.showToast('Switched to Mirror Player ⚡', 'info');
  }

  switchToEmbedMirror() {
    if (!this.currentChannel) return;
    this.loadEmbedMirror(this.currentChannel.id);
  }

  toggleEngine() {
    if (!this.currentChannel) return;

    if (this.engineMode === 'direct') {
      this.loadEmbedMirror(this.currentChannel.id);
    } else {
      this.engineMode = 'direct';
      this.playChannel(this.currentChannel.id);
      window.showToast('Switched to Direct HD Engine 🚀', 'info');
    }
  }

  setEngineUI(mode, label) {
    if (this.engineLabel) this.engineLabel.textContent = label;
    if (this.engineIcon) {
      if (mode === 'direct') {
        this.engineIcon.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;
      } else if (mode === 'youtube') {
        this.engineIcon.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
      } else {
        this.engineIcon.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><polyline points="8 21 12 17 16 21"/></svg>`;
      }
    }
    if (this.engineBtn) {
      this.engineBtn.classList.toggle('active', mode === 'mirror');
      this.engineBtn.style.display = (mode === 'youtube') ? 'none' : 'flex';
    }
  }

  setVolume(vol, showHud = true) {
    if (!this.video) return;
    vol = Math.max(0, Math.min(1, parseFloat(vol)));
    this.savedVolume = vol;
    try {
      localStorage.setItem('ivtv_player_volume', vol.toString());
    } catch (e) { }

    this.video.volume = vol;
    if (vol > 0 && this.video.muted) {
      this.video.muted = false;
      this.isUserMuted = false;
      try {
        localStorage.setItem('ivtv_player_muted', 'false');
      } catch (e) { }
    } else if (vol === 0) {
      this.video.muted = true;
      this.isUserMuted = true;
      try {
        localStorage.setItem('ivtv_player_muted', 'true');
      } catch (e) { }
    }

    this.isAutoplayMuted = false;
    this.hideUnmuteBadge();
    this.updateVolumeUI();
    if (showHud) {
      this.showVolumeHUD();
    }
  }

  adjustVolume(delta) {
    let current = (this.video && !this.video.muted) ? this.video.volume : (this.savedVolume || 0.85);
    let next = Math.round((current + delta) * 100) / 100;
    this.setVolume(next, true);
  }

  showVolumeHUD() {
    if (!this.volumeHud) return;
    const isMuted = !this.video || this.video.muted || this.video.volume === 0;
    const pct = isMuted ? 0 : Math.round(this.video.volume * 100);

    if (this.volumeHudFill) {
      this.volumeHudFill.style.width = `${pct}%`;
    }
    if (this.volumeHudText) {
      this.volumeHudText.textContent = `${pct}%`;
    }
    if (this.volumeHudIcon) {
      if (isMuted) {
        this.volumeHudIcon.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`;
      } else if (pct > 50) {
        this.volumeHudIcon.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;
      } else {
        this.volumeHudIcon.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;
      }
    }

    this.volumeHud.classList.remove('hidden');
    // Restart animation
    this.volumeHud.classList.remove('active');
    void this.volumeHud.offsetWidth; // trigger reflow
    this.volumeHud.classList.add('active');

    if (this.volumeHudTimer) clearTimeout(this.volumeHudTimer);
    this.volumeHudTimer = setTimeout(() => {
      if (this.volumeHud) {
        this.volumeHud.classList.remove('active');
        setTimeout(() => {
          if (this.volumeHud && !this.volumeHud.classList.contains('active')) {
            this.volumeHud.classList.add('hidden');
          }
        }, 300);
      }
    }, 1500);
  }

  unmute() {
    if (!this.video) return;
    this.video.muted = false;
    this.isUserMuted = false;
    this.isAutoplayMuted = false;
    try {
      localStorage.setItem('ivtv_player_muted', 'false');
    } catch (e) { }
    if (this.video.volume === 0) {
      this.video.volume = this.savedVolume > 0 ? this.savedVolume : 0.85;
    }
    this.video.play().catch(() => { });
    this.hideUnmuteBadge();
    this.updateVolumeUI();
    this.showVolumeHUD();
    window.showToast('Sound Enabled 🔊', 'success');
  }

  toggleMute() {
    if (!this.video) return;
    const willMute = !this.video.muted;
    this.video.muted = willMute;
    this.isUserMuted = willMute;
    try {
      localStorage.setItem('ivtv_player_muted', willMute ? 'true' : 'false');
    } catch (e) { }

    if (!willMute) {
      this.isAutoplayMuted = false;
      this.hideUnmuteBadge();
      if (this.video.volume === 0) {
        this.video.volume = this.savedVolume > 0 ? this.savedVolume : 0.85;
      }
    }
    this.updateVolumeUI();
    this.showVolumeHUD();
  }

  updateVolumeUI() {
    if (!this.video) return;

    const isMuted = this.video.muted || this.video.volume === 0;

    if (this.volIcon) {
      if (isMuted) {
        this.volIcon.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`;
      } else if (this.video.volume > 0.5) {
        this.volIcon.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;
      } else {
        this.volIcon.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;
      }
    }

    if (this.volumeSlider) {
      this.volumeSlider.value = isMuted ? 0 : this.video.volume;
      this.volumeSlider.title = `Volume: ${isMuted ? 'Muted' : Math.round(this.video.volume * 100) + '%'}`;
    }

    // Only show unmute badge if the sound is muted due to browser autoplay restriction!
    // Normal user mute or 0% volume should NOT trigger the badge.
    if (this.isAutoplayMuted) {
      this.showUnmuteBadge();
    } else {
      this.hideUnmuteBadge();
    }
  }

  showUnmuteBadge() {
    if (this.unmuteBadge) {
      this.unmuteBadge.classList.remove('hidden');
    }
  }

  hideUnmuteBadge() {
    if (this.unmuteBadge) {
      this.unmuteBadge.classList.add('hidden');
    }
  }

  startWatchTicker() {
    this.stopWatchTicker();
    this.watchTimeTicker = setInterval(() => {
      if (this.isOpen && this.video && !this.video.paused && this.video.currentTime > 0) {
        if (window.ivtvStorage && this.currentChannel) {
          window.ivtvStorage.trackWatchDuration(this.currentChannel.id, 20);
          this.updateTheaterViewerCount(this.currentChannel);
        }
      }
    }, 20000);
  }

  stopWatchTicker() {
    if (this.watchTimeTicker) {
      clearInterval(this.watchTimeTicker);
      this.watchTimeTicker = null;
    }
  }

  scheduleTokenRefresh(slug, token) {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);

    // Refresh token in the background every 180 seconds without tearing down player
    this.refreshTimer = setTimeout(async () => {
      try {
        const res = await fetch('/api/refresh_token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channel: slug, current_token: token })
        });
        const data = await res.json();
        if (data && data.success && data.token && this.isOpen) {
          console.log('[IVTV Player] Background token heartbeat refreshed successfully');
          this.scheduleTokenRefresh(slug, data.token);
        }
      } catch (e) {
        console.warn('[IVTV Player] Token heartbeat notice:', e);
      }
    }, 180000);
  }

  closePlayer() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.stopWatchTicker();
    this.modal.classList.remove('active');
    document.body.classList.remove('theater-active');
    document.body.style.overflow = '';
    if (this.isSideGuideOpen) {
      this.toggleSideGuide(false);
    }

    // Exit fullscreen if active
    const isNativeFs = !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
    if (isNativeFs) {
      const exitFn = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
      if (exitFn) {
        try {
          const res = exitFn.call(document);
          if (res && res.catch) res.catch(() => { });
        } catch (e) { }
      }
    }
    if (this.modalContainer) this.modalContainer.classList.remove('is-fullscreen');
    if (this.modal) this.modal.classList.remove('is-fullscreen', 'cinema-wide');
    this.handleFullscreenChange(false);

    // Stop and cleanup streams
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
    if (this.video) {
      this.video.pause();
      this.video.src = '';
    }
    if (this.youtubeIframe) {
      this.youtubeIframe.src = '';
      this.youtubeIframe.classList.remove('crop-channel5-nav');
    }
    this.hideUnmuteBadge();
    if (this.errorOverlay) {
      this.errorOverlay.classList.add('hidden');
    }
    const osd = document.getElementById('theater-channel-osd');
    if (osd) osd.classList.add('hidden');
    if (this.osdTimer) {
      clearTimeout(this.osdTimer);
      this.osdTimer = null;
    }
    if (this.controlsHideTimer) {
      clearTimeout(this.controlsHideTimer);
      this.controlsHideTimer = null;
    }
    if (this.modalContainer) {
      this.modalContainer.classList.remove('controls-hidden', 'has-iframe-active');
    }
    const popmenu = document.getElementById('theater-popmenu-wrapper');
    if (popmenu) popmenu.classList.remove('open');
    this.currentChannel = null;
  }

  reloadStream() {
    if (!this.currentChannel) return;
    this.playChannel(this.currentChannel.id);
    window.showToast(`Reloading ${this.currentChannel.name}...`, 'info');
  }

  toggleFullscreen() {
    const isNativeFs = !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
    const isPseudoFs = !!(
      this.modalContainer?.classList.contains('is-fullscreen') ||
      this.modal?.classList.contains('is-fullscreen')
    );

    if (isNativeFs) {
      // Exit native fullscreen
      const exitFn = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
      if (exitFn) {
        try {
          const res = exitFn.call(document);
          if (res && res.catch) res.catch(() => { });
        } catch (e) { }
      }
      this.handleFullscreenChange(false);
    } else if (isPseudoFs) {
      // Exit windowed fullscreen
      this.handleFullscreenChange(false);
      window.showToast?.('Exited Fullscreen', 'info');
    } else {
      // Enter fullscreen: attempt native fullscreen first with immediate robust fallback
      const target = this.modalContainer || this.modal || document.getElementById('theater-modal-container') || this.screenArea;
      if (!target) return;

      const reqFn = target.requestFullscreen || target.webkitRequestFullscreen || target.mozRequestFullScreen || target.msRequestFullscreen;

      if (reqFn) {
        try {
          const p = reqFn.call(target);
          if (p && p.then) {
            p.then(() => {
              this.handleFullscreenChange(true);
            }).catch(err => {
              console.warn('Native fullscreen request rejected by browser, using windowed fullscreen:', err);
              this.handleFullscreenChange(true);
            });
          } else {
            this.handleFullscreenChange(true);
          }
        } catch (err) {
          console.warn('Native fullscreen call error, using windowed fullscreen:', err);
          this.handleFullscreenChange(true);
        }
      } else if (this.video && this.video.webkitEnterFullscreen) {
        // iOS Safari native video fullscreen support
        try {
          this.video.webkitEnterFullscreen();
          this.handleFullscreenChange(true);
        } catch (e) {
          this.handleFullscreenChange(true);
        }
      } else {
        // Fallback for devices without native Fullscreen API
        this.handleFullscreenChange(true);
      }
    }
  }

  handleFullscreenChange(forcedState) {
    const isNativeFs = !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
    const isFs = (forcedState !== undefined) ? forcedState : isNativeFs;

    // Toggle fullscreen classes on container and overlay
    if (this.modalContainer) {
      this.modalContainer.classList.toggle('is-fullscreen', isFs);
    }
    if (this.modal) {
      this.modal.classList.toggle('is-fullscreen', isFs);
      this.modal.classList.toggle('cinema-wide', isFs);
    }

    // 1. Update Bottom Action Bar Fullscreen Button (#theater-fs-btn)
    const fsBtn = document.getElementById('theater-fs-btn');
    if (fsBtn) {
      fsBtn.classList.toggle('active', isFs);
      const label = isFs ? 'Exit Fullscreen' : 'Fullscreen';
      fsBtn.setAttribute('aria-label', label);
      const text = fsBtn.querySelector('.theater-control-tooltip');
      const svg = fsBtn.querySelector('svg');
      if (text) text.textContent = label;
      if (svg) {
        svg.innerHTML = isFs
          ? '<path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>'
          : '<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>';
      }
    }

    // Subtle feedback toast on fullscreen enter
    if (isFs && forcedState === true) {
      window.showToast?.('Fullscreen Mode Enabled', 'info');
    }
  }

  openInNewWindow() {
    if (!this.currentChannel) return;
    const targetUrl = this.fallbackEmbedUrl || (this.currentChannel && this.currentChannel.iframeUrl) || `/api/stream?channel=${this.currentChannel.id}`;
    window.open(targetUrl, '_blank', 'width=1020,height=620,scrollbars=no,resizable=yes');
    window.showToast(`Opened ${this.currentChannel.name} in pop-out window ↗`, 'info');
  }

  togglePlayerFavorite() {
    if (!this.currentChannel || !window.ivtvStorage) return;
    const added = window.ivtvStorage.toggleFavorite(this.currentChannel.id);
    this.updatePlayerFavState();
    window.showToast(
      added ? `Added ${this.currentChannel.name} to Favorites` : `Removed ${this.currentChannel.name} from Favorites`,
      added ? 'success' : 'info'
    );
  }

  updatePlayerFavState() {
    const favBtn = document.getElementById('theater-fav-btn');
    if (!favBtn || !this.currentChannel) return;
    const isFav = window.ivtvStorage && window.ivtvStorage.isFavorite(this.currentChannel.id);
    favBtn.classList.toggle('active', isFav);
    favBtn.innerHTML = `
      <svg class="fav-star-icon" width="13" height="13" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
      <span id="theater-fav-label">${isFav ? 'Favorited' : 'Favorite'}</span>
    `;
  }

  zapChannel(direction) {
    if (!this.currentChannel || !window.IVTV_DATA?.channels) return;
    const channels = window.IVTV_DATA.channels;
    const currentIndex = channels.findIndex(c => c.id === this.currentChannel.id);
    if (currentIndex === -1) return;

    let nextIndex = currentIndex + direction;
    if (nextIndex < 0) nextIndex = channels.length - 1;
    if (nextIndex >= channels.length) nextIndex = 0;

    const nextChannel = channels[nextIndex];
    if (nextChannel) {
      this.openPlayer(nextChannel.id);
    }
  }

  showChannelOSD(channel) {
    const osd = document.getElementById('theater-channel-osd');
    if (!osd) return;

    const logoImg = document.getElementById('osd-channel-logo');
    const chNum = document.getElementById('osd-channel-num');
    const chName = document.getElementById('osd-channel-name');
    const category = document.getElementById('osd-category');
    const progTitle = document.getElementById('osd-program-title');
    const progTime = document.getElementById('osd-program-time');

    const logoSrc = channel.logo || channel.logoUrl || '';
    if (logoImg) {
      logoImg.src = logoSrc;
      logoImg.style.display = logoSrc ? 'block' : 'none';
    }
    if (chNum) chNum.textContent = channel.chNumber ? `CH ${channel.chNumber}` : `CH 00`;
    if (chName) chName.textContent = channel.name;
    if (category) category.textContent = channel.category;

    if (window.ivtvEPG) {
      const prog = window.ivtvEPG.getCurrentProgram(channel.id);
      if (prog) {
        if (progTitle) progTitle.textContent = prog.title;
        if (progTime) progTime.textContent = `${prog.startTimeFormatted} - ${prog.endTimeFormatted}`;
      } else {
        if (progTitle) progTitle.textContent = 'Ad-Free High Definition Stream';
        if (progTime) progTime.textContent = '24/7 Live Broadcast';
      }
    }

    osd.classList.remove('hidden');
    if (this.osdTimer) clearTimeout(this.osdTimer);
    this.osdTimer = setTimeout(() => {
      osd.classList.add('hidden');
    }, 2800);
  }

  updateTheaterViewerCount(channel) {
    const viewerCount = document.querySelector('#theater-viewers-count span');
    if (viewerCount) {
      viewerCount.textContent = channel.views ? `${channel.views} viewers` : 'Viewers unavailable';
    }
  }

  applyAspectRatio(mode = 'stretch', showNotification = false) {
    const modes = ['stretch', 'fit', 'fill'];
    if (!modes.includes(mode)) mode = 'stretch';
    this.aspectRatioMode = mode;
    try {
      localStorage.setItem('ivtv_player_aspect', mode);
    } catch (e) { }

    const labels = {
      stretch: 'Stretch',
      fit: '16:9',
      fill: 'Zoom'
    };

    if (this.video) {
      this.video.classList.remove('aspect-fit', 'aspect-fill', 'aspect-stretch');
      this.video.classList.add(`aspect-${mode}`);
    }
    if (this.youtubeIframe) {
      this.youtubeIframe.classList.remove('aspect-fit', 'aspect-fill', 'aspect-stretch');
      this.youtubeIframe.classList.add(`aspect-${mode}`);
    }

    const label = document.getElementById('theater-aspect-label');
    if (label) label.textContent = labels[mode];

    if (showNotification && window.showToast) {
      window.showToast(`Aspect Ratio: ${labels[mode]}`, 'info');
    }
  }

  toggleAspectRatio() {
    const modes = ['stretch', 'fit', 'fill'];
    const currentIdx = modes.indexOf(this.aspectRatioMode);
    const nextMode = modes[(currentIdx + 1) % modes.length];
    this.applyAspectRatio(nextMode, true);
  }

  async togglePiP() {
    if (!this.video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await this.video.requestPictureInPicture();
        window.showToast('Picture-in-Picture active', 'info');
      } else {
        window.showToast('Picture-in-Picture not supported in this browser', 'info');
      }
    } catch (err) {
      console.warn('PiP error:', err);
    }
  }

  renderInPlayerSurfList(currentCategory, currentChannelId) {
    const surfTrack = document.getElementById('theater-surf-list');
    if (!surfTrack) return;

    const surfBtnLabel = document.getElementById('theater-surf-btn-label');
    if (surfBtnLabel && window.IVTV_DATA?.channels) {
      surfBtnLabel.textContent = `${window.IVTV_DATA.channels.length}`;
    }

    // Filter by selected category & search query
    let list = [...window.IVTV_DATA.channels];

    const isSports = (c) => {
      const category = (c.category || '').toLowerCase();
      const name = (c.name || '').toLowerCase();
      const id = (c.id || '').toLowerCase();
      return category === 'sports' || name.includes('sport') || id.includes('sport') || id.includes('f1') || id.includes('tnt');
    };

    if (this.surfCategory === 'Favorites') {
      const favIds = window.ivtvStorage ? window.ivtvStorage.getFavorites() : [];
      list = list.filter(c => favIds.includes(c.id));
    } else if (this.surfCategory === 'most-viewed') {
      const nonSports = list.filter(c => !isSports(c)).sort((a, b) => (b.viewsNum || 0) - (a.viewsNum || 0));
      const sports = list.filter(c => isSports(c)).sort((a, b) => (b.viewsNum || 0) - (a.viewsNum || 0));
      list = [...nonSports, ...sports].slice(0, 20);
    } else if (this.surfCategory === 'freeview') {
      const fvIds = [
        'bbc-one-uk', 'itv1-uk', 'channel4', 'channel5',
        'bbc-two-uk', 'bbc-three-uk', 'bbc-news-uk',
        'itv2-uk', 'itv3-uk', 'itv4-uk', 'film4-uk',
        'sky-news', 'gb-news'
      ];
      list = list.filter(c => fvIds.includes(c.id));
    } else if (this.surfCategory && this.surfCategory !== 'all') {
      list = list.filter(c => c.category === this.surfCategory);
    }

    if (this.surfQuery) {
      list = list.filter(c =>
        c.name.toLowerCase().includes(this.surfQuery) ||
        (c.chNumber && c.chNumber.toString().includes(this.surfQuery)) ||
        c.category.toLowerCase().includes(this.surfQuery)
      );
    }

    // Sort: Sports channels placed at the back unless user actively selected the "Sports" filter
    const isSportsCategorySelected = this.surfCategory === 'Sports';
    const cat = currentCategory || this.currentChannel?.category;

    const sorted = list.sort((a, b) => {
      if (!isSportsCategorySelected) {
        const aIsSport = isSports(a);
        const bIsSport = isSports(b);
        if (!aIsSport && bIsSport) return -1;
        if (aIsSport && !bIsSport) return 1;
      }

      if (cat) {
        if (a.category === cat && b.category !== cat) return -1;
        if (b.category === cat && a.category !== cat) return 1;
      }

      return (b.viewsNum || 0) - (a.viewsNum || 0);
    });

    if (sorted.length === 0) {
      surfTrack.innerHTML = `
        <div style="padding: 0.8rem 1rem; color: var(--text-muted); font-size: 0.75rem;">
          No channels found matching "${this.surfQuery || this.surfCategory}"
        </div>
      `;
      return;
    }

    surfTrack.innerHTML = sorted.map(ch => {
      const logoSrc = ch.logo || ch.logoUrl || '';
      const fallbackLogo = ch.logoUrl || '';
      const logoHtml = logoSrc
        ? `<img src="${logoSrc}" class="surf-channel-logo" alt="${ch.name}" loading="lazy" onerror="if(this.dataset.fb!=='1'&&'${fallbackLogo}'){this.dataset.fb='1';this.src='${fallbackLogo}';}else{this.style.display='none';}">`
        : '';

      // Get real-time What's On programme data
      let progTitle = `${ch.category} Live Broadcast`;
      let progTime = 'Broadcasting Live';
      let progressPercent = 50;
      let minsLeft = '';
      if (window.ivtvEPG) {
        const prog = window.ivtvEPG.getCurrentProgram(ch.id);
        if (prog) {
          progTitle = prog.title || progTitle;
          if (prog.startTimeFormatted && prog.endTimeFormatted) {
            progTime = `${prog.startTimeFormatted} - ${prog.endTimeFormatted}`;
          }
          if (prog.minutesLeft) {
            minsLeft = `${prog.minutesLeft}m left`;
          }
          progressPercent = typeof prog.progressPercent === 'number' ? prog.progressPercent : 50;
        }
      }

      const isActive = ch.id === currentChannelId;

      return `
        <button type="button" class="surf-channel-item ${isActive ? 'active' : ''}" data-channel-id="${ch.id}" title="${ch.name} — ${progTitle}">
          <div class="surf-card-header">
            <div class="surf-card-identity">
              ${logoHtml}
              <span class="surf-channel-name">
                ${ch.name}
                ${ch.chNumber ? `<span class="surf-ch-badge">${ch.chNumber}</span>` : ''}
              </span>
            </div>
            ${isActive ? '<span class="surf-watching-tag">PLAYING</span>' : '<span class="surf-live-tag">LIVE</span>'}
          </div>

          <div class="surf-card-whats-on">
            <div class="surf-prog-row">
              <span class="surf-now-tag">NOW</span>
              <span class="surf-prog-title" title="${progTitle}">${progTitle}</span>
            </div>
            <div class="surf-prog-footer">
              <span class="surf-prog-time">${progTime}</span>
              ${minsLeft ? `<span class="surf-prog-mins">${minsLeft}</span>` : ''}
            </div>
            <div class="surf-prog-progress">
              <div class="surf-prog-progress-fill" style="width: ${progressPercent}%;"></div>
            </div>
          </div>
        </button>
      `;
    }).join('');

    // Attach click handlers
    surfTrack.querySelectorAll('.surf-channel-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = item.dataset.channelId;
        if (id && id !== this.currentChannel?.id) {
          this.openPlayer(id);
        }
      });
    });

    // Enable horizontal scroll and drag on the surf drawer track
    if (window.enableHorizontalScrollAndDrag) {
      window.enableHorizontalScrollAndDrag(surfTrack);
    }
  }
}

// Global player controller
window.ivtvPlayer = new PlayerController();
