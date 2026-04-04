const cloud = require("wx-server-sdk");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
// 获取openid
const getOpenId = async () => {
  // 获取基础信息
  const wxContext = cloud.getWXContext();
  return {
    openid: wxContext.OPENID,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID,
  };
};

// 获取小程序二维码
const getMiniProgramCode = async () => {
  // 获取小程序二维码的buffer
  const resp = await cloud.openapi.wxacode.get({
    path: "pages/index/index",
  });
  const { buffer } = resp;
  // 将图片上传云存储空间
  const upload = await cloud.uploadFile({
    cloudPath: "code.png",
    fileContent: buffer,
  });
  return upload.fileID;
};

// 创建集合
const createCollection = async () => {
  const collections = [
    "relationships",
    "daily_questions",
    "answers",
    "users",
    "games",
    "gobang_games",
    "game_rooms",
    "game_history",
    "game_words"
  ];

  for (const collectionName of collections) {
    try {
      await db.createCollection(collectionName);
    } catch (e) {
      // 捕获“集合已存在”等非致命错误
    }
  }

  try {
    // 初始化 game_words 如果为空
    const { total } = await db.collection("game_words").count();
    if (total === 0) {
      const initialWords = [
        { word: "苹果", category: "水果", difficulty: "easy" },
        { word: "大象", category: "动物", difficulty: "easy" },
        { word: "自行车", category: "交通工具", difficulty: "medium" },
        { word: "仙人掌", category: "植物", difficulty: "medium" },
        { word: "钢琴", category: "乐器", difficulty: "hard" },
        { word: "长城", category: "名胜", difficulty: "medium" },
        { word: "蜘蛛侠", category: "角色", difficulty: "easy" },
        { word: "火锅", category: "食物", difficulty: "easy" },
        { word: "埃菲尔铁塔", category: "建筑", difficulty: "hard" },
        { word: "企鹅", category: "动物", difficulty: "easy" },
        { word: "篮球", category: "运动", difficulty: "easy" },
        { word: "彩虹", category: "自然", difficulty: "easy" },
        { word: "雨伞", category: "物品", difficulty: "easy" },
        { word: "汉堡包", category: "食物", difficulty: "easy" },
        { word: "吉他", category: "乐器", difficulty: "medium" },
        { word: "直升机", category: "交通工具", difficulty: "hard" },
        { word: "自由女神像", category: "建筑", difficulty: "hard" },
        { word: "西瓜", category: "水果", difficulty: "easy" },
        { word: "老虎", category: "动物", difficulty: "easy" },
        { word: "小提琴", category: "乐器", difficulty: "hard" }
      ];

      for (const word of initialWords) {
        await db.collection("game_words").add({ data: word });
      }
    }

    // 初始化一个默认问题（如果 daily_questions 为空）
    const { total: qTotal } = await db.collection("daily_questions").count();
    if (qTotal === 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      await db.collection("daily_questions").add({
        data: {
          content: "如果余生只能共度一个午后，你希望我们在哪里度过？",
          date: today,
          createTime: db.serverDate()
        }
      });
    }

    return {
      success: true,
      message: "初始化完成"
    };
  } catch (e) {
    // 这里catch到的是该collection已经存在，从业务逻辑上来说是运行成功的，所以catch返回success给前端，避免工具在前端抛出异常
    return {
      success: true,
      data: "create collection success",
    };
  }
};

// 绑定双人关联
const linkRelationship = async (event) => {
  const data = event.data || {};
  const { inviterId } = data;
  const { OPENID } = cloud.getWXContext();

  if (!OPENID) {
    return { success: false, errMsg: '身份校验失败' };
  }

  if (!inviterId || inviterId === OPENID) {
    return { success: false, errMsg: '无效的邀请人 ID' };
  }

  try {
    // 实际上逻辑应该更严谨：检查 A 或 B 是否已在任何 active 关系中
    const _ = db.command;
    const { data: alreadyBound } = await db.collection('relationships').where(_.or([
      { userA: inviterId, status: 'active' },
      { userB: inviterId, status: 'active' },
      { userA: OPENID, status: 'active' },
      { userB: OPENID, status: 'active' }
    ])).get();

    if (alreadyBound.length > 0) {
      return { success: false, errMsg: '一方或双方已有关联' };
    }

    // 不存在则创建
    await db.collection('relationships').add({
      data: {
        userA: inviterId,
        userB: OPENID,
        createTime: db.serverDate(),
        status: 'active',
        energy: 1
      }
    });
    return { success: true };
  } catch (e) {
    return { success: false, errMsg: e.message };
  }
};

