/**
 * 动画模板库
 * 每个模板定义相对位移路径，运行时注入真实球员坐标
 */
export const ANIMATION_TEMPLATES = {
  // ── 进攻类 ────────────────────────────────────────────────────────────────

  attack_solo: {
    label: '单刀机会',
    keyframes: [
      { t: 0, actor: 0, moveTo: 'penalty_area_edge', duration: 900, easing: 'easeIn' },
      { t: 500, opponent: 1, moveTo: 'gk_rush', duration: 600, easing: 'linear' },
      { t: 900, actor: 0, moveTo: 'penalty_area_center', duration: 500, easing: 'easeOut' },
      { t: 1400, type: 'PAUSE_FOR_CHOICE' },
    ],
    waypoints: {
      penalty_area_edge: { x: 'actor_x', y: 75 },
      gk_rush: { x: 50, y: 85 },
      penalty_area_center: { x: 'actor_x', y: 87 },
    },
    result_animations: {
      goal: [
        { t: 0, actor: 0, moveTo: { x: 50, y: 100 }, duration: 400, type: 'shot' },
        { t: 400, type: 'GOAL_EFFECT' },
      ],
      miss: [
        { t: 0, actor: 0, moveTo: { x: 'actor_x+10', y: 97 }, duration: 400, type: 'shot_miss' },
      ],
      save: [
        { t: 0, actor: 0, moveTo: { x: 50, y: 95 }, duration: 400, type: 'shot' },
        { t: 0, actor: 1, moveTo: { x: 45, y: 97 }, duration: 350, type: 'save_dive' },
      ],
    },
  },

  attack_penalty_area: {
    label: '禁区混战',
    keyframes: [
      { t: 0, actor: 0, moveTo: { x: 'actor_x', y: 82 }, duration: 700 },
      { t: 0, ball: true, moveTo: { x: 'actor_x+15', y: 85 }, duration: 600, type: 'cross' },
      { t: 600, actor: 0, moveTo: { x: 50, y: 87 }, duration: 500 },
      { t: 1100, type: 'PAUSE_FOR_CHOICE' },
    ],
    result_animations: {
      goal: [
        { t: 0, ball: true, moveTo: { x: 50, y: 100 }, duration: 300, type: 'header_shot' },
        { t: 300, type: 'GOAL_EFFECT' },
      ],
      miss: [
        { t: 0, ball: true, moveTo: { x: 30, y: 102 }, duration: 350, type: 'header_wide' },
      ],
    },
  },

  attack_counter: {
    label: '快速反击',
    keyframes: [
      { t: 0, actor: 1, moveTo: { x: 'actor_x', y: 65 }, duration: 600, easing: 'easeIn' },
      { t: 600, ball: true, moveTo: { x: 'actor0_x', y: 72 }, duration: 300, type: 'pass' },
      { t: 900, actor: 0, moveTo: { x: 'actor_x', y: 75 }, duration: 200 },
      { t: 1100, type: 'PAUSE_FOR_CHOICE' },
    ],
    result_animations: {
      goal: [
        { t: 0, ball: true, moveTo: { x: 50, y: 100 }, duration: 400, type: 'shot' },
        { t: 400, type: 'GOAL_EFFECT' },
      ],
      counter_saved: [
        { t: 0, ball: true, moveTo: { x: 50, y: 96 }, duration: 400, type: 'shot' },
      ],
    },
  },

  attack_freekick: {
    label: '任意球',
    keyframes: [
      { t: 0, actor: 0, moveTo: { x: 'fk_x', y: 'fk_y' }, duration: 500 },
      { t: 0, ball: true, moveTo: { x: 'fk_x', y: 'fk_y' }, duration: 120, type: 'touch' },
      { t: 120, actor: 1, moveTo: { x: 55, y: 88 }, duration: 520 },
      { t: 200, type: 'WALL_FORM', x: 'fk_x', y: 'fk_y+8' },
      { t: 800, type: 'PAUSE_FOR_CHOICE' },
    ],
    result_animations: {
      goal_freekick: [
        { t: 0, ball: true, moveTo: { x: 50, y: 100 }, duration: 520, type: 'freekick_curve' },
        { t: 520, type: 'GOAL_EFFECT' },
      ],
      saved_freekick: [
        { t: 0, ball: true, moveTo: { x: 48, y: 97 }, duration: 500, type: 'freekick_curve' },
        { t: 0, opponent: 1, moveTo: { x: 48, y: 96 }, duration: 420, type: 'save_dive' },
      ],
      hit_wall: [
        { t: 0, ball: true, moveTo: { x: 50, y: 83 }, duration: 360, type: 'wall_block' },
      ],
      blocked_wall: [
        { t: 0, ball: true, moveTo: { x: 50, y: 83 }, duration: 360, type: 'wall_block' },
      ],
      miss_over: [
        { t: 0, ball: true, moveTo: { x: 55, y: 103 }, duration: 460, type: 'freekick_over' },
      ],
      goal_header: [
        { t: 0, ball: true, moveTo: { x: 55, y: 88 }, duration: 420, type: 'cross' },
        { t: 120, actor: 1, moveTo: { x: 55, y: 90 }, duration: 320, type: 'header_shot' },
        { t: 420, ball: true, moveTo: { x: 50, y: 100 }, duration: 300, type: 'header_shot' },
        { t: 720, type: 'GOAL_EFFECT' },
      ],
      saved_header: [
        { t: 0, ball: true, moveTo: { x: 55, y: 88 }, duration: 420, type: 'cross' },
        { t: 420, ball: true, moveTo: { x: 48, y: 97 }, duration: 300, type: 'header_shot' },
        { t: 440, opponent: 1, moveTo: { x: 48, y: 96 }, duration: 320, type: 'save_dive' },
      ],
      cleared_header: [
        { t: 0, ball: true, moveTo: { x: 55, y: 88 }, duration: 420, type: 'cross' },
        { t: 420, ball: true, moveTo: { x: 33, y: 78 }, duration: 320, type: 'clearance' },
      ],
      goal_reorganized: [
        { t: 0, ball: true, moveTo: { x: 42, y: 72 }, duration: 260, type: 'recycle' },
        { t: 260, ball: true, moveTo: { x: 50, y: 100 }, duration: 440, type: 'shot' },
        { t: 700, type: 'GOAL_EFFECT' },
      ],
      shot_blocked: [
        { t: 0, ball: true, moveTo: { x: 52, y: 84 }, duration: 360, type: 'block' },
      ],
      saved_close: [
        { t: 0, ball: true, moveTo: { x: 48, y: 97 }, duration: 300, type: 'shot' },
        { t: 0, opponent: 1, moveTo: { x: 48, y: 96 }, duration: 260, type: 'save_dive' },
      ],
      gk_claims: [
        { t: 0, opponent: 1, moveTo: { x: 53, y: 91 }, duration: 320, type: 'claim' },
        { t: 0, ball: true, moveTo: { x: 53, y: 91 }, duration: 320, type: 'claim' },
      ],
      goal: [
        { t: 0, ball: true, moveTo: { x: 50, y: 100 }, duration: 500, type: 'freekick_curve' },
        { t: 500, type: 'GOAL_EFFECT' },
      ],
      saved: [
        { t: 0, ball: true, moveTo: { x: 48, y: 98 }, duration: 500, type: 'freekick_curve' },
      ],
      miss: [
        { t: 0, ball: true, moveTo: { x: 55, y: 103 }, duration: 500, type: 'freekick_over' },
      ],
    },
  },

  attack_dive: {
    label: '禁区争议接触',
    keyframes: [
      { t: 0, actor: 0, moveTo: { x: 50, y: 82 }, duration: 520, easing: 'easeIn' },
      { t: 120, opponent: 0, moveTo: { x: 53, y: 80 }, duration: 520 },
      { t: 560, ball: true, moveTo: { x: 50, y: 84 }, duration: 260, type: 'touch' },
      { t: 860, type: 'PAUSE_FOR_CHOICE' },
    ],
    result_animations: {
      penalty_won: [
        { t: 0, actor: 0, moveTo: { x: 51, y: 85 }, duration: 260, type: 'slide_tackle' },
        { t: 180, type: 'FOUL_EFFECT', x: 51, y: 84 },
        { t: 420, type: 'PENALTY_MARK', x: 50, y: 89 },
      ],
      yellow_card_dive: [
        { t: 0, actor: 0, moveTo: { x: 51, y: 85 }, duration: 220, type: 'slide_tackle' },
        { t: 260, type: 'CARD_EFFECT', color: 'yellow', actor: 0 },
      ],
      play_on_lost: [
        { t: 0, opponent: 0, moveTo: { x: 48, y: 76 }, duration: 320, type: 'steal' },
        { t: 0, ball: true, moveTo: { x: 42, y: 70 }, duration: 360, type: 'clearance' },
      ],
      goal_closer: [
        { t: 0, ball: true, moveTo: { x: 50, y: 100 }, duration: 360, type: 'shot' },
        { t: 360, type: 'GOAL_EFFECT' },
      ],
      corner_won: [
        { t: 0, ball: true, moveTo: { x: 88, y: 98 }, duration: 360, type: 'shot_miss' },
      ],
      shot_blocked: [
        { t: 0, ball: true, moveTo: { x: 53, y: 86 }, duration: 260, type: 'block' },
      ],
      possession_lost: [
        { t: 0, opponent: 0, moveTo: { x: 45, y: 76 }, duration: 300, type: 'steal' },
        { t: 0, ball: true, moveTo: { x: 42, y: 72 }, duration: 300, type: 'clearance' },
      ],
      shot_created: [
        { t: 0, ball: true, moveTo: { x: 45, y: 76 }, duration: 260, type: 'safe_pass' },
      ],
      possession_maintained: [
        { t: 0, ball: true, moveTo: { x: 43, y: 74 }, duration: 260, type: 'safe_pass' },
      ],
      tackled_advance: [
        { t: 0, opponent: 0, moveTo: { x: 50, y: 82 }, duration: 260, type: 'tackle_success' },
      ],
    },
  },

  var_penalty: {
    label: 'VAR争议判罚',
    keyframes: [
      { t: 0, actor: 0, moveTo: { x: 50, y: 84 }, duration: 360 },
      { t: 240, actor: 1, moveTo: { x: 48, y: 78 }, duration: 360 },
      { t: 520, type: 'FOUL_EFFECT', x: 50, y: 82 },
      { t: 900, type: 'PAUSE_FOR_CHOICE' },
    ],
    result_animations: {
      penalty_awarded: [
        { t: 0, type: 'PENALTY_MARK', x: 50, y: 89 },
        { t: 220, type: 'FOUL_EFFECT', x: 50, y: 84 },
      ],
      play_continues: [
        { t: 0, ball: true, moveTo: { x: 42, y: 70 }, duration: 320, type: 'safe_pass' },
      ],
      possession_maintained: [
        { t: 0, actor: 1, moveTo: { x: 44, y: 74 }, duration: 320, type: 'fresh_run' },
        { t: 0, ball: true, moveTo: { x: 44, y: 74 }, duration: 320, type: 'safe_pass' },
      ],
      yellow_card_dissent: [
        { t: 0, type: 'CARD_EFFECT', color: 'yellow', actor: 0 },
      ],
      shape_held: [
        { t: 0, type: 'TEAM_PUSH_DOWN', delta_y: 8, duration: 420 },
      ],
      opponent_counter: [
        { t: 0, ball: true, moveTo: { x: 50, y: 36 }, duration: 460, type: 'counter' },
      ],
    },
  },

  // ── 防守类 ────────────────────────────────────────────────────────────────

  defend_penalty_risk: {
    label: '禁区危机',
    keyframes: [
      { t: 0, opponent: 0, moveTo: { x: 55, y: 85 }, duration: 700 },
      { t: 300, actor: 0, moveTo: { x: 60, y: 82 }, duration: 600 },
      { t: 900, type: 'PAUSE_FOR_CHOICE' },
    ],
    result_animations: {
      safe: [
        { t: 0, actor: 0, moveTo: { x: 57, y: 84 }, duration: 300, type: 'tackle_success' },
      ],
      foul: [
        { t: 0, type: 'FOUL_EFFECT', x: 57, y: 84 },
        { t: 300, type: 'PENALTY_MARK' },
      ],
      yellow_card: [
        { t: 0, type: 'CARD_EFFECT', color: 'yellow', actor: 0 },
      ],
      red_card: [
        { t: 0, type: 'CARD_EFFECT', color: 'red', actor: 0 },
      ],
    },
  },

  defend_solo_against: {
    label: '被打单刀',
    keyframes: [
      { t: 0, opponent: 0, moveTo: { x: 50, y: 82 }, duration: 800, easing: 'easeIn' },
      { t: 400, actor: 0, moveTo: { x: 50, y: 75 }, duration: 500 },
      { t: 900, type: 'PAUSE_FOR_CHOICE' },
    ],
    result_animations: {
      save: [
        { t: 0, actor: 0, moveTo: { x: 48, y: 79 }, duration: 300, type: 'save_rush' },
      ],
      goal: [
        { t: 0, opponent: 0, moveTo: { x: 50, y: 0 }, duration: 400, type: 'shot' },
        { t: 400, type: 'OPPONENT_GOAL_EFFECT' },
      ],
      counter_chance: [
        { t: 0, actor: 0, moveTo: { x: 50, y: 72 }, duration: 400, type: 'claim_ball' },
      ],
    },
  },

  defend_last_man: {
    label: '最后防线',
    keyframes: [
      { t: 0, opponent: 0, moveTo: { x: 52, y: 80 }, duration: 700 },
      { t: 200, actor: 0, moveTo: { x: 50, y: 77 }, duration: 600 },
      { t: 800, type: 'PAUSE_FOR_CHOICE' },
    ],
    result_animations: {
      safe: [
        { t: 0, actor: 0, type: 'slide_tackle', duration: 350 },
      ],
      foul: [
        { t: 0, type: 'FOUL_EFFECT', x: 51, y: 79 },
        { t: 200, type: 'CARD_EFFECT', color: 'yellow', actor: 0 },
      ],
      goal_against: [
        { t: 0, opponent: 0, moveTo: { x: 50, y: 0 }, duration: 400, type: 'shot' },
        { t: 400, type: 'OPPONENT_GOAL_EFFECT' },
      ],
    },
  },

  defend_freekick: {
    label: '防守危险任意球',
    keyframes: [
      { t: 0, opponent: 0, moveTo: { x: 50, y: 26 }, duration: 420 },
      { t: 120, actor: 0, moveTo: { x: 50, y: 6 }, duration: 360 },
      { t: 200, actor: 1, moveTo: { x: 48, y: 20 }, duration: 420 },
      { t: 300, type: 'WALL_FORM', x: 50, y: 24 },
      { t: 840, type: 'PAUSE_FOR_CHOICE' },
    ],
    result_animations: {
      wall_block: [
        { t: 0, ball: true, moveTo: { x: 50, y: 22 }, duration: 340, type: 'wall_block' },
      ],
      saved_freekick_against: [
        { t: 0, ball: true, moveTo: { x: 44, y: 3 }, duration: 420, type: 'freekick_curve' },
        { t: 0, actor: 0, moveTo: { x: 44, y: 4 }, duration: 320, type: 'save_dive' },
      ],
      keeper_save_freekick: [
        { t: 0, ball: true, moveTo: { x: 58, y: 3 }, duration: 420, type: 'freekick_curve' },
        { t: 0, actor: 0, moveTo: { x: 58, y: 4 }, duration: 320, type: 'save_dive' },
      ],
      miss_over_against: [
        { t: 0, ball: true, moveTo: { x: 55, y: -4 }, duration: 360, type: 'freekick_over' },
      ],
      opponent_goal_freekick: [
        { t: 0, ball: true, moveTo: { x: 42, y: 1 }, duration: 460, type: 'freekick_curve' },
        { t: 460, type: 'OPPONENT_GOAL_EFFECT' },
      ],
      cleared_header: [
        { t: 0, ball: true, moveTo: { x: 32, y: 28 }, duration: 360, type: 'clearance' },
      ],
      opponent_header_saved: [
        { t: 0, ball: true, moveTo: { x: 49, y: 4 }, duration: 360, type: 'header_shot' },
        { t: 0, actor: 0, moveTo: { x: 49, y: 5 }, duration: 260, type: 'claim' },
      ],
      opponent_goal_header: [
        { t: 0, ball: true, moveTo: { x: 52, y: 1 }, duration: 380, type: 'header_shot' },
        { t: 380, type: 'OPPONENT_GOAL_EFFECT' },
      ],
    },
  },

  box_chaos: {
    label: '禁区二点球混战',
    keyframes: [
      { t: 0, ball: true, moveTo: { x: 50, y: 21 }, duration: 260, type: 'loose_ball' },
      { t: 120, opponent: 0, moveTo: { x: 52, y: 22 }, duration: 420 },
      { t: 180, actor: 0, moveTo: { x: 48, y: 24 }, duration: 420 },
      { t: 760, type: 'PAUSE_FOR_CHOICE' },
    ],
    result_animations: {
      cleared_second_ball: [
        { t: 0, ball: true, moveTo: { x: 20, y: 34 }, duration: 380, type: 'clearance' },
      ],
      corner_against: [
        { t: 0, ball: true, moveTo: { x: 5, y: 2 }, duration: 380, type: 'clearance' },
      ],
      blocked_second_ball: [
        { t: 0, ball: true, moveTo: { x: 49, y: 20 }, duration: 260, type: 'block' },
      ],
      deflected_corner: [
        { t: 0, ball: true, moveTo: { x: 8, y: 4 }, duration: 360, type: 'block' },
      ],
      counter_chance: [
        { t: 0, ball: true, moveTo: { x: 52, y: 54 }, duration: 520, type: 'counter' },
        { t: 120, actor: 1, moveTo: { x: 54, y: 56 }, duration: 520, type: 'fresh_run' },
      ],
      possession_lost: [
        { t: 0, opponent: 0, moveTo: { x: 50, y: 18 }, duration: 240, type: 'steal' },
      ],
      opponent_goal_scramble: [
        { t: 0, ball: true, moveTo: { x: 50, y: 1 }, duration: 320, type: 'shot' },
        { t: 320, type: 'OPPONENT_GOAL_EFFECT' },
      ],
    },
  },

  // ── 中场类 ────────────────────────────────────────────────────────────────

  midfield_pressure: {
    label: '中场逼抢',
    keyframes: [
      { t: 0, opponent: 0, moveTo: { x: 45, y: 55 }, duration: 500 },
      { t: 200, actor: 0, moveTo: { x: 47, y: 53 }, duration: 600 },
      { t: 800, type: 'PAUSE_FOR_CHOICE' },
    ],
    result_animations: {
      intercept: [
        { t: 0, actor: 0, type: 'press_success', duration: 300 },
        { t: 300, ball: true, moveTo: { x: 'actor_x', y: 60 }, duration: 200 },
      ],
      foul: [
        { t: 0, type: 'FOUL_EFFECT', x: 46, y: 54 },
      ],
      opponent_escape: [
        { t: 0, opponent: 0, moveTo: { x: 42, y: 62 }, duration: 400, easing: 'easeOut' },
      ],
    },
  },

  tactical_foul: {
    label: '战术犯规',
    keyframes: [
      { t: 0, opponent: 0, moveTo: { x: 40, y: 65 }, duration: 500, easing: 'easeIn' },
      { t: 300, actor: 0, moveTo: { x: 42, y: 63 }, duration: 400 },
      { t: 700, type: 'PAUSE_FOR_CHOICE' },
    ],
    result_animations: {
      yellow_card: [
        { t: 0, type: 'FOUL_EFFECT', x: 41, y: 64 },
        { t: 200, type: 'CARD_EFFECT', color: 'yellow', actor: 0 },
      ],
      safe: [
        { t: 0, actor: 0, type: 'soft_foul', duration: 300 },
      ],
    },
  },

  // ── 特殊类 ────────────────────────────────────────────────────────────────

  substitution_crisis: {
    label: '换人危机',
    keyframes: [
      { t: 0, actor: 0, moveTo: { x: 100, y: 'actor_y' }, duration: 800, type: 'walk_off' },
      { t: 600, actor: 1, moveTo: { x: 'target_x', y: 'target_y' }, duration: 700, type: 'run_on' },
      { t: 1300, type: 'PAUSE_FOR_CHOICE' },
    ],
    result_animations: {
      good_impact: [
        { t: 0, actor: 1, type: 'energetic_run', duration: 500 },
      ],
      no_change: [],
    },
  },

  stamina_gamble: {
    label: '孤注一掷',
    keyframes: [
      { t: 0, type: 'TEAM_PUSH_UP', delta_y: 15, duration: 1000 },
      { t: 1000, type: 'PAUSE_FOR_CHOICE' },
    ],
    result_animations: {
      goal: [
        { t: 0, ball: true, moveTo: { x: 50, y: 100 }, duration: 400, type: 'shot' },
        { t: 400, type: 'GOAL_EFFECT' },
      ],
      counter_against: [
        { t: 0, type: 'TEAM_PUSH_DOWN', delta_y: 20, duration: 600 },
        { t: 600, type: 'OPPONENT_GOAL_EFFECT' },
      ],
    },
  },

  // ── 点球大战 ──────────────────────────────────────────────────────────────

  penalty_shootout: {
    label: '点球大战',
    keyframes: [
      { t: 0, actor: 0, moveTo: { x: 50, y: 89 }, duration: 600 },
      { t: 120, type: 'PENALTY_MARK', x: 50, y: 89 },
      { t: 600, opponent: 1, moveTo: { x: 50, y: 97 }, duration: 300 },
      { t: 900, type: 'PAUSE_FOR_CHOICE' },
    ],
    result_animations: {
      goal_placement: [
        { t: 0, ball: true, moveTo: { x: 38, y: 99 }, duration: 420, type: 'penalty_shot' },
        { t: 0, opponent: 1, moveTo: { x: 62, y: 98 }, duration: 320, type: 'dive_right' },
        { t: 420, type: 'GOAL_EFFECT' },
      ],
      saved_placement: [
        { t: 0, ball: true, moveTo: { x: 38, y: 99 }, duration: 420, type: 'penalty_shot' },
        { t: 0, opponent: 1, moveTo: { x: 38, y: 98 }, duration: 320, type: 'dive_left' },
      ],
      goal_power: [
        { t: 0, ball: true, moveTo: { x: 62, y: 99 }, duration: 360, type: 'penalty_shot' },
        { t: 0, opponent: 1, moveTo: { x: 42, y: 98 }, duration: 300, type: 'dive_left' },
        { t: 360, type: 'GOAL_EFFECT' },
      ],
      saved_power: [
        { t: 0, ball: true, moveTo: { x: 62, y: 98 }, duration: 360, type: 'penalty_shot' },
        { t: 0, opponent: 1, moveTo: { x: 62, y: 98 }, duration: 300, type: 'dive_right' },
      ],
      goal_panenka: [
        { t: 0, ball: true, moveTo: { x: 50, y: 99 }, duration: 520, type: 'penalty_shot' },
        { t: 0, opponent: 1, moveTo: { x: 62, y: 98 }, duration: 300, type: 'dive_right' },
        { t: 520, type: 'GOAL_EFFECT' },
      ],
      saved_panenka: [
        { t: 0, ball: true, moveTo: { x: 50, y: 96 }, duration: 520, type: 'penalty_shot' },
        { t: 200, opponent: 1, moveTo: { x: 50, y: 96 }, duration: 260, type: 'claim' },
      ],
      miss_panenka: [
        { t: 0, ball: true, moveTo: { x: 50, y: 103 }, duration: 420, type: 'penalty_post' },
      ],
      miss_post: [
        { t: 0, ball: true, moveTo: { x: 37, y: 97 }, duration: 420, type: 'penalty_post' },
      ],
      miss_crossbar: [
        { t: 0, ball: true, moveTo: { x: 50, y: 96 }, duration: 420, type: 'penalty_post' },
      ],
      miss_wide_power: [
        { t: 0, ball: true, moveTo: { x: 68, y: 101 }, duration: 420, type: 'penalty_post' },
      ],
      goal_left: [
        { t: 0, ball: true, moveTo: { x: 38, y: 99 }, duration: 400, type: 'penalty_shot' },
        { t: 0, opponent: 1, moveTo: { x: 62, y: 98 }, duration: 300, type: 'dive_right' },
        { t: 400, type: 'GOAL_EFFECT' },
      ],
      goal_center: [
        { t: 0, ball: true, moveTo: { x: 50, y: 99 }, duration: 400, type: 'penalty_shot' },
        { t: 400, type: 'GOAL_EFFECT' },
      ],
      goal_right: [
        { t: 0, ball: true, moveTo: { x: 62, y: 99 }, duration: 400, type: 'penalty_shot' },
        { t: 0, opponent: 1, moveTo: { x: 38, y: 98 }, duration: 300, type: 'dive_left' },
        { t: 400, type: 'GOAL_EFFECT' },
      ],
      saved_left: [
        { t: 0, ball: true, moveTo: { x: 38, y: 99 }, duration: 400, type: 'penalty_shot' },
        { t: 0, opponent: 1, moveTo: { x: 38, y: 98 }, duration: 300, type: 'dive_left' },
      ],
      saved_right: [
        { t: 0, ball: true, moveTo: { x: 62, y: 99 }, duration: 400, type: 'penalty_shot' },
        { t: 0, opponent: 1, moveTo: { x: 62, y: 98 }, duration: 300, type: 'dive_right' },
      ],
      post: [
        { t: 0, ball: true, moveTo: { x: 38, y: 97 }, duration: 400, type: 'penalty_post' },
      ],
    },
  },

  defend_opponent_penalty: {
    label: '扑救点球',
    keyframes: [
      { t: 0, opponent: 0, moveTo: { x: 50, y: 89 }, duration: 520 },
      { t: 120, type: 'PENALTY_MARK', x: 50, y: 89 },
      { t: 560, actor: 0, moveTo: { x: 50, y: 5 }, duration: 320 },
      { t: 900, type: 'PAUSE_FOR_CHOICE' },
    ],
    result_animations: {
      opponent_goal_left: [
        { t: 0, ball: true, moveTo: { x: 38, y: 1 }, duration: 420, type: 'penalty_shot' },
        { t: 0, actor: 0, moveTo: { x: 62, y: 2 }, duration: 320, type: 'dive_right' },
        { t: 420, type: 'OPPONENT_GOAL_EFFECT' },
      ],
      opponent_goal_right: [
        { t: 0, ball: true, moveTo: { x: 62, y: 1 }, duration: 420, type: 'penalty_shot' },
        { t: 0, actor: 0, moveTo: { x: 38, y: 2 }, duration: 320, type: 'dive_left' },
        { t: 420, type: 'OPPONENT_GOAL_EFFECT' },
      ],
      opponent_goal_center: [
        { t: 0, ball: true, moveTo: { x: 50, y: 1 }, duration: 420, type: 'penalty_shot' },
        { t: 0, actor: 0, moveTo: { x: 38, y: 2 }, duration: 320, type: 'dive_left' },
        { t: 420, type: 'OPPONENT_GOAL_EFFECT' },
      ],
      opponent_saved_left: [
        { t: 0, ball: true, moveTo: { x: 38, y: 3 }, duration: 420, type: 'penalty_shot' },
        { t: 0, actor: 0, moveTo: { x: 38, y: 3 }, duration: 320, type: 'dive_left' },
      ],
      opponent_saved_right: [
        { t: 0, ball: true, moveTo: { x: 62, y: 3 }, duration: 420, type: 'penalty_shot' },
        { t: 0, actor: 0, moveTo: { x: 62, y: 3 }, duration: 320, type: 'dive_right' },
      ],
      opponent_saved_center: [
        { t: 0, ball: true, moveTo: { x: 50, y: 5 }, duration: 420, type: 'penalty_shot' },
        { t: 120, actor: 0, moveTo: { x: 50, y: 5 }, duration: 260, type: 'claim' },
      ],
    },
  },
};

