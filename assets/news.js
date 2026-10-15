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
    const items=Array.from(xml.querySelectorAll("item")).slice(0,20).map(it=>({
      title:(it.querySelector("title")||{}).textContent||"",
      link:(it.querySelector("link")||{}).textContent||"",
      date:(it.querySelector("pubDate")||{}).textContent||"",
      desc:((it.querySelector("description")||{}).textContent||"").replace(/<[^>]+>/g,"").slice(0,300)}));
    // feed order = CNBC's own ranking: never reorder, just take the top 14
    LIVE_ITEMS=items.slice(0,14);
    box.innerHTML=LIVE_ITEMS.map(storyHTML).join("")||"<p class='muted'>No headlines right now.</p>";
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
function renderETFNews(t){
  const box=$("#etfnews");
  const found=rulesFor(t);
  if(!found){box.innerHTML="<p class='muted'>ETF not found — pick from the suggestions.</p>";return;}
  const labels=found.rs.map(r=>r.label);
  const hits=LIVE_ITEMS.map(s=>({s,m:storyForETF(s,labels)})).filter(x=>x.m.length);
  const drivers=found.rs.length?found.rs.map(r=>r.label).join(" · "):"general market";
  let html=`<p><b>${found.e.t} — ${found.e.n}</b> <span class="pill info">${found.e.c}</span></p>
    <p class="small muted">This fund typically reacts to: <b>${drivers}</b>. ${hits.length} of ${LIVE_ITEMS.length} current headlines match.</p>`;
  html+=hits.length?hits.map(x=>{
    const r=x.m[0];
    return `<div class="story"><h3><a href="${x.s.link}" target="_blank" rel="noopener">${x.s.title}</a></h3>
      <div class="meta">${x.s.date||""} · <span class="pill info">${r.label}</span></div>
      <p class="small" style="margin:6px 0 0"><b>What it means for ${found.e.t}:</b> ${r.why}</p></div>`;
  }).join(""):`<p class="small muted">No current headline directly targets ${found.e.t} — a calm week for this fund. The full list below still applies indirectly (broad market moves lift or drag almost everything).</p>`;
  box.innerHTML=html;
  try{localStorage.setItem("pira-etf",t);}catch(e){}
}
function restorePick(){
  let t=null; try{t=localStorage.getItem("pira-etf");}catch(e){}
  if(t&&App.universe().some(x=>x.t===t))renderETFNews(t);
}
function initPicker(){
  $("#etf-list").innerHTML=App.universe().map(e=>`<option value="${e.t}">${e.n}</option>`).join("");
  const go=()=>{const v=$("#etfq").value.trim().toUpperCase();
    const e=App.universe().find(x=>x.t===v);
    if(!e){toast("ETF not found — pick from the suggestions.");return;}
    $("#etfq").value=""; renderETFNews(e.t);
    document.querySelector("#etfnews").scrollIntoView({behavior:"smooth",block:"nearest"});};
  $("#etfgo").onclick=go;
  $("#etfq").addEventListener("keydown",e=>{if(e.key==="Enter")go();});
  $("#etfclear").onclick=()=>{const b=$("#etfnews");
    b.innerHTML="<p class='muted small'>Choose one of your ETFs above and this week's headlines will be filtered to the stories that typically move it — with an explanation per story.</p>";
    try{localStorage.removeItem("pira-etf");}catch(e){}};
}
live(); baked(); initPicker();
})();
