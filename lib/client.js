// dsh-skill-console — client half.
//
// Registers a "Skills" entry in the main sidebar (an icon that opens the list
// in the main view) plus a matching Settings section. The panel is a mature,
// commercial-grade browser: a filter sidebar (source / invocation / sort) next
// to a responsive card gallery, with a slide-over detail drawer. Data comes
// from the host half's same-origin route `GET /api/skill-console/list`. This is
// read-only; the write operations (uninstall / update / doctor) live in `/`.
window.__ModuleLoader__.load({
  id: "@mi-lu-uncle/dsh-skill-console",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    let react = require("react");
    let SkillIcon = null;
    try {
      const primitives = require("@deepseek-ai/dsh-client-ui-primitives");
      if (primitives && primitives.IconSkillOutlineRegular) SkillIcon = primitives.IconSkillOutlineRegular;
    } catch { /* icon package optional; fall back to the inline glyph below */ }

    // ── locale ──────────────────────────────────────────────────────────
    const en = {
      nav: "Skills",
      title: "Skill Library",
      subtitle: "Installed agent skills — auto-triggered by the model or invoked with /name",
      statsSkills: "skills",
      statsSources: "sources",
      statsAuto: "auto-trigger",
      search: "Search name or description…",
      loading: "Reading skills…",
      error: "Skills are temporarily unavailable.",
      retry: "Retry",
      empty: "No skills are installed.",
      emptySearch: "No matching skills.",
      clearFilters: "Clear filters",
      source: "Source",
      invocation: "Invocation",
      sort: "Sort",
      sortName: "Name A–Z",
      sortNameDesc: "Name Z–A",
      all: "All",
      modelAndUser: "Model + user",
      userOnly: "User-only",
      modelOnly: "Model-only",
      autoExplain: "Model can auto-trigger, or invoke {name} manually",
      manualExplain: "Invoke manually with {name}",
      modelExplain: "Model-only; auto-triggered, not user-invocable",
      description: "Description",
      path: "Path",
      copyInvoke: "Copy {name}",
      copied: "Copied",
      close: "Close",
      manageHint: "Manage with /skills-uninstall · /skills-update · /skills-doctor",
    };
    const zh = {
      nav: "技能",
      title: "技能库",
      subtitle: "已安装的 Agent 技能 — 模型自动触发或手动 /名称 调用",
      statsSkills: "个技能",
      statsSources: "个来源",
      statsAuto: "个自动触发",
      search: "搜索名称或描述…",
      loading: "正在读取技能…",
      error: "暂时无法读取技能。",
      retry: "重试",
      empty: "暂无已安装技能。",
      emptySearch: "没有匹配的技能。",
      clearFilters: "清除筛选",
      source: "来源",
      invocation: "调用方式",
      sort: "排序",
      sortName: "名称 A–Z",
      sortNameDesc: "名称 Z–A",
      all: "全部",
      modelAndUser: "模型 + 用户",
      userOnly: "仅用户",
      modelOnly: "仅模型",
      autoExplain: "模型可自动触发，也可 {name} 手动调用",
      manualExplain: "仅输入 {name} 手动触发",
      modelExplain: "仅模型自动触发，用户不可直接调用",
      description: "描述",
      path: "路径",
      copyInvoke: "复制 {name}",
      copied: "已复制",
      close: "关闭",
      manageHint: "管理：/skills-uninstall 卸载 · /skills-update 更新 · /skills-doctor 体检",
    };

    // ── palette & small helpers ─────────────────────────────────────────
    const MONOGRAM_COLORS = ["#7c6ff0", "#4f8ef7", "#2fb6a8", "#e0a13d", "#e05d7a", "#6fb05f", "#b06fe0", "#58a6e6"];
    function monogramColor(name) {
      let h = 0;
      for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
      return MONOGRAM_COLORS[h % MONOGRAM_COLORS.length];
    }
    function monogram(name) {
      const ch = String(name || "").replace(/^[^a-zA-Z0-9\u4e00-\u9fa5]+/, "").slice(0, 1);
      return ch ? ch.toUpperCase() : "·";
    }

    // ── styling (inline + one injected sheet for hover/transition) ──────
    const s = {
      root: { display: "flex", flexDirection: "column", gap: "16px" },
      header: { display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" },
      title: { margin: 0, fontSize: "20px", fontWeight: 700, lineHeight: "28px" },
      subtitle: { margin: "4px 0 0", color: "var(--dsw-alias-label-tertiary)", fontSize: "13px", lineHeight: "20px" },
      stats: { display: "flex", gap: "8px", flexWrap: "wrap" },
      pill: { display: "inline-flex", alignItems: "baseline", gap: "5px", fontSize: "12px", lineHeight: "18px", padding: "4px 10px", borderRadius: "999px", border: "1px solid var(--dsw-alias-border-l2)", color: "var(--dsw-alias-label-secondary)", background: "var(--dsw-alias-bg-layer-1)" },
      pillNum: { fontWeight: 700, color: "var(--dsw-alias-label-primary)", fontVariantNumeric: "tabular-nums" },
      search: { display: "flex", alignItems: "center", gap: "9px", height: "38px", padding: "0 13px", border: "1px solid var(--dsw-alias-border-l2)", background: "var(--dsw-alias-bg-layer-1)", borderRadius: "10px" },
      searchIcon: { flex: "none", width: 16, height: 16, color: "var(--dsw-alias-label-tertiary)" },
      searchInput: { flex: 1, minWidth: 0, border: 0, outline: "none", background: "transparent", color: "var(--dsw-alias-label-primary)", font: "inherit", fontSize: "14px" },
      body: { display: "flex", gap: "18px", alignItems: "flex-start" },
      sidebar: { width: "200px", flex: "none", display: "flex", flexDirection: "column", gap: "18px", padding: "14px", border: "1px solid var(--dsw-alias-border-l1)", background: "var(--dsw-alias-bg-layer-1)", borderRadius: "12px" },
      filterGroup: { display: "flex", flexDirection: "column" },
      filterLabel: { margin: "0 8px 6px", fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--dsw-alias-label-tertiary)" },
      option: { display: "flex", alignItems: "center", gap: "8px", padding: "6px 8px", borderRadius: "8px", cursor: "pointer", fontSize: "13px", lineHeight: "18px", color: "var(--dsw-alias-label-secondary)", userSelect: "none" },
      optionLabel: { flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
      optionCount: { fontVariantNumeric: "tabular-nums", fontSize: "11.5px", color: "var(--dsw-alias-label-tertiary)" },
      checkbox: { accentColor: "var(--dsw-accent, #6366f1)", width: 14, height: 14, flex: "none", cursor: "pointer" },
      radio: { accentColor: "var(--dsw-accent, #6366f1)", width: 14, height: 14, flex: "none", cursor: "pointer" },
      grid: { flex: 1, minWidth: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", alignItems: "start", gap: "12px" },
      card: { display: "flex", flexDirection: "column", background: "var(--dsw-alias-bg-layer-3)", border: "1px solid var(--dsw-alias-border-l1)", borderRadius: "12px", padding: "14px", cursor: "pointer", minWidth: 0 },
      cardTop: { display: "flex", alignItems: "flex-start", gap: "11px" },
      monogram: { flex: "none", width: "40px", height: "40px", borderRadius: "11px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "15px", color: "#fff" },
      cardMain: { flex: 1, minWidth: 0 },
      cardTitleRow: { display: "flex", alignItems: "center", gap: "7px", minWidth: 0 },
      cardName: { flex: "none", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontWeight: 600, fontSize: "13.5px", lineHeight: "20px" },
      cardDesc: { margin: "6px 0 0", color: "var(--dsw-alias-label-secondary)", fontSize: "12.5px", lineHeight: "1.5", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: "37px" },
      cardFoot: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginTop: "12px", paddingTop: "11px", borderTop: "1px solid var(--dsw-alias-border-l1)" },
      invokeHint: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", color: "var(--dsw-alias-label-tertiary)", fontSize: "11.5px", whiteSpace: "nowrap" },
      chip: { display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11.5px", lineHeight: "16px", padding: "2px 8px", borderRadius: "999px", whiteSpace: "nowrap" },
      chipRepo: { color: "#60a5fa", background: "rgba(96,165,250,.10)", border: "1px solid rgba(96,165,250,.28)" },
      chipLocal: { color: "#a78bfa", background: "rgba(167,139,250,.10)", border: "1px solid rgba(167,139,250,.28)" },
      badge: { display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: 600, lineHeight: "16px", padding: "2px 8px", borderRadius: "999px", whiteSpace: "nowrap", flex: "none" },
      badgeAuto: { background: "color-mix(in srgb, var(--dsw-alias-state-success-primary, #16a34a) 14%, transparent)", color: "var(--dsw-alias-state-success-primary, #16a34a)" },
      badgeManual: { background: "color-mix(in srgb, var(--dsw-alias-state-warning-primary, #d97706) 14%, transparent)", color: "var(--dsw-alias-state-warning-primary, #d97706)" },
      badgeModel: { background: "rgba(167,139,250,.14)", color: "#a78bfa" },
      dot: { width: 6, height: 6, borderRadius: "50%", background: "currentColor", flex: "none" },
      status: { color: "var(--dsw-alias-label-tertiary)", fontSize: "13px", lineHeight: "20px" },
      failure: { display: "flex", alignItems: "center", gap: "10px", color: "var(--dsw-alias-state-error-primary)", fontSize: "13px" },
      btn: { cursor: "pointer", border: "1px solid var(--dsw-alias-border-l2)", background: "transparent", color: "var(--dsw-alias-label-primary)", font: "inherit", fontSize: "12.5px", borderRadius: "8px", padding: "6px 12px" },
      empty: { padding: "60px 20px", textAlign: "center", color: "var(--dsw-alias-label-tertiary)" },
      emptyGlyph: { fontSize: "30px", lineHeight: 1, marginBottom: "12px" },
      manage: { margin: 0, color: "var(--dsw-alias-label-tertiary)", fontSize: "12px", lineHeight: "18px" },
      // drawer
      backdrop: { position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 400 },
      drawer: { position: "fixed", top: 0, right: 0, bottom: 0, width: "400px", maxWidth: "92vw", background: "var(--dsw-alias-bg-layer-3)", borderLeft: "1px solid var(--dsw-alias-border-l2)", zIndex: 401, display: "flex", flexDirection: "column", boxShadow: "-24px 0 60px rgba(0,0,0,.45)" },
      drawerHead: { display: "flex", alignItems: "center", gap: "12px", padding: "20px 22px", borderBottom: "1px solid var(--dsw-alias-border-l1)" },
      drawerTitle: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontWeight: 700, fontSize: "16px", lineHeight: "22px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
      drawerBody: { flex: 1, overflow: "auto", padding: "20px 22px", display: "flex", flexDirection: "column", gap: "16px" },
      drawerSectionLabel: { margin: 0, fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--dsw-alias-label-tertiary)" },
      drawerText: { margin: "6px 0 0", color: "var(--dsw-alias-label-primary)", fontSize: "13.5px", lineHeight: "1.6", wordBreak: "break-word" },
      drawerPath: { margin: "6px 0 0", color: "var(--dsw-alias-label-tertiary)", fontSize: "11.5px", lineHeight: "1.5", wordBreak: "break-all", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
      drawerFoot: { display: "flex", gap: "10px", padding: "14px 22px", borderTop: "1px solid var(--dsw-alias-border-l1)" },
      closeBtn: { cursor: "pointer", border: "1px solid var(--dsw-alias-border-l2)", background: "transparent", color: "var(--dsw-alias-label-primary)", font: "inherit", fontSize: "12.5px", borderRadius: "8px", padding: "6px 12px", flex: "none" },
      copyBtn: { cursor: "pointer", border: "1px solid transparent", background: "var(--dsw-accent, #6366f1)", color: "#fff", font: "inherit", fontSize: "12.5px", borderRadius: "8px", padding: "6px 14px", flex: 1 },
    };

    const INV = {
      "model-and-user": { style: s.badgeAuto, labelKey: "modelAndUser", explainKey: "autoExplain" },
      "user-only": { style: s.badgeManual, labelKey: "userOnly", explainKey: "manualExplain" },
      "model-only": { style: s.badgeModel, labelKey: "modelOnly", explainKey: "modelExplain" },
    };

    function InvocationBadge({ invocation, t }) {
      const meta = INV[invocation] || INV["model-and-user"];
      return react.createElement("span", { style: Object.assign({}, s.badge, meta.style) },
        react.createElement("span", { style: s.dot }),
        t(meta.labelKey)
      );
    }

    function SourceChip({ source }) {
      const local = source === "DSH用户";
      return react.createElement("span", { style: Object.assign({}, s.chip, local ? s.chipLocal : s.chipRepo) }, source);
    }

    function explain(skill, t) {
      const meta = INV[skill.invocation] || INV["model-and-user"];
      return t(meta.explainKey).replace("{name}", "/" + skill.name);
    }

    // ── panel ───────────────────────────────────────────────────────────
    function SkillsPanel({ t }) {
      const [request, setRequest] = react.useState(0);
      const [query, setQuery] = react.useState("");
      const [state, setState] = react.useState({ status: "loading" });
      const [excluded, setExcluded] = react.useState(() => new Set());
      const [invocation, setInvocation] = react.useState("all");
      const [sort, setSort] = react.useState("name");
      const [selected, setSelected] = react.useState(null);
      const [copied, setCopied] = react.useState(false);
      const searchRef = react.useRef(null);

      react.useEffect(() => {
        let current = true;
        fetch("/api/skill-console/list").then((response) => response.json()).then((payload) => {
          if (!current) return;
          if (payload && payload.ok === true && Array.isArray(payload.skills)) setState({ status: "ready", skills: payload.skills });
          else setState({ status: "error" });
        }).catch(() => { if (current) setState({ status: "error" }); });
        return () => { current = false; };
      }, [request]);

      const retry = () => { setState({ status: "loading" }); setRequest((v) => v + 1); };

      const skills = state.status === "ready" ? state.skills : [];
      const facets = react.useMemo(() => {
        const counts = {};
        skills.forEach((sk) => { counts[sk.source] = (counts[sk.source] || 0) + 1; });
        return Object.keys(counts).sort().map((name) => ({ name, count: counts[name] }));
      }, [skills]);

      const filtered = react.useMemo(() => {
        const q = query.trim().toLocaleLowerCase();
        return skills
          .filter((sk) => q.length === 0 || sk.name.toLocaleLowerCase().includes(q) || (sk.description || "").toLocaleLowerCase().includes(q))
          .filter((sk) => !excluded.has(sk.source))
          .filter((sk) => invocation === "all" || sk.invocation === invocation)
          .sort((a, b) => (sort === "nameDesc" ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name)));
      }, [skills, query, excluded, invocation, sort]);

      const toggleSource = (name) => {
        setExcluded((prev) => {
          const next = new Set(prev);
          if (next.has(name)) next.delete(name); else next.add(name);
          return next;
        });
      };
      const clearFilters = () => { setQuery(""); setExcluded(new Set()); setInvocation("all"); setSort("name"); };
      const doCopy = (name) => {
        const text = "/" + name;
        const done = () => { setCopied(true); setTimeout(() => setCopied(false), 1500); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, done);
        else done();
      };

      const autoCount = skills.filter((sk) => sk.invocation === "model-and-user").length;

      const header = react.createElement("header", { style: s.header },
        react.createElement("div", null,
          react.createElement("h1", { style: s.title }, t("title")),
          react.createElement("p", { style: s.subtitle }, t("subtitle"))
        ),
        react.createElement("div", { style: s.stats },
          react.createElement("span", { style: s.pill }, react.createElement("b", { style: s.pillNum }, skills.length), t("statsSkills")),
          react.createElement("span", { style: s.pill }, react.createElement("b", { style: s.pillNum }, facets.length), t("statsSources")),
          react.createElement("span", { style: s.pill }, react.createElement("b", { style: s.pillNum }, autoCount), t("statsAuto"))
        )
      );

      const searchBox = react.createElement("div", { style: s.search },
        react.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, style: s.searchIcon },
          react.createElement("circle", { cx: 11, cy: 11, r: 7 }),
          react.createElement("path", { d: "M20 20l-3.2-3.2", strokeLinecap: "round" })
        ),
        react.createElement("input", { ref: searchRef, type: "search", value: query, placeholder: t("search"), "aria-label": t("search"), style: s.searchInput, onChange: (e) => setQuery(e.currentTarget.value) })
      );

      const sourceRow = (f) => react.createElement("label", { key: f.name, style: s.option, "data-sc": "opt" },
        react.createElement("input", { type: "checkbox", checked: !excluded.has(f.name), onChange: () => toggleSource(f.name), style: s.checkbox }),
        react.createElement("span", { style: s.optionLabel }, f.name),
        react.createElement("span", { style: s.optionCount }, f.count)
      );

      const radioRow = (name, value, label, current, onChange) => react.createElement("label", { key: value, style: s.option, "data-sc": "opt" },
        react.createElement("input", { type: "radio", name, checked: current === value, onChange: () => onChange(value), style: s.radio }),
        react.createElement("span", { style: s.optionLabel }, label)
      );

      const sidebar = react.createElement("aside", { style: s.sidebar },
        react.createElement("div", { style: s.filterGroup },
          react.createElement("p", { style: s.filterLabel }, t("source")),
          facets.map(sourceRow)
        ),
        react.createElement("div", { style: s.filterGroup },
          react.createElement("p", { style: s.filterLabel }, t("invocation")),
          radioRow("skill-invocation", "all", t("all"), invocation, setInvocation),
          radioRow("skill-invocation", "model-and-user", t("modelAndUser"), invocation, setInvocation),
          radioRow("skill-invocation", "user-only", t("userOnly"), invocation, setInvocation),
          radioRow("skill-invocation", "model-only", t("modelOnly"), invocation, setInvocation)
        ),
        react.createElement("div", { style: s.filterGroup },
          react.createElement("p", { style: s.filterLabel }, t("sort")),
          radioRow("skill-sort", "name", t("sortName"), sort, setSort),
          radioRow("skill-sort", "nameDesc", t("sortNameDesc"), sort, setSort)
        )
      );

      const grid = filtered.length > 0
        ? react.createElement("div", { style: s.grid }, filtered.map((skill) =>
          react.createElement("article", {
            key: skill.name, style: s.card, "data-sc": "card",
            tabIndex: 0, role: "button", "aria-label": skill.name,
            onClick: () => setSelected(skill),
            onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(skill); } },
          },
            react.createElement("div", { style: s.cardTop },
              react.createElement("span", { style: Object.assign({}, s.monogram, { background: monogramColor(skill.name) }) }, monogram(skill.name)),
              react.createElement("div", { style: s.cardMain },
                react.createElement("div", { style: s.cardTitleRow },
                  react.createElement("span", { style: s.cardName, title: skill.name }, skill.name),
                  react.createElement(InvocationBadge, { invocation: skill.invocation, t })
                ),
                react.createElement("p", { style: s.cardDesc }, skill.description || "")
              )
            ),
            react.createElement("div", { style: s.cardFoot },
              react.createElement(SourceChip, { source: skill.source }),
              react.createElement("span", { style: s.invokeHint }, "/" + skill.name)
            )
          ))
        )
        : null;

      const emptyState = state.status === "ready" && skills.length === 0
        ? react.createElement("div", { style: s.empty }, react.createElement("div", { style: s.emptyGlyph }, "🧩"), t("empty"))
        : state.status === "ready" && filtered.length === 0
          ? react.createElement("div", { style: s.empty },
              react.createElement("div", { style: s.emptyGlyph }, "🔍"),
              t("emptySearch"),
              react.createElement("div", { style: { marginTop: "16px" } },
                react.createElement("button", { type: "button", style: s.btn, onClick: clearFilters }, t("clearFilters"))
              )
            )
          : null;

      const body = react.createElement("div", { style: s.body }, sidebar, grid, emptyState && react.createElement("div", { style: { flex: 1 } }, emptyState));

      const drawer = selected
        ? react.createElement("div", null,
            react.createElement("div", { style: s.backdrop, onClick: () => setSelected(null) }),
            react.createElement("aside", { style: s.drawer, role: "dialog", "aria-label": selected.name },
              react.createElement("div", { style: s.drawerHead },
                react.createElement("span", { style: Object.assign({}, s.monogram, { background: monogramColor(selected.name) }) }, monogram(selected.name)),
                react.createElement("div", { style: { flex: 1, minWidth: 0 } },
                  react.createElement("div", { style: s.drawerTitle }, selected.name),
                  react.createElement("div", { style: { marginTop: "6px" } }, react.createElement(InvocationBadge, { invocation: selected.invocation, t }))
                ),
                react.createElement("button", { type: "button", style: s.closeBtn, onClick: () => setSelected(null), "aria-label": t("close") }, "✕")
              ),
              react.createElement("div", { style: s.drawerBody },
                react.createElement("section", null,
                  react.createElement("p", { style: s.drawerSectionLabel }, t("description")),
                  react.createElement("p", { style: s.drawerText }, selected.description || "—")
                ),
                react.createElement("section", null,
                  react.createElement("p", { style: s.drawerSectionLabel }, t("invocation")),
                  react.createElement("p", { style: s.drawerText }, explain(selected, t))
                ),
                react.createElement("section", null,
                  react.createElement("p", { style: s.drawerSectionLabel }, t("source")),
                  react.createElement("div", { style: { marginTop: "6px" } }, react.createElement(SourceChip, { source: selected.source }))
                ),
                react.createElement("section", null,
                  react.createElement("p", { style: s.drawerSectionLabel }, t("path")),
                  react.createElement("p", { style: s.drawerPath }, selected.path || "~/.dsh/skills/" + selected.name + "/SKILL.md")
                ),
                react.createElement("p", { style: s.manage }, t("manageHint"))
              ),
              react.createElement("div", { style: s.drawerFoot },
                react.createElement("button", { type: "button", style: s.copyBtn, onClick: () => doCopy(selected.name) },
                  copied ? t("copied") + " ✓" : t("copyInvoke").replace("{name}", "/" + selected.name)
                ),
                react.createElement("button", { type: "button", style: s.closeBtn, onClick: () => setSelected(null) }, t("close"))
              )
            )
          )
        : null;

      const children = [header, searchBox];
      if (state.status === "loading") children.push(react.createElement("p", { style: s.status }, t("loading")));
      else if (state.status === "error") children.push(react.createElement("div", { style: s.failure },
        react.createElement("p", { role: "alert", style: { margin: 0 } }, t("error")),
        react.createElement("button", { type: "button", style: s.btn, onClick: retry }, t("retry"))
      ));
      else children.push(body);

      return react.createElement("div", { style: s.root, "aria-busy": state.status === "loading" }, ...children, drawer);
    }

    // Sidebar glyph. Prefers the bundled Fluent icon; falls back to an inline
    // sparkle so the entry still renders without the primitives package.
    function SkillsPanelIcon({ size }) {
      if (SkillIcon) return react.createElement(SkillIcon, { size });
      return react.createElement("svg", { viewBox: "0 0 20 20", width: size, height: size, "aria-hidden": true, fill: "currentColor" },
        react.createElement("path", { d: "M10 2l1.85 5.35L17 9.2l-5.15 1.85L10 16.4l-1.85-5.35L3 9.2l5.15-1.85L10 2z" })
      );
    }

    // Main-view panel content: the panel in a padded, centered column.
    function PanelPage(props) {
      return react.createElement("div", { style: { padding: "24px 28px", maxWidth: "1280px", margin: "0 auto" } },
        react.createElement(SkillsPanel, props)
      );
    }

    // ── client entry ────────────────────────────────────────────────────
    const NS = "skillConsole";
    const inject = ["slots", "locale"];
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), "skill-console: dictionaries");
      const t = ctx.locale.bind(NS);

      // One injected stylesheet for hover/transition (inline styles can't do :hover).
      ctx.effect(() => {
        const style = document.createElement("style");
        style.setAttribute("data-skill-console", "");
        style.textContent = [
          '[data-sc="card"]{transition:border-color .12s ease, transform .12s ease, box-shadow .12s ease}',
          '[data-sc="card"]:hover{border-color:var(--dsw-alias-border-l2); transform:translateY(-1px); box-shadow:0 8px 24px rgba(0,0,0,.10)}',
          '[data-sc="card"]:focus-visible{outline:2px solid var(--dsw-accent, #6366f1); outline-offset:2px}',
          '[data-sc="opt"]{transition:background .1s ease}',
          '[data-sc="opt"]:hover{background:var(--dsw-alias-bg-layer-3)}',
        ].join("\n");
        document.head.appendChild(style);
        return () => style.remove();
      }, "skill-console: stylesheet");

      const disposers = [];

      // Main sidebar entry: an icon that opens the Skills panel in the main view.
      disposers.push(ctx.slots.inject("sidebar.panellist", () =>
        ctx.slots.register(
          {
            name: "sidebar.panellist",
            id: "skills",
            order: 20,
            label: () => t("nav"),
            locale: NS,
          },
          SkillsPanelIcon
        )
      ));

      // Main-view panel content (filter sidebar + card gallery).
      disposers.push(ctx.slots.inject("main", () =>
        ctx.slots.register(
          {
            name: "main",
            key: "skills",
            locale: NS,
            inject: () => ({}),
          },
          (props) => react.createElement(PanelPage, props)
        )
      ));

      // Settings sidebar section (secondary access point).
      disposers.push(ctx.slots.inject("settings.section", () =>
        ctx.slots.register(
          {
            name: "settings.section",
            id: "skills",
            order: 12,
            label: () => t("nav"),
            locale: NS,
            inject: () => ({}),
          },
          (props) => react.createElement(SkillsPanel, props)
        )
      ));

      ctx.effect(() => () => {
        for (const dispose of disposers) if (typeof dispose === "function") dispose();
      }, "skill-console: entry lifecycle");
    }
    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});
