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
   if(prop==='addListener'||prop==='removeListener'||prop==='hasListener')return ()=>{};
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
async function loadBackground(){
 const tick=clock();
 const sandbox={console,JSON,Math,Number,String,Array,Object,Map,Set,WeakMap,Promise,Error,TypeError,RegExp,Symbol,Boolean,isNaN,parseInt,parseFloat,structuredClone,
  Date:tick.Date,setTimeout:tick.setTimeout,clearTimeout:tick.clearTimeout,setInterval:tick.setInterval,clearInterval:tick.clearInterval,
  LasCore:C,
  LasEngine:class{constructor(){this.config={};this.fault='';this.pending=new Map();}stop(){}},
  browser:stubApi()};
 sandbox.globalThis=sandbox;
 const source=fs.readFileSync(path.join(ROOT,'addon','background.js'),'utf8')+'\nglobalThis.__app=App;';
 vm.runInNewContext(source,sandbox,{filename:'background.js'});
 const app=sandbox.__app;
 await app.ready.catch(()=>{}); /* låt startsvepet bli klart innan testet tar över motorn */
 return {app,tick};
}
/* Fejkad motor motsvarande den riktiga motorns kontrakt. */
function fakeEngine(app,over={}){
 const engine={enabled:()=>true,fault:'',pending:new Map(),sweeping:0,lastSweep:null,
  config:{paused:false,hourly:true,sweepMinutes:60,rules:[{id:'r1',enabled:true}],revision:0,rulesVersion:0},
  sweepAll:async()=>({scanned:0,queued:0,deferred:0,searchedFolders:0,skippedFolders:0,emptyFolders:0,cachedFolders:0}),
  tick:async()=>{},debug(){},stop(code){engine.fault=code;},...over};
 app.engine=engine;
 return engine;
}
const errorLogs=app=>app.logs.filter(l=>l.event==='error');

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
