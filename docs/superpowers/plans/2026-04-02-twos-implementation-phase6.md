# 《两只(TWOS)》- 体验优化与多模态固化 实施计划 (Phase 6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 固化多模态存储（图片/语音），引入霞鹜文楷字体，修复首页同步逻辑，完善个人页（扉页）并提升答题页 UX。

**Architecture:** 
- **字体引入**: 使用 `wx.loadFontFace` 加载网络字体。
- **实时同步**: 统一使用数据库 `watch` 监听关系、答案与实时消息。
- **多模态路径**: 在云存储中使用 `answers/REL_ID/TIMESTAMP.EXT` 路径。
- **UI 修正**: 优化 `textarea` 布局，确保在不同机型下内容可见且可点击。

**Tech Stack:** Weixin Mini Program SDK, Cloud Development, LXGW WenKai Webfont.

---

### Task 1: 全局字体与视觉微调 (Font & Styles)

**Files:**
- Modify: `miniprogram/app.js`
- Modify: `miniprogram/app.wxss`

- [ ] **Step 1: 异步加载霞鹜文楷字体**

在 `app.js` 的 `onLaunch` 中添加 `wx.loadFontFace`。

```javascript
wx.loadFontFace({
  family: 'LXGW WenKai',
  source: 'url("https://cdn.jsdelivr.net/gh/chawyehsu/lxgw-wenkai-webfont@v1.1.0/lxgw-wenkai-screen.css")', // 示例 CDN
  success: console.log,
  fail: console.error
});
```

- [ ] **Step 2: 更新全局 `app.wxss` 字体引用**

```css
page {
  font-family: "LXGW WenKai", "Noto Serif SC", serif;
  /* ... */
}
```

- [ ] **Step 3: Commit**

```bash
git add miniprogram/app.js miniprogram/app.wxss
git commit -m "style: load LXGW WenKai font and update global typography"
```

### Task 2: 首页同步与实时化 (Real-time Sync Fix)

**Files:**
- Modify: `miniprogram/pages/index/index.js`
- Modify: `miniprogram/pages/index/index.wxml`

- [ ] **Step 1: 修正 `updateWeatherStation` 的实时逻辑**

确保从监听到的 `relationship` 数据中提取最新的 `userAMood/userBMood` 和 `location`。

- [ ] **Step 2: 增加实时消息红点提示 (Optional)**

在首页止戈室入口增加实时消息数量显示。

- [ ] **Step 3: Commit**

```bash
git add miniprogram/pages/index/index.js miniprogram/pages/index/index.wxml
git commit -m "fix: restore real-time mood and location sync on home page"
```

### Task 3: 答题页 UI 修复与提交补全 (Answer UI & Submission)

**Files:**
- Modify: `miniprogram/pages/index/answer.wxml`
- Modify: `miniprogram/pages/index/answer.js`
- Modify: `miniprogram/pages/index/answer.wxss`

- [ ] **Step 1: 修正 `textarea` 排版与可见性**

移除 `flex: 1` 并在 `input-section` 增加具体高度或使用滚动区域，确保点击区域不被遮挡。

- [ ] **Step 2: 修复 `submitAnswer` 参数传递**

在 `submitAnswer` 云函数调用前，确保 `questionId` 和 `relationshipId` 不为 `undefined`（若为空则传空字符串）。

- [ ] **Step 3: Commit**

```bash
git add miniprogram/pages/index/answer.*
git commit -m "fix: resolve answer page UI issues and submission parameters"
```

### Task 4: 扉页（个人中心）印章墙实现 (Profile Tab & Seal Wall)

**Files:**
- Create: `miniprogram/pages/profile/index.wxml`
- Create: `miniprogram/pages/profile/index.js`
- Create: `miniprogram/pages/profile/index.wxss`
- Create: `miniprogram/pages/profile/edit.wxml`
- Create: `miniprogram/pages/profile/edit.js`
- Modify: `miniprogram/app.json`

- [ ] **Step 1: 实现印章墙布局**

使用朱砂红印表示绑定，墨黑印表示个人设置（昵称、头像、心情）。

- [ ] **Step 2: 实现个人信息编辑逻辑**

点击对应印章跳转到编辑页，更新云数据库中的用户信息。

- [ ] **Step 3: Commit**

```bash
git add miniprogram/pages/profile/ miniprogram/app.json
git commit -m "feat: implement profile page with Seal Wall and info editing"
```
