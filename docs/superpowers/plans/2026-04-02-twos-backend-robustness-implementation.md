# 《两只(TWOS)》- 后端健壮性补全实施计划 (Phase 7)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成后端解绑逻辑、用户信息同步镜像、多模态隐私控制（查看/隐藏）以及云端共识抛币游戏。

**Architecture:** 
- **关系管理**: 在 `relationships` 集合中引入 `status: archived`。
- **信息镜像**: 利用云函数在用户更新个人信息时，同步更新关联的 `relationships` 冗余字段。
- **游戏同步**: 建立 `games` 集合，所有结果由云函数生成，前端仅负责同步动画渲染。

**Tech Stack:** WeChat Cloud Development (Database, Cloud Functions, Storage), WXML/WXSS/JS.

---

### Task 1: 个人信息同步与关系镜像 (Info Mirroring)

**Files:**
- Modify: `cloudfunctions/quickstartFunctions/index.js` (Add `updateUserInfo` Case)
- Modify: `miniprogram/pages/profile/edit.js`
- Modify: `miniprogram/pages/index/index.js`

- [ ] **Step 1: 编写“更新个人信息”云函数**

在 `quickstartFunctions` 中实现 `updateUserInfo`。当用户更新昵称/头像/心情时，同时更新 `users` 集合和其活跃的 `relationships` 文档中的冗余字段。

- [ ] **Step 2: 修正首页读取逻辑**

首页不再仅依赖 `users` 集合，而是直接从 `relationships` 的 `userAInfo/userBInfo` 字段中读取对方的最新的实时镜像信息，解决“无法查看对方信息”的问题。

- [ ] **Step 3: Commit**

```bash
git add cloudfunctions/ miniprogram/pages/index/
git commit -m "feat: implement user info mirroring and sync relationship metadata"
```

### Task 2: 真实解绑逻辑实现 (True Unbinding)

**Files:**
- Modify: `cloudfunctions/quickstartFunctions/index.js` (Add `unbindRelationship` Case)
- Modify: `miniprogram/pages/profile/index.js`

- [ ] **Step 1: 编写“解绑并归档”云函数**

实现 `unbindRelationship`。逻辑：将 `relationships` 文档状态改为 `archived`，并打上 `archiveTime` 标记。后续该关系的所有互动记录变为只读。

- [ ] **Step 2: 完善个人页解绑交互**

在个人页“结缘”印章中增加“斩断尘缘 (解除绑定)”的二次确认弹窗。解绑成功后，强制刷新首页状态回 `solo`。

- [ ] **Step 3: Commit**

```bash
git add cloudfunctions/ miniprogram/pages/profile/
git commit -m "feat: implement real unbinding logic with archiving support"
```

### Task 3: 多模态管理与隐私控制 (Media Control)

**Files:**
- Modify: `miniprogram/pages/index/answer.wxml`
- Modify: `miniprogram/pages/index/answer.js`
- Modify: `miniprogram/pages/index/answer.wxss`

- [ ] **Step 1: 实现多模态“查看”功能**

在答题页/时光轴增加图片点击全屏预览 (`wx.previewImage`) 和语音点击播放/停止逻辑。

- [ ] **Step 2: 增加“隐藏/隐去”功能**

在答题页增加“墨迹隐去”按钮。逻辑：将 `answers` 记录的 `privacy` 设为 `private`。
在 UI 上，若为 `private` 记录，对方看到的将是一个被墨水晕染覆盖的效果（使用 CSS `filter: blur()` 或 Canvas 涂抹）。

- [ ] **Step 3: Commit**

```bash
git add miniprogram/pages/index/answer.*
git commit -m "feat: add media preview and privacy hiding controls"
```

### Task 4: 云端共识游戏 - 纸上抛硬币 (Coin Flip Consensus)

**Files:**
- Modify: `cloudfunctions/quickstartFunctions/index.js` (Add `flipCoin` Case)
- Modify: `miniprogram/pages/index/coin-flip.js`

- [ ] **Step 1: 编写“云端抛币”云函数**

一方点击抛币，云函数生成 `head/tail` 并存入 `games` 集合。

- [ ] **Step 2: 实现同步动画渲染**

双方 `Watcher` 监听到 `games` 记录后，**同时**开启 2.5 秒的 `rotateY` 动画，动画结束后获取同一个结果。

- [ ] **Step 3: Commit**

```bash
git add cloudfunctions/ miniprogram/pages/index/coin-flip.js
git commit -m "feat: implement cloud-consensus coin flip game"
```
