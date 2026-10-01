/* Portale SGI · cruscotto documentale */
(function () {
  const { icon, esc, norm, toast, copy, shell } = window.SGI;
  const FAMIGLIE = [['all', 'Tutti'], ['POL', 'Politiche'], ['MAN', 'Manuali'], ['REG', 'Regolamenti e Registri'], ['PLN', 'Piani'],
    ['PRO', 'Procedure'], ['IDL', 'Istruzioni'], ['MOD', 'Moduli'], ['INF', 'Informative'], ['DEX', 'Doc. esterni'], ['RPT', 'Report']];
  const TOP_CODES = ['TD-SGI-POL001', 'TD-SGI-MAN001', 'TD-SGI-MAN002', 'TD-SGI-MAN003', 'TD-SGI-MAN004', 'TD-SGI-MAN005', 'TD-SGI-REG006',
    'TD-SGI-REG013', 'TD-SGI-REG016', 'TD-SGI-REG020', 'TD-SGI-PLN001', 'TD-SGI-PLN015', 'TD-SGI-MOD229', 'TD-SGI-PRO001', 'TD-SGI-PRO042',
    'TD-SGI-PRO070', 'TD-SGI-PRO085', 'TD-SGI-PRO111', 'TD-SGI-PRO086', 'TD-SGI-PRO107', 'TD-SGI-IDL036', 'TD-SGI-INF001', 'TD-SGI-INF055', 'TD-SGI-MOD252'];
  const $ = id => document.getElementById(id);
  let DOCS = [], META = {}, FULLTEXT = null, loadingText = false, activeFilter = 'all', activeArea = 'all', current = [];

  const hl = (t, q) => { if (!q) return esc(t); const s = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); return esc(t).replace(new RegExp('(' + s + ')', 'gi'), '<span class="mark">$1</span>'); };

  async function loadFullText() {
    if (FULLTEXT || loadingText) return; loadingText = true;
    try { FULLTEXT = await (await fetch('/data/fulltext.json')).json(); } catch (e) { FULLTEXT = {}; }
    loadingText = false; render($('searchInput').value);
  }

  function search(query) {
    const q = norm(query.trim()); const terms = q.split(/\s+/).filter(Boolean);
    if (!terms.length && activeFilter === 'all' && activeArea === 'all') return [];
    return DOCS.filter(d => {
      if (activeFilter !== 'all' && d.famiglia !== activeFilter) return false;
      if (activeArea !== 'all' && d.area !== activeArea) return false;
      if (!terms.length) return true;
      const hay = norm(d.code + ' ' + d.title + ' ' + d.sintesi + ' ' + d.area + ' ' + d.famiglia_nome);
      const body = FULLTEXT ? norm(FULLTEXT[d.code] || '') : '';
      return terms.every(t => hay.includes(t) || body.includes(t));
    }).sort((a, b) => {
      const qa = norm(a.code + ' ' + a.title).includes(q) ? 0 : 1, qb = norm(b.code + ' ' + b.title).includes(q) ? 0 : 1;
      return qa - qb || a.code.localeCompare(b.code);
    });
  }

  function row(d, i, q) {
    const pdf = d.pdf ? '/docs/' + d.pdf : null, st = d.stampabile ? '/stampabili/' + d.stampabile : null;
    const alleg = (d.allegati || []).map(a => `<a class="btn sm ghost" href="/docs/${encodeURI(a)}" target="_blank" title="${esc(a.split('/').pop())}">Allegato</a>`).join('');
    return `<tr class="click" data-idx="${i}">
      <td><span class="doc-code">${hl(d.code, q)}</span><div class="small muted">${esc(d.famiglia_nome)}${d.pagine ? ' · ' + d.pagine + ' pag.' : ''}</div></td>
      <td><div class="doc-title">${hl(d.title, q)}</div>${d.sintesi && d.sintesi !== d.title ? '<div class="doc-sintesi">' + hl(d.sintesi.length > 200 ? d.sintesi.slice(0, 200) + '…' : d.sintesi, q) + '</div>' : ''}</td>
      <td><span class="badge b-blue">${esc(d.area.replace(/^\d+\.\s*/, ''))}</span></td>
      <td class="small muted" style="white-space:nowrap">rev ${esc(d.rev)}<br>${esc(d.data)}</td>
      <td><div class="doc-actions">
        ${pdf ? `<a class="btn sm" href="${encodeURI(pdf)}" target="_blank" data-stop>PDF</a>` : '<span class="badge b-red">PDF assente</span>'}
        ${st ? `<a class="btn sm ghost" href="${encodeURI(st)}" target="_blank" title="Versione stampabile senza cover" data-stop>Stampabile</a>` : ''}${alleg}
        <button class="iconbtn" title="Copia il link stabile" data-copy="/doc/${esc(d.code.split('_')[0])}" data-stop>${icon('link', 16)}</button>
      </div></td></tr>`;
  }

  function render(query) {
    const res = search(query); current = res;
    const show = query.trim().length > 0 || activeFilter !== 'all' || activeArea !== 'all';
    $('resultsSection').style.display = show ? '' : 'none';
    $('homeGrid').style.display = show ? 'none' : '';
    $('linksCard').style.display = show ? 'none' : '';
    if (!show) { $('searchStats').textContent = ''; return; }
    if (query.trim() && !FULLTEXT) loadFullText();
    $('resultsCount').textContent = res.length;
    const f = []; if (activeFilter !== 'all') f.push('famiglia ' + activeFilter); if (activeArea !== 'all') f.push(activeArea);
    $('searchStats').textContent = res.length + (res.length === 1 ? ' documento' : ' documenti') + (f.length ? ' · ' + f.join(' · ') : '') + (query.trim() && !FULLTEXT ? ' · carico l\'indice full-text…' : '');
    if (!res.length) { $('resultsList').innerHTML = '<tr><td colspan="5" class="empty">Nessun documento corrisponde alla ricerca.</td></tr>'; $('resultsMore').innerHTML = ''; return; }
    const slice = res.slice(0, 150);
    $('resultsList').innerHTML = slice.map((d, i) => row(d, i, query.trim())).join('');
    $('resultsMore').innerHTML = res.length > 150 ? `<div class="empty small">Mostrati i primi 150 risultati su ${res.length}. Affina la ricerca.</div>` : '';
    $('resultsList').querySelectorAll('tr.click').forEach(tr => tr.addEventListener('click', e => {
      if (e.target.closest('[data-stop]')) return;
      const d = current[+tr.dataset.idx]; if (d && d.pdf) window.open(encodeURI('/docs/' + d.pdf), '_blank'); else toast('PDF non disponibile per questo documento.', true);
    }));
    $('resultsList').querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); copy(location.origin + b.dataset.copy); }));
  }

  function setArea(a) { activeArea = a; $('areaSelect').value = a; render($('searchInput').value); window.scrollTo({ top: 0, behavior: 'smooth' }); }

  function init() {
    const counts = {}; DOCS.forEach(d => counts[d.area] = (counts[d.area] || 0) + 1);
    const aree = META.aree.map(a => ({ name: a, count: counts[a] || 0 }));
    shell('docs', META, aree, setArea);
    const sel = $('areaSelect');
    sel.innerHTML = `<option value="all">Tutte le aree (${META.aree.length})</option>` + META.aree.map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join('');
    sel.addEventListener('change', e => { activeArea = e.target.value; render($('searchInput').value); });
    $('famSeg').innerHTML = FAMIGLIE.map(([k, l]) => `<button class="${k === 'all' ? 'on' : ''}" data-f="${k}">${l}</button>`).join('');
    $('famSeg').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { $('famSeg').querySelectorAll('button').forEach(x => x.classList.remove('on')); b.classList.add('on'); activeFilter = b.dataset.f; render($('searchInput').value); }));
    $('areaGrid').innerHTML = aree.map(a => `<div class="tile area" data-area="${esc(a.name)}"><span class="name">${esc(a.name)}</span><span class="count">${a.count}</span></div>`).join('');
    $('areaGrid').querySelectorAll('.tile').forEach(t => t.addEventListener('click', () => setArea(t.dataset.area)));
    const fam = {}; DOCS.forEach(d => fam[d.famiglia] = (fam[d.famiglia] || 0) + 1);
    const pct = v => Math.round(v / META.n_docs * 100);
    $('kpis').innerHTML = `
      <div class="card kpi accent"><div class="lbl">Documenti attivi</div><div class="val">${META.n_docs}</div><div class="foot">REG006 rev. ${esc(META.reg006_rev)} del ${esc(META.reg006_data)}</div></div>
      <div class="card kpi"><div class="lbl">Procedure e istruzioni</div><div class="val">${(fam.PRO || 0) + (fam.IDL || 0)}</div><div class="foot">${fam.PRO || 0} PRO · ${fam.IDL || 0} IDL</div><div class="bar"><i style="width:${pct((fam.PRO || 0) + (fam.IDL || 0))}%"></i></div></div>
      <div class="card kpi"><div class="lbl">Moduli, informative, doc. esterni</div><div class="val">${(fam.MOD || 0) + (fam.INF || 0) + (fam.DEX || 0)}</div><div class="foot">${META.n_stampabili} in versione stampabile</div><div class="bar"><i style="width:${pct((fam.MOD || 0) + (fam.INF || 0) + (fam.DEX || 0))}%"></i></div></div>
      <div class="card kpi"><div class="lbl">Governo del sistema</div><div class="val">${(fam.POL || 0) + (fam.MAN || 0) + (fam.PLN || 0) + (fam.REG || 0) + (fam.RPT || 0)}</div><div class="foot">${fam.POL || 0} POL · ${fam.MAN || 0} MAN · ${fam.PLN || 0} PLN · ${fam.REG || 0} REG · ${fam.RPT || 0} RPT</div><div class="bar"><i style="width:${pct((fam.POL || 0) + (fam.MAN || 0) + (fam.PLN || 0) + (fam.REG || 0) + (fam.RPT || 0))}%"></i></div></div>`;
    const top = TOP_CODES.map(c => DOCS.find(d => d.code.startsWith(c + '_'))).filter(Boolean);
    $('topGrid').innerHTML = top.map(d => `<a class="tile" href="${d.pdf ? encodeURI('/docs/' + d.pdf) : '#'}" target="_blank"><div class="code">${esc(d.code)}</div><div class="name">${esc(d.title)}</div></a>`).join('');
    $('footer').innerHTML = `Toscana Diagnostica S.r.l. · Portale SGI · Indice REG006 rev. ${esc(META.reg006_rev)} del ${esc(META.reg006_data)} · ${META.n_docs} documenti attivi · pubblicazione del ${esc(META.build)}`;

    const inp = $('searchInput'), clr = $('searchClear');
    clr.innerHTML = icon('x', 16);
    $('sb').insertAdjacentHTML('afterbegin', icon('search'));
    const upd = () => clr.classList.toggle('on', inp.value.length > 0);
    inp.addEventListener('input', e => { upd(); render(e.target.value); });
    inp.addEventListener('focus', loadFullText);
    clr.addEventListener('click', () => { inp.value = ''; upd(); render(''); inp.focus(); });
    inp.addEventListener('keydown', e => { if (e.key === 'Escape') { inp.value = ''; upd(); render(''); } });
    const qs = new URLSearchParams(location.search).get('q'); if (qs) { inp.value = qs; upd(); render(qs); }
  }

  Promise.all([fetch('/data/docs.json').then(r => r.json()), fetch('/data/meta.json').then(r => r.json())])
    .then(([d, m]) => { DOCS = d; META = m; init(); })
    .catch(() => { document.querySelector('.page').insertAdjacentHTML('afterbegin', '<div class="alert warn">Errore nel caricamento dei dati del portale.</div>'); });
})();
