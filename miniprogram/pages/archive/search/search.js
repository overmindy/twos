// miniprogram/pages/archive/search/search.js
Page({
  data: {
    relationshipId: '',
    keyword: '',
    results: [],
    loading: false,
    searched: false
  },

  onLoad(options) {
    const relationshipId = options.relationshipId || wx.getStorageSync('currentRelationshipId');
    this.setData({ relationshipId });
  },

  onInput(e) {
    this.setData({ keyword: e.detail.value });
  },

  async onSearch() {
    const { keyword, relationshipId } = this.data;
    if (!keyword.trim()) return;

    this.setData({ loading: true, searched: true });
    wx.showLoading({ title: '搜寻中...' });

    try {
      const { result } = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: { type: 'searchHistory', data: { relationshipId, keyword } }
      });

      if (result && result.success) {
        const results = result.list.map(item => ({
          ...item,
          dateStr: this.formatDate(new Date(item.createTime)),
          author: item.openid === wx.getStorageSync('openid') ? '我' : 'Ta'
        }));
        this.setData({ results });
      }
    } catch (e) {
      console.error(e);
    } finally {
      this.setData({ loading: false });
      wx.hideLoading();
    }
  },

  formatDate(date) {
    return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
  },

  goBack() {
    wx.navigateBack();
  }
});
