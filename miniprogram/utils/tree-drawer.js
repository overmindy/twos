/**
 * TreeDrawer: 钢笔白描/博物志插画风格树木绘图工具
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
   * @param {number} energy 关系能量值 (0-100+)
   */
  draw(energy = 0) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // 设置钢笔风格基础参数
    ctx.strokeStyle = '#2C2C2C'; // 炭黑色
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 起始位置（画布底部中心）
    const startX = this.width / 2;
    const startY = this.height - 20;
    
    // 基础参数随能量动态调整
    // 能量越高，基础越长越粗
    const initialLen = 30 + Math.min(energy / 2, 40); 
    const initialWidth = 1.5 + Math.min(energy / 100, 1.5); 
    
    // 开始递归绘制
    this._drawBranch(startX, startY, -Math.PI / 2, initialLen, initialWidth, 0, energy);
    
    // 绘制底部细节（点缀）
    this._drawBase(startX, startY);
  }

  /**
   * 模拟生长预览动画
   * @param {number} targetEnergy 目标能量值
   * @param {number} duration 持续时间 (ms)
   */
  previewGrowth(targetEnergy, duration = 3000) {
    const startTime = Date.now();
    const startEnergy = 0;

    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // 使用 easeOutQuart 缓动函数
      const easedProgress = 1 - Math.pow(1 - progress, 4);
      const currentEnergy = startEnergy + (targetEnergy - startEnergy) * easedProgress;
      
      this.draw(currentEnergy);
      
      if (progress < 1) {
        this.canvas.requestAnimationFrame(animate);
      }
    };
    
    this.canvas.requestAnimationFrame(animate);
  }

  /**
   * 递归绘制树枝
   */
  _drawBranch(x, y, angle, len, width, depth, energy) {
    const ctx = this.ctx;
    
    // 递归终止条件：深度随能量增加
    const maxDepth = 6 + Math.floor(energy / 40);
    if (depth > maxDepth || len < 3) return;

    // 绘制当前树枝：分段绘制以模拟手绘抖动感
    ctx.beginPath();
    ctx.lineWidth = width;
    ctx.moveTo(x, y);

    const segments = 3;
    let currX = x;
    let currY = y;
    
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const targetX = x + Math.cos(angle) * len * t;
      const targetY = y + Math.sin(angle) * len * t;
      
      // 加入随机抖动 (Jitter)
      const jitter = (Math.random() - 0.5) * (1.5 / (depth + 1));
      const nextX = targetX + jitter;
      const nextY = targetY + jitter;
      
      ctx.lineTo(nextX, nextY);
      currX = nextX;
      currY = nextY;
    }
    ctx.stroke();

    // 生成子分支：根据能量决定分支概率和数量
    const branchCount = (energy > 50 && depth < 2) ? 3 : 2;
    const spread = 0.5 + (Math.random() * 0.3); // 分叉张角

    for (let i = 0; i < branchCount; i++) {
      // 计算每个分支的角度偏移
      const angleOffset = (i - (branchCount - 1) / 2) * spread + (Math.random() - 0.5) * 0.4;
      const nextAngle = angle + angleOffset;
      const nextLen = len * (0.65 + Math.random() * 0.2);
      const nextWidth = width * 0.7;
      
      // 概率性生成（能量低时更少分支）
      if (Math.random() < (0.7 + energy / 400)) {
        this._drawBranch(currX, currY, nextAngle, nextLen, nextWidth, depth + 1, energy);
      }
    }

    // 在末梢绘制简单的叶芽（钢笔点画风格）
    if (depth > 3 && Math.random() > 0.6) {
      this._drawLeaf(currX, currY, angle);
    }
  }

  /**
   * 绘制叶芽
   */
  _drawLeaf(x, y, angle) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + (Math.random() - 0.5));
    
    ctx.beginPath();
    const leafSize = 1.2 + Math.random() * 1.5;
    ctx.ellipse(leafSize, 0, leafSize, leafSize / 2, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(44, 44, 44, 0.8)';
    ctx.fill();
    
    ctx.restore();
  }

  /**
   * 绘制底部底座（少量装饰线）
   */
  _drawBase(x, y) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(44, 44, 44, 0.3)';
    ctx.lineWidth = 0.8;
    ctx.setLineDash([3, 3]);
    
    ctx.beginPath();
    ctx.moveTo(x - 20, y);
    ctx.quadraticCurveTo(x, y + 5, x + 20, y);
    ctx.stroke();
    ctx.restore();
  }
}
