# 25 nya förslag för SortBro

© Rickard Längkvist · underlag till version efter 1.0.37

> **Detta är förslag, inte byggda funktioner.** Enligt vår arbetsordning byggs bara de nummer du väljer. Varje förslag är kontrollerat mot nuvarande kod och mot de krav som gäller: allt ska fungera lokalt i Thunderbird, utan nya behörigheter, utan molntjänster och utan oåterkalleliga massåtgärder.

## Hur listan är gjord

Underlaget är en genomgång av SortBros nuvarande funktioner, Thunderbirds filter-API och de vanligaste behoven hos mejlsorterare som SaneBox, Clean Email, Gmail/Outlook-filter och Thunderbirds egna filter. Konkurrenterna är oftast molntjänster eller leverantörsspecifika; SortBros lucka är att göra motsvarande saker **lokalt, providersoberoende och med testläge först**. Det är ingen formell marknadsundersökning, utan en teknisk och användarnära prioritering.

**Gemensamma krav för alla förslag**

- Inga nya behörigheter. Nuvarande `accountsRead`, `accountsFolders`, `messagesRead`, `messagesMove`, `messagesUpdate`, `menus`, `storage` och `downloads` räcker.
- Inga mejltexter eller adresser lämnar datorn. Inga externa AI- eller betaltjänster.
- Allt som flyttar, rensar eller ändrar regler ska först kunna granskas i testläge och därefter kunna ångras eller återställas.
- Ett förslag får aldrig tyst aktivera en avstängd regel, ändra målmapp eller kringgå paus, läsvillkor, kögräns eller osäker flytt.

## Prioritering

- **P1** – hög användarnytta och låg/medelrisk; bör vara nästa utvecklingssteg.
- **P2** – tydlig nytta men kräver mer design eller API-verifiering.
- **P3** – värdefullt för vissa användare; kan vänta.
- **Insats:** S = liten (1–2 dagar), M = medel (cirka en vecka), L = stor (mer än en vecka inklusive tester).

## Sammanfattning

| # | Förslag | Nytta | Prio | Insats | Differentiering |
|---:|---|---|:---:|:---:|:---:|
| 1 | Ångra senaste flytten | Trygghet vid felregel | P1 | M | Hög |
| 2 | Regelversioner med diff | Förstå och backa ändringar | P1 | M | Hög |
| 3 | Regelgranskning före körning | Fångar breda/farliga regler | P1 | M | Hög |
| 4 | Testlabb för alla regler | Se hela resultatet utan flytt | P1 | L | Hög |
| 5 | Krock- och dubblettassistent | Städar överlappande regler | P1 | M | Medel |
| 6 | Schemalagda regler | Semester, helger, tidsfönster | P1 | M | Hög |
| 7 | Snooze till datum | Skjut upp mejl lokalt | P1 | M | Hög |
| 8 | Screener för nya avsändare | Granska förstagångsavsändare | P1 | L | Hög |
| 9 | VIP-skydd | Skydda viktiga avsändare | P1 | S | Hög |
| 10 | Fler rubrikfält | List-ID, Reply-To, Auto-Submitted | P1 | M | Hög |
| 11 | Plus-adresser och IDN | Fler regler träffar rätt | P1 | S | Medel |
| 12 | Regel på vanlig svenska | Bygg regler utan fältkunskap | P2 | L | Hög |
| 13 | Trådmedvetna regler | Flytta hela konversationer | P2 | L | Hög |
| 14 | Uppföljning utan svar | Hitta obesvarade trådar | P2 | M | Hög |
| 15 | Massredigera regler | Snabbare underhåll | P1 | M | Medel |
| 16 | Import från Gmail/Outlook | Flytta in befintliga filter | P2 | L | Hög |
| 17 | Mapphälsa och reparation | Hittar trasiga mål/saknade mappar | P1 | M | Hög |
| 18 | Kontomigrering | Behåll regler vid kontobyte | P2 | M | Hög |
| 19 | Kvarhållning av gammal post | Städa utan att radera direkt | P2 | L | Hög |
| 20 | Veckorapport i appen | Lugn överblick utan popup | P2 | S | Medel |
| 21 | Prestandapanel | Hitta långsamma mappar/konton | P2 | M | Medel |
| 22 | Revisionslogg för regler | Full spårbarhet lokalt | P2 | S | Medel |
| 23 | Krypterad portabel backup | Flytta hela profilen säkert | P2 | M | Hög |
| 24 | Sparade vyer för regler | Snabb filtrering i vardagen | P3 | S | Medel |
| 25 | Tillgänglighets- och tangentbordsläge | Fungerar för fler, snabbare | P1 | M | Medel |

