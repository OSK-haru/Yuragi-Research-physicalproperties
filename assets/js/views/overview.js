/* Overview: what the workbench is, the design flow with live values, platform choice. */
(function (YR) {
  'use strict';
  const L = YR.L, esc = YR.fmt.esc, state = YR.state;

  function stages() {
    const sc = state.platform === 'sc';
    const d = sc ? YR.derive.sc() : YR.derive.ph();
    const t = (us) => { const v = YR.fmt.timeUs(us); return v[0] + ' ' + v[1]; };
    return [
      { id: 'materials', name: L('Materials', '材料'),
        what: sc ? L('Film, substrate, interfaces', '薄膜・基板・界面') : L('Waveguide platform', '導波路の材料系'),
        key: sc ? L('stack', '構成') : L('platform', '材料系'),
        val: sc ? d.film.name + ' / ' + YR.LL(d.substrate.name) : YR.LL(d.mat.name) },
      { id: 'device', name: L('Device', 'デバイス'),
        what: sc ? L('Transmon, readout, coupling', 'トランズモン・読み出し・結合') : L('Waveguide, ring, interferometer', '導波路・リング・干渉計'),
        key: sc ? 'f01' : 'n_eff',
        val: sc ? d.tr.f01.toFixed(3) + ' GHz' : (d.mode ? d.mode.neff.toFixed(3) : '—') },
      { id: 'layout', name: L('Chip layout', 'チップレイアウト'),
        what: sc ? L('Qubits, resonators, lines', '量子ビット・共振器・配線') : L('Sources, mesh, detectors', '光源・メッシュ・検出器'),
        key: sc ? 'λ/4' : L('path', '光路'),
        val: sc ? d.resonatorMm.toFixed(2) + ' mm' : state.ph.pathMm.toFixed(0) + ' mm' },
      { id: 'field', name: L('Field solver', '電磁界・光学'),
        what: sc ? L('Line cross-section fields', '線路断面の電界') : L('Beam propagation', 'ビーム伝搬'),
        key: sc ? 'Z0' : L('loss', '損失'),
        val: sc ? d.line.z0.toFixed(1) + ' Ω' : d.totalDb.toFixed(2) + ' dB' },
      { id: 'circuit', name: L('Circuit', '量子回路'),
        what: sc ? L('Gates with device noise', 'デバイス由来の雑音つきゲート') : L('Photons through the mesh', 'メッシュを通る光子'),
        key: sc ? 'T2' : 'η',
        val: sc ? t(d.t2) : (d.eta * 100).toFixed(1) + ' %' },
      { id: 'dynamics', name: L('Dynamics', 'ダイナミクス'),
        what: sc ? L('Pulses on a three-level transmon', '3 準位トランズモンへのパルス') : L('Squeezing and interference', 'スクイージングと干渉'),
        key: sc ? 'T1' : L('squeezing', 'スクイージング'),
        val: sc ? t(d.t1) : d.squeezeDb.toFixed(2) + ' dB' }
    ];
  }

  YR.views.overview = {
    title: () => L('Overview', '概要'),
    sub: () => L('What this is', 'このアプリについて'),
    render(root) {
      const sc = state.platform === 'sc';
      const art = YR.layoutArt ? (sc ? YR.layoutArt.sc({ thumb: true }) : YR.layoutArt.ph({ thumb: true })) : '';
      root.innerHTML =
        '<section class="hero"><div>' +
          '<div class="kicker">' + esc(L('Research workbench · local application', '研究用ワークベンチ · ローカルアプリ')) + '</div>' +
          '<h1>' + L('From the material to the circuit result, on <em>one design thread</em>.', '材料から回路の結果まで、<em>ひと続きの設計値</em>で。') + '</h1>' +
          '<p>' + esc(L(
            'Choose materials, design the devices, lay out the chip, solve the fields, then run circuits and pulses on what you designed. Superconducting and photonic chips share the same flow.',
            '材料を選び、デバイスを設計し、チップに配置し、電磁界を解き、できあがった設計の上で回路やパルスを走らせます。超伝導方式と光方式を同じ流れで扱います。')) + '</p>' +
          '<div class="btn-row"><button class="btn primary" data-go="materials">' + esc(L('Start with materials', '材料から始める')) + '</button>' +
          '<button class="btn" data-go="layout">' + esc(L('Open the chip layout', 'チップレイアウトを開く')) + '</button></div>' +
        '</div><div class="hero-art">' + art + '</div></section>' +

        '<div class="pipeline">' + stages().map((s, i) =>
          '<button class="pipe" data-go="' + s.id + '"><div class="num">' + String(i + 1).padStart(2, '0') + '</div><div class="name">' + esc(s.name) +
          '</div><div class="what">' + esc(s.what) + '</div><div class="val"><span>' + esc(s.key) + '</span> ' + esc(s.val) + '</div></button>').join('') + '</div>' +

        '<div class="grid g2" style="margin-bottom:14px">' +
          '<button class="card-pick" data-platform="sc" aria-pressed="' + sc + '"><h3>' + esc(L('Superconducting', '超伝導方式')) + '</h3><p>' +
            esc(L('Transmon qubits on Si or sapphire, coplanar resonators, microwave control.', 'Si またはサファイア基板上のトランズモン、コプレーナ共振器、マイクロ波制御。')) + '</p><ul>' +
            '<li>' + esc(L('Loss budget from films and interfaces to T1', '薄膜と界面の損失から T1 を見積もる')) + '</li>' +
            '<li>' + esc(L('Spectrum, readout, residual ZZ', 'スペクトル、読み出し、残留 ZZ')) + '</li>' +
            '<li>' + esc(L('Gate circuits and DRAG pulses with that noise', 'その雑音を入れたゲート回路と DRAG パルス')) + '</li></ul></button>' +
          '<button class="card-pick" data-platform="ph" aria-pressed="' + !sc + '"><h3>' + esc(L('Photonic', '光方式')) + '</h3><p>' +
            esc(L('Integrated waveguides, ring sources, interferometer meshes, single-photon detectors.', '集積導波路、リング光源、干渉計メッシュ、単一光子検出器。')) + '</p><ul>' +
            '<li>' + esc(L('Modes, rings and interferometers per platform', '材料系ごとのモード、リング、干渉計')) + '</li>' +
            '<li>' + esc(L('Beam propagation through couplers and splitters', 'カプラや分岐を通るビーム伝搬')) + '</li>' +
            '<li>' + esc(L('Few-photon circuits, loss-limited squeezing', '少数光子の回路、損失で決まるスクイージング')) + '</li></ul></button>' +
        '</div>' +

        '<div class="grid g3">' +
          '<div class="panel"><div class="panel-head"><h2>' + esc(L('Calculated here', 'ここで計算しているもの')) + '</h2><div class="right">' + YR.ui.tag('computed') + '</div></div><ul class="plain">' +
            [L('Transmon spectrum by diagonalisation in the charge basis', '電荷基底での対角化によるトランズモンのスペクトル'),
              L('Static ZZ from the dressed two-transmon levels', '2 トランズモンの固有準位から求める静的 ZZ'),
              L('Coplanar-line fields by a 2D finite-difference solver', '2 次元差分法によるコプレーナ線路の電界'),
              L('Waveguide modes, ring spectra, 2D beam propagation', '導波路モード、リングのスペクトル、2 次元ビーム伝搬'),
              L('Density-matrix circuits; three-level Lindblad pulses', '密度行列による回路計算、3 準位リンドブラッドのパルス計算'),
              L('Few-photon interference by matrix permanents', '行列パーマネントによる少数光子の干渉')].map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>' +
            '<p class="note">' + esc(L('Each kernel is checked against a closed-form result in tests/.', '各計算は tests/ で解析解と照合しています。')) + '</p></div>' +
          '<div class="panel"><div class="panel-head"><h2>' + esc(L('Placeholders', '仮置きのもの')) + '</h2><div class="right">' + YR.ui.tag('placeholder') + '</div></div><ul class="plain">' +
            [L('Material values: representative, not from a cited database', '材料の数値: 代表値で、出典付きデータベースではない'),
              L('Participation ratios and their 1/gap scaling', '参加率と、その 1/ギャップ則'),
              L('Chip drawings: schematic, not design-rule accurate', 'チップの図: 模式図で、設計ルールどおりではない'),
              L('Frequency-collision windows: editable defaults', '周波数衝突の判定幅: 変更可能な既定値')].map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul></div>' +
          '<div class="panel"><div class="panel-head"><h2>' + esc(L('Not built', '未実装')) + '</h2><div class="right">' + YR.ui.tag('planned') + '</div></div><ul class="plain">' +
            [L('3D electromagnetic extraction, GDSII export', '3 次元電磁界抽出、GDSII 出力'),
              L('Saving and loading projects', 'プロジェクトの保存と読み込み'),
              L('Quantum AI, security research, condensed-matter and semiconductor links', '量子 AI、セキュリティ研究、物性、半導体技術との接続')].map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>' +
            '<p class="note"><button class="btn ghost" data-go="extensions">' + esc(L('See the planned extensions', '今後の拡張を見る')) + '</button></p></div>' +
        '</div>';

      root.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => YR.go(b.dataset.go)));
      root.querySelectorAll('[data-platform]').forEach((b) => b.addEventListener('click', () => {
        state.platform = b.dataset.platform; YR.store.save(); YR.renderAll();
      }));
      return null;
    }
  };
})(globalThis.YR = globalThis.YR || {});
