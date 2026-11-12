/* Dynamics: pulse-level control of a transmon, or squeezing and two-photon interference. */
(function (YR) {
  'use strict';
  const L = YR.L, LL = YR.LL, esc = YR.fmt.esc, sig = YR.fmt.sig, state = YR.state, ui = YR.ui;

  // ---------------- superconducting ----------------
  const dyn = { duration: 12, beta: 0, detuning: 0, angle: 1 };

  function renderSc(root) {
    const html =
      ui.head(L('Stage 06 · Superconducting', '工程 06 · 超伝導'), L('Pulse dynamics', 'パルスダイナミクス'),
        L('A shaped microwave pulse drives the transmon you designed, modelled with three levels and its T1 and Tφ. Short pulses leak into the second excited state; the DRAG correction pulls that back.',
          '設計したトランズモンを、整形したマイクロ波パルスで駆動します。3 準位と T1・Tφ を入れたモデルです。短いパルスは第 2 励起状態へ漏れますが、DRAG 補正でそれを抑えられます。'), 'tools') +
      '<div class="grid g-side">' +
        '<div class="stack">' +
          '<div class="panel"><div class="panel-head"><h2>' + esc(L('Pulse', 'パルス')) + '</h2></div>' +
            '<i data-slot="duration"></i><i data-slot="beta"></i><i data-slot="detuning"></i>' +
            '<p class="note" data-out="from"></p></div>' +
          '<div class="panel"><div class="panel-head"><h2>' + esc(L('After the pulse', 'パルス終了時')) + '</h2><div class="right">' + ui.tag('computed') + '</div></div>' +
            '<div class="stats">' + ui.stat('p1', L('Population in |1⟩', '|1⟩ の占有率'), 'key') + ui.stat('p2', L('Leakage to |2⟩', '|2⟩ へのリーク')) +
            ui.stat('peak', L('Peak Rabi rate', 'ラビ周波数の最大値')) + ui.stat('deco', L('Decoherence error', 'デコヒーレンスによる誤り')) + '</div></div>' +
        '</div>' +
        '<div class="stack">' +
          '<div class="panel"><div class="panel-head"><h2>' + esc(L('Level populations during the pulse', 'パルス中の各準位の占有率')) + '</h2><div class="right">' + ui.tag('computed') + '</div></div>' +
            '<canvas class="plot" data-plot="pop"></canvas>' +
            YR.plot.legend([{ color: 's1', label: '|0⟩' }, { color: 's2', label: '|1⟩' }, { color: 's3', label: '|2⟩' }]) + '</div>' +
          '<div class="grid g2">' +
            '<div class="panel"><div class="panel-head"><h2>' + esc(L('Drive envelope', '駆動の包絡線')) + '</h2></div><canvas class="plot short" data-plot="env"></canvas>' +
              YR.plot.legend([{ color: 's1', label: L('in-phase', '同相成分') }, { color: 's4', label: L('quadrature (DRAG)', '直交成分 (DRAG)') }]) + '</div>' +
            '<div class="panel"><div class="panel-head"><h2>' + esc(L('Leakage against pulse length', 'パルス長に対するリーク')) + '</h2><div class="right">' + ui.tag('computed') + '</div></div><canvas class="plot short" data-plot="sweep"></canvas>' +
              YR.plot.legend([{ color: 's3', label: L('no DRAG', 'DRAG なし') }, { color: 's1', label: L('with the current DRAG weight', '現在の DRAG 係数') }]) + '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    ui.mount(root, html, {
      tools: ui.segmented({ label: L('Rotation', '回転角'), options: [{ value: 1, label: L('π pulse', 'π パルス') }, { value: 0.5, label: L('π/2 pulse', 'π/2 パルス') }], get: () => dyn.angle, set: (v) => { dyn.angle = +v; update(true); } }),
      duration: ui.slider({ label: L('Pulse length', 'パルス長'), unit: 'ns', min: 4, max: 60, step: 0.5, digits: 1, get: () => dyn.duration, set: (v) => { dyn.duration = v; }, onChange: (v, f) => update(f) }),
      beta: ui.slider({ label: L('DRAG weight β', 'DRAG 係数 β'), unit: '', min: -1.5, max: 1.5, step: 0.05, digits: 2, get: () => dyn.beta, set: (v) => { dyn.beta = v; }, onChange: (v, f) => update(f) }),
      detuning: ui.slider({ label: L('Drive detuning', '駆動の離調'), unit: 'MHz', min: -20, max: 20, step: 0.5, digits: 1, get: () => dyn.detuning, set: (v) => { dyn.detuning = v; }, onChange: (v, f) => update(f) })
    });

    function update(final) {
      const d = YR.derive.sc();
      const base = { alpha: d.tr.alpha, detuning: dyn.detuning / 1000, duration: dyn.duration, angle: dyn.angle * Math.PI, beta: dyn.beta, t1: d.t1 * 1000, tphi: state.sc.tphi * 1000 };
      const r = YR.dynamics.simulatePulse(base);
      const t1 = YR.fmt.timeUs(d.t1);
      ui.out(root, 'from', esc(L('From your design: α = ' + (d.tr.alpha * 1000).toFixed(0) + ' MHz, T1 = ' + t1[0] + ' ' + t1[1] + ', Tφ = ' + state.sc.tphi + ' µs.',
        '設計値から: α = ' + (d.tr.alpha * 1000).toFixed(0) + ' MHz、T1 = ' + t1[0] + ' ' + t1[1] + '、Tφ = ' + state.sc.tphi + ' µs。')));
      const target = dyn.angle === 1 ? 1 : 0.5;
      ui.out(root, 'p1', ui.val((r.final.p1 * 100).toFixed(2), '%'));
      ui.out(root, 'p1-sub', esc(L('target ', '目標 ') + (target * 100).toFixed(0) + ' %'));
      ui.out(root, 'p2', ui.val(sig(r.final.p2, 2)));
      root.querySelector('[data-stat="p2"]').className = 'stat' + (r.final.p2 > 1e-3 ? ' bad' : r.final.p2 > 1e-4 ? ' warn' : '');
      ui.out(root, 'peak', ui.val(Math.max.apply(null, r.inPhase).toFixed(1), 'MHz'));
      ui.out(root, 'peak-sub', '|α| = ' + Math.abs(d.tr.alpha * 1000).toFixed(0) + ' MHz');
      ui.out(root, 'deco', ui.val(sig(YR.idleError(dyn.duration / 1000, d.t1, d.t2), 2)));
      ui.out(root, 'deco-sub', esc(L('idle for the same time', '同じ時間の放置に相当')));

      YR.plot.line(root.querySelector('[data-plot="pop"]'), {
        series: [{ x: r.time, y: r.p0, color: 's1' }, { x: r.time, y: r.p1, color: 's2' }, { x: r.time, y: r.p2, color: 's3' }],
        xLabel: L('time [ns]', '時間 [ns]'), yLabel: L('population', '占有率'), yRange: [0, 1.04]
      });
      YR.plot.line(root.querySelector('[data-plot="env"]'), {
        series: [{ x: r.time, y: r.inPhase, color: 's1' }, { x: r.time, y: r.quad, color: 's4' }],
        xLabel: L('time [ns]', '時間 [ns]'), yLabel: L('Ω/2π [MHz]', 'Ω/2π [MHz]')
      });
      if (final !== false) {
        const xs = [], plain = [], drag = [];
        for (let t = 4; t <= 60; t += 2) {
          xs.push(t);
          plain.push(YR.dynamics.simulatePulse(Object.assign({}, base, { duration: t, beta: 0, steps: 500 })).final.p2);
          drag.push(YR.dynamics.simulatePulse(Object.assign({}, base, { duration: t, steps: 500 })).final.p2);
        }
        YR.plot.line(root.querySelector('[data-plot="sweep"]'), {
          series: [{ x: xs, y: plain, color: 's3' }, { x: xs, y: drag, color: 's1' }], yLog: true,
          xLabel: L('pulse length [ns]', 'パルス長 [ns]'), yLabel: 'P(|2⟩)', vlines: [{ x: dyn.duration }]
        });
      }
    }
    return update;
  }

  // ---------------- photonic ----------------
  function renderPh(root) {
    const s = state.ph;
    const mats = YR.materials.photonic;
    const html =
      ui.head(L('Stage 06 · Photonic', '工程 06 · 光'), L('Quantum light', '量子光のふるまい'),
        L('Loss replaces part of the quantum state with vacuum. See how much squeezing reaches the detector, and how visible two-photon interference stays, for the chip you designed.',
          '損失があると、量子状態の一部が真空に置き換わります。設計したチップで、検出器まで届くスクイージングの量と、2 光子干渉の見え方を確かめます。')) +
      '<div class="grid g2" style="margin-bottom:14px">' +
        '<div class="panel"><div class="panel-head"><h2>' + esc(L('Squeezing against efficiency', '効率に対するスクイージング')) + '</h2><div class="right">' + ui.tag('computed') + '</div></div>' +
          '<i data-slot="r"></i><canvas class="plot" data-plot="sq"></canvas>' +
          YR.plot.legend([{ color: 's1', label: L('squeezed quadrature', 'スクイーズされた直交位相') }, { color: 's3', label: L('anti-squeezed quadrature', '反スクイーズ側') }]) +
          '<div class="stats" style="margin-top:8px">' + ui.stat('src', L('At the source', '光源での値')) + ui.stat('meas', L('At the detector', '検出器での値'), 'key') + ui.stat('anti', L('Anti-squeezing', '反スクイージング')) + ui.stat('eta', 'η') + '</div></div>' +
        '<div class="panel"><div class="panel-head"><h2>' + esc(L('How long can the chip be?', 'チップはどこまで長くできるか')) + '</h2><div class="right">' + ui.tag('computed') + '</div></div>' +
          '<canvas class="plot tall" data-plot="len"></canvas>' + YR.plot.legend(mats.map((m, i) => ({ color: 's' + (i + 1), label: LL(m.name) }))) +
          '<p class="note">' + esc(L('Squeezing at the detector against optical path, for each platform, with the coupling loss and detector of the current design.',
            '現在の設計の結合損失と検出器を使い、材料系ごとに、光路長に対する検出器でのスクイージングを示します。')) + '</p></div>' +
      '</div>' +
      '<div class="grid g-wide">' +
        '<div class="panel"><div class="panel-head"><h2>' + esc(L('Hong–Ou–Mandel dip', 'ホン・オウ・マンデル ディップ')) + '</h2><div class="right">' + ui.tag('computed') + '</div></div>' +
          '<canvas class="plot" data-plot="hom"></canvas></div>' +
        '<div class="panel"><div class="panel-head"><h2>' + esc(L('Two-photon interference', '2 光子干渉')) + '</h2></div>' +
          '<i data-slot="hom"></i><i data-slot="k1"></i>' +
          '<div class="stats" style="margin-top:8px">' + ui.stat('vis', L('Dip visibility', 'ディップの明瞭度'), 'key') + ui.stat('floor', L('Coincidences at zero delay', '遅延ゼロでの同時計数')) + '</div>' +
          '<p class="note">' + esc(L('The splitting ratio is that of coupler 1 in Device. Gaussian wave packets; delay in units of the coherence time.',
            '分岐比は「デバイス」のカプラ 1 の値です。波束はガウス型で、遅延はコヒーレンス時間を単位にしています。')) + '</p></div>' +
      '</div>';
    ui.mount(root, html, {
      r: ui.slider({ label: L('Squeezing parameter r of the source', '光源のスクイージングパラメータ r'), unit: '', min: 0, max: 2, step: 0.01, digits: 2, get: () => s.squeezeR, set: (v) => { s.squeezeR = v; } }),
      hom: ui.slider({ label: L('Photon indistinguishability', '光子の不可識別性'), unit: '%', min: 0, max: 100, step: 1, digits: 0, get: () => s.hom * 100, set: (v) => { s.hom = v / 100; } }),
      k1: ui.slider({ label: L('Beam-splitter ratio', 'ビームスプリッタの分岐比'), unit: '%', min: 30, max: 70, step: 0.5, digits: 1, get: () => s.k1 * 100, set: (v) => { s.k1 = v / 100; } })
    });

    return function update() {
      const d = YR.derive.ph();
      const P = YR.photonics;
      const etas = [], sq = [], anti = [];
      for (let i = 0; i <= 100; i++) { const e = i / 100; etas.push(e * 100); sq.push(P.squeezingDb(s.squeezeR, e)); anti.push(P.antiSqueezingDb(s.squeezeR, e)); }
      YR.plot.line(root.querySelector('[data-plot="sq"]'), {
        series: [{ x: etas, y: sq, color: 's1' }, { x: etas, y: anti, color: 's3' }],
        xLabel: L('total efficiency η [%]', '全体の効率 η [%]'), yLabel: L('noise vs shot noise [dB]', 'ショット雑音比 [dB]'),
        vlines: [{ x: d.eta * 100, label: 'η', color: 'accent' }], hlines: [{ y: 0 }], points: [{ x: d.eta * 100, y: d.squeezeDb, color: 's1' }]
      });
      ui.out(root, 'src', ui.val(d.squeezeIdealDb.toFixed(2), 'dB'));
      ui.out(root, 'meas', ui.val(d.squeezeDb.toFixed(2), 'dB'));
      ui.out(root, 'anti', ui.val('+' + P.antiSqueezingDb(s.squeezeR, d.eta).toFixed(2), 'dB'));
      ui.out(root, 'eta', ui.val((d.eta * 100).toFixed(1), '%'));
      ui.out(root, 'eta-sub', esc(L('limit ', '限界 ') + (10 * Math.log10(1 - d.eta)).toFixed(1) + ' dB'));

      const xs = [];
      for (let i = 0; i <= 100; i++) xs.push(i * 2);
      YR.plot.line(root.querySelector('[data-plot="len"]'), {
        series: mats.map((m, i) => ({
          x: xs, color: 's' + (i + 1), width: m.id === s.platform ? 2.6 : 1.4,
          y: xs.map((x) => P.squeezingDb(s.squeezeR, Math.pow(10, -(m.lossDbCm * x / 10 + s.couplingDb) / 10) * s.detector))
        })),
        xLabel: L('optical path [mm]', '光路長 [mm]'), yLabel: L('squeezing at detector [dB]', '検出器でのスクイージング [dB]'),
        vlines: [{ x: s.pathMm, label: s.pathMm + ' mm', color: 'accent' }]
      });

      const taus = [], co = [];
      for (let i = 0; i <= 240; i++) { const t = -3 + i * 0.025; taus.push(t); co.push(P.homCoincidence(s.k1, s.hom, t, 1)); }
      const far = P.homCoincidence(s.k1, s.hom, 100, 1), zero = P.homCoincidence(s.k1, s.hom, 0, 1);
      YR.plot.line(root.querySelector('[data-plot="hom"]'), {
        series: [{ x: taus, y: co, color: 'accent', width: 2.2 }], yRange: [0, 0.6],
        xLabel: L('delay / coherence time', '遅延 / コヒーレンス時間'), yLabel: L('coincidence probability', '同時計数の確率'),
        hlines: [{ y: far, label: L('distinguishable', '区別できる場合') }]
      });
      ui.out(root, 'vis', ui.val(((far - zero) / far * 100).toFixed(1), '%'));
      ui.out(root, 'floor', ui.val((zero * 100).toFixed(1), '%'));
    };
  }

  YR.views.dynamics = {
    title: () => (state.platform === 'sc' ? L('Pulse dynamics', 'パルスダイナミクス') : L('Quantum light', '量子光のふるまい')),
    sub: () => (state.platform === 'sc' ? L('Three-level Lindblad', '3 準位リンドブラッド') : L('Squeezing, interference', 'スクイージング・干渉')),
    render(root) { return state.platform === 'sc' ? renderSc(root) : renderPh(root); }
  };
})(globalThis.YR = globalThis.YR || {});
