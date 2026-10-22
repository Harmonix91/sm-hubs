/* Control room: "Home" tab, the landing page.
   Loaded by hubs-tab.js after the main admin script; uses its globals
   (sb, app, mode, view, load, bindTabs, esc, say, renderKey, updateHealthNav, getHealth, GOOD).
   Shows an overview of every tab with live counts, what needs attention now, and what is coming next. */
(function(){
  const css = document.createElement("style");
  css.textContent = `
  .hm-lead{font-size:15px;color:var(--muted);margin:0 0 18px;max-width:680px}
  .hm-now{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px}
  .hm-now .hm-pill{display:inline-flex;align-items:center;gap:8px;font-size:13.5px;font-weight:500;padding:8px 14px;border-radius:999px;background:#fff;border:1px solid var(--line);cursor:pointer}
  .hm-now .hm-pill.warn{border-color:rgba(219,111,42,.45);background:rgba(219,111,42,.08);color:#b5561b}
  .hm-now .hm-pill.ok{color:var(--ok);cursor:default}
  .hm-h{margin:28px 0 10px;font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:var(--teal);font-weight:600}
  .hm-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:14px}
  .hm-card{display:flex;flex-direction:column;background:#fff;border:1px solid var(--line);border-radius:14px;padding:18px 20px;cursor:pointer;box-shadow:0 1px 2px rgba(15,74,94,.04),0 6px 18px rgba(15,74,94,.05);transition:border-color .15s,transform .15s}
  .hm-card:hover{border-color:var(--teal);transform:translateY(-1px)}
  .hm-card:focus-visible,.hm-pill:focus-visible{outline:2px solid var(--orange);outline-offset:2px}
  .hm-card h3{margin:0 0 4px;font-size:16px;font-weight:600;color:var(--teal)}
  .hm-card p{margin:0;font-size:13.5px;color:var(--muted);line-height:1.5}
  .hm-stat{margin-top:auto;padding-top:14px;font-size:13px;color:var(--ink);font-weight:500}
  .hm-stat b{font-size:22px;font-weight:600;margin-right:4px}
  .hm-card.soon{cursor:default;background:transparent;box-shadow:none;border-style:dashed}
  .hm-card.soon:hover{border-color:var(--line);transform:none}
  .hm-card.soon h3{color:var(--ink)}
  .hm-tag{align-self:flex-start;font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;font-weight:600;padding:2px 8px;border-radius:999px;margin-bottom:10px;background:#e6eef1;color:var(--teal)}
  .hm-tag.paused{background:rgba(219,111,42,.12);color:#b5561b}`;
  document.head.appendChild(css);

  // nav button, first in the list
  const nav = document.getElementById("nav");
  if (!nav) return;
  const btn = document.createElement("button");
  btn.dataset.m = "home"; btn.textContent = "Home";
  nav.insertBefore(btn, nav.firstChild);
  btn.onclick = () => { mode = "home"; say(""); load(); };

  // route "home" through load(); bindTabs is wrapped too, so a queue render
  // already in flight when this file loads hands back to Home when it finishes
  const baseLoad = load;
  load = async function(){ if (mode === "home") return render(); return baseLoad.apply(this, arguments); };
  const baseBindTabs = bindTabs;
  bindTabs = function(){ if (mode === "home") return render(); return baseBindTabs.apply(this, arguments); };

  let run = 0;
  async function render(){
    const me = ++run;
    const {data:{session}} = await sb.auth.getSession();
    if (!session) return baseLoad();
    const {data:admin} = await sb.from("admins").select("email").limit(1);
    if (!admin || !admin.length) return baseLoad();
    if (me !== run || mode !== "home") return;

    document.getElementById("signout").hidden = false;
    document.getElementById("who").textContent = session.user.email;
    document.getElementById("nav").hidden = false;
    document.body.classList.remove("gate"); renderKey(); updateHealthNav();
    document.querySelectorAll("#nav button").forEach(b => b.classList.toggle("on", b.dataset.m === "home"));
    document.getElementById("pagetitle").textContent = "Home";
    document.getElementById("eyebrow").textContent = "Control room";
    app.innerHTML = `<p class="muted">Loading the overview…</p>`;

    const day = n => new Date(Date.now() - n*864e5).toISOString().slice(0,10);
    const today = day(0), week = day(7), month = day(30);
    const H = {count:"exact", head:true};
    const cnt = q => Promise.resolve(q).then(r => r.error ? null : r.count).catch(() => null);
    const [pending, ready, openRoles, newRoles, moves7, atlas30, ep, health, launch] = await Promise.all([
      cnt(sb.from("drafts").select("id", H).eq("status","pending")),
      cnt(sb.from("drafts").select("id", H).eq("status","approved").eq("kind","newsletter").is("published_url", null)),
      cnt(sb.from("vacancies").select("id", H).is("closed_on", null)),
      cnt(sb.from("vacancies").select("id", H).gte("first_seen", week)),
      cnt(sb.from("appointments").select("id", H).gte("announced_date", week)),
      cnt(sb.from("appointments").select("id", H).gte("announced_date", month).not("atlas_match","is", null)),
      Promise.resolve(sb.from("episodes").select("publish_date,title,guest_name,transcript_chars").gte("publish_date", today).order("publish_date").limit(1)).then(r => (r.data && r.data[0]) || null).catch(() => null),
      Promise.resolve(getHealth()).catch(() => null),
      Promise.resolve(sb.from("hub_launch_tasks").select("done")).then(r => r.data || null).catch(() => null)
    ]);
    if (me !== run || mode !== "home") return;

    const n = v => v == null ? "–" : v;
    const bad = health ? health.jobs.filter(j => !GOOD.includes(j.state) && !j.resolved).length : null;
    const epDate = ep ? new Date(ep.publish_date + "T12:00:00").toLocaleDateString("en-GB", {weekday:"short", day:"numeric", month:"short"}) : "";
    const epMissing = ep && !((ep.transcript_chars || 0) > 200);
    const done = launch ? launch.filter(t => t.done).length : null;

    // what needs Josh now
    const now = [];
    if (pending) now.push({go:"queue", t:`${pending} draft${pending === 1 ? "" : "s"} to review`});
    if (ready) now.push({go:"queue", v:"ready", t:`${ready} newsletter${ready === 1 ? "" : "s"} ready to post on LinkedIn`});
    if (bad) now.push({go:"health", t:`${bad} job${bad === 1 ? "" : "s"} need${bad === 1 ? "s" : ""} attention`});
    if (epMissing) now.push({go:"episodes", t:`Transcript missing for the ${epDate} episode`});
    const nowHtml = now.length
      ? now.map(x => `<span class="hm-pill warn" role="button" tabindex="0" data-go="${x.go}"${x.v ? ` data-v="${x.v}"` : ""}>${esc(x.t)} →</span>`).join("")
      : `<span class="hm-pill ok">Nothing needs you right now</span>`;

    const card = (go, title, text, stat, tag) => `<div class="hm-card" role="button" tabindex="0" data-go="${go}">
      ${tag ? `<span class="hm-tag ${tag.c || ""}">${esc(tag.t)}</span>` : ""}
      <h3>${esc(title)}</h3><p>${esc(text)}</p><div class="hm-stat">${stat}</div></div>`;
    const soon = (title, text, tag) => `<div class="hm-card soon"><span class="hm-tag ${tag.c || ""}">${esc(tag.t)}</span><h3>${esc(title)}</h3><p>${esc(text)}</p></div>`;

    app.innerHTML = `
      <p class="hm-lead">One place for the business. Scheduled jobs gather the market data and draft content; nothing is published or sent until you approve it.</p>
      <div class="hm-h" style="margin-top:0">Needs you now</div>
      <div class="hm-now">${nowHtml}</div>

      <div class="hm-h">What's in here</div>
      <div class="hm-grid">
        ${card("queue", "Approval queue", "Everything the jobs draft (news, Index signals, Movers, newsletters) waits here for Approve, Edit or Kill.", `<b>${n(pending)}</b> to review`)}
        ${card("roles", "Roles", "Every senior role the Index scan finds at the 214 watchlist employers and across the UK and Ireland, with days open and reposts.", `<b>${n(openRoles)}</b> open · ${n(newRoles)} new this week`)}
        ${card("movers", "Movers", "Senior appointments and departures, with the seat each one leaves open. People already in Atlas get a congratulations task.", `<b>${n(moves7)}</b> this week · ${n(atlas30)} in Atlas (30 days)`)}
        ${card("episodes", "Episodes", "Solving Infrastructure episodes and transcripts. Monday's newsletter draft is written from Tuesday's transcript.", ep ? `Next: <b style="font-size:15px">${esc(epDate)}</b> ${esc(ep.guest_name || "")}${epMissing ? " · transcript missing" : ""}` : `No upcoming episode added`)}
        ${card("health", "Health", "Whether every scheduled job ran on time, and what to do when one didn't.", bad == null ? "Status unavailable" : bad ? `<b>${bad}</b> need${bad === 1 ? "s" : ""} attention` : `All jobs ran`)}
        ${card("hubs", "Hubs", "The HR, Finance and Asset Management hubs: private preview, live addresses and the launch checklist.", done == null ? "" : `<b>${done}</b> of ${launch.length} launch items done`, {t:"On hold", c:"paused"})}
      </div>

      <div class="hm-h">Coming next</div>
      <div class="hm-grid">
        ${soon("Targets", "This week's BD and podcast targets, ranked from the Index, Movers and news, with warm paths from your LinkedIn network, Hoxo warm leads and the Dream 100. Ready each Friday evening.", {t:"Building next"})}
        ${soon("This week", "The Hoxo Monday report in here: first actions, follow-ups due, post ideas and comment targets, plus overdue Atlas tasks.", {t:"Planned"})}
        ${soon("The Brief", "The weekly briefing built from the Index, Movers and news, emailed through Kit. Back in about a month.", {t:"On hold", c:"paused"})}
      </div>`;

    app.querySelectorAll("[data-go]").forEach(el => {
      const go = () => {
        const m = el.dataset.go;
        if (m === "hubs") { const b = document.querySelector('#nav button[data-m="hubs"]'); if (b) b.click(); return; }
        mode = m; if (m === "queue") view = el.dataset.v || "pending";
        say(""); load();
      };
      el.onclick = go;
      el.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } };
    });
  }

  // open on Home
  mode = "home";
  load();
})();
