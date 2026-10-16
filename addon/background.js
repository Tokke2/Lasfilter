'use strict';
const C=LasCore,B=browser;
const App={engine:null,logs:[],backups:[],prefs:{theme:'system',fontSize:14,lastRule:'',lang:'sv',season:'auto'},writeChain:Promise.resolve(),editChain:Promise.resolve(),mailTab:null,uiTab:null,timer:null,sweepTimer:null,kickTimer:null,logTimer:null,fileLogTimer:null,changeTimer:null,keepUnread:new Map(),prefill:null,lastAutoSweep:null};
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
App.startDetail=()=>'thunderbird '+(App.tbVersion||'okand')+' sortbro '+String(B.runtime.getManifest()?.version||'okand');
App.writeTextLog=async()=>{
 if(!App.engine?.config.fileLog)return;
 const lines=['LÄSFILTER TEKNISK LOGG','Skapad: '+new Date().toISOString(),'Version: '+B.runtime.getManifest().version,'Thunderbird: '+(App.tbVersion||'okand'),'Sekretess: inga ämnesrader, adresser eller mejltexter skrivs.',''];
 for(const x of App.logs)lines.push([x.time,x.level,x.event,'count='+x.data.count,x.data.detail||''].join('\t'));
 const url=URL.createObjectURL(new Blob([lines.join('\r\n')+'\r\n'],{type:'text/plain;charset=utf-8'}));
 try{await B.downloads.download({url,filename:'Lasfilter/lasfilter-logg.txt',saveAs:false,conflictAction:'overwrite'});}finally{setTimeout(()=>URL.revokeObjectURL(url),60000);}
};
App.scheduleTextLog=()=>{clearTimeout(App.fileLogTimer);App.fileLogTimer=setTimeout(()=>App.writeTextLog().catch(()=>{}),1200);};
/* Automatisk säkerhetskopia av reglerna. Den skrivs till Hämtade filer, alltså
   utanför profilen: försvinner tillägget en dag ligger reglerna kvar och kan
   importeras tillbaka. Två filer: en som alltid är den senaste, och en daterad
   per dag så att en felaktig ändring går att backa till. */
