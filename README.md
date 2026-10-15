# Pira Capital — ETF Observatory

Personal portfolio site tracking the **500 largest US-listed ETFs**: live prices + daily
performance on the home page, a news page mapping headlines to ETFs, an ETF comparison
tool (1W / 1M / 1Y / 5Y) and a 3-scenario 12-month forecast page.

No build step, no API keys, no backend. Pure HTML/CSS/JS.

## Run locally

Browsers block `fetch()` of local files, so serve the folder (don't double-click the HTML):

```bash
cd website
python3 -m http.server 8000
# open http://localhost:8000
```

## How it stays updated every day

| What | Source | Refresh |
|---|---|---|
| Live price + day % (home, modals) | CNBC Quote API (free, CORS-enabled) | Every page visit + every 2 min while open |
| Live headlines (news page) | CNBC RSS (CORS-enabled) | Every visit, fallback to snapshot |
| 5-year history (compare/forecast) | Nasdaq Historical API snapshots in `data/history/` | `scripts/fetch_history.py`, daily via GitHub Action |
| Official Fed/ECB releases + per-ETF web scan | `data/news-daily.json` | `scripts/refresh_news.py`, daily via GitHub Action |

## Manual refresh

```bash
python3 scripts/fetch_history.py   # ~500 ETFs, takes ~10-15 min (polite pacing)
python3 scripts/refresh_news.py    # Fed + ECB + CNBC snapshot
```

## Deploy

Push to GitHub → Settings → Pages → Deploy from branch. The `Daily market-data
refresh` workflow (`.github/workflows/refresh.yml`) then rebuilds history + news every
weekday after the US close. No secrets needed.

## Sources (real & credible only)

- Quotes: CNBC Quote API · History: Nasdaq Historical API
- News: CNBC RSS, Federal Reserve press releases, ECB press, plus direct links to IMF, BIS, BLS, SEC EDGAR
- Fund facts: issuer factsheets (linked per fund)

Educational project — not financial advice.
