# 变更与核验卡池 (change/)

> **created**: 2026-10-07 ｜ **last-change**: 2026-10-07 ｜ **status**: active

## 1. 简介

管理缺陷修复、功能回调与契约微调，记录规则对照、真实证据与人工核验。当前没有实际变更卡。

## 2. 索引

- [卡片模板](template.json)
- [变更总账](index.json)
- [设计中心](../design/README.md)

## 3. 规范

卡号按总账递增。target.design_doc 与 design.doc 指向真实设计文档及匹配 Topic，禁止 README。填写 branch、precheck、callback、true_if / false_if 和证据；无证据的结果保持 null。

## 4. 执行与闭环

登记待办 → 创建 Cxxx 并注册 → 从 todo 移出 → 预检与前置回调 → 修复并补测 → 后置回调 → 汇报证据 → 人类明确确认后记录 user_quote 并 verified → 合入后回写设计、CHANGELOG 和索引，标记 closed。
