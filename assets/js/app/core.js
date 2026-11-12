/* Application core: shared design state, derived quantities, language, small UI helpers. */
(function (YR) {
  'use strict';

  const STORE_KEY = 'yuragi-research-mockup-v2';

  const defaults = {
    lang: 'en',
    platform: 'sc',
    view: 'overview',
    sc: {
      film: 'Ta', substrate: 'Sapphire', tempMk: 20,
      ic: 28, c: 78, gap: 30,
      fr: 7.0, g: 60, kappa: 0.5,
      tphi: 120,
      neighbour: 0.12, j: 3,
      cpwW: 10, cpwS: 6,
      t1q: 30, t2q: 200
    },
    ph: {
      platform: 'SiN', w: 1.0, h: 0.4, lambda: 1.55,
      ringLength: 600, kappa2: 0.02,
      k1: 0.5, k2: 0.5,
      pathMm: 20, couplingDb: 1.0, detector: 0.9,
      squeezeR: 1.0, hom: 0.95
    }
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  const state = clone(defaults);

  function load() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { saved = null; }
    if (saved && typeof saved === 'object') {
      for (const k of ['lang', 'platform', 'view']) if (typeof saved[k] === 'string') state[k] = saved[k];
      for (const grp of ['sc', 'ph']) {
        if (saved[grp] && typeof saved[grp] === 'object') {
          for (const k of Object.keys(defaults[grp])) {
            if (typeof saved[grp][k] === typeof defaults[grp][k]) state[grp][k] = saved[grp][k];
          }
        }
      }
    } else {
      const nav = (navigator.language || 'en').toLowerCase();
      state.lang = nav.indexOf('ja') === 0 ? 'ja' : 'en';
    }
    try {
      const q = new URLSearchParams(location.search);
      if (q.get('lang') === 'ja' || q.get('lang') === 'en') state.lang = q.get('lang');
      if (q.get('platform') === 'sc' || q.get('platform') === 'ph') state.platform = q.get('platform');
      if (q.get('view')) state.view = q.get('view');
    } catch (e) { /* ignore */ }
    if (state.lang !== 'ja' && state.lang !== 'en') state.lang = 'en';
    if (state.platform !== 'sc' && state.platform !== 'ph') state.platform = 'sc';
  }
  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        lang: state.lang, platform: state.platform, view: state.view, sc: state.sc, ph: state.ph
      }));
    } catch (e) { /* storage may be unavailable */ }
  }
  function reset() {
    state.sc = clone(defaults.sc);
    state.ph = clone(defaults.ph);
    save();
  }

  /** Pick the string for the current language. */
  function L(en, ja) { return state.lang === 'ja' ? ja : en; }
  /** Pick from a [en, ja] pair or pass a plain string through. */
  function LL(pair) { return Array.isArray(pair) ? (state.lang === 'ja' ? pair[1] : pair[0]) : pair; }

  // ---------- derived quantities ----------
  function byId(list, id) { return list.find((x) => x.id === id) || list[0]; }

  function lossChannels(s, film, substrate) {
    const P = YR.materials.participation;
    const scale = P.referenceGap / s.gap;
    return [
      { key: 'bulk', label: ['Substrate bulk', '基板バルク'], p: P.bulk, tand: substrate.tandBulk },
      { key: 'ms', label: ['Metal–substrate', '金属–基板界面'], p: P.metalSubstrate * scale, tand: film.tandSurface },
      { key: 'sa', label: ['Substrate–air', '基板–空気界面'], p: P.substrateAir * scale, tand: P.tandSubstrateAir },
      { key: 'ma', label: ['Metal–air', '金属–空気界面'], p: P.metalAir * scale, tand: film.tandSurface }
    ];
  }

  function deriveSc(s) {
    s = s || state.sc;
    const film = byId(YR.materials.films, s.film);
    const substrate = byId(YR.materials.substrates, s.substrate);
    const ej = YR.sc.ejFromIc(s.ic);
    const ec = YR.sc.ecFromC(s.c);
    const tr = YR.sc.transmonSummary(ej, ec);
    const channels = lossChannels(s, film, substrate);
    const t1Diel = YR.sc.dielectricT1(tr.f01, channels);
    const ro = YR.sc.readout(tr.f01, tr.alpha, s.fr, s.g, s.kappa);
    const t1 = YR.sc.combineT1([t1Diel, ro.purcellT1]);
    const t2 = YR.sc.t2From(t1, s.tphi);
    const f2 = tr.f01 + s.neighbour;
    const zz = YR.sc.staticZZ(tr.f01, tr.alpha, f2, tr.alpha, s.j / 1000);
    const line = YR.sc.cpw(s.cpwW, s.cpwS, substrate.epsR);
    return {
      film, substrate, ej, ec, tr, channels, t1Diel, ro, t1, t2, f2,
      zzKHz: zz * 1e6,
      line,
      resonatorMm: YR.sc.resonatorLength(s.fr, line.epsEff, 'quarter'),
      gap: YR.sc.bcsGap(film.tc),
      xqp: YR.sc.thermalQuasiparticles(film.tc, s.tempMk / 1000)
    };
  }

  function derivePh(s) {
    s = s || state.ph;
    const mat = byId(YR.materials.photonic, s.platform);
    const geom = { nCore: mat.nCore, nSub: mat.nClad, nClad: mat.nClad, h: s.h, w: s.w, lambda: s.lambda };
    const mode = YR.photonics.stripMode(geom);
    const ng = mode ? YR.photonics.groupIndex(geom) : null;
    const ring = YR.photonics.ring({
      length: s.ringLength, ng: ng || mat.nCore, lossDbCm: mat.lossDbCm, kappa2: s.kappa2, lambda0: s.lambda
    });
    const chipDb = mat.lossDbCm * s.pathMm / 10;
    const totalDb = chipDb + s.couplingDb;
    const eta = Math.pow(10, -totalDb / 10) * s.detector;
    return {
      mat, geom, mode, ng, ring, chipDb, totalDb, eta,
      squeezeDb: YR.photonics.squeezingDb(s.squeezeR, eta),
      squeezeIdealDb: YR.photonics.squeezingDb(s.squeezeR, 1)
    };
  }

  // ---------- formatting ----------
  function sig(x, n) {
    if (x === null || x === undefined || !isFinite(x)) return x === Infinity ? '∞' : '—';
    if (x === 0) return '0';
    const a = Math.abs(x);
    n = n || 3;
    if (a >= 1e5 || a < 1e-2) {
      const e = Math.floor(Math.log10(a));
      const m = x / Math.pow(10, e);
      return m.toFixed(Math.max(0, n - 1)) + 'e' + e;
    }
    const digits = Math.max(0, n - 1 - Math.floor(Math.log10(a)));
    return x.toFixed(Math.min(digits, 6));
  }
  /** Format a time given in microseconds. */
  function timeUs(us) {
    if (!isFinite(us)) return ['∞', ''];
    if (us >= 1000) return [sig(us / 1000, 3), 'ms'];
    if (us >= 1) return [sig(us, 3), 'µs'];
    return [sig(us * 1000, 3), 'ns'];
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ---------- UI helpers ----------
  function el(tag, attrs, html) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const k of Object.keys(attrs)) {
        if (k === 'class') node.className = attrs[k];
        else if (k.indexOf('on') === 0) node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== false && attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      }
    }
    if (html !== undefined) node.innerHTML = html;
    return node;
  }

  /** Set innerHTML and replace every <i data-slot="name"> by the given node. */
  function mount(root, html, slots) {
    root.innerHTML = html;
    if (slots) {
      for (const name of Object.keys(slots)) {
        const target = root.querySelector('[data-slot="' + name + '"]');
        if (target && slots[name]) target.replaceWith(slots[name]);
      }
    }
    return root;
  }
  function out(root, id, html) {
    const node = root.querySelector('[data-out="' + id + '"]');
    if (node) node.innerHTML = html;
    return node;
  }

  /** Range control. opts: { label, unit, min, max, step, digits, get, set, live } */
  function slider(opts) {
    const wrap = el('label', { class: 'ctl' });
    const digits = opts.digits === undefined ? 2 : opts.digits;
    const show = (v) => (opts.format ? opts.format(v) : Number(v).toFixed(digits)) + (opts.unit ? ' ' + opts.unit : '');
    const label = el('span', { class: 'ctl-label' }, esc(opts.label));
    const output = el('output', null, esc(show(opts.get())));
    const input = el('input', { type: 'range', min: opts.min, max: opts.max, step: opts.step, value: opts.get() });
    const fire = (final) => {
      const v = parseFloat(input.value);
      opts.set(v);
      output.textContent = show(v);
      if (opts.onChange) opts.onChange(v, final);
      else YR.changed(final);
    };
    input.addEventListener('input', () => fire(false));
    input.addEventListener('change', () => fire(true));
    wrap.append(label, output, input);
    wrap.refresh = () => { input.value = opts.get(); output.textContent = show(opts.get()); };
    return wrap;
  }

  /** Segmented buttons. opts: { options: [{ value, label }], get, set, small } */
  function segmented(opts) {
    const wrap = el('div', { class: 'seg' + (opts.small ? ' small' : ''), role: 'group' });
    if (opts.label) wrap.setAttribute('aria-label', opts.label);
    const paint = () => {
      wrap.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === String(opts.get()))));
    };
    for (const o of opts.options) {
      const b = el('button', { type: 'button', 'data-value': o.value }, esc(o.label));
      b.addEventListener('click', () => { opts.set(o.value); paint(); });
      wrap.append(b);
    }
    paint();
    wrap.refresh = paint;
    return wrap;
  }

  function stat(id, label, cls) {
    return '<div class="stat' + (cls ? ' ' + cls : '') + '" data-stat="' + id + '"><div class="stat-label">' + esc(label) +
      '</div><div class="stat-value" data-out="' + id + '">—</div><div class="stat-sub" data-out="' + id + '-sub"></div></div>';
  }
  function val(number, unit) { return esc(number) + (unit ? '<small>' + esc(unit) + '</small>' : ''); }

  function tag(kind) {
    const text = {
      computed: L('Computed', '計算'),
      placeholder: L('Placeholder data', '仮データ'),
      planned: L('Planned', '構想'),
      schematic: L('Schematic', '模式図')
    }[kind];
    const tip = {
      computed: L('Calculated in this app from the current design values.', '現在の設計値から、このアプリ内で計算しています。'),
      placeholder: L('Typed-in representative values, not a cited database.', '代表的な値を手入力したもので、出典付きのデータベースではありません。'),
      planned: L('Not built. Shown to mark where it will connect.', '未実装です。接続する位置を示すために置いています。'),
      schematic: L('Drawn for illustration; not design-rule accurate.', '説明用の図で、設計ルールどおりの寸法ではありません。')
    }[kind];
    return '<span class="tag ' + kind + '" title="' + esc(tip) + '">' + esc(text) + '</span>';
  }

  let toastTimer = null;
  function toast(message) {
    const node = document.getElementById('toast');
    if (!node) return;
    node.textContent = message;
    node.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove('show'), 3200);
  }
  function notBuilt(what) {
    toast(L(what + ' is not part of this mockup yet.', what + ' は、このモックアップではまだ動きません。'));
  }

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  YR.state = state;
  YR.defaults = defaults;
  YR.store = { load, save, reset };
  YR.L = L;
  YR.LL = LL;
  YR.derive = { sc: deriveSc, ph: derivePh, lossChannels, byId };
  YR.fmt = { sig, timeUs, esc };
  YR.ui = { el, mount, out, slider, segmented, stat, val, tag, toast, notBuilt, cssVar };
  YR.views = {};
})(globalThis.YR = globalThis.YR || {});
