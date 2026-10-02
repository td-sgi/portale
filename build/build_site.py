#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Portale SGI Toscana Diagnostica - generatore dei dati del sito.

Legge l'indice REG006 (foglio "Indice Documenti"), trova il PDF di ogni documento attivo
nelle cartelle di area, copia i PDF nel repo, estrae il testo per la ricerca full-text,
copia le versioni stampabili (MOD/DEX/INF) e costruisce la mappa Preparazioni dal file
Excel delle prestazioni. Scrive:

  data/docs.json          elenco documenti attivi (code, title, area, rev, data, famiglia, sintesi, pdf)
  data/fulltext.json      testo integrale (minuscolo) per codice, caricato dal browser solo alla prima ricerca
  data/preparazioni.json  prestazioni -> modulo di preparazione (codice SGI, file stampabile, link)
  data/meta.json          revisione REG006, data, conteggi, data di build
  docs/<Area>/<file>.pdf  PDF di distribuzione
  stampabili/<file>.pdf   versioni stampabili senza cover (MOD, DEX, INF)

Uso (PC di Francesco, da PowerShell, dentro la cartella del repo):
  python build\\build_site.py ^
     --iso "C:\\Users\\francesco.epifani\\OneDrive - Toscana Diagnostica S.r.l\\HQS\\ISO 9001" ^
     --stampabili "C:\\Users\\francesco.epifani\\OneDrive - Toscana Diagnostica S.r.l\\HQS\\Documenti Stampabili senza Cover (MOD-DEX-INF)" ^
     --prestazioni "build\\Prestazioni_Preparazioni.xlsx"

Poi: git add -A ; git commit -m "SGI: REG006 rev. NN" ; git push  -> Render ripubblica da solo.

Dipendenze: pip install openpyxl pymupdf
"""
import argparse, json, os, re, shutil, sys, unicodedata, datetime, glob

try:
    import openpyxl
except ImportError:
    sys.exit("Manca openpyxl: pip install openpyxl")
try:
    import pymupdf
except ImportError:
    pymupdf = None

CODE_RE = re.compile(r'^(TD-SGI-([A-Z]{3})(\d{3})_(\d{2}|0[a-z]))')
FAMIGLIE = {'POL': 'Politiche', 'MAN': 'Manuali', 'REG': 'Regolamenti e Registri', 'PLN': 'Piani',
            'PRO': 'Procedure', 'IDL': 'Istruzioni di Lavoro', 'MOD': 'Moduli', 'INF': 'Informative',
            'DEX': 'Documenti Esterni', 'RPT': 'Report'}
EXCLUDE_DIRS = {'_to_delete_revisioni_superate', 'TD Documenti SGI', 'Autorizzazioni Sanitarie', 'Claude outputs'}


def slug(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
    s = re.sub(r'[^A-Za-z0-9]+', '-', s).strip('-')
    return s


def title_from_filename(fname, code):
    base = os.path.splitext(os.path.basename(fname))[0]
    t = base[len(code):] if base.startswith(code) else base
    t = t.lstrip(' -_').replace('_', ' ')
    return re.sub(r'\s+', ' ', t).strip()


def read_reg006(path):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb['Indice Documenti']
    rows = list(ws.iter_rows(values_only=True))
    head = str(rows[0][0] or '')
    m = re.search(r'REG006_(\d+)', head)
    rev = m.group(1) if m else '?'
    m2 = re.search(r'Revisione \d+ del (.+)', str(rows[1][0] or ''))
    data = m2.group(1).strip() if m2 else ''
    docs = []
    for r in rows[4:]:
        if not r or not r[0] or not str(r[0]).startswith('TD-SGI-'):
            continue
        code = str(r[0]).strip()
        stato = str(r[4] or '').strip()
        if stato and stato.lower() != 'attivo':
            continue
        cm = CODE_RE.match(code)
        docs.append({'code': code, 'rev': str(r[1] or '').strip(), 'data': str(r[2] or '').strip(),
                     'area': str(r[3] or '').strip(), 'sintesi': str(r[5] or '').strip(),
                     'famiglia': cm.group(2) if cm else code[7:10]})
    return rev, data, docs


def find_pdfs(roots):
    """Indice codice -> lista di PDF trovati, in ordine di priorita' delle radici."""
    idx = {}
    for root in roots:
        for dirpath, dirnames, files in os.walk(root):
            dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS and not d.startswith('_')]
            for f in files:
                if not f.lower().endswith('.pdf'):
                    continue
                m = CODE_RE.match(f)
                if not m:
                    continue
                lst = idx.setdefault(m.group(1), [])
                if f not in [os.path.basename(p) for p in lst]:   # stesso nome in piu' radici: vince la prima
                    lst.append(os.path.join(dirpath, f))
    return idx


