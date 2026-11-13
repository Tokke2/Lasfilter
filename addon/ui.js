'use strict';
const $=id=>document.getElementById(id),C=LasCore;
const DEMO=!!globalThis.LAS_DEMO||new URLSearchParams(location.search).get('demo')==='1';
const live=!!globalThis.browser?.runtime?.id;
let state=null,folders=[],selectedId='',dirty=false,editRevision=0,editToken='',activeView='rules',currentLang='sv',toastTimer;

const I18N={
 sv:{
  saveLogAsBtn:"Spara logg som…",
  saveLogAsHelp:"För en kopia i Dokument: klicka på Spara logg som… och välj Dokument → Lasfilter → logs i dialogen. Skapa mapparna där vid behov. Automatisk loggning fortsätter i Hämtade filer. Loggen kan innehålla regelnamn och domäner; granska den innan du delar den.",
  saveLogAsStarted:"Loggexporten har startats till den plats du valde. Kopian uppdateras inte automatiskt.",
  saveLogAsCancelled:"Sparandet avbröts. Ingen loggkopia exporterades.",
  saveLogAsDemo:"Spara-dialogen finns när SortBro körs i Thunderbird. Ingen fil sparades i förhandsvisningen.",
  readerPauseTitle:"Pausa nya läsfönster",
  readerPauseDurationLabel:"Pausens längd",
  readerPause15:"15 minuter",
  readerPause60:"1 timme",
  readerPauseManual:"Tills jag fortsätter",
  readerPauseApply:"Pausa nya fönster",
  readerPauseResume:"Fortsätt med nya läsfönster",
  readerPauseHelp:"Gäller Före-fönster. Mejlen som väntar på visning ligger kvar under pausen. Redan öppnade mejl kan flyttas efter stängning. Övrig sortering fortsätter. Pausen bevaras vid omstart.",
  readerPauseOff:"Nya läsfönster är inte pausade.",
  readerPauseUntil:"Nya läsfönster är pausade till {time}. De återupptas automatiskt.",
  readerPauseIndefinite:"Nya läsfönster är pausade tills du fortsätter.",
  readerPauseSaving:"Sparar pausval…",
  openTimingLabel:"När ska mejlfönstret öppnas?",
  openTimingAfter:"Efter verifierad flytt till målmappen",
  openTimingBefore:"Före flytten – vänta tills fönstret stängs",
  openTimingHelp:"Före: hämtar mejltexten och visar ett mejl i taget i SortBros säkra textfönster. Originalet ligger kvar i källmappen. Flytten väntar tills fönstret är stängt och mejlet inte längre visas i någon annan flik. Mejlet ändras inte av textvisningen. Efter: öppnar först när rätt mejl har verifierats i målmappen. Ett fönster som inte visar rätt mejl stängs.",
  summaryOpenTiming:"Fönster: {timing}.",
  senderTitle:"Regel från avsändaren",
  senderHelp:"Välj en befintlig regel eller öppna ett nytt utkast. Målmappen visas vid varje regel.",
  senderType:"Vad ska läggas till?",
  senderExact:"Bara denna e-postadress",
  senderDomain:"Alla avsändare på domänen",
  senderRuleLabel:"Regel och målmapp",
  senderNew:"Skapa ny regel…",
  senderSave:"Spara ändringen",
  senderOpen:"Öppna nytt regelutkast",
  senderSaveRun:"Spara och kör regeln nu",
  senderSaveNote:"Spara startar ingen manuell körning. Ordinarie bevakning fortsätter enligt dina inställningar.",
  senderNewNote:"Välj målmapp och kontrollera regeln i editorn. Ingenting sparas förrän du väljer Spara där.",
  senderBefore:"Nuvarande villkor: ",
  senderAfter:"Efter sparning: ",
  senderSource:"Källa: ",
  senderTarget:"Mål: ",
  senderOutside:"Mejlet ligger utanför regelns källa. Källan ändras inte när du lägger till avsändaren.",
  senderPolicy:"Befintliga inställningar för lästa/olästa, årsmappar, provkörning och alternativa mål behålls.",
  senderDuplicate:"Avsändaren/domänen omfattas redan av ett av regelns avsändarvillkor. Regeln ändras inte.",
  senderMultiple:"Markera ett enda mejl och högerklicka igen. Flera markerade mejl behandlas inte här.",
  senderAnd:"Regeln har flera OCH-villkor. Att lägga till en alternativ avsändare kan inte göras utan att ändra logiken. Skapa en separat regel i stället; den befintliga ändras inte.",
  senderFull:"Regeln har redan åtta villkor. Välj en annan regel eller skapa en ny.",
  senderInvalid:"Mejlet saknar en giltig avsändaradress. Ingen regel kan skapas här.",
  senderStale:"Reglerna har ändrats sedan rutan öppnades. Avbryt och högerklicka på mejlet igen för att granska den nya versionen.",
  senderRunConfirm:"Spara ändringen i ”{name}” och kör regeln? Detta kontrollerar alla mejl i regelns källa, inte bara det högerklickade mejlet. Testläge, paus, läsläge och säkerhetsbroms gäller fortfarande.",
  senderSaved:"Avsändaren har lagts till. Regeln är sparad.",
  senderRunFailed:"Regeln sparades, men körningen misslyckades: ",
  senderRunning:"Regeln sparades. Kontrollerar mejl…",
  senderRunResult:"Regeln sparades. Kontrollerade {n} mejl, köade {q}.",
  senderDisabled:"Regeln är avstängd. Tillägget sparas, men regeln aktiveras inte automatiskt.",
  introHide:"Dölj introduktion",
  introShow:"Visa introduktion",
  densityLabel:"Layout",
  densityCompact:"Kompakt",
  densityComfortable:"Luftig",
  lineSpacingLabel:"Radavstånd i lästext",
  lineSpacingNormal:"Normalt",
  lineSpacingRoomy:"Extra luftigt",
  appearanceNote:"Layout ändrar avstånd, inte textstorlek. Radavstånd gäller förklaringar och detaljer.",
  priorityConfirm:"Ändra ordning?\n\n”{name}”: plats {from} → {to}\n”{other}”: plats {to} → {from}\n\nFörsta matchande regeln vinner. Den nya ordningen gäller för fortsatt sortering.",
  priorityChanged:"”{name}” har nu prioritet {n}.",
  ariaNav:"Huvudmeny",
  ariaSetup:"Kom igång",
  ariaTemplates:"Regelmallar",
  ariaField:"Fält",
  ariaTarget:"Målmapp",
  ariaExisting:"Befintlig regel",
  ariaAccount:"Konto",
  ariaMatch:"Kombinera villkor",
  ariaConditionField:"Villkorsfält",
  ariaConditionOp:"Jämförelse",
  ariaConditionValue:"Villkorsvärde",
  ariaConditionRemove:"Ta bort villkor",
  ariaBranchField:"Fördelningsfält",
  ariaBranchOp:"Fördelningsjämförelse",
  ariaBranchValue:"Fördelningsvärde",
  ariaBranchTarget:"Fördelningsmålmapp",
  ariaBranchRemove:"Ta bort fördelning",
  ruleEnable:"Aktivera {name}",
  pageTitle:'SortBro · Thunderbird',
  demoBanner:'FÖRHANDSVISNING · Fiktiva data. Inga mejl läses eller flyttas.',
  installWarnHide:'Dölj',
  installWarnTempTitle:'⚠ Tillfällig installation – försvinner när Thunderbird stängs',
  installWarnTempText:'SortBro ligger i utvecklingsläge (inläst tillfälligt). Det är inte SortBro som avinstallerar sig. Gör det permanent: Tillägg → kugghjulet ⚙ → Installera tillägg från fil… Dina regler finns kvar i Hämtade filer/Lasfilter/Regelbackuper/.',
  installWarnSideTitle:'⚠ Sidoladdad installation – Thunderbird kan stänga av tillägget',
  installWarnSideText:'Filen ligger i Thunderbirds profilmapp (extensions) i stället för att vara installerad via Tillägg. Osignerade tillägg där stängs av vid omstart. Gör det permanent: Tillägg → kugghjulet ⚙ → Installera tillägg från fil… Dina regler finns kvar i Hämtade filer/Lasfilter/Regelbackuper/.',
  brandName:'SortBro',
  brandSub:'FÖR THUNDERBIRD',
  navMenu:'MENY',
  navSuggestions:"Föreslagna regler",
  rulesPageTitle:"Regler",
  ruleEditorPageHelp:"Välj konto, villkor och målmapp för regeln.",
  rulesPageHelp:"Dina sparade regler. Välj en regel för att redigera eller skapa en ny.",
  suggestionsPageTitle:"Föreslagna regler",
  suggestionsPageHelp:"Utgå från din Inkorg eller dina egna flyttar. Du väljer själv vad som ska bli en regel.",
  activityPageTitle:"Aktivitet",
  activityPageHelp:"Följ sorteringen, kontrollera resultat och felsök på ett ställe.",
  settingsPageTitle:"Inställningar",
  settingsPageHelp:"Öppna den grupp du vill ändra. Inställningar sparas direkt.",
  helpPageTitle:"Hjälp",
  helpPageHelp:"Kom igång och förstå hur SortBro flyttar dina mejl.",
  supportPageTitle:"Stöd SortBro",
  supportPageHelp:"Frivilligt stöd till fortsatt utveckling. Alla funktioner är alltid fria.",
  statusDetails:"Detaljer om sorteringen",
  inboxIdeasTitle:"Från din Inkorg",
  inboxIdeasHelp:"Välj en avsändare eller ett ämnesord att utgå från.",
  templateLibraryTitle:"Mallar att utgå från",
  learnedSectionTitle:"Förslag från dina egna flyttar",
  learnEmpty:"Inga inlärda förslag just nu. Nya förslag visas här när SortBro hittar ett mönster.",
  learnEmptyOff:"Inlärningen är avstängd. Du kan slå på den under Inställningar → Sortering & säkerhet.",
  resumeEditor:"Fortsätt redigera",
  backToRules:"← Alla regler",
  editorDraftNote:"Ändringar sparas först när du väljer Spara.",
  ruleFilesTitle:"Importera & exportera regler",
  activityToolsTitle:"Kontroller & felsökning",
  activityToolsHelp:"Kör en kontroll eller undersök det markerade mejlet.",
  appearanceSection:"Utseende & läsbarhet",
  sortingSection:"Sortering & säkerhet",
  storageSection:"Loggar & automatiska säkerhetskopior",
  navRules:'Regler',
  navActivity:'Aktivitet',
  navSettings:'Inställningar',
  navHelp:'Hjälp',
  navSupport:'Stöd SortBro',
  footerSupportLink:'💚 Stöd SortBro',
  supEyebrow:'💚 100 % GRATIS • LOKALT I THUNDERBIRD • ÖPPEN KÄLLKOD',
  supHeroTitle:'Stöd SortBro – för en lugnare inkorg i Thunderbird',
  supHeroSub:'SortBro är helt gratis, reklamfritt och körs 100 % lokalt i din dator utan molntjänster. Din gåva stöttar fortsatt utveckling, stöd för nya Thunderbird-versioner och nya smarta filterfunktioner. Inget låses upp – alla funktioner är alltid fria för alla.',
  supStatLocal:'🔒 100 % lokal behandling',
  supStatFree:'💚 100 % gratis – alltid',
  supSwishQuick:'💚 Swish (QR)',
  supGithubBtn:'⭐ GitHub',
  supPickKicker:'Valfritt belopp – inga nivåer, inga krav',
  supPickTitle:'Välj belopp eller skriv ett eget',
  supPickSub:'Beloppet följer med till Swish-QR och PayPal (och kan alltid ändras i Swish-appen). Varje krona gör direkt skillnad.',
  supSwishMain:'💚 Visa Swish-QR för beloppet',
  supPaypalMain:'💙 PayPal – valt belopp',
  supKofiMain:'☕ Ko-fi – engångs / månadsvis',
  supQrTitle:'💚 Skanna med Swish-appen på mobilen',
  supQrModeSwish:'Swish-appen (Standard)',
  supQrModeCam:'Vanlig mobilkamera',
  supQrSub:'Öppna Swish i mobilen → Skanna QR-kod. Belopp och meddelande (SortBro) är förifyllda och kan ändras fritt.',
  supQrSubCam:'Rikta mobilens vanliga kamera mot QR-koden för att öppna Swish via direktlänk (swish://).',
  supWhyKicker:'Varför ditt stöd gör skillnad',
  supWhyTitle:'Du stöttar en oberoende svensk utvecklare – inte ett bolag 🛠️',
  supWhySub:'SortBro byggdes för att lösa ett verkligt problem i Thunderbird: att kunna läsa sina mejl i lugn och ro innan de sorteras bort, eller styra per filter vilka olästa och lästa mejl som ska flyttas. Ditt stöd håller tillägget uppdaterat och reklamfritt.',
  supImp1Title:'Thunderbird-kompatibilitet',
  supImp1Body:'Löpande uppdateringar och IMAP-tester när Thunderbird släpper nya versioner.',
  supImp2Title:'Nya smarta filterfunktioner',
  supImp2Body:'Utveckling av nya regelvillkor, fönsterhantering och förenklingar efter användarönskemål.',
  supImp3Title:'100 % privat & lokalt',
  supImp3Body:'Inga molntjänster, ingen spårning och inga låsta betalversioner – någonsin.',
  supTrust1:'🔒 Swish, PayPal & Ko-fi – tryggt & krypterat',
  supTrust2:'🕊️ Ingen spårning i tillägget (connect-src \'none\')',
  supTrust3:'🇸🇪 Svensk öppen källkod',
  supFaqKicker:'Vanliga frågor – lugnt & tryggt',
  supFaq1Q:'💚 Hur fungerar Swish-QR-koden här i Thunderbird?',
  supFaq1A:'QR-koden skapas 100 % lokalt direkt i tillägget utan att kontakta någon extern server. Öppna Swish-appen på din mobil, välj Skanna och rikta kameran mot koden så fylls mottagare, valt belopp och meddelandet "SortBro" i automatiskt.',
  supFaq2Q:'🔒 Läser eller skickar SortBro några betal- eller mejluppgifter?',
  supFaq2A:'Aldrig. SortBro har en strikt säkerhetspolicy (connect-src \'none\') som blockerar all nätverkstrafik från tillägget. Betalning sker helt i din egen Swish-app eller i webbläsaren via PayPal/Ko-fi.',
  supFaq3Q:'🎁 Låser en donation upp några extra funktioner?',
  supFaq3A:'Nej – alla funktioner i SortBro är 100 % gratis för alla, alltid. En gåva är helt frivillig och ett varmt tack som gör det möjligt att fortsätta utveckla och underhålla tillägget.',
  sidebarNoteTitle:'Du läser i lugn och ro.',
  sidebarNoteBody:'Lästa mejl stannar kvar medan de visas i en mejlflik eller ett fönster.',
  versionText:'Lokal behandling · v1.0.25 · Inga molntjänster',
  topbarTitle:'THUNDERBIRD / SORTBRO',
  themeQuickTitle:'Växla ljust/mörkt tema',
  introEyebrow:'ENKEL AUTOMATISK SORTERING',
  introTitle:'Flytta mejl automatiskt',
  introSub:'Skapa en eller flera regler, välj olästa/lästa och målmapp. Klart.',
  setup1Title:'Välj exempelmejl',
  setup1Sub:'Markera ett mejl i Thunderbird',
  setup2Title:'Spara regeln',
  setup2Sub:'Välj lästa/olästa och målmapp',
  setup3Title:'Slå på flytt',
  setup3Sub:'Tillägget sköter resten',
  runLabel:'FLYTTSTATUS',
  clearFaultBtn:'Rensa spärr och fortsätt',
  showActivityBtn:'Visa aktivitet',
  statRules:'aktiva regler',
  statQueue:'väntar på flytt / test',
  statMoved:'flyttade sedan start',
  statMatched:'matchade sedan start',
  rulesTitle:'Sparade regler',
  rulesSub:'Fler alternativ för varje regel finns under ⋯.',
  ruleMenuLabel:"Åtgärder för {name}",
  ruleDetails:"Detaljer & inställningar",
  ruleEdit:"Redigera",
  ruleRun:"Kör nu",
  ruleCopy:"Duplicera",
  ruleExport:"Exportera",
  ruleUp:"Flytta upp",
  ruleDown:"Flytta ned",
  ruleDelete:"Ta bort…",
  ruleOn:"På",
  ruleOff:"Av",
  ruleOverlap:"Överlapp · {n}",
  ruleOrder:"Prioritet {n}",
  ruleSource:"Från",
  ruleTarget:"Till",
  ruleConditions:"Villkor",
  ruleAll:"Alla villkor ska matcha",
  ruleAny:"Minst ett villkor ska matcha",
  ruleDeleteNamed:"Ta bort ”{name}”? Inga mejl tas bort.",
  ruleTargetMore:"+ {n} alternativa mål",
  newFromSelectedBtn:'✉ Ny från markerat mejl',
  newRuleBtn:'＋ Ny tom regel',
  quickRuleTitle:'Skapa från ett förslag',
  quickRuleHelp:'Klicka på en avsändare eller ett ämnesord – eller skriv själv. SortBro säger till hur många mejl i Inkorgen regeln träffar innan du sparar.',
  quickHintsScan:'↻ Läs Inkorgen igen',
  quickHintsSenders:'Avsändare i Inkorgen',
  quickHintsWords:'Ord i ämnesrader',
  quickHintsEmpty:'Inget att föreslå just nu – skriv en domän, en adress eller ett ord i fältet.',
  quickMatch:'{n} mejl i Inkorgen matchar just nu',
  quickMatchZero:'Inga mejl matchar just nu – kontrollera stavningen eller klicka på ett förslag ovan.',
  quickMatchCounting:'Räknar i Inkorgen…',
  quickMatchAccount:'{n} mejl i {a} matchar just nu',
  quickMatchUnreadPart:'{n} av {m} flyttas nu – {u} olästa väntar på att läsas',
  quickMatchUnreadOnly:'Inga mejl flyttas nu – de {u} som matchar är olästa. Kryssa i Flytta olästa mejl om de ska med.',
  quickMatchCapped:' (räknat på de {n} senaste mejlen i Inkorgen)',
  quickChipTipSender:'Vanligaste adressen: {a}',
  quickChipTipSubject:'Senaste ämnet: {s}',
  quickChipHide:'Dölj förslaget',
  quickHintsMore:'＋ visa fler ({n})',
  quickHintsShowLess:'− visa färre',
  quickHintsUnhide:'Visa dolda förslag igen',
  quickSentence:'Flytta {what} till {target}',
  quickPickTarget:'välj målmapp',
  quickWhatDomain:'mejl från {v}',
  quickWhatSender:'mejl där avsändaren innehåller {v}',
  quickWhatSenderExact:'mejl från {v}',
  quickWhatSubject:'mejl med "{v}" i ämnet',
  quickAddRunBtn:'⚡ Lägg till och flytta nu',
  quickRunToast:'Regeln skapades och kördes: {n} mejl granskade, {q} flyttade.',
  quickFetchBtn:'✉ Hämta från markerat mejl',
  quickAddBtn:'＋ Skapa regel',
  quickExistingNew:'Skapa ny regel…',
  quickExistingAdd:'＋ Lägg till i: {name}',
  quickExistingPick:'Välj en regel ovan om du vill lägga till avsändaren i en regel som redan finns.',
  importLabel:'Klistra in domäner eller adresser (en per rad, eller med komma)',
  importBtn:'＋ Importera till regeln',
  importHelp:'Varje rad blir ett villkor i den här regeln. Adresser och domäner blir exakta träffar, andra ord blir "innehåller". Flera avsändare kopplas ihop med "minst ett av villkoren", så regeln flyttar mejl från vem som helst av dem.',
  importAdded:'{n} villkor tillagda i regeln.',
  importAddedAny:'{n} villkor tillagda. Kombinationen är nu "minst ett av villkoren".',
  importSkipped:' {n} hoppades över (dubbletter eller regeln är full).',
  importNone:'Inget nytt att lägga till – allt finns redan i regeln.',
  importNoRule:'Öppna eller skapa en regel först.',
    importSaveHint:'Tryck Spara regel för att spara ändringen.',
  tbFilterTitle:'🔁 Thunderbirds egna filter',
  tbFilterHelp:'Läs in dina befintliga filter från msgFilterRules.dat och gör dem till SortBro-regler – eller skriv ut dina regler som en filterfil som Thunderbird förstår. Filen ligger i din profil: Hjälp → Felsökningsinformation → Öppna mappen, sedan ImapMail/<server>/ eller Mail/Local Folders/.',
  tbImportBtn:'⇪ Importera filterfil…',
  tbExportBtn:'⇩ Exportera som filterfil',
  tbPrefixHelp:'Klistra in kontots adress från filterfilen om du vill kunna exportera tillbaka.',
  tbImportTitle:'Filter i filen: {n}',
  tbImportSummary:'Kan bli regler: {ok} · hoppas över: {skipped}',
  tbImportCreate:'✓ Skapa {n} regler',
  tbImportNothing:'Inget att importera – inget av filtren flyttar mejl med villkor SortBro kan matcha.',
  tbImportDone:'Nya regler från filterfilen: {n}.',
  tbImportTarget:'Målmapp',
  tbImportNeedsTarget:'Välj målmapp',
  tbImportDisabled:'avstängt i Thunderbird',
  tbImportNoTargetMatch:'Ingen målmapp matchade "{name}"',
  tbImportReviewNote:'Granska och bocka av det du vill ha. Inget skapas förrän du trycker på knappen.',
  tbImportCapacity:'SortBro har plats med {n} regler till (högst 200). Resten hoppas över – stäng av några gamla regler först om du vill ha med dem.',
  tbImportPartial:'Klarade: {n} · kunde inte sparas: {m}. Rader nedan säger varför.',
  tbImportFailedRow:'Kunde inte sparas: ',
  tbExportSaved:'Filterfilen sparades: {name}',
  tbExportBadPrefix:'Kontoadressen ska börja med imap://, mailbox:// eller pop3:// – kopiera raden actionValue ur din msgFilterRules.dat.',
  tbExportWritten:'{n} filter skrivna',
  tbExportSkipped:'{n} hoppades över',
  tbExportNoUri:'Kontots adress i filterfilen saknas. Klistra in den i fältet ovan (den står i din msgFilterRules.dat, t.ex. imap://anvandare%40server.se@imap.server.se/) eller importera filen en gång först.',
  tbExportPlace:'Filen ligger nu i Hämtade filer/Lasfilter/Filterfiler/. Lägg den i profilens mapp för kontot (ImapMail/<server>/ eller Mail/Local Folders/) när Thunderbird är stängt, och starta sedan om Thunderbird. Ta en kopia av den gamla filen först.',
  tbExportNeedsRules:'Det finns inga regler att exportera.',
  tbNotes:'Att tänka på:',
  tbNoteBody:'Villkor på mejltexten (body) kan SortBro inte matcha',
  tbNoteNegation:'Negerade villkor (doesn\'t contain / isn\'t) kan SortBro inte uttrycka',
  tbNoteMatchall:'Filtret matchar allt (ALL) och har inget villkor att översätta',
  tbNoteComplex:'Blandade OCH/ELLER kunde inte översättas exakt',
  tbNoteNoMove:'Filtret flyttar inga mejl',
  tbNoteCopy:'Filtret kopierar i stället för att flytta – SortBro flyttar',
  tbNoteNoTarget:'Ingen målmapp kunde matchas – välj en',
  tbNoteActions:'Åtgärder som inte följer med: {list}',
  tbNoteApprox:'"{field}" översattes ungefärligt',
  tbNoteUnknown:'Fältet "{field}" finns inte i SortBro',
  tbNoteSize:'Storlek räknades om mellan byte och kB',
  tbNoteDate:'Datumvillkoret översattes till dagar',
  tbNoteActionsAdd:'Åtgärder som inte följer med: ',
  tbNoteTrimmed:'{n} villkor fick inte plats (SortBro har högst 8 per regel) – lägg till dem i regelredigeraren',
  tbExportNoteDomain:'Domänvillkor blir "Från innehåller" i Thunderbird',
  tbExportNoteSize:'Storleken skrivs i byte',
  tbExportNoteBranches:'Grenar (olika mål per ämne) kan inte exporteras – bara huvudmålet följer med',
  tbExportNoteYearFolders:'Årsmappar finns inte i Thunderbird-filter',
  tbExportNoteReadPolicy:'Läsläget (olästa/lästa) finns inte i Thunderbird-filter',
  tbExportNoteDate:'Villkor på årtal (före/efter innevarande år) kan inte exporteras',
  tbExportNoteCondition:'Villkoret "{what}" kan inte skrivas som ett Thunderbird-filter',
  quickExistingPrompt:'"{name}" har {n} villkor sedan tidigare. Nya avsändare läggs till som alternativ, så regeln flyttar mejl som matchar något av villkoren. Fortsätta?',
  quickExistingDone:'{n} tillagt i regeln "{name}". Kombinationen är "minst ett av villkoren".',
  quickExistingNone:'Inget nytt att lägga till – värdet finns redan i regeln.',
  quickValuePlaceholder:'t.ex. fortnox.se, klarna.se eller Faktura…',
  ruleSearchPlaceholder:'Sök namn, mapp eller villkor…',
  exportBtn:'↓ Exportera regler (.json)',
  importBtn:'↑ Importera (.json)',
  importMergeBtn:'＋ Lägg till från JSON',
  exportSingleRuleBtn:'↓ Exportera regel (.json)',
  jsonBackupSub:'Exportera dina regler till en JSON-fil eller importera regler från en JSON-fil (ersätt alla eller lägg till).',
  priorityNote:'Första träff gäller. Ändra ordning via ⋯.',
  editorEyebrow:'REGELREDIGERING',
  editorNew:'Ny regel',
  editorEdit:'Redigera regel',
  enabledLabel:'Aktiv',
  ruleNameLabel:'Regelnamn',
  ruleNamePlaceholder:'Exempel: Fortnox fakturor',
  step1Title:'Markera ett exempelmejl',
  step1Help:'Gå till Thunderbird, klicka på ett mejl som ska sorteras och kom tillbaka hit.',
  fromSelectedBtn:'✉ Hämta konto från markerat mejl',
  accountLabel:'Konto',
  chooseAccount:'Välj ett konto…',
  accountScopeTitle:'Alla mappar i kontot ingår',
  accountScopeBody:'Inkorg, arkiv och vanliga undermappar bevakas automatiskt. Skickat, Utkast, Skräppost och Papperskorg undantas.',
  step2Title:'Vilka liknande mejl?',
  conditionOr:"ELLER",
  conditionAnd:"OCH",
  ruleSummaryTitle:"Så fungerar regeln",
  summaryMove:"Flytta mejl från kontot {source} till {target} om ",
  summarySourceMissing:"[välj konto]",
  summaryTargetMissing:"[välj målmapp]",
  summaryValueMissing:"[värde saknas]",
  summarySubject:"ämnet",
  summarySender:"avsändaradressen",
  summaryDomain:"avsändardomänen",
  summaryRecipient:"mottagarfältet",
  summaryCc:"kopia/hemlig kopia",
  summarySize:"storleken",
  summaryDate:"mejlets datum",
  summaryDays:"dagar",
  summaryQuoted:"”{value}”",
  summaryTiming:"Läsval: {mode}.",
  summaryUnread:"Val för olästa: {action}.",
  summaryYear:"Årsmappar är på: mejlets år används som undermapp under valt mål.",
  summaryBranches:"Om grundvillkoren stämmer används den första fördelningen som matchar. Annars används målmappen ovan.",
  summaryBranch:"Om {condition}, använd {target}.",
  summaryDisabled:"Regeln är avstängd.",
  summaryNote:"Sammanfattningen visar fälten i redigeraren. Den sparar eller flyttar ingenting. Regelprioritet och säkerhetskontroller gäller fortfarande.",
  matchAll:'Alla ska stämma',
  matchAny:'Minst ett ska stämma',
  step2Help:'Lägg till upp till 8 villkor, till exempel ämnesord eller avsändare. Standard för nya regler: minst ett villkor ska stämma – inte alla.',
  colField:'Fält',
  colOp:'Villkor',
  colValue:'Värde',
  addConditionBtn:'＋ Lägg till villkor',
  step3Title:'Vart och när ska mejlen flyttas?',
  targetLabel:'Välj målmapp',
  chooseTarget:'Välj en målmapp…',
  browseFolders:"Bläddra bland mappar…",
  folderTreeTitle:"Välj målmapp",
  folderTreeParentTitle:"Välj överordnad mapp",
  folderTreeHelp:"Välj konto, fäll ut mapparna och markera ditt mål. Inget ändras förrän du bekräftar.",
  folderTreeLabel:"Mappar i valt konto",
  folderTreeChoose:"Välj denna mapp",
  folderTreePending:"Markerad mapp",
  folderTreeNoSelection:"Markera en mapp i trädet.",
  folderTreeCount:"Mappar: {n}",
  folderTreeKeyHelp:"Tangentbordshjälp",
  folderTreeNavigation:"Piltangenter bläddrar. Höger/vänster fäller ut/in. Enter eller mellanslag markerar; knappen nedan bekräftar.",
  folderTreeStructure:"(sökväg – inte valbar)",
  folderTreeExpand:"Fäll ut {name}",
  folderTreeCollapse:"Fäll ihop {name}",
  targetAccountLabel:"1. E-postkonto för målmappen",
  targetFolderLabel:"2. Mapp i valt konto",
  targetSearchLabel:"Sök mapp",
  targetSearchPlaceholder:"Sök i hela mappsökvägen…",
  targetAccountFirst:"Välj e-postkonto först…",
  targetEmpty:"Inga mappar matchar sökningen.",
  targetMissing:"Målmappen saknas. Välj konto och mapp igen.",
  targetSelected:"Vald mapp",
  matchAllHelp:"Alla villkor måste stämma på samma mejl. Två ämnesvillkor kräver att båda texterna finns i ämnet.",
  matchAnyHelp:"Minst ett villkor räcker. Avsändare och ämne krävs inte samtidigt i detta läge.",
  testConditionYes:"Stämmer",
  testConditionNo:"Stämmer inte",
  testPaused:"Sorteringen är pausad.",
  testDryRun:"Testläge är på: inga mejl flyttas.",
  testTrial:"Regeln provkörs: inga mejl flyttas.",
  testStopped:"Sorteringen är stoppad av ett fel. Kontrollera statusen.",
  ruleMoveUnreadLabel:'Flytta även olästa mejl direkt (annars väntar de tills du har läst dem)',
  unreadMoveNote:'Kryssad ruta: olästa mejl som matchar regeln flyttas direkt. Omarkerad: de ligger kvar och flyttas först när du har läst dem.',
  ruleOpenWindowLabel:'Öppna olästa mejl i ett nytt fönster',
  unreadChoiceTitle:'Olästa mejl – välj vad som ska hända',
  unreadChoiceNote:'Fönstervalet gäller olästa mejl som regeln får behandla. Välj nedan om de ska öppnas före eller efter flytten.',
  ruleTrialLabel:'Provkör i 7 dagar innan regeln flyttar något',
  trialNote:'Under provkörningen räknar regeln bara hur många mejl den skulle flytta. Ingenting flyttas, och regeln påverkar inte de andra reglerna. Efter sju dagar frågar SortBro om du vill aktivera den.',
  trialBadge:'TEST',
  trialDaysLeft:'{n} dagar kvar',
  trialDayLeft:'1 dag kvar',
  trialTitle:'Provkörningen är slut',
  trialWould:'Regeln ”{name}” skulle ha flyttat {n} mejl.',
  trialWouldOne:'Regeln ”{name}” skulle ha flyttat 1 mejl.',
  trialWouldNone:'Regeln ”{name}” matchade inga mejl under provkörningen.',
  trialActivate:'Aktivera regeln',
  trialExtend:'Förläng 7 dagar',
  trialOff:'Stäng av regeln',
  trialActivated:'Regeln är aktiverad.',
  trialExtended:'Provkörningen fortsätter i 7 dagar.',
  trialOffDone:'Regeln är avstängd.',
  learnTitle:'Lär av din flytt',
  learnBody:'Du har flyttat {n} mejl från {domain} till {target}. Vill du att SortBro sköter det åt dig?',
  learnCreate:'Skapa regel',
  learnSnooze:'Inte nu',
  learnOff:'Sluta föreslå',
  learnCreated:'Regeln är skapad. Granska den innan den flyttar något.',
  learnExisting:'Det finns redan en regel för den här avsändaren och mappen.',
  learnOffDone:'SortBro föreslår inga fler regler från dina flyttar.',
  learnOnLabel:'Lär av mina egna flyttar och föreslå regler',
  learnOnNote:'Flyttar du själv tre mejl från samma avsändare till samma mapp föreslår SortBro en regel. Bara domän, mapp och antal sparas, i högst sju dagar – aldrig ämne, namn eller mejltext.',
  inlineMoveUnread:'Flytta även olästa mejl direkt',
  inlineOpenWindow:'Öppna i nytt fönster',
  readFilterLabel:'Flytta olästa / lästa mejl för denna regel',
  rfDefault:'Enligt standardinställning (lästa + nya i Inkorgen)',
  rfRead:'Endast lästa mejl (vänta tills mejlet är läst och lämnat)',
  rfBoth:'Både olästa och lästa mejl (flytta direkt)',
  rfUnread:'Endast olästa mejl (flytta direkt)',
  unreadActionLabel:'När olästa mejl flyttas av denna regel',
  uaDefault:'Enligt standardinställning (Inställningar)',
  uaKeep:'Behåll som oläst i målmappen (utan popup-fönster)',
  uaWindow:'Öppna i nytt fönster (tidpunkt väljs ovan)',
  uaRead:'Markera som läst vid flytt',
  branchSummary:'Avancerat: olika mål beroende på ämne',
  branchNote:'Första fördelningen som matchar styr målmappen. Övriga mejl går till målmappen ovan.',
  addBranchBtn:'＋ Lägg till fördelning',
  testBtn:'▷ Kontrollera',
  saveBtn:'Spara automatisk flytt',
  saveAsNewBtn:'＋ Spara som ny regel',
  saveAndNewBtn:'＋ Spara & ny tom',
  upBtn:'↑ Prioritet',
  downBtn:'↓ Prioritet',
  duplicateBtn:'⧉ Duplicera regel',
  deleteBtn:'Ta bort regel',
  safetyTitle:'Testläge är en trygg start.',
  safetyBody:'Testa dina regler innan du aktiverar riktiga flyttar. Testknappen flyttar aldrig något.',
  queueSelectedBtn:'Bevaka markerat →',
  catchUpBtn:'Sortera befintliga enligt regeln →',
  activityTitle:'Teknisk aktivitet',
  activitySub:'Inga ämnesrader, avsändaradresser eller mejltexter sparas här.',
  exportLogBtn:'Exportera logg',
  exportErrorLogBtn:'Spara samlad fellogg',
  thTime:'Tid',
  thEvent:'Händelse',
  thLevel:'Nivå',
  thCount:'Antal',
  settingsTitle:'Utseende & grundläge',
  langLabel:'Språk / Language',
  themeLabel:'Tema',
  themeSystem:'Följ systemet',
  themeLight:'Ljust',
  themeDark:'Mörkt',
  moveModeLabel:'Standardläge för regler (när regeln står på Standard)',
  moveModeRead:'Flytta när läst och lämnat',
  moveModeDirect:'Flytta direkt, även olästa',
  openWindowLabel:'Öppna flyttade olästa mejl i ett eget fönster som standard',
  unreadNote:'Du kan även styra per regel om olästa mejl ska behållas olästa utan fönster, öppnas i fönster eller markeras som lästa.',
  hourlyLabel:'Kör alla regler automatiskt (rekommenderas)',
  sweepMinutesLabel:'Hur ofta alla regler körs (minuter, steg om 15 – 60 = en gång i timmen)',
  newInboxDirectLabel:'Flytta nya matchande mejl direkt när de kommer till Inkorgen',
  verboseLabel:'Visa detaljerad felsökning i Aktivitet',
  fileLogLabel:'Skriv teknisk logg automatiskt till Hämtade filer/Lasfilter/logs/lasfilter-logg.txt',
  storageNote:'Automatiska filer och vanliga exporter hamnar i undermappar till appmappen Hämtade filer/Lasfilter/: logs (loggfilen), Regelbackuper (säkerhetskopiorna), Regler (dina exporter) och Filterfiler (msgFilterRules.dat). Inget hamnar löst i Hämtade filer. Med Spara logg som… under Aktivitet väljer du själv mapp för en manuell kopia.',
  fileLogNote:'Skriver även sortbro-fellogg.txt i samma mapp: en samlad fellogg med de senaste 30 dagarnas fel (högst 5 000). Ingen mejltext sparas. Du kan också spara felloggen under Aktivitet.',
  autoBackupLabel:'Backa upp reglerna automatiskt en gång per vecka till Hämtade filer/Lasfilter/Regelbackuper/',
  brakeLabel:'Säkerhetsbroms: stanna en regel som plötsligt matchar onormalt många mejl',
  toastBrakeOn:'Säkerhetsbromsen är på: en regel som plötsligt matchar för många stoppas innan något flyttas.',
  toastBrakeOff:'Säkerhetsbromsen är av. En felaktig regel kan då flytta hela inkorgen utan att fråga.',
  brakeNote:'Om en regel vill flytta tio gånger fler mejl än vanligt – och minst 50 – stoppas den innan något flyttas. Du får då välja: flytta ändå eller stäng av regeln. Nya regler har gränsen 50 mejl per svep.',
  brakeWarnTitle:'Säkerhetsbromsen stoppade en regel',
  brakeWarnText:'Regeln "{name}" ville flytta {n} mejl. Gränsen är {limit} och regeln brukar flytta {median}. Inget mer flyttas förrän du väljer.',
  brakeWarnNever:'inget',
  brakeWarnMove:'Flytta ändå',
  brakeWarnStop:'Stäng av regeln',
  brakeWarnDelete:'Ta bort regeln',
  brakeDeleteConfirm:'"{name}" tas bort helt. Ingenting flyttas, och regeln slutar leta efter mejl.\n\nEn kopia av reglerna sparas först, så den går att hämta tillbaka under Regelkopior & säkerhet.\n\nTa bort regeln?',
  brakeDeleted:'Regeln "{name}" togs bort. Ingenting flyttades.',
  cacheTitle:'Cache',
  cacheSub:'SortBro minns varje mapps meddelandetal så att ett svep kan hoppa över mappar som inte ändrats. Det gör svepen snabba. Cachen töms automatiskt en gång i dygnet, så att den aldrig kan visa en gammal bild av inkorgen.',
  autoClearLabel:'Rensa cachen automatiskt en gång per dygn',
  clearCacheBtn:'Rensa cachen nu',
  cacheNote:'Att rensa cachen flyttar inga mejl och ändrar inga regler. Nästa svep läser bara om mapparnas storlek, vilket tar några sekunder extra en gång.',
  cacheNever:'Inte rensad sedan tillägget startades.',
  cacheToday:'Senast rensad i dag {time}.',
  cacheYesterday:'Senast rensad i går {time}.',
  cacheDaysAgo:'Senast rensad för {n} dagar sedan.',
  cacheCleared:'Cachen rensad: {n} mappar läses om vid nästa svep.',
  cacheBusy:'Vänta tills flytten är klar – då rensas cachen direkt.',
  cacheOff:'Automatisk rensning är avstängd. Knappen fungerar ändå.',
  brakeReleased:'Regeln "{name}" släpptes och flyttar nu {n} mejl.',
  brakeStopped:'Regeln "{name}" stängdes av. Inget flyttades.',
  conflictTitle:'Kan krocka med "{name}" – båda kan matcha samma mejl ({fields}).',
  conflictWinner:'Den här regeln ligger först och vinner.',
  conflictLoser:'Den regeln ligger först och vinner. Flytta upp den här om den ska gälla i stället.',
  whyBtn:'🔍 Varför ligger mejlet här?',
  whyRunning:'Läser det markerade mejlet…',
  whyTitle:'Varför ligger mejlet här?',
  whySubject:'"{subject}" från {author}',
  whyNoRule:'Ingen aktiv regel matchar det här mejlet. Det ligger där det ligger.',
  whyWinner:'Regeln "{name}" gäller och skulle flytta mejlet till {target}.',
  whyWinnerHeld:'Regeln "{name}" gäller men är stoppad av säkerhetsbromsen – inget flyttas förrän du svarar.',
  whyAlready:'Mejlet ligger i målmappen {target} – det är hit regeln "{name}" skickar det.',
  whyArrived:'Mejlet ligger redan på plats.',
  whyNoTarget:'Regeln "{name}" gäller men målmappen hittades inte.',
  whyBlockedBy:'Det som stoppar flytten:',
  whyNoMatch:'Ingen regel matchar. Så här nära var de:',
  whyClosest:'{name} – {hit} av {total} villkor stämmer',
  whyAllRules:'Alla regler som prövas',
  whyRuleOk:'matchar',
  whyRuleNo:'matchar inte',
  whyRuleOff:'avstängd',
  whyRuleOtherFolder:'annan mapp',
  whyRuleHeld:'stoppad',
  whyNoSelection:'Markera ett mejl i Thunderbird först – ett enda mejl.',
  whyFooter:'Uppslaget läser bara mejlets huvuden och ändrar ingenting.',
  conflictWinner:'Den här regeln ligger först och vinner.',
  conflictLoser:'Den regeln ligger först och vinner. Flytta upp den här om den ska gälla i stället.',
  autoBackupNote:'Kopian ligger utanför Thunderbirds profil, så den finns kvar även om tillägget tas bort eller stängs av. Den skrivs automatiskt en gång i veckan: sortbro-regler-backup.json är den senaste, och de senaste 12 veckorna behålls som daterade kopior. Vill du inte vänta till nästa vecka skriver knappen nedan båda direkt. Under Regler importerar du filen och får tillbaka reglerna.',
  backupLastWeek:'Senaste veckokopian skrevs: {week} · nästa skrivs automatiskt i en ny vecka',
  backupNoWeek:'Ingen veckokopia skriven än – den skrivs automatiskt vid första starten i en ny vecka, eller direkt med knappen nedan.',
  backupNowBtn:'⇩ Backa upp reglerna nu',
  backupNowDone:'Reglerna backades upp: {n} st i {name}',
  backupNowUnchanged:'Inga ändringar sedan förra kopian – filen är redan aktuell.',
  backupNowFailed:'Kopian kunde inte skrivas till Hämtade filer. Kontrollera att Thunderbird får spara filer på datorn.',
  toastAutoBackupOn:'Reglerna backas upp automatiskt när de ändras.',
  toastAutoBackupOff:'Automatisk säkerhetskopia avstängd.',
  shortcutsNote:'Alt+Shift+L öppnar Läsfilter även om verktygsikonen inte syns. Ctrl+Shift+L kör ett svep direkt.',
  fontSizeLabel:'Textstorlek',
  refreshFoldersBtn:'Uppdatera mapplistan',
  windowNote:'Thunderbird hanterar fönstrets storlek och placering. Tillägget minns språk, tema, textstorlek och senast valda regel.',
  backupsTitle:'Regelkopior & säkerhet',
  backupsSub:'De fem senaste regelversionerna sparas automatiskt. Återställning startar pausad i testläge.',
  clearBlockedBtn:'Rensa spärrar efter egen kontroll',
  clearBlockedNote:'Detta ångrar ingen flytt och startar inget nytt försök. Kontrollera mapparna i Thunderbird först.',
  helpTitle:'En lugnare inkorg, på dina villkor',
  helpStep1:'Välj kontot som ska bevakas, ett eller flera villkor, läst/oläst-läge och en målmapp. Du kan skapa hur många regler du vill.',
  helpStep2:'Använd Hämta konto från markerat mejl för att välja rätt konto och avsändare automatiskt. Markera exakt ett mejl i Thunderbird först.',
  helpStep3:'Kontrollera-knappen testar den redigerade regeln (även osparade ändringar) utan att flytta mejlet.',
  helpStep4:'För varje regel kan du välja om den ska flytta Endast lästa, Både olästa och lästa, Endast olästa, eller följa standardinställningen – samt hur flyttade olästa mejl ska hanteras.',
  helpStep5:'Använd Spara & ny regel eller Duplicera regel för att snabbt bygga upp flera regler för olika avsändare, domäner eller ämnen.',
  helpImportantTitle:'Det här är viktigt',
  helpP1:'”Läst” är Thunderbirds läst-markering. När en regel väntar på läsning flyttas mejlet först när det är läst och inte längre visas i någon öppen mejlflik eller något meddelandefönster.',
  helpP2:'Med Kör kontroll nu eller ▶-knappen på en regel skannas kontots mappar (utom regelns målmappar) efter matchande mejl enligt regelns inställning för olästa/lästa.',
  helpP3:'En regel kan även ha underfördelningar (Avancerat: olika mål beroende på ämne), t.ex. domän fortnox.se som grundvillkor och sedan Ämne innehåller Faktura → Fakturor och Ämne innehåller Order → Order.',
  helpP4:'Tillägget ändrar aldrig Thunderbirds inbyggda filterfiler (msgFilterRules.dat) och använder inga molntjänster.',
  helpP5:'Nya versioner hämtas av Thunderbird själv – den letar vid start och sedan en gång i dygnet. Tillägget kan inte installera sig självt, men filen Uppdatera-SortBro.bat gör samma sak med ett dubbelklick om du inte vill vänta.',
  footerRight:'Egna regler · Inga ändringar i msgFilterRules.dat',
  policyDefaultTitle:'Först läst (eller direkt vid nyinkommet i Inkorgen).',
  policyDefaultBody:'Följer standardinställningen: lästa mejl flyttas när de lämnats i 2 sekunder, och nya mejl i Inkorgen kan flyttas direkt. Kryssa i ”Flytta även olästa mejl direkt” om regeln ska flytta olästa mejl i alla mappar med en gång.',
  policyReadTitle:'Först läst. Sedan lämnat.',
  policyReadBody:'Flyttar endast lästa mejl och väntar minst två sekunder utan visning i någon mejlflik eller något fönster.',
  policyBothTitle:'Både olästa och lästa flyttas direkt.',
  policyBothBody:'Den här regeln flyttar både olästa och lästa matchande mejl direkt utan att vänta på att mejlet stängs.',
  policyUnreadTitle:'Endast olästa mejl flyttas direkt.',
  policyUnreadBody:'Den här regeln flyttar endast olästa matchande mejl direkt. Redan lästa mejl lämnas kvar.',
  pillStopped:'STOPPAD',
  pillPaused:'PAUSAD',
  pillTest:'TEST · FLYTTAR INGET',
  pillActive:'AKTIV · FLYTTAR MEJL',
  pillDisconnected:'Inte ansluten',
  pauseResume:'Starta bevakning',
  pauseBtn:'Pausa',
  modeEnable:'Slå på riktiga flyttar',
  modeTest:'Byt till testläge',
  guideActiveTitle:'Riktiga flyttar är aktiva',
  guideActiveReady:'Nya matchande mejl bevakas. Kör kontroll nu för att även skanna befintliga mejl.',
  guideActiveNoRules:'Skapa och aktivera minst en regel för att börja.',
  guideFaultTitle:'Flyttmotorn är stoppad',
  guideFaultTail:' Öppna Aktivitet och kontrollera den senaste raden.',
  guidePausedTitle:'Bevakningen är pausad',
  guidePausedBody:'Inga nya mejl köas eller flyttas. Klicka Starta bevakning när du vill fortsätta.',
  guideTestTitle:'Testläge – inga mejl flyttas',
  guideTestReady:'Reglerna kan matcha och räknas som test, men mapparna ändras inte. Slå på riktiga flyttar när resultatet ser rätt ut.',
  guideTestNoRules:'Skapa en regel. Testläget är säkert och flyttar ingenting.',
  sweepQueueNow:'Kontrollera kön nu',
  sweepRunNow:'Kör kontroll nu',
  sweepChecking:'Kontrollerar…',
  noticeStoppedPrefix:'STOPPAD: ',
  noticeStoppedSuffix:' Inga fler automatiska försök görs innan problemet är åtgärdat.',
  lastCheckPrefix:'Senaste kontroll: ',
  lastCheckCountSuffix:' mejl kontrollerade sedan start',
  lastCheckWaiting:'Bevakningen väntar på ett matchande mejl',
  emptyNoMatch:'Ingen regel matchar sökningen.',
  emptyNoRules:'Börja med en ny regel. Inga exempelregler aktiveras på dina mejl.',
  missingFolder:'Mapp saknas – välj igen',
  missingFolderShort:'Mapp saknas',
  confirmDiscard:'Lämna osparade ändringar?',
  confirmDiscardEditor:'Lämna osparade ändringar i redigeraren?',
  fieldSenderShort:'Från',
  fieldDomainShort:'Domän',
  fieldSubjectShort:'Ämne',
  fieldRecipientShort:'Till',
  fieldCcShort:'Kopia',
  fieldSizeShort:'Storlek',
  fieldDateShort:'Datum',
  moreConditionsSuffix:' villkor',
  scopeAccount:'Hela kontot',
  scopeFolder:'Vald mapp',
  tagDisabled:'Avstängd',
  tagDefault:'efter läsning',
  tagRead:'endast lästa',
  tagBoth:'olästa & lästa direkt',
  tagUnread:'endast olästa direkt',
  runRuleNowTitle:'Kör denna regel nu',
  dupRuleTitle:'Duplicera denna regel',
  maxBranches:'Högst åtta fördelningar per regel.',
  maxConditions:'Högst åtta villkor per regel.',
  minConditions:'Behåll minst ett villkor.',
  optSubject:'Ämne',
  optSender:'Från (adress)',
  optDomain:'Avsändardomän',
  opContains:'innehåller',
  opEquals:'är exakt',
  opStarts:'börjar med',
  opEnds:'slutar med',
  branchPlaceholder:'Exempel: Faktura',
  condPlaceholder:'Exempel: fortnox.se',
  noLogsYet:'Inga händelser ännu.',
  rulesCountSuffix:' regler',
  restoreBtn:'Återställ',
  confirmRestore:'Återställ denna regelversion? Nuvarande regler säkerhetskopieras. Bevakningen blir pausad i testläge.',
  toastRestored:'Regelversion återställd. Testa innan du aktiverar.',
  backupHint:'En kopia skapas när du sparar din första regeländring.',
  blockedSome:' spärrade/osäkra försök. Kontrollera mapparna i Thunderbird innan spärrarna rensas.',
  blockedNone:'Inga osäkra flyttförsök.',
  toastRuleSaved:'Regeln sparad. Testa den på ett markerat mejl.',
  toastSavedAndNew:'Regeln sparad! Fyll i nästa regel nedan.',
  toastDuplicated:'Regeln duplicerad som ny regel – anpassa och tryck Spara.',
  defaultRulePrefix:'Mejl från ',
  defaultSubjectPrefix:'Ämne: ',
  defaultSenderFallback:'avsändaren',
  copySuffix:' (kopia)',
  toastFromSelected:'Hämtat från markerat mejl! Välj nu målmappen och tryck Spara.',
  toastQuickAdded:'Regeln skapades och ligger i listan. Kör den med ▶ Kör alla regler nu, eller lägg till nästa direkt.',
  testReasonNoMatch:'Villkoren matchar inte det markerade mejlet.',
  testReasonDisabled:'Villkoren matchar, men regeln är avstängd.',
  testReasonUnread:'Villkoren matchar, men mejlet är oläst. Ingen flytt får ske.',
  testReasonAlreadyRead:'Villkoren matchar, men mejlet är redan läst och regeln gäller endast olästa mejl.',
  testReasonDisplayed:'Villkoren matchar. Mejlet är läst men fortfarande öppet i en mejlflik eller ett fönster.',
  testReasonEligible:'Villkoren matchar. Mejlet uppfyller regelns krav och är redo att flyttas.',
  testNoMove:' Testet flyttar ingenting. ',
  testTargetPrefix:'Mål: ',
  testTail:'Testet gäller bara regeln i redigeraren och bortser från vilken mapp mejlet ligger i.',
  testOutside:' Mejlet ligger just nu utanför källmappen: bevakningen flyttar nya mejl som kommer till källmappen, och "Sortera befintliga" flyttar redan befintliga mejl oavsett mapp.',
  confirmDelete:'Ta bort regeln? En regelkopia sparas. Inga mejl tas bort.',
  saveBeforePriority:'Spara regeln innan du ändrar prioritet.',
  confirmEnableLive:'Aktivera riktiga mejlflyttar enligt dina aktiva regler?\n\nBörja med en provmapp och granska Testa-resultaten. Väntande testjobb rensas.',
  toastLiveOn:'Flyttläge aktiverat enligt dina aktiva regler.',
  toastTestOn:'Testläge aktiverat. Inga nya flyttar startas.',
  toastQueued:'Mejlet är nu köat enligt regeln.',
  toastAlreadyQueued:'Redan hanterat eller köat i denna session.',
  saveFirst:'Spara regeln först.',
  openRuleFirst:'Öppna eller skapa en regel först.',
  confirmCatchUp:'Skanna kontots mappar, inklusive undermappar men utan regelns målmappar, efter befintliga mejl som matchar den sparade regeln?\n\nI testläge räknas träffar som prov utan flytt.',
  confirmImport:'Ersätt nuvarande regler med reglerna från JSON-filen? (En säkerhetskopia sparas automatiskt.)',
  confirmImportMerge:'Lägg till reglerna från JSON-filen till dina befintliga regler?',
  toastImported:'Reglerna importerades från JSON-filen!',
  toastMerged:'Reglerna från JSON-filen lades till!',
  toastExported:'Reglerna exporterades till {path}.',
  logExported:'Loggen exporterades till {path}.',
  toastSingleExported:'Regeln exporterades till {path}.',
  toastCleared:'Spärren är rensad och bevakningen är igång igen.',
  toastModeDirect:'Direktläge: nya matchande mejl flyttas även olästa.',
  toastModeRead:'Nya mejl flyttas när de är lästa och lämnade.',
  toastOpenWindowOn:'Olästa flyttade mejl öppnas i eget fönster som standard.',
  toastOpenWindowOff:'Olästa flyttade mejl stannar i målmappen utan popup-fönster.',
  toastVerboseOn:'Detaljlogg på: händelser syns under Aktivitet och i exporten.',
  toastVerboseOff:'Detaljlogg av.',
  toastFileLogOn:'Loggfil på: Hämtade filer/Lasfilter/logs/lasfilter-logg.txt uppdateras automatiskt.',
  toastFileLogOff:'Automatisk loggfil av.',
  toastSweepIntervalPrefix:'Kontosvep körs var ',
  toastSweepIntervalSuffix:':e minut.',
  toastInboxDirectOn:'Nya matchande mejl i Inkorgen flyttas direkt.',
  toastInboxDirectOff:'Direktflytt av nyinkomna mejl är avstängd.',
  toastFoldersRefreshed:'Konton och mappar uppdaterade.',
  toastLangChanged:'Språk ändrat till svenska.',
  seasonLabel:'Årstidstema',
  seasonLabelShort:'Årstid',
  seasonAuto:'Auto · följer kalendern',
  seasonSpring:'🌸 Vår',
  seasonSummer:'☀️ Sommar',
  seasonAutumn:'🍂 Höst',
  seasonWinter:'❄️ Vinter',
  seasonNote:'Årstiden färgar gränssnittet, hälsningen, landskapet och SortBro-ikonen i verktygsfältet – i både ljust och mörkt läge.',
  seasonHeroSpring:'Vår',
  seasonHeroSummer:'Sommar',
  seasonHeroAutumn:'Höst',
  seasonHeroWinter:'Vinter',
  seasonGreetingSpring:'Ha en fin vårdag! 🌸',
  seasonGreetingSummer:'Ha en skön sommar! ☀️',
  seasonGreetingAutumn:'Ha en fin höstdag! 🍂',
  seasonGreetingWinter:'Ha en fin vinterdag! ❄️',
  seasonChanged:'Årstidstema uppdaterat.',
  optRecipient:'Till (mottagare)',
  optCc:'Kopia (Cc)',
  optSize:'Storlek',
  optDate:'Datum',
  opLarger:'Är större än',
  opSmaller:'Är mindre än',
  opOlder:'Är äldre än',
  opNewer:'Är nyare än',
  opBeforeYear:'Är före år',
  opAfterYear:'Är efter år',
  condPlaceholderSize:'Antal kB, t.ex. 500',
  condPlaceholderDate:'Antal dagar eller årtal, t.ex. 90 eller 2025',
  condPlaceholderRecipient:'t.ex. faktura@ eller min adress',
  condPlaceholderCc:'t.ex. ekonomi@',
  runAllRulesBtn:'▶ Kör alla regler nu',
  runAllRulesCount:'▶ Kör alla regler nu ({n})',
  runAllScanned:'Granskade {n} mejl i {f} mappar.',
  runAllQueued:'{n} matchade och köades.',
  runAllDeferred:'{n} väntar till nästa körning (max 100 i kö).',
  runAllCached:'{n} oförändrade mappar hoppades över.',
  runAllSkipped:'{n} otillgängliga mappar hoppades över.',
  runAllTestMode:'Testläge: inga mejl flyttades.',
  runAllTrial:'{n} regel är i provkörning och räknade bara.',
  runAllPaused:'Bevakningen är pausad – inga regler kördes. Tryck Pausa igen för att återuppta.',
  runAllInTarget:'{n} matchade reglerna men ligger redan i målmappen (eller i sin årsmapp).',
  runAllHandled:'{n} var redan hanterade sedan tidigare.',
  runAllNoMatch:'Inga mejl matchade reglerna – öppna regeln och tryck 🔎 Varför flyttas inte mejlen?',
  runAllStopped:'Motorn är stoppad av ett fel – inga regler kördes. Meddelande: {code}',
  runAllBusy:'En körning pågår redan – vänta några sekunder och tryck igen.',
  runAllWaited:'En körning pågick redan, så siffrorna gäller hela körningen.',
  autoRunOn:'Automatiskt: {n} regler körs var {min}:e minut, nästa gång {time}. Inkommande mejl bevakas hela tiden.',
  autoRunOff:'Automatisk körning är av – slå på den under Inställningar → Sortering & säkerhet. Inkommande mejl bevakas ändå hela tiden.',
  diagnoseBtn:'🔎 Varför flyttas inte mejlen?',
  diagnoseTitle:'Varför flyttas inte mejlen?',
  diagnoseRunning:'Undersöker kontots mappar – inget flyttas…',
  diagnoseSummary:'Granskade {s} mejl i {f} mappar. {m} matchade regeln. Regelns läsläge: {rf}.',
  diagnoseWouldMove:'{n} mejl är redo – de flyttas vid nästa körning.',
  diagnoseUnread:'{n} matchande mejl är olästa och väntar tills du har läst dem. Kryssa i ”Flytta även olästa mejl direkt” i steg 3 om de ska flyttas utan att vänta.',
  diagnoseInTarget:'{n} mejl ligger redan i målmappen (eller i sin årsmapp).',
  diagnoseQueued:'{n} mejl är redan hanterade eller köade sedan tidigare.',
  diagnoseNoMatch:'Inga mejl matchar villkoren. Kontrollera fält, värde och konto – eller använd Kontrollera på ett markerat mejl.',
  diagnoseExamples:'Exempel på matchande mejl',
  diagnoseNearTitle:'Så här ser mejlen i mapparna ut',
  diagnoseCondTitle:'Villkor för villkor – antal mejl som stämmer',
  diagnoseCondHits:'{n} träffar',
  diagnoseCondZero:'0 träffar',
  diagnoseCondNoValue:'inget värde',
  diagnoseCondDeadAll:'Regeln kräver att alla villkor stämmer, men {n} av dem har 0 träffar – därför flyttas ingenting. Ta bort villkoret eller byt till "minst ett av villkoren".',
  diagnoseCondDeadAny:'{n} villkor har 0 träffar. Med "minst ett av villkoren" räcker det att något av de andra stämmer.',
  diagnoseAnyTitle:'Med "minst ett av villkoren" skulle {n} mejl matcha',
  diagnoseAnyNote:'Villkoren ser ut som olika varianter av samma sorts mejl. Då ska de kopplas ihop med ELLER i stället för OCH: "minst ett av villkoren" flyttar ett mejl så snart något av villkoren stämmer.',
  diagnoseFixAny:'✔ Byt till "minst ett av villkoren"',
  diagnoseAnyDone:'Klart: regeln använder nu "minst ett av villkoren" och alla regler kördes.',
  diagnoseNearNote:'Inget av dem matchar regelns villkor. Jämför ämne och avsändare med villkoren i steg 2 – ett kortare ämne, eller Avsändare (innehåller), fångar oftast fler mejl.',
  diagnoseFixUnread:'✔ Tillåt olästa mejl och flytta dem nu',
  diagnoseReasonMove:'flyttas',
  diagnoseReasonUnread:'oläst – väntar',
  diagnoseReasonTarget:'redan i målmappen',
  diagnoseReasonQueued:'redan hanterad',
  diagnosePaused:'Tillägget är pausat. Tryck Pausa igen för att återuppta bevakningen.',
  diagnoseFault:'Motorn är stoppad av ett fel. Rensa spärren och fortsätt.',
  diagnoseStopped:'Tillägget är stoppat i denna session, så inget flyttas just nu.',
  diagnoseDryRun:'Testläge är på: träffarna räknas som prov och inget flyttas förrän du slår på flytt.',
  opBeforeThisYear:'Är före innevarande år',
  opAfterThisYear:'Är efter innevarande år',
  condPlaceholderThisYear:'Behöver inget värde – följer kalendern',
  ruleYearFoldersLabel:'Valfritt: lägg varje år i en egen årsmapp under målmappen (t.ex. Arkiv/2025)',
  yearFoldersNote:'Avstängt som standard – kryssa bara i om du vill ha en egen mapp per år. Årsmappen skapas automatiskt när den behövs.',
  tagYearFolders:'🗓️ årsmappar',
  tplOlder90:'Arkivera äldre mejl',
  tplNameOlder90:'Arkiv – äldre än 90 dagar',
  templateLabel:'1-klicksmallar:',
  tplInvoice:'Fakturor & Kvitton',
  tplOrder:'Order & Leverans',
  tplNews:'Nyhetsbrev',
  tplSystem:'System & Notiser',
  tplBookkeeping:'Bokföring',
  tplNameInvoice:'Fakturor & kvitton',
  tplNameOrder:'Order & leveranser',
  tplNameNews:'Nyhetsbrev',
  tplNameSystem:'System & notiser',
  tplNameBookkeeping:'Bokföring',
  tplApplied:'Mallen är ifylld. Välj målmapp och spara regeln.',
  tplTargetHint:'Tips: skapa målmappen med ＋ Ny mapp.',
  newFolderBtn:'＋ Ny mapp',
  newFolderEyebrow:'NY MAPP I THUNDERBIRD',
  newFolderTitle:'Skapa en ny målmapp',
  newFolderHelp:'Mappen skapas direkt i ditt konto. Välj namn och var den ska ligga.',
  newFolderParentLabel:'Placera i',
  newFolderNameLabel:'Mappnamn',
  newFolderCreate:'＋ Skapa mapp',
  newFolderNote:'SortBro rör inga andra mappar och raderar aldrig något.',
  newFolderRoot:'Kontots rotmapp',
  cancelBtn:'Avbryt',
  toastFolderCreated:'Mappen skapades i Thunderbird och är vald som mål.',
  toastPrefill:'Ny regel från mejlet du högerklickade på.',
  errors:{
   bad_branch:'Ogiltig fördelning. Varje fördelning behöver ett villkor och en målmapp.',
   bad_folder_name:'Ange ett mappnamn på 1–64 tecken utan snedstreck.',
   folder_exists:'Det finns redan en mapp med det namnet.',
   folder_create_failed:'Mappen kunde inte skapas i Thunderbird.',
   disabled:'Regeln är avstängd. Aktivera den först.',
   bad_domain:'Ange en fullständig domän, exempelvis fortnox.se.',
   bad_rule:'Ogiltig regel.',
   bad_id:'Ogiltigt regel-id.',
   bad_name:'Ange ett regelnamn, högst 100 tecken.',
   choose_source:'Välj en källmapp.',
   choose_target:'Välj en målmapp.',
   same_folder:'Källa och mål får inte vara samma mapp.',
   bad_match:'Välj hur villkoren ska kombineras.',
   bad_conditions:'En regel behöver 1–8 villkor.',
   bad_field:'Ogiltigt fält.',
   bad_operator:'Ogiltigt villkor för det valda fältet.',
   bad_value:'Varje villkor behöver ett värde med högst 256 tecken.',
   too_many_rules:'Högst 200 regler stöds.',
   duplicate_id:'Filen innehåller upprepade regel-id:n.',
   rule_cycle:'Reglerna skulle skapa en flyttloop. Ändra käll- eller målmapp.',
   unsafe_folder:'Välj en vanlig mapp, inte en specialmapp eller sökmapp.',
   same_account:'Välj källa och mål i samma konto i denna version.',
   read_only:'Mappen tillåter inte en riktig flytt. Ingen kopiering görs som reserv.',
   bad_schema:'Regelfilen har ett okänt eller ogiltigt format.',
   no_selection:'Öppna en mejlflik och markera ett meddelande där först.',
   one_message:'Markera exakt ett meddelande i den senaste mejlfliken.',
   stale_config:'Reglerna har ändrats. Öppna den sparade regeln igen innan du sparar.',
   paused:'Bevakningen är pausad eller spärrad.',
   unread:'Meddelandet är oläst och regeln tillåter endast lästa mejl.',
   already_read:'Meddelandet är redan läst och regeln gäller endast olästa mejl.',
   no_match:'Ingen aktiv regel matchar det markerade meddelandet.',
   operation_running:'En flytt pågår. Vänta tills Thunderbird har svarat.',
   uncertain_move:'Ett flyttförsök fick osäkert svar. Klicka på "Rensa spärr och fortsätt" (eller under Inställningar) för att återuppta bevakningen.',
   log_save_failed:'Loggkopian kunde inte exporteras. Ingen reservkopia har sparats till en annan mapp. Försök igen och välj en skrivbar mapp.',
   log_save_unavailable:'Spara-dialogen är inte tillgänglig. Öppna SortBro i Thunderbird och försök igen.',
   storage_error:'Inställningarna kunde inte sparas. Motorn är stoppad i denna session.',
   invalid_storage:'Lagrade inställningar kunde inte läsas. Bevakningen är stoppad.',
   window_error:'Mejlfönstret kunde inte visa rätt mejl. Flytten har inte startat. Kontrollera mejlet i källmappen och välj Rensa spärr och fortsätt för ett nytt försök.',
   display_error:'Visningsstatus kunde inte läsas säkert. Bevakningen är stoppad.',
   move_error:'Mapp eller meddelande kunde inte kontrolleras för flytt. Kontrollera regel och mappar.',
   sweep_error:'Kontrollen av befintliga mejl misslyckades. Kontrollera att regelns käll- och målmappar finns kvar och är skrivbara.',
   queue_full:'Kön nådde säkerhetsgränsen. Bevakningen är stoppad.',
   internal_error:'Ett tekniskt fel inträffade. Ingen automatisk omkörning görs.',
   not_installed:'Öppna denna app som installerat Thunderbird-tillägg.',
   bad_request:'Åtgärden kunde inte utföras.'
  },
  events:{
   start:'Bevakningen startad',
   debug:'Detalj',
   catchup:'Befintliga mejl sorterade',
   settings_saved:'Inställningar sparade',
   rules_saved:'Regler sparade',
   restored:'Väntande jobb återställda',
   queued:'Meddelande köat',
   simulated:'Test utfört – ingen flytt',
   moved:'Flytt bekräftad av Thunderbird',
   skipped:'Meddelande överhoppat',
   error:'Tekniskt fel',
   queue_full:'Kön full',
   backup_restored:'Regelkopia återställd',
   brake:'Säkerhetsbromsen stoppade en regel',
   fallback:'Teknisk händelse'
  }
 },
 en:{
  saveLogAsBtn:"Save log as…",
  saveLogAsHelp:"For a copy in Documents: click Save log as… and choose Documents → Lasfilter → logs in the dialog. Create the folders there if needed. Automatic logging stays in Downloads. The log may contain rule names and domains; review it before sharing.",
  saveLogAsStarted:"Log export started to the location you selected. This copy is not updated automatically.",
  saveLogAsCancelled:"Saving was cancelled. No log copy was exported.",
  saveLogAsDemo:"The save dialog is available when SortBro runs in Thunderbird. No file was saved in this preview.",
  readerPauseTitle:"Pause new reading windows",
  readerPauseDurationLabel:"Pause duration",
  readerPause15:"15 minutes",
  readerPause60:"1 hour",
  readerPauseManual:"Until I resume",
  readerPauseApply:"Pause new windows",
  readerPauseResume:"Resume new reading windows",
  readerPauseHelp:"Applies to Before-move windows. Messages waiting for display stay put during the pause. Already-open messages may move after closing. Other sorting continues. The pause survives a restart.",
  readerPauseOff:"New reading windows are not paused.",
  readerPauseUntil:"New reading windows are paused until {time}. They resume automatically.",
  readerPauseIndefinite:"New reading windows are paused until you resume.",
  readerPauseSaving:"Saving pause choice…",
  openTimingLabel:"When should the message window open?",
  openTimingAfter:"After a verified move to the destination",
  openTimingBefore:"Before moving – wait until the window closes",
  openTimingHelp:"Before: fetches the message body and displays one message at a time in SortBro’s safe text window. The original stays in the source folder. The move waits until the window is closed and no other tab displays the message. The text view does not change the message. After: opens only once the correct message is verified in the destination. A window that fails to display the correct message is closed.",
  summaryOpenTiming:"Window: {timing}.",
  senderTitle:"Rule from sender",
  senderHelp:"Choose an existing rule or open a new draft. Each rule shows its destination folder.",
  senderType:"What should be added?",
  senderExact:"Only this email address",
  senderDomain:"All senders on this domain",
  senderRuleLabel:"Rule and destination",
  senderNew:"Create a new rule…",
  senderSave:"Save change",
  senderOpen:"Open new rule draft",
  senderSaveRun:"Save and run this rule now",
  senderSaveNote:"Saving does not start a manual run. Normal monitoring continues according to your settings.",
  senderNewNote:"Choose a destination and review the rule in the editor. Nothing is saved until you choose Save there.",
  senderBefore:"Current conditions: ",
  senderAfter:"After saving: ",
  senderSource:"Source: ",
  senderTarget:"Destination: ",
  senderOutside:"The message is outside this rule’s source. Adding the sender does not change the source.",
  senderPolicy:"Existing read/unread settings, year folders, trial mode and alternative destinations are preserved.",
  senderDuplicate:"This sender/domain is already covered by one of the rule’s sender conditions. The rule is unchanged.",
  senderMultiple:"Select just one message and right-click again. Multiple selected messages are not processed here.",
  senderAnd:"This rule has multiple AND conditions. Adding an alternative sender would require changing the logic. Create a separate rule instead; the existing rule is unchanged.",
  senderFull:"This rule already has eight conditions. Choose another rule or create a new one.",
  senderInvalid:"The message has no valid sender address. No rule can be created here.",
  senderStale:"Rules have changed since this dialog opened. Cancel and right-click the message again to review the new version.",
  senderRunConfirm:"Save the change to “{name}” and run this rule? This checks all messages in the rule’s source, not just the right-clicked message. Test mode, pause, read settings and the safety brake still apply.",
  senderSaved:"Sender added. The rule is saved.",
  senderRunFailed:"The rule was saved, but running it failed: ",
  senderRunning:"Rule saved. Checking messages…",
  senderRunResult:"Rule saved. Checked {n} messages, queued {q}.",
  senderDisabled:"This rule is disabled. The addition is saved, but the rule will not be enabled automatically.",
  introHide:"Hide introduction",
  introShow:"Show introduction",
  densityLabel:"Layout",
  densityCompact:"Compact",
  densityComfortable:"Comfortable",
  lineSpacingLabel:"Text line spacing",
  lineSpacingNormal:"Normal",
  lineSpacingRoomy:"Extra spacing",
  appearanceNote:"Layout changes spacing, not font size. Line spacing applies to explanations and details.",
  priorityConfirm:"Change order?\n\n“{name}”: position {from} → {to}\n“{other}”: position {to} → {from}\n\nThe first matching rule wins. The new order applies to subsequent sorting.",
  priorityChanged:"“{name}” now has priority {n}.",
  ariaNav:"Main menu",
  ariaSetup:"Getting started",
  ariaTemplates:"Rule templates",
  ariaField:"Field",
  ariaTarget:"Target folder",
  ariaExisting:"Existing rule",
  ariaAccount:"Account",
  ariaMatch:"Combine conditions",
  ariaConditionField:"Condition field",
  ariaConditionOp:"Comparison",
  ariaConditionValue:"Condition value",
  ariaConditionRemove:"Remove condition",
  ariaBranchField:"Branch field",
  ariaBranchOp:"Branch comparison",
  ariaBranchValue:"Branch value",
  ariaBranchTarget:"Branch target folder",
  ariaBranchRemove:"Remove branch",
  ruleEnable:"Enable {name}",
  pageTitle:'SortBro · Thunderbird',
  demoBanner:'PREVIEW · Sample data only. No emails are read or moved.',
  installWarnHide:'Hide',
  installWarnTempTitle:'⚠ Temporary install – disappears when Thunderbird closes',
  installWarnTempText:'SortBro is loaded in developer mode (temporarily). It is not SortBro uninstalling itself. Make it permanent: Add-ons → the gear ⚙ → Install Add-on From File… Your rules stay in Downloads/Lasfilter/Regelbackuper/.',
  installWarnSideTitle:'⚠ Side-loaded install – Thunderbird may disable the add-on',
  installWarnSideText:'The file sits in the Thunderbird profile folder (extensions) instead of being installed through Add-ons. Unsigned add-ons there are disabled at restart. Make it permanent: Add-ons → the gear ⚙ → Install Add-on From File… Your rules stay in Downloads/Lasfilter/Regelbackuper/.',
  brandName:'SortBro',
  brandSub:'FOR THUNDERBIRD',
  navMenu:'MENU',
  navSuggestions:"Suggested rules",
  rulesPageTitle:"Rules",
  ruleEditorPageHelp:"Choose the account, conditions and destination for the rule.",
  rulesPageHelp:"Your saved rules. Choose one to edit or create a new rule.",
  suggestionsPageTitle:"Suggested rules",
  suggestionsPageHelp:"Start from your Inbox or your own moves. You decide which suggestions become rules.",
  activityPageTitle:"Activity",
  activityPageHelp:"Follow sorting, check results and troubleshoot in one place.",
  settingsPageTitle:"Settings",
  settingsPageHelp:"Open the group you want to change. Settings are saved immediately.",
  helpPageTitle:"Help",
  helpPageHelp:"Get started and understand how SortBro moves your emails.",
  supportPageTitle:"Support SortBro",
  supportPageHelp:"Optional support for continued development. All features remain free.",
  statusDetails:"Sorting details",
  inboxIdeasTitle:"From your Inbox",
  inboxIdeasHelp:"Choose a sender or a subject word as your starting point.",
  templateLibraryTitle:"Templates to start from",
  learnedSectionTitle:"Suggestions from your own moves",
  learnEmpty:"No learned suggestions yet. New suggestions appear here when SortBro finds a pattern.",
  learnEmptyOff:"Learning is off. Enable it under Settings → Sorting & safety.",
  resumeEditor:"Continue editing",
  backToRules:"← All rules",
  editorDraftNote:"Changes are saved only when you choose Save.",
  ruleFilesTitle:"Import & export rules",
  activityToolsTitle:"Checks & troubleshooting",
  activityToolsHelp:"Run a check or investigate the selected email.",
  appearanceSection:"Appearance & readability",
  sortingSection:"Sorting & safety",
  storageSection:"Logs & automatic backups",
  navRules:'Rules',
  navActivity:'Activity',
  navSettings:'Settings',
  navHelp:'Help',
  navSupport:'Support SortBro',
  footerSupportLink:'💚 Support SortBro',
  supEyebrow:'💚 100% FREE • LOCAL IN THUNDERBIRD • OPEN SOURCE',
  supHeroTitle:'Support SortBro – for a calmer Thunderbird inbox',
  supHeroSub:'SortBro is completely free, ad-free and runs 100% locally on your computer with zero cloud services. Your gift supports continued development, compatibility with new Thunderbird releases and new smart filter features. Nothing is paywalled – all features are free for everyone.',
  supStatLocal:'🔒 100% local processing',
  supStatFree:'💚 100% free – always',
  supSwishQuick:'💚 Swish (QR)',
  supGithubBtn:'⭐ GitHub',
  supPickKicker:'Any amount – no tiers, no paywalls',
  supPickTitle:'Choose an amount or enter your own',
  supPickSub:'The selected amount is pre-filled in the Swish QR code and PayPal link (and can always be changed). Every contribution makes a difference.',
  supSwishMain:'💚 Show Swish QR for amount',
  supPaypalMain:'💙 PayPal – selected amount',
  supKofiMain:'☕ Ko-fi – one-time / monthly',
  supQrTitle:'💚 Scan with the Swish app on your phone',
  supQrModeSwish:'Swish scanner (Default)',
  supQrModeCam:'Phone camera app',
  supQrSub:'Open Swish on your phone → Scan QR code. Amount and message (SortBro) are pre-filled and editable.',
  supQrSubCam:'Point your phone\'s camera app at the QR code to open Swish via deep link (swish://).',
  supWhyKicker:'Why your support matters',
  supWhyTitle:'You support an independent Swedish developer – not a corporation 🛠️',
  supWhySub:'SortBro was built to solve a real pain point in Thunderbird: reading emails at your own pace before they are sorted, or controlling per filter which unread and read emails move. Your support keeps the add-on maintained and ad-free.',
  supImp1Title:'Thunderbird compatibility',
  supImp1Body:'Ongoing updates and IMAP testing as Thunderbird releases new versions.',
  supImp2Title:'New smart filter features',
  supImp2Body:'New rule conditions, window controls and workflow improvements based on user feedback.',
  supImp3Title:'100% private & local',
  supImp3Body:'No cloud services, no telemetry and no locked Pro tiers – ever.',
  supTrust1:'🔒 Swish, PayPal & Ko-fi – encrypted & secure',
  supTrust2:'🕊️ Zero tracking in the add-on (connect-src \'none\')',
  supTrust3:'🇸🇪 Swedish open-source project',
  supFaqKicker:'Frequently asked questions',
  supFaq1Q:'💚 How does the Swish QR code work inside Thunderbird?',
  supFaq1A:'The QR code is generated 100% locally inside the add-on without contacting any external server. Open the Swish app on your phone, tap Scan and point the camera at the QR code to pre-fill recipient, amount and the message "SortBro".',
  supFaq2Q:'🔒 Does SortBro read or send any payment or email data?',
  supFaq2A:'Never. SortBro enforces a strict security policy (connect-src \'none\') blocking all network traffic from the add-on. Payments happen entirely in your own Swish app or browser via PayPal/Ko-fi.',
  supFaq3Q:'🎁 Does donating unlock any extra features?',
  supFaq3A:'No – all features in SortBro are 100% free for everyone, always. Donating is completely voluntary and helps keep development going.',
  sidebarNoteTitle:'Read at your own pace.',
  sidebarNoteBody:'Read messages stay put while open in any mail tab or message window.',
  versionText:'Local processing · v1.0.25 · No cloud services',
  topbarTitle:'THUNDERBIRD / SORTBRO',
  themeQuickTitle:'Toggle light/dark theme',
  introEyebrow:'AUTOMATIC EMAIL SORTING',
  introTitle:'Move emails automatically',
  introSub:'Create one or multiple rules, choose unread/read mode and target folder. Done.',
  setup1Title:'Pick sample email',
  setup1Sub:'Select an email in Thunderbird',
  setup2Title:'Save the rule',
  setup2Sub:'Choose unread/read & target folder',
  setup3Title:'Enable moves',
  setup3Sub:'The add-on handles the rest',
  runLabel:'ENGINE STATUS',
  clearFaultBtn:'Clear lock & resume',
  showActivityBtn:'View activity',
  statRules:'active rules',
  statQueue:'queued for move / test',
  statMoved:'moved since start',
  statMatched:'matched since start',
  rulesTitle:'Saved rules',
  rulesSub:'More actions for each rule are available under ⋯.',
  ruleMenuLabel:"Actions for {name}",
  ruleDetails:"Details & settings",
  ruleEdit:"Edit",
  ruleRun:"Run now",
  ruleCopy:"Duplicate",
  ruleExport:"Export",
  ruleUp:"Move up",
  ruleDown:"Move down",
  ruleDelete:"Delete…",
  ruleOn:"On",
  ruleOff:"Off",
  ruleOverlap:"Overlap · {n}",
  ruleOrder:"Priority {n}",
  ruleSource:"From",
  ruleTarget:"To",
  ruleConditions:"Conditions",
  ruleAll:"All conditions must match",
  ruleAny:"At least one condition must match",
  ruleDeleteNamed:"Delete “{name}”? No emails will be deleted.",
  ruleTargetMore:"+ {n} alternative targets",
  newFromSelectedBtn:'✉ New from selected email',
  newRuleBtn:'＋ New blank rule',
  quickRuleTitle:'Create from a suggestion',
  quickRuleHelp:'Click a sender or a subject word – or type it yourself. SortBro tells you how many Inbox emails the rule hits before you save.',
  quickHintsScan:'↻ Read the Inbox again',
  quickHintsSenders:'Senders in the Inbox',
  quickHintsWords:'Words in subject lines',
  quickHintsEmpty:'Nothing to suggest right now – type a domain, an address or a word in the field.',
  quickMatch:'{n} emails in the Inbox match right now',
  quickMatchZero:'No emails match right now – check the spelling or click a suggestion above.',
  quickMatchCounting:'Counting in the Inbox…',
  quickMatchAccount:'{n} emails in {a} match now',
  quickMatchUnreadPart:'{n} of {m} will move now – {u} unread are waiting to be read',
  quickMatchUnreadOnly:'No emails will move now – the {u} that match are unread. Tick Move unread emails to include them.',
  quickMatchCapped:' (counted among the {n} most recent emails in the Inbox)',
  quickChipTipSender:'Most common address: {a}',
  quickChipTipSubject:'Latest subject: {s}',
  quickChipHide:'Hide this suggestion',
  quickHintsMore:'＋ show more ({n})',
  quickHintsShowLess:'− show fewer',
  quickHintsUnhide:'Show hidden suggestions again',
  quickSentence:'Move {what} to {target}',
  quickPickTarget:'choose a target folder',
  quickWhatDomain:'emails from {v}',
  quickWhatSender:'emails where the sender contains {v}',
  quickWhatSenderExact:'emails from {v}',
  quickWhatSubject:'emails with "{v}" in the subject',
  quickAddRunBtn:'⚡ Add and move now',
  quickRunToast:'Rule created and run: {n} emails checked, {q} moved.',
  quickFetchBtn:'✉ Fetch from selected email',
  quickAddBtn:'＋ Create rule',
  quickExistingNew:'Create a new rule…',
  quickExistingAdd:'＋ Add to: {name}',
  quickExistingPick:'Pick a rule above to add the sender to a rule that already exists.',
  importLabel:'Paste domains or addresses (one per line, or comma separated)',
  importBtn:'＋ Import into the rule',
  importHelp:'Each line becomes a condition in this rule. Addresses and domains become exact matches, other words become "contains". Several senders are joined with "at least one of the conditions", so the rule moves emails from any of them.',
  importAdded:'{n} conditions added to the rule.',
  importAddedAny:'{n} conditions added. The combination is now "at least one of the conditions".',
  importSkipped:' {n} were skipped (duplicates, or the rule is full).',
  importNone:'Nothing new to add – the rule already has it all.',
  importNoRule:'Open or create a rule first.',
  importSaveHint:'Press Save rule to store the change.',
  tbFilterTitle:'🔁 Thunderbird\'s own filters',
  tbFilterHelp:'Read your existing filters from msgFilterRules.dat and turn them into SortBro rules – or write your rules as a filter file Thunderbird understands. The file lives in your profile: Help → Troubleshooting Information → Open Folder, then ImapMail/<server>/ or Mail/Local Folders/.',
  tbImportBtn:'⇪ Import filter file…',
  tbExportBtn:'⇩ Export as filter file',
  tbPrefixHelp:'Paste the account address from the filter file if you want to export back to it.',
  tbImportTitle:'Filters in the file: {n}',
  tbImportSummary:'Can become rules: {ok} · skipped: {skipped}',
  tbImportCreate:'✓ Create {n} rules',
  tbImportNothing:'Nothing to import – none of the filters move mail with conditions SortBro can match.',
  tbImportDone:'New rules from the filter file: {n}.',
  tbImportTarget:'Target folder',
  tbImportNeedsTarget:'Choose a target folder',
  tbImportDisabled:'disabled in Thunderbird',
  tbImportNoTargetMatch:'No target folder matched "{name}"',
  tbImportReviewNote:'Review and tick what you want. Nothing is created until you press the button.',
  tbImportCapacity:'SortBro has room for {n} more rules (200 max). The rest are skipped – switch off some old rules first if you want them.',
  tbImportPartial:'Saved: {n} · could not be saved: {m}. The rows below say why.',
  tbImportFailedRow:'Could not be saved: ',
  tbExportSaved:'Filter file saved: {name}',
  tbExportBadPrefix:'The account address must start with imap://, mailbox:// or pop3:// – copy the actionValue line from your msgFilterRules.dat.',
  tbExportWritten:'{n} filters written',
  tbExportSkipped:'{n} skipped',
  tbExportNoUri:'The account address from the filter file is missing. Paste it in the field above (it is in your msgFilterRules.dat, e.g. imap://user%40server.com@imap.server.com/) or import the file once first.',
  tbExportPlace:'The file now sits in Downloads/Lasfilter/Filterfiler/. Place it in the profile folder for the account (ImapMail/<server>/ or Mail/Local Folders/) while Thunderbird is closed, then restart Thunderbird. Back up the old file first.',
  tbExportNeedsRules:'There are no rules to export.',
  tbNotes:'Good to know:',
  tbNoteBody:'Conditions on the message body cannot be matched by SortBro',
  tbNoteNegation:'Negated conditions (doesn\'t contain / isn\'t) cannot be expressed by SortBro',
  tbNoteMatchall:'The filter matches everything (ALL) and has no condition to translate',
  tbNoteComplex:'Mixed AND/OR could not be translated exactly',
  tbNoteNoMove:'The filter does not move mail',
  tbNoteCopy:'The filter copies instead of moving – SortBro moves',
  tbNoteNoTarget:'No target folder could be matched – pick one',
  tbNoteActions:'Actions that are not carried over: {list}',
  tbNoteApprox:'"{field}" was translated approximately',
  tbNoteUnknown:'The field "{field}" does not exist in SortBro',
  tbNoteSize:'Size was converted between bytes and kB',
  tbNoteDate:'The date condition was translated to days',
  tbNoteActionsAdd:'Actions that are not carried over: ',
  tbNoteTrimmed:'{n} conditions did not fit (SortBro allows 8 per rule) – add them in the rule editor',
  tbExportNoteDomain:'Domain conditions become "From contains" in Thunderbird',
  tbExportNoteSize:'Size is written in bytes',
  tbExportNoteBranches:'Branches (different targets per subject) cannot be exported – only the main target follows',
  tbExportNoteYearFolders:'Year folders do not exist in Thunderbird filters',
  tbExportNoteReadPolicy:'The read policy (unread/read) does not exist in Thunderbird filters',
  tbExportNoteDate:'Conditions on years (before/after the current year) cannot be exported',
  tbExportNoteCondition:'The condition "{what}" cannot be written as a Thunderbird filter',
  quickExistingPrompt:'"{name}" already has {n} conditions. New senders are added as alternatives, so the rule moves emails matching any of the conditions. Continue?',
  quickExistingDone:'{n} added to the rule "{name}". The combination is "at least one of the conditions".',
  quickExistingNone:'Nothing new to add – the value is already in the rule.',
  quickValuePlaceholder:'e.g. fortnox.se, klarna.se or Invoice…',
  ruleSearchPlaceholder:'Search name, folder or condition…',
  exportBtn:'↓ Export rules (.json)',
  importBtn:'↑ Import (.json)',
  importMergeBtn:'＋ Add from JSON',
  exportSingleRuleBtn:'↓ Export rule (.json)',
  jsonBackupSub:'Export your rules to a JSON file or import rules from a JSON file (replace all or append).',
  priorityNote:'First match wins. Reorder via ⋯.',
  editorEyebrow:'RULE EDITOR',
  editorNew:'New rule',
  editorEdit:'Edit rule',
  enabledLabel:'Active',
  ruleNameLabel:'Rule name',
  ruleNamePlaceholder:'Example: Fortnox invoices',
  step1Title:'Select a sample email',
  step1Help:'In Thunderbird, click an email you want to sort, then return here.',
  fromSelectedBtn:'✉ Fetch account & sender from selected email',
  accountLabel:'Account',
  chooseAccount:'Select an account…',
  accountScopeTitle:'All folders in the account are included',
  accountScopeBody:'Inbox, archives and normal subfolders are monitored automatically. Sent, Drafts, Junk and Trash are excluded.',
  step2Title:'Which matching emails?',
  conditionOr:"OR",
  conditionAnd:"AND",
  ruleSummaryTitle:"How this rule works",
  summaryMove:"Move emails from account {source} to {target} if ",
  summarySourceMissing:"[choose account]",
  summaryTargetMissing:"[choose target folder]",
  summaryValueMissing:"[value missing]",
  summarySubject:"the subject",
  summarySender:"the sender address",
  summaryDomain:"the sender domain",
  summaryRecipient:"the recipient field",
  summaryCc:"Cc/Bcc",
  summarySize:"the size",
  summaryDate:"the email date",
  summaryDays:"days",
  summaryQuoted:"“{value}”",
  summaryTiming:"Read policy: {mode}.",
  summaryUnread:"Unread handling: {action}.",
  summaryYear:"Year folders are on: the email’s year is used as a subfolder under the selected destination.",
  summaryBranches:"When the main conditions match, the first matching branch determines the destination. Otherwise the target folder above is used.",
  summaryBranch:"If {condition}, use {target}.",
  summaryDisabled:"This rule is disabled.",
  summaryNote:"This summary describes the fields in the editor. It does not save or move anything. Rule priority and safety checks still apply.",
  matchAll:'Match all conditions',
  matchAny:'Match any condition',
  step2Help:'Add up to 8 conditions, such as subject words or a sender. New rules match when at least one condition is met – not all of them.',
  colField:'Field',
  colOp:'Operator',
  colValue:'Value',
  addConditionBtn:'＋ Add condition',
  step3Title:'Where and when should emails move?',
  targetLabel:'Target folder',
  chooseTarget:'Select a target folder…',
  browseFolders:"Browse folders…",
  folderTreeTitle:"Choose target folder",
  folderTreeParentTitle:"Choose parent folder",
  folderTreeHelp:"Choose an account, expand folders and select your destination. Nothing changes until you confirm.",
  folderTreeLabel:"Folders in selected account",
  folderTreeChoose:"Choose this folder",
  folderTreePending:"Selected folder",
  folderTreeNoSelection:"Select a folder in the tree.",
  folderTreeCount:"Folders: {n}",
  folderTreeKeyHelp:"Keyboard help",
  folderTreeNavigation:"Use arrow keys to navigate. Right/left expand/collapse. Enter or Space selects; the button below confirms.",
  folderTreeStructure:"(path – not selectable)",
  folderTreeExpand:"Expand {name}",
  folderTreeCollapse:"Collapse {name}",
  targetAccountLabel:"1. Destination email account",
  targetFolderLabel:"2. Folder in selected account",
  targetSearchLabel:"Find folder",
  targetSearchPlaceholder:"Search the full folder path…",
  targetAccountFirst:"Choose an email account first…",
  targetEmpty:"No folders match your search.",
  targetMissing:"The target folder is missing. Choose its account and folder again.",
  targetSelected:"Selected folder",
  matchAllHelp:"Every condition must match the same email. Two subject conditions require both texts in the subject.",
  matchAnyHelp:"One matching condition is enough. Sender and subject are not both required in this mode.",
  testConditionYes:"Matches",
  testConditionNo:"Does not match",
  testPaused:"Sorting is paused.",
  testDryRun:"Test mode is on: no emails will be moved.",
  testTrial:"This rule is in trial mode: no emails will be moved.",
  testStopped:"Sorting has stopped because of an error. Check its status.",
  ruleMoveUnreadLabel:'Move unread emails right away too (otherwise they wait until you have read them)',
  unreadMoveNote:'Box ticked: unread emails matching the rule are moved right away. Cleared: they stay put and move only after you have read them.',
  ruleOpenWindowLabel:'Open unread emails in a new window',
  unreadChoiceTitle:'Unread emails – choose what should happen',
  unreadChoiceNote:'The window choice applies to unread messages this rule may process. Choose below whether to open them before or after moving.',
  ruleTrialLabel:'Trial run for 7 days before the rule moves anything',
  trialNote:'During the trial the rule only counts how many emails it would move. Nothing moves, and the rule does not affect your other rules. After seven days SortBro asks whether to activate it.',
  trialBadge:'TEST',
  trialDaysLeft:'{n} days left',
  trialDayLeft:'1 day left',
  trialTitle:'The trial run has ended',
  trialWould:'The rule “{name}” would have moved {n} emails.',
  trialWouldOne:'The rule “{name}” would have moved 1 email.',
  trialWouldNone:'The rule “{name}” matched no emails during the trial.',
  trialActivate:'Activate the rule',
  trialExtend:'Extend by 7 days',
  trialOff:'Turn the rule off',
  trialActivated:'The rule is active.',
  trialExtended:'The trial continues for 7 days.',
  trialOffDone:'The rule is turned off.',
  learnTitle:'Learn from your move',
  learnBody:'You moved {n} emails from {domain} to {target}. Want SortBro to handle it for you?',
  learnCreate:'Create rule',
  learnSnooze:'Not now',
  learnOff:'Stop suggesting',
  learnCreated:'The rule is created. Review it before it moves anything.',
  learnExisting:'A rule for this sender and folder already exists.',
  learnOffDone:'SortBro will not suggest rules from your moves.',
  learnOnLabel:'Learn from my own moves and suggest rules',
  learnOnNote:'If you move three emails from the same sender to the same folder yourself, SortBro suggests a rule. Only domain, folder and count are saved, for at most seven days – never subject, name or message text.',
  inlineMoveUnread:'Move unread mail',
  inlineOpenWindow:'Open in new window',
  readFilterLabel:'Move unread / read emails for this rule',
  rfDefault:'Use global default (read + new in Inbox)',
  rfRead:'Read emails only (wait until read and closed)',
  rfBoth:'Both unread and read emails (move immediately)',
  rfUnread:'Unread emails only (move immediately)',
  unreadActionLabel:'When unread emails are moved by this rule',
  uaDefault:'Use global default (Settings)',
  uaKeep:'Keep unread in target folder (no popup window)',
  uaWindow:'Open in a new window (choose timing above)',
  uaRead:'Mark as read when moved',
  branchSummary:'Advanced: route to different folders by subject',
  branchNote:'The first matching branch sets the target folder. Other matching emails go to the main target folder above.',
  addBranchBtn:'＋ Add branch',
  testBtn:'▷ Test rule',
  saveBtn:'Save automatic move',
  saveAsNewBtn:'＋ Save as new rule',
  saveAndNewBtn:'＋ Save & new blank',
  upBtn:'↑ Priority',
  downBtn:'↓ Priority',
  duplicateBtn:'⧉ Duplicate rule',
  deleteBtn:'Delete rule',
  safetyTitle:'Test mode is a safe start.',
  safetyBody:'Test your rules before enabling live moves. The Test button never moves any emails.',
  queueSelectedBtn:'Queue selected email →',
  catchUpBtn:'Sort existing emails for rule →',
  activityTitle:'Technical activity',
  activitySub:'No subject lines, sender addresses or message bodies are stored here.',
  exportLogBtn:'Export log',
  exportErrorLogBtn:'Save combined error log',
  thTime:'Time',
  thEvent:'Event',
  thLevel:'Level',
  thCount:'Count',
  settingsTitle:'Appearance & defaults',
  langLabel:'Language / Språk',
  themeLabel:'Theme',
  themeSystem:'Follow system',
  themeLight:'Light',
  themeDark:'Dark',
  moveModeLabel:'Default mode for rules (when rule is set to Default)',
  moveModeRead:'Move when read and closed',
  moveModeDirect:'Move immediately, including unread',
  openWindowLabel:'Open moved unread emails in a separate window by default',
  unreadNote:'You can also choose per rule whether moved unread emails stay unread without a popup window, open in a window, or are marked as read.',
  hourlyLabel:'Run all rules automatically (recommended)',
  sweepMinutesLabel:'How often all rules run (minutes, steps of 15 – 60 = once an hour)',
  newInboxDirectLabel:'Move new matching emails immediately when they arrive in Inbox',
  verboseLabel:'Show detailed diagnostics in Activity Log',
  fileLogLabel:'Automatically write technical log to Downloads/Lasfilter/logs/lasfilter-logg.txt',
  storageNote:'Automatic files and regular exports land in subfolders of the app folder Downloads/Lasfilter/: logs (the log file), Regelbackuper (the backups), Regler (your exports) and Filterfiler (msgFilterRules.dat). Nothing is left loose in Downloads. Save log as… under Activity lets you choose a folder for a manual copy.',
  fileLogNote:'Also writes sortbro-fellogg.txt in the same folder: a combined error log for the last 30 days (up to 5,000 entries). No message bodies are stored. You can also save it under Activity.',
  autoBackupLabel:'Back up the rules automatically once a week to Downloads/Lasfilter/Regelbackuper/',
  brakeLabel:'Safety brake: stop a rule that suddenly matches an abnormal number of emails',
  toastBrakeOn:'The safety brake is on: a rule that suddenly matches too many emails is stopped before anything is moved.',
  toastBrakeOff:'The safety brake is off. A mistaken rule can then move the whole inbox without asking.',
  brakeNote:'If a rule wants to move ten times more emails than usual – and at least 50 – it is stopped before anything is moved. You then choose: move anyway or switch the rule off. New rules have a limit of 50 emails per sweep.',
  brakeWarnTitle:'The safety brake stopped a rule',
  brakeWarnText:'The rule "{name}" wanted to move {n} emails. The limit is {limit} and the rule usually moves {median}. Nothing more moves until you choose.',
  brakeWarnNever:'nothing',
  brakeWarnMove:'Move anyway',
  brakeWarnStop:'Switch the rule off',
  brakeWarnDelete:'Delete the rule',
  brakeDeleteConfirm:'"{name}" will be deleted completely. Nothing is moved, and the rule stops looking for mail.\n\nA copy of your rules is saved first, so you can bring it back under Rule copies & safety.\n\nDelete the rule?',
  brakeDeleted:'The rule "{name}" was deleted. Nothing was moved.',
  cacheTitle:'Cache',
  cacheSub:'SortBro remembers each folder\'s message counts so a sweep can skip folders that have not changed. That keeps sweeps fast. The cache is cleared automatically once a day, so it can never show a stale picture of your inbox.',
  autoClearLabel:'Clear the cache automatically once a day',
  clearCacheBtn:'Clear the cache now',
  cacheNote:'Clearing the cache moves no email and changes no rule. The next sweep simply re-reads the folder sizes, which takes a few extra seconds once.',
  cacheNever:'Not cleared since the add-on started.',
  cacheToday:'Last cleared today at {time}.',
  cacheYesterday:'Last cleared yesterday at {time}.',
  cacheDaysAgo:'Last cleared {n} days ago.',
  cacheCleared:'Cache cleared: {n} folders will be re-read on the next sweep.',
  cacheBusy:'Wait until the move finishes – the cache is then cleared at once.',
  cacheOff:'Automatic clearing is off. The button still works.',
  brakeReleased:'The rule "{name}" was released and now moves {n} emails.',
  brakeStopped:'The rule "{name}" was switched off. Nothing was moved.',
  conflictTitle:'May collide with "{name}" – both can match the same email ({fields}).',
  conflictWinner:'This rule comes first and wins.',
  conflictLoser:'That rule comes first and wins. Move this one up to let it apply instead.',
  whyBtn:'🔍 Why is this email here?',
  whyRunning:'Reading the selected email…',
  whyTitle:'Why is this email here?',
  whySubject:'"{subject}" from {author}',
  whyNoRule:'No active rule matches this email. It is where it is.',
  whyWinner:'The rule "{name}" applies and would move the email to {target}.',
  whyWinnerHeld:'The rule "{name}" applies but is stopped by the safety brake – nothing moves until you answer.',
  whyAlready:'The email is in the target folder {target} – that is where the rule "{name}" sends it.',
  whyArrived:'The email is already in place.',
  whyNoTarget:'The rule "{name}" applies but the target folder was not found.',
  whyBlockedBy:'What stops the move:',
  whyNoMatch:'No rule matches. This is how close they were:',
  whyClosest:'{name} – {hit} of {total} conditions match',
  whyAllRules:'Every rule that was tested',
  whyRuleOk:'matches',
  whyRuleNo:'no match',
  whyRuleOff:'disabled',
  whyRuleOtherFolder:'other folder',
  whyRuleHeld:'stopped',
  whyNoSelection:'Select an email in Thunderbird first – a single email.',
  whyFooter:'The lookup reads only the email headers and changes nothing.',
  conflictWinner:'This rule comes first and wins.',
  conflictLoser:'That rule comes first and wins. Move this one up to let it apply instead.',
  autoBackupNote:'The copy lives outside the Thunderbird profile, so it survives the add-on being removed or switched off. It is written automatically once a week: sortbro-regler-backup.json is the latest one, and the last 12 weeks are kept as dated copies. If you would rather not wait for next week, the button below writes both right away. Import the file under Rules to get the rules back.',
  backupLastWeek:'Last weekly copy written: {week} · the next is written automatically in a new week',
  backupNoWeek:'No weekly copy yet – it is written automatically on the first start of a new week, or right away with the button below.',
  backupNowBtn:'⇩ Back up the rules now',
  backupNowDone:'Rules backed up: {n} in {name}',
  backupNowUnchanged:'No changes since the last copy – the file is already up to date.',
  backupNowFailed:'The copy could not be written to Downloads. Check that Thunderbird is allowed to save files.',
  toastAutoBackupOn:'Rules are backed up automatically when they change.',
  toastAutoBackupOff:'Automatic backup switched off.',
  shortcutsNote:'Alt+Shift+L opens Läsfilter even if the toolbar button is hidden. Ctrl+Shift+L runs a scan immediately.',
  fontSizeLabel:'Font size',
  refreshFoldersBtn:'Refresh folder list',
  windowNote:'Thunderbird manages window size and position. The add-on remembers language, theme, font size and last selected rule.',
  backupsTitle:'Rule backups & safety',
  backupsSub:'The five most recent rule versions are saved automatically. Restoring starts paused in test mode.',
  clearBlockedBtn:'Clear locks after manual check',
  clearBlockedNote:'This does not undo any move or retry failed moves. Check your folders in Thunderbird first.',
  helpTitle:'A calmer inbox, on your terms',
  helpStep1:'Choose the account to monitor, one or more conditions, unread/read mode and a target folder. You can create as many rules as you need.',
  helpStep2:'Use Fetch account & sender from selected email to fill in the account and sender automatically. Select one email in Thunderbird first.',
  helpStep3:'The Test rule button checks the rule currently in the editor (including unsaved edits) without moving the email.',
  helpStep4:'For each rule you can choose Read emails only, Both unread and read, Unread emails only, or Use global default – plus how moved unread emails are handled.',
  helpStep5:'Use Save & new rule or Duplicate rule to quickly set up multiple rules for different senders, domains or subjects.',
  helpImportantTitle:'Good to know',
  helpP1:'"Read" uses Thunderbird\'s read status. When a rule waits for reading, the email is moved only after it is marked read and is no longer open in any mail tab or message window.',
  helpP2:'Run scan now and the ▶ button on each rule scan the account\'s folders (excluding the rule\'s target folders) according to each rule\'s unread/read setting.',
  helpP3:'A rule can also route to sub-targets (Advanced: route to different folders by subject), e.g. domain fortnox.se as the main condition, then Subject contains Invoice → Invoices and Subject contains Order → Orders.',
  helpP4:'This add-on never modifies Thunderbird\'s built-in msgFilterRules.dat and uses no cloud services.',
  helpP5:'Thunderbird fetches new versions on its own – it checks at startup and then once a day. An add-on cannot install itself, but Uppdatera-SortBro.bat does the same thing in one double-click if you would rather not wait.',
  footerRight:'Custom rules · No changes to msgFilterRules.dat',
  policyDefaultTitle:'Read first (or immediately on Inbox arrival).',
  policyDefaultBody:'Follows the global default: read emails move after being closed for 2 seconds, and new Inbox arrivals can move immediately. Tick ”Move unread emails right away too” to move unread mail in every folder at once.',
  policyReadTitle:'Read first. Then closed.',
  policyReadBody:'Moves read emails only, waiting at least two seconds after the email is no longer displayed in any tab or window.',
  policyBothTitle:'Moves both unread and read emails immediately.',
  policyBothBody:'This rule moves matching unread and read emails right away without waiting for the message to be closed.',
  policyUnreadTitle:'Moves unread emails only (immediately).',
  policyUnreadBody:'This rule moves matching unread emails immediately. Already read emails are left untouched.',
  pillStopped:'STOPPED',
  pillPaused:'PAUSED',
  pillTest:'TEST · NO MOVES',
  pillActive:'ACTIVE · MOVING MAIL',
  pillDisconnected:'Disconnected',
  pauseResume:'Resume monitoring',
  pauseBtn:'Pause',
  modeEnable:'Enable live moves',
  modeTest:'Switch to test mode',
  guideActiveTitle:'Live moves are active',
  guideActiveReady:'New matching emails are monitored. Click Run scan now to also scan existing emails.',
  guideActiveNoRules:'Create and enable at least one rule to start.',
  guideFaultTitle:'Move engine is stopped',
  guideFaultTail:' Open Activity Log to inspect the latest entry.',
  guidePausedTitle:'Monitoring is paused',
  guidePausedBody:'No new emails are queued or moved. Click Resume monitoring when you are ready to continue.',
  guideTestTitle:'Test mode – no emails are moved',
  guideTestReady:'Rules match and count as tests, but folders are not modified. Enable live moves when everything looks right.',
  guideTestNoRules:'Create a rule. Test mode is safe and never moves any emails.',
  sweepQueueNow:'Process queue now',
  sweepRunNow:'Run scan now',
  sweepChecking:'Scanning…',
  noticeStoppedPrefix:'STOPPED: ',
  noticeStoppedSuffix:' No further automatic attempts will run until the issue is resolved.',
  lastCheckPrefix:'Last check: ',
  lastCheckCountSuffix:' emails checked since start',
  lastCheckWaiting:'Waiting for a matching email',
  emptyNoMatch:'No rule matches your search.',
  emptyNoRules:'Start by creating a rule. No sample rules are active on your emails.',
  missingFolder:'Folder missing – select again',
  missingFolderShort:'Folder missing',
  confirmDiscard:'Discard unsaved changes?',
  confirmDiscardEditor:'Discard unsaved changes in the editor?',
  fieldSenderShort:'From',
  fieldDomainShort:'Domain',
  fieldSubjectShort:'Subject',
  fieldRecipientShort:'To',
  fieldCcShort:'Cc',
  fieldSizeShort:'Size',
  fieldDateShort:'Date',
  moreConditionsSuffix:' conditions',
  scopeAccount:'All folders',
  scopeFolder:'Selected folder',
  tagDisabled:'Disabled',
  tagDefault:'after reading',
  tagRead:'read only',
  tagBoth:'unread & read immediately',
  tagUnread:'unread only immediately',
  runRuleNowTitle:'Run this rule now',
  dupRuleTitle:'Duplicate this rule',
  maxBranches:'Up to eight branches per rule.',
  maxConditions:'Up to eight conditions per rule.',
  minConditions:'Keep at least one condition.',
  optSubject:'Subject',
  optSender:'From (address)',
  optDomain:'Sender domain',
  opContains:'contains',
  opEquals:'equals',
  opStarts:'starts with',
  opEnds:'ends with',
  branchPlaceholder:'Example: Invoice',
  condPlaceholder:'Example: fortnox.se',
  noLogsYet:'No events yet.',
  rulesCountSuffix:' rules',
  restoreBtn:'Restore',
  confirmRestore:'Restore this rule version? Current rules will be backed up. Monitoring will start paused in test mode.',
  toastRestored:'Rule backup restored. Test before enabling live moves.',
  backupHint:'A backup is created when you save your first rule change.',
  blockedSome:' locked/uncertain attempts. Check your folders in Thunderbird before clearing locks.',
  blockedNone:'No uncertain move attempts.',
  toastRuleSaved:'Rule saved. You can test it on a selected email.',
  toastSavedAndNew:'Rule saved! Fill in your next rule below.',
  toastDuplicated:'Rule duplicated as a new draft – adjust and click Save.',
  defaultRulePrefix:'Mail from ',
  defaultSubjectPrefix:'Subject: ',
  defaultSenderFallback:'sender',
  copySuffix:' (copy)',
  toastFromSelected:'Fetched from selected email! Now choose a target folder and click Save.',
  toastQuickAdded:'The rule was created and is in the list. Run it with ▶ Run all rules now, or add another right away.',
  testReasonNoMatch:'Conditions do not match the selected email.',
  testReasonDisabled:'Conditions match, but this rule is disabled.',
  testReasonUnread:'Conditions match, but the email is unread and this rule only moves read emails.',
  testReasonAlreadyRead:'Conditions match, but the email is already read and this rule only moves unread emails.',
  testReasonDisplayed:'Conditions match. The email is read but still open in a mail tab or window.',
  testReasonEligible:'Conditions match. The email meets this rule\'s requirements and is ready to move.',
  testNoMove:' The test does not move anything. ',
  testTargetPrefix:'Target: ',
  testTail:'This test only checks the rule in the editor and ignores which folder the email is currently in.',
  testOutside:' The email is currently outside the source folder: live monitoring moves new emails arriving in the source folder, and "Sort existing emails" scans existing emails across folders.',
  confirmDelete:'Delete this rule? A backup copy is saved automatically. No emails are deleted.',
  saveBeforePriority:'Save the rule before changing priority.',
  confirmEnableLive:'Enable live email moves according to your active rules?\n\nStart with a test folder and review Test results first. Pending test jobs will be cleared.',
  toastLiveOn:'Live move mode enabled for your active rules.',
  toastTestOn:'Test mode enabled. No live moves will run.',
  toastQueued:'Selected email queued according to rule.',
  toastAlreadyQueued:'Already processed or queued in this session.',
  saveFirst:'Save the rule first.',
  openRuleFirst:'Open or create a rule first.',
  confirmCatchUp:'Scan the account\'s folders (including subfolders, excluding the rule\'s target folders) for existing emails matching the saved rule?\n\nIn test mode, matches are counted as tests without moving.',
  confirmImport:'Replace current rules with the rules from this JSON file? (A backup copy is saved automatically.)',
  confirmImportMerge:'Add the rules from this JSON file to your existing rules?',
  toastImported:'Rules imported from JSON file!',
  toastMerged:'Rules from JSON file added!',
  toastExported:'Rules exported to {path}.',
  logExported:'Log exported to {path}.',
  toastSingleExported:'Rule exported to {path}.',
  toastCleared:'Lock cleared and monitoring resumed.',
  toastModeDirect:'Immediate mode: new matching emails move even when unread.',
  toastModeRead:'New emails move after they are read and closed.',
  toastOpenWindowOn:'Moved unread emails open in a separate window by default.',
  toastOpenWindowOff:'Moved unread emails stay in target folder without a popup window.',
  toastVerboseOn:'Detailed logging enabled: diagnostics appear in Activity Log and exports.',
  toastVerboseOff:'Detailed logging disabled.',
  toastFileLogOn:'File log enabled: Downloads/Lasfilter/logs/lasfilter-logg.txt updates automatically.',
  toastFileLogOff:'Automatic file log disabled.',
  toastSweepIntervalPrefix:'Account scan runs every ',
  toastSweepIntervalSuffix:' minutes.',
  toastInboxDirectOn:'New matching emails in Inbox move immediately.',
  toastInboxDirectOff:'Immediate move for new Inbox arrivals disabled.',
  toastFoldersRefreshed:'Accounts and folders refreshed.',
  toastLangChanged:'Language switched to English.',
  seasonLabel:'Season theme',
  seasonLabelShort:'Season',
  seasonAuto:'Auto · follows the calendar',
  seasonSpring:'🌸 Spring',
  seasonSummer:'☀️ Summer',
  seasonAutumn:'🍂 Autumn',
  seasonWinter:'❄️ Winter',
  seasonNote:'The season colours the interface, the greeting, the landscape and the SortBro toolbar icon – in both light and dark mode.',
  seasonHeroSpring:'Spring',
  seasonHeroSummer:'Summer',
  seasonHeroAutumn:'Autumn',
  seasonHeroWinter:'Winter',
  seasonGreetingSpring:'Have a lovely spring day! 🌸',
  seasonGreetingSummer:'Enjoy the summer! ☀️',
  seasonGreetingAutumn:'Have a lovely autumn day! 🍂',
  seasonGreetingWinter:'Have a lovely winter day! ❄️',
  seasonChanged:'Season theme updated.',
  optRecipient:'To (recipient)',
  optCc:'Cc (copy)',
  optSize:'Size',
  optDate:'Date',
  opLarger:'Is larger than',
  opSmaller:'Is smaller than',
  opOlder:'Is older than',
  opNewer:'Is newer than',
  opBeforeYear:'Is before year',
  opAfterYear:'Is after year',
  condPlaceholderSize:'Number of kB, e.g. 500',
  condPlaceholderDate:'Number of days or a year, e.g. 90 or 2025',
  condPlaceholderRecipient:'e.g. invoice@ or my address',
  condPlaceholderCc:'e.g. finance@',
  runAllRulesBtn:'▶ Run all rules now',
  runAllRulesCount:'▶ Run all rules now ({n})',
  runAllScanned:'Checked {n} emails in {f} folders.',
  runAllQueued:'{n} matched and were queued.',
  runAllDeferred:'{n} wait for the next run (max 100 queued).',
  runAllCached:'{n} unchanged folders were skipped.',
  runAllSkipped:'{n} unavailable folders were skipped.',
  runAllTestMode:'Test mode: no emails were moved.',
  runAllTrial:'{n} rule is on a trial run and only counted.',
  runAllPaused:'Monitoring is paused – no rules were run. Press Pause again to resume.',
  runAllInTarget:'{n} matched the rules but are already in the target folder (or in their year folder).',
  runAllHandled:'{n} had already been handled.',
  runAllNoMatch:'No emails matched the rules – open the rule and press 🔎 Why are the emails not moving?',
  runAllStopped:'The engine is stopped by an error – no rules were run. Message: {code}',
  runAllBusy:'A run is already in progress – wait a few seconds and try again.',
  runAllWaited:'A run was already in progress, so the figures cover the whole run.',
  autoRunOn:'Automatic: {n} rules run every {min} minutes, next at {time}. Incoming mail is monitored continuously.',
  autoRunOff:'Automatic runs are off – enable them under Settings → Sorting & safety. Incoming mail is still monitored continuously.',
  diagnoseBtn:'🔎 Why are the emails not moving?',
  diagnoseTitle:'Why are the emails not moving?',
  diagnoseRunning:'Examining the account folders – nothing is moved…',
  diagnoseSummary:'Checked {s} emails in {f} folders. {m} matched the rule. Rule read mode: {rf}.',
  diagnoseWouldMove:'{n} emails are ready – they move on the next run.',
  diagnoseUnread:'{n} matching emails are unread and wait until you have read them. Tick ”Move unread emails right away too” in step 3 to move them without waiting.',
  diagnoseInTarget:'{n} emails are already in the target folder (or its year folder).',
  diagnoseQueued:'{n} emails were already handled or queued earlier.',
  diagnoseNoMatch:'No emails match the conditions. Check field, value and account – or use Check on a selected email.',
  diagnoseExamples:'Examples of matching emails',
  diagnoseNearTitle:'What the emails in your folders look like',
  diagnoseCondTitle:'Condition by condition – how many emails match',
  diagnoseCondHits:'{n} matches',
  diagnoseCondZero:'0 matches',
  diagnoseCondNoValue:'no value',
  diagnoseCondDeadAll:'The rule requires every condition to match, but {n} of them have 0 matches – that is why nothing moves. Remove that condition or switch to "at least one of the conditions".',
  diagnoseCondDeadAny:'{n} conditions have 0 matches. With "at least one of the conditions" it is enough that one of the others matches.',
  diagnoseAnyTitle:'With "at least one of the conditions", {n} emails would match',
  diagnoseAnyNote:'The conditions look like different variants of the same kind of email. Those should be joined with OR instead of AND: "at least one of the conditions" moves an email as soon as any one of them matches.',
  diagnoseFixAny:'✔ Switch to "at least one of the conditions"',
  diagnoseAnyDone:'Done: the rule now uses "at least one of the conditions" and all rules were run.',
  diagnoseNearNote:'None of them match the rule conditions. Compare subject and sender with the conditions in step 2 – a shorter subject, or Sender (contains), usually catches more emails.',
  diagnoseFixUnread:'✔ Allow unread emails and move them now',
  diagnoseReasonMove:'will move',
  diagnoseReasonUnread:'unread – waiting',
  diagnoseReasonTarget:'already in target',
  diagnoseReasonQueued:'already handled',
  diagnosePaused:'The add-on is paused. Press Pause again to resume monitoring.',
  diagnoseFault:'The engine is stopped by an error. Clear the lock and continue.',
  diagnoseStopped:'The add-on is stopped in this session, so nothing moves right now.',
  diagnoseDryRun:'Test mode is on: matches are counted as trials and nothing moves until you enable moves.',
  opBeforeThisYear:'Is before the current year',
  opAfterThisYear:'Is after the current year',
  condPlaceholderThisYear:'No value needed – follows the calendar',
  ruleYearFoldersLabel:'Optional: put each year in its own year folder under the target folder (e.g. Archive/2025)',
  yearFoldersNote:'Off by default – tick only if you want one folder per year. The year folder is created automatically when needed.',
  tagYearFolders:'🗓️ year folders',
  tplOlder90:'Archive older emails',
  tplNameOlder90:'Archive – older than 90 days',
  templateLabel:'One-click templates:',
  tplInvoice:'Invoices & receipts',
  tplOrder:'Orders & deliveries',
  tplNews:'Newsletters',
  tplSystem:'System & notifications',
  tplBookkeeping:'Bookkeeping',
  tplNameInvoice:'Invoices & receipts',
  tplNameOrder:'Orders & deliveries',
  tplNameNews:'Newsletters',
  tplNameSystem:'System & notifications',
  tplNameBookkeeping:'Bookkeeping',
  tplApplied:'Template filled in. Choose a target folder and save the rule.',
  tplTargetHint:'Tip: create the target folder with ＋ New folder.',
  newFolderBtn:'＋ New folder',
  newFolderEyebrow:'NEW FOLDER IN THUNDERBIRD',
  newFolderTitle:'Create a new target folder',
  newFolderHelp:'The folder is created directly in your account. Pick a name and where it should live.',
  newFolderParentLabel:'Place inside',
  newFolderNameLabel:'Folder name',
  newFolderCreate:'＋ Create folder',
  newFolderNote:'SortBro touches no other folders and never deletes anything.',
  newFolderRoot:'Account root folder',
  cancelBtn:'Cancel',
  toastFolderCreated:'Folder created in Thunderbird and selected as target.',
  toastPrefill:'New rule from the email you right-clicked.',
  errors:{
   bad_branch:'Invalid branch. Each branch needs a condition and a target folder.',
   bad_folder_name:'Enter a folder name of 1–64 characters without slashes.',
   folder_exists:'A folder with that name already exists.',
   folder_create_failed:'The folder could not be created in Thunderbird.',
   disabled:'This rule is disabled. Enable it first.',
   bad_domain:'Enter a complete domain, for example fortnox.se.',
   bad_rule:'Invalid rule.',
   bad_id:'Invalid rule ID.',
   bad_name:'Enter a rule name (up to 100 characters).',
   choose_source:'Select a source folder or account.',
   choose_target:'Select a target folder.',
   same_folder:'Source and target cannot be the same folder.',
   bad_match:'Choose how conditions should be combined.',
   bad_conditions:'A rule requires 1–8 conditions.',
   bad_field:'Invalid field.',
   bad_operator:'Invalid operator for the selected field.',
   bad_value:'Each condition needs a value up to 256 characters.',
   too_many_rules:'Up to 200 rules are supported.',
   duplicate_id:'The file contains duplicate rule IDs.',
   rule_cycle:'These rules would create a move loop. Change source or target folder.',
   unsafe_folder:'Choose a normal folder, not a special or virtual search folder.',
   same_account:'Choose source and target in the same account in this version.',
   read_only:'Target folder does not allow moving messages.',
   bad_schema:'The rule file has an unknown or invalid format.',
   no_selection:'Open a mail tab and select a message first.',
   one_message:'Select exactly one message in the active mail tab.',
   stale_config:'Rules were updated elsewhere. Reopen the saved rule before saving.',
   paused:'Monitoring is paused or locked.',
   unread:'The message is unread and this rule only moves read mail.',
   already_read:'The message is already read and this rule only moves unread mail.',
   no_match:'No active rule matches the selected message.',
   operation_running:'A move is currently in progress. Wait for Thunderbird to finish.',
   uncertain_move:'A move attempt returned an uncertain status. Click "Clear lock & resume" (or under Settings) to resume monitoring.',
   log_save_failed:'The log copy could not be exported. No fallback copy was saved elsewhere. Try again and select a writable folder.',
   log_save_unavailable:'The save dialog is unavailable. Open SortBro in Thunderbird and try again.',
   storage_error:'Settings could not be saved. Engine is stopped for this session.',
   invalid_storage:'Stored settings could not be read. Monitoring is stopped.',
   window_error:'The window could not display the correct message. The move has not started. Check the message in the source folder, then choose Clear lock & resume to try again.',
   display_error:'Message display state could not be verified safely. Monitoring is stopped.',
   move_error:'Folder or message could not be verified for moving. Check rule and folders.',
   sweep_error:'Scanning existing messages failed. Verify that the rule\'s folders exist and are writable.',
   queue_full:'Queue reached safety limit. Monitoring is stopped.',
   internal_error:'A technical error occurred. Automatic retry is disabled.',
   not_installed:'Open this page as an installed Thunderbird add-on.',
   bad_request:'The action could not be completed.'
  },
  events:{
   start:'Monitoring started',
   debug:'Diagnostic',
   catchup:'Existing messages scanned',
   settings_saved:'Settings saved',
   rules_saved:'Rules saved',
   restored:'Pending jobs restored',
   queued:'Message queued',
   simulated:'Test completed – no move',
   moved:'Move confirmed by Thunderbird',
   skipped:'Message skipped',
   error:'Technical error',
   queue_full:'Queue full',
   backup_restored:'Rule backup restored',
   brake:'Safety brake stopped a rule',
   fallback:'Technical event'
  }
 }
};

