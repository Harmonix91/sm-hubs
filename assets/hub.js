/* HR Hub: shared script for every page (home, resources, voices, community).
   Each page's <body data-page="..."> says which parts to fill. Pages render at once; data fills in after. */
(function(){
const API = "https://hmjebqoeqffqljfyasys.supabase.co/rest/v1/rpc/";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtamVicW9lcWZmcWxqZnlhc3lzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyNjc2MzEsImV4cCI6MjEwNzg0MzYzMX0.OZMx5dlkf4yp0akhU92t_K5BDN2N9hDhZeh-PzF7B2g"; // public key; data protected by row-level security
const HUB = "hr";
const PAGE = document.body.dataset.page || "home";
const ROOT = document.body.dataset.root || "./";
const LEVEL = {c_suite:"C-suite", director:"Director", head_of:"Head of"};
const MOVE = {external_hire:"Appointment", internal_promotion:"Promotion", departure:"Departure", board:"Board", interim:"Interim"};
const TOOLS = [
  {id:"scorecard", t:"Senior hiring scorecard", d:"The scorecard we use on CHRO, People Director and Head of Talent searches, with weightings by business stage."},
  {id:"interview-bank", t:"Interview bank", d:"Questions for each capability on the scorecard, and what strong and weak answers sound like."},
  {id:"first-90", t:"First 90 days guide", d:"What a new HR leader should agree with the CEO and the fund before day one, and the first 90 days after it."}
];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const safe = u => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : null; } catch { return null; } };
const fmtD = (d, o={day:"numeric",month:"short"}) => d ? new Date(String(d).length===10 ? d+"T12:00:00" : d).toLocaleDateString("en-GB", o) : "";
const para = s => esc(s).split(/\n{2,}/).map(p => "<p>" + p.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/\n/g,"<br>") + "</p>").join("");
const $ = s => document.querySelector(s);
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const rpc = (fn, body) => fetch(API + fn, {method:"POST", headers:{"apikey":KEY, "Authorization":"Bearer "+KEY, "Content-Type":"application/json"}, body:JSON.stringify(body)}).then(r => r.ok ? r.json() : Promise.reject(r.status));

let D = null, tab = (location.hash.replace("#","") || "seats");
if (!["seats","moves","news"].includes(tab)) tab = "seats";

/* nav: mark the current page */
document.querySelectorAll(".links a[data-p]").forEach(a => a.classList.toggle("on", a.dataset.p === PAGE));

/* ---------- home ---------- */
function renderHome(){
  const s = (D && D.stats) || {};
  if (!D) return;
  let mv = s.moves || 0;
  if (!mv && $("#s-moves-l")){ mv = new Set((D.seats||[]).map(r => r.employer)).size; $("#s-moves-l").textContent = "Employers hiring senior HR"; }
  [["s-seats",s.open_seats],["s-moves",mv],["s-stories",s.stories],["s-emp",s.employers_tracked]].forEach(([id,v]) => { const el = $("#"+id); if (el) countUp(el, v||0); });
  const set = (id, t) => { const el = $("#"+id); if (el) el.textContent = t; };
  set("pc-res", `${(D.seats||[]).length} open seats · ${(D.news||[]).length} stories`);
  set("pc-voi", (D.voices||[]).length ? `${D.voices.length} piece${D.voices.length===1?"":"s"}` : "First pieces in November");
  set("pc-com", "Free · request to join");
}

