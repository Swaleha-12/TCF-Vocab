/* TCF Tâche 3: vocabulary flashcards and timed speaking practice. Plain JS, no build step. */
(function () {
  "use strict";

  const DATA_DIR = "app/data/";
  const KEY = "tcf3.v1";
  const TYPE_LABEL = { N: "nom", V: "verbe", A: "adjectif", ADV: "adverbe", EXP: "expression" };
  const TYPE_PLURAL = { N: "Noms", V: "Verbes", A: "Adjectifs", ADV: "Adverbes", EXP: "Expressions" };
  const MASTERED = 5;
  const SESSION_SIZE = 20;
  const TIMER_CHOICES = [180, 270, 360];

  const app = document.getElementById("app");
  const data = { cats: [], bySlug: {}, words: {}, questions: {} };

  // ---------- storage (per device, may be unavailable) ----------
  function loadStore() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || "{}");
      return { boxes: s.boxes || {}, practised: s.practised || {}, last: s.last || null, prefs: s.prefs || {} };
    } catch (e) {
      return { boxes: {}, practised: {}, last: null, prefs: {} };
    }
  }
  const store = loadStore();
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* storage blocked */ }
  }
  const box = (id) => (store.boxes[id] && store.boxes[id].b) || 0;

  // ---------- helpers ----------
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fold = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const fmt = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

  function exampleHtml(w) {
    if (!w.example) return "";
    const ex = w.example, h = w.highlight || "";
    const i = h ? ex.indexOf(h) : -1;
    if (i < 0) return esc(ex);
    return esc(ex.slice(0, i)) + "<b>" + esc(h) + "</b>" + esc(ex.slice(i + h.length));
  }
  function wordTitle(w) {
    return w.type === "N" ? w.display : w.fr;
  }
  function genderTag(w) {
    return w.type === "N" ? (w.gender === "f" ? "féminin" : "masculin") : "";
  }

  // ---------- speech (optional) ----------
  const canSpeak = "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
  // Browsers load their voice list late, and otherwise fall back to the device's default
  // (often English) voice, so wait for the list and always pick a French voice explicitly.
  const voices = { fr: [], loaded: false };
  const GOOD_VOICE = /(google|amélie|amelie|thomas|audrey|aurélie|marie|denise|henri|eloise|vivienne|remy|natural|online|enhanced|premium|neural)/i;
  function rankVoice(v) {
    const lang = v.lang.replace("_", "-").toLowerCase();
    return (lang === "fr-fr" ? 0 : lang.startsWith("fr-ca") ? 1 : 2) * 10 + (GOOD_VOICE.test(v.name) ? 0 : 5) + (v.localService ? 0 : 1);
  }
  function refreshVoices() {
    try {
      const all = speechSynthesis.getVoices();
      if (all.length) voices.loaded = true;
      voices.fr = all.filter((v) => /^fr([-_]|$)/i.test(v.lang)).sort((a, b) => rankVoice(a) - rankVoice(b));
    } catch (e) { /* ignore */ }
  }
  function waitForVoices() {
    refreshVoices();
    if (voices.loaded) return Promise.resolve();
    return new Promise((res) => {
      const done = () => { refreshVoices(); res(); };
      try { speechSynthesis.addEventListener("voiceschanged", done, { once: true }); } catch (e) { /* ignore */ }
      setTimeout(done, 1500);
    });
  }
  function chosenVoice() {
    const name = store.prefs.voice;
    return voices.fr.find((v) => v.name === name) || voices.fr[0] || null;
  }
  async function speak(text) {
    if (!canSpeak) return;
    await waitForVoices();
    const v = chosenVoice();
    if (!v) { toast(NO_VOICE_MSG); return; }
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.voice = v;
      u.lang = v.lang;
      u.rate = 0.95;
      speechSynthesis.speak(u);
    } catch (e) { /* ignore */ }
  }
  const NO_VOICE_MSG = "Aucune voix française n’est installée sur cet appareil, donc la lecture aurait un accent anglais. "
    + "Ajoute une voix française : iPhone/iPad : Réglages › Accessibilité › Contenu énoncé › Voix › Français. "
    + "Android : Paramètres › Synthèse vocale › Moteur Google › installer Français. "
    + "Windows : Paramètres › Heure et langue › Voix › Ajouter des voix › Français. "
    + "Mac : Réglages › Accessibilité › Contenu énoncé › Voix du système › Français. Puis recharge la page.";
  let toastTimer = null;
  function toast(msg) {
    let el = document.getElementById("toast");
    if (!el) { el = document.createElement("div"); el.id = "toast"; el.className = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.innerHTML = `<p>${esc(msg)}</p><button class="btn ghost" data-act="toast-close" aria-label="Fermer">✕</button>`;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 15000);
  }
  if (canSpeak) {
    refreshVoices();
    try { speechSynthesis.addEventListener("voiceschanged", () => { refreshVoices(); if (ui.view === "cat" && ui.tab === "fiches") render(); }); } catch (e) { /* ignore */ }
  }

  // ---------- data ----------
  async function loadJSON(name) {
    const r = await fetch(DATA_DIR + name);
    if (!r.ok) throw new Error(name + " " + r.status);
    return r.json();
  }
  async function loadQuestions(slug) {
    if (!data.questions[slug]) {
      const d = await loadJSON(`questions-${slug}.json`);
      data.questions[slug] = d.questions;
      d.questions.forEach((q) => { data.qById[q.id] = q; });
    }
    return data.questions[slug];
  }
  data.qById = {};

  // ---------- UI state ----------
  const ui = {
    view: "home", cat: null, tab: "fiches", search: "",
    fc: null, fcOpts: Object.assign({ dir: "fr", type: "all", order: "smart" }, store.prefs.fc || {}),
    pr: null, list: { q: "", type: "all", open: null }, sheet: null, confirm: null,
  };

  function setLast() {
    store.last = ui.view === "cat" ? { cat: ui.cat, tab: ui.tab } : store.last;
    save();
  }

  // ---------- rendering ----------
  function render() {
    stopTimerIfLeaving();
    if (ui.view === "home") renderHome();
    else renderCategory();
    renderSheet();
  }

  function catStats(c) {
    const ids = c.words.map((w) => w.id);
    const mastered = ids.filter((id) => box(id) >= MASTERED).length;
    const started = ids.filter((id) => box(id) > 0 && box(id) < MASTERED).length;
    const practised = Object.keys(store.practised).filter((q) => q.startsWith(c.slug + "-q")).length;
    return { total: ids.length, mastered, started, practised };
  }

  function renderHome() {
    const cards = data.cats.map((c) => {
      const s = catStats(c);
      const qline = c.questions ? `<span>${s.practised}/${c.questions} questions</span>` : `<span>connecteurs</span>`;
      return `<button class="cat" data-act="open-cat" data-cat="${c.slug}">
        <h3>${esc(c.label)}</h3>
        <div class="bar" aria-hidden="true"><i class="m" style="width:${(s.mastered / s.total) * 100}%"></i><i class="s" style="width:${(s.started / s.total) * 100}%"></i></div>
        <div class="stats"><span>${s.mastered}/${s.total} mots acquis</span>${qline}</div>
      </button>`;
    }).join("");
    const last = store.last && data.bySlug[store.last.cat];
    const cont = last ? `<button class="btn primary" data-act="continue">Continuer : ${esc(last.label)} · ${store.last.tab === "pratique" ? "Pratique" : store.last.tab === "liste" ? "Liste" : "Fiches"}</button>` : "";
    app.innerHTML = `
      <header class="hero">
        <span class="eyebrow">TCF · Expression orale · Tâche 3</span>
        <h1>Vocabulaire Tâche 3</h1>
        <p>Apprends le vocabulaire de chaque thème avec des fiches, puis entraîne-toi sur de vraies questions de la tâche 3 et compare avec une réponse modèle.</p>
        <div class="row">${cont}</div>
      </header>
      <input class="search" id="global-search" type="search" placeholder="Chercher un mot ou une question…" value="${esc(ui.search)}" autocomplete="off">
      <div class="results" id="results"></div>
      <section class="cats">${cards}</section>
      <footer class="footer">
        <span class="small muted">Ta progression est enregistrée sur cet appareil uniquement.</span>
        ${ui.confirm === "all" ? confirmHtml("Effacer toute la progression ?", "reset-all") : `<button class="btn ghost small" data-act="ask-reset" data-what="all">Réinitialiser toute la progression</button>`}
      </footer>`;
    if (ui.search) runSearch(ui.search);
  }

  function confirmHtml(text, act) {
    return `<div class="confirm"><span>${esc(text)}</span><button class="btn bad" data-act="${act}">Oui, effacer</button><button class="btn ghost" data-act="cancel-confirm">Annuler</button></div>`;
  }

  async function runSearch(q) {
    const box_ = document.getElementById("results");
    if (!box_) return;
    const f = fold(q.trim());
    if (f.length < 2) { box_.innerHTML = ""; return; }
    const words = [];
    data.cats.forEach((c) => c.words.forEach((w) => {
      if (fold(w.fr).includes(f) || fold(w.en).includes(f)) words.push([c, w]);
    }));
    let html = words.slice(0, 12).map(([c, w]) => `<button class="result" data-act="goto-word" data-cat="${c.slug}" data-id="${w.id}">
        <span><b>${esc(wordTitle(w))}</b> <span class="badge">${TYPE_LABEL[w.type]}</span></span>
        <span class="small muted">${esc(w.en)} · ${esc(c.label)}</span></button>`).join("");
    box_.innerHTML = html + `<p class="small muted">Recherche dans les questions…</p>`;
    await Promise.all(data.cats.filter((c) => c.questions).map((c) => loadQuestions(c.slug)));
    if (fold((document.getElementById("global-search") || {}).value || "").trim() !== f) return;
    const qs = [];
    data.cats.forEach((c) => (data.questions[c.slug] || []).forEach((qq) => { if (fold(qq.q).includes(f)) qs.push([c, qq]); }));
    html += qs.slice(0, 12).map(([c, qq]) => `<button class="result" data-act="goto-q" data-cat="${c.slug}" data-qid="${qq.id}">
        <span>${esc(qq.q)}</span><span class="small muted">Question · ${esc(c.label)}</span></button>`).join("");
    if (!words.length && !qs.length) html = `<p class="small muted">Aucun résultat pour « ${esc(q)} ».</p>`;
    box_.innerHTML = html;
  }

  function renderCategory() {
    const c = data.bySlug[ui.cat];
    const tabs = [["fiches", "Fiches"]].concat(c.questions ? [["pratique", "Pratique Tâche 3"]] : []).concat([["liste", "Liste"]]);
    const head = `
      <div class="topbar">
        <button class="btn ghost" data-act="home" aria-label="Retour à l’accueil">← Accueil</button>
        <h2>${esc(c.label)}</h2>
      </div>
      <nav class="tabs" role="tablist">${tabs.map(([k, l]) => `<button class="tab" role="tab" aria-selected="${ui.tab === k}" data-act="tab" data-tab="${k}">${l}</button>`).join("")}</nav>`;
    let body = "";
    if (ui.tab === "fiches") body = fichesHtml(c);
    else if (ui.tab === "pratique") body = pratiqueHtml(c);
    else body = listeHtml(c);
    app.innerHTML = head + `<section>${body}</section>`;
    if (ui.tab === "pratique" && ui.pr && ui.pr.qid) updateTimer();
  }

  // ---------- flashcards ----------
  function filteredWords(c) {
    return c.words.filter((w) => ui.fcOpts.type === "all" || w.type === ui.fcOpts.type);
  }
  function startSession(c) {
    let ws = filteredWords(c).slice();
    if (ui.fcOpts.order === "smart") {
      shuffle(ws);
      ws.sort((a, b) => {
        const ba = box(a.id), bb = box(b.id);
        const ka = ba >= MASTERED ? 99 : ba === 0 ? 1.5 : ba; // learning cards first, then new, mastered last
        const kb = bb >= MASTERED ? 99 : bb === 0 ? 1.5 : bb;
        return ka - kb;
      });
      ws = ws.slice(0, SESSION_SIZE);
    } else if (ui.fcOpts.order === "random") shuffle(ws);
    ui.fc = { cat: c.slug, queue: ws.map((w) => w.id), idx: 0, flipped: false, known: 0, again: 0, seen: new Set(), done: ws.length === 0 };
  }

  function fichesHtml(c) {
    if (!ui.fc || ui.fc.cat !== c.slug) startSession(c);
    const fc = ui.fc;
    const types = ["all"].concat(Object.keys(TYPE_LABEL).filter((t) => c.words.some((w) => w.type === t)));
    const settings = `
      <details class="settings" ${ui.fcOpen ? "open" : ""} id="fc-settings">
        <summary class="small"><b>Options</b> <span class="muted">· ${ui.fcOpts.dir === "fr" ? "français → anglais" : "anglais → français"} · ${ui.fcOpts.type === "all" ? "tous les mots" : TYPE_PLURAL[ui.fcOpts.type].toLowerCase()} · ${{ smart: "révision intelligente", random: "au hasard", list: "ordre de la liste" }[ui.fcOpts.order]}</span></summary>
        <label>Sens</label>
        <div class="chips">${[["fr", "Français → anglais"], ["en", "Anglais → français"]].map(([k, l]) => `<button class="chip" aria-pressed="${ui.fcOpts.dir === k}" data-act="fc-opt" data-k="dir" data-v="${k}">${l}</button>`).join("")}</div>
        <label>Type de mot</label>
        <div class="chips">${types.map((t) => `<button class="chip" aria-pressed="${ui.fcOpts.type === t}" data-act="fc-opt" data-k="type" data-v="${t}">${t === "all" ? "Tous" : TYPE_PLURAL[t]}</button>`).join("")}</div>
        ${canSpeak && voices.fr.length > 1 ? `<label for="voice-select">Voix française</label>
        <select id="voice-select" class="select">${voices.fr.map((v) => `<option value="${esc(v.name)}" ${chosenVoice() === v ? "selected" : ""}>${esc(v.name)} (${esc(v.lang)})</option>`).join("")}</select>` : ""}
        ${canSpeak && voices.loaded && !voices.fr.length ? `<p class="notice">Aucune voix française sur cet appareil : la lecture audio est désactivée. <button class="btn ghost small" data-act="voice-help">Comment en ajouter une</button></p>` : ""}
        <label>Ordre</label>
        <div class="chips">${[["smart", "Révision intelligente (20 fiches)"], ["random", "Au hasard"], ["list", "Ordre de la liste"]].map(([k, l]) => `<button class="chip" aria-pressed="${ui.fcOpts.order === k}" data-act="fc-opt" data-k="order" data-v="${k}">${l}</button>`).join("")}</div>
      </details>`;

    if (fc.done) {
      const s = catStats(c);
      return `<div class="deck">${settings}
        <div class="summary">
          <h2>Session terminée</h2>
          <div class="nums"><span><b>${fc.seen.size}</b><span class="small muted">fiches vues</span></span><span><b>${fc.known}</b><span class="small muted">je sais</span></span><span><b>${fc.again}</b><span class="small muted">à revoir</span></span></div>
          <p class="muted">${s.mastered} mots acquis sur ${s.total} dans ce thème.</p>
          <div class="row"><button class="btn primary" data-act="fc-restart">Nouvelle session</button>${c.questions ? `<button class="btn" data-act="tab" data-tab="pratique">Passer à la pratique</button>` : ""}</div>
        </div></div>`;
    }

    const w = data.words[fc.queue[fc.idx]];
    const b = box(w.id);
    const stage = `<span class="stage" title="Niveau ${Math.min(b, MASTERED)} sur ${MASTERED}">${Array.from({ length: MASTERED }, (_, i) => `<i class="${i < b ? "on" : ""}"></i>`).join("")}</span>`;
    const frontFr = ui.fcOpts.dir === "fr";
    const front = frontFr
      ? `<div class="word">${esc(wordTitle(w))}</div>${w.type === "N" ? `<div class="hint">${genderTag(w)}</div>` : ""}`
      : `<div class="word">${esc(w.en)}</div><div class="hint">${TYPE_LABEL[w.type]}</div>`;
    const back = `
      ${frontFr ? `<div class="fr-small">${esc(wordTitle(w))}</div><div class="en">${esc(w.en)}</div>` : `<div class="word">${esc(wordTitle(w))}</div><div class="en muted">${esc(w.en)}</div>`}
      <p class="ex">${exampleHtml(w)}</p>`;
    const pct = (fc.idx / fc.queue.length) * 100;
    return `<div class="deck">${settings}
      <div class="progress"><span>${fc.idx + 1} / ${fc.queue.length}</span><div class="bar"><i class="m" style="width:${pct}%"></i></div></div>
      <div class="card" data-act="flip" role="button" tabindex="0" aria-label="Retourner la fiche">
        <div class="meta"><span class="badge">${TYPE_LABEL[w.type]}</span>${stage}</div>
        ${fc.flipped ? back : front}
        ${fc.flipped ? "" : `<div class="hint">Touche la fiche pour la retourner</div>`}
      </div>
      <div class="row spread">
        <div class="row">
          ${canSpeak ? `<button class="btn" data-act="speak-word">🔊 Mot</button>` : ""}
          ${canSpeak && fc.flipped && w.example ? `<button class="btn" data-act="speak-ex">🔊 Phrase</button>` : ""}
        </div>
        ${fc.flipped && w.qid ? `<button class="btn ghost" data-act="see-source" data-qid="${w.qid}" data-ri="${w.ri}">Voir la réponse →</button>` : ""}
      </div>
      ${fc.flipped
        ? `<div class="answer"><button class="btn bad" data-act="fc-again">À revoir</button><button class="btn good" data-act="fc-know">Je sais</button></div>`
        : `<div class="answer"><button class="btn primary" style="grid-column:1/-1" data-act="flip">Retourner</button></div>`}
      <p class="kbd">Clavier : Espace pour retourner, 1 = À revoir, 2 = Je sais</p>
    </div>`;
  }

  function grade(known) {
    const fc = ui.fc;
    const id = fc.queue[fc.idx];
    fc.seen.add(id);
    const cur = box(id);
    store.boxes[id] = { b: known ? Math.min(MASTERED, cur + 1) : 1, t: Date.now() };
    save();
    if (known) fc.known++;
    else {
      fc.again++;
      // show it again a little later in this session
      const pos = Math.min(fc.queue.length, fc.idx + 4);
      fc.queue.splice(pos, 0, id);
    }
    fc.idx++;
    fc.flipped = false;
    if (fc.idx >= fc.queue.length) fc.done = true;
    render();
  }

  // ---------- practice ----------
  function pratiqueHtml(c) {
    const qs = data.questions[c.slug];
    if (!qs) {
      loadQuestions(c.slug).then(render).catch(showError);
      return `<p class="loading">Chargement des questions…</p>`;
    }
    if (ui.pr && ui.pr.cat === c.slug && ui.pr.qid) return practiceQuestionHtml(c);
    const done = qs.filter((q) => store.practised[q.id]).length;
    const f = fold(ui.prSearch || "");
    const shown = f ? qs.filter((q) => fold(q.q).includes(f)) : qs;
    const sorted = shown.slice().sort((a, b) => (store.practised[a.id] ? 1 : 0) - (store.practised[b.id] ? 1 : 0));
    return `<div class="deck">
      <div class="stagebox">
        <p class="muted">Comme à l’examen : pas de préparation, environ 4 min 30 pour donner ton opinion et la justifier.</p>
        <div class="row"><button class="btn primary" data-act="pr-random">Question au hasard</button><span class="small muted">${done} / ${qs.length} questions pratiquées</span></div>
      </div>
      <input class="search" id="pr-search" type="search" placeholder="Filtrer les questions…" value="${esc(ui.prSearch || "")}" autocomplete="off">
      <div class="qlist">${sorted.map((q) => `<button class="qitem" data-act="pr-open" data-qid="${q.id}"><span class="tick">${store.practised[q.id] ? "✓" : ""}</span><span>${esc(q.q)}${q.responses.length > 1 ? ` <span class="badge">${q.responses.length} réponses</span>` : ""}</span></button>`).join("")}</div>
    </div>`;
  }

  function openQuestion(slug, qid, opts) {
    const dur = store.prefs.timer || 270;
    ui.pr = Object.assign({ cat: slug, qid, ri: 0, phase: "ready", duration: dur, remaining: dur, showHints: false, showResp: false, from: null }, opts || {});
    ui.cat = slug; ui.tab = "pratique"; ui.view = "cat";
    setLast();
  }

  function hintsFor(q) {
    const counts = new Map();
    q.responses[0].p.forEach((p) => p.m.forEach(([, , vid]) => {
      if (!vid.startsWith("argumentation")) counts.set(vid, (counts.get(vid) || 0) + 1);
    }));
    const byType = {};
    [...counts.entries()].sort((a, b) => b[1] - a[1]).forEach(([vid]) => {
      const w = data.words[vid];
      (byType[w.type] = byType[w.type] || []).push(w);
    });
    const out = [];
    for (let round = 0; out.length < 10 && round < 6; round++) {
      ["EXP", "N", "V", "A", "ADV"].forEach((t) => { if (out.length < 10 && byType[t] && byType[t][round]) out.push(byType[t][round]); });
    }
    const conns = shuffle(data.bySlug.argumentation.words.slice()).slice(0, 4);
    return { topic: out, conns };
  }

  function practiceQuestionHtml(c) {
    const pr = ui.pr;
    const q = data.qById[pr.qid];
    if (!q) return `<p class="muted">Question introuvable.</p>`;
    const running = pr.phase === "running";
    const timerBtns = pr.phase === "ready"
      ? `<button class="btn primary" data-act="t-start">Commencer</button>`
      : running ? `<button class="btn" data-act="t-pause">Pause</button>`
      : pr.phase === "paused" ? `<button class="btn primary" data-act="t-start">Reprendre</button>` : "";
    const durChips = pr.phase === "ready" ? `<div class="chips">${TIMER_CHOICES.map((s) => `<button class="chip" aria-pressed="${pr.duration === s}" data-act="t-dur" data-v="${s}">${fmt(s)}</button>`).join("")}</div>` : "";
    if (!pr.hints) pr.hints = hintsFor(q);
    const hints = pr.showHints ? `<div class="hints">${pr.hints.topic.map((w) => `<span>${esc(wordTitle(w))} <em>· ${esc(w.en)}</em></span>`).join("")}${pr.hints.conns.map((w) => `<span><b>${esc(w.fr)}</b></span>`).join("")}</div>` : "";
    const rec = recHtml();
    const multi = q.responses.length > 1 ? `<div class="chips">${q.responses.map((_, i) => `<button class="chip" aria-pressed="${pr.ri === i}" data-act="pr-ri" data-v="${i}">Réponse ${i + 1}</button>`).join("")}</div>` : "";
    const resp = pr.showResp ? `
      <div class="stagebox">
        <div class="row spread"><h3>Réponse modèle</h3>${multi}</div>
        <div class="legend"><span><mark>mot du thème</mark></span><span><span class="c">connecteur</span></span><span>Touche un mot pour voir sa traduction.</span></div>
        <div class="response">${q.responses[pr.ri].p.map(paraHtml).join("")}</div>
      </div>` : "";
    const practised = !!store.practised[q.id];
    return `<div class="deck">
      <div class="row spread"><button class="btn ghost" data-act="${pr.from ? "back-to-fiches" : "pr-list"}">← ${pr.from ? "Retour aux fiches" : "Toutes les questions"}</button><span class="small muted">${practised ? "✓ Pratiquée" : ""}</span></div>
      <p class="question">${esc(q.q)}</p>
      <div class="stagebox">
        <div class="row spread"><div class="timer${pr.remaining <= 30 ? " low" : ""}" id="timer" aria-live="off">${fmt(pr.remaining)}</div><div class="row">${timerBtns}${pr.phase !== "ready" ? `<button class="btn ghost" data-act="t-reset">Recommencer</button>` : ""}</div></div>
        ${durChips}
        ${rec}
        <div class="row"><button class="chip" aria-pressed="${pr.showHints}" data-act="pr-hints">Indices</button><span class="small muted">mots utiles et connecteurs à placer dans ta réponse</span></div>
        ${hints}
      </div>
      <div class="row">
        ${pr.showResp ? "" : `<button class="btn" data-act="pr-show">Voir la réponse</button>`}
        <button class="btn ${practised ? "" : "good"}" data-act="pr-done">${practised ? "Marquer comme non pratiquée" : "Marquer comme pratiquée"}</button>
        <button class="btn primary" data-act="pr-random">Question suivante →</button>
      </div>
      ${resp}
    </div>`;
  }

  function paraHtml(p) {
    let out = "", last = 0;
    p.m.forEach(([a, b, vid]) => {
      out += esc(p.t.slice(last, a));
      const piece = esc(p.t.slice(a, b));
      out += vid.startsWith("argumentation")
        ? `<span class="c" data-act="word" data-id="${vid}" role="button" tabindex="0">${piece}</span>`
        : `<mark data-act="word" data-id="${vid}" role="button" tabindex="0">${piece}</mark>`;
      last = b;
    });
    return `<p>${out}${esc(p.t.slice(last))}</p>`;
  }

  // timer
  let tick = null, wake = null;
  function updateTimer() {
    const el = document.getElementById("timer");
    if (!el || !ui.pr) return;
    el.textContent = fmt(ui.pr.remaining);
    el.classList.toggle("low", ui.pr.remaining <= 30);
  }
  function startTimer() {
    const pr = ui.pr;
    pr.phase = "running";
    pr.endAt = Date.now() + pr.remaining * 1000;
    clearInterval(tick);
    tick = setInterval(() => {
      pr.remaining = Math.max(0, Math.round((pr.endAt - Date.now()) / 1000));
      updateTimer();
      if (pr.remaining === 0) {
        clearInterval(tick); tick = null;
        pr.phase = "over";
        pr.showResp = true;
        if (rec.state === "recording") stopRec();
        releaseWake();
        render();
      }
    }, 250);
    try { navigator.wakeLock && navigator.wakeLock.request("screen").then((w) => { wake = w; }).catch(() => {}); } catch (e) { /* ignore */ }
    render();
  }
  function pauseTimer() {
    clearInterval(tick); tick = null;
    ui.pr.phase = "paused";
    releaseWake();
    render();
  }
  function releaseWake() { try { wake && wake.release(); } catch (e) { /* ignore */ } wake = null; }
  function stopTimerIfLeaving() {
    const onQuestion = ui.view === "cat" && ui.tab === "pratique" && ui.pr && ui.pr.qid;
    if (!onQuestion && tick) { clearInterval(tick); tick = null; if (ui.pr) ui.pr.phase = "paused"; releaseWake(); }
    if (!onQuestion && rec.state === "recording") stopRec();
  }

  // recording (only where the browser allows the microphone)
  const rec = { state: "idle", url: null, error: null, mr: null, chunks: [], qid: null };
  const canRecord = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  function recHtml() {
    if (!canRecord) return "";
    const mine = rec.qid === ui.pr.qid;
    const audio = mine && rec.url ? `<audio controls src="${rec.url}"></audio>` : "";
    if (rec.state === "recording") return `<div class="rec"><span class="dot"></span><span>Enregistrement…</span><button class="btn bad" data-act="rec-stop">Arrêter</button></div>`;
    const err = rec.error ? `<span class="small muted">${esc(rec.error)}</span>` : "";
    return `<div class="rec"><button class="btn" data-act="rec-start">🎙 ${mine && rec.url ? "Réenregistrer" : "M’enregistrer"}</button>${audio}${err}</div>`;
  }
  async function startRec() {
    rec.error = null;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      rec.chunks = [];
      mr.ondataavailable = (e) => { if (e.data.size) rec.chunks.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (rec.url) URL.revokeObjectURL(rec.url);
        rec.url = URL.createObjectURL(new Blob(rec.chunks, { type: mr.mimeType || "audio/webm" }));
        rec.state = "idle";
        render();
      };
      mr.start();
      rec.mr = mr; rec.state = "recording"; rec.qid = ui.pr.qid;
      if (ui.pr.phase !== "running") startTimer(); else render();
    } catch (e) {
      rec.error = "Le micro n’est pas disponible ici. Ouvre l’app dans ton navigateur (GitHub Pages) pour t’enregistrer.";
      render();
    }
  }
  function stopRec() { try { rec.mr && rec.mr.state !== "inactive" && rec.mr.stop(); } catch (e) { rec.state = "idle"; } }

  // ---------- list ----------
  function listeHtml(c) {
    const L = ui.list;
    const f = fold(L.q);
    const types = ["all"].concat(Object.keys(TYPE_LABEL).filter((t) => c.words.some((w) => w.type === t)));
    const ws = c.words.filter((w) => (L.type === "all" || w.type === L.type) && (!f || fold(w.fr).includes(f) || fold(w.en).includes(f)));
    const rows = ws.map((w) => {
      const b = box(w.id);
      const cls = b >= MASTERED ? "mastered" : b > 0 ? "started" : "";
      const open = L.open === w.id;
      return `<button class="wrow" data-act="list-open" data-id="${w.id}" aria-expanded="${open}">
        <span class="s ${cls}" title="${b >= MASTERED ? "acquis" : b > 0 ? "en cours" : "nouveau"}"></span>
        <span class="fr">${esc(wordTitle(w))} <span class="badge">${TYPE_LABEL[w.type]}</span></span>
        <span class="en muted">${esc(w.en)}</span>
        ${open ? `<span class="ex">${exampleHtml(w)}</span>` : ""}
      </button>`;
    }).join("");
    return `<div class="deck">
      <p class="small muted">Point vert : acquis · bleu : en cours · gris : nouveau</p>
      <input class="search" id="list-search" type="search" placeholder="Chercher dans ${esc(c.label)}…" value="${esc(L.q)}" autocomplete="off">
      <div class="chips">${types.map((t) => `<button class="chip" aria-pressed="${L.type === t}" data-act="list-type" data-v="${t}">${t === "all" ? "Tous" : TYPE_PLURAL[t]}</button>`).join("")}</div>
      <div class="words">${rows || `<p class="muted">Aucun mot.</p>`}</div>
      <p class="small muted">${ws.length} mots. Touche un mot pour voir l’exemple.</p>
      ${ui.confirm === c.slug ? confirmHtml(`Effacer la progression de ${c.label} ?`, "reset-cat") : `<button class="btn ghost small" data-act="ask-reset" data-what="${c.slug}">Réinitialiser la progression de ce thème</button>`}
    </div>`;
  }

  // ---------- word sheet ----------
  function renderSheet() {
    let el = document.getElementById("sheet");
    if (!ui.sheet) { if (el) el.remove(); return; }
    const w = data.words[ui.sheet];
    if (!el) { el = document.createElement("div"); el.id = "sheet"; el.className = "sheet"; document.body.appendChild(el); }
    const b = box(w.id);
    el.innerHTML = `<div class="in">
      <div class="row spread"><span class="badge">${TYPE_LABEL[w.type]}${w.type === "N" ? " · " + genderTag(w) : ""}</span><button class="btn ghost" data-act="sheet-close" aria-label="Fermer">✕</button></div>
      <div class="word">${esc(wordTitle(w))}</div>
      <div><b>${esc(w.en)}</b></div>
      <div class="row">
        ${canSpeak ? `<button class="btn" data-act="speak-id" data-id="${w.id}">🔊 Écouter</button>` : ""}
        <button class="btn ${b === 1 ? "" : "bad"}" data-act="sheet-again" data-id="${w.id}" ${b === 1 ? "disabled" : ""}>${b === 1 ? "Dans « À revoir »" : "Ajouter à « À revoir »"}</button>
      </div>
    </div>`;
  }

  // ---------- events ----------
  app.addEventListener("input", (e) => {
    const t = e.target;
    if (t.id === "global-search") { ui.search = t.value; runSearch(t.value); }
    if (t.id === "pr-search") { ui.prSearch = t.value; rerenderKeepingFocus(t.id); }
    if (t.id === "list-search") { ui.list.q = t.value; rerenderKeepingFocus(t.id); }
  });
  function rerenderKeepingFocus(id) {
    const el = document.getElementById(id);
    const pos = el ? el.selectionStart : null;
    render();
    const n = document.getElementById(id);
    if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { /* ignore */ } }
  }
  app.addEventListener("change", (e) => {
    if (e.target.id === "voice-select") { store.prefs.voice = e.target.value; save(); speak("Bonjour, je lis en français."); }
  });
  app.addEventListener("toggle", (e) => { if (e.target.id === "fc-settings") ui.fcOpen = e.target.open; }, true);

  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-act]");
    if (!t) return;
    const act = t.dataset.act;
    const c = data.bySlug[ui.cat];
    switch (act) {
      case "open-cat": ui.view = "cat"; ui.cat = t.dataset.cat; ui.tab = "fiches"; ui.confirm = null; ui.list = { q: "", type: "all", open: null }; setLast(); break;
      case "continue": ui.view = "cat"; ui.cat = store.last.cat; ui.tab = store.last.tab; break;
      case "home": ui.view = "home"; ui.sheet = null; ui.confirm = null; break;
      case "tab": ui.tab = t.dataset.tab; ui.sheet = null; ui.confirm = null; setLast(); break;
      case "goto-word": ui.view = "cat"; ui.cat = t.dataset.cat; ui.tab = "liste"; ui.list = { q: "", type: "all", open: t.dataset.id }; setLast(); render(); scrollToRow(t.dataset.id); return;
      case "goto-q": openQuestion(t.dataset.cat, t.dataset.qid); break;
      case "flip": ui.fc.flipped = !ui.fc.flipped; break;
      case "fc-again": grade(false); return;
      case "fc-know": grade(true); return;
      case "fc-restart": startSession(c); break;
      case "fc-opt":
        ui.fcOpts[t.dataset.k] = t.dataset.v; store.prefs.fc = ui.fcOpts; save(); startSession(c); break;
      case "speak-word": { const w = data.words[ui.fc.queue[ui.fc.idx]]; speak(w.type === "N" ? w.display.replace(/ \([mf]\.\)$/, "") : w.fr); return; }
      case "speak-ex": speak(data.words[ui.fc.queue[ui.fc.idx]].example); return;
      case "speak-id": { const w = data.words[t.dataset.id]; speak(w.type === "N" ? w.display.replace(/ \([mf]\.\)$/, "") : w.fr); return; }
      case "see-source": {
        const qid = t.dataset.qid, ri = +t.dataset.ri;
        loadQuestions(ui.cat).then(() => { openQuestion(ui.cat, qid, { ri, showResp: true, phase: "ready", from: "fiches" }); render(); }).catch(showError);
        return;
      }
      case "back-to-fiches": ui.tab = "fiches"; ui.pr = null; setLast(); break;
      case "pr-list": ui.pr = null; break;
      case "pr-open": openQuestion(ui.cat, t.dataset.qid); break;
      case "pr-random": {
        const qs = data.questions[ui.cat];
        const fresh = qs.filter((q) => !store.practised[q.id] && (!ui.pr || q.id !== ui.pr.qid));
        const pool = fresh.length ? fresh : qs.filter((q) => !ui.pr || q.id !== ui.pr.qid);
        openQuestion(ui.cat, pool[Math.floor(Math.random() * pool.length)].id);
        window.scrollTo(0, 0);
        break;
      }
      case "pr-hints": ui.pr.showHints = !ui.pr.showHints; break;
      case "pr-show": ui.pr.showResp = true; break;
      case "pr-ri": ui.pr.ri = +t.dataset.v; break;
      case "pr-done":
        if (store.practised[ui.pr.qid]) delete store.practised[ui.pr.qid]; else store.practised[ui.pr.qid] = Date.now();
        save(); break;
      case "t-start": startTimer(); return;
      case "t-pause": pauseTimer(); return;
      case "t-reset": clearInterval(tick); tick = null; releaseWake(); ui.pr.phase = "ready"; ui.pr.remaining = ui.pr.duration; break;
      case "t-dur": ui.pr.duration = ui.pr.remaining = +t.dataset.v; store.prefs.timer = ui.pr.duration; save(); break;
      case "rec-start": startRec(); return;
      case "rec-stop": stopRec(); return;
      case "toast-close": { const el = document.getElementById("toast"); if (el) el.hidden = true; return; }
      case "voice-help": toast(NO_VOICE_MSG); return;
      case "word": ui.sheet = t.dataset.id; renderSheet(); return;
      case "sheet-close": ui.sheet = null; renderSheet(); return;
      case "sheet-again": store.boxes[t.dataset.id] = { b: 1, t: Date.now() }; save(); renderSheet(); return;
      case "list-type": ui.list.type = t.dataset.v; break;
      case "list-open": ui.list.open = ui.list.open === t.dataset.id ? null : t.dataset.id; break;
      case "ask-reset": ui.confirm = t.dataset.what; break;
      case "cancel-confirm": ui.confirm = null; break;
      case "reset-all": store.boxes = {}; store.practised = {}; store.last = null; save(); ui.confirm = null; ui.fc = null; break;
      case "reset-cat": {
        c.words.forEach((w) => delete store.boxes[w.id]);
        Object.keys(store.practised).forEach((k) => { if (k.startsWith(c.slug + "-q")) delete store.practised[k]; });
        save(); ui.confirm = null; ui.fc = null; break;
      }
      default: return;
    }
    if (act === "open-cat" || act === "continue" || act === "home" || act === "tab" || act === "goto-q" || act === "pr-open") window.scrollTo(0, 0);
    render();
  });

  function scrollToRow(id) {
    const el = document.querySelector(`[data-act="list-open"][data-id="${id}"]`);
    if (el) el.scrollIntoView({ block: "center" });
  }

  document.addEventListener("keydown", (e) => {
    if (e.target.closest && e.target.closest("input, textarea, select")) return;
    if (e.key === "Escape" && ui.sheet) { ui.sheet = null; renderSheet(); return; }
    if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches("[data-act='word']")) { e.preventDefault(); e.target.click(); return; }
    if (!(ui.view === "cat" && ui.tab === "fiches" && ui.fc && !ui.fc.done)) return;
    if (e.key === " " || e.key === "Enter") { if (e.target.tagName === "BUTTON" && e.key === "Enter") return; e.preventDefault(); ui.fc.flipped = !ui.fc.flipped; render(); }
    else if (e.key === "1" && ui.fc.flipped) grade(false);
    else if (e.key === "2" && ui.fc.flipped) grade(true);
  });

  function showError(err) {
    app.innerHTML = `<div class="hero"><h2>Impossible de charger les données</h2><p class="muted">${esc(err && err.message ? err.message : err)}. Si tu as ouvert le fichier directement, lance un petit serveur local (voir le README).</p></div>`;
  }

  // ---------- boot ----------
  app.innerHTML = `<p class="loading">Chargement…</p>`;
  loadJSON("vocab.json").then((v) => {
    data.cats = v.categories;
    data.cats.forEach((c) => { data.bySlug[c.slug] = c; c.words.forEach((w) => { data.words[w.id] = w; }); });
    if (canSpeak) { try { speechSynthesis.getVoices(); } catch (e) { /* ignore */ } }
    render();
  }).catch(showError);
})();
