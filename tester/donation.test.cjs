const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {JSDOM}=require('jsdom'),jsQR=require('jsqr');
const source=fs.readFileSync(path.join(__dirname,'../addon/ui.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../addon/ui.html'),'utf8');
const dom=new JSDOM('');
function qr(amount){
 const code=source.slice(source.indexOf('function makeQrSvg('),source.indexOf('function updateDonationView('));
 return vm.runInNewContext(code+';({payload:currentSwishQrPayload(),svg:makeQrSvg(currentSwishQrPayload())})',{document:dom.window.document,TextEncoder,donateKr:amount});
}
for(const amount of [1,25,50,100,200,99999])test('oberoende QR-avkodare läser Swish standard '+amount+' kr',()=>{
 const {payload,svg}=qr(amount);assert.equal(payload,`C0721817177;${amount};SortBro;6`);
 const size=Number(svg.getAttribute('viewBox').split(' ')[2]),scale=6,width=size*scale;
 const pixels=new Uint8ClampedArray(width*width*4).fill(255);
 for(const match of svg.querySelector('path').getAttribute('d').matchAll(/M(\d+),(\d+)h1v1h-1z/g)){
  const x=Number(match[1])*scale,y=Number(match[2])*scale;
  for(let dy=0;dy<scale;dy++)for(let dx=0;dx<scale;dx++){const i=((y+dy)*width+x+dx)*4;pixels[i]=pixels[i+1]=pixels[i+2]=0;}
 }
 const decoded=jsQR(pixels,width,width);assert(decoded,'QR ska kunna avkodas');assert.equal(decoded.data,payload);
});
test('ogiltiga belopp ger aldrig en betalningspayload',()=>{
 for(const value of [0,-1,1.5,100000,NaN,Infinity,null,'50'])assert.equal(qr(value).payload,'');
});
test('donationer har bara Swish; ingen externa QR-tjänst, lagring eller betalningsrapportering',()=>{
 const code=source.slice(source.indexOf('/* ===== Donationer:'),source.indexOf("$('ruleForm').addEventListener"));
 assert.doesNotMatch(code,/fetch\(|XMLHttpRequest|rpc\(|storage\.|localStorage|swish:\/\//);
 assert.doesNotMatch(html+source,/paypal|ko-fi|qrModeCam|view-support|footerSupportBtn/i);
 assert.match(html,/id="donationModal" class="modal" hidden/);
 const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'../addon/manifest.json')));
 assert.match(manifest.content_security_policy,/connect-src 'none'/);
 assert.deepEqual(manifest.permissions,['accountsRead','accountsFolders','messagesRead','messagesMove','messagesUpdate','menus','storage','downloads']);
});
