const db = wx.cloud.database();
const _ = db.command;

Page({
  data: {
    relationshipId: '',
    roomId: '',
    room: null,
    gameStatus: 'waiting', // waiting, preparing, playing, finished
    isMyReady: false,
    isDrawer: false,
    targetWord: '',
    guessInput: '',
    currentColor: '#333333',
    currentBrush: 4,
    colors: ['#333333', '#B22222', '#1890ff', '#52c41a', '#faad14'],
    brushes: [
      { size: 2 },
      { size: 4 },
      { size: 8 }
    ],
    watcher: null
  },

  // 非数据绑定变量
  myOpenid: '',
  relationship: null,
  canvas: null,
  ctx: null,
  canvasWidth: 0,
  canvasHeight: 0,
  isDrawing: false,
  currentPath: null,
  lastDrawnPathIndex: -1,

  async onLoad(options) {
    let { relationshipId } = options;
    
    wx.showLoading({ title: '加载中...' });
    try {
      // 1. 获取我的 OpenID
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
      
      // 3. 检查是否有活跃房间
      await this.checkActiveRoom();

      // 4. 初始化 Canvas
      this.initCanvas();
      
    } catch (e) {
      console.error(e);
      wx.showToast({ title: '系统初始化失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  onUnload() {
    if (this.data.watcher) {
      this.data.watcher.close();
    }
  },

  async checkActiveRoom() {
    try {
      const { data: rooms } = await db.collection('game_rooms').where({
        relationshipId: this.data.relationshipId,
        gameType: 'draw_guess',
        status: _.in(['WAITING', 'PREPARING', 'PLAYING'])
      }).get();

      if (rooms.length > 0) {
        const room = rooms[0];
        this.setData({ roomId: room._id });
        this.watchRoom(room._id);
      } else {
        this.handleReady();
      }
    } catch (e) {
      console.error('Failed to check active room', e);
    }
  },

  async handleReady() {
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: {
          type: 'handleGameReady',
          data: {
            relationshipId: this.data.relationshipId,
            gameType: 'draw_guess'
          }
        }
      });

      if (result.success) {
        this.setData({ roomId: result.room._id });
        if (!this.data.watcher) {
          this.watchRoom(result.room._id);
        }
      }
    } catch (e) {
      console.error(e);
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
        console.error('Watch error', err);
      }
    });
    this.setData({ watcher });
  },

  updateRoomState(room) {
    const isPlayerA = room.players.playerA.openid === this.myOpenid;
    const isMyReady = isPlayerA ? room.players.playerA.ready : room.players.playerB.ready;
    const gameStatus = room.status.toLowerCase();

    // 确定谁是画画的人 (简单逻辑：playerA 先画)
    // 实际可以根据房主或者轮流，这里暂定 playerA 是画画者
    // 也可以通过 gameState.currentTurn 决定
    const isDrawer = room.gameState.currentTurn === this.myOpenid;

    const newState = {
      room,
      isMyReady,
      gameStatus,
      isDrawer,
      targetWord: room.gameState.data.word || ''
    };

    if (room.status === 'PLAYING' && room.gameState.data) {
      const { paths } = room.gameState.data;
      
      if (paths && paths.length > 0) {
        this.renderPaths(paths);
      } else {
        // 如果 paths 为空，说明可能被清空了
        if (this.lastDrawnPathIndex !== -1) {
          this.clearCanvasLocal();
          this.lastDrawnPathIndex = -1;
        }
      }
    } else if (room.status === 'FINISHED') {
      // 结束状态，不再更新笔迹，只展示结果
      newState.gameStatus = 'finished';
    }

    this.setData(newState);
  },

  initCanvas() {
    const query = wx.createSelectorQuery();
    query.select('#drawCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res[0]) return;
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');

        const dpr = wx.getSystemInfoSync().pixelRatio;
        canvas.width = res[0].width * dpr;
        canvas.height = res[0].height * dpr;
        ctx.scale(dpr, dpr);

        this.canvas = canvas;
        this.ctx = ctx;
        this.canvasWidth = res[0].width;
        this.canvasHeight = res[0].height;

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      });
  },

  renderPaths(paths) {
    if (!this.ctx) return;
    
    // 如果远程路径索引比本地小，说明画布被清空了或者重置了
    if (paths.length <= this.lastDrawnPathIndex) {
        this.clearCanvasLocal();
        this.lastDrawnPathIndex = -1;
    }

    for (let i = this.lastDrawnPathIndex + 1; i < paths.length; i++) {
      const path = paths[i];
      if (path.type === 'clear') {
        this.clearCanvasLocal();
      } else {
        this.drawPath(path);
      }
    }
    this.lastDrawnPathIndex = paths.length - 1;
  },

  drawPath(path) {
    const { color, size, points } = path;
    if (!points || points.length < 2) return;

    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = size;
    this.ctx.beginPath();
    this.ctx.moveTo(points[0].x, points[0].y);
    
    for (let i = 1; i < points.length; i++) {
      this.ctx.lineTo(points[i].x, points[i].y);
    }
    this.ctx.stroke();
  },

  touchStart(e) {
    if (this.data.gameStatus !== 'playing' || !this.data.isDrawer) return;
    this.isDrawing = true;
    const touch = e.touches[0];
    const x = touch.x;
    const y = touch.y;

    this.currentPath = {
      color: this.data.currentColor,
      size: this.data.currentBrush,
      points: [{ x, y }]
    };

    this.ctx.strokeStyle = this.data.currentColor;
    this.ctx.lineWidth = this.data.currentBrush;
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
  },

  touchMove(e) {
    if (!this.isDrawing) return;
    const touch = e.touches[0];
    const x = touch.x;
    const y = touch.y;

    this.currentPath.points.push({ x, y });
    this.ctx.lineTo(x, y);
    this.ctx.stroke();
  },

  touchEnd() {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    this.syncPath(this.currentPath);
    this.currentPath = null;
    // 更新本地已画索引，避免 watch 监听到自己的再次绘制
    this.lastDrawnPathIndex++;
  },

  async syncPath(path) {
    if (!this.data.roomId) return;
    try {
      await db.collection('game_rooms').doc(this.data.roomId).update({
        data: {
          'gameState.data.paths': _.push(path),
          updateTime: db.serverDate()
        }
      });
    } catch (e) {
      console.error('Failed to sync path', e);
    }
  },

  selectColor(e) {
    this.setData({ currentColor: e.currentTarget.dataset.color });
  },

  selectBrush(e) {
    this.setData({ currentBrush: e.currentTarget.dataset.size });
  },

  async clearCanvas() {
    if (!this.data.isDrawer) return;
    this.clearCanvasLocal();
    try {
      await db.collection('game_rooms').doc(this.data.roomId).update({
        data: {
          'gameState.data.paths': _.push({ type: 'clear' }),
          updateTime: db.serverDate()
        }
      });
      this.lastDrawnPathIndex++;
    } catch (e) {
      console.error('Failed to clear canvas', e);
    }
  },

  clearCanvasLocal() {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
  },

  onInputGuess(e) {
    this.setData({ guessInput: e.detail.value });
  },

  async checkGuess() {
    const guess = this.data.guessInput.trim();
    if (!guess) return;

    if (guess === this.data.targetWord) {
      wx.showToast({ title: '太棒了！猜对了', icon: 'success' });
      this.handleGameFinish();
    } else {
      wx.showToast({ title: '不对哦，再试试', icon: 'none' });
      this.setData({ guessInput: '' });
    }
  },

  async handleGameFinish() {
    try {
      await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: {
          type: 'closeGameRoom',
          data: {
            roomId: this.data.roomId,
            winner: this.myOpenid, // 猜对的人是赢家，或者双方都是
            gameType: 'draw_guess'
          }
        }
      });
    } catch (e) {
      console.error('Failed to finish game', e);
    }
  },

  goBack() {
    wx.navigateBack();
  }
});
