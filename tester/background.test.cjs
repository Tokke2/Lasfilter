/* Regressionstester för bakgrundslagret (addon/background.js) med stubbad webbläsare.
   Kör: node --test tester/background.test.cjs
   Testar det som användaren möter i loggen:
   – pausad eller stoppad bevakning ska vara tyst, inte larma "Tekniskt fel",
   – knappen "Kör alla regler nu" ska vänta in ett pågående svep i stället för att visa nollor,
   – ett misslyckat automatiskt svep ska försöka om en gång och sedan skriva en läsbar rad. */
const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
const C=require(path.join(ROOT,'addon','core.js'));

/* Permissiv webbläsarstubbe: okända anrop blir funktioner som svarar tomt. */
function stubApi(){
 const make=()=>new Proxy(function(){return Promise.resolve([]);},{
  get(target,prop){
   if(prop==='then'||prop==='catch'||prop==='finally')return target[prop]?.bind(target);
   if(prop==='addListener'||prop==='removeListener'||prop==='hasListener')return typeof target[prop]==='function'?target[prop]:(()=>{});
   if(prop in target)return target[prop];
   target[prop]=make();return target[prop];
  },
  apply(){return Promise.resolve([]);},
  set(target,prop,value){target[prop]=value;return true;}
 });
 return make();
}
function clock(){
 const RealDate=Date;let now=RealDate.now();const timers=new Map();let seq=1;
 class FakeDate extends RealDate{static now(){return now;}}
 FakeDate.parse=RealDate.parse;FakeDate.UTC=RealDate.UTC;
 const api={Date:FakeDate,now:()=>now,
  setTimeout:(fn,ms=0)=>{const id=seq++;timers.set(id,{fn,at:now+(Number(ms)||0)});return id;},
  clearTimeout:id=>{timers.delete(id);},
  setInterval:()=>seq++,clearInterval:()=>{},
  pending:()=>timers.size,
  /* Kör ett löfte färdigt genom att turas om att släppa mikrouppgifter och köra timers. */
  async settle(promise,rounds=40){
   let done=false,value;
   promise.then(v=>{done=true;value={v};},e=>{done=true;value={e};});
   for(let i=0;i<rounds&&!done;i++){
    await new Promise(r=>setImmediate(r));
    await tickFlush();
   }
   if(!done)throw new Error('löftet blev aldrig klart');
   if(value.e)throw value.e;
   return value.v;
  },
  /* Kör alla väntande tidsinställningar i tidsordning och flyttar klockan framåt. */
  async flush(limit=200){
   return tickFlush(limit);
  },
  flushNow:tickFlush};
 async function tickFlush(limit=200){
  for(let i=0;i<limit;i++){
   const next=[...timers.entries()].sort((a,b)=>a[1].at-b[1].at)[0];
   if(!next)return;
   timers.delete(next[0]);
   if(next[1].at>now)now=next[1].at;
   next[1].fn();
   await new Promise(r=>setImmediate(r));
  }
 }
 return api;
}
async function loadBackground(api=stubApi()){
 const tick=clock();
 const browser=api;
 const sandbox={console,JSON,Math,Number,String,Array,Object,Map,Set,WeakMap,Promise,Error,TypeError,RegExp,Symbol,Boolean,isNaN,parseInt,parseFloat,structuredClone,
  Date:tick.Date,setTimeout:tick.setTimeout,clearTimeout:tick.clearTimeout,setInterval:tick.setInterval,clearInterval:tick.clearInterval,
  LasCore:C,
  LasFilters:require(path.join(ROOT,'addon','filters.js')),
  /* Blob/URL behövs för att skriva loggfilen. Testet kan fånga innehållet
     genom att sätta api.__captureBlob innan bakgrunden laddas. */
  Blob:class{constructor(parts){this.parts=parts;}},
  URL:{createObjectURL:typeof api.__captureBlob==='function'?api.__captureBlob:()=>'blob:x',revokeObjectURL:()=>{}},
  LasEngine:class{constructor(){this.config={};this.fault='';this.pending=new Map();}stop(){}},
  browser};
 sandbox.globalThis=sandbox;
 const source=fs.readFileSync(path.join(ROOT,'addon','background.js'),'utf8')+'\nglobalThis.__app=App;';
 vm.runInNewContext(source,sandbox,{filename:'background.js'});
 const app=sandbox.__app;
 await app.ready.catch(()=>{}); /* låt startsvepet bli klart innan testet tar över motorn */
 return {app,tick,api:browser};
}
/* Fejkad motor motsvarande den riktiga motorns kontrakt. */
function fakeEngine(app,over={}){
 const engine={enabled:()=>true,fault:'',pending:new Map(),sweeping:0,lastSweep:null,hold:false,epoch:0,
  inflight:new Map(),stats:{},logs:[],backups:[],
  config:{paused:false,hourly:true,sweepMinutes:60,moveMode:'read',newInboxDirect:true,openWindow:true,rules:[{id:'r1',enabled:true}],revision:0,rulesVersion:0},
  sweepAll:async()=>({scanned:0,queued:0,deferred:0,searchedFolders:0,skippedFolders:0,emptyFolders:0,cachedFolders:0}),
  tick:async()=>{},debug(){},stop(code){engine.fault=code;},
  clearPending:async()=>{},invalidateFolders(){},recordList:()=>[],blocked:()=>0,validateRuleFolders:async()=>{},...over};
 app.engine=engine;
 return engine;
}
const errorLogs=app=>app.logs.filter(l=>l.event==='error');
/* Ett konto med Inkorg och en målmapp, plus mejl som liknar användarens vardag. */
function inboxAccount(api){
 api.accounts.list=async()=>[{
  id:'a',name:'Testkonto',
  rootFolder:{id:'root',accountId:'a',name:'',specialUse:[],subFolders:[
   {id:'inbox',accountId:'a',name:'Inkorg',specialUse:['inbox'],subFolders:[]},
   {id:'fin',accountId:'a',name:'Fakturor',specialUse:[],subFolders:[]}]}}];
 api.messages.query=async q=>({id:null,messages:[
  {id:1,author:'Order <order@klarna.se>',subject:'Order bekräftad',folder:{id:q.folderId,accountId:'a'},read:true},
  {id:2,author:'Order <order@klarna.se>',subject:'Order skickad',folder:{id:q.folderId,accountId:'a'},read:true},
  {id:3,author:'Order <order@klarna.se>',subject:'Order levererad',folder:{id:q.folderId,accountId:'a'},read:true},
  {id:4,author:'Faktura <faktura@fortnox.se>',subject:'Faktura 1042',folder:{id:q.folderId,accountId:'a'},read:true}]});
}
function fakeEngineWithRules(app,over={}){
 /* Fullt giltig konfiguration – App.save validerar den (C.config). */
 return fakeEngine(app,{config:{schema:1,revision:0,rulesVersion:0,paused:false,dryRun:true,moveMode:'read',hourly:true,sweepMinutes:60,
  newInboxDirect:true,openWindow:true,verbose:true,fileLog:true,rules:[]},...over});
}

