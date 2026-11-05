/* Control room v2: Today (headline numbers, Needs you now for Josh and Sarah, this week, job alerts). */
(function(){
const {sb,esc,fmtShort,iso,daysAgo,addDays,mondayOf,plural,pill,empty,GOOD,HLABEL}=CR;

async function renderToday(app,q,alive){
  const H={count:"exact",head:true};
  const cnt=p=>Promise.resolve(p).then(r=>r.error?null:r.count).catch(()=>null);
  const rows=p=>Promise.resolve(p).then(r=>r.error?null:r.data).catch(()=>null);
  const today=iso(Date.now()), week=daysAgo(7), mon=mondayOf(today), sun=addDays(mon,6);
  const [pending,ready,openRoles,newRoles,moves7,news7,health,jobs,eps,hub,calItems]=await Promise.all([
    rows(sb.from("drafts").select("id,owner,kind").eq("status","pending")),
    rows(sb.from("drafts").select("id,owner").eq("status","approved").eq("kind","newsletter").is("published_url",null)),
    cnt(sb.from("vacancies").select("id",H).is("closed_on",null)),
    cnt(sb.from("vacancies").select("id",H).gte("first_seen",week)),
    cnt(sb.from("appointments").select("id",H).gte("announced_date",week)),
    cnt(sb.from("news_items").select("id",H).gte("published_date",week).gte("relevance",3)),
    Promise.resolve(CR.getHealth(true)).catch(()=>null),
    Promise.resolve(CR.getJobs(true)).catch(()=>null),
    rows(sb.from("episodes").select("publish_date,title,transcript_chars,owner").gte("publish_date",today).lte("publish_date",addDays(today,8)).order("publish_date")),
    rows(sb.from("hub_launch_tasks").select("assignee,done")),
    Promise.resolve(CR.calendarItems(mon,sun)).catch(()=>null)
  ]);
  if(!alive())return;
  const n=v=>v==null?"–":v;
  const bad=health?health.jobs.filter(j=>!GOOD.includes(j.state)&&!j.resolved):[];
  const jobOwner=j=>{const s=jobs&&jobs.jobs.find(x=>x.job===j.job);return s&&s.owner||""};
  const cad=jobs?jobs.cadence:[];
  const podLive=cad.some(c=>c.channel==="podcast"&&c.status==="live");

  /* ---- Needs you now ---- */
  const need={Josh:[],Sarah:[],"":[]};
  const add=(o,item)=>(need[o||""]||need[""]).push(item);
  if(pending){const g={};pending.forEach(d=>{g[d.owner||""]=(g[d.owner||""]||0)+1});
    Object.entries(g).forEach(([o,c])=>add(o,{act:1,t:`${plural(c,"draft")} to review`,h:`#/queue?view=pending${o?"&owner="+o:"&owner=either"}`}))}
  if(ready&&ready.length){const g={};ready.forEach(d=>{g[d.owner||""]=(g[d.owner||""]||0)+1});
    Object.entries(g).forEach(([o,c])=>add(o,{act:1,t:`${plural(c,"newsletter")} ready to post on LinkedIn`,h:"#/queue?view=ready"}))}
  bad.forEach(j=>add(jobOwner(j),{act:1,t:`${j.label}: ${(HLABEL[j.state]||j.state).toLowerCase()}`,h:"#/health"}));
  const nextTue=(()=>{let d=today;while(CR.dow(d)!==2)d=addDays(d,1);return d})();
  const ep=(eps||[]).find(e=>e.publish_date===nextTue);
  if(podLive&&eps){
    if(!ep&&addDays(today,7)>=nextTue) add("Sarah",{act:1,t:`Add the ${fmtShort(nextTue)} episode and transcript`,h:"#/episodes"});
    else if(ep&&!((ep.transcript_chars||0)>200)) add(ep.owner||"Sarah",{act:1,t:`Transcript missing for the ${fmtShort(ep.publish_date)} episode`,h:"#/episodes"});
  }
  (calItems||[]).filter(it=>it.row&&it.stage==="missing_input"&&it.date>=today).forEach(it=>add(it.owner,{act:1,t:`${it.title}: input missing (${fmtShort(it.date)})`,h:"#/calendar"}));
  if(hub){const g={};hub.filter(t=>!t.done).forEach(t=>{g[t.assignee||""]=(g[t.assignee||""]||0)+1});
    Object.entries(g).forEach(([o,c])=>add(o,{t:`${plural(c,"hub launch item")} open`,h:"#/hubs"}))}
  const col=(name,label)=>{const its=need[name];
    return `<div class="ncol"><h3>${name?`<span class="who ${name}"><i>${name[0]}</i></span>`:""}${esc(label)}</h3>${its.length?its.map(x=>`<a class="nitem${x.act?" act":""}" href="${x.h}"><span>${x.act?"<b>":""}${esc(x.t)}${x.act?"</b>":""}</span><span class="go">→</span></a>`).join(""):`<div class="nclear">Nothing waiting</div>`}</div>`};
  const meName=CR.me().name;
  const order=meName==="Sarah"?[["Sarah","Sarah"],["Josh","Josh"]]:[["Josh","Josh"],["Sarah","Sarah"]];

  /* ---- KPI tiles ---- */
  const tile=(k,v,s,h,act)=>`<a class="tile${act?" act":""}" href="${h}" style="text-decoration:none"><div class="k">${esc(k)}</div><div class="v">${v}</div><div class="s">${esc(s)}</div></a>`;
  const pend=pending?pending.length:null;

  /* ---- this week ---- */
  const days=[];for(let d=mon;d<=sun;d=addDays(d,1))days.push(d);
  const weekCal=calItems?`<div class="cal">${["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d=>`<div class="dh">${d}</div>`).join("")}${days.map(d=>{const its=calItems.map((it,i)=>[it,i]).filter(([it])=>it.date===d);
      return `<div class="cday${d===today?" today":""}${its.length?" has":""}" style="min-height:84px"><div class="dn"><span>${new Date(d+"T12:00:00").toLocaleDateString("en-GB",{weekday:"short",day:"numeric"})}</span></div>${its.map(([it,i])=>CR.citem(it,i)).join("")}</div>`}).join("")}</div>`:empty("Could not load this week.","");

  /* ---- job alerts ---- */
  const paused=jobs?jobs.jobs.filter(j=>j.status==="paused"):[];
  const alerts=`${bad.length?bad.map(j=>`<a class="nitem act" href="#/health"><span>${pill("failed",HLABEL[j.state]||j.state)} <b>${esc(j.label)}</b> <span class="muted">${esc(j.schedule)}</span></span><span class="go">→</span></a>`).join(""):`<div class="nclear">${health?"Every live job ran on time":"Job health could not be checked"}</div>`}
    ${paused.length?`<p class="muted small" style="margin:8px 2px 0">${pill("paused")} ${paused.map(j=>esc(j.label)).join(", ")} <a href="#/howitruns">How it runs</a></p>`:""}`;

  app.innerHTML=`<div class="tiles">
      ${tile("To review",n(pend),"drafts in the queue","#/queue",pend>0)}
      ${tile("Ready to publish",n(ready&&ready.length),"newsletters for LinkedIn","#/queue?view=ready",ready&&ready.length>0)}
      ${tile("Open senior roles",n(openRoles),`${n(newRoles)} new this week`,"#/roles")}
      ${tile("Moves this week",n(moves7),"senior appointments","#/movers")}
      ${tile("News this week",n(news7),"stories scored 3+","#/news")}
      ${tile("Job alerts",health?bad.length:"–",bad.length?"need attention":"all ran","#/health",bad.length>0)}</div>
    <div class="sec">Needs you now</div>
    <div class="needs">${col(order[0][0],order[0][1])}${col(order[1][0],order[1][1])}${need[""].length?col("","Either of you"):""}</div>
    <div class="sec">This week <a class="muted" href="#/calendar" style="margin-left:auto;letter-spacing:0;text-transform:none;font-weight:500">Open the calendar →</a></div>
    ${weekCal}
    <div class="sec">Job alerts</div>${alerts}`;
  app.querySelectorAll("[data-ci]").forEach(b=>b.onclick=()=>CR.go("calendar"));
}
CR.page("today",{title:"Today",eyebrow:"Control room",render:renderToday});
})();
