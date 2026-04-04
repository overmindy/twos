const db = wx.cloud.database();

Page({
  data: {
    relationshipId: '',
    gameHistory: [],
    gameNames: {
      'COIN_FLIP': '纸上抛硬币',
      'GOBANG': '纸上五子棋',
      'SCRATCH': '默契刮刮乐',
      'DRAW_GUESS': '你画我猜'
    }
  },

  onLoad(options) {
    const relationshipId = options.relationshipId || wx.getStorageSync('currentRelationshipId') || '';
    this.setData({ relationshipId });
  },

  onShow() {
    this.fetchGameHistory();
  },

  async fetchGameHistory() {
    if (!this.data.relationshipId) return;

    try {
      const { data } = await db.collection('game_history')
        .where({
          relationshipId: this.data.relationshipId
        })
        .orderBy('endTime', 'desc')
        .limit(5)
        .get();

      const formattedHistory = data.map(item => {
        const date = new Date(item.endTime);
        const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
        const durationStr = item.duration ? `${Math.floor(item.duration / 60)}分${item.duration % 60}秒` : '未知';
        
        return {
          ...item,
          dateStr,
          durationStr,
          gameName: this.data.gameNames[item.gameType] || item.gameType
        };
      });

      this.setData({ gameHistory: formattedHistory });
    } catch (e) {
      console.error('Failed to fetch game history:', e);
    }
  },

  goToCoinFlip() {
    wx.navigateTo({
      url: `/pages/index/coin-flip?relationshipId=${this.data.relationshipId}`,
    });
  },

  goToGobang() {
    wx.navigateTo({
      url: `/pages/index/gobang?relationshipId=${this.data.relationshipId}`,
    });
  },

  goToScratch() {
    wx.navigateTo({
      url: `/pages/index/scratch?relationshipId=${this.data.relationshipId}`,
    });
  },

  goToDrawGuess() {
    wx.navigateTo({
      url: `/pages/index/draw-guess?relationshipId=${this.data.relationshipId}`,
    });
  }
});