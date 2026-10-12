'use strict';
const C=LasCore,B=browser;
const App={engine:null,logs:[],backups:[],prefs:{theme:'system',fontSize:14,lastRule:'',lang:'sv'},writeChain:Promise.resolve(),editChain:Promise.resolve(),mailTab:null,uiTab:null,timer:null,sweepTimer:null,kickTimer:null,logTimer:null,fileLogTimer:null,changeTimer:null,keepUnread:new Map()};
App.write=fn=>{const p=App.writeChain.then(fn);App.writeChain=p.catch(()=>{});return p;};
App.persistWork=()=>App.write(()=>B.storage.local.set({work:App.engine.recordList()}));
App.writeTextLog=async()=>{
 if(!App.engine?.config.fileLog)return;
 const lines=['LÄSFILTER TEKNISK LOGG','Skapad: '+new Date().toISOString(),'Version: '+B.runtime.getManifest().version,'Sekretess: inga ämnesrader, adresser eller mejltexter skrivs.',''];
 for(const x of App.logs)lines.push([x.time,x.level,x.event,'count='+x.data.count,x.data.detail||''].join('\t'));
 const url=URL.createObjectURL(new Blob([lines.join('\r\n')+'\r\n'],{type:'text/plain;charset=utf-8'}));
 try{await B.downloads.download({url,filename:'Lasfilter/lasfilter-logg.txt',saveAs:false,conflictAction:'overwrite'});}finally{setTimeout(()=>URL.revokeObjectURL(url),60000);}
};
App.scheduleTextLog=()=>{clearTimeout(App.fileLogTimer);App.fileLogTimer=setTimeout(()=>App.writeTextLog().catch(()=>{}),1200);};
App.log=(name,count=0,detail='')=>{
 const entry=C.event(name,count,Date.now(),detail);if(!entry)return;
 App.logs=C.cleanLogs([...App.logs,entry]);
 clearTimeout(App.logTimer);App.logTimer=setTimeout(()=>App.write(()=>B.storage.local.set({logs:App.logs})).catch(()=>{}),500);App.scheduleTextLog();
};
// Behåll alltid det första, mest specifika felet. Händelselyssnare ska inte
// skriva över exempelvis storage_error med det mindre hjälpsamma internal_error.
App.fail=code=>{if(App.engine&&!App.engine.fault)App.engine.stop(code);};
App.kick=()=>{if(App.kickTimer)return;App.kickTimer=setTimeout(()=>{App.kickTimer=null;App.engine?.tick().catch(()=>App.fail('internal_error'));},50);};
App.scheduleSweep=()=>{clearInterval(App.sweepTimer);if(!App.engine?.config.hourly)return;App.sweepTimer=setInterval(()=>App.engine.sweepAll().catch(()=>App.log('error',0,'intervall_svep_misslyckades')),App.engine.config.sweepMinutes*60000);};
App.changed=()=>{
 clearTimeout(App.changeTimer);App.changeTimer=setTimeout(()=>{
  const e=App.engine;if(!e)return;
  const badge=e.fault?'!':e.config.paused?'Ⅱ':e.config.dryRun?'T':'';
  B.browserAction.setBadgeText({text:badge}).catch(()=>{});
  B.browserAction.setBadgeBackgroundColor({color:e.fault?'#ac3434':e.config.dryRun?'#c28a24':'#2c776c'}).catch(()=>{});
  B.runtime.sendMessage({event:'statusChanged'}).catch(()=>{});
 },100);
};
App.folderList=async()=>{
 const accounts=await B.accounts.list(true),items=[],seen=new Set();
 function walk(f,account){
  if(f.id&&!seen.has(f.id)){seen.add(f.id);if(C.usableFolder(f))items.push({id:f.id,accountId:account.id,accountName:account.name,name:f.name,label:account.name+' · '+(f.path||f.name),specialUse:f.specialUse||[]});}
  for(const child of f.subFolders||[])walk(child,account);
 }
 for(const a of accounts){if(a.rootFolder)walk(a.rootFolder,a);else for(const f of a.folders||[])walk(f,a);}
 return items;
};
App.captureTab=async tab=>{if(tab?.type==='mail')App.mailTab=tab.id;};
App.openUnread=async(id,ruleId,targetFolderId='',headerMessageId='')=>{
 if(!Number.isSafeInteger(id)&&targetFolderId&&headerMessageId){
  await new Promise(r=>setTimeout(r,350));
  const found=await App.engine?.findByHeader(targetFolderId,headerMessageId);
  if(Number.isSafeInteger(found?.id))id=found.id;
 }
 if(!Number.isSafeInteger(id))return;
 const rule=App.engine?.config.rules.find(r=>r.id===ruleId);
 const action=rule?.unreadAction||'default';
 if(action==='read'){
  for(const delay of [150,800])setTimeout(()=>B.messages.update(id,{read:true}).catch(()=>{}),delay);
  return;
 }
 const shouldOpenWindow=action==='window'||(action==='default'&&App.engine?.config.openWindow!==false);
 App.keepUnread.set(id,Date.now()+30000);
 if(shouldOpenWindow){
  try{await B.messageDisplay.open({messageId:id,location:'window'});}catch{App.log('error',0,'oppna_olast_fonster_misslyckades');}
 }
 for(const delay of [250,1000,3000])setTimeout(()=>B.messages.update(id,{read:false}).catch(()=>App.log('error',0,'aterstall_olast_misslyckades')),delay);
 setTimeout(()=>App.keepUnread.delete(id),30000);
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
 e.config=next;e.epoch++;for(const j of e.pending.values())j.hiddenSince=null;
 App.backups=backups;App.changed();
};
App.checkRevision=rev=>{if(rev!==App.engine.config.revision)throw new C.RuleError('stale_config');};
App.checkRules=async rules=>{for(const r of rules){await App.engine.validateRuleFolders(r);for(const b of r.branches||[])await App.engine.validateRuleFolders({...r,target:b.target});}};
App.handle=async msg=>{
 await App.ready;
 if(!msg||typeof msg.type!=='string')throw new C.RuleError('bad_request');
 const e=App.engine;
 switch(msg.type){
  case 'status':return App.snapshot();
  case 'folders':return App.folderList();
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
  case 'catchUp':return App.engine.catchUp(msg.ruleId);
  case 'sweepNow':return App.engine.sweepAll();
  case 'setOptions':return App.mutate(async()=>{
   App.checkRevision(msg.revision);
   if(!['read','direct'].includes(msg.moveMode)||typeof msg.hourly!=='boolean'||!Number.isInteger(msg.sweepMinutes)||msg.sweepMinutes<15||msg.sweepMinutes>1440||msg.sweepMinutes%15||typeof msg.newInboxDirect!=='boolean'||typeof msg.openWindow!=='boolean'||typeof msg.verbose!=='boolean'||typeof msg.fileLog!=='boolean')throw new C.RuleError('bad_schema');
   const modeChanged=msg.moveMode!==e.config.moveMode;
   const verboseChanged=msg.verbose!==e.config.verbose;
   await App.save({...e.config,moveMode:msg.moveMode,hourly:msg.hourly,sweepMinutes:msg.sweepMinutes,newInboxDirect:msg.newInboxDirect,openWindow:msg.openWindow,verbose:msg.verbose,fileLog:msg.fileLog,revision:e.config.revision+1,rulesVersion:e.config.rulesVersion+(modeChanged?1:0)},{discard:modeChanged});App.scheduleSweep();
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
   App.log('rules_saved',rules.length);return App.snapshot();
  });
  case 'setMode':return App.mutate(async()=>{
   App.checkRevision(msg.revision);
   if(typeof msg.paused!=='boolean'||typeof msg.dryRun!=='boolean')throw new C.RuleError('bad_request');
   if(e.blocked()&&!msg.paused)await e.clearBlocked();
   const changing=msg.dryRun!==e.config.dryRun;
   await App.save({...e.config,paused:msg.paused,dryRun:msg.dryRun,revision:e.config.revision+1,rulesVersion:e.config.rulesVersion+(changing?1:0)},{discard:changing});
   e.fault='';App.log('settings_saved');return App.snapshot();
  });
  case 'export':return {format:'lasfilter-rules',version:1,exported:new Date().toISOString(),rules:e.config.rules};
  case 'exportLog':return {format:'lasfilter-technical-log',version:1,events:C.cleanLogs(App.logs)};
  case 'import':return App.mutate(async()=>{
   App.checkRevision(msg.revision);
   if(!msg.backup||msg.backup.format!=='lasfilter-rules'||msg.backup.version!==1)throw new C.RuleError('bad_schema');
   const rules=C.validateRules(msg.backup.rules);await App.checkRules(rules);
   await App.save({...e.config,rules,paused:true,dryRun:true,revision:e.config.revision+1,rulesVersion:e.config.rulesVersion+1},{backup:true,discard:true});
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
   await App.write(()=>B.storage.local.set({prefs:next}));App.prefs=next;return next;
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
 App.engine=new LasEngine(B,cfg,{persist:App.persistWork,log:App.log,change:App.changed,kick:App.kick,debug:t=>{if(App.engine.config.verbose||App.engine.config.fileLog)App.log('debug',0,t);},
  notify:App.openUnread});
 if(fault){App.engine.fault=fault;App.log('error');}
 else{
  const rawWork=Array.isArray(data.work)?data.work:[];
  const staleAttempted=rawWork.filter(r=>r?.stage==='attempted');
  const pendingWork=rawWork.filter(r=>r?.stage!=='attempted');
  for(const r of staleAttempted){
   if(r?.target&&r?.headerMessageId){
    const inTarget=await App.engine.findByHeader(r.target,r.headerMessageId);
    if(inTarget&&typeof r.key==='string'){App.engine.done.add(r.key);if(C.fingerprint(inTarget))App.engine.done.add(C.fingerprint(inTarget));}
   }
  }
  if(staleAttempted.length)App.log('debug',staleAttempted.length,'tidigare flyttsparr rensad vid start');
  await App.engine.restore(pendingWork);
 }
 App.log('start');App.changed();
 App.timer=setInterval(()=>App.engine.tick().catch(()=>App.fail('internal_error')),2000);App.scheduleSweep();
 if(App.engine.enabled()&&App.engine.config.hourly&&!App.engine.config.dryRun&&App.engine.config.rules.some(r=>r.enabled)){
  setTimeout(()=>{if(App.engine?.enabled()&&!App.engine.config.dryRun&&App.engine.config.rules.some(r=>r.enabled))App.engine.sweepAll().catch(()=>App.log('error',0,'startsvep_misslyckades'));},3000);
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
B.tabs.onRemoved.addListener(id=>{if(App.uiTab===id)App.uiTab=null;if(App.mailTab===id)App.mailTab=null;App.ready.then(()=>App.engine.tick()).catch(()=>{});});
B.tabs.onActivated.addListener(({tabId})=>B.tabs.get(tabId).then(App.captureTab).catch(()=>{}));
B.mailTabs.onSelectedMessagesChanged.addListener(tab=>App.captureTab(tab));
B.commands.onCommand.addListener(cmd=>{
 if(cmd==='sweep')App.ready.then(()=>App.engine.sweepAll()).catch(()=>App.log('error',0,'snabbkommando_svep_misslyckades'));
 if(cmd==='open_ui')B.tabs.query({active:true,currentWindow:true}).then(tabs=>App.open(tabs[0])).catch(()=>App.log('error',0,'oppna_granssnitt_misslyckades'));
});
B.folders.onFolderInfoChanged.addListener(()=>{
 if(!App.engine||App.engine.config.moveMode!=='direct')return;
 clearTimeout(App.sweepDebounce);
 App.sweepDebounce=setTimeout(()=>App.engine.sweepAll().catch(()=>App.log('error',0,'direkt_svep_misslyckades')),3000);
});
