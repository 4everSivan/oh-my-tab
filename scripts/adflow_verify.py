#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""adflow-verify —— ad-flow 流程纪律的可执行校验层（方案 W：纯工作流内嵌，无钩子/CI）。

把 ad-flow 的不变量与双轨卡片 SOP 从"散文要求"变成"可机械判定"的门禁：
  * 流程门禁（默认）：状态感知地扫描活跃卡（docs/devel/change、docs/devel/task），
    按每张卡当前的 status 只校验"该状态此刻应成立的前提"（P1-P14）。
  * 初始化 DoD（--mode init）：核对基础文件、已登记代码规范、禁占位、版本标签。

设计原则：
  * 仅用标准库，栈无关——可在任意目标工程里运行。
  * 退出码对齐 references/05-audit-checklist：0 干净 / 4 确定性违规 / 6 仅软告警。
  * 只读；除非 --record（可用 --card 限定回写范围）。
  * --card ID --to STATE 仅在内存预检目标状态，不代替人工验收或修改状态。
  * 新增 ADVISORY 诊断不影响退出码，保持既有门禁标准。
  * 归档区只允许终态卡：非 closed/completed 即 ARCHIVE_NON_TERMINAL 确定性违规
    （v1.1.0 起既有归档前置的机器覆盖；历史冻结卡由人工口径处置，见归档 README）。
  * 里程碑标记与成员任务状态矛盾仅旁路观察（MILESTONE_STATUS_DRIFT）。
  * gate 证伪：声称 exit_code==0 的终态卡，会被独立复算，矛盾即 GATE_CLAIM_CONTRADICTION。

用法：
  adflow-verify [target_dir=.] [--json] [--warn-only] [--mode init]
                [--card ID [--to verified|closed|completed]] [--record]
