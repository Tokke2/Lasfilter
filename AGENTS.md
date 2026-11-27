# AGENTS.md – SortBro

Detta är de hårda reglerna för allt arbete i det här repot. De gäller även efter byte av chatt, modell eller verktyg. Läs hela filen innan du ändrar kod, branch, release eller dokumentation.

## 1. Branch och git

- **Endast en arbetsbranch:** `arena/4044d6f0-lasfilter`. Allt arbete, alla commits och alla pushar går till den.
- **Arbeta aldrig mot `main`.** `main` är en läsbar baslinje och GitHub-standard. Den används inte för utveckling, force-push, merge eller release.
- **Skapa aldrig en ny branch** för ett nytt chatmeddelande. Fortsätt på den aktuella arbetsbranchen.
- **Merge eller pull request är förbjudet.** Publicera via `tools/ship.sh` och tagg, aldrig via PR.
- Om chatten börjar om och arbetsträdet ser fel ut: hämta `origin/arena/4044d6f0-lasfilter` och återställ till den senaste släppta commiten. Hitta inte på en ny branch.
- Andra arbetsbranchar ska tas bort. Deras historik bevaras vid behov som en `archive/...`-tagg, inte som branch.
- `main` får bara finnas kvar som GitHubs skyddade standardbaslinje. Den räknas inte som en arbetsbranch och får aldrig checkas ut för ändringar.

## 2. Release – alltid, vid varje kodändring

- Varje kodändring som påverkar tillägget ska sluta i en ny patchversion och en publicerad release.
- Använd alltid `bash tools/ship.sh`. Den höjer versionen, bygger XPI, kör testerna, verifierar hash/adresser, committar, pushar och taggar.
- Höj aldrig versionen för hand före `ship.sh`. Manifest, `updates.json`, `ui.js` och `ui.html` måste följas åt.
- Releasen ska markeras som **Latest** och `releases/latest` ska peka på den nya versionen.
- `v1.0.0`-bryggan ska ha exakt samma `updates.json`, XPI och ZIP som den nya releasen. Verifiera det efter CI.
- Verifiera efter publicering: CI grön, release inte draft/prerelease, `latest` rätt, XPI-hash och `updates.json`-hash identiska på båda releaserna.
- Appens updater jämför versionsnummer och filhash. En ändrad fil utan höjd version får aldrig släppas.
- Ingen release utan gröna tester. Ingen release från `main`. Ingen release via PR.

## 3. Uppdatering och omstart

- Uppdateringskontroll sker vid start och därefter **en gång per dygn, vid 00:00** så nära pulsen hinner. Thunderbirds egen `extensions.update.interval` är reservväg.
- En nedladdad uppdatering får bara laddas om när ingen flytt, inget svep och ingen spärr pågår. Kontrollera igen efter att skrivningarna spolats ut.
- Efter en lyckad uppdatering ska appen starta om automatiskt (tillägget laddar om sig) och öppna igen utan fråga. Öppna flikar med gammal kod ska laddas om.
- Uppdateringsskriptet ska verifiera SHA-256, manifesterad version och att Thunderbird faktiskt kör den nya versionen innan det räknas som lyckat.
- **Efter lyckad uppdatering ska den tillfälliga säkerhetskopian för den gamla versionen tas bort.** Regler och inställningar ligger kvar i Thunderbirds lagring.
- Uppdateraren får inte lämna ett terminalfönster. Starta via den tysta VBS-startaren när den finns; Thunderbird startas minimerat.
- Ett misslyckat uppdateringsförsök ska återställa den gamla filen och lämna en tydlig felrad – aldrig en halv installation.

## 4. Loggar, fel och arkiv

- Teknisk applogg och separat fellogg ska alltid finnas. De får aldrig innehålla mejltext, ämnesrader eller avsändaradresser.
- Loggar sparas i **7 dagar**. Äldre poster gallras automatiskt. Historiken är ett rullande sju­dagarsarkiv, inte en evig logg.
- Fel som är åtgärdade ska kunna rensas med en separat, bekräftad åtgärd. Rensningen får aldrig röra regler, kö, flyttjournal eller aktiva spärrar.
- Så länge en spärr, ett pågående jobb eller en aktiv felorsak finns kvar ska rensningsknappen vara avstängd.
- Feloggsexporten ska vara komplett för den sparade historiken och visa tid, händelse, antal och detalj/felkod.
- Loggarna skrivs samlat. En stor svepning får inte göra lagringen till en flaskhals.

