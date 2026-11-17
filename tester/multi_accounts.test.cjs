const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../addon/core.js'),Engine=require('../addon/engine.js'),F=require('../addon/filters.js');
const raw=()=>({id:'multi',name:'Shared invoices',enabled:true,scope:'account',source:'a-in',sourceAccount:'a',sourceAccounts:['a','b'],target:'shared',match:'all',conditions:[{field:'domain',op:'equals',value:'example.se'}],readFilter:'read',unreadAction:'keep',openTiming:'before'});
const msg=(id,account='a',read=true)=>({id,read,folder:{id:account+'-in',accountId:account},author:'Test <test@example.se>',subject:'Invoice',size:500,date:new Date('2026-10-01'),headerMessageId:'multi-'+id+'@example.invalid'});
function fixture({dryRun=false,targetAccount='c',brake=false}={}){
 const nodes=new Map(),accounts=[];let now=Date.UTC(2026,9,12),e;
 for(const id of ['a','b','c']){
  const folders=[{id:id+'-in',name:'Inbox',accountId:id,specialUse:['inbox']},{id:id+'-sub',name:'Sub',accountId:id},{id:id+'-junk',name:'Junk',accountId:id,specialUse:['junk']}];
  if(id===targetAccount)folders.push({id:'shared',name:'Shared',accountId:id});
  for(const f of folders)nodes.set(f.id,f);
  accounts.push({id,rootFolder:{id:id+'-root',accountId:id,isRoot:true,subFolders:folders}});
 }
 const messages=new Map([[1,msg(1)],[2,msg(2,'b')],[3,msg(3,'c')]]),calls=[],queries=[],persisted=[];
 const api={accounts:{list:async()=>accounts},folders:{get:async id=>nodes.get(id),getFolderCapabilities:async()=>({canAddMessages:true,canDeleteMessages:true})},
 tabs:{query:async()=>[]},messageDisplay:{getDisplayedMessages:async()=>[]},messages:{
 get:async id=>structuredClone(messages.get(id)),query:async q=>{queries.push(q.folderId);return {messages:[...messages.values()].filter(m=>m.folder.id===q.folderId&&(q.unread===undefined||m.read===!q.unread)&&(q.headerMessageId===undefined||m.headerMessageId===q.headerMessageId))};},abortList:async()=>{},
 move:async(ids,target)=>{calls.push({ids,target});for(const id of ids){const before=messages.get(id),after={...before,id:id+1000,folder:nodes.get(target)};messages.delete(id);messages.set(after.id,after);await e.onMoved({messages:[before]},{messages:[after]});}}
 }};
 e=new Engine(api,{...C.defaults(),dryRun,rules:[C.validateRule(raw())]},{now:()=>now,ackTimeout:1,persist:async()=>persisted.push(structuredClone(e.recordList())),brakeLimit:brake?()=>({limit:1,median:1}):undefined});
 return {e,api,accounts,nodes,messages,calls,queries,persisted,advance:()=>now+=2100};
}
test('legacy single-account rules and folder rules do not gain extra accounts',()=>{
 const old=raw();delete old.sourceAccounts;const rule=C.validateRule(old);assert.deepEqual(C.accountIds(rule),['a']);assert(!Object.hasOwn(rule,'sourceAccounts'));
 const folder=C.validateRule({...old,scope:'folder'});assert.deepEqual(C.accountIds(folder),[]);assert(C.match(folder,msg(1)));assert(!C.match(folder,msg(2,'b')));
});
test('multiple accounts survive validation and config JSON round-trip without aliasing',()=>{
 const input=raw(),r=C.validateRule(input);input.sourceAccounts.push('c');assert.deepEqual(r.sourceAccounts,['a','b']);
 const cfg=C.config(JSON.parse(JSON.stringify({...C.defaults(),rules:[r]})));assert.deepEqual(cfg.rules[0],r);assert.equal(r.target,'shared');
});
for(const sourceAccounts of [[],null,'a',[null],[''],['a','a'],['a',42],Array.from({length:101},(_,i)=>'a'+i)])test('invalid account selection rejected: '+JSON.stringify(sourceAccounts).slice(0,55),()=>assert.throws(()=>C.validateRule({...raw(),sourceAccounts})));
test('account list cannot silently contradict legacy anchor or folder scope',()=>{
 assert.throws(()=>C.validateRule({...raw(),sourceAccount:'b'}));assert.throws(()=>C.validateRule({...raw(),scope:'folder'}));
 const single=C.validateRule({...raw(),sourceAccounts:['a']});assert(!Object.hasOwn(single,'sourceAccounts'));assert.deepEqual(C.accountIds(single),['a']);
});
test('matching, explanation, search and conflicts include every selected account only',()=>{
 const r=C.validateRule(raw());for(const id of ['a','b']){assert(C.match(r,msg(1,id)));assert.equal(C.explainRule(r,msg(1,id)).reason,'');}
 assert(!C.match(r,msg(1,'c')));assert(C.explainRule(r,msg(1,'c')).reason);
 const second={...r,id:'second',sourceAccount:'b',sourceAccounts:undefined,target:'other'};
 assert(C.sourcesOverlap(r,second));assert.equal(C.conflicts([r,second]).length,1);
 assert(C.sourcesOverlap(r,{scope:'folder',source:'b-in'},id=>id==='b-in'?'b':''));assert(!C.sourcesOverlap(r,{scope:'account',sourceAccount:'c'}));
 assert(C.ruleMatchesSearch(r,'Work', [{accountId:'b',accountName:'Work'}]));
});
test('all selected accounts must exist and destination must accept messages',async()=>{
 const f=fixture(),r=f.e.config.rules[0];await f.e.validateRuleFolders(r);
 f.accounts.splice(1,1);await assert.rejects(f.e.validateRuleFolders(r),e=>e.code==='unsafe_folder');await assert.rejects(f.e.ruleFolders(r),e=>e.code==='unsafe_folder');assert.equal(f.queries.length,0);
 const g=fixture();g.api.folders.getFolderCapabilities=async()=>({canAddMessages:false});await assert.rejects(g.e.validateRuleFolders(g.e.config.rules[0]),e=>e.code==='read_only');
});
test('sweep unions only selected accounts, excludes special folders and common destination',async()=>{
 const f=fixture({targetAccount:'b'}),r=f.e.config.rules[0];
 const folders=(await f.e.ruleFolders(r)).folders;assert.deepEqual(folders.map(x=>x.id),['a-in','a-sub','b-in','b-sub']);
 const result=await f.e.sweepRule(r,{force:true});assert.equal(result.queued,2);assert(!f.queries.some(x=>x.startsWith('c-')||x.includes('junk')||x==='shared'));
 assert.deepEqual([...f.e.pending.values()].map(j=>[j.record.source,j.record.target]),[['a-in','shared'],['b-in','shared']]);
 await f.e.tick();assert.equal(f.calls.length,2);assert(f.calls.every(x=>x.target==='shared'));assert(f.messages.has(3));
});
test('live read event from second account journals actual folder and moves after closure gate',async()=>{
 const f=fixture();assert(await f.e.readChanged(f.messages.get(2),{read:true},{read:false}));assert.equal(f.e.pending.get(2).record.source,'b-in');
 await f.e.tick();assert.equal(f.calls.length,0);f.advance();await f.e.tick();assert.deepEqual(f.calls,[{ids:[2],target:'shared'}]);assert.equal(f.e.stats.moved,1);
});
test('unselected accounts and unread messages still stay in source',async()=>{
 const f=fixture();assert.equal(await f.e.enqueue(f.messages.get(3)),false);f.messages.set(2,msg(2,'b',false));assert.equal(await f.e.enqueue(f.messages.get(2)),false);assert.equal(f.calls.length,0);
});
test('new inbox arrival from second account respects before-reader receipt and close delay',async()=>{
 const f=fixture();f.e.config.rules=[C.validateRule({...raw(),readFilter:'both',unreadAction:'window'})];f.messages.set(2,msg(2,'b',false));let closed=false;
 f.e.hooks.beforeMove=async()=>closed;
 assert.equal(await f.e.newInboxMessages([f.messages.get(2)]),1);await f.e.tick();assert.equal(f.calls.length,0);assert.equal(f.e.pending.get(2).record.source,'b-in');
 closed=true;await f.e.tick();assert.equal(f.calls.length,0);f.advance();await f.e.tick();assert.equal(f.calls.length,1);
});
test('diagnose and dry run span both accounts without moving',async()=>{
 const f=fixture({dryRun:true}),r=f.e.config.rules[0];const report=await f.e.diagnose(r);assert.equal(report.matched,2);assert.equal(report.wouldMove,2);assert.equal(f.e.pending.size,0);
 await f.e.sweepRule(r,{force:true});await f.e.tick();assert.equal(f.calls.length,0);assert.equal(f.e.stats.simulated,2);
});
test('pending journal restores second-account job against the actual source',async()=>{
 const f=fixture();await f.e.enqueue(f.messages.get(2));const records=f.e.recordList();await f.e.clearPending();await f.e.restore(records);assert.equal(f.e.pending.get(2).record.source,'b-in');
});
test('loss of delete capability never converts a cross-account move to copy',async()=>{
 const f=fixture();f.api.folders.getFolderCapabilities=async id=>({canAddMessages:true,canDeleteMessages:id!=='b-in'});await f.e.enqueue(f.messages.get(2));await f.e.tick();f.advance();await f.e.tick();assert.equal(f.calls.length,0);assert(f.messages.has(2));
});
test('Thunderbird filter export refuses to silently drop multi-account scope',()=>{
 const r=C.validateRule(raw()),out=F.buildFilterFile([r],{uriOf:{multi:{uriPrefix:'imap://x/',folderPath:'Shared'}}});assert.equal(out.report.written,0);assert.equal(out.report.skipped,1);assert(out.report.notes.includes('multipleAccounts'));assert(!out.text.includes('action='));
});

