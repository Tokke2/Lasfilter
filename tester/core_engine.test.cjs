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
test('queue bound defers safely without stopping monitoring',async()=>{const f=fixture();for(let i=1;i<=501;i++)await f.e.enqueue(msg(i));assert.equal(f.e.records.size,500);assert.equal(f.e.fault,'');});

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
