'use client';

import { useMemo, useState } from 'react';

/* ============================================================================
   Mazda 3 Diagnostic Assistant  —  rcrsal.com/mazda
   Self-contained, data-driven diagnostic wizard built from REAL XTOOL D7 data.
   No placeholder data: every value in KNOWN/EVIDENCE came off the actual scanner.
   ========================================================================== */

const C = {
  bg: '#0b0f14', panel: '#11161d', panel2: '#161c25', line: '#232b36',
  txt: '#e7ecf3', mut: '#8b97a7',
  green: '#39FF14', blue: '#0066CC', amber: '#ffb454', red: '#ff5d5d', grey: '#404040',
};

/* ---------- REAL vehicle + findings (verified from scanner data) ---------- */
const VEHICLE = {
  name: '2017 Mazda 3 / Axela',
  detail: '2017 Mazda 3 / Axela · 2.0L Skyactiv-G (PE engine) · 6-spd Skyactiv-Drive auto',
  vinStart: '3MZBN1U71HM108446',
  pcmSw: 'PSAP-188K2-A',
  mileage: '≈157,865 (TCM counter — verify on dash)',
  software: 'XTOOL D7 · MAZDA V14.20',
};

// Post-repair status (06-20): loose negative ground found + tightened → misfire resolved.
const STATUS = {
  headline: 'ROOT CAUSE FOUND & FIXED — loose negative (ground) battery terminal',
  detail:
    'After tightening the ground + reset + a drive, a full Automatic Scan shows the engine, transmission, ' +
    'brakes (ABS), airbags, power steering and parking brake all PASS / No DTC. The all-cylinder misfire ' +
    '(which had normal fuel trims — the tell-tale of an electrical/ground cause) and the limp-mode are gone, ' +
    'and the check-engine light has not returned.',
  remaining:
    'Only 4 communication codes remain (all stored, from the electrical event): U0156 (Instrument Cluster ↔ ' +
    'Information Center) and U0513 ×3 (Blind-Spot modules — "invalid data from yaw-rate sensor"). ' +
    'These don’t strand the car, but Blind-Spot Monitoring may be off until cleared. Next: clean the ground ' +
    'properly, Clear All DTCs, drive, and re-scan to confirm nothing returns.',
};

const KNOWN: { label: string; value: string; tone: keyof typeof TONE; note: string }[] = [
  { label: 'Engine / PCM (after ground fix)', value: 'PASS — No DTC', tone: 'good',
    note: '06-20 full Automatic Scan: PCM clean. The all-cylinder misfire codes are GONE after tightening the loose negative ground.' },
  { label: 'Misfire history (before fix)', value: 'All 4 cyl, trip total 5 → 24', tone: 'info',
    note: 'Pre-fix (06-16/17). Even spread + normal fuel trims pointed to an electrical/ground cause — confirmed by the fix.' },
  { label: 'Safety systems (after fix)', value: 'ABS · Airbags · EPS · EPB · Trans — all PASS', tone: 'good',
    note: '06-20 scan: brakes, restraints, power steering, parking brake, transmission all No DTC.' },
  { label: 'Remaining: blind-spot comms', value: 'U0513 ×3 (BSM/BSML/BSML)', tone: 'warn',
    note: '"Invalid data from yaw-rate sensor" — stored, from the electrical event. Blind-spot may be off until cleared; check mirrors manually.' },
  { label: 'Remaining: cluster comms', value: 'U0156 (current + stored)', tone: 'warn',
    note: 'Instrument cluster ↔ information center. Convenience/display network; not a powertrain/safety fault.' },
  { label: 'Root cause', value: 'Loose negative ground — FIXED', tone: 'good',
    note: 'Explains the all-cyl misfire + normal trims + limp mode + lost-comm codes all at once.' },
  { label: 'Check-engine light', value: 'Has not returned', tone: 'good',
    note: 'Post-repair, after a drive. Strong sign the drivability fault is resolved.' },
];

const TIMELINE = [
  { date: '2026-05-09', event: 'Rough idle', action: 'Replaced all coil packs (OEM)', verdict: 'Early sign of the same misfire — treated a symptom.' },
  { date: '2026-06-10', event: 'A "noise"', action: 'Replaced top motor mount', verdict: 'Fixes noise/vibration, not combustion. IC also showed U0156 that day.' },
  { date: '2026-06-16/17', event: 'Lost power → limp mode', action: 'Live-data + full module scan', verdict: 'Misfire crossed the fail-safe threshold.' },
];

const TONE = {
  good: { c: C.green, bg: 'rgba(57,255,20,.10)', label: 'OK' },
  warn: { c: C.amber, bg: 'rgba(255,180,84,.12)', label: 'WATCH' },
  bad: { c: C.red, bg: 'rgba(255,93,93,.12)', label: 'ISSUE' },
  info: { c: C.blue, bg: 'rgba(0,102,204,.15)', label: 'INFO' },
} as const;

