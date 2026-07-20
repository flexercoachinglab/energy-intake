"use client";
import React, { useState, useMemo } from "react";

// ============================================================
// FLEXER 摂取カロリー設定ツール v4
//   配色: 白/黒/グレー/水色（既存アプリ準拠）
//   職業は「出発点」に格下げ。歩数(客観)＋主観的疲労度で最終PALを補正。
//     → 肩書きと実活動のズレ(管理職看護師/バタバタ主婦)を自動吸収。
//   活動係数=FLEXERオリジナル(辛口)。減量は月-0.5〜-3kg。
//   BMR割り込みは非推奨→「食べて・動いて・寝る」メッセージ。
// ============================================================

const C = {
  ink: "#1b1e22", paper: "#f4f6f8", card: "#ffffff", line: "#dde3e8",
  sub: "#6b7480", accent: "#3ea0d4", accentSoft: "#e6f2fa", accentDeep: "#2b7fb0",
  keep: "#7fb8dd", cut: "#4aa3d6", warn: "#c98a3a", danger: "#c4573f",
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
  // 出発点補正: 3000歩基準。少なければマイナス、多ければプラス（上限±0.06）
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
  const [stepsMode, setStepsMode] = useState("exact"); // exact | lifestyle | unknown
  const [steps, setSteps] = useState(4000);
  const [lifestyle, setLifestyle] = useState("l2");
  // 運動習慣: { [種目id]: 頻度id }。キーが無い＝その種目はやっていない。空＝運動なし。
  const [exFreq, setExFreq] = useState({});
  const [lossKg, setLossKg] = useState(2.0);

  const r = useMemo(() => {
    const bmr = bmrMifflin({ sex, weight, height, age });
    const jobPal = JOBS.find((j) => j.id === job).pal;
    const fAdj = FATIGUE.find((f) => f.id === fatigue).adj;
    // 歩数モード: exact=スライダー値 / lifestyle=生活実感の代表値 / unknown=補正なし
    let effSteps = steps;
    if (stepsMode === "lifestyle") effSteps = STEP_LIFESTYLE.find((l) => l.id === lifestyle).steps;
    const sAdj = stepsMode === "unknown" ? 0 : stepsAdj(effSteps);
    // 選択された運動をすべて合算し、上限+0.18でクランプ
    const eRaw = EX_TYPE.reduce((sum, t) => {
      const fId = exFreq[t.id];
      if (!fId) return sum;
      const fn = FREQ.find((f) => f.id === fId)?.n || 0;
      return sum + t.perFreq * fn;
    }, 0);
    const eAdd = Math.min(eRaw, 0.18);

    // 職業(出発点) ± 疲労 ± 歩数 で活動帯を確定、その上に運動を加算
    let base = jobPal + fAdj + sAdj;
    base = Math.max(1.10, Math.min(1.55, base)); // 常識的レンジで安全弁
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

    // PFC目安。一般の減量向け：P=体重×1.3〜1.4g、F=総kcalの20%、残りC。
    // BMR割り込み時は「量を削る前」の設計なので、PFCはBMRを基準に組む。
    const pfcBasis = Math.max(intakeMid, bmr);
    const pGlo = Math.round(weight * 1.3);
    const pGhi = Math.round(weight * 1.4);
    const pKcal = ((pGlo + pGhi) / 2) * 4; // C算出には中央値を使用
    const fKcal = pfcBasis * 0.20;
    const fG = Math.round(fKcal / 9);
    const cKcal = Math.max(0, pfcBasis - pKcal - fKcal);
    const cG = Math.round(cKcal / 4);

    // 指導文の切り替え
    let coachKey = "room"; // room=余裕 / tight=シビア / below=BMR割れ
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

  const S = {
    wrap: { minHeight: "100vh", background: C.paper, color: C.ink,
      fontFamily: "'Hiragino Sans','Helvetica Neue',sans-serif", padding: "24px 16px" },
    inner: { maxWidth: 760, margin: "0 auto" },
    eyebrow: { fontSize: 12, letterSpacing: 3, color: C.accentDeep, fontWeight: 700 },
    h1: { fontSize: 26, fontWeight: 800, margin: "6px 0 4px", letterSpacing: -0.5 },
    lead: { fontSize: 13, color: C.sub, lineHeight: 1.7, margin: "0 0 12px" },
    caveat: { fontSize: 11.5, color: C.sub, lineHeight: 1.75, background: "#f0f3f6",
      border: `1px solid ${C.line}`, borderRadius: 10, padding: "12px 14px", marginBottom: 20 },
    card: { background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: 18, marginBottom: 14 },
    label: { fontSize: 12, fontWeight: 700, color: C.sub, marginBottom: 8, display: "block", letterSpacing: 0.5 },
    row: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 },
    field: { display: "flex", flexDirection: "column" },
    input: { padding: "10px 12px", border: `1px solid ${C.line}`, borderRadius: 9,
      fontSize: 15, background: "#fbfcfd", color: C.ink, outline: "none" },
    segWrap: { display: "flex", gap: 6, flexWrap: "wrap" },
    seg: (on) => ({ padding: "8px 14px", borderRadius: 20, fontSize: 13, cursor: "pointer",
      border: `1px solid ${on ? C.accent : C.line}`, background: on ? C.accent : "#fff",
      color: on ? "#fff" : C.ink, fontWeight: on ? 700 : 500 }),
    opt: (on) => ({ padding: "11px 13px", borderRadius: 10, cursor: "pointer", marginBottom: 7,
      border: `1px solid ${on ? C.accent : C.line}`, background: on ? C.accentSoft : "#fff",
      display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }),
    optNote: { fontSize: 11, color: C.sub, marginTop: 2 },
    pal: { fontSize: 12, fontWeight: 800, color: C.accentDeep, whiteSpace: "nowrap" },
    resultCard: { background: C.accentSoft, color: C.ink, borderRadius: 16, padding: 22, marginTop: 4,
      border: `1px solid ${C.accent}44` },
    rangeLab: { fontSize: 12, color: C.accentDeep, fontWeight: 700, marginBottom: 6 },
    rangeVal: { display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" },
    mid: (col) => ({ fontSize: 34, fontWeight: 800, color: col, lineHeight: 1 }),
    band: { fontSize: 13, color: C.sub },
    breakdown: { fontSize: 12, color: C.sub, marginTop: 18, lineHeight: 1.9,
      borderTop: `1px solid ${C.accent}33`, paddingTop: 14 },
    origin: { background: C.accentSoft, border: `1px solid ${C.accent}44`, borderRadius: 10,
      padding: "10px 12px", fontSize: 11.5, color: C.accentDeep, lineHeight: 1.7, marginBottom: 10 },
    hint: { background: "#f0f3f6", borderRadius: 8, padding: "8px 10px", fontSize: 11, color: C.sub, lineHeight: 1.6, marginBottom: 10 },
    slider: { width: "100%", accentColor: C.accent },
    warnBox: (col) => ({ background: col + "1a", border: `1px solid ${col}`, borderRadius: 12,
      padding: "14px 16px", marginTop: 16, color: C.ink }),
    guide: { background: "#ffffff", border: `1px solid ${C.accent}55`,
      borderRadius: 12, padding: "14px 16px", marginTop: 16 },
    guideHead: { fontSize: 13, fontWeight: 800, color: C.accentDeep, marginBottom: 6 },
    guideBody: { fontSize: 13, lineHeight: 1.85, color: C.ink },
    pfcWrap: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 12 },
    pfcBox: { background: C.accentSoft, border: `1px solid ${C.accent}44`,
      borderRadius: 10, padding: "10px 8px", textAlign: "center" },
    pfcG: { fontSize: 20, fontWeight: 800, color: C.ink, lineHeight: 1 },
    pfcL: { fontSize: 11, color: C.sub, marginTop: 4 },
  };

  return (
    <div style={S.wrap}>
      <div style={S.inner}>
        <div style={S.eyebrow}>FLEXER · Intake</div>
        <h1 style={S.h1}>エネルギー摂取量設定</h1>
        <p style={S.lead}>目標に合わせた1日のエネルギー摂取量をレンジで提示します。</p>
        <div style={S.caveat}>
          <div style={{ marginBottom: 6 }}>
            ※フレクサー独自の現場における経験則や算出式を盛り込んであります。あくまでも目安としてご確認ください。
          </div>
          <div>
            ※最終的に算出されたカロリーについては、担当トレーナーと相談の上、糖質の摂取量を減らして脂質の量を増やすなど、
            カロリーやPFCの調整は担当トレーナーと相談して決めてください。
          </div>
        </div>

        <div style={S.card}>
          <span style={S.label}>基本情報</span>
          <div style={S.segWrap}>
            <div style={S.seg(sex === "female")} onClick={() => setSex("female")}>女性</div>
            <div style={S.seg(sex === "male")} onClick={() => setSex("male")}>男性</div>
          </div>
          <div style={{ ...S.row, marginTop: 12 }}>
            <div style={S.field}><label style={S.label}>年齢</label>
              <input style={S.input} type="number" value={age} onChange={(e) => setAge(+e.target.value)} /></div>
            <div style={S.field}><label style={S.label}>身長 (cm)</label>
              <input style={S.input} type="number" value={height} onChange={(e) => setHeight(+e.target.value)} /></div>
          </div>
          <div style={S.field}><label style={S.label}>体重 (kg)</label>
            <input style={S.input} type="number" value={weight} onChange={(e) => setWeight(+e.target.value)} /></div>
        </div>

        <div style={S.card}>
          <span style={S.label}>体脂肪率（レンジで入力・％）</span>
          <div style={S.row}>
            <div style={S.field}><label style={S.label}>下限</label>
              <input style={S.input} type="number" value={bfLo} onChange={(e) => setBfLo(+e.target.value)} /></div>
            <div style={S.field}><label style={S.label}>上限</label>
              <input style={S.input} type="number" value={bfHi} onChange={(e) => setBfHi(+e.target.value)} /></div>
          </div>
          <div style={S.optNote}>家庭用計は日により±数％ぶれます。おおよその幅で捉えてください。</div>
        </div>

        <div style={S.card}>
          <span style={S.label}>職業・勤務中の活動（出発点）</span>
          <div style={S.origin}>
            この活動係数は <b>FLEXERオリジナルの独自係数</b> で、一般的な計算式より <b>意図的に厳しめ（辛口）</b> です。
            ここで選ぶ職業は<b>おおよその出発点</b>。次の「疲れ方」と「歩数」で実際の活動量に寄せて補正します。
          </div>
          <div style={S.hint}>
            肩書きと実態がずれることがあります（例：看護師でも管理職で座り中心／主婦でもバタバタ動く）。
            迷ったら近いものを選び、あとの2問で調整されるので大丈夫です。
          </div>
          {JOBS.map((j) => (
            <div key={j.id} style={S.opt(job === j.id)} onClick={() => setJob(j.id)}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{j.label}</div>
              <span style={S.pal}>目安 ×{j.pal.toFixed(2)}</span>
            </div>
          ))}
        </div>

        {/* 主観的疲労度 */}
        <div style={S.card}>
          <span style={S.label}>仕事を終えたときの体の感じ</span>
          <div style={S.hint}>「座りっぱなしで固まった疲れ」は活動ではありません。「動いて疲れた」なら活動としてカウントします。</div>
          {FATIGUE.map((f) => (
            <div key={f.id} style={S.opt(fatigue === f.id)} onClick={() => setFatigue(f.id)}>
              <div><div style={{ fontSize: 13, fontWeight: 600 }}>{f.label}</div>
                {f.note && <div style={S.optNote}>{f.note}</div>}</div>
              <span style={S.pal}>{f.adj === 0 ? "±0" : (f.adj > 0 ? "+" : "") + f.adj.toFixed(2)}</span>
            </div>
          ))}
        </div>

        <div style={S.card}>
          <span style={S.label}>1日の平均歩数</span>
          <div style={{ ...S.segWrap, marginBottom: 12 }}>
            <div style={S.seg(stepsMode === "exact")} onClick={() => setStepsMode("exact")}>数字で入れる</div>
            <div style={S.seg(stepsMode === "lifestyle")} onClick={() => setStepsMode("lifestyle")}>ざっくり選ぶ</div>
            <div style={S.seg(stepsMode === "unknown")} onClick={() => setStepsMode("unknown")}>わからない</div>
          </div>

          {stepsMode === "exact" && (
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <input style={S.slider} type="range" min={2000} max={16000} step={500}
                value={steps} onChange={(e) => setSteps(+e.target.value)} />
              <span style={{ fontWeight: 800, fontSize: 15, minWidth: 78, textAlign: "right" }}>
                {steps.toLocaleString()}歩</span>
            </div>
          )}

          {stepsMode === "lifestyle" && (
            <div>
              {STEP_LIFESTYLE.map((l) => (
                <div key={l.id} style={S.opt(lifestyle === l.id)} onClick={() => setLifestyle(l.id)}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{l.label}</div>
                  <span style={S.pal}>目安 {l.steps.toLocaleString()}歩</span>
                </div>
              ))}
            </div>
          )}

          {stepsMode === "unknown" && (
            <div style={S.hint}>
              歩数は使わずに計算します。職業と「疲れ方」で活動量を判定するので問題ありません。
              無理に推測するより、そのほうが正確です。
            </div>
          )}

          {stepsMode !== "unknown" && (
            <div style={S.optNote}>
              買い物や家事のこま切れの歩数は、まとまった運動とは分けて、生活活動として<b>ごく控えめに</b>反映します。
            </div>
          )}
        </div>

        <div style={S.card}>
          <span style={S.label}>運動習慣（意図的な運動・複数選択可）</span>
          <div style={{ fontSize: 11, color: C.sub, marginBottom: 10 }}>
            やっている運動をすべて選び、それぞれの頻度を指定してください。何もしていなければ空のままでOK。
          </div>
          {EX_TYPE.map((e) => {
            const on = !!exFreq[e.id];
            return (
              <div key={e.id} style={{ marginBottom: 8 }}>
                <div style={S.opt(on)}
                  onClick={() => setExFreq((prev) => {
                    const next = { ...prev };
                    if (next[e.id]) delete next[e.id];   // 解除
                    else next[e.id] = "f12";              // 選択時は週1〜2をデフォルト
                    return next;
                  })}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{e.label}</div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: on ? C.accentDeep : C.sub }}>
                    {on ? "選択中" : "＋ 追加"}
                  </span>
                </div>
                {on && (
                  <div style={{ ...S.segWrap, marginTop: 6, marginLeft: 4 }}>
                    {FREQ.map((f) => (
                      <div key={f.id} style={S.seg(exFreq[e.id] === f.id)}
                        onClick={() => setExFreq((prev) => ({ ...prev, [e.id]: f.id }))}>
                        {f.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {Object.keys(exFreq).length === 0 && (
            <div style={{ ...S.hint, marginTop: 4, marginBottom: 0 }}>
              運動習慣なしとして計算します。
            </div>
          )}
        </div>

        <div style={S.card}>
          <span style={S.label}>1か月あたりの減量目標</span>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <input style={S.slider} type="range" min={0.5} max={3} step={0.5}
              value={lossKg} onChange={(e) => setLossKg(+e.target.value)} />
            <span style={{ fontWeight: 800, fontSize: 15, minWidth: 78, textAlign: "right" }}>
              −{lossKg.toFixed(1)}kg</span>
          </div>
          <div style={S.optNote}>
            体重の約2%/月が一般的なペースです（現体重{weight}kgなら月−{(weight * 0.02).toFixed(1)}kg前後）。
            1日あたり約 {r.dailyDeficit.toLocaleString()} kcal を差し引きます。
          </div>
        </div>

        <div style={S.resultCard}>
          <div style={S.rangeLab}>体重維持レンジ（TDEE）</div>
          <div style={S.rangeVal}>
            <span style={S.mid(C.ink)}>{r.tdeeMid.toLocaleString()}</span>
            <span style={{ fontSize: 15, color: C.sub, fontWeight: 700 }}>kcal/日（中央値）</span>
          </div>
          <div style={S.band}>幅: {r.tdeeLo.toLocaleString()} 〜 {r.tdeeHi.toLocaleString()} kcal</div>

          <div style={{ borderTop: `1px solid ${C.accent}33`, paddingTop: 16, marginTop: 16 }}>
            <div style={S.rangeLab}>減量推奨エネルギー摂取レンジ（月−{lossKg.toFixed(1)}kg）</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <span style={S.mid(r.belowBMR ? C.danger : C.accentDeep)}>{r.intakeHi.toLocaleString()}</span>
              <span style={{ fontSize: 15, color: r.belowBMR ? C.danger : C.accentDeep, fontWeight: 700 }}>
                kcal/日（推奨の目安）
              </span>
            </div>
            <div style={{ ...S.band, marginTop: 6 }}>
              下限は {r.intakeLo.toLocaleString()} kcal（中央 {r.intakeMid.toLocaleString()} kcal）。
              まずは上限側から始め、停滞したら下げていくのが実践的です。
            </div>
          </div>

          {r.belowBMR && (
            <div style={S.warnBox(C.danger)}>
              <div style={{ fontWeight: 800, marginBottom: 6, color: C.danger }}>⚠ 基礎代謝量を下回っています（非推奨）</div>
              <div style={{ fontSize: 13, lineHeight: 1.8, color: C.ink }}>
                このペースだと目安の下側が基礎代謝（{r.bmr.toLocaleString()}kcal）を割り込みます。
                摂取を引き上げた状態で <b>「食べて、動いて、寝る」</b> の三本柱で過ごしてください。
                減量ペースを緩めるか、<b>運動で消費を増やす</b>ことを推奨します。
              </div>
            </div>
          )}
          {!r.belowBMR && r.tight && (
            <div style={S.warnBox(C.warn)}>
              <div style={{ fontWeight: 800, marginBottom: 4, color: "#9a6a20" }}>運動推奨</div>
              <div style={{ fontSize: 13, lineHeight: 1.8, color: C.ink }}>
                摂取が基礎代謝ぎりぎりで、食事だけで作る赤字がシビアです。減量ペースを緩めるか、
                運動で消費側を増やして余裕を持たせましょう。
              </div>
            </div>
          )}

          {/* 前向きな指導文＋PFC目安 */}
          <div style={S.guide}>
            <div style={S.guideHead}>
              {r.coachKey === "below" && "まず「食べて・動いて・寝る」から"}
              {r.coachKey === "tight" && "量を削る前に、中身から変えましょう"}
              {r.coachKey === "room" && "レンジ内で、まずは質を整えましょう"}
            </div>
            <div style={S.guideBody}>
              {r.coachKey === "below" && (
                <>この段階は摂取量を削るフェーズではありません。いったん摂取を引き上げ、
                その中で <b>たんぱく質を増やし、脂質の質（飽和脂肪酸の摂りすぎ）を見直す</b>だけでも
                体は変わります。まずは食事の中身から整えましょう。</>
              )}
              {r.coachKey === "tight" && (
                <>数字は厳しめに出ていますが、伸びしろはむしろここにあります。多くの方は
                <b>たんぱく質が少なく、脂質と糖質に偏っています</b>。減量中でも
                たんぱく質を確保しておくと <b>筋肉量を保ったまま体脂肪を落としやすく</b>なります。
                量を削り切る前に、まずこの配分の組み替えで変えられます。</>
              )}
              {r.coachKey === "room" && (
                <>まずはこのレンジの中で、<b>たんぱく質をしっかり確保</b>し、脂質は量より質
                （飽和脂肪酸に偏らない）を意識しましょう。同じカロリーでもPFCの中身が変われば
                結果は変わります。無理に下端を狙わず、質から整えるのが近道です。</>
              )}
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.line}`,
                fontSize: 12.5, color: C.accentDeep, fontWeight: 600 }}>
                この数字はあくまで出発点です。最終的なレンジは <b>担当トレーナーと相談して</b>決めましょう。
              </div>
            </div>

            <div style={S.pfcWrap}>
              <div style={S.pfcBox}>
                <div style={S.pfcG}>{r.pGlo}–{r.pGhi}<span style={{ fontSize: 12 }}>g</span></div>
                <div style={S.pfcL}>たんぱく質 P</div>
              </div>
              <div style={S.pfcBox}>
                <div style={S.pfcG}>{r.fG}<span style={{ fontSize: 12 }}>g</span></div>
                <div style={S.pfcL}>脂質 F</div>
              </div>
              <div style={S.pfcBox}>
                <div style={S.pfcG}>{r.cG}<span style={{ fontSize: 12 }}>g</span></div>
                <div style={S.pfcL}>炭水化物 C</div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: C.sub, marginTop: 8, lineHeight: 1.6 }}>
              目安：P=体重×1.3〜1.4g、F=総エネルギーの20%、残りをC。
              {r.belowBMR && "（基礎代謝を下回る設定のため、PFCは基礎代謝ぶんを基準に算出）"}
            </div>
          </div>

          <div style={S.breakdown}>
            基礎代謝（Mifflin-St Jeor）: <b>{r.bmr.toLocaleString()} kcal</b><br />
            活動係数 PAL（FLEXER独自・辛口）: <b>{r.palMid}</b><br />
            内訳: 職業 {r.jobPal.toFixed(2)} ＋ 疲れ方 {r.fAdj >= 0 ? "+" : ""}{r.fAdj.toFixed(2)}
            ＋ 歩数 {stepsMode === "unknown" ? "未使用" : (r.sAdj >= 0 ? "+" : "") + r.sAdj.toFixed(2)}
            （活動帯 {r.base}）＋ 運動 {r.eAdd.toFixed(2)}
          </div>
        </div>

        <p style={{ fontSize: 11, color: C.sub, marginTop: 12, lineHeight: 1.7 }}>
          ※ 推定値です。中央値で開始し、2〜3週間の体重推移を見て調整してください。
          停滞は「代謝適応でNEATが低下したサイン」として下端側で扱うのが実践的です。
        </p>
      </div>
    </div>
  );
}
