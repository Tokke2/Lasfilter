/* Tester för addon/filters.js – import och export av Thunderbirds egna filter
   (msgFilterRules.dat). Kör: node --test tester/filters.test.cjs */
const {test}=require('node:test');
const assert=require('node:assert/strict');
require('../addon/core.js');
const F=require('../addon/filters.js');
const C=require('../addon/core.js');

const KONTO={folders:[{id:'f-fin',name:'Fakturor'},{id:'f-ark',name:'Arkiv'},{id:'f-web',name:'Webb'}],accountId:'a',inboxId:'inbox'};
const rad=(...lines)=>lines.join('\r\n')+'\r\n';
const moveTo=uri=>`enabled="yes"\r\naction="Move to folder"\r\nactionValue="${uri}"`;

/* ---- Tolkning av filen ---- */
test('filterfilen tolkas: huvud, regler och upprepade action-rader',()=>{
 const parsed=F.parseFilterFile(rad(
  'version="9"','logging="no"',
  'name="Fakturor"','enabled="yes"','type="17"','action="Move to folder"',
  'actionValue="imap://u%40h.se@imap.h.se/Ekonomi/Fakturor"','condition="AND (from,contains,faktura@fortnox.se)"',
  'name="Allt"','enabled="no"','type="17"','action="Mark read"','action="Custom"','customId="filtaquilla@mesquilla.com#x"','actionValue="100"','condition="ALL"',
  ''));
 assert.equal(parsed.version,'9');
 assert.equal(parsed.rules.length,2);
 assert.equal(parsed.rules[0].name,'Fakturor');
 assert.equal(parsed.rules[0].enabled,true);
 assert.equal(parsed.rules[0].move.value,'imap://u%40h.se@imap.h.se/Ekonomi/Fakturor');
 assert.deepEqual(parsed.rules[0].condition.terms,[{field:'from',op:'contains',value:'faktura@fortnox.se'}]);
 assert.equal(parsed.rules[1].enabled,false);
 assert.deepEqual(parsed.rules[1].actions.map(a=>a.name),['Mark read','Custom']);
 assert.equal(parsed.rules[1].customId,'filtaquilla@mesquilla.com#x');
 assert.equal(parsed.rules[1].condition.empty,true);
});

test('villkorsuttrycket tolkas: AND, OR, ALL och värden med kommatecken',()=>{
 assert.deepEqual(F.parseCondition('AND (from,contains,a@b.se) (subject,contains,Faktura)').terms.length,2);
 assert.equal(F.parseCondition('AND (from,contains,a@b.se) (subject,contains,Faktura)').match,'all');
 const or=F.parseCondition('OR (from,contains,a@b.se) OR (subject,contains,Kvitto)');
 assert.equal(or.match,'any');
 assert.deepEqual(or.terms,['a@b.se','Kvitto'].map((v,i)=>({field:i?'subject':'from',op:'contains',value:v})));
 assert.equal(F.parseCondition('ALL').empty,true);
 assert.equal(F.parseCondition('').empty,true);
 assert.deepEqual(F.parseCondition('AND (subject,contains,"Faktura, kvitto")').terms,[{field:'subject',op:'contains',value:'Faktura, kvitto'}],'citat och komma i värdet');
 assert.deepEqual(F.parseCondition('AND (size,is greater than,2048000)').terms,[{field:'size',op:'is greater than',value:'2048000'}]);
});

test('mappnamn och kontoadress plockas ur actionValue',()=>{
 assert.equal(F.folderNameFromUri('imap://u%40h.se@imap.h.se/Ekonomi/Fakturor'),'Fakturor');
 assert.equal(F.folderNameFromUri('mailbox://nobody@Local%20Folders/Arkiv/2026'),'2026');
 assert.equal(F.folderNameFromUri('imap://u@h.se/'),'');
 assert.equal(F.folderNameFromUri(''),'');
 assert.equal(F.uriPrefix('imap://u%40h.se@imap.h.se/Ekonomi/Fakturor'),'imap://u%40h.se@imap.h.se/');
 assert.equal(F.uriPrefix('mailbox://nobody@Local%20Folders/Arkiv'),'mailbox://nobody@Local%20Folders/');
});

