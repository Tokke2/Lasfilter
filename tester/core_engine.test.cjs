const {test}=require('node:test');const assert=require('node:assert/strict');
const C=require('../addon/core.js'),Engine=require('../addon/engine.js');
const base=()=>({id:'rule1',name:'Fakturor',enabled:true,source:'inbox',target:'archive',match:'all',conditions:[{field:'domain',op:'equals',value:'example.se'},{field:'subject',op:'contains',value:'Faktura'}]});
const msg=(id=1)=>({id,read:true,folder:{id:'inbox',accountId:'a'},author:'Anna <anna@example.se>',subject:'Faktura 1042',date:new Date('2026-10-08T08:00:00Z'),size:123,headerMessageId:'fake-'+id+'@example.invalid'});
function fixture(options={}){
 const cfg={...C.defaults(),dryRun:options.dryRun??false,moveMode:options.moveMode||'read',rules:[base()]};let now=Date.UTC(2026,9,8,12);const messages=new Map([[1,msg()]]),shown=new Set(),logs=[],saved=[];let engine;const notifications=[],debugs=[];
 const folderNode=(id,sub)=>({id,accountId:'a',name:id,specialUse:[],...(sub?{subFolders:sub}:{})});
 const api={tabs:{query:async()=>[{id:4,type:'mail'},{id:8,type:'messageDisplay'},{id:9,type:'content'}]},messageDisplay:{getDisplayedMessages:async id=>[...shown].filter(x=>id===4||options.otherTab&&id===8).map(id=>({id}))},
 accounts:{list:async()=>[{id:'a',rootFolder:{id:'root',accountId:'a',isRoot:true,subFolders:[folderNode('inbox'),folderNode('archive'),folderNode('other',[folderNode('sub1')]),folderNode('brt'),folderNode('third')]}},{id:'b',rootFolder:{id:'rootb',accountId:'b',isRoot:true,subFolders:[folderNode('binbox')]}}]},
 folders:{get:async id=>({id,accountId:'a',name:id,specialUse:[]}),getFolderCapabilities:async()=>({canAddMessages:true,canDeleteMessages:true})},
 messages:{get:async id=>{if(!messages.has(id))throw Error('missing');return structuredClone(messages.get(id));},query:async q=>({messages:[...messages.values()].filter(m=>m.folder.id===q.folderId&&(q.headerMessageId===undefined||m.headerMessageId===q.headerMessageId)&&(q.unread===undefined||m.read===!q.unread))}),continueList:async()=>({messages:[]}),abortList:async()=>{},move:async(ids,target,opts)=>{
  api.calls.push({ids,target,opts});if(options.moveReject)throw Error('SECRET@example.invalid raw');
  if(options.noAck)return;const old=structuredClone(messages.get(ids[0])),m={...old,id:ids[0]+1000,folder:{id:target,accountId:'a'}};messages.delete(ids[0]);messages.set(m.id,m);
  await engine.onMoved({messages:[old]},{messages:[m]});
 }},calls:[]};
 if(options.yearFolders){
  /* Riktigt mappträd så att årsmappar (Arkiv/<år>) kan hittas och skapas. */
  const tree=new Map();
  const add=(id,name,parentId,extra={})=>tree.set(id,{id,accountId:'a',name,parentId,...extra});
  add('root','Rot',null);add('inbox','Inkorg','root',{specialUse:['inbox']});add('archive','Arkiv','root');
  add('other','Annan','root');add('brt','Brt','root');add('third','Tredje','root');add('sub1','Sub1','other');
  const shape=id=>[...tree.values()].filter(f=>f.parentId===id).map(f=>({id:f.id,accountId:f.accountId,name:f.name,specialUse:f.specialUse||[],subFolders:shape(f.id)}));
  api.addFolder=add;
  api.created=[];
  api.folders.get=async(id,includeSub)=>{
   const node=tree.get(id)||{id,accountId:'a',name:id};
   return {id:node.id,accountId:node.accountId,name:node.name,specialUse:node.specialUse||[],...(includeSub?{subFolders:[...tree.values()].filter(f=>f.parentId===id).map(f=>({id:f.id,accountId:f.accountId,name:f.name,specialUse:f.specialUse||[]}))}:{})};
  };
  api.folders.create=async(parentId,name)=>{
   if(options.createReject)throw Error('mappen kunde inte skapas');
   const id='year-'+name;add(id,name,parentId);api.created.push({parentId,name,id});
   return {id,accountId:'a',name,specialUse:[]};
  };
  api.accounts.list=async()=>[{id:'a',rootFolder:{id:'root',accountId:'a',isRoot:true,name:'Rot',subFolders:shape('root')}}];
 }
 if(options.folderInfo)api.folders.getFolderInfo=async id=>{const list=[...messages.values()].filter(m=>m.folder?.id===id);return {totalMessageCount:list.length,unreadMessageCount:list.filter(m=>m.read!==true).length};};
 if(options.folderInfoReject)api.folders.getFolderInfo=async()=>{throw Error('folder info offline');};
 if(options.folderInfo){const queryInfo=api.folders.getFolderInfo;const queries=[];api.infoCalls=queries;api.folders.getFolderInfo=async id=>{queries.push(id);return queryInfo(id);};}
 engine=new Engine(api,cfg,{now:()=>now,ackTimeout:5,log:(n,c)=>logs.push(C.event(n,c,now)),notify:n=>notifications.push(n),debug:t=>debugs.push(t),persist:async()=>{if(options.persistReject)throw Error('disk SECRET');saved.push(structuredClone(engine.recordList()));}});
 return {e:engine,api,messages,shown,logs,saved,notifications,debugs,advance:(ms=2100)=>now+=ms,ready:async()=>{await engine.enqueue(messages.get(1));await engine.tick();now+=2100;await engine.tick();}};
}
for(const [author,expected] of [['Anna <Anna@EXAMPLE.SE>','anna@example.se'],['anna@example.se','anna@example.se'],['"Anna, A" <a@example.se>','a@example.se'],['A <a@example.se>, B <b@example.se>',''],['"space name"@example.se',''],['not an address',''],['evil <a@example.se> <b@evil.invalid>','']])test('conservative sender '+author,()=>assert.equal(C.email(author),expected));
test('IDN domains normalized',()=>assert.equal(C.domain('räksmörgås.se'),'xn--rksmrgs-5wao1o.se'));
for(const d of ['example.se/evil','example.se:99','example..se','localhost','a@b.se','-example.se','x y.se'])test('reject domain '+d,()=>assert.throws(()=>C.domain(d)));
test('all conditions match',()=>assert.equal(C.match(base(),msg()),true));
test('all rejects wrong subject',()=>assert.equal(C.match(base(),{...msg(),subject:'Hej'}),false));
test('any accepts a single matching condition',()=>assert.equal(C.match({...base(),match:'any'},{...msg(),subject:'Hej'}),true));
test('domain boundary not substring',()=>assert.equal(C.match(base(),{...msg(),author:'x@example.se.evil.invalid'}),false));
test('disabled ignored',()=>assert.equal(C.match({...base(),enabled:false},msg()),false));
test('source exact',()=>assert.equal(C.match(base(),{...msg(),folder:{id:'other'}}),false));
test('first matching rule wins',()=>assert.equal(C.firstMatch([base(),{...base(),id:'second'}],msg()).id,'rule1'));
for(const op of ['equals','contains','starts','ends'])test('literal string operator '+op,()=>assert(C.match({...base(),conditions:[{field:'subject',op,value:op==='equals'?'Faktura 1042':op==='ends'?'1042':'Faktura'}]},msg())));
for(const changes of [{source:'archive'},{conditions:[]},{conditions:[{field:'domain',op:'contains',value:'se'}]},{name:''},{conditions:[{field:'subject',op:'contains',value:''}]},{id:'bad id'},{conditions:Array(9).fill({field:'subject',op:'equals',value:'x'})}])test('invalid rule rejected '+JSON.stringify(changes),()=>assert.throws(()=>C.validateRule({...base(),...changes})));
test('unknown fields not retained',()=>assert(!('secret' in C.validateRule({...base(),secret:'private'}))));
test('loop blocked',()=>assert.throws(()=>C.validateRules([base(),{...base(),id:'r2',source:'archive',target:'inbox'}])));
test('acyclic chain allowed',()=>assert.equal(C.validateRules([base(),{...base(),id:'r2',source:'archive',target:'third'}]).length,2));
test('disabled reverse edge no loop',()=>assert.equal(C.validateRules([base(),{...base(),id:'r2',enabled:false,source:'archive',target:'inbox'}]).length,2));
test('duplicate ids rejected',()=>assert.throws(()=>C.validateRules([base(),base()])));
test('rule count bounded',()=>assert.throws(()=>C.validateRules(Array.from({length:201},(_,i)=>({...base(),id:'r'+i})))));
for(const key of ['isRoot','isVirtual','isUnified','isTag'])test('exclude '+key,()=>assert(!C.usableFolder({id:'x',accountId:'a',[key]:true})));
for(const type of ['trash','junk','drafts','sent','templates','outbox'])test('exclude '+type,()=>assert(!C.usableFolder({id:'x',accountId:'a',specialUse:[type]})));
test('cross account target allowed when capable',()=>C.validatePair({id:'a',accountId:'x'},{id:'b',accountId:'y'},{canDeleteMessages:true},{canAddMessages:true}));
test('read-only cannot fall back to copy',()=>assert.throws(()=>C.validatePair({id:'a',accountId:'x'},{id:'b',accountId:'x'},{canDeleteMessages:false},{canAddMessages:true})));
test('technical log rejects arbitrary event',()=>assert.equal(C.event('SECRET@email.invalid'),null));
test('technical log strips foreign keys and text',()=>{const v=C.cleanLogs([{...C.event('error'),secret:'PRIVATE',data:{count:'secret',address:'PRIVATE'}}]);assert(!JSON.stringify(v).includes('PRIVATE'));assert.equal(v[0].data.count,0);});
test('technical log retention',()=>assert.equal(C.cleanLogs([C.event('start',0,Date.now()-31*86400000)]).length,0));
test('technical log bounded',()=>assert.equal(C.cleanLogs(Array.from({length:5700},()=>C.event('start'))).length,5000));
test('unread never queues',async()=>{const f=fixture();assert.equal(await f.e.enqueue({...msg(),read:false}),false);});
test('read event needs explicit change',async()=>{const f=fixture();await f.e.readChanged(msg(),{flagged:true});assert.equal(f.e.pending.size,0);});
test('already read old property not new transition',async()=>{const f=fixture();await f.e.readChanged(msg(),{read:true},{read:true});assert.equal(f.e.pending.size,0);});
test('read event queues once',async()=>{const f=fixture();await f.e.readChanged(msg(),{read:true},{read:false});await f.e.enqueue(msg());assert.equal(f.e.pending.size,1);});
test('pause does not accept new jobs',async()=>{const f=fixture();f.e.config.paused=true;assert.equal(await f.e.enqueue(msg()),false);});
test('displayed message held',async()=>{const f=fixture();f.shown.add(1);await f.ready();assert.equal(f.api.calls.length,0);assert.equal(f.e.pending.size,1);});
test('background message tab also holds',async()=>{const f=fixture();f.api.messageDisplay.getDisplayedMessages=async id=>id===8?[{id:1}]:[];await f.ready();assert.equal(f.api.calls.length,0);});
test('two seconds quiet required',async()=>{const f=fixture();await f.e.enqueue(msg());await f.e.tick();f.advance(1900);await f.e.tick();assert.equal(f.api.calls.length,0);f.advance(200);await f.e.tick();assert.equal(f.api.calls.length,1);});
test('reopening resets quiet interval',async()=>{const f=fixture();await f.e.enqueue(msg());await f.e.tick();f.advance();f.shown.add(1);await f.e.tick();f.shown.clear();await f.e.tick();assert.equal(f.api.calls.length,0);f.advance();await f.e.tick();assert.equal(f.api.calls.length,1);});
test('dry-run does not call move',async()=>{const f=fixture({dryRun:true});await f.ready();assert.equal(f.api.calls.length,0);assert.equal(f.e.stats.simulated,1);assert.equal(f.e.records.size,0);});
test('live moves once with native user action and ack',async()=>{const f=fixture();await f.ready();assert.equal(f.api.calls.length,1);assert.equal(f.api.calls[0].opts.isUserAction,true);assert.equal(f.e.stats.moved,1);assert.equal(f.e.blocked(),0);});
test('native moved message not chained',async()=>{const f=fixture();await f.ready();f.e.config.rules.push({...base(),id:'r2',source:'archive',target:'third'});await f.e.enqueue(f.messages.get(1001));assert.equal(f.e.pending.size,0);});
test('marked unread while waiting cancels',async()=>{const f=fixture();await f.e.enqueue(msg());await f.e.readChanged({...msg(),read:false},{read:false});assert.equal(f.e.pending.size,0);});
test('live rechecks unread even without event',async()=>{const f=fixture();await f.e.enqueue(msg());await f.e.tick();f.messages.get(1).read=false;f.advance();await f.e.tick();assert.equal(f.api.calls.length,0);});
test('changed source cancels',async()=>{const f=fixture();await f.e.enqueue(msg());await f.e.tick();f.messages.get(1).folder.id='changed';f.advance();await f.e.tick();assert.equal(f.api.calls.length,0);});
test('read-only source never moves',async()=>{const f=fixture();f.api.folders.getFolderCapabilities=async()=>({canDeleteMessages:false,canAddMessages:true});await f.ready();assert.equal(f.api.calls.length,0);assert(f.e.fault);});
test('display lookup failure stops',async()=>{const f=fixture();f.api.messageDisplay.getDisplayedMessages=async()=>{throw Error('private');};await f.ready();assert.equal(f.api.calls.length,0);assert.equal(f.e.fault,'display_error');});
test('pause during validation prevents move',async()=>{const f=fixture();f.api.folders.getFolderCapabilities=async()=>{f.e.config.paused=true;return {canDeleteMessages:true,canAddMessages:true};};await f.ready();assert.equal(f.api.calls.length,0);});
test('storage failure prevents enqueue and move',async()=>{const f=fixture({persistReject:true});await assert.rejects(f.e.enqueue(msg()));await f.e.tick();assert.equal(f.api.calls.length,0);assert.equal(f.e.fault,'storage_error');});
test('attempt journal exists before API',async()=>{const f=fixture();const orig=f.api.messages.move;f.api.messages.move=async(...args)=>{assert.equal(f.saved.at(-1)[0].stage,'attempted');return orig(...args);};await f.ready();});
test('API error blocks retry and hides raw error',async()=>{const f=fixture({moveReject:true});await f.ready();await f.e.tick();assert.equal(f.api.calls.length,1);assert.equal(f.e.blocked(),1);assert.equal(f.e.stats.moved,0);assert(!JSON.stringify(f.logs).includes('SECRET'));});
test('no move ack is not success',async()=>{const f=fixture({noAck:true});await f.ready();assert.equal(f.e.stats.moved,0);assert.equal(f.e.fault,'uncertain_move');assert.equal(f.e.blocked(),1);});
test('restore resolves fresh session id',async()=>{const f=fixture();await f.e.enqueue(msg());const records=f.e.recordList();const g=fixture();g.messages.clear();g.messages.set(77,{...msg(),id:77});await g.e.restore(records);assert(g.e.pending.has(77));assert(!g.e.pending.has(1));});
test('uncertain journal restored as blocked, not pending',async()=>{const f=fixture({noAck:true});await f.ready();const g=fixture();await g.e.restore(f.e.recordList());assert.equal(g.e.blocked(),1);assert.equal(g.e.pending.size,0);assert.equal(g.e.fault,'uncertain_move');});
test('ambiguous restore skipped',async()=>{const f=fixture();await f.e.enqueue(msg());const g=fixture();g.messages.set(2,{...msg(),id:2});await g.e.restore(f.e.recordList());assert.equal(g.e.pending.size,0);});
test('old rule version not restored',async()=>{const f=fixture();await f.e.enqueue(msg());const g=fixture();g.e.config.rulesVersion=9;await g.e.restore(f.e.recordList());assert.equal(g.e.pending.size,0);});
test('restore unknown metadata skipped',async()=>{const f=fixture();await f.e.restore([{key:'fake',stage:'pending'}]);assert.equal(f.e.records.size,0);});
test('rule edit clears queued jobs and dry-run done markers',async()=>{const f=fixture({dryRun:true});await f.ready();assert(f.e.done.size);await f.e.clearPending();assert.equal(f.e.done.size,0);assert(await f.e.enqueue(msg()));});
test('queue bound defers safely without stopping monitoring',async()=>{const f=fixture();for(let i=1;i<=101;i++)await f.e.enqueue(msg(i));assert.equal(C.LIMITS.queue,100);assert.equal(f.e.records.size,100);assert.equal(f.e.fault,'');});

