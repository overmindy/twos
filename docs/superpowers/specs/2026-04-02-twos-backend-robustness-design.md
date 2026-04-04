# 《两只(TWOS)》- 后端健壮性补全与多模态扩展 (Phase 7) 设计规格说明书

## 1. 项目背景与痛点 (Project Background & Pain Points)
在目前的原型开发中，系统仍存在以下不完备之处：
*   **状态同步脆弱**: 地理位置、心情和距离计算依赖前端触发，导致数据在不活跃时失效。
*   **解绑逻辑缺失**: 解除绑定只是前端视图切换，后端关联记录未真实标记，且解绑后数据清理不彻底。
*   **信息读取滞后**: 双方无法实时查看对方最新的昵称、头像和状态。
*   **多模态管理缺失**: 图片和语音上传后缺乏查看、播放、隐藏或删除的操作。
*   **游戏逻辑非同步**: “纸上抛硬币”等互动结果仅由前端随机生成，缺乏云端共识。

## 2. 设计方案 (The Robust Design)

### 2.1 实时关系引擎 (Real-time Relationship Engine)
*   **状态同步机制**: 
    *   在 `relationships` 集合中引入 `lastActiveTime` 字段，标记双方最后一次产生互动（如：答题、共振、位置更新）的时间。
    *   **位置与天气缓存**: 由云函数定时（或在用户进入首页时触发）计算双方的 Haversine 距离，并将结果持久化在 `relationships` 文档中，避免前端重复计算。
*   **解绑与归档**: 
    *   执行 `unbindRelationship` 云函数，将 `status` 从 `active` 更新为 `archived`。
    *   系统会生成一个唯一的 `archiveId`，两人的共同回答 (`answers`) 将自动打上该标签，变为只读状态，可在“时光轴”查看但无法再向该历史关系追加回答。

### 2.2 多模态媒体管理 (Multi-modal Media Management)
*   **存储与预览**: 
    *   **图片**: 支持 `wx.previewImage` 全屏预览。
    *   **语音**: 实现自定义播放组件，通过 `fileID` 动态加载，且具备“正在播放”的墨迹波动动画。
*   **隐私控制**: 
    *   在 `answers` 集合中增加 `privacy` 字段 (`public` | `private`)。
    *   用户长按已回答的卡片，可触发“隐去”操作，将 `privacy` 设为 `private`。对方看到的是一个由模糊滤镜或墨水涂抹效果覆盖的占位符。

### 2.3 游戏共识机制 (Game Consensus Mechanism)
*   **云端抛币**: 
    *   由一方发起 `coinFlip` 云函数。
    *   云端生成随机数并在 `games` 集合中创建带有 `timestamp` 的记录。
    *   双方首页的 `Watcher` 监听到新记录后，**强制同步**播放相同时间的翻转动画，并展示一致的结果。
*   **记录留存**: 所有小游戏结果都会进入对应的关系归档，作为两人的互动资产。

### 2.4 用户镜像与个人信息 (User Profiling & Mirrors)
*   **用户信息持久化**: 
    *   每个用户在 `users` 集合中有唯一文档，存储 `nickname`, `avatarUrl`, `mood`, `location`。
    *   **关系镜像**: 在 `relationships` 中冗余存储双方最新的 `nickname` 和 `avatar`，确保即使一方长时间离线，另一方仍能看到对方的离线信息。

## 3. 架构与数据库 (Data Schema)

*   `relationships`: 
    *   `status`: `active` | `archived`
    *   `userAInfo`: `{ nickname, avatar, lastMood, lastLocation }`
    *   `userBInfo`: `{ nickname, avatar, lastMood, lastLocation }`
    *   `archiveTime`: Date
*   `answers`:
    *   `privacy`: `public` | `private`
*   `games`:
    *   `type`: `coin`
    *   `result`: `head` | `tail`
    *   `initiator`: openid

## 4. 转换策略 (Transition Strategy)
*   从当前“纯前端逻辑”向“云函数中转逻辑”过渡。核心操作（答题、绑定、解绑、游戏）必须经过云函数校验，确保数据一致性。
