const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {JSDOM}=require('jsdom'),jsQR=require('jsqr');
const source=fs.readFileSync(path.join(__dirname,'../addon/ui.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../addon/ui.html'),'utf8');
const dom=new JSDOM('');
function qr(amount,link){
 const code=source.slice(source.indexOf('function makeQrSvg('),source.indexOf('function updateDonationView('));
 return vm.runInNewContext(code+';({payload:currentSwishQrPayload(),svg:makeQrSvg(link||currentSwishQrPayload())})',{document:dom.window.document,TextEncoder,donateKr:amount,link});
}
for(const amount of [1,25,50,100,200,99999])test('oberoende QR-avkodare läser Swish standard '+amount+' kr',()=>{
 const {payload,svg}=qr(amount);assert.equal(payload,`C0721817177;${amount};SortBro;6`);
 assert.equal(decodeQr(svg),payload);
});
function decodeQr(svg){
 const size=Number(svg.getAttribute('viewBox').split(' ')[2]),scale=6,width=size*scale;
 const pixels=new Uint8ClampedArray(width*width*4).fill(255);
 for(const match of svg.querySelector('path').getAttribute('d').matchAll(/M(\d+),(\d+)h1v1h-1z/g)){
  const x=Number(match[1])*scale,y=Number(match[2])*scale;
  for(let dy=0;dy<scale;dy++)for(let dx=0;dx<scale;dx++){const i=((y+dy)*width+x+dx)*4;pixels[i]=pixels[i+1]=pixels[i+2]=0;}
 }
 const decoded=jsQR(pixels,width,width);assert(decoded,'QR ska kunna avkodas');return decoded.data;
}
for(const [id,url] of [['Paypal','https://paypal.me/Rickard3dPrint'],['Kofi','https://ko-fi.com/tokke2']])test(id+' QR avkodas till samma fasta HTTPS-länk som knappen',()=>{
 const page=new JSDOM(html),anchor=page.window.document.getElementById('donation'+id+'Link');
 assert.equal(anchor.href,url);assert.equal(anchor.target,'_blank');assert.equal(anchor.rel,'noopener noreferrer');
 assert.equal(decodeQr(qr(50,anchor.href).svg),url);
 page.window.close();
});
test('ogiltiga belopp ger aldrig en betalningspayload',()=>{
 for(const value of [0,-1,1.5,100000,NaN,Infinity,null,'50'])assert.equal(qr(value).payload,'');
});
test('donationer använder ingen extern QR-tjänst, lagring eller betalningsrapportering',()=>{
 const code=source.slice(source.indexOf('/* ===== Donationer:'),source.indexOf("$('ruleForm').addEventListener"));
 assert.doesNotMatch(code,/fetch\(|XMLHttpRequest|rpc\(|storage\.|localStorage|swish:\/\//);
 assert.doesNotMatch(html+source,/qrModeCam|view-support|footerSupportBtn/i);
 assert.match(html,/id="donationModal" class="modal" hidden/);
 const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'../addon/manifest.json')));
 assert.match(manifest.content_security_policy,/connect-src 'none'/);
 assert.deepEqual(manifest.permissions,['accountsRead','accountsFolders','messagesRead','messagesMove','messagesUpdate','menus','storage','downloads']);
});
test('stödsidestilen ligger i en enda appdialog med alla befintliga betalningsval',()=>{
 const page=new JSDOM(html),doc=page.window.document,dialog=doc.querySelector('#donationModal');
 assert.equal(doc.querySelectorAll('#donationModal').length,1);
 for(const id of ['donationTitle','donationPaypalLink','donationKofiLink','donateCustomKr','qrSvgWrap','donationClose'])assert.equal(doc.querySelectorAll('#'+id).length,1);
 assert.equal(dialog.querySelectorAll('.donation-payment-grid > section').length,2);
 assert(dialog.querySelector('.donation-body .donation-heading'));
 assert.equal(dialog.querySelector('#donationClose').closest('.donation-body'),null);
 assert.doesNotMatch(dialog.textContent,/Mitt Maskinkök|~55%|80\+|ÖPPEN KÄLLKOD/);
 assert.equal(dialog.querySelectorAll('script,iframe,img').length,0);page.window.close();
});
test('donationsstilen har mörkt tema och begränsar rörelse och chipstilar till dialogen',()=>{
 const css=fs.readFileSync(path.join(__dirname,'../addon/ui.css'),'utf8');
 const section=css.slice(css.indexOf('/* Donationer under Hjälp:'),css.indexOf('.copy-errors-fallback'));
 assert.match(section,/:root\[data-theme="dark"\] \.donation-dialog/);
 assert.match(section,/@media \(prefers-reduced-motion: no-preference\)/);
 assert.doesNotMatch(section,/(?:^|\n)\.bchip[ .{]/);
 assert.match(section,/\.donation-dialog :focus-visible/);
});
