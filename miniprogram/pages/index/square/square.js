// pages/index/square/square.js
Page({
  data: {
    posts: [],
    page: 0,
    loading: false
  },

  onLoad() {
    this.fetchPosts();
  },

  onPullDownRefresh() {
    this.setData({ posts: [], page: 0 }, () => {
      this.fetchPosts().then(() => wx.stopPullDownRefresh());
    });
  },

  async fetchPosts() {
    if (this.data.loading) return;
    this.setData({ loading: true });

    try {
      const { result } = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: { type: 'getSquarePosts' }
      });

      if (result && result.success) {
        // 标记我自己是否已经点赞过 (云端已处理 likedBy，前端映射 isLiked)
        const myOpenid = wx.getStorageSync('openid');
        const posts = result.posts.map(post => ({
          ...post,
          isLiked: post.likedBy ? post.likedBy.includes(myOpenid) : false
        }));
        
        this.setData({ posts });
      }
    } catch (e) {
      console.error('Fetch posts failed', e);
    } finally {
      this.setData({ loading: false });
    }
  },

  async onToggleLike(e) {
    const { id, index } = e.currentTarget.dataset;
    const posts = this.data.posts;
    const post = posts[index];

    // 乐观 UI 更新
    const newIsLiked = !post.isLiked;
    posts[index].isLiked = newIsLiked;
    posts[index].likeCount = (post.likeCount || 0) + (newIsLiked ? 1 : -1);
    this.setData({ posts });

    try {
      const { result } = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: {
          type: 'togglePostLike',
          data: { postId: id }
        }
      });
      if (!result.success) throw new Error();
    } catch (e) {
      // 失败回滚
      posts[index].isLiked = !newIsLiked;
      posts[index].likeCount = (post.likeCount || 0) + (!newIsLiked ? 1 : -1);
      this.setData({ posts });
      wx.showToast({ title: '心动失败，请重试', icon: 'none' });
    }
  },

  onPreviewImage(e) {
    const { url } = e.currentTarget.dataset;
    wx.previewImage({ urls: [url], current: url });
  },

  onShareAppMessage(res) {
    if (res.from === 'button') {
      const post = res.target.dataset.post;
      return {
        title: `她在 Twos 广场分享了：“${post.answerContent.substring(0, 15)}...”`,
        path: `/pages/index/square/square?id=${post._id}`,
        imageUrl: post.mediaUrl || ''
      };
    }
    return {
      title: '心动广场 - 书卷匿名，爱意无界',
      path: '/pages/index/square/square'
    };
  }
});