const T=key=>I18N[currentLang]?.[key]??I18N.sv[key]??key;
const Terr=code=>I18N[currentLang]?.errors?.[code]??I18N.sv.errors[code]??I18N[currentLang]?.errors?.internal_error;
const Tevent=ev=>I18N[currentLang]?.events?.[ev]??I18N.sv.events[ev]??T('events').fallback;
const locale=()=>currentLang==='en'?'en-GB':'sv-SE';

function a11y(node,key,attribute='aria-label'){
 node.setAttribute(attribute,T(key));node.dataset[attribute==='title'?'i18nTitle':'i18nAria']=key;
}
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
function toast(text,error=false){const n=$('toast');n.textContent=text;n.style.background=error?'#8e3731':'';n.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>n.hidden=true,6500);}
function alertError(err){
 toast(Terr(err.code||err.message),true);
 const codes=['storage_error','display_error','move_error','sweep_error','uncertain_move','internal_error','invalid_storage'];
 if(live&&!DEMO&&(!err.code||codes.includes(err.code)))rpc('reportUiError',{code:codes.includes(err.code)?err.code:'internal_error'}).catch(()=>{});
}
async function rpc(type,data={}){
 if(!live&&!DEMO)throw new C.RuleError('not_installed');
 const reply=DEMO?await LasDemo.request({type,...data}):await browser.runtime.sendMessage({type,...data,uiBuild:UI_BUILD});
 if(!reply?.success)throw new C.RuleError(reply?.error||'internal_error');return reply.data;
}
window.addEventListener('error',()=>{if(live&&!DEMO)rpc('reportUiError',{code:'javascript_error'}).catch(()=>{});});
window.addEventListener('unhandledrejection',()=>{if(live&&!DEMO)rpc('reportUiError',{code:'unhandled_rejection'}).catch(()=>{});});
function handle(id,event,fn){const n=$(id);if(n)n.addEventListener(event,async e=>{try{await fn(e);}catch(err){alertError(err);}});}
const label=id=>folders.find(f=>f.id===id)?.label||T('missingFolder');
/* Listorna ritas bara om när deras indata faktiskt ändrats. Under ett svep kommer
   statusen högst var hundrade millisekund (App.changed), och att bygga om upp till
   5 000 loggrader och 200 regelrader varje gång kostade mer än svepet självt.
   Signaturen är en billig sträng av precis det listan läser; allt annat hoppas över. */