/* Konto med sökväg på målmappen – exporten behöver hela vägen, inte bara namnet. */
function exportAccount(api,rootName){
 api.accounts.list=async()=>[{
  id:'a',name:rootName,
  rootFolder:{id:'root',accountId:'a',name:'',specialUse:[],subFolders:[
   {id:'inbox',accountId:'a',name:'Inkorg',specialUse:['inbox'],subFolders:[]},
   {id:'fin',accountId:'a',name:'Fakturor',path:'Ekonomi/Fakturor',specialUse:[],subFolders:[]}]}}];
}
const exportRule={id:'r1',name:'Fakturor',enabled:true,target:'fin',match:'all',branches:[],conditions:[{field:'sender',op:'contains',value:'faktura@fortnox.se'}]};

test('exporten skriver lokala mappar med Thunderbirds egen adress',async()=>{
 const {app,api}=await loadBackground();
 exportAccount(api,'Lokala mappar');
 fakeEngineWithRules(app,{config:{schema:1,revision:0,rulesVersion:0,paused:false,dryRun:true,moveMode:'read',hourly:true,sweepMinutes:60,newInboxDirect:true,openWindow:true,verbose:true,fileLog:true,rules:[exportRule]}});
 const list=await app.folderList();
 assert.equal(list.find(f=>f.id==='fin').path,'Ekonomi/Fakturor','mapplistan bär hela sökvägen');
 const out=await app.filterExport({accountId:'a'});
 assert.equal(out.written,1);
 assert.equal(out.needsUri.length,0,'ingen regel väntar på en adress');
 assert.ok(out.text.includes('actionValue="mailbox://nobody@Local%20Folders/Ekonomi/Fakturor"'),'lokala mappar får mailbox-adressen: '+out.text.split('\r\n').filter(l=>l.startsWith('actionValue')));
 assert.ok(out.text.includes('condition="AND (from,contains,faktura@fortnox.se)"'));
});

