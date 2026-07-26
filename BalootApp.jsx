import React, { useState, useEffect } from "react";

// =====================================================================
// Constants & helpers
// =====================================================================
const MATCH_TARGET = 152;
const DELETE_PASSWORD = "بلوت";
const MIN_RANKED_FOR_RATING = 10;
const MIN_RANKED_FOR_TITLE  = 5;

// لاعبون ثابتون يظهرون دائماً في الـ autocomplete (بدون سجل بعد)
const STATIC_PLAYERS = ["علي", "بو خليفه"];

// Design tokens
const C = {
  bg:        "#F5F0E8",
  surface:   "#FFFDF7",
  ink:       "#1C1A14",
  inkSoft:   "#8A8070",
  line:      "#E2D9C8",
  a:         "#8A6820",
  aSoft:     "#F5EBCF",
  b:         "#5C4E38",
  bSoft:     "#EDE4D4",
  gold:      "#B8860B",
  goldSoft:  "#F7EFDC",
  cta:       "#1C1A14",
};

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

const PROJECTS = [
  { key: "sara",    label: "سرا",   sun: 4,  hokom: 2  },
  { key: "khamsen", label: "خمسين", sun: 10, hokom: 5  },
  { key: "miya",    label: "١٠٠",   sun: 20, hokom: 10 },
  { key: "arbaa",   label: "٤٠٠",   sun: 40, hokom: null, sunOnly: true  },
  { key: "blot",    label: "بلوت",  sun: null, hokom: 2, hokomOnly: true },
];

const TITLES = {
  ghashash: "هطف",
  ustora:   "المعزب",
  baidh:    "لو قاعد فالبيت احسن",
};

import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, collection, addDoc, getDocs, deleteDoc, query, orderBy } from "firebase/firestore";

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
const MATCHES_COL = collection(db, "matches");
const OLD_MATCHES_DOC = doc(db, "baloot", "matches");

