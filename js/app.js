/* ==========================================================================
   IVTV APPLICATION BOOTSTRAPPER
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Components
  if (window.ivtvPlayer) {
    window.ivtvPlayer.init();
  }

  if (window.UIControllerInstance) {
    window.UIControllerInstance.init();
  }

  // Navbar Dynamic Blur on Scroll
  const header = document.querySelector('.app-header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      header?.classList.add('scrolled');
    } else {
      header?.classList.remove('scrolled');
    }
  });

  // ==========================================================================
  // AUTO-VERSION CHECK & HARD CACHE PURGE (STANDALONE DESKTOP SYNC)
  // Ensures standalone app window always displays latest code without cache lag
  // ==========================================================================
  const APP_BUILD_VER = 'v77';
  const lastKnownVer = localStorage.getItem('ivtv_client_build_ver');

  if (lastKnownVer !== APP_BUILD_VER) {
    localStorage.setItem('ivtv_client_build_ver', APP_BUILD_VER);
    if ('caches' in window) {
      caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        for (const reg of regs) reg.unregister();
      });
    }
    if (lastKnownVer && lastKnownVer !== APP_BUILD_VER) {
      setTimeout(() => {
        window.location.reload(true);
      }, 100);
      return;
    }
  }

  // Dedicated App Reload Button (Top Floating Glass Navbar)
  const reloadBtn = document.getElementById('app-reload-btn');
  if (reloadBtn) {
    reloadBtn.addEventListener('click', async () => {
      reloadBtn.style.transform = 'rotate(360deg)';
      reloadBtn.style.transition = 'transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)';
      if (window.showToast) window.showToast('Refreshing TV channels & layout...', 'info');
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const r of regs) await r.unregister();
      }
      setTimeout(() => {
        window.location.reload(true);
      }, 150);
    });
  }

  // Handle PWA / Standalone Desktop Installation
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
  });

  const installAppBtn = document.getElementById('nav-install-app-btn');
  if (installAppBtn) {
    installAppBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice && choice.outcome === 'accepted') {
          if (window.showToast) window.showToast('IVTV installed to desktop successfully!', 'success');
        }
        deferredPrompt = null;
      } else {
        if (window.showToast) {
          window.showToast('Standalone desktop app ready! Launch "IV - TV" from your Desktop.', 'success');
        }
      }
    });
  }

  // Global Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    // Standalone desktop refresh (F5 or Ctrl+R)
    if (e.key === 'F5' || (e.ctrlKey && e.key.toLowerCase() === 'r')) {
      e.preventDefault();
      if ('caches' in window) {
        caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).then(() => {
          window.location.reload(true);
        });
      } else {
        window.location.reload(true);
      }
      return;
    }

    // Focus search on '/' or 'Ctrl+K'
    if ((e.key === '/' || (e.ctrlKey && e.key === 'k')) && document.activeElement.tagName !== 'INPUT') {
      e.preventDefault();
      const searchInput = document.getElementById('nav-search-input');
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    }

    // Escape clears search or blurs
    if (e.key === 'Escape') {
      const searchInput = document.getElementById('nav-search-input');
      if (document.activeElement === searchInput) {
        searchInput.value = '';
        searchInput.blur();
        window.UIControllerInstance?.handleSearch('');
      }
    }
  });

  // Dedicated Brand Home Link Smooth Scroll
  const brandLogo = document.getElementById('brand-home-link');
  if (brandLogo) {
    brandLogo.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Smooth scroll links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (!href || href === '#' || href === '#!') {
        if (this.id === 'brand-home-link') {
          e.preventDefault();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        return;
      }
      e.preventDefault();
      try {
        const target = document.querySelector(href);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth' });
        }
      } catch (err) {}
    });
  });

  // ==========================================================================
  // SERVICE WORKER REGISTRATION (OFFLINE / PWA)
  // ==========================================================================
  if ('serviceWorker' in navigator && (window.location.protocol === 'http:' || window.location.protocol === 'https:')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js?v=49')
        .then((reg) => {
          reg.update();
          console.log('[IVTV PWA] Service Worker registered successfully (scope: ' + reg.scope + ')');
        })
        .catch((err) => {
          console.warn('[IVTV PWA] Service Worker registration note:', err);
        });
    });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload(true);
    });
  }

  // ==========================================================================
  // OFFLINE / ONLINE CONNECTIVITY MONITOR
  // ==========================================================================
  const statusPill = document.getElementById('network-status-pill');
  const statusText = document.getElementById('network-status-text');

  function updateNetworkStatus(isOnline, isInitial = false) {
    if (!statusPill) return;

    if (isOnline) {
      statusPill.className = 'network-status-pill online';
      statusPill.title = 'Network status: Connected to live UK feeds';
      if (statusText) statusText.textContent = 'ONLINE';
      if (!isInitial) {
        window.showToast('Back Online — Live streams reconnected', 'success');
        if (window.ivtvEPG && typeof window.ivtvEPG.refreshLiveEPG === 'function') {
          window.ivtvEPG.refreshLiveEPG();
        }
      }
    } else {
      statusPill.className = 'network-status-pill offline';
      statusPill.title = 'Network status: Offline mode active (EPG & Directory cached)';
      if (statusText) statusText.textContent = 'OFFLINE';
      if (!isInitial) {
        window.showToast('Offline Mode Active — Guide, Favorites & Directory available', 'info');
      }
    }
  }

  // Initial check
  updateNetworkStatus(navigator.onLine, true);

  // Network transition events
  window.addEventListener('online', () => updateNetworkStatus(true));
  window.addEventListener('offline', () => updateNetworkStatus(false));

  // Welcome Toast Notification
  setTimeout(() => {
    if (navigator.onLine) {
      window.showToast('IVTV Live — 70 UK & Sky Channels Streaming in HD', 'success');
    } else {
      window.showToast('IVTV Offline Mode — Full TV Guide & Directory Ready', 'info');
    }
  }, 900);
});
