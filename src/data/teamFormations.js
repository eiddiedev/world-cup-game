const TEAM_DEFAULT_FORMATIONS = {
  france: '4-3-3',
  brazil: '4-2-3-1',
  argentina: '4-3-3',
  portugal: '4-2-3-1',
  germany: '4-2-3-1',
  japan: '3-4-2-1',
  norway: '4-3-3',
  morocco: '5-3-2',
  newzealand: '5-3-2',
  curacao: '4-4-2',
  spain: '4-3-3',
  england: '4-2-3-1',
  usa: '4-3-3',
  canada: '4-4-2',
  mexico: '4-3-3',
  colombia: '4-2-3-1',
  capeverde: '5-4-1',
}

const TEAM_TACTICAL_PROFILES = {
  france: {
    formation: TEAM_DEFAULT_FORMATIONS.france,
    styleTags: ['速度冲击', '防守反击', '前场压迫'],
    gameModel: '用速度撕开身后空间，三前锋轮流冲击禁区。',
  },
  brazil: {
    formation: TEAM_DEFAULT_FORMATIONS.brazil,
    styleTags: ['传控', '个人盘带', '速度冲击'],
    gameModel: '双后腰兜底，前场四人用技术和换位制造机会。',
  },
  argentina: {
    formation: TEAM_DEFAULT_FORMATIONS.argentina,
    styleTags: ['传控', '定位球', '核心串联'],
    gameModel: '围绕核心组织者控球，落后时提高纵向推进速度。',
  },
  portugal: {
    formation: TEAM_DEFAULT_FORMATIONS.portugal,
    styleTags: ['定位球', '速度冲击', '边路传中'],
    gameModel: '边路持续起球，关键节点依靠高星终结者解决比赛。',
  },
  germany: {
    formation: TEAM_DEFAULT_FORMATIONS.germany,
    styleTags: ['传控', '高位压迫', '定位球'],
    gameModel: '阵线保持紧凑，用体能和执行力压低失误率。',
  },
  japan: {
    formation: TEAM_DEFAULT_FORMATIONS.japan,
    styleTags: ['高位压迫', '传控', '速度冲击'],
    gameModel: '三中卫释放翼卫，前场靠连续压迫和小范围配合抢节奏。',
  },
  norway: {
    formation: TEAM_DEFAULT_FORMATIONS.norway,
    styleTags: ['定位球', '速度冲击', '高空冲击'],
    gameModel: '快速把球送进禁区，让强力中锋持续压迫防线。',
  },
  morocco: {
    formation: TEAM_DEFAULT_FORMATIONS.morocco,
    styleTags: ['防守反击', '速度冲击', '低位防守'],
    gameModel: '五后卫先稳住禁区，抢断后把球交给边路速度点。',
  },
  newzealand: {
    formation: TEAM_DEFAULT_FORMATIONS.newzealand,
    styleTags: ['防守反击', '定位球', '高空冲击'],
    gameModel: '用五后卫熬住强敌压力，依靠定位球和点球制造冷门。',
  },
  curacao: {
    formation: TEAM_DEFAULT_FORMATIONS.curacao,
    styleTags: ['防守反击', '速度冲击', '点球奇兵'],
    gameModel: '紧凑站位保护中路，后程换上速度点偷袭身后。',
  },
  spain: {
    formation: TEAM_DEFAULT_FORMATIONS.spain,
    styleTags: ['传控', '高位压迫', '短传渗透'],
    gameModel: '用极致的传控压制对手，前场三人组灵活换位撕裂防线。',
  },
  england: {
    formation: TEAM_DEFAULT_FORMATIONS.england,
    styleTags: ['速度冲击', '定位球', '边路传中'],
    gameModel: '双后腰保护防线，边路爆点持续冲击，定位球制造杀机。',
  },
  usa: {
    formation: TEAM_DEFAULT_FORMATIONS.usa,
    styleTags: ['速度冲击', '前场压迫', '反击'],
    gameModel: '用体能和速度打乱对手节奏，主场气势加成明显。',
  },
  canada: {
    formation: TEAM_DEFAULT_FORMATIONS.canada,
    styleTags: ['速度冲击', '防守反击', '定位球'],
    gameModel: '紧凑阵型快速转换，依靠边路速度发动致命反击。',
  },
  mexico: {
    formation: TEAM_DEFAULT_FORMATIONS.mexico,
    styleTags: ['传控', '速度冲击', '定位球'],
    gameModel: '短传配合撕开空间，主场高原体能优势明显。',
  },
  colombia: {
    formation: TEAM_DEFAULT_FORMATIONS.colombia,
    styleTags: ['传控', '个人盘带', '速度冲击'],
    gameModel: '前腰核心串联全队，边路爆点一对一制造威胁。',
  },
  capeverde: {
    formation: TEAM_DEFAULT_FORMATIONS.capeverde,
    styleTags: ['防守反击', '定位球', '速度冲击'],
    gameModel: '五后卫铁桶阵，抢断后快速找前场速度点。',
  },
}

const TEAM_NAME_TO_ID = {
  法国: 'france',
  巴西: 'brazil',
  阿根廷: 'argentina',
  葡萄牙: 'portugal',
  德国: 'germany',
  日本: 'japan',
  挪威: 'norway',
  摩洛哥: 'morocco',
  新西兰: 'newzealand',
  库拉索: 'curacao',
  西班牙: 'spain',
  英格兰: 'england',
  美国: 'usa',
  加拿大: 'canada',
  墨西哥: 'mexico',
  哥伦比亚: 'colombia',
  佛得角: 'capeverde',
}

export function getTeamDefaultFormation(teamIdOrName) {
  const teamId = TEAM_NAME_TO_ID[teamIdOrName] || teamIdOrName
  return TEAM_DEFAULT_FORMATIONS[teamId] || '4-3-3'
}

export function hasTeamDefaultFormation(teamIdOrName) {
  const teamId = TEAM_NAME_TO_ID[teamIdOrName] || teamIdOrName
  return Object.prototype.hasOwnProperty.call(TEAM_DEFAULT_FORMATIONS, teamId)
}

export function getTeamTacticalProfile(teamIdOrName) {
  const teamId = TEAM_NAME_TO_ID[teamIdOrName] || teamIdOrName
  return TEAM_TACTICAL_PROFILES[teamId] || {
    formation: getTeamDefaultFormation(teamId),
    styleTags: ['均衡'],
    gameModel: '按当前阵容强点选择进攻方向。',
  }
}

export { TEAM_TACTICAL_PROFILES }
