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

  async onSendClick() {
    const { inputValue, isLoading, relationshipId, openid, chatList } = this.data;
    if (!inputValue.trim() || isLoading || !relationshipId) return;

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
          model: "deepseek-r1",
          messages: [
            {
              role: 'system',
              content: '你是一个充满诗意、温柔体贴的文字修辞师。你的任务是将用户在“二人世界”小程序中留下的感悟、絮语或也许略显生硬的话语，润色为更加温馨、文艺、富有文学美感且饱含深情的表达。请保持原意，但让文字如墨落宣纸，余味悠长。直接给出润色后的内容。'
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

      for await (let event of res.eventStream) {
        if (event.data === '[DONE]') break;
        
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
          this.scrollToBottom();
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
    const { chatList } = this.data;
    if (chatList.length > 0) {
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
