/**
 * FXEngine - Twos 2.0 Visual Effects Engine
 * 处理全局 Canvas 粒子特效，如碎纸屑、闪光等。
 */
export class FXEngine {
  constructor(canvas, ctx, width, height) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    this.particles = [];
    this.isAnimating = false;
  }

  /**
   * 喷洒碎纸屑 (Confetti)
   */
  spawnConfetti() {
    const colors = ['#B22222', '#2563EB', '#F59E0B', '#10B981', '#FF8AAE'];
    for (let i = 0; i < 80; i++) {
      this.particles.push({
        x: this.width / 2,
        y: this.height / 2,
        vx: (Math.random() - 0.5) * 15,
        vy: (Math.random() - 0.8) * 15,
        r: Math.random() * 6 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        opacity: 1,
        life: 100 + Math.random() * 50
      });
    }
    this._startLoop();
  }

  _startLoop() {
    if (this.isAnimating) return;
    this.isAnimating = true;
    this._animate();
  }

  _animate() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    this.particles = this.particles.filter(p => p.life > 0);

    this.particles.forEach(p => {
      // 物理模拟
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.2; // 重力
      p.vx *= 0.98; // 摩擦
      p.rotation += p.rotationSpeed;
      p.life--;
      p.opacity = p.life / 100;

      // 绘制
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.globalAlpha = Math.min(p.opacity, 1);
      ctx.fillStyle = p.color;
      
      // 绘制一个小矩形作为纸屑
      ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r / 2);
      ctx.restore();
    });

    if (this.particles.length > 0) {
      this.canvas.requestAnimationFrame(() => this._animate());
    } else {
      this.isAnimating = false;
      ctx.clearRect(0, 0, this.width, this.height);
    }
  }
}
