# 游戏模块大幅优化设计文档

## 1. 概述
本文档旨在优化现有微信小程序的游戏体验，引入“房间”概念以支持双方准备、退出恢复及历史记录功能，并完善“默契刮刮乐”与新增“你画我猜”游戏。

## 2. 核心架构设计

### 2.1 房间状态机 (Room State Machine)
所有游戏对局将统一由 `game_rooms` 集合管理。房间状态流转如下：
- **WAITING**: 初始状态，等待任一玩家进入。
- **PREPARING**: 玩家进入页面，点击“准备”。需 `playerA_ready` 与 `playerB_ready` 均为 `true`。
- **PLAYING**: 对局进行中。支持退出后重新进入，通过 `room_id` 恢复当前 `board` 或 `canvas` 状态。
- **FINISHED**: 对局结束，展示胜负结果。
- **CLOSED**: 房间结算并归档，数据迁移至历史记录。

### 2.2 数据模型 (Schema)

#### `game_rooms` (核心对局表)
```json
{
  "_id": "room_uuid",
  "relationshipId": "rel_id",
  "gameType": "gobang | scratch | draw_guess",
  "status": "WAITING | PREPARING | PLAYING | FINISHED",
  "players": {
    "playerA": { "openid": "id1", "ready": false, "lastActive": "timestamp" },
    "playerB": { "openid": "id2", "ready": false, "lastActive": "timestamp" }
  },
  "gameState": {
    "currentTurn": "openid",
    "data": {}, // 存储棋盘、画板路径、刮开进度等
    "winner": "openid | null"
  },
  "createTime": "timestamp",
  "updateTime": "timestamp"
}
```

#### `game_history` (简略战报表)
```json
{
  "_id": "history_uuid",
  "relationshipId": "rel_id",
  "gameType": "string",
  "winner": "openid | null",
  "duration": "number", // 秒
  "endTime": "timestamp"
}
```

#### `game_words` (你画我猜词库)
```json
{
  "word": "苹果",
  "category": "水果",
  "difficulty": "easy"
}
```

## 3. 功能详细设计

### 3.1 双方准备与退出恢复
- **准备流程**：进入游戏页 -> 监听 `game_rooms` -> 点击准备按钮 -> 云函数更新 `players.ready` -> 双方就绪后状态转为 `PLAYING`。
- **恢复流程**：`onLoad` 时查询 `relationshipId` 下状态为 `PLAYING` 或 `PREPARING` 的房间。若存在，直接加载 `gameState.data` 渲染界面。

### 3.2 游戏实现优化

#### 默契刮刮乐 (Scratch Card)
- **同步机制**：使用 `canvas` 离屏渲染。刮开动作通过坐标点同步给对方。
- **判定**：当刮开面积比例超过 80% 时，触发“心跳同步”动效并结束游戏。

#### 你画我猜 (Draw & Guess)
- **绘图同步**：实时监听 `canvas` 触碰点，将路径坐标数组 `path: [{x, y, type}]` 写入 `gameState.data`。
- **交互**：一方画图，另一方输入框输入答案。匹配 `game_words` 或自定义词汇。

## 4. 后端开发清单 (Todo)
1. **数据库**：创建 `game_rooms`, `game_history`, `game_words` 集合。
2. **云函数 `quickstartFunctions`**：
   - `handleGameReady`: 处理准备逻辑。
   - `submitGameAction`: 统一落子/绘图/刮卡接口。
   - `closeGameRoom`: 结算并写入历史记录。
3. **初始化脚本**：导入基础词库到 `game_words`。

## 5. 验收标准
- 双方未准备前无法开始游戏。
- 游戏中途杀掉小程序进程，再次进入能看到之前的进度。
- 游戏结束后，“游乐场”首页能查看到最近 5 条对战战报。