---

## 1. Ångra senaste flytten

**Vad:** En lokal flyttjournal som visar de senaste flyttarna med tid, regel, källa och mål. En knapp återställer en hel körning eller enstaka mejl till källmappen.

**Varför:** Ett felaktigt villkor kan flytta många mejl. I dag finns testläge och diagnos, men ingen väg tillbaka efter en riktig flytt. Det är det vanligaste trygghetsönskemålet vid automatiskt sorterande verktyg.

**Konkurrenslucka:** Molntjänster har ibland papperskorg eller ångra, men sällan kopplat till en lokal regel och ett lokalt testläge. Thunderbirds egna filter har ingen ångra-funktion.

**Så här:** Flyttjournalen innehåller redan källa, mål, regel, `headerMessageId`, datum och tiden `created`, men posten tas bort när flytten har bekräftats. Utöka den med en kortlivad, trimbar historik över bekräftade flyttar och återställ via samma verifierade flyttväg som vanligt – aldrig direkt mot IMAP. Sök i källmappen efter `headerMessageId` och datum före återställning.

**Skydd:** Endast flyttar som SortBro själv har gjort, inom en tidsgräns (t.ex. 24 timmar). Saknade eller ändrade mejl hoppas över med tydligt besked. Återställning kräver bekräftelse och loggas som en egen händelse.

**Prio:** P1 · **Insats:** M · **Beroende:** ingen ny behörighet.

## 2. Regelversioner med diff

**Vad:** Visa skillnaden mellan två sparade regelversioner: vilka regler som lades till, togs bort, bytte mål, ändrade villkor eller aktiverades. Återställ en enstaka regel i stället för hela konfigurationen.

**Varför:** I dag sparas fem säkerhetskopior, men användaren måste återställa allt och minns sällan vad som ändrades. Det gör felsökning onödigt trög.

**Konkurrenslucka:** Thunderbird-filter har ingen versionshistorik; molnverktyg visar sällan regelhistorik med lokal återställning.

**Så här:** Jämför `config.rules` mot en vald backup i `core.js`, visa en kompakt diff i Gränssnittet och återanvänd befintlig återställningskedja med pausat testläge. Utöka antalet versioner från fem till tio om lagringsutrymmet tillåter.

**Skydd:** Återställning säkerhetskopierar nuvarande läge först. Inga mejl flyttas av återställningen.

**Prio:** P1 · **Insats:** M.

## 3. Regelgranskning före körning

**Vad:** En "granska reglerna"-panel som varnar för tomma villkor, mycket breda domänvillkor, regler som saknar mål, dubbletter, oanvändbara målmappar och regler som aldrig kan nås på grund av en tidigare regel.

**Varför:** Den vanligaste orsaken till en olycka är inte en bugg utan ett villkor som är bredare än man tror. Användaren behöver få veta det *innan* första riktiga körningen.

**Konkurrenslucka:** Gmail/Outlook varnar begränsat; Thunderbird-filter har ingen sådan analys. SortBro har redan konfliktvarning, men den täcker bara överlappande mål.

**Så här:** Bygg vidare på `C.conflicts` och `C.explainRule` med en uppsättning enkla heuristiker. Varje varning ska visa vilken regel, vilket fält och vilket säkrare alternativ som föreslås. Ingen automatisk ändring.

**Skydd:** Endast läsning och förslag. En varning får aldrig blockera en regel utan användarens val.

**Prio:** P1 · **Insats:** M.

## 4. Testlabb för alla regler

**Vad:** Välj konto, mapp och tidsperiod; kör alla regler mot mejlmetadata och visa en före/efter-trädvy över vad som skulle flyttas, hoppas över eller krocka. Exportera rapporten som text/JSON.

**Varför:** Dagens provkörning är per regel och ger siffror, inte en samlad bild. Användare med många konton och regler vill se helheten innan de slår på flytt.

**Konkurrenslucka:** SaneBox/Clean Email arbetar i molnet och erbjuder inte en lokal, granskningsbar före/efter-vy. Thunderbird-filter har ingen simulering alls.

**Så här:** Återanvänd motorns dryRun, mappcache och `whyHere`-logik. Kör utan att skriva till kön, samla resultat per regel/mapp och rendera en sammanställning. Rapporten innehåller inga mejltexter.

