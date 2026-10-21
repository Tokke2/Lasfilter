/* Säkerhetstester: SortBro ska aldrig kunna avinstallera sig självt, och när Thunderbird
   ändå stänger av tillägget ska loggen och gränssnittet säga varför i stället för att
   lämna användaren med en gissning.
   Kör: node --test tester/safety.test.cjs */
const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..');
const ADDON=path.join(ROOT,'addon');
const manifest=JSON.parse(fs.readFileSync(path.join(ADDON,'manifest.json'),'utf8'));

function addonSources(){
 return fs.readdirSync(ADDON)
  .filter(f=>/\.(js|html)$/.test(f))
  .map(f=>({name:f,text:fs.readFileSync(path.join(ADDON,f),'utf8')}));
}
/* Samma stubbe som background.test.cjs använder: okända anrop svarar tomt. */
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
async function loadBackground(api=stubApi()){
 const sandbox={console,JSON,Math,Number,String,Array,Object,Map,Set,WeakMap,Promise,Error,TypeError,RegExp,Symbol,Boolean,isNaN,parseInt,parseFloat,structuredClone,
  Date,
  /* Snabba timers som inte håller processen vid liv: writeTextLog sätter en
     60-sekunderstimer för att släppa bloben, och den behöver inte väntas in. */
  setTimeout:(fn,ms=0)=>{const t=global.setTimeout(fn,Math.min(Number(ms)||0,10));if(t&&t.unref)t.unref();return t;},
  clearTimeout:t=>global.clearTimeout(t),setInterval:()=>0,clearInterval:()=>{},
  LasCore:require(path.join(ADDON,'core.js')),
  LasFilters:require(path.join(ADDON,'filters.js')),
  Blob:class{constructor(parts){this.parts=parts;}},
  URL:{createObjectURL:typeof api.__captureBlob==='function'?api.__captureBlob:()=>'blob:x',revokeObjectURL:()=>{}},
  LasEngine:class{constructor(){this.config={rules:[],fileLog:true,verbose:false,verbose_:false};this.fault='';this.pending=new Map();this.inflight=new Map();}stop(){}enabled(){return false;}tick(){return Promise.resolve();}restore(){return Promise.resolve();}},
  browser:api};
 sandbox.globalThis=sandbox;
 const source=fs.readFileSync(path.join(ADDON,'background.js'),'utf8')+'\nglobalThis.__app=App;';
 require('vm').runInNewContext(source,sandbox,{filename:'background.js'});
 const app=sandbox.__app;
 await app.ready.catch(()=>{});
 return {app,api};
}

/* Minsta möjliga motor som status-ögonblicken behöver. */
function fakeEngine(app){
 const engine={enabled:()=>true,fault:'',pending:new Map(),inflight:new Map(),
  stats:{checks:0,matched:0,moved:0,simulated:0,skipped:0},blocked:()=>0,lastSweep:null,lastCheck:0,
  config:{paused:false,dryRun:true,moveMode:'read',hourly:true,sweepMinutes:60,newInboxDirect:true,openWindow:true,rules:[],revision:0,rulesVersion:0},
  tick:async()=>{},debug(){},stop(){},clearPending:async()=>{},invalidateFolders(){},recordList:()=>[],validateRuleFolders:async()=>{}};
 app.engine=engine;
 return engine;
}

