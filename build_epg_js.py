import json
import os

with open('live_epg_cache.json', 'r', encoding='utf-8') as f:
    live_cache = json.load(f)

channels_dict = {}
for ch_id, ch_obj in live_cache['channels'].items():
    channels_dict[ch_id] = ch_obj['shows']

seed_json = json.dumps(channels_dict, indent=2)

js_content = f'''/* ==========================================================================
   IVTV ELECTRONIC PROGRAMME GUIDE (EPG) ENGINE
   Authentic Real-Time TV Listings Derived from Freeview Play Official API & Sky UK Hawk Linear API
   Synchronized via /api/epg REST Endpoint & Local Cache
   ========================================================================== */

const LIVE_EPG_SEED = {seed_json};

// ==========================================================================
// EPG TIME CALCULATOR & SCHEDULE GENERATOR
// ==========================================================================

class EPGManager {{
  constructor() {{
    this.schedules = {{ ...LIVE_EPG_SEED }};
    this.isLiveLoaded = false;
    this.fetchLiveEPG();
  }}

  // Asynchronously fetch live listings from local daemon API
  async fetchLiveEPG() {{
    try {{
      const resp = await fetch('/api/epg');
      if (resp.ok) {{
        const data = await resp.json();
        if (data && data.channels) {{
          const mapped = {{}};
          for (const [chId, chObj] of Object.entries(data.channels)) {{
            if (chObj && chObj.shows) {{
              mapped[chId] = chObj.shows.map(s => ({{
                id: s.id,
                title: s.title,
                subtitle: s.subtitle || '',
                timeStr: s.timeStr,
                start: s.start,
                end: s.end,
                startHour: s.startHour,
                startMin: s.startMin,
                duration: s.durationMinutes,
                tag: s.tag,
                desc: s.desc,
                isMovie: s.isMovie || false,
                isSport: s.isSport || false,
                epochStart: s.epochStart,
                epochEnd: s.epochEnd,
                source: s.source || chObj.source
              }}));
            }}
          }}
          this.schedules = {{ ...this.schedules, ...mapped }};
          this.isLiveLoaded = true;
          window.dispatchEvent(new CustomEvent('ivtv:epg-updated', {{ detail: {{ source: 'api' }} }}));
        }}
      }}
    }} catch (e) {{
      console.warn('[IVTV EPG] Local /api/epg fetch notice (using preloaded real seed):', e);
    }}
  }}

  // Honest fallback for unlisted 24/7 web feeds (never fabricates fake show names)
  generateRealisticSchedule(channelId) {{
    const ch = (window.IVTV_DATA && window.IVTV_DATA.channels)
      ? window.IVTV_DATA.channels.find(c => c.id === channelId)
      : null;
    const name = ch ? ch.name : channelId;
    const cat = ch ? ch.category : 'General';
    const baseDay = new Date();
    baseDay.setHours(0, 0, 0, 0);
    const startUnix = Math.floor(baseDay.getTime() / 1000);
    const endUnix = startUnix + 86400;

    return [{{
      id: `${{channelId}}-continuous`,
      title: `${{name}} Live Stream`,
      subtitle: "24/7 Digital Feed",
      timeStr: "24/7",
      start: "00:00",
      end: "24:00",
      startHour: 0,
      startMin: 0,
      duration: 1440,
      tag: "Live Feed",
      desc: `Official live digital stream of ${{name}}. Broadcasting continuous programming without a published linear schedule.`,
      isMovie: cat === 'Cinema',
      isSport: cat === 'Sports',
      epochStart: startUnix,
      epochEnd: endUnix,
      source: "Live Web Feed"
    }}];
  }}

  // Generates timeline schedule for a channel anchored dynamically to referenceDate
  getScheduleForChannel(channelId, referenceDate = new Date()) {{
    let shows = this.schedules[channelId];
    if (!shows || shows.length === 0) {{
      shows = this.generateRealisticSchedule(channelId);
      this.schedules[channelId] = shows;
    }}
    if (!shows || shows.length === 0) return [];

    const baseDay = new Date(referenceDate);
    baseDay.setHours(0, 0, 0, 0);

    const generated = [];

    // Map each show to a concrete start and end Date object
    for (let i = 0; i < shows.length; i++) {{
      const s = shows[i];
      let start, end;
      if (s.epochStart) {{
        start = new Date(s.epochStart * 1000);
        end = s.epochEnd ? new Date(s.epochEnd * 1000) : new Date(start.getTime() + (s.duration || 60) * 60 * 1000);
      }} else {{
        start = new Date(baseDay);
        start.setHours(s.startHour, s.startMin, 0, 0);
        end = new Date(start.getTime() + (s.duration || 60) * 60 * 1000);
      }}

      generated.push({{
        id: `${{channelId}}-${{start.getTime()}}`,
        channelId: channelId,
        title: s.title,
        subtitle: s.subtitle || '',
        desc: s.desc,
        tag: s.tag,
        timeStr: s.timeStr || `${{this.formatTime(start)}} - ${{this.formatTime(end)}}`,
        durationMinutes: s.duration || Math.round((end.getTime() - start.getTime()) / 60000),
        startTime: start,
        endTime: end,
        startTimeFormatted: this.formatTime(start),
        endTimeFormatted: this.formatTime(end),
        isMovie: s.isMovie || false,
        isSport: s.isSport || false,
        source: s.source || 'Official EPG'
      }});
    }}

    // Sort chronologically
    generated.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    return generated;
  }}

  // Finds what is currently broadcasting right now
  getCurrentProgram(channelId, now = new Date()) {{
    const schedule = this.getScheduleForChannel(channelId, now);
    if (!schedule || schedule.length === 0) return null;
    const nowTime = now.getTime();

    for (let i = 0; i < schedule.length; i++) {{
      const prog = schedule[i];
      if (nowTime >= prog.startTime.getTime() && nowTime < prog.endTime.getTime()) {{
        const totalDuration = prog.endTime.getTime() - prog.startTime.getTime();
        const elapsed = nowTime - prog.startTime.getTime();
        const progressPercent = Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)));
        const minutesLeft = Math.max(1, Math.round((prog.endTime.getTime() - nowTime) / (60 * 1000)));

        return {{
          ...prog,
          isLive: true,
          progressPercent: progressPercent,
          minutesLeft: minutesLeft,
          next: schedule[i + 1] || null
        }};
      }}
    }}

    // If nowTime is before the first scheduled show
    if (nowTime < schedule[0].startTime.getTime()) {{
      return {{
        ...schedule[0],
        isLive: false,
        progressPercent: 0,
        minutesLeft: Math.max(1, Math.round((schedule[0].startTime.getTime() - nowTime) / (60 * 1000))),
        next: schedule[1] || null
      }};
    }}

    // If nowTime is after the last scheduled show
    const last = schedule[schedule.length - 1];
    return {{
      ...last,
      isLive: true,
      progressPercent: 100,
      minutesLeft: 0,
      next: null
    }};
  }}

  // Calculates programs within a horizontal timeline viewing window
  getProgramsInWindow(channelId, windowStart, windowDurationMinutes = 360, pixelsPerHour = 220) {{
    const fullSchedule = this.getScheduleForChannel(channelId, windowStart);
    const windowStartTime = windowStart.getTime();
    const windowEndTime = windowStartTime + windowDurationMinutes * 60 * 1000;
    const nowTime = Date.now();
    const pixelsPerMinute = pixelsPerHour / 60;

    const windowPrograms = [];

    for (const prog of fullSchedule) {{
      const progStartTime = prog.startTime.getTime();
      const progEndTime = prog.endTime.getTime();

      // Check if program overlaps with [windowStartTime, windowEndTime]
      if (progEndTime > windowStartTime && progStartTime < windowEndTime) {{
        const clampedStart = Math.max(progStartTime, windowStartTime);
        const clampedEnd = Math.min(progEndTime, windowEndTime);
        const durationMins = (clampedEnd - clampedStart) / (60 * 1000);
        const widthPx = Math.max(70, Math.round(durationMins * pixelsPerMinute));

        const isLive = nowTime >= progStartTime && nowTime < progEndTime;
        let progressPercent = 0;
        let minutesLeft = 0;

        if (isLive) {{
          const totalDuration = progEndTime - progStartTime;
          const elapsed = nowTime - progStartTime;
          progressPercent = Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)));
          minutesLeft = Math.max(1, Math.round((progEndTime - nowTime) / (60 * 1000)));
        }}

        windowPrograms.push({{
          ...prog,
          widthPx: widthPx,
          isLive: isLive,
          progressPercent: progressPercent,
          minutesLeft: minutesLeft
        }});
      }}
    }}

    return windowPrograms;
  }}

  // Helper to format Date to HH:MM (24-hour)
  formatTime(date) {{
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${{hours}}:${{minutes}}`;
  }}

  // Generates timeline hour slots starting from base date
  getTimeSlots(baseDate = new Date(), count = 6) {{
    const slots = [];
    const baseHour = baseDate.getHours();
    
    for (let i = 0; i < count; i++) {{
      const slotTime = new Date(baseDate);
      slotTime.setHours(baseHour + i, 0, 0, 0);
      slots.push({{
        time: slotTime,
        label: this.formatTime(slotTime)
      }});
    }}
    return slots;
  }}
}}

// Global instance
window.ivtvEPG = new EPGManager();
'''

with open(os.path.join('js', 'epg.js'), 'w', encoding='utf-8') as f:
    f.write(js_content)

print(f"Successfully generated js/epg.js ({len(js_content)} chars)")
