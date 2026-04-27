const db = wx.cloud.database();

Page({
  data: {
    relationshipId: '',
    gameHistory: [],
    gameNames: {
      'coin': '纸上抛硬币',
      'gobang': '纸上五子棋',
      'scratch': '默契刮刮乐',
      'draw_guess': '你画我猜',
      'truth_dare': '灵魂拷问'
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
    const relId = this.data.relationshipId;
    if (!relId) return;

    try {
      // 1. 获取关系详情以获取昵称
      const { result: relRes } = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: { type: 'getActiveRelationship' }
      });

      let userAMapping = { openid: '', nickname: '' };
      let userBMapping = { openid: '', nickname: '' };

      if (relRes.success && relRes.relationship) {
        const rel = relRes.relationship;
        userAMapping = { openid: rel.userA, nickname: rel.userAInfo?.nickname || '甲方' };
        userBMapping = { openid: rel.userB, nickname: rel.userBInfo?.nickname || '乙方' };
      }

      // 2. 获取历史
      const { data } = await db.collection('game_history')
        .where({
          relationshipId: relId
        })
        .orderBy('endTime', 'desc')
        .limit(5)
        .get();

      const formattedHistory = data.map(item => {
        const date = new Date(item.endTime);
        const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
        const durationStr = item.duration ? `${Math.floor(item.duration / 60)}分${item.duration % 60}秒` : (item.gameType === 'coin' ? '转瞬' : '未知');
        
        let winnerName = '无';
        if (item.winner === 'draw') {
          winnerName = '平局';
        } else if (item.winner === userAMapping.openid) {
          winnerName = userAMapping.nickname;
        } else if (item.winner === userBMapping.openid) {
          winnerName = userBMapping.nickname;
        } else if (item.winner) {
          winnerName = item.winner; // 兜底
        }

        return {
          ...item,
          dateStr,
          durationStr,
          winnerName,
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
  },

  goToTruthOrDare() {
    wx.navigateTo({
      url: `/pages/index/truth-dare?relationshipId=${this.data.relationshipId}`,
    });
  },

  goToLeaderboard() {
    wx.navigateTo({
      url: '/pages/index/leaderboard/leaderboard',
    });
  }
});