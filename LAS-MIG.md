# SortBro – smart mejlsortering för Thunderbird (version 1.0.0)

> Tilläggets id är `lasfilter@lokala-verktyg.invalid` och installationsfilen heter `SortBro-Thunderbird.xpi` (samma innehåll finns även som `Lasfilter-Thunderbird.xpi`).

Ett Thunderbird-tillägg med ett eget svenskt och engelskt gränssnitt (MV2, Thunderbird 140+). Det flyttar ett mejl som matchar dina regler först när Thunderbird har markerat det som läst **och** det inte längre visas i någon mejlflik eller något meddelandefönster. Tillägget börjar alltid i **testläge utan flyttar**.

## Skillnaden mot vanliga filter

Thunderbirds egna filter körs när mejlet kommer in. Detta tillägg körs händelsestyrt via Thunderbirds egna gränssnittsprogram (läst-markering, visning, flytthändelse) och ändrar därför **inte** `msgFilterRules.dat`, `prefs.js` eller någon profilfil. Det samexisterar med dina befintliga filter; stäng av filter som redan flyttar samma mejl vid mottagandet, eftersom tillägget inte blockerar dem.

”Läst” är Thunderbirds läst-markering, inte en bedömning av att du har läst färdigt. Ett mejl som öppnas i en flik eller ett meddelandefönster räknas som läst, men flyttas först när alla visningar är stängda och två sekunder har gått.

## Installation

1. Kontrollera att Thunderbird är **140 eller senare** (Hjälp → Om Thunderbird).
2. Öppna Inställningar → Tillägg och teman → kugghjulet → **Installera tillägg från fil…** och välj `SortBro-Thunderbird.xpi`.
3. Tillåt behörigheterna när Thunderbird frågar. De förklaras under ”Integritet”.
4. Starta om Thunderbird om det efterfrågas. Klicka sedan på kuvertikonen i verktygsfältet eller öppna Inställningar → Tillägg → SortBro → Inställningar.
5. Tillägget körs varje gång Thunderbird startar. Ingen separat autostart behövs.

Inga filer installeras någon annanstans, och inga externa program krävs.

## Din första regel

1. Öppna en mejlflik och markera ett befintligt mejl där, exempelvis en faktura.
2. I Läsfilter: **Hämta från markerat meddelande** fyller källmapp och första villkoret.
3. Välj målmapp, lägg till fler villkor vid behov (OCH/ELLER) och **Spara regel**.
4. **Testa markerat** visar om villkoren matchar och varför en flytt eventuellt inte sker nu. Testet flyttar aldrig något.
5. När du är nöjd: skicka eller ta emot ett nytt mejl, läs det, gå vidare till nästa. I testläge simuleras bevakningen och räknas som prov.
6. Välj **Aktivera flytt** först när proven ser rätt ut. Då utförs riktiga flyttar för framtida läst-markeringar.

Redan lästa gamla mejl massbehandlas inte. Vill du testa på ett sådant, välj **Bevaka markerat läst →** i nederkanten; det köar just det mejlet.

## Snabbare vägar till en färdig regel

- **⚡ Snabbskapa nytt filter:** lägg till flera olika filter direkt ovanför regellistan utan att skriva över en befintlig regel. Kryssrutorna *Flytta olästa mejl* och *Öppna i nytt fönster* styr regeln direkt.
- **✨ Föreslå regler från Inkorgen:** SortBro tittar lokalt i Inkorgen efter avsändardomäner som återkommer och visar dem som *förslag*. Inget skapas förrän du själv väljer målmapp och trycker **✓ Godkänn**. Avsändare som redan täcks av en aktiv regel föreslås aldrig.
- **1-klicksmallar:** *Fakturor & Kvitton*, *Order & Leverans*, *Nyhetsbrev*, *System & Notiser* och *Bokföring* fyller i regelnamn och villkor. Om en mapp med passande namn finns väljs den automatiskt som mål; annars väljer du målmapp och sparar.
- **＋ Ny mapp:** skapar målmappen direkt i Thunderbird (via tilläggets mapp-API) och väljer den som mål. Mappen kan skapas både från regelkortet och från snabbformuläret.
- **Högerklicksmeny på mejl:** *SortBro: Skapa filter från detta mejl…* öppnar SortBro med en ny regel förifylld från mejlet (avsändardomän, adress eller ämne). Regeln sparas först när du själv trycker Spara.