test('utan känd kontoadress säger exporten vilka regler som väntar på den',async()=>{
 const {app,api}=await loadBackground();
 exportAccount(api,'Testkonto');
 fakeEngineWithRules(app,{config:{schema:1,revision:0,rulesVersion:0,paused:false,dryRun:true,moveMode:'read',hourly:true,sweepMinutes:60,newInboxDirect:true,openWindow:true,verbose:true,fileLog:true,rules:[exportRule]}});
 const out=await app.filterExport({accountId:'a'});
 assert.equal(out.written,0,'inget skrivs utan adress');
 assert.equal(out.needsUri.length,1,'en regel väntar på adressen');
 assert.equal(out.needsUri[0].ruleId,'r1');
 assert.equal(out.needsUri[0].name,'Fakturor');
 assert.ok(!out.text.includes('actionValue="imap'),'ingen påhittad adress');
 const withPrefix=await app.filterExport({accountId:'a',uriPrefix:'imap://u%40h.se@imap.h.se/'});
 assert.equal(withPrefix.written,1);
 assert.equal(withPrefix.storedPrefix,'imap://u%40h.se@imap.h.se/');
 assert.ok(withPrefix.text.includes('actionValue="imap://u%40h.se@imap.h.se/Ekonomi/Fakturor"'),'kontoadressen används direkt');
});

test('en inklistrad kontoadress sparas när den är giltig och avvisas när den inte är det',async()=>{
 const {app,api}=await loadBackground();
 exportAccount(api,'Testkonto');
 fakeEngineWithRules(app,{config:{schema:1,revision:0,rulesVersion:0,paused:false,dryRun:true,moveMode:'read',hourly:true,sweepMinutes:60,newInboxDirect:true,openWindow:true,verbose:true,fileLog:true,rules:[exportRule]}});
 const bad=await app.filterExport({accountId:'a',uriPrefix:'hej/Ekonomi'});
 assert.equal(bad.written,0,'en påhittad adress ger ingen fil');
 assert.equal(bad.needsUri.length,1);
 assert.equal(app.prefs.filterUris?.a,undefined,'skräp sparas inte');
 const good=await app.filterExport({accountId:'a',uriPrefix:'imap://u%40h.se@imap.h.se/'});
 assert.equal(good.written,1);
 assert.equal(good.text.includes('actionValue="imap://u%40h.se@imap.h.se/Ekonomi/Fakturor"'),true,'adressen hamnar i filen');
 assert.equal(app.prefs.filterUris.a,'imap://u%40h.se@imap.h.se/','adressen sparas för nästa gång');
 const again=await app.filterExport({accountId:'a'});
 assert.equal(again.written,1,'nästa export klarar sig utan att adressen klistras in igen');
 assert.equal(again.storedPrefix,'imap://u%40h.se@imap.h.se/');
});

/* ── Automatisk säkerhetskopia av reglerna ────────────────────────────── */
function backupApi(){
 const api=stubApi();
 const files={},written=[],removed=[];
 let capture='',query=null;
 api.__captureBlob=blob=>{capture=String(blob?.parts?.[0]||'');return 'blob:x';};
 api.downloads.download=async arg=>{written.push(arg.filename);files[arg.filename]=capture;return written.length;};
 api.downloads.search=async q=>{query=q;return api.__searchResult||[];};
 api.downloads.removeFile=async id=>{removed.push(id);};
 return {api,files,written,removed,getQuery:()=>query};
}
const backupConfig=rules=>({schema:1,revision:0,rulesVersion:0,paused:false,dryRun:true,moveMode:'read',hourly:true,sweepMinutes:60,
 newInboxDirect:true,openWindow:true,verbose:true,fileLog:true,autoBackup:true,rules});

test('säkerhetskopian skriver reglerna till Hämtade filer – och de kan läsas tillbaka',async()=>{
 const {api,files,written}=backupApi();
 const {app}=await loadBackground(api);
 fakeEngineWithRules(app,{config:backupConfig([exportRule])});
 const r=await app.autoBackup({force:true});
 assert.equal(r.written,true,'kopian skrevs');
 assert.equal(r.count,1,'en regel i kopian');
 assert.ok(written.includes('Lasfilter/sortbro-regler-backup.json'),'senaste kopian hamnar i vår egen mapp');
 assert.match(r.dated,/^Lasfilter[\/]sortbro-regler-\d{4}-\d{2}-\d{2}\.json$/,'en daterad kopia per dag');
 const payload=JSON.parse(files['Lasfilter/sortbro-regler-backup.json']);
 assert.equal(payload.format,'lasfilter-rules','samma format som den manuella exporten');
 assert.equal(payload.app,'SortBro');
 assert.equal(payload.rules.length,1);
 assert.ok(payload.exported,'tidsstämpel finns');
 const back=app.extractImportedRules(payload,[{id:'fin',accountId:'a',name:'Fakturor'}],[]);
 assert.equal(back.length,1,'filen går att importera tillbaka');
 assert.equal(back[0].name,'Fakturor');
 assert.equal(back[0].target,'fin');
});

