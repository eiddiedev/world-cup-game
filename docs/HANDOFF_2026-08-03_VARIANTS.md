# 《剑指美加墨》三版本架构交接（2026-08-03）

> 给下一位 Agent：开始工作前请完整阅读本文，然后运行 `git status --short --branch`、`git log -5 --oneline`。不要从旧 ZIP、旧分支或 stash 直接恢复文件覆盖 `main`。

## 1. 当前结论

仓库已经改成“一套业务源码、三个运行目标、一个上传包”的结构：

- 唯一开发分支和业务源码来源是 `main`。
- 日常 Bug 只修一次，修在 `main` 的公共业务代码中；三个版本从同一提交派生。
- 不维护三个长期版本分支，也不要手动复制同一修复到三套目录。
- 三个目标都可以拥有本地运行目录，但**只有抖音互动空间版允许生成 ZIP 包体**。
- 当前合规美术尚未提供完整，因此合规完整版和互动空间合规版必须安全失败，不能回退到展示版原图或占位图。

功能基准提交：

- `d624478`：保留重构前有效的互动空间兼容及压缩工作。
- `24fad0f`：统一三版本架构、美术包隔离、清理和构建保护。
- `21d00b3`：修正打包边界，禁止两个完整版生成 ZIP。

本文创建前，`main` 比 `origin/main` 超前 3 个提交，尚未推送。远端基准为 `c42d705`。

## 2. 三个版本的硬边界

唯一配置来源是：

- `config/variants.mjs`
- `config/art-rights.json`

不要在组件中重新写一套球队列表或功能开关。

| 目标 ID | 用途 | 美术包 | 功能 | 是否生成 ZIP |
|---|---|---|---|---|
| `showcase-full` | 演示、完整体验 | `showcase` 原始美术 | 全功能 | 否 |
| `compliant-full` | 合规素材录制、剪辑 | `compliant` 替换美术 | 与展示完整版完全一致 | 否 |
| `compliant-interactive` | 抖音互动空间上传 | `compliant` 替换美术 | 压缩后的互动空间功能边界 | **是，唯一上传包** |

两个完整版之间只能存在美术差异，不能出现玩法、流程、数据或 Bug 修复差异。

### 2.1 展示完整版 `showcase-full`

必须包含：

- 16 支可选球队。
- 教练模式和球员模式。
- 图鉴入口和图鉴内容。
- 独立点球入口，使用项目原有逐帧像素动画方案。
- 正式比赛打平后的点球大战。
- 全部比赛流程、赛后文案、球员模式流程、音效和缩放。
- 当前演示用原始标题、大力神杯、国旗和队徽。

只生成 `.variant-build/showcase-full/`，**禁止生成完整版 ZIP**。

### 2.2 合规完整版 `compliant-full`

功能必须与 `showcase-full` 完全一致，只替换版权敏感美术。

只生成 `.variant-build/compliant-full/`，**禁止生成完整版 ZIP**。

### 2.3 互动空间版 `compliant-interactive`

这是唯一需要打成 ZIP 上传的版本。

必须包含：

- 教练模式。
- 球员模式。
- 西班牙、英格兰、挪威、佛得角 4 支可选球队。
- 48 队完整赛程和对手数据。
- 4 支可选队的精确球衣，以及其余赛程球队使用的共享染色球衣方案。
- 正式比赛打平后的点球大战。
- 比赛引擎、自有像素球员、球衣/身体/号码/球场组件。
- 完整球场音效，不可因压缩被静音或删减。
- 教练模式画面缩放，当前配置为默认 `0.68`、最小 `0.48`；目标是移动端能够看到球场全貌，球员不能显得过大。
- 球员模式原有缩放逻辑。
- 退出比赛后再次开赛的完整生命周期清理。
- 抖音离线协议下的资源内存注入、骨骼 JSON 和精灵图缓存兼容。
- 移动端安全区、教程高亮和返回按钮适配。

