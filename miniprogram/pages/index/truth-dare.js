// miniprogram/pages/index/truth-dare.js
Page({
  data: {
    cards: [],
    loading: false,
    theme: ''
  },

  onLoad(options) {
    this.fetchCards();
    
    // 检查时间自动设置深色模式预览 (为了 UI 统一)
    const hour = new Date().getHours();
    if (hour >= 20 || hour < 6) {
      this.setData({ theme: 'dark' });
    }
  },

  async fetchCards() {
    this.setData({ loading: true });
    wx.showLoading({ title: '信鸽觅信中...' });

    try {
      const { result } = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: { type: 'getTruthOrDare' }
      });

      if (result && result.success) {
        const cards = result.cards.map((card, index) => ({
          ...card,
          id: index,
          isFlipped: false
        }));
        this.setData({ cards });
      } else {
        wx.showToast({ title: '信鸽迷路了', icon: 'none' });
      }
    } catch (e) {
      console.error(e);
      wx.showToast({ title: '召唤 AI 失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
      wx.hideLoading();
    }
  },

  onFlipCard(e) {
    const { index } = e.currentTarget.dataset;
    const cards = this.data.cards;
    
    if (cards[index].isFlipped) return; // 已翻转不再触发

    cards[index].isFlipped = true;
    this.setData({ cards });
    wx.vibrateShort({ type: 'medium' });
  },

  onRefreshCards() {
    this.fetchCards();
  },

  goBack() {
    wx.navigateBack();
  }
});
