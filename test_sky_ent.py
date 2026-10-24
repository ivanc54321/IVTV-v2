import urllib.request
import json
import time

channels = [
    ('sky-atlantic-uk', 'Sky Atlantic UK'),
    ('sky-showcase', 'Sky Showcase'),
    ('sky-comedy-uk', 'Sky Comedy UK'),
    ('sky-crime-uk', 'Sky Crime UK'),
    ('sky-history-uk', 'Sky History UK'),
    ('sky-arts-uk', 'Sky Arts UK')
]

for cid, name in channels:
    print(f"\n--- Testing {name} ({cid}) ---")
    try:
        t0 = time.time()
        res = urllib.request.urlopen(f'http://localhost:5173/api/stream?channel={cid}', timeout=4)
        data = json.loads(res.read().decode())
        stream_url = data.get('streamUrl', '')
        fallback = data.get('fallbackEmbedUrl', '')
        print(f"API StreamUrl: {stream_url[:70]}...")
        print(f"API Fallback: {fallback}")
        
        if stream_url:
            t1 = time.time()
            full_url = 'http://localhost:5173' + stream_url if stream_url.startswith('/') else stream_url
            hls_res = urllib.request.urlopen(full_url, timeout=5)
            content = hls_res.read()
            print(f"HLS Status: {hls_res.status}, Length: {len(content)}, Preview: {content[:100]}")
        else:
            print("No direct stream URL provided!")
    except Exception as e:
        print(f"Error for {cid}: {e}")
