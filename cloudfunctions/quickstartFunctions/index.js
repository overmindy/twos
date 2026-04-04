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
  try {
    // 创建集合
    await db.createCollection("sales");
    await db.createCollection("relationships");
    await db.createCollection("daily_questions");
    await db.createCollection("answers");
    await db.createCollection("users");
    await db.createCollection("games");

    // 初始化一个默认问题
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await db.collection("daily_questions").add({
      data: {
        content: "如果余生只能共度一个午后，你希望我们在哪里度过？",
        date: today,
        createTime: db.serverDate()
      }
    });

    await db.collection("sales").add({
      // data 字段表示需新增的 JSON 数据
      data: {
        region: "华东",
        city: "上海",
        sales: 11,
      },
    });
    await db.collection("sales").add({
      // data 字段表示需新增的 JSON 数据
      data: {
        region: "华东",
        city: "南京",
        sales: 11,
      },
    });
    await db.collection("sales").add({
      // data 字段表示需新增的 JSON 数据
      data: {
        region: "华南",
        city: "广州",
        sales: 22,
      },
    });
    await db.collection("sales").add({
      // data 字段表示需新增的 JSON 数据
      data: {
        region: "华南",
        city: "深圳",
        sales: 22,
      },
    });
    return {
      success: true,
    };
  } catch (e) {
    // 这里catch到的是该collection已经存在，从业务逻辑上来说是运行成功的，所以catch返回success给前端，避免工具在前端抛出异常
    return {
      success: true,
      data: "create collection success",
    };
  }
};

// 查询数据
const selectRecord = async () => {
  // 返回数据库查询结果
  return await db.collection("sales").get();
};

// 更新数据
const updateRecord = async (event) => {
  const data = event.data || [];
  try {
    // 遍历修改数据库信息
    for (let i = 0; i < data.length; i++) {
      await db
        .collection("sales")
        .where({
          _id: data[i]._id,
        })
        .update({
          data: {
            sales: data[i].sales,
          },
        });
    }
    return {
      success: true,
      data: data,
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e,
    };
  }
};

// 新增数据
const insertRecord = async (event) => {
  const data = event.data || {};
  try {
    const insertRecord = data;
    // 插入数据
    await db.collection("sales").add({
      data: {
        region: insertRecord.region,
        city: insertRecord.city,
        sales: Number(insertRecord.sales),
      },
    });
    return {
      success: true,
      data: data,
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e,
    };
  }
};

// 删除数据
const deleteRecord = async (event) => {
  const data = event.data || {};
  try {
    await db
      .collection("sales")
      .where({
        _id: data._id,
      })
      .remove();
    return {
      success: true,
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e,
    };
  }
};

// 绑定双人关联
const linkRelationship = async (event) => {
  const data = event.data || {};
  const { inviterId } = data;
  const { OPENID } = cloud.getWXContext();

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
const getDailyQuestion = async () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  try {
    const { data } = await db.collection('daily_questions')
      .where({
        date: db.command.gte(today).and(db.command.lt(new Date(today.getTime() + 24 * 60 * 60 * 1000)))
      })
      .get();
    
    if (data.length > 0) {
      return { success: true, question: data[0] };
    } else {
      // 兜底：如果今日没有指定问题，可以随机取一个或者返回默认
      const { data: allQuestions } = await db.collection('daily_questions').get();
      return { success: true, question: allQuestions[0] || { content: '今天想对 ta 说点什么？' } };
    }
  } catch (e) {
    return { success: false, errMsg: e.message };
  }
};

// 提交答案
const submitAnswer = async (event) => {
  const data = event.data || {};
  const { questionId, relationshipId, content, type, mediaUrl, isSolo } = data;
  const { OPENID } = cloud.getWXContext();

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
          mediaUrl: '$mediaUrl'
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

  if (!userInfo) {
    return { success: false, errMsg: '用户信息缺失' };
  }

  try {
    const infoUpdate = {
      updateTime: db.serverDate()
    };
    if (userInfo.nickname !== undefined) infoUpdate.nickname = userInfo.nickname;
    if (userInfo.avatarUrl !== undefined) infoUpdate.avatarUrl = userInfo.avatarUrl;
    if (userInfo.mood !== undefined) infoUpdate.mood = userInfo.mood;

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
    return { success: false, errMsg: e.message };
  }
};

// 解绑并归档关系
const unbindRelationship = async (event) => {
  const { OPENID } = cloud.getWXContext();
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

// 抛硬币 (云端共识)
const flipCoin = async (event) => {
  const data = event.data || {};
  const { relationshipId } = data;
  const { OPENID } = cloud.getWXContext();

  if (!relationshipId) {
    return { success: false, errMsg: '参数缺失' };
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
      return await getDailyQuestion();
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
  }
};
