# SortBro – smart mejlsortering för Thunderbird (version 1.0.0)

> Tilläggets id är `lasfilter@lokala-verktyg.invalid` och installationsfilen heter `SortBro-Thunderbird.xpi` (samma innehåll finns även som `Lasfilter-Thunderbird.xpi`).

Ett Thunderbird-tillägg med ett eget svenskt och engelskt gränssnitt (MV2, Thunderbird 140+). Det flyttar ett mejl som matchar dina regler först när Thunderbird har markerat det som läst **och** det inte längre visas i någon mejlflik eller något meddelandefönster. Tillägget börjar alltid i **testläge utan flyttar**.

## Skillnaden mot vanliga filter

Thunderbirds egna filter körs när mejlet kommer in. Detta tillägg körs händelsestyrt via Thunderbirds egna gränssnittsprogram (läst-markering, visning, flytthändelse) och ändrar därför **inte** `msgFilterRules.dat`, `prefs.js` eller någon profilfil. Det samexisterar med dina befintliga filter; stäng av filter som redan flyttar samma mejl vid mottagandet, eftersom tillägget inte blockerar dem. Undantaget är den frivilliga **import och export av filterfilen**: där skriver tillägget en fil åt dig och läser en fil du själv väljer, men det rör aldrig profilens egen `msgFilterRules.dat` – den byter du ut själv när Thunderbird är stängt (se *Thunderbirds egna filter* nedan).

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

- **⚡ Skapa regel på tio sekunder (snabbregeln):** den enklaste vägen till en färdig regel, ovanför regellistan.
  - **Klickbara förslag:** SortBro läser Inkorgen en gång och visar *Avsändare i Inkorgen* och *Ord i ämnesrader* med antal mejl. Ett klick fyller fälten – du behöver aldrig kunna en exakt adress. Återkommande avsändare och ord som redan har en regel föreslås aldrig.
  - **Fler förslag när du vill:** de åtta vanligaste avsändarna och de sex vanligaste ämnesorden visas direkt; resten ligger bakom **＋ visa fler**. Varje förslag bär en ledtråd – *"Vanligaste adressen: order@klarna.se · Senaste ämnet: Order bekräftad"* – och ett **✕** döljer ett förslag du inte vill se. *Visa dolda förslag igen* tar tillbaka dem.
  - **Live-räkning som säger sanningen:** så snart fältet har ett värde står det i klartext hur många mejl regeln flyttar **just nu** – *"3 mejl i Exempelkonto matchar just nu"*. Siffran gäller bara **kontot målmappen ligger i**, precis som regeln själv, och den räknar bara mejl som faktiskt flyttas: är några olästa och kryssrutan *Flytta olästa mejl* är av står det *"2 av 3 flyttas nu – 1 olästa väntar på att läsas"* i stället för ett löfte som inte hålls. Är Inkorgen större än de 400 senaste mejlen som läses står det också, i stället för att låtsas att siffran är hela Inkorgen. Ingenting sparas förrän du klickar.
  - **Räkningen är omedelbar:** Inkorgen läses en gång och återanvänds i två minuter, så siffran kommer direkt när du skriver. **↻ Läs Inkorgen igen** läser om allt, och efter en flyttning räknas det från början igen.
  - **Klarspråk i stället för villkor:** raden under målmappen skriver ut exakt vad regeln gör: *"Flytta mejl från klarna.se till Fakturor"*. Skriver du ett löst ord (t.ex. `klarna`) blir villkoret *avsändaren innehåller klarna*; skriver du en full domän (`klarna.se`) eller adress (`order@klarna.se`) blir det en exakt träff. Ämnesord blir alltid *innehåller*.
  - **Ett klick till färdig regel:** **＋ Skapa regel** sparar regeln (och visar den i editorn), **⚡ Lägg till och flytta nu** sparar och kör den direkt mot Inkorgen.
  - **＋ Ny mapp** föreslår ett mappnamn ur det du skrev: `klarna.se` → *Klarna*, `wordpress@limoeurope.com` → *Limoeurope*.
  - Kryssrutorna *Flytta olästa mejl* (förkryssad) och *Öppna i nytt fönster* styr regeln direkt; årsmappar förblir avstängda som standard. Kryssar du ur *Flytta olästa mejl* ändras siffran direkt, så du ser vad som händer innan du sparar.
  - **Snabbregeln minns:** målmappen du använde sist är förvald nästa gång du öppnar Regler, och **Esc** tömmer fältet när du ångrar dig.
  - Allt sker lokalt: förslagen bygger bara på avsändare, ämnesrader och antal – ingen mejltext lämnar datorn, och ingenting skapas utan ditt klick.
- **＋ Importera domäner/adresser till en befintlig regel:** i regelredigeringen, under villkoren, finns en ruta där du klistrar in en eller flera domäner/adresser – en per rad, med komma, semikolon eller mellanslag. Varje rad blir ett **villkor i just den regeln**, utan att de gamla villkoren rörs.
  - Adress (`order@klarna.se`) och domän (`klarna.se`) blir **exakta träffar**; ett löst ord blir *avsändaren innehåller*. Klamrar och `mailto:` städas bort automatiskt.
  - Flera villkor kopplas ihop med **"minst ett av villkoren"** (flera avsändare betyder ju eller) – rutan säger till när kombinationen ändras och hur många villkor som lades till.
  - **Dubbletter hoppas över** och räknas upp i klartext (*"2 hoppades över (dubbletter eller regeln är full)"*), och regeln kan aldrig få fler än **8 villkor**.
  - Ändringen ligger i utkastet tills du trycker **Spara regel** – då sparas en regelkopia först, precis som vanligt.
  - Snabbvägen: i **⚡ Skapa regel på tio sekunder** väljer du *Lägg till i: \<regel\>* i listan och trycker knappen – då läggs avsändaren in i den regeln direkt, och **⚡ Lägg till och flytta nu** kör den också. Har regeln villkor sedan tidigare frågar SortBro först, eftersom nya avsändare blir alternativ (ELLER).
