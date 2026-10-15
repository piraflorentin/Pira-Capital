/* Shared helpers: universe, live quotes (CNBC), formatting, nav, footer. */
(function(){
"use strict";
const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));

/* ---------- universe ---------- */
function universe(){
  if(window.ETF_UNIVERSE) return window.ETF_UNIVERSE.map(e=>({t:e[0],n:e[1],c:e[2],d:e[3]||""}));
  return [];
}
function categories(){
  const s={}; universe().forEach(e=>{s[e.c]=(s[e.c]||0)+1});
  return Object.keys(s).sort();
}

/* ---------- formatting ---------- */
const fmt$=v=>v==null||isNaN(v)?"—":"$"+Number(v).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtPct=v=>v==null||isNaN(v)?"—":(v>0?"+":"")+Number(v).toFixed(2)+"%";
const fmtN=v=>v==null||isNaN(v)?"—":Number(v).toLocaleString("en-US");
function pill(pct){
  if(pct==null||isNaN(pct)) return '<span class="pill flat">—</span>';
  const c=pct>0?"up":(pct<0?"down":"flat");
  return `<span class="pill ${c}">${fmtPct(pct)}</span>`;
}
function toast(msg){const t=$("#toast");if(!t)return;t.textContent=msg;t.style.display="block";clearTimeout(t._h);t._h=setTimeout(()=>t.style.display="none",3200);}
function debounce(fn,ms){let h;return(...a)=>{clearTimeout(h);h=setTimeout(()=>fn(...a),ms);};}
const num=v=>{if(v==null)return NaN;const x=parseFloat(String(v).replace(/[$,%]/g,""));return isNaN(x)?NaN:x;};

/* ---------- live quotes (CNBC, CORS-enabled, no key) ---------- */
const QCACHE={data:{},ts:{}};
const BATCH=50, TTL=90*1000;
async function fetchBatch(syms){
  const url="https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol?symbols="
    +encodeURIComponent(syms.join("|"))+"&requestMethod=extended&noform=1&partnerId=2&fund=1&exthrs=1&output=json";
  const r=await fetch(url); if(!r.ok) throw new Error("quote HTTP "+r.status);
  const j=await r.json(); return (j.FormattedQuoteResult&&j.FormattedQuoteResult.FormattedQuote)||[];
}
async function getQuotes(tickers){
  const now=Date.now(), need=[...new Set(tickers)].filter(t=>!(t in QCACHE.data)||now-QCACHE.ts[t]>TTL);
  for(let round=0;round<2;round++){
    const missing=need.filter(t=>!(t in QCACHE.data));
    if(!missing.length)break;
    if(round===1)await new Promise(r=>setTimeout(r,1500));
    for(let i=0;i<missing.length;i+=BATCH){
      const chunk=missing.slice(i,i+BATCH);
      try{
        const rows=await fetchBatch(chunk);
        rows.forEach(q=>{
        const last=num(q.last);
        if(isNaN(last)) return;
        if(q.code!==0||(q.countryCode&&q.countryCode!=="US")) return; // US listings only
        QCACHE.data[q.symbol]={price:last,chg:num(q.change),pct:num(q.change_pct),
          prev:num(q.previous_day_closing),open:num(q.open),high:num(q.high),low:num(q.low),
          vol:q.volume||"",volAlt:q.volume_alt||"",mcap:q.mktcapView||"",divy:q.dividendyield||"",
          yhi:num(q.yrhiprice),ylo:num(q.yrloprice),yhiD:q.yrhidate||"",yloD:q.yrlodate||"",
          name:q.name||"",exch:q.exchange||"",asof:q.last_timedate||"",div:num(q.dividend)};
        QCACHE.ts[q.symbol]=Date.now();
      });
    }catch(e){ console.warn("quote batch failed", e); }
    }
  }
  const out={}; tickers.forEach(t=>{out[t]=QCACHE.data[t]||null;});
  return out;
}

/* ---------- issuer links (roots only — always safe) ---------- */
const ISSUERS=[["iShares","https://www.ishares.com"],["Vanguard","https://investor.vanguard.com"],["SPDR","https://www.ssga.com"],["Schwab","https://www.schwabassetmanagement.com"],["Invesco","https://www.invesco.com"],["Global X","https://www.globalxetfs.com"],["VanEck","https://www.vaneck.com"],["WisdomTree","https://www.wisdomtree.com"],["ARK ","https://www.ark-funds.com"],["Direxion","https://www.direxion.com"],["ProShares","https://www.proshares.com"],["First Trust","https://www.ftportfolios.com"],["Fidelity","https://www.fidelity.com"],["JPMorgan","https://am.jpmorgan.com"],["Franklin","https://www.franklintempleton.com"],["ALPS","https://www.alpsfunds.com"],["PIMCO","https://www.pimco.com"],["Janus Henderson","https://www.janushenderson.com"],["Avantis","https://www.avantisinvestors.com"],["Dimensional","https://www.dimensional.com"],["Goldman Sachs","https://www.goldmansachs.com"],["FlexShares","https://www.flexshares.com"],["Xtrackers","https://www.xtrackers.com"],["Teucrium","https://www.teucrium.com"],["KraneShares","https://www.kraneshares.com"],["Roundhill","https://www.roundhillinvestments.com"],["Simplify","https://www.simplify.us"],["Amplify","https://www.amplifyetfs.com"],["Alpha Architect","https://www.alphaarchitect.com"],["Pacer","https://www.paceretfs.com"],["Sprott","https://www.sprott.com"],["Grayscale","https://www.grayscale.com"],["Hoya","https://www.hoyacapital.com"]];
function issuerFor(name){name=name||"";for(const[k,u]of ISSUERS){if(name.indexOf(k)===0||name.indexOf(" "+k+" ")>0||name.startsWith(k))return u;}return "";}
const cnbcLink=t=>"https://www.cnbc.com/quotes/"+t;

/* ---------- history snapshots (refreshed daily by scheduled job) ---------- */
async function getHistory(t){
  const r=await fetch("data/history/"+t+".json",{cache:"no-store"});
  if(!r.ok) throw new Error("no history for "+t);
  return await r.json();
}

/* ---------- chrome ---------- */
function nav(active){
  $$("nav.main a").forEach(a=>{if(a.dataset.p===active)a.classList.add("active");});
  const y=$("#yr"); if(y)y.textContent=new Date().getFullYear();
}
function stamp(id,txt){const e=$(id);if(e)e.textContent=txt;}
function marketNote(){
  const n=new Date(), d=n.getDay(), m=n.getHours()*60+n.getMinutes()-240; // mins since 9:30 ET approx (UTC-4)
  const open=d>0&&d<6&&m>=0&&m<=390;
  return open?"US market open — quotes live":"US market closed — showing last close";
}

window.App={$,$$,universe,categories,fmt$,fmtPct,fmtN,pill,toast,debounce,num,getQuotes,getHistory,issuerFor,cnbcLink,nav,stamp,marketNote};
})();
