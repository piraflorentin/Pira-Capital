"""Bake a daily news snapshot (Fed + ECB + CNBC) into data/news-daily.json.

Run:  python3 scripts/refresh_news.py
Daily: .github/workflows/refresh.yml runs this every weekday.
Browser shows this baked file (always works) + live CNBC headlines on top.
"""
import json, os, re, time, html, datetime, urllib.request, xml.etree.ElementTree as ET

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = {"User-Agent": "Mozilla/5.0"}
FEEDS = {
    "fed": "https://www.federalreserve.gov/feeds/press_all.xml",
    "ecb": "https://www.ecb.europa.eu/rss/press.xml",
    "cnbc": "https://www.cnbc.com/id/100003114/device/rss/rss.html",
}
LIMIT = {"fed": 10, "ecb": 10, "cnbc": 15}
# Most-held ETFs get a daily web-news scan (Google News RSS, no key needed)
ETF_SCAN = ["SPY", "QQQ", "VOO", "VTI", "DIA", "IWM", "QQQM", "SCHD", "VIG", "JEPI",
            "TLT", "IEF", "SHY", "VGSH", "AGG", "BND", "LQD", "HYG", "TIP", "MUB",
            "GLD", "IAU", "SLV", "USO", "UNG", "XLE", "XLK", "XLF", "XLV", "SOXX",
            "VNQ", "EEM", "VWO", "EFA", "VEA", "EWJ", "FXI", "ARKK", "TQQQ", "IBIT"]


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
    out = {"asof": datetime.date.today().isoformat(), "sources": {}}
    for name, url in FEEDS.items():
        try:
            out["sources"][name] = fetch(name, url)
            print(name, len(out["sources"][name]), "items")
        except Exception as e:
            print(name, "FAILED:", e)
            out["sources"][name] = []
        time.sleep(1)
    # per-ETF web scan
    etfnews = {}
    for t in ETF_SCAN:
        try:
            q = urllib.parse.quote(f"{t} ETF")
            url = (f"https://news.google.com/rss/search?q={q}"
                   "&hl=en-US&gl=US&ceid=US%3Aen")
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=30) as r:
                root = ET.fromstring(r.read())
            items = []
            for it in list(root.iter("item"))[:8]:
                def txt(tag):
                    el = it.find(tag)
                    return clean(el.text) if el is not None and el.text else ""
                src = it.find("source")
                items.append({"title": txt("title"), "link": txt("link"),
                              "date": txt("pubDate"),
                              "outlet": clean(src.text) if src is not None else ""})
            etfnews[t] = [x for x in items if x["title"]]
            print(t, len(etfnews[t]))
        except Exception as e:
            print(t, "FAILED:", e)
            etfnews[t] = []
        time.sleep(1)
    out["etf"] = etfnews
    fp = os.path.join(BASE, "data", "news-daily.json")
    json.dump(out, open(fp, "w"))
    print("wrote", fp)


if __name__ == "__main__":
    main()