const painted=new Map(),logShown=[];
function unchanged(key,signature){
 if(painted.get(key)===signature)return true;
 painted.set(key,signature);return false;
}
function repaint(){painted.clear();logShown.length=0;}
/* Sökvägarna kommer från bakgrunden i statusen (state.paths), så att gränssnittet och
   filskrivningen aldrig kan visa olika saker. Reservvärdet gäller bara innan statusen
   hunnit in. Allt SortBro skapar ligger i undermappar till appmappen i Hämtade filer. */
const FALLBACK_PATHS={root:'Lasfilter/',logs:'Lasfilter/logs/',backups:'Lasfilter/Regelbackuper/',rules:'Lasfilter/Regler/',filters:'Lasfilter/Filterfiler/'};
const paths=()=>(state&&state.paths)||FALLBACK_PATHS;

function updateReadPolicy(){
 const rf=$('ruleReadFilter')?.value||'default';
 const ua=$('ruleUnreadAction')?.value||'default';
 if($('ruleMoveUnread'))$('ruleMoveUnread').checked=(rf==='both'||rf==='unread'||(rf==='default'&&state?.moveMode==='direct'));
 if($('ruleOpenWindow'))$('ruleOpenWindow').checked=(ua==='window'||(ua==='default'&&state?.openWindow!==false));
 /* Fönstervalet betyder bara något när olästa mejl flyttas. Annars är det en
    död ruta som ser ut som en inställning som inte gör något. */
 const movesUnread=$('ruleMoveUnread')?.checked===true;
 if($('ruleOpenWindow'))$('ruleOpenWindow').disabled=!movesUnread;
 if($('ruleOpenTiming'))$('ruleOpenTiming').disabled=!movesUnread||!$('ruleOpenWindow').checked;
 if($('unreadChoiceNote'))$('unreadChoiceNote').classList.toggle('muted-out',!movesUnread);
 const map={
  default:['policyDefaultTitle','policyDefaultBody'],
  read:['policyReadTitle','policyReadBody'],
  both:['policyBothTitle','policyBothBody'],
  unread:['policyUnreadTitle','policyUnreadBody']
 }[rf]||['policyDefaultTitle','policyDefaultBody'];
 if($('readPolicyTitle'))$('readPolicyTitle').textContent=T(map[0]);
 if($('readPolicyBody'))$('readPolicyBody').textContent=T(map[1]);
 updateRuleExplanation();
}