必须排除：

- 图鉴入口、图鉴页面及其专用资源。
- 独立点球入口、独立点球页面及其专用资源。
- 注意：**只能移除独立入口，正式比赛打平后的点球大战必须保留。**
- 除 4 支指定球队外的可选入口和冗余精确球衣资源；48 队赛程不能因此被删除。
- 展示版的版权敏感原图。
- HappySeed 原项目的动物球员和会短暂露出的原始球场兜底画面。
- Runtime Lab、探针页面、`probe.js`、诊断矩阵、minimal UI 和上传测试专用代码。
- 外链、联网依赖、非 ASCII 包内路径、`__MACOSX` 和 `.DS_Store`。

包体合同：

- 文件名固定为 `targeting-2026-compliant-interactive.zip`。
- ZIP 根目录直接包含 `index.html`，不能多套一层目录。
- 纯离线运行。
- 所有包内路径 ASCII 安全。
- 最终 ZIP 不超过 `8 MiB`。
- 资源报告必须从最终压缩、重命名后的 ZIP 重新统计。
- 必须通过仓库内部验证器和互动空间 `h5-validator`。
- 必须包含 `build-info.json`，记录目标、Git SHA、配置哈希、美术清单哈希和时间。

## 3. 版权美术边界

美术包目录：

- `art-packs/showcase/`：当前展示版原始美术，可以服务展示完整版。
- `art-packs/compliant/`：后续由用户提供的合规素材。

首批受保护清单共 67 项：

- 3 张标题/奖杯相关图。
- 48 面国家队国旗。
- 16 个可选国家队队徽。

资源键和目标路径以 `config/art-rights.json` 为准。路径使用稳定英文名，例如：

- `assets/branding/title-frame-1.png`
- `assets/branding/trophy.png`
- `assets/flags/spain.png`
- `assets/crests/spain.png`

当前 `art-packs/compliant/manifest.json` 状态为 `pending`，素材文件尚未齐全。下一位 Agent 不得为了出包而：

- 把状态直接改成 `ready`。
- 复制 `showcase` 图片冒充合规素材。
- 自动生成占位图。
- 缺图时回退到原图。
- 绕过哈希、尺寸和最终 ZIP 泄漏检查。

只有所有替换素材就位并经用户确认后，才能把 manifest 改为 `ready`。构建器会检查：PNG 类型、与原图完全一致的尺寸、原图/替换图 SHA-256 不同，以及最终输出中不存在任何原始受保护图片哈希。

## 4. 开发、构建和端口

开发端口：

```bash
npm run dev:showcase      # 5175，展示完整版
npm run dev:compliant     # 5176，合规完整版
npm run dev:interactive   # 5173，互动空间版
```

开发模式会显示版本标识；正式输出隐藏标识。不要再用端口号猜版本，实际版本由 `VITE_VARIANT_ID` 和统一配置决定。

构建命令：

```bash
npm run build:showcase
npm run build:compliant
npm run build:interactive
npm run release:all
```

重要解释：

- `build:showcase` 和 `build:compliant` 只编译网页运行目录，不打 ZIP。
- `build:interactive` 是唯一打 ZIP 的命令。
- `release:all` 会验证同一提交下的三个目标，但也只有互动空间目标生成 ZIP。
- `release:all` 要求位于干净的 `main`。
- 当前合规素材为 `pending`，所以后面三个涉及合规素材的正式构建应当失败，这是正确保护，不是构建 Bug。

生成目录：

- 网页目录：`.variant-build/<variant-id>/`
- 临时公共资源：`.variant-public/<variant-id>/`
- 唯一上传包：`artifacts/<YYYYMMDD>-<short-sha>/targeting-2026-compliant-interactive.zip`

这些目录均被 Git 忽略，不要提交构建产物。

## 5. 比赛引擎修改边界

`public/match-runtime-min/scripts/match.rebuilt.js` 是第三方物理核心，原则上不要直接修改。

