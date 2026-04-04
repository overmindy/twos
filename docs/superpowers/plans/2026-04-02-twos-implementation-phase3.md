# 《两只(TWOS)》- "私人手札" 情侣互动小程序 实施计划 (Phase 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成最后的核心功能：时光轴、语气实验室（AI 文本润色）以及首页状态气象站。

**Architecture:** 
- **时光轴**: 分页拉取 `answers` 集合，按日期排序并聚合 A/B 双方的回答。
- **语气实验室**: 通过云函数对接 AI 模型，对 `answer` 页面输入的文字进行“去火气”处理。
- **气象站**: 实时同步经纬度计算距离，并获取天气 API 状态展示。

**Tech Stack:** Weixin Mini Program API (`wx.getLocation`), Cloud Functions (AI Integration), Cloud Database.

---

### Task 1: 时光轴 - 历史对话索引 (Chronicle/Archive)

**Files:**
- Modify: `cloudfunctions/quickstartFunctions/index.js` (Add `getHistoryAnswers`)
- Modify: `miniprogram/pages/archive/index.wxml`
- Modify: `miniprogram/pages/archive/index.wxss`
- Modify: `miniprogram/pages/archive/index.js`

- [ ] **Step 1: 实现历史答案拉取云函数**

在 `cloudfunctions/quickstartFunctions/index.js` 中增加 `getHistoryAnswers` Case，聚合两人所有的历史记录。

```javascript
// cloudfunctions/quickstartFunctions/index.js 增加：
case 'getHistoryAnswers':
  const { relationshipId, lastDate } = event.data;
  // 查询逻辑：按时间倒序拉取，分页处理
  return await db.collection('answers').where({ relationshipId }).orderBy('createTime', 'desc').get();
```

- [ ] **Step 2: 编写时光轴 UI (Vertical Flow)**

在 `pages/archive/index.wxml` 中实现类似书籍目录的纵向流。

```xml
<view class="container archive-book">
  <block wx:for="{{historyList}}" wx:key="date">
    <view class="archive-item">
      <view class="date-tag">{{item.dateStr}}</view>
      <view class="qa-pair">
        <view class="question">「{{item.questionContent}}」</view>
        <view class="answers">
          <view class="answer-a">我：{{item.answerA}}</view>
          <view class="answer-b">TA：{{item.answerB}}</view>
        </view>
      </view>
    </view>
  </block>
</view>
```

- [ ] **Step 3: Commit**

```bash
git add cloudfunctions/ miniprogram/pages/archive/
git commit -m "feat: implement archive page with historical answer aggregation"
```

### Task 2: 语气实验室 - AI 文本润色 (Ink Eraser)

**Files:**
- Modify: `cloudfunctions/quickstartFunctions/index.js` (Add `rewriteText`)
- Modify: `miniprogram/pages/index/answer.wxml`
- Modify: `miniprogram/pages/index/answer.js`
- Modify: `miniprogram/pages/index/answer.wxss`

- [ ] **Step 1: 实现 AI 润色云函数**

在 `cloudfunctions/quickstartFunctions/index.js` 中模拟（或实际调用）AI 接口。

```javascript
// cloudfunctions/quickstartFunctions/index.js 增加：
case 'rewriteText':
  const { text } = event.data;
  // 这里可以接入真实的 LLM 接口，现在暂时返回一个模拟的“书面化”转换结果
  const rewrites = {
    "你又迟到了": "漫长的等待让这页纸显得有些孤独",
    "你怎么不回消息": "指尖的墨迹已干，却迟迟未等来你的回音"
  };
  return { success: true, result: rewrites[text] || `(润色后) ${text}` };
```

- [ ] **Step 2: 在答题页集成“润色”印章按钮**

```xml
<!-- pages/index/answer.wxml 增加 -->
<view class="ai-eraser" bindtap="onRewrite">
  <view class="eraser-icon">消</view>
  <text>语气实验室</text>
</view>
```

- [ ] **Step 3: Commit**

```bash
git add cloudfunctions/ miniprogram/pages/index/answer.js
git commit -m "feat: integrate AI Ink Eraser for non-violent communication"
```

### Task 3: 气象站 - 状态同步与距离感 (Status Resonance)

**Files:**
- Modify: `miniprogram/pages/index/index.wxml`
- Modify: `miniprogram/pages/index/index.js`
- Modify: `miniprogram/pages/index/index.wxss`

- [ ] **Step 1: 定时同步位置与状态**

在 `pages/index/index.js` 中使用 `wx.getLocation` 获取位置，并更新到 `relationships` 的对应用户字段。

- [ ] **Step 2: 计算距离并显示天气**

根据经纬度计算 Haversine 距离，并展示对方那里的天气状态（可使用模拟数据或天气 SDK）。

- [ ] **Step 3: Commit**

```bash
git add miniprogram/pages/index/
git commit -m "feat: add real-time distance and weather status to home page"
```