test('old rule generation never executed from live queue',async()=>{const f=fixture();await f.e.enqueue(msg());f.e.config.rulesVersion++;await f.e.tick();f.advance();await f.e.tick();assert.equal(f.api.calls.length,0);assert.equal(f.e.pending.size,0);});
test('cannot clear journal during preparation',async()=>{const f=fixture();await f.e.enqueue(msg());f.e.records.values().next().value.stage='attempted';f.e.busy=true;assert.equal(f.e.blocked(),0);await assert.rejects(f.e.clearBlocked(),e=>e.code==='operation_running');assert.equal(f.e.records.size,1);});

test('confirmed closed tab during display query is harmless',async()=>{const f=fixture();let first=true;f.api.tabs.query=async()=>{if(first){first=false;return [{id:4,type:'mail'}];}return [];};f.api.messageDisplay.getDisplayedMessages=async()=>{throw Error('tab closed');};await f.ready();assert.equal(f.api.calls.length,1);assert.equal(f.e.fault,'');});

const branched=()=>({...base(),id:'br',conditions:[{field:'domain',op:'equals',value:'example.se'}],branches:[{condition:{field:'subject',op:'contains',value:'Order'},target:'brt'}]});
test('branch routes matching mail to branch target',async()=>{const f=fixture();f.e.config.rules=[branched()];await f.e.enqueue({...msg(),subject:'Order 9'});assert.equal(f.e.recordList()[0].target,'brt');});
test('branch falls back to default target',async()=>{const f=fixture();f.e.config.rules=[branched()];await f.e.enqueue(msg());assert.equal(f.e.recordList()[0].target,'archive');});
test('live move uses branch target',async()=>{const f=fixture();f.e.config.rules=[branched()];f.messages.set(1,{...msg(1),subject:'Order 9'});await f.e.enqueue(f.messages.get(1));await f.e.tick();f.advance();await f.e.tick();assert.equal(f.api.calls[0].target,'brt');});
test('branch target same as source rejected',()=>assert.throws(()=>C.validateRule({...base(),branches:[{condition:{field:'subject',op:'contains',value:'x'},target:'inbox'}]})));
test('branch without condition rejected',()=>assert.throws(()=>C.validateRule({...base(),branches:[{target:'archive'}]})));
test('branch loop rejected',()=>assert.throws(()=>C.validateRules([branched(),{...base(),id:'r2',source:'brt',target:'inbox'}])));
test('catchUp queues only matching old read mail',async()=>{const f=fixture();f.messages.clear();f.messages.set(5,{...msg(5)});f.messages.set(6,{...msg(6),subject:'Hej'});f.messages.set(7,{...msg(7),read:false});const r=await f.e.catchUp('rule1');assert.deepEqual([r.scanned,r.queued],[2,1]);assert(f.e.pending.has(5));assert(!f.e.pending.has(6));assert(!f.e.pending.has(7));});
test('catchUp applies the chosen rule even when another rule exists',async()=>{const f=fixture();f.messages.clear();f.messages.set(5,{...msg(5),subject:'Order 5'});f.e.config.rules=[{...base(),id:'first',target:'other'},branched()];const r=await f.e.catchUp('br');assert.equal(r.queued,1);assert.equal(f.e.recordList()[0].target,'brt');});
test('catchUp scans account subfolders but skips targets and other accounts',async()=>{const f=fixture();f.messages.clear();f.messages.set(5,msg(5));f.messages.set(8,{...msg(8),folder:{id:'sub1',accountId:'a'}});f.messages.set(9,{...msg(9),folder:{id:'archive',accountId:'a'}});f.messages.set(10,{...msg(10),folder:{id:'binbox',accountId:'b'}});const r=await f.e.catchUp('rule1');assert.deepEqual([r.scanned,r.queued],[2,2]);assert(f.e.pending.has(5)&&f.e.pending.has(8));assert(!f.e.pending.has(9));assert(!f.e.pending.has(10));const rec=f.e.recordList().find(x=>x.source==='sub1');assert(rec&&rec.target==='archive');});
test('catchUp move uses the actual current folder as source',async()=>{const f=fixture();f.messages.clear();f.messages.set(8,{...msg(8),folder:{id:'sub1',accountId:'a'}});await f.e.catchUp('rule1');await f.e.tick();f.advance();await f.e.tick();assert.equal(f.api.calls.length,1);assert.equal(f.api.calls[0].target,'archive');assert.equal(f.e.stats.moved,1);});
test('catchUp disabled rule rejected',async()=>{const f=fixture();f.e.config.rules=[{...base(),enabled:false}];await assert.rejects(f.e.catchUp('rule1'),e=>e.code==='disabled');});
test('catchUp paused rejected',async()=>{const f=fixture();f.e.config.paused=true;await assert.rejects(f.e.catchUp('rule1'),e=>e.code==='paused');});

