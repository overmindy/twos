# 游戏与聊天室体验全面优化计划 (Bug 修复与功能增强)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复首页问题持久化、你画我猜同步、五子棋结算等 Bug，并增强聊天室、硬币游戏和题目系统。

**Architecture:** 
- **聊天室**: 引入 `messages` 集合 + `db.watch`。
- **题目系统**: 确保 `refreshDailyQuestion` 与 `relationships.customQuestion` 逻辑一致。
- **游戏结算**: 统一 `game_rooms` 到 `game_history` 的归档逻辑。

---

### Task 1: 首页问题持久化与同步修复

**Files:**
- Modify: `miniprogram/pages/index/index.js`
- Modify: `cloudfunctions/quickstartFunctions/index.js`

- [ ] **Step 1: 修复 `refreshDailyQuestion` 逻辑**
确保 `index.js` 在调用 `getDailyQuestion` 和 `refreshDailyQuestion` 时始终传递 `relationshipId`。
在 `index.js` 的 `fetchTodayQuestion` 中增加对 `relationshipId` 的校验。

- [ ] **Step 2: 确保自定义问题在 `answers` 中正确关联**
检查 `answer.js` 提交答案时，`questionId` 如果是自定义题目，应使用特定的占位 ID 或处理方式。

- [ ] **Step 3: Commit**
`git commit -m "fix: home page daily question persistence and sync"`

---

### Task 2: 止戈室 (聊天室) 全面增强

**Files:**
- Modify: `miniprogram/pages/index/peace.js`
- Modify: `miniprogram/pages/index/peace.wxml`
- Modify: `miniprogram/pages/index/peace.wxss`
- Modify: `cloudfunctions/quickstartFunctions/index.js`

- [ ] **Step 1: 新增 `sendMessage` 云函数**
存储消息到 `messages` 集合，包含 `relationshipId`, `senderOpenid`, `text`, `createTime`。

- [ ] **Step 2: 在 `peace.js` 实现实时同步**
使用 `db.collection('messages').where({ relationshipId }).watch()` 监听并实时更新 `chatList`。

- [ ] **Step 3: UI 优化与清空功能**
增大聊天框占比。
增加“焚化炉”按钮（清空记录），物理删除或逻辑隐藏该关系的 `messages`。

- [ ] **Step 4: Commit**
`git commit -m "feat: enhance chatroom with persistence, sync and clear history"`

---

### Task 3: 游戏逻辑修复 (五子棋结果、硬币机制)

**Files:**
- Modify: `miniprogram/pages/index/gobang.js`
- Modify: `miniprogram/pages/index/coin-flip.js`
- Modify: `cloudfunctions/quickstartFunctions/index.js`

- [ ] **Step 1: 完善五子棋结算**
在 `placeGobangPiece` 判定 win 后，调用 `closeGameRoom` 将结果写入 `game_history`。
前端 `gobang.js` 增加结算弹窗，展示胜负后再返回。

- [ ] **Step 2: 硬币游戏增加“押注”环节**
修改 `coin-flip.wxml`，在投掷前让双方选择“字”或“花”。
只有双方都选定后，才允许触发投掷。

- [ ] **Step 3: Commit**
`git commit -m "fix: gobang settlement and enhance coin flip bet mechanism"`

---

### Task 4: 你画我猜同步修复与题目增强

**Files:**
- Modify: `miniprogram/pages/index/draw-guess.js`
- Modify: `miniprogram/pages/index/draw-guess.wxml`

- [ ] **Step 1: 修复笔迹同步**
检查 `db.watch` 监听路径的实时性。确保每次 `touchmove` 结束时（`touchend`）或节流上传时，对方能触发重绘。

- [ ] **Step 2: 增加“换一题”与“自定义题目”**
在准备阶段，房主可以点击“换一题”（从 `game_words` 随机）或“自定义”（弹出输入框）。

- [ ] **Step 3: Commit**
`git commit -m "fix: draw-guess sync and add word customization features"`
