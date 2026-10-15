"""Weekly universe refresh: maintain the 500-ETF membership —
drop dead listings (no live quote AND no history), admit validated candidates.

Run:  python3 scripts/refresh_universe.py [--check]   # --check = report only
Auto: .github/workflows/refresh.yml runs this every Sunday.
Honest limit: no free source offers true AUM rankings, so ORDER stays curated
(biggest first as researched); this job keeps MEMBERSHIP fresh instead.
"""
import json, os, sys, time, urllib.request, urllib.parse, datetime

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = {"User-Agent": "Mozilla/5.0"}
# Funds with known vendor gaps (Nasdaq/CNBC miss them though they trade) — never auto-drop.
PROTECTED = {"SPY", "IVV", "VOO", "VTI", "QQQ", "QQQM", "BND", "AGG", "GLD", "IAU",
             "SLV", "TLT", "VEA", "VXUS", "DIA", "IWM", "VNQ", "XLF", "XLK",
             "SPLG", "SLY", "SCHD", "VIG", "JEPI", "EEM", "VWO"}
MAX_DROP = 10


def cnbc(syms):
    url = ("https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol?symbols="
           + urllib.parse.quote("|".join(syms)) +
           "&requestMethod=extended&noform=1&partnerId=2&fund=1&exthrs=1&output=json")
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=40) as r:
        j = json.load(r)
    return (j.get("FormattedQuoteResult") or {}).get("FormattedQuote") or []


def main():
    check = "--check" in sys.argv
    u = json.load(open(os.path.join(BASE, "data", "universe.json")))
    etfs = u["etfs"]
    have = {e[0] for e in etfs}
    quotes = {}
    syms = [e[0] for e in etfs]
    for i in range(0, len(syms), 50):
        for attempt in range(2):
            try:
                for q in cnbc(syms[i:i + 50]):
                    try:
                        price = float(str(q.get("last", "")).replace(",", ""))
                    except Exception:
                        continue
                    if q.get("code") != 0 or q.get("countryCode") != "US":
                        continue
                    quotes[q["symbol"]] = {
                        "price": price, "name": q.get("name") or ""}
                break
            except Exception as e:
                print("batch failed, retry:", e)
                time.sleep(3)
        time.sleep(1)
    print(f"usable quotes: {len(quotes)}/{len(syms)}")
    # candidates: lines like  TICKER | Category
    added = []
    try:
        cand_lines = open(os.path.join(BASE, "data", "candidates.txt")).read().splitlines()
    except Exception:
        cand_lines = []
    for line in cand_lines:
        line = line.strip()
        if not line or line.startswith("#") or "|" not in line:
            continue
        t, c = [x.strip() for x in line.split("|", 1)]
        if t in have:
            continue
        q = quotes.get(t)
        if q:
            etfs.append([t, q["name"] or (t + " ETF"), c or "New listing"])
            have.add(t)
            added.append(t)
    # dead = no usable quote AND no history file AND not protected
    dead = [e[0] for e in etfs
            if e[0] not in quotes
            and not os.path.exists(os.path.join(BASE, "data", "history", e[0] + ".json"))
            and e[0] not in PROTECTED][:MAX_DROP]
    retired = []
    if dead:
        try:
            retired = json.load(open(os.path.join(BASE, "data", "retired.json")))
        except Exception:
            retired = []
        for e in etfs[:]:
            if e[0] in dead:
                retired.append({"t": e[0], "n": e[1], "c": e[2],
                                "dropped": datetime.date.today().isoformat(),
                                "reason": "no live quote and no history"})
                etfs.remove(e)
    # NOTE: order stays curated (no free source offers full AUM rankings;
    # partial market-cap data would corrupt the order, so we don't sort).
    report = {"asof": datetime.date.today().isoformat(), "count": len(etfs),
              "usable_quotes": len(quotes),
              "added": added, "dropped": dead,
              "note": "order curated; membership auto-maintained"}
    print(json.dumps(report, indent=1))
    if check:
        return
    json.dump({"brand": u.get("brand", "Pira Capital"), "etfs": etfs},
              open(os.path.join(BASE, "data", "universe.json"), "w"))
    open(os.path.join(BASE, "data", "tickers.txt"), "w").write("\n".join(e[0] for e in etfs))
    js = ("window.ETF_UNIVERSE=" + json.dumps(etfs) + ";\n"
          "window.SITE_META=" + json.dumps({"brand": "Pira Capital — ETF Observatory",
                                            "count": len(etfs)}) + ";\n")
    open(os.path.join(BASE, "assets", "universe.js"), "w").write(js)
    json.dump(retired, open(os.path.join(BASE, "data", "retired.json"), "w"))
    json.dump(report, open(os.path.join(BASE, "data", "universe-report.json"), "w"))
    print("universe rewritten:", len(etfs))


if __name__ == "__main__":
    main()
