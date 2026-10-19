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
async function loadBackground(api=stubApi(),options={}){
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
  /* Stubbmotorn får samma grundbeteende som den riktiga: den är bara igång när den har
     en giltig konfiguration med minst en aktiv regel. Annars kan startvägen inte testas. */
  LasEngine:options.LasEngine||class{constructor(api,cfg){this.config=cfg&&typeof cfg==='object'?cfg:{};this.fault='';this.pending=new Map();this.inflight=new Map();this.lastSweep=null;this.sweeping=0;
   this.stats={checks:0,matched:0,moved:0,simulated:0,skipped:0};}
   enabled(){return !this.config.paused&&Array.isArray(this.config.rules)&&this.config.rules.some(r=>r&&r.enabled);}
   sweepAll(){return Promise.resolve({scanned:0,queued:0,deferred:0,searchedFolders:0,skippedFolders:0,emptyFolders:0,cachedFolders:0});}
   tick(){return Promise.resolve();}restore(){return Promise.resolve();}stop(){}clearPending(){return Promise.resolve();}
   invalidateFolders(){}recordList(){return [];}blocked(){return 0;}},
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
  clearPending:async()=>{},invalidateFolders(){},recordList:()=>[],blocked:()=>0,validateRuleFolders:async()=>{},
  heldRule:()=>null,heldList:()=>[],releaseRule(){},sweepRule:async()=>({scanned:0,queued:0}),...over};
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