/* Versionen i sidfoten läses ur manifestet, aldrig ur en textsträng. Då kan den
   inte säga en annan version än den som faktiskt är installerad. Saknas manifestet
   (förhandsvisningen) står den statiska texten kvar som reserv. */
function manifestVersion(){
 try{
  const v=globalThis.browser?.runtime?.getManifest?.()?.version;
  if(typeof v==='string'&&/^\d+\.\d+\.\d+$/.test(v))return v;
 }catch{}
 return '';
}
function versionText(){
 const text=T('versionText');
 const v=manifestVersion();
 return v?text.replace(/v\d+\.\d+\.\d+/,('v'+v)):text;
}
/* Sidfoten är statisk text i ui.html, och den skrevs bara om när språket byttes.
   För en svensk installation byts språket aldrig – därför kunde sidfoten stå kvar
   på den version som råkade stå i HTML-filen. Nu skrivs den alltid om vid start. */
function applyVersionLabel(){
 const node=document.querySelector('[data-i18n="versionText"]');
 if(node)node.textContent=versionText();
}
/* Samma version följer med varje ärende till bakgrunden. Bakgrunden jämför den
   med sin egen och laddar om sidor som kör en äldre version – en sida som var
   öppen när tillägget uppdaterades visar annars den gamla versionen för alltid. */
const UI_BUILD=manifestVersion();
function applyLanguage(lang){
 currentLang=lang==='en'?'en':'sv';
 document.documentElement.lang=currentLang;
 document.title=T('pageTitle');
 for(const node of document.querySelectorAll('[data-i18n]')){
  const key=node.dataset.i18n;
  if(key)node.textContent=key==='versionText'?versionText():T(key);
 }
 if($('langSv'))$('langSv').classList.toggle('active',currentLang==='sv');
 if($('langEn'))$('langEn').classList.toggle('active',currentLang==='en');
 if($('lang'))$('lang').value=currentLang;
 if($('themeQuick')){$('themeQuick').title=T('themeQuickTitle');$('themeQuick').setAttribute('aria-label',T('themeQuickTitle'));}
 if($('ruleSearch'))$('ruleSearch').placeholder=T('ruleSearchPlaceholder');
 if($('ruleName'))$('ruleName').placeholder=T('ruleNamePlaceholder');
 if($('quickValue'))$('quickValue').placeholder=T('quickValuePlaceholder');
 const srcVal=$('source')?.value||'',trgVal=$('target')?.value||'';
 if(folders.length){accountOptions(srcVal);targetOptions(trgVal);}
 for(const row of $('conditions')?.children||[]){
  const f=row.children[0],op=row.children[1],val=row.children[2];
  const fVal=f.value,opVal=op.value;
  fillFieldSelect(f,fVal);fillOpSelect(op,fVal,opVal);
  val.placeholder=condPlaceholderFor(fVal);
 }
 for(const row of $('branches')?.children||[]){
  const f=row.children[0],op=row.children[1],val=row.children[2],trg=row.querySelector('.folder-choice');
  const fVal=f.value,opVal=op.value,tVal=trg.value;
  fillFieldSelect(f,fVal);fillOpSelect(op,fVal,opVal);
  val.placeholder=T('branchPlaceholder');
  if(trg.options[0])trg.options[0].textContent=T('chooseTarget');
  trg.value=tVal;
 }
 for(const node of document.querySelectorAll('[data-i18n-aria]'))node.setAttribute('aria-label',T(node.dataset.i18nAria));
 for(const node of document.querySelectorAll('[data-i18n-title]'))node.title=T(node.dataset.i18nTitle);
 for(const select of document.querySelectorAll('#folderModal .folder-choice, #tbImportReview .folder-choice'))folderPicker(select,select.value);
 updateReadPolicy();updateMatchHelp();if(folderTreeSession)renderFolderTree();if(senderSession)renderSenderPreview();
 if($('editorTitle'))$('editorTitle').textContent=selectedId?T('editorEdit'):T('editorNew');
 if(state){applySeason(state.prefs);renderReaderPause();}
 repaint();
}

function applyAppearance(prefs){
 const root=document.documentElement,size=Number(prefs.fontSize)||14;
 root.dataset.density=prefs.density==='compact'?'compact':'comfortable';
 root.dataset.lineSpacing=prefs.lineSpacing==='roomy'?'roomy':'normal';
 root.dataset.largeText=String(size>=20);
 $('density').value=root.dataset.density;$('lineSpacing').value=root.dataset.lineSpacing;
 const collapsed=prefs.introCollapsed===true;
 for(const id of ['introCopy','seasonHeroArt','setupSteps'])$(id).hidden=collapsed;
 $('introCard').classList.toggle('intro-collapsed',collapsed);
 $('introToggle').textContent=T(collapsed?'introShow':'introHide');
 $('introToggle').setAttribute('aria-expanded',String(!collapsed));
}
function applyTheme(prefs){
 let theme=prefs.theme;if(theme==='system')theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
 document.documentElement.dataset.theme=theme;document.documentElement.style.setProperty('--base',(prefs.fontSize||14)+'px');
 $('theme').value=prefs.theme;$('fontSize').value=String(prefs.fontSize);
 const nextLang=prefs.lang==='en'?'en':'sv';
 if(nextLang!==currentLang||document.documentElement.lang!==nextLang)applyLanguage(nextLang);
 else{
  if($('lang'))$('lang').value=currentLang;
  if($('langSv'))$('langSv').classList.toggle('active',currentLang==='sv');
  if($('langEn'))$('langEn').classList.toggle('active',currentLang==='en');
 }
 if(state.moveMode!==undefined){$('moveMode').value=state.moveMode;$('openWindow').checked=state.openWindow!==false;$('hourly').checked=!!state.hourly;$('sweepMinutes').value=String(state.sweepMinutes||60);$('newInboxDirect').checked=state.newInboxDirect!==false;$('verbose').checked=!!state.config.verbose;$('fileLog').checked=state.config.fileLog!==false;$('autoBackup').checked=state.config.autoBackup!==false;$('brake').checked=state.config.brake!==false;}
 applyAppearance(prefs);
 /* Veckostatus: när den senaste automatiska veckokopian skrevs. */
 renderCache(state);
 if($('backupStatus'))$('backupStatus').textContent=state.config.autoBackup===false?'':(state.lastBackupWeek?T('backupLastWeek').replace('{week}',state.lastBackupWeek):T('backupNoWeek'));
}
/* ===== Årstidsteman: Auto · 🌸 Vår · ☀️ Sommar · 🍂 Höst · ❄️ Vinter ===== */
const SEASON_KEYS=['spring','summer','autumn','winter'];
const SEASON_CHOICES=['auto',...SEASON_KEYS];
const SEASON_KEY_NAMES={spring:'seasonGreetingSpring',summer:'seasonGreetingSummer',autumn:'seasonGreetingAutumn',winter:'seasonGreetingWinter'};
function resolveSeason(prefs){
 const pref=prefs?.season;
 return SEASON_KEYS.includes(pref)?pref:C.seasonOf(new Date());
}
function seasonArt(season){
 const sun=(cx,cy,r,opacity)=>`<circle cx="${cx}" cy="${cy}" r="${r}" fill="var(--art-sun)" opacity="${opacity}"/>`;
 const rays=(cx,cy,r)=>`<g stroke="var(--art-sun)" stroke-width="3" stroke-linecap="round" opacity="0.75">${Array.from({length:8},(_,i)=>{const a=i*Math.PI/4;return `<line x1="${(cx+Math.cos(a)*(r+7)).toFixed(1)}" y1="${(cy+Math.sin(a)*(r+7)).toFixed(1)}" x2="${(cx+Math.cos(a)*(r+16)).toFixed(1)}" y2="${(cy+Math.sin(a)*(r+16)).toFixed(1)}"/>`;}).join('')}</g>`;
 const flakes=Array.from({length:16},(_,i)=>`<circle cx="${28+(i*53)%370}" cy="${18+(i*37)%120}" r="${i%3===0?3:2}" fill="var(--art-fg)" opacity="0.5"/>`).join('');
 const leaves=Array.from({length:9},(_,i)=>`<ellipse cx="${40+(i*47)%340}" cy="${24+(i*31)%120}" rx="7" ry="4" fill="var(--art-fg)" opacity="0.75" transform="rotate(${i*23} ${40+(i*47)%340} ${24+(i*31)%120})"/>`).join('');
 const pines=(x,scale)=>`<g transform="translate(${x} 0) scale(${scale})"><rect x="-4" y="132" width="8" height="26" rx="3" fill="#7a5a3a"/><path d="M0 74 L30 132 L-30 132Z" fill="var(--art-fg)"/><path d="M0 96 L26 142 L-26 142Z" fill="var(--art-fg)" opacity="0.92"/></g>`;
 const blossoms=[[104,116],[126,104],[146,120],[118,132]].map(([cx,cy])=>`<circle cx="${cx}" cy="${cy}" r="11" fill="var(--art-fg)" opacity="0.85"/>`).join('');
 const tree=`<rect x="121" y="124" width="7" height="30" rx="3" fill="#8a6a46"/>${blossoms}`;
 const extras={
  spring:`${sun(322,54,24,0.95)}${tree}<path d="M196 46 q9-8 18 0 q9-8 18 0" fill="none" stroke="var(--art-fg)" stroke-width="2.4" opacity="0.7"/>`,
  summer:`${sun(320,48,28,1)}${rays(320,48,28)}<g stroke="var(--art-fg)" stroke-width="2.5" opacity="0.6" fill="none"><path d="M24 176 q16-7 32 0 q16 7 32 0"/><path d="M188 186 q16-7 32 0 q16 7 32 0"/></g>`,
  autumn:`${sun(316,72,22,0.9)}${leaves}`,
  winter:`<circle cx="322" cy="52" r="20" fill="var(--art-sun)" opacity="0.85"/>${pines(84,1)}${pines(132,0.72)}${flakes}`
 }[season]||'';
 const water=season==='summer'?'<rect y="168" width="420" height="32" fill="var(--art-water)" opacity="0.7"/>':'';
 const snow=season==='winter'?'<path d="M0 146 C 90 128, 150 156, 236 138 S 350 148, 420 132 L420 200 L0 200Z" fill="#ffffff" opacity="0.55"/>':'';
 return `<svg viewBox="0 0 420 200" preserveAspectRatio="xMidYMax slice" role="img" aria-label="${T('seasonHero'+season[0].toUpperCase()+season.slice(1))}">
  <defs><linearGradient id="seasonSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--art-sky-top)"/><stop offset="100%" stop-color="var(--art-sky-bottom)"/></linearGradient></defs>
  <rect width="420" height="200" fill="url(#seasonSky)"/>
  ${extras}
  <path d="M0 152 C 70 122, 132 170, 204 142 S 336 154, 420 126 L420 200 L0 200Z" fill="var(--art-hill)"/>
  ${snow}
  <path d="M0 176 C 92 154, 164 190, 252 168 S 362 180, 420 162 L420 200 L0 200Z" fill="var(--art-hill-2)"/>
  ${water}
 </svg>`;
}
function applySeason(prefs){
 const season=resolveSeason(prefs),root=document.documentElement;
 root.dataset.season=season;
 root.dataset.seasonMode=SEASON_CHOICES.includes(prefs?.season)?prefs.season:'auto';
 if($('seasonHeroArt'))$('seasonHeroArt').innerHTML=seasonArt(season);
 if($('seasonGreeting'))$('seasonGreeting').textContent=T(SEASON_KEY_NAMES[season]||'seasonGreetingAutumn');
 const logos=[['brandLogo','64'],['supportLogo','128']];
 for(const [id,size] of logos){
  const img=$(id);if(!img)continue;
  img.src='season-'+season+'-'+size+'.png';
 }
 const value=SEASON_CHOICES.includes(prefs?.season)?prefs.season:'auto';
 if($('season'))$('season').value=value;
 if($('seasonQuick'))$('seasonQuick').value=value;
}
/* Sifferkorten pulserar när ett värde faktiskt ändras. */
const lastCounts={};
function bumpCount(id,value){
 const node=$(id);if(!node)return;
 const text=String(value);
 if(lastCounts[id]!==undefined&&lastCounts[id]!==text){
  node.classList.remove('stat-pulse');void node.offsetWidth;node.classList.add('stat-pulse');
  const card=node.closest('.stat');
  if(card)card.classList.add('stat-updated');
  setTimeout(()=>{node.classList.remove('stat-pulse');card?.classList.remove('stat-updated');},1100);
 }
 lastCounts[id]=text;node.textContent=text;
}

/* ===== 🔁 Thunderbirds egna filter: läs in msgFilterRules.dat och skriv ut våra regler ===== */
let tbImport=null;

