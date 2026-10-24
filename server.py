import http.server
import socketserver
import urllib.request
import urllib.parse
import json
import re
import os
import sys
import time
import datetime
import threading

# Handle headless/pythonw execution on Windows where sys.stdout and sys.stderr are None
if sys.stdout is None or sys.stderr is None:
    try:
        log_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'server.log')
        _log_file = open(log_path, 'a', encoding='utf-8')
        if sys.stdout is None:
            sys.stdout = _log_file
        if sys.stderr is None:
            sys.stderr = _log_file
    except Exception:
        if sys.stdout is None:
            sys.stdout = open(os.devnull, 'w')
        if sys.stderr is None:
            sys.stderr = open(os.devnull, 'w')

PORT = 5173

CHANNEL_SLUGS = {
    "sky-sports-f1-uk": "SkySportsF1",
    "sky-sports-premier-league-uk": "skysportspremierleague",
    "sky-sports-tennis-uk": "skysportstennisuk",
    "sky-sports-action-uk": "skysportsaction",
    "sky-sports-main-event-live-uk": "skysportsmainevent",
    "sky-sports-cricket-uk": "skysportscricketuk",
    "sky-sports-golf-uk": "skysportsgolfuk",
    "sky-sports-racing-uk": "SkySportsRacing",
    "sky-sports-news-uk": "skysportsnews",
    "sky-sports-mix-uk": "skysportsmixuk",
    "sky-sports-football-uk": "SkySportsFootballUK",
    "sky-sports-plus-uk": "skysportsplus",
    "sky-sports-laliga-uk": "ViaplayLaLigaUK",
    "trace-sports": "TraceSports",
    "rally-tv": "WRC",
    "sky-atlantic-uk": "SkyAtlantic",
    "sky-showcase": "SkyAtlantic", # fallback for inactive showcase
    "sky-comedy-uk": "SkyComedyUK",
    "sky-crime-uk": "SkyCrimeUK",
    "sky-history-uk": "SkyHistoryUK",
    "sky-arts-uk": "SkyArtsUK",
    "gold-uk": "GoldUK",
    "s4c-uk": "S4CUK",
    "itv1-uk": "ITV1",
    "itv2-uk": "ITV2",
    "itv3-uk": "ITV3",
    "itv4-uk": "ITV4",
    "itv1": "ITV1",
    "itv2": "ITV2",
    "itv3": "ITV3",
    "itv4": "ITV4",
    "bbc-one-uk": "BBConeUK",
    "bbc-two-uk": "BBCTwoUK",
    "bbc-three-uk": "BBCThreeUK",
    "bbc-one": "BBConeUK",
    "bbc-two": "BBCTwoUK",
    "bbc-three": "BBCThreeUK",
    "sky-cinema-action-uk": "SkyCinemaActionUK",
    "sky-cinema-hits-uk": "SkyCinemaHitsUK",
    "sky-cinema-thriller-uk": "SkyCinemaThrillerUK",
    "sky-cinema-select-uk": "SkyCinemaSelectUK",
    "sky-cinema-drama-uk": "SkyCinemaDramaUK",
    "sky-cinema-greats-uk": "SkyCinemaGreatsUK",
    "sky-cinema-sci-fi-horror-uk": "SkyCinemaSciFiHorrorUK",
    "sky-cinema-family-uk": "SkyCinemaFamilyUK",
    "sky-cinema-premiere-uk": "SkyCinemaPremiereUK",
    "sky-cinema-comedy-uk": "SkyCinemaComedyUK",
    "film4-uk": "Film4",
    "sky-news": "SkyNews",
    "bbc-news-uk": "BBCNewsUK",
    "gb-news": "GBNEWS",
    "reuters": "Reuters"
}

# Preload embed fallbacks from all-uk-channels.json or sky-tv-channels.json
CHANNEL_EMBEDS = {}
try:
    for filename in ['all-uk-channels.json', 'sky-tv-channels.json']:
        channels_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), filename)
        if os.path.exists(channels_file):
            with open(channels_file, 'r', encoding='utf-8') as f:
                _ch_data = json.load(f)
                for _ch in _ch_data.get('channels', []):
                    CHANNEL_EMBEDS[_ch['id']] = _ch.get('iframeUrl', '')
except Exception as e:
    print(f"[Init] Embed mappings warning: {e}")

import base64

# In-memory token and stream caches to guarantee uninterrupted 24/7 streaming
STREAM_CACHE = {}
ACTIVE_TOKENS = {} # slug -> {"token": token, "expires_at": float, "time": float}
TOKEN_LOCK = threading.Lock()

def extract_slug_from_url(url):
    if not url:
        return None
    unquoted = urllib.parse.unquote(url)
    m = re.search(r'bluetier\.top/([a-zA-Z0-9_-]+)/', unquoted)
    if m:
        return m.group(1)
    m = re.search(r'wideiptv\.top/player/([a-zA-Z0-9_-]+)', unquoted)
    if m:
        return m.group(1)
    m = re.search(r'token=([a-zA-Z0-9._-]+)', unquoted)
    if m:
        raw_b64 = m.group(1).split('.')[0]
        try:
            padded = raw_b64 + '=' * ((4 - len(raw_b64) % 4) % 4)
            decoded = base64.b64decode(padded).decode('utf-8', errors='ignore')
            parts = decoded.split('|')
            if parts and parts[0]:
                return parts[0]
        except Exception:
            pass
    return None

def get_valid_token_for_slug(slug, current_token=None, force_new=False):
    if not slug:
        return current_token
    now = time.time()
    with TOKEN_LOCK:
        if not force_new and slug in ACTIVE_TOKENS:
            info = ACTIVE_TOKENS[slug]
            # If current token still has at least 75s of lifetime, safely reuse
            if info.get('expires_at', 0) - now > 75:
                return info['token']

    new_token = None
    expires_in = 300

    # 1. Try refreshing via wideiptv refresh API if we have an existing token
    tok_to_try = current_token
    if not tok_to_try and slug in ACTIVE_TOKENS:
        tok_to_try = ACTIVE_TOKENS[slug].get('token')
    if tok_to_try:
        try:
            req_body = json.dumps({"channel": slug, "current_token": tok_to_try}).encode('utf-8')
            req = urllib.request.Request(
                'https://wideiptv.top/api/refresh_token.php',
                data=req_body,
                headers={
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    'Referer': 'https://wideiptv.top/'
                }
            )
            with urllib.request.urlopen(req, timeout=5) as res:
                rdata = json.loads(res.read().decode('utf-8'))
                if rdata.get('success') and rdata.get('token'):
                    new_token = rdata['token']
                    expires_in = rdata.get('expires_in', 300)
                    print(f"[Token Manager] Refreshed token for {slug} via API (expires in {expires_in}s)")
        except Exception as e:
            pass

    # 2. Fall back to scraping fresh token from player page
    if not new_token:
        try:
            p_url = f"https://wideiptv.top/player/{slug}"
            req = urllib.request.Request(p_url, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Referer': 'https://freeshot.live/'
            })
            with urllib.request.urlopen(req, timeout=6) as res:
                html = res.read().decode('utf-8', errors='ignore')
                tm = re.search(r'currentToken:\s*"([^"]+)"', html)
                if tm:
                    new_token = tm.group(1)
                    print(f"[Token Manager] Acquired fresh token for {slug} from player page")
        except Exception as e:
            print(f"[Token Manager] Failed to resolve token for {slug}: {e}")

    if new_token:
        with TOKEN_LOCK:
            ACTIVE_TOKENS[slug] = {
                "token": new_token,
                "expires_at": now + expires_in,
                "time": now
            }
        # Synchronize all active STREAM_CACHE entries matching this slug
        for ch_id, ch_slug in CHANNEL_SLUGS.items():
            if ch_slug.lower() == slug.lower() and ch_id in STREAM_CACHE:
                cached_data = STREAM_CACHE[ch_id].get("data", {})
                cached_data["currentToken"] = new_token
                if "directStreamUrl" in cached_data:
                    cached_data["directStreamUrl"] = re.sub(r'token=[^&]+', f'token={new_token}', cached_data["directStreamUrl"])
                    proxied_url = f"/api/proxy/hls?url={urllib.parse.quote(cached_data['directStreamUrl'], safe='')}&ref={urllib.parse.quote('https://wideiptv.top/', safe='')}"
                    cached_data["streamUrl"] = proxied_url
                STREAM_CACHE[ch_id]["time"] = now
        return new_token

    return current_token or (ACTIVE_TOKENS.get(slug, {}).get('token'))