/* ---------- Built-in DTC knowledge base (Mazda Skyactiv-G relevant) ---------- */
const DTC_DB: Record<string, { t: string; sys: string; note: string }> = {
  P0300: { t: 'Random / Multiple Cylinder Misfire', sys: 'Ignition/Fuel/Mechanical', note: 'Matches this car. Shared cause across cylinders: plugs, cam timing/VVT, carbon, or compression.' },
  P0301: { t: 'Cylinder 1 Misfire', sys: 'Ignition/Fuel/Mech', note: 'Cylinder-specific. Swap coil+plug to that cylinder and see if the miss follows.' },
  P0302: { t: 'Cylinder 2 Misfire', sys: 'Ignition/Fuel/Mech', note: 'Cyl 2 had the highest live misfire count on this car.' },
  P0303: { t: 'Cylinder 3 Misfire', sys: 'Ignition/Fuel/Mech', note: 'Swap-test coil/plug/injector.' },
  P0304: { t: 'Cylinder 4 Misfire', sys: 'Ignition/Fuel/Mech', note: 'Swap-test coil/plug/injector.' },
  P0010: { t: 'Intake "A" Camshaft Position Actuator Circuit (Bank 1)', sys: 'VVT', note: 'Skyactiv VVT is oil-driven. Check oil level/quality + oil control valve.' },
  P0011: { t: 'Intake Camshaft Timing Over-Advanced (Bank 1)', sys: 'VVT/Timing', note: 'Timing-chain stretch or VVT actuator. Can cause power loss + multi-cyl misfire.' },
  P0012: { t: 'Intake Camshaft Timing Over-Retarded (Bank 1)', sys: 'VVT/Timing', note: 'OCV, chain stretch, or low oil pressure.' },
  P0013: { t: 'Exhaust "B" Camshaft Actuator Circuit (Bank 1)', sys: 'VVT', note: 'Exhaust VVT actuator / OCV.' },
  P0014: { t: 'Exhaust Camshaft Timing Over-Advanced (Bank 1)', sys: 'VVT/Timing', note: 'Strong cam-timing signal — escalates the timing path.' },
  P000A: { t: '"A" Camshaft Profile Slow Response (Bank 1)', sys: 'VVT/Timing', note: 'VVT not responding — oil, OCV, or chain.' },
  P0016: { t: 'Crank/Cam Position Correlation (Bank 1 Sensor A)', sys: 'Timing', note: 'Classic timing-chain-stretch code. Prioritize cam-vs-crank check.' },
  P0087: { t: 'Fuel Rail/System Pressure Too Low', sys: 'Fuel (HPFP)', note: 'High-pressure pump or supply. Watch actual vs desired rail pressure under load.' },
  P0089: { t: 'Fuel Pressure Regulator Performance', sys: 'Fuel', note: 'Rail pressure not tracking command.' },
  P0171: { t: 'System Too Lean (Bank 1)', sys: 'Air/Fuel', note: 'This car’s trims are normal, so a big lean code would be new info — check vacuum/intake.' },
  P0420: { t: 'Catalyst Efficiency Below Threshold', sys: 'Emissions', note: 'Often a CONSEQUENCE of prolonged misfire damaging the cat. Fix misfire first.' },
  P2096: { t: 'Post-Cat Fuel Trim Too Lean (Bank 1)', sys: 'Exhaust/Fuel', note: 'Can follow misfire/exhaust issues.' },
  U0156: { t: 'Lost Communication With Information Center "A"', sys: 'Network (CAN)', note: 'Found on this car (Instrument Cluster), current + stored. Network/wiring/ground dropout — classic loose-ground symptom; not the misfire cause.' },
  U0513: { t: 'Invalid/Lost Data — Yaw Rate Sensor (to Blind-Spot modules)', sys: 'Network / ADAS', note: 'Found on this car ×3 (BSM/BSML/BSMR): "Received Not Valid Data From Yaw Rate Sensor Module." ABS/DSC itself passed → almost certainly stored from the electrical event. Blind-Spot may be disabled until cleared.' },
};

/* ---------- Analysis helpers (the "logic") ---------- */
function analyzeCompression(vals: number[]) {
  const v = vals.filter((n) => !isNaN(n) && n > 0);
  if (v.length < 4) return null;
  const max = Math.max(...v), min = Math.min(...v);
  const spread = max > 0 ? Math.round(((max - min) / max) * 100) : 0;
  const lowAbs = min < 140;
  const bigSpread = spread > 12;
  let tone: keyof typeof TONE = 'good';
  let verdict = 'Compression is even and healthy → the misfire is NOT mechanical. Focus on ignition / fuel / cam-timing (the cheap-to-moderate path).';
  if (lowAbs && !bigSpread) { tone = 'warn'; verdict = `All cylinders low (min ${min} psi) with even spread (${spread}%) → suspect uniform wear OR retarded cam timing. Verify cam-vs-crank timing before teardown.`; }
  else if (bigSpread) { tone = 'bad'; verdict = `Uneven compression (${spread}% spread, low = ${min} psi). The low cylinder(s) are mechanical — run a LEAK-DOWN to locate (rings vs valves vs head gasket).`; }
  else if (min >= 140 && min < 160) { tone = 'warn'; verdict = `Borderline (min ${min} psi). Acceptable but aging; ignition/fuel/timing still the priority.`; }
  return { tone, verdict, min, max, spread };
}

