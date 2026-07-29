(function () {
  "use strict";
  window.__bootTrace = function () {
    var msg = Array.prototype.join.call(arguments, " ");
    console.info("[boot-trace]", msg);
    try {
      localStorage.setItem(
        "bootTrace",
        (localStorage.getItem("bootTrace") || "") +
          Date.now() +
          " " +
          msg +
          `
`,
      );
    } catch {}
  };
  try {
    localStorage.removeItem("bootTrace");
  } catch {}
  function runtime(id) {
    if (typeof window.require != "function")
      throw new Error("runtime require is not ready");
    return window.require(id);
  }
  function first(collection) {
    return collection && typeof collection.all == "function"
      ? collection.all()[0]
      : null;
  }
  function setupCollections() {
    var settings = runtime("settings");
    (runtime("balls").load(settings("BALLS_ROOT")),
      runtime("stadiums").load(settings("STADIUMS_ROOT")),
      runtime("teams").load(settings("TEAMS_ROOT")),
      runtime("races").load(settings("RACES_ROOT")));
  }
  var FORMATIONS = [
    [4, 3, 3],
    [4, 4, 2],
    [3, 4, 3],
    [4, 2, 4],
    [3, 5, 2],
    [5, 3, 2],
  ];
  function randomizeFormation(team) {
    for (
      var f = FORMATIONS[Math.floor(Math.random() * FORMATIONS.length)],
        roles = [],
        d = 0;
      d < f[0];
      d++
    )
      roles.push("D");
    for (var m = 0; m < f[1]; m++) roles.push("M");
    for (var a = 0; a < f[2]; a++) roles.push("A");
    for (var outfield = [], i = 0; i < team.players.length; i++)
      team.players[i].role !== "G" && outfield.push(team.players[i]);
    for (i = 0; i < outfield.length; i++)
      roles[i] && (outfield[i].role = roles[i]);
    return f.join("-");
  }
  var MATCH_ZOOM =
    window.innerWidth <= 900 || window.innerHeight <= 500 ? 1.0 : 1.2;
  ((function () {
    try {
      var z = parseFloat(
        new URLSearchParams(window.location.search).get("zoom"),
      );
      z > 0.5 && z < 5 && (MATCH_ZOOM = z);
    } catch {}
  })(),
    typeof window.__matchZoomMul != "number" && (window.__matchZoomMul = 1));
  var INTRO_HOLD_MS = 0,
    INTRO_MS = 1200,
    REVEAL_FADE_MS = 980;
  function introCoverZoom(zf) {
    var rdr = window.__matchGame && window.__matchGame.renderer,
      cover =
        rdr && rdr.width
          ? Math.max(rdr.width / 5120, rdr.height / 2560)
          : window.__introZ0 || zf * 0.105;
    return Math.min(cover, zf);
  }
  function introScale() {
    var t0 = window.__introStart;
    if (!t0) return 1;
    if (t0 === -1) {
      if (
        performance.now() - (window.__introArmedAt || 0) <
        REVEAL_FADE_MS + 400
      ) {
        var zfh = MATCH_ZOOM * (window.__matchZoomMul || 1);
        zfh = zfh < 0.8 ? 0.8 : zfh > 3 ? 3 : zfh;
        var z0h = introCoverZoom(zfh);
        return z0h / zfh;
      }
      t0 = window.__introStart = performance.now();
    }
    var el = performance.now() - t0,
      t = el <= INTRO_HOLD_MS ? 0 : (el - INTRO_HOLD_MS) / INTRO_MS;
    if (t >= 1) return ((window.__introStart = 0), 1);
    var zf = MATCH_ZOOM * (window.__matchZoomMul || 1);
    zf = zf < 0.8 ? 0.8 : zf > 3 ? 3 : zf;
    var z0 = introCoverZoom(zf);
    return (z0 * Math.pow(zf / z0, t)) / zf;
  }
  function introActive() {
    return !!window.__introStart;
  }
  var AUTO_ZOOM = { current: 1, from: 1, target: 1, t0: 0, dur: 0, nextAt: 0 };
  window.__autoZoom = AUTO_ZOOM;
  function autoZoom() {
    var now = performance.now();
    if (window.__introStart)
      return ((AUTO_ZOOM.nextAt = now + 5e3), AUTO_ZOOM.current);
    if (window.__happySeedManualCamera || (window.__manualZoomAt || 0) > now - 25e3)
      return (
        (AUTO_ZOOM.dur = 0),
        (AUTO_ZOOM.nextAt = now + 5e3),
        AUTO_ZOOM.current
      );
    if (AUTO_ZOOM.dur > 0) {
      var t = (now - AUTO_ZOOM.t0) / AUTO_ZOOM.dur;
      if (t >= 1) ((AUTO_ZOOM.current = AUTO_ZOOM.target), (AUTO_ZOOM.dur = 0));
      else {
        var sm = t * t * (3 - 2 * t);
        AUTO_ZOOM.current =
          AUTO_ZOOM.from + (AUTO_ZOOM.target - AUTO_ZOOM.from) * sm;
      }
    } else if (now >= AUTO_ZOOM.nextAt) {
      var zoomedIn = AUTO_ZOOM.current >= 1.14;
      ((AUTO_ZOOM.from = AUTO_ZOOM.current),
        (AUTO_ZOOM.target = zoomedIn
          ? 1 + Math.random() * 0.03
          : 1.06 + Math.random() * 0.08),
        (AUTO_ZOOM.t0 = now),
        (AUTO_ZOOM.dur = 2400 + Math.random() * 1400),
        (AUTO_ZOOM.nextAt = now + 5e3 + Math.random() * 2e3));
    }
    return AUTO_ZOOM.current < 1 ? 1 : AUTO_ZOOM.current;
  }
  function effZoom() {
    var z = MATCH_ZOOM * (window.__matchZoomMul || 1) * autoZoom();
    return ((z = z < 0.8 ? 0.8 : z > 6 ? 6 : z), z * introScale());
  }
  ((window.__matchZoom = {
    get: function () {
      return window.__matchZoomMul || 1;
    },
    set: function (m) {
      ((window.__manualZoomAt = performance.now()),
        (window.__matchZoomMul = Math.max(0.34, Math.min(6, m))));
      try {
        window.__matchGame.pitch.camera.instantZoom(effZoom());
      } catch {}
    },
    step: function (d) {
      window.__matchZoom.set((window.__matchZoomMul || 1) * d);
    },
    reset: function () {
      window.__matchZoomMul = 1;
      try {
        window.__matchGame.pitch.camera.instantZoom(effZoom());
      } catch {}
    },
  }),
    (function () {
      try {
        new URLSearchParams(window.location.search).get("play") === "1" &&
          (window.__acPlay = !0);
      } catch {}
    })());
  function acPlay() {
    return !!window.__acPlay;
  }
  function installPixelStadiumSlice(stadium, pitch, config) {
    if (!stadium || !config || stadium._pixelStadiumInit) return !1;
    stadium._pixelStadiumInit = !0;
    try {
      var Pixi = runtime("pixi"),
        Texture = Pixi.Texture,
        Rectangle = Pixi.Rectangle,
        Sprite = Pixi.Sprite,
        Graphics = Pixi.Graphics,
        Container = Pixi.Container,
        nearest = Pixi.SCALE_MODES && Pixi.SCALE_MODES.NEAREST,
        sceneRoot = new Container(),
        bottomRoot = new Container(),
        cameraPresets = {},
        sceneState = {
          ready: !1,
          activeCamera: "normal",
          cameraMode: "ball",
          cameraTarget: { x: pitch.center.x, y: pitch.center.y },
          draggable: !0,
          crowdMotion: !0,
          baseRefreshesRemaining: 6,
          lastBaseRefreshAt: 0,
          lastManualCameraAt: 0,
          manualReturnDelayMs: 2600,
          legacyAnimalCrowdHidden: !1,
        };

      function textureFrom(path) {
        var texture = Texture.fromImage(path);
        texture.baseTexture &&
          nearest !== undefined &&
          (texture.baseTexture.scaleMode = nearest);
        return texture;
      }
      function textureFrame(baseTexture, frame) {
        return new Texture(
          baseTexture.baseTexture,
          new Rectangle(frame[0], frame[1], frame[2], frame[3]),
        );
      }
      function dispatchScene(name) {
        try {
          window.dispatchEvent(
            new CustomEvent(name, {
              detail: window.__happySeedStadiumScene.getSnapshot(),
            }),
          );
        } catch {}
      }
      function hideLegacyAnimalCrowd() {
        try {
          var legacyFans = runtime("fans"),
            legacyContainer = legacyFans && legacyFans._fansContainer;
          if (!legacyContainer) return !1;
          ((legacyContainer.visible = !1),
            (sceneState.legacyAnimalCrowdHidden = legacyContainer.visible === !1));
          return sceneState.legacyAnimalCrowdHidden;
        } catch {
          return !1;
        }
      }

      var oldBottom = (stadium._stadium && stadium._stadium._bottom) || [],
        oldMiddle = (stadium._stadium && stadium._stadium._middle) || [],
        oldTop = (stadium._stadium && stadium._stadium._top) || [];
      for (var oldBottomIndex = 0;
        oldBottomIndex < oldBottom.length;
        oldBottomIndex += 1)
        oldBottom[oldBottomIndex].visible = !1;
      for (var oldMiddleIndex = 0;
        oldMiddleIndex < oldMiddle.length;
        oldMiddleIndex += 1)
        oldMiddle[oldMiddleIndex].visible = !1;
      for (var oldTopIndex = 0;
        oldTopIndex < oldTop.length;
        oldTopIndex += 1)
        oldTop[oldTopIndex].visible = !1;

      var environmentTexture = textureFrom(config.assets.environment),
        environmentSprite = new Sprite(environmentTexture),
        pitchTexture = textureFrom(config.assets.pitchReference),
        pitchSprite = new Sprite(pitchTexture),
        sourcePitchMask = config.composition.sourcePitchMask,
        pitchMask = new Graphics(),
        baseComposition = new Container();
      ((environmentSprite.width = config.sourceSize.width),
        (environmentSprite.height = config.sourceSize.height),
        (pitchSprite.width = config.sourceSize.width),
        (pitchSprite.height = config.sourceSize.height),
        pitchMask.beginFill(16777215, 1),
        pitchMask.drawRect(
          sourcePitchMask.x,
          sourcePitchMask.y,
          sourcePitchMask.width,
          sourcePitchMask.height,
        ),
        pitchMask.endFill(),
        (pitchSprite.mask = pitchMask),
        baseComposition.addChild(environmentSprite),
        baseComposition.addChild(pitchSprite),
        baseComposition.addChild(pitchMask));
      function renderBase() {
        try {
          if (
            !environmentTexture.baseTexture
            || !environmentTexture.baseTexture.hasLoaded
            || !pitchTexture.baseTexture
            || !pitchTexture.baseTexture.hasLoaded
          ) return !1;
          (stadium.baseTexture.clear && stadium.baseTexture.clear(),
            stadium.baseTexture.render(baseComposition, null, !0),
            stadium.disableOverlay && stadium.disableOverlay());
          return !0;
        } catch (baseError) {
          console.error("[stadium-slice] 像素球场基底渲染失败", baseError);
          return !1;
        }
      }
      environmentTexture.baseTexture && environmentTexture.baseTexture.hasLoaded &&
      pitchTexture.baseTexture && pitchTexture.baseTexture.hasLoaded
        ? renderBase()
        : (environmentTexture.baseTexture &&
            environmentTexture.baseTexture.once("loaded", renderBase),
          pitchTexture.baseTexture &&
            pitchTexture.baseTexture.once("loaded", renderBase));

      var goalAtlas = textureFrom(config.assets.goalAtlas),
        goalFrames = config.composition && config.composition.goalFrames,
        goalBackPositions = [[770, 1338], [4198, 1336]],
        goalFrontPositions = [[879, 1515], [4207, 1515]];
      for (var goalBackIndex = 0; goalBackIndex < 2; goalBackIndex += 1) {
        var goalBack = new Sprite(
          textureFrame(goalAtlas, goalFrames.bottom[goalBackIndex]),
        );
        (goalBack.position.set(
          goalBackPositions[goalBackIndex][0],
          goalBackPositions[goalBackIndex][1],
        ),
          bottomRoot.addChild(goalBack));
      }
      for (var goalFrontIndex = 0; goalFrontIndex < 2; goalFrontIndex += 1) {
        var goalFront = new Sprite(
          textureFrame(goalAtlas, goalFrames.middle[goalFrontIndex]),
        );
        (goalFront.anchor.set(0, 1),
          goalFront.position.set(
            goalFrontPositions[goalFrontIndex][0],
            goalFrontPositions[goalFrontIndex][1],
          ),
          stadium.sortables.addChild(goalFront));
      }

      (sceneRoot.addChild(bottomRoot),
        stadium.bottomLayer.addChild(sceneRoot));
      hideLegacyAnimalCrowd();

      for (var presetIndex = 0;
        presetIndex < config.cameraPresets.length;
        presetIndex += 1)
        cameraPresets[config.cameraPresets[presetIndex].id] =
          config.cameraPresets[presetIndex];

      function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
      }

      function focusAt(x, y, mode) {
        var nextX = clamp(Number(x) || pitch.center.x, 0, pitch.width),
          nextY = clamp(Number(y) || pitch.center.y, 0, pitch.height);
        (pitch.camera.free(),
          pitch.camera.lookAt({ x: nextX, y: nextY }),
          (pitch.camera.position.x = nextX),
          (pitch.camera.position.y = nextY),
          pitch.camera.velocity &&
            ((pitch.camera.velocity.x = 0), (pitch.camera.velocity.y = 0)),
          (sceneState.cameraTarget.x = nextX),
          (sceneState.cameraTarget.y = nextY),
          (sceneState.cameraMode = mode || "free"));
        return !0;
      }

      function followBall() {
        ((window.__happySeedManualCamera = !1),
          pitch.camera.followBall(),
          (sceneState.cameraMode = "ball"),
          (sceneState.activeCamera = "normal"));
        return !0;
      }

      function panBy() {
        // 自由拖拽已禁用，此函数不再执行任何操作
        return !1;
      }

      window.__happySeedStadiumScene = {
        setCameraPreset: function (presetId) {
          var preset = cameraPresets[presetId];
          if (!preset) return !1;
          window.__happySeedManualCamera = !1;
          followBall();
          ((window.__manualZoomAt = performance.now()),
            (window.__matchZoomMul = preset.zoomMultiplier),
            pitch.camera.instantZoom(effZoom()),
            (sceneState.activeCamera = preset.id),
            dispatchScene("ab-stadium-camera"));
          return !0;
        },
        focusAt: function (x, y, mode) {
          return focusAt(x, y, mode);
        },
        followBall: function () {
          var changed = followBall();
          dispatchScene("ab-stadium-camera");
          return changed;
        },
        panBy: function (screenX, screenY) {
          var changed = panBy(screenX, screenY);
          dispatchScene("ab-stadium-camera");
          return changed;
        },
        resetCamera: function () {
          ((window.__happySeedManualCamera = !1), window.__matchZoom.reset(), followBall());
          dispatchScene("ab-stadium-camera");
          return !0;
        },
        setCrowdMotion: function (enabled) {
          ((sceneState.crowdMotion = !!enabled),
            dispatchScene("ab-stadium-camera"));
          return !0;
        },
        getSnapshot: function () {
          hideLegacyAnimalCrowd();
          return {
            ready: sceneState.ready,
            id: config.id,
            activeCamera: sceneState.activeCamera,
            cameraMode: sceneState.cameraMode,
            cameraTarget: {
              x: sceneState.cameraTarget.x,
              y: sceneState.cameraTarget.y,
            },
            draggable: sceneState.draggable,
            zoom: window.__matchZoom.get(),
            crowdMotion: sceneState.crowdMotion,
            crowdFrame: 0,
            baseRenderSize: {
              width: stadium.baseTexture.width,
              height: stadium.baseTexture.height,
            },
            runtimeDisplaySize: {
              width: config.runtimeSize.width,
              height: config.runtimeSize.height,
            },
            legacyAnimalCrowdHidden: sceneState.legacyAnimalCrowdHidden,
            layerCount: config.layers.length,
            cameraPresetCount: config.cameraPresets.length,
            preserves: {
              goalCollision: config.invariants.preserveGoalCollision,
              dynamicNet: config.invariants.preserveDynamicNet,
              camera: config.invariants.preserveCamera,
              depthSort: config.invariants.preserveDepthSort,
              humanCrowdOnly:
                config.invariants.hideLegacyAnimalCrowd &&
                sceneState.legacyAnimalCrowdHidden,
            },
          };
        },
      };

      var previousFrame = stadium.frame.bind(stadium);
      stadium.frame = function (frame) {
        previousFrame(frame);
        try {
          hideLegacyAnimalCrowd();
          var now = performance.now();
          if (
            sceneState.baseRefreshesRemaining > 0 &&
            now - sceneState.lastBaseRefreshAt > 180
          ) {
            (renderBase(),
              (sceneState.lastBaseRefreshAt = now),
              (sceneState.baseRefreshesRemaining -= 1));
          }
          if (
            window.__happySeedManualCamera &&
            now - sceneState.lastManualCameraAt >=
              sceneState.manualReturnDelayMs
          ) {
            (followBall(), dispatchScene("ab-stadium-camera"));
          }
        } catch (crowdError) {
          console.error("[stadium-slice] 场景刷新失败", crowdError);
        }
      };

      try {
        var cameraView = window.__matchGame && window.__matchGame.renderer.view;
        if (cameraView) {
          // 只保留滚轮缩放和双击重置，移除拖拽平移
          cameraView.addEventListener(
            "wheel",
            function (wheelEvent) {
              (wheelEvent.preventDefault(),
                window.__matchZoom.step(wheelEvent.deltaY > 0 ? .9 : 1.1),
                dispatchScene("ab-stadium-camera"));
            },
            { passive: !1 },
          );
          cameraView.addEventListener("dblclick", function () {
            window.__happySeedStadiumScene.resetCamera();
          });
        }
      } catch (cameraInputError) {
        console.error("[stadium-slice] 镜头输入初始化失败", cameraInputError);
      }

      ((sceneState.ready = !0), dispatchScene("ab-stadium-slice-ready"));
      return !0;
    } catch (sceneError) {
      stadium._pixelStadiumInit = !1;
      console.error("[stadium-slice] 场景切片初始化失败", sceneError);
      return !1;
    }
  }
  function installRuntimeActorSlice(stadium, pitch, config) {
    if (!stadium || !config || stadium._runtimeActorSliceInit) return !1;
    if (!stadium.players || stadium.players.length < 22) return !1;
    if (!config.actors || config.actors.length !== 22) return !1;
    stadium._runtimeActorSliceInit = !0;
    try {
      var Pixi = runtime("pixi"),
        Texture = Pixi.Texture,
        hiddenAnimalSlots = [
          "eyebrows",
          "eyes",
          "mouth",
          "nose",
          "hair",
          "hair_accessory_1",
          "face_accessory_1",
          "face_accessory_2",
          "face_accessory_3",
        ],
        bodyPartMap = {
          arm_left: "arm_left.png",
          arm_right: "arm_right.png",
          hand_left: "hand_left.png",
          hand_right: "hand_right.png",
          leg_left_knee: "knee.png",
          leg_right_knee: "knee.png",
          neck: "neck.png",
        },
        kitPartMap = {
          arm_left_sleeve: "sleeve_left.png",
          arm_right_sleeve: "sleeve_right.png",
          pelvis_shorts: "shorts.png",
          leg_left_shorts: "shorts_leg.png",
          leg_right_shorts: "shorts_leg.png",
          leg_left_sock: "socks.png",
          leg_right_sock: "socks.png",
          leg_left_shoe: "shoes.png",
          leg_right_shoe: "shoes.png",
        },
        actorEntries = [],
        humanDisplayScale = .62,
        selectedRuntimeActorId = config.actors[0].runtimeActorId;

      function dispatchActors(name) {
        try {
          window.dispatchEvent(
            new CustomEvent(name, {
              detail: window.__happySeedRuntimeActors.getSnapshot(),
            }),
          );
        } catch {}
      }

      function actorLabel(actor) {
        var state = actor.state || {},
          prefix = state.redCard ? "🟥 " : state.yellowCards ? "🟨 " : "",
          suffix = state.injured ? " +" : "";
        return prefix + "#" + actor.number + " " + actor.name + suffix;
      }

      function applyActorTextures(entry) {
        var renderer = entry.renderer,
          actor = entry.actor,
          visual = actor.visual,
          sprites = renderer && renderer.spine && renderer.spine.sprites;
        if (!sprites || !visual) return;
        var facingDirection = renderer.spine.scale.x < 0 ? -1 : 1;
        renderer.defaultScale = humanDisplayScale;
        renderer.spine.scale.x = facingDirection * humanDisplayScale;
        renderer.spine.scale.y = humanDisplayScale;
        if (renderer.sprite && renderer.sprite.scale) {
          renderer.sprite.scale.x = facingDirection * humanDisplayScale;
          renderer.sprite.scale.y = humanDisplayScale;
        }
        if (renderer.overheadIndicator)
          renderer.overheadIndicator.position.y =
            (renderer.sprite && renderer.sprite.position.y || 0) - 118;
        function pixelTexture(path) {
          var texture = Texture.fromImage(path);
          texture && texture.baseTexture && Pixi.SCALE_MODES &&
            (texture.baseTexture.scaleMode = Pixi.SCALE_MODES.NEAREST);
          return texture;
        }
        for (var hiddenIndex = 0;
          hiddenIndex < hiddenAnimalSlots.length;
          hiddenIndex += 1) {
          var hiddenSprite = sprites[hiddenAnimalSlots[hiddenIndex]];
          hiddenSprite && (hiddenSprite.visible = !1);
        }
        for (var bodySlot in bodyPartMap)
          sprites[bodySlot] &&
            ((sprites[bodySlot].texture = pixelTexture(
              visual.playerRoot + "/" + bodyPartMap[bodySlot],
            )),
            (sprites[bodySlot].tint = 16777215),
            (sprites[bodySlot].visible = !0));
        for (var kitSlot in kitPartMap)
          sprites[kitSlot] &&
            ((sprites[kitSlot].texture = pixelTexture(
              visual.kitRoot + "/" + kitPartMap[kitSlot],
            )),
            (sprites[kitSlot].tint = 16777215),
            (sprites[kitSlot].visible = !0));
        sprites.chest_shirt &&
          ((sprites.chest_shirt.texture = pixelTexture(
            visual.kitRoot +
              (renderer.spine.facingCamera
                ? "/shirt_front.png"
                : "/shirt_back.png"),
          )),
          (sprites.chest_shirt.tint = 16777215),
          (sprites.chest_shirt.visible = !0));
        sprites.head &&
          ((sprites.head.texture = pixelTexture(
            renderer.spine.facingCamera ? visual.headFront : visual.headBack,
          )),
          (sprites.head.tint = 16777215),
          (sprites.head.visible = !0));
        sprites.number &&
          ((sprites.number.texture = pixelTexture(visual.number)),
          (sprites.number.tint = 16777215),
          (sprites.number.visible = !0));
        if (actor.isGoalkeeper) {
          sprites.hand_left_glove &&
            ((sprites.hand_left_glove.texture = pixelTexture(
              visual.kitRoot + "/hand_left.png",
            )),
            (sprites.hand_left_glove.tint = 16777215),
            (sprites.hand_left_glove.visible = !0));
          sprites.hand_right_glove &&
            ((sprites.hand_right_glove.texture = pixelTexture(
              visual.kitRoot + "/hand_right.png",
            )),
            (sprites.hand_right_glove.tint = 16777215),
            (sprites.hand_right_glove.visible = !0));
        } else {
          (sprites.hand_left_glove && (sprites.hand_left_glove.visible = !1),
            sprites.hand_right_glove &&
              (sprites.hand_right_glove.visible = !1));
        }
        if (entry.label) {
          (entry.label.text = actorLabel(actor),
            (entry.label.position.y = -92),
            (entry.label.style.fill = actor.side === "red" ? "#ffe66d" : "#f2f6ff"));
        }
      }

      for (var actorIndex = 0; actorIndex < config.actors.length; actorIndex += 1) {
        var actor = config.actors[actorIndex],
          renderer = stadium.players[actor.runtimeIndex],
          label = new Pixi.Text(actorLabel(actor), {
            font: '800 16px "Zpix", "Arial Narrow", sans-serif',
            fill: actor.side === "red" ? "#ffe66d" : "#f2f6ff",
            align: "center",
            stroke: "#071119",
            strokeThickness: 4,
          });
        (label.anchor.set(.5, 1),
          (label.position.y = -92),
          renderer.addChild(label));
        var entry = {
          actor: actor,
          renderer: renderer,
          entity: renderer.entity,
          label: label,
        };
        ((actor.runtimeEntityId = renderer.entity && renderer.entity.id),
          (renderer._happySeedActor = actor),
          actorEntries.push(entry),
          applyActorTextures(entry));
      }
      stadium._happySeedActorEntries = actorEntries;

      function snapshotActor(actor) {
        return {
          runtimeActorId: actor.runtimeActorId,
          runtimeIndex: actor.runtimeIndex,
          runtimeEntityId: actor.runtimeEntityId,
          playerId: actor.playerId,
          name: actor.name,
          number: actor.number,
          side: actor.side,
          teamId: actor.teamId,
          naturalPosition: actor.naturalPosition,
          assignedPosition: actor.assignedPosition,
          isGoalkeeper: actor.isGoalkeeper,
          visualRecipeId: actor.visualRecipeId,
          playerRoot: actor.visual && actor.visual.playerRoot,
          partSetId: actor.partSetId,
          kitType: actor.visual && actor.visual.kitType,
          hiddenTraits: actor.hiddenTraits || [],
          state: Object.assign({}, actor.state),
        };
      }

      function actorSnapshot() {
        var actors = actorEntries.map(function (entry) {
            return snapshotActor(entry.actor);
          }),
          selected = actors.find(function (actor) {
            return actor.runtimeActorId === selectedRuntimeActorId;
          });
        return {
          ready: !0,
          schemaVersion: config.schemaVersion,
          displayScale: humanDisplayScale,
          upstreamDisplayScale: .5,
          effectiveLinearRatio: 1.5376,
          mappedActorCount: actors.length,
          activeActorCount: actors.filter(function (actor) {
            return actor.state.onPitch;
          }).length,
          uniquePlayerCount: new Set(actors.map(function (actor) {
            return actor.playerId;
          })).size,
          selectedRuntimeActorId: selectedRuntimeActorId,
          selectedActor: selected || actors[0],
          actors: actors,
          sides: {
            red: {
              teamId: config.sides.red.teamId,
              teamName: config.sides.red.teamName,
              formation: config.sides.red.formation,
              tacticalStance: pitch.redTeam && pitch.redTeam._happySeedStance || "balanced",
              tacticalEffects: pitch.redTeam && pitch.redTeam._happySeedTacticalEffects || null,
              bench: config.sides.red.bench.map(snapshotActor),
              substitutionHistory: config.sides.red.substitutionHistory,
            },
            blue: {
              teamId: config.sides.blue.teamId,
              teamName: config.sides.blue.teamName,
              formation: config.sides.blue.formation,
              tacticalStance: pitch.blueTeam && pitch.blueTeam._happySeedStance || "balanced",
              tacticalEffects: pitch.blueTeam && pitch.blueTeam._happySeedTacticalEffects || null,
              bench: config.sides.blue.bench.map(snapshotActor),
              substitutionHistory: config.sides.blue.substitutionHistory,
            },
          },
          invariants: config.invariants,
        };
      }

      function hideRetiredActorVisual(entry) {
        if (!entry) return;
        var renderer = entry.renderer,
          spine = renderer && renderer.spine,
          sprites = spine && spine.sprites;
        if (renderer) {
          renderer.visible = !1;
          renderer.renderable = !1;
          renderer.alpha = 0;
        }
        if (renderer && renderer.sprite) renderer.sprite.visible = !1;
        if (spine) spine.visible = !1;
        if (sprites)
          Object.keys(sprites).forEach(function (slot) {
            if (sprites[slot]) sprites[slot].visible = !1;
          });
        if (entry.label) {
          entry.label.visible = !1;
          entry.label.renderable = !1;
        }
        if (entry.eventRing) {
          entry.eventRing.visible = !1;
          entry.eventRing.renderable = !1;
        }
      }

      function removePhysicalActor(entry) {
        if (!entry || !entry.entity) return;
        if (entry.actor._runtimeRemoved) {
          hideRetiredActorVisual(entry);
          return;
        }
        var entity = entry.entity,
          game = window.__matchGame,
          team = entity.team;
        // 先锁死表现层，再尝试修改原生数组。原引擎可能已经先执行过一次
        // removePlayer；那次调用即使抛 Player not found，也绝不能让动物皮肤漏出。
        entry.actor._runtimeRemoved = !0;
        hideRetiredActorVisual(entry);
        try {
          entity.static = !0;
          if (pitch.ball && pitch.ball.owner === entity) pitch.ball.owner = null;
          if (pitch.ball && pitch.ball.inHands === entity) pitch.ball.inHands = null;
          entity.hasBall = !1;
        } catch {}
        try {
          if (team && team.removePlayer && team.players && team.players.indexOf(entity) >= 0)
            team.removePlayer(entity);
        } catch (teamRemoveError) {
          console.error("[runtime-actors] 移出球队阵列失败", teamRemoveError);
        }
        try {
          if (game && game.removePlayer) game.removePlayer(entity);
        } catch (removeError) {
          console.error("[runtime-actors] 移除在场球员失败", removeError);
        } finally {
          hideRetiredActorVisual(entry);
        }
      }

      window.__happySeedRuntimeActors = {
        selectActor: function (runtimeActorId) {
          var exists = actorEntries.some(function (entry) {
            return entry.actor.runtimeActorId === runtimeActorId;
          });
          if (!exists) return !1;
          (selectedRuntimeActorId = runtimeActorId,
            dispatchActors("ab-runtime-actor-state"));
          return !0;
        },
        setActorState: function (runtimeActorId, patch) {
          var entry = actorEntries.find(function (candidate) {
            return candidate.actor.runtimeActorId === runtimeActorId;
          });
          if (!entry || !patch) return !1;
          var state = entry.actor.state;
          patch.stamina != null &&
            (state.stamina = Math.max(0, Math.min(100, Number(patch.stamina) || 0)));
          patch.staminaDelta != null &&
            (state.stamina = Math.max(0, Math.min(100, (Number(state.stamina) || 0) + Number(patch.staminaDelta))));
          patch.morale != null &&
            (state.morale = Math.max(0, Math.min(99, Number(patch.morale) || 0)));
          patch.moraleDelta != null &&
            (state.morale = Math.max(0, Math.min(99, (Number(state.morale) || 70) + Number(patch.moraleDelta))));
          patch.form != null &&
            (state.form = Math.max(0, Math.min(99, Number(patch.form) || 0)));
          patch.formDelta != null &&
            (state.form = Math.max(0, Math.min(99, (Number(state.form) || 70) + Number(patch.formDelta))));
          patch.yellowCards != null &&
            (state.yellowCards = Math.max(0, Math.min(2, Number(patch.yellowCards) || 0)));
          if (patch.injured != null) {
            ((state.injured = !!patch.injured),
              (state.status = state.injured ? "injured" : "active"));
          }
          if (patch.redCard === !0 && !state.redCard) {
            ((state.redCard = !0),
              (state.status = "red-carded"),
              (state.onPitch = !1),
              removePhysicalActor(entry));
          }
          if (state.yellowCards >= 2 && !state.redCard) {
            ((state.redCard = !0),
              (state.status = "red-carded"),
              (state.onPitch = !1),
              removePhysicalActor(entry));
          }
          if (patch.status === "suspended") {
            ((state.status = "suspended"),
              (state.onPitch = !1),
              removePhysicalActor(entry));
          }
          if (entry.actor._runtimeRemoved) hideRetiredActorVisual(entry);
          else applyActorTextures(entry);
          dispatchActors("ab-runtime-actor-state");
          return !0;
        },
        substitute: function (side, outPlayerId, inPlayerId) {
          side = side === "blue" ? "blue" : "red";
          var sideData = config.sides[side],
            entry = actorEntries.find(function (candidate) {
              return candidate.actor.side === side &&
                candidate.actor.playerId === outPlayerId;
            }),
            benchIndex = sideData.bench.findIndex(function (candidate) {
              return candidate.playerId === inPlayerId;
            });
          if (!entry || benchIndex < 0 || !entry.actor.state.onPitch) return !1;
          var incoming = sideData.bench[benchIndex],
            outgoing = entry.actor;
          if (outgoing.isGoalkeeper !== (incoming.naturalPosition === "GK")) return !1;
          if (incoming.state.status !== "bench") return !1;
          var inactiveOutgoing = Object.assign({}, outgoing, {
              state: Object.assign({}, outgoing.state, {
                status: "substituted",
                onPitch: !1,
                substitutedOut: !0,
              }),
            }),
            promotedIncoming = Object.assign({}, incoming, {
              assignedPosition: outgoing.assignedPosition,
              isGoalkeeper: outgoing.isGoalkeeper,
              runtimeActorId: outgoing.runtimeActorId,
              runtimeIndex: outgoing.runtimeIndex,
              runtimeLocalIndex: outgoing.runtimeLocalIndex,
              runtimeEntityId: outgoing.runtimeEntityId,
              side: side,
              formationSlotId: outgoing.formationSlotId,
              state: Object.assign({}, incoming.state, {
                status: "active",
                onPitch: !0,
                stamina: 80,
                substitutedOut: !1,
              }),
            });
          (sideData.bench.splice(benchIndex, 1),
            sideData.inactive.push(inactiveOutgoing),
            sideData.substitutionHistory.push({
              runtimeActorId: outgoing.runtimeActorId,
              outPlayerId: outgoing.playerId,
              inPlayerId: incoming.playerId,
            }),
            (entry.actor = promotedIncoming),
            (entry.renderer._happySeedActor = promotedIncoming),
            (config.actors[promotedIncoming.runtimeIndex] = promotedIncoming),
            (sideData.actors[promotedIncoming.runtimeLocalIndex] = promotedIncoming),
            applyActorTextures(entry),
            (selectedRuntimeActorId = promotedIncoming.runtimeActorId),
            dispatchActors("ab-runtime-substitution"));
          return !0;
        },
        enforceRetiredVisuals: function () {
          var retiredCount = 0;
          actorEntries.forEach(function (entry) {
            if (!entry.actor._runtimeRemoved) return;
            retiredCount += 1;
            hideRetiredActorVisual(entry);
          });
          return retiredCount;
        },
        getSnapshot: actorSnapshot,
      };

      // 点球大战仍使用完整 22 人物理 Runtime，但表现层只保留主罚者与对方门将。
      // 这样不会破坏正式阵容、换人和赛后数据，离开点球场景时也能原样恢复。
      var shootoutPresentation = {
        active: !1,
        attackingSide: "red",
        shooterPlayerId: null,
        savedVisibility: null,
        savedShadowVisibility: null,
        savedShadowChildVisibility: null,
      };

      function shootoutVisibleEntries() {
        var side = shootoutPresentation.attackingSide === "blue" ? "blue" : "red",
          shooter = actorEntries.find(function (entry) {
            return entry.actor.side === side &&
              entry.actor.playerId === shootoutPresentation.shooterPlayerId &&
              !entry.actor.isGoalkeeper;
          }) || actorEntries.find(function (entry) {
            return entry.actor.side === side && entry.actor.state.onPitch &&
              !entry.actor.isGoalkeeper;
          }),
          keeper = actorEntries.find(function (entry) {
            return entry.actor.side !== side && entry.actor.state.onPitch &&
              entry.actor.isGoalkeeper;
          });
        return new Set([shooter, keeper].filter(Boolean));
      }

      function enforceShootoutPresentation() {
        if (!shootoutPresentation.active) return;
        var visibleEntries = shootoutVisibleEntries();
        actorEntries.forEach(function (entry) {
          var visible = !entry.actor._runtimeRemoved && visibleEntries.has(entry);
          if (entry.renderer) entry.renderer.visible = visible;
          if (entry.label) entry.label.visible = visible;
          if (entry.eventRing) entry.eventRing.visible = !1;
        });
        // 原引擎把人物阴影绘制在独立批处理层，隐藏人物不会自动隐藏阴影。
        // 影子批次由“共用对象 + 每位球员等量影子精灵”组成，因此可精确
        // 保留足球、主罚者与门将的影子，并隐藏其余 20 人的幽灵影子。
        // autoShadows 的子项顺序并非稳定的“每位球员连续若干项”。此前按
        // 索引过滤会漏出幽灵影子；点球阶段直接关闭整层，退出时再精确恢复。
        if (stadium.shadows) stadium.shadows.visible = !1;
      }

      function restoreShootoutPresentation() {
        var saved = shootoutPresentation.savedVisibility;
        if (saved)
          actorEntries.forEach(function (entry, index) {
            var item = saved[index];
            if (!item) return;
            if (entry.actor._runtimeRemoved) {
              hideRetiredActorVisual(entry);
              return;
            }
            if (entry.renderer) entry.renderer.visible = item.renderer;
            if (entry.label) entry.label.visible = item.label;
            if (entry.eventRing) entry.eventRing.visible = item.eventRing;
          });
        shootoutPresentation.active = !1;
        shootoutPresentation.shooterPlayerId = null;
        shootoutPresentation.savedVisibility = null;
        if (stadium.shadows && shootoutPresentation.savedShadowVisibility != null)
          stadium.shadows.visible = shootoutPresentation.savedShadowVisibility;
        var shadowChildren = stadium.shadows && stadium.shadows.autoShadows &&
          stadium.shadows.autoShadows.children;
        if (shadowChildren && shootoutPresentation.savedShadowChildVisibility)
          shadowChildren.forEach(function (shadow, index) {
            if (shadow && shootoutPresentation.savedShadowChildVisibility[index] != null)
              shadow.visible = shootoutPresentation.savedShadowChildVisibility[index];
          });
        shootoutPresentation.savedShadowVisibility = null;
        shootoutPresentation.savedShadowChildVisibility = null;
        window.__happySeedReleaseShootoutActors &&
          window.__happySeedReleaseShootoutActors();
      }

      window.__happySeedShootoutPresentation = {
        configure: function (payload) {
          payload = payload || {};
          if (!shootoutPresentation.active)
            (shootoutPresentation.savedVisibility = actorEntries.map(function (entry) {
              return {
                renderer: !entry.renderer || entry.renderer.visible !== !1,
                label: !entry.label || entry.label.visible !== !1,
                eventRing: Boolean(entry.eventRing && entry.eventRing.visible !== !1),
              };
            }),
            shootoutPresentation.savedShadowVisibility = stadium.shadows
              ? stadium.shadows.visible !== !1 : null,
            shootoutPresentation.savedShadowChildVisibility = stadium.shadows &&
              stadium.shadows.autoShadows && stadium.shadows.autoShadows.children
              ? stadium.shadows.autoShadows.children.map(function (shadow) {
                  return !shadow || shadow.visible !== !1;
                }) : null);
          shootoutPresentation.active = !0;
          shootoutPresentation.attackingSide = payload.attackingSide === "blue"
            ? "blue" : "red";
          shootoutPresentation.shooterPlayerId = payload.shooterPlayerId || null;
          enforceShootoutPresentation();
          return {
            active: !0,
            attackingSide: shootoutPresentation.attackingSide,
            shooterPlayerId: shootoutPresentation.shooterPlayerId,
            visibleCount: shootoutVisibleEntries().size,
            goalSide: "right",
            cameraMode: window.__happySeedStadiumScene &&
              window.__happySeedStadiumScene.getSnapshot
              ? window.__happySeedStadiumScene.getSnapshot().cameraMode
              : "decision-director",
          };
        },
        clear: function () {
          if (!shootoutPresentation.active) return !1;
          restoreShootoutPresentation();
          return !0;
        },
        getSnapshot: function () {
          return {
            active: shootoutPresentation.active,
            attackingSide: shootoutPresentation.attackingSide,
            shooterPlayerId: shootoutPresentation.shooterPlayerId,
            visibleCount: shootoutPresentation.active
              ? shootoutVisibleEntries().size : actorEntries.length,
            goalSide: "right",
            cameraMode: window.__happySeedStadiumScene &&
              window.__happySeedStadiumScene.getSnapshot
              ? window.__happySeedStadiumScene.getSnapshot().cameraMode
              : "decision-director",
          };
        },
      };

      var previousActorFrame = stadium.frame.bind(stadium);
      stadium.frame = function (frame) {
        (previousActorFrame(frame),
          actorEntries.forEach(function (entry) {
            entry.actor.state.onPitch && applyActorTextures(entry);
          }),
          enforceShootoutPresentation(),
          actorEntries.forEach(function (entry) {
            entry.actor._runtimeRemoved && hideRetiredActorVisual(entry);
          }));
      };
      (dispatchActors("ab-runtime-actors-ready"),
        window.__bootTrace("runtime actors mapped=22 unique=22"));
      return !0;
    } catch (actorError) {
      (stadium._runtimeActorSliceInit = !1,
        console.error("[runtime-actors] 22 人映射初始化失败", actorError));
      return !1;
    }
  }
  function installMatchVisualEventBridge(stadium, pitch, config) {
    if (!stadium || !config || stadium._matchVisualEventInit) return !1;
    var actorEntries = stadium._happySeedActorEntries || [];
    if (actorEntries.length !== 22 || !config.events || !config.events.length)
      return !1;
    stadium._matchVisualEventInit = !0;
    try {
      var Pixi = runtime("pixi"),
        eventsById = {},
        active = null,
        completedEventIds = [],
        state = {
          ready: !0,
          status: "ready",
          activeEventId: null,
          lastCompletedEventId: null,
          completedEventIds: completedEventIds,
          activeBallPosition: null,
          ballAttachedToRuntimeActorId: null,
          ballFootDistance: null,
          ballVisible: !1,
          cameraLockedToBall: !1,
          performedActions: {},
        };
      for (var eventIndex = 0; eventIndex < config.events.length; eventIndex += 1)
        eventsById[config.events[eventIndex].id] = config.events[eventIndex];

      actorEntries.forEach(function (entry) {
        var ring = new Pixi.Graphics();
        (ring.lineStyle(5, entry.actor.side === "red" ? 16777215 : 16763904, .95),
          ring.drawCircle(0, -44, 28),
          (ring.visible = !1),
          entry.renderer.addChild(ring),
          (entry.eventRing = ring));
      });

      function dispatchVisualEvent(name, event) {
        try {
          window.dispatchEvent(
            new CustomEvent(name, {
              detail: {
                event: event,
                snapshot: window.__happySeedMatchVisualEvents.getSnapshot(),
              },
            }),
          );
        } catch {}
      }

      function compactEvent(event) {
        return {
          id: event.id,
          sequence: event.sequence,
          minute: event.minute,
          type: event.type,
          label: event.label,
          side: event.side,
          actors: event.actors,
          ball: event.ball,
          runtime: event.runtime,
          outcome: event.outcome,
          commentary: event.commentary,
          authority: event.authority,
          invariants: event.invariants,
        };
      }

      function bridgeSnapshot() {
        return {
          ready: state.ready,
          status: state.status,
          activeEventId: state.activeEventId,
          lastCompletedEventId: state.lastCompletedEventId,
          completedEventIds: completedEventIds.slice(),
          completedCount: completedEventIds.length,
          totalCount: config.events.length,
          activeBallPosition: state.activeBallPosition && {
            x: state.activeBallPosition.x,
            y: state.activeBallPosition.y,
            z: state.activeBallPosition.z,
          },
          ballAttachedToRuntimeActorId: state.ballAttachedToRuntimeActorId,
          ballFootDistance: state.ballFootDistance,
          ballVisible: state.ballVisible,
          cameraLockedToBall: state.cameraLockedToBall,
          performedActions: Object.assign({}, state.performedActions),
          events: config.events.map(compactEvent),
        };
      }

      function entryFor(runtimeActorId) {
        return actorEntries.find(function (entry) {
          return entry.actor.runtimeActorId === runtimeActorId;
        });
      }

      function eventEntries(event) {
        var result = [];
        for (var role in event.actors) {
          var entry = entryFor(event.actors[role].runtimeActorId);
          entry && result.indexOf(entry) < 0 && result.push(entry);
        }
        return result;
      }

      function setEventRings(entries, visible) {
        actorEntries.forEach(function (entry) {
          entry.eventRing && (entry.eventRing.visible = !1);
        });
        if (visible)
          entries.forEach(function (entry) {
            entry.eventRing && (entry.eventRing.visible = !0);
          });
      }

      function releaseLiveBall() {
        try {
          var messages = runtime("messages");
          pitch.ball.owner && messages.releaseBall.send(pitch.ball.owner);
          pitch.ball.owner && messages.releaseBall.send(pitch.ball);
          pitch.ball.inHands && pitch.ball.inHands.dropBall();
        } catch {}
      }

      function eventPath(event) {
        var sourceScenarioId = event.source && event.source.sourceScenarioId,
          sceneProfile = event.runtime && event.runtime.sceneProfile,
          isPrelude = isPreludeEvent(event),
          side = event.side === "blue" ? "blue" : "red",
          authoredPath = event.ball.path || [];
        if (sceneProfile === "penalty-kick" ||
          sourceScenarioId === "match_penalty") {
          if (side === "blue")
            return isPrelude
              ? [[.115, .5], [.115, .5]]
              : [[.115, .5], [.06, .46], [.015, .46]];
          return isPrelude
            ? [[.885, .5], [.885, .5]]
            : [[.885, .5], [.94, .46], [.985, .46]];
        }
        if (isPrelude && authoredPath.length)
          return [authoredPath[0], authoredPath[0]];
        return authoredPath;
      }

      function isPreludeEvent(event) {
        return !!(
          event && event.source && event.source.phase === "prelude" ||
          /\.prelude$/.test(event && event.id || "")
        );
      }

      function pointAlongPath(path, progress) {
        if (!path.length) return { x: .5, y: .5, z: 0 };
        if (path.length === 1) return { x: path[0][0], y: path[0][1], z: 0 };
        var scaled = Math.min(.999999, Math.max(0, progress)) * (path.length - 1),
          segment = Math.floor(scaled),
          local = scaled - segment,
          start = path[segment],
          end = path[Math.min(path.length - 1, segment + 1)],
          arc = Math.sin(Math.PI * local);
        return {
          x: start[0] + (end[0] - start[0]) * local,
          y: start[1] + (end[1] - start[1]) * local,
          z: arc,
        };
      }

      function worldPoint(normalized, event) {
        var sceneProfile = event.runtime && event.runtime.sceneProfile,
          lift = sceneProfile === "attacking-corner" ||
            sceneProfile === "defending-corner"
            ? 2.8
            : sceneProfile === "attacking-free-kick" ||
              sceneProfile === "defending-free-kick"
              ? 1.9
              : sceneProfile === "penalty-kick"
                ? 1.25
                : sceneProfile === "touchline-pause" ||
                  sceneProfile === "center-pause" ||
                  sceneProfile === "review-pause"
                  ? .2
                : .55;
        return {
          x: pitch.width * normalized.x,
          y: pitch.height * normalized.y,
          z: Math.max(.16, normalized.z * lift),
        };
      }

      function sceneActorPoints(event, path) {
        var start = path[0] || [.5, .5],
          end = path[path.length - 1] || start,
          direction = end[0] >= start[0] ? 1 : -1,
          goalX = direction > 0 ? .965 : .035,
          defendingGoalX = event.side === "blue" ? .965 : .035,
          opponentGoalX = event.side === "blue" ? .035 : .965,
          sceneProfile = event.runtime && event.runtime.sceneProfile,
          sourceRole = event.ball && event.ball.sourceRole || "primary";
        if (sceneProfile === "penalty-kick" ||
          event.source && event.source.sourceScenarioId === "match_penalty")
          return {
            primary: [start[0], .5],
            support: [start[0] - direction * .17, .34],
            defender: [start[0] - direction * .15, .68],
            goalkeeper: [goalX, .5],
          };
        if (sceneProfile === "goalkeeper-save")
          return {
            primary: [end[0], end[1]],
            support: [start[0] + direction * .055, .67],
            defender: [start[0], start[1]],
            goalkeeper: [direction > 0 ? .035 : .965, .5],
          };
        if (sceneProfile === "goalkeeper-action")
          return {
            primary: [start[0], start[1]],
            support: [start[0] + direction * .09, .68],
            defender: [start[0] + direction * .13, .49],
            goalkeeper: [goalX, .5],
          };
        if ((sceneProfile === "defensive-duel" ||
          sceneProfile === "box-duel") && sourceRole === "defender")
          return {
            primary: [start[0] + direction * .055, start[1] + .035],
            support: [goalX, .5],
            defender: [start[0], start[1]],
            goalkeeper: [direction > 0 ? .035 : .965, .5],
          };
        if (sceneProfile === "defensive-duel" ||
          sceneProfile === "box-duel" ||
          sceneProfile === "box-scramble")
          return {
            primary: [start[0], start[1]],
            support: [goalX, .5],
            defender: [start[0] + direction * .055, start[1] - .035],
            goalkeeper: [direction > 0 ? .965 : .035, .5],
          };
        if (sceneProfile === "touchline-pause")
          return {
            primary: [start[0], .88],
            support: [start[0] + .045, .88],
            defender: [start[0] - .06, .78],
            goalkeeper: [goalX, .5],
          };
        if (sceneProfile === "review-pause")
          return {
            primary: [start[0], start[1]],
            support: [start[0] - direction * .055, start[1] + .07],
            defender: [start[0] + direction * .045, start[1] - .055],
            goalkeeper: [goalX, .5],
          };
        if (sceneProfile === "offside-line")
          return {
            primary: [start[0] + direction * .065, .34],
            support: [start[0] + direction * .065, .66],
            defender: [start[0], .5],
            goalkeeper: [goalX, .5],
          };
        if (sceneProfile === "defending-corner")
          return {
            primary: [end[0], end[1] + .045],
            support: [defendingGoalX, .5],
            defender: [start[0], start[1]],
            goalkeeper: [opponentGoalX, .5],
          };
        if (sceneProfile === "defending-free-kick")
          return {
            primary: [goalX, .5],
            support: [start[0] + direction * .08, .5],
            defender: [start[0], start[1]],
            goalkeeper: [direction > 0 ? .035 : .965, .5],
          };
        if (sourceRole === "defender")
          return {
            primary: [start[0] + direction * .05, start[1] + .04],
            support: [start[0] + direction * .095, start[1] + .12],
            defender: [start[0], start[1]],
            goalkeeper: [goalX, .5],
          };
        return {
          primary: [start[0], start[1]],
          support: sceneProfile === "attacking-corner" ||
            sceneProfile === "defending-corner"
            ? [end[0] - direction * .018, end[1] + .055]
            : [start[0] - direction * .085, start[1] + .105],
          defender: [start[0] + direction * .05, start[1] + .045],
          goalkeeper: [goalX, .5],
        };
      }

      function eventBallPoint(event, path, progress, actorPoints) {
        var sourceRole = event.ball && event.ball.sourceRole || "primary",
          sourcePoint = actorPoints[sourceRole] || actorPoints.primary,
          actionProfile = event.runtime && event.runtime.actionProfile,
          savedOutcome = /saved|save|claim|caught|held|punch|扑出|挡出|抱住|接住|没收/.test(
            eventOutcomeText(event),
          ),
          claimRole = actionProfile === "goalkeeper-claim" ||
            actionProfile === "defensive-wall" ? "primary" : "goalkeeper",
          releaseProgress = isPreludeEvent(event) ? 1 : .18;
        if (progress <= releaseProgress)
          return {
            x: sourcePoint[0],
            y: sourcePoint[1],
            z: 0,
            attached: !0,
            attachedRole: sourceRole,
          };
        if (savedOutcome && progress >= .72) {
          var claimPoint = actorPoints[claimRole] || actorPoints.goalkeeper;
          return {
            x: claimPoint[0],
            y: claimPoint[1],
            z: 0,
            attached: !0,
            attachedRole: claimRole,
          };
        }
        var travelProgress = (progress - releaseProgress) / (1 - releaseProgress),
          point = pointAlongPath(path, travelProgress);
        point.attached = !1;
        return point;
      }

      function eventCameraFollowsBall() {
        try {
          return window.__happySeedStadiumScene.getSnapshot().cameraMode !== "free";
        } catch {
          return !0;
        }
      }

      function animationVariants(entry, name) {
        var back = entry && entry.renderer &&
          entry.renderer.spine && entry.renderer.spine.facingCamera === !1;
        return back ? [name + "_back", name] : [name, name + "_back"];
      }

      function playEventAnimation(role, name, holdMs) {
        if (!active || active.performedActions[role]) return !1;
        var entry = entryFor(active.event.actors[role].runtimeActorId),
          variants = animationVariants(entry, name);
        if (!entry || !entry.renderer || !entry.renderer.spine) return !1;
        for (var animationIndex = 0;
          animationIndex < variants.length;
          animationIndex += 1) {
          var animationName = variants[animationIndex];
          if (!entry.renderer.spine.animationExists(animationName)) continue;
          (playTrack3(window.__matchGame, entry.renderer, animationName, holdMs),
            (active.performedActions[role] = animationName),
            (state.performedActions[role] = animationName));
          return !0;
        }
        return !1;
      }

      function eventOutcomeText(event) {
        return [
          event && event.outcome && event.outcome.id,
          event && event.source && event.source.resultOutcome,
          event && event.commentary && event.commentary.result,
        ].join(" ").toLowerCase();
      }

      function stageEventActions(event, progress) {
        if (!active || isPreludeEvent(event)) return;
        var sourceScenarioId = event.source && event.source.sourceScenarioId,
          choiceId = event.source && event.source.choiceId || "",
          actionProfile = event.runtime && event.runtime.actionProfile,
          outcomeText = eventOutcomeText(event),
          isPenaltyShot = actionProfile === "penalty-shot" ||
            sourceScenarioId === "match_penalty",
          isSaved = /saved|save|claim|caught|held|punch|扑出|挡出|抱住|接住|没收/.test(outcomeText),
          isGoal = /(^|[^a-z])goal|进球|破门|命中/.test(outcomeText),
          isShot = [
            "shot",
            "pass-shot",
            "cross-header",
            "free-kick-shot",
            "penalty-shot",
            "clearance",
          ].indexOf(actionProfile) >= 0 || isPenaltyShot,
          goalkeeperRole = actionProfile === "goalkeeper-claim" ||
            actionProfile === "defensive-wall" ? "primary" : "goalkeeper";
        if (isShot && progress >= .14)
          playEventAnimation("primary", "shoot", 850);
        if (actionProfile === "pass-shot" && progress >= .52)
          playEventAnimation("support", "shoot", 850);
        if ((actionProfile === "cross-header" ||
          actionProfile === "defensive-header") && progress >= .43)
          playEventAnimation("support", "jump", 900);
        if ((actionProfile === "free-kick-shot" ||
          actionProfile === "defensive-wall") &&
          /wall|人墙|blocked/.test(outcomeText) && progress >= .4)
          playEventAnimation("defender", "jump", 900);
        if (actionProfile === "tackle-fall" && !isPenaltyShot) {
          progress >= .22 && playEventAnimation("defender", "slide", 1000);
          progress >= .34 && playEventAnimation("primary", "fall_forward", 1200);
        }
        if ((actionProfile === "defensive-duel" ||
          actionProfile === "tactical-duel") && !isPenaltyShot) {
          var contactDecision = /tackle|foul|slide|commit|risk_second|card|penalty/.test(
            choiceId + " " + outcomeText,
          );
          if (contactDecision) {
            progress >= .22 && playEventAnimation("primary", "slide", 1000);
            progress >= .34 && playEventAnimation("defender", "fall_forward", 1200);
          } else if (progress >= .24)
            playEventAnimation("primary", "sprint", 900);
        }
        if (actionProfile === "press-duel" && progress >= .28)
          playEventAnimation("primary", "sprint", 900);
        if (actionProfile === "line-step" && progress >= .28) {
          playEventAnimation("primary", "sprint", 900);
          playEventAnimation("support", "sprint", 900);
        }
        if (actionProfile === "appeal" && progress >= .3) {
          playEventAnimation("primary", "waving", 1050);
          playEventAnimation("support", "waving", 1050);
        }
        if (actionProfile === "pause" && progress >= .35)
          playEventAnimation("primary", "waving", 900);
        if (actionProfile === "goalkeeper-claim" && isSaved && progress >= .7)
          playEventAnimation("primary", "hands_in_front", 1050);
        if (actionProfile === "goalkeeper-distribution" && progress >= .24) {
          if (/long|kick/.test(choiceId + " " + outcomeText))
            playEventAnimation("primary", "shoot", 900);
          else if (/slow|hold/.test(choiceId + " " + outcomeText))
            playEventAnimation("primary", "hands_in_front", 900);
          else
            playEventAnimation("primary", "throw", 900);
        }
        if (actionProfile === "defensive-header" && progress >= .4)
          playEventAnimation("primary", "jump", 900);
        if ((isSaved || isGoal) && progress >= .5)
          playEventAnimation(goalkeeperRole, "jump", 1050);
        if (isSaved && progress >= .72 && !active.performedActions.goalkeeperClaim) {
          var keeperEntry = entryFor(event.actors[goalkeeperRole].runtimeActorId),
            variants = animationVariants(keeperEntry, "hands_in_front");
          active.performedActions.goalkeeperClaim = !0;
          for (var variantIndex = 0; variantIndex < variants.length; variantIndex += 1)
            if (keeperEntry.renderer.spine.animationExists(variants[variantIndex])) {
              (playTrack3(window.__matchGame, keeperEntry.renderer, variants[variantIndex], 850),
                (state.performedActions.goalkeeperClaim = variants[variantIndex]));
              break;
            }
        }
      }

      function setFrameEntryPosition(frame, entry, normalized) {
        var entityId = entry && entry.entity && entry.entity.id,
          frameTeams = [frame && frame.redTeam, frame && frame.blueTeam],
          framePlayer = null;
        if (entityId == null) return;
        for (var teamIndex = 0; teamIndex < frameTeams.length; teamIndex += 1) {
          var players = (frameTeams[teamIndex] && frameTeams[teamIndex].players) || [];
          for (var playerIndex = 0; playerIndex < players.length; playerIndex += 1)
            if (players[playerIndex].id === entityId) {
              framePlayer = players[playerIndex];
              break;
            }
          if (framePlayer) break;
        }
        if (!framePlayer || !framePlayer.position) return;
        (framePlayer.position.x = pitch.width * normalized[0],
          (framePlayer.position.y = pitch.height * normalized[1]),
          (framePlayer.position.z = 0),
          (framePlayer.speed = 0));
      }

      function setFrameActorPosition(frame, actorRole, normalized) {
        var entry = active && entryFor(active.event.actors[actorRole].runtimeActorId);
        setFrameEntryPosition(frame, entry, normalized);
        return entry;
      }

      function supportingActorPoint(entry, event, path) {
        var start = path[0] || [.5, .5],
          end = path[path.length - 1] || start,
          direction = end[0] >= start[0] ? 1 : -1,
          localIndex = Math.abs(Number(entry.actor.runtimeIndex) || 0) % 11,
          attacking = entry.actor.side === event.side,
          sourceScenarioId = event.source && event.source.sourceScenarioId,
          sceneProfile = event.runtime && event.runtime.sceneProfile,
          x,
          y = .14 + ((localIndex * 3) % 9) * .09;
        if (entry.actor.isGoalkeeper)
          return [direction > 0 ? .035 : .965, .5];
        if (sceneProfile === "penalty-kick" || sourceScenarioId === "match_penalty") {
          x = start[0] - direction * (attacking ? .17 : .13);
        } else if (sceneProfile === "attacking-corner" ||
          sceneProfile === "defending-corner") {
          x = end[0] + direction * (attacking ? -.045 : .025);
          y = .22 + ((localIndex * 2) % 7) * .095;
        } else if (sceneProfile === "attacking-free-kick" ||
          sceneProfile === "defending-free-kick") {
          x = attacking
            ? start[0] - direction * (.11 + (localIndex % 2) * .035)
            : start[0] + direction * (.07 + (localIndex % 3) * .018);
          y = attacking
            ? .18 + ((localIndex * 3) % 7) * .105
            : .31 + (localIndex % 5) * .095;
        } else if (sceneProfile === "breakaway") {
          x = start[0] - direction * (attacking ? .13 : .09);
        } else if (sceneProfile === "touchline-pause") {
          x = start[0] + (attacking ? -.09 : .09);
          y = .76 + (localIndex % 3) * .07;
        } else if (sceneProfile === "offside-line") {
          x = start[0] + direction * (attacking ? -.045 : .045);
          y = .16 + (localIndex % 8) * .095;
        } else if (sceneProfile === "box-duel" ||
          sceneProfile === "box-scramble") {
          x = start[0] + direction * (attacking ? -.07 : .055);
          y = .25 + (localIndex % 6) * .1;
        } else {
          x = attacking
            ? start[0] - direction * (.11 + (localIndex % 3) * .025)
            : start[0] + direction * (.08 + (localIndex % 3) * .025);
        }
        return [
          Math.max(.025, Math.min(.975, x)),
          Math.max(.08, Math.min(.92, y)),
        ];
      }

      function stageEventFrame(frame, event, worldBall) {
        window.__introStart = 0;
        var path = active.path,
          actorPoints = sceneActorPoints(event, path),
          stagedEntityIds = {};
        for (var role in actorPoints) {
          var stagedEntry = setFrameActorPosition(frame, role, actorPoints[role]);
          stagedEntry && stagedEntry.entity &&
            (stagedEntityIds[stagedEntry.entity.id] = !0);
        }
        for (var actorEntryIndex = 0;
          actorEntryIndex < actorEntries.length;
          actorEntryIndex += 1) {
          var actorEntry = actorEntries[actorEntryIndex];
          if (
            actorEntry.entity &&
            !stagedEntityIds[actorEntry.entity.id] &&
            actorEntry.actor.state.onPitch
          )
            setFrameEntryPosition(
              frame,
              actorEntry,
              supportingActorPoint(actorEntry, event, path),
            );
        }
        if (frame && frame.ball && frame.ball.position) {
          ((frame.ball.position.x = worldBall.x),
            (frame.ball.position.y = worldBall.y),
            (frame.ball.position.z = worldBall.z),
            frame.ball.velocity &&
              ((frame.ball.velocity.x = 0),
              (frame.ball.velocity.y = 0),
              (frame.ball.velocity.z = 0)),
            (frame.ball.inHands = -1));
        }
        var cameraFollowsBall = eventCameraFollowsBall();
        if (cameraFollowsBall && frame && frame.camera && frame.camera.position) {
          ((frame.camera.position.x = worldBall.x),
            (frame.camera.position.y = worldBall.y),
            (frame.camera.zoom = effZoom()));
        }
        try {
          pitch.ball.placeAtPosition(worldBall.x, worldBall.y, worldBall.z);
          pitch.ball.velocity &&
            ((pitch.ball.velocity.x = 0),
            (pitch.ball.velocity.y = 0),
            (pitch.ball.velocity.z = 0));
        } catch {}
        var sourceRole = event.ball && event.ball.sourceRole || "primary",
          sourcePoint = actorPoints[sourceRole] || actorPoints.primary,
          distancePoint = worldBall.attachedRole
            ? actorPoints[worldBall.attachedRole] || sourcePoint
            : sourcePoint;
        ((state.activeBallPosition = worldBall),
          (state.ballFootDistance = Math.sqrt(
            Math.pow(worldBall.x - pitch.width * distancePoint[0], 2) +
            Math.pow(worldBall.y - pitch.height * distancePoint[1], 2)
          )),
          (state.ballAttachedToRuntimeActorId = worldBall.attached
            ? event.actors[worldBall.attachedRole || sourceRole].runtimeActorId
            : null),
          (state.ballVisible = !0),
          (state.cameraLockedToBall = cameraFollowsBall));
        cameraFollowsBall && window.__happySeedStadiumScene &&
          window.__happySeedStadiumScene.focusAt(
            worldBall.x,
            worldBall.y,
            "event-ball",
          );
      }

      function clearPresentation() {
        setEventRings([], !1);
      }

      function finishActiveEvent() {
        if (!active) return;
        var finished = active.event;
        (clearPresentation(),
          completedEventIds.push(finished.id),
          (state.status = "completed"),
          (state.activeEventId = null),
          (state.lastCompletedEventId = finished.id),
          (state.ballAttachedToRuntimeActorId = null),
          (state.ballFootDistance = null),
          (state.cameraLockedToBall = !1),
          active.resolve(bridgeSnapshot()),
          (active = null),
          dispatchVisualEvent("ab-match-visual-event-completed", finished));
      }

      window.__happySeedMatchVisualEvents = {
        play: function (eventOrId) {
          var event = typeof eventOrId === "string"
            ? eventsById[eventOrId]
            : eventOrId;
          if (!event || active || completedEventIds.indexOf(event.id) >= 0)
            return Promise.reject(new Error("MatchVisualEvent 当前不可播放"));
          var primary = entryFor(event.actors.primary.runtimeActorId),
            target = entryFor(event.ball.targetRuntimeActorId),
            participants = eventEntries(event);
          if (!primary || !target || participants.length < 4)
            return Promise.reject(new Error("MatchVisualEvent actor 映射不完整"));
          return new Promise(function (resolve) {
            var now = performance.now(),
              path = eventPath(event),
              actorPoints = sceneActorPoints(event, path),
              openingPoint = eventBallPoint(event, path, 0, actorPoints),
              opening = worldPoint(openingPoint, event);
            opening.attached = openingPoint.attached;
            opening.attachedRole = openingPoint.attachedRole;
            ((window.__introStart = 0),
              releaseLiveBall(),
              setEventRings(participants, !0),
              window.__happySeedRuntimeActors &&
                window.__happySeedRuntimeActors.selectActor(
                  event.ball.sourceRuntimeActorId,
                ),
              window.__happySeedStadiumScene &&
                window.__happySeedStadiumScene.setCameraPreset(
                  event.runtime.cameraPreset,
                ),
              window.__happySeedStadiumScene &&
                window.__happySeedStadiumScene.focusAt(
                  opening.x,
                  opening.y,
                  "event-ball",
                ),
              (state.status = "playing"),
              (state.activeEventId = event.id),
              (state.activeBallPosition = opening),
              (state.ballAttachedToRuntimeActorId = event.ball.sourceRuntimeActorId),
              (state.ballFootDistance = 0),
              (state.ballVisible = !0),
              (state.cameraLockedToBall = !0),
              (state.performedActions = {}),
              (active = {
                event: event,
                path: path,
                primary: primary,
                target: target,
                participants: participants,
                performedActions: {},
                startedAt: now,
                durationMs: event.runtime.durationMs,
                resolve: resolve,
              }),
              dispatchVisualEvent("ab-match-visual-event-started", event));
          });
        },
        reset: function () {
          if (active) return !1;
          (completedEventIds.splice(0),
            (state.status = "ready"),
            (state.lastCompletedEventId = null));
          dispatchVisualEvent("ab-match-visual-events-ready", null);
          return !0;
        },
        getSnapshot: bridgeSnapshot,
      };

      var previousVisualEventFrame = stadium.frame.bind(stadium);
      stadium.frame = function (frame) {
        if (!active) {
          previousVisualEventFrame(frame);
          return;
        }
        try {
          var now = performance.now(),
            progress = Math.max(
              0,
              Math.min(1, (now - active.startedAt) / active.durationMs),
            ),
            actorPoints = sceneActorPoints(active.event, active.path),
            normalizedBall = eventBallPoint(
              active.event,
              active.path,
              progress,
              actorPoints,
            ),
            worldBall = worldPoint(normalizedBall, active.event);
          worldBall.attached = normalizedBall.attached;
          worldBall.attachedRole = normalizedBall.attachedRole;
          (stageEventFrame(frame, active.event, worldBall),
            previousVisualEventFrame(frame));
          stageEventActions(active.event, progress);
          active.participants.forEach(function (entry, index) {
            entry.eventRing.alpha = .58 +
              (Math.sin((now / 130) + index) + 1) * .2;
          });
          progress >= 1 && finishActiveEvent();
        } catch (frameError) {
          console.error("[match-visual-event] 事件表现失败", frameError);
          previousVisualEventFrame(frame);
          finishActiveEvent();
        }
      };
      (dispatchVisualEvent("ab-match-visual-events-ready", null),
        window.__bootTrace("match visual events ready=" + config.events.length));
      return !0;
    } catch (eventBridgeError) {
      (stadium._matchVisualEventInit = !1,
        console.error("[match-visual-event] 统一事件桥初始化失败", eventBridgeError));
      return !1;
    }
  }
  window.__touchInput = window.__touchInput || {
    active: !1,
    vx: 0,
    vy: 0,
    shoot: !1,
    sprint: !1,
    pass: !1,
    lob: !1,
    switchPlayer: !1,
    tackle: !1,
  };
  function kitsForSide(redTeam, blueTeam, side) {
    side = side === "away" ? "away" : "home";
    function rgb(hex) {
      var n = parseInt(hex, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    function d2(a, b) {
      var x = a[0] - b[0],
        y = a[1] - b[1],
        z = a[2] - b[2];
      return x * x + y * y + z * z;
    }
    try {
      var red = rgb(redTeam.kitColors[side]),
        bh = rgb(blueTeam.kitColors.home),
        ba = rgb(blueTeam.kitColors.away);
      return [side, d2(red, bh) >= d2(red, ba) ? "home" : "away"];
    } catch {
      return null;
    }
  }
  function setupMatch(mode) {
    var playerStates = runtime("players/states"),
      playerGlobals = runtime("players/global"),
      pitch = mode.game.pitch;
    mode.game.__happySeedTrainingActive = !1;
    mode.game.__happySeedTrainingPlayerIndex = null;
    mode.game.__happySeedTrainingDefenderIndex = null;
    if (!(window.__matchFormations && window.__matchFormations.red)) {
      var redFormation = randomizeFormation(pitch.redTeam),
        blueFormation = randomizeFormation(pitch.blueTeam);
      window.__bootTrace(
        "formations(random): red " + redFormation + " blue " + blueFormation,
      );
    }
    mode.game.removeAllPlayers();
    for (var i = 0; i < mode.game.allPlayers.length; i += 1) {
      var player = mode.game.allPlayers[i];
      (player.placeAtPosition(
        pitch.center.x + pitch.random.uniform(-2, 2),
        pitch.height - pitch.random.uniform(1, 3),
      ),
        mode.game.addPlayer(player),
        playerGlobals.forceAI(player, null),
        player.states.change(playerStates.ReturnHome));
    }
    var newStatsSide = function () {
      return {
        shots: 0,
        corners: 0,
        throwIns: 0,
        goalKicks: 0,
        slides: 0,
        passes: 0,
        ownTicks: 0,
      };
    };
    var regularHalfSeconds = (60 * mode.options.time) / 2,
      realSecondsPerMatchMinute = regularHalfSeconds / 45,
      maximumAddedMinutes = 5;
    mode.game.__happySeedStoppageClock = {
      regularHalfSeconds: regularHalfSeconds,
      // 加时赛单段 15 分钟（上下各一段，90-105 / 105-120）
      extraHalfSeconds: regularHalfSeconds / 3,
      extraTime: !1,
      realSecondsPerMatchMinute: realSecondsPerMatchMinute,
      maximumAddedMinutes: maximumAddedMinutes,
      estimates: { 1: 1, 2: 1 },
      announced: { 1: !1, 2: !1 },
      ended: { 1: !1, 2: !1 },
    };
    ((window.__matchStats = { red: newStatsSide(), blue: newStatsSide() }),
      pitch.ball.placeAtPosition(pitch.center.x, pitch.height + 10, 0),
      pitch.beginMatch(
        regularHalfSeconds + realSecondsPerMatchMinute * maximumAddedMinutes,
        mode.options.drawAllowed,
        mode.options.ai,
      ));
    try {
      for (
        var snapTeams = [pitch.redTeam, pitch.blueTeam], sti = 0;
        sti < snapTeams.length;
        sti += 1
      )
        for (
          var sps = (snapTeams[sti] && snapTeams[sti].allPlayers) || [],
            spi = 0;
          spi < sps.length;
          spi += 1
        ) {
          var sp = sps[spi];
          !sp ||
            !sp.home ||
            !sp.position ||
            ((sp.position.x = sp.home.x),
            (sp.position.y = sp.home.y),
            typeof sp.position.z == "number" && (sp.position.z = 0),
            sp.velocity && ((sp.velocity.x = 0), (sp.velocity.y = 0)));
        }
    } catch {}
    (pitch.camera.followBall(), pitch.camera.instantZoom(effZoom()));
    try {
      delete document.body.dataset.trainingRuntime;
      delete document.body.dataset.trainingPitchPlayers;
      delete document.body.dataset.trainingPitchState;
      delete document.body.dataset.trainingPlayerControlled;
      delete document.body.dataset.trainingPlayerPosition;
    } catch {}
  }

  function stoppageHalf(game) {
    var engine = game && game.pitch && game.pitch.secondHalf ? 2 : 1,
      clock = game && game.__happySeedStoppageClock;
    // 加时赛把引擎两段映射为第 3/4 段（90-105 / 105-120）
    return clock && clock.extraTime ? engine + 2 : engine;
  }

  function stoppageClockSnapshot(game) {
    var pitch = game && game.pitch,
      clock = game && game.__happySeedStoppageClock;
    if (!pitch || !clock)
      return { minute: 0, regulationMinute: 0, addedMinute: 0, addedTotal: 0, half: 1 };
    var half = stoppageHalf(game),
      isExtra = half >= 3,
      halfOffset = half === 2 ? 45 : half === 3 ? 90 : half === 4 ? 105 : 0,
      halfSpan = isExtra ? 15 : 45,
      halfSeconds = isExtra ? clock.extraHalfSeconds : clock.regularHalfSeconds,
      elapsed = Math.max(0, Number(pitch.time || 0)),
      regularProgress = Math.min(1, elapsed / halfSeconds),
      regularMinute = Math.floor(regularProgress * halfSpan) + halfOffset,
      addedTotal = Math.max(1, Math.min(
        clock.maximumAddedMinutes,
        Number(clock.estimates[half] || 1),
      )),
      addedMinute = elapsed < halfSeconds
        ? 0
        : Math.min(
          addedTotal,
          Math.floor((elapsed - halfSeconds) / clock.realSecondsPerMatchMinute) + 1,
        ),
      regulationMinute = half === 2 ? 90 : half === 4 ? 120 : half === 3 ? 105 : 45;
    return {
      half: half,
      extraTime: isExtra,
      minute: addedMinute > 0 ? regulationMinute + addedMinute : regularMinute,
      regulationMinute: addedMinute > 0 ? regulationMinute : regularMinute,
      addedMinute: addedMinute,
      addedTotal: addedTotal,
      inStoppage: addedMinute > 0,
    };
  }

  window.__happySeedSetStoppageMinutes = function (payload) {
    var game = window.__matchGame,
      clock = game && game.__happySeedStoppageClock,
      half = Number(payload && payload.half) === 2 ? 2 : 1;
    if (!clock || clock.ended[half]) return !1;
    clock.estimates[half] = Math.max(1, Math.min(
      clock.maximumAddedMinutes,
      Math.round(Number(payload && payload.minutes) || 1),
    ));
    return !0;
  };

  window.__happySeedGetStoppageSnapshot = function () {
    return stoppageClockSnapshot(window.__matchGame);
  };

  // 直接进入加时赛：引擎整场 reset 后重开球（比分在 reset 中被清零，先存后恢复）
  window.__happySeedStartExtraTime = function () {
    var game = window.__matchGame,
      pitch = game && game.pitch,
      clock = game && game.__happySeedStoppageClock;
    if (!pitch || !clock || clock.extraTime) return !1;
    var redScore = pitch.redTeam ? pitch.redTeam.score | 0 : 0,
      blueScore = pitch.blueTeam ? pitch.blueTeam.score | 0 : 0;
    clock.extraTime = !0;
    clock.estimates[3] = 1;
    clock.estimates[4] = 1;
    try {
      pitch.beginMatch(
        clock.extraHalfSeconds
          + clock.realSecondsPerMatchMinute * clock.maximumAddedMinutes,
        pitch.drawAllowed,
        2,
      );
      if (pitch.redTeam) pitch.redTeam.score = redScore;
      if (pitch.blueTeam) pitch.blueTeam.score = blueScore;
    } catch (error) {
      console.warn("[standalone-match] extra-time start failed", error);
      return !1;
    }
    return !0;
  };

  function enforceStoppageClock(game) {
    var pitch = game && game.pitch,
      clock = game && game.__happySeedStoppageClock;
    if (!pitch || !clock || !pitch.matchStarted) return;
    if (game.__happySeedTrainingActive) return;
    var half = stoppageHalf(game),
      snapshot = stoppageClockSnapshot(game),
      director = window.__happySeedDecisionDirectorV3
        && window.__happySeedDecisionDirectorV3.getSnapshot
        && window.__happySeedDecisionDirectorV3.getSnapshot();
    if (snapshot.inStoppage && !clock.announced[half]) {
      clock.announced[half] = !0;
      emitRuntimeMatchEvent(game, "period-change", null, {
        side: null,
        minute: half === 2 ? 90 : half === 4 ? 120 : half === 3 ? 105 : 45,
        detail: {
          period: "stoppage-time",
          half: half,
          addedMinutes: snapshot.addedTotal,
        },
      });
    }
    var halfSeconds = half >= 3 ? clock.extraHalfSeconds : clock.regularHalfSeconds,
      endAt = halfSeconds
        + snapshot.addedTotal * clock.realSecondsPerMatchMinute;
    if (
      clock.ended[half]
      || Number(pitch.time || 0) < endAt
      || director && director.phase && director.phase !== "idle"
    ) return;
    clock.ended[half] = !0;
    try {
      if (half === 1 || half === 3) pitch.endHalf();
      else pitch.endMatch();
    } catch (error) {
      console.warn("[standalone-match] stoppage-time end failed", error);
    }
  }
  function createPlayPhase() {
    var State = runtime("core/states").State,
      geometry = runtime("core/math/geometry"),
      messages = runtime("messages"),
      users = runtime("users"),
      keyboard = runtime("core/input/keyboard");
    return State.extend("StandalonePlayPhase", {
      enter: function (mode) {
        ((this.mode = mode),
          (this.stream = mode.game.stream),
          (this._aiming = !1),
          (this._aimSlow = null),
          (this._shootHeld = 0),
          mode.game.pitch.resume(),
          mode.game.stadium.resume());
      },
      update: function (mode, elapsed) {
        var pitch = mode.game.pitch;
        if (!pitch.paused) {
          if (acPlay()) {
            (this._humanInit ||
              ((this._humanInit = !0),
              keyboard.enable(),
              (users.list[0].enabled = !0)),
              keyboard.update(elapsed));
            var u0 = users.list[0],
              live = pitch.matchStarted && !pitch.ballOutOfPlay,
              bpos = pitch.ball.position,
              trainingTarget = mode.game.__happySeedTrainingActive
                ? mode.game.allPlayers[mode.game.__happySeedTrainingPlayerIndex]
                : null;
            if (trainingTarget) {
              this._wasLive = live;
              u0.enabled = !0;
              if (u0.team !== trainingTarget.team && u0.changeTeam)
                try {
                  u0.changeTeam(trainingTarget.team);
                } catch {}
              if (u0.player !== trainingTarget && u0.takeControl)
                try {
                  u0.takeControl(trainingTarget);
                } catch {}
            } else if (live && !this._wasLive) {
              var wrs = this._restartSpot,
                wc = pitch.center;
              if (
                wrs &&
                Math.abs(wrs.x - wc.x) < 3 &&
                Math.abs(wrs.y - wc.y) < 3
              )
                try {
                  window.dispatchEvent(new CustomEvent("ab-kickoff-played"));
                } catch {}
            }
            if (!trainingTarget && ((this._wasLive = live), !live))
              (u0.team && u0.changeTeam(null),
                (this._restartSpot = { x: bpos.x, y: bpos.y }));
            else if (!trainingTarget && !u0.team) {
              var rs = this._restartSpot,
                dxr = rs ? bpos.x - rs.x : 999,
                dyr = rs ? bpos.y - rs.y : 999,
                movedSq = dxr * dxr + dyr * dyr,
                carrier = pitch.ball.owner,
                ownerRed = !!(carrier && carrier.team === pitch.redTeam);
              if ((ownerRed && movedSq > 0.3 * 0.3) || movedSq > 1 * 1) {
                u0.changeTeam(pitch.redTeam);
                var tgt = ownerRed && !carrier.isGoalkeeper ? carrier : null;
                if (!tgt)
                  for (
                    var rfps =
                        pitch.redTeam.fieldPlayers ||
                        pitch.redTeam.players ||
                        [],
                      bnd = 1 / 0,
                      rfi = 0;
                    rfi < rfps.length;
                    rfi += 1
                  ) {
                    var rfp = rfps[rfi];
                    if (!(!rfp || rfp.isGoalkeeper || !rfp.position)) {
                      var rd = Math.hypot(
                        rfp.position.x - bpos.x,
                        rfp.position.y - bpos.y,
                      );
                      rd < bnd && ((bnd = rd), (tgt = rfp));
                    }
                  }
                if (tgt && u0.takeControl && u0.player !== tgt)
                  try {
                    u0.takeControl(tgt);
                  } catch {}
              }
            }
            users.update(elapsed);
            if (trainingTarget)
              try {
                document.body.dataset.trainingPlayerControlled = String(
                  !!(u0.enabled && u0.team === trainingTarget.team &&
                    u0.player === trainingTarget && trainingTarget.user === u0),
                );
                document.body.dataset.trainingPlayerPosition = trainingTarget.position
                  ? [Number(trainingTarget.position.x).toFixed(3),
                    Number(trainingTarget.position.y).toFixed(3)].join(",")
                  : "";
              } catch {}
            // 摇杆推满 = 加速（补充引擎默认 L1 映射）
            if (u0.controller) {
              var _sv = u0.controller.velocity,
                _sm = Math.sqrt(_sv.x * _sv.x + _sv.y * _sv.y);
              if (_sm > 0.85) u0.controller.sprint.isActive = !0;
            }
            var ti = window.__touchInput;
            if (ti && ti.active && u0.controller) {
              var c = u0.controller;
              ((c.velocity.x = ti.vx), (c.velocity.y = ti.vy));
              var sp = Math.sqrt(ti.vx * ti.vx + ti.vy * ti.vy);
              ((c.speed = sp > 1 ? 1 : sp),
                sp > 0.001 &&
                  ((c.direction.x = ti.vx / sp), (c.direction.y = ti.vy / sp)),
                (c.shoot.isActive = !!ti.shoot),
                (c.sprint.isActive = !!ti.sprint),
                ti.pass && ((c.pass.isActive = !0), (ti.pass = !1)),
                ti.lob && ((c.lob.isActive = !0), (ti.lob = !1)),
                ti.switchPlayer &&
                  ((c.togglePlayer.isActive = !0), (ti.switchPlayer = !1)),
                ti.tackle && ((c.slide.isActive = !0), (ti.tackle = !1)));
            }
            ((this._switchCd = Math.max(0, (this._switchCd || 0) - elapsed)),
              u0.controller &&
                u0.controller.togglePlayer.isActive &&
                (this._switchCd = 1.2));
            var cp = u0.player;
            if (
              !mode.game.__happySeedTrainingActive &&
              live &&
              cp &&
              !cp.hasBall &&
              u0.team &&
              (this._switchCd <= 0 || cp.isGoalkeeper)
            ) {
              for (
                var bx = pitch.ball.position.x,
                  by = pitch.ball.position.y,
                  fps = u0.team.fieldPlayers || u0.team.players,
                  near = null,
                  nd = 1 / 0,
                  fi = 0;
                fi < fps.length;
                fi += 1
              ) {
                var fp = fps[fi];
                if (!(!fp || fp.isGoalkeeper)) {
                  // 训练基地：跳过被隐藏的球员，防止控制权切到不可见球员
                  var _stadPlayers = mode.game.stadium && mode.game.stadium.players;
                  if (_stadPlayers && _stadPlayers[fi] && _stadPlayers[fi].visible === false) continue;
                  var dx = fp.position.x - bx,
                    dy = fp.position.y - by,
                    d = Math.sqrt(dx * dx + dy * dy);
                  d < nd && ((nd = d), (near = fp));
                }
              }
              if (near && near !== cp) {
                var cdx = cp.position.x - bx,
                  cdy = cp.position.y - by,
                  dCp = Math.sqrt(cdx * cdx + cdy * cdy);
                (cp.isGoalkeeper || nd < dCp - 1) &&
                  (u0.takeControl(near), (this._switchCd = 0.25));
              }
            }
            var aimP = u0.player,
              aimC = u0.controller,
              aimHold =
                live && aimC && aimP && aimP.hasBall && aimC.shoot.isActive;
            ((this._shootHeld = aimHold ? (this._shootHeld || 0) + elapsed : 0),
              aimHold && this._shootHeld > 0.12
                ? (this._aimSlow == null &&
                    (this._aimSlow = pitch.timeScale.change(0.4)),
                  (this._aiming = !0))
                : this._aiming &&
                  (this._aimSlow != null &&
                    (pitch.timeScale.reset(this._aimSlow),
                    (this._aimSlow = null)),
                  (this._aiming = !1)));
          }
          var frame = this.stream.beginWrite(),
            directorSnapshot =
              window.__happySeedDecisionDirectorV3 &&
              window.__happySeedDecisionDirectorV3.getSnapshot
                ? window.__happySeedDecisionDirectorV3.getSnapshot()
                : null,
            freezeSimulationForDirector = directorSnapshot &&
              directorSnapshot.phase !== "idle" &&
              !directorSnapshot.continuationReady &&
              !directorSnapshot.livePhysics;
          pitch.setFrame(frame);
          if (!freezeSimulationForDirector) {
            enforceGoalkeeperControlledBallSafety(mode.game);
            pitch.update(elapsed);
            enforceGoalkeeperControlledBallSafety(mode.game);
          }
          if (introActive()) {
            pitch.camera.position.x = pitch.center.x;
            pitch.camera.position.y = pitch.center.y;
            if (pitch.camera.velocity) {
              pitch.camera.velocity.x = 0;
              pitch.camera.velocity.y = 0;
            }
          }
          pitch.camera.instantZoom(effZoom());
          try {
            var stadR = mode.game.stadium;
            !stadR._pixelStadiumV2Init &&
              stadR._redTeam &&
              window.__happySeedPixelStadiumConfig &&
              window.__happySeedRuntimeV2 &&
              window.__happySeedRuntimeV2.installStadium({
                stadium: stadR,
                pitch: pitch,
                config: window.__happySeedPixelStadiumConfig,
                runtime: runtime,
                effZoom: effZoom,
              });
            !stadR._runtimeActorSliceInit &&
              window.__happySeedRuntimeActorConfig &&
              installRuntimeActorSlice(
                stadR,
                pitch,
                window.__happySeedRuntimeActorConfig,
              );
            !stadR._decisionDirectorV3Init &&
              stadR._runtimeActorSliceInit &&
              window.__happySeedRuntimeV3 &&
              window.__happySeedRuntimeV3.installDecisionDirector({
                stadium: stadR,
                pitch: pitch,
                runtime: runtime,
                effZoom: effZoom,
                playTrack3: playTrack3,
              });
            !stadR._matchVisualEventInit &&
              stadR._runtimeActorSliceInit &&
              window.__happySeedTechnicalLab &&
              window.__happySeedMatchVisualEventConfig &&
              installMatchVisualEventBridge(
                stadR,
                pitch,
                window.__happySeedMatchVisualEventConfig,
              );
            if (
              window.__happySeedHumanSlicePreview &&
              !stadR._humanSliceInit &&
              stadR &&
              stadR.sortables &&
              stadR._redTeam &&
              stadR.players &&
              stadR.players.length > 1 &&
              window.__happySeedHumanRecipes &&
              window.__happySeedHumanRecipes.length
            ) {
              stadR._humanSliceInit = !0;
              var PRC = runtime("renderers/player").PlayerRenderer,
                sdata =
                  runtime("pixi").loader.resources["data/player.json"].data,
                RefPixi = runtime("pixi"),
                RefTex = RefPixi.Texture,
                humanRecipes = window.__happySeedHumanRecipes,
                humanActions = window.__happySeedHumanActions || [],
                humanActionMap = {},
                studioSoloPreview = !!window.__happySeedStudioSoloPreview,
                studioStillPreview = !!window.__happySeedStudioStillPreview,
                hiddenAnimalSlots = [
                  "eyebrows",
                  "eyes",
                  "mouth",
                  "nose",
                  "hair",
                  "hair_accessory_1",
                  "face_accessory_1",
                  "face_accessory_2",
                  "face_accessory_3",
                ],
                humanPartMap = {
                  arm_left: "arm_left.png",
                  arm_right: "arm_right.png",
                  hand_left: "hand_left.png",
                  hand_right: "hand_right.png",
                  leg_left_knee: "knee.png",
                  leg_right_knee: "knee.png",
                  neck: "neck.png",
                },
                humanKitMap = {
                  chest_shirt: "shirt_front.png",
                  arm_left_sleeve: "sleeve_left.png",
                  arm_right_sleeve: "sleeve_right.png",
                  pelvis_shorts: "shorts.png",
                  leg_left_shorts: "shorts_leg.png",
                  leg_right_shorts: "shorts_leg.png",
                  leg_left_sock: "socks.png",
                  leg_right_sock: "socks.png",
                  leg_left_shoe: "shoes.png",
                  leg_right_shoe: "shoes.png",
                };
              for (var hai = 0; hai < humanActions.length; hai += 1)
                humanActionMap[humanActions[hai].id] = humanActions[hai];
              var humanControl = {
                  action: "run",
                  profileId: humanRecipes[0].id,
                  facing: "front",
                  autoCycle: !1,
                  revision: 1,
                  changedAt: performance.now(),
                  lastAutoCycleAt: performance.now(),
                },
                humanRefs = [],
                sourceRendererFor = function (recipe) {
                  var wantsKeeper = recipe.role === "goalkeeper",
                    fallback = stadR.players[1],
                    teamFallback = null;
                  for (var sri = 0; sri < stadR.players.length; sri += 1) {
                    var candidate = stadR.players[sri],
                      candidatePlayer = candidate && candidate.player,
                      candidateSkinName =
                        candidate && candidate.spine && candidate.spine.skinName,
                      belongsToTeam =
                        candidateSkinName &&
                        candidateSkinName.indexOf(recipe.teamId) === 0,
                      isKeeperSkin =
                        !!(candidatePlayer && candidatePlayer.isGoalkeeper) ||
                        /goalkeeper/i.test(candidateSkinName || "");
                    if (belongsToTeam && !teamFallback) teamFallback = candidate;
                    if (
                      belongsToTeam &&
                      isKeeperSkin === wantsKeeper
                    )
                      return candidate;
                  }
                  return teamFallback || fallback;
                },
                applyHumanTextures = function (entry) {
                  var sp2 = entry.renderer.spine.sprites,
                    recipe = entry.recipe;
                  if (!sp2) return;
                  for (var hiddenIndex = 0;
                    hiddenIndex < hiddenAnimalSlots.length;
                    hiddenIndex += 1) {
                    var hiddenSprite = sp2[hiddenAnimalSlots[hiddenIndex]];
                    hiddenSprite && (hiddenSprite.visible = !1);
                  }
                  for (var bodySlot in humanPartMap)
                    sp2[bodySlot] &&
                      ((sp2[bodySlot].texture = RefTex.fromImage(
                        recipe.assets.parts && recipe.assets.parts[bodySlot] ||
                          recipe.assets.playerRoot + "/" + humanPartMap[bodySlot],
                      )),
                      (sp2[bodySlot].tint = 16777215),
                      (sp2[bodySlot].visible = !0));
                  for (var kitSlot in humanKitMap)
                    sp2[kitSlot] &&
                      ((sp2[kitSlot].texture = RefTex.fromImage(
                        recipe.assets.parts && recipe.assets.parts[kitSlot] ||
                          recipe.assets.kitRoot + "/" + humanKitMap[kitSlot],
                      )),
                      (sp2[kitSlot].tint = 16777215),
                      (sp2[kitSlot].visible = !0));
                  sp2.chest_shirt &&
                    (sp2.chest_shirt.texture = RefTex.fromImage(
                      recipe.assets.parts && recipe.assets.parts[
                        entry.renderer.spine.facingCamera ? "shirt_front" : "shirt_back"
                      ] || recipe.assets.kitRoot +
                        (entry.renderer.spine.facingCamera ? "/shirt_front.png" : "/shirt_back.png"),
                    ));
                  sp2.head &&
                    ((sp2.head.texture = RefTex.fromImage(
                      entry.renderer.spine.facingCamera
                        ? recipe.assets.headFront
                        : recipe.assets.headBack,
                    )),
                    (sp2.head.tint = 16777215),
                    (sp2.head.visible = !0));
                  sp2.number &&
                    ((sp2.number.texture = RefTex.fromImage(recipe.assets.number)),
                    (sp2.number.tint = 16777215),
                    (sp2.number.visible = !0));
                  if (recipe.role === "goalkeeper") {
                    sp2.hand_left_glove &&
                      ((sp2.hand_left_glove.texture = RefTex.fromImage(
                        recipe.assets.parts && recipe.assets.parts.hand_left_glove ||
                          recipe.assets.kitRoot + "/hand_left.png",
                      )),
                      (sp2.hand_left_glove.tint = 16777215),
                      (sp2.hand_left_glove.visible = !0));
                    sp2.hand_right_glove &&
                      ((sp2.hand_right_glove.texture = RefTex.fromImage(
                        recipe.assets.parts && recipe.assets.parts.hand_right_glove ||
                          recipe.assets.kitRoot + "/hand_right.png",
                      )),
                      (sp2.hand_right_glove.tint = 16777215),
                      (sp2.hand_right_glove.visible = !0));
                  } else {
                    (sp2.hand_left_glove && (sp2.hand_left_glove.visible = !1),
                      sp2.hand_right_glove &&
                        (sp2.hand_right_glove.visible = !1));
                  }
                },
                makeHumanRef = function (recipe, recipeIndex) {
                  var sourceRenderer = sourceRendererFor(recipe),
                    sourceTeam =
                      recipe.teamId === "brazil"
                        ? stadR._blueTeam
                        : stadR._redTeam,
                    renderer = new PRC({
                      stadium: stadR,
                      entity: null,
                      spine: sdata,
                    });
                  (renderer.spine.replaceSkins(sourceTeam.skins),
                    renderer.spine.setSkin(sourceRenderer.spine.skinName));
                  var label = new RefPixi.Text(recipe.shortLabel, {
                    font: '700 13px "Arial Narrow", sans-serif',
                    fill: recipe.teamId === "brazil" ? "#f2f6ff" : "#ffe66d",
                    align: "center",
                    stroke: "#0a1320",
                    strokeThickness: 4,
                  });
                  (label.anchor.set(.5, 1),
                    (label.position.y = -112),
                    (label.visible = !studioSoloPreview),
                    renderer.addChild(label));
                  var ball = RefPixi.Sprite.fromImage(
                    "/match-runtime-min/data/balls/classic_1/texture.png",
                  );
                  (ball.anchor.set(.5, .5),
                    (ball.width = 12),
                    (ball.height = 12),
                    (ball.visible = !1),
                    renderer.addChild(ball));
                  var refObj = {
                      id: 900 + recipeIndex,
                      position: {
                        x: pitch.center.x + recipe.previewOffset.x,
                        y: pitch.center.y + recipe.previewOffset.y,
                        z: 0,
                      },
                      state: { name: "Run", id: 0, data: null },
                      events: { events: null },
                      facing: 1,
                      direction: recipeIndex === 1 ? -1 : 1,
                      speed: 3.2,
                      movingForwards: !0,
                      heading: {
                        x: recipeIndex === 1 ? -1 : 1,
                        y: 0,
                      },
                      isGoalkeeper: recipe.role === "goalkeeper",
                    },
                    entry = {
                      recipe: recipe,
                      renderer: renderer,
                      label: label,
                      ball: ball,
                      frameObject: refObj,
                      appliedRevision: 0,
                    };
                  (applyHumanTextures(entry),
                    stadR.sortables.addChild(renderer));
                  return entry;
              };
              humanRefs.push(makeHumanRef(humanRecipes[0], 0));
              stadR._happySeedHumanRefs = humanRefs;
              if (studioSoloPreview) {
                for (var soloPlayerIndex = 0;
                  soloPlayerIndex < stadR.players.length;
                  soloPlayerIndex += 1)
                  stadR.players[soloPlayerIndex].visible = !1;
              }
              var getHumanSliceSnapshot = function () {
                  var selectedAction = humanActionMap[humanControl.action] || {};
                  return {
                    ready: !0,
                    action: humanControl.action,
                    actionLabel: selectedAction.label || humanControl.action,
                    activeProfileId: humanControl.profileId,
                    facing: humanControl.facing,
                    autoCycle: humanControl.autoCycle,
                    profileCount: humanRecipes.length,
                    compatibleActionCount: humanActions.length,
                    profiles: humanRecipes.map(function (recipe) {
                      return {
                        id: recipe.id,
                        label: recipe.label,
                        teamId: recipe.teamId,
                        role: recipe.role,
                        number: recipe.number,
                        partSetId: recipe.partSetId,
                      };
                    }),
                  };
                },
                dispatchHumanSlice = function (name) {
                  try {
                    window.dispatchEvent(
                      new CustomEvent(name, { detail: getHumanSliceSnapshot() }),
                    );
                  } catch {}
                };
              window.__happySeedHumanSlice = {
                setProfile: function (profileId) {
                  var exists = humanRecipes.some(function (recipe) {
                    return recipe.id === profileId;
                  });
                  if (!exists) return !1;
                  ((humanControl.profileId = profileId),
                    (humanControl.revision += 1),
                    (humanControl.changedAt = performance.now()),
                    dispatchHumanSlice("ab-human-slice-action"));
                  return !0;
                },
                setAction: function (actionId) {
                  if (!humanActionMap[actionId]) return !1;
                  ((humanControl.action = actionId),
                    (humanControl.revision += 1),
                    (humanControl.changedAt = performance.now()),
                    dispatchHumanSlice("ab-human-slice-action"));
                  return !0;
                },
                setFacing: function (facing) {
                  if (facing !== "front" && facing !== "back") return !1;
                  ((humanControl.facing = facing),
                    (humanControl.revision += 1),
                    (humanControl.changedAt = performance.now()),
                    dispatchHumanSlice("ab-human-slice-action"));
                  return !0;
                },
                setAutoCycle: function (enabled) {
                  ((humanControl.autoCycle = !!enabled),
                    (humanControl.lastAutoCycleAt = performance.now()),
                    dispatchHumanSlice("ab-human-slice-action"));
                  return !0;
                },
                getSnapshot: getHumanSliceSnapshot,
              };
              dispatchHumanSlice("ab-human-slice-ready");
              var updateHumanBall = function (entry, action, now) {
                  var elapsed = (now - humanControl.changedAt) / 1e3,
                    ball = entry.ball,
                    direction = entry.frameObject.direction || 1;
                  ball.visible = !1;
                  if (action.ballMode === "at-foot") {
                    ((ball.visible = !0),
                      (ball.position.x = direction * (19 + ((elapsed * 8) % 5))),
                      (ball.position.y = -8 + Math.sin(elapsed * 10) * 2));
                  } else if (action.ballMode === "pass" && elapsed < .9) {
                    ((ball.visible = !0),
                      (ball.position.x = direction * (18 + elapsed * 70)),
                      (ball.position.y = -10 - Math.sin(elapsed * Math.PI) * 10));
                  } else if (action.ballMode === "shot" && elapsed < 1) {
                    ((ball.visible = !0),
                      (ball.position.x = direction * (18 + elapsed * 92)),
                      (ball.position.y = -10 - Math.sin(elapsed * Math.PI) * 32));
                  } else if (
                    action.ballMode === "save" &&
                    entry.recipe.role === "goalkeeper" &&
                    elapsed < 1
                  ) {
                    ((ball.visible = !0),
                      (ball.position.x = direction * (45 - elapsed * 28)),
                      (ball.position.y = -58 + elapsed * 24));
                  }
                },
                origFrame = stadR.frame.bind(stadR);
              stadR.frame = function (fr) {
                origFrame(fr);
                try {
                  var now = performance.now();
                  if (studioStillPreview) {
                    window.__introStart = 0;
                    try {
                      pitch.camera.free();
                      pitch.camera.lookAt(pitch.center);
                      pitch.camera.position.x = pitch.center.x;
                      pitch.camera.position.y = pitch.center.y;
                      pitch.camera.velocity &&
                        ((pitch.camera.velocity.x = 0),
                          (pitch.camera.velocity.y = 0));
                      pitch.camera.instantZoom(effZoom());
                    } catch {}
                  }
                  if (studioSoloPreview) {
                    for (var hiddenPlayerIndex = 0;
                      hiddenPlayerIndex < stadR.players.length;
                      hiddenPlayerIndex += 1)
                      stadR.players[hiddenPlayerIndex].visible = !1;
                  }
                  if (
                    humanControl.autoCycle &&
                    now - humanControl.lastAutoCycleAt > 2200
                  ) {
                    var currentActionIndex = humanActions.findIndex(function (item) {
                      return item.id === humanControl.action;
                    });
                    ((humanControl.action =
                      humanActions[(currentActionIndex + 1) % humanActions.length].id),
                      (humanControl.revision += 1),
                      (humanControl.changedAt = now),
                      (humanControl.lastAutoCycleAt = now),
                      dispatchHumanSlice("ab-human-slice-action"));
                  }
                  var action = humanActionMap[humanControl.action] || humanActions[0],
                    bp = fr.ball.position,
                    dt = fr.elapsed || .016;
                  for (var hrefIndex = 0; hrefIndex < humanRefs.length; hrefIndex += 1) {
                    var entry = humanRefs[hrefIndex],
                      refObj = entry.frameObject,
                      selectedRecipe = humanRecipes.find(function (recipe) {
                        return recipe.id === humanControl.profileId;
                      }) || humanRecipes[0];
                    if (entry.recipe.id !== selectedRecipe.id) {
                      var nextSourceRenderer = sourceRendererFor(selectedRecipe),
                        nextSourceTeam =
                          selectedRecipe.teamId === "brazil"
                            ? stadR._blueTeam
                            : stadR._redTeam;
                      (entry.renderer.spine.replaceSkins(nextSourceTeam.skins),
                        entry.renderer.spine.setSkin(
                          nextSourceRenderer.spine.skinName,
                        ),
                        (entry.recipe = selectedRecipe),
                        (entry.label.text = selectedRecipe.shortLabel),
                        (refObj.isGoalkeeper =
                          selectedRecipe.role === "goalkeeper"),
                        applyHumanTextures(entry));
                    }
                    var previewAction =
                        action.goalkeeperOnly && selectedRecipe.role !== "goalkeeper"
                          ? humanActionMap.idle
                          : action,
                      targetX = Math.max(
                        2,
                        Math.min(
                          pitch.width - 2,
                          studioStillPreview
                            ? pitch.center.x
                            : bp.x + selectedRecipe.previewOffset.x,
                        ),
                      ),
                      targetY = Math.max(
                        2,
                        Math.min(
                          pitch.height - 2,
                          studioStillPreview
                            ? pitch.center.y
                            : bp.y + selectedRecipe.previewOffset.y,
                        ),
                      ),
                      dx2 = targetX - refObj.position.x,
                      dy2 = targetY - refObj.position.y,
                      dist = Math.sqrt(dx2 * dx2 + dy2 * dy2),
                      step = dist > .05 ? Math.min(10 * dt, dist) : 0;
                    if (studioSoloPreview) {
                      ((refObj.position.x = targetX),
                        (refObj.position.y = targetY));
                    } else if (step) {
                      ((refObj.position.x += (dx2 / dist) * step),
                        (refObj.position.y += (dy2 / dist) * step));
                    }
                    if (entry.appliedRevision !== humanControl.revision) {
                      ((entry.appliedRevision = humanControl.revision),
                        (refObj.state.id += 1));
                    }
                    ((refObj.facing = humanControl.facing === "back" ? -1 : 1),
                      (refObj.state.name = previewAction.runtimeState),
                      (refObj.state.data = previewAction.runtimeStateData || null),
                      (refObj.speed = previewAction.speed || 0),
                      (refObj.movingForwards = !0),
                      (refObj.heading.x = refObj.direction),
                      (refObj.heading.y = 0),
                      entry.renderer.render(fr, refObj),
                      applyHumanTextures(entry),
                      updateHumanBall(entry, previewAction, now));
                  }
                } catch (humanFrameError) {
                  for (var hiddenRefIndex = 0;
                    hiddenRefIndex < humanRefs.length;
                    hiddenRefIndex += 1)
                    humanRefs[hiddenRefIndex].renderer.visible = !1;
                }
              };
            }
            if (
              !stadR._runtimeRosterAuditInit &&
              stadR._runtimeActorSliceInit
            ) {
              var physicalPlayerCount =
                  (window.__matchGame && window.__matchGame.allPlayers
                    ? window.__matchGame.allPlayers.length
                    : 0),
                rendererPlayerCount = stadR.players ? stadR.players.length : 0,
                actorMappingCount = stadR._happySeedActorEntries
                  ? stadR._happySeedActorEntries.length
                  : 0,
                technicalPreviewCount = stadR._happySeedHumanRefs
                  ? stadR._happySeedHumanRefs.length
                  : 0,
                isTechnicalLab = !!window.__happySeedTechnicalLab,
                humanSlicePreviewAllowed =
                  !!window.__happySeedHumanSlicePreview,
                rosterAudit = {
                  schemaVersion: "happyseed-runtime-roster-audit-v1",
                  physicalPlayerCount: physicalPlayerCount,
                  rendererPlayerCount: rendererPlayerCount,
                  actorMappingCount: actorMappingCount,
                  technicalPreviewCount: technicalPreviewCount,
                  formalRuntime: !isTechnicalLab,
                  humanSlicePreviewAllowed: humanSlicePreviewAllowed,
                  valid:
                    physicalPlayerCount === 22 &&
                    rendererPlayerCount === 22 &&
                    actorMappingCount === 22 &&
                    (humanSlicePreviewAllowed || technicalPreviewCount === 0),
                };
              (stadR._runtimeRosterAuditInit = !0,
                (window.__happySeedRuntimeRosterAudit = rosterAudit));
              try {
                window.dispatchEvent(
                  new CustomEvent("ab-runtime-roster-audit", {
                    detail: rosterAudit,
                  }),
                );
              } catch {}
              rosterAudit.valid ||
                console.error(
                  "[runtime-roster] 正式比赛必须保持 22 名物理球员、22 名渲染角色和 22 份映射",
                  rosterAudit,
                );
            }
          } catch (humanSliceError) {
            console.error("[human-slice] 骨架兼容样板初始化失败", humanSliceError);
          }
          var S = window.__matchStats;
          if (S) {
            var sBall = pitch.ball,
              sOwner = sBall.owner,
              sHolder = sOwner || sBall.inHands;
            sHolder &&
              sHolder.team &&
              ((sHolder.team === pitch.redTeam ? S.red : S.blue).ownTicks += 1);
          }
          (this.stream.endWrite(pitch),
            users.release(),
            messages.step.send(mode.game, frame));
        }
        if (
          (mode.game.stadium.update(elapsed),
          mode.game._introBowPending && !introActive())
        ) {
          mode.game._introBowPending = !1;
          try {
            var bows = [];
            (function walkAll(n, depth) {
              if (!(!n || depth > 7)) {
                if (n.spine && n.player) {
                  bows.push(n);
                  return;
                }
                for (
                  var kids2 = n.children || [], bi = 0;
                  bi < kids2.length;
                  bi += 1
                )
                  walkAll(kids2[bi], depth + 1);
              }
            })(mode.game.stadium, 0);
            for (var bj = 0; bj < bows.length; bj += 1)
              bows[bj].spine.animationExists("waving") &&
                (bows[bj].spine.state.setAnimationByName(3, "waving", !0),
                (mode.game._celebrations = mode.game._celebrations || []).push({
                  spine: bows[bj].spine,
                  until: performance.now() + 1350,
                  loop: !0,
                }));
          } catch {}
        }
        var cels = mode.game._celebrations;
        if (cels && cels.length)
          for (var ci = cels.length - 1; ci >= 0; ci -= 1) {
            var entry = cels[ci],
              tr3 = entry.spine.state.tracks && entry.spine.state.tracks[3],
              played = !tr3 || !tr3.animation || tr3.time >= tr3.endTime,
              overdue = performance.now() > entry.until + 2500;
            if (
              (performance.now() > entry.until && (played || entry.loop)) ||
              overdue
            ) {
              try {
                (entry.spine.removeAnimation(3),
                  entry.spine.skeleton.setBonesToSetupPose());
              } catch {}
              cels.splice(ci, 1);
            }
          }
        if (mode.game._shakeT > 0) {
          mode.game._shakeT = Math.max(0, mode.game._shakeT - elapsed);
          var sk = mode.game._shakeT / 0.45,
            amp = 16 * sk * sk;
          ((mode.game.stadium.position.x = (Math.random() * 2 - 1) * amp),
            (mode.game.stadium.position.y = (Math.random() * 2 - 1) * amp));
        }
      },
      render: function (mode, elapsed) {
        if (!mode.game.pitch.paused && !mode.game.stadium.paused) {
          var frame = this.stream.readAll(mode.game.alpha);
          (frame && messages.frame.send(mode.game.stadium, frame),
            mode.game.stadium.render(elapsed));
        }
      },
    });
  }
  function collectPlayerRenderers(game) {
    var out = [];
    return (
      (function walk(n, depth) {
        if (!(!n || depth > 7)) {
          if (n.spine && n.player) {
            out.push(n);
            return;
          }
          for (var kids = n.children || [], i = 0; i < kids.length; i += 1)
            walk(kids[i], depth + 1);
        }
      })(game.stadium, 0),
      out
    );
  }
  function playTrack3(game, renderer, name, holdMs) {
    !renderer ||
      !renderer.spine.animationExists(name) ||
      (renderer.spine.state.setAnimationByName(3, name, !1),
      (game._celebrations = game._celebrations || []).push({
        spine: renderer.spine,
        until: performance.now() + holdMs,
      }));
  }
  function snapPlayersHome(game) {
    try {
      for (
        var teams = [game.pitch.redTeam, game.pitch.blueTeam], ti = 0;
        ti < teams.length;
        ti += 1
      )
        for (
          var ps = (teams[ti] && teams[ti].allPlayers) || [], pi = 0;
          pi < ps.length;
          pi += 1
        ) {
          var p = ps[pi];
          !p ||
            !p.home ||
            !p.position ||
            ((p.position.x = p.home.x),
            (p.position.y = p.home.y),
            typeof p.position.z == "number" && (p.position.z = 0),
            p.velocity && ((p.velocity.x = 0), (p.velocity.y = 0)));
        }
    } catch {}
  }
  function countSlideStat(game, slider) {
    try {
      if (!slider || !slider.team) return;
      var now = performance.now();
      if (slider.__slideStatAt && now - slider.__slideStatAt < 900) return;
      slider.__slideStatAt = now;
      var side = slider.team === game.pitch.redTeam ? "red" : "blue";
      window.__matchStats[side].slides += 1;
    } catch {}
  }
  function showPeriodTransition(label, callback) {
    var overlay = document.querySelector(".match-period-transition");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "match-period-transition";
      overlay.setAttribute("aria-live", "polite");
      overlay.innerHTML = '<strong></strong><span>双方交换场地，比赛将从中圈继续</span>';
      document.body.appendChild(overlay);
    }
    var title = overlay.querySelector("strong");
    if (title) title.textContent = label;
    overlay.classList.add("is-visible");
    window.setTimeout(function () {
      try { callback(); } finally {
        window.setTimeout(function () {
          overlay.classList.remove("is-visible");
        }, 980);
      }
    }, 820);
  }
  var runtimeMatchEventSequence = 0;
  function runtimeActorIdForEntity(entity) {
    if (typeof entity === "string") return entity;
    if (!entity) return null;
    var actors = (window.__happySeedRuntimeActorConfig || {}).actors || [];
    for (var i = 0; i < actors.length; i += 1)
      if (actors[i].runtimeEntityId === entity.id) return actors[i].runtimeActorId;
    return null;
  }
  function runtimeSideForEntity(game, entity) {
    if (!entity || !entity.team) return null;
    return entity.team === game.pitch.redTeam ? "red" : "blue";
  }
  function runtimeBallPoint(game) {
    var pitch = game && game.pitch,
      position = pitch && pitch.ball && pitch.ball.position;
    if (!pitch || !position) return null;
    return [
      Math.max(0, Math.min(1, position.x / pitch.width)),
      Math.max(0, Math.min(1, position.y / pitch.height)),
      Number(position.z || 0),
    ];
  }
  function runtimeStateName(game) {
    return (game.pitch.states.current && game.pitch.states.current.name) || "Match";
  }
  function isRuntimeGoalkeeper(entity) {
    var runtimeActorId = runtimeActorIdForEntity(entity),
      actors = (window.__happySeedRuntimeActorConfig || {}).actors || [],
      actor = actors.find(function (candidate) {
        return candidate.runtimeActorId === runtimeActorId;
      });
    return Boolean(actor && actor.isGoalkeeper);
  }
  function enforceGoalkeeperControlledBallSafety(game) {
    if (!game || !game.pitch || !game.pitch.ball) return !1;
    var pitch = game.pitch,
      ball = pitch.ball,
      goalkeeper =
        (ball.inHands && ball.inHands.team ? ball.inHands : null) ||
        (ball.owner && ball.owner.team ? ball.owner : null) ||
        (game.allPlayers || []).find(function (player) {
          return player && player.hasBall && isRuntimeGoalkeeper(player);
        });
    // 扑救后起身保护期：门将扑救后 2.5 秒内，即使没有 inHands/owner/hasBall，
    // 只要球在门将附近，也视为门将控制球，对方球员不得抢球
    if (!goalkeeper && game.__happySeedGkSaveAt && game.__happySeedGkSaveEntity) {
      var elapsed = performance.now() - game.__happySeedGkSaveAt;
      if (elapsed < 2500 && isRuntimeGoalkeeper(game.__happySeedGkSaveEntity)) {
        var gkPos = game.__happySeedGkSaveEntity.position;
        if (gkPos) {
          var distToBall = Math.hypot(ball.position.x - gkPos.x, ball.position.y - gkPos.y);
          if (distToBall < pitch.width * 0.06) {
            goalkeeper = game.__happySeedGkSaveEntity;
          }
        }
      } else {
        game.__happySeedGkSaveAt = 0;
        game.__happySeedGkSaveEntity = null;
      }
    }
    if (
      !goalkeeper ||
      !goalkeeper.position ||
      !goalkeeper.team ||
      !isRuntimeGoalkeeper(goalkeeper)
    )
      return !1;
    // 球员模式：玩家控制门将且有方向输入时，跳过安全限制，允许门将移动
    if (window.__acPlay) {
      var ti = window.__touchInput;
      if (ti && ti.active && (Math.abs(ti.vx) > 0.1 || Math.abs(ti.vy) > 0.1)) {
        return !1;
      }
    }
    var ownGoal = goalkeeper.team.goal,
      goalX = ownGoal && ownGoal.center
        ? ownGoal.center.x
        : goalkeeper.position.x < pitch.center.x ? 0 : pitch.width,
      ownsLeftGoal = goalX <= pitch.center.x,
      safeMargin = Math.max(1.1, Number(goalkeeper.radius || .35) * 3),
      safeX = ownsLeftGoal ? safeMargin : pitch.width - safeMargin,
      goalkeeperUnsafe = ownsLeftGoal
        ? goalkeeper.position.x < safeX
        : goalkeeper.position.x > safeX,
      ballUnsafe = ownsLeftGoal
        ? ball.position.x < safeX
        : ball.position.x > safeX;
    if (!goalkeeperUnsafe && !ballUnsafe) return !1;
    goalkeeper.position.x = safeX;
    if (goalkeeper.velocity) {
      goalkeeper.velocity.x = 0;
      goalkeeper.velocity.y = 0;
    }
    ball.placeAtPosition(
      safeX,
      goalkeeper.position.y,
      Math.max(Number(ball.radius || .12), .12),
    );
    if (ball.velocity) {
      ball.velocity.x = 0;
      ball.velocity.y = 0;
      ball.velocity.z = 0;
    }
    if (pitch.prevStepBallPosition) {
      pitch.prevStepBallPosition.x = ball.position.x;
      pitch.prevStepBallPosition.y = ball.position.y;
      pitch.prevStepBallPosition.z = ball.position.z;
    }
    game.__happySeedGoalkeeperSafetyClamps =
      Number(game.__happySeedGoalkeeperSafetyClamps || 0) + 1;
    // 扑救起身保护期：将对方球员推离门将，防止抢球
    if (game.__happySeedGkSaveAt && game.__happySeedGkSaveEntity === goalkeeper) {
      var exclusionRadius = pitch.width * 0.08;
      (game.allPlayers || []).forEach(function (player) {
        if (!player || player === goalkeeper || !player.position || !player.team) return;
        if (player.team === goalkeeper.team) return;
        var dx = player.position.x - goalkeeper.position.x;
        var dy = player.position.y - goalkeeper.position.y;
        var dist = Math.hypot(dx, dy);
        if (dist < exclusionRadius && dist > 0.01) {
          var push = (exclusionRadius - dist) / dist;
          player.position.x += dx * push;
          player.position.y += dy * push;
          if (player.velocity) { player.velocity.x = 0; player.velocity.y = 0; }
        }
      });
    }
    try {
      window.dispatchEvent(
        new CustomEvent("ab-goalkeeper-safety-clamp", {
          detail: {
            runtimeActorId: runtimeActorIdForEntity(goalkeeper),
            side: runtimeSideForEntity(game, goalkeeper),
            count: game.__happySeedGoalkeeperSafetyClamps,
          },
        }),
      );
    } catch {}
    return !0;
  }
  window.__happySeedEnforceGoalkeeperSafety = function () {
    return enforceGoalkeeperControlledBallSafety(window.__matchGame);
  };
  function isPointInSliderOwnPenaltyArea(game, slider) {
    if (!game || !game.pitch || !slider || !slider.team) return !1;
    var pitch = game.pitch,
      side = runtimeSideForEntity(game, slider),
      actors = (window.__happySeedRuntimeActorConfig || {}).actors || [],
      goalkeeperActor = actors.find(function (actor) {
        return actor.side === side && actor.isGoalkeeper;
      }),
      goalkeeper = (game.allPlayers || []).find(function (player) {
        return player && goalkeeperActor && player.id === goalkeeperActor.runtimeEntityId;
      }),
      point = runtimeBallPoint(game);
    if (!point) return !1;
    var goalkeeperX = goalkeeper && goalkeeper.position
        ? goalkeeper.position.x / pitch.width
        : side === "red" ? 0 : 1,
      nearOwnGoalLine = goalkeeperX < .5 ? point[0] <= .18 : point[0] >= .82;
    return nearOwnGoalLine && point[1] >= .2 && point[1] <= .8;
  }
  function isPointInAttackingPenaltyArea(game, attacker) {
    if (!game || !game.pitch || !attacker || !attacker.team) return !1;
    var pitch = game.pitch,
      point = runtimeBallPoint(game),
      defendingTeam = attacker.team === pitch.redTeam ? pitch.blueTeam : pitch.redTeam,
      goalkeeper = (defendingTeam.allPlayers || []).find(function (player) {
        return player && isRuntimeGoalkeeper(player);
      });
    if (!point) return !1;
    var targetGoalX = goalkeeper && goalkeeper.position
        ? goalkeeper.position.x / pitch.width
        : attacker.team === pitch.redTeam ? 1 : 0,
      nearTargetGoalLine = targetGoalX < .5 ? point[0] <= .18 : point[0] >= .82;
    return nearTargetGoalLine && point[1] >= .2 && point[1] <= .8;
  }
  function emitRuntimeMatchEvent(game, type, primary, payload) {
    if (!game || !game.pitch) return null;
    payload = payload || {};
    var primaryId = runtimeActorIdForEntity(primary),
      secondaryId = runtimeActorIdForEntity(payload.secondary),
      point = runtimeBallPoint(game),
      stateAfter = payload.runtimeStateAfter || runtimeStateName(game),
      detail = payload.detail || {},
      stoppageSnapshot = stoppageClockSnapshot(game),
      id =
        "runtime." +
        String(++runtimeMatchEventSequence) +
        "." +
        String(type);
    var event = {
      schemaVersion: "match-runtime-event-v1",
      id: id,
      type: type,
      sourceEventId: payload.sourceEventId || null,
      timestamp: Date.now(),
      frameId: Number(game.__happySeedFrameId || 0),
      matchTime: Number(game.pitch.matchTime || 0),
      minute: Number.isFinite(Number(payload.minute))
        ? Math.max(0, Math.min(120, Number(payload.minute)))
        : Math.max(0, Math.min(120, Number(stoppageSnapshot.minute || 0))),
      side: payload.side || runtimeSideForEntity(game, primary),
      previousSide: payload.previousSide || null,
      actorRuntimeIds: [primaryId, secondaryId].filter(Boolean),
      primaryRuntimeActorId: primaryId,
      secondaryRuntimeActorId: secondaryId,
      ball: {
        before: payload.ballBefore || game.__happySeedPreviousBallPoint || point,
        after: payload.ballAfter || point,
      },
      runtimeStateBefore: payload.runtimeStateBefore || game.__happySeedPreviousRuntimeState || stateAfter,
      runtimeStateAfter: stateAfter,
      detail: detail,
    };
    window.dispatchEvent(
      new CustomEvent("ab-runtime-match-event", { detail: event }),
    );
    return id;
  }
  window.__happySeedEmitRuntimeEvent = function (type, primary, payload) {
    var game = window.__matchGame,
      eventId = emitRuntimeMatchEvent(game, type, primary, payload);
    if (game && type === "shot" && eventId) {
      var shooter = typeof primary === "string"
        ? runtimeEntityForActorId(game, primary)
        : primary;
      game.__happySeedLastShotEventId = eventId;
      game.__happySeedLastShotAt = performance.now();
      game.__happySeedLastShooterId = shooter && shooter.id || null;
    }
    if (game && type === "save" && eventId) {
      game.__happySeedLastSaveShotEventId =
        payload && (payload.sourceEventId ||
          payload.detail && payload.detail.shotEventId) || null;
      // 记录扑救时间戳和门将实体，用于起身保护期
      game.__happySeedGkSaveAt = performance.now();
      game.__happySeedGkSaveEntity = typeof primary === "string"
        ? runtimeEntityForActorId(game, primary)
        : primary;
    }
    return eventId;
  };
  function emitGoalCollisionEvent(game, type) {
    if (!game || !game.pitch || (type !== "post-hit" && type !== "crossbar-hit")) return null;
    var now = performance.now();
    if (
      game.__happySeedLastGoalCollisionType === type
      && now - Number(game.__happySeedLastGoalCollisionAt || 0) <= 420
    ) return null;
    game.__happySeedLastGoalCollisionType = type;
    game.__happySeedLastGoalCollisionAt = now;
    return emitRuntimeMatchEvent(game, type, null, {
      side: null,
      detail: { shotEventId: game.__happySeedLastShotEventId || null },
    });
  }
  function emitGoalkeeperSaveEvent(game, goalkeeper, saveKind, explicitShotEventId) {
    var shotEventId = explicitShotEventId || game && game.__happySeedLastShotEventId || null;
    if (
      !game ||
      !goalkeeper ||
      !goalkeeper.team ||
      !isRuntimeGoalkeeper(goalkeeper) ||
      !shotEventId ||
      performance.now() - Number(game.__happySeedLastShotAt || 0) > 3500 ||
      game.__happySeedLastSaveShotEventId === shotEventId
    )
      return null;
    var shooter = game.__happySeedLastShooterId == null
      ? null
      : (game.allPlayers || []).find(function (player) {
          return player && player.id === game.__happySeedLastShooterId;
    });
    if (shooter && shooter.team === goalkeeper.team) return null;
    game.__happySeedLastSaveShotEventId = shotEventId;
    return emitRuntimeMatchEvent(game, "save", goalkeeper, {
      side: runtimeSideForEntity(game, goalkeeper),
      sourceEventId: shotEventId,
      detail: {
        shotEventId: shotEventId,
        saveKind: saveKind || "keeper-control",
      },
    });
  }
  function recordGoalkeeperParryCandidate(game, goalkeeper, saveKind) {
    if (
      !game ||
      !goalkeeper ||
      !goalkeeper.team ||
      !isRuntimeGoalkeeper(goalkeeper) ||
      !game.__happySeedLastShotEventId ||
      performance.now() - Number(game.__happySeedLastShotAt || 0) > 3500
    ) return null;
    var shooter = game.__happySeedLastShooterId == null
      ? null
      : (game.allPlayers || []).find(function (player) {
          return player && player.id === game.__happySeedLastShooterId;
        });
    if (shooter && shooter.team === goalkeeper.team) return null;
    var existing = game.__happySeedPendingGoalkeeperParry;
    if (existing && existing.shotEventId === game.__happySeedLastShotEventId) {
      if (saveKind === "held") existing.saveKind = "held";
      existing.goalkeeper = goalkeeper;
      return existing;
    }
    game.__happySeedPendingGoalkeeperParry = {
      shotEventId: game.__happySeedLastShotEventId,
      goalkeeper: goalkeeper,
      goalkeeperRuntimeActorId: runtimeActorIdForEntity(goalkeeper),
      saveKind: saveKind === "held" ? "held" : "parried",
      at: performance.now(),
    };
    return game.__happySeedPendingGoalkeeperParry;
  }
  function takeGoalkeeperParryCandidate(game, shotEventId) {
    var candidate = game && game.__happySeedPendingGoalkeeperParry;
    if (!candidate || (shotEventId && candidate.shotEventId !== shotEventId)) return null;
    game.__happySeedPendingGoalkeeperParry = null;
    return candidate;
  }
  function finalizeGoalkeeperParryCandidate(game, reason) {
    var candidate = takeGoalkeeperParryCandidate(game);
    if (!candidate) return null;
    return emitGoalkeeperSaveEvent(
      game,
      candidate.goalkeeper,
      candidate.saveKind === "held" ? "held" : (reason || "parried-safe"),
      candidate.shotEventId,
    );
  }
  function maybeFinalizeGoalkeeperParryCandidate(game, owner) {
    var candidate = game && game.__happySeedPendingGoalkeeperParry,
      point = runtimeBallPoint(game),
      goalkeeper = candidate && candidate.goalkeeper;
    if (!candidate || !point || !goalkeeper || !goalkeeper.team || !game.pitch) return null;
    var elapsed = performance.now() - Number(candidate.at || 0),
      ownsLeftGoal = goalkeeper.team.goal === game.pitch.leftGoal,
      distanceInsideField = ownsLeftGoal ? point[0] : 1 - point[0],
      outsideGoalMouth = point[1] < .30 || point[1] > .70,
      defendingControl = owner && owner.team === goalkeeper.team,
      safelyControlled = defendingControl && distanceInsideField >= .09,
      safelyParried = elapsed >= 180 && (
        distanceInsideField >= .18 ||
        (outsideGoalMouth && distanceInsideField >= .10)
      );
    if (elapsed > 3500) {
      takeGoalkeeperParryCandidate(game, candidate.shotEventId);
      return null;
    }
    if (elapsed < 120) return null;
    if (safelyControlled)
      return finalizeGoalkeeperParryCandidate(
        game,
        owner === goalkeeper ? "held" : "defender-control",
      );
    if (!owner && safelyParried)
      return finalizeGoalkeeperParryCandidate(game, "parried-safe");
    return null;
  }
  function runtimeEntityForActorId(game, runtimeActorId) {
    var entries = game && game.stadium && game.stadium._happySeedActorEntries || [],
      entry = entries.find(function (candidate) {
        return candidate.actor && candidate.actor.runtimeActorId === runtimeActorId;
      });
    if (entry && entry.entity) return entry.entity;
    var actor = ((window.__happySeedRuntimeActorConfig || {}).actors || []).find(function (candidate) {
      return candidate.runtimeActorId === runtimeActorId;
    });
    return actor && (game.allPlayers || []).find(function (player) {
      return player.id === actor.runtimeEntityId;
    }) || null;
  }
  window.__happySeedCommitDecisionGoal = function (payload) {
    payload = payload || {};
    var game = window.__matchGame,
      pitch = game && game.pitch,
      point = runtimeBallPoint(game),
      target = payload.targetNormalized,
      side = payload.scoringSide === "blue" ? "blue" : "red",
      token = String(payload.token || "");
    if (!game || !pitch || !point || !target || !token) return !1;
    game.__happySeedDecisionGoalTokens = game.__happySeedDecisionGoalTokens || {};
    if (game.__happySeedDecisionGoalTokens[token]) return !0;
    var terminalDistance = Math.hypot(point[0] - target[0], point[1] - target[1]),
      crossedGoalLine = point[0] <= .075 || point[0] >= .925,
      insideGoalMouth = point[1] >= .32 && point[1] <= .68;
    if (terminalDistance > .055 || !crossedGoalLine || !insideGoalMouth) return !1;

    var decisionShotEventId = payload.shotEventId || game.__happySeedLastShotEventId || null,
      keeperTouchCandidate = takeGoalkeeperParryCandidate(game, decisionShotEventId),
      scorer = runtimeEntityForActorId(game, payload.sourceRuntimeActorId),
      scoringTeam = side === "red" ? pitch.redTeam : pitch.blueTeam,
      now = performance.now();
    game.__happySeedDecisionGoalTokens[token] = !0;
    scoringTeam.score = (scoringTeam.score | 0) + 1;
    game.__happySeedLastShooterId = scorer && scorer.id || null;
    game.__happySeedLastShotEventId = decisionShotEventId;
    game.__happySeedAcceptedGoalAt = now;
    game.__happySeedAcceptedGoalShotEventId = game.__happySeedLastShotEventId;
    game.__happySeedAcceptedGoalScoreRed = pitch.redTeam.score | 0;
    game.__happySeedAcceptedGoalScoreBlue = pitch.blueTeam.score | 0;
    game.__happySeedPendingGoalRestartHold = !0;
    window.__lastScoreRed = pitch.redTeam.score | 0;
    window.__previousGoalScoreRed = pitch.redTeam.score | 0;

    var runtimeEventId = emitRuntimeMatchEvent(game, "goal", scorer, {
      side: side,
      sourceEventId: payload.shotEventId || null,
      detail: {
        decision: !0,
        scenarioId: payload.scenarioId || null,
        choiceId: payload.choiceId || null,
        outcome: payload.outcome || null,
        shotEventId: game.__happySeedLastShotEventId,
        keeperTouch: !!keeperTouchCandidate,
        keeperRuntimeActorId: keeperTouchCandidate &&
          keeperTouchCandidate.goalkeeperRuntimeActorId || null,
        score: [pitch.redTeam.score | 0, pitch.blueTeam.score | 0],
      },
    });
    game._shakeT = .45;
    window.dispatchEvent(new CustomEvent("ab-goal", {
      detail: {
        red: pitch.redTeam.id || "red",
        blue: pitch.blueTeam.id || "blue",
        score: [pitch.redTeam.score | 0, pitch.blueTeam.score | 0],
        scorerRuntimeEntityId: game.__happySeedLastShooterId,
        runtimeEventId: runtimeEventId,
        shotEventId: game.__happySeedLastShotEventId,
        keeperTouch: !!keeperTouchCandidate,
        keeperRuntimeActorId: keeperTouchCandidate &&
          keeperTouchCandidate.goalkeeperRuntimeActorId || null,
        timestamp: Date.now(),
        decision: !0,
        scenarioId: payload.scenarioId || null,
        choiceId: payload.choiceId || null,
        outcome: payload.outcome || null,
      },
    }));
    return !0;
  };
  window.__happySeedSetGoalPresentationHold = function (active) {
    var game = window.__matchGame,
      pitch = game && game.pitch,
      Pitch = runtime("pitch").Pitch;
    if (!game || !pitch || !pitch.timeScale) return !1;
    if (active) {
      if (game.__happySeedGoalPresentationHoldToken == null) {
        try {
          game.__happySeedGoalPresentationHoldToken = pitch.timeScale.change(0);
        } catch {
          return !1;
        }
      }
      return !0;
    }

    var holdToken = game.__happySeedGoalPresentationHoldToken;
    game.__happySeedGoalPresentationHoldToken = null;
    try { holdToken != null && pitch.timeScale.reset(holdToken); } catch {}

    // 释放被延迟的 Goal→Kickoff 状态转换（球已在网窝中定格）
    if (game.__happySeedDeferredGoalKickoff) {
      var deferredKickoff = game.__happySeedDeferredGoalKickoff;
      game.__happySeedDeferredGoalKickoff = null;
      game.__happySeedDeferGoalRestart = !1;
      try { pitch.states.change(Pitch.states.Kickoff, deferredKickoff.team); } catch {}
    }

    var deferred = game.__happySeedDeferredDecisionGoalRestart;
    game.__happySeedDeferredDecisionGoalRestart = null;
    if (!deferred || !Pitch || !pitch.states) return !0;
    if (game.__happySeedPendingVarInvalidGoal) {
      var invalid = game.__happySeedPendingVarInvalidGoal;
      pitch.matchStartingTeam = invalid.defendingTeam;
      pitch.ballOutOfPlay = !1;
      pitch.states.change(Pitch.states.GoalKick, invalid.defendingTeam);
      game.__happySeedPendingVarInvalidGoal = null;
      game.__happySeedPendingGoalRestartHold = !1;
      return !0;
    }
    var restartingTeam = deferred.scoringSide === "blue"
      ? pitch.redTeam
      : pitch.blueTeam;
    pitch.matchStartingTeam = restartingTeam;
    pitch.ballOutOfPlay = !1;
    pitch.states.change(Pitch.states.Kickoff, restartingTeam);
    return !0;
  };
  window.__happySeedApplyVarResult = function (payload) {
    payload = payload || {};
    var game = window.__matchGame,
      pitch = game && game.pitch,
      Pitch = runtime("pitch").Pitch,
      token = String(payload.id || payload.sourceEventId || "");
    if (!pitch || !Pitch || !token) return !1;
    game.__happySeedVarResultTokens = game.__happySeedVarResultTokens || {};
    if (game.__happySeedVarResultTokens[token]) return !0;
    game.__happySeedVarResultTokens[token] = !0;
    if (payload.outcome !== "disallowed") return !0;

    var scoringSide = payload.scoringSide === "blue" ? "blue" : "red",
      scoringTeam = scoringSide === "red" ? pitch.redTeam : pitch.blueTeam,
      defendingTeam = scoringSide === "red" ? pitch.blueTeam : pitch.redTeam;
    scoringTeam.score = Math.max(0, (scoringTeam.score | 0) - 1);
    game.__happySeedAcceptedGoalScoreRed = pitch.redTeam.score | 0;
    game.__happySeedAcceptedGoalScoreBlue = pitch.blueTeam.score | 0;
    window.__lastScoreRed = pitch.redTeam.score | 0;
    window.__previousGoalScoreRed = pitch.redTeam.score | 0;
    game.__happySeedPendingVarInvalidGoal = {
      token: token,
      sourceEventId: payload.sourceEventId || null,
      scoringSide: scoringSide,
      defendingTeam: defendingTeam,
    };
    game.__happySeedDeferredDecisionGoalRestart = null;
    game.__happySeedPendingGoalRestartHold = !1;

    setTimeout(function () {
      var active = game.__happySeedPendingVarInvalidGoal,
        director = window.__happySeedDecisionDirectorV3
          && window.__happySeedDecisionDirectorV3.getSnapshot
          && window.__happySeedDecisionDirectorV3.getSnapshot();
      if (!active || director && director.phase && director.phase !== "idle") return;
      pitch.matchStartingTeam = defendingTeam;
      pitch.ballOutOfPlay = !1;
      pitch.states.change(Pitch.states.GoalKick, defendingTeam);
      game.__happySeedPendingVarInvalidGoal = null;
    }, 0);
    return !0;
  };
  window.__happySeedResumeAfterDecision = function (payload) {
    payload = payload || {};
    var game = window.__matchGame,
      pitch = game && game.pitch,
      Pitch = runtime("pitch").Pitch;
    if (!pitch || !Pitch || !pitch.states) return !1;
    if (payload.goalCommitted) {
      var disallowed = game.__happySeedPendingVarInvalidGoal;
      if (disallowed) {
        pitch.matchStartingTeam = disallowed.defendingTeam;
        pitch.ballOutOfPlay = !1;
        pitch.states.change(Pitch.states.GoalKick, disallowed.defendingTeam);
        game.__happySeedPendingVarInvalidGoal = null;
        return !0;
      }
      if (game.__happySeedGoalPresentationHoldToken != null) {
        game.__happySeedDeferredDecisionGoalRestart = {
          scoringSide: payload.scoringSide === "blue" ? "blue" : "red",
        };
        return !0;
      }
      var restartingTeam = payload.scoringSide === "blue"
        ? pitch.redTeam
        : pitch.blueTeam;
      pitch.matchStartingTeam = restartingTeam;
      pitch.ballOutOfPlay = !1;
      pitch.states.change(Pitch.states.Kickoff, restartingTeam);
      return !0;
    }
    var stateName = pitch.states.current && pitch.states.current.name;
    if (payload.consumeRestart && ["Corner", "ThrowIn", "GoalKick"].indexOf(stateName) >= 0) {
      pitch.ballOutOfPlay = !1;
      pitch.states.change(Pitch.states.Match);
      return !0;
    }
    return !1;
  };
  // 训练基地直接进入实时比赛状态，不再经过开球和死球流程。
  // 多余球员会从 pitch.players / team.players 中真正移除，而不只是隐藏贴图。
  window.__happySeedConfigureTraining = function (payload) {
    payload = payload || {};
    var game = window.__matchGame,
      pitch = game && game.pitch,
      Pitch = runtime("pitch").Pitch,
      playerStates = runtime("players/states"),
      playerGlobals = runtime("players/global"),
      runtimeUsers = runtime("users"),
      allPlayers = game && game.allPlayers || [];
    if (!game || !pitch || !Pitch || !pitch.states || !allPlayers.length) return null;

    var userList = runtimeUsers && runtimeUsers.list
        || pitch.users && pitch.users.list
        || pitch._users && pitch._users.list
        || [],
      user = userList[0] || null,
      savedPlayer = allPlayers[game.__happySeedTrainingPlayerIndex],
      controlled = savedPlayer && !savedPlayer.isGoalkeeper
        ? savedPlayer
        : user && user.player && !user.player.isGoalkeeper
          ? user.player
          : allPlayers.filter(function (player) {
            return player && player.isControlled && !player.isGoalkeeper;
          })[0] || allPlayers[6],
      playerIndex = Math.max(0, allPlayers.indexOf(controlled)),
      goalkeeperIndices = [];
    game.__happySeedTrainingPlayerIndex = playerIndex;
    for (var gi = 0; gi < allPlayers.length; gi += 1) {
      if (allPlayers[gi] && allPlayers[gi].isGoalkeeper) goalkeeperIndices.push(gi);
    }

    var defenderIndex = Number.isInteger(payload.defenderIndex)
        ? payload.defenderIndex
        : Number.isInteger(game.__happySeedTrainingDefenderIndex)
          ? game.__happySeedTrainingDefenderIndex
          : -1,
      defender = defenderIndex >= 0 ? allPlayers[defenderIndex] : null;
    if (!defender || defender.isGoalkeeper || defender.team === controlled.team) {
      defender = allPlayers.filter(function (candidate) {
        return candidate
          && !candidate.isGoalkeeper
          && candidate !== controlled
          && candidate.team !== controlled.team;
      })[0] || null;
      defenderIndex = allPlayers.indexOf(defender);
    }
    game.__happySeedTrainingDefenderIndex = defenderIndex;

    var pw = pitch.width || 100,
      ph = pitch.height || 60,
      visibleIndices = goalkeeperIndices.concat([playerIndex]);
    if (payload.defender && defenderIndex >= 0) visibleIndices.push(defenderIndex);
    var keep = new Set(visibleIndices);

    if (pitch.ball && pitch.ball.owner && !keep.has(allPlayers.indexOf(pitch.ball.owner))) {
      try {
        messages.releaseBall.send(pitch.ball.owner);
        messages.releaseBall.send(pitch.ball);
      } catch {}
    }
    if (pitch.ball && pitch.ball.inHands && pitch.ball.inHands.dropBall) {
      try { pitch.ball.inHands.dropBall(); } catch {}
    }

    for (var i = 0; i < allPlayers.length; i += 1) {
      var entity = allPlayers[i],
        onPitch = entity && pitch.players.indexOf(entity) >= 0;
      if (!entity) continue;
      if (!keep.has(i) && onPitch) {
        game.removePlayer(entity);
        if (entity.placeAtPosition) entity.placeAtPosition(pw + 6 + i * .01, ph + 6);
        if (entity.velocity) {
          entity.velocity.x = 0;
          entity.velocity.y = 0;
        }
      } else if (keep.has(i) && !onPitch) {
        game.addPlayer(entity);
        if (entity !== controlled) playerGlobals.forceAI(entity, null);
        entity.states.change(playerStates.ReturnHome);
      }
    }

    if (payload.initial && controlled && controlled.placeAtPosition) {
      controlled.placeAtPosition(pw * .43, ph * .5);
    }
    if (payload.defender && defender && defender.placeAtPosition) {
      var attacksRight = !controlled.team || !controlled.team.goal
        || controlled.team.goal.center.x < pw * .5;
      defender.placeAtPosition(attacksRight ? pw * .58 : pw * .42, ph * .5);
      playerGlobals.forceAI(defender, null);
      defender.states.change(playerStates.ReturnHome);
    }

    game.__happySeedTrainingActive = !0;
    game.__happySeedDeferGoalRestart = !1;
    game.__happySeedDeferredGoalKickoff = null;
    game.__happySeedPendingGoalRestartHold = !1;
    pitch.ballOutOfPlay = !1;
    pitch.practice = !0;
    pitch.matchStarted = !0;
    pitch.matchEnded = !1;
    try { pitch.matchTime = 0; } catch {}
    try { pitch.states.change(Pitch.states.Match); } catch {
      try { pitch.states.change(Pitch.states.Match); } catch {}
    }

    if (user && controlled) {
      user.enabled = !0;
      if (user.team !== controlled.team && user.changeTeam) {
        try { user.changeTeam(controlled.team); } catch {}
      }
      if (user.takeControl) {
        try { user.takeControl(controlled); } catch {}
      }
    }
    if (controlled && (payload.initial || payload.resetBall)) {
      if (pitch.ball.owner) {
        try {
          messages.releaseBall.send(pitch.ball.owner);
          messages.releaseBall.send(pitch.ball);
        } catch {}
      }
      if (pitch.ball.inHands && pitch.ball.inHands !== controlled && pitch.ball.inHands.dropBall) {
        try { pitch.ball.inHands.dropBall(); } catch {}
      }
      var controlledX = Number(controlled.position && controlled.position.x),
        controlledY = Number(controlled.position && controlled.position.y),
        ballDirection = !controlled.team || !controlled.team.goal
          || controlled.team.goal.center.x < pw * .5 ? 1 : -1;
      if (!Number.isFinite(controlledX)) controlledX = pw * .43;
      if (!Number.isFinite(controlledY)) controlledY = ph * .5;
      pitch.ball.placeAtPosition(
        controlledX + ballDirection * .28,
        controlledY,
        Math.max(Number(pitch.ball.radius || .12), .12)
      );
      if (pitch.ball.velocity) {
        pitch.ball.velocity.x = 0;
        pitch.ball.velocity.y = 0;
        pitch.ball.velocity.z = 0;
      }
      if (pitch.prevStepBallPosition) {
        pitch.prevStepBallPosition.x = pitch.ball.position.x;
        pitch.prevStepBallPosition.y = pitch.ball.position.y;
        pitch.prevStepBallPosition.z = pitch.ball.position.z;
      }
    }

    var result = {
      playerIndex: playerIndex,
      defenderIndex: defenderIndex,
      visibleIndices: Array.from(new Set(visibleIndices)),
      pitchPlayerCount: pitch.players.length,
      state: pitch.states.current && pitch.states.current.name || "",
      playerControlled: !!(user && user.enabled && user.team === controlled.team
        && user.player === controlled),
    };
    try {
      document.body.dataset.trainingRuntime = "active";
      document.body.dataset.trainingPitchPlayers = String(result.pitchPlayerCount);
      document.body.dataset.trainingPitchState = result.state;
      document.body.dataset.trainingPlayerControlled = String(result.playerControlled);
      document.body.dataset.trainingPlayerPosition = controlled && controlled.position
        ? [Number(controlled.position.x).toFixed(3), Number(controlled.position.y).toFixed(3)].join(",")
        : "";
    } catch {}
    return result;
  };
  try { document.body.dataset.trainingRuntimeBridge = "ready"; } catch {}
  // 战术调整：通过平移全队 home 锚点实现压上/回收，team.ai 控制前插积极度。
  // 锚点始终以初始阵型为基准，反复切换不累积偏移。
  window.__happySeedSetTacticalStance = function (side, stance) {
    var game = window.__matchGame,
      pitch = game && game.pitch,
      playerStates = runtime("players/states");
    if (!pitch || !playerStates) return !1;
    var team = side === "blue" ? pitch.blueTeam : pitch.redTeam;
    if (!team || !team.players) return !1;
    var presets = {
      'all-out-attack': { shift: 0.15, width: 1.18, ai: 3, runRisk: 1.28, staminaRate: 1.45 },
      attack: { shift: 0.07, width: 1.1, ai: 3, runRisk: 1.14, staminaRate: 1.2 },
      balanced: { shift: 0, width: 1, ai: 2, runRisk: 1, staminaRate: 1 },
      defend: { shift: -0.07, width: .92, ai: 1, runRisk: .88, staminaRate: .82 },
      'park-bus': { shift: -0.14, width: .82, ai: 1, runRisk: .72, staminaRate: .68 },
    },
      preset = presets[stance];
    if (!preset) return !1;
    var attackDir = team.goal && team.opponents && team.opponents.goal
      ? (team.opponents.goal.center.x >= team.goal.center.x ? 1 : -1)
      : (side === "blue" ? -1 : 1);
    if (!team._happySeedBaseHomes) {
      team._happySeedBaseHomes = team.players.map(function (player) {
        return player && player.home
          ? { player: player, x: player.home.x, y: player.home.y }
          : null;
      });
    }
    team._happySeedBaseHomes.forEach(function (record) {
      if (!record || !record.player || !record.player.home) return;
      record.player.home.x = record.x + attackDir * preset.shift * pitch.width;
      record.player.home.y = pitch.height / 2 + (record.y - pitch.height / 2) * preset.width;
    });
    try { team.ai = preset.ai; } catch {}
    var ballOwner = pitch.ball && pitch.ball.owner;
    team.players.forEach(function (player) {
      if (!player || !player.home || !player.position || player.isGoalkeeper) return;
      if (player === ballOwner || player.hasBall) return;
      var dx = player.position.x - player.home.x,
        dy = player.position.y - player.home.y;
      if (Math.sqrt(dx * dx + dy * dy) > 3) {
        try { player.states.change(playerStates.ReturnHome); } catch {}
      }
    });
    team._happySeedStance = stance;
    team._happySeedTacticalEffects = {
      pressHeight: preset.shift,
      width: preset.width,
      runRisk: preset.runRisk,
      staminaRate: preset.staminaRate,
      ai: preset.ai,
    };
    return !0;
  };
  window.__happySeedGetTacticalStance = function (side) {
    var game = window.__matchGame,
      pitch = game && game.pitch,
      team = pitch && (side === "blue" ? pitch.blueTeam : pitch.redTeam);
    return (team && team._happySeedStance) || "balanced";
  };
  function createStandaloneMatchState(options) {
    var states = runtime("core/states"),
      teams = runtime("teams"),
      balls = runtime("balls"),
      stadiums = runtime("stadiums"),
      TeamStatsFrame = runtime("net/frame").TeamStatsFrame,
      PlayPhase = createPlayPhase(),
      redId = options.red || "england",
      blueId = options.blue || "france",
      redTeam = teams.get(redId) || teams.get("england") || first(teams),
      blueTeam = teams.get(blueId) || teams.get("france") || first(teams),
      ball = balls.get(options.ball || "classic_1") || first(balls),
      stadium =
        stadiums.get(options.stadium || "international") || first(stadiums);
    if (!redTeam || !blueTeam || !ball || !stadium)
      throw new Error("missing standalone match data");
    return states.State.extend("StandaloneMatch", {
      enter: function (game) {
        if (
          (window.__bootTrace("StandaloneMatch.enter"),
          (this.game = game),
          (this.ready = !1),
          (this.playPhase = PlayPhase),
          (this.options = {
            redTeam,
            blueTeam,
            ball,
            stadium,
            time: Number(options.time || 3),
            drawAllowed: !0,
            ai: options.ai == null ? 2 : Number(options.ai),
            fastPlay: !0,
            kits:
              (options.side && kitsForSide(redTeam, blueTeam, options.side)) ||
              teams.selectKits(redTeam, blueTeam),
            userTeams: [],
          }),
          (this.redTeamStats = new TeamStatsFrame()),
          (this.blueTeamStats = new TeamStatsFrame()),
          (this.phase = new states.StateMachine(this)),
          game.stream.restart(),
          (game.stadium._showDepthFilter = !1),
          game.stadium.setFilters(),
          acPlay())
        ) {
          game.stadium.controlIndicator &&
            (game.stadium.controlIndicator.showAI = !1);
          // 球员模式：只隐藏脚印，保留持球圆圈
          game.stadium.controlIndicator &&
            (game.stadium.controlIndicator._showPassPaws = function () {},
             game.stadium.controlIndicator.passLayer &&
               (game.stadium.controlIndicator.passLayer.visible = !1));
          var _traj = game.stadium.trajectory;
          if (_traj) {
            for (var _li = 0; _li < _traj.userLines.length; _li++)
              (_traj.removeChild(_traj.userLines[_li]),
                (_traj.userLines[_li] = _traj.createLine(16777215)),
                _traj.addChild(_traj.userLines[_li]));
            var _origShowTraj = _traj.showTrajectory.bind(_traj);
            _traj.showTrajectory = function (team, player) {
              if (player && player.local && player.localIndex >= 0)
                return _origShowTraj.apply(this, arguments);
              this.visible = !1;
            };
          }
        } else
          (game.stadium.indicatorLayer &&
            (game.stadium.indicatorLayer.visible = !1),
            game.stadium.controlIndicator &&
              (game.stadium.controlIndicator._showTeam = function () {}));
        ((game.pitch.celebrateGoals = !1),
          window.__bootTrace("before stadium.loadMatch"),
          game.stadium.loadMatch(
            stadium,
            ball,
            redTeam,
            this.options.kits[0],
            blueTeam,
            this.options.kits[1],
            this.onMatchLoaded,
            this,
          ),
          window.__bootTrace("after stadium.loadMatch call (async)"));
      },
      onMatchLoaded: function () {
        (window.__bootTrace("onMatchLoaded: setupMatch"), setupMatch(this));
        var self = this,
          stadiumRenderer = this.game.stadium;
        function reveal() {
          try {
            var rdr = self.game && self.game.renderer;
            rdr &&
              ((rdr.clearBeforeRender = !0),
              (rdr.backgroundColor = 6131768),
              (window.__introZ0 = Math.max(
                rdr.width / 5120,
                rdr.height / 2560,
              )));
          } catch {}
          (snapPlayersHome(self.game),
            (window.__introArmedAt = performance.now()),
            (window.__introStart = -1),
            (self.game._introBowPending = !0),
            document.body.classList.add("loaded"),
            document.body.classList.remove("loading"),
            window.dispatchEvent(
              new CustomEvent("ab-match-started", {
                detail: {
                  red: redTeam.id || redId,
                  blue: blueTeam.id || blueId,
                  stadium: stadium.id || options.stadium || "asia",
                  bundle: "match",
                },
              }),
            ));
        }
        function startMatch() {
          (window.__bootTrace("onMatchLoaded: phase.change"),
            self.phase.change(self.playPhase),
            (self.ready = !0));
          var frames = 0;
          (function holdForKickoff() {
            if ((self.game && self.game._kickoffSnapped) || frames++ > 900) {
              reveal();
              return;
            }
            window.requestAnimationFrame(holdForKickoff);
          })();
        }
        function bakeFans() {
          try {
            if (stadiumRenderer.prepare) {
              for (var k = 0; k < 6; k += 1)
                if (stadiumRenderer.prepare())
                  return (window.__bootTrace("fans baked"), startMatch());
              window.requestAnimationFrame(bakeFans);
              return;
            }
          } catch (error) {
            console.warn("[standalone-match] fans bake failed", error);
          }
          startMatch();
        }
        bakeFans();
      },
      "signal:pitch.Pitch.states.HalfEnded.onExit": function (game) {
        var isFullTime = Boolean(game.pitch.secondHalf);
        if (isFullTime) return;
        var halfClock = stoppageClockSnapshot(game),
          inExtraTime = Boolean(
            game.__happySeedStoppageClock && game.__happySeedStoppageClock.extraTime,
          );
        emitRuntimeMatchEvent(game, "period-change", null, {
          side: null,
          minute: halfClock.minute,
          detail: {
            period: "half-time",
            extraTime: inExtraTime,
            addedMinutes: halfClock.addedTotal,
          },
        });
        var Pitch = runtime("pitch").Pitch,
          change = function () {
            try {
              game.pitch.states.change(Pitch.states.ChangeSides);
            } catch (error) {
              console.warn(
                "[standalone-match] half-time transition failed",
                error,
              );
            }
          };
        showPeriodTransition(
          inExtraTime
            ? "加时赛上半场结束 · 105+" + String(halfClock.addedTotal) + "′"
            : "上半场结束 · 45+" + String(halfClock.addedTotal) + "′",
          change,
        );
      },
      "signal:pitch.Pitch.states.Corner.onEnter": function (game) {
        try {
          finalizeGoalkeeperParryCandidate(game, "parried-to-corner");
          var cs = game.pitch.states.current,
            side = cs && cs.team === game.pitch.redTeam ? "red" : "blue";
          window.__matchStats[side].corners += 1;
          emitRuntimeMatchEvent(game, "ball-out", null, { side: side });
          emitRuntimeMatchEvent(game, "corner", null, { side: side });
        } catch {}
      },
      "signal:pitch.Pitch.states.ThrowIn.onEnter": function (game) {
        try {
          var ts = game.pitch.states.current,
            side = ts && ts.team === game.pitch.redTeam ? "red" : "blue";
          window.__matchStats[side].throwIns += 1;
          emitRuntimeMatchEvent(game, "ball-out", null, { side: side });
          emitRuntimeMatchEvent(game, "throw-in", null, { side: side });
        } catch {}
      },
      "signal:pitch.Pitch.states.GoalKick.onEnter": function (game) {
        try {
          var gs = game.pitch.states.current,
            side =
              gs && gs.startingTeam === game.pitch.redTeam ? "red" : "blue";
          window.__matchStats[side].goalKicks += 1;
          emitRuntimeMatchEvent(game, "ball-out", null, { side: side });
          emitRuntimeMatchEvent(game, "goal-kick", null, { side: side });
        } catch {}
      },
      "signal:player.Player.onSlideHit": function (game, slider) {
        if (!slider || !slider.team || isRuntimeGoalkeeper(slider)) return;
        var contacted = game.pitch.ball.owner;
        if (contacted && contacted.team === slider.team) return;
        countSlideStat(game, slider);
        emitRuntimeMatchEvent(game, "tackle-contact", slider, {
          secondary: contacted,
          detail: {
            contact: "slide-hit",
            ballWon: !1,
            missedBall: !0,
            inOwnPenaltyArea: isPointInSliderOwnPenaltyArea(game, slider),
          },
        });
      },
      "signal:player.Player.onSlideTrap": function (game, slider) {
        if (!slider || !slider.team || isRuntimeGoalkeeper(slider)) return;
        countSlideStat(game, slider);
        emitRuntimeMatchEvent(game, "tackle-contact", slider, {
          secondary: game.pitch.ball.owner,
          detail: {
            contact: "slide-trap",
            ballWon: !0,
            missedBall: !1,
            inOwnPenaltyArea: isPointInSliderOwnPenaltyArea(game, slider),
          },
        });
      },
      "signal:player.Player.onPass": function (game, a, receiver) {
        try {
          var rp =
            receiver && receiver.team ? receiver : a && a.team ? a : null;
          if (!rp) return;
          var side = rp.team === game.pitch.redTeam ? "red" : "blue";
          window.__matchStats[side].passes += 1;
          emitRuntimeMatchEvent(game, "pass", a && a.team ? a : rp, {
            secondary: receiver && receiver.team ? receiver : null,
            side: side,
          });
        } catch {}
      },
      "signal:player.Player.onBallHold": function (game, goalkeeper) {
        recordGoalkeeperParryCandidate(game, goalkeeper, "held");
        maybeFinalizeGoalkeeperParryCandidate(game, goalkeeper);
      },
      "signal:player.Player.onHitByBall": function (game, goalkeeper) {
        recordGoalkeeperParryCandidate(game, goalkeeper, "parried");
      },
      "signal:player.Player.onShot": function (game, shooter) {
        try {
          if (!shooter || !shooter.team) return;
          finalizeGoalkeeperParryCandidate(game, "rebound-shot");
          var side = shooter.team === game.pitch.redTeam ? "red" : "blue",
            st = window.__matchStats[side];
          ((st.shots += 1),
            (st.lastShotAt = performance.now()),
            (game.__happySeedLastShooterId = shooter.id),
            (game.__happySeedLastShotEventId = emitRuntimeMatchEvent(game, "shot", shooter, {
              side: side,
              detail: {
                inAttackingPenaltyArea: isPointInAttackingPenaltyArea(game, shooter),
              },
            })),
            (game.__happySeedLastShotAt = performance.now()));
        } catch {}
      },
      "signal:pitch.Pitch.states.Goal.onEnter": function (game) {
        var goalRuntimeEventId = null,
          goalEnteredAt = performance.now(),
          goalShotEventId = game.__happySeedLastShotEventId || null,
          keeperTouchCandidate = null,
          duplicateGoalEntry = Boolean(
            game.__happySeedAcceptedGoalAt
            && goalEnteredAt - game.__happySeedAcceptedGoalAt < 2500
            && goalShotEventId
            && game.__happySeedAcceptedGoalShotEventId
            && goalShotEventId === game.__happySeedAcceptedGoalShotEventId
          );
        if (duplicateGoalEntry) {
          game.pitch.redTeam.score = game.__happySeedAcceptedGoalScoreRed | 0;
          game.pitch.blueTeam.score = game.__happySeedAcceptedGoalScoreBlue | 0;
          return;
        }
        keeperTouchCandidate = takeGoalkeeperParryCandidate(game, goalShotEventId);
        game.__happySeedAcceptedGoalAt = goalEnteredAt;
        game.__happySeedAcceptedGoalShotEventId = goalShotEventId;
        game.__happySeedAcceptedGoalScoreRed = game.pitch.redTeam.score | 0;
        game.__happySeedAcceptedGoalScoreBlue = game.pitch.blueTeam.score | 0;
        game.__happySeedPendingGoalRestartHold = !0;
        // 拦截 Goal→Kickoff 状态转换：让球在 Goal 状态中自然滚入网窝，
        // 等 React 层调用 setGoalPresentationHold(true) 时才定格并放行转换
        game.__happySeedDeferGoalRestart = !0;
        game.__happySeedDeferredGoalKickoff = null;
        if (!game.__happySeedGoalStatePatchApplied) {
          game.__happySeedGoalStatePatchApplied = !0;
          var _origStatesChange = game.pitch.states.change.bind(game.pitch.states);
          var _PitchRef = runtime("pitch").Pitch;
          game.pitch.states.change = function (state) {
            if (
              game.__happySeedDeferGoalRestart
              && state === _PitchRef.states.Kickoff
            ) {
              game.__happySeedDeferredGoalKickoff = {
                team: arguments[1] || game.pitch.matchStartingTeam,
              };
              return;
            }
            return _origStatesChange.apply(null, arguments);
          };
        }
        try {
          var gp = game.pitch,
            gSide =
              gp.redTeam.score > (window.__lastScoreRed | 0) ? "red" : "blue";
          window.__lastScoreRed = gp.redTeam.score | 0;
          var gs2 = window.__matchStats && window.__matchStats[gSide];
          gs2 &&
            performance.now() - (gs2.lastShotAt || 0) > 2500 &&
            (gs2.shots += 1);
        } catch {}
        goalRuntimeEventId = emitRuntimeMatchEvent(
          game,
          "goal",
          game.__happySeedLastShooterId == null
            ? null
            : (game.allPlayers || []).filter(function (player) {
                return player.id === game.__happySeedLastShooterId;
              })[0],
          {
            side:
              game.pitch.redTeam.score > (window.__previousGoalScoreRed | 0)
                ? "red"
                : "blue",
            sourceEventId: goalShotEventId,
            detail: {
              shotEventId: game.__happySeedLastShotEventId || null,
              keeperTouch: !!keeperTouchCandidate,
              keeperRuntimeActorId: keeperTouchCandidate &&
                keeperTouchCandidate.goalkeeperRuntimeActorId || null,
              score: [game.pitch.redTeam.score | 0, game.pitch.blueTeam.score | 0],
            },
          },
        );
        window.__previousGoalScoreRed = game.pitch.redTeam.score | 0;
        ((game._shakeT = 0.45),
          window.dispatchEvent(
            new CustomEvent("ab-goal", {
              detail: {
                red: redTeam.id || redId,
                blue: blueTeam.id || blueId,
                score: [
                  game.pitch.redTeam.score | 0,
                  game.pitch.blueTeam.score | 0,
                ],
                scorerRuntimeEntityId: game.__happySeedLastShooterId || null,
                runtimeEventId: goalRuntimeEventId,
                shotEventId: game.__happySeedLastShotEventId || null,
                keeperTouch: !!keeperTouchCandidate,
                keeperRuntimeActorId: keeperTouchCandidate &&
                  keeperTouchCandidate.goalkeeperRuntimeActorId || null,
                timestamp: Date.now(),
              },
            }),
          ));
      },
      "signal:pitch.Pitch.states.Kickoff.onEnter": function (game) {
        emitRuntimeMatchEvent(game, "kickoff", null, {
          side: game.pitch.matchStartingTeam === game.pitch.blueTeam ? "blue" : "red",
          detail: { firstKickoff: !game._firstKickoffDone },
        });
        if (game.__happySeedPendingGoalRestartHold) {
          game.__happySeedPendingGoalRestartHold = !1;
          try {
            var goalRestartHoldToken = game.pitch.timeScale.change(0);
            window.setTimeout(function () {
              try { game.pitch.timeScale.reset(goalRestartHoldToken); } catch {}
            }, 1600);
          } catch {}
        }
        if (!game._firstKickoffDone) {
          if (
            ((game._firstKickoffDone = !0), acPlay() && !game._kickoffForced)
          ) {
            ((game._kickoffForced = !0),
              (game.pitch.matchStartingTeam = game.pitch.redTeam));
            var k0 = game.pitch.states.current;
            k0 &&
              "startingTeam" in k0 &&
              (k0.startingTeam = game.pitch.redTeam);
          }
          try {
            for (
              var teams2 = [game.pitch.redTeam, game.pitch.blueTeam], ti = 0;
              ti < teams2.length;
              ti += 1
            )
              for (
                var ps = (teams2[ti] && teams2[ti].allPlayers) || [], pi = 0;
                pi < ps.length;
                pi += 1
              ) {
                var p = ps[pi];
                !p ||
                  !p.home ||
                  !p.position ||
                  ((p.position.x = p.home.x),
                  (p.position.y = p.home.y),
                  typeof p.position.z == "number" && (p.position.z = 0),
                  p.velocity && ((p.velocity.x = 0), (p.velocity.y = 0)));
              }
          } catch (error) {
            console.warn(
              "[standalone-match] kickoff snap-to-home failed",
              error,
            );
          }
          try {
            var st = game.pitch.matchStartingTeam;
            if (st && st.getPlayersForKickOff)
              for (
                var takers = st.getPlayersForKickOff(),
                  dir = st.goal === game.pitch.leftGoal ? -1 : 1,
                  ki = 0;
                ki < takers.length;
                ki += 1
              ) {
                var tp = takers[ki];
                !tp ||
                  !tp.position ||
                  ((tp.position.x =
                    game.pitch.center.x + dir * (0.9 + ki * 1.5)),
                  (tp.position.y = game.pitch.center.y + (ki ? 2 : 0)),
                  typeof tp.position.z == "number" && (tp.position.z = 0),
                  tp.velocity && ((tp.velocity.x = 0), (tp.velocity.y = 0)));
              }
          } catch (error2) {
            console.warn(
              "[standalone-match] kickoff taker pre-place failed",
              error2,
            );
          }
          try {
            if (!game._introKickoffHeld) {
              game._introKickoffHeld = !0;
              var cur = game.pitch.states.current;
              cur &&
                typeof cur.delay == "number" &&
                (cur.delay = 0.8);
            }
          } catch {}
          // 教练模式：轮询开球状态，在延迟剩余约 0.5 秒时提前发出 ab-kickoff-played（哨声领先开球）
          if (!acPlay()) {
            game._kickoffPlayedEmitted = !1;
            var kickoffStateRef = game.pitch.states.current;
            (function pollKickoffPlayed() {
              try {
                if (game._kickoffPlayedEmitted) return;
                var curState = game.pitch.states.current;
                if (curState !== kickoffStateRef) return;
                var rt = curState.readyTime,
                  dl = curState.delay;
                if (
                  typeof rt == "number" &&
                  typeof dl == "number" &&
                  rt >= Math.max(0, dl - 0.5)
                ) {
                  game._kickoffPlayedEmitted = !0;
                  window.dispatchEvent(new CustomEvent("ab-kickoff-played"));
                  return;
                }
              } catch (pollErr) {}
              window.requestAnimationFrame(pollKickoffPlayed);
            })();
          }
          game._kickoffSnapped = !0;
        }
      },
      "signal:pitch.Pitch.states.Kickoff.onExit": function (game) {
        // 兜底：若提前轮询未触发，则在开球状态结束时发出 ab-kickoff-played。
        // 球员模式由 StandalonePlayPhase 的活球检测触发，避免重复。
        if (!acPlay() && !game._kickoffPlayedEmitted) {
          game._kickoffPlayedEmitted = !0;
          try {
            window.dispatchEvent(new CustomEvent("ab-kickoff-played"));
          } catch {}
        }
      },
      "signal:pitch.Pitch.states.EndMatch.onEnter": function (game) {
        var periodOverlay = document.querySelector(".match-period-transition");
        periodOverlay && periodOverlay.classList.remove("is-visible");
        var redScore = game.pitch.redTeam.score | 0,
          blueScore = game.pitch.blueTeam.score | 0,
          fullClock = stoppageClockSnapshot(game),
          fullTimeEventId = emitRuntimeMatchEvent(game, "period-change", null, {
            side: null,
            minute: fullClock.minute,
            detail: {
              period: "full-time",
              score: [redScore, blueScore],
              addedMinutes: fullClock.addedTotal,
            },
          });
        window.dispatchEvent(
          new CustomEvent("ab-match-ended", {
            detail: {
              red: redTeam.id || redId,
              blue: blueTeam.id || blueId,
              score: [redScore, blueScore],
              runtimeEventId: fullTimeEventId,
            },
          }),
        );
      },
      onMessage: function (game, message, a, b, c, d, e, f, h, i) {
        return this.phase.onMessage(message, a, b, c, d, e, f, h, i);
      },
      onFrame: function (game, frame) {
        game.__happySeedFrameId = Number(game.__happySeedFrameId || 0) + 1;
        enforceStoppageClock(game);
        try {
          var owner = game.pitch.ball.owner ||
            (game.pitch.ball.inHands && game.pitch.ball.inHands.team
              ? game.pitch.ball.inHands
              : null) ||
            (game.allPlayers || []).filter(function (player) {
              return player && player.hasBall;
            })[0] || null,
            ownerId = runtimeActorIdForEntity(owner),
            previousOwnerId = game.__happySeedPreviousOwnerRuntimeActorId || null,
            ownerSide = runtimeSideForEntity(game, owner),
            previousSide = game.__happySeedPreviousOwnerSide || null;
          if (ownerId && ownerId !== previousOwnerId) {
            emitRuntimeMatchEvent(game, "touch", owner, {
              side: ownerSide,
              previousSide: previousSide,
            });
            if (previousSide && ownerSide && previousSide !== ownerSide)
              emitRuntimeMatchEvent(game, "possession-change", owner, {
                side: ownerSide,
                previousSide: previousSide,
              });
            owner.isGoalkeeper &&
              recordGoalkeeperParryCandidate(game, owner, "held");
          }
          maybeFinalizeGoalkeeperParryCandidate(game, owner);
          game.__happySeedPreviousOwnerRuntimeActorId = ownerId;
          game.__happySeedPreviousOwnerSide = ownerSide;
          var leftGoalEvent = frame && frame.leftGoal && frame.leftGoal.eventName,
            rightGoalEvent = frame && frame.rightGoal && frame.rightGoal.eventName,
            collisionEvent = leftGoalEvent || rightGoalEvent;
          if (collisionEvent === "onPostHit" || collisionEvent === "onCrossbarHit")
            emitGoalCollisionEvent(
              game,
              collisionEvent === "onPostHit" ? "post-hit" : "crossbar-hit",
            );
          game.__happySeedPreviousBallPoint = runtimeBallPoint(game);
          game.__happySeedPreviousRuntimeState = runtimeStateName(game);
        } catch (eventError) {
          console.error("[MatchRuntimeEventV1] frame adapter failed", eventError);
        }
        return (runtime("messages").frame.send(game.stadium, frame), !0);
      },
      onQuit: function () {
        return !0;
      },
      onContinue: function () {
        return !0;
      },
      updateUsernames: function () {},
      update: function (game, elapsed) {
        if (this.ready) {
          enforceStoppageClock(game);
          this.phase.update(elapsed);
          enforceStoppageClock(game);
        }
      },
      render: function (game, elapsed) {
        this.ready && this.phase.render(elapsed);
      },
      exit: function (game) {
        (this.phase.idle(), game.stadium.unloadMatch(), game.onExit.send());
      },
    });
  }
  function createGame() {
    var settings = runtime("settings"),
      Signal = runtime("core/signal"),
      GameBase = runtime("core/game"),
      Ball = runtime("ball").Ball,
      Pitch = runtime("pitch").Pitch,
      Team = runtime("team").Team,
      Player = runtime("player").Player,
      Goalkeeper = runtime("goalkeeper").Goalkeeper,
      Goal = runtime("goal").Goal,
      playerStates = runtime("players/states"),
      playerGlobals = runtime("players/global"),
      StadiumRenderer = runtime("renderers/stadium").StadiumRenderer,
      Curtain = runtime("renderers/curtain"),
      MatchStream = runtime("net/stream").MatchStream,
      assets = runtime("assets"),
      fans = runtime("fans"),
      messages = runtime("messages");
    if (!window.__happySeedGoalCollisionSignalsInstalled) {
      window.__happySeedGoalCollisionSignalsInstalled = !0;
      Goal.onPostHit.connect(function () {
        emitGoalCollisionEvent(window.__matchGame, "post-hit");
      });
      Goal.onCrossbarHit.connect(function () {
        emitGoalCollisionEvent(window.__matchGame, "crossbar-hit");
      });
    }
    function MatchGame() {
      var mobileRenderDevice =
        (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) ||
        (navigator.maxTouchPoints || 0) > 0 ||
        /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");
      (GameBase.call(this, {
        width: window.innerWidth,
        height: window.innerHeight,
        rendererOptions: settings("RENDERER_OPTIONS", {}),
        assets: assets.all,
      }),
        document.body.insertBefore(
          this.renderer.view,
          document.body.firstChild,
        ),
        (this.onEnter = new Signal()),
        (this.onExit = new Signal()),
        (this._autoResize = !0),
        // 手机/平板上 DPR=2~3 时，按 2 倍分辨率渲染会把 WebGL 像素数放大到 4 倍。
        // 本项目是像素美术，粗指针设备限制到 1.25 既保留清晰度，也显著降低填充率和发热。
        (this.resolution = Math.min(
          window.devicePixelRatio || 1,
          mobileRenderDevice ? 1.25 : 2,
        )),
        (this.viewportWidth = 0),
        (this.viewportHeight = 0),
        (this.pitch = new Pitch({
          width: settings("PITCH_WIDTH"),
          height: settings("PITCH_HEIGHT"),
          goalWidth: settings("GOAL_WIDTH"),
          goalHeight: settings("GOAL_HEIGHT"),
          regionColumns: 16,
          regionRows: 9,
        })),
        this.pitch.states.global(Pitch.states.Global),
        (this.pitch.ball = new Ball({
          game: this,
          pitch: this.pitch,
          gravity: { z: settings("GRAVITY") },
        })));
      var ROLE = {
          D: Player.ROLE_DEFENDER,
          M: Player.ROLE_MIDFIELDER,
          A: Player.ROLE_ATTACKER,
        },
        DEFAULT_FORM = {
          name: "4-3-3",
          spots: [
            [3, 1, "D"],
            [3, 3, "D"],
            [3, 5, "D"],
            [3, 7, "D"],
            [5, 2, "M"],
            [5, 4, "M"],
            [5, 6, "M"],
            [7, 1, "A"],
            [7, 4, "A"],
            [7, 7, "A"],
          ],
        },
        chosen = window.__matchFormations,
        redForm = (chosen && chosen.red) || DEFAULT_FORM,
        blueForm = (chosen && chosen.blue) || DEFAULT_FORM;
      window.__bootTrace(
        "formations red=" + redForm.name + " blue=" + blueForm.name,
      );
      for (
        var SQUAD = 11,
          redPlayers = [this.makeGoalkeeper(0, 0, 4)],
          bluePlayers = [this.makeGoalkeeper(SQUAD, 0, 4)],
          f = 0;
        f < 10;
        f += 1
      ) {
        var rs = redForm.spots[f] || DEFAULT_FORM.spots[f],
          bsp = blueForm.spots[f] || DEFAULT_FORM.spots[f];
        (redPlayers.push(
          this.makePlayer(
            1 + f,
            rs[0],
            rs[1],
            ROLE[rs[2]] || Player.ROLE_MIDFIELDER,
            0.97,
          ),
        ),
          bluePlayers.push(
            this.makePlayer(
              SQUAD + 1 + f,
              bsp[0],
              bsp[1],
              ROLE[bsp[2]] || Player.ROLE_MIDFIELDER,
              0.97,
            ),
          ));
      }
      ((this.pitch.redTeam = new Team({
        pitch: this.pitch,
        players: redPlayers,
      })),
        (this.pitch.blueTeam = new Team({
          pitch: this.pitch,
          players: bluePlayers,
        })),
        this.pitch.redTeam.states.global(Team.states.Global),
        this.pitch.blueTeam.states.global(Team.states.Global),
        (this.allPlayers = this.pitch.redTeam.allPlayers.concat(
          this.pitch.blueTeam.allPlayers,
        )),
        (this.stream = new MatchStream(8)));
      for (
        var squadSize = this.pitch.redTeam.allPlayers.length,
          streamFrames = this.stream.frames.concat([
            this.stream.interpolated,
            this.stream._merged,
          ]),
          sf = 0;
        sf < streamFrames.length;
        sf += 1
      )
        (streamFrames[sf].redTeam._grow(squadSize),
          streamFrames[sf].blueTeam._grow(squadSize));
      ((this.stadium = null),
        (this.curtain = null),
        // 页面转入后台时交给 GameBase 暂停循环，避免锁屏/切应用后继续耗电。
        (this.runInBackground = !1));
    }
    return (
      (MatchGame.prototype = Object.create(GameBase.prototype)),
      (MatchGame.prototype.constructor = MatchGame),
      (MatchGame.prototype.removePlayer = function (player) {
        (this.pitch.removePlayer(player), playerGlobals.forceIdle(player));
      }),
      (MatchGame.prototype.removeAllPlayers = function () {
        for (var i = this.pitch.players.length - 1; i >= 0; i -= 1)
          this.removePlayer(this.pitch.players[i]);
      }),
      (MatchGame.prototype.addPlayer = function (player) {
        this.pitch.addPlayer(player);
      }),
      (MatchGame.prototype.reset = function () {
        (this.pitch.ball.owner &&
          (messages.releaseBall.send(this.pitch.ball.owner),
          messages.releaseBall.send(this.pitch.ball)),
          this.pitch.ball.inHands && this.pitch.ball.inHands.dropBall(),
          this.pitch.redTeam.states.idle(),
          this.pitch.blueTeam.states.idle(),
          this.pitch.states.idle(),
          (this.pitch.ballOutOfPlay = !1),
          this.stadium.resume(),
          this.stadium.pause(),
          this.removeAllPlayers(),
          this.curtain.hide());
      }),
      (MatchGame.prototype.makeGoalkeeper = function (id, column, row) {
        var player = new Goalkeeper({
          id,
          pitch: this.pitch,
          home: this.pitch.regions[column][row].center,
        });
        return ((player.states.default = playerStates.Ready), player);
      }),
      (MatchGame.prototype.makePlayer = function (
        id,
        column,
        row,
        role,
        accuracy,
      ) {
        var player = new Player({
          id,
          pitch: this.pitch,
          accuracy,
          home: this.pitch.regions[column][row].center,
          role,
        });
        return ((player.states.default = playerStates.Ready), player);
      }),
      (MatchGame.prototype.repositionUI = function () {
        runtime("signs").resize(this.renderer.width, this.renderer.height);
      }),
      (MatchGame.prototype.resize = function () {
        if (
          this._autoResize &&
          ((this.viewportWidth = window.innerWidth * this.resolution),
          (this.viewportHeight = window.innerHeight * this.resolution),
          GameBase.prototype.resize.call(
            this,
            this.viewportWidth,
            this.viewportHeight,
            this.resolution,
          ),
          this.stadium &&
            (this.stadium.resize(this.viewportWidth, this.viewportHeight),
            this.repositionUI()),
          this.curtain)
        ) {
          var scale = Math.max(
            window.innerWidth / 1920,
            window.innerHeight / 1080,
          );
          (this.curtain.scale.set(scale, scale),
            this.curtain.position.set(
              0.5 * this.viewportWidth,
              0.5 * this.viewportHeight,
            ));
        }
      }),
      (MatchGame.prototype._onLoad = function () {
        (window.__bootTrace("_onLoad: StadiumRenderer"),
          (this.stadium = new StadiumRenderer({
            game: this,
            pitch: this.pitch,
            players: this.pitch.redTeam.allPlayers.concat(
              this.pitch.blueTeam.allPlayers,
            ),
          })),
          this.stage.addChild(this.stadium),
          this.repositionUI(),
          window.__bootTrace("_onLoad: fans.init"),
          fans.init(),
          window.__bootTrace("_onLoad: curtain"),
          (this.curtain = new Curtain(this.stadium)),
          this.stadium.entities.add(this.curtain),
          this.stage.addChild(this.curtain),
          window.__bootTrace("_onLoad: GameBase._onLoad"),
          GameBase.prototype._onLoad.call(this),
          window.__bootTrace("_onLoad: done"));
      }),
      Object.defineProperties(MatchGame.prototype, {
        mode: {
          get: function () {
            return this.states.current;
          },
          set: function (state) {
            this.states.change(state);
          },
        },
        autoResize: {
          get: function () {
            return this._autoResize;
          },
          set: function (value) {
            this._autoResize !== value &&
              ((this._autoResize = value), this._autoResize && this.resize());
          },
        },
      }),
      new MatchGame()
    );
  }
  window.__startStandaloneMatch = function (options) {
    options = options || {};
    var bt0 = performance.now(),
      blog = function (msg) {
        console.info(
          "[match-boot +" +
            ((performance.now() - bt0) / 1e3).toFixed(2) +
            "s] " +
            msg,
        );
      };
    try {
      (blog("setupCollections"),
        setupCollections(),
        blog("setupCollections done"));
      var i18n = runtime("i18n"),
        fans = runtime("fans"),
        settings = runtime("settings");
      try {
        i18n.activate(navigator.language.slice(0, 2));
      } catch {
        i18n.activate("en");
      }
      if (
        (document.body.classList.add("loaded"),
        document.body.classList.remove("loading"),
        !window.__matchGame)
      ) {
        (blog("createGame"),
          (window.__matchGame = createGame()),
          blog("game.start"),
          window.__matchGame.start());
        var doResize = window.__matchGame.resize.bind(window.__matchGame);
        (doResize(),
          window.addEventListener("resize", doResize),
          window.addEventListener("orientationchange", function () {
            (setTimeout(doResize, 120), setTimeout(doResize, 450));
          }),
          window.visualViewport &&
            window.visualViewport.addEventListener &&
            window.visualViewport.addEventListener("resize", doResize),
          blog("game started + resized"));
      }
      (blog("fans.load"),
        fans.load(settings("DEFAULTS_ROOT"), function () {
          blog("fans.load done \u2192 game.load");
          try {
            var loader =
              window.__matchGame.loader || (window.PIXI && window.PIXI.loader);
            loader &&
              loader.on &&
              loader.on("progress", function (ldr) {
                var pct = Math.round(ldr.progress || 0);
                ((window.__loadProgress = pct),
                  window.dispatchEvent(
                    new CustomEvent("ab-load-progress", { detail: pct }),
                  ));
              });
          } catch {}
          window.__matchGame.load(function () {
            (blog("game.load done \u2192 states.change(StandaloneMatch)"),
              window.__matchGame.states.change(
                createStandaloneMatchState(options),
              ),
              blog("states.change returned"));
          });
        }));
    } catch (error) {
      (console.error("[standalone-match] boot failed", error),
        blog("FATAL: " + error.message));
    }
  };
})();