/* ---- Import: filter -> SortBro-regel ---- */
test('en vanlig flyttregel blir en färdig SortBro-regel',()=>{
 const parsed=F.parseFilterFile(rad('name="Fakturor"',moveTo('imap://u@h.se/Ekonomi/Fakturor'),'condition="AND (from,contains,faktura@fortnox.se)"'));
 const conv=F.toSortBroRule(parsed.rules[0],KONTO);
 assert.equal(conv.importable,true);
 assert.equal(conv.target,'f-fin','målmappen matchas på namn');
 assert.equal(conv.match,'all');
 assert.deepEqual(conv.conditions,[{field:'sender',op:'contains',value:'faktura@fortnox.se'}]);
 assert.deepEqual(conv.notes,[]);
 const rule=C.validateRule({...conv.rule,target:conv.target});
 assert.equal(rule.name,'Fakturor');
 assert.equal(rule.readFilter,'both','importerade filter flyttar olästa som standard');
 assert.equal(rule.enabled,true);
});

test('ELLER-regler behåller "minst ett av villkoren"',()=>{
 const parsed=F.parseFilterFile(rad('name="Webb"',moveTo('mailbox://nobody@Local%20Folders/Webb'),'condition="OR (from,contains,wordpress@limoeurope.com) OR (subject,contains,Wordfence)"'));
 const conv=F.toSortBroRule(parsed.rules[0],KONTO);
 assert.equal(conv.match,'any');
 assert.equal(conv.target,'f-web');
 assert.deepEqual(conv.conditions.map(c=>c.field),['sender','subject']);
 assert.equal(conv.importable,true);
});

test('body, negation, ALL och filter utan flytt hoppas över med förklaring',()=>{
 const body=F.toSortBroRule(F.parseFilterFile(rad('name="B"','enabled="yes"','action="Copy to folder"','actionValue="imap://u@h.se/Arkiv"','condition="AND (body,contains,kvitto)"')).rules[0],KONTO);
 assert.equal(body.importable,false);
 assert.ok(body.notes.includes('body'),'body förklaras');
 assert.ok(body.notes.includes('copy'),'kopiering förklaras');
 const neg=F.toSortBroRule(F.parseFilterFile(rad('name="N"',moveTo('mailbox://nobody@Local%20Folders/Arkiv'),"condition=\"AND (from,doesn't contain,spam@x.se)\"")).rules[0],KONTO);
 assert.equal(neg.importable,false);
 assert.ok(neg.notes.includes('negation'));
 const all=F.toSortBroRule(F.parseFilterFile(rad('name="A"',moveTo('mailbox://nobody@Local%20Folders/Arkiv'),'condition="ALL"')).rules[0],KONTO);
 assert.equal(all.importable,false);
 assert.ok(all.notes.includes('matchall'));
 const nomove=F.toSortBroRule(F.parseFilterFile(rad('name="M"','enabled="yes"','action="Mark read"','condition="AND (from,contains,x@y.se)"')).rules[0],KONTO);
 assert.equal(nomove.importable,false);
 assert.ok(nomove.notes.includes('noMove'));
 assert.ok(nomove.notes.includes('actions:Mark read'),'åtgärden listas');
});

test('saknad målmapp kräver ett val men stoppar inte importen',()=>{
 const parsed=F.parseFilterFile(rad('name="Okänd"',moveTo('imap://u@h.se/Finns-Inte'),'condition="AND (subject,contains,Kvitto)"'));
 const conv=F.toSortBroRule(parsed.rules[0],KONTO);
 assert.equal(conv.importable,true);
 assert.equal(conv.needsTarget,true);
 assert.equal(conv.target,'');
 assert.ok(conv.notes.includes('noTarget'));
 assert.equal(conv.targetName,'Finns-Inte');
});

test('målmappen letas i rätt konto – inte i en mapp med samma namn någon annanstans',()=>{
 const folders=[
  {id:'b-fin',accountId:'b',name:'Fakturor'},
  {id:'a-fin',accountId:'a',name:'Fakturor'},
  {id:'a-ark',accountId:'a',name:'Arkiv 2025'}
 ];
 assert.equal(F.matchFolder(folders,'Fakturor','a'),'a-fin');
 assert.equal(F.matchFolder(folders,'Fakturor','b'),'b-fin');
 assert.equal(F.matchFolder(folders,'Fakturor','c'),'','okänt konto ger ingen gissning');
 assert.equal(F.matchFolder(folders,'Arkiv','a'),'a-ark','namn som börjar lika går före slarvig träff');
 const parsed=F.parseFilterFile(rad('name="Fakturor"',moveTo('imap://u@h.se/Fakturor'),'condition="AND (from,contains,a@b.se)"'));
 assert.equal(F.toSortBroRule(parsed.rules[0],{folders,accountId:'b',inboxId:'inbox'}).target,'b-fin');
});