# Sky News dynamic live YouTube resolver cache
SKY_NEWS_YT_CACHE = {"url": "https://www.youtube-nocookie.com/embed/v5_w9wC2Mrg?autoplay=1&modestbranding=1&rel=0", "time": 0}

def get_skynews_youtube_live_url():
    now = time.time()
    if now - SKY_NEWS_YT_CACHE["time"] < 600 and SKY_NEWS_YT_CACHE["url"]:
        return SKY_NEWS_YT_CACHE["url"]
    
    try:
        req = urllib.request.Request("https://www.youtube.com/@SkyNews/live", headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        })
        with urllib.request.urlopen(req, timeout=4) as resp:
            html = resp.read().decode('utf-8', errors='ignore')
            m = re.search(r'"videoId":"([a-zA-Z0-9_-]{11})"', html)
            if m:
                vid = m.group(1)
                new_url = f"https://www.youtube-nocookie.com/embed/{vid}?autoplay=1&modestbranding=1&rel=0"
                SKY_NEWS_YT_CACHE["url"] = new_url
                SKY_NEWS_YT_CACHE["time"] = now
                return new_url
    except Exception as e:
        print(f"[SkyNews] Live YT resolve warning: {e}")
    
    return SKY_NEWS_YT_CACHE["url"] or "https://www.youtube-nocookie.com/embed/live_stream?channel=UCoMdktPbSTixAyNGwb-5k9Q&autoplay=1"

