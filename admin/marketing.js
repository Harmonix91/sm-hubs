/* Control room v2: Marketing (Content calendar, Approval queue, Episodes, Hubs). */
(function(){
const {sb,esc,md,safeUrl,fmt,fmtDate,fmtShort,iso,addDays,dow,mondayOf,say,plural,pill,who,empty,panel,closePanel}=CR;
const KIND={brief:"The Brief",newsletter:"Newsletter",movers:"Movers",news:"News",brief_section:"Brief",index_update:"Index",hub_email:"Hub email",linkedin_post:"LinkedIn",outreach:"Outreach",other:"Other"};
const HUB={hr:"HR",operating_partners:"Operating Partners",cfo:"CFO",ceo:"CEO",investors:"Investors",asset_management:"Asset Management",all:"All hubs"};
const ownerSel=(v,attrs)=>`<select ${attrs||""} aria-label="Owner"><option value=""${!v?" selected":""}>Either</option><option${v==="Josh"?" selected":""}>Josh</option><option${v==="Sarah"?" selected":""}>Sarah</option></select>`;
const isTyping=e=>!!(e.target&&e.target.closest&&e.target.closest("input,textarea,select,[contenteditable]"));

/* =====================================================================
   APPROVAL QUEUE
   ===================================================================== */
const Q={view:"pending",kind:"",hub:"",owner:"",cur:0,sel:new Set(),rows:[]};

// Rich HTML for pasting into LinkedIn's article editor (unchanged from v1)
function inl(t){return t.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,'<a href="$2">$1</a>')}
function richHtml(src){
  const lines=esc(src).split("\n");let html="",list=false,para=[];
  const flush=()=>{if(para.length){html+="<p>"+inl(para.join(" "))+"</p>";para=[]}};
  for(const raw of lines){const l=raw.trim();
    if(/^[-*] /.test(l)){flush();if(!list){html+="<ul>";list=true}html+="<li>"+inl(l.slice(2))+"</li>";continue}
    if(list){html+="</ul>";list=false}
    if(!l){flush();continue}
    const h=l.match(/^(#{1,3})\s+(.*)$/);
    if(h){flush();html+=h[1].length===1?`<h1>${inl(h[2])}</h1>`:`<h2>${inl(h[2])}</h2>`;continue}
    const b=l.match(/^\*\*(.+)\*\*:?$/);
    if(b){flush();html+=`<h2>${b[1]}</h2>`;continue}
    para.push(l)}
  flush();if(list)html+="</ul>";return html}
function plainText(src){return src.replace(/\*\*(.+?)\*\*/g,"$1").replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,"$1 ($2)").replace(/^#{1,3}\s+/gm,"")}
async function copyForLinkedIn(text){
  try{
    await navigator.clipboard.write([new ClipboardItem({"text/html":new Blob([richHtml(text)],{type:"text/html"}),"text/plain":new Blob([plainText(text)],{type:"text/plain"})})]);
    say("Copied with formatting. In LinkedIn: Write article, choose the Solving Infrastructure newsletter, paste, add a cover image, then schedule for Friday.");
  }catch(e){
    const ta=document.createElement("textarea");ta.value=plainText(text);document.body.appendChild(ta);ta.select();document.execCommand("copy");ta.remove();
    say("Copied as plain text (this browser blocked formatted copy). Headings and bold will need setting in LinkedIn.");
  }
}

function dcard(d,i){
  const src=(d.source_urls||[]).map(safeUrl).filter(Boolean).map(u=>`<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u)}</a>`).join("<br>");
  const pending=d.status==="pending";
  const text=d.edited_body||d.body||"";
  const long=text.length>1400;
  return `<article class="dcard${i===Q.cur?" cur":""}" data-id="${d.id}" data-i="${i}">
    <div>${pending?`<input type="checkbox" class="pick" aria-label="Select" ${Q.sel.has(d.id)?"checked":""}>`:""}</div>
    <div style="min-width:0">
    <div class="dmeta">${pill(d.status==="approved"&&d.kind==="newsletter"&&!d.published_url?"ready":d.status)}<span class="tag teal">${esc(KIND[d.kind]||d.kind)}</span>${d.hub?`<span class="tag">${esc(HUB[d.hub]||d.hub)}</span>`:""}<span class="muted small">${esc(fmt(d.created_at))}</span>${d.created_by_job?`<span class="muted small hide-m">· ${esc(d.created_by_job)}</span>`:""}${d.edited_body?'<span class="tag">Edited</span>':""}
      <span style="margin-left:auto" class="row small"><span class="muted">Owner</span>${ownerSel(d.owner,'data-owner class="sm"')}</span></div>
    <h2>${esc(d.title)}</h2>
    <div class="body${long?" clamp":""}">${md(text)}</div>${long?'<button class="btn ghost sm" data-more>Show all</button>':""}
    ${src?`<div class="sources"><strong>Sources</strong><br>${src}</div>`:`<div class="sources none">No source attached</div>`}
    ${!pending?`<div class="dact"><span class="status muted">${esc(d.status)} by ${esc(d.decided_by||"")}${d.decided_at?" · "+esc(fmt(d.decided_at)):""}</span>${d.decision_note?`<span class="muted">“${esc(d.decision_note)}”</span>`:""}${d.published_url&&safeUrl(d.published_url)?`<a class="muted" href="${esc(safeUrl(d.published_url))}" target="_blank" rel="noopener">View on LinkedIn</a>`:""}</div>
    ${d.kind==="newsletter"&&d.status==="approved"&&!d.published_url?`<div class="publish"><div class="dact" style="margin-top:0"><button class="btn act" data-p="copy">Copy for LinkedIn</button></div>
      <label class="f">Once it is live or scheduled, paste the LinkedIn link here</label>
      <div class="row"><input type="text" data-p="url" placeholder="https://www.linkedin.com/pulse/..." style="flex:1 1 260px"><button class="btn" data-p="mark">Mark as published</button></div></div>`:""}`:
    `<div class="dact"><button class="btn pri" data-a="approve">Approve <kbd>A</kbd></button><button class="btn" data-a="edit">Edit <kbd>E</kbd></button><button class="btn danger" data-a="kill">Kill <kbd>X</kbd></button></div><div class="editor"></div><div class="killslot"></div>`}
    </div></article>`;
}

async function renderQueue(app,q,alive){
  if(q.view) Q.view=q.view;
  if("owner" in q) Q.owner=q.owner;
  const H={count:"exact",head:true};
  let qq=sb.from("drafts").select("*");
  if(Q.view==="pending") qq=qq.eq("status","pending").order("created_at",{ascending:true});
  else if(Q.view==="ready") qq=qq.eq("status","approved").eq("kind","newsletter").is("published_url",null).order("created_at",{ascending:true});
  else qq=qq.neq("status","pending").gte("decided_at",new Date(Date.now()-7*864e5).toISOString()).order("decided_at",{ascending:false});
  const [{data,error},cp,cr]=await Promise.all([qq.limit(200),
    sb.from("drafts").select("id",H).eq("status","pending"),
    sb.from("drafts").select("id",H).eq("status","approved").eq("kind","newsletter").is("published_url",null)]);
  if(!alive())return;
  if(error){app.innerHTML=empty("Could not load drafts.",error.message);return}
  Q.rows=data||[];
  for(const id of [...Q.sel]) if(!Q.rows.some(r=>r.id===id&&r.status==="pending")) Q.sel.delete(id);
  drawQueue(app,cp.count,cr.count);
}

function qFiltered(){return Q.rows.filter(d=>(!Q.kind||d.kind===Q.kind)&&(!Q.hub||(d.hub||"none")===Q.hub)&&(!Q.owner||(Q.owner==="either"?!d.owner:d.owner===Q.owner)))}

function drawQueue(app,nPending,nReady){
  const kinds=[...new Set(Q.rows.map(d=>d.kind))], hubs=[...new Set(Q.rows.map(d=>d.hub||"none"))];
  const opt=(v,l,cur)=>`<option value="${esc(v)}"${v===cur?" selected":""}>${esc(l)}</option>`;
  const rows=qFiltered();
  if(Q.cur>=rows.length)Q.cur=Math.max(0,rows.length-1);
  const tb=(v,l,n)=>`<button data-v="${v}" class="${Q.view===v?"on":""}">${l}${n?`<span class="n">${n}</span>`:""}</button>`;
  const emptyMsg={pending:["Nothing waiting. All clear.","New drafts arrive after the weekday scans (from 16:00)."],ready:["No approved newsletters waiting to go on LinkedIn.","Approved newsletters appear here with a Copy for LinkedIn button."],done:["No decisions in the last 7 days.",""]}[Q.view];
  const selCount=[...Q.sel].filter(id=>rows.some(r=>r.id===id)).length;
  app.innerHTML=`<div class="qbar"><div class="tabs">${tb("pending","To review",nPending)}${tb("ready","Ready to publish",nReady)}${tb("done","Decided, last 7 days")}</div>
    <div class="keys"><span><span class="kbd">J</span> <span class="kbd">K</span> next / previous</span><span><span class="kbd">A</span> approve</span><span><span class="kbd">E</span> edit</span><span><span class="kbd">X</span> kill</span></div></div>
    <div class="fbar"><select data-f="kind">${opt("","All types",Q.kind)}${kinds.map(k=>opt(k,KIND[k]||k,Q.kind)).join("")}</select>
      <select data-f="hub">${opt("","All hubs",Q.hub)}${hubs.map(h=>opt(h,h==="none"?"No hub":(HUB[h]||h),Q.hub)).join("")}</select>
      <select data-f="owner">${opt("","Anyone",Q.owner)}${opt("Josh","Josh",Q.owner)}${opt("Sarah","Sarah",Q.owner)}${opt("either","Unassigned",Q.owner)}</select>
      <span class="muted grow" style="text-align:right">${plural(rows.length,"item")}${rows.length!==Q.rows.length?` of ${Q.rows.length}`:""}</span></div>
    ${Q.view==="pending"&&rows.length?`<div class="bulk"><label class="row" style="gap:6px;cursor:pointer"><input type="checkbox" id="qall" ${selCount&&selCount===rows.length?"checked":""}> Select all shown</label><span class="grow muted">${selCount?plural(selCount,"selected"):"Tick drafts to approve several at once"}</span><button class="btn pri sm" id="qbulk" ${selCount?"":"disabled"}>Approve ${selCount||""} selected</button></div>`:""}
    <div id="qlist">${rows.length?rows.map(dcard).join(""):empty(...emptyMsg)}</div>`;
  app.querySelectorAll(".tabs button").forEach(b=>b.onclick=()=>{Q.view=b.dataset.v;Q.cur=0;Q.sel.clear();say("");CR.go("queue",{view:Q.view})});
  app.querySelectorAll("[data-f]").forEach(s=>s.onchange=()=>{Q[s.dataset.f]=s.value;Q.cur=0;drawQueue(app,nPending,nReady)});
  const all=app.querySelector("#qall");if(all)all.onchange=()=>{rows.forEach(r=>all.checked?Q.sel.add(r.id):Q.sel.delete(r.id));drawQueue(app,nPending,nReady)};
  const bulk=app.querySelector("#qbulk");if(bulk)bulk.onclick=()=>bulkApprove(rows.filter(r=>Q.sel.has(r.id)));
  bindCards(app,nPending,nReady);
}

function bindCards(app,nPending,nReady){
  app.querySelectorAll(".dcard").forEach(el=>{
    const id=+el.dataset.id;
    el.addEventListener("click",e=>{if(!e.target.closest("button,a,input,select,textarea")){Q.cur=+el.dataset.i;app.querySelectorAll(".dcard.cur").forEach(x=>x.classList.remove("cur"));el.classList.add("cur")}});
    const pick=el.querySelector(".pick");if(pick)pick.onchange=()=>{pick.checked?Q.sel.add(id):Q.sel.delete(id);drawQueue(app,nPending,nReady)};
    const more=el.querySelector("[data-more]");if(more)more.onclick=()=>{el.querySelector(".body").classList.remove("clamp");more.remove()};
    const os=el.querySelector("[data-owner]");if(os)os.onchange=async()=>{os.disabled=true;const {data,error}=await sb.from("drafts").update({owner:os.value||null}).eq("id",id).select("id");os.disabled=false;if(error||!data||!data.length){say("Could not change the owner: "+(error?error.message:"no permission"),true);return}const r=Q.rows.find(r=>r.id===id);if(r)r.owner=os.value||null;say(os.value?`Assigned to ${os.value}.`:"Unassigned.")};
    const pc=el.querySelector('button[data-p="copy"]'), pm=el.querySelector('button[data-p="mark"]');
    if(pc) pc.onclick=async()=>{const {data}=await sb.from("drafts").select("body,edited_body").eq("id",id).single(); if(data) copyForLinkedIn(data.edited_body||data.body)};
    if(pm) pm.onclick=async()=>{
      const u=el.querySelector('input[data-p="url"]').value.trim();
      if(!/^https:\/\/([a-z]+\.)?linkedin\.com\//i.test(u)){say("Paste the LinkedIn link of the published or scheduled article first.",true);return}
      pm.disabled=true;
      const {data,error}=await sb.from("drafts").update({published_url:u,published_at:new Date().toISOString()}).eq("id",id).select("id");
      if(error||!data||!data.length){pm.disabled=false;say("Could not save: "+(error?error.message:"no permission"),true);return}
      say("Marked as published."); CR.route();
    };
    el.querySelectorAll("button[data-a]").forEach(b=>b.onclick=()=>act(el,b.dataset.a));
  });
}

async function act(el,a){
  const id=+el.dataset.id;
  if(a==="approve") return decide(el,id,{status:"approved"});
  if(a==="kill"){
    const slot=el.querySelector(".killslot");
    if(slot.innerHTML){slot.innerHTML="";return}
    slot.innerHTML=`<div class="killbox"><label class="f" style="margin-top:0">Why kill it? (optional, helps tune the jobs)</label><input type="text" placeholder="e.g. Not relevant to our ICP"><div class="row"><button class="btn danger" data-k="1">Kill draft</button><button class="btn ghost" data-k="0">Cancel</button></div></div>`;
    const inp=slot.querySelector("input");inp.focus();
    const go=()=>decide(el,id,{status:"killed",decision_note:inp.value.trim()||null});
    slot.querySelector('[data-k="1"]').onclick=go;
    slot.querySelector('[data-k="0"]').onclick=()=>{slot.innerHTML=""};
    inp.onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();go()}if(e.key==="Escape"){e.stopPropagation();slot.innerHTML=""}};
    return;
  }
  if(a==="edit"){
    const ed=el.querySelector(".editor");
    if(ed.innerHTML){ed.innerHTML="";return}
    const {data}=await sb.from("drafts").select("body,edited_body").eq("id",id).single();
    ed.innerHTML=`<textarea>${esc(data.edited_body||data.body)}</textarea><div class="dact"><button class="btn pri" data-s="1">Save and approve</button><button class="btn" data-s="0">Save draft</button><button class="btn ghost" data-s="x">Cancel</button></div>`;
    const ta=ed.querySelector("textarea");ta.focus();
    ed.querySelectorAll("button").forEach(sbtn=>sbtn.onclick=()=>{
      if(sbtn.dataset.s==="x"){ed.innerHTML="";return}
      const text=ta.value;
      decide(el,id,sbtn.dataset.s==="1"?{status:"approved",edited_body:text}:{edited_body:text},sbtn.dataset.s!=="1");
    });
  }
}

async function decide(el,id,patch,stay){
  el.querySelectorAll("button").forEach(b=>b.disabled=true);
  const {data,error}=await sb.from("drafts").update(patch).eq("id",id).select("id");
  if(error||!data||!data.length){say("Could not save: "+(error?error.message:"no permission"),true);el.querySelectorAll("button").forEach(b=>b.disabled=false);return}
  say(stay?"Edit saved.":patch.status==="approved"?"Approved.":"Killed.");
  Q.sel.delete(id);
  CR.updateCounts();
  CR.route();
}

async function bulkApprove(rows){
  if(!rows.length)return;
  const btn=document.getElementById("qbulk");if(btn){btn.disabled=true;btn.textContent="Approving…"}
  let ok=0;const fails=[];
  for(const r of rows){
    const {data,error}=await sb.from("drafts").update({status:"approved"}).eq("id",r.id).select("id");
    if(error||!data||!data.length) fails.push(`“${r.title}”: ${error?error.message:"no permission"}`); else {ok++;Q.sel.delete(r.id)}
  }
  say(`Approved ${ok} of ${rows.length}.`+(fails.length?" Not approved: "+fails.join(" · "):""),!!fails.length);
  CR.updateCounts();CR.route();
}

// keyboard shortcuts in the queue: J/K next/previous, A approve, E edit, X kill
document.addEventListener("keydown",e=>{
  if(!/^#\/queue/.test(location.hash)||e.metaKey||e.ctrlKey||e.altKey||isTyping(e)||!document.getElementById("panel").hidden)return;
  const cards=[...document.querySelectorAll("#qlist .dcard")];if(!cards.length)return;
  const k=e.key.toLowerCase();
  const setCur=i=>{Q.cur=Math.max(0,Math.min(cards.length-1,i));cards.forEach((c,j)=>c.classList.toggle("cur",j===Q.cur));cards[Q.cur].scrollIntoView({block:"nearest",behavior:"smooth"})};
  if(k==="j"){e.preventDefault();setCur(Q.cur+1)}
  else if(k==="k"){e.preventDefault();setCur(Q.cur-1)}
  else if(["a","e","x"].includes(k)){const c=cards[Q.cur];const b=c&&c.querySelector(`button[data-a="${{a:"approve",e:"edit",x:"kill"}[k]}"]`);if(b){e.preventDefault();b.click()}}
});

CR.page("queue",{title:"Approval queue",eyebrow:"Marketing",render:renderQueue});

/* =====================================================================
   CONTENT CALENDAR
   ===================================================================== */
const CAL={mode:"week",anchor:null};
const CH={brief:"Brief",newsletter:"Newsletter",podcast:"Podcast",linkedin:"LinkedIn",event:"Event",other:"Other"};
const STAGE={missing_input:"Missing input",planned:"Planned",drafted:"Drafted",approved:"Approved",published:"Published",paused:"Paused"};

async function calendarItems(start,end){
  const [jobs,eps,drafts,items]=await Promise.all([
    CR.getJobs(),
    sb.from("episodes").select("id,publish_date,title,guest_name,transcript_chars,episode_url,owner").gte("publish_date",start).lte("publish_date",end),
    sb.from("drafts").select("id,kind,title,status,created_at,published_url,owner").in("kind",["brief","newsletter","linkedin_post"]).gte("created_at",addDays(start,-10)).lte("created_at",end+"T23:59:59"),
    sb.from("calendar_items").select("*").gte("item_date",start).lte("item_date",end)]);
  const today=iso(Date.now()), out=[];
  const cad=(jobs&&jobs.cadence)||[];
  const D=drafts.data||[], E=eps.data||[];
  for(let d=start;d<=end;d=addDays(d,1)){
    for(const c of cad.filter(c=>c.dow===dow(d))){
      const it={date:d,channel:c.channel,title:c.label,owner:c.owner,derived:true,cad:c};
      if(c.status!=="live"){it.stage="paused";it.note=c.status_note||"Paused";out.push(it);continue}
      if(c.channel==="podcast"){
        const ep=E.find(e=>e.publish_date===d);it.ep=ep;
        if(ep){it.title=ep.title||c.label;it.owner=ep.owner||c.owner}
        if(!ep){it.stage="missing_input";it.note="No episode added yet"}
        else if(!((ep.transcript_chars||0)>200)){it.stage="missing_input";it.note="Transcript missing"}
        else if(d<today){it.stage="published";it.note=ep.guest_name||""}
        else{it.stage="approved";it.note="Episode and transcript in"}
      } else {
        const win=D.filter(x=>x.kind===c.channel&&x.status!=="killed"&&iso(x.created_at)<=d&&iso(x.created_at)>=addDays(d,-6)).sort((a,b)=>b.created_at.localeCompare(a.created_at));
        const dr=win[0];it.draft=dr;
        if(dr){it.title=dr.title;it.owner=dr.owner||c.owner}
        if(!dr){it.stage=d<today?"missing_input":"missing_input";it.note=d<today?"Nothing went out":"Not drafted yet"}
        else if(dr.published_url||(c.channel==="brief"&&dr.status==="approved"&&d<=today)){it.stage="published";it.note="Published"}
        else if(dr.status==="approved"){it.stage="approved";it.note=c.channel==="newsletter"?"Ready: copy for LinkedIn":"Approved"}
        else{it.stage="drafted";it.note="Waiting for approval"}
      }
      out.push(it);
    }
  }
  for(const x of items.data||[]) out.push({date:x.item_date,channel:x.channel,title:x.title,owner:x.owner,stage:x.stage,note:STAGE[x.stage],row:x});
  return out;
}

function citem(it,i){return `<button class="citem ${it.stage}" data-ci="${i}" title="${esc(it.title)}"><b>${esc(CH[it.channel]||it.channel)}: ${esc(it.title)}</b><span class="st">${esc(STAGE[it.stage]||it.stage)}${it.owner?" · "+esc(it.owner):""}</span></button>`}

async function renderCalendar(app,q,alive){
  const today=iso(Date.now());
  if(q.d)CAL.anchor=q.d;if(q.m)CAL.mode=q.m;
  if(!CAL.anchor)CAL.anchor=mondayOf(today);
  let start,end,first;
  if(CAL.mode==="week"){start=mondayOf(CAL.anchor);end=addDays(start,6)}
  else{first=CAL.anchor.slice(0,8)+"01";start=mondayOf(first);const last=iso(new Date(+first.slice(0,4),+first.slice(5,7),0));end=addDays(mondayOf(last),6)}
  CR.head(`<button class="btn pri" id="caladd">+ Add item</button>`);
  document.getElementById("caladd").onclick=()=>itemForm({item_date:today,channel:"linkedin",stage:"planned",owner:CR.me().name==="Sarah"?"Sarah":"Josh"});
  const items=await calendarItems(start,end);
  if(!alive())return;
  const label=CAL.mode==="week"?`${fmtShort(start)} to ${fmtShort(end)}`:new Date(first+"T12:00:00").toLocaleDateString("en-GB",{month:"long",year:"numeric"});
  const days=[];for(let d=start;d<=end;d=addDays(d,1))days.push(d);
  const curMonth=first?first.slice(0,7):null;
  app.innerHTML=`<div class="qbar"><div class="row"><div class="tabs"><button data-m="week" class="${CAL.mode==="week"?"on":""}">Week</button><button data-m="month" class="${CAL.mode==="month"?"on":""}">Month</button></div>
      <button class="btn sm" data-n="-1" aria-label="Previous">‹</button><button class="btn sm" data-n="0">Today</button><button class="btn sm" data-n="1" aria-label="Next">›</button><b style="margin-left:6px">${esc(label)}</b></div>
      <div class="legend">${["missing_input","drafted","approved","published","paused"].map(s=>`<span class="row" style="gap:4px"><span class="citem ${s}" style="padding:0;width:10px;height:10px;display:inline-block"></span>${STAGE[s]}</span>`).join("")}</div></div>
    <div class="cal ${CAL.mode}">${["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d=>`<div class="dh">${d}</div>`).join("")}
    ${days.map(d=>{const its=items.map((it,i)=>[it,i]).filter(([it])=>it.date===d);const out=curMonth&&d.slice(0,7)!==curMonth;
      return `<div class="cday${d===today?" today":""}${out?" out":""}${its.length?" has":""}"><div class="dn"><span>${new Date(d+"T12:00:00").toLocaleDateString("en-GB",{weekday:"short",day:"numeric"})}</span></div>${its.map(([it,i])=>citem(it,i)).join("")}</div>`}).join("")}</div>
    <p class="muted small" style="margin-top:12px">Podcast, newsletter and Brief slots come from the publishing rhythm on How it runs; paused jobs show as paused. Add LinkedIn posts and other one-offs with + Add item.</p>`;
  app.querySelectorAll("[data-m]").forEach(b=>b.onclick=()=>{CAL.mode=b.dataset.m;CR.route()});
  app.querySelectorAll("[data-n]").forEach(b=>b.onclick=()=>{const n=+b.dataset.n;
    if(n===0)CAL.anchor=CAL.mode==="week"?mondayOf(today):today.slice(0,8)+"01";
    else if(CAL.mode==="week")CAL.anchor=addDays(mondayOf(CAL.anchor),7*n);
    else{const d=new Date(CAL.anchor.slice(0,8)+"01T12:00:00");d.setMonth(d.getMonth()+n);CAL.anchor=iso(d)}
    CR.route()});
  app.querySelectorAll("[data-ci]").forEach(b=>b.onclick=()=>{const it=items[+b.dataset.ci];if(it.row)itemForm(it.row);else derivedPanel(it)});
}
CR.calendarItems=calendarItems; CR.citem=citem; CR.STAGE=STAGE; CR.CH=CH;

function derivedPanel(it){
  const link=it.channel==="podcast"?`<a class="btn pri" href="#/episodes">Open Episodes</a>`:it.draft?`<a class="btn pri" href="#/queue${it.draft.status==="approved"&&!it.draft.published_url?"?view=ready":""}">Open the queue</a>`:"";
  panel(esc(CH[it.channel]||it.channel)+" · "+esc(fmtDate(it.date)),`
    <div class="dmeta">${pill(it.stage,STAGE[it.stage])}${who(it.owner)}</div>
    <h3>${esc(it.title)}</h3><p class="muted">${esc(it.note||"")}</p>
    ${it.cad&&it.cad.input_needed?`<dl class="kv"><dt>Needs</dt><dd>${esc(it.cad.input_needed)}</dd></dl>`:""}
    <div class="dact">${link}</div>`);
}

function itemForm(r){
  const body=panel(r.id?"Edit calendar item":"Add to the calendar",`<div class="form">
    <label class="f">Date</label><input type="date" name="item_date" value="${esc(r.item_date||"")}">
    <label class="f">Channel</label><select name="channel">${Object.entries(CH).map(([k,v])=>`<option value="${k}"${r.channel===k?" selected":""}>${v}</option>`).join("")}</select>
    <label class="f">Title</label><input type="text" name="title" value="${esc(r.title||"")}" placeholder="e.g. Post: what HR leaders get wrong about grid hiring">
    <label class="f">Owner</label>${ownerSel(r.owner,'name="owner"')}
    <label class="f">Stage</label><select name="stage">${Object.entries(STAGE).map(([k,v])=>`<option value="${k}"${r.stage===k?" selected":""}>${v}</option>`).join("")}</select>
    <label class="f">Link (once live, optional)</label><input type="url" name="link_url" value="${esc(r.link_url||"")}">
    <label class="f">Notes</label><textarea name="notes">${esc(r.notes||"")}</textarea>
    <div class="dact"><button class="btn pri" data-save>Save</button>${r.id?'<button class="btn danger" data-del>Delete</button>':""}</div></div>`);
  const f=n=>body.querySelector(`[name=${n}]`);
  body.querySelector("[data-save]").onclick=async e=>{
    const rec={item_date:f("item_date").value,channel:f("channel").value,title:f("title").value.trim(),owner:f("owner").value||null,stage:f("stage").value,link_url:f("link_url").value.trim()||null,notes:f("notes").value.trim()||null,updated_at:new Date().toISOString()};
    if(!rec.item_date||!rec.title){say("A date and a title are needed.",true);return}
    if(rec.link_url&&!safeUrl(rec.link_url)){say("The link should start with https://",true);return}
    e.target.disabled=true;
    const {error}=r.id?await sb.from("calendar_items").update(rec).eq("id",r.id).select("id"):await sb.from("calendar_items").insert(rec).select("id");
    e.target.disabled=false;
    if(error){say("Could not save: "+error.message,true);return}
    say("Saved to the calendar.");closePanel();CR.route();
  };
  const del=body.querySelector("[data-del]");if(del)del.onclick=async()=>{if(!confirm("Delete this calendar item?"))return;const {error}=await sb.from("calendar_items").delete().eq("id",r.id);if(error){say("Could not delete: "+error.message,true);return}say("Deleted.");closePanel();CR.route()};
}
CR.itemForm=itemForm;

CR.page("calendar",{title:"Content calendar",eyebrow:"Marketing",render:renderCalendar});

/* =====================================================================
   EPISODES (save logic unchanged from v1; owner added)
   ===================================================================== */
function nextTuesday(){const d=new Date();d.setDate(d.getDate()+((9-d.getDay())%7||7));return iso(d)}
function epForm(e){
  return `<div class="form">
    <label class="f">Publish date (Tuesday)</label><input type="date" name="publish_date" value="${esc(e.publish_date||"")}">
    <label class="f">Episode title</label><input type="text" name="title" value="${esc(e.title||"")}">
    <label class="f">Guest name</label><input type="text" name="guest_name" value="${esc(e.guest_name||"")}">
    <label class="f">Guest role</label><input type="text" name="guest_role" value="${esc(e.guest_role||"")}">
    <label class="f">Guest company</label><input type="text" name="guest_company" value="${esc(e.guest_company||"")}">
    <label class="f">Episode link (once live, optional)</label><input type="text" name="episode_url" value="${esc(e.episode_url||"")}">
    <label class="f">Transcript from Riverside: choose the .txt or .srt file${e.transcript_filename?" (current: "+esc(e.transcript_filename)+")":""}</label><input type="file" name="file" accept=".txt,.srt,.vtt,text/plain">
    <label class="f">Or paste the transcript</label><textarea name="transcript" placeholder="Paste here if you are not uploading a file"></textarea>
    <label class="f">Notes for the newsletter (optional)</label><input type="text" name="notes" value="${esc(e.notes||"")}">
    <label class="f">Owner</label><select name="owner"><option${(e.owner||"Sarah")==="Sarah"?" selected":""}>Sarah</option><option${e.owner==="Josh"?" selected":""}>Josh</option></select>
    <div class="dact"><button class="btn pri" data-save="1">Save episode</button></div></div>`;
}
function bindEpForm(root,id){
  root.querySelector("button[data-save]").onclick=async(ev)=>{
    const btn=ev.target, f=n=>root.querySelector(`[name=${n}]`);
    const rec={publish_date:f("publish_date").value,title:f("title").value.trim(),guest_name:f("guest_name").value.trim(),guest_role:f("guest_role").value.trim()||null,guest_company:f("guest_company").value.trim()||null,episode_url:f("episode_url").value.trim()||null,notes:f("notes").value.trim()||null,owner:f("owner").value};
    if(!rec.publish_date||!rec.title||!rec.guest_name){say("Publish date, title and guest name are needed.",true);return}
    if(new Date(rec.publish_date+"T12:00:00").getDay()!==2&&!confirm("That date is not a Tuesday. Save anyway?"))return;
    const file=f("file").files[0], pasted=f("transcript").value.trim();
    if(file){
      if(/\.docx?$|\.pdf$/i.test(file.name)){say("Please export the transcript from Riverside as .txt or .srt.",true);return}
      rec.transcript=await file.text(); rec.transcript_filename=file.name;
    } else if(pasted){rec.transcript=pasted; rec.transcript_filename="pasted"}
    btn.disabled=true;
    const q=id?sb.from("episodes").update(rec).eq("id",id):sb.from("episodes").insert(rec);
    const {error}=await q.select("id");
    btn.disabled=false;
    if(error){say("Could not save: "+(/duplicate/i.test(error.message)?"there is already an episode on that date.":error.message),true);return}
    say("Episode saved."); closePanel(); CR.route();
  };
}
async function renderEpisodes(app,q,alive){
  CR.head(`<button class="btn pri" id="epadd">+ Add an episode</button>`);
  document.getElementById("epadd").onclick=()=>{const b=panel("Add an episode",epForm({publish_date:nextTuesday(),owner:"Sarah"}));bindEpForm(b,null)};
  const {data,error}=await sb.from("episodes").select("id,publish_date,title,guest_name,guest_role,guest_company,episode_url,transcript_filename,notes,added_by,updated_at,transcript_chars,owner").order("publish_date",{ascending:false}).limit(100);
  if(!alive())return;
  if(error){app.innerHTML=empty("Could not load episodes.",error.message);return}
  const today=iso(Date.now()), rows=data||[];
  const next=rows.filter(e=>e.publish_date>=today).sort((a,b)=>a.publish_date.localeCompare(b.publish_date))[0];
  const nextOk=next&&(next.transcript_chars||0)>200;
  app.innerHTML=`<div class="tiles" style="margin-bottom:14px">
      <div class="tile${next&&!nextOk||!next?" act":""}" style="cursor:default"><div class="k">Next episode</div><div class="v" style="font-size:17px">${next?esc(fmtDate(next.publish_date)):"None added"}</div><div class="s">${next?(nextOk?"Transcript in":"Transcript missing: the newsletter draft needs it"):"Add Tuesday's episode so the newsletter can be drafted"}</div></div>
      <div class="tile" style="cursor:default"><div class="k">Episodes</div><div class="v">${rows.length}</div><div class="s">${rows.filter(e=>(e.transcript_chars||0)>200).length} with transcripts</div></div></div>
    <div id="eptable">${rows.length?"":empty("No episodes yet.","Add the next Tuesday episode and its Riverside transcript. The newsletter draft is written from it.",'<button class="btn pri" id="epadd2">+ Add an episode</button>')}</div>`;
  const a2=document.getElementById("epadd2");if(a2)a2.onclick=()=>document.getElementById("epadd").click();
  if(!rows.length)return;
  CR.table(document.getElementById("eptable"),{rows,key:"publish_date",dir:-1,rowId:r=>r.id,
    cols:[{k:"publish_date",h:"Date",render:r=>`<span class="strong">${esc(fmtDate(r.publish_date))}</span>`},
      {k:"title",h:"Episode",render:r=>`<span class="strong">${esc(r.title)}</span><span class="sub">${esc(r.guest_name)}${r.guest_company?", "+esc(r.guest_company):""}</span>`},
      {k:"transcript_chars",h:"Transcript",num:false,render:r=>(r.transcript_chars||0)>200?pill("approved","Added"):pill("missing_input","Missing")},
      {k:"stage",h:"Status",hideM:true,sort:r=>r.publish_date>=today?1:0,render:r=>r.publish_date>=today?pill("draft","Upcoming"):pill("published","Published")},
      {k:"owner",h:"Owner",hideM:true,render:r=>who(r.owner)}],
    onRow:async r=>{const {data:e}=await sb.from("episodes").select("*").eq("id",r.id).single();if(!e)return;const b=panel("Edit or replace transcript",`<p class="muted" style="margin-top:0">${esc(e.title)}${e.transcript_filename?" · file: "+esc(e.transcript_filename):""}</p>`+epForm(e));bindEpForm(b,e.id)}});
}
CR.page("episodes",{title:"Episodes",eyebrow:"Marketing · Solving Infrastructure",render:renderEpisodes});

/* =====================================================================
   HUBS (checklist logic unchanged; copy updated for HR-only)
   ===================================================================== */
const PREVIEW_URL="https://claude.ai/artifact/GhhDgqitAradyNYXkqvyff";
const SITE=[{t:"HR Leaders in Infrastructure: home",p:"../"},{t:"Resources",p:"../resources/"},{t:"Voices",p:"../voices/"},{t:"Community",p:"../community/"}];
async function renderHubs(app,q,alive){
  const [{data:tasks,error:te},{data:members}]=await Promise.all([
    sb.from("hub_launch_tasks").select("*").order("sort"),
    sb.from("hub_members").select("hub,tier,active,inner_requested_at,inner_approved_at")]);
  if(!alive())return;
  if(te){app.innerHTML=empty("Could not load the checklist.",te.message);return}
  const active=(members||[]).filter(m=>m.active);
  const done=tasks.filter(t=>t.done).length, pct=tasks.length?Math.round(done/tasks.length*100):0;
  const areas=[...new Set(tasks.map(t=>t.area))];
  const open=tasks.filter(t=>!t.done);
  app.innerHTML=`<div class="grid3" style="margin-bottom:18px">
      <div class="card"><div class="eyebrow">Live site</div><h3>HR Leaders in Infrastructure</h3><p class="muted" style="margin:0">One hub (HR). Finance and Asset Management were dropped on 23 Oct. Live but unannounced; moves to hubs.sonderandmetric.com once the domain is set up.</p>
        <ul class="hb-links">${SITE.map((s,i)=>`<li><a href="${s.p}" target="_blank" rel="noopener">${esc(s.t)}</a><span data-i="${i}">${pill("draft","Checking…")}</span></li>`).join("")}</ul></div>
      <div class="card"><div class="eyebrow">Members</div><h3>${plural(active.length,"member")}</h3><p class="muted" style="margin:0">Community requests from the HR hub join form.</p>
        <p class="muted small">Page source lives in the <a href="${PREVIEW_URL}" target="_blank" rel="noopener">hubs preview artifact ↗</a> (src/).</p></div>
      <div class="card"><div class="eyebrow">Launch checklist</div><h3>${done} of ${tasks.length} done</h3><div class="hb-prog" style="margin:6px 0 0"><div class="hb-bar"><i style="width:${pct}%"></i></div><span>${pct}%</span></div>
        <p class="muted small" style="margin-bottom:0">Josh: ${open.filter(t=>t.assignee==="Josh").length} open · Sarah: ${open.filter(t=>t.assignee==="Sarah").length} open</p></div></div>
    ${areas.map(a=>`<div class="sec">${esc(a)}</div>`+tasks.filter(t=>t.area===a).map(t=>`
      <div class="hb-task ${t.done?"done":""}">
        <input type="checkbox" data-id="${t.id}" ${t.done?"checked":""} aria-label="Done">
        <div><b>${esc(t.item)}</b>${t.detail?`<span class="d">${esc(t.detail)}</span>`:""}${t.done&&t.done_at?`<small>Done ${esc(fmtShort(t.done_at))}${t.done_by?` by ${esc(t.done_by)}`:""}</small>`:""}${/Claude/.test(t.owner)?`<span class="tag" style="margin-top:4px">Claude does the work</span>`:""}</div>
        <span class="row small"><span class="muted hide-m">Owner</span><select data-as="${t.id}"><option${t.assignee==="Josh"?" selected":""}>Josh</option><option${t.assignee==="Sarah"?" selected":""}>Sarah</option></select></span>
      </div>`).join("")).join("")}`;
  app.querySelectorAll(".hb-task input[type=checkbox]").forEach(cb=>cb.onchange=async()=>{
    cb.disabled=true;
    const {error}=await sb.from("hub_launch_tasks").update({done:cb.checked}).eq("id",+cb.dataset.id);
    if(error){cb.checked=!cb.checked;cb.disabled=false;say("Could not save that tick.",true);return}
    CR.route();
  });
  app.querySelectorAll("select[data-as]").forEach(s=>s.onchange=async()=>{
    s.disabled=true;const {error}=await sb.from("hub_launch_tasks").update({assignee:s.value}).eq("id",+s.dataset.as);s.disabled=false;
    if(error){say("Could not change the owner: "+error.message,true);return}say(`Assigned to ${s.value}.`)});
  SITE.forEach(async(s,i)=>{
    const el=app.querySelector(`[data-i="${i}"]`);
    try{const r=await fetch(s.p,{cache:"no-store"});el.innerHTML=r.ok?pill("live","Live"):pill("retired","Not live yet")}
    catch(_){el.innerHTML=pill("retired","Not live yet")}
  });
}
CR.page("hubs",{title:"Hubs",eyebrow:"Marketing · Leadership hubs",render:renderHubs});
})();
