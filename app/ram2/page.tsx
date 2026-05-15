'use client';

import { useState } from 'react';

type Outcome = {
  label: string;
  variant: 'good' | 'warn' | 'bad' | 'neutral';
  next?: string;
  result?: { title: string; body: string; action?: string };
};

type Step = {
  id: string;
  num: string;
  title: string;
  why?: string;
  tools?: string[];
  procedure: string[];
  question: string;
  outcomes: Outcome[];
};

const STEPS: Step[] = [
  {
    id: 'start',
    num: 'Start',
    title: 'Start here — pick a fault to chase',
    why: 'Two independent issues showed up in the scan data: a dead oil-pressure sensor circuit and a misfire isolated to cylinder 8. Decide which one to tackle first. Oil pressure is the engine-killer so do it first if you have time today.',
    procedure: ['Engine cold. Truck in driveway. D7 scanner handy.'],
    question: 'Which fault are we chasing right now?',
    outcomes: [
      { label: 'Oil pressure light (do this first)', variant: 'bad', next: 'oil-1' },
      { label: 'Cylinder 8 misfire / vibration', variant: 'warn', next: 'mis-1' },
      { label: 'I want to re-scan / re-pull DTCs first', variant: 'neutral', next: 'rescan' },
    ],
  },

  {
    id: 'rescan',
    num: 'Optional',
    title: 'Re-pull DTCs and verify nothing changed',
    why: 'Symptoms might have evolved since 5/14. New codes can point at new failures.',
    tools: ['XTOOL D7'],
    procedure: [
      'Connect D7 to OBD-II port under dash.',
      'Read codes. Note any new ones beyond P052x (oil sensor) and P0308 (cyl 8 misfire).',
      'Capture a 30-second idle datastream and save the .cds file.',
    ],
    question: 'What did you find?',
    outcomes: [
      { label: 'Only the known codes, no surprises', variant: 'good', next: 'start' },
      { label: 'New misfire codes on other cylinders', variant: 'warn', result: {
        title: 'Stop — re-evaluate before parts swap',
        body: 'Misfire spreading to multiple cylinders changes the playbook. Likely candidates: fuel pressure, vacuum leak, MAP/MAF sensor, PCM ground. Pull a fuel pressure reading (50-60 PSI key-on, drops to ~45 at idle), check for vacuum leaks with carb cleaner around intake.',
        action: 'Run a smoke test or carb-cleaner test before continuing.',
      }},
      { label: 'New code I do not recognize', variant: 'warn', result: {
        title: 'Look up the code first',
        body: 'Search the exact code (e.g. P0XXX) in a Mopar-specific source. Note freeze-frame data — RPM, coolant temp, load. Treat unknown codes as their own diagnostic branch before continuing this flowchart.',
      }},
    ],
  },

  {
    id: 'oil-1',
    num: 'Oil 1',
    title: 'Inspect the oil pressure sensor connector',
    why: 'Scan data showed 0.000 V flat across three captures with the engine running. A real sensor never outputs 0.000 V. That means the sensor, pigtail, or wire is open. Check the cheap end first.',
    tools: ['Flashlight', 'Small flat screwdriver', 'Dielectric grease'],
    procedure: [
      'Engine OFF and cool.',
      'Locate the oil pressure sensor — on the 5.7L Hemi it is at the rear of the block, drivers side, just above the oil filter housing. It is a small sensor with a 3-pin plastic connector.',
      'Disconnect the connector. Check the plastic for cracks. Check the metal pins for green corrosion, bent pins, or pushed-back pins.',
      'Check the wires going into the connector — wiggle test, look for breaks or chafe.',
    ],
    question: 'What does the connector look like?',
    outcomes: [
      { label: 'Corroded or broken', variant: 'warn', next: 'oil-1a' },
      { label: 'Connector looks clean', variant: 'good', next: 'oil-2' },
      { label: 'Wires look damaged near connector', variant: 'warn', next: 'oil-1b' },
    ],
  },
  {
    id: 'oil-1a',
    num: 'Oil 1a',
    title: 'Repair the pigtail or pins',
    why: 'A corroded pin causes intermittent or zero signal — exactly what the data shows.',
    tools: ['Pigtail repair kit', 'Heat shrink', 'Solder', 'Pick set'],
    procedure: [
      'If only pin corrosion: clean pins with a pick + electrical contact cleaner. Apply dielectric grease. Reseat.',
      'If pins damaged: order a Mopar pigtail (or Dorman) and splice in with heat-shrink butt connectors.',
      'Reconnect, start engine, re-scan oil pressure PID.',
    ],
    question: 'Does the oil pressure PID now read a number above 0?',
    outcomes: [
      { label: 'Yes — reads 20-65 PSI', variant: 'good', result: {
        title: 'Fixed — bad connector was the cause',
        body: 'Connector repair restored the signal. Confirm the reading is in the normal range at idle (20-40 PSI warm) and at 2000 RPM (45-65 PSI). Clear codes, drive, re-verify after a heat cycle.',
        action: 'Done with the oil-light branch. Move on to the misfire if you have not already.',
      }},
      { label: 'Still reads 0', variant: 'bad', next: 'oil-2' },
    ],
  },
  {
    id: 'oil-1b',
    num: 'Oil 1b',
    title: 'Repair damaged wiring',
    why: 'A broken wire = no signal regardless of sensor health.',
    tools: ['Heat shrink butts', 'Crimper', 'Heat gun', 'Wire strippers'],
    procedure: [
      'Trace the harness 6-12 inches back from the connector.',
      'Cut out the damaged section. Splice new wire of matching gauge. Heat shrink.',
      'Reconnect, start engine, re-scan PID.',
    ],
    question: 'Reading now?',
    outcomes: [
      { label: 'Reads 20-65 PSI', variant: 'good', result: {
        title: 'Fixed — wiring break was the cause',
        body: 'Drive a heat cycle, re-verify. Clear codes.',
      }},
      { label: 'Still 0', variant: 'bad', next: 'oil-2' },
    ],
  },
  {
    id: 'oil-2',
    num: 'Oil 2',
    title: 'Mechanical oil pressure test (the test that matters)',
    why: '320,000 miles. The electrical sensor lies — a mechanical gauge does not. Real PSI tells us if the engine is safe to keep driving.',
    tools: ['Mechanical oil pressure gauge kit (~$30 Harbor Freight or Amazon)', 'Sender socket (usually 1-1/16" or 27mm)', 'Thread sealant'],
    procedure: [
      'Engine OFF and cool. Have shop rags ready — oil will drip.',
      'Unscrew the oil pressure sensor. Catch drips with a rag.',
      'Thread the mechanical gauge adapter into the sensor port. Snug with thread sealant.',
      'Run the gauge line away from belts and exhaust into the engine bay where you can see it.',
      'Start engine. Read PSI at COLD idle, WARM idle (after 10 minutes), and at 2000 RPM warm.',
    ],
    question: 'What does the gauge read at HOT idle (after 10 minutes of warm-up)?',
    outcomes: [
      { label: '25+ PSI hot idle (good)', variant: 'good', next: 'oil-2a' },
      { label: '10-25 PSI hot idle (borderline)', variant: 'warn', result: {
        title: 'Worn bearings — engine is on borrowed time',
        body: 'At 320k miles, 10-25 PSI hot idle means rod/main bearing clearance is opening up. Engine still runs but it is wearing itself out faster now. Switch to high-mileage 5W-30 (one weight up) might buy you a small bump. Plan for engine rebuild or replacement. Avoid sustained high RPM and towing.',
        action: 'Replace oil pressure sensor with new Mopar/Dorman ($25). Drive gently. Save for engine work.',
      }},
      { label: 'Under 10 PSI hot idle', variant: 'bad', result: {
        title: 'STOP DRIVING. Bearing failure imminent.',
        body: 'Below 10 PSI hot idle the rod bearings are starving for oil. Continuing to drive = thrown rod = junkyard engine. Truck needs to be towed or short-hopped (under 5 minutes) to a shop or to your garage for teardown.',
        action: 'Park it. Decide: rebuild bottom end, junkyard engine swap (~$1500-2500), or sell as-is.',
      }},
      { label: '0 PSI (gauge dead reading)', variant: 'bad', next: 'oil-2b' },
    ],
  },
  {
    id: 'oil-2a',
    num: 'Oil 2a',
    title: 'Oil pressure is GOOD — sensor is the only fault',
    why: 'Mechanical gauge confirms healthy pressure. The electrical sensor itself is dead.',
    tools: ['New oil pressure sensor (Mopar 5149062AB or Dorman 924-040, ~$25)', 'Same socket used to remove old one', 'Thread sealant'],
    procedure: [
      'Remove the mechanical test gauge.',
      'Install new sensor with thread sealant. Hand-snug, then 1/4 turn with the socket. Do not overtighten.',
      'Reconnect electrical connector.',
      'Start engine. Re-scan oil pressure PID — should show 20-65 PSI now.',
      'Clear DTC P052X. Drive 20 miles. Re-scan. Code should not return.',
    ],
    question: 'Did the new sensor fix it?',
    outcomes: [
      { label: 'Yes — PID reads normal, no codes', variant: 'good', result: {
        title: 'Oil light branch DONE',
        body: 'Real pressure healthy + new sensor reading correctly. Move to the misfire branch.',
        action: 'Go back to start and pick the cylinder 8 misfire path.',
      }},
      { label: 'New sensor also reads 0', variant: 'bad', result: {
        title: 'Wiring fault between sensor and PCM',
        body: 'Two dead sensors in a row = not the sensors. Check continuity from each pin at the sensor connector back to the PCM with a multimeter and a wiring diagram. Look for chafed wire on top of the bellhousing or near exhaust.',
      }},
    ],
  },
  {
    id: 'oil-2b',
    num: 'Oil 2b',
    title: 'Gauge reads 0 — verify the install before panicking',
    why: 'A truly dead pump is rare. A bad gauge install is common.',
    tools: ['Different mechanical gauge if available', 'Thread sealant'],
    procedure: [
      'Engine off. Re-check the adapter fitting — is it actually threaded all the way in? Cross-threaded? Air leak?',
      'Try a second gauge if you can borrow or buy one.',
      'If a second gauge also reads 0 with engine running, this is genuine.',
    ],
    question: 'Second gauge confirms 0 PSI?',
    outcomes: [
      { label: 'Yes, confirmed 0', variant: 'bad', result: {
        title: 'Oil pump failure or pickup tube blockage',
        body: 'On the 5.7L Hemi this usually means: (1) oil pickup tube screen clogged with sludge — common on 320k mi neglected engines, (2) oil pump drive failure, (3) cam-driven oil pump worn out, or (4) catastrophic bearing failure dumping oil internally. Drop the oil pan and inspect.',
        action: 'STOP DRIVING. Pull oil pan. Inspect pickup tube screen. Decide rebuild vs replace.',
      }},
      { label: 'Re-install fixed it, now reads normal', variant: 'good', next: 'oil-2a' },
    ],
  },

  {
    id: 'mis-1',
    num: 'Mis 1',
    title: 'Coil + plug swap (cylinder 8 to cylinder 1)',
    why: 'Misfire data isolates the problem to cylinder 8 (417 misfires/200rev avg). Bank-2 LTFT is +6.6% mean. Three possible causes on that one cylinder: ignition (coil/plug), fuel (injector), or mechanical (valve/ring). Test the cheap end first by swapping the coil and plug from #8 to a known-good cylinder.',
    tools: ['10mm socket + ratchet (coil bolts)', '5/8" spark plug socket', '6" extension', 'Anti-seize', 'Dielectric grease', 'Torque wrench (optional but recommended)'],
    procedure: [
      'Engine cool. Hood up.',
      'Cylinder 8 is the REAR cylinder on the PASSENGER side of the Hemi (V8 firing order 1-8-4-3-6-5-7-2). Cylinder 1 is the FRONT cylinder on the PASSENGER side.',
      'Pop the coil-pack connector off both #8 and #1. Remove the 10mm bolt holding each coil. Lift coils out.',
      'Unscrew both spark plugs with the 5/8" socket and extension. Note: Hemi has 2 plugs per cylinder — pull BOTH front and rear plugs on #8 and #1, but only swap the FRONT pair (next to coil pack) to start.',
      'INSPECT old #8 plug: oil-fouled? heavy soot? white/glazed? cracked porcelain? Photograph it.',
      'Swap: install old #8 plug + coil into cylinder 1. Install old #1 plug + coil into cylinder 8.',
      'Anti-seize on plug threads. Dielectric grease on coil boots. Torque plugs to 13 ft-lb (do not overtighten — Hemi heads are aluminum).',
      'Reconnect coils. Start engine, drive 5-10 minutes. Re-scan misfire counters.',
    ],
    question: 'Which cylinder is logging misfires now?',
    outcomes: [
      { label: 'Misfire MOVED to cylinder 1', variant: 'good', next: 'mis-1a' },
      { label: 'Misfire STAYED on cylinder 8', variant: 'warn', next: 'mis-2' },
      { label: 'Misfire on BOTH cylinders 1 and 8', variant: 'warn', result: {
        title: 'Mixed result — re-evaluate',
        body: 'Likely the plug or coil from #1 was also marginal. Replace BOTH coils and BOTH plug sets with new parts. NGK or Champion plugs (Mopar OE) and Mopar coils. Re-test.',
      }},
      { label: 'No misfires at all anymore', variant: 'good', result: {
        title: 'Probably the coil-to-plug seat or boot',
        body: 'Just reseating the coil cleared a bad connection — could be the original boot was cracked or carbon-tracking. Watch it for a week. If it returns, replace the coil that was on #8 (now on #1).',
      }},
    ],
  },
  {
    id: 'mis-1a',
    num: 'Mis 1a',
    title: 'Misfire moved with the parts — separate coil vs plug',
    why: 'Confirmed: the problem is the coil OR the plug from cylinder 8 (now installed on cylinder 1). Isolate which.',
    tools: ['Same tools as previous step'],
    procedure: [
      'Pull the swapped coil and plug back out of cylinder 1.',
      'Put a NEW plug into cylinder 1. Leave the suspect coil on cylinder 1.',
      'Drive 5-10 minutes. Re-scan.',
    ],
    question: 'Misfire status now?',
    outcomes: [
      { label: 'Misfire still on cyl 1 with new plug', variant: 'bad', result: {
        title: 'COIL is bad',
        body: 'Replace the bad coil. Mopar 5149199AB or equivalent (~$30-60). Put a fresh plug in cyl 8 too while you have it apart.',
        action: 'Order: 1x ignition coil, 2x spark plugs (Hemi has 2 per cyl, replace pair on 8).',
      }},
      { label: 'Misfire cleared on cyl 1', variant: 'good', result: {
        title: 'PLUG was bad (old #8 plug)',
        body: 'The plug from cylinder 8 was the fault. Install fresh plugs on cylinder 8 (both front and rear — they share work on Hemi). Total fix: a $10 plug. Inspect old plug for cause: cracked porcelain, worn electrode, oil-fouling. If oil-fouled, possible valve seal leak on #8 — watch it.',
        action: 'Install fresh plugs on cyl 8. Drive 50 miles. Re-scan. If clean, done.',
      }},
    ],
  },
  {
    id: 'mis-2',
    num: 'Mis 2',
    title: 'Misfire stayed on cyl 8 — test the injector',
    why: 'Ignition is exonerated. Next cheapest test: swap the fuel injector from cyl 8 to a known-good cylinder.',
    tools: ['8mm socket (fuel rail bolts)', 'Pick set (injector clip)', 'New O-rings (or fresh assembly lube)', 'Rags', 'Fire extinguisher nearby'],
    procedure: [
      'CAUTION — fuel system is pressurized. Relieve pressure first: pull the fuel pump fuse, crank engine until it stalls, then disconnect battery negative.',
      'Remove engine cover. Unbolt fuel rail (8mm bolts).',
      'Lift fuel rail straight up — injectors come out with it. Be ready for fuel drips.',
      'Pull the injector clip on #8 and on #1. Pop both injectors out of the rail.',
      'Swap: #8 injector goes to #1 position. #1 injector goes to #8 position.',
      'Lubricate O-rings with clean engine oil. Reseat. Bolt rail back down.',
      'Reconnect battery. Start engine. Listen for leaks (eyeball + nose). Drive 5-10 min. Re-scan.',
    ],
    question: 'Where is the misfire now?',
    outcomes: [
      { label: 'Misfire moved to cylinder 1', variant: 'good', result: {
        title: 'INJECTOR is bad',
        body: 'Replace injector. Mopar 5037479AB or equivalent (~$50-100). Could also have it cleaned/flow-tested at a shop ($25), but on 320k mi a new injector is the move.',
        action: 'Order: 1x fuel injector. Replace and re-test.',
      }},
      { label: 'Misfire still on cyl 8', variant: 'warn', next: 'mis-3' },
    ],
  },
  {
    id: 'mis-3',
    num: 'Mis 3',
    title: 'Compression test on cyl 8',
    why: 'Ignition and fuel are both ruled out. The remaining causes are mechanical: a burnt valve, broken ring, or stretched rocker. At 320k miles this is plausible. A compression test tells us if the cylinder can actually hold pressure.',
    tools: ['Compression tester ($20-40)', 'Threaded adapter for Hemi spark plug hole', 'Remote starter switch or helper'],
    procedure: [
      'Engine WARM (drive 10 min, then shut off).',
      'Pull ALL spark plugs (helps engine spin freely).',
      'Disable fuel: pull fuel pump fuse.',
      'Thread compression tester into cylinder 8 front plug hole.',
      'Hold throttle wide open. Crank engine for 5 compression strokes (or 5 seconds).',
      'Record peak PSI. Repeat on cylinder 1 and one other (say cyl 3) for comparison.',
    ],
    question: 'What did cylinder 8 read?',
    outcomes: [
      { label: '120+ PSI, within 10% of other cylinders', variant: 'good', result: {
        title: 'Compression is fine — mystery misfire',
        body: 'Mechanical is exonerated. Possibilities left: PCM wiring fault, intermittent connection at the PCM ground, or a MDS (cylinder deactivation) solenoid problem on that bank. Check PCM ground straps. Scan with MDS commanded OFF (some scanners allow forcing this) and see if the misfire changes.',
        action: 'Inspect PCM grounds. Consider MDS lifter inspection (sticking solenoid on bank 2).',
      }},
      { label: 'Under 100 PSI on cyl 8 only', variant: 'bad', next: 'mis-3a' },
      { label: 'All cylinders low (under 100 PSI)', variant: 'bad', result: {
        title: 'Engine is worn out',
        body: 'Universally low compression on a 320k mi engine = end of useful life. Time for engine swap or new truck. Run leak-down to confirm whether it is rings (oil cap blow-by) or valves before deciding rebuild vs replace.',
      }},
    ],
  },
  {
    id: 'mis-3a',
    num: 'Mis 3a',
    title: 'Leak-down test on cyl 8 — find WHERE it leaks',
    why: 'Low compression on one cylinder = a seal is gone. Leak-down tells us which seal.',
    tools: ['Leak-down tester ($50)', 'Air compressor (90+ PSI)', 'Spark plug hole adapter', 'Wrench to hold crank pulley'],
    procedure: [
      'Bring cyl 8 to TDC on compression stroke (both valves closed). Use the timing mark on the crank pulley.',
      'Lock the crank with a wrench so cylinder pressure does not spin the engine.',
      'Thread leak-down tester into spark plug hole. Connect air supply at ~90 PSI input.',
      'Read leakage percentage. Listen and feel at each location:',
      '   • Intake manifold (snake stethoscope down throttle body)',
      '   • Tailpipe',
      '   • Oil filler cap (open it)',
      '   • Radiator filler neck (bubbles = head gasket)',
    ],
    question: 'Where do you hear or feel the air escaping?',
    outcomes: [
      { label: 'Out the EXHAUST (tailpipe)', variant: 'bad', result: {
        title: 'Burnt or bent EXHAUST VALVE on cyl 8',
        body: 'Most common 320k mi Hemi failure. Repair = head off, valve job ($800-1500 shop), or full head swap. Junkyard 5.7L head ~$200-400.',
        action: 'Decide: valve job, head swap, or full engine swap. Full engine often makes more sense at this mileage.',
      }},
      { label: 'Out the INTAKE (throttle body)', variant: 'bad', result: {
        title: 'INTAKE VALVE damage on cyl 8',
        body: 'Less common. Same repair path: head off for valve job, or head swap.',
      }},
      { label: 'Out the OIL CAP', variant: 'bad', result: {
        title: 'RINGS worn on cyl 8',
        body: 'Compression escaping past the piston rings into the crankcase. Repair = pistons/rings, which means engine out, bottom end apart. At 320k mi this almost always means full engine replacement, not rebuild.',
        action: 'Engine swap territory. Junkyard 5.7L ~$1500-2500.',
      }},
      { label: 'Bubbles in the RADIATOR', variant: 'bad', result: {
        title: 'HEAD GASKET blown between cyl 8 and water jacket',
        body: 'Less common on Hemi but does happen. Pull the head, replace gasket, check head for warpage. If head is warped = head swap.',
      }},
    ],
  },
];