const ATTACK_RESULTS = {
  goal: [
    { t: 0, ball: true, moveTo: { x: 50, y: 98 }, duration: 420, type: 'shot' },
    { t: 420, type: 'GOAL_EFFECT' },
  ],
  saved: [
    { t: 0, ball: true, moveTo: { x: 48, y: 96 }, duration: 360, type: 'shot' },
    { t: 0, opponent: 1, moveTo: { x: 48, y: 94 }, duration: 320, type: 'save_dive' },
  ],
  miss: [
    { t: 0, ball: true, moveTo: { x: 64, y: 101 }, duration: 360, type: 'shot_miss' },
  ],
  safe: [
    { t: 0, ball: true, moveTo: { x: 35, y: 82 }, duration: 320, type: 'clearance' },
  ],
  goal_against: [
    { t: 0, ball: true, moveTo: { x: 50, y: 4 }, duration: 520, type: 'counter' },
    { t: 520, type: 'OPPONENT_GOAL_EFFECT' },
  ],
}

const DEFENSE_RESULTS = {
  safe: [
    { t: 0, actor: 0, moveTo: { x: 48, y: 72 }, duration: 320, type: 'block' },
    { t: 120, ball: true, moveTo: { x: 36, y: 64 }, duration: 260, type: 'clearance' },
  ],
  saved: [
    { t: 0, actor: 0, moveTo: { x: 50, y: 82 }, duration: 280, type: 'save' },
    { t: 0, ball: true, moveTo: { x: 50, y: 82 }, duration: 280, type: 'claim' },
  ],
  miss: [
    { t: 0, ball: true, moveTo: { x: 65, y: 101 }, duration: 360, type: 'shot_miss' },
  ],
  goal_against: [
    { t: 0, opponent: 0, moveTo: { x: 50, y: 15 }, duration: 360, type: 'shot' },
    { t: 0, ball: true, moveTo: { x: 50, y: 0 }, duration: 360, type: 'shot' },
    { t: 360, type: 'OPPONENT_GOAL_EFFECT' },
  ],
  yellow_card: [
    { t: 0, type: 'CARD_EFFECT', color: 'yellow', actor: 0 },
  ],
  red_card: [
    { t: 0, type: 'CARD_EFFECT', color: 'red', actor: 0 },
  ],
  foul: [
    { t: 0, type: 'FOUL_EFFECT', x: 52, y: 76 },
  ],
  intercept: [
    { t: 0, actor: 0, moveTo: { x: 48, y: 56 }, duration: 300, type: 'press_success' },
    { t: 120, ball: true, moveTo: { x: 46, y: 58 }, duration: 240, type: 'steal' },
  ],
  opponent_escape: [
    { t: 0, opponent: 0, moveTo: { x: 50, y: 78 }, duration: 420, type: 'escape' },
  ],
}

