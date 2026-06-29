import React, { useState, useEffect } from "react";

// ================= Game constants =================
const SUN_TOTAL = 130;
const HOKOM_TOTAL = 162;
const MATCH_TARGET = 152;
const DELETE_PASSWORD = "بلوت"; // غيّروها لاحقاً لكلمة عائلتكم

function toEnglishDigits(str) {
  if (str === null || str === undefined) return str;
  const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
  return String(str).replace(/[٠-٩]/g, (d) => arabicDigits.indexOf(d));
}
function toInt(str) {
  if (str === "" || str === null || str === undefined) return 0;
  const v = parseInt(toEnglishDigits(str), 10);
  return isNaN(v) ? NaN : v;
}

function sunNormalize(raw) {
  if (raw <= 14) return 2;
  if (raw === 15) return 3;
  if (raw <= 24) return 4;
  if (raw === 25) return 5;
  if (raw <= 34) return 6;
  if (raw === 35) return 7;
  if (raw <= 44) return 8;
  if (raw === 45) return 9;
  if (raw <= 54) return 10;
  if (raw === 55) return 11;
  if (raw <= 64) return 12;
  if (raw === 65) return 13;
  if (raw <= 74) return 14;
  if (raw === 75) return 15;
  if (raw <= 84) return 16;
  if (raw === 85) return 17;
  if (raw <= 94) return 18;
  if (raw === 95) return 19;
  if (raw <= 104) return 20;
  if (raw === 105) return 21;
  if (raw <= 114) return 22;
  if (raw === 115) return 23;
  if (raw <= 124) return 24;
  if (raw === 125) return 25;
  return 26;
}
function hokomNormalizeOpponent(raw) {
  if (raw <= 15) return 1;
  return 2 + Math.floor((raw - 16) / 10);
}

const PROJECTS = [
  { key: "sara", label: "سرا", sun: 4, hokom: 2 },
  { key: "khamsen", label: "خمسين", sun: 10, hokom: 5 },
  { key: "miya", label: "١٠٠", sun: 20, hokom: 10 },
  { key: "arbaa", label: "٤٠٠", sun: 40, hokom: null, sunOnly: true },
  { key: "blot", label: "بلوت", sun: null, hokom: 2, hokomOnly: true },
];

const DOUBLE_LEVELS = [
  { key: "normal", label: "بدون دبل", mult: 1 },
  { key: "double", label: "دبل", mult: 2 },
  { key: "three", label: "ثري", mult: 3 },
  { key: "four", label: "فور", mult: 4 },
  { key: "gahwa", label: "قهوة", mult: null },
];

const TITLES = {
  mohannak: "محنك",
  shuja: "شجاع",
  ghashash: "هطف",
  mahzoo: "حظ هنود",
  khawwaf: "مزهرية",
  baidh: "لو قاعد فالبيت احسن",
  ustora: "المعزب",
};

import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDN9b5YojbAoIja22eVJXF1maeyxzwLPLY",
  authDomain: "baloot-ex47.firebaseapp.com",
  projectId: "baloot-ex47",
  storageBucket: "baloot-ex47.firebasestorage.app",
  messagingSenderId: "243644313260",
  appId: "1:243644313260:web:1c714a0b7909f60ee17909",
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const MATCHES_DOC = doc(db, "baloot", "matches");

const MIN_RANKED_FOR_RATING = 10;

async function loadMatches() {
  try {
    const snap = await getDoc(MATCHES_DOC);
    if (snap.exists()) return snap.data().list || [];
  } catch (e) {
    console.error("Firestore load failed", e);
  }
  return [];
}
async function saveMatches(matches) {
  try {
    await setDoc(MATCHES_DOC, { list: matches });
  } catch (e) {
    console.error("Firestore save failed", e);
  }
}

