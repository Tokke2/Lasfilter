/* Endast för uttrycklig förhandsvisning. Används aldrig som bakgrundsmotor. */
globalThis.LasDemo=(()=>{
 const folders=[{id:'demo-in',accountId:'demo',accountName:'Exempelkonto',label:'Exempelkonto · Inkorg',name:'Inkorg'},
  {id:'demo-fin',accountId:'demo',label:'Exempelkonto · Ekonomi / Fakturor',name:'Fakturor'},
  {id:'demo-web',accountId:'demo',label:'Exempelkonto · Webb',name:'Webb'},
  {id:'demo-buy',accountId:'demo',label:'Exempelkonto · Inköp',name:'Inköp'},
  {id:'demo-arkiv',accountId:'demo',label:'Exempelkonto · Arkiv',name:'Arkiv'}];
 let state={config:{schema:1,revision:0,rulesVersion:0,paused:false,dryRun:true,moveMode:'read',hourly:true,sweepMinutes:60,newInboxDirect:true,openWindow:true,verbose:true,fileLog:true,rules:[
  {id:'demo-1',name:'Fortnox fakturor',enabled:true,source:'demo-in',target:'demo-fin',match:'all',conditions:[{field:'domain',op:'equals',value:'fortnox.se'}],branches:[{condition:{field:'subject',op:'contains',value:'Faktura'},target:'demo-fin'},{condition:{field:'subject',op:'contains',value:'Order'},target:'demo-buy'}]},
  {id:'demo-2',name:'Webbsupport',enabled:true,source:'demo-in',target:'demo-web',match:'all',conditions:[{field:'domain',op:'equals',value:'support.example'}]},
  {id:'demo-3',name:'Arkivera äldre mejl',enabled:true,source:'demo-in',target:'demo-arkiv',match:'any',readFilter:'read',conditions:[{field:'date',op:'older',value:'90'}]}]},
  prefs:{theme:'light',fontSize:14,lastRule:'demo-1',lang:'sv'},moveMode:'read',hourly:true,sweepMinutes:60,newInboxDirect:true,openWindow:true,stats:{checks:8,matched:3,moved:0,simulated:3,skipped:0},queued:2,blocked:0,inflight:0,fault:'',lastCheck:Date.now(),backups:[],logs:[LasCore.event('start'),LasCore.event('simulated',3)]};
 const selected={author:'Demoavsändare <faktura@fortnox.se>',subject:'Faktura 1042 – fiktivt testmeddelande',read:true,source:'demo-in',sourceAccount:'demo',email:'faktura@fortnox.se',domain:'fortnox.se'};
 const snapshots=[];let mockPrefill=null;
 function saveRules(rules){snapshots.unshift(structuredClone(state.config));snapshots.splice(5);state.backups=snapshots.map((c,i)=>({index:i,time:new Date().toISOString(),count:c.rules.length}));state.config.rules=LasCore.validateRules(rules);state.config.revision++;}
 async function request(m){try{let data;
  switch(m.type){
   case 'status':data=state;break;case 'folders':data=folders;break;case 'selected':data=selected;break;
   case 'prefs':{
    const p=m.prefs||{};
    if(['auto','spring','summer','autumn','winter'].includes(p.season))p.season=p.season;
    state.prefs={...state.prefs,...p};data=state.prefs;break;
   }
   case 'createFolder':{
    const name=String(m.name||'').trim();
    if(!name||name.length>64)throw new LasCore.RuleError('bad_folder_name');
    if(folders.some(f=>(f.name||'').toLowerCase()===name.toLowerCase()))throw new LasCore.RuleError('folder_exists');
    const parent=folders.find(f=>f.id===m.parentId)||folders[0];
    const folder={id:'demo-new-'+name.toLowerCase().replace(/[^a-z0-9]+/g,'-'),accountId:parent?.accountId||'demo',accountName:parent?.accountName||'Exempelkonto',name,label:(parent?.accountName||'Exempelkonto')+' · '+name};
    folders.push(folder);data=folder;break;
   }
   case 'suggestRules':data=[
    {domain:'fortnox.se',count:4,subject:'Faktura 1042',sender:'faktura@fortnox.se'},
    {domain:'klarna.se',count:3,subject:'Order bekräftad',sender:'order@klarna.se'}
   ].filter(s=>!state.config.rules.some(r=>r.enabled&&r.conditions.some(c=>c.field==='domain'&&c.value===s.domain)));break;
   case 'diagnose':{
    const rule=LasCore.validateRule(m.rule),rows=state.config.rules.find(r=>r.id===rule.id);
    data={ruleId:rule.id,ruleName:rule.name,readFilter:rule.readFilter||'default',yearFolders:rule.yearFolders===true,
     folders:4,scanned:37,searchedFolders:4,skippedFolders:0,emptyFolders:1,matched:9,wouldMove:rows?4:5,waitingUnread:3,
     alreadyInTarget:2,alreadyQueued:0,engineEnabled:!state.config.paused,dryRun:state.config.dryRun,moveMode:state.moveMode,
     paused:state.config.paused,fault:state.fault||'',
     examples:[{reason:'move',subject:'Faktura 1042 – fiktivt testmeddelande',domain:'fortnox.se'},
      {reason:'unread',subject:'Orderbekräftelse',domain:'klarna.se'},
      {reason:'target',subject:'Arkiv/2025',domain:'example.invalid'}]};break;
   }
   case 'pendingPrefill':data=mockPrefill;mockPrefill=null;break;
   case 'prefillConsumed':data=true;break;
   case 'saveRules':saveRules(m.rules);data=state;break;
   case 'testRule':{const rule=LasCore.validateRule(m.rule),matched=LasCore.match(rule,{...selected,folder:{id:selected.source}},true,true);data={matches:matched,reason:matched?(rule.enabled?'displayed':'disabled'):'no_match',read:true,target:rule.target,author:selected.author,subject:selected.subject,outsideSource:matched&&selected.source!==rule.source};break;}
   case 'setMode':state.config.paused=m.paused;state.config.dryRun=m.dryRun;state.config.revision++;state.queued=0;data=state;break;
   case 'queueSelected':data={queued:true};state.queued++;break;
   case 'catchUp':data={scanned:5,queued:2};state.queued+=2;break;
   case 'export':data={format:'lasfilter-rules',app:'SortBro',version:1,exported:new Date().toISOString(),rules:state.config.rules,folders};break;
   case 'exportLog':data={format:'lasfilter-technical-log',version:1,events:state.logs};break;
   case 'import':{
    const b=m.backup;
    const rawRules=Array.isArray(b)?b:Array.isArray(b?.rules)?b.rules:Array.isArray(b?.config?.rules)?b.config.rules:Array.isArray(b?.conditions)?[b]:null;
    if(!rawRules||(b&&!Array.isArray(b)&&b.format!==undefined&&!['lasfilter-rules','sortbro-rules'].includes(b.format)))throw new LasCore.RuleError('bad_schema');
    const combined=m.merge===true?[...state.config.rules,...rawRules]:rawRules;
    saveRules(combined);state.config.paused=true;state.config.dryRun=true;data=state;break;
   }
   case 'restoreBackup':if(!snapshots[m.index])throw new LasCore.RuleError('bad_request');saveRules(snapshots[m.index].rules);state.config.paused=true;state.config.dryRun=true;data=state;break;
   case 'clearBlocked':data=state;break;
   case 'sweepNow':
    /* Samma svar som den riktiga bakgrunden: pausat läge kör ingenting, annars en liten fiktiv körning. */
    if(state.config.paused)data={scanned:0,queued:0,searchedFolders:0,skippedFolders:0,emptyFolders:0,cachedFolders:0,deferred:0,skipped:'paused',fault:state.fault||''};
    else{data={scanned:6,queued:1,matched:5,inTarget:3,handled:1,searchedFolders:4,skippedFolders:0,emptyFolders:1,cachedFolders:12,deferred:0};state.queued+=1;}
    break;
   case 'setOptions':state.moveMode=m.moveMode;state.hourly=m.hourly;state.sweepMinutes=m.sweepMinutes;state.newInboxDirect=m.newInboxDirect;state.config.sweepMinutes=m.sweepMinutes;state.config.newInboxDirect=m.newInboxDirect;state.openWindow=m.openWindow;state.config.verbose=!!m.verbose;state.config.fileLog=m.fileLog!==false;state.config.revision++;data=state;break;
   default:throw new LasCore.RuleError('bad_request');
  }return {success:true,data:structuredClone(data)};
 }catch(e){return {success:false,error:e.code||'internal_error'};}}
 return {request};
})();
