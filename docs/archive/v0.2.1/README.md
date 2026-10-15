# oh-my-tab v0.2.1 批次归档

> **archived**: 2026-10-14 ｜ **milestone**: 无（补丁版本，不新增里程碑） ｜ **status**: frozen

---

## 1. 归档简介

本目录为 `oh-my-tab` 补丁版本 `v0.2.1` 的历史封箱归档镜像，永久只读冻结。

- **发版标签**：`v0.2.1`
- **批次性质**：v0.2.0 之后的补丁批次，承接 v0.2.0 发布范围之外的修复与治理，不新增里程碑
- **归档时间**：2026-10-14
- **构建分发包**：`local/oh-my-tab-v0.2.1.zip` (150 KB, SHA-256: `47c1640c53f1a45f600a4d28ee1ce0c5a5abea5919a909a0eb583a2f90a399ea`)
- **测试证据**：211 项自动化测试全绿通过 (`tests/*.test.cjs`，退出码 0)
- **验证边界**：功能验收依据为人工实测与自动化测试；本批次未在本环境重新加载扩展验证（本地无真实 Chrome 扩展加载能力），扩展加载与新标签页覆盖仍由人工核验

---

## 2. 归档索引

- **现行变更总账**：[change/index.json](../../devel/change/index.json)（保留卡号、主题与依赖登记，归档路径以现行总账为准）
- **现行任务总账**：[task/index.json](../../devel/task/index.json)（`phase` 字段仍指向下一特性阶段 Phase 3 / v0.3.0，本补丁批次不改动该声明）
- **现行设计基线**：[docs/devel/design/README.md](../../devel/design/README.md)
- **根变更日志**：[CHANGELOG.md](../../../CHANGELOG.md)（本批次条目见 `[0.2.1] - 2026-10-14`）

---

## 3. 归档变更清单 (C030 ~ C031)

| 变更号 | 变更标题 | 模块 | 状态 | 卡片文件 |
|---|---|---|---|---|
| **C030** | 修复修饰键组合方向键被常用网站翻页抢占，恢复浏览器原生页面前进/后退 | EntryNavigation | closed | [change/C030.json](change/C030.json) |
| **C031** | 修复 v0.1.0 归档区历史非终态卡账实不符（ARCHIVE_NON_TERMINAL 15 项） | SystemOverview | closed | [change/C031.json](change/C031.json) |
