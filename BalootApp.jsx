import React, { useState, useEffect } from "react";

// ================= Game constants =================
const SUN_TOTAL = 130;
const HOKOM_TOTAL = 162;
const MATCH_TARGET = 152;
const DELETE_PASSWORD = "بلوت";

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
  if (raw <= 14) return 2; if (raw === 15) return 3;
  if (raw <= 24) return 4; if (raw === 25) return 5;
  if (raw <= 34) return 6; if (raw === 35) return 7;
  if (raw <= 44) return 8; if (raw === 45) return 9;
  if (raw <= 54) return 10; if (raw === 55) return 11;
  if (raw <= 64) return 12; if (raw === 65) return 13;
  if (raw <= 74) return 14; if (raw === 75) return 15;
  if (raw <= 84) return 16; if (raw === 85) return 17;
  if (raw <= 94) return 18; if (raw === 95) return 19;
  if (raw <= 104) return 20; if (raw === 105) return 21;
  if (raw <= 114) return 22; if (raw === 115) return 23;
  if (raw <= 124) return 24; if (raw === 125) return 25;
  return 26;
}
function hokomNormalizeOpponent(raw) {
  if (raw <= 15) return 1;
  return 2 + Math.floor((raw - 16) / 10);
}

const PROJECTS = [
  { key: "sara",    label: "سرا",   sun: 4,  hokom: 2  },
  { key: "khamsen", label: "خمسين", sun: 10, hokom: 5  },
  { key: "miya",    label: "١٠٠",   sun: 20, hokom: 10 },
  { key: "arbaa",   label: "٤٠٠",   sun: 40, hokom: null, sunOnly: true  },
  { key: "blot",    label: "بلوت",  sun: null, hokom: 2, hokomOnly: true },
];

const TITLES = {
  mohannak: "محنك",
  shuja:    "شجاع",
  ghashash: "هطف",
  mahzoo:   "حظ هنود",
  khawwaf:  "مزهرية",
  baidh:    "لو قاعد فالبيت احسن",
  ustora:   "المعزب",
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
const MIN_RANKED_FOR_TITLE  = 5;

async function loadMatches() {
  try {
    const snap = await getDoc(MATCHES_DOC);
    if (snap.exists()) return snap.data().list || [];
  } catch (e) { console.error("Firestore load failed", e); }
  return [];
}
async function saveMatches(matches) {
  try { await setDoc(MATCHES_DOC, { list: matches }); }
  catch (e) { console.error("Firestore save failed", e); }
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
  const mins  = String(d.getMinutes()).padStart(2, "0");
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
    const losers  = winningTeam === "A" ? teamB : teamA;
    for (const n of winners) ensure(n).wins   += 1;
    for (const n of losers)  ensure(n).losses += 1;
    function trackPartner(team, didWin) {
      if (team.length === 2) {
        const [p1, p2] = team;
        const s1 = ensure(p1), s2 = ensure(p2);
        if (!s1.partners[p2]) s1.partners[p2] = { wins: 0, losses: 0 };
        if (!s2.partners[p1]) s2.partners[p1] = { wins: 0, losses: 0 };
        if (didWin) { s1.partners[p2].wins++; s2.partners[p1].wins++; }
        else        { s1.partners[p2].losses++; s2.partners[p1].losses++; }
      }
    }
    trackPartner(teamA, winningTeam === "A");
    trackPartner(teamB, winningTeam === "B");
    for (const r of m.rounds || []) {
      if (r.qaidPlayer) ensure(r.qaidPlayer).qaid += 1;
      if (r.projectDetails)
        for (const pd of r.projectDetails) {
          const s = ensure(pd.player);
          s.projects[pd.key] = (s.projects[pd.key] || 0) + pd.count;
          s.projectsTotal += pd.count;
        }
      if (r.buyerPlayer && r.game) {
        const s = ensure(r.buyerPlayer);
        if (r.game === "sun")   s.sunBuys  += 1;
        if (r.game === "hokom") s.hokomBuys += 1;
      }
    }
  }
  return stats;
}

function computeTitles(stats) {
  const names = Object.keys(stats).filter((n) => stats[n].ranked >= MIN_RANKED_FOR_TITLE);
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
    shuja:    topBy("sunBuys",   "مرة شراء صن"),
    ghashash: topBy("qaid",      "مرة تسبب بقيد"),
    mahzoo:   topBy("projectsTotal", "مشروع"),
    khawwaf:  leastBuyer(),
    baidh:    topBy("losses",    "خسارة"),
    ustora:   topBy("wins",      "فوز"),
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
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch (e) { return fallback; }
}
function saveLocal(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
}

