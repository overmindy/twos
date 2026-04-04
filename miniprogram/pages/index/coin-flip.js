const db = wx.cloud.database();

Page({
  data: {
    flipping: false,
    result: 'head',
    flipCount: 0,
    showResult: false,
    watcher: null,
    lastGameId: ''
  },

  onLoad() {
    this.initWatcher();
  },

  onUnload() {
    if (this.data.watcher) {
      this.data.watcher.close();
    }
  },

  initWatcher() {
    const watcher = db.collection('games')
      .where({
        type: 'coin'
      })
      .orderBy('createTime', 'desc')
      .limit(1)
      .watch({
        onChange: (snapshot) => {
          if (snapshot.docs.length > 0) {
            const game = snapshot.docs[0];
            
            // Only trigger if it's a new record we haven't processed
            if (game._id !== this.data.lastGameId) {
              const now = new Date().getTime();
              const createTime = game.createTime ? new Date(game.createTime).getTime() : now;
              
              if (now - createTime < 10000) { // Within 10 seconds
                this.setData({ lastGameId: game._id });
                this.performFlip(game.result);
              } else {
                if (!this.data.lastGameId) {
                  this.setData({ 
                    lastGameId: game._id,
                    result: game.result,
                    showResult: true
                  });
                }
              }
            }
          }
        },
        onError: (err) => {
          console.error('Watcher error', err);
        }
      });
    this.setData({ watcher });
  },

  startFlip() {
    if (this.data.flipping) return;

    // Show a loading toast while communicating with cloud
    wx.showLoading({ title: '墨落纸上...' });

    const relationshipId = wx.getStorageSync('currentRelationshipId') || '';

    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'flipCoin',
        data: {
          relationshipId: relationshipId
        }
      }
    }).then(res => {
      wx.hideLoading();
      if (res.result && res.result.success) {
        console.log('Game record created by cloud');
      } else {
        wx.showToast({ title: '笔墨凝滞', icon: 'none' });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('Failed to call flipCoin', err);
      wx.showToast({ title: '笔墨凝滞', icon: 'none' });
    });
  },

  performFlip(result) {
    if (this.data.flipping) return;

    // Incremental flip count to ensure animation always plays. 
    // We want it to end on the correct side.
    let baseRotation = 14 + Math.floor(Math.random() * 4); // 14-18 half-turns
    if (result === 'head' && baseRotation % 2 !== 0) baseRotation++;
    if (result === 'tail' && baseRotation % 2 === 0) baseRotation++;

    this.setData({
      flipping: true,
      showResult: false,
      flipCount: baseRotation
    });

    // Wait for 2.5 seconds animation (synced with CSS transition)
    setTimeout(() => {
      this.setData({
        flipping: false,
        result: result,
        showResult: true
      });
    }, 2500);
  }
});