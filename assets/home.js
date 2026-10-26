/* Home page: live 500-ETF board. */
(function(){
"use strict";
const {$,universe,categories,fmt$,fmtPct,pill,num,getQuotes,issuerFor,cnbcLink,nav,toast,debounce}=App;
nav("home");
const PER=50;
const S={page:0,q:"",cat:"",dir:"",sort:"pct",list:universe(),quotes:{},allLoaded:false,
  favs:new Set(JSON.parse(localStorage.getItem("pira-favs")||"[]"))};
function saveFavs(){try{localStorage.setItem("pira-favs",JSON.stringify([...S.favs]));}catch(e){}}
function starBtn(t){const on=S.favs.has(t);
  return `<button data-fav="${t}" class="favb ${on?"on":""}" title="${on?"Remove from":"Add to"} favorites"><svg class="ic" aria-hidden="true"><use href="#${on?"ic-star-f":"ic-star"}"></use></svg></button>`;}

function mcapNum(s){ if(!s)return NaN; const m=String(s).replace(/,/g,"").match(/([\d.]+)\s*([TBMK]?)/i); if(!m)return NaN;
  const f={T:1e12,B:1e9,M:1e6,K:1e3,"":1}; return parseFloat(m[1])*(f[(m[2]||"").toUpperCase()]||1); }
function initials(t){ return t.length<=4?t:t.slice(0,2)+t.slice(-1); }

function filtered(){
  let L=S.list;
  if(S.q){const q=S.q.toLowerCase(); L=L.filter(e=>e.t.toLowerCase().includes(q)||e.n.toLowerCase().includes(q)||e.c.toLowerCase().includes(q));}
  if(S.cat)L=L.filter(e=>e.c===S.cat);
  if(S.dir){L=L.filter(e=>{const p=(S.quotes[e.t]||{}).pct;return p!=null&&!isNaN(p)&&(S.dir==="up"?p>0:p<0);});}
  const getP=e=>{const q=S.quotes[e.t];return (q&&q.pct!=null&&!isNaN(q.pct))?q.pct:null;};
  const getPr=e=>{const q=S.quotes[e.t];return (q&&q.price!=null&&!isNaN(q.price))?q.price:null;};
  const key={pct:e=>{const v=getP(e);return v==null?-1e9:v;},pctAsc:e=>{const v=getP(e);return v==null?1e9:v;},
    price:e=>{const v=getPr(e);return v==null?-1e9:v;},mcap:e=>mcapNum((S.quotes[e.t]||{}).mcap),name:e=>e.n}[S.sort];
  const asc=S.sort==="pctAsc"||S.sort==="name";
  return [...L].sort((a,b)=>{const x=key(a),y=key(b);
    if(typeof x==="string")return asc?x.localeCompare(y):y.localeCompare(x);
    const X=isNaN(x)?(asc?1e18:-1e18):x,Y=isNaN(y)?(asc?1e18:-1e18):y;return asc?X-Y:Y-X;});
}

async function render(){
  const L=filtered(), pages=Math.max(1,Math.ceil(L.length/PER));
  S.page=Math.min(S.page,pages-1);
  const slice=L.slice(S.page*PER,S.page*PER+PER);
  $("#pg").textContent=`Page ${S.page+1} of ${pages} · ${L.length} ETFs`;
  const tb=$("#rows");
  tb.innerHTML=`<tr><td colspan="9" class="muted">Loading live quotes for this page…</td></tr>`;
  Object.assign(S.quotes,await getQuotes(slice.map(e=>e.t)));
  tb.innerHTML=slice.map((e,i)=>{
    const q=S.quotes[e.t]||{}, p=q.pct, up=p>0, dn=p<0;
    return `<tr data-t="${e.t}" style="cursor:pointer">
      <td class="l">${starBtn(e.t)}</td>
      <td class="l muted">${S.page*PER+i+1}</td>
      <td class="l"><div class="etfcell"><div class="avatar">${initials(e.t)}</div><div><b>${e.n}</b><span>${e.t} · ${e.c}${q.exch?" · "+q.exch:""}</span></div></div></td>
      <td class="num">${fmt$(q.price)}</td>
      <td class="num ${up?"pos":dn?"neg":""}">${q.chg==null||isNaN(q.chg)?"—":(q.chg>0?"+":"")+q.chg.toFixed(2)}</td>
      <td>${pill(p)}</td>
      <td class="num">${q.mcap||"—"}</td>
      <td class="num">${q.divy||"—"}</td>
      <td class="l"><button class="btn ghost" data-info="${e.t}">Profile</button></td></tr>`;
  }).join("")||`<tr><td colspan="9" class="muted">No ETFs match your filters.</td></tr>`;
  tb.querySelectorAll("tr[data-t]").forEach(tr=>tr.addEventListener("click",ev=>{openModal(tr.dataset.t);}));
  tb.querySelectorAll("[data-fav]").forEach(b=>b.addEventListener("click",ev=>{ev.stopPropagation();toggleFav(b.dataset.fav);}));
  $("#stamp").textContent=" · Updated "+new Date().toLocaleTimeString()+" · "+App.marketNote();
  renderFavs();
}

function toggleFav(t){
  S.favs.has(t)?S.favs.delete(t):S.favs.add(t);
  saveFavs(); if(window.AuthSync)AuthSync.push(); render();
  toast(S.favs.has(t)?t+" added to favorites.":t+" removed from favorites.");
}

async function renderFavs(){
  const card=$("#favcard"), tb=$("#favrows");
  if(!S.favs.size){card.style.display="none";return;}
  card.style.display="block";
  const list=[...S.favs].map(t=>universe().find(e=>e.t===t)).filter(Boolean);
  Object.assign(S.quotes,await getQuotes(list.map(e=>e.t)));
  tb.innerHTML=list.map(e=>{
    const q=S.quotes[e.t]||{}, p=q.pct, up=p>0, dn=p<0;
    return `<tr data-t="${e.t}" style="cursor:pointer">
      <td class="l"><div class="etfcell"><div class="avatar">${initials(e.t)}</div><div><b>${e.n}</b><span>${e.t} · ${e.c}</span></div></div></td>
      <td class="num">${fmt$(q.price)}</td>
      <td class="num ${up?"pos":dn?"neg":""}">${q.chg==null||isNaN(q.chg)?"—":(q.chg>0?"+":"")+q.chg.toFixed(2)}</td>
      <td>${pill(p)}</td>
      <td class="num">${q.mcap||"—"}</td>
      <td class="l"><button class="btn ghost" data-unfav="${e.t}">✕ Remove</button></td></tr>`;
  }).join("");
  tb.querySelectorAll("tr[data-t]").forEach(tr=>tr.addEventListener("click",()=>openModal(tr.dataset.t)));
  tb.querySelectorAll("[data-unfav]").forEach(b=>b.addEventListener("click",ev=>{ev.stopPropagation();toggleFav(b.dataset.unfav);}));
  renderAlertBox();
}

async function renderAlertBox(){
  const box=$("#alertbox"); if(!box)return;
  const A=window.AuthSync;
  if(!A||!A.enabled||!A.user){
    box.innerHTML=`<p class="small muted">${App.ic("bell")} <b>Email alerts are coming:</b> log in to get notified when a favorite moves a lot or makes the news.</p>`;
    return;
  }
  let p={min_move_pct:2,price_alerts:true,news_alerts:true};
  try{
    const r=await A.client.from("alert_prefs").select("*").eq("user_id",A.user.id).maybeSingle();
    if(r.data)p=Object.assign(p,r.data);
  }catch(e){}
  box.innerHTML=`<div class="controls" style="margin-top:0">
      <span class="small"><b>${App.ic("bell")} Email alerts to ${A.user.email}:</b></span>
      <label class="small">Big move <select id="apct">
        ${[1,2,3,5].map(v=>`<option value="${v}"${+p.min_move_pct===v?" selected":""}>±${v}%</option>`).join("")}
      </select></label>
      <label class="small"><input type="checkbox" id="aprice"${p.price_alerts?" checked":""}> price moves</label>
      <label class="small"><input type="checkbox" id="anews"${p.news_alerts?" checked":""}> news on my funds</label>
    </div>`;
  const save=async()=>{
    try{await A.client.from("alert_prefs").upsert({user_id:A.user.id,
      min_move_pct:+$("#apct").value,price_alerts:$("#aprice").checked,news_alerts:$("#anews").checked});}catch(e){}
  };
  $("#apct").onchange=save; $("#aprice").onchange=save; $("#anews").onchange=save;
}

function aboutText(e){
  if(e.d)return e.d;
  const C={"US Large Cap":"Large-cap US stocks.","US Mid Cap":"Mid-cap US stocks.","US Small Cap":"Small-cap US stocks.","US Total Market":"The whole US stock market in one fund.","Nasdaq 100":"The 100 largest non-financial Nasdaq stocks.","Growth":"US growth stocks.","Value":"US value stocks.","Dividend":"Dividend-paying stocks.","Equal Weight":"Same index, equal weight per stock.","Covered Call":"Stock exposure plus options income.","Tech":"Technology stocks.","Financials":"Financial stocks.","Health Care":"Health-care stocks.","Energy":"Energy stocks.","Industrials":"Industrial stocks.","Staples":"Consumer staples stocks.","Discretionary":"Consumer discretionary stocks.","Utilities":"Utility stocks.","Communication":"Communication services stocks.","Materials":"Materials stocks.","Banks":"Bank stocks.","Biotech":"Biotechnology stocks.","Semiconductors":"Semiconductor stocks.","AI & Robotics":"Robotics and AI companies.","Cybersecurity":"Cybersecurity companies.","Cloud":"Cloud computing companies.","Fintech":"Financial technology companies.","Genomics":"Genomics and biotech firms.","Thematic AI":"Disruptive innovation theme.","Gaming & Esports":"Video games and esports.","Sports Betting":"Sports betting and iGaming.","EV & Mobility":"Electric and autonomous vehicles.","Clean Energy":"Clean energy companies.","Solar":"Solar energy companies.","Wind":"Wind energy companies.","Lithium & Batteries":"Lithium and battery makers.","Uranium":"Uranium miners.","Gold":"Gold price exposure.","Silver":"Silver price exposure.","Platinum":"Platinum price exposure.","Palladium":"Palladium price exposure.","Gold Miners":"Gold mining companies.","Copper":"Copper price exposure.","Oil":"Crude oil price exposure.","Natural Gas":"Natural gas price exposure.","Broad Commodity":"Basket of commodities.","Agriculture":"Agricultural commodities.","Metals & Mining":"Metals and mining companies.","Oil & Gas E&P":"Oil and gas producers.","Aerospace & Defense":"Aerospace and defence firms.","Homebuilders":"Homebuilder stocks.","Retail":"Retail stocks.","US REIT":"US real-estate investment trusts.","Global REIT":"Global REITs.","Housing":"Housing market theme.","Infrastructure":"Infrastructure companies.","Water":"Water industry companies.","Aggregate Bond":"Broad investment-grade bonds.","Treasury Short":"Short-term US Treasuries.","Treasury Intermediate":"Mid-term US Treasuries.","Treasury Long":"Long-term US Treasuries.","TIPS":"Inflation-protected Treasuries.","Floating Rate":"Floating-rate notes.","Ultra-Short":"Ultra-short bonds and bills.","IG Corporate":"Investment-grade corporate bonds.","High Yield":"High-yield corporate bonds.","Bank Loan":"Senior secured loans.","Municipal":"Tax-exempt municipal bonds.","Muni High Yield":"High-yield municipal bonds.","Preferred":"Preferred securities.","Convertible":"Convertible bonds.","MBS":"Mortgage-backed securities.","Active Bond":"Actively managed bonds.","International Bond":"Non-US bonds.","EM Bond":"Emerging-market bonds.","Developed ex-US":"Developed markets outside the US.","Europe":"European stocks.","Eurozone":"Eurozone stocks.","United Kingdom":"UK stocks.","Germany":"German stocks.","Italy":"Italian stocks.","Spain":"Spanish stocks.","Sweden":"Swedish stocks.","Switzerland":"Swiss stocks.","Japan":"Japanese stocks.","Korea":"South Korean stocks.","Taiwan":"Taiwanese stocks.","Hong Kong":"Hong Kong stocks.","Australia":"Australian stocks.","Indonesia":"Indonesian stocks.","Philippines":"Philippine stocks.","China":"Chinese stocks.","India":"Indian stocks.","Brazil":"Brazilian stocks.","Chile":"Chilean stocks.","Peru":"Peruvian stocks.","Mexico":"Mexican stocks.","Canada":"Canadian stocks.","Argentina":"Argentine stocks.","Greece":"Greek stocks.","Emerging Markets":"Emerging-market stocks.","EM Small Cap":"Emerging-market small caps.","Intl Small Cap":"Non-US small caps.","Intl Dividend":"Non-US dividend stocks.","Factors":"Factor-tilted stocks.","Leveraged Bull":"Leveraged daily long exposure — resets daily.","Inverse Bear":"Inverse/leveraged daily short exposure — resets daily.","Volatility":"Volatility futures exposure.","Currency":"Currency exposure.","Crypto & Blockchain":"Crypto-linked exposure.","Managed Futures":"Managed-futures trend strategy.","Multi-Asset":"Mixed asset allocation.","Space":"Space industry companies."};
  return (C[e.c]||"Exchange-traded fund.")+" Live price loads automatically; see issuer factsheet for full details.";
}

function openModal(t){
  const e=S.list.find(x=>x.t===t)||universe().find(x=>x.t===t); if(!e)return;
  const q=S.quotes[t]||{}, nm=(q.name||e.n), iss=App.issuerFor(nm);
  $("#mbody").innerHTML=`<div class="etfcell"><div class="avatar" style="width:44px;height:44px">${initials(e.t)}</div>
    <div><b style="font-size:1.15rem">${nm}</b><br><span>${e.t} · ${e.c}${q.exch?" · "+q.exch:""}</span></div></div>
    <p style="margin:12px 0">${aboutText(e)}</p>
    <div style="display:flex;gap:14px;align-items:baseline"><span style="font-size:1.7rem;font-weight:800">${fmt$(q.price)}</span>${pill(q.pct)}
    <span class="small muted">${q.asof?("as of "+q.asof):""}</span></div>
    <div class="kv">
      <div><small>Day change</small><b class="${q.chg>0?"pos":q.chg<0?"neg":""}">${q.chg==null||isNaN(q.chg)?"—":(q.chg>0?"+":"")+q.chg.toFixed(2)+" ("+fmtPct(q.pct)+")"}</b></div>
      <div><small>Previous close</small><b>${fmt$(q.prev)}</b></div>
      <div><small>Volume</small><b>${q.vol||"—"}</b></div>
      <div><small>Market cap</small><b>${q.mcap||"—"}</b></div>
      <div><small>52-week range</small><b>${q.ylo!=null&&!isNaN(q.ylo)?("$"+q.ylo.toFixed(2)+" – $"+q.yhi.toFixed(2)):"—"}</b></div>
      <div><small>Dividend yield</small><b>${q.divy||"—"}</b></div>
      <div><small>Risk class (SRI 1–7)</small><b data-risk="sri">…</b></div>
      <div><small>Volatility (ann.)</small><b data-risk="vol">…</b></div>
    </div>
    <p><a class="btn" href="${cnbcLink(e.t)}" target="_blank" rel="noopener">${App.ic("ext")} Live quote on CNBC</a>
    ${iss?` <a class="btn ghost" href="${iss}" target="_blank" rel="noopener">${App.ic("ext")} Issuer factsheet</a>`:""}
    <button class="btn ghost" id="mfav">${App.ic(S.favs.has(e.t)?"star-f":"star")} ${S.favs.has(e.t)?"Favorited":"Add to favorites"}</button></p>
    <p class="small muted">Price return shown. Distributions/dividends are not included in day %. Figures stream live from market data; history powers the <a href="compare.html">Compare</a> and <a href="forecast.html">Forecast</a> pages.</p>`;
  $("#modal").classList.add("open");
  $("#mfav").addEventListener("click",()=>{toggleFav(t);openModal(t);});
  fillRisk(t);
}

async function fillRisk(t){
  try{
    const h=await App.getHistory(t), rows=h.rows;
    if(!rows||rows.length<60)return;
    const c=rows.map(r=>parseFloat(r[1]));
    const w=[]; for(let i=5;i<c.length;i+=5)w.push(Math.log(c[i]/c[i-5])); // weekly returns
    const m=w.reduce((a,b)=>a+b,0)/w.length;
    const sd=Math.sqrt(w.reduce((a,b)=>a+(b-m)*(b-m),0)/(w.length-1));
    const vol=sd*Math.sqrt(52)*100; // annualized %
    const sri=vol<0.5?1:vol<5?2:vol<12?3:vol<20?4:vol<30?5:vol<80?6:7;
    const sriEl=document.querySelector('[data-risk="sri"]'), volEl=document.querySelector('[data-risk="vol"]');
    if(sriEl)sriEl.innerHTML=`${sri} / 7 <span class="small muted" title="Approximation of the EU SRI scale from 5y price volatility. The official figure is in the issuer KIID.">≈</span>`;
    if(volEl)volEl.textContent="≈ "+vol.toFixed(1)+"% / yr";
  }catch(e){ /* history unavailable — placeholders stay */ }
}

async function hero(){
  const q=await getQuotes(["SPY","QQQ","TLT","GLD"]);
  const set=(id,v,s)=>{const pct=q[id]&&q[id].pct;
    $("#k-"+v).innerHTML=q[id]?`${fmt$(q[id].price)} <span class="${pct>0?"pos":pct<0?"neg":""}" style="font-size:.9rem">${fmtPct(pct)}</span>`:"—";
    $("#k-"+v+"-s").textContent=q[id]?("as of "+(q[id].asof||"last close")):"unavailable";};
  set("SPY","spy");set("QQQ","qqq");set("TLT","tlt");set("GLD","gld");
  $("#status").textContent="Live market data connected — "+App.marketNote()+".";
  // breadth in background: fetch everything, count advancers/decliners
  (async()=>{
    const all=universe().map(e=>e.t), have=new Set(Object.keys(S.quotes));
    const rest=all.filter(t=>!have.has(t));
    let adv=0,dec=0,n=0;
    for(let i=0;i<rest.length;i+=50){
      const r=await getQuotes(rest.slice(i,i+50)); Object.assign(S.quotes,r);
      Object.values(r).forEach(v=>{if(v&&!isNaN(v.pct)){n++;v.pct>0?adv++:v.pct<0?dec++:0;}});
      $("#k-br").textContent=`${adv} ▲ / ${dec} ▼`;
      $("#k-br-s").textContent=`of ${n} ETFs with live data`;
    }
    S.allLoaded=true;
    if(S.dir)render();
  })();
}

function init(){
  const cats=categories();
  $("#cat").innerHTML='<option value="">All categories</option>'+cats.map(c=>`<option>${c}</option>`).join("");
  $("#q").addEventListener("input",debounce(e=>{S.q=e.target.value.trim();S.page=0;render();},250));
  $("#cat").addEventListener("change",e=>{S.cat=e.target.value;S.page=0;render();});
  $("#dir").addEventListener("change",e=>{S.dir=e.target.value;S.page=0;render();});
  $("#sort").addEventListener("change",e=>{S.sort=e.target.value;S.page=0;render();});
  $("#prev").addEventListener("click",()=>{if(S.page>0){S.page--;render();}});
  $("#next").addEventListener("click",()=>{S.page++;render();});
  $("#mx").addEventListener("click",()=>$("#modal").classList.remove("open"));
  $("#modal").addEventListener("click",e=>{if(e.target.id==="modal")$("#modal").classList.remove("open");});
  render(); hero();
  document.addEventListener("auth-ready",()=>{ // cloud favorites arrived
    try{S.favs=new Set(JSON.parse(localStorage.getItem("pira-favs")||"[]"));}catch(e){}
    render();
  });
  setInterval(async()=>{ // refresh current page every 30s while visible
    if(document.hidden)return;
    Object.keys(S.quotes).forEach(k=>delete S.quotes[k]); await render();
  },30000);
}
document.readyState==="loading"?document.addEventListener("DOMContentLoaded",init):init();
})();
