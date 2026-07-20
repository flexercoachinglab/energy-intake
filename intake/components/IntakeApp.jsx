"use client";
import React, { useState, useMemo } from "react";

// ============================================================
// FLEXER エネルギー摂取量設定ツール v5（メゾン・デザイン）
//   配色: 白/オフホワイト/黒/グレー、水色は差し色。影を廃しヘアラインと余白で階層。
//   欧文=幾何学サンセリフ(Jost)、和文=Noto Sans JP。セクションは連番。
//   ロジックはv4を保持（職業=出発点 ± 疲労 ± 歩数 + 運動。減量は月-0.5〜-3kg）。
// ============================================================

const C = {
  ink: "#0A0A0A", paper: "#FFFFFF", off: "#FAFAF8", line: "#E8E8E6",
  sub: "#8A8A8A", aqua: "#7FD4E3", aquaDeep: "#3BA6C8", aquaSoft: "#EAF7FA",
  warn: "#B98A3A", danger: "#C4573F", need: "#FBEDEA", needLine: "#E8B4A8",
};

// 職業＝出発点となる中心PAL
const JOBS = [
  { id: "desk", label: "デスクワーク・運転中心", pal: 1.16 },
  { id: "stand", label: "立ち仕事（教員/トレーナー/接客/保育/美容）", pal: 1.24 },
  { id: "walk", label: "常時歩行・動き回る仕事（看護/小売/飲食）", pal: 1.32 },
  { id: "labor", label: "身体労働（建設/引越/農業/配送）", pal: 1.50 },
];

// 主観的疲労度：動きに紐づけて聞く（座り疲れは活動ではない）
const FATIGUE = [
  { id: "sit", label: "座りっぱなしで固まった感じ", adj: -0.06, note: "体は動かしていない疲れ" },
  { id: "mid", label: "普通（特にどちらでもない）", adj: 0.00, note: "" },
  { id: "move", label: "動き回って体が疲れた感じ", adj: +0.06, note: "活動由来の疲れ" },
];

const EX_TYPE = [
  { id: "strength", label: "筋トレ", perFreq: 0.03 },
  { id: "cardio", label: "ランニング等の有酸素", perFreq: 0.035 },
  { id: "sport", label: "球技・格闘技など", perFreq: 0.03 },
  { id: "light", label: "ウォーキング・軽い有酸素", perFreq: 0.02 },
];
const FREQ = [
  { id: "f12", label: "週1〜2回", n: 1.5 },
  { id: "f34", label: "週3〜4回", n: 3.5 },
  { id: "f5", label: "週5回以上", n: 5 },
];

// 歩数がわからない人向け: 生活実感で選ぶ代表歩数
const STEP_LIFESTYLE = [
  { id: "l1", label: "ほぼ家か車移動で歩かない", steps: 2000 },
  { id: "l2", label: "近所の買い物・送り迎え程度", steps: 4000 },
  { id: "l3", label: "通勤や仕事で結構歩く", steps: 7000 },
  { id: "l4", label: "一日中よく歩く", steps: 10000 },
];

const RANGE = 0.055;
const KCAL_PER_KG = 7200;

// ── 外食・身近な一皿のカロリー／PFCインパクト ──
// 出典：カロリーSlism（日本食品標準成分表8訂ベース）、各社栄養成分、管理栄養士監修記事より
// kcal はレンジ、PFCは1食あたりの概算g（大まかな目安）。店・具材・量で変動。
const EATING_OUT = [
  {
    cat: "スナック・アイス", items: [
      { name: "ポテトチップス（1袋 60g）", kcalLo: 325, kcalHi: 340, P: 3, F: 21, C: 30, note: "半分でも約160kcal。手が止まりにくいのが要注意" },
      { name: "アイスクリーム（濃厚系ミニカップ 110ml）", kcalLo: 240, kcalHi: 300, P: 5, F: 16, C: 20, note: "小さいのに脂質・糖質が高めです" },
    ],
  },
  {
    cat: "麺類", items: [
      { name: "醤油・塩ラーメン（並）", kcalLo: 500, kcalHi: 700, P: 20, F: 15, C: 70, note: "スープを飲み干す・チャーシューを足すと上がります" },
      { name: "味噌・とんこつラーメン（並）", kcalLo: 700, kcalHi: 900, P: 25, F: 30, C: 80, note: "背脂・こってり系はさらに上がります" },
      { name: "うどん（並・麺のみ）", kcalLo: 300, kcalHi: 350, P: 8, F: 2, C: 65, note: "" },
      { name: "パスタ（トマト・和風）", kcalLo: 500, kcalHi: 680, P: 16, F: 14, C: 80, note: "" },
      { name: "パスタ（カルボナーラ）", kcalLo: 690, kcalHi: 950, P: 22, F: 38, C: 78, note: "クリーム・チーズで脂質が上がります" },
      { name: "エビ・ホタテのトマトソース", kcalLo: 600, kcalHi: 750, P: 24, F: 18, C: 82, note: "" },
      { name: "エビのトマトクリーム", kcalLo: 720, kcalHi: 900, P: 22, F: 30, C: 82, note: "クリームで脂質が上がります" },
    ],
  },
  {
    cat: "揚げ物・粉物", items: [
      { name: "唐揚げ（中1個）", kcalLo: 90, kcalHi: 110, P: 7, F: 6, C: 4, note: "5個で約450〜550kcal" },
      { name: "天ぷら盛り合わせ（えび・いか・かぼちゃ・なす・きす）", kcalLo: 400, kcalHi: 500, P: 20, F: 22, C: 30, note: "5種盛りの目安です" },
      { name: "えび天（1本）", kcalLo: 60, kcalHi: 80, P: 5, F: 4, C: 4, note: "" },
      { name: "かぼちゃ・さつまいも天（1個）", kcalLo: 90, kcalHi: 110, P: 1, F: 5, C: 14, note: "衣＋芋で糖質が上がります" },
      { name: "野菜のかき揚げ（1個）", kcalLo: 130, kcalHi: 200, P: 3, F: 12, C: 14, note: "衣が油を多く吸って高くなります" },
      { name: "ピザ（1切れ）", kcalLo: 120, kcalHi: 200, P: 7, F: 8, C: 18, note: "2切れで約240〜400kcal" },
      { name: "ハンバーガー（標準）", kcalLo: 260, kcalHi: 310, P: 14, F: 11, C: 31, note: "" },
      { name: "ビッグマック等（大きめ）", kcalLo: 500, kcalHi: 560, P: 26, F: 28, C: 42, note: "サイズが上がると脂質が一気に増えます" },
    ],
  },
  {
    cat: "スイーツ", items: [
      { name: "ショートケーキ（1個）", kcalLo: 310, kcalHi: 370, P: 5, F: 25, C: 30, note: "砂糖・生クリームで高くなります" },
      { name: "シュークリーム（1個）", kcalLo: 160, kcalHi: 280, P: 5, F: 11, C: 19, note: "" },
      { name: "チョコレートケーキ（1個）", kcalLo: 400, kcalHi: 440, P: 6, F: 26, C: 40, note: "チョコ・バターで高くなります" },
      { name: "チョコレートパフェ（1杯）", kcalLo: 500, kcalHi: 560, P: 9, F: 30, C: 57, note: "アイス・ソースで一気に高くなります" },
    ],
  },
];

