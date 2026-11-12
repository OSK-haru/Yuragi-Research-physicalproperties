/* Chip layout: a schematic floor plan with checks computed from the design values. */
(function (YR) {
  'use strict';
  const L = YR.L, esc = YR.fmt.esc, state = YR.state, ui = YR.ui;

  // =====================================================================
  // Superconducting chip.  Drawing units: 1 unit = 10 um, chip 10 x 7 mm.
  // =====================================================================
  const TOPOLOGIES = {
    chain4: { name: ['Chain × 4', '直列 × 4'], pos: [[230, 350], [410, 350], [590, 350], [770, 350]], edges: [[0, 1], [1, 2], [2, 3]], side: [0, 1, 0, 1] },
    grid2x2: { name: ['Grid 2 × 2', '格子 2 × 2'], pos: [[380, 265], [620, 265], [380, 435], [620, 435]], edges: [[0, 1], [2, 3], [0, 2], [1, 3]], side: [0, 0, 1, 1] },
    grid2x3: { name: ['Grid 2 × 3', '格子 2 × 3'], pos: [[260, 265], [500, 265], [740, 265], [260, 435], [500, 435], [740, 435]],
      edges: [[0, 1], [1, 2], [3, 4], [4, 5], [0, 3], [1, 4], [2, 5]], side: [0, 0, 0, 1, 1, 1] }
  };
  const FEED_TOP = 95, FEED_BOTTOM = 605;
  const sc = { topology: 'grid2x3', qubits: [], edges: [], selected: 0, layers: { res: true, ctrl: true, coup: true, jj: true, bridge: true, label: true } };

  function buildSc(topology) {
    const t = TOPOLOGIES[topology];
    sc.topology = topology;
    sc.edges = t.edges.map((e) => e.slice());
    // two-colour the lattice, then stagger within each colour to keep spectators apart
    const colour = new Array(t.pos.length).fill(-1);
    colour[0] = 0;
    for (let pass = 0; pass < t.pos.length; pass++) {
      for (const [a, b] of sc.edges) {
        if (colour[a] >= 0 && colour[b] < 0) colour[b] = 1 - colour[a];
        if (colour[b] >= 0 && colour[a] < 0) colour[a] = 1 - colour[b];
      }
    }
    const seen = [0, 0];
    sc.qubits = t.pos.map((p, i) => {
      const k = seen[colour[i]]++;
      return { x: p[0], y: p[1], side: t.side[i], colour: colour[i], offset: 0.045 * k };
    });
    sc.selected = 0;
  }
  buildSc('grid2x3');

  function qubitFreq(q, d) {
    return d.tr.f01 + (q.colour === 1 ? state.sc.neighbour : 0) + q.offset;
  }

  /** Frequency-collision and spacing checks. The windows are editable defaults, not a cited rule set. */
  const WINDOWS = { degenerate: 0.017, leakage: 0.030, twoPhoton: 0.004, spectator: 0.017 };
  function analyseSc(d) {
    const f = sc.qubits.map((q) => qubitFreq(q, d));
    const alpha = Math.abs(d.tr.alpha);
    const edges = sc.edges.map(([a, b]) => {
      const det = Math.abs(f[a] - f[b]);
      let level = 'ok', why = '';
      if (det < WINDOWS.degenerate) { level = 'bad'; why = L('nearly degenerate', 'ほぼ縮退'); }
      else if (Math.abs(det - alpha) < WINDOWS.leakage) { level = 'bad'; why = L('01–12 resonance', '01–12 共鳴'); }
      else if (Math.abs(det - alpha / 2) < WINDOWS.twoPhoton) { level = 'warn'; why = L('two-photon 02 resonance', '2 光子 02 共鳴'); }
      else if (det > alpha) { level = 'warn'; why = L('outside straddling regime', 'ストラドリング領域の外'); }
      const zz = YR.sc.staticZZ(f[a], d.tr.alpha, f[b], d.tr.alpha, state.sc.j / 1000) * 1e6;
      return { a, b, det, level, why, zz };
    });
    const spect = [];
    for (let i = 0; i < f.length; i++) {
      for (let k = i + 1; k < f.length; k++) {
        const direct = sc.edges.some(([a, b]) => (a === i && b === k) || (a === k && b === i));
        if (direct) continue;
        const shared = sc.qubits.some((_, m) => m !== i && m !== k &&
          sc.edges.some(([a, b]) => (a === i && b === m) || (a === m && b === i)) &&
          sc.edges.some(([a, b]) => (a === k && b === m) || (a === m && b === k)));
        if (shared && Math.abs(f[i] - f[k]) < WINDOWS.spectator) spect.push([i, k]);
      }
    }
    let minDist = Infinity;
    for (let i = 0; i < sc.qubits.length; i++) for (let k = i + 1; k < sc.qubits.length; k++) {
      minDist = Math.min(minDist, Math.hypot(sc.qubits[i].x - sc.qubits[k].x, sc.qubits[i].y - sc.qubits[k].y));
    }
    const res = sc.qubits.map((q, i) => {
      const fr = state.sc.fr + 0.04 * i;
      const lengthMm = YR.sc.resonatorLength(fr, d.line.epsEff, 'quarter');
      const span = q.side === 0 ? (q.y - 44) - (FEED_TOP + 14) : (FEED_BOTTOM - 14) - (q.y + 44);
      const geom = meanderGeom(lengthMm * 100, span);
      return { fr, lengthMm, span, fits: geom.fits, geom };
    });
    return { f, edges, spect, minDistMm: minDist / 100, res };
  }

  function meanderGeom(length, span) {
    const extra = Math.max(0, length - span);
    let n = Math.max(1, Math.ceil((extra / 42 + 1) / 2));
    const amp = extra / (2 * n - 1);
    const pitch = span / (n + 1);
    return { n, amp, pitch, fits: span > 30 && pitch >= 7 };
  }
  function meanderPath(x, y0, dir, span, geom) {
    const pts = [[x, y0]];
    let side = 1, cx = x;
    for (let i = 1; i <= geom.n; i++) {
      const y = y0 + dir * geom.pitch * i;
      pts.push([cx, y]);
      cx = x + side * geom.amp * (i === 1 ? 1 : 1);
      pts.push([cx, y]);
      side = -side;
    }
    const yEnd = y0 + dir * span;
    pts.push([cx, yEnd]);
    pts.push([cx + (cx >= x ? -34 : 34), yEnd]);
    return 'M' + pts.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L');
  }

  const cpw = (d, cls, colour, w) =>
    '<path d="' + d + '" class="' + cls + '" fill="none" stroke="#06090d" stroke-width="' + (w + 7) + '" stroke-linejoin="round" stroke-linecap="round"/>' +
    '<path d="' + d + '" class="' + cls + '" fill="none" stroke="' + colour + '" stroke-width="' + w + '" stroke-linejoin="round" stroke-linecap="round"/>';
  const pad = (x, y, colour) => '<rect x="' + (x - 17) + '" y="' + (y - 17) + '" width="34" height="34" rx="3" fill="#06090d"/><rect x="' + (x - 12) + '" y="' + (y - 12) + '" width="24" height="24" rx="2" fill="' + colour + '"/>';

  function scSvg(opts) {
    opts = opts || {};
    const d = YR.derive.sc();
    const an = analyseSc(d);
    const lay = opts.thumb ? { res: true, ctrl: true, coup: true, jj: true, bridge: true, label: false } : sc.layers;
    const levelColour = { ok: 'var(--s4)', warn: 'var(--warn)', bad: 'var(--bad)' };
    let s = '<svg viewBox="0 0 1000 700" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + esc(L('Superconducting chip floor plan', '超伝導チップの配置図')) + '">' +
      '<rect width="1000" height="700" fill="#080b0f"/>' +
      '<rect x="20" y="20" width="960" height="660" rx="6" fill="#121a24" stroke="var(--line-2)"/>';
    // faint ground-plane grid (flux-trapping holes)
    s += '<defs><pattern id="holes" width="20" height="20" patternUnits="userSpaceOnUse"><rect x="9" y="9" width="2" height="2" fill="#1c2733"/></pattern></defs><rect x="20" y="20" width="960" height="660" rx="6" fill="url(#holes)"/>';

    const usesTop = sc.qubits.some((q) => q.side === 0), usesBottom = sc.qubits.some((q) => q.side === 1);
    if (usesTop) s += cpw('M60 ' + FEED_TOP + ' L940 ' + FEED_TOP, 'feed', 'var(--s2)', 5) + pad(60, FEED_TOP, 'var(--s2)') + pad(940, FEED_TOP, 'var(--s2)');
    if (usesBottom) s += cpw('M60 ' + FEED_BOTTOM + ' L940 ' + FEED_BOTTOM, 'feed', 'var(--s2)', 5) + pad(60, FEED_BOTTOM, 'var(--s2)') + pad(940, FEED_BOTTOM, 'var(--s2)');

    if (lay.coup) {
      an.edges.forEach((e) => {
        const A = sc.qubits[e.a], B = sc.qubits[e.b];
        const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
        const x1 = A.x + ux * 46, y1 = A.y + uy * 46, x2 = B.x - ux * 46, y2 = B.y - uy * 46;
        s += cpw('M' + x1 + ' ' + y1 + ' L' + x2 + ' ' + y2, 'coup', levelColour[e.level], 4);
        // coupling claws
        for (const [cx, cy] of [[x1, y1], [x2, y2]]) {
          s += '<path d="M' + (cx - uy * 11) + ' ' + (cy + ux * 11) + ' L' + (cx + uy * 11) + ' ' + (cy - ux * 11) + '" stroke="' + levelColour[e.level] + '" stroke-width="4" stroke-linecap="round"/>';
        }
        if (lay.label) {
          const vertical = Math.abs(uy) > Math.abs(ux);
          const mx = (x1 + x2) / 2 + (vertical ? 52 : 0), my = (y1 + y2) / 2 + (vertical ? 14 : 0);
          const text = 'ZZ ' + (Math.abs(e.zz) >= 1000 ? (e.zz / 1000).toFixed(1) + ' MHz' : e.zz.toFixed(0) + ' kHz');
          s += '<rect x="' + (mx - 40) + '" y="' + (my - 21) + '" width="80" height="15" rx="3" fill="#080b0f" fill-opacity=".85"/>' +
            '<text x="' + mx + '" y="' + (my - 10) + '" text-anchor="middle" font-size="11" font-family="var(--mono)" fill="' + levelColour[e.level] + '">' + text + '</text>';
        }
      });
    }

    sc.qubits.forEach((q, i) => {
      const dir = q.side === 0 ? -1 : 1;
      const r = an.res[i];
      if (lay.res) s += cpw(meanderPath(q.x, q.y + dir * 44, dir, r.span, r.geom), 'res', r.fits ? 'var(--s5)' : 'var(--bad)', 4);
      if (lay.ctrl) {
        const yPad = q.side === 0 ? 46 : 654;
        const path = 'M' + (q.x + 30) + ' ' + (q.y + dir * 30) + ' L' + (q.x + 76) + ' ' + (q.y + dir * 76) + ' L' + (q.x + 76) + ' ' + yPad;
        s += cpw(path, 'ctrl', 'var(--s3)', 3.5) + pad(q.x + 76, yPad, 'var(--s3)');
        if (lay.bridge) {
          const yb = q.side === 0 ? FEED_TOP : FEED_BOTTOM;
          s += '<rect x="' + (q.x + 76 - 9) + '" y="' + (yb - 4) + '" width="18" height="8" rx="2" fill="#e8eef5"/>';
        }
      }
    });

    sc.qubits.forEach((q, i) => {
      const sel = !opts.thumb && i === sc.selected;
      const cross = 'M' + (q.x - 40) + ' ' + q.y + ' L' + (q.x + 40) + ' ' + q.y + ' M' + q.x + ' ' + (q.y - 40) + ' L' + q.x + ' ' + (q.y + 40);
      s += '<g class="qb" data-q="' + i + '" style="cursor:' + (opts.thumb ? 'default' : 'grab') + '">' +
        (sel ? '<circle cx="' + q.x + '" cy="' + q.y + '" r="60" fill="var(--accent-soft)" stroke="var(--accent)" stroke-dasharray="5 5"/>' : '') +
        '<circle cx="' + q.x + '" cy="' + q.y + '" r="58" fill="transparent"/>' +
        '<path d="' + cross + '" stroke="#06090d" stroke-width="26" stroke-linecap="butt" fill="none"/>' +
        '<path d="' + cross + '" stroke="var(--accent)" stroke-width="11" stroke-linecap="butt" fill="none"/>';
      if (lay.jj) {
        s += '<path d="M' + (q.x - 6) + ' ' + (q.y + 6) + ' L' + (q.x - 20) + ' ' + (q.y + 20) + '" stroke="#06090d" stroke-width="7"/>' +
          '<rect x="' + (q.x - 19) + '" y="' + (q.y + 9) + '" width="9" height="9" fill="#f5f0e6" transform="rotate(45 ' + (q.x - 14.5) + ' ' + (q.y + 13.5) + ')"/>';
      }
      if (lay.label) {
        const lx = q.x - 12, ly = q.y - 26;
        s += '<text x="' + lx + '" y="' + ly + '" text-anchor="end" font-size="13" font-weight="600" font-family="var(--mono)" fill="var(--text)">Q' + i + '</text>' +
          '<text x="' + lx + '" y="' + (ly + 14) + '" text-anchor="end" font-size="11" font-family="var(--mono)" fill="var(--text-2)">' + an.f[i].toFixed(3) + '</text>';
      }
      s += '</g>';
    });
    if (!opts.thumb) s += '<text x="34" y="672" font-size="11" font-family="var(--mono)" fill="var(--text-3)">10 × 7 mm · ' + esc(L('schematic', '模式図')) + '</text>' +
      '<path d="M880 668 h80" stroke="var(--text-3)" stroke-width="2"/><text x="920" y="662" text-anchor="middle" font-size="10" font-family="var(--mono)" fill="var(--text-3)">0.8 mm</text>';
    return s + '</svg>';
  }

  function renderSc(root) {
    const html =
      ui.head(L('Stage 03 · Superconducting', '工程 03 · 超伝導'), L('Chip layout', 'チップレイアウト'),
        L('Place the qubits and allocate their frequencies. Drag a qubit to move it; the resonator lengths, couplings and collision checks follow the design values.',
          '量子ビットを配置し、周波数を割り当てます。量子ビットはドラッグで動かせます。共振器の長さ、結合、衝突の判定は設計値に合わせて変わります。'), 'tools') +
      '<div class="grid g-main">' +
        '<div class="stack"><div class="canvas-wrap" data-out="svg"></div>' +
          '<div class="panel"><div class="panel-head"><h2>' + esc(L('Checks', '検査')) + '</h2><div class="right">' + ui.tag('computed') + ui.tag('schematic') + '</div></div><div class="check-list" data-out="checks"></div>' +
          '<p class="note">' + esc(L('Collision windows are editable defaults modelled on fixed-frequency cross-resonance rules; verify them against the literature before use.',
            '衝突の判定幅は、固定周波数・クロスレゾナンス方式の規則を参考にした既定値です。使う前に文献と照合してください。')) + '</p></div></div>' +
        '<div class="stack">' +
          '<div class="panel"><div class="panel-head"><h2 data-out="seltitle"></h2></div><i data-slot="offset"></i>' +
            '<div class="stats" style="margin-top:8px">' + ui.stat('qf', 'f01') + ui.stat('qr', L('Readout', '読み出し')) + ui.stat('ql', L('Resonator length', '共振器の長さ')) + ui.stat('qn', L('Neighbours', '隣接数')) + '</div></div>' +
          '<div class="panel"><div class="panel-head"><h2>' + esc(L('Layers', 'レイヤ')) + '</h2></div><div class="layer-list" data-out="layers"></div></div>' +
          '<div class="panel"><div class="panel-head"><h2>' + esc(L('Chip summary', 'チップの概要')) + '</h2></div>' +
            '<div class="stats">' + ui.stat('nq', L('Qubits', '量子ビット')) + ui.stat('nc', L('Couplers', '結合')) + ui.stat('wzz', L('Largest |ZZ|', '最大 |ZZ|')) + ui.stat('col', L('Collisions', '衝突')) + '</div>' +
            '<div class="btn-row" style="margin-top:10px"><button class="btn" data-act="gds">' + esc(L('Export GDSII', 'GDSII を出力')) + '</button><button class="btn" data-act="em">' + esc(L('Extract capacitances (3D)', '容量を抽出 (3 次元)')) + '</button></div></div>' +
        '</div></div>';

    const offset = ui.slider({ label: L('Frequency trim of this qubit', 'この量子ビットの周波数調整'), unit: 'MHz', min: -300, max: 300, step: 1, digits: 0,
      get: () => sc.qubits[sc.selected].offset * 1000, set: (v) => { sc.qubits[sc.selected].offset = v / 1000; }, onChange: () => update() });
    ui.mount(root, html, {
      offset,
      tools: ui.segmented({ label: L('Topology', '接続形状'), options: Object.keys(TOPOLOGIES).map((k) => ({ value: k, label: YR.LL(TOPOLOGIES[k].name) })),
        get: () => sc.topology, set: (v) => { buildSc(v); offset.refresh(); update(); } })
    });
    root.querySelector('[data-act="gds"]').addEventListener('click', () => ui.notBuilt(L('GDSII export', 'GDSII 出力')));
    root.querySelector('[data-act="em"]').addEventListener('click', () => ui.notBuilt(L('3D capacitance extraction', '3 次元の容量抽出')));

    const layerDefs = [
      ['res', 'var(--s5)', L('Readout resonators', '読み出し共振器')], ['ctrl', 'var(--s3)', L('Control lines', '制御線')],
      ['coup', 'var(--s4)', L('Couplers', '結合器')], ['jj', '#f5f0e6', L('Junctions', '接合')],
      ['bridge', '#e8eef5', L('Airbridges', 'エアブリッジ')], ['label', 'var(--text-2)', L('Labels', 'ラベル')]
    ];
    const layerBox = root.querySelector('[data-out="layers"]');
    layerDefs.forEach(([key, colour, name]) => {
      const label = ui.el('label', null, '<input type="checkbox"' + (sc.layers[key] ? ' checked' : '') + '><i style="background:' + colour + '"></i>' + esc(name));
      label.querySelector('input').addEventListener('change', (e) => { sc.layers[key] = e.target.checked; update(); });
      layerBox.append(label);
    });

    const wrap = root.querySelector('[data-out="svg"]');
    let drag = null;
    function toSvg(e) {
      const svg = wrap.querySelector('svg');
      const m = svg.getScreenCTM();
      if (!m) return null;
      const p = svg.createSVGPoint();
      p.x = e.clientX; p.y = e.clientY;
      return p.matrixTransform(m.inverse());
    }
    wrap.addEventListener('pointerdown', (e) => {
      const g = e.target.closest ? e.target.closest('.qb') : null;
      if (!g) return;
      sc.selected = +g.dataset.q;
      const p = toSvg(e);
      if (p) drag = { i: sc.selected, dx: sc.qubits[sc.selected].x - p.x, dy: sc.qubits[sc.selected].y - p.y };
      wrap.setPointerCapture(e.pointerId);
      offset.refresh(); update();
    });
    wrap.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const p = toSvg(e);
      if (!p) return;
      const q = sc.qubits[drag.i];
      q.x = Math.max(150, Math.min(850, Math.round((p.x + drag.dx) / 10) * 10));
      q.y = q.side === 0 ? Math.max(210, Math.min(340, Math.round((p.y + drag.dy) / 10) * 10)) : Math.max(360, Math.min(490, Math.round((p.y + drag.dy) / 10) * 10));
      update();
    });
    const end = () => { drag = null; };
    wrap.addEventListener('pointerup', end);
    wrap.addEventListener('pointercancel', end);

    function update() {
      const d = YR.derive.sc();
      const an = analyseSc(d);
      wrap.innerHTML = scSvg();
      const i = sc.selected;
      ui.out(root, 'seltitle', esc(L('Selected: Q', '選択中: Q') + i));
      ui.out(root, 'qf', ui.val(an.f[i].toFixed(3), 'GHz'));
      ui.out(root, 'qr', ui.val(an.res[i].fr.toFixed(2), 'GHz'));
      ui.out(root, 'ql', ui.val(an.res[i].lengthMm.toFixed(2), 'mm'));
      ui.out(root, 'ql-sub', esc(an.res[i].fits ? 'λ/4' : L('does not fit', '収まらない')));
      ui.out(root, 'qn', ui.val(String(an.edges.filter((e) => e.a === i || e.b === i).length)));
      ui.out(root, 'nq', ui.val(String(sc.qubits.length)));
      ui.out(root, 'nc', ui.val(String(sc.edges.length)));
      const worst = an.edges.reduce((m, e) => Math.max(m, Math.abs(e.zz)), 0);
      ui.out(root, 'wzz', ui.val(worst >= 1000 ? (worst / 1000).toFixed(2) : worst.toFixed(0), worst >= 1000 ? 'MHz' : 'kHz'));
      const bad = an.edges.filter((e) => e.level === 'bad').length, warn = an.edges.filter((e) => e.level === 'warn').length + an.spect.length;
      ui.out(root, 'col', ui.val(String(bad)));
      ui.out(root, 'col-sub', esc(warn + L(' warnings', ' 件の注意')));
      root.querySelector('[data-stat="col"]').className = 'stat' + (bad ? ' bad' : warn ? ' warn' : '');

      const checks = [];
      const issues = an.edges.filter((e) => e.level !== 'ok');
      if (!issues.length) checks.push(['ok', L('<b>Coupled pairs</b> — no frequency collision on any of the ' + an.edges.length + ' pairs.', '<b>結合ペア</b> — ' + an.edges.length + ' 組すべてで周波数の衝突なし。')]);
      issues.forEach((e) => checks.push([e.level, '<b>Q' + e.a + '–Q' + e.b + '</b> — ' + esc(e.why) + ' (Δ = ' + (e.det * 1000).toFixed(0) + ' MHz)']));
      if (an.spect.length) an.spect.forEach(([a, b]) => checks.push(['warn', '<b>Q' + a + ' · Q' + b + '</b> — ' + esc(L('spectators of a shared neighbour are within 17 MHz', '共通の隣を持つ 2 つが 17 MHz 以内'))]));
      else checks.push(['ok', L('<b>Spectators</b> — next-nearest qubits are separated in frequency.', '<b>スペクテータ</b> — 1 つおいた隣どうしの周波数は離れている。')]);
      checks.push([an.minDistMm >= 1.5 ? 'ok' : 'warn', L('<b>Qubit spacing</b> — closest pair is ' + an.minDistMm.toFixed(2) + ' mm apart (target ≥ 1.5 mm).', '<b>量子ビット間隔</b> — 最も近い組で ' + an.minDistMm.toFixed(2) + ' mm (目標 1.5 mm 以上)。')]);
      const misfit = an.res.map((r, k) => (r.fits ? null : 'Q' + k)).filter(Boolean);
      checks.push([misfit.length ? 'bad' : 'ok', misfit.length
        ? L('<b>Resonators</b> — no room for the λ/4 line of ' + misfit.join(', ') + '.', '<b>共振器</b> — ' + misfit.join(', ') + ' の λ/4 線路が収まらない。')
        : L('<b>Resonators</b> — every λ/4 line fits between its qubit and the feedline.', '<b>共振器</b> — すべての λ/4 線路が量子ビットとフィードラインの間に収まる。')]);
      checks.push(['ok', L('<b>Readout multiplexing</b> — resonators are spaced by 40 MHz on each feedline.', '<b>読み出しの多重化</b> — 共振器は各フィードライン上で 40 MHz 間隔。')]);
      ui.out(root, 'checks', checks.map(([lvl, text]) => '<div class="check' + (lvl === 'ok' ? '' : ' ' + lvl) + '"><span>' + text + '</span></div>').join(''));
    }
    return update;
  }

  // =====================================================================
  // Photonic chip: sources -> rectangular interferometer mesh -> detectors.
  // =====================================================================
  const ph = { modes: 4, cell: 4250, mzis: [], selected: 0, layers: { heater: true, metal: true, label: true } };
  function buildPh(modes) {
    ph.modes = modes;
    ph.mzis = [];
    for (let c = 0; c < modes; c++) for (let k = c % 2; k + 1 < modes; k += 2) ph.mzis.push({ col: c, mode: k, theta: Math.PI / 4, phi: 0 });
    ph.selected = 0;
  }
  buildPh(4);

  function phElements() {
    const els = [];
    ph.mzis.forEach((m) => {
      els.push({ type: 'ps', mode: m.mode, phi: m.phi, col: m.col * 4 });
      els.push({ type: 'bs', mode: m.mode, theta: Math.PI / 4, col: m.col * 4 + 1 });
      els.push({ type: 'ps', mode: m.mode, phi: 2 * m.theta, col: m.col * 4 + 2 });
      els.push({ type: 'bs', mode: m.mode, theta: Math.PI / 4, col: m.col * 4 + 3 });
    });
    return els;
  }
  function phPathMm() { return (ph.modes * ph.cell + 3000) / 1000; }

  function phSvg(opts) {
    opts = opts || {};
    const N = ph.modes;
    const lay = opts.thumb ? { heater: true, metal: false, label: false } : ph.layers;
    const top = 70, pitch = 64, H = 2 * top + (N - 1) * pitch + 30;
    const x0 = 250, colW = (880 - x0 - 110) / N;
    const y = (k) => top + k * pitch;
    const squeeze = pitch / 2 - 4;
    let s = '<svg viewBox="0 0 1000 ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + esc(L('Photonic chip floor plan', '光チップの配置図')) + '">' +
      '<rect width="1000" height="' + H + '" fill="#080b0f"/><rect x="20" y="20" width="960" height="' + (H - 40) + '" rx="6" fill="#141712" stroke="var(--line-2)"/>';

    // waveguides
    for (let k = 0; k < N; k++) {
      let d = 'M70 ' + y(k) + ' L' + x0 + ' ' + y(k);
      for (let c = 0; c < N; c++) {
        const xs = x0 + c * colW;
        const m = ph.mzis.find((z) => z.col === c && (z.mode === k || z.mode + 1 === k));
        if (!m) { d += ' L' + (xs + colW) + ' ' + y(k); continue; }
        const dirn = m.mode === k ? 1 : -1;
        const yi = y(k) + dirn * squeeze, a = colW * 0.14, b = colW * 0.08;
        const dip = (xa) => ' C' + (xa + a * 0.5) + ' ' + y(k) + ' ' + (xa + a * 0.5) + ' ' + yi + ' ' + (xa + a) + ' ' + yi + ' L' + (xa + a + b) + ' ' + yi +
          ' C' + (xa + 1.5 * a + b) + ' ' + yi + ' ' + (xa + 1.5 * a + b) + ' ' + y(k) + ' ' + (xa + 2 * a + b) + ' ' + y(k);
        d += ' L' + (xs + colW * 0.04) + ' ' + y(k) + dip(xs + colW * 0.04) + ' L' + (xs + colW * 0.60) + ' ' + y(k) + dip(xs + colW * 0.60) + ' L' + (xs + colW) + ' ' + y(k);
      }
      d += ' L905 ' + y(k);
      s += '<path d="' + d + '" fill="none" stroke="var(--accent)" stroke-width="2.6" stroke-linejoin="round"/>';
    }
    // sources (rings on the bus) and input couplers
    for (let k = 0; k < N; k++) {
      s += '<path d="M40 ' + (y(k) - 9) + ' L70 ' + (y(k) - 3) + ' L70 ' + (y(k) + 3) + ' L40 ' + (y(k) + 9) + ' Z" fill="var(--accent)" fill-opacity=".55"/>' +
        '<circle cx="155" cy="' + (y(k) - 16) + '" r="13" fill="none" stroke="var(--s3)" stroke-width="2.6"/>';
      // detector
      s += '<rect x="905" y="' + (y(k) - 13) + '" width="46" height="26" rx="3" fill="#0b0e0a" stroke="var(--s4)"/>' +
        '<path d="M911 ' + (y(k) - 7) + ' h34 v4.6 h-34 v4.6 h34 v4.6 h-34" fill="none" stroke="var(--s4)" stroke-width="1.5"/>';
      if (lay.label) s += '<text x="48" y="' + (y(k) - 14) + '" font-size="11" font-family="var(--mono)" fill="var(--text-3)">' + k + '</text>';
    }
    // interferometers
    ph.mzis.forEach((m, idx) => {
      const xs = x0 + m.col * colW, yt = y(m.mode), sel = !opts.thumb && idx === ph.selected;
      s += '<g class="mzi" data-m="' + idx + '" style="cursor:' + (opts.thumb ? 'default' : 'pointer') + '">' +
        '<rect x="' + (xs + 2) + '" y="' + (yt - 14) + '" width="' + (colW - 4) + '" height="' + (pitch + 28) + '" rx="6" fill="' + (sel ? 'var(--accent-soft)' : 'transparent') + '" stroke="' + (sel ? 'var(--accent)' : 'transparent') + '" stroke-dasharray="5 5"/>';
      if (lay.heater) {
        s += '<rect x="' + (xs + colW * 0.42) + '" y="' + (yt - 5) + '" width="' + (colW * 0.16) + '" height="10" rx="2" fill="var(--s2)" fill-opacity=".9"/>' +
          '<rect x="' + (xs + colW * 0.005) + '" y="' + (yt - 5) + '" width="' + (colW * 0.035) + '" height="10" rx="2" fill="var(--s5)"/>';
      }
      if (lay.metal) s += '<path d="M' + (xs + colW * 0.5) + ' ' + (yt - 5) + ' V' + (yt - 13) + '" stroke="var(--s2)" stroke-width="1.5" stroke-opacity=".7"/>';
      if (lay.label) s += '<text x="' + (xs + colW * 0.5) + '" y="' + (yt + pitch / 2 + 4) + '" text-anchor="middle" font-size="10.5" font-family="var(--mono)" fill="var(--text-3)">' +
        (Math.pow(Math.sin(m.theta), 2) * 100).toFixed(0) + '%</text>';
      s += '</g>';
    });
    if (!opts.thumb) {
      s += '<text x="155" y="' + (H - 34) + '" text-anchor="middle" font-size="11" font-family="var(--mono)" fill="var(--s3)">' + esc(L('ring sources', 'リング光源')) + '</text>' +
        '<text x="' + (x0 + N * colW / 2) + '" y="' + (H - 34) + '" text-anchor="middle" font-size="11" font-family="var(--mono)" fill="var(--text-2)">' + esc(L('interferometer mesh', '干渉計メッシュ')) + '</text>' +
        '<text x="928" y="' + (H - 34) + '" text-anchor="middle" font-size="11" font-family="var(--mono)" fill="var(--s4)">SNSPD</text>';
    }
    return s + '</svg>';
  }

  function renderPh(root) {
    const html =
      ui.head(L('Stage 03 · Photonic', '工程 03 · 光'), L('Chip layout', 'チップレイアウト'),
        L('Photon sources feed a rectangular mesh of Mach–Zehnder interferometers, read out by superconducting nanowire detectors. Click an interferometer to set its phases.',
          '光子源からマッハ・ツェンダー干渉計の矩形メッシュへ光を入れ、超伝導ナノワイヤ検出器で読み出します。干渉計をクリックすると位相を設定できます。'), 'tools') +
      '<div class="grid g-main">' +
        '<div class="stack"><div class="canvas-wrap" data-out="svg"></div>' +
          '<div class="panel"><div class="panel-head"><h2>' + esc(L('Transfer matrix |U|²', '伝達行列 |U|²')) + '</h2><div class="right">' + ui.tag('computed') + '</div></div>' +
            '<div class="grid" style="grid-template-columns:220px minmax(0,1fr);gap:16px;align-items:center"><canvas data-plot="u" style="width:220px;height:220px"></canvas>' +
            '<div><p class="lead">' + esc(L('Row: output mode. Column: input mode. Brightness: probability that one photon entering the column leaves by the row.',
              '行が出力モード、列が入力モードです。明るさは、その列から入った 1 光子がその行から出る確率を表します。')) + '</p>' +
            '<div class="btn-row"><button class="btn" data-act="random">' + esc(L('Random phases', '位相をランダムに')) + '</button><button class="btn" data-act="reset">' + esc(L('All 50:50', 'すべて 50:50')) + '</button>' +
            '<button class="btn primary" data-act="send">' + esc(L('Run photons through this mesh', 'このメッシュに光子を通す')) + '</button></div></div></div></div></div>' +
        '<div class="stack">' +
          '<div class="panel"><div class="panel-head"><h2 data-out="seltitle"></h2></div><i data-slot="theta"></i><i data-slot="phi"></i>' +
            '<div class="stats" style="margin-top:8px">' + ui.stat('split', L('Splitting', '分岐比')) + ui.stat('heat', L('Phase shifters', '位相シフタ')) + '</div></div>' +
          '<div class="panel"><div class="panel-head"><h2>' + esc(L('Footprint and loss', '寸法と損失')) + '</h2><div class="right">' + ui.tag('computed') + '</div></div><i data-slot="cell"></i>' +
            '<div class="stats" style="margin-top:8px">' + ui.stat('nm', L('Interferometers', '干渉計')) + ui.stat('path', L('Optical path', '光路長')) + ui.stat('loss', L('On-chip loss', 'チップ内の損失')) + ui.stat('eta', L('Efficiency η', '効率 η'), 'key') + '</div>' +
            '<p class="note">' + esc(L('The path length set here is the one used by Materials, Circuit and Dynamics.', 'ここで決まる光路長を、材料・回路・ダイナミクスの各工程が使います。')) + '</p></div>' +
          '<div class="panel"><div class="panel-head"><h2>' + esc(L('Layers', 'レイヤ')) + '</h2></div><div class="layer-list" data-out="layers"></div>' +
            '<div class="btn-row" style="margin-top:10px"><button class="btn" data-act="gds">' + esc(L('Export GDSII', 'GDSII を出力')) + '</button></div></div>' +
        '</div></div>';

    ph.cell = Math.max(200, Math.min(5000, Math.round((state.ph.pathMm * 1000 - 3000) / ph.modes / 50) * 50));
    const theta = ui.slider({ label: L('Internal phase 2θ (splitting)', '内部位相 2θ (分岐比)'), unit: 'π', min: 0, max: 1, step: 0.01, digits: 2,
      get: () => 2 * ph.mzis[ph.selected].theta / Math.PI, set: (v) => { ph.mzis[ph.selected].theta = v * Math.PI / 2; }, onChange: () => update() });
    const phi = ui.slider({ label: L('External phase φ', '外部位相 φ'), unit: 'π', min: 0, max: 2, step: 0.01, digits: 2,
      get: () => ph.mzis[ph.selected].phi / Math.PI, set: (v) => { ph.mzis[ph.selected].phi = v * Math.PI; }, onChange: () => update() });
    ui.mount(root, html, {
      theta, phi,
      cell: ui.slider({ label: L('Interferometer length', '干渉計 1 段の長さ'), unit: 'µm', min: 200, max: 5000, step: 50, digits: 0, get: () => ph.cell,
        set: (v) => { ph.cell = v; state.ph.pathMm = Math.round(phPathMm()); } }),
      tools: ui.segmented({ label: L('Modes', 'モード数'), options: [4, 6, 8].map((n) => ({ value: n, label: n + L(' modes', ' モード') })),
        get: () => ph.modes, set: (v) => { buildPh(+v); state.ph.pathMm = Math.round(phPathMm()); theta.refresh(); phi.refresh(); YR.changed(true); } })
    });
    const layerBox = root.querySelector('[data-out="layers"]');
    [['heater', 'var(--s2)', L('Heaters (phase shifters)', 'ヒーター (位相シフタ)')], ['metal', 'var(--s2)', L('Metal routing', '金属配線')], ['label', 'var(--text-2)', L('Labels', 'ラベル')]].forEach(([key, colour, name]) => {
      const label = ui.el('label', null, '<input type="checkbox"' + (ph.layers[key] ? ' checked' : '') + '><i style="background:' + colour + '"></i>' + esc(name));
      label.querySelector('input').addEventListener('change', (e) => { ph.layers[key] = e.target.checked; update(); });
      layerBox.append(label);
    });
    const wrap = root.querySelector('[data-out="svg"]');
    wrap.addEventListener('click', (e) => {
      const g = e.target.closest ? e.target.closest('.mzi') : null;
      if (!g) return;
      ph.selected = +g.dataset.m; theta.refresh(); phi.refresh(); update();
    });
    root.querySelector('[data-act="gds"]').addEventListener('click', () => ui.notBuilt(L('GDSII export', 'GDSII 出力')));
    root.querySelector('[data-act="random"]').addEventListener('click', () => {
      ph.mzis.forEach((m) => { m.theta = Math.random() * Math.PI / 2; m.phi = Math.random() * 2 * Math.PI; }); theta.refresh(); phi.refresh(); update();
    });
    root.querySelector('[data-act="reset"]').addEventListener('click', () => {
      ph.mzis.forEach((m) => { m.theta = Math.PI / 4; m.phi = 0; }); theta.refresh(); phi.refresh(); update();
    });
    root.querySelector('[data-act="send"]').addEventListener('click', () => {
      if (ph.modes > 6) { ui.toast(L('The circuit stage handles up to 6 modes; choose 4 or 6.', '回路の工程で扱えるのは 6 モードまでです。4 か 6 を選んでください。')); return; }
      if (YR.circuitState) YR.circuitState.loadMesh(ph.modes, phElements());
      YR.go('circuit');
    });

    function update() {
      wrap.innerHTML = phSvg();
      const m = ph.mzis[ph.selected];
      ui.out(root, 'seltitle', esc(L('Selected: column ', '選択中: 列 ') + m.col + L(', modes ', '、モード ') + m.mode + '–' + (m.mode + 1)));
      ui.out(root, 'split', ui.val((Math.pow(Math.sin(m.theta), 2) * 100).toFixed(1), '%'));
      ui.out(root, 'split-sub', esc(L('power crossing over', 'クロス側へ移るパワー')));
      ui.out(root, 'heat', ui.val(String(ph.mzis.length * 2)));
      const d = YR.derive.ph();
      ui.out(root, 'nm', ui.val(String(ph.mzis.length)));
      ui.out(root, 'path', ui.val(state.ph.pathMm.toFixed(0), 'mm'));
      ui.out(root, 'loss', ui.val(d.chipDb.toFixed(2), 'dB'));
      ui.out(root, 'eta', ui.val((d.eta * 100).toFixed(1), '%'));

      const U = YR.linearoptics.circuitUnitary(ph.modes, phElements().slice().sort((a, b) => a.col - b.col));
      const canvas = root.querySelector('[data-plot="u"]');
      const { ctx, w, h } = YR.plot.prepare(canvas);
      const n = ph.modes, cell = Math.min(w, h) / n;
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
        const p = U[r][c][0] * U[r][c][0] + U[r][c][1] * U[r][c][1];
        const rgb = YR.plot.mapColor('ember', Math.sqrt(p));
        ctx.fillStyle = 'rgb(' + rgb.map(Math.round).join(',') + ')';
        ctx.fillRect(c * cell + 1, r * cell + 1, cell - 2, cell - 2);
        if (n <= 6) {
          ctx.fillStyle = p > 0.45 ? '#1a1206' : '#dbe3ec'; ctx.font = '11px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(p.toFixed(2), c * cell + cell / 2, r * cell + cell / 2);
        }
      }
    }
    return update;
  }

  YR.layoutArt = { sc: scSvg, ph: phSvg };
  YR.views.layout = {
    title: () => L('Chip layout', 'チップレイアウト'),
    sub: () => (state.platform === 'sc' ? L('Placement, frequencies', '配置・周波数割り当て') : L('Sources, mesh, detectors', '光源・メッシュ・検出器')),
    render(root) { return state.platform === 'sc' ? renderSc(root) : renderPh(root); }
  };
})(globalThis.YR = globalThis.YR || {});
