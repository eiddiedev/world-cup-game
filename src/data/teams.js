import { allPlayers } from './players/index.js'
import { prepareTeamPlayers } from './playerBalance.js'
import {
  DATA_RUNTIME_CONSTRAINTS,
  TEAM_DATA_CONSUMERS,
} from './teamDataContracts.js'
import { buildTeamSchemaMetadata } from './teamDataSchema.js'
import { getTeamTacticalProfile } from './teamFormations.js'
import { selectPlayableTeams } from '../config/runtime.js'
import { opponentTeams } from './opponentTeams.js'
import { crestAsset, flagAsset } from '../config/artAssets.js'

function withTacticalProfile(team) {
  const tacticalProfile = getTeamTacticalProfile(team.id)
  const profiledTeam = {
    ...team,
    defaultFormation: tacticalProfile.formation,
    styleTags: tacticalProfile.styleTags,
    gameModel: tacticalProfile.gameModel,
    tacticalProfile,
    dataConsumers: TEAM_DATA_CONSUMERS,
    runtimeModes: DATA_RUNTIME_CONSTRAINTS.runtimeModes,
    networking: DATA_RUNTIME_CONSTRAINTS.networking,
    packageBudgetMb: DATA_RUNTIME_CONSTRAINTS.packageBudgetMb,
  }

  return {
    ...profiledTeam,
    ...buildTeamSchemaMetadata(profiledTeam),
  }
}

/**
 * 球队配置数据
 * 16支国家队，各有不同的难度、预算、特色技能
 */
