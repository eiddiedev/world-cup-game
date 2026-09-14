# 《剑指美加墨》换设备开发交接

核对日期：2026-09-14。此文档记录源码与本地验证状态，不代表线上部署、抖音提审或发布验收。

## 从哪里接续

- GitHub 仓库：`https://github.com/eiddiedev/world-cup-game`（公开仓库）。
- 唯一接续分支：`main`；不再维护 `codex/*` 或互动空间的长期产品分支。此前 GitHub 产品分支的提交均在 `main` 历史中，旧实现仍可追溯。
- 产品交付方向仅两个：抖音小游戏版是主版本；互动空间版冻结，等主版本完成后从同一业务源码统一裁剪、打包和压缩。旧展示版不是第三个产品版本。
- 当前唯一可构建目标：`compliant-full`（`config/variants.mjs`）。Vercel 配置和 `npm run dev` / `npm run build` 都指向它；这是 React/Vite 合规 H5 基线，不是抖音原生小游戏提审包。
- 互动空间版不是当前可执行的构建目标或现成 ZIP。教练模式、首页独立点球入口已下线；历史场内教练决策只供开发验收，不进入冠军征程。
- Git 提交的是源码、合规美术、Runtime 资源和可复现的球场源图；构建目录、环境变量和浏览器存档不上传。根目录的“真实版队徽”演示 ZIP 已从工作区移至废纸篓，不属于产品版本。公开仓库内不要加入密钥或未授权素材。

## 当前进度与证据边界

| 范围 | `main` 当前状态 | 还不能宣称 |
| --- | --- | --- |
| 冠军征程 | 本地实现 16 支可选队、23 人征召、赛程、逐场布阵、更衣室、直接操控、战术换人、赛后结算与旧存档迁移 | 抖音真机完整夺冠流程已验收 |
| 道具 | 六种道具的库存、最多三件携带、对象选择、实际效果与确定性掉落；六枚像素图标 | 付费商业化或平台支付已接入 |
| 比赛画面 | 透视竖纹草皮 `stadium-day-master-v4.png`，原白线和非草皮保护像素经审计；最终图加载门控 | 所有目标手机的性能/冷缓存均已验收 |
| 比赛规则 | 常规越位事件链、延迟判罚/进球无效、铁血足球 HP 与规则预设已进入本地代码和自动测试 | 实际平台长时间联机的权威结果、反作弊已验收 |
| 联机 | Node WebSocket 房间服务、可选 Redis 存储、六位房间码、重连；大厅有常规/无规则/点球三种模式；本地自动测试通过 | 正式 WSS/Redis 已部署、200 人容量已压测、双真机联调已完成 |
| 发布 | `compliant-full` 网页构建与合规资源校验可运行；`vercel.json` 指向 H5 输出目录 | 已有抖音小游戏原生 `game.js` / `game.json` / `project.config.json` 提审包，或 Vercel/WSS 已随本次提交上线 |
| 互动空间版 | 作为第二个产品方向保留；旧源码与 2026-08-03 的打包合同可从 `main` 的 Git 历史追溯，目前冻结 | 当前 `main` 能构建合规互动空间 ZIP，或旧包可以直接上传 |

截至本次交接的本地验证：55 个测试文件、513 项测试通过；ESLint、球场透视审计、合规 H5 构建和包体校验通过。其他素材审计命令见下方；这些结果不是线上/平台验证。

## 新设备首次启动

要求 Node.js 20.19+ 或 22.12+、npm 和 Git；当前验证机使用 Node.js 25.8.2、npm 11.11.1。先用 `npm ci` 按锁文件安装，不提交 `node_modules/`。

```bash
git clone https://github.com/eiddiedev/world-cup-game.git
cd world-cup-game
npm ci
npm run dev
```

前端默认尝试 5176 端口（被占用时 Vite 可能选择下一端口）。本地联机另开终端：

```bash
npm run online:server
```

开发页面会默认连接当前主机的 `ws://<hostname>:8787`。服务端在没有 `REDIS_URL` 时使用进程内房间存储，适合本地调试；进程重启不保留房间。需要 Redis 时，在服务端进程环境中设置 `REDIS_URL`，例如 `REDIS_URL=redis://127.0.0.1:6379 npm run online:server`。不要把实际连接串提交到 Git。

非开发 H5 构建要在构建前提供 `VITE_MATCH_WS_URL=wss://...`，否则联机入口不会显示。`.env.example` 只说明变量，不包含真实地址；Vercel 只托管静态 H5，WebSocket/Redis 服务需单独部署、配置 HTTPS/WSS 与平台域名白名单。仅打开前端进程不能使联机房间可用。

