Page({
  data: {
    openid: '',
    myNickname: '',
    isInvited: false
  },

  async onLoad(options) {
    // 获取当前用户 openid
    await this.getOpenId();
    // 获取个人信息用于展示
    this.fetchMyInfo();

    if (options.inviterId) {
      // 接收方进入，执行绑定逻辑
      console.log('Detected inviterId:', options.inviterId);
      this.setData({ isInvited: true });
      this.handleBind(options.inviterId);
    }
  },

  async fetchMyInfo() {
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: { type: 'getUserInfo' }
      });
      if (result && result.success && result.userInfo) {
        this.setData({
          myNickname: result.userInfo.nickname
        });
      }
    } catch (e) {
      console.error('获取个人信息失败', e);
    }
  },

  async getOpenId() {
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: { type: 'getOpenId' }
      });
      this.setData({ openid: result.openid });
      // 存入缓存供分享使用
      wx.setStorageSync('openid', result.openid);
    } catch (e) {
      console.error('获取 openid 失败', e);
    }
  },

  onShareAppMessage() {
    const openid = this.data.openid || wx.getStorageSync('openid');
    return {
      title: '诚邀您共同书写私人手札',
      path: `/pages/bind/bind?inviterId=${openid}`,
      imageUrl: '/miniprogram/images/share_card.png' // 这里的路径可以根据实际情况调整
    };
  },

  async handleBind(inviterId) {
    wx.showLoading({ title: '绑定中...' });
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: {
          type: 'linkRelationship',
          data: { inviterId }
        }
      });

      wx.hideLoading();
      if (result.success) {
        wx.showToast({ title: '绑定成功', icon: 'success' });
        setTimeout(() => {
          wx.switchTab({ url: '/pages/index/index' });
        }, 1500);
      } else {
        wx.showModal({
          title: '绑定失败',
          content: result.errMsg || '未知错误',
          showCancel: false
        });
      }
    } catch (e) {
      wx.hideLoading();
      wx.showModal({
        title: '错误',
        content: '请求失败，请稍后重试',
        showCancel: false
      });
      console.error(e);
    }
  }
});
