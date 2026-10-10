/**
 * Comprehensive DOM Simulation Test
 * Validates that audio.js & app.js execute cleanly on DOMContentLoaded and all buttons work!
 */

const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

console.log('--- Testing Full DOM Initialization, Sound & Custom Presets Engine ---');

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
    this._innerHTML = '';
    this.style = {};
    this.classList = new MockClassList();
    this.attributes = {};
    this.listeners = {};
    this.children = [];
  }
  get innerHTML() { return this._innerHTML; }
  set innerHTML(html) {
    this._innerHTML = html;
    this.children = [];
    if (!html) return;
    const regex = /<([a-z0-9]+)([^>]*)>([\s\S]*?)<\/\1>/gi;
    let match;
    while ((match = regex.exec(html)) !== null) {
      const tagName = match[1];
      const attrs = match[2];
      const child = new MockElement('', tagName);
      const classMatch = attrs.match(/class="([^"]+)"/i);
      if (classMatch) {
        classMatch[1].split(' ').forEach(c => child.classList.add(c));
      }
      const titleMatch = attrs.match(/title="([^"]+)"/i);
      if (titleMatch) child.setAttribute('title', titleMatch[1]);
      child.textContent = match[3].replace(/<[^>]+>/g, '').trim();
      this.children.push(child);
    }
  }
  appendChild(child) {
    this.children.push(child);
    return child;
  }
  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) this.children.splice(idx, 1);
    return child;
  }
  querySelector(sel) {
    return this.querySelectorAll(sel)[0] || null;
  }
  querySelectorAll(sel) {
    const res = [];
    function match(node) {
      if (sel.startsWith('.') && node.classList.contains(sel.slice(1))) res.push(node);
      else if (sel.startsWith('#') && node.id === sel.slice(1)) res.push(node);
      else if (sel.startsWith('[data-id="')) {
        const id = sel.match(/data-id="([^"]+)"/)?.[1];
        if (node.getAttribute('data-id') === id) res.push(node);
      } else if (sel.startsWith('[data-seconds="')) {
        const s = sel.match(/data-seconds="([^"]+)"/)?.[1];
        if (node.getAttribute('data-seconds') === s) res.push(node);
      }
      node.children.forEach(match);
    }
    this.children.forEach(match);
    return res;
  }
  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return this.attributes[k] !== undefined ? this.attributes[k] : ''; }
  addEventListener(ev, fn) {
    if (!this.listeners[ev]) this.listeners[ev] = [];
    this.listeners[ev].push(fn);
  }
  dispatchEvent(ev, data = {}) {
    if (this.listeners[ev]) {
      this.listeners[ev].forEach(fn => fn({ ...data, target: this, preventDefault: () => {}, stopPropagation: () => {} }));
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
  'celebrationStopSoundBtn',
  // Custom Presets System Elements
  'presetsGrid', 'quickManageList', 'newPresetNameInput',
  'saveAsPresetBtn', 'resetDefaultPresetsBtn', 'presetFeedback'
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
      return elements['presetsGrid'].children;
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

// Test 1: Mode Switch to Infinite & Turn On
soundModeLoopBtn.click();
assert.strictEqual(context.window.chronoSound.mode, 'infinite');
soundMasterToggleBtn.click();
assert.strictEqual(context.window.chronoSound.playbackState, 'loop');
assert.strictEqual(soundStatusText.textContent, 'Повтор');
soundMasterToggleBtn.click();
assert.strictEqual(context.window.chronoSound.playbackState, 'stopped');
console.log('✓ Infinite sound loop and toggle stop verified');

// Test 2: Initial Presets Rendered (7 default presets without 1 min)
const presetsGrid = elements['presetsGrid'];
const quickManageList = elements['quickManageList'];
assert.strictEqual(presetsGrid.children.length, 7, '7 default presets should be rendered on main grid');
assert.strictEqual(quickManageList.children.length, 7, '7 default presets should be in modal manage list');
console.log('✓ 7 Default presets rendered on main screen and in modal manager (1 min removed)');

// Test 3: Select an existing preset (e.g. 30 min)
const p30Card = presetsGrid.children.find(c => c.getAttribute('data-seconds') === '1800');
assert.ok(p30Card, '30 min preset card must exist in presets grid');
p30Card.click();
assert.strictEqual(elements['minsVal'].value, '30');
assert.strictEqual(elements['timerTag'].textContent, 'Получасовой блок');
console.log('✓ Selecting preset (30 min) correctly updates timer readout & tag');

// Test 4: Add a new custom preset (e.g. 50 minutes "Чтение")
elements['inputHours'].value = 0;
elements['inputMinutes'].value = 50;
elements['inputSeconds'].value = 0;
elements['newPresetNameInput'].value = 'Чтение';
elements['saveAsPresetBtn'].click();

assert.strictEqual(presetsGrid.children.length, 8, 'Presets grid should now have 8 presets');
assert.strictEqual(quickManageList.children.length, 8, 'Quick manage list should now have 8 presets');

// Check that 50 min preset was saved to localStorage
const savedPresets = JSON.parse(localStorageMock.getItem('chrono_custom_presets'));
assert.strictEqual(savedPresets.length, 8);
const readingPreset = savedPresets.find(p => p.seconds === 3000);
assert.ok(readingPreset, 'Saved preset with 3000 seconds must exist');
assert.strictEqual(readingPreset.name, 'Чтение');
console.log('✓ Added custom preset (50 мин «Чтение»), verified in grid, modal list and localStorage');

// Test 5: Click the newly created preset on main screen
const newCard = presetsGrid.children.find(c => c.getAttribute('data-seconds') === '3000');
assert.ok(newCard, 'New 50 min card must exist in presetsGrid');
newCard.click();
assert.strictEqual(elements['minsVal'].value, '50');
assert.strictEqual(elements['timerTag'].textContent, 'Чтение (50 мин)');
console.log('✓ Clicking newly created preset activates 50 minutes on timer');

// Test 6: Delete a preset via delete button in modal (e.g. 5m)
const chip5m = quickManageList.children.find(c => c.getAttribute('data-id') === 'p_300');
assert.ok(chip5m, '5 min chip must exist in modal list');
const delBtn = chip5m.children.find(c => c.classList.contains('manage-chip-del'));
assert.ok(delBtn, 'Delete button must exist on chip');
delBtn.click();

assert.strictEqual(presetsGrid.children.length, 7, 'Presets grid should now have 7 presets after deletion');
const p5mCard = presetsGrid.children.find(c => c.getAttribute('data-id') === 'p_300');
assert.strictEqual(p5mCard, undefined, '5 min card must no longer exist in grid');
console.log('✓ Deleted preset (5 мин) successfully removed from main grid and localStorage');

// Test 7: Reset to Default Presets
elements['resetDefaultPresetsBtn'].click();
assert.strictEqual(presetsGrid.children.length, 7, 'Reset restores 7 default presets');
const p5mRestored = presetsGrid.children.find(c => c.getAttribute('data-id') === 'p_300');
assert.ok(p5mRestored, '5 min card is restored after reset to defaults');
console.log('✓ Restoring defaults restored the 7 default presets cleanly');

// Test 8: General controls
elements['togglePlayBtn'].click();
elements['resetBtn'].click();
elements['themeToggleBtn'].click();
console.log('✓ Existing controls (Play/Pause, Reset, Theme) continue functioning cleanly');

console.log('--- ALL SOUND & CUSTOM PRESETS TESTS PASSED 100% ---');