**Skydd:** Hård spärr mot `move` och `messagesUpdate`; endast läsning. Stora konton begränsas med tydlig varning och möjlighet att välja färre mappar.

**Prio:** P1 · **Insats:** L.

## 5. Krock- och dubblettassistent

**Vad:** Föreslå hur två regler som matchar samma mejl kan slås ihop, delas upp eller prioriteras om. Visa exakt vilka villkor som överlappar och vilken regel som vinner i dag.

**Varför:** Konfliktvarningen finns, men användaren måste själv lista ut lösningen. Dubblettregler uppstår snabbt när man importerar eller klickar fram regler.

**Konkurrenslucka:** Få lokala filterverktyg analyserar regelkrockar alls; molnverktyg döljer ofta prioritetsordningen.

**Så här:** Normalisera villkor (domän/adress/ämne), jämför mål och bygg säkra förslag: "behåll första", "slå ihop till ELLER", "separera med ämnesvillkor". Förhandsgranska antal träffar före sparning. Spara alltid en backup.

**Skydd:** Inget slås ihop automatiskt. En sammanslagning som breddar villkoren kräver extra bekräftelse.

**Prio:** P1 · **Insats:** M.

## 6. Schemalagda regler

**Vad:** Aktivera en regel bara under ett tidsfönster: arbetsdagar, helger, semesterperiod eller ett angivet datumintervall.

**Varför:** Användare vill ofta sortera jobbmejl på arbetstid och privatmejl på kvällen, eller pausa en regel under semestern utan att stänga av den permanent. I dokumentationen står i dag att helger och frånvaro hanteras manuellt.

**Konkurrenslucka:** Thunderbird-filter saknar scheman. Molnverktyg har ibland scheman men kräver server och konto.

**Så här:** Lägg frivilliga fält på regeln (`activeDays`, `activeFrom`, `activeTo`, `dateRange`). Motorn hoppar över regeln utanför fönstret och statusraden förklarar varför. Använd befintlig timer; ingen ny behörighet.

**Skydd:** Standard är alltid "alltid aktiv". Tydlig status i regellistan så en schemalagd regel inte ser ut att vara trasig. Manuell körning ska respektera schemat om användaren inte uttryckligen väljer "kör ändå".

**Prio:** P1 · **Insats:** M.

## 7. Snooze till datum

**Vad:** Flytta ett mejl till en lokal "Snoozade"-mapp och tillbaka till Inkorgen på ett valt datum, eller när en påminnelse förfaller.

**Varför:** Snooze är en av de mest efterfrågade funktionerna i mejlappar, men saknas i Thunderbirds filter. Det passar SortBros lokala modell och kräver ingen server.

**Konkurrenslucka:** SaneBox har SaneTomorrow, men som molntjänst. Thunderbird har ingen inbyggd snooze som ett filter kan återställa.

**Så här:** En särskild systemregel skapar/återanvänder mappen `Snoozade` per konto eller en gemensam mapp. Ett schema i bakgrunden letar efter förfallna poster och flyttar tillbaka via vanlig verifierad flytt. Mappen undantas från vanliga svep för att undvika loopar.

**Skydd:** Endast mejl som användaren själv snoozar. Om mappen eller kontot saknas visas ett tydligt fel i stället för en tyst förlust. Ångra senaste flytt (förslag 1) gäller även snooze.

**Prio:** P1 · **Insats:** M.

## 8. Screener för nya avsändare

**Vad:** Första gången en avsändare hör av sig kan mejlet läggas i en granskningsmapp. Användaren väljer "släpp igenom", "skapa regel" eller "blockera" en gång; framtida mejl hanteras enligt valet.

**Varför:** Det största bruset kommer från avsändare man inte känner igen. En screener ger kontroll utan att man måste skriva regler i förväg.

**Konkurrenslucka:** Clean Email har Screener som molntjänst. SortBro kan göra motsvarande lokalt, med användarens egna mappar och utan att adresser skickas iväg.

**Så här:** Bygg en lokal lista över kända avsändare från historik och regler. Nya avsändare flyttas endast om användaren har aktiverat screenern. Åtgärder skapar en vanlig regel eller en VIP-post. Kräver inga kontakter och ingen ny behörighet.

**Skydd:** Avstängd som standard. Påverkar aldrig befintliga regler eller VIP. En "släpp igenom" ska vara möjlig direkt från regellistan och ångras.