test('kopian skrivs när reglerna ändrats – men inte i onödan och aldrig när rutan är av',async()=>{
 const {api,written}=backupApi();
 const {app}=await loadBackground(api);
 fakeEngineWithRules(app,{config:backupConfig([exportRule])});
 await app.autoBackup({force:true});
 const after=written.length;
 const sameDay=await app.autoBackup();
 assert.equal(sameDay.written,false,'oförändrade regler samma dag skrivs inte om');
 assert.equal(sameDay.reason,'unchanged');
 assert.equal(written.length,after,'ingen ny fil i onödan');
 app.engine.config={...app.engine.config,rules:[{...exportRule,name:'Fakturor 2'}]};
 const changed=await app.autoBackup();
 assert.equal(changed.written,true,'en ändrad regel skrivs');
 assert.equal(written.length,after+1,'bara den senaste filen skrivs om samma dag');
 app.engine.config={...app.engine.config,autoBackup:false};
 const off=await app.autoBackup();
 assert.equal(off.written,false,'avstängd ruta skriver ingenting');
 assert.equal(off.reason,'off');
 const forced=await app.autoBackup({force:true});
 assert.equal(forced.written,true,'knappen Backa upp nu fungerar även med rutan av');
});

test('en misslyckad kopiering larmar i loggen utan att kasta',async()=>{
 const {api}=backupApi();
 api.downloads.download=async()=>{throw new Error('nekad');};
 const {app}=await loadBackground(api);
 fakeEngineWithRules(app,{config:backupConfig([exportRule])});
 const r=await app.autoBackup({force:true});
 assert.equal(r.written,false);
 assert.equal(r.reason,'failed');
 assert.ok(app.logs.some(l=>/kunde inte backas upp/.test(l.data?.detail||'')),'orsaken skrivs i loggen');
});

test('gamla dagsfiler städas – men bara våra egna i vår egen mapp',async()=>{
 const {api,removed,getQuery}=backupApi();
 const old=new Date(Date.now()-40*86400000).toISOString();
 api.__searchResult=[
  {id:11,startTime:old,filename:'Lasfilter/sortbro-regler-2025-01-01.json'},
  {id:12,startTime:new Date().toISOString(),filename:'Lasfilter/sortbro-regler-2026-10-16.json'}
 ];
 const {app}=await loadBackground(api);
 fakeEngineWithRules(app,{config:backupConfig([exportRule])});
 await app.autoBackup({force:true});
 assert.deepEqual(removed,[11],'bara den för gamla filen tas bort');
 const re=new RegExp(getQuery().filenameRegex);
 assert.ok(re.test('C:'+String.fromCharCode(92)+'Downloads'+String.fromCharCode(92)+'Lasfilter'+String.fromCharCode(92)+'sortbro-regler-2026-10-16.json'),'våra dagsfiler matchas');
 assert.ok(!re.test('C:'+String.fromCharCode(92)+'Downloads'+String.fromCharCode(92)+'sortbro-regler-2026-10-16.json'),'en manuell export i Hämtade filer rörs inte');
 assert.ok(!re.test('C:'+String.fromCharCode(92)+'Downloads'+String.fromCharCode(92)+'Lasfilter'+String.fromCharCode(92)+'sortbro-regel-fakturor.json'),'exporten av en enstaka regel rörs inte');
});

test('kontoadresser sparas bara i rimlig form och överlever en omstart',async()=>{
 const {app}=await loadBackground();
 const next=await app.handle({type:'prefs',prefs:{filterUris:{a:'imap://u@h.se/',x:'y'.repeat(300),'':'tom nyckel'}}});
 assert.equal(JSON.stringify(next.filterUris),'{"a":"imap://u@h.se/"}','bara giltiga rader sparas');
 assert.equal(JSON.stringify(app.prefs.filterUris),'{"a":"imap://u@h.se/"}');
 const bogus=await app.handle({type:'prefs',prefs:{filterUris:['inte','ett','objekt']}});
 assert.equal(JSON.stringify(bogus.filterUris),'{"a":"imap://u@h.se/"}','en lista får inte förstöra det som redan finns');
});

test('pausad bevakning kör ingenting och larmar inte i loggen',async()=>{
 const {app,tick}=await loadBackground();
 fakeEngine(app,{enabled:()=>false,config:{paused:true,hourly:true,sweepMinutes:60,rules:[],revision:0,rulesVersion:0}});
 const r=await app.runAllRules();
 assert.equal(r.skipped,'paused');
 assert.deepEqual([r.scanned,r.queued],[0,0]);
 await tick.settle(app.autoSweep());
 assert.equal(errorLogs(app).length,0,'pausat läge får aldrig bli en teknisk felrad');
});

test('stoppad motor rapporterar orsaken i stället för att kasta',async()=>{
 const {app,tick}=await loadBackground();
 fakeEngine(app,{enabled:()=>false,fault:'uncertain_move'});
 const r=await app.runAllRules();
 assert.equal(r.skipped,'stopped');
 assert.equal(r.fault,'uncertain_move');
 await tick.settle(app.autoSweep());
 assert.equal(errorLogs(app).length,0);
 assert.equal(app.logs.filter(l=>l.data?.detail?.includes('motorn är stoppad')).length<=1,true,'högst en notis om stoppad motor');
});

