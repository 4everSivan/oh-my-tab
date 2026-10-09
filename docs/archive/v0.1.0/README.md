# oh-my-tab v0.1.0 归档总览

> **archived**: 2026-10-09 ｜ **milestone**: M1-v0.1.0-首发里程碑 ｜ **status**: frozen

---

## 1. 归档简介

本目录为 `oh-my-tab` 首发正式版本 `v0.1.0` 的历史封箱归档镜像，永久只读冻结。

- **发版标签**：`v0.1.0`
- **里程碑**：`M1-v0.1.0-首发里程碑`
- **归档时间**：2026-10-09
- **构建分发包**：`local/oh-my-tab-v0.1.0.zip` (86 KB, SHA-256: `8ff19611814dde8a382f0d9e39d327c63ae531d4379db9d7a77f9a063894120b`)
- **测试证据**：142 项自动化测试全绿通过 (`tests/*.test.cjs`)

---

## 2. 归档索引

- **阶段任务总账快照**：[task/index.json](task/index.json)（收录 T01 ~ T15 共 15 项任务卡）
- **变更核验总账快照**：[change/index.json](change/index.json)（收录 C001 ~ C020 共 20 张变更卡）
- **现行设计基线追溯**：[docs/devel/design/README.md](../../devel/design/README.md)
- **根变更日志**：[CHANGELOG.md](../../../CHANGELOG.md)

---

## 3. 归档任务清单 (T01 ~ T15)

| 任务号 | 任务标题 | 分支 | 状态 | 卡片文件 |
|---|---|---|---|---|
| **T01** | 工程脚手架初始化与构建隔离配置 | feat/T01-project-scaffolding | completed | [task/T01.json](task/T01.json) |
| **T02** | 原生存储适配层与持久化服务实现 | feat/T02-storage-adapter | completed | [task/T02.json](task/T02.json) |
| **T03** | 组件契约系统与通用卡片外壳实现 | feat/T03-widget-contract | completed | [task/T03.json](task/T03.json) |
| **T04** | 页面壳、导航与桌面式快捷方式实现 | feat/T04-navigation-shell | completed | [task/T04.json](task/T04.json) |
| **T05** | 12列流式栅格与外观设置面板实现 | feat/T05-layout-appearance | completed | [task/T05.json](task/T05.json) |
| **T06** | 核心组件交付（待办、便签、专注） | feat/T06-core-widgets | completed | [task/T06.json](task/T06.json) |
| **T07** | Chrome 扩展集成与端到端实况报告 | feat/T07-extension-integration | completed | [task/T07.json](task/T07.json) |
| **T08** | 动效系统纯 CSS 令牌与片段接入 | feat/T08-motion-system | completed | [task/T08.json](task/T08.json) |
| **T09** | 时钟自适应取色引擎与全站动效增强 | feat/T09-motion-contrast-upgrade | completed | [task/T09.json](task/T09.json) |
| **T10** | 时钟手动时区设置与搜索框圆角平滑调节 | feat/T10-timezone-and-search-radius | completed | [task/T10.json](task/T10.json) |
| **T11** | 搜索引擎图标化、精简与毛玻璃同质化下拉浮层 | feat/T11-search-engine-icons-and-unified-menu | completed | [task/T11.json](task/T11.json) |
| **T12** | 全局快捷键模块实现 | feat/T12-keyboard-shortcuts | completed | [task/T12.json](task/T12.json) |
| **T13** | 搜索框光标字体同色、对焦占位隐去与搜索联想系统 | feat/T13-search-suggestions-and-input-style | completed | [task/T13.json](task/T13.json) |
| **T14** | 常用网站导入导出与单排6图标滑动/按键翻页系统 | feat/T14-shortcuts-import-export-and-pagination | completed | [task/T14.json](task/T14.json) |
| **T15** | 常用网站图标文件夹（Folder）系统与横向展开抽屉托盘 | feat/T15-shortcut-folders | completed | [task/T15.json](task/T15.json) |

---

## 4. 归档变更清单 (C001 ~ C020)

| 变更号 | 变更标题 | 模块 | 状态 | 卡片文件 |
|---|---|---|---|---|
| **C001** | 自定义壁纸上传不生效：死链、上传反馈与空库修复 | DataPersistenceSync | closed | [change/C001.json](change/C001.json) |
| **C002** | 壁纸拖拽直传与粘贴上传通道 | WorkspaceAppearance | closed | [change/C002.json](change/C002.json) |
| **C003** | 材质预设切换写回类型 | WorkspaceAppearance | closed | [change/C003.json](change/C003.json) |
| **C004** | body 设为透明露出背景层 | WorkspaceAppearance | closed | [change/C004.json](change/C004.json) |
| **C005** | 网站图标首字母降级为独占兜底 | EntryNavigation | closed | [change/C005.json](change/C005.json) |
| **C006** | 常用网站弹窗与菜单经 createPortal 挂载 body | EntryNavigation | closed | [change/C006.json](change/C006.json) |
| **C007** | 极简折叠模式保持时间与搜索框零位移 | MotionSystem | closed | [change/C007.json](change/C007.json) |
| **C008** | 工作台折叠容器解耦 filter:blur 并修复添加按钮动效 | MotionSystem | closed | [change/C008.json](change/C008.json) |
| **C009** | SearchBar 建立 relative z-20 层叠上下文防遮挡 | EntryNavigation | closed | [change/C009.json](change/C009.json) |
| **C010** | 外观抽屉壁纸设置面板移除位置切换并默认居中 | WorkspaceAppearance | closed | [change/C010.json](change/C010.json) |
| **C011** | 搜索引擎下拉菜单支持点击页面任意位置与 Escape 关闭 | EntryNavigation | closed | [change/C011.json](change/C011.json) |
| **C012** | 移除本地搜索历史并修复 Chrome 跨域联想 | EntryNavigation | closed | [change/C012.json](change/C012.json) |
| **C013** | 修复 Tab 键切擎事件冒泡双重触发与异步状态滞后 | EntryNavigation | closed | [change/C013.json](change/C013.json) |
| **C014** | 搜索框文字与光标结合表面透明度自适应对比度取色 | EntryNavigation | closed | [change/C014.json](change/C014.json) |
| **C015** | 首页启动零闪烁、统合采样与 GPU 显存回收 | WorkspaceAppearance | closed | [change/C015.json](change/C015.json) |
| **C016** | 搜索词回车与选定联想词调整为当前页面直接跳转 | EntryNavigation | closed | [change/C016.json](change/C016.json) |
| **C017** | 优化常用网站翻页圆点指示器视觉显著度并接入背景自适应配色 | EntryNavigation | closed | [change/C017.json](change/C017.json) |
| **C018** | 常用网站键盘翻页由上下方向键调整为左右方向键 | EntryNavigation | closed | [change/C018.json](change/C018.json) |
| **C019** | 常用网站翻页圆点指示器整合左右快捷键键帽与提示文字 | EntryNavigation | closed | [change/C019.json](change/C019.json) |
| **C020** | 常用网站图标文件夹展开抽屉托盘根据背景自适应明暗配色 | EntryNavigation | closed | [change/C020.json](change/C020.json) |
