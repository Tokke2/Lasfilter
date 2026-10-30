'use strict';
const C=LasCore,B=browser;
const App={engine:null,logs:[],errorLogs:[],backups:[],prefs:{theme:'system',fontSize:14,lastRule:'',lastTarget:'',lang:'sv',season:'auto'},writeChain:Promise.resolve(),editChain:Promise.resolve(),mailTab:null,uiTab:null,timer:null,sweepTimer:null,kickTimer:null,logTimer:null,fileLogTimer:null,changeTimer:null,keepUnread:new Map(),prefill:null,lastAutoSweep:null,lastTickAt:0,startedAt:0,startSweepDone:false,
 /* "Lär av din flytt": domäner du själv flyttat till en mapp. Bara domän, mapp
    och antal sparas – aldrig ämne, namn eller mejltext. */
 learned:{off:false,entries:[],snooze:{}}};
/* Allt SortBro skapar hamnar i undermappar till appmappen i Hämtade filer.
   En enda källa för sökvägarna, så att inget kan hamna utanför av misstag.
   Sökvägarna skrivs med / och fungerar på Windows, macOS och Linux –
   nedladdningsmappen ligger i användarens hemkatalog på alla tre. */
App.paths={
 root:'Lasfilter/',
 logs:'Lasfilter/Loggar/',
 backups:'Lasfilter/Regelbackuper/',
 rules:'Lasfilter/Regler/',
 filters:'Lasfilter/Filterfiler/'
};
const SEASONS=['spring','summer','autumn','winter'];
App.season=()=>{
 const pref=App.prefs.season;
 return SEASONS.includes(pref)?pref:C.seasonOf(new Date());
};
App.seasonIconPath=season=>{const s=SEASONS.includes(season)?season:C.seasonOf(new Date());return {'16':'season-'+s+'-16.png','32':'season-'+s+'-32.png','48':'season-'+s+'-48.png','64':'season-'+s+'-64.png'};};
App.applySeasonIcon=()=>{
 try{const season=App.season();if(App.seasonIcon===season)return;App.seasonIcon=season;B.browserAction.setIcon({path:App.seasonIconPath(season)}).catch(()=>{});}catch{}
};
App.write=fn=>{const p=App.writeChain.then(fn);App.writeChain=p.catch(()=>{});return p;};
App.persistPending=null;
App.persistWork=()=>{
 if(!App.persistPending){
  App.persistPending=App.write(async()=>{
   App.persistPending=null;
   await B.storage.local.set({work:App.engine.recordList()});
  });
 }
 return App.persistPending;
};
/* Thunderbirds version sparas vid start. Den behövs i loggen: om tillägget en dag
   är borta vill man kunna se vilken version det senast kördes i – och om en
   uppdatering av Thunderbird kom strax innan. */
App.tbVersion='';
App.readTbVersion=async()=>{
 try{
  const info=await B.runtime.getBrowserInfo();
  App.tbVersion=String(info?.version||'').slice(0,32);
 }catch{App.tbVersion='';}
 return App.tbVersion;
};
/* Hur tillägget är installerat. management.getSelf() kräver ingen ny behörighet
   (Thunderbird: "can be used without requesting the 'management' permission") och är
   det enda sättet inifrån att veta om installationen är tillfällig. SortBro avinstallerar
   aldrig sig självt – men ett tillfälligt eller sidoladdat tillägg kan Thunderbird stänga
   av, och då ser det ut som om det försvann av sig själv. Vi kan inte hindra det, men vi
   kan säga exakt vad som gäller i stället för att lämna användaren i sticket. */
App.selfInfo={installType:'',version:'',mayDisable:null};
App.readSelfInfo=async()=>{
 try{
  const info=await B.management.getSelf();
  App.selfInfo={installType:typeof info?.installType==='string'?info.installType.slice(0,24):'',
   version:String(info?.version||'').slice(0,32),mayDisable:info?.mayDisable===true};
 }catch{App.selfInfo={installType:'',version:'',mayDisable:null};}
 return App.selfInfo;
};
/* 'temporary' = inläst tillfälligt (försvinner vid omstart), 'sideload' = ligger i
   profilmappens extensions-katalog (kan stängas av), '' = permanent och ofarligt. */
App.installWarnType=()=>App.selfInfo.installType==='development'?'temporary':App.selfInfo.installType==='sideload'?'sideload':'';
App.installLogNote=()=>{
 const type=App.installWarnType();
 if(type==='temporary')return 'installationen ar tillfallig (utvecklarlage) och forsvinner nar Thunderbird stangs';
 if(type==='sideload')return 'installationen ar sidoladdad och kan stangas av av Thunderbird';
 return '';
};
App.startDetail=()=>'thunderbird '+(App.tbVersion||'okand')+' sortbro '+String(B.runtime.getManifest()?.version||'okand')+
 ' installation '+(App.selfInfo.installType||'okand');
App.errorLogText=()=>C.errorLogText(App.errorLogs,{version:B.runtime.getManifest().version,tbVersion:App.tbVersion,installType:App.selfInfo.installType});
App.fileWriteChain=Promise.resolve();
App.writeTextLog=()=>{
 const task=App.fileWriteChain.then(()=>App.writeLogFiles());
 App.fileWriteChain=task.catch(()=>{});return task;
};
App.writeLogFiles=async()=>{
 if(!App.engine?.config.fileLog)return;
 const lines=['LÄSFILTER TEKNISK LOGG','Skapad: '+new Date().toISOString(),'Version: '+B.runtime.getManifest().version,'Thunderbird: '+(App.tbVersion||'okand'),'Installation: '+(App.selfInfo.installType||'okand'),'Sekretess: inga ämnesrader, adresser eller mejltexter skrivs.',''];
 for(const x of App.logs)lines.push([x.time,x.level,x.event,'count='+x.data.count,x.data.detail||''].join('\t'));
 const url=URL.createObjectURL(new Blob([lines.join('\r\n')+'\r\n'],{type:'text/plain;charset=utf-8'}));
 try{await B.downloads.download({url,filename:App.paths.logs+'lasfilter-logg.txt',saveAs:false,conflictAction:'overwrite'});}
 catch{App.log('error',0,'teknisk_logg_skrivfel',false);}
 finally{setTimeout(()=>URL.revokeObjectURL(url),60000);}
 /* Ett misslyckat filanrop får inte skapa en oändlig logg-/skrivloop.
    Nästa vanliga händelse försöker igen. Fel finns kvar i internhistoriken. */
 App.errorLogs=C.cleanErrorLogs(App.errorLogs);
 const signature=JSON.stringify([App.errorLogs,B.runtime.getManifest().version,App.tbVersion]);
 if(signature===App.lastErrorFile)return;
 const errorUrl=URL.createObjectURL(new Blob([App.errorLogText()],{type:'text/plain;charset=utf-8'}));
 try{
  await B.downloads.download({url:errorUrl,filename:App.paths.logs+'sortbro-fellogg.txt',saveAs:false,conflictAction:'overwrite'});
  App.lastErrorFile=signature;
 }catch{App.log('error',0,'samlad_fellogg_skrivfel',false);}
 finally{setTimeout(()=>URL.revokeObjectURL(errorUrl),60000);}
};
App.scheduleTextLog=()=>{if(App.fileLogTimer)return;App.fileLogTimer=setTimeout(()=>{App.fileLogTimer=null;App.writeTextLog().catch(()=>{});},1200);};
/* Automatisk säkerhetskopia av reglerna. Den skrivs till Hämtade filer, alltså
   utanför profilen: försvinner tillägget en dag ligger reglerna kvar och kan
   importeras tillbaka. Två filer:
     – sortbro-regler-backup.json, som alltid är den senaste (skrivs om när
       reglerna ändrats, så den du importerar tillbaka är aktuell),
     – en daterad veckokopia, en per vecka, så att en felaktig ändring går att
       backa till. Tolv veckor behålls.
   Knappen "Backa upp reglerna nu" skriver båda direkt, oavsett veckodag. */
/* Backuperna har sin egen undermapp, så de aldrig ligger bland loggfilen eller
   annat i appmappen. Loggfilen ligger kvar direkt i Lasfilter/. */
App.backupFolder=App.paths.backups;
App.autoBackupNames={latest:'sortbro-regler-backup.json',dated:day=>'sortbro-regler-'+day+'.json'};
/* Hur många veckokopior som behålls. Tolv veckor = ett kvartal. */
App.backupKeepWeeks=12;
/* Veckonummer enligt ISO 8601 (måndag som första dag), t.ex. 2026-W42.
   Används som spärr: en ny daterad kopia skrivs bara när veckan byts. */
App.weekKey=date=>{
 const d=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()));
 const dayNum=d.getUTCDay()||7;            /* söndag = 7, måndag = 1 */
 d.setUTCDate(d.getUTCDate()+4-dayNum);    /* flytta till veckans torsdag */
 const yearStart=new Date(Date.UTC(d.getUTCFullYear(),0,1));
 const week=Math.ceil(((d-yearStart)/86400000+1)/7);
 return d.getUTCFullYear()+'-W'+String(week).padStart(2,'0');
};
/* Känns igen på hela sökvägen: bara våra egna dagsfiler i vår egen undermapp. */
App.backupFilePattern=/[\\/]Lasfilter[\\/]Regelbackuper[\\/]sortbro-regler-\d{4}-\d{2}-\d{2}\.json$/;
App.autoBackup=async({force=false}={})=>{
 const e=App.engine;if(!e)return {written:false,reason:'no_engine'};
 if(!force&&e.config.autoBackup===false)return {written:false,reason:'off'};
 const rules=e.config.rules;
 const payload={format:'lasfilter-rules',app:'SortBro',version:1,exported:new Date().toISOString(),rules,folders:[]};
 try{payload.folders=(await App.folderList().catch(()=>[])).map(f=>({id:f.id,accountId:f.accountId,accountName:f.accountName,name:f.name,label:f.label}));}catch{}
 const day=new Date().toISOString().slice(0,10);
 const week=App.weekKey(new Date());
 /* Kopian skrivs en gång per vecka – eller direkt när du trycker på knappen.
    Tidigare skrevs den senaste filen om vid varje regeländring, men en
    säkerhetskopia som skrivs tjugo gånger i timmen är ingen säkerhetskopia:
    den blir ett extra skrivsteg i varje regelsparning utan att skydda mer.
    En gång i veckan är takten, och knappen finns för den som inte vill vänta. */
 const weekly=force||App.lastBackupWeek!==week;
 if(!weekly)return {written:false,reason:'not_due',count:rules.length,week};
 const name=App.autoBackupNames.latest;
 const write=async filename=>{
  const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
  try{await B.downloads.download({url,filename:App.backupFolder+filename,saveAs:false,conflictAction:'overwrite'});}
  finally{setTimeout(()=>URL.revokeObjectURL(url),60000);}
 };
 try{
  await write(name);
  await write(App.autoBackupNames.dated(day));
 }catch{
  /* Misslyckas filen är det ingen katastrof – men det ska synas i loggen. */
  App.log('error',0,'reglerna kunde inte backas upp till Hamtade filer');
  return {written:false,reason:'failed',count:rules.length};
 }
 App.lastBackupWeek=week;
 /* Veckan sparas i lagringen, inte bara i minnet: annars skulle en omstart mitt i
    veckan skriva ännu en "veckokopia" och det skulle bli fler än en per vecka. */
 App.write(()=>B.storage.local.set({backupWeek:week})).catch(()=>{});
 App.log('debug',0,'reglerna backade upp: '+rules.length+' st till Hamtade filer/'+App.backupFolder);
 /* Städa gamla dagsfiler – bara våra egna, bara i vår egen mapp, och tyst om det inte går. */
 try{
  const found=await B.downloads.search({filenameRegex:App.backupFilePattern.source});
  const limit=Date.now()-App.backupKeepWeeks*7*86400000;
  for(const item of Array.isArray(found)?found:[]){
   const when=Date.parse(item?.startTime||'');
   if(Number.isFinite(when)&&when<limit&&Number.isSafeInteger(item?.id))await B.downloads.removeFile(item.id);
  }
 }catch{}
 return {written:true,filename:App.backupFolder+name,dated:weekly?App.backupFolder+App.autoBackupNames.dated(day):'',week,count:rules.length};
};
App.scheduleAutoBackup=()=>{clearTimeout(App.backupTimer);App.backupTimer=setTimeout(()=>App.autoBackup().catch(()=>{}),3000);};
/* Veckokopian får inte hänga på att Thunderbird startas om. Körs programmet i
   veckor utan omstart måste den ändå skrivas när veckan byts, så pulsen frågar
   här. Ett misslyckat försök görs om, men högst en gång i timmen – annars skulle
   en full skiva ge sextio försök i timmen. */
