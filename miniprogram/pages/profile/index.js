// pages/profile/index.js
const db = wx.cloud.database();

Page({
  data: {
    relationship: null,
    userInfo: {
      nickname: '',
      avatarUrl: '',
      mood: ''
    },
    stats: { daysTogether: 0, totalAnswers: 0 },
    partnerInfo: {
      nickname: '',
      avatarUrl: '',
      mood: ''
    },
    showAnimalPicker: false,
    animalPairs: [
      { name: '狐狸与兔子', me: 'fox', partner: 'rabbit', label: '灵动与纯真' },
      { name: '猫与鱼', me: 'cat', partner: 'fish', label: '陪伴与自由' },
      { name: '树懒与树', me: 'sloth', partner: 'tree', label: '安稳与依托' },
      { name: '企鹅与冰山', me: 'penguin', partner: 'ice', label: '坚定与守护' },
      { name: '小狗与骨头', me: 'dog', partner: 'bone', label: '忠诚与欢喜' }
    ]
  },

  onLoad() {
    this.initData();
  },

  onShow() {
    this.initData();
  },

  async initData() {
    await this.fetchUserInfo();
    await this.fetchRelationship();
  },


  async fetchStats(relationshipId) {
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: {
          type: 'getHistoryAnswers',
          data: { relationshipId }
        }
      });
      if (result && result.success) {
        const totalAnswers = result.data.length;

        let daysTogether = 0;
        if (this.data.relationship && this.data.relationship.createTime) {
          const createDate = new Date(this.data.relationship.createTime);
          const now = new Date();
          daysTogether = Math.floor((now - createDate) / (1000 * 60 * 60 * 24)) + 1;
        }

        this.setData({ stats: { daysTogether, totalAnswers } });
      }
    } catch (e) {
      console.error('Fetch stats failed', e);
    }
  },

  /**
   * 获取当前关联关系
   */
  async fetchRelationship() {
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: { type: 'getActiveRelationship' }
    }).then(res => {
      if (res.result && res.result.success && res.result.relationship) {
        const rel = res.result.relationship;
        const myOpenid = wx.getStorageSync('openid');
        const isUserA = rel.userA === myOpenid;

        // 从镜像字段提取对方信息
        const partnerInfo = isUserA ? (rel.userBInfo || {}) : (rel.userAInfo || {});

        this.setData({
          relationship: rel,
          partnerInfo: {
            nickname: partnerInfo.nickname || '另一方',
            avatarUrl: partnerInfo.avatarUrl || '',
            mood: partnerInfo.mood || ''
          }
        });
        this.fetchStats(rel._id);
      } else {
        this.setData({
          relationship: null,
          partnerInfo: { nickname: '', avatarUrl: '', mood: '' }
        });
      }
    }).catch(err => {
      console.error('Fetch relationship failed', err);
    });
  },

  /**
   * 获取用户信息
   */
  async fetchUserInfo() {
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: { type: 'getUserInfo' }
    }).then(res => {
      if (res.result && res.result.success && res.result.userInfo) {
        const { userInfo } = res.result;
        this.setData({ userInfo });

        // 同步更新 TabBar
        const app = getApp();
        const moodItem = app.globalData.moodList.find(m => m.icon === userInfo.mood || m.label === userInfo.mood);
        const label = moodItem ? moodItem.label : (userInfo.mood || '我');
        const icon = moodItem ? moodItem.icon : userInfo.mood;
        app.updateMoodTab(icon, label);
      }
    }).catch(err => {
      console.warn('Fetch user info failed', err);
    });
  },

  /**
   * 点击 结缘 印章
   */
  onTapBind() {
    if (this.data.relationship) {
      wx.showActionSheet({
        itemList: ['解除绑定', '查看对方信息'],
        success: (res) => {
          if (res.tapIndex === 0) {
            this.unbindRelationship();
          }
        }
      });
    } else {
      wx.navigateTo({
        url: '/pages/bind/bind'
      });
    }
  },

  /**
   * 点击 个人设置 印章 (名/容/意)
   */
  onTapEdit(e) {
    const { type } = e.currentTarget.dataset;
    if (type === 'avatar') {
      this.setData({ showAnimalPicker: true });
    } else {
      wx.navigateTo({
        url: `/pages/profile/edit?type=${type}`
      });
    }
  },

  onCloseAnimalPicker() {
    this.setData({ showAnimalPicker: false });
  },

  stopBubbling() {
    // 阻止冒泡
  },

  async onSelectAnimal(e) {
    const { animal } = e.currentTarget.dataset;
    wx.showLoading({ title: '铭刻形象...' });
    
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: {
          type: 'updateUserInfo',
          data: {
            userInfo: { avatarUrl: `../../images/icons/${animal}.png` } 
          }
        }
      });

      if (result && result.success) {
        this.setData({ showAnimalPicker: false });
        await this.fetchUserInfo();
        wx.showToast({ title: '形象已更新', icon: 'success' });
      }
    } catch (e) {
      console.error(e);
      wx.showToast({ title: '铭刻失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  unbindRelationship() {
    wx.showModal({
      title: '斩断尘缘',
      content: '确定要解开与另一方的羁绊吗？所有的成长记录将封存。',
      confirmColor: '#B22222',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...' });
          wx.cloud.callFunction({
            name: 'quickstartFunctions',
            data: {
              type: 'unbindRelationship',
              data: {} // 遵循参数标准化结构
            }
          }).then(res => {
            wx.hideLoading();
            if (res.result && res.result.success) {
              wx.showToast({ title: '已解开尘缘', icon: 'success' });
              this.setData({ relationship: null });
              wx.removeStorageSync('currentRelationshipId');

              // 刷新首页状态
              const pages = getCurrentPages();
              const indexPage = pages.find(p => p.route === 'pages/index/index');
              if (indexPage) {
                // 立即重置首页关系状态并重新加载
                indexPage.setData({ relationship: null });
                if (indexPage.fetchRelationship) {
                  indexPage.fetchRelationship();
                } else {
                  indexPage.onLoad();
                }
              }
            } else {
              wx.showToast({ title: (res.result && res.result.errMsg) || '解绑失败', icon: 'none' });
            }
          }).catch(err => {
            wx.hideLoading();
            console.error('Unbind failed', err);
            wx.showToast({ title: '请求失败', icon: 'none' });
          });
        }
      }
    });
  },

  /**
   * 点击 踪迹 印章
   */

  async onTapWrapped() {
    if (!this.data.relationship) return;
    
    wx.showLoading({ title: '回溯时光...' });
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: {
          type: 'getTwosWrapped',
          data: { relationshipId: this.data.relationship._id }
        }
      });

      if (result && result.success) {
        const d = result.data;
        wx.hideLoading();
        wx.showModal({
          title: '我们的年志 · 摘要',
          content: `相伴的 ${d.totalDays} 天里，\n我们共同留下了 ${d.answerCount} 份墨迹。\n累积了 ${d.energy} 点羁绊能量。\n\n你最常以「${d.topMood}」的心境，\n走向对方。`,
          showCancel: false,
          confirmText: '温习',
          confirmColor: '#B22222'
        });
      }
    } catch (e) {
      wx.hideLoading();
      console.error(e);
    }
  },

  onTapLocation() {
    if (!this.data.relationship) {
      wx.showToast({ title: '尚未建立羁绊', icon: 'none' });
      return;
    }

    wx.authorize({
      scope: 'scope.userLocation',
      success: () => {
        // 先同步一次位置，然后跳转
        this.syncLocation();
        wx.navigateTo({
          url: '/pages/profile/location?relationshipId=' + this.data.relationship._id
        });
      },
      fail: () => {
        wx.showModal({
          title: '位置授权',
          content: '请在设置中开启位置权限，以查看对方位置。',
          success: (res) => {
            if (res.confirm) {
              wx.openSetting();
            }
          }
        });
      }
    });
  },
  syncLocation() {
    wx.showLoading({ title: '定位中...' });
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        const { latitude, longitude } = res;
        const myOpenid = wx.getStorageSync('openid');
        const isUserA = this.data.relationship.userA === myOpenid;
        const updateData = {};
        if (isUserA) {
          updateData.userALocation = { latitude, longitude, updateTime: db.serverDate() };
        } else {
          updateData.userBLocation = { latitude, longitude, updateTime: db.serverDate() };
        }

        db.collection('relationships').doc(this.data.relationship._id).update({
          data: updateData
        }).then(() => {
          wx.hideLoading();
          wx.showToast({ title: '位置已同步', icon: 'none' });
        });
      },
      fail: (err) => {
        wx.hideLoading();
        console.warn('Get location failed', err);
      }
    });
  }
});
