/* Endast för uttrycklig förhandsvisning. Används aldrig som bakgrundsmotor. */
globalThis.LasDemo=(()=>{
 const folders=[{id:'demo-in',accountId:'demo',accountName:'Exempelkonto',label:'Exempelkonto · Inkorg',name:'Inkorg'},
  {id:'demo-fin',accountId:'demo',label:'Exempelkonto · Ekonomi / Fakturor',name:'Fakturor'},
  {id:'demo-web',accountId:'demo',label:'Exempelkonto · Webb',name:'Webb'},
  {id:'demo-buy',accountId:'demo',label:'Exempelkonto · Inköp',name:'Inköp'},
  {id:'demo-arkiv',accountId:'demo',label:'Exempelkonto · Arkiv',name:'Arkiv'}];
 let state={config:{schema:1,revision:0,rulesVersion:0,paused:false,dryRun:true,moveMode:'read',hourly:true,sweepMinutes:60,newInboxDirect:true,openWindow:true,verbose:true,fileLog:true,autoBackup:true,rules:[
  {id:'demo-1',name:'Fortnox fakturor',enabled:true,source:'demo-in',target:'demo-fin',match:'all',conditions:[{field:'domain',op:'equals',value:'fortnox.se'}],branches:[{condition:{field:'subject',op:'contains',value:'Faktura'},target:'demo-fin'},{condition:{field:'subject',op:'contains',value:'Order'},target:'demo-buy'}]},
  {id:'demo-2',name:'Webbsupport',enabled:true,source:'demo-in',target:'demo-web',match:'all',conditions:[{field:'domain',op:'equals',value:'support.example'}]},
  {id:'demo-3',name:'Arkivera äldre mejl',enabled:true,source:'demo-in',target:'demo-arkiv',match:'any',readFilter:'read',conditions:[{field:'date',op:'older',value:'90'}]}]},
  prefs:{theme:'light',fontSize:14,lastRule:'demo-1',lang:'sv'},installType:'normal',moveMode:'read',hourly:true,sweepMinutes:60,newInboxDirect:true,openWindow:true,stats:{checks:8,matched:3,moved:0,simulated:3,skipped:0},queued:2,blocked:0,inflight:0,fault:'',lastCheck:Date.now(),backups:[],logs:[LasCore.event('start'),LasCore.event('simulated',3)]};
 const selected={author:'Demoavsändare <faktura@fortnox.se>',subject:'Faktura 1042 – fiktivt testmeddelande',read:true,source:'demo-in',sourceAccount:'demo',email:'faktura@fortnox.se',domain:'fortnox.se'};
 const snapshots=[];let mockPrefill=null;
 /* Endast för förhandsvisningen: låt ett test byta en uppgift i demotillståndet. */
 function setState(patch){Object.assign(state,patch||{});return state;}
 function saveRules(rules){snapshots.unshift(structuredClone(state.config));snapshots.splice(5);state.backups=snapshots.map((c,i)=>({index:i,time:new Date().toISOString(),count:c.rules.length}));state.config.rules=LasCore.validateRules(rules);state.config.revision++;}
 async function request(m){try{let data;
  switch(m.type){
   case 'status':data=state;break;case 'folders':data=folders;break;case 'selected':data=selected;break;
   case 'prefs':{
    const p=m.prefs||{};
    if(p.filterUris&&typeof p.filterUris==='object')state.prefs.filterUris=p.filterUris;
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
   /* Snabbregeln: samma svar som bakgrunden, med fiktiva men rimliga siffror. */
   case 'inboxHints':{
    const taken=state.config.rules.filter(r=>r.enabled).flatMap(r=>(r.conditions||[]).map(c=>String(c.value||'').toLowerCase()));
    data={senders:[
      {domain:'fortnox.se',count:4,subject:'Faktura 1042',sender:'faktura@fortnox.se'},
      {domain:'klarna.se',count:3,subject:'Order bekräftad',sender:'order@klarna.se'},
      {domain:'limoeurope.com',count:2,subject:'Wordfence activity for 12 oct, 2026',sender:'wordpress@limoeurope.com'},
      {domain:'spotify.com',count:4,subject:'Ditt kvitto från Spotify',sender:'no-reply@spotify.com'},
      {domain:'github.com',count:3,subject:'[Tokke2/Lasfilter] Ny fråga',sender:'notifications@github.com'},
      {domain:'swedbank.se',count:2,subject:'Månadsbesked',sender:'noreply@swedbank.se'},
      {domain:'telenor.se',count:2,subject:'Din faktura',sender:'faktura@telenor.se'},
      {domain:'ica.se',count:2,subject:'Veckans erbjudanden',sender:'nyhetsbrev@ica.se'},
      {domain:'elgiganten.se',count:2,subject:'Din order är skickad',sender:'order@elgiganten.se'},
      {domain:'sl.se',count:2,subject:'Ditt kvitto',sender:'kundservice@sl.se'},
      {domain:'visma.se',count:2,subject:'Din faktura är klar',sender:'faktura@visma.se'},
      {domain:'if.se',count:2,subject:'Ditt försäkringsbrev',sender:'kundservice@if.se'}
     ].filter(x=>!taken.includes(x.domain)),
     words:[
      {word:'wordfence',count:3,subject:'Wordfence activity for 12 oct, 2026 on limoeurope.com'},
      {word:'faktura',count:5,subject:'Faktura 1042'},
      {word:'orderbekräftelse',count:4,subject:'Orderbekräftelse 88213'},
      {word:'kvitto',count:4,subject:'Ditt kvitto från Spotify'},
      {word:'erbjudanden',count:3,subject:'Veckans erbjudanden'},
      {word:'skickad',count:3,subject:'Din order är skickad'},
      {word:'månadsbesked',count:2,subject:'Månadsbesked'},
      {word:'inbjudan',count:2,subject:'Inbjudan till webbinarium'}
     ].filter(x=>!taken.some(v=>v.includes(x.word))),
     inboxId:'demo-in',sourceAccount:'demo',scanned:400,capped:true};break;
   }
   case 'quickPreview':{
    const cond=LasCore.choiceCondition({field:m.field,value:m.value});
    const v=String(cond.value||'').toLowerCase();
    const matched=v.includes('klarna')?3:v.includes('wordfence')?2:v.includes('faktura')?5:v.includes('order')?4:0;
    const unread=v.includes('klarna')?1:v.includes('faktura')?2:0;
    const allowUnread=m.allowUnread!==false;
    data={matches:allowUnread?matched:Math.max(0,matched-unread),matched,read:matched-unread,unread,allowUnread,
     scanned:400,capped:true,condition:cond,inboxId:'demo-in',sourceAccount:'demo'};break;
   }
   case 'quickRule':{
    const source=m.source||'demo-in';
    if(!m.target||m.target===source)throw new LasCore.RuleError('choose_target');
    const rule=LasCore.ruleFromChoice({name:m.name,field:m.field,value:m.value,target:m.target,source,
     sourceAccount:m.sourceAccount||'demo',moveUnread:m.moveUnread!==false,openWindow:m.openWindow===true});
    saveRules([...state.config.rules,rule]);
    const folder=folders.find(f=>f.id===m.target)||{};
    data={ruleId:rule.id,rule,condition:rule.conditions[0],target:{id:folder.id||m.target,name:folder.name||'',label:folder.label||''},snapshot:state};break;
   }
   case 'importConditions':{
    const rule=state.config.rules.find(r=>r.id===m.ruleId);
    if(!rule)throw new LasCore.RuleError('bad_id');
    const parsed=LasCore.parseImportList(m.text,{limit:8,field:m.field||'auto'});
    if(!parsed.conditions.length)throw new LasCore.RuleError('bad_value');
    const merged=LasCore.mergeConditions(rule.conditions||[],parsed.conditions,{limit:8});
    if(!merged.added.length)throw new LasCore.RuleError('duplicate_id');
    rule.conditions=merged.conditions;
    if(merged.conditions.length>1)rule.match='any';
    saveRules(state.config.rules);
    data={ruleId:rule.id,added:merged.added.length,skipped:merged.skipped+parsed.skipped,duplicates:merged.duplicates,overflow:merged.overflow,
     match:rule.match,conditions:rule.conditions,rule,target:rule.target,snapshot:state};break;
   }
   case 'filterExport':{
   /* Demon skriver samma slags fil som bakgrunden, med den adress användaren angett
      eller lärde in vid importen. Utan adress blir det ingen fil – precis som i skarpt läge. */
   const clean=v=>{const t=String(v||'').trim();return /^(imap|mailbox|pop3|imap-message|news):\/\//i.test(t)?t:'';};
   const asked=clean(m.uriPrefix);
   const stored=clean(state.prefs?.filterUris?.[m.accountId]);
   const prefix=asked||stored;
   if(asked&&m.accountId)state.prefs.filterUris={...(state.prefs.filterUris||{}),[m.accountId]:asked};
   const uriOf={};
   for(const rule of state.config.rules){
    const folder=folders.find(f=>f.id===rule.target)||{};
    uriOf[rule.id]=prefix?{uriPrefix:prefix,folderPath:folder.name||''}:{};
   }
   const built=LasFilters.buildFilterFile(state.config.rules,{uriOf:prefix?uriOf:{}});
   data={...built.report,text:built.text,needsUri:prefix?[]:state.config.rules.map(r=>({ruleId:r.id,name:r.name})),accountId:m.accountId||'',storedPrefix:prefix};break;
  }
  case 'diagnose':{
    const rule=LasCore.validateRule(m.rule),rows=state.config.rules.find(r=>r.id===rule.id);
    const first=(rule.conditions||[])[0]||{};
    /* Fiktivt exempel på en regel som inte matchar något alls (t.ex. "Wordfence" i ämnet). */
    const nearMiss=String(first.value||'').toLowerCase().includes('wordfence');
    data={ruleId:rule.id,ruleName:rule.name,readFilter:rule.readFilter||'default',yearFolders:rule.yearFolders===true,
     folders:4,scanned:37,searchedFolders:4,skippedFolders:0,emptyFolders:1,
     matched:nearMiss?0:9,
     wouldMove:nearMiss?0:(rows?4:5),waitingUnread:nearMiss?0:3,
     alreadyInTarget:nearMiss?0:2,alreadyQueued:0,unmatched:nearMiss?14:0,
     engineEnabled:!state.config.paused,dryRun:state.config.dryRun,moveMode:state.moveMode,
     paused:state.config.paused,fault:state.fault||'',
     near:nearMiss?[{subject:'Wordfence activity for 12 oct, 2026 on limoeurope.com',domain:'limoeurope.com',inbox:true},
      {subject:'Veckorapport för webbplatsen',domain:'limoeurope.com',inbox:true},
      {subject:'Ny kommentar väntar på granskning',domain:'wordpress.org',inbox:false}]:[],
     matchMode:rule.match==='any'?'any':'all',
     anyMatched:nearMiss?3:(rule.match==='any'?9:0),
     /* Fiktiva siffror per villkor: första villkoret har 0 träffar och stoppar allt. */
     conditions:(rule.conditions||[]).map((c,i)=>({field:c.field,op:c.op,value:String(c.value??'').slice(0,40),hits:nearMiss?(i===0?0:12):(9-i*2)}))
     ,
     examples:nearMiss?[]:[{reason:'move',subject:'Faktura 1042 – fiktivt testmeddelande',domain:'fortnox.se'},
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
    /* Manuell körning läser om allt – därför inga cachade mappar i svaret. */
    else{data={scanned:90,queued:1,matched:6,inTarget:3,handled:2,searchedFolders:10,skippedFolders:0,emptyFolders:3,cachedFolders:0,deferred:0};state.queued+=1;}
    break;
   case 'setOptions':state.moveMode=m.moveMode;state.hourly=m.hourly;state.sweepMinutes=m.sweepMinutes;state.newInboxDirect=m.newInboxDirect;state.config.sweepMinutes=m.sweepMinutes;state.config.newInboxDirect=m.newInboxDirect;state.openWindow=m.openWindow;state.config.verbose=!!m.verbose;state.config.fileLog=m.fileLog!==false;state.config.autoBackup=m.autoBackup!==false;state.config.revision++;data=state;break;
   case 'backupNow':data=state.config.autoBackup===false?{written:false,reason:'off'}:{written:true,filename:'Lasfilter/Regelbackuper/sortbro-regler-backup.json',dated:'',count:state.config.rules.length};break;
   default:throw new LasCore.RuleError('bad_request');
  }return {success:true,data:structuredClone(data)};
 }catch(e){return {success:false,error:e.code||'internal_error'};}}
 return {request,setState};
})();
