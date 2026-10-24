async function testTrace() {
  const url1 = 'https://wideiptv.top/player/TraceSports';
  const url2 = 'https://freeshot.live/embed/TraceSports.php';
  try {
    const res1 = await fetch(url1, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://freeshot.live/' } });
    console.log('Trace wide status:', res1.status);
    const text1 = await res1.text();
    console.log('hasStreamUrl:', text1.includes('streamUrl'));
  } catch(e) {
    console.log('Trace wide err:', e.message);
  }
  try {
    const res2 = await fetch(url2, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://freeshot.live/' } });
    console.log('Trace freeshot status:', res2.status);
  } catch(e) {
    console.log('Trace freeshot err:', e.message);
  }
}

testTrace();