/* ---------- resources ---------- */
function seatsHTML(list){
  return list.map(r => { const u = safe(r.url); return `<a class="rowi" ${u?`href="${esc(u)}" target="_blank" rel="noopener"`:""}>
    <div><div class="t">${esc(r.role_title)}</div><div class="e">${esc(r.employer)}</div></div>
    <div class="meta">${esc(r.sector||"")}<small>${esc(r.location||"")}</small></div>
    <div class="age">${esc(LEVEL[r.level]||"")}${r.first_seen?` · seen ${esc(fmtD(r.first_seen))}`:""}</div>
    <div class="go" aria-hidden="true">${u?"↗":""}</div></a>`; }).join("");
}
function renderPanel(){
  const p = $("#panel"); if (!p) return;
  document.querySelectorAll(".tab").forEach(b => { const on = b.dataset.tab===tab; b.classList.toggle("on", on); b.setAttribute("aria-selected", on); });
  if (D){ $("#t-seats").textContent = (D.seats||[]).length; $("#t-moves").textContent = (D.movers||[]).length; $("#t-news").textContent = (D.news||[]).length; }
  if (!D){ p.innerHTML = `<div class="empty">The latest data could not load just now. Please refresh in a minute.</div>`; return; }
  p.classList.remove("panel"); void p.offsetWidth; p.classList.add("panel");
  if (tab==="seats"){
    const seats = D.seats||[];
    if (!seats.length){ p.innerHTML = `<div class="empty">No senior HR seats open at the employers we track this week. We read every employer on Tuesdays and Fridays.</div>`; return; }
    const lv = ["c_suite","director","head_of"].filter(l => seats.some(r => r.level===l));
    p.innerHTML = `<p class="note">Head of, Director and C-suite HR roles in the UK and Ireland. Each links to the original advert.</p>
      <div class="chips"><button class="chip on" data-f="all">All · ${seats.length}</button>${lv.map(l=>`<button class="chip" data-f="${l}">${LEVEL[l]}</button>`).join("")}</div>
      <div class="rows" id="rows">${seatsHTML(seats)}</div>`;
    p.querySelectorAll(".chip").forEach(b => b.onclick = () => {
      p.querySelectorAll(".chip").forEach(x => x.classList.toggle("on", x===b));
      const f = b.dataset.f; $("#rows").innerHTML = seatsHTML(seats.filter(r => f==="all" || r.level===f));
    });
    return;
  }
  if (tab==="moves"){
    const mv = D.movers||[];
    if (!mv.length){ p.innerHTML = `<div class="empty">HR moves appear here once we have confirmed them. The tracker reads trade press and the newsrooms of the employers we follow every weekday.</div>`; return; }
    p.innerHTML = `<div class="mv-line">${mv.map(a => { const u = safe(a.source_url); return `<div class="mv">
      <div class="d">${esc(fmtD(a.announced_date,{day:"numeric",month:"short",year:"numeric"}))}${MOVE[a.move_type]?" · "+MOVE[a.move_type]:""}</div>
      <h3>${esc(a.person_name)} → ${esc(a.role_title)}, ${esc(a.to_company)}</h3>
      ${a.from_company?`<p>Previously ${esc(a.from_role?a.from_role+", ":"")}${esc(a.from_company)}.</p>`:""}
      ${u?`<p style="margin-top:6px;font-size:13px"><a href="${esc(u)}" target="_blank" rel="noopener" style="color:var(--mist)">${esc(a.source_name||"Source")} ↗</a></p>`:""}</div>`; }).join("")}</div>`;
    return;
  }
  const n = D.news||[];
  if (!n.length){ p.innerHTML = `<div class="empty">No market stories in the past month yet.</div>`; return; }
  p.innerHTML = `<div class="stories">${n.map(s => { const u = safe(s.url); return `<a class="story" ${u?`href="${esc(u)}" target="_blank" rel="noopener"`:""}>
    <div class="k"><span>${esc(s.source||"")}</span><span>${esc(fmtD(s.published_date))}</span></div><h3>${esc(s.headline)}</h3>${s.summary?`<p>${esc(s.summary)}</p>`:""}</a>`; }).join("")}</div>`;
}
document.querySelectorAll(".tab").forEach(b => b.onclick = () => { tab = b.dataset.tab; history.replaceState(null, "", "#"+tab); renderPanel(); });
if ($("#tools")) $("#tools").innerHTML = TOOLS.map(t => `<div class="card" data-r><span class="k"><span>Tool</span><span>In production</span></span><h3>${esc(t.t)}</h3><p>${esc(t.d)}</p><button class="btn" data-tool="${t.id}">Email it to me when ready</button></div>`).join("");