test('knappen väntar in ett pågående svep i stället för att visa nollor',async()=>{
 const {app,tick}=await loadBackground();
 const engine=fakeEngine(app,{sweeping:1,
  sweepAll:async()=>({scanned:12,queued:4,deferred:0,searchedFolders:9,skippedFolders:0,emptyFolders:1,cachedFolders:6})});
 const running=app.runAllRules();
 await new Promise(r=>setImmediate(r));
 engine.sweeping=0; /* det pågående svepet blir klart medan vi väntar */
 await tick.flush(5);
 const r=await running;
 assert.equal(r.waited,true,'resultatet ska säga att en körning redan pågick');
 assert.equal(r.scanned,12);
 assert.equal(r.queued,4);
 assert.equal(r.busy,undefined);
});

test('knappen Kör alla regler nu tvingar en full genomsökning',async()=>{
 const {app,tick}=await loadBackground();
 const calls=[];
 fakeEngine(app,{sweepAll:async opts=>{calls.push(opts);return {scanned:3,queued:1,deferred:0,searchedFolders:2,skippedFolders:0,emptyFolders:0,cachedFolders:0};}});
 await app.handle({type:'sweepNow'});
 assert.equal(calls[0]?.force,true,'knappen ska läsa om allt, inte lita på cachen');
 await tick.settle(app.autoSweep());
 assert.equal(calls[calls.length-1]?.force,false,'det tidsstyrda svepet får använda cachen');
});

test('Inkorgen skannas en gång och ger både avsändare och ämnesord',async()=>{
 const {app,api}=await loadBackground();
 inboxAccount(api);
 fakeEngineWithRules(app);
 const scan=await app.scanInbox();
 assert.equal(scan.inboxId,'inbox');
 assert.equal(scan.sourceAccount,'a');
 assert.equal(scan.scanned,4);
 const hints=await app.inboxHints();
 assert.deepEqual(hints.senders.map(x=>x.domain),['klarna.se'],'återkommande avsändare föreslås');
 assert.equal(hints.senders[0].count,3);
 assert.deepEqual(hints.words.map(x=>x.word),['order'],'vanliga ämnesord föreslås, avsändarens namn hoppas över');
 assert.equal(hints.scanned,4);
 assert.equal(hints.inboxId,'inbox');
});

test('quickPreview räknar träffar i Inkorgen utan att spara något',async()=>{
 const {app,api}=await loadBackground();
 inboxAccount(api);
 const engine=fakeEngineWithRules(app);
 const byDomain=await app.quickPreview({field:'domain',value:'klarna.se'});
 assert.equal(byDomain.matches,3);
 assert.deepEqual(byDomain.condition,{field:'domain',op:'equals',value:'klarna.se'});
 const byWord=await app.quickPreview({field:'subject',value:'Order'});
 assert.equal(byWord.matches,3,'löst ord i ämnet fångar alla tre');
 const bySender=await app.quickPreview({field:'sender',value:'faktura'});
 assert.equal(bySender.matches,1,'avsändare som innehåller ett ord');
 assert.equal(engine.config.rules.length,0,'inget skapas av en förhandsvisning');
});

test('quickRule skapar, validerar och sparar en färdig regel',async()=>{
 const {app,api}=await loadBackground();
 inboxAccount(api);
 const engine=fakeEngineWithRules(app);
 const res=await app.handle({type:'quickRule',revision:0,field:'domain',value:'klarna.se',target:'fin',sourceAccount:'a'});
 assert.ok(res.ruleId,'regeln får ett id');
 assert.equal(engine.config.rules.length,1);
 const rule=engine.config.rules[0];
 assert.deepEqual(rule.conditions,[{field:'domain',op:'equals',value:'klarna.se'}]);
 assert.equal(rule.name,'klarna.se','namnet blir det man valde');
 assert.equal(rule.target,'fin');
 assert.equal(rule.source,'inbox','källan blir Inkorgen');
 assert.equal(rule.sourceAccount,'a');
 assert.equal(rule.readFilter,'both','olästa mejl får flyttas som standard');
 assert.equal(rule.unreadAction,'keep');
 assert.equal(rule.enabled,true);
 assert.equal(engine.config.revision,1,'sparningen höjer revisionen');
 assert.equal(engine.config.rulesVersion,1,'cachen läses om efter en ny regel');
 assert.equal(res.snapshot.config.rules.length,1);
 assert.ok(app.logs.some(l=>l.event==='rules_saved'),'sparningen syns i loggen');
});

test('quickRule vägrar en målmapp som inte finns',async()=>{
 const {app,api}=await loadBackground();
 inboxAccount(api);
 fakeEngineWithRules(app);
 await assert.rejects(()=>app.handle({type:'quickRule',revision:0,field:'domain',value:'x.se',target:'saknas'}),
  err=>err.code==='choose_target');
});