def get_clean_stream(channel_id, force_refresh=False):
    fallback_url = CHANNEL_EMBEDS.get(channel_id, f"https://freeshot.live/embed/{CHANNEL_SLUGS.get(channel_id, 'SkySportsPremierLeague')}.php")
    
    if channel_id in ["sky-news", "skynews"]:
        yt_live = get_skynews_youtube_live_url()
        return {
            "success": True,
            "type": "hls",
            "streamUrl": "/api/proxy/hls?url=" + urllib.parse.quote("https://linear901-oo-hls0-prd-gtm.delivery.skycdp.com/17501/sde-fast-skynews/master.m3u8", safe=""),
            "fallbackEmbedUrl": yt_live,
            "channelId": channel_id
        }

    if channel_id in ["cnn-international", "cnn"]:
        return {
            "success": True,
            "type": "hls",
            "streamUrl": "/api/proxy/hls?url=https%3A%2F%2Fd3bp6dwmpbdajl.cloudfront.net%2Fv1%2Fmaster%2F3722c60a815c199d9c0ef36c5b73da68a62b09d1%2Fcc-ury0meh5m4nzm%2Findex.m3u8",
            "fallbackEmbedUrl": "https://www.freeintertv.com/view/id-200/1-1-0-1",
            "channelId": channel_id
        }

    if channel_id in ["bbc-one-uk", "bbc-one", "bbcone"]:
        return {
            "success": True,
            "type": "hls",
            "streamUrl": "/api/proxy/hls?url=" + urllib.parse.quote("https://vs-hls-pushb-uk-live.akamaized.net/x=4/i=urn:bbc:pips:service:bbc_one_yorks/iptv_hd_abr_v1.m3u8", safe=""),
            "fallbackEmbedUrl": "https://freeshot.live/embed/BBConeUK.php",
            "channelId": channel_id
        }

    if channel_id in ["bbc-two-uk", "bbc-two", "bbctwo"]:
        return {
            "success": True,
            "type": "hls",
            "streamUrl": "/api/proxy/hls?url=" + urllib.parse.quote("https://vs-hls-push-uk-live.akamaized.net/x=4/i=urn:bbc:pips:service:bbc_two_hd/iptv_hd_abr_v1.m3u8", safe=""),
            "fallbackEmbedUrl": "https://freeshot.live/embed/BBCTwoUK.php",
            "channelId": channel_id
        }

    if channel_id in ["bbc-three-uk", "bbc-three", "bbcthree"]:
        return {
            "success": True,
            "type": "hls",
            "streamUrl": "/api/proxy/hls?url=" + urllib.parse.quote("https://vs-hls-pushb-uk-live.akamaized.net/x=4/i=urn:bbc:pips:service:bbc_three_hd/iptv_hd_abr_v1.m3u8", safe=""),
            "fallbackEmbedUrl": "https://freeshot.live/embed/BBCThreeUK.php",
            "channelId": channel_id
        }

    if channel_id in ["bbc-news-uk", "bbc-news"]:
        return {
            "success": True,
            "type": "hls",
            "streamUrl": "/api/proxy/hls?url=https%3A%2F%2Fvs-hls-push-ww-live.akamaized.net%2Fx%3D4%2Fi%3Durn%3Abbc%3Apips%3Aservice%3Abbc_news_channel_hd%2Ft%3D3840%2Fv%3Dpv14%2Fb%3D5070016%2Fmain.m3u8",
            "fallbackEmbedUrl": "https://freeshot.live/embed/BBCNewsUK.php",
            "channelId": channel_id
        }

    if channel_id in ["s4c-uk", "s4c"]:
        return {
            "success": True,
            "type": "hls",
            "streamUrl": "/api/proxy/hls?url=" + urllib.parse.quote("https://live-uk.s4c-cdn.co.uk/out/v1/a0134f1fd5a2461b9422b574566d4442/live_uk.m3u8", safe=""),
            "fallbackEmbedUrl": "https://freeshot.live/embed/S4CUK.php",
            "channelId": channel_id
        }

    if channel_id in ["gb-news", "gbnews"]:
        return {
            "success": True,
            "type": "hls",
            "streamUrl": "/api/proxy/hls?url=" + urllib.parse.quote("https://live-gbnews.simplestreamcdn.com/live5/gbnews/bitrate1.isml/manifest.m3u8", safe=""),
            "fallbackEmbedUrl": "https://freeshot.live/embed/GBNews.php",
            "channelId": channel_id
        }

    if channel_id in ["bloomberg-us", "bloomberg"]:
        return {
            "success": True,
            "type": "hls",
            "streamUrl": "/api/proxy/hls?url=https%3A%2F%2Fbloomberg.com%2Fmedia-manifest%2Fstreams%2Fus.m3u8",
            "fallbackEmbedUrl": "https://www.freeintertv.com/view/id-2991/1-1-0-1",
            "channelId": channel_id
        }

    if channel_id in ["russia-today", "rt", "rt-news"]:
        return {
            "success": True,
            "type": "hls",
            "streamUrl": "/api/proxy/hls?url=https%3A%2F%2Fwisewatchoott.wiseplayout.com%2FRT%2Fmaster.m3u8",
            "fallbackEmbedUrl": "https://www.freeintertv.com/view/id-1511/1-1-0-1",
            "channelId": channel_id
        }

    if channel_id in ["al-jazeera", "al-jazeera-english"]:
        return {
            "success": True,
            "type": "youtube",
            "streamUrl": "https://www.youtube-nocookie.com/embed/gCNeDWCI0vo?autoplay=1&modestbranding=1&rel=0",
            "fallbackEmbedUrl": "https://www.youtube-nocookie.com/embed/gCNeDWCI0vo?autoplay=1&modestbranding=1&rel=0",
            "channelId": channel_id
        }

    if channel_id in ["abc-news-live", "abcnews"]:
        return {
            "success": True,
            "type": "hls",
            "streamUrl": "/api/proxy/hls?url=" + urllib.parse.quote("https://abcnews-streams.akamaized.net/hls/live/2023560/abcnewshudson1/master.m3u8", safe=""),
            "fallbackEmbedUrl": "https://www.youtube-nocookie.com/embed/w_Ma8oQLmSM?autoplay=1&modestbranding=1&rel=0",
            "channelId": channel_id
        }

    if channel_id in ["fox-news-live", "foxnews", "fox-news"]:
        return {
            "success": True,
            "type": "hls",
            "streamUrl": "/api/proxy/hls?url=" + urllib.parse.quote("https://fox-foxnewsnow-vizio.amagi.tv/playlist.m3u8", safe=""),
            "fallbackEmbedUrl": "https://www.freeintertv.com/view/id-1799/1-1-0-1",
            "channelId": channel_id
        }

    if channel_id in ["nbc-live", "nbcnews", "nbc"]:
        return {
            "success": True,
            "type": "hls",
            "streamUrl": "/api/proxy/hls?url=" + urllib.parse.quote("https://d1bl6tskrpq9ze.cloudfront.net/hls/master.m3u8?ads.xumo_channelId=99984003", safe=""),
            "fallbackEmbedUrl": "https://www.freeintertv.com/view/id-2563/1-1-0-1",
            "channelId": channel_id
        }

    if channel_id in ["cbn-news", "cbn"]:
        return {
            "success": True,
            "type": "youtube",
            "streamUrl": "https://www.youtube-nocookie.com/embed/live_stream?channel=UCYI_ychRnL7sJrG6PUSBpQA&autoplay=1&modestbranding=1&rel=0",
            "fallbackEmbedUrl": "https://www.freeintertv.com/view/id-2984/1-1-0-1",
            "channelId": channel_id
        }

    if channel_id in ["channel4", "channel4-uk"]:
        return {
            "success": True,
            "type": "hls",
            "streamUrl": "/api/proxy/hls?url=" + urllib.parse.quote("https://488f4ce4.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/TEctZ2JfVGFsa19ITFM/playlist.m3u8", safe=""),
            "fallbackEmbedUrl": "https://www.channel4.com/live",
            "channelId": channel_id
        }

    if channel_id in ["channel5", "channel5-uk"]:
        return {
            "success": True,
            "type": "iframe",
            "streamUrl": "https://www.channel5.com/channels/5#state=5",
            "fallbackEmbedUrl": "https://www.channel5.com/channels/5#state=5",
            "channelId": channel_id
        }

    if channel_id in ["reuters"]:
        return {
            "success": True,
            "type": "youtube",
            "streamUrl": "https://www.youtube-nocookie.com/embed/live_stream?channel=UChqUTb7kYRX8-EiaN3XFrSQ&autoplay=1&modestbranding=1&rel=0",
            "fallbackEmbedUrl": "https://www.youtube-nocookie.com/embed/live_stream?channel=UChqUTb7kYRX8-EiaN3XFrSQ&autoplay=1&modestbranding=1&rel=0",
            "channelId": channel_id
        }

    if channel_id in ["trace-sports", "fox-sport"]:
        return {
            "success": True,
            "type": "hls",
            "streamUrl": "/api/proxy/hls?url=" + urllib.parse.quote("https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8", safe=""),
            "fallbackEmbedUrl": "https://www.freeintertv.com/view/id-1695/1-1-0-1",
            "channelId": channel_id
        }

    if channel_id in ["movies4men", "the-vintage-movie-channel"]:
        return {
            "success": True,
            "type": "hls",
            "streamUrl": "/api/proxy/hls?url=" + urllib.parse.quote("https://amg01753-narrativeuk-amg01753c3-lg-gb-1833.playouts.now.amagi.tv/playlist/amg01753-narrativeuk-greatmovies-lggb/playlist.m3u8", safe=""),
            "fallbackEmbedUrl": "https://www.freeintertv.com/view/id-1525/1-1-0-1",
            "channelId": channel_id
        }

    if channel_id in ["moovee", "movies-for-you"]:
        return {
            "success": True,
            "type": "hls",
            "streamUrl": "/api/proxy/hls?url=" + urllib.parse.quote("https://amg01753-narrativeuk-amg01753c2-lg-gb-1832.playouts.now.amagi.tv/playlist/amg01753-narrativeuk-greatchristmas-lggb/playlist.m3u8", safe=""),
            "fallbackEmbedUrl": "https://www.freeintertv.com/view/id-261/1-1-0-1",
            "channelId": channel_id
        }

    if channel_id in ["the-vault"]:
        return {
            "success": True,
            "type": "hls",
            "streamUrl": "/api/proxy/hls?url=" + urllib.parse.quote("https://lightning-now70s-samsungnz.amagi.tv/playlist.m3u8", safe=""),
            "fallbackEmbedUrl": "https://www.freeintertv.com/view/id-3345/1-1-0-1",
            "channelId": channel_id
        }

    if channel_id in ["emusic"]:
        return {
            "success": True,
            "type": "hls",
            "streamUrl": "/api/proxy/hls?url=" + urllib.parse.quote("https://lightning-now80s-samsunguk.amagi.tv/playlist.m3u8", safe=""),
            "fallbackEmbedUrl": "https://www.freeintertv.com/view/id-228/1-1-0-1",
            "channelId": channel_id
        }

    if channel_id in ["cnn-live-news"]:
        return {
            "success": True,
            "type": "hls",
            "streamUrl": "/api/proxy/hls?url=" + urllib.parse.quote("https://cbsnews.akamaized.net/hls/live/2020607/cbsnlineup_8/master.m3u8", safe=""),
            "fallbackEmbedUrl": "https://www.freeintertv.com/view/id-3324/1-1-0-1",
            "channelId": channel_id
        }

    if channel_id in ["msnbc-live"]:
        return {
            "success": True,
            "type": "hls",
            "streamUrl": "/api/proxy/hls?url=" + urllib.parse.quote("https://nmxlive.akamaized.net/hls/live/529965/Live_1/index.m3u8", safe=""),
            "fallbackEmbedUrl": "https://www.freeintertv.com/view/id-2565/1-1-0-1",
            "channelId": channel_id
        }

    if channel_id in ["game-time"]:
        return {
            "success": True,
            "type": "hls",
            "streamUrl": "/api/proxy/hls?url=" + urllib.parse.quote("https://b6cca454.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/U2Ftc3VuZy1nYl9UcnVlQ3JpbWVVS2Zyb21DQlNSZWFsaXR5X0hMUw/playlist.m3u8", safe=""),
            "fallbackEmbedUrl": "https://www.freeintertv.com/view/id-206/1-1-0-1",
            "channelId": channel_id
        }

    if channel_id in ["big-bang-theory"]:
        return {
            "success": True,
            "type": "hls",
            "streamUrl": "/api/proxy/hls?url=" + urllib.parse.quote("https://content.uplynk.com/channel/6c0bd0f94b1d4526a98676e9699a10ef.m3u8", safe=""),
            "fallbackEmbedUrl": "https://www.freeintertv.com/view/id-1617/1-1-0-1",
            "channelId": channel_id
        }

    if channel_id in ["new-movies"]:
        return {
            "success": True,
            "type": "hls",
            "streamUrl": "/api/proxy/hls?url=" + urllib.parse.quote("https://488f4ce4.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/TEctZ2JfVGFsa19ITFM/playlist.m3u8", safe=""),
            "fallbackEmbedUrl": "https://www.freeintertv.com/view/id-3343/1-1-0-1",
            "channelId": channel_id
        }

    if channel_id in ["chc"]:
        return {
            "success": True,
            "type": "hls",
            "streamUrl": "/api/proxy/hls?url=" + urllib.parse.quote("https://master.nhkworld.jp/nhkworld-tv/playlist/live.m3u8", safe=""),
            "fallbackEmbedUrl": "https://www.freeintertv.com/view/id-1536/1-1-0-1",
            "channelId": channel_id
        }

    if channel_id in ["hbo", "mgm"]:
        return {
            "success": True,
            "type": "hls",
            "streamUrl": "/api/proxy/hls?url=" + urllib.parse.quote("https://amg01753-narrativeuk-amg01753c3-lg-gb-1833.playouts.now.amagi.tv/playlist/amg01753-narrativeuk-greatmovies-lggb/playlist.m3u8", safe=""),
            "fallbackEmbedUrl": fallback_url or "https://www.freeintertv.com/view/id-1849/1-1-0-1",
            "channelId": channel_id
        }

    if channel_id not in CHANNEL_SLUGS:
        return {
            "success": True,
            "type": "embed",
            "streamUrl": "",
            "fallbackEmbedUrl": fallback_url,
            "channelSlug": "",
            "currentToken": "",
            "channelId": channel_id
        }

    if channel_id == "sky-showcase":
        # Sky Showcase: verified working embed mirror on freeshot
        return {
            "success": True,
            "type": "embed",
            "streamUrl": "",
            "fallbackEmbedUrl": "https://freeshot.live/embed/SkyShowcase.php",
            "channelSlug": "SkyShowcase",
            "currentToken": "",
            "channelId": channel_id
        }

    slug = CHANNEL_SLUGS.get(channel_id, "SkySportsPremierLeague")
    now = time.time()

    if not force_refresh and channel_id in STREAM_CACHE:
        cached = STREAM_CACHE[channel_id]
        active_info = ACTIVE_TOKENS.get(slug, {})
        expires_at = active_info.get("expires_at", cached.get("time", 0) + 300)
        # Reuse cache only if token still has at least 80 seconds of life remaining
        if expires_at - now > 80:
            return cached["data"]

    # Proactively obtain or refresh the token for this slug
    fresh_token = get_valid_token_for_slug(slug, force_new=force_refresh)

    url = f"https://wideiptv.top/player/{slug}"
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://freeshot.live/'
    })
    
    try:
        html = urllib.request.urlopen(req, timeout=6).read().decode('utf-8', errors='ignore')
        m = re.search(r'streamUrl:\s*"([^"]+)"', html)
        if m:
            clean_url = m.group(1).replace(r'\/', '/')
            token_match = re.search(r'currentToken:\s*"([^"]+)"', html)
            token = fresh_token or (token_match.group(1) if token_match else "")
            if token and 'token=' in clean_url:
                clean_url = re.sub(r'token=[^&]+', f'token={token}', clean_url)
            # Route through universal HLS proxy with wideiptv referer to prevent 403 blocks
            proxied_url = f"/api/proxy/hls?url={urllib.parse.quote(clean_url, safe='')}&ref={urllib.parse.quote('https://wideiptv.top/', safe='')}"
            
            result = {
                "success": True,
                "type": "hls",
                "streamUrl": proxied_url,
                "directStreamUrl": clean_url,
                "fallbackEmbedUrl": fallback_url,
                "channelSlug": slug,
                "currentToken": token,
                "channelId": channel_id
            }
            STREAM_CACHE[channel_id] = {"data": result, "time": now}
            return result
        else:
            return {
                "success": True,
                "type": "embed",
                "streamUrl": "",
                "fallbackEmbedUrl": fallback_url,
                "channelSlug": slug,
                "currentToken": "",
                "channelId": channel_id
            }
    except Exception as e:
        return {
            "success": True,
            "type": "embed",
            "streamUrl": "",
            "fallbackEmbedUrl": fallback_url,
            "channelSlug": slug,
            "currentToken": "",
            "channelId": channel_id,
            "error": str(e)
        }

