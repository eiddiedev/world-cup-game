/**
 * 决策库 — 28个预设决策场景
 * 所有决策数据本地化，不依赖AI
 */

export const DECISION_LIBRARY = [

  // ════════════════════════════════════════════
  // 进攻类（12个）
  // ════════════════════════════════════════════

  {
    id: 'solo_run_penalty',
    trigger: '前锋在禁区边缘1v1门将',
    minute_range: [1, 90],
    animation_type: 'attack_solo',
    situation_variants: [
      '{player}拿球突破到禁区边缘，只剩门将一人——千载难逢的好机会！',
      '{player}甩开最后一名后卫，单刀直入，门将出击还是守门线？',
      '反击！{player}接到直塞球，身后空无一人，独自面对门将！',
    ],
    choices: [
      {
        id: 'shoot_near_post',
        label: '打近角',
        desc: '利用速度和角度打门将近角，果断射门，不给门将反应时间。',
        risk: '角度刁钻但力量要求高，球可能偏出',
        reward: '门将来不及反应，进球率极高',
        weight_formula: [
          { attr: 'tec', weight: 0.55 },
          { attr: 'spd', weight: 0.30 },
          { attr: 'sta', weight: 0.15 },
        ],
        outcome_deltas: { goal: 0.28, goal_against: 0.0, win_delta: 0.12 },
        possible_outcomes: ['goal', 'goal', 'goal', 'saved_near', 'miss_near'],
      },
      {
        id: 'chip_shot',
        label: '挑射门将',
        desc: '门将出击时轻挑，球从头顶飞过——需要绝对的冷静和技术。',
        risk: '门将若未出击，球会飞出横梁',
        reward: '成功则是教科书级别的进球',
        weight_formula: [
          { attr: 'tec', weight: 0.70 },
          { attr: 'sta', weight: 0.30 },
        ],
        outcome_deltas: { goal: 0.22, goal_against: 0.0, win_delta: 0.10 },
        possible_outcomes: ['goal_chip', 'goal_chip', 'miss_over', 'saved_chip'],
      },
      {
        id: 'pass_to_teammate',
        label: '横传队友',
        desc: '不贪功，横传给插上的队友，空门机会更大——但传球线路有被截断风险。',
        risk: '传球被截，对方可能直接反击',
        reward: '队友面对空门，进球率更稳',
        weight_formula: [
          { attr: 'tec', weight: 0.50 },
          { attr: 'spd', weight: 0.20 },
          { attr: 'sta', weight: 0.30 },
        ],
        outcome_deltas: { goal: 0.20, goal_against: 0.04, win_delta: 0.09 },
        possible_outcomes: ['goal_assist', 'goal_assist', 'pass_intercepted', 'miss_teammate'],
      },
    ],
  },

  {
    id: 'penalty_area_cross',
    trigger: '边路传中，禁区内有球员争顶',
    minute_range: [1, 90],
    animation_type: 'attack_cross',
    situation_variants: [
      '{player}在左路拿到球，禁区内{player2}插上争顶，传中！',
      '边路突破！{player}来到底线，禁区内人头攒动，传中质量至关重要。',
      '{player}获得绝佳传中位置，禁区内有两名队友等待——怎么传？',
    ],
    choices: [
      {
        id: 'low_cross',
        label: '低平球传中',
        desc: '贴地传入禁区，前锋不需要争顶，直接推射或捅射。',
        risk: '后卫可能直接解围',
        reward: '减少空中争顶，适合灵活前锋',
        weight_formula: [
          { attr: 'tec', weight: 0.60 },
          { attr: 'spd', weight: 0.40 },
        ],
        outcome_deltas: { goal: 0.18, goal_against: 0.02, win_delta: 0.08 },
        possible_outcomes: ['goal_tap_in', 'saved_low', 'cleared_low'],
      },
      {
        id: 'high_cross',
        label: '高空传中',
        desc: '高球传入，让身高占优的前锋发挥头球优势。',
        risk: '对方高中卫可能头球解围',
        reward: '身高优势球员头球成功率极高',
        weight_formula: [
          { attr: 'phy', weight: 0.55 },
          { attr: 'tec', weight: 0.25 },
          { attr: 'height', weight: 0.20 },
        ],
        outcome_deltas: { goal: 0.20, goal_against: 0.02, win_delta: 0.09 },
        possible_outcomes: ['goal_header', 'saved_header', 'header_over', 'cleared_header'],
      },
      {
        id: 'cutback',
        label: '回传弧顶',
        desc: '不传中，回拉给禁区弧顶的中场，创造远射机会。',
        risk: '对手迅速收缩，空间关闭',
        reward: '中场射门角度更佳，门将来不及调整',
        weight_formula: [
          { attr: 'tec', weight: 0.65 },
          { attr: 'sta', weight: 0.35 },
        ],
        outcome_deltas: { goal: 0.15, goal_against: 0.01, win_delta: 0.07 },
        possible_outcomes: ['goal_volley', 'shot_blocked', 'shot_wide'],
      },
    ],
  },

  {
    id: 'counter_attack_3v2',
    trigger: '反击中3打2局面',
    minute_range: [1, 90],
    animation_type: 'attack_counter',
    situation_variants: [
      '快速反击！{player}持球推进，左右各有一名队友，对手只有两名后卫！',
      '对手进攻被断，{player}启动反击，3打2——如何把握？',
      '闪电反击！{player}领衔，利用人数优势！',
    ],
    choices: [
      {
        id: 'sprint_shoot',
        label: '持球直冲',
        desc: '不传球，{player}靠速度直接冲击后卫，进入禁区后自己打门。',
        risk: '后卫可能追上并铲断',
        reward: '一气呵成，不给对手组织防守时间',
        weight_formula: [
          { attr: 'spd', weight: 0.55 },
          { attr: 'tec', weight: 0.30 },
          { attr: 'phy', weight: 0.15 },
        ],
        outcome_deltas: { goal: 0.22, goal_against: 0.03, win_delta: 0.10 },
        possible_outcomes: ['goal', 'goal', 'tackled', 'saved_rush'],
      },
      {
        id: 'one_two_pass',
        label: '撞墙配合',
        desc: '传给侧面队友后立即跑动要球，一脚出球撕裂防线。',
        risk: '配合失误可能直接被断球反击',
        reward: '撕裂防线后进球，赏心悦目',
        weight_formula: [
          { attr: 'tec', weight: 0.60 },
          { attr: 'spd', weight: 0.25 },
          { attr: 'sta', weight: 0.15 },
        ],
        outcome_deltas: { goal: 0.25, goal_against: 0.05, win_delta: 0.11 },
        possible_outcomes: ['goal_combo', 'goal_combo', 'pass_wrong', 'offside'],
      },
      {
        id: 'wide_spread',
        label: '拉边传中',
        desc: '分到边路拉开防线再传中，稳扎稳打但速度慢下来。',
        risk: '给了对手回防时间，人数优势消失',
        reward: '传中机会更好，成功率相对稳定',
        weight_formula: [
          { attr: 'tec', weight: 0.55 },
          { attr: 'spd', weight: 0.35 },
          { attr: 'sta', weight: 0.10 },
        ],
        outcome_deltas: { goal: 0.12, goal_against: 0.01, win_delta: 0.05 },
        possible_outcomes: ['goal_cross', 'goal_cross', 'cleared', 'corner'],
      },
    ],
  },

  {
    id: 'freekick_dangerous',
    trigger: '获得禁区外危险位置任意球',
    minute_range: [1, 90],
    animation_type: 'attack_freekick',
    situation_variants: [
      '绝佳位置任意球！距球门约22米，{player}站在球旁——直接攻门还是传中？',
      '犯规！任意球，{player}走向球，不到25米，大好机会！',
    ],
    choices: [
      {
        id: 'direct_freekick',
        label: '直接射门',
        desc: '{player}直接弯射，利用旋转绕过人墙——需要极高技术。',
        risk: '人墙可能挡住，或球飞出横梁',
        reward: '进球直接，无需依赖禁区内配合',
        weight_formula: [
          { attr: 'tec', weight: 0.70 },
          { attr: 'sta', weight: 0.30 },
        ],
        outcome_deltas: { goal: 0.20, goal_against: 0.0, win_delta: 0.09 },
        possible_outcomes: ['goal_freekick', 'saved_freekick', 'hit_wall', 'miss_over'],
      },
      {
        id: 'freekick_cross',
        label: '传中争顶',
        desc: '球传入禁区，让身体素质好的球员争顶。',
        risk: '对手可能头球解围直接反击',
        reward: '禁区内争顶依赖前锋身高体重优势',
        weight_formula: [
          { attr: 'phy', weight: 0.50 },
          { attr: 'tec', weight: 0.30 },
          { attr: 'height', weight: 0.20 },
        ],
        outcome_deltas: { goal: 0.16, goal_against: 0.03, win_delta: 0.07 },
        possible_outcomes: ['goal_header', 'saved_header', 'cleared_header', 'counter_risk'],
      },
      {
        id: 'short_freekick',
        label: '短传重组织',
        desc: '短传给旁边队友，打乱人墙注意力，重新组织进攻。',
        risk: '放弃直接机会，对手重组防线',
        reward: '保留球权，创造更好射门角度',
        weight_formula: [
          { attr: 'tec', weight: 0.65 },
          { attr: 'sta', weight: 0.35 },
        ],
        outcome_deltas: { goal: 0.10, goal_against: 0.01, win_delta: 0.04 },
        possible_outcomes: ['goal_reorganized', 'shot_blocked', 'possession_kept'],
      },
    ],
  },

  {
    id: 'penalty_kick',
    trigger: '获得点球',
    minute_range: [1, 120],
    animation_type: 'penalty_shootout',
    situation_variants: [
      '点球！裁判指向点球点，{player}拿起球走向点球点，全场寂静。',
      'VAR确认点球成立！{player}将承担这个关键点球。',
    ],
    choices: [
      {
        id: 'penalty_power',
        label: '大力抽射',
        desc: '不讲方向，靠力量和速度让门将无法反应——球速超过120km/h。',
        risk: '力量过大可能打飞或射中横梁',
        reward: '即使门将猜对方向也扑不到',
        weight_formula: [
          { attr: 'phy', weight: 0.40 },
          { attr: 'tec', weight: 0.40 },
          { attr: 'sta', weight: 0.20 },
        ],
        outcome_deltas: { goal: 0.30, goal_against: 0.0, win_delta: 0.13 },
        possible_outcomes: ['goal_power', 'miss_crossbar', 'miss_wide_power'],
      },
      {
        id: 'penalty_placement',
        label: '精准低角',
        desc: '冷静推入球门角落，靠精准控制而非力量——心理压力极大。',
        risk: '门将猜对方向则必扑到',
        reward: '角度精准时门将无能为力',
        weight_formula: [
          { attr: 'tec', weight: 0.60 },
          { attr: 'sta', weight: 0.40 },
        ],
        outcome_deltas: { goal: 0.32, goal_against: 0.0, win_delta: 0.14 },
        possible_outcomes: ['goal_placement', 'saved_placement', 'miss_post'],
      },
      {
        id: 'penalty_panenka',
        label: '勺子点球',
        desc: '轻挑门将，球缓缓送入中路——极度自信和冷静，也是最大赌注。',
        risk: '门将若没扑出去，球会轻松扑出',
        reward: '成功则是最浪漫的进球，震撼全场',
        weight_formula: [
          { attr: 'sta', weight: 0.60 },
          { attr: 'tec', weight: 0.40 },
        ],
        outcome_deltas: { goal: 0.25, goal_against: 0.0, win_delta: 0.11 },
        possible_outcomes: ['goal_panenka', 'saved_panenka', 'miss_panenka'],
      },
    ],
  },

  {
    id: 'long_shot_opportunity',
    trigger: '中场球员获得远射机会',
    minute_range: [20, 90],
    animation_type: 'attack_long_shot',
    situation_variants: [
      '{player}在禁区外30米处拿到球，对方防线还未到位，远射窗口就在眼前！',
      '对手刚解围，球落到{player}脚下，门将站位靠前，远射！',
    ],
    choices: [
      {
        id: 'shoot_now',
        label: '立刻远射',
        desc: '不停球直接抽射，利用门将站位靠前的机会。',
        risk: '距离远，门将可能正好在位置上',
        reward: '直接得分，气势震撼',
        weight_formula: [
          { attr: 'tec', weight: 0.65 },
          { attr: 'phy', weight: 0.20 },
          { attr: 'sta', weight: 0.15 },
        ],
        outcome_deltas: { goal: 0.15, goal_against: 0.01, win_delta: 0.07 },
        possible_outcomes: ['goal_long', 'saved_long', 'miss_wide', 'miss_over'],
      },
      {
        id: 'control_advance',
        label: '带球推进',
        desc: '不急于射门，控球向前推进，等待更好机会。',
        risk: '防守球员回位，机会消失',
        reward: '获得更近射门位置或助攻机会',
        weight_formula: [
          { attr: 'spd', weight: 0.50 },
          { attr: 'tec', weight: 0.50 },
        ],
        outcome_deltas: { goal: 0.12, goal_against: 0.02, win_delta: 0.05 },
        possible_outcomes: ['goal_closer', 'tackled_advance', 'corner_won'],
      },
    ],
  },

  {
    id: 'header_corner',
    trigger: '角球机会，有高中锋在禁区',
    minute_range: [1, 90],
    animation_type: 'attack_corner',
    situation_variants: [
      '角球！{player}站在角旗区，{player2}在禁区内等待争顶——如何发球？',
      '角球机会！禁区内人头攒动，这球要怎么发？',
    ],
    choices: [
      {
        id: 'near_post_corner',
        label: '近点传中',
        desc: '球传向近门柱，制造混乱——可能直接进门，也可能被二点补射。',
        risk: '门将可能出击解围',
        reward: '近门柱混乱往往能创造机会',
        weight_formula: [
          { attr: 'tec', weight: 0.55 },
          { attr: 'phy', weight: 0.30 },
          { attr: 'height', weight: 0.15 },
        ],
        outcome_deltas: { goal: 0.16, goal_against: 0.04, win_delta: 0.07 },
        possible_outcomes: ['goal_near_post', 'goal_second_ball', 'cleared_near', 'counter_fast'],
      },
      {
        id: 'far_post_corner',
        label: '远点争顶',
        desc: '球传向远门柱，让{player2}发挥身高优势头球攻门。',
        risk: '对方中卫提前占位头球解围',
        reward: '高中锋远门柱头球命中率极高',
        weight_formula: [
          { attr: 'phy', weight: 0.55 },
          { attr: 'height', weight: 0.30 },
          { attr: 'tec', weight: 0.15 },
        ],
        outcome_deltas: { goal: 0.18, goal_against: 0.03, win_delta: 0.08 },
        possible_outcomes: ['goal_far_header', 'saved_far', 'cleared_far'],
      },
      {
        id: 'short_corner',
        label: '短角球配合',
        desc: '传给角旗区旁队友，创造传中角度，打乱防守阵型。',
        risk: '配合失误可能丢球反击',
        reward: '更好传中角度，防守位置被打乱',
        weight_formula: [
          { attr: 'tec', weight: 0.70 },
          { attr: 'spd', weight: 0.30 },
        ],
        outcome_deltas: { goal: 0.13, goal_against: 0.03, win_delta: 0.06 },
        possible_outcomes: ['goal_short_corner', 'blocked_short', 'possession_lost'],
      },
    ],
  },

  {
    id: 'through_ball_chance',
    trigger: '中场发现前锋身后有空当',
    minute_range: [1, 85],
    animation_type: 'attack_through_ball',
    situation_variants: [
      '{player}持球在中场，看到了{player2}身后的空当——直塞球时机稍纵即逝！',
      '防线拉开空间！{player}眼神一亮，{player2}已经开始起跑……',
    ],
    choices: [
      {
        id: 'play_through',
        label: '直塞身后',
        desc: '果断直塞穿越防线——时机和力度缺一不可，差一点就越位。',
        risk: '时机不对导致越位，或力量不对被门将拿住',
        reward: '穿越防线后前锋单刀',
        weight_formula: [
          { attr: 'tec', weight: 0.65 },
          { attr: 'sta', weight: 0.20 },
          { attr: 'spd', weight: 0.15 },
        ],
        outcome_deltas: { goal: 0.22, goal_against: 0.02, win_delta: 0.10 },
        possible_outcomes: ['goal_through', 'offside', 'gk_claim', 'chance_created'],
      },
      {
        id: 'hold_ball',
        label: '等待更好时机',
        desc: '忍住不传，继续控球等待防线更大漏洞。',
        risk: '时机稍纵即逝，可能再也找不到空当',
        reward: '更稳健，不冒越位风险',
        weight_formula: [
          { attr: 'tec', weight: 0.55 },
          { attr: 'sta', weight: 0.45 },
        ],
        outcome_deltas: { goal: 0.08, goal_against: 0.01, win_delta: 0.03 },
        possible_outcomes: ['corner_won', 'possession_maintained', 'shot_created'],
      },
    ],
  },

  // ════════════════════════════════════════════
  // 防守类（10个）
  // ════════════════════════════════════════════

  {
    id: 'penalty_area_foul_risk',
    trigger: '对方前锋持球进入禁区',
    minute_range: [1, 90],
    animation_type: 'defend_penalty_risk',
    situation_variants: [
      '危险！{opponent}持球突破进入禁区，{player}追上来了，出脚还是退守？',
      '{opponent}在禁区内晃过一人，{player}是最后屏障——出脚的话点球风险极大。',
      '禁区内危机！{opponent}背身拿球，{player}紧逼，一个不慎就是点球！',
    ],
    choices: [
      {
        id: 'slide_tackle',
        label: '果断铲球',
        desc: '果断出脚铲断——铲到球是英雄，铲到人是点球加黄牌。',
        risk: '铲到人：点球+黄牌，最坏红牌',
        reward: '铲球成功：直接断球解围',
        weight_formula: [
          { attr: 'def', weight: 0.55 },
          { attr: 'phy', weight: 0.25 },
          { attr: 'sta', weight: 0.20 },
        ],
        outcome_deltas: { goal: 0.0, goal_against: -0.05, win_delta: 0.06 },
        possible_outcomes: ['tackle_success', 'yellow_card_penalty', 'tackle_miss', 'red_card_penalty'],
      },
      {
        id: 'contain_delay',
        label: '拖延退守',
        desc: '不冒险出脚，用身位逼迫对手往边路走，等队友回防。',
        risk: '对手可能晃开后直接打门',
        reward: '避免点球风险，等待援军',
        weight_formula: [
          { attr: 'def', weight: 0.45 },
          { attr: 'spd', weight: 0.35 },
          { attr: 'phy', weight: 0.20 },
        ],
        outcome_deltas: { goal: 0.0, goal_against: 0.08, win_delta: -0.03 },
        possible_outcomes: ['delay_success', 'opponent_shoots', 'goal_against', 'teammate_helps'],
      },
      {
        id: 'tactical_foul_outside',
        label: '身体阻挡出界',
        desc: '用身体把对手挤出界外——赌裁判不判犯规。',
        risk: '裁判可能判犯规，但在禁区线外',
        reward: '球出界，解除危机',
        weight_formula: [
          { attr: 'phy', weight: 0.60 },
          { attr: 'def', weight: 0.40 },
        ],
        outcome_deltas: { goal: 0.0, goal_against: 0.03, win_delta: 0.02 },
        possible_outcomes: ['ball_out', 'freekick_against', 'opponent_stumbles'],
      },
    ],
  },

  {
    id: 'gk_one_on_one',
    trigger: '门将面对单刀',
    minute_range: [1, 90],
    animation_type: 'defend_gk_rush',
    situation_variants: [
      '单刀！{opponent}冲向球门，{player}该出击还是守住门线？',
      '后防被穿越！{opponent}独自面对{player}——门将的选择决定一切。',
    ],
    choices: [
      {
        id: 'gk_rush_out',
        label: '门将出击',
        desc: '{player}果断出击，用身体缩小射门角度。',
        risk: '出击被挑射进球',
        reward: '出击成功：直接拿球或逼对手失误',
        weight_formula: [
          { attr: 'spd', weight: 0.40 },
          { attr: 'def', weight: 0.35 },
          { attr: 'sta', weight: 0.25 },
        ],
        outcome_deltas: { goal: 0.0, goal_against: -0.08, win_delta: 0.07 },
        possible_outcomes: ['gk_save_rush', 'goal_chip_over', 'gk_claim_ball'],
      },
      {
        id: 'gk_hold_line',
        label: '守住门线',
        desc: '{player}退守门线，用身体覆盖球门，靠反应力扑救。',
        risk: '给对手充裕射门时间',
        reward: '反应扑救成功率稳定',
        weight_formula: [
          { attr: 'def', weight: 0.65 },
          { attr: 'sta', weight: 0.35 },
        ],
        outcome_deltas: { goal: 0.0, goal_against: 0.05, win_delta: -0.02 },
        possible_outcomes: ['gk_reaction_save', 'goal_corner', 'goal_against', 'goal_saved_post'],
      },
    ],
  },

  {
    id: 'last_defender_tackle',
    trigger: '最后一名防守球员面对突破',
    minute_range: [1, 90],
    animation_type: 'defend_last_man',
    situation_variants: [
      '{player}是最后一道防线，{opponent}突破了其他人，就剩这一关！',
      '危机！{player}独自面对{opponent}，后方只有门将！',
    ],
    choices: [
      {
        id: 'last_man_tackle',
        label: '拼死铲断',
        desc: '豁出去铲球——可能是英雄铲断，也可能是最后一人红牌。',
        risk: '失误：红牌+点球',
        reward: '成功：断球化险为夷',
        weight_formula: [
          { attr: 'def', weight: 0.50 },
          { attr: 'phy', weight: 0.30 },
          { attr: 'sta', weight: 0.20 },
        ],
        outcome_deltas: { goal: 0.0, goal_against: -0.10, win_delta: 0.08 },
        possible_outcomes: ['tackle_hero', 'red_card_penalty', 'tackle_partial'],
      },
      {
        id: 'jockey_to_corner',
        label: '逼入死角',
        desc: '不铲球，用灵活步伐把对手逼向底线死角。',
        risk: '对手技术好可能直接打门',
        reward: '避免红牌风险，保持11人',
        weight_formula: [
          { attr: 'spd', weight: 0.45 },
          { attr: 'def', weight: 0.40 },
          { attr: 'sta', weight: 0.15 },
        ],
        outcome_deltas: { goal: 0.0, goal_against: 0.06, win_delta: -0.02 },
        possible_outcomes: ['forced_corner', 'goal_tight_angle', 'goal_against', 'teammate_helps'],
      },
    ],
  },

  {
    id: 'midfield_press_trigger',
    trigger: '对方中场控球，可以发动高压逼抢',
    minute_range: [1, 75],
    animation_type: 'midfield_press',
    situation_variants: [
      '{opponent}在中场拿球，{player}发现逼抢机会——立刻上前？',
      '对手中场传球失误，{player}距离持球人只有两步远！',
    ],
    choices: [
      {
        id: 'press_immediately',
        label: '立刻逼抢',
        desc: '{player}立刻上前逼抢，不给对手时间，断球直接反击。',
        risk: '逼抢失败，身后留下空当',
        reward: '断球后快速反击',
        weight_formula: [
          { attr: 'spd', weight: 0.35 },
          { attr: 'def', weight: 0.35 },
          { attr: 'sta', weight: 0.30 },
        ],
        outcome_deltas: { goal: 0.08, goal_against: -0.05, win_delta: 0.06 },
        possible_outcomes: ['press_success_counter', 'press_failed_space', 'ball_cleared'],
      },
      {
        id: 'drop_and_defend',
        label: '退守等待',
        desc: '不冒险逼抢，退守保持阵型，等对手犯错。',
        risk: '给对手控球时间，可能被找到空间',
        reward: '保持阵型，不被身后空当利用',
        weight_formula: [
          { attr: 'def', weight: 0.55 },
          { attr: 'sta', weight: 0.45 },
        ],
        outcome_deltas: { goal: 0.0, goal_against: 0.04, win_delta: -0.01 },
        possible_outcomes: ['shape_held', 'opponent_builds_up', 'intercept_later'],
      },
    ],
  },

  {
    id: 'tactical_foul_counter',
    trigger: '对手快速反击中，可以战术犯规',
    minute_range: [30, 90],
    animation_type: 'tactical_foul',
    situation_variants: [
      '对手快速反击！{player}追上了持球人，战术犯规还是继续追？',
      '{opponent}持球反击，{player}角度不好，但不犯规后面空无一人！',
    ],
    choices: [
      {
        id: 'tactical_foul_commit',
        label: '战术犯规',
        desc: '果断犯规断掉反击——黄牌值得，但如果已有黄牌后果严重。',
        risk: '已有黄牌则直接红牌',
        reward: '断掉致命反击，赢得防守重组时间',
        weight_formula: [
          { attr: 'def', weight: 0.45 },
          { attr: 'phy', weight: 0.35 },
          { attr: 'sta', weight: 0.20 },
        ],
        outcome_deltas: { goal: 0.0, goal_against: -0.12, win_delta: 0.05 },
        possible_outcomes: ['yellow_card_stop', 'red_card_second_yellow', 'foul_not_called'],
      },
      {
        id: 'chase_back',
        label: '全力追回',
        desc: '放弃犯规，用速度全力追回——体能够的话完全可以追上。',
        risk: '追不上，对手直接单刀',
        reward: '不拿牌，还可能追上断球',
        weight_formula: [
          { attr: 'spd', weight: 0.60 },
          { attr: 'sta', weight: 0.40 },
        ],
        outcome_deltas: { goal: 0.0, goal_against: 0.05, win_delta: -0.01 },
        possible_outcomes: ['caught_up_tackle', 'solo_against_gk', 'caught_up_delay'],
      },
    ],
  },

  {
    id: 'aerial_duel_corner_defending',
    trigger: '对手发角球，我方防守头球',
    minute_range: [1, 90],
    animation_type: 'defend_corner',
    situation_variants: [
      '对手角球！{opponent}准备发球，{player}在禁区内盯防高中锋。',
      '角球危机！{player}需要盯紧对手最具威胁的前锋。',
    ],
    choices: [
      {
        id: 'man_mark_striker',
        label: '紧盯危险人',
        desc: '放弃区域防守，全程紧盯对方最高的前锋。',
        risk: '被牵制走，其他区域空出',
        reward: '封死最大威胁',
        weight_formula: [
          { attr: 'phy', weight: 0.45 },
          { attr: 'def', weight: 0.35 },
          { attr: 'height', weight: 0.20 },
        ],
        outcome_deltas: { goal: 0.0, goal_against: -0.08, win_delta: 0.05 },
        possible_outcomes: ['header_cleared', 'clean_catch_gk', 'second_ball_risk'],
      },
      {
        id: 'zone_defense_corner',
        label: '区域防守',
        desc: '坚守区域，等球来了再争顶——灵活性更高。',
        risk: '对手前锋在区域边界制造混乱',
        reward: '阵型完整，二次进攻有保障',
        weight_formula: [
          { attr: 'def', weight: 0.55 },
          { attr: 'phy', weight: 0.30 },
          { attr: 'sta', weight: 0.15 },
        ],
        outcome_deltas: { goal: 0.0, goal_against: 0.03, win_delta: -0.01 },
        possible_outcomes: ['zone_cleared', 'goal_zone_gap', 'gk_punches'],
      },
    ],
  },

  {
    id: 'offside_trap',
    trigger: '对手中场长传，可以选择越位陷阱',
    minute_range: [20, 80],
    animation_type: 'defend_offside',
    situation_variants: [
      '{opponent}准备长传直塞，{player}和队友面临选择：是否压上制造越位？',
      '对手后场拿球准备长传！后防线面临是否集体压上的抉择。',
    ],
    choices: [
      {
        id: 'offside_trap_spring',
        label: '越位陷阱',
        desc: '后防线集体前压，让对手前锋处于越位位置——需要全员默契。',
        risk: '时机不对，前锋单刀！',
        reward: '成功：越位旗举起，进攻化解',
        weight_formula: [
          { attr: 'def', weight: 0.50 },
          { attr: 'spd', weight: 0.30 },
          { attr: 'sta', weight: 0.20 },
        ],
        outcome_deltas: { goal: 0.0, goal_against: -0.10, win_delta: 0.07 },
        possible_outcomes: ['offside_success', 'offside_fail_solo', 'ball_intercepted'],
      },
      {
        id: 'track_runner',
        label: '盯住跑动',
        desc: '不制造越位，老老实实盯住对方前锋跑动。',
        risk: '对手跑位灵活可能甩开盯防',
        reward: '稳健，不冒越位失败风险',
        weight_formula: [
          { attr: 'spd', weight: 0.50 },
          { attr: 'def', weight: 0.35 },
          { attr: 'sta', weight: 0.15 },
        ],
        outcome_deltas: { goal: 0.0, goal_against: 0.04, win_delta: -0.01 },
        possible_outcomes: ['tracked_successfully', 'lost_runner_chance', 'headed_clear'],
      },
    ],
  },

  // ════════════════════════════════════════════
  // 战术/管理类（6个）
  // ════════════════════════════════════════════

  {
    id: 'stamina_collapse_sub',
    trigger: '关键球员体能崩溃',
    minute_range: [55, 85],
    animation_type: 'substitution',
    situation_variants: [
      '{player}已经明显跑不动了，状态持续下滑——换人还是坚持？',
      '第{minute}分钟，{player}的体能到了极限……',
    ],
    choices: [
      {
        id: 'sub_now',
        label: '立刻换人',
        desc: '换下{player}，让替补带着新鲜状态登场——但换人名额有限。',
        risk: '替补能力差距可能削弱阵容',
        reward: '新鲜腿脚，立刻改善覆盖范围',
        weight_formula: [
          { attr: 'sta', weight: 0.60 },
          { attr: 'def', weight: 0.40 },
        ],
        outcome_deltas: { goal: 0.05, goal_against: -0.05, win_delta: 0.04 },
        possible_outcomes: ['sub_positive_impact', 'sub_neutral', 'sub_disrupts_flow'],
      },
      {
        id: 'push_through',
        label: '撑到最后',
        desc: '相信{player}的意志力——他可能超水平发挥，也可能完全熄火。',
        risk: '持续掉状态，后半段越来越弱',
        reward: '关键时刻可能爆发',
        weight_formula: [
          { attr: 'sta', weight: 0.55 },
          { attr: 'def', weight: 0.45 },
        ],
        outcome_deltas: { goal: 0.03, goal_against: 0.06, win_delta: -0.01 },
        possible_outcomes: ['clutch_moment_saves', 'complete_drop_off', 'maintains_level'],
      },
    ],
  },

  {
    id: 'trailing_last_ten',
    trigger: '落后且进入最后10分钟',
    minute_range: [80, 90],
    animation_type: 'tactical_all_out',
    situation_variants: [
      '第{minute}分钟，落后{diff}球，时间不多——全力一搏还是保住最小失分？',
      '时间所剩无几！是孤注一掷还是接受命运？',
    ],
    choices: [
      {
        id: 'all_out_attack',
        label: '全员压上',
        desc: '门将以外全员进入对方半场，最后的赌注。',
        risk: '后防空虚，被打反击再失球',
        reward: '制造混乱，可能追平',
        weight_formula: [
          { attr: 'tec', weight: 0.40 },
          { attr: 'sta', weight: 0.35 },
          { attr: 'spd', weight: 0.25 },
        ],
        outcome_deltas: { goal: 0.20, goal_against: 0.18, win_delta: 0.06 },
        possible_outcomes: ['comeback_goal', 'counter_sealed', 'late_equalizer'],
      },
      {
        id: 'structured_pressure',
        label: '有组织施压',
        desc: '保持基本阵型，有组织地向前施压。',
        risk: '进球效率较低，时间可能不够',
        reward: '不会被反击扩大比分',
        weight_formula: [
          { attr: 'tec', weight: 0.50 },
          { attr: 'def', weight: 0.30 },
          { attr: 'sta', weight: 0.20 },
        ],
        outcome_deltas: { goal: 0.12, goal_against: 0.05, win_delta: 0.03 },
        possible_outcomes: ['late_equalizer', 'missed_chances', 'held_off'],
      },
      {
        id: 'accept_defeat',
        label: '保持队形',
        desc: '不冒险了，体面地结束比赛——留力气下场。',
        risk: '放弃追平可能',
        reward: '保住积分差，防净胜球影响出线',
        weight_formula: [
          { attr: 'def', weight: 0.60 },
          { attr: 'sta', weight: 0.40 },
        ],
        outcome_deltas: { goal: 0.02, goal_against: -0.08, win_delta: -0.05 },
        possible_outcomes: ['held_scoreline', 'lucky_chance', 'no_more_goals'],
      },
    ],
  },

  {
    id: 'leading_protect',
    trigger: '领先且进入最后10分钟',
    minute_range: [80, 90],
    animation_type: 'tactical_time_waste',
    situation_variants: [
      '领先{diff}球，还有{remaining}分钟！是继续压迫还是控球消磨时间？',
      '胜利在望！但还有{remaining}分钟，稍有不慎前功尽弃。',
    ],
    choices: [
      {
        id: 'time_waste',
        label: '控球消磨',
        desc: '在对方半场控球，不轻易射门，把时间磨掉。',
        risk: '对手可能恶意铲球',
        reward: '时间流逝，胜利越来越近',
        weight_formula: [
          { attr: 'tec', weight: 0.60 },
          { attr: 'sta', weight: 0.40 },
        ],
        outcome_deltas: { goal: -0.02, goal_against: -0.08, win_delta: 0.06 },
        possible_outcomes: ['time_killed', 'yellow_card_opponent', 'possession_lost'],
      },
      {
        id: 'keep_pressing',
        label: '继续进攻',
        desc: '不满足于领先，继续寻找进球——扩大比分是最好的防守。',
        risk: '失去球权被反击追平',
        reward: '再进一球锁定比赛',
        weight_formula: [
          { attr: 'tec', weight: 0.45 },
          { attr: 'spd', weight: 0.35 },
          { attr: 'sta', weight: 0.20 },
        ],
        outcome_deltas: { goal: 0.12, goal_against: 0.06, win_delta: 0.04 },
        possible_outcomes: ['sealed_win', 'counter_equalizer', 'chance_missed'],
      },
    ],
  },

  {
    id: 'extra_time_penalty_shootout_prep',
    trigger: '加时赛末段，平局局面',
    minute_range: [115, 120],
    animation_type: 'tactical_penalty_prep',
    situation_variants: [
      '加时赛快结束了，比分依然{score}——点球大战几乎无法避免。',
      '第{minute}分钟，距点球大战不到{remaining}分钟，全队精疲力竭……',
    ],
    choices: [
      {
        id: 'last_attack',
        label: '最后一次冲锋',
        desc: '全队最后力量压上，争取点球大战前解决比赛。',
        risk: '体能耗尽，点球大战状态更差',
        reward: '避开点球运气因素，直接赢',
        weight_formula: [
          { attr: 'sta', weight: 0.50 },
          { attr: 'tec', weight: 0.30 },
          { attr: 'spd', weight: 0.20 },
        ],
        outcome_deltas: { goal: 0.18, goal_against: 0.10, win_delta: 0.05 },
        possible_outcomes: ['golden_goal', 'counter_golden_goal', 'into_penalties'],
      },
      {
        id: 'conserve_for_penalties',
        label: '养精蓄锐',
        desc: '保住平局，留体力等待点球大战。',
        risk: '对手可能抓机会进致胜球',
        reward: '点球大战体能更好，心态更稳',
        weight_formula: [
          { attr: 'def', weight: 0.50 },
          { attr: 'sta', weight: 0.50 },
        ],
        outcome_deltas: { goal: -0.02, goal_against: -0.05, win_delta: 0.04 },
        possible_outcomes: ['penalties_fresh', 'opponent_last_gasp', 'calm_shootout'],
      },
    ],
  },

  {
    id: 'indirect_freekick_box',
    trigger: '禁区内间接任意球',
    minute_range: [1, 90],
    animation_type: 'attack_freekick',
    situation_variants: [
      '间接任意球！裁判判罚对方禁区内犯规，{player}站在球前，全场屏息。',
      '禁区内间接任意球！这个位置非常危险，{player}和{player2}站在球旁。',
    ],
    choices: [
      {
        id: 'quick_pass_shot',
        label: '一拨一射',
        desc: '{player2}轻轻一拨，{player}跟上大力抽射——经典配合。',
        risk: '人墙距离近，可能被封堵',
        reward: '射门距离极近，门将来不及反应',
        weight_formula: [
          { attr: 'tec', weight: 0.55 },
          { attr: 'phy', weight: 0.25 },
          { attr: 'sta', weight: 0.20 },
        ],
        outcome_deltas: { goal: 0.28, goal_against: 0.0, win_delta: 0.12 },
        possible_outcomes: ['goal', 'goal', 'saved_close', 'blocked_wall'],
      },
      {
        id: 'pass_out_reload',
        label: '传出重新组织',
        desc: '不急于射门，传给外围队友重新组织进攻。',
        risk: '放弃近距离机会，对手重新布防',
        reward: '保留球权，创造更好角度',
        weight_formula: [
          { attr: 'tec', weight: 0.65 },
          { attr: 'sta', weight: 0.35 },
        ],
        outcome_deltas: { goal: 0.10, goal_against: 0.01, win_delta: 0.04 },
        possible_outcomes: ['goal_reorganized', 'shot_blocked', 'possession_kept'],
      },
      {
        id: 'dink_cross',
        label: '挑传后点',
        desc: '挑传到远门柱，让高个球员争顶——出其不意。',
        risk: '传球精度要求高，可能被门将摘下',
        reward: '后点防守薄弱，头球机会好',
        weight_formula: [
          { attr: 'tec', weight: 0.50 },
          { attr: 'phy', weight: 0.30 },
          { attr: 'height', weight: 0.20 },
        ],
        outcome_deltas: { goal: 0.18, goal_against: 0.02, win_delta: 0.08 },
        possible_outcomes: ['goal_header', 'saved_header', 'gk_claims'],
      },
    ],
  },

  {
    id: 'match_penalty',
    trigger: '比赛中获得点球',
    minute_range: [1, 90],
    animation_type: 'penalty_shootout',
    situation_variants: [
      '点球！裁判指向十二码！{player}拿起球走向点球点。',
      'VAR确认！点球！{player}操刀主罚。',
      '禁区内犯规！点球！全场球迷屏住呼吸，{player}准备罚球。',
    ],
    choices: [
      {
        id: 'penalty_left',
        label: '射向左下角',
        desc: '冷静推射球门左下角，角度刁钻。',
        risk: '门将猜对方向则扑到',
        reward: '低平球角度好，扑救难度大',
        weight_formula: [
          { attr: 'tec', weight: 0.60 },
          { attr: 'sta', weight: 0.40 },
        ],
        outcome_deltas: { goal: 0.30, goal_against: 0.0, win_delta: 0.13 },
        possible_outcomes: ['goal_placement', 'saved_placement', 'miss_post'],
      },
      {
        id: 'penalty_right',
        label: '射向右下角',
        desc: '瞄准球门右侧，门将的反方向。',
        risk: '门将猜对方向',
        reward: '右脚球员的自然角度',
        weight_formula: [
          { attr: 'tec', weight: 0.60 },
          { attr: 'sta', weight: 0.40 },
        ],
        outcome_deltas: { goal: 0.30, goal_against: 0.0, win_delta: 0.13 },
        possible_outcomes: ['goal_power', 'saved_power', 'miss_wide_power'],
      },
      {
        id: 'penalty_center',
        label: '勺子点球',
        desc: '轻挑中路，赌门将会自己扑向一边——极度自信。',
        risk: '门将不动则轻松扑出',
        reward: '成功则是最浪漫的进球',
        weight_formula: [
          { attr: 'sta', weight: 0.60 },
          { attr: 'tec', weight: 0.40 },
        ],
        outcome_deltas: { goal: 0.25, goal_against: 0.0, win_delta: 0.11 },
        possible_outcomes: ['goal_panenka', 'saved_panenka', 'miss_panenka'],
      },
    ],
  },

  {
    id: 'defender_last_ditch',
    trigger: '对方前锋突入禁区准备射门',
    minute_range: [1, 90],
    animation_type: 'defend_last_man',
    situation_variants: [
      '{opponent}在禁区内拿到球，已经转身面对球门，{player}必须做出选择——放铲还是站位？',
      '危险！{opponent}在点球点附近接球，{player}冲上来封堵，放铲可能送点球！',
      '{opponent}禁区内停球转身，{player}距离一步，出脚还是稳住？',
    ],
    choices: [
      {
        id: 'commit_tackle',
        label: '飞身封堵',
        desc: '飞身用身体挡住射门线路——可能犯规，但不封堵就直接射门了。',
        risk: '动作过大可能判点球',
        reward: '挡住射门，化解危机',
        weight_formula: [
          { attr: 'def', weight: 0.50 },
          { attr: 'phy', weight: 0.30 },
          { attr: 'sta', weight: 0.20 },
        ],
        outcome_deltas: { goal: 0.0, goal_against: -0.06, win_delta: 0.05 },
        possible_outcomes: ['tackle_success', 'yellow_card_penalty', 'shot_blocked', 'red_card_penalty'],
      },
      {
        id: 'stand_ground',
        label: '稳住站位',
        desc: '不冒险出脚，站好位置封堵射门角度，用身体挡球。',
        risk: '对手可能晃开后打门',
        reward: '避免犯规风险，用身体防守',
        weight_formula: [
          { attr: 'def', weight: 0.55 },
          { attr: 'spd', weight: 0.25 },
          { attr: 'phy', weight: 0.20 },
        ],
        outcome_deltas: { goal: 0.0, goal_against: 0.06, win_delta: -0.02 },
        possible_outcomes: ['shot_blocked_body', 'goal_against', 'deflected_corner', 'delay_success'],
      },
    ],
  },

  {
    id: 'throwin_attack',
    trigger: '前场边线球，有进攻机会',
    minute_range: [1, 90],
    animation_type: 'attack_cross',
    situation_variants: [
      '前场边线球！{player}大力掷向禁区，队友们已经在门前等候。',
      '边线球机会，{player}掷球给{player2}，快速发起进攻。',
    ],
    choices: [
      {
        id: 'long_throw',
        label: '大力掷入禁区',
        desc: '像掷手榴弹一样将球掷入禁区，制造混乱。',
        risk: '掷球不准可能被解围',
        reward: '禁区内争顶机会，类似角球',
        weight_formula: [
          { attr: 'phy', weight: 0.50 },
          { attr: 'tec', weight: 0.30 },
          { attr: 'height', weight: 0.20 },
        ],
        outcome_deltas: { goal: 0.12, goal_against: 0.02, win_delta: 0.05 },
        possible_outcomes: ['goal_header', 'cleared_header', 'second_ball_chance'],
      },
      {
        id: 'short_throw',
        label: '短传配合',
        desc: '掷给旁边队友，快速传递创造射门空间。',
        risk: '配合可能失误',
        reward: '保持球权，灵活进攻',
        weight_formula: [
          { attr: 'tec', weight: 0.65 },
          { attr: 'spd', weight: 0.35 },
        ],
        outcome_deltas: { goal: 0.08, goal_against: 0.01, win_delta: 0.03 },
        possible_outcomes: ['chance_created', 'possession_kept', 'cross_attempt'],
      },
      {
        id: 'fake_throw',
        label: '假动作掷球',
        desc: '假装掷向禁区，实际快速掷给边路队友——打乱防守部署。',
        risk: '裁判可能判违例',
        reward: '防守球员被骗，边路出现空当',
        weight_formula: [
          { attr: 'tec', weight: 0.60 },
          { attr: 'spd', weight: 0.40 },
        ],
        outcome_deltas: { goal: 0.10, goal_against: 0.01, win_delta: 0.04 },
        possible_outcomes: ['goal_cross', 'shot_on_target', 'throw_violation'],
      },
    ],
  },

  {
    id: 'var_goal_review',
    trigger: '进球后VAR正在确认',
    minute_range: [20, 90],
    animation_type: 'attack_solo',
    situation_variants: [
      '{player}刚把球送进网窝，但边裁举旗，VAR正在确认是否越位。',
      '全场屏息！{player}的进球进入VAR复核，裁判正在听耳机。',
    ],
    choices: [
      {
        id: 'stay_calm',
        label: '保持冷静',
        desc: '让队员散开等待判罚，不围堵裁判，避免情绪影响后续比赛。',
        risk: '无法给裁判施压',
        reward: '保持专注，判罚不利也能快速回到阵型',
        weight_formula: [
          { attr: 'sta', weight: 0.55 },
          { attr: 'tec', weight: 0.45 },
        ],
        outcome_deltas: { goal: 0.12, goal_against: 0.0, win_delta: 0.05 },
        possible_outcomes: ['goal', 'possession_kept', 'no_change'],
      },
      {
        id: 'captain_talk',
        label: '队长沟通',
        desc: '让队长上前和裁判沟通，争取解释空间，同时控制队友情绪。',
        risk: '沟通过激可能吃牌',
        reward: '有机会保住进球，也能稳住士气',
        weight_formula: [
          { attr: 'tec', weight: 0.50 },
          { attr: 'sta', weight: 0.50 },
        ],
        outcome_deltas: { goal: 0.10, goal_against: 0.0, win_delta: 0.04 },
        possible_outcomes: ['goal', 'yellow_card', 'no_change'],
      },
      {
        id: 'restart_focus',
        label: '准备重开',
        desc: '先不纠缠判罚，立刻提醒全队回收阵型，防止被对手快发偷袭。',
        risk: '进球可能被取消',
        reward: '即使判罚不利，也能避免节奏崩掉',
        weight_formula: [
          { attr: 'def', weight: 0.45 },
          { attr: 'sta', weight: 0.55 },
        ],
        outcome_deltas: { goal: 0.06, goal_against: 0.0, win_delta: 0.03 },
        possible_outcomes: ['possession_kept', 'safe', 'no_change'],
      },
    ],
  },

  {
    id: 'keeper_distribution',
    trigger: '门将拿球后的出球选择',
    minute_range: [1, 90],
    animation_type: 'defend_gk_rush',
    situation_variants: [
      '门将{player}稳稳抱住皮球，对手前场逼抢还没退开——怎么出球？',
      '{player}拿到球后抬头观察，边后卫和中锋都在要球。',
    ],
    choices: [
      {
        id: 'short_build_up',
        label: '短传后卫',
        desc: '从后场开始组织，保持球权，但要面对对方压迫。',
        risk: '短传被断就是禁区前危险球',
        reward: '控住节奏，能把对手阵型拉出来',
        weight_formula: [
          { attr: 'tec', weight: 0.60 },
          { attr: 'def', weight: 0.40 },
        ],
        outcome_deltas: { goal: 0.04, goal_against: 0.04, win_delta: 0.02 },
        possible_outcomes: ['possession_kept', 'counter_chance', 'pass_intercepted'],
      },
      {
        id: 'long_kick_target',
        label: '大脚找前锋',
        desc: '直接越过中场找前锋争顶，简单粗暴，立刻把压力转移出去。',
        risk: '二点球可能丢失',
        reward: '赢下争顶就能直接形成反击',
        weight_formula: [
          { attr: 'phy', weight: 0.45 },
          { attr: 'tec', weight: 0.35 },
          { attr: 'sta', weight: 0.20 },
        ],
        outcome_deltas: { goal: 0.07, goal_against: 0.02, win_delta: 0.03 },
        possible_outcomes: ['counter_chance', 'possession_kept', 'lost_ball'],
      },
      {
        id: 'slow_release',
        label: '压慢节奏',
        desc: '等队友落位后再开球，牺牲速度换稳定。',
        risk: '反击窗口消失',
        reward: '阵型完整，降低连续受压概率',
        weight_formula: [
          { attr: 'sta', weight: 0.55 },
          { attr: 'def', weight: 0.45 },
        ],
        outcome_deltas: { goal: 0.02, goal_against: 0.0, win_delta: 0.02 },
        possible_outcomes: ['safe', 'possession_kept', 'no_change'],
      },
    ],
  },

  {
    id: 'midfield_second_ball',
    trigger: '中场二点球争夺',
    minute_range: [1, 90],
    animation_type: 'midfield_press',
    situation_variants: [
      '高空球落到中圈附近，{player}和对手同时冲向二点球。',
      '解围球没有踢远，{player}正面对二点球争夺，谁先碰到球就能改写节奏。',
    ],
    choices: [
      {
        id: 'first_touch_forward',
        label: '第一脚向前',
        desc: '抢到球后立刻向前给，赌队友已经前插。',
        risk: '传球方向冒险，丢球会被反打',
        reward: '一脚就能打穿中场',
        weight_formula: [
          { attr: 'tec', weight: 0.55 },
          { attr: 'spd', weight: 0.25 },
          { attr: 'sta', weight: 0.20 },
        ],
        outcome_deltas: { goal: 0.09, goal_against: 0.03, win_delta: 0.04 },
        possible_outcomes: ['through_success', 'counter_chance', 'pass_wrong'],
      },
      {
        id: 'shield_and_turn',
        label: '护球转身',
        desc: '先用身体挡住对手，再转身把球交给中场核心。',
        risk: '被对手贴身抢断',
        reward: '稳住球权，队形能整体压上',
        weight_formula: [
          { attr: 'phy', weight: 0.45 },
          { attr: 'tec', weight: 0.35 },
          { attr: 'sta', weight: 0.20 },
        ],
        outcome_deltas: { goal: 0.05, goal_against: 0.01, win_delta: 0.03 },
        possible_outcomes: ['possession_kept', 'safe', 'tackled'],
      },
      {
        id: 'tactical_bump',
        label: '战术冲撞',
        desc: '对手先启动时，用身体延缓他推进。',
        risk: '可能犯规吃牌',
        reward: '切断一次危险转换',
        weight_formula: [
          { attr: 'def', weight: 0.50 },
          { attr: 'phy', weight: 0.35 },
          { attr: 'sta', weight: 0.15 },
        ],
        outcome_deltas: { goal: 0.0, goal_against: 0.02, win_delta: 0.02 },
        possible_outcomes: ['intercept', 'foul', 'yellow_card'],
      },
    ],
  },

  {
    id: 'box_scramble_clearance',
    trigger: '禁区混战需要解围',
    minute_range: [1, 90],
    animation_type: 'defend_corner',
    situation_variants: [
      '禁区里一片混战，皮球弹到{player}脚边，对手前锋已经冲上来了！',
      '角球二次进攻！{player}面前全是人，必须马上处理这个危险球。',
    ],
    choices: [
      {
        id: 'clear_far_side',
        label: '大脚解围',
        desc: '不冒险，直接把球踢向远侧边线。',
        risk: '可能送给对手边线球继续进攻',
        reward: '最快解除门前危险',
        weight_formula: [
          { attr: 'def', weight: 0.55 },
          { attr: 'phy', weight: 0.45 },
        ],
        outcome_deltas: { goal: 0.0, goal_against: 0.01, win_delta: 0.03 },
        possible_outcomes: ['cleared_header', 'safe', 'corner'],
      },
      {
        id: 'body_block',
        label: '身体封堵',
        desc: '站住线路，用身体堵住射门角度。',
        risk: '折射可能改变球路',
        reward: '能挡下近距离射门',
        weight_formula: [
          { attr: 'def', weight: 0.60 },
          { attr: 'sta', weight: 0.25 },
          { attr: 'phy', weight: 0.15 },
        ],
        outcome_deltas: { goal: 0.0, goal_against: 0.03, win_delta: 0.02 },
        possible_outcomes: ['shot_blocked', 'deflected', 'goal_against'],
      },
      {
        id: 'keeper_leave',
        label: '喊门将出击',
        desc: '让门将冲出来处理，高风险但能一次性结束混战。',
        risk: '出击失误就是空门',
        reward: '门将拿住球，直接终结对方攻势',
        weight_formula: [
          { attr: 'def', weight: 0.50 },
          { attr: 'sta', weight: 0.30 },
          { attr: 'spd', weight: 0.20 },
        ],
        outcome_deltas: { goal: 0.0, goal_against: 0.04, win_delta: 0.02 },
        possible_outcomes: ['claim_cross', 'safe', 'goal_against'],
      },
    ],
  },

  {
    id: 'penalty_shootout_round',
    trigger: '点球大战中',
    minute_range: [120, 120],
    animation_type: 'penalty_shootout',
    situation_variants: [
      '点球大战！{player}走向点球点，全场屏息……',
      '关键时刻！{player}需要罚进这个点球。',
    ],
    choices: [
      {
        id: 'shoot_left',
        label: '射向左侧',
        desc: '瞄准球门左侧角落，力量与角度并重。',
        risk: '门将猜对方向',
        reward: '角度刁钻，扑救难度大',
        weight_formula: [
          { attr: 'tec', weight: 0.50 },
          { attr: 'sta', weight: 0.50 },
        ],
        outcome_deltas: { goal: 0.30, goal_against: 0.0, win_delta: 0.13 },
        possible_outcomes: ['goal_power', 'saved_placement', 'miss_post'],
      },
      {
        id: 'shoot_right',
        label: '射向右侧',
        desc: '瞄准球门右侧，门将的反方向。',
        risk: '门将猜对方向',
        reward: '右脚球员的自然角度',
        weight_formula: [
          { attr: 'tec', weight: 0.50 },
          { attr: 'sta', weight: 0.50 },
        ],
        outcome_deltas: { goal: 0.30, goal_against: 0.0, win_delta: 0.13 },
        possible_outcomes: ['goal_power', 'saved_placement', 'miss_post'],
      },
      {
        id: 'shoot_center',
        label: '射向中路',
        desc: '不骗门将，直接打中路——赌门将会自己扑向一边。',
        risk: '门将不动则轻松扑出',
        reward: '门将大概率会扑向一侧',
        weight_formula: [
          { attr: 'sta', weight: 0.60 },
          { attr: 'tec', weight: 0.40 },
        ],
        outcome_deltas: { goal: 0.25, goal_against: 0.0, win_delta: 0.11 },
        possible_outcomes: ['goal_panenka', 'saved_panenka', 'miss_panenka'],
      },
    ],
  },
];

/**
 * 根据ID获取决策场景
 */
export function getScenarioById(id) {
  return DECISION_LIBRARY.find(s => s.id === id) || null;
}