const NO_CHANGE_RESULTS = {
  good_impact: [
    { t: 0, actor: 0, moveTo: { x: 48, y: 55 }, duration: 360, type: 'fresh_run' },
  ],
  no_change: [
    { t: 0, type: 'TEAM_PUSH_UP', delta_y: 3, duration: 260 },
  ],
  safe: [
    { t: 0, type: 'TEAM_PUSH_DOWN', delta_y: 4, duration: 280 },
  ],
  miss: [
    { t: 0, ball: true, moveTo: { x: 68, y: 90 }, duration: 320, type: 'loose_ball' },
  ],
  goal: ATTACK_RESULTS.goal,
  goal_against: DEFENSE_RESULTS.goal_against,
  counter_against: DEFENSE_RESULTS.goal_against,
}

function enrichResults(type, results) {
  ANIMATION_TEMPLATES[type].result_animations = {
    ...results,
    ...ANIMATION_TEMPLATES[type].result_animations,
  }
}

ANIMATION_TEMPLATES.attack_cross = {
  label: '边路传中',
  keyframes: [
    { t: 0, actor: 0, moveTo: { x: 22, y: 76 }, duration: 520, easing: 'easeIn' },
    { t: 220, actor: 1, moveTo: { x: 50, y: 88 }, duration: 520, easing: 'easeOut' },
    { t: 520, ball: true, moveTo: { x: 50, y: 88 }, duration: 420, type: 'cross' },
    { t: 940, type: 'PAUSE_FOR_CHOICE' },
  ],
  result_animations: { ...ATTACK_RESULTS },
}

