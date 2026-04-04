# 《两只(TWOS)》- 体验优化与多模态进阶 实施计划 (Phase 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复答题页 UX 缺陷，增加多模态支持（语音/图片），实现羁绊之树生长预览与能量显示，并初步构建“语气实验室”独立聊天室与心情同步。

**Architecture:** 
- **多模态扩展**: 在 `answers` 集合中增加媒体类型支持，利用微信 `wx.chooseMedia` 和 `wx.getRecorderManager` 获取多媒体内容。
- **视觉增强**: 修改 `TreeDrawer` 增加 `preview` 模式，在首页增加能量与心情悬浮窗。
- **独立模块**: 新增 `pages/index/peace` 作为独立的冲突缓冲聊天室。

**Tech Stack:** Weixin Mini Program SDK (Media API, Record API), Cloud Storage, Canvas API.

---

### Task 1: 答题页体验深度优化 (Answer UX & Multi-modal)

**Files:**
- Modify: `miniprogram/pages/index/answer.wxml`
- Modify: `miniprogram/pages/index/answer.js`
- Modify: `miniprogram/pages/index/answer.wxss`

- [ ] **Step 1: 修复答题内容可见性与状态检查**

修改 `answer.js` 的 `onLoad`，首先检查用户是否已在今日答题。如果已答题，显示已有的内容，并将 `textarea` 设置为只读或展示态。

- [ ] **Step 2: 增加多模态工具栏 (UI Only)**

在 `answer.wxml` 中增加【文字/语音/图片】切换栏（目前使用文字占位，等待图标）。

- [ ] **Step 3: 实现图片与语音的“信纸”化展示**

修改 `answer.wxss`，为上传的图片添加“拍立得”边框，为语音添加“声波墨迹”样式。

- [ ] **Step 4: 将“消”字润色更名为“润”并调整逻辑**

修改文案和图标逻辑，将此处的语气实验室定位为“文笔润色”。

- [ ] **Step 5: Commit**

```bash
git add miniprogram/pages/index/answer.*
git commit -m "fix: optimize answer UX and add multi-modal placeholders"
```

### Task 2: 羁绊之树 - 能量显示与生长预览 (Tree Enhancements)

**Files:**
- Modify: `miniprogram/pages/index/index.wxml`
- Modify: `miniprogram/pages/index/index.js`
- Modify: `miniprogram/utils/tree-drawer.js`

- [ ] **Step 1: 增加能量 (Energy) 标签显示**

在首页左下角（树根处）增加手写感标签显示 `energy` 数值。

- [ ] **Step 2: 实现“预见未来”生长预览动画**

在 `tree-drawer.js` 中增加 `previewGrowth()` 方法，模拟 3 秒钟树木迅速长大的 Canvas 动画。
在首页增加预览入口（目前使用文字按钮，等待沙漏图标）。

- [ ] **Step 3: Commit**

```bash
git add miniprogram/pages/index/index.* miniprogram/utils/tree-drawer.js
git commit -m "feat: add energy display and tree growth preview animation"
```

### Task 3: 冲突缓冲聊天室 (The Peace Room - Independent Module)

**Files:**
- Create: `miniprogram/pages/index/peace.wxml`
- Create: `miniprogram/pages/index/peace.js`
- Create: `miniprogram/pages/index/peace.wxss`
- Modify: `miniprogram/app.json`

- [ ] **Step 1: 创建独立聊天页面**

实现类似微信聊天的界面，但背景保持“纸质手札”纹理。

- [ ] **Step 2: 实现“去火气”拦截逻辑**

在发送按钮上增加拦截，调用云函数 `rewriteText` (定位为去火气/非暴力沟通)，展示润色后的气泡。

- [ ] **Step 3: Commit**

```bash
git add miniprogram/pages/index/peace.*
git commit -m "feat: create independent Peace Room for conflict buffering"
```

### Task 4: 心情同步与气象站增强 (Mood Sync)

**Files:**
- Modify: `miniprogram/pages/index/index.wxml`
- Modify: `miniprogram/pages/index/index.js`

- [ ] **Step 1: 增加心情选择弹窗**

点击气象站时弹出心情选择列表。

- [ ] **Step 2: 实时同步心情状态**

将选择的心情实时更新至 `relationships` 集合，并通过 `watch` 同步给另一半。

- [ ] **Step 3: Commit**

```bash
git add miniprogram/pages/index/index.*
git commit -m "feat: implement mood synchronization in weather station"
```