**Prio:** P1 · **Insats:** L.

## 9. VIP-skydd

**Vad:** En skyddad lista med adresser/domäner som aldrig får flyttas av någon regel. Konflikter visas tydligt i regelgranskningen.

**Varför:** En enda bred regel kan flytta viktiga mejl från en chef, kund eller familjemedlem. Ett VIP-skydd är en enkel och begriplig säkerhetsventil.

**Konkurrenslucka:** Gmail/Outlook har viktiga avsändare, men inte som ett lokalt tvärgående skydd över flera konton. Thunderbird-filter saknar det helt.

**Så här:** Lägg listan i `prefs`/config, normalisera adresser med samma logik som regler och kontrollera den i motorns sista grind före köning. Visa en varning i regeleditorn när ett villkor matchar en VIP.

**Skydd:** Skyddet kan inte kringgås av en regel. Användaren kan tillfälligt ta bort en VIP, men det kräver bekräftelse och loggas.

**Prio:** P1 · **Insats:** S.

## 10. Fler rubrikfält

**Vad:** Villkor för `List-ID`, `Reply-To`, `Return-Path`, `Auto-Submitted` och `X-Spam-Status`, utöver dagens avsändare, mottagare, kopia, ämne, storlek och datum.

**Varför:** Nyhetsbrev, utskick och automatiska notiser syns ofta tydligast i dessa rubriker, inte i avsändaradressen. Användare efterfrågar "flytta allt som är en lista" eller "endast automatiska svar".

**Konkurrenslucka:** Gmail/Outlook har delvis list-ID men är leverantörsspecifika. Thunderbird-filter kan använda vissa rubriker men saknar SortBros testläge, förhandsvisning och multiaccount-stöd.

**Så här:** Läs rubriker via `messages.getFull`/motsvarande och lägg till fält i regelmotorn. Normalisera List-ID (skiftläge, vinkelparenteser) och visa exempel i editorn. Endast metadata, aldrig brödtext.

**Skydd:** Ett fält som inte kan läsas gör att villkoret inte matchar – det får aldrig bli ett tomt "matcha allt". Visa tydligt när ett konto inte exponerar rubriken.

**Prio:** P1 · **Insats:** M · **Beroende:** verifiera Thunderbird-API för rubrikläsning i MV2.

## 11. Plus-adresser och IDN

**Vad:** Normalisera `namn+nyhetsbrev@example.com` till `namn@example.com` när användaren väljer det, och hantera internationella domännamn (IDN/punycode) samt skiftläge i adresser.

**Varför:** Många tjänster använder plus-adresser, och ett villkor på basadressen missar dem i dag. IDN kan göra att en domänregel aldrig träffar.

**Konkurrenslucka:** Få lokala filter hanterar plus-adresser eller IDN konsekvent; molnverktyg gör det osynligt och ibland fel.

**Så här:** Lägg normalisering i `core.js` nära `looksLikeEmail`/`looksLikeDomain`. Erbjud en tydlig kryssruta "behandla plus-adress som samma adress" per regel. Visa före/efter i testläget.

**Skydd:** Standard är exakt matchning. Normaliseringen får aldrig bredda en regel utan att användaren har kryssat i valet.

**Prio:** P1 · **Insats:** S.

## 12. Regel på vanlig svenska

**Vad:** Skriv "flytta kvitton från 2025 till Arkiv/Kvitton" eller "sortera nyhetsbrev från klarna till Nyhetsbrev" och få ett färdigt, redigerbart regelutkast med villkor och målmapp.

**Varför:** Många användare kan sin inkorg men inte villkorsfälten. En enkel tolkning sänker tröskeln utan att kräva moln-AI.

**Konkurrenslucka:** Shortwave och liknande använder moln-AI. Ett lokalt, förutsägbart filterverktyg kan erbjuda samma sak utan att skicka mejladresser till en server.

**Så här:** En deterministisk parser för svenska och engelska med ett litet ordförråd (från, till, ämne, innehåller, äldre, nyare, bifogad, år). Parsern föreslår alltid ett utkast; inget sparas eller körs automatiskt. Vid tvekan visas vanliga fält i stället.

**Skydd:** Ingen text skickas någonstans. Tolkningen visas som redigerbara villkor, och testläget måste godkännas före aktivering.

**Prio:** P2 · **Insats:** L.

## 13. Trådmedvetna regler

