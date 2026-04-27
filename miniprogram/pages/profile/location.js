const db = wx.cloud.database();

Page({
  data: {
    relationshipId: '',
    centerLat: 39.9042,
    centerLon: 116.4074,
    markers: [],
    distance: '--',
    userInfo: {},
    partnerInfo: {},
    partnerLastUpdate: '',
    watcher: null
  },

  onLoad(options) {
    const relationshipId = options.relationshipId || wx.getStorageSync('currentRelationshipId');
    const userInfo = JSON.parse(wx.getStorageSync('userInfo') || '{}');
    this.setData({ relationshipId, userInfo });
    
    this.initMap();
    if (relationshipId) {
      this.watchRelationship(relationshipId);
    }
  },

  onUnload() {
    if (this.data.watcher) this.data.watcher.close();
  },

  initMap() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.setData({
          centerLat: res.latitude,
          centerLon: res.longitude
        });
        this.syncMyLocation(res.latitude, res.longitude);
      }
    });
  },

  watchRelationship(relationshipId) {
    const watcher = db.collection('relationships').doc(relationshipId).watch({
      onChange: (snapshot) => {
        if (snapshot.docs.length > 0) {
          const rel = snapshot.docs[ snapshot.docs.length - 1 ];
          this.updateLocations(rel);
        }
      },
      onError: (err) => console.error('Watch error', err)
    });
    this.setData({ watcher });
  },

  updateLocations(rel) {
    const myOpenid = wx.getStorageSync('openid');
    const isUserA = rel.userA === myOpenid;
    
    const myLoc = isUserA ? rel.userALocation : rel.userBLocation;
    const partnerLoc = isUserA ? rel.userBLocation : rel.userALocation;
    const partnerInfo = isUserA ? (rel.userBInfo || {}) : (rel.userAInfo || {});

    const markers = [];
    if (myLoc && myLoc.latitude) {
      markers.push({
        id: 1,
        latitude: myLoc.latitude,
        longitude: myLoc.longitude,
        title: '我的位置',
        iconPath: '/images/icons/happy.png',
        width: 32,
        height: 32
      });
    }
    
    if (partnerLoc && partnerLoc.latitude) {
      markers.push({
        id: 2,
        latitude: partnerLoc.latitude,
        longitude: partnerLoc.longitude,
        title: partnerInfo.nickname || 'Ta',
        iconPath: '/images/icons/happy.png',
        width: 32,
        height: 32,
        label: {
          content: partnerInfo.nickname || 'Ta',
          color: '#B22222',
          bgColor: '#FFFFFF',
          padding: 4,
          borderRadius: 4,
          anchorX: 0,
          anchorY: -30
        }
      });
      
      const dist = this.calculateDistance(myLoc, partnerLoc);
      this.setData({ 
        distance: dist || '--',
        partnerLastUpdate: this.formatTime(partnerLoc.updateTime)
      });
    }

    this.setData({ markers, partnerInfo });
    
    if (markers.length > 0 && !this.hasCentered) {
        this.recenter();
        this.hasCentered = true;
    }
  },

  syncMyLocation(lat, lon) {
    if (!this.data.relationshipId) return;
    const myOpenid = wx.getStorageSync('openid');
    
    db.collection('relationships').doc(this.data.relationshipId).get().then(res => {
        const isUserA = res.data.userA === myOpenid;
        const data = {};
        data[isUserA ? 'userALocation' : 'userBLocation'] = {
            latitude: lat,
            longitude: lon,
            updateTime: db.serverDate()
        };
        db.collection('relationships').doc(this.data.relationshipId).update({ data });
    });
  },

  calculateDistance(locA, locB) {
    if (!locA || !locB || !locA.latitude || !locB.latitude) return null;
    const R = 6371;
    const dLat = (locB.latitude - locA.latitude) * Math.PI / 180;
    const dLon = (locB.longitude - locA.longitude) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(locA.latitude * Math.PI / 180) * Math.cos(locB.latitude * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(1);
  },

  formatTime(date) {
    if (!date) return '';
    const d = new Date(date);
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  },

  recenter() {
    const mapCtx = wx.createMapContext('traceMap');
    if (this.data.markers.length > 0) {
        mapCtx.includePoints({
          padding: [80, 80, 80, 80],
          points: this.data.markers
        });
    }
  },

  syncNow() {
    wx.showLoading({ title: '刷新踪迹...' });
    this.initMap();
    setTimeout(() => wx.hideLoading(), 800);
  },

  goBack() {
    wx.navigateBack();
  }
});