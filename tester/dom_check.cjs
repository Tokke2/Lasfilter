/* DOM-kontroller för SortBro-gränssnittet (jsdom). Körs med: npm test i tester/ (kräver jsdom)
   eller: node tester/dom_check.cjs från projektroten.
   Testar det användaren möter: snabbregeln, förslagen, kör-knappen, diagnosen, språkbytet
   samt import och export av Thunderbirds egna filter (msgFilterRules.dat).
   Filen ligger i repot (inte i /tmp) så att den överlever mellan körningar. */
const path=require('path');
const {JSDOM,VirtualConsole}=require('jsdom');
const fs=require('fs');
const ADDON=process.argv[2]||path.join(__dirname,'..','addon');
let pass=0,fail=0;const errors=[];
const check=(ok,label)=>{if(ok){pass++;console.log('PASS: '+label);}else{process.exitCode=1;fail++;errors.push(label);console.log('FAIL: '+label);}};
process.on('exit',()=>console.log('\n'+pass+' kontroller godkända'+(fail?', '+fail+' misslyckade':'')+(errors.length?'\nMisslyckade: '+errors.join(' | '):'')));

const jsdomErrors=[];
const vc=new VirtualConsole();
vc.on('jsdomError',e=>{const m=String(e.message||e);if(/navigation to another Document|Not implemented: navigation/i.test(m))return;jsdomErrors.push(m);});
vc.on('error',m=>jsdomErrors.push(String(m)));

const dom=new JSDOM(fs.readFileSync(path.join(ADDON,'ui.html'),'utf8'),{
 url:'file://'+path.join(ADDON,'ui.html')+'?demo=1',
 runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,virtualConsole:vc,
 beforeParse(w){
  w.matchMedia=q=>({matches:false,media:q,addEventListener(){},removeEventListener(){}});
  w.LAS_DEMO=true;
  /* Låtsas att sidan är installerad i Thunderbird: bara getManifest, inget runtime.id,
     så demon körs som vanligt men sidfoten kan visa manifestets version. */
  w.browser={runtime:{getManifest:()=>({version:'9.9.9'})}};
  w.structuredClone=structuredClone;w.TextDecoder=TextDecoder;w.TextEncoder=TextEncoder;
  w.confirm=()=>true;
  w.Element.prototype.scrollIntoView=function(){};
  w.URL.createObjectURL=()=>'blob:x';
  w.URL.revokeObjectURL=()=>{};
 }});
const w=dom.window,doc=w.document;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(cond,label,soft=false,timeout=4000){
 const t0=Date.now();
 while(Date.now()-t0<timeout){
  try{if(cond())return true;}catch{}
  await sleep(25);
 }
 if(soft)return false;
 check(false,label+' (timeout)');
 return false;
}
const el=id=>doc.getElementById(id);
const txt=id=>el(id)?.textContent||'';
const fire=(node,type)=>node.dispatchEvent(new w.Event(type,{bubbles:true}));
const rows=()=>doc.querySelectorAll('.rule-row').length;
/* jsdom saknar Blob.text() – läs via FileReader i stället. */
const blobText=blob=>new Promise((resolve,reject)=>{
 const reader=new w.FileReader();
 reader.onload=()=>resolve(String(reader.result??''));
 reader.onerror=()=>reject(new Error('bloben kunde inte läsas'));
 reader.readAsText(blob);
});
function setFile(input,text,name='msgFilterRules.dat'){
 Object.defineProperty(input,'files',{value:[new w.File([text],name,{type:'text/plain'})],configurable:true});
 fire(input,'change');
}
const filterFile=(...rules)=>['version="9"','logging="no"',...rules,''].join('\r\n');
const tbRule=(name,uri,condition)=>[`name="${name}"`,'enabled="yes"','type="17"','action="Move to folder"',`actionValue="${uri}"`,`condition="${condition}"`].join('\r\n');