function tbNoteText(code){
 const table={
  body:'tbNoteBody',negation:'tbNoteNegation',matchall:'tbNoteMatchall',complex:'tbNoteComplex',
  noMove:'tbNoteNoMove',copy:'tbNoteCopy',noTarget:'tbNoteNoTarget',size:'tbNoteSize',date:'tbNoteDate'
 };
 if(table[code])return T(table[code]);
 if(code.startsWith('approx:'))return T('tbNoteApprox').replace('{field}',code.slice(7));
 if(code.startsWith('unknownField:'))return T('tbNoteUnknown').replace('{field}',code.slice(13));
 if(code==='actions')return '';
 if(code.startsWith('trimmed:'))return T('tbNoteTrimmed').replace('{n}',code.slice(8));
 if(code.startsWith('actions:'))return T('tbNoteActions').replace('{list}',code.slice(8));
 return '';
}
function renderTbReview(){
 const box=$('tbImportReview');if(!box)return;
 box.replaceChildren();
 if(!tbImport){box.hidden=true;return;}
 box.hidden=false;
 const usable=f=>!!f.importable&&!f.failed;
 const chosen=()=>tbImport.filters.filter(f=>usable(f)&&f.selected!==false&&f.target);
 const head=el('div','tb-review-head');
 head.append(el('strong','',T('tbImportTitle').replace('{n}',tbImport.filters.length)));
 head.append(el('span','muted',T('tbImportSummary').replace('{ok}',tbImport.filters.filter(usable).length).replace('{skipped}',tbImport.filters.filter(f=>!usable(f)).length)));
 box.append(head);
 box.append(el('p','muted',T('tbImportReviewNote')));
 const room=C.LIMITS?.rules?C.LIMITS.rules-state.config.rules.length:0;
 if(room>=0&&tbImport.filters.filter(usable).length>room)box.append(el('p','muted tb-row-notes',T('tbImportCapacity').replace('{n}',Math.max(0,room))));
 tbImport.filters.forEach(f=>{
  const importable=usable(f);
  const row=el('div','tb-row'+(importable?'':' tb-row-off'));
  const check=el('input');check.type='checkbox';check.checked=importable&&f.selected!==false;check.disabled=!importable;
  const main=el('div','tb-row-main');
  main.append(el('strong','',f.name||'-'));
  const parts=[f.conditions.length?f.conditions.map(c=>fieldShortText(c.field)+' '+(OPERATOR_LABELS[c.op]?T(OPERATOR_LABELS[c.op]):c.op)+' '+c.value).join(f.match==='any'?' | ':' + '):''];
  if(f.enabled===false)parts.push(T('tbImportDisabled'));
  main.append(el('small','',parts.join('')));
  const notes=f.notes.map(tbNoteText).filter(Boolean);
  if(f.needsTarget&&f.targetName)notes.unshift(T('tbImportNoTargetMatch').replace('{name}',f.targetName));
  if(f.failed)notes.unshift(T('tbImportFailedRow')+Terr(f.failed));
  if(notes.length)main.append(el('small','tb-row-notes',T('tbNotes')+' '+notes.join(' · ')));
  const select=el('select');selectOptions(select,folders,T('tbImportTarget'),f.target||'');
  select.disabled=!importable;
  if(importable&&!f.target)select.classList.add('needs-target');
  select.addEventListener('change',()=>{f.target=select.value;if(check.checked&&!select.value){check.checked=false;f.selected=false;}});
  check.addEventListener('change',()=>{
   if(check.checked&&!select.value){check.checked=false;toast(T('tbImportNeedsTarget'));focusFolderPicker(select);return;}
   f.selected=check.checked;
  });
  row.append(check,main,select);
  box.append(row);folderPicker(select,f.target||'',{disabled:!importable});
 });
 const ready=chosen().length;
 if(tbImport.filters.some(usable)){
  const button=el('button','button small primary',T('tbImportCreate').replace('{n}',ready));
  button.type='button';
  button.disabled=!ready;
  button.addEventListener('click',()=>createTbRules(button).catch(alertError));
  box.append(button);
 }
}

/* Läs bytes så UTF-8 och äldre svenska Windows-filter kan skiljas åt. */
async function fileText(file){
 const bytes=typeof file?.arrayBuffer==='function'?await file.arrayBuffer():await new Promise((resolve,reject)=>{
  const reader=new FileReader();reader.onload=()=>resolve(reader.result);
  reader.onerror=()=>reject(new C.RuleError('bad_schema'));reader.readAsArrayBuffer(file);
 });
 return LasFilters.decodeFilterBytes(bytes);
}
async function fileTextOf(input){
 const file=input?.files?.[0];
 if(!file)return '';
 if(file.size>4194304)throw new C.RuleError('bad_schema');
 return fileText(file);
}
async function importTbFilters(input){
 try{
  const text=await fileTextOf(input);
  if(!text.trim())return;
  const parsed=LasFilters.parseFilterFile(text);
  if(!parsed.rules.length){toast(T('tbImportNothing'));return;}
  const accountId=$('tbAccount')?.value||accounts()[0]?.id||'';
  const inboxId=folders.find(f=>f.accountId===accountId&&C.inboxFolder?C.inboxFolder(f):/^(inkorg|inbox)$/i.test(f.name||''))?.id||'';
  const filters=parsed.rules.map(tb=>{
   const conv=LasFilters.toSortBroRule(tb,{folders,accountId,inboxId,maxConditions:C.LIMITS?.conditions||8});
   return {...conv,selected:conv.importable&&!!conv.target};
  });
  tbImport={filters,accountId,uriPrefix:''};
  const prefix=parsed.rules.map(r=>LasFilters.uriPrefix(r.move?.value||r.copy?.value||'')).find(v=>/^(imap|mailbox|pop3|imap-message|news):\/\//i.test(v))||'';
  if(prefix){
   tbImport.uriPrefix=prefix;
   if($('tbUriPrefix'))$('tbUriPrefix').value=prefix;
   if(accountId){
    const map={...(state.prefs.filterUris||{}),...{[accountId]:prefix}};
    try{state.prefs=await rpc('prefs',{prefs:{filterUris:map}});}catch{}
   }
  }
  renderTbReview();
  const ok=filters.filter(f=>f.importable).length;
  toast(ok?T('tbImportSummary').replace('{ok}',ok).replace('{skipped}',filters.length-ok):T('tbImportNothing'));
 }finally{if(input)input.value='';}
}
async function createTbRules(button){
 if(!tbImport)return;
 const chosen=tbImport.filters.filter(f=>f.importable&&!f.failed&&f.selected!==false&&f.target);
 if(!chosen.length){toast(T('tbImportNothing'));return;}
 if(button)button.disabled=true;
 const created=[],failed=[];
 const taken=new Set(state.config.rules.map(r=>r.id));
 /* Ett id som redan finns får nytt namn i stället för att hela importen faller. */
 const build=f=>{
  let id=f.rule.id,n=1;
  while(taken.has(id)){id=(f.rule.id+'-'+n).slice(0,64);n++;}
  taken.add(id);
  return {...f.rule,target:f.target,id};
 };
 try{
  try{
   /* Snabb väg: alla valda filter i en enda sparning. */
   renderStatus(await rpc('saveRules',{rules:[...state.config.rules,...chosen.map(build)],revision:state.config.revision}));
   dirty=false;created.push(...chosen);
  }catch(err){
   /* Ett filter som motorn inte kan använda får inte fälla hela importen: de andra
      sparas ett i taget, och den som inte går behåller sin förklaring i listan. */
   for(const f of chosen){
    try{
     renderStatus(await rpc('saveRules',{rules:[...state.config.rules,build(f)],revision:state.config.revision}));
     dirty=false;created.push(f);
    }catch(one){f.failed=one.code||'internal_error';failed.push(f);}
   }
  }
  if(created.length)loadRule(created[created.length-1].rule.id);
  if(failed.length){
   tbImport.filters=tbImport.filters.filter(f=>failed.includes(f));
   renderTbReview();
   toast(T('tbImportPartial').replace('{n}',created.length).replace('{m}',failed.length),true);
  }else{
   tbImport=null;renderTbReview();
   toast(T('tbImportDone').replace('{n}',created.length));
  }
 }finally{if(button)button.disabled=false;}
}

function tbExportNoteText(code){
 const table={domain:'tbExportNoteDomain',size:'tbExportNoteSize',branches:'tbExportNoteBranches',yearFolders:'tbExportNoteYearFolders',readPolicy:'tbExportNoteReadPolicy',date:'tbExportNoteDate'};
 if(table[code])return T(table[code]);
 if(code.startsWith('condition:'))return T('tbExportNoteCondition').replace('{what}',code.slice(10));
 return '';
}
async function exportTbFilters(){
 if(!(state.config.rules||[]).length){toast(T('tbExportNeedsRules'));return;}
 const accountId=$('tbAccount')?.value||'';
 const uriPrefix=($('tbUriPrefix')?.value||'').trim();
 if(uriPrefix&&!/^(imap|mailbox|pop3|imap-message|news):\/\//i.test(uriPrefix)){
  toast(T('tbExportBadPrefix'),true);
  return;
 }
 const result=await rpc('filterExport',{accountId,uriPrefix});
 const report=$('tbReport');
 if(!result.written){
  if(report){report.hidden=false;report.textContent=T('tbExportNoUri');}
  toast(T('tbExportNoUri'));
  return;
 }
 const filterFile=paths().filters+'msgFilterRules.dat';
 await download(result.text,filterFile,'text/plain');
 if(report){
  report.hidden=false;
  const lines=[T('tbExportWritten').replace('{n}',result.written)+(result.skipped?' · '+T('tbExportSkipped').replace('{n}',result.skipped):''),T('tbExportPlace')];
  const notes=(result.notes||[]).map(tbExportNoteText).filter(Boolean);
  if(notes.length)lines.push(T('tbNotes')+' '+notes.join(' · '));
  if((result.needsUri||[]).length)lines.push(T('tbExportNoUri'));
  report.replaceChildren(...lines.map(text=>el('p','tb-report-line',text)));
 }
 toast(T('tbExportSaved').replace('{name}',filterFile));
}

/* ===== 1-klicksmallar ===== */
const TEMPLATES={
 faktura:{name:'tplNameInvoice',match:'any',conditions:[['subject','contains','faktura'],['subject','contains','kvitto']],hints:['faktur','kvitto','ekonomi','invoice']},
 order:{name:'tplNameOrder',match:'any',conditions:[['subject','contains','order'],['subject','contains','leverans'],['subject','contains','försändelse']],hints:['order','leverans','inköp','buy']},
 nyhetsbrev:{name:'tplNameNews',match:'any',conditions:[['subject','contains','nyhetsbrev'],['subject','contains','newsletter'],['sender','contains','newsletter']],hints:['nyhetsbrev','news','webb','info']},
 system:{name:'tplNameSystem',match:'any',conditions:[['sender','contains','noreply'],['sender','contains','no-reply'],['subject','contains','notis']],hints:['notis','system','support','drift']},
 bokforing:{name:'tplNameBookkeeping',match:'any',conditions:[['subject','contains','bokföring'],['subject','contains','verifikation'],['subject','contains','moms']],hints:['bokför','ekonomi','redovisning']},
 aldre90:{name:'tplNameOlder90',match:'any',conditions:[['date','older','90']],hints:['arkiv','archive'],readFilter:'read'}
};
function applyTemplate(key){
 const template=TEMPLATES[key];if(!template)return;
 if(dirty&&!confirm(T('confirmDiscard')))return;
 selectedId='';
 if($('ruleName'))$('ruleName').value=T(template.name);
 if($('match'))$('match').value=template.match;
 const box=$('conditions');if(box){box.replaceChildren();for(const [field,op,value] of template.conditions)addCondition({field,op,value});}
 if($('branches'))$('branches').replaceChildren();
 if($('ruleReadFilter'))$('ruleReadFilter').value=template.readFilter||(($('quickMoveUnread')&&!$('quickMoveUnread').checked)?'read':'both');
 if($('ruleUnreadAction'))$('ruleUnreadAction').value=($('quickOpenWindow')&&$('quickOpenWindow').checked)?'window':'keep';
 if($('ruleYearFolders'))$('ruleYearFolders').checked=template.yearFolders===true;
 $('ruleOpenTiming').value='before';
 if(!$('source')?.value){const first=accounts()[0];if(first)accountOptions(first.id);}
 const auto=folders.find(f=>{const n=C.norm((f.name||'')+' '+(f.label||''));return template.hints.some(h=>n.includes(C.norm(h)));});
 if($('target'))targetOptions(auto?.id||$('target').value||'');
 if($('delete'))$('delete').disabled=true;
 if($('editorTitle'))$('editorTitle').textContent=T('editorNew');
 updateReadPolicy();updateMatchHelp();dirty=true;openRuleEditor();renderRules();
 $('ruleForm')?.scrollIntoView({behavior:'smooth',block:'center'});
 toast(T('tplApplied')+(auto?'':' '+T('tplTargetHint')));
}

/* ===== ＋ Ny mapp ===== */
let folderReturnFocus=null;
function closeFolderModal(){
 if(folderTreeSession?.root)closeFolderTree();
 $('folderModal').hidden=true;document.querySelector('.shell').inert=false;
 if(folderReturnFocus?.isConnected)folderReturnFocus.focus();
 folderReturnFocus=null;retrySenderPrefill();
}
function openFolderModal(presetAccountId,suggestedName='',opener=document.activeElement){
 const modal=$('folderModal');if(!modal)return;
 const parent=$('folderParent');
 if(parent)folderPicker(parent,'',{root:true,reset:true,accountId:presetAccountId||''});
 if(!$('source')?.value&&presetAccountId)accountOptions(presetAccountId);
 if($('folderName'))$('folderName').value=(suggestedName||'').slice(0,64);
 folderReturnFocus=opener;closeRuleMenus();
 document.querySelector('.shell').inert=true;modal.hidden=false;
 $('folderName')?.focus();
}
async function createFolderFromModal(){
 const name=$('folderName')?.value||'';
 const parentId=$('folderParent')?.value||'';
 const accountId=$('folderParentAccount')?.value||'';
 if(!accountId)throw new C.RuleError('choose_source');
 const quick=folderReturnFocus?.id==='quickNewFolderBtn';
 const created=await rpc('createFolder',{parentId,name,accountId});
 folders=await rpc('folders');repaint();
 const src=$('source')?.value||'',target=$('target')?.value||'';
 accountOptions(src);targetOptions(quick?target:(created?.id||target));
 if(quick&&created?.id){folderPicker($('quickTarget'),created.id);rememberQuickTarget(created.id);}
 else if(created?.id)dirty=true;
 closeFolderModal();
 renderRules();toast(T('toastFolderCreated'));
}

/* Högerklick: transaktionell väljare. Befintligt utkast ändras aldrig vid öppning/Avbryt. */
let senderSession=null,prefillLoading=false,prefillWaiting=false;
function retrySenderPrefill(){if(prefillWaiting)queueMicrotask(()=>applyPrefill().catch(alertError));}
function openSenderModal(data){
 if(senderSession||!$('folderModal').hidden||folderTreeSession)return false;
 senderSession={data:structuredClone(data),rules:structuredClone(state.config.rules),revision:state.config.revision,focus:document.activeElement,busy:false,stale:false};
 $('senderType').value='address';
 const options=[el('option','',T('senderNew'))];options[0].value='';
 for(const rule of senderSession.rules){const option=el('option','',rule.name+' → '+label(rule.target)+(rule.enabled?'':' · '+T('ruleOff')));option.value=rule.id;options.push(option);}
 $('senderRule').replaceChildren(...options);
 $('senderRule').value=data.action==='add'?(senderSession.rules.find(r=>r.id===selectedId)?.id||senderSession.rules[0]?.id||''):'';
 $('senderError').hidden=true;
 document.querySelector('.shell').inert=true;$('senderModal').hidden=false;
 renderSenderPreview();$('senderType').focus();return true;
}
function closeSenderModal(){
 if(!senderSession||senderSession.busy)return;
 const focus=senderSession.focus;senderSession=null;$('senderModal').hidden=true;document.querySelector('.shell').inert=false;
 if(focus?.isConnected&&focus.tabIndex>=0&&!focus.closest('[hidden],[inert]'))focus.focus();else document.querySelector('.nav.active')?.focus();
 retrySenderPrefill();
}
function senderPlan(){
 const s=senderSession;if(!s)return null;
 if(s.stale)throw new C.RuleError('stale_config');
 if(s.data.selectionCount>1)throw new C.RuleError('sender_multiple');
 const condition=C.senderCondition(s.data.email,$('senderType').value==='domain');
 const id=$('senderRule').value,rule=s.rules.find(r=>r.id===id);
 if(id&&!rule)throw new C.RuleError('bad_id');
 return rule?{...C.addSenderCondition(rule,s.data.email,$('senderType').value==='domain'),original:rule}:{condition,rule:null,duplicate:false};
}
function senderErrorText(code){
 const key=({sender_invalid:'senderInvalid',sender_and:'senderAnd',sender_full:'senderFull',sender_multiple:'senderMultiple',stale_config:'senderStale'})[code];
 return key?T(key):Terr(code);
}
function renderSenderPreview(){
 const s=senderSession;if(!s)return;
 $('senderRule').options[0].textContent=T('senderNew');
 $('senderAddress').textContent=C.email(s.data.email)||T('senderInvalid');
 const box=$('senderPreview');box.replaceChildren();$('senderError').hidden=true;
 const existing=!!$('senderRule').value;$('senderSave').textContent=T(existing?'senderSave':'senderOpen');$('senderRun').hidden=!existing;
 $('senderSave').disabled=$('senderRun').disabled=s.busy;
 for(const id of ['senderType','senderRule','senderCancel'])$(id).disabled=s.busy;
 const paragraph=(text,cls='')=>box.append(el('p',cls,text));
 try{
  const plan=senderPlan();
  if(plan.original){
   const rule=plan.original;
   paragraph(rule.name,'sender-rule-name');
   paragraph(T('senderSource')+(rule.scope==='account'?(accounts().find(a=>a.id===rule.sourceAccount)?.name||rule.sourceAccount):label(rule.source)));
   paragraph(T('senderTarget')+label(rule.target));
   paragraph(T('senderBefore')+rule.conditions.map(ruleConditionLabel).join(' '+T(rule.match==='all'?'conditionAnd':'conditionOr')+' '));
   paragraph(T('senderAfter')+plan.rule.conditions.map(ruleConditionLabel).join(' '+T(plan.rule.match==='all'?'conditionAnd':'conditionOr')+' '));
   paragraph(T('senderPolicy'),'muted');
   if(rule.scope==='account'?rule.sourceAccount!==s.data.accountId:rule.source!==s.data.folderId)paragraph(T('senderOutside'),'notice');
   if(!rule.enabled){paragraph(T('senderDisabled'),'notice');$('senderRun').disabled=true;}
   if(plan.duplicate){paragraph(T('senderDuplicate'),'notice');$('senderSave').disabled=$('senderRun').disabled=true;}
  }else{paragraph(ruleConditionLabel(plan.condition));paragraph(T('senderNewNote'),'muted');}
 }catch(err){$('senderError').textContent=senderErrorText(err.code);$('senderError').hidden=false;$('senderSave').disabled=$('senderRun').disabled=true;}
}
async function saveSenderChoice(runNow=false){
 const s=senderSession;if(!s||s.busy)return;
 const plan=senderPlan();if(plan.duplicate)return;
 if(runNow&&(!plan.original||!confirm(T('senderRunConfirm').replace('{name}',plan.original.name))))return;
 if(dirty&&!confirm(T('confirmDiscardEditor')))return;
 if(!plan.original){
  closeSenderModal();loadRule('',s.data.accountId||'');
  $('conditions').replaceChildren();addCondition(plan.condition);$('ruleName').value=(T('defaultRulePrefix')+plan.condition.value).slice(0,100);
  dirty=true;updateRuleExplanation();$('ruleName').focus();toast(T('toastPrefill'));return;
 }
 s.busy=true;renderSenderPreview();
 let result;
 try{
  result=await rpc('addSenderToRule',{ruleId:plan.original.id,email:s.data.email,wholeDomain:$('senderType').value==='domain',revision:s.revision});
 }catch(err){
  s.busy=false;if(err.code==='stale_config')s.stale=true;renderSenderPreview();
  $('senderError').textContent=senderErrorText(err.code);$('senderError').hidden=false;return;
 }
 s.busy=false;closeSenderModal();renderStatus(result.snapshot);
 if(result.duplicate){toast(T('senderDuplicate'));return;}
 dirty=false;loadRule(result.ruleId,'',{openEditor:false});setRulePanel('list');showView('rules');
 document.querySelector('.nav.active')?.focus();toast(T('senderSaved'));
 if(runNow){
  toast(T('senderRunning'));
  try{const r=await rpc('catchUp',{ruleId:result.ruleId,revision:result.snapshot.config.revision});await refresh();toast(T('senderRunResult').replace('{n}',r.scanned).replace('{q}',r.queued));}
  catch(err){toast(T('senderRunFailed')+Terr(err.code),true);}
 }
}
handle('senderType','change',renderSenderPreview);handle('senderRule','change',renderSenderPreview);
handle('senderSave','click',()=>saveSenderChoice(false));handle('senderRun','click',()=>saveSenderChoice(true));handle('senderCancel','click',closeSenderModal);
handle('senderModal','click',event=>{if(event.target===$('senderModal'))closeSenderModal();});
handle('senderModal','keydown',event=>{
 if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeSenderModal();return;}
 if(event.key!=='Tab')return;
 const items=modalFocusItems($('senderModal')),first=items[0],last=items.at(-1);
 if(!first){event.preventDefault();return;}
 if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
 else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
});
document.addEventListener('focusin',event=>{if(senderSession&&!$('senderModal').contains(event.target)){
 const target=modalFocusItems($('senderModal'))[0]||$('senderModal').querySelector('[role="dialog"]');target.focus();
}});
async function applyPrefill(){
 if(!live||DEMO||prefillLoading||senderSession||folderTreeSession||!$('folderModal').hidden)return false;
 prefillLoading=true;prefillWaiting=false;
 try{
  const data=await rpc('pendingPrefill');if(!data){retrySenderPrefill();return false;}
  renderStatus(await rpc('status'));
  if(!openSenderModal(data)){prefillWaiting=true;return false;}
  await rpc('prefillConsumed',{token:data.token}).catch(()=>{});return true;
 }finally{prefillLoading=false;}
}

function currentToken(){return JSON.stringify(state.config.rules);}
/* SortBro avinstallerar aldrig sig självt – men Thunderbird stänger av tillfälliga och
   sidoladdade tillägg. Då säger vi det rakt ut i stället för att användaren ska gissa. */
let installWarnDismissed=false;
/* Säkerhetsbromsen: en rad per stoppad regel, med de två svaren. Inget flyttas
   förrän användaren har svarat, så raden ligger kvar tills dess. */
function renderBrakeWarns(){
 const box=$('brakeWarns');if(!box)return;
 const holds=Array.isArray(state.brakeHolds)?state.brakeHolds:[];
 box.replaceChildren();
 if(!holds.length){box.hidden=true;return;}
 box.hidden=false;
 for(const h of holds){
  const row=el('div','brake-warn');
  row.append(el('span','brake-warn-icon','⚠'));
  const body=el('div','brake-warn-body');
  body.append(el('strong','',T('brakeWarnTitle')));
  body.append(el('span','',T('brakeWarnText')
   .replace('{name}',h.name||h.ruleId)
   .replace('{n}',String(h.matched))
   .replace('{limit}',String(h.limit))
   .replace('{median}',h.median?String(h.median):T('brakeWarnNever'))));
  const actions=el('div','brake-warn-actions');
  const move=el('button','button small secondary',T('brakeWarnMove'));move.type='button';move.dataset.brakeMove=h.ruleId;
  const stop=el('button','button small secondary',T('brakeWarnStop'));stop.type='button';stop.dataset.brakeStop=h.ruleId;
  const del=el('button','button small secondary',T('brakeWarnDelete'));del.type='button';del.dataset.brakeDelete=h.ruleId;
  actions.append(move,stop,del);
  row.append(body,actions);
  box.append(row);
 }
}
function brakeName(ruleId){
 const h=(state.brakeHolds||[]).find(x=>x.ruleId===ruleId);
 return h?.name||ruleId;
}
async function brakeAnswer(ruleId,action){
 try{
  if(action==='move'){
   const name=brakeName(ruleId);
   const r=await rpc('brakeRelease',{ruleId});
   renderStatus(r.status);
   toast(T('brakeReleased').replace('{name}',name).replace('{n}',String(r.result?.queued??0)));
  }else if(action==='delete'){
   /* Raderingen är den enda av de tre som inte går att ångra i stunden, så den
      frågar en gång till – med regelns namn i frågan, inte en anonym bekräftelse. */
   const name=brakeName(ruleId);
   if(!confirm(T('brakeDeleteConfirm').replace('{name}',name)))return;
   const status=await rpc('brakeDelete',{ruleId});
   renderStatus(status);
   toast(T('brakeDeleted').replace('{name}',name));
  }else{
   const name=brakeName(ruleId);
   const status=await rpc('brakeCancel',{ruleId});
   renderStatus(status);
   toast(T('brakeStopped').replace('{name}',name));
  }
 }catch(err){alertError(err);}
}
function renderInstallWarning(next){
 const box=$('installWarn');if(!box)return;
 const type=next?.installType==='development'?'temporary':next?.installType==='sideload'?'sideload':'';
 if(!type||installWarnDismissed){box.hidden=true;return;}
 if($('installWarnTitle'))$('installWarnTitle').textContent=T(type==='temporary'?'installWarnTempTitle':'installWarnSideTitle');
 if($('installWarnText'))$('installWarnText').textContent=T(type==='temporary'?'installWarnTempText':'installWarnSideText');
 box.hidden=false;
}
/* Cachen: reglaget speglar konfigurationen, raden säger när den senast tömdes.
   Dagen räknas lokalt – "i dag" ska betyda din dag, inte UTC:s. */
function cacheDayOf(ms){const d=new Date(ms);return new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime();}
function cacheStatusText(cache){
 const at=Number(cache?.at)||0;
 if(!at)return T(cache?.on===false?'cacheOff':'cacheNever');
 const time=new Date(at).toLocaleTimeString(locale(),{hour:'2-digit',minute:'2-digit'});
 const days=Math.round((cacheDayOf(Date.now())-cacheDayOf(at))/86400000);
 const when=days<=0?T('cacheToday').replace('{time}',time)
  :days===1?T('cacheYesterday').replace('{time}',time)
  :T('cacheDaysAgo').replace('{n}',days);
 /* Är automatiken avstängd ska det stå – annars tror man att raden ljuger. */
 return cache?.on===false?when+' '+T('cacheOff'):when;
}
function renderCache(next){
 if($('autoClear'))$('autoClear').checked=next?.cache?.on!==false;
 if($('cacheStatus'))$('cacheStatus').textContent=cacheStatusText(next?.cache);
}
let readerPauseBusy=false;
function renderReaderPause(){
 const pause=state?.readerPause||{paused:false,until:0};
 const text=pause.saving?T('readerPauseSaving'):!pause.paused?T('readerPauseOff'):pause.until===-1?T('readerPauseIndefinite'):T('readerPauseUntil').replace('{time}',new Date(pause.until).toLocaleString(locale(),{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}));
 for(const id of ['readerPauseStatus','readerPauseNoticeText'])if($(id).textContent!==text)$(id).textContent=text;
 const pauseFocus=document.activeElement,returnFocus=[$('readerPauseResume'),$('readerPauseResumeNotice')].includes(pauseFocus)&&!pause.paused;
 $('readerPauseNotice').hidden=!pause.paused;$('readerPauseResume').hidden=!pause.paused;
 for(const id of ['readerPauseDuration','readerPauseApply','readerPauseResume','readerPauseResumeNotice'])$(id).disabled=readerPauseBusy||pause.saving===true;
 if(returnFocus&&!readerPauseBusy){if(pauseFocus===$('readerPauseResumeNotice'))document.querySelector('.nav[aria-selected="true"]')?.focus();else $('readerPauseApply').focus();}
}
async function setReaderPause(mode){
 if(readerPauseBusy)return;
 const origin=document.activeElement;readerPauseBusy=true;renderReaderPause();
 try{renderStatus(await rpc('setReaderPause',{mode}));}
 finally{readerPauseBusy=false;renderReaderPause();if(mode==='resume'&&!state?.readerPause?.paused){if(origin===$('readerPauseResumeNotice'))document.querySelector('.nav[aria-selected="true"]')?.focus();else $('readerPauseApply').focus();}}
}
handle('readerPauseApply','click',()=>setReaderPause($('readerPauseDuration').value));
handle('readerPauseResume','click',()=>setReaderPause('resume'));
handle('readerPauseResumeNotice','click',()=>setReaderPause('resume'));
function renderStatus(next){
 state=next;applyTheme(state.prefs);applySeason(state.prefs);renderReaderPause();
 const cfg=state.config,active=cfg.rules.filter(r=>r.enabled).length;
 $('navCount').textContent=cfg.rules.length;bumpCount('countRules',active);bumpCount('countQueue',state.queued);
 bumpCount('countMoved',state.stats.moved);bumpCount('countMatched',state.stats.matched);$('simulated').textContent=state.stats.simulated+' test';
 $('statusPill').textContent=state.fault?T('pillStopped'):cfg.paused?T('pillPaused'):cfg.dryRun?T('pillTest'):T('pillActive');
 $('statusPill').className='pill '+(state.fault?'red':cfg.dryRun||cfg.paused?'amber':'green');
 $('pause').textContent=cfg.paused?T('pauseResume'):T('pauseBtn');$('mode').textContent=cfg.dryRun?T('modeEnable'):T('modeTest');
 const guide=$('runGuide'),rulesReady=active>0;
 let guideClass='',icon='✓',title=T('guideActiveTitle'),text=rulesReady?T('guideActiveReady'):T('guideActiveNoRules');
 if(state.fault){guideClass='fault';icon='!';title=T('guideFaultTitle');text=Terr(state.fault)+T('guideFaultTail');}
 else if(cfg.paused){guideClass='paused';icon='Ⅱ';title=T('guidePausedTitle');text=T('guidePausedBody');}
 else if(cfg.dryRun){guideClass='test';icon='T';title=T('guideTestTitle');text=rulesReady?T('guideTestReady'):T('guideTestNoRules');}
 $('runIcon').textContent=icon;$('runTitle').textContent=title;$('runText').textContent=text;guide.className='run-guide '+guideClass;
 const setup=[cfg.rules.length>0,active>0,!cfg.dryRun&&!cfg.paused&&!state.fault];
 for(let i=0;i<3;i++){$('setup'+(i+1)).className='setup-step'+(setup[i]?' done':'')+(!setup[i]&&(i===0||setup[i-1])?' current':'');$('setup'+(i+1)).querySelector('b').textContent=setup[i]?'✓':String(i+1);}
 $('sweepNow').disabled=!!state.fault||cfg.paused||!rulesReady;$('sweepNow').textContent=state.queued?T('sweepQueueNow'):T('sweepRunNow');
 if($('clearFault'))$('clearFault').hidden=!state.fault&&!state.blocked;
 renderInstallWarning(state);
 renderBrakeWarns();
 $('notice').hidden=!state.fault;$('notice').className='notice error';$('notice').textContent=state.fault?T('noticeStoppedPrefix')+Terr(state.fault)+T('noticeStoppedSuffix'):'';
 $('lastCheck').textContent=state.lastCheck?T('lastCheckPrefix')+new Date(state.lastCheck).toLocaleTimeString(locale())+' · '+state.stats.checks+T('lastCheckCountSuffix'):T('lastCheckWaiting');
 if($('autoRunInfo')){
  const n=state.config.rules.filter(r=>r.enabled).length;
  $('autoRunInfo').textContent=state.hourly
   ?T('autoRunOn').replace('{n}',n).replace('{min}',state.sweepMinutes).replace('{time}',state.nextAutoSweep?new Date(state.nextAutoSweep).toLocaleTimeString(locale()):'-')
   :T('autoRunOff');
 }
 if($('runAllRulesBtn'))$('runAllRulesBtn').textContent=state.config.rules.length?T('runAllRulesCount').replace('{n}',state.config.rules.length):T('runAllRulesBtn');
 if(editToken===currentToken())editRevision=cfg.revision;
 if($('supStatRules'))$('supStatRules').textContent='▤ '+active+' '+T('statRules');
 if($('supStatMoved'))$('supStatMoved').textContent='↗ '+state.stats.moved+' '+T('statMoved');
 updateDonationView();
 if($('learnOn'))$('learnOn').checked=!(state.learn&&state.learn.off);
 renderTrialBar();renderLearnBar();
 renderRules();renderActivity();renderBackups();renderQuickExisting();renderTbAccounts();quickHintsOnce();updateRuleExplanation();
}
function fieldShortText(field){return {sender:T('fieldSenderShort'),domain:T('fieldDomainShort'),subject:T('fieldSubjectShort'),recipient:T('fieldRecipientShort'),cc:T('fieldCcShort'),size:T('fieldSizeShort'),date:T('fieldDateShort')}[field]||T('fieldSubjectShort');}
function ruleTagText(rule){
 if(!rule.enabled)return T('tagDisabled');
 const scopeText=rule.scope==='account'?T('scopeAccount'):T('scopeFolder');
 const rf=rule.readFilter||'default';
 const modeText=rf==='read'?T('tagRead'):rf==='both'?T('tagBoth'):rf==='unread'?T('tagUnread'):T('tagDefault');
 return scopeText+' · '+modeText+(rule.yearFolders?' · '+T('tagYearFolders'):'');
}
/* Provkörning i editorn: rutan och antalet dagar som är kvar. */
function setTrialFields(rule){
 const box=$('ruleTrial'),left=$('trialLeft');
 if(!box)return;
 const active=!!(rule&&C.trialActive(rule));
 box.checked=active;
 if(left){
  const days=active?C.trialDaysLeft(rule):0;
  left.hidden=!days;
  left.textContent=days?T(days===1?'trialDayLeft':'trialDaysLeft').replace('{n}',days):'';
 }
}
/* Provkörda regler vars tid har gått ut: en rad med tre tydliga val. */
function renderTrialBar(){
 const bar=$('trialBar');if(!bar)return;
 if(unchanged('trial',JSON.stringify([state.trials||[],currentLang])))return;
 const expired=(state.trials||[]).filter(t=>!t.active);
 bar.replaceChildren();bar.hidden=!expired.length;
 for(const t of expired){
  const row=el('div','trial-row');
  row.append(el('strong','',T('trialTitle')+' · '+t.name));
  const msg=t.count===0?T('trialWouldNone').replace('{name}',t.name):T(t.count===1?'trialWouldOne':'trialWould').replace('{name}',t.name).replace('{n}',t.count);
  row.append(el('p','',msg));
  const actions=el('div','bar-actions');
  const add=(label,action,cls,toastKey)=>{
   const b=el('button','button small '+cls,label);b.type='button';
   b.addEventListener('click',async()=>{
    b.disabled=true;
    try{const r=await rpc('trialResolve',{ruleId:t.ruleId,action});renderStatus(r.snapshot);toast(T(toastKey));}
    catch(err){b.disabled=false;alertError(err);}
   });
   actions.append(b);
  };
  add(T('trialActivate'),'activate','primary','trialActivated');
  add(T('trialExtend'),'extend','secondary','trialExtended');
  add(T('trialOff'),'off','secondary','trialOffDone');
  row.append(actions);
  bar.append(row);
 }
}
/* Inlärda förslag: domän + mapp + antal. Bara ett förslag – inget skapas utan klick. */
function renderLearnBar(){
 const bar=$('learnBar');if(!bar)return;
 if(unchanged('learn',JSON.stringify([state.learn||null,currentLang,folders.length])))return;
 const list=(state.learn&&!state.learn.off)?state.learn.suggestions||[]:[];
 bar.replaceChildren();bar.hidden=!list.length;
 if($('learnEmpty')){$('learnEmpty').hidden=!!list.length;$('learnEmpty').textContent=T(state.learn?.off?'learnEmptyOff':'learnEmpty');}
 if(!list.length)return;
 const head=el('div','learn-head');
 head.append(el('strong','',T('learnTitle')));
 const off=el('button','text-button',T('learnOff'));off.type='button';
 off.addEventListener('click',async()=>{
  try{renderStatus(await rpc('learnOff'));toast(T('learnOffDone'));}catch(err){alertError(err);}
 });
 head.append(off);
 bar.append(head);
 for(const s of list){
  const row=el('div','learn-row');
  const folder=folders.find(f=>f.id===s.target);
  row.append(el('p','',T('learnBody').replace('{n}',s.count).replace('{domain}',s.domain).replace('{target}',folder?.name||folder?.label||T('missingFolderShort'))));
  const actions=el('div','bar-actions');
  const create=el('button','button small primary',T('learnCreate'));create.type='button';
  create.addEventListener('click',async()=>{
   if(dirty&&!confirm(T('confirmDiscardEditor')))return;
   create.disabled=true;
   try{
    const r=await rpc('learnCreate',{key:s.key});
    renderStatus(r.snapshot);
    toast(T(r.existing?'learnExisting':'learnCreated'));
    if(!r.existing){dirty=false;loadRule(r.ruleId,'',{openEditor:false});}
   }catch(err){create.disabled=false;alertError(err);}
  });
  const snooze=el('button','button small secondary',T('learnSnooze'));snooze.type='button';
  snooze.addEventListener('click',async()=>{
   snooze.disabled=true;
   try{renderStatus(await rpc('learnSnooze',{key:s.key}));}catch(err){snooze.disabled=false;alertError(err);}
  });
  actions.append(create,snooze);
  row.append(actions);
  bar.append(row);
 }
}
function renderRules(){
 /* Allt listan läser: reglerna, sökordet, markeringen, språket och mapplistan
    (den behövs för konfliktvarningen och för att visa mappnamn). */
 const sig=JSON.stringify([state.config.rules,selectedId,$('ruleSearch')?.value||'',currentLang,folders.map(f=>[f.id,f.name,f.label,f.accountId,f.accountName]),state.config.paused,state.fault,state.moveMode,state.openWindow]);
 if(unchanged('rules',sig))return;
 paintRules();
}
/* Menyerna är vanliga knappar/disclosure, inte ARIA-menyer: Tab och Enter
   fungerar som i resten av appen. Escape stänger och lämnar tillbaka fokus. */
