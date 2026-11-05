/* Inga körberoenden: läs bara översättningsobjektet, inte gränssnittets sidoeffekter. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'addon/ui.js'),'utf8');
const html=fs.readFileSync(path.join(root,'addon/ui.html'),'utf8');
const start=source.indexOf('const I18N='),end=source.indexOf('\nconst T=',start);
const translations=vm.runInNewContext(source.slice(start,end)+';I18N',{}, {timeout:1000});
function flatten(obj,prefix=''){
 return Object.fromEntries(Object.entries(obj).flatMap(([key,value])=>typeof value==='string'?[[prefix+key,value]]:Object.entries(flatten(value,prefix+key+'.'))));
}
const sv=flatten(translations.sv),en=flatten(translations.en);
test('alla översättningsnycklar finns på svenska och engelska',()=>{
 assert.deepEqual(Object.keys(sv).sort(),Object.keys(en).sort());
 for(const key of Object.keys(sv)){
  assert.ok(sv[key].trim()&&en[key].trim(),key+' saknar text');
  const placeholders=text=>[...new Set([...text.matchAll(/\{\w+\}/g)].map(m=>m[0]))].sort();
  assert.deepEqual(placeholders(sv[key]),placeholders(en[key]),key+' har olika platshållare');
 }
});
test('alla deklarerade texter och tillgänglighetsetiketter har en översättning',()=>{
 const keys=[...html.matchAll(/data-i18n(?:-aria|-title)?="([^"]+)"/g)].map(m=>m[1]);
 keys.push(...[...source.matchAll(/\bT\(['"]([^'"]+)['"]\)/g)].map(m=>m[1]));
 keys.push(...[...source.matchAll(/\ba11y\([^,]+,\s*['"]([^'"]+)['"]/g)].map(m=>m[1]));
 for(const key of keys)for(const lang of ['sv','en'])assert.ok(Object.hasOwn(translations[lang],key),lang+': '+key);
});
test('dynamiska villkors- och fördelningskontroller använder översättningsbara etiketter',()=>{
 assert.doesNotMatch(source,/setAttribute\('aria-label','(?:Villkor|Jämförelse|Fördelning|Ta bort)/);
 for(const key of ['ariaConditionField','ariaConditionOp','ariaConditionValue','ariaConditionRemove','ariaBranchField','ariaBranchOp','ariaBranchValue','ariaBranchTarget','ariaBranchRemove']){
  assert.ok(source.includes("a11y(")&&source.includes("'"+key+"'"),key);
  assert.notEqual(sv[key],en[key],key);
 }
});