export const allTeams = [
  {
    id: 'france',
    name: '法国',
    nameEn: 'France',
    difficulty: 2,
    budget: 2310,
    skill: '巴黎之魂',
    flag: flagAsset('法国'),
    hero: '/assets/法国/法国超跑.png',
    logo: crestAsset('法国'),
    jerseyColor: '#1f4aa8',
    description: '天才扎堆，但更衣室是个谜。',
    mission: '重夺大力神杯',
    faMessage: '天赋可以兑现为冠军，证明给世界看。',
    faExpectation: '★★★★★ 重返世界之巅',
    worldCupTarget: '夺冠',
    group: 'I 组',
    groupOpponents: [
      { name: '塞内加尔', flag: flagAsset('塞内加尔') },
      { name: '伊拉克', flag: flagAsset('伊拉克') },
      { name: '挪威', flag: flagAsset('挪威') },
    ],
    skillEffect: '上半场全队技术+10，下半场体能额外衰减5%',
    goldenStar: '法国超跑',
    goldenStarPosition: 'FW',
    players: prepareTeamPlayers(allPlayers.france || [], 'france', 2300)
  },
  {
    id: 'brazil',
    name: '巴西',
    nameEn: 'Brazil',
    difficulty: 2,
    budget: 2130,
    skill: '桑巴节奏',
    flag: flagAsset('巴西'),
    hero: '/assets/巴西/桑巴舞者.png',
    logo: crestAsset('巴西'),
    jerseyColor: '#2D8A4E',
    description: '足球就是艺术，赢球也要好看。',
    mission: '摘下第六颗星',
    faMessage: '五星荣耀属于过去，第六颗星属于未来。',
    faExpectation: '★★★★★ 第六颗星',
    worldCupTarget: '夺冠',
    group: 'C 组',
    groupOpponents: [
      { name: '摩洛哥', flag: flagAsset('摩洛哥') },
      { name: '海地', flag: flagAsset('海地') },
      { name: '苏格兰', flag: flagAsset('苏格兰') },
    ],
    skillEffect: '技术全队+8，但体能衰减加快，90分钟后体能-10',
    goldenStar: '桑巴舞者',
    goldenStarPosition: 'FW',
    players: prepareTeamPlayers(allPlayers.brazil || [], 'brazil', 2250)
  },
  {
    id: 'argentina',
    name: '阿根廷',
    nameEn: 'Argentina',
    difficulty: 2,
    budget: 2310,
    skill: '绝境反击',
    flag: flagAsset('阿根廷'),
    hero: '/assets/阿根廷/当世球王.png',
    logo: crestAsset('阿根廷'),
    jerseyColor: '#72c8f0',
    lightColor: true,
    description: '卫冕冠军，绝境中最危险。',
    mission: '重返世界之巅',
    faMessage: '距离冠军只差一步，全国期待你举起奖杯。',
    faExpectation: '★★★★★ 举国期待夺冠',
    worldCupTarget: '夺冠',
    group: 'J 组',
    groupOpponents: [
      { name: '阿尔及利亚', flag: flagAsset('阿尔及利亚') },
      { name: '奥地利', flag: flagAsset('奥地利') },
      { name: '约旦', flag: flagAsset('约旦') },
    ],
    skillEffect: '落后时全队攻击+12，加时赛再+8',
    goldenStar: '当世球王',
    goldenStarPosition: 'FW',
    players: prepareTeamPlayers(allPlayers.argentina || [], 'argentina', 2100)
  },
  {
    id: 'portugal',
    name: '葡萄牙',
    nameEn: 'Portugal',
    difficulty: 3,
    budget: 2130,
    skill: 'CR光环',
    flag: flagAsset('葡萄牙'),
    hero: '/assets/葡萄牙/边路游龙.png',
    logo: crestAsset('葡萄牙'),
    jerseyColor: '#b51d2a',
    description: '一个人撑起一支队伍的极限。',
    mission: '圆梦世界杯',
    faMessage: '欧洲冠军已到手，世界杯梦想等你完成。',
    faExpectation: '★★★★☆ 创造新时代',
    worldCupTarget: '四强',
    group: 'K 组',
    groupOpponents: [
      { name: '民主刚果', flag: flagAsset('刚果') },
      { name: '乌兹别克斯坦', flag: flagAsset('乌兹别克斯坦') },
      { name: '哥伦比亚', flag: flagAsset('哥伦比亚') },
    ],
    skillEffect: '队内最贵球员关键节点成功率+20%',
    goldenStar: '边路游龙',
    goldenStarPosition: 'FW',
    players: prepareTeamPlayers(allPlayers.portugal || [], 'portugal', 2050)
  },
  {
    id: 'germany',
    name: '德国',
    nameEn: 'Germany',
    difficulty: 4,
    budget: 2030,
    skill: '日耳曼机器',
    flag: flagAsset('德国'),
    hero: '/assets/德国/战车门卫.png',
    logo: crestAsset('德国'),
    jerseyColor: '#C8313D',
    description: '没有奇迹，只有纪律和执行。',
    mission: '日耳曼战车归来',
    faMessage: '经历低谷，承受质疑，让世界重新敬畏战车。',
    faExpectation: '★★★★☆ 重返豪门行列',
    worldCupTarget: '四强',
    group: 'E 组',
    groupOpponents: [
      { name: '库拉索', flag: flagAsset('库拉索') },
      { name: '科特迪瓦', flag: flagAsset('科特迪瓦') },
      { name: '厄瓜多尔', flag: flagAsset('厄瓜多尔') },
    ],
    skillEffect: '全队体能衰减降低20%，90分钟后仍保持全力',
    goldenStar: '战车门卫',
    goldenStarPosition: 'GK',
    players: prepareTeamPlayers(allPlayers.germany || [], 'germany', 1950)
  },
  {
    id: 'japan',
    name: '日本',
    nameEn: 'Japan',
    difficulty: 3,
    budget: 1960,
    skill: '高压逼抢',
    flag: flagAsset('日本'),
    hero: '/assets/日本/蓝武锋魂.png',
    logo: crestAsset('日本'),
    jerseyColor: '#174fbc',
    description: '没人看好他们，直到他们赢了。',
    mission: '亚洲新高度',
    faMessage: '让日本不仅创造惊喜，更创造历史。',
    faExpectation: '★★★☆☆ 冲击历史最佳战绩',
    worldCupTarget: '八强',
    group: 'F 组',
    groupOpponents: [
      { name: '荷兰', flag: flagAsset('荷兰') },
      { name: '瑞典', flag: flagAsset('瑞典') },
      { name: '突尼斯', flag: flagAsset('突尼斯') },
    ],
    skillEffect: '前60分钟全队技术+8，60分钟后体能-12',
    goldenStar: '蓝武锋魂',
    goldenStarPosition: 'MF',
    players: prepareTeamPlayers(allPlayers.japan || [], 'japan', 1850)
  },
  {
    id: 'norway',
    name: '挪威',
    nameEn: 'Norway',
    difficulty: 3,
    budget: 2200,
    skill: '北欧巨人',
    flag: flagAsset('挪威'),
    hero: '/assets/挪威/魔人布欧.png',
    logo: crestAsset('挪威'),
    jerseyColor: '#c8313d',
    description: '本届世界杯最大黑马。',
    mission: '黑马之路',
    faMessage: '本届世界杯最大黑马，让维京战歌响彻世界。',
    faExpectation: '★★★☆☆ 更进一步',
    worldCupTarget: '16强',
    group: 'I 组',
    groupOpponents: [
      { name: '法国', flag: flagAsset('法国') },
      { name: '塞内加尔', flag: flagAsset('塞内加尔') },
      { name: '伊拉克', flag: flagAsset('伊拉克') },
    ],
    skillEffect: '队内身体值最高球员每个关键节点+15%成功率',
    goldenStar: '魔人布欧',
    goldenStarPosition: 'FW',
    players: prepareTeamPlayers(allPlayers.norway || [], 'norway', 1700)
  },
  {
    id: 'morocco',
    name: '摩洛哥',
    nameEn: 'Morocco',
    difficulty: 4,
    budget: 2200,
    skill: '沙漠之狐',
    flag: flagAsset('摩洛哥'),
    hero: '/assets/摩洛哥/北非之狐.png',
    logo: crestAsset('摩洛哥'),
    jerseyColor: '#8b1d32',
    description: '上届最大黑马，逆袭是传统。',
    mission: '黑马不是奇迹',
    faMessage: '世界已认识摩洛哥，请证明我们属于顶级。',
    faExpectation: '★★★☆☆ 延续黑马传奇',
    worldCupTarget: '四强',
    group: 'C 组',
    groupOpponents: [
      { name: '巴西', flag: flagAsset('巴西') },
      { name: '海地', flag: flagAsset('海地') },
      { name: '苏格兰', flag: flagAsset('苏格兰') },
    ],
    skillEffect: '首个失球后全队防守+10，反击速度+15%',
    goldenStar: '北非之狐',
    goldenStarPosition: 'DF/MF',
    players: prepareTeamPlayers(allPlayers.morocco || [], 'morocco', 1800)
  },
  {
    id: 'curacao',
    name: '库拉索',
    nameEn: 'Curaçao',
    difficulty: 5,
    budget: 1460,
    skill: '海岛之心',
    flag: flagAsset('库拉索'),
    hero: '/assets/库拉索/蓝浪飞翼.png',
    logo: crestAsset('库拉索'),
    jerseyColor: '#1267b4',
    description: '参加世界杯本身就是奇迹。',
    mission: '加勒比风暴',
    faMessage: '终场哨声未响，没人能定义我们的极限。',
    faExpectation: '★☆☆☆☆ 享受挑战，书写传奇',
    worldCupTarget: '争取首胜',
    group: 'E 组',
    groupOpponents: [
      { name: '德国', flag: flagAsset('德国') },
      { name: '科特迪瓦', flag: flagAsset('科特迪瓦') },
      { name: '厄瓜多尔', flag: flagAsset('厄瓜多尔') },
    ],
    skillEffect: '点球大战成功率+30%',
    goldenStar: '蓝浪飞翼',
    goldenStarPosition: 'FW',
    players: prepareTeamPlayers(allPlayers.curacao || [], 'curacao', 1170)
  },
  {
    id: 'spain',
    name: '西班牙',
    nameEn: 'Spain',
    difficulty: 1,
    budget: 2310,
    skill: 'Tiki-Taka',
    flag: flagAsset('西班牙'),
    logo: crestAsset('西班牙'),
    jerseyColor: '#c60b1e',
    description: '重走冠军之路。',
    mission: '捍卫冠军荣耀',
    faMessage: '重走冠军之路，再一次把大力神杯带回西班牙。',
    faExpectation: '★★★★★ 冠军势在必得',
    worldCupTarget: '夺冠',
    group: 'H 组',
    groupOpponents: [
      { name: '佛得角', flag: flagAsset('佛得角') },
      { name: '沙特', flag: flagAsset('沙特') },
      { name: '乌拉圭', flag: flagAsset('乌拉圭') },
    ],
    skillEffect: '进攻三区连续三脚以上传球时，下一脚关键传成功率+25%',
    players: prepareTeamPlayers(allPlayers.spain || [], 'spain', 2350)
  },
  {
    id: 'england',
    name: '英格兰',
    nameEn: 'England',
    difficulty: 2,
    budget: 2310,
    skill: '三狮之心',
    flag: flagAsset('英格兰'),
    logo: crestAsset('英格兰'),
    jerseyColor: '#263B78',
    description: '最遗憾，让足球回家。',
    mission: '让足球回家',
    faMessage: '最遗憾的那一步，这次让足球真的回家。',
    faExpectation: '★★★★☆ 至少闯入决赛',
    worldCupTarget: '夺冠',
    group: 'L 组',
    groupOpponents: [
      { name: '克罗地亚', flag: flagAsset('克罗地亚') },
      { name: '巴拿马', flag: flagAsset('巴拿马') },
      { name: '加纳', flag: flagAsset('加纳') },
    ],
    skillEffect: '75分钟后全队士气不掉，落后时定位球成功率+20%',
    players: prepareTeamPlayers(allPlayers.england || [], 'england', 2200)
  },
  {
    id: 'colombia',
    name: '哥伦比亚',
    nameEn: 'Colombia',
    difficulty: 4,
    budget: 2030,
    skill: '咖啡魔法',
    flag: flagAsset('哥伦比亚'),
    logo: crestAsset('哥伦比亚'),
    jerseyColor: '#fcd116',
    lightColor: true,
    description: '激情与天赋并存，黄金一代正当时。',
    mission: '黄金一代绽放',
    faMessage: '激情与天赋并存，迎接哥伦比亚黄金时代。',
    faExpectation: '★★★☆☆ 黄金一代证明自己',
    worldCupTarget: '八强',
    group: 'K 组',
    groupOpponents: [
      { name: '葡萄牙', flag: flagAsset('葡萄牙') },
      { name: '民主刚果', flag: flagAsset('刚果') },
      { name: '乌兹别克斯坦', flag: flagAsset('乌兹别克斯坦') },
    ],
    skillEffect: '1v1盘带节点成功率+18%，更容易制造犯规',
    players: prepareTeamPlayers(allPlayers.colombia || [], 'colombia', 1900)
  },
  {
    id: 'usa',
    name: '美国',
    nameEn: 'USA',
    difficulty: 5,
    budget: 2030,
    skill: '星条气势',
    flag: flagAsset('美国'),
    logo: crestAsset('美国'),
    jerseyColor: '#3c3b6e',
    description: '东道主之一，足球新大陆正在觉醒。',
    mission: '足球新时代',
    faMessage: '世界杯来到美国，让足球走进每个人心中。',
    faExpectation: '★★★☆☆ 主场不留遗憾',
    worldCupTarget: '八强',
    group: 'D 组',
    groupOpponents: [
      { name: '巴拉圭', flag: flagAsset('巴拉圭') },
      { name: '澳大利亚', flag: flagAsset('澳大利亚') },
      { name: '土耳其', flag: flagAsset('土耳其') },
    ],
    skillEffect: '主场比赛全队体能消耗降低30%',
    players: prepareTeamPlayers(allPlayers.usa || [], 'usa', 1800)
  },
  {
    id: 'mexico',
    name: '墨西哥',
    nameEn: 'Mexico',
    difficulty: 5,
    budget: 2030,
    skill: '阿兹特克之魂',
    flag: flagAsset('墨西哥'),
    logo: crestAsset('墨西哥'),
    jerseyColor: '#006847',
    description: '高原主场，第五度举办世界杯的国度。',
    mission: '捍卫主场荣耀',
    faMessage: '阿兹特克呐喊不息，赢得比赛更赢得骄傲。',
    faExpectation: '★★★★☆ 东道主必须有所作为',
    worldCupTarget: '八强',
    group: 'A 组',
    groupOpponents: [
      { name: '南非', flag: flagAsset('南非') },
      { name: '韩国', flag: flagAsset('韩国') },
      { name: '捷克', flag: flagAsset('捷克') },
    ],
    skillEffect: '对手定位球成功率-15%，主场气势+10%',
    players: prepareTeamPlayers(allPlayers.mexico || [], 'mexico', 1750)
  },
  {
    id: 'canada',
    name: '加拿大',
    nameEn: 'Canada',
    difficulty: 4,
    budget: 2030,
    skill: '枫叶反击',
    flag: flagAsset('加拿大'),
    logo: crestAsset('加拿大'),
    jerseyColor: '#d52b1e',
    description: '北境新军，主场作战的东道主。',
    mission: '北境崛起',
    faMessage: '主场是压力也是机会，在世界舞台留名。',
    faExpectation: '★★☆☆☆ 创造国家历史',
    worldCupTarget: '16强',
    group: 'B 组',
    groupOpponents: [
      { name: '波黑', flag: flagAsset('波黑') },
      { name: '卡塔尔', flag: flagAsset('卡塔尔') },
      { name: '瑞士', flag: flagAsset('瑞士') },
    ],
    skillEffect: '抢断成功后10秒内反击速度+20%',
    players: prepareTeamPlayers(allPlayers.canada || [], 'canada', 1500)
  },
  {
    id: 'capeverde',
    name: '佛得角',
    nameEn: 'Cape Verde',
    difficulty: 4,
    budget: 1660,
    skill: '群岛韧性',
    flag: flagAsset('佛得角'),
    logo: crestAsset('佛得角'),
    jerseyColor: '#003893',
    description: '延续奇迹。',
    mission: '群岛奇迹',
    faMessage: '延续奇迹，让大西洋群岛的故事走得更远。',
    faExpectation: '★★☆☆☆ 再创奇迹',
    worldCupTarget: '小组出线',
    group: 'H 组',
    groupOpponents: [
      { name: '西班牙', flag: flagAsset('西班牙') },
      { name: '沙特', flag: flagAsset('沙特') },
      { name: '乌拉圭', flag: flagAsset('乌拉圭') },
    ],
    skillEffect: '落后时全队防守+12，体能衰减降低25%',
    players: prepareTeamPlayers(allPlayers.capeverde || [], 'capeverde', 1200)
  },
].map(withTacticalProfile)