test('ett svep som inte blir klart i tid svarar "pågår redan" i stället för nollor',async()=>{
 const {app,tick}=await loadBackground();
 fakeEngine(app,{sweeping:1}); /* ett svep som aldrig blir klart */
 const r=await tick.settle(app.runAllRules(),150);
 assert.equal(r.busy,true);
 assert.equal(r.scanned,0);
 assert.equal(errorLogs(app).length,0);
});

test('ett automatiskt svep som misslyckas vid start försöker om i tysthet',async()=>{
 const {app,tick}=await loadBackground();
 let first=true;
 fakeEngine(app,{sweepAll:async()=>{if(first){first=false;throw new C.RuleError('sweep_error');}return {scanned:7,queued:2,deferred:0,searchedFolders:5,skippedFolders:0,emptyFolders:0,cachedFolders:3};}});
 const r=await tick.settle(app.autoSweep());
 assert.equal(r.scanned,7,'andra försöket lyckas');
 assert.equal(r.skipped,undefined);
 assert.equal(errorLogs(app).length,0,'ett övergående startfel ska inte larma');
});

test('först efter ett andra misslyckande skrivs en läsbar felrad',async()=>{
 const {app,tick}=await loadBackground();
 const engine=fakeEngine(app,{sweepAll:async()=>{throw new C.RuleError('sweep_error');}});
 const r=await tick.settle(app.autoSweep());
 assert.equal(r.skipped,'error');
 assert.equal(r.code,'sweep_error');
 assert.equal(engine.fault,'','motorn ska inte stoppas av ett misslyckat svep');
 const rows=errorLogs(app);
 assert.equal(rows.length,1,'exakt en felrad, inte en storm');
 const text=rows[0].data.detail;
 assert.match(text,/^Automatiskt svep misslyckades \(sweep_error\)/);
 assert.ok(text.includes('kontrollera att regelns käll- och målmappar'),'texten ska gå att läsa och förstå: '+text);
 assert.ok(!/^svep_misslyckades code=/.test(text),'råa nycklar ska inte läckas till loggen');
});

test('villkor importeras in i en regel som redan finns',async()=>{
 const {app,api}=await loadBackground();
 inboxAccount(api);
 const existing=C.validateRule({id:'r9',name:'Webbsupport',enabled:true,source:'inbox',sourceAccount:'a',target:'fin',match:'all',readFilter:'read',
  conditions:[{field:'subject',op:'contains',value:'WordPress'}],branches:[]});
 const engine=fakeEngineWithRules(app,{config:{schema:1,revision:3,rulesVersion:2,paused:false,dryRun:true,moveMode:'read',hourly:true,sweepMinutes:60,
  newInboxDirect:true,openWindow:true,verbose:true,fileLog:true,rules:[existing]}});
 const res=await app.handle({type:'importConditions',revision:3,ruleId:'r9',text:'wordpress@limoeurope.com\nfortnox.se'});
 assert.equal(res.added,2);
 assert.equal(res.skipped,0);
 assert.equal(res.match,'any','flera avsändare kopplas med minst ett av villkoren');
 const saved=engine.config.rules[0];
 assert.equal(saved.conditions.length,3,'det gamla villkoret är kvar');
 assert.deepEqual(saved.conditions[0],{field:'subject',op:'contains',value:'WordPress'});
 assert.deepEqual(saved.conditions[1],{field:'sender',op:'equals',value:'wordpress@limoeurope.com'});
 assert.deepEqual(saved.conditions[2],{field:'domain',op:'equals',value:'fortnox.se'});
 assert.equal(saved.target,'fin','målmappen rörs inte');
 assert.equal(saved.readFilter,'read','läsläget rörs inte');
 assert.equal(saved.name,'Webbsupport','namnet rörs inte');
 assert.equal(engine.config.revision,4,'sparningen höjer revisionen');
 assert.equal(engine.config.rulesVersion,3,'cachen läses om så gamla mejl matchas av det nya villkoret');
 assert.ok(app.logs.some(l=>l.event==='rules_saved'));
});

/* ===== Olästa mejl ska öppnas EFTER flytten – inte som en tom ruta ===== */
function unreadEngine(app,over={}){
 return fakeEngine(app,{config:{schema:1,revision:0,rulesVersion:0,paused:false,dryRun:false,moveMode:'direct',hourly:true,sweepMinutes:60,
  newInboxDirect:true,openWindow:true,verbose:true,fileLog:true,rules:[{id:'r1',enabled:true,name:'Jetpack',unreadAction:'window'}]},
  findByHeader:async()=>null,...over});
}