- **1-klicksmallar:** *Fakturor & Kvitton*, *Order & Leverans*, *Nyhetsbrev*, *System & Notiser* och *Bokföring* fyller i regelnamn och villkor. Om en mapp med passande namn finns väljs den automatiskt som mål; annars väljer du målmapp och sparar.
- **＋ Ny mapp:** skapar målmappen direkt i Thunderbird (via tilläggets mapp-API) och väljer den som mål. Mappen kan skapas både från regelkortet och från snabbformuläret.
- **Högerklicksmeny på mejl:** *SortBro: Skapa filter från detta mejl…* öppnar SortBro med en ny regel förifylld från mejlet (avsändardomän, adress eller ämne). Regeln sparas först när du själv trycker Spara.

## Thunderbirds egna filter – läs in dem och skriv ut dina egna

Du som redan har fyrtio filter behöver inte skriva om dem. I **Regler**-vyn finns kortet **🔁 Thunderbirds egna filter**:

- **⇪ Importera filterfil…** läser din `msgFilterRules.dat` och visar varje filter som en rad: namn, de villkor som gick att översätta, en rullista för målmappen och en kryssruta. **Ingenting skapas förrän du trycker på knappen**, och knappen räknar bara de rader som har en målmapp. Filen hittar du via *Hjälp → Felsökningsinformation → Öppna mappen* och sedan `ImapMail/<server>/` eller `Mail/Local Folders/`.
- **⤓ Exportera som filterfil** skriver dina SortBro-regler som en `msgFilterRules.dat` i samma format som Thunderbird 140 använder (version 9). Filen laddas ner till Hämtade filer – du lägger själv in den i profilmappen medan Thunderbird är stängt. **Ta en kopia av den gamla filen först.** Tillägget rör aldrig profilen själv.

**Det här översätts:** avsändare, till, kopia, ämne, storlek och datum; jämförelserna innehåller, är lika med, börjar med, slutar med samt större/mindre/äldre/nyare. *Alla adresser*, *vilken adress som helst* och *till eller kopia* blir den närmaste SortBro-varianten och raden säger att det är en ungefärlig översättning. Storlek räknas om mellan byte (Thunderbird) och kB (SortBro) åt båda hållen.

**Det här går inte – och därför står det rakt ut på raden:**

| I filterfilen | Varför | Vad du ser |
|---|---|---|
| Villkor på mejltexten (`body`) | SortBro matchar inte brevvästen | raden är urkryssad: *Villkor på mejltexten (body) kan SortBro inte matcha* |
| Negerade villkor (`doesn't contain`, `isn't`) | SortBro kan inte uttrycka "inte" | *Negerade villkor (doesn't contain / isn't) kan SortBro inte uttrycka* |
| `condition="ALL"` | filtret matchar allt och har inget villkor att översätta | *Filtret matchar allt (ALL) och har inget villkor att översätta* |
| Blandade OCH/ELLER | SortBro kombinerar antingen alla eller minst ett | *Blandade OCH/ELLER kunde inte översättas exakt* |
| Filter som bara markerar läst, byter etikett eller skräppostmarkerar | SortBro flyttar mejl | *Åtgärder som inte följer med: Mark read, JunkScore* |
| Filter utan flytt | det finns ingen målmapp att ärva | *Filtret flyttar inga mejl* |
| Målmapp som saknas hos dig | mappen kanske heter något annat | *Ingen målmapp matchade "Fakturor" – välj en* |

Inget villkor tappas tyst: varje rad visar exakt vad som inte följde med, och du kan välja målmapp för hand på de rader där namnet inte gick att matcha. Filtren är dessutom urkryssade om de var avstängda i Thunderbird, så de importeras avstängda.

**Om något inte går vägen:** filtren sparas ett i taget om en gemensam sparning skulle fallera, så ett enda filter som motorn inte kan använda **inte fäller de andra**. Du får då *Klarade: 3 · kunde inte sparas: 1* och den felande raden ligger kvar i listan med orsaken i klartext (*Kunde inte sparas: Ange ett regelnamn, högst 100 tecken*) – resten är redan inflyttade och klara. SortBro har plats för högst åtta villkor per regel: ett filter med fler importeras med de åtta första och raden säger *3 villkor fick inte plats (SortBro har högst 8 per regel) – lägg till dem i regelredigeraren*. Ingenting tappas tyst.

Åt andra hållet gäller samma ärlighet: regler med fördelningar (olika mål per ämne), årsmappar eller läsläge skrivs som vanliga filter, och rapporten under kortet säger vilka delar Thunderbird inte kan ta emot. Villkor på årtal (*före/efter innevarande år*) och regler utan villkor skrivs inte alls – i stället står det vilka de är.

**Kontoadressen:** Thunderbird skriver mottagningen som en full adress, till exempel `imap://anna%40exempel.se@imap.exempel.se/Ekonomi/Fakturor`. SortBro lär sig ditt kontos adress när du importerar en filterfil en gång, sparar den lokalt i dina inställningar och återanvänder den – klistrar du in den för hand en gång kommer du också undan med det. Adressen måste börja med `imap://`, `mailbox://` eller `pop3://`; allt annat avvisas med en begriplig rad i stället för att hamna i filen. För ett lokalt konto skrivs `mailbox://nobody@Local%20Folders/…` automatiskt. Saknas adressen blir det ingen fil – och kortet säger precis vad som fattas i stället för att skriva något påhittat.

## Arkivering – och varför olästa mejl kan vänta

SortBro arkiverar **ingenting av sig självt**. Det finns ingen inbyggd årsarkivering som körs i bakgrunden: en regel gör precis det du har ställt in, och inget mer.

