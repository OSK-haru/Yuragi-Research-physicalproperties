/* Circuit stage: gate circuits with device noise, or photons through a linear-optical circuit. */
(function (YR) {
  'use strict';
  const L = YR.L, esc = YR.fmt.esc, sig = YR.fmt.sig, state = YR.state, ui = YR.ui;
  const CW = 46, RH = 46, X0 = 58, Y0 = 34;

  // =====================================================================
  // Superconducting: gate circuit
  // =====================================================================
  const gc = { n: 3, cols: 12, gates: [], tool: 'H', pending: null, theta: 0.5, noise: true };
  const ONE = ['H', 'X', 'Y', 'Z', 'S', 'T', 'RX', 'RY', 'RZ'], TWO = ['CNOT', 'CZ', 'SWAP'];

  function preset(name) {
    gc.gates = []; gc.pending = null;
    const g = (col, gate, q, q2) => gc.gates.push({ col, gate, q, q2, theta: Math.PI / 2 });
    if (name === 'bell') { gc.n = 2; g(0, 'H', 0); g(1, 'CNOT', 0, 1); }
    else if (name === 'ghz') { g(0, 'H', 0); for (let q = 0; q + 1 < gc.n; q++) g(q + 1, 'CNOT', q, q + 1); }
    else if (name === 'grover') {
      gc.n = 2;
      g(0, 'H', 0); g(0, 'H', 1); g(1, 'CZ', 0, 1); g(2, 'H', 0); g(2, 'H', 1); g(3, 'X', 0); g(3, 'X', 1);
      g(4, 'CZ', 0, 1); g(5, 'X', 0); g(5, 'X', 1); g(6, 'H', 0); g(6, 'H', 1);
    }
  }
  preset('ghz');

  function covers(g, col, q) {
    if (g.col !== col) return false;
    if (g.q2 === undefined || g.q2 === null) return g.q === q;
    return q >= Math.min(g.q, g.q2) && q <= Math.max(g.q, g.q2);
  }
  function clearCells(col, qa, qb) {
    const lo = Math.min(qa, qb), hi = Math.max(qa, qb);
    gc.gates = gc.gates.filter((g) => { for (let q = lo; q <= hi; q++) if (covers(g, col, q)) return false; return true; });
  }
  function toCircuit() {
    const columns = [];
    for (let c = 0; c < gc.cols; c++) columns.push(gc.gates.filter((g) => g.col === c && g.q < gc.n && (g.q2 === undefined || g.q2 === null || g.q2 < gc.n)));
    return { n: gc.n, columns };
  }

  function gateSvg() {
    const W = X0 + gc.cols * CW + 16, H = Y0 + gc.n * RH + 6;
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:' + W + 'px;height:' + H + 'px;max-width:none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + esc(L('Circuit editor', '回路エディタ')) + '">';
    for (let c = 0; c < gc.cols; c++) s += '<text x="' + (X0 + c * CW + CW / 2) + '" y="16" text-anchor="middle" font-size="10" font-family="var(--mono)" fill="var(--text-3)">' + (c + 1) + '</text>';
    for (let q = 0; q < gc.n; q++) {
      const y = Y0 + q * RH + RH / 2;
      s += '<text x="14" y="' + (y + 4) + '" font-size="12" font-family="var(--mono)" fill="var(--text-2)">q' + q + ' |0⟩</text>' +
        '<path d="M' + X0 + ' ' + y + ' H' + (W - 10) + '" stroke="var(--line-2)" stroke-width="1.5"/>';
    }
    for (let c = 0; c < gc.cols; c++) for (let q = 0; q < gc.n; q++) {
      const pend = gc.pending && gc.pending.col === c && gc.pending.q === q;
      s += '<rect class="cell" data-c="' + c + '" data-q="' + q + '" x="' + (X0 + c * CW + 3) + '" y="' + (Y0 + q * RH + 3) + '" width="' + (CW - 6) + '" height="' + (RH - 6) + '" rx="5" fill="' +
        (pend ? 'var(--accent-soft)' : 'transparent') + '" stroke="' + (pend ? 'var(--accent)' : 'transparent') + '" style="cursor:pointer"/>';
    }
    for (const g of gc.gates) {
      if (g.q >= gc.n || (g.q2 !== undefined && g.q2 !== null && g.q2 >= gc.n) || g.col >= gc.cols) continue;
      const x = X0 + g.col * CW + CW / 2, y = Y0 + g.q * RH + RH / 2;
      if (TWO.indexOf(g.gate) >= 0) {
        const y2 = Y0 + g.q2 * RH + RH / 2;
        s += '<g pointer-events="none"><path d="M' + x + ' ' + y + ' V' + y2 + '" stroke="var(--accent)" stroke-width="2"/>';
        const dot = (yy) => '<circle cx="' + x + '" cy="' + yy + '" r="5" fill="var(--accent)"/>';
        const plus = (yy) => '<circle cx="' + x + '" cy="' + yy + '" r="11" fill="var(--panel)" stroke="var(--accent)" stroke-width="2"/><path d="M' + (x - 11) + ' ' + yy + ' h22 M' + x + ' ' + (yy - 11) + ' v22" stroke="var(--accent)" stroke-width="2"/>';
        const cross = (yy) => '<path d="M' + (x - 7) + ' ' + (yy - 7) + ' l14 14 M' + (x + 7) + ' ' + (yy - 7) + ' l-14 14" stroke="var(--accent)" stroke-width="2.4"/>';
        s += g.gate === 'CNOT' ? dot(y) + plus(y2) : g.gate === 'CZ' ? dot(y) + dot(y2) : cross(y) + cross(y2);
        s += '</g>';
      } else {
        const param = YR.qcircuit.PARAM[g.gate];
        s += '<g pointer-events="none"><rect x="' + (x - 17) + '" y="' + (y - 16) + '" width="34" height="32" rx="5" fill="var(--panel-2)" stroke="var(--accent)" stroke-width="1.5"/>' +
          '<text x="' + x + '" y="' + (y + (param ? -1 : 4)) + '" text-anchor="middle" font-size="' + (param ? 11 : 13) + '" font-weight="600" font-family="var(--mono)" fill="var(--text)">' + g.gate + '</text>' +
          (param ? '<text x="' + x + '" y="' + (y + 11) + '" text-anchor="middle" font-size="9" font-family="var(--mono)" fill="var(--text-2)">' + (g.theta / Math.PI).toFixed(2) + 'π</text>' : '') + '</g>';
      }
    }
    return s + '</svg>';
  }

  function renderSc(root) {
    const html =
      ui.head(L('Stage 05 · Superconducting', '工程 05 · 超伝導'), L('Quantum circuit', '量子回路'),
        L('Build a circuit and run it twice: without noise, and with the T1 and T2 that follow from your materials and device. The gap between the two is what the hardware design costs.',
          '回路を組み、雑音なしの場合と、材料とデバイスから決まる T1・T2 を入れた場合の 2 通りで実行します。両者の差が、ハードウェア設計による損失です。')) +
      '<div class="panel" style="margin-bottom:14px"><div class="panel-head"><h2>' + esc(L('Editor', 'エディタ')) + '</h2><div class="right"><i data-slot="nq"></i>' +
        '<button class="btn" data-preset="bell">Bell</button><button class="btn" data-preset="ghz">GHZ</button><button class="btn" data-preset="grover">' + esc(L('Grover (2 qubits)', 'グローバー (2 量子ビット)')) + '</button>' +
        '<button class="btn ghost" data-preset="clear">' + esc(L('Clear', '消去')) + '</button></div></div>' +
        '<div class="btn-row" style="margin-bottom:10px"><div class="palette" data-out="palette"></div><div style="min-width:200px;flex:1;max-width:280px"><i data-slot="theta"></i></div></div>' +
        '<div class="canvas-wrap scroll-x" data-out="svg" style="padding:4px"></div>' +
        '<div class="hint" data-out="hint"></div></div>' +
      '<div class="grid g-wide">' +
        '<div class="panel"><div class="panel-head"><h2>' + esc(L('Measurement probabilities', '測定確率')) + '</h2><div class="right">' + ui.tag('computed') + '</div></div>' +
          '<canvas class="plot tall" data-plot="probs"></canvas>' +
          YR.plot.legend([{ color: 's1', label: L('ideal', '理想') }, { color: 's2', label: L('with device noise', 'デバイス雑音あり') }]) +
          '<p class="note">' + esc(L('Bit strings read q0 first.', 'ビット列は q0 を先頭に書いています。')) + '</p></div>' +
        '<div class="stack">' +
          '<div class="panel"><div class="panel-head"><h2>' + esc(L('What the hardware costs', 'ハードウェアによる損失')) + '</h2><div class="right">' + ui.tag('computed') + '</div></div>' +
            '<div class="stats">' + ui.stat('fid', L('State fidelity', '状態忠実度'), 'key') + ui.stat('pur', L('Purity', '純度')) + ui.stat('dur', L('Circuit duration', '回路の実行時間')) + ui.stat('coh', 'T1 / T2') + '</div>' +
            '<p class="note">' + esc(L('Noise model: amplitude damping and pure dephasing on every qubit for the duration of each layer. Control errors, leakage, crosstalk and readout error are not included.',
              '雑音モデル: 各層の実行時間のあいだ、すべての量子ビットに振幅減衰と純位相緩和がかかります。制御誤差、リーク、クロストーク、読み出し誤りは含みません。')) + '</p></div>' +
          '<div class="panel"><div class="panel-head"><h2>' + esc(L('Single-qubit states', '各量子ビットの状態')) + '</h2><div class="right">' + ui.tag('computed') + '</div></div>' +
            '<table class="data"><thead><tr><th></th><th class="num">⟨X⟩</th><th class="num">⟨Y⟩</th><th class="num">⟨Z⟩</th><th class="num">|r|</th></tr></thead><tbody data-out="bloch"></tbody></table>' +
            '<p class="note">' + esc(L('|r| < 1 without noise means the qubit is entangled with the others.', '雑音なしで |r| < 1 なら、その量子ビットはほかと量子もつれの状態にあります。')) + '</p></div>' +
        '</div></div>';
    ui.mount(root, html, {
      nq: ui.segmented({ small: true, label: L('Qubits', '量子ビット数'), options: [2, 3, 4, 5].map((n) => ({ value: n, label: String(n) })), get: () => gc.n, set: (v) => { gc.n = +v; gc.pending = null; update(); } }),
      theta: ui.slider({ label: L('Angle for RX / RY / RZ', 'RX / RY / RZ の角度'), unit: 'π', min: -1, max: 1, step: 0.05, digits: 2, get: () => gc.theta, set: (v) => { gc.theta = v; }, onChange: () => {} })
    });
    const pal = root.querySelector('[data-out="palette"]');
    const paintPalette = () => pal.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === gc.tool)));
    ONE.concat(TWO).concat(['erase']).forEach((t) => {
      const b = ui.el('button', { class: 'gate-btn', type: 'button', 'data-tool': t }, t === 'erase' ? esc(L('Erase', '消す')) : t);
      b.addEventListener('click', () => { gc.tool = t; gc.pending = null; paintPalette(); update(); });
      pal.append(b);
    });
    paintPalette();
    root.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.preset === 'clear') { gc.gates = []; gc.pending = null; } else preset(b.dataset.preset);
      update(true);
      const seg = root.querySelector('.seg.small'); if (seg && seg.refresh) seg.refresh();
    }));
    const wrap = root.querySelector('[data-out="svg"]');
    wrap.addEventListener('click', (e) => {
      const cell = e.target.closest ? e.target.closest('.cell') : null;
      if (!cell) return;
      const col = +cell.dataset.c, q = +cell.dataset.q;
      if (gc.tool === 'erase') { clearCells(col, q, q); }
      else if (TWO.indexOf(gc.tool) >= 0) {
        if (gc.pending && gc.pending.col === col && gc.pending.q !== q) {
          clearCells(col, gc.pending.q, q);
          gc.gates.push({ col, gate: gc.tool, q: gc.pending.q, q2: q });
          gc.pending = null;
        } else gc.pending = { col, q };
      } else {
        clearCells(col, q, q);
        gc.gates.push({ col, gate: gc.tool, q, theta: gc.theta * Math.PI });
      }
      update();
    });

    function update() {
      wrap.innerHTML = gateSvg();
      ui.out(root, 'hint', esc(gc.pending ? L('Now click the second qubit in the same column.', '同じ列で、もう一方の量子ビットをクリックしてください。')
        : TWO.indexOf(gc.tool) >= 0 ? L('Two-qubit gate: click the first qubit (the control for CNOT), then the second in the same column.', '2 量子ビットゲート: 1 つ目 (CNOT では制御側) をクリックし、続けて同じ列の 2 つ目をクリックします。')
          : L('Pick a gate, then click a cell to place it.', 'ゲートを選び、置きたいマスをクリックします。')));
      const d = YR.derive.sc();
      const circuit = toCircuit();
      const ideal = YR.qcircuit.run(circuit, null).state;
      const noisyRun = YR.qcircuit.run(circuit, { t1: d.t1 * 1000, tphi: state.sc.tphi * 1000, t1q: state.sc.t1q, t2q: state.sc.t2q });
      const noisy = noisyRun.state;
      const pi = ideal.probabilities(), pn = noisy.probabilities();
      const labels = [];
      for (let i = 0; i < pi.length; i++) labels.push(YR.qcircuit.label(i, gc.n));
      YR.plot.bars(root.querySelector('[data-plot="probs"]'), {
        labels, groups: [{ values: Array.from(pi), color: 's1' }, { values: Array.from(pn), color: 's2' }], yLabel: L('probability', '確率'), yMax: Math.max(0.1, Math.max.apply(null, pi)), rotate: gc.n >= 4
      });
      const fid = noisy.overlap(ideal);
      ui.out(root, 'fid', ui.val((fid * 100).toFixed(2), '%'));
      ui.out(root, 'fid-sub', esc(L('error ', '誤り ') + sig(1 - fid, 2)));
      ui.out(root, 'pur', ui.val(noisy.purity().toFixed(4)));
      ui.out(root, 'dur', ui.val(noisyRun.elapsed.toFixed(0), 'ns'));
      const t1 = YR.fmt.timeUs(d.t1), t2 = YR.fmt.timeUs(d.t2);
      ui.out(root, 'coh', ui.val(t1[0] + ' / ' + t2[0], t2[1]));
      ui.out(root, 'coh-sub', esc(L('from Materials and Device', '材料とデバイスから')));
      let rows = '';
      for (let q = 0; q < gc.n; q++) {
        const b = noisy.bloch(q), r = Math.hypot(b[0], b[1], b[2]);
        rows += '<tr><td>q' + q + '</td>' + b.map((v) => '<td class="num">' + (Math.abs(v) < 5e-4 ? '0.000' : v.toFixed(3)) + '</td>').join('') + '<td class="num">' + r.toFixed(3) + '</td></tr>';
      }
      ui.out(root, 'bloch', rows);
    }
    return update;
  }

  // =====================================================================
  // Photonic: linear-optical circuit on Fock states
  // =====================================================================
  const lo = { modes: 2, cols: 6, els: [{ type: 'bs', mode: 0, col: 1, theta: Math.PI / 4 }], input: [1, 1], tool: 'bs', selected: 0 };
  YR.circuitState = {
    loadMesh(modes, elements) {
      lo.modes = modes;
      lo.els = elements.map((e) => Object.assign({}, e));
      lo.cols = Math.max(6, elements.reduce((m, e) => Math.max(m, e.col + 1), 0));
      lo.input = new Array(modes).fill(0); lo.input[0] = 1; lo.input[1] = 1;
      lo.selected = -1;
    }
  };
  function loPreset(name) {
    lo.selected = 0;
    if (name === 'hom') { lo.modes = 2; lo.cols = 6; lo.input = [1, 1]; lo.els = [{ type: 'bs', mode: 0, col: 1, theta: Math.PI / 4 }]; }
    else if (name === 'mzi') {
      lo.modes = 2; lo.cols = 6; lo.input = [1, 0];
      lo.els = [{ type: 'bs', mode: 0, col: 0, theta: Math.PI / 4 }, { type: 'ps', mode: 0, col: 1, phi: Math.PI / 2 }, { type: 'bs', mode: 0, col: 2, theta: Math.PI / 4 }];
      lo.selected = 1;
    } else if (name === 'tritter') {
      lo.modes = 3; lo.cols = 6; lo.input = [1, 1, 1];
      lo.els = [{ type: 'bs', mode: 0, col: 0, theta: Math.PI / 4 }, { type: 'bs', mode: 1, col: 1, theta: Math.acos(Math.sqrt(1 / 3)) }, { type: 'ps', mode: 1, col: 2, phi: Math.PI / 2 }, { type: 'bs', mode: 0, col: 3, theta: Math.PI / 4 }];
    }
  }
  function loCovers(e, col, mode) { return e.col === col && (e.mode === mode || (e.type === 'bs' && e.mode + 1 === mode)); }

  function loSvg() {
    const W = X0 + lo.cols * CW + 60, H = Y0 + lo.modes * RH + 6;
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:' + W + 'px;height:' + H + 'px;max-width:none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + esc(L('Optical circuit editor', '光回路エディタ')) + '">';
    for (let c = 0; c < lo.cols; c++) s += '<text x="' + (X0 + c * CW + CW / 2) + '" y="16" text-anchor="middle" font-size="10" font-family="var(--mono)" fill="var(--text-3)">' + (c + 1) + '</text>';
    for (let m = 0; m < lo.modes; m++) {
      const y = Y0 + m * RH + RH / 2;
      s += '<g class="inp" data-m="' + m + '" style="cursor:pointer"><rect x="6" y="' + (y - 14) + '" width="42" height="28" rx="5" fill="' + (lo.input[m] ? 'var(--accent-soft)' : 'transparent') + '" stroke="' + (lo.input[m] ? 'var(--accent)' : 'var(--line-2)') + '"/>' +
        '<text x="27" y="' + (y + 4) + '" text-anchor="middle" font-size="12" font-family="var(--mono)" fill="var(--text)">|' + lo.input[m] + '⟩</text></g>' +
        '<path d="M' + (X0 - 6) + ' ' + y + ' H' + (W - 46) + '" stroke="var(--accent)" stroke-opacity=".75" stroke-width="2"/>' +
        '<path d="M' + (W - 44) + ' ' + (y - 9) + ' a9 9 0 0 1 0 18 z" fill="var(--s4)"/>';
    }
    for (let c = 0; c < lo.cols; c++) for (let m = 0; m < lo.modes; m++) {
      s += '<rect class="cell" data-c="' + c + '" data-q="' + m + '" x="' + (X0 + c * CW + 3) + '" y="' + (Y0 + m * RH + 3) + '" width="' + (CW - 6) + '" height="' + (RH - 6) + '" rx="5" fill="transparent" style="cursor:pointer"/>';
    }
    lo.els.forEach((e, i) => {
      if (e.col >= lo.cols || e.mode >= lo.modes) return;
      const x = X0 + e.col * CW + CW / 2, y = Y0 + e.mode * RH + RH / 2, sel = i === lo.selected;
      const stroke = sel ? 'var(--text)' : 'var(--accent)';
      if (e.type === 'bs') {
        s += '<g pointer-events="none"><rect x="' + (x - 13) + '" y="' + (y - 6) + '" width="26" height="' + (RH + 12) + '" rx="6" fill="var(--panel-2)" stroke="' + stroke + '" stroke-width="' + (sel ? 2.2 : 1.5) + '"/>' +
          '<path d="M' + (x - 8) + ' ' + (y + 6) + ' L' + (x + 8) + ' ' + (y + RH - 6) + ' M' + (x + 8) + ' ' + (y + 6) + ' L' + (x - 8) + ' ' + (y + RH - 6) + '" stroke="var(--accent)" stroke-width="2"/>' +
          '<text x="' + x + '" y="' + (y + RH / 2 + 3) + '" text-anchor="middle" font-size="8.5" font-family="var(--mono)" fill="var(--text)" stroke="var(--panel-2)" stroke-width="3" paint-order="stroke">' + (Math.pow(Math.sin(e.theta), 2) * 100).toFixed(0) + '</text></g>';
      } else {
        s += '<g pointer-events="none"><rect x="' + (x - 15) + '" y="' + (y - 11) + '" width="30" height="22" rx="4" fill="var(--panel-2)" stroke="' + (sel ? 'var(--text)' : 'var(--s2)') + '" stroke-width="' + (sel ? 2.2 : 1.5) + '"/>' +
          '<text x="' + x + '" y="' + (y + 3.5) + '" text-anchor="middle" font-size="9" font-family="var(--mono)" fill="var(--text)">' + (e.phi / Math.PI).toFixed(2) + 'π</text></g>';
      }
    });
    return s + '</svg>';
  }

  function renderPh(root) {
    const html =
      ui.head(L('Stage 05 · Photonic', '工程 05 · 光'), L('Photonic circuit', '光量子回路'),
        L('Send a few photons through beam splitters and phase shifters. The exact output distribution is compared with what distinguishable particles would give: the difference is quantum interference.',
          '数個の光子をビームスプリッタと位相シフタに通します。厳密な出力分布を、区別できる粒子の場合と比べます。その差が量子干渉です。')) +
      '<div class="panel" style="margin-bottom:14px"><div class="panel-head"><h2>' + esc(L('Editor', 'エディタ')) + '</h2><div class="right"><i data-slot="nm"></i>' +
        '<button class="btn" data-preset="hom">' + esc(L('Hong–Ou–Mandel', 'ホン・オウ・マンデル')) + '</button><button class="btn" data-preset="mzi">' + esc(L('Interferometer', '干渉計')) + '</button>' +
        '<button class="btn" data-preset="tritter">' + esc(L('3-mode splitter', '3 モード分岐')) + '</button><button class="btn ghost" data-preset="clear">' + esc(L('Clear', '消去')) + '</button></div></div>' +
        '<div class="btn-row" style="margin-bottom:10px"><div class="palette" data-out="palette"></div><div style="min-width:220px;flex:1;max-width:320px" data-out="param"></div></div>' +
        '<div class="canvas-wrap scroll-x" data-out="svg" style="padding:4px"></div>' +
        '<div class="hint">' + esc(L('Click a |n⟩ box to change the photons entering that mode (up to 4 in total). Click an element to select it and set its value.',
          '|n⟩ の箱をクリックすると、そのモードに入る光子数が変わります (合計 4 個まで)。素子をクリックすると選択され、値を設定できます。')) + '</div></div>' +
      '<div class="grid g-wide">' +
        '<div class="panel"><div class="panel-head"><h2>' + esc(L('Output distribution', '出力分布')) + '</h2><div class="right">' + ui.tag('computed') + '</div></div>' +
          '<canvas class="plot tall" data-plot="dist"></canvas>' +
          YR.plot.legend([{ color: 's1', label: L('indistinguishable photons', '区別できない光子') }, { color: 's2', label: L('distinguishable particles', '区別できる粒子') }]) +
          '<p class="note" data-out="distnote"></p></div>' +
        '<div class="stack"><div class="panel"><div class="panel-head"><h2>' + esc(L('Interference and loss', '干渉と損失')) + '</h2><div class="right">' + ui.tag('computed') + '</div></div>' +
          '<div class="stats">' + ui.stat('bunch', L('Bunching probability', 'バンチングの確率'), 'key') + ui.stat('bunchc', L('…if distinguishable', '…区別できる場合')) + ui.stat('surv', L('All photons detected', '全光子が検出される確率')) + ui.stat('outs', L('Possible outcomes', '起こりうる結果の数')) + '</div>' +
          '<p class="note">' + esc(L('Bunching: two or more photons leave by the same mode. The detection probability is ηⁿ, with η from the loss budget in Materials and Layout.',
            'バンチング: 2 個以上の光子が同じモードから出ること。検出確率は ηⁿ で、η は「材料」と「レイアウト」の損失の内訳から決まります。')) + '</p></div></div>' +
      '</div>';
    ui.mount(root, html, {
      nm: ui.segmented({ small: true, label: L('Modes', 'モード数'), options: [2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) })), get: () => lo.modes,
        set: (v) => { lo.modes = +v; lo.input = lo.input.slice(0, lo.modes); while (lo.input.length < lo.modes) lo.input.push(0); lo.selected = -1; update(); } })
    });
    const pal = root.querySelector('[data-out="palette"]');
    const tools = [['bs', L('Beam splitter', 'ビームスプリッタ')], ['ps', L('Phase shifter', '位相シフタ')], ['erase', L('Erase', '消す')]];
    const paintPalette = () => pal.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === lo.tool)));
    tools.forEach(([t, name]) => {
      const b = ui.el('button', { class: 'gate-btn', type: 'button', 'data-tool': t }, esc(name));
      b.addEventListener('click', () => { lo.tool = t; paintPalette(); });
      pal.append(b);
    });
    paintPalette();
    root.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.preset === 'clear') { lo.els = []; lo.selected = -1; } else loPreset(b.dataset.preset);
      const seg = root.querySelector('.seg.small'); if (seg && seg.refresh) seg.refresh();
      update();
    }));
    const wrap = root.querySelector('[data-out="svg"]');
    wrap.addEventListener('click', (e) => {
      const inp = e.target.closest ? e.target.closest('.inp') : null;
      if (inp) {
        const m = +inp.dataset.m;
        const others = lo.input.reduce((a, b) => a + b, 0) - lo.input[m];
        lo.input[m] = (lo.input[m] + 1) % 3;
        if (others + lo.input[m] > 4) lo.input[m] = 0;
        update(); return;
      }
      const cell = e.target.closest ? e.target.closest('.cell') : null;
      if (!cell) return;
      const col = +cell.dataset.c, mode = +cell.dataset.q;
      const hit = lo.els.findIndex((el) => loCovers(el, col, mode));
      if (lo.tool === 'erase') { if (hit >= 0) { lo.els.splice(hit, 1); lo.selected = -1; } }
      else if (hit >= 0) lo.selected = hit;
      else if (lo.tool === 'bs') {
        const m0 = mode + 1 < lo.modes ? mode : mode - 1;
        if (m0 >= 0 && !lo.els.some((el) => loCovers(el, col, m0) || loCovers(el, col, m0 + 1))) { lo.els.push({ type: 'bs', mode: m0, col, theta: Math.PI / 4 }); lo.selected = lo.els.length - 1; }
      } else { lo.els.push({ type: 'ps', mode, col, phi: Math.PI / 2 }); lo.selected = lo.els.length - 1; }
      update();
    });

    let paramFor = -2;
    function paintParam() {
      const box = root.querySelector('[data-out="param"]');
      const e = lo.els[lo.selected];
      const key = lo.selected + (e ? e.type : '');
      if (key === paramFor) { if (box.firstChild && box.firstChild.refresh) box.firstChild.refresh(); return; }
      paramFor = key;
      box.innerHTML = '';
      if (!e) return;
      box.append(e.type === 'bs'
        ? ui.slider({ label: L('Splitting of the selected beam splitter', '選択中のビームスプリッタの分岐比'), unit: '%', min: 0, max: 100, step: 1, digits: 0,
          get: () => Math.pow(Math.sin(lo.els[lo.selected].theta), 2) * 100, set: (v) => { lo.els[lo.selected].theta = Math.asin(Math.sqrt(v / 100)); }, onChange: () => update() })
        : ui.slider({ label: L('Phase of the selected shifter', '選択中の位相シフタの位相'), unit: 'π', min: 0, max: 2, step: 0.01, digits: 2,
          get: () => lo.els[lo.selected].phi / Math.PI, set: (v) => { lo.els[lo.selected].phi = v * Math.PI; }, onChange: () => update() }));
    }

    function update() {
      wrap.innerHTML = loSvg();
      paintParam();
      const d = YR.derive.ph();
      const els = lo.els.filter((e) => e.col < lo.cols && e.mode < lo.modes && (e.type !== 'bs' || e.mode + 1 < lo.modes)).slice().sort((a, b) => a.col - b.col);
      const U = YR.linearoptics.circuitUnitary(lo.modes, els);
      const n = lo.input.reduce((a, b) => a + b, 0);
      const dist = YR.linearoptics.outputDistribution(U, lo.input);
      const shown = dist.filter((x) => x.quantum > 1e-9 || x.classical > 1e-9).sort((a, b) => Math.max(b.quantum, b.classical) - Math.max(a.quantum, a.classical));
      const top = shown.slice(0, 18);
      YR.plot.bars(root.querySelector('[data-plot="dist"]'), {
        labels: top.map((x) => x.occ.join('')), groups: [{ values: top.map((x) => x.quantum), color: 's1' }, { values: top.map((x) => x.classical), color: 's2' }],
        yLabel: L('probability', '確率'), rotate: lo.modes > 3
      });
      ui.out(root, 'distnote', esc(L('Labels give the photon number in each output mode, mode 0 first.', 'ラベルは各出力モードの光子数で、モード 0 から順に並べています。') +
        (shown.length > top.length ? L(' Showing the 18 most likely of ' + shown.length + ' outcomes.', ' ' + shown.length + ' 通りのうち、確率の高い 18 通りを表示しています。') : '')));
      const bunch = (key) => dist.filter((x) => x.occ.some((k) => k >= 2)).reduce((a, x) => a + x[key], 0);
      ui.out(root, 'bunch', ui.val(n >= 2 ? (bunch('quantum') * 100).toFixed(1) : '—', n >= 2 ? '%' : ''));
      ui.out(root, 'bunchc', ui.val(n >= 2 ? (bunch('classical') * 100).toFixed(1) : '—', n >= 2 ? '%' : ''));
      ui.out(root, 'surv', ui.val((Math.pow(d.eta, n) * 100).toFixed(1), '%'));
      ui.out(root, 'surv-sub', 'η = ' + (d.eta * 100).toFixed(1) + ' %, n = ' + n);
      ui.out(root, 'outs', ui.val(String(shown.length)));
      ui.out(root, 'outs-sub', esc(L('of ', '全 ') + dist.length + L(' configurations', ' 通り中')));
    }
    return update;
  }

  YR.views.circuit = {
    title: () => (state.platform === 'sc' ? L('Quantum circuit', '量子回路') : L('Photonic circuit', '光量子回路')),
    sub: () => (state.platform === 'sc' ? L('Gates with device noise', 'デバイス雑音つきゲート') : L('Few-photon interference', '少数光子の干渉')),
    render(root) { return state.platform === 'sc' ? renderSc(root) : renderPh(root); }
  };
})(globalThis.YR = globalThis.YR || {});