App.backupFolder='Lasfilter/';
App.autoBackupNames={latest:'sortbro-regler-backup.json',dated:day=>'sortbro-regler-'+day+'.json'};
App.autoBackup=async({force=false}={})=>{
 const e=App.engine;if(!e)return {written:false,reason:'no_engine'};
 if(!force&&e.config.autoBackup===false)return {written:false,reason:'off'};
 const rules=e.config.rules;
 const payload={format:'lasfilter-rules',app:'SortBro',version:1,exported:new Date().toISOString(),rules,folders:[]};
 try{payload.folders=(await App.folderList().catch(()=>[])).map(f=>({id:f.id,accountId:f.accountId,accountName:f.accountName,name:f.name,label:f.label}));}catch{}
 const day=new Date().toISOString().slice(0,10);
 const key=JSON.stringify(rules);
 const unchanged=key===App.lastBackupKey;
 const daily=force||App.lastBackupDay!==day;
 const name=App.autoBackupNames.latest;
 const write=async filename=>{
  const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
  try{await B.downloads.download({url,filename:App.backupFolder+filename,saveAs:false,conflictAction:'overwrite'});}
  finally{setTimeout(()=>URL.revokeObjectURL(url),60000);}
 };
 if(unchanged&&!daily)return {written:false,reason:'unchanged',count:rules.length};
 try{
  await write(name);
  if(daily)await write(App.autoBackupNames.dated(day));
 }catch{
  /* Misslyckas filen är det ingen katastrof – men det ska synas i loggen. */
  App.log('debug',0,'reglerna kunde inte backas upp till Hamtade filer');
  return {written:false,reason:'failed',count:rules.length};
 }
 App.lastBackupKey=key;App.lastBackupDay=day;
 App.log('debug',0,'reglerna backade upp: '+rules.length+' st till Hamtade filer/'+App.backupFolder);
 /* Städa gamla dagsfiler – bara våra egna, bara i vår egen mapp, och tyst om det inte går. */
 try{
  const found=await B.downloads.search({filenameRegex:'[\\\\/]Lasfilter[\\\\/]sortbro-regler-\\d{4}-\\d{2}-\\d{2}\\.json$'});
  const limit=Date.now()-30*86400000;
  for(const item of Array.isArray(found)?found:[]){
   const when=Date.parse(item?.startTime||'');
   if(Number.isFinite(when)&&when<limit&&Number.isSafeInteger(item?.id))await B.downloads.removeFile(item.id);
  }
 }catch{}
 return {written:true,filename:App.backupFolder+name,dated:daily?App.backupFolder+App.autoBackupNames.dated(day):'',count:rules.length};
};
App.scheduleAutoBackup=()=>{clearTimeout(App.backupTimer);App.backupTimer=setTimeout(()=>App.autoBackup().catch(()=>{}),3000);};
App.log=(name,count=0,detail='')=>{
 const entry=C.event(name,count,Date.now(),detail);if(!entry)return;
 /* Samma klocka som stämplade raden avgör om den får ligga kvar – annars kan en
    rad som just skrivits gallras bort av en klocka som gått olika. */
 App.logs=C.cleanLogs([...App.logs,entry],Date.now());
 clearTimeout(App.logTimer);App.logTimer=setTimeout(()=>App.write(()=>B.storage.local.set({logs:App.logs})).catch(()=>{}),500);App.scheduleTextLog();
};
// Behåll alltid det första, mest specifika felet. Händelselyssnare ska inte
// skriva över exempelvis storage_error med det mindre hjälpsamma internal_error.
App.fail=code=>{if(App.engine&&!App.engine.fault)App.engine.stop(code);};
App.kick=()=>{if(App.kickTimer)return;App.kickTimer=setTimeout(()=>{App.kickTimer=null;App.engine?.tick().catch(()=>App.fail('internal_error'));},0);};
App.emptySweep={scanned:0,queued:0,deferred:0,searchedFolders:0,skippedFolders:0,emptyFolders:0,cachedFolders:0};
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
App.autoSweep=async()=>{
 const attempt=async()=>{
  try{return {result:await App.runAllRules()};}
  catch(error){return {code:error instanceof C.RuleError?error.code:(error?.name||'Error')};}
 };
 let {result,code}=await attempt();
 if(code&&!['paused','disabled','internal_error'].includes(code)){
  await new Promise(res=>setTimeout(res,15000));
  if(App.engine?.enabled())({result,code}=await attempt());
 }
 if(result){
  if(result.skipped==='stopped'&&App.reportedStop!==App.engine?.fault){
   App.reportedStop=App.engine?.fault;
   App.log('debug',0,'automatiskt svep hoppades över: motorn är stoppad ('+(App.engine?.fault||'-')+') – rensa spärren under Avancerat');
  }
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
/* ✨ Föreslå regler från Inkorgen – endast lokala förslag, inget skapas här. */
/* Läser Inkorgen en gång och delar resultatet med alla snabbflöden (förslag, räkning, regler). */
App.scanInbox=async({limit=400}={})=>{
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
 return {messages:collected,inboxId,sourceAccount,scanned:collected.length};
};
App.suggestRules=async()=>{
 const {messages}=await App.scanInbox();
 return C.suggestFrom(messages,{rules:App.engine?.config.rules||[],limit:8,minCount:2});
};
/* Klickbara förslag: återkommande avsändare och vanliga ämnesord i Inkorgen. */
App.inboxHints=async()=>{
 const scan=await App.scanInbox();
 const hints=C.inboxHints(scan.messages,{rules:App.engine?.config.rules||[],limit:8,wordLimit:6,minCount:2,wordMinCount:3});
 return {...hints,inboxId:scan.inboxId,sourceAccount:scan.sourceAccount,scanned:scan.scanned};
};
/* "Så många mejl träffar regeln just nu" – räknas mot Inkorgen utan att spara något. */
App.quickPreview=async(msg)=>{
 const scan=await App.scanInbox();
 const rule=C.choiceRule({field:msg.field,value:msg.value});
 return {matches:C.countMatches(scan.messages,rule),scanned:scan.scanned,condition:rule.conditions[0],inboxId:scan.inboxId,sourceAccount:scan.sourceAccount};
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
   enabledRules:e.config.rules.filter(r=>r.enabled).length,
   backups:App.backups.map((x,i)=>({index:i,time:x.time,count:x.config.rules.length})),logs:App.logs};
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
  case 'suggestRules':return App.suggestRules();
  case 'inboxHints':return App.inboxHints();
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
   return r;
  }
  case 'sweepNow':return App.runAllRules(true);
  case 'diagnose':{
   const rule=C.validateRule(msg.rule);
   return App.engine.diagnose(rule);
  }
  case 'setOptions':return App.mutate(async()=>{
   App.checkRevision(msg.revision);
   if(!['read','direct'].includes(msg.moveMode)||typeof msg.hourly!=='boolean'||!Number.isInteger(msg.sweepMinutes)||msg.sweepMinutes<15||msg.sweepMinutes>1440||msg.sweepMinutes%15||typeof msg.newInboxDirect!=='boolean'||typeof msg.openWindow!=='boolean'||typeof msg.verbose!=='boolean'||typeof msg.fileLog!=='boolean'||typeof msg.autoBackup!=='boolean')throw new C.RuleError('bad_schema');
   const modeChanged=msg.moveMode!==e.config.moveMode;
   const verboseChanged=msg.verbose!==e.config.verbose;
   const backupChanged=msg.autoBackup!==e.config.autoBackup;
   await App.save({...e.config,moveMode:msg.moveMode,hourly:msg.hourly,sweepMinutes:msg.sweepMinutes,newInboxDirect:msg.newInboxDirect,openWindow:msg.openWindow,verbose:msg.verbose,fileLog:msg.fileLog,autoBackup:msg.autoBackup,revision:e.config.revision+1,rulesVersion:e.config.rulesVersion+(modeChanged?1:0)},{discard:modeChanged});App.scheduleSweep();
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
   const queued=await e.enqueue(m,{rule,target:C.targetFor(rule,m),allowUnread:m.read!==true,notify:direct&&m.read!==true});return {queued};
  }
  case 'saveRules':return App.mutate(async()=>{
   App.checkRevision(msg.revision);const rules=C.validateRules(msg.rules);await App.checkRules(rules);
   await App.save({...e.config,rules,revision:e.config.revision+1,rulesVersion:e.config.rulesVersion+1},{backup:true,discard:true});
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
   if(['sv','en'].includes(p.lang))next.lang=p.lang;
   if(['auto',...SEASONS].includes(p.season))next.season=p.season;
   if(p.filterUris&&typeof p.filterUris==='object'&&!Array.isArray(p.filterUris)){
    const clean={};
    for(const [k,v] of Object.entries(p.filterUris).slice(0,10))if(typeof k==='string'&&k.length>=1&&k.length<=64&&typeof v==='string'&&v.length<=240)clean[k]=v;
    next.filterUris=clean;
   }
   await App.write(()=>B.storage.local.set({prefs:next}));App.prefs=next;App.applySeasonIcon();return next;
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
 const data=await B.storage.local.get(['config','work','logs','backups','prefs']);
 let cfg=C.defaults(),fault='';
 try{if(data.config!==undefined)cfg=C.config(data.config);}catch{fault='invalid_storage';}
 App.logs=C.cleanLogs(data.logs);App.backups=[];
 for(const b of (Array.isArray(data.backups)?data.backups:[]).slice(0,5)){try{App.backups.push({time:b.time,config:C.config(b.config)});}catch{}}
 const p=data.prefs||{};
 if(['system','light','dark'].includes(p.theme))App.prefs.theme=p.theme;
 if(Number.isInteger(p.fontSize)&&p.fontSize>=12&&p.fontSize<=18)App.prefs.fontSize=p.fontSize;
 if(typeof p.lastRule==='string'&&p.lastRule.length<=80)App.prefs.lastRule=p.lastRule;
 if(['sv','en'].includes(p.lang))App.prefs.lang=p.lang;
 if(['auto',...SEASONS].includes(p.season))App.prefs.season=p.season;
 App.applySeasonIcon();
 App.engine=new LasEngine(B,cfg,{persist:App.persistWork,log:App.log,change:App.changed,kick:App.kick,debug:t=>{if(App.engine.config.verbose||App.engine.config.fileLog)App.log('debug',0,t);},
  notify:App.openUnread});
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
 App.log('start');
 /* Egen rad med båda versionerna: bara debug-rader bär detaljtext, och den här
    raden är det sista spåret i loggfilen om tillägget en dag är borta. */
 App.log('debug',0,App.startDetail());
 /* En färsk kopia direkt vid start: den senaste kända uppsättningen regler. */
 App.scheduleAutoBackup();App.changed();
 try{
  const uiUrl=B.runtime.getURL('ui.html');
  const tabs=await B.tabs.query({});
  const uiTabs=(tabs||[]).filter(t=>typeof t.url==='string'&&t.url.startsWith(uiUrl));
  if(uiTabs.length){
   const keep=uiTabs.find(t=>t.active)||uiTabs[0];
   App.uiTab=keep.id;
   for(const t of uiTabs)if(t.id!==keep.id)B.tabs.remove(t.id).catch(()=>{});
   B.tabs.reload(keep.id).catch(()=>{});
  }
 }catch{}
 App.timer=setInterval(()=>App.engine.tick().catch(()=>App.fail('internal_error')),2000);App.scheduleSweep();
 if(App.engine.pending.size)App.kick();
 if(App.engine.enabled()&&App.engine.config.rules.some(r=>r.enabled)&&(needResweep||App.engine.config.hourly)){
  setTimeout(()=>{if(App.engine?.enabled()&&App.engine.config.rules.some(r=>r.enabled))App.autoSweep();},needResweep?500:3000);
 }
})().catch(()=>{
 if(!App.engine)App.engine=new LasEngine(B,C.defaults(),{persist:App.persistWork,log:App.log,change:App.changed,kick:App.kick,debug:t=>{if(App.engine.config.verbose||App.engine.config.fileLog)App.log('debug',0,t);}});
 App.engine.stop('storage_error');
});
B.browserAction.onClicked.addListener(tab=>App.open(tab).catch(()=>App.log('error')));
B.runtime.onMessage.addListener((msg,sender)=>{
 if(sender.id!==B.runtime.id||msg?.event)return undefined;
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
B.messages.onMoved.addListener((old,moved)=>App.ready.then(()=>App.engine.onMoved(old,moved)).catch(()=>App.fail('internal_error')));
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
try{
 if(B.menus?.create)Promise.resolve(B.menus.create({id:'sortbro-rule-from-message',title:'SortBro: Skapa filter från detta mejl…',contexts:['message_list']})).catch(()=>{});
}catch{}
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
