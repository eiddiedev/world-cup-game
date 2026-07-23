# Pixel Kit Studio（16 队球衣工作流）

独立入口：`/pixel-player-studio.html`

当前 Studio 只负责生产 `happyseed-human-v4` 的球队公共球衣，不再尝试逐个重画或拆分完整球员。球员头部继续来自原立绘；手臂和腿部的裸露皮肤由球员肤色系统处理；同队普通球员共享主场球衣，门将共享门将球衣。

固定范围为 16 支球队，每队两套，共 32 套：

- 西班牙、阿根廷、法国、英格兰、巴西、葡萄牙、德国、日本
- 摩洛哥、挪威、哥伦比亚、美国、加拿大、墨西哥、佛得角、库拉索

新西兰不进入本工作流。阿根廷、法国、巴西、葡萄牙、德国、日本、摩洛哥、挪威和库拉索沿用原球队目录立绘；西班牙、英格兰、哥伦比亚、美国、加拿大、墨西哥和佛得角来自下载目录的大名单排版图。排版图第一列和第二列是门将候选，第三列是普通球员。

## 使用方式

```bash
npm run dev
```

打开 Vite 输出地址下的 `/pixel-player-studio.html`。主要编辑环境为桌面 Chrome，建议宽度不低于 1280px。

1. 左侧选择球队和“普通球员 / 门将”。
2. 需要替换来源时，导入一张六列大名单排版图，再选择“门将 1”“门将 2”或“普通 3”。
3. 中间查看原始参考、固定插槽拆分和真实 Runtime 正背面静态预览。
4. 右侧逐插槽修图。支持 1/2/3 像素画笔、橡皮、填充、吸色、直线、矩形、镜像、网格、撤销、重做和恢复当前插槽。
5. 顶栏输入导出名称和号码，然后导出当前插槽 PNG、无图片依赖的像素数据，或整套 Runtime PNG ZIP。

历史至少保存 100 步。编辑器禁止改变插槽画布尺寸、自动裁边、平滑缩放和半透明像素。

## 金标范式

编译器直接裁切来源球员图。`docs/art-reference/happyseed-human-v3-production-paper-doll-master.png` 只提供插槽画布尺寸、脚点锚点、可见区上限和分件位置，不提供要套用的球衣轮廓，更不能把来源图重新上色成通用模板：

- 所有缩放均为最近邻；颜色最多 16 色。
- 球衣领口、队徽、条纹、袖口、短裤和球袜的可见像素必须来自原图裁片。
- Runtime 不加白色贴纸边，透明边缘必须为深色轮廓或球衣本色。
- 每个插槽保持既有固定尺寸和锚点留白。
- 背面继承正面配色和结构，移除胸前图案；号码仍由 Runtime 的独立号码插槽叠加。
- 门将额外包含左右手套插槽。

32 套资源每次生成都要通过尺寸、透明度、边界颜色、SHA-256 和文件完整性审计。总览图为 `public/pixel/kit-studio/gold-contact-sheet.png`，机器审计为 `public/pixel/kit-studio/asset-audit.json`。

## 数据与导出

“导出像素数据”生成命名后的 `.hskit.json`。它保存调色板索引和行优先 RLE，不保存整张底图；导入后可以无损恢复所有插槽继续编辑。

“导出整套 PNG”生成命名后的 ZIP，目录与当前 Runtime 一致：

```text
{teamId}/{kitType}/happyseed-human-v4/
  shirt_front.png
  shirt_back.png
  sleeve_left.png
  sleeve_right.png
  shorts.png
  shorts_leg.png
  socks.png
  shoes.png
  hand_left.png       # 仅门将
  hand_right.png      # 仅门将
  manifest.json
```

生产目录是 `public/pixel/kits/`，索引是 `public/pixel/kit-studio/catalog.json`。重新从来源批量构建使用：

```bash
npm run assets:16-team-kits
python3 scripts/render_16_team_kit_contact_sheet.py
```

## 阶段边界

本阶段不替换正式游戏名单、不删除旧球员立绘、不修改 Spine 骨架或比赛引擎。Studio 的正背面预览只截取现有比赛 Runtime 中的角色，不显示或另写一套假比赛界面；射门、奔跑等动作仍由现有 Spine 状态机负责。
