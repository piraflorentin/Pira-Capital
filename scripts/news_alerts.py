"""News-digest alerts: after the daily news refresh, email users the fresh
stories matching their favorites. Run: python3 scripts/news_alerts.py [--check]
Shares env with send_alerts.py.
"""
import sys, os, re, json, datetime
import sb
from mailer import send_email

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STOP = set("""etf fund trust index shares portfolio total market plus core select
dynamic active premium income enhanced ultra short long term intermediate aggregate
bond stock equity real estate global international developed emerging select dividend
growth value small mid large cap mega country world all ishares vanguard spdr schwab
invesco blackrock state street first wisdomtree vaneck proshares direxion
fidelity jpmorgan franklin alps pimco janus avantis dimensional goldman flexshares
xtrackers teucrium krane roundhill simplify amplify pacer sprott grayscale hoya
morningstar alpha architect columbia etfmg robo nationwide select enhanced""".split())

# Theme keywords -> fund categories they move (mirrors assets/news.js RULES).
THEMES = [
 (["federal reserve", "fed ", "rate cut", "rate hike", "interest rate", "inflation", "cpi", "ppi", "powell", "hawkish", "dovish", "wholesale prices", "producer prices", "consumer prices"],
  ["Treasury Long", "Treasury Intermediate", "Treasury Short", "TIPS", "Aggregate Bond", "IG Corporate", "High Yield", "Municipal", "Muni High Yield", "US REIT", "Nasdaq 100", "Growth", "Utilities", "Dividend"]),
 (["treasury", "yield", "bond market", "deficit", "auction", "t-bill"],
  ["Treasury Long", "Treasury Intermediate", "Treasury Short", "TIPS", "Aggregate Bond", "IG Corporate", "High Yield", "Municipal", "Bank Loan", "Ultra-Short", "Floating Rate"]),
 (["oil", "crude", "opec", "gasoline", "shale", "natural gas", "lng"],
  ["Energy", "Oil", "Natural Gas", "Oil & Gas E&P"]),
 (["nvidia", "tsmc", "semiconductor", "chip", "artificial intelligence", " ai ", "datacenter", "broadcom", "asml", "micron", " amd ", "intel", "openai", "cloud"],
  ["Nasdaq 100", "Semiconductors", "Tech", "AI & Robotics", "Growth", "Communication"]),
 (["bank", "lending", "credit", "deposit", "loan loss", "mortgage"],
  ["Financials", "Banks", "US REIT", "Housing", "Preferred"]),
 (["china", "beijing", "tariff", "trade war", "tiktok"], ["China", "Emerging Markets", "EM Small Cap"]),
 (["ecb", "lagarde", "euro", "europe", "germany", "france"], ["Europe", "Eurozone", "United Kingdom", "Germany", "Developed ex-US"]),
 (["japan", "yen", "bank of japan", "nikkei"], ["Japan", "Currency"]),
 (["gold", "silver", "safe haven", "bullion", "record gold"], ["Gold", "Silver", "Platinum", "Palladium", "Gold Miners"]),
 (["bitcoin", "crypto", "ethereum", "coinbase"], ["Crypto & Blockchain"]),
 (["jobs", "unemployment", "payrolls", "gdp", "recession", "retail sales", "layoff", "ism ", "pmi "],
  ["US Large Cap", "US Total Market", "US Mid Cap", "US Small Cap", "Discretionary", "Nasdaq 100", "Equal Weight"]),
 (["war ", "missile", "strike", "ceasefire", "sanction", "iran", "ukraine", "gaza", "pentagon", "defense"],
  ["Gold", "Silver", "Oil", "Aerospace & Defense", "Uranium", "Volatility"]),
 (["drug", "fda", "vaccine", "medicare", "hospital", "obesity"],
  ["Health Care", "Biotech", "Genomics"]),
 (["dollar", "dxy", "currency", "forex"], ["Currency", "Gold", "Emerging Markets", "Japan"]),
 (["housing", "home price", "rent ", "homebuilder"], ["US REIT", "Global REIT", "Housing"]),
 (["solar", "wind", "clean energy", "renewable", "hydrogen"], ["Clean Energy", "Solar", "Wind", "Infrastructure"]),
 (["uranium", "nuclear", "reactor"], ["Uranium"]),
 (["lithium", "batter", "cobalt"], ["Lithium & Batteries", "Copper", "Metals & Mining"]),
 (["copper", "gold miner", "mining"], ["Copper", "Gold Miners", "Metals & Mining", "Silver"]),
 (["reit", "landlord", "vacancy", "real estate"], ["US REIT", "Global REIT", "Housing"]),
 (["dividend", "buyback", "payout", "aristocrat"], ["Dividend", "Covered Call"]),
 (["vix", "volatility", "fear gauge", "panic"], ["Volatility", "Managed Futures"]),
 (["earnings", "record profit", "guidance", "wall street"], ["US Large Cap", "Nasdaq 100", "Tech", "Communication", "Discretionary"]),
 (["india", "mexico", "brazil", "latin america"], ["Emerging Markets", "India", "Brazil", "Mexico", "EM Small Cap"]),
]


