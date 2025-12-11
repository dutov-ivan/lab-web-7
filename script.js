(function () {
  const mainContent = document.querySelector("#main-content");
  const description = document.querySelector("#description");
  const playBtn = document.querySelector("#play");
  const logsSection = document.querySelector("#logs-3");
  const eventsTableBody = document.querySelector("#events-table tbody");

  const LS_KEY = "salvadorium_anim_events";
  let eventSeq = 0;
  let events = [];

  // Server endpoints (adjust if needed)
  const IMMEDIATE_URL = "server_immediate.php";
  const BATCH_URL = "server_batch.php";
  let serverClientOffsetMs = 0;

  function nowTs() {
    return new Date().toISOString();
  }

  function addEvent(message, type = "info", opts = {}) {
    eventSeq += 1;
    const evt = { id: eventSeq, time: nowTs(), message, type };
    events.push(evt);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(events));
    } catch (e) {}

    // send immediate event to server unless explicitly skipped
    if (!opts.skipSend) {
      try {
        sendImmediateEvent(evt).catch(() => {});
      } catch (e) {}
    }
  }

  // Send a single event immediately to server and record server time offset
  async function sendImmediateEvent(evt) {
    try {
      const payload = {
        id: evt.id,
        time_local: evt.time,
        message: evt.message,
        type: evt.type,
      };
      const res = await fetch(IMMEDIATE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-cache",
      });
      if (!res.ok) return;
      const json = await res.json();
      if (json && json.server_time) {
        const serverDate = new Date(json.server_time);
        const localNow = new Date();
        serverClientOffsetMs = serverDate - localNow;
        const diffH = Math.round((serverClientOffsetMs / 3600000) * 100) / 100;
        if (Math.abs(diffH) >= 2) {
          // warn locally without re-sending this warning
          addEvent(
            `Server clock differs from local by ${diffH} hours. Using server UTC time.`,
            "warn",
            { skipSend: true }
          );
        }
      }
    } catch (e) {
      // ignore network errors
    }
  }

  // Send accumulated events from LocalStorage in one batch
  // Track last batch timing for rendering
  let lastBatchMeta = { sent_at: null, server_received_at: null };

  async function sendBatchFromLocalStorage() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const localEvents = JSON.parse(raw);
      if (!Array.isArray(localEvents) || localEvents.length === 0) return;
      // record the client-side batch sent time (UTC ISO)
      const sentAt = nowTs();
      const res = await fetch(BATCH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: localEvents, sent_at: sentAt }),
        cache: "no-cache",
      });
      if (!res.ok) return;
      const json = await res.json();
      if (json && json.status === "ok") {
        clearEvents();
      }
      // capture meta for render
      lastBatchMeta.sent_at = sentAt;
      lastBatchMeta.server_received_at =
        json && json.server_time ? json.server_time : null;
      return json;
    } catch (e) {
      // fail silently
    }
  }

  function readEventsFromLocalStorage() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function clearEvents() {
    events = [];
    eventSeq = 0;
    try {
      localStorage.removeItem(LS_KEY);
    } catch (e) {}
  }

  function createWorkArea() {
    const work = document.createElement("div");
    work.id = "work";
    work.style.position = "relative";
    work.style.width = "100%";
    work.style.height = "100%";
    work.style.display = "flex";
    work.style.flexDirection = "column";

    const controls = document.createElement("div");
    controls.id = "controls";
    controls.style.flex = "0 0 50px";
    controls.style.display = "flex";
    controls.style.alignItems = "center";
    controls.style.gap = "8px";
    controls.style.padding = "8px";
    controls.style.boxSizing = "border-box";
    controls.style.background = "#f7f7f7";
    controls.style.borderTop = "1px solid #ddd";

    const closeBtn = document.createElement("button");
    closeBtn.id = "close";
    closeBtn.textContent = "Close";

    const startBtn = document.createElement("button");
    startBtn.id = "start";
    startBtn.textContent = "Start";

    const stopBtn = document.createElement("button");
    stopBtn.id = "stop";
    stopBtn.textContent = "Stop";
    stopBtn.style.display = "none";

    const reloadBtn = document.createElement("button");
    reloadBtn.id = "reload";
    reloadBtn.textContent = "Reload";
    reloadBtn.style.display = "none";

    const info = document.createElement("div");
    info.id = "info";
    info.style.marginLeft = "auto";
    info.style.fontSize = "0.9rem";
    info.style.color = "#333";

    controls.append(closeBtn, startBtn, stopBtn, reloadBtn, info);

    const anim = document.createElement("div");
    anim.id = "anim";
    anim.style.flex = "1 1 auto";
    anim.style.margin = "0";
    anim.style.boxSizing = "border-box";
    anim.style.border = "5px solid orange";
    anim.style.width = "calc(100% - 10px)";
    anim.style.height = "calc(100% - 50px)";
    anim.style.position = "relative";
    anim.style.alignSelf = "stretch";
    anim.style.justifySelf = "stretch";
    anim.style.backgroundColor = "#fff";
    // 32x32 repeating texture for the animation background
    anim.style.backgroundImage = 'url("img/textures/texture32.png")';
    anim.style.backgroundRepeat = "repeat";

    const circle = document.createElement("div");
    circle.id = "circle";
    const R = 15;
    circle.style.position = "absolute";
    circle.style.width = `${R * 2}px`;
    circle.style.height = `${R * 2}px`;
    circle.style.borderRadius = "50%";
    circle.style.background = "green";

    anim.appendChild(circle);
    work.append(anim, controls);

    let directionIndex = 0;
    let segmentLength = 1;
    let timer = null;
    let running = false;

    function setInfo(msg) {
      info.textContent = msg;
    }

    function centerCircle() {
      const w = anim.clientWidth;
      const h = anim.clientHeight;
      const cx = Math.floor(w / 2) - R;
      const cy = Math.floor(h / 2) - R;
      circle.style.left = `${cx}px`;
      circle.style.top = `${cy}px`;
      directionIndex = 0;
      segmentLength = 1;
      addEvent("Circle placed at center");
      setInfo("Circle centered");
    }

    function getCirclePos() {
      const x = parseInt(circle.style.left || "0", 10);
      const y = parseInt(circle.style.top || "0", 10);
      return { x, y };
    }

    function boundsCheck({ x, y }) {
      const w = anim.clientWidth;
      const h = anim.clientHeight;
      const leftOut = x + R * 2 <= 0;
      const rightOut = x >= w;
      const topOut = y + R * 2 <= 0;
      const bottomOut = y >= h;
      return leftOut || rightOut || topOut || bottomOut;
    }

    function touchedWall({ x, y }) {
      const w = anim.clientWidth;
      const h = anim.clientHeight;
      const touchLeft = x <= 0;
      const touchTop = y <= 0;
      const touchRight = x + R * 2 >= w;
      const touchBottom = y + R * 2 >= h;
      return touchLeft || touchTop || touchRight || touchBottom;
    }

    function nextDirection() {
      directionIndex = (directionIndex + 1) % 4;
    }

    function step() {
      let { x, y } = getCirclePos();
      const len = segmentLength;
      switch (directionIndex) {
        case 0:
          x -= len;
          break;
        case 1:
          y += len;
          break;
        case 2:
          x += len;
          break;
        case 3:
          y -= len;
          break;
      }

      circle.style.left = `${x}px`;
      circle.style.top = `${y}px`;

      addEvent(`Circle moved: dir=${directionIndex} len=${len}`);
      setInfo(
        `Move ${len}px, dir=${["left", "down", "right", "up"][directionIndex]}`
      );

      if (boundsCheck({ x, y })) {
        addEvent("Circle fully exited anim — animation stopped", "error");
        stopAnimation(false);
        stopBtn.style.display = "none";
        reloadBtn.style.display = "inline-block";
        setInfo("Exited. Use Reload.");
        return;
      }

      if (touchedWall({ x, y })) {
        addEvent("Circle touched wall", "warn");
        stopAnimation(false);
        stopBtn.style.display = "none";
        reloadBtn.style.display = "inline-block";
        setInfo("Touched wall. Reload or close.");
        return;
      }

      segmentLength += 1;
      nextDirection();
    }

    function startAnimation() {
      if (running) return;
      running = true;
      addEvent("Start button pressed");
      setInfo("Running…");
      startBtn.style.display = "none";
      stopBtn.style.display = "inline-block";
      reloadBtn.style.display = "none";
      timer = setInterval(step, 10);
    }

    function stopAnimation(userInitiated = false) {
      if (!running) {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
      }
      running = false;
      if (userInitiated) addEvent("Stop button pressed");
      setInfo("Stopped");
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      stopBtn.style.display = "none";
      if (userInitiated) startBtn.style.display = "inline-block";
    }

    function reloadCircle() {
      addEvent("Reload requested");
      centerCircle();
      reloadBtn.style.display = "none";
      startBtn.style.display = "inline-block";
      stopBtn.style.display = "none";
      setInfo("Ready");
    }

    closeBtn.addEventListener("click", async () => {
      addEvent("Close button pressed");
      stopAnimation();
      // snapshot localStorage events before attempting batch send
      const snapshot = readEventsFromLocalStorage();
      // send batch and then render with batch meta included
      try {
        await sendBatchFromLocalStorage();
      } catch (e) {}
      renderLogs(snapshot, lastBatchMeta);
      work.remove();
    });

    startBtn.addEventListener("click", startAnimation);
    stopBtn.addEventListener("click", () => stopAnimation(true));
    reloadBtn.addEventListener("click", reloadCircle);

    return {
      work,
      anim,
      controls,
      centerCircle,
      startAnimation,
      stopAnimation,
      reloadCircle,
      startBtn,
      stopBtn,
      reloadBtn,
    };

    async function renderLogs(snapshot, batchMeta) {
      if (logsSection) logsSection.style.display = "block";
      if (!eventsTableBody) return;
      eventsTableBody.innerHTML = "";
      const localEvents = Array.isArray(snapshot)
        ? snapshot
        : readEventsFromLocalStorage();

      // try to fetch server logs and map them by event id
      const serverMap = Object.create(null);
      try {
        const res = await fetch("server_fetch_logs.php", { cache: "no-cache" });
        if (res.ok) {
          const json = await res.json();
          // immediate entries contain 'event_id' and 'received_at'
          (json.immediate || []).forEach((entry) => {
            const id =
              entry["event_id"] ?? (entry["payload"] && entry["payload"]["id"]);
            if (id != null) {
              serverMap[id] = {
                received_at: entry["received_at"] || null,
                source: "immediate",
                entry,
              };
            }
          });

          console.log(json.batches);
          // batches: each batch has 'received_at' and 'events' array
          (json.batches || []).forEach((batch) => {
            const batchReceived = batch["received_at"] || null;
            const evs = batch["events"] || [];
            evs.forEach((e) => {
              const id = e["id"] ?? null;
              if (id != null && !(id in serverMap)) {
                serverMap[id] = {
                  received_at: batchReceived,
                  source: "batch",
                  entry: e,
                };
              }
            });
          });
        }
      } catch (e) {
        // ignore fetch errors and fallback to placeholder
      }

      // If batchMeta provided, render a heading row for batch timing
      if (batchMeta && (batchMeta.sent_at || batchMeta.server_received_at)) {
        const trMeta = document.createElement("tr");
        const tdLocalMeta = document.createElement("td");
        const tdServerMeta = document.createElement("td");
        tdLocalMeta.textContent = batchMeta.sent_at
          ? `Batch sent at: ${batchMeta.sent_at}`
          : "Batch sent: (unknown)";
        tdServerMeta.textContent = batchMeta.server_received_at
          ? `Batch recorded at server: ${batchMeta.server_received_at}`
          : "Batch recorded at server: (pending)";
        // style to distinguish meta row
        trMeta.style.backgroundColor = "#eef7ff";
        tdLocalMeta.style.fontWeight = "600";
        tdServerMeta.style.fontWeight = "600";
        eventsTableBody.appendChild(trMeta);
        trMeta.append(tdLocalMeta, tdServerMeta);
      }

      // Render rows for local events, using serverMap when available
      for (let i = 0; i < localEvents.length; i++) {
        const le = localEvents[i];
        const tr = document.createElement("tr");
        const tdLocal = document.createElement("td");
        const tdServer = document.createElement("td");
        tdLocal.textContent = `#${le.id} ${le.time} — ${le.message}`;

        const serverRec = serverMap[le.id];
        if (serverRec) {
          if (serverRec.source === "immediate") {
            const s = serverRec.entry;
            tdServer.textContent = `#${le.id} ${serverRec.received_at} — ${s["message"]}`;
          } else {
            // batch: show batch received time and event message
            tdServer.textContent = `#${le.id} ${serverRec.received_at} — ${le.message} (batch)`;
          }
        } else {
          tdServer.textContent = "(no server record)";
        }

        tr.append(tdLocal, tdServer);
        eventsTableBody.appendChild(tr);
      }

      clearEvents();
    }
  }

  function ensureWorkContainer() {
    if (!mainContent) return null;
    const prev = document.querySelector("#work");
    if (prev) prev.remove();
    const api = createWorkArea();
    const { work, centerCircle } = api;
    mainContent.style.position = "relative";
    mainContent.style.minHeight = "300px";
    work.style.position = "absolute";
    work.style.left = "0";
    work.style.top = "0";
    work.style.right = "0";
    work.style.bottom = "0";
    mainContent.appendChild(work);
    try {
      centerCircle();
    } catch (e) {}
    addEvent("Work area created");
    return work;
  }

  if (playBtn) {
    playBtn.addEventListener("click", () => {
      addEvent("Play button pressed");
      ensureWorkContainer();
    });
  }

  // On page unload, try to send batch via navigator.sendBeacon for reliability
  window.addEventListener("beforeunload", () => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const localEvents = JSON.parse(raw);
      if (!Array.isArray(localEvents) || localEvents.length === 0) return;
      const payload = JSON.stringify({ events: localEvents });
      if (navigator && typeof navigator.sendBeacon === "function") {
        const blob = new Blob([payload], { type: "application/json" });
        const sent = navigator.sendBeacon(BATCH_URL, blob);
        if (sent) clearEvents();
      }
    } catch (e) {
      // ignore
    }
  });
})();
