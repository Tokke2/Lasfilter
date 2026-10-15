/* SortBro – import och export av Thunderbirds egna filter (msgFilterRules.dat).
   Ren logik utan webbläsaranrop: filen väljs av användaren i gränssnittet, tolkas här,
   och exporten skrivs till en fil som användaren lägger på plats. Inga nya behörigheter,
   inga experiment-API:er – fungerar med en vanlig signerad eller osignerad XPI.

   Filformatet (version 9) är ett serie nyckel="värde"-rader där varje regel börjar med name=:
     version="9"
     logging="no"
     name="Fakturor"
     enabled="yes"
     type="17"
     action="Move to folder"
     actionValue="imap://user%40host.se@imap.host.se/Ekonomi/Fakturor"
     condition="AND (from,contains,faktura@fortnox.se) (subject,contains,Faktura)"
*/
(function(root){
'use strict';

const FIL_VERSION='9';
const FIL_HEADER=['version="9"','logging="no"'];
const C=root.LasCore||(typeof require!=='undefined'?require('./core.js'):null);

/* Fält i filterfilen -> SortBro-fält. null = SortBro kan inte matcha det. */
const TBFIELDS={
 'from':'sender','all addresses':'sender','to':'recipient','to or cc':'recipient','any address':'recipient',
 'cc':'cc','subject':'subject','body':null,'date':'date','size':'size'
};
/* Operatorer i filterfilen -> SortBro-operator. null = kan inte uttryckas. */
const TB_SB_OPS={
 'contains':'contains',"doesn't contain":null,'is':'equals',"isn't":null,'begins with':'starts','ends with':'ends',
 'is greater than':'larger','is less than':'smaller','is before':'older','is after':'newer',
 'is empty':null,'matches':null,"doesn't match":null
};
/* SortBro-operator -> operator i filterfilen. */
const SB_TB_OPS={contains:'contains',equals:'is',starts:'begins with',ends:'ends with',larger:'is greater than',smaller:'is less than',older:'is before',newer:'is after'};
const SB_TB_FIELDS={sender:'from',recipient:'to',cc:'cc',subject:'subject',domain:'from',size:'size',date:'date'};
const APPROX_FIELDS=new Set(['all addresses','any address','to or cc']);

function clean(v){return String(v??'');}
function unescapeValue(v){return v.replace(/\\(.)/g,'$1');}
function escapeValue(v){return clean(v).replace(/\\/g,'\\\\').replace(/"/g,"'").replace(/[\r\n]+/g,' ');}

/* ---------- Tolkning av filterfilen ---------- */
function parseFilterFile(text){
 const lines=clean(text).split(/\r?\n/);
 const rules=[];let current=null;let version='',logging='';
 const push=()=>{if(current&&typeof current.values.name==='string')rules.push(finishRule(current));current=null;};
 for(const raw of lines){
  const line=raw.trim();
  if(!line)continue;
  const m=/^([A-Za-z][A-Za-z0-9_]*)\s*=\s*"(.*)"\s*$/.exec(line);
  if(!m)continue;
  const key=m[1],value=unescapeValue(m[2]);
  if(key==='version'){version=value;continue;}
  if(key==='logging'){logging=value;continue;}
  if(key==='name')push();
  if(!current)current={values:{},actions:[],actionValues:[]};
  if(key==='action')current.actions.push(value);
  else if(key==='actionValue')current.actionValues.push(value);
  else current.values[key]=value;
 }
 push();
 return {version:version||FIL_VERSION,logging:logging||'no',rules};
}
function finishRule(entry){
 const v=entry.values;
 const actions=entry.actions.map((name,i)=>({name,value:entry.actionValues[i]??''}));
 const move=actions.find(a=>/move to folder/i.test(a.name))||null;
 const copy=actions.find(a=>/copy to folder/i.test(a.name))||null;
 return {
  name:clean(v.name).slice(0,100),
  enabled:v.enabled!=='no',
  type:v.type||'17',
  actions,
  move, copy,
  customId:v.customId||'',
  conditionRaw:clean(v.condition),
  condition:parseCondition(clean(v.condition))
 };
}
/* condition="AND (from,contains,x) (subject,contains,y)" – ALL, AND eller OR. */
function parseCondition(raw){
 const text=clean(raw).trim();
 if(!text)return {match:'all',terms:[],empty:true,raw:text};
 if(/^all$/i.test(text))return {match:'all',terms:[],empty:true,raw:text};
 const match=/^or\b/i.test(text)?'any':'all';
 const terms=[];
 let i=0;
 while(i<text.length){
  const open=text.indexOf('(',i);
  if(open<0)break;
  let depth=0,end=-1;
  for(let j=open;j<text.length;j++){
   if(text[j]==='(')depth++;
   else if(text[j]===')'){depth--;if(depth===0){end=j;break;}}
  }
  const body=end<0?text.slice(open+1):text.slice(open+1,end);
  const first=body.indexOf(',');
  const second=first<0?-1:body.indexOf(',',first+1);
  const field=(first<0?body:body.slice(0,first)).trim().toLowerCase();
  const op=(second<0?(first<0?'':body.slice(first+1)):body.slice(first+1,second)).trim().toLowerCase();
  const value=(second<0?'':body.slice(second+1)).trim().replace(/^"(.*)"$/,'$1').replace(/^'(.*)'$/,'$1');
  if(field)terms.push({field,op,value});
  i=end<0?text.length:end+1;
 }
 return {match,terms,empty:terms.length===0,raw:text};
}

/* ---------- Import: filterfil -> SortBro-regler ---------- */
const CODE_TEXT={
 body:'Villkor på mejltexten (body) kan SortBro inte matcha',
 negation:'Negerat villkor (doesn\'t contain / isn\'t) kan SortBro inte uttrycka',
 matchall:'Filtret matchar allt (ALL) och har inget villkor att översätta',
 complex:'Blandade OCH/ELLER kunde inte översättas exakt',
 noMove:'Filtret flyttar inga mejl',
 copy:'Filtret kopierar i stället för att flytta – SortBro flyttar',
 noTarget:'Ingen målmapp kunde matchas – välj en',
 unsupportedAction:'Åtgärden finns inte i SortBro',
 empty:'Filtret har inga villkor'
};
function folderNameFromUri(uri){
 const text=clean(uri).split('?')[0];
 if(!text)return '';
 const m=/^(?:imap|mailbox|pop3|imap-message|news):\/\//i.exec(text);
 if(!m)return '';
 const rest=text.slice(m[0].length);
 const slash=rest.indexOf('/');
 const path=slash<0?'':rest.slice(slash+1);
 const last=path.split('/').filter(Boolean).pop()||'';
 try{return decodeURIComponent(last).slice(0,80);}catch{return last.slice(0,80);}
}
/* Mappsökvägen ur adressen, t.ex. Ekonomi/Fakturor (utan kontodelen). */
function folderPathFromUri(uri){
 const text=clean(uri).split('?')[0];
 const m=/^(?:imap|mailbox|pop3|imap-message|news):\/\//i.exec(text);
 if(!m)return '';
 const rest=text.slice(m[0].length);
 const slash=rest.indexOf('/');
 if(slash<0)return '';
 return rest.slice(slash+1).split('/').filter(Boolean).map(seg=>{try{return decodeURIComponent(seg);}catch{return seg;}}).join('/').slice(0,300);
}
/* Sökvägen skriven så att den går att jämföra: gemener, utan inledande snedstreck. */
function pathKey(value){
 return clean(value).split('/').filter(Boolean).map(seg=>seg.trim().toLocaleLowerCase('sv-SE')).join('/');
}
/* Kontots URI-prefix (allt före mappsökvägen) – används för att kunna exportera tillbaka. */
function uriPrefix(uri){
 const text=clean(uri).split('?')[0];
 const slash=text.indexOf('/',text.indexOf('://')+3);
 return slash<0?text:text.slice(0,slash+1);
}
/* Målmappen letas bara i det valda kontot – en mapp med samma namn i ett annat konto
   är inte samma mapp, och fel konto i en regel är värre än att behöva välja själv. */
function matchFolder(folders,name,accountId='',path=''){
 const want=String(name||'').toLocaleLowerCase('sv-SE');
 const wantPath=pathKey(path);
 const list=(Array.isArray(folders)?folders:[]).filter(f=>!accountId||!f.accountId||f.accountId===accountId);
 /* Hela sökvägen går före namnet: två mappar kan heta Fakturor i olika grenar. */
 if(wantPath){
  const byPath=list.find(f=>{const have=pathKey(f.path||'');return have&&(have===wantPath||have.endsWith('/'+wantPath));});
  if(byPath)return byPath.id;
 }
 if(!want)return '';
 const nameOf=f=>String(f.name||'').toLocaleLowerCase('sv-SE');
 const exact=list.find(f=>nameOf(f)===want);
 if(exact)return exact.id;
 const starts=list.find(f=>nameOf(f).startsWith(want));
 if(starts)return starts.id;
 const loose=list.find(f=>nameOf(f).includes(want)||(nameOf(f).length>=3&&want.includes(nameOf(f))));
 return loose?.id||'';
}
/* En tolklad filterregel -> utkast till SortBro-regel + redovisning av vad som inte följer med. */
function toSortBroRule(tb,{folders=[],accountId='',inboxId='',namePrefix='',maxConditions=8}={}){
 const notes=[],skipped=[],conditions=[];
 const note=code=>{if(!notes.includes(code))notes.push(code);};
 const drop=code=>{if(!skipped.includes(code))skipped.push(code);};
 for(const term of tb.condition?.terms||[]){
  const field=TBFIELDS[term.field];
  if(field===null){note(term.field==='body'?'body':'unknownField:'+term.field);drop('conditions');continue;}
  if(field===undefined){note('unknownField:'+term.field);drop('conditions');continue;}
  const op=TB_SB_OPS[term.op];
  if(op===null){note('negation');drop('conditions');continue;}
  let value=term.value.slice(0,256);
  if(field==='size'){
   const bytes=Number(value);
   if(!Number.isFinite(bytes)||bytes<1){note('complex');drop('conditions');continue;}
   value=String(Math.max(1,Math.round(bytes/1024)));note('size');
  }
  if(field==='date'){
   if(!Number.isFinite(Number(value))){note('complex');drop('conditions');continue;}
   value=String(Math.max(0,Math.round(Number(value))));note('date');
  }
  if(!value&&field!=='date'){note('complex');drop('conditions');continue;}
  const mapped=field==='domain'?{field:'domain',op:'equals',value}:{field,op,value};
  const low=v=>String(v).toLocaleLowerCase('sv-SE');
  if(!conditions.some(c=>c.field===mapped.field&&c.op===mapped.op&&low(c.value)===low(mapped.value)))conditions.push(mapped);
  if(APPROX_FIELDS.has(term.field))note('approx:'+term.field);
 }
 if(tb.condition?.empty)note('matchall');
 if(tb.condition?.match==='any'&&/\band\b/i.test(tb.condition.raw||'')){note('complex');drop('conditions');}
 if(!conditions.length)drop('conditions');
 const otherActions=(tb.actions||[]).filter(a=>!/move to folder|copy to folder/i.test(a.name)).map(a=>a.name);
 if(otherActions.length){note('actions');note('actions:'+otherActions.join(', '));}
 const move=tb.move||tb.copy;
 if(!move)note('noMove');
 if(tb.copy&&!tb.move)note('copy');
 const targetName=folderNameFromUri(move?.value||'');
 const target=matchFolder(folders,targetName,accountId,folderPathFromUri(move?.value||''));
 if(conditions.length&&move&&!target)note('noTarget');
 const limit=Number.isInteger(maxConditions)&&maxConditions>0?maxConditions:8;
 let trimmed=0;
 if(conditions.length>limit){trimmed=conditions.length-limit;conditions.length=limit;note('trimmed:'+trimmed);}
 const importable=conditions.length>0&&!!move;
 const match=tb.condition?.match==='any'?'any':'all';
 return {
  importable,target,targetName,conditions,match,notes,skipped,
  name:((namePrefix||'')+tb.name).slice(0,100),
  enabled:tb.enabled!==false,
  needsTarget:importable&&!target,
  rule:importable?{
   id:'r'+Math.random().toString(36).slice(2,7)+Date.now().toString(36).slice(-4),
   name:((namePrefix||'')+tb.name).slice(0,100),
   enabled:tb.enabled!==false,scope:'account',source:inboxId,sourceAccount:accountId,
   target:target||'',match,readFilter:'both',unreadAction:'keep',yearFolders:false,
   conditions,branches:[]
  }:null
 };
}

function importReport(rules){
 const list=Array.isArray(rules)?rules:[];
 const report={total:list.length,importable:0,skipped:0,withNotes:0,needsTarget:0};
 for(const r of list){
  if(r.importable)report.importable++;else report.skipped++;
  if((r.notes||[]).length)report.withNotes++;
  if(r.needsTarget)report.needsTarget++;
 }
 return report;
}

/* ---------- Export: SortBro-regler -> filterfil ---------- */
function conditionToFilter(c){
 const field=SB_TB_FIELDS[c.field];
 if(!field)return null;
 /* Domän är ett eget begrepp i SortBro; Thunderbird har bara fritext på avsändaren,
    så vi skriver "innehåller" och flaggar det i rapporten. */
 if(c.field==='domain')return {field,op:'contains',value:c.value};
 const op=SB_TB_OPS[c.op];
 if(!op)return null;
 if(field==='size'){const kb=Number(c.value);if(!Number.isFinite(kb)||kb<=0)return null;}
 return {field,op,value:c.value};
}
function fromSortBroRule(rule,{uriPrefix='',folderPath='',type='17'}={}){
 const notes=[],skipped=[],terms=[];
 for(const c of rule.conditions||[]){
  const term=conditionToFilter(c);
  if(!term){skipped.push(c.field+':'+c.op);notes.push('condition:'+c.field);continue;}
  if(c.field==='domain')notes.push('domain');
  if(c.field==='size'){term.value=String(Number(c.value)*1024);notes.push('size');}
  if(c.field==='date'&&['beforeThisYear','afterThisYear','before','after'].includes(c.op)){skipped.push(c.field+':'+c.op);notes.push('date');continue;}
  terms.push(term);
 }
 if((rule.branches||[]).length)notes.push('branches');
 if(rule.yearFolders===true)notes.push('yearFolders');
 if(['read','unread'].includes(rule.readFilter))notes.push('readPolicy');
 if(rule.unreadAction==='window')notes.push('readPolicy');
 const extraActions=[];
 if(rule.unreadAction==='read')extraActions.push('action="Mark read"');
 if(!terms.length)return {ok:false,notes,skipped,reason:'empty'};
 const join=rule.match==='any'?'OR':'AND';
 /* Villkorsvärden escapas som namn och adresser – ett citattecken mitt i ett värde
    fick förut filen att sluta mitt i raden. */
 const condition=join+' '+terms.map(t=>`(${t.field},${t.op},${escapeValue(t.value)})`).join(' '+join+' ');
 const path=clean(folderPath).split('/').filter(Boolean).map(encodeURIComponent).join('/');
 const actionValue=uriPrefix?(uriPrefix+path):'';
 const lines=[
  `name="${escapeValue(rule.name)}"`,
  `enabled="${rule.enabled?'yes':'no'}"`,
  `type="${type}"`,
  'action="Move to folder"',
  `actionValue="${escapeValue(actionValue)}"`,
  ...extraActions,
  `condition="${condition}"`
 ];
 return {ok:!!actionValue,lines,notes,skipped,condition,actionValue,reason:actionValue?'':'noUri'};
}
function buildFilterFile(rules,{uriOf={}}={}){
 const out=[...FIL_HEADER];
 const report={written:0,skipped:0,notes:[],missingUri:[]};
 for(const rule of rules){
  const info=uriOf[rule.id]||{};
  const built=fromSortBroRule(rule,info);
  for(const n of built.notes||[])if(!report.notes.includes(n))report.notes.push(n);
  if(!built.ok){report.skipped++;report.missingUri.push(rule.name);continue;}
  out.push(...built.lines);
  report.written++;
 }
 return {text:out.join('\r\n')+'\r\n',report};
}

const api={FIL_VERSION,parseFilterFile,parseCondition,toSortBroRule,importReport,folderNameFromUri,folderPathFromUri,pathKey,uriPrefix,matchFolder,fromSortBroRule,buildFilterFile,CODE_TEXT,TBFIELDS,TB_SB_OPS};
root.LasFilters=api;
if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
