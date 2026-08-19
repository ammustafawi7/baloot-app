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

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);
const MATCHES_DOC = doc(db, "baloot", "matches");

// خريطة التحويل: الاسم القديم → الاسم الجديد
const NAME_MAP = {
  "بوسعيد":   "بو سعيد",
  "بودانة":   "بو دانه",
  "بوشهاب":   "بو دانه",
  "احمد":     "احمد ع",
  "بو فاطمه": "هاشم",
  "خالد":     "بو شمه",
};

function rep(name) {
  return NAME_MAP[name] ?? name;
}

async function main() {
  console.log("⏳ جاري تحميل البيانات من Firestore...");
  const snap = await getDoc(MATCHES_DOC);
  if (!snap.exists()) { console.log("❌ ما في بيانات"); process.exit(1); }

  const list = snap.data().list || [];
  console.log(`📦 عدد الماتشات: ${list.length}`);

  // طباعة الأسماء الموجودة قبل التعديل
  const before = new Set(list.flatMap(m => [...(m.teamA||[]), ...(m.teamB||[])]));
  console.log("الأسماء الحالية:", [...before].sort().join(", "));

  const updated = list.map((m) => ({
    ...m,
    teamA: (m.teamA||[]).map(rep),
    teamB: (m.teamB||[]).map(rep),
    rounds: (m.rounds||[]).map((r) => ({
      ...r,
      label:       r.label       ? Object.entries(NAME_MAP).reduce((s,[o,n]) => s.replaceAll(o,n), r.label) : r.label,
      qaidPlayer:  r.qaidPlayer  ? rep(r.qaidPlayer)  : r.qaidPlayer,
      buyerPlayer: r.buyerPlayer ? rep(r.buyerPlayer) : r.buyerPlayer,
      projectDetails: (r.projectDetails||[]).map((d) => ({ ...d, player: rep(d.player) })),
    })),
  }));

  // طباعة الأسماء بعد التعديل
  const after = new Set(updated.flatMap(m => [...(m.teamA||[]), ...(m.teamB||[])]));
  console.log("الأسماء بعد الدمج:", [...after].sort().join(", "));

  console.log("💾 جاري الحفظ في Firestore...");
  await setDoc(MATCHES_DOC, { list: updated });
  console.log("✅ تم بنجاح!");
  process.exit(0);
}

main().catch((e) => { console.error("❌ خطأ:", e); process.exit(1); });
