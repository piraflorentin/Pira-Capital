/* News page: live CNBC headlines + baked Fed/ECB snapshots, impact-tagged. */
(function(){
"use strict";
const {$,nav,toast}=App; nav("news");
let LIVE_ITEMS=[];

const RULES=[
 {k:["federal reserve","fed ","fomc","powell","rate cut","rate hike","interest rate","inflation","cpi ","cpi(","ppi ","wholesale prices","consumer prices","pce ","disinflation","hawkish","dovish","lisa cook","discount rate"],label:"Rates & inflation",tick:["TLT","IEF","SHY","AGG","BND","TIP","XLF","XLRE","QQQ"],why:"Rate expectations reprice bonds first (long duration like TLT moves most), then growth stocks, banks and REITs."},
 {k:["treasury","yields","yield","bond market","deficit","national debt","t-bill","auction"],label:"Bonds & yields",tick:["TLT","IEF","SHY","LQD","HYG","SGOV"],why:"Supply and demand for US debt sets yields; when yields rise, existing bond ETF prices fall."},
 {k:["oil","crude","opec","gasoline","shale","refiner","rig count","lng ","natural gas"],label:"Energy",tick:["XLE","VDE","USO","XOP","UNG"],why:"Crude and gas prices feed directly into energy-producer ETFs and futures-based funds like USO/UNG."},
 {k:["nvidia","tsmc","semiconductor","chip ","chips ","broadcom","asml","artificial intelligence"," ai ","ai boom","openai","datacenter","data center","cloud","qqq","nasdaq"],label:"Tech & semis",tick:["SOXX","SMH","XLK","VGT","QQQ","BOTZ"],why:"AI capex headlines reprice chipmakers and cloud first, then the whole Nasdaq-100 via QQQ."},
 {k:["bank ","banks","lending","credit suisse","deposit","regional bank","loan loss","foreclosure","mortgage"],label:"Financials & housing",tick:["XLF","KRE","KBE","XHB","VNQ"],why:"Credit stress hits banks; mortgage rates move homebuilders (XHB) and REITs (VNQ)."},
 {k:["china","beijing","xi jinping","tariff","trade war","tiktok","huawei","alibaba"],label:"China & trade",tick:["FXI","MCHI","KWEB","EEM","IEMG"],why:"Tariffs and Chinese regulation reprice China ETFs (FXI, KWEB) and spill into broad EM."},
 {k:["ecb","lagarde","euro","europe","germany","france"],label:"Europe",tick:["VGK","EZU","EWG","EWU","FXE"],why:"ECB decisions and European growth data move eurozone ETFs and the euro."},
 {k:["japan","yen","bank of japan","nikkei"],label:"Japan",tick:["EWJ","DXJ","FXY"],why:"BoJ policy and yen moves drive hedged (DXJ) and unhedged (EWJ) Japan exposure."},
 {k:["gold","safe haven","central bank buy","bullion","silver"],label:"Gold & safety",tick:["GLD","IAU","GDX","SLV"],why:"Fear and real-yield falls push investors toward gold (GLD) and miners (GDX)."},
 {k:["bitcoin","crypto","ethereum","coinbase","binance","sec bitcoin","etf bitcoin"],label:"Crypto-linked",tick:["IBIT","FBTC","GBTC","BITO","BLOK"],why:"Regulation and adoption news swings spot-bitcoin ETFs and crypto-equity funds."},
 {k:["jobs","unemployment","payrolls","gdp","recession","retail sales","consumer","ism ","pmi ","layoff","russell","dow jones","s&p"],label:"Growth & consumer",tick:["SPY","VOO","DIA","IWM","XLY"],why:"Growth surprises move the broad market (SPY) and cyclicals first; small caps (IWM) amplify."},
 {k:["war ","missile","strike","ceasefire","sanction","taiwan strait","iran","ukraine","gaza","defense spend","pentagon"],label:"Geopolitics & defence",tick:["GLD","USO","ITA","PPA","SHV"],why:"Escalation lifts oil, gold and defence contractors while cash-like SHV cushions."},
 {k:["housing","home price","rent ","eviction"],label:"Housing",tick:["XHB","VNQ","ITB"],why:"Prices and starts feed homebuilders and residential REITs."},
 {k:["drug","fda","vaccine","obesity drug","medicare","hospital"],label:"Health care",tick:["XLV","XBI","IBB"],why:"Approvals and pricing policy swing pharma and biotech ETFs."},
 {k:["dollar","dxy","currency","forex","devaluation"],label:"Dollar",tick:["UUP","GLD","EEM","FXE"],why:"A strong dollar typically pressures gold, EM equities and foreign-currency ETFs."},
 {k:["india","mexico","brazil","emerging market","latin america"],label:"Emerging markets",tick:["EEM","VWO","INDA","EWZ","EWW"],why:"Country-specific politics and commodities swing single-country EM ETFs."},
 {k:["earnings","profit beat","record profit","guidance","wall street","s&p"],label:"Earnings",tick:["SPY","QQQ","XLC","XLY"],why:"Big-tech earnings steer QQQ and communication/discretionary sectors, then the broad index."}
];
function impacts(title,desc){
  const t=((title||"")+" "+(desc||"")).toLowerCase(), out=[];
  RULES.forEach(r=>{ if(r.k.some(k=>t.includes(k))) out.push(r); });
  return out.slice(0,3);
}
function storyHTML(s){
  const im=impacts(s.title,s.desc);
  const tags=im.length?im.map(r=>`<span class="pill info">${r.label}</span>`).join(" "):'<span class="pill flat">general market</span>';
  const tick=im.length?`<div class="tags">${im[0].tick.map(t=>`<span class="pill">${t}</span>`).join("")}</div>
    <p class="small muted" style="margin:6px 0 0"><b>Why:</b> ${im[0].why}</p>`:"";
  return `<div class="story"><h3><a href="${s.link}" target="_blank" rel="noopener">${s.title}</a></h3>
    <div class="meta">${s.date||""} · ${tags}</div>${s.desc?`<p class="small muted">${s.desc.slice(0,260)}</p>`:""}${tick}</div>`;
}

async function live(){
  const box=$("#live");
  try{
    const r=await fetch("https://www.cnbc.com/id/100003114/device/rss/rss.html");
    if(!r.ok)throw new Error(r.status);
    const xml=new DOMParser().parseFromString(await r.text(),"text/xml");
    const items=Array.from(xml.querySelectorAll("item")).slice(0,45).map(it=>({
      title:(it.querySelector("title")||{}).textContent||"",
      link:(it.querySelector("link")||{}).textContent||"",
      date:(it.querySelector("pubDate")||{}).textContent||"",
      desc:((it.querySelector("description")||{}).textContent||"").replace(/<[^>]+>/g,"").slice(0,300)}));
    // feed order = CNBC's own ranking: never reorder.
    // Keep a deep pool (up to 40) for the "News for my ETF" filter; show top 14 by default.
    LIVE_ITEMS=items.slice(0,40);
    box.innerHTML=LIVE_ITEMS.slice(0,14).map(storyHTML).join("")||"<p class='muted'>No headlines right now.</p>";
    restorePick();
  }catch(e){
    // fall back to baked snapshot
    try{
      const j=await (await fetch("data/news-daily.json",{cache:"no-store"})).json();
      box.innerHTML="<p class='small muted'>Live feed unreachable — showing this morning's snapshot (CNBC):</p>"+(j.sources.cnbc||[]).map(storyHTML).join("");
    }catch(e2){ box.innerHTML="<p class='muted'>Headlines unavailable. See primary sources below.</p>"; }
  }
}
async function baked(){
  try{
    const j=await (await fetch("data/news-daily.json",{cache:"no-store"})).json();
    $("#news-stamp").textContent="Official snapshots: "+j.asof+".";
    const f=j.sources.fed||[], e=j.sources.ecb||[];
    $("#fed").innerHTML=f.map(s=>`<div class="story"><h3><a href="${s.link}" target="_blank" rel="noopener">${s.title}</a></h3><div class="meta">${s.date||""} · <span class="pill info">Rates & inflation</span></div><div class="tags">${["TLT","IEF","AGG","XLF"].map(t=>`<span class="pill">${t}</span>`).join("")}</div></div>`).join("")||"<p class='muted'>—</p>";
    $("#ecb").innerHTML=e.map(s=>`<div class="story"><h3><a href="${s.link}" target="_blank" rel="noopener">${s.title}</a></h3><div class="meta">${s.date||""} · <span class="pill info">Europe</span></div><div class="tags">${["VGK","EZU","FXE"].map(t=>`<span class="pill">${t}</span>`).join("")}</div></div>`).join("")||"<p class='muted'>—</p>";
  }catch(e){ $("#fed").innerHTML=$("#ecb").innerHTML="<p class='muted'>Snapshot unavailable.</p>"; }
}
const GEN_UP=["beat","record","surge","rally","jump","soar","approv","deal","stimulus","dovish","rate cut","breakthrough","upgrade","rebound","optimism","win","cleared","backing","ceasefire","resumes"];
const GEN_DN=["miss","plunge","tumble","sell-off","selloff","rout","slump","fear","warning","ban","tariff","probe","lawsuit","downgrade","crash","falls","fall ","drop","slide","hike","hot ","fraud","default","recall","layoff","strike","war ","attack","threat","probe"];
function toneOf(title,rule){
  const t=(title||"").toLowerCase();
  const src=(rule&&DIRS[rule.label])||rule||{};
  const U=src.up||GEN_UP, D=src.down||GEN_DN;
  const u=U.some(k=>t.indexOf(k)>=0), d=D.some(k=>t.indexOf(k)>=0);
  return u&&!d?1:(d&&!u?-1:0);
}
const DIRS={
 "Rates & inflation":{up:["rate cut","cuts rates","dovish","pause","cooling","cools","soft landing"],down:["rate hike","hikes","hawkish","hot","sticky","deficit","downgrade"]},
 "Bonds & yields":{up:["rate cut","dovish","flee to safety","flight to safety","yields slide","yields fall","yields drop","cooling","slowdown"],down:["rate hike","hawkish","yields jump","yields rise","yields climb","auction","deficit","hot"]},
 "Energy":{up:["surge","jump","soar","sanction","embargo","strike","opec cut","disruption"],down:["plunge","slump","glut","oversupply","inventory","slowdown","record output"]},
 "Tech & semis":{up:["beat","record","boom","breakthrough","deal","approv","raises","upgrade","demand"],down:["miss","sell-off","selloff","rout","ban","probe","slump","warning","layoff","antitrust"]},
 "Gold & safety":{up:["fear","risk","war","crisis","record","rate cut","dovish","safe haven","central bank"],down:["rate hike","hawkish","strong dollar","risk-on","calm"]},
 "Growth & consumer":{up:["beat","strong","boom","record","optimism","rebound"],down:["recession","miss","weak","layoff","slump","fear","contracts"]},
 "China & trade":{up:["stimulus","deal","talks","eases","rebound","support"],down:["tariff","ban","crackdown","probe","sanction","warning","slump"]},
 "Geopolitics & defence":{up:["ceasefire","deal","talks","peace"],down:["strike","war","missile","attack","threat","sanction"]},
 "Earnings":{up:["beat","record","raises","upgrade","strong","growth"],down:["miss","warning","weak","downgrade","slump","cuts"]},
 "Crypto-linked":{up:["approv","adoption","record","surge","rally","inflow","reserve"],down:["ban","crackdown","hack","lawsuit","plunge","crash","outflow","fraud"]}
};
/* ---- News for my ETF ---- */
function rulesFor(t){
  const e=App.universe().find(x=>x.t===t); if(!e)return null;
  const txt=((e.n||"")+" "+(e.c||"")+" "+(e.d||"")).toLowerCase();
  const rs=RULES.filter(r=>r.tick.indexOf(t)>=0||r.k.some(k=>txt.indexOf(k)>=0));
  return {e,rs};
}
function storyForETF(s,labels){
  return impacts(s.title,s.desc).filter(r=>labels.indexOf(r.label)>=0);
}
async function webFor(t){
  const get=async u=>{const j=await (await fetch(u,{cache:"no-store"})).json();return j;};
  try{ const j=await get("data/etf-news.json"); return {items:((j.etf||{})[t]||[]), asof:j.asof||""}; }
  catch(e){
    try{ const j=await get("data/news-daily.json"); return {items:((j.etf||{})[t]||[]), asof:j.asof||""}; }
    catch(e2){ return {items:[],asof:""}; }
  }
}
function groupByLabel(arr){
  const g={};
  arr.forEach(x=>{
    const key=x.m.length?x.m[0].label:"Fund-specific";
    if(!g[key])g[key]={rule:x.m[0]||null,items:[]};
    g[key].items.push(x.s);
  });
  return Object.keys(g).map(k=>({label:k,rule:g[k].rule,items:g[k].items}));
}
function groupHTML(gr,t){
  return gr.map(g=>{
    const why=g.rule?g.rule.why:"Directly about "+t+" — read for sentiment, flows and anything that changes its outlook.";
    const rows=g.items.map(s=>`<div style="padding:7px 0;border-top:1px solid var(--line)"><a href="${s.link}" target="_blank" rel="noopener">${s.title}</a><div class="meta">${s.outlet?(" · "+s.outlet):""}${s.date?(" · "+s.date):""}</div></div>`).join("");
    return `<div class="story"><div class="meta"><span class="pill info">${g.label}</span> <span class="muted">· ${g.items.length} ${g.items.length===1?"story":"stories"}</span></div>
      <p class="small" style="margin:6px 0"><b>What it means for ${t}:</b> ${why}</p>${rows}</div>`;
  }).join("");
}
function verdictHTML(scored,t){
  const pos=scored.filter(x=>x.tone>0).length, neg=scored.filter(x=>x.tone<0).length, neu=scored.length-pos-neg;
  if(!scored.length)return "";
  const net=pos-neg;
  const v=net>=2?["🟢 Leans positive","pos"]:net<=-2?["🔴 Leans negative","neg"]:["⚪ Mixed / neutral",""];
  return `<div class="box base" style="border-radius:12px;padding:12px 14px;border:1px solid var(--line);background:#eef4ff;margin:10px 0">
    <b>${v[0]} for ${t}</b> <span class="small muted">— rough read across ${scored.length} stories (${pos} positive · ${neg} negative · ${neu} neutral).</span>
    <div class="small muted">Keyword-based gauge, not advice: one major story can outweigh several small ones, and markets often price news in before you read it.</div></div>`;
}
async function renderETFNews(t){
  const box=$("#etfnews");
  const found=rulesFor(t);
  if(!found){box.innerHTML="<p class='muted'>ETF not found — pick from the suggestions.</p>";return;}
  const labels=found.rs.map(r=>r.label);
  const drivers=found.rs.length?found.rs.map(r=>r.label).join(" · "):"general market";
  box.innerHTML=`<p><b>${found.e.t} — ${found.e.n}</b> <span class="pill info">${found.e.c}</span></p>
    <p class="small muted">This fund typically reacts to: <b>${drivers}</b>. Gathering matches…</p>`;
  const hits=LIVE_ITEMS.map(s=>({s,m:storyForETF(s,labels)})).filter(x=>x.m.length);
  const web=await webFor(t);
  const witems=(web.items||[]).map(w=>({s:w,m:impacts(w.title,"")}));
  const scored=hits.concat(witems).map(x=>({x,tone:toneOf(x.s.title,x.m[0]||null)}));
  let html=`<p><b>${found.e.t} — ${found.e.n}</b> <span class="pill info">${found.e.c}</span></p>
    <p class="small muted">This fund typically reacts to: <b>${drivers}</b>.</p>`;
  html+=verdictHTML(scored,t);
  if(hits.length){
    html+=`<h3 style="margin-top:10px">📰 From the live feed <span class="pill info">${hits.length} of ${LIVE_ITEMS.length}</span></h3>`;
    html+=groupByLabel(hits);
  }else{
    html+=`<p class="small muted">No live-feed headline directly targets ${found.e.t} right now — the stories below still apply indirectly (broad moves lift or drag almost everything).</p>`;
  }
  if(witems.length){
    html+=`<h3 style="margin-top:14px">🌐 Across the web: latest on ${t} <span class="pill info">scanned daily · ${web.asof}</span></h3>`;
    html+=groupByLabel(witems);
  }else{
    html+=`<p class="small muted">No dedicated web stories for ${t} in this scan — it rescans all 500 ETFs daily, so check back tomorrow.</p>`;
  }
  box.innerHTML=html;
  try{localStorage.setItem("pira-etf",t);}catch(e){}
}
function restorePick(){
  let t=null; try{t=localStorage.getItem("pira-etf");}catch(e){}
  if(t&&App.universe().some(x=>x.t===t))renderETFNews(t);
}
function resolveETF(q){
  q=(q||"").trim(); if(!q)return null;
  const U=App.universe(), qu=q.toUpperCase(), ql=q.toLowerCase();
  let e=U.find(x=>x.t===qu); if(e)return {one:e};
  e=U.find(x=>x.n.toLowerCase()===ql); if(e)return {one:e};
  let ms=U.filter(x=>x.n.toLowerCase().indexOf(ql)===0||x.t.indexOf(qu)===0);
  if(ms.length===1)return {one:ms[0]};
  if(ms.length>1)return {many:ms.slice(0,8)};
  ms=U.filter(x=>x.n.toLowerCase().indexOf(ql)>=0);
  if(ms.length===1)return {one:ms[0]};
  if(ms.length>1)return {many:ms.slice(0,8)};
  return null;
}
function initPicker(){
  $("#etf-list").innerHTML=App.universe().map(e=>`<option value="${e.t}">${e.n}</option>`).join("");
  const go=()=>{
    const r=resolveETF($("#etfq").value);
    if(!r){toast("Nothing found — try a ticker like QQQ or a word like Nasdaq.");return;}
    if(r.one){$("#etfq").value="";renderETFNews(r.one.t);
      document.querySelector("#etfnews").scrollIntoView({behavior:"smooth",block:"nearest"});return;}
    const box=$("#etfnews");
    box.innerHTML="<p><b>Did you mean…</b></p><div class='pick'>"+r.many.map(e=>`<button class="btn ghost" data-pick="${e.t}">${e.t} · ${e.n}</button>`).join("")+"</div>";
    box.querySelectorAll("[data-pick]").forEach(b=>b.onclick=()=>{$("#etfq").value="";renderETFNews(b.dataset.pick);});
  };
  $("#etfgo").onclick=go;
  $("#etfq").addEventListener("keydown",e=>{if(e.key==="Enter")go();});
  $("#etfclear").onclick=()=>{const b=$("#etfnews");
    b.innerHTML="<p class='muted small'>Choose one of your ETFs above and this week's headlines will be filtered to the stories that typically move it — with an explanation per story.</p>";
    try{localStorage.removeItem("pira-etf");}catch(e){}};
}
live(); baked(); initPicker();
})();
