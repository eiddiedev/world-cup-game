import { allPlayers } from './players/index.js'
import { prepareTeamPlayers } from './playerBalance.js'

/**
 * 球队配置数据
 * 10支国家队，各有不同的难度、预算、特色技能
 */
export const teams = [
  {
    id: 'france',
    name: '法国',
    nameEn: 'France',
    difficulty: 1,
    budget: 2300,
    skill: '巴黎之魂',
    flag: '/assets/国旗/法国.png',
    hero: '/assets/法国/法国超跑.png',
    logo: '/assets/队徽/法国.png',
    jerseyColor: '#1f4aa8',
    description: '天才扎堆，但更衣室是个谜。',
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
    difficulty: 1,
    budget: 2250,
    skill: '桑巴节奏',
    flag: '/assets/国旗/巴西.png',
    hero: '/assets/巴西/桑巴舞者.png',
    logo: '/assets/队徽/巴西.png',
    jerseyColor: '#f5d742',
    lightColor: true,
    description: '足球就是艺术，赢球也要好看。',
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
    budget: 2100,
    skill: '绝境反击',
    flag: '/assets/国旗/阿根廷.png',
    hero: '/assets/阿根廷/当世球王.png',
    logo: '/assets/队徽/阿根廷.png',
    jerseyColor: '#72c8f0',
    lightColor: true,
    description: '卫冕冠军，绝境中最危险。',
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
    difficulty: 2,
    budget: 2050,
    skill: 'CR光环',
    flag: '/assets/国旗/葡萄牙.png',
    hero: '/assets/葡萄牙/边路游龙.png',
    logo: '/assets/队徽/葡萄牙.png',
    jerseyColor: '#b51d2a',
    description: '一个人撑起一支队伍的极限。',
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
    difficulty: 3,
    budget: 1950,
    skill: '日耳曼机器',
    flag: '/assets/国旗/德国.png',
    hero: '/assets/德国/战车门卫.png',
    logo: '/assets/队徽/德国.png',
    jerseyColor: '#f4f0e8',
    lightColor: true,
    description: '没有奇迹，只有纪律和执行。',
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
    budget: 1850,
    skill: '高压逼抢',
    flag: '/assets/国旗/日本.png',
    hero: '/assets/日本/蓝武锋魂.png',
    logo: '/assets/队徽/日本.png',
    jerseyColor: '#174fbc',
    description: '没人看好他们，直到他们赢了。',
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
    difficulty: 4,
    budget: 1700,
    skill: '北欧巨人',
    flag: '/assets/国旗/挪威.png',
    hero: '/assets/挪威/北欧魔人.png',
    logo: '/assets/队徽/挪威.png',
    jerseyColor: '#c8313d',
    description: '有世界最好的前锋，却从未踢进世界杯。',
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
    budget: 1800,
    skill: '沙漠之狐',
    flag: '/assets/国旗/摩洛哥.png',
    hero: '/assets/摩洛哥/北非之狐.png',
    logo: '/assets/队徽/摩洛哥.png',
    jerseyColor: '#8b1d32',
    description: '上届最大黑马，逆袭是传统。',
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
    id: 'newzealand',
    name: '新西兰',
    nameEn: 'New Zealand',
    difficulty: 5,
    budget: 1280,
    skill: '全黑魂',
    flag: '/assets/国旗/新西兰.png',
    hero: '/assets/新西兰/全白重炮.png',
    logo: '/assets/队徽/新西兰.png',
    jerseyColor: '#111111',
    description: '大洋洲的孤勇者，赢一场就是奇迹。',
    group: 'G 组',
    groupOpponents: [
      { name: '比利时', flag: '/assets/国旗/比利时.png' },
      { name: '埃及', flag: '/assets/国旗/埃及.png' },
      { name: '伊朗', flag: '/assets/国旗/伊朗.png' },
    ],
    skillEffect: '点球大战全队关键时刻+2星',
    goldenStar: '全白重炮',
    goldenStarPosition: 'FW',
    players: prepareTeamPlayers(allPlayers.newzealand || [], 'newzealand', 1280)
  },
  {
    id: 'curacao',
    name: '库拉索',
    nameEn: 'Curaçao',
    difficulty: 5,
    budget: 1170,
    skill: '海岛之心',
    flag: '/assets/国旗/库拉索.png',
    hero: '/assets/库拉索/蓝浪飞翼.png',
    logo: '/assets/队徽/库拉索.png',
    jerseyColor: '#1267b4',
    description: '参加世界杯本身就是奇迹。',
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
]

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
}

/**
 * 获取球队国旗（图片路径，找不到返回null）
 */
export function getTeamFlag(teamName) {
  return FLAG_MAP[teamName] || null
}

/**
 * 根据ID获取球队
 */
export function getTeamById(teamId) {
  return teams.find((t) => t.id === teamId) || null
}

/**
 * 获取难度星级显示
 */
export function getDifficultyStars(difficulty) {
  return '★'.repeat(difficulty) + '☆'.repeat(5 - difficulty)
}
