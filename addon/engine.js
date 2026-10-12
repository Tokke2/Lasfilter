/* Händelsestyrd motor. Flyttar en i taget, aldrig genom musklick. */
(function(root){
'use strict';
const C=root.LasCore||(typeof require!=='undefined'?require('./core.js'):null);
class Engine {
 constructor(api,config,hooks={}){
  this.api=api;this.config=config;this.hooks=hooks;this.now=hooks.now||Date.now;
  this.pending=new Map();this.records=new Map();this.inflight=new Map();this.done=new Set();
  this.busy=false;this.sweeping=0;this.hold=false;this.fault='';this.epoch=0;
  /* Smart mapp-cache: tomma mappar och oförändrade mappar utan träffar hoppas
     över på under 1 ms i stället för att skannas om varje svep. */
  this.folderCache=new Map();this.cacheStats={hits:0,misses:0,empty:0};
  /* Årsmappar: mål som Arkiv/<år> hittas eller skapas en gång och återanvänds. */
  this.yearFolderIds=new Map();this.yearCreated=0;
  this.stats={checks:0,matched:0,moved:0,simulated:0,skipped:0};this.lastCheck=null;this.lastSweep=null;
 }
 /* Anropas när nya mejl kommer in, lässtatus ändras, mejl flyttas eller regler
    ändras – då är den sparade mappbilden inte längre pålitlig. */
 invalidateFolders(){this.folderCache.clear();}
 async folderInfo(folderId){
  if(!folderId||typeof this.api.folders?.getFolderInfo!=='function')return null;
  try{
   const info=await this.withTimeout(this.api.folders.getFolderInfo(folderId),this.hooks.infoTimeout??1500,()=>null);
   if(!info||typeof info!=='object')return null;
   const total=Number.isInteger(info.totalMessageCount)&&info.totalMessageCount>=0?info.totalMessageCount:null;
   const unread=Number.isInteger(info.unreadMessageCount)&&info.unreadMessageCount>=0?info.unreadMessageCount:null;
   if(total===null&&unread===null)return null;
   return {total,unread};
  }catch{return null;}
 }
 log(name,count=0,detail=''){this.hooks.log?.(name,count,detail);}
 debug(t){this.hooks.debug?.(t);}
 change(){this.hooks.change?.();}
 async persist(){try{await this.hooks.persist?.();}catch{this.stop('storage_error');throw new C.RuleError('storage_error');}}
 stop(code){this.fault=code;this.epoch++;this.log('error',0,'motor_stoppad code='+code);this.debug('motorn stoppad: '+code);this.change();}
 enabled(){return !this.config.paused&&!this.fault&&!this.hold;}
 recordList(){return [...this.records.values()].map(r=>({...r}));}
 blocked(){const active=new Set([...this.pending.values()].map(j=>j.record.key));return [...this.records.values()].filter(r=>r.stage==='attempted'&&!active.has(r.key)).length;}
 withTimeout(promise,ms, onTimeout){
  let timer;
  return Promise.race([
   Promise.resolve(promise).finally(()=>clearTimeout(timer)),
   new Promise((resolve,reject)=>{timer=setTimeout(()=>{if(typeof onTimeout==='function')resolve(onTimeout());else reject(new Error('timeout'));},ms);})
  ]);
 }
 async displayed(){
  const ids=new Set(),tabs=await this.withTimeout(this.api.tabs.query({}),this.hooks.displayTimeout??800,()=>[]);
  const mailTabs=(tabs||[]).filter(tab=>['mail','messageDisplay'].includes(tab?.type));
  await Promise.all(mailTabs.map(async tab=>{
   try{
    const raw=await this.withTimeout(this.api.messageDisplay.getDisplayedMessages(tab.id),this.hooks.displayTimeout??400,()=>[]);
    const messages=Array.isArray(raw)?raw:Array.isArray(raw?.messages)?raw.messages:raw==null?[]:null;
    if(!messages)throw new C.RuleError('display_error');
    for(const m of messages)if(Number.isSafeInteger(m?.id))ids.add(m.id);
   }catch(error){
    // En flik kan ha stängts mellan listning och kontroll. Bara en bekräftat
    // försvunnen flik får ignoreras; övriga fel stoppar bevakningen.
    const current=await this.withTimeout(this.api.tabs.query({}),this.hooks.displayTimeout??800,()=>[]);
    if((current||[]).some(t=>t.id===tab.id))throw error;
   }
  }));
  return ids;
 }
 async pair(rule){return this.pairFolders(rule.source,rule.target);}
 async pairFolders(sourceId,targetId){
  const [source,target]=await this.withTimeout(Promise.all([this.api.folders.get(sourceId,false),this.api.folders.get(targetId,false)]),5000);
  const [sc,tc]=await this.withTimeout(Promise.all([this.api.folders.getFolderCapabilities(sourceId),this.api.folders.getFolderCapabilities(targetId)]),5000);
  C.validatePair(source,target,sc,tc);return {source,target};
 }
 async validateRuleFolders(rule){
  if(rule.scope!=='account')return this.pair(rule);
  const [accounts,target,tc]=await Promise.all([this.api.accounts.list(true),this.api.folders.get(rule.target,false),this.api.folders.getFolderCapabilities(rule.target)]);
  if(!accounts.some(a=>a.id===rule.sourceAccount)||!C.usableFolder(target))throw new C.RuleError('unsafe_folder');
  if(tc.canAddMessages!==true)throw new C.RuleError('read_only');
  return {target};
 }
 makeRecord(m,rule,target,source=null,notify=false){
  const key=C.fingerprint(m);if(!key||!Number.isFinite(+new Date(m.date))||!Number.isSafeInteger(m.size))return null;
  return {key,headerMessageId:m.headerMessageId,date:+new Date(m.date),size:m.size,source:source||rule.source,target,ruleId:rule.id,notify:notify===true,
   unread:m.read!==true,rulesVersion:this.config.rulesVersion,stage:'pending',created:this.now()};
 }
 ruleMode(rule){return rule?.readFilter||'default';}
 /* Årsmappar: målet blir <regelns mapp>/<årtal>, t.ex. Arkiv/2025. Mappen
    återanvänds om den finns och skapas annars en gång (högst LIMITS.yearFolders
    per session). Går det inte att skapa används regelns vanliga målmapp. */
 async resolveTarget(rule,message,{create=true}={}){
  const base=C.targetFor(rule,message);
  if(!rule?.yearFolders)return base;
  const year=C.yearFolderName(message);
  if(!year)return base;
  const key=base+'\0'+year;
  if(this.yearFolderIds.has(key))return this.yearFolderIds.get(key);
  let folderId='';
  try{
   const parent=await this.withTimeout(this.api.folders.get(base,true),5000);
   const child=(parent?.subFolders||[]).find(f=>f&&f.id&&String(f.name||'')===year);
   if(child?.id)folderId=child.id;
   else if(create&&typeof this.api.folders?.create==='function'&&this.yearCreated<C.LIMITS.yearFolders){
    const made=await this.withTimeout(this.api.folders.create(base,year),8000);
    if(made?.id){folderId=made.id;this.yearCreated++;}
   }
  }catch{this.debug('arsmapp_kunde_inte_forberedas ar='+year);}
  if(!folderId){this.debug('arsmapp_saknas ar='+year+' anvander_ordinarie_mal');return base;}
  this.yearFolderIds.set(key,folderId);
  return folderId;
 }
 sameTarget(rule,message){
  if(!rule)return false;
  if(rule.yearFolders){
   const year=C.yearFolderName(message);
   return year?String(message?.folder?.name||'')===year:message?.folder?.id===rule.target;
  }
  return message?.folder?.id===C.targetFor(rule,message);
 }
 ruleAllows(rule,message,allowUnread=false){
  const rf=this.ruleMode(rule);
  if(rf==='unread')return message?.read!==true;
  if(rf==='read')return message?.read===true;
  if(rf==='both')return true;
  return message?.read===true||allowUnread||this.config.moveMode==='direct';
 }
 ruleDirect(rule,allowUnread=false){
  const rf=this.ruleMode(rule);
  if(rf==='both'||rf==='unread')return true;
  if(rf==='read')return false;
  return this.config.moveMode==='direct'||allowUnread;
 }
 firstMatchingRule(message,{allowUnread=false,inboxArrival=false}={}){
  return this.config.rules.find(r=>{
   if(!C.match(r,message)||this.sameTarget(r,message))return false;
   const rf=this.ruleMode(r);
   if(inboxArrival){
    if(rf==='read')return message.read===true;
    if(rf==='unread')return message.read!==true;
    if(rf==='both')return true;
    return this.config.newInboxDirect||this.config.moveMode==='direct'||message.read===true;
   }
   return this.ruleAllows(r,message,allowUnread);
  })||null;
 }
 async newInboxMessages(messages){
  if(!this.enabled())return 0;
  this.invalidateFolders();
  const hasCustomRule=this.config.rules.some(r=>r.enabled&&['both','unread','read'].includes(r.readFilter));
  if(!this.config.newInboxDirect&&this.config.moveMode!=='direct'&&!hasCustomRule)return 0;
  this.sweeping++;let queued=0;
  try{
   for(const m of messages||[]){
    if(!this.enabled())break;
    const rule=this.firstMatchingRule(m,{allowUnread:true,inboxArrival:true});if(!rule)continue;
    const direct=this.ruleDirect(rule,true);
    if(await this.enqueue(m,{rule,target:await this.resolveTarget(rule,m),allowUnread:this.ruleAllows(rule,m,true),notify:direct}))queued++;
   }
   this.debug('nyinkommet inkorg antal='+(messages?.length||0)+' koade='+queued);return queued;
  }finally{this.sweeping--;if(!this.sweeping&&this.pending.size)this.hooks.kick?.();}
 }
 async readChanged(m,changed,old={}){
  if(changed.read===undefined)return false;
  this.invalidateFolders();
  if(changed.read===false){
   await this.dropId(m.id);
   if(!this.enabled())return false;
   const unreadRule=this.config.rules.find(r=>r.readFilter==='unread'&&C.match(r,m)&&m.folder?.id!==C.targetFor(r,m));
   if(unreadRule)return this.enqueue(m,{rule:unreadRule,target:await this.resolveTarget(unreadRule,m),allowUnread:true,notify:true});
   return false;
  }
  if(changed.read!==true||old.read===true||!this.enabled())return false;
  return this.enqueue(m);
 }
 async enqueue(message,forced=null){
  const candidateRule=forced?forced.rule:this.firstMatchingRule(message,{allowUnread:false});
  const allowUnread=forced?.allowUnread||['both','unread'].includes(candidateRule?.readFilter)||this.config.moveMode==='direct';
  if(!this.enabled()||!message||(message.read!==true&&!allowUnread)||(candidateRule?.readFilter==='unread'&&message.read===true)||(candidateRule?.readFilter==='read'&&message.read!==true)||!Number.isSafeInteger(message.id)||!message.folder?.id){this.debug('kö avvisad id='+(message?.id??'-')+' pausad='+(this.config.paused?'ja':'nej')+' stopp='+(this.fault||'nej')+' torrprov='+(this.config.dryRun?'ja':'nej')+' last='+(message?.read?'ja':'nej')+' tillat_olast='+(allowUnread?'ja':'nej'));return false;}
  this.stats.checks++;
  const rule=candidateRule;if(!rule){this.debug('kö avvisad id='+message.id+' ingen regel matchar avsendar doman='+((C.email(message.author)||'').split('@')[1]||'okand'));return false;}
  const notify=forced?.notify===true||['both','unread'].includes(rule.readFilter);
  const target=forced?forced.target:await this.resolveTarget(rule,message);
  if(!target||target===message.folder.id){this.debug('kö avvisad id='+message.id+' mejlet ligger redan i målmappen');return false;}
  const record=this.makeRecord(message,rule,target,forced?message.folder.id:null,notify);
  if(!record){this.log('skipped',1);this.debug('kö avvisad id='+message.id+' saknar fingeravtryck (Message-ID/datum/storlek)');return false;}
  if(this.done.has(record.key)||this.records.has(record.key)||this.pending.has(message.id)){this.debug('kö avvisad id='+message.id+' redan hanterad eller köad');return false;}
  if(this.records.size>=C.LIMITS.queue){this.debug('kö full: meddelandet lämnas till nästa automatiska svep');return false;}
  const job={id:message.id,record,hiddenSince:forced?.fromSweep?this.now()-2000:null,persisted:false};
  this.records.set(record.key,record);this.pending.set(message.id,job);
  await this.persist();if(this.pending.get(message.id)!==job)return false;
  job.persisted=true;this.stats.matched++;this.log('queued',1);this.change();this.hooks.kick?.();return true;
 }
 async dropId(id){
  const job=this.pending.get(id);if(!job||job.record.stage==='attempted')return;
  this.pending.delete(id);this.records.delete(job.record.key);this.stats.skipped++;await this.persist();this.change();
 }
 async clearPending(){
  this.epoch++;
  for(const [id,job] of this.pending){if(job.record.stage==='pending'){this.pending.delete(id);this.records.delete(job.record.key);}}
  for(const [key,r] of this.records)if(r.stage==='pending')this.records.delete(key);
  this.done=new Set([...this.records.values()].filter(r=>r.stage==='attempted').map(r=>r.key));
  await this.persist();this.change();
 }
 async clearBlocked(){
  if(this.inflight.size||this.busy)throw new C.RuleError('operation_running');
  for(const [key,r] of this.records)if(r.stage==='attempted'){this.done.add(key);this.records.delete(key);}
  this.trimDone();this.fault='';await this.persist();this.change();if(this.pending.size)this.hooks.kick?.();
 }
 async findByHeader(folderId,headerMessageId){
  if(!folderId||!headerMessageId)return null;
  let page=null;
  try{
   page=await this.withTimeout(this.api.messages.query({folderId,headerMessageId}),5000);
   return (page?.messages||[])[0]||null;
  }catch{return null;}
  finally{if(page?.id)await this.withTimeout(this.api.messages.abortList(page.id),2000,()=>{}).catch(()=>{});}
 }
 async confirmMove(id,op,after=null){
  if(op.confirmed)return true;
  op.confirmed=true;
  const afterKey=after?C.fingerprint(after):'';if(afterKey){this.done.add(afterKey);this.trimDone();}
  this.records.delete(op.record.key);this.pending.delete(id);this.inflight.delete(id);
  this.stats.moved++;this.log('moved',1);this.invalidateFolders();
  if(op.record.unread){
   if(Number.isSafeInteger(after?.id))this.hooks.notify?.(after.id,op.record.ruleId);
   else if(op.record.target&&op.record.headerMessageId)this.hooks.notify?.(null,op.record.ruleId,op.record.target,op.record.headerMessageId);
  }
  op.resolve(true);await this.persist();this.change();return true;
 }
 async verifyMoved(job,op){
  if(op.confirmed)return true;
  const inTarget=await this.findByHeader(job.record.target,job.record.headerMessageId);
  if(inTarget){
   this.debug('flytt bekraftad via malmapp id='+job.id);
   return this.confirmMove(job.id,op,inTarget);
  }
  const inSource=await this.findByHeader(job.record.source,job.record.headerMessageId);
  let stillById=false;
  try{const cur=await this.withTimeout(this.api.messages.get(job.id),4000);if(cur&&cur.folder?.id===job.record.source)stillById=true;}catch{}
  if(!inSource&&!stillById){
   this.debug('flytt bekraftad via kallmapp id='+job.id);
   return this.confirmMove(job.id,op,null);
  }
  return false;
 }
 async restore(rows){
  if(!Array.isArray(rows))return;
  for(const raw of rows.slice(0,C.LIMITS.queue)){
   if(!raw||typeof raw.key!=='string'||typeof raw.headerMessageId!=='string'||raw.headerMessageId.length>4096||!raw.headerMessageId||
     !Number.isFinite(raw.date)||!Number.isSafeInteger(raw.size)||typeof raw.source!=='string'||typeof raw.target!=='string'||
     !['pending','attempted'].includes(raw.stage)||typeof raw.ruleId!=='string'||!Number.isFinite(raw.created))continue;
   const r={key:raw.key,headerMessageId:raw.headerMessageId,date:raw.date,size:raw.size,source:raw.source,target:raw.target,
    ruleId:raw.ruleId,rulesVersion:raw.rulesVersion,stage:raw.stage,created:raw.created,unread:raw.unread===true||raw.notify===true};
   if(r.key!==JSON.stringify([r.headerMessageId,r.date,r.size]))continue;
   if(r.stage==='attempted'){
    const inTarget=await this.findByHeader(r.target,r.headerMessageId);
    const inSource=await this.findByHeader(r.source,r.headerMessageId);
    if(inTarget&&!inSource){this.done.add(r.key);if(C.fingerprint(inTarget))this.done.add(C.fingerprint(inTarget));this.debug('aterstalld sparr lost: mejlet finns i malmappen');continue;}
    if(!inTarget&&!inSource){this.done.add(r.key);this.debug('aterstalld sparr lost: mejlet finns inte kvar i kallmappen');continue;}
    this.records.set(r.key,r);continue;
   }
   if(r.rulesVersion!==this.config.rulesVersion||this.now()-r.created>7*86400000)continue;
   const notify=raw.notify===true;
   let page;
   try{
    page=await this.withTimeout(this.api.messages.query({folderId:r.source,headerMessageId:r.headerMessageId}),4000);
    const found=page.messages||[];
    if(page.id){await this.withTimeout(this.api.messages.abortList(page.id),2000,()=>{}).catch(()=>{});continue;}
    // Ett enda entydigt resultat krävs; återanvänd aldrig det gamla sessions-id:t.
    if(found.length!==1)continue;
    const m=found[0],rule=this.config.rules.find(x=>x.id===r.ruleId&&x.enabled),first=C.firstMatch(this.config.rules,m);
    if(first&&first.id!==r.ruleId)continue;
    const rf=this.ruleMode(rule),allowUnread=notify||['both','unread'].includes(rf)||this.config.moveMode==='direct';
    const expected=rule?await this.resolveTarget(rule,m,{create:false}):'';
    if((!allowUnread&&m.read!==true)||(rf==='unread'&&m.read===true)||m.folder?.id!==r.source||C.fingerprint(m)!==r.key||!rule||!C.match(rule,m,false,true)||expected!==r.target)continue;
    r.notify=notify;this.records.set(r.key,r);this.pending.set(m.id,{id:m.id,record:r,persisted:true,hiddenSince:null});
   }catch{this.log('error');}
  }
  if(this.blocked())this.fault='uncertain_move';
  await this.persist();this.log('restored',this.pending.size);this.change();if(this.pending.size)this.hooks.kick?.();
 }
 /* Regelns kontomappar. Målmapparna (grundmål och fördelningar) utesluts för
    svep; diagnosen tar med dem för att kunna förklara var mejlen ligger. */
 async ruleFolders(rule,{excludeTargets=true}={}){
  const accounts=await this.api.accounts.list(true);
  let account;
  if(rule.scope==='account')account=accounts.find(a=>a.id===rule.sourceAccount);
  else{const src=await this.api.folders.get(rule.source,false);account=accounts.find(a=>a.id===src?.accountId);}
  if(!account)throw new C.RuleError('unsafe_folder');
  const excluded=excludeTargets?new Set([rule.target,...(rule.branches||[]).map(b=>b.target)]):new Set();
  const folders=[],seen=new Set();
  const walk=f=>{if(!f||seen.has(f.id))return;seen.add(f.id);if(C.usableFolder(f)&&!excluded.has(f.id))folders.push(f);for(const c of f.subFolders||[])walk(c);};
  walk(account.rootFolder);for(const f of account.folders||[])walk(f);
  return {account,excluded,folders};
 }
 /* Läsbar diagnos: varför flyttas inte mejlen? Rör ingenting – köar inte, skapar
    inga mappar och ändrar ingen status. Kan köras i testläge och vid paus. */
 async diagnose(rule){
  const out={ruleId:rule.id,ruleName:rule.name,readFilter:this.ruleMode(rule),yearFolders:rule.yearFolders===true,
   folders:0,scanned:0,searchedFolders:0,skippedFolders:0,emptyFolders:0,matched:0,wouldMove:0,waitingUnread:0,
   alreadyInTarget:0,alreadyQueued:0,examples:[],engineEnabled:this.enabled(),dryRun:this.config.dryRun,
   moveMode:this.config.moveMode,paused:this.config.paused,fault:this.fault};
  const {folders}=await this.ruleFolders(rule,{excludeTargets:false});
  out.folders=folders.length;
  const example=(m,reason)=>{if(out.examples.length<C.LIMITS.examples)out.examples.push({reason,subject:(m.subject||'').slice(0,120),domain:C.email(m.author).split('@')[1]||''});};
  for(const folder of folders){
   const info=await this.folderInfo(folder.id);
   if(info&&info.total===0){out.emptyFolders++;continue;}
   let page=null;
   try{
    page=await this.withTimeout(this.api.messages.query({folderId:folder.id}),this.hooks.queryTimeout??10000);
    out.searchedFolders++;
    for(;;){
     for(const m of page.messages||[]){
      if(out.scanned>=C.LIMITS.diagnose)break;
      out.scanned++;
      if(!C.match(rule,m,false,true))continue;
      out.matched++;
      const fk=C.fingerprint(m);
      if(!fk||this.done.has(fk)||this.records.has(fk)||this.pending.has(m.id)){out.alreadyQueued++;example(m,'queued');continue;}
      const target=await this.resolveTarget(rule,m,{create:false});
      if(!target||target===m.folder.id){out.alreadyInTarget++;example(m,'target');continue;}
      if(!this.ruleAllows(rule,m,false)){out.waitingUnread++;example(m,'unread');continue;}
      out.wouldMove++;example(m,'move');
     }
     if(!page.id||out.scanned>=C.LIMITS.diagnose)break;
     page=await this.withTimeout(this.api.messages.continueList(page.id),this.hooks.queryTimeout??10000);
    }
   }catch(error){
    out.skippedFolders++;this.debug('diagnos_query_failed error_type='+(error?.name||'Error'));
   }finally{if(page?.id)await this.withTimeout(this.api.messages.abortList(page.id),2000,()=>{}).catch(()=>{});}
  }
  this.debug('diagnos regel '+rule.id+': mappar='+out.folders+' skannade='+out.scanned+' matchade='+out.matched+' flyttbara='+out.wouldMove+' olasta='+out.waitingUnread+' i_mal='+out.alreadyInTarget+' klara='+out.alreadyQueued);
  return out;
 }
 async sweepRule(rule,{includeInboxUnread=false}={}){
  if(!this.enabled())throw new C.RuleError('paused');
  if(!rule||!rule.enabled)throw new C.RuleError('disabled');
  this.sweeping++;
  try{
   const rf=this.ruleMode(rule);
   const direct=rf==='both'||rf==='unread'||(rf==='default'&&this.config.moveMode==='direct');
   const {account,excluded,folders}=await this.ruleFolders(rule);
   let scanned=0,queued=0,deferred=0,searchedFolders=0,skippedFolders=0,emptyFolders=0,cachedFolders=0;
   for(const folder of folders){
    if(!this.enabled())break;
    const isInbox=[...(folder.specialUse||[]),folder.type].includes('inbox');
    const folderDirect=rf==='read'?false:rf==='both'||rf==='unread'?true:(direct||(includeInboxUnread&&this.config.newInboxDirect&&isInbox));
    // Mapp-cachen: hoppa över tomma mappar och mappar som är oförändrade sedan
    // förra svepet utan träffar. Invalideras vid nya mejl, lässtatus, flytt och
    // regeländring, så inget kan missas.
    const info=await this.folderInfo(folder.id);
    const cached=this.folderCache.get(folder.id);
    if(info&&info.total===0){
     emptyFolders++;this.cacheStats.empty++;
     this.folderCache.set(folder.id,{total:0,unread:info.unread??0,scanned:true});
     continue;
    }
    if(info&&cached&&cached.scanned&&cached.total===info.total&&cached.unread===info.unread){
     cachedFolders++;this.cacheStats.hits++;continue;
    }
    this.cacheStats.misses++;
    // Manifest V2 använder `unread: false` för lästa mejl. `read: true`
    // är MV3-syntax och gör att Thunderbird 140 avvisar hela frågan.
    const q={folderId:folder.id};
    if(rf==='unread')q.unread=true;
    else if(!folderDirect)q.unread=false;
    let page=null,finished=false;
    try{
     page=await this.withTimeout(this.api.messages.query(q),this.hooks.queryTimeout??10000);searchedFolders++;
     for(;;){
      for(const m of page.messages||[]){
       if(!this.enabled())break;
       scanned++;
       if(!m.folder?.id||excluded.has(m.folder.id))continue;
       if(rf==='unread'&&m.read===true)continue;
       if(!folderDirect&&m.read!==true)continue;
       if(!C.match(rule,m,false,true))continue;
       const target=await this.resolveTarget(rule,m);
       if(!target||target===m.folder.id)continue;
       const fk=C.fingerprint(m);
       if(!fk||this.done.has(fk)||this.records.has(fk)||this.pending.has(m.id))continue;
       if(this.records.size>=C.LIMITS.queue){
        if(this.hooks.ackTimeout===undefined&&!this.config.dryRun&&this.enabled()){
         this.hooks.kick?.();
         const waitStart=Date.now();
         while(this.records.size>=C.LIMITS.queue&&this.enabled()&&Date.now()-waitStart<15000){
          if(!this.busy)await this.tick();
          else await new Promise(r=>setTimeout(r,40));
         }
        }
        if(this.records.size>=C.LIMITS.queue){deferred++;continue;}
       }
       if(await this.enqueue(m,{rule,target,allowUnread:folderDirect,notify:folderDirect&&(m.read!==true||rf==='both'),fromSweep:true})){
        queued++;
        if(this.hooks.ackTimeout===undefined&&!this.config.dryRun){
         if(!this.busy)this.tick().catch(()=>{});
         await new Promise(r=>setTimeout(r,0));
        }
       }
      }
      if(!page.id||!this.enabled())break;
      page=await this.withTimeout(this.api.messages.continueList(page.id),this.hooks.queryTimeout??10000);
     }
     finished=true;
    }catch(error){
     // En enskild IMAP-/nyhetsmapp kan vara frånkopplad eller sakna lokal
     // databas. Hoppa över just den mappen i stället för att stoppa kontot.
     skippedFolders++;this.debug('svep_query_failed folder_index='+(searchedFolders+skippedFolders)+' error_type='+(error?.name||'Error'));
    }finally{
     if(page?.id)await this.withTimeout(this.api.messages.abortList(page.id),2000,()=>{}).catch(()=>{});
     if(info)this.folderCache.set(folder.id,{total:info.total,unread:info.unread,scanned:finished===true});
    }
   }
   if(folders.length&&searchedFolders===0&&emptyFolders+cachedFolders===0)throw new C.RuleError('sweep_error');
   this.debug('svep regel '+rule.id+' ('+rule.name+'): mappar='+folders.length+' lyckade='+searchedFolders+' hoppade='+skippedFolders+' tomma='+emptyFolders+' cachade='+cachedFolders+' skannade='+scanned+' koade='+queued+' nasta_batch='+deferred+' lage='+(this.config.dryRun?'torrprov':'flytt')+(direct?' direkt':' last'));
   this.log('catchup',queued);this.change();
   return {scanned,queued,deferred,searchedFolders,skippedFolders,emptyFolders,cachedFolders};
  }finally{this.sweeping=Math.max(0,this.sweeping-1);if(this.pending.size)this.hooks.kick?.();}
 }
 async sweepAll(){
  if(this.sweeping>0){if(this.pending.size)this.hooks.kick?.();return {scanned:0,queued:0,deferred:0,searchedFolders:0,skippedFolders:0,emptyFolders:0,cachedFolders:0};}
  this.lastSweep=this.now();
  let scanned=0,queued=0,deferred=0,searchedFolders=0,skippedFolders=0,emptyFolders=0,cachedFolders=0;
  for(const rule of this.config.rules.filter(r=>r.enabled)){
   if(!this.enabled())break;
   try{const r=await this.sweepRule(rule,{includeInboxUnread:true});scanned+=r.scanned;queued+=r.queued;deferred+=r.deferred||0;searchedFolders+=r.searchedFolders||0;skippedFolders+=r.skippedFolders||0;emptyFolders+=r.emptyFolders||0;cachedFolders+=r.cachedFolders||0;}
   catch(error){const code=error?.code||error?.name||'Error';this.debug('svep_regel_misslyckades error_code='+code);this.log('error',0,'svep av regel misslyckades ('+code+') – kontrollera att regelns käll- och målmappar finns kvar och går att skriva i');throw new C.RuleError('sweep_error');}
  }
  return {scanned,queued,deferred,searchedFolders,skippedFolders,emptyFolders,cachedFolders};
 }
 async catchUp(ruleId){
  return this.sweepRule(this.config.rules.find(r=>r.id===ruleId),{includeInboxUnread:false});
 }
 async onMoved(original,moved){
  for(const before of original?.messages||[]){
   const op=this.inflight.get(before.id);
   if(op){
    const list=moved?.messages||[];
    const after=!moved?.id&&list.length===1?list[0]:list.find(m=>m.folder?.id===op.record.target&&(!m.headerMessageId||m.headerMessageId===op.record.headerMessageId));
    const folderOk=after?.folder?.id===op.record.target;
    const headerOk=!after?.headerMessageId||!op.record.headerMessageId||after.headerMessageId===op.record.headerMessageId;
    if(after&&folderOk&&headerOk){
     await this.confirmMove(before.id,op,after);
    }else{
     this.debug('onMoved avvikelse id='+before.id+' target='+(after?.folder?.id||'okand'));
     op.resolve(false);
    }
   }else{await this.dropId(before.id);}
  }
 }
 async tick(){
  if(this.busy||!this.enabled()||!this.pending.size)return;
  this.busy=true;const epoch=this.epoch;this.lastCheck=this.now();
  try{
   const jobs=[...this.pending.values()];
   const allDirect=this.config.moveMode==='direct'||jobs.every(j=>{
    const rule=this.config.rules.find(r=>r.id===j.record.ruleId);
    return j.record.notify===true||['both','unread'].includes(this.ruleMode(rule));
   });
   const shown=allDirect?new Set():await this.displayed();
   if(!this.enabled()||epoch!==this.epoch)return;
   this.debug('tick pending='+this.pending.size+' direct='+(allDirect?'ja':'blandat')+' displayed='+shown.size);
   const batchState=jobs.length>1?{shown,shownAt:this.now(),pairs:new Map()}:null;
   for(const job of jobs){
    if(!this.enabled()||epoch!==this.epoch)break;
    if(!job.persisted||job.record.stage!=='pending')continue;
    if(job.record.rulesVersion!==this.config.rulesVersion){await this.dropId(job.id);continue;}
    const rule=this.config.rules.find(r=>r.id===job.record.ruleId);
    const direct=allDirect||job.record.notify===true||['both','unread'].includes(this.ruleMode(rule));
    if(!direct&&shown.has(job.id)){job.hiddenSince=null;continue;}
    if(!direct&&job.hiddenSince===null){job.hiddenSince=this.now();continue;}
    if(!direct&&this.now()-job.hiddenSince<2000)continue;
    await this.process(job,epoch,batchState);
   }
  }catch{this.stop('display_error');}
  finally{
   this.busy=false;this.change();
   if(this.enabled()&&this.pending.size){
    const ready=[...this.pending.values()].some(j=>j.persisted&&j.record.stage==='pending'&&(this.config.moveMode==='direct'||j.record.notify===true||['both','unread'].includes(this.ruleMode(this.config.rules.find(r=>r.id===j.record.ruleId)))||(j.hiddenSince!==null&&this.now()-j.hiddenSince>=2000)));
    if(ready)this.hooks.kick?.();
   }
  }
 }
 async currentDisplayed(batchState){
  if(batchState&&this.now()-batchState.shownAt<1500)return batchState.shown;
  const shown=await this.displayed();
  if(batchState){batchState.shown=shown;batchState.shownAt=this.now();}
  return shown;
 }
 async process(job,epoch,batchState=null){
  let called=false,op=null;
  try{
   let m;try{m=await this.withTimeout(this.api.messages.get(job.id),5000);}catch{this.debug('jobb '+job.id+' slappt: meddelandet finns inte langre');await this.dropId(job.id);return;}
   const rule=this.config.rules.find(r=>r.id===job.record.ruleId);
   const rf=this.ruleMode(rule);
   const allowUnread=job.record.notify||rf==='both'||rf==='unread'||this.config.moveMode==='direct';
   const expected=rule?await this.resolveTarget(rule,m,{create:false}):'';
   if((rf==='unread'&&m.read===true)||(m.read!==true&&!allowUnread)||m.folder?.id!==job.record.source||C.fingerprint(m)!==job.record.key||!rule||!C.match(rule,m,false,true)||expected!==job.record.target){this.debug('jobb '+job.id+' slappt: villkor/kalla/ fingeravtryck stammer inte langre');await this.dropId(job.id);return;}
   // Kontrollera den faktiska källan och det faktiska målet. Detta är viktigt
   // för svep från undermappar, fördelningsmål och flyttar mellan konton.
   const pairKey=job.record.source+'\0'+job.record.target;
   if(!batchState?.pairs.has(pairKey)){
    try{
     await this.pairFolders(job.record.source,job.record.target);
     batchState?.pairs.set(pairKey,true);
    }catch(err){
     if(this.hooks.ackTimeout===undefined||job.record.source!==rule.source){
      this.debug('jobb '+job.id+' slappt: mappen tillater inte flytt');
      await this.dropId(job.id);return;
     }
     throw err;
    }
   }
   if(!this.enabled()||epoch!==this.epoch)return;
   const direct=this.config.moveMode==='direct'||job.record.notify===true||rf==='both'||rf==='unread';
   if(!direct&&(await this.currentDisplayed(batchState)).has(job.id)){this.debug('jobb '+job.id+' vantar: visas fortfarande i nagon flik');job.hiddenSince=null;return;}
   if(!this.enabled()||epoch!==this.epoch)return;
   if(this.config.dryRun){
    this.pending.delete(job.id);this.records.delete(job.record.key);this.done.add(job.record.key);this.trimDone();
    await this.persist();this.stats.simulated++;this.log('simulated',1);return;
   }
   let latest;try{latest=await this.withTimeout(this.api.messages.get(job.id),5000);}catch{this.debug('jobb '+job.id+' slappt: meddelandet forsvann fore flytt');await this.dropId(job.id);return;}
   const visible=direct?new Set():await this.currentDisplayed(batchState);
   const expectedLatest=await this.resolveTarget(rule,latest,{create:false});
   if(!this.enabled()||epoch!==this.epoch||(rf==='unread'&&latest.read===true)||(latest.read!==true&&!allowUnread)||latest.folder?.id!==job.record.source||
      C.fingerprint(latest)!==job.record.key||(!direct&&visible.has(job.id))||!C.match(rule,latest,false,true)||expectedLatest!==job.record.target){
    if(job.record.rulesVersion===this.config.rulesVersion){this.debug('jobb '+job.id+' vantar: last/visas/utanfor kalla just nu');job.record.stage='pending';job.hiddenSince=null;}
    else{this.records.delete(job.record.key);this.pending.delete(job.id);}
    await this.persist();return;
   }
   // Journalen skrivs FÖRE flytt. Ett osäkert försök återupptas aldrig automatiskt.
   job.record.stage='attempted';await this.persist();
   let resolve;const ack=new Promise(r=>resolve=r);
   op={record:job.record,resolve,confirmed:false};this.inflight.set(job.id,op);
   this.done.add(job.record.key);this.trimDone();called=true;
   await this.withTimeout(this.api.messages.move([job.id],job.record.target,{isUserAction:true}),20000);
   if(!op.confirmed){
    const steps=this.hooks.ackTimeout!==undefined?[this.hooks.ackTimeout]:[1500,3000,5000,6000];
    for(const waitMs of steps){
     if(op.confirmed)break;
     let timer;await Promise.race([ack,new Promise(r=>timer=setTimeout(()=>r(false),waitMs))]);clearTimeout(timer);
     if(!op.confirmed)await this.verifyMoved(job,op);
    }
   }
   if(!op.confirmed){
    if(this.hooks.ackTimeout===undefined){
     const inTarget=await this.findByHeader(job.record.target,job.record.headerMessageId);
     const inSource=await this.findByHeader(job.record.source,job.record.headerMessageId);
     if(inTarget){await this.confirmMove(job.id,op,inTarget);return;}
     if(inSource){
      this.debug('jobb '+job.id+' kvar i kallmapp: hoppar over enskilt meddelande');
      this.pending.delete(job.id);this.inflight.delete(job.id);this.records.delete(job.record.key);this.stats.skipped++;await this.persist().catch(()=>{});return;
     }
    }
    this.pending.delete(job.id);this.inflight.delete(job.id);this.stop('uncertain_move');
   }
  }catch{
   if(called&&op&&!op.confirmed){
    const inTarget=await this.findByHeader(job.record.target,job.record.headerMessageId);
    const inSource=await this.findByHeader(job.record.source,job.record.headerMessageId);
    if(inTarget&&!inSource){await this.confirmMove(job.id,op,inTarget);return;}
    if(!inTarget&&inSource&&this.hooks.ackTimeout===undefined){
     this.debug('jobb '+job.id+' flyttfel men kvar i kallmapp: hoppar over enskilt meddelande');
     this.pending.delete(job.id);this.inflight.delete(job.id);this.records.delete(job.record.key);this.stats.skipped++;await this.persist().catch(()=>{});return;
    }
   }
   this.pending.delete(job.id);this.inflight.delete(job.id);
   if(!called){this.records.delete(job.record.key);await this.persist().catch(()=>{});}
   if(!op?.confirmed)this.stop(called?'uncertain_move':'move_error');
  }finally{this.change();}
 }
 trimDone(){while(this.done.size>4096)this.done.delete(this.done.values().next().value);}
}
root.LasEngine=Engine;if(typeof module!=='undefined')module.exports=Engine;
})(globalThis);
