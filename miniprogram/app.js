// app.js
const { envList } = require('./envList.js');

App({
  onLaunch: function () {
    this.globalData = {
      // env 参数说明：
      // env 参数决定接下来小程序发起的云开发调用（wx.cloud.xxx）会请求到哪个云环境的资源
      // 此处请填入环境 ID, 环境 ID 可在微信开发者工具右上顶部工具栏点击云开发按钮打开获取
      env: envList[0].envId,
      moodList: [
        {icon: 'work', label: '工作中'},
        {icon: 'tired', label: '累了'},
        {icon: 'hug', label: '求抱抱'},
        {icon: 'happy', label: '开心'}
      ]
    };
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
    } else {
      wx.cloud.init({
        env: this.globalData.env,
        traceUser: true,
      });

      // 异步加载霞鹜文楷字体 (LXGW WenKai)
      wx.loadFontFace({
        family: 'LXGW WenKai',
        source: 'url("https://cdn.jsdelivr.net/gh/chawyehsu/lxgw-wenkai-webfont@v1.1.0/lxgw-wenkai-screen.css")',
        success: console.log,
        fail: console.error
      });

      // 静默登录与初始化串联
      this.doSilentLogin();
    }
  },

  async doSilentLogin() {
    try {
      // 1. 获取 OpenID
      let openid = wx.getStorageSync('openid');
      if (!openid) {
        const { result } = await wx.cloud.callFunction({
          name: 'quickstartFunctions',
          data: { type: 'getOpenId' }
        });
        openid = result.openid;
        wx.setStorageSync('openid', openid);
      }

      // 2. 确保用户底档存在
      await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: { type: 'ensureUserRecord' }
      });

      // 3. 初始化 TabBar 图标
      this.initTabBarMood();

      // 4. (可选) 自动初始化集合
      wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: { type: 'createCollection' }
      });

    } catch (e) {
      console.error('Silent login failed', e);
    }
  },

  /**
   * 初始化 TabBar 心情图标与文字
   */
  initTabBarMood: function () {
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: { type: 'getUserInfo' }
    }).then(res => {
      if (res.result && res.result.success && res.result.userInfo) {
        const { mood } = res.result.userInfo;
        const moodItem = this.globalData.moodList.find(m => m.icon === mood || m.label === mood);
        const label = moodItem ? moodItem.label : (mood || '我');
        const icon = moodItem ? moodItem.icon : mood;
        this.updateMoodTab(icon, label);
      }
    });
  },

  /**
   * 动态更新 TabBar 项 (索引为 2 的 “我”)
   * @param {string} moodIcon 心情图标名称
   * @param {string} moodLabel 心情文案
   */
  updateMoodTab: function (moodIcon, moodLabel) {
    const iconMap = {
      'work': 'work.png', 
      'tired': 'tired.png', 
      'hug': 'hug.png', 
      'happy': 'happy.png'
    };
    const iconFile = iconMap[moodIcon] || 'quill.png'; // 非预设则使用羽毛笔图标
    
    // 限制文案长度，防止 TabBar 显示异常
    const displayLabel = (moodLabel && moodLabel.length > 4) ? moodLabel.substring(0, 3) + '..' : (moodLabel || '我');
    const iconPath = `/images/icons/${iconFile}`;

    wx.setTabBarItem({
      index: 2,
      text: displayLabel,
      iconPath: iconPath,
      selectedIconPath: iconPath,
      success: () => {
        console.log(`TabBar updated: ${displayLabel} (${iconFile})`);
      },
      fail: (err) => {
        console.error('updateMoodTab failed', err);
      }
    });
  }
});