function closeRuleMenus(except=null){
 document.querySelectorAll('.rule-menu-toggle').forEach(button=>{
  if(button===except)return;
  button.setAttribute('aria-expanded','false');
  const panel=document.getElementById(button.getAttribute('aria-controls'));if(panel)panel.hidden=true;
 });
}
document.addEventListener('click',event=>{if(!event.target.closest('.rule-menu-toggle,.rule-menu-panel'))closeRuleMenus();});
document.addEventListener('keydown',event=>{
 if(event.key!=='Escape')return;
 const button=document.querySelector('.rule-menu-toggle[aria-expanded="true"]');
 if(button){event.preventDefault();closeRuleMenus();button.focus();}
});
async function moveRulePriority(ruleId,step){
 if(dirty){toast(T('saveBeforePriority'));return;}
 const rules=[...state.config.rules],revision=state.config.revision,i=rules.findIndex(r=>r.id===ruleId),j=i+step;
 if(i<0||j<0||j>=rules.length)return;
 const name=rules[i].name,other=rules[j].name;
 const values={name,other,from:String(i+1),to:String(j+1)};
 const question=T('priorityConfirm').replace(/\{(name|other|from|to)\}/g,(_,key)=>values[key]);
 if(!confirm(question))return;
 [rules[i],rules[j]]=[rules[j],rules[i]];
 renderStatus(await rpc('saveRules',{rules,revision}));loadRule(ruleId,'',{openEditor:rulePanel==='editor'});
 const row=[...document.querySelectorAll('.rule-row')].find(r=>r.dataset.ruleId===ruleId);row?.querySelector('.rule-menu-toggle')?.focus();
 toast(T('priorityChanged').replace('{name}',name).replace('{n}',String(j+1)));
}
function ruleConditionLabel(c){return fieldShortText(c.field)+' · '+(OPERATOR_LABELS[c.op]?T(OPERATOR_LABELS[c.op]):c.op)+(String(c.value??'').trim()?' · '+c.value:'');}
function paintRules(){
 const list=$('ruleList');list.replaceChildren();const search=C.norm($('ruleSearch').value);
 /* Konfliktkartan: vilka regler som kan träffa samma mejl och skicka det olika väg.
    Mappens konto slås upp i den inlästa mapplistan, så mapp- och kontoregler kan jämföras. */
 const accountOf=id=>folders.find(f=>f.id===id)?.accountId||'';
 const conflictMap=new Map();
 for(const c of C.conflicts(state.config.rules,{accountOf})){
  const add=(id,other,winner)=>{if(!conflictMap.has(id))conflictMap.set(id,[]);conflictMap.get(id).push({other,winner,fields:c.fields});};
  add(c.aId,c.bId,true);add(c.bId,c.aId,false);
 }
 const shown=state.config.rules.filter(r=>C.ruleMatchesSearch(r,search,folders));
 if(!shown.length){list.append(el('p','empty',state.config.rules.length?T('emptyNoMatch'):T('emptyNoRules')));return;}
 for(const rule of shown){
  const row=el('div','rule-row'+(selectedId===rule.id?' selected':''));row.dataset.ruleId=rule.id;
  const position=state.config.rules.findIndex(r=>r.id===rule.id);
  const check=el('input');check.type='checkbox';check.checked=rule.enabled;check.setAttribute('aria-label',T('ruleEnable').replace('{name}',rule.name));
  check.addEventListener('change',async()=>{try{
   if(dirty&&!confirm(T('confirmDiscardEditor'))){check.checked=!check.checked;return;}
   const rules=state.config.rules.map(r=>r.id===rule.id?{...r,enabled:check.checked}:r);
   const next=await rpc('saveRules',{rules,revision:state.config.revision});dirty=false;renderStatus(next);loadRule(rule.id,'',{openEditor:rulePanel==='editor'});
  }catch(e){check.checked=!check.checked;alertError(e);}});
  const main=el('div','rule-main');
  const btn=el('button','rule-open');btn.type='button';btn.append(el('strong','',rule.name));
  btn.title=T('ruleEdit')+' · '+rule.name;
  const f=folders.find(f=>f.id===rule.target);
  const target=el('small','rule-target','↳ '+(f?.name||f?.label||T('missingFolderShort')));target.title=f?.label||T('missingFolderShort');btn.append(target);
  if(rule.branches?.length)btn.append(el('small','',T('ruleTargetMore').replace('{n}',rule.branches.length)));
  const meta=el('div','rule-meta');
  meta.append(el('span','rule-order',T('ruleOrder').replace('{n}',position+1)),el('span','rule-status'+(rule.enabled?' is-on':''),T(rule.enabled?'ruleOn':'ruleOff')));
  const details=el('details','rule-details');details.append(el('summary','',T('ruleDetails')));
  const body=el('div','rule-details-body');
  const source=rule.scope==='account'?(accounts().find(a=>a.id===rule.sourceAccount)?.label||T('missingFolderShort')):label(rule.source);
  body.append(el('p','',T('ruleSource')+': '+source),el('p','',T('ruleTarget')+': '+(f?.label||T('missingFolderShort'))));
  for(const branch of rule.branches||[])body.append(el('p','',ruleConditionLabel(branch.condition)+' → '+label(branch.target)));
  body.append(el('strong','',T('ruleConditions')+' · '+T(rule.match==='any'?'ruleAny':'ruleAll')));
  const conditions=el('ul');for(const c of rule.conditions)conditions.append(el('li','',ruleConditionLabel(c)));
  body.append(conditions,el('p','rule-mode-detail',ruleTagText(rule)));
  if(rule.trialUntil>0){
   const days=C.trialDaysLeft(rule);
   btn.append(el('span','rule-tag trial-tag',T('trialBadge')+(days?' · '+T(days===1?'trialDayLeft':'trialDaysLeft').replace('{n}',days):'')));
  }
  btn.addEventListener('click',()=>{if(!dirty||confirm(T('confirmDiscard'))){loadRule(rule.id);$('ruleName').focus();}});
  const opts=el('div','rule-inline-opts');
  const moveUnreadLbl=el('label'),moveUnreadChk=el('input');moveUnreadChk.type='checkbox';
  const rf=rule.readFilter||'default';
  moveUnreadChk.checked=rf==='both'||rf==='unread'||(rf==='default'&&state.moveMode==='direct');
  moveUnreadLbl.append(moveUnreadChk,el('span','',T('inlineMoveUnread')));
  const openWinLbl=el('label'),openWinChk=el('input');openWinChk.type='checkbox';
  const ua=rule.unreadAction||'default';
  openWinChk.checked=ua==='window'||(ua==='default'&&state.openWindow!==false);
  openWinChk.disabled=!moveUnreadChk.checked;
  openWinLbl.append(openWinChk,el('span','',T('inlineOpenWindow')));
  moveUnreadChk.addEventListener('change',async e=>{
   e.stopPropagation();
   try{
    if(dirty&&!confirm(T('confirmDiscardEditor'))){moveUnreadChk.checked=!moveUnreadChk.checked;return;}
    const nextRf=moveUnreadChk.checked?'both':'read';
    const rules=state.config.rules.map(r=>r.id===rule.id?{...r,readFilter:nextRf}:r);
    const next=await rpc('saveRules',{rules,revision:state.config.revision});
    dirty=false;renderStatus(next);if(selectedId===rule.id)loadRule(rule.id,'',{openEditor:rulePanel==='editor'});
    toast(T('toastRuleSaved'));
   }catch(err){moveUnreadChk.checked=!moveUnreadChk.checked;alertError(err);}
  });
  openWinChk.addEventListener('change',async e=>{
   e.stopPropagation();
   try{
    if(dirty&&!confirm(T('confirmDiscardEditor'))){openWinChk.checked=!openWinChk.checked;return;}
    const nextUa=openWinChk.checked?'window':'keep';
    const rules=state.config.rules.map(r=>r.id===rule.id?{...r,unreadAction:nextUa}:r);
    const next=await rpc('saveRules',{rules,revision:state.config.revision});
    dirty=false;renderStatus(next);if(selectedId===rule.id)loadRule(rule.id,'',{openEditor:rulePanel==='editor'});
    toast(T('toastRuleSaved'));
   }catch(err){openWinChk.checked=!openWinChk.checked;alertError(err);}
  });
  opts.append(moveUnreadLbl,openWinLbl);
  body.append(opts);details.append(body);main.append(btn,meta);
  const menu=el('button','rule-menu-toggle','⋯');menu.type='button';menu.title=T('ruleMenuLabel').replace('{name}',rule.name);menu.setAttribute('aria-label',menu.title);menu.setAttribute('aria-expanded','false');
  const panel=el('div','rule-menu-panel');panel.id='rule-actions-'+position;panel.hidden=true;menu.setAttribute('aria-controls',panel.id);
  menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')==='true';closeRuleMenus(menu);menu.setAttribute('aria-expanded',String(!open));panel.hidden=open;if(!open)row.scrollIntoView({block:'nearest'});});
  const quick=el('div','rule-action-grid');
  const editBtn=el('button','rule-action',T('ruleEdit'));editBtn.type='button';editBtn.dataset.action='ruleEdit';
  editBtn.addEventListener('click',()=>{if(dirty&&!confirm(T('confirmDiscard')))return;closeRuleMenus();loadRule(rule.id);$('ruleName').focus();});
  const runBtn=el('button','rule-action',T('ruleRun'));runBtn.type='button';runBtn.dataset.action='ruleRun';runBtn.title=T('runRuleNowTitle');runBtn.disabled=!rule.enabled||!!state.fault||state.config.paused;
  runBtn.addEventListener('click',async e=>{
   e.stopPropagation();runBtn.disabled=true;
   try{
    const r=await rpc('catchUp',{ruleId:rule.id});renderStatus(await rpc('status'));
    const extra=r.queued?'':
     r.inTarget?(currentLang==='en'?' '+r.inTarget+' already in the target folder.':' '+r.inTarget+' låg redan i målmappen.'):
     r.matched?(currentLang==='en'?' All matching emails were already handled.':' Alla matchande mejl var redan hanterade.'):
     (r.scanned?(currentLang==='en'?' No email matched the rule.':' Inga mejl matchade regeln.'):'');
    toast(currentLang==='en'?'Rule "'+rule.name+'": scanned '+r.scanned+', queued '+r.queued+'.'+extra:'Regel "'+rule.name+'": skannade '+r.scanned+', köade '+r.queued+'.'+extra);
   }catch(err){alertError(err);}
   finally{runBtn.disabled=!rule.enabled||!!state.fault||state.config.paused;}
  });
  const dupBtn=el('button','rule-action',T('ruleCopy'));dupBtn.type='button';dupBtn.dataset.action='ruleCopy';dupBtn.title=T('dupRuleTitle');
  dupBtn.addEventListener('click',e=>{
   e.stopPropagation();
   if(dirty&&!confirm(T('confirmDiscard')))return;
   loadRule(rule.id);
   selectedId='';
   $('editorTitle').textContent=T('editorNew');
   $('ruleName').value=(rule.name+T('copySuffix')).slice(0,100);
   $('delete').disabled=true;$('up').disabled=true;$('down').disabled=true;
   dirty=true;renderRules();$('ruleName').focus();
   toast(T('toastDuplicated'));
  });
  quick.append(editBtn,runBtn,dupBtn);
  const action=(key,fn,disabled=false)=>{
   const button=el('button','rule-action'+(key==='ruleDelete'?' rule-action-danger':''),T(key));button.type='button';button.dataset.action=key;button.disabled=disabled;
   button.addEventListener('click',async()=>{button.disabled=true;try{await fn();}catch(err){alertError(err);}finally{button.disabled=disabled;}});quick.append(button);
  };
  action('ruleExport',()=>exportRuleFile(rule));
  for(const [key,step] of [['ruleUp',-1],['ruleDown',1]])action(key,()=>moveRulePriority(rule.id,step),position+step<0||position+step>=state.config.rules.length);
  action('ruleDelete',async()=>{
   if(dirty&&!confirm(T('confirmDiscardEditor')))return;
   if(!confirm(T('ruleDeleteNamed').replace('{name}',rule.name)))return;
   const next=await rpc('saveRules',{rules:state.config.rules.filter(r=>r.id!==rule.id),revision:state.config.revision});
   dirty=false;renderStatus(next);loadRule(selectedId===rule.id?'':selectedId,'',{openEditor:false});setRulePanel('list');
  });
  panel.append(quick,details);row.append(check,main,menu,panel);list.append(row);
  const clash=conflictMap.get(rule.id);
  if(clash&&clash.length){
   const warning=el('details','rule-conflict');warning.append(el('summary','','⚠ '+T('ruleOverlap').replace('{n}',clash.length)));
   for(const conflict of clash){
    const other=state.config.rules.find(r=>r.id===conflict.other);
    const fields=conflict.fields.map(fieldShortText).join(', ');
    warning.append(el('p','',T('conflictTitle').replace('{name}',other?.name||conflict.other).replace('{fields}',fields)+' '+(conflict.winner?T('conflictWinner'):T('conflictLoser'))));
   }
   row.append(warning);
  }
 }
}
function selectOptions(select,items,placeholder,value=''){
 select.replaceChildren();const blank=el('option','',placeholder);blank.value='';select.append(blank);
 for(const f of items){const o=el('option','',f.label);o.value=f.id;select.append(o);}select.value=value;
}
function accounts(){
 const seen=new Set();return folders.filter(f=>{if(!f.accountId||seen.has(f.accountId))return false;seen.add(f.accountId);return true;})
  .map(f=>({id:f.accountId,label:[f.accountName||f.accountId,f.accountEmail].filter((v,i,a)=>v&&a.indexOf(v)===i).join(' · ')}));
}
function accountOptions(value=''){selectOptions($('source'),accounts(),T('chooseAccount'),value);}
/* Varje väljare äger sitt konto/sökfält. ID:n för Thunderbird-mappar ändras aldrig.
   En avsiktligt tömd väljare får inte återställas från senast använda målmapp. */
const folderPickers=new WeakMap();let folderPickerSeq=0,folderTreeSession=null;
function folderPicker(select,value='',options={}){
 let p=folderPickers.get(select);
 if(!p){
  const wrap=el('div','folder-picker folder-picker-tree'),account=el('select'),browse=el('button','button secondary folder-browse'),hint=el('p','folder-path');
  const base=select.id||('folderChoice'+(++folderPickerSeq));
  select.id=base;account.id=base+'Account';browse.id=base+'Browse';hint.id=base+'Path';
  // Bevara ID/value som datakontroll för befintlig regelkod, aldrig som dold required-kontroll.
  select.classList.add('folder-choice');select.hidden=true;select.required=false;
  browse.type='button';browse.setAttribute('aria-haspopup','dialog');browse.setAttribute('aria-controls','folderTreeModal');browse.setAttribute('aria-describedby',hint.id);
  const field=(control,key,cls)=>{const label=el('label','field '+cls),title=el('span');title.dataset.i18n=key;label.append(title,control);return label;};
  select.replaceWith(wrap);wrap.append(field(account,'targetAccountLabel','folder-account'),field(browse,'targetFolderLabel','folder-select'),select,hint);
  p={wrap,account,browse,hint,root:false,disabled:false};folderPickers.set(select,p);
  account.addEventListener('change',()=>{folderPicker(select,'',{accountId:account.value});select.dispatchEvent(new Event('change',{bubbles:true}));});
  browse.addEventListener('click',()=>openFolderTree(select));
  select.addEventListener('change',()=>folderPicker(select,select.value));
 }
 Object.assign(p,{root:options.root??p.root,disabled:options.disabled??p.disabled});
 const selected=folders.find(f=>f.id===value),missing=!!value&&!selected;
 const accountId=selected?.accountId??options.accountId??(options.reset?'':p.account.value);
 selectOptions(p.account,accounts(),T('chooseAccount'),accountId);
 const choices=folders.filter(f=>f.accountId===p.account.value).map(f=>({id:f.id,label:folderPath(f)})).sort((a,b)=>a.label.localeCompare(b.label,locale(),{numeric:true}));
 selectOptions(select,choices,!p.account.value?T('targetAccountFirst'):p.root?T('newFolderRoot'):T('chooseTarget'),value);
 if(missing){const o=el('option','',T('targetMissing'));o.value=value;select.append(o);select.value=value;}
 p.account.disabled=p.disabled;select.disabled=p.disabled||!p.account.value;p.browse.disabled=select.disabled;
 p.browse.textContent=selected?selected.name+' · '+T('browseFolders'):p.root&&p.account.value?T('newFolderRoot')+' · '+T('browseFolders'):T('browseFolders');
 for(const title of p.wrap.querySelectorAll('[data-i18n]'))title.textContent=T(title.dataset.i18n);
 const accountLabel=accounts().find(a=>a.id===p.account.value)?.label||'';
 p.hint.textContent=missing?T('targetMissing'):selected?T('targetSelected')+': '+accountLabel+' · '+folderPath(selected):!p.account.value?T('targetAccountFirst'):p.root?accountLabel+' · '+T('newFolderRoot'):'';
 p.browse.title=selected?accountLabel+' · '+folderPath(selected):T('browseFolders');
 if(select.closest('#ruleForm'))updateRuleExplanation();
 return p;
}
function folderPath(f){return (f.path||f.name||'').split('/').filter(Boolean).join(' › ');}
function focusFolderPicker(select){const p=folderPickers.get(select);if(p)(p.browse.disabled?p.account:p.browse).focus();}
function openFolderTree(select){
 const p=folderPickers.get(select);if(!p||p.disabled||folderTreeSession)return;
 folderTreeSession={select,opener:p.browse,originValue:select.value,originAccount:p.account.value,ruleId:selectedId,accountId:p.account.value,pending:select.value?'folder:'+select.value:p.root&&p.account.value?'account-root':'',expanded:new Set(),active:'',root:p.root,model:null,rows:[]};
 $('folderTreeSearch').value='';
 document.querySelector('.shell').inert=true;$('folderModal').inert=true;
 $('folderTreeModal').hidden=false;renderFolderTree(true);
 // Börja vid kontot: flytt mellan konton är tillåtet men kräver ett uttryckligt val.
 $('folderTreeAccount').focus();
}
function closeFolderTree(){
 const session=folderTreeSession;if(!session)return;
 folderTreeSession=null;$('folderTreeModal').hidden=true;$('folderModal').inert=false;
 document.querySelector('.shell').inert=!$('folderModal').hidden;
 if(session.opener.isConnected&&!session.opener.disabled)session.opener.focus();
 else if(!$('folderModal').hidden)$('folderName').focus();
 else document.querySelector('.nav.active')?.focus();
 retrySenderPrefill();
}
function renderFolderTree(reveal=false){
 const s=folderTreeSession;if(!s)return;
 $('folderTreeTitle').textContent=T(s.root?'folderTreeParentTitle':'folderTreeTitle');
 const tree=$('folderTree'),query=$('folderTreeSearch').value,hadFocus=tree.contains(document.activeElement);
 selectOptions($('folderTreeAccount'),accounts(),T('chooseAccount'),s.accountId);
 if($('folderTreeAccount').value!==s.accountId){s.accountId='';s.pending='';s.active='';}
 $('folderTreeSearch').disabled=!s.accountId;$('folderTreeSearch').placeholder=T('targetSearchPlaceholder');
 s.model=LasFolderTree.build(folders,s.accountId,locale());
 if(s.root&&s.accountId){
  const root={key:'account-root',id:'',name:T('newFolderRoot'),path:'',parent:null,children:s.model.roots,selectable:true};
  for(const node of root.children)node.parent=root;
  s.model.roots=[root];s.model.nodes.set(root.key,root);
  if(reveal)s.expanded.add(root.key);
 }
 if(reveal){let node=s.model.nodes.get(s.pending)?.parent;while(node){s.expanded.add(node.key);node=node.parent;}}
 s.rows=LasFolderTree.visible(s.model,s.expanded,query);
 if(!s.rows.some(r=>r.node.key===s.active))s.active=s.rows.find(r=>r.node.key===s.pending)?.node.key||s.rows[0]?.node.key||'';
 tree.replaceChildren();tree.tabIndex=s.rows.length?-1:0;
 const sizes=new Map(),positions=new Map();for(const {node} of s.rows)sizes.set(node.parent,(sizes.get(node.parent)||0)+1);
 for(const {node,depth,open} of s.rows){
  const row=el('div','folder-tree-row'+(!node.selectable?' folder-tree-structure':''));
  row.dataset.key=node.key;row.setAttribute('role','treeitem');row.tabIndex=node.key===s.active?0:-1;row.setAttribute('aria-level',String(depth));if(node.selectable)row.setAttribute('aria-selected',String(node.key===s.pending));
  const position=(positions.get(node.parent)||0)+1;positions.set(node.parent,position);row.setAttribute('aria-posinset',String(position));row.setAttribute('aria-setsize',String(sizes.get(node.parent)));
  row.style.setProperty('--tree-depth',String(Math.min(depth-1,8)));row.title=node.path||node.name;
  const toggle=el('span','folder-tree-toggle',node.children.length?(open?'▾':'▸'):'');toggle.setAttribute('aria-hidden','true');
  if(node.children.length){row.setAttribute('aria-expanded',String(open));toggle.title=explanationText(open?'folderTreeCollapse':'folderTreeExpand',{name:node.name});}
  const name=el('span','folder-tree-name',node.name);row.append(toggle,name);
  if(!node.selectable)row.append(el('small','folder-tree-kind',T('folderTreeStructure')));
  if(query.trim())row.append(el('small','folder-tree-search-path',node.path));
  row.addEventListener('focus',()=>{s.active=node.key;for(const item of tree.children)item.tabIndex=item===row?0:-1;});
  row.addEventListener('click',event=>{
   row.focus();
   if(event.target===toggle&&node.children.length){toggleFolderTree(node.key);return;}
   if(node.selectable){s.pending=node.key;renderFolderTree();}
   else toggleFolderTree(node.key);
  });
  row.addEventListener('keydown',event=>folderTreeKey(event,node.key));tree.append(row);
 }
 const pending=s.model.nodes.get(s.pending),valid=!!s.accountId&&!!pending?.selectable;
 $('folderTreeChoose').disabled=!valid;
 const account=accounts().find(a=>a.id===s.accountId)?.label||'';
 $('folderTreePath').textContent=valid?account+' · '+(pending.path.split('/').filter(Boolean).join(' › ')||pending.name):T('folderTreeNoSelection');
 const count=[...s.model.nodes.values()].filter(n=>n.id&&LasFolderTree.matches(n,query)).length;
 $('folderTreeStatus').textContent=!s.accountId?T('targetAccountFirst'):count?explanationText('folderTreeCount',{n:count}):T('targetEmpty');
 if(hadFocus)focusTreeRow(s.active);
 else if(reveal)[...tree.children].find(n=>n.dataset.key===s.pending)?.scrollIntoView({block:'nearest'});
}
function focusTreeRow(key){
 const row=[...$('folderTree').children].find(n=>n.dataset.key===key);
 if(row){row.focus();row.scrollIntoView({block:'nearest'});}else $('folderTree').focus();
}
function toggleFolderTree(key){
 const s=folderTreeSession;if(!s||$('folderTreeSearch').value.trim())return;
 s.expanded.has(key)?s.expanded.delete(key):s.expanded.add(key);renderFolderTree();
}
function folderTreeKey(event,key){
 const s=folderTreeSession;if(!s)return;
 const i=s.rows.findIndex(r=>r.node.key===key),entry=s.rows[i];if(!entry)return;
 const {node,open}=entry;let next='';
 if(event.key==='ArrowDown')next=s.rows[Math.min(i+1,s.rows.length-1)]?.node.key;
 else if(event.key==='ArrowUp')next=s.rows[Math.max(i-1,0)]?.node.key;
 else if(event.key==='Home')next=s.rows[0]?.node.key;
 else if(event.key==='End')next=s.rows.at(-1)?.node.key;
 else if(event.key==='ArrowRight'){if(node.children.length&&!open)toggleFolderTree(key);else if(open)next=s.rows[i+1]?.node.key;}
 else if(event.key==='ArrowLeft'){if(open&&!$('folderTreeSearch').value.trim())toggleFolderTree(key);else next=node.parent?.key;}
 else if(event.key==='Enter'||event.key===' '){if(node.selectable){s.pending=key;renderFolderTree();}else toggleFolderTree(key);}
 else return;
 event.preventDefault();event.stopPropagation();if(next)focusTreeRow(next);
}
function confirmFolderTree(){
 const s=folderTreeSession;if(!s)return;
 const node=s.model.nodes.get(s.pending);
 const valid=node?.selectable&&s.select.isConnected&&s.select.value===s.originValue&&folderPickers.get(s.select)?.account.value===s.originAccount&&(!s.select.closest('#ruleForm')||selectedId===s.ruleId)&&(!s.root||!$('folderModal').hidden)&&accounts().some(a=>a.id===s.accountId)&&(node.key==='account-root'?s.root:folders.some(f=>f.id===node.id&&f.accountId===s.accountId));
 if(!valid){s.pending='';renderFolderTree();toast(T('targetMissing'),true);return;}
 const select=s.select,accountId=s.accountId,id=node.id;
 folderPicker(select,id,{accountId,reset:true});
 closeFolderTree();select.dispatchEvent(new Event('change',{bubbles:true}));
}
function targetOptions(value='',reset=false){
 folderPicker($('target'),value,{reset});
 if($('quickTarget')){
  const q=$('quickTarget'),initial=!folderPickers.has(q);
  folderPicker(q,initial?(rememberedTarget()||value||''):q.value);
 }
 for(const select of document.querySelectorAll('#branches .folder-choice'))folderPicker(select,select.value);
}
function updateMatchHelp(){if($('matchHelp'))$('matchHelp').textContent=$('match').value==='any'?T('matchAnyHelp'):T('matchAllHelp');updateRuleExplanation();}
/* Läs endast DOM-värden: även ett ofärdigt utkast ska gå att förklara utan
   validering, nya ID:n, lagring, mejlskanning eller ändrad regelkombination. */
function explanationText(key,values){return T(key).replace(/\{(\w+)\}/g,(token,name)=>values[name]??token);}
function summaryCondition(row){
 const field=row.children[0].value,op=row.children[1].value,value=row.children[2].value.trim();
 const keys={subject:'summarySubject',sender:'summarySender',domain:'summaryDomain',recipient:'summaryRecipient',cc:'summaryCc',size:'summarySize',date:'summaryDate'};
 const prefix=T(keys[field])+' '+T(OPERATOR_LABELS[op]).toLocaleLowerCase(locale());
 if(field==='date'&&(op==='beforeThisYear'||op==='afterThisYear'))return prefix;
 if(!value)return prefix+' '+T('summaryValueMissing');
 if(field==='size')return prefix+' '+value+' kB';
 if(field==='date')return prefix+' '+value+(['older','newer'].includes(op)?' '+T('summaryDays'):'');
 return prefix+' '+explanationText('summaryQuoted',{value});
}
function updateRuleExplanation(){
 const box=$('ruleSummaryBody');if(!box)return;
 const rows=[...$('conditions').children],join=T($('match').value==='any'?'conditionOr':'conditionAnd');
 rows.forEach((row,i)=>{const node=row.querySelector('.condition-join');if(node){node.hidden=i===0;node.textContent=join;}});
 const source=accounts().find(a=>a.id===$('source').value)?.label||T('summarySourceMissing');
 const target=id=>id?label(id):T('summaryTargetMissing');
 const main=el('p','rule-summary-main');
 main.append(document.createTextNode(explanationText('summaryMove',{source,target:target($('target').value)})));
 rows.forEach((row,i)=>{if(i){main.append(document.createTextNode(' '),el('strong','summary-join',join),document.createTextNode(' '));}main.append(document.createTextNode(summaryCondition(row)));});
 if(!rows.length)main.append(document.createTextNode(T('summaryValueMissing')));
 main.append(document.createTextNode('.'));
 const notes=el('div','rule-summary-notes');
 const line=text=>notes.append(el('p','',text));
 for(const [flag,key] of [[!$('enabled').checked,'summaryDisabled'],[$('ruleTrial')?.checked,'testTrial'],[state?.config.paused,'testPaused'],[state?.config.dryRun,'testDryRun'],[state?.fault,'testStopped']])if(flag)line(T(key));
 line(explanationText('summaryTiming',{mode:$('ruleReadFilter').selectedOptions[0]?.textContent||''}));
 line(explanationText('summaryUnread',{action:$('ruleUnreadAction').selectedOptions[0]?.textContent||''}));
 if(!$('ruleOpenTiming').disabled)line(explanationText('summaryOpenTiming',{timing:$('ruleOpenTiming').selectedOptions[0]?.textContent||''}));
 if($('ruleYearFolders').checked)line(T('summaryYear'));
 if($('branches').children.length){
  line(T('summaryBranches'));
  const list=el('ol');
  for(const row of $('branches').children)list.append(el('li','',explanationText('summaryBranch',{condition:summaryCondition(row),target:target(row.querySelector('.folder-choice').value)})));
  notes.append(list);
 }
 // Lämna samma DOM orörd vid oförändrad status (skärmläsare och textmarkering).
 const signature=JSON.stringify([main.textContent,notes.textContent,currentLang]);
 if(box.dataset.signature===signature)return;
 box.dataset.signature=signature;box.replaceChildren(main,notes);
}
/* Villkorsfält: text, mottagare, storlek i kB och datum (dagar eller årtal). */
const CONDITION_FIELDS=[['domain','optDomain'],['sender','optSender'],['subject','optSubject'],['recipient','optRecipient'],['cc','optCc'],['size','optSize'],['date','optDate']];
const OPERATOR_LABELS={equals:'opEquals',contains:'opContains',starts:'opStarts',ends:'opEnds',larger:'opLarger',smaller:'opSmaller',older:'opOlder',newer:'opNewer',before:'opBeforeYear',after:'opAfterYear',beforeThisYear:'opBeforeThisYear',afterThisYear:'opAfterThisYear'};
const isNumericField=field=>field==='size'||field==='date';
function condPlaceholderFor(field){
 if(field==='size')return T('condPlaceholderSize');
 if(field==='date')return T('condPlaceholderDate');
 if(field==='recipient')return T('condPlaceholderRecipient');
 if(field==='cc')return T('condPlaceholderCc');
 return T('condPlaceholder');
}
function fillFieldSelect(select,value){
 select.replaceChildren();
 for(const [v,key] of CONDITION_FIELDS){const o=el('option','',T(key));o.value=v;select.append(o);}
 select.value=CONDITION_FIELDS.some(([v])=>v===value)?value:CONDITION_FIELDS[0][0];
}
function fillOpSelect(select,field,value){
 const ops=(C.FIELD_OPS&&C.FIELD_OPS[field])||['equals'];
 select.replaceChildren();
 for(const v of ops){const o=el('option','',T(OPERATOR_LABELS[v]||v));o.value=v;select.append(o);}
 select.value=ops.includes(value)?value:ops[0];
}
function syncConditionInput(input,field,op,value){
 if(field==='date'&&(op==='beforeThisYear'||op==='afterThisYear')){
  input.type='text';input.removeAttribute('maxlength');input.removeAttribute('min');input.removeAttribute('max');input.removeAttribute('step');
  input.placeholder=T('condPlaceholderThisYear');input.value='';input.disabled=true;input.required=false;
  return;
 }
 input.disabled=false;input.required=true;
 if(isNumericField(field)){
  input.type='number';input.removeAttribute('maxlength');
  if(field==='size'){input.min='1';input.max='1048576';}
  else if(op==='older'||op==='newer'){input.min='1';input.max='36500';}
  else{input.min='1970';input.max='9999';}
  input.step='1';
 }else{
  input.type='text';input.maxLength=256;
  input.removeAttribute('min');input.removeAttribute('max');input.removeAttribute('step');
 }
 input.placeholder=condPlaceholderFor(field);
 if(value!==undefined&&input.value!==value)input.value=value;
}
function addBranchRow(b={condition:{field:'subject',op:'contains',value:''},target:''}){
 if($('branches').children.length>=8){toast(T('maxBranches'));return;}
 const row=el('div','branch-row'),field=el('select'),op=el('select'),value=el('input'),target=el('select'),remove=el('button','remove-condition','×');
 a11y(field,'ariaBranchField');a11y(op,'ariaBranchOp');a11y(value,'ariaBranchValue');value.required=true;a11y(target,'ariaBranchTarget');remove.type='button';a11y(remove,'ariaBranchRemove','title');a11y(remove,'ariaBranchRemove');
 fillFieldSelect(field,b.condition.field);fillOpSelect(op,b.condition.field,b.condition.op);
 syncConditionInput(value,b.condition.field,op.value,String(b.condition.value??''));
 selectOptions(target,folders,T('chooseTarget'),b.target);
 field.addEventListener('change',()=>{fillOpSelect(op,field.value,'');syncConditionInput(value,field.value,op.value,'');dirty=true;});
 op.addEventListener('change',()=>{syncConditionInput(value,field.value,op.value,value.value);dirty=true;});
 remove.addEventListener('click',()=>{row.remove();dirty=true;updateRuleExplanation();});
 row.append(field,op,value,target,remove);$('branches').append(row);folderPicker(target,b.target);updateRuleExplanation();
}
function addCondition(c={field:'domain',op:'equals',value:''}){
 if($('conditions').children.length>=8){toast(T('maxConditions'));return;}
 const row=el('div','condition-row'),field=el('select'),op=el('select'),value=el('input'),remove=el('button','remove-condition','×');
 a11y(field,'ariaConditionField');a11y(op,'ariaConditionOp');a11y(value,'ariaConditionValue');value.required=true;remove.type='button';a11y(remove,'ariaConditionRemove','title');a11y(remove,'ariaConditionRemove');
 fillFieldSelect(field,c.field);fillOpSelect(op,c.field,c.op);
 syncConditionInput(value,c.field,op.value,String(c.value??''));
 field.addEventListener('change',()=>{fillOpSelect(op,field.value,'');syncConditionInput(value,field.value,op.value,'');dirty=true;});
 op.addEventListener('change',()=>{syncConditionInput(value,field.value,op.value,value.value);dirty=true;});
 remove.addEventListener('click',()=>{if($('conditions').children.length===1){toast(T('minConditions'));return;}row.remove();dirty=true;updateRuleExplanation();});
 const join=el('span','condition-join');join.setAttribute('aria-hidden','true');
 row.append(field,op,value,remove,join);$('conditions').append(row);updateRuleExplanation();
}
function draft(){const accountId=$('source').value,old=state.config.rules.find(r=>r.id===selectedId),anchor=(old?.sourceAccount===accountId&&folders.some(f=>f.id===old.source)?old.source:folders.find(f=>f.accountId===accountId)?.id)||'';return C.validateRule({id:selectedId||crypto.randomUUID(),name:$('ruleName').value,enabled:$('enabled').checked,source:anchor,sourceAccount:accountId,scope:'account',target:$('target').value,match:$('match').value,readFilter:$('ruleReadFilter')?.value||'default',unreadAction:$('ruleUnreadAction')?.value||'default',openTiming:$('ruleOpenTiming').value,yearFolders:$('ruleYearFolders')?.checked===true,
  trialUntil:$('ruleTrial')?.checked===true?(old?.trialUntil&&old.trialUntil>Date.now()?old.trialUntil:Date.now()+C.LIMITS.trialDays*86400000):0,
 conditions:[...$('conditions').children].map(row=>({field:row.children[0].value,op:row.children[1].value,value:row.children[2].value})),
 branches:[...$('branches').children].map(row=>({condition:{field:row.children[0].value,op:row.children[1].value,value:row.children[2].value},target:row.querySelector('.folder-choice').value}))});}
