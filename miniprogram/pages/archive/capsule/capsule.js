// miniprogram/pages/archive/capsule/capsule.js
const db = wx.cloud.database();

Page({
  data: {
    relationshipId: '',
    list: [],
    showCreate: false,
    showOpen: false,
    newContent: '',
    openDate: '',
    today: '',
    openedContent: '',
    openedDate: ''
  },

  onLoad(options) {
    const relationshipId = options.relationshipId || wx.getStorageSync('currentRelationshipId');
    const today = this.formatDate(new Date());
    this.setData({ 
      relationshipId, 
      today,
      openDate: today
    });
    this.fetchCapsules();
  },

  async fetchCapsules() {
    if (!this.data.relationshipId) return;
    wx.showLoading({ title: '寻觅时光...' });

    try {
      const { result } = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: {
          type: 'getCapsules',
          data: { relationshipId: this.data.relationshipId }
        }
      });

      if (result && result.success) {
        const now = new Date();
        const list = result.list.map(item => {
          const openTime = new Date(item.openTime);
          return {
            ...item,
            openTimeStr: this.formatDate(openTime),
            canOpen: now >= openTime
          };
        });
        this.setData({ list });
      }
    } catch (e) {
      console.error(e);
    } finally {
      wx.hideLoading();
    }
  },

  onShowCreate() { this.setData({ showCreate: true }); },
  onHideCreate() { this.setData({ showCreate: false }); },
  onInputContent(e) { this.setData({ newContent: e.detail.value }); },
  onDateChange(e) { this.setData({ openDate: e.detail.value }); },

  async onSubmitCapsule() {
    const { newContent, openDate, relationshipId } = this.data;
    if (!newContent.trim()) {
      wx.showToast({ title: '请留下寄语', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '封存中...' });
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: {
          type: 'createCapsule',
          data: {
            relationshipId,
            content: newContent,
            openTime: openDate
          }
        }
      });

      if (result.success) {
        wx.showToast({ title: '已封存', icon: 'success' });
        this.setData({ showCreate: false, newContent: '' });
        this.fetchCapsules();
      }
    } catch (e) {
      console.error(e);
    } finally {
      wx.hideLoading();
    }
  },

  onOpenCapsule(e) {
    const { index } = e.currentTarget.dataset;
    const capsule = this.data.list[index];

    if (!capsule.canOpen) {
      wx.showToast({ title: '时光未至，无法揭缄', icon: 'none' });
      return;
    }

    this.setData({
      showOpen: true,
      openedContent: capsule.content,
      openedDate: this.formatDate(new Date(capsule.createTime))
    });
    wx.vibrateLong();
  },

  onHideOpen() { this.setData({ showOpen: false }); },

  stopBubbling() {},

  formatDate(date) {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
});
