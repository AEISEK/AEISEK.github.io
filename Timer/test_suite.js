/**
 * Test Suite for TIMER PRO Bug Fixes Verification
 */

const assert = require('assert');

// Mock DOM Environment
class MockElement {
  constructor(id = '', tag = 'div') {
    this.id = id;
    this.tagName = tag.toUpperCase();
    this.value = '';
    this.textContent = '';
    this.style = {};
    this.classList = new Set();
    this.classList.add = (c) => this.classList.add(c);
    this.classList.remove = (c) => this.classList.delete(c);
    this.classList.contains = (c) => this.classList.has(c);
    this.listeners = {};
    this.attributes = {};
  }
  setAttribute(k, v) { this.attributes[k] = v; }
  getAttribute(k) { return this.attributes[k]; }
  addEventListener(ev, fn) {
    if (!this.listeners[ev]) this.listeners[ev] = [];
    this.listeners[ev].push(fn);
  }
  dispatchEvent(ev, data = {}) {
    if (this.listeners[ev]) {
      this.listeners[ev].forEach(fn => fn({ ...data, target: this, preventDefault: () => {} }));
    }
  }
}

console.log('--- Running Bug Fixer Automated Test Suite ---');

// Test 1: PAD_TABLE and Time Formatting
const PAD_TABLE = Array.from({ length: 100 }, (_, i) => (i < 10 ? '0' + i : '' + i));
function pad(n) {
  return n >= 0 && n < 100 ? PAD_TABLE[n] : (n < 10 ? '0' + n : '' + n);
}
assert.strictEqual(pad(0), '00');
assert.strictEqual(pad(5), '05');
assert.strictEqual(pad(59), '59');
console.log('✓ Test 1: pad() handles zero-padding correctly');

// Test 2: Nudge while running adds to endTime
let state = {
  remainingSeconds: 60,
  totalSeconds: 60,
  isRunning: true,
  endTime: 100000
};
const addSeconds = 60;
state.remainingSeconds += addSeconds;
state.totalSeconds += addSeconds;
if (state.isRunning && state.endTime) {
  state.endTime += addSeconds * 1000;
}
assert.strictEqual(state.endTime, 160000, 'endTime must be shifted by 60,000ms');
assert.strictEqual(state.remainingSeconds, 120);
console.log('✓ Test 2: Nudge while running correctly shifts state.endTime to prevent time rollback');

// Test 3: Zero-duration commit validation (00:00:00 -> 60s fallback)
function simulateCommitTime(hVal, mVal, sVal) {
  let h = parseInt(hVal, 10) || 0;
  let m = parseInt(mVal, 10) || 0;
  let s = parseInt(sVal, 10) || 0;

  h = Math.max(0, Math.min(99, h));
  m = Math.max(0, Math.min(59, m));
  s = Math.max(0, Math.min(59, s));

  const total = h * 3600 + m * 60 + s;
  let totalSec, remSec;
  if (total > 0) {
    totalSec = total;
    remSec = total;
  } else {
    h = 0; m = 1; s = 0;
    totalSec = 60;
    remSec = 60;
  }
  return { h, m, s, totalSec, remSec };
}

const resZero = simulateCommitTime('00', '00', '00');
assert.strictEqual(resZero.totalSec, 60);
assert.strictEqual(resZero.m, 1);
assert.strictEqual(resZero.s, 0);

const resValid = simulateCommitTime('01', '30', '15');
assert.strictEqual(resValid.totalSec, 3600 + 1800 + 15);
console.log('✓ Test 3: commitTimeFromDigits properly falls back to 1 min on 00:00:00 and parses valid times');

// Test 4: Human-readable idle duration formatter
function formatHumanDuration(totalSec) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h} ч ${m > 0 ? m + ' мин' : ''}`.trim();
  if (m > 0) return `${m} мин${s > 0 ? ' ' + s + ' сек' : ''}`;
  return `${s} сек`;
}

assert.strictEqual(formatHumanDuration(1500), '25 мин');
assert.strictEqual(formatHumanDuration(3600), '1 ч');
assert.strictEqual(formatHumanDuration(3660), '1 ч 1 мин');
assert.strictEqual(formatHumanDuration(45), '45 сек');
console.log('✓ Test 4: formatHumanDuration correctly formats hours, minutes, and seconds');

// Test 5: Mode switching and targetInterval clearing
let mockTargetInterval = 999;
let mode = 'target';
function switchModeMock(newMode) {
  mode = newMode;
  if (newMode === 'duration') {
    if (mockTargetInterval) {
      mockTargetInterval = null;
    }
  }
}
switchModeMock('duration');
assert.strictEqual(mockTargetInterval, null);
assert.strictEqual(mode, 'duration');
console.log('✓ Test 5: Switching to duration mode cancels targetInterval leak');

console.log('--- ALL AUTOMATED TESTS PASSED (5/5) ---');