test('olästa mejlet öppnas först när det ligger i målmappen',async()=>{
 const {app,tick,api}=await loadBackground();
 inboxAccount(api);
 let gets=0;
 api.messages.get=async id=>{gets++;return {id,folder:{id:gets<3?'inbox':'fin'}};};
 const opened=[];api.messageDisplay.open=async arg=>{opened.push(arg);};
 api.messages.update=async()=>{};
 unreadEngine(app);
 const id=await tick.settle(app.openUnread(7,'r1','fin','<h@x>'),80);
 assert.equal(id,7);
 assert.equal(opened.length,1,'exakt ett fönster');
 assert.equal(opened[0].messageId,7);
 assert.equal(opened[0].location,'window');
 assert.ok(gets>=3,'vi väntade tills mejlet syntes i målmappen (anrop: '+gets+')');
});

test('inget fönster alls om mejlet aldrig når målmappen',async()=>{
 const {app,tick,api}=await loadBackground();
 inboxAccount(api);
 api.messages.get=async id=>({id,folder:{id:'inbox'}});
 const opened=[];api.messageDisplay.open=async()=>{opened.push(1);};
 unreadEngine(app,{findByHeader:async()=>null});
 const id=await tick.settle(app.openUnread(7,'r1','fin','<h@x>'),80);
 assert.equal(id,null);
 assert.equal(opened.length,0,'hellre inget fönster än en tom ruta');
 assert.ok(app.logs.some(l=>/kunde inte hittas i malmappen/.test(l.data?.detail||'')),'orsaken skrivs till loggen');
});

test('mejlet hittas via Message-ID när id:t bytts vid flytten',async()=>{
 const {app,tick,api}=await loadBackground();
 inboxAccount(api);
 api.messages.get=async()=>{throw new Error('finns inte längre');};
 const opened=[];api.messageDisplay.open=async arg=>{opened.push(arg);};
 api.messages.update=async()=>{};
 let lookups=0;
 unreadEngine(app,{findByHeader:async(folder,header)=>{lookups++;return lookups<2?null:{id:99,folder:{id:folder},headerMessageId:header};}});
 const id=await tick.settle(app.openUnread(7,'r1','fin','<h@x>'),80);
 assert.equal(id,99,'öppnar id:t i målmappen, inte det gamla');
 assert.equal(opened[0].messageId,99);
});

test('startraden och loggfilen bär både tilläggets och Thunderbirds version',async()=>{
 const api=stubApi();
 api.runtime.getBrowserInfo=async()=>({name:'Thunderbird',version:'140.4.2'});
 const downloaded=[];
 api.downloads.download=async arg=>{downloaded.push(arg);return 1;};
 let logText='';
 api.__captureBlob=blob=>{logText=String(blob?.parts?.[0]||'');return 'blob:x';};
 const {app,tick}=await loadBackground(api);
 fakeEngineWithRules(app,{config:{schema:1,revision:0,rulesVersion:0,paused:false,dryRun:true,moveMode:'read',hourly:true,sweepMinutes:60,newInboxDirect:true,openWindow:true,verbose:true,fileLog:true,rules:[]}});
 assert.equal(await app.readTbVersion(),'140.4.2','Thunderbirds version läses in');
 app.log('debug',0,app.startDetail());
 const start=app.logs.find(l=>/thunderbird /.test(l.data?.detail||''));
 assert.ok(start,'versionsraden hamnar i loggen');
 assert.match(start.data.detail,/thunderbird 140\.4\.2/,'Thunderbirds version står i raden');
 assert.match(start.data.detail,/sortbro /,'tilläggsversionen står där också');
 assert.equal(start.event,'debug','raden är en debug-rad – bara de bär detaljtext');
 app.scheduleTextLog();
 await tick.flush(20);
 await tick.settle(Promise.resolve(),20);
 assert.deepEqual([...new Set(downloaded.map(d=>d.filename))],['Lasfilter/lasfilter-logg.txt'],'loggfilen skrivs dit den ska');
 assert.match(logText,/Thunderbird: 140\.4\.2/,'loggfilens huvud visar Thunderbirds version');
 assert.match(logText,/sortbro /,'och startraden med båda versionerna finns i filen');
});

test('utan svar om Thunderbirds version skrivs raden ändå, utan att ljuga',async()=>{
 const api=stubApi();
 api.runtime.getBrowserInfo=async()=>{throw new Error('inte tillgängligt');};
 const {app}=await loadBackground(api);
 fakeEngineWithRules(app);
 assert.equal(await app.readTbVersion(),'','ingen version kunde läsas');
 app.log('debug',0,app.startDetail());
 const start=app.logs.find(l=>/thunderbird /.test(l.data?.detail||''));
 assert.ok(start,'versionsraden hamnar i loggen ändå');
 assert.match(start.data.detail,/thunderbird okand/,'okänd version skrivs som okänd');
 assert.match(start.data.detail,/sortbro /,'tilläggsversionen är med ändå');
});

