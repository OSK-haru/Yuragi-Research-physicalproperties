/* Device design: transmon / readout / coupling, or waveguide / ring / interferometer. */
(function (YR) {
  'use strict';
  const L = YR.L, esc = YR.fmt.esc, sig = YR.fmt.sig, state = YR.state, ui = YR.ui;

  /** Average error of idling for time t under T1 and T2 (same units). */
  function idleError(t, t1, t2) {
    return (3 - Math.exp(-t / t1) - 2 * Math.exp(-t / t2)) / 6;
  }

  // ---------------- superconducting ----------------
  function renderSc(root) {
    const s = state.sc;
    const html =
      ui.head(L('Stage 02 · Superconducting', '工程 02 · 超伝導'), L('Device', 'デバイス'),
        L('Size the junction and the capacitor, then the readout resonator and the coupling to a neighbour. The spectrum is solved numerically, not taken from the asymptotic formula.',
          '接合とキャパシタの大きさを決め、次に読み出し共振器と隣の量子ビットとの結合を決めます。スペクトルは近似式ではなく、数値的に解いています。')) +
      '<div class="grid g-side" style="margin-bottom:14px">' +
        '<div class="panel"><div class="panel-head"><h2>' + esc(L('Transmon', 'トランズモン')) + '</h2></div>' +
          '<i data-slot="ic"></i><i data-slot="c"></i>' +
          '<div class="stats" style="margin-top:8px">' + ui.stat('f01', 'f01', 'key') + ui.stat('alpha', L('Anharmonicity α', '非調和性 α')) + ui.stat('ratio', 'EJ / EC') +
          ui.stat('ej', 'EJ / h') + ui.stat('ec', 'EC / h') + ui.stat('disp', L('Charge dispersion', '電荷分散')) + '</div></div>' +
        '<div class="panel"><div class="panel-head"><h2>' + esc(L('Energy levels against offset charge', 'オフセット電荷に対するエネルギー準位')) + '</h2><div class="right">' + ui.tag('computed') + '</div></div>' +
          '<canvas class="plot tall" data-plot="levels"></canvas>' +
          YR.plot.legend([{ color: 's1', label: 'E0' }, { color: 's2', label: 'E1' }, { color: 's3', label: 'E2' }, { color: 's4', label: 'E3' }]) +
          '<p class="note">' + esc(L('Lower EJ/EC (smaller junction or smaller capacitor) and the bands start to bend: the qubit becomes sensitive to charge noise.',
            'EJ/EC を下げる (接合またはキャパシタを小さくする) と、準位が曲がり始めます。量子ビットが電荷雑音に敏感になるということです。')) + '</p></div>' +
      '</div>' +
      '<div class="grid g3">' +
        '<div class="panel"><div class="panel-head"><h2>' + esc(L('Dispersive readout', '分散読み出し')) + '</h2><div class="right">' + ui.tag('computed') + '</div></div>' +
          '<i data-slot="fr"></i><i data-slot="g"></i><i data-slot="kappa"></i>' +
          '<div class="stats" style="margin-top:8px">' + ui.stat('chi', L('Dispersive shift χ', '分散シフト χ')) + ui.stat('purcell', L('Purcell T1', 'パーセル T1')) +
          ui.stat('ncrit', L('Critical photons', '臨界光子数')) + ui.stat('gdelta', 'g / Δ') + '</div>' +
          '<p class="note">' + esc(L('No Purcell filter is assumed, so this is a worst case for the Purcell limit.', 'パーセルフィルタなしの場合で、パーセル限界としては最も厳しい見積もりです。')) + '</p></div>' +
        '<div class="panel"><div class="panel-head"><h2>' + esc(L('Coupling and residual ZZ', '結合と残留 ZZ')) + '</h2><div class="right">' + ui.tag('computed') + '</div></div>' +
          '<i data-slot="neighbour"></i><i data-slot="j"></i>' +
          '<canvas class="plot short" data-plot="zz"></canvas>' +
          '<div class="stats" style="margin-top:8px">' + ui.stat('zz', L('Static ZZ', '静的 ZZ')) + ui.stat('f2', L('Neighbour f01', '隣の f01')) + '</div></div>' +
        '<div class="panel"><div class="panel-head"><h2>' + esc(L('Coherence budget', 'コヒーレンスの内訳')) + '</h2><div class="right">' + ui.tag('computed') + '</div></div>' +
          '<i data-slot="tphi"></i><i data-slot="t1q"></i><i data-slot="t2q"></i>' +
          '<div class="stats" style="margin-top:8px">' + ui.stat('t1', 'T1', 'key') + ui.stat('t2', 'T2') + ui.stat('e1', L('1-qubit gate limit', '1 量子ビットゲートの限界')) +
          ui.stat('e2', L('2-qubit gate limit', '2 量子ビットゲートの限界')) + '</div>' +
          '<p class="note" data-out="t1note"></p></div>' +
      '</div>';

    ui.mount(root, html, {
      ic: ui.slider({ label: L('Junction critical current', '接合の臨界電流'), unit: 'nA', min: 2, max: 60, step: 0.5, digits: 1, get: () => s.ic, set: (v) => { s.ic = v; } }),
      c: ui.slider({ label: L('Shunt capacitance', 'シャント容量'), unit: 'fF', min: 20, max: 120, step: 1, digits: 0, get: () => s.c, set: (v) => { s.c = v; } }),
      fr: ui.slider({ label: L('Resonator frequency', '共振器周波数'), unit: 'GHz', min: 5.5, max: 9, step: 0.01, digits: 2, get: () => s.fr, set: (v) => { s.fr = v; } }),
      g: ui.slider({ label: L('Coupling g/2π', '結合 g/2π'), unit: 'MHz', min: 10, max: 200, step: 1, digits: 0, get: () => s.g, set: (v) => { s.g = v; } }),
      kappa: ui.slider({ label: L('Linewidth κ/2π', '線幅 κ/2π'), unit: 'MHz', min: 0.1, max: 5, step: 0.05, digits: 2, get: () => s.kappa, set: (v) => { s.kappa = v; } }),
      neighbour: ui.slider({ label: L('Neighbour detuning', '隣との離調'), unit: 'GHz', min: -0.6, max: 0.6, step: 0.005, digits: 3, get: () => s.neighbour, set: (v) => { s.neighbour = v; } }),
      j: ui.slider({ label: L('Exchange coupling J/2π', '交換結合 J/2π'), unit: 'MHz', min: 0, max: 15, step: 0.1, digits: 1, get: () => s.j, set: (v) => { s.j = v; } }),
      tphi: ui.slider({ label: L('Pure dephasing time Tφ', '純位相緩和時間 Tφ'), unit: 'µs', min: 5, max: 500, step: 5, digits: 0, get: () => s.tphi, set: (v) => { s.tphi = v; } }),
      t1q: ui.slider({ label: L('1-qubit gate time', '1 量子ビットゲート時間'), unit: 'ns', min: 10, max: 100, step: 1, digits: 0, get: () => s.t1q, set: (v) => { s.t1q = v; } }),
      t2q: ui.slider({ label: L('2-qubit gate time', '2 量子ビットゲート時間'), unit: 'ns', min: 30, max: 500, step: 5, digits: 0, get: () => s.t2q, set: (v) => { s.t2q = v; } })
    });

    return function update() {
      const d = YR.derive.sc();
      const tr = d.tr;
      const setCls = (id, cls) => { const n = root.querySelector('[data-stat="' + id + '"]'); if (n) n.className = 'stat' + (cls ? ' ' + cls : ''); };
      ui.out(root, 'f01', ui.val(tr.f01.toFixed(3), 'GHz'));
      ui.out(root, 'f01-sub', '√(8EJEC) − EC = ' + tr.f01Asymptotic.toFixed(3));
      ui.out(root, 'alpha', ui.val((tr.alpha * 1000).toFixed(0), 'MHz'));
      ui.out(root, 'alpha-sub', '−EC = ' + (-d.ec * 1000).toFixed(0) + ' MHz');
      ui.out(root, 'ratio', ui.val(sig(tr.ratio, 3)));
      ui.out(root, 'ratio-sub', esc(tr.ratio >= 30 ? L('transmon regime', 'トランズモン領域') : tr.ratio >= 10 ? L('charge-sensitive', '電荷に敏感') : L('Cooper-pair-box regime', 'クーパー対箱の領域')));
      setCls('ratio', tr.ratio >= 30 ? '' : tr.ratio >= 10 ? 'warn' : 'bad');
      ui.out(root, 'ej', ui.val(d.ej.toFixed(2), 'GHz'));
      ui.out(root, 'ec', ui.val((d.ec * 1000).toFixed(0), 'MHz'));
      const dispHz = tr.dispersion01 * 1e9;
      ui.out(root, 'disp', dispHz >= 1e6 ? ui.val((dispHz / 1e6).toFixed(2), 'MHz') : dispHz >= 1e3 ? ui.val((dispHz / 1e3).toFixed(1), 'kHz') : ui.val(sig(dispHz, 2), 'Hz'));
      ui.out(root, 'disp-sub', esc(L('peak to peak of f01', 'f01 の最大変動幅')));
      setCls('disp', dispHz > 1e6 ? 'bad' : dispHz > 3e4 ? 'warn' : '');

      // energy bands
      const ngs = [], bands = [[], [], [], []];
      const ref = YR.sc.transmonLevels(d.ej, d.ec, 0, 1, 10)[0];
      for (let i = 0; i <= 40; i++) {
        const ng = -1 + i * 0.05;
        const e = YR.sc.transmonLevels(d.ej, d.ec, ng, 4, 10);
        ngs.push(ng);
        for (let k = 0; k < 4; k++) bands[k].push(e[k] - ref);
      }
      YR.plot.line(root.querySelector('[data-plot="levels"]'), {
        series: bands.map((y, k) => ({ x: ngs, y, color: 's' + (k + 1) })),
        xLabel: L('offset charge n_g', 'オフセット電荷 n_g'), yLabel: L('E / h [GHz]', 'E / h [GHz]')
      });

      // readout
      const ro = d.ro;
      ui.out(root, 'chi', ui.val((ro.chiMHz).toFixed(3), 'MHz'));
      ui.out(root, 'chi-sub', '2|χ|/κ = ' + (2 * Math.abs(ro.chiMHz) / s.kappa).toFixed(2));
      const pt = YR.fmt.timeUs(ro.purcellT1);
      ui.out(root, 'purcell', ui.val(pt[0], pt[1]));
      ui.out(root, 'ncrit', ui.val(sig(ro.nCrit, 3)));
      ui.out(root, 'gdelta', ui.val(Math.abs(s.g / 1000 / ro.delta).toFixed(3)));
      ui.out(root, 'gdelta-sub', esc(ro.dispersive ? L('dispersive regime', '分散領域') : L('not dispersive', '分散領域の外')));
      setCls('gdelta', ro.dispersive ? '' : 'bad');

      // ZZ sweep
      const xs = [], ys = [];
      for (let i = 0; i <= 240; i++) {
        const det = -0.6 + i * 0.005;
        xs.push(det);
        ys.push(Math.abs(YR.sc.staticZZ(tr.f01, tr.alpha, tr.f01 + det, tr.alpha, s.j / 1000)) * 1e6);
      }
      YR.plot.line(root.querySelector('[data-plot="zz"]'), {
        series: [{ x: xs, y: ys, color: 'accent' }], yLog: true, yRange: [0.1, 1e5],
        xLabel: L('neighbour detuning [GHz]', '隣との離調 [GHz]'), yLabel: '|ZZ| [kHz]',
        vlines: [{ x: s.neighbour, color: 's2' }]
      });
      ui.out(root, 'zz', ui.val(Math.abs(d.zzKHz) >= 1000 ? (d.zzKHz / 1000).toFixed(2) : d.zzKHz.toFixed(1), Math.abs(d.zzKHz) >= 1000 ? 'MHz' : 'kHz'));
      const near = Math.abs(Math.abs(s.neighbour) - Math.abs(tr.alpha)) < 0.03 || Math.abs(s.neighbour) < 0.02;
      ui.out(root, 'zz-sub', esc(near ? L('near a level crossing', '準位交差の近く') : Math.abs(s.neighbour) < Math.abs(tr.alpha) ? L('straddling regime', 'ストラドリング領域') : L('outside straddling regime', 'ストラドリング領域の外')));
      setCls('zz', near ? 'bad' : Math.abs(d.zzKHz) > 200 ? 'warn' : '');
      ui.out(root, 'f2', ui.val(d.f2.toFixed(3), 'GHz'));

      // coherence
      const t1 = YR.fmt.timeUs(d.t1), t2 = YR.fmt.timeUs(d.t2), td = YR.fmt.timeUs(d.t1Diel);
      ui.out(root, 't1', ui.val(t1[0], t1[1]));
      ui.out(root, 't2', ui.val(t2[0], t2[1]));
      ui.out(root, 't2-sub', '1/T2 = 1/2T1 + 1/Tφ');
      ui.out(root, 'e1', ui.val(sig(idleError(s.t1q / 1000, d.t1, d.t2), 2)));
      ui.out(root, 'e2', ui.val(sig(2 * idleError(s.t2q / 1000, d.t1, d.t2), 2)));
      ui.out(root, 'e2-sub', esc(L('both qubits', '2 量子ビット分')));
      ui.out(root, 't1note', esc(L(
        'T1 combines the dielectric limit from Materials (' + td[0] + ' ' + td[1] + ') with the Purcell limit (' + pt[0] + ' ' + pt[1] + '). Gate limits count decoherence only.',
        'T1 は、材料から決まる誘電損失の上限 (' + td[0] + ' ' + td[1] + ') とパーセル限界 (' + pt[0] + ' ' + pt[1] + ') を合わせた値です。ゲートの限界はデコヒーレンスだけを数えています。')));
    };
  }

  // ---------------- photonic ----------------
  function renderPh(root) {
    const s = state.ph;
    const html =
      ui.head(L('Stage 02 · Photonic', '工程 02 · 光'), L('Device', 'デバイス'),
        L('Size the waveguide, then the ring resonator used as a photon source or filter, and the interferometer used as a tunable beam splitter.',
          '導波路の寸法を決め、次に光子源やフィルタに使うリング共振器と、可変ビームスプリッタに使う干渉計を決めます。')) +
      '<div class="grid g-side" style="margin-bottom:14px">' +
        '<div class="panel"><div class="panel-head"><h2>' + esc(L('Strip waveguide', 'ストリップ導波路')) + '</h2></div>' +
          '<i data-slot="w"></i><i data-slot="h"></i><i data-slot="lambda"></i>' +
          '<div class="stats" style="margin-top:8px">' + ui.stat('neff', 'n_eff', 'key') + ui.stat('ng', 'n_g') + ui.stat('modes', L('Lateral modes', '横モード数')) + ui.stat('nslab', L('Slab index', 'スラブ屈折率')) + '</div>' +
          '<p class="note">' + esc(L('Effective-index method for the quasi-TE mode. It overestimates confinement in small high-contrast guides; a full mode solver is planned.',
            '準 TE モードを等価屈折率法で求めています。高屈折率差の細い導波路では閉じ込めを強めに見積もります。本格的なモードソルバは今後の予定です。')) + '</p></div>' +
        '<div class="panel"><div class="panel-head"><h2>' + esc(L('Lateral mode profile', '横方向のモード分布')) + '</h2><div class="right">' + ui.tag('computed') + '</div></div>' +
          '<canvas class="plot tall" data-plot="mode"></canvas>' +
          '<p class="note">' + esc(L('Dashed lines mark the waveguide edges. The field outside them is what couples to a neighbouring guide or scatters at a rough sidewall.',
            '破線は導波路の端です。その外側にしみ出した電界が、隣の導波路との結合や、側壁の荒れによる散乱の原因になります。')) + '</p></div>' +
      '</div>' +
      '<div class="grid g2">' +
        '<div class="panel"><div class="panel-head"><h2>' + esc(L('Ring resonator', 'リング共振器')) + '</h2><div class="right">' + ui.tag('computed') + '</div></div>' +
          '<div class="grid g2" style="gap:0 18px"><i data-slot="ring"></i><i data-slot="kappa2"></i></div>' +
          '<canvas class="plot" data-plot="ring"></canvas>' +
          '<div class="stats" style="margin-top:8px">' + ui.stat('q', L('Loaded Q', '負荷 Q')) + ui.stat('qi', L('Intrinsic Q', '固有 Q')) + ui.stat('fsr', 'FSR') + ui.stat('er', L('Extinction', '消光比')) + '</div></div>' +
        '<div class="panel"><div class="panel-head"><h2>' + esc(L('Mach–Zehnder interferometer', 'マッハ・ツェンダー干渉計')) + '</h2><div class="right">' + ui.tag('computed') + '</div></div>' +
          '<div class="grid g2" style="gap:0 18px"><i data-slot="k1"></i><i data-slot="k2"></i></div>' +
          '<canvas class="plot" data-plot="mzi"></canvas>' +
          YR.plot.legend([{ color: 's1', label: L('cross port', 'クロス出力') }, { color: 's2', label: L('bar port', 'バー出力') }]) +
          '<div class="stats" style="margin-top:8px">' + ui.stat('mer', L('Extinction (cross)', '消光比 (クロス)')) + ui.stat('mmax', L('Reachable splitting', '設定できる分岐比')) + '</div></div>' +
      '</div>';

    ui.mount(root, html, {
      w: ui.slider({ label: L('Width', '幅'), unit: 'µm', min: 0.2, max: 6, step: 0.01, digits: 2, get: () => s.w, set: (v) => { s.w = v; } }),
      h: ui.slider({ label: L('Thickness', '厚さ'), unit: 'µm', min: 0.1, max: 6, step: 0.01, digits: 2, get: () => s.h, set: (v) => { s.h = v; } }),
      lambda: ui.slider({ label: L('Wavelength', '波長'), unit: 'µm', min: 0.75, max: 1.7, step: 0.005, digits: 3, get: () => s.lambda, set: (v) => { s.lambda = v; } }),
      ring: ui.slider({ label: L('Ring circumference', 'リングの周長'), unit: 'µm', min: 50, max: 3000, step: 10, digits: 0, get: () => s.ringLength, set: (v) => { s.ringLength = v; } }),
      kappa2: ui.slider({ label: L('Bus coupling (power)', 'バスとの結合 (パワー)'), unit: '%', min: 0.1, max: 40, step: 0.1, digits: 1, get: () => s.kappa2 * 100, set: (v) => { s.kappa2 = v / 100; } }),
      k1: ui.slider({ label: L('Coupler 1 splitting', 'カプラ 1 の分岐比'), unit: '%', min: 30, max: 70, step: 0.5, digits: 1, get: () => s.k1 * 100, set: (v) => { s.k1 = v / 100; } }),
      k2: ui.slider({ label: L('Coupler 2 splitting', 'カプラ 2 の分岐比'), unit: '%', min: 30, max: 70, step: 0.5, digits: 1, get: () => s.k2 * 100, set: (v) => { s.k2 = v / 100; } })
    });

    return function update() {
      const d = YR.derive.ph();
      const setCls = (id, cls) => { const n = root.querySelector('[data-stat="' + id + '"]'); if (n) n.className = 'stat' + (cls ? ' ' + cls : ''); };
      ui.out(root, 'neff', d.mode ? ui.val(d.mode.neff.toFixed(4)) : esc(L('cut off', 'カットオフ')));
      ui.out(root, 'ng', d.ng ? ui.val(d.ng.toFixed(3)) : '—');
      ui.out(root, 'ng-sub', esc(L('waveguide dispersion only', '導波路分散のみ')));
      ui.out(root, 'modes', d.mode ? ui.val(String(d.mode.lateralModes)) : '0');
      ui.out(root, 'modes-sub', esc(!d.mode ? L('no guided mode', '導波モードなし') : d.mode.lateralModes === 1 ? L('single mode', '単一モード') : L('multimode by this estimate', 'この見積もりでは多モード')));
      setCls('modes', !d.mode ? 'bad' : d.mode.lateralModes <= 2 ? '' : 'warn');
      ui.out(root, 'nslab', d.mode ? ui.val(d.mode.nSlab.toFixed(4)) : '—');

      const canvas = root.querySelector('[data-plot="mode"]');
      if (d.mode) {
        const span = Math.max(3 * s.w, s.w + 2), xs = [], ys = [];
        for (let i = 0; i <= 300; i++) {
          const x = -span / 2 + span * i / 300;
          xs.push(x);
          const f = d.mode.lateral.field(x + s.w / 2);
          ys.push(f * f);
        }
        const peak = Math.max.apply(null, ys);
        YR.plot.line(canvas, {
          series: [{ x: xs, y: ys.map((v) => v / peak), color: 'accent', width: 2.2 }],
          xLabel: L('lateral position [µm]', '横方向の位置 [µm]'), yLabel: L('|E|² (normalised)', '|E|² (規格化)'), yRange: [0, 1.08],
          vlines: [{ x: -s.w / 2 }, { x: s.w / 2 }]
        });
      } else {
        YR.plot.line(canvas, { series: [{ x: [0, 1], y: [NaN, NaN] }], xLabel: L('lateral position [µm]', '横方向の位置 [µm]') });
      }

      const r = d.ring;
      const span = r.fsr * 1.25, xs = [], ys = [];
      for (let i = 0; i <= 3000; i++) {
        const lam = s.lambda - span + 2 * span * i / 3000;
        xs.push((lam - s.lambda) * 1000);
        ys.push(r.transmission(lam));
      }
      YR.plot.line(root.querySelector('[data-plot="ring"]'), {
        series: [{ x: xs, y: ys, color: 'accent' }], yRange: [0, 1.05],
        xLabel: L('wavelength − λ0 [nm]', '波長 − λ0 [nm]'), yLabel: L('transmission', '透過率')
      });
      ui.out(root, 'q', ui.val(sig(r.q, 3)));
      ui.out(root, 'q-sub', 'FWHM ' + sig(r.fwhm * 1e6, 3) + ' pm');
      ui.out(root, 'qi', ui.val(sig(r.qIntrinsic, 3)));
      ui.out(root, 'qi-sub', d.mat.lossDbCm + ' dB/cm');
      ui.out(root, 'fsr', ui.val(sig(r.fsr * 1000, 3), 'nm'));
      ui.out(root, 'fsr-sub', esc(L('finesse ', 'フィネス ') + sig(r.finesse, 3)));
      ui.out(root, 'er', ui.val(isFinite(r.extinctionDb) ? r.extinctionDb.toFixed(1) : '∞', 'dB'));
      const regime = Math.abs(r.r - r.a) < 0.002 ? L('critically coupled', '臨界結合') : r.r > r.a ? L('under-coupled', '疎結合') : L('over-coupled', '過結合');
      ui.out(root, 'er-sub', esc(regime));

      const ph = [], cross = [], bar = [];
      for (let i = 0; i <= 200; i++) {
        const p = 2 * Math.PI * i / 200;
        ph.push(p / Math.PI);
        const c = YR.photonics.mziCross(s.k1, s.k2, p);
        cross.push(c); bar.push(1 - c);
      }
      YR.plot.line(root.querySelector('[data-plot="mzi"]'), {
        series: [{ x: ph, y: cross, color: 's1' }, { x: ph, y: bar, color: 's2' }], yRange: [0, 1.05],
        xLabel: L('phase [π rad]', '位相 [π rad]'), yLabel: L('output power', '出力パワー')
      });
      const cmin = Math.min.apply(null, cross), cmax = Math.max.apply(null, cross);
      ui.out(root, 'mer', ui.val(cmin < 1e-9 ? '> 90' : (10 * Math.log10(cmax / cmin)).toFixed(1), 'dB'));
      ui.out(root, 'mmax', ui.val((cmin * 100).toFixed(1) + ' – ' + (cmax * 100).toFixed(1), '%'));
      ui.out(root, 'mmax-sub', esc(cmin < 1e-4 && cmax > 0.9999 ? L('full range', '全範囲') : L('limited by coupler imbalance', 'カプラの不均衡で制限')));
    };
  }

  YR.views.device = {
    title: () => L('Device', 'デバイス'),
    sub: () => (state.platform === 'sc' ? L('Transmon, readout, ZZ', 'トランズモン・読み出し・ZZ') : L('Waveguide, ring, MZI', '導波路・リング・MZI')),
    render(root) { return state.platform === 'sc' ? renderSc(root) : renderPh(root); }
  };
  YR.idleError = idleError;
})(globalThis.YR = globalThis.YR || {});
