const cloud = require("wx-server-sdk");
const crypto = require('crypto');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

// 计算亲密等级
const getLevelInfo = (energy) => {
  const levels = [
    { min: 0, title: '初识' },
    { min: 100, title: '相知' },
    { min: 300, title: '相守' },
    { min: 600, title: '不渝' },
    { min: 1000, title: '永恒' }
  ];
  let current = levels[0];
  for (const l of levels) {
    if (energy >= l.min) current = l;
    else break;
  }
  return { level: levels.indexOf(current) + 1, title: current.title };
};

// 初始化 AI 扩展 (如果环境支持)
let ai = null;
try {
  if (cloud.extend && cloud.extend.AI) {
    ai = cloud.extend.AI;
  }
} catch (e) {
  console.warn('AI extension init failed', e);
}

// 获取用户 OpenID
const getOpenId = async () => {
  const { OPENID } = cloud.getWXContext();
  return { success: true, openid: OPENID };
};

// 确保用户记录存在 (底档)
const ensureUserRecord = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { success: false, errMsg: '身份校验失败' };

  try {
    const { data } = await db.collection('users').where({ _openid: OPENID }).get();
    if (data.length === 0) {
      await db.collection('users').add({
        data: {
          _openid: OPENID,
          nickname: '书写者',
          avatarUrl: '',
          mood: 'happy',
          energy: 0,
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        }
      });
    }
    return { success: true };
  } catch (e) {
    return { success: false, errMsg: e.message };
  }
};

// 获取用户信息
const getUserInfo = async (event) => {
  const { OPENID } = cloud.getWXContext();
  try {
    const { data } = await db.collection('users').where({ _openid: OPENID }).get();
    if (data.length > 0) {
      return { success: true, userInfo: data[0] };
    }
    return { success: false, errMsg: '用户不存在' };
  } catch (e) {
    return { success: false, errMsg: e.message };
  }
};

// 更新用户信息 (包含镜像同步到关系)
const updateUserInfo = async (event) => {
  const { userInfo } = event.data || {};
  const { OPENID } = cloud.getWXContext();
  if (!userInfo) return { success: false, errMsg: '参数缺失' };

  try {
    const updateData = { ...userInfo, updateTime: db.serverDate() };
    await db.collection('users').where({ _openid: OPENID }).update({ data: updateData });

    // 同步镜像到 active 的关系中
    const _ = db.command;
    const { data: rels } = await db.collection('relationships').where(_.and([
      _.or([{ userA: OPENID }, { userB: OPENID }]),
      { status: 'active' }
    ])).get();

    if (rels.length > 0) {
      const rel = rels[0];
      const isUserA = rel.userA === OPENID;
      const field = isUserA ? 'userAInfo' : 'userBInfo';
      
      const mirrorData = {};
      if (userInfo.nickname) mirrorData[isUserA ? 'userANickname' : 'userBNickname'] = userInfo.nickname;
      if (userInfo.mood) mirrorData[isUserA ? 'userAMood' : 'userBMood'] = userInfo.mood;
      
      // 深度合并镜像信息
      mirrorData[field] = _.aggregate.merge([rel[field] || {}, userInfo]);

      await db.collection('relationships').doc(rel._id).update({
        data: mirrorData
      });
    }

    return { success: true };
  } catch (e) {
    return { success: false, errMsg: e.message };
  }
};

// 获取今日题目
const getDailyQuestion = async (event) => {
  const { relationshipId } = event.data || {};
  const now = new Date();
  const businessDate = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  businessDate.setHours(0, 0, 0, 0);

  try {
    // 1. 优先检查关系中是否有自定义题目
    if (relationshipId) {
      const { data: rel } = await db.collection('relationships').doc(relationshipId).get();
      if (rel && rel.customQuestion) {
        const cq = rel.customQuestion;
        const cqDate = new Date(cq.date);
        if (cqDate.getTime() === businessDate.getTime()) {
          return { success: true, question: cq };
        }
      }
    }

    // 2. 获取预设题目 (基于 businessDate 的哈希)
    const seed = businessDate.getTime().toString();
    const hash = crypto.createHash('md5').update(seed).digest('hex');
    const { data: allQuestions } = await db.collection('daily_questions').get();
    
    if (allQuestions.length === 0) {
      return { success: true, question: { content: '如果今天是一个颜色，你觉得是什么？', _id: 'default' } };
    }

    const index = parseInt(hash.substring(0, 8), 16) % allQuestions.length;
    return { success: true, question: allQuestions[index] };
  } catch (e) {
    return { success: false, errMsg: e.message };
  }
};

