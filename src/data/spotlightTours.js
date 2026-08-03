import { COMPETITION_BRAND } from '@competition-brand'

const tour = (id, title, steps) => ({ id, title, steps })

export const SPOTLIGHT_TOURS = Object.freeze({
  'team-select-coach': tour('team-select-coach-highlight', '国家队选择指引', [
    {
      target: '[data-guide="team-list"]',
      title: '点击一支国家队',
      body: '难度越高，对手越强。征召点用于组建阵容，后勤预算用于提升球队保障。',
      placement: 'top',
      advanceOnTarget: true,
    },
  ]),
  'team-select-player': tour('team-select-player-highlight', '国家队选择指引', [
    {
      target: '[data-guide="team-list"]',
      title: '选择你要加入的球队',
      body: '难度越高，晋级挑战越大。不知道怎么选时，优先选择低难度球队熟悉操作。',
      placement: 'top',
      advanceOnTarget: true,
    },
  ]),
  recruitment: tour('recruitment-highlight', '征召操作指引', [
    {
      target: '[data-guide="recruitment-budget"]',
      title: '先看征召点',
      body: '这是你的组队预算。征召球员会消耗征召点，数值归零前都可以继续挑选。',
      placement: 'bottom',
    },
    {
      target: '[data-guide="recruitment-positions"]',
      title: '按位置寻找球员',
      body: '门将、后卫、中场和前锋要达到最低人数。点击任意位置标签查看候选人。',
      placement: 'bottom',
      advanceOnTarget: true,
    },
    {
      target: '[data-guide="recruitment-player-card"]',
      title: '比较球员再征召',
      body: '评分越高通常越强，价格也可能更高。点击卡片可看详情，点击“征召”加入球队。',
      placement: 'right',
    },
    {
      target: '[data-guide="recruitment-auto"]',
      title: '不会搭配就一键推荐',
      body: '教练组会按照预算和位置要求，自动组成一套完整阵容。',
      placement: 'top',
      advanceOnTarget: true,
    },
    {
      target: '[data-guide="recruitment-confirm"]',
      title: '确认你的国家队',
      body: '人数和位置都满足要求后，点击这里锁定阵容并进入后勤配置。',
      placement: 'top',
    },
  ]),
  logistics: tour('logistics-highlight', '后勤配置指引', [
    {
      target: '[data-guide="logistics-budget"]',
      title: '这是后勤预算',
      body: '升级部门会消耗预算；没有花完的部分会保留，不必一次全部用完。',
      placement: 'bottom',
    },
    {
      target: '[data-guide="logistics-card"]',
      title: '选择一项球队保障',
      body: '不同部门会改善体能、伤病、情报或临场表现。卡片会显示当前效果和下一级收益。',
      placement: 'right',
    },
    {
      target: '[data-guide="logistics-auto"]',
      title: '也可以一键升级',
      body: '不知道如何分配时，系统会替你完成一套均衡配置。',
      placement: 'top',
      advanceOnTarget: true,
    },
    {
      target: '[data-guide="logistics-confirm"]',
      title: '确认后进入赛程',
      body: COMPETITION_BRAND.setupJourney,
      placement: 'top',
    },
  ]),
  tournament: tour('tournament-highlight', COMPETITION_BRAND.scheduleGuideTitle, [
    {
      target: '[data-guide="tournament-progress"]',
      title: '先踢三场小组赛',
      body: '胜一场得 3 分，平一场得 1 分；排名靠前才能进入淘汰赛。',
      placement: 'bottom',
    },
    {
      target: '[data-guide="tournament-current-match"]',
      title: '从当前场次继续',
      body: '教练模式点击“排兵布阵”，球员模式点击“开始比赛”。淘汰赛输掉一场就会结束征程。',
      placement: 'left',
      advanceOnTarget: true,
    },
  ]),
  lineup: tour('lineup-highlight', '布阵操作指引', [
    {
      target: '[data-guide="lineup-formation"]',
      title: '先选择阵型',
      body: '阵型决定各位置需要几名球员。第一次游玩可以保留球队的默认阵型。',
      placement: 'left',
    },
    {
      target: '[data-guide="lineup-bench"]',
      title: '从替补席选择球员',
      body: '优先选择评分高、状态好，而且位置与球场空位匹配的球员。',
      placement: 'left',
    },
    {
      target: '[data-guide="lineup-pitch"]',
      title: '把球员放上球场',
      body: '将球员拖到对应位置，也可以依次点击球员和球场空位。选满 11 人即可开赛。',
      placement: 'right',
    },
    {
      target: '[data-guide="lineup-intel"]',
      title: '查看赛前情报',
      body: '展开后可以了解对手风格与弱点；后勤部门等级越高，情报越详细。',
      placement: 'left',
      advanceOnTarget: true,
    },
    {
      target: '[data-guide="lineup-confirm"]',
      title: '确认首发并开赛',
      body: '按钮显示“确认阵容”时，说明 11 名首发已经准备完毕。',
      placement: 'top',
    },
  ]),
  'match-coach': tour('match-coach-highlight', '场边指挥指引', [
    {
      target: '[data-guide="match-scoreboard"]',
      title: '关注比分和时间',
      body: '比赛会自动进行。点击记分牌下方的“查看详情”，可以展开射门、控球率等数据。',
      placement: 'bottom',
    },
    {
      target: '[data-guide="match-controls"]',
      title: '控制比赛节奏',
      body: '可以暂停或加速比赛；退出比赛会被判 0:3 负。',
      placement: 'right',
    },
    {
      target: '[data-guide="match-tactics-trigger"]',
      title: '根据比分调整战术',
      body: '落后时加强进攻，领先时加强防守。越激进，反击风险也越大。',
      placement: 'right',
    },
    {
      target: '[data-guide="match-substitutions-trigger"]',
      title: '体力下降时换人',
      body: '换人窗口和名额有限，优先替换体力较低、受伤或表现不佳的球员。',
      placement: 'right',
    },
  ]),
  'match-player': tour('match-player-highlight', '球员比赛指引', [
    {
      target: '[data-guide="match-scoreboard"]',
      title: '先看比分和时间',
      body: '你不需要控制所有球员，只需把握属于自己的关键时刻。',
      placement: 'bottom',
    },
    {
      target: '[data-guide="match-player-controls"]',
      title: '跟随场上操作提示',
      body: '进攻时寻找空当并尝试射门；防守时注意对手和足球的位置，及时回追。',
      placement: 'top',
    },
  ]),
  tactics: tour('tactics-highlight', '战术调整指引', [
    {
      target: '[data-guide="tactics-options"]',
      title: '选择全队攻守倾向',
      body: '落后时选择进攻，领先时选择防守；比分接近时保持均衡最稳妥。选择后立即生效。',
      placement: 'left',
      advanceOnTarget: true,
    },
  ]),
  substitutions: tour('substitutions-highlight', '换人操作指引', [
    {
      target: '[data-guide="substitution-bench"]',
      title: '先选一名替补',
      body: '优先选择体力充足、位置合适的球员。可以拖动，也可以直接点击。',
      placement: 'left',
    },
    {
      target: '[data-guide="substitution-pitch"]',
      title: '再选择要换下的球员',
      body: '门将只能与门将互换；一次窗口可以安排多人，最后统一确认。',
      placement: 'left',
    },
  ]),
  penalty: tour('penalty-highlight', '点球大战指引', [
    {
      target: '[data-guide="penalty-scoreboard"]',
      title: '双方轮流罚点球',
      body: '通常各罚 5 次；仍然打平就继续，直到分出胜负。圆点会记录每次结果。',
      placement: 'bottom',
    },
    {
      target: '[data-guide="penalty-prompt"]',
      title: '先确认轮到谁',
      body: '我方主罚时选择射门方向，对方主罚时判断方向并指挥门将扑救。',
      placement: 'bottom',
    },
    {
      target: '[data-guide="penalty-actions"]',
      title: '选择左、中或右',
      body: '教练模式点击方向，球员模式向对应方向滑动。方向和球员能力都会影响结果。',
      placement: 'top',
      advanceOnTarget: true,
    },
  ]),
  'post-match': tour('post-match-highlight', '赛后总结指引', [
    {
      target: '[data-guide="post-result"]',
      title: '先确认本场结果',
      body: '比分决定胜负；淘汰赛失利会直接结束本届征程。',
      placement: 'bottom',
    },
    {
      target: '[data-guide="post-analysis"]',
      title: '用数据判断表现',
      body: '射正表示真正威胁球门的射门，控球率表示控制足球的时间比例，预期进球衡量机会质量。',
      placement: 'top',
    },
    {
      target: '[data-guide="post-next"]',
      title: '留意伤停后继续',
      body: '受伤、红牌和状态变化会影响下一场阵容。确认后进入下一场比赛或最终结局。',
      placement: 'top',
    },
  ]),
  ending: tour('ending-highlight', '征程结局指引', [
    {
      target: '[data-guide="ending-result"]',
      title: COMPETITION_BRAND.endingGuideTitle,
      body: '这里记录最终成绩、球队目标和本届赛事的故事。',
      placement: 'bottom',
    },
    {
      target: '[data-guide="ending-review"]',
      title: '回顾表现与奖金',
      body: '奖金和剩余后勤预算会影响下一届征程。更换球队、阵型和决策可以走向不同结局。',
      placement: 'top',
    },
    {
      target: '[data-guide="ending-actions"]',
      title: '重新挑战或返回首页',
      body: COMPETITION_BRAND.retryJourney,
      placement: 'top',
    },
  ]),
})

export function getScreenSpotlightTour(screen, gameMode = 'coach') {
  if (screen === 'team-select') return SPOTLIGHT_TOURS[`team-select-${gameMode}`]
  if (screen === 'match' || screen === 'penalty-mode') return null
  if (screen === 'mini-cup-prep') return SPOTLIGHT_TOURS.tournament
  return SPOTLIGHT_TOURS[screen] || null
}