test('tillägget kan inte avinstallera sig självt – inga sådana anrop finns i koden',()=>{
 const forbidden=[
  {pattern:/uninstallSelf/,why:'uninstallSelf avinstallerar tillägget'},
  {pattern:/management\.uninstall\s*\(/,why:'management.uninstall tar bort tillägg'},
  {pattern:/management\.setEnabled\s*\(/,why:'management.setEnabled stänger av tillägg'},
  {pattern:/AddonManager/,why:'AddonManager kan stänga av tillägg'}];
 for(const {name,text} of addonSources()){
  for(const {pattern,why} of forbidden)
   assert.ok(!pattern.test(text),name+' innehåller '+why);
 }
});

test('manifestet saknar management-behörigheten – därför är en avinstallation omöjlig',()=>{
 const perms=manifest.permissions||[];
 assert.deepEqual(perms,['accountsRead','accountsFolders','messagesRead','messagesMove','messagesUpdate','menus','storage','downloads'],
  'behörighetslistan är exakt den godkända – utan management');
 assert.ok(!perms.includes('management'),'utan management-behörigheten kan tillägget inte röra andra tillägg');
});

test('tillfällig installation upptäcks och loggen säger varför tillägget försvinner',async()=>{
 const {app,api}=await loadBackground();
 api.management={getSelf:async()=>({id:'lasfilter@lokala-verktyg.invalid',version:'1.0.0',installType:'development',mayDisable:true})};
 const info=await app.readSelfInfo();
 assert.equal(info.installType,'development');
 assert.equal(app.installWarnType(),'temporary','tillfällig installation ger en varning');
 assert.match(app.installLogNote(),/tillfallig/,'loggrader står i klartext');
 assert.match(app.installLogNote(),/forsvinner nar Thunderbird stangs/);
 assert.match(app.startDetail(),/installation development/,'startraden namnger installationen');
});

test('sidoladdad installation upptäcks och förklaras',async()=>{
 const {app,api}=await loadBackground();
 api.management={getSelf:async()=>({version:'1.0.0',installType:'sideload',mayDisable:true})};
 await app.readSelfInfo();
 assert.equal(app.installWarnType(),'sideload');
 assert.match(app.installLogNote(),/sidoladdad/);
});

test('permanent installation varnar inte',async()=>{
 const {app,api}=await loadBackground();
 api.management={getSelf:async()=>({version:'1.0.0',installType:'normal',mayDisable:true})};
 await app.readSelfInfo();
 assert.equal(app.installWarnType(),'');
 assert.equal(app.installLogNote(),'','ingen rad när allt är som det ska');
 assert.match(app.startDetail(),/installation normal/);
});

test('utan management-API gissar vi inget och kraschar inte',async()=>{
 const {app}=await loadBackground();
 /* Stubben svarar tomt på okända anrop: ingen installationstyp, ingen varning, inget fel. */
 const info=await app.readSelfInfo();
 assert.equal(info.installType,'');
 assert.equal(app.installWarnType(),'');
 assert.equal(app.installLogNote(),'');
 assert.equal(app.logs.filter(l=>l.event==='error').length,0,'inga felrader av en saknad API');
});

test('loggfilens huvud namnger installationen – spåret om tillägget är borta',async()=>{
 let captured=null;
 const api=stubApi();
 api.__captureBlob=blob=>{captured=blob;return 'blob:x';};
 api.management={getSelf:async()=>({version:'1.0.0',installType:'development',mayDisable:true})};
 const {app}=await loadBackground(api);
 await app.writeTextLog();
 const text=((captured&&captured.parts)||[]).join('');
 assert.match(text,/Installation: development/,'huvudet säger hur tillägget installerades');
 assert.match(text,/thunderbird .* installation development/,'startraden bär både versioner och installationstyp');
 assert.ok(app.logs.some(l=>l.event==='start'),'starten loggades – hela startvägen kördes');
});

test('status till gränssnittet bär installationstypen',async()=>{
 const {app,api}=await loadBackground();
 api.management={getSelf:async()=>({version:'1.0.0',installType:'sideload',mayDisable:true})};
 await app.readSelfInfo();
 fakeEngine(app);
 assert.equal(app.snapshot().installType,'sideload','gränssnittet får veta hur tillägget är installerat');
});

/* ---- Automatisk uppdatering -------------------------------------------------
   Tre saker måste stämma samtidigt, annars uppdaterar Thunderbird aldrig:
   manifestet måste peka på en HTTPS-adress, updates.json måste beskriva SAMMA
   tillägg, och versionen där måste vara den som filen faktiskt innehåller.
   Ett tyst fel här syns inte förrän en uppdatering uteblir – därför testas det. */
const crypto=require('node:crypto');

function gecko(){
 return (manifest.browser_specific_settings||manifest.applications||{}).gecko;
}

test('manifestet pekar på en HTTPS-adress för uppdateringar',()=>{
 const g=gecko();
 assert.ok(g,'manifestet saknar gecko-inställningar');
 assert.equal(g.id,'lasfilter@lokala-verktyg.invalid','id:t får aldrig byta – det är nyckeln i updates.json');
 assert.match(g.update_url,/^https:\/\//,'Thunderbird kräver https');
 assert.match(g.update_url,/\/updates\.json$/,'adressen ska peka på uppdateringsfilen');
});

test('uppdateringen hämtas från en release – aldrig från main eller en rå fil',()=>{
 const g=gecko();
 assert.match(g.update_url,/^https:\/\/github\.com\/Tokke2\/Lasfilter\/releases\/download\/v[0-9.]+\/updates\.json$/,'uppdateringsadressen ska vara en release-tillgång');
 assert.doesNotMatch(g.update_url,/\/main\/|raw\.githubusercontent/,'main får aldrig vara uppdateringskanal');
 const u=JSON.parse(fs.readFileSync(path.join(ROOT,'updates.json'),'utf8'));
 for(const item of u.addons[g.id].updates){
  assert.match(item.update_link,/^https:\/\/github\.com\/Tokke2\/Lasfilter\/releases\/download\//,'XPI-filen ska ligga som release-tillgång');
  assert.doesNotMatch(item.update_link,/\/main\/|raw\.githubusercontent/,'aldrig main eller rå fil');
 }
});

test('release-taggen är densamma i manifestet och i updates.json',()=>{
 const g=gecko();
 const u=JSON.parse(fs.readFileSync(path.join(ROOT,'updates.json'),'utf8'));
 const item=u.addons[g.id].updates[0];
 const tagOf=url=>String(url).match(/\/releases\/(?:download|tag)\/(v[0-9.]+)(?:\/|$)/)?.[1]||'';
 const manifestTag=tagOf(g.update_url);
 assert.ok(manifestTag,'manifestets adress saknar en versionstagg');
 assert.equal(tagOf(item.update_link),manifestTag,'nedladdningslänken pekar på en annan release');
 assert.equal(tagOf(item.update_info_url),manifestTag,'informationslänken pekar på en annan release');
});

test('uppdateringsfilen är en tillgång i releasen, inte en fil på en gren',()=>{
 const g=gecko();
 const u=JSON.parse(fs.readFileSync(path.join(ROOT,'updates.json'),'utf8'));
 assert.equal(u.addons[g.id].updates.length,1,'en post per release räcker – äldre versioner behövs inte');
 assert.equal(u.addons[g.id].updates[0].version,manifest.version);
});

test('releasen får sina filer automatiskt när taggen flyttas',()=>{
 const wf=path.join(ROOT,'.github','workflows','release-assets.yml');
 assert.ok(fs.existsSync(wf),'arbetsflödet som lägger filerna på releasen saknas');
 const text=fs.readFileSync(wf,'utf8');
 for(const file of ['SortBro-Thunderbird.xpi','SortBro-Thunderbird.xpi.sha256','updates.json']){
  assert.ok(text.includes(file),'arbetsflödet måste ladda upp '+file);
 }
 assert.match(text,/tags:/,'ska köras när en tagg flyttas');
 assert.match(text,/contents:\s*write/,'behöver skrivrättighet till releasen');
 assert.match(text,/sha256sum/,'ska kontrollera hashen före uppladdning');
});

test('updates.json beskriver samma tillägg som manifestet',()=>{
 const g=gecko();
 const u=JSON.parse(fs.readFileSync(path.join(ROOT,'updates.json'),'utf8'));
 const entry=(u.addons&&u.addons[g.id])||null;
 assert.ok(entry,'updates.json saknar en post för '+g.id);
 const list=Array.isArray(entry.updates)?entry.updates:[];
 assert.ok(list.length>=1,'minst en version måste listas');
 for(const item of list){
  assert.match(item.version,/^\d+\.\d+\.\d+$/,'versionen ska vara ett riktigt versionsnummer');
  assert.match(item.update_link,/^https:\/\//,'nedladdningslänken måste vara https');
  assert.match(item.update_hash,/^sha256:[0-9a-f]{64}$/,'hashningen ska vara sha256 i hex');
 }
});

test('updates.json är i takt med den XPI som ligger i repot',()=>{
 const g=gecko();
 const u=JSON.parse(fs.readFileSync(path.join(ROOT,'updates.json'),'utf8'));
 const item=u.addons[g.id].updates[0];
 assert.equal(item.version,manifest.version,'updates.json och manifestet måste ha samma version');
 const hash=crypto.createHash('sha256')
  .update(fs.readFileSync(path.join(ROOT,'SortBro-Thunderbird.xpi')))
  .digest('hex');
 assert.equal(item.update_hash,'sha256:'+hash,'annars avvisar Thunderbird filen som uppdatering');
 const sidecar=fs.readFileSync(path.join(ROOT,'SortBro-Thunderbird.xpi.sha256'),'utf8').trim();
 assert.equal(sidecar.split(/\s+/)[0],hash,'kontrollsumman bredvid filen ska vara samma');
});

test('versionsnumret i gränssnittet är manifestets version',()=>{
 const ui=fs.readFileSync(path.join(ADDON,'ui.js'),'utf8');
 const found=[...ui.matchAll(/· v(\d+\.\d+\.\d+) ·/g)].map(m=>m[1]);
 assert.ok(found.length>=2,'både svensk och engelsk text ska visa versionen');
 assert.deepEqual([...new Set(found)],[manifest.version],'sidfoten får inte säga en annan version än manifestet');
});
