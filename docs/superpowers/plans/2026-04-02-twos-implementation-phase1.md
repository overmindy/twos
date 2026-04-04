# 《两只(TWOS)》- "私人手札" 情侣互动小程序 实施计划 (Phase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建《两只(TWOS)》的核心架构、纸质书面 UI 风格、以及基于微信分享的邀请绑定流程。

**Architecture:** 采用微信小程序原生框架配合微信云开发。利用云数据库的实时监听 (Watch) 实现双人同步，Canvas 模拟物理笔触与墨水晕染，CSS3 实现纸张折叠与摊平动画。

**Tech Stack:** Weixin Mini Program Framework, WeChat Cloud Development (Cloud Database, Functions), Canvas API.

---

### Task 1: 项目基础配置与环境初始化 (Setup & Env)

**Files:**
- Modify: `miniprogram/app.json`
- Modify: `miniprogram/envList.js`
- Modify: `project.config.json`

- [ ] **Step 1: 配置项目基础信息 (App Name & Tabs)**

修改 `miniprogram/app.json`，设置页面路由和全局窗口外观（米色道林纸底色）。

```json
{
  "pages": [
    "pages/index/index",
    "pages/bind/bind",
    "pages/archive/index",
    "pages/settings/index"
  ],
  "window": {
    "backgroundColor": "#FDFCF8",
    "backgroundTextStyle": "light",
    "navigationBarBackgroundColor": "#FDFCF8",
    "navigationBarTitleText": "两只",
    "navigationBarTextStyle": "black"
  },
  "tabBar": {
    "color": "#2F2F2F",
    "selectedColor": "#B22222",
    "backgroundColor": "#FDFCF8",
    "borderStyle": "white",
    "list": [
      {
        "pagePath": "pages/index/index",
        "text": "手札"
      },
      {
        "pagePath": "pages/archive/index",
        "text": "时光"
      }
    ]
  },
  "style": "v2",
  "lazyCodeLoading": "requiredComponents"
}
```

- [ ] **Step 2: 初始化云开发环境 (Cloud Init)**

确保 `miniprogram/envList.js` 中的云环境 ID 已正确填充。

```javascript
const envList = [{"envId":"cloud1-5g7s6p7c0823e595","alias":"cloud1"}]; // 请根据实际环境 ID 替换
const isMac = true;
module.exports = {
  envList,
  isMac
};
```

- [ ] **Step 3: 运行并验证基础框架**

运行：`npm run dev` (或在微信开发者工具中预览)
Expected: 底部导航栏出现，背景呈现暖白色。

- [ ] **Step 4: Commit**

```bash
git add miniprogram/app.json miniprogram/envList.js
git commit -m "chore: initial project structure and theme setup"
```

### Task 2: 全局纸质书面样式 (Paper Theme Styling)

**Files:**
- Modify: `miniprogram/app.wxss`
- Create: `miniprogram/assets/fonts/serif-font.wxss` (Placeholder for external font if needed)

- [ ] **Step 1: 定义全局“纸张”样式**

修改 `miniprogram/app.wxss`，添加纤维纹理背景模拟和全局字体设置。

```css
/**app.wxss**/
page {
  background-color: #FDFCF8;
  background-image: radial-gradient(#E0D8C0 0.5px, transparent 0.5px);
  background-size: 20px 20px; /* 模拟极微弱的纸张网格感，或替换为噪声图 */
  font-family: "Noto Serif SC", "Source Han Serif SC", "宋体", serif;
  color: #2F2F2F;
  line-height: 1.6;
}

.paper-texture {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: url('/images/paper_noise.png'); /* 需要后续添加噪声图 */
  opacity: 0.05;
  pointer-events: none;
  z-index: 9999;
}

.serif-text {
  font-family: "Noto Serif SC", serif;
}

.ink-black { color: #2F2F2F; }
.vermilion-red { color: #B22222; }
```

- [ ] **Step 2: 创建基础布局组件 (Container)**

在 `miniprogram/app.wxss` 中定义页面边距。

```css
.container {
  padding: 40rpx;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}
```

- [ ] **Step 3: Commit**