App.lastBackupTry=0;
App.maybeWeeklyBackup=()=>{
 const e=App.engine;
 if(!e||e.config.autoBackup===false)return null;
 if(App.lastBackupWeek===App.weekKey(new Date()))return null;
 const now=Date.now();
 if(App.lastBackupTry&&now-App.lastBackupTry<3600000)return null;
 App.lastBackupTry=now;
 App.scheduleAutoBackup();
 return true;
};
/* ── Cache ───────────────────────────────────────────────────────────────
   Den "smarta mappcachen" i motorn sparar varje mapps meddelandetal, så att ett
   svep kan hoppa över mappar som inte ändrats (under 1 ms i stället för att
   skanna om dem). Den gör svepen snabba, men den kan bli gammal om Thunderbird
   ändrar något vi inte får en händelse om. Därför töms den en gång i dygnet –
   och när du vill, med knappen i Inställningar.

   Det som INTE rensas är medvetet: kön (pending), journalen (records), minnet av
   redan hanterade mejl (done), provkörningens räknare (trialKeys) och
   säkerhetsbromsens historik (brakeHistory). De är inte cache – de är minne som
   skyddar mot att samma mejl hanteras två gånger. */
App.lastCacheDay='';
App.lastCacheClear=0;
App.cacheDayOf=now=>{const d=new Date(Number.isFinite(now)?now:Date.now());return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
App.cacheBusy=()=>{const e=App.engine;return !e||(e.pending?.size||0)>0||(e.inflight?.size||0)>0||(e.sweeping||0)>0;};
App.clearCaches=({manual=false}={})=>{
 const e=App.engine;
 if(!e)return {ok:false,reason:'starting'};
 /* Rensas mappbilden mitt i en flytt kan nästa svep hoppa över en mapp som
    faktiskt ändrats. Vänta tills kön är tom i stället – det tar några sekunder. */
 if(App.cacheBusy())return {ok:false,reason:'busy'};
 const folders=e.folderCache?.size||0;
 e.invalidateFolders?.();
 e.yearFolderIds?.clear();
 App.invalidateScan();
 const day=App.cacheDayOf();
 App.lastCacheClear=Date.now();App.lastCacheDay=day;
 /* Dagen sparas i lagringen, inte bara i minnet: annars skulle en omstart samma
    dygn rensa igen, och en lång session utan omstart aldrig komma ikapp. */
 App.write(()=>B.storage.local.set({cacheDay:day})).catch(()=>{});
 App.log('debug',0,(manual?'cachen rensades for hand':'cachen rensades automatiskt')+': '+folders+' mappar, mapplistan och sokningen');
 App.changed();
 return {ok:true,folders,day,at:App.lastCacheClear};
};
/* En gång per dygn, om användaren inte stängt av det. Anropas från pulsen. */
App.maybeClearCache=()=>{
 if(App.engine?.config?.autoClear===false)return null;
 if(App.lastCacheDay===App.cacheDayOf())return null;
 return App.clearCaches();
};

App.log=(name,count=0,detail='',scheduleFile=true)=>{
 const entry=C.event(name,count,Date.now(),detail);if(!entry)return;
 /* Samma klocka som stämplade raden avgör om den får ligga kvar – annars kan en
    rad som just skrivits gallras bort av en klocka som gått olika. */
 App.logs=C.cleanLogs([...App.logs,entry],Date.now());
 if(C.cleanErrorLogs([entry]).length)App.errorLogs=C.cleanErrorLogs([...App.errorLogs,entry]);
 clearTimeout(App.logTimer);App.logTimer=setTimeout(()=>App.write(()=>B.storage.local.set({logs:App.logs,errorLogs:App.errorLogs})).catch(()=>{}),500);
 if(scheduleFile)App.scheduleTextLog();
};
/* Fånga oväntade skriptfel utan exception-text, sökvägar eller mejldata. */
globalThis.addEventListener?.('error',()=>App.log('error',0,'bakgrund: javascript_error'));
globalThis.addEventListener?.('unhandledrejection',()=>App.log('error',0,'bakgrund: unhandled_rejection'));
// Behåll alltid det första, mest specifika felet. Händelselyssnare ska inte
// skriva över exempelvis storage_error med det mindre hjälpsamma internal_error.
App.fail=code=>{if(App.engine&&!App.engine.fault)App.engine.stop(code);};
App.kick=()=>{if(App.kickTimer)return;App.kickTimer=setTimeout(()=>{App.kickTimer=null;App.engine?.tick().catch(()=>App.fail('internal_error'));},0);};
App.emptySweep={scanned:0,queued:0,deferred:0,searchedFolders:0,skippedFolders:0,emptyFolders:0,cachedFolders:0};
/* Senaste svepet sparas i lagringen, inte bara i minnet: efter en omstart ska SortBro veta
   om datorn varit avstängd länge och i så fall ta igen det direkt i stället för att vänta
   en hel timme. Tiden skrivs som ett litet tal, inget annat följer med. */
/* Säkerhetsbromsens minne: hur många mejl en regel brukar flytta per svep.
   Bara de tio senaste talen per regel sparas, inget annat. */
App.brakeHistory={};
App.brakeMedian=ruleId=>{
 const list=App.brakeHistory[ruleId]||[];
 if(!list.length)return 0;
 const sorted=[...list].sort((a,b)=>a-b);
 return sorted[Math.floor(sorted.length/2)];
};
/* Gränsen: tio gånger det vanliga, men aldrig under 50 mejl i ett svep. */
App.brakeLimit=rule=>{
 if(App.engine?.config.brake===false)return null;
 const median=App.brakeMedian(rule.id);
 return {limit:median>0?Math.max(50,Math.ceil(median*10)):50,median};
};
App.saveBrakeHistory=()=>{
 clearTimeout(App.brakeTimer);
 App.brakeTimer=setTimeout(()=>{
  const ids=new Set((App.engine?.config.rules||[]).map(r=>r.id));
  const clean={};
  for(const [id,list] of Object.entries(App.brakeHistory))if(ids.has(id)&&Array.isArray(list)&&list.length)clean[id]=list.slice(-10);
  App.write(()=>B.storage.local.set({brake:clean})).catch(()=>{});
 },1200);
};
/* Ett avslutat svep utan broms blir regelns nya normalnivå. */
App.brakeRecord=(rule,result)=>{
 /* Provkörning: resultatet är en räkning, inte en flytt. Den sparas som sådan och
    får aldrig bli regelns normalnivå för säkerhetsbromsen. */
 if(result?.trial){
  App.write(()=>B.storage.local.set({trial:App.engine.trialList()})).catch(()=>{});
  return;
 }
 if(App.engine?.config.brake===false||result?.held)return;
 const n=Number(result?.wouldQueue);
 if(!Number.isFinite(n)||n<=0)return;
 App.brakeHistory[rule.id]=[...(App.brakeHistory[rule.id]||[]),n].slice(-10);
 App.saveBrakeHistory();
};
/* ── "Lär av din flytt" ────────────────────────────────────────────────────
   När du själv drar mejl till en mapp sparas bara domän, källmapp, målmapp och
   antal. Efter tre likadana flyttar inom en vecka föreslår SortBro en regel.
   Ingenting skapas utan att du trycker, och inget sparas om en enskild mejl. */
App.learnKey=e=>e.domain+'|'+e.target;
App.cleanLearned=raw=>{
 const out={off:false,entries:[],snooze:{}};
 if(!raw||typeof raw!=='object')return out;
 out.off=raw.off===true;
 const now=Date.now(),maxAge=C.LIMITS.learnDays*86400000;
 for(const e of Array.isArray(raw.entries)?raw.entries:[]){
  if(!e||typeof e!=='object')continue;
  const domain=typeof e.domain==='string'?e.domain.trim().toLowerCase():'';
  if(!domain||domain.length>253||!/^[a-z0-9.-]+$/.test(domain))continue;
  if(typeof e.source!=='string'||typeof e.target!=='string'||!e.source||!e.target)continue;
  const count=Number.isInteger(e.count)&&e.count>0?e.count:0;
  const last=Number.isFinite(e.last)?e.last:0;
  if(!count||!last||now-last>maxAge)continue;
  out.entries.push({domain,source:e.source,target:e.target,count,first:Number.isFinite(e.first)?e.first:last,last});
 }
 out.entries.sort((a,b)=>b.last-a.last).splice(C.LIMITS.learnEntries);
 if(raw.snooze&&typeof raw.snooze==='object'){
  for(const [key,v] of Object.entries(raw.snooze)){
   if(typeof key!=='string'||key.length>600)continue;
   const at=Number(v?.at),count=Number(v?.count);
   if(!Number.isFinite(at)||now-at>maxAge)continue;
   out.snooze[key]={at,count:Number.isFinite(count)?count:0};
  }
 }
 return out;
};
App.saveLearned=()=>App.write(()=>B.storage.local.set({learned:App.learned})).catch(()=>{});
App.learnSuggestions=()=>{
 if(App.learned.off)return [];
 const now=Date.now(),maxAge=C.LIMITS.learnDays*86400000;
 return App.learned.entries
  .filter(e=>e.count>=C.LIMITS.learnCount&&now-e.last<=maxAge)
  .filter(e=>{
   const s=App.learned.snooze[App.learnKey(e)];
   if(!s)return true;
   return now-s.at>=maxAge&&e.count>=s.count+C.LIMITS.learnCount;
  })
  .slice(0,3)
  .map(e=>({...e,key:App.learnKey(e)}));
};
App.learnMove=async(original,moved,{ours=false}={})=>{
 if(App.learned.off)return false;
 const before=Array.isArray(original?.messages)?original.messages:[];
 const after=Array.isArray(moved?.messages)?moved.messages:[];
 if(!before.length||!after.length)return false;
 /* SortBros egna flyttar räknas aldrig. Flaggan fångas före motorns bekräftelse,
    för då är jobbet redan borta ur kön. */
 if(ours)return false;
 if(before.some(m=>App.engine?.inflight?.has(m.id)||App.engine?.pending?.has(m.id)))return false;
 const targets=new Set(after.map(m=>m?.folder?.id).filter(Boolean));
 if(targets.size!==1)return false;
 const target=[...targets][0];
 const folder=after[0]?.folder||{};
 const uses=[...(folder.specialUse||[]),folder.type].map(x=>C.norm(String(x||'')));
 if(uses.includes('trash')||uses.includes('junk')||uses.includes('deleted'))return false;
 const source=before[0]?.folder?.id||'';
 if(!source||source===target)return false;
 const counts=new Map();
 for(const m of before.slice(0,50)){
  const domain=(C.email(m?.author)||'').split('@')[1]||'';
  if(domain)counts.set(domain,(counts.get(domain)||0)+1);
 }
 if(!counts.size)return false;
 const now=Date.now();
 for(const [domain,add] of counts){
  const hit=App.learned.entries.find(e=>e.domain===domain&&e.target===target&&e.source===source);
  if(hit){hit.count+=add;hit.last=now;}
  else App.learned.entries.unshift({domain,source,target,count:add,first:now,last:now});
 }
 App.learned=App.cleanLearned(App.learned);
 await App.saveLearned();
 App.log('debug',0,'lar av din flytt: '+counts.size+' doman(er) till en mapp');
 App.changed();
 return true;
};
App.learnCreate=async key=>{
 const entry=App.learned.entries.find(e=>App.learnKey(e)===key);
 if(!entry)throw new C.RuleError('bad_id');
 const e=App.engine;
 const duplicate=e.config.rules.find(r=>r.target===entry.target&&(r.conditions||[]).some(c=>c.field==='domain'&&c.op==='equals'&&C.norm(c.value)===C.norm(entry.domain)));
 if(duplicate){
  App.learned.entries=App.learned.entries.filter(x=>App.learnKey(x)!==key);
  await App.saveLearned();App.changed();
  return {ruleId:duplicate.id,existing:true,snapshot:App.snapshot()};
 }
 let sourceAccount='';
 try{const src=await B.folders.get(entry.source,false);sourceAccount=src?.accountId||'';}catch{}
 if(!sourceAccount)throw new C.RuleError('choose_source');
 const rule=C.validateRule({
  id:'r'+Date.now().toString(36)+Math.random().toString(36).slice(2,7),
  name:entry.domain,enabled:true,scope:'account',source:entry.source,sourceAccount,target:entry.target,
  match:'all',readFilter:'default',unreadAction:'default',yearFolders:false,
  conditions:[{field:'domain',op:'equals',value:entry.domain}],branches:[]
 });
 await App.checkRules([rule]);
 const rules=[...e.config.rules,rule];
 await App.save({...e.config,rules,revision:e.config.revision+1,rulesVersion:e.config.rulesVersion+1},{backup:true,discard:true});
 App.learned.entries=App.learned.entries.filter(x=>App.learnKey(x)!==key);
 await App.saveLearned();
 App.log('rules_saved',rules.length);
 App.log('debug',0,'regel skapad av din flytt: '+entry.domain);
 return {ruleId:rule.id,rule,snapshot:App.snapshot()};
};
App.saveSweepState=async at=>{
 try{await B.storage.local.set({sweepAt:Number.isFinite(at)?at:Date.now()});}catch{}
};
App.loadSweepState=async()=>{
 try{const data=await B.storage.local.get(['sweepAt']);const at=Number(data?.sweepAt);if(Number.isFinite(at)&&at>0)return at;}catch{}
 return 0;
};
/* Är det dags att ta igen ett svep? Sant när senaste svepet ligger längre tillbaka än intervallet. */
App.sweepOverdue=(now=Date.now())=>{
 const e=App.engine;if(!e?.config.hourly)return false;
 const last=App.lastAutoSweep||e.lastSweep||0;
 return !last||now-last>=e.config.sweepMinutes*60000;
};
/* Ett svep vid start när bevakningen är på och det finns regler. Det körs alltid en gång –
   även om det bara gick en minut sedan – eftersom det är då kön från förra gången tas om hand. */
App.startSweep=async()=>{
 const e=App.engine;
 if(!e||!e.enabled()||!e.config.rules.some(r=>r.enabled))return null;
 App.startSweepDone=true;
 return App.autoSweep({starting:true});
};
App.runAllRules=async(force=false)=>{
 const e=App.engine;if(!e)throw new C.RuleError('internal_error');
 /* Pausad eller stoppad motor är ett normalt läge – inget fel och inga nollor utan förklaring. */
 if(!e.enabled())return {...App.emptySweep,skipped:e.fault?'stopped':'paused',fault:e.fault||''};
 /* Pågår redan ett svep (t.ex. startsvepet) väntar vi in det i stället för att rapportera noll. */
 let waited=false;
 if(e.sweeping>0){
  waited=true;
  const start=Date.now();
  while(e.sweeping>0&&e.enabled()&&Date.now()-start<20000)await new Promise(r=>setTimeout(r,200));
  if(e.sweeping>0)return {...App.emptySweep,busy:true};
 }
 for(const j of e.pending.values())if(j.hiddenSince===null)j.hiddenSince=Date.now()-2500;
 if(e.pending.size)App.kick();
 /* En manuell körning läser om allt (force); det tidsstyrda svepet använder cachen. */
 const result=await e.sweepAll({force:force===true});
 for(const j of e.pending.values())if(j.hiddenSince===null)j.hiddenSince=Date.now()-2500;
 App.kick();
 await Promise.race([e.tick().catch(()=>{}),new Promise(res=>setTimeout(res,350))]);
 App.lastAutoSweep=Date.now();
 App.changed();
 return {...result,waited};
};
/* Automatiskt svep (intervall och start):
   – tyst när bevakningen är pausad eller stoppad,
   – ett tyst andra försök när kontona inte svarar ännu (vanligt precis vid start),
   – och först därefter en läsbar felrad i loggen. */
App.autoSweep=async({starting=false}={})=>{
 const attempt=async()=>{
  try{return {result:await App.runAllRules()};}
  catch(error){return {code:error instanceof C.RuleError?error.code:(error?.name||'Error')};}
 };
 /* Vid start får kontona ofta inte tid att svara ännu: försök igen efter 10 sekunder och
   en sista gång efter en minut. Under drift räcker ett enda nytt försök efter 15 sekunder. */
 const delays=starting?[10000,60000]:[15000];
 let {result,code}=await attempt();
 for(const delay of delays){
  if(!code||['paused','disabled','internal_error'].includes(code))break;
  await new Promise(res=>setTimeout(res,delay));
  if(!App.engine?.enabled())break;
  ({result,code}=await attempt());
 }
 if(result){
  if(result.skipped==='stopped'&&App.reportedStop!==App.engine?.fault){
   App.reportedStop=App.engine?.fault;
   App.log('debug',0,'automatiskt svep hoppades över: motorn är stoppad ('+(App.engine?.fault||'-')+') – rensa spärren under Avancerat');
  }
  App.saveSweepState();
  return result;
 }
 if(code&&!['paused','disabled','internal_error'].includes(code))App.log('error',0,'Automatiskt svep misslyckades ('+code+') – kontrollera att regelns käll- och målmappar finns kvar och går att skriva i');
 return {...App.emptySweep,skipped:code&&!['paused','disabled','internal_error'].includes(code)?'error':'paused',code:code||''};
};
App.scheduleSweep=()=>{
 clearInterval(App.sweepTimer);
 const e=App.engine;
 if(!e?.config.hourly)return;
 App.sweepTimer=setInterval(()=>{App.autoSweep();},e.config.sweepMinutes*60000);
};
App.changed=()=>{
 clearTimeout(App.changeTimer);App.changeTimer=setTimeout(()=>{
  const e=App.engine;if(!e)return;
  const badge=e.fault?'!':e.config.paused?'Ⅱ':e.config.dryRun?'T':'';
  App.applySeasonIcon();
  B.browserAction.setBadgeText({text:badge}).catch(()=>{});
  B.browserAction.setBadgeBackgroundColor({color:e.fault?'#ac3434':e.config.dryRun?'#c28a24':'#2c776c'}).catch(()=>{});
  B.runtime.sendMessage({event:'statusChanged'}).catch(()=>{});
 },100);
};
App.folderList=async()=>{
 const accounts=await B.accounts.list(true),items=[],seen=new Set();
 function walk(f,account){
  if(f.id&&!seen.has(f.id)){seen.add(f.id);if(C.usableFolder(f))items.push({id:f.id,accountId:account.id,accountName:account.name,name:f.name,path:f.path||'',type:f.type||'',label:account.name+' · '+(f.path||f.name),specialUse:f.specialUse||[]});}
  for(const child of f.subFolders||[])walk(child,account);
 }
 for(const a of accounts){if(a.rootFolder)walk(a.rootFolder,a);else for(const f of a.folders||[])walk(f,a);}
 return items;
};
App.captureTab=async tab=>{if(tab?.type==='mail')App.mailTab=tab.id;};
/* ＋ Ny mapp: skapar målmappen direkt i Thunderbird, utan att lämna SortBro. */
App.createFolder=async(parentId,name)=>{
 const clean=typeof name==='string'?name.trim().replace(/[\u0000-\u001f]/g,''):'';
 if(!clean||clean.length>64||/[\\/]/.test(clean))throw new C.RuleError('bad_folder_name');
 if(typeof B.folders?.create!=='function')throw new C.RuleError('bad_request');
 let parent=typeof parentId==='string'?parentId.trim():'';
 if(!parent){
  const accounts=await B.accounts.list(true);
  parent=accounts.find(a=>a.rootFolder)?.rootFolder?.id||'';
  if(!parent)throw new C.RuleError('unsafe_folder');
 }
 let siblings=[];
 try{siblings=await App.folderList();}catch{}
 if(siblings.some(f=>f.name&&f.name.toLowerCase()===clean.toLowerCase()&&f.id!==parent))throw new C.RuleError('folder_exists');
 let folder;
 try{folder=await B.folders.create(parent,clean);}
 catch{throw new C.RuleError('folder_create_failed');}
 App.engine?.invalidateFolders();
 App.log('settings_saved');
 return {id:folder?.id||'',name:folder?.name||clean,accountId:folder?.accountId||'',label:folder?.name||clean};
};
/* Läser Inkorgen en gång och delar resultatet med alla snabbflöden (förslag, räkning, regler).
   Resultatet ligger kvar i två minuter, så att räkningen inte läser om hela Inkorgen för varje bokstav.
   `force` läser om allt (↻-knappen), och allt som flyttar ett mejl kastar cachen. */
App.scanTtl=120000;
App.scanCache={at:0,data:null,limit:0};
App.invalidateScan=()=>{App.scanCache={at:0,data:null,limit:0};return true;};
App.scanInbox=async({limit=400,force=false}={})=>{
 const cached=App.scanCache;
 if(!force&&cached.data&&cached.data.limit>=limit&&Date.now()-cached.at<App.scanTtl)return cached.data;
 const accounts=await B.accounts.list(true),inboxes=[];
 for(const account of accounts){
  const folders=(account.rootFolder?.subFolders||[]).concat(account.folders||[]);
  const inbox=folders.find(f=>[...(f.specialUse||[]),f.type].includes('inbox'));
  if(inbox&&C.usableFolder(inbox))inboxes.push({inbox,accountId:account.id||inbox.accountId||''});
 }
 const collected=[];let inboxId='',sourceAccount='';
 for(const {inbox,accountId} of inboxes.slice(0,5)){
  let page=null;
  try{
   page=await B.messages.query({folderId:inbox.id});
   for(;;){
    collected.push(...(page?.messages||[]));
    if(!page?.id||collected.length>=limit)break;
    page=await B.messages.continueList(page.id);
   }
  }catch{App.log('error',0,'forslag_inkorg_misslyckades');}
  finally{if(page?.id)await B.messages.abortList(page.id).catch(()=>{});}
  if(!inboxId){inboxId=inbox.id;sourceAccount=accountId;}
  if(collected.length>=limit)break;
 }
 const result={messages:collected,inboxId,sourceAccount,scanned:collected.length,capped:collected.length>=limit,limit};
 App.scanCache={at:Date.now(),data:result,limit};
 return result;
};
App.inboxHints=async(msg={})=>{
 const scan=await App.scanInbox({force:msg?.force===true});
 /* Fler förslag än vi visar direkt – gränssnittet visar åtta och en "visa fler"-knapp. */
 const hints=C.inboxHints(scan.messages,{rules:App.engine?.config.rules||[],limit:24,wordLimit:18,minCount:2,wordMinCount:3});
 return {...hints,inboxId:scan.inboxId,sourceAccount:scan.sourceAccount,scanned:scan.scanned,capped:scan.capped===true};
};
/* "Så många mejl flyttar regeln just nu" – räknas mot Inkorgen utan att spara något.
   Bara mejl som regeln verkligen skulle flytta räknas: rätt konto, och olästa bara om de får följa med.
   Är Inkorgen större än det vi läser säger svaret det, i stället för att låtsas att siffran är hela sanningen. */
App.quickPreview=async(msg={})=>{
 const scan=await App.scanInbox();
 const rule=C.choiceRule({field:msg.field,value:msg.value});
 const hits=C.countHits(scan.messages,rule,{accountId:msg.accountId||''});
 const allowUnread=msg.allowUnread!==false;
 return {matches:allowUnread?hits.matched:hits.read,matched:hits.matched,read:hits.read,unread:hits.unread,allowUnread,
  scanned:scan.scanned,capped:scan.capped===true,condition:rule.conditions[0],inboxId:scan.inboxId,sourceAccount:scan.sourceAccount};
};
/* Skriver ut reglerna som en Thunderbird-filterfil (msgFilterRules.dat).
   Kontots URI-prefix kommer från prefs (inlärt vid import) eller skickas med från gränssnittet.
   Lokala mappar får alltid mailbox://-formen, precis som Thunderbird själv skriver den. */
/* En kontoadress måste se ut som en Thunderbird-adress, annars skrivs ingen fil. */
App.cleanUriPrefix=value=>{
 const text=typeof value==='string'?value.trim().slice(0,240):'';
 return /^(imap|mailbox|pop3|imap-message|news):\/\//i.test(text)?text:'';
};
App.filterExport=async(msg)=>{
 const list=await App.folderList();
 const byId=new Map(list.map(f=>[f.id,f]));
 const prefixArg=App.cleanUriPrefix(msg.uriPrefix);
 const stored=App.cleanUriPrefix((App.prefs.filterUris||{})[msg.accountId||'']);
 /* En adress användaren klistrar in sparas, så den bara behöver klistras in en gång. */
 if(prefixArg&&prefixArg!==stored&&msg.accountId){
  const map={...(App.prefs.filterUris||{}),[msg.accountId]:prefixArg};
  App.prefs={...App.prefs,filterUris:map};
  await App.write(()=>B.storage.local.set({prefs:App.prefs}));
 }
 const local=accountName=>/^(local folders|lokala mappar)$/i.test(accountName||'');
 const uriOf={};
 const needsUri=[];
 for(const rule of App.engine.config.rules){
  const folder=byId.get(rule.target);
  if(!folder)continue;
  const accountId=msg.accountId||folder.accountId;
  const prefix=local(folder.accountName)?'mailbox://nobody@Local%20Folders/':(prefixArg||stored||'');
  if(!prefix){needsUri.push({ruleId:rule.id,name:rule.name});continue;}
  uriOf[rule.id]={uriPrefix:prefix,folderPath:folder.path||folder.name||''};
 }
 const built=LasFilters.buildFilterFile(App.engine.config.rules,{uriOf});
 return {...built.report,text:built.text,needsUri,accountId:msg.accountId||'',storedPrefix:stored||(prefixArg||'')};
};
/* Klistra in domäner/adresser i en regel som redan finns. Villkoren läggs till –
   de gamla rörs inte – och kombinationen blir "minst ett av villkoren" när regeln
   får fler än ett villkor, eftersom flera avsändare betyder ELLER. */
App.importConditions=async(msg)=>{
 const e=App.engine;
 const rule=e.config.rules.find(r=>r.id===msg.ruleId);
 if(!rule)throw new C.RuleError('bad_id');
 const parsed=C.parseImportList(msg.text,{limit:C.LIMITS.conditions,field:msg.field||'auto'});
 if(!parsed.conditions.length)throw new C.RuleError('bad_value');
 const merged=C.mergeConditions(rule.conditions,parsed.conditions,{limit:C.LIMITS.conditions});
 if(!merged.added.length)throw new C.RuleError('duplicate_id');
 const next=C.validateRule({...rule,conditions:merged.conditions,match:merged.conditions.length>1?'any':rule.match});
 await App.checkRules([next]);
 const rules=e.config.rules.map(r=>r.id===next.id?next:r);
 await App.save({...e.config,rules,revision:e.config.revision+1,rulesVersion:e.config.rulesVersion+1},{backup:true,discard:true});
 App.log('rules_saved',rules.length);
 App.log('debug',0,'importerade villkor: '+merged.added.length+' tillagda, '+merged.skipped+' hoppade (dubbletter eller full regel), kombination='+(next.match==='any'?'minst ett':'alla'));
 return {ruleId:next.id,added:merged.added.length,skipped:merged.skipped,duplicates:merged.duplicates,overflow:merged.overflow,
  match:next.match,conditions:next.conditions,rule:next,target:next.target,snapshot:App.snapshot()};
};
/* Skapar en färdig regel av ett enda val: avsändare/domän/ord + målmapp. */
App.quickRule=async(msg)=>{
 const e=App.engine;
 const list=await App.folderList();
 const target=list.find(f=>f.id===msg.target);
 if(!target)throw new C.RuleError('choose_target');
 let sourceAccount=msg.sourceAccount||target.accountId||'';
 let source=msg.source||'';
 if(!source){
  const inbox=list.find(f=>f.accountId===sourceAccount&&(C.usableFolder(f))&&([...(f.specialUse||[]),f.type].includes('inbox')||/^(inkorg|inbox)$/i.test(f.name||'')));
  source=inbox?.id||'';
 }
 if(!source){const anyInbox=list.find(f=>[...(f.specialUse||[]),f.type].includes('inbox'));if(anyInbox){source=anyInbox.id;sourceAccount=anyInbox.accountId||sourceAccount;}}
 if(!source||source===msg.target)throw new C.RuleError('choose_source');
 const rule=C.ruleFromChoice({name:msg.name,field:msg.field,value:msg.value,target:msg.target,source,sourceAccount,
  moveUnread:msg.moveUnread!==false,openWindow:msg.openWindow===true});
 await App.checkRules([rule]);
 const rules=[...e.config.rules,rule];
 await App.save({...e.config,rules,revision:e.config.revision+1,rulesVersion:e.config.rulesVersion+1},{backup:true,discard:true});
 App.log('rules_saved',rules.length);
 App.log('debug',0,'snabbregel skapad: '+C.choiceSummary(rule.conditions[0])+' -> '+(target.name||target.label||'målmapp'));
 return {ruleId:rule.id,rule,condition:rule.conditions[0],target:{id:target.id,name:target.name||'',label:target.label||''},snapshot:App.snapshot()};
};
App.openUnread=async(id,ruleId,targetFolderId='',headerMessageId='')=>{
 const rule=App.engine?.config.rules.find(r=>r.id===ruleId);
 const action=rule?.unreadAction||'default';
 /* Mejlet ska ligga i målmappen innan fönstret öppnas. Öppnade vi id:t direkt efter
    flytten visade Thunderbird en tom ruta, eftersom mejlet redan lämnat källmappen.
    Därför två krav innan något öppnas: rätt mapp – och att kroppen går att läsa. */
 const lookup=async()=>{
  if(targetFolderId&&headerMessageId){
   const found=await App.engine?.findByHeader(targetFolderId,headerMessageId);
   if(Number.isSafeInteger(found?.id))return found.id;
  }
  if(Number.isSafeInteger(id)&&targetFolderId){
   try{
    const cur=await B.messages.get(id);
    if(cur?.folder?.id===targetFolderId)return id;
   }catch{}
  }
  return null;
 };
 /* Går mejlet att läsa alls? Ett oläst IMAP-mejl som ännu inte hämtats hem ger ett
    tomt fönster i stället för ett fel – då öppnar vi hellre ingenting. */
 const readable=async mid=>{
  if(!Number.isSafeInteger(mid))return false;
  if(typeof B.messages?.getFull!=='function')return true;
  try{
   const full=await B.messages.getFull(mid);
   return !!full&&(Array.isArray(full.parts)?full.parts.length>0:true);
  }catch{return false;}
 };
 let targetId=null,ready=false;
 for(const delay of [0,300,700,1500,3000]){
  if(delay)await new Promise(r=>setTimeout(r,delay));
  targetId=await lookup();
  if(Number.isSafeInteger(targetId)&&await readable(targetId)){ready=true;break;}
 }
 if(!ready){
  App.log('debug',0,Number.isSafeInteger(targetId)?'olasta mejlet gick inte att lasa an - fonstret oppnades inte':'olasta mejlet kunde inte hittas i malmappen - fonstret oppnades inte');
  return null;
 }
 if(action==='read'){
  for(const delay of [150,800])setTimeout(()=>B.messages.update(targetId,{read:true}).catch(()=>{}),delay);
  return targetId;
 }
 // Popup-skydd: under ett pågående mass-svep (eller när kön redan är lång)
 // öppnas aldrig nya fönster – mejlet behålls bara oläst.
 const sweeping=App.engine?.sweeping||0;
 const shouldOpenWindow=C.shouldOpenWindow({action,pending:App.engine?.pending.size||0,sweeping,fromSweep:sweeping>0,openWindow:App.engine?.config.openWindow!==false});
 App.keepUnread.set(targetId,Date.now()+30000);
 if(shouldOpenWindow){
  /* Kvittot: loggen ska kunna svara på om fönstret verkligen visade något.
     Tidsgränsen larmar men släcker inte förväntan – kommer visningen strax efteråt
     skrivs kvittot ändå, i stället för att tappas på en sekund. */
  const expectation={messageId:targetId,headerMessageId:headerMessageId||'',at:Date.now()};
  App.expectDisplay=expectation;
  setTimeout(()=>{if(App.expectDisplay===expectation)App.log('debug',0,'olasta mejlet visades inte i fonstret');},5200);
  try{
   await B.messageDisplay.open({messageId:targetId,location:'window'});
   App.log('debug',0,'olasta mejlet oppnat i malmappen');
  }catch{
   /* Id:t kan ha bytts i samma stund – identiteten (Message-ID) följer alltid med. */
   if(headerMessageId){
    try{await B.messageDisplay.open({headerMessageId,location:'window'});App.log('debug',0,'olasta mejlet oppnat via meddelande-id');}
    catch{App.expectDisplay=null;App.log('error',0,'oppna_olast_fonster_misslyckades');}
   }else{App.expectDisplay=null;App.log('error',0,'oppna_olast_fonster_misslyckades');}
  }
 }else App.log('debug',0,'olasta mejlet behalls som olast: popup-skydd');
 for(const delay of [250,1000,3000])setTimeout(()=>B.messages.update(targetId,{read:false}).catch(()=>App.log('error',0,'aterstall_olast_misslyckades')),delay);
 setTimeout(()=>App.keepUnread.delete(targetId),30000);
 return targetId;
};
App.onNewMail=async(folder,list)=>{
 await App.ready;if(![...(folder?.specialUse||[]),folder?.type].includes('inbox'))return;
 let page=list,all=[];
 for(;;){all.push(...(page?.messages||[]));if(!page?.id)break;page=await B.messages.continueList(page.id);}
 await App.engine.newInboxMessages(all);setTimeout(()=>App.kick(),800);
};
App.selected=async()=>{
 let id=App.mailTab;
 if(id!==null){try{const t=await B.tabs.get(id);if(t.type!=='mail')id=null;}catch{id=null;}}
 if(id===null){const tabs=await B.tabs.query({});const t=tabs.find(t=>t.type==='mail'&&t.active)||tabs.find(t=>t.type==='mail');id=t?.id;}
 if(id===undefined||id===null)throw new C.RuleError('no_selection');
 const list=await B.mailTabs.getSelectedMessages(id);
 if(list.id){await B.messages.abortList(list.id);throw new C.RuleError('one_message');}
 if(list.messages.length!==1)throw new C.RuleError('one_message');
 App.mailTab=id;return B.messages.get(list.messages[0].id);
};
App.snapshot=()=>{
 const e=App.engine;
 return {config:e.config,prefs:App.prefs,stats:e.stats,queued:e.pending.size,blocked:e.blocked(),inflight:e.inflight.size,
   fault:e.fault,lastCheck:e.lastCheck,moveMode:e.config.moveMode,hourly:e.config.hourly,sweepMinutes:e.config.sweepMinutes,newInboxDirect:e.config.newInboxDirect,openWindow:e.config.openWindow,
   lastSweep:e.lastSweep||null,lastAutoSweep:App.lastAutoSweep,nextAutoSweep:e.config.hourly?((App.lastAutoSweep||e.lastSweep||Date.now())+e.config.sweepMinutes*60000):null,
   enabledRules:e.config.rules.filter(r=>r.enabled).length,installType:App.selfInfo.installType,paths:App.paths,brake:e.config.brake!==false,
   brakeHolds:(e.heldList?.()||[]).map(h=>{const rule=e.config.rules.find(r=>r.id===h.ruleId);return {...h,name:rule?.name||h.ruleId,target:rule?.target||''};}),
   backups:App.backups.map((x,i)=>({index:i,time:x.time,count:x.config.rules.length})),
   /* Provkörning och inlärda förslag följer med i statusen så att gränssnittet
      kan visa dem utan ett extra anrop. */
   trials:(e.config.rules||[]).filter(r=>r.trialUntil>0).map(r=>({ruleId:r.id,name:r.name,left:C.trialDaysLeft(r),until:r.trialUntil,active:C.trialActive(r),count:e.trialCount?.(r.id)||0,target:r.target})),
   learn:{off:App.learned.off,suggestions:App.learnSuggestions()},
   lastBackupWeek:App.lastBackupWeek||'',logs:App.logs,
   /* Cachen: om den rensas automatiskt, när den senast rensades och vilken dag
      som räknas som gjord. Gränssnittet visar det under Inställningar. */
   cache:{on:e.config.autoClear!==false,at:App.lastCacheClear||0,day:App.lastCacheDay||''}};
};
App.mutate=fn=>{
 const p=App.editChain.then(async()=>{
  const e=App.engine;e.hold=true;e.epoch++;App.changed();
  try{return await fn();}finally{e.hold=false;App.changed();}
 });App.editChain=p.catch(()=>{});return p;
};
App.save=async(next,{backup=false,discard=false}={})=>{
 const e=App.engine;next=C.config(next);
 if(discard)await e.clearPending();
 const backups=backup?[{time:new Date().toISOString(),config:structuredClone(e.config)},...App.backups].slice(0,5):App.backups;
 await App.write(()=>B.storage.local.set({config:next,backups,work:e.recordList()}));
 e.config=next;e.epoch++;e.invalidateFolders();for(const j of e.pending.values())j.hiddenSince=null;
 App.backups=backups;App.changed();
};
App.checkRevision=rev=>{if(rev!==App.engine.config.revision)throw new C.RuleError('stale_config');};
App.checkRules=async rules=>{for(const r of rules){await App.engine.validateRuleFolders(r);for(const b of r.branches||[])await App.engine.validateRuleFolders({...r,target:b.target});}};
App.extractImportedRules=(backup,currentFolders=[],existingRules=[])=>{
 let rawRules=null;
 if(Array.isArray(backup))rawRules=backup;
 else if(backup&&typeof backup==='object'){
  if(backup.format!==undefined&&!['lasfilter-rules','sortbro-rules'].includes(backup.format))throw new C.RuleError('bad_schema');
  if(backup.version!==undefined&&backup.version!==1)throw new C.RuleError('bad_schema');
  if(Array.isArray(backup.rules))rawRules=backup.rules;
  else if(Array.isArray(backup.config?.rules))rawRules=backup.config.rules;
  else if(Array.isArray(backup.conditions))rawRules=[backup];
 }
 if(!Array.isArray(rawRules))throw new C.RuleError('bad_schema');
 const folderById=new Map(currentFolders.map(f=>[f.id,f]));
 const hintById=new Map((Array.isArray(backup?.folders)?backup.folders:[]).filter(f=>f&&f.id).map(f=>[f.id,f]));
 const resolveFolderId=id=>{
  if(typeof id!=='string'||!id.trim())return id;
  if(!currentFolders.length||folderById.has(id))return id;
  const hint=hintById.get(id);
  if(hint){
   const byLabel=currentFolders.find(f=>f.label===hint.label)||currentFolders.find(f=>f.name===hint.name&&f.accountName===hint.accountName)||currentFolders.find(f=>f.name===hint.name);
   if(byLabel)return byLabel.id;
  }
  const tail=decodeURIComponent(id.split('/').pop()||'').trim().toLowerCase();
  if(tail){
   const byTail=currentFolders.find(f=>(f.name||'').toLowerCase()===tail||(f.label||'').toLowerCase()===id.toLowerCase());
   if(byTail)return byTail.id;
  }
  return id;
 };
 const usedIds=new Set(existingRules.map(r=>r.id));
 return rawRules.map((raw,idx)=>{
  if(!raw||typeof raw!=='object')throw new C.RuleError('bad_rule');
  let id=typeof raw.id==='string'&&/^[a-zA-Z0-9_-]+$/.test(raw.id.trim())?raw.id.trim().slice(0,80):'rule-'+Date.now()+'-'+(idx+1);
  while(usedIds.has(id))id=(id.slice(0,70)+'-'+(idx+1)+'-'+Math.random().toString(36).slice(2,6));
  usedIds.add(id);
  const scope=raw.scope==='account'?'account':'folder';
  let source=resolveFolderId(raw.source||'');
  let target=resolveFolderId(raw.target||'');
  let sourceAccount=typeof raw.sourceAccount==='string'?raw.sourceAccount.trim():'';
  if(scope==='account'){
   if(currentFolders.length&&!currentFolders.some(f=>f.accountId===sourceAccount)){
    const tFolder=folderById.get(target)||currentFolders[0];
    if(tFolder)sourceAccount=tFolder.accountId;
   }
   if(!source||!folderById.has(source)){
    const accFolder=currentFolders.find(f=>f.accountId===sourceAccount&&f.id!==target)||currentFolders.find(f=>f.accountId===sourceAccount)||currentFolders[0];
    if(accFolder&&!source)source=accFolder.id;
   }
  }
  const branches=(Array.isArray(raw.branches)?raw.branches:[]).map(b=>b&&typeof b==='object'?{...b,target:resolveFolderId(b.target||'')}:b);
  return {...raw,id,scope,source,sourceAccount,target,match:raw.match||'all',enabled:raw.enabled!==false,readFilter:raw.readFilter||'default',unreadAction:raw.unreadAction||'default',branches};
 });
};
App.handle=async msg=>{
 await App.ready;
 if(!msg||typeof msg.type!=='string')throw new C.RuleError('bad_request');
 const e=App.engine;
 switch(msg.type){
  case 'status':return App.snapshot();
  case 'folders':return App.folderList();
  case 'createFolder':return App.createFolder(msg.parentId,msg.name);
  case 'inboxHints':return App.inboxHints(msg);
  case 'quickPreview':return App.quickPreview(msg);
  case 'filterExport':return App.filterExport(msg);
  case 'importConditions':return App.mutate(async()=>{
   App.checkRevision(msg.revision);
   return App.importConditions(msg);
  });
  case 'quickRule':return App.mutate(async()=>{
   App.checkRevision(msg.revision);
   return App.quickRule(msg);
  });
  case 'pendingPrefill':return App.prefill;
  case 'prefillConsumed':{App.prefill=null;return true;}
  case 'selected':{
   const m=await App.selected();return {author:m.author,subject:m.subject,read:m.read,source:m.folder?.id,sourceAccount:m.folder?.accountId||'',email:C.email(m.author),domain:C.email(m.author).split('@')[1]||''};
  }
  case 'testRule':{
   const r=C.validateRule(msg.rule),m=await App.selected();const matches=C.match(r,m,true,true);
   let reason='no_match';
   if(matches){
    const rf=r.readFilter||'default';
    const allowUnread=rf==='both'||rf==='unread'||(rf==='default'&&e.config.moveMode==='direct');
    const onlyUnread=rf==='unread';
    reason=!r.enabled?'disabled':(onlyUnread&&m.read===true)?'already_read':(!allowUnread&&m.read!==true)?'unread':(!allowUnread&&(await e.displayed()).has(m.id))?'displayed':'eligible';
    await e.validateRuleFolders(r);
   }
   App.log('simulated',1);return {matches,reason,read:m.read,subject:m.subject,author:m.author,target:C.targetFor(r,m),ruleName:r.name,outsideSource:!!(matches&&m.folder?.id!==r.source)};
  }
  case 'catchUp':{
   const r=await App.engine.catchUp(msg.ruleId);
   for(const j of App.engine.pending.values())if(j.hiddenSince===null)j.hiddenSince=Date.now()-2500;
   App.kick();
   await Promise.race([App.engine.tick().catch(()=>{}),new Promise(res=>setTimeout(res,350))]);
   App.invalidateScan();
   return r;
  }
  case 'brakeRelease':{
   const e=App.engine;
   const rule=e.config.rules.find(r=>r.id===msg.ruleId);
   const held=rule?e.heldRule(rule.id):null;
   if(!rule||!held)throw new C.RuleError('bad_rule');
   /* Släpp spärren i en egen skrivning – mutatet pausar motorn och då kan inget svep köras. */
   await App.mutate(async()=>{
    e.releaseRule(rule.id);
    /* Nivån användaren godkände blir regelns normalnivå, så bromsen inte slår till igen direkt. */
    App.brakeHistory[rule.id]=[...(App.brakeHistory[rule.id]||[]),held.matched].slice(-10);
    App.saveBrakeHistory();
    App.log('debug',0,'sakerhetsbromsen slappt: du godkande att regeln "'+(rule.name||rule.id)+'" flyttar '+held.matched+' mejl');
   });
   const r=await e.sweepRule(rule,{includeInboxUnread:true,force:true});
   for(const j of e.pending.values())if(j.hiddenSince===null)j.hiddenSince=Date.now()-2500;
   App.kick();App.invalidateScan();
   await Promise.race([e.tick().catch(()=>{}),new Promise(res=>setTimeout(res,350))]);
   return {result:r,status:App.snapshot()};
  }
  case 'brakeCancel':return App.mutate(async()=>{
   const e=App.engine;
   const rule=e.config.rules.find(r=>r.id===msg.ruleId);
   if(!rule||!e.heldRule(rule.id))throw new C.RuleError('bad_rule');
   e.releaseRule(rule.id);
   const rules=e.config.rules.map(r=>r.id===rule.id?{...r,enabled:false}:r);
   await App.save({...e.config,rules,revision:e.config.revision+1,rulesVersion:e.config.rulesVersion+1},{backup:true,discard:true});
   App.log('debug',0,'sakerhetsbromsen: regeln "'+(rule.name||rule.id)+'" stangdes av efter ditt svar');
   App.invalidateScan();App.scheduleAutoBackup();
   return App.snapshot();
  });
  /* Tredje svaret på säkerhetsbromsen: regeln ska bort. Samma villkor som de
     andra två – det måste finnas en spärr att släppa – och samma skrivning med
     backup, så regeln går att få tillbaka under Regelkopior. */
  case 'brakeDelete':return App.mutate(async()=>{
   const e=App.engine;
   const rule=e.config.rules.find(r=>r.id===msg.ruleId);
   if(!rule||!e.heldRule(rule.id))throw new C.RuleError('bad_rule');
   e.releaseRule(rule.id);
   const rules=e.config.rules.filter(r=>r.id!==rule.id);
   await App.save({...e.config,rules,revision:e.config.revision+1,rulesVersion:e.config.rulesVersion+1},{backup:true,discard:true});
   delete App.brakeHistory[rule.id];
   App.saveBrakeHistory();
   App.log('debug',0,'sakerhetsbromsen: regeln "'+(rule.name||rule.id)+'" togs bort efter ditt svar');
   App.invalidateScan();App.scheduleAutoBackup();
   return App.snapshot();
  });
  /* Manuell cache-rensning. Auto-rensningen kan stängas av; den här knappen
     fungerar ändå, det är användarens eget val. */
  case 'clearCache':{
   const result=App.clearCaches({manual:true});
   return {result,status:App.snapshot()};
  }
  case 'sweepNow':{
   const r=await App.runAllRules(true);
   App.invalidateScan();
   return r;
  }
  /* "Varför ligger det här mejlet här?" – ett omvänt uppslag för markat mejl,
     eller för ett mejl som skickats in från demot. Svarar med allt gränssnittet
     behöver: vilken regel som vinner, vart den skickar mejlet och vad som stoppar. */
  case 'whyHere':{
   const e=App.engine;
   const message=msg.message&&typeof msg.message==='object'?msg.message:await App.selected();
   let displayed=false;
   try{displayed=(await e.displayed()).has(message.id);}catch{}
   const queueContains=!!e.pending?.has?.(message.id);
   const key=C.fingerprint(message);
   /* Tål att motorn är på väg upp: då finns varken kön eller journalen ännu. */
   const recordsContains=!!(key&&((e.records?.has?.(key))||(e.done?.has?.(key))));
   const heldIds=(e.heldList?.()||[]).map(h=>h.ruleId);
   const result=C.whyHere(e.config.rules,message,{moveMode:e.config.moveMode,displayed,queueContains,recordsContains,heldIds});
   /* Mappnamnen behövs för att kunna skriva "skulle flyttas till Fakturor" i klartext. */
   const folders=await App.folderList().catch(()=>[]);
   const nameOf=id=>folders.find(f=>f.id===id)?.label||'';
   return {...result,message:{id:message.id,author:message.author||'',subject:message.subject||'',read:message.read===true,folderId:message.folder?.id||'',folderName:nameOf(message.folder?.id||'')},
    winnerName:nameOf(result.winnerTarget),folderNames:folders.map(f=>({id:f.id,label:f.label}))};
  }
  case 'diagnose':{
   const rule=C.validateRule(msg.rule);
   return App.engine.diagnose(rule);
  }
  case 'setOptions':return App.mutate(async()=>{
   App.checkRevision(msg.revision);
   if(!['read','direct'].includes(msg.moveMode)||typeof msg.hourly!=='boolean'||!Number.isInteger(msg.sweepMinutes)||msg.sweepMinutes<15||msg.sweepMinutes>1440||msg.sweepMinutes%15||typeof msg.newInboxDirect!=='boolean'||typeof msg.openWindow!=='boolean'||typeof msg.verbose!=='boolean'||typeof msg.fileLog!=='boolean'||typeof msg.autoBackup!=='boolean'||typeof msg.autoClear!=='boolean'||typeof msg.brake!=='boolean')throw new C.RuleError('bad_schema');
   const modeChanged=msg.moveMode!==e.config.moveMode;
   const verboseChanged=msg.verbose!==e.config.verbose;
   const backupChanged=msg.autoBackup!==e.config.autoBackup;
   await App.save({...e.config,moveMode:msg.moveMode,hourly:msg.hourly,sweepMinutes:msg.sweepMinutes,newInboxDirect:msg.newInboxDirect,openWindow:msg.openWindow,verbose:msg.verbose,fileLog:msg.fileLog,autoBackup:msg.autoBackup,autoClear:msg.autoClear,brake:msg.brake,revision:e.config.revision+1,rulesVersion:e.config.rulesVersion+(modeChanged?1:0)},{discard:modeChanged});
   /* Stängs bromsen av släpps alla stoppade regler direkt – annars skulle de ligga kvar stoppade utan broms. */
   if(msg.brake===false)for(const h of e.heldList())e.releaseRule(h.ruleId);
   App.scheduleSweep();
   if(backupChanged&&msg.autoBackup)App.scheduleAutoBackup();
   if(msg.verbose&&verboseChanged)App.log('debug',0,'detaljlogg aktiverad: svep, trafik och avvisningar visas utan mejlinnehall');
   App.log('settings_saved');return App.snapshot();
  });
  case 'queueSelected':{
   if(!e.enabled())throw new C.RuleError('paused');
   const m=await App.selected();
   const rule=e.firstMatchingRule(m,{allowUnread:true});
   if(!rule){
    if(C.firstMatch(e.config.rules,m))throw new C.RuleError(m.read?'already_read':'unread');
    throw new C.RuleError('no_match');
   }
   const direct=e.ruleDirect(rule,m.read!==true);
   const queued=await e.enqueue(m,{rule,target:C.targetFor(rule,m),allowUnread:m.read!==true,notify:direct&&m.read!==true});
   App.invalidateScan();
   return {queued};
  }
  case 'saveRules':return App.mutate(async()=>{
   App.checkRevision(msg.revision);const rules=C.validateRules(msg.rules);await App.checkRules(rules);
   await App.save({...e.config,rules,revision:e.config.revision+1,rulesVersion:e.config.rulesVersion+1},{backup:true,discard:true});
   /* En borttagen regel ska inte lämna en spärr efter sig i varningsraden. */
   for(const h of e.heldList())if(!rules.some(r=>r.id===h.ruleId))e.releaseRule(h.ruleId);
   /* Borttagen regel eller avslutad provkörning: räkningen ska inte ligga kvar
      och spöka om samma regel börjar provköras igen. */
   let trialDropped=false;
   for(const ruleId of [...(e.trialKeys?.keys?.()||[])]){
    const rule=rules.find(r=>r.id===ruleId);
    if(!rule||!rule.trialUntil){e.clearTrial(ruleId);trialDropped=true;}
   }
   if(trialDropped)await App.write(()=>B.storage.local.set({trial:e.trialList()})).catch(()=>{});
   App.log('rules_saved',rules.length);App.scheduleAutoBackup();return App.snapshot();
  });
  case 'setMode':return App.mutate(async()=>{
   App.checkRevision(msg.revision);
   if(typeof msg.paused!=='boolean'||typeof msg.dryRun!=='boolean')throw new C.RuleError('bad_request');
   if(e.blocked()&&!msg.paused)await e.clearBlocked();
   const changing=msg.dryRun!==e.config.dryRun;
   await App.save({...e.config,paused:msg.paused,dryRun:msg.dryRun,revision:e.config.revision+1,rulesVersion:e.config.rulesVersion+(changing?1:0)},{discard:changing});
   e.fault='';App.log('settings_saved');if(e.pending.size)App.kick();return App.snapshot();
  });
  case 'export':{
   const folderHints=(await App.folderList().catch(()=>[])).map(f=>({id:f.id,accountId:f.accountId,accountName:f.accountName,name:f.name,label:f.label}));
   return {format:'lasfilter-rules',app:'SortBro',version:1,exported:new Date().toISOString(),rules:e.config.rules,folders:folderHints};
  }
  case 'exportErrorLog':return App.errorLogText();
  case 'reportUiError':{
   /* Bara kända felkoder. Aldrig exception.message/stack eller mejlinnehåll. */
   const codes=['storage_error','display_error','move_error','sweep_error','uncertain_move','internal_error','invalid_storage','javascript_error','unhandled_rejection'];
   const code=codes.includes(msg.code)?msg.code:'internal_error';
   App.log('error',0,'ui: '+code);return {ok:true};
  }
  case 'exportLog':return {format:'lasfilter-technical-log',version:1,events:C.cleanLogs(App.logs)};
  case 'backupNow':return App.autoBackup({force:true});
  case 'import':return App.mutate(async()=>{
   App.checkRevision(msg.revision);
   const currentFolders=await App.folderList().catch(()=>[]);
   const baseRules=msg.merge===true?e.config.rules:[];
   const normalized=App.extractImportedRules(msg.backup,currentFolders,baseRules);
   const combined=msg.merge===true?[...baseRules,...normalized]:normalized;
   const rules=C.validateRules(combined);await App.checkRules(rules);
   const pauseOnImport=!msg.keepMode;
   await App.save({...e.config,rules,paused:pauseOnImport?true:e.config.paused,dryRun:pauseOnImport?true:e.config.dryRun,revision:e.config.revision+1,rulesVersion:e.config.rulesVersion+1},{backup:true,discard:true});
   App.log('rules_saved',rules.length);return App.snapshot();
  });
  case 'restoreBackup':return App.mutate(async()=>{
   App.checkRevision(msg.revision);const backup=App.backups[msg.index];if(!backup)throw new C.RuleError('bad_request');
   const rules=C.validateRules(backup.config.rules);await App.checkRules(rules);
   await App.save({...e.config,rules,paused:true,dryRun:true,revision:e.config.revision+1,rulesVersion:e.config.rulesVersion+1},{backup:true,discard:true});
   App.log('backup_restored',rules.length);return App.snapshot();
  });
  case 'clearBlocked':return App.mutate(async()=>{await e.clearBlocked();await App.save({...e.config,paused:false,revision:e.config.revision+1});App.log('settings_saved');return App.snapshot();});
  case 'prefs':{
   const p=msg.prefs||{},next={...App.prefs};
   if(['system','light','dark'].includes(p.theme))next.theme=p.theme;
   if(Number.isInteger(p.fontSize)&&p.fontSize>=12&&p.fontSize<=18)next.fontSize=p.fontSize;
   if(typeof p.lastRule==='string'&&p.lastRule.length<=80)next.lastRule=p.lastRule;
   if(typeof p.lastTarget==='string'&&p.lastTarget.length<=80)next.lastTarget=p.lastTarget;
   if(['sv','en'].includes(p.lang))next.lang=p.lang;
   if(['auto',...SEASONS].includes(p.season))next.season=p.season;
   if(p.filterUris&&typeof p.filterUris==='object'&&!Array.isArray(p.filterUris)){
    const clean={};
    for(const [k,v] of Object.entries(p.filterUris).slice(0,10))if(typeof k==='string'&&k.length>=1&&k.length<=64&&typeof v==='string'&&v.length<=240)clean[k]=v;
    next.filterUris=clean;
   }
   await App.write(()=>B.storage.local.set({prefs:next}));App.prefs=next;App.applySeasonIcon();App.syncMenu();return next;
  }
  /* Provkörning är slut: aktivera, förläng en vecka eller stäng av regeln. */
  case 'trialResolve':return App.mutate(async()=>{
   const ruleId=String(msg.ruleId||'');
   const action=['activate','extend','off'].includes(msg.action)?msg.action:'';
   if(!action)throw new C.RuleError('bad_request');
   const r=e.config.rules.find(x=>x.id===ruleId);
   if(!r)throw new C.RuleError('bad_id');
   const next={...r,trialUntil:action==='extend'?Date.now()+C.LIMITS.trialDays*86400000:0,enabled:action!=='off'};
   const rules=e.config.rules.map(x=>x.id===ruleId?next:x);
   await App.save({...e.config,rules,revision:e.config.revision+1,rulesVersion:e.config.rulesVersion+1},{backup:true,discard:true});
   e.clearTrial(ruleId);
   await App.write(()=>B.storage.local.set({trial:e.trialList()})).catch(()=>{});
   App.log('settings_saved');
   App.log('debug',0,'provkorning '+action+': '+r.name);
   return {rule:next,snapshot:App.snapshot()};
  });
  case 'learnCreate':return App.mutate(()=>App.learnCreate(String(msg.key||'')));
  case 'learnSnooze':{
   const key=String(msg.key||'');
   const entry=App.learned.entries.find(x=>App.learnKey(x)===key);
   if(!entry)throw new C.RuleError('bad_id');
   App.learned.snooze[key]={at:Date.now(),count:entry.count};
   await App.saveLearned();App.changed();
   return App.snapshot();
  }
  /* Samma väg som knappen i förslagsraden, men styrd från Inställningar. */
  case 'learnToggle':{
   const off=msg.off===true;
   App.learned={off,entries:off?[]:App.learned.entries,snooze:off?{}:App.learned.snooze};
   await App.saveLearned();App.changed();
   App.log('settings_saved');
   return App.snapshot();
  }
  case 'learnOff':{
   App.learned={off:true,entries:[],snooze:{}};
   await App.saveLearned();App.changed();
   App.log('settings_saved');
   return App.snapshot();
  }
  default:throw new C.RuleError('bad_request');
 }
};
App.open=async tab=>{
 await App.ready;await App.captureTab(tab);
 if(App.uiTab!==null){try{await B.tabs.update(App.uiTab,{active:true});return;}catch{App.uiTab=null;}}
 const created=await B.tabs.create({url:B.runtime.getURL('ui.html')});App.uiTab=created.id;
};
App.ready=(async()=>{
 const data=await B.storage.local.get(['config','work','logs','errorLogs','backups','prefs','sweepAt','brake','backupWeek','cacheDay','trial','learned']);
 /* Vilken vecka som senast fick en daterad kopia – avgör om nästa körning ska skriva en. */
 if(typeof data.backupWeek==='string'&&/^\d{4}-W\d{2}$/.test(data.backupWeek))App.lastBackupWeek=data.backupWeek;
 if(typeof data.cacheDay==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(data.cacheDay))App.lastCacheDay=data.cacheDay;
 let cfg=C.defaults(),fault='';
 try{if(data.config!==undefined)cfg=C.config(data.config);}catch{fault='invalid_storage';}
 App.logs=C.cleanLogs(data.logs);App.errorLogs=C.cleanErrorLogs(Array.isArray(data.errorLogs)?data.errorLogs:data.logs);App.backups=[];
 for(const b of (Array.isArray(data.backups)?data.backups:[]).slice(0,5)){try{App.backups.push({time:b.time,config:C.config(b.config)});}catch{}}
 const p=data.prefs||{};
 if(['system','light','dark'].includes(p.theme))App.prefs.theme=p.theme;
 if(Number.isInteger(p.fontSize)&&p.fontSize>=12&&p.fontSize<=18)App.prefs.fontSize=p.fontSize;
 if(typeof p.lastRule==='string'&&p.lastRule.length<=80)App.prefs.lastRule=p.lastRule;
 if(typeof p.lastTarget==='string'&&p.lastTarget.length<=80)App.prefs.lastTarget=p.lastTarget;
 if(['sv','en'].includes(p.lang))App.prefs.lang=p.lang;
 if(['auto',...SEASONS].includes(p.season))App.prefs.season=p.season;
 App.applySeasonIcon();
 App.engine=new LasEngine(B,cfg,{persist:App.persistWork,log:App.log,change:App.changed,kick:App.kick,debug:t=>{if(App.engine.config.verbose||App.engine.config.fileLog)App.log('debug',0,t);},
  notify:App.openUnread,brakeLimit:App.brakeLimit,ruleDone:App.brakeRecord});
 App.engine.trialRestore?.(data.trial);
 App.learned=App.cleanLearned(data.learned);
 let needResweep=false;
 if(fault){App.engine.fault=fault;App.log('error');}
 else{
  const rawWork=Array.isArray(data.work)?data.work:[];
  const staleAttempted=rawWork.filter(r=>r?.stage==='attempted');
  const pendingWork=rawWork.filter(r=>r?.stage!=='attempted');
  for(const r of staleAttempted.slice(0,15)){
   if(r?.target&&r?.headerMessageId){
    const inTarget=await App.engine.findByHeader(r.target,r.headerMessageId);
    if(inTarget&&typeof r.key==='string'){App.engine.done.add(r.key);if(C.fingerprint(inTarget))App.engine.done.add(C.fingerprint(inTarget));}
   }
  }
  if(staleAttempted.length)App.log('debug',staleAttempted.length,'tidigare flyttsparr rensad vid start');
  if(pendingWork.length>20)needResweep=true;
  await App.engine.restore(pendingWork.slice(0,20));
 }
 await App.readTbVersion();
 await App.readSelfInfo();
 /* Senaste svepet från förra gången, så att starten vet om det är dags att ta igen något. */
 App.brakeHistory={};
 if(data.brake&&typeof data.brake==='object'&&!Array.isArray(data.brake)){
  for(const [id,list] of Object.entries(data.brake))if(Array.isArray(list))App.brakeHistory[id]=list.filter(n=>Number.isFinite(n)&&n>0).slice(-10);
 }
 const savedSweep=Number(data.sweepAt);
 if(Number.isFinite(savedSweep)&&savedSweep>0){App.lastAutoSweep=savedSweep;if(!App.engine.lastSweep)App.engine.lastSweep=savedSweep;}
 App.log('start');
 /* Är installationen tillfällig står det i klartext i loggfilen, så att nästa gång
    tillägget är borta går det att se varför i stället för att gissa. */
 if(App.installLogNote())App.log('debug',0,App.installLogNote());
 /* Egen rad med båda versionerna: bara debug-rader bär detaljtext, och den här
    raden är det sista spåret i loggfilen om tillägget en dag är borta. */
 App.log('debug',0,App.startDetail());
 /* En färsk kopia direkt vid start: den senaste kända uppsättningen regler. */
 App.scheduleAutoBackup();App.changed();
/* Sidor som var öppna när tillägget uppdaterades kör kvar sin gamla kod och visar
   därför den gamla versionen tills de laddas om. Här gick det inte att leta upp dem:
   tabbarnas adresser är dolda utan behörigheten "tabs", och den lägger vi inte till.
   I stället bär varje ärende från en sida med sig sin version (uiBuild), och
   App.reloadStaleUi laddar om den som inte matchar den här versionen. */
 App.timer=setInterval(()=>{
  const now=Date.now(),gap=App.lastTickAt?now-App.lastTickAt:0;
  App.lastTickAt=now;
  /* Ett glapp på över två minuter betyder att datorn sovit eller att Thunderbird stått still.
     Har svepet hunnit bli försenat tar vi igen det direkt i stället för att vänta på timern. */
  if(gap>120000&&App.sweepOverdue(now))App.autoSweep().catch(()=>{});
  App.engine.tick().catch(()=>App.fail('internal_error'));
  /* Cache-rensningen behöver inte frågas varannan sekund – en gång i minuten
     räcker, och då är klockan ändå billig att läsa. */
  if(!App.cacheTickAt||now-App.cacheTickAt>60000){App.cacheTickAt=now;App.maybeClearCache();App.maybeWeeklyBackup();}
  /* En nedladdad version som väntar på att inget ska pågå. */
  App.applyPendingUpdate().catch(()=>{});
 },2000);App.scheduleSweep();
 if(App.engine.pending.size)App.kick();
 App.lastTickAt=Date.now();App.startedAt=Date.now();
 /* Ett svep vid varje start när bevakningen är på: direkt (800 ms) om svepet är på tiden
    efter en längre paus, annars lugnt efter tre sekunder så att kontona hinner svara. */
 if(App.engine.enabled()&&App.engine.config.rules.some(r=>r.enabled)){
  const overdue=needResweep||App.sweepOverdue();
  setTimeout(()=>{if(App.engine?.enabled()&&!App.startSweepDone)App.startSweep().catch(()=>{});},overdue?800:3000);
  if(overdue)App.log('debug',0,'svepet ar forsenat sedan forra gangen - tar igen det direkt vid start');
 }
})().catch(()=>{
 if(!App.engine)App.engine=new LasEngine(B,C.defaults(),{persist:App.persistWork,log:App.log,change:App.changed,kick:App.kick,debug:t=>{if(App.engine.config.verbose||App.engine.config.fileLog)App.log('debug',0,t);}});
 App.engine.stop('storage_error');
});
/* En sida som skickar ett ärende hit talar om vilken version dess kod har. Stämmer
   den inte med den installerade versionen laddas fliken om en gång – efter det kör
   den nya koden och hör av sig med rätt version. Utan det här fortsätter en flik
   som var öppen under uppdateringen att visa den gamla versionen i sidfoten. */
const UI_BUILD=B.runtime.getManifest().version;
App.staleUi=new Set();
App.reloadStaleUi=(sender,msg)=>{
 const tabId=sender?.tab?.id;
 if(typeof tabId!=='number')return;
 if(typeof UI_BUILD!=='string'||!UI_BUILD)return;
 if(msg?.uiBuild===UI_BUILD)return;
 if(App.staleUi.has(tabId))return;
 App.staleUi.add(tabId);
 B.tabs.reload(tabId).catch(()=>App.staleUi.delete(tabId));
 App.log('debug',0,'sida med annan version omladdad ('+(msg?.uiBuild||'utan versionsmarkering')+' mot '+UI_BUILD+')');
};
/* Tyst omstart när en ny version har laddats ner. Så länge tillägget lyssnar på
   onUpdateAvailable skjuter Thunderbird upp bytet – annars hade koden bytts ut mitt
   i en flytt – och vi laddar om själva när inget pågår. Det är hela "omstarten":
   inget fönster, ingen fråga, ingen omstart av Thunderbird.
   Går det inte att vänta längre (något har hängt i trettio minuter) byter vi ändå;
   kön och reglerna ligger i storage och plockas upp igen av restore(). */
App.pendingUpdate='';
App.updateDeadline=0;
App.engineBusy=()=>{
 const e=App.engine;
 if(!e)return false;
 return !!((e.pending&&e.pending.size)||(e.inflight&&e.inflight.size)||e.sweeping||e.hold);
};
/* Loggraden skrivs med 500 ms fördröjning och loggfilen med 1 200 ms. En omstart
   som sker direkt efter loggningen skulle alltså slänga bort exakt den rad som
   förklarar omstarten. Här spolas allt ut först. */
App.flushWrites=async()=>{
 clearTimeout(App.logTimer);clearTimeout(App.fileLogTimer);App.fileLogTimer=null;
 try{await App.write(()=>B.storage.local.set({logs:App.logs,errorLogs:App.errorLogs,work:App.engine?.recordList?.()||[]}));}catch{}
 try{await App.writeChain;}catch{}
};
App.applyPendingUpdate=async()=>{
 if(!App.pendingUpdate)return false;
 const overdue=!!App.updateDeadline&&Date.now()>App.updateDeadline;
 if(App.engineBusy()&&!overdue)return false;
 const version=App.pendingUpdate;
 App.pendingUpdate='';
 App.log('debug',0,'byter till version '+version+(overdue?' (inget blev ledigt pa 30 min)':' nar inget pagick'));
 await App.flushWrites();
 try{B.runtime.reload();}catch{App.pendingUpdate=version;return false;}
 return true;
};
try{
 B.runtime.onUpdateAvailable.addListener(details=>{
  App.pendingUpdate=String(details?.version||'okand');
  App.updateDeadline=Date.now()+30*60*1000;
  App.applyPendingUpdate().catch(()=>{});
 });
}catch{}

/* Hur ofta det letas efter en ny version bestäms av Thunderbird, inte av oss:
   en kontroll vid start och sedan enligt extensions.update.interval (86400 s).
   Webbläsar-API:t för att be om en extra kontroll, runtime.requestUpdateCheck,
   finns bara som deklaration i Thunderbird – det är märkt "unsupported" i
   toolkit/components/extensions/schemas/runtime.json – så det går inte att
   tvinga fram en kontroll härifrån. Finns anropet i en framtid används det,
   tyst, var tolfte timme; annars står vi still. */
App.updateCheckEveryMs=12*60*60*1000;
App.requestUpdateCheck=async()=>{
 const call=B.runtime?.requestUpdateCheck;
 if(typeof call!=='function')return 'unsupported';
 try{
  const r=await call.call(B.runtime);
  if(r&&r.status==='update_available'){
   App.pendingUpdate=String(r.version||'okand');
   App.updateDeadline=Date.now()+30*60*1000;
   await App.applyPendingUpdate();
  }
  return (r&&r.status)||'unknown';
 }catch{return 'failed';}
};
App.startUpdateWatch=()=>{
 App.requestUpdateCheck().then(status=>{
  if(status==='unsupported')App.log('debug',0,'uppdateringskontroll: Thunderbird har inget sadant anrop - dess egen timer skoter kontrollen');
  else if(status!=='no_update')App.log('debug',0,'uppdateringskontroll: '+status);
 }).catch(()=>{});
 App.updateTimer=setInterval(()=>{App.requestUpdateCheck();},App.updateCheckEveryMs);
};
App.startUpdateWatch();

B.browserAction.onClicked.addListener(tab=>App.open(tab).catch(()=>App.log('error')));
B.runtime.onMessage.addListener((msg,sender)=>{
 if(sender.id!==B.runtime.id||msg?.event)return undefined;
 if(msg?.uiBuild!==UI_BUILD)App.reloadStaleUi(sender,msg);
 return App.handle(msg).then(data=>({success:true,data})).catch(err=>{
  const code=err instanceof C.RuleError?err.code:'internal_error';
  if(code==='storage_error'||!(err instanceof C.RuleError))App.engine?.stop(code);
  return {success:false,error:code};
 });
});
B.messages.onUpdated.addListener((m,props,old)=>App.ready.then(async()=>{
 const until=App.keepUnread.get(m.id)||0;
 if(until>Date.now()){
  if(props.read===true){await B.messages.update(m.id,{read:false}).catch(()=>{});App.log('debug',0,'olast_status_aterstalld');}
  return;
 }
 if(until)App.keepUnread.delete(m.id);
 await App.engine.readChanged(m,props,old);
}).catch(()=>App.fail('internal_error')));
B.messages.onNewMailReceived.addListener((folder,list)=>App.onNewMail(folder,list).catch(()=>App.log('error',0,'nyinkommet_misslyckades')));
B.messages.onMoved.addListener((old,moved)=>App.ready.then(async()=>{
 App.invalidateScan();
 /* Fånga först om flytten var vår egen – efter bekräftelsen är jobbet borta ur kön. */
 const ours=(old?.messages||[]).some(m=>App.engine.inflight.has(m.id)||App.engine.pending.has(m.id));
 const done=await App.engine.onMoved(old,moved);
 await App.learnMove(old,moved,{ours});
 return done;
}).catch(()=>App.fail('internal_error')));
B.messageDisplay.onMessagesDisplayed.addListener(()=>App.ready.then(()=>App.engine.tick()).catch(()=>App.fail('display_error')));
/* Kvitto på att fönstret visade något: samma meddelande som vi just öppnade ska
   dyka upp i visningen. Loggen kan då svara på om en tom ruta kom från oss eller ej. */
B.messageDisplay.onMessagesDisplayed.addListener(tab=>{
 const want=App.expectDisplay;
 if(!want)return;
 App.ready.then(async()=>{
  try{
   const shown=await B.messageDisplay.getDisplayedMessages(tab?.id);
   const hit=(shown||[]).some(m=>m&&(m.id===want.messageId||(want.headerMessageId&&m.headerMessageId===want.headerMessageId)));
   if(hit){if(App.expectDisplay===want)App.expectDisplay=null;App.log('debug',0,'olasta mejlet visades i fonstret');}
  }catch{}
 }).catch(()=>{});
});
B.tabs.onRemoved.addListener(id=>{if(App.uiTab===id)App.uiTab=null;if(App.mailTab===id)App.mailTab=null;App.ready.then(()=>App.engine.tick()).catch(()=>{});});
B.tabs.onActivated.addListener(({tabId})=>B.tabs.get(tabId).then(App.captureTab).catch(()=>{}));
B.mailTabs.onSelectedMessagesChanged.addListener(tab=>App.captureTab(tab));
B.commands.onCommand.addListener(cmd=>{
 if(cmd==='sweep')App.ready.then(()=>App.autoSweep()).catch(()=>App.log('error',0,'snabbkommando_svep_misslyckades'));
 if(cmd==='open_ui')B.tabs.query({active:true,currentWindow:true}).then(tabs=>App.open(tabs[0])).catch(()=>App.log('error',0,'oppna_granssnitt_misslyckades'));
});
/* Högerklicksmeny på mejl i Thunderbird: förifyller en ny regel i SortBro. */
App.rulePrefillFromMessage=message=>{
 const address=C.email(message?.author);
 return {author:message?.author||'',email:address,domain:address.split('@')[1]||'',subject:typeof message?.subject==='string'?message.subject.slice(0,256):'',
  folderId:message?.folder?.id||'',accountId:message?.folder?.accountId||'',time:new Date().toISOString()};
};
App.ruleFromMessage=async info=>{
 const list=info?.selectedMessages?.messages;
 const first=Array.isArray(list)&&list.length?list[0]:null;
 const folder=info?.displayedFolder||first?.folder;
 let message=first;
 if(!message)return false;
 if(!message.author||message.subject===undefined){
  try{message=await B.messages.get(message.id);}catch{return false;}
 }
 App.prefill=App.rulePrefillFromMessage({...message,folder:message.folder||folder});
 App.log('debug',0,'regelforslag fran hogerklicksmeny');
 const tabs=await B.tabs.query({active:true,currentWindow:true}).catch(()=>[]);
 await App.open(tabs?.[0]);
 setTimeout(()=>B.runtime.sendMessage({event:'ruleFromMessage'}).catch(()=>{}),150);
 return true;
};
/* Snabbmenyn skapas en gång, men titeln ska följa språkvalet som allt annat.
   Den skapas innan inställningarna är inlästa, så titeln synkas om så snart de
   finns – och varje gång språket byts. */
const MENU_ID='sortbro-rule-from-message';
App.menuTitle=()=>App.prefs?.lang==='en'?'SortBro: Create a filter from this message…':'SortBro: Skapa filter från detta mejl…';
App.syncMenu=()=>{
 try{
  if(!B.menus?.update)return;
  Promise.resolve(B.menus.update(MENU_ID,{title:App.menuTitle()})).catch(()=>{});
 }catch{}
};
try{
 if(B.menus?.create)Promise.resolve(B.menus.create({id:MENU_ID,title:App.menuTitle(),contexts:['message_list']})).catch(()=>{});
}catch{}
App.ready.then(()=>App.syncMenu()).catch(()=>{});
if(B.menus?.onClicked)B.menus.onClicked.addListener((info,tab)=>{
 if(info?.menuItemId!=='sortbro-rule-from-message')return;
 App.ruleFromMessage(info).catch(()=>App.log('error',0,'hogerklicksmeny_misslyckades'));
});
B.folders.onFolderInfoChanged.addListener(()=>{
 App.engine?.invalidateFolders();
 if(!App.engine)return;
 if(App.engine.pending.size){App.kick();return;}
 if(App.engine.config.moveMode!=='direct'||App.engine.busy||App.engine.sweeping)return;
 clearTimeout(App.sweepDebounce);
 App.sweepDebounce=setTimeout(()=>{
  if(App.engine&&!App.engine.busy&&!App.engine.sweeping&&!App.engine.pending.size)App.engine.sweepAll().catch(()=>App.log('error',0,'direkt_svep_misslyckades'));
 },10000);
});
