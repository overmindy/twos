/**
 * TreeDrawer: 钢笔白描/博物志插画风格树木绘图工具
 * Twos 2.0: 引入分枝进化系统与心情色彩联动
 */
export class TreeDrawer {
  constructor(canvas, ctx, width, height) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.width = width;
    this.height = height;
  }

  /**
   * 绘制树木
   * @param {number} energy 关系能量值
   * @param {Object} options { streakCount, moodColor, theme }
   */
  draw(energy = 0, options = {}) {
    const { streakCount = 0, moodColor = '#2C2C2C', theme = 'light' } = options;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // 设置主题基础色
    const isDark = theme === 'dark';
    ctx.strokeStyle = isDark ? '#F43F5E' : '#2C2C2C'; 
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const startX = this.width / 2;
    const startY = this.height - 20;
    
    const initialLen = 30 + Math.min(energy / 2, 50); 
    const initialWidth = 1.5 + Math.min(energy / 100, 2); 
    
    // 进化判定
    const isLush = energy > 300; // 繁茂态
    const isTwin = streakCount > 7; // 并蒂态 (高连击)

    this._drawBranch(startX, startY, -Math.PI / 2, initialLen, initialWidth, 0, energy, { isLush, isTwin, isDark });
    this._drawBase(startX, startY, isDark);
  }

  previewGrowth(targetEnergy, duration = 3000, options = {}) {
    const startTime = Date.now();
    const animate = () => {
      const now = Date.now();
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      this.draw(targetEnergy * eased, options);
      if (progress < 1) this.canvas.requestAnimationFrame(animate);
    };
    this.canvas.requestAnimationFrame(animate);
  }

  _drawBranch(x, y, angle, len, width, depth, energy, states) {
    const ctx = this.ctx;
    const maxDepth = 6 + Math.floor(energy / 50);
    if (depth > maxDepth || len < 3) return;

    ctx.beginPath();
    ctx.lineWidth = width;
    ctx.moveTo(x, y);

    const segments = 3;
    let currX = x, currY = y;
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const jitter = (Math.random() - 0.5) * (2 / (depth + 1));
      currX = x + Math.cos(angle) * len * t + jitter;
      currY = y + Math.sin(angle) * len * t + jitter;
      ctx.lineTo(currX, currY);
    }
    ctx.stroke();

    const branchCount = (energy > 100 && depth < 2) ? 3 : 2;
    const spread = (states.isTwin && depth === 0) ? 0.3 : (0.5 + Math.random() * 0.3);

    for (let i = 0; i < branchCount; i++) {
      const angleOffset = (i - (branchCount - 1) / 2) * spread + (Math.random() - 0.5) * 0.4;
      const nextAngle = angle + angleOffset;
      const nextLen = len * (0.65 + Math.random() * 0.2);
      const nextWidth = width * 0.7;
      if (Math.random() < (0.75 + energy / 500)) {
        this._drawBranch(currX, currY, nextAngle, nextLen, nextWidth, depth + 1, energy, states);
      }
    }

    // 绘制叶子或花朵
    if (depth > 2) {
      if (states.isTwin && depth === maxDepth) {
        this._drawFlower(currX, currY, states.isDark);
      } else if (Math.random() > (states.isLush ? 0.3 : 0.7)) {
        this._drawLeaf(currX, currY, angle, states.isDark);
      }
    }
  }

  _drawLeaf(x, y, angle, isDark) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.beginPath();
    const size = 1.5 + Math.random() * 2;
    ctx.ellipse(size, 0, size, size / 2, 0, 0, Math.PI * 2);
    ctx.fillStyle = isDark ? 'rgba(244, 63, 94, 0.6)' : 'rgba(44, 44, 44, 0.7)';
    ctx.fill();
    ctx.restore();
  }

  _drawFlower(x, y, isDark) {
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = isDark ? '#FB7185' : '#B22222';
    ctx.fill();
    // 绘制成对的小花瓣
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      const angle = (i * 72) * Math.PI / 180;
      ctx.ellipse(x + Math.cos(angle)*4, y + Math.sin(angle)*4, 2, 1, angle, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawBase(x, y, isDark) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = isDark ? 'rgba(244, 63, 94, 0.2)' : 'rgba(44, 44, 44, 0.2)';
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(x - 30, y);
    ctx.quadraticCurveTo(x, y + 8, x + 30, y);
    ctx.stroke();
    ctx.restore();
  }
}