```bash
git add miniprogram/app.wxss
git commit -m "style: add global paper theme and serif typography"
```

### Task 3: 绑定机制 - 邀请与直连 (Binding Flow)

**Files:**
- Create: `miniprogram/pages/bind/bind.wxml`
- Create: `miniprogram/pages/bind/bind.js`
- Create: `miniprogram/pages/bind/bind.wxss`
- Modify: `cloudfunctions/quickstartFunctions/index.js` (Add linkUser logic)

- [ ] **Step 1: 编写邀请页面 UI (The Invitation Card)**

在 `pages/bind/bind.wxml` 中实现极简的邀请卡片。

```xml
<view class="container">
  <view class="card">
    <view class="seal">印</view>
    <view class="title">两只(TWOS)</view>
    <view class="content">诚邀您共同书写私人手札</view>
    <button class="btn-bind" open-type="share">发送邀请</button>
  </view>
</view>
```

- [ ] **Step 2: 实现分享逻辑 (Share Logic)**

在 `pages/bind/bind.js` 中捕获分享事件，携带当前用户的 OpenID。

```javascript
Page({
  onShareAppMessage() {
    const userInfo = wx.getStorageSync('userInfo');
    return {
      title: '诚邀您共同书写私人手札',
      path: `/pages/bind/bind?inviterId=${userInfo.openid}`,
      imageUrl: '/images/share_card.png'
    }
  },
  onLoad(options) {
    if (options.inviterId) {
      // 接收方进入，执行绑定逻辑
      this.handleBind(options.inviterId);
    }
  }
})
```

- [ ] **Step 3: 编写绑定云函数 (Cloud Function)**

修改 `cloudfunctions/quickstartFunctions/index.js`，添加处理双人关联的 case。

```javascript
// cloudfunctions/quickstartFunctions/index.js 增加：
case 'linkRelationship':
  const { inviterId } = event.data;
  const { OPENID } = cloud.getWXContext();
  // 检查是否已存在关联，不存在则创建
  await db.collection('relationships').add({
    data: {
      userA: inviterId,
      userB: OPENID,
      createTime: db.serverDate(),
      status: 'active',
      energy: 1
    }
  });
  return { success: true };
```

- [ ] **Step 4: Commit**

```bash
git add miniprogram/pages/bind/ cloudfunctions/quickstartFunctions/
git commit -m "feat: implement wechat-direct binding flow"
```

### Task 4: 首页布局与“折叠纸片”视觉原型 (Home & Folded Paper UI)

**Files:**
- Modify: `miniprogram/pages/index/index.wxml`
- Modify: `miniprogram/pages/index/index.wxss`
- Modify: `miniprogram/pages/index/index.js`

- [ ] **Step 1: 构建首页基础结构 (The Desk)**

```xml
<view class="container">
  <!-- 背景：羁绊之树 (Canvas) -->
  <canvas type="2d" id="bondingTree" class="tree-canvas"></canvas>
  
  <!-- 核心交互：每日一问卡片 (Folded Paper) -->
  <view class="paper-stack" bindtap="onTapPaper">
    <view class="paper folded {{isUnfolding ? 'unfolding' : ''}}">
      <view class="date-seal">肆月贰日</view>
      <view class="memo-title">今日之问</view>
      <view class="status-hint">等待开启...</view>
    </view>
  </view>
  
  <!-- 底部印章：共振 -->
  <view class="resonance-btn" bindlongpress="onResonance">
    <view class="seal-icon">心</view>
  </view>
</view>
```

- [ ] **Step 2: 实现纸张折叠 CSS 动画 (The Unfold Animation)**

在 `pages/index/index.wxss` 中使用 3D 转换。

```css
.paper.folded {
  transform: rotateX(10deg);
  box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.1);
  transition: all 0.8s cubic-bezier(0.4, 0, 0.2, 1);
}
.paper.unfolding {
  transform: rotateX(0deg) scale(1.05);
  box-shadow: 0 20rpx 40rpx rgba(0,0,0,0.05);
}
```

- [ ] **Step 3: Commit**

```bash
git add miniprogram/pages/index/
git commit -m "ui: initial home layout and folded paper visual prototype"
```
