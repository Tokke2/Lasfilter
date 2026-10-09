'use strict';
const C=LasCore,B=browser;
const App={engine:null,logs:[],backups:[],prefs:{theme:'system',fontSize:14,lastRule:''},writeChain:Promise.resolve(),editChain:Promise.resolve(),mailTab:null,uiTab:null,timer:null,logTimer:null,changeTimer:null};
App.write=fn=>{const p=App.writeChain.then(fn);App.writeChain=p.catch(()=>{});return p;};
App.persistWork=()=>App.write(()=>B.storage.local.set({work:App.engine.recordList()}));
App.log=(name,count=0,detail='')=>{
 const entry=C.event(name,count,Date.now(),detail);if(!entry)return;
 App.logs=C.cleanLogs([...App.logs,entry]);
 clearTimeout(App.logTimer);App.logTimer=setTimeout(()=>App.write(()=>B.storage.local.set({logs:App.logs})).catch(()=>{}),500);
};
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
   fault:e.fault,lastCheck:e.lastCheck,moveMode:e.config.moveMode,hourly:e.config.hourly,openWindow:e.config.openWindow,
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
App.checkRules=async rules=>{for(const r of rules){await App.engine.pair(r);for(const b of r.branches||[])await App.engine.pair({...r,target:b.target});}};
App.handle=async msg=>{
 await App.ready;
 if(!msg||typeof msg.type!=='string')throw new C.RuleError('bad_request');
 const e=App.engine;
 switch(msg.type){
  case 'status':return App.snapshot();
  case 'folders':return App.folderList();
  case 'selected':{
   const m=await App.selected();return {author:m.author,subject:m.subject,read:m.read,source:m.folder?.id,email:C.email(m.author),domain:C.email(m.author).split('@')[1]||''};
  }
  case 'testRule':{
   const r=C.validateRule(msg.rule),m=await App.selected();const matches=C.match(r,m,true,true);
   let reason='no_match';
   if(matches){
    reason=!r.enabled?'disabled':m.read!==true?'unread':(await e.displayed()).has(m.id)?'displayed':'eligible';
    await e.pair(r);
   }
   App.log('simulated',1);return {matches,reason,read:m.read,subject:m.subject,author:m.author,target:C.targetFor(r,m),ruleName:r.name,outsideSource:!!(matches&&m.folder?.id!==r.source)};
  }
  case 'catchUp':return App.engine.catchUp(msg.ruleId);
  case 'sweepNow':return App.engine.sweepAll();
  case 'setOptions':return App.mutate(async()=>{
   App.checkRevision(msg.revision);
   if(!['read','direct'].includes(msg.moveMode)||typeof msg.hourly!=='boolean'||typeof msg.openWindow!=='boolean'||typeof msg.verbose!=='boolean')throw new C.RuleError('bad_schema');
   const modeChanged=msg.moveMode!==e.config.moveMode;
   const verboseChanged=msg.verbose!==e.config.verbose;
   await App.save({...e.config,moveMode:msg.moveMode,hourly:msg.hourly,openWindow:msg.openWindow,verbose:msg.verbose,revision:e.config.revision+1,rulesVersion:e.config.rulesVersion+(modeChanged?1:0)},{discard:modeChanged});
   if(msg.verbose&&verboseChanged)App.log('debug',0,'detaljlogg aktiverad: svep, trafik och avvisningar visas utan mejlinnehall');
   App.log('settings_saved');return App.snapshot();
  });
  case 'queueSelected':{
   if(!e.enabled())throw new C.RuleError('paused');
   const m=await App.selected();if(!m.read)throw new C.RuleError('unread');
   if(!C.firstMatch(e.config.rules,m))throw new C.RuleError('no_match');
   const queued=await e.enqueue(m);return {queued};
  }
  case 'saveRules':return App.mutate(async()=>{
   App.checkRevision(msg.revision);const rules=C.validateRules(msg.rules);await App.checkRules(rules);
   await App.save({...e.config,rules,revision:e.config.revision+1,rulesVersion:e.config.rulesVersion+1},{backup:true,discard:true});
   App.log('rules_saved',rules.length);return App.snapshot();
  });
  case 'setMode':return App.mutate(async()=>{
   App.checkRevision(msg.revision);
   if(typeof msg.paused!=='boolean'||typeof msg.dryRun!=='boolean')throw new C.RuleError('bad_request');
   if(e.blocked()&&!msg.paused)throw new C.RuleError('uncertain_move');
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
  case 'clearBlocked':return App.mutate(async()=>{await e.clearBlocked();await App.save({...e.config,paused:true,revision:e.config.revision+1});return App.snapshot();});
  case 'prefs':{
   const p=msg.prefs||{},next={...App.prefs};
   if(['system','light','dark'].includes(p.theme))next.theme=p.theme;
   if(Number.isInteger(p.fontSize)&&p.fontSize>=12&&p.fontSize<=18)next.fontSize=p.fontSize;
   if(typeof p.lastRule==='string'&&p.lastRule.length<=80)next.lastRule=p.lastRule;
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
 App.engine=new LasEngine(B,cfg,{persist:App.persistWork,log:App.log,change:App.changed,debug:t=>{if(App.engine.config.verbose)App.log('debug',0,t);},
  notify:id=>B.messageDisplay.open({messageId:id,location:'window'}).catch(()=>App.log('error'))});
 if(fault){App.engine.fault=fault;App.log('error');}
 else await App.engine.restore(data.work||[]);
 App.log('start');App.changed();
 App.timer=setInterval(()=>App.engine.tick().catch(()=>App.engine.stop('internal_error')),2000);
 App.sweepTimer=setInterval(()=>{if(App.engine.config.hourly)App.engine.sweepAll().catch(()=>App.engine.stop('sweep_error'));},3600000);
})().catch(()=>{
 if(!App.engine)App.engine=new LasEngine(B,C.defaults(),{persist:App.persistWork,log:App.log,change:App.changed,debug:t=>{if(App.engine.config.verbose)App.log('debug',0,t);}});
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
B.messages.onUpdated.addListener((m,props,old)=>App.ready.then(()=>App.engine.readChanged(m,props,old)).catch(()=>App.engine.stop('internal_error')));
B.messages.onMoved.addListener((old,moved)=>App.ready.then(()=>App.engine.onMoved(old,moved)).catch(()=>App.engine.stop('internal_error')));
B.messageDisplay.onMessagesDisplayed.addListener(()=>App.ready.then(()=>App.engine.tick()).catch(()=>App.engine.stop('display_error')));
B.tabs.onRemoved.addListener(id=>{if(App.uiTab===id)App.uiTab=null;if(App.mailTab===id)App.mailTab=null;App.ready.then(()=>App.engine.tick()).catch(()=>{});});
B.tabs.onActivated.addListener(({tabId})=>B.tabs.get(tabId).then(App.captureTab).catch(()=>{}));
B.mailTabs.onSelectedMessagesChanged.addListener(tab=>App.captureTab(tab));
B.commands.onCommand.addListener(cmd=>{if(cmd==='sweep')App.ready.then(()=>App.engine.sweepAll()).catch(()=>App.engine.stop('sweep_error'));});
B.folders.onFolderInfoChanged.addListener(()=>{
 if(!App.engine||App.engine.config.moveMode!=='direct')return;
 clearTimeout(App.sweepDebounce);
 App.sweepDebounce=setTimeout(()=>App.engine.sweepAll().catch(()=>App.engine.stop('sweep_error')),3000);
});
