# Yuragi Research (working title) — workbench mockup

**日本語** | [English](#english)

量子チップを「材料 → デバイス → チップレイアウト → 電磁界・光学 → 量子回路 → ダイナミクス」の順に設計し、
上流で決めた値が下流の結果までそのまま流れる、研究用ローカルアプリのモックアップです。
超伝導方式と光方式を同じ流れで扱います。名称は仮称です。

これは**モックアップ**です。画面と操作の流れ、そして「どこまでを本当に計算するか」を確かめるためのものです。
各パネルには次の印が付いています。

| 印 | 意味 |
|---|---|
| 計算 | 現在の設計値から、このアプリの中で計算している |
| 仮データ | 代表値を手入力したもの。出典付きのデータベースではない |
| 模式図 | 説明用の図。設計ルールどおりの寸法ではない |
| 構想 | 未実装。どこに接続するかを示すために置いている |

## 起動

依存パッケージもビルドもありません。

- `index.html` をダブルクリックして開く。または
- `python launch.py` (標準ライブラリのみ。ローカルサーバを立ててブラウザを開く。Ctrl+C で終了)

デスクトップアプリとしての包み方 (Tauri、pywebview など) は未決定です。

## 何を計算しているか

| 工程 | 超伝導 | 光 |
|---|---|---|
| 材料 | 損失の内訳から T1 上限、BCS ギャップ、熱励起準粒子 | 材料系ごとの n_eff・n_g、損失から全体の効率 η |
| デバイス | 電荷基底の対角化によるトランズモンのスペクトル、分散読み出し、2 トランズモンの固有準位から求める静的 ZZ | スラブ導波路モード (等価屈折率法)、リング共振器、マッハ・ツェンダー干渉計 |
| レイアウト | 周波数割り当て、衝突判定、λ/4 共振器長 | 干渉計メッシュの伝達行列、光路長と損失 |
| 電磁界・光学 | コプレーナ線路断面の 2 次元差分ソルバ (解析式と比較) | 2 次元ビーム伝搬法 (方向性結合器、Y 分岐、MZI、MMI) |
| 回路 | 密度行列による回路計算 (T1・Tφ つき) | 行列パーマネントによる少数光子の干渉 |
| ダイナミクス | 3 準位リンドブラッド方程式でのパルス計算 (DRAG) | 損失下のスクイージング、HOM ディップ |

計算カーネルは `assets/js/physics/` にあり、UI から独立しています。

## 検証

```
node --test tests/physics.test.js
```

各カーネルを解析解と照合します (15 件)。例: トランズモンの漸近式、ZZ の 2 次摂動、CPW の等角写像の式、
スラブ導波路の分散関係、BPM のパワー保存、HOM の同時計数ゼロ、ベル状態、DRAG によるリーク低減。

画面の操作テストは、`python launch.py --no-open --port 8765` を起動したうえで
`http://127.0.0.1:8765/tests/ui-smoke.html` を開きます。全ビュー・両方式・両言語で
スライダーやボタンを操作し、未捕捉の例外がないことを確かめます。

## 未実装・注意

- 材料の数値は**仮データ**です。損失正接は製造工程で桁が変わります。研究に使う前に、出典のある値へ置き換えてください。
- 表面の参加率は基準形状からの 1/ギャップ則で換算しています。解いた電界から求めてはいません。
- 周波数衝突の判定幅は既定値です。文献との照合はまだしていません。
- 等価屈折率法は、高屈折率差の細い導波路で閉じ込めとモード数を多めに見積もります。群屈折率に材料分散は入っていません。
- BPM はスカラー・近軸近似です。急な曲げや高屈折率差では定性的な結果です。
- 回路の雑音モデルは振幅減衰と純位相緩和だけです。制御誤差、リーク、クロストーク、読み出し誤りは入っていません。
- 3 次元電磁界抽出、GDSII 出力、プロジェクトの保存は未実装です。
- 量子 AI、セキュリティ研究、物性モデル、半導体技術との接続は構想段階です (「拡張」ページ)。

## 構成

```
index.html
launch.py                 ローカル起動用 (標準ライブラリのみ)
assets/css/app.css
assets/js/physics/        計算カーネル (UI 非依存、Node からも読める)
assets/js/data/           材料の仮データ
assets/js/app/            状態・共通 UI・描画・シェル
assets/js/views/          各工程の画面
tests/                    カーネルの検証と画面の操作テスト
```

---

<a id="english"></a>

# English

A mockup of a local research application for designing quantum chips in one flow:
materials → device → chip layout → field / optical simulation → quantum circuit → dynamics.
Values chosen upstream reach the results downstream. Superconducting and photonic chips share the flow.
The name is a working title.

This is a **mockup**: it exists to check the screens, the flow, and how much is actually computed.
Every panel carries one of these marks.

| Mark | Meaning |
|---|---|
| Computed | Calculated in this app from the current design values |
| Placeholder data | Typed-in representative values, not a cited database |
| Schematic | Drawn for illustration; not design-rule accurate |
| Planned | Not built; shown to mark where it will connect |

## Run

No dependencies, no build step.

- Double-click `index.html`, or
- `python launch.py` (standard library only; serves the folder locally and opens the browser; Ctrl+C stops it)

How to wrap it as a desktop application (Tauri, pywebview, …) is undecided.

## What is computed

| Stage | Superconducting | Photonic |
|---|---|---|
| Materials | T1 limit from a loss budget, BCS gap, thermal quasiparticles | n_eff and n_g per platform, total efficiency η from loss |
| Device | Transmon spectrum by charge-basis diagonalisation, dispersive readout, static ZZ from dressed two-transmon levels | Slab-waveguide modes (effective-index method), ring resonator, Mach–Zehnder interferometer |
| Layout | Frequency allocation, collision checks, λ/4 resonator lengths | Transfer matrix of the interferometer mesh, path length and loss |
| Field / optics | 2D finite-difference solver for the coplanar-line cross-section (compared with the closed form) | 2D beam propagation (directional coupler, Y-branch, MZI, MMI) |
| Circuit | Density-matrix circuits with T1 and Tφ | Few-photon interference by matrix permanents |
| Dynamics | Three-level Lindblad pulse simulation (DRAG) | Squeezing under loss, Hong–Ou–Mandel dip |

The kernels live in `assets/js/physics/` and do not depend on the UI.

## Verification

```
node --test tests/physics.test.js
```

Fifteen checks of the kernels against closed-form results: transmon asymptotics, second-order ZZ,
the conformal-mapping CPW formula, the slab dispersion relation, power conservation in BPM,
zero Hong–Ou–Mandel coincidences, Bell states, leakage reduction by DRAG, and others.

For the UI, start `python launch.py --no-open --port 8765` and open
`http://127.0.0.1:8765/tests/ui-smoke.html`. It drives the sliders and buttons of every view,
on both platforms and in both languages, and reports uncaught errors.

## Not built, and caveats

- Material values are **placeholders**. Loss tangents change by orders of magnitude with process; replace them with sourced values before any research use.
- Surface participation is scaled as 1/gap from a reference geometry, not obtained from the solved fields.
- The frequency-collision windows are defaults that have not yet been checked against the literature.
- The effective-index method overestimates confinement and mode count in small high-contrast guides; the group index has no material dispersion.
- The beam-propagation method is scalar and paraxial: qualitative for tight bends and high index contrast.
- The circuit noise model has amplitude damping and pure dephasing only: no control error, leakage, crosstalk or readout error.
- 3D electromagnetic extraction, GDSII export and project files are not built.
- Quantum AI, security research, condensed-matter models and links to semiconductor technology are plans (see the Extensions page).