test('allt som skrivs hamnar i en undermapp till appmappen – inget löst i Hämtade filer',async()=>{
 const {api,written}=backupApi();
 const {app}=await loadBackground(api);
 fakeEngineWithRules(app,{config:backupConfig([exportRule])});
 await app.autoBackup({force:true});
 await app.writeTextLog();
 assert.ok(written.length>=2,'både loggfilen och kopian skrevs');
 for(const file of written){
  assert.match(file,/^Lasfilter\//,'allt ligger i appmappen: '+file);
  assert.match(file,/^Lasfilter\/[^/]+\/.+/,'och i en undermapp till den, inte löst i appmappen: '+file);
 }
 /* deepEqual går inte över vm-gränsen: jämför JSON i stället. */
 assert.equal(JSON.stringify(app.paths),JSON.stringify({root:'Lasfilter/',logs:'Lasfilter/Loggar/',backups:'Lasfilter/Regelbackuper/',rules:'Lasfilter/Regler/',filters:'Lasfilter/Filterfiler/'}),'mappordningen är den utlovade');
 const snap=app.snapshot();
 assert.equal(snap.paths.logs,'Lasfilter/Loggar/','gränssnittet får samma sökvägar som filskrivningen använder');
 assert.equal(app.backupFolder,app.paths.backups,'kopian använder sökvägen från samma källa');
});

test('säkerhetskopian skriver reglerna till Hämtade filer – och de kan läsas tillbaka',async()=>{
 const {api,files,written}=backupApi();
 const {app}=await loadBackground(api);
 fakeEngineWithRules(app,{config:backupConfig([exportRule])});
 const r=await app.autoBackup({force:true});
 assert.equal(r.written,true,'kopian skrevs');
 assert.equal(r.count,1,'en regel i kopian');
 assert.ok(written.includes('Lasfilter/Regelbackuper/sortbro-regler-backup.json'),'senaste kopian hamnar i backupernas egen undermapp');
 assert.match(r.dated,/^Lasfilter[\\/]Regelbackuper[\\/]sortbro-regler-\d{4}-\d{2}-\d{2}\.json$/,'en daterad veckokopia');
 assert.match(r.week,/^\d{4}-W\d{2}$/,'veckan anges som 2026-W43');
 const payload=JSON.parse(files['Lasfilter/Regelbackuper/sortbro-regler-backup.json']);
 assert.equal(payload.format,'lasfilter-rules','samma format som den manuella exporten');
 assert.equal(payload.app,'SortBro');
 assert.equal(payload.rules.length,1);
 assert.ok(payload.exported,'tidsstämpel finns');
 const back=app.extractImportedRules(payload,[{id:'fin',accountId:'a',name:'Fakturor'}],[]);
 assert.equal(back.length,1,'filen går att importera tillbaka');
 assert.equal(back[0].name,'Fakturor');
 assert.equal(back[0].target,'fin');
});

test('kopian skrivs när reglerna ändrats – men bara en veckokopia per vecka, och aldrig när rutan är av',async()=>{
 const {api,written}=backupApi();
 const {app}=await loadBackground(api);
 fakeEngineWithRules(app,{config:backupConfig([exportRule])});
 await app.autoBackup({force:true});
 const after=written.length;
 const sameWeek=await app.autoBackup();
 assert.equal(sameWeek.written,false,'oförändrade regler samma vecka skrivs inte om');
 assert.equal(sameWeek.reason,'unchanged');
 assert.equal(written.length,after,'ingen ny fil i onödan');
 app.engine.config={...app.engine.config,rules:[{...exportRule,name:'Fakturor 2'}]};
 const changed=await app.autoBackup();
 assert.equal(changed.written,true,'en ändrad regel skrivs');
 assert.equal(written.length,after+1,'bara den senaste filen skrivs om – ingen ny veckokopia');
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

test('gamla veckokopior städas – men bara våra egna i vår egen mapp',async()=>{
 const {api,removed,getQuery}=backupApi();
 const old=new Date(Date.now()-100*86400000).toISOString();
 api.__searchResult=[
  {id:11,startTime:old,filename:'Lasfilter/Regelbackuper/sortbro-regler-2025-01-01.json'},
  {id:12,startTime:new Date().toISOString(),filename:'Lasfilter/Regelbackuper/sortbro-regler-2026-10-16.json'}
 ];
 const {app}=await loadBackground(api);
 fakeEngineWithRules(app,{config:backupConfig([exportRule])});
 await app.autoBackup({force:true});
 assert.deepEqual(removed,[11],'bara den för gamla filen tas bort');
 const re=new RegExp(getQuery().filenameRegex);
 assert.ok(re.test('C:'+String.fromCharCode(92)+'Downloads'+String.fromCharCode(92)+'Lasfilter'+String.fromCharCode(92)+'Regelbackuper'+String.fromCharCode(92)+'sortbro-regler-2026-10-16.json'),'våra dagsfiler matchas');
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

/* ── Autostart: ta igen det som missades medan datorn var av ──────────── */

test('senaste svepet sparas och läses tillbaka – starten vet om det är försenat',async()=>{
 const {api}=backupApi();
 const stored={};
 api.storage={local:{get:async keys=>{
  const out={};
  for(const k of [].concat(keys||[]))if(k in stored)out[k]=stored[k];
  return out;
 },set:async obj=>{Object.assign(stored,obj);}}};
 const {app}=await loadBackground(api);
 fakeEngine(app,{config:{paused:false,hourly:true,sweepMinutes:60,moveMode:'read',dryRun:true,rules:[{id:'r1',enabled:true}],revision:0,rulesVersion:0}});
 app.lastAutoSweep=null;app.engine.lastSweep=null;
 assert.equal(app.sweepOverdue(Date.now()),true,'utan sparat svep är det alltid dags');
 await app.saveSweepState(1000);
 assert.equal(stored.sweepAt,1000,'tiden skrivs till lagringen');
 app.lastAutoSweep=null;app.engine.lastSweep=null;
 assert.equal(await app.loadSweepState(),1000,'och läses tillbaka');
 app.lastAutoSweep=Date.now()-30*60000;app.engine.lastSweep=null;
 assert.equal(app.sweepOverdue(),false,'en halvtimme sedan är inte försenat med en timmes intervall');
 app.lastAutoSweep=Date.now()-90*60000;
 assert.equal(app.sweepOverdue(),true,'90 minuter sedan är försenat med en timmes intervall');
 app.engine.config.hourly=false;
 assert.equal(app.sweepOverdue(),false,'med timersvepet avstängt är inget försenat');
});

test('ett försenat svep tas igen direkt vid start i stället för att vänta en timme',async()=>{
 const {api}=backupApi();
 const stored={sweepAt:1000,config:{schema:1,revision:0,rulesVersion:0,paused:false,dryRun:true,moveMode:'read',hourly:true,sweepMinutes:60,
  newInboxDirect:true,openWindow:true,verbose:true,fileLog:true,autoBackup:true,rules:[{id:'r1',name:'Test',enabled:true,scope:'folder',source:'inbox',sourceAccount:'a',target:'fin',match:'all',readFilter:'both',unreadAction:'keep',yearFolders:false,branches:[],conditions:[{field:'domain',op:'equals',value:'x.se'}]}]}};
 api.storage={local:{get:async keys=>{const out={};for(const k of [].concat(keys||[]))if(k in stored)out[k]=stored[k];return out;},set:async obj=>{Object.assign(stored,obj);}}};
 const calls=[];
 const {app,tick}=await loadBackground(api);
 fakeEngine(app,{config:{paused:false,hourly:true,sweepMinutes:60,moveMode:'read',dryRun:true,rules:[{id:'r1',enabled:true}],revision:0,rulesVersion:0},
  sweepAll:async opts=>{calls.push(opts);return {scanned:5,queued:2,deferred:0,searchedFolders:3,skippedFolders:0,emptyFolders:0,cachedFolders:2};}});
 app.lastAutoSweep=1000;
 /* Starten har redan lagt sitt svep i timern (800 ms eftersom det är försenat). */
 await tick.flush(20);
 assert.ok(calls.length>=1,'starten sveper direkt när förra svepet är gammalt');
 assert.equal(app.startSweepDone,true,'startsvepet markeras som gjort');
 assert.equal(app.logs.some(l=>/forsenat/.test(l.data?.detail||'')),true,'loggen säger varför det kördes direkt');
});

test('startar alltid med ett svep när bevakningen är på, även utan timersvep',async()=>{
 const {api}=backupApi();
 const stored={config:{schema:1,revision:0,rulesVersion:0,paused:false,dryRun:true,moveMode:'read',hourly:false,sweepMinutes:60,
  newInboxDirect:true,openWindow:true,verbose:true,fileLog:true,autoBackup:true,rules:[{id:'r1',name:'Test',enabled:true,scope:'folder',source:'inbox',sourceAccount:'a',target:'fin',match:'all',readFilter:'both',unreadAction:'keep',yearFolders:false,branches:[],conditions:[{field:'domain',op:'equals',value:'x.se'}]}]}};
 api.storage={local:{get:async keys=>{const out={};for(const k of [].concat(keys||[]))if(k in stored)out[k]=stored[k];return out;},set:async obj=>{Object.assign(stored,obj);}}};
 const calls=[];
 const {app,tick}=await loadBackground(api);
 fakeEngine(app,{config:{paused:false,hourly:false,sweepMinutes:60,moveMode:'read',dryRun:true,rules:[{id:'r1',enabled:true}],revision:0,rulesVersion:0},
  sweepAll:async opts=>{calls.push(opts);return {scanned:4,queued:1,deferred:0,searchedFolders:2,skippedFolders:0,emptyFolders:0,cachedFolders:1};}});
 await tick.flush(20);
 assert.equal(calls.length,1,'ett svep vid start även om timersvepet är avstängt');
 assert.equal(app.startSweepDone,true);
});

test('pausad eller utan regler sveper starten aldrig',async()=>{
 const {api}=backupApi();
 api.storage={local:{get:async()=>({}),set:async()=>{}}};
 const calls=[];
 const {app,tick}=await loadBackground(api);
 fakeEngine(app,{enabled:()=>false,config:{paused:true,hourly:true,sweepMinutes:60,moveMode:'read',dryRun:true,rules:[{id:'r1',enabled:true}],revision:0,rulesVersion:0},
  sweepAll:async opts=>{calls.push(opts);return {scanned:0,queued:0,deferred:0,searchedFolders:0,skippedFolders:0,emptyFolders:0,cachedFolders:0};}});
 await tick.flush(20);
 assert.equal(calls.length,0,'pausad bevakning ska vara tyst');
});

test('efter datorns sömn tas ett försenat svep igen vid första ticken',async()=>{
 const {app,tick}=await loadBackground();
 const calls=[];
 fakeEngine(app,{config:{paused:false,hourly:true,sweepMinutes:60,moveMode:'read',dryRun:true,rules:[{id:'r1',enabled:true}],revision:0,rulesVersion:0},
  sweepAll:async opts=>{calls.push(opts);return {scanned:4,queued:1,deferred:0,searchedFolders:2,skippedFolders:0,emptyFolders:0,cachedFolders:1};}});
 app.lastAutoSweep=Date.now()-3*60*60000;app.engine.lastSweep=null;
 /* Simulera tre timmars sömn: klockan hoppar fram och nästa tick ser ett stort glapp. */
 app.lastTickAt=Date.now()-3*60*60000;
 await tick.flush(5);
 await tick.settle(app.autoSweep());
 assert.ok(calls.length>=1,'glappet upptäcks och svepet tas igen');
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

test('quickPreview räknar bara kontot regeln gäller – och bara mejl som flyttas',async()=>{
 const {app,api}=await loadBackground();
 api.accounts.list=async()=>[
  {id:'a',name:'Jobbet',rootFolder:{id:'root-a',accountId:'a',name:'',specialUse:[],subFolders:[
   {id:'in-a',accountId:'a',name:'Inkorg',specialUse:['inbox'],subFolders:[]},
   {id:'fin-a',accountId:'a',name:'Fakturor',specialUse:[],subFolders:[]}]}},
  {id:'b',name:'Privat',rootFolder:{id:'root-b',accountId:'b',name:'',specialUse:[],subFolders:[
   {id:'in-b',accountId:'b',name:'Inkorg',specialUse:['inbox'],subFolders:[]},
   {id:'fin-b',accountId:'b',name:'Fakturor',specialUse:[],subFolders:[]}]}}];
 api.messages.query=async q=>{const acc=q.folderId==='in-b'?'b':'a';return {id:null,messages:[
  {id:1,author:'Order <order@klarna.se>',subject:'Order bekräftad',folder:{id:q.folderId,accountId:acc},read:true},
  {id:2,author:'Order <order@klarna.se>',subject:'Order skickad',folder:{id:q.folderId,accountId:acc},read:true},
  {id:3,author:'Order <order@klarna.se>',subject:'Order levererad',folder:{id:q.folderId,accountId:acc},read:false},
  {id:4,author:'Order <order@klarna.se>',subject:'Order arkiverad',folder:{id:q.folderId,accountId:acc},read:false}]};};
 fakeEngineWithRules(app);
 const everything=await app.quickPreview({field:'domain',value:'klarna.se'});
 assert.equal(everything.matched,8,'båda kontonas inkorgar skannas');
 const jobbet=await app.quickPreview({field:'domain',value:'klarna.se',accountId:'a'});
 assert.equal(jobbet.matched,4,'bara jobbkontots mejl räknas när målmappen ligger där');
 assert.equal(jobbet.unread,2);
 assert.equal(jobbet.matches,4,'olästa får följa med när kryssrutan är i');
 assert.equal(jobbet.allowUnread,true);
 const utanOlästa=await app.quickPreview({field:'domain',value:'klarna.se',accountId:'a',allowUnread:false});
 assert.equal(utanOlästa.matches,2,'utan olästa flyttas bara de två lästa');
 assert.equal(utanOlästa.matched,4,'men texten kan säga hur många som matchar totalt');
 assert.equal(utanOlästa.unread,2);
 assert.equal(utanOlästa.allowUnread,false);
 const privat=await app.quickPreview({field:'domain',value:'klarna.se',accountId:'b'});
 assert.equal(privat.matched,4,'det andra kontot har sina egna fyra');
 assert.equal(privat.unread,2);
 assert.equal(app.engine.config.rules.length,0,'fortfarande inget sparat');
});

test('Inkorgen läses en gång, och siffran säger när den inte är hela sanningen',async()=>{
 const {app,api}=await loadBackground();
 inboxAccount(api);
 let calls=0;const real=api.messages.query;
 api.messages.query=async q=>{calls++;return real(q);};
 fakeEngineWithRules(app);
 const tight=await app.scanInbox({limit:2});
 assert.equal(calls,1,'en läsning räcker för en inkorg');
 assert.equal(tight.scanned,4);
 assert.equal(tight.capped,true,'taket rapporteras i stället för att låtsas');
 const again=await app.scanInbox({limit:2});
 assert.equal(calls,1,'cachen används – Inkorgen läses inte om för varje bokstav');
 assert.equal(again.capped,true);
 const roomy=await app.scanInbox();
 assert.equal(calls,2,'ett större tak kräver en ny läsning');
 assert.equal(roomy.capped,false,'allt ryms och siffran är hela sanningen');
 const forced=await app.scanInbox({force:true});
 assert.equal(calls,3,'force läser om Inkorgen');
 assert.equal(forced.capped,false);
 app.invalidateScan();
 await app.scanInbox();
 assert.equal(calls,4,'efter en flyttning läses Inkorgen om');
 const hints=await app.inboxHints({force:true});
 assert.equal(calls,5,'↻-knappen läser om allt');
 assert.equal(hints.capped,false);
 const cached=await app.inboxHints();
 assert.equal(calls,5,'förslagen återanvänder samma läsning');
 assert.equal(cached.scanned,4);
});

test('förslagen räcker till "visa fler" – bakgrunden skickar fler än de åtta som visas',async()=>{
 const {app,api}=await loadBackground();
 inboxAccount(api);
 const messages=[];let id=0;
 for(let i=0;i<12;i++)for(let j=0;j<2;j++)messages.push({id:++id,author:'Avsändare <info@domain'+i+'.se>',subject:'Nyhet nummer '+i,folder:{id:'inbox',accountId:'a'},read:true});
 api.messages.query=async()=>({id:null,messages});
 fakeEngineWithRules(app);
 const hints=await app.inboxHints();
 assert.equal(hints.senders.length,12,'tolv avsändare, varav de åtta första visas direkt');
 assert.ok(hints.senders.length>8,'fler än gränssnittet visar, alltså finns "visa fler" att klicka på');
 assert.equal(hints.words.length>0,true,'ämnesorden följer med som förut');
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
 const logs=[...new Set(downloaded.map(d=>d.filename))].filter(f=>/lasfilter-logg\.txt$/.test(f));
 assert.deepEqual(logs,['Lasfilter/Loggar/lasfilter-logg.txt'],'loggfilen skrivs till Loggar-mappen, inte löst i appmappen');
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

/* ── Säkerhetsbromsen: gränsen, minnet och svaren i gränssnittet ───────── */

test('bromsens gräns: tio gånger det vanliga, aldrig under 50 mejl',async()=>{
 const {app}=await loadBackground();
 fakeEngineWithRules(app,{config:{schema:1,revision:0,rulesVersion:0,paused:false,dryRun:true,moveMode:'read',hourly:true,sweepMinutes:60,
  newInboxDirect:true,openWindow:true,verbose:true,fileLog:true,brake:true,rules:[{id:'r1',name:'A',enabled:true},{id:'r2',name:'B',enabled:true}]}});
 assert.equal(app.brakeLimit({id:'r1'}).limit,50,'utan historik gäller golvet 50');
 app.brakeHistory={r1:[4,4,4,4],r2:[100,100,100]};
 assert.equal(app.brakeLimit({id:'r1'}).limit,50,'fyra mejl i snitt ger ändå 50');
 assert.equal(app.brakeLimit({id:'r1'}).median,4);
 assert.equal(app.brakeLimit({id:'r2'}).limit,1000,'etthundra i snitt ger 1000');
 app.engine.config.brake=false;
 assert.equal(app.brakeLimit({id:'r1'}),null,'avstängd broms har ingen gräns');
});

test('bromsens minne: tio tal per regel, aldrig noll eller stoppade regler',async()=>{
 const {app}=await loadBackground();
 fakeEngineWithRules(app,{config:{schema:1,revision:0,rulesVersion:0,paused:false,dryRun:true,moveMode:'read',hourly:true,sweepMinutes:60,
  newInboxDirect:true,openWindow:true,verbose:true,fileLog:true,brake:true,rules:[{id:'r1',name:'A',enabled:true}]}});
 for(let i=0;i<14;i++)app.brakeRecord({id:'r1'},{wouldQueue:5+i});
 assert.equal(app.brakeHistory.r1.length,10,'bara de tio senaste sparas');
 assert.equal(app.brakeHistory.r1[9],18,'det senaste talet ligger sist');
 app.brakeRecord({id:'r1'},{wouldQueue:900,held:true});
 assert.equal(app.brakeHistory.r1[9],18,'en stoppad regel ändrar inte minnet – annars vore bromsen verkningslös nästa gång');
 app.brakeRecord({id:'r1'},{wouldQueue:0});
 assert.equal(app.brakeHistory.r1[9],18,'noll flyttar säger ingenting om nivån');
 app.brakeRecord({id:'r2'},{wouldQueue:7});
 assert.equal(app.brakeHistory.r2[0],7,'nya regler får eget minne');
});

test('bromsens svar: Flytta ändå släpper regeln och kör den direkt',async()=>{
 const {app}=await loadBackground();
 let held={ruleId:'r1',matched:300,limit:50,median:5};
 const calls=[];
 const engine=fakeEngine(app,{config:{schema:1,revision:0,rulesVersion:0,paused:false,dryRun:false,moveMode:'read',hourly:false,sweepMinutes:60,
  newInboxDirect:true,openWindow:true,verbose:true,fileLog:true,brake:true,rules:[{id:'r1',name:'Google',enabled:true,target:'f'}]},
  heldRule:id=>held&&held.ruleId===id?held:null,
  heldList:()=>held?[held]:[],
  releaseRule:id=>{calls.push(['release',id]);held=null;},
  sweepRule:async(rule,opts)=>{calls.push(['sweep',rule.id,opts.force]);return {scanned:9,queued:8};}});
 const out=await app.handle({type:'brakeRelease',ruleId:'r1'});
 assert.equal(calls[0][0],'release','spärren släpps först');
 assert.equal(calls.some(c=>c[0]==='sweep'&&c[1]==='r1'&&c[2]===true),true,'regeln körs direkt och läser om allt');
 assert.equal(app.brakeHistory.r1.slice(-1)[0],300,'nivån du godkände blir regelns nya normalnivå');
 assert.equal(out.result.queued,8,'resultatet från körningen följer med');
 assert.equal(out.status.brakeHolds.length,0,'ingen stoppad regel kvar i statusen');
 assert.equal(engine.heldRule('r1'),null);
});

test('bromsens svar: Stäng av regeln stänger av den i stället',async()=>{
 const {app}=await loadBackground();
 let held={ruleId:'r1',matched:300,limit:50,median:5};
 const engine=fakeEngine(app,{config:{schema:1,revision:0,rulesVersion:0,paused:false,dryRun:false,moveMode:'read',hourly:false,sweepMinutes:60,
  newInboxDirect:true,openWindow:true,verbose:true,fileLog:true,brake:true,
  rules:[{id:'r1',name:'Google',enabled:true,scope:'folder',source:'inbox',sourceAccount:'',target:'fin',match:'all',readFilter:'both',unreadAction:'keep',yearFolders:false,branches:[],conditions:[{field:'domain',op:'equals',value:'gmail.com'}]}]},
  heldRule:id=>held&&held.ruleId===id?held:null,
  heldList:()=>held?[held]:[],releaseRule:()=>{held=null;}});
 const status=await app.handle({type:'brakeCancel',ruleId:'r1'});
 assert.equal(status.config.rules[0].enabled,false,'regeln stängs av');
 assert.equal(engine.config.rules[0].enabled,false,'och det sparas i konfigurationen');
 assert.equal(status.brakeHolds.length,0,'spärren är släppt');
});

test('bromsens svar avvisas för en regel som inte är stoppad',async()=>{
 const {app}=await loadBackground();
 fakeEngineWithRules(app,{heldRule:()=>null,heldList:()=>[]});
 await assert.rejects(()=>app.handle({type:'brakeRelease',ruleId:'r1'}),'inget att släppa');
 await assert.rejects(()=>app.handle({type:'brakeCancel',ruleId:'nope'}),'okänd regel');
});

test('statusen visar stoppade regler med namn och antal',async()=>{
 const {app}=await loadBackground();
 fakeEngine(app,{config:{schema:1,revision:0,rulesVersion:0,paused:false,dryRun:false,moveMode:'read',hourly:false,sweepMinutes:60,
  newInboxDirect:true,openWindow:true,verbose:true,fileLog:true,brake:true,rules:[{id:'r1',name:'Google',enabled:true,target:'f'}]},
  heldList:()=>[{ruleId:'r1',matched:837,limit:50,median:5}],heldRule:()=>({matched:837})});
 const snap=app.snapshot();
 assert.equal(snap.brakeHolds.length,1);
 assert.equal(snap.brakeHolds[0].name,'Google','namnet följer med så gränssnittet kan förklara');
 assert.equal(snap.brakeHolds[0].matched,837);
 assert.equal(snap.brake,true);
});

test('minnet fylls på när ett svep blir klart – annars vore gränsen alltid 50',async()=>{
 const {app}=await loadBackground();
 const engine=fakeEngineWithRules(app,{config:{schema:1,revision:0,rulesVersion:0,paused:false,dryRun:false,moveMode:'read',hourly:false,sweepMinutes:60,
  newInboxDirect:true,openWindow:true,verbose:true,fileLog:true,brake:true,rules:[{id:'r1',name:'A',enabled:true}]}});
 /* Motorn anropar kroken efter varje avslutat svep. */
 app.brakeRecord({id:'r1'},{wouldQueue:12});
 app.brakeRecord({id:'r1'},{wouldQueue:14});
 assert.equal(app.brakeHistory.r1.length,2);
 assert.equal(app.brakeLimit({id:'r1'}).limit,140,'medianen 14 ger tio gånger, alltså 140 – över golvet 50');
 app.brakeRecord({id:'r1'},{wouldQueue:40});
 assert.equal(app.brakeLimit({id:'r1'}).limit,140,'14 i median ger 140 – alltså inte 10x14=140');
 assert.equal(engine.config.brake,true);
});

/* ── Hela vägen: bakgrunden + den riktiga motorn + lagringen ───────────── */

test('bromsen fungerar hela vägen från svep till statusruta',async()=>{
 const Engine=require(path.join(ROOT,'addon','engine.js'));
 const api=stubApi();
 const inbox=[];
 for(let i=1;i<=60;i++)inbox.push({id:i,read:true,folder:{id:'inbox',accountId:'a'},
  author:'Butik <butik@lojal.se>',subject:'Din order '+i,date:new Date('2026-10-01T08:00:00Z'),size:1000,headerMessageId:'m'+i+'@lojal.se'});
 const root={id:'root',accountId:'a',isRoot:true,name:'',specialUse:[],subFolders:[
  {id:'inbox',accountId:'a',name:'Inkorg',specialUse:['inbox'],subFolders:[]},
  {id:'fin',accountId:'a',name:'Fakturor',specialUse:[],subFolders:[]}]};
 api.accounts.list=async()=>[{id:'a',rootFolder:root}];
 api.folders.get=async id=>({id,accountId:'a',name:id,specialUse:[]});
 api.folders.getFolderCapabilities=async()=>({canAddMessages:true,canDeleteMessages:true});
 api.messages.query=async q=>({messages:q.folderId==='inbox'?inbox:[]});
 api.messages.continueList=async()=>({messages:[]});
 api.messages.abortList=async()=>{};
 api.tabs.query=async()=>[];
 const stored={config:{...C.defaults(),dryRun:true,brake:true,hourly:false,
  rules:[{id:'r1',name:'Lojal',enabled:true,scope:'folder',source:'inbox',sourceAccount:'',target:'fin',match:'all',readFilter:'both',unreadAction:'keep',yearFolders:false,branches:[],conditions:[{field:'domain',op:'equals',value:'lojal.se'}]}]}};
 api.storage={local:{get:async keys=>{const out={};for(const k of [].concat(keys||[]))if(k in stored)out[k]=stored[k];return out;},set:async o=>{Object.assign(stored,o);}}};
 const {app,tick}=await loadBackground(api,{LasEngine:Engine});
 /* Låt startens svep köra klart. */
 await tick.flush(50);
 const snap=await app.handle({type:'status'});
 assert.equal(snap.brakeHolds.length,1,'den riktiga motorn stoppade regeln och bakgrunden ser det');
 assert.equal(snap.brakeHolds[0].name,'Lojal','namnet följer med till rutan');
 assert.equal(snap.brakeHolds[0].limit,50,'första svepet har golvet 50');
 assert.equal(snap.brakeHolds[0].matched,51,'bromsen slog till på det 51:a mejlet');
 assert.equal(app.logs.some(l=>l.event==='brake'),true,'händelsen finns i loggen');
 assert.equal(app.engine.pending.size,0,'ingenting ligger kvar i kön');
 assert.equal(app.brakeHistory.r1,undefined,'en stoppad regel skriver ingen ny normalnivå – annars vore bromsen verkningslös nästa svep');
});

/* ── Veckovis säkerhetskopia + manuell knapp ───────────────────────────── */

test('veckonyckeln följer ISO 8601: måndag till söndag hör till samma vecka',async()=>{
 const {app}=await loadBackground();
 assert.equal(app.weekKey(new Date('2026-10-19T12:00:00Z')),'2026-W43','måndag');
 assert.equal(app.weekKey(new Date('2026-10-25T12:00:00Z')),'2026-W43','söndag samma vecka');
 assert.equal(app.weekKey(new Date('2026-10-26T12:00:00Z')),'2026-W44','nästa måndag');
 assert.equal(app.weekKey(new Date('2027-01-04T12:00:00Z')),'2027-W01','första veckan i ett nytt år');
 assert.equal(app.weekKey(new Date('2026-01-01T12:00:00Z')),'2026-W01','årets första dag');
 assert.equal(app.weekKey(new Date('2026-12-31T12:00:00Z')),'2026-W53','ett år med 53 veckor');
});

test('en ny veckokopia skrivs när veckan byts – och bara en per vecka',async()=>{
 const {api,written}=backupApi();
 const {app}=await loadBackground(api);
 fakeEngineWithRules(app,{config:backupConfig([exportRule])});
 /* Första körningen skriver senaste + veckokopia. */
 const first=await app.autoBackup();
 assert.equal(first.written,true);
 assert.match(first.dated,/sortbro-regler-\d{4}-\d{2}-\d{2}\.json$/,'veckokopian har datum i namnet');
 const week1=first.week;
 assert.equal(app.lastBackupWeek,week1);
 const countAfterFirst=written.length;
 /* Samma vecka igen: ingen ny fil. */
 const again=await app.autoBackup();
 assert.equal(again.written,false,'redan skrivet den här veckan');
 assert.equal(written.length,countAfterFirst);
 /* Nästa vecka: en ny daterad kopia. */
 app.lastBackupWeek='2020-W01';
 const next=await app.autoBackup();
 assert.equal(next.written,true,'ny vecka ger en ny kopia');
 assert.equal(written.length,countAfterFirst+2,'senaste + veckokopia skrivs');
 assert.notEqual(next.week,'2020-W01');
});

test('veckan sparas i lagringen så en omstart inte skriver en extra kopia',async()=>{
 const {api}=backupApi();
 const stored={};
 api.storage={local:{get:async keys=>{const out={};for(const k of [].concat(keys||[]))if(k in stored)out[k]=stored[k];return out;},set:async obj=>{Object.assign(stored,obj);}}};
 const {app,tick}=await loadBackground(api);
 fakeEngineWithRules(app,{config:backupConfig([exportRule])});
 await app.autoBackup();
 assert.match(String(stored.backupWeek),/^\d{4}-W\d{2}$/,'veckan skrivs till lagringen');
 /* En ny session läser tillbaka veckan och avstår från att skriva igen. */
 const week=stored.backupWeek;
 const second=await loadBackground(api);
 assert.equal(second.app.lastBackupWeek,week,'veckan läses tillbaka vid start');
 const skip=await second.app.autoBackup();
 assert.equal(skip.dated,'','ingen ny daterad veckokopia samma vecka efter omstart');
 assert.equal(skip.week,week,'samma vecka');
 /* Den alltid-senaste filen skrivs om – det är meningen: den ska vara aktuell. */
 await tick.flush(20);
});

test('knappen Backa upp reglerna nu skriver båda filerna direkt, även mitt i veckan',async()=>{
 const {api,written}=backupApi();
 const {app}=await loadBackground(api);
 fakeEngineWithRules(app,{config:backupConfig([exportRule])});
 await app.autoBackup({force:true});
 const after=written.length;
 /* Mitt i veckan, inget har ändrats – knappen ska ändå skriva. */
 const forced=await app.handle({type:'backupNow'});
 assert.equal(forced.written,true,'knappen skriver direkt');
 assert.equal(written.length,after+2,'både senaste filen och veckokopian skrivs');
 assert.match(forced.filename,/sortbro-regler-backup\.json$/);
 assert.match(forced.dated,/sortbro-regler-\d{4}-\d{2}-\d{2}\.json$/);
});

test('knappen fungerar även när den automatiska rutan är avstängd',async()=>{
 const {api,written}=backupApi();
 const {app}=await loadBackground(api);
 fakeEngineWithRules(app,{config:backupConfig([exportRule])});
 app.engine.config={...app.engine.config,autoBackup:false};
 const off=await app.autoBackup();
 assert.equal(off.reason,'off','automatiken är av');
 const before=written.length;
 const forced=await app.handle({type:'backupNow'});
 assert.equal(forced.written,true,'knappen är manuell och tar inte hänsyn till rutan');
 assert.equal(written.length,before+2,'båda filerna skrivs');
});

test('veckokopior behålls i tolv veckor',async()=>{
 const {app}=await loadBackground();
 assert.equal(app.backupKeepWeeks,12,'tolv veckor sparas');
});
