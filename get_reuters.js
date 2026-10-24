async function getReuters() {
  const res = await fetch('https://www.youtube.com/@Reuters', { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const text = await res.text();
  const m = text.match(/"externalId":"([^"]+)"/);
  console.log('Reuters Channel ID:', m ? m[1] : 'none');
}

getReuters();
