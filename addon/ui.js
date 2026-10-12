'use strict';
const $=id=>document.getElementById(id),C=LasCore;
const DEMO=!!globalThis.LAS_DEMO||new URLSearchParams(location.search).get('demo')==='1';
const live=!!globalThis.browser?.runtime?.id;
let state=null,folders=[],selectedId='',dirty=false,editRevision=0,editToken='',activeView='rules',currentLang='sv',toastTimer;

const I18N={
 sv:{
  pageTitle:'SortBro · Thunderbird',
  demoBanner:'FÖRHANDSVISNING · Fiktiva data. Inga mejl läses eller flyttas.',
  brandName:'SortBro',
  brandSub:'FÖR THUNDERBIRD',
  navMenu:'MENY',
  navRules:'Start',
  navActivity:'Vad har hänt?',
  navSettings:'Avancerat',
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
  versionText:'Lokal behandling · v1.1.0 · Inga molntjänster',
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
  rulesTitle:'Dina automatiska flyttar',
  rulesSub:'Lägg upp hur många regler du vill. Varje regel visar villkor, oläst/läst-val och målmapp.',
  newFromSelectedBtn:'✉ Ny från markerat mejl',
  newRuleBtn:'＋ Ny tom regel',
  quickRuleTitle:'⚡ Snabbskapa nytt filter (lägg till flera olika direkt)',
  quickFetchBtn:'✉ Hämta från markerat mejl',
  quickAddBtn:'＋ Lägg till filter',
  quickValuePlaceholder:'t.ex. fortnox.se, klarna.se eller Faktura…',
  ruleSearchPlaceholder:'Sök bland dina regler…',
  exportBtn:'↓ Exportera regler (.json)',
  importBtn:'↑ Importera (.json)',
  importMergeBtn:'＋ Lägg till från JSON',
  exportSingleRuleBtn:'↓ Exportera regel (.json)',
  jsonBackupSub:'Exportera dina regler till en JSON-fil eller importera regler från en JSON-fil (ersätt alla eller lägg till).',
  priorityNote:'Reglerna körs uppifrån och ned (första träff gäller). Ändra ordning med Prioritet-knapparna.',
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
  matchAll:'Alla ska stämma',
  matchAny:'Minst ett ska stämma',
  step2Help:'Avsändaren fylls i automatiskt från exempelmejlet. Du kan lägga till upp till 8 villkor per regel.',
  colField:'Fält',
  colOp:'Villkor',
  colValue:'Värde',
  addConditionBtn:'＋ Lägg till villkor',
  step3Title:'Vart och när ska mejlen flyttas?',
  targetLabel:'Välj målmapp',
  chooseTarget:'Välj en målmapp…',
  ruleMoveUnreadLabel:'Flytta olästa mejl i detta filter',
  ruleOpenWindowLabel:'Öppna flyttade olästa mejl i nytt fönster',
  inlineMoveUnread:'Flytta olästa mejl',
  inlineOpenWindow:'Öppna i nytt fönster',
  readFilterLabel:'Flytta olästa / lästa mejl för denna regel',
  rfDefault:'Enligt standardinställning (lästa + nya i Inkorgen)',
  rfRead:'Endast lästa mejl (vänta tills mejlet är läst och lämnat)',
  rfBoth:'Både olästa och lästa mejl (flytta direkt)',
  rfUnread:'Endast olästa mejl (flytta direkt)',
  unreadActionLabel:'När olästa mejl flyttas av denna regel',
  uaDefault:'Enligt standardinställning (Avancerat)',
  uaKeep:'Behåll som oläst i målmappen (utan popup-fönster)',
  uaWindow:'Öppna i nytt fönster och behåll som oläst',
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
  fileLogLabel:'Skriv teknisk logg automatiskt till Hämtade filer/Lasfilter/lasfilter-logg.txt',
  fileLogNote:'Loggfilen skrivs om automatiskt efter nya händelser och innehåller inte ämnesrader, adresser eller mejltexter.',
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
  footerRight:'Egna regler · Inga ändringar i msgFilterRules.dat',
  policyDefaultTitle:'Först läst (eller direkt vid nyinkommet i Inkorgen).',
  policyDefaultBody:'Följer standardinställningen: lästa mejl flyttas när de lämnats i 2 sekunder, och nya mejl i Inkorgen kan flyttas direkt.',
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
  toastQuickAdded:'Nytt filter tillagt! Skriv eller hämta nästa mejl för att lägga till fler.',
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
  toastExported:'Reglerna exporterades till JSON-fil.',
  toastSingleExported:'Regeln exporterades till JSON-fil.',
  toastCleared:'Spärren är rensad och bevakningen är igång igen.',
  toastModeDirect:'Direktläge: nya matchande mejl flyttas även olästa.',
  toastModeRead:'Nya mejl flyttas när de är lästa och lämnade.',
  toastOpenWindowOn:'Olästa flyttade mejl öppnas i eget fönster som standard.',
  toastOpenWindowOff:'Olästa flyttade mejl stannar i målmappen utan popup-fönster.',
  toastVerboseOn:'Detaljlogg på: händelser syns under Aktivitet och i exporten.',
  toastVerboseOff:'Detaljlogg av.',
  toastFileLogOn:'Loggfil på: Hämtade filer/Lasfilter/lasfilter-logg.txt uppdateras automatiskt.',
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
  autoRunOn:'Automatiskt: {n} regler körs var {min}:e minut, nästa gång {time}. Inkommande mejl bevakas hela tiden.',
  autoRunOff:'Automatisk körning är av – slå på den under Avancerat. Inkommande mejl bevakas ändå hela tiden.',
  diagnoseBtn:'🔎 Varför flyttas inte mejlen?',
  diagnoseTitle:'Varför flyttas inte mejlen?',
  diagnoseRunning:'Undersöker kontots mappar – inget flyttas…',
  diagnoseSummary:'Granskade {s} mejl i {f} mappar. {m} matchade regeln. Regelns läsläge: {rf}.',
  diagnoseWouldMove:'{n} mejl är redo – de flyttas vid nästa körning.',
  diagnoseUnread:'{n} matchande mejl är olästa och väntar tills du har läst dem.',
  diagnoseInTarget:'{n} mejl ligger redan i målmappen (eller i sin årsmapp).',
  diagnoseQueued:'{n} mejl är redan hanterade eller köade sedan tidigare.',
  diagnoseNoMatch:'Inga mejl matchar villkoren. Kontrollera fält, värde och konto – eller använd Kontrollera på ett markerat mejl.',
  diagnoseExamples:'Exempel på matchande mejl',
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
  ruleYearFoldersLabel:'Lägg varje år i en egen årsmapp under målmappen (t.ex. Arkiv/2025)',
  yearFoldersNote:'Årsmappen skapas automatiskt när den behövs. Välj Endast lästa mejl nedan om olästa mejl ska vänta tills du har läst dem.',
  tagYearFolders:'🗓️ årsmappar',
  tplYearArchive:'Arkivera föregående år',
  tplOlder90:'Arkivera äldre än 90 dagar',
  tplNameYearArchive:'Årsarkiv – tidigare år',
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
  suggestTitle:'✨ Föreslå regler från Inkorgen',
  suggestBtn:'✨ Skanna Inkorgen',
  suggestHelp:'SortBro tittar lokalt i Inkorgen och föreslår avsändare som återkommer. Inget skapas förrän du själv väljer målmapp och godkänner.',
  suggestEmpty:'Inga nya förslag just nu – Inkorgen har inga återkommande avsändare som saknar regel.',
  suggestSummary:'{count} mejl',
  suggestFound:'{count} förslag hittades i Inkorgen.',
  suggestApprove:'✓ Godkänn',
  suggestApproved:'Regeln skapades från Inkorgen.',
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
   uncertain_move:'Ett flyttförsök fick osäkert svar. Klicka på "Rensa spärr och fortsätt" (eller under Avancerat) för att återuppta bevakningen.',
   storage_error:'Inställningarna kunde inte sparas. Motorn är stoppad i denna session.',
   invalid_storage:'Lagrade inställningar kunde inte läsas. Bevakningen är stoppad.',
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
   fallback:'Teknisk händelse'
  }
 },
 en:{
  pageTitle:'SortBro · Thunderbird',
  demoBanner:'PREVIEW · Sample data only. No emails are read or moved.',
  brandName:'SortBro',
  brandSub:'FOR THUNDERBIRD',
  navMenu:'MENU',
  navRules:'Rules',
  navActivity:'Activity Log',
  navSettings:'Advanced',
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
  versionText:'Local processing · v1.0.0 · No cloud services',
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
  rulesTitle:'Your automatic rules',
  rulesSub:'Create as many rules as you like. Each row shows conditions, read/unread mode and target folder.',
  newFromSelectedBtn:'✉ New from selected email',
  newRuleBtn:'＋ New blank rule',
  quickRuleTitle:'⚡ Quick-create filter (add multiple rules directly)',
  quickFetchBtn:'✉ Fetch from selected email',
  quickAddBtn:'＋ Add filter',
  quickValuePlaceholder:'e.g. fortnox.se, klarna.se or Invoice…',
  ruleSearchPlaceholder:'Search your rules…',
  exportBtn:'↓ Export rules (.json)',
  importBtn:'↑ Import (.json)',
  importMergeBtn:'＋ Add from JSON',
  exportSingleRuleBtn:'↓ Export rule (.json)',
  jsonBackupSub:'Export your rules to a JSON file or import rules from a JSON file (replace all or append).',
  priorityNote:'Rules are evaluated top to bottom (first match wins). Reorder with the Priority buttons.',
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
  matchAll:'Match all conditions',
  matchAny:'Match any condition',
  step2Help:'The sender is filled in automatically from the sample email. You can add up to 8 conditions per rule.',
  colField:'Field',
  colOp:'Operator',
  colValue:'Value',
  addConditionBtn:'＋ Add condition',
  step3Title:'Where and when should emails move?',
  targetLabel:'Target folder',
  chooseTarget:'Select a target folder…',
  ruleMoveUnreadLabel:'Move unread emails in this filter',
  ruleOpenWindowLabel:'Open moved unread emails in a new window',
  inlineMoveUnread:'Move unread mail',
  inlineOpenWindow:'Open in new window',
  readFilterLabel:'Move unread / read emails for this rule',
  rfDefault:'Use global default (read + new in Inbox)',
  rfRead:'Read emails only (wait until read and closed)',
  rfBoth:'Both unread and read emails (move immediately)',
  rfUnread:'Unread emails only (move immediately)',
  unreadActionLabel:'When unread emails are moved by this rule',
  uaDefault:'Use global default (Advanced)',
  uaKeep:'Keep unread in target folder (no popup window)',
  uaWindow:'Open in new window and keep unread',
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
  fileLogLabel:'Automatically write technical log to Downloads/Lasfilter/lasfilter-logg.txt',
  fileLogNote:'The log file is updated automatically after new events and never contains subjects, addresses or message bodies.',
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
  footerRight:'Custom rules · No changes to msgFilterRules.dat',
  policyDefaultTitle:'Read first (or immediately on Inbox arrival).',
  policyDefaultBody:'Follows global default: read emails move after being closed for 2 seconds, and new Inbox arrivals can move immediately.',
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
  toastQuickAdded:'New filter added! Enter or fetch your next email to add more.',
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
  toastExported:'Rules exported to JSON file.',
  toastSingleExported:'Rule exported to JSON file.',
  toastCleared:'Lock cleared and monitoring resumed.',
  toastModeDirect:'Immediate mode: new matching emails move even when unread.',
  toastModeRead:'New emails move after they are read and closed.',
  toastOpenWindowOn:'Moved unread emails open in a separate window by default.',
  toastOpenWindowOff:'Moved unread emails stay in target folder without a popup window.',
  toastVerboseOn:'Detailed logging enabled: diagnostics appear in Activity Log and exports.',
  toastVerboseOff:'Detailed logging disabled.',
  toastFileLogOn:'File log enabled: Downloads/Lasfilter/lasfilter-logg.txt updates automatically.',
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
  autoRunOn:'Automatic: {n} rules run every {min} minutes, next at {time}. Incoming mail is monitored continuously.',
  autoRunOff:'Automatic runs are off – enable them under Advanced. Incoming mail is still monitored continuously.',
  diagnoseBtn:'🔎 Why are the emails not moving?',
  diagnoseTitle:'Why are the emails not moving?',
  diagnoseRunning:'Examining the account folders – nothing is moved…',
  diagnoseSummary:'Checked {s} emails in {f} folders. {m} matched the rule. Rule read mode: {rf}.',
  diagnoseWouldMove:'{n} emails are ready – they move on the next run.',
  diagnoseUnread:'{n} matching emails are unread and wait until you have read them.',
  diagnoseInTarget:'{n} emails are already in the target folder (or its year folder).',
  diagnoseQueued:'{n} emails were already handled or queued earlier.',
  diagnoseNoMatch:'No emails match the conditions. Check field, value and account – or use Check on a selected email.',
  diagnoseExamples:'Examples of matching emails',
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
  ruleYearFoldersLabel:'Put each year in its own year folder under the target folder (e.g. Archive/2025)',
  yearFoldersNote:'The year folder is created automatically when needed. Choose Read emails only below if unread emails should wait until you have read them.',
  tagYearFolders:'🗓️ year folders',
  tplYearArchive:'Archive previous years',
  tplOlder90:'Archive older than 90 days',
  tplNameYearArchive:'Year archive – previous years',
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
  suggestTitle:'✨ Suggest rules from the Inbox',
  suggestBtn:'✨ Scan the Inbox',
  suggestHelp:'SortBro looks locally at your Inbox and suggests senders that keep coming back. Nothing is created until you pick a target folder and approve.',
  suggestEmpty:'No new suggestions right now – your Inbox has no recurring senders without a rule.',
  suggestSummary:'{count} emails',
  suggestFound:'{count} suggestions found in the Inbox.',
  suggestApprove:'✓ Approve',
  suggestApproved:'Rule created from the Inbox.',
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
   uncertain_move:'A move attempt returned an uncertain status. Click "Clear lock & resume" (or under Advanced) to resume monitoring.',
   storage_error:'Settings could not be saved. Engine is stopped for this session.',
   invalid_storage:'Stored settings could not be read. Monitoring is stopped.',
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
   fallback:'Technical event'
  }
 }
};