test('safety brake counts the combined sweep and clears pending jobs from both accounts',async()=>{
 const f=fixture({brake:true});const result=await f.e.sweepRule(f.e.config.rules[0],{force:true});assert.equal(result.held,true);assert.equal(f.e.heldRule('multi').matched,2);assert.equal(f.e.pending.size,0);await f.e.tick();assert.equal(f.calls.length,0);
});
test('global queue limit stays at 100 across selected accounts',async()=>{
 const f=fixture();f.messages.clear();for(let i=1;i<=101;i++)f.messages.set(i,msg(i,i%2?'a':'b'));
 const result=await f.e.sweepRule(f.e.config.rules[0],{force:true});assert.equal(f.e.pending.size,100);assert.equal(result.deferred,1);assert.equal(f.calls.length,0);
});
test('trial scans all selected accounts without queues, moves or directory creation',async()=>{
 const f=fixture();f.e.config.rules[0].trialUntil=Date.UTC(2027,0,1);const r=await f.e.sweepRule(f.e.config.rules[0],{force:true});assert.equal(r.trial,true);assert.equal(r.wouldQueue,2);assert.equal(f.e.pending.size,0);assert.equal(f.calls.length,0);
});

test('live read in a selected account subfolder uses its actual source, not anchor',async()=>{
 const f=fixture();const m={...msg(8,'b'),folder:{id:'b-sub',accountId:'b'}};f.messages.set(8,m);assert(await f.e.enqueue(m));assert.equal(f.e.pending.get(8).record.source,'b-sub');await f.e.tick();f.advance();await f.e.tick();assert.deepEqual(f.calls,[{ids:[8],target:'shared'}]);
});
test('newly added account is never selected implicitly',async()=>{
 const f=fixture();f.accounts.push({id:'d',folders:[{id:'d-in',accountId:'d'}]});assert(!C.match(f.e.config.rules[0],msg(4,'d')));assert(!(await f.e.ruleFolders(f.e.config.rules[0])).folders.some(x=>x.accountId==='d'));
});

test('year destination is shared and created once across selected source accounts',async()=>{
 const f=fixture();f.e.config.rules[0].yearFolders=true;let created=0;
 f.api.folders.create=async(parent,name)=>{created++;const folder={id:parent+'-'+name,name,accountId:'c'};f.nodes.set(folder.id,folder);return folder;};
 await f.e.sweepRule(f.e.config.rules[0],{force:true});assert.equal(created,1);assert.deepEqual([...f.e.pending.values()].map(j=>j.record.target),['shared-2026','shared-2026']);await f.e.tick();assert.equal(f.calls.length,2);assert(f.calls.every(c=>c.target==='shared-2026'));
});
test('existing branch conditions still choose shared branch targets for either account',async()=>{
 const f=fixture();f.e.config.rules[0].branches=[{condition:{field:'subject',op:'contains',value:'Invoice'},target:'c-sub'}];await f.e.sweepRule(f.e.config.rules[0],{force:true});assert.deepEqual([...f.e.pending.values()].map(j=>j.record.target),['c-sub','c-sub']);
});
