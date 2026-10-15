"""Bake a daily news snapshot (Fed + ECB + CNBC) into data/news-daily.json.

Run:  python3 scripts/refresh_news.py
Daily: .github/workflows/refresh.yml runs this every weekday.
Browser shows this baked file (always works) + live CNBC headlines on top.
"""
import json, os, re, sys, time, html, datetime, urllib.request, xml.etree.ElementTree as ET

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = {"User-Agent": "Mozilla/5.0"}
FEEDS = {
    "fed": "https://www.federalreserve.gov/feeds/press_all.xml",
    "ecb": "https://www.ecb.europa.eu/rss/press.xml",
    "cnbc": "https://www.cnbc.com/id/100003114/device/rss/rss.html",
}
LIMIT = {"fed": 10, "ecb": 10, "cnbc": 15}
ETF_SCAN_N = 6  # stories stored per ETF


def etf_list():
    try:
        with open(os.path.join(BASE, "data", "tickers.txt")) as f:
            return [l.strip() for l in f if l.strip()]
    except Exception:
        return []


def watched_tickers():
    """Tickers real users currently favorite (for the hourly refresh)."""
    try:
        sys.path.insert(0, os.path.join(BASE, "scripts"))
        import sb as _sb
        if not (_sb.URL and _sb.KEY):
            return []
        favs = set()
        for s in _sb.rest_get("user_state", "state"):
            try:
                favs.update(json.loads((s.get("state") or {}).get("pira-favs") or "[]"))
            except Exception:
                pass
        tickers = [l.strip() for l in open(os.path.join(BASE, "data", "tickers.txt")).read().split()]
        return [t for t in favs if t in tickers]
    except Exception as e:
        print("watched_tickers failed:", e)
        return []


def story_outlet(title, src):
    title, outlet = title, src
    if " - " in title:
        head, tail = title.rsplit(" - ", 1)
        if len(tail) < 45 and not outlet:
            return head, tail
    return title, outlet


def etf_scan_bing(t):
    q = urllib.parse.quote(f"{t} ETF")
    url = f"https://www.bing.com/news/search?q={q}&format=rss"
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        root = ET.fromstring(r.read())
    items = []
    for it in list(root.iter("item"))[:ETF_SCAN_N]:
        def txt(tag):
            el = it.find(tag)
            return clean(el.text) if el is not None and el.text else ""
        title, outlet = story_outlet(txt("title"), "")
        desc = txt("description")[:240]
        if title:
            items.append({"title": title, "link": txt("link"), "date": txt("pubDate"),
                          "outlet": outlet, "desc": desc})
    return items


def etf_scan_google(t):
    q = urllib.parse.quote(f"{t} ETF")
    url = (f"https://news.google.com/rss/search?q={q}"
           "&hl=en-US&gl=US&ceid=US%3Aen")
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        root = ET.fromstring(r.read())
    items = []
    for it in list(root.iter("item"))[:ETF_SCAN_N]:
        def txt(tag):
            el = it.find(tag)
            return clean(el.text) if el is not None and el.text else ""
        src = it.find("source")
        title, outlet = story_outlet(txt("title"), clean(src.text) if src is not None else "")
        if title:
            items.append({"title": title, "link": txt("link"), "date": txt("pubDate"),
                          "outlet": outlet, "desc": ""})
    return items


def clean(s):
    s = html.unescape(s or "")
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", s)).strip()


def fetch(name, url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        root = ET.fromstring(r.read())
    items = []
    for it in root.iter("item"):
        def txt(tag):
            el = it.find(tag)
            return clean(el.text) if el is not None and el.text else ""
        link = txt("link")
        if not link and it.find("link") is not None:
            link = (it.find("link").attrib.get("href") or "").strip()
        items.append({"title": txt("title"), "link": link, "date": txt("pubDate") or txt("updated") or txt("pubdate"),
                      "desc": txt("description")[:400]})
        if len(items) >= LIMIT[name]:
            break
    return [x for x in items if x["title"]]


def main():
    favs_only = "--favs-only" in sys.argv
    out = {"asof": datetime.date.today().isoformat(), "sources": {}}
    todo = watched_tickers() if favs_only else etf_list()
    if favs_only and not todo:
        print("no watched ETFs, nothing to do")
        return
    if favs_only:
        try:
            prev = json.load(open(os.path.join(BASE, "data", "etf-news.json")))
            etfnews = prev.get("etf", {})
        except Exception:
            etfnews = {}
    else:
        for name, url in FEEDS.items():
            try:
                out["sources"][name] = fetch(name, url)
                print(name, len(out["sources"][name]), "items")
            except Exception as e:
                print(name, "FAILED:", e)
                out["sources"][name] = []
            time.sleep(1)
        etfnews = {}
    for i, t in enumerate(todo):
        items = []
        try:
            items = etf_scan_bing(t) or etf_scan_google(t)
        except Exception as e:
            print(f"[{i+1}]", t, "FAILED:", e)
        try:
            if not items:
                items = etf_scan_google(t)
        except Exception:
            pass
        if items:
            etfnews[t] = items
        print(f"[{i+1}]", t, len(items))
        time.sleep(1.2)
    json.dump({"asof": datetime.date.today().isoformat(), "etf": etfnews},
              open(os.path.join(BASE, "data", "etf-news.json"), "w"))
    print("etf-news.json ETFs covered:", len(etfnews))
    if favs_only:
        return
    fp = os.path.join(BASE, "data", "news-daily.json")
    json.dump(out, open(fp, "w"))
    print("wrote", fp)


if __name__ == "__main__":
    main()
