import urllib.parse
import urllib.request
import re
import sys

# Test query parsing
q = 'url=https%3A%2F%2Fds169.bluetier.top%2Fskysportspremierleague%2Findex.m3u8%3Ftoken%3Dabc&ref=https%3A%2F%2Fwideiptv.top%2F'
p = urllib.parse.parse_qs(q)
print('Parsed URL:', p.get('url', [''])[0])
print('Parsed Ref:', p.get('ref', [None])[0])

# Now fetch a real fresh stream via wideiptv
slug = 'skysportspremierleague'
url = f"https://wideiptv.top/player/{slug}"
req = urllib.request.Request(url, headers={
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://freeshot.live/'
})
html = urllib.request.urlopen(req, timeout=5).read().decode('utf-8', errors='ignore')
m = re.search(r'streamUrl:\s*"([^"]+)"', html)
if m:
    clean_url = m.group(1).replace(r'\/', '/')
    print('Clean URL:', clean_url)
    
    # Test with exact headers used in proxy_hls_stream
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Referer': 'https://wideiptv.top/',
        'Origin': 'https://wideiptv.top'
    }
    try:
        req2 = urllib.request.Request(clean_url, headers=headers)
        with urllib.request.urlopen(req2, timeout=5) as resp:
            print('SUCCESS WITH HEADERS! Code:', resp.getcode(), 'Bytes:', len(resp.read()))
    except Exception as e:
        print('FAIL WITH HEADERS:', e)
        # Try without Origin
        del headers['Origin']
        try:
            req3 = urllib.request.Request(clean_url, headers=headers)
            with urllib.request.urlopen(req3, timeout=5) as resp3:
                print('SUCCESS WITHOUT ORIGIN! Code:', resp3.getcode(), 'Bytes:', len(resp3.read()))
        except Exception as e2:
            print('FAIL WITHOUT ORIGIN TOO:', e2)
