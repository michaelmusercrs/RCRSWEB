/**
 * Owner Setup Checklist API
 *
 * GET /api/admin/owner-setup-checklist
 *
 * Parses OWNER-SETUP.md at runtime (server-side fs read), plus
 * docs/sweep-branches-inert-check.md and docs/2026-05-20-verification-pass.md
 * for cross-referenced "open findings" + sweep-branch awaiting-review status.
 *
 * Used by:
 *   - /admin/dashboard (Insights & next actions column)
 *   - /admin/system/health (Setup checklist section)
 *
 * Read-only: no Sheets / no KV / no JN calls. Pure markdown parsing.
 *
 * Parsing strategy:
 *   - OWNER-SETUP.md steps: heading-split on /^## (\xe2\x98\x90|\xe2\x98\x91) (\d+)\. (.+)$/
 *     (the `☐` / `☑` checkbox glyphs are followed by step number,
 *     then a dot and the title). Body text up to the next `## ` heading
 *     (or `---` horizontal rule) is captured as the expandable content.
 *   - Sweep-branches: parse the verdict table for branches whose verdict
 *     is NOT "INERT" (i.e. awaiting owner review).
 *   - Verification pass: parse the Optimizations table (O1\xe2\x80\xa6On) and the
 *     Loopholes numbered list; pull the top-5 by severity ordering present
 *     in the doc.
 */

import { NextResponse } from 'next/server';
import { requireRoleAtLeast } from '@/lib/auth-service';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OwnerSetupStep {
  /** Step number from the heading (1, 2, 3, ...) */
  number: number;
  /** Step title from the heading */
  title: string;
  /** Markdown body of the step (everything until the next heading or `---`) */
  body: string;
  /** True if the heading uses the checked-box glyph in the source file */
  markedDone: boolean;
  /** Any `[needs-owner]` strings spotted inside the body — surfaced as warning. */
  needsOwnerFlags: string[];
  /** Heuristic check name (kebab-case) we map to system-health subsystems. */
  checkKey: 'resend' | 'turnstile' | 'kv' | 'dead-code-triage' | 'dead-domain' | 'unknown';
}

export interface SweepBranchAwaiting {
  branch: string;
  verdict: string;
  notes: string;
}

export interface OpenFinding {
  /** Stable id (e.g. "O1", "H2", "C1") */
  id: string;
  /** One-line description */
  title: string;
  /** Tag (severity / category — "CRITICAL", "HIGH", "MEDIUM", "LOW", "OPT") */
  tag: string;
}

export interface OwnerSetupChecklistResponse {
  source: {
    ownerSetupPath: string;
    sweepBranchesPath: string | null;
    verificationPassPath: string | null;
  };
  steps: OwnerSetupStep[];
  sweepBranchesAwaiting: SweepBranchAwaiting[];
  topFindings: OpenFinding[];
  generatedAt: string;
}

// ─── File helpers ─────────────────────────────────────────────────────────────

function tryReadFile(absPath: string): string | null {
  try {
    return fs.readFileSync(absPath, 'utf-8');
  } catch {
    return null;
  }
}

function projectRoot(): string {
  // Next.js runs the API with process.cwd() = project root.
  return process.cwd();
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

/**
 * Parse OWNER-SETUP.md into an ordered list of steps.
 *
 * The source uses headings like:
 *   ## ☐ 1. Resend — turn email back on
 *   ## ☑ 2. Already-done item
 * The first character after `## ` is either `☐` (U+2610) or `☑` (U+2611);
 * we use that to decide `markedDone`. Everything between this heading and the
 * next `## ` heading (or a `---` horizontal rule) is captured as the body.
 */
function parseOwnerSetup(md: string): OwnerSetupStep[] {
  const lines = md.split(/\r?\n/);
  const headingRe = /^## ([☐☑])\s*(\d+)\.\s*(.+?)\s*$/;
  const hrRe = /^---\s*$/;
  const nextHeadingRe = /^##\s/;

  const steps: OwnerSetupStep[] = [];
  let i = 0;
  while (i < lines.length) {
    const m = headingRe.exec(lines[i]);
    if (!m) {
      i++;
      continue;
    }
    const marked = m[1] === '☑';
    const number = parseInt(m[2], 10);
    const title = m[3];
    i++;
    const bodyLines: string[] = [];
    while (i < lines.length && !nextHeadingRe.test(lines[i]) && !hrRe.test(lines[i])) {
      bodyLines.push(lines[i]);
      i++;
    }
    const body = bodyLines.join('\n').trim();
    const needsOwnerFlags = Array.from(
      new Set(
        (body.match(/\[needs-owner[^\]]*\]/g) ?? []).map((s) => s),
      ),
    );
    steps.push({
      number,
      title,
      body,
      markedDone: marked,
      needsOwnerFlags,
      checkKey: mapStepToCheckKey(number, title),
    });
  }
  return steps;
}

