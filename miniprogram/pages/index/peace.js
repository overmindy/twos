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
    showDetailMap: {},
    countdown: 15,
    calmQuote: ''
  },

  coolingTimer: null,

  onLoad(options) {
    const relationshipId = options.relationshipId || wx.getStorageSync('currentRelationshipId') || '';
    const openid = wx.getStorageSync('openid') || '';
    
    this.setData({ 
      relationshipId,
      openid
    });

    wx.setNavigationBarTitle({
      title: '止戈室'
    });

    this.startCooling();

    if (relationshipId) {
      this.initWatcher(relationshipId);
    }
  },

  startCooling() {
    const quotes = [
      "言语如箭，射出难回。请再给爱一刻钟的时间。",
      "在每一句生硬的话语背后，其实都藏着一颗渴望被理解的心。",
      "止戈室里，没有对错，只有两个正在靠近的灵魂。",
      "深深的话我们浅浅地说，长长的路我们慢慢地走。",
      "此刻的沉默，是为了等一下能说出更温柔的话。"
    ];
    this.setData({
      calmQuote: quotes[Math.floor(Math.random() * quotes.length)]
    });

    this.coolingTimer = setInterval(() => {
      if (this.data.countdown > 0) {
        this.setData({ countdown: this.data.countdown - 1 });
        wx.vibrateShort({ type: 'light' });
      } else {
        clearInterval(this.coolingTimer);
      }
    }, 1000);
  },

  onUnload() {
    if (this.watcher) {
      this.watcher.close();
    }
    if (this.coolingTimer) {
      clearInterval(this.coolingTimer);
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

  async onSendClick() {
    const { inputValue, isLoading, relationshipId, openid, chatList, countdown } = this.data;
    
    // 基础校验
    if (countdown > 0) return; 
    if (!inputValue.trim() || isLoading || !relationshipId) return;

    console.log('Sending message:', inputValue);
    wx.vibrateShort({ type: 'light' });

    const userMessage = {
      id: 'temp-' + Date.now(),
      role: 'me',
      content: inputValue,
      time: formatSimpleTime(new Date())
    };

    const aiMessage = {
      id: 'ai-' + Date.now(),
      role: 'ta',
      content: '',
      thinking: '', // 使用 thinking 属性
      isLoading: true,
      time: formatSimpleTime(new Date())
    };

    const newShowDetailMap = { ...this.data.showDetailMap };
    newShowDetailMap[aiMessage.id] = true; // 默认开启显示思考过程

    this.setData({
      chatList: [...chatList, userMessage, aiMessage],
      showDetailMap: newShowDetailMap,
      isLoading: true,
      inputValue: ''
    }, () => {
      this.scrollToBottom();
    });

    try {
      const model = wx.cloud.extend.AI.createModel('deepseek');
      const res = await model.streamText({
        data: {
          model: "deepseek-v3.2",
          messages: [
            {
              role: 'system',
              content: "你是一个高情商的情感翻译员。你的任务是：把用户可能显得生硬、直接的沟通，改写得柔软、真诚且不带刺。\n   【准则】：\n   - 严禁使用 AI 腔调（如：‘我建议’、‘让我们’）。\n   - 像是一个很有修养、非常爱对方的人在平和地说话。\n   - 保留原意，但把命令句改为请求句，把否定句改为表达感受的句子。\n   - 改写示例：'你怎么还不回来' -> '今天等了你一会，有点想你啦，什么时候能到家呀？'。"
            },
            {
              role: 'user',
              content: inputValue
            }
          ]
        }
      });

      let fullContent = '';
      let fullThinking = '';

      if (res && res.eventStream) {
        for await (let event of res.eventStream) {
          if (event.data === '[DONE]') break;
          
          try {
            const data = JSON.parse(event.data);
            const delta = data.choices[0].delta;

            if (delta.reasoning_content) {
              fullThinking += delta.reasoning_content;
            }
            if (delta.content) {
              fullContent += delta.content;
            }

            // 实时更新列表中的 AI 消息
            const updatedChatList = this.data.chatList.map(msg => {
              if (msg.id === aiMessage.id) {
                return {
                  ...msg,
                  content: fullContent,
                  thinking: fullThinking
                };
              }
              return msg;
            });

            this.setData({
              chatList: updatedChatList
            });
            
            if (fullContent.length % 5 === 0) {
              wx.vibrateShort({ type: 'light' }); // Haptic feedback during typing
              this.scrollToBottom();
            }
          } catch (e) {
            console.error('Parse error', e);
          }
        }
      }

      // 串行更新最终状态
      this.setData({
        chatList: this.data.chatList.map(msg => {
          if (msg.id === aiMessage.id) {
            return { ...msg, isLoading: false };
          }
          return msg;
        })
      });

      // 最后持久化到数据库
      await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: {
          type: 'saveMessage',
          data: {
            relationshipId,
            text: fullContent || inputValue,
            reasoning: fullThinking || ''
          }
        }
      });

      this.setData({
        isLoading: false
      });

    } catch (e) {
      console.error('Streaming error:', e);
      wx.vibrateLong();
      wx.showToast({
        title: '信鸽迷路了',
        icon: 'none'
      });
      this.setData({
        isLoading: false
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
    this.setData({
      lastMessageId: 'bottom-view'
    });
  }
});