/* ---------- voices ---------- */
function renderVoices(){
  const el = $("#posts"); if (!el) return;
  const v = (D && D.voices) || [];
  el.innerHTML = v.length ? v.map(p => { const u = safe(p.link_url); return `<article class="post" data-r>
      <div class="k">${p.kind==="guest"?"Guest voice":"Where we stand"} · ${esc(fmtD(p.published_at,{day:"numeric",month:"long",year:"numeric"}))}</div>
      <h3>${esc(p.title)}</h3>${p.standfirst?`<p class="sf">${esc(p.standfirst)}</p>`:""}
      <p class="by">${esc(p.author_name||"Josh Foulkes")}${p.author_role?", "+esc(p.author_role):""}</p>
      ${p.body?`<details><summary>Read the piece</summary><div class="body">${para(p.body)}</div></details>`:""}
      ${u?`<p style="margin-top:12px"><a class="btn" style="padding:10px 14px;font-size:11px" href="${esc(u)}" target="_blank" rel="noopener">Listen or read more ↗</a></p>`:""}</article>`; }).join("")
    : `<div class="soon" data-r><span class="eyebrow">Coming in November</span><h3>The first pieces are being written.</h3><p>A short view each month on hiring for the people seat in infrastructure, and conversations with HR leaders from the Solving Infrastructure podcast.</p><p><a class="btn" href="${ROOT}community/#join">Join the community to hear first</a></p></div>`;
  observe();
}

/* ---------- community ---------- */
function renderQuestion(){
  const el = $("#question"); if (!el) return;
  const q = D && D.question;
  el.innerHTML = q ? `<div class="q"><small>This quarter's question</small><h4>${esc(q.title)}</h4>${q.standfirst?`<p>${esc(q.standfirst)}</p>`:""}${q.body?`<div style="margin-top:10px;font-size:14px;color:#33505C;line-height:1.65">${para(q.body)}</div>`:""}</div>` : "";
}
function reason(r){
  return {work_email_required:"Please use your work email.", bad_email:"Please check your email address.", consent_required:"Please tick the box so we can contact you.", busy:"We're getting a lot of requests. Please try again in a few minutes.", too_long:"One of the fields is too long."}[r] || "That didn't work. Please try again, or email info@sonderandmetric.com.";
}
async function submit(form, interest, msgEl){
  const fd = new FormData(form), b = form.querySelector("button[type=submit]");
  if (fd.get("website")) { form.hidden = true; msgEl.innerHTML = `<div class="msg">Thank you.</div>`; return; }
  const em = String(fd.get("email")||"").trim();
  if (interest==="community" && ["name","title","company"].some(k => !String(fd.get(k)||"").trim())){ msgEl.innerHTML = `<div class="msg err">Please fill in every field.</div>`; return; }
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(em)){ msgEl.innerHTML = `<div class="msg err">${reason("bad_email")}</div>`; return; }
  if (!fd.get("consent")){ msgEl.innerHTML = `<div class="msg err">${reason("consent_required")}</div>`; return; }
  b.disabled = true; msgEl.innerHTML = "";
  try {
    const r = await rpc("hub_signup", {p_hub:HUB, p_email:em, p_name:fd.get("name")||null, p_title:fd.get("title")||null, p_company:fd.get("company")||null, p_interest:interest, p_consent:true});
    if (!r || !r.ok){ b.disabled = false; msgEl.innerHTML = `<div class="msg err">${reason(r && r.reason)}</div>`; return; }
    form.hidden = true;
    const first = String(fd.get("name")||"").trim().split(/\s+/)[0];
    msgEl.innerHTML = interest==="community"
      ? `<div class="msg">Thanks${first?", "+esc(first):""}. Josh reads every request personally and will be in touch.</div>`
      : `<div class="msg">Thanks. We'll email it to <b>${esc(em)}</b> as soon as it's ready.</div>`;
  } catch(_) { b.disabled = false; msgEl.innerHTML = `<div class="msg err">${reason()}</div>`; }
}
if ($("#joinf")) $("#joinf").addEventListener("submit", e => { e.preventDefault(); submit(e.target, "community", $("#jmsg")); });
const dlg = $("#tooldlg"); let toolId = null;
if (dlg){
  document.addEventListener("click", e => {
    const t = e.target.closest("[data-tool]");
    if (t){ toolId = t.dataset.tool; const tool = TOOLS.find(x => x.id===toolId); $("#tool-t").textContent = tool.t; $("#tmsg").innerHTML = "";
      const tf = $("#toolf"); tf.hidden = false; tf.reset(); tf.querySelector("button[type=submit]").disabled = false;
      dlg.showModal ? dlg.showModal() : dlg.setAttribute("open",""); }
    if (e.target.closest("[data-close]")) dlg.close();
  });
  $("#toolf").addEventListener("submit", e => { e.preventDefault(); submit(e.target, "tool:"+toolId, $("#tmsg")); });
}

