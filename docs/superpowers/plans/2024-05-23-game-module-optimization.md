# 游戏模块大幅优化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 优化现有游戏体验，引入房间准备、退出恢复与历史记录功能，完善刮刮乐并新增你画我猜。

**Architecture:** 采用统一的 `game_rooms` 状态机管理对局生命周期。利用云数据库 `watch` 实现双人状态同步。游戏结束后自动清理房间并将结果存入 `game_history`。

**Tech Stack:** 微信小程序原生框架, 微信云开发 (CloudBase), Canvas 2D。

---

### Task 1: 数据库与基础词库初始化

**Files:**
- Modify: `cloudfunctions/quickstartFunctions/index.js`
- Create: `cloudfunctions/quickstartFunctions/initDatabase.js`

- [ ] **Step 1: 在云函数中添加初始化集合逻辑**
确保 `game_rooms`, `game_history`, `game_words` 集合存在。

- [ ] **Step 2: 导入“你画我猜”基础词库**
编写脚本向 `game_words` 插入至少 20 个初始词汇。

```javascript
const initialWords = [
  { word: "苹果", category: "水果", difficulty: "easy" },
  { word: "大象", category: "动物", difficulty: "easy" },
  { word: "自行车", category: "交通工具", difficulty: "medium" }
];
// 批量插入逻辑...
```

- [ ] **Step 3: 运行初始化云函数并验证**
通过开发者工具运行云函数，检查云开发后台集合是否创建成功。

- [ ] **Step 4: Commit**
`git commit -m "chore: initialize game database collections and words"`

---

### Task 2: 房间管理云函数实现

**Files:**
- Modify: `cloudfunctions/quickstartFunctions/index.js`
- Create: `cloudfunctions/quickstartFunctions/gameManager.js`

- [ ] **Step 1: 实现 `handleGameReady` 云函数**
处理玩家准备状态。当双方都 ready 时，将房间状态切换为 `PLAYING`。

- [ ] **Step 2: 实现 `closeGameRoom` 云函数**
对局结束时，更新房间状态为 `FINISHED`，并将战报写入 `game_history`。

- [ ] **Step 3: Commit**
`git commit -m "feat: add game room management cloud functions"`

---

### Task 3: 五子棋体验优化 (准备与恢复)

**Files:**
- Modify: `miniprogram/pages/index/gobang.js`
- Modify: `miniprogram/pages/index/gobang.wxml`

- [ ] **Step 1: 重构 `onLoad` 以支持房间恢复**
首先查询当前关系下是否有 `status: PLAYING` 的五子棋房间，有则直接进入。

- [ ] **Step 2: 增加准备界面 UI**
在 `gobang.wxml` 中增加蒙层，显示双方准备状态。

- [ ] **Step 3: 绑定准备按钮逻辑**
调用 `handleGameReady` 云函数更新自己的准备状态。

- [ ] **Step 4: 测试退出恢复功能**
进入游戏后杀掉进程重新进入，验证棋盘状态是否保留。

- [ ] **Step 5: Commit**
`git commit -m "feat: optimize gobang with room ready and recovery"`

---

### Task 4: 默契刮刮乐完善

**Files:**
- Create: `miniprogram/pages/index/scratch.js`
- Create: `miniprogram/pages/index/scratch.wxml`
- Create: `miniprogram/pages/index/scratch.wxss`

- [ ] **Step 1: 实现 Canvas 刮刮乐逻辑**
使用 `destination-out` 混合模式实现刮开效果。

- [ ] **Step 2: 同步刮开坐标**
将刮开的坐标点实时同步至 `game_rooms` 的 `gameState.data`。

- [ ] **Step 3: 实现面积计算与结算**
计算刮开比例，超过 80% 时触发胜负判定并调用 `closeGameRoom`。

- [ ] **Step 4: Commit**
`git commit -m "feat: complete scratch card game with sync"`

---

### Task 5: 你画我猜功能开发

**Files:**
- Create: `miniprogram/pages/index/draw-guess.js`
- Create: `miniprogram/pages/index/draw-guess.wxml`
- Create: `miniprogram/pages/index/draw-guess.wxss`

- [ ] **Step 1: 基础画板实现**
支持画笔粗细、颜色选择。

- [ ] **Step 2: 实时路径同步**
通过 `db.watch` 监听房间内的 `paths` 数组，实时渲染对方的笔迹。

- [ ] **Step 3: 猜词逻辑与结算**
监听输入框，匹配正确词汇后结束对局。

- [ ] **Step 4: Commit**
`git commit -m "feat: add draw and guess game"`

---

### Task 6: 游乐场首页战报展示

**Files:**
- Modify: `miniprogram/pages/index/games.js`
- Modify: `miniprogram/pages/index/games.wxml`

- [ ] **Step 1: 获取最近战报**
在 `onShow` 时查询 `game_history` 最近 5 条数据。

- [ ] **Step 2: 渲染战报列表**
在游戏列表下方显示“最近对战”卡片。

- [ ] **Step 3: Commit**
`git commit -m "feat: display game history on games index page"`