def extract_text(pdf):
    if pymupdf is None:
        return ''
    try:
        d = pymupdf.open(pdf)
        t = ' '.join(p.get_text() for p in d)
        return re.sub(r'\s+', ' ', t).lower().strip()
    except Exception:
        return ''


def norm_code(s):
    """Normalizza un riferimento di preparazione: 'INF020', 'TD-SGI-INF020_00', 'inf 020' -> 'TD-SGI-INF020'."""
    if s is None:
        return None
    s = str(s).strip().replace(' ', '')
    m = re.search(r'(TD-SGI-)?([A-Za-z]{3})-?(\d{3})(_\d{2}|_0[a-z])?', s)
    if not m:
        return None
    base = 'TD-SGI-' + m.group(2).upper() + m.group(3)
    suf = m.group(4) or ''
    # le schede INF001_0a..0s hanno il suffisso come parte del codice, non come revisione
    return base + suf if re.match(r'_0[a-z]$', suf) else base


def read_prestazioni(path, printables_by_code):
    """Legge il file Excel delle prestazioni. Cerca la colonna 'Preparazioni' e la colonna del codice
    prestazione (prima colonna il cui nome contiene 'cod'). Restituisce la lista delle righe con link."""
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb[wb.sheetnames[0]]
    rows = list(ws.iter_rows(values_only=True))
    hdr_i = None
    for i, r in enumerate(rows[:20]):
        if r and any(c and 'preparaz' in str(c).lower() for c in r):
            hdr_i = i; break
    if hdr_i is None:
        sys.exit("Nel file prestazioni non trovo una colonna 'Preparazioni'")
    hdr = [str(c or '').strip() for c in rows[hdr_i]]
    col_prep = next(i for i, h in enumerate(hdr) if 'preparaz' in h.lower())
    col_code = next((i for i, h in enumerate(hdr) if 'cod' in h.lower()), 0)
    col_desc = next((i for i, h in enumerate(hdr) if any(k in h.lower() for k in ('descr', 'prestaz', 'esame', 'nome'))
                     and i not in (col_prep, col_code)), None)
    # Chiave dei link pubblici: il codice shortcut (es. ECO003), mai il codice GIPO numerico (AD, 02/10/2026).
    col_short = next((i for i, h in enumerate(hdr) if 'shortcut' in h.lower()), None)
    if col_short is None:
        sys.exit("Nel file prestazioni non trovo la colonna 'Codice shortcut': e' la chiave dei link /p/")
    out = []
    for r in rows[hdr_i + 1:]:
        if not r or r[col_code] is None:
            continue
        prep_raw = r[col_prep]
        refs = []
        if prep_raw:
            for tok in re.split(r'[;|\n]+', str(prep_raw)):
                c = norm_code(tok)
                if c and c not in refs:
                    refs.append(c)
        extra = {hdr[i]: ('' if r[i] is None else str(r[i]).strip()) for i in range(len(hdr)) if hdr[i] and i not in (col_prep, col_code, col_desc)}
        short = str(r[col_short]).strip() if r[col_short] is not None else ''
        if not short:
            sys.exit(f"Prestazione {r[col_code]} senza codice shortcut: correggere l'Excel")
        out.append({'codice': str(r[col_code]).strip(), 'shortcut': short,
                    'descrizione': str(r[col_desc] or '').strip() if col_desc is not None else '',
                    'preparazione_raw': str(prep_raw or '').strip(), 'preparazioni': refs, 'extra': extra})
    shorts = [o['shortcut'].upper() for o in out]
    dup = sorted({x for x in shorts if shorts.count(x) > 1})
    if dup:
        sys.exit(f"Codici shortcut duplicati nell'Excel (devono essere univoci): {dup}")
    return hdr, col_prep, col_code, col_desc, out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--iso', required=True, help='Cartella ISO 9001 (radici multiple separate da ;)')
    ap.add_argument('--stampabili', required=True, help='Cartella Documenti Stampabili senza Cover')
    ap.add_argument('--reg006', help='File REG006 xlsx (default: cercato in <iso>/1. Gestione del Sistema)')
    ap.add_argument('--prestazioni', help='Excel prestazioni con colonna Preparazioni (opzionale)')
    ap.add_argument('--out', default=os.path.dirname(os.path.dirname(os.path.abspath(__file__))), help='Radice del repo')
    ap.add_argument('--no-text', action='store_true', help='Salta estrazione full-text')
    ap.add_argument('--exclude', default='', help='Codici da non pubblicare, separati da virgola (es. REG007,REG021)')
    a = ap.parse_args()

    roots = [r for r in a.iso.split(';') if r]
    reg = a.reg006
    if not reg:
        c = sorted(glob.glob(os.path.join(roots[0], '1. Gestione del Sistema', 'TD-SGI-REG006_*.xlsx')))
        if not c:
            sys.exit('REG006 non trovato')
        reg = c[-1]
    rev, data_rev, docs = read_reg006(reg)
    print(f'REG006 rev. {rev} del {data_rev}: {len(docs)} documenti attivi')

    excl = {('TD-SGI-' + e.strip().upper()) for e in a.exclude.split(',') if e.strip()}
    pdf_idx = find_pdfs(roots)
    out_docs = os.path.join(a.out, 'docs'); out_st = os.path.join(a.out, 'stampabili'); out_data = os.path.join(a.out, 'data')
    for p in (out_docs, out_st):
        shutil.rmtree(p, ignore_errors=True); os.makedirs(p)
    os.makedirs(out_data, exist_ok=True)

    printables = {}
    for f in os.listdir(a.stampabili):
        m = CODE_RE.match(f)
        if m and f.lower().endswith('.pdf'):
            printables[m.group(1)] = os.path.join(a.stampabili, f)

    result, fulltext, missing, excluded = [], {}, [], []
    for d in docs:
        code = d['code']
        base = code.rsplit('_', 1)[0]
        if base in excl:
            excluded.append(code); continue
        srcs = pdf_idx.get(code)
        rec = dict(d); rec['famiglia_nome'] = FAMIGLIE.get(d['famiglia'], d['famiglia'])
        if srcs:
            # preferisce il PDF il cui nome non contiene "Allegato" come principale; gli altri diventano allegati
            srcs = sorted(srcs, key=lambda p: ('allegato' in os.path.basename(p).lower(), p))
            main_pdf = srcs[0]
            area_dir = slug(d['area'])
            os.makedirs(os.path.join(out_docs, area_dir), exist_ok=True)
            files = []
            for s in srcs:
                fn = os.path.basename(s)
                dst = os.path.join(out_docs, area_dir, fn)
                shutil.copy2(s, dst)
                files.append(area_dir + '/' + fn)
            rec['pdf'] = files[0]; rec['allegati'] = files[1:]
            rec['title'] = title_from_filename(main_pdf, code)
            if not a.no_text:
                fulltext[code] = ' '.join(extract_text(s) for s in srcs)
            try:
                rec['pagine'] = pymupdf.open(main_pdf).page_count if pymupdf else None
            except Exception:
                rec['pagine'] = None
        else:
            rec['pdf'] = None; rec['allegati'] = []; rec['title'] = d['sintesi'][:90]
            missing.append(code)
        if code in printables:
            fn = os.path.basename(printables[code])
            shutil.copy2(printables[code], os.path.join(out_st, fn))
            rec['stampabile'] = fn
        else:
            rec['stampabile'] = None
        result.append(rec)

    # Preparazioni
    prep = {'righe': [], 'colonne': None, 'non_risolte': []}
    if a.prestazioni:
        hdr, cp, cc, cd, rows = read_prestazioni(a.prestazioni, printables)
        by_base = {}
        for r in result:
            by_base[r['code']] = r
            if not re.search(r'_0[a-z]$', r['code']):
                by_base[r['code'].rsplit('_', 1)[0]] = r
        for row in rows:
            links = []
            for ref in row['preparazioni']:
                r = by_base.get(ref)
                if r and (r['stampabile'] or r['pdf']):
                    links.append({'code': r['code'], 'title': r['title'],
                                  'file': ('stampabili/' + r['stampabile']) if r['stampabile'] else ('docs/' + r['pdf'])})
                else:
                    prep['non_risolte'].append({'codice': row['codice'], 'rif': ref})
            row['link'] = links
            row['url'] = '/p/' + slug(row['shortcut']) if links else None
            prep['righe'].append(row)
        prep['colonne'] = {'intestazione': hdr, 'preparazioni': cp, 'codice': cc, 'descrizione': cd}
        print(f"Prestazioni: {len(rows)} righe, {sum(1 for r in rows if r['link'])} con preparazione collegata, {len(prep['non_risolte'])} riferimenti non risolti")

    meta = {'reg006_rev': rev, 'reg006_data': data_rev, 'n_docs': len(result), 'n_pdf': sum(1 for r in result if r['pdf']),
            'n_stampabili': sum(1 for r in result if r['stampabile']), 'n_prestazioni': len(prep['righe']),
            'build': datetime.datetime.now().strftime('%d/%m/%Y %H:%M'), 'mancanti': missing, 'esclusi': excluded,
            'aree': sorted({r['area'] for r in result})}
    json.dump(result, open(os.path.join(out_data, 'docs.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    json.dump(fulltext, open(os.path.join(out_data, 'fulltext.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    json.dump(prep, open(os.path.join(out_data, 'preparazioni.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    json.dump(meta, open(os.path.join(out_data, 'meta.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f"Scritti {meta['n_pdf']} PDF, {meta['n_stampabili']} stampabili. Senza PDF: {missing}. Esclusi: {excluded}")


if __name__ == '__main__':
    main()