/* Enkel regel-export använder samma validerade utkast som sparningen. */
const buildRule=()=>draft();
function loadRule(id='',presetAccount='',{openEditor=true}={}){
 const rule=state.config.rules.find(r=>r.id===id);selectedId=rule?.id||'';
 $('editorTitle').textContent=rule?T('editorEdit'):T('editorNew');$('ruleName').value=rule?.name||'';$('enabled').checked=rule?.enabled??true;
 $('match').value=rule?.match||'any';
 if($('ruleReadFilter'))$('ruleReadFilter').value=rule?.readFilter||'default';
 if($('ruleUnreadAction'))$('ruleUnreadAction').value=rule?.unreadAction||'default';
 $('ruleOpenTiming').value=rule?(rule.openTiming||'after'):'before';
 if($('ruleYearFolders'))$('ruleYearFolders').checked=rule?.yearFolders===true;
 setTrialFields(rule);
 updateReadPolicy();
 const ruleAccount=rule?(rule.sourceAccount||folders.find(f=>f.id===rule.source)?.accountId||''):(presetAccount||accounts()[0]?.id||'');
 accountOptions(ruleAccount);targetOptions(rule?.target||'',true);updateMatchHelp();
 $('conditions').replaceChildren();for(const c of rule?.conditions||[{field:'domain',op:'equals',value:''}])addCondition(c);
 $('branches').replaceChildren();for(const b of rule?.branches||[])addBranchRow(b);
 $('testResult').hidden=true;$('delete').disabled=!rule;
 if($('duplicate'))$('duplicate').disabled=!rule&&!$('ruleName').value.trim();
 const i=state.config.rules.findIndex(r=>r.id===selectedId);$('up').disabled=i<=0;$('down').disabled=i<0||i>=state.config.rules.length-1;
 updateRuleExplanation();
 dirty=false;editRevision=state.config.revision;editToken=currentToken();renderRules();
 rpc('prefs',{prefs:{lastRule:selectedId}}).catch(()=>{});
 if(openEditor)openRuleEditor();
}
const logKey=log=>log.time+'|'+log.event+'|'+(log.data?.count||0)+'|'+(log.data?.detail||'');
function logRow(log){
 const tr=el('tr');
 tr.append(el('td','numeric-value',new Date(log.time).toLocaleString(locale())));
 const eventCell=el('td','',Tevent(log.event));
 if(log.data.detail)eventCell.append(el('span','technical-value',' – '+log.data.detail));
 tr.append(eventCell,el('td','technical-value',log.level),el('td','numeric-value',log.data.count));
 return tr;
}
function renderActivity(){
 const body=$('logRows');if(!body)return;
 const logs=state.logs||[];
 const keys=logs.map(logKey).reverse();
 /* Kommer det bara nya rader i toppen? Då läggs de till i stället för att hela
    tabellen byggs om: raderna behåller sin plats och scrollen hoppar inte. */
 const added=keys.length-logShown.length;
 if(logShown.length&&added>0&&keys.slice(added).every((k,i)=>k===logShown[i])){
  const height=body.scrollHeight;
  const first=body.firstChild;
  const frag=document.createDocumentFragment();
  for(let i=0;i<added;i++)frag.append(logRow(logs[logs.length-1-i]));
  body.insertBefore(frag,first||null);
  logShown.push(...keys.slice(0,added));
  if(body.scrollTop>0)body.scrollTop+=body.scrollHeight-height;
  return;
 }
 body.replaceChildren();
 const frag=document.createDocumentFragment();
 for(let i=logs.length-1;i>=0;i--)frag.append(logRow(logs[i]));
 if(!logs.length){const tr=el('tr'),td=el('td','',T('noLogsYet'));td.colSpan=4;tr.append(td);frag.append(tr);}
 body.append(frag);
 logShown.length=0;logShown.push(...keys);
}
function renderBackups(){
 if(unchanged('backups',JSON.stringify([state.backups,state.blocked,state.inflight,currentLang])))return;
 $('backupList').replaceChildren();for(const b of state.backups){const row=el('div','backup');row.append(el('span','',new Date(b.time).toLocaleString(locale())+' · '+b.count+T('rulesCountSuffix')));const btn=el('button','text-button',T('restoreBtn'));btn.addEventListener('click',async()=>{if(!confirm(T('confirmRestore')))return;try{const s=await rpc('restoreBackup',{index:b.index,revision:state.config.revision});dirty=false;renderStatus(s);loadRule();toast(T('toastRestored'));}catch(e){alertError(e);}});row.append(btn);$('backupList').append(row);}
 if(!state.backups.length)$('backupList').append(el('p','muted',T('backupHint')));
 $('blockedInfo').textContent=state.blocked?state.blocked+T('blockedSome'):T('blockedNone');
 $('clearBlocked').disabled=!state.blocked||!!state.inflight;
}
async function download(data,filename,mime='application/json',strict=false){
 const body=typeof data==='string'?data:JSON.stringify(data,null,2);
 const url=URL.createObjectURL(new Blob([body],{type:mime}));
 try{
  /* saveAs:false tillsammans med en sökväg under appmappen: filen hamnar alltid i
     Hämtade filer/Lasfilter/... i stället för att fråga varje gång. */
  if(live&&!DEMO&&browser.downloads?.download)await browser.downloads.download({url,filename,saveAs:false,conflictAction:'overwrite'});
  else{const a=el('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();}
 }catch(err){
  if(strict)throw new C.RuleError('internal_error');
  if(!String(err?.message||err||'').toLowerCase().includes('cancel')){
   const a=el('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();
  }
 }finally{setTimeout(()=>URL.revokeObjectURL(url),60000);}
}
/* Explicit manual copy: always use the picker, never fall back to a silent
   download in another folder. An accepted download ID is a start, not a promise
   that the transfer is complete. No selected absolute path is kept by SortBro. */
async function saveLogTextAs(text,filename){
 const downloads=globalThis.browser?.downloads;
 if(typeof downloads?.download!=='function')throw new C.RuleError('log_save_unavailable');
 const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));
 try{
  const id=await downloads.download({url,filename,saveAs:true,conflictAction:'uniquify'});
  return Number.isSafeInteger(id)&&id>=0;
 }catch(err){
  if(/\bcancel(?:led|ed)?\b|NS_ERROR_ABORT/i.test(String(err?.message||err||'')))return false;
  throw new C.RuleError('log_save_failed');
 }finally{setTimeout(()=>URL.revokeObjectURL(url),60000);}
}
let rulePanel='list',editorVisited=false;
function showView(view){
 if(!$('view-'+view))return;
 const changed=activeView!==view;activeView=view;
 document.querySelectorAll('.view').forEach(n=>n.hidden=n.id!=='view-'+view);
 document.querySelectorAll('.nav').forEach(n=>{const active=n.dataset.view===view;n.classList.toggle('active',active);n.setAttribute('aria-selected',String(active));n.tabIndex=active?0:-1;});
 if(changed){closeRuleMenus();document.documentElement.scrollTop=0;}
}
function setRulePanel(panel){
 rulePanel=panel==='editor'?'editor':'list';
 if(rulePanel==='editor')editorVisited=true;
 $('rulesLibrary').hidden=rulePanel==='editor';$('ruleEditor').hidden=rulePanel!=='editor';
 $('resumeEditor').hidden=!editorVisited;
 const help=$('view-rules').querySelector('.view-heading p');
 help.dataset.i18n=rulePanel==='editor'?'ruleEditorPageHelp':'rulesPageHelp';help.textContent=T(help.dataset.i18n);
}
function openRuleEditor(){
 const opening=$('ruleEditor').hidden||$('view-rules').hidden;
 setRulePanel('editor');showView('rules');
 if(opening)$('ruleName').focus();
}
handle('backToRules','click',()=>{setRulePanel('list');$('resumeEditor').focus();});
handle('resumeEditor','click',()=>{openRuleEditor();$('ruleName').focus();});
for(const tab of document.querySelectorAll('.app-tabs [role="tab"]'))tab.addEventListener('keydown',event=>{
 const tabs=[...document.querySelectorAll('.app-tabs [role="tab"]')],i=tabs.indexOf(tab);let next;
 if(event.key==='ArrowRight')next=tabs[(i+1)%tabs.length];
 else if(event.key==='ArrowLeft')next=tabs[(i+tabs.length-1)%tabs.length];
 else if(event.key==='Home')next=tabs[0];else if(event.key==='End')next=tabs.at(-1);else return;
 event.preventDefault();showView(next.dataset.view);next.focus();
});
for(const nav of document.querySelectorAll('[data-view]'))nav.addEventListener('click',()=>showView(nav.dataset.view));
handle('footerSupportBtn','click',()=>showView('support'));

/* ===== Stöd / Donation (100 % lokal, ISO/IEC 18004-verifierad Swish-QR + PayPal + Ko-fi) ===== */
let donateKr=50,qrMode='swish';
function makeQrSvg(text){
 const bytes=Array.from(new TextEncoder().encode(text));
 const VERSIONS_M=[null,[1,16,10,1,16,0,0,[]],[2,28,16,1,28,0,0,[6,18]],[3,44,26,1,44,0,0,[6,22]],[4,64,18,2,32,0,0,[6,26]]];
 const VERSIONS_L=[null,[1,19,7,1,19,0,0,[]],[2,34,10,1,34,0,0,[6,18]],[3,55,15,1,55,0,0,[6,22]],[4,80,20,1,80,0,0,[6,26]],[5,108,26,1,108,0,0,[6,30]],[6,136,18,2,68,0,0,[6,34]],[7,156,20,2,78,0,0,[6,22,38]],[8,194,24,2,97,0,0,[6,24,42]],[9,232,30,2,116,0,0,[6,26,46]],[10,274,18,2,68,2,69,[6,28,50]]];
 const useM=bytes.length<=62,table=useM?VERSIONS_M:VERSIONS_L,fmt=useM?0x5e7c:0x7daa;
 const ver=table.find(v=>v&&(v[1]-(v[0]<=9?2:3))>=bytes.length)||table[table.length-1];
 const [V,totalData,ecLen,b1,d1,b2,d2,align]=ver,size=17+V*4,bits=[];
 const pushBits=(val,n)=>{for(let i=n-1;i>=0;i--)bits.push((val>>>i)&1);};
 pushBits(4,4);pushBits(bytes.length,V<=9?8:16);for(const b of bytes)pushBits(b,8);
 pushBits(0,Math.min(4,totalData*8-bits.length));while(bits.length%8)bits.push(0);
 const data=[];for(let i=0;i<bits.length;i+=8){let b=0;for(let j=0;j<8;j++)b=(b<<1)|bits[i+j];data.push(b);}
 for(let p=0;data.length<totalData;p++)data.push((p&1)?0x11:0xec);
 const EXP=new Uint8Array(512),LOG=new Uint8Array(256);let x=1;
 for(let i=0;i<255;i++){EXP[i]=x;LOG[x]=i;x=(x<<1)^(x&128?0x11d:0);}for(let i=255;i<512;i++)EXP[i]=EXP[i-255];
 const mul=(a,b)=>(a&&b)?EXP[LOG[a]+LOG[b]]:0;
 let gen=[1];for(let i=0;i<ecLen;i++){const next=new Array(gen.length+1).fill(0);for(let j=0;j<gen.length;j++){next[j]^=gen[j];next[j+1]^=mul(gen[j],EXP[i]);}gen=next;}
 const rsEncode=block=>{const rem=new Uint8Array(ecLen);for(const b of block){const f=b^rem[0];rem.copyWithin(0,1);rem[ecLen-1]=0;for(let j=0;j<ecLen;j++)rem[j]^=mul(gen[j+1],f);}return rem;};
 const dataBlocks=[],ecBlocks=[];let offset=0;
 for(let i=0;i<b1+b2;i++){const len=i<b1?d1:d2,blk=data.slice(offset,offset+len);offset+=len;dataBlocks.push(blk);ecBlocks.push(rsEncode(blk));}
 const codewords=[],maxD=Math.max(d1,d2);
 for(let i=0;i<maxD;i++)for(const blk of dataBlocks)if(i<blk.length)codewords.push(blk[i]);
 for(let i=0;i<ecLen;i++)for(const blk of ecBlocks)codewords.push(blk[i]);
 const grid=Array.from({length:size},()=>new Int8Array(size)),used=Array.from({length:size},()=>new Uint8Array(size));
 const setMod=(r,c,v)=>{if(r>=0&&r<size&&c>=0&&c<size){grid[r][c]=v?1:0;used[r][c]=1;}};
 const finder=(r0,c0)=>{for(let dr=-1;dr<=7;dr++)for(let dc=-1;dc<=7;dc++)setMod(r0+dr,c0+dc,dr>=0&&dr<=6&&dc>=0&&dc<=6&&(dr===0||dr===6||dc===0||dc===6||(dr>=2&&dr<=4&&dc>=2&&dc<=4)));};
 finder(0,0);finder(0,size-7);finder(size-7,0);
 for(const r of align)for(const c of align){if(used[r][c])continue;for(let dr=-2;dr<=2;dr++)for(let dc=-2;dc<=2;dc++)setMod(r+dr,c+dc,Math.max(Math.abs(dr),Math.abs(dc))!==1);}
 for(let i=8;i<size-8;i++){if(!used[6][i])setMod(6,i,i%2===0);if(!used[i][6])setMod(i,6,i%2===0);}
 for(let i=0;i<9;i++){used[8][i]=1;used[i][8]=1;}for(let i=0;i<8;i++){used[8][size-1-i]=1;used[size-1-i][8]=1;}setMod(size-8,8,1);
 if(V>=7){let rem=V;for(let i=0;i<12;i++)rem=(rem<<1)^((rem>>11)*0x1f25);const vInfo=(V<<12)|rem;for(let i=0;i<18;i++){const bit=(vInfo>>i)&1,r=Math.floor(i/3),c=size-11+(i%3);setMod(r,c,bit);setMod(c,r,bit);}}
 let bitIdx=0,up=true;
 for(let c=size-1;c>0;c-=2){if(c===6)c--;for(let i=0;i<size;i++){const r=up?size-1-i:i;for(const dc of [0,-1])if(!used[r][c+dc]){const bit=bitIdx<codewords.length*8?(codewords[bitIdx>>3]>>(7-(bitIdx&7)))&1:0;bitIdx++;grid[r][c+dc]=bit^((c+dc)%3===0?1:0);}}up=!up;}
 const fPos1=[[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,7],[8,8],[7,8],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8]],fPos2=[[size-1,8],[size-2,8],[size-3,8],[size-4,8],[size-5,8],[size-6,8],[size-7,8],[8,size-8],[8,size-7],[8,size-6],[8,size-5],[8,size-4],[8,size-3],[8,size-2],[8,size-1]];
 for(let i=0;i<15;i++){const bit=(fmt>>(14-i))&1;grid[fPos1[i][0]][fPos1[i][1]]=bit;grid[fPos2[i][0]][fPos2[i][1]]=bit;}
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
 svg.setAttribute('viewBox',`0 0 ${size+8} ${size+8}`);svg.setAttribute('width','220');svg.setAttribute('height','220');svg.setAttribute('shape-rendering','crispEdges');
 const rect=document.createElementNS('http://www.w3.org/2000/svg','rect');
 rect.setAttribute('width','100%');rect.setAttribute('height','100%');rect.setAttribute('fill','#ffffff');
 let d='';for(let r=0;r<size;r++)for(let c=0;c<size;c++)if(grid[r][c])d+=`M${c+4},${r+4}h1v1h-1z`;
 const path=document.createElementNS('http://www.w3.org/2000/svg','path');
 path.setAttribute('d',d);path.setAttribute('fill','#000000');
 svg.append(rect,path);return svg;
}
function currentSwishQrPayload(){
 if(qrMode==='cam'){
  const data=JSON.stringify({version:1,payee:{value:'0721817177',editable:false},amount:{value:donateKr,editable:true},message:{value:'SortBro',editable:true}});
  return 'swish://payment?data='+encodeURIComponent(data);
 }
 return `C0721817177;${donateKr};SortBro;6`;
}
function updateDonationView(){
 if($('donateAmountInfo'))$('donateAmountInfo').textContent=currentLang==='en'?`Selected: ${donateKr} SEK – thank you for supporting SortBro! 💚`:`Valt: ${donateKr} kr – tack för att du stöttar SortBro! 💚`;
 const pp=`https://paypal.me/Rickard3dPrint/${donateKr}SEK`;
 if($('paypalBtnHero'))$('paypalBtnHero').href=pp;
 if($('paypalBtnMain'))$('paypalBtnMain').href=pp;
 if($('qrModeSwish'))$('qrModeSwish').classList.toggle('active',qrMode==='swish');
 if($('qrModeCam'))$('qrModeCam').classList.toggle('active',qrMode==='cam');
 if($('supQrSubText'))$('supQrSubText').textContent=qrMode==='cam'?T('supQrSubCam'):T('supQrSub');
 if($('qrbox')&&!$('qrbox').hidden&&$('qrSvgWrap')){
  $('qrSvgWrap').replaceChildren(makeQrSvg(currentSwishQrPayload()));
 }
}
for(const chip of document.querySelectorAll('#beloppsrad .bchip')){
 chip.addEventListener('click',()=>{
  for(const c of document.querySelectorAll('#beloppsrad .bchip'))c.classList.remove('vald');
  chip.classList.add('vald');
  if($('donateCustomKr'))$('donateCustomKr').value='';
  donateKr=parseInt(chip.dataset.kr,10)||50;
  updateDonationView();
 });
}
if($('donateCustomKr')){
 $('donateCustomKr').addEventListener('input',e=>{
  const v=parseInt(e.target.value,10);
  if(v>0&&v<100000){
   for(const c of document.querySelectorAll('#beloppsrad .bchip'))c.classList.remove('vald');
   donateKr=v;updateDonationView();
  }
 });
}
function showSwishQr(){
 if(!$('qrbox')||!$('qrSvgWrap'))return;
 $('qrbox').hidden=false;
 updateDonationView();
 $('qrbox').scrollIntoView({behavior:'smooth',block:'center'});
}
handle('swishBtnHero','click',showSwishQr);
handle('swishBtnMain','click',showSwishQr);
if($('qrModeSwish'))handle('qrModeSwish','click',()=>{qrMode='swish';updateDonationView();});
if($('qrModeCam'))handle('qrModeCam','click',()=>{qrMode='cam';updateDonationView();});
$('ruleForm').addEventListener('input',()=>{updateRuleExplanation();dirty=true;if($('duplicate'))$('duplicate').disabled=false;});
$('ruleForm').addEventListener('change',e=>{
 dirty=true;if($('duplicate'))$('duplicate').disabled=false;
 if(e.target?.id!=='ruleMoveUnread'&&e.target?.id!=='ruleOpenWindow')updateReadPolicy();
 updateRuleExplanation();
});
handle('newRule','click',()=>{if(!dirty||confirm(T('confirmDiscard')))loadRule('',$('source').value);});
handle('ruleSearch','input',renderRules);
handle('source','change',()=>{dirty=true;});
handle('ruleMoveUnread','change',()=>{
 if($('ruleReadFilter'))$('ruleReadFilter').value=$('ruleMoveUnread').checked?'both':'read';
 dirty=true;updateReadPolicy();
});
handle('ruleOpenWindow','change',()=>{
 if($('ruleUnreadAction'))$('ruleUnreadAction').value=$('ruleOpenWindow').checked?'window':'keep';
 dirty=true;updateReadPolicy();
});
handle('ruleReadFilter','change',()=>{dirty=true;updateReadPolicy();});
handle('ruleUnreadAction','change',()=>{dirty=true;updateReadPolicy();});
handle('ruleOpenTiming','change',()=>{dirty=true;updateRuleExplanation();});
handle('addCondition','click',()=>{addCondition({field:'subject',op:'contains',value:''});dirty=true;});
/* ＋ Importera domäner/adresser: en lista blir flera villkor i regeln som redigeras. */
function importIntoEditor(){
 const box=$('importValues');
 const text=box?.value||'';
 const parsed=C.parseImportList(text,{limit:8,field:['auto','domain','sender','subject'].includes($('importField')?.value||'auto')?($('importField')?.value||'auto'):'auto'});
 const result=$('importResult');
 if(!parsed.conditions.length){
  if(result){result.hidden=false;result.textContent=T('importNone');}
  toast(T('importNone'));
  return null;
 }
 const rows=[...$('conditions').children];
 const existing=rows.map(row=>({field:row.children[0].value,op:row.children[1].value,value:row.children[2].value}));
 const merged=C.mergeConditions(existing,parsed.conditions,{limit:8});
 if(!merged.added.length){
  const skipped=merged.skipped+parsed.skipped;
  const text=T('importNone')+(skipped?T('importSkipped').replace('{n}',skipped):'');
  if(result){result.hidden=false;result.textContent=text;}
  if(box)box.value='';
  toast(text);
  return merged;
 }
 for(const cond of merged.added)addCondition(cond);
 if(merged.added.length&&merged.suggestedMatch==='any'&&($('match').value==='all'))$('match').value='any';updateMatchHelp();
 if(merged.added.length)dirty=true;
 const parts=[T(merged.added.length&&merged.suggestedMatch==='any'?'importAddedAny':'importAdded').replace('{n}',merged.added.length)];
 const skipped=merged.skipped+parsed.skipped;
 if(skipped)parts.push(T('importSkipped').replace('{n}',skipped));
 parts.push(T('importSaveHint'));
 if(result){result.hidden=false;result.textContent=parts.join('');}
 if(box)box.value='';
 toast(parts.join(''));
 return merged;
}
if($('importBtn'))handle('importBtn','click',()=>{if(!selectedId&&!$('conditions').children.length){toast(T('importNoRule'));return;}importIntoEditor();});
if($('importValues'))$('importValues').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('importBtn')?.click();}});
handle('addBranch','click',()=>{addBranchRow();dirty=true;});

async function saveCurrentRule({openNewAfter=false,forceNew=false}={}){
 const oldSelected=selectedId;
 if(forceNew&&selectedId){
  const existing=state.config.rules.find(r=>r.id===selectedId);
  selectedId='';
  if(existing&&$('ruleName').value.trim()===existing.name){
   const firstVal=$('conditions')?.children?.[0]?.children?.[2]?.value?.trim();
   $('ruleName').value=(firstVal?T('defaultRulePrefix')+firstVal:existing.name+T('copySuffix')).slice(0,100);
  }
 }
 let rule;
 try{
  rule=draft();
 }catch(err){
  selectedId=oldSelected;
  throw err;
 }
 const keptAccount=$('source').value;
 $('save').disabled=true;if($('saveAndNew'))$('saveAndNew').disabled=true;if($('saveAsNew'))$('saveAsNew').disabled=true;
 try{
  const rules=[...state.config.rules],i=rules.findIndex(r=>r.id===rule.id);
  if(i<0)rules.push(rule);else rules[i]=rule;
  const next=await rpc('saveRules',{rules,revision:editRevision});
  dirty=false;renderStatus(next);
  if(openNewAfter){
   loadRule('',keptAccount);
   $('ruleName').focus();
   toast(T('toastSavedAndNew'));
  }else{
   loadRule(rule.id);
   toast(T('toastRuleSaved'));
  }
 }finally{
  $('save').disabled=false;if($('saveAndNew'))$('saveAndNew').disabled=false;if($('saveAsNew'))$('saveAsNew').disabled=false;
 }
}

handle('ruleForm','submit',async e=>{e.preventDefault();await saveCurrentRule({openNewAfter:false});});
handle('saveAndNew','click',async()=>{await saveCurrentRule({openNewAfter:true});});
if($('saveAsNew'))handle('saveAsNew','click',async()=>{await saveCurrentRule({openNewAfter:false,forceNew:true});});
handle('duplicate','click',()=>{
 selectedId='';
 $('editorTitle').textContent=T('editorNew');
 const baseName=$('ruleName').value.trim();
 $('ruleName').value=(baseName?baseName+T('copySuffix'):'').slice(0,100);
 $('delete').disabled=true;$('up').disabled=true;$('down').disabled=true;
 dirty=true;renderRules();$('ruleName').focus();
 toast(T('toastDuplicated'));
});

async function fetchSelectedIntoEditor({forceNew=false}={}){
 const m=await rpc('selected');if(!folders.some(f=>f.accountId===m.sourceAccount))throw new C.RuleError('unsafe_folder');
 const existing=selectedId?state.config.rules.find(r=>r.id===selectedId):null;
 const existingVal=C.norm(existing?.conditions?.[0]?.value).trim();
 const incomingVal=C.norm(m.domain||m.email||m.subject).trim();
 if(forceNew||(existing&&existingVal&&incomingVal&&existingVal!==incomingVal)){
  loadRule('',m.sourceAccount);
 }
 $('source').value=m.sourceAccount;targetOptions($('target').value);
 const row=$('conditions').children[0],field=row.children[0].value;
 row.children[2].value=field==='domain'?m.domain:field==='sender'?m.email:m.subject.slice(0,256);
 if(!$('ruleName').value)$('ruleName').value=(T('defaultRulePrefix')+(m.domain||m.email||T('defaultSenderFallback'))).slice(0,100);
 dirty=true;updateRuleExplanation();focusFolderPicker($('target'));toast(T('toastFromSelected'));
}
handle('fromSelected','click',async()=>fetchSelectedIntoEditor({forceNew:false}));
if($('newFromSelected'))handle('newFromSelected','click',async()=>fetchSelectedIntoEditor({forceNew:true}));

if($('quickFetchBtn'))handle('quickFetchBtn','click',async()=>{
 const m=await rpc('selected');
 const field=$('quickField')?.value||'domain';
 if($('quickValue'))$('quickValue').value=field==='domain'?(m.domain||m.email||''):field==='sender'?(m.email||m.author||''):(m.subject||'').slice(0,256);
 if($('quickTarget')&&!$('quickTarget').value){
  folderPicker($('quickTarget'),'',{accountId:m.sourceAccount||''});
 }
 focusFolderPicker($('quickTarget'));
 toast(T('toastFromSelected'));
});

/* ===== ⚡ Snabbregel: klickbara förslag, live-räkning och ett klick till färdig regel ===== */
let quickHints=null,quickHintsAt=0,quickHintsLoading=false,quickHintsTried=false,quickPreviewTimer=null,quickPreviewSeq=0;
/* Åtta avsändare syns direkt; resten ligger bakom "visa fler". ✕ döljer ett förslag för stunden. */
const QUICK_HINTS_VISIBLE={sender:8,word:6};
const quickHintsExpanded={sender:false,word:false};
const quickHintsHidden=new Set();

function quickWords(cond){
 if(!cond)return '';
 const v=String(cond.value||'');
 if(cond.field==='domain')return T('quickWhatDomain').replace('{v}',v);
 if(cond.field==='subject')return T('quickWhatSubject').replace('{v}',v);
 return T(cond.op==='equals'?'quickWhatSenderExact':'quickWhatSender').replace('{v}',v);
}
function quickTargetLabel(){
 const id=$('quickTarget')?.value||'';
 return id?(folders.find(f=>f.id===id)?.name||label(id)):'';
}
/* Snabbregeln minns målmappen du använde sist – men bara om den finns kvar. */
function rememberedTarget(){
 const id=state?.prefs?.lastTarget||'';
 return id&&folders.some(f=>f.id===id)?id:'';
}
function rememberQuickTarget(id){
 if(!id||!folders.some(f=>f.id===id))return;
 state.prefs={...(state.prefs||{}),lastTarget:id};
 rpc('prefs',{prefs:{lastTarget:id}}).catch(()=>{});
}
/* Förslag på mappnamn ur det man skrev: klarna.se -> Klarna, wordpress@limoeurope.com -> Limoeurope. */
function quickFolderSuggestion(){
 const raw=($('quickValue')?.value||'').trim();
 if(!raw)return '';
 const word=(raw.includes('@')?raw.split('@')[1]||'':raw);
 const first=word.split(/[.\-_/\s]+/).filter(Boolean)[0]||word;
 const clean=first.replace(/[^A-Za-zÅÄÖåäö0-9]/g,'');
 if(!clean)return '';
 return (clean.charAt(0).toLocaleUpperCase('sv-SE')+clean.slice(1)).slice(0,64);
}
function quickHintValue(kind,it){return kind==='word'?(it.word||''):(it.domain||'');}
function renderQuickHints(){
 const box=$('quickChips');if(!box)return;
 box.replaceChildren();
 if(!quickHints)return;
 const senders=quickHints.senders||[],words=quickHints.words||[];
 if(!senders.length&&!words.length){box.append(el('p','quick-hint-empty',T('quickHintsEmpty')));return;}
 const group=(title,items,kind)=>{
  const all=items.filter(it=>{const value=quickHintValue(kind,it);return value&&!quickHintsHidden.has(kind+':'+value);});
  if(!all.length)return null;
  const expanded=quickHintsExpanded[kind]===true;
  const shown=expanded?all:all.slice(0,QUICK_HINTS_VISIBLE[kind]);
  const wrap=el('div','quick-chip-group');
  wrap.append(el('span','quick-chip-title',title));
  const row=el('div','quick-chip-row');
  for(const it of shown){
   const value=quickHintValue(kind,it);
   const item=el('span','quick-chip-item');
   const chip=el('button','quick-chip',value);chip.type='button';
   /* Ledtråd: vanligaste adressen bakom domänen och den senaste ämnesraden. */
   const tip=[];
   if(it.sender)tip.push(T('quickChipTipSender').replace('{a}',it.sender));
   if(it.subject)tip.push(T('quickChipTipSubject').replace('{s}',it.subject));
   if(tip.length)chip.title=tip.join(' · ');
   chip.append(el('span','quick-chip-count',String(it.count||0)));
   chip.addEventListener('click',()=>{
    if($('quickField'))$('quickField').value=kind==='word'?'subject':'domain';
    if($('quickValue'))$('quickValue').value=value;
    updateQuickPreview().catch(()=>{});
    focusFolderPicker($('quickTarget'));
   });
   const hide=el('button','quick-chip-hide','✕');hide.type='button';
   hide.title=T('quickChipHide');hide.setAttribute('aria-label',T('quickChipHide'));
   hide.addEventListener('click',()=>{quickHintsHidden.add(kind+':'+value);renderQuickHints();});
   item.append(chip,hide);
   row.append(item);
  }
  if(all.length>QUICK_HINTS_VISIBLE[kind]){
   const more=el('button','quick-chip-more',expanded?T('quickHintsShowLess'):T('quickHintsMore').replace('{n}',all.length-shown.length));
   more.type='button';
   more.addEventListener('click',()=>{quickHintsExpanded[kind]=!expanded;renderQuickHints();});
   row.append(more);
  }
  if(row.children.length)wrap.append(row);
  return wrap;
 };
 const s=group(T('quickHintsSenders'),senders,'sender');
 const w=group(T('quickHintsWords'),words,'word');
 if(s)box.append(s);
 if(w)box.append(w);
 if(quickHintsHidden.size){
  const again=el('button','quick-hint-unhide',T('quickHintsUnhide'));again.type='button';
  again.addEventListener('click',()=>{quickHintsHidden.clear();renderQuickHints();});
  box.append(again);
 }
}
async function loadQuickHints(force=false){
 if(quickHintsLoading)return quickHints;
 if(!force&&quickHints&&Date.now()-quickHintsAt<120000)return quickHints;
 quickHintsLoading=true;
 const btn=$('quickHintsBtn');if(btn)btn.disabled=true;
 try{
  quickHints=await rpc('inboxHints',{force:force===true});
  quickHintsAt=Date.now();
  renderQuickHints();
 }catch(err){
  if(force)alertError(err);
 }finally{
  quickHintsLoading=false;if(btn)btn.disabled=false;
 }
 return quickHints;
}
/* Körs en gång efter första statusrenderingen – inte vid varje uppdatering. */
function quickHintsOnce(){
 if(quickHintsTried)return;
 quickHintsTried=true;
 loadQuickHints().catch(()=>{});
}
/* Kontot målmappen ligger i: regeln gäller bara det kontot, alltså räknar vi bara där. */
function quickAccountId(){
 const id=$('quickTarget')?.value||'';
 return id?(folders.find(f=>f.id===id)?.accountId||''):'';
}
function quickAccountName(accountId){
 const f=folders.find(x=>x.accountId===accountId&&x.accountName);
 return f?.accountName||'';
}
/* Räknaren säger vad som faktiskt händer: rätt konto, olästa bara om de får följa med,
   och ett förbehåll när Inkorgen är större än det vi hinner läsa. */
function quickCountText(r,accountId){
 const capped=r.capped?T('quickMatchCapped').replace('{n}',r.scanned):'';
 if(!r.matched)return T('quickMatchZero')+capped;
 if(!r.matches)return T('quickMatchUnreadOnly').replace('{u}',r.unread)+capped;
 if(r.unread&&r.allowUnread===false)return T('quickMatchUnreadPart').replace('{n}',r.matches).replace('{m}',r.matched).replace('{u}',r.unread)+capped;
 const name=accountId?quickAccountName(accountId):'';
 return (name?T('quickMatchAccount').replace('{n}',r.matches).replace('{a}',name):T('quickMatch').replace('{n}',r.matches))+capped;
}
async function updateQuickPreview(){
 const raw=($('quickValue')?.value||'').trim();
 const span=$('quickCount'),sentence=$('quickSentence');
 if(!raw){
  if(span){span.hidden=true;span.textContent='';span.className='quick-count';}
  if(sentence)sentence.textContent='';
  return;
 }
 let cond=null;
 try{cond=C.choiceCondition({field:$('quickField')?.value||'domain',value:raw});}catch{cond=null;}
 if(!cond){if(sentence)sentence.textContent='';return;}
 if(sentence)sentence.textContent=T('quickSentence').replace('{what}',quickWords(cond)).replace('{target}',quickTargetLabel()||T('quickPickTarget'));
 if(span){span.hidden=false;span.className='quick-count';span.textContent=T('quickMatchCounting');}
 const seq=++quickPreviewSeq;
 const accountId=quickAccountId(),allowUnread=$('quickMoveUnread')?.checked!==false;
 try{
  const r=await rpc('quickPreview',{field:$('quickField')?.value||'domain',value:raw,accountId,allowUnread});
  if(seq!==quickPreviewSeq)return;
  if(span){
   span.textContent=quickCountText(r,accountId);
   span.className='quick-count '+(!r.matched?'quick-count-zero':(r.matches<r.matched?'quick-count-warn':'quick-count-ok'));
  }
 }catch{
  if(span)span.hidden=true;
 }
}
function scheduleQuickPreview(){clearTimeout(quickPreviewTimer);quickPreviewTimer=setTimeout(()=>updateQuickPreview().catch(()=>{}),320);}

