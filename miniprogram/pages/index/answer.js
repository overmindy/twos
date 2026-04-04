// miniprogram/pages/index/answer.js
const app = getApp();

Page({
  data: {
    question: null,
    today: '',
    content: '',
    relationshipId: '',
    isSubmitting: false,
    isAnswered: false,
    currentMode: 'text', // text, voice, image
    voicePath: '',
    imagePath: '',
    isRecording: false,
    openid: '',
    mode: 'linked',
    answerPrivacy: 'public',
    answerId: ''
  },

  onLoad(options) {
    this.setData({
      relationshipId: options.relationshipId || '',
      mode: options.mode || 'linked',
      today: this.formatDate(new Date())
    });
    this.fetchQuestion();
    this.initRecorder();
    this.getOpenId();
  },

  formatDate(date) {
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  },

  getOpenId() {
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: { type: 'getOpenId' }
    }).then(res => {
      if (res && res.result && res.result.openid) {
        this.setData({
          openid: res.result.openid
        });
      }
    });
  },

  initRecorder() {
    this.recorderManager = wx.getRecorderManager();
    this.recorderManager.onStart(() => {
      console.log('recorder start');
    });
    this.recorderManager.onStop((res) => {
      console.log('recorder stop', res);
      const { tempFilePath } = res;
      this.setData({
        voicePath: tempFilePath,
        isRecording: false
      });
      wx.showToast({
        title: '墨迹声纹已存',
        icon: 'none'
      });
    });
    this.recorderManager.onError((res) => {
      console.error('recorder error', res);
      this.setData({ isRecording: false });
    });
  },

  fetchQuestion() {
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'getDailyQuestion'
      }
    }).then(res => {
      if (res && res.result && res.result.success && res.result.question) {
        this.setData({
          question: res.result.question
        });
        if (res.result.question._id) {
          this.checkStatus(res.result.question._id);
        }
      }
    }).catch(err => {
      console.error('Fetch question failed', err);
    });
  },

  checkStatus(questionId) {
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'checkAnswerStatus',
        data: {
          questionId,
          relationshipId: this.data.relationshipId,
          mode: this.data.mode
        }
      }
    }).then(res => {
      if (res && res.result && res.result.success && res.result.isAnswered) {
        this.setData({
          isAnswered: true,
          answerId: res.result.answer._id,
          answerPrivacy: res.result.answer.privacy || 'public',
          content: res.result.answer.content,
          currentMode: res.result.answer.type || 'text',
          voicePath: res.result.answer.mediaUrl && res.result.answer.type === 'voice' ? res.result.answer.mediaUrl : (res.result.answer.voicePath || ''),
          imagePath: res.result.answer.mediaUrl && res.result.answer.type === 'image' ? res.result.answer.mediaUrl : (res.result.answer.imagePath || '')
        });
      }
    });
  },

  /**
   * 切换隐私状态
   */
  onTogglePrivacy() {
    if (!this.data.isAnswered || !this.data.answerId) return;

    wx.showLoading({ title: '研磨墨迹...' });
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'toggleAnswerPrivacy',
        data: {
          answerId: this.data.answerId
        }
      }
    }).then(res => {
      wx.hideLoading();
      if (res.result && res.result.success) {
        this.setData({
          answerPrivacy: res.result.privacy
        });
        wx.showToast({
          title: res.result.privacy === 'private' ? '墨迹已隐' : '墨迹重现',
          icon: 'none'
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error(err);
    });
  },

  switchMode(e) {
    if (this.data.isAnswered) return;
    const { mode } = e.currentTarget.dataset;
    this.setData({ currentMode: mode });
  },

  onInput(e) {
    this.setData({
      content: e.detail.value
    });
  },

  onRewrite() {
    const { content } = this.data;
    if (!content.trim()) return;

    wx.showLoading({
      title: '正在研磨墨迹...',
    });

    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'rewriteText',
        data: {
          text: content
        }
      }
    }).then(res => {
      wx.hideLoading();
      if (res && res.result && res.result.success) {
        this.setData({
          content: res.result.result
        });
        wx.showToast({
          title: '墨迹已润',
          icon: 'none'
        });
      } else {
        wx.showToast({
          title: '实验室暂休',
          icon: 'none'
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('Rewrite failed', err);
    });
  },

  async uploadFile(localPath, prefix) {
    const ext = localPath.split('.').pop();
    const folder = this.data.relationshipId || 'solo';
    const cloudPath = `answers/${folder}/${Date.now()}-${this.data.openid}.${ext}`;
    
    try {
      const res = await wx.cloud.uploadFile({
        cloudPath,
        filePath: localPath
      });
      return res.fileID;
    } catch (e) {
      console.error('Upload failed', e);
      throw e;
    }
  },

  async onSubmit() {
    if (!this.data.content.trim() && !this.data.voicePath && !this.data.imagePath) {
      wx.showToast({
        title: '落笔方能传情',
        icon: 'none'
      });
      return;
    }

    if (!this.data.question) {
      wx.showToast({
        title: '正在载入今日之问...',
        icon: 'none'
      });
      return;
    }

    if (this.data.isSubmitting) return;

    this.setData({ isSubmitting: true });
    wx.showLoading({ title: '封缄中...' });

    try {
      let mediaUrl = '';
      if (this.data.currentMode === 'image' && this.data.imagePath && !this.data.imagePath.startsWith('cloud://')) {
        mediaUrl = await this.uploadFile(this.data.imagePath, 'image');
      } else if (this.data.currentMode === 'voice' && this.data.voicePath && !this.data.voicePath.startsWith('cloud://')) {
        mediaUrl = await this.uploadFile(this.data.voicePath, 'voice');
      }

      const res = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: {
          type: 'submitAnswer',
          data: {
            questionId: (this.data.question && this.data.question._id) || '',
            relationshipId: this.data.relationshipId || '',
            content: this.data.content,
            type: this.data.currentMode,
            mediaUrl: mediaUrl,
            isSolo: this.data.mode === 'solo'
          }
        }
      });

      wx.hideLoading();
      if (res && res.result && res.result.success) {
        wx.showToast({
          title: '已密封',
          icon: 'success'
        });
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      } else {
        wx.showToast({
          title: (res && res.result && res.result.errMsg) || '密封失败',
          icon: 'none'
        });
        this.setData({ isSubmitting: false });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('Submit answer failed', err);
      this.setData({ isSubmitting: false });
      wx.showToast({
        title: '网络断连或上传失败',
        icon: 'none'
      });
    }
  },

  onUploadImage() {
    if (this.data.isAnswered) return;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        this.setData({
          imagePath: res.tempFiles[0].tempFilePath
        });
      }
    });
  },

  onDeleteImage() {
    if (this.data.isAnswered) return;
    this.setData({ imagePath: '' });
  },

  onPreviewImage() {
    if (!this.data.imagePath) return;
    wx.previewImage({
      urls: [this.data.imagePath],
      current: this.data.imagePath
    });
  },

  onVoiceSealTap() {
    if (this.data.isAnswered) {
      this.onPlayVoice();
      return;
    }

    if (this.data.voicePath) {
      this.onPlayVoice();
    } else {
      this.onStartRecord();
    }
  },

  onStartRecord() {
    if (this.data.isAnswered || this.data.isRecording) return;
    
    // 如果是重新录制，先清空路径
    this.setData({ 
      voicePath: '',
      isRecording: true 
    });

    this.recorderManager.start({
      duration: 60000,
      sampleRate: 44100,
      numberOfChannels: 1,
      encodeBitRate: 192000,
      format: 'm4a'
    });
    
    // 震动反馈
    wx.vibrateShort({ type: 'medium' });
  },

  onStopRecord() {
    if (this.data.isAnswered || !this.data.isRecording) return;
    this.recorderManager.stop();
    wx.vibrateShort({ type: 'light' });
  },

  onPlayVoice() {
    if (!this.data.voicePath) return;
    const innerAudioContext = wx.createInnerAudioContext();
    innerAudioContext.src = this.data.voicePath;
    innerAudioContext.play();
    wx.showToast({
      title: '正在回响...',
      icon: 'none'
    });
  },

  onDeleteVoice() {
    if (this.data.isAnswered) return;
    this.setData({
      voicePath: '',
      isRecording: false
    });
  }
});
