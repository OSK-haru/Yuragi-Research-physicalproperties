/* Material catalogue for the mockup.
   PLACEHOLDER DATA: representative, order-of-magnitude values typed in for the mockup.
   They are not a cited database and must be replaced by sourced values before any
   research use. Loss tangents in particular vary by orders of magnitude with process. */
(function (YR) {
  'use strict';

  const films = [
    { id: 'Al', name: 'Al', tc: 1.2, oxide: 'AlOx', tandSurface: 2.0e-3,
      note: ['Standard junction metal; shadow evaporation.', '接合の標準金属。斜め蒸着で作る。'] },
    { id: 'Nb', name: 'Nb', tc: 9.2, oxide: 'Nb2O5', tandSurface: 5.0e-3,
      note: ['Robust, sputtered; lossy native oxide.', '丈夫でスパッタ成膜。自然酸化膜の損失が大きい。'] },
    { id: 'Ta', name: 'α-Ta', tc: 4.4, oxide: 'Ta2O5', tandSurface: 8.0e-4,
      note: ['Thin, stable oxide; long-coherence pads.', '酸化膜が薄く安定。長寿命のパッド向き。'] },
    { id: 'TiN', name: 'TiN', tc: 4.5, oxide: 'TiOxNy', tandSurface: 6.0e-4,
      note: ['Low-loss nitride; high kinetic inductance.', '低損失の窒化物。力学インダクタンスが大きい。'] },
    { id: 'NbTiN', name: 'NbTiN', tc: 14.5, oxide: 'mixed oxide', tandSurface: 1.5e-3,
      note: ['High Tc; also the usual SNSPD material.', '高 Tc。SNSPD の材料でもある。'] }
  ];

  const substrates = [
    { id: 'Si', name: ['High-resistivity Si', '高抵抗 Si'], epsR: 11.45, tandBulk: 2.5e-7,
      note: ['CMOS-compatible, deep etch available.', 'CMOS 工程と相性がよく、深掘りもできる。'] },
    { id: 'Sapphire', name: ['Sapphire (c-plane)', 'サファイア (c 面)'], epsR: 10.0, tandBulk: 3.0e-8,
      note: ['Very low bulk loss; hard to etch.', 'バルク損失は非常に小さいが、加工しにくい。'] }
  ];

  /* Energy participation of each loss channel for a reference planar transmon
     (pad gap 30 um). Surface terms scale roughly as 1/gap in the device model. */
  const participation = {
    referenceGap: 30,
    bulk: 0.90,
    metalSubstrate: 1.0e-4,
    substrateAir: 1.2e-4,
    metalAir: 1.0e-5,
    tandSubstrateAir: 1.5e-3
  };

  const photonic = [
    { id: 'SOI', name: ['Silicon on insulator', 'SOI (シリコン)'], nCore: 3.476, nClad: 1.444,
      h: 0.22, w: 0.5, lossDbCm: 2.0, lambda: 1.55,
      nonlinear: ['χ(3): n2 ≈ 5e-18 m²/W, two-photon absorption at 1550 nm', 'χ(3): n2 ≈ 5e-18 m²/W、1550 nm で二光子吸収あり'],
      modulator: ['Thermo-optic, carrier depletion', '熱光学、キャリア空乏'],
      source: ['SFWM (rings, spirals)', 'SFWM (リング、スパイラル)'],
      note: ['Dense and CMOS-foundry ready; loss and TPA limit squeezing.', '高密度で CMOS ファウンドリに乗る。損失と二光子吸収がスクイージングを制限する。'] },
    { id: 'SiN', name: ['Silicon nitride', '窒化シリコン'], nCore: 1.996, nClad: 1.444,
      h: 0.4, w: 1.0, lossDbCm: 0.1, lambda: 1.55,
      nonlinear: ['χ(3): n2 ≈ 2.4e-19 m²/W, no TPA', 'χ(3): n2 ≈ 2.4e-19 m²/W、二光子吸収なし'],
      modulator: ['Thermo-optic (slow)', '熱光学 (低速)'],
      source: ['SFWM, squeezed light from rings', 'SFWM、リングからのスクイーズド光'],
      note: ['Low loss, wide transparency; the usual choice for squeezed-light circuits.', '低損失で透明域が広い。スクイーズド光回路でよく選ばれる。'] },
    { id: 'TFLN', name: ['Thin-film lithium niobate', '薄膜ニオブ酸リチウム'], nCore: 2.211, nClad: 1.444,
      h: 0.6, w: 1.0, lossDbCm: 0.2, lambda: 1.55,
      nonlinear: ['χ(2): r33 ≈ 31 pm/V, periodic poling', 'χ(2): r33 ≈ 31 pm/V、周期分極反転'],
      modulator: ['Pockels (tens of GHz)', 'ポッケルス効果 (数十 GHz)'],
      source: ['SPDC in PPLN', 'PPLN での SPDC'],
      note: ['Fast switching for feed-forward; ridge etch is harder.', '高速スイッチでフィードフォワード向き。リッジ加工が難しい。'] },
    { id: 'Silica', name: ['Silica PLC', '石英 PLC'], nCore: 1.466, nClad: 1.444,
      h: 4.0, w: 4.0, lossDbCm: 0.01, lambda: 1.55,
      nonlinear: ['Very weak χ(3)', 'χ(3) はごく弱い'],
      modulator: ['Thermo-optic (slow)', '熱光学 (低速)'],
      source: ['External source', '外部光源'],
      note: ['Lowest loss and best fibre match; large bend radius.', '損失が最小でファイバーとの整合もよい。曲げ半径が大きい。'] }
  ];

  YR.materials = { films, substrates, participation, photonic };
})(globalThis.YR = globalThis.YR || {});