(async()=>{
 await until(()=>rows()>0,'gränssnittet laddas med demon');
 check(true,'gränssnittet laddas utan skriptfel');

 /* --- En uppgift per flik; navigering får aldrig spara eller kasta utkast. --- */
 check(!el('rulesLibrary').hidden&&el('ruleEditor').hidden,'starten visar bara regellistan, inte en tom editor');
 check(doc.querySelectorAll('.app-tabs [role="tab"]').length===6,'sex namngivna flikar i stället för en ikonmeny');
 check(el('quickRuleBox').closest('.view')===el('view-suggestions')&&el('quickChips').closest('.view')===el('view-suggestions'),'snabbregel och Inkorgschips hör bara till Föreslagna regler');
 check(el('learnBar').closest('.view')===el('view-suggestions')&&el('templateBar').closest('.view')===el('view-suggestions'),'inlärda förslag och mallar har samma egna flik');
 check(el('quickHintsBtn')?.closest('.view')===el('view-suggestions'),'Läs Inkorgen igen finns kvar som riktig knapp');
 check(el('countMoved').closest('.view')===el('view-activity')&&el('whyBtn').closest('.view')===el('view-activity'),'statistik och felsökning finns i Aktivitet');
 check(el('introCard').closest('.view')===el('view-help')&&el('setupSteps').closest('.view')===el('view-help'),'introduktion och kom-igång-steg visas bara i Hjälp');
 check(doc.querySelectorAll('.settings-section').length===5&&doc.querySelectorAll('.settings-section[open]').length===1,'Inställningar börjar med fem grupper och bara Utseende öppet');
 const navigationConfig=JSON.stringify(w.LasDemo.setState({}).config),navigationRule=w.LasDemo.setState({}).config.rules[0].id;
 doc.querySelector('.rule-open').click();
 check(el('rulesLibrary').hidden&&!el('ruleEditor').hidden,'redigering ersätter listan i stället för att trängas bredvid');
 el('ruleName').value='Osparat flikutkast åäö';fire(el('ruleName'),'input');
 const navigationCondition=el('conditions').firstElementChild;
 const navigationDraft=w.eval('JSON.stringify(draft())');
 for(const view of ['suggestions','activity','settings','help','support','rules']){
  el('tab-'+view).click();
  check(!el('view-'+view).hidden&&[...doc.querySelectorAll('.view')].filter(n=>!n.hidden).length===1,'endast rätt panel syns: '+view);
  check(el('tab-'+view).getAttribute('aria-selected')==='true'&&doc.querySelectorAll('.app-tabs [aria-selected="true"]').length===1,'entydigt vald flik: '+view);
  check(!el('pause').closest('[hidden]')&&!el('mode').closest('[hidden]')&&!el('runTitle').closest('[hidden]'),'paus, flyttläge och status tillgängliga i '+view);
 }
 check(w.eval('JSON.stringify(draft())')===navigationDraft&&w.eval('dirty'),'alla flikbyten bevarar osparat utkast');
 check(el('conditions').firstElementChild===navigationCondition,'flikbyte bygger inte om villkorsraderna');
 el('backToRules').click();check(!el('rulesLibrary').hidden&&el('ruleEditor').hidden&&!el('resumeEditor').hidden,'Alla regler visar listan med Fortsätt redigera');
 check(doc.activeElement===el('resumeEditor'),'fokus hamnar på en synlig kontroll efter Tillbaka');
 el('resumeEditor').click();check(el('ruleName').value==='Osparat flikutkast åäö'&&doc.activeElement===el('ruleName'),'fortsatt redigering behåller utkast och placerar fokus');
 const navigationConfirm=w.confirm;let navigationPrompts=0;
 w.confirm=()=>{navigationPrompts++;return false;};
 el('tab-suggestions').click();
 let navigationWrites=0;const navigationRequest=w.LasDemo.request.bind(w.LasDemo);
 w.LasDemo.request=async message=>{if(['quickRule','learnCreate','importConditions','catchUp','saveRules'].includes(message.type))navigationWrites++;return navigationRequest(message);};
 el('quickAddBtn').click();await sleep(30);
 check(navigationPrompts===1&&navigationWrites===0,'ny snabbregel frågar först; avbryt skickar ingen skrivning eller flytt');
 el('quickExisting').value=navigationRule;fire(el('quickExisting'),'change');el('quickAddRunBtn').click();await sleep(30);
 check(navigationPrompts===2&&navigationWrites===0,'lägg till i befintlig regel och kör respekterar avbrutet utkastbyte');
 const navigationLearn=w.LasDemo.setState({}).learn;
 w.LasDemo.setState({learn:{off:false,suggestions:[{key:'tab-test',domain:'tab.example',target:'demo-fin',count:3}]}});await w.refresh();
 el('learnBar').querySelector('.primary').click();await sleep(30);
 check(navigationPrompts===3&&navigationWrites===0,'även inlärda förslag skyddar utkastet i en annan flik');
 w.LasDemo.setState({learn:navigationLearn});w.LasDemo.request=navigationRequest;w.confirm=navigationConfirm;
 el('quickExisting').value='';fire(el('quickExisting'),'change');await w.refresh();
 check(w.eval('JSON.stringify(draft())')===navigationDraft&&w.eval('dirty'),'avbrutna förslag har inte ändrat editorn');
 check(JSON.stringify(w.LasDemo.setState({}).config)===navigationConfig,'navigering och avbrutna förslag ändrar aldrig sparade regler');
 el('tab-rules').focus();el('tab-rules').dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
 check(doc.activeElement===el('tab-suggestions')&&!el('view-suggestions').hidden,'högerpil väljer nästa flik och flyttar fokus');
 doc.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:'End',bubbles:true}));check(doc.activeElement===el('tab-support'),'End väljer sista fliken');
 doc.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));check(doc.activeElement===el('tab-rules'),'piltangenter sveper runt från sista till första fliken');
 doc.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));check(doc.activeElement===el('tab-support'),'vänsterpil sveper runt till sista fliken');
 doc.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Home',bubbles:true}));check(doc.activeElement===el('tab-rules'),'Home väljer första fliken');
 w.eval('applyLanguage("en")');check(txt('tab-suggestions').includes('Suggested rules')&&txt('tab-settings').trim().includes('Settings'),'de nya flikarna översätts till engelska');
 check(w.eval('JSON.stringify(draft())')===navigationDraft,'språkbyte behåller utkastet');
 w.eval('applyLanguage("sv");dirty=false;loadRule(state.config.rules[0].id,"",{openEditor:false});setRulePanel("list");editorVisited=false;$("resumeEditor").hidden=true;showView("rules");');
 await w.refresh();

 /* --- Sidfoten: versionen ska komma från manifestet, inte från ui.html --- */
 await until(()=>/v9\.9\.9/.test(doc.querySelector('[data-i18n="versionText"]')?.textContent||''),'sidfoten visar manifestets version');
 check(/v9\.9\.9/.test(doc.querySelector('[data-i18n="versionText"]')?.textContent||''),'sidfoten visar manifestets version, inte texten i ui.html');
 check(!/v1\.0\./.test(doc.querySelector('[data-i18n="versionText"]')?.textContent||''),'ingen gammal version kvar i sidfoten');

 /* --- Ritningen: bara det som ändrats ska ritas om --- */
 /* Statusen kommer högst var hundrade millisekund under ett svep. Byggdes listorna
    om varje gång kostade det mer än svepet – och scrollen hoppade. */
 const firstRow=()=>doc.querySelector('#ruleList .rule-row');
 const rowBefore=firstRow();
 check(rowBefore!==null,'regellistan har rader att jämföra');
 w.eval('renderStatus(state)');
 check(firstRow()===rowBefore,'regellistan ritas inte om när inget har ändrats');
 const logFirst=doc.querySelector('#logRows tr');
 const logCount=doc.querySelectorAll('#logRows tr').length;
 w.eval("state.logs=[...state.logs,{time:new Date().toISOString(),event:'moved',level:'info',data:{count:1,detail:'rittestet'}}];renderStatus(state);");
 check(doc.querySelectorAll('#logRows tr').length===logCount+1,'den nya loggraden läggs till');
 check(doc.querySelector('#logRows tr')!==logFirst,'den nya raden hamnar överst');
 check(logFirst.parentNode!==null,'de gamla raderna behålls i stället för att byggas om');
 check(/rittestet/.test(doc.querySelector('#logRows tr').textContent),'den nya raden syns');

 /* Statusen får inte skickas iväg tiotal gånger i sekunden: högst en i taget. */
 let calls=0;
 const demo=w.LasDemo;
 const realRequest=demo.request.bind(demo);
 w.LasDemo.request=async msg=>{if(msg&&msg.type==='status')calls++;return realRequest(msg);};
 await Promise.all([w.refresh(),w.refresh(),w.refresh(),w.refresh()]);
 w.LasDemo.request=realRequest;
 check(calls<=2,'flera statusändringar ger högst en förfrågan i taget (blev '+calls+')');
 check(calls>=1,'men minst en förfrågan görs');

 /* --- 🔍 Varför ligger det här mejlet här? --- */
 check(el('whyBtn')!==null,'det finns en knapp för uppslaget');
 check(el('whyPanel')!==null&&el('whyPanel').hidden===true,'panelen är tyst innan man frågar');
 el('whyBtn').click();
 await until(()=>el('whyPanel').hidden===false&&/Varför ligger mejlet här/.test(el('whyPanel').textContent),'uppslaget svarar',false,6000);
 const whyText=()=>el('whyPanel').textContent;
 check(/Varför ligger mejlet här\?/.test(whyText()),'panelen har en rubrik');
 check(/faktura@fortnox\.se|fiktivt testmeddelande/.test(whyText()),'den visar vilket mejl det gäller: "'+whyText().slice(0,110)+'…"');
 check(/Fortnox fakturor/.test(whyText()),'den namnger regeln som gäller');
 check(/skulle flytta mejlet till|ligger i målmappen|ligger redan/.test(whyText()),'och säger vad som händer med mejlet');
 check(!/undefined|\{name\}|\{subject\}/.test(whyText()),'inga ofyllda platshållare');
 check(doc.querySelector('.why-all')!==null,'alla prövade regler går att fälla ut');
 check(/Uppslaget läser bara mejlets huvuden/.test(whyText()),'och panelen lovar att ingenting ändras');

 /* --- ⚠ Konfliktvarning: två regler som kan matcha samma mejl --- */
 /* Spara demots egna regler före bytet – setState returnerar samma objekt, så en
    kopia måste tas först. */
 const originalConfig=JSON.parse(JSON.stringify(w.LasDemo.setState({}).config));
 const conflictRules=[
  {id:'k1',name:'Krock ett',enabled:true,scope:'folder',source:'demo-in',sourceAccount:'',target:'demo-fin',match:'all',readFilter:'both',unreadAction:'keep',yearFolders:false,branches:[],conditions:[{field:'domain',op:'equals',value:'fortnox.se'}]},
  {id:'k2',name:'Krock två',enabled:true,scope:'folder',source:'demo-in',sourceAccount:'',target:'demo-arkiv',match:'all',readFilter:'both',unreadAction:'keep',yearFolders:false,branches:[],conditions:[{field:'domain',op:'equals',value:'fortnox.se'}]}
 ];
 w.LasDemo.setState({config:{...originalConfig,rules:conflictRules}});
 el('pause').click();
 await until(()=>/Kan krocka med/.test(el('ruleList').textContent),'konflikten syns i regellistan',false,6000);
 const conflictNotes=[...doc.querySelectorAll('.rule-conflict')].map(n=>n.textContent);
 check(conflictNotes.length===2,'båda reglerna får en varning ('+conflictNotes.length+')');
 check([...doc.querySelectorAll('.rule-conflict')].every(n=>!n.open&&/Överlapp/.test(n.querySelector('summary').textContent)),'korta varningsrader syns även när förklaringen är hopfälld');
 check(/Krock två/.test(conflictNotes[0])&&/Krock ett/.test(conflictNotes[1]),'varningen pekar på den andra regeln');
 check(/Domän/i.test(conflictNotes[0]),'och namnger fältet som kan krocka: "'+conflictNotes[0].slice(0,110)+'"');
 check(/ligger först och vinner/.test(conflictNotes[0]),'den första regeln säger att den vinner');
 check(/Flytta upp den här/.test(conflictNotes[1]),'den andra säger hur man ändrar ordningen');
 check(!/undefined|\{name\}|\{fields\}/.test(conflictNotes.join(' ')),'inga ofyllda platshållare');
 /* Tillbaka till demots egna regler så att resten av kontrollerna ser dem. */
 w.LasDemo.setState({config:originalConfig});
 el('pause').click();

 /* --- ⚡ Snabbregeln: förslag, live-räkning, ett klick --- */
 await until(()=>doc.querySelectorAll('#quickChips .quick-chip').length>0,'Inkorgen läses för förslag');
 const chips=[...doc.querySelectorAll('#quickChips .quick-chip')];
 check(chips.length>=3,'förslag visas som klickbara knappar ('+chips.length+')');
 check(chips.some(c=>/klarna\.se/.test(c.textContent))&&chips.some(c=>/wordfence/i.test(c.textContent)),'både avsändare och ämnesord föreslås');
 check(doc.querySelectorAll('#quickChips .quick-chip-count').length===chips.length,'varje förslag visar hur många mejl det gäller');
 const klarna=chips.find(c=>/klarna\.se/.test(c.textContent));
 klarna.click();
 await until(()=>/klarna\.se/.test(el('quickValue').value),'klicket fyller fältet');
 check(el('quickField').value==='domain','klick på avsändare väljer avsändardomän');
 check(/mejl från klarna\.se/.test(txt('quickSentence')),'meningen säger vad regeln gör: "'+txt('quickSentence')+'"');
 await until(()=>/\d+ mejl i .+ matchar just nu/.test(txt('quickCount')),'live-räkningen visar antal',false,6000);
 await until(()=>/Mejl|mejl/.test(txt('quickCount')),'räkningen har en läsbar text');
 check(el('quickSentence').textContent.length>10,'meningen är en hel mening');

 /* Snabbregeln skapar en regel och flyttar direkt */
 const beforeQuick=rows();
 el('quickTarget').value='demo-web';
 fire(el('quickTarget'),'change');
 el('quickAddBtn').click();
 await until(()=>rows()===beforeQuick+1,'snabbregeln skapar en regel');
 check(rows()===beforeQuick+1,'ny regel från snabbregeln ('+beforeQuick+' → '+rows()+')');
 check(/skapades|listan/i.test(txt('toast')),'snabbregeln kvitterar: "'+txt('toast')+'"');

 /* --- Räknaren säger sanningen: rätt konto, olästa och taket --- */
 el('quickTarget').value='demo-web';
 fire(el('quickTarget'),'change');
 el('quickField').value='domain';
 el('quickValue').value='klarna.se';fire(el('quickValue'),'input');
 await until(()=>/matchar/.test(txt('quickCount')),'räkningen svarar för det valda kontot',false,6000);
 check(/3 mejl i Exempelkonto matchar/.test(txt('quickCount')),'räknaren säger vilket konto siffran gäller: "'+txt('quickCount')+'"');
 el('quickMoveUnread').checked=false;fire(el('quickMoveUnread'),'change');
 await until(()=>/olästa/.test(txt('quickCount')),'kryssrutan uppdaterar siffran direkt',false,6000);
 check(/2 av 3 flyttas nu – 1 olästa väntar/.test(txt('quickCount')),'räknaren säger hur många som flyttas och varför: "'+txt('quickCount')+'"');
 check(/quick-count-warn/.test(el('quickCount').className),'siffran varnar i stället för att ljuga ('+el('quickCount').className+')');
 el('quickMoveUnread').checked=true;fire(el('quickMoveUnread'),'change');
 await until(()=>/3 mejl i Exempelkonto/.test(txt('quickCount')),'och tillbaka när kryssrutan slås på igen',false,6000);
 check(/quick-count-ok/.test(el('quickCount').className),'olästa får följa med igen: "'+txt('quickCount')+'"');
 check(/räknat på de 400 senaste mejlen/.test(txt('quickCount')),'taket redovisas i stället för att siffran låtsas vara hela Inkorgen: "'+txt('quickCount')+'"');

 /* --- Fler förslag, ledtrådar och ✕ --- */
 const moreBtn=doc.querySelector('#quickChips .quick-chip-more');
 check(!!moreBtn,'fler än åtta avsändare ligger bakom "visa fler": "'+(moreBtn?.textContent||'')+'"');
 const chipsBeforeMore=doc.querySelectorAll('#quickChips .quick-chip').length;
 if(moreBtn){
  moreBtn.click();
  await until(()=>doc.querySelectorAll('#quickChips .quick-chip').length>chipsBeforeMore,'fler förslag ritas när man ber om dem');
  check(doc.querySelectorAll('#quickChips .quick-chip').length>chipsBeforeMore,'fler förslag ritas ('+chipsBeforeMore+' → '+doc.querySelectorAll('#quickChips .quick-chip').length+')');
  check(/visa färre/.test(doc.querySelector('#quickChips .quick-chip-more')?.textContent||''),'knappen byter till "visa färre"');
 }
 const firstChip=doc.querySelector('#quickChips .quick-chip');
 check(/adress|ämne/i.test(firstChip?.title||''),'förslaget bär en ledtråd: "'+(firstChip?.title||'')+'"');
 const hideBtn=doc.querySelector('#quickChips .quick-chip-hide');
 const chipsBeforeHide=doc.querySelectorAll('#quickChips .quick-chip').length;
 check(!!hideBtn,'varje förslag har ett ✕');
 if(hideBtn){
  hideBtn.click();
  await until(()=>doc.querySelectorAll('#quickChips .quick-chip').length===chipsBeforeHide-1,'✕ döljer ett förslag');
  check(doc.querySelectorAll('#quickChips .quick-chip').length===chipsBeforeHide-1,'det dolda förslaget försvinner direkt ('+chipsBeforeHide+' → '+(chipsBeforeHide-1)+')');
  check(!!doc.querySelector('#quickChips .quick-hint-unhide'),'och det går att få tillbaka det');
  doc.querySelector('#quickChips .quick-hint-unhide').click();
  await until(()=>doc.querySelectorAll('#quickChips .quick-chip').length===chipsBeforeHide,'dolda förslag kommer tillbaka');
  check(doc.querySelectorAll('#quickChips .quick-chip').length===chipsBeforeHide,'dolda förslag kommer tillbaka ('+doc.querySelectorAll('#quickChips .quick-chip').length+')');
 }

 /* --- Esc rensar och målmappen minns --- */
 el('quickValue').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
 await until(()=>el('quickValue').value==='','Esc rensar fältet');
 check(el('quickValue').value==='','Esc tömmer fältet man skrev i');
 await until(()=>el('quickCount').hidden===true,'räkningen städas bort när fältet är tomt');
 check(el('quickCount').hidden===true,'ingen gammal siffra ligger kvar');
 el('quickTarget').value='demo-buy';fire(el('quickTarget'),'change');
 await sleep(120);
 el('langEn').click();
 await until(()=>el('quickTarget').value==='demo-buy','snabbregeln minns målmappen du använde sist',false,6000);
 check(el('quickTarget').value==='demo-buy','målmappen är förvald nästa gång: "'+el('quickTarget').value+'"');
 check(txt('copyright')==='© Rickard Längkvist','copyright visas oförändrad på engelska');
 el('langSv').click();
 await until(()=>/Skapa regel|Lägg till/.test(el('quickAddBtn').textContent),'språket tillbaka till svenska');
 check(txt('copyright')==='© Rickard Längkvist','copyright visas på svenska');
 check(doc.querySelector('footer #copyright')!==null,'copyright ligger i appens gemensamma sidfot');

 /* --- Regelredigeraren: villkor, diagnos, test --- */
 await until(()=>/klarna|Webb/.test(el('ruleName').value),'regeln är öppen i redigeraren');
 check(el('source')&&el('source').options.length>1,'källmappen är vald');
 el('test').click();
 await until(()=>!el('testResult').hidden,'testläget svarar');
 check(/öppet|matchar|Testläge|test/i.test(txt('testResult')),'testresultatet förklarar sig: "'+txt('testResult').slice(0,60)+'"');
 el('diagnoseBtn').click();
 await until(()=>!el('diagnosePanel').hidden,'diagnosen ritas');
 check(/Varför|flyttas|mapp/i.test(txt('diagnosePanel')),'diagnosen svarar i klartext: "'+txt('diagnosePanel').slice(0,70)+'"');

 /* --- Förslagskortet och kör-knappen --- */
 check(el('suggestCard')===null&&el('suggestRulesBtn')===null,'förslagskortet är borta ur gränssnittet');
 check(!/Föreslå regler från Inkorgen/.test(doc.body.textContent),'och ingen text om det ligger kvar');
 el('runAllRulesBtn').click();
 await until(()=>/Granskade/.test(txt('toast')),'kör alla regler');
 check(/matchade och köades/.test(txt('toast')),'körningen rapporterar vad som hände: "'+txt('toast')+'"');
 check(!/Kontrollen är klar/.test(txt('toast')),'ingen dubblerad rapporttext');

 /* --- Sökning i regellistan --- */
 el('ruleSearch').value='Fortnox';fire(el('ruleSearch'),'input');
 await until(()=>rows()>=1,'sökning i regellistan');
 check(rows()>=1,'regellistan går att söka i');

 /* --- 🔁 Thunderbirds egna filter: läs in msgFilterRules.dat --- */
 el('ruleSearch').value='';fire(el('ruleSearch'),'input');
 await sleep(150);
 check(el('tbFilterCard')!==null,'kortet för Thunderbird-filter finns i Regler-vyn');
 check(el('tbAccount').options.length>=1,'kontolistan fylls i');
 const importFile=filterFile(
  tbRule('Fakturor från Fortnox','imap://demo%40exempel.se@imap.exempel.se/Fakturor','AND (from,contains,faktura@fortnox.se)'),
  tbRule('Wordfence','imap://demo%40exempel.se@imap.exempel.se/Webb','OR (from,contains,wordpress@limoeurope.com) OR (subject,contains,Wordfence)'),
  tbRule('Kvitton i mejltexten','imap://demo%40exempel.se@imap.exempel.se/Arkiv','AND (body,contains,kvitto)'),
  tbRule('Okänd mapp','imap://demo%40exempel.se@imap.exempel.se/Finns-Inte','AND (subject,contains,Reseräkning)'));
 const beforeImport=rows();
 setFile(el('tbImportFile'),importFile);
 await until(()=>!el('tbImportReview').hidden,'filterfilen läses in');
 check(!el('tbImportReview').hidden,'granskningslistan visas efter import');
 const tbRows=[...doc.querySelectorAll('#tbImportReview .tb-row')];
 check(tbRows.length===4,'alla fyra filter i filen listas ('+tbRows.length+')');
 check(tbRows.filter(r=>!r.classList.contains('tb-row-off')).length===3,'tre av filtren kan bli regler');
 const offRow=tbRows.find(r=>r.classList.contains('tb-row-off'));
 check(/body/i.test(offRow.querySelector('.tb-row-notes')?.textContent||''),'body-filtret förklaras i klartext: "'+(offRow.querySelector('.tb-row-notes')?.textContent||'')+'"');
 check(tbRows.every(r=>r.querySelector('select')),'varje filter får välja målmapp');
 check(!el('tbImportReview').textContent.includes('undefined'),'inga tomma texter i granskningslistan');
 check(!el('tbImportReview').textContent.includes('{'),'inga ofyllda platshållare i listan');
 const noTargetRow=tbRows.find(r=>/Finns-Inte/.test(r.textContent));
 check(noTargetRow&&noTargetRow.querySelector('input[type=checkbox]').checked===false,'filter utan matchad mapp är inte förbockat');
 check(noTargetRow&&/Finns-Inte/.test(noTargetRow.querySelector('.tb-row-notes')?.textContent||''),'raden säger vilken mapp filtret ville ha: "'+(noTargetRow?.querySelector('.tb-row-notes')?.textContent||'')+'"');
 check(el('tbUriPrefix').value.startsWith('imap://'),'kontots adress lärs in från filen: "'+el('tbUriPrefix').value+'"');
 const createBtn=[...el('tbImportReview').querySelectorAll('button')].pop();
 check(/Skapa 2 regler/.test(createBtn.textContent),'knappen räknar bara de val som har en målmapp: "'+createBtn.textContent+'"');
 createBtn.click();
 await until(()=>/Nya regler från filterfilen/.test(txt('toast')),'reglerna skapas');
 check(/Nya regler från filterfilen: 2\./.test(txt('toast')),'importen rapporterar antalet: "'+txt('toast')+'"');
 await until(()=>rows()===beforeImport+2,'reglerna syns i listan');
 check(rows()===beforeImport+2,'två nya regler i listan');
 check(el('tbImportReview').hidden,'granskningslistan stängs efter import');
 check(/Fakturor från Fortnox/.test(doc.body.textContent),'den importerade regeln syns med sitt namn');
 check(/imap\.exempel\.se/.test(el('tbUriPrefix').value),'adressen ligger kvar i fältet efter importen');

 /* --- Ett filter som inte går att spara får inte fälla de andra --- */
 const partialFile=filterFile(
  ['name=""','enabled="yes"','type="17"','action="Move to folder"','actionValue="imap://demo%40exempel.se@imap.exempel.se/Webb"','condition="AND (from,contains,namnlos@x.se)"'].join('\r\n'),
  tbRule('Bra filter','imap://demo%40exempel.se@imap.exempel.se/Arkiv','AND (subject,contains,Kvitto)'));
 const beforePartial=rows();
 setFile(el('tbImportFile'),partialFile);
 await until(()=>!el('tbImportReview').hidden,'det namnlösa filtret granskas');
 const partialBtn=[...el('tbImportReview').querySelectorAll('button')].pop();
 check(/Skapa 2 regler/.test(partialBtn.textContent),'båda raderna är förbockade: "'+partialBtn.textContent+'"');
 partialBtn.click();
 await until(()=>/kunde inte sparas/.test(txt('toast')),'delvis import rapporteras');
 check(/Klarade: 1/.test(txt('toast')),'den som gick att spara blev en regel: "'+txt('toast')+'"');
 check(/kunde inte sparas: 1/.test(txt('toast')),'och den andra rapporteras: "'+txt('toast')+'"');
 await until(()=>rows()===beforePartial+1,'bara den fungerande regeln skapas');
 check(rows()===beforePartial+1,'en regel skapades, inte noll och inte två');
 check(!el('tbImportReview').hidden,'den felande raden ligger kvar i listan');
 check(/Kunde inte sparas:/.test(el('tbImportReview').textContent),'raden förklarar varför: "'+el('tbImportReview').textContent.slice(0,140)+'"');
 check([...el('tbImportReview').querySelectorAll('button:not(:disabled)')].length===0,'ingen aktiv knapp som försöker igen med samma felande rad');

 /* --- Fler villkor än SortBro har plats med --- */