export const teams = selectPlayableTeams(allTeams)
  .sort((a, b) => a.difficulty - b.difficulty || b.budget - a.budget)
  .map(team => ({
  ...team,
  dataConsumers: team.dataConsumers || TEAM_DATA_CONSUMERS,
  runtimeModes: team.runtimeModes || DATA_RUNTIME_CONSTRAINTS.runtimeModes,
  networking: team.networking || DATA_RUNTIME_CONSTRAINTS.networking,
  packageBudgetMb: team.packageBudgetMb || DATA_RUNTIME_CONSTRAINTS.packageBudgetMb,
}))

/**
 * 48支世界杯球队国旗映射（中文名 → 图片路径）
 */
const FLAG_MAP = {
  // A组
  '墨西哥': flagAsset('墨西哥'),
  '南非': flagAsset('南非'),
  '韩国': flagAsset('韩国'),
  '捷克': flagAsset('捷克'),
  // B组
  '加拿大': flagAsset('加拿大'),
  '波黑': flagAsset('波黑'),
  '卡塔尔': flagAsset('卡塔尔'),
  '瑞士': flagAsset('瑞士'),
  // C组
  '巴西': flagAsset('巴西'),
  '摩洛哥': flagAsset('摩洛哥'),
  '海地': flagAsset('海地'),
  '苏格兰': flagAsset('苏格兰'),
  // D组
  '美国': flagAsset('美国'),
  '巴拉圭': flagAsset('巴拉圭'),
  '澳大利亚': flagAsset('澳大利亚'),
  '土耳其': flagAsset('土耳其'),
  // E组
  '德国': flagAsset('德国'),
  '库拉索': flagAsset('库拉索'),
  '科特迪瓦': flagAsset('科特迪瓦'),
  '厄瓜多尔': flagAsset('厄瓜多尔'),
  // F组
  '荷兰': flagAsset('荷兰'),
  '日本': flagAsset('日本'),
  '瑞典': flagAsset('瑞典'),
  '突尼斯': flagAsset('突尼斯'),
  // G组
  '比利时': flagAsset('比利时'),
  '埃及': flagAsset('埃及'),
  '伊朗': flagAsset('伊朗'),
  '新西兰': flagAsset('新西兰'),
  // H组
  '西班牙': flagAsset('西班牙'),
  '佛得角': flagAsset('佛得角'),
  '沙特': flagAsset('沙特'),
  '乌拉圭': flagAsset('乌拉圭'),
  // I组
  '法国': flagAsset('法国'),
  '塞内加尔': flagAsset('塞内加尔'),
  '伊拉克': flagAsset('伊拉克'),
  '挪威': flagAsset('挪威'),
  // J组
  '阿根廷': flagAsset('阿根廷'),
  '阿尔及利亚': flagAsset('阿尔及利亚'),
  '奥地利': flagAsset('奥地利'),
  '约旦': flagAsset('约旦'),
  // K组
  '葡萄牙': flagAsset('葡萄牙'),
  '民主刚果': flagAsset('刚果'),
  '刚果民主共和国': flagAsset('刚果'),
  '乌兹别克': flagAsset('乌兹别克斯坦'),
  '乌兹别克斯坦': flagAsset('乌兹别克斯坦'),
  '哥伦比亚': flagAsset('哥伦比亚'),
  // L组
  '英格兰': flagAsset('英格兰'),
  '克罗地亚': flagAsset('克罗地亚'),
  '巴拿马': flagAsset('巴拿马'),
  '加纳': flagAsset('加纳'),
}

/**
 * 获取球队国旗（图片路径，找不到返回null）
 */
export function getTeamFlag(teamName) {
  return FLAG_MAP[teamName] || null
}

/**
 * 根据 ID 或中文名获取球队（先查 16 支 playable 队，再查 32 支对手队）。
 * 比赛渲染、对手解析都用它，能命中对手国家队。
 */
export function getTeamById(teamIdOrName) {
  return allTeams.find((t) => t.id === teamIdOrName || t.name === teamIdOrName)
    || opponentTeams.find((t) => t.id === teamIdOrName || t.name === teamIdOrName)
    || null
}

/**
 * 比赛用球队查询（playable + 对手），语义同 getTeamById。
 */
export function getMatchTeamById(teamIdOrName) {
  return getTeamById(teamIdOrName)
}

/**
 * 按对手名（中文）或 id 解析对手球队，找不到返回 null。
 */
export function resolveOpponentByName(name) {
  if (!name) return null
  return getTeamById(name)
}

/**
 * 获取难度星级显示
 */
export function getDifficultyStars(difficulty) {
  return '★'.repeat(difficulty) + '☆'.repeat(5 - difficulty)
}
