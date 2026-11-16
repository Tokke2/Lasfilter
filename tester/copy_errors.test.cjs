const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../addon/ui.js'),'utf8');
const code=source.slice(source.indexOf('async function writeErrorClipboard('),source.indexOf("handle('exportErrorLog','click'"));
function setup({clipboard,reply='SORTBRO – SAMLAD FELLOGG\r\nwindow_error\r\nmove_error\r\n',demo=false,activeView='activity',inert=false}={}){
 const elements=Object.fromEntries(['copyErrors','copyErrorsText','copyErrorsFallback'].map(id=>[id,{disabled:false,value:'',hidden:true,focus(){focused=id;},select(){selected=true;},scrollIntoView(){}}]));
 const handlers={},toasts=[],requests=[];let focused='',selected=false;
 const context={navigator:{clipboard},DEMO:demo,activeView,document:{querySelector:()=>({inert})},$:id=>elements[id],T:key=>key,toast:x=>toasts.push(x),handle:(id,event,fn)=>handlers[id]=fn,
  rpc:async type=>{requests.push(type);return typeof reply==='function'?reply():reply;}};
 vm.runInNewContext(code,context);
 return {elements,click:id=>handlers[id||'copyErrors'](),toasts,requests,focus:()=>focused,selected:()=>selected};
}
test('kopierar hela felarkivets text, inte filtrerade eller synliga rader',async()=>{
 const text='SORTBRO\r\n'+Array.from({length:5000},(_,i)=>'fel '+i+' åäö').join('\r\n'),writes=[];
 const f=setup({reply:text,clipboard:{writeText:async t=>writes.push(t)}});await f.click();
 assert.deepEqual(writes,[text]);assert.deepEqual(f.requests,['exportErrorLog']);assert.deepEqual(f.toasts,['copyErrorsDone']);assert.equal(f.elements.copyErrors.disabled,false);assert.equal(f.elements.copyErrorsFallback.hidden,true);
});
test('nekad eller saknad urklippsåtkomst ger markerbar text utan falsk framgång',async()=>{
 for(const clipboard of [undefined,{}, {writeText:async()=>{throw Error('NotAllowedError');}}]){
  const f=setup({clipboard});await f.click();assert.equal(f.elements.copyErrorsFallback.hidden,false);assert.match(f.elements.copyErrorsText.value,/window_error\r\nmove_error/);
  assert.equal(f.focus(),'copyErrorsText');assert(f.selected());assert.deepEqual(f.toasts,['copyErrorsManual']);assert.equal(f.elements.copyErrors.disabled,false);
 }
});
test('dubbelklick hämtar och kopierar bara en gång',async()=>{
 let finish;const writes=[],f=setup({reply:()=>new Promise(r=>finish=r),clipboard:{writeText:async t=>writes.push(t)}});
 const first=f.click();assert(f.elements.copyErrors.disabled);await f.click();assert.equal(f.requests.length,1);finish('alla fel');await first;assert.deepEqual(writes,['alla fel']);assert(!f.elements.copyErrors.disabled);
});
test('fel i logghämtningen visas av vanliga felhanteraren utan falsk kopiering',async()=>{
 const f=setup({reply:()=>{throw Error('RPC failed');}});await assert.rejects(f.click(),/RPC failed/);assert.deepEqual(f.toasts,[]);assert(f.elements.copyErrorsFallback.hidden);assert(!f.elements.copyErrors.disabled);
});
test('fallback stjäl inte fokus från en annan flik eller öppen dialog',async()=>{
 for(const options of [{activeView:'settings'},{inert:true}]){
  const f=setup(options);await f.click();assert.equal(f.focus(),'');assert.equal(f.selected(),false);assert(!f.elements.copyErrorsFallback.hidden);
 }
});
test('förhandsvisningens kopia märks som exempeldata',async()=>{
 const f=setup({demo:true});await f.click();assert(f.elements.copyErrorsText.value.startsWith('copyErrorsDemo\r\n\r\n'));
});
test('Markera allt och Stäng fungerar utan urklippsbehörighet',async()=>{
 const f=setup();await f.click();await f.click('copyErrorsSelect');assert(f.selected());await f.click('copyErrorsHide');assert(f.elements.copyErrorsFallback.hidden);assert.equal(f.elements.copyErrorsText.value,'');assert.equal(f.focus(),'copyErrors');
});
