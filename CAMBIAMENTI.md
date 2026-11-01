# Portale SGI · patch del 01/11/2026 (sito di origine, repo `td-sgi-portale`)

Richiesta del CEO (01/11/2026): "Vorrei fare poi la stessa cosa con SGI! Perfettamente!", cioè lo stesso modello del Portale Service: il
sito pubblico resta la fonte, aggiornato dalla routine RSGI, e la Suite lo specchia e lo presenta come widget nativo "SGI Management",
copia conforme, senza doppio inserimento.

Questa cartella contiene **solo i file modificati**, nella stessa struttura del repository, più `patch.diff` (diff unificato rispetto alla
versione attuale). Nessun file di dati generato dal build (docs.json, preparazioni.json, fulltext.json, meta.json), nessuna pagina e
nessun PDF cambia: per lo specchio della Suite il sito va bene così com'è.

## File
| File | Cosa cambia |
| --- | --- |
| `README.md` | Nuova sezione **"Copia conforme nella Suite"** (prima di "Prima pubblicazione"): la Suite specchia il sito (JSON ogni 6 ore + PDF in cache, link stabili anche sotto `/sgi/...` nella Suite, ZIP del repo come ripiego), la routine di aggiornamento resta invariata, cosa non rinominare (contratto con lo specchio), cosa fare se si attiva `SGI_PASSWORD` (le stesse credenziali vanno impostate nella Suite). |

## Voci verso le app di origine
Cercate in `static/` (index.html, app.js, shell.js, preparazioni.html, 404.html), `app.py`, `data/*.json` e `build/`: il sito **non ha
collegamenti** a nc., orders., circolari. (né ad altre app TD poi diventate widget della Suite). L'unico contatto è
`mailto:qualita@toscanadiagnostica.it`, che resta. Quindi nessuna rimappatura: solo il README.

## Come applicarla
1. Nel repo clonato sul PC (lo stesso di `build\aggiorna_portale.bat`): copiare `README.md` al suo posto (oppure `git apply patch.diff`
   dalla radice del repo).
2. Pubblicare come sempre: `build\aggiorna_portale.bat` (commit e push; Render ripubblica in 2-3 minuti).
3. Nella Suite non serve nulla: lo specchio legge il sito da solo (ogni 6 ore o con SGI Management > Impostazioni > Aggiorna adesso).

## Da verificare dopo la pubblicazione
- Dalla rete di Render la Suite raggiunge `https://sgi.toscanadiagnostica.it/api/meta` (SGI Management > Impostazioni > Prova l'origine).
- Se un giorno si imposta `SGI_PASSWORD` su Render: impostare le stesse credenziali nella Suite (Impostazioni > Credenziali dell'origine,
  oppure `SGI_PORTAL_USER`/`SGI_PORTAL_PASSWORD` sul servizio della Suite) e premere "Prova l'origine".
- I conteggi nel README del sito ("562 documenti", "352" stampabili) sono quelli della prima pubblicazione: la pubblicazione del 30/10/2026
  ne ha 567 e 353 (meta.json). Non li ho toccati: li aggiorna chi gestisce il README, se lo ritiene utile.
