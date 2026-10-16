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

 /* Låt sista klickets löfteskedja bli klar innan fönstret rivs: annars kan en
    kvittentext skrivas efter stängningen och ge ett falskt skriptfel. */
 await sleep(400);
 check(jsdomErrors.length===0,'inga skriptfel: '+(jsdomErrors.slice(0,2).join(' | ')||'inga'));
 dom.window.close();
})();
