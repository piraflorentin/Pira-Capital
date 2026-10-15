/* Forecast page: 3 statistical scenarios from 5-year history. */
(function(){
"use strict";
const {$,universe,fmt$,fmtPct,getQuotes,getHistory,nav,toast}=App;
nav("forecast");
let T="SPY";

const DRIVERS={
 "Treasury Long":"Very rate-sensitive: Fed cuts or falling inflation usually lift it; hot CPI or surging issuance hurts. Watch 10–30y yields on the News page.",
 "Treasury Intermediate":"Moves with Fed expectations; less twitchy than long bonds.",
 "Treasury Short":"Anchored by the policy rate; stable unless the Fed surprises.",
 "TIPS":"Driven by real yields and inflation surprises.",
 "IG Corporate":"Rates + credit spreads: recession fears widen spreads and hurt; calm growth helps.",
 "High Yield":"Behaves like equities in stress; watch defaults and oil (energy issuers).",
 "Municipal":"Tax policy and muni demand; rates matter too.",
 "Gold":"Real yields, the dollar and fear: falling real yields and geopolitical risk help.",
 "Silver":"Gold's volatile sibling plus industrial demand.",
 "Oil":"OPEC decisions, inventories, geopolitics — and futures curve (contango drag).",
 "Natural Gas":"Weather, inventories and LNG exports swing it violently.",
 "Energy":"Crude prices first, then production discipline and dividends.",
 "Tech":"Earnings of mega-caps + real yields (high multiples = rate-sensitive).",
 "Semiconductors":"AI capex cycle, Taiwan/China risk, inventory cycles — the most cyclical corner of tech.",
 "Nasdaq 100":"Mega-cap earnings plus long-duration multiple risk when rates move.",
 "US Large Cap":"Earnings breadth, Fed policy and the consumer.",
 "US Small Cap":"Credit conditions and domestic growth; falls harder in recessions, rallies harder in recoveries.",
 "Dividend":"Payout growth and bond-yield competition: high yields make dividend stocks less attractive.",
 "Covered Call":"Tracks its index minus upside given away for premium; shines in flat markets, lags rages.",
 "Financials":"Yield curve shape, loan growth and credit quality.",
 "Banks":"Rates, the curve and deposit/loan dynamics.",
 "Health Care":"Drug pricing policy, FDA approvals, Medicare and litigation risk.",
 "Biotech":"Trial results and M&A; binary and volatile.",
 "Utilities":"Bond proxies: fall when yields spike, defensive when growth scares.",
 "US REIT":"Rates and occupancy; rate cuts are the classic tailwind.",
 "China":"Stimulus headlines, regulation and tariffs — plus yuan moves.",
 "Emerging Markets":"Dollar, commodities and global risk appetite.",
 "Japan":"BoJ policy and yen; hedged funds strip out currency.",
 "Europe":"ECB policy, energy costs and export demand.",
 "India":"Domestic growth and foreign flows; premium valuations cut both ways.",
 "Crypto & Blockchain":"Bitcoin price, regulation and ETF flows — extreme volatility.",
 "Volatility":"Mean-reverts and decays; a hedge that bleeds most days and spikes in panic.",
 "Leveraged Bull":"Daily-reset leverage: compounding and volatility decay make long holds treacherous.",
 "Inverse Bear":"Daily-reset short leverage: designed for days, not months.",
 "Currency":"Central-bank divergence between the two currencies.",
 "Managed Futures":"Trend persistence across assets; crisis alpha when trends are strong.",
 "Multi-Asset":"A weighted average of its stocks and bonds — diversification in one ticker.",
 "Clean Energy":"Subsidies, rates (capital-intensive projects) and power prices.",
 "Uranium":"Nuclear policy, mine supply and long-term contracting.",
 "Gold Miners":"Gold price amplified by operating leverage and costs."
};
function driverFor(cat){return DRIVERS[cat]||"Earnings, rates and risk appetite for its asset class — follow the drivers on the News page.";}

function monthlyStats(closes){
  const lr=[];for(let i=1;i<closes.length;i++)lr.push(Math.log(closes[i]/closes[i-1]));
  // resample to monthly-ish (21 trading days)
  const m=[],s=[];for(let i=0;i<lr.length;i+=21){const w=lr.slice(i,i+21);if(w.length<10)continue;m.push(w.reduce((a,b)=>a+b,0));s.push(w);}
  const mu=m.reduce((a,b)=>a+b,0)/m.length;
  const sd=Math.sqrt(m.reduce((a,b)=>a+(b-mu)*(b-mu),0)/(m.length-1));
  return {mu,sig:sd};
}
function sma(c,n){const o=[];for(let i=0;i<c.length;i++){if(i<n-1){o.push(null);continue;}let s=0;for(let j=i-n+1;j<=i;j++)s+=c[j];o.push(s/n);}return o;}
function maxDD(c){let p=c[0],d=0;c.forEach(v=>{p=Math.max(p,v);d=Math.min(d,v/p-1);});return d;}

async function build(){
  const e=universe().find(x=>x.t===T); if(!e)return;
  $("#picked").innerHTML=`<span class="chip">${e.t} · ${e.n}</span> <span class="pill info">${e.c}</span>`;
  let h; try{ h=await getHistory(T); }catch(err){ toast("No 5-year history available for "+T+" yet."); return; }
  const rows=h.rows, closes=rows.map(r=>parseFloat(r[1]));
  const last=closes[closes.length-1], n=closes.length;
  const cagr=Math.pow(last/closes[0],252/n)-1;
  const {mu,sig}=monthlyStats(closes);
  const dd=maxDD(closes);
  const s200=sma(closes,200), above=s200[s200.length-1]?last/s200[s200.length-1]-1:null;
  const s50=sma(closes,50);
  // live price check
  let live=null; try{const q=await getQuotes([T]); live=q[T]&&q[T].price;}catch(err){}
  const ref=live||last;
  $("#fc-stamp").textContent=`History ${rows[0][0]} → ${rows[rows.length-1][0]} (${n} sessions) · refreshed daily.`;
  $("#keystats").innerHTML=`
    <div><small>Reference price ${live?"(live)":"(last close)"}</small><b style="font-size:1.2rem">${fmt$(ref)}</b></div>
    <div><small>5-year CAGR (price)</small><b class="${cagr>=0?"pos":"neg"}">${fmtPct(cagr*100)}</b></div>
    <div><small>Monthly volatility σ</small><b>${fmtPct(sig*100)}</b></div>
    <div><small>Worst drawdown (5y)</small><b class="neg">${fmtPct(dd*100)}</b></div>
    <div><small>Trend vs 200-day avg</small><b class="${above>=0?"pos":"neg"}">${above==null?"—":fmtPct(above*100)}</b></div>
    <div><small>Sessions analysed</small><b>${n.toLocaleString()}</b></div>`;
  // scenarios
  const paths={bear:[ref],base:[ref],bull:[ref]};
  for(let mI=1;mI<=12;mI++){
    paths.base.push(paths.base[mI-1]*Math.exp(mu));
    paths.bull.push(paths.bull[mI-1]*Math.exp(mu+0.5*sig));
    paths.bear.push(paths.bear[mI-1]*Math.exp(mu-0.5*sig));
  }
  const P=k=>paths[k][12];
  const pct=k=>(P(k)/ref-1)*100;
  $("#p-bear").textContent=fmt$(P("bear"));$("#d-bear").textContent=`${fmtPct(pct("bear"))} vs today · persistent disappointment: recession, hawkish shock or sector slump.`;
  $("#p-base").textContent=fmt$(P("base"));$("#d-base").textContent=`${fmtPct(pct("base"))} vs today · history simply repeats its average drift.`;
  $("#p-bull").textContent=fmt$(P("bull"));$("#d-bull").textContent=`${fmtPct(pct("bull"))} vs today · sustained upside: cuts, earnings beats, multiple expansion.`;
  // shift month labels correctly
  const d0=new Date();const labels=[];for(let i=1;i<=12;i++){const d=new Date(d0.getFullYear(),d0.getMonth()+i,1);labels.push(d.toLocaleString("en-US",{month:"short"})+" "+String(d.getFullYear()).slice(2));}
  $("#mtable").innerHTML=labels.map((L,i)=>`<tr><td class="l">${L}</td><td class="num">${fmt$(paths.bear[i+1])}</td><td class="num"><b>${fmt$(paths.base[i+1])}</b></td><td class="num">${fmt$(paths.bull[i+1])}</td></tr>`).join("");
  $("#drivers").innerHTML=`<p><b>${e.t} — ${e.c}.</b> ${driverFor(e.c)}</p>
    <p>Trend check: price sits <b class="${above>=0?"pos":"neg"}">${above==null?"—":fmtPct(above*100)}</b> vs its 200-day average ${above>=0?"(uptrend — scenarios start from strength)":"(downtrend — rebounds need a catalyst)"}. Its worst 5-year drawdown was <b class="neg">${fmtPct(dd*100)}</b> — size positions so a repeat wouldn't hurt.</p>`;
  fan(paths,labels,ref);
}

function fan(paths,labels,ref){
  const cv=$("#fchart"),ctx=cv.getContext("2d"),dpr=window.devicePixelRatio||1;
  const W=cv.clientWidth||cv.parentElement.clientWidth,H=380;
  cv.width=W*dpr;cv.height=H*dpr;ctx.scale(dpr,dpr);ctx.clearRect(0,0,W,H);
  const pad={l:64,r:14,t:14,b:30},iw=W-pad.l-pad.r,ih=H-pad.t-pad.b;
  const all=[...paths.bear,...paths.base,...paths.bull];
  let mn=Math.min(...all),mx=Math.max(...all);const sp=(mx-mn)||1;mn-=sp*0.1;mx+=sp*0.1;
  const X=i=>pad.l+iw*i/12,Y=v=>pad.t+ih*(1-(v-mn)/(mx-mn));
  ctx.strokeStyle="#e3e8f0";ctx.fillStyle="#5d6b82";ctx.font="11px sans-serif";
  for(let g=0;g<=5;g++){const v=mn+(mx-mn)*g/5,y=Y(v);ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(W-pad.r,y);ctx.stroke();ctx.fillText("$"+v.toFixed(0),10,y+4);}
  for(let i=0;i<=12;i+=2)ctx.fillText(labels[i]||"",pad.l+iw*i/12-14,H-10);
  // band
  ctx.beginPath();paths.bull.forEach((v,i)=>i?ctx.lineTo(X(i),Y(v)):ctx.moveTo(X(i),Y(v)));
  [...paths.bear].reverse().forEach((v,j)=>ctx.lineTo(X(12-j),Y(v)));ctx.closePath();
  ctx.fillStyle="rgba(11,31,58,.10)";ctx.fill();
  const line=(arr,col)=>{ctx.strokeStyle=col;ctx.lineWidth=2.4;ctx.beginPath();arr.forEach((v,i)=>i?ctx.lineTo(X(i),Y(v)):ctx.moveTo(X(i),Y(v)));ctx.stroke();};
  line(paths.bear,"#c03535");line(paths.base,"#0b1f3a");line(paths.bull,"#0a8a4d");
  ctx.fillStyle="#0b1f3a";ctx.beginPath();ctx.arc(X(0),Y(ref),4,0,7);ctx.fill();
  ctx.fillStyle="#5d6b82";ctx.fillText("today",X(0)-12,Y(ref)-10);
}

function init(){
  $("#all-etfs2").innerHTML=universe().map(e=>`<option value="${e.t}">${e.n}</option>`).join("");
  const run=()=>{const v=$("#fcq").value.trim().toUpperCase();
    const e=universe().find(x=>x.t===v)||universe().find(x=>x.n.toUpperCase()===v);
    if(!e){toast("ETF not found — pick from suggestions.");return;}
    T=e.t;$("#fcq").value="";build();};
  $("#go").onclick=run;
  $("#fcq").addEventListener("keydown",e=>{if(e.key==="Enter")run();});
  build();
}
document.readyState==="loading"?document.addEventListener("DOMContentLoaded",init):init();
})();