test('direct mode sweep queues unread matching mail with notify',async()=>{const f=fixture({moveMode:'direct'});f.messages.clear();f.messages.set(5,{...msg(5),read:false});const r=await f.e.catchUp('rule1');assert.equal(r.queued,1);assert.equal(f.e.recordList()[0].notify,true);});
test('direct move opens notify window after confirmed move',async()=>{const f=fixture({moveMode:'direct'});f.messages.clear();f.messages.set(5,{...msg(5),read:false});await f.e.catchUp('rule1');await f.e.tick();f.advance();await f.e.tick();assert.equal(f.e.stats.moved,1);assert.deepEqual(f.notifications,[1005]);});
test('direct mode moves immediately even if message is displayed',async()=>{const f=fixture({moveMode:'direct'});f.shown.add(1);await f.e.enqueue(msg());await f.e.tick();assert.equal(f.e.stats.moved,1);});
test('read mode sweep skips unread',async()=>{const f=fixture();f.messages.clear();f.messages.set(5,{...msg(5),read:false});const r=await f.e.catchUp('rule1');assert.equal(r.queued,0);});
test('MV2 sweep uses unread false instead of invalid read query field',async()=>{const f=fixture();const queries=[],query=f.api.messages.query;f.api.messages.query=async q=>{queries.push({...q});return query(q);};await f.e.catchUp('rule1');assert.ok(queries.length);assert.ok(queries.every(q=>q.unread===false&&!('read' in q)));});
test('sweepAll runs all enabled rules',async()=>{const f=fixture({moveMode:'direct'});f.messages.clear();f.messages.set(5,msg(5));f.messages.set(6,{...msg(6),author:'x@other.se',subject:'Faktura 6'});f.e.config.rules=[base(),{...base(),id:'r2',conditions:[{field:'domain',op:'equals',value:'other.se'}],target:'third'}];const r=await f.e.sweepAll();assert.equal(r.queued,2);});
test('config rejects unknown moveMode',()=>assert.throws(()=>C.config({...C.defaults(),moveMode:'always'})));

