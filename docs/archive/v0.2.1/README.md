# oh-my-tab v0.2.1 批次归档

> **archived**: 2026-10-14 ｜ **milestone**: 无（补丁版本，不新增里程碑） ｜ **status**: 批次进行中（未发版）

---

## 1. 归档简介

本目录为 `oh-my-tab` 补丁批次 `v0.2.1` 的归档区，收存该批次内已收口的卡片。

**该版本尚未发布。** 按 [归档 README](../README.md) §4 的四步顺序（收口 → 普通校验 Exit 0 → 归档移动 + 总账更新 → 复核 Exit 0 → 打 Tag / CHANGELOG 定稿），本批次当前只完成了归档移动与复核校验两步：发版标签、构建分发包与测试证据在 v0.2.1 实际发布时补记，批次内后续收口的卡片继续归入本目录。

- **归档时间**：2026-10-14
- **批次性质**：v0.2.0 之后的补丁批次，承接 v0.2.0 发布范围之外的修复与治理，不新增里程碑
- **批次范围（截至归档日）**：C030、C031 共 2 张变更卡；本批次暂无任务卡
- **校验状态**：普通模式 `scripts/adflow-verify --json` 与骨架 `--mode init` 均为 Exit 0（2026-10-14 实测）

---

## 2. 归档索引

- **现行变更总账**：[change/index.json](../../devel/change/index.json)（保留卡号、主题与依赖登记，归档路径以现行总账为准）
- **现行任务总账**：[task/index.json](../../devel/task/index.json)（`phase` 字段仍指向下一特性阶段 Phase 3 / v0.3.0，本补丁批次不改动该声明）
- **现行设计基线**：[docs/devel/design/README.md](../../devel/design/README.md)
- **根变更日志**：[CHANGELOG.md](../../../CHANGELOG.md)（本批次条目暂位于 `[Unreleased]`，发版定稿时归入 `[0.2.1]`）

---

## 3. 归档变更清单 (C030 ~ C031)

| 变更号 | 变更标题 | 模块 | 状态 | 卡片文件 |
|---|---|---|---|---|
| **C030** | 修复修饰键组合方向键被常用网站翻页抢占，恢复浏览器原生页面前进/后退 | EntryNavigation | closed | [change/C030.json](change/C030.json) |
| **C031** | 修复 v0.1.0 归档区历史非终态卡账实不符（ARCHIVE_NON_TERMINAL 15 项） | SystemOverview | closed | [change/C031.json](change/C031.json) |
