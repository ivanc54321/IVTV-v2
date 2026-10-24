async function testMovieStreams() {
  const candidates = [
    { name: 'Great! Movies', url: 'https://amg01753-narrativeuk-amg01753c3-lg-gb-1833.playouts.now.amagi.tv/playlist/amg01753-narrativeuk-greatmovies-lggb/playlist.m3u8' },
    { name: 'Great! Romance', url: 'https://amg01753-narrativeuk-amg01753c2-lg-gb-1832.playouts.now.amagi.tv/playlist/amg01753-narrativeuk-greatchristmas-lggb/playlist.m3u8' },
    { name: 'True Crime', url: 'https://b6cca454.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/U2Ftc3VuZy1nYl9UcnVlQ3JpbWVVS2Zyb21DQlNSZWFsaXR5X0hMUw/playlist.m3u8' },
    { name: 'Now 70s', url: 'https://lightning-now70s-samsungnz.amagi.tv/playlist.m3u8' },
    { name: 'Now 80s', url: 'https://lightning-now80s-samsunguk.amagi.tv/playlist.m3u8' },
    { name: 'Now Rock', url: 'https://lightning-now90s-samsungnz.amagi.tv/playlist.m3u8' },
    { name: 'CBS News', url: 'https://cbsnews.akamaized.net/hls/live/2020607/cbsnlineup_8/master.m3u8' },
    { name: 'Newsmax TV', url: 'https://nmxlive.akamaized.net/hls/live/529965/Live_1/index.m3u8' },
    { name: 'Court TV', url: 'https://content.uplynk.com/channel/6c0bd0f94b1d4526a98676e9699a10ef.m3u8' },
    { name: 'NHK World', url: 'https://master.nhkworld.jp/nhkworld-tv/playlist/live.m3u8' },
    { name: 'Red Bull TV', url: 'https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8' },
    { name: 'TalkTV', url: 'https://488f4ce4.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/TEctZ2JfVGFsa19ITFM/playlist.m3u8' }
  ];

  for (const item of candidates) {
    try {
      const res = await fetch(item.url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(3500) });
      const text = await res.text();
      console.log(`${item.name} -> status: ${res.status}, startsWithEXTM3U: ${text.startsWith('#EXTM3U')}, length: ${text.length}`);
    } catch(e) {
      console.log(`${item.name} -> ERR: ${e.message}`);
    }
  }
}

testMovieStreams();
