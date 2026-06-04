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
    difficulty: 1,
    budget: 2300,
    skill: '巴黎之魂',
    flag: '/assets/国旗/法国.png',
    hero: '/assets/法国/法国超跑.png',
    jerseyColor: '#1f4aa8',
    description: '天才扎堆，但更衣室是个谜。',
    players: prepareTeamPlayers(allPlayers.france || [], 'france', 2300)
  },
  {
    id: 'brazil',
    name: '巴西',
    difficulty: 1,
    budget: 2250,
    skill: '桑巴节奏',
    flag: '/assets/国旗/巴西.png',
    hero: '/assets/巴西/桑巴舞者.png',
    jerseyColor: '#f5d742',
    description: '足球就是艺术，赢球也要好看。',
    players: prepareTeamPlayers(allPlayers.brazil || [], 'brazil', 2250)
  },
  {
    id: 'argentina',
    name: '阿根廷',
    difficulty: 2,
    budget: 2100,
    skill: '绝境反击',
    flag: '/assets/国旗/阿根廷.png',
    hero: '/assets/阿根廷/当世球王.png',
    jerseyColor: '#72c8f0',
    description: '卫冕冠军，绝境中最危险。',
    players: prepareTeamPlayers(allPlayers.argentina || [], 'argentina', 2100)
  },
  {
    id: 'portugal',
    name: '葡萄牙',
    difficulty: 2,
    budget: 2050,
    skill: 'CR光环',
    flag: '/assets/国旗/葡萄牙.png',
    hero: '/assets/葡萄牙/边路游龙.png',
    jerseyColor: '#b51d2a',
    description: '一个人撑起一支队伍的极限。',
    players: prepareTeamPlayers(allPlayers.portugal || [], 'portugal', 2050)
  },
  {
    id: 'germany',
    name: '德国',
    difficulty: 3,
    budget: 1950,
    skill: '日耳曼机器',
    flag: '/assets/国旗/德国.png',
    hero: '/assets/德国/战车门卫.png',
    jerseyColor: '#f4f0e8',
    description: '没有奇迹，只有纪律和执行。',
    players: prepareTeamPlayers(allPlayers.germany || [], 'germany', 1950)
  },
  {
    id: 'japan',
    name: '日本',
    difficulty: 3,
    budget: 1850,
    skill: '高压逼抢',
    flag: '/assets/国旗/日本.png',
    hero: '/assets/日本/蓝武锋魂.png',
    jerseyColor: '#174fbc',
    description: '没人看好他们，直到他们赢了。',
    players: prepareTeamPlayers(allPlayers.japan || [], 'japan', 1850)
  },
  {
    id: 'norway',
    name: '挪威',
    difficulty: 4,
    budget: 1700,
    skill: '北欧巨人',
    flag: '/assets/国旗/挪威.png',
    hero: '/assets/挪威/北欧魔人.png',
    jerseyColor: '#c8313d',
    description: '有世界最好的前锋，却从未踢进世界杯。',
    players: prepareTeamPlayers(allPlayers.norway || [], 'norway', 1700)
  },
  {
    id: 'morocco',
    name: '摩洛哥',
    difficulty: 4,
    budget: 1800,
    skill: '沙漠之狐',
    flag: '/assets/国旗/摩洛哥.png',
    hero: '/assets/摩洛哥/北非之狐.png',
    jerseyColor: '#8b1d32',
    description: '上届最大黑马，逆袭是传统。',
    players: prepareTeamPlayers(allPlayers.morocco || [], 'morocco', 1800)
  },
  {
    id: 'newzealand',
    name: '新西兰',
    difficulty: 5,
    budget: 1280,
    skill: '全黑魂',
    flag: '/assets/国旗/新西兰.png',
    hero: '/assets/新西兰/全白重炮.png',
    jerseyColor: '#111111',
    description: '大洋洲的孤勇者，赢一场就是奇迹。',
    players: prepareTeamPlayers(allPlayers.newzealand || [], 'newzealand', 1280)
  },
  {
    id: 'curacao',
    name: '库拉索',
    difficulty: 5,
    budget: 1170,
    skill: '海岛之心',
    flag: '/assets/国旗/库拉索.png',
    hero: '/assets/库拉索/蓝浪飞翼.png',
    jerseyColor: '#1267b4',
    description: '参加世界杯本身就是奇迹。',
    players: prepareTeamPlayers(allPlayers.curacao || [], 'curacao', 1170)
  },
]

/**
 * 48支世界杯球队国旗映射（中文名 → 图片路径）
 */
export const FLAG_MAP = {
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
  '加纳': '/assets/国旗/加纳.png',
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
