// dsh-skill-console — client half.
//
// Registers a "Skills" entry in the main sidebar (an icon that opens the panel
// in the main view) plus a matching Settings section. The panel is a complete
// management console: a filter sidebar (source / invocation / sort) next to a
// responsive card gallery with a slide-over detail drawer, and top-level
// actions to install, uninstall, update and health-check skills. All data and
// mutations go through the host half's same-origin `/api/skill-console/*` routes.
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
      empty: "No skills are installed yet.",
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
      install: "Install",
      update: "Update",
      doctor: "Health check",
      filter: "Filter",
      statsCaption: "{n} skills · {s} sources · {a} auto-trigger",
      updating: "Updating…",
      uninstall: "Uninstall",
      confirmUninstall: "Confirm?",
      uninstalling: "Uninstalling…",
      uninstalled: "Uninstalled {name}",
      uninstallFailed: "Uninstall failed: ",
      installTitle: "Install skills",
      sourceLabel: "Repository URL or local path",
      sourceHint: "A git URL or an absolute local directory path",
      preview: "Preview",
      previewing: "Reading repository…",
      back: "Back",
      selectAll: "Select all",
      selectNone: "Clear",
      installSelected: "Install {n}",
      installing: "Installing…",
      installedTag: "Installed",
      userOnlyTag: "User-only",
      noSkills: "No installable skills in this repository.",
      installResult: "Installed {n} skills",
      conflictsSuffix: " · {n} conflict(s)",
      missingSuffix: " · {n} missing",
      needSource: "Please enter a repository URL or local path.",
      needSelect: "Select at least one skill.",
      doctorTitle: "Health check",
      checking: "Checking…",
      totalSkills: "{n} skills total",
      deadLinks: "Dead links",
      invalidFm: "Invalid frontmatter",
      orphanMirrors: "Orphan mirrors",
      noneFound: "None",
      allClean: "✅ All good.",
      problemsFound: "⚠️ {n} problem(s) found.",
      updateUpToDate: "Up to date ({rev}).",
      updatedTo: "Updated to {rev}.",
      updateFailed: "Update failed: ",
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
      empty: "还没有安装任何技能。",
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
      install: "安装技能",
      update: "更新",
      doctor: "体检",
      filter: "筛选",
      statsCaption: "共 {n} 个技能 · {s} 个来源 · {a} 个自动触发",
      updating: "更新中…",
      uninstall: "卸载",
      confirmUninstall: "确认卸载？",
      uninstalling: "卸载中…",
      uninstalled: "已卸载 {name}",
      uninstallFailed: "卸载失败：",
      installTitle: "安装技能",
      sourceLabel: "仓库地址或本地路径",
      sourceHint: "git URL，或本地目录的绝对路径",
      preview: "预览",
      previewing: "正在读取仓库…",
      back: "返回",
      selectAll: "全选",
      selectNone: "清空",
      installSelected: "安装 {n} 个",
      installing: "安装中…",
      installedTag: "已装",
      userOnlyTag: "仅用户触发",
      noSkills: "该仓库没有可安装的技能。",
      installResult: "已安装 {n} 个技能",
      conflictsSuffix: "，冲突 {n} 个",
      missingSuffix: "，未找到 {n} 个",
      needSource: "请输入仓库地址或本地路径。",
      needSelect: "请至少选择一个技能。",
      doctorTitle: "技能体检",
      checking: "检查中…",
      totalSkills: "共 {n} 个技能",
      deadLinks: "死链",
      invalidFm: "格式无效",
      orphanMirrors: "孤儿镜像",
      noneFound: "无",
      allClean: "✅ 一切正常。",
      problemsFound: "⚠️ 发现 {n} 个问题。",
      updateUpToDate: "已是最新（{rev}）。",
      updatedTo: "已更新到 {rev}。",
      updateFailed: "更新失败：",
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
      root: { display: "flex", flexDirection: "column", gap: "16px", height: "100%", minHeight: 0 },
      headerRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" },
      // basis 0 (not auto) so the lead block never claims width during the flex
      // line-break pass; otherwise a wrapping header pushes the buttons onto a
      // second line as soon as the panel narrows by the scrollbar width, which
      // made the whole header jump 49px -> 96px ("顶部技能库那一栏会缩小").
      headerLead: { flex: "1 1 0", minWidth: 0 },
      headerActions: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", flex: "0 0 auto" },
      title: { margin: 0, fontSize: "18px", fontWeight: 700, lineHeight: "26px" },
      subtitle: { margin: "3px 0 0", color: "var(--dsw-alias-label-tertiary)", fontSize: "13px", lineHeight: "20px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
      hero: { display: "flex", flexDirection: "column", alignItems: "center", margin: "2px 0 0" },
      heroSearch: { width: "100%", maxWidth: "600px", display: "flex", alignItems: "center", gap: "11px", height: "46px", padding: "0 18px", border: "1px solid var(--dsw-alias-border-l2)", background: "var(--dsw-alias-bg-layer-1)", borderRadius: "999px", boxShadow: "0 2px 12px rgba(0,0,0,.08)" },
      heroIcon: { flex: "none", width: 18, height: 18, color: "var(--dsw-alias-label-tertiary)" },
      heroInput: { flex: 1, minWidth: 0, border: 0, outline: "none", background: "transparent", color: "var(--dsw-alias-label-primary)", font: "inherit", fontSize: "15px" },
      caption: { margin: "8px 0 0", textAlign: "center", color: "var(--dsw-alias-label-tertiary)", fontSize: "12px", lineHeight: "18px" },
      captionB: { color: "var(--dsw-alias-label-secondary)", fontWeight: 600, fontVariantNumeric: "tabular-nums" },
      scrim: { position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 410 },
      filterPanel: { position: "fixed", top: 0, left: 0, bottom: 0, width: "252px", maxWidth: "86vw", background: "var(--dsw-alias-bg-layer-3)", borderRight: "1px solid var(--dsw-alias-border-l2)", zIndex: 411, display: "flex", flexDirection: "column", boxShadow: "24px 0 60px rgba(0,0,0,.35)" },
      filterPanelHead: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "16px 18px", borderBottom: "1px solid var(--dsw-alias-border-l1)" },
      filterPanelTitle: { margin: 0, fontSize: "14px", fontWeight: 700, lineHeight: "20px" },
      filterPanelBody: { flex: 1, overflow: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: "18px" },
      filterPanelFoot: { padding: "14px 18px", borderTop: "1px solid var(--dsw-alias-border-l1)" },
      filterGroup: { display: "flex", flexDirection: "column" },
      filterLabel: { margin: "0 8px 6px", fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--dsw-alias-label-tertiary)" },
      option: { display: "flex", alignItems: "center", gap: "8px", padding: "6px 8px", borderRadius: "8px", cursor: "pointer", fontSize: "13px", lineHeight: "18px", color: "var(--dsw-alias-label-secondary)", userSelect: "none" },
      optionLabel: { flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
      optionCount: { fontVariantNumeric: "tabular-nums", fontSize: "11.5px", color: "var(--dsw-alias-label-tertiary)" },
      checkbox: { accentColor: "var(--dsw-accent, #6366f1)", width: 14, height: 14, flex: "none", cursor: "pointer" },
      radio: { accentColor: "var(--dsw-accent, #6366f1)", width: 14, height: 14, flex: "none", cursor: "pointer" },
      grid: { flex: "1 1 auto", minWidth: 0, minHeight: 0, boxSizing: "border-box", overflowY: "auto", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", alignItems: "start", gap: "12px" },
      card: { display: "flex", flexDirection: "column", background: "var(--dsw-alias-bg-layer-3)", border: "1px solid var(--dsw-alias-border-l1)", borderRadius: "12px", padding: "14px", cursor: "pointer", minWidth: 0 },
      cardTop: { display: "flex", alignItems: "flex-start", gap: "11px" },
      monogram: { flex: "none", width: "40px", height: "40px", borderRadius: "11px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "15px", color: "#fff" },
      cardMain: { flex: 1, minWidth: 0 },
      cardTitleRow: { display: "flex", alignItems: "center", gap: "7px", minWidth: 0 },
      cardName: { flex: "1 1 auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontWeight: 600, fontSize: "13.5px", lineHeight: "20px" },
      cardDesc: { margin: "6px 0 0", color: "var(--dsw-alias-label-secondary)", fontSize: "12.5px", lineHeight: "1.5", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: "37px" },
      cardFoot: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginTop: "12px", paddingTop: "11px", borderTop: "1px solid var(--dsw-alias-border-l1)" },
      invokeHint: { flex: "0 1 auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", color: "var(--dsw-alias-label-tertiary)", fontSize: "11.5px", whiteSpace: "nowrap" },
      chip: { display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11.5px", lineHeight: "16px", padding: "2px 8px", borderRadius: "999px", whiteSpace: "nowrap", flex: "none" },
      chipRepo: { color: "#60a5fa", background: "rgba(96,165,250,.10)", border: "1px solid rgba(96,165,250,.28)" },
      chipLocal: { color: "#a78bfa", background: "rgba(167,139,250,.10)", border: "1px solid rgba(167,139,250,.28)" },
      badge: { display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: 600, lineHeight: "16px", padding: "2px 8px", borderRadius: "999px", whiteSpace: "nowrap", flex: "none" },
      badgeAuto: { background: "color-mix(in srgb, var(--dsw-alias-state-success-primary, #16a34a) 14%, transparent)", color: "var(--dsw-alias-state-success-primary, #16a34a)" },
      badgeManual: { background: "color-mix(in srgb, var(--dsw-alias-state-warning-primary, #d97706) 14%, transparent)", color: "var(--dsw-alias-state-warning-primary, #d97706)" },
      badgeModel: { background: "rgba(167,139,250,.14)", color: "#a78bfa" },
      dot: { width: 6, height: 6, borderRadius: "50%", background: "currentColor", flex: "none" },
      status: { color: "var(--dsw-alias-label-tertiary)", fontSize: "13px", lineHeight: "20px" },
      failure: { display: "flex", alignItems: "center", gap: "10px", color: "var(--dsw-alias-state-error-primary)", fontSize: "13px" },
      btn: { cursor: "pointer", border: "1px solid var(--dsw-alias-border-l2)", background: "transparent", color: "var(--dsw-alias-label-primary)", font: "inherit", fontSize: "12.5px", borderRadius: "8px", padding: "6px 12px", whiteSpace: "nowrap" },
      btnPrimary: { cursor: "pointer", border: "1px solid transparent", background: "var(--dsw-accent, #6366f1)", color: "#fff", font: "inherit", fontSize: "12.5px", borderRadius: "8px", padding: "6px 12px", whiteSpace: "nowrap" },
      btnDanger: { cursor: "pointer", border: "1px solid transparent", background: "var(--dsw-alias-state-error-primary, #ef4444)", color: "#fff", font: "inherit", fontSize: "12.5px", borderRadius: "8px", padding: "6px 12px", whiteSpace: "nowrap" },
      btnDisabled: { opacity: 0.45, cursor: "not-allowed" },
      empty: { flex: "1 1 auto", minHeight: 0, boxSizing: "border-box", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", color: "var(--dsw-alias-label-tertiary)", padding: "24px" },
      emptyGlyph: { fontSize: "30px", lineHeight: 1, marginBottom: "12px" },
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
      // modal
      modalBackdrop: { position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 420, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" },
      modal: { width: "560px", maxWidth: "100%", maxHeight: "82vh", background: "var(--dsw-alias-bg-layer-3)", border: "1px solid var(--dsw-alias-border-l2)", borderRadius: "14px", display: "flex", flexDirection: "column", boxShadow: "0 24px 60px rgba(0,0,0,.5)" },
      modalHead: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "16px 20px", borderBottom: "1px solid var(--dsw-alias-border-l1)" },
      modalTitle: { margin: 0, fontSize: "15px", fontWeight: 700, lineHeight: "22px" },
      modalBody: { flex: 1, overflow: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: "12px" },
      modalFoot: { display: "flex", gap: "10px", justifyContent: "flex-end", padding: "14px 20px", borderTop: "1px solid var(--dsw-alias-border-l1)" },
      input: { width: "100%", boxSizing: "border-box", height: "38px", padding: "0 12px", border: "1px solid var(--dsw-alias-border-l2)", background: "var(--dsw-alias-bg-layer-1)", color: "var(--dsw-alias-label-primary)", font: "inherit", fontSize: "13.5px", borderRadius: "9px", outline: "none" },
      fieldLabel: { margin: 0, fontSize: "12px", fontWeight: 600, color: "var(--dsw-alias-label-secondary)" },
      hint: { margin: 0, color: "var(--dsw-alias-label-tertiary)", fontSize: "12px", lineHeight: "18px" },
      errorLine: { margin: 0, color: "var(--dsw-alias-state-error-primary)", fontSize: "12.5px", lineHeight: "18px", wordBreak: "break-word" },
      installList: { display: "flex", flexDirection: "column", gap: "2px", marginTop: "2px" },
      installItem: { display: "flex", alignItems: "flex-start", gap: "9px", padding: "8px 10px", borderRadius: "9px", cursor: "pointer" },
      installItemMain: { flex: 1, minWidth: 0 },
      installItemRow: { display: "flex", alignItems: "center", flexWrap: "wrap", gap: "6px" },
      installItemName: { flex: "0 1 auto", minWidth: 0, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontWeight: 600, fontSize: "13px", lineHeight: "18px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
      installItemDesc: { margin: "2px 0 0", color: "var(--dsw-alias-label-secondary)", fontSize: "12px", lineHeight: "1.5", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" },
      tag: { display: "inline-flex", alignItems: "center", fontSize: "10.5px", fontWeight: 600, lineHeight: "15px", padding: "1px 7px", borderRadius: "999px", whiteSpace: "nowrap", flex: "none" },
      tagInstalled: { color: "#60a5fa", background: "rgba(96,165,250,.12)", border: "1px solid rgba(96,165,250,.3)" },
      tagUserOnly: { color: "var(--dsw-alias-state-warning-primary, #d97706)", background: "color-mix(in srgb, var(--dsw-alias-state-warning-primary, #d97706) 12%, transparent)", border: "1px solid color-mix(in srgb, var(--dsw-alias-state-warning-primary, #d97706) 30%, transparent)" },
      doctorList: { margin: "6px 0 0", paddingLeft: "18px", display: "flex", flexDirection: "column", gap: "3px" },
      doctorItem: { color: "var(--dsw-alias-label-secondary)", fontSize: "12.5px", lineHeight: "1.5", wordBreak: "break-all" },
      toast: { position: "fixed", left: "50%", bottom: "28px", transform: "translateX(-50%)", zIndex: 500, background: "var(--dsw-alias-bg-layer-3)", color: "var(--dsw-alias-label-primary)", border: "1px solid var(--dsw-alias-border-l2)", borderRadius: "999px", padding: "9px 16px", fontSize: "13px", boxShadow: "0 10px 30px rgba(0,0,0,.35)", maxWidth: "80vw" },
    };

    const INV = {
      "model-and-user": { style: s.badgeAuto, labelKey: "modelAndUser", explainKey: "autoExplain" },
      "user-only": { style: s.badgeManual, labelKey: "userOnly", explainKey: "manualExplain" },
      "model-only": { style: s.badgeModel, labelKey: "modelOnly", explainKey: "modelExplain" },
    };

    function Btn({ onClick, primary, danger, disabled, style, children }) {
      return react.createElement("button", {
        type: "button",
        onClick: disabled ? undefined : onClick,
        disabled,
        style: Object.assign({}, primary ? s.btnPrimary : danger ? s.btnDanger : s.btn, disabled ? s.btnDisabled : {}, style || {}),
      }, children);
    }

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
      const [confirmUninstall, setConfirmUninstall] = react.useState(false);
      const [toast, setToast] = react.useState(null);
      const [busy, setBusy] = react.useState(null); // "uninstall" | "update"
      const [install, setInstall] = react.useState(null);
      const [doctor, setDoctor] = react.useState(null);
      const [filtersOpen, setFiltersOpen] = react.useState(false);
      const contentRef = react.useRef(null);

      // List loader: re-runs whenever `request` increments.
      react.useEffect(() => {
        let current = true;
        fetch("/api/skill-console/list", { credentials: "include" }).then((response) => response.json()).then((payload) => {
          if (!current) return;
          if (payload && payload.ok === true && Array.isArray(payload.skills)) setState({ status: "ready", skills: payload.skills });
          else setState({ status: "error" });
        }).catch(() => { if (current) setState({ status: "error" }); });
        return () => { current = false; };
      }, [request]);

      const load = react.useCallback(() => { setState({ status: "loading" }); setRequest((v) => v + 1); }, []);

      // Toast auto-dismiss.
      react.useEffect(() => {
        if (!toast) return;
        const id = setTimeout(() => setToast(null), 2600);
        return () => clearTimeout(id);
      }, [toast]);

      // Reset the two-step uninstall confirm whenever the drawer target changes.
      react.useEffect(() => { setConfirmUninstall(false); }, [selected]);

      const api = react.useCallback(async (path, body) => {
        const res = await fetch(path, {
          method: body ? "POST" : "GET",
          credentials: "include",
          headers: body ? { "content-type": "application/json" } : undefined,
          body: body ? JSON.stringify(body) : undefined,
        });
        const data = await res.json().catch(() => null);
        if (!data || data.ok !== true) throw new Error(data && data.error ? data.error : "HTTP " + res.status);
        return data;
      }, []);

      // ---- derived list data ----
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
      const autoCount = skills.filter((sk) => sk.invocation === "model-and-user").length;

      // Pin the list to an EXACT height so the panel is the same size no matter
      // how many cards matched. `maxHeight` alone was not enough: with only one
      // or two cards the list stayed short, while the empty state was stretched
      // to `avail`, so the panel height still tracked the result count. That
      // toggled the outer scrollbar, which narrowed the full-width header by the
      // ~15px scrollbar width and shifted the whole header row — the remaining
      // half of "顶部技能库那一栏会缩小" after the wrap fix. Pinning minHeight as
      // well makes the outer scrollbar state constant, so the header never moves.
      react.useLayoutEffect(() => {
        const el = contentRef.current;
        if (!el) return;
        const measure = () => {
          const rect = el.getBoundingClientRect();
          const avail = Math.max(200, window.innerHeight - rect.top - 32);
          el.style.maxHeight = avail + "px";
          el.style.minHeight = avail + "px";
        };
        measure();
        window.addEventListener("resize", measure);
        return () => window.removeEventListener("resize", measure);
      }, [filtered, state, query, excluded, invocation, sort]);

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

      // ---- management actions ----
      const doUninstall = async () => {
        if (!selected) return;
        if (!confirmUninstall) { setConfirmUninstall(true); return; }
        setBusy("uninstall");
        try {
          await api("/api/skill-console/uninstall", { name: selected.name });
          setToast(t("uninstalled").replace("{name}", selected.name));
          setSelected(null);
          load();
        } catch (error) {
          setToast(t("uninstallFailed") + error.message);
        } finally {
          setBusy(null);
        }
      };

      const doUpdate = async () => {
        if (busy === "update") return;
        setBusy("update");
        try {
          const r = await api("/api/skill-console/update", {});
          setToast(r.before === r.after ? t("updateUpToDate").replace("{rev}", r.after) : t("updatedTo").replace("{rev}", r.after));
          load();
        } catch (error) {
          setToast(t("updateFailed") + error.message);
        } finally {
          setBusy(null);
        }
      };

      const openInstall = () => setInstall({ step: "source", source: "", error: null });

      const previewInstall = async () => {
        const source = install.source.trim();
        if (!source) { setInstall({ ...install, error: t("needSource") }); return; }
        setInstall({ step: "loading", source, error: null });
        try {
          const r = await api("/api/skill-console/install/preview", { source });
          setInstall({ step: "preview", source, repo: r.repo, skills: r.skills, selected: new Set(), error: null });
        } catch (error) {
          setInstall({ step: "source", source, error: error.message });
        }
      };

      const toggleInstallSkill = (name) => {
        setInstall((prev) => {
          const sel = new Set(prev.selected);
          if (sel.has(name)) sel.delete(name); else sel.add(name);
          return { ...prev, selected: sel };
        });
      };

      const toggleAll = () => {
        setInstall((prev) => {
          const names = prev.skills.filter((sk) => !sk.installed).map((sk) => sk.name);
          const allSelected = names.length > 0 && names.every((n) => prev.selected.has(n));
          return { ...prev, selected: allSelected ? new Set() : new Set(names) };
        });
      };

      const doInstall = async () => {
        const names = Array.from(install.selected);
        if (names.length === 0) { setInstall({ ...install, error: t("needSelect") }); return; }
        setInstall({ ...install, step: "installing", error: null });
        try {
          const r = await api("/api/skill-console/install", { source: install.source, names });
          let msg = t("installResult").replace("{n}", String(r.installed.length));
          if (r.conflicts.length) msg += t("conflictsSuffix").replace("{n}", String(r.conflicts.length));
          if (r.missing.length) msg += t("missingSuffix").replace("{n}", String(r.missing.length));
          setInstall(null);
          setToast(msg);
          load();
        } catch (error) {
          setInstall({ ...install, step: "preview", error: error.message });
        }
      };

      const openDoctor = async () => {
        setDoctor("loading");
        try {
          const r = await api("/api/skill-console/doctor");
          setDoctor(r);
        } catch (error) {
          setDoctor({ error: error.message });
        }
      };

      // ---- render pieces ----
      const activeFilterCount = excluded.size + (invocation !== "all" ? 1 : 0) + (sort !== "name" ? 1 : 0);

      const renderHeader = () => react.createElement("header", { style: s.headerRow },
        react.createElement("div", { style: s.headerLead },
          react.createElement("h1", { style: s.title }, t("title")),
          react.createElement("p", { style: s.subtitle }, t("subtitle"))
        ),
        react.createElement("div", { style: s.headerActions },
          react.createElement(Btn, { onClick: () => setFiltersOpen(true) }, activeFilterCount > 0 ? t("filter") + " (" + activeFilterCount + ")" : t("filter")),
          react.createElement(Btn, { disabled: busy === "update", onClick: doUpdate }, busy === "update" ? t("updating") : t("update")),
          react.createElement(Btn, { onClick: openDoctor }, t("doctor")),
          react.createElement(Btn, { primary: true, onClick: openInstall }, t("install"))
        )
      );

      const renderHero = () => react.createElement("div", { style: s.hero },
        react.createElement("div", { style: s.heroSearch },
          react.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, style: s.heroIcon },
            react.createElement("circle", { cx: 11, cy: 11, r: 7 }),
            react.createElement("path", { d: "M20 20l-3.2-3.2", strokeLinecap: "round" })
          ),
          react.createElement("input", { type: "search", value: query, placeholder: t("search"), "aria-label": t("search"), style: s.heroInput, onChange: (e) => setQuery(e.currentTarget.value) })
        ),
        react.createElement("p", { style: s.caption }, t("statsCaption").replace("{n}", skills.length).replace("{s}", facets.length).replace("{a}", autoCount))
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

      const renderFilterPanel = () => {
        if (!filtersOpen) return null;
        return react.createElement("div", null,
          react.createElement("div", { style: s.scrim, onClick: () => setFiltersOpen(false) }),
          react.createElement("aside", { style: s.filterPanel, role: "dialog", "aria-label": t("filter") },
            react.createElement("div", { style: s.filterPanelHead },
              react.createElement("h2", { style: s.filterPanelTitle }, t("filter")),
              react.createElement(Btn, { onClick: () => setFiltersOpen(false), "aria-label": t("close") }, "✕")
            ),
            react.createElement("div", { style: s.filterPanelBody },
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
            ),
            react.createElement("div", { style: s.filterPanelFoot },
              react.createElement(Btn, { style: { width: "100%" }, onClick: clearFilters }, t("clearFilters"))
            )
          )
        );
      };

      const renderCard = (skill) => react.createElement("article", {
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
      );

      const renderBody = () => {
        if (filtered.length > 0) {
          return react.createElement("div", { ref: contentRef, style: s.grid }, filtered.map(renderCard));
        }
        const noSkills = skills.length === 0;
        return react.createElement("div", { ref: contentRef, style: s.empty },
          react.createElement("div", { style: s.emptyGlyph }, noSkills ? "🧩" : "🔍"),
          noSkills ? t("empty") : t("emptySearch"),
          noSkills ? null : react.createElement("div", { style: { marginTop: "16px" } },
            react.createElement(Btn, { onClick: clearFilters }, t("clearFilters"))
          )
        );
      };

      const renderDrawer = () => {
        if (!selected) return null;
        return react.createElement("div", null,
          react.createElement("div", { style: s.backdrop, onClick: () => setSelected(null) }),
          react.createElement("aside", { style: s.drawer, role: "dialog", "aria-label": selected.name },
            react.createElement("div", { style: s.drawerHead },
              react.createElement("span", { style: Object.assign({}, s.monogram, { background: monogramColor(selected.name) }) }, monogram(selected.name)),
              react.createElement("div", { style: { flex: 1, minWidth: 0 } },
                react.createElement("div", { style: s.drawerTitle }, selected.name),
                react.createElement("div", { style: { marginTop: "6px" } }, react.createElement(InvocationBadge, { invocation: selected.invocation, t }))
              ),
              react.createElement(Btn, { onClick: () => setSelected(null), "aria-label": t("close") }, "✕")
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
              )
            ),
            react.createElement("div", { style: s.drawerFoot },
              react.createElement(Btn, { primary: true, style: { flex: 1 }, onClick: () => doCopy(selected.name) },
                copied ? t("copied") + " ✓" : t("copyInvoke").replace("{name}", "/" + selected.name)
              ),
              react.createElement(Btn, { danger: true, disabled: busy === "uninstall", onClick: doUninstall },
                busy === "uninstall" ? t("uninstalling") : confirmUninstall ? t("confirmUninstall") : t("uninstall")
              ),
              react.createElement(Btn, { onClick: () => setSelected(null) }, t("close"))
            )
          )
        );
      };

      const renderInstallModal = () => {
        if (!install) return null;
        const lock = install.step === "loading" || install.step === "installing";
        let body = null;
        let foot = null;

        if (install.step === "source") {
          body = [
            react.createElement("div", { key: "field" },
              react.createElement("p", { style: s.fieldLabel }, t("sourceLabel")),
              react.createElement("input", {
                autoFocus: true, type: "text", value: install.source,
                placeholder: "https://github.com/org/repo.git", "aria-label": t("sourceLabel"),
                style: Object.assign({}, s.input, { marginTop: "8px" }),
                onChange: (e) => setInstall({ ...install, source: e.currentTarget.value }),
                onKeyDown: (e) => { if (e.key === "Enter") previewInstall(); },
              }),
              react.createElement("p", { style: Object.assign({}, s.hint, { marginTop: "8px" }) }, t("sourceHint"))
            ),
            install.error ? react.createElement("p", { key: "err", style: s.errorLine, role: "alert" }, install.error) : null,
          ];
          foot = [
            react.createElement(Btn, { key: "close", onClick: () => setInstall(null) }, t("close")),
            react.createElement(Btn, { key: "go", primary: true, onClick: previewInstall }, t("preview")),
          ];
        } else if (install.step === "loading") {
          body = react.createElement("p", { style: s.status }, t("previewing"));
        } else if (install.step === "installing") {
          body = react.createElement("p", { style: s.status }, t("installing"));
        } else {
          // preview
          const installable = install.skills.filter((sk) => !sk.installed);
          const allSelected = installable.length > 0 && installable.every((s) => install.selected.has(s.name));
          body = [
            install.skills.length === 0
              ? react.createElement("p", { key: "empty", style: s.status }, t("noSkills"))
              : react.createElement("div", { key: "list", style: s.installList },
                  install.skills.map((skill) => {
                    const checked = skill.installed || install.selected.has(skill.name);
                    return react.createElement("label", { key: skill.name, style: s.installItem, "data-sc": "opt" },
                      react.createElement("input", { type: "checkbox", checked, disabled: skill.installed, onChange: () => toggleInstallSkill(skill.name), style: s.checkbox }),
                      react.createElement("div", { style: s.installItemMain },
                        react.createElement("div", { style: s.installItemRow },
                          react.createElement("span", { style: s.installItemName }, skill.name),
                          skill.installed ? react.createElement("span", { style: Object.assign({}, s.tag, s.tagInstalled) }, t("installedTag")) : null,
                          skill.userOnly ? react.createElement("span", { style: Object.assign({}, s.tag, s.tagUserOnly) }, t("userOnlyTag")) : null
                        ),
                        react.createElement("p", { style: s.installItemDesc }, skill.description || "")
                      )
                    );
                  })
                ),
            install.error ? react.createElement("p", { key: "err", style: s.errorLine, role: "alert" }, install.error) : null,
          ];
          foot = [
            react.createElement(Btn, { key: "back", onClick: () => setInstall({ ...install, step: "source", error: null }) }, t("back")),
            react.createElement(Btn, {
              key: "toggle", onClick: toggleAll,
              disabled: installable.length === 0,
            }, allSelected ? t("selectNone") : t("selectAll")),
            react.createElement(Btn, { key: "go", primary: true, disabled: install.selected.size === 0, onClick: doInstall },
              t("installSelected").replace("{n}", String(install.selected.size))
            ),
          ];
        }

        return react.createElement("div", { style: s.modalBackdrop, onClick: () => { if (!lock) setInstall(null); } },
          react.createElement("div", { style: s.modal, role: "dialog", "aria-label": t("installTitle"), onClick: (e) => e.stopPropagation() },
            react.createElement("div", { style: s.modalHead },
              react.createElement("h2", { style: s.modalTitle }, t("installTitle")),
              react.createElement(Btn, { onClick: () => { if (!lock) setInstall(null); }, "aria-label": t("close") }, "✕")
            ),
            react.createElement("div", { style: s.modalBody }, body),
            foot ? react.createElement("div", { style: s.modalFoot }, foot) : null
          )
        );
      };

      const renderDoctorModal = () => {
        if (!doctor) return null;
        const section = (label, items) => react.createElement("section", { key: label },
          react.createElement("p", { style: s.drawerSectionLabel }, label),
          items.length === 0
            ? react.createElement("p", { style: s.hint, marginTop: "6px" }, t("noneFound"))
            : react.createElement("ul", { style: s.doctorList }, items.map((it) => react.createElement("li", { key: it, style: s.doctorItem }, it)))
        );

        let body;
        if (doctor === "loading") {
          body = react.createElement("p", { style: s.status }, t("checking"));
        } else if (doctor.error) {
          body = react.createElement("p", { style: s.errorLine, role: "alert" }, doctor.error);
        } else {
          const problems = doctor.dead.length + doctor.invalid.length + doctor.orphans.length;
          body = [
            react.createElement("p", { key: "total", style: s.fieldLabel }, t("totalSkills").replace("{n}", String(doctor.total))),
            section(t("deadLinks"), doctor.dead),
            section(t("invalidFm"), doctor.invalid),
            section(t("orphanMirrors"), doctor.orphans),
            react.createElement("p", {
              key: "summary", style: Object.assign({}, s.fieldLabel, problems > 0 ? { color: "var(--dsw-alias-state-warning-primary, #d97706)" } : {}),
            }, problems === 0 ? t("allClean") : t("problemsFound").replace("{n}", String(problems))),
          ];
        }

        return react.createElement("div", { style: s.modalBackdrop, onClick: () => setDoctor(null) },
          react.createElement("div", { style: s.modal, role: "dialog", "aria-label": t("doctorTitle"), onClick: (e) => e.stopPropagation() },
            react.createElement("div", { style: s.modalHead },
              react.createElement("h2", { style: s.modalTitle }, t("doctorTitle")),
              react.createElement(Btn, { onClick: () => setDoctor(null), "aria-label": t("close") }, "✕")
            ),
            react.createElement("div", { style: s.modalBody }, body),
            react.createElement("div", { style: s.modalFoot }, react.createElement(Btn, { onClick: () => setDoctor(null) }, t("close")))
          )
        );
      };

      const content = state.status === "loading"
        ? react.createElement("p", { style: s.status }, t("loading"))
        : state.status === "error"
          ? react.createElement("div", { style: s.failure },
              react.createElement("p", { role: "alert", style: { margin: 0 } }, t("error")),
              react.createElement(Btn, { onClick: load }, t("retry")))
          : renderBody();

      const toastNode = toast
        ? react.createElement("div", { style: s.toast, role: "status" }, toast)
        : null;

      return react.createElement("div", { style: s.root, "aria-busy": state.status === "loading" },
        renderHeader(),
        renderHero(),
        content,
        renderDrawer(),
        renderInstallModal(),
        renderDoctorModal(),
        renderFilterPanel(),
        toastNode
      );
    }

    // Sidebar glyph. Prefers the bundled Fluent icon; falls back to an inline
    // sparkle so the entry still renders without the primitives package.
    function SkillsPanelIcon({ size }) {
      if (SkillIcon) return react.createElement(SkillIcon, { size });
      return react.createElement("svg", { viewBox: "0 0 20 20", width: size, height: size, "aria-hidden": true, fill: "currentColor" },
        react.createElement("path", { d: "M10 2l1.85 5.35L17 9.2l-5.15 1.85L10 16.4l-1.85-5.35L3 9.2l5.15-1.85L10 2z" })
      );
    }

    // Main-view panel content: a fixed-height, internally-scrolling column so
    // the outer viewport never changes size when the result list grows/shrinks.
    function PanelPage(props) {
      return react.createElement("div", { style: { padding: "24px 28px", maxWidth: "1280px", margin: "0 auto", height: "100%", boxSizing: "border-box", overflow: "hidden" } },
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

      // Main-view panel content (filter sidebar + card gallery + management).
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
