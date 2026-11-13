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
 const api={Date:FakeDate,now:()=>now,advance:ms=>now+=ms,
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
  crypto:require('node:crypto').webcrypto,Date:tick.Date,setTimeout:tick.setTimeout,clearTimeout:tick.clearTimeout,setInterval:tick.setInterval,clearInterval:tick.clearInterval,
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
 assert.equal(JSON.stringify(app.paths),JSON.stringify({root:'Lasfilter/',logs:'Lasfilter/logs/',backups:'Lasfilter/Regelbackuper/',rules:'Lasfilter/Regler/',filters:'Lasfilter/Filterfiler/'}),'mappordningen är den utlovade');
 const snap=app.snapshot();
 assert.equal(snap.paths.logs,'Lasfilter/logs/','gränssnittet får samma sökvägar som filskrivningen använder');
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

test('kopian skrivs en gång i veckan – inte vid varje regeländring',async()=>{
 const {api,written}=backupApi();
 const {app}=await loadBackground(api);
 fakeEngineWithRules(app,{config:backupConfig([exportRule])});
 await app.autoBackup({force:true});
 const after=written.length;
 const sameWeek=await app.autoBackup();
 assert.equal(sameWeek.written,false,'samma vecka skrivs ingenting');
 assert.equal(sameWeek.reason,'not_due');
 assert.equal(written.length,after,'ingen ny fil i onödan');
 /* Huvudpoängen: en ändrad regel mitt i veckan väntar till veckokörningen. En
    kopia som skrivs vid varje sparning är ett extra skrivsteg, inte en kopia. */
 app.engine.config={...app.engine.config,rules:[{...exportRule,name:'Fakturor 2'}]};
 const changed=await app.autoBackup();
 assert.equal(changed.written,false,'en ändrad regel skrivs inte förrän veckan byts');
 assert.equal(changed.reason,'not_due');
 assert.equal(written.length,after,'inga skrivningar alls');
 /* Ny vecka: båda filerna skrivs, med det nya innehållet. */
 app.lastBackupWeek='2020-W01';
 const next=await app.autoBackup();
 assert.equal(next.written,true,'ny vecka skriver');
 assert.equal(written.length,after+2,'senaste + veckokopia');
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

/* Verifierad öppning: realistiska tab-ID:n, meddelandehuvud och MIME-innehåll. */
function unreadEngine(app,over={}){
 return fakeEngine(app,{records:new Map(),config:{...C.defaults(),dryRun:false,moveMode:'direct',rules:[{id:'r1',enabled:true,name:'Mejl',unreadAction:'window',openTiming:'after'}]},...over});
}
function windowApi(api,app){
 const message={id:99,folder:{id:'fin',accountId:'a'},headerMessageId:'<h@x>',read:false,date:new Date('2026-10-08'),size:100,author:'a@example.se',subject:'Hej'};
 const tabs=new Map(),opened=[],removed=[],updated=[];
 api.messages.query=async q=>({messages:q.folderId===message.folder.id&&q.headerMessageId===message.headerMessageId?[{...message}]:[]});
 api.messages.get=async id=>{if(id!==message.id)throw Error('old id');return {...message};};
 api.messages.getFull=async()=>({headers:{subject:['Hej']},parts:[{contentType:'text/plain',body:'Innehållet'}]});
 api.messages.update=async(id,patch)=>{updated.push({id,patch});Object.assign(message,patch);};
 api.tabs.query=async()=>[...tabs.values()];
 api.tabs.remove=async id=>{removed.push(id);tabs.delete(id);};
 api.messageDisplay.open=async args=>{opened.push(args);const tab={id:10+opened.length,windowId:100+opened.length,type:'messageDisplay'};tabs.set(tab.id,tab);return tab;};
 api.messageDisplay.getDisplayedMessages=async id=>({messages:tabs.has(id)?[{...message}]:[]});
 const fixture={message,tabs,opened,removed,updated,readerReady:true};
 api.runtime.id='test-addon';api.runtime.getURL=p=>'moz-extension://test/'+p;
 api.windows.create=async args=>{
  opened.push(args);const tab={id:10+opened.length,windowId:100+opened.length,type:'content',url:args.url};tabs.set(tab.id,tab);
  const token=args.url.split('#')[1],sender={id:api.runtime.id,url:args.url,tab};
  await app.readerRequest({type:'readerData',token},sender);
  if(fixture.readerReady)await app.readerRequest({type:'readerReady',token},sender);
  return {id:tab.windowId,tabs:[tab]};
 };
 api.windows.remove=async id=>{for(const tab of tabs.values())if(tab.windowId===id){removed.push(tab.id);tabs.delete(tab.id);app.windowClosed(tab.id);}};
 return fixture;
}
test('efter: öppnar mål-ID först efter entydigt mål, tom källa och läsbart innehåll',async()=>{
 const {app,tick,api}=await loadBackground();const w=windowApi(api,app);unreadEngine(app);
 let attempts=0;const query=api.messages.query;
 api.messages.query=async q=>{if(q.folderId==='fin'&&++attempts<3)return {messages:[]};return query(q);};
 const id=await tick.settle(app.openUnread(7,'r1','fin','<h@x>','inbox',+new Date('2026-10-08')),100);
 assert.equal(id,99);assert(attempts>=3);assert.deepEqual(JSON.parse(JSON.stringify(w.opened)),[{messageId:99,location:'window'}]);
 assert(app.logs.some(x=>/verifierat visat/.test(x.data.detail)));assert.equal(app.mailWindows.size,1);
});
test('efter: kopia kvar i källan är inte en verifierad flytt',async()=>{
 const {app,tick,api}=await loadBackground();const w=windowApi(api,app);unreadEngine(app);
 const query=api.messages.query;api.messages.query=async q=>q.folderId==='inbox'?{messages:[{...w.message,id:7,folder:{id:'inbox'}}]}:query(q);
 assert.equal(await tick.settle(app.openUnread(7,'r1','fin','<h@x>','inbox',+new Date('2026-10-08')),100),null);assert.equal(w.opened.length,0);
});
test('efter: okänd källstatus, saknat mål och tvetydigt Message-ID öppnar inget',async()=>{
 for(const mode of ['source-error','missing','duplicate','paged']){
  const {app,tick,api}=await loadBackground();const w=windowApi(api,app);unreadEngine(app);const query=api.messages.query;
  api.messages.query=async q=>{
   if(mode==='source-error'&&q.folderId==='inbox')throw Error('offline');
   if(q.folderId==='fin'&&mode==='missing')return {messages:[]};
   if(q.folderId==='fin'&&mode==='duplicate')return {messages:[w.message,{...w.message,id:100}]};
   if(q.folderId==='fin'&&mode==='paged')return {id:'more',messages:[w.message]};return query(q);
  };
  assert.equal(await tick.settle(app.openUnread(7,'r1','fin','<h@x>','inbox',+new Date('2026-10-08')),100),null,mode);assert.equal(w.opened.length,0,mode);
 }
});
test('efter: oläsbar kropp eller återanvänt sessions-ID får aldrig öppnas',async()=>{
 for(const mode of ['body-error','empty-api','reused-id']){
  const {app,tick,api}=await loadBackground();const w=windowApi(api,app);unreadEngine(app);
  if(mode==='body-error')api.messages.getFull=async()=>{throw Error('offline');};
  if(mode==='empty-api')api.messages.getFull=async()=>[];
  if(mode==='reused-id')api.messages.get=async()=>({...w.message,headerMessageId:'<different@x>'});
  assert.equal(await tick.settle(app.openUnread(7,'r1','fin','<h@x>','inbox',+new Date('2026-10-08')),100),null);assert.equal(w.opened.length,0);
 }
});
test('tomt eller felaktigt mejlfönster stängs och ger aldrig ett falskt visningskvitto',async()=>{
 for(const wrong of [false,true]){
  const {app,tick,api}=await loadBackground();const w=windowApi(api,app);unreadEngine(app);
  api.messageDisplay.getDisplayedMessages=async()=>wrong?[{...w.message,id:500}]:[];
  assert.equal(await tick.settle(app.openUnread(7,'r1','fin','<h@x>','inbox',+new Date('2026-10-08')),150),null);
  assert.equal(w.opened.length,1);assert.deepEqual(w.removed,[11]);assert.equal(app.mailWindows.size,0);
  assert(!app.logs.some(x=>/verifierat visat/.test(x.data.detail)));
 }
});
test('fel vid öppning ger ingen global headerMessageId-reservväg',async()=>{
 const {app,tick,api}=await loadBackground();const w=windowApi(api,app);unreadEngine(app);let calls=0;
 api.messageDisplay.open=async args=>{calls++;assert.equal(args.messageId,99);assert.equal(args.headerMessageId,undefined);throw Error('gone');};
 assert.equal(await tick.settle(app.openUnread(7,'r1','fin','<h@x>','inbox',+new Date('2026-10-08')),100),null);assert.equal(calls,1);assert.equal(w.removed.length,0);
});
test('read/keep och popup-skydd behålls efter verifierad flytt',async()=>{
 for(const mode of ['read','keep','sweep','queue']){
  const {app,tick,api}=await loadBackground();const w=windowApi(api,app);const e=unreadEngine(app);
  e.config.rules[0].unreadAction=['read','keep'].includes(mode)?mode:'window';
  if(mode==='sweep')e.sweeping=1;if(mode==='queue')e.pending=new Map([[1,{}],[2,{}],[3,{}],[4,{}]]);
  assert.equal(await tick.settle(app.openUnread(7,'r1','fin','<h@x>','inbox',+new Date('2026-10-08')),100),99);assert.equal(w.opened.length,0);
  await tick.flush(20);assert(w.updated.some(x=>x.patch.read===(mode==='read')));
 }
});
test('före: källa öppnas och klartecken ges först när det verifierade fönstret stängts',async()=>{
 const {app,tick,api}=await loadBackground();const w=windowApi(api,app);w.message.folder.id='inbox';const e=unreadEngine(app);
 const record={key:'job',ruleId:'r1'};e.records.set('job',record);
 assert.equal(await tick.settle(app.beforeMove(w.message,record),100),false);assert.equal(app.beforeWindows.get('job').confirmed,true);
 assert.equal(await app.beforeMove(w.message,record),false);assert.equal(w.opened.length,1);
 w.tabs.delete(11);app.windowClosed(11);
 assert.equal(await app.beforeMove(w.message,record),true);assert.equal(w.opened.length,1);
});
test('före: misslyckad visning stoppar motorn, ingen flytt eller popup-loop',async()=>{
 const {app,tick,api}=await loadBackground();const w=windowApi(api,app);w.message.folder.id='inbox';const e=unreadEngine(app);e.records.set('job',{});
 w.readerReady=false;
 assert.equal(await tick.settle(app.beforeMove(w.message,{key:'job',ruleId:'r1'}),100),false);
 assert.equal(e.fault,'window_error');assert.deepEqual(w.removed,[11]);assert.equal(app.beforeWindows.size,0);
});
test('före: högst ett källfönster åt gången; ingen öppning mitt under svep',async()=>{
 const {app,tick,api}=await loadBackground();const w=windowApi(api,app);w.message.folder.id='inbox';const e=unreadEngine(app);e.records.set('a',{});e.records.set('b',{});
 e.sweeping=1;assert.equal(await app.beforeMove(w.message,{key:'a'}),false);assert.equal(w.opened.length,0);e.sweeping=0;
 await tick.settle(app.beforeMove(w.message,{key:'a'}));assert.equal(await app.beforeMove(w.message,{key:'b'}),false);assert.equal(w.opened.length,1);
});
test('fönsterstatus som inte går att läsa behandlas inte som ett stängt fönster',async()=>{
 const {app,tick,api}=await loadBackground();const w=windowApi(api,app);unreadEngine(app);
 await tick.settle(app.openUnread(7,'r1','fin','<h@x>','inbox',+new Date('2026-10-08')));
 api.tabs.query=async()=>{throw Error('unknown');};assert.equal(await app.windowOpen(w.message),true);
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
 assert.deepEqual(logs,['Lasfilter/logs/lasfilter-logg.txt'],'loggfilen skrivs till logs-mappen, inte löst i appmappen');
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

test('bromsens svar: Ta bort regeln tar bort den helt',async()=>{
 const {app}=await loadBackground();
 let held={ruleId:'r1',matched:51,limit:50,median:0};
 const engine=fakeEngine(app,{config:{schema:1,revision:0,rulesVersion:0,paused:false,dryRun:false,moveMode:'read',hourly:false,sweepMinutes:60,
  newInboxDirect:true,openWindow:true,verbose:true,fileLog:true,brake:true,
  rules:[{id:'r1',name:'Mejl från fortnox.se',enabled:true,scope:'folder',source:'inbox',sourceAccount:'',target:'fin',match:'all',readFilter:'both',unreadAction:'keep',yearFolders:false,branches:[],conditions:[{field:'domain',op:'equals',value:'fortnox.se'}]},
         {id:'r2',name:'Nyhetsbrev',enabled:true,scope:'folder',source:'inbox',sourceAccount:'',target:'nytt',match:'all',readFilter:'both',unreadAction:'keep',yearFolders:false,branches:[],conditions:[{field:'domain',op:'equals',value:'nyhetsbrev.se'}]}]},
  heldRule:id=>held&&held.ruleId===id?held:null,
  heldList:()=>held?[held]:[],
  releaseRule:id=>{if(held&&held.ruleId===id)held=null;}});
 app.brakeHistory.r1=[2,3,4];
 const status=await app.handle({type:'brakeDelete',ruleId:'r1'});
 assert.equal(status.config.rules.length,1,'bara den stoppade regeln försvinner');
 assert.equal(status.config.rules[0].id,'r2','grannregeln är kvar');
 assert.equal(engine.config.rules.length,1,'och det sparades i konfigurationen');
 assert.equal(status.brakeHolds.length,0,'spärren är släppt');
 assert.equal(app.brakeHistory.r1,undefined,'minnet för en borttagen regel städas');
});

test('bromsens svar avvisas för en regel som inte är stoppad',async()=>{
 const {app}=await loadBackground();
 fakeEngineWithRules(app,{heldRule:()=>null,heldList:()=>[]});
 await assert.rejects(()=>app.handle({type:'brakeRelease',ruleId:'r1'}),'inget att släppa');
 await assert.rejects(()=>app.handle({type:'brakeCancel',ruleId:'nope'}),'okänd regel');
 await assert.rejects(()=>app.handle({type:'brakeDelete',ruleId:'r1'}),'inget att ta bort');
});

/* ── Cachen ───────────────────────────────────────────────────────────────
   Mappcachen gör svepen snabba men kan bli gammal. Den töms automatiskt en gång
   i dygnet. Det farliga vore att tömma något annat på vägen: kön, journalen
   eller minnet av redan hanterade mejl. Då kan samma mejl hanteras två gånger. */
function cacheEngine(app,over={}){
 const engine=fakeEngine(app,{folderCache:new Map([['inbox',{total:10,unread:2}],['fin',{total:4,unread:0}]]),
  yearFolderIds:new Map([['fin|2025','y2025']]),
  invalidateFolders(){engine.folderCache.clear();},...over});
 return engine;
}

test('cachen kan rensas för hand',async()=>{
 const {app}=await loadBackground();
 const engine=cacheEngine(app);
 app.scanCache={at:Date.now(),data:{x:1},limit:0};
 const out=await app.handle({type:'clearCache'});
 assert.equal(out.result.ok,true,'rensningen ska lyckas');
 assert.equal(out.result.folders,2,'antalet mappar som fanns i cachen rapporteras');
 assert.equal(engine.folderCache.size,0,'mappcachen är tömd');
 assert.equal(engine.yearFolderIds.size,0,'årsmapparnas id-karta är tömd');
 assert.equal(app.scanCache.data,null,'sökningen räknas om');
 assert.match(out.result.day,/^\d{4}-\d{2}-\d{2}$/,'dagen sparas som ÅÅÅÅ-MM-DD');
 assert.equal(out.status.cache.on,true,'statusen säger att automatiken är på');
 assert.equal(out.status.cache.at>0,true,'statusen vet när den senast rensades');
});

test('cache-rensningen rör aldrig kön eller minnet av hanterade mejl',async()=>{
 const {app}=await loadBackground();
 const engine=cacheEngine(app,{pending:new Map(),inflight:new Map()});
 engine.pending.set('m1',{});
 engine.records=new Map([['abc',{stage:'attempted'}]]);
 engine.done=new Set(['abc','def']);
 /* Kön är inte tom – då ska rensningen vägra i stället för att röja runt. */
 const busy=await app.handle({type:'clearCache'});
 assert.equal(busy.result.ok,false,'mitt i en flytt rensas ingenting');
 assert.equal(busy.result.reason,'busy');
 assert.equal(engine.folderCache.size,2,'cachen står kvar när det är upptaget');
 assert.equal(engine.done.size,2,'minnet av hanterade mejl är orört');
 engine.pending.clear();
 const r=await app.handle({type:'clearCache'});
 assert.equal(r.result.ok,true,'när kön är tom går det bra');
 assert.equal(engine.done.has('abc'),true,'done rensas aldrig – annars kan ett mejl hanteras två gånger');
 assert.equal(engine.done.size,2,'hela minnet finns kvar');
 assert.equal(engine.records.size,1,'journalen är orörd');
});

test('cachen rensas automatiskt en gång per dygn, inte oftare',async()=>{
 const {app,tick}=await loadBackground();
 cacheEngine(app);
 app.lastCacheDay='';
 app.lastCacheClear=0;
 const first=app.maybeClearCache();
 assert.equal(first.ok,true,'första kontrollen på dygnet rensar');
 assert.equal(app.lastCacheDay,app.cacheDayOf(),'dagens datum sparas');
 const second=app.maybeClearCache();
 assert.equal(second,null,'samma dygn rensas inte igen');
 /* En ny dag (som om dygnet gått) ska rensa igen. */
 app.lastCacheDay='2000-01-01';
 const third=app.maybeClearCache();
 assert.equal(third.ok,true,'en ny dag rensar igen');
});

test('avstängd automatisk rensning rör ingenting, men knappen fungerar',async()=>{
 const {app}=await loadBackground();
 const engine=cacheEngine(app);
 engine.config={...engine.config,autoClear:false};
 app.lastCacheDay='';
 app.lastCacheClear=0;
 assert.equal(app.maybeClearCache(),null,'avstängd automatisk rensning gör ingenting');
 assert.equal(engine.folderCache.size,2,'cachen står kvar');
 const manual=await app.handle({type:'clearCache'});
 assert.equal(manual.result.ok,true,'den manuella knappen fungerar ändå');
 assert.equal(engine.folderCache.size,0,'och tömmer cachen');
 assert.equal(app.snapshot().cache.on,false,'statusen säger att automatiken är av');
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
 assert.equal(skip.written,false,'ingen ny kopia samma vecka efter omstart');
 assert.equal(skip.reason,'not_due','veckan är redan gjord');
 assert.equal(skip.week,week,'samma vecka');
 await tick.flush(20);
});

test('veckokopian skrivs även om Thunderbird står öppen i veckor',async()=>{
 const {api,written}=backupApi();
 const {app}=await loadBackground(api);
 fakeEngineWithRules(app,{config:backupConfig([exportRule])});
 await app.autoBackup({force:true});
 const after=written.length;
 /* Samma vecka: pulsen ska inte göra något. */
 assert.equal(app.maybeWeeklyBackup(),null,'ingen kopia inom samma vecka');
 await app.maybeWeeklyBackup();
 /* Ny vecka utan omstart: pulsen ser det och schemalägger kopian. */
 app.lastBackupWeek='2020-W01';
 app.lastBackupTry=0;
 assert.equal(app.maybeWeeklyBackup(),true,'en ny vecka upptäcks av pulsen');
 assert.equal(app.lastBackupTry>0,true,'försöket bokförs så det inte upprepas varje minut');
 /* Ett försök som inte hann skriva görs inte om direkt – högst en gång i timmen. */
 app.lastBackupWeek='2019-W01';
 assert.equal(app.maybeWeeklyBackup(),null,'inget nytt försök direkt efter ett misslyckat');
 assert.equal(written.length,after,'ingenting skrevs av pulsen i sig');
});

test('veckokopian stängs av med rutan, men pulsen frågar aldrig när den är av',async()=>{
 const {api}=backupApi();
 const {app}=await loadBackground(api);
 fakeEngineWithRules(app,{config:backupConfig([exportRule])});
 app.engine.config={...app.engine.config,autoBackup:false};
 app.lastBackupWeek='2019-W01';
 app.lastBackupTry=0;
 assert.equal(app.maybeWeeklyBackup(),null,'avstängd ruta ger ingen veckokoll');
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

/* ── "Varför ligger det här mejlet här?" ──────────────────────────────── */

test('uppslaget svarar med mappnamn i klartext, inte bara id',async()=>{
 const {app}=await loadBackground();
 const engine=fakeEngineWithRules(app,{config:{schema:1,revision:0,rulesVersion:0,paused:false,dryRun:false,moveMode:'read',hourly:false,sweepMinutes:60,
  newInboxDirect:true,openWindow:true,verbose:true,fileLog:true,brake:true,
  rules:[{id:'r1',name:'Fakturor',enabled:true,scope:'folder',source:'inbox',sourceAccount:'',target:'fin',match:'all',readFilter:'read',unreadAction:'keep',yearFolders:false,branches:[],conditions:[{field:'domain',op:'equals',value:'x.se'}]}]},
  displayed:async()=>new Set()});
 app.folderList=async()=>[{id:'inbox',accountId:'a',accountName:'Jobb',name:'Inkorg',label:'Jobb · Inkorg'},
  {id:'fin',accountId:'a',accountName:'Jobb',name:'Fakturor',label:'Jobb · Fakturor'}];
 const out=await app.handle({type:'whyHere',message:{id:1,read:true,folder:{id:'inbox',accountId:'a'},author:'Anna <anna@x.se>',subject:'Faktura 1',date:new Date(),size:900,headerMessageId:'h@x'}});
 assert.equal(out.winner,'r1','regeln hittas');
 assert.equal(out.winnerTarget,'fin');
 assert.equal(out.winnerName,'Jobb · Fakturor','målmappen skrivs i klartext');
 assert.equal(out.message.folderName,'Jobb · Inkorg','och källmappen likaså');
 assert.equal(out.message.subject,'Faktura 1','ämnet följer med');
 assert.equal(engine.config.rules.length,1);
});

test('uppslaget använder markerat mejl när inget skickas in',async()=>{
 const {app,api}=await loadBackground();
 fakeEngineWithRules(app,{config:{schema:1,revision:0,rulesVersion:0,paused:false,dryRun:false,moveMode:'read',hourly:false,sweepMinutes:60,
  newInboxDirect:true,openWindow:true,verbose:true,fileLog:true,brake:true,rules:[]},displayed:async()=>new Set()});
 const picked={id:7,read:true,folder:{id:'inbox',accountId:'a'},author:'Bo <bo@x.se>',subject:'Hej',date:new Date(),size:10,headerMessageId:'p@x'};
 api.tabs.query=async()=>[{id:1,type:'mail',active:true}];
 api.tabs.get=async()=>({id:1,type:'mail'});
 api.mailTabs.getSelectedMessages=async()=>({messages:[{id:7}]});
 api.messages.get=async()=>picked;
 const out=await app.handle({type:'whyHere'});
 assert.equal(out.message.subject,'Hej','det markerade mejlet läses');
 assert.equal(out.winner,'','inga regler – ingen vinnare');
 assert.equal(out.rules.length,0);
});

test('uppslaget avvisar när inget mejl är markerat',async()=>{
 const {app,api}=await loadBackground();
 fakeEngineWithRules(app,{displayed:async()=>new Set()});
 api.tabs.query=async()=>[];
 await assert.rejects(()=>app.handle({type:'whyHere'}),'inget markerat mejl');
});

/* ── Provkörning och "lär av din flytt" ─────────────────────────────────── */
function storeApi(){
 const api=stubApi();
 const stored={};
 api.storage={local:{get:async keys=>{const out={};for(const k of [].concat(keys||[]))if(k in stored)out[k]=stored[k];return out;},set:async obj=>{Object.assign(stored,obj);}}};
 return {api,stored};
}
const trialRule=over=>C.validateRule({id:'r1',name:'Fakturor',enabled:true,scope:'account',source:'inbox',sourceAccount:'a',target:'fin',
 match:'all',readFilter:'default',unreadAction:'default',conditions:[{field:'domain',op:'equals',value:'klarna.se'}],branches:[],...over});

test('provkörning: aktivera, förläng och stäng av',async()=>{
 const {api}=storeApi();
 const {app,tick}=await loadBackground(api);
 const rule=trialRule({trialUntil:Date.now()-1000});
 fakeEngineWithRules(app,{config:{schema:1,revision:0,rulesVersion:0,paused:false,dryRun:false,moveMode:'read',hourly:true,sweepMinutes:60,
  newInboxDirect:true,openWindow:true,verbose:true,fileLog:true,rules:[rule]}});
 app.engine.clearTrial=()=>{};app.engine.trialList=()=>({});
 const act=await tick.settle(app.handle({type:'trialResolve',ruleId:'r1',action:'activate'}));
 assert.equal(act.rule.trialUntil,0,'aktiverad regel har ingen provkörning kvar');
 assert.equal(act.rule.enabled,true);
 const ext=await tick.settle(app.handle({type:'trialResolve',ruleId:'r1',action:'extend'}));
 assert.ok(ext.rule.trialUntil>Date.now()+6*86400000,'förlängningen är en vecka');
 assert.equal(ext.rule.enabled,true);
 const off=await tick.settle(app.handle({type:'trialResolve',ruleId:'r1',action:'off'}));
 assert.equal(off.rule.enabled,false,'avstängd regel flyttar inget');
 assert.equal(off.rule.trialUntil,0);
});

test('provkörningen syns i statusen med dagar kvar',async()=>{
 const {api}=storeApi();
 const {app}=await loadBackground(api);
 const rule=trialRule({trialUntil:Date.now()+2*86400000});
 fakeEngineWithRules(app,{config:{schema:1,revision:0,rulesVersion:0,paused:false,dryRun:false,moveMode:'read',hourly:true,sweepMinutes:60,
  newInboxDirect:true,openWindow:true,verbose:true,fileLog:true,rules:[rule]}});
 app.engine.trialCount=()=>4;
 const snap=app.snapshot();
 assert.equal(snap.trials.length,1);
 assert.equal(snap.trials[0].active,true);
 assert.equal(snap.trials[0].left,2);
 assert.equal(snap.trials[0].count,4,'räkningen följer med till gränssnittet');
});

test('inlärda flyttar: gamla och trasiga poster rensas',async()=>{
 const {app}=await loadBackground();
 const now=Date.now();
 const clean=app.cleanLearned({off:false,entries:[
  {domain:'klarna.se',source:'inbox',target:'fin',count:3,first:now,last:now},
  {domain:'gammal.se',source:'inbox',target:'fin',count:9,first:now-30*86400000,last:now-30*86400000},
  {domain:'utan-mapp.se',source:'',target:'fin',count:2,first:now,last:now},
  {domain:'<script>',source:'inbox',target:'fin',count:2,first:now,last:now}
 ],snooze:{}});
 assert.equal(clean.entries.length,1,'bara den färska, giltiga posten blir kvar');
 assert.equal(clean.entries[0].domain,'klarna.se');
});

test('lär av din flytt: egen flytt räknas, vår egen räknas inte',async()=>{
 const {api}=storeApi();
 const {app,tick}=await loadBackground(api);
 fakeEngineWithRules(app);
 const before={messages:[{id:1,author:'A <a@klarna.se>',folder:{id:'inbox'}},{id:2,author:'B <b@klarna.se>',folder:{id:'inbox'}}]};
 const after={messages:[{id:11,folder:{id:'fin',specialUse:[]}},{id:12,folder:{id:'fin',specialUse:[]}}]};
 await tick.settle(app.learnMove(before,after));
 assert.equal(app.learned.entries.length,1);
 assert.equal(app.learned.entries[0].domain,'klarna.se');
 assert.equal(app.learned.entries[0].count,2,'båda mejlen från samma domän räknas');
 await tick.settle(app.learnMove(before,after,{ours:true}));
 assert.equal(app.learned.entries[0].count,2,'SortBros egen flytt räknas aldrig');
});

test('papperskorgen lär inte ut någon regel',async()=>{
 const {api}=storeApi();
 const {app,tick}=await loadBackground(api);
 fakeEngineWithRules(app);
 await tick.settle(app.learnMove({messages:[{id:1,author:'a@klarna.se',folder:{id:'inbox'}}]},{messages:[{id:2,folder:{id:'trash',specialUse:['trash']}}]}));
 assert.equal(app.learned.entries.length,0);
});

test('tre likadana flyttar blir ett förslag – två blir inget',async()=>{
 const {api}=storeApi();
 const {app,tick}=await loadBackground(api);
 fakeEngineWithRules(app);
 const before={messages:[{id:1,author:'a@klarna.se',folder:{id:'inbox'}}]};
 const after={messages:[{id:2,folder:{id:'fin',specialUse:[]}}]};
 await tick.settle(app.learnMove(before,after));
 await tick.settle(app.learnMove(before,after));
 assert.equal(app.learnSuggestions().length,0,'två flyttar är ingen vana');
 await tick.settle(app.learnMove(before,after));
 const list=app.learnSuggestions();
 assert.equal(list.length,1);
 assert.equal(list[0].domain,'klarna.se');
 assert.equal(list[0].target,'fin');
 assert.equal(list[0].key,'klarna.se|fin');
});

test('"inte nu" döljer förslaget och "sluta föreslå" stänger av',async()=>{
 const {api}=storeApi();
 const {app,tick}=await loadBackground(api);
 fakeEngineWithRules(app);
 const before={messages:[{id:1,author:'a@klarna.se',folder:{id:'inbox'}}]};
 const after={messages:[{id:2,folder:{id:'fin',specialUse:[]}}]};
 for(let i=0;i<3;i++)await tick.settle(app.learnMove(before,after));
 assert.equal(app.learnSuggestions().length,1);
 await tick.settle(app.handle({type:'learnSnooze',key:'klarna.se|fin'}));
 assert.equal(app.learnSuggestions().length,0,'"inte nu" döljer förslaget');
 await tick.settle(app.handle({type:'learnOff'}));
 assert.equal(app.learned.off,true);
 assert.equal(app.learnSuggestions().length,0);
});

test('skapa regel av en inlärd flytt',async()=>{
 const {api}=storeApi();
 api.folders.get=async id=>({id,accountId:'a',name:id,specialUse:[]});
 const {app,tick}=await loadBackground(api);
 fakeEngineWithRules(app);
 app.learned={off:false,entries:[{domain:'klarna.se',source:'inbox',target:'fin',count:4,first:Date.now(),last:Date.now()}],snooze:{}};
 const out=await tick.settle(app.handle({type:'learnCreate',key:'klarna.se|fin'}));
 assert.equal(out.rule.conditions[0].field,'domain');
 assert.equal(out.rule.conditions[0].value,'klarna.se');
 assert.equal(out.rule.target,'fin');
 assert.equal(out.rule.sourceAccount,'a');
 assert.equal(out.rule.match,'any','nya inlärda regler använder minst ett villkor');
 assert.equal(out.rule.enabled,true);
 assert.equal(app.learned.entries.length,0,'förslaget försvinner när regeln finns');
});

/* Sidan som var öppen när tillägget uppdaterades kör kvar sin gamla kod och visar
   därför den gamla versionen i sidfoten. Utan behörigheten "tabs" kan bakgrunden
   inte läsa tabbarnas adresser, så den känner igen sidan på versionsmarkeringen
   som varje ärende bär med sig – och laddar om den en gång. */
test('en öppen sida som kör en annan version laddas om',async()=>{
 const api=stubApi();
 let listener=null;
 const reloads=[];
 api.runtime.id='lasfilter@lokala-verktyg.invalid';
 api.runtime.getManifest=()=>({version:'1.0.1'});
 api.runtime.onMessage.addListener=fn=>{listener=fn;};
 api.tabs.reload=async id=>{reloads.push(id);};
 const {app,tick}=await loadBackground(api);
 fakeEngineWithRules(app);
 const sender=tabId=>({id:'lasfilter@lokala-verktyg.invalid',tab:{id:tabId}});
 await tick.settle(listener({type:'status',uiBuild:'1.0.1'},sender(7)));
 assert.deepEqual(reloads,[],'en sida med rätt version rörs inte');
 await tick.settle(listener({type:'status',uiBuild:'1.0.0'},sender(7)));
 assert.deepEqual(reloads,[7],'en sida med äldre version laddas om');
 await tick.settle(listener({type:'status',uiBuild:'1.0.0'},sender(7)));
 assert.deepEqual(reloads,[7],'samma flik laddas bara om en gång');
 await tick.settle(listener({type:'status'},sender(8)));
 assert.deepEqual(reloads,[7,8],'utan versionsmarkering räknas sidan som gammal');
});

/* Tyst omstart: en nedladdad version ska bytas när inget pågår, aldrig mitt i en
   flytt – och aldrig med en fråga till användaren. */
test('en nedladdad version byts tyst när inget pågår',async()=>{
 const api=stubApi();
 let onUpdate=null;
 const reloads=[];
 api.runtime.id='lasfilter@lokala-verktyg.invalid';
 api.runtime.onUpdateAvailable.addListener=fn=>{onUpdate=fn;};
 api.runtime.reload=()=>{reloads.push(1);};
 const {app}=await loadBackground(api);
 const engine=fakeEngineWithRules(app);
 assert.equal(typeof onUpdate,'function','bakgrunden ska lyssna på nya versioner');
 engine.pending.set('m1',{});
 onUpdate({version:'1.0.4'});
 assert.deepEqual(reloads,[],'mitt i en flytt väntar vi');
 assert.equal(app.pendingUpdate,'1.0.4','versionen sparas till dess');
 engine.pending.clear();
 assert.equal(await app.applyPendingUpdate(),true);
 assert.deepEqual(reloads,[1],'när kön är tom byts koden');
 assert.equal(app.pendingUpdate,'','det ska bara hända en gång');
 assert.equal(await app.applyPendingUpdate(),false);
 assert.deepEqual(reloads,[1],'inget mer händer utan ny version');
});

test('en uppdatering som väntar för länge tvingas igenom',async()=>{
 const api=stubApi();
 let onUpdate=null;
 const reloads=[];
 api.runtime.id='lasfilter@lokala-verktyg.invalid';
 api.runtime.onUpdateAvailable.addListener=fn=>{onUpdate=fn;};
 api.runtime.reload=()=>{reloads.push(1);};
 const {app}=await loadBackground(api);
 const engine=fakeEngineWithRules(app);
 engine.sweeping=2;
 onUpdate({version:'1.0.4'});
 assert.deepEqual(reloads,[],'ett svep pågår');
 /* Klockan i sandlådan står still, så "för länge sedan" skrivs som ett förflutet tal. */
 app.updateDeadline=1;
 assert.equal(await app.applyPendingUpdate(),true,'efter trettio minuter byter vi ändå');
 assert.deepEqual(reloads,[1]);
});

test('uppdateringskontrollen är tyst och tål att anropet saknas',async()=>{
 const api=stubApi();
 api.runtime.id='lasfilter@lokala-verktyg.invalid';
 /* Stubben svarar på allt, men i Thunderbird finns ingen sådan funktion. */
 api.runtime.requestUpdateCheck=undefined;
 const {app}=await loadBackground(api);
 assert.equal(await app.requestUpdateCheck(),'unsupported','Thunderbird har inget requestUpdateCheck');
 const api2=stubApi();
 api2.runtime.id='lasfilter@lokala-verktyg.invalid';
 const reloads=[];
 api2.runtime.reload=()=>{reloads.push(1);};
 const second=await loadBackground(api2);
 fakeEngineWithRules(second.app);
 api2.runtime.requestUpdateCheck=async()=>({status:'update_available',version:'9.9.9'});
 assert.equal(await second.app.requestUpdateCheck(),'update_available');
 assert.deepEqual(reloads,[1],'en hittad version byts direkt när inget pågår');
 api2.runtime.requestUpdateCheck=async()=>({status:'no_update'});
 assert.equal(await second.app.requestUpdateCheck(),'no_update');
 assert.deepEqual(reloads,[1],'ingen ny version – ingenting händer');
});

/* Loggraden skrivs med 500 ms fördröjning. En omstart som sker direkt efter
   loggningen får inte slänga bort raden som förklarar omstarten. */
test('loggen hinner sparas innan den tysta omstarten',async()=>{
 const api=stubApi();
 let onUpdate=null;
 const order=[];
 api.runtime.id='lasfilter@lokala-verktyg.invalid';
 api.runtime.onUpdateAvailable.addListener=fn=>{onUpdate=fn;};
 api.runtime.reload=()=>{order.push('reload');};
 const store=api.storage.local;
 api.storage.local={...store,set:async obj=>{if(obj&&obj.logs)order.push('logg:'+obj.logs.length);return store.set?store.set(obj):undefined;}};
 const {app}=await loadBackground(api);
 const engine=fakeEngineWithRules(app);
 app.logs=[];
 engine.pending.set('m1',{}); /* en flytt pågår: uppdateringen får vänta */
 onUpdate({version:'2.0.0'});
 engine.pending.clear();
 assert.equal(await app.applyPendingUpdate(),true);
 assert.deepEqual(order,[ 'logg:1','reload' ],'loggen ska vara skriven före omstarten');
 assert.equal(app.logs.length,1,'och raden finns kvar');
 assert.match(app.logs[0].data.detail,/byter till version 2\.0\.0/);
});

/* Snabbmenyn skapades en gång med fast svensk text. Den ska följa språkvalet. */
test('snabbmenyns titel följer språkvalet',async()=>{
 const api=stubApi();
 api.runtime.id='lasfilter@lokala-verktyg.invalid';
 const updates=[];
 api.menus.create=async opts=>{updates.push(['create',opts.title]);};
 api.menus.update=async(id,opts)=>{updates.push([id,opts.title]);};
 const {app,tick}=await loadBackground(api);
 await tick.settle(Promise.resolve());
 assert.match(updates[0][1],/^SortBro: Skapa regel/,'svensk titel när inget annat valts');
 await tick.settle(app.handle({type:'prefs',prefs:{lang:'en'}}));
 assert.match(app.menuTitle(),/^SortBro: Create a rule/,'engelsk titel efter språkbytet');
 assert.equal(updates.at(-1)[0],'sortbro-rule-from-message','menyn uppdateras, inte en ny rad');
 assert.match(updates.at(-1)[1],/Create a rule/);
});

/* ── Samlad fellogg ─────────────────────────────────────────────────────── */
test('samlad fellogg skrivs automatiskt i logs och innehåller inte normal aktivitet',async()=>{
 const {api,files,written}=backupApi();
 const {app}=await loadBackground(api);
 fakeEngineWithRules(app);
 app.log('error',0,'motor_stoppad code=move_error');
 app.log('moved',42);
 await app.writeTextLog();
 const file='Lasfilter/logs/sortbro-fellogg.txt';
 assert.match(files[file],/motor_stoppad code=move_error/);
 assert.doesNotMatch(files[file],/\tmoved\t/);
 const n=written.filter(x=>x===file).length;
 app.log('moved',1);
 await app.writeTextLog();
 assert.equal(written.filter(x=>x===file).length,n,'oförändrad fellogg skrivs inte om');
 app.log('error',0,'nytt_fel');
 await app.writeTextLog();
 assert.match(files[file],/nytt_fel/);
 assert.equal(written.filter(x=>x===file).length,n+1);
});
test('avstängd fillogg stoppar båda automatiska filerna men tillåter manuell felrapport',async()=>{
 const {api,written}=backupApi();const {app}=await loadBackground(api);
 fakeEngineWithRules(app);app.engine.config.fileLog=false;
 app.log('error',0,'backup_misslyckades');
 await app.writeTextLog();
 assert.equal(written.length,0);
 assert.match(await app.handle({type:'exportErrorLog'}),/backup_misslyckades/);
});
test('felhistoriken sparas och återställs separat, utan migreringsdubbletter',async()=>{
 const {api}=backupApi();let stored={};
 api.storage.local.get=async()=>({logs:[C.event('error',0,Date.now(),'gammalt_fel')]});
 api.storage.local.set=async data=>Object.assign(stored,JSON.parse(JSON.stringify(data)));
 const {app}=await loadBackground(api);
 fakeEngineWithRules(app);
 assert.equal(app.errorLogs.length,1,'migrerar intern gammal logg');
 app.log('error',0,'nytt_fel');
 app.logs=[C.event('moved',200)];
 await app.flushWrites();
 assert.equal(stored.errorLogs.length,2,'normal logg kan gallras utan att felen försvinner');
 api.storage.local.get=async()=>stored;
 const again=await loadBackground(api);
 assert.equal(again.app.errorLogs.length,2,'omstart dubblar inte poster');
 assert.match(again.app.errorLogText(),/gammalt_fel/);
});
test('fel på den vanliga loggfilen hamnar i felloggen',async()=>{
 const {api,files}=backupApi();const write=api.downloads.download;
 api.downloads.download=async arg=>{if(arg.filename.endsWith('/lasfilter-logg.txt'))throw Error('disk full');return write(arg);};
 const {app}=await loadBackground(api);fakeEngineWithRules(app);
 await app.writeTextLog();
 assert.match(files['Lasfilter/logs/sortbro-fellogg.txt'],/teknisk_logg_skrivfel/);
 assert.doesNotMatch(files['Lasfilter/logs/sortbro-fellogg.txt'],/disk full/,'rå exceptiontext sparas inte');
});
test('fel på felloggen skapar ingen oändlig skrivloop och kan hämtas manuellt',async()=>{
 const {api}=backupApi();let calls=0;
 api.downloads.download=async()=>{calls++;throw Error('privat feltext');};
 const {app,tick}=await loadBackground(api);fakeEngineWithRules(app);app.engine.config.autoBackup=false;
 await tick.flush(50);
 const before=calls;
 await tick.flush(50);
 assert.equal(calls,before,'inga självgenererande filförsök');
 assert.ok(calls<=4,'begränsat antal filanrop');
 const text=await app.handle({type:'exportErrorLog'});
 assert.match(text,/samlad_fellogg_skrivfel/);
 assert.doesNotMatch(text,/privat feltext/);
});
test('UI-fel rapporteras med säkra felkoder, aldrig exception-innehåll',async()=>{
 const {app}=await loadBackground();fakeEngineWithRules(app);
 await app.handle({type:'reportUiError',code:'hemlig@adress.se med mejltext'});
 await app.handle({type:'reportUiError',code:'sweep_error'});
 const text=app.errorLogText();
 assert.match(text,/ui: internal_error/);assert.match(text,/ui: sweep_error/);
 assert.doesNotMatch(text,/hemlig|adress|mejltext/);
});
test('samtidiga logganrop startar nedladdningar i följd',async()=>{
 const {api,files}=backupApi();const write=api.downloads.download;let active=0,max=0;
 api.downloads.download=async arg=>{active++;max=Math.max(max,active);await new Promise(r=>setImmediate(r));const id=await write(arg);active--;return id;};
 const {app}=await loadBackground(api);fakeEngineWithRules(app);
 app.log('error',0,'forsta');
 const first=app.writeTextLog();
 app.log('error',0,'sista');
 await Promise.all([first,app.writeTextLog()]);
 assert.equal(max,1);
 assert.match(files['Lasfilter/logs/sortbro-fellogg.txt'],/sista/);
});

/* Utseendeinställningar ska fungera även efter en riktig bakgrundsomstart. */
test('utseendeval och textstorlek 24 sparas och återläses',async()=>{
 const api=stubApi();let stored={};
 api.storage.local.get=async()=>stored;
 api.storage.local.set=async patch=>Object.assign(stored,JSON.parse(JSON.stringify(patch)));
 const {app}=await loadBackground(api);fakeEngineWithRules(app);
 const prefs=await app.handle({type:'prefs',prefs:{fontSize:24,density:'compact',lineSpacing:'roomy',introCollapsed:true}});
 assert.equal(prefs.fontSize,24);assert.equal(prefs.density,'compact');assert.equal(prefs.lineSpacing,'roomy');assert.equal(prefs.introCollapsed,true);
 const again=await loadBackground(api);
 for(const key of ['fontSize','density','lineSpacing','introCollapsed'])assert.equal(again.app.prefs[key],prefs[key],key);
});
test('ogiltiga utseendeval ignoreras utan att förstöra giltiga inställningar',async()=>{
 const {app}=await loadBackground();fakeEngineWithRules(app);
 await app.handle({type:'prefs',prefs:{fontSize:24,density:'compact',lineSpacing:'roomy',introCollapsed:true}});
 const p=await app.handle({type:'prefs',prefs:{fontSize:100,density:'tiny',lineSpacing:'huge',introCollapsed:'false'}});
 assert.equal(p.fontSize,24);assert.equal(p.density,'compact');assert.equal(p.lineSpacing,'roomy');assert.equal(p.introCollapsed,true);
});
test('äldre och ogiltigt lagrade utseendeval får säkra standardvärden',async()=>{
 const api=stubApi();api.storage.local.get=async()=>({prefs:{fontSize:25,density:'tiny',lineSpacing:99,introCollapsed:'yes'}});
 const {app}=await loadBackground(api);
 assert.equal(app.prefs.fontSize,14);assert.equal(app.prefs.density,'comfortable');assert.equal(app.prefs.lineSpacing,'normal');assert.equal(app.prefs.introCollapsed,false);
});
test('snabba parallella utseendeval skriver inte över varandra',async()=>{
 const {app}=await loadBackground();fakeEngineWithRules(app);
 await Promise.all([app.handle({type:'prefs',prefs:{density:'compact'}}),app.handle({type:'prefs',prefs:{fontSize:24}}),app.handle({type:'prefs',prefs:{lineSpacing:'roomy',introCollapsed:true}})]);
 assert.equal(app.prefs.fontSize,24);assert.equal(app.prefs.density,'compact');assert.equal(app.prefs.lineSpacing,'roomy');assert.equal(app.prefs.introCollapsed,true);
});

/* Konto-först och svenska mappnamn. */
function swedishAccounts(api){
 const leaf=(id,accountId,name,path,subFolders=[])=>({id,accountId,name,path,subFolders});
 api.accounts.list=async()=>['a','b'].map(id=>({id,name:id==='a'?'Åsas konto':'Björns konto',identities:[{email:id+'@example.se'}],rootFolder:{id:id+'-root',accountId:id,isRoot:true,subFolders:[
  leaf(id+'-in',id,'Inkorg','/Inkorg'),leaf(id+'-year',id,'Årsöversikt','/Årsöversikt'),leaf(id+'-book',id,'Bokföring','/Bokföring')
 ]}}));
}
test('mapplistan bär konto, adress, full sökväg och förälder utan att ändra ID',async()=>{
 const {app,api}=await loadBackground();swedishAccounts(api);
 const list=await app.folderList(),folder=list.find(f=>f.id==='a-year');
 assert.equal(list.length,6);assert.equal(folder.parentId,'a-root');assert.equal(folder.accountName,'Åsas konto');
 assert.equal(folder.accountEmail,'a@example.se');assert.equal(folder.path,'/Årsöversikt');
});
test('ny mapp skapas i valt kontos rot, inte i första kontot',async()=>{
 const {app,api}=await loadBackground();swedishAccounts(api);const calls=[];
 api.folders.create=async(parent,name)=>{calls.push({parent,name});return {id:'new',accountId:'b',name};};
 await app.createFolder('','Ärenden'.normalize('NFD'),'b');
 assert.deepEqual(calls,[{parent:'b-root',name:'Ärenden'}]);
 await assert.rejects(()=>app.createFolder('','Annat','unknown'),e=>e.code==='unsafe_folder');
 assert.equal(calls.length,1,'okänt konto får ingen reservmapp i ett annat konto');
});
test('lika svenska mappnamn tillåts i annan gren men inte bland syskon',async()=>{
 const {app,api}=await loadBackground();swedishAccounts(api);let created=0;
 api.folders.create=async(parent,name)=>{created++;return {id:'new',name,accountId:'a'};};
 await assert.rejects(()=>app.createFolder('a-root','ÅRSÖVERSIKT'.normalize('NFD'),'a'),e=>e.code==='folder_exists');
 await app.createFolder('a-book','Årsöversikt','a');
 assert.equal(created,1);
});
test('regeltestet visar varje villkor och ändrar aldrig OCH till ELLER',async()=>{
 const {app}=await loadBackground();const engine=fakeEngine(app,{displayed:async()=>new Set([42])});
 engine.config.paused=true;engine.config.dryRun=true;
 app.selected=async()=>({id:42,read:true,author:'wordpress@limos.se',subject:'[limos.se] Din webbplats har uppdaterats till WordPress 7.1.4',folder:{id:'other-in-a',accountId:'a'}});
 const rule={id:'wordpress',name:'WordPress',enabled:true,source:'inbox',sourceAccount:'a',scope:'account',target:'target',match:'all',conditions:[{field:'subject',op:'contains',value:'Wordfence'},{field:'subject',op:'contains',value:'WordPress'},{field:'sender',op:'contains',value:'wordpress@'}]};
 const out=await app.handle({type:'testRule',rule});
 assert.equal(out.matches,false);assert.equal(out.reason,'no_match');assert.deepEqual(Array.from(out.conditions),[false,true,true]);
 assert.equal(out.paused,true);assert.equal(out.dryRun,true);assert.equal(rule.match,'all');
 const matching=await app.handle({type:'testRule',rule:{...rule,conditions:rule.conditions.slice(1)}});
 assert.equal(matching.matches,true);assert.equal(matching.reason,'displayed');assert.equal(matching.outsideSource,false,'andra mappar inom samma källkonto är inte utanför källan');
});
test('JSON-import hittar svenska normaliserade mappnamn men gissar inte vid dubbletter',async()=>{
 const {app}=await loadBackground();
 const backup={format:'lasfilter-rules',version:1,rules:[{id:'r',name:'År',source:'in',target:'old'}],folders:[{id:'old',name:'Årsöversikt'.normalize('NFD'),accountName:'Åsas konto'.normalize('NFD'),label:'Åsas konto · /Årsöversikt'.normalize('NFD')}]};
 const folders=[{id:'new',accountId:'a',name:'Årsöversikt',accountName:'Åsas konto',label:'Åsas konto · /Årsöversikt'}];
 assert.equal(app.extractImportedRules(backup,folders)[0].target,'new');
 assert.equal(app.extractImportedRules(backup,[...folders,{...folders[0],id:'second'}])[0].target,'old');
});

/* Högerklicksflödet: en separat, striktare operation än fri villkorsimport. */
function senderFixture(app,over={}){
 const engine=fakeEngineWithRules(app);
 engine.config.rules=[C.validateRule({id:'sender-rule',name:'Kvitton',enabled:true,source:'inbox',sourceAccount:'a',scope:'folder',target:'fin',match:'all',conditions:[{field:'sender',op:'equals',value:'old@example.se'}],...over})];
 return engine;
}
test('högerklick sparar en exakt avsändare utan att starta en manuell körning',async()=>{
 const {app,api}=await loadBackground();inboxAccount(api);const engine=senderFixture(app,{readFilter:'read',unreadAction:'keep',yearFolders:true});
 let runs=0;engine.catchUp=async()=>{runs++;return {};};
 const result=await app.handle({type:'addSenderToRule',ruleId:'sender-rule',email:'NEW@example.se',revision:0});
 assert.equal(result.duplicate,false);assert.equal(engine.config.revision,1);assert.equal(runs,0);
 const r=engine.config.rules[0];assert.equal(r.conditions[1].value,'new@example.se');assert.equal(r.conditions[1].field,'sender');
 assert.equal(r.scope,'folder');assert.equal(r.source,'inbox');assert.equal(r.target,'fin');assert.equal(r.readFilter,'read');assert.equal(r.unreadAction,'keep');assert.equal(r.yearFolders,true);
});
test('servern stoppar OCH-breddning även om gränssnittet kringgås',async()=>{
 const {app,api}=await loadBackground();inboxAccount(api);const engine=senderFixture(app,{conditions:[{field:'domain',op:'equals',value:'old.se'},{field:'subject',op:'contains',value:'Faktura'}]});
 const before=JSON.stringify(engine.config);
 await assert.rejects(app.handle({type:'addSenderToRule',ruleId:'sender-rule',email:'new@example.se',revision:0}),e=>e.code==='sender_and');assert.equal(JSON.stringify(engine.config),before);
});
test('dubblett skriver ingen ny regelversion och ändrar inga inställningar',async()=>{
 const {app,api}=await loadBackground();inboxAccount(api);const engine=senderFixture(app);
 const before=JSON.stringify(engine.config),result=await app.handle({type:'addSenderToRule',ruleId:'sender-rule',email:'old@example.se',revision:0});
 assert.equal(result.duplicate,true);assert.equal(JSON.stringify(engine.config),before);
});
test('inaktuell regelversion och borttagen regel avvisas',async()=>{
 const {app,api}=await loadBackground();inboxAccount(api);const engine=senderFixture(app);engine.config.revision=2;
 await assert.rejects(app.handle({type:'addSenderToRule',ruleId:'sender-rule',email:'new@example.se',revision:1}),e=>e.code==='stale_config');
 await assert.rejects(app.handle({type:'addSenderToRule',ruleId:'removed',email:'new@example.se',revision:2}),e=>e.code==='bad_id');assert.equal(engine.config.revision,2);
 await assert.rejects(app.handle({type:'catchUp',ruleId:'sender-rule',revision:1}),e=>e.code==='stale_config');
});
test('två samtidiga tillägg kan inte skriva över varandra',async()=>{
 const {app,api}=await loadBackground();inboxAccount(api);const engine=senderFixture(app);
 const results=await Promise.allSettled(['a','b'].map(x=>app.handle({type:'addSenderToRule',ruleId:'sender-rule',email:x+'@example.se',revision:0})));
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(results.find(x=>x.status==='rejected').reason.code,'stale_config');assert.equal(engine.config.rules[0].conditions.length,2);
});
test('högerklick överför adress, konto, mapp och val utan att spara',async()=>{
 const {app,api}=await loadBackground();inboxAccount(api);const engine=senderFixture(app);app.open=async()=>{};
 const before=JSON.stringify(engine.config);
 await app.ruleFromMessage({selectedMessages:{messages:[{id:1,author:'Anna <Anna@exempel.se>',subject:'Hej',folder:{id:'inbox',accountId:'a'}}]}},'add');
 const data=await app.handle({type:'pendingPrefill'});assert.equal(data.action,'add');assert.equal(data.email,'anna@exempel.se');assert.equal(data.accountId,'a');assert.equal(data.folderId,'inbox');assert.equal(data.selectionCount,1);assert(data.token);assert.equal(JSON.stringify(engine.config),before);
 await app.ruleFromMessage({selectedMessages:{messages:[{id:2,author:'b@exempel.se',subject:'Nästa',folder:{id:'inbox',accountId:'a'}}]}},'new');
 await app.handle({type:'prefillConsumed'});assert.equal(app.prefill.email,'b@exempel.se','kvittens utan token får inte radera ett väntande val');
 await app.handle({type:'prefillConsumed',token:data.token});assert.equal(app.prefill.email,'b@exempel.se','en sen kvittens raderar inte nästa högerklick');
 await app.handle({type:'prefillConsumed',token:app.prefill.token});assert.equal(app.prefill,null);
});
test('båda snabbmenyvalen registreras och följer språkbytet',async()=>{
 const api=stubApi(),created=[],updated=[];api.menus.create=async x=>created.push(x);api.menus.update=async(id,x)=>updated.push({id,...x});
 const {app}=await loadBackground(api);
 assert(created.some(x=>x.id==='sortbro-add-sender'&&x.contexts.includes('message_list')));
 assert(created.some(x=>x.id==='sortbro-rule-from-message'));
 await app.handle({type:'prefs',prefs:{lang:'en'}});
 assert(updated.some(x=>x.id==='sortbro-add-sender'&&/Add sender/.test(x.title)));
});

test('försenat open-svar efter timeout får inte lämna en vit ruta',async()=>{
 const {app,tick,api}=await loadBackground();const w=windowApi(api,app);unreadEngine(app);
 api.messageDisplay.open=()=>new Promise(resolve=>tick.setTimeout(()=>{w.tabs.set(55,{id:55,type:'messageDisplay'});resolve({id:55});},12000));
 assert.equal(await tick.settle(app.openUnread(7,'r1','fin','<h@x>','inbox',+w.message.date),100),null);
 await tick.flush(50);await tick.settle(Promise.resolve(),20);assert(w.removed.includes(55));assert.equal(w.tabs.size,0);
});
test('fönster som fanns före anropet stängs aldrig som en felaktig ny ruta',async()=>{
 const {app,tick,api}=await loadBackground();const w=windowApi(api,app);unreadEngine(app);w.tabs.set(44,{id:44,type:'messageDisplay'});
 api.messageDisplay.open=async()=>({id:44});
 assert.equal(await tick.settle(app.openUnread(7,'r1','fin','<h@x>','inbox',+w.message.date),100),null);assert.equal(w.removed.length,0);assert(w.tabs.has(44));
});
test('samma Message-ID med fel datum räcker inte som identitetsbevis',async()=>{
 const {app,tick,api}=await loadBackground();const w=windowApi(api,app);unreadEngine(app);
 assert.equal(await tick.settle(app.openUnread(7,'r1','fin','<h@x>','inbox',+w.message.date-86400000),100),null);assert.equal(w.opened.length,0);
});
test('svepmarkering skyddar mot popup-storm även efter att svepet har avslutats',async()=>{
 const {app,tick,api}=await loadBackground();const w=windowApi(api,app);unreadEngine(app);
 assert.equal(await tick.settle(app.openUnread(7,'r1','fin','<h@x>','inbox',+w.message.date,true),100),99);assert.equal(w.opened.length,0);
});
test('före: riktig motor + öppnare flyttar först efter stängt, verifierat källfönster',async()=>{
 const {app,tick,api}=await loadBackground();inboxAccount(api);const w=windowApi(api,app);w.message.folder.id='inbox';
 const Engine=require('../addon/engine.js');
 const rule=C.validateRule({id:'r1',name:'Före',enabled:true,source:'inbox',target:'fin',match:'any',conditions:[{field:'domain',op:'equals',value:'example.se'}],readFilter:'unread',unreadAction:'window',openTiming:'before'});
 let moves=0;const engine=new Engine(api,{...C.defaults(),dryRun:false,moveMode:'direct',rules:[rule]},{now:tick.now,persist:async()=>{},beforeMove:app.beforeMove,windowOpen:app.windowOpen,notify:app.openUnread,ackTimeout:5});app.engine=engine;
 api.folders.get=async id=>({id,accountId:'a',name:id,specialUse:[]});api.folders.getFolderCapabilities=async()=>({canAddMessages:true,canDeleteMessages:true});
 api.messages.move=async(ids,target)=>{moves++;const old={...w.message,folder:{...w.message.folder}};w.message.id=199;w.message.folder.id=target;await engine.onMoved({messages:[old]},{messages:[{...w.message}]});};
 await engine.enqueue({...w.message});await tick.settle(engine.tick(),100);assert.equal(w.opened.length,1);assert.equal(moves,0);
 w.message.read=true;await tick.settle(engine.tick(),100);assert.equal(moves,0);assert.equal(engine.pending.size,1);
 w.tabs.clear();app.windowClosed(11);await tick.settle(engine.tick(),100);assert.equal(moves,0);
 tick.setTimeout(()=>{},2100);await tick.flush(20);await tick.settle(engine.tick(),100);
 assert.equal(moves,1);assert.equal(w.opened.length,1);assert.equal(w.message.folder.id,'fin');assert.equal(engine.fault,'');
});

test('tom inbyggd visning kan ersättas med verifierad lokal RFC822-kopia',async()=>{
 const {app,tick,api}=await loadBackground();const w=windowApi(api,app);unreadEngine(app);
 const file={size:120,arrayBuffer:async()=>new ArrayBuffer(120)};api.messages.getRaw=async(id,options)=>{assert.equal(id,99);assert.equal(options.data_format,'File');return file;};
 const nativeOpen=api.messageDisplay.open;api.messageDisplay.open=async args=>{if(args.file)assert.equal(args.file,file);return nativeOpen(args);};
 api.messageDisplay.getDisplayedMessages=async id=>id===12?{messages:[{...w.message,id:200,folder:undefined,external:true}]}:[];
 assert.equal(await tick.settle(app.openUnread(7,'r1','fin','<h@x>','inbox',+w.message.date),200),99);
 assert.equal(w.opened.length,2);assert.deepEqual(w.removed,[11]);assert.equal(w.opened[1].file,file);assert.equal(app.mailWindows.size,1);
});
test('lokal reservkopia måste också visa rätt identitet och får inte bli kvar tom',async()=>{
 const {app,tick,api}=await loadBackground();const w=windowApi(api,app);unreadEngine(app);
 api.messages.getRaw=async()=>({size:120,arrayBuffer:async()=>new ArrayBuffer(120)});
 api.messageDisplay.getDisplayedMessages=async id=>id===12?[{...w.message,id:200,external:true,headerMessageId:'wrong@x'}]:[];
 assert.equal(await tick.settle(app.openUnread(7,'r1','fin','<h@x>','inbox',+w.message.date),250),null);assert.deepEqual(w.removed,[11,12]);
});

test('före: inbyggd vit ruta används inte – kroppen hämtas före eget fönster',async()=>{
 const {app,tick,api}=await loadBackground();const w=windowApi(api,app);w.message.folder.id='inbox';const e=unreadEngine(app);e.records.set('job',{});
 api.messageDisplay.open=async()=>{throw Error('native window must not be used');};
 api.messageDisplay.getDisplayedMessages=async()=>[{...w.message}];
 const full=api.messages.getFull;let loaded=false;api.messages.getFull=async()=>{assert.equal(w.opened.length,0);loaded=true;return full();};
 assert.equal(await tick.settle(app.beforeMove(w.message,{key:'job'}),100),false);assert(loaded);assert.match(w.opened[0].url,/reader.html#/);
 assert(app.beforeWindows.get('job').confirmed);assert.equal(await app.beforeMove(w.message,{key:'job'}),false);
 app.windowClosed(999);assert.equal(await app.beforeMove(w.message,{key:'job'}),false);
 w.tabs.clear();app.windowClosed(11);assert.equal(await app.beforeMove(w.message,{key:'job'}),true);assert.equal(app.readers.size,0);
});
test('före: tom kropp, enbart bilagor och misslyckad hämtning öppnar aldrig ett fönster',async()=>{
 for(const full of [{headers:{}},{parts:[{contentType:'application/pdf',name:'faktura.pdf'}]},null]){
  const {app,tick,api}=await loadBackground();const w=windowApi(api,app);w.message.folder.id='inbox';const e=unreadEngine(app);e.records.set('job',{});
  api.messages.getFull=async()=>{if(full===null)throw Error('offline');return full;};
  assert.equal(await tick.settle(app.beforeMove(w.message,{key:'job'}),100),false);assert.equal(w.opened.length,0);assert.equal(e.fault,'window_error');
 }
});
test('före: pausa medan kroppen hämtas lämnar mejlet utan fönster eller flytt',async()=>{
 const {app,tick,api}=await loadBackground();const w=windowApi(api,app);w.message.folder.id='inbox';const e=unreadEngine(app);e.records.set('job',{});
 const full=api.messages.getFull;api.messages.getFull=async()=>{e.epoch++;return full();};
 await tick.settle(app.beforeMove(w.message,{key:'job'}),100);assert.equal(w.opened.length,0);
});
test('läsfönstrets kvitto binds till token, avsändarsida och exakt flik',async()=>{
 const {app,api}=await loadBackground();windowApi(api,app);
 app.readers.set('secret',{tabId:11,ready:false,closed:false,data:{parts:[]}});
 const good={id:api.runtime.id,url:api.runtime.getURL('reader.html')+'#secret',tab:{id:11}};
 for(const sender of [{...good,id:'other'}, {...good,url:'https://bad.invalid/'},{...good,tab:{id:12}}])await assert.rejects(app.readerRequest({type:'readerReady',token:'secret'},sender));
 assert.equal(app.readers.get('secret').ready,false);assert.equal(await app.readerRequest({type:'readerReady',token:'secret'},good),true);
});
test('MIME-väljaren väljer textalternativ och visar inte HTML eller bilagor dubbelt',async()=>{
 const {app}=await loadBackground();const payload=app.readerParts({parts:[{contentType:'multipart/alternative',parts:[{contentType:'text/plain',body:'Hej världen'},{contentType:'text/html',body:'<p>Hej världen</p>'}]},{contentType:'application/pdf',name:'faktura.pdf'}]});
 assert.equal(payload.parts.length,1);assert.equal(payload.parts[0].body,'Hej världen');assert.equal(payload.attachments[0],'faktura.pdf');
 assert.throws(()=>app.readerParts({contentType:'text/plain',body:'x'.repeat(2*1024*1024+1)}));
});
test('kvarvarande läsfönster efter omstart spärrar flytt tills användaren stänger',async()=>{
 const {app,api}=await loadBackground();const w=windowApi(api,app);unreadEngine(app);
 w.tabs.set(88,{id:88,type:'content',url:api.runtime.getURL('reader.html')+'#old-token'});
 assert.equal(await app.windowOpen(w.message),true);w.tabs.clear();assert.equal(await app.windowOpen(w.message),false);
});
test('sen skapelse av läsfönstret efter timeout städas utan att godkänna flytt',async()=>{
 const {app,tick,api}=await loadBackground();const w=windowApi(api,app);w.message.folder.id='inbox';const e=unreadEngine(app);e.records.set('job',{});
 api.windows.create=()=>new Promise(resolve=>tick.setTimeout(()=>{w.tabs.set(55,{id:55,windowId:155});resolve({id:155,tabs:[{id:55}]});},12000));
 await tick.settle(app.beforeMove(w.message,{key:'job'}),100);await tick.flush(30);assert.equal(w.tabs.size,0);assert.equal(app.beforeWindows.size,0);
});
test('uppgraderingen väljer Före en gång, bevarar övriga regler och senare egna val',async()=>{
 const rule={id:'r1',name:'Mejl',enabled:true,source:'inbox',target:'fin',match:'any',conditions:[{field:'domain',op:'equals',value:'example.se'}],unreadAction:'window',openTiming:'after'};
 const stored={config:{...C.defaults(),rules:[rule,{...rule,id:'keep',unreadAction:'keep'}]}};
 const api=stubApi();api.storage.local.get=async()=>structuredClone(stored);api.storage.local.set=async data=>Object.assign(stored,structuredClone(data));
 const {app}=await loadBackground(api);assert.equal(app.engine.config.rules[0].openTiming,'before');assert.equal(app.engine.config.rules[1].openTiming,'after');assert.equal(stored.beforeReaderMigration,1);
 assert.equal(app.engine.config.rules[0].target,'fin');assert.equal(app.engine.config.rulesVersion,1);
 stored.config.rules[0].openTiming='after';const again=await loadBackground(api);assert.equal(again.app.engine.config.rules[0].openTiming,'after');
});
test('återstart med dolda tabb-URL:er skyddas via egna MV2-dokument',async()=>{
 const {app,api}=await loadBackground();const w=windowApi(api,app);unreadEngine(app);
 api.extension.getViews=()=>[{location:{href:api.runtime.getURL('reader.html')+'#old'}}];
 assert.equal(await app.windowOpen(w.message),true);api.extension.getViews=()=>[];assert.equal(await app.windowOpen(w.message),false);
});
test('flytt spärras även när läsfönstrets innehåll har visats men fönstret är öppet',async()=>{
 const {app,tick,api}=await loadBackground();inboxAccount(api);const w=windowApi(api,app);w.message.folder.id='inbox';
 const Engine=require('../addon/engine.js'),rule=C.validateRule({id:'r1',name:'Före',enabled:true,source:'inbox',target:'fin',match:'any',conditions:[{field:'domain',op:'equals',value:'example.se'}],readFilter:'unread',unreadAction:'window',openTiming:'before'});
 const engine=new Engine(api,{...C.defaults(),dryRun:false,moveMode:'direct',rules:[rule]},{now:tick.now,persist:async()=>{},beforeMove:app.beforeMove,windowOpen:app.windowOpen,ackTimeout:5});app.engine=engine;
 api.folders.get=async id=>({id,accountId:'a',name:id,specialUse:[]});api.folders.getFolderCapabilities=async()=>({canAddMessages:true,canDeleteMessages:true});
 let moves=0;api.messages.move=async()=>{moves++;};
 await engine.enqueue({...w.message});await tick.settle(engine.tick(),100);
 for(let i=0;i<5;i++){tick.setTimeout(()=>{},3000);await tick.flush(20);await tick.settle(engine.tick(),100);}
 assert.equal(moves,0);assert.equal(engine.pending.size,1);assert.equal(w.opened.length,1);assert(app.beforeWindows.values().next().value.confirmed);
});

test('läsfönsterpaus sparas separat utan regeländring eller regelbackup',async()=>{
 const {app,api,tick}=await loadBackground();const e=unreadEngine(app),before=JSON.stringify(e.config),saved=[];
 api.storage.local.set=async value=>saved.push(value);
 for(const [mode,duration] of [['15m',900000],['1h',3600000],['manual',null]]){
  const now=tick.now(),status=await app.setReaderPause(mode);
  assert.equal(status.paused,true);assert.equal(status.until,duration===null?-1:now+duration);
  assert.equal(app.snapshot().readerPause.until,status.until);
 }
 assert.equal(JSON.stringify(e.config),before);assert.equal(saved.length,3);
 assert(saved.every(x=>Object.keys(x).join(',')==='readerPauseUntil'));
 await app.setReaderPause('resume');assert.equal(app.readerPauseState().paused,false);assert.equal(saved.at(-1).readerPauseUntil,0);
});
test('tidsstyrd läsfönsterpaus släpper vid sluttiden, även efter sovglapp',async()=>{
 const {app,tick}=await loadBackground();unreadEngine(app);await app.setReaderPause('15m');
 let kicked=0;app.kick=()=>kicked++;
 tick.advance(899999);app.refreshReaderPause();assert.equal(app.readerPauseState().paused,true);assert.equal(kicked,0);
 tick.advance(1);app.refreshReaderPause();assert.equal(app.readerPauseState().paused,false);assert.equal(kicked,1);
 app.refreshReaderPause();assert.equal(kicked,1);
 await app.setReaderPause('1h');kicked=0;tick.advance(7200000);app.refreshReaderPause();assert.equal(app.readerPauseState().paused,false);assert.equal(kicked,1);
 await app.setReaderPause('manual');tick.advance(365*86400000);app.refreshReaderPause();assert.equal(app.readerPauseState().paused,true);
});
test('väntande Före-mejl öppnas inte under paus och blir inte felspärrat',async()=>{
 const {app,tick,api}=await loadBackground();const w=windowApi(api,app);w.message.folder.id='inbox';const e=unreadEngine(app);e.records.set('job',{});
 await app.setReaderPause('manual');
 for(let i=0;i<3;i++)assert.equal(await app.beforeMove(w.message,{key:'job'}),false);
 assert.equal(w.opened.length,0);assert.equal(app.beforeWindows.size,0);assert.equal(e.fault,'');
 await app.setReaderPause('resume');await tick.settle(app.beforeMove(w.message,{key:'job'}),100);
 assert.equal(w.opened.length,1);assert.equal(app.beforeWindows.get('job').closed,false);
});
test('paus under kroppshämtning skjuter upp öppningen utan window_error',async()=>{
 const {app,tick,api}=await loadBackground();const w=windowApi(api,app);w.message.folder.id='inbox';const e=unreadEngine(app);e.records.set('job',{});
 const full=api.messages.getFull;let release;api.messages.getFull=()=>new Promise(resolve=>release=resolve);
 const opening=app.beforeMove(w.message,{key:'job'});await new Promise(r=>setImmediate(r));assert.equal(typeof release,'function');
 await app.setReaderPause('manual');await app.setReaderPause('resume');release(await full());
 assert.equal(await tick.settle(opening,100),false);assert.equal(w.opened.length,0);assert.equal(e.fault,'');assert.equal(app.readers.size,0);
});
test('osparat pausval blockerar öppning direkt och dubbla val skrivs i ordning',async()=>{
 const {app,api}=await loadBackground();unreadEngine(app);let release;const saved=[];
 api.storage.local.set=async data=>{saved.push(data.readerPauseUntil);if(saved.length===1)await new Promise(resolve=>release=resolve);};
 const first=app.setReaderPause('manual');const second=app.setReaderPause('resume');
 assert.equal(app.readerPauseState().paused,true);assert.equal(app.readerPauseState().saving,true);
 await new Promise(r=>setImmediate(r));release();await Promise.all([first,second]);
 assert.deepEqual(saved,[-1,0]);assert.equal(app.readerPauseState().paused,false);assert.equal(app.readerPauseState().saving,false);
});
test('misslyckad paussparning kvitteras inte och skyddar fortsatt sortering',async()=>{
 const {app,api}=await loadBackground();const e=unreadEngine(app);app.readerPauseUntil=-1;
 api.storage.local.set=async()=>{throw Error('disk');};
 await assert.rejects(app.setReaderPause('resume'),e=>e.code==='storage_error');assert.equal(app.readerPauseState().paused,true);assert.equal(app.readerPauseState().saving,false);assert.equal(e.fault,'storage_error');
});
test('pausen återläses vid start medan utgången paus och nyinstallation är aktiva',async()=>{
 for(const value of [-1,Date.now()+3600000,Date.now()-60000,undefined]){
  const api=stubApi();api.storage.local.get=async()=>({beforeReaderMigration:1,readerPauseUntil:value});
  const {app}=await loadBackground(api);assert.equal(app.readerPauseState().paused,value===-1||value>Date.now());
 }
 const api=stubApi();api.storage.local.get=async()=>({beforeReaderMigration:1,readerPauseUntil:'bad'});
 const {app}=await loadBackground(api);assert.equal(app.readerPauseState().paused,true);assert.equal(app.engine.fault,'invalid_storage');
});
test('endast rätt läsfönster får ändra paus via sin sessionskanal',async()=>{
 const {app,api}=await loadBackground();windowApi(api,app);unreadEngine(app);
 app.readers.set('token',{tabId:11,closed:false,data:{},ready:true});const sender={id:api.runtime.id,url:api.runtime.getURL('reader.html')+'#token',tab:{id:11}};
 await assert.rejects(app.readerRequest({type:'readerPause',token:'token',mode:'manual'},{...sender,tab:{id:12}}));assert.equal(app.readerPauseState().paused,false);
 await assert.rejects(app.readerRequest({type:'readerPause',token:'token',mode:'invalid'},sender));assert.equal(app.readerPauseState().paused,false);
 assert.equal((await app.readerRequest({type:'readerPause',token:'token',mode:'manual'},sender)).paused,true);
 assert.equal((await app.readerRequest({type:'readerData',token:'token'},sender)).readerPause.until,-1);
 assert.equal((await app.readerRequest({type:'readerState',token:'token'},sender)).paused,true);
});
test('riktig motor: öppet mejl får avslutas under pausen, nästa mejl ligger kvar',async()=>{
 const {app,tick,api}=await loadBackground();inboxAccount(api);const w=windowApi(api,app);w.message.folder.id='inbox';
 const Engine=require('../addon/engine.js'),rule=C.validateRule({id:'r1',name:'Före',enabled:true,source:'inbox',target:'fin',match:'any',conditions:[{field:'domain',op:'equals',value:'example.se'}],readFilter:'unread',unreadAction:'window',openTiming:'before'});
 let moves=0,kicks=0;const engine=new Engine(api,{...C.defaults(),dryRun:false,moveMode:'direct',rules:[rule]},{now:tick.now,persist:async()=>{},beforeMove:app.beforeMove,windowOpen:app.windowOpen,kick:()=>kicks++,ackTimeout:5});app.engine=engine;
 api.folders.get=async id=>({id,accountId:'a',name:id,specialUse:[]});api.folders.getFolderCapabilities=async()=>({canAddMessages:true,canDeleteMessages:true});
 api.messages.move=async(ids,target)=>{moves++;const old={...w.message,folder:{...w.message.folder}};w.message.id+=100;w.message.folder.id=target;await engine.onMoved({messages:[old]},{messages:[{...w.message}]});};
 await engine.enqueue({...w.message});await tick.settle(engine.tick(),100);assert.equal(w.opened.length,1);
 await app.setReaderPause('manual');await tick.settle(engine.tick(),100);assert.equal(moves,0);
 w.tabs.clear();app.windowClosed(11);await tick.settle(engine.tick(),100);tick.advance(2100);await tick.settle(engine.tick(),100);assert.equal(moves,1);
 Object.assign(w.message,{id:300,headerMessageId:'next@x',folder:{id:'inbox'},read:false});await engine.enqueue({...w.message});kicks=0;
 for(let i=0;i<3;i++){tick.advance(2100);await tick.settle(engine.tick(),100);}
 assert.equal(moves,1);assert.equal(w.opened.length,1);assert.equal(engine.pending.size,1);assert.equal(kicks,0,'ingen omedelbar kick-loop');
 w.message.read=true;await engine.readChanged({...w.message},{read:true},{read:false});await tick.settle(engine.tick(),100);assert.equal(moves,1);
 await app.setReaderPause('resume');await tick.settle(engine.tick(),100);assert.equal(w.opened.length,2);assert.equal(moves,1,'fortsätt är inte en flyttknapp');
 w.tabs.clear();app.windowClosed(12);await tick.settle(engine.tick(),100);tick.advance(2100);await tick.settle(engine.tick(),100);assert.equal(moves,2);
});

test('manuell fullständig textlogg fungerar med avstängd automatisk fillogg',async()=>{
 const {app,api}=await loadBackground();const e=unreadEngine(app);e.config.fileLog=false;
 api.runtime.getManifest=()=>({version:'1.2.3'});app.tbVersion='160.0';app.selfInfo.installType='normal';
 app.logs=[C.event('queued',1),C.event('error',0,Date.now(),'motor_stoppad code=move_error'),C.event('debug',0,Date.now(),'fore flytt: vantar')];
 let downloads=0,writes=0;api.downloads.download=async()=>downloads++;api.storage.local.set=async()=>writes++;
 const config=JSON.stringify(e.config),text=await app.handle({type:'exportTextLog'});
 assert.match(text,/Version: 1\.2\.3/);assert.match(text,/Thunderbird: 160\.0/);assert.match(text,/Installation: normal/);
 assert.match(text,/\tqueued\tcount=1/);assert.match(text,/motor_stoppad code=move_error/);assert.match(text,/fore flytt: vantar/);
 assert.match(text,/regelnamn och domäner/);assert(text.endsWith('\r\n'));
 assert.equal(downloads,0);assert.equal(writes,0);assert.equal(JSON.stringify(e.config),config);
});
test('automatiska textloggen och manuell textkopia använder samma formattering',async()=>{
 const {app,api}=await loadBackground();unreadEngine(app);app.engine.config.fileLog=true;
 app.logs=[C.event('error',0,Date.now(),'window_error')];
 let calls=0;const render=app.technicalLogText;app.technicalLogText=()=>{calls++;return render();};
 const downloads=[];api.downloads.download=async args=>{downloads.push(args);return downloads.length;};
 await app.handle({type:'exportTextLog'});await app.writeTextLog();assert.equal(calls,2);
 const technical=downloads.find(x=>x.filename==='Lasfilter/logs/lasfilter-logg.txt');assert(technical);assert.equal(technical.saveAs,false);assert.equal(technical.conflictAction,'overwrite');
 assert(downloads.some(x=>x.filename==='Lasfilter/logs/sortbro-fellogg.txt'));
});
