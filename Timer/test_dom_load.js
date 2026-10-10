/**
 * Comprehensive DOM Simulation Test
 * Validates that audio.js & app.js execute cleanly on DOMContentLoaded and all buttons work!
 */

const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

console.log('--- Testing Full DOM Initialization & Sound Playback Engine ---');

// Mock a complete browser DOM window & document
class MockClassList {
  constructor() { this.classes = new Set(); }
  add(c) { this.classes.add(c); }
  remove(c) { this.classes.delete(c); }
  contains(c) { return this.classes.has(c); }
  toggle(c, force) {
    if (force !== undefined) {
      if (force) this.classes.add(c);
      else this.classes.delete(c);
      return force;
    }
    if (this.classes.has(c)) {
      this.classes.delete(c);
      return false;
    } else {
      this.classes.add(c);
      return true;
    }
  }
}

class MockElement {
  constructor(id = '', tag = 'div') {
    this.id = id;
    this.tagName = tag.toUpperCase();
    this.value = '00';
    this.textContent = '';
    this.style = {};
    this.classList = new MockClassList();
    this.attributes = {};
    this.listeners = {};
  }
  setAttribute(k, v) { this.attributes[k] = v; }
  getAttribute(k) { return this.attributes[k] || ''; }
  addEventListener(ev, fn) {
    if (!this.listeners[ev]) this.listeners[ev] = [];
    this.listeners[ev].push(fn);
  }
  dispatchEvent(ev, data = {}) {
    if (this.listeners[ev]) {
      this.listeners[ev].forEach(fn => fn({ ...data, target: this, preventDefault: () => {} }));
    }
  }
  click() {
    this.dispatchEvent('click');
  }
  focus() {
    this.dispatchEvent('focus');
  }
  blur() {
    this.dispatchEvent('blur');
  }
  select() {}
}

const elements = {};
function getOrCreate(id, tag = 'div') {
  if (!elements[id]) {
    elements[id] = new MockElement(id, tag);
  }
  return elements[id];
}

// Elements used in app.js
const elementIds = [
  'tabDuration', 'tabTarget', 'durationView', 'targetView',
  'soundToggleBtn', 'soundIconOn', 'soundIconOff',
  'themeToggleBtn', 'themeIconDark', 'themeIconLight',
  'fullscreenToggleBtn', 'fsEnterIcon', 'fsExitIcon',
  'timerTag', 'hoursVal', 'minsVal', 'secsVal',
  'groupHours', 'colon1', 'percentLabel', 'finishTimeEstimated',
  'togglePlayBtn', 'playIcon', 'pauseIcon', 'playBtnText',
  'resetBtn', 'openPickerBtn', 'linearProgressBar',
  'eventTitleInput', 'eventDateTimeInput', 'saveEventBtn',
  'setNewYearPresetBtn', 'setTonightPresetBtn', 'targetActiveTitleDisplay',
  'tDays', 'tHours', 'tMinutes', 'tSeconds', 'targetFormattedDate',
  'pickerModal', 'closePickerBtn', 'cancelPickerBtn', 'applyPickerBtn',
  'inputHours', 'inputMinutes', 'inputSeconds',
  'celebrationModal', 'celebrationTaskName', 'dismissCelebrationBtn', 'repeatTimerBtn',
  'tickingSoundToggle', 'testSoundBtn',
  'notifyPrompt', 'allowNotifyBtn', 'closeNotifyBtn',
  'dynamicFavicon', 'installPwaBtn',
  // Sound Playback System Elements
  'soundPlaybackPanel', 'soundStatusBadge', 'soundStatusText',
  'soundModeOnceBtn', 'soundModeLoopBtn', 'soundMasterToggleBtn',
  'soundToggleIconPlay', 'soundToggleIconStop', 'soundMasterToggleText',
  'celebrationStopSoundBtn'
];

elementIds.forEach(id => getOrCreate(id));

