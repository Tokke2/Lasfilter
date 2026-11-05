const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../addon/core.js'),F=require('../addon/filters.js');
const rule=(field,value,op='contains')=>C.validateRule({id:'sv',name:'Årsöversikt för Åsa',enabled:true,source:'in',target:'out',match:'all',conditions:[{field,op,value}]});
for(const [field,property,value] of [['subject','subject','Årsöversikt – Ändrad beställning'],['sender','author','Åsa <åsa@example.se>'],['recipient','recipients',['Åsa <åsa@example.se>']],['cc','ccList',['Björn <björn@example.se>']]]){
 test('svenska tecken, versaler och kombinerade Unicode-tecken i '+field,()=>{
  const needle=field==='subject'?'åRSÖVERSIKT':field==='cc'?'BJÖRN':'ÅSA';
  const val=Array.isArray(value)?value.map(s=>s.normalize('NFD')):value.normalize('NFD');
  assert.equal(C.match(rule(field,needle),{[property]:val,folder:{id:'in'}}),true);
 });
}
test('å, ä och ö förblir egna bokstäver – inte a och o',()=>{
 for(const [a,b] of [['år','ar'],['är','ar'],['öl','ol'],['år','är']])assert.equal(C.match(rule('subject',a),{subject:b,folder:{id:'in'}}),false);
});
test('svensk fullständig avsändaradress fungerar med Unicode- och IDN-domän',()=>{
 for(const op of ['equals','contains'])for(const address of ['Åsa@RÄKSMÖRGÅS.se','åsa@xn--rksmrgs-5wao1o.se']){
  assert.equal(C.match(rule('sender','ÅSA@räksmörgås.se',op),{author:address,folder:{id:'in'}}),true,address);
 }
 assert.equal(C.match(rule('sender','wordpress@'),{author:'WordPress <wordpress@limos.se>',folder:{id:'in'}}),true,'ofullständig adress förblir delsträng');
});
test('mappmatchning använder normaliserad hela sökvägen, inom valt konto',()=>{
 const folders=[{id:'a',accountId:'a',name:'Årsöversikt',path:'/Bokföring/Årsöversikt'},
  {id:'b',accountId:'b',name:'Årsöversikt',path:'/Bokföring/Årsöversikt'},
  {id:'c',accountId:'a',name:'Årsöversikt',path:'/Privat/Årsöversikt'}];
 assert.equal(F.matchFolder(folders,'Årsöversikt'.normalize('NFD'),'a','BOKFÖRING/ÅRSÖVERSIKT'.normalize('NFD')),'a');
 assert.equal(F.matchFolder(folders,'Årsöversikt','b','Bokföring/Årsöversikt'),'b');
 assert.equal(F.matchFolder(folders,'Årsöversikt','a'),'', 'samma namn i två grenar är tvetydigt');
 assert.equal(F.matchFolder(folders,'Årsöversikt','missing','Bokföring/Årsöversikt'),'');
 assert.equal(F.matchFolder(folders,'Arsoversikt','a'),'');
 assert.equal(F.folderPathFromUri('imap://u@h.se/Bokf%C3%B6ring/%C3%85rs%C3%B6versikt'),'Bokföring/Årsöversikt');
});
test('svenska namn och villkor överlever JSON- och Thunderbird-filterexport/import',()=>{
 const r=rule('subject','Räksmörgås, ÅÄÖ');
 assert.deepEqual(C.validateRule(JSON.parse(JSON.stringify(r))),r);
 const built=F.buildFilterFile([r],{uriOf:{sv:{uriPrefix:'imap://u@h.se/',folderPath:'Bokföring/Årsöversikt'}}});
 const parsed=F.parseFilterFile(built.text);
 assert.equal(parsed.rules[0].name,r.name);
 assert.equal(parsed.rules[0].condition.terms[0].value,r.conditions[0].value);
 assert.equal(F.folderPathFromUri(parsed.rules[0].move.value),'Bokföring/Årsöversikt');
});
test('filterfiler avkodas som UTF-8, med Windows-1252 som reserv',()=>{
 const text='name="ÅÄÖ åäö Räksmörgås"\r\n';
 assert.equal(F.decodeFilterBytes(new TextEncoder().encode(text)),text);
 assert.equal(F.decodeFilterBytes(Buffer.from(text,'latin1')),text);
 assert.equal(F.decodeFilterBytes(Buffer.concat([Buffer.from([239,187,191]),Buffer.from(text)])),text,'UTF-8-BOM tas bort');
});
test('diagnosen visar exakt Wordfence-villkoret som hindrar skärmbildens mejl',()=>{
 const r=rule('subject','Wordfence');r.conditions.push({field:'subject',op:'contains',value:'WordPress'},{field:'sender',op:'contains',value:'wordpress@'});
 const m={author:'wordpress@limos.se',subject:'[limos.se] Din webbplats har uppdaterats till WordPress 7.1.4',folder:{id:'in'},read:true};
 const before=JSON.stringify(r),out=C.explainRule(r,m);
 assert.equal(C.match(r,m),false);assert.deepEqual(out.conditions.map(c=>c.ok),[false,true,true]);
 assert.equal(JSON.stringify(r),before,'ingen omskrivning från alla till minst ett');
});
test('felsökningslogg bevarar åäö även om texten kom in i NFD',()=>{
 assert.equal(C.event('debug',0,Date.now(),'Årsöversikt för Åsa'.normalize('NFD')).data.detail,'Årsöversikt för Åsa');
});
test('krockkontrollen använder samma Unicode-adress som mejlmatchningen',()=>{
 assert.equal(C.conditionsPossible([{field:'sender',op:'equals',value:'Åsa@räksmörgås.se'},{field:'sender',op:'equals',value:'åsa@xn--rksmrgs-5wao1o.se'}]),true);
});