自有和平台适配逻辑主要位于：

- `public/match-runtime-min/standalone-match.js`
- `public/match-runtime-min/shim.js`
- `public/match-runtime-min/happyseed/`
- `src/services/happySeedMatchRuntime.js`
- `src/components/HappySeedMatchBroadcast.jsx`
- `src/utils/formalMatchSession.js`

平台判断只能保留在必要的底层加载/兼容位置。业务组件中不要继续散落 `IS_DOUYIN_DEMO` 或复制两套比赛逻辑。

互动空间曾真实暴露以下加载链问题：

1. `data/player.json` 在平台协议下返回 `null`，导致 `t.bones` 报错。
2. 骨骼数据内存注入后，`indicators/sight.png` 等精灵帧未进入 texture cache。
3. 比赛实例已创建但 `started=false`、`players=0`，表面看起来像“加载超时”。

这些不是静态“加载中”页面导致，也不应通过增加等待时间掩盖。资源应在创建球员渲染器前完成内存注入和缓存注册。

不要删除自有球员资源后依赖 HappySeed 动物球员兜底；兜底内容应该不打包或不可见，不能在慢设备、第二场比赛或异常加载时闪现。

## 6. 必须持续回归的历史问题

以下项目属于发布前强制真机/浏览器冒烟项。自动测试通过不等于互动空间真机已经验收：

- 门将扑住射门后比赛继续运行，不能全员冻结。
- 教练决策的射门动画结束后恢复比赛，不得让 Runtime 永久停在决策状态。
- 退出比赛后开始下一场，不得定格在上一场静态帧。
- 第二场比赛不得加载 HappySeed 原球场或动物球员。
- 球员模式球场能在互动空间正常创建和显示。
- 教练模式能够继续往外缩放，移动端能看到球场全貌。
- 球场缩放不会破坏 HUD、触控、球员命中区或教程高亮定位。
- 球场音效完整保留。
- 移动端球员选择教程高亮准确，点击下一步后第三步不会卡住。
- 所有左上角返回按钮尊重手机圆角/安全区，不能贴边被遮挡。
- 红牌球员离场后不会定格或露出动物组件。
- 独立逐帧像素点球只存在于完整版；正式比赛点球大战三个版本都正常。

如要修“比赛冻结”，应优先检查统一的决策结束收口和 Runtime 生命周期，不要逐个决策堆定时器。至少核对：决策 Promise 是否完成、比赛暂停锁是否释放、球权/死球状态是否推进、动画异常是否有 `finally` 清理、退出时旧实例和监听器是否销毁。

## 7. 当前验证状态

在 `21d00b3` 上已验证：

- `npm test -- --run`：38 个测试文件、421 项测试通过。
- `npm run lint`：通过。
- `npm run build:showcase`：通过，只生成 `.variant-build/showcase-full/`，结果为 `packaged: false`，没有 ZIP。
- 仓库 `artifacts/` 当前没有完整版 ZIP。

尚未完成：

- 合规素材制作与放入。
- 新架构下正式的合规完整版构建。
- 新架构下正式的互动空间 ZIP 构建和真机上传验收。
- 三版本完整人工冒烟。

此前曾用展示美术作为**非发布测试替身**验证互动空间流水线，约 4.27 MiB，并通过 `h5-validator`；这个结果只能证明构建/压缩链工作，不能作为合规发布包。

## 8. 归档、分支和 stash

仓库外安全归档：

`/Users/a1234/Documents/targeting-2026-archive/2026-08-03/`

包含：

- `targeting-2026-full-final-v2.zip`：87,594,680 字节；SHA-256 `3388b9e216b6889979d7e0fd90ca62ded7ecb9dcbf38d6a77b65441ea39dbf89`。
- `targeting-2026-interactive-compressed.zip`：4,432,311 字节，约 4.23 MiB；SHA-256 `97971188ecc54d65eef8689cd7530acb5250ddd40fc87a4718d0c2342d320879`。
- `SHA256SUMS.txt`。