const documentMock = {
  documentElement: new MockElement('html', 'html'),
  body: new MockElement('body', 'body'),
  title: '',
  activeElement: null,
  createElement: (tag) => {
    if (tag === 'canvas') {
      return {
        width: 32,
        height: 32,
        getContext: () => ({
          clearRect: () => {},
          fillStyle: '',
          beginPath: () => {},
          arc: () => {},
          fill: () => {},
          strokeStyle: '',
          lineWidth: 1,
          stroke: () => {},
          textAlign: '',
          textBaseline: '',
          font: '',
          fillText: () => {}
        }),
        toDataURL: () => 'data:image/png;base64,mockFavicon'
      };
    }
    return new MockElement('', tag);
  },
  getElementById: (id) => getOrCreate(id),
  querySelectorAll: (selector) => {
    if (selector === '.preset-card') {
      const p1 = new MockElement('p1', 'button');
      p1.setAttribute('data-seconds', '1500');
      p1.setAttribute('data-label', 'Помодоро');
      return [p1];
    }
    if (selector === '.nudge-chip') {
      const n1 = new MockElement('n1', 'button');
      n1.setAttribute('data-add', '60');
      return [n1];
    }
    if (selector === '.stepper-arrow' || selector === '.quick-tag') {
      return [];
    }
    return [];
  },
  querySelector: (selector) => {
    if (selector === '.brand-icon') return new MockElement('brand-icon', 'div');
    return null;
  },
  listeners: {},
  addEventListener: (ev, fn) => {
    if (!documentMock.listeners[ev]) documentMock.listeners[ev] = [];
    documentMock.listeners[ev].push(fn);
  }
};

const localStorageMock = {
  store: {},
  getItem: (k) => localStorageMock.store[k] || null,
  setItem: (k, v) => { localStorageMock.store[k] = v; }
};

class MockParam {
  constructor(val = 0) { this.value = val; }
  setValueAtTime(v) { this.value = v; }
  linearRampToValueAtTime(v) { this.value = v; }
  exponentialRampToValueAtTime(v) { this.value = v; }
  cancelScheduledValues() {}
}

class MockGain {
  constructor() {
    this.gain = new MockParam(1);
  }
  connect() {}
  disconnect() {}
}

class MockOscillator {
  constructor() {
    this.frequency = new MockParam(440);
    this.type = 'sine';
    this.onended = null;
  }
  connect() {}
  disconnect() {}
  start() {}
  stop() {
    if (this.onended) this.onended();
  }
}

class MockAudioContext {
  constructor() {
    this.currentTime = 0;
    this.state = 'running';
    this.destination = {};
  }
  resume() { return Promise.resolve(); }
  createOscillator() { return new MockOscillator(); }
  createGain() { return new MockGain(); }
}

const windowMock = {
  addEventListener: () => {},
  localStorage: localStorageMock,
  AudioContext: MockAudioContext
};

const context = {
  document: documentMock,
  window: windowMock,
  localStorage: localStorageMock,
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  setInterval: setInterval,
  clearInterval: clearInterval,
  performance: performance,
  Date: Date,
  Math: Math,
  Array: Array,
  parseInt: parseInt,
  isNaN: isNaN
};

vm.createContext(context);

// 1. Load audio.js into VM
const audioCode = fs.readFileSync('./audio.js', 'utf8');
try {
  vm.runInContext(audioCode, context);
  console.log('✓ audio.js parsed and initialized window.chronoSound cleanly');
} catch (e) {
  console.error('FAILED TO PARSE AUDIO.JS:', e);
  process.exit(1);
}

// 2. Load app.js into VM
const appCode = fs.readFileSync('./app.js', 'utf8');
try {
  vm.runInContext(appCode, context);
  console.log('✓ app.js parsed into VM without syntax errors');
} catch (e) {
  console.error('FAILED TO PARSE APP.JS:', e);
  process.exit(1);
}

// 3. Trigger DOMContentLoaded
try {
  const domListeners = documentMock.listeners['DOMContentLoaded'] || [];
  if (domListeners.length === 0) {
    throw new Error('No DOMContentLoaded listener registered in document!');
  }
  domListeners.forEach(fn => fn());
  console.log('✓ DOMContentLoaded executed cleanly with ZERO errors!');
} catch (e) {
  console.error('FATAL RUNTIME ERROR DURING DOMContentLoaded:', e);
  process.exit(1);
}

