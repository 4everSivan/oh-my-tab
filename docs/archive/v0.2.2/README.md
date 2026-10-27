# oh-my-tab v0.2.2 批次归档

> **archived**: 2026-10-27 ｜ **milestone**: 无（补丁版本，不新增里程碑） ｜ **status**: frozen

---

## 1. 归档简介

本目录为 `oh-my-tab` 补丁版本 `v0.2.2` 的历史封箱归档镜像，永久只读冻结。

- **发版标签**：`v0.2.2`
- **批次性质**：v0.2.1 之后的补丁批次，承接订阅数据、通知与外观动效的缺陷修复，不新增里程碑
- **归档时间**：2026-10-27
- **构建分发包**：`local/oh-my-tab-v0.2.2.zip` (156 KB, SHA-256: `2316f7d060b2d9471c0182aedcc48b07acedf04b56d053548b8ab760605fce04`)
- **测试证据**：230 项自动化测试全绿通过 (`tests/*.test.cjs`，退出码 0)
- **验证边界**：C036/C037 的闲置交互在真实 Chrome 156（无头）加载 `local/dist` 实测，覆盖淡化、hover 高亮、点击/`/Escape 唤醒与快捷键挂起；未在可见窗口人工目视复核，扩展加载与新标签页覆盖仍由人工核验

---

## 2. 归档索引

- **现行变更总账**：[change/index.json](../../devel/change/index.json)（保留卡号、主题与依赖登记，归档路径以现行总账为准）
- **现行任务总账**：[task/index.json](../../devel/task/index.json)（`phase` 字段仍指向下一特性阶段 Phase 3 / v0.3.0，本补丁批次不改动该声明）
- **现行设计基线**：[docs/devel/design/README.md](../../devel/design/README.md)
- **根变更日志**：[CHANGELOG.md](../../../CHANGELOG.md)（本批次条目见 `[0.2.2] - 2026-10-27`）

---

## 3. 归档变更清单 (C032 ~ C037)

| 变更号 | 变更标题 | 模块 | 状态 | 卡片文件 |
|---|---|---|---|---|
| **C032** | 修复会话级壁纸 Blob URL 落盘导致首帧缩略图直出失效 | DataPersistenceSync | closed | [change/C032.json](change/C032.json) |
| **C033** | 修复纯日期订阅时间在西半球时区显示为前一天 | ExtensionDataSources | closed | [change/C033.json](change/C033.json) |
| **C034** | 修复专注计时系统通知图标路径错误导致通知静默失败 | WidgetContract | closed | [change/C034.json](change/C034.json) |
| **C035** | 修复扩展 manifest 版本与 package.json 漂移 | SystemOverview | closed | [change/C035.json](change/C035.json) |
| **C036** | 修复闲置聚焦淡化在「减少动态效果」下瞬跳无动效，并收敛为只显示淡化搜索框的显式唤醒交互 | MotionSystem | closed | [change/C036.json](change/C036.json) |
| **C037** | 闲置聚焦态新增 Escape 退出入口：退出闲置但不抢占搜索焦点 | MotionSystem | closed | [change/C037.json](change/C037.json) |
