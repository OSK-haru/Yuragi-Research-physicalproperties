/* Materials: pick the stack and see what it costs in loss. */
(function (YR) {
  'use strict';
  const L = YR.L, LL = YR.LL, esc = YR.fmt.esc, sig = YR.fmt.sig, state = YR.state, ui = YR.ui;

  function banner() {
    return '<div class="banner"><b>' + esc(L('Placeholder data', '仮データ')) + '</b><span>' + esc(L(
      'The material values on this page are representative figures typed in for the mockup. Loss tangents depend strongly on process; replace them with sourced values before drawing conclusions.',
      'このページの材料値は、モックアップ用に入力した代表的な数値です。損失正接は製造工程で大きく変わります。結論を出す前に、出典のある値へ置き換えてください。')) + '</span></div>';
  }

  // ---------------- superconducting ----------------
  function renderSc(root) {
    const s = state.sc;
    const films = YR.materials.films, subs = YR.materials.substrates;
    const html =
      ui.head(L('Stage 01 · Superconducting', '工程 01 · 超伝導'), L('Materials', '材料'),
        L('Choose the superconducting film and the substrate. The loss budget below sets the T1 that every later stage uses.',
          '超伝導薄膜と基板を選びます。下の損失の内訳から決まる T1 を、以降のすべての工程が使います。')) +
      banner() +
      '<div class="grid g-wide">' +
        '<div class="stack">' +
          '<div class="panel"><div class="panel-head"><h2>' + esc(L('Superconducting film', '超伝導薄膜')) + '</h2><div class="right">' + ui.tag('placeholder') + '</div></div>' +
            '<div class="scroll-x"><table class="data"><thead><tr><th>' + esc(L('Film', '薄膜')) + '</th><th class="num">Tc [K]</th><th class="num">Δ [µeV]</th><th class="num">2Δ/h [GHz]</th><th>' +
            esc(L('Surface oxide', '表面酸化膜')) + '</th><th class="num">tan δ</th></tr></thead><tbody>' +
            films.map((f) => {
              const g = YR.sc.bcsGap(f.tc);
              return '<tr class="pick" tabindex="0" data-film="' + f.id + '"><td><b>' + esc(f.name) + '</b><div class="dim">' + esc(LL(f.note)) + '</div></td><td class="num">' + f.tc.toFixed(1) +
                '</td><td class="num">' + g.microEv.toFixed(0) + '</td><td class="num">' + g.pairBreakingGHz.toFixed(0) + '</td><td>' + esc(f.oxide) + '</td><td class="num">' + sig(f.tandSurface, 2) + '</td></tr>';
            }).join('') + '</tbody></table></div>' +
            '<p class="note">' + esc(L('Δ and 2Δ/h are computed from Tc with the BCS relation Δ = 1.764 kB Tc.', 'Δ と 2Δ/h は、BCS の関係式 Δ = 1.764 kB Tc を使って Tc から計算しています。')) + '</p></div>' +
          '<div class="panel"><div class="panel-head"><h2>' + esc(L('Substrate', '基板')) + '</h2><div class="right">' + ui.tag('placeholder') + '</div></div>' +
            '<table class="data"><thead><tr><th>' + esc(L('Substrate', '基板')) + '</th><th class="num">εr</th><th class="num">tan δ ' + esc(L('(bulk)', '(バルク)')) + '</th></tr></thead><tbody>' +
            subs.map((b) => '<tr class="pick" tabindex="0" data-sub="' + b.id + '"><td><b>' + esc(LL(b.name)) + '</b><div class="dim">' + esc(LL(b.note)) + '</div></td><td class="num">' + b.epsR.toFixed(2) +
              '</td><td class="num">' + sig(b.tandBulk, 2) + '</td></tr>').join('') + '</tbody></table></div>' +
          '<div class="panel"><div class="panel-head"><h2>' + esc(L('T1 limit for every combination', 'すべての組み合わせの T1 上限')) + '</h2><div class="right">' + ui.tag('computed') + '</div></div>' +
            '<canvas class="plot" data-plot="combos"></canvas>' +
            '<p class="note">' + esc(L('Dielectric loss only, at the current qubit frequency and pad gap. The highlighted bar is your selection.',
              '誘電損失だけを考えた値で、現在の量子ビット周波数とパッドのギャップで計算しています。明るい棒が現在の選択です。')) + '</p></div>' +
        '</div>' +
        '<div class="stack">' +
          '<div class="panel"><div class="panel-head"><h2>' + esc(L('Loss budget', '損失の内訳')) + '</h2><div class="right">' + ui.tag('computed') + '</div></div>' +
            '<div class="stats">' + ui.stat('t1d', L('T1 limit (dielectric)', 'T1 上限 (誘電損失)'), 'key') + ui.stat('qtot', L('Σ p·tan δ', 'Σ p·tan δ')) + '</div>' +
            '<div style="margin-top:10px"><i data-slot="gap"></i></div>' +
            '<table class="data" style="margin-top:6px"><thead><tr><th>' + esc(L('Channel', '経路')) + '</th><th class="num">p</th><th class="num">tan δ</th><th class="num">' + esc(L('share', '割合')) + '</th></tr></thead><tbody data-out="channels"></tbody></table>' +
            '<p class="note">' + esc(L('1/T1 = 2π f Σ pᵢ tan δᵢ. Surface participations are scaled as 1/gap from a reference geometry.',
              '1/T1 = 2π f Σ pᵢ tan δᵢ。表面の参加率は、基準形状から 1/ギャップ で換算しています。')) + '</p></div>' +
          '<div class="panel"><div class="panel-head"><h2>' + esc(L('Operating point', '動作点')) + '</h2><div class="right">' + ui.tag('computed') + '</div></div>' +
            '<i data-slot="temp"></i>' +
            '<div class="stats" style="margin-top:8px">' + ui.stat('xqp', L('Thermal quasiparticles', '熱励起準粒子の割合')) + ui.stat('ttc', 'T / Tc') + ui.stat('pair', L('Pair-breaking 2Δ/h', '対破壊周波数 2Δ/h')) + '</div>' +
            '<p class="note">' + esc(L('Equilibrium estimate. Measured devices show far more quasiparticles than this; that excess is not modelled here.',
              '熱平衡での見積もりです。実際のデバイスではこれよりはるかに多くの準粒子が観測されますが、その過剰分はここでは扱っていません。')) + '</p></div>' +
        '</div>' +
      '</div>';

    ui.mount(root, html, {
      gap: ui.slider({ label: L('Pad gap (sets surface participation)', 'パッドのギャップ (表面の参加率を決める)'), unit: 'µm', min: 10, max: 100, step: 1, digits: 0, get: () => s.gap, set: (v) => { s.gap = v; } }),
      temp: ui.slider({ label: L('Stage temperature', '冷却ステージ温度'), unit: 'mK', min: 10, max: 400, step: 5, digits: 0, get: () => s.tempMk, set: (v) => { s.tempMk = v; } })
    });
    const pick = (attr, key) => root.querySelectorAll('[data-' + attr + ']').forEach((row) => {
      const act = () => { s[key] = row.dataset[attr]; YR.changed(true); };
      row.addEventListener('click', act);
      row.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } });
    });
    pick('film', 'film'); pick('sub', 'substrate');

    return function update() {
      const d = YR.derive.sc();
      root.querySelectorAll('[data-film]').forEach((r) => r.setAttribute('aria-selected', String(r.dataset.film === s.film)));
      root.querySelectorAll('[data-sub]').forEach((r) => r.setAttribute('aria-selected', String(r.dataset.sub === s.substrate)));
      const total = d.channels.reduce((a, c) => a + c.p * c.tand, 0);
      const t = YR.fmt.timeUs(d.t1Diel);
      ui.out(root, 't1d', ui.val(t[0], t[1]));
      ui.out(root, 't1d-sub', esc(L('at ', '') + d.tr.f01.toFixed(2) + ' GHz' + L('', ' で')));
      ui.out(root, 'qtot', ui.val(sig(total, 3)));
      ui.out(root, 'qtot-sub', 'Q ≈ ' + sig(1 / total, 2));
      ui.out(root, 'channels', d.channels.map((c) =>
        '<tr><td>' + esc(LL(c.label)) + '</td><td class="num">' + sig(c.p, 2) + '</td><td class="num">' + sig(c.tand, 2) +
        '</td><td class="num">' + (c.p * c.tand / total * 100).toFixed(0) + ' %</td></tr>').join(''));
      ui.out(root, 'xqp', ui.val(d.xqp < 1e-99 ? '< 1e-99' : sig(d.xqp, 2)));
      ui.out(root, 'ttc', ui.val((s.tempMk / 1000 / d.film.tc).toFixed(3)));
      ui.out(root, 'pair', ui.val(d.gap.pairBreakingGHz.toFixed(0), 'GHz'));

      const labels = [], values = [];
      let hi = 0;
      for (const b of YR.materials.substrates) {
        for (const f of YR.materials.films) {
          if (f.id === s.film && b.id === s.substrate) hi = labels.length;
          labels.push(f.name + ' / ' + (b.id === 'Sapphire' ? 'Al₂O₃' : b.id));
          values.push(YR.sc.dielectricT1(d.tr.f01, YR.derive.lossChannels(s, f, b)));
        }
      }
      YR.plot.bars(root.querySelector('[data-plot="combos"]'), { labels, groups: [{ values, color: 'accent' }], yLabel: 'T1 [µs]', highlight: hi, rotate: true });
    };
  }

  // ---------------- photonic ----------------
  function renderPh(root) {
    const s = state.ph;
    const mats = YR.materials.photonic;
    const html =
      ui.head(L('Stage 01 · Photonic', '工程 01 · 光'), L('Materials', '材料'),
        L('Choose the waveguide platform. Its index contrast sets the device sizes, and its loss sets how much quantum light survives the chip.',
          '導波路の材料系を選びます。屈折率差がデバイスの寸法を決め、損失が、チップを通ったあとに残る量子光の量を決めます。')) +
      banner() +
      '<div class="panel" style="margin-bottom:14px"><div class="panel-head"><h2>' + esc(L('Waveguide platform', '導波路の材料系')) + '</h2><div class="right">' + ui.tag('placeholder') + ui.tag('computed') + '</div></div>' +
        '<div class="scroll-x"><table class="data"><thead><tr><th>' + esc(L('Platform', '材料系')) + '</th><th class="num">n ' + esc(L('core / clad', 'コア / クラッド')) + '</th><th class="num">' + esc(L('Loss [dB/cm]', '損失 [dB/cm]')) +
        '</th><th class="num">n_eff</th><th class="num">n_g</th><th>' + esc(L('Nonlinearity', '非線形性')) + '</th><th>' + esc(L('Modulation', '変調')) + '</th><th>' + esc(L('Photon source', '光子源')) + '</th></tr></thead><tbody>' +
        mats.map((m) => {
          const geom = { nCore: m.nCore, nSub: m.nClad, nClad: m.nClad, h: m.h, w: m.w, lambda: m.lambda };
          const mode = YR.photonics.stripMode(geom);
          const ng = mode ? YR.photonics.groupIndex(geom) : null;
          return '<tr class="pick" tabindex="0" data-mat="' + m.id + '"><td><b>' + esc(LL(m.name)) + '</b><div class="dim">' + esc(LL(m.note)) + '</div></td><td class="num">' + m.nCore.toFixed(3) + ' / ' + m.nClad.toFixed(3) +
            '</td><td class="num">' + m.lossDbCm + '</td><td class="num">' + (mode ? mode.neff.toFixed(3) : '—') + '</td><td class="num">' + (ng ? ng.toFixed(2) : '—') + '</td><td>' + esc(LL(m.nonlinear)) +
            '</td><td>' + esc(LL(m.modulator)) + '</td><td>' + esc(LL(m.source)) + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<p class="note">' + esc(L('n_eff and n_g are computed for each platform\'s default strip (effective-index method, material dispersion not included).',
          'n_eff と n_g は、各材料系の標準的なストリップ導波路について計算した値です (等価屈折率法、材料分散は含みません)。')) + '</p></div>' +
      '<div class="grid g-side">' +
        '<div class="panel"><div class="panel-head"><h2>' + esc(L('Loss budget', '損失の内訳')) + '</h2><div class="right">' + ui.tag('computed') + '</div></div>' +
          '<i data-slot="path"></i><i data-slot="couple"></i><i data-slot="det"></i>' +
          '<div class="stats" style="margin-top:8px">' + ui.stat('eta', L('Total efficiency η', '全体の効率 η'), 'key') + ui.stat('chip', L('On-chip loss', 'チップ内の損失')) +
          ui.stat('sq', L('Squeezing left', '残るスクイージング')) + ui.stat('pair', L('Photon pair survives', '光子対が残る確率')) + '</div>' +
          '<p class="note">' + esc(L('η = coupling × propagation × detector. Squeezing is shown for the source strength set in Dynamics.',
            'η = 結合 × 伝搬 × 検出器。スクイージングは、ダイナミクスで設定した光源の強さに対する値です。')) + '</p></div>' +
        '<div class="panel"><div class="panel-head"><h2>' + esc(L('Transmission against path length', '光路長に対する透過率')) + '</h2><div class="right">' + ui.tag('computed') + '</div></div>' +
          '<canvas class="plot tall" data-plot="trans"></canvas>' +
          YR.plot.legend(mats.map((m, i) => ({ color: 's' + (i + 1), label: LL(m.name) }))) + '</div>' +
      '</div>';

    ui.mount(root, html, {
      path: ui.slider({ label: L('Optical path on chip', 'チップ内の光路長'), unit: 'mm', min: 1, max: 200, step: 1, digits: 0, get: () => s.pathMm, set: (v) => { s.pathMm = v; } }),
      couple: ui.slider({ label: L('Coupling loss (in + out)', '結合損失 (入出力の合計)'), unit: 'dB', min: 0, max: 6, step: 0.1, digits: 1, get: () => s.couplingDb, set: (v) => { s.couplingDb = v; } }),
      det: ui.slider({ label: L('Detector efficiency', '検出器の効率'), unit: '%', min: 50, max: 99, step: 1, digits: 0, get: () => s.detector * 100, set: (v) => { s.detector = v / 100; } })
    });
    root.querySelectorAll('[data-mat]').forEach((row) => {
      const act = () => {
        const m = YR.derive.byId(mats, row.dataset.mat);
        s.platform = m.id; s.w = m.w; s.h = m.h; s.lambda = m.lambda;
        YR.changed(true);
      };
      row.addEventListener('click', act);
      row.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } });
    });

    return function update() {
      const d = YR.derive.ph();
      root.querySelectorAll('[data-mat]').forEach((r) => r.setAttribute('aria-selected', String(r.dataset.mat === s.platform)));
      ui.out(root, 'eta', ui.val((d.eta * 100).toFixed(1), '%'));
      ui.out(root, 'eta-sub', '−' + (-10 * Math.log10(d.eta)).toFixed(2) + ' dB');
      ui.out(root, 'chip', ui.val(d.chipDb.toFixed(2), 'dB'));
      ui.out(root, 'chip-sub', d.mat.lossDbCm + ' dB/cm × ' + s.pathMm + ' mm');
      ui.out(root, 'sq', ui.val(d.squeezeDb.toFixed(2), 'dB'));
      ui.out(root, 'sq-sub', esc(L('source: ', '光源: ') + d.squeezeIdealDb.toFixed(1) + ' dB'));
      ui.out(root, 'pair', ui.val((d.eta * d.eta * 100).toFixed(1), '%'));
      ui.out(root, 'pair-sub', 'η²');
      const xs = [];
      for (let i = 0; i <= 100; i++) xs.push(i * 2);
      YR.plot.line(root.querySelector('[data-plot="trans"]'), {
        series: mats.map((m, i) => ({ x: xs, y: xs.map((x) => Math.pow(10, -m.lossDbCm * x / 100)), color: 's' + (i + 1), width: m.id === s.platform ? 2.6 : 1.4 })),
        yLog: true, yRange: [1e-4, 1], xLabel: L('path length [mm]', '光路長 [mm]'), yLabel: L('transmission', '透過率'),
        vlines: [{ x: s.pathMm, label: s.pathMm + ' mm', color: 'accent' }]
      });
    };
  }

  YR.views.materials = {
    title: () => L('Materials', '材料'),
    sub: () => (state.platform === 'sc' ? L('Film, substrate, loss', '薄膜・基板・損失') : L('Platform, loss', '材料系・損失')),
    render(root) { return state.platform === 'sc' ? renderSc(root) : renderPh(root); }
  };
})(globalThis.YR = globalThis.YR || {});