test('storlek räknas om från byte till kB och avstängda filter behåller sin status',()=>{
 const size=F.toSortBroRule(F.parseFilterFile(rad('name="S"',moveTo('mailbox://nobody@Local%20Folders/Arkiv'),'condition="AND (size,is greater than,2048000)"')).rules[0],KONTO);
 assert.deepEqual(size.conditions,[{field:'size',op:'larger',value:'2000'}]);
 assert.ok(size.notes.includes('size'));
 const off=F.toSortBroRule(F.parseFilterFile(rad('name="O"','enabled="no"','action="Move to folder"','actionValue="mailbox://nobody@Local%20Folders/Arkiv"','condition="AND (subject,contains,Kvitto)"')).rules[0],KONTO);
 assert.equal(off.enabled,false);
 assert.equal(off.rule.enabled,false,'regeln skapas avstängd');
});

test('importrapporten räknar vad som kan bli regler',()=>{
 const parsed=F.parseFilterFile(rad(
  'name="A"',moveTo('imap://u@h.se/Fakturor'),'condition="AND (from,contains,a@b.se)"',
  'name="B"','enabled="yes"','action="Mark read"','condition="AND (from,contains,c@d.se)"',
  'name="C"',moveTo('imap://u@h.se/Webb'),'condition="AND (body,contains,x)"'));
 const conv=parsed.rules.map(r=>F.toSortBroRule(r,KONTO));
 const report=F.importReport(conv);
 assert.deepEqual(report,{total:3,importable:1,skipped:2,withNotes:2,needsTarget:0});
});

/* ---- Export: SortBro-regel -> filterfil ---- */
const sortbroRule=(over={})=>({
 id:'r1',name:'Fakturor',enabled:true,scope:'account',source:'inbox',sourceAccount:'a',target:'f-fin',
 match:'all',readFilter:'both',unreadAction:'keep',yearFolders:false,
 conditions:[{field:'sender',op:'contains',value:'faktura@fortnox.se'}],branches:[],...over
});

test('en regel skrivs som en Thunderbird-regel med rätt rader',()=>{
 const built=F.fromSortBroRule(sortbroRule(),{uriPrefix:'imap://u%40h.se@h.se/',folderPath:'Ekonomi/Fakturor'});
 assert.equal(built.ok,true);
 assert.deepEqual(built.lines,[
  'name="Fakturor"','enabled="yes"','type="17"','action="Move to folder"',
  'actionValue="imap://u%40h.se@h.se/Ekonomi/Fakturor"','condition="AND (from,contains,faktura@fortnox.se)"']);
 assert.equal(built.condition,'AND (from,contains,faktura@fortnox.se)');
 assert.deepEqual(built.notes,[]);
});

test('flera villkor och ELLER skrivs som Thunderbird förstår',()=>{
 const any=F.fromSortBroRule(sortbroRule({match:'any',conditions:[{field:'sender',op:'contains',value:'a@b.se'},{field:'subject',op:'contains',value:'Kvitto'}]}),{uriPrefix:'imap://u@h.se/',folderPath:'Arkiv'});
 assert.equal(any.condition,'OR (from,contains,a@b.se) OR (subject,contains,Kvitto)');
 assert.equal(any.lines[5],'condition="OR (from,contains,a@b.se) OR (subject,contains,Kvitto)"','Thunderbird kräver operatorn även först');
 const all=F.fromSortBroRule(sortbroRule({conditions:[{field:'sender',op:'equals',value:'a@b.se'},{field:'subject',op:'starts',value:'Faktura'}]}),{uriPrefix:'imap://u@h.se/',folderPath:'Arkiv'});
 assert.equal(all.condition,'AND (from,is,a@b.se) AND (subject,begins with,Faktura)');
});

test('domän och storlek skrivs så gott det går, med en notis var',()=>{
 const dom=F.fromSortBroRule(sortbroRule({conditions:[{field:'domain',op:'equals',value:'klarna.se'}]}),{uriPrefix:'imap://u@h.se/',folderPath:'Arkiv'});
 assert.equal(dom.condition,'AND (from,contains,klarna.se)','domän blir "från innehåller"');
 assert.ok(dom.notes.includes('domain'));
 const size=F.fromSortBroRule(sortbroRule({conditions:[{field:'size',op:'larger',value:'2000'}]}),{uriPrefix:'imap://u@h.se/',folderPath:'Arkiv'});
 assert.equal(size.condition,'AND (size,is greater than,2048000)','kB blir byte');
 assert.ok(size.notes.includes('size'));
});