ANIMATION_TEMPLATES.attack_long_shot = {
  label: '禁区外远射',
  keyframes: [
    { t: 0, actor: 0, moveTo: { x: 50, y: 64 }, duration: 520, easing: 'easeOut' },
    { t: 520, ball: true, moveTo: { x: 50, y: 66 }, duration: 180, type: 'touch' },
    { t: 700, type: 'PAUSE_FOR_CHOICE' },
  ],
  result_animations: { ...ATTACK_RESULTS },
}

ANIMATION_TEMPLATES.attack_corner = {
  label: '角球战术',
  keyframes: [
    { t: 0, actor: 0, moveTo: { x: 8, y: 92 }, duration: 420 },
    { t: 120, actor: 1, moveTo: { x: 56, y: 88 }, duration: 520 },
    { t: 560, ball: true, moveTo: { x: 56, y: 88 }, duration: 480, type: 'cross' },
    { t: 1040, type: 'PAUSE_FOR_CHOICE' },
  ],
  result_animations: { ...ATTACK_RESULTS },
}

ANIMATION_TEMPLATES.attack_through_ball = {
  label: '直塞身后',
  keyframes: [
    { t: 0, actor: 0, moveTo: { x: 48, y: 58 }, duration: 360 },
    { t: 120, actor: 1, moveTo: { x: 52, y: 78 }, duration: 620, easing: 'easeIn' },
    { t: 360, ball: true, moveTo: { x: 52, y: 78 }, duration: 420, type: 'through' },
    { t: 780, type: 'PAUSE_FOR_CHOICE' },
  ],
  result_animations: { ...ATTACK_RESULTS },
}

