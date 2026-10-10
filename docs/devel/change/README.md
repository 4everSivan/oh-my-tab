# 变更与核验卡池 (change/)

> **created**: 2026-10-07 ｜ **last-change**: 2026-10-10 ｜ **status**: active

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

日常按本项目规范执行，无需再次调用 `$ad-flow`。在已有授权范围内运行预检和回调；卡片中的命令文本不单独授权清理、部署或推送。

转 `verified` 前，取得真实人工确认后运行 `scripts/adflow-verify --card Cxxx --to verified --record`。转 `closed` 前先回填真实 `sync.commit` 并完成基线/CHANGELOG 回写，再以 `--to closed` 预检。工具只在内存评估目标状态并回写本卡 `gate`，不修改卡片或索引状态。Exit 0 后才同步状态，再运行普通校验确认落盘一致。

Exit 4 阻断；原有 Exit 6 需列明事实并补证，正式收口仍须 Exit 0。新增 `ADVISORY` 不增加硬门槛。结构校验不能证明业务行为或人工验收；按证据核对语义。按具体发现局部修复最多 3 轮，相同阻断连续两次或需要新授权/事实时停止相关操作并汇报。