# ==========================================================================
# AUTHENTIC REAL-TIME EPG ENGINE (Freeview Official & Sky UK Hawk Linear API)
# ==========================================================================
import threading

REAL_EPG_CACHE = None
REAL_EPG_CACHE_TIME = 0
REAL_EPG_FETCHING = False

# Complete mapping dictionary for IVTV channels
EPG_MAPPINGS = {
    # Public & Free-to-Air Terrestrial (Freeview Official)
    "bbc-one-uk": {"source": "freeview", "id": "4164", "name": "BBC One", "ch": 101, "genre": "General"},
    "bbc-one": {"source": "freeview", "id": "4164", "name": "BBC One", "ch": 101, "genre": "General"},
    "bbc-two-uk": {"source": "freeview", "id": "4287", "name": "BBC Two", "ch": 102, "genre": "Factual & Drama"},
    "bbc-two": {"source": "freeview", "id": "4287", "name": "BBC Two", "ch": 102, "genre": "Factual & Drama"},
    "bbc-three-uk": {"source": "freeview", "id": "4288", "name": "BBC Three", "ch": 107, "genre": "Youth & Comedy"},
    "bbc-three": {"source": "freeview", "id": "4288", "name": "BBC Three", "ch": 107, "genre": "Youth & Comedy"},
    "itv1-uk": {"source": "freeview", "id": "8261", "name": "ITV1", "ch": 103, "genre": "Entertainment"},
    "itv1": {"source": "freeview", "id": "8261", "name": "ITV1", "ch": 103, "genre": "Entertainment"},
    "itv2-uk": {"source": "freeview", "id": "8325", "name": "ITV2", "ch": 118, "genre": "Reality & Comedy"},
    "itv2": {"source": "freeview", "id": "8325", "name": "ITV2", "ch": 118, "genre": "Reality & Comedy"},
    "itv3-uk": {"source": "freeview", "id": "8294", "name": "ITV3", "ch": 119, "genre": "Classic Drama"},
    "itv3": {"source": "freeview", "id": "8294", "name": "ITV3", "ch": 119, "genre": "Classic Drama"},
    "itv4-uk": {"source": "freeview", "id": "8330", "name": "ITV4", "ch": 120, "genre": "Action & Sport"},
    "itv4": {"source": "freeview", "id": "8330", "name": "ITV4", "ch": 120, "genre": "Action & Sport"},
    "channel4": {"source": "freeview", "id": "8384", "name": "Channel 4", "ch": 104, "genre": "Entertainment"},
    "channel5": {"source": "freeview", "id": "8500", "name": "Channel 5", "ch": 105, "genre": "Documentaries & Drama"},
    "film4-uk": {"source": "freeview", "id": "8385", "name": "Film4", "ch": 313, "genre": "Cinema"},
    "bbc-news-uk": {"source": "freeview", "id": "4352", "name": "BBC News", "ch": 503, "genre": "News"},
    "sky-news": {"source": "freeview", "id": "22080", "name": "Sky News", "ch": 501, "genre": "Live Breaking News"},
    "gb-news": {"source": "freeview", "id": "27360", "name": "GB News", "ch": 512, "genre": "News & Debate"},
    "al-jazeera": {"source": "freeview", "id": "16278", "name": "Al Jazeera English", "ch": 511, "genre": "International News"},
    
    # Sky Sports Channels (Sky Hawk Linear API)
    "sky-sports-premier-league-uk": {"source": "sky", "id": "4010", "name": "Sky Sports Premier League", "ch": 402, "genre": "Live Football"},
    "sky-sports-main-event-live-uk": {"source": "sky", "id": "4002", "name": "Sky Sports Main Event", "ch": 401, "genre": "Marquee Live Sport"},
    "sky-sports-football-uk": {"source": "sky", "id": "3939", "name": "Sky Sports Football", "ch": 403, "genre": "Live Football"},
    "sky-sports-plus-uk": {"source": "sky", "id": "3940", "name": "Sky Sports+", "ch": 404, "genre": "Live Multi-Sport"},
    "sky-sports-cricket-uk": {"source": "sky", "id": "4081", "name": "Sky Sports Cricket", "ch": 405, "genre": "Live Cricket"},
    "sky-sports-golf-uk": {"source": "sky", "id": "4026", "name": "Sky Sports Golf", "ch": 406, "genre": "Live Golf"},
    "sky-sports-f1-uk": {"source": "sky", "id": "3835", "name": "Sky Sports F1", "ch": 407, "genre": "Formula 1 Motorsport"},
    "sky-sports-tennis-uk": {"source": "sky", "id": "1284", "name": "Sky Sports Tennis", "ch": 408, "genre": "Live ATP & WTA Tennis"},
    "sky-sports-news-uk": {"source": "sky", "id": "4049", "name": "Sky Sports News", "ch": 409, "genre": "24/7 Sports News"},
    "sky-sports-racing-uk": {"source": "sky", "id": "4032", "name": "Sky Sports Racing", "ch": 415, "genre": "Live Horse Racing"},
    "sky-sports-mix-uk": {"source": "sky", "id": "4090", "name": "Sky Sports Mix", "ch": 416, "genre": "Variety Sport"},
    "sky-sports-action-uk": {"source": "sky", "id": "4022", "name": "Sky Sports Action", "ch": 408, "genre": "Rugby & American Football"},
    "sky-sports-laliga-uk": {"source": "sky", "id": "1289", "name": "Sky Sports LaLiga", "ch": 419, "genre": "Spanish Football"},

    # Sky Cinema Channels (Sky Hawk Linear API)
    "sky-cinema-premiere-uk": {"source": "sky", "id": "4021", "name": "Sky Cinema Premiere", "ch": 301, "genre": "Box Office Premieres"},
    "sky-cinema-hits-uk": {"source": "sky", "id": "4020", "name": "Sky Cinema Hits", "ch": 303, "genre": "Blockbuster Hits"},
    "sky-cinema-family-uk": {"source": "sky", "id": "4018", "name": "Sky Cinema Family", "ch": 304, "genre": "Family & Animation"},
    "sky-cinema-action-uk": {"source": "sky", "id": "4014", "name": "Sky Cinema Action", "ch": 306, "genre": "Action & Adventure"},
    "sky-cinema-comedy-uk": {"source": "sky", "id": "4019", "name": "Sky Cinema Comedy", "ch": 308, "genre": "Comedy Movies"},
    "sky-cinema-thriller-uk": {"source": "sky", "id": "4062", "name": "Sky Cinema Thriller", "ch": 309, "genre": "Suspense & Crime"},
    "sky-cinema-drama-uk": {"source": "sky", "id": "4016", "name": "Sky Cinema Drama", "ch": 310, "genre": "Award-Winning Drama"},
    "sky-cinema-sci-fi-horror-uk": {"source": "sky", "id": "4074", "name": "Sky Cinema Sci-Fi & Horror", "ch": 311, "genre": "Sci-Fi & Horror"},
    "sky-cinema-greats-uk": {"source": "sky", "id": "4015", "name": "Sky Cinema Greats", "ch": 312, "genre": "Hollywood Classics"},
    "sky-cinema-select-uk": {"source": "sky", "id": "3028", "name": "Sky Cinema Select", "ch": 313, "genre": "Independent & Arthouse"},

    # Sky Entertainment Channels (Sky Hawk Linear API)
    "sky-atlantic-uk": {"source": "sky", "id": "4053", "name": "Sky Atlantic", "ch": 108, "genre": "Prestige HBO & Sky Originals"},
    "sky-showcase": {"source": "sky", "id": "4061", "name": "Sky Showcase", "ch": 106, "genre": "Flagship Entertainment"},
    "sky-comedy-uk": {"source": "sky", "id": "1143", "name": "Sky Comedy", "ch": 113, "genre": "Premium US & UK Comedy"},
    "sky-crime-uk": {"source": "sky", "id": "1212", "name": "Sky Crime", "ch": 121, "genre": "True Crime Documentaries"},
    "sky-arts-uk": {"source": "sky", "id": "4063", "name": "Sky Arts", "ch": 122, "genre": "Music, Theatre & Fine Arts"},
    "sky-history-uk": {"source": "sky", "id": "4086", "name": "Sky History", "ch": 123, "genre": "World History & Mysteries"},
    "gold-uk": {"source": "sky", "id": "6513", "name": "Gold", "ch": 110, "genre": "British Classic Comedy"},
    "s4c-uk": {"source": "sky", "id": "1021", "name": "S4C", "ch": 134, "genre": "Welsh Broadcasting"},

    # International News & Financial (Sky Hawk Linear API)
    "bloomberg-us": {"source": "sky", "id": "1074", "name": "Bloomberg Television", "ch": 502, "genre": "Global Markets & Finance"},
    "cnn-international": {"source": "sky", "id": "1019", "name": "CNN International", "ch": 506, "genre": "World News"},
    "cnn-live-news": {"source": "sky", "id": "1019", "name": "CNN Live News", "ch": 506, "genre": "Breaking News"}
}

