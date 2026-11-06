/* Control room v2: core (sign-in, admin check, navigation, shared helpers).
   Uses only the public Supabase key; every table is protected by row-level security (admins only). */
(function(){
const SUPABASE_URL = "https://hmjebqoeqffqljfyasys.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtamVicW9lcWZmcWxqZnlhc3lzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyNjc2MzEsImV4cCI6MjEwNzg0MzYzMX0.OZMx5dlkf4yp0akhU92t_K5BDN2N9hDhZeh-PzF7B2g"; // public key; data is protected by row-level security
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = id => document.getElementById(id);
const app = $("app"), msgEl = $("msg");

/* ---------- helpers ---------- */
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function md(s){return esc(s).split(/\n{2,}/).map(p=>"<p>"+p.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>').replace(/\n/g,"<br>")+"</p>").join("")}
function safeUrl(u){try{const x=new URL(u);return /^https?:$/.test(x.protocol)?x.href:null}catch{return null}}
function fmt(d){return new Date(d).toLocaleString("en-GB",{weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}
function fmtDate(d){return d?new Date(d+"T12:00:00").toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short",year:"numeric"}):""}
function fmtShort(d){return d?new Date((d.length===10?d+"T12:00:00":d)).toLocaleDateString("en-GB",{day:"numeric",month:"short"}):""}
function iso(d){const x=new Date(d);return new Date(x.getTime()-x.getTimezoneOffset()*6e4).toISOString().slice(0,10)}
function daysAgo(n){return iso(Date.now()-n*864e5)}
function addDays(s,n){const d=new Date(s+"T12:00:00");d.setDate(d.getDate()+n);return iso(d)}
function dow(s){const g=new Date(s+"T12:00:00").getDay();return g===0?7:g} // 1 = Monday
function mondayOf(s){return addDays(s,1-dow(s))}
function say(t,err){msgEl.innerHTML=t?`<div class="msg${err?" err":""}"><span>${esc(t)}</span><button aria-label="Dismiss">✕</button></div>`:"";const b=msgEl.querySelector("button");if(b)b.onclick=()=>say("")}
function plural(n,w,p){return `${n} ${n===1?w:(p||w+"s")}`}

/* status pills: one colour meaning per status */
const PILL={pending:["draft","Draft"],draft:["draft","Draft"],drafted:["draft","Drafted"],planned:["draft","Planned"],new:["draft","New"],
  approved:["approved","Approved"],ready:["approved","Ready"],
  live:["live","Live"],published:["published","Published"],ok:["ok","Ran"],used:["published","Used"],
  partial:["ok","Ran with gaps"],running:["approved","Running"],
  paused:["paused","Paused"],retired:["retired","Retired"],killed:["killed","Killed"],closed:["retired","Closed"],dropped:["retired","Dropped"],
  failed:["failed","Failed"],stalled:["failed","Stalled"],missed:["failed","Did not run"],
  missing_input:["action","Missing input"],action:["action","Needs action"]};
function pill(status,label){const p=PILL[status]||["draft",status];return `<span class="pill ${p[0]}">${esc(label||p[1])}</span>`}
function who(owner){const o=owner||"";return `<span class="who ${o||"none"}"><i>${o?o[0]:"–"}</i>${o?esc(o):"Either"}</span>`}

/* loading skeletons */
function skel(kind,n){return Array.from({length:n||3},()=>`<div class="sk ${kind}"></div>`).join("")}
function skPage(){return `<div class="tiles">${skel("tile",4)}</div><div style="height:14px"></div>${skel("card",3)}`}
function empty(title,text,btn){return `<div class="empty"><b>${esc(title)}</b>${esc(text||"")}${btn||""}</div>`}

/* CSV download */
function csv(name,cols,rows){
  const head=cols.map(c=>typeof c==="string"?c:c.h);
  const val=(r,c)=>typeof c==="string"?r[c]:c.v(r);
  const out=[head.join(",")].concat(rows.map(r=>cols.map(c=>`"${String(val(r,c)??"").replace(/"/g,'""')}"`).join(","))).join("\n");
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([out],{type:"text/csv"}));a.download=name+"-"+iso(Date.now())+".csv";a.click();
}

/* sortable table. cols: {k,h,num,hideM,render(r),sort(r)}; returns a controller */
function table(el,{cols,rows,key,dir,onRow,limit,rowId}){
  const st={key:key||null,dir:dir||-1,limit:limit||200,rows,sel:null};
  function draw(){
    let rs=st.rows.slice();
    if(st.key){const c=cols.find(c=>c.k===st.key);const g=c&&c.sort?c.sort:(r=>r[st.key]);
      rs.sort((a,b)=>{const x=g(a),y=g(b);if(x==null&&y==null)return 0;if(x==null)return 1;if(y==null)return-1;return (x>y?1:x<y?-1:0)*st.dir})}
    const shown=rs.slice(0,st.limit);
    el.innerHTML=`<div class="tw"><table class="t"><thead><tr>${cols.map(c=>`<th${c.k?` data-k="${c.k}"`:""} class="${c.num?"num ":""}${c.hideM?"hide-m ":""}${st.key===c.k?"sorted":""}">${esc(c.h)}${c.k?`<span class="ar">${st.key===c.k?(st.dir>0?"▲":"▼"):"↕"}</span>`:""}</th>`).join("")}</tr></thead>
      <tbody>${shown.map((r,i)=>`<tr data-i="${i}" tabindex="0"${rowId&&st.sel===rowId(r)?' class="sel"':""}>${cols.map(c=>`<td class="${c.num?"num ":""}${c.hideM?"hide-m ":""}${c.cls||""}">${c.render?c.render(r):esc(r[c.k]??"")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
      ${rs.length>st.limit?`<button class="btn more" data-more>Show ${Math.min(200,rs.length-st.limit)} more (${rs.length-st.limit} hidden)</button>`:""}`;
    el.querySelectorAll("th[data-k]").forEach(th=>th.onclick=()=>{const k=th.dataset.k;if(st.key===k)st.dir=-st.dir;else{st.key=k;st.dir=cols.find(c=>c.k===k).num?-1:1}draw()});
    el.querySelectorAll("tbody tr").forEach(tr=>{const r=shown[+tr.dataset.i];const open=()=>{if(rowId)st.sel=rowId(r);el.querySelectorAll("tr.sel").forEach(x=>x.classList.remove("sel"));tr.classList.add("sel");onRow&&onRow(r)};
      tr.onclick=e=>{if(e.target.closest("a"))return;open()};tr.onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();open()}}});
    const m=el.querySelector("[data-more]");if(m)m.onclick=()=>{st.limit+=200;draw()};
  }
  draw();
  return {set(rows){st.rows=rows;st.limit=limit||200;draw()},redraw:draw};
}

/* side panel */
let panelClose=null;
function panel(title,html,onClose){
  $("paneltitle").innerHTML=title;$("panelbody").innerHTML=html;
  $("panel").hidden=false;$("scrim").hidden=false;panelClose=onClose||null;
  setTimeout(()=>$("panelclose").focus(),10);
  return $("panelbody");
}
function closePanel(){if($("panel").hidden)return;$("panel").hidden=true;$("scrim").hidden=true;const f=panelClose;panelClose=null;f&&f()}
$("panelclose").onclick=closePanel;$("scrim").onclick=closePanel;
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("panel").hidden){e.preventDefault();closePanel()}});

/* ---------- health (unchanged logic from v1) ---------- */
const GOOD=["ok","partial","running"];
const HLABEL={ok:"Ran",partial:"Ran with gaps",running:"Running now",failed:"Failed",stalled:"Stalled",missed:"Did not run"};
let healthCache=null;
async function getHealth(force){
  if(healthCache&&!force&&Date.now()-healthCache.t<60000) return healthCache.d;
  const {data,error}=await sb.rpc("health_summary");
  if(error||!data) return null;
  healthCache={t:Date.now(),d:data}; return data;
}
let jobsCache=null;
async function getJobs(force){
  if(jobsCache&&!force&&Date.now()-jobsCache.t<60000) return jobsCache.d;
  const {data,error}=await sb.rpc("jobs_overview");
  if(error||!data) return null;
  jobsCache={t:Date.now(),d:data}; return data;
}

/* ---------- navigation ---------- */
const I={
  today:'<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  queue:'<path d="M4 6h16M4 12h16M4 18h10"/><path d="M17 17l2 2 3-4"/>',
  episodes:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  hubs:'<circle cx="12" cy="12" r="3"/><circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="12" cy="20" r="2"/><path d="M7 7l3 3M17 7l-3 3M12 15v3"/>',
  index:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  roles:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
  movers:'<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
  news:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h10M7 16h6"/>',
  targets:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  health:'<path d="M3 12h4l2-5 4 10 2-5h6"/>',
  howitruns:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>'
};
const NAV=[
  {g:"Today",items:[["today","Today"]]},
  {g:"Marketing",items:[["calendar","Content calendar"],["queue","Approval queue"],["episodes","Episodes"],["hubs","Hubs"]]},
  {g:"Intelligence",items:[["index","Index"],["roles","Roles"],["movers","Movers"],["news","News"],["targets","Targets"]]},
  {g:"System",items:[["health","Job health"],["howitruns","How it runs"]]}
];
const PAGES={};
function page(id,def){PAGES[id]=def}
function icon(id){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${I[id]||""}</svg>`}
function drawNav(cur){
  $("nav").innerHTML=NAV.map(g=>`<div class="ng">${esc(g.g)}</div>`+g.items.map(([id,l])=>`<a class="nl${id===cur?" on":""}" href="#/${id}" data-id="${id}">${icon(id)}<span>${esc(l)}</span><span data-cnt="${id}"></span></a>`).join("")).join("");
  $("nav").querySelectorAll("a").forEach(a=>a.onclick=()=>document.body.classList.remove("navopen"));
  updateCounts();
}
async function updateCounts(){
  const set=(id,html)=>{const el=document.querySelector(`[data-cnt="${id}"]`);if(el)el.outerHTML=`<span data-cnt="${id}" style="margin-left:auto;display:flex">${html}</span>`};
  const [q,h]=await Promise.all([
    Promise.resolve(sb.from("drafts").select("id",{count:"exact",head:true}).eq("status","pending")).then(r=>r.error?null:r.count).catch(()=>null),
    Promise.resolve(getHealth()).catch(()=>null)]);
  if(q) set("queue",`<span class="cnt act" title="Drafts to review">${q}</span>`);
  if(h){const n=h.jobs.filter(j=>!GOOD.includes(j.state)&&!j.resolved).length;set("health",n?`<span class="cnt act" title="Jobs needing attention">${n}</span>`:'<span class="okdot" title="All jobs ran"></span>')}
}

/* ---------- auth and routing ---------- */
let me={email:"",name:""}, isAdmin=null, token=0;
function signInForm(){
  $("signout").hidden=true;$("nav").hidden=true;document.body.classList.add("gate");
  $("pagetitle").textContent="Sign in";$("eyebrow").textContent="Sonder & Metric";$("who").textContent="";$("headactions").innerHTML="";
  app.innerHTML=`<div class="card signin"><p style="margin-top:0">Enter your work email. We'll send you a sign-in link.</p>
    <input type="email" id="email" placeholder="you@sonderandmetric.com" autocomplete="email">
    <button class="btn pri" id="send">Send link</button></div>`;
  const send=async()=>{
    const email=$("email").value.trim().toLowerCase();
    if(!email) return;
    const {error}=await sb.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+location.pathname}});
    say(error?("Could not send the link: "+error.message):"Check your inbox for the sign-in link.",!!error);
  };
  $("send").onclick=send;$("email").onkeydown=e=>{if(e.key==="Enter")send()};
}
function currentRoute(){const h=location.hash||"";if(!h.startsWith("#/"))return {id:"today",q:{}};const [p,qs]=h.slice(2).split("?");return {id:p||"today",q:Object.fromEntries(new URLSearchParams(qs||""))}}
function go(id,q){const s=q&&Object.keys(q).length?"?"+new URLSearchParams(q):"";const h="#/"+id+s;if(location.hash===h)route();else location.hash=h}

async function route(){
  const my=++token;
  closePanel();
  const {data:{session}}=await sb.auth.getSession();
  if(my!==token) return;
  if(!session){isAdmin=null;return signInForm()}
  $("signout").hidden=false;$("who").textContent=session.user.email;
  if(isAdmin===null||me.email!==session.user.email){
    const {data:admin}=await sb.from("admins").select("email,name");
    if(my!==token) return;
    isAdmin=!!(admin&&admin.length);
    const mine=(admin||[]).find(a=>a.email===session.user.email.toLowerCase());
    me={email:session.user.email.toLowerCase(),name:mine&&mine.name?mine.name.split(" ")[0]:(session.user.email[0].toUpperCase()+session.user.email.split("@")[0].slice(1))};
  }
  if(!isAdmin){document.body.classList.add("gate");$("nav").hidden=true;$("pagetitle").textContent="No access";app.innerHTML=empty("This account does not have access to the Control room.","Ask Josh to add your email to the admins list.");return}
  document.body.classList.remove("gate");$("nav").hidden=false;
  const {id,q}=currentRoute(), def=PAGES[id]||PAGES.today;
  drawNav(PAGES[id]?id:"today");
  $("pagetitle").textContent=def.title;$("eyebrow").textContent=def.eyebrow||"";$("headactions").innerHTML="";
  document.title=def.title+" | Control Room";
  app.innerHTML=skPage();
  try{await def.render(app,q,()=>my===token)}
  catch(e){console.error(e);if(my===token)app.innerHTML=empty("Something went wrong loading this page.",String(e&&e.message||e))}
}

function start(){
  $("signout").onclick=async()=>{await sb.auth.signOut();isAdmin=null;say("");signInForm()};
  $("menu").onclick=()=>document.body.classList.toggle("navopen");
  window.addEventListener("hashchange",()=>{if(/access_token|error_description/.test(location.hash))return;say("");route()});
  sb.auth.onAuthStateChange(ev=>{if(ev==="SIGNED_IN"){if(/access_token/.test(location.hash))history.replaceState(null,"",location.pathname);route()}});
  const err=/error_description=([^&]+)/.exec(location.hash);
  if(err){history.replaceState(null,"",location.pathname);say("Sign-in link problem: "+decodeURIComponent(err[1].replace(/\+/g," "))+". Request a new link.",true)}
  route();
}

window.CR={sb,app,esc,md,safeUrl,fmt,fmtDate,fmtShort,iso,daysAgo,addDays,dow,mondayOf,say,plural,pill,who,skel,empty,csv,table,panel,closePanel,
  GOOD,HLABEL,getHealth,getJobs,resetHealth:()=>{healthCache=null},resetJobs:()=>{jobsCache=null},updateCounts,page,go,route,start,me:()=>me,
  head:html=>{$("headactions").innerHTML=html}};
})();
