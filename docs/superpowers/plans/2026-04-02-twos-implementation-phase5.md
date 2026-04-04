# 《两只(TWOS)》- "手札游戏" 与多模态逻辑 实施计划 (Phase 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现多模态回答的实际上传逻辑（语音/图片），并开发首个情侣小游戏——“纸上抛硬币”。

**Architecture:** 
- **多模态存储**: 使用 `wx.cloud.uploadFile` 将媒体内容上传至云存储，并在 `answers` 集合中存储 `fileID`。
- **实时小游戏**: 使用云数据库 `Watcher` 监听 `games` 集合。当一方“抛出硬币”，另一方通过 `Watcher` 实时看到翻转动画和结果。
- **视觉美学**: 保持“纸质书面”风格，硬币采用墨色白描风格，背景为信纸。

**Tech Stack:** Weixin Mini Program Media API, Cloud Storage, Database Watcher, Canvas (Coin Flip Animation).

---

### Task 1: 多模态回答逻辑实现 (Media Upload & Record)

**Files:**
- Modify: `miniprogram/pages/index/answer.js`
- Modify: `cloudfunctions/quickstartFunctions/index.js` (Update `submitAnswer` to handle media)

- [ ] **Step 1: 实现图片选择与上传**

在 `answer.js` 中编写 `onUploadImage` 函数。

```javascript
onUploadImage() {
  wx.chooseMedia({
    count: 1,
    mediaType: ['image'],
    success: (res) => {
      const path = res.tempFiles[0].tempFilePath;
      // 预览并标记
      this.setData({ imagePath: path });
    }
  });
}
```

- [ ] **Step 2: 实现语音录制逻辑**

集成 `wx.getRecorderManager`，开始录制并在完成后将临时文件路径保存。

- [ ] **Step 3: 修改提交逻辑以支持云存储**

在 `onSubmit` 时，先将图片/语音文件上传至云存储获取 `fileID`，然后将 `fileID` 和 `type` 传给云函数。

- [ ] **Step 4: Commit**

```bash
git add miniprogram/pages/index/answer.js
git commit -m "feat: implement real image upload and voice recording logic for answers"
```

### Task 2: 情侣小游戏入口与“纸上抛硬币” (Coin Flip Game)

**Files:**
- Create: `miniprogram/pages/index/games.wxml`
- Create: `miniprogram/pages/index/games.js`
- Create: `miniprogram/pages/index/games.wxss`
- Create: `miniprogram/pages/index/coin-flip.wxml`
- Create: `miniprogram/pages/index/coin-flip.js`
- Create: `miniprogram/pages/index/coin-flip.wxss`
- Modify: `miniprogram/app.json`

- [ ] **Step 1: 创建小游戏门户页**

列出“纸上抛硬币”和“默契刮刮乐（预留）”两个入口。

- [ ] **Step 2: 开发“纸上抛硬币” UI 与动画**

在 `coin-flip.wxml` 中实现一个巨大的硬币（墨色描边），使用 CSS3 `rotateY` 实现翻转动画。

- [ ] **Step 3: 实现同步抛币逻辑**

一方点击“抛起”，在 `games` 集合中创建一条记录 `{ type: 'coin', result: Math.random() > 0.5 ? 'head' : 'tail', status: 'flipping' }`。
双方通过 `Watcher` 监听到记录，同时触发 2 秒的翻转动画。动画结束后展示最终结果。

- [ ] **Step 4: Commit**

```bash
git add miniprogram/pages/index/games.* miniprogram/pages/index/coin-flip.*
git commit -m "feat: implement synchronized coin flip mini-game"
```

### Task 3: 整体 UI 润色与导航集成

- [ ] **Step 1: 在首页增加“游乐场”入口图标**

在首页工具栏增加 `game.png` 图标入口，点击跳转到 `pages/index/games`。

- [ ] **Step 2: Commit**

```bash
git add miniprogram/pages/index/index.wxml
git commit -m "ui: add games entry to home page"
```