def parse_iso_duration(dur_str):
    if not dur_str:
        return 60
    m = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?', dur_str)
    if not m:
        return 60
    hours = int(m.group(1) or 0)
    mins = int(m.group(2) or 0)
    secs = int(m.group(3) or 0)
    total = hours * 60 + mins
    if secs > 30:
        total += 1
    return max(5, total)

def format_time_str(dt):
    h = dt.hour
    m = dt.minute
    ampm = "am" if h < 12 else "pm"
    display_h = h % 12
    if display_h == 0:
        display_h = 12
    return f"{display_h}:{m:02d} {ampm}"

def fetch_live_epg_feed():
    now_utc = datetime.datetime.now(datetime.timezone.utc)
    today_utc = now_utc.replace(hour=0, minute=0, second=0, microsecond=0)
    start_unix = int(today_utc.timestamp())
    today_str = now_utc.strftime('%Y%m%d')

    freeview_by_sid = {}
    try:
        fv_url = f"https://www.freeview.co.uk/api/tv-guide?nid=64257&start={start_unix}"
        req = urllib.request.Request(fv_url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://www.freeview.co.uk/tv-guide?userNid=64257'
        })
        with urllib.request.urlopen(req, timeout=10) as resp:
            fv_raw = json.loads(resp.read().decode('utf-8'))
            for prog in fv_raw.get('data', {}).get('programs', []):
                sid = str(prog.get('service_id'))
                freeview_by_sid[sid] = prog.get('events', [])
    except Exception as e:
        print(f"[EPG] Freeview fetch warning: {e}")

    sky_by_sid = {}
    sky_sids = list(set([v['id'] for v in EPG_MAPPINGS.values() if v['source'] == 'sky']))
    batch_size = 10
    sky_headers = {'User-Agent': 'Mozilla/5.0', 'X-SkyOTT-Territory': 'GB'}

    for i in range(0, len(sky_sids), batch_size):
        batch = sky_sids[i:i+batch_size]
        url = f"https://awk.epgsky.com/hawk/linear/schedule/{today_str}/{','.join(batch)}"
        try:
            req = urllib.request.Request(url, headers=sky_headers)
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                for sch in data.get('schedule', []):
                    sid = str(sch.get('sid'))
                    sky_by_sid[sid] = sch.get('events', [])
        except Exception as e:
            print(f"[EPG] Sky batch warning for {batch}: {e}")

    channels_output = {}

    for ch_id, mapping in EPG_MAPPINGS.items():
        source = mapping['source']
        sid = mapping['id']
        name = mapping['name']
        ch_num = mapping['ch']
        genre = mapping['genre']

        raw_events = []
        if source == 'freeview' and sid in freeview_by_sid:
            raw_events = freeview_by_sid[sid]
        elif source == 'sky' and sid in sky_by_sid:
            raw_events = sky_by_sid[sid]

        shows = []

        if source == 'freeview':
            for ev in raw_events:
                try:
                    start_str = ev.get('start_time')
                    clean_start = re.sub(r'([+-]\d{2})(\d{2})$', r'\1:\2', start_str)
                    st_dt = datetime.datetime.fromisoformat(clean_start)
                    dur_mins = parse_iso_duration(ev.get('duration'))
                    et_dt = st_dt + datetime.timedelta(minutes=dur_mins)

                    st_unix = int(st_dt.timestamp())
                    et_unix = int(et_dt.timestamp())

                    title = ev.get('main_title') or 'Live Programme'
                    subtitle = ev.get('secondary_title') or ''
                    desc = ev.get('description') or subtitle or f"{title} on {name}."
                    
                    is_movie = any(k in genre.lower() or k in title.lower() for k in ['movie', 'cinema', 'film'])
                    is_sport = any(k in genre.lower() or k in title.lower() for k in ['sport', 'football', 'racing', 'f1', 'live'])

                    shows.append({
                        "id": f"{ch_id}-{st_dt.hour:02d}{st_dt.minute:02d}",
                        "title": title,
                        "subtitle": subtitle,
                        "timeStr": format_time_str(st_dt),
                        "start": f"{st_dt.hour:02d}:{st_dt.minute:02d}",
                        "end": f"{et_dt.hour:02d}:{et_dt.minute:02d}",
                        "startHour": st_dt.hour,
                        "startMin": st_dt.minute,
                        "durationMinutes": dur_mins,
                        "tag": genre,
                        "desc": desc,
                        "isMovie": is_movie,
                        "isSport": is_sport,
                        "epochStart": st_unix,
                        "epochEnd": et_unix,
                        "source": "Freeview Official"
                    })
                except Exception:
                    continue

        elif source == 'sky':
            for ev in raw_events:
                try:
                    st_unix = ev.get('st')
                    dur_sec = ev.get('d', 1800)
                    dur_mins = max(5, dur_sec // 60)
                    et_unix = st_unix + dur_sec

                    st_dt = datetime.datetime.fromtimestamp(st_unix, datetime.timezone.utc)
                    et_dt = datetime.datetime.fromtimestamp(et_unix, datetime.timezone.utc)

                    title = ev.get('t') or 'Live Show'
                    desc = ev.get('sy') or f"{title} on {name}."
                    
                    is_movie = any(k in genre.lower() or k in title.lower() for k in ['cinema', 'movie', 'premiere', 'hits', 'greats', 'action', 'thriller', 'comedy', 'drama', 'horror'])
                    is_sport = any(k in genre.lower() or k in title.lower() for k in ['sport', 'premier league', 'football', 'cricket', 'golf', 'f1', 'racing', 'tennis'])

                    tag = genre
                    if ev.get('seasonnumber') and ev.get('episodenumber'):
                        tag = f"S{ev.get('seasonnumber')} E{ev.get('episodenumber')}"
                    elif is_sport:
                        tag = "Live Sport"
                    elif is_movie:
                        tag = "Feature Film"

                    shows.append({
                        "id": f"{ch_id}-{st_dt.hour:02d}{st_dt.minute:02d}",
                        "title": title,
                        "subtitle": f"S{ev.get('seasonnumber')}E{ev.get('episodenumber')}" if ev.get('seasonnumber') else "",
                        "timeStr": format_time_str(st_dt),
                        "start": f"{st_dt.hour:02d}:{st_dt.minute:02d}",
                        "end": f"{et_dt.hour:02d}:{et_dt.minute:02d}",
                        "startHour": st_dt.hour,
                        "startMin": st_dt.minute,
                        "durationMinutes": dur_mins,
                        "tag": tag,
                        "desc": desc,
                        "isMovie": is_movie,
                        "isSport": is_sport,
                        "epochStart": st_unix,
                        "epochEnd": et_unix,
                        "source": "Sky UK Official"
                    })
                except Exception:
                    continue

        if shows:
            channels_output[ch_id] = {
                "id": ch_id,
                "name": name,
                "chNumber": ch_num,
                "genre": genre,
                "source": "Freeview Official" if source == 'freeview' else "Sky UK Official",
                "shows": shows
            }

    return {
        "status": "success",
        "timestamp": int(time.time()),
        "date": today_str,
        "source": "Freeview Official (freeview.co.uk) & Sky UK Hawk Linear EPG",
        "channels": channels_output
    }

def get_epg_data(channel_id=None, force_refresh=False):
    global REAL_EPG_CACHE, REAL_EPG_CACHE_TIME, REAL_EPG_FETCHING
    now = time.time()
    today_str = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d')
    cache_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "live_epg_cache.json")

    # If force_refresh is requested, fetch directly synchronously (~1.2s)
    if force_refresh:
        try:
            data = fetch_live_epg_feed()
            if data and data.get('channels'):
                REAL_EPG_CACHE = data
                REAL_EPG_CACHE_TIME = now
                with open(cache_path, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=2)
                if channel_id and channel_id in data.get('channels', {}):
                    return {"status": "success", "channel": data['channels'][channel_id], "updated": True}
                return data
        except Exception as e:
            print(f"[EPG] Force refresh warning: {e}")

    def is_cache_current(cache_obj, mtime):
        if not cache_obj:
            return False
        cache_date = cache_obj.get('date')
        if cache_date and cache_date != today_str:
            return False
        return (now - mtime < 7200)

    # 1. Return in-memory cache if current (< 2 hours old and matches today's date)
    if REAL_EPG_CACHE and is_cache_current(REAL_EPG_CACHE, REAL_EPG_CACHE_TIME):
        if channel_id and channel_id in REAL_EPG_CACHE.get('channels', {}):
            return {"status": "success", "channel": REAL_EPG_CACHE['channels'][channel_id]}
        return REAL_EPG_CACHE

    # 2. Check disk cache
    if os.path.exists(cache_path):
        try:
            mtime = os.path.getmtime(cache_path)
            with open(cache_path, 'r', encoding='utf-8') as f:
                disk_data = json.load(f)
            if is_cache_current(disk_data, mtime):
                REAL_EPG_CACHE = disk_data
                REAL_EPG_CACHE_TIME = mtime
                if channel_id and channel_id in REAL_EPG_CACHE.get('channels', {}):
                    return {"status": "success", "channel": REAL_EPG_CACHE['channels'][channel_id]}
                return REAL_EPG_CACHE
            else:
                REAL_EPG_CACHE = disk_data
                REAL_EPG_CACHE_TIME = mtime
        except Exception:
            pass

    # 3. If stale cache exists, trigger background refresh and return current cache with updating=True
    if REAL_EPG_CACHE or os.path.exists(cache_path):
        if not REAL_EPG_CACHE:
            try:
                with open(cache_path, 'r', encoding='utf-8') as f:
                    REAL_EPG_CACHE = json.load(f)
                    REAL_EPG_CACHE_TIME = os.path.getmtime(cache_path)
            except Exception:
                pass

        if not REAL_EPG_FETCHING:
            def bg_refresh():
                global REAL_EPG_CACHE, REAL_EPG_CACHE_TIME, REAL_EPG_FETCHING
                REAL_EPG_FETCHING = True
                try:
                    data = fetch_live_epg_feed()
                    if data and data.get('channels'):
                        REAL_EPG_CACHE = data
                        REAL_EPG_CACHE_TIME = time.time()
                        with open(cache_path, 'w', encoding='utf-8') as f:
                            json.dump(data, f, indent=2)
                except Exception as e:
                    print(f"[EPG] Background refresh warning: {e}")
                finally:
                    REAL_EPG_FETCHING = False

            threading.Thread(target=bg_refresh, daemon=True).start()

        if REAL_EPG_CACHE:
            ret = dict(REAL_EPG_CACHE)
            ret["updating"] = True
            if channel_id and channel_id in REAL_EPG_CACHE.get('channels', {}):
                return {"status": "success", "channel": REAL_EPG_CACHE['channels'][channel_id], "updating": True}
            return ret

    # 4. Fetch synchronously if no cache exists at all
    try:
        data = fetch_live_epg_feed()
        if data and data.get('channels'):
            REAL_EPG_CACHE = data
            REAL_EPG_CACHE_TIME = now
            with open(cache_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2)
            if channel_id and channel_id in data.get('channels', {}):
                return {"status": "success", "channel": data['channels'][channel_id]}
            return data
    except Exception as e:
        print(f"[EPG] Synchronous fetch warning: {e}")

    return {"status": "error", "message": "EPG data unavailable"}