## 5. Prestanda, minne och energi

- Bakgrunden ska vara billig när inget händer: snabb puls bara vid kö, läsarpaus eller väntande uppdatering; annars långsam.
- Statusmeddelanden och UI-ritningar ska samlas. Dolda flikar ska inte hämta eller rita status.
- Tunga listor (upp till 5 000 loggrader) ritas bara i den vy där de syns.
- Säsongsteckning och andra stora DOM-träd får inte byggas om när inget ändrats.
- Stora cachar ska släppas när de inte längre är färska. Ingen obegränsad Map/Set-tillväxt.
- Nya beroenden i tillägget är förbjudna utan uttryckligt godkännande. Testverktyg får ligga utanför `addon/`.

## 6. Gränssnitt, skärpa och skärmar

- Fungera från **320 px till minst 2 560 px** och i ljust/mörkt läge, normal och stor text.
- Hög DPI: använd vektor där det går och 1x/2x-raster där vektor inte finns. Skala inte ned en 64 px-bild till en godtycklig 38 px-ruta.
- Ingen suddig text: inga negativa teckenbredder på rubriker, ingen påtvingad `optimizeLegibility`, inga halva pixlar för ikoner.
- Rubriker får balanseras, brödtext får jämn radbrytning och kolumner ska hålla sig inom sin bredd.
- Allt viktigt ska synas utan onödig scroll; långa tabeller får rulla i sidled i stället för att trycka ut layouten.
- Klickytor minst 44 px på pekskärm. Fokus ska vara tydligt. `prefers-reduced-motion`, `prefers-contrast` och `forced-colors` ska respekteras.
- Nya ikoner ska vara lokala SVG-symboler i 24 px-rutnät, aldrig externa filer eller textglyfer.
- Logotypen ska använda samma vektormärke överallt. `branding/SortBro-logo.svg` är master och får inte ersättas av en rasterbild i gränssnittet.

## 7. Funktioner som bara gäller vissa appar

- Profilflik, projektkontroll och liknande byggs **endast** om appen faktiskt har profiler/projekt. SortBro har det inte; lägg inte in tomma platshållare.
- Terminalfönster, fönsterstorlek och start-minimerat gäller bara de startvägar som appen faktiskt har. Thunderbird-tillägget startar inget eget terminalfönster.
- Ta inte bort eller byt namn på lagrad data, regler eller flyttjournal utan migrering och tester.

## 8. Förslagslistor

- När användaren ber om 25 nya förslag ska alla 25 skrivas **i chatten**, inte bara i en fil. En sammanfattning får också ligga i `25-NYA-FORSLAG.md`.
- Efter varje tionde chattmeddelande ska en ny lista med **10 nya förslag** visas i chatten. Förslag får inte återanvändas från tidigare listor.
- Listan ska vara konkret: namn, nytta för användaren, prioritet och grov insats.
- Inget förslag byggs förrän användaren väljer nummer, om inte uppdraget uttryckligen säger det.

## 9. Hårda regler och dokumentation

- När användaren skriver **`- hård regel`** eller **`regel`** ska regeln skrivas in här och/eller i relevant dokumentation i samma ändring.
- Regler får inte bara ligga i chatten. De ska finnas i repot och följa med i nästa release.
- Ändra inte tidigare hårda regler tyst. Om en regel ersätts ska den gamla raderas eller markeras som ersatt med datum.
- Dokumentationen ska vara på svenska, tydlig och utan påståenden som inte är testade.

## 10. Test- och kvalitetskrav före klar

- Kör minst:
  - `npm ci --prefix tester`
  - `node --test tester/*.test.cjs`
  - `node tester/dom_check.cjs`
  - Chromium-layoutkontrollen från 320 till 2 560 px, ljust/mörkt, alla vyer, redigerare och donationsdialog.
- Nya funktioner ska ha egna tester. Ändrad logik får inte bara verifieras med en skärmbild.
- Inga tysta beroende- eller gränssnittsbrott: om ett ID, en klass eller en text används i test måste den finnas i HTML/CSS/JS.
- Testa att gamla data och gamla regler fortfarande läses. Testa att `updates.json` och XPI-hash stämmer.
- Rapportera alltid vad som inte kunnat testas, särskilt native Thunderbird/Windows/IMAP.
- Först när alla tester är gröna och releasen är verifierad får uppgiften kallas klar.