## Arkivering – och varför olästa mejl kan vänta

SortBro arkiverar **ingenting av sig självt**. Det finns ingen inbyggd årsarkivering som körs i bakgrunden: en regel gör precis det du har ställt in, och inget mer.

- **Arkivera äldre mejl** (🗄️ i mallraden) fyller i *Datum · Är äldre än 90 dagar* och väljer en mapp som heter *Arkiv*/*Archive* om den finns. Ändra 90 till valfritt antal dagar. Åldersvillkoret rullar framåt av sig självt.
- **Årsmappar är ett valfritt tillval per regel – aldrig obligatoriskt.** Kryssrutan **Valfritt: lägg varje år i en egen årsmapp under målmappen** (steg 3) är **avstängd som standard** och kan **alltid kryssas av igen**: regeln flyttar då till den vanliga målmappen. Inga mallar och inga snabbfilter slår på årsmappar, och en målmapp som redan *är* en årsmapp (t.ex. `Arkiv/2025`) får aldrig en årsmapp inuti sig. Kryssar du i den hamnar tidigare års mejl i `Arkiv/2023`, `Arkiv/2024`, `Arkiv/2025` och så vidare. Mappen skapas automatiskt när den behövs (högst tolv per session); går det inte att skapa används den vanliga målmappen i stället och inget mejl tappas bort. Mejl som redan ligger i rätt årsmapp köas aldrig om.
- **Villkoren *Är före/efter innevarande år*** finns kvar i villkorslistan för dig som vill bygga en egen årssregel. De behöver inget värde alls: de jämförs med kalenderns innevarande år vid varje körning, så regeln fortsätter betyda ”tidigare år” även nästa år.

### Olästa mejl: rutan bestämmer

Kryssrutan **Flytta även olästa mejl direkt** i steg 3 styr läsläget för regeln:

- **Kryssad** → olästa mejl som matchar regeln flyttas **direkt**, utan att vänta på att bli lästa. Det gäller i alla mappar regeln söker i, inte bara i Inkorgen. Flytten sker omedelbart när mejlet kommer in eller vid nästa svep – och kryssrutan **Öppna flyttade olästa mejl i nytt fönster** avgör om ett oläst mejl också öppnas i ett fönster (annars ligger det kvar som oläst i målmappen).
- **Omarkerad** → olästa mejl ligger kvar och flyttas först när du har läst dem och lämnat dem (minst två sekunder utan visning i någon flik eller något fönster).

Under **Avancerat: läsläge & olika mål beroende på ämne** finns samma sak som fyra läslägen: *enligt standard*, *endast lästa*, *både olästa och lästa* samt *endast olästa* – kryssrutan håller sig i synk med läget.

### Nya villkor i regler

| Fält | Jämförelser | Exempel |
|---|---|---|
| **Till (mottagare)** | innehåller / är lika med / börjar med / slutar med | `faktura@` |
| **Kopia (Cc)** | innehåller / är lika med / börjar med / slutar med | `ekonomi@` |
| **Storlek** | är större än / är mindre än (kB) | större än 500 |
| **Datum** | är äldre än / är nyare än (dagar) samt är före år / är efter år / är före innevarande år / är efter innevarande år | före 2026 |

Storlek och datum skrivs som tal (kB respektive dagar eller årtal) och valideras innan regeln sparas. Åldersvillkoren räknas mot tiden för svepet, så *äldre än 90 dagar* glider framåt av sig själv. Villkoren **Är före/efter innevarande år** behöver inget värde alls: de jämförs med kalenderns innevarande år vid varje körning, så en regel för "tidigare år" fortsätter att stämma även nästa år i stället för att fastna på ett årtal.

## Kör alla regler – och se varför mejlen inte flyttas

Du behöver inte vänta på nästa automatiska körning eller på att nya mejl kommer in:

- **▶ Kör alla regler nu** (knappen högst upp i regellistan, och *Kör alla regler nu* under **Flyttstatus**) sveper igenom alla aktiva regler direkt och berättar exakt vad som hände: hur många mejl som granskades, hur många mappar som gick snabbt via cachen, hur många som matchade samt hur många som köades eller väntar till nästa körning. Inkommande mejl bevakas precis som vanligt under tiden.
- **🔎 Varför flyttas inte mejlen?** (i regelredigeraren) är en **läsbar diagnos** av just den regel du har öppen. Ingenting flyttas, ingenting köas och den fungerar även när bevakningen är pausad eller står i **Testläge**. Panelen svarar i klartext:
  - *redo* – antalet mejl som matchar och flyttas vid nästa körning,
  - *olästa och väntar* – matchande mejl som står på **Endast lästa mejl** och därför väntar tills du har läst dem,
  - *redan i målmappen* (eller i sin årsmapp),
  - *redan hanterade* – mejl som redan köats eller flyttats,
  - samt upp till fem exempelrader med ämne och avsändardomän.
  Avslutningsvis påminner panelen om regeln står i Testläge, om tillägget är pausat/stoppat eller om motorn har en fellåsning.
- **✔ Tillåt olästa mejl och flytta dem nu:** knappen i diagnospanelen (syns när det finns olästa mejl som matchar) kryssar i *Flytta även olästa mejl direkt*, sparar regeln och kör alla regler – ett klick i stället för att leta i inställningarna.
  - **Matchar ingenting visas i stället vad som ligger i mapparna:** panelen listar då upp till fem av de mejl som granskades (Inkorgen först) med ämne och avsändardomän, så att du kan jämföra med villkoren. Det är snabbaste sättet att se varför en regel inte nappar – t.ex. att ämnet är *"Wordfence activity for 12 oct, 2026…"* medan regeln letar efter texten *WordPress Alert*, och avsändaren är webbplatsens egen domän i stället för wordpress.com.

### Loggen: tyst när inget är fel, läsbar när något är det

- **Pausad eller stoppad bevakning larmar inte.** Automatiska svep (timintervallet och svepet vid start) hoppar över i tysthet när bevakningen är pausad eller stoppad – du får ingen "Tekniskt fel"-rad för att du själv har tryckt Pausa. Är motorn stoppad av ett fel skrivs **en** tydlig notis i stället för en rad per försök.
- **Övergående startfel försöks om i tysthet.** Direkt efter att Thunderbird har startat kan kontona svara "inte redo" ännu. Svepet gör då ett tyst andra försök efter 15 sekunder och skriver först därefter, om det fortfarande misslyckas: *Tekniskt fel – Automatiskt svep misslyckades (sweep_error) – kontrollera att regelns käll- och målmappar finns kvar och går att skriva i.*
- **Svepraden i loggen säger varför inget flyttas.** Varje svep skriver `skannade=… matchade=… i_mal=… klara=… koade=…`: `matchade` är mejl som träffades av regeln, `i_mal` sådana som redan låg i målmappen/sin årsmapp och `klara` sådana som redan var hanterade. Är `matchade=0` finns det helt enkelt inget som matchar regeln.
- **▶ Kör alla regler nu väntar in en pågående körning** i stället för att rapportera noll: pågår redan ett svep (t.ex. startsvepet) väntar knappen in det och visar hela körningens siffror. Är bevakningen pausad eller stoppad säger knappen det rakt ut, och om ett svep verkligen fallerar visas felmeddelandet som en toast i stället för att tigas ihjäl.

### Automatiskt varje timme – med bevakning kvar

**Kör alla regler automatiskt (rekommenderas)** under **Inställningar → Avancerat** kör samma svep automatiskt med valfritt intervall (steg om 15 minuter, standard **60 minuter = en gång i timmen**). Detta är *utöver* den händelsestyrda bevakningen: nya mejl som kommer in till Inkorgen hanteras direkt när de anländer, och olästa mejl som du just har läst flyttas så snart de har lämnat visningen. Intervallsvepet fångar upp allt övrigt – till exempel mejl som legat i andra mappar, mejl som blev lästa i ett annat program och regler som följer kalendern vid årsskiftet. Statusraden under **Flyttstatus** visar när nästa automatiska körning sker och att inkommande mejl bevakas hela tiden.

## Design, språk och årstider

- **Svenska & Engelska** växlas direkt i toppbaren (*SV · Svenska* / *EN · English*).
- **Ljust och mörkt läge** samt **årstidsteman** (*Auto · 🌸 Vår · ☀️ Sommar · 🍂 Höst · ❄️ Vinter*). Årstiden färgar gränssnittet, hälsningen, det dynamiska SVG-landskapet i hero-kortet, SortBro-logotypen och verktygsfältsikonen. *Auto* följer kalendern; ett manuellt val ligger kvar tills du ändrar det.
- **Animerad puls** på sifferkorten när antalet regler, köade mejl, flyttar eller matchningar ändras.
- **Stöd SortBro** finns både i gränssnittet och i `stod.html`: 100 % lokalt genererad Swish-QR (ISO/IEC 18004-verifierad, `C0721817177;…` samt kameravy med `swish://`), PayPal och Ko-fi. Inget låses upp av en gåva.

## Säkerhetsmekaniker

- Högst ett flyttförsök per meddelande. Journalen skrivs före försöket och rensas inte förrän Thunderbird har bekräftat flytthändelsen. Ett avbrutet eller osäkert försök pausar motorn och upprepas inte.
- Vid osäkerhet eller ändrade regler rensas väntande jobb; redan registrerade spärrar rensas endast manuellt efter din egen kontroll.
- Regeländringar och växling mellan test/flytt ökar regelversionen och gör gamla köade jobb ogiltiga.
- Flyttar godkänns bara mellan vanliga mappar i samma konto. Specialmappar, sökmappar, skrivskydd och regelkedjor med loopar avvisas. Vid ett fel görs ingen kopiering som reserv.
- Oläst-markering, ändrad källmapp eller en öppnad visning stoppar en väntande flytt.
- Kön är begränsad till 100 väntande jobb; när gränsen nås töms kön och resten väntar till nästa svep. Väntande jobb kan återställas efter omstart om Message-ID, datum, storlek och källmapp är entydiga; ett gammalt sessions-id återanvänds aldrig.

## Integritet och behörigheter

Behörigheter som Thunderbird visar: läsa konton och mappar (`accountsRead`), skapa mappar i kontot när du själv trycker *＋ Ny mapp* (`accountsFolders`), läsa meddelandehuvuden, flytta meddelanden, markera läst vid återställning, lägga till en post i högerklicksmenyn på mejl (`menus`), lagra egna inställningar lokalt och spara exporterade filer (`downloads`).

Datorns nätverk används aldrig: tilläggets säkerhetspolicy är `connect-src 'none'`. Swish-QR-koden ritas helt lokalt i gränssnittet.

Lagrade data är egna regelinställningar, fem regelkopior, köjournal och en teknisk händelselogg med endast räknare. Ingen logg eller export innehåller mejltexter, ämnesrader eller fullständiga adresser. Allt lagras i Thunderbirds eget tilläggsutrymme. Tillägget öppnar inga nätverksanslutningar.

## Teknisk logg

Händelserna skrivs till aktivitetssidan och kan exporteras som JSON under Aktivitet. Händelserna är start, sparade inställningar, sparade regler, återställda jobb, köade, simulerade prov, bekräftade flyttar, överhoppade, spärrade köer och generiska fel. Rensning sker efter tio dagar, högst 500 rader.

## Gränser som du bör känna till

- Flytten bekräftas av Thunderbirds lokala flytthändelse, inte av en separat kvittens från din IMAP-server. Kontrollera mål- och källmapp i Thunderbird efter aktivering.
- Om ett annat filter eller en annan åtgärd redan har flyttat eller raderat meddelandet registreras det som överhoppat eller spärrat, beroende på läge.
- Röda dagar, frånvaro och arbetsflöden hanteras inte. Ställ in paus manuellt vid behov.
- Återställning efter omstart fungerar endast för meddelanden med stabilt Message-ID och entydig träff i källmappen.

Testade miljöer och resultat finns i `TESTRESULTAT.md`. Din egen Windows/IMAP-miljö är ett separat godkännandesteg; börja med en provmapp och testläge.

## Nyheter i 1.0.0 (SortBro)

- **Motor och kö:** max 100 väntande jobb i kön, och flyttar sker parallellt medan kön byggs (svepet väntar aldrig på en full kö). När kön når 100 töms den innan fler läggs till.
- **Smart mapp-cache:** tomma mappar och mappar som är oförändrade sedan förra svepet utan träffar hoppas över på under 1 ms i stället för att skannas om. Cachen invalideras vid nya mejl, ändrad lässtatus, genomförd flytt och regeländring, så inget kan missas.
- **Säker IMAP-flytt:** progressiv verifiering via flytthändelsen och kontroll i mål- och källmapp. Gamla osäkra försök rensas vid omstart och ger inga falska `uncertain_move`-stopp.
- **Inget popup-kaos vid mass-svep:** under ett pågående svep, eller när kön redan är lång, öppnas aldrig nya fönster – mejlen flyttas och behålls bara som olästa.
- **Regler och utbyte:** upp till 200 regler med direktkontroller per regelrad, snabbskapande, förslag från Inkorgen, sex 1-klicksmallar (inkl. 🗄️ Arkivera äldre mejl), egen mappskapning, högerklicksmeny samt JSON-export/import (ersätt eller lägg till) med automatisk mappmatchning.
- **Fler villkor:** Till, Kopia (Cc), Storlek (kB) och Datum (dagar eller årtal) utöver avsändare, domän och ämne.
- **Valfria årsmappar:** årsarkivering är inget förval utan en kryssruta per regel (avstängd som standard). Kryssar du i den hamnar tidigare års mejl i `Arkiv/2025` – annars flyttas mejlen till den målmapp du valt.
- **Olästa mejl flyttas när rutan är kryssad:** *Flytta även olästa mejl direkt* gör att matchande olästa mejl flyttas med en gång i alla mappar, i stället för att vänta tills de är lästa.
- **Kör alla regler nu:** en knapp sveper igenom alla aktiva regler direkt och rapporterar granskade mejl, cachade mappar, matchningar och köade flyttar.
- **Varför flyttas inte mejlen?:** läsbar diagnos per regel som förklarar om mejlen väntar på att bli lästa, redan ligger i målmappen, redan är hanterade eller inte matchar villkoren – med exempelrader och påminnelse om Testläge/paus.
- **Automatiskt varje timme:** standardintervallet är 60 minuter och körs vid sidan av den händelsestyrda bevakningen av inkommande mejl. Statusraden visar nästa automatiska körning.
- **Öppna `ui.html`-flikar laddas om** automatiskt när tillägget installeras eller startas om.

## Nyheter i 1.3

- **Målmapp i vilket konto som helst:** du kan nu välja en målmapp i ett annat konto än källmappen, till exempel flytta från IMAP-inkorgen till ett lokalt arkivkonto. Tillägget kontrollerar fortfarande att källmappen tillåter borttagning och att målmappen tillåter mottagning innan något köas, och loopkontrollen gäller som tidigare. Skanningen av befintliga mejl rör fortfarande bara det konto regeln läser från.
- **Timvis automatisk flytt:** alternativet *Kör alla regler automatiskt* sveper igenom aktiva regler en gång i timmen (valfritt intervall i steg om 15 minuter, standard 60). Standard är på, och bevakningen av inkommande mejl fortsätter samtidigt. I testläge räknas träffarna som prov och inget flyttas.
- **Direktläge, även för olästa:** i inställningarna kan du byta flyttsätt från *När mejlet är läst och stängt* till *Direkt, även olästa*. I direktläge flyttas nya matchande mejl så fort de anländer, utan att vänta på att du läser dem.
- **Tydlig indikator:** när ett oläst mejl flyttas i direktläge öppnas det automatiskt i ett eget fönster, så att du ser vad som flyttades och kan läsa det där. Stäng fönstret när du är klar; mejlet ligger redan i målmappen. Indikatorn kan stängas av, men direktläget rekommenderas inte utan den.
- **Snabbtangent för svep:** *Ctrl+Shift+L* kör ett svep direkt. Ändra tangenten under Verktyg → Tillägg → Hantera tilläggssnabbkommandon i Thunderbird.

## Nyheter i 1.1 och 1.2

- **Finfördelning i en regel:** under målmappen kan du lägga till fördelningar, exempelvis *Ämne innehåller Faktura → Ekonomi/Fakturor* och *Ämne innehåller Order → Order*. Första träffen styr; övriga mejl går till regelns vanliga målmapp. Fördelningar räknas in i loop- och mappkontrollerna.
- **Sortera befintliga lästa:** knappen skannar regelns kontos faktiska mappar, inklusive undermappar men utom regelns målmappar (grundmål och fördelningar), efter lästa mejl som matchar regelns villkor oavsett var de ligger nu. Träffar köas med sin aktuella mapp som källa och flyttas till regelns mål genom samma skyddsvägar. I testläge räknas träffar som prov. Olästa mejl hoppas över i läsläget. Högst 500 meddelanden per skanning.
