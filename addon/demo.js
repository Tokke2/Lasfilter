/* Endast för uttrycklig förhandsvisning. Används aldrig som bakgrundsmotor. */
globalThis.LasDemo=(()=>{
 const folders=[{id:'demo-in',accountId:'demo',accountName:'Exempelkonto',label:'Exempelkonto · Inkorg',name:'Inkorg'},
  {id:'demo-fin',accountId:'demo',label:'Exempelkonto · Ekonomi / Fakturor',name:'Fakturor'},
  {id:'demo-web',accountId:'demo',label:'Exempelkonto · Webb',name:'Webb'},
  {id:'demo-buy',accountId:'demo',label:'Exempelkonto · Inköp',name:'Inköp'}];
 let state={config:{schema:1,revision:0,rulesVersion:0,paused:false,dryRun:true,moveMode:'read',hourly:true,sweepMinutes:60,newInboxDirect:true,openWindow:true,verbose:true,fileLog:true,rules:[
  {id:'demo-1',name:'Fortnox fakturor',enabled:true,source:'demo-in',target:'demo-fin',match:'all',conditions:[{field:'domain',op:'equals',value:'fortnox.se'}],branches:[{condition:{field:'subject',op:'contains',value:'Faktura'},target:'demo-fin'},{condition:{field:'subject',op:'contains',value:'Order'},target:'demo-buy'}]},
  {id:'demo-2',name:'Webbsupport',enabled:true,source:'demo-in',target:'demo-web',match:'all',conditions:[{field:'domain',op:'equals',value:'support.example'}]},
  {id:'demo-3',name:'Inköp & kvitton',enabled:false,source:'demo-in',target:'demo-buy',match:'all',conditions:[{field:'subject',op:'contains',value:'Kvitto'}]}]},
  prefs:{theme:'light',fontSize:14,lastRule:'demo-1'},moveMode:'read',hourly:true,sweepMinutes:60,newInboxDirect:true,openWindow:true,stats:{checks:8,matched:3,moved:0,simulated:3,skipped:0},queued:2,blocked:0,inflight:0,fault:'',lastCheck:Date.now(),backups:[],logs:[LasCore.event('start'),LasCore.event('simulated',3)]};
 const selected={author:'Demoavsändare <faktura@fortnox.se>',subject:'Faktura 1042 – fiktivt testmeddelande',read:true,source:'demo-in',sourceAccount:'demo',email:'faktura@fortnox.se',domain:'fortnox.se'};
 const snapshots=[];
 function saveRules(rules){snapshots.unshift(structuredClone(state.config));snapshots.splice(5);state.backups=snapshots.map((c,i)=>({index:i,time:new Date().toISOString(),count:c.rules.length}));state.config.rules=LasCore.validateRules(rules);state.config.revision++;}
 async function request(m){try{let data;
  switch(m.type){
   case 'status':data=state;break;case 'folders':data=folders;break;case 'selected':data=selected;break;
   case 'prefs':state.prefs={...state.prefs,...m.prefs};data=state.prefs;break;
   case 'saveRules':saveRules(m.rules);data=state;break;
   case 'testRule':{const rule=LasCore.validateRule(m.rule),matched=LasCore.match(rule,{...selected,folder:{id:selected.source}},true,true);data={matches:matched,reason:matched?(rule.enabled?'displayed':'disabled'):'no_match',read:true,target:rule.target,author:selected.author,subject:selected.subject,outsideSource:matched&&selected.source!==rule.source};break;}
   case 'setMode':state.config.paused=m.paused;state.config.dryRun=m.dryRun;state.config.revision++;state.queued=0;data=state;break;
   case 'queueSelected':data={queued:true};state.queued++;break;
   case 'catchUp':data={scanned:5,queued:2};state.queued+=2;break;
   case 'export':data={format:'lasfilter-rules',version:1,rules:state.config.rules};break;
   case 'exportLog':data={format:'lasfilter-technical-log',version:1,events:state.logs};break;
   case 'import':if(m.backup?.format!=='lasfilter-rules'||m.backup.version!==1)throw new LasCore.RuleError('bad_schema');saveRules(m.backup.rules);state.config.paused=true;state.config.dryRun=true;data=state;break;
   case 'restoreBackup':if(!snapshots[m.index])throw new LasCore.RuleError('bad_request');saveRules(snapshots[m.index].rules);state.config.paused=true;state.config.dryRun=true;data=state;break;
   case 'clearBlocked':data=state;break;
   case 'sweepNow':data={scanned:6,queued:2};state.queued+=2;break;
   case 'setOptions':state.moveMode=m.moveMode;state.hourly=m.hourly;state.sweepMinutes=m.sweepMinutes;state.newInboxDirect=m.newInboxDirect;state.config.sweepMinutes=m.sweepMinutes;state.config.newInboxDirect=m.newInboxDirect;state.openWindow=m.openWindow;state.config.verbose=!!m.verbose;state.config.fileLog=m.fileLog!==false;state.config.revision++;data=state;break;
   default:throw new LasCore.RuleError('bad_request');
  }return {success:true,data:structuredClone(data)};
 }catch(e){return {success:false,error:e.code||'internal_error'};}}
 return {request};
})();