test('debug event keeps detail through cleanLogs',()=>{const e=C.event('debug',0,Date.now(),'svep regel r1: skannade 3 koade 0');assert.equal(e.data.detail,'svep regel r1: skannade 3 koade 0');const k=C.cleanLogs([e]);assert.equal(k.length,1);assert.equal(k[0].data.detail,e.data.detail);});
test('config accepts verbose flag',()=>assert.equal(C.config({...C.defaults(),verbose:true}).verbose,true));
test('config rejects non-boolean verbose',()=>assert.throws(()=>C.config({...C.defaults(),verbose:'ja'})));
test('sweep writes per-rule debug line',async()=>{const f=fixture();f.messages.clear();f.messages.set(5,msg(5));await f.e.catchUp('rule1');assert.ok(f.debugs.some(t=>t.startsWith('svep regel rule1')));});
test('move validates the actual sweep source and branch target',async()=>{const f=fixture();const checked=[];f.api.folders.getFolderCapabilities=async id=>{checked.push(id);return {canAddMessages:true,canDeleteMessages:true};};f.e.config.rules=[branched()];f.messages.clear();f.messages.set(8,{...msg(8),subject:'Order 8',folder:{id:'sub1',accountId:'a'}});await f.e.catchUp('br');await f.e.tick();f.advance();await f.e.tick();assert.ok(checked.includes('sub1'));assert.ok(checked.includes('brt'));assert.equal(f.api.calls[0].target,'brt');});
test('sweepAll reports errors without stopping live monitoring',async()=>{const f=fixture();f.api.accounts.list=async()=>{throw Error('offline');};await assert.rejects(f.e.sweepAll(),e=>e.code==='sweep_error');assert.equal(f.e.fault,'');});
test('account scope matches every folder in the selected account',()=>{const r=C.validateRule({...base(),scope:'account',sourceAccount:'a'});assert(C.match(r,{...msg(),folder:{id:'other',accountId:'a'}}));assert(!C.match(r,{...msg(),folder:{id:'other',accountId:'b'}}));});
test('account scope does not requeue mail already in its target',()=>{const r=C.validateRule({...base(),scope:'account',sourceAccount:'a'}),m={...msg(),folder:{id:'archive',accountId:'a'}};assert.equal(C.firstMatch([r],m),null);});
test('sweep skips one unavailable folder and continues the account',async()=>{const f=fixture();const query=f.api.messages.query;f.api.messages.query=async q=>{if(q.folderId==='sub1')throw Error('offline folder');return query(q);};const r=await f.e.sweepAll();assert.equal(r.skippedFolders,1);assert.ok(r.searchedFolders>0);assert.equal(f.e.fault,'');});
test('account sweep continues beyond first 500 messages and reaches later folders',async()=>{const f=fixture();f.messages.clear();for(let i=1;i<=600;i++)f.messages.set(i,{...msg(i),subject:'Ej match'});f.messages.set(1000,{...msg(1000),folder:{id:'sub1',accountId:'a'}});const r=await f.e.sweepAll();assert.ok(r.scanned>500);assert.equal(r.queued,1);assert.ok(f.e.pending.has(1000));});
test('account sweep does not depend on the old source folder id',async()=>{const f=fixture();f.e.config.rules=[C.validateRule({...base(),scope:'account',sourceAccount:'a',source:'deleted-folder'})];f.api.folders.get=async id=>{if(id==='deleted-folder')throw Error('gone');return {id,accountId:'a',name:id,specialUse:[]};};const r=await f.e.sweepAll();assert.ok(r.searchedFolders>0);assert.equal(f.e.fault,'');});
test('old config enables automatic text log on migration',()=>{const raw=C.defaults();delete raw.fileLog;assert.equal(C.config(raw).fileLog,true);});
test('error diagnostics survive log cleaning',()=>{const e=C.event('error',0,Date.now(),'motor_stoppad code=sweep_error');assert.equal(C.cleanLogs([e])[0].data.detail,'motor_stoppad code=sweep_error');});
test('sweep interval accepts 15 minute steps',()=>{assert.equal(C.config({...C.defaults(),sweepMinutes:15}).sweepMinutes,15);assert.throws(()=>C.config({...C.defaults(),sweepMinutes:20}));});
test('new unread inbox mail moves directly even in read mode',async()=>{const f=fixture();const incoming={...msg(5),read:false};f.messages.clear();f.messages.set(5,incoming);assert.equal(await f.e.newInboxMessages([incoming]),1);await f.e.tick();assert.equal(f.e.stats.moved,1);});
test('onMoved confirms move when Thunderbird recalculates message size in target folder',async()=>{
 const f=fixture();
 f.api.messages.move=async(ids,target)=>{
  const old=structuredClone(f.messages.get(ids[0])),m={...old,id:ids[0]+1000,size:old.size+47,folder:{id:target,accountId:'a'}};
  f.messages.delete(ids[0]);f.messages.set(m.id,m);
  await f.e.onMoved({messages:[old]},{messages:[m]});
 };
 await f.ready();
 assert.equal(f.e.stats.moved,1);assert.equal(f.e.fault,'');assert.equal(f.e.blocked(),0);
});
test('IMAP move without onMoved event is confirmed via folder verification',async()=>{
 const f=fixture();
 f.api.messages.move=async(ids,target)=>{
  const old=structuredClone(f.messages.get(ids[0])),m={...old,id:ids[0]+1000,size:old.size+12,folder:{id:target,accountId:'a'}};
  f.messages.delete(ids[0]);f.messages.set(m.id,m);
 };
 await f.ready();
 assert.equal(f.e.stats.moved,1);assert.equal(f.e.fault,'');assert.equal(f.e.blocked(),0);
});
test('restore automatically clears attempted record when message is already in target',async()=>{
 const f=fixture({noAck:true});await f.ready();assert.equal(f.e.blocked(),1);
 const g=fixture();
 const old=g.messages.get(1);g.messages.delete(1);g.messages.set(1001,{...old,id:1001,size:old.size+32,folder:{id:'archive',accountId:'a'}});
 await g.e.restore(f.e.recordList());
 assert.equal(g.e.blocked(),0);assert.equal(g.e.fault,'');
});
test('sweepAll picks up unread matching mail in real inbox when newInboxDirect is enabled',async()=>{
 const f=fixture();
 f.api.accounts.list=async()=>[{id:'a',rootFolder:{id:'root',accountId:'a',isRoot:true,subFolders:[{id:'inbox',accountId:'a',name:'Inkorg',specialUse:['inbox']},{id:'archive',accountId:'a',name:'Arkiv',specialUse:[]}]}}];
 f.messages.clear();f.messages.set(9117,{...msg(9117),read:false});
 const r=await f.e.sweepAll();
 assert.equal(r.queued,1);await f.e.tick();assert.equal(f.e.stats.moved,1);
});
test('vanished message in queue is dropped without stopping engine',async()=>{
 const f=fixture();await f.e.enqueue(msg(1));await f.e.tick();
 f.messages.delete(1);f.advance();await f.e.tick();
 assert.equal(f.e.fault,'');assert.equal(f.e.pending.size,0);
});
test('rule readFilter supports read, unread, both and default',()=>{
 for(const rf of ['default','read','unread','both'])assert.equal(C.validateRule({...base(),readFilter:rf}).readFilter,rf);
 assert.throws(()=>C.validateRule({...base(),readFilter:'invalid'}));
});
test('rule with readFilter=both moves both unread and read mail immediately',async()=>{
 const f=fixture();f.e.config.rules=C.validateRules([{...base(),id:'r-both',readFilter:'both'}]);
 const unreadMsg={...msg(10),read:false};
 const readMsg={...msg(11),read:true};
 f.messages.clear();f.messages.set(10,unreadMsg);f.messages.set(11,readMsg);
 const r=await f.e.sweepAll();
 assert.equal(r.queued,2);
 await f.e.tick();
 assert.equal(f.e.stats.moved,2);
});
test('rule with readFilter=unread moves only unread mail and skips read mail',async()=>{
 const f=fixture();f.e.config.newInboxDirect=false;f.e.config.rules=C.validateRules([{...base(),id:'r-unread',readFilter:'unread'}]);
 const unreadMsg={...msg(20),read:false};
 const readMsg={...msg(21),read:true};
 f.messages.clear();f.messages.set(20,unreadMsg);f.messages.set(21,readMsg);
 const r=await f.e.sweepAll();
 assert.equal(r.queued,1);
 await f.e.tick();
 assert.equal(f.e.stats.moved,1);
 assert.equal(f.messages.get(21)?.folder.id,'inbox');
});
test('rule with readFilter=read skips unread mail even when newInboxDirect is enabled',async()=>{
 const f=fixture();f.e.config.newInboxDirect=true;f.e.config.rules=C.validateRules([{...base(),id:'r-read',readFilter:'read'}]);
 const unreadMsg={...msg(30),read:false};
 f.messages.clear();f.messages.set(30,unreadMsg);
 assert.equal(await f.e.newInboxMessages([unreadMsg]),0);
 const r=await f.e.sweepAll();
 assert.equal(r.queued,0);
 f.messages.set(30,{...unreadMsg,read:true});
 await f.e.readChanged(f.messages.get(30),{read:true},{read:false});
 await f.e.tick();f.advance();await f.e.tick();
 assert.equal(f.e.stats.moved,1);
});
test('multiple rules with different readFilter settings route unread and read mail to separate folders',async()=>{
 const f=fixture();
 f.e.config.newInboxDirect=false;
 f.e.config.rules=C.validateRules([
  {...base(),id:'r1',name:'Olästa fakturor',target:'brt',readFilter:'unread'},
  {...base(),id:'r2',name:'Lästa fakturor',target:'archive',readFilter:'read'}
 ]);
 const mUnread={...msg(40),read:false};
 const mRead={...msg(41),read:true};
 f.messages.clear();f.messages.set(40,mUnread);f.messages.set(41,mRead);
 await f.e.sweepAll();
 await f.e.tick();f.advance();await f.e.tick();
 assert.equal(f.e.stats.moved,2);
 const movedFolders=[...f.messages.values()].map(m=>m.folder.id).sort();
 assert.deepEqual(movedFolders,['archive','brt']);
});
test('rule unreadAction supports default, keep, window and read',()=>{
 for(const ua of ['default','keep','window','read'])assert.equal(C.validateRule({...base(),unreadAction:ua}).unreadAction,ua);
 assert.throws(()=>C.validateRule({...base(),unreadAction:'invalid'}));
});
test('tick processes pending messages even when an unloaded background tab hangs in getDisplayedMessages',async()=>{
 const f=fixture();
 f.e.hooks.displayTimeout=20;
 f.api.messageDisplay.getDisplayedMessages=async id=>{if(id===8)return new Promise(()=>{});return [];};
 await f.ready();
 assert.equal(f.e.stats.moved,1);
 assert.equal(f.e.fault,'');
});
test('tick processes pending messages even when sweeping counter is non-zero',async()=>{
 const f=fixture({moveMode:'direct'});
 await f.e.enqueue(msg(1));
 f.e.sweeping=1;
 await f.e.tick();
 assert.equal(f.e.stats.moved,1);
});
test('sweepRule silently skips already queued messages without spamming debug log',async()=>{
 const f=fixture({moveMode:'direct'});
 f.messages.clear();f.messages.set(5,msg(5));
 await f.e.catchUp('rule1');
 f.debugs.length=0;
 await f.e.catchUp('rule1');
 assert.equal(f.debugs.filter(d=>d.includes('redan hanterad eller köad')).length,0);
});
test('sweepRule deduplicates folders when both rootFolder and folders are populated and moves on first tick',async()=>{
 const f=fixture();
 const sub=[{id:'inbox',accountId:'a',name:'Inkorg',specialUse:['inbox']},{id:'archive',accountId:'a',name:'Arkiv',specialUse:[]}];
 f.api.accounts.list=async()=>[{id:'a',rootFolder:{id:'root',accountId:'a',isRoot:true,subFolders:sub},folders:sub}];
 f.messages.clear();f.messages.set(5,msg(5));
 const r=await f.e.catchUp('rule1');
 assert.equal(r.searchedFolders,1);
 assert.equal(r.queued,1);
 await f.e.tick();
 assert.equal(f.e.stats.moved,1);
});
test('unmovable subfolder message from sweep is dropped without stopping other queued messages',async()=>{
 const f=fixture();
 f.api.folders.getFolderCapabilities=async id=>({canAddMessages:true,canDeleteMessages:id!=='sub1'});
 f.messages.clear();
 f.messages.set(8,{...msg(8),folder:{id:'sub1',accountId:'a'}});
 f.messages.set(9,{...msg(9),folder:{id:'inbox',accountId:'a'}});
 await f.e.catchUp('rule1');
 await f.e.tick();
 assert.equal(f.e.fault,'');
 assert.equal(f.e.stats.moved,1);
 assert.equal(f.e.stats.skipped,1);
});
test('sweepRule moves messages concurrently while building the queue and drains when reaching 100 in queue',async()=>{
 const f=fixture();
 delete f.e.hooks.ackTimeout;
 f.messages.clear();
 let movedDuringEnqueue=0;
 const origMove=f.api.messages.move;
 f.api.messages.move=async(ids,target,opts)=>{
  if(f.e.sweeping>0)movedDuringEnqueue++;
  return origMove(ids,target,opts);
 };
 for(let i=1;i<=125;i++)f.messages.set(i,msg(i));
 const r=await f.e.catchUp('rule1');
 await f.e.tick();
 assert.equal(r.queued,125);
 assert.equal(r.deferred,0);
  assert.ok(movedDuringEnqueue>0,'moves should happen concurrently while sweepRule is still building the queue');
  assert.equal(f.e.stats.moved,125);
  assert.equal(f.e.pending.size,0);
});