**Vad:** Kunna flytta hela konversationen när ett mejl i tråden matchar, eller undvika att splittra en tråd genom att vänta tills hela tråden är läst.

**Varför:** Sortering som bara flyttar ett enskilt svar skapar trasiga trådar i både Inkorgen och målmappen.

**Konkurrenslucka:** Thunderbirds filter arbetar per meddelande. Molnverktyg har ibland konversationsvy men ingen lokal, regelstyrd flytt.

**Så här:** Verifiera först om MV2-API:t ger stabila trådreferenser (`References`/`In-Reply-To`) via rubrikläsning. Flytta då relaterade meddelanden i samma verifierade batch, med tydlig gräns för hur många som får ingå.

**Skydd:** Om tråden inte kan fastställas säkert flyttas endast det matchande mejlet, med information i loggen. Aldrig flytta ett helt konto på en lös gissning.

**Prio:** P2 · **Insats:** L · **Beroende:** API-verifiering.

## 14. Uppföljning utan svar

**Vad:** En lokal översikt över trådar där du skickat ett mejl men inte fått svar inom vald tid. Inget skickas; endast en läsbar lista med åtgärder.

**Varför:** Det är lätt att tappa bort ett viktigt mejl som väntar på svar. SaneBox har SaneNoReplies; Thunderbird saknar en motsvarande lokal regelöversikt.

**Konkurrenslucka:** SaneNoReplies är molnbaserad. SortBro kan använda Sent-mappen lokalt och visa endast metadata.

**Så här:** Läs skickade mejl och jämför med inkommande via trådreferenser/adresser under en vald period. Visa "väntar på svar", "svarat" och "för gammalt". Använd endast rubriker och datum.

**Skydd:** Endast läsning. Inga påminnelser, popup-fönster eller automatiska mejl. Användaren kan stänga av hela vyn.

**Prio:** P2 · **Insats:** M.

## 15. Massredigera regler

**Vad:** Markera flera regler och aktivera, stänga av, ändra mål, flytta prioritet eller ta bort dem i en enda åtgärd med förhandsgranskning.

**Varför:** Den som har många regler måste i dag klicka varje regel för sig. Det gör underhåll långsamt och ökar risken för felklick.

**Konkurrenslucka:** Thunderbird-filter har en enkel lista men svag massredigering; molnverktyg har ofta batchåtgärder men inte lokal kontroll.

**Så här:** En selektionsmodell i regellistan med kryssrutor, åtgärdsrad och bekräftelsedialog. Alla ändringar går genom `saveRules` med revision och automatisk backup. Måländring valideras mot mappträdet.

**Skydd:** Ta bort kräver extra bekräftelse och visar antal. En avbruten åtgärd lämnar inga halvskrivna regler.

**Prio:** P1 · **Insats:** M.

## 16. Import från Gmail och Outlook

**Vad:** Läs in exporterade Gmail-filter (XML) och Outlook-regler (CSV/XML) som utkast, mappa etiketter/kategorier till Thunderbird-mappar och visa en granskningsrapport före sparning.

**Varför:** Den som byter till Thunderbird har ofta åratal av filter. Att skriva om dem manuellt är ett av de största hindren.

**Konkurrenslucka:** Thunderbird importerar endast sin egen `msgFilterRules.dat`. Molnleverantörer importerar inte varandras regler. En lokal, granskningsbar import är ett tydligt särskiljande.

**Så här:** En parser per format, en mappmatchningsdialog och samma importkedja som JSON-importen. Allt blir utkast; ingen regel aktiveras utan användarens val.

**Skydd:** Okända fält eller saknade mappar hoppas över med förklaring. Importen skriver aldrig över befintliga regler utan att fråga.

**Prio:** P2 · **Insats:** L.

## 17. Mapphälsa och reparation

**Vad:** En översikt som visar regler vars käll- eller målmapp har försvunnit, bytt namn eller saknar skrivrättighet. Föreslå att skapa mappen, välja en annan eller stänga av regeln.

**Varför:** Efter ett kontobyte eller en omsortering slutar regler att fungera tyst. Användaren ser bara att mejl inte flyttas.

**Konkurrenslucka:** Thunderbird-filter ger ett allmänt fel eller flyttar ingenstans. Molnverktyg kan reparera i sin egen miljö, men inte lokalt över flera konton.

