// index.js
import { TreeDrawer } from '../../utils/tree-drawer';
const db = wx.cloud.database();

Page({
  data: {
    isUnfolding: false,
    bondingTreeContext: null,
    relationship: null,
    todayQuestion: null,
    myAnswer: null,
    partnerAnswer: null,
    watcher: null,
    relWatcher: null,
    inkCanvasContext: null,
    inkCanvasNode: null,
    showMoodModal: false,
    moodList: [
      {icon: 'work', label: '工作中'},
      {icon: 'tired', label: '累了'},
      {icon: 'hug', label: '求抱抱'},
      {icon: 'happy', label: '开心'}
    ],
    weatherInfo: {
      distance: null,
      partnerWeather: '晴',
      partnerMoodIcon: 'happy',
      partnerMoodLabel: '平常',
      partnerNickname: 'Ta',
      myMoodIcon: 'happy',
      myMoodLabel: '平常',
      myNickname: '我'
    },
    todayChineseDate: ''
  },

  treeDrawer: null,
  inkSmudges: [], // 存储活跃的墨迹动画
  resonanceTimer: null,
  locationTimer: null,

  onLoad() {
    const app = getApp();
    this.setData({
      todayChineseDate: this.getChineseDate(),
      moodList: app.globalData.moodList
    });
    this.initBondingTree();
    this.initInkCanvas();
    this.fetchRelationship();
    this.fetchTodayQuestion();
    
    // 确保用户底档存在
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: { type: 'ensureUserRecord' }
    });

    // 定时同步位置
    this.syncLocation();
    this.locationTimer = setInterval(() => {
      this.syncLocation();
    }, 1000 * 60 * 5); // 每 5 分钟更新一次
  },

  getChineseDate() {
    const months = ['壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖', '拾', '拾壹', '拾贰'];
    const days = ['壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖', '拾', '拾壹', '拾贰', '拾叁', '拾肆', '拾伍', '拾陆', '拾柒', '拾捌', '拾玖', '贰拾', '贰拾壹', '贰拾贰', '贰拾叁', '贰拾肆', '贰拾伍', '贰拾陆', '贰拾柒', '贰拾捌', '贰拾玖', '叁拾', '叁拾壹'];
    const now = new Date();
    return `${months[now.getMonth()]}月${days[now.getDate() - 1]}日`;
  },

  onShow() {
    if (!this.data.relationship) {
      this.fetchRelationship();
    } else {
      // 即使有关系，也刷新一下天气和位置
      this.updateWeatherStation(this.data.relationship);
      this.syncLocation();
    }

    // 每次显示时尝试重绘，以防能量值有变
    if (this.treeDrawer && this.data.relationship) {
      this.treeDrawer.draw(this.data.relationship.energy || 0);
    }
  },

  onUnload() {
    if (this.data.watcher) {
      this.data.watcher.close();
    }
    if (this.data.relWatcher) {
      this.data.relWatcher.close();
    }
    if (this.locationTimer) {
      clearInterval(this.locationTimer);
    }
  },

  /**
   * 定时同步位置与状态
   */
  syncLocation() {
    if (!this.data.relationship) return;

    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        const { latitude, longitude } = res;
        const myOpenid = wx.getStorageSync('openid');
        if (!myOpenid) return;

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
          console.log('Location updated');
        }).catch(err => {
          console.error('Location update failed', err);
        });
      },
      fail: (err) => {
        console.warn('Get location failed', err);
      }
    });
  },

  /**
   * 计算 Haversine 距离
   */
  calculateDistance(locA, locB) {
    if (!locA || !locB || !locA.latitude || !locB.latitude) return null;
    const R = 6371; // km
    const dLat = (locB.latitude - locA.latitude) * Math.PI / 180;
    const dLon = (locB.longitude - locA.longitude) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(locA.latitude * Math.PI / 180) * Math.cos(locB.latitude * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(1);
  },

  /**
   * 更新气象站 UI 数据
   */
  updateWeatherStation(rel) {
    const myOpenid = wx.getStorageSync('openid');
    if (!myOpenid || !rel) return;

    const isUserA = rel.userA === myOpenid;
    const partnerLoc = isUserA ? rel.userBLocation : rel.userALocation;
    const myLoc = isUserA ? rel.userALocation : rel.userBLocation;

    const distance = this.calculateDistance(myLoc, partnerLoc);

    // 从镜像信息中获取心情与基本信息 (Info Mirroring)
    const partnerInfo = isUserA ? (rel.userBInfo || {}) : (rel.userAInfo || {});
    const myInfo = isUserA ? (rel.userAInfo || {}) : (rel.userBInfo || {});

    // 健壮性：优先从镜像字段取，兼容旧字段，最后默认
    const partnerMoodIcon = partnerInfo.mood || (isUserA ? rel.userBMood : rel.userAMood) || 'happy';
    const myMoodIcon = myInfo.mood || (isUserA ? rel.userAMood : rel.userBMood) || 'happy';
    
    // 增加昵称同步
    const partnerNickname = partnerInfo.nickname || (isUserA ? (rel.userBNickname || 'Ta') : (rel.userANickname || 'Ta'));
    const myNickname = myInfo.nickname || (isUserA ? (rel.userANickname || '我') : (rel.userBNickname || '我'));

    const getMoodLabel = (icon) => {
      const mood = this.data.moodList.find(m => m.icon === icon);
      return mood ? mood.label : '平常';
    };

    const partnerMoodLabel = getMoodLabel(partnerMoodIcon);
    const myMoodLabel = getMoodLabel(myMoodIcon) === '平常' && myMoodIcon !== 'happy' ? myMoodIcon : getMoodLabel(myMoodIcon);
    
    // 同步更新 TabBar
    const app = getApp();
    if (app && app.updateMoodTab) {
      app.updateMoodTab(myMoodIcon, myMoodLabel);
    }

    // 模拟对方天气 (保持原样，后续可接入真实天气 API)
    const weathers = ['晴', '多云', '小雨', '阵雨', '阴'];
    const mockWeather = weathers[Math.floor(Math.random() * weathers.length)];

    this.setData({
      'weatherInfo.distance': distance || '--',
      'weatherInfo.partnerWeather': mockWeather,
      'weatherInfo.partnerMoodIcon': partnerMoodIcon,
      'weatherInfo.partnerMoodLabel': partnerMoodLabel,
      'weatherInfo.partnerNickname': partnerNickname,
      'weatherInfo.myMoodIcon': myMoodIcon,
      'weatherInfo.myMoodLabel': myMoodLabel,
      'weatherInfo.myNickname': myNickname
    });
  },

  /**
   * 点击气象站：弹出心情选择
   */
  onTapWeatherStation() {
    this.setData({
      showMoodModal: true
    });
  },

  /**
   * 关闭心情弹窗
   */
  onCloseMoodModal() {
    this.setData({
      showMoodModal: false
    });
  },

  /**
   * 阻止冒泡
   */
  stopBubbling() {
    // 仅为了阻止点击内容区关闭弹窗
  },

  /**
   * 选择心情
   */
  selectMood(e) {
    const moodItem = e.currentTarget.dataset.mood;
    const myOpenid = wx.getStorageSync('openid');
    if (!myOpenid || !this.data.relationship) return;

    // 调用云函数，统一处理心情更新与关系镜像同步
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'updateUserInfo',
        data: {
          userInfo: { mood: moodItem.icon }
        }
      }
    }).then(res => {
      if (res.result && res.result.success) {
        this.setData({ showMoodModal: false });
        
        // 更新 TabBar
        const app = getApp();
        if (app && app.updateMoodTab) {
          app.updateMoodTab(moodItem.icon, moodItem.label);
        }

        wx.showToast({
          title: `状态更新: ${moodItem.label}`,
          icon: 'none'
        });
      } else {
        throw new Error(res.result ? res.result.errMsg : '更新失败');
      }
    }).catch(err => {
      console.error('Mood update failed', err);
      wx.showToast({ title: '更新失败', icon: 'none' });
    });
  },

  /**
   * 获取当前关联关系
   */
  fetchRelationship() {
    wx.showLoading({ title: '正在连接手札...' });
    
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: { type: 'getActiveRelationship' }
    }).then(res => {
      wx.hideLoading();
      if (res && res.result && res.result.success && res.result.relationship) {
        const rel = res.result.relationship;
        const openid = wx.getStorageSync('openid');
        this.setData({ relationship: rel });
        wx.setStorageSync('currentRelationshipId', rel._id);
        this.updateWeatherStation(rel);
        this.startWatchingAnswers(rel._id);
        this.startWatchingRelationship(rel._id);
        this.syncLocation();
        this.fetchTodayQuestion();
        
        if (this.treeDrawer) {
          this.treeDrawer.draw(rel.energy || 0);
        }
      } else {
        // 未绑定关系，保持在首页（Solo模式）
        this.setData({ relationship: null });
        this.fetchTodayQuestion();
        console.log('User is in solo mode');
        const openid = wx.getStorageSync('openid');
        this.startWatchingAnswers('', openid);

        // Solo 模式下也同步更新 TabBar
        wx.cloud.callFunction({
          name: 'quickstartFunctions',
          data: { type: 'getUserInfo' }
        }).then(res => {
          if (res.result && res.result.success && res.result.userInfo) {
            const { userInfo } = res.result;
            const app = getApp();
            const moodItem = app.globalData.moodList.find(m => m.icon === userInfo.mood || m.label === userInfo.mood);
            const label = moodItem ? moodItem.label : (userInfo.mood || '我');
            const icon = moodItem ? moodItem.icon : userInfo.mood;
            app.updateMoodTab(icon, label);
          }
        });
      }
    }).catch(err => {
      wx.hideLoading();
      wx.showToast({ title: '书卷难以翻开', icon: 'none' });
      console.error('Fetch relationship failed', err);
    });
  },

  /**
   * 获取今日问题
   */
  fetchTodayQuestion() {
    const relationshipId = this.data.relationship ? this.data.relationship._id : '';
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: { 
        type: 'getDailyQuestion',
        data: { relationshipId }
      }
    }).then(res => {
      if (res && res.result && res.result.success) {
        this.setData({ todayQuestion: res.result.question });
      }
    }).catch(err => {
      console.error('Fetch question failed', err);
    });
  },

  /**
   * 监听今日答案
   */
  startWatchingAnswers(relationshipId, soloOpenid = '') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const whereObj = {
      relationshipId: relationshipId || '',
      createTime: db.command.gte(today)
    };
    if (!relationshipId && soloOpenid) {
      whereObj.openid = soloOpenid;
    }

    const watcher = db.collection('answers')
      .where(whereObj)
      .watch({
        onChange: (snapshot) => {
          const answers = snapshot.docs;
          this.processAnswers(answers);
        },
        onError: (err) => {
          console.error('Watch error', err);
        }
      });
    
    this.setData({ watcher });
  },

  processAnswers(answers) {
    if (!answers || !Array.isArray(answers)) return;
    
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: { type: 'getOpenId' }
    }).then(res => {
      if (res && res.result && res.result.openid) {
        const myOpenid = res.result.openid;
        const myAnswer = answers.find(a => a.openid === myOpenid) || null;
        const partnerAnswer = answers.find(a => a.openid !== myOpenid) || null;

        this.setData({
          myAnswer,
          partnerAnswer
        });

        // 如果双方都回答了，触发展开
        if (myAnswer && partnerAnswer) {
          this.setData({ isUnfolding: true });
          wx.vibrateLong();
        }
      }
    });
  },

  /**
   * 初始化“羁绊之树” Canvas
   */
  initBondingTree() {
    const query = wx.createSelectorQuery();
    query.select('#bondingTree')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res[0] || !res[0].node) return;
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');

        const { pixelRatio: dpr } = wx.getWindowInfo();
        canvas.width = res[0].width * dpr;
        canvas.height = res[0].height * dpr;
        ctx.scale(dpr, dpr);

        this.setData({ bondingTreeContext: ctx });
        
        // 初始化 TreeDrawer 实例
        this.treeDrawer = new TreeDrawer(canvas, ctx, res[0].width, res[0].height);
        
        // 如果已经有 relationship 数据，立即绘制
        if (this.data.relationship) {
          this.treeDrawer.draw(this.data.relationship.energy || 0);
        }
      });
  },

  /**
   * 点击预览生长动画
   */
  onPreviewGrowth() {
    if (!this.treeDrawer) return;

    wx.showToast({
      title: '时光加速中...',
      icon: 'none',
      duration: 1500
    });

    // 模拟未来能量增加后的效果，比如 +100 能量
    const currentEnergy = this.data.relationship.energy || 0;
    const previewTarget = currentEnergy + 100;
    
    this.treeDrawer.previewGrowth(previewTarget, 3000);
    
    // 3.5秒后自动恢复当前状态
    setTimeout(() => {
      if (this.treeDrawer) {
        this.treeDrawer.draw(this.data.relationship.energy || 0);
      }
    }, 3500);
  },

  /**
   * 跳转到止戈室
   */
  onGoToPeaceRoom() {
    if (!this.data.relationship) return;
    wx.navigateTo({
      url: `/pages/index/peace?relationshipId=${this.data.relationship._id}`
    });
  },

  /**
   * 跳转到小游戏
   */
  onGoToGames() {
    if (!this.data.relationship) return;
    wx.navigateTo({
      url: `/pages/index/games?relationshipId=${this.data.relationship._id}`
    });
  },

  /**
   * 点击纸片：触发展开动画或进入答题页
   */
  onTapPaper() {
    // 如果我还没回答，显示操作菜单
    if (!this.data.myAnswer) {
      const relationshipId = this.data.relationship ? this.data.relationship._id : '';
      const mode = this.data.relationship ? 'dual' : 'solo';

      if (mode === 'dual') {
        wx.showActionSheet({
          itemList: ['落笔今日之问', '换一题（刷新）', '我想出题（自定义）'],
          success: (res) => {
            if (res.tapIndex === 0) {
              wx.navigateTo({
                url: `/pages/index/answer?relationshipId=${relationshipId}`
              });
            } else if (res.tapIndex === 1) {
              this.refreshQuestion();
            } else if (res.tapIndex === 2) {
              this.showCustomQuestionInput();
            }
          }
        });
      } else {
        // Solo 模式
        wx.navigateTo({
          url: '/pages/index/answer?mode=solo'
        });
      }
      return;
    }

    // 已回答的情况，切换展开状态
    this.setData({
      isUnfolding: !this.data.isUnfolding
    });

    if (this.data.isUnfolding) {
      wx.vibrateShort({ type: 'light' });
    }
  },

  /**
   * 刷新今日题目
   */
  refreshQuestion() {
    if (!this.data.relationship) return;
    
    wx.showLoading({ title: '觅新题中...' });
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'refreshDailyQuestion',
        data: { relationshipId: this.data.relationship._id }
      }
    }).then(res => {
      wx.hideLoading();
      if (res && res.result && res.result.success) {
        this.setData({ todayQuestion: res.result.question });
        wx.showToast({ title: '已换一题', icon: 'success' });
      } else {
        wx.showToast({ title: res.result.errMsg || '刷新失败', icon: 'none' });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('Refresh question failed', err);
    });
  },

  /**
   * 显示自定义题目输入框
   */
  showCustomQuestionInput() {
    wx.showModal({
      title: '我想出题',
      placeholderText: '输入你想对 ta 提出的问题...',
      editable: true,
      success: (res) => {
        if (res.confirm && res.content) {
          this.setCustomQuestion(res.content);
        }
      }
    });
  },

  /**
   * 设置自定义题目
   */
  setCustomQuestion(content) {
    if (!this.data.relationship) return;

    wx.showLoading({ title: '墨迹晕染中...' });
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'setCustomQuestion',
        data: {
          relationshipId: this.data.relationship._id,
          content: content
        }
      }
    }).then(res => {
      wx.hideLoading();
      if (res && res.result && res.result.success) {
        this.setData({ todayQuestion: res.result.question });
        wx.showToast({ title: '题目已定', icon: 'success' });
      } else {
        wx.showToast({ title: res.result.errMsg || '设置失败', icon: 'none' });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('Set custom question failed', err);
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
   * 监听关系更新 (用于接收共振信号)
   */
  startWatchingRelationship(id) {
    const relWatcher = db.collection('relationships').doc(id).watch({
      onChange: (snapshot) => {
        if (snapshot.docs.length > 0) {
          const newRel = snapshot.docs[0];
          const oldRel = this.data.relationship;
          
          // 检查 lastResonance 是否更新（且不是自己触发的）
          if (newRel.lastResonance && (!oldRel.lastResonance || new Date(newRel.lastResonance).getTime() > new Date(oldRel.lastResonance).getTime())) {
            const myOpenid = wx.getStorageSync('openid');
            if (newRel.lastTriggerBy !== myOpenid) {
               this.triggerPartnerResonance();
            }
          }
          this.setData({ relationship: newRel });
          this.updateWeatherStation(newRel);
        }
      },
      onError: (err) => console.error('Rel watch error', err)
    });
    this.setData({ relWatcher });
  },

  /**
   * 接收到对方共振信号
   */
  triggerPartnerResonance() {
    wx.vibrateLong();
    // 在随机位置触发一个小墨印
    const x = Math.random() * 300 + 50;
    const y = Math.random() * 500 + 100;
    this.createInkSmudge(x, y, true);
  },

  /**
   * 初始化墨色晕染 Canvas
   */
  initInkCanvas() {
    const query = wx.createSelectorQuery();
    query.select('#inkCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res[0] || !res[0].node) return;
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const { pixelRatio: dpr } = wx.getWindowInfo();
        canvas.width = res[0].width * dpr;
        canvas.height = res[0].height * dpr;
        ctx.scale(dpr, dpr);
        this.setData({ inkCanvasContext: ctx, inkCanvasNode: canvas });
        this.startInkAnimationLoop();
      });
  },

  /**
   * 开始共振：按下
   */
  onResonanceStart(e) {
    if (!this.data.relationship) {
      wx.showToast({
        title: '正在连接手札...',
        icon: 'none'
      });
      return;
    }
    
    const touch = e.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;
    
    wx.vibrateShort({ type: 'medium' });
    this.createInkSmudge(x, y);

    // 计时器：长按 1.5s 触发同步
    this.resonanceTimer = setTimeout(() => {
      this.sendResonanceSignal();
    }, 1500);
  },

  /**
   * 结束共振：抬起
   */
  onResonanceEnd() {
    if (this.resonanceTimer) {
      clearTimeout(this.resonanceTimer);
      this.resonanceTimer = null;
    }
  },

  /**
   * 发送共振信号到云端
   */
  sendResonanceSignal() {
    const relId = this.data.relationship._id;
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: { type: 'getOpenId' }
    }).then(res => {
      if (res && res.result && res.result.openid) {
        const myOpenid = res.result.openid;
        wx.setStorageSync('openid', myOpenid); // 缓存 openid

        db.collection('relationships').doc(relId).update({
          data: {
            lastResonance: db.serverDate(),
            lastTriggerBy: myOpenid
          }
        }).then(() => {
          wx.showToast({ title: '共振达成', icon: 'none' });
          wx.vibrateMedium();
        });
      }
    });
  },

  /**
   * 创建一个墨迹动画实例
   */
  createInkSmudge(x, y, isPartner = false) {
    const smudge = {
      x,
      y,
      radius: 0,
      maxRadius: isPartner ? 60 : 100,
      opacity: 0.6,
      startTime: Date.now(),
      duration: 2000,
      color: isPartner ? '178, 34, 34' : '44, 44, 44', // 对方红色，自己黑色
      layers: []
    };
    
    // 生成几层不规则的圆环
    for (let i = 0; i < 3; i++) {
      smudge.layers.push({
        rOffset: Math.random() * 0.5 + 0.5, // 半径比例
        speed: Math.random() * 0.5 + 0.5,
        jitter: Array.from({ length: 8 }, () => Math.random() * 5) // 不规则抖动
      });
    }
    
    this.inkSmudges.push(smudge);
  },

  /**
   * 墨迹动画主循环
   */
  startInkAnimationLoop() {
    const render = () => {
      const ctx = this.data.inkCanvasContext;
      if (!ctx) return;
      
      const canvasNode = this.data.inkCanvasNode;
      ctx.clearRect(0, 0, canvasNode.width, canvasNode.height);
      
      const now = Date.now();
      this.inkSmudges = this.inkSmudges.filter(s => now - s.startTime < s.duration);
      
      this.inkSmudges.forEach(s => {
        const progress = (now - s.startTime) / s.duration;
        const currentOpacity = s.opacity * (1 - progress);
        
        s.layers.forEach(layer => {
          const r = s.maxRadius * progress * layer.rOffset;
          ctx.beginPath();
          ctx.strokeStyle = `rgba(${s.color}, ${currentOpacity})`;
          ctx.lineWidth = 2 * (1 - progress);
          
          // 绘制一个带抖动的圆
          for (let i = 0; i < 360; i += 15) {
            const angle = (i * Math.PI) / 180;
            const jitterIndex = Math.floor(i / (360 / layer.jitter.length));
            const jitter = layer.jitter[jitterIndex] * (1 - progress);
            const px = s.x + (r + jitter) * Math.cos(angle);
            const py = s.y + (r + jitter) * Math.sin(angle);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.stroke();
          
          // 墨晕效果
          ctx.beginPath();
          ctx.fillStyle = `rgba(${s.color}, ${currentOpacity * 0.3})`;
          ctx.arc(s.x, s.y, r * 0.8, 0, Math.PI * 2);
          ctx.fill();
        });
      });
      
      this.data.inkCanvasNode.requestAnimationFrame(render);
    };
    
    this.data.inkCanvasNode.requestAnimationFrame(render);
  },

  /**
   * 长按印章：共振效果
   */
  onResonance() {
    // 此方法已由 onResonanceStart/End 替代
  }
});