def tokens(name, cat):
    toks = set(re.findall(r"[a-z0-9]{3,}", (name + " " + cat).lower())) - STOP
    if "s&p" in (name + " " + cat).lower():
        toks.update(["s&p", "s&p 500"])
    return toks


def match(title, ticker, cat, toks):
    t = " " + title.lower() + " "
    if re.search(r"\b" + re.escape(ticker.lower()) + r"\b", t):
        return True
    for kw, cats in THEMES:
        if cat in cats and any(k in t for k in kw):
            return True
    for w in toks:
        hit = re.search(r"\b" + re.escape(w) + r"\b", t) if len(w) <= 4 else (w in t)
        if hit:
            return True
    return False


def main():
    check = "--check" in sys.argv
    uni = json.load(open(os.path.join(BASE, "data", "universe.json")))["etfs"]
    meta = {e[0]: (e[1], e[2]) for e in uni}
    news = json.load(open(os.path.join(BASE, "data", "news-daily.json")))
    stories = []
    for s in (news.get("sources") or {}).get("cnbc", []):
        stories.append({"title": s["title"], "link": s["link"],
                        "outlet": "CNBC", "date": s.get("date", "")})
    for t, items in ((news.get("etf")) or {}).items():
        for w in items or []:
            stories.append({"title": w["title"], "link": w["link"],
                            "outlet": w.get("outlet", ""), "date": w.get("date", "")})
    try:
        extra = json.load(open(os.path.join(BASE, "data", "etf-news.json")))
        for t, items in (extra.get("etf") or {}).items():
            for w in items or []:
                stories.append({"title": w["title"], "link": w["link"],
                                "outlet": w.get("outlet", ""), "date": w.get("date", "")})
    except Exception:
        pass
    seen_links, uniq = set(), []
    for s in stories:
        if s["link"] in seen_links:
            continue
        seen_links.add(s["link"])
        uniq.append(s)
    users = {u["id"]: u.get("email") for u in sb.admin_users() if u.get("email")}
    prefs = {p["user_id"]: p for p in sb.rest_get("alert_prefs")}
    states = {s["user_id"]: (s.get("state") or {}) for s in sb.rest_get("user_state", "user_id,state")}
    today = datetime.date.today().isoformat()
    logged = {(l["user_id"], l.get("title", "")) for l in
              sb.rest_get("alert_log", "user_id,title", f"kind=eq.news&created_at=gte.{today}")}
    for uid, email in users.items():
        p = prefs.get(uid) or {}
        if not p.get("news_alerts", True):
            continue
        try:
            favs = json.loads((states.get(uid) or {}).get("pira-favs") or "[]")
        except Exception:
            favs = []
        hits = []
        for t in favs:
            if t not in meta:
                continue
            toks = tokens(*meta[t])
            for s in uniq:
                if (uid, s["title"]) in logged:
                    continue
                if match(s["title"], t, meta[t][1], toks):
                    hits.append((t, s))
        if not hits:
            continue
        lines = [f"[{t}] {s['title']} ({s['outlet']}) {s['link']}" for t, s in hits[:12]]
        body = ("Fresh stories on your watched ETFs:\n\n" + "\n\n".join(lines) +
                f"\n\n(+{max(0, len(hits) - 12)} more — open the news page)\n"
                "https://pira-capital.vercel.app/news.html\n"
                "Automated by Pira Capital ETF Observatory — not financial advice.")
        if check:
            print("WOULD SEND to", email, f"{len(hits)} stories")
        else:
            try:
                send_email(email, f"ETF news digest: {len(hits)} stories on your watchlist", body)
                for t, s in hits[:12]:
                    sb.rest_post("alert_log", {"user_id": uid, "kind": "news",
                                               "ticker": t, "title": s["title"][:200]})
                print("sent digest to", email, len(hits))
            except Exception as e:
                print("send failed for", email, e)
    print("DONE")


if __name__ == "__main__":
    main()
