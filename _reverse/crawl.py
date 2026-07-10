import os, re, urllib.request, urllib.error
from urllib.parse import urljoin, urlparse

BASE = "https://meet-plus.sun-asterisk.ai"
OUT = "mirror"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
seen = set(); queue = []

# match any relative/absolute ref to a .js/.css asset inside html or js
ref_re = re.compile(r'["\'`(]([^"\'`()\s]+?\.(?:js|css|svg|png|woff2?|json))["\'`)]')

def norm_to_base(url):
    idx = urlparse(url).path.find("_app/")
    return url

def save(url, data):
    p = urlparse(url).path
    if p.endswith("/") or p == "": p += "index.html"
    if "." not in os.path.basename(p): p += ".html"
    local = os.path.join(OUT, p.lstrip("/"))
    os.makedirs(os.path.dirname(local), exist_ok=True)
    open(local, "wb").write(data)
    return local

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            return r.read(), dict(r.getheaders()), r.getcode()
    except urllib.error.HTTPError as e:
        return e.read(), dict(e.headers), e.code
    except Exception as e:
        return None, {}, str(e)

def add(url):
    pth = urlparse(url).path
    i = pth.find("_app/")
    if i >= 0:
        u = BASE + "/" + pth[i:]
        if u not in seen and u not in queue: queue.append(u)

for r in ["/", "/login", "/dashboard"]:
    queue.append(BASE + r)

count = 0
while queue:
    url = queue.pop(0)
    if url in seen: continue
    seen.add(url)
    data, hdrs, code = fetch(url)
    if data is None: 
        print("ERR", code, url); continue
    save(url, data); count += 1
    text = data.decode("utf-8", "ignore")
    # 1) parse Link header (early hints) for chunk list
    link = hdrs.get("Link") or hdrs.get("link") or ""
    for m in re.finditer(r'<([^>]+?\.(?:js|css))>', link):
        add(urljoin(url, m.group(1)))
    # 2) parse refs inside body, resolve relative to this url
    for m in ref_re.finditer(text):
        ref = m.group(1)
        if ref.startswith("http") and BASE not in ref: continue
        add(urljoin(url, ref))
    if count % 30 == 0: print("...", count, "done,", len(queue), "queued")

print("DONE files:", count)
