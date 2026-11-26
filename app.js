/* EquiQuant — reads window.DATA (data.js = Top 15, data_top3.js = Top 3; written by build.py) */
let D, BN, N500, cur, hist, last, M;     // the strategy on screen; set by use()
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const charts = {};

const pct = (x, d = 1) => x == null || isNaN(x) ? '—' : (x * 100).toFixed(d) + '%';
const sp = (x, d = 1) => x == null || isNaN(x) ? '—' : (x > 0 ? '+' : '') + (x * 100).toFixed(d) + '%';
const cls = x => x > 0 ? 'pos' : x < 0 ? 'neg' : '';
const num = (x, d = 2) => x == null || isNaN(x) ? '—' : Number(x).toFixed(d);
const inr = x => '₹' + Math.round(x).toLocaleString('en-IN');
const mlabel = m => { const [y, mo] = m.split('-'); return MON[+mo - 1] + ' ' + y; };
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const $ = id => document.getElementById(id);
const tag = s => s === 'New' ? '<span class="tag new">NEW</span>' : s === 'Kept (buffer)' ? '<span class="tag buf">KEPT · BUFFER</span>'
  : s === 'Sold' ? '<span class="tag out">SOLD</span>' : '<span class="tag kept">KEPT</span>';
const colors = () => ({ s: css('--cyan'), n50: css('--gold'), n500: css('--violet'), bse: css('--slate'),
  pos: css('--emerald'), neg: css('--rose'), grid: css('--border'), text: css('--slate') });
const bcol = (c, n) => ({ 'Nifty 50': c.n50, 'Nifty 500': c.n500, 'BSE 500': c.bse })[n];

/* ---------- derived series ---------- */
const cum = r => r.reduce((a, x) => (a.push(a[a.length - 1] * (1 + x)), a), [1]);
const ddOf = r => { let pk = 1, w = 1; return r.map(x => (w *= 1 + x, pk = Math.max(pk, w), w / pk - 1)); };
function use(key) {  // switch strategy in place: both data sets are already loaded, nothing is fetched
  D = window.DS[key]; BN = Object.keys(D.bench); N500 = D.bench['Nifty 500'];
  cur = D.current; hist = D.history; last = hist[hist.length - 1]; M = D.metrics.Strategy;
}

/* ---------- header + KPIs ---------- */
function header() {
  const r = D.rules, t3 = D.key === 'top3';
  document.title = `EquiQuant · Top ${r.n}`;
  $('h-strat').textContent = `Top ${r.n} · Momentum · 52W High · ${t3 ? 'ROCE / ROE' : 'ROCE'} · Buffer ${r.buffer} · Equal weight`;
  document.querySelectorAll('#strat a').forEach(a => a.classList.toggle('on', a.dataset.s === (D.key || 'top15')));
  document.querySelectorAll('.n-stocks').forEach(e => e.textContent = r.n);
  $('chg-note').textContent = `New: entered the top ${r.n} and bought. Kept: still in the top ${r.n}. Kept (buffer): ranked ${r.n + 1}–${r.buffer}, so held instead of sold. Sold: dropped below rank ${r.buffer}.`
    + (t3 ? ` A new buy that rose more than ${pct(D.spike, 0)} in the last 5 trading days is skipped; the next stock is taken.` : '');
  $('variants-card').hidden = t3;  // the comparison table is for the Top 15 rule set
  $('h-period').textContent = `Backtest ${D.period} · ${D.months.length} months · cost ${pct(D.rules.cost)} of turnover`;
  $('h-built').textContent = `Prices to ${cur.asof} · built ${D.built}`;
  const ex = cur.mtd - cur.bench_mtd['Nifty 500'];
  const p = $('h-mtd');
  const v = x => `<b class="${cls(x)}">${sp(x, 2)}</b>`;  // each number coloured by its own sign
  p.innerHTML = `<span class="pl">${mlabel(last.month)} MTD</span> Strategy ${v(cur.mtd)}
    <span class="sep">·</span> Nifty 500 ${v(cur.bench_mtd['Nifty 500'])}
    <span class="sep">·</span> Excess ${v(ex)}`;
  p.className = 'pill';
  const b = D.metrics['Nifty 500'];
  const grow = cum(D.strategy).at(-1) * (1 + cur.mtd_net), growB = cum(N500).at(-1) * (1 + cur.bench_mtd['Nifty 500']);
  const k = [
    ['CAGR', pct(M.cagr), `Nifty 500 ${pct(b.cagr)}`, '--emerald'],
    ['Max Drawdown', pct(M.maxdd), `Nifty 500 ${pct(b.maxdd)}`, '--rose'],
    ['Ex-Ante Sharpe', num(M.exante_now), `Nifty 500 ${num(b.exante_now)} · realised ${num(M.sharpe)}`, '--cyan'],
    ['Sortino', num(M.sortino), `Nifty 500 ${num(b.sortino)}`, '--cyan'],
    ['Calmar', num(M.calmar), `Nifty 500 ${num(b.calmar)}`, '--violet'],
    ['₹1 Lakh Became', inr(1e5 * grow), `Nifty 500 ${inr(1e5 * growB)}`, '--gold'],
    ['Win Rate', pct(M.win, 0), `beat N500 in ${pct(M.beat_months, 0)} of months`, '--emerald'],
    ['Churn / Month', num(D.churn.avg_changes, 1) + ' stocks', `cost ${pct(D.churn.cost_per_year)} a year`, '--gold'],
  ];
  $('kpis').innerHTML = k.map(([l, v, c, a]) => `<div class="kpi" style="--accent:var(${a})"><div class="lbl">${l}</div>
    <div class="val">${v}</div><div class="cmp">${c}</div></div>`).join('');
}

