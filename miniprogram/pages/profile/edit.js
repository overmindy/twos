// miniprogram/pages/profile/edit.js
const db = wx.cloud.database();

Page({
  data: {
    userInfo: {
      avatarUrl: '',
      nickname: '',
      mood: ''
    },
    openid: ''
  },

  onLoad() {
    this.getOpenIdAndFetchUserInfo();
  },

  async getOpenIdAndFetchUserInfo() {
    try {
      let openid = wx.getStorageSync('openid');
      if (!openid) {
        const { result } = await wx.cloud.callFunction({
          name: 'quickstartFunctions',
          data: { type: 'getOpenId' }
        });
        openid = result.openid;
        wx.setStorageSync('openid', openid);
      }
      this.setData({ openid });
      
      // 先强制确保记录存在
      await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: { type: 'ensureUserRecord' }
      });
      
      this.fetchUserInfo();
    } catch (e) {
      console.error('获取用户信息失败', e);
    }
  },

  fetchUserInfo() {
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: { type: 'getUserInfo' }
    }).then(res => {
      if (res.result && res.result.success && res.result.userInfo) {
        this.setData({
          userInfo: res.result.userInfo
        });
      }
    }).catch(err => {
      console.error('获取用户信息失败', err);
    });
  },

  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    this.setData({
      'userInfo.avatarUrl': avatarUrl
    });
  },

  onInputNickname(e) {
    this.setData({
      'userInfo.nickname': e.detail.value
    });
  },

  onInputMood(e) {
    this.setData({
      'userInfo.mood': e.detail.value
    });
  },

  async saveProfile() {
    const { userInfo, openid } = this.data;
    if (!userInfo.nickname) {
      wx.showToast({ title: '请输入称谓', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '镌刻中...' });

    try {
      // 如果头像是在本地临时路径，先上传
      let finalAvatarUrl = userInfo.avatarUrl;
      if (finalAvatarUrl && (finalAvatarUrl.startsWith('http://tmp') || finalAvatarUrl.startsWith('wxfile://'))) {
        const cloudPath = `avatars/${openid}_${Date.now()}.png`;
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath,
          filePath: finalAvatarUrl
        });
        finalAvatarUrl = uploadRes.fileID;
      }

      const updateData = {
        avatarUrl: finalAvatarUrl,
        nickname: userInfo.nickname,
        mood: userInfo.mood
      };

      // 调用云函数，统一处理用户信息更新与关系镜像同步
      const { result } = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: {
          type: 'updateUserInfo',
          data: {
            userInfo: updateData
          }
        }
      });

      if (result && result.success) {
        wx.hideLoading();
        wx.showToast({ title: '已镌刻', icon: 'success' });
        
        // 更新 TabBar
        const app = getApp();
        const moodItem = app.globalData.moodList.find(m => m.icon === updateData.mood || m.label === updateData.mood);
        const label = moodItem ? moodItem.label : (updateData.mood || '我');
        const icon = moodItem ? moodItem.icon : updateData.mood;
        app.updateMoodTab(icon, label);

        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      } else {
        throw new Error(result ? result.errMsg : '更新失败');
      }
    } catch (e) {
      wx.hideLoading();
      wx.showModal({
        title: '失败',
        content: `数据同步失败：${e.message || '未知错误'}`,
        showCancel: false
      });
      console.error(e);
    }
  }
});