def proxy_hls_stream(handler, target_url, referer_override=None):
    if not target_url:
        handler.send_response(400)
        handler.send_header('Content-Type', 'text/plain')
        handler.end_headers()
        handler.wfile.write(b"Missing target url")
        return

    # Auto-detect necessary upstream headers based on target domain
    if not referer_override:
        if 'bluetier.top' in target_url or 'wideiptv.top' in target_url:
            referer_override = 'https://wideiptv.top/'
        elif 'bbc' in target_url:
            referer_override = 'https://www.bbc.co.uk/'

    slug = extract_slug_from_url(target_url)

    # If this is a tokenized stream, check if we have a fresher valid token for this slug
    if slug and 'token=' in target_url:
        fresh_token = get_valid_token_for_slug(slug, force_new=False)
        if fresh_token:
            target_url = re.sub(r'token=[^&]+', f'token={fresh_token}', target_url)

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': '*/*'
    }
    if referer_override:
        headers['Referer'] = referer_override
        if 'wideiptv.top' in referer_override:
            headers['Origin'] = 'https://wideiptv.top'

    upstream = None

    for attempt in range(2):
        try:
            request_headers = dict(headers)
            for header in ('Range', 'If-Range'):
                value = handler.headers.get(header)
                if value:
                    request_headers[header] = value
            req = urllib.request.Request(target_url, headers=request_headers)
            upstream = urllib.request.urlopen(req, timeout=10)
            break
        except urllib.error.HTTPError as e:
            if e.code in (401, 403, 404) and slug and attempt == 0:
                print(f"[HLS Proxy] Stale/expired upstream token or manifest ({e.code}) for slug '{slug}'. Auto-recovering fresh token...")
                recovered_token = get_valid_token_for_slug(slug, force_new=True)
                if recovered_token:
                    if 'token=' in target_url:
                        target_url = re.sub(r'token=[^&]+', f'token={recovered_token}', target_url)
                    else:
                        sep = '&' if '?' in target_url else '?'
                        target_url = f"{target_url}{sep}token={recovered_token}"
                    continue
            try:
                handler.send_response(e.code)
                handler.send_header('Content-Type', 'text/plain')
                handler.send_header('Access-Control-Allow-Origin', '*')
                handler.end_headers()
                handler.wfile.write(str(e).encode('utf-8'))
            except Exception:
                pass
            return
        except Exception as e:
            try:
                handler.send_response(502)
                handler.send_header('Content-Type', 'application/json')
                handler.send_header('Access-Control-Allow-Origin', '*')
                handler.end_headers()
                handler.wfile.write(json.dumps({"error": f"Upstream proxy error: {str(e)}"}).encode('utf-8'))
            except Exception:
                pass
            return

    if upstream is None:
        return

    response_started = False
    try:
        content_type = upstream.headers.get('Content-Type', 'application/octet-stream')
        playlist_hint = (
            urllib.parse.urlparse(target_url).path.lower().endswith('.m3u8') or
            'mpegurl' in content_type.lower()
        )
        read_stream_chunk = getattr(upstream, 'read1', upstream.read)
        prefix = b'' if playlist_hint else read_stream_chunk(10)
        is_m3u8 = playlist_hint or prefix.lstrip(b'\xef\xbb\xbf \t\r\n').startswith(b'#EXTM3U')
        
        if is_m3u8:
            content = (prefix + upstream.read()) if prefix else upstream.read()
            text = content.decode('utf-8', errors='ignore')
            lines = text.splitlines()
            rewritten = []
            active_slug_token = get_valid_token_for_slug(slug, force_new=False) if slug else None

            for line in lines:
                stripped = line.strip()
                if not stripped:
                    rewritten.append(line)
                elif stripped.startswith('#'):
                    if 'URI="' in line:
                        def replace_uri(match):
                            uri = match.group(1)
                            full_uri = urllib.parse.urljoin(target_url, uri)
                            if active_slug_token and 'bluetier.top' in full_uri:
                                if 'token=' in full_uri:
                                    full_uri = re.sub(r'token=[^&]+', f'token={active_slug_token}', full_uri)
                                else:
                                    sep = '&' if '?' in full_uri else '?'
                                    full_uri += f"{sep}token={active_slug_token}"
                            proxy_uri = f"/api/proxy/hls?url={urllib.parse.quote(full_uri, safe='')}"
                            if referer_override:
                                proxy_uri += f"&ref={urllib.parse.quote(referer_override, safe='')}"
                            return f'URI="{proxy_uri}"'
                        line = re.sub(r'URI="([^"]+)"', replace_uri, line)
                    rewritten.append(line)
                else:
                    full_line_url = urllib.parse.urljoin(target_url, stripped)
                    if active_slug_token and 'bluetier.top' in full_line_url:
                        if 'token=' in full_line_url:
                            full_line_url = re.sub(r'token=[^&]+', f'token={active_slug_token}', full_line_url)
                        else:
                            sep = '&' if '?' in full_line_url else '?'
                            full_line_url += f"{sep}token={active_slug_token}"
                    proxy_line = f"/api/proxy/hls?url={urllib.parse.quote(full_line_url, safe='')}"
                    if referer_override:
                        proxy_line += f"&ref={urllib.parse.quote(referer_override, safe='')}"
                    rewritten.append(proxy_line)
            
            body = ('\n'.join(rewritten)).encode('utf-8')
            handler.send_response(200)
            handler.send_header('Content-Type', 'application/vnd.apple.mpegurl')
            handler.send_header('Access-Control-Allow-Origin', '*')
            handler.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            handler.send_header('Pragma', 'no-cache')
            handler.send_header('Expires', '0')
            handler.end_headers()
            response_started = True
            handler.wfile.write(body)
        else:
            handler.send_response(upstream.getcode())
            handler.send_header('Content-Type', content_type)
            handler.send_header('Access-Control-Allow-Origin', '*')
            handler.send_header('Cache-Control', 'no-store')
            for header in ('Content-Length', 'Content-Range', 'Accept-Ranges'):
                value = upstream.headers.get(header)
                if value:
                    handler.send_header(header, value)
            handler.end_headers()
            response_started = True
            if prefix:
                handler.wfile.write(prefix)
                handler.wfile.flush()
            while True:
                chunk = read_stream_chunk(64 * 1024)
                if not chunk:
                    break
                handler.wfile.write(chunk)
                handler.wfile.flush()
    except (BrokenPipeError, ConnectionResetError):
        pass
    except Exception as e:
        if not response_started:
            try:
                handler.send_response(502)
                handler.send_header('Content-Type', 'application/json')
                handler.send_header('Access-Control-Allow-Origin', '*')
                handler.end_headers()
                handler.wfile.write(json.dumps({"error": f"Upstream proxy error: {str(e)}"}).encode('utf-8'))
            except Exception:
                pass
        else:
            print(f"[HLS Proxy] Streaming response interrupted: {e}")
    finally:
        upstream.close()

def proxy_embed(handler, target_url):
    if not target_url:
        handler.send_response(400)
        handler.end_headers()
        return

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
    try:
        # Check if target is a FreeInterTV channel page
        if 'freeintertv.com/view/id-' in target_url:
            cookie_jar = urllib.request.HTTPCookieProcessor()
            opener = urllib.request.build_opener(cookie_jar)
            req = urllib.request.Request(target_url, headers=headers)
            with opener.open(req, timeout=8) as upstream:
                html = upstream.read().decode('utf-8', errors='ignore')
                
            m = re.search(r'src=["\']([^"\']*modules/View/screen\.php[^"\']*)["\']', html)
            if m:
                screen_url = urllib.parse.urljoin(target_url, m.group(1))
                req2 = urllib.request.Request(screen_url, headers={
                    'User-Agent': headers['User-Agent'],
                    'Referer': target_url
                })
                with opener.open(req2, timeout=8) as upstream2:
                    screen_html = upstream2.read().decode('utf-8', errors='ignore')

                injected = """
                <base href="http://www.freeintertv.com/modules/View/">
                <style>
                  html, body, .container, .main, #output, #player-wrapper, .player, video, [data-player], .clappr-player, table, tr, td, .myShow, #myW, .loading-video {
                    width: 100vw !important;
                    height: 100vh !important;
                    max-width: 100vw !important;
                    max-height: 100vh !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    border: 0 !important;
                    overflow: hidden !important;
                    background: #000 !important;
                  }
                  .footer, .header, #header, #footer, .ad, .ads, [id*="ad_"], [class*="banner"], iframe {
                    display: none !important;
                    opacity: 0 !important;
                    pointer-events: none !important;
                  }
                </style>
                <script>
                  window.open = function() { return null; };
                  window.alert = function() {};
                  window.confirm = function() { return false; };
                  window.prompt = function() { return null; };
                  window.onbeforeunload = null;
                  try { Object.defineProperty(window, 'top', { get: () => window.self }); } catch(e){}
                </script>
                """
                modified_html = screen_html.replace('<head>', f'<head>{injected}', 1) if '<head>' in screen_html else (injected + screen_html)
                handler.send_response(200)
                handler.send_header('Content-Type', 'text/html; charset=utf-8')
                handler.send_header('Access-Control-Allow-Origin', '*')
                handler.end_headers()
                handler.wfile.write(modified_html.encode('utf-8'))
                return

        # Check if target is a freeshot.live embed -> resolve inner wideiptv player directly to eliminate banner wrappers
        actual_url = target_url
        if 'freeshot.live/embed/' in target_url:
            try:
                req_fs = urllib.request.Request(target_url, headers=headers)
                with urllib.request.urlopen(req_fs, timeout=6) as resp_fs:
                    fs_html = resp_fs.read().decode('utf-8', errors='ignore')
                    m_frame = re.search(r'<iframe[^>]+src=["\'](//wideiptv\.top/player/[^"\']+)["\']', fs_html)
                    if m_frame:
                        actual_url = "https:" + m_frame.group(1)
            except Exception as e:
                print(f"[Embed Proxy] Inner player resolve fallback: {e}")

        # Generic embed proxy with full ad sanitization
        req_headers = dict(headers)
        if 'wideiptv.top' in actual_url:
            req_headers['Referer'] = 'https://freeshot.live/'

        req = urllib.request.Request(actual_url, headers=req_headers)
        with urllib.request.urlopen(req, timeout=8) as upstream:
            html = upstream.read().decode('utf-8', errors='ignore')

            # 1. Remove framebusting top.location redirect
            html = re.sub(r'<script[^>]*>\s*if\s*\(self\s*==\s*top\)[^<]*</script>', '', html, flags=re.IGNORECASE)
            # 2. Remove external ad script tags (aclib, adbpage, histats, popups, etc.)
            html = re.sub(r'<script[^>]+(?:adbpage|aclib|histats|popcash|adsterra|popads|propeller|syndication|monetag|alwingulla)[^>]*>.*?</script>', '', html, flags=re.IGNORECASE | re.DOTALL)
            html = re.sub(r'<script[^>]+src=["\'][^"\']*(?:adbpage|aclib|histats|popcash|adsterra|popads|propeller|syndication|monetag|alwingulla|UK300)[^"\']*["\'][^>]*>.*?</script>', '', html, flags=re.IGNORECASE | re.DOTALL)
            # 3. Remove inline ad calls (aclib.runAutoTag, Histats, CreateTimer, popunder scripts)
            html = re.sub(r'<script[^>]*>(?:(?!</script>).)*?(?:aclib|adbpage|histats|fixedban|UK300|urlToShow|popCookieName)(?:(?!</script>).)*?</script>', '', html, flags=re.IGNORECASE | re.DOTALL)
            # 4. Remove ad iframes and ad wrappers
            html = re.sub(r'<iframe[^>]+(?:ad|banner|UK300|syndication|click|pop)[^>]*>.*?</iframe>', '', html, flags=re.IGNORECASE | re.DOTALL)
            html = re.sub(r'<div[^>]+id=["\'](?:fixedban|ad_container|ad_overlay)["\'][^>]*>.*?</div>', '', html, flags=re.IGNORECASE | re.DOTALL)

            injected = f"""
            <base href="{actual_url}">
            <style>
              body, html, #videoPlayer, video {{
                margin: 0 !important;
                padding: 0 !important;
                width: 100vw !important;
                height: 100vh !important;
                max-width: 100vw !important;
                max-height: 100vh !important;
                overflow: hidden !important;
                background: #000 !important;
              }}
              #loadingOverlay {{ background: rgba(0,0,0,0.6) !important; }}
              #header, #footer, .footer, .header, .ad, .ads, .advertisement, [id*="ad_"], [id*="fixedban"], [class*="banner"], [id*="banner"], [class*="ad-"], div[style*="z-index: 999999"], div[style*="z-index:999999"], div[style*="z-index: 999"], div[style*="z-index:999"], iframe[src*="UK300"] {{
                display: none !important;
                opacity: 0 !important;
                pointer-events: none !important;
                visibility: hidden !important;
                width: 0 !important;
                height: 0 !important;
              }}
              video, #player, #player-wrapper, .clappr-player, [data-player] {{
                width: 100vw !important;
                height: 100vh !important;
                max-width: 100vw !important;
                max-height: 100vh !important;
              }}
            </style>
            <script>
              window.open = function() {{ return null; }};
              window.alert = function() {{}};
              window.confirm = function() {{ return false; }};
              window.prompt = function() {{ return null; }};
              window.onbeforeunload = null;
              try {{ Object.defineProperty(window, 'top', {{ get: () => window.self }}); }} catch(e){{}}
              setInterval(function() {{
                try {{
                  var ads = document.querySelectorAll('iframe[src*="ad"], iframe[src*="UK300"], div[class*="ad-overlay"], div[id*="fixedban"], div[id*="ad_"]');
                  for (var i = 0; i < ads.length; i++) {{
                    ads[i].remove();
                  }}
                }} catch(e) {{}}
              }}, 800);
            </script>
            """
            modified_html = html.replace('<head>', f'<head>{injected}', 1) if '<head>' in html else (injected + html)
            handler.send_response(200)
            handler.send_header('Content-Type', 'text/html; charset=utf-8')
            handler.send_header('Access-Control-Allow-Origin', '*')
            handler.end_headers()
            handler.wfile.write(modified_html.encode('utf-8'))
    except (BrokenPipeError, ConnectionResetError):
        pass
    except Exception as e:
        try:
            handler.send_response(502)
            handler.send_header('Content-Type', 'text/html; charset=utf-8')
            handler.end_headers()
            handler.wfile.write(f"<h3>Proxy Error: {e}</h3>".encode('utf-8'))
        except Exception:
            pass

class IVTVRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        
        # Universal HLS/CORS Reverse Proxy: /api/proxy/hls?url=...&ref=...
        if parsed.path == '/api/proxy/hls':
            params = urllib.parse.parse_qs(parsed.query)
            target_url = params.get('url', [''])[0]
            referer = params.get('ref', [None])[0]
            proxy_hls_stream(self, target_url, referer)
            return

        # Clean Webview Proxy Embed: /api/proxy/embed?url=...
        if parsed.path == '/api/proxy/embed':
            params = urllib.parse.parse_qs(parsed.query)
            target_url = params.get('url', [''])[0]
            proxy_embed(self, target_url)
            return

        # API Stream Endpoint: /api/stream?channel=sky-sports-premier-league-uk
        if parsed.path == '/api/stream':
            params = urllib.parse.parse_qs(parsed.query)
            channel_id = params.get('channel', [''])[0]
            force = params.get('refresh', ['0'])[0] in ['1', 'true', 'yes'] or params.get('force', ['0'])[0] in ['1', 'true', 'yes']
            
            result = get_clean_stream(channel_id, force_refresh=force)
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode('utf-8'))
            return

        # API EPG Listings Endpoint: /api/epg
        if parsed.path == '/api/epg':
            params = urllib.parse.parse_qs(parsed.query)
            channel_id = params.get('channel', [None])[0]
            force = params.get('refresh', ['0'])[0] in ['1', 'true', 'yes']
            data = get_epg_data(channel_id, force_refresh=force)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Cache-Control', 'no-cache' if force else 'public, max-age=120')
            self.end_headers()
            self.wfile.write(json.dumps(data).encode('utf-8'))
            return
            
        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        
        # API Token Refresh Endpoint
        if parsed.path == '/api/refresh_token':
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            
            try:
                data = json.loads(body.decode('utf-8')) if body else {}
                slug = data.get('channel', '')
                current_token = data.get('current_token', '')
                
                # Use our resilient active token manager
                new_token = get_valid_token_for_slug(slug, current_token=current_token, force_new=True)
                
                if new_token:
                    resp_dict = {
                        "success": True,
                        "token": new_token,
                        "expires_in": 300,
                        "message": "Token refreshed successfully"
                    }
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps(resp_dict).encode('utf-8'))
                    return
                else:
                    raise Exception("Could not refresh token for channel")
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode('utf-8'))
                return
                
        self.send_response(404)
        self.end_headers()

class ThreadingHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True

if __name__ == '__main__':
    try:
        web_dir = os.path.dirname(os.path.abspath(__file__))
        os.chdir(web_dir)
        with ThreadingHTTPServer(("", PORT), IVTVRequestHandler) as httpd:
            print(f"IVTV Clean Ad-Free Server running at http://localhost:{PORT}")
            if sys.stdout and hasattr(sys.stdout, 'flush'):
                try:
                    sys.stdout.flush()
                except Exception:
                    pass
            httpd.serve_forever()
    except Exception as e:
        import traceback
        traceback.print_exc()
        if sys.stderr and hasattr(sys.stderr, 'flush'):
            try:
                sys.stderr.flush()
            except Exception:
                pass
