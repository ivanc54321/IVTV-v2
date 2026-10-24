import urllib.request

slugs = [
    'SkyAtlantic', 'SkyAtlanticUK',
    'SkyComedy', 'SkyComedyUK',
    'SkyCrime', 'SkyCrimeUK',
    'SkyHistory', 'SkyHistoryUK',
    'SkyArts', 'SkyArtsUK',
    'SkyMax', 'SkyMaxUK',
    'SkyWitness', 'SkyWitnessUK',
    'SkyDocumentaries', 'SkyDocumentariesUK',
    'SkyShowcase', 'SkyShowcaseUK',
    'SkyOne', 'SkyMix', 'SkyReplay',
    'SkySciFiUK', 'SkyNatureUK'
]

print("=== CHECKING FREESHOT EMBEDS ===")
for s in slugs:
    url = f'https://freeshot.live/embed/{s}.php'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0', 'Referer': 'https://freeshot.live/'})
    try:
        res = urllib.request.urlopen(req, timeout=3)
        print(f"[freeshot] {s}: {res.status}")
    except Exception as e:
        pass

print("\n=== CHECKING WIDEIPTV PLAYERS ===")
import re
for s in slugs:
    url = f'https://wideiptv.top/player/{s}'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0', 'Referer': 'https://freeshot.live/'})
    try:
        res = urllib.request.urlopen(req, timeout=3)
        html = res.read().decode('utf-8', errors='ignore')
        m = re.search(r'streamUrl:\s*"([^"]+)"', html)
        if m:
            print(f"[wideiptv] {s}: streamUrl FOUND -> {m.group(1)[:60]}...")
    except Exception as e:
        pass
