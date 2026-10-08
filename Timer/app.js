/**
 * CHRONO — Main Application Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- State ---
  const state = {
    mode: 'duration', // 'duration' | 'target'
    totalSeconds: 25 * 60,
    remainingSeconds: 25 * 60,
    isRunning: false,
    timerInterval: null,
    taskName: 'Фокусная сессия',
    theme: localStorage.getItem('chrono_theme') || 'dark',
    targetEvent: {
      title: localStorage.getItem('chrono_target_title') || 'Новый Год',
      date: localStorage.getItem('chrono_target_date') || getDefaultNewYearDate()
    },
    targetInterval: null
  };

  // --- DOM Elements ---
  // Headers & Global
  const htmlEl = document.documentElement;
  const tabDuration = document.getElementById('tabDuration');
  const tabTarget = document.getElementById('tabTarget');
  const durationView = document.getElementById('durationView');
  const targetView = document.getElementById('targetView');
  const soundToggleBtn = document.getElementById('soundToggleBtn');
  const soundIconOn = document.getElementById('soundIconOn');
  const soundIconOff = document.getElementById('soundIconOff');
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const themeIconDark = document.getElementById('themeIconDark');
  const themeIconLight = document.getElementById('themeIconLight');
  const fullscreenToggleBtn = document.getElementById('fullscreenToggleBtn');
  const fsEnterIcon = document.getElementById('fsEnterIcon');
  const fsExitIcon = document.getElementById('fsExitIcon');

  // Duration Timer Elements
  const timerTag = document.getElementById('timerTag');
  const hoursVal = document.getElementById('hoursVal');
  const minsVal = document.getElementById('minsVal');
  const secsVal = document.getElementById('secsVal');
  const groupHours = document.getElementById('groupHours');
  const colon1 = document.getElementById('colon1');
  const percentLabel = document.getElementById('percentLabel');
  const finishTimeEstimated = document.getElementById('finishTimeEstimated');
  const togglePlayBtn = document.getElementById('togglePlayBtn');
  const playIcon = document.getElementById('playIcon');
  const pauseIcon = document.getElementById('pauseIcon');
  const playBtnText = document.getElementById('playBtnText');
  const resetBtn = document.getElementById('resetBtn');
  const openPickerBtn = document.getElementById('openPickerBtn');
  const presetCards = document.querySelectorAll('.preset-card');
  const nudgeChips = document.querySelectorAll('.nudge-chip');
  const linearProgressBar = document.getElementById('linearProgressBar');
  const brandIconEl = document.querySelector('.brand-icon');

  // Target Date Elements
  const eventTitleInput = document.getElementById('eventTitleInput');
  const eventDateTimeInput = document.getElementById('eventDateTimeInput');
  const saveEventBtn = document.getElementById('saveEventBtn');
  const setNewYearPresetBtn = document.getElementById('setNewYearPresetBtn');
  const setTonightPresetBtn = document.getElementById('setTonightPresetBtn');
  const targetActiveTitleDisplay = document.getElementById('targetActiveTitleDisplay');
  const tDays = document.getElementById('tDays');
  const tHours = document.getElementById('tHours');
  const tMinutes = document.getElementById('tMinutes');
  const tSeconds = document.getElementById('tSeconds');
  const targetFormattedDate = document.getElementById('targetFormattedDate');

  // Custom Time Picker Modal
  const pickerModal = document.getElementById('pickerModal');
  const closePickerBtn = document.getElementById('closePickerBtn');
  const cancelPickerBtn = document.getElementById('cancelPickerBtn');
  const applyPickerBtn = document.getElementById('applyPickerBtn');
  const inputHours = document.getElementById('inputHours');
  const inputMinutes = document.getElementById('inputMinutes');
  const inputSeconds = document.getElementById('inputSeconds');
  const stepperArrows = document.querySelectorAll('.stepper-arrow');
  const modalQuickTags = document.querySelectorAll('.quick-tag');

  // Celebration Modal
  const celebrationModal = document.getElementById('celebrationModal');
  const celebrationTaskName = document.getElementById('celebrationTaskName');
  const dismissCelebrationBtn = document.getElementById('dismissCelebrationBtn');
  const repeatTimerBtn = document.getElementById('repeatTimerBtn');

  // Footer & Audio
  const tickingSoundToggle = document.getElementById('tickingSoundToggle');
  const testSoundBtn = document.getElementById('testSoundBtn');

  // Web Notification Prompt
  const notifyPrompt = document.getElementById('notifyPrompt');
  const allowNotifyBtn = document.getElementById('allowNotifyBtn');
  const closeNotifyBtn = document.getElementById('closeNotifyBtn');

  // --- Duration Timer Logic & Fast Lookup (Zero Allocations) ---
  const PAD_TABLE = Array.from({ length: 100 }, (_, i) => (i < 10 ? '0' + i : '' + i));
  function pad(n) {
    return n >= 0 && n < 100 ? PAD_TABLE[n] : (n < 10 ? '0' + n : '' + n);
  }

  function formatHumanDuration(totalSec) {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h} ч ${m > 0 ? m + ' мин' : ''}`.trim();
    if (m > 0) return `${m} мин${s > 0 ? ' ' + s + ' сек' : ''}`;
    return `${s} сек`;
  }

  // Dirty-tracking cache to eliminate redundant layout reflows and repaints
  let lastHrs = '', lastMins = '', lastSecs = '';
  let lastPercent = '', lastFinishTime = '', lastTitle = '';

  // --- Dynamic Favicon Engine ---
  const dynamicFavicon = document.getElementById('dynamicFavicon');
  const favCanvas = document.createElement('canvas');
  favCanvas.width = 32;
  favCanvas.height = 32;
  const favCtx = favCanvas.getContext('2d');
  let lastFavKey = '';

  function updateDynamicFavicon(remainingSec, totalSec, isRunning) {
    if (!dynamicFavicon) return;

    // When reset or idle, restore default brand icon
    if (!isRunning && remainingSec === totalSec) {
      if (lastFavKey !== '__default__') {
        dynamicFavicon.href = 'icon.png';
        lastFavKey = '__default__';
      }
      return;
    }

    let text;
    if (remainingSec === 0) {
      text = '✓';
    } else if (remainingSec < 60) {
      text = `${remainingSec}s`;
    } else {
      const mins = Math.ceil(remainingSec / 60);
      text = mins > 99 ? '99+' : `${mins}m`;
    }

    const favKey = `${text}_${isRunning ? 1 : 0}`;
    if (lastFavKey === favKey) return;
    lastFavKey = favKey;

    favCtx.clearRect(0, 0, 32, 32);

    // Dark circular background
    favCtx.fillStyle = '#0b0e14';
    favCtx.beginPath();
    favCtx.arc(16, 16, 15, 0, Math.PI * 2);
    favCtx.fill();

    // Subtle track
    favCtx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    favCtx.lineWidth = 3;
    favCtx.beginPath();
    favCtx.arc(16, 16, 13, 0, Math.PI * 2);
    favCtx.stroke();

    // Progress arc
    const progress = totalSec > 0 ? (remainingSec / totalSec) : 0;
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + (Math.PI * 2 * progress);
    favCtx.strokeStyle = isRunning ? '#38bdf8' : '#f59e0b';
    favCtx.lineWidth = 3;
    favCtx.beginPath();
    favCtx.arc(16, 16, 13, startAngle, endAngle, false);
    favCtx.stroke();

    // Text in center
    favCtx.fillStyle = '#FFFFFF';
    favCtx.textAlign = 'center';
    favCtx.textBaseline = 'middle';
    favCtx.font = text.length > 2 ? 'bold 10px sans-serif' : 'bold 12px sans-serif';
    favCtx.fillText(text, 16, 16);

    dynamicFavicon.href = favCanvas.toDataURL('image/png');
  }

  // --- Helper: Default Next New Year Date ---
  function getDefaultNewYearDate() {
    const now = new Date();
    const nextYear = now.getFullYear() + 1;
    return `${nextYear}-01-01T00:00`;
  }

  // --- Theme Handling ---
  function initTheme() {
    htmlEl.setAttribute('data-theme', state.theme);
    updateThemeIcons();
  }

  function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    htmlEl.setAttribute('data-theme', state.theme);
    localStorage.setItem('chrono_theme', state.theme);
    updateThemeIcons();
  }

  function updateThemeIcons() {
    if (state.theme === 'dark') {
      themeIconDark.classList.remove('hidden');
      themeIconLight.classList.add('hidden');
    } else {
      themeIconDark.classList.add('hidden');
      themeIconLight.classList.remove('hidden');
    }
  }

  // --- Mode Switching ---
  function switchMode(newMode) {
    state.mode = newMode;
    if (newMode === 'duration') {
      tabDuration.classList.add('active');
      tabTarget.classList.remove('active');
      durationView.classList.add('active');
      targetView.classList.remove('active');
      if (state.targetInterval) {
        clearInterval(state.targetInterval);
        state.targetInterval = null;
      }
      updateDurationDisplay(true);
    } else {
      tabTarget.classList.add('active');
      tabDuration.classList.remove('active');
      targetView.classList.add('active');
      durationView.classList.remove('active');
      startTargetCountdown();
    }
  }

  function updateDurationDisplay(force = false) {
    const total = state.remainingSeconds;
    const hrs = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const secs = total % 60;

    const hStr = pad(hrs);
    const mStr = pad(mins);
    const sStr = pad(secs);

    if (force || (document.activeElement !== hoursVal && lastHrs !== hStr)) {
      hoursVal.value = hStr;
      lastHrs = hStr;
    }
    if (force || (document.activeElement !== minsVal && lastMins !== mStr)) {
      minsVal.value = mStr;
      lastMins = mStr;
    }
    if (force || (document.activeElement !== secsVal && lastSecs !== sStr)) {
      secsVal.value = sStr;
      lastSecs = sStr;
    }

    // Hide hours if zero to keep clock clean, but keep full opacity if focused
    const isHoursFocused = document.activeElement === hoursVal;
    const hoursOpacity = (hrs === 0 && !isHoursFocused) ? '0.4' : '1';
    if (groupHours.style.opacity !== hoursOpacity) {
      groupHours.style.opacity = hoursOpacity;
      colon1.style.opacity = hoursOpacity;
    }

    // Percent Calculation
    const percent = state.totalSeconds > 0 
      ? Math.round((state.remainingSeconds / state.totalSeconds) * 100) 
      : 0;
    const percentStr = `${percent}%`;
    if (force || lastPercent !== percentStr) {
      percentLabel.textContent = percentStr;
      lastPercent = percentStr;
    }

    // Estimated finish time or idle duration
    if (state.isRunning && state.remainingSeconds > 0) {
      const finishDate = new Date(Date.now() + state.remainingSeconds * 1000);
      const finishHours = pad(finishDate.getHours());
      const finishMins = pad(finishDate.getMinutes());
      const finishStr = `завершится в ${finishHours}:${finishMins}`;
      if (force || lastFinishTime !== finishStr) {
        finishTimeEstimated.textContent = finishStr;
        lastFinishTime = finishStr;
      }
    } else if (state.remainingSeconds > 0) {
      const idleStr = `длительность: ${formatHumanDuration(state.remainingSeconds)}`;
      if (force || lastFinishTime !== idleStr) {
        finishTimeEstimated.textContent = idleStr;
        lastFinishTime = idleStr;
      }
    } else if (lastFinishTime !== 'завершено') {
      finishTimeEstimated.textContent = 'завершено';
      lastFinishTime = 'завершено';
    }

    // Update Linear Bar
    if (linearProgressBar) {
      linearProgressBar.style.width = `${percent}%`;
    }

    // Tab Title (only when on duration mode)
    if (state.mode === 'duration') {
      const timeFormatted = `${hrs > 0 ? hStr + ':' : ''}${mStr}:${sStr}`;
      const newTitle = state.isRunning 
        ? `(${timeFormatted}) ${state.taskName} — TIMER PRO` 
        : `TIMER PRO — Таймер`;
      if (force || lastTitle !== newTitle) {
        document.title = newTitle;
        lastTitle = newTitle;
      }

      // Dynamic Browser Tab Favicon
      updateDynamicFavicon(state.remainingSeconds, state.totalSeconds, state.isRunning);
    }
  }

  function startDurationTimer() {
    if (state.remainingSeconds <= 0) {
      state.remainingSeconds = state.totalSeconds;
    }
    state.isRunning = true;
    updatePlayButtonUI();
    document.body.classList.remove('is-paused');
    if (brandIconEl) brandIconEl.classList.add('is-running');

    // Web Audio Context unlock on user gesture
    if (window.chronoSound) {
      window.chronoSound.init();
    }

    // Drift-free wall clock end timestamp
    state.endTime = performance.now() + state.remainingSeconds * 1000;

    clearInterval(state.timerInterval);
    state.timerInterval = setInterval(() => {
      const now = performance.now();
      const remaining = Math.max(0, Math.ceil((state.endTime - now) / 1000));

      if (remaining !== state.remainingSeconds) {
        state.remainingSeconds = remaining;
        updateDurationDisplay();

        // Optional ticking sound
        if (window.chronoSound && remaining > 0) {
          window.chronoSound.playTick();
        }

        if (remaining === 0) {
          onDurationFinished();
        }
      }
    }, 250); // Frequent poll prevents background tab drift while skipping redundant renders
  }

  function pauseDurationTimer() {
    state.isRunning = false;
    clearInterval(state.timerInterval);
    updatePlayButtonUI();
    document.body.classList.add('is-paused');
    if (brandIconEl) brandIconEl.classList.remove('is-running');
    updateDurationDisplay();
  }

  function resetDurationTimer() {
    pauseDurationTimer();
    if (brandIconEl) brandIconEl.classList.remove('is-running');
    state.remainingSeconds = state.totalSeconds;
    updateDurationDisplay();
  }

  function togglePlay() {
    if (state.isRunning) {
      pauseDurationTimer();
    } else {
      startDurationTimer();
    }
  }

  function updatePlayButtonUI() {
    if (state.isRunning) {
      playIcon.classList.add('hidden');
      pauseIcon.classList.remove('hidden');
      playBtnText.textContent = 'Пауза';
      togglePlayBtn.style.background = '#f59e0b';
      togglePlayBtn.style.color = '#FFFFFF';
    } else {
      playIcon.classList.remove('hidden');
      pauseIcon.classList.add('hidden');
      playBtnText.textContent = 'Старт';
      togglePlayBtn.style.background = '';
      togglePlayBtn.style.color = '';
    }
  }

  function onDurationFinished() {
    pauseDurationTimer();
    
    // Play harmonic chime
    if (window.chronoSound) {
      window.chronoSound.playChime();
    }

    // Confetti burst
    if (window.chronoConfetti) {
      window.chronoConfetti.burst(150);
    }

    // Browser Notification
    triggerNotification(`Время вышло: ${state.taskName}!`, 'Ваш таймер успешно завершен.');

    // Show celebration modal
    celebrationTaskName.textContent = `Задача «${state.taskName}» завершена. Сделайте перерыв или начните новый цикл!`;
    celebrationModal.classList.add('active');
  }

  // --- Quick Nudge (+1m, +5m, +10m) ---
  nudgeChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const addSeconds = parseInt(chip.getAttribute('data-add'), 10);
      state.remainingSeconds += addSeconds;
      state.totalSeconds += addSeconds;
      if (state.isRunning && state.endTime) {
        state.endTime += addSeconds * 1000;
      }
      updateDurationDisplay(true);

      // Micro button animation
      chip.style.transform = 'scale(1.15)';
      setTimeout(() => chip.style.transform = '', 150);
    });
  });

  // --- Direct Click & Edit on Time Digits ---
  const digitInputsConfig = [
    { el: hoursVal, max: 99, next: minsVal },
    { el: minsVal, max: 59, next: secsVal },
    { el: secsVal, max: 59, next: null }
  ];

  function commitTimeFromDigits() {
    let h = parseInt(hoursVal.value, 10);
    let m = parseInt(minsVal.value, 10);
    let s = parseInt(secsVal.value, 10);

    if (isNaN(h)) h = 0;
    if (isNaN(m)) m = 0;
    if (isNaN(s)) s = 0;

    h = Math.max(0, Math.min(99, h));
    m = Math.max(0, Math.min(59, m));
    s = Math.max(0, Math.min(59, s));

    const total = h * 3600 + m * 60 + s;
    if (total > 0) {
      state.totalSeconds = total;
      state.remainingSeconds = total;
      presetCards.forEach(c => c.classList.remove('active'));
    } else {
      // Prevent invalid 00:00:00 timer - default to 1 min
      h = 0;
      m = 1;
      s = 0;
      state.totalSeconds = 60;
      state.remainingSeconds = 60;
    }

    hoursVal.value = pad(h);
    minsVal.value = pad(m);
    secsVal.value = pad(s);
    lastHrs = pad(h);
    lastMins = pad(m);
    lastSecs = pad(s);

    if (state.isRunning) {
      state.endTime = performance.now() + state.remainingSeconds * 1000;
    }

    updateDurationDisplay(true);
  }

  digitInputsConfig.forEach(({ el, max, next }) => {
    if (!el) return;

    // Click & Focus: pause running timer and select all text
    el.addEventListener('focus', () => {
      if (state.isRunning) {
        pauseDurationTimer();
      }
      setTimeout(() => el.select(), 20);
    });

    el.addEventListener('click', () => {
      el.select();
    });

    // Clean input and auto-advance when 2 digits are typed
    el.addEventListener('input', () => {
      el.value = el.value.replace(/\D/g, '');
      if (el.value.length > 2) {
        el.value = el.value.slice(-2);
      }
      if (el.value.length === 2 && next) {
        commitTimeFromDigits();
        next.focus();
        next.select();
      }
    });

    // Arrow keys, Enter, Escape, Colon
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        el.blur();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        updateDurationDisplay();
        el.blur();
      } else if (e.key === ':' && next) {
        e.preventDefault();
        commitTimeFromDigits();
        next.focus();
        next.select();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        let val = (parseInt(el.value, 10) || 0) + 1;
        if (val > max) val = 0;
        el.value = pad(val);
        commitTimeFromDigits();
        el.select();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        let val = (parseInt(el.value, 10) || 0) - 1;
        if (val < 0) val = max;
        el.value = pad(val);
        commitTimeFromDigits();
        el.select();
      }
    });

    // On blur: validate, pad and commit
    el.addEventListener('blur', () => {
      commitTimeFromDigits();
    });

    // Mouse wheel: scroll up to increase, scroll down to decrease
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (state.isRunning) {
        pauseDurationTimer();
      }
      const dir = e.deltaY < 0 ? 1 : -1;
      let val = (parseInt(el.value, 10) || 0) + dir;
      if (val > max) val = 0;
      if (val < 0) val = max;
      el.value = pad(val);
      commitTimeFromDigits();
    }, { passive: false });
  });

  // --- Presets Click ---
  presetCards.forEach(card => {
    card.addEventListener('click', () => {
      const sec = parseInt(card.getAttribute('data-seconds'), 10);
      const label = card.getAttribute('data-label');

      presetCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');

      pauseDurationTimer();
      state.totalSeconds = sec;
      state.remainingSeconds = sec;
      if (label) {
        state.taskName = label;
        timerTag.textContent = label;
      }
      updateDurationDisplay(true);
    });
  });

  // --- Custom Time Picker Modal ---
  function openPicker() {
    const hrs = Math.floor(state.remainingSeconds / 3600);
    const mins = Math.floor((state.remainingSeconds % 3600) / 60);
    const secs = state.remainingSeconds % 60;

    inputHours.value = hrs;
    inputMinutes.value = mins;
    inputSeconds.value = secs;

    pickerModal.classList.add('active');
  }

  function closePicker() {
    pickerModal.classList.remove('active');
  }

  function applyCustomTime() {
    let h = parseInt(inputHours.value, 10) || 0;
    let m = parseInt(inputMinutes.value, 10) || 0;
    let s = parseInt(inputSeconds.value, 10) || 0;

    // Validate bounds
    h = Math.max(0, Math.min(99, h));
    m = Math.max(0, Math.min(59, m));
    s = Math.max(0, Math.min(59, s));

    const total = h * 3600 + m * 60 + s;
    if (total <= 0) {
      inputSeconds.value = 30;
      return;
    }

    pauseDurationTimer();
    state.totalSeconds = total;
    state.remainingSeconds = total;
    
    // Clear active preset highlight
    presetCards.forEach(c => c.classList.remove('active'));

    updateDurationDisplay(true);
    closePicker();
  }

  // Submit modal on Enter inside any picker input
  [inputHours, inputMinutes, inputSeconds].forEach(input => {
    if (!input) return;
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        applyCustomTime();
      }
    });
  });

  stepperArrows.forEach(btn => {
    btn.addEventListener('click', () => {
      const field = btn.getAttribute('data-field');
      const dir = parseInt(btn.getAttribute('data-dir'), 10);
      let input;
      let max;

      if (field === 'hours') { input = inputHours; max = 99; }
      else if (field === 'minutes') { input = inputMinutes; max = 59; }
      else { input = inputSeconds; max = 59; }

      let val = (parseInt(input.value, 10) || 0) + dir;
      if (val < 0) val = max;
      if (val > max) val = 0;
      input.value = val;
    });
  });

  modalQuickTags.forEach(tag => {
    tag.addEventListener('click', () => {
      inputHours.value = tag.getAttribute('data-h');
      inputMinutes.value = tag.getAttribute('data-m');
      inputSeconds.value = tag.getAttribute('data-s');
    });
  });

  // --- Editable Timer Tag ---
  timerTag.addEventListener('blur', () => {
    const text = timerTag.textContent.trim();
    if (text) {
      state.taskName = text;
    } else {
      timerTag.textContent = state.taskName;
    }
    updateDurationDisplay(true);
  });

  timerTag.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      timerTag.blur();
    }
  });

  // --- Target Date Countdown Logic ---
  function initTargetView() {
    eventTitleInput.value = state.targetEvent.title;
    eventDateTimeInput.value = state.targetEvent.date;
    renderTargetDateInfo();
  }

  function renderTargetDateInfo() {
    targetActiveTitleDisplay.textContent = `До события «${state.targetEvent.title}» осталось:`;
    const d = new Date(state.targetEvent.date);
    if (!isNaN(d.getTime())) {
      targetFormattedDate.textContent = d.toLocaleString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  }

  function startTargetCountdown() {
    clearInterval(state.targetInterval);
    updateTargetCountdown();
    state.targetInterval = setInterval(updateTargetCountdown, 1000);
  }

  function updateTargetCountdown() {
    if (!state.targetEvent.date) return;
    const targetTime = new Date(state.targetEvent.date).getTime();
    const now = Date.now();
    const diff = targetTime - now;

    if (diff <= 0) {
      tDays.textContent = '00';
      tHours.textContent = '00';
      tMinutes.textContent = '00';
      tSeconds.textContent = '00';
      targetActiveTitleDisplay.textContent = `Событие «${state.targetEvent.title}» наступило! 🎉`;
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    tDays.textContent = pad(days);
    tHours.textContent = pad(hours);
    tMinutes.textContent = pad(minutes);
    tSeconds.textContent = pad(seconds);

    if (state.mode === 'target') {
      document.title = `(${days}д ${hours}ч ${minutes}м) ${state.targetEvent.title} — TIMER PRO`;
    }
  }

  function saveTargetEvent() {
    const title = eventTitleInput.value.trim() || 'Событие';
    const dateVal = eventDateTimeInput.value;

    if (!dateVal) {
      alert('Пожалуйста, выберите дату и время');
      return;
    }

    state.targetEvent.title = title;
    state.targetEvent.date = dateVal;
    localStorage.setItem('chrono_target_title', title);
    localStorage.setItem('chrono_target_date', dateVal);

    renderTargetDateInfo();
    startTargetCountdown();
  }

  setNewYearPresetBtn.addEventListener('click', () => {
    const ny = getDefaultNewYearDate();
    eventTitleInput.value = 'Новый Год';
    eventDateTimeInput.value = ny;
    saveTargetEvent();
  });

  setTonightPresetBtn.addEventListener('click', () => {
    const now = new Date();
    now.setHours(18, 0, 0, 0);
    // If already past 18:00 today, set to tomorrow 18:00
    if (now.getTime() <= Date.now()) {
      now.setDate(now.getDate() + 1);
    }
    const year = now.getFullYear();
    const month = pad(now.getMonth() + 1);
    const day = pad(now.getDate());
    const dateStr = `${year}-${month}-${day}T18:00`;

    eventTitleInput.value = 'Конец рабочего дня';
    eventDateTimeInput.value = dateStr;
    saveTargetEvent();
  });

  // --- Fullscreen Zen Mode ---
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      document.body.classList.add('fullscreen-mode');
      fsEnterIcon.classList.add('hidden');
      fsExitIcon.classList.remove('hidden');
    } else {
      document.exitFullscreen().catch(() => {});
      document.body.classList.remove('fullscreen-mode');
      fsEnterIcon.classList.remove('hidden');
      fsExitIcon.classList.add('hidden');
    }
  }

  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
      document.body.classList.remove('fullscreen-mode');
      fsEnterIcon.classList.remove('hidden');
      fsExitIcon.classList.add('hidden');
    }
  });

  // --- Audio Toggles ---
  soundToggleBtn.addEventListener('click', () => {
    if (!window.chronoSound) return;
    const isMuted = window.chronoSound.toggleMute();
    if (isMuted) {
      soundIconOn.classList.add('hidden');
      soundIconOff.classList.remove('hidden');
    } else {
      soundIconOn.classList.remove('hidden');
      soundIconOff.classList.add('hidden');
      window.chronoSound.playChime();
    }
  });

  tickingSoundToggle.addEventListener('change', (e) => {
    if (window.chronoSound) {
      window.chronoSound.setTicking(e.target.checked);
      if (e.target.checked) {
        window.chronoSound.playTick();
      }
    }
  });

  testSoundBtn.addEventListener('click', () => {
    if (window.chronoSound) {
      window.chronoSound.playChime();
    }
  });

  // --- Web Notification System ---
  function checkNotificationStatus() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      setTimeout(() => {
        notifyPrompt.classList.remove('hidden');
      }, 3000);
    }
  }

  allowNotifyBtn.addEventListener('click', () => {
    if ('Notification' in window) {
      Notification.requestPermission().then(() => {
        notifyPrompt.classList.add('hidden');
      });
    }
  });

  closeNotifyBtn.addEventListener('click', () => {
    notifyPrompt.classList.add('hidden');
  });

  function triggerNotification(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, { body });
      } catch (e) {
        console.warn('Notification error:', e);
      }
    }
  }

  // --- Event Listeners ---
  // Mode Tabs
  tabDuration.addEventListener('click', () => switchMode('duration'));
  tabTarget.addEventListener('click', () => switchMode('target'));

  // Header Actions
  themeToggleBtn.addEventListener('click', toggleTheme);
  fullscreenToggleBtn.addEventListener('click', toggleFullscreen);

  // Timer Main Buttons
  togglePlayBtn.addEventListener('click', togglePlay);
  resetBtn.addEventListener('click', resetDurationTimer);
  openPickerBtn.addEventListener('click', openPicker);

  // Modal Actions
  closePickerBtn.addEventListener('click', closePicker);
  cancelPickerBtn.addEventListener('click', closePicker);
  applyPickerBtn.addEventListener('click', applyCustomTime);
  pickerModal.addEventListener('click', (e) => {
    if (e.target === pickerModal) closePicker();
  });

  // Celebration Modal
  dismissCelebrationBtn.addEventListener('click', () => {
    celebrationModal.classList.remove('active');
  });
  repeatTimerBtn.addEventListener('click', () => {
    celebrationModal.classList.remove('active');
    resetDurationTimer();
    startDurationTimer();
  });
  celebrationModal.addEventListener('click', (e) => {
    if (e.target === celebrationModal) {
      celebrationModal.classList.remove('active');
    }
  });

  // Save Event Button
  saveEventBtn.addEventListener('click', saveTargetEvent);

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    // If typing in an input or contenteditable, don't trigger global shortcuts
    if (e.target.tagName === 'INPUT' || e.target.isContentEditable) {
      return;
    }

    if (e.code === 'Space') {
      e.preventDefault();
      if (state.mode === 'duration') {
        togglePlay();
      }
    } else if (e.key === 'r' || e.key === 'к' || e.key === 'R' || e.key === 'К') {
      if (state.mode === 'duration') {
        resetDurationTimer();
      }
    } else if (e.key === 'f' || e.key === 'а' || e.key === 'F' || e.key === 'А') {
      toggleFullscreen();
    } else if (e.key === 'm' || e.key === 'ь' || e.key === 'M' || e.key === 'Ь') {
      soundToggleBtn.click();
    } else if (e.key === 'Escape') {
      closePicker();
      celebrationModal.classList.remove('active');
    }
  });

  // --- PWA Installation & Service Worker ---
  const installPwaBtn = document.getElementById('installPwaBtn');
  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installPwaBtn) {
      installPwaBtn.classList.remove('hidden');
    }
  });

  if (installPwaBtn) {
    installPwaBtn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      try {
        const choice = await deferredPrompt.userChoice;
        if (choice && choice.outcome === 'accepted') {
          installPwaBtn.classList.add('hidden');
        }
      } catch (_) {}
      deferredPrompt = null;
    });
  }

  window.addEventListener('appinstalled', () => {
    if (installPwaBtn) {
      installPwaBtn.classList.add('hidden');
    }
    deferredPrompt = null;
  });

  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }

  // --- Initialize Setup (after all DOM handlers & functions are registered) ---
  initTheme();
  updateDurationDisplay(true);
  initTargetView();
  checkNotificationStatus();
});
