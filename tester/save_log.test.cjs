const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const C=require('../addon/core.js');
const source=fs.readFileSync(path.join(__dirname,'../addon/ui.js'),'utf8');
// Execute the actual small helper and click handler, without loading unrelated UI.
const helper=source.slice(source.indexOf('async function saveLogTextAs('),source.indexOf("let rulePanel='list'"));
const handler=source.slice(source.indexOf('let savingLogAs=false;'),source.indexOf("handle('exportErrorLog','click'"));
function setup({download=async()=>17,demo=false,rpcError=false}={}){
 const calls=[],blobs=[],revoked=[],timers=[],toasts=[],rpcCalls=[],button={disabled:false};let click;
 const sandbox={C,Blob,Date,Number,String,Error,DEMO:demo,globalThis:null,
  browser:{downloads:{download:async args=>{calls.push(args);return download(args);}}},
  URL:{createObjectURL:blob=>{blobs.push(blob);return 'blob:log-'+blobs.length;},revokeObjectURL:url=>revoked.push(url)},
  setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length;},
  $:()=>button,paths:()=>({logs:'Lasfilter/logs/'}),T:key=>key,toast:text=>toasts.push(text),
  rpc:async type=>{rpcCalls.push(type);if(rpcError)throw new C.RuleError('internal_error');return 'Teknisk logg\r\nÅäö\r\n';},
  handle:(id,event,fn)=>{assert.equal(id,'saveLogAs');assert.equal(event,'click');click=fn;}
 };
 sandbox.globalThis=sandbox;vm.runInNewContext(helper+handler+'\nglobalThis.save=saveLogTextAs;',sandbox);
 return {sandbox,save:sandbox.save,click:()=>click(),calls,blobs,revoked,timers,toasts,rpcCalls,button};
}
test('manuell textlogg använder alltid spara-dialog och ingen tyst överskrivning',async()=>{
 const f=setup(),text='Version: 1.2.3\r\nÅäö\r\n';
 assert.equal(await f.save(text,'Lasfilter/logs/logg.txt'),true);
 assert.equal(f.calls.length,1);assert.equal(f.calls[0].saveAs,true);assert.equal(f.calls[0].conflictAction,'uniquify');assert.equal(f.calls[0].filename,'Lasfilter/logs/logg.txt');
 assert.equal(await f.blobs[0].text(),text);assert.equal(f.blobs[0].type,'text/plain;charset=utf-8');
 assert.equal(f.revoked.length,0);assert.equal(f.timers[0].ms,60000);f.timers[0].fn();assert.deepEqual(f.revoked,['blob:log-1']);
});
test('Avbryt ger ingen reservnedladdning eller falsk sparbekräftelse',async()=>{
 for(const message of ['Download canceled by the user','Download cancelled','NS_ERROR_ABORT']){
  const f=setup({download:async()=>{throw Error(message);}});await f.click();
  assert.equal(f.calls.length,1);assert.deepEqual(f.toasts,['saveLogAsCancelled']);assert.equal(f.button.disabled,false);assert.equal(f.timers.length,1);
 }
});
test('inget nedladdnings-ID räknas inte som en startad export',async()=>{
 for(const result of [undefined,null,false,-1,'17']){
  const f=setup({download:async()=>result});assert.equal(await f.save('logg','Lasfilter/logs/logg.txt'),false);assert.equal(f.calls.length,1);
 }
});
test('skrivfel visas utan fel sökväg, reservfil eller läckt systemfel',async()=>{
 const f=setup({download:async()=>{throw Error('Access denied C:\\private\\USER');}});
 await assert.rejects(f.click(),error=>error.code==='log_save_failed'&&!error.message.includes('USER'));
 assert.equal(f.calls.length,1);assert.equal(f.blobs.length,1);assert.deepEqual(f.toasts,[]);assert.equal(f.button.disabled,false);assert.equal(f.timers.length,1);
});
test('saknad spara-API sparar ingen fil på annan plats',async()=>{
 const f=setup();f.sandbox.browser={};
 await assert.rejects(f.save('logg','Lasfilter/logs/logg.txt'),error=>error.code==='log_save_unavailable');assert.equal(f.blobs.length,0);assert.equal(f.calls.length,0);
});
test('dubbelklick öppnar en enda dialog och knappen återställs efteråt',async()=>{
 let finish;const f=setup({download:()=>new Promise(resolve=>finish=resolve)});
 const first=f.click();await new Promise(r=>setImmediate(r));assert.equal(f.button.disabled,true);
 await f.click();assert.equal(f.calls.length,1);finish(23);await first;
 assert.equal(f.button.disabled,false);assert.deepEqual(f.rpcCalls,['exportTextLog']);assert.deepEqual(f.toasts,['saveLogAsStarted']);
 assert.match(f.calls[0].filename,/^Lasfilter\/logs\/sortbro-tekniklogg-\d{4}-\d{2}-\d{2}\.txt$/);
});
test('misslyckad logghämtning öppnar ingen dialog och lämnar knappen användbar',async()=>{
 const f=setup({rpcError:true});await assert.rejects(f.click());assert.equal(f.calls.length,0);assert.equal(f.button.disabled,false);assert.deepEqual(f.toasts,[]);
});
test('förhandsvisningen låtsas inte kunna välja Dokument eller spara en fil',async()=>{
 const f=setup({demo:true});await f.click();assert.deepEqual(f.toasts,['saveLogAsDemo']);assert.equal(f.calls.length,0);assert.equal(f.rpcCalls.length,0);assert.equal(f.button.disabled,false);
});
