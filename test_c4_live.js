async function testC4C5() {
  const tests = [
    { name: 'C4 1', url: 'http://176.65.146.105:8011/play/a07w/index.m3u8', headers: { 'User-Agent': 'VLC/3.0.18' } },
    { name: 'C5 1', url: 'http://193.46.58.239:8080/Channel5/index.m3u8', headers: { 'User-Agent': 'VLC/3.0.18' } },
    { name: 'C4 2', url: 'https://viamotionhsi.netplus.ch/live/eds/channel4/browser-HLS8/channel4.m3u8', headers: { 'User-Agent': 'Mozilla/5.0' } }
  ];
  for (const t of tests) {
    try {
      const res = await fetch(t.url, { headers: t.headers, signal: AbortSignal.timeout(3000) });
      const text = await res.text();
      console.log(`${t.name}: status=${res.status}, len=${text.length}, isM3u8=${text.startsWith('#EXTM3U')}`);
    } catch(e) {
      console.log(`${t.name}: ERR=${e.message}`);
    }
  }
}

testC4C5();
