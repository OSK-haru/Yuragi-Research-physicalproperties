/* Planned extensions: where later research modules attach to the design thread. Nothing here is built. */
(function (YR) {
  'use strict';
  const L = YR.L, esc = YR.fmt.esc, ui = YR.ui;

  YR.views.extensions = {
    title: () => L('Extensions', '拡張'),
    sub: () => L('Planned modules', '今後のモジュール'),
    render(root) {
      const items = [
        { name: L('Quantum AI', '量子 AI'),
          reads: L('reads: Circuit, Dynamics', '入力: 回路、ダイナミクス'),
          text: L('Variational and learning circuits evaluated on the designed hardware instead of an ideal simulator: how trainability and accuracy move with T1, crosstalk or optical loss.',
            '変分回路や学習回路を、理想的なシミュレータではなく設計したハードウェアの上で評価します。学習のしやすさや精度が、T1、クロストーク、光損失でどう変わるかを調べます。'),
          asks: L('Open: which workloads and which metrics come first.', '未決定: 最初に扱う課題と評価指標。') },
        { name: L('Security research', 'セキュリティ研究'),
          reads: L('reads: Layout, Device, Dynamics', '入力: レイアウト、デバイス、ダイナミクス'),
          text: L('Leakage between users sharing one chip — residual ZZ, drive crosstalk, reset residue, readout correlation — computed from the layout and couplings chosen here. The attack-simulation engine exists in the sibling project Yuragi-Strider.',
            '1 つのチップを共有する利用者間の情報漏れ (残留 ZZ、駆動クロストーク、リセット残留、読み出しの相関) を、ここで決めたレイアウトと結合から計算します。攻撃シミュレーションの計算エンジンは、姉妹プロジェクト Yuragi-Strider にあります。'),
          asks: L('Open: how the two projects exchange a chip description.', '未決定: 2 つのプロジェクト間でチップ記述を受け渡す形式。') },
        { name: L('Condensed-matter models', '物性モデル'),
          reads: L('feeds: Materials', '出力先: 材料'),
          text: L('Replace the placeholder numbers by models: two-level-system loss with its power and temperature dependence, quasiparticle dynamics, kinetic inductance, and for photonics the dispersion and nonlinearity of each material.',
            '仮データをモデルに置き換えます。二準位系による損失とそのパワー・温度依存性、準粒子のダイナミクス、力学インダクタンス。光方式では各材料の分散と非線形性。'),
          asks: L('Open: sourced material database and its citation format.', '未決定: 出典付きの材料データベースと引用の形式。') },
        { name: L('Semiconductor technology', '半導体技術との接続'),
          reads: L('reads: Layout · feeds: Materials, Device', '入力: レイアウト · 出力先: 材料、デバイス'),
          text: L('Foundry process design kits and layer stacks, cryogenic CMOS control and its heat load, 3D integration with through-silicon vias and bump bonds, and spin qubits in silicon as a third platform.',
            'ファウンドリのプロセス設計キットと層構成、極低温 CMOS 制御とその発熱、シリコン貫通ビアやバンプ接合による 3 次元実装、そして第 3 の方式としてのシリコンスピン量子ビット。'),
          asks: L('Open: which process kits can be used legally in an open tool.', '未決定: 公開ツールで合法的に使えるプロセス設計キット。') }
      ];
      root.innerHTML =
        ui.head(L('Later', '今後'), L('Extensions', '拡張'),
          L('Four research directions planned on top of the design flow. None is built; each card says which stage it would read from or feed.',
            '設計の流れの上に載せる予定の、4 つの研究テーマです。いずれも未実装で、各カードに、どの工程から読み、どの工程へ渡すかを書いています。')) +
        '<div class="grid g2" style="margin-bottom:14px">' + items.map((it) =>
          '<div class="panel ext"><div class="panel-head" style="margin-bottom:2px"><h3>' + esc(it.name) + '</h3><div class="right">' + ui.tag('planned') + '</div></div>' +
          '<div class="reads">' + esc(it.reads) + '</div><p>' + esc(it.text) + '</p><p style="color:var(--text-3)">' + esc(it.asks) + '</p></div>').join('') + '</div>' +
        '<div class="panel"><div class="panel-head"><h2>' + esc(L('What an extension receives', '拡張モジュールが受け取るもの')) + '</h2><div class="right">' + ui.tag('schematic') + '</div></div>' +
          '<p class="lead">' + esc(L('Every stage already reads one shared set of design values — the bar at the bottom of the window. An extension would read the same values, so a result can always be traced back to a material or a dimension.',
            'すべての工程は、すでに 1 組の共有設計値 (画面下のバー) を読んでいます。拡張モジュールも同じ値を読むので、得られた結果は、必ずもとの材料や寸法までたどれます。')) + '</p>' +
          '<div class="scroll-x"><table class="data"><thead><tr><th>' + esc(L('Stage', '工程')) + '</th><th>' + esc(L('Superconducting', '超伝導')) + '</th><th>' + esc(L('Photonic', '光')) + '</th></tr></thead><tbody>' +
          [[L('Materials', '材料'), L('film, substrate, loss tangents, participations', '薄膜、基板、損失正接、参加率'), L('indices, propagation loss, nonlinearity', '屈折率、伝搬損失、非線形性')],
            [L('Device', 'デバイス'), 'EJ, EC, f01, α, g, κ, χ, J, ZZ, T1, T2', L('n_eff, n_g, ring Q and FSR, splitter ratios', 'n_eff、n_g、リングの Q と FSR、分岐比')],
            [L('Layout', 'レイアウト'), L('positions, frequency plan, coupling graph, line lengths', '配置、周波数計画、結合グラフ、線路長'), L('mode count, mesh phases, path length, efficiency', 'モード数、メッシュの位相、光路長、効率')],
            [L('Circuit and dynamics', '回路とダイナミクス'), L('density matrices, fidelities, leakage', '密度行列、忠実度、リーク'), L('output distributions, squeezing, visibility', '出力分布、スクイージング、明瞭度')]
          ].map((r) => '<tr><td><b>' + esc(r[0]) + '</b></td><td>' + esc(r[1]) + '</td><td>' + esc(r[2]) + '</td></tr>').join('') + '</tbody></table></div></div>';
      return null;
    }
  };
})(globalThis.YR = globalThis.YR || {});