test('folder cache skips empty folders without querying them',async()=>{
 const f=fixture({folderInfo:true});
 const queried=[],query=f.api.messages.query;
 f.api.messages.query=async q=>{queried.push(q.folderId);return query(q);};
 const r=await f.e.catchUp('rule1');
 assert.equal(r.emptyFolders,4);
 assert.equal(r.searchedFolders,1);
 assert.deepEqual(queried,['inbox']);
 assert.ok(f.api.infoCalls.includes('other'));
});

test('folder cache skips unchanged folders without hits on the next sweep',async()=>{
 const f=fixture({folderInfo:true});
 f.messages.set(9,{...msg(9),subject:'Hej',author:'x@other.invalid',folder:{id:'brt',accountId:'a'}});
 const queried=[],query=f.api.messages.query;
 f.api.messages.query=async q=>{queried.push(q.folderId);return query(q);};
 const first=await f.e.catchUp('rule1');
 assert.ok(first.searchedFolders>=2);
 assert.equal(first.cachedFolders,0);
 const before=queried.filter(id=>id==='brt').length;
 const second=await f.e.catchUp('rule1');
 assert.ok(second.cachedFolders>=1);
 assert.equal(queried.filter(id=>id==='brt').length,before);
 assert.equal(second.scanned,0);
 assert.equal(second.queued,0);
});