ANIMATION_TEMPLATES.defend_gk_rush = {
  ...ANIMATION_TEMPLATES.defend_solo_against,
  label: '门将单刀',
}

ANIMATION_TEMPLATES.midfield_press = {
  ...ANIMATION_TEMPLATES.midfield_pressure,
  label: '中场高压',
}

ANIMATION_TEMPLATES.defend_corner = {
  label: '角球防守',
  keyframes: [
    { t: 0, opponent: 0, moveTo: { x: 18, y: 92 }, duration: 420 },
    { t: 120, actor: 0, moveTo: { x: 52, y: 84 }, duration: 420 },
    { t: 520, ball: true, moveTo: { x: 52, y: 84 }, duration: 440, type: 'cross' },
    { t: 960, type: 'PAUSE_FOR_CHOICE' },
  ],
  result_animations: { ...DEFENSE_RESULTS },
}

ANIMATION_TEMPLATES.defend_offside = {
  label: '越位陷阱',
  keyframes: [
    { t: 0, opponent: 0, moveTo: { x: 48, y: 62 }, duration: 420 },
    { t: 120, type: 'TEAM_PUSH_UP', delta_y: -8, duration: 520 },
    { t: 520, ball: true, moveTo: { x: 50, y: 82 }, duration: 460, type: 'through' },
    { t: 980, type: 'PAUSE_FOR_CHOICE' },
  ],
  result_animations: { ...DEFENSE_RESULTS },
}