// 获取今日一问
const getDailyQuestion = async (event) => {
  const data = (event && event.data) || {};
  const { relationshipId } = data;
  
  // 业务日期：当前时间减去 4 小时
  const now = new Date();
  const businessDate = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  businessDate.setHours(0, 0, 0, 0);
  
  try {
    // 1. 优先检查自定义题目 (relationships 中存储的 customQuestion)
    if (relationshipId) {
      const { data: relData } = await db.collection('relationships').doc(relationshipId).get();
      if (relData && relData.customQuestion) {
        const cq = relData.customQuestion;
        const cqDate = new Date(cq.date);
        cqDate.setHours(0, 0, 0, 0);
        if (cqDate.getTime() === businessDate.getTime()) {
           return { success: true, question: cq };
        }
      }
    }

    // 2. 读取 daily_questions 中的题目
    const { data: qData } = await db.collection('daily_questions')
      .where({
        date: db.command.gte(businessDate).and(db.command.lt(new Date(businessDate.getTime() + 24 * 60 * 60 * 1000)))
      })
      .get();
    
    if (qData.length > 0) {
      return { success: true, question: qData[0] };
    } else {
      // 兜底：如果今日没有指定问题，可以随机取一个或者返回默认
      const { data: allQuestions } = await db.collection('daily_questions').get();
      const randomIndex = allQuestions.length > 0 ? Math.floor(Math.random() * allQuestions.length) : 0;
      return { success: true, question: allQuestions[randomIndex] || { _id: 'default', content: '今天想对 ta 说点什么？' } };
    }
  } catch (e) {
    return { success: false, errMsg: e.message };
  }
};

// 刷新今日题目
const refreshDailyQuestion = async (event) => {
  const data = event.data || {};
  const { relationshipId } = data;
  if (!relationshipId) return { success: false, errMsg: '未指定书卷' };

  const now = new Date();
  const businessDate = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  businessDate.setHours(0, 0, 0, 0);

  try {
    // 随机取一个题目
    const { data: allQuestions } = await db.collection('daily_questions').get();
    if (allQuestions.length === 0) return { success: false, errMsg: '题库空空如也' };
    
    const randomIndex = Math.floor(Math.random() * allQuestions.length);
    const newQuestion = allQuestions[randomIndex];
    
    // 标记为自定义并带上业务日期
    const customQuestion = {
      ...newQuestion,
      date: businessDate,
      isCustom: true
    };

    await db.collection('relationships').doc(relationshipId).update({
      data: {
        customQuestion: customQuestion
      }
    });

    return { success: true, question: customQuestion };
  } catch (e) {
    return { success: false, errMsg: e.message };
  }
};

// 设置自定义题目
const setCustomQuestion = async (event) => {
  const data = event.data || {};
  const { relationshipId, content } = data;
  if (!relationshipId || !content) return { success: false, errMsg: '参数缺失' };

  const now = new Date();
  const businessDate = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  businessDate.setHours(0, 0, 0, 0);

  try {
    const customQuestion = {
      _id: 'custom_' + Date.now(),
      content: content,
      date: businessDate,
      isCustom: true
    };

    await db.collection('relationships').doc(relationshipId).update({
      data: {
        customQuestion: customQuestion
      }
    });

    return { success: true, question: customQuestion };
  } catch (e) {
    return { success: false, errMsg: e.message };
  }
};