test('inget fönster om mejlet ligger rätt men kroppen inte går att läsa',async()=>{
 const {app,tick,api}=await loadBackground();
 inboxAccount(api);
 api.messages.get=async id=>({id,folder:{id:'fin'}});
 api.messages.getFull=async()=>{throw new Error('meddelandet är inte nedladdat');};
 const opened=[];api.messageDisplay.open=async()=>{opened.push(1);};
 unreadEngine(app);
 const id=await tick.settle(app.openUnread(7,'r1','fin','<h@x>'),80);
 assert.equal(id,null);
 assert.equal(opened.length,0,'hellre inget fönster än en tom ruta');
 assert.ok(app.logs.some(l=>/gick inte att lasa/.test(l.data?.detail||'')),'orsaken skrivs till loggen');
});

test('fönstret öppnas på meddelandets identitet om id:t hunnit bytas',async()=>{
 const {app,tick,api}=await loadBackground();
 inboxAccount(api);
 api.messages.get=async id=>({id,folder:{id:'fin'}});
 const opened=[];
 api.messageDisplay.open=async arg=>{if(arg.messageId)throw new Error('okänt id');opened.push(arg);};
 api.messages.update=async()=>{};
 unreadEngine(app);
 const id=await tick.settle(app.openUnread(7,'r1','fin','<h@x>'),80);
 assert.equal(id,7);
 assert.equal(opened.length,1,'andra försöket öppnade fönstret');
 assert.equal(opened[0].headerMessageId,'<h@x>');
 assert.equal(opened[0].location,'window');
});

test('loggen får kvitto på att fönstret visade mejlet',async()=>{
 const api=stubApi();
 const listeners=[];
 api.messageDisplay.onMessagesDisplayed.addListener=fn=>{listeners.push(fn);};
 api.messageDisplay.getDisplayedMessages=async tabId=>(tabId===5?[{id:99,headerMessageId:'<h@x>'}]:[]);
 const {app,tick}=await loadBackground(api);
 inboxAccount(api);
 api.messages.get=async id=>({id,folder:{id:'fin'}});
 api.messages.update=async()=>{};
 api.messageDisplay.open=async()=>{};
 unreadEngine(app);
 const id=await tick.settle(app.openUnread(7,'r1','fin','<h@x>'),80);
 assert.equal(id,7);
 assert.ok(listeners.length>=1,'visningslyssnaren är kopplad');
 for(const fn of listeners)fn({id:5});
 await tick.settle(Promise.resolve(),12);
 assert.ok(app.logs.some(l=>/visades i fonstret/.test(l.data?.detail||'')),'kvittot skrivs till loggen');
});

test('unreadAction=read markerar läst i målmappen och öppnar inget fönster',async()=>{
 const {app,tick,api}=await loadBackground();
 inboxAccount(api);
 api.messages.get=async id=>({id,folder:{id:'fin'}});
 const opened=[],updated=[];api.messageDisplay.open=async()=>{opened.push(1);};
 api.messages.update=async(id,patch)=>{updated.push({id,patch});};
 unreadEngine(app,{config:{schema:1,revision:0,rulesVersion:0,paused:false,dryRun:false,moveMode:'direct',hourly:true,sweepMinutes:60,
  newInboxDirect:true,openWindow:true,verbose:true,fileLog:true,rules:[{id:'r1',enabled:true,name:'Jetpack',unreadAction:'read'}]}});
 const id=await tick.settle(app.openUnread(7,'r1','fin','<h@x>'),80);
 assert.equal(id,7);
 assert.equal(opened.length,0,'läsläget öppnar inget fönster');
 await tick.flush(20);
 assert.ok(updated.some(x=>x.id===7&&x.patch.read===true),'mejlet markeras läst');
});

test('importen vägrar dubbletter, tom text och okänd regel',async()=>{
 const {app,api}=await loadBackground();
 inboxAccount(api);
 const existing=C.validateRule({id:'r9',name:'Klarna',enabled:true,source:'inbox',sourceAccount:'a',target:'fin',match:'any',
  conditions:[{field:'domain',op:'equals',value:'klarna.se'}],branches:[]});
 fakeEngineWithRules(app,{config:{schema:1,revision:0,rulesVersion:0,paused:false,dryRun:true,moveMode:'read',hourly:true,sweepMinutes:60,
  newInboxDirect:true,openWindow:true,verbose:true,fileLog:true,rules:[existing]}});
 await assert.rejects(()=>app.handle({type:'importConditions',revision:0,ruleId:'r9',text:'KLARNA.SE'}),err=>err.code==='duplicate_id');
 await assert.rejects(()=>app.handle({type:'importConditions',revision:0,ruleId:'r9',text:'   ,  '}),err=>err.code==='bad_value');
 await assert.rejects(()=>app.handle({type:'importConditions',revision:0,ruleId:'finns-inte',text:'x.se'}),err=>err.code==='bad_id');
});
