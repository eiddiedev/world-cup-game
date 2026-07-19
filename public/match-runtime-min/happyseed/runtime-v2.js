(function () {
  "use strict";

  function dispatch(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail }));
    } catch {}
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function installStadium(options) {
    var stadium = options && options.stadium,
      pitch = options && options.pitch,
      config = options && options.config,
      runtime = options && options.runtime,
      effZoom = options && options.effZoom;
    if (!stadium || !pitch || !config || !runtime || stadium._pixelStadiumV2Init)
      return !1;

    stadium._pixelStadiumV2Init = !0;
    try {
      var Pixi = runtime("pixi"),
        Texture = Pixi.Texture,
        Sprite = Pixi.Sprite,
        Container = Pixi.Container,
        nearest = Pixi.SCALE_MODES && Pixi.SCALE_MODES.NEAREST,
        cameraPresets = {},
        masterTexture = Texture.fromImage(config.assets.masterBackground),
        masterSprite = new Sprite(masterTexture),
        baseComposition = new Container(),
        state = {
          ready: !1,
          activeCamera: "normal",
          cameraMode: "ball",
          cameraTarget: { x: pitch.center.x, y: pitch.center.y },
          draggable: !0,
          lastManualCameraAt: 0,
          manualReturnDelayMs: 2600,
          crowdMotion: !0,
          legacyAnimalCrowdHidden: !1,
          originalGoalSpriteCount: 0,
          goalVisualOffsets: { left: 0, right: 0 },
          goalVisualAlignmentApplied: !1,
          pixelGoalAtlasApplied: !1,
          pixelGoalAtlasLoading: !1,
          pixelBallTextureApplied: !1,
          pixelBallOutputApplied: !1,
          pixelDynamicNetApplied: !1,
          pixelDynamicNetTriangleCount: 0,
          pixelDynamicNetStrandCount: 0,
          pixelDynamicNetDepthMode: "aggregate-front-edge",
          baseRefreshesRemaining: 12,
          lastBaseRefreshAt: 0,
        },
        pixelNetDepthUpdaters = [];

      masterTexture.baseTexture && nearest !== undefined &&
        (masterTexture.baseTexture.scaleMode = nearest);
      masterSprite.width = config.sourceSize.width;
      masterSprite.height = config.sourceSize.height;
      baseComposition.addChild(masterSprite);

      function hideLegacyAnimalCrowd() {
        try {
          var fans = runtime("fans"),
            container = fans && fans._fansContainer;
          if (!container) return !1;
          container.visible = !1;
          state.legacyAnimalCrowdHidden = container.visible === !1;
          return state.legacyAnimalCrowdHidden;
        } catch {
          return !1;
        }
      }

      function replaceSpriteAtlas(sprite, replacementTexture) {
        if (!sprite || !sprite.texture || !replacementTexture ||
          !replacementTexture.baseTexture ||
          !replacementTexture.baseTexture.hasLoaded)
          return !1;
        if (sprite._happySeedPixelGoalAtlas) return !0;
        var original = sprite.texture,
          nextTexture = new Texture(
            replacementTexture.baseTexture,
            original.frame,
            original.orig,
            original.trim,
            original.rotate,
          );
        nextTexture.baseTexture && nearest !== undefined &&
          (nextTexture.baseTexture.scaleMode = nearest);
        sprite.texture = nextTexture;
        sprite._happySeedPixelGoalAtlas = !0;
        return !0;
      }

      function installPixelGoalAtlas() {
        var source = stadium._stadium || {},
          bottom = source._bottom || [],
          middle = source._middle || [],
          goalTexture = config.assets.goalAtlas &&
            Texture.fromImage(config.assets.goalAtlas),
          applied = 0,
          index;
        if (state.pixelGoalAtlasApplied) return !0;
        if (!goalTexture || !goalTexture.baseTexture) return !1;
        function applyLoadedAtlas() {
          applied = 0;
          for (index = 0; index < Math.min(2, bottom.length); index += 1)
            applied += replaceSpriteAtlas(bottom[index], goalTexture) ? 1 : 0;
          for (index = 0; index < Math.min(2, middle.length); index += 1)
            applied += replaceSpriteAtlas(middle[index], goalTexture) ? 1 : 0;
          state.pixelGoalAtlasApplied = applied === 4;
          state.pixelGoalAtlasLoading = !1;
          return state.pixelGoalAtlasApplied;
        }
        if (goalTexture.baseTexture.hasLoaded) return applyLoadedAtlas();
        if (state.pixelGoalAtlasLoading) return !1;
        state.pixelGoalAtlasLoading = !0;
        goalTexture.baseTexture.once("loaded", applyLoadedAtlas);
        return !1;
      }

      function installPixelBallTexture() {
        var ballRenderer = stadium.ballRenderer,
          asset = config.assets.ballTexture,
          image;
        if (!ballRenderer || !asset || state.pixelBallTextureApplied) return !1;
        image = new Image();
        image.onload = function () {
          try {
            var canvas = document.createElement("canvas"),
              context,
              ballSprite = ballRenderer.sprite && ballRenderer.sprite.children &&
                ballRenderer.sprite.children[0];
            canvas.width = image.naturalWidth || image.width;
            canvas.height = image.naturalHeight || image.height;
            context = canvas.getContext("2d", { willReadFrequently: !0 });
            context.imageSmoothingEnabled = !1;
            context.drawImage(image, 0, 0);
            ballRenderer._sphereTextureData = context.getImageData(
              0,
              0,
              canvas.width,
              canvas.height,
            );
            if (ballSprite && ballSprite.texture && ballSprite.texture.baseTexture &&
              nearest !== undefined)
              ballSprite.texture.baseTexture.scaleMode = nearest;
            if (!ballRenderer._happySeedOriginalSphere && ballRenderer.sphere) {
              var originalSphere = ballRenderer.sphere,
                pixelCanvas = document.createElement("canvas"),
                pixelContext;
              pixelCanvas.width = pixelCanvas.height = 12;
              pixelContext = pixelCanvas.getContext("2d");
              pixelContext.imageSmoothingEnabled = !1;
              ballRenderer._happySeedOriginalSphere = originalSphere;
              ballRenderer.sphere = function () {
                var result = originalSphere.apply(this, arguments),
                  outputContext = arguments[2],
                  outputCanvas = outputContext && outputContext.canvas;
                if (!outputCanvas) return result;
                pixelContext.clearRect(0, 0, 12, 12);
                pixelContext.drawImage(
                  outputCanvas,
                  0,
                  0,
                  outputCanvas.width,
                  outputCanvas.height,
                  0,
                  0,
                  12,
                  12,
                );
                outputContext.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
                outputContext.imageSmoothingEnabled = !1;
                outputContext.drawImage(
                  pixelCanvas,
                  0,
                  0,
                  12,
                  12,
                  0,
                  0,
                  outputCanvas.width,
                  outputCanvas.height,
                );
                return result;
              };
              state.pixelBallOutputApplied = !0;
            }
            state.pixelBallTextureApplied = !0;
            dispatchScene("ab-stadium-equipment-ready");
          } catch (error) {
            console.error("[stadium-v2] 像素足球贴图安装失败", error);
          }
        };
        image.onerror = function () {
          console.error("[stadium-v2] 像素足球贴图加载失败", asset);
        };
        image.src = asset;
        return !0;
      }

      function installPixelDynamicNets() {
        var Generic = runtime("renderers/generic"),
          Point2 = runtime("core/math/point2"),
          renderers = [stadium.leftNetRenderer, stadium.rightNetRenderer],
          triangleCount = 0,
          strandCount = 0;
        if (state.pixelDynamicNetApplied || !Generic || !Point2) return !1;

        function drawPixelSegment(graphics, from, to, color, alpha, offset) {
          var grid = 4,
            size = 4,
            x1 = Math.round((from.x + offset) / grid) * grid,
            y1 = Math.round((from.y + offset) / grid) * grid,
            x2 = Math.round((to.x + offset) / grid) * grid,
            y2 = Math.round((to.y + offset) / grid) * grid,
            steps = Math.max(1, Math.ceil(Math.max(
              Math.abs(x2 - x1),
              Math.abs(y2 - y1),
            ) / grid)),
            step;
          graphics.beginFill(color, alpha);
          for (step = 0; step <= steps; step += 1) {
            var ratio = step / steps,
              x = Math.round((x1 + ((x2 - x1) * ratio)) / grid) * grid,
              y = Math.round((y1 + ((y2 - y1) * ratio)) / grid) * grid;
            graphics.drawRect(x, y, size, size);
          }
          graphics.endFill();
        }

        function appendGridSegments(segments, points, columns, rows, rowStride, columnStride) {
          var selectedRows = [],
            selectedColumns = [],
            row,
            column;
          for (row = 0; row < rows; row += rowStride) selectedRows.push(row);
          if (selectedRows[selectedRows.length - 1] !== rows - 1)
            selectedRows.push(rows - 1);
          for (column = 0; column < columns; column += columnStride)
            selectedColumns.push(column);
          if (selectedColumns[selectedColumns.length - 1] !== columns - 1)
            selectedColumns.push(columns - 1);
          selectedRows.forEach(function (rowIndex) {
            for (column = 1; column < columns; column += 1)
              segments.push({
                from: points[rowIndex * columns + column - 1].position,
                to: points[rowIndex * columns + column].position,
              });
          });
          selectedColumns.forEach(function (columnIndex) {
            for (row = 1; row < rows; row += 1)
              segments.push({
                from: points[(row - 1) * columns + columnIndex].position,
                to: points[row * columns + columnIndex].position,
              });
          });
          return selectedRows.length + selectedColumns.length;
        }

        function installNetRenderer(netRenderer) {
          var triangles = netRenderer && netRenderer.netTriangleRenderers || [],
            net = netRenderer && netRenderer.net,
            segments = [],
            screenFrom = Point2.create(),
            screenTo = Point2.create(),
            graphics = new Pixi.Graphics(),
            firstTriangle = triangles[0];
          if (!firstTriangle || !net || firstTriangle._happySeedPixelNet) return 0;
          strandCount += appendGridSegments(
            segments,
            net.sidePoints,
            net.divideX,
            net.divideY,
            1,
            3,
          );
          strandCount += appendGridSegments(
            segments,
            net.topPoints,
            net.topDivideX,
            net.topDivideY,
            1,
            2,
          );
          function refreshAggregateNetDepth() {
            var points = (net.sidePoints || []).concat(net.topPoints || []),
              frontWorldY = -Infinity;
            for (var pointIndex = 0; pointIndex < points.length; pointIndex += 1) {
              var pointY = Number(points[pointIndex] && points[pointIndex].position &&
                points[pointIndex].position.y);
              if (Number.isFinite(pointY)) frontWorldY = Math.max(frontWorldY, pointY);
            }
            if (!Number.isFinite(frontWorldY) || !firstTriangle.position) return !1;
            firstTriangle.position.y = Generic.PITCH_OFFSET_PIXELS_Y +
              frontWorldY * Generic.PIXELS_Y;
            return !0;
          }
          firstTriangle._happySeedRefreshPixelNetDepth = refreshAggregateNetDepth;
          pixelNetDepthUpdaters.push(refreshAggregateNetDepth);
          refreshAggregateNetDepth();
          firstTriangle._happySeedOriginalRenderWebGL = firstTriangle.renderWebGL;
          firstTriangle.renderWebGL = function (renderer) {
            var stadiumScaleX = this.stadium.scale.x,
              stadiumScaleY = this.stadium.scale.y,
              stadiumOffsetX = this.stadium.position.x / stadiumScaleX,
              stadiumOffsetY = this.stadium.position.y / stadiumScaleY;
            refreshAggregateNetDepth();
            graphics.clear();
            segments.forEach(function (segment) {
              Generic.worldToScreen(segment.from, screenFrom);
              Generic.worldToScreen(segment.to, screenTo);
              screenFrom.x = (screenFrom.x + stadiumOffsetX) * stadiumScaleX;
              screenFrom.y = (screenFrom.y + stadiumOffsetY) * stadiumScaleY;
              screenTo.x = (screenTo.x + stadiumOffsetX) * stadiumScaleX;
              screenTo.y = (screenTo.y + stadiumOffsetY) * stadiumScaleY;
              drawPixelSegment(graphics, screenFrom, screenTo, 0x26382f, .12, 4);
              drawPixelSegment(graphics, screenFrom, screenTo, 0xf4f2dd, .94, 0);
            });
            renderer.currentRenderer && renderer.currentRenderer.flush &&
              renderer.currentRenderer.flush();
            graphics.renderWebGL(renderer);
            renderer.currentRenderer && renderer.currentRenderer.start &&
              renderer.currentRenderer.start();
          };
          firstTriangle._happySeedPixelNet = !0;
          for (var index = 1; index < triangles.length; index += 1) {
            triangles[index]._happySeedOriginalRenderWebGL = triangles[index].renderWebGL;
            triangles[index].renderWebGL = function () {};
            triangles[index]._happySeedPixelNet = !0;
          }
          triangleCount += triangles.length;
          return triangles.length;
        }

        for (var rendererIndex = 0; rendererIndex < renderers.length; rendererIndex += 1) {
          installNetRenderer(renderers[rendererIndex]);
        }
        state.pixelDynamicNetTriangleCount = triangleCount;
        state.pixelDynamicNetStrandCount = strandCount;
        state.pixelDynamicNetApplied = triangleCount > 0;
        return state.pixelDynamicNetApplied;
      }

      function preserveOriginalGoalsOnly() {
        var source = stadium._stadium || {},
          bottom = source._bottom || [],
          middle = source._middle || [],
          top = source._top || [],
          index;
        for (index = 0; index < bottom.length; index += 1)
          bottom[index].visible = index < 2;
        for (index = 0; index < middle.length; index += 1)
          middle[index].visible = index < 2;
        for (index = 0; index < top.length; index += 1)
          top[index].visible = !1;
        if (!state.goalVisualAlignmentApplied && bottom.length >= 2 && middle.length >= 2) {
          var alignment = config.composition && config.composition.goalVisualAlignment,
            nudgeX = alignment && alignment.nudgeX,
            leftNudgeX = nudgeX && Number(nudgeX.left),
            rightNudgeX = nudgeX && Number(nudgeX.right);
          if (Number.isFinite(leftNudgeX) && Number.isFinite(rightNudgeX)) {
            state.goalVisualOffsets.left = leftNudgeX;
            state.goalVisualOffsets.right = rightNudgeX;
            bottom[0].position.x += state.goalVisualOffsets.left;
            middle[0].position.x += state.goalVisualOffsets.left;
            bottom[1].position.x += state.goalVisualOffsets.right;
            middle[1].position.x += state.goalVisualOffsets.right;
            state.goalVisualAlignmentApplied = !0;
          }
        }
        state.originalGoalSpriteCount = Math.min(2, bottom.length) +
          Math.min(2, middle.length);
        installPixelGoalAtlas();
      }

      function renderBase() {
        try {
          stadium.baseTexture.clear && stadium.baseTexture.clear();
          stadium.baseTexture.render(baseComposition, null, !0);
          stadium.disableOverlay && stadium.disableOverlay();
          preserveOriginalGoalsOnly();
          hideLegacyAnimalCrowd();
        } catch (error) {
          console.error("[stadium-v2] 统一背景烘焙失败", error);
        }
      }

      if (masterTexture.baseTexture && masterTexture.baseTexture.hasLoaded)
        renderBase();
      else if (masterTexture.baseTexture)
        masterTexture.baseTexture.once("loaded", renderBase);

      for (var presetIndex = 0;
        presetIndex < config.cameraPresets.length;
        presetIndex += 1)
        cameraPresets[config.cameraPresets[presetIndex].id] =
          config.cameraPresets[presetIndex];

      function focusAt(x, y, mode) {
        var nextX = clamp(Number(x) || pitch.center.x, 0, pitch.width),
          nextY = clamp(Number(y) || pitch.center.y, 0, pitch.height);
        pitch.camera.free();
        pitch.camera.lookAt({ x: nextX, y: nextY });
        pitch.camera.position.x = nextX;
        pitch.camera.position.y = nextY;
        if (pitch.camera.velocity) {
          pitch.camera.velocity.x = 0;
          pitch.camera.velocity.y = 0;
        }
        state.cameraTarget.x = nextX;
        state.cameraTarget.y = nextY;
        state.cameraMode = mode || "free";
        return !0;
      }

      function followBall() {
        window.__happySeedManualCamera = !1;
        pitch.camera.followBall();
        state.cameraMode = "ball";
        state.activeCamera = "normal";
        return !0;
      }

      function panBy(screenX, screenY) {
        var scale = Math.max(.65, effZoom()) * 18;
        window.__happySeedManualCamera = !0;
        state.lastManualCameraAt = performance.now();
        return focusAt(
          state.cameraTarget.x - (Number(screenX) || 0) / scale,
          state.cameraTarget.y - (Number(screenY) || 0) / scale,
          "free",
        );
      }

      function snapshot() {
        preserveOriginalGoalsOnly();
        hideLegacyAnimalCrowd();
        return {
          ready: state.ready,
          id: config.id,
          activeCamera: state.activeCamera,
          cameraMode: state.cameraMode,
          cameraTarget: { x: state.cameraTarget.x, y: state.cameraTarget.y },
          draggable: state.draggable,
          manualReturnDelayMs: state.manualReturnDelayMs,
          zoom: window.__matchZoom.get(),
          crowdMotion: state.crowdMotion,
          crowdFrame: 0,
          baseRenderSize: {
            width: stadium.baseTexture.width,
            height: stadium.baseTexture.height,
          },
          runtimeDisplaySize: {
            width: config.runtimeSize.width,
            height: config.runtimeSize.height,
          },
          opaqueBackgroundCount: 1,
          runtimePitchOverlay: !1,
          goalPositionSource: "stadium.json",
          originalGoalSpriteCount: state.originalGoalSpriteCount,
          goalVisualOffsets: Object.assign({}, state.goalVisualOffsets),
          goalVisualAlignmentApplied: state.goalVisualAlignmentApplied,
          pixelGoalAtlasApplied: state.pixelGoalAtlasApplied,
          pixelBallTextureApplied: state.pixelBallTextureApplied,
          pixelBallOutputApplied: state.pixelBallOutputApplied,
          pixelDynamicNetApplied: state.pixelDynamicNetApplied,
          pixelDynamicNetTriangleCount: state.pixelDynamicNetTriangleCount,
          pixelDynamicNetStrandCount: state.pixelDynamicNetStrandCount,
          pixelDynamicNetDepthMode: state.pixelDynamicNetDepthMode,
          legacyAnimalCrowdHidden: state.legacyAnimalCrowdHidden,
          layerCount: config.layers.length,
          cameraPresetCount: config.cameraPresets.length,
          preserves: {
            goalCollision: config.invariants.preserveGoalCollision,
            dynamicNet: config.invariants.preserveDynamicNet,
            camera: config.invariants.preserveCamera,
            depthSort: config.invariants.preserveDepthSort,
            humanCrowdOnly: state.legacyAnimalCrowdHidden,
          },
        };
      }

      function dispatchScene(name) {
        dispatch(name, snapshot());
      }

      window.__happySeedStadiumScene = {
        setCameraPreset: function (presetId) {
          var preset = cameraPresets[presetId],
            presetZoom;
          if (!preset) return !1;
          if (preset.followBall) followBall();
          else focusAt(
            pitch.width * preset.normalizedTarget[0],
            pitch.height * preset.normalizedTarget[1],
            "preset",
          );
          window.__manualZoomAt = performance.now();
          presetZoom = preset.zoomMultiplier;
          if (presetId === "free-kick" &&
            (window.innerWidth <= 900 || window.innerHeight <= 500))
            presetZoom = .9;
          window.__matchZoomMul = presetZoom;
          pitch.camera.instantZoom(effZoom());
          state.activeCamera = preset.id;
          dispatchScene("ab-stadium-camera");
          return !0;
        },
        focusAt: focusAt,
        followBall: function () {
          var changed = followBall();
          dispatchScene("ab-stadium-camera");
          return changed;
        },
        panBy: function (x, y) {
          var changed = panBy(x, y);
          dispatchScene("ab-stadium-camera");
          return changed;
        },
        resetCamera: function () {
          window.__matchZoom.reset();
          followBall();
          dispatchScene("ab-stadium-camera");
          return !0;
        },
        setCrowdMotion: function (enabled) {
          state.crowdMotion = !!enabled;
          dispatchScene("ab-stadium-camera");
          return !0;
        },
        getSnapshot: snapshot,
      };

      var previousFrame = stadium.frame.bind(stadium);
      installPixelDynamicNets();
      stadium.frame = function (frame) {
        previousFrame(frame);
        try {
          var now = performance.now();
          for (var depthIndex = 0; depthIndex < pixelNetDepthUpdaters.length; depthIndex += 1)
            pixelNetDepthUpdaters[depthIndex]();
          preserveOriginalGoalsOnly();
          hideLegacyAnimalCrowd();
          if (state.baseRefreshesRemaining > 0 && now - state.lastBaseRefreshAt > 180) {
            renderBase();
            state.lastBaseRefreshAt = now;
            state.baseRefreshesRemaining -= 1;
          }
          if (
            window.__happySeedManualCamera &&
            !dragState &&
            now - state.lastManualCameraAt >= state.manualReturnDelayMs
          ) {
            followBall();
            dispatchScene("ab-stadium-camera");
          }
        } catch (error) {
          console.error("[stadium-v2] 场景刷新失败", error);
        }
      };

      try {
        var cameraView = window.__matchGame && window.__matchGame.renderer.view,
          dragState = null;
        if (cameraView) {
          cameraView.style.touchAction = "none";
          cameraView.addEventListener("pointerdown", function (event) {
            if (event.button !== 0) return;
            dragState = { id: event.pointerId, x: event.clientX, y: event.clientY };
            try {
              cameraView.setPointerCapture && cameraView.setPointerCapture(event.pointerId);
            } catch {}
          });
          cameraView.addEventListener("pointermove", function (event) {
            if (!dragState || dragState.id !== event.pointerId) return;
            var dx = event.clientX - dragState.x,
              dy = event.clientY - dragState.y;
            dragState.x = event.clientX;
            dragState.y = event.clientY;
            panBy(dx, dy);
          });
          cameraView.addEventListener("pointerup", function (event) {
            if (!dragState || dragState.id !== event.pointerId) return;
            try {
              cameraView.releasePointerCapture && cameraView.releasePointerCapture(event.pointerId);
            } catch {}
            dragState = null;
            dispatchScene("ab-stadium-camera");
          });
          cameraView.addEventListener("pointercancel", function () {
            dragState = null;
            state.lastManualCameraAt = performance.now();
          });
          cameraView.addEventListener("wheel", function (event) {
            event.preventDefault();
            window.__matchZoom.step(event.deltaY > 0 ? .9 : 1.1);
            dispatchScene("ab-stadium-camera");
          }, { passive: !1 });
          cameraView.addEventListener("dblclick", function () {
            window.__happySeedStadiumScene.resetCamera();
          });
        }
      } catch (error) {
        console.error("[stadium-v2] 自由镜头初始化失败", error);
      }

      state.ready = !0;
      installPixelBallTexture();
      dispatchScene("ab-stadium-slice-ready");
      return !0;
    } catch (error) {
      stadium._pixelStadiumV2Init = !1;
      console.error("[stadium-v2] 初始化失败", error);
      return !1;
    }
  }

  function installDecisionDirector(options) {
    var stadium = options && options.stadium,
      pitch = options && options.pitch,
      runtime = options && options.runtime,
      effZoom = options && options.effZoom,
      playTrack3 = options && options.playTrack3,
      actorEntries = (stadium && stadium._happySeedActorEntries) || [];
    if (!stadium || !pitch || !runtime || !playTrack3 ||
      stadium._decisionDirectorV2Init || actorEntries.length !== 22)
      return !1;

    stadium._decisionDirectorV2Init = !0;
    try {
      var Pixi = runtime("pixi"),
        overlay = new Pixi.Container(),
        routeLayer = new Pixi.Container(),
        labelLayer = new Pixi.Container(),
        active = null,
        directorFrameHandle = null,
        state = {
          ready: !0,
          phase: "idle",
          scenarioId: null,
          selectedChoiceId: null,
          outcome: null,
          ballVisible: !1,
          ballPosition: null,
          choiceLocked: !1,
          performedActions: {},
          settleCount: 0,
          lastPointer: null,
        };
      overlay.addChild(routeLayer);
      overlay.addChild(labelLayer);
      stadium.bottomLayer.addChild(overlay);

      function snapshot() {
        return {
          ready: state.ready,
          phase: state.phase,
          scenarioId: state.scenarioId,
          runtimeMomentSource: active && active.script.runtimeMoment &&
            active.script.runtimeMoment.source || null,
          primaryRuntimeActorId: active && active.script.ball &&
            active.script.ball.sourceRuntimeActorId || null,
          ballOrigin: active && active.script.ball &&
            active.script.ball.normalized || null,
          selectedChoiceId: state.selectedChoiceId,
          outcome: state.outcome,
          ballVisible: state.ballVisible,
          ballPosition: state.ballPosition && {
            x: state.ballPosition.x,
            y: state.ballPosition.y,
            z: state.ballPosition.z,
          },
          choiceLocked: state.choiceLocked,
          performedActions: Object.assign({}, state.performedActions),
          settleCount: state.settleCount,
          visibleChoiceIds: active ? active.script.choices.map(function (choice) {
            return choice.id;
          }) : [],
          choiceHitZones: active ? active.routeViews.map(function (view) {
            var center = labelLayer.toGlobal(new Pixi.Point(
              view.anchor.x,
              view.anchor.y,
            ));
            return {
              id: view.id,
              centerX: center.x,
              centerY: center.y,
              x: center.x - 110,
              y: center.y - 45,
              width: 220,
              height: 90,
            };
          }) : [],
          lastPointer: state.lastPointer,
        };
      }

      function dispatchDirector(name, extra) {
        dispatch(name, Object.assign({ snapshot: snapshot() }, extra || {}));
      }

      function setPhase(phase) {
        state.phase = phase;
        dispatchDirector("ab-decision-director-phase", { phase: phase });
      }

      function entryFor(runtimeActorId) {
        for (var index = 0; index < actorEntries.length; index += 1)
          if (actorEntries[index].actor.runtimeActorId === runtimeActorId)
            return actorEntries[index];
        return null;
      }

      function releaseLiveBall() {
        try {
          var messages = runtime("messages"),
            owner = pitch.ball.owner;
          if (owner) {
            messages.releaseBall.send(owner);
            messages.releaseBall.send(pitch.ball);
            owner.hasBall = !1;
          }
          pitch.ball.inHands && pitch.ball.inHands.dropBall();
        } catch {}
      }

      function projectionPoint(normalized) {
        var bounds = window.__happySeedPixelStadiumConfig.pitchBounds;
        return {
          x: bounds.x + normalized[0] * bounds.width,
          y: bounds.y + normalized[1] * bounds.height - (normalized[2] || 0) * 46,
        };
      }

      function drawBezier(graphics, path) {
        var p0 = projectionPoint(path[0]),
          p1 = projectionPoint(path[1]),
          p2 = projectionPoint(path[2]),
          p3 = projectionPoint(path[3]);
        graphics.moveTo(p0.x, p0.y);
        graphics.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
      }

      function buildRoute(choice) {
        var group = new Pixi.Container(),
          visible = new Pixi.Graphics(),
          hit = new Pixi.Graphics(),
          label = new Pixi.Container(),
          plate = new Pixi.Graphics(),
          text = new Pixi.Text(choice.label, {
            font: '700 28px "Arial Narrow", sans-serif',
            fill: "#f5f7f7",
            stroke: "#081316",
            strokeThickness: 5,
            align: "center",
          }),
          anchor = projectionPoint(choice.visual.labelAnchor);
        visible.lineStyle(11, 0xc7ced0, .62);
        drawBezier(visible, choice.visual.previewPath);
        hit.lineStyle(42, 0xffffff, .001);
        drawBezier(hit, choice.visual.previewPath);
        hit.interactive = !0;
        hit.buttonMode = !0;
        text.anchor.set(.5, .5);
        plate.beginFill(0x102226, .92);
        plate.lineStyle(3, 0xd7ddde, .76);
        plate.drawRoundedRect(-84, -27, 168, 54, 14);
        plate.endFill();
        label.position.set(anchor.x, anchor.y);
        if (window.innerWidth <= 900 || window.innerHeight <= 500)
          label.scale.set(2, 2);
        label.addChild(plate);
        label.addChild(text);
        label.visible = !1;
        label.interactive = !1;
        label.buttonMode = !1;
        function choose() { requestChoice(choice); }
        hit.on("pointertap", choose);
        label.on("pointertap", choose);
        group.addChild(visible);
        group.addChild(hit);
        routeLayer.addChild(group);
        labelLayer.addChild(label);
        return {
          id: choice.id,
          choice: choice,
          group: group,
          visible: visible,
          hit: hit,
          label: label,
          anchor: anchor,
        };
      }

      function requestChoice(choice) {
        if (!active || state.phase !== "choosing" || state.choiceLocked) return;
        dispatchDirector("ab-decision-choice-selected", {
          choiceId: choice.id,
          scenarioId: active.script.scenarioId,
        });
      }

      function distanceToSegment(point, start, end) {
        var dx = end.x - start.x,
          dy = end.y - start.y,
          lengthSquared = dx * dx + dy * dy;
        if (!lengthSquared)
          return Math.hypot(point.x - start.x, point.y - start.y);
        var t = clamp(
          ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared,
          0,
          1,
        ),
          x = start.x + t * dx,
          y = start.y + t * dy;
        return Math.hypot(point.x - x, point.y - y);
      }

      function routeContainsScreenPoint(view, point) {
        var bounds = view.label.getBounds();
        if (point.x >= bounds.x && point.x <= bounds.x + bounds.width &&
          point.y >= bounds.y && point.y <= bounds.y + bounds.height)
          return !0;
        var previous = null;
        for (var index = 0; index <= 28; index += 1) {
          var normalized = cubic(view.choice.visual.previewPath, index / 28),
            projected = projectionPoint(normalized),
            screen = routeLayer.toGlobal(new Pixi.Point(projected.x, projected.y));
          if (previous && distanceToSegment(point, previous, screen) <= 22)
            return !0;
          previous = screen;
        }
        return !1;
      }

      function clearRoutes() {
        routeLayer.removeChildren();
        labelLayer.removeChildren();
      }

      function showRoutes(script) {
        clearRoutes();
        active.routeViews = script.choices.map(buildRoute);
      }

      function confirmRoute(choiceId) {
        (active.routeViews || []).forEach(function (view) {
          var chosen = view.id === choiceId;
          view.group.alpha = chosen ? 1 : .13;
          view.label.alpha = chosen ? 1 : .13;
          view.visible.clear();
          if (chosen) {
            view.visible.lineStyle(14, 0xffcb3d, 1);
            drawBezier(view.visible, active.choice.visual.previewPath);
          }
          view.hit.interactive = !1;
          view.label.interactive = !1;
        });
      }

      function setFrameEntryPosition(frame, position) {
        var entry = entryFor(position.runtimeActorId),
          entityId = entry && entry.entity && entry.entity.id,
          teams = [frame && frame.redTeam, frame && frame.blueTeam],
          player = null;
        if (entityId == null) return;
        for (var teamIndex = 0; teamIndex < teams.length; teamIndex += 1) {
          var players = teams[teamIndex] && teams[teamIndex].players || [];
          for (var playerIndex = 0; playerIndex < players.length; playerIndex += 1)
            if (players[playerIndex].id === entityId) {
              player = players[playerIndex];
              break;
            }
          if (player) break;
        }
        if (!player || !player.position) return;
        player.position.x = pitch.width * position.normalized[0];
        player.position.y = pitch.height * position.normalized[1];
        player.position.z = 0;
        player.speed = 0;
        player.hasBall = !1;
        if (player.heading) {
          player.heading.x = position.facing === "left" ? -1 : 1;
          player.heading.y = 0;
        }
      }

      function cubic(path, progress) {
        var t = clamp(progress, 0, 1),
          u = 1 - t,
          result = [];
        for (var axis = 0; axis < 3; axis += 1)
          result[axis] = u * u * u * (path[0][axis] || 0) +
            3 * u * u * t * (path[1][axis] || 0) +
            3 * u * t * t * (path[2][axis] || 0) +
            t * t * t * (path[3][axis] || 0);
        return result;
      }

      function worldPoint(normalized) {
        return {
          x: pitch.width * normalized[0],
          y: pitch.height * normalized[1],
          z: Math.max(.16, normalized[2] || 0),
        };
      }

      function currentBall(now) {
        if (!active || !active.execution || !active.executionStartedAt)
          return worldPoint(active.script.ball.normalized);
        var progress = clamp((now - active.executionStartedAt) /
          active.execution.durationMs, 0, 1);
        return worldPoint(cubic(active.execution.path, progress));
      }

      function playAnimation(entry, animation, holdMs) {
        if (!entry || !entry.renderer || !entry.renderer.spine) return null;
        var back = entry.renderer.spine.facingCamera === !1,
          variants = back ? [animation + "_back", animation] :
            [animation, animation + "_back"];
        for (var index = 0; index < variants.length; index += 1)
          if (entry.renderer.spine.animationExists(variants[index])) {
            playTrack3(window.__matchGame, entry.renderer, variants[index], holdMs);
            return variants[index];
          }
        return null;
      }

      function runCues(now) {
        if (!active || !active.execution) return;
        var elapsed = now - active.executionStartedAt;
        active.execution.actions.forEach(function (action, index) {
          var key = action.role + ":" + index;
          if (active.performedActions[key] || elapsed < action.atMs) return;
          active.performedActions[key] = !0;
          var targets = [];
          if (action.role === "wall")
            targets = active.script.wallActorIds.map(entryFor).filter(Boolean);
          else {
            var actor = active.script.actors[action.role];
            actor && targets.push(entryFor(actor.runtimeActorId));
          }
          targets.forEach(function (entry, targetIndex) {
            var played = playAnimation(entry, action.animation, 1050);
            if (played)
              state.performedActions[key + ":" + targetIndex] = played;
          });
        });
      }

      function advanceDirectorTimeline(now) {
        if (!active) return;
        if (state.phase === "staging" && active.framing.enabled) {
          var framingProgress = clamp(
              (now - active.framing.startedAt) / active.framing.durationMs,
              0,
              1,
            ),
            smoothProgress = framingProgress * framingProgress *
              (3 - 2 * framingProgress),
            framingZoom = active.framing.startZoom +
              (active.framing.targetZoom - active.framing.startZoom) *
              smoothProgress;
          window.__matchZoom.set(framingZoom);
        }
        if (state.phase === "staging" && now >= active.choicesReadyAt) {
          setPhase("choosing");
          dispatchDirector("ab-decision-director-choices", {
            choices: active.script.choices.map(function (choice) {
              return { id: choice.id, label: choice.label, kind: choice.visual.kind };
            }),
          });
          active.prepareResolve(snapshot());
        }
        if (state.phase === "executing" && active.executionStartedAt) {
          var ball = currentBall(now);
          state.ballPosition = ball;
          pitch.ball.placeAtPosition(ball.x, ball.y, ball.z);
          if (pitch.ball.velocity) {
            pitch.ball.velocity.x = 0;
            pitch.ball.velocity.y = 0;
            pitch.ball.velocity.z = 0;
          }
          runCues(now);
          if (now - active.executionStartedAt >= active.execution.durationMs)
            settle(now);
        } else if (state.phase === "settled" && now >= active.restoreAt) {
          setPhase("restoring");
          active.finishRestoreAt = now + 180;
        } else if (state.phase === "restoring" && now >= active.finishRestoreAt) {
          finishRestore(!1);
        }
      }

      function directorFrame(now) {
        directorFrameHandle = null;
        advanceDirectorTimeline(now);
        if (active) directorFrameHandle = window.requestAnimationFrame(directorFrame);
      }

      function ensureDirectorFrame() {
        if (directorFrameHandle == null)
          directorFrameHandle = window.requestAnimationFrame(directorFrame);
      }

      function restoreCamera() {
        if (!active || !active.savedCamera) return;
        if (active.script.camera && active.script.camera.preserveCurrent) return;
        window.__matchZoom.set(active.savedCamera.zoom);
        if (active.savedCamera.mode === "ball")
          window.__happySeedStadiumScene.followBall();
        else
          window.__happySeedStadiumScene.focusAt(
            active.savedCamera.target.x,
            active.savedCamera.target.y,
            active.savedCamera.mode || "free",
          );
      }

      function restoreLiveBall(savedBall) {
        if (!savedBall) return;
        try {
          pitch.ball.placeAtPosition(
            savedBall.position.x,
            savedBall.position.y,
            savedBall.position.z,
          );
          if (pitch.ball.velocity) {
            pitch.ball.velocity.x = savedBall.velocity.x;
            pitch.ball.velocity.y = savedBall.velocity.y;
            pitch.ball.velocity.z = savedBall.velocity.z;
          }
        } catch {}
      }

      function finishRestore(cancelled) {
        var finished = active;
        if (!finished) return;
        clearRoutes();
        restoreCamera();
        restoreLiveBall(finished.savedBall);
        try {
          finished.timeScaleToken != null &&
            pitch.timeScale.reset(finished.timeScaleToken);
        } catch {}
        if (directorFrameHandle != null) {
          window.cancelAnimationFrame(directorFrameHandle);
          directorFrameHandle = null;
        }
        active = null;
        state.phase = "idle";
        state.scenarioId = null;
        state.selectedChoiceId = null;
        state.outcome = null;
        state.ballVisible = !1;
        state.ballPosition = null;
        state.choiceLocked = !1;
        state.performedActions = {};
        if (cancelled) {
          finished.prepareResolve && finished.prepareResolve({ cancelled: !0, snapshot: snapshot() });
          finished.settledResolve && finished.settledResolve({ cancelled: !0, snapshot: snapshot() });
          finished.completedResolve && finished.completedResolve({ cancelled: !0, snapshot: snapshot() });
          dispatchDirector("ab-decision-director-cancelled", { scenarioId: finished.script.scenarioId });
        } else {
          finished.completedResolve({ completed: !0, snapshot: snapshot() });
          dispatchDirector("ab-decision-director-completed", {
            scenarioId: finished.script.scenarioId,
            choiceId: finished.choice.id,
            outcome: finished.outcome,
          });
        }
      }

      function settle(now) {
        if (!active || active.settled) return;
        active.settled = !0;
        state.settleCount += 1;
        setPhase("settled");
        active.settledResolve({ settled: !0, snapshot: snapshot() });
        dispatchDirector("ab-decision-director-settled", {
          scenarioId: active.script.scenarioId,
          choiceId: active.choice.id,
          outcome: active.outcome,
          terminal: active.execution.terminal,
        });
        active.restoreAt = (now || performance.now()) +
          active.script.timeline.settledHoldMs;
      }

      window.__happySeedDecisionDirectorV2 = {
        prepare: function (script) {
          if (!script || active || state.phase !== "idle")
            return Promise.reject(new Error("DecisionDirectorV2 当前不可准备"));
          var stadiumSnapshot = window.__happySeedStadiumScene.getSnapshot();
          var prepareStartedAt = performance.now(),
            compactViewport = window.innerWidth <= 900 || window.innerHeight <= 500;
          active = {
            script: script,
            routeViews: [],
            choice: null,
            outcome: null,
            execution: null,
            executionStartedAt: 0,
            performedActions: {},
            settled: !1,
            timeScaleToken: null,
            choicesReadyAt: prepareStartedAt + 360,
            prepareResolve: null,
            restoreAt: 0,
            finishRestoreAt: 0,
            savedCamera: {
              mode: stadiumSnapshot.cameraMode,
              target: stadiumSnapshot.cameraTarget,
              zoom: stadiumSnapshot.zoom,
            },
            framing: {
              enabled: script.camera.smoothFitRoutes &&
                stadiumSnapshot.cameraMode === "ball",
              startedAt: prepareStartedAt,
              durationMs: 360,
              startZoom: stadiumSnapshot.zoom,
              targetZoom: Math.min(stadiumSnapshot.zoom, compactViewport ? .34 : .42),
            },
            savedBall: {
              position: {
                x: pitch.ball.position.x,
                y: pitch.ball.position.y,
                z: pitch.ball.position.z,
              },
              velocity: {
                x: pitch.ball.velocity && pitch.ball.velocity.x || 0,
                y: pitch.ball.velocity && pitch.ball.velocity.y || 0,
                z: pitch.ball.velocity && pitch.ball.velocity.z || 0,
              },
            },
          };
          state.scenarioId = script.scenarioId;
          state.selectedChoiceId = null;
          state.outcome = null;
          state.ballVisible = !0;
          state.ballPosition = worldPoint(script.ball.normalized);
          state.choiceLocked = !1;
          state.performedActions = {};
          window.__introStart = 0;
          releaseLiveBall();
          try {
            active.timeScaleToken = pitch.timeScale.change(0);
          } catch {}
          setPhase("staging");
          showRoutes(script);
          ensureDirectorFrame();
          dispatchDirector("ab-decision-director-prepared", { scriptId: script.id });
          return new Promise(function (resolve) {
            active.prepareResolve = resolve;
          });
        },
        execute: function (payload) {
          if (!active || state.phase !== "choosing" || state.choiceLocked)
            throw new Error("DecisionDirectorV2 选择已锁定或场景未就绪");
          var choice = active.script.choices.find(function (candidate) {
              return candidate.id === payload.choiceId;
            }),
            execution = choice && choice.outcomes[payload.outcome];
          if (!choice || !execution)
            throw new Error("DecisionDirectorV2 缺少显式 choice/outcome 分支");
          state.choiceLocked = !0;
          state.selectedChoiceId = choice.id;
          state.outcome = payload.outcome;
          active.choice = choice;
          active.outcome = payload.outcome;
          active.execution = execution;
          active.executionStartedAt = performance.now() +
            active.script.timeline.selectionFeedbackMs;
          confirmRoute(choice.id);
          setPhase("executing");
          var settled = new Promise(function (resolve) {
              active.settledResolve = resolve;
            }),
            completed = new Promise(function (resolve) {
              active.completedResolve = resolve;
            });
          return { settled: settled, completed: completed, snapshot: snapshot() };
        },
        cancel: function () {
          if (!active) return !1;
          finishRestore(!0);
          return !0;
        },
        getSnapshot: snapshot,
      };

      try {
        var view = window.__matchGame && window.__matchGame.renderer.view,
          choicePointer = null;
        if (view) {
          view.addEventListener("pointerdown", function (event) {
            choicePointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
          });
          view.addEventListener("pointerup", function (event) {
            if (!choicePointer || choicePointer.id !== event.pointerId ||
              !active || state.phase !== "choosing") {
              choicePointer = null;
              return;
            }
            var moved = Math.hypot(
                event.clientX - choicePointer.x,
                event.clientY - choicePointer.y,
              ),
              point = { x: event.clientX, y: event.clientY };
            state.lastPointer = { x: point.x, y: point.y, moved: moved, hit: null };
            choicePointer = null;
            if (moved > 12) return;
            for (var index = active.routeViews.length - 1; index >= 0; index -= 1)
              if (routeContainsScreenPoint(active.routeViews[index], point)) {
                state.lastPointer.hit = active.routeViews[index].id;
                requestChoice(active.routeViews[index].choice);
                break;
              }
          });
          view.addEventListener("pointercancel", function () {
            choicePointer = null;
          });
        }
      } catch (error) {
        console.error("[decision-director-v2] 场内选项输入初始化失败", error);
      }

      var previousFrame = stadium.frame.bind(stadium);
      stadium.frame = function (frame) {
        if (!active) {
          previousFrame(frame);
          return;
        }
        try {
          var now = performance.now();
          active.script.actorPositions.forEach(function (position) {
            setFrameEntryPosition(frame, position);
          });
          var ball = currentBall(now);
          state.ballPosition = ball;
          if (frame && frame.ball && frame.ball.position) {
            frame.ball.position.x = ball.x;
            frame.ball.position.y = ball.y;
            frame.ball.position.z = ball.z;
            frame.ball.inHands = -1;
            if (frame.ball.velocity) {
              frame.ball.velocity.x = 0;
              frame.ball.velocity.y = 0;
              frame.ball.velocity.z = 0;
            }
          }
          pitch.ball.placeAtPosition(ball.x, ball.y, ball.z);
          if (pitch.ball.velocity) {
            pitch.ball.velocity.x = 0;
            pitch.ball.velocity.y = 0;
            pitch.ball.velocity.z = 0;
          }
          advanceDirectorTimeline(now);
          previousFrame(frame);
        } catch (error) {
          console.error("[decision-director-v2] 时间线执行失败", error);
          previousFrame(frame);
          active && active.execution && settle();
        }
      };

      dispatchDirector("ab-decision-director-ready");
      return !0;
    } catch (error) {
      stadium._decisionDirectorV2Init = !1;
      console.error("[decision-director-v2] 初始化失败", error);
      return !1;
    }
  }

  window.__happySeedRuntimeV2 = {
    installStadium: installStadium,
    installDecisionDirector: installDecisionDirector,
  };
})();
