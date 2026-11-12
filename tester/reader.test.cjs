const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const root=path.join(__dirname,'../addon'),source=fs.readFileSync(path.join(root,'reader.js'),'utf8');
async function render(parts,{lang='sv',deny=false,visible=true}={}){
 const dom=new JSDOM(fs.readFileSync(path.join(root,'reader.html'),'utf8'),{url:'https://extension.invalid/reader.html#test-token',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,calls=[];
 w.HTMLElement.prototype.getBoundingClientRect=()=>({height:visible?150:0});
 w.requestAnimationFrame=fn=>w.setTimeout(fn,0);
 w.browser={runtime:{sendMessage:async msg=>{calls.push(msg);if(deny)return {success:false};if(msg.type==='readerReady'){assert(w.document.getElementById('body').textContent.trim());return {success:true,data:true};}return {success:true,data:{parts,lang,subject:'Faktura <script>test</script>',author:'Anna <anna@example.se>',date:Date.UTC(2026,9,12),attachments:['faktura.pdf']}};}}};
 await w.eval(source);return {dom,w,calls};
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
 try{assert.equal(w.document.documentElement.lang,'en');assert.equal(w.document.getElementById('close').textContent,'Close message');assert.match(w.document.getElementById('attachments').textContent,/open in Thunderbird.*faktura.pdf/);}finally{dom.window.close();}
});
test('läsfönstret har låst CSP och kräver ingen nätverks-/fönsterbehörighet',()=>{
 const html=fs.readFileSync(path.join(root,'reader.html'),'utf8'),manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
 assert.match(html,/connect-src 'none'/);assert.match(html,/img-src 'none'/);assert.match(html,/frame-src 'none'/);assert(!manifest.permissions.includes('tabs'));assert(!manifest.permissions.includes('windows'));assert(!source.includes('.innerHTML'));
});
