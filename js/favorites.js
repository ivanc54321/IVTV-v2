/* ==========================================================================
   IVTV FAVORITES, STORAGE & DYNAMIC REAL-TIME VIEW TRACKER
   ========================================================================== */

const IVTV_STORAGE_KEYS = {
  FAVORITES: 'ivtv_favorites_v1',
  RECENT: 'ivtv_recent_v1',
  LAST_CHANNEL: 'ivtv_last_channel_v1',
  VIEW_STATS: 'ivtv_views_stats_v2'
};

class FavoritesManager {
  constructor() {
    this.favorites = this.loadFavorites();
    this.recent = this.loadRecent();
    this.viewStats = this.loadViewStats();

    if (typeof window !== 'undefined') {
      if (window.IVTV_DATA) {
        this.syncChannelViews();
      } else {
        document.addEventListener('DOMContentLoaded', () => this.syncChannelViews());
      }
    }
  }

  loadFavorites() {
    try {
      const data = localStorage.getItem(IVTV_STORAGE_KEYS.FAVORITES);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          return parsed.filter(id => !id.includes('sport') && !id.includes('f1') && !id.includes('premier-league'));
        }
      }
      return ['sky-atlantic-uk', 'sky-cinema-premiere-uk', 'bbc-one-uk'];
    } catch (e) {
      console.warn('LocalStorage error', e);
      return ['sky-atlantic-uk', 'sky-cinema-premiere-uk', 'bbc-one-uk'];
    }
  }

  saveFavorites() {
    try {
      localStorage.setItem(IVTV_STORAGE_KEYS.FAVORITES, JSON.stringify(this.favorites));
      window.dispatchEvent(new CustomEvent('ivtv:favorites-changed', { detail: { favorites: this.favorites } }));
    } catch (e) {
      console.warn('LocalStorage save error', e);
    }
  }

  isFavorite(channelId) {
    return this.favorites.includes(channelId);
  }

  toggleFavorite(channelId) {
    const index = this.favorites.indexOf(channelId);
    let added = false;
    if (index > -1) {
      this.favorites.splice(index, 1);
      added = false;
    } else {
      this.favorites.push(channelId);
      added = true;
    }
    this.saveFavorites();
    return added;
  }

  getFavorites() {
    return [...this.favorites];
  }

  loadRecent() {
    try {
      const data = localStorage.getItem(IVTV_STORAGE_KEYS.RECENT);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  addToRecent(channelId) {
    try {
      this.recent = this.recent.filter(id => id !== channelId);
      this.recent.unshift(channelId);
      if (this.recent.length > 12) {
        this.recent = this.recent.slice(0, 12);
      }
      localStorage.setItem(IVTV_STORAGE_KEYS.RECENT, JSON.stringify(this.recent));
      localStorage.setItem(IVTV_STORAGE_KEYS.LAST_CHANNEL, channelId);
      window.dispatchEvent(new CustomEvent('ivtv:recent-changed', { detail: { recent: this.recent } }));
    } catch (e) {
      console.warn('LocalStorage recent save error', e);
    }
  }

  getRecent() {
    return [...this.recent];
  }

  // ==========================================================================
  // DYNAMIC ACCURATE VIEW TRACKING
  // ==========================================================================

  loadViewStats() {
    try {
      const data = localStorage.getItem(IVTV_STORAGE_KEYS.VIEW_STATS);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      return {};
    }
  }

  saveViewStats() {
    try {
      localStorage.setItem(IVTV_STORAGE_KEYS.VIEW_STATS, JSON.stringify(this.viewStats));
    } catch (e) {
      console.warn('LocalStorage viewStats save error', e);
    }
  }

  formatViews(num) {
    if (!num || isNaN(num)) return '0';
    if (num >= 1000000) {
      return (num / 1000000).toFixed(2).replace(/\.?0+$/, '') + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(num >= 10000 ? 0 : 1).replace(/\.?0+$/, '') + 'K';
    }
    return num.toLocaleString();
  }

  syncChannelViews() {
    if (!window.IVTV_DATA || !Array.isArray(window.IVTV_DATA.channels)) return;
    for (const ch of window.IVTV_DATA.channels) {
      if (!ch._baseViewsNum) {
        ch._baseViewsNum = ch.viewsNum || 50000;
      }
      const stats = this.viewStats[ch.id];
      if (stats) {
        const extraViews = (stats.clicks || 0) * 150 + Math.floor((stats.seconds || 0) * 8);
        ch.viewsNum = ch._baseViewsNum + extraViews;
        ch.views = this.formatViews(ch.viewsNum);
      } else {
        ch.viewsNum = ch._baseViewsNum;
        ch.views = this.formatViews(ch.viewsNum);
      }
    }
  }

  trackChannelView(channelId) {
    if (!channelId) return;
    if (!this.viewStats[channelId]) {
      this.viewStats[channelId] = { clicks: 0, seconds: 0, lastWatched: 0 };
    }
    this.viewStats[channelId].clicks += 1;
    this.viewStats[channelId].lastWatched = Date.now();
    this.saveViewStats();
    this.syncChannelViews();
    window.dispatchEvent(new CustomEvent('ivtv:views-updated', { detail: { channelId } }));
  }

  trackWatchDuration(channelId, seconds = 20) {
    if (!channelId || !seconds) return;
    if (!this.viewStats[channelId]) {
      this.viewStats[channelId] = { clicks: 1, seconds: 0, lastWatched: Date.now() };
    }
    this.viewStats[channelId].seconds = (this.viewStats[channelId].seconds || 0) + seconds;
    this.viewStats[channelId].lastWatched = Date.now();
    this.saveViewStats();
    this.syncChannelViews();
    window.dispatchEvent(new CustomEvent('ivtv:views-updated', { detail: { channelId } }));
  }
}

// Toast Notification Helper
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span style="font-size: 1.1rem;">${type === 'success' ? '✓' : 'ℹ'}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// Create Global Instance
window.ivtvStorage = new FavoritesManager();
window.showToast = showToast;
