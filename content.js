(() => {
  "use strict";

  if (window.__gpreContentLoaded) return;
  window.__gpreContentLoaded = true;
  console.log("[gpr-review-enhancer] content script loaded on", location.pathname);

  const GROUP = "data-gpre";
  const STATE = "data-gpre-state";
  const HIDDEN = "data-gpre-hidden";
  const SIDE = "data-gpre-side";
  const FIRST = "data-gpre-first";

  // Survives virtualized re-creation of rows: keys of blocks the user expanded.
  const expandedKeys = new Set();

  let groupSeq = 0;

  function isPrPage() {
    return /^\/[^/]+\/[^/]+\/pull\/\d+/.test(location.pathname);
  }

  /* ---------- language rules ---------- */

  // Rule factories. Only *whole-line* comments count: text.trim() must start
  // with a marker — that is what makes trailing comments, URLs and strings
  // immune regardless of language.
  const R = {
    C: () => ({ lines: ["//"], blocks: [["/*", "*/"]] }), // c-family
    LINEONLY_C: () => ({ lines: ["//"], blocks: [] }), // zig, d…
    CSS: () => ({ lines: [], blocks: [["/*", "*/"]] }),
    HASH: () => ({ lines: ["#"], blocks: [] }), // py rb sh yaml toml…
    HASH_C: () => ({ lines: ["#", "//"], blocks: [["/*", "*/"]] }), // hcl tf
    HASH_CS: () => ({ lines: ["#"], blocks: [["/*", "*/"]] }), // ps1: <# #> too (rare)
    DASH2: () => ({ lines: ["--"], blocks: [] }), // sql lua haskell ada…
    SEMI: () => ({ lines: [";"], blocks: [] }), // lisp family
    PCT: () => ({ lines: ["%"], blocks: [] }), // latex erlang
    QUOTE: () => ({ lines: ["'"], blocks: [] }), // vb, plantuml
    DQ: () => ({ lines: ['"'], blocks: [] }), // vimscript
    BANG: () => ({ lines: ["!"], blocks: [] }), // fortran, xresources
    HTML: () => ({ lines: [], blocks: [["<!--", "-->"]] }),
    OCAML: () => ({ lines: [], blocks: [["(*", "*)"]] }),
    PASCAL: () => ({ lines: ["//"], blocks: [["{", "}"], ["(*", "*)"]] }),
    CPLUS_HTML: () => ({ lines: ["//"], blocks: [["/*", "*/"], ["<!--", "-->"]] }), // vue/svelte/astro
    TWO_PCT: () => ({ lines: ["%%"], blocks: [] }), // mermaid
    COLONCOLON: () => ({ lines: ["::"], blocks: [] }), // batch remarks
    NONE: () => ({ lines: [], blocks: [] }),
  };

  const EXT_RULES = {
    // C-family
    js: R.C, jsx: R.C, mjs: R.C, cjs: R.C, ts: R.C, tsx: R.C, mts: R.C, cts: R.C,
    java: R.C, kt: R.C, kts: R.C, scala: R.C, cs: R.C, c: R.C, h: R.C, cc: R.C,
    cpp: R.C, hpp: R.C, hxx: R.C, cxx: R.C, go: R.C, rs: R.C, swift: R.C,
    dart: R.C,     groovy: R.C, gradle: R.C, sol: R.C, hx: R.C, as: R.C, pde: R.C,
    ino: R.C, v: R.C, sv: R.C, d: R.C, vala: R.C, vapi: R.C, pony: R.C, m: R.C,
    php: () => ({ lines: ["//", "#"], blocks: [["/*", "*/"]] }),
    mm: R.C, glsl: R.C, frag: R.C, vert: R.C, gdshader: R.C,
    moon: R.C, gleam: R.C, bicep: R.C, prisma: R.C, pkl: R.C, gml: R.C,
    modulemap: R.C,
    // C-family without block comments
    zig: R.LINEONLY_C,
    // CSS block-only
    css: R.CSS, postcss: R.CSS,
    scss: R.C, sass: R.C, less: R.C, styl: R.C, stylus: R.C,
    // hash family
    py: R.HASH, pyi: R.HASH, pyw: R.HASH, pyx: R.HASH, pxd: R.HASH, rb: R.HASH,
    rake: R.HASH, gemspec: R.HASH, podspec: R.HASH, irbrc: R.HASH,
    sh: R.HASH, bash: R.HASH, zsh: R.HASH, ksh: R.HASH, tcsh: R.HASH, csh: R.HASH,
    fish: R.HASH, nu: R.HASH, pl: R.HASH, pm: R.HASH, t: R.HASH, r: R.HASH,
    jl: R.HASH, ex: R.HASH, exs: R.HASH, cri: R.HASH, cr: R.HASH, nim: R.HASH,
    nimble: R.HASH, nims: R.HASH, yml: R.HASH, yaml: R.HASH, toml: R.HASH,
    lock: R.HASH, graphql: R.HASH, gql: R.HASH, nix: R.HASH, mk: R.HASH,
    gn: R.HASH, gni: R.HASH, bzl: R.HASH, bazel: R.HASH,
    gd: R.HASH, tres: R.HASH, tscn: R.HASH, tcl: R.HASH,
    awk: R.HASH, vy: R.HASH, roc: R.HASH, pot: R.HASH, po: R.HASH,
    // dotfiles whose basename parses to an "extension"
    gitignore: R.HASH, gitattributes: R.HASH, gitmodules: R.HASH,
    gitconfig: R.HASH, npmrc: R.HASH, yarnrc: R.HASH, dockerignore: R.HASH,
    editorconfig: R.HASH, env: R.HASH, bashrc: R.HASH, bashprofile: R.HASH,
    bash_logout: R.HASH, zshrc: R.HASH, zprofile: R.HASH, zshenv: R.HASH,
    profile: R.HASH, inputrc: R.HASH, curlrc: R.HASH, gemrc: R.HASH,
    // hash + c-family (hcl / terraform)
    tf: R.HASH_C, tfvars: R.HASH_C, hcl: R.HASH_C, nomad: R.HASH_C,
    // powershell (also <# #> block comments — rare, not matched)
    ps1: R.HASH_CS, psm1: R.HASH_CS, psd1: R.HASH_CS,
    // ini/cfg/properties
    ini: R.HASH, cfg: R.HASH, conf: R.HASH, properties: R.HASH,
    // dash-dash
    sql: R.DASH2, mysql: R.DASH2, psql: R.DASH2, plsql: R.DASH2,
    lua: R.DASH2, hs: R.DASH2, lhs: R.DASH2, purs: R.DASH2, elm: R.DASH2,
    idr: R.DASH2, agda: R.DASH2, lean: R.DASH2, ada: R.DASH2, ads: R.DASH2,
    adb: R.DASH2, vhdl: R.DASH2, vhd: R.DASH2, cabal: R.DASH2,
    // semicolon (lisp family + a few)
    lisp: R.SEMI, el: R.SEMI, scm: R.SEMI, ss: R.SEMI, rkt: R.SEMI,
    clj: R.SEMI, cljs: R.SEMI, cljc: R.SEMI, edn: R.SEMI, lsp: R.SEMI,
    asm: R.SEMI, s: R.SEMI, wat: R.SEMI, wast: R.SEMI,
    ahk: R.SEMI,
    // percent (latex / erlang)
    tex: R.PCT, sty: R.PCT, cls: R.PCT, dtx: R.PCT, ltx: R.PCT, bib: R.PCT,
    erl: R.PCT, hrl: R.PCT,
    // quotes
    vb: R.QUOTE, bas: R.QUOTE, frm: R.QUOTE, puml: R.QUOTE, plantuml: R.QUOTE,
    // double quote (vimscript)
    vim: R.DQ, vimrc: R.DQ, gvimrc: R.DQ,
    // bang
    f: R.BANG, for: R.BANG, f77: R.BANG, f90: R.BANG, f95: R.BANG,
    f03: R.BANG, f08: R.BANG, xresources: R.BANG, xdefaults: R.BANG,
    // html comment style
    html: R.HTML, htm: R.HTML, xhtml: R.HTML, xml: R.HTML, xsd: R.HTML,
    xsl: R.HTML, svg: R.HTML, plist: R.HTML, resx: R.HTML, md: R.HTML,
    markdown: R.HTML, mdx: R.HTML,
    // ocaml style
    ml: R.OCAML, mli: R.OCAML,
    fs: R.C, fsi: R.C, fsx: R.C, // F# uses // primarily
    // pascal
    pas: R.PASCAL, dpr: R.PASCAL, dpk: R.PASCAL, lpr: R.PASCAL, inc: R.PASCAL,
    // mixed template/script
    vue: R.CPLUS_HTML, svelte: R.CPLUS_HTML, astro: R.CPLUS_HTML,
    // pug family
    pug: R.LINEONLY_C, jade: R.LINEONLY_C,
    // coffeescript
    coffee: R.C, cjsx: R.C, iced: R.C,
    // mermaid
    mmd: R.TWO_PCT, mermaid: R.TWO_PCT,
    // batch
    bat: R.COLONCOLON, cmd: R.COLONCOLON,
    // erlang-ish prolog (both markers are safe: # never, % yes; qmake #; take both)
    pro: () => ({ lines: ["%", "#"], blocks: [["/*", "*/"]] }),
    // template DSLs
    twig: () => ({ lines: [], blocks: [["{#", "#}"]] }),
    ejs: () => ({ lines: [], blocks: [["<%#", "%>"]] }),
    erb: () => ({ lines: [], blocks: [["<%#", "%>"]] }),
    // formats without comments — never collapse
    json: R.NONE, jsonl: R.NONE, ndjson: R.NONE, ipynb: R.NONE,
    csv: R.NONE, tsv: R.NONE, txt: R.NONE, text: R.NONE, log: R.NONE,
    rst: R.NONE, rest: R.NONE, org: R.NONE, tfstate: R.NONE,
    hbs: R.NONE, mustache: R.NONE, handlebars: R.NONE, liquid: R.NONE,
    parquet: R.NONE, avro: R.NONE,
    // json with comments (vscode flavor)
    jsonc: R.C, json5: R.C,
  };

  // GitHub's own language ids (data-tagsearch-lang) and display names.
  const LANG_RULES = {
    javascript: R.C, typescript: R.C, "typescriptreact": R.C,
    javascriptreact: R.C, tsx: R.C, jsx: R.C, java: R.C, csharp: R.C, c: R.C,
    "c++": R.C, "objective-c": R.C, "objective-c++": R.C, go: R.C, rust: R.C,
    kotlin: R.C, swift: R.C, scala: R.C, dart: R.C, groovy: R.C, gradle: R.C,
    solidity: R.C, haxe: R.C, actionscript: R.C, processing: R.C, arduino: R.C,
    glsl: R.C, hlsl: R.C, gdshader: R.C, gleam: R.C, moonbit: R.C, bicep: R.C,
    prisma: R.C, pkl: R.C, vala: R.C, d: R.C, pony: R.C,
    zig: R.LINEONLY_C, scss: R.C, sass: R.C, less: R.C, stylus: R.C,
    postcss: R.CSS, css: R.CSS,
    python: R.HASH, ruby: R.HASH, shell: R.HASH, bash: R.HASH, zsh: R.HASH,
    fish: R.HASH, nushell: R.HASH, tcl: R.HASH, awk: R.HASH, perl: R.HASH,
    r: R.HASH, julia: R.HASH, elixir: R.HASH, crystal: R.HASH, nim: R.HASH,
    nimscript: R.HASH, yaml: R.HASH, toml: R.HASH, graphql: R.HASH,
    nix: R.HASH, makefile: R.HASH, "cmake": R.HASH, gn: R.HASH,
    starlark: R.HASH, dockerfile: R.HASH, gdscript: R.HASH, godot_resource: R.HASH,
    vyper: R.HASH, roc: R.HASH, gettext: R.HASH, properties: R.HASH,
    "gitignore": R.HASH, "gitattributes": R.HASH, "dotenv": R.HASH,
    "editorconfig": R.HASH, ini: R.HASH, powershell: R.HASH_CS,
    pwsh: R.HASH_CS, hcl: R.HASH_C, terraform: R.HASH_C,
    lua: R.DASH2, sql: R.DASH2, "plsql": R.DASH2, haskell: R.DASH2,
    purescript: R.DASH2, elm: R.DASH2, idris: R.DASH2, agda: R.DASH2,
    lean: R.DASH2, ada: R.DASH2, vhdl: R.DASH2, cabal: R.DASH2,
    applescript: () => ({ lines: ["--"], blocks: [["(*", "*)"]] }),
    commonlisp: R.SEMI, "common lisp": R.SEMI, lisp: R.SEMI, scheme: R.SEMI,
    racket: R.SEMI, clojure: R.SEMI, edn: R.SEMI, asm: R.SEMI,
    "x86asm": R.SEMI, "assembly": R.SEMI, wat: R.SEMI,
    "webassembly": R.SEMI, autohotkey: R.SEMI,
    latex: R.PCT, "tex": R.PCT, bibtex: R.PCT, erlang: R.PCT, prolog: R.PCT,
    "visual basic .net": R.QUOTE, vba: R.QUOTE, vb: R.QUOTE, plantuml: R.QUOTE,
    vim: R.DQ, "vim script": R.DQ, fortran: R.BANG, xresources: R.BANG,
    html: R.HTML, xml: R.HTML, markdown: R.HTML, mdx: R.HTML,
    "scalate server page": R.HTML, svg: R.HTML, xslt: R.HTML,
    ocaml: R.OCAML, fsharp: R.C,     pascal: R.PASCAL, delphi: R.PASCAL,
    freebasic: R.QUOTE,
    vue: R.CPLUS_HTML, svelte: R.CPLUS_HTML, astro: R.CPLUS_HTML,
    pug: R.LINEONLY_C, jade: R.LINEONLY_C, coffeescript: R.C,
    mermaid: R.TWO_PCT, "batchfile": R.COLONCOLON, "bat": R.COLONCOLON,
    twig: () => ({ lines: [], blocks: [["{#", "#}"]] }),
    ejs: () => ({ lines: [], blocks: [["<%#", "%>"]] }),
    erb: () => ({ lines: [], blocks: [["<%#", "%>"]] }),
    json: R.NONE, "json with comments": R.C, jsonc: R.C, json5: R.C,
    csv: R.NONE, tsv: R.NONE, "plain text": R.NONE, text: R.NONE,
    jupyter: R.NONE, "restructuredtext": R.NONE, jinja: R.NONE,
    handlebars: R.NONE, mustache: R.NONE, liquid: R.NONE,
  };

  // Extensionless build files matched by basename.
  const BASENAME_RULES = {
    makefile: R.HASH, gnumakefile: R.HASH, "makefile.am": R.HASH,
    dockerfile: R.HASH, containerfile: R.HASH, jenkinsfile: R.C,
    gemfile: R.HASH, rakefile: R.HASH, podfile: R.HASH, capfile: R.HASH,
    vagrantfile: R.HASH, berksfile: R.HASH, buildfile: R.HASH,
    appraisals: R.HASH, procfile: R.NONE, "build": R.HASH, "workspace": R.HASH,
    "workspace.bazel": R.HASH, "bazelrc": R.HASH, "cmakelists.txt": R.HASH,
    "htaccess": R.HASH, "mailmap": R.HASH, "authorepl": R.NONE,
    "dir_colors": R.NONE, "issue": R.NONE,
  };

  function normFileType(fileType) {
    return (fileType || "").toLowerCase().replace(/^\./, "");
  }

  function rulesFor(path, fileType) {
    const ft = normFileType(fileType);
    let ext = "";
    const base = (path || "").split("/").pop().toLowerCase();
    if (ft && ft !== ".") {
      ext = ft;
    } else if (base) {
      const m = base.match(/\.([a-z0-9]+)$/);
      if (m) ext = m[1];
    }

    if (!ext && Object.prototype.hasOwnProperty.call(BASENAME_RULES, base))
      return BASENAME_RULES[base]();
    const byExt = EXT_RULES[ext];
    if (byExt) return byExt();
    if (Object.prototype.hasOwnProperty.call(BASENAME_RULES, base))
      return BASENAME_RULES[base]();
    return R.C();
  }

  function rulesForLang(name) {
    const n = (name || "").toLowerCase().replace(/[\s-]+/g, "");
    const normKeys = Object.keys(LANG_RULES).map((k) => [k, k.toLowerCase().replace(/[\s-]+/g, "")]);
    const hit = normKeys.find(([, nk]) => nk === n);
    if (hit) return LANG_RULES[hit[0]]();
    return R.C();
  }

  function makeClassifier(rules) {
    let inBlock = null;
    return function classify(raw) {
      const t = raw.trim();
      if (inBlock) {
        if (t.includes(inBlock)) inBlock = null;
        return "comment";
      }
      if (!t) return "empty";
      for (const p of rules.lines) {
        if (t.startsWith(p)) return "comment";
      }
      for (const pair of rules.blocks) {
        if (t.startsWith(pair[0])) {
          if (!t.slice(pair[0].length).includes(pair[1])) inBlock = pair[1];
          return "comment";
        }
      }
      return "code";
    };
  }

  /* ---------- DOM helpers ---------- */

  // Classic table diff (td.blob-code) + next-gen React diff (td.diff-text-cell)
  const CELL_SEL = "td.blob-code, td.js-file-line, td.diff-text-cell";
  const INNER_SEL = ".blob-code-inner, .diff-text-inner";

  function cellText(cell) {
    const inner = cell.querySelector(INNER_SEL);
    if (inner) return inner.textContent;
    let t = cell.textContent;
    const marker = cell.querySelector(".diff-text-marker");
    if (marker) {
      const m = marker.textContent;
      if (m && t.startsWith(m)) t = t.slice(m.length);
    }
    return t;
  }

  function findFiles(root) {
    const sel = '[data-details-container-group="file"], div.js-file, div.file';
    const out = [];
    if (root.nodeType === Node.ELEMENT_NODE && root.matches(sel)) out.push(root);
    if (root.querySelectorAll) root.querySelectorAll(sel).forEach((el) => out.push(el));
    return out;
  }


  function fileMeta(fileEl) {
    const header = fileEl.querySelector("[data-path]");
    const path =
      fileEl.getAttribute("data-tagsearch-path") ||
      fileEl.getAttribute("data-path") ||
      (header && header.getAttribute("data-path")) ||
      "";
    const typeEl = fileEl.querySelector("[data-file-type]");
    const fileType =
      fileEl.getAttribute("data-file-type") ||
      (typeEl && typeEl.getAttribute("data-file-type")) ||
      "";
    return { path, fileType };
  }

  function groupRows(firstTr) {
    const id = firstTr.getAttribute(GROUP);
    const scope = firstTr.closest("tbody, table") || document;
    return Array.from(scope.querySelectorAll(`tr[${GROUP}="${id}"]`));
  }

  function headKeyOf(tr) {
    const el = tr.querySelector("[data-diff-line-key]");
    return el ? el.getAttribute("data-diff-line-key") : "";
  }

  function fullTextOf(rows) {
    const lines = [];
    for (const tr of rows) {
      const cell = tr.querySelector(CELL_SEL);
      if (!cell) continue;
      const badge = cell.querySelector(".gpre-badge");
      let t = cellText(cell);
      if (badge) t = t.slice(0, t.length - badge.textContent.length);
      lines.push(t.replace(/\s+$/, ""));
    }
    return lines.join("\n");
  }

  function ensureBadge(tr) {
    const cell = tr.querySelector(CELL_SEL);
    if (!cell) return null;
    const host = cell.querySelector(INNER_SEL) || cell;
    let b = host.querySelector(":scope > .gpre-badge");
    if (!b) {
      b = document.createElement("span");
      b.className = "gpre-badge";
      host.appendChild(b);
    }
    return b;
  }

  function syncBadge(firstTr) {
    const rows = groupRows(firstTr);
    const hidden = Math.max(0, rows.length - 1);
    const collapsed = firstTr.getAttribute(STATE) === "collapsed";
    const badge = ensureBadge(firstTr);
    if (!badge) return;
    badge.textContent = (collapsed ? "+" : "−") + hidden;
    firstTr.setAttribute("aria-expanded", collapsed ? "false" : "true");
    firstTr.title = fullTextOf(rows);
    firstTr.setAttribute(
      "aria-label",
      (collapsed ? "Expand" : "Collapse") +
        ` comment block, ${rows.length} lines. ` +
        fullTextOf(rows).slice(0, 200)
    );
  }

  function setCollapsed(firstTr, collapsed) {
    const key = headKeyOf(firstTr);
    if (key) {
      if (collapsed) expandedKeys.delete(key);
      else expandedKeys.add(key);
    }
    firstTr.setAttribute(STATE, collapsed ? "collapsed" : "expanded");
    for (const tr of groupRows(firstTr)) {
      if (tr === firstTr) continue;
      if (collapsed) tr.setAttribute(HIDDEN, "1");
      else tr.removeAttribute(HIDDEN);
    }
    syncBadge(firstTr);
  }

  function toggleGroup(firstTr) {
    const collapsed = firstTr.getAttribute(STATE) === "collapsed";
    setCollapsed(firstTr, !collapsed);
  }

  function bindFirstRow(tr) {
    if (tr.hasAttribute(FIRST)) return;
    tr.setAttribute(FIRST, "");
    tr.setAttribute("tabindex", "0");
    tr.setAttribute("role", "button");

    tr.addEventListener("click", (e) => {
      if (e.target.closest("button, a, form, textarea, input, select, details, summary")) return;
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) return;
      e.preventDefault();
      e.stopPropagation();
      toggleGroup(tr);
    });
    tr.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        toggleGroup(tr);
      }
    });
  }

  function createGroup(run) {
    const id = "g" + ++groupSeq;
    const head = run[0].tr;
    const key = headKeyOf(head);
    const keepExpanded = key ? expandedKeys.has(key) : false;
    run.forEach((item, i) => {
      const tr = item.tr;
      tr.setAttribute(GROUP, id);
      tr.setAttribute(SIDE, i === 0 ? "head" : "rest");
      if (i === 0) tr.setAttribute(STATE, keepExpanded ? "expanded" : "collapsed");
      else if (!keepExpanded) tr.setAttribute(HIDDEN, "1");
    });
    bindFirstRow(head);
    syncBadge(head);
  }

  /* ---------- scan ---------- */

  const STRUCTURAL = [
    "js-expandable-line",
    "diff-hunk-row",
    "diff-hunk",
  ];

  function isStructural(tr) {
    for (const c of STRUCTURAL) if (tr.classList.contains(c)) return true;
    return !!tr.querySelector(
      "td.blob-code-hunk, td.blob-code-expandable, .diff-hunk-cell, td.diff-hunk"
    );
  }

  function classifyRows(rows, rules) {
    let classifiers = [];
    let run = [];
    const flush = () => {
      if (run.length >= 2) createGroup(run);
      run = [];
      classifiers = [];
    };

    for (const tr of rows) {
      if (tr.hasAttribute(GROUP)) {
        flush();
        continue;
      }
      if (isStructural(tr)) {
        flush();
        continue;
      }
      const cells = tr.querySelectorAll(CELL_SEL);
      if (cells.length === 0) {
        flush();
        continue;
      }
      const kinds = [];
      const texts = [];
      cells.forEach((cell, i) => {
        if (!classifiers[i]) classifiers[i] = makeClassifier(rules);
        const text = cellText(cell);
        texts.push(text);
        kinds.push(classifiers[i](text));
      });
      if (texts.some((t) => t.trim().startsWith("@@"))) {
        flush();
        continue;
      }
      const nonEmpty = kinds.filter((k) => k !== "empty");
      if (nonEmpty.length === 0) {
        flush();
        continue;
      }
      if (nonEmpty.every((k) => k === "comment")) run.push({ tr, texts });
      else flush();
    }
    flush();
  }

  function processFile(fileEl) {
    const { path, fileType } = fileMeta(fileEl);
    classifyRows(Array.from(fileEl.querySelectorAll("tr")), rulesFor(path, fileType));
  }

  function fileKeyOf(tr) {
    const table = tr.closest("table[data-diff-anchor]");
    if (table) {
      const a = table.getAttribute("data-diff-anchor");
      if (a) return a;
    }
    const el = tr.querySelector("[data-line-anchor], [data-grid-cell-id]");
    const v =
      el &&
      (el.getAttribute("data-line-anchor") || el.getAttribute("data-grid-cell-id"));
    const m = v && v.match(/^(diff-[0-9a-zA-Z]+)/);
    return m ? m[1] : "";
  }

  // On the real next-gen DOM the file path lives in the file header, which is
  // a sibling of the rows (both inside div[id="diff-<hash>"]) — not an ancestor
  // — so closest() alone fails. Resolve through the diff wrapper instead:
  // header button[data-file-path] first, then the header title <code> text
  // (may contain invisible LRM/RLM marks — strip them).
  function nextGenPathMeta(sample) {
    const direct = sample.closest(
      "[data-path], [data-file-path], [data-tagsearch-path]"
    );
    if (direct) {
      const p =
        direct.getAttribute("data-path") ||
        direct.getAttribute("data-file-path") ||
        direct.getAttribute("data-tagsearch-path");
      if (p) return { path: p, fileType: direct.getAttribute("data-file-type") || "" };
    }
    const table = sample.closest("table[data-diff-anchor]");
    const anchor = table && table.getAttribute("data-diff-anchor");
    const wrap = anchor && document.getElementById(anchor);
    if (wrap) {
      const el = wrap.querySelector(
        "[data-file-path], [data-tagsearch-path], [data-path]"
      );
      if (el) {
        const p =
          el.getAttribute("data-path") ||
          el.getAttribute("data-file-path") ||
          el.getAttribute("data-tagsearch-path");
        if (p) return { path: p, fileType: el.getAttribute("data-file-type") || "" };
      }
      const title = wrap.querySelector(
        "[data-diff-header-wrapper] h3 code, [data-diff-header-wrapper] code"
      );
      if (title) {
        const p = title.textContent.replace(/[\u200e\u200f\ufeff]/g, "").trim();
        if (p) return { path: p, fileType: "" };
      }
    }
    return null;
  }

  function processNextGenRows() {
    const rows = document.querySelectorAll("tr.diff-line-row");
    if (!rows.length) return;
    const buckets = new Map();
    for (const tr of rows) {
      const k = fileKeyOf(tr) || "?";
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(tr);
    }
    for (const [, bucket] of buckets) {
      const sample = bucket.find((t) => !t.hasAttribute(GROUP));
      let rules = null;
      if (sample) {
        const meta = nextGenPathMeta(sample);
        if (meta) rules = rulesFor(meta.path, meta.fileType);
        if (!rules) {
          const lEl = sample.closest("[data-tagsearch-lang]");
          if (lEl) rules = rulesForLang(lEl.getAttribute("data-tagsearch-lang"));
        }
      }
      classifyRows(bucket, rules || R.C());
    }
  }

  let lastGrouped = -1;

  function scan(root) {
    if (!isPrPage()) return;
    const files = findFiles(root || document);
    files.forEach(processFile);
    processNextGenRows();
    const g = document.querySelectorAll(`tr[${GROUP}]`).length;
    if (g !== lastGrouped) {
      lastGrouped = g;
      console.log(
        "[gpr-review-enhancer] scan: files=",
        files.length,
        "groupedRows=",
        g
      );
    }
  }

  let scanTimer = 0;
  function scheduleScan() {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(() => scan(document), 80);
  }

  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.addedNodes.length > 0) {
        scheduleScan();
        return;
      }
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener("turbo:load", scheduleScan);
  document.addEventListener("turbo:render", scheduleScan);

  scan(document);
})();
