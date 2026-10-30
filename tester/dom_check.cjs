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
const check=(ok,label)=>{if(ok){pass++;console.log('PASS: '+label);}else{fail++;errors.push(label);console.log('FAIL: '+label);}};
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
  w.structuredClone=structuredClone;
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
 el('quickTarget').value='';
 el('langEn').click();
 await until(()=>el('quickTarget').value==='demo-buy','snabbregeln minns målmappen du använde sist',false,6000);
 check(el('quickTarget').value==='demo-buy','målmappen är förvald nästa gång: "'+el('quickTarget').value+'"');
 el('langSv').click();
 await until(()=>/Skapa regel|Lägg till/.test(el('quickAddBtn').textContent),'språket tillbaka till svenska');

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
 check([...el('tbImportReview').querySelectorAll('button')].length===0,'ingen knapp som försöker igen med samma felande rad');

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
 check(/Loggar/.test(note)&&/Regelbackuper/.test(note)&&/Regler/.test(note)&&/Filterfiler/.test(note),'alla fyra undermappar nämns');
 check(/Inget hamnar löst/.test(note),'och den lovar att inget hamnar utanför');
 check(/Loggar\/lasfilter-logg\.txt/.test(el('fileLog').closest('label').textContent),'loggrutan pekar på Loggar-mappen: "'+el('fileLog').closest('label').textContent.trim()+'"');
 el('export').click();
 await until(()=>/exporterades till/.test(txt('toast')),'exporten kvitteras med sökväg');
 check(/Lasfilter\/Regler\/sortbro-regler-\d{4}-\d{2}-\d{2}\.json/.test(txt('toast')),'regelfilen hamnar i Regler-mappen: "'+txt('toast')+'"');
 el('exportLog').click();
 await until(()=>/Loggen exporterades/.test(txt('toast')),'loggexporten kvitteras');
 check(/Lasfilter\/Loggar\/sortbro-tekniklogg-\d{4}-\d{2}-\d{2}\.json/.test(txt('toast')),'loggfilen hamnar i Loggar-mappen: "'+txt('toast')+'"');
 check(/Spara samlad fellogg/.test(txt('exportErrorLog')),'knappen för samlad fellogg finns');
 el('exportErrorLog').click();
 await until(()=>/Lasfilter\/Loggar\/sortbro-fellogg\.txt/.test(txt('toast')),'felloggen kvitteras med sin sökväg');
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

 /* Låt sista klickets löfteskedja bli klar innan fönstret rivs: annars kan en
    kvittentext skrivas efter stängningen och ge ett falskt skriptfel. */
 await sleep(400);
 check(jsdomErrors.length===0,'inga skriptfel: '+(jsdomErrors.slice(0,2).join(' | ')||'inga'));
 dom.window.close();
})();