// 提交答案
const submitAnswer = async (event) => {
  const data = event.data || {};
  const { questionId, relationshipId, content, type, mediaUrl, isSolo } = data;
  const { OPENID } = cloud.getWXContext();

  if (!OPENID || !questionId) return { success: false, errMsg: '参数缺失' };

  try {
    const finalRelId = isSolo ? '' : relationshipId;

    if (!isSolo && finalRelId) {
      const { data: rels } = await db.collection('relationships').where({ _id: finalRelId, status: 'active' }).get();
      if (rels.length === 0) return { success: false, errMsg: '关系不活跃' };
    }

    // 1. 插入答案
    await db.collection('answers').add({
      data: {
        questionId,
        relationshipId: finalRelId,
        openid: OPENID,
        content: content || '',
        type: type || 'text',
        mediaUrl: mediaUrl || '',
        privacy: 'public',
        createTime: db.serverDate()
      }
    });

    // 2. 增长能量与等级 (非 Solo)
    if (!isSolo && finalRelId) {
      const { data: relBefore } = await db.collection('relationships').doc(finalRelId).get();
      const newEnergy = (relBefore.energy || 0) + 10;
      const { level, title } = getLevelInfo(newEnergy);

      // 3. 计算连击 (Streak)
      const now = new Date();
      const bizDate = new Date(now.getTime() - 4 * 60 * 60 * 1000);
      bizDate.setHours(0, 0, 0, 0);
      const yesterdayBiz = new Date(bizDate.getTime() - 24 * 60 * 60 * 1000);

      const { data: partnerAnswers } = await db.collection('answers').where({
        questionId,
        relationshipId: finalRelId,
        openid: db.command.neq(OPENID)
      }).get();

      let currentStreak = relBefore.streakCount || 0;
      let lastDate = relBefore.lastStreakDate ? new Date(relBefore.lastStreakDate) : null;
      if (lastDate) lastDate.setHours(0, 0, 0, 0);

      if (partnerAnswers.length > 0) {
        if (lastDate && lastDate.getTime() === yesterdayBiz.getTime()) {
          currentStreak += 1;
        } else if (!lastDate || lastDate.getTime() < yesterdayBiz.getTime()) {
          currentStreak = 1;
        }
      }

      const updateData = { energy: newEnergy, level, title };
      if (partnerAnswers.length > 0 && (!lastDate || lastDate.getTime() < bizDate.getTime())) {
        updateData.streakCount = currentStreak;
        updateData.lastStreakDate = bizDate;
      }

      await db.collection('relationships').doc(finalRelId).update({ data: updateData });
      
      // 检查勋章
      try {
        const existingBadges = relBefore.badges || [];
        const newBadges = [];
        if (newEnergy >= 500 && !existingBadges.includes('勤勉书写者')) newBadges.push('勤勉书写者');
        if (updateData.streakCount >= 7 && !existingBadges.includes('七日之约')) newBadges.push('七日之约');
        if (newBadges.length > 0) {
          await db.collection('relationships').doc(finalRelId).update({
            data: { badges: db.command.addToSet({ each: newBadges }) }
          });
        }
      } catch(badgeErr) { console.error(badgeErr); }
    }

    return { success: true };
  } catch (e) {
    return { success: false, errMsg: e.message };
  }
};

// ... 其他原有逻辑 (由于文件较长，我将后续逻辑合并) ...
// 获取历史问答
const getHistoryAnswers = async (event) => {
  const { relationshipId } = event.data || {};
  if (!relationshipId) return { success: false, errMsg: '参数缺失' };

  try {
    const { data: answers } = await db.collection('answers')
      .where({ relationshipId })
      .orderBy('createTime', 'desc')
      .get();

    // 按 questionId 分组
    const grouped = {};
    answers.forEach(a => {
      if (!grouped[a.questionId]) {
        grouped[a.questionId] = {
          questionId: a.questionId,
          createTime: a.createTime,
          answers: []
        };
      }
      grouped[a.questionId].answers.push(a);
    });

    // 填充题目内容 (简单处理，实际应 lookup)
    const { data: qs } = await db.collection('daily_questions').get();
    const qMap = {};
    qs.forEach(q => qMap[q._id] = q.content);

    const result = Object.values(grouped).map(g => ({
      ...g,
      questionContent: qMap[g.questionId] || '自定义题目'
    }));

    return { success: true, data: result };
  } catch (e) {
    return { success: false, errMsg: e.message };
  }
};

