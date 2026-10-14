# 文档资源库 (assets/)

> **created**: 2026-10-07 ｜ **last-change**: 2026-10-14 ｜ **status**: active

## 1. 简介

本目录保存文档引用的架构图、流程图、原型、界面截图和可长期复用的演示素材。资源与说明文档一同维护，保证引用可达、含义明确。

项目运行时加载的资源按实际构建契约放置，不因文档治理迁移其加载路径。构建产物、临时调试截图、原始运行日志与单次测试报告存于 `local/` 等项目约定的产物位置。

## 2. 索引

| 类别 | 命名前缀示例 | 内容 | 推荐格式 |
|---|---|---|---|
| 架构与流程 | `arch-` / `flow-` | 模块关系、时序、数据流与拓扑 | SVG、PNG |
| 原型与界面 | `ui-` / `app-` | 交互设计、真实界面与操作示例 | PNG、WebP、JPG |
| 文档品牌素材 | `logo-` / `icon-` | 文档中使用的标识与图标 | SVG、PNG |
| 长期演示与证据 | `demo-` / `evidence-` | 经筛选的说明素材或可复核图像 | PNG、WebP、GIF |

分类用于命名与查找，不要求预建所有子目录或另设机器索引。

### 首页风格探索

2026-10-08 已确认的首页交互与外观规则以[布局设计](../devel/design/02-工作台布局与外观.md)及关联模块正文为准。下列 HTML 与截图保留为视觉参考；本轮只更新文档，未重新生成资源。正式默认材质和完整产品验收仍待确定，资源元数据的整体 needs-review 状态保留。

- [首页风格方案](homepage-study/homepage-style-proposal.html)：通过 answer-me-with-html 生成，包含已确认的默认布局、桌面式网站管理、可选组件与背景方案。
- [首页交互 demo](homepage-study/homepage-demo.html)：独立 HTML，时间点击收起、网站右键编辑、长按排序、可配置搜索引擎、自定义背景与按需添加组件，状态为 needs-review。
- [当前默认首页](homepage-study/homepage-demo-minimal.jpg)、[网站右键菜单](homepage-study/homepage-demo-context-menu.jpg)与[收起后的首页](homepage-study/homepage-demo-clock-only.jpg)。
- [时间设置预览](homepage-study/homepage-demo-appearance-clock.jpg)与[搜索框设置预览](homepage-study/homepage-demo-appearance-search.jpg)：无白边时钟、侧边面板、位置与材质调节。
- [纸感桌面预览](homepage-study/homepage-demo-paper.jpg)与[背景设置预览](homepage-study/homepage-demo-background.jpg)。
- [深色背景文字预览](homepage-study/homepage-demo-contrast-dark.jpg)与[深浅分区文字预览](homepage-study/homepage-demo-contrast-split.jpg)：测试图展示不同区域自动选择字色。
- `homepage-study/homepage-style-proposal.am` 为方案源稿；`homepage-demo.source.jsx`、`homepage-controls.source.jsx`、`homepage-model.js`、`homepage-demo.css` 与 `homepage-background-contrast.js` 为原型源稿；`_d_meta.json` 登记评审入口。前两组旧桌面与背景截图保留为历史视觉对照，当前布局以新截图和 demo 为准。

## 3. 资源规则

- 文件采用有语义的小写连字符命名，如 `arch-system-overview.svg`、`ui-login-error.png`，避免 `image.png` 或默认截图名。
- 架构图、图标优先矢量格式；位图合理压缩，单张原则上不超过 2MB。大型视频和设计工程源文件采用项目认可的外部存储链接，不直接堆入 Git。
- 截图和证据入库前核对内容、来源与适用范围，移除密钥、个人信息及无关敏感数据；Mock、原型或示意图在引用处注明，不能当作真实运行证据。
- Markdown 相对当前文档引用资源，并使用说明内容的替代文本；图文实质更新时同步校正引用说明。

以下仅演示引用语法，使用时替换为真实存在的资源：

```markdown
<!-- docs/README.md 中 -->
![系统模块关系](assets/arch-system-overview.svg)

<!-- docs/devel/design/01-模块设计.md 中 -->
![模块调用流程](../../assets/flow-module-call.svg)
```

## 4. 更新与清理

1. 新增资源时确认它服务于哪篇文档，使用语义化命名并在文档中建立引用；需要再现图稿时保留实际使用的源稿或来源链接。
2. 替换或移动资源前检查当前文档、指南和历史引用，更新允许修改的引用；历史归档仍引用的资源应保留可达，不通过改写归档消除断链。
3. 发版前检查无引用资源是否确实废弃。只有确认用途和已获授权的清理范围后才删除；临时素材和运行证据按其产物位置的保护规则处理。
