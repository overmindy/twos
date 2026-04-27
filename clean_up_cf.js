const fs = require('fs');
const cfPath = 'cloudfunctions/quickstartFunctions/index.js';
let cfContent = fs.readFileSync(cfPath, 'utf8');

// Remove my previous syncLocation implementation
const redundantSyncLocationFunc = `
// 同步位置
const syncLocation = async (event) => {
  const data = event.data || {};
  const { relationshipId, latitude, longitude } = data;
  const { OPENID } = cloud.getWXContext();
  
  if (!relationshipId || !latitude || !longitude || !OPENID) {
    return { success: false, errMsg: '参数缺失' };
  }
  
  try {
    const { data: rel } = await db.collection('relationships').doc(relationshipId).get();
    if (!rel) return { success: false, errMsg: '关系不存在' };
    
    const isUserA = rel.userA === OPENID;
    const updateData = {
      updateTime: db.serverDate()
    };
    if (isUserA) {
      updateData.userALocation = { latitude, longitude, updateTime: db.serverDate() };
    } else {
      updateData.userBLocation = { latitude, longitude, updateTime: db.serverDate() };
    }

    await db.collection('relationships').doc(relationshipId).update({
      data: updateData
    });
    
    return { success: true };
  } catch (e) {
    return { success: false, errMsg: e.message };
  }
};
`;

cfContent = cfContent.replace(redundantSyncLocationFunc, '');

// Also remove the case in the switch
cfContent = cfContent.replace('    case "syncLocation":\n      return await syncLocation(event);', '');

fs.writeFileSync(cfPath, cfContent);
console.log('Cleaned up redundant syncLocation from Cloud Function');
