/* Portale SGI · cruscotto documentale */
(function () {
  const { icon, esc, norm, toast, copy, shell, mailtoDoc } = window.SGI;
  const FAMIGLIE = [['all', 'Tutti'], ['POL', 'Politiche'], ['MAN', 'Manuali'], ['REG', 'Regolamenti e Registri'], ['PLN', 'Piani'],
    ['PRO', 'Procedure'], ['IDL', 'Istruzioni'], ['MOD', 'Moduli'], ['INF', 'Informative'], ['DEX', 'Doc. esterni'], ['RPT', 'Report']];
  const KPI_GROUPS = {
    tutti: { label: 'Tutti i documenti', fam: null },
    operativi: { label: 'Procedure e istruzioni', fam: ['PRO', 'IDL'] },
    moduli: { label: 'Moduli, informative e documenti esterni', fam: ['MOD', 'INF', 'DEX'] },
    governo: { label: 'Documenti di governo del sistema', fam: ['POL', 'MAN', 'PLN', 'REG', 'RPT'] },
  };
  const TOP_CODES = ['TD-SGI-POL001', 'TD-SGI-MAN001', 'TD-SGI-MAN002', 'TD-SGI-MAN003', 'TD-SGI-MAN004', 'TD-SGI-MAN005', 'TD-SGI-REG006',
    'TD-SGI-REG013', 'TD-SGI-REG016', 'TD-SGI-REG020', 'TD-SGI-PLN001', 'TD-SGI-PLN015', 'TD-SGI-MOD229', 'TD-SGI-PRO001', 'TD-SGI-PRO042',
    'TD-SGI-PRO070', 'TD-SGI-PRO085', 'TD-SGI-PRO111', 'TD-SGI-PRO086', 'TD-SGI-PRO107', 'TD-SGI-IDL036', 'TD-SGI-INF001', 'TD-SGI-INF055', 'TD-SGI-MOD252'];
  const $ = id => document.getElementById(id);
  let DOCS = [], META = {}, FULLTEXT = null, loadingText = false, current = [], ui = null;
  // stato dei filtri
  let activeFams = null;      // null = tutte; altrimenti array di famiglie
  let activeArea = 'all';
  let kpiMode = null;         // chiave di KPI_GROUPS quando si clicca una tile
  let special = null;         // 'recenti' | 'stampabili' | null
  let listTitle = 'Risultati';

  const hl = (t, q) => { if (!q) return esc(t); const s = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); return esc(t).replace(new RegExp('(' + s + ')', 'gi'), '<span class="mark">$1</span>'); };
  const dateKey = d => { const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(d.data || ''); return m ? m[3] + m[2] + m[1] : '00000000'; };

  async function loadFullText() {
    if (FULLTEXT || loadingText) return; loadingText = true;
    try { FULLTEXT = await (await fetch('/data/fulltext.json')).json(); } catch (e) { FULLTEXT = {}; }
    loadingText = false; render($('searchInput').value);
  }

  function search(query) {
    const q = norm(query.trim()); const terms = q.split(/\s+/).filter(Boolean);
    const anyFilter = terms.length || activeFams || activeArea !== 'all' || kpiMode || special;
    if (!anyFilter) return [];
    let res = DOCS.filter(d => {
      if (activeFams && !activeFams.includes(d.famiglia)) return false;
      if (activeArea !== 'all' && d.area !== activeArea) return false;
      if (special === 'stampabili' && !d.stampabile) return false;
      if (!terms.length) return true;
      const hay = norm(d.code + ' ' + d.title + ' ' + d.sintesi + ' ' + d.area + ' ' + d.famiglia_nome);
      const body = FULLTEXT ? norm(FULLTEXT[d.code] || '') : '';
      return terms.every(t => hay.includes(t) || body.includes(t));
    });
    if (special === 'recenti') res = res.sort((a, b) => dateKey(b).localeCompare(dateKey(a)) || a.code.localeCompare(b.code)).slice(0, 40);
    else res = res.sort((a, b) => {
      const qa = q && norm(a.code + ' ' + a.title).includes(q) ? 0 : 1, qb = q && norm(b.code + ' ' + b.title).includes(q) ? 0 : 1;
      return qa - qb || a.code.localeCompare(b.code);
    });
    return res;
  }

  function row(d, i, q) {
    const pdf = d.pdf ? '/docs/' + d.pdf : null, st = d.stampabile ? '/stampabili/' + d.stampabile : null;
    const alleg = (d.allegati || []).map(a => `<a class="btn sm ghost" href="/docs/${encodeURI(a)}" target="_blank" title="${esc(a.split('/').pop())}" data-stop>Allegato</a>`).join('');
    return `<tr class="click" data-idx="${i}">
      <td><span class="doc-code">${hl(d.code, q)}</span><div class="small muted">${esc(d.famiglia_nome)}${d.pagine ? ' · ' + d.pagine + ' pag.' : ''}</div></td>
      <td><div class="doc-title">${hl(d.title, q)}</div>${d.sintesi && d.sintesi !== d.title ? '<div class="doc-sintesi">' + hl(d.sintesi.length > 200 ? d.sintesi.slice(0, 200) + '…' : d.sintesi, q) + '</div>' : ''}</td>
      <td><span class="badge b-blue">${esc(d.area.replace(/^\d+\.\s*/, ''))}</span></td>
      <td class="small muted" style="white-space:nowrap">rev ${esc(d.rev)}<br>${esc(d.data)}</td>
      <td><div class="doc-actions">
        ${pdf ? `<a class="btn sm" href="${encodeURI(pdf)}" target="_blank" data-stop>PDF</a>` : '<span class="badge b-red">PDF assente</span>'}
        ${st ? `<a class="btn sm ghost" href="${encodeURI(st)}" target="_blank" title="Versione stampabile senza cover" data-stop>Stampabile</a>` : ''}${alleg}
        <a class="iconbtn" title="Invia per e-mail (apre il tuo client di posta con i link al documento)" href="${mailtoDoc(d)}" data-stop>${icon('mail', 16)}</a>
        <button class="iconbtn" title="Copia il link stabile" data-copy="/doc/${esc(d.code.split('_')[0])}" data-stop>${icon('link', 16)}</button>
      </div></td></tr>`;
  }

  function render(query) {
    const res = search(query); current = res;
    const q = query.trim();
    const show = q.length > 0 || activeFams || activeArea !== 'all' || kpiMode || special;
    $('resultsSection').style.display = show ? '' : 'none';
    $('homeGrid').style.display = show ? 'none' : '';
    $('linksCard').style.display = show ? 'none' : '';
    document.querySelectorAll('.kpi.clickable').forEach(k => k.classList.toggle('on', k.dataset.kpi === kpiMode));
    if (ui) ui.setShortcut(special === 'recenti' ? 'Ultime emissioni' : special === 'stampabili' ? 'Versioni stampabili' : null);
    if (!show) { $('searchStats').textContent = ''; return; }
    if (q && !FULLTEXT) loadFullText();
    const parts = [];
    if (kpiMode) parts.push(KPI_GROUPS[kpiMode].label);
    else if (activeFams) parts.push((FAMIGLIE.find(f => f[0] === activeFams[0]) || [])[1]);
    if (special === 'recenti') parts.push('ultime emissioni');
    if (special === 'stampabili') parts.push('versioni stampabili');
    if (activeArea !== 'all') parts.push(activeArea);
    if (q) parts.push('"' + q + '"');
    $('resultsTitle').textContent = parts.length ? parts.join(' · ') : 'Risultati';
    $('resultsCount').textContent = res.length;
    $('searchStats').textContent = res.length + (res.length === 1 ? ' documento' : ' documenti') + (q && !FULLTEXT ? ' · carico l\'indice full-text…' : '');
    if (!res.length) { $('resultsList').innerHTML = '<tr><td colspan="5" class="empty">Nessun documento corrisponde ai criteri.</td></tr>'; $('resultsMore').innerHTML = ''; return; }
    const slice = res.slice(0, 150);
    $('resultsList').innerHTML = slice.map((d, i) => row(d, i, q)).join('');
    $('resultsMore').innerHTML = res.length > 150 ? `<div class="empty small">Mostrati i primi 150 risultati su ${res.length}. Affina la ricerca o scegli un'area.</div>` : '';
    $('resultsList').querySelectorAll('tr.click').forEach(tr => tr.addEventListener('click', e => {
      if (e.target.closest('[data-stop]')) return;
      const d = current[+tr.dataset.idx]; if (d && d.pdf) window.open(encodeURI('/docs/' + d.pdf), '_blank'); else toast('PDF non disponibile per questo documento.', true);
    }));
    $('resultsList').querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); copy(location.origin + b.dataset.copy); }));
  }

  function setSeg(fam) { $('famSeg').querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.f === fam)); }
  function setArea(a) { activeArea = a; $('areaSelect').value = a; if (ui) ui.setArea(a); render($('searchInput').value); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function setKpi(k) {
    if (kpiMode === k) { kpiMode = null; activeFams = null; setSeg('all'); }
    else { kpiMode = k; activeFams = KPI_GROUPS[k].fam; setSeg(activeFams ? '' : 'all'); }
    render($('searchInput').value);
  }
  function setSpecial(s) { special = special === s ? null : s; render($('searchInput').value); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function reset() { activeFams = null; activeArea = 'all'; kpiMode = null; special = null; $('searchInput').value = ''; $('areaSelect').value = 'all'; if (ui) ui.setArea('all'); setSeg('all'); updClear(); render(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function updClear() { $('searchClear').classList.toggle('on', $('searchInput').value.length > 0); }

  function init() {
    const counts = {}; DOCS.forEach(d => counts[d.area] = (counts[d.area] || 0) + 1);
    const aree = META.aree.map(a => ({ name: a, count: counts[a] || 0 }));
    const fam = {}; DOCS.forEach(d => fam[d.famiglia] = (fam[d.famiglia] || 0) + 1);
    const find = c => DOCS.find(d => d.code.startsWith(c + '_'));
    const reg006 = find('TD-SGI-REG006'), man005 = find('TD-SGI-MAN005'), pol = find('TD-SGI-POL001');
    ui = shell({
      page: 'docs', meta: META, aree, onArea: setArea,
      shortcuts: [
        { icon: 'clock', label: 'Ultime emissioni', action: () => setSpecial('recenti') },
        { icon: 'star', label: 'Documenti cardine', action: reset },
        { icon: 'print', label: 'Versioni stampabili', count: META.n_stampabili, action: () => setSpecial('stampabili') },
        reg006 && reg006.pdf ? { icon: 'list', label: 'Indice REG006', href: encodeURI('/docs/' + reg006.pdf), blank: true } : null,
        man005 && man005.pdf ? { icon: 'map', label: 'Mappa concettuale', href: encodeURI('/docs/' + man005.pdf), blank: true } : null,
        pol && pol.pdf ? { icon: 'shield', label: 'Politica integrata', href: encodeURI('/docs/' + pol.pdf), blank: true } : null,
      ].filter(Boolean),
    });
    const sel = $('areaSelect');
    sel.innerHTML = `<option value="all">Tutte le aree (${META.aree.length})</option>` + META.aree.map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join('');
    sel.addEventListener('change', e => setArea(e.target.value));
    $('famSeg').innerHTML = FAMIGLIE.map(([k, l]) => `<button class="${k === 'all' ? 'on' : ''}" data-f="${k}">${l}</button>`).join('');
    $('famSeg').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { kpiMode = null; activeFams = b.dataset.f === 'all' ? null : [b.dataset.f]; setSeg(b.dataset.f); render($('searchInput').value); }));
    $('areaGrid').innerHTML = aree.map(a => `<div class="tile area" data-area="${esc(a.name)}"><span class="name">${esc(a.name)}</span><span class="count">${a.count}</span></div>`).join('');
    $('areaGrid').querySelectorAll('.tile').forEach(t => t.addEventListener('click', () => setArea(t.dataset.area)));
    const pct = v => Math.round(v / META.n_docs * 100);
    const g = k => KPI_GROUPS[k].fam.reduce((s, f) => s + (fam[f] || 0), 0);
    $('kpis').innerHTML = `
      <div class="card kpi accent clickable" data-kpi="tutti" role="button" tabindex="0"><div class="lbl">Documenti attivi</div><div class="val">${META.n_docs}</div><div class="foot">REG006 rev. ${esc(META.reg006_rev)} del ${esc(META.reg006_data)}</div><div class="act">Mostra tutti</div></div>
      <div class="card kpi clickable" data-kpi="operativi" role="button" tabindex="0"><div class="lbl">Procedure e istruzioni</div><div class="val">${g('operativi')}</div><div class="foot">${fam.PRO || 0} PRO · ${fam.IDL || 0} IDL</div><div class="bar"><i style="width:${pct(g('operativi'))}%"></i></div><div class="act">Filtra</div></div>
      <div class="card kpi clickable" data-kpi="moduli" role="button" tabindex="0"><div class="lbl">Moduli, informative, doc. esterni</div><div class="val">${g('moduli')}</div><div class="foot">${META.n_stampabili} in versione stampabile</div><div class="bar"><i style="width:${pct(g('moduli'))}%"></i></div><div class="act">Filtra</div></div>
      <div class="card kpi clickable" data-kpi="governo" role="button" tabindex="0"><div class="lbl">Governo del sistema</div><div class="val">${g('governo')}</div><div class="foot">${fam.POL || 0} POL · ${fam.MAN || 0} MAN · ${fam.PLN || 0} PLN · ${fam.REG || 0} REG · ${fam.RPT || 0} RPT</div><div class="bar"><i style="width:${pct(g('governo'))}%"></i></div><div class="act">Filtra</div></div>`;
    $('kpis').querySelectorAll('.kpi').forEach(k => { k.addEventListener('click', () => setKpi(k.dataset.kpi)); k.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setKpi(k.dataset.kpi); } }); });
    const top = TOP_CODES.map(find).filter(Boolean);
    $('topGrid').innerHTML = top.map(d => `<a class="tile" href="${d.pdf ? encodeURI('/docs/' + d.pdf) : '#'}" target="_blank"><div class="code">${esc(d.code)}</div><div class="name">${esc(d.title)}</div></a>`).join('');
    $('footer').innerHTML = `Toscana Diagnostica S.r.l. · Portale SGI · Indice REG006 rev. ${esc(META.reg006_rev)} del ${esc(META.reg006_data)} · ${META.n_docs} documenti attivi · pubblicazione del ${esc(META.build)}`;

    const inp = $('searchInput'), clr = $('searchClear');
    clr.innerHTML = icon('x', 14);
    $('sb').insertAdjacentHTML('afterbegin', icon('search'));
    inp.addEventListener('input', e => { updClear(); render(e.target.value); });
    inp.addEventListener('focus', loadFullText);
    clr.addEventListener('click', () => { inp.value = ''; updClear(); render(''); inp.focus(); });
    inp.addEventListener('keydown', e => { if (e.key === 'Escape') { inp.value = ''; updClear(); render(''); } });
    $('resetBtn').addEventListener('click', reset);
    const qs = new URLSearchParams(location.search).get('q'); if (qs) { inp.value = qs; updClear(); render(qs); }
  }

  Promise.all([fetch('/data/docs.json').then(r => r.json()), fetch('/data/meta.json').then(r => r.json())])
    .then(([d, m]) => { DOCS = d; META = m; init(); })
    .catch(() => { document.querySelector('.page').insertAdjacentHTML('afterbegin', '<div class="alert warn">Errore nel caricamento dei dati del portale.</div>'); });
})();