/* ---------- motion ---------- */
let io;
function observe(){
  if (!("IntersectionObserver" in window) || reduce){ document.querySelectorAll("[data-r]").forEach(el => el.classList.add("in")); return; }
  io = io || new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting){ e.target.classList.add("in"); io.unobserve(e.target); } }), {threshold:.1, rootMargin:"0px 0px -5% 0px"});
  document.querySelectorAll("[data-r]:not(.in)").forEach(el => io.observe(el));
}
function countUp(el, to){
  if (reduce){ el.textContent = to; return; }
  const t0 = performance.now(), dur = 1200;
  const step = t => { const k = Math.min(1,(t-t0)/dur); el.textContent = Math.round(to*(1-Math.pow(1-k,4))); if (k<1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
addEventListener("scroll", () => { const h = document.documentElement, p = $("#progress"); if (p) p.style.width = (h.scrollTop/Math.max(1,h.scrollHeight-h.clientHeight)*100)+"%"; }, {passive:true});
(function net(){
  const c = $("#net"); if (!c || !c.getContext) return;
  const x = c.getContext("2d"), dpr = Math.min(2, devicePixelRatio||1);
  let W, H, pts = [], mx = .5, my = .5;
  const size = () => { W = c.clientWidth; H = c.clientHeight; c.width = W*dpr; c.height = H*dpr; x.setTransform(dpr,0,0,dpr,0,0);
    pts = Array.from({length:Math.round(Math.min(100, W*H/15000))}, (_,i) => ({x:Math.random()*W, y:Math.random()*H, vx:(Math.random()-.5)*.18, vy:(Math.random()-.5)*.18, r:Math.random()*1.6+.8, s:i%17===0, p:Math.random()*6.28})); };
  size(); addEventListener("resize", size); addEventListener("pointermove", e => { mx = e.clientX/innerWidth; my = e.clientY/innerHeight; });
  const frame = t => {
    x.clearRect(0,0,W,H); const ox = (mx-.5)*24, oy = (my-.5)*16;
    for (const p of pts){ if (!reduce){ p.x += p.vx; p.y += p.vy; } if (p.x<-20) p.x = W+20; if (p.x>W+20) p.x = -20; if (p.y<-20) p.y = H+20; if (p.y>H+20) p.y = -20; }
    for (let i=0;i<pts.length;i++) for (let j=i+1;j<pts.length;j++){ const a = pts[i], b = pts[j], dx = a.x-b.x, dy = a.y-b.y, d = dx*dx+dy*dy;
      if (d<15000){ const o = (1-d/15000)*(a.s||b.s?.5:.22); x.strokeStyle = a.s||b.s ? `rgba(219,111,42,${o})` : `rgba(159,183,192,${o})`; x.lineWidth = .7; x.beginPath(); x.moveTo(a.x+ox,a.y+oy); x.lineTo(b.x+ox,b.y+oy); x.stroke(); } }
    for (const p of pts){ if (p.s){ const k = (Math.sin(t/700+p.p)+1)/2; x.fillStyle = `rgba(219,111,42,${.12+k*.18})`; x.beginPath(); x.arc(p.x+ox,p.y+oy,p.r+6+k*8,0,7); x.fill(); x.fillStyle = "#DB6F2A"; } else x.fillStyle = "rgba(217,231,235,.55)"; x.beginPath(); x.arc(p.x+ox,p.y+oy,p.s?p.r+1.6:p.r,0,7); x.fill(); }
    if (!reduce) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
})();

/* ---------- boot ---------- */
observe();
renderVoices();
const fetchData = window.__HUB_DATA__ ? Promise.resolve(window.__HUB_DATA__) : rpc("hub_public", {p_hub:HUB});
fetchData.then(d => { D = d && d.ok ? d : null; }).catch(() => { D = null; }).finally(() => {
  renderHome(); renderPanel(); renderVoices(); renderQuestion(); observe();
});
})();
