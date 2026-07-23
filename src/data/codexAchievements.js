/**
 * 图鉴成就定义
 * 每个成就包含 id, name, desc, icon, tiers(可选), check(saveData) 函数
 * check 返回当前进度数值（0 表示未解锁）
 */

const RESULT_RANK = {
  champion: 6,
  finalist: 5,
  semifinal: 4,
  quarterfinal: 3,
  round16: 2,
  group: 1,
}

export function resultRank(result) {
  return RESULT_RANK[result] || 0
}

export const CODEX_ACHIEVEMENTS = [
  {
    id: 'first_champion',
    name: '初登王座',
    desc: '带领国家队获得世界杯冠军',
    icon: '★',
    tiers: [1, 3, 5],
    tierLabels: ['I 初登王座', 'II 三冠教头', 'III 五冠传奇'],
    check(saveData) {
      const history = saveData.championshipHistory || []
      const unique = new Set(history)
      return unique.size
    },
  },
  {
    id: 'hat_trick',
    name: '帽子戏法',
    desc: '单场比赛打入3球',
    icon: '◆',
    tiers: [1, 3, 10],
    tierLabels: ['I 帽子戏法', 'II 三度戴帽', 'III 十全十美'],
    check(saveData) {
      return saveData.codex?.records?.hatTricks || 0
    },
  },
  {
    id: 'penalty_master',
    name: '点球大师',
    desc: '点球大战5罚全中',
    icon: '◎',
    check(saveData) {
      return saveData.codex?.unlockedAchievements?.includes('penalty_master') ? 1 : 0
    },
  },
  {
    id: 'iron_wall',
    name: '铜墙铁壁',
    desc: '连续5场零封对手',
    icon: '■',
    check(saveData) {
      const best = saveData.codex?.records?.bestCleanSheetStreak || 0
      return best >= 5 ? 1 : 0
    },
  },
  {
    id: 'wall_of_sighs',
    name: '叹息之墙',
    desc: '单场扑出3粒点球',
    icon: '▲',
    check(saveData) {
      return saveData.codex?.unlockedAchievements?.includes('wall_of_sighs') ? 1 : 0
    },
  },
  {
    id: 'full_firepower',
    name: '火力全开',
    desc: '单场轰入5球以上',
    icon: '※',
    check(saveData) {
      const most = saveData.codex?.records?.mostGoalsInMatch || 0
      return most >= 5 ? 1 : 0
    },
  },
  {
    id: 'miracle_comeback',
    name: '奇迹逆转',
    desc: '落后3球最终取胜',
    icon: '↺',
    check(saveData) {
      return saveData.codex?.records?.comebacksFrom3 || 0
    },
  },
  {
    id: 'lightning_strike',
    name: '闪电战',
    desc: '开场1分钟内进球',
    icon: '⚡',
    check(saveData) {
      return saveData.codex?.unlockedAchievements?.includes('lightning_strike') ? 1 : 0
    },
  },
  {
    id: 'last_gas',
    name: '补时绝杀',
    desc: '90分钟后完成绝杀进球',
    icon: '',
    check(saveData) {
      return saveData.codex?.unlockedAchievements?.includes('last_gas') ? 1 : 0
    },
  },
  {
    id: 'home_glory',
    name: '主场荣耀',
    desc: '带领美国、加拿大或墨西哥夺冠',
    icon: '⌂',
    check(saveData) {
      const history = saveData.championshipHistory || []
      const homeTeams = ['usa', 'canada', 'mexico']
      return homeTeams.some((id) => history.includes(id)) ? 1 : 0
    },
  },
  {
    id: 'upset_miracle',
    name: '爆冷奇迹',
    desc: '带领佛得角或库拉索夺冠',
    icon: '≈',
    check(saveData) {
      const history = saveData.championshipHistory || []
      const underdogs = ['capeverde', 'curacao']
      return underdogs.some((id) => history.includes(id)) ? 1 : 0
    },
  },
  {
    id: 'tactician',
    name: '战术大师',
    desc: '使用3种不同阵型夺冠',
    icon: '⊞',
    check(saveData) {
      return saveData.codex?.unlockedAchievements?.includes('tactician') ? 1 : 0
    },
  },
  {
    id: 'super_sub',
    name: '关键先生',
    desc: '替补球员累计打入10球',
    icon: '⇄',
    check(saveData) {
      return saveData.codex?.unlockedAchievements?.includes('super_sub') ? 1 : 0
    },
  },
  {
    id: 'medical_miracle',
    name: '医学奇迹',
    desc: '全队零伤病夺冠',
    icon: '✚',
    check(saveData) {
      return saveData.codex?.unlockedAchievements?.includes('medical_miracle') ? 1 : 0
    },
  },
  {
    id: 'clean_sweep',
    name: '横扫千军',
    desc: '小组赛三战全胜出线',
    icon: '▶',
    check(saveData) {
      return saveData.codex?.unlockedAchievements?.includes('clean_sweep') ? 1 : 0
    },
  },
  {
    id: 'unstoppable',
    name: '势不可挡',
    desc: '连续10场不败',
    icon: '∞',
    tiers: [1, 2],
    tierLabels: ['I 十场不败', 'II 二十场不败'],
    check(saveData) {
      const streak = saveData.codex?.records?.bestWinStreak || 0
      if (streak >= 20) return 2
      if (streak >= 10) return 1
      return 0
    },
  },
  {
    id: 'goal_machine',
    name: '进球机器',
    desc: '累计打入50球',
    icon: '●',
    tiers: [1, 2, 3],
    tierLabels: ['I 50球', 'II 100球', 'III 200球'],
    check(saveData) {
      const goals = saveData.codex?.records?.totalGoals || 0
      if (goals >= 200) return 3
      if (goals >= 100) return 2
      if (goals >= 50) return 1
      return 0
    },
  },
  {
    id: 'veteran',
    name: '身经百战',
    desc: '累计完成30场比赛',
    icon: '▪',
    tiers: [1, 2],
    tierLabels: ['I 30场', 'II 100场'],
    check(saveData) {
      const matches = saveData.codex?.records?.totalMatches || 0
      if (matches >= 100) return 2
      if (matches >= 30) return 1
      return 0
    },
  },
  {
    id: 'world_traveler',
    name: '环游世界',
    desc: '带领8支不同国家队参赛',
    icon: '◈',
    check(saveData) {
      const teams = Object.keys(saveData.codex?.teamResults || {})
      return teams.length >= 8 ? 1 : 0
    },
  },
  {
    id: 'perfectionist',
    name: '完美主义',
    desc: '以全胜战绩夺冠（7战7胜）',
    icon: '◇',
    check(saveData) {
      return saveData.codex?.unlockedAchievements?.includes('perfectionist') ? 1 : 0
    },
  },
  {
    id: 'underdog_story',
    name: '屌丝逆袭',
    desc: '带领难度4星以上球队夺冠',
    icon: '↑',
    check(saveData) {
      return saveData.codex?.unlockedAchievements?.includes('underdog_story') ? 1 : 0
    },
  },
  {
    id: 'collector',
    name: '收藏家',
    desc: '解锁10项成就',
    icon: '⊕',
    tiers: [1, 2],
    tierLabels: ['I 10项成就', 'II 全部成就'],
    check(saveData) {
      const count = (saveData.codex?.unlockedAchievements || []).length
      if (count >= CODEX_ACHIEVEMENTS.length - 1) return 2 // exclude self
      if (count >= 10) return 1
      return 0
    },
  },
]

/**
 * 获取成就总数
 */
export function getTotalAchievements() {
  return CODEX_ACHIEVEMENTS.length
}

/**
 * 检查并更新成就解锁状态
 * 返回新解锁的成就 ID 列表
 */
export function checkAchievements(saveData) {
  const codex = saveData.codex || {}
  const unlocked = new Set(codex.unlockedAchievements || [])
  const newlyUnlocked = []

  for (const achievement of CODEX_ACHIEVEMENTS) {
    const progress = achievement.check(saveData)
    const maxTier = achievement.tiers ? achievement.tiers[achievement.tiers.length - 1] : 1
    if (progress >= maxTier && !unlocked.has(achievement.id)) {
      newlyUnlocked.push(achievement.id)
      unlocked.add(achievement.id)
    }
  }

  return newlyUnlocked
}

/**
 * 获取成就当前进度（用于显示阶段）
 */
export function getAchievementProgress(achievement, saveData) {
  const progress = achievement.check(saveData)
  if (!achievement.tiers) return progress >= 1 ? 1 : 0
  let currentTier = 0
  for (let i = 0; i < achievement.tiers.length; i++) {
    if (progress >= achievement.tiers[i]) currentTier = i + 1
  }
  return currentTier
}