const T=key=>I18N[currentLang]?.[key]??I18N.sv[key]??key;
const Terr=code=>I18N[currentLang]?.errors?.[code]??I18N.sv.errors[code]??I18N[currentLang]?.errors?.internal_error;
const Tevent=ev=>I18N[currentLang]?.events?.[ev]??I18N.sv.events[ev]??T('events').fallback;
const locale=()=>currentLang==='en'?'en-GB':'sv-SE';

function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
function toast(text,error=false){const n=$('toast');n.textContent=text;n.style.background=error?'#8e3731':'';n.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>n.hidden=true,6500);}
function alertError(err){toast(Terr(err.code||err.message),true);}
async function rpc(type,data={}){
 if(!live&&!DEMO)throw new C.RuleError('not_installed');
 const reply=DEMO?await LasDemo.request({type,...data}):await browser.runtime.sendMessage({type,...data});
 if(!reply?.success)throw new C.RuleError(reply?.error||'internal_error');return reply.data;
}
function handle(id,event,fn){const n=$(id);if(n)n.addEventListener(event,async e=>{try{await fn(e);}catch(err){alertError(err);}});}
const label=id=>folders.find(f=>f.id===id)?.label||T('missingFolder');

function updateReadPolicy(){
 const rf=$('ruleReadFilter')?.value||'default';
 const ua=$('ruleUnreadAction')?.value||'default';
 if($('ruleMoveUnread'))$('ruleMoveUnread').checked=(rf==='both'||rf==='unread'||(rf==='default'&&(state?.moveMode==='direct'||state?.newInboxDirect!==false)));
 if($('ruleOpenWindow'))$('ruleOpenWindow').checked=(ua==='window'||(ua==='default'&&state?.openWindow!==false));
 const map={
  default:['policyDefaultTitle','policyDefaultBody'],
  read:['policyReadTitle','policyReadBody'],
  both:['policyBothTitle','policyBothBody'],
  unread:['policyUnreadTitle','policyUnreadBody']
 }[rf]||['policyDefaultTitle','policyDefaultBody'];
 if($('readPolicyTitle'))$('readPolicyTitle').textContent=T(map[0]);
 if($('readPolicyBody'))$('readPolicyBody').textContent=T(map[1]);
}

