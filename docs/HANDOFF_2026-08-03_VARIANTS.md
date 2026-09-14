# 版本收敛与抖音小游戏迁移边界

更新日期：2026-09-14。此文记录此前清理过程；当前两版本方向、`main` 接续和互动空间未来打包要求以 [换设备开发交接](HANDOFF_2026-09-14_DEVICE.md) 为准。

## 当前构建目标与产品方向

- 当前唯一可构建目标：`compliant-full`，它是抖音小游戏版的合规 H5 基线，不是原生提审包。
- 产品交付方向保留抖音小游戏版（主版本）和互动空间版（冻结待统一裁剪打包）两个，不维护各自长期分支。
- 默认开发、构建、预览和 Vercel 部署全部指向该目标。
- 旧 `showcase-full` 不再作为产品版本；旧 `compliant-interactive` 构建命令已移除，当前不更新、不发布，待主版本完成后重建打包流水线。
- `art-packs/showcase/` 仅作为版权替换素材的只读审计基线，不能作为游戏资源或对外演示版本使用。

## 当前真实状态

`compliant-full` 仍是 React/Vite 的合规 H5 完整版。它是后续迁移的业务与视觉基线，但目前不能被描述为已经完成抖音小游戏适配，也不能直接当作平台上传包。

当前验证命令：

```bash
npm test -- --run
npm run lint
npm run verify:compliant-pack
npm run build
git diff --check
```

## 抖音小游戏迁移原则

1. 保持现有赛事、经营、决策、存档和比赛 Runtime 的业务语义不变，平台差异收敛在适配层。
2. 单独接入小游戏生命周期、登录/授权、存储、触控、音频、网络与错误上报。
3. 根据平台当期的主包、分包、资源下载和代码规范重新设计构建产物，不复用旧互动空间 IIFE/ZIP 流水线冒充小游戏包。
4. 先完成核心闭环真机验证，再逐步接入平台能力与发布材料。
5. 本地 H5 构建通过、浏览器运行正常和抖音小游戏开发者工具/真机通过是三种不同的验收状态，交付时必须分别记录。

## 已清理的旧流水线

以下旧互动空间文件已停止使用并从仓库移除：

- `scripts/build-interactive.mjs`
- `scripts/compress-interactive-assets.py`
- `scripts/validate-interactive.mjs`
- `scripts/release-all.mjs`

如需追溯旧实现，应从 Git 历史查看，不应重新接回默认构建。
