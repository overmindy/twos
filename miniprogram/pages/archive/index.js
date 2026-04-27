// pages/archive/index.js
const db = wx.cloud.database();

Page({
  data: {
    historyList: [],
    groupedList: [],
    relationship: null,
    loading: true,
    calendarBlocks: []
  },

  onShow() {
    this.fetchRelationship();
  },

  /**
   * 获取当前关联关系并拉取历史
   */
  async fetchRelationship() {
    this.setData({ loading: true });
    try {
      const { result: relRes } = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: { type: 'getActiveRelationship' }
      });

      if (relRes.success && relRes.relationship) {
        const rel = relRes.relationship;
        const myOpenid = wx.getStorageSync('openid');
        this.setData({ relationship: rel });
        this.fetchHistory(rel._id, myOpenid);
        this.fetchCalendar(rel._id);
      } else {
        this.setData({ loading: false });
      }
    } catch (e) {
      console.error(e);
      this.setData({ loading: false });
    }
  },

  /**
   * 拉取历史问答并分组
   */
  async fetchHistory(relationshipId, myOpenid) {
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: { type: 'getHistoryAnswers', data: { relationshipId } }
      });

      if (result && result.success) {
        const processedList = result.data.map(item => {
          const myAnswer = item.answers.find(a => a.openid === myOpenid);
          const partnerAnswer = item.answers.find(a => a.openid !== myOpenid);
          return {
            dateStr: this.formatDate(item.createTime),
            rawDate: new Date(item.createTime),
            questionContent: item.questionContent,
            answerA: myAnswer ? myAnswer.content : '未作答',
            typeA: myAnswer ? myAnswer.type : 'text',
            mediaUrlA: myAnswer ? myAnswer.mediaUrl : '',
            privacyA: myAnswer ? myAnswer.privacy : 'public',
            answerB: partnerAnswer ? partnerAnswer.content : '未作答',
            typeB: partnerAnswer ? partnerAnswer.type : 'text',
            mediaUrlB: partnerAnswer ? partnerAnswer.mediaUrl : '',
            privacyB: partnerAnswer ? partnerAnswer.privacy : 'public'
          };
        });

        // 按月分组逻辑
        const groupedMap = {};
        processedList.forEach(item => {
          const monthKey = `${item.rawDate.getFullYear()}年${item.rawDate.getMonth() + 1}月`;
          if (!groupedMap[monthKey]) groupedMap[monthKey] = [];
          groupedMap[monthKey].push(item);
        });

        const groupedList = Object.keys(groupedMap).map(key => ({
          month: key,
          items: groupedMap[key]
        }));

        this.setData({ historyList: processedList, groupedList, loading: false });
      }
    } catch (e) {
      console.error(e);
      this.setData({ loading: false });
    }
  },

  /**
   * 获取并生成情绪日历矩阵
   */
  async fetchCalendar(relationshipId) {
    const year = new Date().getFullYear();
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: { type: 'getMoodCalendar', data: { relationshipId, year } }
      });

      if (result && result.success) {
        const cloudCalendar = result.calendar;
        const blocks = [];
        const now = new Date();
        
        // 生成最近 100 天的格子 (适配手机屏幕宽度)
        for (let i = 100; i >= 0; i--) {
          const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
          const dateStr = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
          const moods = cloudCalendar[dateStr] || [];
          blocks.push({
            date: dateStr,
            topMood: moods.length > 0 ? moods[0] : 'none'
          });
        }
        this.setData({ calendarBlocks: blocks });
      }
    } catch (e) { console.error(e); }
  },

  onPreviewAnswerImage(e) {
    const { url } = e.currentTarget.dataset;
    if (!url) return;
    wx.previewImage({ urls: [url], current: url });
  },

  onGoToSearch() {
    if (!this.data.relationship) return;
    wx.navigateTo({
      url: `/pages/archive/search/search?relationshipId=${this.data.relationship._id}`
    });
  },

  formatDate(date) {
    const d = new Date(date);
    return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
  }
});