```bash
npm test -- --run
npm run lint
npm run audit:human-slice
npm run audit:kits
npm run audit:font-subset
npm run audit:runtime-actors
npm run audit:match-equipment
npm run audit:stadium-slice
npm run audit:match-sfx
npm run audit:decision-scenes
npm run build
npm run verify:compliant-pack
```

`npm run build` 生成 `.variant-build/compliant-full/`，不生成小游戏包或互动空间 ZIP。若新增中文 UI 文案使 `audit:font-subset` 提示缺字，先运行 `npm run assets:font-subset` 重建并提交 `public/assets/fonts/zpix.ttf`，再重跑审计和构建。

## 互动空间版冻结与未来打包要求

现在**不更新、不生成、不上传**互动空间版。等抖音小游戏主版本完成后，从当时 `main` 的同一业务源码裁剪一个独立的离线 H5 产物；不要恢复旧 ZIP 或复制旧分支覆盖主线。旧互动空间实现可从 `main` 历史提交 `fc8ead0` 追溯，旧三目标构建合同可用 `git show 69294b2:config/variants.mjs` 查看，但两者都不是当前可提交包。

重新建立构建器时，按项目最后一次内部互动空间合同做预验收：

1. 只为互动空间产出一个 ZIP；ZIP 根目录直接是 `index.html`，不多套文件夹。入口与游戏素材全部随包提供，断网可完整游玩；不得依赖外链、远端请求或联机 WebSocket。平台兼容层应与抖音小游戏平台适配层分开。
2. 包内路径使用 ASCII，移除 `__MACOSX`、`.DS_Store`、开发实验页面、未使用素材和版权审计原图。旧内部验证器还检查外部脚本/样式、`iframe`、新窗口、`fetch`、`XMLHttpRequest`、`WebSocket`、`EventSource`、`eval` 等联网或动态执行路径；最终以重建后的包内实际代码和平台验证结果为准。
3. 压缩后从**最终 ZIP**重新统计体积并生成资源报告；保留 `build-info.json`（目标、Git SHA、配置与美术清单哈希、生成时间），校验美术授权和原图哈希不泄漏。旧 `compliant-interactive` 配置与内部验证器采用 **8 MiB** 上限；这是 2026-08-03 项目内部目标，**不是本次已核实的平台现行官方上限**。更早的单独构建器曾写 30 MiB，不能直接沿用。
4. 重新安装或实现内部 ZIP 验证，再用互动空间当期 `h5-validator` 和实际上传环境复验；至少覆盖首次加载、第二场比赛、退出重进、横屏触控、声音及旧球场/人物不闪现。任何一次旧包的通过记录，都不代表新包已通过。

打包前先向平台确认当期 ZIP 上限、入口目录结构、脚本/网络限制及素材/图标要求。公开资料检索未找到与本项目所用“互动空间”上传面完全对应的最新官方规范，因此本节将历史工程约束与待确认的平台规则明确分开。

## 代码入口与下一步

- 产品/功能边界：`config/variants.mjs`、`src/config/runtime.js`；主路由和存档：`src/App.jsx`、`src/utils/saveManager.js`。
- 冠军征程：`src/components/` 下的征召、赛程、阵容、道具、更衣室、比赛和赛后页面；道具算法在 `src/utils/journeyItems.js`。
- 足球 Runtime：`public/match-runtime-min/standalone-match.js`、`public/match-runtime-min/happyseed/` 和 `src/services/happySeedMatchRuntime.js`。第三方物理核心 `public/match-runtime-min/scripts/match.rebuilt.js` 不要直接改。
- 球场复现：`resources/stadium-source/`、`scripts/compose_vertical_pitch.py`、`scripts/audit_vertical_pitch.py`；生产图在 `public/pixel/stadiums/international-championship-day-v1/`。
- 联机协议、客户端、服务端：`src/online/onlineProtocol.js`、`src/services/onlineRoomClient.js`、`server/online/`；首页不再提供单机点球入口，联机点球由 `OnlineLobbyScreen` 进入 `OnlinePenaltyModeScreen`。

下一阶段优先级：先完成抖音小游戏运行环境/构建适配和主流程真机验证；再部署独立 WSS + Redis、进行双真机三模式联调及重连/异常输入/容量压测；最后复核美术与第三方 Runtime 权利、包体、隐私及平台当期审核要求。抖音主版本完成后，才进入互动空间版的统一裁剪、打包、压缩与平台验收。2026-09-20 是原计划目标日期，不应把本地测试通过等同于届时可提审。

存档使用浏览器 `localStorage`（当前键 `targeting-2026-compliant-full-save`），联机重连会话使用 `sessionStorage`。Git 克隆不会迁移个人存档或活跃房间；若要保留旧设备的存档，需要在受控环境中另行备份与导入，勿把存档放入公开仓库。
