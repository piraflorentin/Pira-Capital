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


# Same themes in (label, keywords, categories) form for label_for().
THEMES_LAB = [
 ("Rates & inflation", ["federal reserve", "fed ", "rate cut", "rate hike", "interest rate", "inflation", "cpi", "ppi", "powell", "hawkish", "dovish", "wholesale prices", "producer prices", "consumer prices"], ["Treasury Long", "Treasury Intermediate", "Treasury Short", "TIPS", "Aggregate Bond", "IG Corporate", "High Yield", "Municipal", "Muni High Yield", "US REIT", "Nasdaq 100", "Growth", "Utilities", "Dividend"]),
 ("Bonds & yields", ["treasury", "yield", "bond market", "deficit", "auction", "t-bill"], ["Treasury Long", "Treasury Intermediate", "Treasury Short", "TIPS", "Aggregate Bond", "IG Corporate", "High Yield", "Municipal", "Bank Loan", "Ultra-Short", "Floating Rate"]),
 ("Energy", ["oil", "crude", "opec", "gasoline", "shale", "natural gas", "lng"], ["Energy", "Oil", "Natural Gas", "Oil & Gas E&P"]),
 ("Tech & semis", ["nvidia", "tsmc", "semiconductor", "chip", "artificial intelligence", " ai ", "datacenter", "broadcom", "asml", "micron", " amd ", "intel", "openai", "cloud"], ["Nasdaq 100", "Semiconductors", "Tech", "AI & Robotics", "Growth", "Communication"]),
 ("Financials & housing", ["bank", "lending", "credit", "deposit", "loan loss", "mortgage"], ["Financials", "Banks", "US REIT", "Housing", "Preferred"]),
 ("China & trade", ["china", "beijing", "tariff", "trade war", "tiktok"], ["China", "Emerging Markets", "EM Small Cap"]),
 ("Europe", ["ecb", "lagarde", "euro", "europe", "germany", "france"], ["Europe", "Eurozone", "United Kingdom", "Germany", "Developed ex-US"]),
 ("Japan", ["japan", "yen", "bank of japan", "nikkei"], ["Japan", "Currency"]),
 ("Gold & safety", ["gold", "silver", "safe haven", "bullion", "record gold"], ["Gold", "Silver", "Platinum", "Palladium", "Gold Miners"]),
 ("Crypto-linked", ["bitcoin", "crypto", "ethereum", "coinbase"], ["Crypto & Blockchain"]),
 ("Growth & consumer", ["jobs", "unemployment", "payrolls", "gdp", "recession", "retail sales", "layoff", "ism ", "pmi "], ["US Large Cap", "US Total Market", "US Mid Cap", "US Small Cap", "Discretionary", "Nasdaq 100", "Equal Weight"]),
 ("Geopolitics & defence", ["war ", "missile", "strike", "ceasefire", "sanction", "iran", "ukraine", "gaza", "pentagon", "defense"], ["Gold", "Silver", "Oil", "Aerospace & Defense", "Uranium", "Volatility"]),
 ("Health care", ["drug", "fda", "vaccine", "medicare", "hospital", "obesity"], ["Health Care", "Biotech", "Genomics"]),
 ("Dollar", ["dollar", "dxy", "currency", "forex"], ["Currency", "Gold", "Emerging Markets", "Japan"]),
 ("Property & REITs", ["housing", "home price", "rent ", "homebuilder", "reit", "real estate"], ["US REIT", "Global REIT", "Housing"]),
 ("Clean energy", ["solar", "wind", "clean energy", "renewable", "hydrogen"], ["Clean Energy", "Solar", "Wind", "Infrastructure"]),
 ("Nuclear & uranium", ["uranium", "nuclear", "reactor"], ["Uranium"]),
 ("Batteries & lithium", ["lithium", "batter", "cobalt"], ["Lithium & Batteries", "Copper", "Metals & Mining"]),
 ("Metals & miners", ["copper", "gold miner", "mining"], ["Copper", "Gold Miners", "Metals & Mining", "Silver"]),
 ("Dividends", ["dividend", "buyback", "payout", "aristocrat"], ["Dividend", "Covered Call"]),
 ("Volatility", ["vix", "volatility", "fear gauge", "panic"], ["Volatility", "Managed Futures"]),
 ("Earnings", ["earnings", "record profit", "guidance", "wall street"], ["US Large Cap", "Nasdaq 100", "Tech", "Communication", "Discretionary"]),
 ("China & trade", ["india", "mexico", "brazil", "latin america"], ["Emerging Markets", "India", "Brazil", "Mexico", "EM Small Cap"]),
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


# Direction word lists — MIRROR of assets/news.js (GEN_UP/GEN_DN + DIRS).
# Keep in sync: a story only gets emailed when tone_function agrees with the
# green/red chip the reader would see on the site.
GEN_UP = ["beat", "record", "surge", "rally", "jump", "soar", "approv", "deal", "stimulus",
          "dovish", "rate cut", "breakthrough", "upgrade", "rebound", "optimism", "win",
          "cleared", "backing", "ceasefire", "resumes", "lifts", "lift", "boost", "boosts",
          "gains", "raises", "soars", "jumps"]
GEN_DN = ["miss", "plunge", "tumble", "sell-off", "selloff", "rout", "slump", "fear", "warning",
          "ban", "tariff", "probe", "lawsuit", "downgrade", "crash", "falls", "fall ", "drop",
          "hike", "hot ", "fraud", "default", "recall", "layoff", "strike", "war ", "attack",
          "threat", "sinks", "sink", "drags", "weighs", "weigh", "halts", "losses"]

DIRS = {
    "Rates & inflation": (["rate cut", "cuts rates", "dovish", "pause", "cooling", "cools", "soft landing", "eases", "slows", "softer", "below forecast", "below estimates"],
                          ["rate hike", "hikes", "hawkish", "hot", "sticky", "deficit", "downgrade", "prices jumped", "prices rose", "prices climb", "prices rise", "inflation jumped", "inflation rose", "hot inflation", "accelerat"]),
    "Bonds & yields": (["rate cut", "dovish", "flee to safety", "flight to safety", "yields slide",
                        "yields fall", "yields drop", "cooling", "slowdown"],
                       ["rate hike", "hawkish", "yields jump", "yields rise", "yields climb", "auction", "deficit", "hot"]),
    "Energy": (["surge", "jump", "soar", "sanction", "embargo", "strike", "opec cut", "disruption"],
               ["plunge", "slump", "glut", "oversupply", "inventory", "slowdown", "record output"]),
    "Tech & semis": (["beat", "record", "boom", "breakthrough", "deal", "approv", "raises", "upgrade", "demand"],
                     ["miss", "sell-off", "selloff", "rout", "ban", "probe", "slump", "warning", "layoff", "antitrust"]),
    "Gold & safety": (["fear", "risk", "war", "crisis", "record", "rate cut", "dovish", "safe haven", "central bank"],
                      ["rate hike", "hawkish", "strong dollar", "risk-on", "calm"]),
    "Growth & consumer": (["beat", "strong", "boom", "record", "optimism", "rebound"],
                          ["recession", "miss", "weak", "layoff", "slump", "fear", "contracts"]),
    "China & trade": (["stimulus", "deal", "talks", "eases", "rebound", "support"],
                      ["tariff", "ban", "crackdown", "probe", "sanction", "warning", "slump"]),
    "Geopolitics & defence": (["strike", "war", "missile", "attack", "threat", "sanction", "escalat"],
                              ["ceasefire", "deal", "talks", "peace", "de-escalat"]),
    "Earnings": (["beat", "record", "raises", "upgrade", "strong", "growth"],
                 ["miss", "warning", "weak", "downgrade", "slump", "cuts"]),
    "Crypto-linked": (["approv", "adoption", "record", "surge", "rally", "inflow", "reserve"],
                      ["ban", "crackdown", "hack", "lawsuit", "plunge", "crash", "outflow", "fraud"]),
    "Clean energy": (["subsid", "approv", "deal", "record", "demand", "climate deal"],
                     ["repeal", "cut subsid", "oversupply", "bankrupt", "tariff", "slowdown"]),
    "Nuclear & uranium": (["approv", "restart", "deal", "contract", "demand", "record"],
                          ["shutdown", "accident", "delay", "opposition"]),
    "Batteries & lithium": (["deficit", "shortage", "deal", "demand", "record"],
                            ["oversupply", "glut", "price crash", "slowdown", "weak demand"]),
    "Metals & miners": (["record", "surge", "shortage", "deficit", "strike"],
                        ["slump", "plunge", "costs", "weak demand", "slowdown"]),
    "Property & REITs": (["rate cut", "dovish", "rent growth", "occupancy", "deal", "upgrade"],
                         ["rate hike", "vacanc", "default", "downgrade", "oversupply"]),
    "Dividends": (["hike", "raises", "record", "growth"], ["cut", "suspend", "omit", "rotation"]),
    "Volatility": (["panic", "fear", "crash", "sell-off", "spike", "surge"],
                   ["calm", "complacency", "record low", "rally"]),
}


def tone(title, label):
    """+1 like-up, -1 like-down, 0 mixed/neutral — same logic as toneOf() on the site."""
    t = (title or "").lower()
    src = DIRS.get(label)
    up = src[0] if src else GEN_UP
    dn = src[1] if src else GEN_DN
    u = any(k in t for k in up)
    d = any(k in t for k in dn)
    return 1 if (u and not d) else (-1 if (d and not u) else 0)


def theme_labels(cat):
    """(label, keywords) pairs whose category set covers this fund's category."""
    out = []
    for label, kws, cats in THEMES_LAB:
        if cats and cat in cats:
            out.append((label, kws))
    return out


def label_for(title, cat):
    """Human label of the first theme this story keys on for this fund (site-style)."""
    t = " " + (title or "").lower() + " "
    for label, kws in theme_labels(cat):
        if any(k in t for k in kws):
            return label
    return "Fund-specific"


def cumulative(hits):
    """(net tone, loud-word count) over a fund's alert hits."""
    score = sum(tone(s["title"], s["label"]) for s in hits)
    loud = sum(1 for s in hits
               if any(w in s["title"].lower() for w in
                      ("record", "surge", "plunge", "crash", "soar", "slump", "rout", "spike")))
    return score, loud


def fund_line(t, name, top, total):
    """Mini-readout for one fund: net tone, dominant theme, strongest signals."""
    pos = [s for s in top if s["tone"] > 0]
    neg = [s for s in top if s["tone"] < 0]
    net = len(pos) - len(neg)
    v = "🟢 likely positive" if net >= 1 else ("🔴 likely negative" if net <= -1 else "⚪ mixed")
    themes = {}
    for s in top:
        if s["label"] != "Fund-specific":
            themes[s["label"]] = themes.get(s["label"], 0) + 1
    if themes:
        head = "Main theme: " + sorted(themes.items(), key=lambda kv: -kv[1])[0][0]
    else:
        head = name + " in the spotlight"
    pick = (neg + pos) or top
    direct_pick = [s for s in pick if s["direct"]] or pick
    pick = direct_pick[0]
    flag = "🔼" if pick["tone"] > 0 else "🔽"
    lines = [f"{'▲' if s['tone']>0 else '▼'} {s['title']} ({s['outlet']}) {s['link']}" for s in top]
    extra = f"\n(+{total-6} more; showing strongest 6)" if total > 6 else ""
    return (f"[{t}] {name} — {v} ({len(pos)} up / {len(neg)} down of {total} directional today). "
            f"{head}. {flag} Centerpiece: {pick['title']}\n" + "\n".join(lines) + extra), net


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
        byfund = {}
        for t in favs:
            if t not in meta:
                continue
            toks = tokens(*meta[t])
            for s in uniq:
                if (uid, s["title"]) in logged:
                    continue
                if match(s["title"], t, meta[t][1], toks):
                    lab = label_for(s["title"], meta[t][1])
                    byfund.setdefault(t, []).append({"title": s["title"], "link": s["link"],
                                                     "outlet": s["outlet"], "label": lab})
        # Score every match: fund named in headline? loud words? Then keep only
        # the strongest 6 directional signals per fund.
        LOUD = ("record", "surge", "plunge", "crash", "soar", "slump", "rout", "spike",
                "jumps", "falls", "tumble", "selloff", "rebound")
        alerts, total_all = {}, {}
        for t, h in byfund.items():
            for x in h:
                low = x["title"].lower()
                x["direct"] = bool(re.search(r"\b" + re.escape(t.lower()) + r"\b", low))
                x["loud"] = any(w in low for w in LOUD)
                x["tone"] = tone(x["title"], x["label"])
            dir_hits = [x for x in h if x["tone"] != 0]
            if not dir_hits:
                continue
            # the fund earns an email only if something speaks directly or loudly —
            # pure broad-market echoes are exactly the noise to avoid
            if not (any(x["direct"] for x in dir_hits) or any(x["loud"] for x in dir_hits)):
                continue
            dir_hits.sort(key=lambda x: (4 if x["direct"] else 0) + (2 if x["loud"] else 0),
                          reverse=True)
            total_all[t] = len(dir_hits)
            alerts[t] = dir_hits[:6]
        if not alerts:
            continue
        blocks, targets = [], []
        order = sorted(alerts.keys(),
                       key=lambda t: -abs(sum(x["tone"] for x in alerts[t])))
        for t in order[:4]:
            text, net = fund_line(t, meta[t][0], alerts[t], total_all[t])
            blocks.append(text)
            targets.append((t, total_all[t], net))
        neutral_skipped = sum(1 for t in alerts for x in byfund[t] if x["tone"] == 0)
        head = "News direction alerts on your watchlist\n"
        for t, n, net in targets:
            head += f"  • {t}: {n} directional stories (net {'+' if net>=0 else ''}{net})\n"
        body = (head + "\n" + "\n\n".join(blocks) +
                "\n\nOnly stories with a clear direction are included — neutral ones are skipped.\n"
                "Details per story: https://pira-capital.vercel.app/news.html\n"
                "Automated by Pira Capital ETF Observatory — not financial advice.")
        watch = " · ".join(f"{t} {'▲' if net>0 else '▼' if net<0 else '•'}"
                           for t, _, net in targets[:3])
        subj = f"ETF watchlist: {watch} — clear-signal news"
        if check:
            print("WOULD SEND to", email, "|", subj, "|",
                  [(t, total_all[t]) for t, _, _ in targets], "| neutral skipped:", neutral_skipped)
        else:
            try:
                send_email(email, subj, body)
                for t, h in alerts.items():
                    for x in h[:12]:
                        sb.rest_post("alert_log", {"user_id": uid, "kind": "news",
                                                   "ticker": t, "title": x["title"][:200]})
                print("sent to", email, [(t, len(h)) for t, h in alerts.items()])
            except Exception as e:
                print("send failed for", email, e)
    print("DONE")


if __name__ == "__main__":
    main()