// 提交答案
const submitAnswer = async (event) => {
  const data = event.data || {};
  const { questionId, relationshipId, content, type, mediaUrl, isSolo } = data;
  const { OPENID } = cloud.getWXContext();

  if (!OPENID) {
    return { success: false, errMsg: '身份校验失败' };
  }

  if (!questionId) {
    return { success: false, errMsg: '参数缺失' };
  }

  try {
    const finalRelId = isSolo ? '' : relationshipId;
    
    // 如果非 Solo 模式，检查关系是否活跃
    if (!isSolo && finalRelId) {
      const { data: rels } = await db.collection('relationships').where({
        _id: finalRelId,
        status: 'active'
      }).get();
      if (rels.length === 0) {
        return { success: false, errMsg: '此份手札已封存，无法再落笔' };
      }
    }
    
    // 检查是否已经回答过
    const { data: existing } = await db.collection('answers').where({
      questionId,
      relationshipId: finalRelId,
      openid: OPENID
    }).get();

    if (existing.length > 0) {
      return { success: false, errMsg: '今日已作答' };
    }

    // 插入答案
    await db.collection('answers').add({
      data: {
        questionId,
        relationshipId: finalRelId,
        openid: OPENID,
        content: content || '',
        type: type || 'text',
        mediaUrl: mediaUrl || '',
        privacy: 'public', // 默认公开
        createTime: db.serverDate()
      }
    });

    // 如果非 Solo 模式，增加关系能量值
    if (!isSolo && finalRelId) {
      await db.collection('relationships').doc(finalRelId).update({
        data: {
          energy: db.command.inc(1)
        }
      });
    }

    return { success: true };
  } catch (e) {
    return { success: false, errMsg: e.message };
  }
};

// 获取历史答案
const getHistoryAnswers = async (event) => {
  const data = event.data || {};
  const { relationshipId } = data;
  if (!relationshipId) {
    return { success: false, errMsg: '参数缺失' };
  }

  try {
    const { list } = await db.collection('answers').aggregate()
      .match({
        relationshipId
      })
      .lookup({
        from: 'daily_questions',
        localField: 'questionId',
        foreignField: '_id',
        as: 'question'
      })
      .unwind('$question')
      .group({
        _id: '$questionId',
        questionContent: db.command.aggregate.first('$question.content'),
        createTime: db.command.aggregate.first('$createTime'),
        answers: db.command.aggregate.push({
          openid: '$openid',
          content: '$content',
          type: '$type',
          mediaUrl: '$mediaUrl',
          privacy: '$privacy'
        })
      })
      .sort({
        createTime: -1
      })
      .end();

    return { success: true, data: list };
  } catch (e) {
    return { success: false, errMsg: e.message };
  }
};

// 检查今日答题状态
const checkAnswerStatus = async (event) => {
  const data = event.data || {};
  const { questionId, relationshipId, mode } = data;
  const { OPENID } = cloud.getWXContext();

  if (!OPENID) {
    return { success: false, errMsg: '身份校验失败' };
  }

  if (!questionId) {
    return { success: false, errMsg: '参数缺失' };
  }

  try {
    const whereObj = {
      questionId,
      openid: OPENID
    };
    
    if (mode === 'solo' || !relationshipId) {
      whereObj.relationshipId = '';
    } else {
      whereObj.relationshipId = relationshipId;
    }

    const { data: results } = await db.collection('answers').where(whereObj).get();

    if (results.length > 0) {
      return { success: true, isAnswered: true, answer: results[0] };
    } else {
      return { success: true, isAnswered: false };
    }
  } catch (e) {
    return { success: false, errMsg: e.message };
  }
};

// 语气实验室 - AI 文本润色
const rewriteText = async (event) => {
  const data = event.data || {};
  const { text } = data;
  if (!text) {
    return { success: false, errMsg: '文本内容为空' };
  }

  // 这里可以接入真实的 LLM 接口，现在暂时返回一个模拟的“书面化”转换结果
  const rewrites = {
    "你又迟到了": "漫长的等待让这页纸显得有些孤独",
    "你怎么不回消息": "指尖的墨迹已干，却迟迟未等来你的回音",
    "我好累": "身后的尘嚣已远，只想在这一方墨色里枕着你的名字入眠",
    "你在干嘛": "此时窗外的云朵，是否也正掠过你思索时的眼角"
  };

  return { 
    success: true, 
    result: rewrites[text] || `(润色后) ${text}` 
  };
};

