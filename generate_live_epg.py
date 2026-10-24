import urllib.request
import json
import datetime
import time
import re
import os

# Complete official EPG mapping dictionary for IVTV channels
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
        "source": "Freeview Official (freeview.co.uk) & Sky UK Hawk Linear EPG",
        "channels": channels_output
    }

if __name__ == '__main__':
    data = fetch_live_epg_feed()
    cache_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "live_epg_cache.json")
    with open(cache_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)
    print(f"Generated {cache_path} with {len(data['channels'])} official channels!")