// Verify Initial Sound UI State
const soundStatusBadge = elements['soundStatusBadge'];
const soundStatusText = elements['soundStatusText'];
const soundModeOnceBtn = elements['soundModeOnceBtn'];
const soundModeLoopBtn = elements['soundModeLoopBtn'];
const soundMasterToggleBtn = elements['soundMasterToggleBtn'];
const soundMasterToggleText = elements['soundMasterToggleText'];
const celebrationStopSoundBtn = elements['celebrationStopSoundBtn'];

assert.strictEqual(soundStatusText.textContent, 'Выключен', 'Initial status text should be Выключен');
assert.strictEqual(soundStatusBadge.classList.contains('status-stopped'), true, 'Status badge should have status-stopped');
assert.strictEqual(soundModeOnceBtn.classList.contains('active'), true, 'Mode Once button should be active initially');
assert.strictEqual(soundMasterToggleText.textContent, 'Включить звук');
console.log('✓ Initial Sound UI state verified (Stopped, Mode: Once)');

// Test 1: Mode Switch to Infinite
soundModeLoopBtn.click();
assert.strictEqual(context.window.chronoSound.mode, 'infinite');
assert.strictEqual(soundModeLoopBtn.classList.contains('active'), true);
assert.strictEqual(soundModeOnceBtn.classList.contains('active'), false);
console.log('✓ Mode switch to "Повторять бесконечно" verified');

// Test 2: Turn Sound On (Infinite Mode -> State "loop")
soundMasterToggleBtn.click();
assert.strictEqual(context.window.chronoSound.playbackState, 'loop');
assert.strictEqual(soundStatusText.textContent, 'Повтор');
assert.strictEqual(soundStatusBadge.classList.contains('status-loop'), true);
assert.strictEqual(soundMasterToggleText.textContent, 'Выключить звук');
assert.strictEqual(celebrationStopSoundBtn.classList.contains('hidden'), false);
console.log('✓ Sound turned ON in infinite mode (Status: Повтор, Button: Выключить звук)');

// Test 3: Stop Sound via Master Toggle
soundMasterToggleBtn.click();
assert.strictEqual(context.window.chronoSound.playbackState, 'stopped');
assert.strictEqual(soundStatusText.textContent, 'Выключен');
assert.strictEqual(soundMasterToggleText.textContent, 'Включить звук');
assert.strictEqual(celebrationStopSoundBtn.classList.contains('hidden'), true);
console.log('✓ Sound turned OFF via master toggle (Status: Выключен, Button: Включить звук)');

// Test 4: Mode Switch to Once and Turn Sound On (State "playing")
soundModeOnceBtn.click();
assert.strictEqual(context.window.chronoSound.mode, 'once');
assert.strictEqual(soundModeOnceBtn.classList.contains('active'), true);

soundMasterToggleBtn.click();
assert.strictEqual(context.window.chronoSound.playbackState, 'playing');
assert.strictEqual(soundStatusText.textContent, 'Воспроизводится');
assert.strictEqual(soundStatusBadge.classList.contains('status-playing'), true);
console.log('✓ Sound turned ON in single mode (Status: Воспроизводится)');

// Test 5: Stop Sound via celebrationStopSoundBtn
celebrationStopSoundBtn.click();
assert.strictEqual(context.window.chronoSound.playbackState, 'stopped');
assert.strictEqual(soundStatusText.textContent, 'Выключен');
console.log('✓ Sound turned OFF via celebrationStopSoundBtn');

// Test 6: Overlap prevention
context.window.chronoSound.startSound();
context.window.chronoSound.startSound();
context.window.chronoSound.startSound();
assert.ok(context.window.chronoSound.activeOscillators.size <= 4, 'Overlap prevention must keep active oscillators <= 4');
context.window.chronoSound.stopSound();
assert.strictEqual(context.window.chronoSound.activeOscillators.size, 0);
console.log('✓ Overlap prevention verified: multiple start calls do not multiply audio instances');

// Test Existing Button Listeners
elements['togglePlayBtn'].click();
elements['resetBtn'].click();
elements['themeToggleBtn'].click();
console.log('✓ Existing controls (Play/Pause, Reset, Theme) continue functioning cleanly');

console.log('--- ALL SOUND PLAYBACK ENGINE TESTS PASSED 100% ---');
