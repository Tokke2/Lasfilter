const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),path=require('path');
const ADDON=path.join(__dirname,'..','addon');
const css=fs.readFileSync(path.join(ADDON,'ui.css'),'utf8');
const html=fs.readFileSync(path.join(ADDON,'ui.html'),'utf8');
const js=fs.readFileSync(path.join(ADDON,'ui.js'),'utf8');
function block(selector){
 const start=css.indexOf(selector);
 assert.ok(start>=0,selector+' saknas');
 const open=css.indexOf('{',start),close=css.indexOf('}',open);
 return css.slice(open+1,close);
}
function token(selector,name){
 const match=block(selector).match(new RegExp('--'+name+':\\s*(#[0-9a-fA-F]{6})'));
 assert.ok(match,selector+' saknar --'+name);
 return match[1];
}
const lum=hex=>{
 const parts=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4);
 return 0.2126*parts[0]+0.7152*parts[1]+0.0722*parts[2];
};
const ratio=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);};

test('lokala systemtypsnitt används utan externa teckensnitt eller nätanrop',()=>{
 assert.match(block(':root'),/--font-ui:[^;]*system-ui/,'systemtypsnitt ska ligga först');
 assert.doesNotMatch(css,/@import|fonts\.googleapis|fonts\.gstatic|url\(['"]?https?:/,'inga externa teckensnitt i tillägget');
 const body=css.match(/body\s*\{[^}]*\}/s)[0];
 assert.match(body,/font-family:\s*var\(--font-ui\)/);
 assert.match(js,/document\.documentElement\.style\.setProperty\('--base'/,'textstorleken ska fortfarande styras av inställningen');
});

test('ljus och mörk palett håller läsbar kontrast',()=>{
 for(const [label,selector] of [['ljust',':root'],['mörkt',':root[data-theme="dark"]']]){
  const bg=token(selector,'bg'),card=token(selector,'card'),text=token(selector,'text'),muted=token(selector,'muted');
  const primary=token(selector,'primary-bg'),onPrimary=token(selector,'primary-text');
  assert.ok(ratio(text,bg)>=7,label+': brödtext mot bakgrund');
  assert.ok(ratio(text,card)>=7,label+': brödtext mot kort');
  assert.ok(ratio(muted,card)>=4.5,label+': dämpad text mot kort');
  assert.ok(ratio(onPrimary,primary)>=4.5,label+': knapptext mot primärknapp');
  assert.ok(ratio(token(selector,'accent'),token(selector,'accent-soft'))>=4.5,label+': accent mot mjuk accent');
 }
});

test('arbetsytan använder skärmbredden men håller formulär läsbara',()=>{
 const wide=[...css.matchAll(/\.tabbed-workspace main\s*\{[^}]*max-width:\s*(\d+)px/gs)].pop();
 assert.ok(wide&&Number(wide[1])>=1440,'huvudytan ska kunna bli minst 1440 px');
 assert.match(css,/@media \(min-width: 1600px\)[\s\S]*?max-width:\s*1560px/,'mycket breda fönster får större arbetsyta');
 assert.match(css,/\.settings-body\s*\{[^}]*max-width:\s*880px/s,'inställningstexten ska inte bli oläsligt bred');
 assert.match(css,/main\s*\{[^}]*padding:\s*0 clamp\(/s,'sidmarginalen ska anpassas efter fönstret');
 assert.match(css,/@media \(max-width: 700px\)/,'smala fönster ska ha egen anpassning');
});

test('ikoner är enhetliga, lokala och dolda för skärmläsaren när etiketten räcker',()=>{
 const symbols=[...html.matchAll(/<symbol id="(i-[a-z]+)"/g)].map(m=>m[1]);
 assert.deepEqual([...new Set(symbols)].sort(),['i-activity','i-heart','i-help','i-moon','i-play','i-rules','i-search','i-settings','i-suggestions','i-sun']);
 const uses=[...html.matchAll(/<use(?: id="[^"]+")? href="#(i-[a-z]+)"/g)].map(m=>m[1]);
 for(const id of uses)assert.ok(symbols.includes(id),'okänd ikon: '+id);
 assert.equal([...html.matchAll(/class="nav-icon"/g)].length,8,'fem flikikoner, temaknapp och två statistikikoner');
 assert.doesNotMatch(html,/aria-hidden="true">[▤✧◷⚙?◐]<\/span>/,'gamla textglyfer ska inte användas som ikoner');
 for(const symbol of symbols){
  const full=html.match(new RegExp('<symbol id="'+symbol+'"[^>]*>[\\s\\S]*?</symbol>'))[0];
  assert.match(full,/viewBox="0 0 24 24"/,symbol+' ska ha 24 px-rutnät');
  assert.doesNotMatch(full,/<image|href="http|style=/,'symbolen ska vara vektor och lokal');
 }
 assert.match(css,/\.nav-icon\s*\{[^}]*stroke:\s*currentColor/s,'ikonerna ska ärva textfärgen');
 assert.match(css,/\.nav-icon\s*\{[^}]*width:\s*20px/s);
 assert.match(css,/\.nav-icon\s*\{[^}]*shape-rendering:\s*geometricPrecision/s,'ikonerna ska ritas skarpt');
});

test('tema, systemval och fokusmarkering är kompletta',()=>{
 for(const value of ['system','light','dark'])assert.match(html,new RegExp('id="theme"[\\s\\S]*?<option value="'+value+'"'),'temaalternativ saknas: '+value);
 assert.match(css,/button:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--focus\)/s);
 assert.match(css,/input:focus,[\s\S]*?outline:\s*2px solid color-mix\(in srgb, var\(--focus\)/);
 assert.match(css,/@media \(prefers-reduced-motion: reduce\)/,'rörelse ska kunna stängas av');
 assert.match(js,/themeIconUse.*#i-sun.*#i-moon|#i-sun.*#i-moon/,'temaknappen ska visa rätt nästa val');
});

test('text och ikoner ritas skarpt utan suddig antialiasing',()=>{
 assert.doesNotMatch(css,/-webkit-font-smoothing:\s*antialiased/,'antialiasing ska inte göra texten tunn och grumlig');
 assert.doesNotMatch(css,/text-rendering:\s*optimizeLegibility/,'ingen påtvingad textrendering');
 assert.doesNotMatch(css,/font-weight:\s*(?:650|750|550)\b/,'endast standardvikter som teckensnittet har');
 assert.match(css,/body,[\s\S]*?letter-spacing:\s*0;/,'brödtexten ska inte ha negativ teckenbredd');
 assert.match(css,/shape-rendering:\s*geometricPrecision/,'SVG-kanter ska vara skarpa');
 assert.match(css,/\.search:focus-within[\s\S]*?box-shadow:\s*none/,'fokus ska vara en skarp ram, inte en mjuk skugga');
});

test('hög DPI, tydliga rubriker och jämna kolumner utan mjuk skalning',()=>{
 assert.match(css,/text-size-adjust:\s*100%/,'textskalningen ska följa systemet');
 assert.match(css,/h1, h2, h3,[\s\S]*?letter-spacing:\s*0;/,'rubrikerna ska inte ha negativ teckenbredd');
 assert.match(css,/text-wrap:\s*balance/,'rubriker ska balanseras över raderna');
 assert.match(css,/text-wrap:\s*pretty/,'brödtexten ska få jämn radbrytning');
 assert.match(html,/id="brandLogo"[\s\S]*?width="32"[\s\S]*?height="32"/,'logotypen ska ha exakt 32 px-ruta');
 assert.match(js,/img\.srcset=base\+'-32\.png 1x, '\+base\+'-64\.png 2x'/,'logotypen ska välja 64 px på 2x-skärmar');
 assert.match(js,/img\.sizes='32px'/,'bildens storlek ska vara känd för webbläsaren');
 assert.match(css,/\.tabbed-workspace \.brand img\s*\{[^}]*width:\s*32px/s,'logotypen ska inte skalas från 38 px');
 assert.match(css,/@media \(max-width: 680px\)[\s\S]*?\.app-tabs \.nav \{[\s\S]*?align-items:\s*flex-start/,'tvåradig flik ska linjera ikonen med första raden');
});

test('layouten har steg för smala, vanliga och mycket breda fönster',()=>{
 assert.match(css,/@media \(max-width: 680px\)[\s\S]*?grid-template-columns: repeat\(6/,'flikarna radbryts i två balanserade rader på smala skärmar');
 assert.match(css,/@media \(min-width: 2000px\)[\s\S]*?max-width:\s*1680px/,'mycket breda fönster får en större arbetsyta');
 assert.match(css,/@media \(pointer: coarse\)[\s\S]*?min-height:\s*44px/,'pekytor ska vara minst 44 px');
 assert.match(css,/@media \(prefers-contrast: more\)/,'ökad kontrast ska stödjas');
 assert.match(css,/@media \(forced-colors: active\)/,'tvingade systemfärger ska stödjas');
});
