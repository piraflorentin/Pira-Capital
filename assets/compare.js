/* Compare page: normalised multi-ETF chart + stats. */
(function(){
"use strict";
const {$,universe,fmt$,fmtPct,getQuotes,getHistory,nav,toast}=App;
nav("compare");
const COLORS=["#0b1f3a","#c9a227","#0e9f8a","#c03535","#7c5cd6"];
const S={sel:["SPY","QQQ","VTI"],range:"1Y",series:{},asof:{}};

function resolve(q){
  q=(q||"").trim().toUpperCase();
  let e=universe().find(x=>x.t===q);
  if(!e)e=universe().find(x=>x.n.toUpperCase()===q||x.n.toUpperCase().includes(q));
  return e||null;
}
function sliceRows(rows,range){
  const n={ "1W":5,"1M":22,"1Y":252,"5Y":1e9 }[range];
  return rows.slice(Math.max(0,rows.length-n));
}
function norm(rows){ const b=parseFloat(rows[0][1]); return rows.map(r=>({d:r[0],v:parseFloat(r[1])/b*100})); }
function stats(rows){
  const c=rows.map(r=>parseFloat(r[1])), n=c.length, ret=c[n-1]/c[0]-1;
  const lr=[]; for(let i=1;i<n;i++)lr.push(Math.log(c[i]/c[i-1]));
  const m=lr.reduce((a,b)=>a+b,0)/Math.max(1,lr.length);
  const sd=Math.sqrt(lr.reduce((a,b)=>a+(b-m)*(b-m),0)/Math.max(1,lr.length-1));
  const vol=sd*Math.sqrt(252);
  let peak=c[0],dd=0; c.forEach(v=>{peak=Math.max(peak,v);dd=Math.min(dd,v/peak-1);});
  const cagr=n>=200?Math.pow(c[n-1]/c[0],252/n)-1:null;
  return {ret,cagr,vol,dd,n};
}

async function load(){
  const names=Object.fromEntries(universe().map(e=>[e.t,e.n]));
  for(const t of S.sel){
    if(S.series[t])continue;
    try{ const h=await getHistory(t); S.series[t]=h.rows; S.asof[t]=h.asof; }
    catch(e){ toast("No history yet for "+t); S.series[t]=null; }
  }
  draw(); statsTable();
  const dates=Object.values(S.asof).filter(Boolean).sort();
  $("#cmp-stamp").textContent=dates.length?("History through "+dates[dates.length-1]+" · refreshed daily."):"";
}

function aligned(){
  // align series on date index of the longest; simple: use each series' own x positions
  const out=[];
  S.sel.forEach((t,i)=>{
    const rows=S.series[t]; if(!rows)return;
    const sl=sliceRows(rows,S.range), nz=norm(sl);
    out.push({t,n:(universe().find(e=>e.t===t)||{n:t}).n,pts:nz,color:COLORS[i%COLORS.length],st:stats(sl)});
  });
  return out;
}

function draw(){
  const cv=$("#chart"), ctx=cv.getContext("2d"), dpr=window.devicePixelRatio||1;
  const W=cv.clientWidth||cv.parentElement.clientWidth, H=380;
  cv.width=W*dpr; cv.height=H*dpr; ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,W,H);
  const A=aligned(), pad={l:56,r:14,t:14,b:30}, iw=W-pad.l-pad.r, ih=H-pad.t-pad.b;
  if(!A.length){ctx.fillStyle="#5d6b82";ctx.fillText("Add ETFs to draw the chart.",pad.l,40);return;}
  const allV=A.flatMap(a=>a.pts.map(p=>p.v));
  let mn=Math.min(...allV),mx=Math.max(...allV); const span=(mx-mn)||1; mn-=span*0.08; mx+=span*0.08;
  const X=i=>pad.l+iw*i/(Math.max(...A.map(a=>a.pts.length))-1), Y=v=>pad.t+ih*(1-(v-mn)/(mx-mn));
  ctx.strokeStyle="#e3e8f0";ctx.fillStyle="#5d6b82";ctx.font="11px sans-serif";ctx.lineWidth=1;
  for(let g=0;g<=5;g++){const v=mn+(mx-mn)*g/5,y=Y(v);
    ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(W-pad.r,y);ctx.stroke();
    ctx.fillText(v.toFixed(1),8,y+4);}
  const N=Math.max(...A.map(a=>a.pts.length));
  for(let g=0;g<6;g++){const i=Math.round((N-1)*g/5);
    const d=A[0].pts[Math.min(i,A[0].pts.length-1)].d.slice(2);
    ctx.fillText(d,pad.l+iw*g/5-16,H-10);}
  A.forEach(a=>{
    ctx.strokeStyle=a.color;ctx.lineWidth=2.2;ctx.beginPath();
    a.pts.forEach((p,i)=>{const x=pad.l+iw*i/(a.pts.length-1),y=Y(p.v);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});
    ctx.stroke();
    const last=a.pts[a.pts.length-1];
    ctx.fillStyle=a.color;
    ctx.fillText(last.v.toFixed(1),W-pad.r-30,Y(last.v)-8);
  });
  cv._geom={A,X,Y,pad,iw,ih,W,H,mn,mx};
  $("#legend").innerHTML=A.map(a=>`<span><i style="background:${a.color}"></i><b>${a.t}</b> ${a.n} · <b class="${a.st.ret>=0?"pos":"neg"}">${fmtPct(a.st.ret*100)}</b></span>`).join("");
  $("#chart-note").textContent=`${A.map(a=>a.t).join(" · ")} — ${S.range} · rebased to 100 at period start · price return.`;
  cv.onmousemove=ev=>{
    const r=cv.getBoundingClientRect(),mx2=ev.clientX-r.left,g=cv._geom; if(!g)return;
    const a=g.A[0]; if(!a)return;
    const i=Math.round((mx2-g.pad.l)/g.iw*(a.pts.length-1));
    if(i<0||i>=a.pts.length)return;
    draw();
    const ctx2=cv.getContext("2d");
    ctx2.strokeStyle="#94a3b8";ctx2.setLineDash([4,4]);ctx2.beginPath();
    const x=g.pad.l+g.iw*i/(a.pts.length-1);ctx2.moveTo(x,g.pad.t);ctx2.lineTo(x,g.H-g.pad.b);ctx2.stroke();ctx2.setLineDash([]);
    const rows=g.A.map(s=>{const p=s.pts[Math.min(i,s.pts.length-1)];return `<div><i style="background:${s.color};width:10px;height:10px;display:inline-block;border-radius:2px"></i> <b>${s.t}</b> ${p.v.toFixed(2)}</div>`;}).join("");
    let tip=$("#ctip");
    if(!tip){tip=document.createElement("div");tip.id="ctip";tip.style.cssText="position:absolute;background:#0b1f3a;color:#fff;padding:8px 12px;border-radius:8px;font-size:.8rem;pointer-events:none;z-index:5";cv.parentElement.appendChild(tip);}
    tip.innerHTML=`<b>${a.pts[i].d}</b>`+rows; tip.style.display="block";
    tip.style.left=Math.min(x+12,g.W-170)+"px"; tip.style.top="10px";
  };
  cv.onmouseleave=()=>{const t=$("#ctip");if(t)t.style.display="none";};
}

async function statsTable(){
  const A=aligned();
  $("#stats").innerHTML=A.map(a=>`<tr><td class="l"><b>${a.t}</b> <span class="muted small">${a.n}</span></td>
    <td class="num ${a.st.ret>=0?"pos":"neg"}">${fmtPct(a.st.ret*100)}</td>
    <td class="num">${a.st.cagr==null?"—":fmtPct(a.st.cagr*100)}</td>
    <td class="num">${fmtPct(a.st.vol*100)}</td>
    <td class="num neg">${fmtPct(a.st.dd*100)}</td>
    <td class="num" data-live="${a.t}">…</td></tr>`).join("")||'<tr><td colspan="6" class="muted">Add ETFs to see statistics.</td></tr>';
  try{
    const q=await getQuotes(A.map(a=>a.t));
    A.forEach(a=>{const el=document.querySelector(`[data-live="${a.t}"]`);if(el)el.textContent=q[a.t]?("$"+q[a.t].price.toFixed(2)):"—";});
  }catch(e){}
}

function chips(){
  $("#chips").innerHTML=S.sel.map((t,i)=>`<span class="chip" style="border-left:6px solid ${COLORS[i%COLORS.length]}">${t}<button data-rm="${t}">✕</button></span>`).join("")||'<span class="muted small">None selected.</span>';
  document.querySelectorAll("[data-rm]").forEach(b=>b.onclick=()=>{S.sel=S.sel.filter(x=>x!==b.dataset.rm);chips();load();});
}
function add(){
  const e=resolve($("#pickq").value);
  if(!e){toast("ETF not found — pick from suggestions.");return;}
  if(S.sel.includes(e.t)){toast(e.t+" already added.");return;}
  if(S.sel.length>=5){toast("Maximum 5 ETFs for a readable chart.");return;}
  S.sel.push(e.t); $("#pickq").value=""; chips(); load();
}
function init(){
  $("#all-etfs").innerHTML=universe().map(e=>`<option value="${e.t}">${e.n}</option>`).join("");
  $("#add").onclick=add;
  $("#pickq").addEventListener("keydown",e=>{if(e.key==="Enter")add();});
  $("#reset").onclick=()=>{S.sel=["SPY","QQQ","VTI"];chips();load();};
  document.querySelectorAll("#ranges button").forEach(b=>b.onclick=()=>{
    document.querySelectorAll("#ranges button").forEach(x=>x.classList.remove("on"));
    b.classList.add("on"); S.range=b.dataset.r; load();});
  $("#csv").onclick=()=>{
    const A=aligned(); if(!A.length){toast("Nothing to download.");return;}
    const dates=[...new Set(A.flatMap(a=>a.pts.map(p=>p.d)))].sort();
    let csv="date,"+A.map(a=>a.t).join(",")+"\n";
    dates.forEach(d=>{csv+=d+","+A.map(a=>{const p=a.pts.find(p=>p.d===d);return p?p.v.toFixed(2):"";}).join(",")+"\n";});
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
    a.download=`etf-compare-${S.range}.csv`; a.click();
  };
  chips(); load();
}
document.readyState==="loading"?document.addEventListener("DOMContentLoaded",init):init();
})();
