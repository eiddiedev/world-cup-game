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
const allTeams = [
  {
    id: 'france',
    name: '法国',
    nameEn: 'France',
    difficulty: 2,
    budget: 2310,
    skill: '巴黎之魂',
    flag: '/assets/国旗/法国.png',
    hero: '/assets/法国/法国超跑.png',
    logo: '/assets/队徽/法国.png',
    jerseyColor: '#1f4aa8',
    description: '天才扎堆，但更衣室是个谜。',
    mission: '重夺大力神杯',
    faMessage: '法国拥有世界最豪华的阵容之一。现在，证明天赋可以再次兑现为冠军。',
    faExpectation: '★★★★★ 重返世界之巅',
    worldCupTarget: '夺冠',
    group: 'I 组',
    groupOpponents: [
      { name: '塞内加尔', flag: '/assets/国旗/塞内加尔.png' },
      { name: '伊拉克', flag: '/assets/国旗/伊拉克.png' },
      { name: '挪威', flag: '/assets/国旗/挪威.png' },
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
    difficulty: 5,
    budget: 2130,
    skill: '桑巴节奏',
    flag: '/assets/国旗/巴西.png',
    hero: '/assets/巴西/桑巴舞者.png',
    logo: '/assets/队徽/巴西.png',
    jerseyColor: '#2D8A4E',
    description: '足球就是艺术，赢球也要好看。',
    mission: '摘下第六颗星',
    faMessage: '五星巴西的荣耀属于过去，第六颗星属于未来。桑巴军团，永远只为冠军而战。',
    faExpectation: '★★★★★ 第六颗星',
    worldCupTarget: '夺冠',
    group: 'C 组',
    groupOpponents: [
      { name: '摩洛哥', flag: '/assets/国旗/摩洛哥.png' },
      { name: '海地', flag: '/assets/国旗/海地.png' },
      { name: '苏格兰', flag: '/assets/国旗/苏格兰.png' },
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
    flag: '/assets/国旗/阿根廷.png',
    hero: '/assets/阿根廷/当世球王.png',
    logo: '/assets/队徽/阿根廷.png',
    jerseyColor: '#72c8f0',
    lightColor: true,
    description: '卫冕冠军，绝境中最危险。',
    mission: '重返世界之巅',
    faMessage: '我们距离冠军只差最后一步。阿根廷从不会满足于亚军。全国都期待你重新举起那座奖杯。',
    faExpectation: '★★★★★ 举国期待夺冠',
    worldCupTarget: '夺冠',
    group: 'J 组',
    groupOpponents: [
      { name: '阿尔及利亚', flag: '/assets/国旗/阿尔及利亚.png' },
      { name: '奥地利', flag: '/assets/国旗/奥地利.png' },
      { name: '约旦', flag: '/assets/国旗/约旦.png' },
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
    difficulty: 4,
    budget: 2130,
    skill: 'CR光环',
    flag: '/assets/国旗/葡萄牙.png',
    hero: '/assets/葡萄牙/边路游龙.png',
    logo: '/assets/队徽/葡萄牙.png',
    jerseyColor: '#b51d2a',
    description: '一个人撑起一支队伍的极限。',
    mission: '圆梦世界杯',
    faMessage: '欧洲冠军已经属于葡萄牙，而世界杯仍是所有人的梦想。请带领球队完成这一段未竟的传奇。',
    faExpectation: '★★★★☆ 创造新时代',
    worldCupTarget: '四强',
    group: 'K 组',
    groupOpponents: [
      { name: '民主刚果', flag: '/assets/国旗/刚果.png' },
      { name: '乌兹别克斯坦', flag: '/assets/国旗/乌兹别克斯坦.png' },
      { name: '哥伦比亚', flag: '/assets/国旗/哥伦比亚.png' },
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
    // 纸面实力强但战术安排糟糕：上限高、下限低，战术效率 0.85。
    // 玩家执教德国修战术可解锁上限（后续战术板玩法空间）。
    tacticalEfficiency: 0.85,
    budget: 2030,
    skill: '日耳曼机器',
    flag: '/assets/国旗/德国.png',
    hero: '/assets/德国/战车门卫.png',
    logo: '/assets/队徽/德国.png',
    jerseyColor: '#C8313D',
    description: '没有奇迹，只有纪律和执行。',
    mission: '日耳曼战车归来',
    faMessage: '我们经历过低谷，也承受过质疑。德国足球从不会停留在过去，请让世界重新敬畏这支战车。',
    faExpectation: '★★★★☆ 重返豪门行列',
    worldCupTarget: '四强',
    group: 'E 组',
    groupOpponents: [
      { name: '库拉索', flag: '/assets/国旗/库拉索.png' },
      { name: '科特迪瓦', flag: '/assets/国旗/科特迪瓦.png' },
      { name: '厄瓜多尔', flag: '/assets/国旗/厄瓜多尔.png' },
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
    flag: '/assets/国旗/日本.png',
    hero: '/assets/日本/蓝武锋魂.png',
    logo: '/assets/队徽/日本.png',
    jerseyColor: '#174fbc',
    description: '没人看好他们，直到他们赢了。',
    mission: '亚洲新高度',
    faMessage: '亚洲足球已经来到新的时代。请让世界看到，日本不仅能够创造惊喜，更能够创造历史。',
    faExpectation: '★★★☆☆ 冲击历史最佳战绩',
    worldCupTarget: '八强',
    group: 'F 组',
    groupOpponents: [
      { name: '荷兰', flag: '/assets/国旗/荷兰.png' },
      { name: '瑞典', flag: '/assets/国旗/瑞典.png' },
      { name: '突尼斯', flag: '/assets/国旗/突尼斯.png' },
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
    difficulty: 1,
    budget: 2200,
    skill: '北欧巨人',
    flag: '/assets/国旗/挪威.png',
    hero: '/assets/挪威/北欧魔人.png',
    logo: '/assets/队徽/挪威.png',
    jerseyColor: '#c8313d',
    description: '有世界最好的前锋，却从未踢进世界杯。',
    mission: '维京传奇',
    faMessage: '我们已经跨出了历史性的一步。现在，请带领挪威继续前进，让维京战歌响彻世界杯决赛。',
    faExpectation: '★★★☆☆ 更进一步',
    worldCupTarget: '16强',
    group: 'I 组',
    groupOpponents: [
      { name: '法国', flag: '/assets/国旗/法国.png' },
      { name: '塞内加尔', flag: '/assets/国旗/塞内加尔.png' },
      { name: '伊拉克', flag: '/assets/国旗/伊拉克.png' },
    ],
    skillEffect: '队内身体值最高球员每个关键节点+15%成功率',
    goldenStar: '北欧魔人',
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
    flag: '/assets/国旗/摩洛哥.png',
    hero: '/assets/摩洛哥/北非之狐.png',
    logo: '/assets/队徽/摩洛哥.png',
    jerseyColor: '#8b1d32',
    description: '上届最大黑马，逆袭是传统。',
    mission: '黑马不是奇迹',
    faMessage: '世界已经认识了摩洛哥，但真正的强者不会满足于一次黑马之旅。请证明，我们属于世界顶级舞台。',
    faExpectation: '★★★☆☆ 延续黑马传奇',
    worldCupTarget: '四强',
    group: 'C 组',
    groupOpponents: [
      { name: '巴西', flag: '/assets/国旗/巴西.png' },
      { name: '海地', flag: '/assets/国旗/海地.png' },
      { name: '苏格兰', flag: '/assets/国旗/苏格兰.png' },
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
    difficulty: 4,
    budget: 1460,
    skill: '海岛之心',
    flag: '/assets/国旗/库拉索.png',
    hero: '/assets/库拉索/蓝浪飞翼.png',
    logo: '/assets/队徽/库拉索.png',
    jerseyColor: '#1267b4',
    description: '参加世界杯本身就是奇迹。',
    mission: '加勒比风暴',
    faMessage: '我们没有豪华阵容，也没有辉煌历史。但只要终场哨声没有响起，就没有人能够定义我们的极限。',
    faExpectation: '★☆☆☆☆ 享受挑战，书写传奇',
    worldCupTarget: '争取首胜',
    group: 'E 组',
    groupOpponents: [
      { name: '德国', flag: '/assets/国旗/德国.png' },
      { name: '科特迪瓦', flag: '/assets/国旗/科特迪瓦.png' },
      { name: '厄瓜多尔', flag: '/assets/国旗/厄瓜多尔.png' },
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
    flag: '/assets/国旗/西班牙.png',
    logo: '/assets/队徽/西班牙.png',
    jerseyColor: '#c60b1e',
    description: '传控王朝，冠军之师。',
    mission: '捍卫冠军荣耀',
    faMessage: '世界冠军不是终点，而是新的起点。全世界都在研究我们的足球，也都想击败我们。请带领西班牙，再一次站上世界之巅。',
    faExpectation: '★★★★★ 冠军势在必得',
    worldCupTarget: '夺冠',
    group: 'H 组',
    groupOpponents: [
      { name: '佛得角', flag: '/assets/国旗/佛得角.png' },
      { name: '沙特', flag: '/assets/国旗/沙特.png' },
      { name: '乌拉圭', flag: '/assets/国旗/乌拉圭.png' },
    ],
    skillEffect: '进攻三区连续三脚以上传球时，下一脚关键传成功率+25%',
    players: prepareTeamPlayers(allPlayers.spain || [], 'spain', 2350)
  },
  {
    id: 'england',
    name: '英格兰',
    nameEn: 'England',
    difficulty: 5,
    budget: 2310,
    skill: '三狮之心',
    flag: '/assets/国旗/英格兰.png',
    logo: '/assets/队徽/英格兰.png',
    jerseyColor: '#263B78',
    description: '足球故乡，距离梦想总差一步。',
    mission: '让足球回家',
    faMessage: '我们一次又一次接近梦想，却始终与冠军擦肩而过。这一次，让整个英格兰相信——足球真的可以回家。',
    faExpectation: '★★★★☆ 至少闯入决赛',
    worldCupTarget: '夺冠',
    group: 'L 组',
    groupOpponents: [
      { name: '克罗地亚', flag: '/assets/国旗/克罗地亚.png' },
      { name: '巴拿马', flag: '/assets/国旗/巴拿马.png' },
      { name: '加纳', flag: '/assets/国旗/加纳.png' },
    ],
    skillEffect: '75分钟后全队士气不掉，落后时定位球成功率+20%',
    players: prepareTeamPlayers(allPlayers.england || [], 'england', 2200)
  },
  {
    id: 'colombia',
    name: '哥伦比亚',
    nameEn: 'Colombia',
    difficulty: 3,
    budget: 2030,
    skill: '咖啡魔法',
    flag: '/assets/国旗/哥伦比亚.png',
    logo: '/assets/队徽/哥伦比亚.png',
    jerseyColor: '#fcd116',
    lightColor: true,
    description: '激情与天赋并存，黄金一代正当时。',
    mission: '黄金一代绽放',
    faMessage: '我们拥有激情，也拥有天赋。现在，全世界都在期待哥伦比亚迎来属于自己的黄金时代。',
    faExpectation: '★★★☆☆ 黄金一代证明自己',
    worldCupTarget: '八强',
    group: 'K 组',
    groupOpponents: [
      { name: '葡萄牙', flag: '/assets/国旗/葡萄牙.png' },
      { name: '民主刚果', flag: '/assets/国旗/刚果.png' },
      { name: '乌兹别克斯坦', flag: '/assets/国旗/乌兹别克斯坦.png' },
    ],
    skillEffect: '1v1盘带节点成功率+18%，更容易制造犯规',
    players: prepareTeamPlayers(allPlayers.colombia || [], 'colombia', 1900)
  },
  {
    id: 'usa',
    name: '美国',
    nameEn: 'USA',
    difficulty: 2,
    budget: 2030,
    skill: '星条气势',
    flag: '/assets/国旗/美国.png',
    logo: '/assets/队徽/美国.png',
    jerseyColor: '#3c3b6e',
    description: '东道主之一，足球新大陆正在觉醒。',
    mission: '足球新时代',
    faMessage: '世界杯来到美国，这是一次属于我们的机会。请让足球真正走进每一个美国人的心中。',
    faExpectation: '★★★☆☆ 主场不留遗憾',
    worldCupTarget: '八强',
    group: 'D 组',
    groupOpponents: [
      { name: '巴拉圭', flag: '/assets/国旗/巴拉圭.png' },
      { name: '澳大利亚', flag: '/assets/国旗/澳大利亚.png' },
      { name: '土耳其', flag: '/assets/国旗/土耳其.png' },
    ],
    skillEffect: '主场比赛全队体能消耗降低30%',
    players: prepareTeamPlayers(allPlayers.usa || [], 'usa', 1800)
  },
  {
    id: 'mexico',
    name: '墨西哥',
    nameEn: 'Mexico',
    difficulty: 4,
    budget: 2030,
    skill: '阿兹特克之魂',
    flag: '/assets/国旗/墨西哥.png',
    logo: '/assets/队徽/墨西哥.png',
    jerseyColor: '#006847',
    description: '高原主场，第五度举办世界杯的国度。',
    mission: '捍卫主场荣耀',
    faMessage: '阿兹特克的呐喊不会停息。作为东道主，我们不仅要赢得比赛，更要赢得整个国家的骄傲。',
    faExpectation: '★★★★☆ 东道主必须有所作为',
    worldCupTarget: '八强',
    group: 'A 组',
    groupOpponents: [
      { name: '南非', flag: '/assets/国旗/南非.png' },
      { name: '韩国', flag: '/assets/国旗/韩国.png' },
      { name: '捷克', flag: '/assets/国旗/捷克.png' },
    ],
    skillEffect: '对手定位球成功率-15%，主场气势+10%',
    players: prepareTeamPlayers(allPlayers.mexico || [], 'mexico', 1750)
  },
  {
    id: 'canada',
    name: '加拿大',
    nameEn: 'Canada',
    difficulty: 2,
    budget: 2030,
    skill: '枫叶反击',
    flag: '/assets/国旗/加拿大.png',
    logo: '/assets/队徽/加拿大.png',
    jerseyColor: '#d52b1e',
    description: '北境新军，主场作战的东道主。',
    mission: '北境崛起',
    faMessage: '主场作战意味着压力，也意味着机会。请让加拿大足球，在世界舞台留下自己的名字。',
    faExpectation: '★★☆☆☆ 创造国家历史',
    worldCupTarget: '16强',
    group: 'B 组',
    groupOpponents: [
      { name: '波黑', flag: '/assets/国旗/波黑.png' },
      { name: '卡塔尔', flag: '/assets/国旗/卡塔尔.png' },
      { name: '瑞士', flag: '/assets/国旗/瑞士.png' },
    ],
    skillEffect: '抢断成功后10秒内反击速度+20%',
    players: prepareTeamPlayers(allPlayers.canada || [], 'canada', 1500)
  },
  {
    id: 'capeverde',
    name: '佛得角',
    nameEn: 'Cape Verde',
    difficulty: 3,
    budget: 1660,
    skill: '群岛韧性',
    flag: '/assets/国旗/佛得角.png',
    logo: '/assets/队徽/佛得角.png',
    jerseyColor: '#003893',
    description: '大西洋群岛来的世界杯新军。',
    mission: '群岛奇迹',
    faMessage: '没有人再敢轻视佛得角。请继续书写属于群岛的传奇，把我们的名字留在世界杯历史之中。',
    faExpectation: '★★☆☆☆ 再创奇迹',
    worldCupTarget: '小组出线',
    group: 'H 组',
    groupOpponents: [
      { name: '西班牙', flag: '/assets/国旗/西班牙.png' },
      { name: '沙特', flag: '/assets/国旗/沙特.png' },
      { name: '乌拉圭', flag: '/assets/国旗/乌拉圭.png' },
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
  '墨西哥': '/assets/国旗/墨西哥.png',
  '南非': '/assets/国旗/南非.png',
  '韩国': '/assets/国旗/韩国.png',
  '捷克': '/assets/国旗/捷克.png',
  // B组
  '加拿大': '/assets/国旗/加拿大.png',
  '波黑': '/assets/国旗/波黑.png',
  '卡塔尔': '/assets/国旗/卡塔尔.png',
  '瑞士': '/assets/国旗/瑞士.png',
  // C组
  '巴西': '/assets/国旗/巴西.png',
  '摩洛哥': '/assets/国旗/摩洛哥.png',
  '海地': '/assets/国旗/海地.png',
  '苏格兰': '/assets/国旗/苏格兰.png',
  // D组
  '美国': '/assets/国旗/美国.png',
  '巴拉圭': '/assets/国旗/巴拉圭.png',
  '澳大利亚': '/assets/国旗/澳大利亚.png',
  '土耳其': '/assets/国旗/土耳其.png',
  // E组
  '德国': '/assets/国旗/德国.png',
  '库拉索': '/assets/国旗/库拉索.png',
  '科特迪瓦': '/assets/国旗/科特迪瓦.png',
  '厄瓜多尔': '/assets/国旗/厄瓜多尔.png',
  // F组
  '荷兰': '/assets/国旗/荷兰.png',
  '日本': '/assets/国旗/日本.png',
  '瑞典': '/assets/国旗/瑞典.png',
  '突尼斯': '/assets/国旗/突尼斯.png',
  // G组
  '比利时': '/assets/国旗/比利时.png',
  '埃及': '/assets/国旗/埃及.png',
  '伊朗': '/assets/国旗/伊朗.png',
  '新西兰': '/assets/国旗/新西兰.png',
  // H组
  '西班牙': '/assets/国旗/西班牙.png',
  '佛得角': '/assets/国旗/佛得角.png',
  '沙特': '/assets/国旗/沙特.png',
  '乌拉圭': '/assets/国旗/乌拉圭.png',
  // I组
  '法国': '/assets/国旗/法国.png',
  '塞内加尔': '/assets/国旗/塞内加尔.png',
  '伊拉克': '/assets/国旗/伊拉克.png',
  '挪威': '/assets/国旗/挪威.png',
  // J组
  '阿根廷': '/assets/国旗/阿根廷.png',
  '阿尔及利亚': '/assets/国旗/阿尔及利亚.png',
  '奥地利': '/assets/国旗/奥地利.png',
  '约旦': '/assets/国旗/约旦.png',
  // K组
  '葡萄牙': '/assets/国旗/葡萄牙.png',
  '民主刚果': '/assets/国旗/刚果.png',
  '刚果民主共和国': '/assets/国旗/刚果.png',
  '乌兹别克': '/assets/国旗/乌兹别克斯坦.png',
  '乌兹别克斯坦': '/assets/国旗/乌兹别克斯坦.png',
  '哥伦比亚': '/assets/国旗/哥伦比亚.png',
  // L组
  '英格兰': '/assets/国旗/英格兰.png',
  '克罗地亚': '/assets/国旗/克罗地亚.png',
  '巴拿马': '/assets/国旗/巴拿马.png',
  '加纳': '/assets/国旗/加纳.png',
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
  return teams.find((t) => t.id === teamIdOrName || t.name === teamIdOrName)
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
