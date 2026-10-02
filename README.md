# Portale SGI Toscana Diagnostica

Webapp di consultazione del Sistema di Gestione Integrato: cruscotto documentale con ricerca full-text su tutti i documenti attivi (PDF), versioni stampabili dei moduli e delle informative, sezione **Preparazioni agli esami** con link stabili per prestazione da inserire nel software di accettazione (GIPO) e inviare ai pazienti via SMS.

Stack: Python 3.12 + Flask + gunicorn, nessun database. Interfaccia nello stesso stile della Cash Management (`td-cash-management/web/src/styles.css`: palette Dark Teal #1C505E, Pacific Blue #71B1BD, Jet Black #01212C, Cornsilk, Mauve; font Manrope; sidebar scura con logo bianco, card, KPI, tabelle). Pubblicazione: repository GitHub collegato a un Web Service Render (deploy automatico a ogni push).

## Struttura

```
app.py                  server Flask (rotte, link stabili, protezione opzionale con password)
requirements.txt        Flask, gunicorn
render.yaml             blueprint Render (Web Service Python, Frankfurt)
Procfile                comando di avvio alternativo
build/build_site.py     generatore: legge REG006 e le cartelle OneDrive, produce data/, docs/, stampabili/
build/aggiorna_portale.bat  routine Windows: rigenera e pubblica (git push)
build/Prestazioni_Preparazioni.xlsx   mappa prestazioni -> preparazioni (colonna "Preparazioni")
data/docs.json          562 documenti attivi (codice, titolo, area, rev, data, sintesi, pdf, stampabile)
data/fulltext.json      testo integrale per la ricerca (caricato dal browser alla prima ricerca)
data/preparazioni.json  prestazioni con link alle preparazioni
data/meta.json          revisione REG006, conteggi, data di build
docs/<Area>/*.pdf       PDF di distribuzione (562)
stampabili/*.pdf        versioni senza cover di MOD, DEX, INF (352)
static/                 index.html (cruscotto), preparazioni.html, shell.js (sidebar comune), app.css, app.js, logo-light.svg, logo-td.svg, mark.svg, favicon.png, 404.html, robots.txt
```

## URL pubblici

| URL | Cosa fa |
|---|---|
| `/` | Cruscotto SGI con ricerca full-text, filtri per area e famiglia |
| `/doc/TD-SGI-PRO042` | Link stabile al PDF corrente del documento (senza revisione nel link) |
| `/m/TD-SGI-INF020` | Link stabile alla versione stampabile corrente del modulo/informativa |
| `/preparazioni` | Pagina pazienti: prestazioni e relative preparazioni |
| `/p/<codice shortcut>` (es. `/p/ECO003`) | Link da mettere in GIPO: apre il PDF della preparazione (se la prestazione ne ha piu' di una, mostra l'elenco). Il codice GIPO numerico e' accettato come alias |
| `/p/<codice shortcut>.pdf` | Lo stesso, forzando il PDF |
| `/stampabili/<file>.pdf`, `/docs/<area>/<file>.pdf` | File |
| `/api/preparazioni`, `/api/informative`, `/api/meta`, `/healthz` | Dati |

I link `/doc/`, `/m/` e `/p/` non contengono la revisione: quando un documento sale di revisione il link resta valido e apre il file nuovo. Il PDF viene consegnato direttamente sotto quell'indirizzo (nessun redirect): nella barra del browser resta `sgi.toscanadiagnostica.it/p/ECO003`. Non cambiare mai i codici prestazione in GIPO: cambiano solo i PDF dietro.

## Funzioni del cruscotto

I quattro riquadri in alto sono filtri: Documenti attivi (tutti), Procedure e istruzioni (PRO+IDL), Moduli/informative/doc. esterni (MOD+INF+DEX), Governo del sistema (POL+MAN+PLN+REG+RPT); un secondo clic li disattiva, il pulsante Azzera riporta alla home. La sidebar ha la tendina delle aree (sincronizzata con quella del cruscotto), le scorciatoie Ultime emissioni (40 documenti piu' recenti per data), Documenti cardine, Versioni stampabili, Indice REG006, Mappa concettuale, Politica integrata, e il contatto qualita@toscanadiagnostica.it. Ogni riga ha PDF, Stampabile (se esiste), Allegati, busta (e-mail) e catena (copia link stabile).

Invio per e-mail: il pulsante con la busta apre il client di posta dell'utente (Outlook) con oggetto e testo gia' compilati e i link stabili al PDF e alla versione stampabile; un indirizzo `mailto:` trasporta solo testo, percio' nello stesso clic i link vengono copiati negli appunti anche in formato HTML: se nel messaggio compaiono come testo semplice basta Ctrl+V per incollarli come collegamenti cliccabili. Il pulsante con la catena (e il link nella pagina Preparazioni) copia l'URL in doppio formato, testo e HTML: incollato in Outlook, Word, Teams o in un campo di testo formattato (GIPO, se il campo lo consente) e' un collegamento attivo, in un campo di solo testo e' l'URL. Una pagina web non puo' allegare un file a un messaggio: si inviano i link, che aprono sempre la revisione in vigore (e che non invecchiano come farebbe un allegato). L'invio diretto dal server come qualita@toscanadiagnostica.it (Microsoft Graph, Mail.Send) e' possibile in una fase successiva: richiede una registrazione app in Entra, il consenso dell'amministratore e un segreto da custodire su Render; va valutato se il volume di invii lo giustifica.

## Protezione dell'area documentale

Per impostazione predefinita tutto e' pubblico (decisione AD 01/10/2026). Impostando su Render la variabile d'ambiente `SGI_PASSWORD` (e, se si vuole, `SGI_USER`, default `sgi`) il cruscotto e i PDF del SGI chiedono user e password (HTTP Basic Auth); le pagine `/preparazioni`, `/p/`, `/m/` e `/stampabili/` restano sempre aperte ai pazienti. Il browser ricorda le credenziali per la sessione. Si cambia in Render > Environment, senza toccare il codice.

## Prima pubblicazione (una volta sola)

1. Creare su GitHub un repository privato `td-sgi-portale` (vuoto, senza README).
2. Dal PC, nella cartella del repo (estratta dallo ZIP):
   ```
   git init
   git add -A
   git commit -m "Portale SGI - REG006 rev. 76"
   git branch -M main
   git remote add origin https://github.com/<account>/td-sgi-portale.git
   git push -u origin main
   ```
3. Su Render: **New + > Blueprint**, selezionare il repo. Render legge `render.yaml` e crea il servizio `td-sgi-portale`. Se si preferisce creare il servizio a mano: Web Service, runtime Python, build `pip install -r requirements.txt`, start `gunicorn app:app --workers 2 --threads 4 --timeout 60`, health check `/healthz`.
4. Al termine Render fornisce l'indirizzo `https://td-sgi-portale.onrender.com`. Il dominio ufficiale e' `sgi.toscanadiagnostica.it`: su Settings > Custom Domains si aggiunge il dominio e nel DNS aziendale si crea un record CNAME `sgi` verso `td-sgi-portale.onrender.com` (non un inoltro/redirect: con il CNAME il browser resta sempre sul dominio aziendale). La variabile `CANONICAL_HOST=sgi.toscanadiagnostica.it` fa reindirizzare al dominio ufficiale chiunque arrivi sull'indirizzo onrender; lasciarla vuota finche' il DNS non e' attivo, altrimenti il portale non e' raggiungibile.
5. Piano Render: con il piano Free il servizio si addormenta dopo 15 minuti di inattivita' e il primo accesso richiede circa 30 secondi. Per i link SMS ai pazienti serve il piano Starter (sempre acceso).

## Aggiornamento a ogni emissione SGI (routine, passo 11)

Dal PC di Francesco, con il repo clonato e la cartella OneDrive sincronizzata:

```
build\aggiorna_portale.bat
```

Il batch esegue `build_site.py` (rilegge REG006 corrente, copia tutti i PDF e le versioni stampabili, rigenera l'indice full-text e la mappa delle preparazioni) e poi `git add -A`, `git commit`, `git push`. Render ripubblica in 2-3 minuti. Il footer del portale mostra revisione REG006 e data di pubblicazione: controllarli dopo il deploy.

Requisiti sul PC: Python 3 con `pip install openpyxl pymupdf`, Git. Se il file Excel delle prestazioni cambia, sostituire `build\Prestazioni_Preparazioni.xlsx` e rilanciare il batch.

## Mappa delle preparazioni

`build_site.py` legge il primo foglio del file Excel delle prestazioni, trova la colonna il cui nome contiene "Preparaz", la colonna del codice GIPO (nome contenente "Cod") e la colonna "Codice shortcut", che e' la chiave dei link pubblici `/p/` (decisione AD 02/10/2026): deve essere presente e univoca, altrimenti la generazione si ferma. Nella colonna Preparazioni accetta uno o piu' riferimenti a documenti SGI separati da `;` o `,` (es. `INF020`, `TD-SGI-INF020_00`, `INF020; MOD004`). Il link pubblicato punta alla versione stampabile (senza cover) se esiste, altrimenti al PDF di distribuzione. I riferimenti non risolti finiscono in `data/preparazioni.json` alla voce `non_risolte` e vanno corretti nell'Excel.
