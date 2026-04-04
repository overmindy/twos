const db = wx.cloud.database();

Page({
  data: {
    gameId: '',
    relationshipId: '',
    board: Array(15).fill(null).map(() => Array(15).fill(null)),
    currentTurn: 'black',
    myColor: '',
    blackNickname: '',
    whiteNickname: '',
    gameStatus: 'playing',
    winner: null,
    watcher: null,
    lastMove: { x: -1, y: -1 }
  },

  // 非数据绑定变量存放在这里以减少 setData 负担
  myOpenid: '',
  relationship: null,
  audioContext: null,

  async onLoad(options) {
    let { relationshipId } = options;
    
    wx.showLoading({ title: '加载中...' });
    this.initAudio();
    try {
      // 1. 获取我的 OpenID (必备)
      const { result: openidRes } = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: { type: 'getOpenId' }
      });
      this.myOpenid = openidRes.openid;

      // 2. 获取关系信息
      const { result: relRes } = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: { type: 'getActiveRelationship' }
      });

      if (relRes.success && relRes.relationship) {
        this.relationship = relRes.relationship;
        relationshipId = relRes.relationship._id;
      } else {
        wx.showToast({ title: '未找到活跃关系', icon: 'none' });
        setTimeout(() => wx.navigateBack(), 1500);
        return;
      }

      this.setData({ relationshipId });
      this.initGame();
    } catch (e) {
      console.error(e);
      wx.showToast({ title: '系统初始化失败', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
    } finally {
      wx.hideLoading();
    }
  },

  onUnload() {
    if (this.data.watcher) {
      this.data.watcher.close();
    }
    if (this.audioContext) {
      this.audioContext.destroy();
    }
  },

  initAudio() {
    this.audioContext = wx.createInnerAudioContext();
    // 墨迹落子音效
    this.audioContext.src = 'https://636c-cloud1-4g9x6v5c8d0e2-1305411643.tcb.qcloud.la/audio/stone.mp3';
  },

  playStoneSound() {
    if (this.audioContext) {
      this.audioContext.stop();
      this.audioContext.play();
    }
    wx.vibrateShort({ type: 'light' });
  },

  async initGame() {
    wx.showLoading({ title: '对局初始化...' });
    try {
      // 调用云函数初始化或获取现有对局
      const { result } = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: {
          type: 'initGobang',
          data: { relationshipId: this.data.relationshipId }
        }
      });

      if (result.success) {
        this.setData({ gameId: result.gameId });
        // 如果已经有监听器，先关闭
        if (this.data.watcher) {
          this.data.watcher.close();
        }
        this.watchGame();
      } else {
        wx.showToast({ title: result.errMsg, icon: 'none' });
      }
    } catch (e) {
      console.error(e);
      wx.showToast({ title: '初始化失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  watchGame() {
    const watcher = db.collection('gobang_games').doc(this.data.gameId).watch({
      onChange: (snapshot) => {
        if (snapshot.docs.length > 0) {
          const game = snapshot.docs[0];
          this.updateGameState(game);
        }
      },
      onError: (err) => {
        console.error('the watch closed because of error', err);
      }
    });
    this.setData({ watcher });
  },

  updateGameState(game) {
    const myColor = game.blackPlayer === this.myOpenid ? 'black' : 'white';

    let blackNickname = '黑方';
    let whiteNickname = '白方';

    if (this.relationship) {
      const rel = this.relationship;
      if (game.blackPlayer === rel.userA) {
        blackNickname = rel.userAInfo?.nickname || '用户A';
        whiteNickname = rel.userBInfo?.nickname || '用户B';
      } else {
        blackNickname = rel.userBInfo?.nickname || '用户B';
        whiteNickname = rel.userAInfo?.nickname || '用户A';
      }
    }

    const oldBoard = this.data.board;
    const newBoard = game.board;
    let newX = -1, newY = -1;

    // 寻找最新的落子点 (仅当不是初始化加载时播放声音)
    if (this.data.gameId) {
      for (let i = 0; i < 15; i++) {
        for (let j = 0; j < 15; j++) {
          if (newBoard[i][j] && !oldBoard[i][j]) {
            newX = i;
            newY = j;
            break;
          }
        }
        if (newX !== -1) break;
      }

      if (newX !== -1) {
        this.playStoneSound();
      }
    }

    this.setData({
      board: game.board,
      currentTurn: game.currentTurn,
      gameStatus: game.status,
      winner: game.winner,
      myColor,
      blackNickname,
      whiteNickname,
      lastMove: newX !== -1 ? { x: newX, y: newY } : this.data.lastMove
    });
  },

  async onTapIntersection(e) {
    const { x, y } = e.currentTarget.dataset;
    const { board, currentTurn, myColor, gameStatus } = this.data;

    if (gameStatus !== 'playing') return;
    if (currentTurn !== myColor) {
      wx.showToast({ title: '还没轮到你', icon: 'none' });
      return;
    }
    if (board[x][y]) return;

    // 预渲染（提升响应感）
    const newBoard = JSON.parse(JSON.stringify(board));
    newBoard[x][y] = myColor;
    this.setData({ 
      board: newBoard,
      lastMove: { x, y }
    });
    this.playStoneSound();

    try {
      const { result } = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: {
          type: 'placeGobangPiece',
          data: {
            gameId: this.data.gameId,
            x,
            y
          }
        }
      });

      if (!result.success) {
        wx.showToast({ title: result.errMsg, icon: 'none' });
        // 失败回滚
        this.setData({ 
          board,
          lastMove: { x: -1, y: -1 } // 简单处理回滚
        });
      }
    } catch (e) {
      console.error(e);
      wx.showToast({ title: '落子失败', icon: 'none' });
      this.setData({ board });
    }
  },

  restartGame() {
    this.initGame();
  },

  goBack() {
    wx.navigateBack();
  }
});
