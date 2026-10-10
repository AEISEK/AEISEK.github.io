/**
 * High-Performance Festive Confetti Engine
 * Optimized:
 * - O(1) swap-and-pop particle removal (zero array shifting)
 * - Zero ctx.save() / ctx.restore() overhead using direct matrix transforms
 * - Pre-computed radian angles (zero Math.PI/180 calculations in 60fps loop)
 * - Low-overhead canvas state clearing
 */

class ConfettiEngine {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas ? this.canvas.getContext('2d', { alpha: true }) : null;
    this.particles = [];
    this.pool = [];
    this.animationFrame = null;
    this.colors = ['#38bdf8', '#818cf8', '#ec4899', '#f59e0b', '#10b981', '#a855f7'];

    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize, { passive: true });
    this.resize();
  }

  resize() {
    if (!this.canvas) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  burst(count = 120) {
    if (!this.canvas || !this.ctx) return;
    this.resize();

    const originX = this.canvas.width * 0.5;
    const originY = this.canvas.height * 0.45;
    const colorsLen = this.colors.length;
    const TAU = Math.PI * 2;
    const pool = this.pool;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * TAU;
      const speed = 4 + Math.random() * 12;
      const sizeW = 5 + Math.random() * 6;

      // Object pool reuse eliminates heap churn
      const p = pool.length > 0 ? pool.pop() : {};
      p.x = originX;
      p.y = originY;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 3;
      p.sizeW = sizeW;
      p.sizeH = sizeW * 0.7;
      p.color = this.colors[(Math.random() * colorsLen) | 0];
      p.rotation = Math.random() * TAU;
      p.rotationSpeed = (Math.random() - 0.5) * 0.25;
      p.opacity = 1;
      p.decay = 0.007 + Math.random() * 0.012;
      this.particles.push(p);
    }

    if (!this.animationFrame) {
      this.render();
    }
  }

  render() {
    const ctx = this.ctx;
    if (!ctx) return;

    const canvas = this.canvas;
    const h = canvas.height;
    ctx.clearRect(0, 0, canvas.width, h);

    const particles = this.particles;
    const pool = this.pool;
    let len = particles.length;

    for (let i = len - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.22; // Gravity
      p.vx *= 0.98; // Air resistance
      p.rotation += p.rotationSpeed;
      p.opacity -= p.decay;

      // O(1) swap-and-pop removal with pool recycling
      if (p.opacity <= 0 || p.y > h + 20) {
        particles[i] = particles[--len];
        const dead = particles.pop();
        if (pool.length < 300) {
          pool.push(dead);
        }
        continue;
      }

      // Fast affine transform without save/restore state stack thrashing
      const cos = Math.cos(p.rotation);
      const sin = Math.sin(p.rotation);
      ctx.setTransform(cos, sin, -sin, cos, p.x, p.y);
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.sizeW * 0.5, -p.sizeH * 0.5, p.sizeW, p.sizeH);
    }

    // Reset transform matrix once per frame
    ctx.resetTransform();

    if (particles.length > 0) {
      this.animationFrame = requestAnimationFrame(() => this.render());
    } else {
      this.animationFrame = null;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
}

window.chronoConfetti = new ConfettiEngine('confettiCanvas');