function monthKey(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(key) {
  const [y, m] = key.split("-");
  const names = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  return `${names[parseInt(m, 10) - 1]} ${y}`;
}
function fullDateTime(dateStr) {
  const d = new Date(dateStr);
  const days = ["الأحد","الإثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
  const dayName = days[d.getDay()];
  const dateNum = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  const hours = d.getHours();
  const mins = String(d.getMinutes()).padStart(2, "0");
  const period = hours >= 12 ? "م" : "ص";
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${dayName} ${dateNum} - ${h12}:${mins} ${period}`;
}

function computeStats(matches) {
  const stats = {};
  function ensure(name) {
    if (!stats[name])
      stats[name] = { wins: 0, losses: 0, qaid: 0, projects: {}, projectsTotal: 0, partners: {}, sunBuys: 0, hokomBuys: 0, ranked: 0 };
    return stats[name];
  }
  for (const m of matches) {
    if (m.mode !== "ranked") continue;
    const { teamA, teamB, winningTeam } = m;
    for (const n of [...teamA, ...teamB]) ensure(n).ranked += 1;
    const winners = winningTeam === "A" ? teamA : teamB;
    const losers = winningTeam === "A" ? teamB : teamA;
    for (const n of winners) ensure(n).wins += 1;
    for (const n of losers) ensure(n).losses += 1;

    function trackPartner(team, didWin) {
      if (team.length === 2) {
        const [p1, p2] = team;
        const s1 = ensure(p1), s2 = ensure(p2);
        if (!s1.partners[p2]) s1.partners[p2] = { wins: 0, losses: 0 };
        if (!s2.partners[p1]) s2.partners[p1] = { wins: 0, losses: 0 };
        if (didWin) { s1.partners[p2].wins++; s2.partners[p1].wins++; }
        else { s1.partners[p2].losses++; s2.partners[p1].losses++; }
      }
    }
    trackPartner(teamA, winningTeam === "A");
    trackPartner(teamB, winningTeam === "B");

    for (const r of m.rounds || []) {
      if (r.qaidPlayer) ensure(r.qaidPlayer).qaid += 1;
      if (r.projectDetails) {
        for (const pd of r.projectDetails) {
          const s = ensure(pd.player);
          s.projects[pd.key] = (s.projects[pd.key] || 0) + pd.count;
          s.projectsTotal += pd.count;
        }
      }
      if (r.buyerPlayer && r.game) {
        const s = ensure(r.buyerPlayer);
        if (r.game === "sun") s.sunBuys += 1;
        if (r.game === "hokom") s.hokomBuys += 1;
      }
    }
  }
  return stats;
}

function computeTitles(stats) {
  const names = Object.keys(stats);
  function topBy(field, criteriaLabel) {
    let best = null, bestVal = -1;
    for (const name of names) {
      const v = stats[name][field];
      if (v > bestVal) { bestVal = v; best = name; }
    }
    return bestVal > 0 ? { name: best, value: bestVal, criteriaLabel } : null;
  }
  function leastBuyer() {
    let best = null, bestVal = Infinity;
    for (const name of names) {
      const v = stats[name].sunBuys + stats[name].hokomBuys;
      if (v < bestVal) { bestVal = v; best = name; }
    }
    return best ? { name: best, value: bestVal, criteriaLabel: "مرة شراء (صن أو حكم)" } : null;
  }
  return {
    mohannak: topBy("hokomBuys", "مرة شراء حكم"),
    shuja: topBy("sunBuys", "مرة شراء صن"),
    ghashash: topBy("qaid", "مرة تسبب بقيد"),
    mahzoo: topBy("projectsTotal", "مشروع نازل"),
    khawwaf: leastBuyer(),
    baidh: topBy("losses", "خسارة"),
    ustora: topBy("wins", "فوز"),
  };
}

function computeRating(stats, name) {
  const s = stats[name];
  if (!s || s.ranked < MIN_RANKED_FOR_RATING) return null;
  const total = s.wins + s.losses;
  if (total === 0) return null;
  return Math.round((s.wins / total) * 100);
}

function loadLocal(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch (e) {
    return fallback;
  }
}
function saveLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {}
}

export default function BalootApp() {
  const [view, setView] = useState(() => loadLocal("baloot_view", "setup"));
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [names, setNames] = useState({ A1: "", A2: "", B1: "", B2: "" });
  const [matchMode, setMatchMode] = useState("ranked");
  const [activeMatch, setActiveMatch] = useState(() => loadLocal("baloot_active_match", null));
  const [casual, setCasual] = useState(() => loadLocal("baloot_casual", { us: 0, them: 0, history: [] }));

  useEffect(() => {
    loadMatches().then((m) => { setMatches(m); setLoading(false); });
  }, []);

  useEffect(() => { saveLocal("baloot_active_match", activeMatch); }, [activeMatch]);
  useEffect(() => { saveLocal("baloot_casual", casual); }, [casual]);
  useEffect(() => { saveLocal("baloot_view", view); }, [view]);

  function startMatch() {
    const { A1, A2, B1, B2 } = names;
    if (!A1 || !A2 || !B1 || !B2) return;
    setActiveMatch({ teamA: [A1, A2], teamB: [B1, B2], cumA: 0, cumB: 0, rounds: [], winner: null, mode: matchMode });
    setView("play");
  }

  async function finishMatch(updated) {
    if (updated.winner) {
      const record = {
        date: new Date().toISOString(),
        mode: updated.mode,
        teamA: updated.teamA,
        teamB: updated.teamB,
        winningTeam: updated.winner,
        finalA: updated.cumA,
        finalB: updated.cumB,
        rounds: updated.rounds,
      };
      const next = [...matches, record];
      setMatches(next);
      await saveMatches(next);
    }
  }

  function cancelMatch() {
    setActiveMatch(null);
    setView("setup");
  }

  async function deleteMatch(date) {
    const next = matches.filter((m) => m.date !== date);
    setMatches(next);
    await saveMatches(next);
  }

  async function removeLastSavedMatch() {
    if (matches.length === 0) return;
    const next = matches.slice(0, -1);
    setMatches(next);
    await saveMatches(next);
  }

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const currentMonthMatches = matches.filter((m) => monthKey(m.date) === currentMonthKey);
  const currentStats = computeStats(currentMonthMatches);
  const titles = computeTitles(currentStats);
  const allTimeStats = computeStats(matches);

  return (
    <div style={{ minHeight: "100vh", background: "#171210", backgroundImage: "radial-gradient(circle at 50% -10%, rgba(201,151,31,0.35) 0%, transparent 45%), radial-gradient(circle at 100% 100%, rgba(13,110,94,0.18) 0%, transparent 50%), #171210", fontFamily: "'Segoe UI','Dubai','Tahoma',sans-serif", direction: "rtl", color: "#FBF6EC", padding: "20px 14px 60px" }}>
      <GlobalStyle />
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 6 }}>
          <h1
            style={{
              display: "inline-block",
              fontSize: 34,
              fontWeight: 800,
              margin: 0,
              letterSpacing: 1,
              background: "linear-gradient(180deg, #F0D78C 0%, #C9971F 60%, #8A6B14 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            ◆ الميلس ◆
          </h1>
          <div style={{ fontSize: 12, opacity: 0.55, marginTop: 2, letterSpacing: 2 }}>قيم البلوت</div>
          <div
            style={{
              width: 120,
              height: 2,
              margin: "10px auto 0",
              background: "linear-gradient(90deg, transparent, #C9971F, transparent)",
            }}
          />
        </div>
        <NavTabs view={view} setView={setView} hasMatch={!!activeMatch} />

        {loading ? (
          <div style={{ textAlign: "center", padding: 40, opacity: 0.7 }}>...جاري التحميل</div>
        ) : view === "setup" ? (
          matchMode === "casual" ? (
            <div>
              <div className="panel">
                <div style={{ display: "flex", gap: 8 }}>
                  <button className={`pill ${matchMode === "ranked" ? "pill-active" : "pill-inactive"}`} onClick={() => setMatchMode("ranked")}>Ranked</button>
                  <button className={`pill ${matchMode === "casual" ? "pill-active" : "pill-inactive"}`} onClick={() => setMatchMode("casual")}>بسيط</button>
                </div>
              </div>
              <CasualScreen casual={casual} setCasual={setCasual} />
            </div>
          ) : (
            <SetupScreen names={names} setNames={setNames} matchMode={matchMode} setMatchMode={setMatchMode} onStart={startMatch} titles={titles} />
          )
        ) : view === "play" ? (
          activeMatch ? (
            <PlayScreen match={activeMatch} setMatch={setActiveMatch} onFinish={finishMatch} onCancel={cancelMatch} onUndoFinish={removeLastSavedMatch} onNewMatch={() => { setActiveMatch(null); setView("setup"); }} />
          ) : (
            <div className="panel" style={{ textAlign: "center" }}>ابدأ قيم جديد من تبويب "قيم جديد"</div>
          )
        ) : view === "stats" ? (
          <StatsScreen stats={allTimeStats} />
        ) : view === "log" ? (
          <LogScreen matches={matches} onDelete={deleteMatch} />
        ) : (
          <ArchiveScreen matches={matches} currentMonthKey={currentMonthKey} />
        )}
      </div>
    </div>
  );
}

function GlobalStyle() {
  return (
    <style>{`
      * { box-sizing: border-box; }
      .panel { background:#FBF6EC; color:#2A1F14; border-radius:14px; padding:16px; box-shadow:0 10px 28px rgba(0,0,0,0.35); margin-bottom:16px; border-top:3px solid #C9971F; }
      button { font-family:inherit; cursor:pointer; }
      .pill { border:none; border-radius:999px; padding:7px 14px; font-size:13px; font-weight:700; }
      .pill-active { background:#0D6E5E; color:#FBF6EC; }
      .pill-inactive { background:#E8DCC0; color:#6B5D45; }
      input[type=text],input[type=password] { border:1px solid #D9C9A3; border-radius:8px; padding:8px 10px; font-size:14px; width:100%; background:#fff; color:#0F172A; }
      label { font-size:13px; display:block; margin-bottom:4px; }
      .progress-track { height:10px; background:#D9C9A3; border-radius:999px; overflow:hidden; }
      .progress-fill { height:100%; border-radius:999px; }
      .badge { display:inline-block; background:#C9971F; color:#0F172A; border-radius:999px; padding:2px 10px; font-size:11px; font-weight:800; margin-right:4px; }
    `}</style>
  );
}

function NavTabs({ view, setView, hasMatch }) {
  const primaryTabs = [
    { key: "setup", label: "قيم جديد" },
    { key: "play", label: hasMatch ? "اللعب الحالي" : "اللعب" },
  ];
  const secondaryTabs = [
    { key: "stats", label: "الإحصائيات" },
    { key: "log", label: "السجل" },
    { key: "archive", label: "الأرشيف" },
  ];
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 8 }}>
        {primaryTabs.map((t) => (
          <button key={t.key} className={`pill ${view === t.key ? "pill-active" : "pill-inactive"}`} style={{ fontSize: 14, padding: "9px 20px" }} onClick={() => setView(t.key)}>{t.label}</button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
        {secondaryTabs.map((t) => (
          <button key={t.key} className={`pill ${view === t.key ? "pill-active" : "pill-inactive"}`} style={{ fontSize: 12, opacity: 0.85 }} onClick={() => setView(t.key)}>{t.label}</button>
        ))}
      </div>
    </div>
  );
}

function TitlesBar({ titles }) {
  const entries = Object.entries(titles).filter(([, v]) => v);
  const [activeKey, setActiveKey] = useState(null);

  function handleClick(key) {
    setActiveKey((cur) => (cur === key ? null : key));
  }

  return (
    <div className="panel" style={{ fontSize: 13 }}>
      <div style={{ fontWeight: 800, marginBottom: 6 }}>👑 الألقاب</div>
      {entries.length === 0 ? (
        <span style={{ opacity: 0.6 }}>لا يوجد ألقاب بعد</span>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {entries.map(([key, info]) => (
            <span key={key} style={{ position: "relative" }}>
              <button className="badge" style={{ border: "none", cursor: "pointer" }} onClick={() => handleClick(key)}>
                {info.name}: {TITLES[key]}
              </button>
              {activeKey === key && (
                <span style={{ position: "absolute", bottom: "120%", right: 0, background: "#0F172A", color: "#FBF6EC", padding: "6px 10px", borderRadius: 8, fontSize: 12, whiteSpace: "nowrap", zIndex: 10, boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>
                  {info.name}: {TITLES[key]} — {info.value} {info.criteriaLabel}
                </span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function SetupScreen({ names, setNames, matchMode, setMatchMode, onStart, titles }) {
  function update(field, val) { setNames({ ...names, [field]: val }); }
  const ready = names.A1 && names.A2 && names.B1 && names.B2;
  return (
    <div>
      <TitlesBar titles={titles} />
      <div className="panel">
        <h3 style={{ marginTop: 0 }}>إعداد القيم</h3>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <button className={`pill ${matchMode === "ranked" ? "pill-active" : "pill-inactive"}`} onClick={() => setMatchMode("ranked")}>Ranked (يحسب بالإحصائيات)</button>
          <button className={`pill ${matchMode === "casual" ? "pill-active" : "pill-inactive"}`} onClick={() => setMatchMode("casual")}>بسيط (حساب سريع فقط)</button>
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1 }}><label>فريق A - لاعب ١</label><input type="text" value={names.A1} onChange={(e) => update("A1", e.target.value)} /></div>
          <div style={{ flex: 1 }}><label>فريق A - لاعب ٢</label><input type="text" value={names.A2} onChange={(e) => update("A2", e.target.value)} /></div>
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1 }}><label>فريق B - لاعب ١</label><input type="text" value={names.B1} onChange={(e) => update("B1", e.target.value)} /></div>
          <div style={{ flex: 1 }}><label>فريق B - لاعب ٢</label><input type="text" value={names.B2} onChange={(e) => update("B2", e.target.value)} /></div>
        </div>
        <button disabled={!ready} onClick={onStart} style={{ width: "100%", background: ready ? "#C9971F" : "#ccc", color: "#0F172A", border: "none", borderRadius: 10, padding: 12, fontWeight: 800 }}>ابدأ القيم</button>
      </div>
    </div>
  );
}

function NumField({ label, value, onChange }) {
  return (
    <div style={{ flex: 1 }}>
      <label>{label}</label>
      <input type="text" inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function PlayScreen({ match, setMatch, onFinish, onCancel, onUndoFinish, onNewMatch }) {
  const { teamA, teamB, cumA, cumB, rounds, winner, mode } = match;
  const allPlayers = [...teamA, ...teamB];
  const teamOf = (player) => (teamA.includes(player) ? "A" : "B");

  const [game, setGame] = useState("sun");
  const [buyerPlayer, setBuyerPlayer] = useState("");
  const [kabootPlayer, setKabootPlayer] = useState(null);
  const [projectTeam, setProjectTeam] = useState("none");
  const [projectAssign, setProjectAssign] = useState({}); // { [projectKey]: { [playerName]: count } }
  const [genA, setGenA] = useState("");
  const [genB, setGenB] = useState("");
  const [qaidPlayer, setQaidPlayer] = useState("");
  const [error, setError] = useState("");
  const [showSwap, setShowSwap] = useState(false);
  const [swapOld, setSwapOld] = useState("");
  const [swapNew, setSwapNew] = useState("");
  const [showKaboot, setShowKaboot] = useState(false);
  const [showBuyer, setShowBuyer] = useState(false);
  const [showProjects, setShowProjects] = useState(false);
  const [openQaid, setOpenQaid] = useState(false);
  const [openExtra, setOpenExtra] = useState(false);
  const [openProjects, setOpenProjects] = useState(false);

  function resetForm() {
    setKabootPlayer(null);
    setProjectTeam("none"); setProjectAssign({});
    setGenA(""); setGenB(""); setQaidPlayer("");
    setBuyerPlayer(""); setError("");
  }

  function adjustProjectAssign(projectKey, player, delta) {
    setProjectAssign((prev) => {
      const projCounts = { ...(prev[projectKey] || {}) };
      const next = Math.max(0, (projCounts[player] || 0) + delta);
      if (next === 0) delete projCounts[player];
      else projCounts[player] = next;
      return { ...prev, [projectKey]: projCounts };
    });
  }

  function projectsBreakdown() {
    let total = 0;
    const details = []; // { key, player, count }
    const playersSet = new Set();
    for (const key of Object.keys(projectAssign)) {
      const proj = PROJECTS.find((p) => p.key === key);
      const perPlayer = projectAssign[key] || {};
      for (const player of Object.keys(perPlayer)) {
        const count = perPlayer[player];
        if (!count) continue;
        const val = (game === "sun" ? proj.sun : proj.hokom) * count;
        total += val;
        details.push({ key, player, count });
        playersSet.add(player);
      }
    }
    return { all: total, details, players: Array.from(playersSet) };
  }

  function computeRound() {
    setError("");

    const { all: projVal, details, players: projPlayersUsed } = projectsBreakdown();

    if (qaidPlayer) {
      const a = toInt(genA), b = toInt(genB);
      if (isNaN(a) || isNaN(b)) { setError("أدخل رقمين صحيحين"); return null; }
      return { label: "قيد", A: a, B: b, qaidPlayer };
    }

    const a = toInt(genA), b = toInt(genB);
    if (isNaN(a) || isNaN(b)) { setError("أدخل رقمين صحيحين"); return null; }

    return {
      label: kabootPlayer ? `كبوت (${kabootPlayer})` : buyerPlayer ? `${game === "sun" ? "صن" : "حكم"}-${buyerPlayer}` : "كوت",
      A: a, B: b,
      buyerPlayer: buyerPlayer || null,
      game: buyerPlayer ? game : null,
      projectDetails: projectTeam !== "none" && details.length > 0 ? details : null,
    };
  }

  function addRound() {
    const res = computeRound();
    if (!res) return;
    const newCumA = cumA + res.A, newCumB = cumB + res.B;
    const newRounds = [...rounds, { ...res, cumA: newCumA, cumB: newCumB }];
    let newWinner = null;
    if (res.instantWin) newWinner = res.instantWin;
    else if (newCumA >= MATCH_TARGET && newCumB >= MATCH_TARGET) { if (newCumA !== newCumB) newWinner = newCumA > newCumB ? "A" : "B"; }
    else if (newCumA >= MATCH_TARGET) newWinner = "A";
    else if (newCumB >= MATCH_TARGET) newWinner = "B";

    const updated = { ...match, cumA: newCumA, cumB: newCumB, rounds: newRounds, winner: newWinner };
    setMatch(updated);
    resetForm();
    if (newWinner) onFinish(updated);
  }

  function undoLastRound() {
    if (rounds.length === 0) return;
    const wasFinished = !!winner;
    const newRounds = rounds.slice(0, -1);
    const newCumA = newRounds.reduce((sum, r) => sum + r.A, 0);
    const newCumB = newRounds.reduce((sum, r) => sum + r.B, 0);
    let newWinner = null;
    if (newCumA >= MATCH_TARGET && newCumB >= MATCH_TARGET) { if (newCumA !== newCumB) newWinner = newCumA > newCumB ? "A" : "B"; }
    else if (newCumA >= MATCH_TARGET) newWinner = "A";
    else if (newCumB >= MATCH_TARGET) newWinner = "B";

    setMatch({ ...match, cumA: newCumA, cumB: newCumB, rounds: newRounds, winner: newWinner });
    if (wasFinished) onUndoFinish();
  }

  function doSwap() {
    if (!swapOld || !swapNew) return;
    const replace = (arr) => arr.map((n) => (n === swapOld ? swapNew : n));
    const newRounds = rounds.map((r) => ({
      ...r,
      qaidPlayer: r.qaidPlayer === swapOld ? swapNew : r.qaidPlayer,
      buyerPlayer: r.buyerPlayer === swapOld ? swapNew : r.buyerPlayer,
      projectDetails: r.projectDetails ? r.projectDetails.map((d) => (d.player === swapOld ? { ...d, player: swapNew } : d)) : r.projectDetails,
    }));
    setMatch({ ...match, teamA: replace(teamA), teamB: replace(teamB), rounds: newRounds });
    setShowSwap(false); setSwapOld(""); setSwapNew("");
  }

  const pctA = Math.min(100, (cumA / MATCH_TARGET) * 100);
  const pctB = Math.min(100, (cumB / MATCH_TARGET) * 100);
  const projTeamPlayers = projectTeam === "A" ? teamA : projectTeam === "B" ? teamB : [];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span className="badge" style={{ background: mode === "ranked" ? "#C9971F" : "#888" }}>{mode === "ranked" ? "Ranked" : "بسيط"}</span>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="pill pill-inactive" style={{ fontSize: 12 }} onClick={() => setShowSwap(!showSwap)}>تبديل لاعب</button>
          <button className="pill" style={{ fontSize: 12, background: "#8B1538", color: "#fff" }} onClick={onCancel}>إلغاء القيم</button>
        </div>
      </div>

      {showSwap && (
        <div className="panel">
          <label>اللاعب الحالي</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            {allPlayers.map((p) => (<button key={p} className={`pill ${swapOld === p ? "pill-active" : "pill-inactive"}`} onClick={() => setSwapOld(p)}>{p}</button>))}
          </div>
          <label>الاسم الجديد</label>
          <input type="text" value={swapNew} onChange={(e) => setSwapNew(e.target.value)} style={{ marginBottom: 8 }} />
          <button className="pill pill-active" onClick={doSwap}>تأكيد التبديل (القيم بالكامل يصير لهذا اللاعب)</button>
        </div>
      )}

      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <div className="panel" style={{ flex: 1, textAlign: "center", background: "#0D6E5E", color: "#FBF6EC", margin: 0 }}>
          <div style={{ fontSize: 12, opacity: 0.8 }}>{teamA.join(" و ")}</div>
          <div style={{ fontSize: 30, fontWeight: 800 }}>{cumA}</div>
          <div className="progress-track" style={{ marginTop: 6 }}><div className="progress-fill" style={{ width: `${pctA}%`, background: "#C9971F" }} /></div>
        </div>
        <div className="panel" style={{ flex: 1, textAlign: "center", background: "#8B1538", color: "#FBF6EC", margin: 0 }}>
          <div style={{ fontSize: 12, opacity: 0.8 }}>{teamB.join(" و ")}</div>
          <div style={{ fontSize: 30, fontWeight: 800 }}>{cumB}</div>
          <div className="progress-track" style={{ marginTop: 6 }}><div className="progress-fill" style={{ width: `${pctB}%`, background: "#C9971F" }} /></div>
        </div>
      </div>

      {winner ? (
        <div className="panel" style={{ textAlign: "center", background: "#C9971F", fontWeight: 800 }}>
          🏆 {(winner === "A" ? teamA : teamB).join(" و ")} فازوا بالقيم!
          <div style={{ marginTop: 10 }}><button className="pill pill-active" style={{ background: "#0F172A" }} onClick={onNewMatch}>ابدأ قيم جديد</button></div>
        </div>
      ) : (
        <div className="panel">
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <label>{teamA.join("+")}</label>
              <input type="text" inputMode="numeric" value={genA} onChange={(e) => setGenA(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label>{teamB.join("+")}</label>
              <input type="text" inputMode="numeric" value={genB} onChange={(e) => setGenB(e.target.value)} />
            </div>
          </div>

          <label>قيد؟ (مين تسبب فيه - اختياري)</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            <button className={`pill ${!qaidPlayer ? "pill-active" : "pill-inactive"}`} onClick={() => setQaidPlayer("")}>لا</button>
            {allPlayers.map((p) => (<button key={p} className={`pill ${qaidPlayer === p ? "pill-active" : "pill-inactive"}`} onClick={() => setQaidPlayer(p)}>{p}</button>))}
          </div>

          {!qaidPlayer && (
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button className={`pill ${game === "sun" ? "pill-active" : "pill-inactive"}`} onClick={() => setGame("sun")}>صن</button>
              <button className={`pill ${game === "hokom" ? "pill-active" : "pill-inactive"}`} onClick={() => setGame("hokom")}>حكم</button>
            </div>
          )}

          {!qaidPlayer && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              <button className={`pill ${showKaboot ? "pill-active" : "pill-inactive"}`} onClick={() => setShowKaboot(!showKaboot)}>كبوت {kabootPlayer ? `(${kabootPlayer})` : ""} {showKaboot ? "▲" : "▼"}</button>
              <button className={`pill ${showBuyer ? "pill-active" : "pill-inactive"}`} onClick={() => setShowBuyer(!showBuyer)}>من اشترى {buyerPlayer ? `(${buyerPlayer})` : ""} {showBuyer ? "▲" : "▼"}</button>
              <button className={`pill ${showProjects ? "pill-active" : "pill-inactive"}`} onClick={() => setShowProjects(!showProjects)}>مشاريع {projectTeam !== "none" ? `(${projectTeam})` : ""} {showProjects ? "▲" : "▼"}</button>
            </div>
          )}

          {!qaidPlayer && showKaboot && (
            <div style={{ marginBottom: 12 }}>
              <label>كبوت؟ (مين جاب الكبوت)</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button className={`pill ${kabootPlayer === null ? "pill-active" : "pill-inactive"}`} onClick={() => setKabootPlayer(null)}>لا</button>
                {allPlayers.map((p) => (<button key={p} className={`pill ${kabootPlayer === p ? "pill-active" : "pill-inactive"}`} onClick={() => setKabootPlayer(p)}>{p}</button>))}
              </div>
            </div>
          )}

          {!qaidPlayer && !kabootPlayer && showBuyer && (
            <div style={{ marginBottom: 12 }}>
              <label>من اشترى؟ (للإحصائيات بس)</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button className={`pill ${!buyerPlayer ? "pill-active" : "pill-inactive"}`} onClick={() => setBuyerPlayer("")}>بدون</button>
                {allPlayers.map((p) => (<button key={p} className={`pill ${buyerPlayer === p ? "pill-active" : "pill-inactive"}`} onClick={() => setBuyerPlayer(p)}>{p}</button>))}
              </div>
            </div>
          )}

          {!qaidPlayer && showProjects && (
            <div style={{ marginBottom: 8 }}>
              <label>مشاريع نازلة؟ (للإحصائيات بس)</label>
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                <button className={`pill ${projectTeam === "none" ? "pill-active" : "pill-inactive"}`} onClick={() => { setProjectTeam("none"); setProjectAssign({}); }}>بدون</button>
                <button className={`pill ${projectTeam === "A" ? "pill-active" : "pill-inactive"}`} onClick={() => setProjectTeam("A")}>لـ{teamA.join("+")}</button>
                <button className={`pill ${projectTeam === "B" ? "pill-active" : "pill-inactive"}`} onClick={() => setProjectTeam("B")}>لـ{teamB.join("+")}</button>
              </div>

              {projectTeam !== "none" && (
                <div style={{ background: "#fff", borderRadius: 8, padding: "8px 10px", marginBottom: 8 }}>
                  <div style={{ display: "grid", gridTemplateColumns: `90px ${PROJECTS.filter((p) => (game === "sun" ? !p.hokomOnly : !p.sunOnly)).map(() => "1fr").join(" ")}`, gap: 4, marginBottom: 6 }}>
                    <span></span>
                    {PROJECTS.filter((p) => (game === "sun" ? !p.hokomOnly : !p.sunOnly)).map((p) => (
                      <span key={p.key} style={{ fontSize: 11, textAlign: "center", fontWeight: 700 }}>{p.label}</span>
                    ))}
                  </div>
                  {projTeamPlayers.map((pl) => (
                    <div key={pl} style={{ display: "grid", gridTemplateColumns: `90px ${PROJECTS.filter((p) => (game === "sun" ? !p.hokomOnly : !p.sunOnly)).map(() => "1fr").join(" ")}`, gap: 4, alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 13 }}>{pl}</span>
                      {PROJECTS.filter((p) => (game === "sun" ? !p.hokomOnly : !p.sunOnly)).map((p) => {
                        const count = (projectAssign[p.key] && projectAssign[p.key][pl]) || 0;
                        return (
                          <div key={p.key} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}>
                            <button onClick={() => adjustProjectAssign(p.key, pl, -1)} style={{ background: "#8B1538", color: "#fff", border: "none", borderRadius: 5, width: 18, height: 18, fontSize: 11, lineHeight: 1 }}>−</button>
                            <span style={{ minWidth: 10, textAlign: "center", fontSize: 12, fontWeight: 700 }}>{count}</span>
                            <button onClick={() => adjustProjectAssign(p.key, pl, 1)} style={{ background: "#C9971F", border: "none", borderRadius: 5, width: 18, height: 18, fontSize: 11, lineHeight: 1 }}>+</button>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && <div style={{ color: "#8B1538", fontSize: 13, marginBottom: 8 }}>⚠ {error}</div>}
          <button onClick={addRound} style={{ width: "100%", background: "#C9971F", border: "none", borderRadius: 10, padding: 12, fontWeight: 800 }}>أضف الكوت</button>
        </div>
      )}

      {rounds.length > 0 && (
        <div className="panel">
          <h3 style={{ marginTop: 0, fontSize: 15 }}>سجل الكوتات</h3>
          {rounds.slice().reverse().map((r, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, borderBottom: "1px solid #E8DCC0", padding: "5px 0" }}>
              <span style={{ opacity: 0.7 }}>{r.label}{r.qaidPlayer ? ` (${r.qaidPlayer})` : ""}</span>
              <span style={{ fontWeight: 700 }}>{r.A}-{r.B} <span style={{ opacity: 0.5 }}>({r.cumA}-{r.cumB})</span></span>
            </div>
          ))}
          <button
            onClick={undoLastRound}
            className="pill"
            style={{ marginTop: 10, background: "#8B1538", color: "#fff", width: "100%" }}
          >
            تراجع عن آخر كوت
          </button>
        </div>
      )}
    </div>
  );
}

function CasualScreen({ casual, setCasual }) {
  const { us, them, history } = casual;
  const [inputUs, setInputUs] = useState("");
  const [inputThem, setInputThem] = useState("");
  const winner = us >= MATCH_TARGET && them >= MATCH_TARGET ? (us !== them ? (us > them ? "نحن" : "هم") : null) : us >= MATCH_TARGET ? "نحن" : them >= MATCH_TARGET ? "هم" : null;

  function addEntry() {
    const u = toInt(inputUs) || 0;
    const t = toInt(inputThem) || 0;
    if (u === 0 && t === 0) return;
    const newUs = us + u, newThem = them + t;
    setCasual({ us: newUs, them: newThem, history: [...history, { u, t, cumUs: newUs, cumThem: newThem }] });
    setInputUs(""); setInputThem("");
  }
  function undoLast() {
    if (history.length === 0) return;
    const newHistory = history.slice(0, -1);
    const last = newHistory[newHistory.length - 1];
    setCasual({ us: last ? last.cumUs : 0, them: last ? last.cumThem : 0, history: newHistory });
  }
  function newMatch() { setCasual({ us: 0, them: 0, history: [] }); }

  const pctUs = Math.min(100, (us / MATCH_TARGET) * 100);
  const pctThem = Math.min(100, (them / MATCH_TARGET) * 100);

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <div className="panel" style={{ flex: 1, textAlign: "center", background: "#0D6E5E", color: "#FBF6EC", margin: 0 }}>
          <div style={{ fontSize: 14, opacity: 0.85, fontWeight: 700 }}>نحن</div>
          <div style={{ fontSize: 44, fontWeight: 800 }}>{us}</div>
          <div className="progress-track" style={{ marginTop: 6 }}><div className="progress-fill" style={{ width: `${pctUs}%`, background: "#C9971F" }} /></div>
        </div>
        <div className="panel" style={{ flex: 1, textAlign: "center", background: "#8B1538", color: "#FBF6EC", margin: 0 }}>
          <div style={{ fontSize: 14, opacity: 0.85, fontWeight: 700 }}>هم</div>
          <div style={{ fontSize: 44, fontWeight: 800 }}>{them}</div>
          <div className="progress-track" style={{ marginTop: 6 }}><div className="progress-fill" style={{ width: `${pctThem}%`, background: "#C9971F" }} /></div>
        </div>
      </div>

      {winner ? (
        <div className="panel" style={{ textAlign: "center", background: "#C9971F", color: "#0F172A", fontWeight: 800 }}>
          🏆 {winner} فازوا بالقيم!
          <div style={{ marginTop: 10 }}><button className="pill pill-active" onClick={newMatch}>قيم جديد</button></div>
        </div>
      ) : (
        <div className="panel">
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <NumField label="نحن" value={inputUs} onChange={setInputUs} />
            <NumField label="هم" value={inputThem} onChange={setInputThem} />
          </div>
          <button onClick={addEntry} style={{ width: "100%", background: "#C9971F", border: "none", borderRadius: 10, padding: 12, fontWeight: 800, marginBottom: 8 }}>أضف</button>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={undoLast} disabled={history.length === 0} className="pill" style={{ flex: 1, background: "#8B1538", color: "#fff", opacity: history.length === 0 ? 0.4 : 1 }}>تراجع</button>
            <button onClick={newMatch} className="pill pill-inactive" style={{ flex: 1 }}>قيم جديد</button>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="panel">
          <h3 style={{ marginTop: 0, fontSize: 15 }}>السجل</h3>
          {history.slice().reverse().map((h, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, borderBottom: "1px solid #E8DCC0", padding: "5px 0" }}>
              <span style={{ opacity: 0.7 }}>نحن +{h.u} · هم +{h.t}</span>
              <span style={{ fontWeight: 700 }}>{h.cumUs} - {h.cumThem}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatsScreen({ stats }) {
  const players = Object.keys(stats).sort((a, b) => stats[b].wins - stats[a].wins);
  const [expanded, setExpanded] = useState(null);
  if (players.length === 0) return <div className="panel" style={{ textAlign: "center", opacity: 0.7 }}>ما فيه قيم Ranked محفوظ بعد.</div>;

  return (
    <div className="panel">
      <h3 style={{ marginTop: 0 }}>إحصائيات اللاعبين (كل الأوقات)</h3>
      {players.map((name) => {
        const s = stats[name];
        const isOpen = expanded === name;
        const rating = computeRating(stats, name);
        return (
          <div key={name} style={{ borderBottom: "1px solid #E8DCC0", padding: "10px 0" }}>
            <div onClick={() => setExpanded(isOpen ? null : name)} style={{ display: "flex", justifyContent: "space-between", cursor: "pointer" }}>
              <span style={{ fontWeight: 700 }}>{name} {rating !== null && <span style={{ fontSize: 12, opacity: 0.6 }}>({rating}% فوز)</span>}</span>
              <span>
                <span style={{ color: "#0D6E5E", fontWeight: 700 }}>{s.wins} فوز</span>{"  ·  "}
                <span style={{ color: "#8B1538", fontWeight: 700 }}>{s.losses} خسارة</span>{"  "}
                <span style={{ opacity: 0.5 }}>{isOpen ? "▲" : "▼"}</span>
              </span>
            </div>
            {isOpen && (
              <div style={{ marginTop: 10, fontSize: 13, background: "#fff", borderRadius: 8, padding: 10 }}>
                {rating === null && <div style={{ opacity: 0.6, marginBottom: 8 }}>التقييم يظهر بعد {MIN_RANKED_FOR_RATING} قيم Ranked على الأقل (الحالي: {s.ranked})</div>}
                <div style={{ marginBottom: 6, fontWeight: 700 }}>مع كل شريك:</div>
                {Object.keys(s.partners).length === 0 && <div style={{ opacity: 0.6 }}>لا يوجد بعد</div>}
                {Object.entries(s.partners).map(([partner, pr]) => (<div key={partner} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span>مع {partner}</span><span>{pr.wins} فوز - {pr.losses} خسارة</span></div>))}
                <div style={{ margin: "10px 0 6px", fontWeight: 700 }}>المشاريع المنزّلة:</div>
                {Object.keys(s.projects).length === 0 && <div style={{ opacity: 0.6 }}>لا يوجد</div>}
                {Object.entries(s.projects).map(([key, count]) => { const proj = PROJECTS.find((p) => p.key === key); return (<div key={key} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span>{proj ? proj.label : key}</span><span>{count} مرة</span></div>); })}
                <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between" }}><span>مرات التسبب بقيد</span><span style={{ fontWeight: 700 }}>{s.qaid}</span></div>
                <div style={{ marginTop: 4, display: "flex", justifyContent: "space-between" }}><span>مرات شراء صن</span><span style={{ fontWeight: 700 }}>{s.sunBuys}</span></div>
                <div style={{ marginTop: 4, display: "flex", justifyContent: "space-between" }}><span>مرات شراء حكم</span><span style={{ fontWeight: 700 }}>{s.hokomBuys}</span></div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function LogScreen({ matches, onDelete }) {
  const [pwTarget, setPwTarget] = useState(null);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState("");

  if (matches.length === 0) return <div className="panel" style={{ textAlign: "center", opacity: 0.7 }}>ما فيه قيمات محفوظة بعد.</div>;
  const sorted = matches.slice().sort((a, b) => new Date(b.date) - new Date(a.date));

  function confirmDelete() {
    if (pwInput !== DELETE_PASSWORD) { setPwError("كلمة المرور غلط"); return; }
    onDelete(pwTarget);
    setPwTarget(null); setPwInput(""); setPwError("");
  }

  return (
    <div className="panel">
      <h3 style={{ marginTop: 0 }}>سجل القيمات</h3>
      {sorted.map((m) => (
        <div key={m.date} style={{ borderBottom: "1px solid #E8DCC0", padding: "10px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 12, opacity: 0.6 }}>{fullDateTime(m.date)}</div>
              <div style={{ fontWeight: 700, fontSize: 14, marginTop: 2 }}>{m.teamA.join(" و ")} <span style={{ opacity: 0.5 }}>ضد</span> {m.teamB.join(" و ")}</div>
              <div style={{ fontSize: 13, marginTop: 2 }}>
                النتيجة: {m.finalA} - {m.finalB} ·{" "}
                <span style={{ fontWeight: 700, color: "#0D6E5E" }}>فاز {(m.winningTeam === "A" ? m.teamA : m.teamB).join(" و ")}</span>{"  "}
                <span className="badge" style={{ background: m.mode === "ranked" ? "#C9971F" : "#888" }}>{m.mode === "ranked" ? "Ranked" : "بسيط"}</span>
              </div>
            </div>
            <button onClick={() => { setPwTarget(m.date); setPwInput(""); setPwError(""); }} style={{ background: "#8B1538", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>حذف</button>
          </div>
          {pwTarget === m.date && (
            <div style={{ marginTop: 8, background: "#fff", borderRadius: 8, padding: 10 }}>
              <label>كلمة مرور الحذف</label>
              <input type="password" value={pwInput} onChange={(e) => setPwInput(e.target.value)} style={{ marginBottom: 6 }} />
              {pwError && <div style={{ color: "#8B1538", fontSize: 12, marginBottom: 6 }}>{pwError}</div>}
              <div style={{ display: "flex", gap: 6 }}>
                <button className="pill" style={{ background: "#8B1538", color: "#fff" }} onClick={confirmDelete}>تأكيد الحذف</button>
                <button className="pill pill-inactive" onClick={() => setPwTarget(null)}>إلغاء</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ArchiveScreen({ matches, currentMonthKey }) {
  const months = Array.from(new Set(matches.map((m) => monthKey(m.date)))).sort().reverse();
  const [selected, setSelected] = useState(null);
  if (months.length === 0) return <div className="panel" style={{ textAlign: "center", opacity: 0.7 }}>ما فيه أرشيف بعد.</div>;

  if (selected) {
    const monthMatches = matches.filter((m) => monthKey(m.date) === selected);
    const stats = computeStats(monthMatches);
    const titles = computeTitles(stats);
    return (
      <div>
        <button className="pill pill-inactive" style={{ marginBottom: 12 }} onClick={() => setSelected(null)}>‹ رجوع للأرشيف</button>
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>{monthLabel(selected)} {selected === currentMonthKey && "(الشهر الحالي)"}</h3>
          <TitlesBar titles={titles} />
          <div style={{ fontSize: 13, opacity: 0.7 }}>عدد القيمات Ranked: {monthMatches.filter((m) => m.mode === "ranked").length} · عدد القيمات البسيطة: {monthMatches.filter((m) => m.mode === "casual").length}</div>
        </div>
        <StatsScreen stats={stats} />
      </div>
    );
  }

  return (
    <div className="panel">
      <h3 style={{ marginTop: 0 }}>الأرشيف الشهري</h3>
      {months.map((mk) => (
        <button key={mk} onClick={() => setSelected(mk)} style={{ display: "block", width: "100%", textAlign: "right", background: mk === currentMonthKey ? "#0D6E5E" : "#E8DCC0", color: mk === currentMonthKey ? "#FBF6EC" : "#6B5D45", border: "none", borderRadius: 8, padding: "10px 14px", marginBottom: 6, fontWeight: 700 }}>
          {monthLabel(mk)} {mk === currentMonthKey && "· الحالي"}
        </button>
      ))}
    </div>
  );
}