test('grensregler, årsmappar och läsläge noteras men hindrar inte exporten',()=>{
 const built=F.fromSortBroRule(sortbroRule({branches:[{condition:{field:'subject',op:'contains',value:'X'},target:'f-ark'}],yearFolders:true,readFilter:'read'}),{uriPrefix:'imap://u@h.se/',folderPath:'Arkiv'});
 assert.equal(built.ok,true);
 for(const note of ['branches','yearFolders','readPolicy'])assert.ok(built.notes.includes(note),note+' noteras');
 assert.ok(!F.fromSortBroRule(sortbroRule({readFilter:'both'}),{uriPrefix:'imap://u@h.se/',folderPath:'Arkiv'}).notes.includes('readPolicy'),'"både lästa och olästa" behöver ingen varning');
 const mark=F.fromSortBroRule(sortbroRule({unreadAction:'read'}),{uriPrefix:'imap://u@h.se/',folderPath:'Arkiv'});
 assert.ok(mark.lines.includes('action="Mark read"'),'markera som läst går att skriva');
 assert.ok(!mark.notes.includes('readPolicy'),'och behöver då ingen varning');
 const win=F.fromSortBroRule(sortbroRule({unreadAction:'window'}),{uriPrefix:'imap://u@h.se/',folderPath:'Arkiv'});
 assert.ok(win.notes.includes('readPolicy'),'öppna fönster kan inte skrivas');
 const year=F.fromSortBroRule(sortbroRule({conditions:[{field:'date',op:'beforeThisYear',value:''}]}),{uriPrefix:'imap://u@h.se/',folderPath:'Arkiv'});
 assert.equal(year.ok,false,'årtalsvillkor kan inte skrivas');
 assert.deepEqual(year.skipped,['date:beforeThisYear']);
});

test('utan känd kontoadress blir det ingen fil – och det sägs rakt ut',()=>{
 const built=F.buildFilterFile([sortbroRule()],{uriOf:{}});
 assert.equal(built.report.written,0);
 assert.deepEqual(built.report.missingUri,['Fakturor']);
 assert.ok(/^version="9"\r\nlogging="no"\r\n$/.test(built.text),'bara huvudet skrivs');
 const withUri=F.buildFilterFile([sortbroRule()],{uriOf:{r1:{uriPrefix:'imap://u@h.se/',folderPath:'Ekonomi/Fakturor'}}});
 assert.equal(withUri.report.written,1);
 assert.ok(withUri.text.includes('name="Fakturor"'));
 assert.ok(withUri.text.endsWith('\r\n'));
});

test('exporten kan läsas tillbaka av vår egen tolk (rundtur)',()=>{
 const rule=sortbroRule({conditions:[{field:'sender',op:'contains',value:'faktura@fortnox.se'},{field:'subject',op:'contains',value:'Faktura'}]});
 const built=F.buildFilterFile([rule],{uriOf:{r1:{uriPrefix:'imap://u@h.se/',folderPath:'Ekonomi/Fakturor'}}});
 const back=F.parseFilterFile(built.text);
 assert.equal(back.rules.length,1);
 assert.equal(back.rules[0].name,'Fakturor');
 assert.equal(back.rules[0].enabled,true);
 assert.equal(F.folderNameFromUri(back.rules[0].move.value),'Fakturor');
 const conv=F.toSortBroRule(back.rules[0],KONTO);
 assert.deepEqual(conv.conditions,rule.conditions,'villkoren kommer tillbaka oförändrade');
 assert.equal(conv.target,'f-fin');
});

test('citat och radbrytningar i namn städas så filen förblir giltig',()=>{
 const built=F.fromSortBroRule(sortbroRule({name:'Fakturor "viktiga"'}),{uriPrefix:'imap://u@h.se/',folderPath:'Arkiv'});
 assert.equal(built.lines[0],'name="Fakturor \'viktiga\'"');
 const back=F.parseFilterFile(F.buildFilterFile([sortbroRule({name:'Rad\nbrytning'})],{uriOf:{r1:{uriPrefix:'imap://u@h.se/',folderPath:'Arkiv'}}}).text);
 assert.equal(back.rules.length,1,'en radbrytning i namnet förstör inte filen');
});
