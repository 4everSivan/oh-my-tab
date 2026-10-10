# oh-my-tab

一个面向公众发布的 Google Chrome 扩展，提供可高度自定义的新标签页与浏览器启动页，将个人导航、效率工具、全网资讯与视觉氛围整合为一个轻盈沉浸的个人浏览器工作台。

> **当前状态**：v0.1.0 功能已全面实现并通过 **168 项自动化测试**，处于活跃迭代阶段。本机可在 Chrome 中加载 `local/dist/` 目录体验完整功能（见[开发指南](#开发指南)）。

---

## 功能特性（已实现）

### 1. 工作台与导航
* **新标签页覆写**：遵循 Chrome Manifest V3 规范，通过 `chrome_url_overrides.newtab` 原生接管新标签页。
* **时间与极简工作台**：无框优雅时钟与日期展示，点击时间可平滑折叠/展开工作台，进入只保留时间与搜索框的极简沉浸模式；时钟数字逐位弹入动效，支持配置全球主要 IANA 时区（中国、东京、伦敦、纽约等及本地系统）。
* **多引擎同质化搜索**：
  * 精选四大搜索引擎（必应 / 谷歌 / GitHub / Bilibili），全量官方品牌矢量图标化，搜索框左侧点击可弹出同质化磨砂玻璃下拉菜单；
  * 支持搜索联想建议（Bing / Google / Baidu / Bilibili），回车与选定联想词在当前页面即时跳转；彻底不记录本地搜索历史，保护隐私。
* **桌面式常用网站**：
  * **单排 6 槽位分页**：单行紧凑美观不换行，支持滚轮/触控板滑动翻页与键盘左右方向键（`←` / `→`）顺畅切页，翻页圆点指示器居中展示且色彩自适应壁纸；
  * **图标文件夹（Folder）**：支持收纳多个站点，2×2 微缩预览网格，横向平滑展开毛玻璃抽屉托盘，支持深浅壁纸自适应明暗着色；
  * **键盘快捷直达**：长按 `Command`（`⌘`）键时，当前页前 6 个图标下方平滑浮现键帽提示徽标（`⌘1` ~ `⌘6`），组合按 `⌘+1~6` 秒开网站；智能输入态避让防误触；
  * **配置导入与导出**：支持标准 JSON 备份下载与还原，兼容解析 iTab 数据备份文件（`.itabdata` / `navConfig`）。

### 2. 独立订阅中心 (Feed Hub)
* **原生零依赖多格式解析**：内置高效 XML/DOM 解析器，完美兼容 RSS 2.0、Atom 与 JSON Feed 格式，自动提纯清洗 HTML 并输出人性化相对时间。
* **极客自定义脚本引擎**：支持为任意第三方 REST/JSON API 编写自定义映射转换脚本 `(data, text, url, utils) => ParsedFeedItem[]`，沙箱容错捕获不致崩溃。
* **标准 OPML 2.0 互通**：支持主流 RSS 阅读器 OPML 文件一键批量导入与导出备份。
* **独立通知侧边栏**：
  * 顶栏右上角独立 🔔 胶囊按钮，配动态呼吸未读数量角标（`animate-pulse bg-rose-500`）；
  * 双视图无缝切换：消息流（Timeline，支持分类 Chips 过滤与一键已读）与订阅源管理（Sources，支持连通性测试、快捷禁用与删除）；
  * MV3 Background Service Worker 透明代理解决跨域请求阻断（CORS）。

### 3. 效率组件
* **今日待办**：支持新增任务、aria-checked 驱动的勾线描画动效、删除、清除已完成与实时进度条。
* **随手便签**：多行灵感便签，输入防抖自动保存。
* **专注计时**：15 / 25 / 45 分钟番茄钟预设，页面刷新/重开后跨会话状态平滑恢复，结束触发系统通知。
* **按需添加与状态保留**：组件注册中心严格单实例管理；从桌面移除组件仅为隐藏，再次添加时历史数据 100% 完整还原。

### 4. 外观与布局
* **四大右侧悬浮圆角卡片抽屉 (Floating Card Drawer)**：
  * **外观设置**（`AppearanceDrawer`）、**订阅中心**（`FeedSidebar`）、**添加组件**（`AddWidgetModal`）、**快捷键指南**（`ShortcutsHelpModal`）全量统一为右侧悬浮卡片式抽屉；
  * 具备四周均匀间隙（`p-3 sm:p-4`）、大圆角（`rounded-2xl sm:rounded-3xl`）、全周微透边框与 `shadow-2xl` 深度投影；
  * 抽屉标题统一带有独立的圆角图标容器与说明副标题；四大抽屉具备互斥开合逻辑与顶栏高亮圈反馈。
* **顶栏图标化与实时 Hover 提示 (`topbar-tooltip`)**：
  * 顶栏四个操作按钮（快捷键 `?`、添加组件 `a`、订阅消息 `b`、外观设置 `e`）统一为高透磨砂玻璃圆形胶囊；
  * 鼠标触碰/悬停时即刻平滑浮现毛玻璃名称提示与快捷键徽标（如 `添加组件 a`、`外观设置 e`）。
* **外观设置 Tab 分段控制**：Tab 导航重构为 Segmented Control 原生分段样式，采用精炼标题（时钟 / 搜索 / 壁纸 / 快捷键）与 `whitespace-nowrap` 防折行保护。
* **自适应取色与光晕保护引擎**：
  * 离线 Canvas 几何像素采样与 WCAG sRGB 对比度自适应引擎，根据壁纸深浅实时计算黑白墨色；
  * 在复杂材质与低对比度壁纸下自动叠加柔和抗反光动态光晕保护；
  * 搜索框前景色与光标颜色自适应背景表面透明度与壁纸样本协调渲染。
* **背景与壁纸系统**：
  * 精选材质 / 纯色 / 自定义图片三种类型；
  * 图片支持**点击、拖拽、⌘V 粘贴**三种等价上传通道，内置 MIME 白名单与解码验证拦截不可解码格式；
  * 壁纸独立存储于 IndexedDB，不挤占 Chrome Sync 同步配额；启动时缺失自动回退材质并自愈。

### 5. 全局键盘快捷键
| 快捷键 | 功能说明 |
| --- | --- |
| `` ` `` | 快速对焦主页搜索框并全选已有文本 |
| `Tab` / `Shift + Tab` | 顺次 / 逆向沉浸式循环切换四大搜索引擎 |
| `⌘ + 1~6` | 快速直达当前页对应的常用网站（按住 `⌘` 显示键位提示） |
| `←` / `→` | 切换上一页 / 下一页常用网站图标 |
| `b` | 打开 / 关闭独立订阅消息侧边栏 |
| `e` / `s` | 打开 / 关闭工作台外观与壁纸设置抽屉 |
| `a` | 打开 / 关闭添加效率组件抽屉 |
| `c` | 切换极简模式 / 展开工作台 |
| `?` | 打开 / 关闭全局快捷键操作指南 |
| `Esc` | 级联退出：顺次关闭当前顶层抽屉、弹层或搜索框焦点 |

### 6. 性能与动效
* **启动与刷新零闪烁**：落地同步 `bootCache` 快照与 React 惰性初始化，彻底消除首帧默认圆角与纯色闪跳；重构 `loadAllSettings` 为 `Promise.all` 并行加载；单画布采样管线释放 GPU 显存，闭环 Blob URL 自动销毁回收。
* **纯 CSS 动效系统**：动效令牌单一来源（`src/styles/motion.css`）+ `t-*` 片段命名空间；内置 `prefers-reduced-motion` 全局降级守卫，零外部 JS 动效运行时依赖。

---

## 开发指南

### 环境要求
* Node.js ≥ 18
* npm / pnpm

### 常用命令
| 命令 | 说明 |
| --- | --- |
| `npm install` | 安装项目依赖 |
| `npm run dev` | 启动 Vite 开发服务器（浏览器环境预览，chrome.* API 自动优雅降级） |
| `npm test` | 运行全量自动化测试（当前 168 项用例） |
| `npm run build` | TypeScript 类型检查 + 生产打包构建 |

### 构建与加载扩展
所有构建产物**强制输出至项目根目录的 `local/dist/`**（构建产物全量收拢隔离规范，严禁向源码树扩散）：

```bash
npm run build
```

在 Chrome 浏览器中加载体验：
1. 打开浏览器地址栏访问 `chrome://extensions`；
2. 开启右上角**开发者模式**；
3. 点击左上角**加载已解压的扩展程序**；
4. 选择本项目根目录下的 `local/dist/` 文件夹；
5. 打开新标签页（`⌘ + T`）即可体验完整工作台。修改代码后重新运行构建，并在扩展程序卡片上点击刷新即可热更新生效。

> 本地部署实况记录于 `local/deploy_report.md`。

### 自动化测试套件
```bash
npm test
```

测试套件位于 `tests/*.test.cjs`，基于 Node 原生 `node:test` 测试运行器，独立幂等、零网络依赖：

| 测试套件 | 覆盖核心逻辑 |
| --- | --- |
| `drawer-card-style.test.cjs` | 四大悬浮圆角卡片抽屉样式、Tab 防折行、顶栏纯图标化与 Hover 浮动提示 |
| `feed-engine.test.cjs` | RSS 2.0 / Atom / JSON Feed 解析、JS 极客脚本执行器、OPML 导入导出、后台跨域代理 |
| `shortcuts-page-keys.test.cjs` | 常用网站单排 6 图标局部 ⌘1~6 按键直达、长按 ⌘ 键位提示徽标、当前页秒开 |
| `shortcuts-folder.test.cjs` | 图标文件夹模型契约、iTab 数据解析还原、横向展开抽屉托盘与深浅自适应着色 |
| `shortcuts-pagination.test.cjs` | 常用网站单排 6 槽位分页切片、左右按键与滚轮切页、圆点指示器自适应取色 |
| `search-features.test.cjs` | 搜索引擎图标化、多源联想抓取服务、零本地搜索历史隐私保护、当前页跳转 |
| `startup-performance.test.cjs` | 同步 bootCache 快照、React 惰性初始化、Promise.all 并行存储读取、显存释放与 Blob URL 回收 |
| `adaptive-contrast.test.cjs` | Canvas 几何像素采样算法、WCAG sRGB 黑白对比度自适应、动态文字抗反光光晕保护 |
| `storage.test.cjs` | 存储分层隔离、深浅合并、独立分组恢复默认防污染、壁纸仓储生命周期 |
| `widget-contract.test.cjs` | 组件清单注册中心、宿主命名空间隔离、未知类型安全降级、7 类统一组件状态契约 |
| `navigation-shell.test.cjs` | 时间极简折叠切换、网站编辑与拖动排序、图标兜底首字母结构 |
| `layout-appearance.test.cjs` | 12 列栅格跨度计算、外观持久化、单实例策略、背景绘制契约 |
| `core-widgets.test.cjs` | 今日待办、随手便签、专注计时三大内置组件跨会话数据恢复与隔离 |
| `motion-system.test.cjs` | 纯 CSS 动效令牌、t-* 动效片段、交错延迟封顶公式、prefers-reduced-motion 降级守卫 |
| `wallpaper-restore.test.cjs` | 自定义壁纸恢复决策表、IndexedDB 缺失自愈重建、拖拽与粘贴通道、HEIC 格式拦截 |

---

## 项目结构

```
├── src/
│   ├── components/          # 页面核心视觉组件
│   │   ├── card/            # 卡片基础容器与包装器
│   │   ├── feed/            # 订阅消息流与源管理抽屉 (FeedSidebar)
│   │   ├── layout/          # 12 列响应式栅格容器 (GridContainer)
│   │   ├── settings/        # 外观设置抽屉 (AppearanceDrawer)
│   │   ├── shortcuts/       # 常用网站、文件夹抽屉与快捷键指南 (Shortcuts / ShortcutsHelpModal)
│   │   ├── widgets/         # 添加组件抽屉与组件包装 (AddWidgetModal)
│   │   ├── Clock.tsx        # 时钟与日期展示组件
│   │   └── SearchBar.tsx    # 搜索框与搜索引擎选择组件
│   ├── widgets/             # 内置效率组件（todo / notes / focus-timer）
│   ├── contract/            # 组件契约模型、清单注册中心与宿主上下文
│   ├── services/            # 数据与领域业务服务
│   │   ├── feed/            # RSS/Atom 解析、自定义脚本执行器、OPML 导入导出
│   │   ├── search/          # 搜索建议与多引擎联想服务 (suggestionService)
│   │   └── storage/         # 本地存储适配器、IndexedDB 壁纸仓储、常用网站导入导出
│   ├── background/          # MV3 后台 Service Worker（跨域联想与跨域订阅抓取管道）
│   ├── styles/motion.css    # 纯 CSS 动效令牌与 t-* 动效片段（单一来源）
│   ├── hooks/               # useDelayedUnmount / useAdaptiveContrast / useKeyboardShortcuts 等支撑钩子
│   └── utils/               # 纯函数算法（对比度选色 / 壁纸恢复决策 / 交错延迟计算 / 缩放适配）
├── tests/                   # 自动化测试套件（168 项用例，node:test 驱动）
├── docs/                    # 完整研发中心（设计基线、架构设计、开发变更卡、部署实况）
│   ├── devel/design/        # 现行设计基线（00-总体设计 ~ 07-动效系统）
│   ├── devel/change/        # 变更卡总账（C001 ~ C023）
│   └── guide/               # 本地部署与环境指南
├── public/manifest.json     # Chrome Extension Manifest V3 配置文件
└── local/                   # 本地运行实况与打包产物（git 隔离保护，仅人工清理）
    ├── dist/                # 编译打包输出目录（加载此目录）
    └── deploy_report.md     # 本地部署实况报告
```

---

## 研发文档与设计基线

文档导航与机器索引位于 [docs/README.md](docs/README.md)。本项目遵循 **ad-flow** 研发治理流程（[AGENTS.md](AGENTS.md)）：文档先行 → 建卡登记 → 拓扑编码 → 自动化补测 → 人工核验代签 → 基线回写。

| 文档 | 对应基线模块 |
| --- | --- |
| [00-系统总体设计](docs/devel/design/00-系统总体设计.md) | 产品架构、模块职责、证据状态与技术选型 |
| [01-页面入口与导航](docs/devel/design/01-页面入口与导航.md) | 搜索栏、常用网站、图标文件夹、快捷键系统与按键徽标 |
| [02-工作台布局与外观](docs/devel/design/02-工作台布局与外观.md) | 12 列栅格、四大悬浮卡片抽屉、外观配置、自适应采样取色与背景系统 |
| [03-效率组件](docs/devel/design/03-效率组件.md) | 待办、便签、专注计时器规格与数据隔离语义 |
| [04-数据保存与同步](docs/devel/design/04-数据保存与同步.md) | 本地优先分层存储、IndexedDB 仓储、OPML 与配置备份导入导出 |
| [05-深度扩展与外部数据](docs/devel/design/05-深度扩展与外部数据.md) | RSS/Atom 解析管道、极客自定义脚本引擎与后台跨域代理 |
| [06-组件契约与注册](docs/devel/design/06-组件契约与注册.md) | 统一组件生命周期、清单契约与宿主服务通信 |
| [07-动效系统](docs/devel/design/07-动效系统.md) | 动效令牌字典、t-* 动效片段与降级守卫规范 |
| [01-本地部署指南](docs/guide/01-本地部署指南.md) | Chrome 扩展构建打包、解压加载与调试排错手册 |

---

## 路线图规划

- [x] **v0.1.0 基础工作台**：时钟、搜索、常用网站、待办、便签、专注计时、外观设置、纯 CSS 动效系统、背景壁纸系统。
- [x] **v0.1.0+ 进阶体验**：图标文件夹、单排 6 槽位分页、⌘+数字键秒开、多源搜索建议、独立订阅中心（RSS/Atom/自定义脚本/OPML）、四大悬浮圆角卡片抽屉与顶栏 Hover 微胶囊。
- [ ] **后续演进**：
  - 撕页日历 / 天气效率小组件；
  - 自定义 CSS 作用域安全注入；
  - Chrome 云端同步配额与跨设备配置漫游；
  - 正式发布至 Chrome Web Store。
