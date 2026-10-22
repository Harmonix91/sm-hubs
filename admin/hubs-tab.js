/* Control room: "Hubs" tab.
   Loaded after the main admin script; uses its globals (sb, app, mode, load, esc).
   Shows the hub links (private preview + live addresses) and the launch checklist (table hub_launch_tasks). */
(function(){
  const PREVIEW_URL = "https://claude.ai/artifact/GhhDgqitAradyNYXkqvyff";
  const SITE = [
    {t:"Hubs gateway", p:"../", mark:"Choose your hub"},
    {t:"HR hub", p:"../hr/", mark:'const HUB = "hr"'},
    {t:"Finance hub", p:"../finance/", mark:'const HUB = "cfo"'},
    {t:"Asset Management hub", p:"../asset-management/", mark:'const HUB = "asset_management"'}
  ];
  const HUBNAME = {hr:"HR", cfo:"Finance", asset_management:"Asset Management", operating_partners:"Operating Partners", ceo:"CEO", investors:"Investors"};

  const css = document.createElement("style");
  css.textContent = `
  .hb-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;margin-bottom:22px}
  .hb-card{background:#fff;border:1px solid var(--line,#dfe7ea);border-radius:14px;padding:20px 22px}
  .hb-card h3{margin:0 0 6px;font-size:16px;font-weight:600;color:var(--ink,#1C2E38)}
  .hb-card p{margin:0;font-size:13.5px;color:var(--muted,#5d727c)}
  .hb-eyebrow{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--orange,#DB6F2A);font-weight:600;margin-bottom:8px}
  .hb-btn{display:inline-block;margin-top:14px;background:var(--teal,#0F4A5E);color:#fff!important;text-decoration:none;font-size:13px;font-weight:600;padding:10px 16px;border-radius:9px}
  .hb-btn:hover{background:#0b3a4a}
  .hb-links{list-style:none;margin:10px 0 0;padding:0}
  .hb-links li{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:9px 0;border-top:1px solid var(--line,#dfe7ea);font-size:14px}
  .hb-links a{font-weight:500}
  .hb-st{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;padding:3px 8px;border-radius:999px;white-space:nowrap}
  .hb-st.live{background:rgba(31,122,74,.12);color:#1f7a4a}
  .hb-st.off{background:#eef3f5;color:#5d727c}
  .hb-prog{display:flex;align-items:center;gap:14px;margin:4px 0 18px;font-size:14px;color:var(--muted,#5d727c)}
  .hb-bar{flex:1;height:8px;background:#e6eef1;border-radius:999px;overflow:hidden}
  .hb-bar i{display:block;height:100%;background:var(--orange,#DB6F2A);transition:width .6s}
  .hb-area{margin:22px 0 8px;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--teal,#0F4A5E);font-weight:600}
  .hb-task{display:grid;grid-template-columns:26px 1fr auto;gap:12px;align-items:start;background:#fff;border:1px solid var(--line,#dfe7ea);border-radius:12px;padding:14px 16px;margin-bottom:8px}
  .hb-task input{width:18px;height:18px;margin-top:2px;accent-color:#DB6F2A;cursor:pointer}
  .hb-task b{display:block;font-size:14.5px;font-weight:600;color:var(--ink,#1C2E38)}
  .hb-task span.d{display:block;font-size:13px;color:var(--muted,#5d727c);margin-top:3px}
  .hb-task.done b{text-decoration:line-through;color:#8aa0a9}
  .hb-task small{display:block;font-size:12px;color:#1f7a4a;margin-top:4px}
  .hb-own{font-size:11px;font-weight:600;padding:3px 9px;border-radius:999px;background:#eef3f5;color:var(--teal,#0F4A5E);white-space:nowrap}
  .hb-own.Josh{background:rgba(219,111,42,.12);color:#b4561b}
  .hb-mem{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
  .hb-mem span{font-size:13px;background:#eef3f5;border-radius:999px;padding:4px 10px}`;
  document.head.appendChild(css);

  // nav button, placed before Health
  const nav = document.getElementById("nav");
  if (!nav) return;
  const btn = document.createElement("button");
  btn.dataset.m = "hubs"; btn.textContent = "Hubs";
  const health = document.getElementById("healthnav");
  nav.insertBefore(btn, health || null);
  btn.onclick = () => { mode = "hubs"; if (typeof say === "function") say(""); render(); };

  // route "hubs" through the page's own load()
  const baseLoad = load;
  load = async function(){ if (mode === "hubs") return render(); return baseLoad.apply(this, arguments); };

  async function render(){
    const {data:{session}} = await sb.auth.getSession();
    if (!session) return baseLoad();
    document.querySelectorAll("#nav button").forEach(b => b.classList.toggle("on", b.dataset.m === "hubs"));
    document.getElementById("pagetitle").textContent = "Hubs";
    document.getElementById("eyebrow").textContent = "Leadership hubs";
    app.innerHTML = `<div class="empty">Loading…</div>`;

    const [{data:tasks, error:te}, {data:members}] = await Promise.all([
      sb.from("hub_launch_tasks").select("*").order("sort"),
      sb.from("hub_members").select("hub,tier,active,inner_requested_at,inner_approved_at")
    ]);
    if (te){ app.innerHTML = `<div class="empty">Could not load the checklist.</div>`; return; }

    // member counts
    const counts = {}; let pending = 0;
    (members||[]).filter(m => m.active).forEach(m => {
      counts[m.hub] = counts[m.hub] || {m:0,i:0};
      counts[m.hub][m.tier==="inner"?"i":"m"]++;
      if (m.tier==="member" && m.inner_requested_at && !m.inner_approved_at) pending++;
    });

    const done = tasks.filter(t => t.done).length, pct = tasks.length ? Math.round(done/tasks.length*100) : 0;
    const areas = [...new Set(tasks.map(t => t.area))];
    const fmt = d => new Date(d).toLocaleDateString("en-GB",{day:"numeric",month:"short"});

    app.innerHTML = `
      <div class="hb-grid">
        <div class="hb-card"><div class="hb-eyebrow">Preview</div><h3>Hubs preview (private)</h3>
          <p>The gateway and the HR, Finance and Asset Management hubs on this week's data. Use the View as bar to see each access level. Only people you share it with can open it.</p>
          <a class="hb-btn" href="${PREVIEW_URL}" target="_blank" rel="noopener">Open the preview ↗</a></div>
        <div class="hb-card"><div class="hb-eyebrow">Live site</div><h3>Public addresses</h3>
          <p>Will move to hubs.sonderandmetric.com once the domain is set up.</p>
          <ul class="hb-links" id="hb-links">${SITE.map((s,i)=>`<li><a href="${s.p}" target="_blank" rel="noopener">${esc(s.t)}</a><span class="hb-st off" data-i="${i}">Checking…</span></li>`).join("")}</ul></div>
        <div class="hb-card"><div class="hb-eyebrow">Members</div><h3>${(members||[]).filter(m=>m.active).length} members · ${pending} inner-circle request${pending===1?"":"s"}</h3>
          <div class="hb-mem">${Object.keys(HUBNAME).filter(k=>counts[k]).map(k=>`<span>${HUBNAME[k]}: ${counts[k].m+counts[k].i}${counts[k].i?` (${counts[k].i} inner)`:""}</span>`).join("") || `<span>No members yet</span>`}</div></div>
      </div>
      <h2 style="font-size:18px;margin:8px 0 4px">To make the hubs publishable</h2>
      <div class="hb-prog"><div class="hb-bar"><i style="width:${pct}%"></i></div><span>${done} of ${tasks.length} done</span></div>
      ${areas.map(a => `<div class="hb-area">${esc(a)}</div>` + tasks.filter(t => t.area===a).map(t => `
        <label class="hb-task ${t.done?"done":""}">
          <input type="checkbox" data-id="${t.id}" ${t.done?"checked":""}>
          <div><b>${esc(t.item)}</b>${t.detail?`<span class="d">${esc(t.detail)}</span>`:""}${t.done&&t.done_at?`<small>Done ${fmt(t.done_at)}${t.done_by?` by ${esc(t.done_by)}`:""}</small>`:""}</div>
          <span class="hb-own ${esc(t.owner.split(" ")[0])}">${esc(t.owner)}</span>
        </label>`).join("")).join("")}`;

    app.querySelectorAll(".hb-task input").forEach(cb => cb.onchange = async () => {
      cb.disabled = true;
      const {error} = await sb.from("hub_launch_tasks").update({done: cb.checked}).eq("id", +cb.dataset.id);
      if (error){ cb.checked = !cb.checked; cb.disabled = false; if (typeof say==="function") say("Could not save that tick."); return; }
      render();
    });

    // live check for each public address (same site, so a simple fetch works)
    SITE.forEach(async (s,i) => {
      const el = app.querySelector(`.hb-st[data-i="${i}"]`);
      try { const r = await fetch(s.p, {cache:"no-store"}); const ok = r.ok && (await r.text()).includes(s.mark); el.textContent = ok ? "Live" : "Not live yet"; el.className = "hb-st " + (ok ? "live" : "off"); }
      catch(_){ el.textContent = "Not live yet"; }
    });
  }
})();

// Home tab (the Control room landing page) lives in home-tab.js
(function(){ const s = document.createElement("script"); s.src = "home-tab.js"; document.body.appendChild(s); })();