**Så här:** Validera mapp-ID:n vid start och efter kontoförändringar. Jämför namn och kontoprefix för att föreslå rätt mapp. Använd `folders.create` endast efter uttryckligt val.

**Skydd:** Ingen automatisk flytt av regler till en gissad mapp. En trasig regel stängs inte av utan att användaren ser varför.

**Prio:** P1 · **Insats:** M.

## 18. Kontomigrering

**Vad:** Byt konto i en eller flera regler och mappa gamla mapp-ID:n till nya. Visa alla berörda regler och en före/efter-tabell före sparning.

**Varför:** När en adress läggs ner eller ett konto byter namn måste alla regler annars redigeras manuellt. Det är både tidsödande och lätt att missa en regel.

**Konkurrenslucka:** Leverantörsspecifika filter är bundna till kontot. Thunderbird har ingen migrering av filter mellan konton.

**Så här:** En guide som läser in båda kontonas mappträd, föreslår matchningar via namn och specialUse och låter användaren godkänna. Spara som vanlig revisionssäker ändring.

**Skydd:** Ingen automatisk gissning utan bekräftelse. Regler med saknade mappar markeras och lämnas oförändrade.

**Prio:** P2 · **Insats:** M.

## 19. Kvarhållning av gammal post

**Vad:** Regler för ålder: arkivera, flytta till papperskorgen eller behåll de senaste N mejlen per avsändare. Alltid med förhandsgranskning, testläge och ångra.

**Varför:** Användare vill städa stora mappar, men är rädda för automatisk radering. Dagens årsmappar hjälper bara vid flytt till Arkiv, inte vid rensning.

**Konkurrenslucka:** Clean Email är stark på engångsstädning men molnbaserad. Thunderbird-filter saknar åldersbaserad kvarthållning och säker ångra.

**Så här:** En särskild åtgärdstyp `retain` med tydliga gränser, alltid i testläge först. Papperskorgen används endast efter separat bekräftelse. Undo-journalen (förslag 1) är ett krav.

**Skydd:** Ingen permanent radering i första versionen. Max antal per körning, paus vid osäker flytt och tydlig rapport. Trash-mappen får aldrig ingå i vanliga svep.

**Prio:** P2 · **Insats:** L.

## 20. Veckorapport i appen

**Vad:** En lugn sammanfattning i aktivitetsvyn: antal flyttar, överhoppade, konflikter, kötoppar och regler som inte har matchat på länge. Kan sparas som text.

**Varför:** Användare vill veta att sorteringen fungerar utan att läsa en teknisk logg eller få popup-meddelanden.

**Konkurrenslucka:** Molnverktyg skickar ofta e-postrapporter; SortBro kan ge samma insikt lokalt utan att skicka något.

**Så här:** Aggregera befintlig statistik och logg per vecka, rendera ett kort i Aktivitet och erbjud "spara som". Ingen ny lagring av mejltext.

**Skydd:** Rapporten innehåller endast antal, regelnamn och mappnamn – inga adresser eller ämnesrader om användaren inte väljer det.

**Prio:** P2 · **Insats:** S.

## 21. Prestandapanel

**Vad:** Visa genomsnittlig sveptid per konto/mapp, cacheträffar, ködjup och de långsammaste mapparna under de senaste körningarna.

**Varför:** Stora IMAP-konton kan kännas långsamma utan att något är trasigt. Användaren behöver veta om det är nätverket, en mapp eller en regel.

**Konkurrenslucka:** Thunderbird-filter visar ingen prestanda. Molnverktyg döljer serverns arbete bakom en statusrad.

**Så här:** Mät redan existerande tidsstämplar i motorn och spara ett rullande medelvärde i `storage.local`. Visa endast aggregerad data, med återställning.

**Skydd:** Ingen mejlinnehåll eller adresser i mätningen. Panelen är read-only och kan tömmas.

**Prio:** P2 · **Insats:** M.

## 22. Revisionslogg för regler

**Vad:** En lokal historik över varje regeländring: tid, ändringstyp och en kort diff. Möjlighet att exportera eller återställa en post.

**Varför:** När en regel plötsligt beter sig annorlunda vill man veta vad som ändrades och när. Det är också värdefullt för support.

**Konkurrenslucka:** Thunderbird-filter har ingen ändringshistorik. Molnverktyg loggar ofta internt men visar sällan användaren en lokal diff.

**Så här:** Skriv en post vid `saveRules`/`restoreBackup` med före/efter-hash och regel-ID. Begränsa till exempelvis 500 poster och 90 dagar. Ingen mejltext.