- **Arkivera äldre mejl** (🗄️ i mallraden) fyller i *Datum · Är äldre än 90 dagar* och väljer en mapp som heter *Arkiv*/*Archive* om den finns. Ändra 90 till valfritt antal dagar. Åldersvillkoret rullar framåt av sig självt.
- **Årsmappar är ett valfritt tillval per regel – aldrig obligatoriskt.** Kryssrutan **Valfritt: lägg varje år i en egen årsmapp under målmappen** (steg 3) är **avstängd som standard** och kan **alltid kryssas av igen**: regeln flyttar då till den vanliga målmappen. Inga mallar och inga snabbfilter slår på årsmappar, och en målmapp som redan *är* en årsmapp (t.ex. `Arkiv/2025`) får aldrig en årsmapp inuti sig. Kryssar du i den hamnar tidigare års mejl i `Arkiv/2023`, `Arkiv/2024`, `Arkiv/2025` och så vidare. Mappen skapas automatiskt när den behövs (högst tolv per session); går det inte att skapa används den vanliga målmappen i stället och inget mejl tappas bort. Mejl som redan ligger i rätt årsmapp köas aldrig om.
- **Villkoren *Är före/efter innevarande år*** finns kvar i villkorslistan för dig som vill bygga en egen årssregel. De behöver inget värde alls: de jämförs med kalenderns innevarande år vid varje körning, så regeln fortsätter betyda ”tidigare år” även nästa år.

### Olästa mejl: rutan bestämmer

Kryssrutan **Flytta även olästa mejl direkt** i steg 3 styr läsläget för regeln:

- **Kryssad** → olästa mejl som matchar regeln flyttas **direkt**, utan att vänta på att bli lästa. Det gäller i alla mappar regeln söker i, inte bara i Inkorgen. Flytten sker omedelbart när mejlet kommer in eller vid nästa svep. Den andra kryssrutan, **Öppna olästa mejl i ett nytt fönster efter flytten**, är regelns eget val: kryssad öppnas mejlet i ett fönster när det väl ligger i målmappen, omarkerad ligger det kvar som oläst utan fönster. Valet görs alltså **när regeln skapas** och gäller bara den regeln – det är inte en global inställning. Är *Flytta även olästa mejl direkt* omarkerad är fönstervalet gråtonat, eftersom det då inte finns någon flytt att öppna efter.
- **Fönstret öppnas först när mejlet ligger i målmappen – och bara om det går att visa.** SortBro väntar in flytten och letar upp mejlet i målmappen (via Message-ID om id:t bytts). Sedan krävs **två** saker innan fönstret öppnas: mejlet ska ligga i målmappen **och** innehållet ska gå att läsa. Ett oläst mejl som ännu inte hämtats hem från servern skulle annars ge just en tom ruta. Går något av kraven inte igenom inom några sekunder öppnas **inget** fönster alls – hellre inget fönster än ett tomt – och orsaken skrivs i loggen: `olasta mejlet kunde inte hittas i malmappen` respektive `olasta mejlet gick inte att lasa an`. Även när fönstret öppnas skrivs ett kvitto (`olasta mejlet oppnat i malmappen` och `olasta mejlet visades i fonstret`), så loggen kan svara på om en tom ruta alls kom från SortBro eller från Thunderbird själv. Skulle id:t bytas i samma sekund som fönstret öppnas görs ett andra försök på mejlets identitet (Message-ID), som alltid följer med flytten.
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

- **▶ Kör alla regler nu** (knappen högst upp i regellistan, och *Kör alla regler nu* under **Flyttstatus**) sveper igenom alla aktiva regler direkt och berättar exakt vad som hände: hur många mejl som granskades, hur många som matchade samt hur många som köades eller väntar till nästa körning. Knappen läser alltid om **alla** mappar – den smarta mappcachen används bara av de tidsstyrda svepen, så en manuell körning kan aldrig gömma ett gammalt mejl. Inkommande mejl bevakas precis som vanligt under tiden.
- **🔎 Varför flyttas inte mejlen?** (i regelredigeraren) är en **läsbar diagnos** av just den regel du har öppen. Ingenting flyttas, ingenting köas och den fungerar även när bevakningen är pausad eller står i **Testläge**. Panelen svarar i klartext:
  - *redo* – antalet mejl som matchar och flyttas vid nästa körning,
  - *olästa och väntar* – matchande mejl som står på **Endast lästa mejl** och därför väntar tills du har läst dem,
  - *redan i målmappen* (eller i sin årsmapp),
  - *redan hanterade* – mejl som redan köats eller flyttats,
  - samt upp till fem exempelrader med ämne och avsändardomän.
  Avslutningsvis påminner panelen om regeln står i Testläge, om tillägget är pausat/stoppat eller om motorn har en fellåsning.
- **✔ Tillåt olästa mejl och flytta dem nu:** knappen i diagnospanelen (syns när det finns olästa mejl som matchar) kryssar i *Flytta även olästa mejl direkt*, sparar regeln och kör alla regler – ett klick i stället för att leta i inställningarna.
  - **Ett klick från OCH till ELLER:** är villkoren olika varianter av samma mejl (t.ex. "WordPress Alert", "Wordfence activity" och avsändaren `wordpress@`) räcker det att byta kombinationen till **Minst ett av villkoren** – då flyttas mejlet så snart **något** av villkoren stämmer. Diagnosen visar hur många mejl det skulle bli och har en knapp som gör bytet, sparar regeln och kör alla regler.
  - **Villkor för villkor:** panelen listar varje villkor med antal träffar (`0 träffar` i rött). Står regeln på **Alla måste stämma** och ett villkor har 0 träffar säger panelen rakt ut att ingenting kan matcha och att du ska ta bort villkoret eller byta till **Minst ett av villkoren**.
  - **Matchar ingenting visas i stället vad som ligger i mapparna:** panelen listar då upp till fem av de mejl som granskades (Inkorgen först) med ämne och avsändardomän, så att du kan jämföra med villkoren. Det är snabbaste sättet att se varför en regel inte nappar – t.ex. att ämnet är *"Wordfence activity for 12 oct, 2026…"* medan regeln letar efter texten *WordPress Alert*, och avsändaren är webbplatsens egen domän i stället för wordpress.com.

### Loggen: tyst när inget är fel, läsbar när något är det

- **Pausad eller stoppad bevakning larmar inte.** Automatiska svep (timintervallet och svepet vid start) hoppar över i tysthet när bevakningen är pausad eller stoppad – du får ingen "Tekniskt fel"-rad för att du själv har tryckt Pausa. Är motorn stoppad av ett fel skrivs **en** tydlig notis i stället för en rad per försök.
- **Starten tar igen det som missades.** SortBro sveper **alltid en gång när Thunderbird startar**, när bevakningen är på och det finns aktiva regler – även om timersvepet är avstängt. Var det senaste svepet mer än ett intervall sedan (datorn har varit avstängd, locket stängt, Thunderbird stängt över natten) sker det **direkt**, efter mindre än en sekund, i stället för att vänta en hel timme. Tiden för senaste svepet sparas i Thunderbirds lagring, så starten vet hur länge sedan det var även efter en omstart; sveprutan under **Flyttstatus** visar därför rätt nästa tid direkt. Raden `svepet ar forsenat sedan forra gangen - tar igen det direkt vid start` skrivs i loggen när det händer.
- **Ett svep som väntar för länge tas igen.** SortBro kontrollerar klockan varannan sekund. Upptäcker den ett glapp på över två minuter – datorn har sovit – och svepet samtidigt är försenat, körs det direkt i stället för att vänta på nästa intervall. Det är samma logik som vid start, bara utan omstart.
- **Övergående startfel försöks om i tysthet.** Direkt efter att Thunderbird har startat kan kontona svara "inte redo" ännu. Vid en start görs två tysta försök: efter 10 sekunder och efter ytterligare en minut. Under drift räcker ett försök efter 15 sekunder. Först därefter, om det fortfarande misslyckas, skrivs: *Tekniskt fel – Automatiskt svep misslyckades (sweep_error) – kontrollera att regelns käll- och målmappar finns kvar och går att skriva i.*
- **Svepraden i loggen säger varför inget flyttas.** Varje svep skriver `skannade=… matchade=… i_mal=… klara=… koade=…`: `matchade` är mejl som träffades av regeln, `i_mal` sådana som redan låg i målmappen/sin årsmapp och `klara` sådana som redan var hanterade. Är `matchade=0` finns det helt enkelt inget som matchar regeln.
- **▶ Kör alla regler nu väntar in en pågående körning** i stället för att rapportera noll: pågår redan ett svep (t.ex. startsvepet) väntar knappen in det och visar hela körningens siffror. Är bevakningen pausad eller stoppad säger knappen det rakt ut, och om ett svep verkligen fallerar visas felmeddelandet som en toast i stället för att tigas ihjäl. Varje klick ger exakt **en** körning och en rapport – knappen har bara en klickhanterare.

### Automatiskt varje timme – med bevakning kvar

**Kör alla regler automatiskt (rekommenderas)** under **Inställningar → Avancerat** kör samma svep automatiskt med valfritt intervall (steg om 15 minuter, standard **60 minuter = en gång i timmen**). Detta är *utöver* den händelsestyrda bevakningen: nya mejl som kommer in till Inkorgen hanteras direkt när de anländer, och olästa mejl som du just har läst flyttas så snart de har lämnat visningen. Intervallsvepet fångar upp allt övrigt – till exempel mejl som legat i andra mappar, mejl som blev lästa i ett annat program och regler som följer kalendern vid årsskiftet. Statusraden under **Flyttstatus** visar när nästa automatiska körning sker och att inkommande mejl bevakas hela tiden.

## Design, språk och årstider

- **Svenska & Engelska** växlas direkt i toppbaren (*SV · Svenska* / *EN · English*).
- **Ljust och mörkt läge** samt **årstidsteman** (*Auto · 🌸 Vår · ☀️ Sommar · 🍂 Höst · ❄️ Vinter*). Årstiden färgar gränssnittet, hälsningen, det dynamiska SVG-landskapet i hero-kortet, SortBro-logotypen och verktygsfältsikonen. *Auto* följer kalendern; ett manuellt val ligger kvar tills du ändrar det.
- **Animerad puls** på sifferkorten när antalet regler, köade mejl, flyttar eller matchningar ändras.
- **Stöd SortBro** finns både i gränssnittet och i `stod.html`: 100 % lokalt genererad Swish-QR (ISO/IEC 18004-verifierad, `C0721817177;…` samt kameravy med `swish://`), PayPal och Ko-fi. Inget låses upp av en gåva.

## Säkerhetsbromsen – när en regel plötsligt matchar för mycket

Ett enda stavfel i en regel kan flytta tusentals mejl. Säkerhetsbromsen finns för att det aldrig ska hända utan att du får säga till.

**Så fungerar den.** SortBro minns hur många mejl varje regel brukar flytta per svep (de tio senaste körningarna, bara antal – inget annat). Vill en regel plötsligt flytta **tio gånger fler** än vanligt, och minst **50** mejl, stoppas den mitt i svepet. Inget mer köas, väntande jobb som ännu inte påbörjats släpps, och en rad högst upp i fönstret säger vad som hänt:

> ⚠ **Säkerhetsbromsen stoppade en regel**
> Regeln "Google" ville flytta 837 mejl. Gränsen är 50 och regeln brukar flytta 5. Inget mer flyttas förrän du väljer.
> **[Flytta ändå] [Stäng av regeln]**

- **Flytta ändå** släpper spärren, kör regeln direkt och gör den nivån till regelns nya normalnivå – bromsen slår inte till igen för samma sak.
- **Stäng av regeln** stänger av den i stället. Inget mer flyttas, och regeln ligger kvar med alla inställningar så att du kan rätta och slå på den igen.
- Den stoppade regeln **sveps inte** och tar inte heller **inkommande mejl** förrän du har svarat. Andra regler fortsätter som vanligt.
- Nya regler har ingen historik. Deras gräns är därför 50 mejl i första svepet – det är precis då ett stavfel brukar upptäckas.
- Antalet räknar bara mejl som **faktiskt skulle flyttas**: sådant som redan ligger i målmappen kostar ingenting.
- Bromsen stängs av under **Inställningar → Avancerat**. Stängs den av släpps också alla stoppade regler direkt. Kvittot säger rakt ut vad som då kan hända: *"En felaktig regel kan då flytta hela inkorgen utan att fråga."*
- Stoppet skrivs i loggen som händelsen **Säkerhetsbromsen stoppade en regel**, med regelns namn, antalet, gränsen och hur många väntande jobb som släpptes.

## "Varför ligger det här mejlet här?"

Knappen **🔍 Varför ligger mejlet här?** i regellistan svarar på den fråga man ställer sig mest när man börjar lita på automatiken. Markera ett mejl i Thunderbird – i vilken mapp som helst – och tryck på knappen.

Panelen svarar på tre saker:

1. **Vilken regel som gäller** och vart mejlet skulle flyttas: *"Regeln 'Fakturor' gäller och skulle flytta mejlet till Jobb · Fakturor."*
2. **Vad som stoppar flytten**, om något gör det: mejlet är oläst men regeln flyttar bara lästa, mejlet visas just nu, det ligger redan i kön, det är redan hanterat, regeln är stoppad av säkerhetsbromsen, eller målmappen hittades inte.
3. **Varför ingen regel matchar**, när ingen gör det – med de tre närmaste reglerna och de villkor som fällde avgörandet: *"'Nyhetsbrev' – 1 av 3 villkor stämmer · Ämne innehåller nyhetsbrev – matchar inte."*

Under **Alla regler som prövas** listas varje regel med en rad: *matchar*, *matchar inte*, *annan mapp*, *avstängd* eller *stoppad*. Där ser man direkt om en annan regel tog mejlet före.

**Ett mejl som redan ligger i sin målmapp får också ett svar.** Då är det ingen konflikt att regelns källmapp är en annan – tvärtom är det förklaringen: *"Mejlet ligger i målmappen Jobb · Fakturor – det är hit regeln 'Fakturor' skickar det."* Förgreningar räknas: ligger mejlet i grenens mål, är det grenen som förklarar det.

Uppslaget **läser bara mejlets huvuden** (avsändare, ämne, datum, storlek, mapp och lässtatus). Det ändrar ingenting, flyttar ingenting och sparar ingenting. Det kräver ingen ny behörighet – `messagesRead` räcker, och det är samma behörighet som svepet redan använder.

## Konfliktvarning – två regler, samma mejl

Två aktiva regler kan matcha samma mejl och vilja skicka det till olika mappar. Då är det **ordningen** som avgör: svepet kör reglerna uppifrån och ned, och den första som matchar får mejlet. Det syns nu direkt i regellistan:

> ⚠ Kan krocka med "Fakturor" – båda kan matcha samma mejl (Domän). Den här regeln ligger först och vinner.

Den andra regeln får samma varning med omvänd förklaring: *"Den regeln ligger först och vinner. Flytta upp den här om den ska gälla i stället."* Pilarna i regellistan ändrar ordningen.

**Varningen är försiktig med flit.** Den visas bara när SortBro kan visa att båda reglerna *kan* träffa samma mejl:

- Reglerna måste läsa samma mapp (samma källmapp, eller en mapp som ligger i den kontoregel den andra regeln använder).
- Villkoren måste kunna gälla samtidigt. *Domän = gmail.com* och *Domän = hotmail.com* varnar aldrig, och inte heller *större än 100 kB* mot *mindre än 50 kB*.
- Reglerna måste ha **olika** målmappar. Samma mål är ingen konflikt – ordningen spelar då ingen roll.
- Avstängda regler räknas inte.

Villkoren jämförs som text och intervall: *börjar med anna@* och *innehåller anna@* kan båda stämma, men *börjar med anna@* och *börjar med bob@* kan aldrig gälla samma adress. En regel med **ELLER** prövas villkor för villkor – det räcker att ett av dem kan sammanfalla med den andra regeln.

## Provkörning – regeln räknar innan den flyttar

En ny regel är den enda som är osäker. Därför kan du i steg 3 kryssa **Provkör i 7 dagar innan regeln flyttar något**. Regeln är då aktiv och räknar som vanligt, men flyttar ingenting.

- **Provkörningen påverkar inte dina andra regler.** En regel i provkörning hoppas över när mejlen ska sorteras, så ett mejl som skulle ha fångats av en provkörande regel går vidare till nästa regel precis som om den inte fanns. Inget mejl blir liggande för att du testar.
- **Räkningen är ärlig.** SortBro sparar fingeravtrycket på varje mejl som regeln skulle ha flyttat, så samma mejl räknas bara en gång – även om svepet går varje timme i en vecka.
- **Säkerhetsbromsen rörs inte.** En provkörning flyttar inget, och räknas därför aldrig som regelns normalnivå.
- **I regellistan** bär regeln märket **TEST · 3 dagar kvar**.
- **När veckan är slut** dyker en rad upp ovanför regellistan: *Regeln "Fakturor" skulle ha flyttat 34 mejl.* med tre val – **Aktivera regeln**, **Förläng 7 dagar** eller **Stäng av regeln**. Ingenting händer förrän du svarar.

Kryssrutan sparar ett slutdatum i regeln. Den som redan har en pågående provkörning ser dagarna kvar bredvid rutan, och att kryssa ur den avslutar provkörningen direkt.

## SortBro lär av dina egna flyttar

När du själv drar mejl till en mapp lägger SortBro märke till det. Efter **tre likadana flyttar inom sju dagar** – samma avsändardomän till samma mapp – dyker en rad upp i regellistan:

> **Lär av din flytt** – Du har flyttat 3 mejl från klarna.se till Fakturor. Vill du att SortBro sköter det åt dig?

med **Skapa regel**, **Inte nu** och **Sluta föreslå**.

- **Bara det nödvändiga sparas:** avsändardomän, källmapp, målmapp, antal och tidpunkt. Aldrig ämnesrad, namn, adress eller mejltext – och posterna gallras automatiskt efter sju dagar.
- **SortBros egna flyttar räknas aldrig.** Bara flyttar som du gjort själv i Thunderbird.
- **Papperskorgen och Skräppost lär inte ut något.** En flytt dit är en rensning, inte en sortering.
- **Ingenting skapas utan ett klick.** Regeln som skapas får domänvillkoret *är lika med* och målmappen du själv använde; den granskas innan den sparar något. Finns redan en likadan regel skapas ingen dubblett.
- **Sluta föreslå** stänger av funktionen permanent tills du slår på den igen (den finns kvar i inställningarna).

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

## Startsvepet – vad som händer när Thunderbird startar

| Situation | Vad SortBro gör |
| --- | --- |
| Senaste svepet är äldre än intervallet (t.ex. över natten) | Sveper **direkt** (800 ms efter start) och loggar varför |
| Nyligen svept | Sveper en gång efter 3 sekunder, så att kontona hinner svara |
| Timersvepet avstängt | Sveper **ändå en gång vid start** – det är då kön från förra gången tas om hand |
| Bevakningen pausad eller stoppad | Ingenting. Starten är tyst, precis som resten |
| Datorn har sovit | Klockglappet upptäcks inom två sekunder; är svepet försenat körs det direkt |
| Kontona svarar inte ännu | Två tysta försök (10 s och 60 s) innan något skrivs i loggen |

## Reglerna säkras automatiskt

Dina regler är det enda som inte går att återskapa. Därför skriver SortBro en **säkerhetskopia av reglerna** till Hämtade filer, utanför Thunderbirds profil. Backuperna har sin egen undermapp (`Lasfilter/Regelbackuper/`) så att de aldrig blandas ihop med loggfilen eller annat i appmappen:

- **`Hämtade filer/Lasfilter/Regelbackuper/sortbro-regler-backup.json`** – alltid den senaste uppsättningen. Den skrivs om när du har sparat en regeländring, och en gång vid start.
- **`Hämtade filer/Lasfilter/Regelbackuper/sortbro-regler-ÅÅÅÅ-MM-DD.json`** – en daterad **veckokopia**, en per vecka (ISO-vecka, måndag–söndag). De senaste **12 veckorna** behålls; äldre veckofiler städas bort automatiskt (bara SortBros egna daterade filer i den egna undermappen – din manuella export och loggfilen rörs aldrig).
- Veckan som senast fick en kopia sparas i Thunderbirds lagring, så en omstart mitt i veckan inte skriver en extra kopia. Har Thunderbird varit stängt över en veckogräns skrivs kopian vid nästa start.

Kopieringen sker bara när något faktiskt har ändrats, så reglerna skrivs inte om i onödan. Vill du ha en färsk kopia direkt finns knappen **⇩ Backa upp reglerna nu** under **Inställningar → Avancerat**, tillsammans med kryssrutan **Backa upp reglerna automatiskt** (på som standard).

**Varför utanför profilen?** Om tillägget en dag är borta ur Thunderbird – avinstallerat, avstängt av signaturkontrollen eller ersatt av en nyare version – så följer tilläggets egna ögonblicksbilder med i fallet. Filen i Hämtade filer ligger kvar på disken. Du hämtar tillbaka allt genom att importera den under **Regler** (*Importera*), precis som en vanlig export.

Filen har samma format som den manuella exporten (`format: lasfilter-rules`), så båda vägarna fungerar lika: exportera manuellt eller lita på den automatiska kopian. Loggen får en rad varje gång kopian skrivs (`reglerna backade upp: 12 st …`), och om skrivningen misslyckas står det i loggen i stället för att felet tigs ihjäl.

## Var filerna hamnar – allt i appmappens undermappar

SortBro skriver aldrig något löst i Hämtade filer och aldrig utanför appmappen. Allt hamnar i **`Hämtade filer/Lasfilter/`** och dess undermappar, en mapp per sort:

| Mapp | Innehåll | Skapas av |
| --- | --- | --- |
| `Hämtade filer/Lasfilter/Loggar/` | `lasfilter-logg.txt` – den tekniska loggen, och `sortbro-tekniklogg-ÅÅÅÅ-MM-DD.json` när du trycker *Exportera logg* | loggrutan under Inställningar → Avancerat, och *Exportera logg* under Aktivitet |
| `Hämtade filer/Lasfilter/Regelbackuper/` | `sortbro-regler-backup.json` + en daterad veckokopia | automatisk säkerhetskopia en gång per vecka, eller *⇩ Backa upp reglerna nu* |
| `Hämtade filer/Lasfilter/Regler/` | `sortbro-regler-ÅÅÅÅ-MM-DD.json` (alla regler) och `sortbro-regel-<namn>.json` (en regel) | *Exportera* i Regler |
| `Hämtade filer/Lasfilter/Filterfiler/` | `msgFilterRules.dat` – filterfilen du själv kopierar in i profilen | *Skriv ut dina regler som filterfil* i Regler |

**Samma sökvägar på Windows, macOS och Linux.** Sökvägarna skrivs med `/` och läggs under systemets nedladdningsmapp, som ligger i användarens hemkatalog på alla tre systemen – `%USERPROFILE%\Downloads` på Windows, `~/Downloads` på macOS och Linux (och `Hämtade filer` heter mappen på svenska Windows). Under mappen skapas undermapparna automatiskt av Thunderbirds nedladdnings-API, precis som när webbläsaren sparar en fil i en undermapp. Sökvägarna kommer från en enda källa i koden och visas i gränssnittet, så att texten och filen aldrig kan peka på olika ställen.

Exporterna sparar **utan att fråga** var filen ska ligga: de går till mappen ovan och kvittot visar hela sökvägen. Vill du i stället välja plats själv vid export, säg till – då blir det en kryssruta för det.

## Uppdatera tillägget på din dator

**Första gången måste du installera filen för hand.** Den version du har installerad nu vet inte var den ska leta efter nya versioner — den kunskapen kom först med den här byggden. Efter det sköter Thunderbird uppdateringarna själv.

### En gång, för hand

Hämta `SortBro-Thunderbird.xpi` från **Releases** — inte från grenen eller filistan:

`https://github.com/Tokke2/Lasfilter/releases/latest`

Filen ligger som en bifogad fil (asset) på releasen `v1.0.0`. Det är samma fil som automatiken nedan hämtar, alltså den yta som faktiskt är avsedd för nedladdning.

1. Thunderbird → **Verktyg → Tillägg och teman** (Ctrl+Skift+A)
2. **Kugghjulet** uppe till höger → **Installera tillägg från fil…**
3. Välj filen och starta om Thunderbird.

**Avinstallera inte först.** Regler, inställningar, logg och kö ligger i tilläggets eget lager inuti Thunderbird, och det lagret töms vid en avinstallation. Filen har samma id som den installerade versionen, så Thunderbird byter ut den gamla rakt över. Tryck gärna *⇩ Backa upp reglerna nu* före uppdateringen; det kostar tre sekunder.

Kontrollsumman för filen ligger i `SortBro-Thunderbird.xpi.sha256` om du vill kontrollera den manuellt.

### Sedan automatiskt

Manifestet innehåller en uppdateringsadress:

```
https://github.com/Tokke2/Lasfilter/releases/download/v1.0.0/updates.json
```

Den pekar på en **release-tillgång**, inte på en gren och inte på `main`. `updates.json` talar om vilken version som är nyast, var XPI-filen ligger och vilken SHA-256 den har — och även XPI-länken är en release-tillgång:

```
https://github.com/Tokke2/Lasfilter/releases/download/v1.0.0/SortBro-Thunderbird.xpi
``` Thunderbird frågar den ungefär **en gång i dygnet**, och direkt när du väljer *Sök efter uppdateringar* i kugghjulsmenyn i Tillägg. Hittar den en högre version hämtas filen, kontrolleras mot hashen och installeras vid nästa omstart. Inget mer klickande.

Tre saker måste stämma vid varje släpp, annars uteblir uppdateringen **tyst**:

1. **Versionen i `manifest.json` måste vara högre** än den installerade. Thunderbird jämför versionsnummer, inte filinnehåll — en ny fil med samma nummer räknas inte som en uppdatering.
2. **`updates.json` måste ha samma version och samma SHA-256** som den XPI som `update_link` pekar på.
3. **Id:t måste vara exakt** `lasfilter@lokala-verktyg.invalid` — det är nyckeln i `updates.json`.

Alla tre kontrolleras av tester i `tester/safety.test.cjs` vid varje bygge, tillsammans med en kontroll att versionsnumret i gränssnittets sidfot är samma som i manifestet.

**Varför release och inte `main`:** en gren är ett arbetsdokument som ändras varje gång något sparas, medan en release är en fryst version med filer som hör ihop. SortBro uppdaterar bara från `/releases/download/v1.0.0/`, så ett pågående arbete i repot kan aldrig bli en uppdatering av misstag. Samma release-tagg används varje släpp och filerna byts ut på plats, så adressen är stabil.

Ett test i `tester/safety.test.cjs` avvisar bygget om adressen skulle peka på `main`, på en rå fil (`raw.githubusercontent.com`) eller på olika taggar i manifestet och `updates.json`. GitHub kan cacha release-filer i några minuter, så en alldeles färsk uppdatering kan dröja en stund innan Thunderbird ser den.

### Filerna läggs på releasen automatiskt

Inget laddas upp för hand. När versionstaggen flyttas körs `.github/workflows/release-assets.yml`, som kontrollerar att `SortBro-Thunderbird.xpi.sha256` stämmer med filen och sedan lägger **XPI:n, kontrollsumman och `updates.json`** som bilagor på releasen (och skriver över förra omgångens filer). Skulle releasen saknas skapas den. Därför är `releases/download/v1.0.0/...` alltid samma tre filer som ligger i repot på taggen — och det är den adressen Thunderbird använder.

**Signering:** Thunderbird kräver i dag inte signerade tillägg (till skillnad från Firefox), så det här fungerar med vår osignerade fil — det är samma förutsättning som gjorde att du kunde installera den för hand. Skulle Mozilla börja kräva signatur måste XPI:n signeras hos AMO som *unlisted*, och då måste `update_url` samtidigt tas bort: AMO avvisar paket som pekar på en egen uppdateringsfil.

## Om tillägget försvinner ur Thunderbird

**SortBro avinstallerar aldrig sig självt.** Tillägget innehåller inga anrop som kan ta bort eller stänga av ett tillägg (`uninstallSelf`, `management.uninstall`, `management.setEnabled`) och saknar medvetet behörigheten `management` – utan den är en avinstallation tekniskt omöjlig inifrån. Det kontrolleras av ett eget test vid varje bygge (`tester/safety.test.cjs`).

Om tillägget ändå är borta vid nästa start är det Thunderbird som har stängt av det, och det finns två vanliga orsaker:

- **Tillfällig installation (utvecklingsläge).** Ett tillägg som lästs in med *Läs in tillfälligt tillägg* lever bara till nästa omstart. Det ser ut som om tillägget avinstallerade sig, men det är så en tillfällig inläsning fungerar.
- **Sidoladdad fil.** Ligger XPI-filen i Thunderbirds profilmapp (`extensions/`) i stället för att vara installerad via Tilläggshanteraren kan Thunderbird stänga av den – särskilt om signaturkontrollen (`xpinstall.signatures.required`) är påslagen.

SortBro läser sin egen installationstyp vid start och säger till i klartext i stället för att du ska behöva gissa:

- **En varningsrad högst upp i gränssnittet** när installationen är tillfällig eller sidoladdad, med besked om hur du gör den permanent: *Tillägg → kugghjulet ⚙ → Installera tillägg från fil…* (välj XPI-filen). Raden kan döljas och kommer tillbaka nästa gång gränssnittet öppnas.
- **Loggfilens huvud** får raden `Installation: <typ>` (`normal`, `development`, `sideload`, `admin` eller `other`), och startraden skriver `thunderbird <version> sortbro <version> installation <typ>`. Är tillägget borta nästa gång kan du alltså läsa i `Hämtade filer/Lasfilter/Loggar/lasfilter-logg.txt` hur det var installerat – och se om en Thunderbird-uppdatering kom strax innan.

Installationstypen läses med `management.getSelf()`, som enligt Thunderbirds egen dokumentation fungerar **utan** någon ny behörighet. Behörighetslistan är oförändrad. Och även om tillägget stängs av förlorar du ingenting: reglerna ligger redan i `Hämtade filer/Lasfilter/Regelbackuper/` och importeras tillbaka under **Regler**.

## Teknisk logg

Händelserna skrivs till aktivitetssidan och kan exporteras som JSON under Aktivitet. Händelserna är start, sparade inställningar, sparade regler, återställda jobb, köade, simulerade prov, bekräftade flyttar, överhoppade, spärrade köer och generiska fel. Rensning sker efter 30 dagar, högst 5000 rader.

Samma händelser skrivs också till en läsbar textfil – **`Hämtade filer/Lasfilter/Loggar/lasfilter-logg.txt`** – som uppdateras varje gång något händer. Den har två uppgifter utöver aktivitetslistan:

- **Huvudet visar båda versionerna och installationstypen** (*Version:* tilläggets, *Thunderbird:* programmets, *Installation:* hur tillägget installerades), och den första raden efter en start är `thunderbird <version> sortbro <version> installation <typ>`.
- **Den är det sista spåret om tillägget skulle försvinna** ur Thunderbird. Filen ligger kvar på disken även om tillägget tas bort, så de sista raderna visar när det hände och i vilken Thunderbird-version det senast kördes – till exempel om en uppdatering av Thunderbird kom strax innan.

## Gränser som du bör känna till

- Flytten bekräftas av Thunderbirds lokala flytthändelse, inte av en separat kvittens från din IMAP-server. Kontrollera mål- och källmapp i Thunderbird efter aktivering.
- Om ett annat filter eller en annan åtgärd redan har flyttat eller raderat meddelandet registreras det som överhoppat eller spärrat, beroende på läge.
- Röda dagar, frånvaro och arbetsflöden hanteras inte. Ställ in paus manuellt vid behov.
- Återställning efter omstart fungerar endast för meddelanden med stabilt Message-ID och entydig träff i källmappen.

Testade miljöer och resultat finns i `TESTRESULTAT.md`. Din egen Windows/IMAP-miljö är ett separat godkännandesteg; börja med en provmapp och testläge.

## Nyheter i 1.0.0 (SortBro)

- **Motor och kö:** max 100 väntande jobb i kön, och flyttar sker parallellt medan kön byggs (svepet väntar aldrig på en full kö). När kön når 100 töms den innan fler läggs till.
- **Smart mapp-cache:** tomma mappar och mappar som är oförändrade sedan förra svepet utan träffar hoppas över på under 1 ms i stället för att skannas om. Cachen invalideras vid nya mejl, ändrad lässtatus, genomförd flytt och regeländring, så inget kan missas. Den är dessutom knuten till regelversionen: sparar du en regel läses alla mappar om, så ett ändrat villkor även fångar gamla mejl.
- **Säker IMAP-flytt:** progressiv verifiering via flytthändelsen och kontroll i mål- och källmapp. Gamla osäkra försök rensas vid omstart och ger inga falska `uncertain_move`-stopp.
- **Inget popup-kaos vid mass-svep:** under ett pågående svep, eller när kön redan är lång, öppnas aldrig nya fönster – mejlen flyttas och behålls bara som olästa.
- **Regler och utbyte:** upp till 200 regler med direktkontroller per regelrad, snabbskapande, sex 1-klicksmallar (inkl. 🗄️ Arkivera äldre mejl), egen mappskapning, högerklicksmeny samt JSON-export/import (ersätt eller lägg till) med automatisk mappmatchning.
- **Fler villkor:** Till, Kopia (Cc), Storlek (kB) och Datum (dagar eller årtal) utöver avsändare, domän och ämne.
- **Valfria årsmappar:** årsarkivering är inget förval utan en kryssruta per regel (avstängd som standard). Kryssar du i den hamnar tidigare års mejl i `Arkiv/2025` – annars flyttas mejlen till den målmapp du valt.
- **Olästa mejl flyttas när rutan är kryssad:** *Flytta även olästa mejl direkt* gör att matchande olästa mejl flyttas med en gång i alla mappar, i stället för att vänta tills de är lästa. Är *Öppna flyttade olästa mejl i nytt fönster* också kryssad öppnas mejlet **efter** flytten och alltid i målmappen – aldrig som en tom ruta.
- **Kör alla regler nu:** en knapp sveper igenom alla aktiva regler direkt och rapporterar granskade mejl, cachade mappar, matchningar och köade flyttar.
- **Thunderbirds egna filter:** importera din `msgFilterRules.dat` och få dina befintliga filter som färdiga SortBro-regler – eller exportera dina SortBro-regler som en filterfil Thunderbird förstår. Det som inte kan översättas står rakt ut per regel, och ingen fil skrivs utan känd kontoadress.
- **Snabbregeln (⚡ Skapa regel på tio sekunder):** klickbara förslag från Inkorgen (avsändare och ämnesord med antal), *Hämta från markerat mejl* för att fylla i avsändaren direkt från det mejl du har markerat, live-räkning av hur många mejl regeln träffar, en mening i klarspråk om vad regeln gör och två knappar – *Skapa regel* eller *Lägg till och flytta nu*. Villkoret räknas ut automatiskt: full domän/adress blir exakt träff, ett löst ord blir *innehåller*.
- **Varför flyttas inte mejlen?:** läsbar diagnos per regel som förklarar om mejlen väntar på att bli lästa, redan ligger i målmappen, redan är hanterade eller inte matchar villkoren – med exempelrader och påminnelse om Testläge/paus.
- **Automatiskt varje timme:** standardintervallet är 60 minuter och körs vid sidan av den händelsestyrda bevakningen av inkommande mejl. Statusraden visar nästa automatiska körning.
- **Säkerhetsbromsen:** en regel som plötsligt vill flytta tio gånger fler mejl än vanligt – och minst 50 – stoppas innan något flyttas. Raden högst upp erbjuder *Flytta ändå* eller *Stäng av regeln*, och ingenting rör sig förrän du har svarat.
- **Konfliktvarning:** två aktiva regler som kan träffa samma mejl och skicka det till olika mappar får en varning i regellistan, med förklaring om vilken som ligger först och vinner. Analysen är försiktig och varnar bara när den kan visa att båda verkligen kan matcha.
- **"Varför ligger det här mejlet här?":** markera ett mejl och få veta vilken regel som gäller, vart det skulle flyttas och vad som i så fall stoppar – villkor för villkor, med de närmaste reglerna när ingen matchar.
- **Provkörning per regel:** kryssa *Provkör i 7 dagar* och regeln räknar vad den skulle ha flyttat utan att röra något. Efter veckan väljer du aktivera, förlänga eller stänga av – och räkningen är exakt, aldrig samma mejl två gånger.
- **Lär av din flytt:** flyttar du själv tre mejl från samma domän till samma mapp föreslår SortBro en regel. Bara domän, mapp och antal sparas, och inget skapas utan ett klick.
- **Fönstervalet vid regelskapning:** *Öppna olästa mejl i ett nytt fönster efter flytten* är regelns eget val, gråtonat när regeln inte flyttar olästa mejl.
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
