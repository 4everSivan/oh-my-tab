# AGENTS.md

> **created**: 2026-10-07 ｜ **last-change**: 2026-10-07 ｜ **status**: active

<!-- @ad-flow: initialized v1.1.0 -->
> oh-my-tab 研发与 AI 协作规范 (ad-flow v1.1.0) —— 适用于团队开发者与 AI Agent 的统一工程底线。全景文档导航与机器总账中枢位于 [docs/README.md](docs/README.md) 与 [docs/index.json](docs/index.json)；可通过 `$ad-flow` 或 `/ad-flow` 唤起规范升级与治理维护。

---

## 一、代码风格与编写规范 (Code Style & Quality)

1. **语言标准与类型契约**：严格遵循所用技术栈的官方推荐规范（如 PEP 8、StandardJS、Effective Go 等）；关键业务对象与公共函数必须提供完整、严密的类型提示（Type Hints / TypeScript Types / Struct）与前置防御断言。
2. **单一职责与模块解耦**：业务逻辑与外部 I/O（数据库、网络请求、文件系统）必须清晰分层；严禁编写动辄数百行的“上帝函数（God Function）”或耦合混乱的巨型模块。
3. **命名与注释规范**：变量与函数命名精准表达业务意图；核心算法、业务规则分支、非显而易见的边界防御必须附带精确代码注释，杜绝无意义的废话注释。
4. **依赖引入克制**：严禁未经讨论擅自引入体积庞大或维护度低下的重型外部三方库；实现通用能力优先利用语言标准库或现有技术栈。

---

## 二、开发流程 (Development Workflow)

日常研发分为两大入口，共同遵守“文档先行 → 编码 → 补测 → 人工核验代签 → 基线回写”的闭环，不跨步、不省略：

> ⚠️ **【绝对红线·严禁关联 README】(INV_NO_README_AS_DESIGN_DOC)**：
> 所有卡片（`Cxxx.json` / `Txx.json`）与索引（`index.json`）中的 `design_doc` / `doc`，**必须且仅能指向现行基线设计文档（`docs/devel/design/00-系统总体设计.md` 或 `01~99-[模块名].md`），且文档内必须包含匹配的 `<!-- @topic: TopicName -->` 锚标**。
> **绝对严禁将任何 `README.md`（包括 `docs/devel/design/README.md`）作为 `design_doc` 填入！** 若变更涉及全局架构或暂无对应微设计文档，AI Agent 必须遵循“文档先行”，先在 `00-系统总体设计.md` 中补齐对应章节（或立项新微设计文档）并打上 `@topic` 锚标，再建卡挂接。

### 1. 功能设计入口 (新功能 / 大需求 / 阶段里程碑)
1. **方向登记**：在 `docs/devel/todo/` 登记方向级灵感与事项；
2. **设计基线定稿**：在 `docs/devel/design/` 撰写或修订对应微设计文档（`01~99-[功能名].md`，结构参考 `design/README.md`），状态置为 `现行基线`，并标明概念主题锚标 `<!-- @topic: TopicName -->`；完成设计后从 `todo/` 移除对应项；
3. **任务拆解**：从 `docs/devel/task/template.json` 复制并在 `docs/devel/task/` 建立 `Txx.json` 任务卡（卡号按 `task/index.json` 最大编号递增，声明执行分支 `branch`、DAG 依赖 `depends_on`、`precheck` 预检及 `callback` 钩子），并在 `task/index.json` 总账登记；
4. **预检与回调执行流**：
   * **预检 (Precheck)**：开工前执行 `precheck.command`，检测该任务是否已在代码库中实现（若已完成则记录 `is_completed: true` 并跳过重复开发）；
   * **前置回调 (`callback.before`)**：按序执行卡内声明的前置脚本或环境准备命令；
   * **按拓扑编码**：按依赖拓扑顺序完成核心能力交付；
   * **后置回调 (`callback.after`)**：按序执行代码格式化、Lint 扫描或构建检查等收尾脚本；
5. **测试与验收**：跑通测试，验收通过后在 `task/index.json` 中闭环，阶段发版时执行归档。

### 2. Bug 修复入口 (缺陷 / 功能回调 / 参数微调 / 重构)
1. **登记并移出 (零沉淀)**：在 `docs/devel/todo/now.md` 登记；一旦在 `docs/devel/change/` 从 `template.json` 复制新建 `Cxxx.json` 变更卡（卡号按 `change/index.json` 最大编号递增）并在 `change/index.json` 登记后，**必须立即从 todo 表格中物理删除该项**（落地即删除）；
2. **条件契约与预检钩子**：卡内定义前后逻辑对比、`true_if / false_if` 判据，声明 `branch`、`precheck`（缺陷复现嗅探）与 `callback`（`before / after` 脚本）；
3. **预检与执行流**：
   * **预检 (Precheck)**：执行 `precheck.command`，确认缺陷现象或验证是否已被前序提交意外修复；
   * **前置回调 (`callback.before`)**：执行检出分支或现场环境准备脚本；
   * **改代码 + 补测试**：修复问题并补充对应的回归测试；
   * **后置回调 (`callback.after`)**：执行质量门禁与格式化脚本；