const STEP_BY_ID: Record<string, Step> = Object.fromEntries(STEPS.map(s => [s.id, s]));

export default function RamDiagnosticFlowchart() {
  const [path, setPath] = useState<string[]>(['start']);
  const [endResult, setEndResult] = useState<Outcome['result'] | null>(null);
  const [viewMode, setViewMode] = useState<'wizard' | 'tree'>('wizard');

  const currentStep = STEP_BY_ID[path[path.length - 1]];

  function chooseOutcome(outcome: Outcome) {
    if (outcome.result) {
      setEndResult(outcome.result);
    } else if (outcome.next) {
      setPath(p => [...p, outcome.next!]);
      setEndResult(null);
    }
  }

  function reset() {
    setPath(['start']);
    setEndResult(null);
  }

  function back() {
    if (endResult) { setEndResult(null); return; }
    if (path.length > 1) setPath(p => p.slice(0, -1));
  }

  return (
    <div className="ram-page">
      <style>{styles}</style>

      <header className="ram-hdr">
        <div className="ram-hdr-inner">
          <div>
            <div className="ram-eyebrow">Garage Diagnostic</div>
            <h1>2013 Ram 1500 — Diagnostic Flowchart</h1>
            <div className="ram-sub">5.7L Hemi · 319,774 mi · prior scan 2026-05-14</div>
          </div>
          <div className="ram-modes">
            <button className={viewMode === 'wizard' ? 'on' : ''} onClick={() => setViewMode('wizard')}>Wizard</button>
            <button className={viewMode === 'tree' ? 'on' : ''} onClick={() => setViewMode('tree')}>Full Tree</button>
          </div>
        </div>
      </header>

      <section className="tools">
        <h2>All diagnostic tools & data</h2>
        <div className="tools-grid">
          <a className="tool primary" href="#wizard-anchor" onClick={() => setViewMode('wizard')}>
            <div className="t-icon">🧭</div>
            <div className="t-title">Interactive Wizard</div>
            <div className="t-desc">Step-by-step decision tree (you are here). Click answers, get the next test.</div>
          </a>
          <a className="tool primary" href="/ram2/dashboard.html" target="_blank" rel="noopener">
            <div className="t-icon">📊</div>
            <div className="t-title">Full Dashboard</div>
            <div className="t-desc">5-tab interactive dashboard — overview, issues, fixes, cost, action checklist.</div>
          </a>
          <a className="tool" href="/ram2/old-flowchart.html" target="_blank" rel="noopener">
            <div className="t-icon">🔍</div>
            <div className="t-title">Original Flowchart</div>
            <div className="t-desc">First-generation 12-point decision flowchart from the 2026-05-14 session.</div>
          </a>
          <a className="tool" href="/ram2/reference.txt" target="_blank" rel="noopener">
            <div className="t-icon">⚡</div>
            <div className="t-title">Quick Reference</div>
            <div className="t-desc">Cheat sheet: part numbers, prices, cyl-8 location, cost matrix A-E.</div>
          </a>
          <a className="tool" href="/ram2/report.md" target="_blank" rel="noopener">
            <div className="t-icon">📋</div>
            <div className="t-title">Full Report (MD)</div>
            <div className="t-desc">Comprehensive markdown writeup of all 7 scans with severity ratings.</div>
          </a>
          <a className="tool" href="/ram2/all-scans.txt" target="_blank" rel="noopener">
            <div className="t-icon">📈</div>
            <div className="t-title">All Scans Consolidated</div>
            <div className="t-desc">Aggregated stats across 7 D7 scans — fuel trim, misfires, O2, MAF, RPM.</div>
          </a>
          <a className="tool" href="/ram2/data/" target="_blank" rel="noopener">
            <div className="t-icon">📂</div>
            <div className="t-title">Raw CSV Data</div>
            <div className="t-desc">16 CSVs: per-scan summary + frame-by-frame timeseries.</div>
          </a>
          <a className="tool" href="/ram2/screenshots/" target="_blank" rel="noopener">
            <div className="t-icon">📷</div>
            <div className="t-title">D7 Screenshots</div>
            <div className="t-desc">XTOOL D7 scanner screenshots captured during the diagnostic session.</div>
          </a>
        </div>
      </section>

      <section id="wizard-anchor" className="findings">
        <h2>Known findings from prior scan</h2>
        <div className="findings-grid">
          <div className="finding bad">
            <div className="f-tag">CONFIRMED</div>
            <div className="f-title">Oil pressure sensor dead</div>
            <div className="f-body">Sensor voltage flat 0.000 V across 3 captures. Real engine pressure UNKNOWN until tested mechanically.</div>
          </div>
          <div className="finding warn">
            <div className="f-tag">CONFIRMED</div>
            <div className="f-title">Cylinder 8 misfire</div>
            <div className="f-body">Only cyl 8 logs misfires. Counter mean 417 / 200 rev. Catalyst-damaging counter low (max 1).</div>
          </div>
          <div className="finding warn">
            <div className="f-tag">CONSISTENT</div>
            <div className="f-title">Bank 2 LTFT +6.6% to +9%</div>
            <div className="f-body">ECU adding fuel on bank 2 (cyl 8 is on bank 2). Bank 1 normal at idle. Matches a weak cyl 8.</div>
          </div>
          <div className="finding bad">
            <div className="f-tag">NEW DATA</div>
            <div className="f-title">Cyl-8 injector pulse 20× normal</div>
            <div className="f-body">Cyl 8 pulse width 3,010 µs vs cyls 3-5 at ~150 µs. Cyls 1, 2, 6, 7 also high (~2,500-2,900 µs). ECU dumping fuel to compensate for misread O2.</div>
          </div>
          <div className="finding bad">
            <div className="f-tag">NEW DATA</div>
            <div className="f-title">O2 sensors stuck high</div>
            <div className="f-body">Bank 1/1 at 3.47 V, 1/2 at 3.34 V (should be 0.1-0.9 V swinging). Sensor failure or wiring fault. Skews fuel trim across the engine.</div>
          </div>
          <div className="finding good">
            <div className="f-tag">RULED OUT</div>
            <div className="f-title">No lifter tick · 0° knock retard · no vacuum leak</div>
            <div className="f-body">Cam/lifter ruled out audibly. PCM logs no knock retard. MAP 18-21 inHg normal — intake is sealed.</div>
          </div>
        </div>
      </section>

      {viewMode === 'wizard' && (
        <section className="wizard">
          <div className="breadcrumbs">
            {path.map((id, i) => (
              <span key={id + i} className={i === path.length - 1 ? 'crumb on' : 'crumb'}>
                {STEP_BY_ID[id].num}
              </span>
            ))}
            {endResult && <span className="crumb result">Result</span>}
          </div>

          {!endResult && currentStep && (
            <div className="step-card">
              <div className="step-num">{currentStep.num}</div>
              <h2>{currentStep.title}</h2>
              {currentStep.why && <p className="why"><strong>Why:</strong> {currentStep.why}</p>}
              {currentStep.tools && currentStep.tools.length > 0 && (
                <div className="tools">
                  <strong>Tools/parts:</strong>
                  <ul>{currentStep.tools.map((t, i) => <li key={i}>{t}</li>)}</ul>
                </div>
              )}
              <div className="procedure">
                <strong>Procedure:</strong>
                <ol>{currentStep.procedure.map((p, i) => <li key={i}>{p}</li>)}</ol>
              </div>
              <div className="question">{currentStep.question}</div>
              <div className="outcomes">
                {currentStep.outcomes.map((o, i) => (
                  <button key={i} className={`out out-${o.variant}`} onClick={() => chooseOutcome(o)}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {endResult && (
            <div className="result-card">
              <div className="result-tag">DIAGNOSIS</div>
              <h2>{endResult.title}</h2>
              <p className="result-body">{endResult.body}</p>
              {endResult.action && (
                <div className="result-action"><strong>Next:</strong> {endResult.action}</div>
              )}
            </div>
          )}

          <div className="wizard-nav">
            <button onClick={back} disabled={path.length === 1 && !endResult}>← Back</button>
            <button onClick={reset}>↻ Start over</button>
          </div>
        </section>
      )}

      {viewMode === 'tree' && (
        <section className="tree">
          {STEPS.map(s => (
            <div key={s.id} className="tree-step" id={`tree-${s.id}`}>
              <div className="tree-num">{s.num}</div>
              <div className="tree-body">
                <h3>{s.title}</h3>
                {s.why && <p className="tree-why">{s.why}</p>}
                <div className="tree-q">{s.question}</div>
                <ul className="tree-out">
                  {s.outcomes.map((o, i) => (
                    <li key={i} className={`out-${o.variant}`}>
                      <span className="bullet" />
                      <span className="label">{o.label}</span>
                      <span className="arrow">→</span>
                      <span className="target">
                        {o.result ? <em>END: {o.result.title}</em> :
                          <a href={`#tree-${o.next}`}>{o.next ? STEP_BY_ID[o.next]?.title : '?'}</a>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </section>
      )}

      <footer className="ram-foot">
        <div>Source data: XTOOL D7 .cds recordings from 2026-05-14 · 7 Dodge scans · 319,774 mi at scan time</div>
        <div>All assets at <code>/ram2/</code> · raw CSVs at <code>/ram2/data/</code> · scanner screenshots at <code>/ram2/screenshots/</code></div>
      </footer>
    </div>
  );
}

const styles = `
.ram-page { min-height:100vh; background:#0b0f14; color:#e6edf3; font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif; padding-bottom:60px; }
.ram-hdr { background:linear-gradient(180deg,#161b22,#0b0f14); border-bottom:1px solid #30363d; padding:20px 24px; }
.ram-hdr-inner { max-width:1100px; margin:0 auto; display:flex; justify-content:space-between; align-items:flex-end; gap:16px; flex-wrap:wrap; }
.ram-eyebrow { color:#39FF14; font-size:11px; letter-spacing:2px; font-weight:600; text-transform:uppercase; }
.ram-hdr h1 { margin:6px 0 4px; font-size:24px; }
.ram-sub { color:#8b949e; font-size:13px; font-variant-numeric:tabular-nums; }
.ram-modes { display:flex; gap:6px; }
.ram-modes button { background:#161b22; border:1px solid #30363d; color:#e6edf3; padding:8px 14px; border-radius:6px; cursor:pointer; font-size:12px; }
.ram-modes button.on { background:#39FF14; color:#0b0f14; border-color:#39FF14; font-weight:600; }

.tools { max-width:1100px; margin:24px auto 0; padding:0 24px; }
.tools h2 { font-size:13px; color:#8b949e; text-transform:uppercase; letter-spacing:1px; margin:0 0 12px; font-weight:500; }
.tools-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:10px; }
.tool { display:flex; flex-direction:column; background:#161b22; border:1px solid #30363d; border-radius:8px; padding:14px; cursor:pointer; text-decoration:none; color:#e6edf3; transition:all .15s; }
.tool:hover { transform:translateY(-2px); border-color:#39FF14; box-shadow:0 4px 12px rgba(57,255,20,.1); }
.tool.primary { border-color:#39FF14; background:linear-gradient(135deg,#0e2818 0%,#161b22 60%); }
.t-icon { font-size:24px; margin-bottom:6px; }
.t-title { font-size:14px; font-weight:600; margin-bottom:4px; color:#fff; }
.t-desc { font-size:11px; color:#8b949e; line-height:1.4; }

.findings { max-width:1100px; margin:24px auto 0; padding:0 24px; }
.findings h2 { font-size:13px; color:#8b949e; text-transform:uppercase; letter-spacing:1px; margin:0 0 12px; font-weight:500; }
.findings-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:12px; }
.finding { background:#161b22; border:1px solid #30363d; border-left:3px solid #30363d; border-radius:6px; padding:12px 14px; }
.finding.bad { border-left-color:#f85149; }
.finding.warn { border-left-color:#d29922; }
.finding.good { border-left-color:#39FF14; }
.f-tag { font-size:9px; letter-spacing:1.5px; font-weight:700; opacity:.7; }
.finding.bad .f-tag { color:#f85149; }
.finding.warn .f-tag { color:#d29922; }
.finding.good .f-tag { color:#39FF14; }
.f-title { font-size:15px; font-weight:600; margin:4px 0 6px; }
.f-body { font-size:12px; color:#8b949e; line-height:1.5; }

.wizard { max-width:900px; margin:24px auto 0; padding:0 24px; }
.breadcrumbs { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:14px; }
.crumb { background:#161b22; border:1px solid #30363d; padding:4px 10px; border-radius:4px; font-size:11px; color:#8b949e; font-variant-numeric:tabular-nums; }
.crumb.on { background:#39FF14; color:#0b0f14; border-color:#39FF14; font-weight:600; }
.crumb.result { background:#f85149; color:#fff; border-color:#f85149; font-weight:600; }

.step-card { background:#161b22; border:1px solid #30363d; border-radius:8px; padding:24px; }
.step-num { display:inline-block; background:#39FF14; color:#0b0f14; padding:3px 10px; border-radius:4px; font-size:11px; font-weight:700; letter-spacing:1px; }
.step-card h2 { margin:10px 0 14px; font-size:22px; line-height:1.3; }
.why { background:#0d1117; border-left:3px solid #d29922; padding:10px 14px; margin:0 0 14px; font-size:13px; line-height:1.55; color:#c9d1d9; border-radius:0 4px 4px 0; }
.tools { background:#0d1117; border-radius:6px; padding:10px 14px; margin-bottom:14px; font-size:13px; }
.tools strong { color:#39FF14; font-size:11px; letter-spacing:1px; text-transform:uppercase; }
.tools ul { margin:6px 0 0; padding-left:20px; color:#c9d1d9; }
.tools li { margin-bottom:3px; }
.procedure { background:#0d1117; border-radius:6px; padding:10px 14px; margin-bottom:18px; font-size:13px; }
.procedure strong { color:#39FF14; font-size:11px; letter-spacing:1px; text-transform:uppercase; }
.procedure ol { margin:6px 0 0; padding-left:22px; color:#c9d1d9; }
.procedure li { margin-bottom:6px; line-height:1.55; }
.question { font-size:16px; font-weight:600; margin:18px 0 10px; color:#fff; }
.outcomes { display:grid; gap:8px; }
.out { text-align:left; background:#0d1117; border:1px solid #30363d; color:#e6edf3; padding:14px 16px; border-radius:6px; cursor:pointer; font-size:14px; line-height:1.4; transition:all .15s; font-family:inherit; }
.out:hover { transform:translateX(4px); }
.out.out-good { border-left:4px solid #39FF14; }
.out.out-warn { border-left:4px solid #d29922; }
.out.out-bad { border-left:4px solid #f85149; }
.out.out-neutral { border-left:4px solid #58a6ff; }
.out-good:hover { background:#0e2818; }
.out-warn:hover { background:#2a200a; }
.out-bad:hover { background:#2d1213; }
.out-neutral:hover { background:#0d1c2d; }

.result-card { background:linear-gradient(135deg,#1c2128,#161b22); border:1px solid #f85149; border-radius:8px; padding:28px; }
.result-tag { display:inline-block; background:#f85149; color:#fff; padding:3px 12px; border-radius:4px; font-size:10px; font-weight:700; letter-spacing:2px; }
.result-card h2 { margin:12px 0 14px; font-size:24px; line-height:1.3; color:#fff; }
.result-body { font-size:15px; line-height:1.6; color:#c9d1d9; margin:0 0 16px; }
.result-action { background:#0d1117; border-left:3px solid #39FF14; padding:12px 16px; border-radius:0 4px 4px 0; font-size:14px; color:#c9d1d9; line-height:1.5; }
.result-action strong { color:#39FF14; }

.wizard-nav { display:flex; gap:10px; margin-top:16px; }
.wizard-nav button { background:#161b22; border:1px solid #30363d; color:#e6edf3; padding:10px 18px; border-radius:6px; cursor:pointer; font-size:13px; font-family:inherit; }
.wizard-nav button:hover:not(:disabled) { background:#1c2128; }
.wizard-nav button:disabled { opacity:.4; cursor:not-allowed; }

.tree { max-width:1100px; margin:24px auto 0; padding:0 24px; }
.tree-step { display:flex; gap:14px; background:#161b22; border:1px solid #30363d; border-radius:8px; padding:18px; margin-bottom:12px; }
.tree-num { background:#39FF14; color:#0b0f14; height:30px; min-width:50px; padding:0 8px; border-radius:4px; font-size:11px; font-weight:700; display:flex; align-items:center; justify-content:center; letter-spacing:1px; }
.tree-body { flex:1; }
.tree-body h3 { margin:2px 0 6px; font-size:16px; }
.tree-why { color:#8b949e; font-size:12px; margin:0 0 8px; line-height:1.5; }
.tree-q { font-weight:600; font-size:13px; color:#fff; margin-bottom:6px; }
.tree-out { list-style:none; padding:0; margin:0; }
.tree-out li { display:flex; align-items:flex-start; gap:8px; padding:6px 0; font-size:12px; color:#c9d1d9; line-height:1.5; }
.tree-out .bullet { display:inline-block; width:8px; height:8px; border-radius:50%; margin-top:5px; flex:none; }
li.out-good .bullet { background:#39FF14; }
li.out-warn .bullet { background:#d29922; }
li.out-bad .bullet { background:#f85149; }
li.out-neutral .bullet { background:#58a6ff; }
.tree-out .label { font-weight:500; }
.tree-out .arrow { color:#6e7681; margin:0 4px; }
.tree-out .target a { color:#58a6ff; text-decoration:none; }
.tree-out .target a:hover { text-decoration:underline; }
.tree-out .target em { color:#f85149; font-style:normal; }

.ram-foot { max-width:1100px; margin:40px auto 0; padding:20px 24px 0; border-top:1px solid #30363d; color:#6e7681; font-size:11px; line-height:1.7; }
.ram-foot code { background:#0d1117; padding:2px 6px; border-radius:3px; color:#8b949e; font-size:10px; }

@media (max-width:700px) {
  .ram-hdr h1 { font-size:19px; }
  .step-card { padding:16px; }
  .step-card h2 { font-size:18px; }
  .result-card { padding:18px; }
  .tree-step { flex-direction:column; }
}
`;
