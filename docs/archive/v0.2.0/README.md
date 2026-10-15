# oh-my-tab v0.2.0 归档总览

> **archived**: 2026-10-14 ｜ **milestone**: M2-v0.2.0-自由布局、高频组件与全站数据 ｜ **status**: frozen

---

## 1. 归档简介

本目录为 `oh-my-tab` 正式发布版本 `v0.2.0` 的历史封箱归档镜像，永久只读冻结。

- **发版标签**：`v0.2.0`
- **里程碑**：`M2-v0.2.0-自由布局、高频组件与全站数据`
- **归档时间**：2026-10-14
- **构建分发包**：`local/oh-my-tab-v0.2.0.zip` (150 KB, SHA-256: `52d5af3c52b6b4f4093a52a4ade6ba9ab6be697d7c147f10a53c5d4bf6b73670`)
- **测试证据**：204 项自动化测试全绿通过 (`tests/*.test.cjs`)

---

## 2. 归档索引

- **阶段任务总账快照**：[task/index.json](task/index.json)（收录 T16 ~ T18 共 3 项任务卡）
- **变更核验总账快照**：[change/index.json](change/index.json)（封箱快照收录 C021 ~ C026, C028, C029 共 8 张卡）
- **批次勘误**：[ERRATUM.md](ERRATUM.md)（C027 于 2026-10-14 补办收口后归入本批次，批次范围修正为 C021 ~ C029 共 9 张）
- **现行设计基线追溯**：[docs/devel/design/README.md](../../devel/design/README.md)
- **根变更日志**：[CHANGELOG.md](../../../CHANGELOG.md)

---

## 3. 归档任务清单 (T16 ~ T18)

| 任务号 | 任务标题 | 分支 | 状态 | 卡片文件 |
|---|---|---|---|---|
| **T16** | 常用网站网页图标 Command+数字键快捷直达与实时按键提示 | feat/T16-shortcut-key-hints | completed | [task/T16.json](task/T16.json) |
| **T17** | 独立订阅消息侧边栏与外观设置解耦 | feat/T17-feed-sidebar-and-settings-split | completed | [task/T17.json](task/T17.json) |
| **T18** | 真实 RSS/Atom 订阅解析与极客脚本数据源引擎 | feat/T18-rss-feed-and-script-engine | completed | [task/T18.json](task/T18.json) |

---

## 4. 归档变更清单 (C021 ~ C029)

| 变更号 | 变更标题 | 模块 | 状态 | 卡片文件 |
|---|---|---|---|---|
| **C021** | 常用网站快捷键与按键提示按当前活动页局部映射 (⌘1~⌘6) | EntryNavigation | closed | [change/C021.json](change/C021.json) |
| **C022** | 修改常用网站 Command+数字键跳转行为：由新标签页打开调整为当前页面跳转 | EntryNavigation | closed | [change/C022.json](change/C022.json) |
| **C023** | 外观设置分栏标题折行优化、顶栏添加组件纯图标化与右侧浮动卡片式抽屉改版 | WorkspaceAppearance | closed | [change/C023.json](change/C023.json) |
| **C024** | 修复外部公共代理隐私泄露、假超时及极客脚本源 MV3 CSP 阻断缺陷 | ExtensionDataSources | closed | [change/C024.json](change/C024.json) |
| **C025** | 修复存储并发竞争写丢失、事务假成功、iTab多组导入遗漏与跨标签同步缺陷 | DataPersistenceSync | closed | [change/C025.json](change/C025.json) |
| **C026** | 修复 RSS 刷新删除源复活与新源丢失、阅读状态回滚、空源强制恢复及点击非幂等缺陷 | ExtensionDataSources | closed | [change/C026.json](change/C026.json) |
| **C027** | 修复快捷键关闭死锁、文件夹模式污染、全局粘贴泄露、计时器重复通知与搜索选词不一致缺陷 | EntryNavigation | closed | [change/C027.json](change/C027.json) |
| **C028** | 代码规范全面治理：消除any与非空断言、增强IPC类型守卫、消除静默吞错并解耦Shortcuts巨型组件 | SystemOverview | closed | [change/C028.json](change/C028.json) |
| **C029** | 新标签页启动速度与加载动效性能优化：消除关键帧GPU滤镜卡顿、动效节奏提速、首屏零延迟防白屏与异步分包 | MotionSystem | closed | [change/C029.json](change/C029.json) |