function analyzeFuelPressure(actual: number, desired: number) {
  if (isNaN(actual) || isNaN(desired) || desired <= 0) return null;
  const pct = Math.round((actual / desired) * 100);
  if (pct < 80) return { tone: 'bad' as const, verdict: `Rail pressure only ${pct}% of commanded (${actual}/${desired} psi) under load → high-pressure fuel pump or supply problem. Strong fuel-side lead.` };
  if (pct < 92) return { tone: 'warn' as const, verdict: `Rail pressure a bit low (${pct}% of command) — watch under hard load; possible HPFP weakness.` };
  return { tone: 'good' as const, verdict: `Rail pressure holds command (${pct}%). Fuel delivery looks adequate — de-prioritize the fuel path.` };
}

function interpretCodes(raw: string) {
  const codes = (raw.toUpperCase().match(/[PCBU][0-9][0-9A-F]{3}/g) || []);
  const uniq = Array.from(new Set(codes));
  const known = uniq.map((c) => ({ code: c, ...(DTC_DB[c] || { t: 'Code not in built-in list — use Code Lookup tab', sys: '?', note: '' }) }));
  const flags = {
    misfire: uniq.some((c) => /^P030[0-9]$/.test(c)),
    timing: uniq.some((c) => /^P00(0A|0B|1[0-9]|16|17|18|19)$/.test(c) || ['P000A', 'P0016'].includes(c)),
    fuel: uniq.some((c) => ['P0087', 'P0089', 'P008A', 'P008B'].includes(c)),
    lean: uniq.some((c) => ['P0171', 'P0174'].includes(c)),
    cat: uniq.some((c) => ['P0420', 'P0430', 'P2096'].includes(c)),
  };
  return { uniq, known, flags };
}

/* ---------- Probable causes (ranked) ---------- */
const CAUSES = [
  { n: 1, cause: 'Worn / fouled spark plugs', why: 'All-cyl misfire + perfect fuel trims + high miles. Coils already new OEM.', diyParts: '$40–80', shop: '$120–220', time: '0.5–1.5 h', tone: 'good' as const },
  { n: 2, cause: 'Intake-valve carbon (direct injection)', why: 'Common on high-mileage Skyactiv-G DI; multi-cyl misfire + power loss.', diyParts: '$0 / $300–600', shop: '$300–650', time: '2–4 h', tone: 'warn' as const },
  { n: 3, cause: 'Cam timing / VVT / chain stretch', why: 'High miles; misfire + power loss + fail-safe is a classic timing signature.', diyParts: '$150–600', shop: '$900–1,800', time: '4–10 h', tone: 'bad' as const },
  { n: 4, cause: 'HPFP / injectors', why: 'DI rail. Trims argue against gross starvation, but confirm under load.', diyParts: '$150–600', shop: '$500–1,200', time: '2–5 h', tone: 'warn' as const },
  { n: 5, cause: 'Uniform low compression', why: 'All-cyl mechanical wear at high mileage.', diyParts: '$0 (test)', shop: '$150–300 test', time: '1–2 h', tone: 'warn' as const },
  { n: 6, cause: 'New-coil install / connector / wiring', why: 'Misfire returned after coil R&R — check a DOA coil / connector.', diyParts: '$0–300', shop: '$150–400', time: '1–2 h', tone: 'good' as const },
];

/* ---------- Step model ---------- */
type Field =
  | { id: string; label: string; kind: 'text' | 'number'; placeholder?: string; suffix?: string }
  | { id: string; label: string; kind: 'choice'; options: string[] };

type StepDef = {
  id: string; title: string; goal: string; tips: string[]; fields: Field[];
  evaluate: (d: Record<string, string>) => { tone: keyof typeof TONE; lines: string[] } | null;
};

