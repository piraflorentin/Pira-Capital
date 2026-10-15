"""Fetch daily history for all 500 ETF tickers from Nasdaq's public API and
store compact per-ETF snapshots in data/history/<T>.json.

Run:  python3 scripts/fetch_history.py [--limit N]
Daily: .github/workflows/refresh.yml runs this every weekday after US close.
"""
import json, os, sys, time, urllib.request, urllib.parse, datetime

UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      "Accept": "application/json"}
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HIST = os.path.join(BASE, "data", "history")
os.makedirs(HIST, exist_ok=True)
FROM = (datetime.date.today() - datetime.timedelta(days=6 * 365)).isoformat()


def get(url, tries=4):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except Exception as e:
            time.sleep(2 + 2 * i)
    return None


def fetch(ticker):
    for asset in ("etf", "stocks"):
        url = (f"https://api.nasdaq.com/api/quote/{ticker}/historical"
               f"?assetclass={asset}&fromdate={FROM}&limit=9999")
        j = get(url)
        try:
            rows = j["data"]["tradesTable"]["rows"]
            if rows:
                return rows
        except Exception:
            continue
    return []


def main():
    tickers = [l.strip() for l in open(os.path.join(BASE, "data", "tickers.txt")) if l.strip()]
    if "--limit" in sys.argv:
        tickers = tickers[:int(sys.argv[sys.argv.index("--limit") + 1])]
    ok, failed = [], []
    for i, t in enumerate(tickers):
        fp = os.path.join(HIST, f"{t}.json")
        rows = fetch(t)
        if rows:
            out = {"t": t, "asof": rows[0]["date"],
                   "rows": [[r["date"], r["close"].replace("$", "").replace(",", ""),
                              r["volume"].replace(",", "")] for r in reversed(rows)]}
            json.dump(out, open(fp, "w"))
            ok.append(t)
        else:
            failed.append(t)
        if (i + 1) % 25 == 0:
            print(f"[{i+1}/{len(tickers)}] ok={len(ok)} failed={len(failed)}", flush=True)
        time.sleep(0.4)
    json.dump({"asof": datetime.date.today().isoformat(), "ok": ok, "failed": failed,
               "count": len(ok)}, open(os.path.join(HIST, "meta.json"), "w"))
    print(f"DONE ok={len(ok)} failed={failed}")


if __name__ == "__main__":
    main()
