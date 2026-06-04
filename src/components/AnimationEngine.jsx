import React, { useRef, useEffect, useCallback, useImperativeHandle, forwardRef, useState } from 'react';
import { FORMATION_POSITIONS } from '../utils/formationPositions';
import { ANIMATION_TEMPLATES } from '../utils/animationTemplates';
import { BALL_ASSET_SRC, getResultAnimationKey } from '../utils/animationResultMapper';
import { BALL_ZONES, createAmbientTargets } from '../utils/matchVisuals.js';

/**
 * AnimationEngine — 像素风Canvas动画引擎
 * 使用足球场.png作为背景，渲染22名球员+球
 */
const AnimationEngine = forwardRef(({
  myLineup = [],
  opponentLineup = [],
  formation = '4-3-3',
  width = 360,
  height = 500,
  ambientEnabled = true,
  onGoalEffect,
  onOpponentGoalEffect,
  onSaveEffect,
}, ref) => {
  const canvasRef = useRef(null);
  const fieldImgRef = useRef(null);
  const ballImgRef = useRef(null);
  const [fieldImgLoaded, setFieldImgLoaded] = useState(false);
  const [ballImgLoaded, setBallImgLoaded] = useState(false);

  const stateRef = useRef({
    playerPositions: {},
    ballPosition: { x: 50, y: 50 },
    animating: false,
    effects: [],
    lockedPlayers: new Set(),
    ballZone: 'midfield',
    ballOwnerName: null,
    possessionTeam: 'my',
    lastAmbientSwitch: 0,
    ambientPhase: 0,
    _lastFreekickX: 50,
    _lastFreekickY: 75,
  });

  // 加载像素球场图片
  useEffect(() => {
    const img = new Image();
    img.src = '/assets/足球场.png';
    img.onload = () => {
      fieldImgRef.current = img;
      setFieldImgLoaded(true);
    };
    img.onerror = () => {
      console.warn('球场图片加载失败，使用纯色背景');
      setFieldImgLoaded(true);
    };
  }, []);

  useEffect(() => {
    const img = new Image();
    img.src = BALL_ASSET_SRC;
    img.onload = () => {
      ballImgRef.current = img;
      setBallImgLoaded(true);
    };
    img.onerror = () => {
      console.warn('足球图片加载失败，使用像素点备用');
      setBallImgLoaded(true);
    };
  }, []);

  // 坐标转换：百分比 → 像素（球场内区域）
  const toPixel = useCallback((x, y) => {
    // 球场图片的实际绘制区域（留边距给像素边框）
    const offsetX = width * 0.04;
    const offsetY = height * 0.03;
    const fieldW = width - offsetX * 2;
    const fieldH = height - offsetY * 2;
    return {
      px: offsetX + (x / 100) * fieldW,
      py: offsetY + (y / 100) * fieldH,
    };
  }, [width, height]);

  // 初始化球员位置
  const initPositions = useCallback(() => {
    const posMap = FORMATION_POSITIONS[formation] || FORMATION_POSITIONS['4-3-3'];
    const positions = {};
    const posCounts = { GK: 0, DF: 0, MF: 0, FW: 0 };

    myLineup.forEach((player) => {
      const pos = player.pos || player.position;
      const idx = posCounts[pos] || 0;
      const slots = posMap[pos];
      if (slots && slots[idx]) {
        positions[player.name] = {
          x: slots[idx][0],
          y: slots[idx][1],
          anchorX: slots[idx][0],
          anchorY: slots[idx][1],
          position: pos,
          team: 'my',
        };
      }
      posCounts[pos] = (posCounts[pos] || 0) + 1;
    });

    const oppPosCounts = { GK: 0, DF: 0, MF: 0, FW: 0 };
    opponentLineup.forEach((player) => {
      const pos = player.pos || player.position;
      const idx = oppPosCounts[pos] || 0;
      const slots = posMap[pos];
      if (slots && slots[idx]) {
        positions['opp_' + player.name] = {
          x: 100 - slots[idx][0],
          y: 100 - slots[idx][1],
          anchorX: 100 - slots[idx][0],
          anchorY: 100 - slots[idx][1],
          position: pos,
          team: 'opponent',
        };
      }
      oppPosCounts[pos] = (oppPosCounts[pos] || 0) + 1;
    });

    stateRef.current.playerPositions = positions;
    stateRef.current.ballPosition = { x: 50, y: 50 };
    stateRef.current.ballOwnerName = null;
    stateRef.current.ballZone = 'midfield';
  }, [myLineup, opponentLineup, formation]);

  // 缓动
  const ease = useCallback((t, type) => {
    switch (type) {
      case 'easeIn': return t * t;
      case 'easeOut': return t * (2 - t);
      case 'easeInOut': return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      case 'linear': return t;
      default: return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }
  }, []);

  // 移动球员
  const movePlayer = useCallback((name, target, duration, easing = 'easeInOut') => {
    return new Promise((resolve) => {
      const state = stateRef.current;
      const start = { ...state.playerPositions[name] };
      if (!start || start.x === undefined) { resolve(); return; }
      state.lockedPlayers.add(name);
      const startTime = performance.now();
      const tick = (now) => {
        const elapsed = now - startTime;
        const t = Math.min(elapsed / duration, 1);
        const et = ease(t, easing);
        state.playerPositions[name] = {
          ...state.playerPositions[name],
          x: start.x + (target.x - start.x) * et,
          y: start.y + (target.y - start.y) * et,
        };
        if (t < 1) requestAnimationFrame(tick);
        else {
          state.playerPositions[name].x = target.x;
          state.playerPositions[name].y = target.y;
          window.setTimeout(() => state.lockedPlayers.delete(name), 160);
          resolve();
        }
      };
      requestAnimationFrame(tick);
    });
  }, [ease]);

  // 移动球
  const moveBall = useCallback((target, duration, type = 'pass') => {
    return new Promise((resolve) => {
      const state = stateRef.current;
      const start = { ...state.ballPosition };
      const startTime = performance.now();
      const tick = (now) => {
        const elapsed = now - startTime;
        const t = Math.min(elapsed / duration, 1);
        const et = ease(t, type === 'shot' ? 'easeIn' : 'easeInOut');
        let arcOffset = 0;
        if (type === 'pass' || type === 'cross' || type === 'freekick_curve') {
          arcOffset = Math.sin(t * Math.PI) * 3;
        }
        state.ballPosition = {
          x: start.x + (target.x - start.x) * et + arcOffset,
          y: start.y + (target.y - start.y) * et,
        };
        if (t < 1) requestAnimationFrame(tick);
        else {
          state.ballPosition = { x: target.x, y: target.y };
          resolve();
        }
      };
      requestAnimationFrame(tick);
    });
  }, [ease]);

  const getMyActor = useCallback((actors, index = 0) => {
    return actors?.my?.[index] || actors?.[index] || null;
  }, []);

  const getOpponentActor = useCallback((actors, index = 0) => {
    return actors?.opponent?.[index] || actors?.[index] || null;
  }, []);

  const getFrameTargetName = useCallback((frame, actors) => {
    if (frame.actor !== undefined) return getMyActor(actors, frame.actor)?.name || null;
    if (frame.opponent !== undefined) {
      const opponent = getOpponentActor(actors, frame.opponent);
      return opponent ? 'opp_' + opponent.name : null;
    }
    return null;
  }, [getMyActor, getOpponentActor]);

  // 解析目标坐标
  const resolveTarget = useCallback((moveTo, actorName, actors) => {
    const state = stateRef.current;
    const myActor0 = getMyActor(actors, 0);
    const myActor1 = getMyActor(actors, 1);
    if (typeof moveTo === 'object' && moveTo !== null) {
      let x = moveTo.x, y = moveTo.y;
      if (x === 'actor_x' && actorName) x = state.playerPositions[actorName]?.x ?? 50;
      if (y === 'actor_y' && actorName) y = state.playerPositions[actorName]?.y ?? 50;
      if (typeof x === 'string' && x.startsWith('actor_x+')) {
        x = (state.playerPositions[actorName]?.x ?? 50) + parseFloat(x.split('+')[1]);
      }
      if (x === 'actor0_x' && myActor0) x = state.playerPositions[myActor0.name]?.x ?? 50;
      if (x === 'actor1_x' && myActor1) x = state.playerPositions[myActor1.name]?.x ?? 50;
      if (x === 'target_x') x = state.playerPositions[myActor1?.name]?.x ?? 50;
      if (x === 'fk_x') x = state._lastFreekickX ?? 50;
      if (y === 'fk_y') y = state._lastFreekickY ?? 75;
      if (y === 'actor1_y' && myActor1) y = state.playerPositions[myActor1.name]?.y ?? 50;
      if (y === 'target_y') y = state.playerPositions[myActor1?.name]?.y ?? 50;
      if (typeof y === 'string' && y.startsWith('fk_y+')) {
        y = (state._lastFreekickY ?? 75) + parseFloat(y.split('+')[1]);
      }
      return { x: Number(x), y: Number(y) };
    }
    if (moveTo === 'penalty_area_edge') return { x: state.playerPositions[actorName]?.x ?? 50, y: 80 };
    if (moveTo === 'gk_rush') return { x: 50, y: 85 };
    if (moveTo === 'penalty_area_center') return { x: state.playerPositions[actorName]?.x ?? 50, y: 88 };
    return { x: 50, y: 50 };
  }, [getMyActor]);

  const playTeamShift = useCallback(async (frame) => {
    const state = stateRef.current;
    const direction = frame.type === 'TEAM_PUSH_UP' ? 1 : -1;
    const delta = frame.delta_y * direction;
    const promises = Object.entries(state.playerPositions)
      .filter(([, pos]) => pos.team === 'my')
      .map(([name, pos]) => movePlayer(name, {
        x: pos.x,
        y: Math.max(5, Math.min(95, pos.y + delta)),
      }, frame.duration, 'easeInOut'));
    await Promise.all(promises);
  }, [movePlayer]);

  const addEffect = useCallback((effect) => {
    stateRef.current.effects.push({ ...effect, startTime: performance.now() });
  }, []);

  const playGoalEffect = useCallback(async (isOpponent) => {
    if (isOpponent) onOpponentGoalEffect?.();
    else onGoalEffect?.();
    addEffect({ type: 'goal', text: isOpponent ? '失球！' : '进球！', color: isOpponent ? '#B34235' : '#C99A2E', duration: 1500 });
    await new Promise((r) => setTimeout(r, 1600));
  }, [addEffect, onGoalEffect, onOpponentGoalEffect]);

  const playSaveEffect = useCallback((x = 50, y = 94) => {
    onSaveEffect?.();
    addEffect({ type: 'save', x, y, duration: 900 });
  }, [addEffect, onSaveEffect]);

  const playCardEffect = useCallback(async (color) => {
    addEffect({ type: 'card', color, duration: 1200 });
    await new Promise((r) => setTimeout(r, 1300));
  }, [addEffect]);

  const playFoulEffect = useCallback(async (x, y) => {
    addEffect({ type: 'foul', x, y, duration: 600 });
    await new Promise((r) => setTimeout(r, 700));
  }, [addEffect]);

  const playSpecialFrame = useCallback(async (frame, actors) => {
    if (frame.type === 'WALL_FORM') {
      const target = resolveTarget({ x: frame.x, y: frame.y }, null, actors);
      addEffect({ type: 'wall', x: target.x, y: target.y, duration: 1400 });
      await new Promise((r) => setTimeout(r, 160));
      return true;
    }
    if (frame.type === 'PENALTY_MARK') {
      addEffect({ type: 'penalty_mark', x: frame.x ?? 50, y: frame.y ?? 89, duration: 1300 });
      await new Promise((r) => setTimeout(r, 120));
      return true;
    }
    return false;
  }, [addEffect, resolveTarget]);

  const tickAmbient = useCallback((now) => {
    const state = stateRef.current;
    if (!ambientEnabled) return;
    state.ambientPhase = now / 900;
    if (!state.animating && now - state.lastAmbientSwitch > 1400) {
      const zones = ['buildup', 'midfield', 'left_attack', 'right_attack', 'box', 'defend'];
      const nextIndex = (zones.indexOf(state.ballZone) + 1 + Math.floor(now / 1400)) % zones.length;
      state.ballZone = zones[nextIndex] || 'midfield';
      state.lastAmbientSwitch = now;
      state.ballOwnerName = null;
    }

    const targets = createAmbientTargets({
      playerPositions: state.playerPositions,
      ballZone: state.ballZone,
      phase: state.ambientPhase,
    });

    Object.entries(targets).forEach(([name, target]) => {
      if (state.lockedPlayers.has(name)) return;
      const pos = state.playerPositions[name];
      if (!pos) return;
      pos.x += (target.x - pos.x) * 0.018;
      pos.y += (target.y - pos.y) * 0.018;
    });

    if (!state.animating) {
      const owner = state.ballOwnerName ? state.playerPositions[state.ballOwnerName] : null;
      const zoneTarget = BALL_ZONES[state.ballZone] || BALL_ZONES.midfield;
      const target = owner ? { x: owner.x, y: owner.y + (owner.team === 'my' ? 1.8 : -1.8) } : zoneTarget;
      state.ballPosition.x += (target.x - state.ballPosition.x) * 0.05;
      state.ballPosition.y += (target.y - state.ballPosition.y) * 0.05;
    }
  }, [ambientEnabled]);

  const playAmbientEvent = useCallback(async (event) => {
    if (!event) return;
    const state = stateRef.current;
    const actorName = event.actorName;
    const supportName = event.supportName;
    const opponentName = event.opponentName;
    state.ballZone = event.ballZone || 'midfield';
    state.ballOwnerName = actorName || state.ballOwnerName;
    state.possessionTeam = event.teamSide || 'my';

    const actor = actorName ? state.playerPositions[actorName] : null;
    const support = supportName ? state.playerPositions[supportName] : null;
    const opponent = opponentName ? state.playerPositions[opponentName] : null;
    const dir = event.teamSide === 'opponent' ? -1 : 1;
    const promises = [];

    if (actor) {
      const forward = Math.max(6, Math.min(94, actor.y + dir * 5));
      promises.push(moveBall({ x: actor.x, y: actor.y + (actor.team === 'my' ? 1.8 : -1.8) }, 320, 'pass'));
      promises.push(movePlayer(actorName, { x: actor.x + (event.visualKind === 'cross' ? 8 : 2), y: forward }, 360, 'easeOut'));
    }
    if (support) {
      promises.push(movePlayer(supportName, {
        x: Math.max(6, Math.min(94, support.x + (event.visualKind === 'cross' ? 10 : 4))),
        y: Math.max(6, Math.min(94, support.y + dir * 6)),
      }, 420, 'easeInOut'));
    }
    if (opponent) {
      promises.push(movePlayer(opponentName, {
        x: Math.max(6, Math.min(94, opponent.x + (actor?.x ? (actor.x - opponent.x) * 0.35 : 0))),
        y: Math.max(6, Math.min(94, opponent.y + (actor?.y ? (actor.y - opponent.y) * 0.35 : 0))),
      }, 380, 'easeInOut'));
    }

    const zoneTarget = BALL_ZONES[event.ballZone] || BALL_ZONES.midfield;
    if (['pass', 'through', 'cross', 'corner', 'throw_in'].includes(event.visualKind) && support) {
      promises.push(moveBall({ x: support.x, y: support.y }, 360, event.visualKind === 'cross' || event.visualKind === 'corner' ? 'cross' : 'pass'));
      state.ballOwnerName = supportName;
    } else if (['foul', 'yellow_card', 'red_card', 'injury'].includes(event.visualKind)) {
      addEffect({ type: 'foul', x: actor?.x || zoneTarget.x, y: actor?.y || zoneTarget.y, duration: 700 });
    } else if (['goal_kick', 'gk_save'].includes(event.visualKind)) {
      promises.push(moveBall({ x: 50, y: event.teamSide === 'opponent' ? 72 : 28 }, 420, 'clearance'));
    } else {
      promises.push(moveBall(zoneTarget, 380, 'pass'));
    }

    await Promise.all(promises);
  }, [addEffect, moveBall, movePlayer]);

  const bridgeToDecisionActor = useCallback(async (actors) => {
    const state = stateRef.current;
    const primaryName = actors?.canvas?.myPrimary || getMyActor(actors, 0)?.name;
    const secondaryName = actors?.canvas?.mySecond || getMyActor(actors, 1)?.name;
    const opponentName = actors?.canvas?.opponentPrimary;
    const primary = primaryName ? state.playerPositions[primaryName] : null;
    if (!primary) return;

    state.animating = true;
    state.ballZone = primary.position === 'GK' ? 'defend' : primary.y > 62 ? 'box' : 'midfield';
    state.ballOwnerName = primaryName;
    const actions = [
      moveBall({ x: primary.x, y: primary.y + (primary.team === 'my' ? 1.8 : -1.8) }, 520, 'pass'),
    ];

    const secondary = secondaryName ? state.playerPositions[secondaryName] : null;
    if (secondary && secondaryName !== primaryName) {
      actions.push(movePlayer(secondaryName, {
        x: Math.max(6, Math.min(94, primary.x + (secondary.x <= primary.x ? -8 : 8))),
        y: Math.max(6, Math.min(94, primary.y - 8)),
      }, 520, 'easeInOut'));
    }

    const opponent = opponentName ? state.playerPositions[opponentName] : null;
    if (opponent) {
      actions.push(movePlayer(opponentName, {
        x: Math.max(6, Math.min(94, primary.x + (opponent.x <= primary.x ? -7 : 7))),
        y: Math.max(6, Math.min(94, primary.y + 7)),
      }, 520, 'easeInOut'));
    }

    await Promise.all(actions);
  }, [getMyActor, moveBall, movePlayer]);

  const sleep = useCallback((ms) => new Promise((r) => setTimeout(r, ms)), []);

  const runFrame = useCallback(async (frame, actors) => {
      if (frame.type === 'GOAL_EFFECT') { await playGoalEffect(false); return; }
      if (frame.type === 'OPPONENT_GOAL_EFFECT') { await playGoalEffect(true); return; }
      if (frame.type === 'CARD_EFFECT') { await playCardEffect(frame.color); return; }
      if (frame.type === 'FOUL_EFFECT') { await playFoulEffect(frame.x, frame.y); return; }
      if (frame.type === 'TEAM_PUSH_UP' || frame.type === 'TEAM_PUSH_DOWN') { await playTeamShift(frame); return; }
      if (await playSpecialFrame(frame, actors)) return;

      const targetName = getFrameTargetName(frame, actors);
      const actorName = frame.actor !== undefined ? targetName : null;
      const actions = [];
      if (targetName && frame.moveTo) {
        const target = resolveTarget(frame.moveTo, actorName, actors);
        actions.push(movePlayer(targetName, target, frame.duration, frame.easing || 'easeOut'));
      }
      if (frame.ball && frame.moveTo) {
        const target = resolveTarget(frame.moveTo, null, actors);
        actions.push(moveBall(target, frame.duration, frame.type));
      }
      await Promise.all(actions);
  }, [getFrameTargetName, moveBall, movePlayer, playCardEffect, playFoulEffect, playGoalEffect, playSpecialFrame, playTeamShift, resolveTarget]);

  const runTimeline = useCallback(async (frames, actors, { stopOnChoice = false } = {}) => {
    const state = stateRef.current;
    state.animating = true;
    const pauseFrame = stopOnChoice ? frames.find((frame) => frame.type === 'PAUSE_FOR_CHOICE') : null;
    const pauseAt = pauseFrame ? (pauseFrame.t || 0) : null;
    const playableFrames = pauseAt === null ? frames : frames.filter((frame) => frame.type !== 'PAUSE_FOR_CHOICE' && (frame.t || 0) < pauseAt);
    const tasks = playableFrames.map(async (frame) => {
      if (frame.t > 0) await sleep(frame.t);
      await runFrame(frame, actors);
    });
    if (pauseAt !== null) tasks.push(sleep(pauseAt));
    await Promise.all(tasks);
    state.animating = false;
  }, [runFrame, sleep]);

  // 播放事件动画
  const playEvent = useCallback(async (eventType, actors) => {
    const template = ANIMATION_TEMPLATES[eventType];
    if (!template) return;
    await bridgeToDecisionActor(actors);
    await runTimeline(template.keyframes, actors, { stopOnChoice: true });
  }, [bridgeToDecisionActor, runTimeline]);

  // 播放结果动画
  const playResult = useCallback(async (eventType, resultKey, actors) => {
    const template = ANIMATION_TEMPLATES[eventType];
    const normalizedKey = getResultAnimationKey(eventType, resultKey);
    const frames = normalizedKey ? template?.result_animations?.[normalizedKey] : null;
    if (!frames) return;
    if (normalizedKey.includes('save') || normalizedKey.includes('saved') || normalizedKey.includes('claim')) {
      window.setTimeout(() => playSaveEffect(50, 94), 280);
    }
    await runTimeline(frames, actors);
  }, [playSaveEffect, runTimeline]);

  const resetPositions = useCallback(() => { initPositions(); }, [initPositions]);

  useImperativeHandle(ref, () => ({
    playEvent, playResult, playAmbientEvent, resetPositions, getState: () => stateRef.current,
  }), [playEvent, playResult, playAmbientEvent, resetPositions]);

  useEffect(() => { initPositions(); }, [initPositions]);

  // 渲染主循环
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;

    const draw = () => {
      const state = stateRef.current;
      const W = width;
      const H = height;
      const now = performance.now();
      tickAmbient(now);

      ctx.clearRect(0, 0, W, H);

      // ── 绘制像素球场背景 ──
      if (fieldImgRef.current) {
        ctx.drawImage(fieldImgRef.current, 0, 0, W, H);
      } else {
        // 备用纯色背景
        ctx.fillStyle = '#2d5a27';
        ctx.fillRect(0, 0, W, H);
        // 简单线条
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(W * 0.04, H * 0.03, W * 0.92, H * 0.94);
        ctx.beginPath();
        ctx.moveTo(W * 0.04, H * 0.5);
        ctx.lineTo(W * 0.96, H * 0.5);
        ctx.stroke();
      }

      // ── 绘制22名球员 ──
      Object.entries(state.playerPositions).forEach(([name, pos]) => {
        const pix = toPixel(pos.x, pos.y);
        const isMyTeam = pos.team === 'my';
        const player = isMyTeam
          ? myLineup.find((p) => p.name === name)
          : opponentLineup.find((p) => 'opp_' + p.name === name);

        const r = Math.max(10, W * 0.038); // 响应式半径

        ctx.save();

        // 阴影
        ctx.beginPath();
        ctx.arc(pix.px + 1, pix.py + 1, r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fill();

        // 球员圆圈
        ctx.beginPath();
        ctx.arc(pix.px, pix.py, r, 0, Math.PI * 2);
        if (isMyTeam) {
          ctx.fillStyle = '#1B3764'; // 深蓝（我方）
        } else {
          ctx.fillStyle = '#B34235'; // 红色（对方）
        }
        ctx.fill();
        ctx.strokeStyle = '#C99A2E'; // 金色边框
        ctx.lineWidth = 2;
        ctx.stroke();

        // 号码（如果没设置，根据位置生成默认号码）
        const defaultNumber = pos === 'GK' ? 1 : pos === 'DF' ? 4 : pos === 'MF' ? 8 : 9;
        const number = player?.number ?? defaultNumber;
        if (number) {
          ctx.fillStyle = isMyTeam ? '#F3E3B4' : '#F3E3B4';
          ctx.font = `bold ${Math.floor(r * 1.1)}px Zpix, monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(number), pix.px, pix.py);
        }

        ctx.restore();
      });

      // ── 绘制足球：放在球员之后，确保比赛中永远显示在最上层 ──
      const bp = toPixel(state.ballPosition.x, state.ballPosition.y);
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      const ballSize = Math.max(14, W * 0.048);
      if (ballImgRef.current) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(ballImgRef.current, bp.px - ballSize / 2, bp.py - ballSize / 2, ballSize, ballSize);
      } else {
        ctx.fillStyle = '#C99A2E';
        ctx.fillRect(bp.px - 4, bp.py - 4, 8, 8);
        ctx.strokeStyle = '#1B3764';
        ctx.strokeRect(bp.px - 4, bp.py - 4, 8, 8);
      }
      ctx.restore();

      // ── 绘制特效 ──
      state.effects = state.effects.filter((eff) => now - eff.startTime < eff.duration);

      state.effects.forEach((eff) => {
        const elapsed = now - eff.startTime;
        const progress = elapsed / eff.duration;

        if (eff.type === 'goal') {
          const alpha = progress < 0.3 ? progress / 0.3 : progress < 0.7 ? 1 : (1 - progress) / 0.3;
          ctx.save();
          ctx.globalAlpha = Math.max(0, alpha);
          // 半透明遮罩
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          ctx.fillRect(0, H * 0.35, W, H * 0.3);
          // 文字
          ctx.fillStyle = eff.color;
          ctx.font = `bold ${Math.floor(W * 0.12)}px Zpix, monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(eff.text, W / 2, H / 2);
          ctx.restore();
        }

        if (eff.type === 'card') {
          const alpha = elapsed < 800 ? 1 : Math.max(0, 1 - (elapsed - 800) / 400);
          ctx.save();
          ctx.globalAlpha = alpha;
          const cardW = W * 0.08, cardH = cardW * 1.4;
          ctx.fillStyle = eff.color === 'yellow' ? '#ffdd00' : '#ff2222';
          ctx.fillRect(W / 2 - cardW / 2, H / 2 - cardH / 2, cardW, cardH);
          ctx.strokeStyle = '#333';
          ctx.lineWidth = 2;
          ctx.strokeRect(W / 2 - cardW / 2, H / 2 - cardH / 2, cardW, cardH);
          ctx.restore();
        }

        if (eff.type === 'foul') {
          const alpha = Math.max(0, 1 - progress);
          const fp = toPixel(eff.x, eff.y);
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.fillStyle = '#ff8800';
          ctx.font = `bold ${Math.floor(W * 0.06)}px Zpix, monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('犯规！', fp.px, fp.py - 30 * progress);
          ctx.restore();
        }

        if (eff.type === 'save') {
          const alpha = Math.max(0, 1 - progress);
          const sp = toPixel(eff.x, eff.y);
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.fillStyle = '#F3E3B4';
          ctx.strokeStyle = '#1B3764';
          ctx.lineWidth = 3;
          ctx.font = `bold ${Math.floor(W * 0.07)}px Zpix, monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.strokeText('扑出！', sp.px, sp.py - 24 * progress);
          ctx.fillText('扑出！', sp.px, sp.py - 24 * progress);
          ctx.restore();
        }

        if (eff.type === 'wall') {
          const wp = toPixel(eff.x, eff.y);
          ctx.save();
          ctx.globalAlpha = Math.max(0, 1 - progress * 0.35);
          for (let i = -2; i <= 2; i++) {
            ctx.fillStyle = '#B34235';
            ctx.fillRect(wp.px + i * 9 - 4, wp.py - 9, 8, 18);
            ctx.strokeStyle = '#1B3764';
            ctx.lineWidth = 2;
            ctx.strokeRect(wp.px + i * 9 - 4, wp.py - 9, 8, 18);
          }
          ctx.restore();
        }

        if (eff.type === 'penalty_mark') {
          const pp = toPixel(eff.x, eff.y);
          ctx.save();
          ctx.globalAlpha = Math.max(0, 1 - progress * 0.4);
          ctx.fillStyle = '#C99A2E';
          ctx.fillRect(pp.px - 5, pp.py - 5, 10, 10);
          ctx.strokeStyle = '#1B3764';
          ctx.lineWidth = 2;
          ctx.strokeRect(pp.px - 5, pp.py - 5, 10, 10);
          ctx.restore();
        }
      });

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animId);
  }, [width, height, myLineup, opponentLineup, toPixel, fieldImgLoaded, ballImgLoaded, tickAmbient]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        display: 'block',
        margin: '0 auto',
        imageRendering: 'pixelated',
      }}
    />
  );
});

AnimationEngine.displayName = 'AnimationEngine';
export default AnimationEngine;
