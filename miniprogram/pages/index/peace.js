// Simple time formatter
const formatSimpleTime = (date) => {
  const hour = date.getHours();
  const minute = date.getMinutes();
  return [hour, minute].map(n => n.toString().padStart(2, '0')).join(':');
};

Page({
  data: {
    chatList: [
      {
        id: 'start',
        role: 'ta',
        content: '在这里，每一行文字都如旧时的鱼雁往返。在言语脱口而出前，愿它们已在墨色中被柔化。',
        time: formatSimpleTime(new Date())
      }
    ],
    inputValue: '',
    lastMessageId: 'bottom-view',
    isLoading: false
  },

  onLoad() {
    wx.setNavigationBarTitle({
      title: '语气实验室 · 止戈室'
    });
  },

  onInputChange(e) {
    this.setData({
      inputValue: e.detail.value
    });
  },

  async onSendClick() {
    const { inputValue, chatList, isLoading } = this.data;
    if (!inputValue.trim() || isLoading) return;

    this.setData({ isLoading: true });
    wx.showLoading({ title: '墨迹未干...' });

    try {
      // 调用云函数 rewriteText 进行去火气润色
      const res = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: {
          type: 'rewriteText',
          data: {
            text: inputValue
          }
        }
      });

      const newMessage = {
        id: Date.now(),
        role: 'me',
        content: res.result.result || inputValue,
        time: formatSimpleTime(new Date())
      };

      const newChatList = [...chatList, newMessage];

      this.setData({
        chatList: newChatList,
        inputValue: '',
        isLoading: false
      }, () => {
        // 延迟一点点等待渲染后再滚动
        setTimeout(() => {
          this.setData({
            lastMessageId: `msg-${newMessage.id}`
          });
        }, 100);
      });

      wx.hideLoading();
    } catch (e) {
      console.error(e);
      wx.hideLoading();
      wx.showToast({
        title: '信鸽迷路了',
        icon: 'none'
      });
      this.setData({ isLoading: false });
    }
  },

  scrollToBottom() {
    this.setData({
      lastMessageId: 'bottom-view'
    });
  }
});
