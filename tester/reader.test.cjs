const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const root=path.join(__dirname,'../addon'),source=fs.readFileSync(path.join(root,'reader.js'),'utf8');
async function render(parts,{lang='sv',deny=false,visible=true,readerPause={paused:false,until:0}}={}){
 const dom=new JSDOM(fs.readFileSync(path.join(root,'reader.html'),'utf8'),{url:'https://extension.invalid/reader.html#test-token',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,calls=[],controls={failPause:false,wait:null,listener:null};
 w.HTMLElement.prototype.getBoundingClientRect=()=>({height:visible?150:0});
 w.requestAnimationFrame=fn=>w.setTimeout(fn,0);
 w.browser={runtime:{id:'reader-addon',onMessage:{addListener:fn=>controls.listener=fn},sendMessage:async msg=>{
  calls.push(msg);if(deny)return {success:false};
  if(msg.type==='readerReady'){assert(w.document.getElementById('body').textContent.trim());return {success:true,data:true};}
  if(msg.type==='readerPause'){
   if(controls.wait)await controls.wait;
   if(controls.failPause)return {success:false};
   const C=require('../addon/core.js');readerPause=C.readerPauseState(C.readerPauseDeadline(msg.mode));return {success:true,data:readerPause};
  }
  if(msg.type==='readerState')return {success:true,data:readerPause};
  return {success:true,data:{parts,lang,readerPause,subject:'Faktura <script>test</script>',author:'Anna <anna@example.se>',date:Date.UTC(2026,9,12),attachments:['faktura.pdf']}};
 }}};
 await w.eval(source);return {dom,w,calls,controls};
}
test('läsfönster skriver mejltext före kvitto och behåller stängknappen',async()=>{
 const {dom,w,calls}=await render([{type:'text/plain',body:'Hej Rickard!\nDin faktura är betald.'}]);
 try{assert.equal(calls[1].type,'readerReady');assert.equal(calls[1].token,'test-token');assert.match(w.document.getElementById('body').textContent,/faktura är betald/);assert.match(w.document.getElementById('status').textContent,/tills du stänger/);assert.equal(w.document.querySelectorAll('h1 script').length,0);assert.equal(w.document.getElementById('error').hidden,true);}finally{dom.window.close();}
});
test('HTML-mejl visas som text utan skript, bilder, formulär eller klickbara fjärrlänkar',async()=>{
 const {dom,w,calls}=await render([{type:'text/html',body:'<style>SECRET</style><script>window.pwned=1</script><p>Faktura <b>1042</b></p><img src="https://bad.invalid/track"><a href="javascript:alert(1)">Betala</a><iframe src="https://bad.invalid"></iframe><form action="https://bad.invalid"><input value="secret"></form><svg onload="window.pwned=2"></svg>'}]);
 try{const body=w.document.getElementById('body');assert.match(body.textContent,/Faktura 1042/);assert.match(body.textContent,/Betala/);assert(!body.textContent.includes('SECRET'));assert.equal(body.children.length,0);assert.equal(w.pwned,undefined);assert.equal(calls.at(-1).type,'readerReady');}finally{dom.window.close();}
});
test('tom HTML, dold sida och saknat sessionsinnehåll ger synligt fel utan kvitto',async()=>{
 for(const options of [{parts:[{type:'text/html',body:'<img src="cid:image">'}]},{parts:[{type:'text/plain',body:'hej'}],visible:false},{parts:[],deny:true}]){
  const {parts,...opts}=options,{dom,w,calls}=await render(parts,opts);
  try{assert.equal(calls.filter(x=>x.type==='readerReady').length,0);assert.equal(w.document.getElementById('error').hidden,false);assert.match(w.document.getElementById('status').textContent,/spärrad/);}finally{dom.window.close();}
 }
});
test('läsfönstret stöder engelska och förklarar bilagor i klartext',async()=>{
 const {dom,w}=await render([{type:'text/plain',body:'Hello'}],{lang:'en'});
 try{assert.equal(w.document.documentElement.lang,'en');assert.equal(w.document.getElementById('close').textContent,'Close and move once all other views are closed');assert.match(w.document.getElementById('attachments').textContent,/open in Thunderbird.*faktura.pdf/);}finally{dom.window.close();}
});
test('läsfönstret har låst CSP och kräver ingen nätverks-/fönsterbehörighet',()=>{
 const html=fs.readFileSync(path.join(root,'reader.html'),'utf8'),manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
 assert.match(html,/connect-src 'none'/);assert.match(html,/img-src 'none'/);assert.match(html,/frame-src 'none'/);assert(!manifest.permissions.includes('tabs'));assert(!manifest.permissions.includes('windows'));assert(!source.includes('.innerHTML'));
});
test('stängtexten beskriver flytten endast efter kvitterad visning',async()=>{
 const good=await render([{type:'text/plain',body:'Läs mig'}]),bad=await render([]);
 try{
  assert.equal(good.w.document.getElementById('close').textContent,'Stäng och flytta när övriga visningar är stängda');
  assert.equal(bad.w.document.getElementById('close').textContent,'Stäng mejlet');assert.equal(bad.w.document.getElementById('readerPauseControls').hidden,true);
 }finally{good.dom.window.close();bad.dom.window.close();}
});
test('pausval från läsfönstret kräver klick, bevarar texten och kan återupptas',async()=>{
 const {dom,w,calls}=await render([{type:'text/plain',body:'Viktigt mejl'}]);const $=id=>w.document.getElementById(id);
 try{
  assert.equal($('readerPauseControls').hidden,false);$('readerPauseDuration').value='manual';$('readerPauseDuration').dispatchEvent(new w.Event('change'));
  assert.equal(calls.filter(x=>x.type==='readerPause').length,0);
  $('readerPauseApply').click();await new Promise(r=>setImmediate(r));
  assert.equal(calls.at(-1).token,'test-token');assert.equal(calls.at(-1).mode,'manual');assert.equal($('readerPauseResume').hidden,false);
  assert.match($('readerPauseStatus').textContent,/tills du fortsätter/);assert.equal($('body').textContent,'Viktigt mejl');
  $('readerPauseResume').focus();$('readerPauseResume').click();await new Promise(r=>setImmediate(r));
  assert.equal($('readerPauseResume').hidden,true);assert.match($('readerPauseStatus').textContent,/inte pausade/);assert.equal(w.document.activeElement.id,'readerPauseApply');
  assert.equal(calls.filter(x=>x.type==='readerReady').length,1,'paus ger inte ett nytt visningskvitto');
 }finally{dom.window.close();}
});
test('läsfönstrets pausknappar spärrar dubbelklick och visar sparfel utan falskt pausbesked',async()=>{
 const {dom,w,calls,controls}=await render([{type:'text/plain',body:'Mejl'}]);const $=id=>w.document.getElementById(id);
 try{
  let release;controls.wait=new Promise(resolve=>release=resolve);controls.failPause=true;
  $('readerPauseApply').click();$('readerPauseApply').click();assert.equal($('close').disabled,true);assert.equal(calls.filter(x=>x.type==='readerPause').length,1);
  release();await new Promise(r=>setImmediate(r));assert.equal($('readerPauseError').hidden,false);assert.equal($('readerPauseResume').hidden,true);assert.equal($('close').disabled,false);
  assert.match($('readerPauseStatus').textContent,/inte pausade/);assert.equal($('body').textContent,'Mejl');
 }finally{dom.window.close();}
});
test('engelsk pausstatus uppdateras från bakgrunden utan att kasta valt tidsalternativ',async()=>{
 const {dom,w,controls}=await render([{type:'text/plain',body:'Hello'}],{lang:'en',readerPause:{paused:true,until:-1}});const $=id=>w.document.getElementById(id);
 try{
  assert.match($('readerPauseStatus').textContent,/until you resume/);assert.equal($('readerPauseDuration').options[1].textContent,'1 hour');
  $('readerPauseDuration').value='1h';controls.listener({event:'readerPauseChanged',readerPause:{paused:false,until:0}},{id:'not-ours'});assert.equal($('readerPauseResume').hidden,false);
  controls.listener({event:'readerPauseChanged',readerPause:{paused:false,until:0}},{id:'reader-addon'});assert.equal($('readerPauseResume').hidden,true);assert.equal($('readerPauseDuration').value,'1h');
 }finally{dom.window.close();}
});
