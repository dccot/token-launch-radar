// Token Launch Radar — static dashboard. Reads window.RADAR (data.js, written
// beside dashboard/ by main.ts) and renders the ranked board, a detail view
// per protocol with its farm plan, filters, and a model sandbox. No network:
// every byte it shows is in data.js, and every number can be recomputed in
// the page from the stated model.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', chain: 'all', tier: 'all', tab: 'pre-token', sort: 'implied', dir: -1, selected: null };
  var sandbox = { growthWeight: DATA.model.growth_weight, scale: 1 };

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }

  // The model, recomputed in the page: the same arithmetic lib/model.ts runs,
  // so a reader can audit any board row against the snapshot figures it shows.
  function categoryMultiple(row, model) {
    if (row.category === null || row.category === undefined) return model.uncategorised_multiple;
    var v = model.category_multiples[row.category];
    return v === undefined ? model.default_multiple : v;
  }
  function impliedOf(row, model, growthWeight, scale) {
    var gw = growthWeight === undefined ? model.growth_weight : growthWeight;
    var sc = scale === undefined ? 1 : scale;
    var growth = Math.min(model.growth_cap, Math.max(model.growth_floor, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
    var growthMult = 1 + (growth / 100) * gw;
    var age = row.age_days === null || row.age_days === undefined ? model.unknown_age_days : row.age_days;
    var maturity = model.maturity_floor + (Math.min(Math.max(age, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
    var extra = Math.min(Math.max((row.chains ? row.chains.length : 1) - 1, 0), model.breadth_max_extra_chains);
    var breadth = 1 + model.breadth_per_chain * extra;
    return Math.max(1, Math.round(row.tvl_usd * categoryMultiple(row, model) * sc * growthMult * maturity * breadth));
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('tier')) state.tier = params.get('tier');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.tier !== 'all') params.set('tier', state.tier);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function rows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (state.tier !== 'all' && r.tier !== state.tier) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category || '', (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'ring' }), el('span', { text: 'Token Launch Radar' })),
      el('div', { class: 'top-meta' },
        el('span', { text: 'Snapshot ' + DATA.as_of }),
        el('span', { text: DATA.source }),
        el('span', { text: 'model ' + DATA.model_version })
      )
    );
  }

  function lede() {
    var totalImplied = DATA.rows.reduce(function (s, r) { return s + r.implied_value_usd; }, 0);
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', { text: 'Which pre-token protocol is worth farming next?' }),
        el('p', null,
          'Every protocol on the watchlist — at least ', el('b', { text: fmtUsd(DATA.floor_usd) }),
          ' of TVL and no token on record — ranked by implied value under one stated model, plus ',
          el('b', { text: DATA.early_size + ' early protocols' }),
          ' found below that floor by the same rule. Wrapped, staked and bridged derivatives of tokens that already trade are excluded. Implied value is this radar\u2019s own claim about what a token would be worth if the record stayed as it is — not a prediction that one will launch.'
        )
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Protocols ranked' }), el('b', { text: String(DATA.board_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Combined implied value' }), el('b', { text: fmtUsd(totalImplied) })),
        el('div', { class: 'fact' }, el('span', { text: 'Live-token set aside' }), el('b', { text: String(DATA.live_size) }))
      )
    );
  }

  function selectField(id, label, values, current, onchange) {
    var select = el('select', { id: id, 'aria-label': label },
      values.map(function (v) { return el('option', { value: v.value, text: v.text, selected: v.value === current ? 'selected' : null }); })
    );
    select.addEventListener('change', function () { onchange(select.value); writeHash(); render(); });
    return el('div', { class: 'field' }, el('label', { for: id, text: label }), select);
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.flatMap(function (r) { return r.chains || []; }))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, slug, category, chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token board', onclick: function () { state.tab = 'pre-token'; render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live tokens', onclick: function () { state.tab = 'live'; render(); } });
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      selectField('category', 'Category', [{ value: 'all', text: 'All categories' }].concat(categories.map(function (c) { return { value: c, text: c }; })), state.category, function (v) { state.category = v; }),
      selectField('chain', 'Chain', [{ value: 'all', text: 'All chains' }].concat(chains.map(function (c) { return { value: c, text: c }; })), state.chain, function (v) { state.chain = v; }),
      selectField('tier', 'Radar tier', [{ value: 'all', text: 'Watchlist + early' }, { value: 'watchlist', text: 'Watchlist only' }, { value: 'early', text: 'Early only' }], state.tier, function (v) { state.tier = v; }),
      el('div', { class: 'field' }, el('span', { class: 'lab', text: 'View' }), el('div', { class: 'tabs' }, pre, live)),
      el('span', { class: 'count', text: state.tab === 'pre-token' ? rows().length + ' of ' + DATA.board_size + ' rows' : DATA.live.length + ' live-token protocols' })
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label + (state.sort === key ? (state.dir < 0 ? ' \u25bc' : ' \u25b2') : ''))
    );
  }

  function boardTable() {
    var list = sortedRows(rows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or widen the category, chain or tier filter to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear all filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.tier = 'all'; writeHash(); render(); } })
      ));
    }
    var max = Math.max.apply(null, list.map(function (r) { return r.implied_value_usd; })) || 1;
    var tbody = el('tbody');
    list.forEach(function (r) {
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' \u00b7 ' + (r.chains && r.chains.length ? r.chains.slice(0, 3).join(', ') : 'chain n/a') })
        )),
        el('td', null, el('span', { class: 'badge ' + r.tier, text: r.tier })),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', { class: 'num conf-' + r.confidence, text: r.confidence }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) })
        ))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { text: 'Pre-token protocols ranked by implied value. Select any row for its model breakdown and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'),
            sortHeader('name', 'Protocol'),
            el('th', { scope: 'col', text: 'Tier' }),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            el('th', { scope: 'col', text: 'Data' }),
            sortHeader('implied', 'Implied value')
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' \u00b7 ' + (r.chains && r.chains.length ? r.chains.slice(0, 3).join(', ') : 'chain n/a') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', null, el('span', { class: 'badge', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { text: 'These protocols already have a token: their market cap is a market fact, not a model output, so they are shown for scale and never mixed into the pre-token ranking.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  function modelPanel() {
    var m = DATA.model;
    var present = {};
    DATA.rows.forEach(function (r) { if (r.category) present[r.category] = true; });
    var multRows = Object.keys(m.category_multiples).filter(function (c) { return present[c]; }).sort(function (a, b) { return m.category_multiples[b] - m.category_multiples[a]; }).slice(0, 10);
    var tbody = el('tbody');
    multRows.forEach(function (c) {
      tbody.appendChild(el('tr', null, el('td', { text: c }), el('td', { class: 'num', text: '\u00d7 ' + m.category_multiples[c].toFixed(2) })));
    });
    return el('section', { class: 'panel pad' },
      el('h2', { text: 'How implied value is computed' }),
      el('div', { class: 'formula', text: 'implied = round( tvl \u00d7 category_multiple \u00d7 (1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ')/100 \u00d7 ' + m.growth_weight + ') \u00d7 (' + m.maturity_floor + ' + min(age_days, ' + m.maturity_days + ')/' + m.maturity_days + ' \u00d7 ' + m.maturity_range + ') \u00d7 (1 + ' + m.breadth_per_chain + ' \u00d7 min(chains\u22121, ' + m.breadth_max_extra_chains + ')) )' }),
      el('p', { class: 'note', text: 'Category multiple: how much of each TVL dollar a token in that line of business can claim \u2014 trading and lending, whose fees can accrue to a token, highest; stable-asset issuers, whose TVL is mostly reserves, lowest (' + m.category_multiples['Stablecoin Issuer'] + '). Any other category uses \u00d7 ' + m.default_multiple + ', and no category \u00d7 ' + m.uncategorised_multiple + '. Growth is clamped so one wild week cannot dominate. Maturity rewards protocols that have run for years with no token. Breadth gives small credit per extra chain. Unknown age counts as ' + m.unknown_age_days + ' days; the Data column shows how complete each row\u2019s record is.' }),
      el('table', { class: 'mult-table' }, el('thead', null, el('tr', null, el('th', { text: 'Top categories on this board' }), el('th', { text: 'Multiple' }))), tbody)
    );
  }

  function sandboxPanel() {
    var out1 = el('output', { text: sandbox.growthWeight.toFixed(2) });
    var out2 = el('output', { text: '\u00d7 ' + sandbox.scale.toFixed(2) });
    var list = el('ol', { class: 'sandbox-list' });
    function refresh() {
      out1.textContent = sandbox.growthWeight.toFixed(2);
      out2.textContent = '\u00d7 ' + sandbox.scale.toFixed(2);
      var scored = DATA.rows.map(function (r) { return { r: r, v: impliedOf(r, DATA.model, sandbox.growthWeight, sandbox.scale) }; })
        .sort(function (a, b) { return b.v - a.v || (a.r.slug < b.r.slug ? -1 : 1); }).slice(0, 10);
      list.textContent = '';
      scored.forEach(function (s) {
        list.appendChild(el('li', null, s.r.name + ' ', el('span', { class: 'num', text: fmtUsd(s.v) })));
      });
    }
    var g = el('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(sandbox.growthWeight), 'aria-label': 'Growth weight' });
    g.addEventListener('input', function () { sandbox.growthWeight = parseFloat(g.value); refresh(); });
    var s = el('input', { type: 'range', min: '0.5', max: '1.5', step: '0.05', value: String(sandbox.scale), 'aria-label': 'Category multiple scale' });
    s.addEventListener('input', function () { sandbox.scale = parseFloat(s.value); refresh(); });
    var panel = el('section', { class: 'panel pad' },
      el('h2', { text: 'Model sandbox — stress the ranking' }),
      el('p', { class: 'note', text: 'Drag the two levers and watch the top 10 re-rank live. If a protocol only leads under one extreme setting, its rank is a modelling choice, not a fact — the board\u2019s official order always uses the stated constants.' }),
      el('div', { class: 'slider-row' }, el('label', { for: 'sb-growth', text: 'Growth weight' }), g, out1),
      el('div', { class: 'slider-row' }, el('label', { for: 'sb-scale', text: 'Category multiples' }), s, out2),
      list
    );
    g.id = 'sb-growth'; s.id = 'sb-scale';
    refresh();
    return panel;
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); render(); });

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var recomputed = impliedOf(row, DATA.model);
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'sub', text: 'Rank ' + row.rank + ' of ' + DATA.board_size + ' \u00b7 ' + row.tier + ' tier' }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Why this rank — the model, line by line' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL (snapshot)' }), el('b', { text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Category multiple (' + (row.category || 'none') + ')' }), el('b', { text: '\u00d7 ' + row.category_multiple.toFixed(2) })),
        el('div', null, el('span', { text: '7d TVL change' }), el('b', { text: fmtPct(row.change_7d) })),
        el('div', null, el('span', { text: 'Growth multiplier' }), el('b', { text: '\u00d7 ' + row.growth_multiplier })),
        el('div', null, el('span', { text: 'Age with no token' }), el('b', { text: fmtAge(row.age_days) })),
        el('div', null, el('span', { text: 'Maturity multiplier' }), el('b', { text: '\u00d7 ' + row.maturity_multiplier })),
        el('div', null, el('span', { text: 'Chains / breadth multiplier' }), el('b', { text: (row.chains ? row.chains.length : 0) + ' / \u00d7 ' + row.breadth_multiplier })),
        el('div', null, el('span', { text: 'Implied value' }), el('b', { text: fmtUsd(row.implied_value_usd) }))
      ),
      el('p', { class: 'note', text: 'This page recomputes the row as ' + fmtUsd(recomputed) + (recomputed === row.implied_value_usd ? ' — the same number board.json carries.' : ' — which differs from the board, so the data would be stale.') + ' Data completeness for this row: ' + row.confidence + '. An implied value is an estimate under the stated model, never a price or a promise of a launch.' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan — what to do, what it costs, how long it takes' }),
      el('ol', { class: 'steps' }, row.farm_steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      }))
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Signal' }),
      el('p', { class: 'note', text: row.signal }),
      el('div', { class: 'verdict', text: 'Radar verdict: farm it only with capital you can leave in place for the full hold period, from a dedicated wallet, and re-check the protocol\u2019s own pages before every step — a points program can change its rules at any time.' })
    ));
    if (!dialog.isConnected) app.appendChild(dialog);
    if (typeof dialog.showModal === 'function') { if (!dialog.open) dialog.showModal(); }
    else dialog.setAttribute('open', '');
  }

  function render() {
    var selected = state.selected;
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    shell.appendChild(controls());
    shell.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    if (state.tab === 'pre-token') {
      var grid = el('div', { class: 'grid2' });
      grid.appendChild(modelPanel());
      grid.appendChild(sandboxPanel());
      shell.appendChild(grid);
    }
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (selected) { state.selected = selected; openDetail(selected); }
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
