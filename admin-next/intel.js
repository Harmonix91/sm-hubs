/* Control room v2: Intelligence (Index, Roles, Movers, News, Targets). */
(function(){
const {sb,esc,safeUrl,fmtDate,fmtShort,iso,daysAgo,say,plural,pill,empty,panel,csv}=CR;
const FN={ceo:"CEO",cfo:"CFO",coo:"COO",cco:"CCO",cio:"CIO / investment",hr:"HR / People",asset_management:"Asset management",portfolio_management:"Portfolio management",programme_management:"Programme management",construction:"Construction",strategy:"Strategy",origination:"Origination",commercial:"Commercial",operations:"Operations",engineering:"Engineering",regulation:"Regulation",hse:"HSE",legal:"Legal",other:"Other"};
const LV={c_suite:"C-suite",director:"Director",head_of:"Head of",board:"Board",other:"Other"};
const MT={external_hire:"External hire",internal_promotion:"Promotion",departure:"Departure",board:"Board",interim:"Interim",other:"Other"};
CR.FN=FN;CR.LV=LV;
const opt=(v,l,cur)=>`<option value="${esc(v)}"${v===cur?" selected":""}>${esc(l)}</option>`;
const link=(u,t)=>{const s=safeUrl(u);return s?`<a href="${esc(s)}" target="_blank" rel="noopener">${esc(t||"Open ↗")}</a>`:""};
function kv(rows){return `<dl class="kv">${rows.filter(r=>r[1]!=null&&r[1]!=="").map(([k,v])=>`<dt>${esc(k)}</dt><dd>${v}</dd>`).join("")}</dl>`}
function bindSearch(el,fn){let t;el.oninput=()=>{clearTimeout(t);t=setTimeout(fn,120)}}

/* =====================================================================
   ROLES
   ===================================================================== */
let roleRows=[], rf={q:"",fn:"",sector:"",scope:"",state:"open",sig:""};
function filteredRoles(){
  const q=rf.q.trim().toLowerCase(), week=daysAgo(7);
  const openCount={};roleRows.forEach(r=>{if(!r.closed_on)openCount[r.employer]=(openCount[r.employer]||0)+1});
  return roleRows.filter(r=>{
    if(q&&!(`${r.employer} ${r.role_title}`.toLowerCase().includes(q)))return false;
    if(rf.fn&&r.function!==rf.fn)return false;
    if(rf.sector&&r.sector!==rf.sector)return false;
    if(rf.scope==="watch"&&!r.on_watchlist)return false;
    if(rf.scope==="wider"&&r.on_watchlist)return false;
    if(rf.state==="open"&&r.closed_on)return false;
    if(rf.state==="closed"&&!r.closed_on)return false;
    if(rf.sig==="repost"&&!(r.repost_count>0))return false;
    if(rf.sig==="60"&&!(r.days_open>=60))return false;
    if(rf.sig==="csuite"&&r.level!=="c_suite")return false;
    if(rf.sig==="multi"&&!(openCount[r.employer]>=2))return false;
    if(rf.sig==="new7"&&!(r.first_seen>=week))return false;
    return true});
}
async function renderRoles(app,q,alive){
  const {data,error}=await sb.from("vacancies").select("id,employer,role_title,level,function,sector,segment,country,location,url,source,first_seen,last_seen,closed_on,days_open,times_seen,repost_count,on_watchlist,ownership_tag").order("first_seen",{ascending:false}).limit(5000);
  if(!alive())return;
  if(error){app.innerHTML=empty("Could not load roles.",error.message);return}
  roleRows=data||[];
  if(q.fn)rf.fn=q.fn;
  const sectors=[...new Set(roleRows.map(r=>r.sector).filter(Boolean))].sort();
  const fns=[...new Set(roleRows.map(r=>r.function).filter(Boolean))].sort((a,b)=>(FN[a]||a).localeCompare(FN[b]||b));
  const open=roleRows.filter(r=>!r.closed_on);
  CR.head(`<button class="btn" id="rcsv">Download CSV</button>`);
  app.innerHTML=`<div class="fbar"><input type="search" id="rq" placeholder="Search employer or title" value="${esc(rf.q)}">
      <select id="rfn">${opt("","All functions",rf.fn)}${fns.map(f=>opt(f,FN[f]||f,rf.fn)).join("")}</select>
      <select id="rsector">${opt("","All sectors",rf.sector)}${sectors.map(s=>opt(s,s,rf.sector)).join("")}</select>
      <select id="rscope">${opt("","Watchlist and wider market",rf.scope)}${opt("watch","Watchlist only",rf.scope)}${opt("wider","Wider market only",rf.scope)}</select>
      <select id="rstate">${opt("open","Open roles",rf.state)}${opt("closed","Closed roles",rf.state)}${opt("all","Open and closed",rf.state)}</select></div>
    <div class="fmeta"><div class="chips">${[["","Any signal"],["new7","New in 7 days"],["repost","Reposted"],["60","Open 60+ days"],["csuite","C-suite"],["multi","Employers with 2+ open"]].map(([v,l])=>`<button class="qchip${rf.sig===v?" on":""}" data-sig="${v}">${l}</button>`).join("")}<button class="qchip${rf.fn==="hr"?" on":""}" data-hr>HR roles</button><button class="qchip" data-reset>Clear</button></div>
      <span id="rcount"></span></div><div id="rtable"></div>`;
  const tbl=CR.table(document.getElementById("rtable"),{rows:[],key:"first_seen",dir:-1,rowId:r=>r.id,
    cols:[{k:"employer",h:"Employer",render:r=>`<span class="strong">${esc(r.employer)}</span>${r.on_watchlist?' <span class="tag teal">Watchlist</span>':""}`},
      {k:"role_title",h:"Role",render:r=>`<div class="clip">${esc(r.role_title)}</div><span class="sub">${esc(LV[r.level]||r.level||"")}${r.location||r.country?" · "+esc(r.location||r.country):""}</span>`},
      {k:"function",h:"Function",hideM:true,sort:r=>FN[r.function]||r.function,render:r=>esc(FN[r.function]||r.function||"")},
      {k:"sector",h:"Sector",hideM:true},
      {k:"first_seen",h:"First seen",render:r=>esc(fmtShort(r.first_seen))},
      {k:"days_open",h:"Days open",num:true,render:r=>r.days_open??0},
      {k:"repost_count",h:"Reposts",num:true,hideM:true,render:r=>r.repost_count?`<b>${r.repost_count}</b>`:"–"},
      {k:"closed_on",h:"Status",hideM:true,sort:r=>r.closed_on||"~",render:r=>r.closed_on?pill("closed"):pill("live","Open")}],
    onRow:r=>{
      const others=roleRows.filter(x=>x.employer===r.employer&&x.id!==r.id&&!x.closed_on);
      panel(esc(r.employer),`<div class="dmeta">${r.closed_on?pill("closed"):pill("live","Open")}${r.on_watchlist?'<span class="tag teal">Watchlist</span>':'<span class="tag">Wider market</span>'}${r.repost_count?`<span class="tag">Reposted ×${r.repost_count}</span>`:""}</div>
        <h3>${esc(r.role_title)}</h3>
        ${kv([["Level",esc(LV[r.level]||r.level||"")],["Function",esc(FN[r.function]||r.function||"")],["Sector",esc(r.sector||"")],["Ownership",esc(r.ownership_tag||"")],["Location",esc(r.location||r.country||"")],["First seen",esc(fmtDate(r.first_seen))],["Last seen",esc(fmtDate(r.last_seen))],["Closed",r.closed_on?esc(fmtDate(r.closed_on)):""],["Days open",String(r.days_open??0)],["Seen",`${r.times_seen||1}×`],["Source",esc(r.source||"")],["Advert",link(r.url,"Open the advert ↗")]])}
        ${others.length?`<div class="sec" style="margin-top:18px">Other open roles at ${esc(r.employer)}</div>`+others.slice(0,12).map(o=>`<div class="small" style="padding:5px 0;border-bottom:1px solid var(--line2)">${esc(o.role_title)} <span class="muted">· ${o.days_open??0} days</span></div>`).join(""):""}`);
    }});
  const draw=()=>{const rows=filteredRoles();tbl.set(rows);document.getElementById("rcount").textContent=`${rows.length} of ${roleRows.length} roles · ${open.length} open · ${open.filter(r=>r.function==="hr").length} open HR`;
    app.querySelectorAll("[data-sig]").forEach(b=>b.classList.toggle("on",b.dataset.sig===rf.sig));app.querySelector("[data-hr]").classList.toggle("on",rf.fn==="hr")};
  bindSearch(document.getElementById("rq"),()=>{rf.q=document.getElementById("rq").value;draw()});
  [["rfn","fn"],["rsector","sector"],["rscope","scope"],["rstate","state"]].forEach(([id,k])=>document.getElementById(id).onchange=e=>{rf[k]=e.target.value;draw()});
  app.querySelectorAll("[data-sig]").forEach(b=>b.onclick=()=>{rf.sig=b.dataset.sig;draw()});
  app.querySelector("[data-hr]").onclick=()=>{rf.fn=rf.fn==="hr"?"":"hr";document.getElementById("rfn").value=rf.fn;draw()};
  app.querySelector("[data-reset]").onclick=()=>{rf={q:"",fn:"",sector:"",scope:"",state:"open",sig:""};CR.route()};
  document.getElementById("rcsv").onclick=()=>csv("roles",["employer","role_title","level","function","sector","country","location","on_watchlist","first_seen","last_seen","closed_on","days_open","times_seen","repost_count","url"],filteredRoles());
  draw();
  if(!roleRows.length)document.getElementById("rtable").innerHTML=empty("No roles yet.","The Index scan runs Tuesday and Friday at 16:00.");
}
CR.page("roles",{title:"Roles",eyebrow:"Intelligence · Leadership Signals Index",render:renderRoles});

/* =====================================================================
   MOVERS
   ===================================================================== */
let mvRows=[], mf={q:"",fn:"",scope:"",atlas:"",status:"",days:"30",type:""};
function filteredMoves(){
  const since=daysAgo(+mf.days||36500), q=mf.q.trim().toLowerCase();
  return mvRows.filter(r=>{
    if(q&&!(`${r.person_name} ${r.role_title} ${r.to_company} ${r.from_company||""}`.toLowerCase().includes(q)))return false;
    if(mf.fn&&r.function!==mf.fn)return false;
    if(mf.type&&r.move_type!==mf.type)return false;
    if(mf.scope==="watch"&&!r.to_watchlist_id)return false;
    if(mf.atlas==="yes"&&!r.atlas_match)return false;
    if(mf.status&&r.status!==mf.status)return false;
    if(mf.days&&r.announced_date&&r.announced_date<since)return false;
    return true});
}
async function renderMovers(app,q,alive){
  const {data,error}=await sb.from("appointments").select("id,person_name,role_title,level,function,to_company,to_watchlist_id,from_company,from_role,sector,country,announced_date,start_date,move_type,seat_left_open,source_url,source_name,atlas_match,atlas_task_id,status,notes").order("announced_date",{ascending:false,nullsFirst:false}).limit(5000);
  if(!alive())return;
  if(error){app.innerHTML=empty("Could not load moves.",error.message);return}
  mvRows=data||[];
  const fns=[...new Set(mvRows.map(r=>r.function).filter(Boolean))].sort((a,b)=>(FN[a]||a).localeCompare(FN[b]||b));
  CR.head(`<button class="btn" id="mcsv">Download CSV</button>`);
  app.innerHTML=`<div class="fbar"><input type="search" id="mq" placeholder="Search person, role or company" value="${esc(mf.q)}">
      <select id="mfn">${opt("","All functions",mf.fn)}${fns.map(f=>opt(f,FN[f]||f,mf.fn)).join("")}</select>
      <select id="mtype">${opt("","All move types",mf.type)}${Object.entries(MT).map(([k,v])=>opt(k,v,mf.type)).join("")}</select>
      <select id="mstatus">${opt("","Any status",mf.status)}${opt("new","New",mf.status)}${opt("drafted","In a draft",mf.status)}${opt("approved","Approved",mf.status)}${opt("killed","Killed",mf.status)}</select>
      <select id="mdays">${opt("7","Last 7 days",mf.days)}${opt("30","Last 30 days",mf.days)}${opt("90","Last 90 days",mf.days)}${opt("","All time",mf.days)}</select></div>
    <div class="fmeta"><div class="chips"><button class="qchip" data-mq="hr">HR moves</button><button class="qchip" data-mq="watch">Watchlist employers</button><button class="qchip" data-mq="atlas">Already in Atlas</button><button class="qchip" data-mq="reset">Clear</button></div><span id="mcount"></span></div><div id="mtable"></div>`;
  const tbl=CR.table(document.getElementById("mtable"),{rows:[],key:"announced_date",dir:-1,rowId:r=>r.id,
    cols:[{k:"person_name",h:"Person",render:r=>`<span class="strong">${esc(r.person_name)}</span><span class="sub clip">${esc(r.role_title)}</span>`},
      {k:"to_company",h:"Joins",render:r=>`${esc(r.to_company)}${r.to_watchlist_id?' <span class="tag teal">Watchlist</span>':""}${r.from_company?`<span class="sub">from ${esc(r.from_company)}</span>`:""}`},
      {k:"function",h:"Function",hideM:true,sort:r=>FN[r.function]||r.function,render:r=>esc(FN[r.function]||r.function||"")},
      {k:"move_type",h:"Type",hideM:true,render:r=>esc(MT[r.move_type]||r.move_type||"")},
      {k:"announced_date",h:"Announced",render:r=>esc(fmtShort(r.announced_date))},
      {k:"atlas_match",h:"Atlas",hideM:true,render:r=>r.atlas_match?'<span class="tag teal">In Atlas</span>':""},
      {k:"status",h:"Status",hideM:true,render:r=>pill(r.status)}],
    onRow:r=>panel(esc(r.person_name),`<div class="dmeta">${pill(r.status)}<span class="tag">${esc(MT[r.move_type]||r.move_type||"")}</span>${r.atlas_match?`<span class="tag teal">In Atlas: ${esc(r.atlas_match)}</span>`:""}</div>
      <h3>${esc(r.role_title)} at ${esc(r.to_company)}</h3>
      ${r.seat_left_open?`<div class="card" style="box-shadow:none;background:var(--teal-t);border-color:var(--teal-t2);margin:8px 0 12px"><div class="eyebrow" style="color:var(--teal)">Seat left open</div>${esc(r.seat_left_open)}</div>`:""}
      ${kv([["From",esc([r.from_role,r.from_company].filter(Boolean).join(", "))],["Function",esc(FN[r.function]||r.function||"")],["Level",esc(LV[r.level]||r.level||"")],["Sector",esc(r.sector||"")],["Country",esc(r.country||"")],["Announced",esc(fmtDate(r.announced_date))],["Starts",esc(fmtDate(r.start_date))],["Atlas task",r.atlas_task_id?"Congratulations task created":""],["Notes",esc(r.notes||"")],["Source",link(r.source_url,(r.source_name||"Source")+" ↗")]])}`)});
  const draw=()=>{const rows=filteredMoves();tbl.set(rows);document.getElementById("mcount").textContent=`${rows.length} of ${mvRows.length} moves · ${mvRows.filter(r=>r.atlas_match).length} people already in Atlas`;
    app.querySelector('[data-mq="hr"]').classList.toggle("on",mf.fn==="hr");app.querySelector('[data-mq="watch"]').classList.toggle("on",mf.scope==="watch");app.querySelector('[data-mq="atlas"]').classList.toggle("on",mf.atlas==="yes")};
  bindSearch(document.getElementById("mq"),()=>{mf.q=document.getElementById("mq").value;draw()});
  [["mfn","fn"],["mtype","type"],["mstatus","status"],["mdays","days"]].forEach(([id,k])=>document.getElementById(id).onchange=e=>{mf[k]=e.target.value;draw()});
  app.querySelectorAll("[data-mq]").forEach(b=>b.onclick=()=>{const k=b.dataset.mq;
    if(k==="hr"){mf.fn=mf.fn==="hr"?"":"hr";document.getElementById("mfn").value=mf.fn}
    else if(k==="watch")mf.scope=mf.scope==="watch"?"":"watch";
    else if(k==="atlas")mf.atlas=mf.atlas==="yes"?"":"yes";
    else{mf={q:"",fn:"",scope:"",atlas:"",status:"",days:"30",type:""};return CR.route()}
    draw()});
  document.getElementById("mcsv").onclick=()=>csv("movers",["person_name","role_title","level","function","to_company","from_company","from_role","sector","country","announced_date","move_type","seat_left_open","atlas_match","status","source_url"],filteredMoves());
  draw();
  if(!mvRows.length)document.getElementById("mtable").innerHTML=empty("No moves yet.","The Movers scan runs Monday to Friday at 16:15.");
}
CR.page("movers",{title:"Movers",eyebrow:"Intelligence · Senior appointments",render:renderMovers});

/* =====================================================================
   NEWS
   ===================================================================== */
let nwRows=[], nf={q:"",type:"",min:"",status:"",days:"30"};
function filteredNews(){
  const since=daysAgo(+nf.days||36500), q=nf.q.trim().toLowerCase();
  return nwRows.filter(r=>{
    if(q&&!(`${r.headline} ${(r.companies||[]).join(" ")} ${r.source||""} ${r.summary||""}`.toLowerCase().includes(q)))return false;
    if(nf.type&&r.story_type!==nf.type)return false;
    if(nf.min&&!((r.relevance||0)>=+nf.min))return false;
    if(nf.status&&r.status!==nf.status)return false;
    const d=r.published_date||(r.created_at||"").slice(0,10);
    if(nf.days&&d&&d<since)return false;
    return true});
}
async function renderNews(app,q,alive){
  const {data,error}=await sb.from("news_items").select("id,published_date,headline,source,url,companies,segment,sector,function_tags,story_type,summary,seat_implication,relevance,status,created_at").order("published_date",{ascending:false,nullsFirst:false}).limit(3000);
  if(!alive())return;
  if(error){app.innerHTML=empty("Could not load news.",error.message);return}
  nwRows=data||[];
  const types=[...new Set(nwRows.map(r=>r.story_type).filter(Boolean))].sort();
  CR.head(`<button class="btn" id="ncsv">Download CSV</button>`);
  app.innerHTML=`<div class="fbar"><input type="search" id="nq" placeholder="Search headline, company or source" value="${esc(nf.q)}">
      <select id="ntype">${opt("","All story types",nf.type)}${types.map(t=>opt(t,t.replace(/_/g," "),nf.type)).join("")}</select>
      <select id="nmin">${opt("","Any score",nf.min)}${opt("3","Score 3+",nf.min)}${opt("4","Score 4+",nf.min)}${opt("5","Score 5",nf.min)}</select>
      <select id="nstatus">${opt("","Any status",nf.status)}${["new","approved","used","killed"].map(s=>opt(s,s[0].toUpperCase()+s.slice(1),nf.status)).join("")}</select>
      <select id="ndays">${opt("7","Last 7 days",nf.days)}${opt("30","Last 30 days",nf.days)}${opt("90","Last 90 days",nf.days)}${opt("","All time",nf.days)}</select></div>
    <div class="fmeta"><span></span><span id="ncount"></span></div><div id="ntable"></div>`;
  const tbl=CR.table(document.getElementById("ntable"),{rows:[],key:"published_date",dir:-1,rowId:r=>r.id,
    cols:[{k:"published_date",h:"Date",render:r=>esc(fmtShort(r.published_date||r.created_at))},
      {k:"headline",h:"Headline",render:r=>`<div class="clip strong" style="max-width:460px">${esc(r.headline)}</div><span class="sub">${esc(r.source||"")}${(r.companies||[]).length?" · "+esc(r.companies.slice(0,3).join(", ")):""}</span>`},
      {k:"story_type",h:"Type",hideM:true,render:r=>esc((r.story_type||"").replace(/_/g," "))},
      {k:"relevance",h:"Score",num:true,render:r=>r.relevance??"–"},
      {k:"status",h:"Status",hideM:true,render:r=>pill(r.status)}],
    onRow:r=>panel(esc(r.source||"News"),`<div class="dmeta">${pill(r.status)}<span class="tag">Score ${r.relevance??"–"}</span>${r.story_type?`<span class="tag">${esc(r.story_type.replace(/_/g," "))}</span>`:""}</div>
      <h3>${esc(r.headline)}</h3>${r.summary?`<p style="font-size:13.5px">${esc(r.summary)}</p>`:""}
      ${r.seat_implication?`<div class="card" style="box-shadow:none;background:var(--teal-t);border-color:var(--teal-t2);margin:8px 0 12px"><div class="eyebrow" style="color:var(--teal)">Seat implication (internal)</div>${esc(r.seat_implication)}</div>`:""}
      ${kv([["Published",esc(fmtDate(r.published_date))],["Companies",esc((r.companies||[]).join(", "))],["Sector",esc(r.sector||r.segment||"")],["Functions",esc((r.function_tags||[]).map(f=>FN[f]||f).join(", "))],["Article",link(r.url,"Read the article ↗")]])}`)});
  const draw=()=>{const rows=filteredNews();tbl.set(rows);document.getElementById("ncount").textContent=`${rows.length} of ${nwRows.length} stories`};
  bindSearch(document.getElementById("nq"),()=>{nf.q=document.getElementById("nq").value;draw()});
  [["ntype","type"],["nmin","min"],["nstatus","status"],["ndays","days"]].forEach(([id,k])=>document.getElementById(id).onchange=e=>{nf[k]=e.target.value;draw()});
  document.getElementById("ncsv").onclick=()=>csv("news",["published_date","headline","source","url",{h:"companies",v:r=>(r.companies||[]).join("; ")},"story_type","relevance","status","sector","summary"],filteredNews());
  draw();
  if(!nwRows.length)document.getElementById("ntable").innerHTML=empty("No news yet.","The News check runs Monday to Friday at 16:30.");
}
CR.page("news",{title:"News",eyebrow:"Intelligence · Market news",render:renderNews});

/* =====================================================================
   INDEX (charts arrive in Phase 2) and TARGETS (placeholder)
   ===================================================================== */
CR.page("index",{title:"Index",eyebrow:"Intelligence · Aggregated view",render:async(app,q,alive)=>{
  const {data}=await sb.from("index_weekly").select("week,new_senior_roles").gte("week",daysAgo(63));
  if(!alive())return;
  const by={};(data||[]).forEach(r=>{by[r.week]=(by[r.week]||0)+Number(r.new_senior_roles)});
  const weeks=Object.keys(by).sort(), max=Math.max(1,...Object.values(by));
  app.innerHTML=`<div class="card"><h2>New senior roles per week (Index scan)</h2><p class="muted" style="margin-top:0">A preview. The full Index page (by function, sector and ownership, open roles over time, days open, reposts, moves per week, date range and CSV for every chart) is Phase 2.</p>
    ${weeks.length?`<div style="display:flex;align-items:flex-end;gap:8px;height:150px;margin-top:14px">${weeks.map(w=>`<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0"><span class="small strong">${by[w]}</span><div style="width:100%;max-width:46px;height:${Math.round(by[w]/max*110)}px;background:var(--teal);border-radius:5px 5px 0 0"></div><span class="small muted">${esc(fmtShort(w))}</span></div>`).join("")}</div>`:empty("No Index data yet.","")}</div>`;
}});

CR.page("targets",{title:"Targets",eyebrow:"Intelligence · Coming next",render:async(app,q,alive)=>{
  const {data}=await sb.from("intel_targets").select("*").order("week_of",{ascending:false}).order("rank").limit(50);
  if(!alive())return;
  if(!data||!data.length){app.innerHTML=empty("Targets is not built yet.","Planned: a Friday 17:45 job that ranks 5 to 10 BD targets and 2 podcast guests from the Index, Movers and news, with warm paths from Hoxo, the LinkedIn network, the Dream 100 and Atlas. They will appear here.");return}
  app.innerHTML='<div id="ttable"></div>';
  CR.table(document.getElementById("ttable"),{rows:data,key:"rank",dir:1,cols:[{k:"week_of",h:"Week",render:r=>esc(fmtShort(r.week_of))},{k:"lane",h:"Lane"},{k:"rank",h:"#",num:true},{k:"company",h:"Company",render:r=>`<span class="strong">${esc(r.company)}</span><span class="sub">${esc(r.person_name||"")}${r.person_title?", "+esc(r.person_title):""}</span>`},{k:"signal",h:"Signal",hideM:true},{k:"status",h:"Status",render:r=>pill(r.status)}],
    onRow:r=>panel(esc(r.company),`<h3>${esc(r.person_name||"")}</h3>${kv([["Title",esc(r.person_title||"")],["Signal",esc(r.signal||"")],["Why now",esc(r.why_now||"")],["Opener",esc(r.suggested_opener||"")],["LinkedIn",link(r.linkedin_url)],["Source",link(r.source_url)]])}`)});
}});
})();
