const db = wx.cloud.database();

Page({
  data: {
    gameId: '',
    relationshipId: '',
    roomId: '',
    room: null,
    board: Array(15).fill(null).map(() => Array(15).fill(null)),
    currentTurn: 'black',
    myColor: '',
    blackNickname: '',
    whiteNickname: '',
    gameStatus: 'playing',
    winner: null,
    watcher: null,
    lastMove: { x: -1, y: -1 },
    isMyReady: false
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
      
      // 3. 检查是否有活跃房间 (恢复功能)
      await this.checkActiveRoom();
      
    } catch (e) {
      console.error(e);
      wx.showToast({ title: '系统初始化失败', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
    } finally {
      wx.hideLoading();
    }
  },

  async checkActiveRoom() {
    const _ = db.command;
    try {
      const { data: rooms } = await db.collection('game_rooms').where({
        relationshipId: this.data.relationshipId,
        gameType: 'gobang',
        status: _.in(['WAITING', 'PREPARING', 'PLAYING'])
      }).get();

      if (rooms.length > 0) {
        const room = rooms[0];
        this.setData({ roomId: room._id });
        this.watchRoom(room._id);
      }
    } catch (e) {
      console.error('Failed to check active room', e);
    }
  },

  async handleReady() {
    wx.showLoading({ title: '准备中...' });
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: {
          type: 'handleGameReady',
          data: {
            relationshipId: this.data.relationshipId,
            gameType: 'gobang'
          }
        }
      });

      if (result.success) {
        this.setData({ roomId: result.room._id });
        if (!this.data.watcher) {
          this.watchRoom(result.room._id);
        }
      } else {
        wx.showToast({ title: result.errMsg, icon: 'none' });
      }
    } catch (e) {
      console.error(e);
      wx.showToast({ title: '操作失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  watchRoom(roomId) {
    if (this.data.watcher) {
      this.data.watcher.close();
    }

    const watcher = db.collection('game_rooms').doc(roomId).watch({
      onChange: (snapshot) => {
        if (snapshot.docs.length > 0) {
          this.updateRoomState(snapshot.docs[0]);
        }
      },
      onError: (err) => {
        console.error('the watch closed because of error', err);
      }
    });
    this.setData({ watcher });
  },

  updateRoomState(room) {
    const rel = this.relationship;
    const isPlayerA = room.players.playerA.openid === this.myOpenid;
    const isMyReady = isPlayerA ? room.players.playerA.ready : room.players.playerB.ready;

    // 默认 A 是黑棋，B 是白棋
    const myColor = isPlayerA ? 'black' : 'white';
    const blackNickname = rel.userAInfo?.nickname || '黑方';
    const whiteNickname = rel.userBInfo?.nickname || '白方';

    const newState = {
      room,
      isMyReady,
      myColor,
      blackNickname,
      whiteNickname,
      gameStatus: room.status.toLowerCase()
    };

    if (room.status === 'PLAYING' && room.gameState.data.board) {
      const oldBoard = this.data.board;
      const newBoard = room.gameState.data.board;
      let newX = -1, newY = -1;

      // 寻找新落子
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

      newState.board = newBoard;
      // 转换 currentTurn (openid -> black/white)
      newState.currentTurn = room.gameState.currentTurn === room.players.playerA.openid ? 'black' : 'white';
      newState.winner = room.gameState.winner ? (room.gameState.winner === room.players.playerA.openid ? 'black' : 'white') : null;
      if (newX !== -1) {
        newState.lastMove = { x: newX, y: newY };
      }
    } else if (room.status === 'FINISHED') {
      newState.winner = room.gameState.winner ? (room.gameState.winner === room.players.playerA.openid ? 'black' : 'white') : null;
      newState.gameStatus = 'won';
    }

    this.setData(newState);
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
    // 该方法由于 room 系统的引入，基本可以废弃，或者重定向到 handleReady
    this.handleReady();
  },

  // 这里的 onTapIntersection 也需要更新 gameId 为 roomId
  async onTapIntersection(e) {
    const { x, y } = e.currentTarget.dataset;
    const { board, currentTurn, myColor, gameStatus, roomId } = this.data;

    if (gameStatus !== 'playing') return;
    if (currentTurn !== myColor) {
      wx.showToast({ title: '还没轮到你', icon: 'none' });
      return;
    }
    if (board[x][y]) return;

    // 预渲染
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
            gameId: roomId, // 使用 roomId
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
          lastMove: { x: -1, y: -1 } 
        });
      }
    } catch (e) {
      console.error(e);
      wx.showToast({ title: '落子失败', icon: 'none' });
      this.setData({ board });
    }
  },

  restartGame() {
    this.setData({
      board: Array(15).fill(null).map(() => Array(15).fill(null)),
      gameStatus: 'preparing',
      winner: null,
      lastMove: { x: -1, y: -1 },
      isMyReady: false,
      room: null
    });
    this.initGame();
  },

  goBack() {
    wx.navigateBack();
  }
});
