# -*- coding: utf-8 -*-
"""
Portale SGI Toscana Diagnostica - server web (Flask).

Rotte pubbliche (sempre aperte, pensate per i pazienti e per i link SMS di GIPO):
  /preparazioni                 elenco prestazioni con il modulo di preparazione
  /p/<codice-prestazione>       link stabile per prestazione: apre il PDF della preparazione
  /p/<codice-prestazione>.pdf   lo stesso PDF servito direttamente (inline)
  /stampabili/<file>.pdf        versioni stampabili senza cover dei MOD/DEX/INF
  /m/<TD-SGI-CODICE>            link stabile per modulo (senza revisione): apre la versione stampabile

Rotte dell'area documentale (protette da password se e' impostata la variabile d'ambiente SGI_PASSWORD):
  /                             cruscotto SGI con ricerca full-text
  /doc/<TD-SGI-CODICE>          link stabile per documento (senza revisione): apre il PDF corrente
  /docs/<area>/<file>.pdf       PDF di distribuzione
  /data/*.json                  dati del cruscotto

Senza SGI_PASSWORD tutto il portale e' pubblico (configurazione richiesta dall'AD il 01/10/2026).
"""
import os, json, re, functools, unicodedata
from flask import Flask, send_from_directory, abort, redirect, Response, request, jsonify, make_response

BASE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(BASE, 'data')
app = Flask(__name__, static_folder=os.path.join(BASE, 'static'), static_url_path='/static')

SGI_USER = os.environ.get('SGI_USER', 'sgi')
SGI_PASSWORD = os.environ.get('SGI_PASSWORD', '')


def _load(name):
    with open(os.path.join(DATA, name), encoding='utf-8') as f:
        return json.load(f)


DOCS = _load('docs.json')
META = _load('meta.json')
PREP = _load('preparazioni.json')
BY_BASE = {}
for d in DOCS:
    BY_BASE[d['code']] = d
    if not re.search(r'_0[a-z]$', d['code']):      # INF001_0a..0s: il suffisso e' parte del codice
        BY_BASE[d['code'].rsplit('_', 1)[0]] = d
PREP_BY_SLUG = {}


def slug(s):
    s = unicodedata.normalize('NFKD', str(s)).encode('ascii', 'ignore').decode()
    return re.sub(r'[^A-Za-z0-9]+', '-', s).strip('-')


for r in PREP.get('righe', []):
    if r.get('link'):
        PREP_BY_SLUG[slug(r['codice']).lower()] = r


def protected(fn):
    """HTTP Basic Auth sull'area documentale, attiva solo se SGI_PASSWORD e' impostata."""
    @functools.wraps(fn)
    def wrapper(*a, **kw):
        if SGI_PASSWORD:
            auth = request.authorization
            if not auth or auth.username != SGI_USER or auth.password != SGI_PASSWORD:
                return Response('Area riservata al personale di Toscana Diagnostica.', 401,
                                {'WWW-Authenticate': 'Basic realm="Portale SGI Toscana Diagnostica"'})
        return fn(*a, **kw)
    return wrapper


def _pdf_headers(resp, inline=True):
    resp.headers['Content-Type'] = 'application/pdf'
    resp.headers['X-Content-Type-Options'] = 'nosniff'
    resp.headers['Cache-Control'] = 'public, max-age=3600'
    if inline:
        resp.headers['Content-Disposition'] = 'inline'
    return resp


def _lookup(code):
    c = re.sub(r'\.pdf$', '', code, flags=re.I)
    return BY_BASE.get(c) or BY_BASE.get(c.upper()) or BY_BASE.get(c.upper()[:-1] + c[-1].lower())


# ---------- Area pubblica ----------
@app.route('/preparazioni')
def preparazioni():
    return send_from_directory(app.static_folder, 'preparazioni.html')


@app.route('/p/<codice>')
def prestazione(codice):
    """Link stabile per GIPO: /p/<codice prestazione>. Se la prestazione ha un solo modulo lo apre,
    se ne ha piu' di uno mostra la pagina con l'elenco."""
    want_pdf = codice.lower().endswith('.pdf')
    key = slug(codice[:-4] if want_pdf else codice).lower()
    row = PREP_BY_SLUG.get(key)
    if not row:
        return redirect('/preparazioni?codice=' + codice, 302)
    links = row['link']
    if len(links) == 1 or want_pdf:
        f = links[0]['file']
        if f.startswith('docs/'):   # il file vive nell'area documentale: lo serviamo senza password
            return _pdf_headers(make_response(send_from_directory(os.path.join(BASE, 'docs'), f[5:])))
        return redirect('/' + f, 302)
    return redirect('/preparazioni?codice=' + row['codice'], 302)


@app.route('/m/<code>')
def modulo(code):
    """Link stabile per modulo senza revisione: /m/TD-SGI-INF020 -> versione stampabile corrente."""
    d = _lookup(code)
    if not d:
        abort(404)
    if d.get('stampabile'):
        return redirect('/stampabili/' + d['stampabile'], 302)
    if d.get('pdf'):
        return redirect('/docs/' + d['pdf'], 302)
    abort(404)


@app.route('/stampabili/<path:fname>')
def stampabili(fname):
    resp = make_response(send_from_directory(os.path.join(BASE, 'stampabili'), fname))
    return _pdf_headers(resp)


@app.route('/api/preparazioni')
def api_prep():
    return jsonify(PREP)


@app.route('/api/informative')
def api_informative():
    """Informative (INF) con versione stampabile: elenco pubblico per la pagina Preparazioni."""
    return jsonify([{'code': d['code'], 'title': d['title'], 'stampabile': d['stampabile']} for d in DOCS
                    if d['famiglia'] == 'INF' and d.get('stampabile')])


@app.route('/api/meta')
def api_meta():
    return jsonify(META)


@app.route('/robots.txt')
def robots():
    return send_from_directory(app.static_folder, 'robots.txt')


@app.route('/healthz')
def healthz():
    return 'ok'


# ---------- Area documentale ----------
@app.route('/')
@protected
def index():
    return send_from_directory(app.static_folder, 'index.html')


@app.route('/doc/<code>')
@protected
def doc(code):
    d = _lookup(code)
    if not d or not d.get('pdf'):
        abort(404)
    return redirect('/docs/' + d['pdf'], 302)


@app.route('/docs/<path:fname>')
@protected
def docs(fname):
    resp = make_response(send_from_directory(os.path.join(BASE, 'docs'), fname))
    return _pdf_headers(resp)


@app.route('/data/<path:fname>')
@protected
def data(fname):
    resp = make_response(send_from_directory(DATA, fname))
    resp.headers['Cache-Control'] = 'public, max-age=600'
    return resp


@app.errorhandler(404)
def nf(e):
    return send_from_directory(app.static_folder, '404.html'), 404


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 8000)), debug=False)
