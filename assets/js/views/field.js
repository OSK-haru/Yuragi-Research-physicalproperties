/* Field solvers: CPW cross-section (quasi-static) and beam propagation in photonic structures. */
(function (YR) {
  'use strict';
  const L = YR.L, esc = YR.fmt.esc, sig = YR.fmt.sig, state = YR.state, ui = YR.ui;

  // ---------------- superconducting: coplanar-line cross-section ----------------
  function renderSc(root) {
    const s = state.sc;
    const html =
      ui.head(L('Stage 04 · Superconducting', '工程 04 · 超伝導'), L('Field solver', '電磁界ソルバ'),
        L('The cross-section of the coplanar line is solved on a grid: potential, field energy, capacitance and impedance. The closed-form result is shown beside it as a check.',
          'コプレーナ線路の断面を格子上で解き、電位、電界エネルギー、容量、インピーダンスを求めます。確認のため、解析式の結果を並べて表示します。')) +
      '<div class="grid g-side">' +
        '<div class="stack">' +
          '<div class="panel"><div class="panel-head"><h2>' + esc(L('Line geometry', '線路の形状')) + '</h2></div>' +
            '<i data-slot="w"></i><i data-slot="s"></i>' +
            '<p class="note">' + esc(L('Substrate: ', '基板: ')) + '<b data-out="sub"></b>. ' + esc(L('Change it in Materials.', '変更は「材料」で行います。')) + '</p></div>' +
          '<div class="panel"><div class="panel-head"><h2>' + esc(L('Line parameters', '線路の特性')) + '</h2><div class="right">' + ui.tag('computed') + '</div></div>' +
            '<table class="data"><thead><tr><th></th><th class="num">' + esc(L('grid solver', '格子ソルバ')) + '</th><th class="num">' + esc(L('closed form', '解析式')) + '</th></tr></thead><tbody data-out="table"></tbody></table>' +
            '<p class="note" data-out="solveinfo"></p></div>' +
          '<div class="panel"><div class="panel-head"><h2>' + esc(L('Not built', '未実装')) + '</h2><div class="right">' + ui.tag('planned') + '</div></div>' +
            '<ul class="plain"><li>' + esc(L('3D extraction of the full capacitance matrix of the chip', 'チップ全体の容量行列の 3 次元抽出')) + '</li><li>' +
            esc(L('Surface participation from the solved fields (now a scaling law in Materials)', '解いた電界から求める表面参加率 (現在は「材料」での換算則)')) + '</li><li>' +
            esc(L('Kinetic inductance of thin films', '薄膜の力学インダクタンス')) + '</li></ul></div>' +
        '</div>' +
        '<div class="stack">' +
          '<div class="panel"><div class="panel-head"><h2>' + esc(L('Electric field energy density in the cross-section', '断面内の電界エネルギー密度')) + '</h2><div class="right">' + ui.tag('computed') + '</div></div>' +
            '<div class="canvas-wrap"><canvas data-plot="field" style="height:380px"></canvas></div>' +
            '<p class="note">' + esc(L('Logarithmic colour scale; thin lines are equipotentials at every 10 % of the voltage. Upper half: vacuum. Lower half: substrate.',
              '色は対数スケールです。細い線は電圧の 10 % ごとの等電位線。上半分が真空、下半分が基板です。')) + '</p></div>' +
          '<div class="panel"><div class="panel-head"><h2>' + esc(L('Impedance against gap', 'ギャップに対するインピーダンス')) + '</h2><div class="right">' + ui.tag('computed') + '</div></div>' +
            '<canvas class="plot short" data-plot="z0"></canvas></div>' +
        '</div>' +
      '</div>';
    ui.mount(root, html, {
      w: ui.slider({ label: L('Centre conductor width', '中心導体の幅'), unit: 'µm', min: 2, max: 30, step: 0.5, digits: 1, get: () => s.cpwW, set: (v) => { s.cpwW = v; } }),
      s: ui.slider({ label: L('Gap to ground', 'グラウンドとのギャップ'), unit: 'µm', min: 1, max: 30, step: 0.5, digits: 1, get: () => s.cpwS, set: (v) => { s.cpwS = v; } })
    });

    let solved = null, solvedKey = '';
    function paintField(num) {
      const canvas = root.querySelector('[data-plot="field"]');
      const { ctx, w, h } = YR.plot.prepare(canvas);
      const f = num.field;
      const pitch = s.cpwW + 2 * s.cpwS;
      const viewW = 3.2 * pitch, viewH = viewW * h / w;      // physical size of the view
      const pw = Math.min(520, Math.round(w)), phh = Math.round(pw * h / w);
      const xc = (f.nx - 1) / 2;
      let dmax = 0;
      for (let i = 0; i < f.density.length; i++) if (f.density[i] > dmax) dmax = f.density[i];
      const sample = (arr, gx, gy) => {
        const x0 = Math.max(0, Math.min(f.nx - 2, Math.floor(gx))), y0 = Math.max(0, Math.min(f.ny - 2, Math.floor(gy)));
        const u = gx - x0, v = gy - y0, k = y0 * f.nx + x0;
        return arr[k] * (1 - u) * (1 - v) + arr[k + 1] * u * (1 - v) + arr[k + f.nx] * (1 - u) * v + arr[k + f.nx + 1] * u * v;
      };
      const img = YR.plot.heatImage(pw, phh, 'ice', (px, py) => {
        const gx = xc + ((px + 0.5) / pw - 0.5) * viewW / f.dx;
        const gy = f.jSurf + (0.5 - (py + 0.5) / phh) * viewH / f.dx;
        const dens = sample(f.density, gx, gy) / dmax;
        let t = 1 + Math.log10(Math.max(dens, 1e-4)) / 4;
        const phi = sample(f.phi, gx, gy) * 10;
        const frac = Math.abs(phi - Math.round(phi));
        if (frac < 0.035 && phi > 0.5 && phi < 9.5) t = Math.min(1, t + 0.22);
        return t;
      });
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, 0, 0, w, h);
      // substrate tint, surface line and conductors
      const X = (um) => w / 2 + um / viewW * w, ySurf = h / 2;
      ctx.fillStyle = 'rgba(165,149,245,0.07)'; ctx.fillRect(0, ySurf, w, h - ySurf);
      ctx.fillStyle = '#e8eef5';
      ctx.fillRect(X(-s.cpwW / 2), ySurf - 3, X(s.cpwW / 2) - X(-s.cpwW / 2), 6);
      ctx.fillStyle = '#9aa8b9';
      ctx.fillRect(0, ySurf - 3, X(-s.cpwW / 2 - s.cpwS), 6);
      ctx.fillRect(X(s.cpwW / 2 + s.cpwS), ySurf - 3, w - X(s.cpwW / 2 + s.cpwS), 6);
      ctx.font = '11px ' + ui.cssVar('--mono'); ctx.fillStyle = '#dbe3ec'; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
      ctx.fillText(L('vacuum', '真空'), 10, 10);
      ctx.textBaseline = 'bottom';
      ctx.fillText(L('substrate  εr = ', '基板  εr = ') + YR.derive.sc().substrate.epsR, 10, h - 10);
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(235,250,255,0.9)'; ctx.strokeText('V = 1', X(0), ySurf - 9);
      ctx.fillStyle = '#06090d'; ctx.fillText('V = 1', X(0), ySurf - 9); ctx.fillStyle = '#dbe3ec';
      ctx.fillText('0', X(-s.cpwW / 2 - s.cpwS) - 22, ySurf - 8);
      ctx.fillText('0', X(s.cpwW / 2 + s.cpwS) + 22, ySurf - 8);
      // scale bar
      const bar = sig(pitch / 2, 1);
      ctx.strokeStyle = '#dbe3ec'; ctx.lineWidth = 2; ctx.beginPath();
      ctx.moveTo(w - 16 - parseFloat(bar) / viewW * w, h - 14); ctx.lineTo(w - 16, h - 14); ctx.stroke();
      ctx.textAlign = 'right'; ctx.fillText(bar + ' µm', w - 16, h - 18);
    }

    return function update(final) {
      const d = YR.derive.sc();
      ui.out(root, 'sub', esc(YR.LL(d.substrate.name)));
      const key = [s.cpwW, s.cpwS, d.substrate.epsR].join('/');
      if (final && key !== solvedKey) {
        const t0 = performance.now();
        solved = YR.fieldsolver.cpwNumeric(s.cpwW, s.cpwS, d.substrate.epsR, 32, 6);
        solved.ms = performance.now() - t0;
        solvedKey = key;
      }
      const fresh = solved && key === solvedKey;
      const a = d.line;
      const row = (label, num, ana) => '<tr><td>' + label + '</td><td class="num">' + (fresh ? num : '…') + '</td><td class="num">' + ana + '</td></tr>';
      ui.out(root, 'table',
        row('Z0 [Ω]', fresh ? solved.z0.toFixed(2) : '', a.z0.toFixed(2)) +
        row('ε_eff', fresh ? solved.epsEff.toFixed(3) : '', a.epsEff.toFixed(3)) +
        row(esc(L('C per length [pF/m]', '単位長さ容量 [pF/m]')), fresh ? (solved.cPerM * 1e12).toFixed(1) : '', (a.cPerM * 1e12).toFixed(1)) +
        row(esc(L('Energy in substrate', '基板内のエネルギー')), fresh ? (solved.substrateFraction * 100).toFixed(1) + ' %' : '', (d.substrate.epsR / (d.substrate.epsR + 1) * 100).toFixed(1) + ' %') +
        row(esc(L('λ/4 length at ', 'λ/4 の長さ (') + s.fr.toFixed(2) + ' GHz' + L('', ')') + ' [mm]'), fresh ? YR.sc.resonatorLength(s.fr, solved.epsEff, 'quarter').toFixed(3) : '', d.resonatorMm.toFixed(3)));
      ui.out(root, 'solveinfo', fresh ? esc(L(
        'Grid ' + solved.field.nx + ' × ' + solved.field.ny + ', ' + solved.field.iterations + ' SOR iterations, ' + solved.ms.toFixed(0) + ' ms for two solves. The grounded box around the line lowers Z0 by a few percent against the open-space formula.',
        '格子 ' + solved.field.nx + ' × ' + solved.field.ny + '、SOR 反復 ' + solved.field.iterations + ' 回、2 回の求解で ' + solved.ms.toFixed(0) + ' ms。線路を囲む接地箱の影響で、開放空間の解析式より Z0 が数 % 低く出ます。'))
        : esc(L('Release the slider to solve.', 'スライダーを離すと求解します。')));
      if (fresh) paintField(solved);

      const xs = [], ys = [];
      for (let g = 1; g <= 30; g += 0.25) { xs.push(g); ys.push(YR.sc.cpw(s.cpwW, g, d.substrate.epsR).z0); }
      YR.plot.line(root.querySelector('[data-plot="z0"]'), {
        series: [{ x: xs, y: ys, color: 'accent' }], xLabel: L('gap [µm]', 'ギャップ [µm]'), yLabel: 'Z0 [Ω]',
        hlines: [{ y: 50, label: '50 Ω' }], points: fresh ? [{ x: s.cpwS, y: solved.z0, color: 's2' }] : [{ x: s.cpwS, y: a.z0, color: 'accent' }]
      });
    };
  }

  // ---------------- photonic: beam propagation ----------------
  // Lengths are stored in normalised units so that the same structures work on every platform:
  // lateral sizes in guide widths, longitudinal sizes in units of n0 w^2 / lambda.
  const bp = { kind: 'coupler', gap: 0.6, length: 200, separation: 6, bend: 300, arm: 200, lead: 60, phase: 0, mmiWidth: 6, mmiScale: 1 };
  const REF = 1.6 / 1.55;

  function bpmParams(d) {
    const s = state.ph;
    const nCore = d.mode.nSlab, nClad = d.mat.nClad;
    const wc = s.lambda / (2 * Math.sqrt(nCore * nCore - nClad * nClad));   // TE1 cut-off width
    const w = 0.89 * wc;
    const F = (nCore * w * w / s.lambda) / REF;
    const p = { kind: bp.kind, nCore, nClad, lambda: s.lambda, width: w, dx: w / 16, dz: Math.max(0.02, 0.5 * F) };
    if (bp.kind === 'straight') { p.length = bp.length * F; p.windowX = 14 * w; }
    else if (bp.kind === 'coupler') { p.gap = bp.gap * w; p.length = bp.length * F; p.windowX = 16 * w; }
    else if (bp.kind === 'ysplit') { p.separation = bp.separation * w; p.lead = bp.lead * F; p.bend = bp.bend * F; p.windowX = (bp.separation + 14) * w; }
    else if (bp.kind === 'mzi') {
      p.separation = bp.separation * w; p.lead = bp.lead * F; p.bend = bp.bend * F; p.arm = bp.arm * F; p.windowX = (bp.separation + 14) * w;
      p.deltaN = bp.phase * s.lambda / (2 * p.arm);      // nominal phase = k0 dn L (confinement taken as 1)
    } else {
      p.mmiWidth = bp.mmiWidth * w; p.lead = 40 * F; p.windowX = (bp.mmiWidth + 14) * w;
      p.mmiLength = bp.mmiScale * 3 / 8 * YR.bpm.mmiBeatLength(nCore, p.mmiWidth + 0.5 * w, s.lambda);
    }
    return { p, w, F, v: Math.PI * 0.89 };
  }

  function renderPh(root) {
    const kinds = [
      ['straight', L('Straight guide', '直線導波路')], ['coupler', L('Directional coupler', '方向性結合器')], ['ysplit', L('Y-branch', 'Y 分岐')],
      ['mzi', L('Mach–Zehnder', 'マッハ・ツェンダー')], ['mmi', L('1 × 2 MMI', '1 × 2 MMI')]
    ];
    const html =
      ui.head(L('Stage 04 · Photonic', '工程 04 · 光'), L('Optical simulation', '光学シミュレーション'),
        L('Light is launched in the fundamental mode and propagated through the structure with a 2D beam-propagation method. Sizes follow the platform chosen in Materials.',
          '基本モードで光を入れ、2 次元ビーム伝搬法で構造の中を伝搬させます。寸法は「材料」で選んだ材料系に合わせて決まります。'), 'tools') +
      '<div class="grid g-side">' +
        '<div class="stack">' +
          '<div class="panel"><div class="panel-head"><h2>' + esc(L('Structure', '構造')) + '</h2></div><div data-out="controls"></div></div>' +
          '<div class="panel"><div class="panel-head"><h2>' + esc(L('Result', '結果')) + '</h2><div class="right">' + ui.tag('computed') + '</div></div>' +
            '<div class="stats" data-out="ports"></div>' +
            '<table class="data" style="margin-top:10px"><tbody data-out="info"></tbody></table></div>' +
        '</div>' +
        '<div class="stack">' +
          '<div class="panel"><div class="panel-head"><h2>' + esc(L('Intensity |E|² along the propagation', '伝搬方向に沿った強度 |E|²')) + '</h2><div class="right">' + ui.tag('computed') + '</div></div>' +
            '<div class="canvas-wrap"><canvas data-plot="bpm" style="height:340px"></canvas></div>' +
            '<p class="note">' + esc(L('Light travels left to right. Scalar, paraxial, with the vertical direction folded into an effective index: good for trends, qualitative for tight bends and high index contrast.',
              '光は左から右へ進みます。スカラー・近軸近似で、縦方向は等価屈折率にまとめています。傾向を見るには十分ですが、急な曲げや高屈折率差では定性的な結果です。')) + '</p></div>' +
          '<div class="panel"><div class="panel-head"><h2>' + esc(L('Output profile', '出力端での分布')) + '</h2><div class="right">' + ui.tag('computed') + '</div></div>' +
            '<canvas class="plot short" data-plot="profile"></canvas></div>' +
        '</div>' +
      '</div>';
    ui.mount(root, html, {
      tools: (() => {
        const sel = ui.el('select', { class: 'sel', 'aria-label': L('Structure', '構造') });
        kinds.forEach(([v, name]) => sel.append(ui.el('option', { value: v, selected: v === bp.kind ? '' : null }, esc(name))));
        sel.addEventListener('change', () => { bp.kind = sel.value; controls(); update(true); });
        return sel;
      })()
    });

    function controls() {
      const box = root.querySelector('[data-out="controls"]');
      box.innerHTML = '';
      const d = YR.derive.ph();
      if (!d.mode) return;
      const { w, F } = bpmParams(d);
      const add = (label, unit, key, min, max, step, scale, digits) => box.append(ui.slider({
        label, unit, min: min * scale, max: max * scale, step: step * scale, digits,
        get: () => bp[key] * scale, set: (v) => { bp[key] = v / scale; }, onChange: (v, final) => update(final)
      }));
      const dz = F >= 2 ? 0 : F >= 0.2 ? 1 : 2;
      if (bp.kind === 'straight' || bp.kind === 'coupler') add(L('Length', '長さ'), 'µm', 'length', 20, 600, 5, F, dz);
      if (bp.kind === 'coupler') add(L('Gap between guides', '導波路間のギャップ'), 'µm', 'gap', 0.2, 1.6, 0.02, w, 3);
      if (bp.kind === 'ysplit' || bp.kind === 'mzi') {
        add(L('Arm separation', 'アーム間隔'), 'µm', 'separation', 3, 10, 0.1, w, 2);
        add(L('Bend length', '曲げ部の長さ'), 'µm', 'bend', 40, 600, 5, F, dz);
      }
      if (bp.kind === 'mzi') {
        add(L('Arm length', 'アームの長さ'), 'µm', 'arm', 50, 400, 5, F, dz);
        add(L('Phase set on one arm', '片方のアームに与える位相'), 'π', 'phase', 0, 2.4, 0.02, 1, 2);
      }
      if (bp.kind === 'mmi') {
        add(L('Multimode section width', '多モード部の幅'), 'µm', 'mmiWidth', 4, 10, 0.1, w, 2);
        add(L('Length relative to the self-imaging length', '自己結像長に対する長さ'), '×', 'mmiScale', 0.5, 1.5, 0.01, 1, 2);
      }
    }
    controls();

    let last = null, lastPlatform = state.ph.platform + state.ph.h + state.ph.lambda;
    function update(final) {
      const d = YR.derive.ph();
      const nowPlatform = state.ph.platform + state.ph.h + state.ph.lambda;
      if (nowPlatform !== lastPlatform) { lastPlatform = nowPlatform; controls(); }
      if (!d.mode) {
        ui.out(root, 'ports', '<div class="stat bad"><div class="stat-label">' + esc(L('No guided mode', '導波モードなし')) + '</div><div class="stat-value">—</div></div>');
        return;
      }
      const bundle = bpmParams(d);
      if (final || !last) {
        const t0 = performance.now();
        last = YR.bpm.propagate(bundle.p);
        last.ms = performance.now() - t0;
        last.bundle = bundle;
      }
      const r = last;
      if (!r) return;
      ui.out(root, 'ports', r.ports.map((p, i) => '<div class="stat' + (i === 0 ? ' key' : '') + '"><div class="stat-label">' + esc(L('Port: ', 'ポート: ') + p.name) + '</div><div class="stat-value">' +
        (p.power * 100).toFixed(1) + '<small>%</small></div></div>').join('') +
        '<div class="stat"><div class="stat-label">' + esc(L('Radiated', '放射')) + '</div><div class="stat-value">' + (Math.max(0, 1 - r.ports.reduce((a, p) => a + p.power, 0)) * 100).toFixed(1) + '<small>%</small></div></div>');
      const b = r.bundle;
      const info = [
        [L('In-plane core / cladding index', '面内のコア / クラッド屈折率'), b.p.nCore.toFixed(3) + ' / ' + b.p.nClad.toFixed(3)],
        [L('Guide width (single mode)', '導波路幅 (単一モード)'), sig(b.w, 3) + ' µm'],
        [L('Mode index n0', 'モード屈折率 n0'), r.n0.toFixed(4)],
        [L('Structure length', '構造の長さ'), sig(r.length, 3) + ' µm'],
        [L('Grid', '格子'), r.nx + ' × ' + Math.round(r.length / b.p.dz) + L(' steps, ', ' ステップ、') + r.ms.toFixed(0) + ' ms']
      ];
      if (bp.kind === 'mmi') info.push([L('Multimode section length', '多モード部の長さ'), sig(b.p.mmiLength, 3) + ' µm']);
      ui.out(root, 'info', info.map(([k, v]) => '<tr><td>' + esc(k) + '</td><td class="num">' + esc(v) + '</td></tr>').join(''));

      // field image: x vertical, z horizontal
      const canvas = root.querySelector('[data-plot="bpm"]');
      const { ctx, w, h } = YR.plot.prepare(canvas);
      let peak = 0;
      for (let i = 0; i < r.intensity.length; i++) if (r.intensity[i] > peak) peak = r.intensity[i];
      const clad2 = b.p.nClad * b.p.nClad;
      const crop = Math.round(r.nx * 0.08);
      const rows = r.nx - 2 * crop;
      const img = YR.plot.heatImage(r.cols, rows, 'ember', (cx, cy) => {
        const k = cx * r.nx + (cy + crop);
        const t = Math.sqrt(r.intensity[k] / peak);
        return r.index[k] > clad2 + 1e-9 ? 0.09 + 0.91 * t : t * 0.96;
      });
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, 0, 0, w, h);
      ctx.font = '11px ' + ui.cssVar('--mono'); ctx.fillStyle = '#dbe3ec'; ctx.textBaseline = 'bottom';
      const zBar = parseFloat(sig(r.length / 5, 1));
      ctx.strokeStyle = '#dbe3ec'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(14, h - 12); ctx.lineTo(14 + zBar / r.length * w, h - 12); ctx.stroke();
      ctx.textAlign = 'left'; ctx.fillText(zBar + ' µm', 14, h - 16);
      const span = r.windowX * (rows / r.nx);
      const xBar = parseFloat(sig(span / 6, 1));
      ctx.beginPath(); ctx.moveTo(w - 14, 12); ctx.lineTo(w - 14, 12 + xBar / span * h); ctx.stroke();
      ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.fillText(xBar + ' µm', w - 20, 12);

      const xs = [], ys = [];
      let pk = 0;
      for (let i = 0; i < r.nx; i++) { const v = r.intensity[(r.cols - 1) * r.nx + i]; if (v > pk) pk = v; }
      for (let i = crop; i < r.nx - crop; i++) { xs.push(r.xs[i]); ys.push(r.intensity[(r.cols - 1) * r.nx + i] / (pk || 1)); }
      YR.plot.line(root.querySelector('[data-plot="profile"]'), {
        series: [{ x: xs, y: ys, color: 'accent' }], xLabel: L('lateral position [µm]', '横方向の位置 [µm]'), yLabel: '|E|²', yRange: [0, 1.08],
        vlines: r.ports.map((p) => ({ x: p.x, label: p.name }))
      });
    }
    return update;
  }

  YR.views.field = {
    title: () => (state.platform === 'sc' ? L('Field solver', '電磁界ソルバ') : L('Optical simulation', '光学シミュレーション')),
    sub: () => (state.platform === 'sc' ? L('Line cross-section', '線路の断面') : L('Beam propagation', 'ビーム伝搬')),
    render(root) { return state.platform === 'sc' ? renderSc(root) : renderPh(root); }
  };
})(globalThis.YR = globalThis.YR || {});