test('folder cache is invalidated when the engine sees new mail, moves or reads',async()=>{
 const f=fixture({folderInfo:true});
 f.messages.set(9,{...msg(9),subject:'Hej',author:'x@other.invalid',folder:{id:'brt',accountId:'a'}});
 await f.e.catchUp('rule1');
 assert.equal((await f.e.catchUp('rule1')).cachedFolders,2);
 f.e.invalidateFolders();
 const after=await f.e.catchUp('rule1');
 assert.equal(after.cachedFolders,0);
 assert.ok(after.searchedFolders>=2);
 f.e.config.dryRun=false;
 await f.e.tick();
 assert.equal(f.e.folderCache.size,0,'a confirmed move clears the cached folder picture');
});

test('folder info failure falls back to a normal scan',async()=>{
 const f=fixture({folderInfoReject:true});
 const r=await f.e.catchUp('rule1');
 assert.equal(r.emptyFolders,0);
 assert.equal(r.cachedFolders,0);
 assert.ok(r.searchedFolders>=5);
 assert.equal(f.e.fault,'');
});

test('folder cache counters report hits and misses',async()=>{
 const f=fixture({folderInfo:true});
 await f.e.catchUp('rule1');
 assert.ok(f.e.cacheStats.misses>=1);
 f.messages.clear();
 f.messages.set(9,{...msg(9),subject:'Hej',author:'x@other.invalid',folder:{id:'brt',accountId:'a'}});
 await f.e.catchUp('rule1');
 const hits=f.e.cacheStats.hits;
 await f.e.catchUp('rule1');
 assert.ok(f.e.cacheStats.hits>hits);
});

test('seasonOf maps the calendar to the four seasons',()=>{
 const monthOf=m=>C.seasonOf(new Date(Date.UTC(2026,m,15)));
 assert.deepEqual([0,1,11].map(m=>C.seasonOf(new Date(Date.UTC(2026,m,15)))),['winter','winter','winter']);
 assert.deepEqual([2,3,4].map(monthOf),['spring','spring','spring']);
 assert.deepEqual([5,6,7].map(monthOf),['summer','summer','summer']);
 assert.deepEqual([8,9,10].map(monthOf),['autumn','autumn','autumn']);
 assert.equal(C.seasonOf('2026-10-12T08:00:00Z'),'autumn');
 assert.equal(C.seasonOf('inte-ett-datum'),C.seasonOf());
 assert.deepEqual([...C.SEASONS],['spring','summer','autumn','winter']);
});

test('suggestFrom groups inbox mail by domain and ignores covered domains',()=>{
 const inbox={id:'inbox',accountId:'a'};
 const list=[
  {author:'Faktura <faktura@fortnox.se>',subject:'Faktura 1042',folder:inbox},
  {author:'Faktura <faktura@fortnox.se>',subject:'Faktura 1043',folder:inbox},
  {author:'Klarna <order@klarna.se>',subject:'Order 5',folder:inbox},
  {author:'Klarna <order@klarna.se>',subject:'Order 6',folder:inbox},
  {author:'Klarna <order@klarna.se>',subject:'Order 7',folder:inbox},
  {author:'Ensamt <en@enskild.se>',subject:'Hej',folder:inbox},
  {author:'trasig-adress',subject:'Hej',folder:inbox}
 ];
 const out=C.suggestFrom(list,{minCount:2});
 assert.deepEqual(out.map(s=>s.domain),['klarna.se','fortnox.se']);
 assert.equal(out[0].count,3);
 assert.equal(out[0].subject,'Order 5');
 assert.equal(out[0].sender,'order@klarna.se');
 const covered=C.suggestFrom(list,{minCount:2,rules:[C.validateRule({id:'r1',name:'Fortnox',enabled:true,source:'inbox',sourceAccount:'a',scope:'account',target:'archive',match:'all',conditions:[{field:'domain',op:'equals',value:'fortnox.se'}]})]});
 assert.deepEqual(covered.map(s=>s.domain),['klarna.se']);
 assert.equal(C.suggestFrom(list,{minCount:2,limit:1}).length,1);
 assert.deepEqual(C.suggestFrom(null),[]);
});

