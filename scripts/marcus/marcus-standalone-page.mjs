export function buildMarcusStandaloneHtml() {
  return String.raw`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Marcus HQ</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #061019;
        --panel: rgba(9, 20, 32, 0.9);
        --panel-strong: rgba(12, 28, 44, 0.98);
        --border: rgba(126, 174, 214, 0.22);
        --text: #eef7ff;
        --muted: #a9bfd2;
        --dim: #7591aa;
        --cyan: #55d6ff;
        --green: #7de3b1;
        --amber: #f7c46c;
        --red: #ff8c8c;
        --mono: "IBM Plex Mono", "SFMono-Regular", Consolas, monospace;
        --sans: "IBM Plex Sans", "Segoe UI", sans-serif;
      }

      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        font-family: var(--sans);
        background:
          radial-gradient(circle at 16% 8%, rgba(85, 214, 255, 0.16), transparent 28rem),
          radial-gradient(circle at 82% 2%, rgba(125, 227, 177, 0.12), transparent 24rem),
          linear-gradient(135deg, #03070d 0%, var(--bg) 46%, #0b1722 100%);
        color: var(--text);
      }

      button, input, select, textarea { font: inherit; }
      button {
        min-height: 34px;
        border: 1px solid rgba(85, 214, 255, 0.34);
        border-radius: 999px;
        background: rgba(85, 214, 255, 0.1);
        color: var(--text);
        cursor: pointer;
        font-weight: 800;
      }
      button.primary {
        border-color: rgba(125, 227, 177, 0.52);
        background: linear-gradient(135deg, rgba(125, 227, 177, 0.22), rgba(85, 214, 255, 0.12));
      }
      button:disabled { cursor: not-allowed; opacity: 0.55; }
      textarea, select, input {
        width: 100%;
        border: 1px solid rgba(126, 174, 214, 0.22);
        border-radius: 14px;
        background: rgba(2, 6, 10, 0.66);
        color: var(--text);
      }
      textarea { min-height: 84px; padding: 12px; resize: vertical; }
      select, input { min-height: 34px; padding: 0 10px; }
      code, pre { font-family: var(--mono); }
      pre {
        margin: 8px 0 0;
        max-height: 220px;
        overflow: auto;
        border: 1px solid rgba(126, 174, 214, 0.18);
        border-radius: 12px;
        background: rgba(2, 6, 10, 0.6);
        padding: 10px;
        color: #d8f3ff;
        white-space: pre-wrap;
      }

      .shell {
        width: min(1420px, calc(100% - 32px));
        margin: 0 auto;
        padding: 28px 0 42px;
      }
      .topbar, .card, .hero {
        border: 1px solid var(--border);
        border-radius: 24px;
        background: var(--panel);
        box-shadow: 0 24px 70px rgba(0, 0, 0, 0.22), inset 0 1px 0 rgba(255,255,255,0.04);
      }
      .topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 12px 14px;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 12px;
        font-weight: 900;
        letter-spacing: 0.04em;
      }
      .badge {
        display: inline-grid;
        place-items: center;
        min-width: 34px;
        height: 34px;
        padding: 0 9px;
        border-radius: 12px;
        border: 1px solid rgba(85, 214, 255, 0.34);
        background: rgba(85, 214, 255, 0.1);
        color: var(--cyan);
        font-family: var(--mono);
        font-weight: 900;
      }
      .actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
      .hero {
        display: grid;
        grid-template-columns: minmax(0, 1.1fr) minmax(280px, 0.9fr);
        gap: 20px;
        margin-top: 16px;
        padding: 26px;
      }
      .eyebrow {
        color: var(--cyan);
        font-family: var(--mono);
        font-size: 12px;
        font-weight: 900;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      h1 {
        margin: 12px 0;
        font-size: clamp(38px, 6vw, 72px);
        line-height: 0.94;
        letter-spacing: -0.055em;
      }
      h2 { margin: 0 0 8px; font-size: 20px; }
      p { color: var(--muted); line-height: 1.5; }
      .grid {
        display: grid;
        grid-template-columns: minmax(320px, 1.15fr) minmax(300px, 0.85fr);
        gap: 16px;
        margin-top: 16px;
      }
      .stack { display: grid; gap: 16px; align-content: start; }
      .card { padding: 18px; }
      .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
      .meta-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 8px;
      }
      .metric {
        border: 1px solid rgba(126, 174, 214, 0.18);
        border-radius: 14px;
        padding: 10px;
        background: rgba(2, 6, 10, 0.42);
      }
      .metric strong { display: block; color: var(--green); font-family: var(--mono); }
      .list { display: grid; gap: 8px; margin-top: 10px; }
      .item {
        border: 1px solid rgba(126, 174, 214, 0.16);
        border-radius: 14px;
        padding: 10px;
        background: rgba(2, 6, 10, 0.38);
      }
      .item strong { display: block; }
      .item small { color: var(--dim); }
      .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
      .chip {
        border: 1px solid rgba(126, 174, 214, 0.22);
        border-radius: 999px;
        padding: 4px 8px;
        color: var(--muted);
        font-family: var(--mono);
        font-size: 11px;
      }
      .warn { color: var(--amber); }
      .ok { color: var(--green); }
      .bad { color: var(--red); }
      .reply { margin-top: 12px; }
      .footer { margin-top: 18px; color: var(--dim); font-size: 13px; }
      @media (max-width: 980px) {
        .hero, .grid { grid-template-columns: 1fr; }
        .meta-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
    </style>
  </head>
  <body>
    <main class="shell" data-testid="marcus-standalone-root">
      <nav class="topbar" aria-label="Marcus HQ">
        <div class="brand"><span class="badge">M</span><span>Marcus HQ</span></div>
        <div class="actions">
          <button type="button" class="primary" id="refresh">Refresh</button>
          <button type="button" id="trace">Trace proof claim</button>
        </div>
      </nav>

      <section class="hero">
        <div>
          <div class="eyebrow">Separate local companion</div>
          <h1>Marcus is the RedByte operator beside the IDE.</h1>
          <p>
            Marcus is a separate local companion command center for repo truth, Obsidian/memory,
            packets, tasks, patch proposals, session history, and bench evidence. RedByte IDE remains
            focused on Project, Design, Verify, Map Pins, and Export.
          </p>
          <p><strong>Safety:</strong> Marcus does not edit files, apply patches, stage, commit, push, or write to Obsidian.</p>
        </div>
        <div class="card">
          <h2>Runtime status</h2>
          <div id="status" class="list" data-testid="marcus-runtime-status">Loading...</div>
        </div>
      </section>

      <section class="grid">
        <div class="stack">
          <article class="card">
            <h2>Ask Marcus</h2>
            <div class="row">
              <select id="mode" aria-label="Marcus mode">
                <option value="ask">Ask</option>
                <option value="coding-plan">Coding plan</option>
                <option value="trace">Trace</option>
              </select>
            </div>
            <textarea id="message" data-testid="marcus-chat-input">Why is proof closure blocked?</textarea>
            <div class="row">
              <button type="button" class="primary" id="send" data-testid="marcus-chat-send">Send</button>
              <button type="button" id="draftProposal">Draft patch proposal</button>
            </div>
            <div id="reply" class="reply" data-testid="marcus-chat-reply"></div>
          </article>

          <article class="card">
            <h2>Bench evidence</h2>
            <div class="meta-grid" id="evidenceCounts" data-testid="marcus-evidence-counts"></div>
            <div id="bench" class="list"></div>
          </article>

          <article class="card">
            <h2>Session events</h2>
            <div id="events" class="list" data-testid="marcus-session-events"></div>
          </article>
        </div>

        <div class="stack">
          <article class="card">
            <h2>Packets</h2>
            <div id="packets" class="list" data-testid="marcus-packets"></div>
          </article>

          <article class="card">
            <h2>Operator tasks</h2>
            <div id="tasks" class="list" data-testid="marcus-tasks"></div>
          </article>

          <article class="card">
            <h2>Patch proposals</h2>
            <p>Proposal-only. Marcus does not apply patches.</p>
            <div id="proposals" class="list" data-testid="marcus-patch-proposals"></div>
          </article>
        </div>
      </section>

      <p class="footer">
        RedByte repo docs are canonical. Generated Marcus packets, tasks, and proposals are local planning artifacts.
      </p>
    </main>

    <script>
      const state = { selectedPacketId: null, selectedTaskId: null };
      const $ = (id) => document.getElementById(id);
      const esc = (value) => String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

      async function api(path, options) {
        const response = await fetch(path, options);
        const text = await response.text();
        let payload = {};
        try { payload = text ? JSON.parse(text) : {}; } catch { payload = { ok: false, error: text }; }
        if (!response.ok) throw new Error(payload.error || response.statusText);
        return payload;
      }

      function chips(items) {
        return '<div class="chips">' + items.filter(Boolean).map((item) => '<span class="chip">' + esc(item) + '</span>').join('') + '</div>';
      }

      function renderStatus(health, snapshot) {
        const git = health.git || {};
        $('status').innerHTML =
          '<div class="item"><strong>Server</strong><small>' + esc(health.server && health.server.host) + ':' + esc(health.server && health.server.port) + '</small></div>' +
          '<div class="item"><strong>Ollama</strong><small class="' + (health.agent && health.agent.ollama_online ? 'ok' : 'warn') + '">' + (health.agent && health.agent.ollama_online ? 'online' : 'degraded/offline') + '</small></div>' +
          '<div class="item"><strong>Git</strong><small>' + esc(git.latest_commit || 'unknown') + '</small></div>' +
          '<div class="item"><strong>Next blocked task</strong><small>' + esc(snapshot.blocked_task || 'unknown') + '</small></div>';
      }

      function renderBench(timeline) {
        const counts = timeline.counts || { E0: 0, E1: 0, E2: 0, E3: 0 };
        $('evidenceCounts').innerHTML = ['E0', 'E1', 'E2', 'E3'].map((level) =>
          '<div class="metric"><strong>' + level + '</strong><span>' + esc(counts[level] || 0) + '</span></div>'
        ).join('');
        const targets = (timeline.targets || []).slice(0, 6);
        $('bench').innerHTML =
          '<div class="item"><strong>Blocker</strong><small>' + esc(timeline.currentBlockerSummary || timeline.message || 'No local bench timeline loaded.') + '</small></div>' +
          targets.map((target) =>
            '<div class="item"><strong>' + esc(target.target_id) + '</strong><small>' + esc(target.evidence_level) + ' - ' + esc(target.observed_behavior_status || 'manual status unknown') + '</small></div>'
          ).join('');
      }

      function renderPackets(payload) {
        const packets = payload.packets || [];
        $('packets').innerHTML = packets.length ? packets.slice(0, 8).map((packet) =>
          '<div class="item"><strong>' + esc(packet.title || packet.id) + '</strong><small>' + esc(packet.type) + ' - ' + esc(packet.evidenceLevel || 'evidence n/a') + '</small>' +
          chips([packet.sourceConfidence, packet.degraded ? 'degraded' : null]) +
          '<div class="row"><button type="button" onclick="selectPacket(&#39;' + esc(packet.id) + '&#39;)">Select</button><button type="button" onclick="promotePacket(&#39;' + esc(packet.id) + '&#39;)">Promote</button></div></div>'
        ).join('') : '<div class="item"><small>No packets yet.</small></div>';
      }

      function renderTasks(payload) {
        const tasks = payload.tasks || [];
        $('tasks').innerHTML = tasks.length ? tasks.slice(0, 8).map((task) =>
          '<div class="item"><strong>' + esc(task.title || task.id) + '</strong><small>' + esc(task.status) + ' - ' + esc(task.productArea || 'area n/a') + '</small>' +
          chips([task.evidenceLevel, task.sourceConfidence, task.blockerCount ? task.blockerCount + ' blockers' : null]) +
          '<div class="row"><button type="button" onclick="selectTask(&#39;' + esc(task.id) + '&#39;)">Select</button><button type="button" onclick="draftFromTask(&#39;' + esc(task.id) + '&#39;)">Draft proposal</button></div></div>'
        ).join('') : '<div class="item"><small>No operator tasks yet.</small></div>';
      }

      function renderProposals(payload) {
        const proposals = payload.proposals || [];
        $('proposals').innerHTML = proposals.length ? proposals.slice(0, 8).map((proposal) =>
          '<div class="item"><strong>' + esc(proposal.title || proposal.id) + '</strong><small>' + esc(proposal.applyStatus || 'proposal_only') + ' - ' + esc(proposal.targetFileCount || 0) + ' files</small>' +
          chips([proposal.requiresApproval ? 'approval required' : null, proposal.riskCount ? proposal.riskCount + ' risks' : null]) + '</div>'
        ).join('') : '<div class="item"><small>No patch proposals yet.</small></div>';
      }

      function renderEvents(payload) {
        const events = payload.events || [];
        $('events').innerHTML = events.length ? events.slice(0, 8).map((event) =>
          '<div class="item"><strong>' + esc(event.title || event.type) + '</strong><small>' + esc(event.type) + ' - ' + esc(event.severity) + '</small></div>'
        ).join('') : '<div class="item"><small>No session events yet.</small></div>';
      }

      async function refresh() {
        try {
          const results = await Promise.all([
            api('/health'),
            api('/snapshot'),
            api('/bench-timeline'),
            api('/packets'),
            api('/tasks'),
            api('/patch-proposals'),
            api('/session/events')
          ]);
          renderStatus(results[0], results[1]);
          renderBench((results[2] && results[2].timeline) || {});
          renderPackets(results[3]);
          renderTasks(results[4]);
          renderProposals(results[5]);
          renderEvents(results[6]);
        } catch (error) {
          $('status').innerHTML = '<div class="item"><strong class="bad">Runtime error</strong><small>' + esc(error.message) + '</small></div>';
        }
      }

      async function send() {
        const message = $('message').value.trim();
        const mode = $('mode').value;
        if (!message) return;
        $('reply').innerHTML = '<p>Marcus is working...</p>';
        try {
          const payload = await api(mode === 'trace' ? '/trace-claim' : '/chat', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(mode === 'trace' ? { claim: message } : { message, mode, allowTools: true })
          });
          if (payload.packetId) state.selectedPacketId = payload.packetId;
          $('reply').innerHTML =
            '<div class="item"><strong>Marcus</strong><p>' + esc(payload.reply || payload.output || 'Complete.') + '</p>' +
            chips([payload.evidenceLevel, payload.sourceConfidence, payload.requiresApproval ? 'approval required' : null, payload.degraded ? 'degraded' : null]) +
            '<pre>' + esc((payload.sources || []).map((source) => (source.title || source.path || source.id) + ': ' + (source.excerpt || '')).join('\\n')) + '</pre></div>';
          await refresh();
        } catch (error) {
          $('reply').innerHTML = '<div class="item"><strong class="bad">Request failed</strong><p>' + esc(error.message) + '</p></div>';
        }
      }

      window.selectPacket = async (id) => { state.selectedPacketId = id; $('reply').innerHTML = '<div class="item"><strong>Selected packet</strong><small>' + esc(id) + '</small></div>'; };
      window.selectTask = async (id) => { state.selectedTaskId = id; $('reply').innerHTML = '<div class="item"><strong>Selected task</strong><small>' + esc(id) + '</small></div>'; };
      window.promotePacket = async (id) => {
        const payload = await api('/tasks/from-packet', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ packetId: id }) });
        state.selectedTaskId = payload.task && payload.task.id;
        await refresh();
      };
      window.draftFromTask = async (id) => {
        await api('/patch-proposals', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ taskId: id }) });
        await refresh();
      };
      async function draftProposal() {
        await api('/patch-proposals', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ taskId: state.selectedTaskId, packetId: state.selectedPacketId, rawRequest: $('message').value.trim() || 'Draft a safe RedByte patch proposal.' })
        });
        await refresh();
      }
      $('refresh').addEventListener('click', refresh);
      $('send').addEventListener('click', send);
      $('draftProposal').addEventListener('click', draftProposal);
      $('trace').addEventListener('click', () => { $('mode').value = 'trace'; $('message').value = 'Map Pins does not replace Verify proof.'; send(); });
      refresh();
    </script>
  </body>
</html>`;
}