function bmrMifflin({ sex, weight, height, age }) {
  const base = 10 * weight + 6.25 * height - 5 * age;
  return sex === "male" ? base + 5 : base - 161;
}
function stepsAdj(steps) {
  const d = (steps - 4000) / 1000 * 0.012;
  return Math.max(-0.06, Math.min(0.06, d));
}
const rnd = (n) => Math.round(n / 10) * 10;

// Section はモジュール直下で定義（App内で定義すると毎描画で再マウントされ、
// 入力欄のフォーカスが外れてキーボードが閉じるため）
function Section({ S, no, title, note, need, children }) {
  return (
    <div style={S.section}>
      <div style={S.secHead}>
        <span style={S.secNo}>{no}</span>
        <span style={S.secTitle}>{title}</span>
        {need && <span style={S.needTag}>未選択</span>}
      </div>
      {note && <div style={S.secNote}>{note}</div>}
      {children}
    </div>
  );
}

export default function App() {
  const [sex, setSex] = useState(null);
  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [bfLo, setBfLo] = useState("");
  const [bfHi, setBfHi] = useState("");
  const [job, setJob] = useState(null);
  const [fatigue, setFatigue] = useState(null);
  const [stepsMode, setStepsMode] = useState(null);
  const [steps, setSteps] = useState(4000);
  const [lifestyle, setLifestyle] = useState(null);
  const [exFreq, setExFreq] = useState({});
  const [exNone, setExNone] = useState(false); // 「運動なし」を明示的に選んだか
  const [lossKg, setLossKg] = useState(null);
  // 外食カロリーの一覧（ボタンで展開）
  const [showEatOut, setShowEatOut] = useState(false);

  // 各項目の未入力・未選択を判定
  const filled = {
    sex: sex !== null,
    age: age !== "" && +age > 0,
    height: height !== "" && +height > 0,
    weight: weight !== "" && +weight > 0,
    bfLo: bfLo !== "",
    bfHi: bfHi !== "",
    job: job !== null,
    fatigue: fatigue !== null,
    stepsMode: stepsMode !== null,
    lifestyle: !(stepsMode === "lifestyle" && lifestyle === null),
    exercise: exNone || Object.keys(exFreq).length > 0,
    lossKg: lossKg !== null,
  };
  const ready = Object.values(filled).every(Boolean);

  const r = useMemo(() => {
    if (!ready) return null;
    const bmr = bmrMifflin({ sex, weight: +weight, height: +height, age: +age });
    const jobPal = JOBS.find((j) => j.id === job).pal;
    const fAdj = FATIGUE.find((f) => f.id === fatigue).adj;
    let effSteps = steps;
    if (stepsMode === "lifestyle") effSteps = STEP_LIFESTYLE.find((l) => l.id === lifestyle).steps;
    const sAdj = stepsMode === "unknown" ? 0 : stepsAdj(effSteps);
    const eRaw = EX_TYPE.reduce((sum, t) => {
      const fId = exFreq[t.id];
      if (!fId) return sum;
      const fn = FREQ.find((f) => f.id === fId)?.n || 0;
      return sum + t.perFreq * fn;
    }, 0);
    const eAdd = Math.min(eRaw, 0.18);

    let base = jobPal + fAdj + sAdj;
    base = Math.max(1.10, Math.min(1.55, base));
    const palMid = base + eAdd;

    const tdeeMid = bmr * palMid;
    const tdeeLo = bmr * palMid * (1 - RANGE);
    const tdeeHi = bmr * palMid * (1 + RANGE);

    const dailyDeficit = (lossKg * KCAL_PER_KG) / 30;
    const intakeMid = tdeeMid - dailyDeficit;
    const intakeLo = tdeeLo - dailyDeficit;
    const intakeHi = tdeeHi - dailyDeficit;

    const belowBMR = intakeMid < bmr;
    const tight = intakeMid < bmr * 1.1;

    const pfcBasis = Math.max(intakeMid, bmr);
    const pGlo = Math.round(+weight * 1.3);
    const pGhi = Math.round(+weight * 1.4);
    const pKcal = ((pGlo + pGhi) / 2) * 4;
    const fKcal = pfcBasis * 0.20;
    const fG = Math.round(fKcal / 9);
    const cKcal = Math.max(0, pfcBasis - pKcal - fKcal);
    const cG = Math.round(cKcal / 4);

    let coachKey = "room";
    if (belowBMR) coachKey = "below";
    else if (tight) coachKey = "tight";

    // 開始量：減量推奨が基礎代謝を割るとき「まず始める量」を提示
    // 維持から8%下げる。ただし基礎代謝は下回らない（下げ止め）
    const startRaw = Math.round(tdeeMid * 0.92);
    const startKcal = Math.max(startRaw, Math.round(bmr));
    // 開始量のPFC：P=体重×1.3〜1.4、C=50〜55%、F=18〜21%（レンジ配分）
    const sPLo = Math.round(+weight * 1.3);
    const sPHi = Math.round(+weight * 1.4);
    const sCLo = Math.round((startKcal * 0.50) / 4);
    const sCHi = Math.round((startKcal * 0.55) / 4);
    const sFLo = Math.round((startKcal * 0.18) / 9);
    const sFHi = Math.round((startKcal * 0.21) / 9);
    // レンジのどこが基礎代謝を割っているか（説明の出し分け用）
    const hiBelow = intakeHi < bmr;   // 上限すら割る（本当に詰む）
    const midBelow = intakeMid < bmr; // 中央が割る（= belowBMR）
    const loBelow = intakeLo < bmr;   // 下限が割る

    return {
      bmr: Math.round(bmr), jobPal, fAdj, sAdj, eAdd, base: base.toFixed(2),
      palMid: palMid.toFixed(2),
      tdeeMid: rnd(tdeeMid), tdeeLo: rnd(tdeeLo), tdeeHi: rnd(tdeeHi),
      dailyDeficit: Math.round(dailyDeficit),
      intakeMid: rnd(intakeMid), intakeLo: rnd(intakeLo), intakeHi: rnd(intakeHi),
      belowBMR, tight,
      pGlo, pGhi, fG, cG, pfcBasis: rnd(pfcBasis), coachKey,
      startKcal: rnd(startKcal), sPLo, sPHi, sCLo, sCHi, sFLo, sFHi,
      hiBelow, midBelow, loBelow,
    };
  }, [ready, sex, age, height, weight, job, fatigue, stepsMode, steps, lifestyle, exFreq, lossKg]);

  const SANS = "'Noto Sans JP', sans-serif";
  const JOST = "'Jost', 'Noto Sans JP', sans-serif";

  const S = {
    wrap: { minHeight: "100vh", background: C.paper, color: C.ink, fontFamily: SANS,
      padding: "40px 22px 64px", WebkitFontSmoothing: "antialiased" },
    inner: { maxWidth: 620, margin: "0 auto" },

    // header
    brand: { fontFamily: JOST, fontSize: 12, letterSpacing: 5, color: C.ink, fontWeight: 400,
      marginBottom: 24 },
    brandDim: { color: C.sub },
    kicker: { fontFamily: JOST, fontSize: 13, letterSpacing: 3, color: C.aquaDeep,
      fontWeight: 400, marginBottom: 10 },
    h1: { fontSize: 24, fontWeight: 400, color: C.ink, letterSpacing: 1, margin: 0,
      paddingBottom: 22, borderBottom: `1px solid ${C.ink}` },
    lead: { fontSize: 12.5, color: C.sub, lineHeight: 1.9, letterSpacing: 0.5, margin: "20px 0 0" },
    caveat: { fontSize: 11, color: C.sub, lineHeight: 1.95, letterSpacing: 0.3,
      borderLeft: `2px solid ${C.aqua}`, paddingLeft: 14, margin: "24px 0 0" },

    // section
    section: { marginTop: 48 },
    secHead: { display: "flex", alignItems: "baseline", gap: 12, marginBottom: 22 },
    secNo: { fontFamily: JOST, fontSize: 12, letterSpacing: 2, color: C.aqua, fontWeight: 400 },
    secTitle: { fontSize: 12, letterSpacing: 3, color: C.ink, fontWeight: 500 },
    secNote: { fontSize: 11, color: C.sub, lineHeight: 1.85, letterSpacing: 0.3, margin: "-8px 0 20px 24px" },

    // fields
    grid2: { display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 24 },
    field: { minWidth: 0 },
    flabel: { fontFamily: JOST, fontSize: 10, letterSpacing: 2, color: C.sub,
      display: "block", marginBottom: 8, textTransform: "uppercase" },
    input: { padding: "8px 2px", border: "none", borderBottom: `1px solid ${C.line}`,
      borderRadius: 0, fontFamily: JOST, fontSize: 18, background: "transparent",
      color: C.ink, width: "100%", boxSizing: "border-box", outline: "none" },
    inputNeed: { background: C.need, borderBottom: `1px solid ${C.needLine}`, padding: "8px 8px" },
    needBox: { background: C.need, border: `1px solid ${C.needLine}`, padding: "2px 12px" },
    needTag: { display: "inline-block", fontSize: 10.5, letterSpacing: 1, color: C.danger,
      background: C.need, border: `1px solid ${C.needLine}`, padding: "2px 8px", marginLeft: 10 },

    // segmented (pills → underlined toggles)
    segRow: { display: "flex", gap: 0, borderBottom: `1px solid ${C.line}` },
    seg: (on) => ({ flex: "0 0 auto", padding: "10px 18px 12px", fontSize: 13, cursor: "pointer",
      letterSpacing: 1, color: on ? C.ink : C.sub, fontWeight: on ? 500 : 400,
      borderBottom: on ? `2px solid ${C.aquaDeep}` : "2px solid transparent", marginBottom: -1 }),
    segWrap: { display: "flex", flexWrap: "wrap", gap: 8 },
    chip: (on) => ({ padding: "8px 16px", fontSize: 12.5, cursor: "pointer", letterSpacing: 0.8,
      border: `1px solid ${on ? C.ink : C.line}`, background: on ? C.ink : "transparent",
      color: on ? "#fff" : C.sub, borderRadius: 0 }),

    // list rows (jobs / fatigue / exercise)
    rowList: { borderTop: `1px solid ${C.line}` },
    row: (on) => ({ display: "flex", justifyContent: "space-between", alignItems: "center",
      gap: 12, padding: "16px 2px", borderBottom: `1px solid ${C.line}`, cursor: "pointer",
      background: "transparent" }),
    rowLabel: (on) => ({ fontSize: 13.5, letterSpacing: 0.5, color: on ? C.ink : C.sub,
      fontWeight: on ? 500 : 400 }),
    rowNote: { fontSize: 11, color: C.sub, marginTop: 3, letterSpacing: 0.3 },
    rowRight: (on) => ({ fontFamily: JOST, fontSize: 12, letterSpacing: 1,
      color: on ? C.aquaDeep : C.sub, whiteSpace: "nowrap" }),
    rowMark: (on) => ({ width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
      border: `1px solid ${on ? C.aquaDeep : C.line}`,
      background: on ? C.aquaDeep : "transparent", display: "inline-block" }),

    // slider
    sliderRow: { display: "flex", alignItems: "center", gap: 16 },
    slider: { flex: 1, accentColor: C.aquaDeep },
    sliderVal: { fontFamily: JOST, fontSize: 20, fontWeight: 400, minWidth: 92,
      textAlign: "right", letterSpacing: 0.5 },
    hint: { fontSize: 11, color: C.sub, lineHeight: 1.8, letterSpacing: 0.3, marginTop: 12 },

    // result
    result: { background: C.off, border: `1px solid ${C.line}`, padding: "30px 26px", marginTop: 20 },
    resLabel: { fontFamily: JOST, fontSize: 10, letterSpacing: 2.5, color: C.sub, marginBottom: 12 },
    resLabelHi: { fontFamily: JOST, fontSize: 10, letterSpacing: 2.5, color: C.aquaDeep, marginBottom: 12 },
    bigNum: (col, sz) => ({ fontFamily: JOST, fontSize: sz, fontWeight: 300, color: col, lineHeight: 1 }),
    unit: (col) => ({ fontSize: 12, color: col, letterSpacing: 1 }),
    band: { fontSize: 11, color: C.sub, letterSpacing: 0.5, lineHeight: 1.8, marginTop: 8 },
    hr: { height: 1, background: C.line, margin: "24px 0" },

    // warn / guide
    warn: (col) => ({ borderLeft: `2px solid ${col}`, paddingLeft: 16, marginTop: 22 }),
    warnHead: (col) => ({ fontSize: 12.5, fontWeight: 500, letterSpacing: 1, color: col, marginBottom: 6 }),
    warnBody: { fontSize: 12.5, lineHeight: 1.9, letterSpacing: 0.3, color: C.ink },
    guideHead: { fontSize: 12.5, fontWeight: 500, letterSpacing: 1, color: C.aquaDeep, marginBottom: 8 },
    guideBody: { fontSize: 12.5, lineHeight: 1.95, letterSpacing: 0.3, color: C.ink },
    consult: { marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.line}`,
      fontSize: 12, color: C.aquaDeep, letterSpacing: 0.3, lineHeight: 1.8 },
    pfcWrap: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1,
      background: C.line, border: `1px solid ${C.line}`, marginTop: 18 },
    pfcBox: { background: C.paper, padding: "16px 10px", textAlign: "center" },
    pfcG: { fontFamily: JOST, fontSize: 20, fontWeight: 400, color: C.ink, lineHeight: 1 },
    pfcL: { fontFamily: JOST, fontSize: 10, letterSpacing: 1.5, color: C.sub, marginTop: 6 },
    pfcSub: { fontSize: 9, color: C.sub, marginTop: 2 },
    startBox: { background: C.aquaSoft, border: `1px solid ${C.aqua}`, padding: "20px", marginTop: 20 },
    startLabel: { fontFamily: JOST, fontSize: 11, letterSpacing: 2, color: C.aquaDeep, marginBottom: 10 },
    startNum: { fontFamily: JOST, fontSize: 40, fontWeight: 300, color: C.ink, lineHeight: 1 },
    startUnit: { fontSize: 13, color: C.aquaDeep },
    startNote: { fontSize: 11.5, color: C.sub, marginTop: 8, lineHeight: 1.8 },
    startGuide: { background: C.off, border: `1px solid ${C.line}`, padding: "16px 18px", marginTop: 16,
      fontSize: 12.5, lineHeight: 1.9, color: C.ink },
    nextStep: { borderLeft: `3px solid ${C.aqua}`, padding: "4px 0 4px 14px", marginTop: 20,
      fontSize: 12.5, lineHeight: 1.9, color: C.ink },
    medNote: { background: C.need, border: `1px solid ${C.needLine}`, padding: "14px 16px", marginTop: 20,
      fontSize: 11.5, lineHeight: 1.85, color: C.ink },
    footNote: { fontSize: 11, color: C.sub, letterSpacing: 0.3, lineHeight: 1.85, marginTop: 40 },
    revealBtn: { width: "100%", padding: "16px", background: "transparent", cursor: "pointer",
      border: `1px solid ${C.ink}`, borderRadius: 0, color: C.ink, fontSize: 12.5, letterSpacing: 2,
      marginTop: 20, fontFamily: JOST, fontWeight: 400 },
    mealCard: { border: `1px solid ${C.line}`, padding: "20px 20px 22px", marginBottom: 14 },
    mealHead: { display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14,
      paddingBottom: 12, borderBottom: `1px solid ${C.line}` },
    mealTitle: { display: "flex", alignItems: "baseline", gap: 10 },
    mealJa: { fontSize: 15, fontWeight: 500, letterSpacing: 1 },
    mealEn: { fontFamily: JOST, fontSize: 10, letterSpacing: 2, color: C.sub },
    mealKcal: { fontFamily: JOST, fontSize: 16, fontWeight: 400 },
    splitRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 6 },
    splitLabel: { fontSize: 12, letterSpacing: 1, minWidth: 24 },
    splitVal: { fontFamily: JOST, fontSize: 13, minWidth: 40, textAlign: "right" },
    foodRow: { display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "9px 0", borderBottom: `1px solid ${C.line}` },
    foodName: { fontSize: 13, letterSpacing: 0.5 },
    foodG: { fontFamily: JOST, fontSize: 15, fontWeight: 400 },
    protPick: { display: "flex", flexWrap: "wrap", gap: 6, margin: "4px 0 14px" },
    protChip: (on) => ({ padding: "6px 12px", fontSize: 11.5, cursor: "pointer", letterSpacing: 0.5,
      border: `1px solid ${on ? C.ink : C.line}`, background: on ? C.ink : "transparent",
      color: on ? "#fff" : C.sub, borderRadius: 0 }),
    reco: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1, background: C.line,
      border: `1px solid ${C.line}`, marginTop: 8 },
    recoBox: { background: C.paper, padding: "16px 10px", textAlign: "center" },
    recoNum: { fontFamily: JOST, fontSize: 18, fontWeight: 400, lineHeight: 1.2 },
    recoLabel: { fontFamily: JOST, fontSize: 9.5, letterSpacing: 1.2, color: C.sub, marginTop: 6 },
  };

  const num = (v, set) => (
    <input
      style={{ ...S.input, ...(v === "" ? S.inputNeed : {}) }}
      type="number" value={v}
      placeholder="—"
      onChange={(e) => set(e.target.value === "" ? "" : +e.target.value)}
    />
  );

  return (
    <div style={S.wrap}>
      <div style={S.inner}>

        {/* header */}
        <div style={S.brand}>FLEXER<span style={S.brandDim}>&nbsp;&mdash;&nbsp;INTAKE</span></div>
        <div style={S.kicker}>ENERGY INTAKE</div>
        <h1 style={S.h1}>エネルギー摂取量設定</h1>
        <p style={S.lead}>目標に合わせた1日のエネルギー摂取量を、レンジで提示します。</p>
        <div style={S.caveat}>
          ※FLEXER独自の現場における経験則や算出式を盛り込んであります。あくまでも目安としてご確認ください。<br /><br />
          ※最終的に算出されたカロリーについては、担当トレーナーと相談の上、糖質の摂取量を減らして脂質の量を増やすなど、
          カロリーやPFCの調整は担当トレーナーと相談して決めてください。
        </div>

        {/* 01 基本情報 */}
        <Section S={S} no="01" title="基本情報" need={!filled.sex || !filled.age || !filled.height || !filled.weight}>
          <div style={{ ...(sex === null ? S.needBox : {}), marginBottom: 24, paddingTop: sex === null ? 10 : 0, paddingBottom: sex === null ? 10 : 0 }}>
            <div style={S.segWrap}>
              <div style={S.chip(sex === "female")} onClick={() => setSex("female")}>女性</div>
              <div style={S.chip(sex === "male")} onClick={() => setSex("male")}>男性</div>
            </div>
          </div>
          <div style={{ ...S.grid2, marginBottom: 24 }}>
            <div style={S.field}><label style={S.flabel}>Age</label>{num(age, setAge)}</div>
            <div style={S.field}><label style={S.flabel}>Height / cm</label>{num(height, setHeight)}</div>
          </div>
          <div style={S.field}><label style={S.flabel}>Weight / kg</label>{num(weight, setWeight)}</div>
        </Section>

        {/* 02 体脂肪率 */}
        <Section S={S} no="02" title="体脂肪率" need={!filled.bfLo || !filled.bfHi} note="家庭用計は日により±数％ぶれます。おおよその幅で捉えてください。">
          <div style={S.grid2}>
            <div style={S.field}><label style={S.flabel}>Low / %</label>{num(bfLo, setBfLo)}</div>
            <div style={S.field}><label style={S.flabel}>High / %</label>{num(bfHi, setBfHi)}</div>
          </div>
        </Section>

        {/* 03 職業 */}
        <Section S={S} no="03" title="職業・勤務中の活動" need={job === null}
          note="この活動係数はFLEXER独自の係数で、一般的な計算式より意図的に厳しめです。ここで選ぶ職業はおおよその出発点。次の「疲れ方」と「歩数」で実際の活動量に寄せて補正します。肩書きと実態がずれても、あとの2問で調整されます。">
          <div style={{ ...S.rowList, ...(job === null ? S.needBox : {}) }}>
            {JOBS.map((j) => {
              const on = job === j.id;
              return (
                <div key={j.id} style={S.row(on)} onClick={() => setJob(j.id)}>
                  <div style={S.rowLabel(on)}>{j.label}</div>
                  <span style={S.rowRight(on)}>{on ? `× ${j.pal.toFixed(2)}` : "目安 " + j.pal.toFixed(2)}</span>
                </div>
              );
            })}
          </div>
        </Section>

        {/* 04 疲労度 */}
        <Section S={S} no="04" title="仕事を終えたときの体の感じ" need={fatigue === null}
          note="「座りっぱなしで固まった疲れ」は活動ではありません。「動いて疲れた」なら活動としてカウントします。">
          <div style={{ ...S.rowList, ...(fatigue === null ? S.needBox : {}) }}>
            {FATIGUE.map((f) => {
              const on = fatigue === f.id;
              return (
                <div key={f.id} style={S.row(on)} onClick={() => setFatigue(f.id)}>
                  <div>
                    <div style={S.rowLabel(on)}>{f.label}</div>
                    {f.note && <div style={S.rowNote}>{f.note}</div>}
                  </div>
                  <span style={S.rowRight(on)}>{f.adj === 0 ? "±0" : (f.adj > 0 ? "+" : "") + f.adj.toFixed(2)}</span>
                </div>
              );
            })}
          </div>
        </Section>

        {/* 05 歩数 */}
        <Section S={S} no="05" title="1日の平均歩数" need={stepsMode === null || (stepsMode === "lifestyle" && lifestyle === null)}>
          <div style={{ ...(stepsMode === null ? S.needBox : {}), marginBottom: 20, paddingTop: stepsMode === null ? 6 : 0 }}>
            <div style={S.segRow}>
              <div style={S.seg(stepsMode === "exact")} onClick={() => setStepsMode("exact")}>数字で入れる</div>
              <div style={S.seg(stepsMode === "lifestyle")} onClick={() => setStepsMode("lifestyle")}>ざっくり選ぶ</div>
              <div style={S.seg(stepsMode === "unknown")} onClick={() => setStepsMode("unknown")}>わからない</div>
            </div>
          </div>
          {stepsMode === "exact" && (
            <div style={S.sliderRow}>
              <input style={S.slider} type="range" min={2000} max={16000} step={500}
                value={steps} onChange={(e) => setSteps(+e.target.value)} />
              <span style={S.sliderVal}>{steps.toLocaleString()}</span>
            </div>
          )}
          {stepsMode === "lifestyle" && (
            <div style={{ ...S.rowList, ...(lifestyle === null ? S.needBox : {}) }}>
              {STEP_LIFESTYLE.map((l) => {
                const on = lifestyle === l.id;
                return (
                  <div key={l.id} style={S.row(on)} onClick={() => setLifestyle(l.id)}>
                    <div style={S.rowLabel(on)}>{l.label}</div>
                    <span style={S.rowRight(on)}>{l.steps.toLocaleString()} 歩</span>
                  </div>
                );
              })}
            </div>
          )}
          {stepsMode === "unknown" && (
            <div style={S.hint}>歩数は使わずに計算します。職業と「疲れ方」で活動量を判定するので問題ありません。無理に推測するより、そのほうが正確です。</div>
          )}
          {(stepsMode === "exact" || stepsMode === "lifestyle") && (
            <div style={S.hint}>買い物や家事のこま切れの歩数は、まとまった運動とは分けて、生活活動としてごく控えめに反映します。</div>
          )}
        </Section>

        {/* 06 運動習慣 */}
        <Section S={S} no="06" title="運動習慣（複数選択可）" need={!(exNone || Object.keys(exFreq).length > 0)}
          note="やっている運動をすべて選び、それぞれの頻度を指定してください。運動していない場合は「運動なし」を選んでください。">
          <div style={{ ...S.rowList, ...(!(exNone || Object.keys(exFreq).length > 0) ? S.needBox : {}) }}>
            {EX_TYPE.map((e) => {
              const on = !!exFreq[e.id];
              return (
                <div key={e.id}>
                  <div style={S.row(on)}
                    onClick={() => { setExNone(false); setExFreq((prev) => {
                      const next = { ...prev };
                      if (next[e.id]) delete next[e.id];
                      else next[e.id] = "f12";
                      return next;
                    }); }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={S.rowMark(on)} />
                      <span style={S.rowLabel(on)}>{e.label}</span>
                    </div>
                    <span style={S.rowRight(on)}>{on ? "選択中" : "追加"}</span>
                  </div>
                  {on && (
                    <div style={{ ...S.segWrap, padding: "12px 0 16px 28px" }}>
                      {FREQ.map((f) => (
                        <div key={f.id} style={S.chip(exFreq[e.id] === f.id)}
                          onClick={() => setExFreq((prev) => ({ ...prev, [e.id]: f.id }))}>
                          {f.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            <div style={S.row(exNone)}
              onClick={() => { setExFreq({}); setExNone(true); }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={S.rowMark(exNone)} />
                <span style={S.rowLabel(exNone)}>運動なし</span>
              </div>
              <span style={S.rowRight(exNone)}>{exNone ? "選択中" : "選ぶ"}</span>
            </div>
          </div>
        </Section>

        {/* 07 減量目標 */}
        <Section S={S} no="07" title="1か月あたりの減量目標" need={lossKg === null}>
          {lossKg === null ? (
            <div style={{ ...S.needBox, padding: "14px 12px" }}>
              <div style={S.segWrap}>
                {[0.5, 1.0, 1.5, 2.0, 2.5, 3.0].map((v) => (
                  <div key={v} style={S.chip(false)} onClick={() => setLossKg(v)}>−{v.toFixed(1)}kg</div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div style={S.sliderRow}>
                <input style={S.slider} type="range" min={0.5} max={3} step={0.5}
                  value={lossKg} onChange={(e) => setLossKg(+e.target.value)} />
                <span style={S.sliderVal}>&minus;{lossKg.toFixed(1)}kg</span>
              </div>
              <div style={S.hint}>
                体重の約2%/月が一般的なペースです{filled.weight && `（現体重${weight}kgなら月−${(+weight * 0.02).toFixed(1)}kg前後）`}。
                {r && `1日あたり約 ${r.dailyDeficit.toLocaleString()} kcal を差し引きます。`}
              </div>
            </>
          )}
        </Section>

        {/* 08 結果 */}
        <Section S={S} no="08" title="結果">
          {!ready ? (
            <div style={{ ...S.needBox, padding: "22px 20px" }}>
              <div style={{ fontSize: 13, color: C.danger, fontWeight: 500, letterSpacing: 0.5, marginBottom: 8 }}>
                すべての項目を入力・選択すると結果が表示されます
              </div>
              <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.9, letterSpacing: 0.3 }}>
                未入力：{[
                  !filled.sex && "性別", (!filled.age || !filled.height || !filled.weight) && "身体情報",
                  (!filled.bfLo || !filled.bfHi) && "体脂肪率", !filled.job && "職業",
                  !filled.fatigue && "疲れ方", (!filled.stepsMode || !filled.lifestyle) && "歩数",
                  !filled.exercise && "運動習慣", !filled.lossKg && "減量目標",
                ].filter(Boolean).join("・")}
              </div>
            </div>
          ) : (
          <div style={S.result}>
            <div style={S.resLabel}>MAINTENANCE&nbsp;&mdash;&nbsp;TDEE</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={S.bigNum(C.ink, 40)}>{r.tdeeMid.toLocaleString()}</span>
              <span style={S.unit(C.sub)}>kcal / 日（中央値）</span>
            </div>
            <div style={S.band}>{r.tdeeLo.toLocaleString()} &mdash; {r.tdeeHi.toLocaleString()} kcal</div>

            <div style={S.hr} />

            <div style={S.resLabelHi}>RECOMMENDED&nbsp;&mdash;&nbsp;&minus;{lossKg.toFixed(1)}KG / 月</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={S.bigNum(r.belowBMR ? C.danger : C.ink, 48)}>{r.intakeHi.toLocaleString()}</span>
              <span style={S.unit(r.belowBMR ? C.danger : C.aquaDeep)}>kcal / 日（推奨の目安）</span>
            </div>
            <div style={S.band}>
              下限 {r.intakeLo.toLocaleString()} ／ 中央 {r.intakeMid.toLocaleString()} kcal<br />
              まずは上限側から始め、停滞したら下げていくのが実践的です。
            </div>

            {r.belowBMR && (
              <>
              <div style={S.warn(C.danger)}>
                <div style={S.warnHead(C.danger)}>この推奨は基礎代謝を下回ります</div>
                <div style={S.warnBody}>
                  減量目標から逆算した推奨は、
                  {r.hiBelow
                    ? `上限・中央・下限のすべてが基礎代謝（${r.bmr.toLocaleString()}kcal）を割り込みます`
                    : `中央・下限とも基礎代謝（${r.bmr.toLocaleString()}kcal）を割り込みます（上限のみ上回る状態）`}
                  。ここまで削るのは体を守る観点でおすすめしません。まずは下の量から始めましょう。
                </div>
              </div>

              <div style={S.startBox}>
                <div style={S.startLabel}>まず始める量</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={S.startNum}>{r.startKcal.toLocaleString()}</span>
                  <span style={S.startUnit}>kcal / 日</span>
                </div>
                <div style={S.startNote}>
                  維持から約8%下げ、基礎代謝は下回らない量です。いきなり減量幅を大きくせず、
                  まずはここから食事のバランスを整えていきます。
                </div>
              </div>

              <div style={S.startGuide}>
                <b>まずの指針</b>：厚生労働省の基準では、成人女性のたんぱく質は1日
                <b>55g</b>が下限の目安です。まずはここを下回らないことから始めます。
              </div>

              <div style={{ ...S.pfcL, textAlign: "left", margin: "18px 0 10px", color: C.sub }}>
                まず始める量の PFC 目安
              </div>
              <div style={S.pfcWrap}>
                <div style={S.pfcBox}>
                  <div style={S.pfcG}>{r.sPLo}&ndash;{r.sPHi}<span style={{ fontSize: 11 }}>g</span></div>
                  <div style={S.pfcL}>PROTEIN</div>
                  <div style={S.pfcSub}>体重×1.3〜1.4</div>
                </div>
                <div style={S.pfcBox}>
                  <div style={S.pfcG}>{r.sFLo}&ndash;{r.sFHi}<span style={{ fontSize: 11 }}>g</span></div>
                  <div style={S.pfcL}>FAT</div>
                  <div style={S.pfcSub}>18〜21%</div>
                </div>
                <div style={S.pfcBox}>
                  <div style={S.pfcG}>{r.sCLo}&ndash;{r.sCHi}<span style={{ fontSize: 11 }}>g</span></div>
                  <div style={S.pfcL}>CARB</div>
                  <div style={S.pfcSub}>50〜55%</div>
                </div>
              </div>

              <div style={S.nextStep}>
                <b>次のステップ</b>：食事のバランスが整い、この量に体が慣れてきたら、そこから
                少しずつカロリーを調整していきます。まずは土台から。
              </div>

              <div style={S.medNote}>
                ※ この糖質・脂質の配分は、健康な方の一般的な目安です。PCOS・インスリン抵抗性・
                糖尿病など、糖代謝に配慮が必要な方を対象としたものではありません。
                該当する場合は医師・管理栄養士の指導を優先してください。
              </div>

              <div style={{ ...S.consult, marginTop: 20 }}>
                この数字はあくまで出発点です。最終的なレンジは担当トレーナーと相談して決めましょう。
              </div>
              </>
            )}
            {!r.belowBMR && r.tight && (
              <div style={S.warn(C.warn)}>
                <div style={S.warnHead(C.warn)}>運動推奨</div>
                <div style={S.warnBody}>
                  摂取が基礎代謝ぎりぎりで、食事だけで作る赤字がシビアです。減量ペースを緩めるか、
                  運動で消費側を増やして余裕を持たせましょう。
                </div>
              </div>
            )}

            {/* 指導文＋PFC（基礎代謝を割らないケースのみ。割る場合は上の開始量ブロックで完結） */}
            {!r.belowBMR && (<>
            <div style={S.hr} />
            <div style={S.guideHead}>
              {r.coachKey === "tight" && "量を削る前に、中身から変えましょう"}
              {r.coachKey === "room" && "レンジ内で、まずは質を整えましょう"}
            </div>
            <div style={S.guideBody}>
              {r.coachKey === "tight" && (
                <>数字は厳しめに出ていますが、伸びしろはむしろここにあります。多くの方は
                たんぱく質が少なく、脂質と糖質に偏っています。減量中でも
                たんぱく質を確保しておくと筋肉量を保ったまま体脂肪を落としやすくなります。
                量を削り切る前に、まずこの配分の組み替えで変えられます。</>
              )}
              {r.coachKey === "room" && (
                <>まずはこのレンジの中で、たんぱく質をしっかり確保し、脂質は量より質
                （飽和脂肪酸に偏らない）を意識しましょう。同じカロリーでもPFCの中身が変われば
                結果は変わります。無理に下端を狙わず、質から整えるのが近道です。</>
              )}
              <div style={S.consult}>
                この数字はあくまで出発点です。最終的なレンジは担当トレーナーと相談して決めましょう。
              </div>
            </div>

            <div style={S.pfcWrap}>
              <div style={S.pfcBox}>
                <div style={S.pfcG}>{r.pGlo}&ndash;{r.pGhi}<span style={{ fontSize: 11 }}>g</span></div>
                <div style={S.pfcL}>PROTEIN</div>
              </div>
              <div style={S.pfcBox}>
                <div style={S.pfcG}>{r.fG}<span style={{ fontSize: 11 }}>g</span></div>
                <div style={S.pfcL}>FAT</div>
              </div>
              <div style={S.pfcBox}>
                <div style={S.pfcG}>{r.cG}<span style={{ fontSize: 11 }}>g</span></div>
                <div style={S.pfcL}>CARB</div>
              </div>
            </div>
            <div style={{ ...S.band, marginTop: 12 }}>
              目安：P=体重×1.3〜1.4g、F=総エネルギーの20%、残りをC。
            </div>
            </>)}

            <div style={S.footNote}>
              ※ 推定値です。中央値で開始し、2〜3週間の体重推移を見て調整してください。
              停滞は「代謝適応でNEATが低下したサイン」として下端側で扱うのが実践的です。
            </div>
          </div>
          )}
        </Section>

        {/* 外食カロリー（ボタンで展開・結果が出てから） */}
        {ready && !showEatOut && (
          <button style={S.revealBtn} onClick={() => setShowEatOut(true)}>
            高カロリー食の例を見る ＋
          </button>
        )}

        {ready && showEatOut && (
          <Section S={S} no="09" title="高カロリー食の例"
            note={`身近な外食・おやつが、1食・1個でだいたい何kcalになるかの一覧です。あなたの1日の推奨は約${r ? r.intakeHi.toLocaleString() : "—"}kcal。一皿・一袋でどれくらい使うか、目安として知っておきましょう。お店や量で差が出るため、幅で示しています。`}>

            {EATING_OUT.map((grp) => (
              <div key={grp.cat} style={{ marginBottom: 22 }}>
                <div style={{ ...S.flabel, marginBottom: 6 }}>{grp.cat}</div>
                {grp.items.map((it, i) => (
                  <div key={i} style={{ ...S.foodRow, alignItems: "flex-start" }}>
                    <div style={{ flex: 1, paddingRight: 12 }}>
                      <div style={S.foodName}>{it.name}</div>
                      {it.note && <div style={{ ...S.rowNote }}>{it.note}</div>}
                    </div>
                    <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <div style={S.foodG}>
                        {it.kcalLo === it.kcalHi ? `約${it.kcalLo}` : `${it.kcalLo}–${it.kcalHi}`}
                        <span style={{ fontSize: 11, color: C.sub }}> kcal</span>
                      </div>
                      <div style={{ fontFamily: JOST, fontSize: 11, color: C.sub, letterSpacing: 0.5, marginTop: 3 }}>
                        P{it.P} · F{it.F} · C{it.C}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}

            {/* 脂質・糖質でカロリーが先に埋まる、という気づき */}
            <div style={{ background: C.need, border: `1px solid ${C.needLine}`, padding: "16px 16px 18px", marginTop: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 500, letterSpacing: 0.5, color: C.danger, marginBottom: 6 }}>
                脂質・糖質は、カロリーを一気に押し上げます
              </div>
              <div style={{ ...S.guideBody }}>
                これらの多くは脂質と糖質が高く、その分カロリーもすぐ大きくなります。
                こうした一皿が続くと、<b>必要なたんぱく質を摂りきる前に、1日の摂取量の上限に達してしまう</b>ことがあります。
                「お腹は満たされたのに、たんぱく質は足りていない」という状態です。
              </div>
            </div>

            {/* スタンス＋食事管理指導への導線 */}
            <div style={{ borderTop: `1px solid ${C.ink}`, marginTop: 28, paddingTop: 24 }}>
              <div style={{ fontSize: 17, fontWeight: 500, letterSpacing: 1, lineHeight: 1.7, color: C.ink, marginBottom: 14 }}>
                これらを禁止はしません。<br />まず「知って」過ごしましょう。
              </div>
              <div style={{ ...S.guideBody, marginBottom: 16 }}>
                好きなものを食べてはいけない、ということではありません。
                大切なのは、これらの一皿がどれだけのカロリーになるかを知っておくこと。
                そのうえで食べるなら、次のどれかで全体のバランスを取る必要があります。
              </div>
              <div style={S.rowList}>
                <div style={{ ...S.foodRow, cursor: "default" }}>
                  <span style={{ ...S.foodName, color: C.ink }}>ほかの食事を抑える</span>
                  <span style={S.rowRight(false)}>ADJUST</span>
                </div>
                <div style={{ ...S.foodRow, cursor: "default" }}>
                  <span style={{ ...S.foodName, color: C.ink }}>1週間単位で運動量を増やす</span>
                  <span style={S.rowRight(false)}>MOVE</span>
                </div>
                <div style={{ ...S.foodRow, cursor: "default" }}>
                  <span style={{ ...S.foodName, color: C.ink }}>摂取量そのものを調整する</span>
                  <span style={S.rowRight(false)}>INTAKE</span>
                </div>
              </div>
              <div style={{ background: C.aquaSoft, border: `1px solid ${C.aqua}`, padding: "18px 18px 20px", marginTop: 18 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500, letterSpacing: 0.5, color: C.aquaDeep, marginBottom: 6 }}>
                  この全体のバランス調整を一緒に行うのが、食事管理指導です。
                </div>
                <div style={{ fontSize: 12.5, lineHeight: 1.9, letterSpacing: 0.3, color: C.ink }}>
                  日々の食事・運動・摂取量を、1週間単位で無理なく整えていきます。
                  ご興味があれば、担当トレーナーまでお声がけください。
                </div>
              </div>
            </div>

            <div style={{ ...S.band, marginTop: 24 }}>
              出典：カロリーSlism（日本食品標準成分表8訂ベース）ほか、各社栄養成分・管理栄養士監修記事より。
              値は代表的な目安で、店舗・具材・量により変動します。
            </div>

            <button style={{ ...S.revealBtn, borderColor: C.line, color: C.sub }}
              onClick={() => setShowEatOut(false)}>
              閉じる −
            </button>
          </Section>
        )}

      </div>
    </div>
  );
}