// 更新个人信息并同步到关系镜像
const updateUserInfo = async (event) => {
  const data = event.data || {};
  const { userInfo } = data;
  const { OPENID } = cloud.getWXContext();

  if (!OPENID) {
    return { success: false, errMsg: '身份校验失败' };
  }

  if (!userInfo) {
    return { success: false, errMsg: '用户信息缺失' };
  }

  try {
    const infoUpdate = {
      updateTime: db.serverDate()
    };
    // 统一使用 nickname (全小写)
    if (userInfo.nickname !== undefined) infoUpdate.nickname = userInfo.nickname;
    if (userInfo.avatarUrl !== undefined) infoUpdate.avatarUrl = userInfo.avatarUrl;
    if (userInfo.mood !== undefined) infoUpdate.mood = userInfo.mood;
    if (userInfo.location !== undefined) infoUpdate.location = userInfo.location;

    // 1. 更新 users 集合
    const { data: users } = await db.collection('users').where({ _openid: OPENID }).get();
    if (users.length > 0) {
      await db.collection('users').doc(users[0]._id).update({ data: infoUpdate });
    } else {
      await db.collection('users').add({
        data: {
          ...infoUpdate,
          _openid: OPENID,
          createTime: db.serverDate()
        }
      });
    }

    // 2. 同步更新活跃的关系文档中的冗余字段 (Info Mirroring)
    const updateA = { 'userAInfo.updateTime': db.serverDate() };
    const updateB = { 'userBInfo.updateTime': db.serverDate() };
    
    if (userInfo.nickname !== undefined) {
      updateA['userAInfo.nickname'] = userInfo.nickname;
      updateB['userBInfo.nickname'] = userInfo.nickname;
    }
    if (userInfo.avatarUrl !== undefined) {
      updateA['userAInfo.avatarUrl'] = userInfo.avatarUrl;
      updateB['userBInfo.avatarUrl'] = userInfo.avatarUrl;
    }
    if (userInfo.mood !== undefined) {
      updateA['userAInfo.mood'] = userInfo.mood;
      updateA.userAMood = userInfo.mood;
      updateB['userBInfo.mood'] = userInfo.mood;
      updateB.userBMood = userInfo.mood;
    }
    if (userInfo.location !== undefined) {
      updateA['userAInfo.location'] = userInfo.location;
      updateA.userALocation = userInfo.location;
      updateB['userBInfo.location'] = userInfo.location;
      updateB.userBLocation = userInfo.location;
    }

    // 更新作为 userA 的关系
    await db.collection('relationships').where({
      userA: OPENID,
      status: 'active'
    }).update({
      data: updateA
    });

    // 更新作为 userB 的关系
    await db.collection('relationships').where({
      userB: OPENID,
      status: 'active'
    }).update({
      data: updateB
    });

    return { success: true };
  } catch (e) {
    console.error('updateUserInfo failed', e);
    return { success: false, errMsg: e.message };
  }
};

// 解绑并归档关系
const unbindRelationship = async (event) => {
  const { OPENID } = cloud.getWXContext();

  if (!OPENID) {
    return { success: false, errMsg: '身份校验失败' };
  }

  const _ = db.command;

  try {
    // 找到当前用户所属的活跃关系
    const { data: relations } = await db.collection('relationships').where(_.and([
      _.or([
        { userA: OPENID },
        { userB: OPENID }
      ]),
      { status: 'active' }
    ])).get();

    if (relations.length === 0) {
      return { success: true, data: 'no active relationship found' };
    }

    // 更新状态为 archived 并记录归档时间
    await db.collection('relationships').doc(relations[0]._id).update({
      data: {
        status: 'archived',
        archiveTime: db.serverDate()
      }
    });

    return { success: true };
  } catch (e) {
    return { success: false, errMsg: e.message };
  }
};

// 切换答案隐私状态
const toggleAnswerPrivacy = async (event) => {
  const data = event.data || {};
  const { answerId } = data;
  const { OPENID } = cloud.getWXContext();

  if (!OPENID) {
    return { success: false, errMsg: '身份校验失败' };
  }

  if (!answerId) {
    return { success: false, errMsg: '参数缺失' };
  }

  try {
    const { data: answer } = await db.collection('answers').doc(answerId).get();
    
    if (!answer || answer.openid !== OPENID) {
      return { success: false, errMsg: '无权操作此记录' };
    }

    const nextPrivacy = answer.privacy === 'private' ? 'public' : 'private';
    
    await db.collection('answers').doc(answerId).update({
      data: {
        privacy: nextPrivacy,
        updateTime: db.serverDate()
      }
    });

    return { success: true, privacy: nextPrivacy };
  } catch (e) {
    return { success: false, errMsg: e.message };
  }
};

