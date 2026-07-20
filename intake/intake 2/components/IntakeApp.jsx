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
  warn: "#B98A3A", danger: "#C4573F",
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

function bmrMifflin({ sex, weight, height, age }) {
  const base = 10 * weight + 6.25 * height - 5 * age;
  return sex === "male" ? base + 5 : base - 161;
}
function stepsAdj(steps) {
  const d = (steps - 4000) / 1000 * 0.012;
  return Math.max(-0.06, Math.min(0.06, d));
}
const rnd = (n) => Math.round(n / 10) * 10;

export default function App() {
  const [sex, setSex] = useState("female");
  const [age, setAge] = useState(40);
  const [height, setHeight] = useState(160);
  const [weight, setWeight] = useState(58);
  const [bfLo, setBfLo] = useState(26);
  const [bfHi, setBfHi] = useState(30);
  const [job, setJob] = useState("stand");
  const [fatigue, setFatigue] = useState("mid");
  const [stepsMode, setStepsMode] = useState("exact");
  const [steps, setSteps] = useState(4000);
  const [lifestyle, setLifestyle] = useState("l2");
  const [exFreq, setExFreq] = useState({});
  const [lossKg, setLossKg] = useState(2.0);

  const r = useMemo(() => {
    const bmr = bmrMifflin({ sex, weight, height, age });
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
    const pGlo = Math.round(weight * 1.3);
    const pGhi = Math.round(weight * 1.4);
    const pKcal = ((pGlo + pGhi) / 2) * 4;
    const fKcal = pfcBasis * 0.20;
    const fG = Math.round(fKcal / 9);
    const cKcal = Math.max(0, pfcBasis - pKcal - fKcal);
    const cG = Math.round(cKcal / 4);

    let coachKey = "room";
    if (belowBMR) coachKey = "below";
    else if (tight) coachKey = "tight";

    return {
      bmr: Math.round(bmr), jobPal, fAdj, sAdj, eAdd, base: base.toFixed(2),
      palMid: palMid.toFixed(2),
      tdeeMid: rnd(tdeeMid), tdeeLo: rnd(tdeeLo), tdeeHi: rnd(tdeeHi),
      dailyDeficit: Math.round(dailyDeficit),
      intakeMid: rnd(intakeMid), intakeLo: rnd(intakeLo), intakeHi: rnd(intakeHi),
      belowBMR, tight,
      pGlo, pGhi, fG, cG, pfcBasis: rnd(pfcBasis), coachKey,
    };
  }, [sex, age, height, weight, job, fatigue, stepsMode, steps, lifestyle, exFreq, lossKg]);

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
    footNote: { fontSize: 11, color: C.sub, letterSpacing: 0.3, lineHeight: 1.85, marginTop: 40 },
  };

  const Section = ({ no, title, note, children }) => (
    <div style={S.section}>
      <div style={S.secHead}>
        <span style={S.secNo}>{no}</span>
        <span style={S.secTitle}>{title}</span>
      </div>
      {note && <div style={S.secNote}>{note}</div>}
      {children}
    </div>
  );

  const num = (v, set) => (
    <input style={S.input} type="number" value={v} onChange={(e) => set(+e.target.value)} />
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
        <Section no="01" title="基本情報">
          <div style={{ ...S.segWrap, marginBottom: 24 }}>
            <div style={S.chip(sex === "female")} onClick={() => setSex("female")}>女性</div>
            <div style={S.chip(sex === "male")} onClick={() => setSex("male")}>男性</div>
          </div>
          <div style={{ ...S.grid2, marginBottom: 24 }}>
            <div style={S.field}><label style={S.flabel}>Age</label>{num(age, setAge)}</div>
            <div style={S.field}><label style={S.flabel}>Height / cm</label>{num(height, setHeight)}</div>
          </div>
          <div style={S.field}><label style={S.flabel}>Weight / kg</label>{num(weight, setWeight)}</div>
        </Section>

        {/* 02 体脂肪率 */}
        <Section no="02" title="体脂肪率" note="家庭用計は日により±数％ぶれます。おおよその幅で捉えてください。">
          <div style={S.grid2}>
            <div style={S.field}><label style={S.flabel}>Low / %</label>{num(bfLo, setBfLo)}</div>
            <div style={S.field}><label style={S.flabel}>High / %</label>{num(bfHi, setBfHi)}</div>
          </div>
        </Section>

        {/* 03 職業 */}
        <Section no="03" title="職業・勤務中の活動"
          note="この活動係数はFLEXER独自の係数で、一般的な計算式より意図的に厳しめです。ここで選ぶ職業はおおよその出発点。次の「疲れ方」と「歩数」で実際の活動量に寄せて補正します。肩書きと実態がずれても、あとの2問で調整されます。">
          <div style={S.rowList}>
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
        <Section no="04" title="仕事を終えたときの体の感じ"
          note="「座りっぱなしで固まった疲れ」は活動ではありません。「動いて疲れた」なら活動としてカウントします。">
          <div style={S.rowList}>
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
        <Section no="05" title="1日の平均歩数">
          <div style={{ ...S.segRow, marginBottom: 20 }}>
            <div style={S.seg(stepsMode === "exact")} onClick={() => setStepsMode("exact")}>数字で入れる</div>
            <div style={S.seg(stepsMode === "lifestyle")} onClick={() => setStepsMode("lifestyle")}>ざっくり選ぶ</div>
            <div style={S.seg(stepsMode === "unknown")} onClick={() => setStepsMode("unknown")}>わからない</div>
          </div>
          {stepsMode === "exact" && (
            <div style={S.sliderRow}>
              <input style={S.slider} type="range" min={2000} max={16000} step={500}
                value={steps} onChange={(e) => setSteps(+e.target.value)} />
              <span style={S.sliderVal}>{steps.toLocaleString()}</span>
            </div>
          )}
          {stepsMode === "lifestyle" && (
            <div style={S.rowList}>
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
          {stepsMode !== "unknown" && (
            <div style={S.hint}>買い物や家事のこま切れの歩数は、まとまった運動とは分けて、生活活動としてごく控えめに反映します。</div>
          )}
        </Section>

        {/* 06 運動習慣 */}
        <Section no="06" title="運動習慣（複数選択可）"
          note="やっている運動をすべて選び、それぞれの頻度を指定してください。何もしていなければ空のままでOK。">
          <div style={S.rowList}>
            {EX_TYPE.map((e) => {
              const on = !!exFreq[e.id];
              return (
                <div key={e.id}>
                  <div style={S.row(on)}
                    onClick={() => setExFreq((prev) => {
                      const next = { ...prev };
                      if (next[e.id]) delete next[e.id];
                      else next[e.id] = "f12";
                      return next;
                    })}>
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
          </div>
          {Object.keys(exFreq).length === 0 && (
            <div style={S.hint}>運動習慣なしとして計算します。</div>
          )}
        </Section>

        {/* 07 減量目標 */}
        <Section no="07" title="1か月あたりの減量目標">
          <div style={S.sliderRow}>
            <input style={S.slider} type="range" min={0.5} max={3} step={0.5}
              value={lossKg} onChange={(e) => setLossKg(+e.target.value)} />
            <span style={S.sliderVal}>&minus;{lossKg.toFixed(1)}kg</span>
          </div>
          <div style={S.hint}>
            体重の約2%/月が一般的なペースです（現体重{weight}kgなら月−{(weight * 0.02).toFixed(1)}kg前後）。
            1日あたり約 {r.dailyDeficit.toLocaleString()} kcal を差し引きます。
          </div>
        </Section>

        {/* 08 結果 */}
        <Section no="08" title="結果">
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
              <div style={S.warn(C.danger)}>
                <div style={S.warnHead(C.danger)}>基礎代謝量を下回っています（非推奨）</div>
                <div style={S.warnBody}>
                  このペースだと目安の下側が基礎代謝（{r.bmr.toLocaleString()}kcal）を割り込みます。
                  摂取を引き上げた状態で「食べて、動いて、寝る」の三本柱で過ごしてください。
                  減量ペースを緩めるか、運動で消費を増やすことを推奨します。
                </div>
              </div>
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

            {/* 指導文＋PFC */}
            <div style={S.hr} />
            <div style={S.guideHead}>
              {r.coachKey === "below" && "まず「食べて・動いて・寝る」から"}
              {r.coachKey === "tight" && "量を削る前に、中身から変えましょう"}
              {r.coachKey === "room" && "レンジ内で、まずは質を整えましょう"}
            </div>
            <div style={S.guideBody}>
              {r.coachKey === "below" && (
                <>この段階は摂取量を削るフェーズではありません。いったん摂取を引き上げ、
                その中でたんぱく質を増やし、脂質の質（飽和脂肪酸の摂りすぎ）を見直すだけでも
                体は変わります。まずは食事の中身から整えましょう。</>
              )}
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
              {r.belowBMR && "（基礎代謝を下回る設定のため、PFCは基礎代謝ぶんを基準に算出）"}
            </div>

            <div style={S.footNote}>
              ※ 推定値です。中央値で開始し、2〜3週間の体重推移を見て調整してください。
              停滞は「代謝適応でNEATが低下したサイン」として下端側で扱うのが実践的です。
            </div>
          </div>
        </Section>

      </div>
    </div>
  );
}
