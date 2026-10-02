/* Portale SGI · shell comune (sidebar, topbar, icone, toast) nello stile della Cash Management */
window.SGI = (function () {
  const P = {
    home: 'M3 11.5 12 4l9 7.5M5 10v10h5v-6h4v6h5V10',
    doc: 'M7 3h7l5 5v13H7zM14 3v5h5M9 13h6M9 17h6',
    list: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
    search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
    heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
    folder: 'M3 6h6l2 2h10v11H3z',
    shield: 'M12 3 4 6v6c0 5 3.5 8.3 8 9 4.5-.7 8-4 8-9V6l-8-3z',
    download: 'M12 4v11M7 10l5 5 5-5M4 20h16',
    link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
    print: 'M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z',
    chart: 'M4 20h16M7 16V9M12 16V5M17 16v-4',
    x: 'M6 6l12 12M18 6 6 18',
    info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 8h.01',
    mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
    clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
    star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
    book: 'M4 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zM20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z',
    map: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14',
    help: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01',
  };
  const icon = (n, s) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"${s ? ` style="width:${s}px;height:${s}px"` : ''} aria-hidden="true"><path d="${P[n] || ''}"/></svg>`;
  const esc = t => { const d = document.createElement('div'); d.textContent = t == null ? '' : String(t); return d.innerHTML; };
  const norm = s => (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  function toast(msg, err) { let t = document.getElementById('toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); } t.textContent = msg; t.className = 'toast show' + (err ? ' err' : ''); clearTimeout(t._to); t._to = setTimeout(() => t.classList.remove('show'), 3200); }
  function copy(url, label) { navigator.clipboard.writeText(url).then(() => toast((label || 'Link copiato') + ': ' + url)).catch(() => prompt('Copia il link', url)); }

  /* Indirizzo mailto per inviare un documento via e-mail con il client di posta dell'utente.
     Il PDF non puo' essere allegato da una pagina web: si inviano i link stabili (sempre alla revisione in vigore). */
  function mailtoDoc(d) {
    const base = location.origin;
    const stable = base + '/doc/' + d.code.split('_')[0];
    const lines = [
      'Buongiorno,', '',
      'in allegato il riferimento al documento del Sistema di Gestione Integrato di Toscana Diagnostica:', '',
      d.code + ' - ' + d.title + ' (rev. ' + d.rev + ' del ' + d.data + ')',
      'Area: ' + d.area, '',
      'Apri il PDF: ' + stable,
    ];
    if (d.stampabile) lines.push('Versione stampabile (senza frontespizio): ' + base + '/m/' + d.code.split('_')[0]);
    lines.push('', 'Il link apre sempre la revisione in vigore.', '', 'Cordiali saluti', 'Ufficio Qualità - Toscana Diagnostica', 'qualita@toscanadiagnostica.it');
    return 'mailto:?subject=' + encodeURIComponent('[SGI TD] ' + d.code + ' - ' + d.title) + '&body=' + encodeURIComponent(lines.join('\n'));
  }

  /* Sidebar e topbar. opts: { page:'docs'|'prep', meta, aree:[{name,count}], onArea(areaName|'all'), shortcuts:[{icon,label,action,active}] } */
  function shell(opts) {
    const { page, meta, aree, onArea, shortcuts } = opts;
    const side = document.getElementById('side');
    const areaSel = aree && aree.length ? `
      <div class="group">Aree del SGI</div>
      <select class="areasel" id="sideArea" aria-label="Filtra per area">
        <option value="all">Tutte le aree (${aree.length})</option>
        ${aree.map(a => `<option value="${esc(a.name)}">${esc(a.name)} (${a.count})</option>`).join('')}
      </select>` : '';
    const sc = shortcuts && shortcuts.length ? '<div class="group">Scorciatoie</div>' + shortcuts.map((s, i) => s.href
      ? `<a href="${esc(s.href)}" ${s.blank ? 'target="_blank"' : ''}>${icon(s.icon)}<span>${esc(s.label)}</span></a>`
      : `<button class="navlink${s.active ? ' active' : ''}" data-sc="${i}">${icon(s.icon)}<span>${esc(s.label)}</span>${s.count ? `<span class="count">${s.count}</span>` : ''}</button>`).join('') : '';
    side.innerHTML = `
      <div class="brand"><img src="/static/logo-light.svg" alt="Toscana Diagnostica"><div class="app">Portale SGI</div></div>
      <nav>
        <a href="/" class="${page === 'docs' ? 'active' : ''}">${icon('home')}Cruscotto documentale</a>
        <a href="/preparazioni" class="${page === 'prep' ? 'active' : ''}">${icon('heart')}Preparazioni agli esami</a>
        ${areaSel}
        ${sc}
        <div class="group">Supporto</div>
        <a href="mailto:qualita@toscanadiagnostica.it?subject=${encodeURIComponent('[Portale SGI] Richiesta')}">${icon('mail')}Scrivi alla Qualità</a>
      </nav>
      <div class="me">
        <div class="name">Sistema di Gestione Integrato</div>
        <div>Indice REG006 rev. ${esc(meta.reg006_rev)} del ${esc(meta.reg006_data)}</div>
        <div>${meta.n_docs} documenti attivi · pubblicato il ${esc(meta.build)}</div>
      </div>`;
    const top = document.getElementById('topbar');
    top.innerHTML = `<button aria-label="Menu" id="menuBtn">☰</button><img src="/static/logo-light.svg" alt="Toscana Diagnostica">`;
    document.getElementById('menuBtn').addEventListener('click', () => side.classList.toggle('open'));
    document.querySelector('.main').addEventListener('click', () => side.classList.remove('open'));
    const sel = document.getElementById('sideArea');
    if (sel && onArea) sel.addEventListener('change', e => { onArea(e.target.value); side.classList.remove('open'); });
    side.querySelectorAll('[data-sc]').forEach(b => b.addEventListener('click', () => { shortcuts[+b.dataset.sc].action(); side.classList.remove('open'); }));
    return { setArea: v => { if (sel) sel.value = v; }, setShortcut: label => side.querySelectorAll('[data-sc]').forEach(b => b.classList.toggle('active', b.textContent.trim().startsWith(label || '\u0000'))) };
  }
  return { icon, esc, norm, toast, copy, shell, mailtoDoc };
})();
