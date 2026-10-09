# oh-my-tab

一个面向公众发布的 Google Chrome 扩展，提供可自定义的新标签页与浏览器启动页，将个人导航、效率工具和视觉氛围整合为一个个人浏览器工作台。

> **当前状态**：v0.1.0 功能已实现并通过 90 项自动化测试，处于开发迭代阶段，**尚未发布**到 Chrome Web Store。本机可在 Chrome 中加载 `local/dist/` 目录体验完整功能（见[开发指南](#开发指南)）。

## 功能特性（已实现）

### 工作台与导航

- **新标签页覆写**：Manifest V3 通过 `chrome_url_overrides.newtab` 接管新标签页。
- **时间与极简模式**：无框时间日期展示，点击进入只保留时间与搜索的极简模式，再次点击恢复；时间数字逐位弹入动效，仅数值变化的位重放。
- **网页搜索**：默认 Google，可切换 Bing / 百度 / DuckDuckGo，新标签页打开结果。
- **桌面式常用网站**：连续圆角图标自动抓取 favicon（带 `no-referrer` 热链优化），**图标缺失时才回退显示名称首字符**；右键菜单（打开 / 编辑 / 移除），长按 450ms 拖动排序，误删可撤销。

### 效率组件

- **今日待办**：新增、勾选（背景填充 + 勾线描画动效）、删除、清除已完成、进度条。
- **随手便签**：多行文本、防抖自动保存。
- **专注计时**：15/25/45 分钟预设、跨刷新状态恢复（截止时间戳重算）、结束系统通知。
- **按需添加**：添加面板单实例置灰政策；移除卡片仅隐藏展示、保留内容，再次添加完整还原。

### 外观与布局

- **12 列流式栅格**：组件按跨度流式排布，窄窗口自动降档折行；卡片交错入场动效。
- **外观设置抽屉**：时间（字体/字号/字重/位置/日期/秒数）与搜索框（位置/间距/宽度/透明度/模糊）独立调节、即时生效、独立恢复默认。
- **背景系统**：精选材质 / 纯色 / 自定义图片三种类型；图片支持**点击、拖拽、⌘V 粘贴**三种上传通道，MIME 白名单 + 解码验证拦截不可解码格式（如 HEIC），可调遮罩浓度、模糊与画面位置；壁纸经 IndexedDB 持久化，刷新后自动恢复。
- **动效系统**：纯 CSS 令牌梯度（`src/styles/motion.css` 单一来源）+ `t-*` 片段命名空间，系统开启「减少动态效果」时全局自动降级。

### 数据与存储

- **本地优先**：`chrome.storage.local` 承载配置与组件内容（命名空间 `widgets/<instanceId>/content` 隔离），`chrome.storage.sync` 预留轻量配置同步；壁纸等大文件独占 IndexedDB（`oh-my-tab-db`），不挤占同步配额。
- **防御性恢复**：分组独立恢复默认互不误伤；壁纸记录缺失时自动回退材质并回写配置；IndexedDB 空库自愈重建。

## 开发指南

### 环境要求

- Node.js ≥ 18；npm

### 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm install` | 安装依赖 |
| `npm run dev` | Vite 开发服务器（浏览器功能预览；chrome.* API 自动降级 localStorage） |
| `npm test` | 运行全部自动化测试（node:test，当前 90 项） |
| `npm run build` | 类型检查 + 生产构建 |

### 构建与加载扩展

构建产物**强制隔离输出至 `local/dist/`**（项目构建隔离红线，根目录零散落）：

```bash
npm run build
```

在 Chrome 中加载：打开 `chrome://extensions` → 开启右上角**开发者模式** → **加载已解压的扩展程序** → 选择 `local/dist/` 目录 → 打开新标签页。修改代码后重新构建并点击扩展卡片上的刷新图标。

> 部署实况（真实 Chrome 版本、构建路径、验证记录）见 `local/deploy_report.md`；后续重启与联调以该报告为准。

### 测试

```bash
npm test
```

测试套件（`tests/*.test.cjs`，node:test 运行器，独立幂等、不依赖外网）：

| 套件 | 覆盖域 |
| --- | --- |
| `storage.test.cjs` | 存储分层隔离、深浅合并、独立恢复防污染、壁纸仓储 |
| `widget-contract.test.cjs` | 组件清单注册、宿主上下文命名空间、未知类型容错、7 类统一状态 |
| `navigation-shell.test.cjs` | 时间收起、搜索引擎参数、网站编辑/长按排序/撤销、图标兜底结构 |
| `layout-appearance.test.cjs` | 12 列栅格计算、外观持久化、单实例政策、背景绘制契约 |
| `core-widgets.test.cjs` | 三款组件跨刷新恢复、移除保留内容物理隔离 |
| `motion-system.test.cjs` | 动效令牌/片段/降级守卫、组件接线、交错封顶 |
| `wallpaper-restore.test.cjs` | 壁纸恢复决策、上传反馈、空库自愈、拖拽/粘贴通道 |

## 项目结构

```
├── src/
│   ├── components/          # 页面组件（clock / search / shortcuts / layout / settings / widgets / card）
│   ├── widgets/             # 内置效率组件（todo / notes / focus-timer）
│   ├── contract/            # 组件契约类型、注册中心、宿主服务
│   ├── services/storage/    # 存储适配层（chromeStorage / wallpaper / 领域服务）
│   ├── styles/motion.css    # 动效令牌与 t-* 片段（单一来源）
│   ├── hooks/               # useDelayedUnmount 等支撑 Hook
│   └── utils/               # 纯函数（对比度选色 / 背景恢复 / 交错延迟）
├── tests/                   # 自动化测试（node:test）
├── docs/                    # 文档中心（设计基线、研发治理、部署指南）
├── public/manifest.json     # MV3 清单
└── local/                   # 构建产物与运行实况（git 隔离，仅人工清理）
    ├── dist/                # 扩展构建产物（加载此目录）
    └── deploy_report.md     # 部署实况报告
```

## 研发文档与治理

文档中心与机器索引见 [docs/README.md](docs/README.md)。研发遵循 ad-flow 治理流程（[AGENTS.md](AGENTS.md)）：设计先行 → 建卡 → 实现 → 补测 → 人工验收。

| 文档 | 内容 |
| --- | --- |
| [系统总体设计](docs/devel/design/00-系统总体设计.md) | 产品边界、模块职责与证据状态 |
| [页面入口与导航](docs/devel/design/01-页面入口与导航.md) | 搜索、网站管理与图标回退规则 |
| [工作台布局与外观](docs/devel/design/02-工作台布局与外观.md) | 布局、外观参数、背景与绘制契约 |
| [效率组件](docs/devel/design/03-效率组件.md) | 组件范围与添加/移除语义 |
| [数据保存与同步](docs/devel/design/04-数据保存与同步.md) | 存储分层、壁纸生命周期 |
| [组件契约与注册](docs/devel/design/06-组件契约与注册.md) | 组件契约、实例模型与宿主服务 |
| [动效系统](docs/devel/design/07-动效系统.md) | 动效令牌、片段与降级守卫 |
| [本地部署指南](docs/guide/01-本地部署指南.md) | 构建、加载与部署实况规范 |

## 项目目标与路线

- **统一入口**：新标签页与启动页共用同一套页面与配置（启动页经 Chrome「设置 → 启动时 → 打开新标签页」接入）。
- **个人导航 / 效率工作台 / 视觉氛围**：已由首版功能承载，见上文特性清单。
- **后续规划**（未实现）：撕页日历组件、自定义 CSS、外部数据源接入与扩展组件接口、Chrome 同步范围落地、配置导入导出、Chrome Web Store 发布。

## 参考文档

- [替换 Chrome 页面](https://developer.chrome.com/docs/extensions/develop/ui/override-chrome-pages)
- [设置 Chrome 主页和启动页](https://support.google.com/chrome/answer/95314?hl=zh-Hans)
- [Chrome 扩展存储 API](https://developer.chrome.com/docs/extensions/reference/api/storage)
- [Manifest V3 的额外要求](https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements)
- [Chrome Web Store 搜索与新标签页政策说明](https://developer.chrome.com/docs/webstore/program-policies/quality-guidelines-faq)