4.23 MiB 互动空间 ZIP 是历史可运行基准，不是版权替换后的新正式包。不要直接把它当作合规包上传。

本地保留：

- 归档分支 `archive/pre-variant-restructure-20260803`：重构前源码快照，只用于追溯。
- `stash@{0}: backup-before-coach-freeze-repair-20260730`：包含旧工作区内容和球员图片相关变化。**不要直接 `stash pop`**；如需找素材，先用 `git stash show --stat`、`git show stash@{0}:<path>` 单文件检查。

误生成的完整版 ZIP 已移动到废纸篓目录：

`/Users/a1234/.Trash/targeting-2026-obsolete-full-package-20260803/`

## 9. 仓库清理规则

旧的探针包、minimal UI、诊断矩阵、上传测试包、旧抖音构建脚本和无用新西兰人物资源已经清理。不要重新引入。

允许保留的新西兰内容仅限赛程仍需要的国旗、赛程数据、球队参数和完整版对手球衣；新西兰不是当前 16 支可选队之一。

统一生成物目录：

- `.variant-build/`
- `.variant-public/`
- `artifacts/`

禁止重新创建和提交：

- `dist*`
- `deliverables/`
- `release/`
- `reports/`
- 验证器解压目录
- 根目录散落 ZIP

## 10. 推荐工作顺序

下一位 Agent 应按以下顺序继续：

1. 读取本文、`README.md`、`config/variants.mjs` 和 `config/art-rights.json`。
2. 运行 `git status --short --branch`，确认没有意外覆盖用户改动。
3. 如果任务是普通 Bug，只在 `main` 公共逻辑修复，并运行相关测试；不要分别“同步三个版本”。
4. 如果任务是合规美术，只操作 `art-packs/compliant/` 和版权清单要求的稳定路径；不要改玩法。
5. 如果任务是互动空间兼容，先判断是否属于底层加载/缓存/包体，再做最小平台差异；不要把平台分支扩散到业务层。
6. 合规素材未齐时，只能验证 fail-closed，不能强行出正式包。
7. 素材齐全后依次运行：

```bash
npm run verify:compliant-pack
npm test -- --run
npm run lint
npm run build:showcase
npm run build:compliant
npm run build:interactive
```

8. 检查最终互动空间 ZIP 的大小、根目录、ASCII 路径、资源报告、原图哈希泄漏和 `h5-validator` 结果。
9. 最后做教练模式、球员模式、正式点球、退出重进、扑救后继续、缩放、音效和移动端教程真机验收。

## 11. 不可越过的红线

- 不要创建三套业务源码。
- 不要为三个版本建立长期开发分支。
- 不要让 Bug 修复只存在于某个派生包。
- 不要生成或上传完整版 ZIP；唯一包体是互动空间 ZIP。
- 不要删除图鉴或独立点球功能的公共源码，它们仍属于两个完整版；互动空间通过功能/资源边界排除。
- 不要把正式比赛点球大战和独立点球入口混为一谈。
- 不要使用展示版版权图作为合规回退。
- 不要通过删掉教练模式、球员模式、音效或缩放换取包体。
- 不要把“资源加载超时”简单归因于 ZIP 大小；此前根因包括平台协议、JSON 注入和 texture cache。
- 不要修改第三方物理核心来解决本可在适配层解决的问题。
- 不要直接恢复旧 ZIP、旧分支或整个 stash 覆盖当前 `main`。

---

给新对话的最短启动指令：

> 请先完整阅读 `docs/HANDOFF_2026-08-03_VARIANTS.md`，再检查当前 Git 状态。以 `main` 为唯一业务源码，遵守三版本功能边界；只有 `compliant-interactive` 可以生成 ZIP。合规素材仍是 pending 时不得绕过 fail-closed，也不要从旧包、旧分支或 stash 整体回滚。
