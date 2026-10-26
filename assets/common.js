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

/* ---------- icon set (monochrome, stroke-based, colored via CSS) ---------- */
const SPRITE='<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">'
 +'<defs><g id="ic-s" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></g></defs>'
 +'<symbol id="ic-star" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3.4l2.6 5.2 5.8.9-4.2 4.1 1 5.8L12 16.7l-5.2 2.7 1-5.8L3.6 9.5l5.8-.9z"/></g></symbol>'
 +'<symbol id="ic-star-f" viewBox="0 0 24 24"><path d="M12 3.4l2.6 5.2 5.8.9-4.2 4.1 1 5.8L12 16.7l-5.2 2.7 1-5.8L3.6 9.5l5.8-.9z" fill="currentColor"/></symbol>'
 +'<symbol id="ic-bell" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9.5a6 6 0 0 1 12 0v4.2l1.8 2.8H4.2L6 13.7z"/><path d="M10 20a2.2 2.2 0 0 0 4 0"/></g></symbol>'
 +'<symbol id="ic-gauge" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 15.5a7.5 7.5 0 1 1 15 0"/><path d="M12 15.5l3.8-4.4"/><circle cx="12" cy="15.5" r="1.3" fill="currentColor" stroke="none"/><path d="M3.5 20h17"/></g></symbol>'
 +'<symbol id="ic-feed" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4.5" width="16" height="15" rx="2.5"/><path d="M7.5 9h5M7.5 12.5h9M7.5 16h9"/></g></symbol>'
 +'<symbol id="ic-globe" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c3.2 2.9 3.2 13.1 0 17-3.2-2.9-3.2-14.1 0-17z"/></g></symbol>'
 +'<symbol id="ic-alert" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4.5 21 19H3z"/><path d="M12 10v4"/><path d="M12 17h.01"/></g></symbol>'
 +'<symbol id="ic-search" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></g></symbol>'
 +'<symbol id="ic-bank" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5 12 4l8 5.5"/><path d="M5.5 10v7.5M10 10v7.5M14 10v7.5M18.5 10v7.5"/><path d="M3.5 20h17"/></g></symbol>'
 +'<symbol id="ic-up" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8"/><path d="M15.5 7H21v5.5"/></g></symbol>'
 +'<symbol id="ic-down" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7l6 6 4-4 8 8"/><path d="M15.5 17H21v-5.5"/></g></symbol>'
 +'<symbol id="ic-flat" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M8 12h8"/></g></symbol>'
 +'<symbol id="ic-user" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8.5" r="3.75"/><path d="M5 20a7 7 0 0 1 14 0"/></g></symbol>'
 +'<symbol id="ic-ext" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 5h5v5"/><path d="M19 5l-8.5 8.5"/><path d="M10.5 5.5H6.5A2.5 2.5 0 0 0 4 8v9.5A2.5 2.5 0 0 0 6.5 20H16a2.5 2.5 0 0 0 2.5-2.5v-4"/></g></symbol>'
 +'<symbol id="ic-redo" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 3.5v5h-5"/><path d="M20.5 12.5A8.5 8.5 0 1 1 14 4.2"/></g></symbol>'
 +'</svg>';
function ic(name){return '<svg class="ic" aria-hidden="true"><use href="#ic-'+name+'"></use></svg>';}

window.App={$,$$,universe,categories,fmt$,fmtPct,fmtN,pill,toast,debounce,num,getQuotes,getHistory,issuerFor,cnbcLink,nav,stamp,marketNote,ic};
try{document.body.insertAdjacentHTML("afterbegin",SPRITE);}catch(e){}
})();
