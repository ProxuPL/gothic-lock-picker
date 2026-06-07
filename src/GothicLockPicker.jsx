import { useState, useCallback, useEffect } from "react";

const MAX_LATCHES         = 8;
const DEFAULT_LATCH_COUNT = 6;

const DEFAULT_DEP_MATRIX = Array.from({ length: MAX_LATCHES }, () => Array(MAX_LATCHES).fill(null));
const DEFAULT_START       = [2, 3, 4, 6, 6, 4, 4, 4];

const PIN_COLORS = [
  "#e05c5c", "#e08c3a", "#d4c84a", "#5cba6a",
  "#4a9de0", "#9b6ae0", "#e05c9b", "#5ce0c8",
];

// ─── HOOK ─────────────────────────────────────────────────────────────────────

function useWindowWidth() {
  const [w, setW] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 800
  );
  useEffect(() => {
    const onResize = () => setW(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return w;
}

// ─── ENGINE ───────────────────────────────────────────────────────────────────

function buildMoves(depMatrix, n) {
  const moves = [];
  for (let z = 0; z < n; z++) {
    for (const dir of [-1, +1]) {
      moves.push({ label: `L${z+1} ${dir===-1?"RIGHT":"LEFT"}`, z, dir, depMatrix });
    }
  }
  return moves;
}

function applyMove(state, move, n) {
  const { z, dir, depMatrix } = move;
  const affected = [[z, dir]];
  for (let p = 0; p < n; p++) {
    if (p === z) continue;
    const rel = depMatrix[z][p];
    if (!rel) continue;
    affected.push([p, rel === "+" ? dir : -dir]);
  }
  for (const [pin, d] of affected) {
    const v = state[pin] + d;
    if (v < 1 || v > 7) return null;
  }
  const next = [...state];
  for (const [pin, d] of affected) next[pin] = state[pin] + d;
  return next;
}

function stateKey(s) { return s.join(","); }

function bfs(start, goal, depMatrix, n) {
  const goalKey  = stateKey(goal);
  const startKey = stateKey(start);
  if (startKey === goalKey) return { path: [], visitedCount: 1 };

  const moves    = buildMoves(depMatrix, n);
  const visited  = new Map([[startKey, null]]);
  const prevMove = new Map();
  const queue    = [start];

  while (queue.length > 0) {
    const state  = queue.shift();
    const curKey = stateKey(state);
    for (let mi = 0; mi < moves.length; mi++) {
      const next = applyMove(state, moves[mi], n);
      if (!next) continue;
      const key = stateKey(next);
      if (visited.has(key)) continue;
      visited.set(key, curKey);
      prevMove.set(key, mi);
      if (key === goalKey) {
        const path = [];
        let k = key;
        while (prevMove.has(k)) { path.unshift(prevMove.get(k)); k = visited.get(k); }
        return { path, visitedCount: visited.size };
      }
      queue.push(next);
    }
  }
  return { path: null, visitedCount: visited.size };
}

// ─── COMPRESSION ──────────────────────────────────────────────────────────────

function compressMoves(pathIndices, moves) {
  const raw = pathIndices.map(i => ({ z: moves[i].z, isLeft: moves[i].dir === 1 }));
  const blocks = [];
  let i = 0;
  while (i < raw.length) {
    let count = 1;
    while (i + count < raw.length &&
           raw[i + count].z      === raw[i].z &&
           raw[i + count].isLeft === raw[i].isLeft) count++;
    blocks.push({ z: raw[i].z, isLeft: raw[i].isLeft, count });
    i += count;
  }
  return blocks;
}

// ─── COMPONENTS ───────────────────────────────────────────────────────────────

function MoveLabel({ label }) {
  const isLeft = label.includes("LEFT");
  return (
    <span style={{
      display:"inline-block", padding:"2px 7px", borderRadius:4, fontSize:11, fontWeight:700,
      background: isLeft?"#1e3a5f":"#3a1e1e",
      color:      isLeft?"#7ab8f5":"#f57a7a",
      border:`1px solid ${isLeft?"#2d5a8e":"#8e2d2d"}`,
      whiteSpace:"nowrap",
    }}>{label}</span>
  );
}

// large=true → bigger blocks for mobile readability
function MoveBlock({ z, isLeft, count, large = false }) {
  const col   = PIN_COLORS[z];
  const arrow = isLeft ? "←" : "→";
  const dirBg = isLeft ? "#0e1e38" : "#1e0e0e";
  return (
    <div style={{
      display:"flex", alignItems:"stretch", gap:0,
      borderRadius: large ? 11 : 8,
      overflow:"hidden",
      border:`1.5px solid ${col}55`,
      boxShadow:`0 2px 8px ${col}18`,
    }}>
      <div style={{
        padding:    large ? "9px 14px" : "6px 10px",
        background: `${col}1a`, color:col,
        fontWeight: 900, fontSize: large ? 15 : 13, lineHeight:1,
        display:"flex", alignItems:"center",
      }}>L{z + 1}</div>
      <div style={{
        padding:    large ? "9px 13px" : "6px 9px",
        background: dirBg,
        color:      isLeft?"#7ab8f5":"#f57a7a",
        fontWeight: 700, fontSize: large ? 20 : 15, lineHeight:1,
        borderLeft: `1px solid ${col}33`,
        display:"flex", alignItems:"center",
      }}>{arrow}</div>
      {count > 1 && (
        <div style={{
          padding:    large ? "9px 13px" : "6px 9px",
          background: "#0d1520", color:"#f5c842",
          fontWeight: 800, fontSize: large ? 15 : 12, lineHeight:1,
          borderLeft: `1px solid ${col}22`,
          display:"flex", alignItems:"center",
        }}>×{count}</div>
      )}
    </div>
  );
}

// cellW is passed in so it scales with the dynamic size
function DepCell({ value, onChange, isSelf, cellW }) {
  const symSz = Math.max(14, Math.round(cellW * 0.50));
  const dotSz = Math.max( 9, Math.round(cellW * 0.25));
  if (isSelf) return (
    <div style={{
      width:cellW, height:cellW,
      display:"flex", alignItems:"center", justifyContent:"center",
      background:"#0a0c10", borderRadius:4, color:"#1e2a36",
      fontSize: dotSz + 2, userSelect:"none",
    }}>✕</div>
  );
  const cycle   = { null:"+", "+":"-", "-":null };
  const display = {
    "+" : <span style={{fontSize:symSz,lineHeight:1}}>+</span>,
    "-" : <span style={{fontSize:symSz,lineHeight:1}}>−</span>,
    null: <span style={{fontSize:dotSz,color:"#2a3a4a"}}>·</span>,
  };
  const colors  = {
    "+" :{ bg:"#0f2a0f", border:"#2d6b2d", color:"#6eda6e" },
    "-" :{ bg:"#2a0f0f", border:"#6b2d2d", color:"#e06e6e" },
    null:{ bg:"#0d1520", border:"#1e2d45", color:"#3a4a5a" },
  };
  const c = colors[value];
  return (
    <button
      onClick={() => onChange(cycle[value] ?? null)}
      style={{
        width:cellW, height:cellW, cursor:"pointer", borderRadius:4,
        background:c.bg, border:`2px solid ${c.border}`, color:c.color,
        fontWeight:900, display:"flex", alignItems:"center", justifyContent:"center",
        fontFamily:"inherit", transition:"all 0.12s ease", userSelect:"none",
      }}
    >{display[value]}</button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

// Hide browser's native number-input spin buttons
const _pinInputStyle = typeof document !== "undefined" && (() => {
  const s = document.createElement("style");
  s.textContent = `
    input[type=number]::-webkit-inner-spin-button,
    input[type=number]::-webkit-outer-spin-button { -webkit-appearance:none; margin:0; }
    input[type=number] { -moz-appearance:textfield; }
  `;
  document.head.appendChild(s);
})();

export default function GothicLockPicker() {
  const [latchCount, setLatchCount] = useState(DEFAULT_LATCH_COUNT);
  const [startVals,  setStartVals]  = useState([...DEFAULT_START]);
  const [depMatrix,  setDepMatrix]  = useState(DEFAULT_DEP_MATRIX.map(r=>[...r]));
  const [result,     setResult]     = useState(null);
  const [error,      setError]      = useState(null);
  const [solving,    setSolving]    = useState(false);

  // ── responsive ──────────────────────────────────────────────────────────────
  const windowWidth = useWindowWidth();
  const isMobile    = windowWidth < 640;

  // Available content width inside section:
  //   outer pad: 14px × 2 = 28px
  //   section pad: 16px × 2 = 32px
  //   total deducted: 60px
  const contentWidth = Math.min(windowWidth - 60, 800);

  // Label column ("L1"…"L8") — narrow on mobile
  const labelColW = isMobile ? 28 : 36;

  // Cell width: fit all n cells + gaps + label in contentWidth, clamp 30–46 px
  //   borderSpacing between cells: 3px × (n-1)
  const dynamicCellW = isMobile
    ? Math.min(46, Math.max(30,
        Math.floor((contentWidth - labelColW - (latchCount - 1) * 3) / latchCount)
      ))
    : 46;

  // ── handlers ────────────────────────────────────────────────────────────────
  const changeLatchCount = (delta) => {
    setLatchCount(prev => Math.max(3, Math.min(8, prev + delta)));
    setResult(null); setError(null);
  };

  const setDep = useCallback((z, p, val) => {
    setDepMatrix(prev => { const next = prev.map(r=>[...r]); next[z][p] = val; return next; });
    setResult(null); setError(null);
  }, []);

  const updateStart = (i, v) => {
    const next = [...startVals]; next[i] = Number(v);
    setStartVals(next); setResult(null); setError(null);
  };

  const solve = useCallback(() => {
    setSolving(true); setError(null); setResult(null);
    setTimeout(() => {
      try {
        const n     = latchCount;
        const start = startVals.slice(0, n);
        const goal  = Array(n).fill(4);
        const moves = buildMoves(depMatrix, n);
        const { path, visitedCount } = bfs(start, goal, depMatrix, n);
        if (path === null) {
          setError(`Goal (${goal.join(",")}) is unreachable from this starting position with the current dependencies. Explored ${visitedCount} unique states.`);
        } else if (path.length === 0) {
          setError("Pins are already at position 4. Lock is open!");
        } else {
          const steps = [];
          let state = [...start];
          for (const mi of path) {
            const next = applyMove(state, moves[mi], n);
            steps.push({ moveLabel: moves[mi].label, prev: [...state], state: [...next] });
            state = next;
          }
          const blocks = compressMoves(path, moves);
          setResult({ steps, blocks, visitedCount });
        }
      } catch(e) { setError("Error: " + e.message); }
      setSolving(false);
    }, 30);
  }, [startVals, depMatrix, latchCount]);

  const sec      = { padding:"16px", background:"#0d1520", borderRadius:10, border:"1px solid #1e2d45", marginBottom:16 };
  const secTitle = { color:"#7ab8f5", fontWeight:700, fontSize:11, letterSpacing:"1.5px", marginBottom:12, textTransform:"uppercase" };
  const latches  = Array.from({ length: latchCount }, (_, i) => i);

  // ── cell font sizes for column headers — scale with cellW ──────────────────
  const colHeaderFontSz = Math.max(10, Math.floor(dynamicCellW * 0.30));

  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(160deg,#070b12 0%,#0c1420 60%,#070b12 100%)", color:"#c8d4e8", fontFamily:"'JetBrains Mono','Fira Code','Courier New',monospace", padding:"20px 14px" }}>
      <div style={{ maxWidth:860, margin:"0 auto" }}>

        {/* HEADER */}
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:6 }}>
          <div style={{ width:38, height:38, borderRadius:9, background:"linear-gradient(135deg,#c03030,#702090)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>🔐</div>
          <div>
            <div style={{ fontSize:18, fontWeight:800, color:"#e8f0ff", letterSpacing:"-0.5px" }}>GOTHIC LOCK PICKER</div>
            <div style={{ fontSize:10, color:"#4a5a7a", letterSpacing:"1px" }}>BFS · FULL STATE SPACE · PICK-SAFE</div>
          </div>
        </div>
        <div style={{ height:1, marginBottom:20, background:"linear-gradient(90deg,#e05c5c44,#9b6ae044,transparent)" }}/>

        {/* LATCH COUNT */}
        <div style={sec}>
          <div style={secTitle}>🔩 Number of latches</div>
          <div style={{ display:"flex", alignItems:"center", gap:16 }}>
            <button
              onClick={() => changeLatchCount(-1)}
              disabled={latchCount <= 3}
              style={{ width:38, height:38, borderRadius:8, border:`1.5px solid ${latchCount <= 3 ? "#1a2a3a" : "#2d4a6a"}`, background: latchCount <= 3 ? "#0a0e16" : "#0d1a2e", color: latchCount <= 3 ? "#2a3a4a" : "#7ab8f5", fontWeight:800, fontSize:22, lineHeight:1, cursor: latchCount <= 3 ? "not-allowed" : "pointer", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"inherit", transition:"all 0.15s" }}
            >−</button>
            <div style={{ textAlign:"center", minWidth:64 }}>
              <div style={{ fontSize:36, fontWeight:800, color:"#e8f0ff", lineHeight:1 }}>{latchCount}</div>
              <div style={{ fontSize:9, color:"#3a5a7a", letterSpacing:"1px", marginTop:3 }}>LATCHES (3–8)</div>
            </div>
            <button
              onClick={() => changeLatchCount(+1)}
              disabled={latchCount >= 8}
              style={{ width:38, height:38, borderRadius:8, border:`1.5px solid ${latchCount >= 8 ? "#1a2a3a" : "#2d4a6a"}`, background: latchCount >= 8 ? "#0a0e16" : "#0d1a2e", color: latchCount >= 8 ? "#2a3a4a" : "#7ab8f5", fontWeight:800, fontSize:22, lineHeight:1, cursor: latchCount >= 8 ? "not-allowed" : "pointer", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"inherit", transition:"all 0.15s" }}
            >+</button>
            <div style={{ flex:1, padding:"8px 12px", background:"#080c14", borderRadius:6, border:"1px solid #141e2e", fontSize:10, color:"#4a6a8a", lineHeight:1.6 }}>
              Changing latch count resets the solution. Dependencies set for inactive latches are preserved.
            </div>
          </div>
        </div>

        {/* STARTING POSITIONS */}
        <div style={sec}>
          <div style={secTitle}>📍 Starting pin positions</div>
          <div style={{
            display:"grid",
            gridTemplateColumns: `repeat(auto-fill, minmax(90px, 1fr))`,
            gap: 10,
          }}>
            {latches.map(i => {
              const val = startVals[i];
              const isGoal = val === 4;
              const col = PIN_COLORS[i];
              return (
                <div key={i} style={{ textAlign:"center" }}>
                  {/* Pin label */}
                  <div style={{ color:col, fontWeight:700, fontSize:11, marginBottom:4 }}>P{i+1}</div>

                  {/* Stepper + number input row */}
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:4, marginBottom:6 }}>
                    <button
                      onClick={() => updateStart(i, Math.max(1, val - 1))}
                      disabled={val <= 1}
                      style={{
                        width: isMobile ? 28 : 22, height: isMobile ? 28 : 22,
                        borderRadius:5, border:`1.5px solid ${val<=1?"#1a2a3a":"#2d4a6a"}`,
                        background: val<=1?"#0a0e16":"#0d1a2e",
                        color: val<=1?"#2a3a4a":"#7ab8f5",
                        fontWeight:800, fontSize: isMobile ? 16 : 13, lineHeight:1,
                        cursor: val<=1?"not-allowed":"pointer",
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontFamily:"inherit", flexShrink:0,
                        touchAction:"manipulation",
                      }}
                    >−</button>

                    <input
                      type="number"
                      min={1} max={7}
                      value={val}
                      onChange={e => {
                        const n = parseInt(e.target.value, 10);
                        if (!isNaN(n) && n >= 1 && n <= 7) updateStart(i, n);
                      }}
                      style={{
                        width: isMobile ? 44 : 34,
                        height: isMobile ? 36 : 30,
                        textAlign:"center",
                        fontSize: isMobile ? 20 : 16,
                        fontWeight:800,
                        fontFamily:"inherit",
                        background:"#080c14",
                        border:`2px solid ${isGoal?"#2a6a2a":col+"55"}`,
                        borderRadius:6,
                        color: isGoal?"#5cba6a":col,
                        outline:"none",
                        MozAppearance:"textfield",
                        WebkitAppearance:"none",
                        padding:0,
                      }}
                    />

                    <button
                      onClick={() => updateStart(i, Math.min(7, val + 1))}
                      disabled={val >= 7}
                      style={{
                        width: isMobile ? 28 : 22, height: isMobile ? 28 : 22,
                        borderRadius:5, border:`1.5px solid ${val>=7?"#1a2a3a":"#2d4a6a"}`,
                        background: val>=7?"#0a0e16":"#0d1a2e",
                        color: val>=7?"#2a3a4a":"#7ab8f5",
                        fontWeight:800, fontSize: isMobile ? 16 : 13, lineHeight:1,
                        cursor: val>=7?"not-allowed":"pointer",
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontFamily:"inherit", flexShrink:0,
                        touchAction:"manipulation",
                      }}
                    >+</button>
                  </div>

                  {/* Slider */}
                  <input
                    type="range" min={1} max={7} value={val}
                    onChange={e => updateStart(i, e.target.value)}
                    style={{ width:"100%", accentColor:col, cursor:"pointer" }}
                  />
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:9, color:"#3a4a5a", marginTop:2 }}>
                    <span>1</span>
                    <span style={{ color:isGoal?"#5cba6a":"#4a5a6a" }}>4✓</span>
                    <span>7</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* DEPENDENCY MATRIX */}
        <div style={sec}>
          <div style={secTitle}>⚙️ Dependency matrix</div>

          {/* Legend */}
          <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:8, fontSize:11 }}>
            {[
              {v:"+", bg:"#0f2a0f", bo:"#2d6b2d", co:"#6eda6e", desc:"Same"},
              {v:"-", bg:"#2a0f0f", bo:"#6b2d2d", co:"#e06e6e", desc:"Opposite"},
              {v:null,bg:"#0d1520", bo:"#1e2d45", co:"#3a4a5a", desc:"No link"},
            ].map(l=>(
              <div key={String(l.v)} style={{ display:"flex", alignItems:"center", gap:5 }}>
                <div style={{ width:22, height:22, borderRadius:3, border:`2px solid ${l.bo}`, background:l.bg, color:l.co, fontWeight:900, fontSize:15, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  {l.v==="+"?"+":(l.v==="-"?"−":"·")}
                </div>
                <span style={{ color:"#5a7a9a" }}>{l.desc}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize:9, color:"#2a3a4a", marginBottom:12, letterSpacing:"0.3px" }}>
            {isMobile ? "tap cell to cycle  ·  ✕ = self" : "click cell to cycle  ·  ✕ = self"}
          </div>

          {/* Matrix — overflowX kept as safety net for very narrow screens */}
          <div style={{ overflowX:"auto" }}>
            <table style={{ borderCollapse:"separate", borderSpacing:3 }}>
              <thead>
                <tr>
                  {/* Top-left corner: compact on mobile */}
                  <th style={{
                    width:       labelColW,
                    textAlign:   "left",
                    verticalAlign:"bottom",
                    padding:     isMobile ? "0 4px 6px 0" : "4px 10px 8px 4px",
                    color:       "#2a3a4a",
                    fontSize:    isMobile ? 8 : 10,
                    whiteSpace:  isMobile ? "normal" : "nowrap",
                    lineHeight:  1.3,
                    fontWeight:  400,
                  }}>
                    {isMobile
                      ? <span><span style={{display:"block"}}>L↓</span><span style={{display:"block"}}>X→</span></span>
                      : "affected L ↓ · move X →"}
                  </th>
                  {latches.map(p=>(
                    <th key={p} style={{
                      width:      dynamicCellW,
                      textAlign:  "center",
                      padding:    "4px 0 8px",
                      color:      PIN_COLORS[p],
                      fontWeight: 800,
                      fontSize:   colHeaderFontSz,
                    }}>X{p+1}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {latches.map(z=>(
                  <tr key={z}>
                    <td style={{
                      padding:    isMobile ? "0 5px 0 0" : "0 12px 0 4px",
                      color:      PIN_COLORS[z],
                      fontWeight: 700,
                      fontSize:   12,
                      whiteSpace: "nowrap",
                    }}>L{z+1}</td>
                    {latches.map(p=>(
                      <td key={p} style={{ padding:0 }}>
                        <DepCell
                          value={depMatrix[p][z]}
                          isSelf={z===p}
                          onChange={val=>setDep(p,z,val)}
                          cellW={dynamicCellW}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Dependencies text */}
          <div style={{ marginTop:12, padding:"10px 12px", background:"#080c14", borderRadius:6, border:"1px solid #141e2e" }}>
            <div style={{ color:"#3a4a5a", fontSize:10, marginBottom:6, letterSpacing:"0.5px" }}>DEPENDENCIES (text):</div>
            {latches.map(z=>{
              const deps=[];
              for(let p=0;p<latchCount;p++){
                if(p===z)continue;
                const v=depMatrix[z][p];
                if(v)deps.push(`L${p+1} ${v==="+"?"same":"opposite"}`);
              }
              return(
                <div key={z} style={{ fontSize:11, padding:"2px 0", color:deps.length?"#8898b0":"#2a3a4a", borderBottom:"1px solid #0f1520" }}>
                  <span style={{color:PIN_COLORS[z],fontWeight:700}}>L{z+1}</span>{" → "}
                  {deps.length?deps.join(", "):<span style={{color:"#2a3a4a"}}>moves alone</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* BUTTON */}
        <button onClick={solve} disabled={solving} style={{ width:"100%", padding:"14px", borderRadius:10, border:"none", background:solving?"#111820":"linear-gradient(135deg,#b02828,#601880)", color:solving?"#3a4a5a":"#fff", fontFamily:"inherit", fontWeight:800, fontSize:14, cursor:solving?"not-allowed":"pointer", letterSpacing:"2px", marginBottom:20, transition:"all 0.2s", boxShadow:solving?"none":"0 4px 20px #b0288840" }}>
          {solving?"⏳  SEARCHING...":"🔍  SOLVE  ( BFS )"}
        </button>

        {/* ERROR */}
        {error&&(
          <div style={{ padding:"12px 16px", borderRadius:8, marginBottom:16, background:"#1a0808", border:"1px solid #5a1a1a", color:"#e07070", fontSize:12, lineHeight:1.6 }}>⚠️ {error}</div>
        )}

        {/* RESULT */}
        {result&&(()=>{
          const { steps, blocks, visitedCount } = result;
          return(
            <div>
              {/* Summary */}
              <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:18, padding:"14px 18px", background:"#0a1a0a", border:"1px solid #1a4a1a", borderRadius:10 }}>
                <div style={{ fontSize:32, fontWeight:800, color:"#5cba6a" }}>{steps.length}</div>
                <div>
                  <div style={{ color:"#5cba6a", fontWeight:700 }}>moves — BFS optimal</div>
                  <div style={{ color:"#3a7a3a", fontSize:10 }}>explored {visitedCount} unique states · no move breaks the pick</div>
                </div>
              </div>

              {/* COMPRESSED SOLUTION — large blocks on mobile */}
              <div style={{ marginBottom:18 }}>
                <div style={{ color:"#3a4a5a", fontSize:10, letterSpacing:"1px", marginBottom:10 }}>SOLUTION (compressed):</div>
                <div style={{ display:"flex", gap: isMobile ? 8 : 6, flexWrap:"wrap", alignItems:"center" }}>
                  {blocks.map((b, bi) => (
                    <MoveBlock key={bi} z={b.z} isLeft={b.isLeft} count={b.count} large={isMobile} />
                  ))}
                  <div style={{
                    padding:    isMobile ? "9px 18px" : "6px 12px",
                    borderRadius:8, fontWeight:800,
                    fontSize:   isMobile ? 20 : 14,
                    background: "#0a1a0a", border:"1.5px solid #1a4a1a", color:"#5cba6a",
                  }}>✅</div>
                </div>
              </div>

              {/* Step table — reduced padding on mobile */}
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize: isMobile ? 11 : 12 }}>
                  <thead>
                    <tr>
                      {["#","Move",...latches.map(i=>`L${i+1}`)].map((h,i)=>(
                        <th key={h} style={{
                          padding:      isMobile ? "6px 5px" : "8px 8px",
                          background:   "#0d1520",
                          color:        i>=2?PIN_COLORS[i-2]:"#5a6a8a",
                          fontWeight:   i>=2?800:600,
                          textAlign:    i>=2?"center":"left",
                          borderBottom: "2px solid #1e2d45",
                          whiteSpace:   "nowrap",
                          fontSize:     i>=2 ? Math.max(10, dynamicCellW * 0.28) : 11,
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ background:"#080c14" }}>
                      <td style={{ padding: isMobile?"5px 5px":"7px 8px", color:"#3a4a5a", borderBottom:"1px solid #141e2e" }}>0</td>
                      <td style={{ padding: isMobile?"5px 5px":"7px 8px", color:"#3a4a5a", fontStyle:"italic", borderBottom:"1px solid #141e2e" }}>START</td>
                      {startVals.slice(0, latchCount).map((v,i)=>(
                        <td key={i} style={{ padding: isMobile?"5px 5px":"7px 8px", textAlign:"center", color:v===4?"#5cba6a":PIN_COLORS[i], fontWeight:v===4?800:500, borderBottom:"1px solid #141e2e" }}>{v}</td>
                      ))}
                    </tr>
                    {steps.map((step,si)=>(
                      <tr key={si} style={{ background:si%2===0?"#080c14":"#090e18" }}>
                        <td style={{ padding: isMobile?"5px 5px":"7px 8px", color:"#4a5a7a", borderBottom:"1px solid #141e2e", fontWeight:600 }}>{si+1}</td>
                        <td style={{ padding: isMobile?"5px 5px":"7px 8px", borderBottom:"1px solid #141e2e" }}><MoveLabel label={step.moveLabel}/></td>
                        {step.state.map((v,i)=>{
                          const prev=step.prev[i];
                          const moved=v!==prev;
                          return(
                            <td key={i} style={{ padding: isMobile?"5px 5px":"7px 8px", textAlign:"center", fontWeight:v===4||moved?800:400, color:v===4?"#5cba6a":moved?"#f5c842":"#3a4a5a", background:moved?"rgba(245,200,66,0.06)":"transparent", borderBottom:"1px solid #141e2e" }}>
                              {v}
                              {moved&&<span style={{ fontSize:8, marginLeft:1, color:v>prev?"#7ab8f5":"#f57a7a", verticalAlign:"super" }}>{v>prev?"▲":"▼"}</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    <tr style={{ background:"#0a1a0a", borderTop:"2px solid #1a4a1a" }}>
                      <td colSpan={2} style={{ padding: isMobile?"7px 5px":"9px 8px", color:"#5cba6a", fontWeight:800 }}>✅ LOCK OPEN</td>
                      {steps[steps.length-1].state.map((v,i)=>(
                        <td key={i} style={{ padding: isMobile?"7px 5px":"9px 8px", textAlign:"center", color:"#5cba6a", fontWeight:800, fontSize:14 }}>{v}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {/* KO-FI TIP PANEL */}
        <div style={{ marginTop:32 }}>
          <div style={{ height:1, marginBottom:24, background:"linear-gradient(90deg,transparent,#9b6ae044,#e05c5c44,transparent)" }}/>
          <div style={{ textAlign:"center", marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#4a5a7a", letterSpacing:"2px" }}>☕ IF THIS SAVED YOU SOME PICKS</div>
          </div>
          <div style={{ display:"flex", justifyContent:"center" }}>
            <div style={{ width:"100%", maxWidth:400, borderRadius:14, overflow:"hidden", border:"1px solid #1e2d45", boxShadow:"0 4px 32px #9b6ae022" }}>
              <iframe
                id="kofiframe"
                src="https://ko-fi.com/proxupl/?hidefeed=true&widget=true&embed=true&preview=true"
                style={{ border:"none", width:"100%", padding:0, display:"block" }}
                height="712"
                title="proxupl"
              />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