/* ===== Årsmappar: arkivera tidigare år i Arkiv/<år>, aldrig olästa ===== */
const yearRule=over=>({...base(),id:'years',name:'Årsarkiv',target:'archive',match:'all',readFilter:'read',yearFolders:true,
 conditions:[{field:'date',op:'before',value:'2026'}],...over});
const oldMsg=(id,year,read=true)=>({...msg(id),read,date:new Date(year+'-04-02T08:00:00Z')});
const folderOf=(f,headerMessageId)=>[...f.messages.values()].find(m=>m.headerMessageId===headerMessageId)?.folder?.id;

test('date before year matches previous years but not the current one',()=>{
 const r=C.validateRule({...base(),conditions:[{field:'date',op:'before',value:'2026'}]});
 const at=y=>({...msg(),date:new Date(y+'-06-01T00:00:00Z')});
 assert.equal(C.match(r,at(2025)),true);
 assert.equal(C.match(r,at(2023)),true);
 assert.equal(C.match(r,at(2026)),false);
});

test('date older and newer count days from now',()=>{
 const now=Date.parse('2026-10-12T00:00:00Z');
 const older=C.validateRule({...base(),conditions:[{field:'date',op:'older',value:'90'}]});
 const newer=C.validateRule({...base(),conditions:[{field:'date',op:'newer',value:'30'}]});
 const days=n=>({...msg(),date:new Date(now-n*86400000)});
 assert.equal(C.match(older,days(91),false,false,now),true);
 assert.equal(C.match(older,days(89),false,false,now),false);
 assert.equal(C.match(newer,days(10),false,false,now),true);
 assert.equal(C.match(newer,days(40),false,false,now),false);
 assert.equal(C.match(older,{...msg(),date:'inte-ett-datum'}),false);
});

test('size conditions use kilobytes and recipients are matched',()=>{
 const big=C.validateRule({...base(),conditions:[{field:'size',op:'larger',value:'100'}]});
 const small=C.validateRule({...base(),conditions:[{field:'size',op:'smaller',value:'100'}]});
 assert.equal(C.match(big,{...msg(),size:200*1024}),true);
 assert.equal(C.match(big,{...msg(),size:99*1024}),false);
 assert.equal(C.match(small,{...msg(),size:50*1024}),true);
 assert.equal(C.match(big,{...msg(),size:undefined}),false);
 const to=C.validateRule({...base(),conditions:[{field:'recipient',op:'contains',value:'faktura@'}]});
 assert.equal(C.match(to,{...msg(),recipients:['Faktura <faktura@x.se>']}),true);
 assert.equal(C.match(to,{...msg(),recipients:['annan@x.se']}),false);
 const cc=C.validateRule({...base(),conditions:[{field:'cc',op:'contains',value:'ekonomi@'}]});
 assert.equal(C.match(cc,{...msg(),ccList:['Ekonomi <ekonomi@x.se>']}),true);
 assert.equal(C.match(cc,{...msg(),ccList:[]}),false);
});

for(const bad of [{field:'size',op:'contains',value:'5'},{field:'size',op:'larger',value:'0'},{field:'size',op:'larger',value:'abc'},
 {field:'date',op:'equals',value:'2025'},{field:'date',op:'before',value:'20'},{field:'date',op:'older',value:'0'},
 {field:'recipient',op:'older',value:'5'},{field:'unknown',op:'contains',value:'x'}])test('reject condition '+JSON.stringify(bad),()=>assert.throws(()=>C.validateRule({...base(),conditions:[bad]})));

test('yearFolders flag is validated as a boolean',()=>{
 assert.equal(C.validateRule({...yearRule()}).yearFolders,true);
 assert.equal(C.validateRule({...base(),yearFolders:'ja'}).yearFolders,false);
 assert.equal(C.validateRule(base()).yearFolders,false);
 assert.equal(C.yearOf(oldMsg(1,2025)),2025);
 assert.equal(C.yearFolderName(oldMsg(1,2024)),'2024');
 assert.equal(C.yearFolderName({date:'trasigt'}),'');
});

test('year archive moves last year read mail into Arkiv/<year> and leaves unread and current year',async()=>{
 const f=fixture({yearFolders:true});
 f.e.config.rules=C.validateRules([yearRule()]);
 f.messages.clear();
 f.messages.set(1,oldMsg(1,2025,true));
 f.messages.set(2,oldMsg(2,2025,false));
 f.messages.set(3,oldMsg(3,2026,true));
 const r=await f.e.sweepAll();
 assert.equal(r.queued,1);
 assert.ok(f.api.created.some(c=>c.parentId==='archive'&&c.name==='2025'),'årsmappen 2025 skapas under Arkiv');
 assert.equal(f.e.recordList()[0].target,'year-2025');
 await f.e.tick();f.advance();await f.e.tick();
 assert.equal(folderOf(f,'fake-1@example.invalid'),'year-2025');
 assert.equal(folderOf(f,'fake-2@example.invalid'),'inbox','oläst mejl väntar');
 assert.equal(folderOf(f,'fake-3@example.invalid'),'inbox','årets mejl arkiveras inte');
 assert.equal(f.e.fault,'');
});

test('unread mail is archived only after it is read',async()=>{
 const f=fixture({yearFolders:true});
 f.e.config.rules=C.validateRules([yearRule()]);
 f.messages.clear();
 f.messages.set(2,oldMsg(2,2025,false));
 await f.e.sweepAll();
 assert.equal(f.e.pending.size,0);
 f.messages.get(2).read=true;
 await f.e.readChanged(f.messages.get(2),{read:true},{read:false});
 await f.e.tick();f.advance();await f.e.tick();
 assert.equal(folderOf(f,'fake-2@example.invalid'),'year-2025');
});

test('year archive reuses an existing year folder and creates no duplicate',async()=>{
 const f=fixture({yearFolders:true});
 f.api.addFolder('year-2024','2024','archive');
 f.e.config.rules=C.validateRules([yearRule({conditions:[{field:'date',op:'before',value:'2026'}]})]);
 f.messages.clear();
 f.messages.set(1,oldMsg(1,2024,true));
 const first=await f.e.sweepAll();
 f.messages.set(1,oldMsg(1,2024,true));
 const second=await f.e.sweepAll();
 assert.deepEqual(f.api.created,[],'ingen ny mapp skapas när årsmappen finns');
 assert.ok(first.cachedFolders+first.emptyFolders>=0);
 assert.equal(f.e.recordList().at(-1)?.target,'year-2024');
 assert.equal(second.queued,0,'redan köat mejl köas inte om');
});

test('mail already inside its year folder is not queued again',async()=>{
 const f=fixture({yearFolders:true});
 f.api.addFolder('year-2025','2025','archive');
 f.e.config.rules=C.validateRules([yearRule()]);
 f.messages.clear();
 f.messages.set(1,{...oldMsg(1,2025,true),folder:{id:'year-2025',accountId:'a',name:'2025'}});
 const r=await f.e.sweepAll();
 assert.equal(r.queued,0);
 assert.equal(f.e.pending.size,0);
 assert.equal(f.e.fault,'');
});

