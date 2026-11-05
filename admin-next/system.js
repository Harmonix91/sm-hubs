/* Control room v2: System (Job health, How it runs). Job text comes from private.job_specs via jobs_overview(). */
(function(){
const {sb,esc,fmt,fmtShort,say,plural,pill,who,empty,GOOD,HLABEL}=CR;
const DAYS=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const hhmm=t=>t?String(t).slice(0,5):"";
const RUNS={mac:"Josh's Mac (Claude open)",supabase:"Supabase (always on)",cloud:"Cloud"};

/* =====================================================================
   JOB HEALTH (logic unchanged from v1)
   ===================================================================== */
function remedyBox(j,slot,title){
  if(!j.remedy) return "";
  const attrs=`data-res="1" data-job="${esc(j.job)}" data-slot="${esc(slot)}" data-run="${j.run_id||""}"`;
  if(j.resolved) return `<div class="remedy done"><b>Remedy done</b>Ticked by ${esc(j.resolved_by||"")}${j.resolved_at?" on "+esc(fmt(j.resolved_at)):""}. <label class="tick"><input type="checkbox" checked ${attrs}> Done</label></div>`;
  return `<div class="remedy"><b>${esc(title)}</b>${esc(j.remedy)}<label class="tick"><input type="checkbox" ${attrs}> I've done this</label></div>`;
}
async function renderHealth(app,q,alive){
  const d=await CR.getHealth(true);
  if(!alive())return;
  if(!d){app.innerHTML='<div class="health warn">Job health could not be checked just now.</div>';return}
  CR.updateCounts();
  const bad=d.jobs.filter(j=>!GOOD.includes(j.state)&&!j.resolved);
  const top=`<div class="health ${bad.length?"bad":"good"}"><strong>${bad.length?`Latest runs: ${bad.length} job${bad.length>1?"s":""} need attention (${bad.map(j=>esc(j.label)).join(", ")})`:"Latest runs: all scheduled jobs ran, or their remedies are done"}</strong><div class="muted">Checked ${esc(fmt(d.checked_at))}. Jobs only run while the Mac is awake with Claude open. Runs stuck for over 3 hours are marked failed automatically. Paused jobs are not checked.</div>${bad.map(j=>remedyBox(j,j.expected_at,j.label+": what to do")).join("")}</div>`;
  app.innerHTML=top+CR.skel("row",6);
  const {data:hist,error}=await sb.rpc("health_history",{p_days:30});
  if(!alive())return;
  if(error||!hist){app.innerHTML=top+'<div class="health warn">Run history could not be loaded.</div>';return}
  const dayLabel=s=>new Date(s+"T12:00:00").toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"});
  const tfmt=s=>new Date(s).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"});
  const days=hist.map(day=>{
    const items=day.items.map(j=>`<div class="hitem"><div class="dmeta">${pill(GOOD.includes(j.state)?(j.state==="running"?"running":"ok"):"failed",HLABEL[j.state]||j.state)}<span class="tag">${esc(j.schedule)}</span>${j.run_id?`<span class="tag">Run ${j.run_id}</span>`:""}${j.credits>0?`<span class="tag">${esc(j.credits)} credits</span>`:""}</div>
      <strong>${esc(j.label)}</strong> <span class="muted">${esc(tfmt(j.at))}${j.finished_at?" to "+esc(tfmt(j.finished_at)):""}${j.items_found!=null&&j.run_id?` · ${j.items_found} found, ${j.items_saved??0} saved`:""}</span>${j.detail?`<div class="muted" style="margin-top:4px">${esc(j.detail)}</div>`:""}${remedyBox(j,j.slot_at,"What to do")}</div>`).join("");
    return `<details class="hday"><summary><span class="dot ${day.problems?"r":"g"}"></span>${esc(dayLabel(day.date))}<span class="muted"> · ${day.items.length} run${day.items.length>1?"s":""}</span>${day.problems?` <span class="badge">${day.problems}</span>`:""}</summary>${items}</details>`;
  }).join("");
  app.innerHTML=top+`<div class="sec">Run history, last 30 days</div>`+(days||empty("No runs yet.",""));
  app.querySelectorAll("input[data-res]").forEach(cb=>cb.onchange=async()=>{
    cb.disabled=true;
    const {error}=await sb.rpc("resolve_health_item",{p_job:cb.dataset.job,p_slot:cb.dataset.slot,p_run_id:cb.dataset.run?+cb.dataset.run:null,p_undo:!cb.checked});
    if(error){cb.disabled=false;cb.checked=!cb.checked;say("Could not save: "+error.message,true);return}
    say(cb.checked?"Marked as done.":"Marked as not done."); CR.resetHealth(); CR.route();
  });
}
CR.page("health",{title:"Job health",eyebrow:"System · Scheduled jobs",render:renderHealth});

/* =====================================================================
   HOW IT RUNS (generated from private.job_specs and content_cadence)
   ===================================================================== */
function weekRows(J){
  const jobs=J.jobs.filter(j=>j.status!=="retired"&&j.runs_on!=="supabase"), cad=J.cadence;
  return DAYS.map((name,i)=>{
    const d=i+1;
    const its=[
      ...cad.filter(c=>c.dow===d).map(c=>({t:c.at?hhmm(c.at):"",txt:c.label+" goes out",st:c.status,owner:c.owner})),
      ...jobs.filter(j=>(j.dows||[]).includes(d)).map(j=>({t:hhmm(j.at),txt:j.label,st:j.status,owner:null}))
    ].sort((a,b)=>(a.t||"00").localeCompare(b.t||"00"));
    return {name,its};
  }).filter(r=>r.its.length);
}
CR.weekRows=weekRows;
function weekHtml(J){
  return `<div class="card" style="padding:0">${weekRows(J).map(r=>`<div class="weekrow"><span class="d">${r.name}</span><span class="it">${r.its.map(x=>`<span>${x.st==="live"?"":pill(x.st)}<span class="${x.st==="live"?"":"paused-txt"}">${x.t?`<b>${esc(x.t)}</b> `:""}${esc(x.txt)}</span>${x.owner&&x.st==="live"?who(x.owner):""}</span>`).join("")}</span></div>`).join("")}</div>`;
}
CR.weekHtml=weekHtml;
function jobRow(j){
  const lr=j.last_run;
  return `<div class="job"><div><span class="jn">${esc(j.label)}</span> <span class="muted small">· ${esc(j.schedule)}</span></div>
    <div class="row" style="justify-content:flex-end">${pill(j.status)}${j.owner?who(j.owner):""}</div>
    <div class="jd">${esc(j.description||"")}${j.status_note?`<br><span class="small"><b>${esc(j.status==="paused"?"Paused":"Note")}${j.status_changed_on?" "+esc(fmtShort(j.status_changed_on)):""}:</b> ${esc(j.status_note)}</span>`:""}</div>
    ${(j.feeds_into||[]).length?`<div class="flow"><span style="background:none;padding:0" class="muted">Feeds</span>${j.feeds_into.map(f=>`<span>${esc(f)}</span>`).join("<i>→</i>")}</div>`:""}
    <div class="jd small">Runs on: ${j.runs_on==="mac"?`<b style="color:var(--orange-ink)">${esc(RUNS.mac)}</b>`:esc(RUNS[j.runs_on]||j.runs_on)}${j.task_name?` · task: ${esc(j.task_name)}`:""}${lr?` · last run ${esc(fmt(lr.started_at))} (${esc(HLABEL[lr.status]||lr.status)}${lr.items_found!=null?`, ${lr.items_found} found`:""})`:""}</div></div>`;
}
async function renderHow(app,q,alive){
  const J=await CR.getJobs(true);
  if(!alive())return;
  if(!J){app.innerHTML=empty("Could not load the job list.","");return}
  const by=s=>J.jobs.filter(j=>j.status===s);
  const mac=J.jobs.filter(j=>j.status==="live"&&j.runs_on==="mac");
  app.innerHTML=`<p class="muted" style="margin-top:0;max-width:720px">Every job drafts into the approval queue. Nothing is published or sent without approval. This page is generated from the job list in Supabase, so pausing or retiring a job updates it here, on Today and on the calendar.</p>
    <div class="sec">The week</div>${weekHtml(J)}
    <div class="sec">Live jobs <span class="muted">${by("live").length}</span></div><div class="card" style="padding:0">${by("live").map(jobRow).join("")}</div>
    ${by("paused").length?`<div class="sec">Paused <span class="muted">${by("paused").length}</span></div><div class="card" style="padding:0">${by("paused").map(jobRow).join("")}</div>`:""}
    ${by("retired").length?`<details style="margin-top:18px"><summary class="sec" style="cursor:pointer;margin:0">Retired <span class="muted">${by("retired").length}</span></summary><div class="card" style="padding:0;margin-top:8px">${by("retired").map(jobRow).join("")}</div></details>`:""}
    <div class="sec">Depends on Josh's Mac</div>
    <div class="card"><p style="margin:0 0 6px">${plural(mac.length,"live job")} only run while Josh's Mac is awake with Claude open: ${mac.map(j=>esc(j.label)).join(", ")}. A missed job runs when Claude next opens. Only the health check runs inside Supabase.</p><p class="muted small" style="margin:0">See the handover note in the masterplan for what would need to move so the jobs keep running when Sarah operates them.</p></div>`;
}
CR.page("howitruns",{title:"How it runs",eyebrow:"System",render:renderHow});
})();
