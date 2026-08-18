/**
 * Tests for the ticket status-change safety matrix.
 * Run: node --experimental-strip-types tests/ticket-status-matrix.test.mjs
 */
import assert from 'node:assert';
import { evaluateMove, allowedTargets } from '../lib/ticket-status-matrix.ts';

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log(`  ok  ${name}`); }
  catch (e) { fail++; console.log(`FAIL  ${name}\n      ${e.message}`); }
}

// ── Within-zone moves are allowed ──────────────────────────────────────────
t('pre-zone forward move allowed for driver', () => {
  const r = evaluateMove('created', 'materials_pulled', 'driver');
  assert.equal(r.ok, true);
  assert.equal(r.requiresReason, false);
});
t('pre-zone backward move requires reason + supervisor', () => {
  assert.equal(evaluateMove('materials_pulled', 'created', 'driver').ok, false); // driver can't go back
  const r = evaluateMove('materials_pulled', 'created', 'office');
  assert.equal(r.ok, true);
  assert.equal(r.requiresReason, true);
});
t('post-zone forward move allowed for driver', () => {
  const r = evaluateMove('en_route', 'arrived', 'driver');
  assert.equal(r.ok, true);
  assert.equal(r.requiresReason, false);
});
t('post-zone backward move requires reason + supervisor', () => {
  assert.equal(evaluateMove('delivered', 'en_route', 'driver').ok, false);
  const r = evaluateMove('delivered', 'en_route', 'admin');
  assert.equal(r.ok, true);
  assert.equal(r.requiresReason, true);
});

// ── Boundary crossings are refused via set-status ──────────────────────────
t('PRE -> load_verified refused (use verify-load)', () => {
  const r = evaluateMove('materials_pulled', 'load_verified', 'admin');
  assert.equal(r.ok, false);
  assert.match(r.hint || '', /Verify Load/i);
});
t('POST -> PRE refused (use undo-verify-load)', () => {
  const r = evaluateMove('load_verified', 'materials_pulled', 'admin');
  assert.equal(r.ok, false);
  assert.match(r.hint || '', /Undo verify-load/i);
});

// ── Cancel rules ───────────────────────────────────────────────────────────
t('cancel from PRE allowed for office (with reason)', () => {
  const r = evaluateMove('assigned', 'cancelled', 'office');
  assert.equal(r.ok, true);
  assert.equal(r.requiresReason, true);
});
t('cancel from POST refused (must undo-verify first)', () => {
  const r = evaluateMove('load_verified', 'cancelled', 'admin');
  assert.equal(r.ok, false);
  assert.match(r.hint || '', /Undo verify-load/i);
});
t('driver cannot cancel', () => {
  assert.equal(evaluateMove('created', 'cancelled', 'driver').ok, false);
});

// ── Reopen ─────────────────────────────────────────────────────────────────
t('reopen cancelled -> created for office', () => {
  assert.equal(evaluateMove('cancelled', 'created', 'office').ok, true);
  assert.equal(evaluateMove('cancelled', 'en_route', 'office').ok, false);
});

// ── Role gate + no-op ──────────────────────────────────────────────────────
t('sales/viewer cannot operate', () => {
  assert.equal(evaluateMove('created', 'assigned', 'sales').ok, false);
  assert.equal(evaluateMove('created', 'assigned', 'viewer').ok, false);
});
t('same-status is rejected', () => {
  assert.equal(evaluateMove('created', 'created', 'admin').ok, false);
});

// ── allowedTargets sanity ──────────────────────────────────────────────────
t('allowedTargets from created (office) = other pre + cancelled, no post', () => {
  const targets = allowedTargets('created', 'office');
  assert.ok(targets.includes('assigned'));
  assert.ok(targets.includes('materials_pulled'));
  assert.ok(targets.includes('cancelled'));
  assert.ok(!targets.includes('load_verified'));
  assert.ok(!targets.includes('en_route'));
});
t('allowedTargets from load_verified (admin) = other post only, no pre/cancel', () => {
  const targets = allowedTargets('load_verified', 'admin');
  assert.ok(targets.includes('en_route'));
  assert.ok(targets.includes('delivered'));
  assert.ok(!targets.includes('materials_pulled'));
  assert.ok(!targets.includes('cancelled'));
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