// 确保用户记录存在 (初始化用户)
const ensureUserRecord = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { success: false, errMsg: '未获取到 OPENID' };

  try {
    // 检查集合是否存在，如果报错说明集合未创建
    let users;
    try {
      const res = await db.collection('users').where({ _openid: OPENID }).get();
      users = res.data;
    } catch (e) {
      // 如果报错，尝试重新创建集合
      await createCollection();
      const res = await db.collection('users').where({ _openid: OPENID }).get();
      users = res.data;
    }

    if (!users || users.length === 0) {
      await db.collection('users').add({
        data: {
          _openid: OPENID,
          nickname: '旅人',
          avatarUrl: '', 
          mood: 'happy',
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        }
      });
      console.log('New user record created for:', OPENID);
    }
    return { success: true };
  } catch (e) {
    console.error('ensureUserRecord fatal error:', e);
    return { success: false, errMsg: e.message };
  }
}

// 抛硬币 (云端共识)
const flipCoin = async (event) => {
  const data = event.data || {};
  const { relationshipId } = data;
  const { OPENID } = cloud.getWXContext();

  if (!relationshipId || !OPENID) {
    return { success: false, errMsg: '参数缺失或身份无效' };
  }

  try {
    const result = Math.random() > 0.5 ? 'head' : 'tail';
    
    await db.collection('games').add({
      data: {
        type: 'coin',
        relationshipId,
        initiator: OPENID,
        result,
        status: 'completed',
        createTime: db.serverDate()
      }
    });

    return { success: true, result };
  } catch (e) {
    return { success: false, errMsg: e.message };
  }
};

// 获取用户信息
const getUserInfo = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { success: false, errMsg: '身份校验失败' };

  try {
    const { data } = await db.collection('users').where({ _openid: OPENID }).get();
    if (data.length > 0) {
      return { success: true, userInfo: data[0] };
    } else {
      return { success: true, userInfo: null };
    }
  } catch (e) {
    return { success: false, errMsg: e.message };
  }
}

// 获取当前活跃关系
const getActiveRelationship = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { success: false, errMsg: '身份校验失败' };

  try {
    const _ = db.command;
    const { data } = await db.collection('relationships').where(_.and([
      _.or([
        { userA: OPENID },
        { userB: OPENID }
      ]),
      { status: 'active' }
    ])).get();

    if (data.length > 0) {
      return { success: true, relationship: data[0] };
    } else {
      return { success: true, relationship: null };
    }
  } catch (e) {
    return { success: false, errMsg: e.message };
  }
}

// 初始化五子棋游戏
const initGobang = async (event) => {
  const { relationshipId } = event.data || {};
  const { OPENID } = cloud.getWXContext();

  if (!relationshipId || !OPENID) {
    return { success: false, errMsg: '参数缺失' };
  }

  try {
    // 获取关系信息以确定白棋玩家（对手）
    const { data: rel } = await db.collection('relationships').doc(relationshipId).get();
    if (!rel) return { success: false, errMsg: '关系不存在' };
    
    const whitePlayer = rel.userA === OPENID ? rel.userB : rel.userA;

    // 创建 15x15 的矩阵
    const board = Array(15).fill(null).map(() => Array(15).fill(null));
    
    const gameData = {
      relationshipId,
      board,
      currentTurn: 'black',
      blackPlayer: OPENID, // 发起者默认黑棋
      whitePlayer,
      status: 'playing',
      createTime: db.serverDate(),
      lastUpdateTime: db.serverDate()
    };

    // 检查是否已有正在进行的五子棋游戏
    const { data: existingGames } = await db.collection('gobang_games').where({
      relationshipId,
      status: 'playing'
    }).get();

    if (existingGames.length > 0) {
      // 更新现有游戏
      await db.collection('gobang_games').doc(existingGames[0]._id).update({
        data: gameData
      });
      return { success: true, gameId: existingGames[0]._id };
    } else {
      // 创建新游戏
      const res = await db.collection('gobang_games').add({
        data: gameData
      });
      return { success: true, gameId: res._id };
    }
  } catch (e) {
    return { success: false, errMsg: e.message };
  }
};