/* ---------- chart helpers ---------- */
function mk(id, cfg) {
  if (charts[id]) charts[id].destroy();
  const c = colors();
  Chart.defaults.color = c.text; Chart.defaults.borderColor = c.grid;
  Chart.defaults.font.family = "'Inter', system-ui, sans-serif"; Chart.defaults.font.size = 11;
  cfg.options = Object.assign({ animation: false, normalized: true, responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
    plugins: { legend: { labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true } } } }, cfg.options || {});
  charts[id] = new Chart($(id), cfg);
}
const pctAxis = (extra = {}) => Object.assign({ ticks: { callback: v => (v * 100).toFixed(0) + '%' }, grid: { color: colors().grid } }, extra);
const tipPct = d => ctx => `${ctx.dataset.label}: ${sp(ctx.parsed.y, d)}`;

/* ---------- overview ---------- */
let eqScale = 'logarithmic';
function equity() {
  const c = colors(), labels = ['Start', ...D.months.map(mlabel)];
  const ds = [{ label: 'Strategy', data: cum(D.strategy), borderColor: c.s, backgroundColor: c.s + '22', fill: true, borderWidth: 2.2 }]
    .concat(BN.map(n => ({ label: n + (n === 'BSE 500' ? ' (price)' : ' TRI'), data: cum(D.bench[n]), borderColor: bcol(c, n), borderWidth: 1.6 })));
  ds.forEach(d => Object.assign(d, { pointRadius: 0, tension: .15 }));
  mk('c-equity', { type: 'line', data: { labels, datasets: ds }, options: {
    scales: { x: { ticks: { maxTicksLimit: 12 }, grid: { display: false } },
      y: { type: eqScale, ticks: { callback: v => v.toFixed(v < 2 ? 1 : 0) + 'x' }, grid: { color: c.grid } } },
    plugins: { tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ₹${Math.round(ctx.parsed.y * 1e5).toLocaleString('en-IN')} per ₹1L` } } } } });
}
function sectors() {
  const s = {};
  cur.holdings.forEach(h => s[h.sector] = (s[h.sector] || 0) + 1 / cur.holdings.length);
  const e = Object.entries(s).sort((a, b) => b[1] - a[1]), c = colors();
  const pal = [c.s, c.n500, c.n50, c.pos, c.neg, '#38bdf8', '#a3e635', '#f472b6', '#fb923c', c.bse];
  mk('c-sector', { type: 'doughnut', data: { labels: e.map(x => x[0]), datasets: [{ data: e.map(x => x[1]),
    backgroundColor: e.map((_, i) => pal[i % pal.length]), borderColor: css('--bg-1'), borderWidth: 2 }] },
    options: { cutout: '62%', interaction: { mode: 'nearest' }, plugins: { legend: { position: 'bottom' },
      tooltip: { callbacks: { label: ctx => `${ctx.label}: ${pct(ctx.parsed, 1)} (${Math.round(ctx.parsed * cur.holdings.length)} stocks)` } } } } });
}
function yearly() {
  const c = colors(), ys = Object.keys(D.yearly.Strategy);
  const ds = [{ label: 'Strategy', data: ys.map(y => D.yearly.Strategy[y]), backgroundColor: c.s }]
    .concat(BN.map(n => ({ label: n, data: ys.map(y => D.yearly[n][y]), backgroundColor: bcol(c, n) })));
  ds.forEach(d => Object.assign(d, { borderRadius: 4, maxBarThickness: 18 }));
  mk('c-yearly', { type: 'bar', data: { labels: ys, datasets: ds }, options: { scales: { y: pctAxis(), x: { grid: { display: false } } },
    plugins: { tooltip: { callbacks: { label: tipPct(1) } } } } });
}
function beta() {
  const c = colors(), k = Object.keys(D.beta);
  mk('c-beta', { type: 'line', data: { labels: k.map(mlabel), datasets: [{ label: 'Beta', data: k.map(x => D.beta[x]), borderColor: c.n500,
    pointRadius: 0, borderWidth: 2, tension: .2 }, { label: 'Market (1.0)', data: k.map(() => 1), borderColor: c.bse, borderDash: [4, 4], pointRadius: 0, borderWidth: 1 }] },
    options: { scales: { x: { ticks: { maxTicksLimit: 8 }, grid: { display: false } }, y: { grid: { color: c.grid } } } } });
}

/* ---------- heatmap ---------- */
let hmMode = 'abs';
function heatmap() {
  const val = {}, rows = {};
  D.months.forEach((m, i) => val[m] = hmMode === 'abs' ? D.strategy[i] : D.strategy[i] - N500[i]);
  val[last.month] = hmMode === 'abs' ? cur.mtd_net : cur.mtd_net - cur.bench_mtd['Nifty 500'];
  Object.keys(val).forEach(m => (rows[m.slice(0, 4)] ||= {})[+m.slice(5)] = m);
  const c = colors(), sc = hmMode === 'abs' ? .12 : .08;
  const bg = v => { const a = Math.min(Math.abs(v) / sc, 1) * .75 + .08; return v >= 0 ? `rgba(16,185,129,${a})` : `rgba(244,63,94,${a})`; };
  let h = '<tr><th></th>' + MON.map(m => `<th>${m}</th>`).join('') + `<th>${hmMode === 'abs' ? 'Year' : 'Year (excess)'}</th></tr>`;
  Object.keys(rows).sort().forEach(y => {
    h += `<tr><td class="yr">${y}</td>`;
    for (let mo = 1; mo <= 12; mo++) {
      const m = rows[y][mo];
      h += m ? `<td data-m="${m}" style="background:${bg(val[m])};color:${Math.abs(val[m]) > sc * .5 ? '#fff' : c.text}"
        title="${mlabel(m)}${m === last.month ? ' (month to date)' : ''}">${sp(val[m], 1)}${m === last.month ? '*' : ''}</td>` : '<td style="cursor:default"></td>';
    }
    const yv = hmMode === 'abs' ? D.yearly.Strategy[y] : D.yearly.Strategy[y] - D.yearly['Nifty 500'][y];
    h += yv == null ? '<td class="tot dim">MTD</td>' : `<td class="tot ${cls(yv)}">${sp(yv, 1)}</td>`;
    h += '</tr>';
  });
  $('hm').innerHTML = h;
  $('hm').querySelectorAll('td[data-m]').forEach(td => td.onclick = () => monthModal(td.dataset.m));
}
function monthModal(m) {
  const e = hist.find(x => x.month === m), i = D.months.indexOf(m), live = m === last.month;
  const b = n => live ? cur.bench_mtd[n] : D.bench[n][i];
  $('m-title').textContent = `${mlabel(m)}${live ? ' — month to date' : ''}`;
  const hs = [...e.holdings].sort((a, z) => z.ret - a.ret);
  $('m-body').innerHTML = `<div class="mini">
      <div><small>Strategy (net)</small><b class="${cls(e.net)}">${sp(e.net, 2)}</b></div>
      ${BN.map(n => `<div><small>${n}</small><b class="${cls(b(n))}">${sp(b(n), 2)}</b></div>`).join('')}
      <div><small>Excess vs N500</small><b class="${cls(e.net - b('Nifty 500'))}">${sp(e.net - b('Nifty 500'), 2)}</b></div>
      <div><small>Turnover · cost</small><b>${pct(e.turnover, 0)} · ${pct(e.cost, 2)}</b></div></div>
    <p class="note" style="margin:0 0 .6rem">Picked at the end of ${mlabel(e.signal)}, held during ${mlabel(m)}.</p>
    <div class="tbl-wrap"><table><tr><th>#</th><th>Stock</th><th>Sector</th><th class="n">Rank</th><th>Status</th><th class="n">Weight</th><th class="n">Return</th><th class="n">Contribution</th></tr>
    ${hs.map((h, k) => `<tr><td class="dim">${k + 1}</td><td><b>${h.sym}</b><br><span class="dim">${h.name}</span></td><td>${h.sector}</td>
      <td class="n">${h.rank}</td><td>${tag(e.first ? 'New' : h.status)}</td><td class="n">${pct(1 / hs.length, 2)}</td>
      <td class="n ${cls(h.ret)}">${sp(h.ret, 2)}</td><td class="n ${cls(h.ret)}">${sp(h.ret / hs.length, 2)}</td></tr>`).join('')}</table></div>
    ${e.removed.length ? `<p class="note" style="margin-top:.8rem"><b>Sold at the start of the month:</b> ${e.removed.map(r => `${r.sym} (rank ${r.rank ?? 'left universe'})`).join(', ')}</p>` : ''}`;
  $('modal').hidden = false;
}

/* ---------- risk ---------- */
function drawdown() {
  const c = colors(), labels = D.months.map(mlabel);
  mk('c-dd', { type: 'line', data: { labels, datasets: [
    { label: 'Strategy', data: ddOf(D.strategy), borderColor: c.neg, backgroundColor: c.neg + '33', fill: true },
    { label: 'Nifty 500 TRI', data: ddOf(N500), borderColor: c.n500, borderDash: [4, 3] }].map(d => Object.assign(d, { pointRadius: 0, borderWidth: 1.8, tension: .1 })) },
    options: { scales: { y: pctAxis(), x: { ticks: { maxTicksLimit: 12 }, grid: { display: false } } }, plugins: { tooltip: { callbacks: { label: tipPct(1) } } } } });
  // episodes
  const w = cum(D.strategy).slice(1); let pk = 0, ep = [], cur0 = null;
  w.forEach((v, i) => {
    if (v >= w[pk]) { if (cur0) { cur0.rec = i; ep.push(cur0); cur0 = null; } pk = i; return; }
    const d = v / w[pk] - 1;
    if (!cur0) cur0 = { pk, tr: i, d }; else if (d < cur0.d) Object.assign(cur0, { tr: i, d });
  });
  if (cur0) ep.push(cur0);
  ep = ep.filter(e => e.d <= -.10).sort((a, b) => a.d - b.d);
  $('t-dd').innerHTML = '<tr><th>Peak</th><th>Bottom</th><th class="n">Fall</th><th class="n">Months down</th><th>Recovered</th></tr>' +
    ep.map(e => `<tr><td>${mlabel(D.months[e.pk])}</td><td>${mlabel(D.months[e.tr])}</td><td class="n neg">${pct(e.d)}</td>
      <td class="n">${e.tr - e.pk}</td><td>${e.rec != null ? mlabel(D.months[e.rec]) + ` (${e.rec - e.tr} m)` : '<span class="dim">not yet</span>'}</td></tr>`).join('');
}
function sharpe() {
  const c = colors(), k = Object.keys(D.exante).filter(m => D.realised[m] != null);
  mk('c-sharpe', { type: 'line', data: { labels: k.map(mlabel), datasets: [
    { label: 'Ex-ante (expected)', data: k.map(m => D.exante[m]), borderColor: c.n50 },
    { label: 'Nifty 500 ex-ante', data: k.map(m => D.exante_bench['Nifty 500'][m]), borderColor: c.n500, borderDash: [4, 3] },
    { label: 'Realised (rolling 12M)', data: k.map(m => D.realised[m]), borderColor: c.s }].map(d => Object.assign(d, { pointRadius: 0, borderWidth: 1.8, tension: .2 })) },
    options: { scales: { x: { ticks: { maxTicksLimit: 8 }, grid: { display: false } }, y: { grid: { color: c.grid } } } } });
}
function histogram() {
  const c = colors(), lo = -0.2, st = 0.02, n = 23, cnt = Array(n).fill(0), cb = Array(n).fill(0);
  const bin = x => Math.max(0, Math.min(n - 1, Math.floor((x - lo) / st)));
  D.strategy.forEach(x => cnt[bin(x)]++); N500.forEach(x => cb[bin(x)]++);
  const labels = cnt.map((_, i) => `${((lo + i * st) * 100).toFixed(0)}%`);
  mk('c-hist', { type: 'bar', data: { labels, datasets: [
    { label: 'Strategy', data: cnt, backgroundColor: cnt.map((_, i) => lo + i * st < 0 ? c.neg : c.s), borderRadius: 3 },
    { label: 'Nifty 500 TRI', data: cb, backgroundColor: c.n500 + '66', borderRadius: 3 }] },
    options: { scales: { x: { grid: { display: false } }, y: { grid: { color: c.grid } } } } });
}
function attribution() {
  const s = {};
  hist.slice(0, -1).forEach(e => e.holdings.forEach(h => s[h.sym] = (s[h.sym] || 0) + h.ret / e.holdings.length));
  const top = Object.entries(s).sort((a, b) => b[1] - a[1]).slice(0, 10), c = colors();
  mk('c-attr', { type: 'bar', data: { labels: top.map(x => x[0]), datasets: [{ label: 'Sum of monthly contributions', data: top.map(x => x[1]),
    backgroundColor: c.pos, borderRadius: 4 }] }, options: { indexAxis: 'y', plugins: { legend: { display: false },
      tooltip: { callbacks: { label: ctx => sp(ctx.parsed.x, 1) + ' of portfolio, summed over months held' } } },
    scales: { x: pctAxis(), y: { grid: { display: false } } } } });
}

/* ---------- metrics tables ---------- */
function metricsTables() {
  $('m-span').textContent = `${D.period} · monthly returns · risk-free ${pct(D.rules.rf)}`;
  const cols = ['Strategy', ...BN], ms = D.metrics;
  const rows = [['CAGR', 'cagr', pct], ['Total return', 'total', x => pct(x, 0)], ['Volatility (yearly)', 'vol', pct],
    [`Ex-ante Sharpe — now (${mlabel(last.month)} picks)`, 'exante_now', num], ['Ex-ante Sharpe — average at each pick', 'exante_avg', num],
    ['Realised Sharpe', 'sharpe', num],
    ['Sortino', 'sortino', num], ['Max drawdown', 'maxdd', pct], ['Calmar (CAGR ÷ max DD)', 'calmar', num], ['Max DD bottom', 'dd_trough', x => x ? mlabel(x) : '—'],
    ['Months to recover', 'dd_recovery_months', x => x ?? 'not yet'], ['Positive months', 'win', x => pct(x, 0)], ['Avg up month', 'avg_gain', x => sp(x, 2)],
    ['Avg down month', 'avg_loss', x => sp(x, 2)], ['Best month', 'best', x => sp(x, 1)], ['Worst month', 'worst', x => sp(x, 1)],
    ['Beta vs Nifty 500', 'beta', num], ['Correlation vs Nifty 500', 'corr', num], ['CAGR minus Nifty 500', 'alpha', x => sp(x, 1)],
    ['Months beating Nifty 500', 'beat_months', x => pct(x, 0)]];
  $('t-metrics').innerHTML = `<tr><th>Metric</th>${cols.map(c => `<th class="n">${c}${c === 'BSE 500' ? ' (price)' : c === 'Strategy' ? '' : ' TRI'}</th>`).join('')}</tr>` +
    rows.map(([l, k, f]) => `<tr><td>${l}</td>${cols.map((c, i) => `<td class="n${i ? '' : ' pos'}" ${i ? '' : 'style="font-weight:700"'}>${f(ms[c][k])}</td>`).join('')}</tr>`).join('');
  const ys = Object.keys(D.yearly.Strategy);
  $('t-yearly').innerHTML = `<tr><th>Year</th>${cols.map(c => `<th class="n">${c}</th>`).join('')}<th class="n">Strategy − N500</th></tr>` +
    ys.map(y => { const ex = D.yearly.Strategy[y] - D.yearly['Nifty 500'][y];
      return `<tr><td>${y}${y === ys[0] || y === ys.at(-1) ? ' <span class="dim">(part)</span>' : ''}</td>${cols.map(c => `<td class="n ${cls(D.yearly[c][y])}">${sp(D.yearly[c][y])}</td>`).join('')}
      <td class="n ${cls(ex)}">${sp(ex)}</td></tr>`; }).join('');
  const v = D.variants;
  $('t-variants').innerHTML = '<tr><th>Rebalance</th><th>Sell when out of</th><th>Weights</th><th class="n">CAGR</th><th class="n">Max DD</th><th class="n">Sharpe</th><th class="n">Calmar</th><th class="n">Worst month</th><th class="n">Years beat N500</th><th class="n">Stocks changed</th><th class="n">Cost / yr</th></tr>' +
    v.map(r => `<tr class="${r.rebalance === 'monthly' && r.sell_when_out_of === 'top 20' && r.weights === 'Equal' ? 'hl' : ''}">
      <td>${r.rebalance}</td><td>${r.sell_when_out_of}</td><td>${r.weights}</td><td class="n">${pct(r.CAGR)}</td><td class="n neg">${pct(r.maxDD)}</td>
      <td class="n">${num(r.sharpe)}</td><td class="n">${num(r.calmar)}</td><td class="n neg">${pct(r.worst_month)}</td><td class="n">${r.beat_N500_years} / 11</td>
      <td class="n">${num(r.stocks_changed_avg, 1)}</td><td class="n">${pct(r.cost_per_year)}</td></tr>`).join('');
}

/* ---------- churn ---------- */
function churn() {
  const c = colors(), h = hist.slice(1), labels = h.map(e => mlabel(e.month));
  const add = h.map(e => e.holdings.filter(x => x.status === 'New').length), buf = h.map(e => e.holdings.filter(x => x.status === 'Kept (buffer)').length);
  mk('c-churn', { type: 'bar', data: { labels, datasets: [
    { label: 'Bought (new)', data: add, backgroundColor: c.s, borderRadius: 2 },
    { label: 'Kept only by buffer (rank 16–20)', data: buf, backgroundColor: c.n50, borderRadius: 2 }] },
    options: { scales: { x: { stacked: true, ticks: { maxTicksLimit: 12 }, grid: { display: false } }, y: { stacked: true, grid: { color: c.grid } } } } });
  mk('c-turn', { type: 'line', data: { labels, datasets: [{ label: 'Turnover', data: h.map(e => e.turnover), borderColor: c.n500, pointRadius: 0, borderWidth: 1.5, tension: .2 }] },
    options: { plugins: { tooltip: { callbacks: { label: ctx => `Turnover ${pct(ctx.parsed.y, 0)} · cost ${pct(ctx.parsed.y * D.rules.cost, 2)}` } } },
      scales: { x: { ticks: { maxTicksLimit: 6 }, grid: { display: false } }, y: pctAxis({ ticks: { callback: v => (v * 100).toFixed(0) + '%' } }) } } });
  const ch = D.churn;
  $('t-churn').innerHTML = `<tr><th>Month held</th><th class="n">Bought</th><th>New stocks</th><th>Sold (rank)</th><th>Kept by buffer (rank)</th><th class="n">Turnover</th><th class="n">Cost</th><th class="n">Net return</th></tr>` +
    [...hist].reverse().map(e => { const nw = e.first ? e.holdings : e.holdings.filter(x => x.status === 'New'), kb = e.holdings.filter(x => x.status === 'Kept (buffer)');
      return `<tr><td>${mlabel(e.month)}${e.month === last.month ? ' <span class="dim">MTD</span>' : ''}</td><td class="n">${nw.length}</td>
      <td class="wrap">${nw.map(x => x.sym).join(', ') || '<span class="dim">—</span>'}</td>
      <td class="wrap neg">${e.removed.map(r => `${r.sym} (${r.rank ?? 'out'})`).join(', ') || '<span class="dim">—</span>'}</td>
      <td class="wrap" style="color:var(--gold)">${kb.map(x => `${x.sym} (${x.rank})`).join(', ') || '<span class="dim">—</span>'}</td>
      <td class="n">${pct(e.turnover, 0)}</td><td class="n">${pct(e.cost, 2)}</td><td class="n ${cls(e.net)}">${sp(e.net, 2)}</td></tr>`; }).join('') +
    `<tr class="hl"><td>Average</td><td class="n">${num(ch.avg_changes, 1)}</td><td colspan="3">min ${ch.min_changes} · max ${ch.max_changes} stocks bought a month · ${num(ch.avg_buffer_saves, 1)} kept by the buffer a month</td>
      <td class="n">${pct(ch.avg_turnover, 0)}</td><td class="n">${pct(ch.cost_per_year)} / yr</td><td></td></tr>`;
}

/* ---------- live + changes ---------- */
function invested() { return Math.max(0, +$('inv').value || 0); }
function live() {
  const amt = invested(), w = 1 / cur.holdings.length;
  let spent = 0;
  const hs = [...cur.holdings].sort((a, b) => a.rank - b.rank);
  $('t-live').innerHTML = '<tr><th>#</th><th>Stock</th><th>Sector</th><th class="n">Rank</th><th>Status</th><th class="n">Weight</th><th class="n">Price</th><th class="n">MTD</th><th class="n">Qty</th><th class="n">Amount</th></tr>' +
    hs.map((h, i) => { const p = cur.price[h.sym], q = Math.floor(amt * w / p); spent += q * p;
      return `<tr><td class="dim">${i + 1}</td><td><b>${h.sym}</b><br><span class="dim">${h.name}</span></td><td>${h.sector}</td><td class="n">${h.rank}</td>
        <td>${tag(h.status)}</td><td class="n">${pct(w, 2)}</td><td class="n">${p.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
        <td class="n ${cls(h.ret)}">${sp(h.ret, 2)}</td><td class="n">${q.toLocaleString('en-IN')}</td><td class="n">${inr(q * p)}</td></tr>`; }).join('');
  $('live-tot').innerHTML = `<span>Total invested<b>${inr(spent)}</b></span><span>Cash left<b>${inr(amt - spent)}</b></span>
    <span>Portfolio MTD<b class="${cls(cur.mtd)}">${sp(cur.mtd, 2)}</b></span><span>After this month's cost<b class="${cls(cur.mtd_net)}">${sp(cur.mtd_net, 2)}</b></span>`;
  $('live-note').textContent = `Picked at the ${mlabel(cur.signal)} month-end, held from the ${cur.held_from} close. Prices: close of ${cur.asof} (dividend-adjusted for MTD). Qty rounds down to whole shares at that price.`;
  $('live-asof').textContent = `${cur.held_from} → ${cur.asof}`;
  const c = colors(), lb = ['Strategy (gross)', 'Strategy (net)', ...BN], vals = [cur.mtd, cur.mtd_net, ...BN.map(n => cur.bench_mtd[n])];
  mk('c-mtd', { type: 'bar', data: { labels: lb, datasets: [{ label: 'Month to date', data: vals, backgroundColor: [c.s, c.s + 'aa', c.n50, c.n500, c.bse], borderRadius: 5 }] },
    options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: tipPct(2) } } }, scales: { y: pctAxis(), x: { grid: { display: false } } } } });
}
function changes() {
  const amt = invested(), w = 1 / cur.holdings.length, prev = new Set(cur.prev.map(p => p.sym));
  const rows = [...cur.holdings].sort((a, b) => ({ New: 0, 'Kept (buffer)': 2, Kept: 1 })[a.status] - ({ New: 0, 'Kept (buffer)': 2, Kept: 1 })[b.status] || a.rank - b.rank);
  const sold = last.removed;
  $('chg-sub').textContent = `${mlabel(hist.at(-2).month)} portfolio → ${mlabel(last.month)} portfolio · ${rows.filter(r => r.status === 'New').length} bought, ${sold.length} sold`;
  const icon = s => s === 'New' ? '🔥' : s === 'Sold' ? '▼' : '↔';
  $('t-changes').innerHTML = '<tr><th>Δ</th><th>Stock</th><th>Sector</th><th>Change</th><th class="n">Rank now</th><th class="n">Weight</th><th class="n">Prev</th><th class="n">Price</th><th class="n">Qty</th><th class="n">Amount</th></tr>' +
    rows.map(h => { const p = cur.price[h.sym], q = Math.floor(amt * w / p);
      return `<tr><td>${icon(h.status)}</td><td><b>${h.sym}</b></td><td>${h.sector}</td><td>${tag(h.status)}</td><td class="n">${h.rank}</td>
        <td class="n">${pct(w, 2)}</td><td class="n dim">${prev.has(h.sym) ? pct(w, 2) : '0.00%'}</td><td class="n">${p.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
        <td class="n">${q.toLocaleString('en-IN')}</td><td class="n">${inr(q * p)}</td></tr>`; }).join('') +
    sold.map(r => `<tr><td class="neg">▼</td><td><b>${r.sym}</b></td><td>${r.sector}</td><td>${tag('Sold')}</td><td class="n">${r.rank ?? 'out'}</td>
      <td class="n">0.00%</td><td class="n dim">${pct(w, 2)}</td><td class="n dim">—</td><td class="n dim">—</td><td class="n dim">—</td></tr>`).join('');
}

/* ---------- methodology ---------- */
function method() {
  const r = D.rules;
  $('method').innerHTML = `<div class="card-h"><h3>How the Strategy Works</h3></div>
    <h4>1 · Universe (each month-end)</h4><p>All NSE stocks with median daily traded value of at least ₹1 crore and market cap of at least ₹1,000 crore. Stocks with unreliable price data are excluded.</p>
    <h4>2 · Score</h4><ol><li><b>12-1 momentum</b>: return over the last 12 months, leaving out the latest month.</li>
      <li><b>Nearness to the 52-week high</b>: price ÷ highest price of the last year.</li>
      <li><b>ROCE</b>: from the latest annual results already published on that date ${D.key === 'top3'
        ? '(screener.in ROCE; <b>ROE for banks and NBFCs</b>; stocks with neither are removed from the list).'
        : '(missing ROCE counts as average).'}</li></ol>
      <p>Each factor is turned into a percentile rank (0–1) within that month's universe and the three are added. The highest total ranks first.</p>
    <h4>3 · Buy and sell rules</h4><ul><li>Hold <b>${r.n} stocks</b>, equal weight (${pct(1 / r.n, 2)} each).</li>
      <li>A held stock is <b>sold only when it drops below rank ${r.buffer}</b>. Ranks ${r.n + 1}–${r.buffer} are kept (the buffer).</li>
      <li>Empty places are filled with the <b>best-ranked new stocks from the top ${r.n}</b>.</li>
      ${D.key === 'top3' ? `<li><b>Spike filter:</b> a new buy that rose more than ${pct(D.spike, 0)} in the last 5 trading days is skipped and the next stock is taken (held stocks are not affected).</li>
      <li>A stock in both months is <b>carried forward</b>, not sold and bought again; only the trim or top-up back to equal weight is traded.</li>` : ''}
      <li>Reviewed every month-end; trades at that close.</li></ul>
    <h4>4 · Cost</h4><p><b>${pct(r.cost)}</b> on every rupee bought or sold (turnover = sum of weight changes, counting buys and sells). It covers brokerage, taxes and impact. The first month counts as buying everything once.</p>
    <h4>5 · Benchmarks</h4><p>Nifty 50 and Nifty 500 total return indices (dividends included), BSE 500 price index.</p>`;
  $('caveats').innerHTML = `<div class="card-h"><h3>Read Before Using</h3></div>
    <ul><li><b>Backtest, not real trading.</b> The results show what the rules would have done, after cost.</li>
      <li><b>Survivorship bias.</b> The price data covers companies listed today; delisted failures are missing. This probably adds about 2–2.5% a year to the results.</li>
      <li><b>Settings chosen with hindsight.</b> Top ${D.rules.n}, the top-20 buffer and the factors were picked after testing on this same history. Expect live results to be lower.</li>
      <li><b>Ex-ante Sharpe is optimistic.</b> At the pick date the ${D.rules.n} stocks look much better than they turn out (see Risk &amp; Reward).</li>
      ${D.key === 'top3' ? `<li><b>Timing luck.</b> The same rule traded a few days after month-end gave 23%–55% CAGR; 4 tranches (days 0, 5, 10, 15) about 43%. Realistic: 40–45% a year.</li>
      <li><b>Daily falls are deeper.</b> Month-end max fall is −28.7%, but on daily prices it was −37.5% (Dec 2024 → Apr 2025). Only 3 stocks: one bad stock moves the whole book.</li>` : ''}
      <li><b>Sectors</b> are today's classification for each stock.</li>
      <li><b>Data:</b> stock prices from the stored daily files and Yahoo Finance; indices from niftyindices.com. October 2026 uses the 30 Oct close.</li></ul>
    <h4>Rules tested and rejected</h4><ul><li>RSI(14) &gt; 55 instead of the 52-week high: lower return, deeper falls.</li>
      <li>Momentum + ROCE only (no 52-week high): falls of −34% to −51%.</li>
      <li>Quarterly changes: lower cost, but lower return with equal weights.</li></ul>
    <p class="note">Not investment advice.</p>`;
}

/* ---------- wiring ---------- */
// charts are drawn only when their tab is first shown (and again after a theme change), so the page stays light
const TABS = { overview: [equity, sectors, yearly, beta], heatmap: [heatmap], risk: [drawdown, sharpe, histogram, attribution],
  churn: [churn], live: [live] };
const drawn = new Set();
const activeTab = () => document.querySelector('.tab.active').dataset.p;
function drawTab(n) { if (drawn.has(n)) return; drawn.add(n); (TABS[n] || []).forEach(f => f()); }
function drawAll() { drawn.clear(); drawTab(activeTab()); }
function setTheme(t) {
  document.documentElement.dataset.theme = t; $('theme').textContent = t === 'light' ? '☀️' : '🌙';
  try { localStorage.setItem('t15-theme', t); } catch (e) { /* storage blocked */ }
  drawAll();
}
function openTab(name) {
  const b = document.querySelector(`.tab[data-p="${name}"]`); if (!b) return;
  document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x === b));
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === 'p-' + name));
  drawTab(name);
}
$('tabs').onclick = e => { const b = e.target.closest('.tab'); if (b) { openTab(b.dataset.p); history.replaceState(null, '', '#' + b.dataset.p); } };
window.addEventListener('hashchange', () => openTab(location.hash.slice(1)));
$('eq-scale').onclick = e => { const b = e.target.closest('button'); if (!b) return;
  [...$('eq-scale').children].forEach(x => x.classList.toggle('on', x === b)); eqScale = b.dataset.v; equity(); };