**Skydd:** Loggen kan rensas av användaren. Den påverkar aldrig regelmotorn.

**Prio:** P2 · **Insats:** S.

## 23. Krypterad portabel backup

**Vad:** Exportera hela SortBro-konfigurationen – regler, inställningar och valfria mapphints – som en krypterad fil med lösenord och kontrollsumma. Importera med granskning och selektiv återställning.

**Varför:** Dagens JSON-backup är läsbar för alla som kommer åt filen. Den som flyttar mellan datorer vill kunna ta med sig reglerna säkert utan moln.

**Konkurrenslucka:** Thunderbird och de flesta filterverktyg saknar krypterad, portabel regelbackup.

**Så här:** Använd Web Crypto (AES-GCM) lokalt, med PBKDF2/Argon2-liknande nyckelhärledning enligt plattformens stöd. Filen innehåller version, salt, IV och krypterad JSON. Importeren visar en sammanfattning före sparning.

**Skydd:** Lösenordet lämnar aldrig webbläsaren. Ingen automatisk import. Fel lösenord eller trasig fil ger ett tydligt fel utan att röra nuvarande regler.

**Prio:** P2 · **Insats:** M · **Beroende:** Web Crypto i Thunderbirds MV2-miljö.

## 24. Sparade vyer för regler

**Vad:** Spara vanliga filter som "avstängda", "provkörning", "regler mot Fakturor" eller "regler utan träff senaste veckan" som klickbara vyer ovanför regellistan.

**Varför:** Den som har många regler upprepar samma sökning varje dag. Sparade vyer gör underhållet snabbare utan att ändra reglerna.

**Konkurrenslucka:** Thunderbird-filter har endast en platt lista. Molnverktyg har ofta mappar men inte lokala regelvyer.

**Så här:** Spara sökfilter i `prefs` (namn + query), återanvänd `ruleMatchesSearch` och rendera som små chips. En vy kan även filtrera på status, mapp och senaste träff.

**Skydd:** Endast vyfilter, aldrig en ändring av regler. En borttagen vy påverkar inga mejl.

**Prio:** P3 · **Insats:** S.

## 25. Tillgänglighets- och tangentbordsläge

**Vad:** Ett genomarbetat läge för skärmläsare, hög kontrast, 200 % zoom, reducerad rörelse och tangentbordsgenvägar för de vanligaste handlingarna (ny regel, kör alla, paus, tillbaka).

**Varför:** Dagens gränssnitt är tangentbordsvänligt i grunden, men långa formulär, dynamiska statusmeddelanden och små ikoner kan bli svåra. Tillgänglighet gynnar alla, särskilt vid hög zoom och smala fönster.

**Konkurrenslucka:** De flesta mejlsorterare är inte byggda för tangentbord först; Thunderbirds filter är enkla men inte anpassade för SortBros arbetsflöde.

**Så här:** Granska fokusordning i alla dialoger, lägg till `aria-live` för status/toast, stöd `prefers-contrast`/`forced-colors`, säkerställ 44 px pekytor och dokumentera genvägar. Automatiska DOM- och Chromium-tester för fokusfällor och kontrast.

**Skydd:** Inga nya behörigheter. Genvägar får inte krocka med Thunderbirds egna; konfigurerbara och avstängningsbara.

**Prio:** P1 · **Insats:** M.

---

## Vad som medvetet inte föreslås

- **Moln-AI som läser mejltext.** Det skulle bryta löftet om lokal behandling och kräva en extern tjänst.
- **Nya behörigheter** för kontakter, flikar eller nätverk. Allt ovan kan byggas inom nuvarande behörigheter, förutsatt att API-kontrollerna i förslag 10 och 13 faller väl ut.
- **Automatisk radering utan ångra.** Förslag 19 är därför begränsat till arkiv/papperskorg med testläge och journal.
- **Automatisk aktivering av avstängda regler.** Ingen återställning, import eller migrering får slå på en regel som användaren har stängt av.

## Nästa steg

Välj vilka nummer som ska byggas, och i vilken ordning. Jag rekommenderar att börja med **1, 3, 4, 8, 9, 15 och 17** i ett första paket: de ger mest trygghet och vardagsnytta utan att kräva stora API-genombrott. Därefter **2, 5, 6, 7 och 25**. Övriga kan planeras när första paketet är testat i din riktiga Thunderbird-miljö.