const STEPS: StepDef[] = [
  {
    id: 'codes',
    title: 'Step 1 — Read & enter the trouble codes',
    goal: 'These were never digitally captured, so read them on the D7 (PCM ▸ Read DTC, or open your saved DTC Report) and type them here. The whole plan branches off this.',
    tips: [
      'On the D7: System Selection ▸ Powertrain Control Module (PCM) ▸ Read DTC. Photograph the list + Freeze Frame.',
      'Type codes separated by spaces/commas, e.g. "P0300 P0302 P0014".',
      'Expected from the live data: P0300 (random/multi-cyl) ± P0301–P0304. Watch for P0010–P0016 (cam timing).',
    ],
    fields: [{ id: 'codes', label: 'DTCs read from the scanner', kind: 'text', placeholder: 'P0300 P0302 …' }],
    evaluate: (d) => {
      const raw = d.codes || '';
      if (!raw.trim()) return null;
      const { known, flags } = interpretCodes(raw);
      if (!known.length) return { tone: 'warn', lines: ['No valid code format detected. Use letters+4 chars, e.g. P0300.'] };
      const lines = known.map((k) => `${k.code} — ${k.t}  (${k.sys}). ${k.note}`);
      if (flags.timing) lines.push('➤ Cam-timing code present → prioritize Step 6 (cam/VVT) and do a careful compression test.');
      else if (flags.fuel) lines.push('➤ Fuel-pressure code present → prioritize Step 5 (rail pressure under load).');
      else if (flags.misfire) lines.push('➤ Misfire codes only → follow the cheap path first: plugs (Step 3) → compression (Step 4).');
      if (flags.cat) lines.push('⚠ Catalyst code is usually a CONSEQUENCE of the misfire — fix the misfire, then re-evaluate the cat.');
      return { tone: flags.timing ? 'bad' : 'info', lines };
    },
  },
  {
    id: 'basics',
    title: 'Step 2 — Basics & visual (free, 10–20 min)',
    goal: 'Rule out the cheap stuff and protect the VVT system before deeper tests.',
    tips: [
      'Skyactiv VVT is oil-pressure driven — low or degraded oil alone can cause timing codes & rough running.',
      'Check spark-plug wells for water/oil; confirm every coil connector is latched (you just had coils out).',
      'Battery/charging ~12.5 V off, 13.5–14.5 V running (this car read ~14.0 V — good).',
    ],
    fields: [
      { id: 'oil', label: 'Engine oil level', kind: 'choice', options: ['Full / normal', 'A bit low', 'Very low / off the stick'] },
      { id: 'oilcond', label: 'Oil condition', kind: 'choice', options: ['Clean-ish', 'Dirty/old', 'Milky or fuel-smell'] },
      { id: 'visual', label: 'Any obvious issue?', kind: 'choice', options: ['None found', 'Water/oil in plug wells', 'Loose/damaged coil connector', 'Chewed wiring'] },
    ],
    evaluate: (d) => {
      const lines: string[] = []; let tone: keyof typeof TONE = 'good';
      if (d.oil === 'Very low / off the stick') { tone = 'bad'; lines.push('Very low oil can directly cause VVT/timing faults and bearing wear — correct level FIRST, then re-scan before anything else.'); }
      else if (d.oil === 'A bit low') { tone = 'warn'; lines.push('Top up oil to full; low oil affects VVT actuators on Skyactiv.'); }
      if (d.oilcond === 'Milky or fuel-smell') { tone = 'bad'; lines.push('Milky = coolant intrusion (head gasket); fuel smell = washdown from misfire/leaking injector. Investigate.'); }
      if (d.visual === 'Water/oil in plug wells') { tone = 'bad'; lines.push('Fluid in plug wells shorts coils/plugs → misfire. Clean & seal (valve-cover/well seals), then retest.'); }
      if (d.visual === 'Loose/damaged coil connector') { tone = 'warn'; lines.push('A single loose connector can mimic a multi-cyl problem if on a shared circuit. Re-seat all, retest.'); }
      if (d.visual === 'Chewed wiring') { tone = 'bad'; lines.push('Repair the harness damage before further diagnosis — could explain misfire AND the U0156 network code.'); }
      if (!lines.length) lines.push('Basics look good — proceed to spark plugs.');
      return { tone, lines };
    },
  },
  {
    id: 'plugs',
    title: 'Step 3 — Spark plugs (cheapest high-yield fix)',
    goal: 'On this car, with coils already new OEM and trims perfect, worn plugs are the #1 suspect.',
    tips: [
      'Pull all 4. Compare wear/gap/color across cylinders. OEM-spec iridium only (verify exact part by VIN).',
      'Light tan = normal. Black sooty = rich/ignition. Wet fuel = not firing. Oily = valve seals/rings (mechanical).',
      'While plugs are out, borescope each cylinder + intake valves for carbon (DI engines coke up).',
    ],
    fields: [
      { id: 'replaced', label: 'Were plugs replaced when you did the coils in May?', kind: 'choice', options: ['No / not sure', 'Yes'] },
      { id: 'cond', label: 'Plug condition', kind: 'choice', options: ['Worn (wide gap / eroded)', 'Fuel-fouled (wet/black)', 'Oil-fouled (wet oily)', 'Look good', 'Carbon caked'] },
    ],
    evaluate: (d) => {
      const lines: string[] = []; let tone: keyof typeof TONE = 'good';
      if (d.replaced === 'No / not sure') lines.push('Plugs likely original-ish — at high mileage this alone commonly causes all-cylinder misfire.');
      if (d.cond === 'Worn (wide gap / eroded)') { tone = 'good'; lines.push('✅ Replace all 4 with OEM iridium, clear codes, road-test. Expect misfire counters to return to 0. This is the most probable fix.'); }
      else if (d.cond === 'Fuel-fouled (wet/black)') { tone = 'warn'; lines.push('Fuel fouling = cylinders not firing (ignition) OR over-fueling. Replace plugs; if it returns, check injectors/coils per cylinder.'); }
      else if (d.cond === 'Oil-fouled (wet oily)') { tone = 'bad'; lines.push('Oil on plugs = valve stem seals or rings (mechanical). Go to Step 4 compression/leak-down.'); }
      else if (d.cond === 'Carbon caked') { tone = 'warn'; lines.push('Heavy carbon → intake-valve carbon likely (DI). Plan a walnut-blast clean; replace plugs meanwhile.'); }
      else if (d.cond === 'Look good') { tone = 'warn'; lines.push('Plugs OK → the cause is deeper. Proceed to compression test (Step 4) and running data (Step 5).'); }
      return d.cond ? { tone, lines } : null;
    },
  },
  {
    id: 'compression',
    title: 'Step 4 — Compression test (the decision-maker)',
    goal: 'Splits the cheap path (ignition/fuel/timing) from the expensive path (mechanical). Enter all four readings.',
    tips: [
      'Engine warm, all plugs out, throttle held open, battery good. Crank ~5–6 compression strokes each.',
      'Skyactiv-G is high compression (~13–14:1) — expect high cranking psi. Even readings matter more than absolute.',
      '>~12% spread between highest and lowest = a mechanical problem on the low cylinder(s).',
    ],
    fields: [
      { id: 'c1', label: 'Cylinder 1', kind: 'number', suffix: 'psi' },
      { id: 'c2', label: 'Cylinder 2', kind: 'number', suffix: 'psi' },
      { id: 'c3', label: 'Cylinder 3', kind: 'number', suffix: 'psi' },
      { id: 'c4', label: 'Cylinder 4', kind: 'number', suffix: 'psi' },
    ],
    evaluate: (d) => {
      const r = analyzeCompression([+d.c1, +d.c2, +d.c3, +d.c4]);
      if (!r) return null;
      return { tone: r.tone, lines: [`Readings: max ${r.max} / min ${r.min} psi · spread ${r.spread}%.`, r.verdict] };
    },
  },
  {
    id: 'running',
    title: 'Step 5 — Running data under load',
    goal: 'Re-capture with the engine running / on a test drive (your scans were key-on engine-off). Confirms fuel & knock behavior.',
    tips: [
      'Log: per-cylinder misfire, RPM, load, STFT/LTFT, knock retard, ACTUAL vs DESIRED fuel-rail pressure, MAF, MAP.',
      'Re-run PCM ▸ Actuation ▸ Oil Pressure Solenoid + Injectors with the engine RUNNING (it gave "negative response" only because it was off).',
      'Enter the fuel-rail pressures you observe under load below.',
    ],
    fields: [
      { id: 'fpa', label: 'Fuel rail pressure — ACTUAL (under load)', kind: 'number', suffix: 'psi' },
      { id: 'fpd', label: 'Fuel rail pressure — DESIRED (under load)', kind: 'number', suffix: 'psi' },
      { id: 'knock', label: 'Knock retard behavior', kind: 'choice', options: ['Stays small (<5°)', 'Climbs high (>8°)'] },
    ],
    evaluate: (d) => {
      const lines: string[] = []; let tone: keyof typeof TONE = 'good';
      const fp = analyzeFuelPressure(+d.fpa, +d.fpd);
      if (fp) { tone = fp.tone; lines.push(fp.verdict); }
      if (d.knock === 'Climbs high (>8°)') { tone = tone === 'good' ? 'warn' : tone; lines.push('High knock retard → carbon, cam timing, or fuel quality/octane. Pairs with the timing path (Step 6).'); }
      else if (d.knock === 'Stays small (<5°)') lines.push('Knock control calm — de-prioritize timing/carbon as primary.');
      return lines.length ? { tone, lines } : null;
    },
  },
  {
    id: 'timing',
    title: 'Step 6 — Cam timing / VVT (only if indicated)',
    goal: 'Reach here if Step 1 showed timing codes, Step 4 was uniformly low, or Step 5 showed high knock retard.',
    tips: [
      'Scope cam-vs-crank correlation; a timing-chain stretch is a known high-mileage Skyactiv-G cause of multi-cyl misfire + power loss.',
      'Test VVT actuators / oil-control valves (oil-pressure dependent — confirm oil first).',
      'If chain stretch confirmed, do the full chain kit (chain, guides, tensioner, VVT actuators) — quote $900–1,800.',
    ],
    fields: [
      { id: 'corr', label: 'Cam-vs-crank correlation', kind: 'choice', options: ['In spec', 'Out of spec / wandering', 'Not tested yet'] },
    ],
    evaluate: (d) => {
      if (!d.corr || d.corr === 'Not tested yet') return null;
      if (d.corr === 'Out of spec / wandering') return { tone: 'bad', lines: ['Timing-chain stretch / VVT fault confirmed — this is the root cause. Replace timing chain kit + VVT actuators; verify oil-control valves. Expensive path ($900–1,800).'] };
      return { tone: 'good', lines: ['Timing is good → the cause is ignition/fuel (loop back to plugs/coils/injectors per cylinder).'] };
    },
  },
];