// =====================================================================
// GlobalStyle
// =====================================================================
function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=IBM+Plex+Sans+Arabic:wght@400;500;600&display=swap');

      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

      body {
        background: #FAFAF7;
        font-family: 'IBM Plex Sans Arabic', 'Segoe UI', sans-serif;
        direction: rtl;
        color: #1A1410;
        -webkit-font-smoothing: antialiased;
      }

      button { font-family: inherit; cursor: pointer; border: none; }

      /* Cards */
      .card {
        background: #FFFFFF;
        border-radius: 16px;
        border: 1px solid #EBE7DE;
        padding: 16px;
        margin-bottom: 12px;
        box-shadow: 0 1px 6px rgba(0,0,0,0.05);
      }

      /* Pills */
      .pill { border-radius: 999px; padding: 8px 16px; font-size: 13px; font-weight: 600; transition: background 0.15s, color 0.15s; font-family: 'Cairo', sans-serif; }
      .pill-active   { background: #0E6F5C; color: #fff; }
      .pill-inactive { background: #EBE7DE; color: #6B5D45; }
      .pill-red      { background: #9C3848; color: #fff; }
      .pill-gold     { background: #B8860B; color: #fff; }

      /* Inputs */
      input[type=text], input[type=password] {
        border: 1.5px solid #EBE7DE;
        border-radius: 10px;
        padding: 10px 12px;
        font-size: 14px;
        width: 100%;
        background: #FAFAF7;
        color: #1A1410;
        font-family: 'IBM Plex Sans Arabic', sans-serif;
        outline: none;
        transition: border-color 0.15s;
      }
      input[type=text]:focus, input[type=password]:focus { border-color: #0E6F5C; }

      label {
        font-size: 12px;
        display: block;
        margin-bottom: 6px;
        color: #9A8F7E;
        font-family: 'IBM Plex Sans Arabic', sans-serif;
        font-weight: 500;
      }
      label.bold-label {
        font-size: 13px;
        font-weight: 700;
        color: #1A1410;
        font-family: 'Cairo', sans-serif;
        margin-bottom: 8px;
      }

      /* Progress */
      .progress-track { height: 6px; background: rgba(255,255,255,0.25); border-radius: 999px; overflow: hidden; margin-top: 8px; }
      .progress-fill  { height: 100%; border-radius: 999px; background: rgba(255,255,255,0.7); transition: width 0.4s ease; }

      /* Badge */
      .badge { display: inline-block; background: #B8860B; color: #fff; border-radius: 999px; padding: 2px 10px; font-size: 11px; font-weight: 700; font-family: 'Cairo', sans-serif; }

      /* Bottom Nav */
      .bottom-nav {
        position: fixed;
        bottom: 0; left: 0; right: 0;
        background: #FFFFFF;
        border-top: 1px solid #EBE7DE;
        display: flex;
        justify-content: space-around;
        align-items: flex-end;
        padding: 6px 0 18px;
        z-index: 100;
        box-shadow: 0 -2px 16px rgba(0,0,0,0.07);
        direction: ltr;
      }
      .nav-btn {
        display: flex; flex-direction: column; align-items: center; gap: 3px;
        background: none; border: none; padding: 4px 8px; cursor: pointer; min-width: 52px;
      }
      .nav-icon  { font-size: 22px; line-height: 1; }
      .nav-label { font-size: 10px; font-weight: 600; color: #B0A898; font-family: 'Cairo', sans-serif; }
      .nav-btn.active .nav-label { color: #0E6F5C; }
      .nav-center-wrap { display: flex; flex-direction: column; align-items: center; gap: 3px; margin-bottom: 4px; }
      .nav-center-btn {
        width: 50px; height: 50px; border-radius: 50%;
        background: #0E6F5C;
        display: flex; align-items: center; justify-content: center;
        font-size: 22px;
        box-shadow: 0 4px 14px rgba(14,111,92,0.4);
        border: 3px solid #FAFAF7;
        margin-top: -18px;
        cursor: pointer;
      }
      .nav-center-btn.active { background: #0a5546; }

      /* Title chips */
      .chips-row {
        display: flex; gap: 8px;
        overflow-x: auto; padding-bottom: 4px;
        scrollbar-width: none;
      }
      .chips-row::-webkit-scrollbar { display: none; }
      .title-chip {
        flex-shrink: 0;
        background: #F7EFDC;
        border: 1px solid #D4A83340;
        border-radius: 999px;
        padding: 6px 14px;
        font-size: 12px; font-weight: 700;
        color: #7A5500;
        white-space: nowrap;
        font-family: 'Cairo', sans-serif;
        cursor: default;
        position: relative;
      }

      /* Stat row */
      .stat-box {
        flex: 1; text-align: center;
        background: #FFFFFF;
        border: 1px solid #EBE7DE;
        border-radius: 14px;
        padding: 12px 8px;
      }
      .stat-num   { font-size: 26px; font-weight: 800; font-family: 'Cairo', sans-serif; color: #1A1410; }
      .stat-label { font-size: 11px; color: #9A8F7E; margin-top: 2px; font-family: 'IBM Plex Sans Arabic', sans-serif; }

      /* Section heading */
      .section-head {
        font-size: 11px; font-weight: 700; color: #B0A898; letter-spacing: 1px;
        font-family: 'Cairo', sans-serif; margin-bottom: 8px; text-transform: uppercase;
      }
    `}</style>
  );
}

// =====================================================================
// Header
// =====================================================================
function Header() {
  return (
    <div style={{ textAlign: "center", padding: "20px 16px 12px" }}>
      <h1 style={{
        fontFamily: "'Cairo', sans-serif",
        fontSize: 28, fontWeight: 900,
        color: "#1A1410", letterSpacing: 0.5,
      }}>
        الميلس
      </h1>
      <div style={{ width: 40, height: 2, background: "#B8860B", margin: "6px auto 0", borderRadius: 99 }} />
    </div>
  );
}

// =====================================================================
// Bottom Nav
// =====================================================================
function BottomNav({ view, setView, hasMatch }) {
  const left = [
    { key: "archive", label: "أرشيف",      icon: "🗂" },
    { key: "stats",   label: "إحصائيات",   icon: "📊" },
  ];
  const right = [
    { key: "log",  label: "السجل",        icon: "📋" },
    { key: "play", label: "القيم الحالي", icon: "⚡" },
  ];

  return (
    <nav className="bottom-nav">
      {left.map((t) => (
        <button key={t.key} className={`nav-btn ${view === t.key ? "active" : ""}`} onClick={() => setView(t.key)}>
          <span className="nav-icon">{t.icon}</span>
          <span className="nav-label">{t.label}</span>
        </button>
      ))}

      <div className="nav-center-wrap">
        <button className={`nav-center-btn ${view === "setup" ? "active" : ""}`} onClick={() => setView("setup")}>
          🎴
        </button>
        <span className="nav-label" style={{ color: view === "setup" ? "#0E6F5C" : "#B0A898" }}>اللعب</span>
      </div>

      {right.map((t) => (
        <button key={t.key} className={`nav-btn ${view === t.key ? "active" : ""}`} onClick={() => setView(t.key)}>
          <span className="nav-icon">{t.icon}{t.key === "play" && hasMatch ? <span style={{ fontSize: 8, color: "#0E6F5C", verticalAlign: "top" }}>●</span> : null}</span>
          <span className="nav-label">{t.label}</span>
        </button>
      ))}
    </nav>
  );
}

// =====================================================================
// Main App
// =====================================================================
export default function BalootApp() {
  const [view, setView]               = useState(() => loadLocal("baloot_view", "setup"));
  const [matches, setMatches]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [names, setNames]             = useState({ A1: "", A2: "", B1: "", B2: "" });
  const [matchMode, setMatchMode]     = useState("ranked");
  const [activeMatch, setActiveMatch] = useState(() => loadLocal("baloot_active_match", null));
  const [casual, setCasual]           = useState(() => loadLocal("baloot_casual", { us: 0, them: 0, history: [] }));

  useEffect(() => { loadMatches().then((m) => { setMatches(m); setLoading(false); }); }, []);
  useEffect(() => { saveLocal("baloot_active_match", activeMatch); }, [activeMatch]);
  useEffect(() => { saveLocal("baloot_casual",       casual);      }, [casual]);
  useEffect(() => { saveLocal("baloot_view",         view);        }, [view]);

  function startMatch() {
    const { A1, A2, B1, B2 } = names;
    if (!A1 || !A2 || !B1 || !B2) return;
    setActiveMatch({ teamA: [A1, A2], teamB: [B1, B2], cumA: 0, cumB: 0, rounds: [], winner: null, mode: matchMode });
    setView("play");
  }

  async function finishMatch(updated) {
    if (updated.winner) {
      const record = {
        date: new Date().toISOString(), mode: updated.mode,
        teamA: updated.teamA, teamB: updated.teamB,
        winningTeam: updated.winner, finalA: updated.cumA, finalB: updated.cumB,
        rounds: updated.rounds,
      };
      const next = [...matches, record];
      setMatches(next);
      await saveMatches(next);
    }
  }

  function cancelMatch() { setActiveMatch(null); setView("setup"); }

  async function deleteMatch(date) {
    const next = matches.filter((m) => m.date !== date);
    setMatches(next); await saveMatches(next);
  }

  async function removeLastSavedMatch() {
    if (matches.length === 0) return;
    const next = matches.slice(0, -1);
    setMatches(next); await saveMatches(next);
  }

  const now = new Date();
  const currentMonthKey     = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const currentMonthMatches = matches.filter((m) => monthKey(m.date) === currentMonthKey);
  const currentStats        = computeStats(currentMonthMatches);
  const titles              = computeTitles(currentStats);
  const allTimeStats        = computeStats(matches);

  function renderView() {
    if (loading) return (
      <div style={{ textAlign: "center", padding: 60, color: "#9A8F7E", fontFamily: "Cairo, sans-serif" }}>
        جاري التحميل...
      </div>
    );
    if (view === "setup") {
      if (matchMode === "casual") return (
        <div>
          <div className="card">
            <div style={{ display: "flex", gap: 8 }}>
              <button className="pill pill-inactive" onClick={() => setMatchMode("ranked")}>Ranked</button>
              <button className="pill pill-active"   onClick={() => setMatchMode("casual")}>بسيط</button>
            </div>
          </div>
          <CasualScreen casual={casual} setCasual={setCasual} />
        </div>
      );
      return (
        <HomeScreen
          names={names} setNames={setNames}
          matchMode={matchMode} setMatchMode={setMatchMode}
          onStart={startMatch}
          titles={titles}
        />
      );
    }
    if (view === "play") return activeMatch
      ? <PlayScreen match={activeMatch} setMatch={setActiveMatch} onFinish={finishMatch} onCancel={cancelMatch} onUndoFinish={removeLastSavedMatch} onNewMatch={() => { setActiveMatch(null); setView("setup"); }} />
      : <div className="card" style={{ textAlign: "center", color: "#9A8F7E", fontFamily: "Cairo, sans-serif" }}>ما في قيم جاري — ابدأ قيم جديد من اللعب</div>;
    if (view === "stats")   return <StatsScreen stats={allTimeStats} />;
    if (view === "log")     return <LogScreen matches={matches} onDelete={deleteMatch} />;
    if (view === "archive") return <ArchiveScreen matches={matches} currentMonthKey={currentMonthKey} />;
  }

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAF7", direction: "rtl" }}>
      <GlobalStyle />
      <Header />
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 14px 100px" }}>
        {renderView()}
      </div>
      <BottomNav view={view} setView={setView} hasMatch={!!activeMatch} />
    </div>
  );
}

// =====================================================================
// Home Screen
// =====================================================================
function HomeScreen({ names, setNames, matchMode, setMatchMode, onStart, titles }) {
  function update(field, val) { setNames({ ...names, [field]: val }); }
  const ready = names.A1 && names.A2 && names.B1 && names.B2;
  const titleEntries = Object.entries(titles).filter(([, v]) => v);
  const [tipKey, setTipKey] = useState(null);

  return (
    <div>
      {/* Titles sliding chips */}
      {titleEntries.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div className="section-head">👑 ألقاب الشهر</div>
          <div className="chips-row">
            {titleEntries.map(([key, info]) => (
              <span key={key} style={{ position: "relative" }}>
                <button
                  className="title-chip"
                  onClick={() => setTipKey(tipKey === key ? null : key)}
                >
                  {info.name}: {TITLES[key]}
                </button>
                {tipKey === key && (
                  <span style={{
                    position: "absolute", top: "110%", right: 0,
                    background: "#1A1410", color: "#FAFAF7",
                    padding: "6px 12px", borderRadius: 10, fontSize: 12,
                    whiteSpace: "nowrap", zIndex: 20,
                    boxShadow: "0 4px 14px rgba(0,0,0,0.2)",
                    fontFamily: "'IBM Plex Sans Arabic', sans-serif",
                  }}>
                    {info.value} {info.criteriaLabel}
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Setup form */}
      <div className="card">
        <div style={{ fontFamily: "'Cairo', sans-serif", fontWeight: 800, fontSize: 15, marginBottom: 12 }}>إعداد قيم</div>

        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <button className={`pill ${matchMode === "ranked" ? "pill-active" : "pill-inactive"}`} onClick={() => setMatchMode("ranked")}>Ranked</button>
          <button className={`pill ${matchMode === "casual" ? "pill-active" : "pill-inactive"}`} onClick={() => setMatchMode("casual")}>بسيط</button>
        </div>

        <div style={{ display: "flex", gap: 0, marginBottom: 18, alignItems: "stretch", position: "relative" }}>
          {/* فريق A */}
          <div style={{ flex: 1, background: "#FFFFFF", border: "1px solid #EBE7DE", borderTop: "3px solid #0E6F5C", borderRadius: "14px 0 0 14px", padding: "12px 10px" }}>
            <div style={{ fontFamily: "'Cairo', sans-serif", fontWeight: 800, fontSize: 13, color: "#0E6F5C", marginBottom: 10, textAlign: "center" }}>فريق A</div>
            <div style={{ marginBottom: 8 }}>
              <label>لاعب ١</label>
              <input type="text" value={names.A1} onChange={(e) => update("A1", e.target.value)} style={{ background: "#fff", borderRadius: 11, border: "1px solid #EBE7DE" }} />
            </div>
            <div>
              <label>لاعب ٢</label>
              <input type="text" value={names.A2} onChange={(e) => update("A2", e.target.value)} style={{ background: "#fff", borderRadius: 11, border: "1px solid #EBE7DE" }} />
            </div>
          </div>

          {/* VS badge */}
          <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", zIndex: 2, background: "#fff", border: "1px solid #EBE7DE", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Cairo', sans-serif", fontWeight: 800, fontSize: 11, color: "#9A8F7E", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
            VS
          </div>

          {/* فريق B */}
          <div style={{ flex: 1, background: "#FFFFFF", border: "1px solid #EBE7DE", borderTop: "3px solid #9C3848", borderRadius: "0 14px 14px 0", padding: "12px 10px" }}>
            <div style={{ fontFamily: "'Cairo', sans-serif", fontWeight: 800, fontSize: 13, color: "#9C3848", marginBottom: 10, textAlign: "center" }}>فريق B</div>
            <div style={{ marginBottom: 8 }}>
              <label>لاعب ١</label>
              <input type="text" value={names.B1} onChange={(e) => update("B1", e.target.value)} style={{ background: "#fff", borderRadius: 11, border: "1px solid #EBE7DE" }} />
            </div>
            <div>
              <label>لاعب ٢</label>
              <input type="text" value={names.B2} onChange={(e) => update("B2", e.target.value)} style={{ background: "#fff", borderRadius: 11, border: "1px solid #EBE7DE" }} />
            </div>
          </div>
        </div>

        <button
          disabled={!ready}
          onClick={onStart}
          style={{
            width: "100%", padding: "13px 0",
            background: ready ? "#0E6F5C" : "#EBE7DE",
            color: ready ? "#fff" : "#B0A898",
            border: "none", borderRadius: 12,
            fontWeight: 800, fontSize: 15,
            fontFamily: "'Cairo', sans-serif",
            transition: "background 0.2s",
          }}
        >
          ابدأ القيم
        </button>
      </div>
    </div>
  );
}

// =====================================================================
// Play Screen
// =====================================================================
function PlayScreen({ match, setMatch, onFinish, onCancel, onUndoFinish, onNewMatch }) {
  const { teamA, teamB, cumA, cumB, rounds, winner, mode } = match;
  const allPlayers = [...teamA, ...teamB];

  const [game,          setGame]          = useState("sun");
  const [buyerPlayer,   setBuyerPlayer]   = useState("");
  const [kabootTeam,    setKabootTeam]    = useState(null);
  const [projectTeam,   setProjectTeam]   = useState("none");
  const [projectAssign, setProjectAssign] = useState({});
  const [genA,          setGenA]          = useState("");
  const [genB,          setGenB]          = useState("");
  const [qaidPlayer,    setQaidPlayer]    = useState("");
  const [error,         setError]         = useState("");
  const [showSwap,      setShowSwap]      = useState(false);
  const [swapOld,       setSwapOld]       = useState("");
  const [swapNew,       setSwapNew]       = useState("");
  const [showKaboot,    setShowKaboot]    = useState(false);
  const [showBuyer,     setShowBuyer]     = useState(false);
  const [showProjects,  setShowProjects]  = useState(false);

  function resetForm() {
    setKabootTeam(null); setProjectTeam("none"); setProjectAssign({});
    setGenA(""); setGenB(""); setQaidPlayer(""); setBuyerPlayer(""); setError("");
    setShowKaboot(false); setShowBuyer(false); setShowProjects(false);
  }

  function adjustProjectAssign(projectKey, player, delta) {
    setProjectAssign((prev) => {
      const projCounts = { ...(prev[projectKey] || {}) };
      const next = Math.max(0, (projCounts[player] || 0) + delta);
      if (next === 0) delete projCounts[player]; else projCounts[player] = next;
      return { ...prev, [projectKey]: projCounts };
    });
  }

  function projectsBreakdown() {
    let total = 0; const details = [];
    for (const key of Object.keys(projectAssign)) {
      const proj     = PROJECTS.find((p) => p.key === key);
      const perPlayer = projectAssign[key] || {};
      for (const player of Object.keys(perPlayer)) {
        const count = perPlayer[player]; if (!count) continue;
        const val = (game === "sun" ? proj.sun : proj.hokom) * count;
        total += val; details.push({ key, player, count });
      }
    }
    return { all: total, details };
  }

  function computeRound() {
    setError("");
    const { details } = projectsBreakdown();
    const kabootLabel = kabootTeam
      ? `كبوت (${kabootTeam === "A" ? teamA.join(" / ") : teamB.join(" / ")})`
      : null;

    if (qaidPlayer) {
      const a = toInt(genA), b = toInt(genB);
      if (isNaN(a) || isNaN(b)) { setError("أدخل رقمين صحيحين"); return null; }
      return { label: "قيد", A: a, B: b, qaidPlayer };
    }
    const a = toInt(genA), b = toInt(genB);
    if (isNaN(a) || isNaN(b)) { setError("أدخل رقمين صحيحين"); return null; }
    return {
      label: kabootLabel || (buyerPlayer ? `${game === "sun" ? "صن" : "حكم"}-${buyerPlayer}` : "كوت"),
      A: a, B: b,
      buyerPlayer: buyerPlayer || null,
      game: buyerPlayer ? game : null,
      projectDetails: projectTeam !== "none" && details.length > 0 ? details : null,
    };
  }

  function addRound() {
    const res = computeRound(); if (!res) return;
    const newCumA  = cumA + res.A, newCumB = cumB + res.B;
    const newRounds = [...rounds, { ...res, cumA: newCumA, cumB: newCumB }];
    let newWinner = null;
    if (res.instantWin) newWinner = res.instantWin;
    else if (newCumA >= MATCH_TARGET && newCumB >= MATCH_TARGET) { if (newCumA !== newCumB) newWinner = newCumA > newCumB ? "A" : "B"; }
    else if (newCumA >= MATCH_TARGET) newWinner = "A";
    else if (newCumB >= MATCH_TARGET) newWinner = "B";
    const updated = { ...match, cumA: newCumA, cumB: newCumB, rounds: newRounds, winner: newWinner };
    setMatch(updated); resetForm();
    if (newWinner) onFinish(updated);
  }

  function undoLastRound() {
    if (rounds.length === 0) return;
    const wasFinished = !!winner;
    const newRounds   = rounds.slice(0, -1);
    const newCumA     = newRounds.reduce((s, r) => s + r.A, 0);
    const newCumB     = newRounds.reduce((s, r) => s + r.B, 0);
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
      qaidPlayer:     r.qaidPlayer  === swapOld ? swapNew : r.qaidPlayer,
      buyerPlayer:    r.buyerPlayer === swapOld ? swapNew : r.buyerPlayer,
      projectDetails: r.projectDetails
        ? r.projectDetails.map((d) => (d.player === swapOld ? { ...d, player: swapNew } : d))
        : r.projectDetails,
    }));
    setMatch({ ...match, teamA: replace(teamA), teamB: replace(teamB), rounds: newRounds });
    setShowSwap(false); setSwapOld(""); setSwapNew("");
  }

  const pctA = Math.min(100, (cumA / MATCH_TARGET) * 100);
  const pctB = Math.min(100, (cumB / MATCH_TARGET) * 100);
  const projTeamPlayers = projectTeam === "A" ? teamA : projectTeam === "B" ? teamB : [];

  // Score card style
  const scoreCard = (team, cum, pct, bg) => (
    <div style={{ flex: 1, background: bg, borderRadius: 16, padding: "14px 12px", color: "#fff" }}>
      <div style={{ fontSize: 12, opacity: 0.8, fontFamily: "'IBM Plex Sans Arabic', sans-serif", marginBottom: 4 }}>{team.join(" / ")}</div>
      <div style={{ fontSize: 36, fontWeight: 900, fontFamily: "'Cairo', sans-serif", lineHeight: 1 }}>{cum}</div>
      <div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
    </div>
  );

  return (
    <div>
      {/* Top bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span className="badge" style={{ background: mode === "ranked" ? "#B8860B" : "#9A8F7E" }}>
          {mode === "ranked" ? "Ranked" : "بسيط"}
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="pill pill-inactive" style={{ fontSize: 12 }} onClick={() => setShowSwap(!showSwap)}>تبديل لاعب</button>
          <button className="pill pill-red"      style={{ fontSize: 12 }} onClick={onCancel}>إلغاء</button>
        </div>
      </div>

      {/* Swap panel */}
      {showSwap && (
        <div className="card">
          <label>اللاعب الحالي</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {allPlayers.map((p) => (
              <button key={p} className={`pill ${swapOld === p ? "pill-active" : "pill-inactive"}`} onClick={() => setSwapOld(p)}>{p}</button>
            ))}
          </div>
          <label>الاسم الجديد</label>
          <input type="text" value={swapNew} onChange={(e) => setSwapNew(e.target.value)} style={{ marginBottom: 10 }} />
          <button className="pill pill-active" onClick={doSwap}>تأكيد التبديل</button>
        </div>
      )}

      {/* Score */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        {scoreCard(teamA, cumA, pctA, "#0E6F5C")}
        {scoreCard(teamB, cumB, pctB, "#9C3848")}
      </div>

      {/* Winner */}
      {winner ? (
        <div className="card" style={{ textAlign: "center", background: "#0E6F5C", border: "none" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", fontFamily: "'Cairo', sans-serif", marginBottom: 6 }}>
            🏆 الناموووس
          </div>
          {(winner === "A" ? teamA : teamB).map((name) => (
            <div key={name} style={{ fontSize: 28, fontWeight: 900, color: "#fff", fontFamily: "'Cairo', sans-serif", lineHeight: 1.2 }}>{name}</div>
          ))}
          <div style={{ marginTop: 14 }}>
            <button className="pill" style={{ background: "#fff", color: "#0E6F5C", fontWeight: 800 }} onClick={onNewMatch}>قيم ثاني؟</button>
          </div>
        </div>
      ) : (
        <div className="card">
          {/* Score inputs */}
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <label>{teamA.join(" / ")}</label>
              <input type="text" inputMode="numeric" value={genA} onChange={(e) => setGenA(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label>{teamB.join(" / ")}</label>
              <input type="text" inputMode="numeric" value={genB} onChange={(e) => setGenB(e.target.value)} />
            </div>
          </div>

          {/* قيد */}
          <label className="bold-label">قيد</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
            <button className={`pill ${!qaidPlayer ? "pill-active" : "pill-inactive"}`} onClick={() => setQaidPlayer("")}>لا</button>
            {allPlayers.map((p) => (
              <button key={p} className={`pill ${qaidPlayer === p ? "pill-active" : "pill-inactive"}`} onClick={() => setQaidPlayer(p)}>{p}</button>
            ))}
          </div>

          {!qaidPlayer && (
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <button className={`pill ${game === "sun"   ? "pill-active" : "pill-inactive"}`} onClick={() => setGame("sun")}>صن</button>
              <button className={`pill ${game === "hokom" ? "pill-active" : "pill-inactive"}`} onClick={() => setGame("hokom")}>حكم</button>
            </div>
          )}

          {!qaidPlayer && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <button className={`pill ${showKaboot   ? "pill-active" : "pill-inactive"}`} onClick={() => setShowKaboot(!showKaboot)}>
                كبوت {showKaboot ? "▲" : "▼"}
              </button>
              <button className={`pill ${showBuyer    ? "pill-active" : "pill-inactive"}`} onClick={() => setShowBuyer(!showBuyer)}>
                الشراي {showBuyer ? "▲" : "▼"}
              </button>
              <button className={`pill ${showProjects ? "pill-active" : "pill-inactive"}`} onClick={() => setShowProjects(!showProjects)}>
                مشاريع {showProjects ? "▲" : "▼"}
              </button>
            </div>
          )}

          {/* كبوت */}
          {!qaidPlayer && showKaboot && (
            <div style={{ marginBottom: 12 }}>
              <label className="bold-label">كبوت</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button className={`pill ${kabootTeam === null ? "pill-active" : "pill-inactive"}`} onClick={() => setKabootTeam(null)}>لا</button>
                <button className={`pill ${kabootTeam === "A"  ? "pill-active" : "pill-inactive"}`} onClick={() => setKabootTeam("A")}>{teamA.join(" / ")}</button>
                <button className={`pill ${kabootTeam === "B"  ? "pill-active" : "pill-inactive"}`} onClick={() => setKabootTeam("B")}>{teamB.join(" / ")}</button>
              </div>
            </div>
          )}

          {/* الشراي */}
          {!qaidPlayer && showBuyer && (
            <div style={{ marginBottom: 12 }}>
              <label className="bold-label">الشراي</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button className={`pill ${!buyerPlayer ? "pill-active" : "pill-inactive"}`} onClick={() => setBuyerPlayer("")}>بدون</button>
                {allPlayers.map((p) => (
                  <button key={p} className={`pill ${buyerPlayer === p ? "pill-active" : "pill-inactive"}`} onClick={() => setBuyerPlayer(p)}>{p}</button>
                ))}
              </div>
            </div>
          )}

          {/* مشاريع */}
          {!qaidPlayer && showProjects && (
            <div style={{ marginBottom: 12 }}>
              <label className="bold-label">مشاريع</label>
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                <button className={`pill ${projectTeam === "none" ? "pill-active" : "pill-inactive"}`} onClick={() => { setProjectTeam("none"); setProjectAssign({}); }}>بدون</button>
                <button className={`pill ${projectTeam === "A"    ? "pill-active" : "pill-inactive"}`} onClick={() => setProjectTeam("A")}>{teamA.join(" / ")}</button>
                <button className={`pill ${projectTeam === "B"    ? "pill-active" : "pill-inactive"}`} onClick={() => setProjectTeam("B")}>{teamB.join(" / ")}</button>
              </div>
              {projectTeam !== "none" && (
                <div style={{ background: "#FAFAF7", borderRadius: 10, padding: "10px 12px", border: "1px solid #EBE7DE" }}>
                  <div style={{ display: "grid", gridTemplateColumns: `80px ${PROJECTS.filter((p) => (game === "sun" ? !p.hokomOnly : !p.sunOnly)).map(() => "1fr").join(" ")}`, gap: 4, marginBottom: 8 }}>
                    <span />
                    {PROJECTS.filter((p) => (game === "sun" ? !p.hokomOnly : !p.sunOnly)).map((p) => (
                      <span key={p.key} style={{ fontSize: 11, textAlign: "center", fontWeight: 700, fontFamily: "'Cairo', sans-serif" }}>{p.label}</span>
                    ))}
                  </div>
                  {projTeamPlayers.map((pl) => (
                    <div key={pl} style={{ display: "grid", gridTemplateColumns: `80px ${PROJECTS.filter((p) => (game === "sun" ? !p.hokomOnly : !p.sunOnly)).map(() => "1fr").join(" ")}`, gap: 4, alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontFamily: "'Cairo', sans-serif", fontWeight: 600 }}>{pl}</span>
                      {PROJECTS.filter((p) => (game === "sun" ? !p.hokomOnly : !p.sunOnly)).map((p) => {
                        const count = (projectAssign[p.key] && projectAssign[p.key][pl]) || 0;
                        return (
                          <div key={p.key} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                            <button onClick={() => adjustProjectAssign(p.key, pl, -1)} style={{ background: "#9C3848", color: "#fff", border: "none", borderRadius: 6, width: 20, height: 20, fontSize: 13, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                            <span style={{ minWidth: 14, textAlign: "center", fontSize: 13, fontWeight: 700, fontFamily: "'Cairo', sans-serif" }}>{count}</span>
                            <button onClick={() => adjustProjectAssign(p.key, pl, 1)}  style={{ background: "#B8860B", border: "none", borderRadius: 6, width: 20, height: 20, fontSize: 13, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && <div style={{ color: "#9C3848", fontSize: 13, marginBottom: 10, fontFamily: "'Cairo', sans-serif" }}>⚠ {error}</div>}
          <button onClick={addRound} style={{ width: "100%", background: "#0E6F5C", border: "none", borderRadius: 12, padding: "13px 0", fontWeight: 800, fontSize: 15, color: "#fff", fontFamily: "'Cairo', sans-serif" }}>تم</button>
        </div>
      )}

      {/* Round history */}
      {rounds.length > 0 && (
        <div className="card">
          <div style={{ fontFamily: "'Cairo', sans-serif", fontWeight: 800, fontSize: 14, marginBottom: 10 }}>سجل الكوتات</div>
          {rounds.slice().reverse().map((r, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, borderBottom: "1px solid #EBE7DE", padding: "6px 0" }}>
              <span style={{ color: "#9A8F7E", fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>{r.label}</span>
              <span style={{ fontWeight: 700, fontFamily: "'Cairo', sans-serif" }}>
                {r.A}–{r.B} <span style={{ color: "#B0A898", fontWeight: 400 }}>({r.cumA}–{r.cumB})</span>
              </span>
            </div>
          ))}
          <button onClick={undoLastRound} className="pill pill-red" style={{ marginTop: 10, width: "100%" }}>تراجع عن آخر كوت</button>
        </div>
      )}
    </div>
  );
}

// =====================================================================
// Casual Screen
// =====================================================================
function CasualScreen({ casual, setCasual }) {
  const { us, them, history } = casual;
  const [inputUs,   setInputUs]   = useState("");
  const [inputThem, setInputThem] = useState("");
  const winner = us >= MATCH_TARGET && them >= MATCH_TARGET
    ? (us !== them ? (us > them ? "نحن" : "هم") : null)
    : us >= MATCH_TARGET ? "نحن" : them >= MATCH_TARGET ? "هم" : null;

  function addEntry() {
    const u = toInt(inputUs) || 0, t = toInt(inputThem) || 0;
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

  const pctUs   = Math.min(100, (us   / MATCH_TARGET) * 100);
  const pctThem = Math.min(100, (them / MATCH_TARGET) * 100);

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1, background: "#0E6F5C", borderRadius: 16, padding: "14px 12px", color: "#fff", textAlign: "center" }}>
          <div style={{ fontSize: 13, opacity: 0.85, fontWeight: 600, marginBottom: 4 }}>نحن</div>
          <div style={{ fontSize: 42, fontWeight: 900, fontFamily: "'Cairo', sans-serif", lineHeight: 1 }}>{us}</div>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${pctUs}%` }} /></div>
        </div>
        <div style={{ flex: 1, background: "#9C3848", borderRadius: 16, padding: "14px 12px", color: "#fff", textAlign: "center" }}>
          <div style={{ fontSize: 13, opacity: 0.85, fontWeight: 600, marginBottom: 4 }}>هم</div>
          <div style={{ fontSize: 42, fontWeight: 900, fontFamily: "'Cairo', sans-serif", lineHeight: 1 }}>{them}</div>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${pctThem}%` }} /></div>
        </div>
      </div>

      {winner ? (
        <div className="card" style={{ textAlign: "center", background: "#0E6F5C", border: "none" }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", fontFamily: "'Cairo', sans-serif" }}>🏆 الناموووس {winner}!</div>
          <div style={{ marginTop: 12 }}>
            <button className="pill" style={{ background: "#fff", color: "#0E6F5C", fontWeight: 800 }} onClick={newMatch}>قيم ثاني؟</button>
          </div>
        </div>
      ) : (
        <div className="card">
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <div style={{ flex: 1 }}><label>نحن</label><input type="text" inputMode="numeric" value={inputUs}   onChange={(e) => setInputUs(e.target.value)}   /></div>
            <div style={{ flex: 1 }}><label>هم</label> <input type="text" inputMode="numeric" value={inputThem} onChange={(e) => setInputThem(e.target.value)} /></div>
          </div>
          <button onClick={addEntry} style={{ width: "100%", background: "#0E6F5C", border: "none", borderRadius: 12, padding: "13px 0", fontWeight: 800, color: "#fff", fontFamily: "'Cairo', sans-serif", marginBottom: 10 }}>تم</button>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={undoLast} disabled={history.length === 0} className="pill pill-red"      style={{ flex: 1, opacity: history.length === 0 ? 0.4 : 1 }}>تراجع</button>
            <button onClick={newMatch}                                  className="pill pill-inactive" style={{ flex: 1 }}>قيم جديد</button>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="card">
          <div style={{ fontFamily: "'Cairo', sans-serif", fontWeight: 800, fontSize: 14, marginBottom: 10 }}>السجل</div>
          {history.slice().reverse().map((h, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, borderBottom: "1px solid #EBE7DE", padding: "6px 0" }}>
              <span style={{ color: "#9A8F7E" }}>نحن +{h.u} · هم +{h.t}</span>
              <span style={{ fontWeight: 700, fontFamily: "'Cairo', sans-serif" }}>{h.cumUs} – {h.cumThem}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =====================================================================
// Stats Screen
// =====================================================================
function StatsScreen({ stats }) {
  const players  = Object.keys(stats).sort((a, b) => stats[b].wins - stats[a].wins);
  const [expanded, setExpanded] = useState(null);

  if (players.length === 0)
    return <div className="card" style={{ textAlign: "center", color: "#9A8F7E", fontFamily: "'Cairo', sans-serif" }}>ما في قيمات Ranked بعد.</div>;

  return (
    <div className="card">
      <div style={{ fontFamily: "'Cairo', sans-serif", fontWeight: 800, fontSize: 15, marginBottom: 14 }}>إحصائيات اللاعبين</div>
      {players.map((name) => {
        const s      = stats[name];
        const isOpen = expanded === name;
        const rating = computeRating(stats, name);
        return (
          <div key={name} style={{ borderBottom: "1px solid #EBE7DE", padding: "12px 0" }}>
            <div onClick={() => setExpanded(isOpen ? null : name)} style={{ display: "flex", justifyContent: "space-between", cursor: "pointer", alignItems: "center" }}>
              <span style={{ fontWeight: 700, fontFamily: "'Cairo', sans-serif" }}>
                {name} {rating !== null && <span style={{ fontSize: 12, color: "#9A8F7E", fontWeight: 400 }}>({rating}%)</span>}
              </span>
              <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ color: "#0E6F5C", fontWeight: 700, fontFamily: "'Cairo', sans-serif" }}>{s.wins} فوز</span>
                <span style={{ color: "#EBE7DE" }}>·</span>
                <span style={{ color: "#9C3848", fontWeight: 700, fontFamily: "'Cairo', sans-serif" }}>{s.losses} خسارة</span>
                <span style={{ color: "#B0A898", fontSize: 12 }}>{isOpen ? "▲" : "▼"}</span>
              </span>
            </div>
            {isOpen && (
              <div style={{ marginTop: 12, fontSize: 13, background: "#FAFAF7", borderRadius: 10, padding: "10px 12px", border: "1px solid #EBE7DE" }}>
                {rating === null && <div style={{ color: "#9A8F7E", marginBottom: 8 }}>التقييم يظهر بعد {MIN_RANKED_FOR_RATING} قيمات (الحالي: {s.ranked})</div>}
                <div style={{ fontWeight: 700, marginBottom: 6, fontFamily: "'Cairo', sans-serif" }}>مع كل شريك</div>
                {Object.keys(s.partners).length === 0
                  ? <div style={{ color: "#9A8F7E" }}>لا يوجد</div>
                  : Object.entries(s.partners).map(([partner, pr]) => (
                      <div key={partner} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span>مع {partner}</span>
                        <span style={{ fontFamily: "'Cairo', sans-serif", fontWeight: 600 }}>{pr.wins} فوز – {pr.losses} خسارة</span>
                      </div>
                    ))
                }
                <div style={{ fontWeight: 700, margin: "10px 0 6px", fontFamily: "'Cairo', sans-serif" }}>المشاريع</div>
                {Object.keys(s.projects).length === 0
                  ? <div style={{ color: "#9A8F7E" }}>لا يوجد</div>
                  : Object.entries(s.projects).map(([key, count]) => {
                      const proj = PROJECTS.find((p) => p.key === key);
                      return (
                        <div key={key} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span>{proj ? proj.label : key}</span>
                          <span style={{ fontFamily: "'Cairo', sans-serif", fontWeight: 600 }}>{count} مرة</span>
                        </div>
                      );
                    })
                }
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span>قيد</span>           <span style={{ fontFamily: "'Cairo', sans-serif", fontWeight: 700 }}>{s.qaid}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span>شراي صن</span>       <span style={{ fontFamily: "'Cairo', sans-serif", fontWeight: 700 }}>{s.sunBuys}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span>شراي حكم</span>      <span style={{ fontFamily: "'Cairo', sans-serif", fontWeight: 700 }}>{s.hokomBuys}</span></div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// =====================================================================
// Log Screen
// =====================================================================
function LogScreen({ matches, onDelete }) {
  const [pwTarget, setPwTarget] = useState(null);
  const [pwInput,  setPwInput]  = useState("");
  const [pwError,  setPwError]  = useState("");

  if (matches.length === 0)
    return <div className="card" style={{ textAlign: "center", color: "#9A8F7E", fontFamily: "'Cairo', sans-serif" }}>ما في قيمات محفوظة.</div>;

  const sorted = matches.slice().sort((a, b) => new Date(b.date) - new Date(a.date));

  function confirmDelete() {
    if (pwInput !== DELETE_PASSWORD) { setPwError("كلمة المرور غلط"); return; }
    onDelete(pwTarget); setPwTarget(null); setPwInput(""); setPwError("");
  }

  return (
    <div className="card">
      <div style={{ fontFamily: "'Cairo', sans-serif", fontWeight: 800, fontSize: 15, marginBottom: 14 }}>سجل القيمات</div>
      {sorted.map((m) => (
        <div key={m.date} style={{ borderBottom: "1px solid #EBE7DE", padding: "12px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 11, color: "#9A8F7E", marginBottom: 3 }}>{fullDateTime(m.date)}</div>
              <div style={{ fontWeight: 700, fontFamily: "'Cairo', sans-serif", fontSize: 14 }}>
                {m.teamA.join(" / ")} <span style={{ color: "#B0A898", fontWeight: 400 }}>ضد</span> {m.teamB.join(" / ")}
              </div>
              <div style={{ fontSize: 13, marginTop: 4, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <span>{m.finalA} – {m.finalB}</span>
                <span style={{ color: "#0E6F5C", fontWeight: 700, fontFamily: "'Cairo', sans-serif" }}>
                  فاز {(m.winningTeam === "A" ? m.teamA : m.teamB).join(" / ")}
                </span>
                <span className="badge" style={{ background: m.mode === "ranked" ? "#B8860B" : "#9A8F7E" }}>{m.mode === "ranked" ? "Ranked" : "بسيط"}</span>
              </div>
            </div>
            <button onClick={() => { setPwTarget(m.date); setPwInput(""); setPwError(""); }}
              style={{ background: "#F6E9EA", color: "#9C3848", border: "1px solid #9C384830", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", fontFamily: "'Cairo', sans-serif" }}>
              حذف
            </button>
          </div>
          {pwTarget === m.date && (
            <div style={{ marginTop: 10, background: "#FAFAF7", borderRadius: 10, padding: 12, border: "1px solid #EBE7DE" }}>
              <label>كلمة مرور الحذف</label>
              <input type="password" value={pwInput} onChange={(e) => setPwInput(e.target.value)} style={{ marginBottom: 8 }} />
              {pwError && <div style={{ color: "#9C3848", fontSize: 12, marginBottom: 8 }}>{pwError}</div>}
              <div style={{ display: "flex", gap: 8 }}>
                <button className="pill pill-red"      onClick={confirmDelete}>تأكيد الحذف</button>
                <button className="pill pill-inactive" onClick={() => setPwTarget(null)}>إلغاء</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// =====================================================================
// Archive Screen
// =====================================================================
function ArchiveScreen({ matches, currentMonthKey }) {
  const months   = Array.from(new Set(matches.map((m) => monthKey(m.date)))).sort().reverse();
  const [selected, setSelected] = useState(null);

  if (months.length === 0)
    return <div className="card" style={{ textAlign: "center", color: "#9A8F7E", fontFamily: "'Cairo', sans-serif" }}>ما في أرشيف بعد.</div>;

  if (selected) {
    const monthMatches = matches.filter((m) => monthKey(m.date) === selected);
    const stats  = computeStats(monthMatches);
    const titles = computeTitles(stats);
    const titleEntries = Object.entries(titles).filter(([, v]) => v);
    return (
      <div>
        <button className="pill pill-inactive" style={{ marginBottom: 12 }} onClick={() => setSelected(null)}>‹ رجوع</button>
        <div className="card">
          <div style={{ fontFamily: "'Cairo', sans-serif", fontWeight: 800, fontSize: 15, marginBottom: 10 }}>
            {monthLabel(selected)} {selected === currentMonthKey && <span style={{ fontSize: 12, color: "#9A8F7E", fontWeight: 400 }}>(الحالي)</span>}
          </div>
          <div style={{ fontSize: 13, color: "#9A8F7E", marginBottom: titleEntries.length > 0 ? 12 : 0 }}>
            Ranked: {monthMatches.filter((m) => m.mode === "ranked").length} · بسيط: {monthMatches.filter((m) => m.mode === "casual").length}
          </div>
          {titleEntries.length > 0 && (
            <div className="chips-row" style={{ marginTop: 8 }}>
              {titleEntries.map(([key, info]) => (
                <span key={key} className="title-chip">{info.name}: {TITLES[key]}</span>
              ))}
            </div>
          )}
        </div>
        <StatsScreen stats={stats} />
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ fontFamily: "'Cairo', sans-serif", fontWeight: 800, fontSize: 15, marginBottom: 14 }}>الأرشيف الشهري</div>
      {months.map((mk) => (
        <button key={mk} onClick={() => setSelected(mk)} style={{
          display: "block", width: "100%", textAlign: "right",
          background: mk === currentMonthKey ? "#E7F2EE" : "#FAFAF7",
          color:      mk === currentMonthKey ? "#0E6F5C" : "#1A1410",
          border: `1px solid ${mk === currentMonthKey ? "#0E6F5C40" : "#EBE7DE"}`,
          borderRadius: 10, padding: "12px 14px", marginBottom: 8,
          fontWeight: 700, fontFamily: "'Cairo', sans-serif", fontSize: 14, cursor: "pointer",
        }}>
          {monthLabel(mk)} {mk === currentMonthKey && "· الحالي"}
        </button>
      ))}
    </div>
  );
}
