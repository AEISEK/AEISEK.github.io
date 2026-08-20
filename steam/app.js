(function () {
  "use strict";

  /* =========================================================
     ДАННЫЕ О РАСПРОДАЖАХ
     Единственное место, где нужно менять даты/названия.
     Формат start/end — ISO-строки в UTC (Z), время начала
     Steam-событий — 10:00 по тихоокеанскому времени (Pacific).
     В будущем этот объект можно заменить результатом fetch()
     к вашему API/JSON без изменения остального кода.
     Источник: официальный календарь Valve (Steamworks) на 2026 год.
  ========================================================= */
  /* =========================================================
     ИСТОЧНИК ДАННЫХ (опционально)
     Если указать сюда URL, отдающий JSON вида
     { "major": [...], "minor": [...] } (та же схема, что ниже
     в FALLBACK_SALES_DATA), сайт при загрузке попробует
     подтянуть данные оттуда и подставить вместо резервных.

     Важно: у Valve нет официального публичного API с датами
     будущих распродаж, а сам браузер не может напрямую
     обратиться к store.steampowered.com из-за CORS. Поэтому
     URL ниже должен указывать на JSON-файл, который вы сами
     публикуете в месте, поддерживающем CORS для GET-запросов
     (например: raw.githubusercontent.com, Cloudflare Pages/
     Workers, S3 с включённым CORS, свой бэкенд с заголовком
     Access-Control-Allow-Origin). Наполнять этот JSON можно
     вручную или скриптом scrape-steam-sales.mjs (см. отдельный
     файл) — оба варианта не требуют правок этого сайта.
  ========================================================= */
  const DATA_SOURCE_URL = null; // например: "https://raw.githubusercontent.com/USER/REPO/main/data.json"
  const DATA_FETCH_TIMEOUT_MS = 6000;
  const DATA_REFRESH_INTERVAL_MS = 15 * 60 * 1000; // повторная проверка раз в 15 минут

  const FALLBACK_SALES_DATA = {
    major: [
      {
        id: "autumn-2026",
        name: "Осенняя распродажа Steam 2026",
        start: "2026-10-01T17:00:00Z",
        end: "2026-10-08T17:00:00Z",
        desc: "Одна из четырёх больших сезонных распродаж года — скидки на тысячи игр всех жанров."
      },
      {
        id: "winter-2026",
        name: "Зимняя распродажа Steam 2026",
        start: "2026-12-17T18:00:00Z",
        end: "2027-01-04T18:00:00Z",
        desc: "Главное событие года: самая долгая и обычно самая масштабная распродажа Steam."
      },
      {
        id: "spring-2027",
        name: "Весенняя распродажа Steam 2027",
        start: "2027-03-18T17:00:00Z",
        end: "2027-03-25T17:00:00Z",
        desc: "Весенняя сезонная распродажа. Дата предварительная — Valve может её скорректировать.",
        approximate: true
      }
    ],
    minor: [
      {
        id: "pins-pegs-2026",
        name: "Фестиваль «Пины и колышки» Steam",
        start: "2026-08-17T17:00:00Z",
        end: "2026-08-20T17:00:00Z",
        desc: "Тематический ивент: пинболы, пачинко, боулинг и игры с похожей механикой."
      },
      {
        id: "pve-survival-2026",
        name: "Фестиваль PvE-выживания и крафта Steam",
        start: "2026-08-31T17:00:00Z",
        end: "2026-09-07T17:00:00Z",
        desc: "Скидки на выживалки и крафтовые игры против враждебной среды."
      },
      {
        id: "programming-2026",
        name: "Фестиваль программирования Steam",
        start: "2026-09-10T17:00:00Z",
        end: "2026-09-14T17:00:00Z",
        desc: "Игры о программировании, логике и головоломках на основе кода."
      },
      {
        id: "party-rpg-2026",
        name: "Фестиваль отрядных RPG Steam",
        start: "2026-09-14T17:00:00Z",
        end: "2026-09-21T17:00:00Z",
        desc: "Ролевые игры с отрядом персонажей и пошаговыми/тактическими боями."
      },
      {
        id: "cooking-2026",
        name: "Кулинарный фестиваль Steam",
        start: "2026-10-12T17:00:00Z",
        end: "2026-10-19T17:00:00Z",
        desc: "Кулинарные симуляторы и игры про рестораны и готовку."
      },
      {
        id: "scream-2026",
        name: "Хэллоуинский фестиваль ужасов Steam",
        start: "2026-10-26T17:00:00Z",
        end: "2026-11-02T17:00:00Z",
        desc: "Хэллоуинский ивент: скидки на хорроры и мистические игры."
      },
      {
        id: "autobattler-2026",
        name: "Фестиваль авто-баттлеров Steam",
        start: "2026-11-16T18:00:00Z",
        end: "2026-11-23T18:00:00Z",
        desc: "Авто-баттлеры и тактические RPG с автоматическими сражениями."
      }
    ]
  };

  // Рабочая копия данных — на старте равна резервным,
  // может быть заменена результатом loadSalesData().
  let SALES_DATA = FALLBACK_SALES_DATA;
  let dataSourceStatus = { mode: "fallback", updatedAt: null, error: null };

  function isValidSalesPayload(payload) {
    if (!payload || typeof payload !== "object") return false;
    for (const key of ["major", "minor"]) {
      if (!Array.isArray(payload[key])) return false;
      for (const ev of payload[key]) {
        if (!ev || typeof ev !== "object") return false;
        if (!ev.id || !ev.name || !ev.start || !ev.end) return false;
        if (isNaN(new Date(ev.start).getTime())) return false;
        if (isNaN(new Date(ev.end).getTime())) return false;
      }
    }
    // хотя бы одно событие в каждой категории — иначе от источника нет пользы
    return payload.major.length > 0 && payload.minor.length > 0;
  }

  async function fetchWithTimeout(url, ms) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), ms);
    try {
      const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(t);
    }
  }

  async function loadSalesData() {
    if (!DATA_SOURCE_URL) {
      SALES_DATA = FALLBACK_SALES_DATA;
      dataSourceStatus = { mode: "fallback", updatedAt: null, error: null };
      return;
    }
    try {
      const payload = await fetchWithTimeout(DATA_SOURCE_URL, DATA_FETCH_TIMEOUT_MS);
      if (!isValidSalesPayload(payload)) {
        throw new Error("Некорректная структура JSON");
      }
      SALES_DATA = payload;
      dataSourceStatus = { mode: "live", updatedAt: new Date(), error: null };
    } catch (err) {
      // Источник недоступен/сломан — тихо остаёмся на резервных данных,
      // но честно показываем это в интерфейсе.
      SALES_DATA = FALLBACK_SALES_DATA;
      dataSourceStatus = { mode: "fallback", updatedAt: null, error: err.message || String(err) };
    }
  }

  function renderDataStatus() {
    const el = document.getElementById("data-status");
    if (!el) return;
    if (dataSourceStatus.mode === "live") {
      el.textContent = `Источник: внешний JSON · обновлено ${dataSourceStatus.updatedAt.toLocaleTimeString("ru-RU")}`;
      el.classList.remove("is-fallback");
    } else if (DATA_SOURCE_URL) {
      el.textContent = `Источник: резервные данные (внешний JSON недоступен: ${dataSourceStatus.error})`;
      el.classList.add("is-fallback");
    } else {
      el.textContent = `Источник: демонстрационные данные (DATA_SOURCE_URL не задан)`;
      el.classList.add("is-fallback");
    }
  }

  const MS = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function now() {
    return new Date();
  }

  // Возвращает "текущее" (идущее прямо сейчас) или ближайшее будущее событие из списка
  function pickEvent(list) {
    const t = now();
    const sorted = [...list].sort((a, b) => new Date(a.start) - new Date(b.start));
    const live = sorted.find(e => new Date(e.start) <= t && t < new Date(e.end));
    if (live) return { event: live, phase: "live" };
    const upcoming = sorted.find(e => new Date(e.start) > t);
    if (upcoming) return { event: upcoming, phase: "upcoming" };
    // всё в прошлом — вернём последнее как fallback
    return { event: sorted[sorted.length - 1], phase: "past" };
  }

  const dtFormatter = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  function formatRange(startISO, endISO) {
    const s = new Date(startISO),
      e = new Date(endISO);
    return `${dtFormatter.format(s)} — ${dtFormatter.format(e)} (ваше локальное время)`;
  }

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function diffParts(targetMs) {
    let diff = Math.max(0, targetMs - now().getTime());
    const d = Math.floor(diff / MS.d);
    diff -= d * MS.d;
    const h = Math.floor(diff / MS.h);
    diff -= h * MS.h;
    const m = Math.floor(diff / MS.m);
    diff -= m * MS.m;
    const s = Math.floor(diff / MS.s);
    return { d, h, m, s };
  }

  function renderClock(cardKey, targetMs) {
    const parts = diffParts(targetMs);
    const root = $(`#clock-${cardKey}`);
    root.querySelector('[data-u="d"]').textContent = pad(parts.d);
    root.querySelector('[data-u="h"]').textContent = pad(parts.h);
    root.querySelector('[data-u="m"]').textContent = pad(parts.m);
    root.querySelector('[data-u="s"]').textContent = pad(parts.s);
    return parts;
  }

  function icsDate(iso) {
    return iso.replace(/[-:]/g, "").replace(".000Z", "Z");
  }

  function downloadICS(ev) {
    const uid = ev.id + "@seiltreker";
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//СейлТрекер//RU",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${icsDate(new Date().toISOString())}`,
      `DTSTART:${icsDate(ev.start)}`,
      `DTEND:${icsDate(ev.end)}`,
      `SUMMARY:${ev.name}`,
      `DESCRIPTION:${(ev.desc || "").replace(/\n/g, " ")}`,
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\r\n");
    const blob = new Blob([ics], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = ev.id + ".ics";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  let state = { major: null, minor: null };

  function setupCard(kind) {
    const picked = pickEvent(SALES_DATA[kind]);
    state[kind] = picked;
    const { event, phase } = picked;

    $(`#name-${kind}`).textContent = event.name;
    $(`#desc-${kind}`).textContent = event.desc + (event.approximate ? " Дата предварительная." : "");
    $(`#date-${kind}`).textContent = formatRange(event.start, event.end);

    const pill = $(`#pill-${kind}`);
    const card = $(`#card-${kind}`);
    card.classList.remove("active-now");

    if (phase === "live") {
      pill.textContent = "Идёт сейчас";
      pill.classList.add("live");
      card.classList.add("active-now");
      $(`#note-${kind}`).textContent = "До окончания:";
    } else {
      pill.classList.remove("live");
      pill.textContent = kind === "major" ? "Крупная распродажа" : "Тематический ивент";
      $(`#note-${kind}`).textContent = "До начала:";
    }
  }

  function tickCard(kind) {
    const { event, phase } = state[kind];
    const target = phase === "live" ? new Date(event.end).getTime() : new Date(event.start).getTime();
    const parts = renderClock(kind, target);

    // Если время истекло — пересчитать событие (переход live->следующее, upcoming->live)
    if (parts.d === 0 && parts.h === 0 && parts.m === 0 && parts.s === 0) {
      setupCard(kind);
    }
    return parts;
  }

  function checkUrgency() {
    const banner = $("#urgent-banner");
    const text = $("#urgent-text");
    const candidates = [];

    ["major", "minor"].forEach(kind => {
      const { event, phase } = state[kind];
      if (phase !== "upcoming") return;
      const msLeft = new Date(event.start) - now();
      if (msLeft > 0 && msLeft <= 24 * MS.h) {
        candidates.push(`«${event.name}» начнётся менее чем через 24 часа`);
      }
    });

    if (candidates.length) {
      text.innerHTML = `<strong>Скоро старт!</strong> ${candidates.join(" · ")}`;
      banner.classList.add("show");
    } else {
      banner.classList.remove("show");
    }
  }

  function tick() {
    tickCard("major");
    tickCard("minor");
    checkUrgency();
  }

  // ---------- Timeline (список ближайших событий) ----------
  function buildTimeline(filter) {
    const t = now();
    const all = [
      ...SALES_DATA.major.map(e => ({ ...e, kind: "major" })),
      ...SALES_DATA.minor.map(e => ({ ...e, kind: "minor" }))
    ]
      .filter(e => new Date(e.end) > t)
      .filter(e => (filter === "all" ? true : e.kind === filter))
      .sort((a, b) => new Date(a.start) - new Date(b.start));

    const root = $("#timeline");
    root.innerHTML = "";

    if (!all.length) {
      root.innerHTML = `<div class="tl-item"><div class="tl-desc">Событий не найдено.</div></div>`;
      return;
    }

    all.forEach(e => {
      const isLive = new Date(e.start) <= t && t < new Date(e.end);
      const item = document.createElement("div");
      item.className = `tl-item ${e.kind}${isLive ? " is-live" : ""}`;
      const kindLabel = e.kind === "major" ? "Крупная" : "Небольшая";
      item.innerHTML = `
        <div class="tl-row">
          <div class="tl-name">${e.name}${isLive ? '<span class="tl-badge">идёт сейчас</span>' : ""}</div>
          <div class="tl-date">${kindLabel} · ${formatRange(e.start, e.end)}</div>
        </div>
        <div class="tl-desc">${e.desc}${e.approximate ? " <em>(дата предварительная)</em>" : ""}</div>
      `;
      root.appendChild(item);
    });
  }

  // ---------- Tabs ----------
  $$(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      $$(".tab").forEach(t => {
        t.classList.remove("active");
        t.setAttribute("aria-selected", "false");
      });
      tab.classList.add("active");
      tab.setAttribute("aria-selected", "true");
      buildTimeline(tab.dataset.tab);
    });
  });

  // ---------- Calendar buttons ----------
  $$("[data-ics]").forEach(btn => {
    btn.addEventListener("click", () => {
      const kind = btn.dataset.ics;
      downloadICS(state[kind].event);
    });
  });

  // ---------- Init ----------
  async function init() {
    await loadSalesData();
    renderDataStatus();
    setupCard("major");
    setupCard("minor");
    buildTimeline(document.querySelector(".tab.active")?.dataset.tab || "all");
    tick();
    setInterval(tick, 1000);

    if (DATA_SOURCE_URL) {
      setInterval(async () => {
        const prevMode = dataSourceStatus.mode;
        await loadSalesData();
        renderDataStatus();
        setupCard("major");
        setupCard("minor");
        buildTimeline(document.querySelector(".tab.active")?.dataset.tab || "all");
        if (prevMode !== dataSourceStatus.mode) {
          checkUrgency();
        }
      }, DATA_REFRESH_INTERVAL_MS);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