/* ============================ Component ============================ */
export default function MazdaPage() {
  const [tab, setTab] = useState<'diag' | 'data' | 'cost' | 'lookup'>('diag');
  const [step, setStep] = useState(0);
  const [ans, setAns] = useState<Record<string, string>>({});
  const set = (id: string, v: string) => setAns((p) => ({ ...p, [id]: v }));

  const cur = STEPS[step];
  const evalNow = useMemo(() => cur.evaluate(ans), [cur, ans]);
  const progress = Math.round(((step + 1) / STEPS.length) * 100);

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.txt, fontFamily: 'system-ui,Segoe UI,Roboto,Arial,sans-serif' }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${C.line}`, background: 'linear-gradient(180deg,#0e141b,#0b0f14)' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-nobg.png" alt="River City Roofing Solutions" style={{ height: 44, width: 'auto' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: .2 }}>
              Mazda 3 <span style={{ color: C.green }}>Diagnostic Assistant</span>
            </div>
            <div style={{ color: C.mut, fontSize: 12.5 }}>{VEHICLE.detail}</div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 11.5, color: C.mut }}>
            <div>VIN {VEHICLE.vinStart}</div>
            <div>PCM {VEHICLE.pcmSw}</div>
          </div>
        </div>
        {/* Tabs */}
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 18px 12px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {([['diag', 'Diagnose'], ['data', 'Known Data'], ['cost', 'Causes & Cost'], ['lookup', 'Code Lookup']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={tabBtn(tab === k)}>{l}</button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: 18 }}>
        {/* Post-repair status banner */}
        <div style={{ background: 'rgba(57,255,20,.08)', border: `1px solid ${C.green}`, borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ color: C.green, fontWeight: 800, fontSize: 14.5, marginBottom: 6 }}>✓ {STATUS.headline}</div>
          <div style={{ fontSize: 13, lineHeight: 1.55, color: C.txt }}>{STATUS.detail}</div>
          <div style={{ fontSize: 12.5, lineHeight: 1.5, color: C.amber, marginTop: 8 }}>{STATUS.remaining}</div>
        </div>
        {tab === 'diag' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 16, alignItems: 'start' }}>
            <div>
              {/* progress */}
              <div style={{ height: 6, background: C.panel2, borderRadius: 6, overflow: 'hidden', marginBottom: 14 }}>
                <div style={{ width: `${progress}%`, height: '100%', background: C.green, transition: 'width .3s' }} />
              </div>
              <div style={card}>
                <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>{cur.title}</div>
                <div style={{ color: C.mut, fontSize: 13.5, marginBottom: 12 }}>{cur.goal}</div>

                <div style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: '10px 12px', marginBottom: 14 }}>
                  <div style={{ color: C.green, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>TIPS</div>
                  <ul style={{ margin: 0, paddingLeft: 18, color: C.txt, fontSize: 13, lineHeight: 1.55 }}>
                    {cur.tips.map((t, i) => <li key={i}>{t}</li>)}
                  </ul>
                </div>

                {/* fields */}
                <div style={{ display: 'grid', gap: 12 }}>
                  {cur.fields.map((f) => (
                    <div key={f.id}>
                      <label style={{ display: 'block', fontSize: 13, marginBottom: 6, color: C.txt }}>{f.label}</label>
                      {f.kind === 'choice' ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {f.options.map((o) => (
                            <button key={o} onClick={() => set(f.id, o)} style={chip(ans[f.id] === o)}>{o}</button>
                          ))}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input
                            inputMode={f.kind === 'number' ? 'decimal' : 'text'}
                            value={ans[f.id] || ''} placeholder={f.placeholder || ''}
                            onChange={(e) => set(f.id, e.target.value)}
                            style={input}
                          />
                          {'suffix' in f && f.suffix ? <span style={{ color: C.mut, fontSize: 13 }}>{f.suffix}</span> : null}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* live analysis */}
                {evalNow && (
                  <div style={{ marginTop: 14, background: TONE[evalNow.tone].bg, border: `1px solid ${TONE[evalNow.tone].c}`, borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ color: TONE[evalNow.tone].c, fontWeight: 800, fontSize: 12.5, marginBottom: 6 }}>ANALYSIS · {TONE[evalNow.tone].label}</div>
                    {evalNow.lines.map((l, i) => <div key={i} style={{ fontSize: 13.5, lineHeight: 1.55, marginBottom: 4 }}>{l}</div>)}
                  </div>
                )}

                {/* nav */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 18 }}>
                  <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} style={navBtn(step === 0)}>← Back</button>
                  <button onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))} disabled={step === STEPS.length - 1} style={navBtn(step === STEPS.length - 1, true)}>
                    {step === STEPS.length - 1 ? 'End' : 'Next →'}
                  </button>
                </div>
              </div>
            </div>

            {/* sidebar findings */}
            <div style={{ ...card, position: 'sticky', top: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10, color: C.green }}>WHAT WE ALREADY KNOW</div>
              {KNOWN.slice(0, 5).map((k, i) => (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 12.5 }}>{k.label}</span>
                    <span style={{ fontSize: 10.5, color: TONE[k.tone].c, fontWeight: 700 }}>{TONE[k.tone].label}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: C.mut }}>{k.value}</div>
                </div>
              ))}
              <div style={{ borderTop: `1px solid ${C.line}`, marginTop: 6, paddingTop: 10, fontSize: 11.5, color: C.mut }}>
                Bottom line: all-4-cylinder misfire, trims normal → start with <b style={{ color: C.txt }}>plugs</b>, then compression. Fix before driving (cat-damage counts rising).
              </div>
            </div>
          </div>
        )}

        {tab === 'data' && (
          <div>
            <div style={card}>
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>Vehicle</div>
              <div style={{ color: C.mut, fontSize: 13 }}>{VEHICLE.detail}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, marginTop: 10, fontSize: 12.5 }}>
                <span>VIN <b>{VEHICLE.vinStart}</b></span><span>PCM SW <b>{VEHICLE.pcmSw}</b></span>
                <span>Mileage <b>{VEHICLE.mileage}</b></span><span>{VEHICLE.software}</span>
              </div>
            </div>
            <div style={{ ...card, marginTop: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>Findings from the scan</div>
              {KNOWN.map((k, i) => (
                <div key={i} style={{ padding: '10px 0', borderBottom: i < KNOWN.length - 1 ? `1px solid ${C.line}` : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <b style={{ fontSize: 13.5 }}>{k.label}</b>
                    <span style={{ fontSize: 11, color: TONE[k.tone].c, fontWeight: 800, whiteSpace: 'nowrap' }}>{TONE[k.tone].label}</span>
                  </div>
                  <div style={{ fontSize: 13, color: C.green, margin: '2px 0' }}>{k.value}</div>
                  <div style={{ fontSize: 12.5, color: C.mut }}>{k.note}</div>
                </div>
              ))}
            </div>
            <div style={{ ...card, marginTop: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>Repair timeline vs. data</div>
              {TIMELINE.map((t, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 12, padding: '8px 0', borderBottom: i < TIMELINE.length - 1 ? `1px solid ${C.line}` : 'none' }}>
                  <div style={{ color: C.blue, fontSize: 12.5, fontWeight: 700 }}>{t.date}</div>
                  <div><b style={{ fontSize: 13 }}>{t.event}</b> — {t.action}<div style={{ fontSize: 12.5, color: C.mut }}>{t.verdict}</div></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'cost' && (
          <div style={card}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>Ranked probable causes & cost</div>
            <div style={{ color: C.mut, fontSize: 12.5, marginBottom: 12 }}>Estimates for a Skyactiv-G Mazda 3 · shop labor ≈ $120–160/hr · confirm engine (2.0L vs 2.5L) by VIN.</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr>{['#', 'Cause', 'Why it fits', 'DIY parts', 'Shop', 'Time'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 10px', borderBottom: `1px solid ${C.line}`, color: C.mut, fontWeight: 600 }}>{h}</th>))}</tr></thead>
                <tbody>
                  {CAUSES.map((r) => (
                    <tr key={r.n}>
                      <td style={td}><span style={{ color: TONE[r.tone].c, fontWeight: 800 }}>{r.n}</span></td>
                      <td style={td}><b>{r.cause}</b></td>
                      <td style={{ ...td, color: C.mut }}>{r.why}</td>
                      <td style={td}>{r.diyParts}</td><td style={td}>{r.shop}</td><td style={td}>{r.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 14, background: 'rgba(57,255,20,.08)', border: `1px solid ${C.green}`, borderRadius: 10, padding: '12px 14px', fontSize: 13.5 }}>
              <b style={{ color: C.green }}>Likely band:</b> plugs ± carbon = <b>$60–$650</b>. If timing/VVT = <b>$900–$1,800</b>. A compression test early splits the two.
            </div>
          </div>
        )}

        {tab === 'lookup' && <Lookup />}
      </div>

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 18px 28px', color: C.mut, fontSize: 11.5 }}>
        Built from real XTOOL D7 scan data (06-16/17). No placeholder values. River City Roofing Solutions internal tool.
      </div>
    </div>
  );
}

/* ---------- Code Lookup tab: built-in DB + web search + optional Ollama ---------- */
function Lookup() {
  const [q, setQ] = useState('');
  const [aiUrl, setAiUrl] = useState('http://localhost:11434');
  const [aiOut, setAiOut] = useState('');
  const [busy, setBusy] = useState(false);

  const code = q.toUpperCase().match(/[PCBU][0-9][0-9A-F]{3}/)?.[0] || '';
  const hit = code ? DTC_DB[code] : undefined;

  async function askOllama() {
    setBusy(true); setAiOut('');
    try {
      const res = await fetch(`${aiUrl.replace(/\/$/, '')}/api/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', stream: false,
          prompt: `You are a master Mazda technician. The vehicle is a 3rd-gen Mazda 3 Skyactiv-G with an all-cylinder misfire (normal fuel trims). In 4 sentences: what does "${q}" mean, likely causes on this engine, and the next test? ` }),
      });
      const j = await res.json();
      setAiOut(j.response || JSON.stringify(j));
    } catch {
      setAiOut('Could not reach a local Ollama server (this only works on your own PC/network; an https page may block http://localhost). Use the built-in answer above or the web-search button.');
    } finally { setBusy(false); }
  }

  return (
    <div style={card}>
      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>Code / question lookup</div>
      <div style={{ color: C.mut, fontSize: 12.5, marginBottom: 12 }}>Type a DTC (e.g. P0302) or a question. Built-in answers always work; web search & local AI are optional.</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="P0300, or 'why all cylinders misfire'" style={{ ...input, flex: 1, minWidth: 220 }} />
        <a href={`https://www.google.com/search?q=${encodeURIComponent('Mazda 3 Skyactiv ' + q)}`} target="_blank" rel="noreferrer" style={{ ...navBtn(false, true), textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Web search ↗</a>
        <button onClick={askOllama} disabled={busy || !q} style={navBtn(busy || !q)}>{busy ? 'Asking…' : 'Ask local AI'}</button>
      </div>

      {hit && (
        <div style={{ marginTop: 14, background: TONE.info.bg, border: `1px solid ${C.blue}`, borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontWeight: 800 }}>{code} — {hit.t}</div>
          <div style={{ fontSize: 12.5, color: C.mut, margin: '2px 0' }}>System: {hit.sys}</div>
          <div style={{ fontSize: 13.5 }}>{hit.note}</div>
        </div>
      )}
      {!hit && code && <div style={{ marginTop: 14, color: C.mut, fontSize: 13 }}>“{code}” isn’t in the built-in list — try the web search or local AI.</div>}
      {aiOut && (
        <div style={{ marginTop: 14, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: '12px 14px', fontSize: 13.5, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
          <div style={{ color: C.green, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>LOCAL AI</div>{aiOut}
        </div>
      )}

      <div style={{ marginTop: 16, fontSize: 12, color: C.mut }}>
        Built-in code list: {Object.keys(DTC_DB).join(', ')}.
      </div>
      <div style={{ marginTop: 8, fontSize: 11.5, color: C.mut }}>
        Local AI endpoint: <input value={aiUrl} onChange={(e) => setAiUrl(e.target.value)} style={{ ...input, width: 220, padding: '4px 8px', fontSize: 12 }} /> (Ollama; run <code>ollama serve</code> on your PC).
      </div>
    </div>
  );
}

/* ---------- styles ---------- */
const card: React.CSSProperties = { background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 18 };
const td: React.CSSProperties = { padding: '8px 10px', borderBottom: `1px solid ${C.line}`, verticalAlign: 'top' };
const input: React.CSSProperties = { background: '#0c1218', border: `1px solid ${C.line}`, color: C.txt, borderRadius: 8, padding: '8px 10px', fontSize: 14, width: '100%', outline: 'none' };
function tabBtn(active: boolean): React.CSSProperties {
  return { background: active ? C.green : 'transparent', color: active ? '#04210a' : C.mut, border: `1px solid ${active ? C.green : C.line}`, borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' };
}
function chip(active: boolean): React.CSSProperties {
  return { background: active ? 'rgba(57,255,20,.15)' : C.panel2, color: active ? C.green : C.txt, border: `1px solid ${active ? C.green : C.line}`, borderRadius: 8, padding: '7px 12px', fontSize: 12.5, cursor: 'pointer', fontWeight: active ? 700 : 400 };
}
function navBtn(disabled: boolean, primary = false): React.CSSProperties {
  return { background: disabled ? C.panel2 : primary ? C.green : 'transparent', color: disabled ? C.mut : primary ? '#04210a' : C.txt, border: `1px solid ${disabled ? C.line : primary ? C.green : C.line}`, borderRadius: 8, padding: '9px 18px', fontSize: 13.5, fontWeight: 700, cursor: disabled ? 'default' : 'pointer' };
}
