// dsh-skill-console — client half.
//
// Registers a "Skills" entry in the main sidebar (an icon that opens the list
// in the main view) plus a matching Settings section, listing every installed
// skill (name, description, model/user invocation, source, path) with search.
// Data comes from the host half's same-origin route `GET /api/skill-console/list`.
// This is a read-only browser; the write operations (uninstall / update /
// doctor) live in the `/` commands.
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
      loading: "Reading skills…",
      error: "Skills are temporarily unavailable.",
      retry: "Retry",
      search: "Search skills",
      catalog: "Installed skills",
      empty: "No skills are installed.",
      emptySearch: "No matching skills.",
      modelAndUser: "Model + user",
      userOnly: "User-only",
      modelOnly: "Model-only",
      source: "Source",
      path: "Path",
      intro: "Every skill the session catalog can load, scanned from your DSH skill root (~/.dsh/skills). Model-invocable skills auto-trigger; user-only skills are invoked with /name. Manage with /skills, /skills-uninstall, /skills-update, /skills-doctor.",
    };
    const zh = {
      nav: "技能",
      loading: "正在读取技能…",
      error: "暂时无法读取技能。",
      retry: "重试",
      search: "搜索技能",
      catalog: "已安装技能",
      empty: "暂无已安装技能。",
      emptySearch: "没有匹配的技能。",
      modelAndUser: "模型 + 用户",
      userOnly: "仅用户",
      modelOnly: "仅模型",
      source: "来源",
      path: "路径",
      intro: "会话目录可加载的全部技能，扫描自你的 DSH 技能根目录（~/.dsh/skills）。模型可调用技能按描述自动触发；仅用户技能通过 /名称 调用。管理请用 /skills、/skills-uninstall、/skills-update、/skills-doctor。",
    };

    // ── styling (inline, self-contained) ───────────────────────────────
    const s = {
      section: { width: "100%", maxWidth: "760px", display: "flex", flexDirection: "column", gap: "14px" },
      intro: { margin: 0, color: "var(--dsw-alias-label-tertiary)", fontSize: "13px", lineHeight: "20px" },
      status: { margin: 0, color: "var(--dsw-alias-label-tertiary)", fontSize: "13px", lineHeight: "20px" },
      failure: { display: "flex", alignItems: "center", gap: "10px", color: "var(--dsw-alias-state-error-primary)", fontSize: "13px" },
      failureBtn: { border: "1px solid var(--dsw-alias-border-l2)", color: "var(--dsw-alias-label-primary)", font: "inherit", cursor: "pointer", background: "transparent", borderRadius: "6px", padding: "4px 10px" },
      search: { position: "relative", display: "flex", alignItems: "center" },
      searchInput: { width: "100%", height: "36px", boxSizing: "border-box", border: "1px solid var(--dsw-alias-border-l2)", background: "var(--dsw-alias-bg-layer-1)", color: "var(--dsw-alias-label-primary)", font: "inherit", borderRadius: "8px", outline: "none", padding: "0 12px", fontSize: "13px" },
      catalogHeading: { display: "flex", alignItems: "baseline", gap: "7px", padding: "0 2px" },
      catalogH3: { margin: 0, fontSize: "13px", fontWeight: 600, lineHeight: "20px" },
      catalogCount: { color: "var(--dsw-alias-label-tertiary)", fontVariantNumeric: "tabular-nums", fontSize: "12px", lineHeight: "18px" },
      cards: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", alignItems: "start", gap: "10px", margin: 0, padding: 0, listStyle: "none" },
      card: { border: "1px solid var(--dsw-alias-border-l2)", background: "var(--dsw-alias-bg-layer-3)", borderRadius: "10px", minWidth: 0, overflow: "hidden" },
      cardHeader: { width: "100%", display: "flex", alignItems: "center", gap: "8px", textAlign: "left", color: "inherit", font: "inherit", background: "transparent", border: 0, cursor: "pointer", padding: "11px 12px" },
      cardTitle: { flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "13.5px", fontWeight: 600 },
      badge: { flex: "none", fontSize: "11px", lineHeight: "16px", padding: "0 6px", borderRadius: "999px", whiteSpace: "nowrap" },
      badgeModel: { background: "color-mix(in srgb, var(--dsw-alias-state-success-primary, #16a34a) 14%, transparent)", color: "var(--dsw-alias-state-success-primary, #16a34a)" },
      badgeUser: { background: "color-mix(in srgb, var(--dsw-alias-state-warning-primary, #d97706) 14%, transparent)", color: "var(--dsw-alias-state-warning-primary, #d97706)" },
      chevron: { flex: "none", color: "var(--dsw-alias-label-secondary)", fontSize: "12px", transition: "transform .12s" },
      cardBody: { borderTop: "1px solid var(--dsw-alias-border-l1)", display: "flex", flexDirection: "column", gap: "10px", padding: "10px 12px 12px" },
      description: { margin: 0, color: "var(--dsw-alias-label-secondary)", fontSize: "12px", lineHeight: "1.5", wordBreak: "break-word" },
      meta: { margin: 0, color: "var(--dsw-alias-label-tertiary)", fontSize: "11.5px", lineHeight: "1.5", wordBreak: "break-all" },
    };

    function badgeFor(skill, t) {
      const label = skill.invocation === "user-only" ? t("userOnly") : skill.invocation === "model-only" ? t("modelOnly") : t("modelAndUser");
      const style = skill.invocation === "user-only" ? s.badgeUser : s.badgeModel;
      return react.createElement("span", { style: Object.assign({}, s.badge, style) }, label);
    }

    function ListView({ t }) {
      const [request, setRequest] = react.useState(0);
      const [query, setQuery] = react.useState("");
      const [expanded, setExpanded] = react.useState(null);
      const [state, setState] = react.useState({ status: "loading" });
      react.useEffect(() => {
        let current = true;
        fetch("/api/skill-console/list").then((response) => response.json()).then((payload) => {
          if (!current) return;
          if (payload && payload.ok === true && Array.isArray(payload.skills)) setState({ status: "ready", skills: payload.skills });
          else setState({ status: "error" });
        }).catch(() => {
          if (current) setState({ status: "error" });
        });
        return () => { current = false; };
      }, [request]);
      const normalized = query.trim().toLocaleLowerCase();
      const filtered = state.status === "ready"
        ? state.skills.filter((skill) => normalized.length === 0 || skill.name.toLocaleLowerCase().includes(normalized) || (skill.description || "").toLocaleLowerCase().includes(normalized))
        : [];
      const retry = () => { setState({ status: "loading" }); setRequest((value) => value + 1); };
      const children = [
        react.createElement("p", { style: s.intro }, t("intro")),
        state.status === "loading" ? react.createElement("p", { style: s.status }, t("loading")) : null,
        state.status === "error" ? react.createElement("div", { style: s.failure }, react.createElement("p", { role: "alert", style: { margin: 0 } }, t("error")), react.createElement("button", { type: "button", style: s.failureBtn, onClick: retry }, t("retry"))) : null
      ];
      if (state.status === "ready") {
        children.push(
          react.createElement("label", { style: s.search },
            react.createElement("input", { type: "search", value: query, placeholder: t("search"), "aria-label": t("search"), style: s.searchInput, onChange: (event) => setQuery(event.currentTarget.value) })
          ),
          react.createElement("div", { style: s.catalogHeading },
            react.createElement("h3", { style: s.catalogH3 }, t("catalog")),
            react.createElement("span", { style: s.catalogCount }, filtered.length)
          ),
          state.skills.length === 0 ? react.createElement("p", { style: s.status }, t("empty")) : null,
          state.skills.length > 0 && filtered.length === 0 ? react.createElement("p", { style: s.status }, t("emptySearch")) : null,
          filtered.length > 0 ? react.createElement("ul", { style: s.cards }, filtered.map((skill) => {
            const open = expanded === skill.name;
            const toggle = () => setExpanded(open ? null : skill.name);
            return react.createElement("li", { key: skill.name, style: s.card, "data-skill": skill.name },
              react.createElement("button", { type: "button", style: s.cardHeader, "aria-expanded": open, onClick: toggle },
                react.createElement("strong", { style: s.cardTitle, title: skill.name }, skill.name),
                badgeFor(skill, t),
                react.createElement("span", { style: s.chevron }, open ? "▴" : "▾")
              ),
              open ? react.createElement("div", { style: s.cardBody },
                skill.description ? react.createElement("p", { style: s.description }, skill.description) : null,
                react.createElement("p", { style: s.meta }, `${t("source")}: ${skill.source}`),
                react.createElement("p", { style: s.meta }, `${t("path")}: ${skill.path}`)
              ) : null
            );
          })) : null
        );
      }
      return react.createElement("div", { "aria-busy": state.status === "loading" }, ...children);
    }

    // Sidebar glyph. Prefers the bundled Fluent icon; falls back to an inline
    // sparkle so the entry still renders without the primitives package.
    function SkillsPanelIcon({ size }) {
      if (SkillIcon) return react.createElement(SkillIcon, { size });
      return react.createElement("svg", { viewBox: "0 0 20 20", width: size, height: size, "aria-hidden": true, fill: "currentColor" },
        react.createElement("path", { d: "M10 2l1.85 5.35L17 9.2l-5.15 1.85L10 16.4l-1.85-5.35L3 9.2l5.15-1.85L10 2z" })
      );
    }

    // Main-view panel content: the list in a padded, centered column.
    function PanelPage(props) {
      return react.createElement("div", { style: { padding: "24px 28px", maxWidth: "1100px", margin: "0 auto" } },
        react.createElement(ListView, props)
      );
    }

    // ── client entry ────────────────────────────────────────────────────
    const NS = "skillConsole";
    const inject = ["slots", "locale"];
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), "skill-console: dictionaries");
      const t = ctx.locale.bind(NS);

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

      // Main-view panel content (search + cards).
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
          (props) => react.createElement(ListView, props)
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
