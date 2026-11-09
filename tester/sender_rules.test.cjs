const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('../addon/core.js');
const rule=over=>C.validateRule({id:'r1',name:'Fakturor',enabled:true,source:'inbox',sourceAccount:'a',scope:'folder',target:'fin',match:'all',conditions:[{field:'sender',op:'equals',value:'old@example.se'}],...over});
test('högerklick använder exakt adress som standard, domän endast uttryckligen',()=>{
 assert.deepEqual(C.senderCondition('Anna <ANNA@EXAMPLE.SE>'),{field:'sender',op:'equals',value:'anna@example.se'});
 assert.deepEqual(C.senderCondition('Anna <ANNA@EXAMPLE.SE>',true),{field:'domain',op:'equals',value:'example.se'});
});
test('ogiltiga och för långa avsändare stoppas, ingen ämnesrad blir avsändarregel',()=>{
 for(const address of ['',null,'foo','a@x','a@x.se, b@y.se','<a@x.se><b@y.se>','a'.repeat(260)+'@example.se'])assert.throws(()=>C.senderCondition(address),e=>e.code==='sender_invalid');
});
test('ett enda OCH-villkor får ett explicit ELLER-alternativ utan andra förändringar',()=>{
 const old=rule({readFilter:'read',unreadAction:'window',yearFolders:true,trialUntil:2000000000000,branches:[{condition:{field:'subject',op:'contains',value:'Order'},target:'orders'}]}),snapshot=structuredClone(old);
 const plan=C.addSenderCondition(old,'new@example.se');
 assert.equal(plan.rule.match,'any');assert.equal(plan.rule.conditions.length,2);assert.deepEqual(old,snapshot);
 for(const key of Object.keys(old).filter(k=>!['conditions','match'].includes(k)))assert.deepEqual(plan.rule[key],old[key],key);
});
test('ny adress blir alternativ, inte delsträng eller hela domänen',()=>{
 const next=C.addSenderCondition(rule(),'new@example.se').rule;
 for(const address of ['old@example.se','new@example.se'])assert(C.match(next,{author:address,folder:{id:'inbox'}}));
 for(const address of ['other@example.se','notnew@example.se','new@example.se.evil'])assert(!C.match(next,{author:address,folder:{id:'inbox'}}));
});
test('flervillkors-OCH avvisas utan mutation, inklusive kombinerad datumgräns',()=>{
 const old=rule({conditions:[{field:'domain',op:'equals',value:'old.se'},{field:'date',op:'older',value:'90'}]}),before=JSON.stringify(old);
 assert.throws(()=>C.addSenderCondition(old,'new@example.se'),e=>e.code==='sender_and');assert.equal(JSON.stringify(old),before);
});
test('ELLER-regler behåller alla befintliga villkor och deras ordning',()=>{
 const old=rule({match:'any',conditions:[{field:'domain',op:'equals',value:'old.se'},{field:'subject',op:'contains',value:'Faktura'}]});
 const plan=C.addSenderCondition(old,'new@example.se');assert.deepEqual(plan.rule.conditions.slice(0,2),old.conditions);assert.equal(plan.rule.match,'any');
});
test('dubblett och redan täckande domän ger oförändrad regel',()=>{
 for(const old of [rule(),rule({conditions:[{field:'sender',op:'equals',value:'Namn <OLD@EXAMPLE.SE>'}]}),rule({conditions:[{field:'domain',op:'equals',value:'example.se'}]})]){
  const plan=C.addSenderCondition(old,'OLD@example.se');assert.equal(plan.duplicate,true);assert.deepEqual(plan.rule,old);
 }
});
test('befintlig exakt adress hindrar inte ett uttryckligt val av hela domänen',()=>{
 const plan=C.addSenderCondition(rule(),'old@example.se',true);assert.equal(plan.duplicate,false);assert.equal(plan.rule.conditions[1].field,'domain');
});
test('åtta villkor ger stopp, aldrig tyst borttagning eller trunkering',()=>{
 const old=rule({match:'any',conditions:Array.from({length:8},(_,i)=>({field:'sender',op:'equals',value:'x'+i+'@example.se'}))});
 assert.throws(()=>C.addSenderCondition(old,'new@example.se'),e=>e.code==='sender_full');assert.equal(old.conditions.length,8);
 assert.equal(C.addSenderCondition(old,'x0@example.se').duplicate,true);
});
test('svenska adresser förblir åtskilda och internationell domän normaliseras',()=>{
 assert.notEqual(C.senderCondition('räkna@exempel.se').value,C.senderCondition('rakna@exempel.se').value);
 assert.equal(C.senderCondition('a@räksmörgås.se',true).value,'xn--rksmrgs-5wao1o.se');
});
