// miniprogram/pages/index/leaderboard/leaderboard.js
Page({
  data: {
    list: [],
    loading: false
  },

  onLoad() {
    this.fetchRanking();
  },

  onPullDownRefresh() {
    this.fetchRanking().then(() => wx.stopPullDownRefresh());
  },

  async fetchRanking() {
    this.setData({ loading: true });
    wx.showLoading({ title: '检阅榜单...' });

    try {
      const { result } = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: { type: 'getLeaderboard' }
      });

      if (result && result.success) {
        this.setData({ list: result.list });
      }
    } catch (e) {
      console.error(e);
    } finally {
      this.setData({ loading: false });
      wx.hideLoading();
    }
  },

  goBack() {
    wx.navigateBack();
  }
});