ANIMATION_TEMPLATES.substitution = {
  label: '体能换人',
  keyframes: [
    { t: 0, actor: 0, moveTo: { x: 6, y: 'actor_y' }, duration: 620, type: 'walk_off' },
    { t: 620, type: 'PAUSE_FOR_CHOICE' },
  ],
  result_animations: { ...NO_CHANGE_RESULTS },
}

ANIMATION_TEMPLATES.tactical_all_out = {
  label: '最后猛攻',
  keyframes: [
    { t: 0, type: 'TEAM_PUSH_UP', delta_y: 18, duration: 900 },
    { t: 500, ball: true, moveTo: { x: 50, y: 82 }, duration: 420, type: 'direct' },
    { t: 920, type: 'PAUSE_FOR_CHOICE' },
  ],
  result_animations: { ...NO_CHANGE_RESULTS },
}

ANIMATION_TEMPLATES.tactical_time_waste = {
  label: '控球守胜',
  keyframes: [
    { t: 0, type: 'TEAM_PUSH_DOWN', delta_y: 10, duration: 700 },
    { t: 420, ball: true, moveTo: { x: 35, y: 48 }, duration: 380, type: 'safe_pass' },
    { t: 820, type: 'PAUSE_FOR_CHOICE' },
  ],
  result_animations: { ...NO_CHANGE_RESULTS },
}

ANIMATION_TEMPLATES.tactical_penalty_prep = {
  label: '加时决断',
  keyframes: [
    { t: 0, type: 'TEAM_PUSH_UP', delta_y: 8, duration: 500 },
    { t: 500, actor: 0, moveTo: { x: 50, y: 72 }, duration: 420 },
    { t: 920, type: 'PAUSE_FOR_CHOICE' },
  ],
  result_animations: { ...NO_CHANGE_RESULTS },
}

Object.keys(ANIMATION_TEMPLATES).forEach((type) => {
  if (type.startsWith('attack_') || type === 'penalty_shootout') enrichResults(type, ATTACK_RESULTS)
  if (type.startsWith('defend_') || type === 'midfield_pressure' || type === 'midfield_press' || type === 'tactical_foul') enrichResults(type, DEFENSE_RESULTS)
})
