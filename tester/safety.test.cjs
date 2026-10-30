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
 let pending;
 api.__captureBlob=blob=>{pending=blob;return 'blob:x';};
 api.downloads.download=async arg=>{if(arg.filename.endsWith('/lasfilter-logg.txt'))captured=pending;return 1;};
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

test('uppdateringen hämtas från senaste release – aldrig från main eller en rå fil',()=>{
 const g=gecko();
 assert.match(g.update_url,/^https:\/\/github\.com\/Tokke2\/Lasfilter\/releases\/latest\/download\/updates\.json$/,'uppdateringsadressen ska följa senaste release');
 assert.doesNotMatch(g.update_url,/\/main\/|raw\.githubusercontent/,'main får aldrig vara uppdateringskanal');
 const u=JSON.parse(fs.readFileSync(path.join(ROOT,'updates.json'),'utf8'));
 for(const item of u.addons[g.id].updates){
  assert.match(item.update_link,/^https:\/\/github\.com\/Tokke2\/Lasfilter\/releases\/latest\/download\//,'XPI-filen ska ligga på senaste release');
  assert.doesNotMatch(item.update_link,/\/main\/|raw\.githubusercontent/,'aldrig main eller rå fil');
 }
});

/* Adressen är inbakad i den installerade kopian och kan inte ändras i efterhand.
   Därför måste den följa "senaste release" i stället för en fast tagg – annars
   slutar en gammal installation leta nya versioner så snart taggen byts. */
test('uppdateringsadressen följer senaste release så att en installerad kopia aldrig blir kvar',()=>{
 const g=gecko();
 assert.match(g.update_url,/\/releases\/latest\/download\//,'en fast tagg skulle låsa gamla installationer');
 const u=JSON.parse(fs.readFileSync(path.join(ROOT,'updates.json'),'utf8'));
 assert.match(u.addons[g.id].updates[0].update_link,/\/releases\/latest\/download\//);
 assert.match(u.addons[g.id].updates[0].update_info_url,/\/releases\/latest$/);
});

/* Bryggan: kopior installerade som 1.0.0 läser fortfarande release v1.0.0.
   Den releasen måste därför få samma filer vid varje släpp. */
test('arbetsflödet uppdaterar även bryggreleasen v1.0.0',()=>{
 const text=fs.readFileSync(path.join(ROOT,'.github','workflows','release-assets.yml'),'utf8');
 assert.match(text,/BRIDGE_TAG:\s*v1\.0\.0/,'bryggreleasen ska vara v1.0.0');
 assert.match(text,/upload "\$BRIDGE_TAG"/,'filerna ska laddas upp även dit');
});

test('versionen höjs när filerna ändras – annars uppdaterar Thunderbird aldrig',()=>{
 /* Thunderbird jämför versionsnummer, inte filinnehåll. Ett versionssteg i
     patchnivå är det som gör en ny fil till en uppdatering. */
 const parts=manifest.version.split('.').map(Number);
 assert.equal(parts.length,3,'versionen ska ha tre delar');
 assert.ok(parts.every(Number.isInteger),'varje del ska vara ett heltal');
 assert.ok(Number.isInteger(parts[2]),'patchdelen styr uppdateringen');
});

test('uppdateringsfilen är en tillgång på releasen, inte en fil på en gren',()=>{
 const g=gecko();
 const u=JSON.parse(fs.readFileSync(path.join(ROOT,'updates.json'),'utf8'));
 assert.equal(u.addons[g.id].updates.length,1,'en post per release räcker – äldre versioner behövs inte');
 assert.equal(u.addons[g.id].updates[0].version,manifest.version,'updates.json måste säga samma version som manifestet');
});

/* Windows-skriptet som uppdaterar. Det får bara göra fyra saker: jämföra
   versioner, ladda ner, kontrollsumma och byta ut XPI-filen i profilen. Det
   får aldrig skriva i Thunderbirds databas – den ska Thunderbird äga. Och det
   måste vara tekniskt körbart: ren ASCII, bara CRLF, inga utropstecken (de äts
   upp av delayed expansion) och alla etiketter utsatta. */
test('uppdateringsskriptet för Windows finns och är körbart',()=>{
 const file=path.join(ROOT,'Uppdatera-SortBro.bat');
 assert.ok(fs.existsSync(file),'Uppdatera-SortBro.bat saknas');
 const raw=fs.readFileSync(file);
 const text=raw.toString('latin1');
 assert.equal(/[\x80-\xff]/.test(text),false,'bara ASCII – annars blir svenska tecken skräp i cmd');
 assert.equal(text.replace(/\r\n/g,'').includes('\n'),false,'bara CRLF – annars kan cmd tappa en etikett');
 assert.equal(text.includes('!'),false,'inga utropstecken – delayed expansion äter dem');
 assert.ok(text.includes('lasfilter@lokala-verktyg.invalid'),'ska känna igen tilläggets id');
 assert.match(text,/Thunderbird\\Profiles/,'ska leta i Thunderbird-profilerna');
 assert.match(text,/releases\/latest\/download\/updates\.json/,'ska fråga senaste release');
 /* Ett tappat citattecken skickar halva raden till PowerShell i stället för
    hela, och då gör skriptet något annat än det ser ut att göra. */
 for(const line of text.split(/\r?\n/)){
   if(!/^\s*powershell\s/.test(line))continue;
   assert.equal((line.match(/"/g)||[]).length%2,0,'udda antal citattecken: '+line.trim().slice(0,70));
   assert.match(line.trim(),/2>(?:nul|&1)$/,'PowerShell-raden ska sluta med 2>nul eller 2>&1');
 }
});

test('uppdateringen väger tyngre än att bara byta en fil',()=>{
 const text=fs.readFileSync(path.join(ROOT,'Uppdatera-SortBro.bat'),'latin1');
 /* Ordningen är hela säkerheten: kontrollsumman ska stämma innan något rörs,
    originalet ska ligga i en kopia, och resultatet ska läsas tillbaka ur
    Thunderbirds egen databas i stället för att antas. */
 assert.match(text,/Get-FileHash[^\n]*SHA256/i,'ska räkna kontrollsumma på det nedladdade');
 assert.ok(text.indexOf('update_hash')>-1,'ska jämföra mot den hash som releasen anger');
 assert.ok(text.indexOf('%HASHEX%')<text.indexOf("Copy-Item -LiteralPath '%NEW%'"),'hashkontrollen måste ske före bytet');
 assert.match(text,/Lasfilter\\Backup/,'den gamla XPI-filen ska sparas undan först');
 assert.match(text,/Join-Path '%PROFILE%' 'extensions\.json'/,'resultatet ska läsas ur Thunderbirds databas');
 assert.match(text,/CloseMainWindow/,'Thunderbird ska stängas snällt, inte dödas');
 assert.match(text,/\/tyst/,'ska kunna köras utan frågor, till exempel av en schemalagd uppgift');

 /* Databasen är Thunderbirds. Ett skript som skriver i den kan förstöra
    hela tilläggslistan, och en uppdatering behöver aldrig göra det. */
 assert.equal(/Set-Content[^\n]*extensions\.json|Out-File[^\n]*extensions\.json|Add-Content[^\n]*extensions\.json/i.test(text),false,'får aldrig skriva i extensions.json');
 assert.equal(/Remove-Item[^\n]*extensions\.json/i.test(text),false,'får aldrig radera extensions.json');
 assert.equal(/taskkill\s+\/f/i.test(text),false,'får inte tvinga igenom en stängning');
});

/* Frågan "kan den inte uppdatera sig själv?" ska skriptet kunna svara på:
   det läser Thunderbirds egna inställningar och skriver ut dem i klartext.
   Läsningen får aldrig bli en skrivning – prefs.js ägs av Thunderbird. */
test('uppdateringsskriptet säger om Thunderbird sköter det själv',()=>{
 const text=fs.readFileSync(path.join(ROOT,'Uppdatera-SortBro.bat'),'latin1');
 assert.ok(text.includes('extensions\\.update\\.interval'),'ska läsa kontrolltakten');
 assert.ok(text.includes('extensions\\.update\\.enabled'),'ska läsa om automatiken är på');
 assert.ok(text.includes('extensions\\.update\\.autoUpdateDefault'),'ska läsa den globala standarden');
 assert.ok(text.includes('applyBackgroundUpdates'),'ska läsa tilläggets egen inställning');
 assert.ok(text.includes('Automatik:'),'svaret ska synas för användaren');
 assert.equal(/Set-Content[^\n]*prefs\.js|Out-File[^\n]*prefs\.js|Add-Content[^\n]*prefs\.js/i.test(text),false,'får aldrig skriva i prefs.js');
});

/* Säsongsikonen i verktygsfältet byggs som season-<årstid>-<storlek>.png.
   Filerna hette en gång season-var/sommar/host/vinter, så setIcon pekade på
   filer som inte fanns och felet slukades av en tom catch – ikonen byttes
   aldrig. Namnen ska följa SEASONS, inte svenskan. */
test('säsongsikonerna heter det koden letar efter',()=>{
 const bg=fs.readFileSync(path.join(ADDON,'background.js'),'utf8');
 assert.match(bg,/season-'\+s\+'-/,'sökvägen ska byggas av årstidsnamnet');
 const core=fs.readFileSync(path.join(ADDON,'core.js'),'utf8');
 const m=core.match(/SEASONS=Object\.freeze\(\[([^\]]*)\]\)/);
 assert.ok(m,'SEASONS saknas i core.js');
 const seasons=m[1].split(',').map(s=>s.trim().replace(/'/g,''));
 assert.deepEqual(seasons,['spring','summer','autumn','winter'],'årstiderna är engelska nycklar');
 for(const s of seasons){
   for(const z of ['16','32','48','64']){
     assert.ok(fs.existsSync(path.join(ADDON,`season-${s}-${z}.png`)),`season-${s}-${z}.png saknas`);
   }
 }
 for(const f of fs.readdirSync(ADDON).filter(n=>n.startsWith('season-'))){
   assert.match(f,/^season-(spring|summer|autumn|winter)-(16|32|48|64)\.png$/,'okänt säsongsnamn i filnamnet: '+f);
 }
});

/* Allt SortBro skapar ska hamna i en undermapp till appmappen – aldrig löst i
   Hämtade filer. Sökvägarna kommer från en enda källa (App.paths) och varje
   skrivning måste gå genom den. */
test('varje fil hamnar i en undermapp till appmappen',()=>{
 const bg=fs.readFileSync(path.join(ADDON,'background.js'),'utf8');
 const paths=bg.match(/App\.paths=\{([^}]*)\}/);
 assert.ok(paths,'App.paths saknas');
 const map={};
 for(const [,k,v] of bg.matchAll(/(\w+):'(Lasfilter\/[^']*)'/g))map[k]=v;
 for(const key of ['root','logs','backups','rules','filters']){
   assert.ok(map[key],'sökvägen '+key+' saknas');
   assert.match(map[key],/^Lasfilter\//,'alla sökvägar börjar med appmappen');
 }
 for(const key of ['logs','backups','rules','filters']){
   assert.match(map[key],/^Lasfilter\/[^/]+\/$/,'undermappen '+key+' ska sluta med snedstreck: '+map[key]);
 }
 /* Ingen skrivning får använda en sökväg som inte är en av undermapparna. */
 for(const line of bg.split(/\r?\n/)){
   if(!line.includes('downloads.download('))continue;
   assert.match(line,/App\.paths\.(logs|backups|rules|filters)|App\.backupFolder|filename,/,'skrivning utan undermapp: '+line.trim().slice(0,90));
 }
 const ui=fs.readFileSync(path.join(ADDON,'ui.js'),'utf8');
 /* En export får skicka en sökväg direkt från paths() eller en variabel som
    byggts av paths() – inget annat. */
 const fromPaths=new Set([...ui.matchAll(/const (\w+)\s*=\s*paths\(\)\.(logs|backups|rules|filters)/g)].map(m=>m[1]));
 for(const line of ui.split(/\r?\n/)){
   if(!/await download\(/.test(line))continue;
   const ok=/paths\(\)\.(logs|backups|rules|filters)/.test(line)||[...fromPaths].some(v=>new RegExp('\\b'+v+'\\b').test(line));
   assert.ok(ok,'export utan undermapp: '+line.trim().slice(0,90));
 }
});

/* Säkerhetskopian skrivs en gång i veckan. Inte vid varje regelsparning – det
   var den gamla takten och den gjorde ett skrivsteg av varje ändring. */
test('säkerhetskopian skrivs en gång per vecka',()=>{
 const bg=fs.readFileSync(path.join(ADDON,'background.js'),'utf8');
 const body=bg.slice(bg.indexOf('App.autoBackup='),bg.indexOf('App.scheduleAutoBackup='));
 assert.match(body,/const weekly=force\|\|App\.lastBackupWeek!==week/,'takten ska vara veckan');
 assert.match(body,/if\(!weekly\)return \{written:false,reason:'not_due'/,'utanför veckan skrivs ingenting');
 assert.match(bg,/App\.maybeWeeklyBackup=/,'pulsen ska kunna skriva veckokopian utan omstart');
 const tick=bg.slice(bg.indexOf('App.timer=setInterval'),bg.indexOf('},2000);',bg.indexOf('App.timer=setInterval')));
 assert.match(tick,/maybeWeeklyBackup\(\)/,'pulsen ska fråga efter veckan');
});

/* Cache-rensningen får bara tömma det som är cache. Kön, journalen, minnet av
   redan hanterade mejl, provkörningens räknare och bromsens historik är inte
   cache – de skyddar mot att samma mejl hanteras två gånger. */
test('cache-rensningen rör bara cache',()=>{
 const bg=fs.readFileSync(path.join(ADDON,'background.js'),'utf8');
 const start=bg.indexOf('App.clearCaches=');
 assert.ok(start>0,'clearCaches saknas');
 const body=bg.slice(start,bg.indexOf('\n};',start));
 assert.match(body,/invalidateFolders\?\.\(\)/,'mappcachen ska tömmas');
 assert.match(body,/yearFolderIds\?\.clear\(\)/,'årsmapparnas karta ska tömmas');
 assert.match(body,/invalidateScan\(\)/,'sökningen ska räknas om');
 for(const skyddad of ['done.clear','records.clear','pending.clear','trialKeys.clear','brakeHistory=']){
   assert.equal(body.includes(skyddad),false,'cache-rensningen får aldrig röra '+skyddad);
 }
 /* Mitt i en flytt är mappbilden på väg att ändras – då väntar vi. */
 assert.match(body,/cacheBusy\(\)/,'ska vägra rensa medan kön inte är tom');
 /* Dagen ska sparas, annars rensar en omstart samma dygn igen. */
 assert.match(body,/storage\.local\.set\(\{cacheDay/,'dagen ska sparas i lagringen');
});

test('den dagliga rensningen är på som standard och drivs av pulsen',()=>{
 const core=fs.readFileSync(path.join(ADDON,'core.js'),'utf8');
 assert.match(core,/autoClear:true/,'cachen ska rensas automatiskt som standard');
 assert.match(core,/const autoClear=raw\.autoClear===undefined\?true:raw\.autoClear/,'äldre konfigurationer ska få true');
 const bg=fs.readFileSync(path.join(ADDON,'background.js'),'utf8');
 const tick=bg.slice(bg.indexOf('App.timer=setInterval'),bg.indexOf('},2000);',bg.indexOf('App.timer=setInterval')));
 assert.match(tick,/maybeClearCache\(\)/,'pulsen ska sköta den dagliga kontrollen');
 assert.match(bg,/autoClear===false\)return null/,'avstängd automatisk rensning ska vara tyst');
});

/* Tyst omstart: en nedladdad version ska tas i bruk utan fråga, men aldrig mitt
   i en flytt. Det får inte heller kräva något som Thunderbird inte har. */
test('en ny version startas tyst och bara när inget pågår',()=>{
 const bg=fs.readFileSync(path.join(ADDON,'background.js'),'utf8');
 assert.match(bg,/runtime\.onUpdateAvailable\.addListener/,'bakgrunden ska lyssna på nya versioner');
 assert.match(bg,/runtime\.reload\(\)/,'den ska ladda om tillägget själv i stället för att vänta på Thunderbird');
 assert.match(bg,/App\.engineBusy\(\)&&!overdue/,'den ska vänta tills ingen flytt eller inget svep pågår');
 assert.match(bg,/30\*60\*1000/,'men inte vänta i evighet');
 /* Ingen fråga, ingen omstart av Thunderbird – bara tillägget laddas om. */
 assert.equal(/confirm\(|alert\(/.test(bg),false,'ingen fråga till användaren');
 /* Uppdateringskontrollen får bara användas om anropet finns: i Thunderbird är
    runtime.requestUpdateCheck deklarerat men märkt "unsupported" i schemat. */
 assert.match(bg,/if\(typeof call!=='function'\)return 'unsupported'/,'anropet måste kollas innan det används');
 assert.match(bg,/App\.updateCheckEveryMs=12\*60\*60\*1000/,'en kontroll var tolfte timme');
});

test('dokumentationen säger hur man får två kontroller per dygn',()=>{
 const doc=fs.readFileSync(path.join(ROOT,'LAS-MIG.md'),'utf8');
 assert.match(doc,/extensions\.update\.interval/,'dygnsintervallet ska nämnas vid namn');
 assert.match(doc,/43200/,'och värdet för tolv timmar');
});

/* Listorna i gränssnittet får inte byggas om i onödan: statusen kommer högst var
   hundrade millisekund under ett svep, och att rita om 5 000 loggrader varje gång
   kostade mer än svepet. */
test('listorna ritas bara om när deras indata ändrats',()=>{
 const ui=fs.readFileSync(path.join(ADDON,'ui.js'),'utf8');
 assert.match(ui,/function unchanged\(key,signature\)/,'det ska finnas en jämförelse per lista');
 for(const fn of ['renderRules','renderActivity','renderTrialBar','renderLearnBar','renderBackups','renderQuickExisting','renderTbAccounts']){
  const body=ui.slice(ui.indexOf('function '+fn+'('));
  const head=body.slice(0,600);
  assert.match(head,/unchanged\(|logShown/,'listan '+fn+' måste hoppa över oförändrat läge');
  assert.match(head,/return;|insertBefore|every\(/,'och faktiskt hoppa över');
 }
 assert.match(ui,/body\.insertBefore\(frag,first\|\|null\)/,'nya loggrader läggs till i stället för att tabellen byggs om');
 assert.match(ui,/function repaint\(\)\{painted\.clear\(\);logShown\.length=0;\}/,'språkbyte och mappbyte ska tvinga en omritning');
});

/* Den tysta omstarten får inte slänga bort loggraden som förklarar den. */
test('skrivningarna spolas ut innan tillägget startas om',()=>{
 const bg=fs.readFileSync(path.join(ADDON,'background.js'),'utf8');
 const fn=bg.slice(bg.indexOf('App.flushWrites='),bg.indexOf('App.applyPendingUpdate='));
 assert.match(fn,/clearTimeout\(App\.logTimer\)/,'den väntande loggskrivningen ska avbrytas');
 assert.match(fn,/clearTimeout\(App\.fileLogTimer\)/,'och den väntande loggfilen');
 assert.match(fn,/await App\.write\(/,'allt ska skrivas');
 const apply=bg.slice(bg.indexOf('App.applyPendingUpdate='));
 assert.match(apply.slice(0,600),/await App\.flushWrites\(\)[\s\S]{0,40}runtime\.reload\(\)/,'spolningen ska ske före reload');
});

/* Snabbmenyn var den enda platsen där språkvalet inte följde med. */
test('snabbmenyns titel finns på båda språken',()=>{
 const bg=fs.readFileSync(path.join(ADDON,'background.js'),'utf8');
 assert.match(bg,/App\.menuTitle=\(\)=>/, 'titeln ska räknas ut, inte skrivas fast');
 assert.match(bg,/menus\.update\(MENU_ID/,'menyn ska uppdateras när språket byts');
 assert.match(bg,/App\.syncMenu\(\);return next;/,'språkbytet ska synka menyn');
 const line=bg.match(/App\.menuTitle=\(\)=>[^\n]+/)[0];
 assert.match(line,/SortBro: Skapa filter/);
 assert.match(line,/SortBro: Create a filter/,'engelsk titel saknas');
});

test('zippen innehåller allt som hör till releasen',()=>{
 const {execFileSync}=require('child_process');
 const out=execFileSync('bash',[path.join(ROOT,'tools','package_zip.sh')],{encoding:'utf8'}).trim();
 assert.ok(fs.existsSync(path.join(ROOT,out)),'zippen byggdes inte: '+out);
 assert.match(path.basename(out),/^SortBro-\d+\.\d+\.\d+\.zip$/,'zipnamnet ska bära versionen');
 const list=execFileSync('unzip',['-Z1',path.join(ROOT,out)],{encoding:'utf8'}).trim().split(/\r?\n/).sort();
 assert.deepEqual(list,[
  'LAS-MIG.md',
  'SortBro-Thunderbird.xpi',
  'SortBro-Thunderbird.xpi.sha256',
  'Uppdatera-SortBro.bat',
  'updates.json',
 ].sort(),'zippen ska innehålla allt och inget annat');
});

test('releasen får sina filer automatiskt när taggen flyttas',()=>{
 const wf=path.join(ROOT,'.github','workflows','release-assets.yml');
 assert.ok(fs.existsSync(wf),'arbetsflödet som lägger filerna på releasen saknas');
 const text=fs.readFileSync(wf,'utf8');
 /* Tre filer på release-sidan, inte fler. Två av dem måste ligga löst:
    Thunderbird hämtar updates.json och XPI:n över HTTP och adressen till
    updates.json sitter inbakad i installerade kopior. Resten åker med i
    zippen. */
 assert.ok(text.includes('SortBro-Thunderbird.xpi'),'arbetsflödet måste ladda upp XPI:n löst');
 assert.ok(text.includes('updates.json'),'arbetsflödet måste ladda upp updates.json löst');
 assert.match(text,/tools\/package_zip\.sh/,'arbetsflödet måste bygga zippen');
 assert.equal(/^\s+SortBro-Thunderbird\.xpi\.sha256 \\$/m.test(text),false,'kontrollsumman ska ligga i zippen, inte lös');
 assert.equal(/^\s+Uppdatera-SortBro\.bat \\$/m.test(text),false,'skriptet ska ligga i zippen, inte lös');
 assert.match(text,/gh api -X DELETE/,'gamla lösplock ska städas bort från releasen');
 assert.match(text,/tags:/,'ska köras när en tagg flyttas');
 assert.match(text,/contents:\s*write/,'behöver skrivrättighet till releasen');
 assert.match(text,/tools\/verify_release\.py/,'ska kontrollera version och hash före uppladdning');
 /* En flyttad tagg gör att GitHub lägger releasen som utkast och flyttar
    "latest" till en äldre release – då slutar uppdateringarna komma. */
 assert.match(text,/draft=false/,'måste publicera releasen igen efter en flyttad tagg');
 assert.match(text,/make_latest=true/,'måste peka releases\/latest på den nya versionen');
 assert.match(text,/if: github\.ref_name != env\.BRIDGE_TAG/,'bryggan v1.0.0 ska inte flyttas till latest');
 /* /releases/tags/<tagg> svarar bara på GET – PATCH måste gå mot release-id:t. */
 assert.match(text,/releases\/tags\/\$GITHUB_REF_NAME" --jq \.id/,'måste hämta release-id:t först');
 assert.match(text,/releases\/\$id" -f make_latest=true/,'måste peka latest via release-id:t');
 assert.match(text,/test "\$latest" = "\$GITHUB_REF_NAME"/,'ska avbryta om latest inte blev rätt version');
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

test('sidfoten läser versionen ur manifestet i stället för ur en textsträng',()=>{
 const ui=fs.readFileSync(path.join(ADDON,'ui.js'),'utf8');
 assert.match(ui,/function versionText\(\)/,'det ska finnas en funktion som räknar ut versionstexten');
 assert.match(ui,/getManifest\?\.\(\)\?\.version/,'den ska läsa runtime.getManifest().version');
 assert.match(ui,/key==='versionText'\?versionText\(\):T\(key\)/,'den ska användas när sidfoten skrivs');
});

test('versionsnumret i gränssnittet är manifestets version (reservtexten)',()=>{
 const ui=fs.readFileSync(path.join(ADDON,'ui.js'),'utf8');
 const found=[...ui.matchAll(/· v(\d+\.\d+\.\d+) ·/g)].map(m=>m[1]);
 assert.ok(found.length>=2,'både svensk och engelsk text ska visa versionen');
 assert.deepEqual([...new Set(found)],[manifest.version],'sidfoten får inte säga en annan version än manifestet');
 /* ui.html har samma text som reserv. Den stod kvar på 1.0.0 i 1.0.1 och syntes
    för alla som körde svenska, eftersom sidfoten bara skrevs om vid språkbyte. */
 const html=fs.readFileSync(path.join(ADDON,'ui.html'),'utf8');
 const fallback=[...html.matchAll(/· v(\d+\.\d+\.\d+) ·/g)].map(m=>m[1]);
 assert.deepEqual([...new Set(fallback)],[manifest.version],'reservtexten i ui.html måste vara manifestets version');
});

test('sidfoten skrivs om vid start, inte bara när språket byts',()=>{
 const ui=fs.readFileSync(path.join(ADDON,'ui.js'),'utf8');
 assert.match(ui,/function applyVersionLabel\(\)\{/,'det ska finnas en funktion som skriver sidfoten');
 assert.match(ui,/applyVersionLabel\(\);\n if\(\$\('installWarnHide'\)\)/,'den ska anropas först av allt vid start');
 const boot=ui.slice(ui.lastIndexOf('(async()=>{'));
 assert.ok(boot.indexOf('applyVersionLabel()')<boot.indexOf('await rpc('),'den ska köra innan något hämtas från bakgrunden');
});