// 获取当前活跃关系
const getActiveRelationship = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const _ = db.command;
  try {
    const { data } = await db.collection('relationships').where(_.and([
      _.or([{ userA: OPENID }, { userB: OPENID }]),
      { status: 'active' }
    ])).get();
    
    if (data.length > 0) return { success: true, relationship: data[0] };
    return { success: true, relationship: null };
  } catch (e) {
    return { success: false, errMsg: e.message };
  }
};

// 戳一戳
const pokePartner = async (event) => {
  const { relationshipId } = event.data || {};
  const { OPENID } = cloud.getWXContext();
  try {
    await db.collection('relationships').doc(relationshipId).update({
      data: {
        lastPoke: { time: db.serverDate(), from: OPENID, to: db.command.neq(OPENID) }
      }
    });
    return { success: true };
  } catch (e) { return { success: false }; }
};

// 心动广场
const getSquarePosts = async (event) => {
  try {
    const _ = db.command;
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const { list: spotlightPosts } = await db.collection('answers').aggregate()
      .match({ privacy: 'public', isAnniversary: true, createTime: _.gte(oneDayAgo) })
      .lookup({ from: 'daily_questions', localField: 'questionId', foreignField: '_id', as: 'question' })
      .unwind('$question')
      .lookup({ from: 'users', localField: 'openid', foreignField: '_openid', as: 'user' })
      .unwind('$user')
      .end();

    const { list: normalPosts } = await db.collection('answers').aggregate()
      .match({ privacy: 'public', isAnniversary: _.neq(true) })
      .lookup({ from: 'daily_questions', localField: 'questionId', foreignField: '_id', as: 'question' })
      .unwind('$question')
      .lookup({ from: 'users', localField: 'openid', foreignField: '_openid', as: 'user' })
      .unwind('$user')
      .sort({ createTime: -1 }).limit(20).end();

    const anonymousList = [...spotlightPosts, ...normalPosts].map(post => ({
      _id: post._id,
      questionContent: post.question.content,
      answerContent: post.content,
      answerType: post.type,
      mediaUrl: post.mediaUrl,
      mood: post.user.mood || 'happy',
      authorNickname: post.isAnniversary ? (post.user.nickname + ' & Ta') : '某对 Twos',
      likeCount: post.likeCount || 0,
      isAnniversary: post.isAnniversary || false
    }));
    return { success: true, posts: anonymousList };
  } catch (e) { return { success: false }; }
};

const togglePostLike = async (event) => {
  const { postId } = event.data || {};
  const { OPENID } = cloud.getWXContext();
  const _ = db.command;
  try {
    const post = await db.collection('answers').doc(postId).get();
    const isLiked = post.data.likedBy && post.data.likedBy.includes(OPENID);
    await db.collection('answers').doc(postId).update({
      data: { likedBy: isLiked ? _.pull(OPENID) : _.addToSet(OPENID), likeCount: _.inc(isLiked ? -1 : 1) }
    });
    return { success: true, isLiked: !isLiked };
  } catch (e) { return { success: false }; }
};

const toggleSearching = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { status } = event.data || {};
  try {
    await db.collection('users').where({ _openid: OPENID }).update({ data: { isSearching: status } });
    return { success: true };
  } catch (e) { return { success: false }; }
};

const findMatch = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const _ = db.command;
  try {
    const { data: candidates } = await db.collection('users').where({ isSearching: true, _openid: _.neq(OPENID) }).limit(1).get();
    if (candidates.length === 0) return { success: true, matched: false };
    const partner = candidates[0];
    const newRel = await db.collection('relationships').add({
      data: { userA: OPENID, userB: partner._openid, status: 'active', createTime: db.serverDate(), energy: 1 }
    });
    await db.collection('users').where({ _openid: _.in([OPENID, partner._openid]) }).update({ data: { isSearching: false } });
    return { success: true, matched: true, relationshipId: newRel._id };
  } catch (e) { return { success: false }; }
};

