const db = wx.cloud.database();

// Simple time formatter
const formatSimpleTime = (date) => {
  if (!date || isNaN(date.getTime())) return '';
  const hour = date.getHours();
  const minute = date.getMinutes();
  return [hour, minute].map(n => n.toString().padStart(2, '0')).join(':');
};

Page({
  data: {
    relationshipId: '',
    openid: '',
    chatList: [],
    inputValue: '',
    lastMessageId: 'bottom-view',
    isLoading: false,
    processingMessage: null,
    showDetailMap: {}
  },

  onLoad(options) {
    const relationshipId = options.relationshipId || wx.getStorageSync('currentRelationshipId') || '';
    const openid = wx.getStorageSync('openid') || '';
    
    this.setData({ 
      relationshipId,
      openid
    });

    wx.setNavigationBarTitle({
      title: '语气实验室 · 止戈室'
    });

    if (relationshipId) {
      this.initWatcher(relationshipId);
    }
  },

  onUnload() {
    if (this.watcher) {
      this.watcher.close();
    }
  },

  initWatcher(relationshipId) {
    this.watcher = db.collection('messages')
      .where({ relationshipId })
      .orderBy('createTime', 'asc')
      .watch({
        onChange: (snapshot) => {
          const { docs } = snapshot;
          const chatList = docs.map(doc => ({
            id: doc._id,
            role: doc.senderOpenid === this.data.openid ? 'me' : 'ta',
            content: doc.text,
            reasoning: doc.reasoning || '',
            time: formatSimpleTime(new Date(doc.createTime))
          }));

          // 如果没有消息，显示默认欢迎消息
          if (chatList.length === 0) {
            chatList.push({
              id: 'start',
              role: 'ta',
              content: '在这里，每一行文字都如旧时的鱼雁往返。在言语脱口而出前，愿它们已在墨色中被柔化。',
              time: formatSimpleTime(new Date())
            });
          }

          this.setData({
            chatList
          }, () => {
             // 延迟一点点等待渲染后再滚动
             setTimeout(() => {
               this.scrollToBottom();
             }, 100);
          });
        },
        onError: (err) => {
          console.error('Watcher error', err);
        }
      });
  },

  onInputChange(e) {
    this.setData({
      inputValue: e.detail.value
    });
  },

  onMessageTap(e) {
    const { id } = e.currentTarget.dataset;
    const { showDetailMap } = this.data;
    showDetailMap[id] = !showDetailMap[id];
    this.setData({ showDetailMap });
  },

  async typeEffect(field, text) {
    if (!text) return;
    for (let i = 0; i <= text.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 30));
      this.setData({
        [`processingMessage.${field}`]: text.substring(0, i)
      });
      if (i % 5 === 0) this.scrollToBottom();
    }
    this.scrollToBottom();
  },

  async onSendClick() {
    const { inputValue, isLoading, relationshipId } = this.data;
    if (!inputValue.trim() || isLoading || !relationshipId) return;

    this.setData({ 
      isLoading: true,
      processingMessage: {
        role: 'me',
        content: '',
        reasoning: '',
        isLoading: true,
        time: formatSimpleTime(new Date())
      },
      inputValue: ''
    });
    this.scrollToBottom();

    try {
      // 1. 先进行 rewriteText 润色
      const rewriteRes = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: {
          type: 'rewriteText',
          data: {
            text: inputValue
          }
        }
      });

      if (!rewriteRes.result.success) {
        throw new Error(rewriteRes.result.errMsg);
      }

      const { reasoning_content, content } = rewriteRes.result.result;

      this.setData({ 'processingMessage.isLoading': false });

      // 展示打字机效果：先思考
      if (reasoning_content) {
        await this.typeEffect('reasoning', reasoning_content);
        await new Promise(resolve => setTimeout(resolve, 500)); // 稍作停顿
      }

      // 再展示润色后的正文
      await this.typeEffect('content', content || inputValue);

      // 2. 调用 sendMessage 云函数存储 (保存正文和思考过程)
      await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: {
          type: 'sendMessage',
          data: {
            relationshipId,
            text: content || inputValue,
            reasoning: reasoning_content || ''
          }
        }
      });

      this.setData({
        processingMessage: null,
        isLoading: false
      });
    } catch (e) {
      console.error(e);
      wx.showToast({
        title: '信鸽迷路了',
        icon: 'none'
      });
      this.setData({ 
        isLoading: false,
        processingMessage: null
      });
    }
  },

  onClearHistory() {
     const { relationshipId } = this.data;
     if (!relationshipId) return;

     wx.showModal({
       title: '焚化炉',
       content: '是否将往日墨迹付之一炬？此举不可撤回。',
       confirmText: '焚毁',
       confirmColor: '#B22222',
       success: async (res) => {
         if (res.confirm) {
           wx.showLoading({ title: '清理中...' });
           try {
             await wx.cloud.callFunction({
               name: 'quickstartFunctions',
               data: {
                 type: 'clearChatMessages',
                 data: { relationshipId }
               }
             });
             this.setData({ chatList: [] });
             wx.hideLoading();
             wx.showToast({ title: '已付之一炬', icon: 'success' });
           } catch (e) {
             console.error(e);
             wx.hideLoading();
             wx.showToast({ title: '清理失败', icon: 'none' });
           }
         }
       }
     });
  },

  scrollToBottom() {
    const { chatList, processingMessage } = this.data;
    if (processingMessage) {
      this.setData({
        lastMessageId: 'msg-processing'
      });
    } else if (chatList.length > 0) {
      const lastId = chatList[chatList.length - 1].id;
      this.setData({
        lastMessageId: `msg-${lastId}`
      });
    } else {
      this.setData({
        lastMessageId: 'bottom-view'
      });
    }
  }
});
