const db = wx.cloud.database();

Page({
  data: {
    flipping: false,
    result: 'head',
    flipCount: 0,
    showResult: false,
    watcher: null,
    roomId: '',
    room: null,
    myBet: null,
    otherBet: null,
    winnerNickname: '',
    myOpenid: '',
    relationship: null
  },

  async onLoad() {
    wx.showLoading({ title: '加载中...' });
    try {
      const { result: openidRes } = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: { type: 'getOpenId' }
      });
      this.setData({ myOpenid: openidRes.openid });

      const { result: relRes } = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: { type: 'getActiveRelationship' }
      });

      if (relRes.success && relRes.relationship) {
        this.setData({ relationship: relRes.relationship });
        await this.handleReady();
      } else {
        wx.showToast({ title: '未找到活跃关系', icon: 'none' });
      }
    } catch (e) {
      console.error(e);
    } finally {
      wx.hideLoading();
    }
  },

  async handleReady() {
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: {
          type: 'handleGameReady',
          data: {
            relationshipId: this.data.relationship._id,
            gameType: 'coin'
          }
        }
      });

      if (result.success) {
        this.setData({ roomId: result.room._id });
        this.watchRoom(result.room._id);
      }
    } catch (e) {
      console.error(e);
    }
  },

  watchRoom(roomId) {
    if (this.data.watcher) this.data.watcher.close();
    const watcher = db.collection('game_rooms').doc(roomId).watch({
      onChange: (snapshot) => {
        if (snapshot.docs.length > 0) {
          this.updateRoomState(snapshot.docs[0]);
        }
      },
      onError: (err) => console.error(err)
    });
    this.setData({ watcher });
  },

  updateRoomState(room) {
    const isPlayerA = room.players.playerA.openid === this.data.myOpenid;
    const myBet = isPlayerA ? room.gameState.data.playerABet : room.gameState.data.playerBBet;
    const otherBet = isPlayerA ? room.gameState.data.playerBBet : room.gameState.data.playerABet;
    
    let winnerNickname = '';
    if (room.status === 'FINISHED' && room.gameState.winner) {
      if (room.gameState.winner === 'draw') {
        winnerNickname = '平局';
      } else {
        winnerNickname = room.gameState.winner === room.players.playerA.openid ? 
          (this.data.relationship.userAInfo?.nickname || '甲方') : 
          (this.data.relationship.userBInfo?.nickname || '乙方');
      }
    }

    const oldResult = this.data.result;
    const newResult = room.gameState.data.result;

    this.setData({
      room,
      myBet,
      otherBet,
      winnerNickname
    });

    if (newResult && newResult !== oldResult && !this.data.flipping) {
      this.performFlip(newResult);
    } else if (room.status === 'FINISHED' && newResult && !this.data.flipping) {
      this.setData({ result: newResult, showResult: true });
    }
  },

  async placeBet(e) {
    const { bet } = e.currentTarget.dataset;
    if (this.data.myBet || this.data.room.status === 'FINISHED') return;

    wx.showLoading({ title: '正襟危坐...' });
    try {
      await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: {
          type: 'placeCoinBet',
          data: { roomId: this.data.roomId, bet }
        }
      });
    } catch (e) {
      console.error(e);
    } finally {
      wx.hideLoading();
    }
  },

  async startFlip() {
    if (this.data.flipping || !this.data.myBet || !this.data.otherBet) return;

    wx.showLoading({ title: '乾坤一掷...' });
    try {
      await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: {
          type: 'flipCoin',
          data: { roomId: this.data.roomId }
        }
      });
    } catch (e) {
      console.error(e);
    } finally {
      wx.hideLoading();
    }
  },

  performFlip(result) {
    let baseRotation = 14 + Math.floor(Math.random() * 4);
    if (result === 'head' && baseRotation % 2 !== 0) baseRotation++;
    if (result === 'tail' && baseRotation % 2 === 0) baseRotation++;

    this.setData({
      flipping: true,
      showResult: false,
      flipCount: baseRotation,
      result: result
    });

    setTimeout(() => {
      this.setData({
        flipping: false,
        showResult: true
      });
    }, 2500);
  },

  resetGame() {
    this.handleReady();
  },

  onUnload() {
    if (this.data.watcher) this.data.watcher.close();
  }
});