const analyzeRelationship = async (event) => {
  const { relationshipId } = event.data || {};
  if (!ai) return { success: false };
  try {
    const { data: rel } = await db.collection('relationships').doc(relationshipId).get();
    const res = await ai.chat.completions.create({
      model: 'deepseek-v3.2',
      messages: [{ role: 'system', content: '你是一个温柔的恋爱观察员。请给这段关系写一段温情建议。' }, { role: 'user', content: `能量：${rel.energy}` }]
    });
    return { success: true, analysis: res.choices[0].message.content };
  } catch (e) { return { success: false }; }
};

const getTruthOrDare = async (event) => {
  if (!ai) return { success: false };
  try {
    const res = await ai.chat.completions.create({
      model: 'deepseek-v3.2',
      messages: [{ role: 'system', content: '生成两张【真心话】和一张【大冒险】卡牌。格式：JSON 数组。' }]
    });
    const cards = JSON.parse(res.choices[0].message.content.trim().replace(/```json/g, '').replace(/```/g, ''));
    return { success: true, cards };
  } catch (e) { return { success: false }; }
};

const getMoodCalendar = async (event) => {
  const { relationshipId, year } = event.data || {};
  try {
    const start = new Date(year, 0, 1);
    const { data } = await db.collection('answers').where({ relationshipId, createTime: db.command.gte(start) }).get();
    const calendar = {};
    data.forEach(item => {
      const d = new Date(item.createTime);
      const k = `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
      if (!calendar[k]) calendar[k] = [];
      calendar[k].push(item.mood || 'happy');
    });
    return { success: true, calendar };
  } catch (e) { return { success: false }; }
};

const getTwosWrapped = async (event) => {
  const { relationshipId } = event.data || {};
  try {
    const rel = await db.collection('relationships').doc(relationshipId).get();
    const totalDays = Math.floor((new Date() - new Date(rel.data.createTime)) / (1000 * 60 * 60 * 24)) + 1;
    return { success: true, data: { totalDays, energy: rel.data.energy || 0 } };
  } catch (e) { return { success: false }; }
};

const getAlbumPhotos = async (event) => {
  const { relationshipId } = event.data || {};
  try {
    const { data } = await db.collection('album').where({ relationshipId }).orderBy('createTime', 'desc').get();
    return { success: true, list: data };
  } catch (e) { return { success: false }; }
};

const uploadAlbumPhoto = async (event) => {
  const { relationshipId, fileID, description } = event.data || {};
  const { OPENID } = cloud.getWXContext();
  try {
    await db.collection('album').add({ data: { relationshipId, openid: OPENID, fileID, description, createTime: db.serverDate() } });
    return { success: true };
  } catch (e) { return { success: false }; }
};

const deleteAlbumPhoto = async (event) => {
  const { photoId } = event.data || {};
  try {
    await db.collection('album').doc(photoId).remove();
    return { success: true };
  } catch (e) { return { success: false }; }
};

const getCapsules = async (event) => {
  const { relationshipId } = event.data || {};
  try {
    const { data } = await db.collection('capsules').where({ relationshipId }).orderBy('createTime', 'desc').get();
    return { success: true, list: data };
  } catch (e) { return { success: false }; }
};

const createCapsule = async (event) => {
  const { relationshipId, content, openTime } = event.data || {};
  const { OPENID } = cloud.getWXContext();
  try {
    await db.collection('capsules').add({ data: { relationshipId, creator: OPENID, content, openTime: new Date(openTime), createTime: db.serverDate(), isOpened: false } });
    return { success: true };
  } catch (e) { return { success: false }; }
};

// 搜索历史记录
const searchHistory = async (event) => {
  const { relationshipId, keyword } = event.data || {};
  if (!relationshipId || !keyword) return { success: false, errMsg: '参数缺失' };

  try {
    const { data } = await db.collection('answers')
      .where({
        relationshipId,
        content: db.RegExp({
          regexp: keyword,
          options: 'i',
        })
      })
      .orderBy('createTime', 'desc')
      .get();
    
    return { success: true, list: data };
  } catch (e) {
    return { success: false, errMsg: e.message };
  }
};

// 建立关系 (绑定)
const linkRelationship = async (event) => {
  const { inviterId } = event.data || {};
  const { OPENID } = cloud.getWXContext();
  if (!inviterId || inviterId === OPENID) return { success: false, errMsg: '无效的邀请' };

  try {
    const _ = db.command;
    // 检查是否已有活跃关系
    const { data: existing } = await db.collection('relationships').where(_.and([
      _.or([{ userA: OPENID }, { userB: OPENID }]),
      { status: 'active' }
    ])).get();

    if (existing.length > 0) return { success: false, errMsg: '你已在一段羁绊中' };

    // 建立新关系
    const newRel = await db.collection('relationships').add({
      data: {
        userA: inviterId,
        userB: OPENID,
        status: 'active',
        createTime: db.serverDate(),
        energy: 1,
        badges: ['初次邂逅']
      }
    });

    // 给邀请人发勋章 (裂变奖励)
    await db.collection('relationships').where(_.and([
      _.or([{ userA: inviterId }, { userB: inviterId }]),
      { status: 'active' }
    ])).update({
      data: {
        badges: _.addToSet('引路人')
      }
    });

    return { success: true, relationshipId: newRel._id };
  } catch (e) {
    return { success: false, errMsg: e.message };
  }
};
// 获取今日任务
const getDailyTask = async (event) => {
  const now = new Date();
  const businessDate = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  businessDate.setHours(0, 0, 0, 0);

  try {
    const tasks = [
      { content: '互发一张此时此刻的搞怪自拍' },
      { content: '对 ta 说一句从未说过的情话' },
      { content: '分享一首你最近循环最多的歌' },
      { content: '一起在心里默数10秒，看是否同步' },
      { content: '为对方起一个新的专属外号' }
    ];
    const seed = businessDate.getTime().toString();
    const index = parseInt(crypto.createHash('md5').update(seed).digest('hex').substring(0, 8), 16) % tasks.length;
    return { success: true, task: tasks[index] };
  } catch (e) { return { success: false }; }
};
// 获取全网排行榜
const getLeaderboard = async (event) => {
  try {
    const { data } = await db.collection('relationships')
      .where({ status: 'active' })
      .orderBy('energy', 'desc')
      .limit(20)
      .get();

    const list = data.map((rel, index) => ({
      rank: index + 1,
      energy: rel.energy || 0,
      streak: rel.streakCount || 0,
      name: `${rel.userANickname || 'A'} & ${rel.userBNickname || 'B'}`
    }));

    return { success: true, list };
  } catch (e) {
    return { success: false, errMsg: e.message };
  }
};

// 云函数入口
exports.main = async (event, context) => {
  switch (event.type) {
    case "getLeaderboard": return await getLeaderboard(event);
    case "getDailyTask": return await getDailyTask(event);
...
    case "linkRelationship": return await linkRelationship(event);
...
    case "searchHistory": return await searchHistory(event);
    case "getOpenId": return await getOpenId();
    case "ensureUserRecord": return await ensureUserRecord(event);
    case "getUserInfo": return await getUserInfo(event);
    case "updateUserInfo": return await updateUserInfo(event);
    case "getDailyQuestion": return await getDailyQuestion(event);
    case "submitAnswer": return await submitAnswer(event);
    case "getHistoryAnswers": return await getHistoryAnswers(event);
    case "getActiveRelationship": return await getActiveRelationship(event);
    case "pokePartner": return await pokePartner(event);
    case "getSquarePosts": return await getSquarePosts(event);
    case "togglePostLike": return await togglePostLike(event);
    case "toggleSearching": return await toggleSearching(event);
    case "findMatch": return await findMatch(event);
    case "analyzeRelationship": return await analyzeRelationship(event);
    case "getTruthOrDare": return await getTruthOrDare(event);
    case "getMoodCalendar": return await getMoodCalendar(event);
    case "getTwosWrapped": return await getTwosWrapped(event);
    case "getAlbumPhotos": return await getAlbumPhotos(event);
    case "uploadAlbumPhoto": return await uploadAlbumPhoto(event);
    case "deleteAlbumPhoto": return await deleteAlbumPhoto(event);
    case "getCapsules": return await getCapsules(event);
    case "createCapsule": return await createCapsule(event);
    default: return { success: false, errMsg: '未知的请求类型' };
  }
};
