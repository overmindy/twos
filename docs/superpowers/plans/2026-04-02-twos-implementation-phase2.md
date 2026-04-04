# 《两只(TWOS)》- "私人手札" 情侣互动小程序 实施计划 (Phase 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现核心互动逻辑：每日一问的双盲解锁、基于 Canvas 的“羁绊之树”动态生长、以及“心跳共振”的墨色晕染特效。

**Architecture:** 
- **状态同步**: 使用微信云开发 `Database Watcher` 实时监听 `relationships` 和 `answers` 集合。
- **视觉特效**: 利用 `Canvas 2D` API 模拟钢笔白描线条和墨水扩散。
- **业务逻辑**: 封装 `RelationshipService` 处理双人数据聚合与同步。

**Tech Stack:** Weixin Mini Program SDK, WeChat Cloud Database (Real-time Watch), Canvas API.

---

### Task 1: 每日一问 - 数据模型与双盲解锁逻辑 (Double-blind Logic)

**Files:**
- Create: `cloudfunctions/quickstartFunctions/getDailyQuestion.js`
- Create: `cloudfunctions/quickstartFunctions/submitAnswer.js`
- Modify: `miniprogram/pages/index/index.js`
- Create: `miniprogram/pages/index/answer.wxml`
- Create: `miniprogram/pages/index/answer.js`
- Create: `miniprogram/pages/index/answer.wxss`

- [ ] **Step 1: 创建题库与答案集合结构**

在云数据库中手动（或通过初始化脚本）创建 `daily_questions` 和 `answers` 集合。
`daily_questions`: `{ _id, content, date }`
`answers`: `{ _id, relationshipId, questionId, openid, content, createTime }`

- [ ] **Step 2: 实现“提交答案”云函数**

在 `cloudfunctions/quickstartFunctions/index.js` 中增加 `submitAnswer` Case，记录用户回答并增加关系能量值。

- [ ] **Step 3: 编写答题页面 (The Letter Sheet)**

在 `pages/index/answer.wxml` 中实现类似信纸的输入界面，使用方格背景。

```xml
<view class="container letter-sheet">
  <view class="question-title">{{question.content}}</view>
  <textarea class="ink-textarea" placeholder="在此落笔..." bindinput="onInput"></textarea>
  <button class="btn-seal" bindtap="onSubmit">封缄</button>
</view>
```

- [ ] **Step 4: 实现首页实时监听逻辑**

在 `pages/index/index.js` 的 `onLoad` 中，使用 `db.collection('answers').watch()` 监听当前关系 ID 下的今日答案。
如果双方均已回答，触发 `isUnfolding` 动画，展示双栏对比。

- [ ] **Step 5: Commit**

```bash
git add cloudfunctions/ miniprogram/pages/index/
git commit -m "feat: implement double-blind question logic and answer page"
```

### Task 2: 羁绊之树 - 钢笔白描动态生长 (Botany Canvas)

**Files:**
- Modify: `miniprogram/pages/index/index.js`
- Create: `miniprogram/utils/tree-drawer.js`

- [ ] **Step 1: 编写 Canvas 绘图算法 (Pen-sketch Style)**

在 `utils/tree-drawer.js` 中实现基于递归的树枝生成算法，模拟钢笔线条（带随机抖动和粗细变化）。

```javascript
function drawBranch(ctx, x, y, angle, depth, energy) {
  // 模拟钢笔笔触：不规则线条
  ctx.beginPath();
  ctx.moveTo(x, y);
  // ... 递归逻辑 ...
  ctx.stroke();
}
```

- [ ] **Step 2: 根据关系能量渲染树的状态**

在首页 `onShow` 时获取 `relationship.energy`，调用绘图工具在 `canvas#bondingTree` 上绘制对应繁茂程度的植物。

- [ ] **Step 3: Commit**

```bash
git add miniprogram/utils/tree-drawer.js miniprogram/pages/index/index.js
git commit -m "feat: add pen-sketch style botanical illustration on canvas"
```

### Task 4: 心跳共振 - 墨色晕染特效 (Ink Resonance)

**Files:**
- Modify: `miniprogram/pages/index/index.wxml`
- Modify: `miniprogram/pages/index/index.js`
- Modify: `miniprogram/pages/index/index.wxss`

- [ ] **Step 1: 捕获长按手势与位置**

在首页底部印章按钮上绑定 `touchstart` 和 `touchend`。

- [ ] **Step 2: 实现墨水扩散动画 (Ink Diffusion)**

在 Canvas 上实现以指尖为圆心的多层、不规则扩散半透明圆环，模拟墨水在宣纸上化开的效果。

```javascript
function animateInkSpread(ctx, x, y) {
  // 使用 requestAnimationFrame 绘制逐渐变大、透明度降低的墨迹
}
```

- [ ] **Step 3: 实时发送“共振”信号**

长按超过 1.5s 后，调用云开发 `db.collection('relationships').doc(id).update({ data: { lastResonance: db.serverDate() } })`。
对方通过 `watch` 监听到 `lastResonance` 更新，触发本地震动和屏幕墨迹提示。

- [ ] **Step 4: Commit**

```bash
git add miniprogram/pages/index/
git commit -m "feat: add ink resonance effect and real-time vibration feedback"
```
