# Läsfilter för Thunderbird – version 1.3.2

Ett Thunderbird-tillägg med ett eget svenskt gränssnitt. Det flyttar ett mejl som matchar dina regler först när Thunderbird har markerat det som läst **och** det inte längre visas i någon mejlflik eller något meddelandefönster. Tillägget börjar alltid i **testläge utan flyttar**.

## Skillnaden mot vanliga filter

Thunderbirds egna filter körs när mejlet kommer in. Detta tillägg körs händelsestyrt via Thunderbirds egna gränssnittsprogram (läst-markering, visning, flytthändelse) och ändrar därför **inte** `msgFilterRules.dat`, `prefs.js` eller någon profilfil. Det samexisterar med dina befintliga filter; stäng av filter som redan flyttar samma mejl vid mottagandet, eftersom tillägget inte blockerar dem.

”Läst” är Thunderbirds läst-markering, inte en bedömning av att du har läst färdigt. Ett mejl som öppnas i en flik eller ett meddelandefönster räknas som läst, men flyttas först när alla visningar är stängda och två sekunder har gått.

## Installation

1. Kontrollera att Thunderbird är **140 eller senare** (Hjälp → Om Thunderbird).
2. Öppna Inställningar → Tillägg och teman → kugghjulet → **Installera tillägg från fil…** och välj `Lasfilter-Thunderbird.xpi`.
3. Tillåt behörigheterna när Thunderbird frågar. De förklaras under ”Integritet”.
4. Starta om Thunderbird om det efterfrågas. Klicka sedan på kuvertikonen i verktygsfältet eller öppna Inställningar → Tillägg → Läsfilter → Inställningar.
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

## Säkerhetsmekaniker

- Högst ett flyttförsök per meddelande. Journalen skrivs före försöket och rensas inte förrän Thunderbird har bekräftat flytthändelsen. Ett avbrutet eller osäkert försök pausar motorn och upprepas inte.
- Vid osäkerhet eller ändrade regler rensas väntande jobb; redan registrerade spärrar rensas endast manuellt efter din egen kontroll.
- Regeländringar och växling mellan test/flytt ökar regelversionen och gör gamla köade jobb ogiltiga.
- Flyttar godkänns bara mellan vanliga mappar i samma konto. Specialmappar, sökmappar, skrivskydd och regelkedjor med loopar avvisas. Vid ett fel görs ingen kopiering som reserv.
- Oläst-markering, ändrad källmapp eller en öppnad visning stoppar en väntande flytt.
- Kön är begränsad till 500 väntande jobb. Väntande jobb kan återställas efter omstart om Message-ID, datum, storlek och källmapp är entydiga; ett gammalt sessions-id återanvänds aldrig.

## Integritet och behörigheter

Behörigheter som Thunderbird visar: läsa konton/mappar, läsa meddelandehuvuden, flytta meddelanden, markera läst vid återställning, skapa mappar för tester i utvecklingsversionen (finns inte i den slutliga filen), lagra egna inställningar lokalt och spara exporterade filer.

Lagrade data är egna regelinställningar, fem regelkopior, köjournal och en teknisk händelselogg med endast räknare. Ingen logg eller export innehåller mejltexter, ämnesrader eller fullständiga adresser. Allt lagras i Thunderbirds eget tilläggsutrymme. Tillägget öppnar inga nätverksanslutningar.

## Teknisk logg

Händelserna skrivs till aktivitetssidan och kan exporteras som JSON under Aktivitet. Händelserna är start, sparade inställningar, sparade regler, återställda jobb, köade, simulerade prov, bekräftade flyttar, överhoppade, spärrade köer och generiska fel. Rensning sker efter tio dagar, högst 500 rader.

## Gränser som du bör känna till

- Flytten bekräftas av Thunderbirds lokala flytthändelse, inte av en separat kvittens från din IMAP-server. Kontrollera mål- och källmapp i Thunderbird efter aktivering.
- Om ett annat filter eller en annan åtgärd redan har flyttat eller raderat meddelandet registreras det som överhoppat eller spärrat, beroende på läge.
- Röda dagar, frånvaro och arbetsflöden hanteras inte. Ställ in paus manuellt vid behov.
- Återställning efter omstart fungerar endast för meddelanden med stabilt Message-ID och entydig träff i källmappen.

Testade miljöer och resultat finns i `TESTRESULTAT.md`. Din egen Windows/IMAP-miljö är ett separat godkännandesteg; börja med en provmapp och testläge.

## Nyheter i 1.3

- **Målmapp i vilket konto som helst:** du kan nu välja en målmapp i ett annat konto än källmappen, till exempel flytta från IMAP-inkorgen till ett lokalt arkivkonto. Tillägget kontrollerar fortfarande att källmappen tillåter borttagning och att målmappen tillåter mottagning innan något köas, och loopkontrollen gäller som tidigare. Skanningen av befintliga mejl rör fortfarande bara det konto regeln läser från.
- **Timvis automatisk flytt:** alternativet *Flytta automatiskt varje timme* sveper igenom aktiva regler en gång i timmen. Standard är på. I testläge räknas träffarna som prov och inget flyttas.
- **Direktläge, även för olästa:** i inställningarna kan du byta flyttsätt från *När mejlet är läst och stängt* till *Direkt, även olästa*. I direktläge flyttas nya matchande mejl så fort de anländer, utan att vänta på att du läser dem.
- **Tydlig indikator:** när ett oläst mejl flyttas i direktläge öppnas det automatiskt i ett eget fönster, så att du ser vad som flyttades och kan läsa det där. Stäng fönstret när du är klar; mejlet ligger redan i målmappen. Indikatorn kan stängas av, men direktläget rekommenderas inte utan den.
- **Snabbtangent för svep:** *Ctrl+Shift+L* kör ett svep direkt. Ändra tangenten under Verktyg → Tillägg → Hantera tilläggssnabbkommandon i Thunderbird.

## Nyheter i 1.1 och 1.2

- **Finfördelning i en regel:** under målmappen kan du lägga till fördelningar, exempelvis *Ämne innehåller Faktura → Ekonomi/Fakturor* och *Ämne innehåller Order → Order*. Första träffen styr; övriga mejl går till regelns vanliga målmapp. Fördelningar räknas in i loop- och mappkontrollerna.
- **Sortera befintliga lästa:** knappen skannar regelns kontos faktiska mappar, inklusive undermappar men utom regelns målmappar (grundmål och fördelningar), efter lästa mejl som matchar regelns villkor oavsett var de ligger nu. Träffar köas med sin aktuella mapp som källa och flyttas till regelns mål genom samma skyddsvägar. I testläge räknas träffar som prov. Olästa mejl hoppas över i läsläget. Högst 500 meddelanden per skanning.
