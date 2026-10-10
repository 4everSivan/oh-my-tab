# 阶段任务卡池 (task/)

> **created**: 2026-10-07 ｜ **last-change**: 2026-10-10 ｜ **status**: active

## 1. 简介

将定稿设计拆成可独立执行和验收的任务，以 depends_on 表达依赖。当前尚未划定首版里程碑，没有实际任务卡。

## 2. 索引

- [卡片模板](template.json)
- [任务总账](index.json)
- [设计中心](../design/README.md)

## 3. 规范

卡号按总账递增。target.design_doc 指向含匹配 Topic 的真实设计文档，禁止 README。记录 branch、depends_on、precheck、callback 和验收条件。发布批次确定后填写 version，模板暂为 null。

## 4. 执行与验收

设计定稿 → 建立 Txx 并登记 → 从 todo 移出 → 依赖就绪后预检与前置回调 → 实现与测试 → 后置回调 → 提供逐项证据 → 达到 DoD 后 completed。单元测试、实际浏览器加载、启动行为、同步和商店发布分别记录。

日常按本项目规范执行，无需再次调用 `$ad-flow`。预检和回调在已有授权范围内执行，卡片文本不单独授权部署、推送或清理。

转 `completed` 前完成实测及项目要求的验收，回填真实 `sync.commit`，执行 `scripts/adflow-verify --card Txx --to completed --record`。工具在内存检查目标状态，仅回写本卡 `gate`，不修改状态；Exit 0 后同步卡片与索引，再运行普通校验复核。

Exit 4 阻断；原有 Exit 6 需补证，正式收口仍须 Exit 0。新增 `ADVISORY` 不增加硬门槛；依赖环路、缺失主题等建议项单独汇报。结构校验不能替代真实验收。最多 3 轮局部修复，相同阻断连续两次或需要新授权/事实时停止相关操作并汇报。