// 五子棋胜负检查辅助函数
const checkGobangWin = (board, x, y, color) => {
  const directions = [
    [[0, 1], [0, -1]], // 水平
    [[1, 0], [-1, 0]], // 垂直
    [[1, 1], [-1, -1]], // 主对角线
    [[1, -1], [-1, 1]]  // 副对角线
  ];

  for (const dir of directions) {
    let count = 1;
    for (const [dx, dy] of dir) {
      let nx = x + dx;
      let ny = y + dy;
      while (nx >= 0 && nx < 15 && ny >= 0 && ny < 15 && board[nx][ny] === color) {
        count++;
        nx += dx;
        ny += dy;
      }
    }
    if (count >= 5) return true;
  }
  return false;
};

// 下五子棋
const placeGobangPiece = async (event) => {
  const { gameId, x, y } = event.data || {};
  const { OPENID } = cloud.getWXContext();

  if (!gameId || x === undefined || y === undefined) {
    return { success: false, errMsg: '参数缺失' };
  }

  try {
    const { data: game } = await db.collection('gobang_games').doc(gameId).get();
    if (!game) return { success: false, errMsg: '游戏不存在' };
    if (game.status !== 'playing') return { success: false, errMsg: '游戏已结束' };

    // 权限与回合检查
    const isBlack = game.blackPlayer === OPENID;
    const isWhite = game.whitePlayer === OPENID;
    
    if (!isBlack && !isWhite) return { success: false, errMsg: '你不是这局游戏的玩家' };
    if (game.currentTurn === 'black' && !isBlack) return { success: false, errMsg: '还没轮到你' };
    if (game.currentTurn === 'white' && !isWhite) return { success: false, errMsg: '还没轮到你' };

    if (game.board[x][y]) return { success: false, errMsg: '这里已经有棋子了' };

    const color = game.currentTurn;
    const newBoard = game.board;
    newBoard[x][y] = color;
    
    const win = checkGobangWin(newBoard, x, y, color);
    
    const updateData = {
      board: newBoard,
      lastUpdateTime: db.serverDate()
    };
    
    if (win) {
      updateData.status = 'won';
      updateData.winner = color;
    } else {
      updateData.currentTurn = color === 'black' ? 'white' : 'black';
    }

    await db.collection('gobang_games').doc(gameId).update({
      data: updateData
    });

    return { success: true, win, winner: win ? color : null };
  } catch (e) {
    return { success: false, errMsg: e.message };
  }
};

// 处理房间准备逻辑
const handleGameReady = async (event) => {
  const { relationshipId, gameType } = event.data || {};
  const { OPENID } = cloud.getWXContext();

  if (!relationshipId || !gameType || !OPENID) {
    return { success: false, errMsg: '参数缺失' };
  }

  try {
    // 1. 获取关系信息以确定 playerA 和 playerB
    const { data: rel } = await db.collection('relationships').doc(relationshipId).get();
    if (!rel) return { success: false, errMsg: '关系不存在' };

    // 2. 查找活跃房间 (WAITING, PREPARING, PLAYING)
    const _ = db.command;
    let { data: rooms } = await db.collection('game_rooms').where({
      relationshipId,
      gameType,
      status: _.in(['WAITING', 'PREPARING', 'PLAYING'])
    }).get();

    let room;
    if (rooms.length === 0) {
      // 创建新房间
      const newRoom = {
        relationshipId,
        gameType,
        status: 'WAITING',
        players: {
          playerA: { openid: rel.userA, ready: false, lastActive: db.serverDate() },
          playerB: { openid: rel.userB, ready: false, lastActive: db.serverDate() }
        },
        gameState: {
          currentTurn: rel.userA, // 默认 A 先手
          data: {},
          winner: null
        },
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      };
      const res = await db.collection('game_rooms').add({ data: newRoom });
      room = { ...newRoom, _id: res._id };
    } else {
      room = rooms[0];
    }

    // 如果已经在进行中，直接返回
    if (room.status === 'PLAYING') {
      return { success: true, room };
    }

    // 3. 更新准备状态
    const isPlayerA = room.players.playerA.openid === OPENID;
    const isPlayerB = room.players.playerB.openid === OPENID;

    if (!isPlayerA && !isPlayerB) {
      return { success: false, errMsg: '你不是该房间的玩家' };
    }

    const updateData = {
      updateTime: db.serverDate()
    };

    if (isPlayerA) {
      updateData['players.playerA.ready'] = true;
      room.players.playerA.ready = true;
    } else if (isPlayerB) {
      updateData['players.playerB.ready'] = true;
      room.players.playerB.ready = true;
    }

    // 4. 检查是否双方都准备好了
    if (room.players.playerA.ready && room.players.playerB.ready) {
      updateData.status = 'PLAYING';
      // 初始化特定游戏数据
      if (gameType === 'gobang') {
        updateData['gameState.data'] = {
          board: Array(15).fill(null).map(() => Array(15).fill(null))
        };
      } else if (gameType === 'scratch') {
        updateData['gameState.data'] = {
          progress: 0,
          points: []
        };
      } else if (gameType === 'draw_guess') {
        const { list } = await db.collection('game_words').aggregate().sample({ size: 1 }).end();
        updateData['gameState.data'] = {
          word: list.length > 0 ? list[0].word : '苹果',
          paths: []
        };
      }
    } else {
      updateData.status = 'PREPARING';
    }

    await db.collection('game_rooms').doc(room._id).update({ data: updateData });

    // 重新获取最新的 room 数据返回给前端
    const { data: updatedRoom } = await db.collection('game_rooms').doc(room._id).get();
    return { success: true, room: updatedRoom };

  } catch (e) {
    return { success: false, errMsg: e.message };
  }
};

