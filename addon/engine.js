/* Händelsestyrd motor. Flyttar en i taget, aldrig genom musklick. */
(function(root){
'use strict';
const C=root.LasCore||(typeof require!=='undefined'?require('./core.js'):null);
class Engine {
 constructor(api,config,hooks={}){
  this.api=api;this.config=config;this.hooks=hooks;this.now=hooks.now||Date.now;
  this.pending=new Map();this.records=new Map();this.inflight=new Map();this.done=new Set();
  this.busy=false;this.hold=false;this.fault='';this.epoch=0;
  this.stats={checks:0,matched:0,moved:0,simulated:0,skipped:0};this.lastCheck=null;
 }
 log(name,count=0,detail=''){this.hooks.log?.(name,count,detail);}
 debug(t){this.hooks.debug?.(t);}
 change(){this.hooks.change?.();}
 async persist(){try{await this.hooks.persist?.();}catch{this.stop('storage_error');throw new C.RuleError('storage_error');}}
 stop(code){this.fault=code;this.epoch++;this.log('error',0,'motor_stoppad code='+code);this.debug('motorn stoppad: '+code);this.change();}
 enabled(){return !this.config.paused&&!this.fault&&!this.hold;}
 recordList(){return [...this.records.values()].map(r=>({...r}));}
 blocked(){const active=new Set([...this.pending.values()].map(j=>j.record.key));return [...this.records.values()].filter(r=>r.stage==='attempted'&&!active.has(r.key)).length;}
 async displayed(){
  const ids=new Set(),tabs=await this.api.tabs.query({});
  for(const tab of tabs){
   if(!['mail','messageDisplay'].includes(tab.type))continue;
   try{
    const messages=await this.api.messageDisplay.getDisplayedMessages(tab.id);
    if(!Array.isArray(messages))throw new C.RuleError('display_error');
    for(const m of messages)ids.add(m.id);
   }catch(error){
    // En flik kan ha stängts mellan listning och kontroll. Bara en bekräftat
    // försvunnen flik får ignoreras; övriga fel stoppar bevakningen.
    const current=await this.api.tabs.query({});
    if(current.some(t=>t.id===tab.id))throw error;
   }
  }return ids;
 }
 async pair(rule){return this.pairFolders(rule.source,rule.target);}
 async pairFolders(sourceId,targetId){
  const [source,target]=await Promise.all([this.api.folders.get(sourceId,false),this.api.folders.get(targetId,false)]);
  const [sc,tc]=await Promise.all([this.api.folders.getFolderCapabilities(sourceId),this.api.folders.getFolderCapabilities(targetId)]);
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
 async newInboxMessages(messages){
  if(!this.enabled()||!this.config.newInboxDirect)return 0;
  let queued=0;
  for(const m of messages||[]){
   const rule=C.firstMatch(this.config.rules,m);if(!rule)continue;
   if(await this.enqueue(m,{rule,target:C.targetFor(rule,m),allowUnread:true,notify:true}))queued++;
  }
  this.debug('nyinkommet inkorg antal='+(messages?.length||0)+' koade='+queued);return queued;
 }
 async readChanged(m,changed,old={}){
  if(changed.read===false){await this.dropId(m.id);return false;}
  if(changed.read!==true||old.read===true||!this.enabled())return false;
  return this.enqueue(m);
 }
 async enqueue(message,forced=null){
  if(!this.enabled()||!message||(message.read!==true&&!forced?.allowUnread)||!Number.isSafeInteger(message.id)||!message.folder?.id){this.debug('kö avvisad id='+(message?.id??'-')+' pausad='+(this.config.paused?'ja':'nej')+' torrprov='+(this.config.dryRun?'ja':'nej')+' last='+(message?.read?'ja':'nej'));return false;}
  this.stats.checks++;
  const rule=forced?forced.rule:C.firstMatch(this.config.rules,message);if(!rule){this.debug('kö avvisad id='+message.id+' ingen regel matchar avsendar doman='+((C.email(message.author)||'').split('@')[1]||'okand'));return false;}
  const record=this.makeRecord(message,rule,forced?forced.target:C.targetFor(rule,message),forced?message.folder.id:null,forced?.notify);
  if(!record){this.log('skipped',1);this.debug('kö avvisad id='+message.id+' saknar fingeravtryck (Message-ID/datum/storlek)');return false;}
  if(this.done.has(record.key)||this.records.has(record.key)||this.pending.has(message.id)){this.debug('kö avvisad id='+message.id+' redan hanterad eller köad');return false;}
  if(this.records.size>=C.LIMITS.queue){this.debug('kö full: meddelandet lämnas till nästa automatiska svep');return false;}
  const job={id:message.id,record,hiddenSince:null,persisted:false};
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
  for(const [key,r] of this.records)if(r.stage==='attempted')this.records.delete(key);
  this.fault='';await this.persist();this.change();
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
   if(r.stage==='attempted'){this.records.set(r.key,r);continue;}
   if(r.rulesVersion!==this.config.rulesVersion||this.now()-r.created>7*86400000)continue;
   const notify=raw.notify===true;
   let page;
   try{
    page=await this.api.messages.query({folderId:r.source,headerMessageId:r.headerMessageId});
    const found=page.messages||[];
    if(page.id){await this.api.messages.abortList(page.id);continue;}
    // Ett enda entydigt resultat krävs; återanvänd aldrig det gamla sessions-id:t.
    if(found.length!==1)continue;
    const m=found[0],rule=C.firstMatch(this.config.rules,m);
    if(m.read!==true||m.folder?.id!==r.source||C.fingerprint(m)!==r.key||rule?.id!==r.ruleId||C.targetFor(rule,m)!==r.target)continue;
    r.notify=notify;this.records.set(r.key,r);this.pending.set(m.id,{id:m.id,record:r,persisted:true,hiddenSince:null});
   }catch{this.log('error');}
  }
  if(this.blocked())this.fault='uncertain_move';
  await this.persist();this.log('restored',this.pending.size);this.change();
 }
 async sweepRule(rule){
  if(!this.enabled())throw new C.RuleError('paused');
  if(!rule||!rule.enabled)throw new C.RuleError('disabled');
  const direct=this.config.moveMode==='direct';
  const accounts=await this.api.accounts.list(true);
  let account;
  if(rule.scope==='account')account=accounts.find(a=>a.id===rule.sourceAccount);
  else{const src=await this.api.folders.get(rule.source,false);account=accounts.find(a=>a.id===src?.accountId);}
  if(!account)throw new C.RuleError('unsafe_folder');
  const excluded=new Set([rule.target,...(rule.branches||[]).map(b=>b.target)]);
  const folders=[];
  const walk=f=>{if(!f)return;if(C.usableFolder(f)&&!excluded.has(f.id))folders.push(f);for(const c of f.subFolders||[])walk(c);};
  walk(account.rootFolder);for(const f of account.folders||[])walk(f);
  let scanned=0,queued=0,deferred=0,searchedFolders=0,skippedFolders=0;
  for(const folder of folders){
   // Manifest V2 använder `unread: false` för lästa mejl. `read: true`
   // är MV3-syntax och gör att Thunderbird 140 avvisar hela frågan.
   const q={folderId:folder.id};if(!direct)q.unread=false;
   let page=null;
   try{
    page=await this.api.messages.query(q);searchedFolders++;
    for(;;){
     for(const m of page.messages||[]){
      scanned++;
      if(!m.folder?.id||excluded.has(m.folder.id))continue;
      if(!direct&&m.read!==true)continue;
      if(!C.match(rule,m,false,true))continue;
      if(this.records.size>=C.LIMITS.queue){deferred++;continue;}
      if(await this.enqueue(m,{rule,target:C.targetFor(rule,m),allowUnread:direct,notify:direct&&m.read!==true}))queued++;
     }
     if(!page.id)break;
     page=await this.api.messages.continueList(page.id);
    }
   }catch(error){
    // En enskild IMAP-/nyhetsmapp kan vara frånkopplad eller sakna lokal
    // databas. Hoppa över just den mappen i stället för att stoppa kontot.
    skippedFolders++;this.debug('svep_query_failed folder_index='+(searchedFolders+skippedFolders)+' error_type='+(error?.name||'Error'));
   }finally{if(page?.id)await this.api.messages.abortList(page.id).catch(()=>{});}
  }
  if(folders.length&&searchedFolders===0)throw new C.RuleError('sweep_error');
  this.debug('svep regel '+rule.id+' ('+rule.name+'): mappar='+folders.length+' lyckade='+searchedFolders+' hoppade='+skippedFolders+' skannade='+scanned+' koade='+queued+' nasta_batch='+deferred+' lage='+(this.config.dryRun?'torrprov':'flytt')+(direct?' direkt':' last'));
  this.log('catchup',queued);this.change();
  return {scanned,queued,deferred,searchedFolders,skippedFolders};
 }
 async sweepAll(){
  let scanned=0,queued=0,deferred=0,searchedFolders=0,skippedFolders=0;
  for(const rule of this.config.rules.filter(r=>r.enabled)){
   if(!this.enabled())break;
   try{const r=await this.sweepRule(rule);scanned+=r.scanned;queued+=r.queued;deferred+=r.deferred||0;searchedFolders+=r.searchedFolders||0;skippedFolders+=r.skippedFolders||0;}
   catch(error){this.debug('svep_regel_misslyckades error_code='+(error?.code||error?.name||'Error'));this.log('error',0,'svep_misslyckades code='+(error?.code||error?.name||'Error'));throw new C.RuleError('sweep_error');}
  }
  return {scanned,queued,deferred,searchedFolders,skippedFolders};
 }
 async catchUp(ruleId){
  return this.sweepRule(this.config.rules.find(r=>r.id===ruleId));
 }
 async onMoved(original,moved){
  for(const before of original?.messages||[]){
   const op=this.inflight.get(before.id);
   if(op){
    if(!moved?.id&&(moved?.messages||[]).length===1&&moved.messages[0].folder?.id===op.record.target&&C.fingerprint(moved.messages[0])===op.record.key){
     op.confirmed=true;this.records.delete(op.record.key);this.pending.delete(before.id);this.inflight.delete(before.id);
     this.stats.moved++;this.log('moved',1);
     if(op.record.unread)this.hooks.notify?.(moved.messages[0].id);
     op.resolve(true);await this.persist();this.change();
    }else{op.resolve(false);this.stop('uncertain_move');}
   }else{await this.dropId(before.id);}
  }
 }
 async tick(){
  if(this.busy||!this.enabled()||!this.pending.size)return;
  this.busy=true;const epoch=this.epoch;this.lastCheck=this.now();
  try{
   const allDirect=this.config.moveMode==='direct',shown=allDirect?new Set():await this.displayed();
   if(!this.enabled()||epoch!==this.epoch)return;
   this.debug('tick pending='+this.pending.size+' direct='+(allDirect?'ja':'blandat')+' displayed='+shown.size);
   for(const job of [...this.pending.values()]){
    if(!this.enabled()||epoch!==this.epoch)break;
    if(!job.persisted||job.record.stage!=='pending')continue;
    if(job.record.rulesVersion!==this.config.rulesVersion){await this.dropId(job.id);continue;}
    const direct=allDirect||job.record.notify===true;
    if(!direct&&shown.has(job.id)){job.hiddenSince=null;continue;}
    if(!direct&&job.hiddenSince===null){job.hiddenSince=this.now();continue;}
    if(!direct&&this.now()-job.hiddenSince<2000)continue;
    await this.process(job,epoch);
   }
  }catch{this.stop('display_error');}
  finally{this.busy=false;this.change();}
 }
 async process(job,epoch){
  let called=false,op=null;
  try{
   const m=await this.api.messages.get(job.id),rule=this.config.rules.find(r=>r.id===job.record.ruleId);
   if((m.read!==true&&!job.record.notify)||m.folder?.id!==job.record.source||C.fingerprint(m)!==job.record.key||!rule||!C.match(rule,m,false,true)||C.targetFor(rule,m)!==job.record.target){this.debug('jobb '+job.id+' slappt: villkor/kalla/ fingeravtryck stammer inte langre');await this.dropId(job.id);return;}
   // Kontrollera den faktiska källan och det faktiska målet. Detta är viktigt
   // för svep från undermappar, fördelningsmål och flyttar mellan konton.
   await this.pairFolders(job.record.source,job.record.target);
   if(!this.enabled()||epoch!==this.epoch)return;
   const direct=this.config.moveMode==='direct'||job.record.notify===true;
   if(!direct&&(await this.displayed()).has(job.id)){this.debug('jobb '+job.id+' vantar: visas fortfarande i nagon flik');job.hiddenSince=null;return;}
   if(!this.enabled()||epoch!==this.epoch)return;
   if(this.config.dryRun){
    this.pending.delete(job.id);this.records.delete(job.record.key);this.done.add(job.record.key);this.trimDone();
    await this.persist();this.stats.simulated++;this.log('simulated',1);return;
   }
   // Journalen skrivs FÖRE flytt. Ett osäkert försök återupptas aldrig automatiskt.
   job.record.stage='attempted';await this.persist();
   const latest=await this.api.messages.get(job.id),visible=direct?new Set():await this.displayed();
   if(!this.enabled()||epoch!==this.epoch||(latest.read!==true&&!job.record.notify)||latest.folder?.id!==job.record.source||
      C.fingerprint(latest)!==job.record.key||(!direct&&visible.has(job.id))||!C.match(rule,latest,false,true)||C.targetFor(rule,latest)!==job.record.target){
    if(job.record.rulesVersion===this.config.rulesVersion){this.debug('jobb '+job.id+' vantar: last/visas/utanfor kalla just nu');job.record.stage='pending';job.hiddenSince=null;}
    else{this.records.delete(job.record.key);this.pending.delete(job.id);}
    await this.persist();return;
   }
   let resolve;const ack=new Promise(r=>resolve=r);
   op={record:job.record,resolve,confirmed:false};this.inflight.set(job.id,op);
   this.done.add(job.record.key);this.trimDone();called=true;
   await this.api.messages.move([job.id],job.record.target,{isUserAction:true});
   if(!op.confirmed){
    let timer;await Promise.race([ack,new Promise(r=>timer=setTimeout(()=>r(false),this.hooks.ackTimeout??15000))]);clearTimeout(timer);
   }
   if(!op.confirmed){this.pending.delete(job.id);this.inflight.delete(job.id);this.stop('uncertain_move');}
  }catch{
   this.pending.delete(job.id);this.inflight.delete(job.id);
   if(!called){this.records.delete(job.record.key);await this.persist().catch(()=>{});}
   if(!op?.confirmed)this.stop(called?'uncertain_move':'move_error');
  }finally{this.change();}
 }
 trimDone(){while(this.done.size>4096)this.done.delete(this.done.values().next().value);}
}
root.LasEngine=Engine;if(typeof module!=='undefined')module.exports=Engine;
})(globalThis);