"""
import argparse
import json
import re
import subprocess
import sys
from datetime import date
from pathlib import Path

VERSION = "1.4.0"

# ---- 常量 ----
TOPIC_RE = re.compile(r"<!--\s*@topic:\s*([A-Za-z0-9_]+)\s*-->")
TAG_RE = re.compile(r"@ad-flow:\s*initialized(?:\s+v([0-9.]+))?")
RUNID_RE = re.compile(r"^(\d+|local-[\d\-]+)$")              # 纯数字或 local-YYYYMMDD-HH，禁内网
CARD_ID_RE = re.compile(r"\b([CT]\d{2,3})\b")                # Cxxx / Txx
SRC_PATH_RE = re.compile(r"(?:^|/)(src|app|lib|cmd|internal)/[\w/.\-]+\.\w+")
CANNED_QUOTES = {"已确认", "确认", "已通过", "同意", "ok", "yes", "done", "tested", "lgtm"}
PATH_KEYS = {"files", "file", "paths", "file_path", "filepath", "sources"}
TERMINAL = {"verified", "closed", "completed"}
CLOSED = {"closed", "completed"}
TRANSITIONS = {"change": {"verified", "closed"}, "task": {"completed"}}
STATUSES = {"change": {"draft", "pending", "in_progress", "rejected", "verified", "closed"},
            "task": {"pending", "in_progress", "completed"}}

# Templates and coding standards use root-index registration; legacy layouts stay valid.
BASE_FILES = [
    "AGENTS.md", "CHANGELOG.md",
    "docs/README.md", "docs/index.json", "docs/assets/README.md",
    "docs/guide/README.md", "docs/guide/index.json", "docs/guide/01-本地部署指南.md",
    "docs/devel/README.md", "docs/devel/index.json", "docs/devel/design/README.md",
    "docs/devel/change/README.md", "docs/devel/change/index.json",
    "docs/devel/task/README.md", "docs/devel/task/index.json",
    "docs/devel/todo/README.md", "docs/devel/todo/now.md", "docs/devel/todo/future.md",
    "docs/devel/env/README.md", "docs/devel/env/01-环境缓存与依赖清理指南.md",
    "docs/archive/README.md",
]
PLACEHOLDER = "docs/devel/design/01-系统设计方案.md"
TOOL_FILES = ["scripts/adflow_verify.py", "scripts/adflow-verify"]
STANDARD_FILES = {
    "coding": "docs/standards/coding.json",
    "task_template": "docs/standards/task-template.json",
    "change_template": "docs/standards/change-template.json",
}
LEGACY_FILES = {
    "docs/guide/01-本地部署指南.md": "docs/guide/01-local-deployment.md",
    "docs/devel/env/01-环境缓存与依赖清理指南.md": "docs/devel/env/01-cache-and-dependency-cleanup.md",
    "docs/standards/task-template.json": "docs/devel/task/template.json",
    "docs/standards/change-template.json": "docs/devel/change/template.json",
    "docs/standards/coding.json": "docs/devel/coding-standards.json",
}


class Ctx:
    """一次运行的共享上下文。"""

    def __init__(self, root):
        self.root = Path(root).resolve()
        self.findings = []          # list[dict(sev, code, card, path, msg)]
        self._json_cache = {}
        self._text_cache = {}
        self._git = None            # None=未知, True/False
        self.proposed_id = None
        self.record_ids = set()

    # ---- 基础读取 ----
    def read_text(self, rel):
        if rel not in self._text_cache:
            p = self.root / rel
            self._text_cache[rel] = p.read_text(encoding="utf-8") if p.is_file() else None
        return self._text_cache[rel]

    def load_json(self, rel):
        if rel not in self._json_cache:
            p = self.root / rel
            if not p.exists():
                self._json_cache[rel] = None
            else:
                try:
                    data = json.loads(p.read_text(encoding="utf-8"))
                    if not isinstance(data, dict):
                        self.hard("JSON_TYPE", None, rel, "JSON 顶层必须为对象")
                        data = None
                    self._json_cache[rel] = data
                except Exception as e:  # noqa: BLE001
                    self.add("ERROR", "JSON_PARSE", None, rel, "JSON 解析失败: %s" % e)
                    self._json_cache[rel] = None
        return self._json_cache[rel]

    def exists(self, rel):
        return (self.root / rel).is_file()

    def topics_in(self, rel):
        txt = self.read_text(rel)
        return set(TOPIC_RE.findall(txt)) if txt else set()

    def git_ok(self):
        if self._git is None:
            try:
                subprocess.run(["git", "rev-parse", "--is-inside-work-tree"],
                               cwd=self.root, stdout=subprocess.DEVNULL,
                               stderr=subprocess.DEVNULL, check=True)
                self._git = True
            except Exception:  # noqa: BLE001
                self._git = False
        return self._git

    def is_ancestor(self, commit):
        """commit 是否为 HEAD 祖先。True/False；无 git 返回 None。"""
        if not self.git_ok():
            return None
        if not commit:
            return False
        try:
            r = subprocess.run(["git", "merge-base", "--is-ancestor", str(commit), "HEAD"],
                               cwd=self.root, stdout=subprocess.DEVNULL,
                               stderr=subprocess.DEVNULL)
            return r.returncode == 0
        except Exception:  # noqa: BLE001
            return None

    # ---- findings ----
    def add(self, sev, code, card, path, msg):
        self.findings.append({"sev": sev, "code": code, "card": card, "path": path, "msg": msg})

    def hard(self, code, card, path, msg):
        self.add("ERROR", code, card, path, msg)

    def soft(self, code, card, path, msg):
        self.add("WARN", code, card, path, msg)

    def advisory(self, code, card, path, msg):
        self.add("ADVISORY", code, card, path, msg)


def is_readme(rel):
    return Path(rel).name.lower() == "readme.md"


def checks_of(card):
    """变更轨读 verification.checks，任务轨读 acceptance.checks。"""
    if isinstance(card.get("verification"), dict) and card["verification"].get("checks"):
        return card["verification"]["checks"]
    if isinstance(card.get("acceptance"), dict) and card["acceptance"].get("checks"):
        return card["acceptance"]["checks"]
    return []


def runid_ok(rid):
    rid = str(rid or "").strip()
    return bool(RUNID_RE.match(rid)) and "http" not in rid and "://" not in rid


def check_card_shape(ctx, card, cid, rel, full=True):
    """仅校验后续读取必需的类型；归档卡只读取身份和状态。"""
    valid = True

    def require(ok, field, kind):
        nonlocal valid
        if not ok:
            ctx.hard("JSON_TYPE", cid, rel, "%s 必须为%s" % (field, kind))
            valid = False

    require(isinstance(cid, str), "id", "字符串")
    require(isinstance(card.get("status"), str), "status", "字符串")
    if not full:
        return valid
    for field in ("target", "verification", "acceptance", "sync", "gate", "design"):
        value = card.get(field)
        require(value is None or isinstance(value, dict), field, "对象或 null")
        if isinstance(value, dict):
            for key in (("design_doc", "design_topic") if field == "target" else
                        ("doc",) if field == "design" else ()):
                require(value.get(key) is None or isinstance(value[key], str),
                        "%s.%s" % (field, key), "字符串或 null")
            if field in ("verification", "acceptance"):
                checks = value.get("checks")
                require(checks is None or (isinstance(checks, list) and
                        all(isinstance(c, dict) for c in checks)),
                        field + ".checks", "对象数组或 null")
    deps = card.get("depends_on")
    require(deps is None or (isinstance(deps, list) and all(isinstance(d, str) for d in deps)),
            "depends_on", "字符串数组或 null")
    rejections = card.get("rejections")
    require(rejections is None or (isinstance(rejections, list) and
            all(isinstance(r, dict) for r in rejections)), "rejections", "对象数组或 null")
    return valid


def check_status(ctx, card, cid, rel, track):
    status = card.get("status")
    if not isinstance(status, str) or status not in STATUSES[track]:
        ctx.hard("STATUS_INVALID", cid, rel, "%s 轨不支持状态 %r" % (track, status))


# ---- 单卡结构校验（与终态无关，任何 status 都查）----
def check_structural(ctx, card, cid, rel):
    t = card.get("target", {}) or {}
    doc = t.get("design_doc")
    topic = t.get("design_topic")

    # P1 设计挂接
    if not doc:
        ctx.hard("DESIGN_DOC_MISSING", cid, rel, "缺少 target.design_doc（文档先行：必须先挂接现行基线设计）")
    elif is_readme(doc):
        ctx.hard("NO_README_AS_DESIGN_DOC", cid, rel, "design_doc 指向 README: %s" % doc)
    elif not ctx.exists(doc):
        ctx.hard("DESIGN_DOC_MISSING", cid, rel, "设计文档不存在: %s" % doc)
    elif topic and topic not in ctx.topics_in(doc):
        ctx.hard("TOPIC_ANCHOR_MISSING", cid, rel, "@%s 锚标未出现在 %s" % (topic, doc))
    design_doc = (card.get("design") or {}).get("doc")
    if design_doc and is_readme(design_doc):
        ctx.hard("NO_README_AS_DESIGN_DOC", cid, rel, "design.doc 指向 README: %s" % design_doc)

    # P5 二值契约对称
    for c in checks_of(card):
        ti = str(c.get("true_if", "")).strip()
        fi = str(c.get("false_if", "")).strip()
        if not ti or not fi:
            ctx.hard("CONTRACT_INCOMPLETE", cid, rel, "checks[].true_if/false_if 不完整: %r" % c.get("item"))
        elif ti == fi:
            ctx.hard("CONTRACT_SYMMETRIC", cid, rel, "true_if 与 false_if 相同: %r" % c.get("item"))

    # P12 悬空依赖（任务卡，任何状态都查存在性）
    for dep in card.get("depends_on", []) or []:
        if dep not in ctx.all_ids:
            ctx.hard("DEP_DANGLING", cid, rel, "depends_on 引用了不存在的卡: %s" % dep)

    # P6 脱钩物理路径（软）
    def scan(obj):
        if isinstance(obj, dict):
            for k, v in obj.items():
                if k in PATH_KEYS:
                    vals = v if isinstance(v, list) else [v]
                    for s in vals:
                        if isinstance(s, str) and SRC_PATH_RE.search(s):
                            ctx.soft("DECOUPLING_VIOLATION", cid, rel,
                                     "卡片硬编码源码物理路径（应只声明 module/component/capability）: %s" % s)
                else:
                    scan(v)
        elif isinstance(obj, list):
            for v in obj:
                scan(v)
    scan(card)


# ---- 单卡终态前置（状态感知）----
def check_state(ctx, card, cid, rel, track):
    status = card.get("status")
    checks = checks_of(card)
    v = card.get("verification", {}) if isinstance(card.get("verification"), dict) else {}
    acc = card.get("acceptance", {}) if isinstance(card.get("acceptance"), dict) else {}
    run_id = v.get("run_id") or acc.get("run_id")
    quote = v.get("user_quote")
    signoff = v.get("signoff")

    if status in TERMINAL:
        if not runid_ok(run_id):
            ctx.hard("EVIDENCE_RUNID", cid, rel, "run_id 为空或含内网/非法格式: %r" % run_id)
        if track == "change":
            if not str(quote or "").strip():
                ctx.hard("EVIDENCE_QUOTE", cid, rel, "缺少人类原话 user_quote（严禁 AI 自导自演代签）")
            elif str(quote).strip().lower() in CANNED_QUOTES or len(str(quote).strip()) < 6:
                ctx.soft("EVIDENCE_QUOTE_CANNED", cid, rel, "user_quote 疑似套话: %r" % quote)
            if not str(signoff or "").strip():
                ctx.hard("EVIDENCE_SIGNOFF", cid, rel, "缺少 signoff")
        if any(c.get("result") is None for c in checks):
            ctx.hard("CHECK_RESULT_MISSING", cid, rel, "存在 result 未裁决的验收项（二值契约必须落 true/false）")

    if status in CLOSED:
        # P8 commit 祖先
        commit = (card.get("sync", {}) or {}).get("commit")
        anc = ctx.is_ancestor(commit)
        if anc is None:
            ctx.soft("COMMIT_SKIPPED_NO_GIT", cid, rel, "无 git 环境，跳过 commit 祖先校验")
        elif not commit:
            ctx.hard("COMMIT_MISSING", cid, rel, "终态卡缺少 sync.commit")
        elif not anc:
            ctx.hard("COMMIT_NOT_ANCESTOR", cid, rel, "sync.commit 非 HEAD 祖先（疑伪造）: %s" % commit)
        # P9 CHANGELOG 互链（软）
        if status == "closed":
            cl = ctx.read_text("CHANGELOG.md") or ""
            if cid not in cl:
                ctx.soft("CHANGELOG_LINK_MISSING", cid, rel, "closed 卡号未出现在 CHANGELOG.md")
        # P12 前置闭环（任务卡 completed）
        if status == "completed":
            for dep in card.get("depends_on", []) or []:
                dc = ctx.all_ids.get(dep)
                if dc is not None and dc.get("status") != "completed":
                    ctx.hard("DEP_NOT_COMPLETED", cid, rel, "前置任务 %s 尚未 completed" % dep)

    if status == "rejected":
        rej = card.get("rejections") or []
        if not rej or any(not str(r.get("reason", "")).strip() for r in rej):
            ctx.hard("REJECTION_NO_AUDIT", cid, rel, "rejected 卡缺少含 reason 的驳回审计记录")

    # P13 hotfix 超期（软）
    if card.get("is_hotfix") and status in ("draft", "pending", "in_progress"):
        ctx.soft("HOTFIX_OPEN", cid, rel, "hotfix 卡仍未闭环，需在故障恢复后 24h 内补票")

    # P3 gate 追责 + 证伪
    if status in CLOSED and cid != ctx.proposed_id and cid not in ctx.record_ids:
        gate = card.get("gate", {}) or {}
        if gate.get("exit_code") != 0:
            ctx.hard("GATE_EXIT_NONZERO", cid, rel,
                     "终态卡未记录 adflow-verify gate.exit_code==0（收口前必须过门禁并回写）")


def check_card(ctx, card, cid, rel, track):
    before = len([f for f in ctx.findings if f["card"] == cid and f["sev"] == "ERROR"])
    check_structural(ctx, card, cid, rel)
    check_state(ctx, card, cid, rel, track)
    # gate 证伪：声称已过门禁但实测有硬违规 → 追责
    if (cid != ctx.proposed_id and cid not in ctx.record_ids and card.get("status") in CLOSED
            and (card.get("gate", {}) or {}).get("exit_code") == 0):
        after = [f for f in ctx.findings if f["card"] == cid and f["sev"] == "ERROR"]
        if len(after) > before:
            ctx.hard("GATE_CLAIM_CONTRADICTION", cid, rel,
                     "卡片声称 gate.exit_code==0，但实测存在硬违规（伪造/漏跑门禁）")


def check_legacy_templates(ctx):
    idx = ctx.load_json("docs/index.json") or {}
    if "standards" in idx:
        for legacy in (LEGACY_FILES["docs/standards/change-template.json"],
                       LEGACY_FILES["docs/standards/task-template.json"]):
            if ctx.exists(legacy):
                ctx.hard("LEGACY_TEMPLATE_EXISTS", None, legacy,
                         "已启用 standards 规范，旧模板 %s 必须删除" % legacy)


def same_milestone(a, b):
    """判断两个里程碑标签是否指同一里程碑（ID、标题或带后缀的标题）。

    只认整词边界（`-`、空格、括号），因此 `M1` 不会误匹配 `M10`。
    """
    a, b = str(a).strip(), str(b).strip()
    if not a or not b:
        return False
    if a == b:
        return True
    shorter, longer = (a, b) if len(a) <= len(b) else (b, a)
    return any(longer.startswith(shorter + sep) for sep in ("-", " ", "(", "（"))


def milestone_members(mid, milestone, reg):
    """解析里程碑的成员任务号。

    真实项目存在三种登记形态，任一形态都应能定位成员：
    1. 里程碑对象自带 `tasks` 成员清单（模板结构）；
    2. 任务登记的 `milestone` 字段填里程碑 ID；
    3. 任务登记的 `milestone` 字段填里程碑标题（可能带 “(已发版归档)” 一类后缀）。
    """
    aliases = {str(mid)}
    title = milestone.get("title")
    if isinstance(title, str) and title.strip():
        aliases.add(title.strip())
        stripped = re.sub(r"\s*[（(][^）)]*[）)]\s*$", "", title.strip())
        if stripped:
            aliases.add(stripped)
    members = set()
    listed = milestone.get("tasks")
    if isinstance(listed, list):
        members.update(str(t) for t in listed if isinstance(t, str))
    for cid, ent in reg.items():
        if not isinstance(ent, dict):
            continue
        label = ent.get("milestone")
        if isinstance(label, str) and any(same_milestone(label, a) for a in aliases):
            members.add(str(cid))
    return members


def check_milestones(ctx):
    """里程碑标记与成员任务状态矛盾时旁路观察，不提高硬门槛。"""
    idx_rel = "docs/devel/task/index.json"
    idx = ctx.load_json(idx_rel) or {}
    milestones = idx.get("milestones")
    if not isinstance(milestones, dict):
        return
    reg = idx.get("tasks", idx.get("cards", {}))
    if not isinstance(reg, dict):
        reg = {}
    for mid, m in milestones.items():
        # list 型里程碑（仅成员清单、无状态字段）没有可矛盾的状态标记，跳过。
        if not (isinstance(m, dict) and m.get("status") == "completed"):
            continue
        for cid in sorted(milestone_members(mid, m, reg)):
            ent = reg.get(cid)
            if (isinstance(ent, dict) and ent.get("status") is not None
                    and ent.get("status") != "completed"):
                ctx.advisory("MILESTONE_STATUS_DRIFT", cid, idx_rel,
                             "里程碑 %s 标记 completed，但该任务状态为 %r（里程碑须与成员卡对齐）"
                             % (mid, ent.get("status")))


# ---- 全局检查 ----
def check_globals(ctx):
    check_legacy_templates(ctx)
    check_milestones(ctx)
    # P11 零沉淀：todo 行内含已存在卡号
    for todo in ("docs/devel/todo/now.md", "docs/devel/todo/future.md"):
        txt = ctx.read_text(todo)
        if not txt:
            continue
        for i, line in enumerate(txt.splitlines(), 1):
            for m in CARD_ID_RE.findall(line):
                if m in ctx.all_ids:
                    ctx.hard("ZERO_SEDIMENT_VIOLATION", m, "%s:%d" % (todo, i),
                             "todo 残留已建卡事项 %s（落地建卡即应物理删除）" % m)

    check_version(ctx)

    # index.topics 的 design_doc 也不得指向 README / 必须存在 / 含锚标
    for idx_rel in ("docs/devel/change/index.json", "docs/devel/task/index.json"):
        data = ctx.load_json(idx_rel) or {}
        topics = data.get("topics", {})
        if not isinstance(topics, dict):
            ctx.hard("JSON_TYPE", None, idx_rel, "topics 必须为对象")
            continue
        for topic, tinfo in topics.items():
            if not isinstance(tinfo, dict):
                ctx.hard("JSON_TYPE", None, idx_rel, "topics[%s] 必须为对象" % topic)
                continue
            d = tinfo.get("design_doc")
            if not d:
                continue
            if not isinstance(d, str):
                ctx.hard("JSON_TYPE", None, idx_rel, "topics[%s].design_doc 必须为字符串" % topic)
            elif is_readme(d):
                ctx.hard("INDEX_TOPIC_README", None, idx_rel, "topics[%s].design_doc 指向 README: %s" % (topic, d))
            elif not ctx.exists(d):
                ctx.hard("DESIGN_DOC_MISSING", None, idx_rel, "topics[%s].design_doc 不存在: %s" % (topic, d))
            elif topic not in ctx.topics_in(d):
                ctx.hard("TOPIC_ANCHOR_MISSING", None, idx_rel, "topics[%s] 锚标未出现在 %s" % (topic, d))


def check_version(ctx, required=False):
    # P14 版本一致；初始化还要求路由元数据明确声明版本。
    am = ctx.read_text("AGENTS.md") or ""
    tag = TAG_RE.search(am)
    idx = ctx.load_json("docs/index.json") or {}
    ver = idx.get("adflow_version")
    if not tag or not tag.group(1):
        ctx.hard("TAG_MISSING", None, "AGENTS.md", "缺少 <!-- @ad-flow: initialized vX.Y.Z --> 标签")
    if required and not ver:
        ctx.hard("VERSION_MISSING", None, "docs/index.json", "缺少 adflow_version")
    elif ver is not None and not isinstance(ver, str):
        ctx.hard("JSON_TYPE", None, "docs/index.json", "adflow_version 必须为字符串")
    elif tag and tag.group(1) and ver and tag.group(1) != ver:
        ctx.hard("VERSION_DRIFT", None, "AGENTS.md",
                 "AGENTS.md 标签 v%s 与 docs/index.json adflow_version=%s 不一致" % (tag.group(1), ver))


# ---- 采集活跃卡 ----
def collect_cards(ctx):
    ctx.all_ids = {}
    cards = []  # (rel, dict, cid)
    seen_paths = set()

    def register(rel, card, cid, active):
        if rel in seen_paths:
            return
        seen_paths.add(rel)
        if cid in ctx.all_ids:
            ctx.hard("ID_DUPLICATE", cid, rel, "卡号重复；不可用后一张卡覆盖前一张卡进行依赖判定")
        else:
            ctx.all_ids[cid] = card
        if active:
            cards.append((rel, card, cid))

    for sub in ("docs/devel/change", "docs/devel/task"):
        track = "task" if sub.endswith("/task") else "change"
        idx_rel = sub + "/index.json"
        if not ctx.exists(idx_rel):
            ctx.hard("INDEX_MISSING", None, idx_rel, "缺少卡片总账索引")
        idx = ctx.load_json(idx_rel) or {}
        # 任务模板使用 tasks；兼容已经使用 cards 的项目，不迁移其索引结构。
        reg = idx.get("tasks", idx.get("cards", {})) if track == "task" else idx.get("cards", {})
        if not isinstance(reg, dict):
            ctx.hard("JSON_TYPE", None, idx_rel, "卡片登记表必须为对象")
            reg = {}
        # 总账是路由真理源：先核对每个登记，再解析归档卡供依赖判定。
        for cid, ent in reg.items():
            if not isinstance(ent, dict):
                ctx.hard("JSON_TYPE", cid, idx_rel, "卡片登记条目必须为对象")
                continue
            f = ent.get("file")
            if not isinstance(f, str) or not f.strip():
                ctx.hard("INDEX_FILE_MISSING", cid, idx_rel, "索引缺少非空 file 路径")
                continue
            try:
                rel = str((ctx.root / f).resolve().relative_to(ctx.root))
            except ValueError:
                ctx.hard("INDEX_FILE_INVALID", cid, idx_rel, "索引 file 必须位于目标项目内: %s" % f)
                continue
            archived = Path(rel).parts[:2] == ("docs", "archive")
            if ((archived and (len(Path(rel).parts) < 5 or Path(rel).parent.name != track)) or
                    (not archived and str(Path(rel).parent) != sub)):
                ctx.hard("INDEX_FILE_INVALID", cid, idx_rel,
                         "索引 file 必须指向所属活跃卡池或归档轨道: %s" % f)
                continue
            if not ctx.exists(rel):
                ctx.hard("INDEX_FILE_DEAD", cid, idx_rel, "索引 file 路径失效: %s" % f)
                continue
            card = ctx.load_json(rel)
            if card is None:
                continue
            actual_id = card.get("id", Path(rel).stem)
            if not check_card_shape(ctx, card, actual_id, rel, full=not archived):
                continue
            check_status(ctx, card, actual_id, rel, track)
            # 归档区只允许终态卡：这是 v1.1.0 起既有归档前置的机器覆盖，非新增追溯门槛。
            if archived and card.get("status") in STATUSES[track] \
                    and card.get("status") not in CLOSED:
                ctx.hard("ARCHIVE_NON_TERMINAL", actual_id, rel,
                         "归档卡处于非终态 %r（归档前置：C 卡 closed / T 卡 completed；"
                         "历史冻结卡按归档 README「历史批次账实修复」人工处置）" % card.get("status"))
            if actual_id != cid:
                ctx.hard("INDEX_ID_DRIFT", cid, idx_rel,
                         "索引 %s 指向了身份为 %s 的卡片: %s" % (cid, actual_id, f))
                continue
            if ent.get("status") != card.get("status"):
                ctx.hard("INDEX_STATUS_DRIFT", cid, idx_rel,
                         "索引状态 %r 与卡片 %r 不一致" % (ent.get("status"), card.get("status")))
            register(rel, card, cid, active=not archived)

        # 保留物理扫描，发现未登记、错误路由，以及与归档卡撞号的活跃卡。
        d = ctx.root / sub
        if not d.exists():
            continue
        for jf in sorted(d.glob("*.json")):
            if jf.name in ("index.json", "template.json"):
                continue
            rel = str(jf.relative_to(ctx.root))
            if rel in seen_paths:
                continue
            card = ctx.load_json(rel)
            if card is None:
                continue
            cid = card.get("id", jf.stem)
            if not check_card_shape(ctx, card, cid, rel):
                continue
            check_status(ctx, card, cid, rel, track)
            register(rel, card, cid, active=True)
            # P2 中枢对齐
            ent = reg.get(cid)
            if ent is None:
                ctx.hard("INDEX_MISSING_CARD", cid, rel, "卡片未登记到 %s" % idx_rel)
            elif isinstance(ent, dict):
                if ent.get("status") != card.get("status"):
                    ctx.hard("INDEX_STATUS_DRIFT", cid, idx_rel,
                             "索引状态 %r 与卡片 %r 不一致" % (ent.get("status"), card.get("status")))
                f = ent.get("file")
                if isinstance(f, str) and (ctx.root / f).resolve() != jf.resolve():
                    ctx.hard("INDEX_FILE_DRIFT", cid, idx_rel,
                             "索引 file 未指向该活跃卡: %s（实际 %s）" % (f, rel))
    return cards


def check_advisories(ctx, cards):
    """新增覆盖先旁路观察；不提高已有项目的硬门槛。"""
    task_cards = {}
    for rel, card, cid in cards:
        if not (card.get("target", {}) or {}).get("design_topic"):
            ctx.advisory("DESIGN_TOPIC_MISSING", cid, rel,
                         "未声明 target.design_topic；现有门禁通过不代表已检查主题挂接")
        if card.get("status") in TERMINAL:
            checks = checks_of(card)
            if not checks or any(c.get("result") is not True for c in checks):
                ctx.advisory("CHECKS_NOT_ALL_TRUE", cid, rel,
                             "验收项为空或未全部为 true；结构门禁不能替代业务验收")
        if "/devel/task/" in rel:
            task_cards[cid] = (rel, card)

    visited, active, path = set(), set(), []

    def visit(cid):
        if cid in active:
            cycle = path[path.index(cid):] + [cid]
            ctx.advisory("DEP_CYCLE", cid, task_cards[cid][0],
                         "依赖出现环路: %s（建议修正；本版不新增硬阻断）" % " -> ".join(cycle))
            return
        if cid in visited:
            return
        active.add(cid)
        path.append(cid)
        for dep in task_cards[cid][1].get("depends_on", []) or []:
            if dep in task_cards:
                visit(dep)
        path.pop()
        active.remove(cid)
        visited.add(cid)

    for cid in sorted(task_cards):
        visit(cid)


def propose_state(ctx, cards, cid, status):
    """校验拟转入状态；原始卡片/索引保持不变，消除先置终态才能校验的循环。"""
    matches = [(i, rel, card) for i, (rel, card, found) in enumerate(cards) if found == cid]
    if len(matches) != 1:
        ctx.hard("TRANSITION_CARD", cid, "-", "目标卡必须唯一且存在于活跃卡池")
        return
    i, rel, card = matches[0]
    track = "change" if "/devel/change/" in rel else "task"
    if status not in TRANSITIONS[track]:
        ctx.hard("TRANSITION_STATE", cid, rel, "该轨不支持目标状态 %s" % status)
        return
    candidate = dict(card)
    candidate["status"] = status
    cards[i] = (rel, candidate, cid)
    ctx.all_ids[cid] = candidate
    ctx.proposed_id = cid


# ---- 初始化 DoD ----
def run_init(ctx):
    def require_file(f, allow_legacy=False):
        if allow_legacy and not ctx.exists(f) and ctx.exists(LEGACY_FILES.get(f, f)):
            f = LEGACY_FILES[f]
        if not ctx.exists(f):
            ctx.hard("BASE_FILE_MISSING", None, f, "缺少基础治理文件或已登记规范")
        elif f.endswith(".json"):
            ctx.load_json(f)

    for f in BASE_FILES + TOOL_FILES:
        require_file(f, allow_legacy=True)
    docs_index = ctx.load_json("docs/index.json") or {}
    devel_index = ctx.load_json("docs/devel/index.json") or {}
    if "standards" in docs_index:
        routes = docs_index["standards"]
        if not isinstance(routes, dict):
            ctx.hard("STANDARD_ROUTE", None, "docs/index.json", "standards 必须为对象")
            routes = {}
        for key, rel in STANDARD_FILES.items():
            if routes.get(key) != rel:
                ctx.hard("STANDARD_ROUTE", None, "docs/index.json", "规范路径不匹配: %s" % key)
            require_file(rel)
    else:
        for key in ("task_template", "change_template"):
            require_file(STANDARD_FILES[key], allow_legacy=True)
        legacy_coding = LEGACY_FILES[STANDARD_FILES["coding"]]
        if devel_index.get("coding_standards") == legacy_coding:
            require_file(legacy_coding)
    # Even unregistered policy documents must be readable; never rewrite their contents.
    for rel in (STANDARD_FILES["coding"], LEGACY_FILES[STANDARD_FILES["coding"]]):
        if ctx.exists(rel):
            ctx.load_json(rel)
    if ctx.exists(PLACEHOLDER):
        ctx.hard("PLACEHOLDER_DESIGN_EXISTS", None, PLACEHOLDER, "存在禁用占位设计文档")
    check_legacy_templates(ctx)
    check_version(ctx, required=True)


# ---- --record：把本次真实结果回写进卡片 gate 块 ----
def record_gates(ctx, cards, selected=None):
    # 全局/其他卡违规同样阻断本次完整门禁，不把局部无错误伪装成整体通过。
    _, _, code = summarize(ctx)
    for rel, card, cid in cards:
        if selected is not None and cid != selected:
            continue
        p = ctx.root / rel
        # 重新读取实际卡片，候选状态只用于校验，不能随 gate 回写落盘。
        actual = json.loads(p.read_text(encoding="utf-8"))
        gate = {"tool": "adflow-verify", "version": VERSION,
                "ran_at": date.today().isoformat(), "exit_code": code}
        if cid == ctx.proposed_id:
            gate["target_status"] = card["status"]
        actual["gate"] = gate
        p.write_text(json.dumps(actual, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


# ---- 报告 ----
def summarize(ctx):
    errs = [f for f in ctx.findings if f["sev"] == "ERROR"]
    warns = [f for f in ctx.findings if f["sev"] == "WARN"]
    code = 4 if errs else (6 if warns else 0)
    return errs, warns, code


def report(ctx, mode, as_json, warn_only):
    errs, warns, code = summarize(ctx)
    if warn_only:
        for f in ctx.findings:
            if f["sev"] == "ERROR":
                f["sev"] = "WARN"
        errs, warns, code = summarize(ctx)
    advisories = [f for f in ctx.findings if f["sev"] == "ADVISORY"]
    if as_json:
        print(json.dumps({"tool": "adflow-verify", "version": VERSION, "mode": mode,
                          "target": str(ctx.root), "exit_code": code,
                          "summary": {"errors": len(errs), "warnings": len(warns),
                                      "advisories": len(advisories)},
                          "findings": ctx.findings}, ensure_ascii=False, indent=2))
    else:
        print("adflow-verify v%s  mode=%s  target=%s" % (VERSION, mode, ctx.root))
        for f in ctx.findings:
            loc = f["path"] if f["card"] in (None, "-") else "%s [%s]" % (f["path"], f["card"])
            print("  [%s] %-24s %s: %s" % (f["sev"], f["code"], loc, f["msg"]))
        print("summary: %d error(s), %d warning(s), %d advisory item(s)" %
              (len(errs), len(warns), len(advisories)))
        print("exit code: %d" % code)
    return code


def main(argv=None):
    ap = argparse.ArgumentParser(description="ad-flow 流程纪律可执行校验层（方案 W）")
    ap.add_argument("target_dir", nargs="?", default=".", help="目标工程根目录，默认当前目录")
    ap.add_argument("--json", action="store_true", help="JSON 输出，供 CI/Agent 消费")
    ap.add_argument("--warn-only", action="store_true", help="全部降级为告警，不阻断（试点期）")
    ap.add_argument("--mode", choices=["process", "init"], default="process",
                    help="process=流程门禁(默认)；init=初始化 DoD")
    ap.add_argument("--record", action="store_true", help="把本次各卡真实结果回写进卡片 gate 块")
    ap.add_argument("--card", help="限定 --record 的卡号；搭配 --to 预检该卡拟转入状态")
    ap.add_argument("--to", choices=["verified", "closed", "completed"], help="仅在内存预检目标状态")
    args = ap.parse_args(argv)
    if args.to and not args.card:
        ap.error("--to 需要 --card")
    if args.mode == "init" and (args.card or args.to or args.record):
        ap.error("初始化检查不支持 --card/--to/--record")
    if args.warn_only and args.record:
        ap.error("--warn-only 不可与 --record 合用；试点降级不得写入正式 gate")

    ctx = Ctx(args.target_dir)
    if args.mode == "init":
        run_init(ctx)
    else:
        cards = collect_cards(ctx)
        if args.record:
            ctx.record_ids = {cid for _, _, cid in cards if args.card is None or cid == args.card}
        if args.card and not any(cid == args.card for _, _, cid in cards):
            ctx.hard("TRANSITION_CARD", args.card, "-", "目标卡不存在于活跃卡池")
        if args.to:
            propose_state(ctx, cards, args.card, args.to)
        for rel, card, cid in cards:
            track = "change" if "/devel/change/" in rel else "task"
            check_card(ctx, card, cid, rel, track)
        check_globals(ctx)
        check_advisories(ctx, cards)
        if args.record and not any(f["code"] in {"TRANSITION_CARD", "TRANSITION_STATE", "ID_DUPLICATE"}
                                   for f in ctx.findings):
            record_gates(ctx, cards, args.card)

    code = report(ctx, args.mode, args.json, args.warn_only)
    return code


if __name__ == "__main__":
    sys.exit(main())