test('year archive falls back to the plain target folder when creation is denied',async()=>{
 const f=fixture({yearFolders:true,createReject:true});
 f.e.config.rules=C.validateRules([yearRule()]);
 f.messages.clear();
 f.messages.set(1,oldMsg(1,2025,true));
 const r=await f.e.sweepAll();
 assert.equal(r.queued,1);
 assert.equal(f.e.recordList()[0].target,'archive');
 await f.e.tick();f.advance();await f.e.tick();
 assert.equal(folderOf(f,'fake-1@example.invalid'),'archive');
 assert.equal(f.e.fault,'');
});

test('restored year folder job survives a restart when the year folder exists',async()=>{
 const f=fixture({yearFolders:true});
 f.e.config.rules=C.validateRules([yearRule()]);
 f.messages.clear();
 f.messages.set(1,oldMsg(1,2025,true));
 await f.e.sweepAll();
 const records=f.e.recordList();
 const g=fixture({yearFolders:true});
 g.e.config.rules=C.validateRules([yearRule()]);
 g.messages.clear();
 /* Samma Message-ID som i journalen – det är så återställningen hittar mejlet. */
 g.messages.set(77,{...oldMsg(77,2025,true),headerMessageId:records[0].headerMessageId});
 await g.api.folders.create('archive','2025');
 await g.e.restore(records);
 assert(g.e.pending.has(77),'jobbet återställs när årsmappen finns');
 await g.e.tick();g.advance();await g.e.tick();
 assert.equal(folderOf(g,records[0].headerMessageId),'year-2025');
});

test('year folder limit guards against runaway folder creation',async()=>{
 const f=fixture({yearFolders:true});
 f.e.config.rules=C.validateRules([yearRule({conditions:[{field:'date',op:'older',value:'1'}]})]);
 f.messages.clear();
 for(let i=1;i<=20;i++)f.messages.set(i,{...msg(i),date:new Date((2000+i)+'-04-02T08:00:00Z')});
 await f.e.sweepAll();
 assert.ok(f.api.created.length<=C.LIMITS.yearFolders,'högst '+C.LIMITS.yearFolders+' årsmappar skapas per session');
 assert.equal(f.e.fault,'');
});

test('date before/after the current year follow the calendar instead of a fixed year',()=>{
 const before=C.validateRule({...base(),conditions:[{field:'date',op:'beforeThisYear',value:''}]});
 const after=C.validateRule({...base(),conditions:[{field:'date',op:'afterThisYear',value:''}]});
 assert.equal(before.conditions[0].value,'');
 const at=(y,now)=>({...msg(),date:new Date(y+'-06-01T00:00:00Z'),_now:now});
 const now2026=Date.UTC(2026,9,12),now2027=Date.UTC(2027,0,5);
 assert.equal(C.match(before,at(2025,now2026),false,false,now2026),true);
 assert.equal(C.match(before,at(2026,now2026),false,false,now2026),false);
 assert.equal(C.match(before,at(2026,now2027),false,false,now2027),true,'2026 blir tidigare år 2027');
 assert.equal(C.match(after,at(2027,now2026),false,false,now2026),true);
 assert.equal(C.match(after,at(2026,now2026),false,false,now2026),false);
});

test('diagnose explains why matching mail is not moved yet',async()=>{
 const f=fixture({yearFolders:true});
 f.api.addFolder('year-2025','2025','archive');
 f.e.config.rules=C.validateRules([yearRule()]);
 f.messages.clear();
 f.messages.set(1,oldMsg(1,2025,true));                                   /* redo att flyttas */
 f.messages.set(2,oldMsg(2,2025,false));                                  /* oläst – väntar */
 f.messages.set(3,{...oldMsg(3,2025,true),folder:{id:'year-2025',accountId:'a',name:'2025'}}); /* redan i årsmappen */
 f.messages.set(4,{...oldMsg(4,2026,true)});                              /* matchar inte villkoret */
 const r=await f.e.diagnose(C.validateRule(yearRule()));
 assert.equal(r.matched,3,'tre mejl matchar årsvillkoret');
 assert.equal(r.wouldMove,1);
 assert.equal(r.waitingUnread,1);
 assert.equal(r.alreadyInTarget,1);
 assert.equal(f.e.pending.size,0,'diagnosen köar ingenting');
 assert.equal(f.api.calls.length,0,'diagnosen flyttar ingenting');
 assert.equal(f.e.fault,'');
 assert.deepEqual(r.examples.map(e=>e.reason).sort(),['move','target','unread']);
});

test('diagnose works even when the engine is paused or in test mode',async()=>{
 const f=fixture({yearFolders:true,dryRun:true});
 f.e.config.rules=C.validateRules([yearRule()]);
 f.messages.clear();
 f.messages.set(1,oldMsg(1,2025,true));
 f.e.config.paused=true;
 const r=await f.e.diagnose(C.validateRule(yearRule()));
 assert.equal(r.wouldMove,1,'diagnosen räknar även när bevakningen är pausad');
 assert.equal(r.paused,true);
 assert.equal(r.dryRun,true);
 assert.equal(r.engineEnabled,false);
});

test('diagnose reports already queued mail separately',async()=>{
 const f=fixture({yearFolders:true});
 f.e.config.rules=C.validateRules([yearRule()]);
 f.messages.clear();
 f.messages.set(1,oldMsg(1,2025,true));
 await f.e.catchUp('years');
 const r=await f.e.diagnose(C.validateRule(yearRule()));
 assert.equal(r.alreadyQueued,1);
 assert.equal(r.wouldMove,0);
});

test('year template rule uses the rolling year condition',async()=>{
 const f=fixture({yearFolders:true});
 f.e.config.rules=C.validateRules([yearRule({conditions:[{field:'date',op:'beforeThisYear',value:''}]})]);
 f.messages.clear();
 f.messages.set(1,oldMsg(1,2025,true));
 f.messages.set(2,oldMsg(2,2027,true));
 const r=await f.e.sweepAll();
 assert.equal(r.queued,1,'bara tidigare år arkiveras');
 assert.equal(f.e.recordList()[0].target,'year-2025');
 assert.equal(f.e.fault,'');
});

test('shouldOpenWindow suppresses popups during a batch sweep',()=>{
 assert.equal(C.shouldOpenWindow({action:'window',pending:1,sweeping:0,openWindow:true}),true);
 assert.equal(C.shouldOpenWindow({action:'window',pending:1,sweeping:1,openWindow:true}),false);
 assert.equal(C.shouldOpenWindow({action:'window',pending:0,fromSweep:true}),false);
 assert.equal(C.shouldOpenWindow({action:'window',pending:4}),false);
 assert.equal(C.shouldOpenWindow({action:'default',openWindow:true,pending:1}),true);
 assert.equal(C.shouldOpenWindow({action:'default',openWindow:false,pending:1}),false);
 assert.equal(C.shouldOpenWindow({action:'keep',pending:0}),false);
 assert.equal(C.shouldOpenWindow({action:'read',pending:0}),false);
 assert.equal(C.shouldOpenWindow({}),true);
 assert.equal(C.shouldOpenWindow({action:'window',pending:null,sweeping:null}),true);
});





