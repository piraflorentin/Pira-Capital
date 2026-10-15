"""Price-move alerts: every 30 min on weekdays, email users whose favorites
moved >= their threshold. Run: python3 scripts/send_alerts.py [--check]
Needs env: SUPABASE_URL, SUPABASE_SERVICE_KEY, SMTP_HOST/PORT/USER/PASS/FROM.
"""
import sys, time, datetime, urllib.request, urllib.parse
import sb
from mailer import send_email

UA = {"User-Agent": "Mozilla/5.0"}
BATCH = 50


def cnbc(syms):
    url = ("https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol?symbols="
           + urllib.parse.quote("|".join(syms)) +
           "&requestMethod=extended&noform=1&partnerId=2&fund=1&exthrs=1&output=json")
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=40) as r:
        import json
        j = json.load(r)
    return (j.get("FormattedQuoteResult") or {}).get("FormattedQuote") or []


def num(v):
    try:
        return float(str(v).replace("$", "").replace(",", "").replace("%", ""))
    except Exception:
        return None


def main():
    check = "--check" in sys.argv
    users = {u["id"]: u.get("email") for u in sb.admin_users() if u.get("email")}
    prefs = {p["user_id"]: p for p in sb.rest_get("alert_prefs")}
    states = {s["user_id"]: (s.get("state") or {}) for s in sb.rest_get("user_state", "user_id,state")}
    import json as _j
    favs_of = {}
    for uid, st in states.items():
        try:
            favs_of[uid] = _j.loads(st.get("pira-favs") or "[]")
        except Exception:
            favs_of[uid] = []
    tickers = sorted({t for favs in favs_of.values() for t in favs})
    quotes = {}
    for i in range(0, len(tickers), BATCH):
        try:
            for q in cnbc(tickers[i:i + BATCH]):
                p = num(q.get("change_pct"))
                last = num(q.get("last"))
                if p is None or last is None or q.get("code") != 0:
                    continue
                if q.get("countryCode") and q.get("countryCode") != "US":
                    continue
                quotes[q["symbol"]] = {"pct": p, "price": last,
                                       "name": q.get("name") or q["symbol"]}
        except Exception as e:
            print("batch failed:", e)
        time.sleep(1)
    today = datetime.date.today().isoformat()
    logged = {(l["user_id"], l.get("ticker", "")) for l in
              sb.rest_get("alert_log", "user_id,ticker",
                          f"kind=eq.price&created_at=gte.{today}")}
    sent = 0
    for uid, email in users.items():
        p = prefs.get(uid) or {}
        if not p.get("price_alerts", True):
            continue
        thr = float(p.get("min_move_pct") or 2.0)
        hits = []
        for t in favs_of.get(uid, []):
            q = quotes.get(t)
            if q and abs(q["pct"]) >= thr and (uid, t) not in logged:
                hits.append((t, q))
        if not hits:
            continue
        lines = [f"{t}  ${q['price']:.2f}  ({q['pct']:+.2f}%)  {q['name']}" for t, q in hits]
        body = ("Your watched ETFs moved a lot today:\n\n" + "\n".join(lines) +
                "\n\nLive board: https://pira-capital.vercel.app/\n"
                "Change alerts: open the site, log in, favorites card.\n"
                "Automated by Pira Capital ETF Observatory — not financial advice.")
        subj = f"ETF alert: {', '.join(t for t, _ in hits[:3])} moved {thr:g}%+"
        if check:
            print("WOULD SEND to", email, "->", lines)
        else:
            try:
                send_email(email, subj, body)
                for t, q in hits:
                    sb.rest_post("alert_log", {"user_id": uid, "kind": "price",
                                               "ticker": t, "title": f"{q['pct']:+.2f}%"})
                sent += 1
                print("sent to", email, [t for t, _ in hits])
            except Exception as e:
                print("send failed for", email, e)
    print(f"DONE would-send-or-sent={sent} users, quotes={len(quotes)}/{len(tickers)}")


if __name__ == "__main__":
    main()
