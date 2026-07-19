# DecisionSceneScriptV2：精准决策导演合同

日期：2026-07-14  
状态：危险任意球样板已实现；未经产品负责人验收，不扩展另外四个代表场景。

## 边界

正式比赛页不再把 53 个本地决策交给通用 Runtime 场景族，也不从结果文字、choice ID 或正则推测动作。`decisionLibrary`、`decisionSystem`、`CoachDecisionEvent` 与本地概率结算继续作为玩法权威；Runtime V2 只消费经过校验的显式场景脚本。

旧 `MatchVisualEvent` 通用桥只允许在 `happyseed-runtime-lab.html` 技术实验室加载。正式 `happyseed-runtime.html` 不写入 `window.__happySeedMatchVisualEventConfig`，不安装 `window.__happySeedMatchVisualEvents`，也忽略退役的 `decisionCatalog=1` 参数。

## 场景合同

`src/utils/decisionSceneScriptV2.js` 为每个正式样板声明。危险任意球不再提供一套预制站位，而是要求业务层传入 `runtime-decision-moment-v1`：

- 连续比赛当时的 22 个 `runtimeActorId`、真实站位和朝向；
- 主罚者、接应者、门将、防守者与四人人墙；
- 当时球权与脚下球锚点；
- 以当前跟球镜头为起点的 360ms 平滑缩镜 framing，不切到预制镜头；
- 三个选择各自的世界坐标预览曲线；
- 每个本地 outcome 独立的执行曲线、动作 cue、终点和时长；
- 150ms 选择确认与至少 800ms 的终点保持画面。

危险任意球的三个选择覆盖 11 个显式结果：直接任意球 4 个、传中争顶 4 个、短传重组 3 个。缺失或多余 outcome 均无法通过 schema 测试。

## 导演状态

固定状态为：

`idle -> staging -> choosing -> executing -> settled -> restoring -> idle`

- `idle` 中由机会检测器观察真实球权；红队持球者自然进入前场危险区域时，每个进入窗口只掷一次本地概率，不在固定时间强行触发。
- `staging/choosing` 使用 Runtime 的 `pitch.timeScale` 冻结当时的连续比赛瞬间，不重排任何球员；渲染、倒计时、自由镜头和场内点击保持运行。
- `executing` 锁定唯一 choice/outcome；先显示选路反馈，150ms 后才启动动作与足球。
- `settled` 在足球到达脚本终点后触发；玩法权威只在此时幂等写入比分、统计与结果播报。
- `restoring` 在 1000ms 终点保持后恢复比赛时钟；取消和异常使用同一恢复路径。

导演时间线使用自己的 `requestAnimationFrame` 推进 staging、球路、cue、settled 保持与恢复，不依赖第三方比赛 timeScale、旧 `setTimeout` 包装或 `stadium.frame` 是否继续产出插值帧。第三方帧只负责渲染导演当前权威状态。

Runtime 内部桥固定为 `window.__happySeedDecisionDirectorV2`，只公开：

- `prepare(script)`
- `execute({ choiceId, outcome })`
- `cancel()`
- `getSnapshot()`

业务服务层固定公开：

- `pollFormalCoachDecisionOpportunity()`
- `prepareFormalCoachDecision(decision, runtimeMoment)`
- `subscribeToRuntimeDecisionChoices(listener)`
- `executeFormalCoachDecisionChoice(decision, choiceId)`
- `getDecisionDirectorSnapshot()`
- `cancelFormalCoachDecision()`

## 开发验收参数

开发环境可使用 `?naturalDecisionChance=1` 把“下一次合法危险区域进入窗口”的触发概率设为 100%；它仍要求球员和球在连续比赛里真实到达区域，不传送球员、球或相机。`?acceptanceOutcome=<outcome>` 可直接指定当前选择下的一个合法结果。两个参数都不进入生产存档或联网接口；非法 outcome 会被忽略。

## 不变量

- AI 与网络不参与选择、足球轨迹和结果结算。
- `match.rebuilt.js` 不修改。
- 球门碰撞、动态球网和 22 人物理实体继续归原 Runtime。
- 场内曲线是球场世界坐标子节点；拖动或缩放镜头时与草坪保持同一变换。
- React 层只把 Runtime 提供的世界坐标锚点投影成真实 DOM 按钮；按钮完整显示方案说明、风险、收益和成功提示。横屏越界时只做屏内夹取与纵向避让，不改变路线本身。
