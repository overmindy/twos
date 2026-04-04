// pages/archive/index.js
const db = wx.cloud.database();

Page({
  data: {
    historyList: [],
    relationship: null,
    loading: true
  },

  onLoad(options) {
    this.fetchRelationship();
  },

  onShow() {
    this.fetchRelationship();
  },

  /**
   * 获取当前关联关系并拉取历史
   */
  fetchRelationship() {
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: { type: 'getOpenId' }
    }).then(res => {
      if (res && res.result && res.result.openid) {
        const openid = res.result.openid;
        const _ = db.command;
        db.collection('relationships').where(_.or([
          { userA: openid, status: 'active' },
          { userB: openid, status: 'active' }
        ])).get().then(res => {
          if (res.data.length > 0) {
            const rel = res.data[0];
            this.setData({ relationship: rel });
            this.fetchHistory(rel._id, openid);
          } else {
            this.setData({ loading: false });
            wx.showToast({ title: '未找到关联关系', icon: 'none' });
          }
        });
      }
    });
  },

  /**
   * 拉取历史问答
   */
  fetchHistory(relationshipId, myOpenid) {
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'getHistoryAnswers',
        data: { relationshipId }
      }
    }).then(res => {
      if (res && res.result && res.result.success) {
        const processedList = res.result.data.map(item => {
          const myAnswer = item.answers.find(a => a.openid === myOpenid);
          const partnerAnswer = item.answers.find(a => a.openid !== myOpenid);
          
          return {
            dateStr: this.formatDate(item.createTime),
            questionContent: item.questionContent,
            // 我的回答
            answerA: myAnswer ? myAnswer.content : '未作答',
            typeA: myAnswer ? myAnswer.type : 'text',
            mediaUrlA: myAnswer ? myAnswer.mediaUrl : '',
            privacyA: myAnswer ? myAnswer.privacy : 'public',
            // 对方回答
            answerB: partnerAnswer ? partnerAnswer.content : '未作答',
            typeB: partnerAnswer ? partnerAnswer.type : 'text',
            mediaUrlB: partnerAnswer ? partnerAnswer.mediaUrl : '',
            privacyB: partnerAnswer ? partnerAnswer.privacy : 'public'
          };
        });
        
        this.setData({
          historyList: processedList,
          loading: false
        });
      } else {
        this.setData({ loading: false });
      }
    }).catch(err => {
      console.error(err);
      this.setData({ loading: false });
    });
  },

  onPlayAnswerVoice(e) {
    const { url } = e.currentTarget.dataset;
    if (!url) return;
    const innerAudioContext = wx.createInnerAudioContext();
    innerAudioContext.src = url;
    innerAudioContext.play();
    wx.showToast({
      title: '正在回响...',
      icon: 'none'
    });
  },

  onPreviewAnswerImage(e) {
    const { url } = e.currentTarget.dataset;
    if (!url) return;
    wx.previewImage({
      urls: [url],
      current: url
    });
  },

  /**
   * 格式化日期
   */
  formatDate(date) {
    const d = new Date(date);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const year = d.getFullYear();
    
    // 返回类似 "2024.04.02" 或 "四月二日" 的风格
    // 这里采用暖色调书卷感，使用点号分割
    return `${year}.${month < 10 ? '0' + month : month}.${day < 10 ? '0' + day : day}`;
  }
})
