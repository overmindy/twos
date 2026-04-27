const fs = require('fs');
const path = require('path');

const base = 'miniprogram/pages/profile/location';
if (!fs.existsSync(path.dirname(base))) {
  fs.mkdirSync(path.dirname(base), { recursive: true });
}

const wxml = `
<view class="container map-page">
  <map 
    id="traceMap" 
    class="trace-map" 
    latitude="{{centerLat}}" 
    longitude="{{centerLon}}" 
    markers="{{markers}}" 
    polyline="{{polyline}}"
    scale="14"
    show-location
  ></map>

  <view class="location-footer">
    <view class="info-card">
      <view class="distance-info">
        <text class="label">我们相距</text>
        <view class="distance-val">
          <text class="num">{{distance}}</text>
          <text class="unit">km</text>
        </view>
      </view>
      <view class="status-info">
        <view class="user-loc-status">
          <image class="mini-avatar" src="{{userInfo.avatarUrl || '/images/icons/happy.png'}}"></image>
          <text>{{userInfo.nickname || '我'}} 的坐标已同步</text>
        </view>
        <view class="user-loc-status">
          <image class="mini-avatar" src="{{partnerInfo.avatarUrl || '/images/icons/happy.png'}}"></image>
          <text>{{partnerInfo.nickname || 'Ta'}} 的坐标：{{partnerLastUpdate || '同步中...'}}</text>
        </view>
      </view>
    </view>
    
    <view class="action-bar">
      <button class="btn-primary" bindtap="recenter">视野居中</button>
      <button class="btn-outline" bindtap="syncNow">立即手动同步</button>
    </view>
  </view>
  
  <view class="back-link" bindtap="goBack">返回书卷</text>
</view>
`;

const js = `
const db = wx.cloud.database();

Page({
  data: {
    relationshipId: '',
    centerLat: 39.9042,
    centerLon: 116.4074,
    markers: [],
    polyline: [],
    distance: 0,
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
    this.watchRelationship(relationshipId);
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
    if (!relationshipId) return;
    const watcher = db.collection('relationships').doc(relationshipId).watch({
      onChange: (snapshot) => {
        if (snapshot.docs.length > 0) {
          const rel = snapshot.docs[0];
          this.updateLocations(rel);
        }
      },
      onError: (err) => console.error(err)
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
    if (myLoc) {
      markers.push({
        id: 1,
        latitude: myLoc.latitude,
        longitude: myLoc.longitude,
        title: '我的位置',
        iconPath: '/images/icons/happy.png',
        width: 40,
        height: 40
      });
    }
    
    if (partnerLoc) {
      markers.push({
        id: 2,
        latitude: partnerLoc.latitude,
        longitude: partnerLoc.longitude,
        title: partnerInfo.nickname || 'Ta',
        iconPath: '/images/icons/happy.png', // 后续可优化为头像
        width: 40,
        height: 40,
        label: {
          content: partnerInfo.nickname || 'Ta',
          color: '#B22222',
          bgColor: '#FFFFFF',
          padding: 4,
          borderRadius: 4
        }
      });
      
      const dist = this.calculateDistance(myLoc, partnerLoc);
      this.setData({ 
        distance: dist,
        partnerLastUpdate: this.formatTime(partnerLoc.updateTime)
      });
    }

    this.setData({ markers, partnerInfo });
  },

  syncMyLocation(lat, lon) {
    if (!this.data.relationshipId) return;
    const myOpenid = wx.getStorageSync('openid');
    const updateKey = this.data.userInfo.isUserA ? 'userALocation' : 'userBLocation'; // 需要在初始化判断是A还是B

    // 这里通过关系表字段判断
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
    if (!locA || !locB) return 0;
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
    return d.getHours() + ':' + d.getMinutes().toString().padStart(2, '0');
  },

  recenter() {
    const mapCtx = wx.createMapContext('traceMap');
    mapCtx.includePoints({
      padding: [80, 80, 80, 80],
      points: this.data.markers
    });
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
`;

const wxss = \`
.map-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
}
.trace-map {
  width: 100%;
  flex: 1;
}
.location-footer {
  background: #FDFCF8;
  padding: 40rpx;
  border-top: 1rpx solid #E0D8C0;
  box-shadow: 0 -10rpx 40rpx rgba(0,0,0,0.05);
}
.info-card {
  margin-bottom: 40rpx;
}
.distance-info {
  text-align: center;
  margin-bottom: 30rpx;
}
.label {
  font-size: 24rpx;
  color: #8C8C8C;
  letter-spacing: 4rpx;
}
.distance-val {
  margin-top: 10rpx;
}
.num {
  font-size: 72rpx;
  font-family: serif;
  color: #B22222;
  font-weight: 500;
}
.unit {
  font-size: 28rpx;
  color: #B22222;
  margin-left: 10rpx;
}
.status-info {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.user-loc-status {
  display: flex;
  align-items: center;
  gap: 16rpx;
  font-size: 24rpx;
  color: #5C5C5C;
}
.mini-avatar {
  width: 32rpx;
  height: 32rpx;
  border-radius: 50%;
  border: 1rpx solid #E0D8C0;
}
.action-bar {
  display: flex;
  gap: 20rpx;
}
.action-bar button {
  flex: 1;
  font-size: 28rpx;
}
.btn-primary {
  background: #B22222;
  color: #FFF;
}
.btn-outline {
  background: transparent;
  color: #8C8C8C;
  border: 1rpx solid #E0D8C0;
}
.back-link {
  position: fixed;
  top: env(safe-area-inset-top);
  left: 40rpx;
  background: rgba(255,255,255,0.8);
  padding: 10rpx 20rpx;
  border-radius: 30rpx;
  font-size: 24rpx;
  color: #2F2F2F;
  border: 1rpx solid #E0D8C0;
}
\`;

const json = \`{
  "navigationBarTitleText": "踪迹",
  "navigationBarBackgroundColor": "#FDFCF8",
  "navigationStyle": "custom"
}\`;

fs.writeFileSync(base + '.wxml', wxml);
fs.writeFileSync(base + '.js', js);
fs.writeFileSync(base + '.wxss', wxss);
fs.writeFileSync(base + '.json', json);

console.log('Location Trace page created successfully');