const BS=String.fromCharCode(92);
const plainName='Elva villkor C:'+BS+'mapp';
const fileSafeName='Elva villkor C:'+BS+BS+'mapp';
 const manyTerms=[];
 for(let i=1;i<=11;i++)manyTerms.push('(from,contains,avsandare'+i+'@x.se)');
 setFile(el('tbImportFile'),filterFile(tbRule(fileSafeName,'imap://demo%40exempel.se@imap.exempel.se/Inköp','OR '+manyTerms.join(' OR '))));
 await until(()=>/Elva villkor/.test(el('tbImportReview').textContent),'elva villkor granskas');
 check(!/Kunde inte sparas/.test(el('tbImportReview').textContent),'en ny fil ersätter den gamla listan helt');
 const manyRow=doc.querySelector('#tbImportReview .tb-row');
 check(/3 villkor fick inte plats/.test(manyRow.textContent),'överskottet redovisas i klartext: "'+(manyRow.querySelector('.tb-row-notes')?.textContent||'').slice(0,90)+'"');
 check(!manyRow.classList.contains('tb-row-off'),'regeln är fortfarande importerbar');
 const beforeMany=rows();
 [...el('tbImportReview').querySelectorAll('button')].pop().click();
 await until(()=>rows()===beforeMany+1,'regeln med åtta villkor sparas');
 check(rows()===beforeMany+1,'en regel skapades av elva villkor');
 check(/Nya regler från filterfilen: 1\./.test(txt('toast')),'importen lyckades: "'+txt('toast')+'"');

 /* --- Export: filen Thunderbird ska kunna läsa --- */
 let blob=null;
 w.URL.createObjectURL=b=>{blob=b;return 'blob:x';};
 el('tbExportBtn').click();
 await until(()=>/Filterfilen sparades/.test(txt('toast')),'exporten sparar en fil');
 check(/msgFilterRules.dat/.test(txt('toast')),'filen får rätt namn: "'+txt('toast')+'"');
 const exported=blob?await blobText(blob):'';
 check(exported.startsWith('version="9"'),'filen börjar med rätt huvud');
 check(/^logging="no"/m.test(exported),'loggningsraden är med');
 check(exported.split('\r\n').length>4,'filen har flera rader');
 check(/name="Fakturor från Fortnox"/.test(exported),'den importerade regeln skrivs ut i filen');
 check(/condition="OR \(from,contains,wordpress@limoeurope\.com\) OR \(subject,contains,Wordfence\)"/.test(exported),'ELLER-regeln behåller sina villkor');
 check(!/Kvitton i mejltexten/.test(exported),'filtret SortBro inte kan matcha exporteras inte tillbaka');
 check(!/undefined/.test(exported),'ingen rad innehåller undefined');
 check(!/^name=""/m.test(exported),'ingen regel skrivs med tomt namn');
 const nameLines=exported.trim().split('\r\n').filter(l=>/^name="/.test(l));
 const condLines=exported.trim().split('\r\n').filter(l=>/^condition="/.test(l));
 const valueLines=exported.trim().split('\r\n').filter(l=>/^actionValue="/.test(l));
 check(nameLines.length===condLines.length&&condLines.length===valueLines.length,'varje regel har namn, mål och villkor ('+nameLines.length+')');
 check(nameLines.every(l=>/^name="[^"]*"$/.test(l)),'alla namnrader är hela och avslutade');
 check(condLines.every(l=>/^condition="(AND|OR) \(/.test(l)),'alla villkorsrader börjar med AND/OR och en parentes');
 check(condLines.every(l=>/\)"$/.test(l)),'alla villkorsrader slutar med en parentes och citattecken');
 check(exported.includes('name="'+fileSafeName+'"'),'ett snedstreck i namnet skrivs escaparat: '+(nameLines.find(l=>/Elva villkor/.test(l))||'(saknas)'));
 check(!exported.includes('name="'+plainName+'"'),'och namnet skrivs aldrig med ett ensamt snedstreck');
 check(/Thunderbird/.test(el('tbReport').textContent),'rapporten förklarar var filen ska läggas: "'+el('tbReport').textContent.slice(0,90)+'…"');

 /* --- Exporten kan läsas tillbaka av vår egen tolk (rundtur via gränssnittet) --- */
 const beforeRound=rows();
 setFile(el('tbImportFile'),exported);
 await until(()=>!el('tbImportReview').hidden,'den egna filen kan läsas in igen');
 const roundRows=[...doc.querySelectorAll('#tbImportReview .tb-row')];
 check(roundRows.length===nameLines.length,'lika många regler kommer tillbaka ('+roundRows.length+' av '+nameLines.length+')');
 check(roundRows.every(r=>!r.classList.contains('tb-row-off')),'alla kan importeras tillbaka');
 check(roundRows.some(r=>/Fakturor från Fortnox/.test(r.textContent)),'namnen kommer tillbaka');
 check(!el('tbImportReview').textContent.includes('undefined'),'inga tomma texter i den återlästa listan');
 const roundBtn=[...el('tbImportReview').querySelectorAll('button')].pop();
 roundBtn.click();
 await until(()=>/Nya regler från filterfilen/.test(txt('toast')),'rundturen skapar regler');
 await until(()=>rows()===beforeRound+nameLines.length,'rundturens regler syns');
 check(rows()===beforeRound+nameLines.length,'rundturen gav lika många regler som filen hade');

 /* --- Kontoadressen: skräp avvisas, en riktig sparas --- */
 let lastBlob=blob;
 el('tbUriPrefix').value='hej/Ekonomi';
 fire(el('tbUriPrefix'),'change');
 el('tbExportBtn').click();
 await until(()=>/imap:\/\/|mailbox:\/\//.test(txt('toast')),'skräp avvisas');
 check(/imap:\/\/|mailbox:\/\//.test(txt('toast')),'en påhittad adress ger ett begripligt fel: "'+txt('toast')+'"');
 check(blob===lastBlob,'ingen fil skrivs med en påhittad adress');
 el('tbUriPrefix').value='imap://demo%40exempel.se@imap.exempel.se/';
 fire(el('tbUriPrefix'),'change');
 el('tbExportBtn').click();
 await until(()=>/Filterfilen sparades/.test(txt('toast')),'exporten går igenom med riktig adress');
 const manual=blob!==lastBlob?await blobText(blob):'';
 check(manual.includes('actionValue="imap://demo%40exempel.se@imap.exempel.se/'),'den inklistrade adressen hamnar i filen: '+(manual.split('\r\n').find(l=>l.startsWith('actionValue'))||'(saknas)'));
 check(!/undefined/.test(manual),'ingen rad innehåller undefined efter handpåläggning');

 /* --- Filerna hamnar i undermappar till appmappen --- */
 const noteEl=doc.querySelector('[data-i18n="storageNote"]');
 const note=noteEl?.textContent||'';
 check(/Hämtade filer\/Lasfilter/.test(note),'mappraden i Avancerat pekar ut appmappen: "'+note.slice(0,90)+'…"');
 check(/logs/.test(note)&&/Regelbackuper/.test(note)&&/Regler/.test(note)&&/Filterfiler/.test(note),'alla fyra undermappar nämns');
 check(/Inget hamnar löst/.test(note),'och den lovar att inget hamnar utanför');
 check(/logs\/lasfilter-logg\.txt/.test(el('fileLog').closest('label').textContent),'loggrutan pekar på logs-mappen: "'+el('fileLog').closest('label').textContent.trim()+'"');
 el('export').click();
 await until(()=>/exporterades till/.test(txt('toast')),'exporten kvitteras med sökväg');
 check(/Lasfilter\/Regler\/sortbro-regler-\d{4}-\d{2}-\d{2}\.json/.test(txt('toast')),'regelfilen hamnar i Regler-mappen: "'+txt('toast')+'"');
 el('exportLog').click();
 await until(()=>/Loggen exporterades/.test(txt('toast')),'loggexporten kvitteras');
 check(/Lasfilter\/logs\/sortbro-tekniklogg-\d{4}-\d{2}-\d{2}\.json/.test(txt('toast')),'loggfilen hamnar i logs-mappen: "'+txt('toast')+'"');
 check(/Spara samlad fellogg/.test(txt('exportErrorLog')),'knappen för samlad fellogg finns');
 el('exportErrorLog').click();
 await until(()=>/Lasfilter\/logs\/sortbro-fellogg\.txt/.test(txt('toast')),'felloggen kvitteras med sin sökväg');
 const errorsText=await blobText(blob);
 check(/SORTBRO – SAMLAD FELLOGG/.test(errorsText),'felloggen är läsbar text, inte JSON');
 check(/Antal felposter:/.test(errorsText),'rapporten visar hur många fel som sparats');
 check(!/\tmoved\t/.test(errorsText),'vanliga flyttar följer inte med i felloggen');
 check(/sortbro-fellogg\.txt/.test(doc.querySelector('[data-i18n="fileLogNote"]').textContent),'inställningen förklarar den extra filen');
 el('langEn').click();
 await until(()=>/Save combined error log/.test(txt('exportErrorLog')),'felloggsknappen översätts till engelska');
 check(/last 30 days/.test(doc.querySelector('[data-i18n="fileLogNote"]').textContent),'även historikgränsen är översatt');
 el('langSv').click();
 await until(()=>/Spara samlad fellogg/.test(txt('exportErrorLog')),'tillbaka till svenska');
 el('tbExportBtn').click();
 await until(()=>/Filterfilen sparades/.test(txt('toast')),'filterexporten kvitteras');
 check(/Lasfilter\/Filterfiler\/msgFilterRules\.dat/.test(txt('toast')),'filterfilen hamnar i Filterfiler-mappen: "'+txt('toast')+'"');
 check(/Filterfiler/.test(txt('tbReport'))&&/ImapMail/.test(txt('tbReport')),'rapporten säger både var filen ligger och vart den ska');

 /* --- ⇩ Säkerhetskopia: veckovis automatiskt + manuell knapp --- */
 check(el('backupStatus')!==null,'det finns en rad som visar när veckokopian skrevs');
 await until(()=>/2026-W42/.test(txt('backupStatus')),'veckan visas i klartext',false,6000);
 check(/Senaste veckokopian skrevs: 2026-W42/.test(txt('backupStatus')),'raden säger vilken vecka: "'+txt('backupStatus')+'"');
 const backupNote=[...doc.querySelectorAll('[data-i18n="autoBackupNote"]')].map(n=>n.textContent).join(' ');
 check(/en gång i veckan/.test(backupNote),'texten säger att kopian tas en gång i veckan: "'+backupNote.slice(0,120)+'…"');
 check(/12 veckor/.test(backupNote),'och hur många veckor som behålls');
 check(el('backupNow')!==null,'knappen för manuell säkerhetskopia finns');
 check(/Backa upp reglerna nu/.test(el('backupNow').textContent),'och den säger vad den gör: "'+el('backupNow').textContent.trim()+'"');

 /* --- ⇩ Automatisk säkerhetskopia: rutan och knappen --- */
 check(el('autoBackup')!==null,'rutan för automatisk säkerhetskopia finns');
 check(el('autoBackup').checked===true,'den är på som standard');
 check(!el('backupNow').disabled,'knappen Backa upp nu går att trycka på');
 el('backupNow').click();
 await until(()=>/backades upp/.test(txt('toast')),'knappen backar upp');
 check(/Regelbackuper\/sortbro-regler-backup\.json/.test(txt('toast')),'kvittot visar hela sökvägen: "'+txt('toast')+'"');
 check(/Lasfilter\/Regelbackuper\/sortbro-regler-backup\.json/.test(txt('backupInfo')),'sökvägen visas bredvid knappen, i backupernas egen mapp: "'+txt('backupInfo')+'"');
 const autoBackupOn=el('autoBackup').checked;
 el('autoBackup').click();
 await until(()=>/Automatisk säkerhetskopia avstängd/.test(txt('toast')),'avstängningen kvitteras');
 check(/avstängd/.test(txt('toast')),'kvittot säger att den är av: "'+txt('toast')+'"');
 el('autoBackup').click();
 await until(()=>/backas upp automatiskt/.test(txt('toast')),'påslaget kvitteras');
 check(el('autoBackup').checked===autoBackupOn,'rutan går att slå av och på igen');
 check(/Kopian ligger utanför/.test(doc.body.textContent),'hjälpraden förklarar var kopian ligger');

 /* --- Språkbytet --- */
 const tbTitle=()=>doc.querySelector('[data-i18n="tbFilterTitle"]')?.textContent||'';
 el('langEn').click();
 await until(()=>/Thunderbird's own filters/.test(tbTitle()),'kortet översätts');
 check(/Thunderbird's own filters/.test(tbTitle()),'kortets rubrik finns på engelska: "'+tbTitle()+'"');
 check(/Import filter file/.test(el('tbImportFile').closest('label').textContent),'knapparna översätts: "'+el('tbImportFile').closest('label').textContent.trim()+'"');
 check(doc.querySelectorAll('[data-i18n]').length>0,'texterna är kopplade till ordboken');
 el('langSv').click();
 await until(()=>/Thunderbirds egna filter/.test(tbTitle()),'svenskan kommer tillbaka');
 check(/Thunderbirds egna filter/.test(tbTitle()),'tillbaka på svenska');

 /* --- ⚠ Installationen: tillägget avinstallerar sig inte, men kan stängas av --- */
 const pausedNow=()=>el('pause').textContent;
 /* --- Säkerhetsbromsen: raden som kräver ett svar --- */
 check(el('brakeWarns')!==null,'det finns en rad för säkerhetsbromsen');
 check(el('brakeWarns').hidden===true,'den är tyst när ingen regel är stoppad');
 check(el('brake')!==null&&el('brake').checked===true,'säkerhetsbromsen är på som standard');
 el('brake').checked=false;fire(el('brake'),'change');
 await until(()=>/Säkerhetsbromsen är av/.test(txt('toast')),'avstängd broms kvitteras',false,6000);
 check(w.LasDemo.setState({}).config.brake===false,'inställningen sparades när rutan kryssades ur');
 el('brake').checked=true;fire(el('brake'),'change');
 await until(()=>/Säkerhetsbromsen är på/.test(txt('toast')),'påslagen broms kvitteras',false,6000);
 check(w.LasDemo.setState({}).config.brake===true,'och när den kryssades i igen');
 w.LasDemo.setState({brakeHolds:[{ruleId:'demo-1',matched:837,limit:50,median:5,at:Date.now(),name:'Fortnox fakturor',target:'demo-fin'}]});
 el('pause').click();
 await until(()=>el('brakeWarns').hidden===false,'stoppad regel syns',false,6000);
 check(/Säkerhetsbromsen stoppade en regel/.test(el('brakeWarns').textContent),'rubriken säger att bromsen slog till');
 check(/Fortnox fakturor/.test(el('brakeWarns').textContent),'regelns namn står där: "'+el('brakeWarns').textContent.slice(0,120)+'…"');
 check(/837/.test(el('brakeWarns').textContent)&&/50/.test(el('brakeWarns').textContent),'antalet och gränsen syns');
 check(/brukar flytta 5/.test(el('brakeWarns').textContent),'och vad regeln brukar göra');
 check(!/undefined|\{n\}|\{median\}/.test(el('brakeWarns').textContent),'inga ofyllda platshållare');
 const brakeBtns=[...el('brakeWarns').querySelectorAll('button')];
 check(brakeBtns.length===3,'tre svar: flytta ändå, stäng av eller ta bort');
 check(/Flytta ändå/.test(brakeBtns[0].textContent)&&/Stäng av regeln/.test(brakeBtns[1].textContent),'knapparna säger vad de gör');
 check(/Ta bort regeln/.test(brakeBtns[2].textContent),'den tredje knappen tar bort regeln');

 /* Ta bort frågar en gång till. Säger man nej händer ingenting alls. */
 let asked='';
 const realConfirm=w.confirm;
 w.confirm=(text)=>{asked=text;return false;};
 brakeBtns[2].click();
 await until(()=>asked.length>0,'borttagningen frågar först',false,6000);
 check(/Fortnox fakturor/.test(asked),'frågan nämner regeln vid namn');
 check(/[Rr]egelkopior/.test(asked),'och var den går att få tillbaka');
 check(/Ta bort regeln\?/.test(asked),'och vad knappen gör');
 check(el('brakeWarns').hidden===false,'ett nej lämnar varningen kvar');
 check(w.LasDemo.setState({}).brakeHolds.length===1,'och regeln finns kvar');
 w.confirm=realConfirm;

 brakeBtns[0].click();
 await until(()=>el('brakeWarns').hidden===true,'svaret tar bort raden',false,6000);
 check(el('brakeWarns').hidden===true,'ingen stoppad regel kvar efter svaret');
 check(!/Säkerhetsbromsen stoppade/.test(el('brakeWarns').textContent),'raden är tom efter svaret');

 /* Cache-kortet: reglaget speglar konfigurationen och knappen tömmer cachen. */
 check(el('autoClear')!==null,'det finns ett reglage för automatisk cache-rensning');
 check(el('autoClear').checked===true,'det är på som standard');
 check(el('clearCacheNow')!==null,'det finns en knapp för att rensa cachen nu');
 check(typeof el('cacheStatus').textContent==='string','det finns en rad som säger när cachen senast tömdes');
 w.LasDemo.setState({cache:{on:true,at:Date.now()-3*86400000,day:''}});
 el('pause').click();
 await until(()=>/3 dagar sedan/.test(el('cacheStatus').textContent),'statusraden räknar dagar sedan senaste rensning',false,6000);
 check(/Senast rensad för 3 dagar sedan/.test(el('cacheStatus').textContent),'i klartext: "'+el('cacheStatus').textContent+'"');
 el('clearCacheNow').click();
 await until(()=>/i dag/.test(el('cacheStatus').textContent),'knappen rensar och raden uppdateras',false,6000);
 check(/i dag \d{2}:\d{2}/.test(el('cacheStatus').textContent),'med klockslag: "'+el('cacheStatus').textContent+'"');
 check(/rensad: \d+ mappar/.test(el('toast')?.textContent||''),'kvittot säger hur många mappar som läses om: "'+(el('toast')?.textContent||'')+'"');
 el('autoClear').checked=false;fire(el('autoClear'),'change');
 await until(()=>w.LasDemo.setState({}).config.autoClear===false,'reglaget sparas av',false,6000);
 /* Vänta på att gränssnittet hunnit rita om – demodata ändras direkt, texten ett steg senare. */
 await until(()=>/avstängd/.test(el('cacheStatus').textContent),'statusraden säger att automatiken är av',false,6000);
 check(/avstängd/.test(el('cacheStatus').textContent),'i klartext: "'+el('cacheStatus').textContent+'"');
 el('autoClear').checked=true;fire(el('autoClear'),'change');
 await until(()=>w.LasDemo.setState({}).config.autoClear===true,'och på igen',false,6000);

 check(el('installWarn')!==null,'det finns en varningsrad för installationen');
 check(el('installWarn').hidden===true,'den är tyst när installationen är permanent');
 w.LasDemo.setState({installType:'development'});
 el('pause').click();
 await until(()=>el('installWarn').hidden===false,'tillfällig installation varnar',false,6000);
 check(/Tillfällig installation/.test(txt('installWarnTitle')),'rubriken säger att den är tillfällig: "'+txt('installWarnTitle')+'"');
 check(/avinstallerar sig/.test(txt('installWarnText')),'texten säger att det inte är SortBro som avinstallerar sig');
 check(/Installera tillägg från fil/.test(txt('installWarnText')),'och hur man gör det permanent');
 check(/Regelbackuper/.test(txt('installWarnText')),'och att reglerna finns kvar');
 check(!/undefined|\{/.test(txt('installWarnText')),'inga ofyllda platshållare i texten');
 w.LasDemo.setState({installType:'sideload'});
 el('pause').click();
 await until(()=>/Sidoladdad/.test(txt('installWarnTitle')),'sidoladdad installation får sin egen text',false,6000);
 check(/Sidoladdad installation/.test(txt('installWarnTitle')),'rubriken skiljer sidoladdad från tillfällig: "'+txt('installWarnTitle')+'"');
 check(/profilmapp/.test(txt('installWarnText')),'texten förklarar varför Thunderbird kan stänga av den');
 check(/Regelbackuper/.test(txt('installWarnText')),'och att reglerna finns kvar');
 el('installWarnHide').click();
 await until(()=>el('installWarn').hidden===true,'✕ döljer varningen');
 check(el('installWarn').hidden===true,'varningen går att dölja');
 w.LasDemo.setState({installType:'normal'});
 el('pause').click();
 await until(()=>/Starta|Pausa/.test(pausedNow()),'demo tillbaka i normalläge');

 /* ── Provkörning per regel ─────────────────────────────────────────────── */
 const trialCfg={...originalConfig,rules:originalConfig.rules.map((r,i)=>i===0?{...r,trialUntil:Date.now()+3*86400000}:r)};
 w.LasDemo.setState({config:trialCfg,trials:[{ruleId:originalConfig.rules[0].id,name:originalConfig.rules[0].name,left:3,until:Date.now()+3*86400000,active:true,count:5,target:originalConfig.rules[0].target}],learn:{off:false,suggestions:[]}});
 el('pause').click();
 await until(()=>doc.querySelectorAll('.trial-tag').length>0,'provkörningen märks i regellistan');
 check(/TEST/.test(doc.querySelector('.trial-tag')?.textContent||''),'märket säger TEST');
 check(/3 dagar kvar/.test(doc.querySelector('.trial-tag')?.textContent||''),'och hur många dagar som är kvar');
 check(el('trialBar').hidden===true,'en pågående provkörning ger ingen rad');

 w.LasDemo.setState({config:originalConfig,trials:[{ruleId:'demo-1',name:'Fortnox fakturor',left:0,until:Date.now()-1000,active:false,count:34,target:'demo-fin'}]});
 el('pause').click();
 await until(()=>el('trialBar').hidden===false,'en utgången provkörning visas');
 check(/34/.test(txt('trialBar')),'antalet mejl som skulle ha flyttats syns');
 check(!/undefined|\{n\}/.test(txt('trialBar')),'inga ofyllda platshållare');
 const trialBtns=[...el('trialBar').querySelectorAll('button')];
 check(trialBtns.length===3,'tre val: aktivera, förläng eller stäng av');
 check(/Aktivera/.test(trialBtns[0].textContent),'första knappen aktiverar regeln');
 check(/Förläng/.test(trialBtns[1].textContent),'andra förlänger provkörningen');
 trialBtns[2].click();
 await until(()=>el('trialBar').hidden===true,'svaret tar bort raden');
 check(el('trialBar').hidden===true,'ingen provkörning kvar efter svaret');

 /* ── Lär av din flytt ──────────────────────────────────────────────────── */
 w.LasDemo.setState({trials:[],learn:{off:false,suggestions:[{key:'klarna.se|demo-fin',domain:'klarna.se',source:'demo-in',target:'demo-fin',count:3,first:Date.now(),last:Date.now()}]}});
 el('pause').click();
 await until(()=>el('learnBar').hidden===false,'ett inlärt förslag visas');
 check(/klarna\.se/.test(txt('learnBar')),'domänen syns');
 check(/Fakturor/.test(txt('learnBar')),'mappens namn syns i stället för id:t');
 check(!/demo-fin/.test(txt('learnBar')),'inget mapp-id läcker ut');
 check(!/undefined|\{n\}|\{domain\}/.test(txt('learnBar')),'inga ofyllda platshållare');
 const rulesBefore=rows();
 const learnBtns=[...el('learnBar').querySelectorAll('button')];
 check(learnBtns.some(b=>/Skapa regel/.test(b.textContent)),'förslaget kan bli en regel');
 check(learnBtns.some(b=>/Sluta föreslå/.test(b.textContent)),'och funktionen kan stängas av');
 learnBtns.find(b=>/Skapa regel/.test(b.textContent)).click();
 await until(()=>rows()===rulesBefore+1,'regeln skapas av förslaget');
 check(el('learnBar').hidden===true,'förslaget försvinner när regeln finns');

 /* ── Fönstervalet vid regelskapning ────────────────────────────────────── */
 w.LasDemo.setState({config:originalConfig,learn:{off:false,suggestions:[]}});
 el('pause').click();
 el('newRule').click();
 await sleep(80);
 check(el('ruleTrial')!==null,'provkörning kan väljas när regeln skapas');
 check(el('ruleMoveUnread').checked===false,'ny regel väntar på lästa mejl som standard');
 check(el('ruleOpenWindow').disabled===true,'fönstervalet är dött när olästa mejl inte flyttas');
 check(el('unreadChoiceNote').classList.contains('muted-out'),'och förklaringen tonas ned');
 el('ruleMoveUnread').checked=true;
 fire(el('ruleMoveUnread'),'change');
 await sleep(50);
 check(el('ruleOpenWindow').disabled===false,'fönstervalet går att göra när olästa flyttas');
 check(!el('unreadChoiceNote').classList.contains('muted-out'),'och förklaringen syns igen');
 check(/efter flytten/i.test(doc.querySelector('[data-i18n="ruleOpenWindowLabel"]')?.textContent||''),'rutan säger att fönstret kommer efter flytten');

 /* ── Kompakta regler och menyn för sparade regler ─────────────────────── */
 w.LasDemo.setState({config:{...w.LasCore.defaults(),dryRun:true,paused:false,rules:[
  {...conflictRules[0],id:'menu-1',name:'Fortnox fakturor',target:'demo-fin',enabled:true},
  {...conflictRules[1],id:'menu-2',name:'Webbsupport',target:'demo-web',enabled:true,conditions:[{field:'domain',op:'equals',value:'support.example'}]},
  {...conflictRules[0],id:'menu-3',name:'Arkivera äldre',target:'demo-arkiv',enabled:true,conditions:[{field:'date',op:'older',value:'90'}]}
 ]},fault:'',trials:[],learn:{off:false,suggestions:[]}});
 w.eval("dirty=false;selectedId='';$('ruleSearch').value='';repaint();");
 await w.refresh();
 const ruleRows=()=>[...doc.querySelectorAll('#ruleList .rule-row')];
 const saved=()=>w.LasDemo.setState({}).config.rules;
 const byId=id=>ruleRows().find(row=>row.dataset.ruleId===id);
 const menuFor=id=>byId(id).querySelector('.rule-menu-toggle');
 const actionFor=(id,key)=>byId(id).querySelector('[data-action="'+key+'"]');
 const ids=saved().map(r=>r.id);
 check(ruleRows().every(row=>row.querySelector('.rule-menu-panel').hidden),'regelmenyerna är stängda från början');
 check(ruleRows().every(row=>!row.querySelector('.rule-details').open),'långa detaljer är hopfällda');
 check(byId(ids[0]).querySelector('.rule-target').textContent.includes('Fakturor'),'kompakt rad visar målmapp');
 check(byId(ids[0]).querySelector('.rule-status').textContent==='På','aktiverad regel har textstatus');
 check(byId(ids[0]).querySelector('.rule-order').textContent==='Prioritet 1','ordningen syns');
 check(!byId(ids[0]).querySelector('.rule-main').textContent.includes('fortnox.se'),'villkorstexten ligger inte i sammanfattningen');
 menuFor(ids[0]).click();
 check(menuFor(ids[0]).getAttribute('aria-expanded')==='true','menyknappen beskriver öppet läge');
 check(!byId(ids[0]).querySelector('.rule-menu-panel').hidden,'menyn visar sina åtgärder');
 check(byId(ids[0]).querySelectorAll('.rule-action').length===7,'sju namngivna åtgärder per regel');
 check(actionFor(ids[0],'ruleUp').disabled,'första regeln kan inte flyttas upp');
 check(actionFor(ids[2],'ruleDown').disabled,'sista regeln kan inte flyttas ned');
 menuFor(ids[1]).click();
 check(byId(ids[0]).querySelector('.rule-menu-panel').hidden,'bara en meny är öppen åt gången');
 doc.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
 check(byId(ids[1]).querySelector('.rule-menu-panel').hidden,'Escape stänger menyn');
 check(doc.activeElement===menuFor(ids[1]),'Escape återlämnar fokus till menyknappen');
 menuFor(ids[0]).click();el('ruleSearch').click();
 check(byId(ids[0]).querySelector('.rule-menu-panel').hidden,'klick utanför stänger menyn');
 menuFor(ids[0]).click();byId(ids[0]).querySelector('.rule-details summary').click();
 check(byId(ids[0]).querySelector('.rule-details').open,'detaljerna går att fälla ut');
 check(byId(ids[0]).querySelector('.rule-details-body').textContent.includes('fortnox.se'),'villkoren finns kvar under detaljer');
 check(byId(ids[0]).querySelectorAll('.rule-inline-opts input').length===2,'oläst- och fönstervalen finns kvar');
 w.eval("state.fault='storage_error';renderStatus(state);");
 check(actionFor(ids[0],'ruleRun').disabled,'nytt motorfel spärrar körknappen utan regeländring');
 w.eval("state.fault='';renderStatus(state);");
 check(!actionFor(ids[0],'ruleRun').disabled,'rensat fel uppdaterar knappen');
 /* Att pausa ska ändra körknappen även utan ändringar i reglerna. */
 el('pause').click();await until(()=>actionFor(ids[0],'ruleRun').disabled,'paus spärrar menyns körknapp');
 check(actionFor(ids[0],'ruleRun').disabled,'körknappen spärras när bevakningen är pausad');
 el('pause').click();await until(()=>!actionFor(ids[0],'ruleRun').disabled,'återupptagning frigör körknappen');
 let called=[];const menuRequest=w.LasDemo.request;
 w.LasDemo.request=async m=>{called.push(m);return menuRequest(m);};
 menuFor(ids[1]).click();actionFor(ids[1],'ruleRun').click();
 await until(()=>called.some(m=>m.type==='catchUp'),'kör från menyn skickar ett uppdrag');
 check(called.find(m=>m.type==='catchUp').ruleId===ids[1],'kör rätt regel, inte den i editorn');
 await until(()=>!actionFor(ids[1],'ruleRun').disabled,'körknappen återaktiveras');
 w.LasDemo.request=menuRequest;
 /* Export från menyn använder den sparade regeln, aldrig ett annat utkast. */
 byId(ids[0]).querySelector('.rule-open').click();
 el('ruleName').value='OSPARAT UTKAST';fire(el('ruleName'),'input');
 const priorBlob=blob;
 menuFor(ids[1]).click();actionFor(ids[1],'ruleExport').click();
 await until(()=>blob!==priorBlob,'menyexporten skapar fil');
 const exportedRule=JSON.parse(await blobText(blob));
 check(exportedRule.rules.length===1&&exportedRule.rules[0].id===ids[1],'menyexporten innehåller exakt rätt sparade regel');
 check(el('ruleName').value==='OSPARAT UTKAST','exporten rör inte utkastet');
 w.confirm=()=>false;
 menuFor(ids[1]).click();actionFor(ids[1],'ruleEdit').click();
 check(el('ruleName').value==='OSPARAT UTKAST','nej till att kasta utkast hindrar byte');
 actionFor(ids[1],'ruleCopy').click();
 check(el('ruleName').value==='OSPARAT UTKAST','duplicering skyddar också osparade ändringar');
 const unreadToggle=byId(ids[1]).querySelector('.rule-inline-opts input');
 const oldUnread=unreadToggle.checked;unreadToggle.checked=!oldUnread;fire(unreadToggle,'change');
 check(unreadToggle.checked===oldUnread,'ändring av olästval kan avbrytas när utkast finns');
 w.confirm=()=>true;w.eval('dirty=false;');
 /* Ordning ändras i hela listan, även när bara en sökträff visas. */
 el('ruleSearch').value=saved()[1].name;fire(el('ruleSearch'),'input');
 await until(()=>rows()===1,'sök fram en regel före omordning');
 menuFor(ids[1]).click();actionFor(ids[1],'ruleUp').click();
 await until(()=>saved()[0].id===ids[1],'flytta upp rätt regel från en filtrerad lista');
 check(saved()[0].id===ids[1]&&saved()[1].id===ids[0],'sökningen ändrar inte prioriteringslogiken');
 el('ruleSearch').value='';fire(el('ruleSearch'),'input');await until(()=>rows()===3,'hela listan återkommer');
 /* Menyns duplicering skapar bara ett utkast. */
 menuFor(ids[1]).click();actionFor(ids[1],'ruleCopy').click();
 check(saved().length===3,'duplicering aktiverar inte en ny regel automatiskt');
 check(/kopia/i.test(el('ruleName').value),'kopian öppnas som ett redigerbart utkast');
 w.eval('dirty=false;');
 let confirmation='';w.confirm=text=>{confirmation=text;return false;};
 menuFor(ids[2]).click();actionFor(ids[2],'ruleDelete').click();
 await sleep(30);
 check(saved().length===3,'nej till borttagning behåller regeln');
 check(confirmation.includes(saved().find(r=>r.id===ids[2]).name),'borttagning namnger rätt regel');
 w.confirm=()=>true;actionFor(ids[2],'ruleDelete').click();
 await until(()=>saved().length===2&&rows()===2,'godkänd borttagning tar bort regeln');
 await until(()=>w.eval('dirty===false'),'borttagningen har uppdaterat editorn');
 check(!saved().some(r=>r.id===ids[2]),'bara den valda regeln tas bort');
 el('langEn').click();await until(()=>/Actions for/.test(menuFor(ids[1]).getAttribute('aria-label')),'menyetiketten översätts');
 check(actionFor(ids[1],'ruleDelete').textContent==='Delete…','menyvalen finns på engelska');
 check(byId(ids[1]).querySelector('.rule-details summary').textContent==='Details & settings','detaljvalet finns på engelska');
 el('langSv').click();await until(()=>/Åtgärder för/.test(menuFor(ids[1]).getAttribute('aria-label')),'svenska tillbaka');
 w.confirm=()=>true;

 /* ── Valda förbättringar: sökning, läsbarhet, ordning och dialog ────────── */
 el('ruleSearch').value='support.example';fire(el('ruleSearch'),'input');
 await until(()=>rows()===1,'sökning hittar regel via villkoret');
 check(ruleRows()[0].dataset.ruleId===ids[1],'villkorssökning väljer rätt regel');
 el('ruleSearch').value='Ekonomi';fire(el('ruleSearch'),'input');
 await until(()=>rows()===1&&ruleRows()[0].dataset.ruleId===ids[0],'sökning hittar målmappens sökväg');
 check(ruleRows()[0].dataset.ruleId===ids[0],'målsökning väljer rätt regel');
 el('ruleSearch').value='fortnox fakturor';fire(el('ruleSearch'),'input');
 await until(()=>rows()===1,'flera ord kan matcha olika delar av regeln');
 el('ruleSearch').value='';fire(el('ruleSearch'),'input');await until(()=>rows()===2,'sökningen återställd');
 const priorityBefore=saved().map(r=>r.id).join(',');let orderQuestion='';
 w.confirm=text=>{orderQuestion=text;return false;};
 menuFor(ids[0]).click();actionFor(ids[0],'ruleUp').click();
 await until(()=>!!orderQuestion,'ordningen måste godkännas');
 check(/Fortnox fakturor/.test(orderQuestion)&&/Webbsupport/.test(orderQuestion),'förhandsvisningen namnger båda berörda reglerna');
 check(/2 → 1/.test(orderQuestion)&&/1 → 2/.test(orderQuestion),'förhandsvisningen visar gamla och nya positioner');
 check(saved().map(r=>r.id).join(',')===priorityBefore,'avbruten omordning ändrar ingenting');
 w.confirm=()=>true;
 byId(ids[0]).querySelector('.rule-open').click();el('up').click();
 await until(()=>saved()[0].id===ids[0]&&rows()===2,'editorns prioritetsknapp använder samma omordning');
 check(saved()[0].id===ids[0],'godkänd ändring genomförs från editorn');
 await until(()=>/prioritet 1/.test(txt('toast')),'omordningen kvitteras med ny position');

 el('introToggle').click();await until(()=>el('introCopy').hidden,'introduktionen kan döljas');
 check(el('setupSteps').hidden&&el('seasonHeroArt').hidden,'även kom-igång-stegen och bilden döljs');
 check(el('introToggle').getAttribute('aria-expanded')==='false','dold introduktion har rätt tillgänglighetsstatus');
 check(!el('pause').closest('[hidden]')&&!el('mode').closest('[hidden]'),'paus och flyttläge är alltid åtkomliga');
 await w.refresh();check(el('introCopy').hidden,'dold introduktion bevaras vid statusuppdatering');
 el('introToggle').click();await until(()=>!el('introCopy').hidden,'introduktionen kan visas igen');
 check(!el('setupSteps').hidden,'kom-igång-stegen återkommer');
 doc.querySelector('[data-view="settings"]').click();
 const baseSize=doc.documentElement.style.getPropertyValue('--base');
 el('density').value='compact';fire(el('density'),'change');
 await until(()=>doc.documentElement.dataset.density==='compact','kompakt layout aktiveras');
 check(doc.documentElement.style.getPropertyValue('--base')===baseSize,'kompakt layout minskar inte textstorleken');
 el('fontSize').value='24';fire(el('fontSize'),'change');
 await until(()=>doc.documentElement.style.getPropertyValue('--base')==='24px','24 pixlars grundtext kan väljas');
 check(doc.documentElement.dataset.largeText==='true','stor text aktiverar omflöde');
 el('lineSpacing').value='roomy';fire(el('lineSpacing'),'change');
 await until(()=>doc.documentElement.dataset.lineSpacing==='roomy','luftigare radavstånd aktiveras');
 await w.refresh();
 check(el('fontSize').value==='24'&&el('density').value==='compact'&&el('lineSpacing').value==='roomy','utseendeval finns kvar efter uppdatering');
 el('fontSize').value='14';fire(el('fontSize'),'change');
 el('density').value='comfortable';fire(el('density'),'change');
 el('lineSpacing').value='normal';fire(el('lineSpacing'),'change');
 await until(()=>doc.documentElement.dataset.largeText==='false'&&doc.documentElement.dataset.density==='comfortable'&&doc.documentElement.dataset.lineSpacing==='normal','normal layout återställd');

 doc.querySelector('[data-view="rules"]').click();
 el('newFolderBtn').focus();el('newFolderBtn').click();
 check(!el('folderModal').hidden&&doc.activeElement===el('folderName'),'dialogen sätter fokus på mappnamnet');
 check(doc.querySelector('.shell').inert===true,'bakgrunden är inaktiv medan dialogen är öppen');
 el('folderCancelBtn').focus();el('folderCancelBtn').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));
 check(doc.activeElement===el('folderParentAccount'),'Tab från sista kontrollen går till första');
 el('folderParentAccount').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true}));
 check(doc.activeElement===el('folderCancelBtn'),'Shift+Tab från första går till sista');
 el('folderName').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
 check(el('folderModal').hidden&&doc.activeElement===el('newFolderBtn'),'Escape stänger dialogen och lämnar tillbaka fokus');
 check(doc.querySelector('.shell').inert===false,'bakgrunden blir aktiv igen');
 el('quickNewFolderBtn').focus();el('quickNewFolderBtn').click();el('folderCancelBtn').click();
 check(el('folderModal').hidden&&doc.activeElement===el('quickNewFolderBtn'),'Avbryt återgår till rätt öppningsknapp');
 el('newFolderBtn').focus();el('newFolderBtn').click();el('folderModal').click();
 check(el('folderModal').hidden&&doc.activeElement===el('newFolderBtn'),'bakgrundsklick återställer också fokus');

 /* Både statiska och dynamiskt skapade etiketter följer språkbytet. */
 el('addCondition').click();el('addBranch').click();
 el('langEn').click();await until(()=>doc.documentElement.lang==='en','byt till engelska för tillgänglighetskontroll');
 check(el('conditions').querySelector('select').getAttribute('aria-label')==='Condition field','dynamiska villkor får engelsk etikett');
 check(el('branches').querySelector('select').getAttribute('aria-label')==='Branch field','dynamiska fördelningar får engelsk etikett');
 check(el('conditions').querySelector('.remove-condition').getAttribute('aria-label')==='Remove condition','ikonknappen får ett begripligt engelskt namn');
 check(doc.querySelector('nav').getAttribute('aria-label')==='Main menu','statiska tillgänglighetsetiketter översätts');
 const unnamed=[...doc.querySelectorAll('button')].filter(n=>!(n.getAttribute('aria-label')||n.getAttribute('aria-labelledby')||n.textContent.trim()||n.title));
 check(unnamed.length===0,'alla knappar i testvyn har ett tillgängligt namn');
 check(el('logRows').querySelector('.numeric-value')!==null,'loggtider och antal markeras för tabellsiffror');
 check(el('logRows').querySelector('.technical-value')!==null,'tekniska loggvärden skiljs från brödtext');
 el('langSv').click();await until(()=>doc.documentElement.lang==='sv','tillbaka till svenska');
 w.eval('dirty=false;');

 /* Konto före mapp: separata konton, Unicode-sökning och oförändrade sparade ID:n. */
 w.eval(`folders.push(
  {id:'second-year',accountId:'second',accountName:'Björns konto',accountEmail:'björn@example.se',name:'Årsöversikt',path:'/Bokföring/Årsöversikt/Beställningar från leverantörer',label:'Björns konto · /Bokföring/Årsöversikt/Beställningar från leverantörer'},
  {id:'second-buy',accountId:'second',accountName:'Björns konto',name:'Inköp',path:'/Inköp',label:'Björns konto · /Inköp'});`);
 const pickerRule={id:'picker-rule',name:'Årsöversikt',enabled:true,scope:'account',source:'demo-in',sourceAccount:'demo',target:'second-year',match:'all',readFilter:'read',conditions:[{field:'subject',op:'contains',value:'Wordfence'},{field:'subject',op:'contains',value:'Faktura'},{field:'sender',op:'contains',value:'faktura@'}],branches:[]};
 const pickerState=w.LasDemo.setState({});
 w.LasDemo.setState({config:{...pickerState.config,paused:true,dryRun:true,rules:[pickerRule],revision:pickerState.config.revision+1}});
 await w.refresh();w.loadRule('picker-rule');
 check(el('targetAccount').value==='second'&&el('target').value==='second-year','sparad målmapp återställer rätt konto även vid flytt mellan konton');
 check(el('source').value==='demo','källkontot ändras inte av målkontot');
 check([...el('target').options].filter(o=>o.value).every(o=>o.value.startsWith('second-')),'mappvalet innehåller bara valt kontos mappar');
 check(/björn@example.se/.test(el('targetAccount').selectedOptions[0].textContent),'e-postadress visas tillsammans med kontonamnet');
 check(txt('targetPath').includes('Bokföring › Årsöversikt › Beställningar från leverantörer'),'hela den valda sökvägen visas separat');
 el('targetBrowse').click();
 el('folderTreeSearch').value='åRSÖVERSIKT'.normalize('NFD');fire(el('folderTreeSearch'),'input');
 check(!!el('folderTree').querySelector('[data-key="folder:second-year"]')&&!el('folderTree').querySelector('[data-key="folder:second-buy"]')&&el('target').value==='second-year','svensk mappsökning hittar kombinerade tecken utan att tappa valt ID');
 check(w.eval('dirty')===false,'mappsökning ändrar inte regeln eller osparat-läget');
 el('folderTreeSearch').value='finns-inte';fire(el('folderTreeSearch'),'input');
 check(el('target').value==='second-year','sökfilter får aldrig kasta bort en befintlig målmapp');
 el('folderTreeSearch').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
 check(doc.activeElement===el('folderTree'),'Enter vid tom sökträff går till trädet utan att spara regeln');
 el('folderTreeCancel').click();
 el('targetAccount').value='demo';fire(el('targetAccount'),'change');
 check(el('target').value==='','kontobyte tömmer mappvalet utan att välja första mappen');
 check([...el('target').options].some(o=>o.value==='demo-buy')&&![...el('target').options].some(o=>o.value==='second-buy'),'lika mappnamn i andra konton blandas inte');
 check(w.eval('dirty')===true,'ändrat målkonto gör utkastet osparat');
 w.folderPicker(el('target'),'removed-folder',{reset:true});
 check(el('target').value==='removed-folder'&&/saknas/.test(txt('targetPath')),'en saknad sparad mapp visas som saknad och byts inte ut');
 w.folderPicker(el('target'),'',{reset:true});
 check(el('target').disabled&&!el('targetAccount').disabled,'mappval väntar på kontoval');
 el('targetAccount').value='second';fire(el('targetAccount'),'change');
 el('targetBrowse').click();
 el('folderTreeSearch').value='ej-en-mapp';fire(el('folderTreeSearch'),'input');
 check(el('target').value===''&&/Inga mappar/.test(txt('folderTreeStatus')),'tom sökträff får tydlig text och ingen påhittad målmapp');
 el('folderTreeCancel').click();
 w.loadRule('picker-rule');
 el('langEn').click();await until(()=>doc.documentElement.lang==='en','mappväljaren byter till engelska');
 check(el('targetAccount').value==='second'&&el('target').value==='second-year','språkbyte bevarar destinationen');
 check(/Destination email account/.test(el('targetAccount').closest('label').textContent),'kontosteget översätts');
 el('langSv').click();await until(()=>doc.documentElement.lang==='sv','mappväljaren tillbaka på svenska');
 el('addBranch').click();
 const branch=el('branches').lastElementChild,branchAccount=branch.querySelector('.folder-account select'),branchTarget=branch.querySelector('.folder-choice');
 branchAccount.value='second';fire(branchAccount,'change');branchTarget.value='second-buy';fire(branchTarget,'change');branch.children[2].value='Årsrapport';
 check(w.draft().branches[0].target==='second-buy','fördelningar sparar riktigt mapp-ID genom konto-först-väljaren');
 w.folderPicker(el('quickTarget'),'second-buy');fire(el('quickTarget'),'change');
 el('quickNewFolderBtn').click();
 check(el('folderParentAccount').value==='second','snabbregelns nya mapp använder målkontot, inte källkontot');
 el('folderCancelBtn').click();
 el('quickTargetAccount').value='demo';fire(el('quickTargetAccount'),'change');
 w.targetOptions(el('target').value);
 check(el('quickTarget').value===''&&el('quickTargetAccount').value==='demo','uppdatering återställer inte senast använda mapp efter avsiktligt kontobyte');
 el('langEn').click();await until(()=>doc.documentElement.lang==='en','språkbyte med tömd snabbmapp');
 check(el('quickTarget').value===''&&el('quickTargetAccount').value==='demo','inte heller språkbyte återställer gammal snabbmapp');
 el('langSv').click();await until(()=>doc.documentElement.lang==='sv','åter till svenska');
 el('quickFetchBtn').click();await until(()=>/Hämtat|hämtat/.test(txt('toast')),'hämta markerat mejl till tom snabbmapp');
 check(el('quickTarget').value===''&&el('quickTargetAccount').value==='demo','hämta mejl väljer bara konto – aldrig en gissad målmapp');
 w.loadRule('picker-rule');el('test').click();await until(()=>!el('testResult').hidden,'regeltest med blandade träffar');
 check(el('testResult').querySelectorAll('.condition-pass').length===2&&el('testResult').querySelectorAll('.condition-fail').length===1,'regeltestet visar två träffar och ett missat villkor');
 check(/Wordfence/.test(el('testResult').querySelector('.condition-fail')?.textContent||''),'exakt villkoret Wordfence visas som missat');
 check(/pausad/.test(txt('testResult'))&&/Testläge/.test(txt('testResult')),'paus och testläge redovisas utan falskt löfte om flytt');
 check(el('match').value==='all'&&w.LasDemo.setState({}).config.rules[0].match==='all','diagnosen ändrar inte OCH till ELLER');
 el('match').value='any';fire(el('match'),'change');
 check(/Minst ett villkor/.test(txt('matchHelp')),'ELLER-läget förklarar att ett villkor räcker');
 el('langEn').click();await until(()=>doc.documentElement.lang==='en','testa engelsk villkorsdiagnos');
 el('test').click();await until(()=>/Does not match/.test(txt('testResult')),'villkorsresultat på engelska');
 check(/Does not match.*Wordfence/.test(txt('testResult')),'även villkorsdiagnosen översätts');
 el('langSv').click();await until(()=>doc.documentElement.lang==='sv','åter till svenska efter diagnos');

 /* Äldre svensk filterfil går genom samma byte-avkodning som Thunderbird-importen. */
 el('tbAccount').value='demo';
 const swedishFilter=filterFile(tbRule('Åsa – Ändringar','imap://u@h.se/Okand','AND (subject,contains,Årsöversikt)')).replace('–','-');
 setFile(el('tbImportFile'),Buffer.from(swedishFilter,'latin1'));
 await until(()=>el('tbImportReview').textContent.includes('Åsa'),'Windows-1252-fil importerad');
 check(/Årsöversikt/.test(txt('tbImportReview'))&&!/�/.test(txt('tbImportReview')),'åäö bevaras även i äldre svensk filterfil');
 const importRow=el('tbImportReview').querySelector('.tb-row'),importAccount=importRow.querySelector('.folder-account select'),importTarget=importRow.querySelector('.folder-choice');
 check(!!importAccount&&importTarget.disabled,'importgranskningen använder också konto före mapp');
 importAccount.value='second';fire(importAccount,'change');importTarget.value='second-buy';fire(importTarget,'change');
 check(w.eval('tbImport.filters[0].target')==='second-buy','importen behåller ett uttryckligen valt mål i annat konto');

 /* Ny mapp i snabbflödet ska inte skriva över regelutkastets målmapp. */
 const mainBeforeFolder=el('target').value;
 el('quickNewFolderBtn').click();el('folderName').value='Årsrapport';el('folderCreateBtn').click();
 await until(()=>el('folderModal').hidden,'ny svensk mapp skapad');
 check(el('quickTarget').selectedOptions[0]?.textContent==='Årsrapport','ny mapp väljs med sitt riktiga ID');
 check(el('target').value===mainBeforeFolder,'snabbflödets nya mapp ändrar inte huvudregelns destination');
 w.eval('dirty=false;');

 /* Nya regler använder ELLER; sparade regler behåller uttryckligt OCH. */
 w.loadRule();
 check(el('match').value==='any','ny regel börjar med minst ett villkor, inte alla');
 check(/minst ett villkor ska stämma – inte alla/.test(doc.querySelector('[data-i18n="step2Help"]').textContent),'steg 2 förklarar standardvalet på svenska');
 el('ruleName').value='Något av villkoren';w.folderPicker(el('target'),'demo-web');
 const firstCondition=el('conditions').firstElementChild;
 firstCondition.children[0].value='subject';fire(firstCondition.children[0],'change');firstCondition.children[2].value='Wordfence';
 el('addCondition').click();el('conditions').lastElementChild.children[2].value='Faktura';
 check(w.draft().match==='any'&&w.draft().conditions.length===2,'fler villkor behåller ELLER i utkastet');
 el('langEn').click();await until(()=>doc.documentElement.lang==='en','engelskt standardval');
 check(el('match').value==='any'&&/at least one condition is met/.test(doc.querySelector('[data-i18n="step2Help"]').textContent),'språkbyte behåller ELLER och förklarar det på engelska');
 el('test').click();await until(()=>!el('testResult').hidden,'testa ny regel med bara ett matchande villkor');
 check(el('testResult').querySelectorAll('.condition-pass').length===1&&el('testResult').querySelectorAll('.condition-fail').length===1&&/Conditions match/.test(txt('testResult')),'en enda träff räcker även när det andra villkoret inte stämmer');
 await w.saveCurrentRule({});
 const savedAny=w.LasDemo.setState({}).config.rules.find(r=>r.name==='Något av villkoren');
 check(savedAny?.match==='any','ELLER sparas och finns kvar när regeln öppnas igen');
 w.loadRule(savedAny.id);check(el('match').value==='any','sparad ELLER-regel återställs som ELLER');
 w.loadRule('picker-rule');check(el('match').value==='all','befintlig OCH-regel ändras inte av det nya standardvalet');
 el('langSv').click();await until(()=>doc.documentElement.lang==='sv','svenska efter standardvalstest');
 w.eval('dirty=false;');

 /* Valda förslag 1 och 2: synlig logik och läsbar helregelsammanfattning. */
 w.loadRule();
 const visibleJoins=()=>[...el('conditions').querySelectorAll('.condition-join')].filter(n=>!n.hidden);
 check(visibleJoins().length===0,'ett villkor har ingen onödig ELLER/OCH-rad');
 check(/\[värde saknas\]/.test(txt('ruleSummaryBody'))&&/\[välj målmapp\]/.test(txt('ruleSummaryBody')),'ofärdigt utkast visar vad som saknas utan att hitta på en regel');
 check(el('conditions').getAttribute('aria-describedby')==='matchHelp','skärmläsaren får samma förklaring till kombinationen');
 const setCondition=(row,field,op,value)=>{row.children[0].value=field;fire(row.children[0],'change');row.children[1].value=op;fire(row.children[1],'change');row.children[2].value=value;fire(row.children[2],'input');};
 el('ruleName').value='Förklarad regel';w.folderPicker(el('target'),'demo-web');
 setCondition(el('conditions').firstElementChild,'subject','contains','Wordfence');
 el('addCondition').click();setCondition(el('conditions').lastElementChild,'subject','contains','WordPress');
 el('addCondition').click();setCondition(el('conditions').lastElementChild,'sender','contains','wordpress@');
 check(visibleJoins().length===2&&visibleJoins().every(n=>n.textContent==='ELLER'),'tre alternativ visar ELLER exakt mellan raderna');
 check(/Exempelkonto/.test(txt('ruleSummaryBody'))&&/Webb/.test(txt('ruleSummaryBody')),'sammanfattningen visar konto och målmapp');
 check(/ämnet innehåller ”Wordfence” ELLER ämnet innehåller ”WordPress” ELLER avsändaradressen innehåller ”wordpress@”/.test(txt('ruleSummaryBody')),'hela ELLER-regeln förklaras i vanlig svenska');
 const beforeExplain=JSON.stringify({...w.draft(),id:''}),savedBeforeExplain=JSON.stringify(w.LasDemo.setState({}).config.rules);
 w.eval('dirty=false;');const originalSummary=el('ruleSummaryBody').firstChild;
 w.updateRuleExplanation();w.updateRuleExplanation();
 check(JSON.stringify({...w.draft(),id:''})===beforeExplain&&w.eval('dirty')===false,'sammanfattningen ändrar inte regelvärden eller osparat-läget');
 check(JSON.stringify(w.LasDemo.setState({}).config.rules)===savedBeforeExplain,'sammanfattningen skriver inte till sparade regler');
 check(el('ruleSummaryBody').firstChild===originalSummary,'oförändrad sammanfattning bygger inte om DOM');
 el('match').value='all';fire(el('match'),'change');
 check(visibleJoins().every(n=>n.textContent==='OCH')&&el('ruleSummaryBody').querySelectorAll('.summary-join').length===2&&[...el('ruleSummaryBody').querySelectorAll('.summary-join')].every(n=>n.textContent==='OCH'),'uttryckligt OCH visas både mellan rader och i sammanfattningen');
 check(w.draft().match==='all','visningen skriver inte tillbaka standardvalet ELLER');
 el('conditions').firstElementChild.querySelector('.remove-condition').click();
 check(visibleJoins().length===1&&el('conditions').firstElementChild.querySelector('.condition-join').hidden,'borttagning av första villkoret lämnar ingen överflödig koppling överst');
 check(!/Wordfence/.test(txt('ruleSummaryBody')),'borttaget villkor försvinner direkt från sammanfattningen');
 const unsafeText='<img src=x onerror=alert(1)> $& ÅÄÖ';
 el('conditions').firstElementChild.children[2].value=unsafeText;fire(el('conditions').firstElementChild.children[2],'input');
 check(txt('ruleSummaryBody').includes(unsafeText)&&!el('ruleSummaryBody').querySelector('img,script'),'villkorsvärden visas som text – HTML och dollaruttryck tolkas inte');
 setCondition(el('conditions').firstElementChild,'size','larger','500');
 check(/storleken är större än 500 kB/.test(txt('ruleSummaryBody')),'storlek visas med rätt enhet');
 setCondition(el('conditions').firstElementChild,'date','older','90');
 check(/mejlets datum är äldre än 90 dagar/.test(txt('ruleSummaryBody')),'datumålder visas med dagar');
 setCondition(el('conditions').firstElementChild,'date','before','2025');
 check(/mejlets datum är före år 2025/.test(txt('ruleSummaryBody'))&&!/2025 dagar/.test(txt('ruleSummaryBody')),'årtal förväxlas inte med dagar');
 setCondition(el('conditions').firstElementChild,'date','beforeThisYear','');
 check(!/\[värde saknas\]/.test(txt('ruleSummaryBody')),'före nuvarande år behöver inget extra värde');
 setCondition(el('conditions').firstElementChild,'recipient','contains','åsa@example.se');
 check(/mottagarfältet innehåller ”åsa@example.se”/.test(txt('ruleSummaryBody')),'mottagarvillkor förklaras med svenska tecken');
 setCondition(el('conditions').firstElementChild,'cc','contains','ekonomi@');
 check(/kopia\/hemlig kopia innehåller ”ekonomi@”/.test(txt('ruleSummaryBody')),'Cc/Bcc-villkorets faktiska omfattning visas');
 w.folderPicker(el('target'),'removed-id');
 check(/Mapp saknas/.test(txt('ruleSummaryBody')),'saknad målmapp ser inte ut som ett giltigt mål');
 el('targetAccount').value='demo';fire(el('targetAccount'),'change');
 check(/\[välj målmapp\]/.test(txt('ruleSummaryBody')),'kontobyte tömmer även sammanfattningens mål');
 w.folderPicker(el('target'),'demo-fin');
 check(/Ekonomi \/ Fakturor/.test(txt('ruleSummaryBody')),'programmässigt mappval visar hela den nya målsökvägen');
 el('enabled').checked=false;fire(el('enabled'),'change');
 el('ruleTrial').checked=true;fire(el('ruleTrial'),'change');
 el('ruleYearFolders').checked=true;fire(el('ruleYearFolders'),'change');
 el('ruleReadFilter').value='read';fire(el('ruleReadFilter'),'change');
 el('ruleUnreadAction').value='keep';fire(el('ruleUnreadAction'),'change');
 check(/Regeln är avstängd/.test(txt('ruleSummaryBody'))&&/Regeln provkörs/.test(txt('ruleSummaryBody')),'avstängd regel och provkörning redovisas utan löfte om flytt');
 check(/Årsmappar är på/.test(txt('ruleSummaryBody'))&&/Endast lästa mejl/.test(txt('ruleSummaryBody'))&&/Behåll som oläst/.test(txt('ruleSummaryBody')),'sammanfattningen tar med årsmappar, läsval och olästhantering');
 el('addBranch').click();const explainBranch=el('branches').lastElementChild;
 setCondition(explainBranch,'subject','contains','Kvitto');w.folderPicker(explainBranch.querySelector('.folder-choice'),'demo-buy');
 check(/första fördelningen/.test(txt('ruleSummaryBody'))&&/Om ämnet innehåller ”Kvitto”, använd Exempelkonto · Inköp/.test(txt('ruleSummaryBody')),'alternativt mål beskrivs med korrekt företräde efter grundvillkoren');
 explainBranch.querySelector('.remove-condition').click();
 check(!/första fördelningen/.test(txt('ruleSummaryBody'))&&!/Kvitto/.test(txt('ruleSummaryBody')),'borttagen fördelning lämnar ingen gammal beskrivning');
 el('langEn').click();await until(()=>doc.documentElement.lang==='en','engelsk regelsammanfattning');
 check(visibleJoins().every(n=>n.textContent==='AND')&&txt('ruleSummaryTitle')==='How this rule works','kopplingar och rubrik översätts till engelska');
 check(/Cc\/Bcc contains/.test(txt('ruleSummaryBody'))&&/Year folders are on/.test(txt('ruleSummaryBody'))&&/This rule is disabled/.test(txt('ruleSummaryBody')),'villkor och specialval förklaras även på engelska');
 el('match').value='any';fire(el('match'),'change');
 check(visibleJoins().every(n=>n.textContent==='OR'),'ELLER visas som OR på engelska');
 el('langSv').click();await until(()=>doc.documentElement.lang==='sv','tillbaka till svenska efter sammanfattning');
 w.loadRule(savedAny.id);
 check(visibleJoins().length===1&&visibleJoins()[0].textContent==='ELLER'&&!/Årsmappar är på/.test(txt('ruleSummaryBody')),'regelbyte uppdaterar både kopplingar och alla sammanfattningsval');
 el('fromSelected').click();await until(()=>/fortnox.se/.test(txt('ruleSummaryBody')),'hämtning av exempelmejl uppdaterar sammanfattningen');
 check(/fortnox.se/.test(txt('ruleSummaryBody')),'programmässigt ifyllt exempelmejl visas utan extra knapptryck');
 w.eval('dirty=false;');

 /* Mappträdet ersätter rullgardinslistan och bekräftar bara uttryckliga val. */
 w.eval(`folders.push(
  {id:'tree-parent',accountId:'tree-a',accountName:'Åsas konto',name:'Arkiv',path:'/Arkiv',label:'Åsas konto · Arkiv'},
  {id:'child/å&42',accountId:'tree-a',accountName:'Åsas konto',parentId:'tree-parent',name:'Årsöversikt',path:'/Arkiv/Årsöversikt',label:'Åsas konto · Arkiv/Årsöversikt'},
  {id:'tree-nested',accountId:'tree-a',accountName:'Åsas konto',name:'2025',path:'/Räkenskaper/Årsöversikt/2025',label:'Åsas konto · Räkenskaper/Årsöversikt/2025'},
  {id:'tree-other',accountId:'tree-b',accountName:'Björns konto',name:'Årsöversikt',path:'/Arkiv/Årsöversikt',label:'Björns konto · Arkiv/Årsöversikt'});`);
 const treeRow=id=>[...el('folderTree').children].find(n=>n.dataset.key==='folder:'+id);
 const press=(node,key,shiftKey=false)=>node.dispatchEvent(new w.KeyboardEvent('keydown',{key,shiftKey,bubbles:true,cancelable:true}));
 w.folderPicker(el('target'),'child/å&42');w.eval('dirty=false;');
 const treeOriginalQuick=el('quickTarget').value,treeOriginalSource=el('source').value;
 check(el('target').hidden&&!el('target').required&&!!el('targetBrowse'),'rullgardinslistan ersätts av en mappknapp utan dold required-kontroll');
 el('targetBrowse').click();
 check(!el('folderTreeModal').hidden&&doc.activeElement===el('folderTreeAccount'),'mappdialogen öppnas med fokus på kontot');
 check(el('folderTreeAccount').value==='tree-a'&&treeRow('child/å&42')?.getAttribute('aria-selected')==='true','sparat mapp-ID öppnas i rätt konto med föräldrarna utfällda');
 check(/Åsas konto · Arkiv › Årsöversikt/.test(txt('folderTreePath')),'markerad mapp har hela sin sökväg synlig');
 check(doc.querySelector('.shell').inert===true,'mappdialogen låser bakgrunden');
 treeRow('tree-parent').click();
 check(el('target').value==='child/å&42'&&w.eval('dirty')===false,'markering i trädet ändrar inte det riktiga målvalet eller utkastet');
 el('folderTreeCancel').click();
 check(el('target').value==='child/å&42'&&doc.activeElement===el('targetBrowse')&&doc.querySelector('.shell').inert===false,'Avbryt behåller målmappen och lämnar tillbaka fokus');
 el('targetBrowse').click();
 el('folderTreeCancel').focus();press(el('folderTreeCancel'),'Tab');
 check(doc.activeElement===el('folderTreeAccount'),'Tab från dialogens sista knapp går till kontot');
 press(el('folderTreeAccount'),'Tab',true);
 check(doc.activeElement===el('folderTreeCancel'),'Shift+Tab från kontot går till sista knappen');
 el('folderTreeAccount').value='tree-b';fire(el('folderTreeAccount'),'change');
 check(el('folderTreeChoose').disabled&&el('targetAccount').value==='tree-a','kontobyte i dialogen väljer ingen mapp och ändrar inte huvudregeln');
 el('folderTreeSearch').value='ÅRSÖVERSIKT'.normalize('NFD');fire(el('folderTreeSearch'),'input');
 check(!!treeRow('tree-other')&&!treeRow('child/å&42'),'svensk sökning stannar inom valt konto även vid lika mappnamn');
 treeRow('tree-other').click();
 check(el('target').value==='child/å&42','även en träff i annat konto väntar på bekräftelse');
 el('folderTreeChoose').click();
 check(el('folderTreeModal').hidden&&el('target').value==='tree-other'&&el('targetAccount').value==='tree-b','Välj denna mapp överför rätt verkligt ID och konto');
 check(el('source').value===treeOriginalSource&&el('quickTarget').value===treeOriginalQuick,'bekräftelsen ändrar inte källkonto eller snabbregelns mål');
 check(w.eval('dirty')===true&&/Björns konto/.test(txt('ruleSummaryBody')),'bekräftat mål markeras som osparat och syns i sammanfattningen');
 el('targetBrowse').click();el('folderTreeAccount').value='tree-a';fire(el('folderTreeAccount'),'change');
 const parentKey=treeRow('tree-parent');
 check(parentKey.getAttribute('aria-expanded')==='false'&&!treeRow('child/å&42'),'grenen börjar hopfälld i ett nytt konto');
 parentKey.focus();press(parentKey,'ArrowRight');
 check(treeRow('tree-parent').getAttribute('aria-expanded')==='true'&&!!treeRow('child/å&42'),'högerpil fäller ut grenen');
 press(doc.activeElement,'ArrowDown');
 check(doc.activeElement===treeRow('child/å&42'),'nedåtpil går till undermappen');
 press(doc.activeElement,'Enter');
 check(!el('folderTreeChoose').disabled&&el('target').value==='tree-other','Enter markerar endast – inget mål byts utan bekräftelse');
 press(doc.activeElement,'ArrowLeft');
 check(doc.activeElement===treeRow('tree-parent'),'vänsterpil går till föräldern från ett löv');
 press(doc.activeElement,'ArrowLeft');
 check(!treeRow('child/å&42'),'vänsterpil fäller ihop öppen gren');
 press(doc.activeElement,'End');check(doc.activeElement===el('folderTree').lastElementChild,'End går till sista synliga raden');
 press(doc.activeElement,'Home');check(doc.activeElement===el('folderTree').firstElementChild,'Home går till första synliga raden');
 press(doc.activeElement,'Escape');
 check(el('folderTreeModal').hidden&&el('target').value==='tree-other','Escape avbryter även efter tangentbordsmarkering');
 el('targetBrowse').click();el('folderTreeAccount').value='tree-a';fire(el('folderTreeAccount'),'change');
 const virtual=[...el('folderTree').children].find(n=>n.textContent.includes('Räkenskaper'));
 virtual.click();
 check(el('folderTreeChoose').disabled&&!virtual.hasAttribute('aria-selected'),'strukturrader kan fällas ut men får aldrig ett påhittat mål-ID');
 el('folderTreeSearch').value='RÄKENSKAPER ÅRSÖVERSIKT'.normalize('NFD');fire(el('folderTreeSearch'),'input');
 check(!!treeRow('tree-nested')&&treeRow('tree-nested').getAttribute('aria-level')==='3','flerordsökning visar träffen med rätt nivå och föräldrar');
 treeRow('tree-nested').click();
 check(/Räkenskaper › Årsöversikt › 2025/.test(txt('folderTreePath')),'sökresultatets fulla sökväg kan kontrolleras före val');
 w.applyLanguage('en');
 check(txt('folderTreeTitle')==='Choose target folder'&&txt('folderTreeChoose')==='Choose this folder','öppen mappdialog översätts utan att tappa valet');
 check(treeRow('tree-nested')?.getAttribute('aria-selected')==='true','språkbyte behåller det väntande ID:t');
 w.applyLanguage('sv');el('folderTreeModal').click();
 check(el('folderTreeModal').hidden&&el('target').value==='tree-other','bakgrundsklick avbryter utan att ändra målmapp');
 el('targetBrowse').click();el('folderTreeAccount').value='tree-a';fire(el('folderTreeAccount'),'change');
 el('folderTreeSearch').value='finns-inte';fire(el('folderTreeSearch'),'input');
 check(el('folderTree').children.length===0&&/Inga mappar/.test(txt('folderTreeStatus'))&&el('folderTreeChoose').disabled,'noll träffar ger ett begripligt, säkert tomläge');
 el('folderTreeCancel').click();

 /* Mappträdet kan användas inne i Ny mapp utan att fokus eller bakgrund låses fel. */
 el('newFolderBtn').click();el('folderParentBrowse').click();
 check(!el('folderModal').hidden&&!el('folderTreeModal').hidden&&el('folderModal').inert===true,'föräldramapp väljs i ett eget träd ovanpå Ny mapp');
 check(/överordnad/.test(txt('folderTreeTitle')),'föräldraväljaren har rätt rubrik');
 press(el('folderTreeAccount'),'Escape');
 check(el('folderTreeModal').hidden&&!el('folderModal').hidden&&doc.activeElement===el('folderParentBrowse')&&doc.querySelector('.shell').inert===true,'Escape stänger bara trädet och återgår till Ny mapp');
 el('folderParentBrowse').click();el('folderTreeAccount').value='tree-a';fire(el('folderTreeAccount'),'change');
 [...el('folderTree').children].find(n=>n.dataset.key==='account-root').click();el('folderTreeChoose').click();
 check(el('folderParent').value===''&&el('folderParentAccount').value==='tree-a','kontots rot kan väljas uttryckligen som förälder');
 el('folderCancelBtn').click();
 check(doc.querySelector('.shell').inert===false&&doc.activeElement===el('newFolderBtn'),'efter båda dialogerna återställs fokus och interaktivitet');

 /* Ett mål som försvunnit under tiden får inte ersättas med första bästa mapp. */
 el('targetBrowse').click();
 w.eval("globalThis.removedTreeFolder=folders.find(f=>f.id==='tree-other');folders=folders.filter(f=>f.id!=='tree-other');");
 el('folderTreeChoose').click();
 check(!el('folderTreeModal').hidden&&el('folderTreeChoose').disabled&&el('target').value==='tree-other','försvunnen mapp stoppas vid bekräftelsen utan automatisk ersättare');
 el('folderTreeCancel').click();w.eval('folders.push(removedTreeFolder);delete globalThis.removedTreeFolder;dirty=false;');

 /* Låt sista klickets löfteskedja bli klar innan fönstret rivs: annars kan en
    kvittentext skrivas efter stängningen och ge ett falskt skriptfel. */
 await sleep(400);
 check(jsdomErrors.length===0,'inga skriptfel: '+(jsdomErrors.slice(0,2).join(' | ')||'inga'));
 dom.window.close();
})().catch(err=>{console.error(err);process.exitCode=1;dom.window.close();});
