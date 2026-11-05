const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('../addon/core.js');
const folders=[{id:'in',name:'Inkorg',label:'Jobb · Inkorg',accountId:'a',accountName:'Jobb'},
 {id:'out',name:'Fakturor',label:'Jobb · Ekonomi / Fakturor',accountId:'a'},
 {id:'other',name:'Order',label:'Jobb · Inköp / Order',accountId:'a'}];
const rule={name:'Leverantörer',scope:'account',sourceAccount:'a',source:'in',target:'out',conditions:[{field:'domain',op:'equals',value:'klarna.se'}],branches:[{condition:{field:'subject',op:'contains',value:'Årsbesked'},target:'other'}]};
for(const q of ['LEVERANTÖRER','fakturor','EKONOMI','klarna.se','inkorg','JOBB','årsbesked','inköp','order','klarna fakturor','  klarna   jobb  ',''])test('regelsökning hittar '+JSON.stringify(q),()=>assert.equal(C.ruleMatchesSearch(rule,q,folders),true));
for(const q of ['okänd','klarna semester','.*','[a-z]'])test('sökning är bokstavlig och kräver alla ord: '+q,()=>assert.equal(C.ruleMatchesSearch(rule,q,folders),false));
test('saknade mappar och valfria fält kraschar inte sökningen',()=>{
 assert.equal(C.ruleMatchesSearch({name:'Enkel'},'enkel',[]),true);
 assert.equal(C.ruleMatchesSearch({...rule,target:'borta'},'fakturor',[]),false);
});
