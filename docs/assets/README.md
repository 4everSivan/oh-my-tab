# 文档与工程资源库 (assets/)

> **created**: 2026-10-07 ｜ **last-change**: 2026-10-08 ｜ **status**: active

---

## 1. 简介

`docs/assets/` 是工程全景中所有文档引用资源、系统架构设计图、原型设计稿以及 App 演示截图的**统一专用存储目录**。本目录杜绝了资源散落在根目录、源码目录或各级文档子目录中的碎片化污染，确保工程资产高内聚、易维护。

---

## 2. 索引

### 首页风格探索

2026-10-08 已确认的首页交互与外观规则以[布局设计](../devel/design/02-工作台布局与外观.md)及关联模块正文为准。下列 HTML 与截图保留为视觉参考；本轮只更新文档，未重新生成资源。正式默认材质和完整产品验收仍待确定，资源元数据的整体 needs-review 状态保留。

- [首页风格方案](homepage-study/homepage-style-proposal.html)：通过 answer-me-with-html 生成，包含已确认的默认布局、桌面式网站管理、可选组件与背景方案。
- [首页交互 demo](homepage-study/homepage-demo.html)：独立 HTML，时间点击收起、网站右键编辑、长按排序、可配置搜索引擎、自定义背景与按需添加组件，状态为 needs-review。
- [当前默认首页](homepage-study/homepage-demo-minimal.jpg)、[网站右键菜单](homepage-study/homepage-demo-context-menu.jpg)与[收起后的首页](homepage-study/homepage-demo-clock-only.jpg)。
- [时间设置预览](homepage-study/homepage-demo-appearance-clock.jpg)与[搜索框设置预览](homepage-study/homepage-demo-appearance-search.jpg)：无白边时钟、侧边面板、位置与材质调节。
- [纸感桌面预览](homepage-study/homepage-demo-paper.jpg)与[背景设置预览](homepage-study/homepage-demo-background.jpg)。
- [深色背景文字预览](homepage-study/homepage-demo-contrast-dark.jpg)与[深浅分区文字预览](homepage-study/homepage-demo-contrast-split.jpg)：测试图展示不同区域自动选择字色。
- `homepage-study/homepage-style-proposal.am` 为方案源稿；`homepage-demo.source.jsx`、`homepage-controls.source.jsx`、`homepage-model.js`、`homepage-demo.css` 与 `homepage-background-contrast.js` 为原型源稿；`_d_meta.json` 登记评审入口。前两组旧桌面与背景截图保留为历史视觉对照，当前布局以新截图和 demo 为准。

### 2.1 资源分类与规划

| 资源类别 | 推荐子目录 / 前缀 | 说明 | 常见文件格式 |
|---|---|---|---|
| **架构与流程图** | `arch-` / `flow-` | 模块依赖图、时序图、数据流图、网络拓扑图 | `.svg`, `.png` |
| **App 与 UI 截图** | `ui-` / `app-` | 前端界面截屏、客户端运行效果图、原型设计稿 | `.png`, `.webp`, `.jpg` |
| **品牌与图标** | `logo-` / `icon-` | 项目 Logo、系统徽标、模块专用图标 | `.svg`, `.png` |
| **测试与演示素材** | `demo-` / `evidence-` | 关键核验录屏动图、演示快照、基准测试对比图 | `.gif`, `.png`, `.webp` |

---

## 3. 规范

为保证资源库清晰整洁且不导致 Git 仓库恶性膨胀，所有存放于本目录的资产必须遵守以下规约：

### 3.1 命名规范
1. **语义化小写连字符**：文件名统一采用小写字母并以连字符（`-`）分隔，如 `arch-overview.svg`、`ui-dashboard-dark.png`；
2. **模块与场景前缀**：建议包含所属功能模块或文档类型前缀（如 `matching-flow.png`、`market-kline-sample.png`）；
3. **禁止无意义默认命名**：严禁出现 `image.png`、`截屏2026-09-23.png`、`未命名.jpg` 等混乱命名。

### 3.2 格式与体积红线
1. **矢量图优先**：架构图、时序图、图标等优先采用矢量格式（`.svg`），保证清晰度并节省存储；
2. **轻量化压缩**：位图格式（`.png`、`.webp`、`.jpg`）在入库前必须进行无损或高保真压缩，**单张图片体积原则上不得超过 2MB**；
3. **严禁大型二进制散落**：严禁将原始视频文件（如 `.mp4`）或超大 PSD/Sketch 设计工程源文件直接提交至本目录（设计源文件应走云端设计协作工具链接管理）。

### 3.3 文档引用格式契约
在各级 Markdown 文档中引用资源时，统一采用相对路径或根路径引用：

```markdown
<!-- 推荐相对路径引用方式 -->
![系统架构概览](assets/arch-overview.svg)
<!-- 在子目录文档（如 docs/devel/design/）中引用 -->
![撮合流程图](../../assets/matching-flow.png)
```

---

## 4. 资源生命周期与清理

1. **废弃资源清理**：当设计基线或文档内容重构导致某些图片不再被任何 Markdown 文件引用时，应在发版封箱前及时清理孤立废弃资产，防止仓库无意义膨胀；
2. **禁止提交临时截图**：开发调试过程中的临时报错截图、单次会话临时证据严禁提交入库，只允许通过终端日志文本形式沉淀。