$('hm-mode').onclick = e => { const b = e.target.closest('button'); if (!b) return;
  [...$('hm-mode').children].forEach(x => x.classList.toggle('on', x === b)); hmMode = b.dataset.v; heatmap(); };
$('m-close').onclick = () => $('modal').hidden = true;
$('modal').onclick = e => { if (e.target.id === 'modal') $('modal').hidden = true; };
document.addEventListener('keydown', e => { if (e.key === 'Escape') $('modal').hidden = true; });
$('theme').onclick = () => setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
$('inv').oninput = () => { live(); changes(); };

function render() { header(); metricsTables(); changes(); method(); drawAll(); }
$('strat').onclick = e => { const a = e.target.closest('a'); if (!a) return; e.preventDefault();
  if (a.dataset.s === D.key) return;
  use(a.dataset.s); $('modal').hidden = true; render();
  history.replaceState(null, '', '?s=' + a.dataset.s + location.hash); };
use(new URLSearchParams(location.search).get('s') === 'top15' ? 'top15' : 'top3');
header(); metricsTables(); changes(); method();
let saved = 'dark';
try { saved = localStorage.getItem('t15-theme') || 'dark'; } catch (e) { /* storage blocked */ }
setTheme(saved);
if (location.hash) openTab(location.hash.slice(1));
