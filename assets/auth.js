/* Optional cloud accounts (Supabase). Zero-config = local-only mode, everything still works.
   To enable: create a free project at supabase.com, run supabase-schema.sql in its
   SQL editor, turn OFF "Confirm email" under Authentication > Providers > Email,
   then paste the project's URL + anon key below and redeploy. */
(function(){
"use strict";
const SUPABASE_URL = "https://rbaqboimydrqryhrivvb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_D3Wgv4EB13eMbfDen4Bj_A_KEz1RuWa";
const ENABLED = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
const LS_KEYS = ["pira-favs", "pira-compare", "pira-etf"];
let sb = null, user = null;

const lsGet = k => { try { return localStorage.getItem(k); } catch(e){ return null; } };
const lsSet = (k,v) => { try { v==null?localStorage.removeItem(k):localStorage.setItem(k,v); } catch(e){} };
function unionFavs(a,b){
  const out=[], seen={};
  (a.concat(b)).forEach(t=>{ if(t&&!seen[t]){seen[t]=1;out.push(t);} });
  return out.slice(0,60);
}
async function pull(){
  if(!sb||!user)return;
  try{
    const r = await sb.from("user_state").select("state").eq("user_id",user.id).maybeSingle();
    const cloud=(r.data&&r.data.state)||{};
    // favorites: union of devices; compare/news: cloud fills gaps only
    let favs=[]; try{favs=JSON.parse(lsGet("pira-favs")||"[]");}catch(e){}
    let cf=[]; try{cf=JSON.parse(cloud["pira-favs"]||"[]");}catch(e){}
    lsSet("pira-favs",JSON.stringify(unionFavs(favs,cf)));
    if(!lsGet("pira-compare")&&cloud["pira-compare"])lsSet("pira-compare",cloud["pira-compare"]);
    if(!lsGet("pira-etf")&&cloud["pira-etf"])lsSet("pira-etf",cloud["pira-etf"]);
    await push();
  }catch(e){ console.warn("cloud pull failed", e); }
  document.dispatchEvent(new CustomEvent("auth-ready"));
}
let pushT=null;
async function push(){
  if(!sb||!user)return;
  clearTimeout(pushT);
  pushT=setTimeout(async()=>{
    try{
      const state={}; LS_KEYS.forEach(k=>{state[k]=lsGet(k);});
      await sb.from("user_state").upsert({user_id:user.id,state:state,updated_at:new Date().toISOString()});
    }catch(e){ console.warn("cloud push failed", e); }
  },800);
}
function shell(){
  if(!ENABLED||document.querySelector("#acct"))return;
  const nav=document.querySelector("nav.main"); if(!nav)return;
  const b=document.createElement("a");
  b.href="#"; b.id="acct"; b.className=""; b.style.cssText="color:#dbe4f2;padding:8px 14px;border-radius:9px;font-weight:600;font-size:.9rem;border:1px solid rgba(255,255,255,.35)";
  b.textContent="Log in";
  b.onclick=e=>{e.preventDefault();openAuth();};
  nav.appendChild(b);
  const m=document.createElement("div");
  m.className="modal"; m.id="authmodal";
  m.innerHTML=`<div class="sheet"><button class="x" id="ax">✕</button><div id="abody"></div></div>`;
  document.body.appendChild(m);
  m.addEventListener("click",e=>{if(e.target.id==="authmodal")m.classList.remove("open");});
  document.querySelector("#ax").onclick=()=>m.classList.remove("open");
}
function paint(){
  const b=document.querySelector("#acct"); if(!b)return;
  b.textContent=user?("👤 "+(user.email||"Account")):"Log in";
  b.onclick=e=>{e.preventDefault();openAuth();};
}
function openAuth(){
  const box=document.querySelector("#abody"); if(!box)return;
  if(user){
    box.innerHTML=`<h2 style="margin-top:0">Your account</h2>
      <p class="muted">Signed in as <b>${user.email}</b>. Your favorites, comparisons and picks sync to all your devices.</p>
      <p><button class="btn" id="logout">Log out</button></p>`;
    document.querySelector("#authmodal").classList.add("open");
    document.querySelector("#logout").onclick=async()=>{await sb.auth.signOut();user=null;paint();document.querySelector("#authmodal").classList.remove("open");};
    return;
  }
  box.innerHTML=`<h2 style="margin-top:0">Log in / sign up</h2>
    <p class="muted small">One account for favorites, comparisons and picks — synced across devices. Free, email + password.</p>
    <div class="controls"><input type="email" id="aemail" placeholder="you@email.com" style="flex:1;min-width:200px;padding:10px 12px;border:1px solid var(--line);border-radius:10px"></div>
    <div class="controls"><input type="password" id="apass" placeholder="Password (min 6 characters)" style="flex:1;min-width:200px;padding:10px 12px;border:1px solid var(--line);border-radius:10px"></div>
    <p><button class="btn gold" id="signin">Log in</button> <button class="btn ghost" id="signup">Create account</button></p>
    <p class="small muted" id="amsg"></p>`;
  document.querySelector("#authmodal").classList.add("open");
  const msg=t=>{document.querySelector("#amsg").textContent=t;};
  document.querySelector("#signin").onclick=async()=>{
    const em=document.querySelector("#aemail").value.trim(), pw=document.querySelector("#apass").value;
    const r=await sb.auth.signInWithPassword({email:em,password:pw});
    if(r.error){msg(r.error.message);return;}
    user=r.data.user; paint(); document.querySelector("#authmodal").classList.remove("open"); pull();
  };
  document.querySelector("#signup").onclick=async()=>{
    const em=document.querySelector("#aemail").value.trim(), pw=document.querySelector("#apass").value;
    const r=await sb.auth.signUp({email:em,password:pw});
    if(r.error){msg(r.error.message);return;}
    if(r.data.session){user=r.data.user;paint();document.querySelector("#authmodal").classList.remove("open");pull();}
    else msg("Account created — if email confirmation is on, click the link in your inbox, then log in.");
  };
}
async function init(){
  if(!ENABLED)return;
  try{
    const mod=await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
    sb=mod.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
    const s=await sb.auth.getSession();
    user=(s.data&&s.data.session&&s.data.session.user)||null;
    sb.auth.onAuthStateChange((_ev,session)=>{user=(session&&session.user)||null;paint();if(user)pull();});
    shell(); paint();
    if(user)pull(); else document.dispatchEvent(new CustomEvent("auth-ready"));
  }catch(e){ console.warn("auth disabled", e); }
}
window.AuthSync={get enabled(){return ENABLED;},get user(){return user;},push:push,pull:pull,get client(){return sb;}};
document.readyState==="loading"?document.addEventListener("DOMContentLoaded",init):init();
})();