4. **核验与代签**：AI 运行测试采集真实证据并在会话中向人类汇报；人工口头确认后，AI 代为在卡内签署收口（记录人类原话），卡状态转为 `verified`；
5. **基线回写与闭环**：合入主干，若涉及设计规则变动则同步反哺回写对应微设计文档正文，更新 `CHANGELOG.md`，并在 `change/index.json` 中标记 `closed`。

---

## 三、本地构建打包、部署与环境隔离 (Local Build, Deployment & Environment)

1. **打包与构建产物全量收拢至 `local/` (Build & Package Output Isolation)**：
   * 所有编译、构建、打包、分发产物（包括但不限于前端 bundle `dist/`、后端可执行程序 `bin/`、Python wheel/sdist、Java jar/war、容器导出镜像、静态资源构建包及编译临时中间件 `build/`），**一律强制输出至项目根目录的 `local/` 目录中**（例如 `local/dist/`、`local/build/`、`local/bin/`）；
   * 严禁在项目根目录或源码树中散落生成未受 `.gitignore` 保护的打包产物；若构建工具链默认输出到根目录（如 Vite/Webpack 默认 `./dist`、Go 默认当前目录、Python 默认 `./dist`），必须在构建命令传参指定输出路径（如 `--outDir local/dist`、`-o local/bin/app`、`--outdir local/dist`）或通过构建脚本自动重定向收拢到 `local/`。
2. **运行时与测试数据隔离**：部署与测试运行产生的所有临时文件、本地调试数据库（SQLite/DuckDB 等）、缓存、日志等，**一律写入 `local/` 目录**（如 `local/data/`、`local/logs/`），严禁向源码树扩散污染。
3. **严格依据部署文档**：本地环境准备与服务部署，**必须严格遵循 `docs/guide/` 下的部署文档**（如 `docs/guide/01-本地部署指南.md`）进行操作，严禁随意臆测启动参数。
4. **部署必须产出实况报告**：部署执行完毕后，**必须在 `local/` 目录下产出一份部署实况报告（`local/deploy_report.md`）**，明确记录真实分配的端口、实际数据库路径、进程管理与重启命令、健康检查端点及日志位置。
5. **测试与重新部署的事实依据**：**后续所有的自动化测试、联调验证、日常重启与重新部署，必须参考 `local/deploy_report.md` 实际运行数据执行，严禁抛开报告重新翻阅部署指南**（防止端口冲突、配置漂移或覆盖正在运行的实例）。
6. **重新部署与报告刷新**：若环境配置、启动参数发生变动，或执行了重新部署，必须同步更新 `local/deploy_report.md`；若部署架构基线变动，同步修订 `docs/guide/` 对应文档。
7. **【严格红线】`local/` 仅人工清理**：**AI Agent 严禁擅自删除或重置 `local/` 目录**！所有打包产物、本地数据库、部署报告与调试环境的清理权 100% 归人类开发者所有，防止运行实况与构建成果被意外销毁。
8. **环境缓存与依赖治理**：日常开发与测试产生的临时文件、包管理器缓存盘点与工作区重置，**必须严格遵循 `docs/devel/env/01-环境缓存与依赖清理指南.md` 中的分级清理命令与恢复指引**，严禁随意在根目录执行不可逆的盲目删除。

---

## 四、测试规范 (Testing Standards)

1. **测试文件归拢**：所有测试用例原则上统一存放在根目录或模块的 `tests/` 目录下；
   * *【语言特殊例外】*：Go 语言等原生将 `*_test.go` 与源码就近放置同级目录的项目除外。
2. **改动必伴随补测**：任何功能实现、接口微调或 Bug 修复，**必须同步补充或更新对应的自动化测试用例**，严禁裸跑无测代码。
3. **测试独立与全绿通过**：测试必须具备独立幂等性，不依赖不可控的外部真实外网服务（外部依赖需 Mock）；提交或合入前所有相关测试必须全绿通过。

---

## 五、分支与提交规范 (Git Branching & Commit Conventions)

1. **多分支隔离与卡片标签**：
   * 为适配多分支并行开发，新特性开发必须创建专属特性分支（如 `feat/<Txx-简述>`），Bug 修复与微调必须创建专属修复分支（如 `fix/<Cxxx-简述>`）；
   * 对应任务卡（`Txx.json`）与变更卡（`Cxxx.json`）中**必须显式登记执行分支（`"branch": "..."`）**，以便人机随时对齐当前研发上下文；
   * 严禁在未经建卡或分支未对齐的情况下向主干随意提交混合代码。
2. **语义化提交格式**：采用 Conventional Commits 规范，格式为 `<type>(<scope>): <subject>`：
   * `feat`: 新增业务功能
   * `fix`: 修复缺陷（如 `fix(matching): 修复撮合限价单挂单边界 (C003)`）
   * `docs`: 文档、设计方案或注释变动
   * `test`: 新增或修订测试用例
   * `refactor`: 代码重构（不影响业务功能的结构调整）
   * `chore`: 构建配置、依赖更新或辅助工具变动