function renderQuickExisting(){
 const sel=$('quickExisting');if(!sel)return;
 if(unchanged('quickExisting',JSON.stringify([state.config.rules.map(r=>[r.id,r.name,r.enabled]),sel.value,currentLang])))return;
 const keep=sel.value;
 const list=[{id:'',name:T('quickExistingNew')}].concat(state.config.rules.map(r=>({id:r.id,name:(r.enabled?'':'⏸ ')+r.name})));
 sel.replaceChildren(...list.map(r=>{const o=el('option','',r.name);o.value=r.id;return o;}));
 sel.value=state.config.rules.some(r=>r.id===keep)?keep:'';
 const chosen=state.config.rules.find(r=>r.id===sel.value);
 if($('quickAddBtn'))$('quickAddBtn').textContent=chosen?T('quickExistingAdd').replace('{name}',chosen.name):T('quickAddBtn');
}
/* Lägger det man valt in i en regel som redan finns i stället för att skapa en ny. */
async function addToExistingRule(ruleId,{runNow=false}={}){
 if(dirty&&!confirm(T('confirmDiscardEditor')))return null;
 const rawVal=($('quickValue')?.value||'').trim();
 const rule=state.config.rules.find(r=>r.id===ruleId);
 if(!rule)throw new C.RuleError('bad_id');
 if(!rawVal){$('quickValue')?.focus();throw new C.RuleError('bad_value');}
 const existingCount=(rule.conditions||[]).length;
 if(existingCount&&rule.match!=='any'&&!confirm(T('quickExistingPrompt').replace('{name}',rule.name).replace('{n}',existingCount)))return null;
 const button=runNow?$('quickAddRunBtn'):$('quickAddBtn');
 if(button)button.disabled=true;
 try{
  const res=await rpc('importConditions',{ruleId,text:rawVal,revision:state.config.revision});
  dirty=false;renderStatus(res.snapshot);loadRule(ruleId,'',{openEditor:false});
  if($('quickValue'))$('quickValue').value='';
  await updateQuickPreview();
  quickHints=null;await loadQuickHints(true);
  if(runNow){
   const r=await rpc('catchUp',{ruleId});
   renderStatus(await rpc('status'));
   toast(T('quickRunToast').replace('{n}',r.scanned).replace('{q}',r.queued));
  }else toast(T('quickExistingDone').replace('{n}',res.added).replace('{name}',rule.name));
  return res;
 }finally{
  if(button)button.disabled=false;
 }
}
async function createQuickRule({runNow=false}={}){
 if(dirty&&!confirm(T('confirmDiscardEditor')))return;
 const field=$('quickField')?.value||'domain';
 const rawVal=($('quickValue')?.value||'').trim();
 const targetId=$('quickTarget')?.value||'';
 if(!rawVal){$('quickValue')?.focus();throw new C.RuleError('bad_value');}
 if(!targetId){focusFolderPicker($('quickTarget'));throw new C.RuleError('choose_target');}
 const button=runNow?$('quickAddRunBtn'):$('quickAddBtn');
 if(button)button.disabled=true;
 try{
  const res=await rpc('quickRule',{field,value:rawVal,target:targetId,sourceAccount:$('source')?.value||'',
   moveUnread:$('quickMoveUnread')?.checked!==false,openWindow:$('quickOpenWindow')?.checked===true,revision:state.config.revision});
  rememberQuickTarget(targetId);
  dirty=false;renderStatus(res.snapshot);loadRule(res.ruleId,'',{openEditor:false});
  if($('quickValue'))$('quickValue').value='';
  quickHints=null;
  await updateQuickPreview();
  await loadQuickHints(true);
  if(runNow){
   const r=await rpc('catchUp',{ruleId:res.ruleId});
   renderStatus(await rpc('status'));
   await loadQuickHints(true);
   toast(T('quickRunToast').replace('{n}',r.scanned).replace('{q}',r.queued));
  }else toast(T('toastQuickAdded'));
 }finally{
  if(button)button.disabled=false;
 }
}
if($('quickAddBtn'))handle('quickAddBtn','click',()=>{
 const chosen=$('quickExisting')?.value||'';
 return chosen?addToExistingRule(chosen,{runNow:false}):createQuickRule({runNow:false});
});
if($('quickAddRunBtn'))handle('quickAddRunBtn','click',()=>{
 const chosen=$('quickExisting')?.value||'';
 return chosen?addToExistingRule(chosen,{runNow:true}):createQuickRule({runNow:true});
});
if($('quickExisting'))handle('quickExisting','change',()=>renderQuickExisting());
if($('quickHintsBtn'))handle('quickHintsBtn','click',()=>loadQuickHints(true));
if($('quickValue'))$('quickValue').addEventListener('input',scheduleQuickPreview);
if($('quickField'))$('quickField').addEventListener('change',()=>updateQuickPreview().catch(()=>{}));
if($('quickTarget'))$('quickTarget').addEventListener('change',()=>{rememberQuickTarget($('quickTarget').value);updateQuickPreview().catch(()=>{});});
if($('quickMoveUnread'))$('quickMoveUnread').addEventListener('change',()=>{
 /* Fönstervalet gäller bara när olästa mejl flyttas – annars är rutan död. */
 if($('quickOpenWindow'))$('quickOpenWindow').disabled=!$('quickMoveUnread').checked;
 updateQuickPreview().catch(()=>{});
});
if($('quickOpenWindow')&&$('quickMoveUnread'))$('quickOpenWindow').disabled=!$('quickMoveUnread').checked;
if($('quickValue'))$('quickValue').addEventListener('keydown',e=>{
 if(e.key==='Enter'){e.preventDefault();$('quickAddBtn')?.click();}
 else if(e.key==='Escape'){e.preventDefault();$('quickValue').value='';updateQuickPreview().catch(()=>{});}
});
handle('match','change',updateMatchHelp);
handle('test','click',async()=>{
 const rule=draft(),result=await rpc('testRule',{rule});
 const reasons={no_match:T('testReasonNoMatch'),disabled:T('testReasonDisabled'),unread:T('testReasonUnread'),already_read:T('testReasonAlreadyRead'),displayed:T('testReasonDisplayed'),eligible:T('testReasonEligible')};
 $('testResult').textContent='TEST · '+(reasons[result.reason]||reasons.no_match)+T('testNoMove')+(result.matches?T('testTargetPrefix')+label(result.target)+'. ':'')+T('testTail')+(result.outsideSource?T('testOutside'):'');$('testResult').hidden=false;
 const box=$('testResult');
 box.append(el('p','',rule.match==='any'?T('matchAnyHelp'):T('matchAllHelp')));
 const list=el('ul','test-conditions');
 (result.conditions||[]).forEach((ok,i)=>{if(!rule.conditions[i])return;list.append(el('li',ok?'condition-pass':'condition-fail',(ok?'✓ '+T('testConditionYes'):'✕ '+T('testConditionNo'))+' · '+ruleConditionLabel(rule.conditions[i])));});
 box.append(list);
 for(const [flag,key] of [[result.paused,'testPaused'],[result.dryRun,'testDryRun'],[result.trial,'testTrial'],[result.fault,'testStopped']])if(flag)box.append(el('p','test-block',T(key)));

});
handle('delete','click',async()=>{if(!selectedId||!confirm(T('confirmDelete')))return;const next=await rpc('saveRules',{rules:state.config.rules.filter(r=>r.id!==selectedId),revision:editRevision});dirty=false;renderStatus(next);loadRule('','',{openEditor:false});setRulePanel('list');});
for(const [id,step] of [['up',-1],['down',1]])handle(id,'click',()=>moveRulePriority(selectedId,step));
handle('pause','click',async()=>{renderStatus(await rpc('setMode',{revision:state.config.revision,paused:!state.config.paused,dryRun:state.config.dryRun}));});
handle('mode','click',async()=>{
 const becomingLive=state.config.dryRun;
 if(becomingLive&&!confirm(T('confirmEnableLive')))return;
 renderStatus(await rpc('setMode',{revision:state.config.revision,paused:false,dryRun:!becomingLive}));toast(becomingLive?T('toastLiveOn'):T('toastTestOn'));
});
handle('clearCacheNow','click',async()=>{
 const btn=$('clearCacheNow');btn.disabled=true;
 try{
  const r=await rpc('clearCache');
  renderStatus(r.status);
  if(r.result?.ok)toast(T('cacheCleared').replace('{n}',String(r.result.folders||0)));
  else toast(T('cacheBusy'),true);
 }catch(err){alertError(err);}
 finally{btn.disabled=false;}
});
handle('queueSelected','click',async()=>{const r=await rpc('queueSelected');toast(r.queued?T('toastQueued'):T('toastAlreadyQueued'));});
handle('learnOn','change',async()=>{
 try{renderStatus(await rpc('learnToggle',{off:!$('learnOn').checked}));}
 catch(err){$('learnOn').checked=!$('learnOn').checked;alertError(err);}
});
handle('showActivity','click',()=>showView('activity'));
handle('runAllRulesBtn','click',async()=>runAllRules());
if($('sweepNow'))handle('sweepNow','click',async()=>runAllRules());

/* Kör samtliga aktiva regler direkt och berätta exakt vad som hände. */
async function runAllRules(){
 const button=$('runAllRulesBtn'),guide=$('sweepNow');
 if(button)button.disabled=true;
 if(guide){guide.disabled=true;guide.textContent=T('sweepChecking');}
 try{
  const r=await rpc('sweepNow');renderStatus(await rpc('status'));
  /* Svara ärligt i stället för att visa nollor: pausat, stoppat eller redan pågående. */
  if(r.skipped==='paused'){toast(T('runAllPaused'));return;}
  if(r.skipped==='stopped'){toast(T('runAllStopped').replace('{code}',Terr(r.fault)||r.fault||'-'));return;}
  if(r.busy){toast(T('runAllBusy'));return;}
  const parts=[T('runAllScanned').replace('{n}',r.scanned).replace('{f}',r.searchedFolders??0),
   T('runAllQueued').replace('{n}',r.queued)];
  if(r.inTarget)parts.push(T('runAllInTarget').replace('{n}',r.inTarget));
  if(r.handled)parts.push(T('runAllHandled').replace('{n}',r.handled));
  if(!r.matched&&r.scanned)parts.push(T('runAllNoMatch'));
  if(r.deferred)parts.push(T('runAllDeferred').replace('{n}',r.deferred));
  if(r.cachedFolders)parts.push(T('runAllCached').replace('{n}',r.cachedFolders));
  if(r.skippedFolders)parts.push(T('runAllSkipped').replace('{n}',r.skippedFolders));
  if(state.config.dryRun)parts.push(T('runAllTestMode'));
  if(r.trialRules?.length)parts.push(T('runAllTrial').replace('{n}',r.trialRules.length));
  if(r.waited)parts.push(T('runAllWaited'));
  toast(parts.join(' '));
 }catch(err){alertError(err);}
 finally{
  if(button)button.disabled=false;
  if(guide){guide.disabled=!!state?.fault||state?.config.paused||!(state?.config.rules||[]).some(x=>x.enabled);guide.textContent=state?.queued?T('sweepQueueNow'):T('sweepRunNow');}
 }
}

/* 🔍 Varför ligger det här mejlet här? Ett omvänt uppslag för det mejl du markerat:
   vilken regel som gäller, vart mejlet skulle ta vägen, och vad som i så fall stoppar. */
async function whyIsHere(){
 const panel=$('whyPanel');if(!panel)return;
 panel.hidden=false;panel.className='why-panel';
 panel.replaceChildren(el('p','muted',T('whyRunning')));
 let r;
 try{r=await rpc('whyHere');}
 catch(err){
  panel.className='why-panel error';
  panel.textContent=err?.code==='one_message'||err?.code==='no_selection'?T('whyNoSelection'):Terr(err.code||err.message);
  return;
 }
 const lines=[];
 const ruleById=id=>(r.rules||[]).find(x=>x.id===id)||null;
 panel.replaceChildren();
 panel.append(el('strong','',T('whyTitle')));
 panel.append(el('p','why-subject',T('whySubject').replace('{subject}',r.message.subject||'(inget ämne)').replace('{author}',r.message.author||'(okänd avsändare)')));
 if(r.message.folderName)panel.append(el('p','muted',r.message.folderName));
 /* 1. Den regel som gäller – eller beskedet att ingen gör det. */
 const winner=ruleById(r.winner);
 if(winner){
  const held=(winner.state||[]).some(x=>/bromsen/.test(x.text));
  if(held)lines.push([T('whyWinnerHeld').replace('{name}',winner.name),'wait']);
  else if(winner.arrived)lines.push([T('whyAlready').replace('{name}',winner.name).replace('{target}',r.winnerName||winner.target||'?'),'ok']);
  else if(winner.target)lines.push([T('whyWinner').replace('{name}',winner.name).replace('{target}',r.winnerName||winner.target),'ok']);
  else lines.push([T('whyNoTarget').replace('{name}',winner.name),'wait']);
 }else{
  lines.push([T('whyNoRule'),'wait']);
 }
 /* 2. Vad som stoppar regeln som gäller. */
 if(winner&&winner.blocked&&winner.state?.length){
  const box=el('div','why-block');
  box.append(el('strong','',T('whyBlockedBy')));
  const ul=el('ul','why-list');
  for(const st of winner.state)ul.append(el('li','why-'+st.ok?'ok':'wait',st.text));
  box.append(ul);panel.append(...lines.map(([text,kind])=>el('p','why-'+kind,text)),box);
 }else{
  panel.append(...lines.map(([text,kind])=>el('p','why-'+kind,text)));
 }
 /* 3. Närmast, när ingen regel matchar: hur många villkor som stämde. */
 if(!r.winner){
  const near=(r.rules||[]).filter(x=>x.enabled&&!x.reason&&x.matches===false)
   .map(x=>({x,hit:x.conditions.filter(c=>c.ok).length,total:x.conditions.length}))
   .filter(e=>e.hit>0).sort((a,b)=>b.hit-a.hit||b.total-a.total).slice(0,3);
  if(near.length){
   const box=el('div','why-block');
   box.append(el('strong','',T('whyNoMatch')));
   const ul=el('ul','why-list');
   for(const e of near){
    ul.append(el('li','why-wait',T('whyClosest').replace('{name}',e.x.name).replace('{hit}',e.hit).replace('{total}',e.total)));
    /* Vilket villkor som fällde avgörandet – det är själva svaret. */
    for(const c of e.x.conditions.filter(c=>!c.ok).slice(0,3))ul.append(el('li','why-cond','· '+c.text+' – '+T('whyRuleNo')));
   }
   box.append(ul);panel.append(box);
  }
 }
 /* 4. Alla regler som prövades, med en rad var. */
 if(r.rules?.length){
  const box=el('details','why-all');
  box.append(el('summary','',T('whyAllRules')+' ('+r.rules.length+')'));
  const ul=el('ul','why-list');
  for(const x of r.rules){
   const label=x.enabled===false?T('whyRuleOff'):x.reason&&/mapp/.test(x.reason)?T('whyRuleOtherFolder'):x.matches?T('whyRuleOk'):T('whyRuleNo');
   ul.append(el('li',x.matches?'why-ok':'why-no',x.name+' – '+label));
  }
  box.append(ul);panel.append(box);
 }
 panel.append(el('p','muted why-footer',T('whyFooter')));
}

/* 🔎 Varför flyttas inte mejlen? Read-only diagnos av den regel du redigerar. */
async function diagnoseCurrentRule(){
 const panel=$('diagnosePanel');if(!panel)return;
 panel.hidden=false;panel.className='diagnose-panel';
 panel.replaceChildren(el('p','muted',T('diagnoseRunning')));
 let rule;
 try{rule=buildRule();}catch(err){panel.textContent=Terr(err.code);return;}
 let r;
 try{r=await rpc('diagnose',{rule});}
 catch(err){panel.className='diagnose-panel error';panel.textContent=Terr(err.code||err.message);return;}
 const lines=[];
 if(r.wouldMove)lines.push([T('diagnoseWouldMove').replace('{n}',r.wouldMove),'ok']);
 if(r.waitingUnread)lines.push([T('diagnoseUnread').replace('{n}',r.waitingUnread),'wait']);
 if(r.alreadyInTarget)lines.push([T('diagnoseInTarget').replace('{n}',r.alreadyInTarget),'ok']);
 if(r.alreadyQueued)lines.push([T('diagnoseQueued').replace('{n}',r.alreadyQueued),'ok']);
 if(r.matched===0)lines.push([T('diagnoseNoMatch'),'wait']);
 panel.replaceChildren();
 panel.append(el('strong','',T('diagnoseTitle')));
 panel.append(el('p','muted',T('diagnoseSummary').replace('{s}',r.scanned).replace('{f}',r.searchedFolders).replace('{m}',r.matched).replace('{rf}',T(r.readFilter==='read'?'rfRead':r.readFilter==='both'?'rfBoth':r.readFilter==='unread'?'rfUnread':'rfDefault'))));
 const list=el('ul','diagnose-list');
 for(const [text,kind] of lines)list.append(el('li','diagnose-'+kind,text));
 panel.append(list);
 /* Villkor för villkor: ett villkor med noll träffar kan aldrig bli sant. */
 if(r.conditions?.length){
  const box=el('div','diagnose-conditions');
  box.append(el('strong','',T('diagnoseCondTitle')));
  const list=el('div','diagnose-cond-list');
  for(const c of r.conditions){
   const row=el('div','diagnose-cond-row'+(c.hits?'':' diagnose-cond-empty'));
   row.append(el('span','diagnose-cond-text',fieldShortText(c.field)+' · '+(OPERATOR_LABELS[c.op]?T(OPERATOR_LABELS[c.op]):c.op)+' · '+(String(c.value||'').trim()||T('diagnoseCondNoValue'))));
   row.append(el('span','diagnose-cond-hits',(c.hits?T('diagnoseCondHits').replace('{n}',c.hits):T('diagnoseCondZero'))));
   list.append(row);
  }
  box.append(list);
  const dead=r.conditions.filter(c=>!c.hits).length;
  if(r.matched===0&&dead)box.append(el('p','diagnose-warn',r.matchMode==='any'?T('diagnoseCondDeadAny').replace('{n}',dead):T('diagnoseCondDeadAll').replace('{n}',dead)));
  panel.append(box);
 }
 /* Regeln kräver alla villkor men villkoren är varianter av samma mejl: erbjud ELLER direkt. */
 if(r.matchMode==='all'&&r.anyMatched>r.matched){
  const fixBox=el('div','diagnose-any');
  fixBox.append(el('strong','',T('diagnoseAnyTitle').replace('{n}',r.anyMatched)));
  fixBox.append(el('p','muted',T('diagnoseAnyNote')));
  const anyBtn=el('button','button small primary',T('diagnoseFixAny'));anyBtn.type='button';
  anyBtn.addEventListener('click',async()=>{
   anyBtn.disabled=true;
   try{
    if($('match')){$('match').value='any';$('match').dispatchEvent(new Event('change',{bubbles:true}));}
    dirty=true;
    await saveCurrentRule({});
    await runAllRules();
    await diagnoseCurrentRule();
    toast(T('diagnoseAnyDone'));
   }catch(err){anyBtn.disabled=false;alertError(err);}
  });
  fixBox.append(anyBtn);
  panel.append(fixBox);
 }
 if(r.matched===0&&r.near?.length){
  const nearBox=el('div','diagnose-examples');
  nearBox.append(el('strong','',T('diagnoseNearTitle')));
  for(const ex of r.near){
   const row=el('div','diagnose-row');
   row.append(el('span','diagnose-subject',ex.subject||''));
   if(ex.domain)row.append(el('span','diagnose-domain',ex.domain));
   nearBox.append(row);
  }
  nearBox.append(el('p','muted',T('diagnoseNearNote')));
  panel.append(nearBox);
 }
 if(r.examples.length){
  const table=el('div','diagnose-examples');
  table.append(el('strong','',T('diagnoseExamples')));
  for(const ex of r.examples){
   const row=el('div','diagnose-row');
   const key={queued:'diagnoseReasonQueued',target:'diagnoseReasonTarget',unread:'diagnoseReasonUnread',move:'diagnoseReasonMove'}[ex.reason]||'diagnoseReasonMove';
   row.append(el('span','diagnose-reason',T(key)));
   row.append(el('span','diagnose-subject',ex.subject||''));
   if(ex.domain)row.append(el('span','diagnose-domain',ex.domain));
   table.append(row);
  }
  panel.append(table);
 }
 if(r.paused||r.fault)panel.append(el('p','diagnose-warn',T(r.paused?'diagnosePaused':'diagnoseFault')));
 else if(!r.engineEnabled)panel.append(el('p','diagnose-warn',T('diagnoseStopped')));
 if(r.dryRun)panel.append(el('p','diagnose-warn',T('diagnoseDryRun')));
 if(r.waitingUnread){
  const fix=el('button','button small primary',T('diagnoseFixUnread'));fix.type='button';
  fix.addEventListener('click',async()=>{
   fix.disabled=true;
   try{
    if($('ruleReadFilter')){$('ruleReadFilter').value='both';updateReadPolicy();}
    if($('ruleMoveUnread'))$('ruleMoveUnread').checked=true;
    dirty=true;
    await saveCurrentRule({});
    if($('autoRunInfo')&&state.config)renderStatus(await rpc('status'));
    await runAllRules();
    await diagnoseCurrentRule();
   }catch(err){fix.disabled=false;alertError(err);}
  });
  panel.append(fix);
 }
 const cta=el('button','button small primary',T('runAllRulesBtn'));cta.type='button';
 cta.addEventListener('click',()=>runAllRules());
 panel.append(cta);
}
if($('diagnoseBtn'))handle('diagnoseBtn','click',diagnoseCurrentRule);
if($('whyBtn'))handle('whyBtn','click',whyIsHere);
handle('catchUp','click',async()=>{
 if(dirty){toast(T('saveFirst'));return;}
 if(!selectedId){toast(T('openRuleFirst'));return;}
 if(!confirm(T('confirmCatchUp')))return;
 const r=await rpc('catchUp',{ruleId:selectedId});renderStatus(await rpc('status'));
 if(currentLang==='en'){
  toast('Scanned '+r.scanned+' messages in '+(r.searchedFolders??'account')+' folders, queued '+r.queued+'.'+(r.deferred?' '+r.deferred+' deferred to next batch (100 max).':'')+(r.skippedFolders?' '+r.skippedFolders+' offline folders skipped.':'')+(state.config.dryRun?' Test mode: no moves executed.':''));
 }else{
  toast('Skannade '+r.scanned+' meddelanden i '+(r.searchedFolders??'kontots')+' mappar, köade '+r.queued+'.'+(r.deferred?' '+r.deferred+' väntar till nästa svep (max 100 i kö).':'')+(r.skippedFolders?' '+r.skippedFolders+' otillgängliga mappar hoppades över.':'')+(state.config.dryRun?' Testläge: inga flyttar utfördes.':''));
 }
});
async function exportAllRules(){
 const data=await rpc('export');
 const file=paths().rules+'sortbro-regler-'+new Date().toISOString().slice(0,10)+'.json';
 await download(data,file);
 toast(T('toastExported').replace('{path}',file));
}
async function handleRuleImport(inputId,merge=false){
 const input=$(inputId);if(!input)return;
 try{
  const file=input.files[0];if(!file)return;
  if(file.size>2097152)throw new C.RuleError('bad_schema');
  let data;try{data=JSON.parse(await file.text());}catch{throw new C.RuleError('bad_schema');}
  if(!confirm(T(merge?'confirmImportMerge':'confirmImport')))return;
  const next=await rpc('import',{backup:data,revision:state.config.revision,merge,keepMode:!DEMO});
  dirty=false;renderStatus(next);loadRule(next.config.rules[0]?.id||'');
  toast(T(merge?'toastMerged':'toastImported'));
 }finally{input.value='';}
}
if($('tbImportFile'))$('tbImportFile').addEventListener('change',()=>importTbFilters($('tbImportFile')).catch(alertError));
if($('tbExportBtn'))handle('tbExportBtn','click',exportTbFilters);
if($('tbUriPrefix'))$('tbUriPrefix').addEventListener('change',()=>{if(tbImport)tbImport.uriPrefix=$('tbUriPrefix').value.trim();});
function renderTbAccounts(){
 const sel=$('tbAccount');if(!sel)return;
 if(unchanged('tbAccounts',JSON.stringify([accounts().map(a=>a.id),currentLang])))return;
 const keep=sel.value;
 selectOptions(sel,accounts(),T('chooseAccount'),keep);
}
handle('export','click',exportAllRules);
if($('exportSettings'))handle('exportSettings','click',exportAllRules);
async function exportRuleFile(rule){
 const slug=C.norm(rule.name||'regel').replace(/[^a-z0-9åäö_-]+/gi,'-').replace(/^-+|-+$/g,'')||'regel';
 const folderHints=folders.map(f=>({id:f.id,accountId:f.accountId,accountName:f.accountName,name:f.name,label:f.label}));
 const singleFile=paths().rules+'sortbro-regel-'+slug+'.json';
 await download({format:'lasfilter-rules',app:'SortBro',version:1,exported:new Date().toISOString(),rules:[rule],folders:folderHints},singleFile);
 toast(T('toastSingleExported').replace('{path}',singleFile));
}
if($('exportSingleRule'))handle('exportSingleRule','click',()=>exportRuleFile(buildRule()));
let savingLogAs=false;
handle('saveLogAs','click',async()=>{
 if(savingLogAs)return;
 if(DEMO){toast(T('saveLogAsDemo'));return;}
 savingLogAs=true;$('saveLogAs').disabled=true;
 try{
  const text=await rpc('exportTextLog');
  const accepted=await saveLogTextAs(text,paths().logs+'sortbro-tekniklogg-'+new Date().toISOString().slice(0,10)+'.txt');
  toast(T(accepted?'saveLogAsStarted':'saveLogAsCancelled'));
 }finally{savingLogAs=false;$('saveLogAs').disabled=false;}
});
handle('exportErrorLog','click',async()=>{
 const file=paths().logs+'sortbro-fellogg.txt';
 await download(await rpc('exportErrorLog'),file,'text/plain',true);
 toast(T('logExported').replace('{path}',file));
});
handle('exportLog','click',async()=>{
 const file=paths().logs+'sortbro-tekniklogg-'+new Date().toISOString().slice(0,10)+'.json';
 await download(await rpc('exportLog'),file);
 toast(T('logExported').replace('{path}',file));
});
handle('import','change',()=>handleRuleImport('import',false));
if($('importSettings'))handle('importSettings','change',()=>handleRuleImport('importSettings',false));
if($('importMerge'))handle('importMerge','change',()=>handleRuleImport('importMerge',true));
if($('importMergeSettings'))handle('importMergeSettings','change',()=>handleRuleImport('importMergeSettings',true));
handle('clearBlocked','click',async()=>{renderStatus(await rpc('clearBlocked'));toast(T('toastCleared'));});
if($('clearFault'))handle('clearFault','click',async()=>{renderStatus(await rpc('clearBlocked'));toast(T('toastCleared'));});
handle('theme','change',async()=>{state.prefs=await rpc('prefs',{prefs:{theme:$('theme').value}});applyTheme(state.prefs);});
handle('introToggle','click',async()=>{state.prefs=await rpc('prefs',{prefs:{introCollapsed:!state.prefs.introCollapsed}});applyAppearance(state.prefs);});
for(const id of ['density','lineSpacing'])handle(id,'change',async()=>{state.prefs=await rpc('prefs',{prefs:{[id]:$(id).value}});applyAppearance(state.prefs);});
handle('fontSize','change',async()=>{state.prefs=await rpc('prefs',{prefs:{fontSize:Number($('fontSize').value)}});applyTheme(state.prefs);});
handle('themeQuick','click',async()=>{state.prefs=await rpc('prefs',{prefs:{theme:document.documentElement.dataset.theme==='dark'?'light':'dark'}});applyTheme(state.prefs);});
async function switchLanguage(nextLang){
 state.prefs=await rpc('prefs',{prefs:{lang:nextLang}});
 applyLanguage(nextLang);
 renderStatus(state);
 toast(T('toastLangChanged'));
}
handle('langSv','click',async()=>switchLanguage('sv'));
handle('langEn','click',async()=>switchLanguage('en'));
handle('lang','change',async()=>switchLanguage($('lang').value));
/* Alla inställningar läses på ett ställe, så att en ny kryssruta inte kan glömmas
   bort i en av de två vägarna som sparar dem. */
function optionsPayload(){
 return {revision:state.config.revision,moveMode:$('moveMode').value,hourly:$('hourly').checked,sweepMinutes:Number($('sweepMinutes').value),
  newInboxDirect:$('newInboxDirect').checked,openWindow:$('openWindow').checked,verbose:$('verbose').checked,fileLog:$('fileLog').checked,
  autoBackup:$('autoBackup').checked,autoClear:$('autoClear').checked,brake:$('brake').checked};
}
handle('moveMode','change',async()=>{renderStatus(await rpc('setOptions',optionsPayload()));toast($('moveMode').value==='direct'?T('toastModeDirect'):T('toastModeRead'));});
for(const id of ['openWindow','hourly','sweepMinutes','newInboxDirect','verbose','fileLog','autoBackup','autoClear','brake'])handle(id,'change',async()=>{renderStatus(await rpc('setOptions',optionsPayload()));if(id==='openWindow')toast($('openWindow').checked?T('toastOpenWindowOn'):T('toastOpenWindowOff'));if(id==='verbose')toast($('verbose').checked?T('toastVerboseOn'):T('toastVerboseOff'));if(id==='fileLog')toast($('fileLog').checked?T('toastFileLogOn'):T('toastFileLogOff'));if(id==='sweepMinutes')toast(T('toastSweepIntervalPrefix')+$('sweepMinutes').value+T('toastSweepIntervalSuffix'));if(id==='newInboxDirect')toast($('newInboxDirect').checked?T('toastInboxDirectOn'):T('toastInboxDirectOff'));if(id==='autoBackup')toast($('autoBackup').checked?T('toastAutoBackupOn'):T('toastAutoBackupOff'));if(id==='brake')toast($('brake').checked?T('toastBrakeOn'):T('toastBrakeOff'));});
if($('brakeWarns'))$('brakeWarns').addEventListener('click',e=>{
 const move=e.target.closest('[data-brake-move]'),stop=e.target.closest('[data-brake-stop]'),del=e.target.closest('[data-brake-delete]');
 if(move)brakeAnswer(move.dataset.brakeMove,'move');
 else if(stop)brakeAnswer(stop.dataset.brakeStop,'stop');
 else if(del)brakeAnswer(del.dataset.brakeDelete,'delete');
});
handle('backupNow','click',async()=>{
 const r=await rpc('backupNow');
 const info=$('backupInfo');
 if(r?.written){if(info)info.textContent=r.filename;toast(T('backupNowDone').replace('{n}',r.count).replace('{name}',r.filename));}
 else{toast(r?.reason==='unchanged'?T('backupNowUnchanged'):T('backupNowFailed'),r?.reason!=='unchanged');}
});
handle('refreshFolders','click',async()=>{folders=await rpc('folders');repaint();const src=$('source').value,target=$('target').value;accountOptions(src);targetOptions(target);renderRules();renderSuggestions();toast(T('toastFoldersRefreshed'));});

/* ===== Nya funktioner: mallar, förslag, ny mapp, årstid ===== */
for(const btn of document.querySelectorAll('#templateBar .template-btn'))btn.addEventListener('click',()=>applyTemplate(btn.dataset.template));
if($('newFolderBtn'))handle('newFolderBtn','click',e=>openFolderModal($('targetAccount')?.value||$('source')?.value||'','',e.currentTarget));
if($('quickNewFolderBtn'))handle('quickNewFolderBtn','click',e=>openFolderModal($('quickTargetAccount')?.value||$('source')?.value||'',quickFolderSuggestion(),e.currentTarget));
if($('folderCancelBtn'))handle('folderCancelBtn','click',closeFolderModal);
if($('folderCreateBtn'))handle('folderCreateBtn','click',createFolderFromModal);
if($('folderName'))$('folderName').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();createFolderFromModal().catch(alertError);}});
if($('folderModal')){
 $('folderModal').addEventListener('click',e=>{if(e.target===$('folderModal'))closeFolderModal();});
 $('folderModal').addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeFolderModal();return;}
  if(e.key!=='Tab')return;
  const items=modalFocusItems($('folderModal'));
  const first=items[0],last=items.at(-1);
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
 });
 document.addEventListener('focusin',e=>{if(!folderTreeSession&&!$('folderModal').hidden&&!$('folderModal').contains(e.target))$('folderName').focus();});
}
function modalFocusItems(modal){return [...modal.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]')].filter(n=>!n.closest('[hidden],[inert]'));}
handle('folderTreeAccount','change',()=>{const s=folderTreeSession;if(!s)return;s.accountId=$('folderTreeAccount').value;s.pending='';s.active='';s.expanded.clear();$('folderTreeSearch').value='';renderFolderTree(true);});
handle('folderTreeSearch','input',()=>renderFolderTree());
handle('folderTreeSearch','keydown',event=>{if(event.key==='Enter'||event.key==='ArrowDown'){event.preventDefault();focusTreeRow(folderTreeSession?.active);}});
handle('folderTreeChoose','click',confirmFolderTree);
handle('folderTreeCancel','click',closeFolderTree);
handle('folderTreeModal','click',event=>{if(event.target===$('folderTreeModal'))closeFolderTree();});
handle('folderTreeModal','keydown',event=>{
 if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeFolderTree();return;}
 if(event.key!=='Tab')return;
 const items=modalFocusItems($('folderTreeModal')),first=items[0],last=items.at(-1);
 if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
 else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
});
document.addEventListener('focusin',event=>{if(folderTreeSession&&!$('folderTreeModal').contains(event.target))$('folderTreeAccount').focus();});
async function setSeasonPref(value){
 if(!SEASON_CHOICES.includes(value))return;
 state.prefs=await rpc('prefs',{prefs:{season:value}});
 applySeason(state.prefs);
 toast(T('seasonChanged'));
}
for(const id of ['season','seasonQuick'])if($(id))handle(id,'change',()=>setSeasonPref($(id).value));
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if(state)applyTheme(state.prefs);});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
/* Statusen kan komma tiotal gånger i sekunden under ett svep. Här ligger högst
   en förfrågan i luften åt gången, och högst en till på kö – annars kunde svaren
   komma ikapp varandra och rita en äldre status över en nyare. */
let refreshing=false,refreshQueued=false;
async function refresh(){
 if(refreshing){refreshQueued=true;return;}
 refreshing=true;
 try{
  do{refreshQueued=false;renderStatus(await rpc('status'));}while(refreshQueued);
 }catch(e){alertError(e);}
 finally{refreshing=false;refreshQueued=false;}
}
if(live&&!DEMO)browser.runtime.onMessage.addListener(msg=>{
 if(msg?.event==='statusChanged')refresh();
 if(msg?.event==='ruleFromMessage'){prefillWaiting=true;applyPrefill().catch(alertError);}
});
(async()=>{
 applyVersionLabel();
 if($('installWarnHide'))handle('installWarnHide','click',()=>{installWarnDismissed=true;if($('installWarn'))$('installWarn').hidden=true;});
try{if(DEMO)$('demoBanner').hidden=false;folders=await rpc('folders');renderStatus(await rpc('status'));loadRule(state.prefs.lastRule||state.config.rules[0]?.id||'','',{openEditor:false});await applyPrefill();}
 catch(e){$('statusPill').textContent=T('pillDisconnected');$('notice').hidden=false;$('notice').textContent=Terr(e.code);$('notice').className='notice error';}
})();