// 结束房间逻辑
const closeGameRoom = async (event) => {
  const { roomId, relationshipId, gameType, winner, duration } = event.data || {};
  const { OPENID } = cloud.getWXContext();

  if (!roomId && (!relationshipId || !gameType)) {
    return { success: false, errMsg: '参数缺失' };
  }

  try {
    let targetRoomId = roomId;
    let room;

    if (!targetRoomId) {
      const { data: rooms } = await db.collection('game_rooms').where({
        relationshipId,
        gameType,
        status: 'PLAYING'
      }).get();
      if (rooms.length === 0) return { success: false, errMsg: '未找到进行中的房间' };
      room = rooms[0];
      targetRoomId = room._id;
    } else {
      const { data: r } = await db.collection('game_rooms').doc(targetRoomId).get();
      room = r;
    }

    if (!room) return { success: false, errMsg: '房间不存在' };

    // 1. 更新房间状态为 FINISHED
    await db.collection('game_rooms').doc(targetRoomId).update({
      data: {
        status: 'FINISHED',
        'gameState.winner': winner || null,
        updateTime: db.serverDate()
      }
    });

    // 2. 写入游戏历史
    await db.collection('game_history').add({
      data: {
        relationshipId: room.relationshipId,
        gameType: room.gameType,
        winner: winner || null,
        duration: duration || 0,
        endTime: db.serverDate()
      }
    });

    return { success: true };
  } catch (e) {
    return { success: false, errMsg: e.message };
  }
};

// 云函数入口函数
exports.main = async (event, context) => {
  switch (event.type) {
    case "getOpenId":
      return await getOpenId();
    case "getMiniProgramCode":
      return await getMiniProgramCode();
    case "createCollection":
      return await createCollection();
    case "selectRecord":
      return await selectRecord();
    case "updateRecord":
      return await updateRecord(event);
    case "insertRecord":
      return await insertRecord(event);
    case "deleteRecord":
      return await deleteRecord(event);
    case "linkRelationship":
      return await linkRelationship(event);
    case "getDailyQuestion":
      return await getDailyQuestion(event);
    case "refreshDailyQuestion":
      return await refreshDailyQuestion(event);
    case "setCustomQuestion":
      return await setCustomQuestion(event);
    case "submitAnswer":
      return await submitAnswer(event);
    case "getHistoryAnswers":
      return await getHistoryAnswers(event);
    case "checkAnswerStatus":
      return await checkAnswerStatus(event);
    case "rewriteText":
      return await rewriteText(event);
    case "updateUserInfo":
      return await updateUserInfo(event);
    case "unbindRelationship":
      return await unbindRelationship(event);
    case "toggleAnswerPrivacy":
      return await toggleAnswerPrivacy(event);
    case "flipCoin":
      return await flipCoin(event);
    case "ensureUserRecord":
      return await ensureUserRecord(event);
    case "getUserInfo":
      return await getUserInfo(event);
    case "getActiveRelationship":
      return await getActiveRelationship(event);
    case "initGobang":
      return await initGobang(event);
    case "placeGobangPiece":
      return await placeGobangPiece(event);
    case "handleGameReady":
      return await handleGameReady(event);
    case "closeGameRoom":
      return await closeGameRoom(event);
  }
};
