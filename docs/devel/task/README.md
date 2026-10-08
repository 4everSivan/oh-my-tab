# 阶段任务卡池 (task/)

> **created**: 2026-10-07 ｜ **last-change**: 2026-10-07 ｜ **status**: active

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