function mapStepToCheckKey(num: number, title: string): OwnerSetupStep['checkKey'] {
  const t = title.toLowerCase();
  if (t.includes('resend')) return 'resend';
  if (t.includes('turnstile')) return 'turnstile';
  if (t.includes('kv')) return 'kv';
  if (t.includes('dead-code') || t.includes('triage')) return 'dead-code-triage';
  if (t.includes('dead-domain') || t.includes('typo') || t.includes('domain')) return 'dead-domain';
  // Fallback by ordinal position used by OWNER-SETUP.md today.
  if (num === 1) return 'resend';
  if (num === 2) return 'turnstile';
  if (num === 3) return 'kv';
  if (num === 4) return 'dead-code-triage';
  if (num === 5) return 'dead-domain';
  return 'unknown';
}

/**
 * Parse the sweep-branches-inert-check.md verdict table and surface the
 * non-INERT (awaiting-review) rows.
 *
 * Table shape (markdown):
 *   | Branch | Check | Verdict | Notes |
 *   |---|---|:---:|---|
 *   | `sweep/foo` | ... | **INERT** | ... |
 */
function parseSweepBranches(md: string): SweepBranchAwaiting[] {
  const lines = md.split(/\r?\n/);
  const rows: SweepBranchAwaiting[] = [];
  for (const raw of lines) {
    if (!raw.trim().startsWith('|')) continue;
    const cells = raw.split('|').map((c) => c.trim());
    // Expect: ['', branch, check, verdict, notes, '']  -> 6 entries
    if (cells.length < 6) continue;
    const branchCell = cells[1].replace(/`/g, '');
    if (!branchCell.startsWith('sweep/')) continue;
    const verdictCell = cells[3].replace(/\*\*/g, '');
    if (verdictCell.toUpperCase() === 'INERT') continue;
    rows.push({
      branch: branchCell,
      verdict: verdictCell,
      notes: cells[4],
    });
  }
  return rows;
}

/**
 * Pull the top-5 actionable findings out of the verification-pass doc.
 *
 * Strategy: collect every Markdown subheading shaped like
 *   `### SEVERITY — Cx. Title` or `### SEVERITY — Hx. Title` etc.
 * (the doc uses C/H/M/L prefixes for Critical/High/Medium/Low) plus every
 * Optimization row from the `## Optimizations` table. Severity order:
 * CRITICAL > HIGH > MEDIUM > LOW > OPT. Return up to 5.
 */
function parseTopFindings(md: string): OpenFinding[] {
  const findings: OpenFinding[] = [];

  // Subheadings with severity prefix.
  const subRe = /^###\s+(CRITICAL|HIGH|MEDIUM|LOW)\s+—\s+([A-Z]\d+)\.\s+(.+?)\s*$/;
  for (const line of md.split(/\r?\n/)) {
    const m = subRe.exec(line);
    if (m) {
      findings.push({ id: m[2], title: m[3], tag: m[1] });
    }
  }

  // Optimizations table rows: `| O1 | description | effort | payoff |`
  let inOptTable = false;
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trim();
    if (/^##\s+Optimizations/i.test(line)) {
      inOptTable = true;
      continue;
    }
    if (inOptTable && /^##\s/.test(line)) {
      inOptTable = false;
      continue;
    }
    if (!inOptTable) continue;
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').map((c) => c.trim());
    if (cells.length < 5) continue;
    const id = cells[1];
    if (!/^O\d+$/i.test(id)) continue; // skip header / separator
    const title = cells[2];
    findings.push({ id, title, tag: 'OPT' });
  }

  // Severity rank for sort.
  const rank: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, OPT: 4 };
  findings.sort((a, b) => {
    const ra = rank[a.tag] ?? 99;
    const rb = rank[b.tag] ?? 99;
    if (ra !== rb) return ra - rb;
    // Keep doc order within same severity.
    return 0;
  });

  return findings.slice(0, 5);
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const auth = await requireRoleAtLeast(['owner', 'admin', 'office', 'manager']);
  if (!auth.authenticated) return auth.response;

  const root = projectRoot();
  const ownerSetupPath = path.join(root, 'OWNER-SETUP.md');
  const sweepPath = path.join(root, 'docs', 'sweep-branches-inert-check.md');
  const verificationPath = path.join(root, 'docs', '2026-05-20-verification-pass.md');

  const ownerSetupRaw = tryReadFile(ownerSetupPath);
  const sweepRaw = tryReadFile(sweepPath);
  const verificationRaw = tryReadFile(verificationPath);

  const steps = ownerSetupRaw ? parseOwnerSetup(ownerSetupRaw) : [];
  const sweepBranchesAwaiting = sweepRaw ? parseSweepBranches(sweepRaw) : [];
  const topFindings = verificationRaw ? parseTopFindings(verificationRaw) : [];

  const payload: OwnerSetupChecklistResponse = {
    source: {
      ownerSetupPath: ownerSetupRaw ? 'OWNER-SETUP.md' : '(not found)',
      sweepBranchesPath: sweepRaw ? 'docs/sweep-branches-inert-check.md' : null,
      verificationPassPath: verificationRaw ? 'docs/2026-05-20-verification-pass.md' : null,
    },
    steps,
    sweepBranchesAwaiting,
    topFindings,
    generatedAt: new Date().toISOString(),
  };

  return NextResponse.json(payload, {
    headers: { 'Cache-Control': 'private, max-age=30' },
  });
}
