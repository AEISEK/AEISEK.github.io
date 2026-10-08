/**
 * Advanced Performance Benchmark Suite for TIMER PRO (Phase 1 Baseline & Verification)
 * Measures:
 * 1. Particle Object Pooling vs Heap Allocation Thrashing (50 bursts x 150 particles = 7,500 particles)
 * 2. Confetti Physics Frame Step (1000 frames)
 * 3. Timer Time Readout & Padding Throughput (200,000 iterations)
 * 4. Human Duration Formatter Throughput (100,000 iterations)
 */

const { performance } = require('perf_hooks');

// ========================================================
// 1. Particle Memory Allocation: Non-Pooled vs Pooled
// ========================================================
function benchmarkParticleAllocationNonPooled() {
  const TAU = Math.PI * 2;
  const colors = ['#38bdf8', '#818cf8', '#ec4899', '#f59e0b', '#10b981', '#a855f7'];
  const colorsLen = colors.length;
  
  const start = performance.now();
  let particles = [];
  
  // Simulate 50 bursts of 150 particles with creation and destruction
  for (let b = 0; b < 50; b++) {
    for (let i = 0; i < 150; i++) {
      const angle = Math.random() * TAU;
      const speed = 4 + Math.random() * 12;
      const sizeW = 5 + Math.random() * 6;
      particles.push({
        x: 500,
        y: 400,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        sizeW: sizeW,
        sizeH: sizeW * 0.7,
        color: colors[(Math.random() * colorsLen) | 0],
        rotation: Math.random() * TAU,
        rotationSpeed: (Math.random() - 0.5) * 0.25,
        opacity: 1,
        decay: 0.007 + Math.random() * 0.012
      });
    }
    // Simulate lifecycle end
    particles.length = 0;
  }
  
  return performance.now() - start;
}

function benchmarkParticleAllocationPooled() {
  const TAU = Math.PI * 2;
  const colors = ['#38bdf8', '#818cf8', '#ec4899', '#f59e0b', '#10b981', '#a855f7'];
  const colorsLen = colors.length;
  const pool = [];
  const particles = [];
  
  const start = performance.now();
  
  for (let b = 0; b < 50; b++) {
    for (let i = 0; i < 150; i++) {
      const angle = Math.random() * TAU;
      const speed = 4 + Math.random() * 12;
      const sizeW = 5 + Math.random() * 6;
      
      const p = pool.length > 0 ? pool.pop() : {};
      p.x = 500;
      p.y = 400;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 3;
      p.sizeW = sizeW;
      p.sizeH = sizeW * 0.7;
      p.color = colors[(Math.random() * colorsLen) | 0];
      p.rotation = Math.random() * TAU;
      p.rotationSpeed = (Math.random() - 0.5) * 0.25;
      p.opacity = 1;
      p.decay = 0.007 + Math.random() * 0.012;
      particles.push(p);
    }
    // Recycle to pool
    while (particles.length > 0) {
      if (pool.length < 300) {
        pool.push(particles.pop());
      } else {
        particles.pop();
      }
    }
  }
  
  return performance.now() - start;
}

// ========================================================
// 2. Confetti Physics Simulation (1000 frames)
// ========================================================
function benchmarkConfettiPhysics() {
  const TAU = Math.PI * 2;
  const particles = [];
  const count = 200;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * TAU;
    const speed = 4 + Math.random() * 12;
    particles.push({
      x: 500, y: 400,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 3,
      rotation: Math.random() * TAU,
      rotationSpeed: (Math.random() - 0.5) * 0.25,
      opacity: 1,
      decay: 0.007 + Math.random() * 0.012
    });
  }

  const start = performance.now();
  for (let it = 0; it < 1000; it++) {
    let len = particles.length;
    for (let i = len - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.22;
      p.vx *= 0.98;
      p.rotation += p.rotationSpeed;
      p.opacity -= p.decay;

      if (p.opacity <= 0 || p.y > 1000) {
        particles[i] = particles[--len];
        particles.pop();
      }
    }
    if (particles.length < 50) {
      for (let k = 0; k < 150; k++) {
        particles.push({
          x: 500, y: 400, vx: 2, vy: -2,
          rotation: 0, rotationSpeed: 0.05, opacity: 1, decay: 0.01
        });
      }
    }
  }
  return performance.now() - start;
}

// ========================================================
// 3. Timer Time Readout & Padding (200,000 iterations)
// ========================================================
const PAD_TABLE = Array.from({ length: 100 }, (_, i) => (i < 10 ? '0' + i : '' + i));
function pad(n) {
  return n >= 0 && n < 100 ? PAD_TABLE[n] : (n < 10 ? '0' + n : '' + n);
}

function benchmarkTimerFormatting() {
  const start = performance.now();
  const iterations = 200000;
  let dummy = 0;

  for (let i = 0; i < iterations; i++) {
    const total = i % 86400;
    const hrs = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    const hStr = pad(hrs);
    const mStr = pad(mins);
    const sStr = pad(secs);
    const formatted = `${hrs > 0 ? hStr + ':' : ''}${mStr}:${sStr}`;
    dummy += formatted.length;
  }
  return performance.now() - start;
}

// ========================================================
// 4. Human Duration Formatter (100,000 iterations)
// ========================================================
function formatHumanDuration(totalSec) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h} ч ${m > 0 ? m + ' мин' : ''}`.trim();
  if (m > 0) return `${m} мин${s > 0 ? ' ' + s + ' сек' : ''}`;
  return `${s} сек`;
}

function benchmarkHumanDuration() {
  const start = performance.now();
  const iterations = 100000;
  let dummy = 0;

  for (let i = 0; i < iterations; i++) {
    const res = formatHumanDuration(i % 10000);
    dummy += res.length;
  }
  return performance.now() - start;
}

// ========================================================
// Main Benchmark Runner
// ========================================================
function runFullSuite() {
  // Warmup JIT
  for (let w = 0; w < 3; w++) {
    benchmarkParticleAllocationNonPooled();
    benchmarkParticleAllocationPooled();
    benchmarkConfettiPhysics();
    benchmarkTimerFormatting();
    benchmarkHumanDuration();
  }

  const runs = 5;
  const res = {
    allocNonPooled: [],
    allocPooled: [],
    physics: [],
    timerFormat: [],
    durationFormat: []
  };

  for (let r = 0; r < runs; r++) {
    res.allocNonPooled.push(benchmarkParticleAllocationNonPooled());
    res.allocPooled.push(benchmarkParticleAllocationPooled());
    res.physics.push(benchmarkConfettiPhysics());
    res.timerFormat.push(benchmarkTimerFormatting());
    res.durationFormat.push(benchmarkHumanDuration());
  }

  function mean(arr) {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  const meanNonPooled = mean(res.allocNonPooled);
  const meanPooled = mean(res.allocPooled);
  const poolDelta = ((meanPooled - meanNonPooled) / meanNonPooled) * 100;

  console.log(JSON.stringify({
    particleAllocation: {
      nonPooledMs: meanNonPooled.toFixed(3),
      pooledMs: meanPooled.toFixed(3),
      delta: poolDelta.toFixed(1) + '%'
    },
    confettiPhysicsMs: mean(res.physics).toFixed(3),
    timerFormattingMs: mean(res.timerFormat).toFixed(3),
    durationFormattingMs: mean(res.durationFormat).toFixed(3)
  }, null, 2));
}

runFullSuite();
