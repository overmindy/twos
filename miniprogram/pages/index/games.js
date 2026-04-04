Page({
  data: {},

  onLoad() {},

  goToCoinFlip() {
    wx.navigateTo({
      url: '/pages/index/coin-flip',
    });
  },

  goToGobang() {
    wx.navigateTo({
      url: '/pages/index/gobang',
    });
  },

  goToScratch() {
    wx.navigateTo({
      url: '/pages/index/scratch',
    });
  }
});