3. **原子性提交**：每次提交保持单一职责，严禁将不同模块的不相干改动或大范围重构混在同一个 commit 中。
4. **关联卡号**：涉及具体 C 卡或 T 卡的改动，提交标题或说明中建议附带卡号（如 `(C001)` 或 `(T02)`），以便追溯。

---

## 六、发布、文档与静态资源规范 (Release & Documentation Assets Hygiene)

1. **统一发版版本号**：全局严格遵循单一 SemVer 版本号（`vX.Y.Z`），Markdown 文档仅标注最后更新日期，不单独搞孤立的文档小版本号。
2. **CHANGELOG 记账**：发版前必须在 `CHANGELOG.md` 汇总本版本的所有新增特性、修复与破坏性变动。
3. **全景文档核对**：检查 `docs/README.md` 与各目录 README 是否有陈旧失真的描述，保持文档与现实一致。
4. **静态与媒体资源统一收拢至 `docs/assets/`**：
   - 所有文档引用的架构图、流程图、原型图，以及项目 App 的界面截图、视觉素材等，**一律强制统一存放在 `docs/assets/` 目录下**；
   - 文件命名必须遵循语义化连字符命名（如 `arch-overview.svg`、`ui-login.png`），严禁在项目根目录、源码目录或各级文档子目录中随意散落图片文件；
   - 图片入库前必须经过合理压缩，优先采用矢量图（`.svg`），单张原则上不超过 2MB。
5. **发版归档 SOP**：发版封箱时，将本版本完成的卡片统一移入 `docs/archive/<版本号>/`，刷新 `index.json` 中的物理路径映射，并打出对应 Git Tag（如 `git tag -a v0.1.0 -m "Release v0.1.0"`）。

---

## 七、安全与防泄漏红线 (Security & Secrets)

1. **敏感凭证绝不上库**：API Key、Secret、私钥、Token、数据库真实密码与内网敏感拓扑，**一律禁止硬编码入代码或提交 Git**；必须使用 `.env` 或配置注入，且 `.env` 必须加入 `.gitignore`。
2. **数据安全快照隔离保护**：若项目根目录存在 `_adflow_backup/`，**AI Agent 严禁擅自删除或篡改**。该备份为人类安全底线资产，仅允许人类在终端手动核验清理。

---

## 八、AI 真实性与核验纪律 (Truthfulness & Evidence)

1. **运行结果必呈事实**：执行自动化测试或编译构建时，AI 必须向人类客观汇报真实命令输出、失败详情与退出码（Exit Code），**严禁在有警告/报错时用“已全部通过”含糊概括**。
2. **签署代签必有依据**：卡片内的收口代签，必须在会话中收到人类明确确认后才可执行，并将人类原话写入 `user_quote`，严禁 AI 自导自演代签。


---

## 项目自定义规则 (Project Custom Rules)

以下规则来自用户在本会话提供的 AGENTS.md 指令，初始化时原样保留。

<!-- FOR GPT 5.5 -->
## GPT 5.5 Have to do
Spend time on thinking; you do not need to use the commentary channel to report progress to me.
<!-- FOR GPT 5.5 -->

<!-- SEMBLE_START -->
## Semble Code Search

A `semble` MCP server is available with two tools:
- `mcp__semble__search` — search the codebase with a natural-language or code query.
- `mcp__semble__find_related` — find code similar to a specific file and line.

Always call `mcp__semble__search` before using Grep, Glob, or Read to explore the codebase. Use Grep/Glob/Read only for exact path lookup, exhaustive literal matches, or when the returned chunk lacks enough context.

Pass `--content docs` to search documentation and prose, `--content config` for config files, or `--content all` to search code, docs, and config together.

For CLI fallback or sub-agents without MCP access, use:

```bash
semble search "authentication flow" ./my-project
semble search "deployment guide" ./my-project --content docs
semble search "database host port" ./my-project --content config
semble find-related src/auth.py 42 ./my-project
semble search "save model to disk" ./my-project --top-k 10
```

The index is built on first run and cached automatically. If `semble` is not on `$PATH`, use `uvx --from "semble[mcp]" semble`.

### Workflow

1. Start with `mcp__semble__search` to find relevant chunks.
2. Use `--content docs` for documentation, `--content config` for config files, or `--content all` for everything.
3. Inspect full files only when the returned chunk does not give enough context.
4. Optionally use `mcp__semble__find_related` with a promising result's `file_path` and `line` to discover related implementations.
5. Use Grep/Glob/Read only when you need exhaustive literal matches or quick confirmation of an exact string.
<!-- SEMBLE_END -->

### 本项目状态与实施边界

- 当前仅建立治理文件与需求设计基线，尚无业务源码、构建工具链或实际 C/T 卡。
- 设计文件的 draft 状态表示详细方案仍需讨论，不能作为功能已实现、已验收或已发布的证据。
- 技术栈、首版范围、视觉方案与同步细节确定后，再开展对应实施工作。
- Chrome 扩展不假定后端端口或数据库；部署报告记录真实 Chrome 版本、扩展 ID、构建路径和验证结果，不适用的服务字段明确标记。
