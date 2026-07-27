(function () {
  "use strict";

  function dispatch(name, detail) {
    try { window.dispatchEvent(new CustomEvent(name, { detail: detail })); } catch {}
  }

  function clamp(value, min, max) {
    return Math.max(min == null ? 0 : min, Math.min(max == null ? 1 : max, Number(value) || 0));
  }

  function installDecisionDirector(options) {
    var stadium = options && options.stadium,
      pitch = options && options.pitch,
      runtime = options && options.runtime,
      playTrack3 = options && options.playTrack3,
      actorEntries = stadium && stadium._happySeedActorEntries || [];
    if (!stadium || !pitch || !runtime || !playTrack3 ||
      stadium._decisionDirectorV3Init || actorEntries.length !== 22) return !1;

    stadium._decisionDirectorV3Init = !0;
    try {
      var Pixi = runtime("pixi"),
        playerGlobals = runtime("players/global"),
        overlay = new Pixi.Container(),
        affordanceLayer = new Pixi.Container(),
        active = null,
        frameHandle = null,
        state = {
          ready: !0,
          phase: "idle",
          scenarioId: null,
          selectedChoiceId: null,
          hoveredChoiceId: null,
          outcome: null,
          choiceLocked: !1,
          performedActions: {},
          settleCount: 0,
          blackoutVisible: !1,
          transitionMode: null,
          ballPosition: null,
          continuationReady: !1,
        };
      overlay.addChild(affordanceLayer);
      stadium.bottomLayer.addChild(overlay);

      var blackout = document.querySelector(".decision-blackout-v3");
      if (!blackout) {
        blackout = document.createElement("div");
        blackout.className = "decision-blackout-v3";
        blackout.setAttribute("aria-hidden", "true");
        document.body.appendChild(blackout);
      }

      function projectionPoint(point) {
        var bounds = window.__happySeedPixelStadiumConfig.pitchBounds;
        return {
          x: bounds.x + point[0] * bounds.width,
          y: bounds.y + point[1] * bounds.height - (point[2] || 0) * 46,
        };
      }

      function worldPoint(point) {
        return {
          x: pitch.width * point[0],
          y: pitch.height * point[1],
          z: Math.max(.12, point[2] || 0),
        };
      }

      function snapshot() {
        return {
          ready: state.ready,
          schemaVersion: "decision-director-v3",
          phase: state.phase,
          scenarioId: state.scenarioId,
          selectedChoiceId: state.selectedChoiceId,
          hoveredChoiceId: state.hoveredChoiceId,
          outcome: state.outcome,
          choiceLocked: state.choiceLocked,
          performedActions: Object.assign({}, state.performedActions),
          settleCount: state.settleCount,
          blackoutVisible: state.blackoutVisible,
          transitionMode: state.transitionMode,
          runtimeMomentSource: active && active.script.runtimeMoment.source || null,
          sourceEventId: active && active.script.sourceEvent && active.script.sourceEvent.id || null,
          ballOrigin: active && active.script.ball.normalized || null,
          ballPosition: state.ballPosition && {
            x: state.ballPosition.x,
            y: state.ballPosition.y,
            z: state.ballPosition.z,
          },
          continuationReady: state.continuationReady,
          livePhysics: Boolean(active && active.livePhysics),
          visibleChoiceIds: active ? active.script.choices.map(function (choice) { return choice.id; }) : [],
          choiceKinds: active ? Object.fromEntries(active.script.choices.map(function (choice) {
            return [choice.id, choice.affordances.map(function (affordance) { return affordance.kind; })];
          })) : {},
          choiceHitZones: active ? active.views.map(function (view) {
            var center = affordanceLayer.toGlobal(new Pixi.Point(view.anchor.x, view.anchor.y));
            return {
              id: view.id,
              centerX: center.x,
              centerY: center.y,
              x: center.x - 120,
              y: center.y - 52,
              width: 240,
              height: 104,
            };
          }) : [],
        };
      }

      function emit(name, extra) {
        dispatch(name, Object.assign({ snapshot: snapshot() }, extra || {}));
      }

      function setPhase(phase) {
        state.phase = phase;
        emit("ab-decision-director-phase", { phase: phase, version: 3 });
      }

      function entryFor(runtimeActorId) {
        for (var index = 0; index < actorEntries.length; index += 1)
          if (actorEntries[index].actor.runtimeActorId === runtimeActorId) return actorEntries[index];
        return null;
      }

      function pixelPoint(point) {
        var projected = projectionPoint(point);
        return { x: Math.round(projected.x / 4) * 4, y: Math.round(projected.y / 4) * 4 };
      }

      function drawCurve(graphics, points, emphasized) {
        var steps = 44, dash = emphasized ? 4 : 3, gap = emphasized ? 1 : 2;
        for (var index = 0; index <= steps; index += 1) {
          var point = pixelPoint(cubic(points, index / steps)), pattern = index % (dash + gap);
          if (index === 0 || pattern === 0) graphics.moveTo(point.x, point.y);
          else if (pattern < dash) graphics.lineTo(point.x, point.y);
        }
      }

      function drawPolyline(graphics, points, emphasized) {
        if (!points.length) return;
        for (var segment = 1; segment < points.length; segment += 1) {
          var start = points[segment - 1], end = points[segment], steps = 12;
          for (var index = 0; index <= steps; index += 1) {
            var t = index / steps,
              point = pixelPoint([
                start[0] + (end[0] - start[0]) * t,
                start[1] + (end[1] - start[1]) * t,
                (start[2] || 0) + ((end[2] || 0) - (start[2] || 0)) * t,
              ]),
              pattern = index % (emphasized ? 5 : 6);
            if (index === 0 || pattern === 0) graphics.moveTo(point.x, point.y);
            else if (pattern < (emphasized ? 4 : 3)) graphics.lineTo(point.x, point.y);
          }
        }
      }

      function drawAffordance(graphics, affordance, highlighted, selected) {
        var color = selected ? 0xffcb3d : highlighted ? 0xffe47a : 0xb8c0c2,
          alpha = selected ? 1 : highlighted ? .95 : .58,
          width = selected ? 12 : highlighted ? 10 : affordance.kind === "ball-path" ? 8 : 7;
        graphics.lineStyle(width, color, alpha);
        if (affordance.kind === "ball-path" || affordance.kind === "run-lane") {
          drawCurve(graphics, affordance.points, highlighted || selected);
          return;
        }
        if (affordance.kind === "duel-vector" || affordance.kind === "formation") {
          drawPolyline(graphics, affordance.points, highlighted || selected);
          return;
        }
        if (affordance.kind === "zone" || affordance.kind === "actor") {
          var center = projectionPoint(affordance.center),
            bounds = window.__happySeedPixelStadiumConfig.pitchBounds,
            radius = affordance.radius || [.05, .08];
          graphics.beginFill(color, selected ? .3 : highlighted ? .24 : .14);
          graphics.drawEllipse(center.x, center.y, radius[0] * bounds.width, radius[1] * bounds.height);
          graphics.endFill();
        }
      }

      function affordanceBounds(choice) {
        var xs = [], ys = [];
        choice.affordances.forEach(function (affordance) {
          var points = affordance.points || (affordance.center ? [affordance.center] : []);
          points.forEach(function (point) {
            var projected = projectionPoint(point);
            xs.push(projected.x);
            ys.push(projected.y);
          });
        });
        var anchor = projectionPoint(choice.labelAnchor);
        xs.push(anchor.x); ys.push(anchor.y);
        return {
          x: Math.min.apply(Math, xs) - 28,
          y: Math.min.apply(Math, ys) - 28,
          width: Math.max(72, Math.max.apply(Math, xs) - Math.min.apply(Math, xs) + 56),
          height: Math.max(72, Math.max.apply(Math, ys) - Math.min.apply(Math, ys) + 56),
        };
      }

      function requestChoice(choice) {
        if (!active || state.phase !== "choosing" || state.choiceLocked) return;
        emit("ab-decision-choice-selected", {
          choiceId: choice.id,
          scenarioId: active.script.scenarioId,
          version: 3,
        });
      }

      function buildChoiceView(choice) {
        var group = new Pixi.Container(),
          graphics = new Pixi.Graphics(),
          bounds = affordanceBounds(choice),
          anchor = projectionPoint(choice.labelAnchor);
        choice.affordances.forEach(function (affordance) {
          drawAffordance(graphics, affordance, !1, !1);
        });
        group.addChild(graphics);
        group.interactive = !0;
        group.buttonMode = !0;
        group.hitArea = new Pixi.Rectangle(bounds.x, bounds.y, bounds.width, bounds.height);
        group.on("pointertap", function () { requestChoice(choice); });
        group.on("pointerover", function () { setHoveredChoice(choice.id); });
        group.on("pointerout", function () { setHoveredChoice(null); });
        affordanceLayer.addChild(group);
        return { id: choice.id, choice: choice, group: group, graphics: graphics, anchor: anchor };
      }

      function showChoices(script) {
        affordanceLayer.removeChildren();
        active.views = script.choices.map(buildChoiceView);
      }

      function setHoveredChoice(choiceId) {
        if (!active || state.phase !== "choosing" || state.choiceLocked) return;
        state.hoveredChoiceId = choiceId || null;
        active.views.forEach(function (view) {
          var highlighted = view.id === state.hoveredChoiceId;
          view.group.alpha = highlighted || !state.hoveredChoiceId ? 1 : .42;
          view.graphics.clear();
          view.choice.affordances.forEach(function (affordance) {
            drawAffordance(view.graphics, affordance, highlighted, !1);
          });
        });
      }

      window.addEventListener("ab-decision-choice-hover", function (event) {
        setHoveredChoice(event.detail && event.detail.active ? event.detail.choiceId : null);
      });

      function confirmChoice(choiceId) {
        state.hoveredChoiceId = null;
        active.views.forEach(function (view) {
          var selected = view.id === choiceId;
          view.group.alpha = selected ? 1 : .12;
          view.group.interactive = !1;
          view.graphics.clear();
          view.choice.affordances.forEach(function (affordance) {
            drawAffordance(view.graphics, affordance, selected, selected);
          });
        });
      }

      function saveActorPositions() {
        return actorEntries.map(function (entry) {
          return {
            runtimeActorId: entry.actor.runtimeActorId,
            x: entry.entity.position.x,
            y: entry.entity.position.y,
            z: entry.entity.position.z || 0,
          };
        });
      }

      function setEntityPosition(position) {
        var entry = entryFor(position.runtimeActorId);
        if (!entry || !entry.entity || !entry.entity.position) return;
        entry.entity.position.x = pitch.width * position.normalized[0];
        entry.entity.position.y = pitch.height * position.normalized[1];
        entry.entity.position.z = 0;
        if (entry.entity.velocity) {
          entry.entity.velocity.x = 0;
          entry.entity.velocity.y = 0;
        }
        if (entry.entity.heading && position.facing) {
          entry.entity.heading.x = position.facing === "left" ? -1 : 1;
          entry.entity.heading.y = 0;
        }
      }

      function setFramePosition(frame, position) {
        var entry = entryFor(position.runtimeActorId),
          entityId = entry && entry.entity.id,
          teams = [frame && frame.redTeam, frame && frame.blueTeam],
          actor = entry && entry.actor,
          authoredTeam = actor && actor.side === "blue"
            ? frame && frame.blueTeam
            : frame && frame.redTeam,
          authoredPlayer = authoredTeam && authoredTeam.players
            && authoredTeam.players[actor && actor.runtimeLocalIndex];
        if (entityId == null) return;
        if (authoredPlayer && authoredPlayer.position) {
          authoredPlayer.position.x = pitch.width * position.normalized[0];
          authoredPlayer.position.y = pitch.height * position.normalized[1];
          authoredPlayer.position.z = 0;
          authoredPlayer.speed = 0;
          if (authoredPlayer.heading && position.facing) {
            authoredPlayer.heading.x = position.facing === "left" ? -1 : 1;
            authoredPlayer.heading.y = 0;
          }
          return;
        }
        teams.forEach(function (team) {
          (team && team.players || []).forEach(function (player) {
            if (player.id !== entityId || !player.position) return;
            player.position.x = pitch.width * position.normalized[0];
            player.position.y = pitch.height * position.normalized[1];
            player.position.z = 0;
            player.speed = 0;
            if (player.heading && position.facing) {
              player.heading.x = position.facing === "left" ? -1 : 1;
              player.heading.y = 0;
            }
          });
        });
      }

      function executionSourceRuntimeActorId() {
        return active && active.execution && active.execution.sourceRuntimeActorId
          || active && active.script && active.script.ball.sourceRuntimeActorId;
      }

      function initialBallRuntimeActorId() {
        return active && active.execution && active.execution.initialSourceRuntimeActorId
          || executionSourceRuntimeActorId();
      }

      function releaseBall() {
        var owner = pitch.ball.owner,
          messages = null,
          sourceEntry = entryFor(initialBallRuntimeActorId());
        try { messages = runtime("messages"); } catch {}
        try { owner && messages && messages.releaseBall.send(owner); } catch {}
        try { messages && messages.releaseBall.send(pitch.ball); } catch {}
        try { pitch.ball.inHands && pitch.ball.inHands.dropBall(); } catch {}
        try { pitch.ball.owner = null; } catch {}
        [owner, sourceEntry && sourceEntry.entity].concat(window.__matchGame.allPlayers || [])
          .filter(Boolean)
          .forEach(function (player) {
            if (player !== owner && (!sourceEntry || sourceEntry.entity !== player)) return;
            try { player.hasBall = !1; } catch {}
            try { player.passing = !1; } catch {}
          });
      }

      function captureBallOnlyShotLocks() {
        if (!active || !active.execution || active.execution.executionMode !== "ball-only-shot") return;
        var ids = [executionSourceRuntimeActorId()], owner = pitch.ball.owner;
        actorEntries.forEach(function (entry) {
          if (owner && entry.entity === owner) ids.push(entry.actor.runtimeActorId);
        });
        active.ballOnlyLocks = Array.from(new Set(ids.filter(Boolean))).map(function (runtimeActorId) {
          var entry = entryFor(runtimeActorId);
          if (!entry || !entry.entity || !entry.entity.position) return null;
          return {
            runtimeActorId: runtimeActorId,
            normalized: [entry.entity.position.x / pitch.width, entry.entity.position.y / pitch.height],
            facing: entry.entity.heading && entry.entity.heading.x < 0 ? "left" : "right",
          };
        }).filter(Boolean);
      }

      function cubic(points, progress) {
        var t = clamp(progress), u = 1 - t, result = [];
        for (var axis = 0; axis < 3; axis += 1)
          result[axis] = u * u * u * (points[0][axis] || 0) +
            3 * u * u * t * (points[1][axis] || 0) +
            3 * u * t * t * (points[2][axis] || 0) +
            t * t * t * (points[3][axis] || 0);
        return result;
      }

      function playEntryAnimation(entry, animation, holdMs, key) {
        if (!entry || !entry.renderer || !entry.renderer.spine) return;
        var mappedAnimation = animation === "dribble" ? "run" : animation,
          loop = animation === "dribble" || animation === "run" || animation === "sprint",
          back = entry.renderer.spine.facingCamera === !1,
          variants = back
            ? [mappedAnimation + "_back", mappedAnimation]
            : [mappedAnimation, mappedAnimation + "_back"];
        for (var index = 0; index < variants.length; index += 1)
          if (entry.renderer.spine.animationExists(variants[index])) {
            if (loop) {
              entry.renderer.spine.state.setAnimationByName(3, variants[index], !0);
              (window.__matchGame._celebrations = window.__matchGame._celebrations || []).push({
                spine: entry.renderer.spine,
                until: performance.now() + holdMs,
                loop: !0,
              });
            } else playTrack3(window.__matchGame, entry.renderer, variants[index], holdMs);
            state.performedActions[key] = variants[index];
            return;
          }
      }

      function playAnimation(role, animation, holdMs, key) {
        var actor = active.script.actors[role], entry = actor && entryFor(actor.runtimeActorId);
        playEntryAnimation(entry, animation, holdMs, key);
      }

      function runCues(now) {
        if (!active.execution || now < active.executionStartedAt) return;
        var elapsed = now - active.executionStartedAt;
        active.execution.actions.forEach(function (action, index) {
          var key = action.role + ":" + index;
          if (active.cues[key] || elapsed < action.atMs) return;
          active.cues[key] = !0;
          playAnimation(action.role, action.animation, 1050, key);
        });
        (active.execution.secondaryRuntimeEvents || []).forEach(function (runtimeEvent, index) {
          var key = "runtime:" + runtimeEvent.type + ":" + index;
          if (active.cues[key] || elapsed < runtimeEvent.atMs) return;
          active.cues[key] = !0;
          if (window.__happySeedEmitRuntimeEvent) {
            var emittedEventId = window.__happySeedEmitRuntimeEvent(runtimeEvent.type, runtimeEvent.runtimeActorId, {
              detail: {
                decision: !0,
                scenarioId: active.script.scenarioId,
                choiceId: active.choice.id,
                role: runtimeEvent.role,
                ...(runtimeEvent.detail || {}),
              },
            });
            if (runtimeEvent.type === "shot" && emittedEventId)
              active.runtimeBallEventId = emittedEventId;
          }
        });
      }

      function currentBall(now) {
        if (!active.execution || !active.execution.path || now < active.executionStartedAt)
          return worldPoint(active.script.ball.normalized);
        var elapsed = now - active.executionStartedAt,
          dribbling = active.execution.carriesBall,
          progress,
          activePath;
        if (active.execution.executionMode === "carry-then-shot") {
          var carryEndMs = active.execution.shotAtMs;
          // 底线回传射门：带球结束后球走 pathSegments（回传→射门），而非直接射门
          if (active.execution.pathSegments && active.execution.pathSegments.length) {
            carryEndMs = active.execution.segmentEndTimes && active.execution.segmentEndTimes[0]
              ? active.execution.segmentEndTimes[0] - (active.execution.shotAtMs - 1080)
              : 1080;
            if (elapsed < carryEndMs) {
              dribbling = !0;
              activePath = active.execution.carryPath;
              progress = clamp(elapsed / carryEndMs);
            } else {
              dribbling = !1;
              var segEndTimes = active.execution.segmentEndTimes || [];
              var segIdx = active.execution.pathSegments.length - 1,
                segStart = carryEndMs, segEnd = active.execution.durationMs;
              for (var si = 0; si < active.execution.pathSegments.length; si++) {
                var ce = segEndTimes[si] || active.execution.durationMs;
                if (elapsed <= ce) { segIdx = si; segEnd = ce; break; }
                segStart = ce;
              }
              activePath = active.execution.pathSegments[segIdx];
              progress = clamp((elapsed - segStart) / Math.max(1, segEnd - segStart));
            }
          } else {
            dribbling = elapsed < carryEndMs;
            activePath = dribbling ? active.execution.carryPath : active.execution.path;
            progress = dribbling
              ? clamp(elapsed / carryEndMs)
              : clamp((elapsed - carryEndMs)
                / Math.max(1, active.execution.durationMs - carryEndMs));
          }
        } else if (active.execution.pathSegments && active.execution.pathSegments.length) {
          var segmentEndTimes = active.execution.segmentEndTimes || [],
            segmentIndex = active.execution.pathSegments.length - 1,
            segmentStartAt = 0,
            segmentEndAt = active.execution.durationMs;
          for (var segmentCursor = 0; segmentCursor < active.execution.pathSegments.length; segmentCursor += 1) {
            var candidateEnd = segmentEndTimes[segmentCursor] || active.execution.durationMs;
            if (elapsed <= candidateEnd) {
              segmentIndex = segmentCursor;
              segmentEndAt = candidateEnd;
              break;
            }
            segmentStartAt = candidateEnd;
          }
          activePath = active.execution.pathSegments[segmentIndex];
          progress = clamp((elapsed - segmentStartAt)
            / Math.max(1, segmentEndAt - segmentStartAt));
        } else {
          activePath = active.execution.path;
          progress = clamp(elapsed / active.execution.durationMs);
        }
        var point = cubic(activePath, progress);
        if (dribbling) {
          var nextProgress = clamp(progress + .025),
            nextPoint = cubic(activePath, nextProgress),
            dx = nextPoint[0] - point[0],
            dy = nextPoint[1] - point[1],
            length = Math.sqrt(dx * dx + dy * dy) || 1,
            stride = Math.max(0, Math.sin(progress * Math.PI * 10)),
            lead = .018 + stride * .012;
          point[0] += dx / length * lead;
          point[1] += dy / length * lead;
          point[2] = Math.max(point[2] || 0, .12 + stride * .08);
        }
        return worldPoint(point);
      }

      function currentActorMotions(now) {
        if (!active.execution || now < active.executionStartedAt) return [];
        var motions = active.execution.actorMotions && active.execution.actorMotions.length
          ? active.execution.actorMotions
          : active.execution.actorMotion ? [active.execution.actorMotion] : [];
        return motions.map(function (motion) {
          if (active.execution.executionMode === "ball-only-shot" &&
            motion.runtimeActorId === executionSourceRuntimeActorId()) return null;
          var motionDuration = active.execution.executionMode === "carry-then-shot" && motion.carriesBall
              ? (active.execution.pathSegments && active.execution.pathSegments.length
                ? 1080
                : active.execution.shotAtMs)
              : active.execution.durationMs,
            progress = clamp((now - active.executionStartedAt) / motionDuration),
            point = cubic(motion.points, progress);
          return {
            runtimeActorId: motion.runtimeActorId,
            normalized: [point[0], point[1]],
          };
        }).filter(Boolean);
      }

      function applyActorMotion(now) {
        currentActorMotions(now).forEach(setEntityPosition);
      }

      function captureAmbientMotions() {
        if (!active || !active.execution) return;
        var excluded = {}, origin = active.script.ball.normalized;
        excluded[executionSourceRuntimeActorId()] = !0;
        (active.execution.actorMotions || (active.execution.actorMotion
          ? [active.execution.actorMotion] : [])).forEach(function (motion) {
          excluded[motion.runtimeActorId] = !0;
        });
        (active.ballOnlyLocks || []).forEach(function (position) {
          excluded[position.runtimeActorId] = !0;
        });
        (active.execution.actions || []).forEach(function (action) {
          var actor = active.script.actors[action.role];
          if (actor) excluded[actor.runtimeActorId] = !0;
        });
        active.ambientMotions = actorEntries
          .filter(function (entry) {
            return entry && entry.entity && entry.entity.position
              && !entry.actor.isGoalkeeper
              && !excluded[entry.actor.runtimeActorId];
          })
          .map(function (entry, index) {
            var start = [entry.entity.position.x / pitch.width, entry.entity.position.y / pitch.height],
              dx = origin[0] - start[0],
              dy = origin[1] - start[1],
              length = Math.sqrt(dx * dx + dy * dy) || 1,
              amount = .022 + index % 3 * .008,
              lateral = index % 2 ? .007 : -.007;
            return {
              entry: entry,
              distance: length,
              runtimeActorId: entry.actor.runtimeActorId,
              start: start,
              target: [
                clamp(start[0] + dx / length * amount - dy / length * lateral, .02, .98),
                clamp(start[1] + dy / length * amount + dx / length * lateral, .03, .97),
              ],
              facing: dx < 0 ? "left" : "right",
            };
          })
          .sort(function (left, right) { return left.distance - right.distance; })
          .slice(0, 10);
        active.ambientMotions.forEach(function (motion, index) {
          playEntryAnimation(
            motion.entry,
            "run",
            active.execution.durationMs + 280,
            "ambient:" + motion.runtimeActorId + ":" + index,
          );
        });
      }

      function currentAmbientMotions(now) {
        if (!active || state.phase !== "executing" || now < active.executionStartedAt)
          return [];
        var progress = clamp((now - active.executionStartedAt) / active.execution.durationMs),
          amount = Math.min(1, progress * 1.8);
        return (active.ambientMotions || []).map(function (motion) {
          return {
            runtimeActorId: motion.runtimeActorId,
            normalized: [
              motion.start[0] + (motion.target[0] - motion.start[0]) * amount,
              motion.start[1] + (motion.target[1] - motion.start[1]) * amount,
            ],
            facing: motion.facing,
          };
        });
      }

      function applyAmbientMotions(now, frame) {
        currentAmbientMotions(now).forEach(function (motion) {
          setEntityPosition(motion);
          if (frame) setFramePosition(frame, motion);
        });
      }

      function ballOnlyShotActorPositions() {
        if (!active || !active.execution || active.execution.executionMode !== "ball-only-shot") return null;
        if (active.ballOnlyLocks && active.ballOnlyLocks.length) return active.ballOnlyLocks;
        var runtimeActorId = executionSourceRuntimeActorId(),
          staged = active.script.stagedActorPositions || [],
          live = active.script.actorPositions || [];
        for (var index = 0; index < staged.length; index += 1)
          if (staged[index].runtimeActorId === runtimeActorId) return [staged[index]];
        for (var liveIndex = 0; liveIndex < live.length; liveIndex += 1)
          if (live[liveIndex].runtimeActorId === runtimeActorId) return [live[liveIndex]];
        return [];
      }

      function lockBallOnlyShotActor(frame) {
        var positions = ballOnlyShotActorPositions();
        if (!positions) return;
        positions.forEach(function (position) {
          setEntityPosition(position);
          if (frame) setFramePosition(frame, position);
        });
      }

      function applyBall(point) {
        state.ballPosition = point;
        pitch.ball.placeAtPosition(point.x, point.y, point.z);
        if (active && active.execution && (
          active.execution.executionMode === "ball-only-shot"
          || active.execution.executionMode === "pass-then-shot"
          || active.execution.executionMode === "pass-sequence-then-shot"
          || active.execution.executionMode === "carry-then-shot" && active.ballReleased
        )) {
          try { pitch.ball.owner = null; } catch {}
          (active.ballOnlyLocks || []).forEach(function (position) {
            var entry = entryFor(position.runtimeActorId);
            if (entry && entry.entity) {
              try { entry.entity.hasBall = !1; } catch {}
              try { entry.entity.passing = !1; } catch {}
            }
          });
        }
        if (pitch.ball.velocity) {
          pitch.ball.velocity.x = 0;
          pitch.ball.velocity.y = 0;
          pitch.ball.velocity.z = 0;
        }
      }

      function handoffContinuation() {
        if (!active || !active.execution) return !1;
        var continuation = active.execution.continuation;
        if (!continuation || continuation.type !== "actor-possession") return !1;
        var entry = entryFor(continuation.runtimeActorId);
        if (!entry || !entry.entity || !entry.entity.position) return !1;
        // 强制清除所有球权归属：无论当前谁持球（包括门将 inHands），
        // 都必须先完全释放，否则 forceTrap 在引擎信号链上抛错后球权永远确认不到
        try {
          if (pitch.ball.inHands) {
            try { pitch.ball.inHands.dropBall && pitch.ball.inHands.dropBall(); } catch {}
            pitch.ball.inHands = null;
          }
        } catch {}
        try {
          if (pitch.ball.owner) {
            try { pitch.ball.owner.release && pitch.ball.owner.release(); } catch {}
            try { pitch.ball.owner.hasBall = !1; } catch {}
            try { pitch.ball.owner.passing = !1; } catch {}
            pitch.ball.owner = null;
          }
        } catch {}
        // 遍历所有球员清除残留 hasBall 标记（防止引擎物理把球判给附近的人）
        try {
          (window.__matchGame.allPlayers || []).forEach(function (p) {
            if (p !== entry.entity) { try { p.hasBall = !1; } catch {} }
          });
        } catch {}
        // 原生扑救模式：门将已经把球抱在怀里（inHands），不再重放 trap
        if (pitch.ball.inHands !== entry.entity) {
          pitch.ball.placeAtPosition(
            entry.entity.position.x,
            entry.entity.position.y,
            Math.max(pitch.ball.radius || .12, .12),
          );
          try {
            if (typeof entry.entity.forceTrap === "function") entry.entity.forceTrap(pitch.ball);
            else if (typeof entry.entity.trap === "function") entry.entity.trap(pitch.ball, !0);
          } catch {}
        }
        if (!pitch.ball.owner && !entry.entity.hasBall && pitch.ball.inHands !== entry.entity) {
          try { pitch.ball.owner = entry.entity; } catch {}
          try { entry.entity.hasBall = !0; } catch {}
        }
        if (entry.actor && entry.actor.isGoalkeeper
          && window.__happySeedEnforceGoalkeeperSafety)
          window.__happySeedEnforceGoalkeeperSafety();
        var possessionConfirmed = Boolean(
          pitch.ball.owner === entry.entity
          || entry.entity.hasBall
          || pitch.ball.inHands === entry.entity,
        );
        if (
          possessionConfirmed &&
          entry.actor &&
          entry.actor.isGoalkeeper &&
          !active.saveRuntimeEventId &&
          window.__happySeedEmitRuntimeEvent
        ) {
          active.saveRuntimeEventId = window.__happySeedEmitRuntimeEvent(
            "save",
            entry.actor.runtimeActorId,
            {
              side: entry.actor.side,
              sourceEventId: active.runtimeBallEventId || null,
              detail: {
                decision: !0,
                scenarioId: active.script.scenarioId,
                choiceId: active.choice.id,
                outcome: active.outcome,
                shotEventId: active.runtimeBallEventId || null,
              },
            },
          );
        }
        state.ballPosition = {
          x: pitch.ball.position.x,
          y: pitch.ball.position.y,
          z: pitch.ball.position.z,
        };
        return possessionConfirmed;
      }

      function setBlackout(visible) {
        state.blackoutVisible = visible;
        blackout.classList.toggle("is-visible", visible);
      }

      function applyStaging() {
        if (!active || active.stageApplied) return;
        active.stageApplied = !0;
        active.script.stagedActorPositions.forEach(setEntityPosition);
        applyBall(worldPoint(active.script.ball.normalized));
        try {
          window.__happySeedStadiumScene.followBall();
          window.__matchZoom.set(window.innerWidth <= 900 || window.innerHeight <= 500 ? .36 : .46);
        } catch {}
      }

      function restoreCamera() {
        if (!active || !active.savedCamera) return;
        window.__matchZoom.set(active.savedCamera.zoom);
        window.__happySeedStadiumScene.followBall();
      }

      function restoreCancelledSnapshot(finished) {
        var saved = finished.savedBall;
        pitch.ball.placeAtPosition(saved.position.x, saved.position.y, saved.position.z);
        if (pitch.ball.velocity) {
          pitch.ball.velocity.x = saved.velocity.x;
          pitch.ball.velocity.y = saved.velocity.y;
          pitch.ball.velocity.z = saved.velocity.z;
        }
        finished.savedActors.forEach(function (position) {
          var entry = entryFor(position.runtimeActorId);
          if (!entry || !entry.entity || !entry.entity.position) return;
          entry.entity.position.x = position.x;
          entry.entity.position.y = position.y;
          entry.entity.position.z = position.z;
        });
      }

      function finish(cancelled) {
        var finished = active;
        if (!finished) return;
        (finished.liveFrozen || []).forEach(function (player) {
          try { playerGlobals.forceAI(player, null); } catch {}
        });
        setBlackout(!1);
        affordanceLayer.removeChildren();
        if (cancelled) restoreCancelledSnapshot(finished);
        // blackout-stage 正常完成时，将被摆位的球员（人墙、定位球主罚者等）恢复到决策前的位置，
        // 否则人墙球员会卡在墙位不动（AI 来不及重新调度）
        if (!cancelled && finished.script.mode === "blackout-stage" && finished.savedActors) {
          var stagedIds = {};
          (finished.script.stagedActorPositions || []).forEach(function (p) { stagedIds[p.runtimeActorId] = !0; });
          finished.savedActors.forEach(function (position) {
            if (!stagedIds[position.runtimeActorId]) return;
            var entry = entryFor(position.runtimeActorId);
            if (!entry || !entry.entity || !entry.entity.position) return;
            entry.entity.position.x = position.x;
            entry.entity.position.y = position.y;
            entry.entity.position.z = position.z;
            if (entry.entity.velocity) {
              entry.entity.velocity.x = 0;
              entry.entity.velocity.y = 0;
            }
          });
        }
        restoreCamera();
        // freeze-incident 判罚点球后：不恢复比赛，将球放到中圈防止冻结瞬间的射门继续入网
        if (!cancelled && finished.script.__suppressResumeForPenalty) {
          try {
            pitch.ball.placeAtPosition(pitch.width * 0.5, pitch.height * 0.5, 0.12);
            if (pitch.ball.velocity) {
              pitch.ball.velocity.x = 0;
              pitch.ball.velocity.y = 0;
              pitch.ball.velocity.z = 0;
            }
            try { pitch.ball.owner = null; } catch {}
            try { pitch.ball.inHands = null; } catch {}
          } catch (ballResetError) {
            console.error("[decision-director-v3] penalty ball reset failed", ballResetError);
          }
        } else if (!cancelled && window.__happySeedResumeAfterDecision) {
          try {
            window.__happySeedResumeAfterDecision({
              goalCommitted: Boolean(finished.goalCommitted),
              scoringSide: finished.execution && finished.execution.scoringSide,
              consumeRestart: finished.script.mode === "blackout-stage",
            });
          } catch (resumeError) {
            console.error("[decision-director-v3] resume failed", resumeError);
          }
        }
        // 安全网：如果引擎在决策结束后卡在非 Match 状态（如死球/门将持球等），
        // 强制恢复到 Match 状态，避免球员静止不动
        if (!cancelled && !finished.livePhysics) {
          try {
            var Pitch = runtime("pitch").Pitch;
            var stateName = pitch.states.current && pitch.states.current.name;
            if (stateName && stateName !== "Match" && stateName !== "GoalCelebration"
              && stateName !== "Kickoff" && stateName !== "Goal") {
              pitch.ballOutOfPlay = !1;
              pitch.states.change(Pitch.states.Match);
            }
          } catch (stateError) {
            console.error("[decision-director-v3] force Match state failed", stateError);
          }
        }
        try {
          if (finished.timeScaleToken != null) pitch.timeScale.reset(finished.timeScaleToken);
          else pitch.timeScale.value = 1;
        } catch (tsError) {
          try { pitch.timeScale.value = 1; } catch (tsError2) { /* 忽略 */ }
        }
        // 根治决策后冻住：如果球无主且不在手中且未出界，强制分配给最近球员。
        // 引擎 AI 无法处理“无人认领的静止球”，会导致所有球员站着不动。
        if (!cancelled && !finished.livePhysics && !finished.script.__suppressResumeForPenalty) {
          try {
            var ball = pitch.ball;
            var hasOwner = !!(ball.owner || ball.inHands);
            var isOut = !!pitch.ballOutOfPlay;
            if (!hasOwner && !isOut && ball.position) {
              var allP = window.__matchGame.allPlayers || [];
              var bestPlayer = null, bestDist = Infinity;
              for (var pi = 0; pi < allP.length; pi++) {
                var pp = allP[pi];
                if (!pp || !pp.position || !pp.team) continue;
                // 排除门将（除非球在禁区内）
                var pdx = pp.position.x - ball.position.x;
                var pdy = pp.position.y - ball.position.y;
                var pd = Math.sqrt(pdx * pdx + pdy * pdy);
                if (pd < bestDist) { bestDist = pd; bestPlayer = pp; }
              }
              if (bestPlayer) {
                ball.placeAtPosition(bestPlayer.position.x, bestPlayer.position.y, Math.max(ball.radius || .12, .12));
                try { bestPlayer.hasBall = !0; } catch {}
                try { ball.owner = bestPlayer; } catch {}
                if (ball.velocity) { ball.velocity.x = 0; ball.velocity.y = 0; ball.velocity.z = 0; }
              }
            }
          } catch (ballAssignError) {
            console.error("[decision-director-v3] post-decision ball assign failed", ballAssignError);
          }
        }
        if (frameHandle != null) window.cancelAnimationFrame(frameHandle);
        frameHandle = null;
        active = null;
        state.phase = "idle";
        state.scenarioId = null;
        state.selectedChoiceId = null;
        state.hoveredChoiceId = null;
        state.outcome = null;
        state.choiceLocked = !1;
        state.performedActions = {};
        state.transitionMode = null;
        state.ballPosition = null;
        state.continuationReady = !1;
        if (cancelled) {
          finished.prepareResolve && finished.prepareResolve({ cancelled: !0, snapshot: snapshot() });
          finished.settledResolve && finished.settledResolve({ cancelled: !0, snapshot: snapshot() });
          finished.completedResolve && finished.completedResolve({ cancelled: !0, snapshot: snapshot() });
          emit("ab-decision-director-cancelled", { scenarioId: finished.script.scenarioId, version: 3 });
        } else {
          finished.completedResolve({ completed: !0, snapshot: snapshot() });
          emit("ab-decision-director-completed", {
            scenarioId: finished.script.scenarioId,
            choiceId: finished.choice.id,
            outcome: finished.outcome,
            version: 3,
          });
        }
      }

      // —— 原生踢球（live physics）：直接射门用引擎真实弹道，门将由原生 AI 反应 ——
      function setupLiveShot(shot) {
        var participants = {};
        participants[shot.shooterRuntimeActorId] = !0;
        participants[shot.keeperRuntimeActorId] = !0;
        active.liveFrozen = [];
        actorEntries.forEach(function (entry) {
          if (!entry || !entry.entity || participants[entry.actor.runtimeActorId]) return;
          try {
            playerGlobals.forceIdle(entry.entity);
            active.liveFrozen.push(entry.entity);
          } catch {}
        });
        playEntryAnimation(entryFor(shot.shooterRuntimeActorId), "shoot", 1000, "liveshot:windup");
        try {
          if (active.timeScaleToken != null) {
            pitch.timeScale.reset(active.timeScaleToken);
            active.timeScaleToken = null;
          }
        } catch {}
        active.livePhysics = !0;
        active.liveKicked = !1;
        active.liveKickAt = active.executionStartedAt + 220;
      }

      function doLiveKick() {
        var shot = active.execution.liveShot,
          shooterEntry = entryFor(shot.shooterRuntimeActorId),
          ball = pitch.ball,
          from = ball.position,
          dx = pitch.width * shot.aim[0] - from.x,
          dy = pitch.height * shot.aim[1] - from.y,
          dist = Math.hypot(dx, dy) || 1,
          cos = Math.cos(shot.elevate),
          sin = Math.sin(shot.elevate);
        releaseBall();
        try { ball.lastTouch = (shooterEntry && shooterEntry.entity) || ball.lastTouch; } catch {}
        try {
          ball.kick({ x: dx / dist * cos, y: dy / dist * cos, z: sin }, shot.power);
        } catch (kickError) {
          console.error("[decision-director-v3] 原生踢球失败", kickError);
        }
        state.ballPosition = {
          x: ball.position.x,
          y: ball.position.y,
          z: ball.position.z,
        };
        if (window.__happySeedEmitRuntimeEvent) {
          active.runtimeBallEventId = window.__happySeedEmitRuntimeEvent("shot", shot.shooterRuntimeActorId, {
            detail: {
              decision: !0,
              scenarioId: active.script.scenarioId,
              choiceId: active.choice.id,
              outcome: active.outcome,
              live: !0,
            },
          });
        }
      }

      function watchLiveTerminal(now) {
        if (!active || active.settled) return;
        var stateName = pitch.states.current && pitch.states.current.name,
          ball = pitch.ball;
        if (stateName === "Goal" || stateName === "GoalCelebration") {
          active.liveResult = "goal";
          settle(now);
          return;
        }
        if (ball.inHands || (ball.owner && ball.owner.isGoalkeeper)) {
          active.liveResult = "saved";
          settle(now);
          return;
        }
        if (pitch.ballOutOfPlay
          && ["BallOutOfPlay", "Corner", "GoalKick", "ThrowIn"].indexOf(stateName) >= 0) {
          active.liveResult = "out";
          settle(now);
        }
      }

      function settle(now) {        if (!active || active.settled) return;
        if (active.execution.continuation
          && active.execution.continuation.type === "actor-possession"
          && !state.continuationReady) {
          if (!active.handoffStartedAt) active.handoffStartedAt = now;
          state.continuationReady = handoffContinuation();
          if (!state.continuationReady) {
            if (now - active.handoffStartedAt < 1500) return;
            // 球权交接长时间无法确认：强制赋值球权，绝不冻结比赛
            console.warn("[decision-director-v3] 球权交接超时，强制赋值结算",
              active.script.scenarioId, active.outcome);
            var contEntry = entryFor(active.execution.continuation.runtimeActorId);
            if (contEntry && contEntry.entity && contEntry.entity.position) {
              try {
                pitch.ball.owner = contEntry.entity;
                contEntry.entity.hasBall = !0;
                pitch.ball.placeAtPosition(
                  contEntry.entity.position.x,
                  contEntry.entity.position.y,
                  Math.max(pitch.ball.radius || .12, .12),
                );
              } catch (forceError) {
                console.error("[decision-director-v3] 强制球权失败", forceError);
              }
            }
            state.continuationReady = !0;
          }
        }
        active.settled = !0;
        state.settleCount += 1;
        setPhase("settled");
        active.settledResolve({ settled: !0, snapshot: snapshot() });
        emit("ab-decision-director-settled", {
          scenarioId: active.script.scenarioId,
          choiceId: active.choice.id,
          outcome: active.outcome,
          terminal: active.execution.terminal,
          version: 3,
        });
        active.restoreAt = now + active.script.timeline.settledHoldMs;
      }

      function commitExecutionGoal() {
        if (!active || !active.settled || !active.execution
          || !active.execution.requiresRuntimeGoal || active.goalCommitted)
          return !1;
        // 原生踢球模式下进球已由引擎 Goal 状态计分并进入原生开球链，无需手工提交
        if (active.livePhysics) return !0;
        var path = active.execution.path || [],
          terminalPoint = path[path.length - 1],
          committed = Boolean(window.__happySeedCommitDecisionGoal
            && window.__happySeedCommitDecisionGoal({
              token: active.script.id + ":" + active.choice.id + ":" + active.outcome,
              scenarioId: active.script.scenarioId,
              choiceId: active.choice.id,
              outcome: active.outcome,
              scoringSide: active.execution.scoringSide,
              sourceRuntimeActorId: executionSourceRuntimeActorId(),
              shotEventId: active.runtimeBallEventId || null,
              targetNormalized: terminalPoint || null,
            }));
        active.goalCommitted = committed;
        return committed;
      }

      function tick(now) {
        frameHandle = null;
        if (!active) return;
        try {
        if (state.phase === "staging") {
          if (active.script.mode === "blackout-stage" && now >= active.stageAt) {
            applyStaging();
            setBlackout(!1);
          }
          if (now >= active.choicesReadyAt) {
            setPhase("choosing");
            emit("ab-decision-director-choices", {
              choices: active.script.choices.map(function (choice) {
                return { id: choice.id, label: choice.label, kinds: choice.affordances.map(function (a) { return a.kind; }) };
              }),
              version: 3,
            });
            active.prepareResolve(snapshot());
          }
        } else if (state.phase === "executing") {
          if (active.livePhysics) {
            if (!active.liveKicked && now >= active.liveKickAt) {
              active.liveKicked = !0;
              doLiveKick();
            }
            if (active.liveKicked) watchLiveTerminal(now);
            if (!active.settled && active.liveKicked
              && now - active.liveKickAt >= active.execution.liveShot.maxFlightMs) {
              console.warn("[decision-director-v3] 原生踢球超时未达终结，按当前物理状态结算", active.script.scenarioId, active.outcome);
              settle(now);
            }
          } else {
          // ball-carry 模式一开始就释放引擎球权，球位置完全由导演运动学控制
          if (active.execution.carriesBall && !active.ballReleased && now >= active.executionStartedAt) {
            active.ballReleased = !0;
            releaseBall();
          }
          if (!active.ballReleased
            && active.execution.releaseBallAtMs != null
            && now >= active.executionStartedAt + active.execution.releaseBallAtMs
            && active.execution.path) {
            active.ballReleased = !0;
            releaseBall();
            var runtimeBallEventType = active.execution.runtimeBallEventType || active.choice.runtimeBallEventType;
            if (runtimeBallEventType && window.__happySeedEmitRuntimeEvent)
              active.runtimeBallEventId = window.__happySeedEmitRuntimeEvent(runtimeBallEventType, initialBallRuntimeActorId(), {
                detail: {
                  decision: !0,
                  scenarioId: active.script.scenarioId,
                  choiceId: active.choice.id,
                },
              });
          }
          if (active.execution.path && now >= active.executionStartedAt) applyBall(currentBall(now));
          lockBallOnlyShotActor(null);
          applyAmbientMotions(now, null);
          applyActorMotion(now);
          runCues(now);
          if (now - active.executionStartedAt >= active.execution.durationMs) settle(now);
          // 执行阶段硬超时：无论何种原因，12秒后强制结算，绝不冻结比赛
          if (!active.settled && now - active.executionStartedAt >= 12000) {
            console.warn("[decision-director-v3] 执行硬超时", active.script.scenarioId, active.outcome);
            settle(now);
          }
          }
        } else if (state.phase === "settled" && now >= active.restoreAt) {
          setPhase("restoring");
          active.finishAt = now + 180;
        } else if (state.phase === "restoring" && now >= active.finishAt) finish(!1);
        } catch (error) {
          console.error("[decision-director-v3] tick failed", error);
          finish(!0);
          return;
        }
        if (active) frameHandle = window.requestAnimationFrame(tick);
      }

      function ensureTick() {
        if (frameHandle == null) frameHandle = window.requestAnimationFrame(tick);
      }

      // 决策冻结瞬间，原生 AI 可能正让球员铲球、倒地或射门；
      // 选择阶段必须把这类一次性动作重置为站姿，否则玩家是在事后做决定
      var ACTION_POSE_PREFIXES = [
        "slide", "fall", "shoot", "jump", "hands_in_front",
        "throw", "volley", "laying", "on_knees", "sitting", "stand_up",
      ];
      function neutralizeActionPoses() {
        actorEntries.forEach(function (entry) {
          var spine = entry && entry.renderer && entry.renderer.spine;
          if (!spine || !spine.state || !spine.state.tracks) return;
          var back = spine.facingCamera === !1,
            idleName = back && spine.animationExists("idle_back") ? "idle_back" : "idle";
          if (!spine.animationExists(idleName)) return;
          for (var trackIndex = 0; trackIndex < spine.state.tracks.length; trackIndex += 1) {
            var track = spine.state.tracks[trackIndex],
              animName = track && track.animation && track.animation.name;
            if (!animName) continue;
            for (var prefixIndex = 0; prefixIndex < ACTION_POSE_PREFIXES.length; prefixIndex += 1) {
              var prefix = ACTION_POSE_PREFIXES[prefixIndex];
              if (animName === prefix || animName.indexOf(prefix + "_") === 0) {
                spine.state.setAnimationByName(trackIndex, idleName, !0);
                break;
              }
            }
          }
        });
        try {
          if (window.__matchGame && window.__matchGame._celebrations) {
            window.__matchGame._celebrations.length = 0;
          }
        } catch {}
      }

      window.__happySeedDecisionDirectorV3 = {
        prepare: function (script) {
          if (!script || active || state.phase !== "idle")
            return Promise.reject(new Error("DecisionDirectorV3 当前不可准备"));
          var now = performance.now(),
            staged = script.mode === "blackout-stage",
            stadiumSnapshot = window.__happySeedStadiumScene.getSnapshot();
          active = {
            script: script,
            views: [],
            choice: null,
            outcome: null,
            execution: null,
            executionStartedAt: 0,
            cues: {},
            ballReleased: !1,
            settled: !1,
            stageApplied: !1,
            stageAt: now + (script.transition.fadeOutMs || 0),
            choicesReadyAt: now + (staged
              ? (script.transition.fadeOutMs || 0) + (script.transition.fadeInMs || 0) + 40
              : 80),
            restoreAt: 0,
            finishAt: 0,
            prepareResolve: null,
            settledResolve: null,
            completedResolve: null,
            timeScaleToken: null,
            savedCamera: {
              mode: stadiumSnapshot.cameraMode,
              target: stadiumSnapshot.cameraTarget,
              zoom: stadiumSnapshot.zoom,
            },
            savedBall: {
              position: { x: pitch.ball.position.x, y: pitch.ball.position.y, z: pitch.ball.position.z },
              velocity: {
                x: pitch.ball.velocity && pitch.ball.velocity.x || 0,
                y: pitch.ball.velocity && pitch.ball.velocity.y || 0,
                z: pitch.ball.velocity && pitch.ball.velocity.z || 0,
              },
            },
            savedActors: saveActorPositions(),
            ballOnlyLocks: [],
            ambientMotions: [],
            goalCommitted: !1,
            runtimeBallEventId: null,
            saveRuntimeEventId: null,
          };
          state.scenarioId = script.scenarioId;
          state.selectedChoiceId = null;
          state.hoveredChoiceId = null;
          state.outcome = null;
          state.choiceLocked = !1;
          state.performedActions = {};
          state.transitionMode = script.mode;
          state.continuationReady = !1;
          state.ballPosition = worldPoint(script.ball.normalized);
          try { active.timeScaleToken = pitch.timeScale.change(0); } catch {}
          neutralizeActionPoses();
          showChoices(script);
          if (staged) setBlackout(!0);
          setPhase("staging");
          ensureTick();
          emit("ab-decision-director-prepared", { scriptId: script.id, version: 3 });
          return new Promise(function (resolve) { active.prepareResolve = resolve; });
        },
        execute: function (payload) {
          if (!active || state.phase !== "choosing" || state.choiceLocked)
            throw new Error("DecisionDirectorV3 选择已锁定或场景未就绪");
          var choice = active.script.choices.find(function (candidate) { return candidate.id === payload.choiceId; }),
            execution = choice && choice.outcomes[payload.outcome];
          if (!choice || !execution) {
            // 结果分支不存在时绝不能冻结比赛：先恢复原状再抛出
            finish(!0);
            throw new Error("DecisionDirectorV3 缺少显式 choice/outcome 分支");
          }
          state.choiceLocked = !0;
          state.selectedChoiceId = choice.id;
          state.outcome = payload.outcome;
          active.choice = choice;
          active.outcome = payload.outcome;
          active.execution = execution;
          captureBallOnlyShotLocks();
          captureAmbientMotions();
          active.executionStartedAt = performance.now() + active.script.timeline.selectionFeedbackMs;
          if (execution.liveShot) setupLiveShot(execution.liveShot);
          else captureAmbientMotions();
          confirmChoice(choice.id);
          setPhase("executing");
          var settled = new Promise(function (resolve) { active.settledResolve = resolve; }),
            completed = new Promise(function (resolve) { active.completedResolve = resolve; });
          return {
            settled: settled,
            completed: completed,
            commitGoal: commitExecutionGoal,
            snapshot: snapshot(),
          };
        },
        cancel: function () {
          if (!active) return !1;
          finish(!0);
          return !0;
        },
        getSnapshot: snapshot,
      };

      var previousFrame = stadium.frame.bind(stadium);
      stadium.frame = function (frame) {
        if (active && !active.livePhysics) {
          try {
            if (state.phase === "staging" || state.phase === "choosing" || state.phase === "executing")
              active.script.stagedActorPositions.forEach(function (position) {
                setFramePosition(frame, position);
              });
            // blackout-stage 在 settled/restoring 阶段：将被摆位的球员恢复到决策前位置，
            // 避免人墙球员卡死在墙位（物理引擎内部状态也需更新）
            if ((state.phase === "settled" || state.phase === "restoring")
              && active.script.mode === "blackout-stage" && active.savedActors) {
              var stagedIds = {};
              (active.script.stagedActorPositions || []).forEach(function (p) { stagedIds[p.runtimeActorId] = !0; });
              active.savedActors.forEach(function (pos) {
                if (stagedIds[pos.runtimeActorId]) setFramePosition(frame, { runtimeActorId: pos.runtimeActorId, normalized: [pos.x / pitch.width, pos.y / pitch.height] });
              });
            }
            var frameNow = performance.now(),
              motions = currentActorMotions(frameNow);
            applyAmbientMotions(frameNow, frame);
            motions.forEach(function (motion) {
              setFramePosition(frame, motion);
            });
            lockBallOnlyShotActor(frame);
            if (active.execution && active.execution.path && performance.now() >= active.executionStartedAt) {
              var ball = currentBall(performance.now());
              if (frame && frame.ball && frame.ball.position) {
                frame.ball.position.x = ball.x;
                frame.ball.position.y = ball.y;
                frame.ball.position.z = ball.z;
                frame.ball.inHands = -1;
              }
            }
          } catch (error) {
            console.error("[decision-director-v3] frame failed", error);
          }
        } else if (!active) {
          // 导演未激活时确保 timeScale 不为 0（防止 finish() 中 reset 失败的边缘情况）
          try { if (pitch.timeScale && pitch.timeScale.value === 0) pitch.timeScale.value = 1; } catch {}
        }
        previousFrame(frame);
      };

      emit("ab-decision-director-ready", { version: 3 });
      return !0;
    } catch (error) {
      stadium._decisionDirectorV3Init = !1;
      console.error("[decision-director-v3] 初始化失败", error);
      return !1;
    }
  }

  window.__happySeedRuntimeV3 = {
    installStadium: window.__happySeedRuntimeV2 && window.__happySeedRuntimeV2.installStadium,
    installDecisionDirector: installDecisionDirector,
  };
})();
