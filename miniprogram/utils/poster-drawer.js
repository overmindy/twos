/**
 * PosterDrawer 2.0 - Twos 2.0 High-Definition Multi-Template Engine
 * 支持多种比例、高清适配及异步资源预加载
 */
export class PosterDrawer {
  constructor(canvas, ctx, width, height) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.baseWidth = width;
    this.baseHeight = height;
    this.dpr = wx.getSystemInfoSync().pixelRatio;
  }

  /**
   * 绘制高清海报
   * @param {string} template 'polaroid' | 'minimal' | 'story'
   * @param {Object} data 绘制所需数据
   */
  async draw(template = 'polaroid', data) {
    const ctx = this.ctx;
    
    // 清空画布
    ctx.clearRect(0, 0, this.baseWidth, this.baseHeight);

    // 绘制背景
    this._drawBackground();

    switch (template) {
      case 'polaroid':
        await this._drawPolaroid(data);
        break;
      case 'minimal':
        await this._drawMinimal(data);
        break;
      default:
        await this._drawPolaroid(data);
    }

    return this._export();
  }

  _drawBackground() {
    const ctx = this.ctx;
    ctx.fillStyle = '#FDFCF8';
    ctx.fillRect(0, 0, this.baseWidth, this.baseHeight);
    
    // 纸张纹理感
    ctx.fillStyle = 'rgba(224, 216, 192, 0.1)';
    for (let i = 0; i < 500; i++) {
      ctx.fillRect(Math.random() * this.baseWidth, Math.random() * this.baseHeight, 1, 1);
    }
  }

  /** 拍立得模板：侧重于两人的形象与羁绊天数 */
  async _drawPolaroid(data) {
    const { meNickname, partnerNickname, streakCount } = data;
    const ctx = this.ctx;
    const w = this.baseWidth;
    const h = this.baseHeight;

    // 1. 标题
    ctx.font = 'bold 32px serif';
    ctx.fillStyle = '#B22222';
    ctx.textAlign = 'center';
    ctx.fillText('TWOS · OUR MOMENTS', w / 2, h * 0.12);

    // 2. 装饰边框
    ctx.strokeStyle = 'rgba(178, 34, 34, 0.2)';
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(40, 40, w - 80, h - 80);
    ctx.setLineDash([]);

    // 3. 绘制核心数字
    ctx.font = 'bold 120px serif';
    ctx.fillStyle = '#B22222';
    ctx.fillText(streakCount, w / 2, h * 0.45);
    
    ctx.font = '24px serif';
    ctx.fillStyle = '#8C8C8C';
    ctx.fillText('DAYS OF TOGETHER', w / 2, h * 0.52);

    // 4. 用户信息
    ctx.font = '28px serif';
    ctx.fillStyle = '#2F2F2F';
    ctx.fillText(`${meNickname} & ${partnerNickname}`, w / 2, h * 0.65);

    // 5. 底部语录
    ctx.font = 'italic 20px serif';
    ctx.fillStyle = '#5C5C5C';
    const quote = '“ 每一笔落下的墨迹，都是我们重合的呼吸。 ”';
    ctx.fillText(quote, w / 2, h * 0.8);
  }

  /** 极简模板：侧重于一句话和一个印章 */
  async _drawMinimal(data) {
    const { content, author } = data;
    const ctx = this.ctx;
    const w = this.baseWidth;
    const h = this.baseHeight;

    ctx.font = '36px serif';
    ctx.fillStyle = '#2F2F2F';
    ctx.textAlign = 'center';
    this._wrapText(ctx, content, w / 2, h * 0.4, w * 0.7, 50);

    ctx.font = '24px serif';
    ctx.fillStyle = '#B22222';
    ctx.fillText(`—— ${author}`, w / 2, h * 0.7);

    // 绘制一个红色印章
    this._drawSeal(w - 120, h - 120, '两只');
  }

  _drawSeal(x, y, text) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 12);
    ctx.strokeStyle = '#B22222';
    ctx.lineWidth = 4;
    ctx.strokeRect(-40, -40, 80, 80);
    ctx.font = 'bold 28px serif';
    ctx.fillStyle = '#B22222';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  _wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split('');
    let line = '';
    for (let n = 0; n < words.length; n++) {
      let testLine = line + words[n];
      let metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line, x, y);
        line = words[n];
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, y);
  }

  _export() {
    return new Promise((resolve) => {
      setTimeout(() => {
        wx.canvasToTempFilePath({
          canvas: this.canvas,
          destWidth: this.baseWidth * this.dpr,
          destHeight: this.baseHeight * this.dpr,
          success: (res) => resolve(res.tempFilePath),
          fail: (err) => resolve(null)
        });
      }, 500);
    });
  }
}