async function loadMatches() {
  try {
    const snap = await getDocs(query(MATCHES_COL, orderBy("date", "asc")));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) { console.error("Firestore load failed", e); return []; }
}
async function saveNewMatch(matchData) {
  try { const ref = await addDoc(MATCHES_COL, matchData); return ref.id; }
  catch (e) { console.error("Firestore save failed", e); return null; }
}
async function deleteMatchById(id) {
  try { await deleteDoc(doc(db, "matches", id)); }
  catch (e) { console.error("Firestore delete failed", e); }
}
async function runMigration() {
  try {
    const old = await getDoc(OLD_MATCHES_DOC);
    if (!old.exists()) return true;
    const list = old.data().list || [];
    for (const m of list) await addDoc(MATCHES_COL, m);
    await deleteDoc(OLD_MATCHES_DOC);
    return true;
  } catch (e) { console.error("Migration failed", e); return false; }
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
  const hours = d.getHours(), mins = String(d.getMinutes()).padStart(2, "0");
  const period = hours >= 12 ? "م" : "ص", h12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${days[d.getDay()]} ${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()} - ${h12}:${mins} ${period}`;
}

function computeStats(matches) {
  const stats = {};
  function ensure(name) {
    if (!stats[name]) stats[name] = { wins:0, losses:0, qaid:0, projects:{}, projectsTotal:0, partners:{}, sunBuys:0, hokomBuys:0, ranked:0 };
    return stats[name];
  }
  for (const m of matches) {
    if (m.mode !== "ranked") continue;
    const { teamA, teamB, winningTeam } = m;
    for (const n of [...teamA, ...teamB]) ensure(n).ranked += 1;
    for (const n of (winningTeam === "A" ? teamA : teamB)) ensure(n).wins   += 1;
    for (const n of (winningTeam === "A" ? teamB : teamA)) ensure(n).losses += 1;
    function trackPartner(team, didWin) {
      if (team.length === 2) {
        const [p1,p2] = team;
        const s1 = ensure(p1), s2 = ensure(p2);
        if (!s1.partners[p2]) s1.partners[p2] = {wins:0,losses:0};
        if (!s2.partners[p1]) s2.partners[p1] = {wins:0,losses:0};
        if (didWin) { s1.partners[p2].wins++; s2.partners[p1].wins++; }
        else        { s1.partners[p2].losses++; s2.partners[p1].losses++; }
      }
    }
    trackPartner(teamA, winningTeam === "A");
    trackPartner(teamB, winningTeam === "B");
    for (const r of m.rounds || []) {
      if (r.qaidPlayer) ensure(r.qaidPlayer).qaid += 1;
      if (r.projectDetails) for (const pd of r.projectDetails) {
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
    for (const n of names) { const v = stats[n][field]; if (v > bestVal) { bestVal = v; best = n; } else if (v === bestVal && bestVal > 0) { best = null; } }
    return bestVal > 0 && best ? { name: best, value: bestVal, criteriaLabel } : null;
  }
  function bestWinRate() {
    const top3 = names.slice().sort((a,b) => stats[b].wins - stats[a].wins).slice(0,3);
    if (top3.length === 0) return null;
    let best = null, bestRate = -1;
    for (const n of top3) {
      const s = stats[n];
      const total = s.wins + s.losses;
      const rate = total > 0 ? s.wins / total : 0;
      if (rate > bestRate) { bestRate = rate; best = n; }
      else if (rate === bestRate) { best = null; }
    }
    return best ? { name: best, value: Math.round(bestRate * 100), criteriaLabel: "% نسبة فوز (Top 3)" } : null;
  }
  function bestLossRate() {
    const top3 = names.slice().sort((a,b) => stats[b].losses - stats[a].losses).slice(0,3);
    if (top3.length === 0) return null;
    let best = null, bestRate = -1;
    for (const n of top3) {
      const s = stats[n];
      const total = s.wins + s.losses;
      const rate = total > 0 ? s.losses / total : 0;
      if (rate > bestRate) { bestRate = rate; best = n; }
      else if (rate === bestRate) { best = null; }
    }
    return best ? { name: best, value: Math.round(bestRate * 100), criteriaLabel: "% نسبة خسارة (Top 3)" } : null;
  }
  return {
    ghashash: topBy("qaid",   "مرة تسبب بقيد"),
    ustora:   bestWinRate(),
    baidh:    bestLossRate(),
  };
}

function computeRating(stats, name) {
  const s = stats[name];
  if (!s || s.ranked < MIN_RANKED_FOR_RATING) return null;
  const total = s.wins + s.losses;
  return total === 0 ? null : Math.round((s.wins / total) * 100);
}

function loadLocal(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function saveLocal(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
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
        background: ${C.bg};
        font-family: 'IBM Plex Sans Arabic', 'Segoe UI', sans-serif;
        direction: rtl;
        color: ${C.ink};
        -webkit-font-smoothing: antialiased;
      }

      button { font-family: inherit; cursor: pointer; border: none; }

      .card {
        background: ${C.surface};
        border-radius: 16px;
        border: 1px solid ${C.line};
        padding: 16px;
        margin-bottom: 12px;
        box-shadow: 0 1px 4px rgba(0,0,0,0.04);
      }

      .pill { border-radius: 999px; padding: 8px 16px; font-size: 13px; font-weight: 600; transition: background 0.15s, color 0.15s; font-family: 'Cairo', sans-serif; }
      .pill-active   { background: ${C.cta}; color: #fff; }
      .pill-inactive { background: ${C.line}; color: ${C.inkSoft}; }
      .pill-red      { background: ${C.b}; color: #fff; }
      .pill-gold     { background: ${C.gold}; color: #fff; }

      input[type=text], input[type=password] {
        border: 1.5px solid ${C.line};
        border-radius: 10px;
        padding: 10px 12px;
        font-size: 14px;
        width: 100%;
        background: ${C.surface};
        color: ${C.ink};
        font-family: 'IBM Plex Sans Arabic', sans-serif;
        outline: none;
        transition: border-color 0.15s;
      }
      input[type=text]:focus, input[type=password]:focus { border-color: ${C.gold}; }

      label {
        font-size: 12px; display: block; margin-bottom: 6px;
        color: ${C.inkSoft};
        font-family: 'IBM Plex Sans Arabic', sans-serif; font-weight: 500;
      }
      label.bold-label {
        font-size: 13px; font-weight: 700; color: ${C.ink};
        font-family: 'Cairo', sans-serif; margin-bottom: 8px;
      }

      .progress-track { height: 6px; background: rgba(255,255,255,0.22); border-radius: 999px; overflow: hidden; margin-top: 8px; }
      .progress-fill  { height: 100%; border-radius: 999px; background: rgba(255,255,255,0.65); transition: width 0.4s ease; }

      .badge { display: inline-block; background: ${C.gold}; color: #fff; border-radius: 999px; padding: 2px 10px; font-size: 11px; font-weight: 700; font-family: 'Cairo', sans-serif; }

      /* Bottom Nav */
      .bottom-nav {
        position: fixed; bottom: 0; left: 0; right: 0;
        background: ${C.surface};
        border-top: 1px solid ${C.line};
        display: flex; justify-content: space-around; align-items: flex-end;
        padding: 6px 0 18px; z-index: 100;
        box-shadow: 0 -2px 12px rgba(0,0,0,0.06);
        direction: ltr;
      }
      .nav-btn { display: flex; flex-direction: column; align-items: center; gap: 3px; background: none; border: none; padding: 4px 8px; cursor: pointer; min-width: 52px; }
      .nav-icon  { font-size: 22px; line-height: 1; }
      .nav-label { font-size: 10px; font-weight: 600; color: #C0B8A8; font-family: 'Cairo', sans-serif; }
      .nav-btn.active .nav-label { color: ${C.gold}; }
      .nav-center-wrap { display: flex; flex-direction: column; align-items: center; gap: 3px; margin-bottom: 4px; }
      .nav-center-btn {
        width: 50px; height: 50px; border-radius: 50%;
        background: ${C.cta};
        display: flex; align-items: center; justify-content: center;
        font-size: 22px;
        box-shadow: 0 4px 14px rgba(28,26,20,0.3);
        border: 3px solid ${C.bg};
        margin-top: -18px; cursor: pointer;
      }
      .nav-center-btn.active { background: #3a3830; }

      /* Title chips */
      .chips-row { display: flex; gap: 8px; overflow-x: auto; overflow-y: visible; padding: 4px 4px 4px 16px; scrollbar-width: none; }
      .chips-row::-webkit-scrollbar { display: none; }
      .chips-row::after { content: ''; min-width: 12px; display: block; }
      .title-chip {
        flex-shrink: 0;
        background: ${C.goldSoft};
        border: 1px solid ${C.gold}33;
        border-radius: 999px;
        padding: 6px 14px;
        font-size: 12px; font-weight: 700; color: #7A5500;
        white-space: nowrap;
        font-family: 'Cairo', sans-serif;
        cursor: pointer; position: relative;
      }

      .section-head {
        font-size: 11px; font-weight: 700; color: #C0B8A8; letter-spacing: 1px;
        font-family: 'Cairo', sans-serif; margin-bottom: 8px;
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
      <h1 style={{ fontFamily: "'Cairo', sans-serif", fontSize: 28, fontWeight: 900, color: C.ink }}>الميلس</h1>
      <div style={{ width: 40, height: 2, background: C.gold, margin: "6px auto 0", borderRadius: 99 }} />
    </div>
  );
}

// =====================================================================
// Bottom Nav
// =====================================================================
function BottomNav({ view, setView, hasMatch }) {
  const left  = [{ key:"archive", label:"أرشيف", icon:"🗂" }, { key:"stats", label:"إحصائيات", icon:"📊" }];
  const right = [{ key:"log",  label:"السجل",       icon:"📋" }, { key:"play", label:"القيم الحالي", icon:"⚡" }];
  return (
    <nav className="bottom-nav">
      {left.map((t) => (
        <button key={t.key} className={`nav-btn ${view === t.key ? "active" : ""}`} onClick={() => setView(t.key)}>
          <span className="nav-icon">{t.icon}</span>
          <span className="nav-label">{t.label}</span>
        </button>
      ))}
      <div className="nav-center-wrap">
        <button className={`nav-center-btn ${view === "setup" ? "active" : ""}`} onClick={() => setView("setup")}>🎴</button>
        <span className="nav-label" style={{ color: view === "setup" ? C.gold : "#C0B8A8" }}>اللعب</span>
      </div>
      {right.map((t) => (
        <button key={t.key} className={`nav-btn ${view === t.key ? "active" : ""}`} onClick={() => setView(t.key)}>
          <span className="nav-icon">{t.icon}{t.key === "play" && hasMatch ? <span style={{ fontSize:8, color:C.gold, verticalAlign:"top" }}>●</span> : null}</span>
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
  const [view,        setView]        = useState(() => loadLocal("baloot_view", "setup"));
  const [matches,     setMatches]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [names,       setNames]       = useState({ A1:"", A2:"", B1:"", B2:"" });
  const [matchMode,   setMatchMode]   = useState("ranked");
  const [activeMatch, setActiveMatch] = useState(() => loadLocal("baloot_active_match", null));
  const [casual,      setCasual]      = useState(() => loadLocal("baloot_casual", { us:0, them:0, history:[] }));

  useEffect(() => {
    if (!loadLocal("baloot_migrated_v2", false)) {
      runMigration().then((ok) => {
        if (ok) saveLocal("baloot_migrated_v2", true);
        loadMatches().then((m) => { setMatches(m); setLoading(false); });
      });
    } else {
      loadMatches().then((m) => { setMatches(m); setLoading(false); });
    }
  }, []);
  useEffect(() => { saveLocal("baloot_active_match", activeMatch); }, [activeMatch]);
  useEffect(() => { saveLocal("baloot_casual",       casual);      }, [casual]);
  useEffect(() => { saveLocal("baloot_view",         view);        }, [view]);

  function startMatch() {
    const { A1, A2, B1, B2 } = names;
    if (!A1 || !A2 || !B1 || !B2) return;
    setActiveMatch({ teamA:[A1,A2], teamB:[B1,B2], cumA:0, cumB:0, rounds:[], winner:null, mode:matchMode, turnIndex:0 });
    setView("play");
  }

  async function finishMatch(updated) {
    if (updated.winner) {
      const matchData = { date:new Date().toISOString(), mode:updated.mode, teamA:updated.teamA, teamB:updated.teamB, winningTeam:updated.winner, finalA:updated.cumA, finalB:updated.cumB, rounds:updated.rounds };
      const newId = await saveNewMatch(matchData);
      setMatches((prev) => [...prev, { id:newId, ...matchData }]);
    }
  }

  function cancelMatch() { setActiveMatch(null); setView("setup"); }

  async function deleteMatch(matchId) {
    await deleteMatchById(matchId);
    setMatches((prev) => prev.filter((m) => m.id !== matchId));
  }

  async function removeLastSavedMatch() {
    if (matches.length === 0) return;
    const last = matches[matches.length - 1];
    if (last?.id) await deleteMatchById(last.id);
    setMatches((prev) => prev.slice(0, -1));
  }

  const now = new Date();
  const currentMonthKey     = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const currentMonthMatches = matches.filter((m) => monthKey(m.date) === currentMonthKey);
  const titles              = computeTitles(computeStats(currentMonthMatches));
  const allTimeStats        = computeStats(matches);

  function renderView() {
    if (loading) return <div style={{ textAlign:"center", padding:60, color:C.inkSoft, fontFamily:"Cairo,sans-serif" }}>جاري التحميل...</div>;
    if (view === "setup") {
      if (matchMode === "casual") return (
        <div>
          <div className="card">
            <div style={{ display:"flex", gap:8 }}>
              <button className="pill pill-inactive" onClick={() => setMatchMode("ranked")}>رسمي</button>
              <button className="pill pill-active"   onClick={() => setMatchMode("casual")}>ودي</button>
            </div>
          </div>
          <CasualScreen casual={casual} setCasual={setCasual} />
        </div>
      );
      // احسب عدد المباريات لكل لاعب للترتيب
      const matchCount = {};
      matches.forEach((m) => [...(m.teamA||[]), ...(m.teamB||[])].forEach((n) => { if(n) matchCount[n] = (matchCount[n]||0) + 1; }));
      const dynamicPlayers = Array.from(new Set(matches.flatMap((m) => [...(m.teamA||[]), ...(m.teamB||[])]).map(n => n?.trim()).filter(Boolean)))
        .sort((a,b) => (matchCount[b]||0) - (matchCount[a]||0));
      const allPlayerNames = [...dynamicPlayers, ...STATIC_PLAYERS.filter(p => !dynamicPlayers.includes(p))];
      return <HomeScreen names={names} setNames={setNames} matchMode={matchMode} setMatchMode={setMatchMode} onStart={startMatch} titles={titles} allPlayers={allPlayerNames} />;
    }
    if (view === "play") return activeMatch
      ? <PlayScreen match={activeMatch} setMatch={setActiveMatch} onFinish={finishMatch} onCancel={cancelMatch} onUndoFinish={removeLastSavedMatch} onNewMatch={() => { setActiveMatch(null); setView("setup"); }} />
      : <div className="card" style={{ textAlign:"center", color:C.inkSoft, fontFamily:"Cairo,sans-serif" }}>ما في قيم جاري — ابدأ قيم جديد من اللعب</div>;
    if (view === "stats")   return <StatsScreen stats={allTimeStats} />;
    if (view === "log")     return <LogScreen matches={matches} onDelete={deleteMatch} />;
    if (view === "archive") return <ArchiveScreen matches={matches} currentMonthKey={currentMonthKey} />;
  }

  return (
    <div style={{ minHeight:"100vh", background:C.bg, direction:"rtl" }}>
      <GlobalStyle />
      <Header />
      <div style={{ maxWidth:640, margin:"0 auto", padding:"0 14px 100px" }}>
        {renderView()}
      </div>
      <BottomNav view={view} setView={setView} hasMatch={!!activeMatch} />
    </div>
  );
}

// =====================================================================
// Autocomplete Input
// =====================================================================
function AutoInput({ value, onChange, suggestions }) {
  const [open, setOpen] = useState(false);
  const filtered = suggestions.filter((s) => s && s !== value && (value === "" || s.includes(value)));

  return (
    <div style={{ position:"relative" }}>
      <input
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        style={{ background:"#fff", borderRadius:11, border:`1px solid ${C.line}`, fontSize:16, width:"100%" }}
      />
      {open && filtered.length > 0 && (
        <div style={{ position:"absolute", bottom:"100%", right:0, left:0, background:C.surface, border:`1px solid ${C.line}`, borderRadius:10, zIndex:50, boxShadow:"0 -4px 12px rgba(0,0,0,0.1)", marginBottom:4, maxHeight:180, overflowY:"auto" }}>
          {filtered.slice(0,6).map((s) => (
            <div key={s} onMouseDown={() => { onChange(s); setOpen(false); }}
              style={{ padding:"10px 12px", fontSize:14, fontFamily:"'Cairo',sans-serif", cursor:"pointer", borderBottom:`1px solid ${C.line}` }}>
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =====================================================================
// Home Screen
// =====================================================================
function HomeScreen({ names, setNames, matchMode, setMatchMode, onStart, titles, allPlayers }) {
  function update(field, val) { setNames({ ...names, [field]: val }); }
  const ready = names.A1 && names.A2 && names.B1 && names.B2;
  const titleEntries = Object.entries(titles).filter(([, v]) => v);
  const [tipKey, setTipKey] = useState(null);
  const activeTip = tipKey ? titles[tipKey] : null;
  const tipRef = React.useRef(null);

  React.useEffect(() => {
    if (activeTip && tipRef.current) {
      tipRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [tipKey]);

  return (
    <div>
      {titleEntries.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div className="section-head">🏆 ألقاب الشهر</div>
          <div className="chips-row">
            {titleEntries.map(([key, info]) => (
              <button key={key} className="title-chip" style={{ outline: tipKey===key ? `2px solid ${C.gold}` : "none" }} onClick={() => setTipKey(tipKey === key ? null : key)}>
                {info.name}: {TITLES[key]}
              </button>
            ))}
          </div>
          {activeTip && (
            <div ref={tipRef} style={{ marginTop:10, background:C.goldSoft, border:`1px solid ${C.gold}44`, borderRadius:12, padding:"10px 14px", fontSize:13, color:"#7A5500", fontFamily:"'IBM Plex Sans Arabic',sans-serif" }}>
              <span style={{ fontWeight:700, fontFamily:"'Cairo',sans-serif" }}>{activeTip.name}</span> حاز لقب <span style={{ fontWeight:700 }}>{TITLES[tipKey]}</span> بسبب {activeTip.value} {activeTip.criteriaLabel}
            </div>
          )}
        </div>
      )}

      <div className="card">
        <div style={{ fontFamily:"'Cairo',sans-serif", fontWeight:800, fontSize:15, marginBottom:12, color:C.ink }}>إعداد قيم</div>

        <div style={{ display:"flex", gap:8, marginBottom:14 }}>
          <button className={`pill ${matchMode === "ranked" ? "pill-active" : "pill-inactive"}`} onClick={() => setMatchMode("ranked")}>رسمي</button>
          <button className={`pill ${matchMode === "casual" ? "pill-active" : "pill-inactive"}`} onClick={() => setMatchMode("casual")}>ودي</button>
        </div>

        <div style={{ display:"flex", gap:10, marginBottom:18, position:"relative" }}>
          {/* فريق أ */}
          <div style={{ flex:1, background:C.surface, border:`1px solid ${C.line}`, borderTop:`3px solid ${C.a}`, borderRadius:14, padding:"12px 10px" }}>
            <div style={{ fontFamily:"'Cairo',sans-serif", fontWeight:800, fontSize:13, color:C.a, marginBottom:10, textAlign:"center" }}>فريق أ</div>
            <div style={{ marginBottom:8 }}>
              <label>لاعب ١</label>
              <AutoInput value={names.A1} onChange={(v) => update("A1", v)} suggestions={allPlayers} />
            </div>
            <div>
              <label>لاعب ٢</label>
              <AutoInput value={names.A2} onChange={(v) => update("A2", v)} suggestions={allPlayers} />
            </div>
          </div>

          {/* VS */}
          <div style={{ position:"absolute", left:"50%", top:"50%", transform:"translate(-50%,-50%)", zIndex:2, background:C.surface, border:`1px solid ${C.line}`, borderRadius:"50%", width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Cairo',sans-serif", fontWeight:800, fontSize:11, color:C.inkSoft, boxShadow:"0 2px 8px rgba(0,0,0,0.07)" }}>
            VS
          </div>

          {/* فريق ب */}
          <div style={{ flex:1, background:C.surface, border:`1px solid ${C.line}`, borderTop:`3px solid ${C.b}`, borderRadius:14, padding:"12px 10px" }}>
            <div style={{ fontFamily:"'Cairo',sans-serif", fontWeight:800, fontSize:13, color:C.b, marginBottom:10, textAlign:"center" }}>فريق ب</div>
            <div style={{ marginBottom:8 }}>
              <label>لاعب ١</label>
              <AutoInput value={names.B1} onChange={(v) => update("B1", v)} suggestions={allPlayers} />
            </div>
            <div>
              <label>لاعب ٢</label>
              <AutoInput value={names.B2} onChange={(v) => update("B2", v)} suggestions={allPlayers} />
            </div>
          </div>
        </div>

        <button disabled={!ready} onClick={onStart} style={{ width:"100%", padding:"13px 0", background:ready ? C.cta : C.line, color:ready ? "#fff" : C.inkSoft, border:"none", borderRadius:12, fontWeight:800, fontSize:15, fontFamily:"'Cairo',sans-serif", transition:"background 0.2s" }}>
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

  const [genA,         setGenA]         = useState("");
  const [genB,         setGenB]         = useState("");
  const [qaidPlayer,   setQaidPlayer]   = useState("");
  const [showQaidDrop, setShowQaidDrop] = useState(false);
  const [error,        setError]        = useState("");
  const [showSwap,     setShowSwap]     = useState(false);
  const [swapOld,      setSwapOld]      = useState("");
  const [swapNew,      setSwapNew]      = useState("");
  const genARef = React.useRef(null);
  const genBRef = React.useRef(null);
  const didTransfer = React.useRef(false);
  React.useEffect(() => {
    const elA = genARef.current, elB = genBRef.current;
    if (!elA || !elB) return;
    const hA = () => { if (!didTransfer.current && elA.value.length >= 2) { didTransfer.current = true; elB.focus(); } };
    const hB = () => { if (!didTransfer.current && elB.value.length >= 2) { didTransfer.current = true; elA.focus(); } };
    elA.addEventListener("input", hA);
    elB.addEventListener("input", hB);
    return () => { elA.removeEventListener("input", hA); elB.removeEventListener("input", hB); };
  }, []);

  function resetForm() {
    setGenA(""); setGenB(""); setQaidPlayer(""); setShowQaidDrop(false); setError("");
    didTransfer.current = false;
  }

  function computeRound() {
    setError("");
    const a = toInt(genA), b = toInt(genB);
    if (isNaN(a) || isNaN(b)) { setError("أدخل رقمين صحيحين"); return null; }
    if (qaidPlayer) return { label:"قيد", A:a, B:b, qaidPlayer };
    return { label:"كوت", A:a, B:b };
  }

  function addRound() {
    const res = computeRound(); if (!res) return;
    const nA = cumA + res.A, nB = cumB + res.B;
    const newRounds = [...rounds, { ...res, cumA:nA, cumB:nB }];
    let newWinner = null;
    if (res.instantWin) newWinner = res.instantWin;
    else if (nA >= MATCH_TARGET && nB >= MATCH_TARGET) { if (nA !== nB) newWinner = nA > nB ? "A" : "B"; }
    else if (nA >= MATCH_TARGET) newWinner = "A";
    else if (nB >= MATCH_TARGET) newWinner = "B";
    const nextTurn = ((match.turnIndex ?? 0) + 1) % 4;
    const updated = { ...match, cumA:nA, cumB:nB, rounds:newRounds, winner:newWinner, turnIndex:nextTurn };
    setMatch(updated); resetForm();
    setTimeout(() => window.scrollTo({ top: 0, behavior: "instant" }), 50);
    if (newWinner) onFinish(updated);
  }

  function undoLastRound() {
    if (rounds.length === 0) return;
    const wasFinished = !!winner;
    const newRounds = rounds.slice(0,-1);
    const nA = newRounds.reduce((s,r) => s+r.A, 0), nB = newRounds.reduce((s,r) => s+r.B, 0);
    let newWinner = null;
    if (nA >= MATCH_TARGET && nB >= MATCH_TARGET) { if (nA !== nB) newWinner = nA > nB ? "A" : "B"; }
    else if (nA >= MATCH_TARGET) newWinner = "A";
    else if (nB >= MATCH_TARGET) newWinner = "B";
    const prevTurn = ((match.turnIndex ?? 0) + 3) % 4;
    setMatch({ ...match, cumA:nA, cumB:nB, rounds:newRounds, winner:newWinner, turnIndex:prevTurn });
    if (wasFinished) onUndoFinish();
  }

  function doSwap() {
    if (!swapOld || !swapNew) return;
    const rep = (arr) => arr.map((n) => (n === swapOld ? swapNew : n));
    const newRounds = rounds.map((r) => ({
      ...r,
      qaidPlayer: r.qaidPlayer === swapOld ? swapNew : r.qaidPlayer,
    }));
    setMatch({ ...match, teamA:rep(teamA), teamB:rep(teamB), rounds:newRounds });
    setShowSwap(false); setSwapOld(""); setSwapNew("");
  }

  const pctA = Math.min(100, (cumA / MATCH_TARGET) * 100);
  const pctB = Math.min(100, (cumB / MATCH_TARGET) * 100);
  const ARROWS = ["↑", "←", "↓", "→"];
  const turnIndex = match.turnIndex ?? 0;
  function advanceTurn() { setMatch({ ...match, turnIndex: (turnIndex + 1) % 4 }); }

  const scoreCard = (team, cum, pct, bg) => (
    <div style={{ flex:1, background:bg, borderRadius:16, padding:"14px 12px", color:"#fff", textAlign:"center" }}>
      <div style={{ fontSize:14, fontWeight:700, fontFamily:"'Cairo',sans-serif", marginBottom:4, opacity:0.9 }}>{team.join(" / ")}</div>
      <div style={{ fontSize:36, fontWeight:900, fontFamily:"'Cairo',sans-serif", lineHeight:1 }}>{cum}</div>
      <div className="progress-track"><div className="progress-fill" style={{ width:`${pct}%` }} /></div>
    </div>
  );

  return (
    <div>
      {/* Top bar */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
        <span className="badge" style={{ background: mode === "ranked" ? C.gold : C.inkSoft }}>{mode === "ranked" ? "رسمي" : "ودي"}</span>
        <div style={{ display:"flex", gap:6 }}>
          <button className="pill pill-inactive" style={{ fontSize:12 }} onClick={() => setShowSwap(!showSwap)}>تبديل لاعب</button>
          <button className="pill pill-red"      style={{ fontSize:12 }} onClick={onCancel}>إلغاء</button>
        </div>
      </div>

      {showSwap && (
        <div className="card">
          <label>اللاعب الحالي</label>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
            {allPlayers.map((p) => <button key={p} className={`pill ${swapOld===p?"pill-active":"pill-inactive"}`} onClick={() => setSwapOld(p)}>{p}</button>)}
          </div>
          <label>الاسم الجديد</label>
          <input type="text" value={swapNew} onChange={(e) => setSwapNew(e.target.value)} style={{ marginBottom:10 }} />
          <button className="pill pill-active" onClick={doSwap}>تأكيد التبديل</button>
        </div>
      )}

      <div style={{ display:"flex", gap:10, marginBottom:10 }}>
        {scoreCard(teamA, cumA, pctA, C.a)}
        {scoreCard(teamB, cumB, pctB, C.b)}
      </div>

      {!winner && (
        <div style={{ display:"flex", justifyContent:"center", marginBottom:10 }}>
          <button onClick={advanceTurn} style={{ width:52, height:52, borderRadius:"50%", background:C.goldSoft, border:`2px solid ${C.gold}55`, fontSize:26, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 2px 8px rgba(0,0,0,0.07)", color:"#7A5500" }}>
            {ARROWS[turnIndex]}
          </button>
        </div>
      )}

      {winner ? (
        <div className="card" style={{ textAlign:"center", background:C.a, border:"none" }}>
          <div style={{ fontSize:18, fontWeight:700, color:"#fff", fontFamily:"'Cairo',sans-serif", marginBottom:6 }}>🏆 الناموووس</div>
          {(winner === "A" ? teamA : teamB).map((name) => (
            <div key={name} style={{ fontSize:28, fontWeight:900, color:"#fff", fontFamily:"'Cairo',sans-serif", lineHeight:1.2 }}>{name}</div>
          ))}
          <div style={{ marginTop:14 }}>
            <button className="pill" style={{ background:"#fff", color:C.a, fontWeight:800 }} onClick={onNewMatch}>قيم ثاني؟</button>
          </div>
        </div>
      ) : (
        <>
          {/* كارد: إدخال الأرقام + تم + تراجع/قيد */}
          <div className="card">
            <div style={{ display:"flex", gap:10, marginBottom:14 }}>
              <div style={{ flex:1 }}>
                <label style={{ fontSize:15, fontWeight:700, color:C.ink, fontFamily:"'Cairo',sans-serif", marginBottom:6, display:"block", textAlign:"center" }}>{teamA.join(" / ")}</label>
                <input ref={genARef} type="text" inputMode="numeric" maxLength={3} value={genA}
                  onChange={(e) => setGenA(e.target.value)}
                  style={{ fontSize:22 }} />
              </div>
              <div style={{ flex:1 }}>
                <label style={{ fontSize:15, fontWeight:700, color:C.ink, fontFamily:"'Cairo',sans-serif", marginBottom:6, display:"block", textAlign:"center" }}>{teamB.join(" / ")}</label>
                <input ref={genBRef} type="text" inputMode="numeric" maxLength={3} value={genB} onChange={(e) => setGenB(e.target.value)} style={{ fontSize:22 }} />
              </div>
            </div>

            {error && <div style={{ color:C.b, fontSize:13, marginBottom:8, fontFamily:"'Cairo',sans-serif" }}>⚠ {error}</div>}
            <button onClick={addRound} style={{ width:"100%", background:C.cta, border:"none", borderRadius:12, padding:"13px 0", fontWeight:800, fontSize:15, color:"#fff", fontFamily:"'Cairo',sans-serif", marginBottom:10 }}>تم</button>

            <div style={{ display:"flex", gap:10 }}>
              {/* تراجع */}
              <div style={{ flex:1, background:C.bg, borderRadius:12, border:`1px solid ${C.line}`, padding:10 }}>
                <button onClick={undoLastRound} disabled={rounds.length === 0}
                  style={{ width:"100%", background:"none", border:`1.5px solid ${C.line}`, borderRadius:10, padding:"9px 0", fontSize:13, fontWeight:700, color: rounds.length > 0 ? C.inkSoft : C.line, fontFamily:"'Cairo',sans-serif", cursor: rounds.length > 0 ? "pointer" : "default" }}>
                  ↩ تراجع
                </button>
              </div>

              {/* قيد */}
              <div style={{ flex:1, background:C.bg, borderRadius:12, border:`1px solid ${C.line}`, padding:10, position:"relative" }}>
                <button onClick={() => setShowQaidDrop(!showQaidDrop)}
                  style={{ width:"100%", background: qaidPlayer ? C.a : C.aSoft, border:`1.5px solid ${qaidPlayer ? C.a : C.line}`, borderRadius:10, padding:"9px 12px", fontSize:13, fontWeight:700, color: qaidPlayer ? "#fff" : C.a, fontFamily:"'Cairo',sans-serif", display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer" }}>
                  <span>{qaidPlayer || "قيد"}</span>
                  <span style={{ fontSize:10 }}>{showQaidDrop ? "▲" : "▼"}</span>
                </button>
                {showQaidDrop && (
                  <div style={{ position:"absolute", bottom:"calc(100% + 6px)", right:0, left:0, background:C.surface, border:`1px solid ${C.line}`, borderRadius:12, overflow:"hidden", boxShadow:"0 4px 16px rgba(0,0,0,0.10)", zIndex:10 }}>
                    {allPlayers.map((p, i) => (
                      <div key={p} onClick={() => { setQaidPlayer(qaidPlayer === p ? "" : p); setShowQaidDrop(false); }}
                        style={{ padding:"11px 14px", fontSize:14, fontWeight:700, color: qaidPlayer === p ? C.a : C.ink, background: qaidPlayer === p ? C.aSoft : "transparent", fontFamily:"'Cairo',sans-serif", borderBottom: i < allPlayers.length - 1 ? `1px solid ${C.line}` : "none", cursor:"pointer" }}>
                        {p}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {rounds.length > 0 && (
        <div className="card">
          <div style={{ fontFamily:"'Cairo',sans-serif", fontWeight:800, fontSize:14, marginBottom:10, color:C.ink }}>سجل الكوتات</div>
          {rounds.slice().reverse().map((r, i) => (
            <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:13, borderBottom:`1px solid ${C.line}`, padding:"6px 0" }}>
              <span style={{ color:C.inkSoft, fontFamily:"'IBM Plex Sans Arabic',sans-serif" }}>{r.label}</span>
              <span style={{ fontWeight:700, fontFamily:"'Cairo',sans-serif" }}>{r.A}–{r.B} <span style={{ color:C.line, fontWeight:400 }}>({r.cumA}–{r.cumB})</span></span>
            </div>
          ))}
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
    const u = toInt(inputUs)||0, t = toInt(inputThem)||0;
    if (u === 0 && t === 0) return;
    const nU = us+u, nT = them+t;
    setCasual({ us:nU, them:nT, history:[...history, {u,t,cumUs:nU,cumThem:nT}] });
    setInputUs(""); setInputThem("");
  }
  function undoLast() {
    if (!history.length) return;
    const h = history.slice(0,-1), last = h[h.length-1];
    setCasual({ us:last?last.cumUs:0, them:last?last.cumThem:0, history:h });
  }
  function newMatch() { setCasual({ us:0, them:0, history:[] }); }

  return (
    <div>
      <div style={{ display:"flex", gap:10, marginBottom:14 }}>
        {[["نحن", us, C.a], ["هم", them, C.b]].map(([label, val, bg]) => (
          <div key={label} style={{ flex:1, background:bg, borderRadius:16, padding:"14px 12px", color:"#fff", textAlign:"center" }}>
            <div style={{ fontSize:13, opacity:0.85, fontWeight:600, marginBottom:4 }}>{label}</div>
            <div style={{ fontSize:42, fontWeight:900, fontFamily:"'Cairo',sans-serif", lineHeight:1 }}>{val}</div>
            <div className="progress-track"><div className="progress-fill" style={{ width:`${Math.min(100,(val/MATCH_TARGET)*100)}%` }} /></div>
          </div>
        ))}
      </div>

      {winner ? (
        <div className="card" style={{ textAlign:"center", background:C.a, border:"none" }}>
          <div style={{ fontSize:20, fontWeight:800, color:"#fff", fontFamily:"'Cairo',sans-serif" }}>🏆 الناموووس {winner}!</div>
          <div style={{ marginTop:12 }}><button className="pill" style={{ background:"#fff", color:C.a, fontWeight:800 }} onClick={newMatch}>قيم ثاني؟</button></div>
        </div>
      ) : (
        <div className="card">
          <div style={{ display:"flex", gap:10, marginBottom:12 }}>
            <div style={{ flex:1 }}><label>نحن</label><input type="text" inputMode="numeric" value={inputUs}   onChange={(e) => setInputUs(e.target.value)} /></div>
            <div style={{ flex:1 }}><label>هم</label> <input type="text" inputMode="numeric" value={inputThem} onChange={(e) => setInputThem(e.target.value)} /></div>
          </div>
          <button onClick={addEntry} style={{ width:"100%", background:C.cta, border:"none", borderRadius:12, padding:"13px 0", fontWeight:800, color:"#fff", fontFamily:"'Cairo',sans-serif", marginBottom:10 }}>تم</button>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={undoLast} disabled={!history.length} className="pill pill-red"      style={{ flex:1, opacity:history.length?1:0.4 }}>تراجع</button>
            <button onClick={newMatch}                             className="pill pill-inactive" style={{ flex:1 }}>قيم جديد</button>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="card">
          <div style={{ fontFamily:"'Cairo',sans-serif", fontWeight:800, fontSize:14, marginBottom:10 }}>السجل</div>
          {history.slice().reverse().map((h, i) => (
            <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:13, borderBottom:`1px solid ${C.line}`, padding:"6px 0" }}>
              <span style={{ color:C.inkSoft }}>نحن +{h.u} · هم +{h.t}</span>
              <span style={{ fontWeight:700, fontFamily:"'Cairo',sans-serif" }}>{h.cumUs} – {h.cumThem}</span>
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
  const players = Object.keys(stats).sort((a,b) => (stats[b]?.wins||0) - (stats[a]?.wins||0));
  const [expanded, setExpanded] = useState(null);

  if (!players.length)
    return <div className="card" style={{ textAlign:"center", color:C.inkSoft, fontFamily:"Cairo,sans-serif" }}>ما في قيمات رسمية بعد.</div>;

  return (
    <div>
    <div className="card">
      <div style={{ fontFamily:"'Cairo',sans-serif", fontWeight:800, fontSize:15, color:C.ink, marginBottom:14 }}>إحصائيات اللاعبين</div>
      {players.map((name) => {
        const s = stats[name], isOpen = expanded === name, rating = computeRating(stats, name);
        return (
          <div key={name} style={{ borderBottom:`1px solid ${C.line}`, padding:"12px 0" }}>
            <div onClick={() => setExpanded(isOpen?null:name)} style={{ display:"flex", justifyContent:"space-between", cursor:"pointer", alignItems:"center" }}>
              <span style={{ fontWeight:700, fontFamily:"'Cairo',sans-serif", color:C.ink }}>
                {name} {rating!==null && <span style={{ fontSize:12, color:C.inkSoft, fontWeight:400 }}>({rating}%)</span>}
              </span>
              <span style={{ display:"flex", gap:8, alignItems:"center" }}>
                <span style={{ color:C.a, fontWeight:700, fontFamily:"'Cairo',sans-serif" }}>{s.wins} فوز</span>
                <span style={{ color:C.line }}>·</span>
                <span style={{ color:C.b, fontWeight:700, fontFamily:"'Cairo',sans-serif" }}>{s.losses} خسارة</span>
                <span style={{ color:C.inkSoft, fontSize:12 }}>{isOpen?"▲":"▼"}</span>
              </span>
            </div>
            {isOpen && (
              <div style={{ marginTop:12, fontSize:13, background:C.bg, borderRadius:10, padding:"10px 12px", border:`1px solid ${C.line}` }}>
                {rating===null && <div style={{ color:C.inkSoft, marginBottom:8 }}>التقييم يظهر بعد {MIN_RANKED_FOR_RATING} قيمات (الحالي: {s.ranked})</div>}
                <div style={{ fontWeight:700, marginBottom:6, fontFamily:"'Cairo',sans-serif", color:C.ink }}>مع كل شريك</div>
                {!Object.keys(s.partners).length
                  ? <div style={{ color:C.inkSoft }}>لا يوجد</div>
                  : Object.entries(s.partners).map(([partner,pr]) => (
                      <div key={partner} style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                        <span>مع {partner}</span>
                        <span style={{ fontFamily:"'Cairo',sans-serif", fontWeight:600 }}>{pr.wins} فوز – {pr.losses} خسارة</span>
                      </div>
                    ))
                }
                <div style={{ fontWeight:700, margin:"10px 0 6px", fontFamily:"'Cairo',sans-serif", color:C.ink }}>المشاريع</div>
                {!Object.keys(s.projects).length
                  ? <div style={{ color:C.inkSoft }}>لا يوجد</div>
                  : Object.entries(s.projects).map(([key,count]) => {
                      const proj = PROJECTS.find((p) => p.key===key);
                      return <div key={key} style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}><span>{proj?proj.label:key}</span><span style={{ fontFamily:"'Cairo',sans-serif", fontWeight:600 }}>{count} مرة</span></div>;
                    })
                }
                <div style={{ marginTop:10, display:"flex", flexDirection:"column", gap:4 }}>
                  {[["قيد",s.qaid],["شراي صن",s.sunBuys],["شراي حكم",s.hokomBuys]].map(([lbl,val]) => (
                    <div key={lbl} style={{ display:"flex", justifyContent:"space-between" }}>
                      <span>{lbl}</span><span style={{ fontFamily:"'Cairo',sans-serif", fontWeight:700 }}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
    </div>
  );
}

// =====================================================================
// Log Screen
// =====================================================================
function LogScreen({ matches, onDelete }) {
  const [pwTarget,setPwTarget] = useState(null);
  const [pwInput, setPwInput]  = useState("");
  const [pwError, setPwError]  = useState("");

  if (!matches.length)
    return <div className="card" style={{ textAlign:"center", color:C.inkSoft, fontFamily:"Cairo,sans-serif" }}>ما في قيمات محفوظة.</div>;

  const sorted = matches.slice().sort((a,b) => new Date(b.date)-new Date(a.date));

  function confirmDelete() {
    if (pwInput !== DELETE_PASSWORD) { setPwError("كلمة المرور غلط"); return; }
    onDelete(pwTarget); setPwTarget(null); setPwInput(""); setPwError("");
  }

  return (
    <div className="card">
      <div style={{ fontFamily:"'Cairo',sans-serif", fontWeight:800, fontSize:15, marginBottom:14, color:C.ink }}>سجل القيمات</div>
      {sorted.map((m) => (
        <div key={m.date} style={{ borderBottom:`1px solid ${C.line}`, padding:"12px 0" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div>
              <div style={{ fontSize:11, color:C.inkSoft, marginBottom:3 }}>{fullDateTime(m.date)}</div>
              <div style={{ fontWeight:700, fontFamily:"'Cairo',sans-serif", fontSize:14, color:C.ink }}>
                {m.teamA.join(" / ")} <span style={{ color:C.line, fontWeight:400 }}>ضد</span> {m.teamB.join(" / ")}
              </div>
              <div style={{ fontSize:13, marginTop:4, display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
                <span style={{ color:C.inkSoft }}>{m.finalA} – {m.finalB}</span>
                <span style={{ color:C.a, fontWeight:700, fontFamily:"'Cairo',sans-serif" }}>فاز {(m.winningTeam==="A"?m.teamA:m.teamB).join(" / ")}</span>
                <span className="badge" style={{ background:m.mode==="ranked"?C.gold:C.inkSoft }}>{m.mode==="ranked"?"رسمي":"ودي"}</span>
              </div>
            </div>
            <button onClick={() => { setPwTarget(m.id); setPwInput(""); setPwError(""); }}
              style={{ background:C.bSoft, color:C.b, border:`1px solid ${C.b}30`, borderRadius:8, padding:"6px 12px", fontSize:12, fontWeight:700, whiteSpace:"nowrap", fontFamily:"'Cairo',sans-serif" }}>
              حذف
            </button>
          </div>
          {pwTarget === m.id && (
            <div style={{ marginTop:10, background:C.bg, borderRadius:10, padding:12, border:`1px solid ${C.line}` }}>
              <label>كلمة مرور الحذف</label>
              <input type="password" value={pwInput} onChange={(e) => setPwInput(e.target.value)} style={{ marginBottom:8 }} />
              {pwError && <div style={{ color:C.b, fontSize:12, marginBottom:8 }}>{pwError}</div>}
              <div style={{ display:"flex", gap:8 }}>
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
  const months = Array.from(new Set(matches.map((m) => monthKey(m.date)))).sort().reverse();
  const [selected, setSelected] = useState(null);

  if (!months.length)
    return <div className="card" style={{ textAlign:"center", color:C.inkSoft, fontFamily:"Cairo,sans-serif" }}>ما في أرشيف بعد.</div>;

  if (selected) {
    const monthMatches = matches.filter((m) => monthKey(m.date) === selected);
    const titles = computeTitles(computeStats(monthMatches));
    const titleEntries = Object.entries(titles).filter(([,v]) => v);
    return (
      <div>
        <button className="pill pill-inactive" style={{ marginBottom:12 }} onClick={() => setSelected(null)}>‹ رجوع</button>
        <div className="card">
          <div style={{ fontFamily:"'Cairo',sans-serif", fontWeight:800, fontSize:15, marginBottom:8, color:C.ink }}>
            {monthLabel(selected)} {selected===currentMonthKey && <span style={{ fontSize:12, color:C.inkSoft, fontWeight:400 }}>(الحالي)</span>}
          </div>
          <div style={{ fontSize:13, color:C.inkSoft, marginBottom:titleEntries.length?12:0 }}>
            رسمي: {monthMatches.filter((m) => m.mode==="ranked").length} · ودي: {monthMatches.filter((m) => m.mode==="casual").length}
          </div>
          {titleEntries.length>0 && (
            <div className="chips-row" style={{ marginTop:8 }}>
              {titleEntries.map(([key,info]) => <span key={key} className="title-chip">{info.name}: {TITLES[key]}</span>)}
            </div>
          )}
        </div>
        <StatsScreen stats={computeStats(monthMatches)} />
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ fontFamily:"'Cairo',sans-serif", fontWeight:800, fontSize:15, marginBottom:14, color:C.ink }}>الأرشيف الشهري</div>
      {months.map((mk) => (
        <button key={mk} onClick={() => setSelected(mk)} style={{ display:"block", width:"100%", textAlign:"right", background:mk===currentMonthKey?C.aSoft:C.bg, color:mk===currentMonthKey?C.a:C.ink, border:`1px solid ${mk===currentMonthKey?C.a+"40":C.line}`, borderRadius:10, padding:"12px 14px", marginBottom:8, fontWeight:700, fontFamily:"'Cairo',sans-serif", fontSize:14, cursor:"pointer" }}>
          {monthLabel(mk)} {mk===currentMonthKey&&"· الحالي"}
        </button>
      ))}
    </div>
  );
}
