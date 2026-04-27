// pages/index/bucket-list/bucket-list.js
const db = wx.cloud.database();

Page({
  data: {
    relationshipId: '',
    list: [],
    completedCount: 0,
    totalCount: 0,
    newItemTitle: '',
    loading: false
  },

  onLoad(options) {
    const relationshipId = options.relationshipId || wx.getStorageSync('currentRelationshipId');
    this.setData({ relationshipId });
    this.fetchList();
  },

  onPullDownRefresh() {
    this.fetchList().then(() => wx.stopPullDownRefresh());
  },

  async fetchList() {
    if (!this.data.relationshipId) return;
    this.setData({ loading: true });

    try {
      const { data } = await db.collection('bucket_lists')
        .where({ relationshipId: this.data.relationshipId })
        .orderBy('createTime', 'desc')
        .get();

      const list = data.map(item => ({
        ...item,
        completedTimeStr: item.completedTime ? this.formatDate(new Date(item.completedTime)) : ''
      }));

      this.calculateProgress(list);
    } catch (e) {
      console.error(e);
    } finally {
      this.setData({ loading: false });
    }
  },

  calculateProgress(list) {
    const totalCount = list.length;
    const completedCount = list.filter(i => i.completed).length;
    this.setData({ list, totalCount, completedCount });
  },

  async onToggleItem(e) {
    const { id, index } = e.currentTarget.dataset;
    const item = this.data.list[index];
    const newStatus = !item.completed;

    wx.vibrateShort({ type: 'medium' });

    try {
      await db.collection('bucket_lists').doc(id).update({
        data: {
          completed: newStatus,
          completedTime: newStatus ? db.serverDate() : null
        }
      });
      
      if (newStatus) {
        wx.showToast({ title: '点亮心愿 ✨', icon: 'none' });
      }
      this.fetchList();
    } catch (e) {
      console.error(e);
    }
  },

  onInputNewItem(e) {
    this.setData({ newItemTitle: e.detail.value });
  },

  async onAddItem() {
    const title = this.data.newItemTitle.trim();
    if (!title || !this.data.relationshipId) return;

    wx.showLoading({ title: '埋下心愿...' });
    try {
      await db.collection('bucket_lists').add({
        data: {
          relationshipId: this.data.relationshipId,
          title,
          completed: false,
          createTime: db.serverDate()
        }
      });
      this.setData({ newItemTitle: '' });
      this.fetchList();
      wx.hideLoading();
    } catch (e) {
      wx.hideLoading();
      console.error(e);
    }
  },

  formatDate(date) {
    return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;
  },

  goBack() {
    wx.navigateBack();
  }
});
