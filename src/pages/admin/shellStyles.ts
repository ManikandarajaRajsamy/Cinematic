// The admin workspace layout and theme (sidebar, top bar, panels, indigo tokens).
// Shared by the admin panel and the delivery partner app so both look the same.
export const adminShellCss = `
        .adm-branch { display: flex; flex-direction: column; gap: 4px; }
        .adm-branch .select { min-width: 220px; padding-top: 8px; padding-bottom: 8px; }
        .admin-head { display: flex; justify-content: space-between; align-items: flex-end; gap: var(--sp-4); flex-wrap: wrap; }
        .admin-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--sp-4); }
        .admin-stat { padding: var(--sp-5); display: flex; flex-direction: column; gap: var(--sp-2); }
        .admin-stat strong { font-family: var(--font-display); font-size: 1.8rem; font-weight: 400; color: var(--accent-gold-bright); }
        .admin-controls { display: flex; gap: var(--sp-3); flex-wrap: wrap; margin-bottom: var(--sp-6); align-items: center; }
        .admin-search { position: relative; flex: 2 1 240px; }
        .admin-search svg { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--text-dim); }
        .admin-search .input { padding-left: 40px; }
        .admin-controls .select { flex: 1 1 180px; width: auto; }
        .admin-table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: var(--radius-md, 12px); }
        .admin-table { width: 100%; border-collapse: collapse; font-size: var(--font-sm); }
        .admin-table th { text-align: left; padding: var(--sp-3) var(--sp-4); font-size: var(--font-xs); letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-dim); font-weight: 600; background: var(--bg-elevated); white-space: nowrap; }
        .admin-table td { padding: var(--sp-3) var(--sp-4); border-top: 1px solid var(--border); vertical-align: middle; }
        .admin-table tr:hover td { background: var(--bg-glass-light); }
        .admin-thumb { width: 44px; height: 44px; border-radius: 8px; object-fit: cover; }
        .admin-variants { display: flex; flex-wrap: wrap; gap: 6px; }
        .stock-toggle { font-size: var(--font-xs); padding: 4px 10px; border-radius: 999px; border: 1px solid var(--border); transition: all var(--t-fast); }
        .stock-toggle.on { border-color: rgba(46, 156, 126,0.45); color: var(--accent-green-bright); }
        .stock-toggle.off { color: #e08c70; border-color: rgba(176,73,47,0.4); text-decoration: line-through; }
        .admin-actions { display: flex; gap: var(--sp-2); justify-content: flex-end; }
        /* partner pickers sit in narrow table cells: keep the names readable */
        .assign-select { width: auto; min-width: 200px; padding: 8px 36px 8px 12px; font-size: var(--font-sm); }
        .admin-empty { padding: var(--sp-12); text-align: center; color: var(--text-dim); }
        .admin-form { padding: var(--sp-6) var(--sp-8) var(--sp-8); display: flex; flex-direction: column; gap: var(--sp-4); }
        .admin-variant-row { display: grid; grid-template-columns: 1fr 1fr auto auto; gap: var(--sp-2); align-items: center; }
        .admin-bars { display: flex; flex-direction: column; gap: var(--sp-3); padding: var(--sp-5); }
        .admin-bar { display: grid; grid-template-columns: 140px 1fr 40px; gap: var(--sp-3); align-items: center; font-size: var(--font-sm); }
        .admin-bar-track { height: 8px; border-radius: 999px; background: var(--bg-elevated); overflow: hidden; }
        .admin-bar-fill { height: 100%; background: linear-gradient(90deg, var(--accent-gold-dim), var(--accent-gold-bright)); border-radius: inherit; transition: width 700ms var(--ease); }
        .adm-hint { font-size: var(--font-xs); color: var(--text-dim); margin: 0 0 12px; }
        .adm-grip { white-space: nowrap; color: var(--text-dim); cursor: grab; }
        .adm-grip svg { display: inline; vertical-align: middle; }
        .adm-icon { padding: 4px; border-radius: 6px; color: var(--text-muted); }
        .adm-icon:hover { background: var(--bg-glass-light); color: var(--text); }
        tr.dragging td { opacity: 0.4; }
        .adm-chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .adm-chip { padding: 6px 12px; border-radius: 999px; border: 1px solid var(--border); font-size: var(--font-sm); }
        .adm-chip.on { background: var(--accent-gold-glow); border-color: var(--border-bright); color: var(--accent-gold-bright); }
        .adm-box { padding: 14px; border: 1px dashed var(--border-strong); border-radius: 12px; gap: 10px; }
        .adm-inline { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .adm-inline .input { flex: 1 1 160px; width: auto; }
        .adm-preview { width: 64px; height: 64px; object-fit: cover; border-radius: 10px; }
        .adm-toggles { display: flex; flex-wrap: wrap; gap: 14px 24px; }
        .adm-toggle { display: inline-flex; align-items: center; gap: 10px; cursor: pointer; font-size: var(--font-sm); position: relative; }
        .adm-toggle input { position: absolute; opacity: 0; pointer-events: none; }
        .adm-toggle-track { width: 38px; height: 22px; border-radius: 999px; background: var(--ink-600); position: relative; transition: background 200ms; flex-shrink: 0; }
        .adm-toggle-track::after { content: ""; position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: var(--text); transition: transform 200ms; }
        .adm-toggle input:checked + .adm-toggle-track { background: var(--accent-gold); }
        .adm-toggle input:checked + .adm-toggle-track::after { transform: translateX(16px); }
        .adm-toggle input:focus-visible + .adm-toggle-track { outline: 2px solid var(--accent-gold-bright); outline-offset: 2px; }
        .adm-toggle small { display: block; color: var(--text-dim); font-size: var(--font-xs); }
        .adm-slab { display: grid; grid-template-columns: 1fr 1fr auto; gap: 8px; align-items: center; }
        .adm-slab-head { font-size: var(--font-xs); color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.08em; }
        .adm-preview-list { list-style: none; display: flex; flex-direction: column; }
        .adm-preview-list li { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border); font-size: var(--font-sm); }
        .adm-diff { font-size: 12px; white-space: normal; word-break: break-word; color: var(--text-muted); }
        .admin-two { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-6); }
        @media (max-width: 900px) { .admin-stats { grid-template-columns: repeat(2, 1fr); } .admin-two { grid-template-columns: 1fr; } }
        @media (max-width: 560px) { .admin-form { padding: var(--sp-5); } .admin-variant-row { grid-template-columns: 1fr 1fr; } .admin-bar { grid-template-columns: 100px 1fr 32px; } }
      
        /* ---------- admin workspace layout ---------- */
        .adx { --ax-bg: #F4F5F7; --ax-surface: #FFFFFF; --ax-side: #FFFFFF; --ax-line: #E9EBEF; --ax-text: #1E2430; --ax-muted: #6B7280; --ax-accent: var(--green); --ax-accent-soft: rgba(0, 91, 79, 0.08);
          --bg-card: var(--ax-surface); --bg-elevated: var(--ax-bg); --text: var(--ax-text); --text-muted: #4B5563; --text-dim: var(--ax-muted); --border: var(--ax-line); --border-strong: #D9DCE2;
          min-height: 100vh; background: var(--ax-bg); color: var(--ax-text); font-family: var(--font-body); }
        .adx.dark { --ax-bg: #12161C; --ax-surface: #1A2028; --ax-side: #161B22; --ax-line: #2A313B; --ax-text: #E6E8EB; --ax-muted: #9AA3AE; --ax-accent-soft: rgba(95, 211, 174, 0.12); --text-muted: #C2C8D0; --border-strong: #3A424D; --bg-sunk: #202731; color-scheme: dark; }
        .adx.dark .input, .adx.dark .select, .adx.dark .textarea { background: #11161C; color: var(--ax-text); }
        .adx-side { position: fixed; inset: 0 auto 0 0; width: 260px; z-index: 60; background: var(--ax-side); border-right: 1px solid var(--ax-line); display: flex; flex-direction: column; transition: width 220ms var(--ease), transform 260ms var(--ease); }
        .adx-logo { height: 72px; display: flex; align-items: center; gap: 12px; padding: 0 22px; border-bottom: 1px solid var(--ax-line); }
        .adx-logo span { display: flex; flex-direction: column; line-height: 1.1; white-space: nowrap; }
        .adx-logo b { font-family: var(--font-display); font-size: 1.3rem; color: var(--ax-text); }
        .adx-logo small { font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--gold); font-weight: 700; }
        .adx-side nav { flex: 1; overflow-y: auto; padding: 14px 12px 24px; }
        .adx-group { display: flex; flex-direction: column; gap: 2px; margin-bottom: 14px; }
        .adx-group-t { padding: 10px 14px 6px; font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ax-muted); white-space: nowrap; }
        .adx-link { position: relative; display: flex; align-items: center; gap: 12px; width: 100%; padding: 10px 14px; border-radius: 10px; font-size: 14px; font-weight: 500; color: var(--ax-text); text-align: left; white-space: nowrap; transition: background var(--t-fast), color var(--t-fast); }
        .adx-link svg { flex-shrink: 0; color: var(--ax-muted); }
        .adx-link:hover { background: var(--ax-accent-soft); }
        .adx-link.on { background: var(--ax-accent-soft); color: var(--ax-accent); font-weight: 600; }
        .adx.dark .adx-link.on { color: #5FD3AE; }
        .adx-link.on svg { color: currentColor; }
        .adx-link.on::before { content: ""; position: absolute; left: -12px; top: 8px; bottom: 8px; width: 3px; border-radius: 0 3px 3px 0; background: currentColor; }
        .adx-link em { margin-left: auto; min-width: 22px; padding: 1px 7px; border-radius: 999px; background: var(--gold); color: #fff; font-style: normal; font-size: 11px; font-weight: 700; text-align: center; }
        .adx-main { margin-left: 260px; min-height: 100vh; display: flex; flex-direction: column; transition: margin 220ms var(--ease); }
        .adx-top { position: sticky; top: 0; z-index: 50; height: 72px; display: flex; align-items: center; gap: 14px; padding: 0 24px; background: var(--ax-surface); border-bottom: 1px solid var(--ax-line); }
        .adx-ic { position: relative; width: 42px; height: 42px; flex-shrink: 0; display: grid; place-items: center; border-radius: 50%; border: 1px solid var(--ax-line); color: var(--ax-text); background: var(--ax-surface); }
        .adx-ic:hover { background: var(--ax-accent-soft); }
        .adx-hello { font-family: var(--font-body); font-size: 17px; font-weight: 600; white-space: nowrap; color: var(--ax-text); }
        .adx-search { position: relative; margin-left: auto; display: flex; align-items: center; gap: 10px; width: min(340px, 30vw); height: 44px; padding: 0 16px; border: 1px solid var(--ax-line); border-radius: 999px; background: var(--ax-bg); color: var(--ax-muted); }
        .adx-search input { flex: 1; min-width: 0; font-size: 14px; color: var(--ax-text); }
        .adx-tools { display: flex; align-items: center; gap: 10px; }
        .adx-branch { height: 42px; padding: 0 34px 0 14px; border: 1px solid var(--ax-line); border-radius: 999px; background: var(--ax-surface) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' fill='none'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236B7280' stroke-width='1.5'/%3E%3C/svg%3E") no-repeat right 14px center; appearance: none; font-size: 13px; color: var(--ax-text); max-width: 200px; }
        .adx-rel { position: relative; }
        .adx-dot { position: absolute; top: 9px; right: 10px; width: 9px; height: 9px; border-radius: 50%; background: var(--gold); box-shadow: 0 0 0 2px var(--ax-surface); }
        .adx-avatar { width: 42px; height: 42px; flex-shrink: 0; border-radius: 50%; display: grid; place-items: center; background: var(--green); color: #fff; }
        .adx-pop { position: absolute; right: 0; top: calc(100% + 10px); z-index: 70; min-width: 240px; padding: 8px; border-radius: 14px; background: var(--ax-surface); border: 1px solid var(--ax-line); box-shadow: 0 18px 50px rgba(17, 24, 39, 0.16); display: flex; flex-direction: column; gap: 2px; animation: scaleIn 160ms var(--ease); }
        .adx-pop button { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 12px; border-radius: 10px; font-size: 14px; color: var(--ax-text); text-align: left; }
        .adx-pop button:hover { background: var(--ax-accent-soft); }
        .adx-pop button.out { color: var(--error); }
        .adx-pop strong { padding: 8px 12px 4px; font-size: 13px; }
        .adx-pop p { padding: 4px 12px 10px; font-size: 13px; color: var(--ax-muted); }
        .adx-found { left: 0; right: auto; width: 100%; list-style: none; }
        .adx-user-h { display: flex; align-items: center; gap: 10px; padding: 8px 10px 12px; margin-bottom: 4px; border-bottom: 1px solid var(--ax-line); }
        .adx-user-h div { display: flex; flex-direction: column; font-size: 14px; }
        .adx-user-h small { color: var(--ax-muted); font-size: 12px; }
        .adx-content { flex: 1; width: 100%; max-width: 1600px; margin: 0 auto; padding: 24px 28px 16px; }
        .adx-head { display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 6px 16px; margin-bottom: 20px; }
        .adx-head h1 { font-family: var(--font-body); font-size: 22px; font-weight: 700; letter-spacing: -0.01em; color: var(--ax-text); }
        .adx-crumb { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--ax-muted); }
        .adx-crumb b { color: var(--ax-accent); font-weight: 600; }
        .adx.dark .adx-crumb b { color: #5FD3AE; }
        .adx-panel { padding: 24px; border-radius: 14px; background: var(--ax-surface); border: 1px solid var(--ax-line); box-shadow: 0 1px 2px rgba(17, 24, 39, 0.04); animation: fadeInUp 220ms var(--ease); }
        .adx-foot { padding: 20px 0 8px; text-align: center; font-size: 12px; color: var(--ax-muted); }
        .adx .card { background: var(--ax-surface); border-color: var(--ax-line); border-radius: 12px; }
        .adx .admin-table-wrap { border-color: var(--ax-line); border-radius: 12px; }
        .adx .admin-table th { background: var(--ax-bg); color: var(--ax-text); font-size: 12px; letter-spacing: 0.04em; text-transform: none; font-weight: 600; padding-block: 14px; }
        .adx .admin-table td { border-top: 1px dashed var(--ax-line); padding-block: 14px; }
        .adx .admin-table tr:hover td { background: var(--ax-accent-soft); }
        .adx .btn-primary { border-radius: 10px; }
        /* desktop: icon-only sidebar */
        .adx.mini .adx-side { width: 78px; }
        .adx.mini .adx-main { margin-left: 78px; }
        .adx.mini .adx-logo span, .adx.mini .adx-group-t, .adx.mini .adx-link span { display: none; }
        .adx.mini .adx-link { justify-content: center; padding-inline: 0; }
        .adx.mini .adx-link em { position: absolute; top: 2px; right: 8px; min-width: 18px; padding: 0 4px; font-size: 10px; }
        .adx.mini .adx-logo { justify-content: center; padding: 0; }
        .adx-scrim { display: none; }
        /* tablets and phones: the sidebar becomes a drawer */
        @media (max-width: 1024px) {
          .adx-side { transform: translateX(-100%); box-shadow: 0 0 60px rgba(0, 0, 0, 0.2); width: 280px !important; }
          .adx.nav-open .adx-side { transform: none; }
          .adx.nav-open .adx-scrim { display: block; position: fixed; inset: 0; z-index: 55; background: rgba(17, 24, 39, 0.45); }
          .adx-main, .adx.mini .adx-main { margin-left: 0; }
          .adx.mini .adx-logo span, .adx.mini .adx-group-t, .adx.mini .adx-link span { display: initial; }
          .adx-search { width: 220px; }
        }
        @media (max-width: 760px) {
          .adx-top { height: 64px; padding: 0 14px; gap: 8px; }
          .adx-hello, .adx-search, .adx-branch { display: none; }
          .adx-tools { margin-left: auto; gap: 8px; }
          .adx-ic, .adx-avatar { width: 40px; height: 40px; }
          .adx-content { padding: 18px 14px 12px; }
          .adx-head { flex-direction: column; align-items: flex-start; }
          .adx-head h1 { font-size: 20px; }
          .adx-panel { padding: 16px; border-radius: 12px; }
          .adx-pop { position: fixed; left: 12px; right: 12px; top: 70px; min-width: 0; }
        }

        /* ================= admin theme =================
           Light grey canvas, white cards, an indigo accent and plain status colours. Every admin screen picks
           this up through the shared tokens and classes below, so the screens stay consistent. */
        html.adx-on body, .adx {
          --ax-bg: #F4F5F7; --ax-surface: #FFFFFF; --ax-line: #E9EBEF; --ax-text: #1E2430; --ax-muted: #6B7280;
          --bg-card: #FFFFFF; --bg-elevated: #F4F5F7; --bg-sunk: #F4F5F7; --text: #1E2430; --text-muted: #4B5563; --text-dim: #6B7280; --border: #E9EBEF; --border-strong: #D9DCE2;
          --green: #5B5FEF; --green-deep: #4549D8; --gold: #FF9F43;
          --accent-gold: #5B5FEF; --accent-gold-bright: #4549D8; --accent-gold-glow: rgba(91, 95, 239, 0.1); --accent-gold-dim: #8B8EF5;
          --accent-green: #28C76F; --accent-green-bright: #1E9E57; --success: #28C76F; --error: #EA5455; --warning: #FF9F43;
          --accent-saffron: #FF9F43; --accent-saffron-bright: #D9770F; --border-bright: rgba(91, 95, 239, 0.45);
          --ax-accent: #5B5FEF; --ax-accent-soft: rgba(91, 95, 239, 0.09);
          --font-display: 'Montserrat', 'DM Sans', system-ui, sans-serif; --font-body: 'Montserrat', 'DM Sans', system-ui, sans-serif; --font-mono: var(--font-body);
          --radius-sm: 8px; --radius-md: 10px; --radius-lg: 12px;
          font-family: var(--font-body); font-size: 14px;
        }
        html.adx-on.adx-dark body { --ax-bg: #12161C; --ax-surface: #1A2028; --ax-line: #2A313B; --ax-text: #E6E8EB; --ax-muted: #9AA3AE; --bg-card: #1A2028; --bg-elevated: #12161C; --bg-sunk: #202731; --text: #E6E8EB; --text-muted: #C2C8D0; --text-dim: #9AA3AE; --border: #2A313B; --border-strong: #3A424D; color-scheme: dark; }
        html.adx-on.adx-dark body, .adx.dark { --ax-accent: #8B8EF5; --ax-accent-soft: rgba(139, 142, 245, 0.14); }
        html.adx-on .adx-link.on, .adx.dark .adx-link.on, .adx .adx-crumb b, .adx.dark .adx-crumb b { color: var(--ax-accent); }
        html.adx-on .adx-avatar { background: var(--ax-accent); }
        html.adx-on .adx-logo small { color: var(--ax-accent); }
        html.adx-on :is(h1, h2, h3, h4) { font-family: var(--font-body); letter-spacing: -0.01em; }
        html.adx-on .title-xl, .adx .title-lg, .adx .title-md { font-family: var(--font-body); font-weight: 700; }
        html.adx-on .label, .adx .eyebrow { font-family: var(--font-body); letter-spacing: 0.04em; text-transform: none; font-size: 12px; font-weight: 600; color: var(--ax-muted); }

        /* buttons */
        html.adx-on .btn { border-radius: 8px; text-transform: none; letter-spacing: 0; font-size: 13px; font-weight: 600; padding: 10px 18px; min-height: 40px; }
        html.adx-on .btn-sm { padding: 7px 12px; min-height: 34px; font-size: 12.5px; }
        html.adx-on .btn-lg { padding: 13px 22px; font-size: 14px; }
        html.adx-on .btn-primary { background: var(--ax-accent); color: #fff; box-shadow: 0 4px 12px rgba(91, 95, 239, 0.25); }
        html.adx-on .btn-primary:hover { background: #4549D8; }
        html.adx-on .btn-ghost { border-color: var(--ax-line); color: var(--ax-text); background: var(--ax-surface); }
        html.adx-on .btn-ghost:hover { background: var(--ax-accent-soft); color: var(--ax-accent); border-color: transparent; }
        html.adx-on .btn-solid { background: var(--ax-accent-soft); color: var(--ax-accent); border-color: transparent; }
        html.adx-on .btn-text { color: var(--ax-accent); }

        /* inputs */
        html.adx-on :is(.input, .select, .textarea) { border-radius: 8px; border-color: var(--ax-line); font-size: 14px; padding: 10px 12px; background-color: var(--ax-surface); }
        html.adx-on :is(.input, .select, .textarea):focus { border-color: var(--ax-accent); box-shadow: 0 0 0 3px rgba(91, 95, 239, 0.15); }
        html.adx-on .select { padding-right: 36px; }
        html.adx-on .admin-search .input { padding-left: 38px; }

        /* status pills: green done, orange waiting, red stopped, indigo in progress */
        html.adx-on .badge { border-radius: 6px; font-size: 11.5px; font-weight: 600; padding: 3px 9px; border: 0; }
        html.adx-on .badge-success { background: rgba(40, 199, 111, 0.14); color: #1E9E57; }
        html.adx-on .badge-saffron { background: rgba(255, 159, 67, 0.16); color: #C9690C; }
        html.adx-on .badge-error { background: rgba(234, 84, 85, 0.13); color: #D63B3C; }
        html.adx-on .badge-gold { background: rgba(91, 95, 239, 0.12); color: #4549D8; }
        html.adx-on .badge:not([class*="badge-"]) { background: var(--ax-bg); color: var(--ax-muted); }

        /* filter chips and tabs: segmented, compact */
        html.adx-on :is(.chip, .adm-chip, .tab) { border-radius: 8px; border: 1px solid var(--ax-line); background: var(--ax-surface); color: var(--ax-text); font-size: 13px; font-weight: 500; padding: 7px 12px; }
        html.adx-on :is(.chip, .adm-chip, .tab):hover { border-color: var(--ax-accent); color: var(--ax-accent); }
        html.adx-on :is(.chip.on, .adm-chip.on, .tab.active) { background: var(--ax-accent); border-color: var(--ax-accent); color: #fff; }
        html.adx-on .chip b { color: inherit; opacity: 0.85; font-family: var(--font-body); }
        html.adx-on .chip.on b { color: #fff; }

        /* toolbars */
        html.adx-on .admin-controls { gap: 10px; margin-bottom: 18px; }

        /* cards, panels and alerts */
        html.adx-on .card { box-shadow: none; }
        html.adx-on .alert { border-radius: 10px; border: 0; background: rgba(234, 84, 85, 0.1); color: #B83233; font-weight: 500; }
        html.adx-on .alert.warn { background: rgba(255, 159, 67, 0.14); color: #A8560A; }
        html.adx-on .adm-hint { color: var(--ax-muted); font-size: 12.5px; }

        /* tables */
        html.adx-on .admin-table { font-size: 13.5px; }
        html.adx-on .admin-table td { color: var(--ax-text); }
        html.adx-on .admin-table a { color: var(--ax-accent); }
        html.adx-on .admin-actions .btn { min-height: 32px; }

        /* phones: table rows become tidy cards with a label column */
        @media (max-width: 700px) {
          html.adx-on .rt tr { border-radius: 12px; padding: 12px 14px; margin-bottom: 12px; background: var(--ax-surface); border: 1px solid var(--ax-line); box-shadow: 0 1px 2px rgba(17, 24, 39, 0.04); }
          html.adx-on .rt td { grid-template-columns: 96px minmax(0, 1fr); padding: 6px 0 !important; font-size: 13.5px; align-items: center; }
          html.adx-on .rt td::before { font-size: 11px; letter-spacing: 0.02em; text-transform: none; font-weight: 600; color: var(--ax-muted); }
          html.adx-on .rt td[data-label=""] { padding-top: 10px !important; margin-top: 4px; border-top: 1px dashed var(--ax-line) !important; }
          html.adx-on .rt .admin-actions { justify-content: flex-start; flex-wrap: wrap; }
          html.adx-on .admin-controls > * { flex: 1 1 100%; }
          html.adx-on .admin-controls .btn { flex: 1 1 auto; }
          html.adx-on .chips { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; padding-bottom: 2px; margin-inline: -16px; padding-inline: 16px; }
          html.adx-on .chips::-webkit-scrollbar { display: none; }
          html.adx-on .chip { flex-shrink: 0; }
          html.adx-on .kv { grid-template-columns: 110px minmax(0, 1fr); }
        }

        /* KPI tiles */
        html.adx-on .kpi { border-radius: 12px; padding: 18px; gap: 4px; border: 1px solid var(--ax-line); }
        html.adx-on .kpi .label { font-size: 13px; color: var(--ax-text); font-weight: 600; }
        html.adx-on .kpi strong { font-family: var(--font-body); font-size: 1.6rem; font-weight: 700; letter-spacing: -0.02em; }
        html.adx-on .delta.up { color: #1E9E57; } .adx .delta.down { color: #D63B3C; }
        html.adx-on .chart-card { border-radius: 12px; border: 1px solid var(--ax-line); }

        /* deliveries board */
        html.adx-on .board-col > h4 { background: var(--ax-bg); border-radius: 8px; font-size: 13px; }
        html.adx-on .board-card { border-radius: 10px; border-color: var(--ax-line); background: var(--ax-surface); }

        /* subscription list rows */
        html.adx-on .sl-row { border-radius: 12px; border-color: var(--ax-line); }
        html.adx-on .sl-row.pending { border-color: #FF9F43; box-shadow: inset 3px 0 0 #FF9F43; }
        html.adx-on .sl-bar span { background: var(--ax-accent); }
        html.adx-on .tpd { border-radius: 12px; }

        /* drawers and dialogs */
        .adx ~ .dr-back .dr-panel, .dr-panel { background: #fff; }
        .modal-panel:has(.admin-form) { border-radius: 14px; }
        .admin-form .btn { border-radius: 8px; }

        /* table / grid and other two-way switches */
        html.adx-on .vt { display: inline-flex; padding: 3px; border: 1px solid var(--ax-line); border-radius: 10px; background: var(--ax-surface); }
        html.adx-on .vt button { display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; color: var(--ax-muted); }
        html.adx-on .vt button.on { background: var(--ax-accent-soft); color: var(--ax-accent); }
        /* drawers and dialogs in the admin theme */
        html.adx-on .dr-panel { background: var(--ax-surface); color: var(--ax-text); border-color: var(--ax-line); box-shadow: -20px 0 60px rgba(17, 24, 39, 0.18); }
        html.adx-on .dr-back { background: rgba(17, 24, 39, 0.45); backdrop-filter: none; }
        html.adx-on .dr-panel header { border-color: var(--ax-line); }
        html.adx-on .dr-panel header h3, html.adx-on .modal-panel .title-lg { font-family: var(--font-body); font-size: 17px; font-weight: 700; }
        html.adx-on .dr-panel header button, html.adx-on .modal-close { border-color: var(--ax-line); background: var(--ax-surface); color: var(--ax-muted); }
        html.adx-on .dr-body > section { padding: 16px; border: 1px solid var(--ax-line); border-radius: 12px; background: var(--ax-surface); }
        html.adx-on .dr-body > section > .label { display: block; margin-bottom: 4px; color: var(--ax-accent); font-weight: 700; }
        html.adx-on .dr-body .kv dd a, html.adx-on .modal-panel .kv dd a { color: var(--ax-accent); }
        html.adx-on .modal-panel { background: var(--ax-surface); color: var(--ax-text); }
        html.adx-on .modal-backdrop { background: rgba(17, 24, 39, 0.45); }
        html.adx-on .cal { grid-template-columns: repeat(auto-fill, minmax(70px, 1fr)); gap: 8px; }
        html.adx-on .cal-day { min-width: 0; padding: 8px 4px; }
        html.adx-on .cal-day span, html.adx-on .cal-day small { font-size: 10.5px; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        /* text never runs into its neighbours: long words wrap, flex and grid children may shrink */
        html.adx-on :is(td, dd, dt, p, li, strong, small, span, a, h1, h2, h3, h4, label) { overflow-wrap: break-word; }
        html.adx-on :is(.kv > *, .tpd-main, .og-who > div, .ot-cust > div, .sl-row > div) { min-width: 0; }
        html.adx-on .kv { align-items: baseline; }
        html.adx-on .cal-day { border-radius: 8px; background: var(--ax-bg); border-color: var(--ax-line); }
        html.adx-on .cal-day.DELIVERED { background: rgba(40, 199, 111, 0.14); border-color: rgba(40, 199, 111, 0.4); }
        html.adx-on .cal-day.FAILED { background: rgba(234, 84, 85, 0.12); border-color: rgba(234, 84, 85, 0.4); }
        html.adx-on .cal-day.PAUSED { background: rgba(255, 159, 67, 0.14); border-color: rgba(255, 159, 67, 0.4); }
        html.adx-on .cal-day.UPCOMING { background: rgba(91, 95, 239, 0.06); border-color: rgba(91, 95, 239, 0.25); }
        html.adx-on .toast { background: #1E2430; font-family: var(--font-body); }
      `;
