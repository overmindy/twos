// miniprogram/pages/archive/album/album.js
const db = wx.cloud.database();

Page({
  data: {
    relationshipId: '',
    photos: [],
    loading: true,
    refreshing: false
  },

  onLoad(options) {
    const relationshipId = options.relationshipId || wx.getStorageSync('currentRelationshipId');
    this.setData({ relationshipId });
    this.fetchPhotos();
  },

  async fetchPhotos() {
    if (!this.data.relationshipId) return;
    this.setData({ loading: true });

    try {
      const { result } = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: {
          type: 'getAlbumPhotos',
          data: { relationshipId: this.data.relationshipId }
        }
      });

      if (result && result.success) {
        this.setData({ photos: result.list });
      }
    } catch (e) {
      console.error(e);
    } finally {
      this.setData({ loading: false, refreshing: false });
    }
  },

  onRefresh() {
    this.setData({ refreshing: true });
    this.fetchPhotos();
  },

  onUpload() {
    const that = this;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        let filePath = res.tempFiles[0].tempFilePath;
        
        // 压缩图片
        wx.showLoading({ title: '润色中...' });
        try {
          const compressRes = await wx.compressImage({
            src: filePath,
            quality: 80
          });
          filePath = compressRes.tempFilePath;
        } catch (e) { console.warn('Compression failed', e); }
        wx.hideLoading();

        wx.showModal({
          title: '添一段记叙',
          editable: true,
          placeholderText: '为这张照片写句悄悄话...',
          success: (modalRes) => {
            if (modalRes.confirm) {
              that.doUpload(filePath, modalRes.content || '');
            }
          }
        });
      }
    });
  },

  async doUpload(filePath, description) {
    wx.showLoading({ title: '封存记忆...' });
    const cloudPath = `album/${this.data.relationshipId}/${Date.now()}-${Math.floor(Math.random()*1000)}.jpg`;

    try {
      // 1. 上传文件到云存储
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath,
        filePath
      });

      if (uploadRes.fileID) {
        // 2. 记录到数据库
        await wx.cloud.callFunction({
          name: 'quickstartFunctions',
          data: {
            type: 'uploadAlbumPhoto',
            data: {
              relationshipId: this.data.relationshipId,
              fileID: uploadRes.fileID,
              description
            }
          }
        });

        wx.showToast({ title: '已铭刻', icon: 'success' });
        this.fetchPhotos();
      }
    } catch (e) {
      console.error(e);
      wx.showToast({ title: '上传失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  onPreview(e) {
    const { index } = e.currentTarget.dataset;
    const urls = this.data.photos.map(p => p.fileID);
    wx.previewImage({
      current: urls[index],
      urls
    });
  },

  onLongPress(e) {
    const { index } = e.currentTarget.dataset;
    const photo = this.data.photos[index];
    
    wx.showActionSheet({
      itemList: ['抹去这段记忆'],
      itemColor: '#B22222',
      success: (res) => {
        if (res.tapIndex === 0) {
          this.deletePhoto(photo._id, photo.fileID);
        }
      }
    });
  },

  async deletePhoto(photoId, fileID) {
    wx.showLoading({ title: '抹除中...' });
    try {
      // 1. 删除数据库记录
      await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: {
          type: 'deleteAlbumPhoto',
          data: { photoId }
        }
      });

      // 2. 删除云存储文件 (可选，出于演示目的这里执行)
      await wx.cloud.deleteFile({
        fileList: [fileID]
      });

      wx.showToast({ title: '已随风去', icon: 'none' });
      this.fetchPhotos();
    } catch (e) {
      console.error(e);
    } finally {
      wx.hideLoading();
    }
  },

  goBack() {
    wx.navigateBack();
  }
});