function applyLanguage(lang){
 currentLang=lang==='en'?'en':'sv';
 document.documentElement.lang=currentLang;
 document.title=T('pageTitle');
 for(const node of document.querySelectorAll('[data-i18n]')){
  const key=node.dataset.i18n;
  if(key)node.textContent=T(key);
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
  const f=row.children[0],op=row.children[1],val=row.children[2],trg=row.children[3];
  const fVal=f.value,opVal=op.value,tVal=trg.value;
  fillFieldSelect(f,fVal);fillOpSelect(op,fVal,opVal);
  val.placeholder=T('branchPlaceholder');
  if(trg.options[0])trg.options[0].textContent=T('chooseTarget');
  trg.value=tVal;
 }
 updateReadPolicy();
 if($('editorTitle'))$('editorTitle').textContent=selectedId?T('editorEdit'):T('editorNew');
 if(state)applySeason(state.prefs);
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
 if(state.moveMode!==undefined){$('moveMode').value=state.moveMode;$('openWindow').checked=state.openWindow!==false;$('hourly').checked=!!state.hourly;$('sweepMinutes').value=String(state.sweepMinutes||60);$('newInboxDirect').checked=state.newInboxDirect!==false;$('verbose').checked=!!state.config.verbose;$('fileLog').checked=state.config.fileLog!==false;}
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
 const logos=[['brandLogo','64'],['topbarLogo','32'],['supportLogo','128']];
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

/* ===== ✨ Föreslå regler från Inkorgen (endast lokala förslag) ===== */
let suggestions=[],suggestionsScanned=false;
function renderSuggestions(){
 const box=$('suggestionsBox');if(!box)return;
 box.replaceChildren();
 if(!suggestionsScanned&&!suggestions.length)return;
 if(!suggestions.length){box.append(el('p','suggestion-empty',T('suggestEmpty')));return;}
 for(const s of suggestions){
  const row=el('div','suggestion-row'),main=el('div','sug-main');
  main.append(el('strong','',s.domain));
  const parts=[T('suggestSummary').replace('{count}',s.count)];
  if(s.subject)parts.push(s.subject);
  if(s.sender)parts.push(s.sender);
  main.append(el('small','',parts.join(' · ')));
  const select=el('select');select.setAttribute('aria-label',T('chooseTarget'));selectOptions(select,folders,T('chooseTarget'),'');
  const ok=el('button','button small primary',T('suggestApprove'));ok.type='button';
  ok.addEventListener('click',async()=>{try{await approveSuggestion(s,select.value);}catch(err){alertError(err);}});
  row.append(main,select,ok);box.append(row);
 }
}
async function scanInbox(){
 if($('suggestRulesBtn'))$('suggestRulesBtn').disabled=true;
 try{
  suggestions=await rpc('suggestRules');
  suggestionsScanned=true;
  renderSuggestions();
  toast(suggestions.length?T('suggestFound').replace('{count}',suggestions.length):T('suggestEmpty'));
 }finally{if($('suggestRulesBtn'))$('suggestRulesBtn').disabled=false;}
}
async function approveSuggestion(s, targetId){
 if(!targetId)throw new C.RuleError('choose_target');
 const folder=folders.find(f=>f.id===targetId)||folders[0];
 const accountId=folder?.accountId||$('source')?.value||accounts()[0]?.id||'';
 const anchor=folders.find(f=>f.accountId===accountId&&f.id!==targetId)||folder;
 const rule=C.validateRule({
  id:crypto.randomUUID(),
  name:(T('defaultRulePrefix')+s.domain).slice(0,100),
  enabled:true,
  source:anchor?.id||targetId,
  sourceAccount:accountId,
  scope:'account',
  target:targetId,
  match:'all',
  readFilter:($('quickMoveUnread')&&!$('quickMoveUnread').checked)?'read':'both',
  unreadAction:($('quickOpenWindow')&&$('quickOpenWindow').checked)?'window':'keep',
  conditions:[{field:'domain',op:'equals',value:s.domain}],
  branches:[]
 });
 const next=await rpc('saveRules',{rules:[...state.config.rules,rule],revision:editRevision});
 suggestions=suggestions.filter(x=>x.domain!==s.domain);
 dirty=false;renderStatus(next);loadRule(rule.id);renderSuggestions();
 toast(T('suggestApproved'));
}

/* ===== 1-klicksmallar ===== */
const TEMPLATES={
 faktura:{name:'tplNameInvoice',match:'any',conditions:[['subject','contains','faktura'],['subject','contains','kvitto']],hints:['faktur','kvitto','ekonomi','invoice']},
 order:{name:'tplNameOrder',match:'any',conditions:[['subject','contains','order'],['subject','contains','leverans'],['subject','contains','försändelse']],hints:['order','leverans','inköp','buy']},
 nyhetsbrev:{name:'tplNameNews',match:'any',conditions:[['subject','contains','nyhetsbrev'],['subject','contains','newsletter'],['sender','contains','newsletter']],hints:['nyhetsbrev','news','webb','info']},
 system:{name:'tplNameSystem',match:'any',conditions:[['sender','contains','noreply'],['sender','contains','no-reply'],['subject','contains','notis']],hints:['notis','system','support','drift']},
 bokforing:{name:'tplNameBookkeeping',match:'any',conditions:[['subject','contains','bokföring'],['subject','contains','verifikation'],['subject','contains','moms']],hints:['bokför','ekonomi','redovisning']},
 arsarkiv:{name:'tplNameYearArchive',match:'any',conditions:[['date','beforeThisYear','']],hints:['arkiv','archive'],readFilter:'read',yearFolders:true},
 aldre90:{name:'tplNameOlder90',match:'any',conditions:[['date','older','90']],hints:['arkiv','archive'],readFilter:'read',yearFolders:true}
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
 if(!$('source')?.value){const first=accounts()[0];if(first)accountOptions(first.id);}
 const auto=folders.find(f=>{const n=C.norm((f.name||'')+' '+(f.label||''));return template.hints.some(h=>n.includes(C.norm(h)));});
 if($('target'))targetOptions(auto?.id||$('target').value||'');
 if($('delete'))$('delete').disabled=true;
 if($('editorTitle'))$('editorTitle').textContent=T('editorNew');
 updateReadPolicy();dirty=true;showView('rules');renderRules();
 $('ruleForm')?.scrollIntoView({behavior:'smooth',block:'center'});
 toast(T('tplApplied')+(auto?'':' '+T('tplTargetHint')));
}

/* ===== ＋ Ny mapp ===== */
function openFolderModal(presetAccountId){
 const modal=$('folderModal');if(!modal)return;
 const parent=$('folderParent');
 if(parent)selectOptions(parent,folders,T('newFolderRoot'),'');
 if(!$('source')?.value&&presetAccountId)accountOptions(presetAccountId);
 if($('folderName'))$('folderName').value='';
 modal.hidden=false;
 $('folderName')?.focus();
}
async function createFolderFromModal(){
 const name=$('folderName')?.value||'';
 const parentId=$('folderParent')?.value||'';
 const created=await rpc('createFolder',{parentId,name});
 folders=await rpc('folders');
 const src=$('source')?.value||'',target=$('target')?.value||'';
 accountOptions(src);targetOptions(created?.id||target);
 if($('quickTarget')&&created?.id)$('quickTarget').value=created.id;
 const modal=$('folderModal');if(modal)modal.hidden=true;
 renderRules();toast(T('toastFolderCreated'));
}

/* ===== Högerklicksmeny i Thunderbird: ny regel från mejl ===== */
async function applyPrefill(){
 if(!live||DEMO)return false;
 let data=null;
 try{data=await rpc('pendingPrefill');}catch{return false;}
 if(!data)return false;
 await rpc('prefillConsumed').catch(()=>{});
 if(dirty&&!confirm(T('confirmDiscard')))return false;
 loadRule('',data.accountId||'');
 const row=$('conditions')?.children?.[0];
 if(row){
  const field=row.children[0];
  field.value=data.domain?'domain':(data.email?'sender':'subject');
  field.dispatchEvent(new Event('change',{bubbles:true}));
  row.children[2].value=(data.domain||data.email||data.subject||'').slice(0,256);
 }
 if($('ruleName')&&!$('ruleName').value.trim())$('ruleName').value=(T('defaultRulePrefix')+(data.domain||data.email||T('defaultSenderFallback'))).slice(0,100);
 dirty=true;showView('rules');
 $('ruleName')?.focus();
 toast(T('toastPrefill'));
 return true;
}

function currentToken(){return JSON.stringify(state.config.rules);}
function renderStatus(next){
 state=next;applyTheme(state.prefs);applySeason(state.prefs);
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
 renderRules();renderActivity();renderBackups();renderSuggestions();
}
function ruleTagText(rule){
 if(!rule.enabled)return T('tagDisabled');
 const scopeText=rule.scope==='account'?T('scopeAccount'):T('scopeFolder');
 const rf=rule.readFilter||'default';
 const modeText=rf==='read'?T('tagRead'):rf==='both'?T('tagBoth'):rf==='unread'?T('tagUnread'):T('tagDefault');
 return scopeText+' · '+modeText+(rule.yearFolders?' · '+T('tagYearFolders'):'');
}
function renderRules(){
 const list=$('ruleList');list.replaceChildren();const search=C.norm($('ruleSearch').value);
 const shown=state.config.rules.filter(r=>C.norm(r.name).includes(search));
 if(!shown.length){list.append(el('p','empty',state.config.rules.length?T('emptyNoMatch'):T('emptyNoRules')));return;}
 for(const rule of shown){
  const row=el('div','rule-row'+(selectedId===rule.id?' selected':''));
  const check=el('input');check.type='checkbox';check.checked=rule.enabled;check.setAttribute('aria-label',(currentLang==='en'?'Enable ':'Aktivera ')+rule.name);
  check.addEventListener('change',async()=>{try{
   if(dirty&&!confirm(T('confirmDiscardEditor'))){check.checked=!check.checked;return;}
   const rules=state.config.rules.map(r=>r.id===rule.id?{...r,enabled:check.checked}:r);
   const next=await rpc('saveRules',{rules,revision:state.config.revision});dirty=false;renderStatus(next);loadRule(rule.id);
  }catch(e){check.checked=!check.checked;alertError(e);}});
  const main=el('div','rule-main');
  const btn=el('button','rule-open');btn.type='button';btn.append(el('strong','',rule.name));
  const c=rule.conditions[0];btn.append(el('small','',({sender:T('fieldSenderShort'),domain:T('fieldDomainShort'),subject:T('fieldSubjectShort')}[c.field])+' · '+c.value+(rule.conditions.length>1?'  + '+(rule.conditions.length-1)+T('moreConditionsSuffix'):'')));
  const f=folders.find(f=>f.id===rule.target);btn.append(el('small','','↳ '+(f?.label||T('missingFolderShort'))));
  btn.append(el('span','rule-tag',ruleTagText(rule)));
  btn.addEventListener('click',()=>{if(!dirty||confirm(T('confirmDiscard')))loadRule(rule.id);});
  const opts=el('div','rule-inline-opts');
  const moveUnreadLbl=el('label'),moveUnreadChk=el('input');moveUnreadChk.type='checkbox';
  const rf=rule.readFilter||'default';
  moveUnreadChk.checked=rf==='both'||rf==='unread'||(rf==='default'&&(state.moveMode==='direct'||state.newInboxDirect!==false));
  moveUnreadLbl.append(moveUnreadChk,el('span','',T('inlineMoveUnread')));
  const openWinLbl=el('label'),openWinChk=el('input');openWinChk.type='checkbox';
  const ua=rule.unreadAction||'default';
  openWinChk.checked=ua==='window'||(ua==='default'&&state.openWindow!==false);
  openWinChk.disabled=!moveUnreadChk.checked;
  openWinLbl.append(openWinChk,el('span','',T('inlineOpenWindow')));
  moveUnreadChk.addEventListener('change',async e=>{
   e.stopPropagation();
   try{
    const nextRf=moveUnreadChk.checked?'both':'read';
    const rules=state.config.rules.map(r=>r.id===rule.id?{...r,readFilter:nextRf}:r);
    const next=await rpc('saveRules',{rules,revision:state.config.revision});
    dirty=false;renderStatus(next);if(selectedId===rule.id)loadRule(rule.id);
    toast(T('toastRuleSaved'));
   }catch(err){moveUnreadChk.checked=!moveUnreadChk.checked;alertError(err);}
  });
  openWinChk.addEventListener('change',async e=>{
   e.stopPropagation();
   try{
    const nextUa=openWinChk.checked?'window':'keep';
    const rules=state.config.rules.map(r=>r.id===rule.id?{...r,unreadAction:nextUa}:r);
    const next=await rpc('saveRules',{rules,revision:state.config.revision});
    dirty=false;renderStatus(next);if(selectedId===rule.id)loadRule(rule.id);
    toast(T('toastRuleSaved'));
   }catch(err){openWinChk.checked=!openWinChk.checked;alertError(err);}
  });
  opts.append(moveUnreadLbl,openWinLbl);
  main.append(btn,opts);
  const quick=el('div','rule-quick');
  const runBtn=el('button','rule-mini-btn','▶');runBtn.type='button';runBtn.title=T('runRuleNowTitle');runBtn.disabled=!rule.enabled||!!state.fault||state.config.paused;
  runBtn.addEventListener('click',async e=>{
   e.stopPropagation();
   try{
    const r=await rpc('catchUp',{ruleId:rule.id});renderStatus(await rpc('status'));
    toast(currentLang==='en'?'Rule "'+rule.name+'": scanned '+r.scanned+', queued '+r.queued+'.':'Regel "'+rule.name+'": skannade '+r.scanned+', köade '+r.queued+'.');
   }catch(err){alertError(err);}
  });
  const dupBtn=el('button','rule-mini-btn','⧉');dupBtn.type='button';dupBtn.title=T('dupRuleTitle');
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
  quick.append(runBtn,dupBtn);
  row.append(check,main,quick);list.append(row);
 }
}
function selectOptions(select,items,placeholder,value=''){
 select.replaceChildren();const blank=el('option','',placeholder);blank.value='';select.append(blank);
 for(const f of items){const o=el('option','',f.label);o.value=f.id;select.append(o);}select.value=value;
}
function accounts(){const seen=new Set();return folders.filter(f=>{if(!f.accountId||seen.has(f.accountId))return false;seen.add(f.accountId);return true;}).map(f=>({id:f.accountId,label:f.accountName||f.accountId}));}
function accountOptions(value=''){selectOptions($('source'),accounts(),T('chooseAccount'),value);}
function targetOptions(value=''){
 selectOptions($('target'),folders,T('chooseTarget'),value);
 if($('quickTarget')){
  const qVal=$('quickTarget').value;
  selectOptions($('quickTarget'),folders,T('chooseTarget'),qVal||value||'');
 }
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
 field.setAttribute('aria-label','Fördelningsfält');op.setAttribute('aria-label','Fördelningsjämförelse');value.setAttribute('aria-label','Fördelningsvärde');value.required=true;target.setAttribute('aria-label','Fördelningsmålmapp');remove.type='button';remove.title='Ta bort fördelning';remove.setAttribute('aria-label','Ta bort fördelning');
 fillFieldSelect(field,b.condition.field);fillOpSelect(op,b.condition.field,b.condition.op);
 syncConditionInput(value,b.condition.field,op.value,String(b.condition.value??''));
 selectOptions(target,folders,T('chooseTarget'),b.target);
 field.addEventListener('change',()=>{fillOpSelect(op,field.value,'');syncConditionInput(value,field.value,op.value,'');dirty=true;});
 op.addEventListener('change',()=>{syncConditionInput(value,field.value,op.value,value.value);dirty=true;});
 remove.addEventListener('click',()=>{row.remove();dirty=true;});
 row.append(field,op,value,target,remove);$('branches').append(row);
}
function addCondition(c={field:'domain',op:'equals',value:''}){
 if($('conditions').children.length>=8){toast(T('maxConditions'));return;}
 const row=el('div','condition-row'),field=el('select'),op=el('select'),value=el('input'),remove=el('button','remove-condition','×');
 field.setAttribute('aria-label','Villkorsfält');op.setAttribute('aria-label','Jämförelse');value.setAttribute('aria-label','Villkorsvärde');value.required=true;remove.type='button';remove.title='Ta bort villkor';remove.setAttribute('aria-label','Ta bort villkor');
 fillFieldSelect(field,c.field);fillOpSelect(op,c.field,c.op);
 syncConditionInput(value,c.field,op.value,String(c.value??''));
 field.addEventListener('change',()=>{fillOpSelect(op,field.value,'');syncConditionInput(value,field.value,op.value,'');dirty=true;});
 op.addEventListener('change',()=>{syncConditionInput(value,field.value,op.value,value.value);dirty=true;});
 remove.addEventListener('click',()=>{if($('conditions').children.length===1){toast(T('minConditions'));return;}row.remove();dirty=true;});
 row.append(field,op,value,remove);$('conditions').append(row);
}
function draft(){const accountId=$('source').value,old=state.config.rules.find(r=>r.id===selectedId),anchor=(old?.sourceAccount===accountId&&folders.some(f=>f.id===old.source)?old.source:folders.find(f=>f.accountId===accountId)?.id)||'';return C.validateRule({id:selectedId||crypto.randomUUID(),name:$('ruleName').value,enabled:$('enabled').checked,source:anchor,sourceAccount:accountId,scope:'account',target:$('target').value,match:$('match').value,readFilter:$('ruleReadFilter')?.value||'default',unreadAction:$('ruleUnreadAction')?.value||'default',yearFolders:$('ruleYearFolders')?.checked===true,
 conditions:[...$('conditions').children].map(row=>({field:row.children[0].value,op:row.children[1].value,value:row.children[2].value})),
 branches:[...$('branches').children].map(row=>({condition:{field:row.children[0].value,op:row.children[1].value,value:row.children[2].value},target:row.children[3].value}))});}
/* Enkel regel-export använder samma validerade utkast som sparningen. */
const buildRule=()=>draft();
function loadRule(id='',presetAccount=''){
 const rule=state.config.rules.find(r=>r.id===id);selectedId=rule?.id||'';
 $('editorTitle').textContent=rule?T('editorEdit'):T('editorNew');$('ruleName').value=rule?.name||'';$('enabled').checked=rule?.enabled??true;
 $('match').value=rule?.match||'all';
 if($('ruleReadFilter'))$('ruleReadFilter').value=rule?.readFilter||'default';
 if($('ruleUnreadAction'))$('ruleUnreadAction').value=rule?.unreadAction||'default';
 if($('ruleYearFolders'))$('ruleYearFolders').checked=rule?.yearFolders===true;
 updateReadPolicy();
 const ruleAccount=rule?(rule.sourceAccount||folders.find(f=>f.id===rule.source)?.accountId||''):(presetAccount||accounts()[0]?.id||'');
 accountOptions(ruleAccount);targetOptions(rule?.target||'');
 $('conditions').replaceChildren();for(const c of rule?.conditions||[{field:'domain',op:'equals',value:''}])addCondition(c);
 $('branches').replaceChildren();for(const b of rule?.branches||[])addBranchRow(b);
 $('testResult').hidden=true;$('delete').disabled=!rule;
 if($('duplicate'))$('duplicate').disabled=!rule&&!$('ruleName').value.trim();
 const i=state.config.rules.findIndex(r=>r.id===selectedId);$('up').disabled=i<=0;$('down').disabled=i<0||i>=state.config.rules.length-1;
 dirty=false;editRevision=state.config.revision;editToken=currentToken();renderRules();
 rpc('prefs',{prefs:{lastRule:selectedId}}).catch(()=>{});
}
function renderActivity(){
 $('logRows').replaceChildren();for(const log of [...state.logs].reverse()){
  const tr=el('tr');for(const text of [new Date(log.time).toLocaleString(locale()),Tevent(log.event)+(log.data.detail?' – '+log.data.detail:''),log.level,log.data.count])tr.append(el('td','',text));$('logRows').append(tr);
 }
 if(!state.logs.length){const tr=el('tr'),td=el('td','',T('noLogsYet'));td.colSpan=4;tr.append(td);$('logRows').append(tr);}
}
function renderBackups(){
 $('backupList').replaceChildren();for(const b of state.backups){const row=el('div','backup');row.append(el('span','',new Date(b.time).toLocaleString(locale())+' · '+b.count+T('rulesCountSuffix')));const btn=el('button','text-button',T('restoreBtn'));btn.addEventListener('click',async()=>{if(!confirm(T('confirmRestore')))return;try{const s=await rpc('restoreBackup',{index:b.index,revision:state.config.revision});dirty=false;renderStatus(s);loadRule();toast(T('toastRestored'));}catch(e){alertError(e);}});row.append(btn);$('backupList').append(row);}
 if(!state.backups.length)$('backupList').append(el('p','muted',T('backupHint')));
 $('blockedInfo').textContent=state.blocked?state.blocked+T('blockedSome'):T('blockedNone');
 $('clearBlocked').disabled=!state.blocked||!!state.inflight;
}
async function download(data,filename){
 const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
 try{
  if(live&&!DEMO&&browser.downloads?.download)await browser.downloads.download({url,filename,saveAs:true});
  else{const a=el('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();}
 }catch(err){
  if(!String(err?.message||err||'').toLowerCase().includes('cancel')){
   const a=el('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();
  }
 }finally{setTimeout(()=>URL.revokeObjectURL(url),60000);}
}
function showView(view){activeView=view;document.querySelectorAll('.view').forEach(n=>n.hidden=n.id!=='view-'+view);document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('active',n.dataset.view===view));}
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
$('ruleForm').addEventListener('input',()=>{dirty=true;if($('duplicate'))$('duplicate').disabled=false;});
$('ruleForm').addEventListener('change',e=>{
 dirty=true;if($('duplicate'))$('duplicate').disabled=false;
 if(e.target?.id!=='ruleMoveUnread'&&e.target?.id!=='ruleOpenWindow')updateReadPolicy();
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
handle('addCondition','click',()=>{addCondition({field:'subject',op:'contains',value:''});dirty=true;});
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
 const existingVal=existing?.conditions?.[0]?.value?.trim()?.toLowerCase()||'';
 const incomingVal=(m.domain||m.email||m.subject||'').trim().toLowerCase();
 if(forceNew||(existing&&existingVal&&incomingVal&&existingVal!==incomingVal)){
  loadRule('',m.sourceAccount);
 }
 $('source').value=m.sourceAccount;targetOptions($('target').value);
 const row=$('conditions').children[0],field=row.children[0].value;
 row.children[2].value=field==='domain'?m.domain:field==='sender'?m.email:m.subject.slice(0,256);
 if(!$('ruleName').value)$('ruleName').value=(T('defaultRulePrefix')+(m.domain||m.email||T('defaultSenderFallback'))).slice(0,100);
 dirty=true;$('target').focus();toast(T('toastFromSelected'));
}
handle('fromSelected','click',async()=>fetchSelectedIntoEditor({forceNew:false}));
if($('newFromSelected'))handle('newFromSelected','click',async()=>fetchSelectedIntoEditor({forceNew:true}));

if($('quickFetchBtn'))handle('quickFetchBtn','click',async()=>{
 const m=await rpc('selected');
 const field=$('quickField')?.value||'domain';
 if($('quickValue'))$('quickValue').value=field==='domain'?(m.domain||m.email||''):field==='sender'?(m.email||m.author||''):(m.subject||'').slice(0,256);
 if($('quickTarget')&&!$('quickTarget').value){
  const sameAcc=folders.find(f=>f.accountId===m.sourceAccount&&!(f.specialUse||[]).includes('inbox'));
  if(sameAcc)$('quickTarget').value=sameAcc.id;
 }
 $('quickTarget')?.focus();
 toast(T('toastFromSelected'));
});

async function createQuickRule(){
 const field=$('quickField')?.value||'domain';
 const rawVal=($('quickValue')?.value||'').trim();
 const targetId=$('quickTarget')?.value||'';
 if(!rawVal){$('quickValue')?.focus();throw new C.RuleError('bad_value');}
 if(!targetId){$('quickTarget')?.focus();throw new C.RuleError('choose_target');}
 const targetFolder=folders.find(f=>f.id===targetId)||folders[0];
 const accountId=targetFolder?.accountId||$('source')?.value||accounts()[0]?.id||'';
 const anchorFolder=folders.find(f=>f.accountId===accountId&&f.id!==targetId)||folders.find(f=>f.accountId===accountId)||targetFolder;
 const op=field==='domain'?'equals':field==='sender'?(rawVal.includes('@')?'equals':'contains'):'contains';
 const ruleName=((field==='subject'?T('defaultSubjectPrefix'):T('defaultRulePrefix'))+rawVal).slice(0,100);
 const moveUnread=$('quickMoveUnread')?$('quickMoveUnread').checked:true;
 const openWin=$('quickOpenWindow')?$('quickOpenWindow').checked:false;
 const newRule=C.validateRule({
  id:crypto.randomUUID(),
  name:ruleName,
  enabled:true,
  source:anchorFolder?.id||targetId,
  sourceAccount:accountId,
  scope:'account',
  target:targetId,
  match:'all',
  readFilter:moveUnread?'both':'read',
  unreadAction:openWin?'window':'keep',
  conditions:[{field,op,value:rawVal}],
  branches:[]
 });
 const rules=[...state.config.rules,newRule];
 const next=await rpc('saveRules',{rules,revision:editRevision});
 if($('quickValue'))$('quickValue').value='';
 dirty=false;renderStatus(next);loadRule(newRule.id);
 toast(T('toastQuickAdded'));
}
if($('quickAddBtn'))handle('quickAddBtn','click',createQuickRule);
if($('quickValue'))$('quickValue').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('quickAddBtn')?.click();}});
handle('test','click',async()=>{
 const result=await rpc('testRule',{rule:draft()});
 const reasons={no_match:T('testReasonNoMatch'),disabled:T('testReasonDisabled'),unread:T('testReasonUnread'),already_read:T('testReasonAlreadyRead'),displayed:T('testReasonDisplayed'),eligible:T('testReasonEligible')};
 $('testResult').textContent='TEST · '+(reasons[result.reason]||reasons.no_match)+T('testNoMove')+(result.matches?T('testTargetPrefix')+label(result.target)+'. ':'')+T('testTail')+(result.outsideSource?T('testOutside'):'');$('testResult').hidden=false;
});
handle('delete','click',async()=>{if(!selectedId||!confirm(T('confirmDelete')))return;const next=await rpc('saveRules',{rules:state.config.rules.filter(r=>r.id!==selectedId),revision:editRevision});dirty=false;renderStatus(next);loadRule();});
for(const [id,step] of [['up',-1],['down',1]])handle(id,'click',async()=>{
 if(dirty){toast(T('saveBeforePriority'));return;}const rules=[...state.config.rules],i=rules.findIndex(r=>r.id===selectedId),j=i+step;if(i<0||j<0||j>=rules.length)return;
 [rules[i],rules[j]]=[rules[j],rules[i]];renderStatus(await rpc('saveRules',{rules,revision:editRevision}));loadRule(selectedId);
});
handle('pause','click',async()=>{renderStatus(await rpc('setMode',{revision:state.config.revision,paused:!state.config.paused,dryRun:state.config.dryRun}));});
handle('mode','click',async()=>{
 const becomingLive=state.config.dryRun;
 if(becomingLive&&!confirm(T('confirmEnableLive')))return;
 renderStatus(await rpc('setMode',{revision:state.config.revision,paused:false,dryRun:!becomingLive}));toast(becomingLive?T('toastLiveOn'):T('toastTestOn'));
});
handle('queueSelected','click',async()=>{const r=await rpc('queueSelected');toast(r.queued?T('toastQueued'):T('toastAlreadyQueued'));});
handle('showActivity','click',()=>showView('activity'));
handle('runAllRulesBtn','click',async()=>runAllRules());
if($('sweepNow'))handle('sweepNow','click',async()=>runAllRules());

/* Kör samtliga aktiva regler direkt och berätta exakt vad som hände. */
async function runAllRules(){
 const button=$('runAllRulesBtn'),guide=$('sweepNow');
 if(button)button.disabled=true;if(guide)guide.disabled=true;
 try{
  const r=await rpc('sweepNow');renderStatus(await rpc('status'));
  const parts=[T('runAllScanned').replace('{n}',r.scanned).replace('{f}',r.searchedFolders??0),
   T('runAllQueued').replace('{n}',r.queued)];
  if(r.deferred)parts.push(T('runAllDeferred').replace('{n}',r.deferred));
  if(r.cachedFolders)parts.push(T('runAllCached').replace('{n}',r.cachedFolders));
  if(r.skippedFolders)parts.push(T('runAllSkipped').replace('{n}',r.skippedFolders));
  if(state.config.dryRun)parts.push(T('runAllTestMode'));
  toast(parts.join(' '));
 }finally{
  if(button)button.disabled=false;
  if(guide)guide.disabled=!!state?.fault||state?.config.paused||!(state?.config.rules||[]).some(x=>x.enabled);
 }
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
 const cta=el('button','button small primary',T('runAllRulesBtn'));cta.type='button';
 cta.addEventListener('click',()=>runAllRules());
 panel.append(cta);
}
if($('diagnoseBtn'))handle('diagnoseBtn','click',diagnoseCurrentRule);
handle('sweepNow','click',async()=>{
 $('sweepNow').disabled=true;$('sweepNow').textContent=T('sweepChecking');
 try{
  const r=await rpc('sweepNow');renderStatus(await rpc('status'));
  if(currentLang==='en'){
   const mode=state.config.dryRun?' Test mode: no emails moved.':' Matching emails move concurrently as the queue forms.';
   toast('Scan complete: '+r.scanned+' emails checked in '+(r.searchedFolders??'account')+' folders, '+r.queued+' matched and queued.'+(r.deferred?' '+r.deferred+' deferred to next batch (100 max in queue).':'')+(r.skippedFolders?' '+r.skippedFolders+' offline folders skipped.':'')+mode);
  }else{
   const mode=state.config.dryRun?' Testläge: inga mejl flyttas.':' Matchande mejl flyttas direkt samtidigt som kön bildas.';
   toast('Kontrollen är klar: '+r.scanned+' mejl granskade i '+(r.searchedFolders??'kontots')+' mappar, '+r.queued+' matchade och köade.'+(r.deferred?' '+r.deferred+' väntar till nästa svep (max 100 i kö åt gången).':'')+(r.skippedFolders?' '+r.skippedFolders+' otillgängliga mappar hoppades över.':'')+mode);
  }
 }finally{if(state)$('sweepNow').disabled=!!state.fault||state.config.paused||!state.config.rules.some(r=>r.enabled);}
});
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
 await download(data,'sortbro-regler-'+new Date().toISOString().slice(0,10)+'.json');
 toast(T('toastExported'));
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
handle('export','click',exportAllRules);
if($('exportSettings'))handle('exportSettings','click',exportAllRules);
if($('exportSingleRule'))handle('exportSingleRule','click',async()=>{
 const rule=buildRule();
 const slug=(rule.name||'regel').toLowerCase().replace(/[^a-z0-9åäö_-]+/gi,'-').replace(/^-+|-+$/g,'')||'regel';
 const folderHints=folders.map(f=>({id:f.id,accountId:f.accountId,accountName:f.accountName,name:f.name,label:f.label}));
 await download({format:'lasfilter-rules',app:'SortBro',version:1,exported:new Date().toISOString(),rules:[rule],folders:folderHints},'sortbro-regel-'+slug+'.json');
 toast(T('toastSingleExported'));
});
handle('exportLog','click',async()=>download(await rpc('exportLog'),'sortbro-tekniklogg-'+new Date().toISOString().slice(0,10)+'.json'));
handle('import','change',()=>handleRuleImport('import',false));
if($('importSettings'))handle('importSettings','change',()=>handleRuleImport('importSettings',false));
if($('importMerge'))handle('importMerge','change',()=>handleRuleImport('importMerge',true));
if($('importMergeSettings'))handle('importMergeSettings','change',()=>handleRuleImport('importMergeSettings',true));
handle('clearBlocked','click',async()=>{renderStatus(await rpc('clearBlocked'));toast(T('toastCleared'));});
if($('clearFault'))handle('clearFault','click',async()=>{renderStatus(await rpc('clearBlocked'));toast(T('toastCleared'));});
handle('theme','change',async()=>{state.prefs=await rpc('prefs',{prefs:{theme:$('theme').value}});applyTheme(state.prefs);});
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
handle('moveMode','change',async()=>{renderStatus(await rpc('setOptions',{revision:state.config.revision,moveMode:$('moveMode').value,hourly:$('hourly').checked,sweepMinutes:Number($('sweepMinutes').value),newInboxDirect:$('newInboxDirect').checked,openWindow:$('openWindow').checked,verbose:$('verbose').checked,fileLog:$('fileLog').checked}));toast($('moveMode').value==='direct'?T('toastModeDirect'):T('toastModeRead'));});
for(const id of ['openWindow','hourly','sweepMinutes','newInboxDirect','verbose','fileLog'])handle(id,'change',async()=>{renderStatus(await rpc('setOptions',{revision:state.config.revision,moveMode:$('moveMode').value,hourly:$('hourly').checked,sweepMinutes:Number($('sweepMinutes').value),newInboxDirect:$('newInboxDirect').checked,openWindow:$('openWindow').checked,verbose:$('verbose').checked,fileLog:$('fileLog').checked}));if(id==='openWindow')toast($('openWindow').checked?T('toastOpenWindowOn'):T('toastOpenWindowOff'));if(id==='verbose')toast($('verbose').checked?T('toastVerboseOn'):T('toastVerboseOff'));if(id==='fileLog')toast($('fileLog').checked?T('toastFileLogOn'):T('toastFileLogOff'));if(id==='sweepMinutes')toast(T('toastSweepIntervalPrefix')+$('sweepMinutes').value+T('toastSweepIntervalSuffix'));if(id==='newInboxDirect')toast($('newInboxDirect').checked?T('toastInboxDirectOn'):T('toastInboxDirectOff'));});
handle('refreshFolders','click',async()=>{folders=await rpc('folders');const src=$('source').value,target=$('target').value;accountOptions(src);targetOptions(target);renderRules();renderSuggestions();toast(T('toastFoldersRefreshed'));});

/* ===== Nya funktioner: mallar, förslag, ny mapp, årstid ===== */
for(const btn of document.querySelectorAll('#templateBar .template-btn'))btn.addEventListener('click',()=>applyTemplate(btn.dataset.template));
if($('suggestRulesBtn'))handle('suggestRulesBtn','click',scanInbox);
if($('newFolderBtn'))handle('newFolderBtn','click',()=>openFolderModal($('source')?.value||''));
if($('quickNewFolderBtn'))handle('quickNewFolderBtn','click',()=>openFolderModal(''));
if($('folderCancelBtn'))handle('folderCancelBtn','click',()=>{$('folderModal').hidden=true;});
if($('folderCreateBtn'))handle('folderCreateBtn','click',createFolderFromModal);
if($('folderName'))$('folderName').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();createFolderFromModal().catch(alertError);}});
if($('folderModal'))$('folderModal').addEventListener('click',e=>{if(e.target===$('folderModal'))$('folderModal').hidden=true;});
async function setSeasonPref(value){
 if(!SEASON_CHOICES.includes(value))return;
 state.prefs=await rpc('prefs',{prefs:{season:value}});
 applySeason(state.prefs);
 toast(T('seasonChanged'));
}
for(const id of ['season','seasonQuick'])if($(id))handle(id,'change',()=>setSeasonPref($(id).value));
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if(state)applyTheme(state.prefs);});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
async function refresh(){try{renderStatus(await rpc('status'));}catch(e){alertError(e);}}
if(live&&!DEMO)browser.runtime.onMessage.addListener(msg=>{
 if(msg?.event==='statusChanged')refresh();
 if(msg?.event==='ruleFromMessage')applyPrefill().catch(()=>{});
});
(async()=>{
 try{if(DEMO)$('demoBanner').hidden=false;folders=await rpc('folders');renderStatus(await rpc('status'));loadRule(state.prefs.lastRule||state.config.rules[0]?.id||'');await applyPrefill();}
 catch(e){$('statusPill').textContent=T('pillDisconnected');$('notice').hidden=false;$('notice').textContent=Terr(e.code);$('notice').className='notice error';}
})();
