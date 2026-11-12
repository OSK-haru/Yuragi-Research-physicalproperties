/* Shell: top bar, stage navigation, design thread, routing. */
(function (YR) {
  'use strict';
  const el = YR.ui.el;
  const L = YR.L, esc = YR.fmt.esc, state = YR.state;

  const ORDER = ['overview', 'materials', 'device', 'layout', 'field', 'circuit', 'dynamics', 'extensions'];
  let currentUpdate = null;

  const LOGO = '<svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">' +
    '<rect x="1" y="1" width="24" height="24" rx="6" fill="none" stroke="currentColor" stroke-opacity=".35"/>' +
    '<path d="M4 13c2.2-6 4.4-6 6.6 0s4.4 6 6.6 0 3.2-5 4.8-2.4" fill="none" stroke="var(--accent)" stroke-width="1.8" stroke-linecap="round"/>' +
    '<circle cx="13" cy="13" r="1.7" fill="var(--accent)"/></svg>';

  function renderTop() {
    const top = document.getElementById('topbar');
    top.innerHTML =
      '<div class="brand">' + LOGO + '<span>Yuragi Research</span><small>' + esc(L('workbench', 'ワークベンチ')) + '</small></div>' +
      '<div class="project">' + esc(L('Project', 'プロジェクト')) + ' · <b>' + esc(L('Untitled chip', '無題のチップ')) + '</b></div>' +
      '<div class="spacer"></div>' +
      '<i data-slot="platform"></i><i data-slot="lang"></i>' +
      '<span class="mock-flag" title="' + esc(L('This is a mockup. Panels are marked as computed, placeholder or planned.', 'これはモックアップです。各パネルに「計算」「仮データ」「構想」の印があります。')) + '">' + esc(L('Mockup 0.1', 'モックアップ 0.1')) + '</span>';
    top.querySelector('[data-slot="platform"]').replaceWith(YR.ui.segmented({
      label: L('Platform', '方式'),
      options: [{ value: 'sc', label: L('Superconducting', '超伝導') }, { value: 'ph', label: L('Photonic', '光') }],
      get: () => state.platform,
      set: (v) => { state.platform = v; YR.store.save(); renderAll(); }
    }));
    top.querySelector('[data-slot="lang"]').replaceWith(YR.ui.segmented({
      label: L('Language', '言語'),
      options: [{ value: 'ja', label: '日本語' }, { value: 'en', label: 'English' }],
      get: () => state.lang,
      set: (v) => { state.lang = v; YR.store.save(); renderAll(); }
    }));
  }

  function renderNav() {
    const nav = document.getElementById('nav');
    nav.setAttribute('aria-label', L('Stages', '工程'));
    nav.innerHTML = '';
    const group = (text) => nav.append(el('div', { class: 'nav-group' }, esc(text)));
    ORDER.forEach((id, i) => {
      const v = YR.views[id];
      if (!v) return;
      if (id === 'overview') group(L('Project', 'プロジェクト'));
      if (id === 'materials') group(L('Design flow', '設計の流れ'));
      if (id === 'extensions') group(L('Later', '今後'));
      const b = el('button', { class: 'nav-item', type: 'button', 'data-view': id },
        '<span class="num">' + (i === 0 ? '··' : String(i).padStart(2, '0')) + '</span><span>' + esc(v.title()) + '</span>' +
        '<span class="sub">' + esc(v.sub()) + '</span>');
      if (state.view === id) b.setAttribute('aria-current', 'page');
      b.addEventListener('click', () => go(id));
      nav.append(b);
    });
    nav.append(el('div', { class: 'nav-foot' }, esc(L(
      'Values flow downstream: a change in Materials reaches Circuit and Dynamics.',
      '値は下流へ流れます。材料を変えると、回路やダイナミクスの結果も変わります。'))));
  }

  function renderThread() {
    const bar = document.getElementById('thread');
    const item = (label, value, hl) => '<span class="t-item"><span>' + esc(label) + '</span><b' + (hl ? ' class="hl"' : '') + '>' + esc(value) + '</b></span>';
    let html = '<span class="t-title">' + esc(L('Design thread', '設計値')) + '</span>';
    if (state.platform === 'sc') {
      const d = YR.derive.sc();
      const t1 = YR.fmt.timeUs(d.t1), t2 = YR.fmt.timeUs(d.t2);
      html += item(L('Stack', '材料'), d.film.name + ' / ' + YR.LL(d.substrate.name)) +
        item('EJ/EC', YR.fmt.sig(d.tr.ratio, 3)) +
        item('f01', d.tr.f01.toFixed(3) + ' GHz', true) +
        item('α', (d.tr.alpha * 1000).toFixed(0) + ' MHz') +
        item('T1', t1[0] + ' ' + t1[1], true) +
        item('T2', t2[0] + ' ' + t2[1]) +
        item('ZZ', d.zzKHz.toFixed(0) + ' kHz') +
        item('Z0', d.line.z0.toFixed(1) + ' Ω');
    } else {
      const d = YR.derive.ph();
      html += item(L('Platform', '材料系'), YR.LL(d.mat.name)) +
        item('λ', state.ph.lambda.toFixed(2) + ' µm') +
        item('n_eff', d.mode ? d.mode.neff.toFixed(3) : L('cut off', 'カットオフ'), true) +
        item('n_g', d.ng ? d.ng.toFixed(2) : '—') +
        item(L('Ring Q', 'リング Q'), YR.fmt.sig(d.ring.q, 3)) +
        item(L('Total loss', '全損失'), d.totalDb.toFixed(2) + ' dB') +
        item('η', (d.eta * 100).toFixed(1) + ' %', true) +
        item(L('Squeezing', 'スクイージング'), d.squeezeDb.toFixed(2) + ' dB');
    }
    bar.innerHTML = html;
  }

  function renderView() {
    const main = document.getElementById('main');
    if (!YR.views[state.view]) state.view = 'overview';
    const root = el('div', { class: 'view' });
    main.innerHTML = '';
    main.append(root);
    currentUpdate = YR.views[state.view].render(root) || null;
    if (currentUpdate) currentUpdate(true);
    main.scrollTop = 0;
  }

  function renderAll() {
    document.documentElement.lang = state.lang;
    document.documentElement.dataset.platform = state.platform;
    document.title = L('Yuragi Research — workbench mockup', 'Yuragi Research — ワークベンチ (モックアップ)');
    renderTop(); renderNav(); renderThread(); renderView();
  }

  function go(id) {
    state.view = id;
    YR.store.save();
    renderNav(); renderView();
    document.getElementById('main').focus({ preventScroll: true });
  }

  /** Called by controls after they change the design state. */
  YR.changed = function (final) {
    if (final !== false) YR.store.save();
    renderThread();
    if (currentUpdate) currentUpdate(final !== false);
  };
  YR.go = go;
  YR.renderAll = renderAll;

  /** Standard view header. */
  YR.ui.head = function (num, title, text, toolsSlot) {
    return '<div class="view-head"><div><div class="kicker">' + esc(num) + '</div><h1>' + esc(title) + '</h1><p>' + esc(text) + '</p></div>' +
      (toolsSlot ? '<div class="tools"><i data-slot="' + toolsSlot + '"></i></div>' : '') + '</div>';
  };

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (currentUpdate) currentUpdate(true); }, 120);
  });

  YR.store.load();
  renderAll();
})(globalThis.YR = globalThis.YR || {});
