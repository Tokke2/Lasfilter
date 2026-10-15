/* Läsfilter: rena regler, utan filåtkomst eller nätverk. */
(function(root){
'use strict';
const LIMITS=Object.freeze({rules:200,conditions:8,value:256,queue:100,logs:5000,yearFolders:12,diagnose:20000,examples:5});
/* Vilka fält och jämförelser som är tillåtna. Textfälten jämförs som text,
   storlek i kB och datum som dagar eller årtal. */
const FIELD_OPS=Object.freeze({
 sender:['contains','equals','starts','ends'],
 domain:['equals'],
 subject:['contains','equals','starts','ends'],
 recipient:['contains','equals','starts','ends'],
 cc:['contains','equals','starts','ends'],
 size:['larger','smaller'],
 date:['older','newer','before','after','beforeThisYear','afterThisYear']
});
class RuleError extends Error { constructor(code){super(code);this.code=code;} }
const fail=code=>{throw new RuleError(code);};
const norm=s=>String(s??'').normalize('NFKC').toLocaleLowerCase('sv-SE');
function text(v,max,code){if(typeof v!=='string'||!v.trim()||v.length>max)fail(code);return v.trim();}
function domain(v){
 let s=norm(v).replace(/^@/,'');
 if(!s.includes('.')||/[\s/@:#?<>\\]/u.test(s))fail('bad_domain');
 try{s=new URL('https://'+s).hostname;}catch{fail('bad_domain');}
 if(s.length>253||s.split('.').some(x=>!x||x.length>63||!/^([a-z0-9]|[a-z0-9][a-z0-9-]*[a-z0-9])$/i.test(x)))fail('bad_domain');
 return s;
}
function email(author){
 if(typeof author!=='string'||author.length>4096)return '';
 const parts=[...author.matchAll(/<([^<>]+)>/g)];
 let s=parts.length===1?parts[0][1]:parts.length===0?author.trim():'';
 if(!/^[^\s<>(),;:"@]+@[^\s<>(),;:"@]+$/u.test(s))return '';
 const at=s.lastIndexOf('@');try{return norm(s.slice(0,at))+'@'+domain(s.slice(at+1));}catch{return '';}
}
function validateRule(raw){
 if(!raw||typeof raw!=='object')fail('bad_rule');
 const scope=raw.scope===undefined?'folder':raw.scope;if(!['folder','account'].includes(scope))fail('bad_rule');
 const readFilter=raw.readFilter===undefined?'default':raw.readFilter;if(!['default','read','unread','both'].includes(readFilter))fail('bad_rule');
 const unreadAction=raw.unreadAction===undefined?'default':raw.unreadAction;if(!['default','keep','window','read'].includes(unreadAction))fail('bad_rule');
 const r={id:text(raw.id,80,'bad_id'),name:text(raw.name,100,'bad_name'),enabled:raw.enabled===true,
  source:text(raw.source,2048,'choose_source'),sourceAccount:scope==='account'?text(raw.sourceAccount,2048,'choose_source'):'',scope,
  target:text(raw.target,2048,'choose_target'),match:raw.match,readFilter,unreadAction,yearFolders:raw.yearFolders===true};
 if(!/^[a-zA-Z0-9_-]+$/.test(r.id))fail('bad_id');
 if(r.scope==='folder'&&r.source===r.target)fail('same_folder');
 if(!['all','any'].includes(r.match))fail('bad_match');
 if(!Array.isArray(raw.conditions)||!raw.conditions.length||raw.conditions.length>LIMITS.conditions)fail('bad_conditions');
 r.conditions=raw.conditions.map(validateCondition);
 r.branches=(Array.isArray(raw.branches)?raw.branches:[]).map(b=>{
  if(!b||typeof b!=='object')fail('bad_branch');
  const target=text(b.target,2048,'choose_target');if(r.scope==='folder'&&target===r.source)fail('same_folder');
  return {condition:validateCondition(b.condition),target};
 });
 if(r.branches.length>LIMITS.conditions)fail('bad_branch');
 return r;
}
function validateCondition(c){
 if(!c||!Object.hasOwn(FIELD_OPS,c.field))fail('bad_field');
 if(!FIELD_OPS[c.field].includes(c.op))fail('bad_operator');
 let value;
 if(c.field==='size'){
  const kb=typeof c.value==='number'?c.value:Number(String(c.value??'').trim());
  if(!Number.isSafeInteger(kb)||kb<1||kb>1048576)fail('bad_value');
  value=String(kb);
 }else if(c.field==='date'){
  if(c.op==='beforeThisYear'||c.op==='afterThisYear'){value='';}
  else{
   const n=typeof c.value==='number'?c.value:Number(String(c.value??'').trim());
   if(c.op==='older'||c.op==='newer'){
    if(!Number.isSafeInteger(n)||n<1||n>36500)fail('bad_value');
   }else if(!Number.isSafeInteger(n)||n<1970||n>9999)fail('bad_value');
   value=String(n);
  }
 }else{
  value=text(c.value,LIMITS.value,'bad_value');if(c.field==='domain')value=domain(value);
 }
 return {field:c.field,op:c.op,value};
}
function validateRules(raw){
 if(!Array.isArray(raw)||raw.length>LIMITS.rules)fail('too_many_rules');
 const rules=raw.map(validateRule),ids=new Set();
 for(const r of rules){if(ids.has(r.id))fail('duplicate_id');ids.add(r.id);}
 const edges=new Map();for(const r of rules.filter(r=>r.enabled&&r.scope!=='account')){if(!edges.has(r.source))edges.set(r.source,[]);edges.get(r.source).push(r.target,...(r.branches||[]).map(b=>b.target));}
 const visiting=new Set(),visited=new Set();
 function visit(id){if(visiting.has(id))fail('rule_cycle');if(visited.has(id))return;visiting.add(id);for(const next of edges.get(id)||[])visit(next);visiting.delete(id);visited.add(id);}
 for(const id of edges.keys())visit(id);
 return rules;
}
/* Årstidsteman: vår (mar–maj), sommar (jun–aug), höst (sep–nov), vinter (dec–feb). */
const SEASONS=Object.freeze(['spring','summer','autumn','winter']);
function seasonOf(value=new Date()){
 const d=value instanceof Date?value:new Date(value);
 const month=Number.isFinite(d.getTime())?d.getMonth():new Date().getMonth();
 if(month>=2&&month<=4)return 'spring';
 if(month>=5&&month<=7)return 'summer';
 if(month>=8&&month<=10)return 'autumn';
 return 'winter';
}
/* Popup-skydd: nya fönster öppnas aldrig under ett pågående mass-svep. */
function shouldOpenWindow(options={}){
 const action=options.action||'default';
 if(action==='read'||action==='keep')return false;
 const limit=Number.isInteger(options.limit)&&options.limit>=0?options.limit:3;
 const pending=Number.isInteger(options.pending)&&options.pending>0?options.pending:0;
 const sweeping=Number.isInteger(options.sweeping)&&options.sweeping>0?options.sweeping:0;
 if(options.fromSweep===true||sweeping>0||pending>limit)return false;
 return action==='window'||(action==='default'&&options.openWindow!==false);
}
/* Lokala förslag från Inkorgen. Endast förslag – inget skapas utan användarens val. */
function suggestFrom(messages,{rules=[],limit=8,minCount=2}={}){
 const groups=new Map();
 for(const m of Array.isArray(messages)?messages:[]){
  const address=email(m?.author);if(!address)continue;
  const dom=address.split('@')[1]||'';if(!dom)continue;
  if(rules.some(r=>r&&r.enabled&&match(r,m,false)))continue;
  const g=groups.get(dom)||{domain:dom,count:0,subjects:[],senders:new Map()};
  g.count++;
  if(typeof m.subject==='string'&&m.subject.trim()&&!g.subjects.includes(m.subject.slice(0,120))&&g.subjects.length<3)g.subjects.push(m.subject.slice(0,120));
  g.senders.set(address,(g.senders.get(address)||0)+1);
  groups.set(dom,g);
 }
 return [...groups.values()].filter(g=>g.count>=minCount).sort((a,b)=>b.count-a.count||a.domain.localeCompare(b.domain,'sv')).slice(0,limit)
  .map(g=>({domain:g.domain,count:g.count,subject:g.subjects[0]||'',sender:[...g.senders.entries()].sort((a,b)=>b[1]-a[1])[0][0]}));
}
/* Enkelt regelbygge: användaren pekar på en avsändare, en domän eller ett ord och
   villkoret räknas ut här. En full domän/adress blir exakt träff, ett löst ord blir
   "innehåller" – samma råd som diagnosen ger ("ett kortare ämne fångar fler mejl"). */
function choiceCondition({field='domain',value=''}={}){
 const kind=['domain','sender','subject'].includes(field)?field:'domain';
 const clean=String(value??'').trim().slice(0,256);
 if(!clean)fail('bad_value');
 if(kind==='subject')return {field:'subject',op:'contains',value:clean};
 if(kind==='domain')return /[.]/.test(clean)&&!/\s/.test(clean)?{field:'domain',op:'equals',value:clean}:{field:'sender',op:'contains',value:clean};
 return clean.includes('@')?{field:'sender',op:'equals',value:clean}:{field:'sender',op:'contains',value:clean};
}
/* Samma villkor som ovan, men i en form som match() kan räkna mot skannade mejl. */
function choiceRule({field='domain',value='',match='all'}={}){
 return {enabled:true,scope:'folder',source:'',sourceAccount:'',target:'',match:match==='any'?'any':'all',conditions:[choiceCondition({field,value})],branches:[]};
}
function ruleFromChoice({id='',name='',field='domain',value='',target='',source='',sourceAccount='',moveUnread=true,openWindow=false}={}){
 const clean=String(value??'').trim().slice(0,256);
 return validateRule({
  id:id||('r'+Date.now().toString(36)+Math.random().toString(36).slice(2,7)),
  name:(String(name||'').trim()||clean).slice(0,100),
  enabled:true,scope:'account',source,sourceAccount,target,match:'all',
  readFilter:moveUnread===false?'read':'both',
  unreadAction:openWindow===true?'window':'keep',
  conditions:[choiceCondition({field,value:clean})],branches:[]
 });
}
/* Hur många av de skannade mejlen träffas av de här villkoren? */
function countMatches(messages,rule){
 if(!rule||!Array.isArray(rule.conditions)||!rule.conditions.length)return 0;
 let n=0;for(const m of Array.isArray(messages)?messages:[])if(match(rule,m,true,true))n++;
 return n;
}
/* Vanliga ord i ämnesrader: gör det möjligt att skapa en regel utan att kunna en exakt adress. */
const STOPWORDS=new Set(['och','att','för','med','din','ditt','dina','från','den','det','som','inte','har','kan','till','av','på','om','en','ett','er','ert','vi','du','är','blir','blev','nya','nytt','ny','vara','var','skulle','efter','över','under','utan','upp','ner','här','där','vad','när','hur','vem','tack','hej','fick','måste','vill','kunde','vår','vårt','våra','oss','samt','via','the','and','for','with','this','that','you','your','our','from','not','has','have','are','was','were','will','can','all','per','new','news','please','about','more','than','one','two','out','now','get','see','mail','email','http','https','www']);
function suggestWords(messages,{rules=[],limit=6,minCount=3,minLength=4}={}){
 const domains=new Set(),groups=new Map(),blockValues=[];
 for(const r of Array.isArray(rules)?rules:[])if(r&&r.enabled)for(const c of r.conditions||[])if(typeof c.value==='string'&&c.value.trim())blockValues.push(norm(c.value));
 for(const m of Array.isArray(messages)?messages:[]){
  const dom=email(m?.author).split('@')[1]||'';if(dom)domains.add(dom);
  if(typeof m?.subject!=='string')continue;
  const words=new Set();
  for(const w of m.subject.toLocaleLowerCase('sv-SE').split(/[^\p{L}\p{N}]+/u)){
   if(w.length<minLength||!/\p{L}/u.test(w)||STOPWORDS.has(w))continue;
   if(blockValues.some(v=>v.includes(w)))continue;
   words.add(w);
  }
  for(const w of words){const g=groups.get(w)||{word:w,count:0,subject:''};g.count++;if(!g.subject)g.subject=String(m.subject).slice(0,120);groups.set(w,g);}
 }
 const senderParts=new Set();for(const dom of domains)for(const part of dom.split(/[.\-_]/))if(part)senderParts.add(part);
 return [...groups.values()].filter(g=>g.count>=minCount&&!senderParts.has(g.word))
  .sort((a,b)=>b.count-a.count||a.word.localeCompare(b.word,'sv')).slice(0,limit);
}
/* Kort mänsklig beskrivning av ett villkor – används i loggen (gränssnittet har egna texter). */
function choiceSummary(c){
 const v=String(c?.value??'').trim();
 if(!c||!v)return 'okant villkor';
 if(c.field==='domain')return 'avsandardoman '+v;
 if(c.field==='sender')return c.op==='equals'?'avsandare '+v:'avsandare som innehaller '+v;
 if(c.field==='subject')return 'amne som innehaller '+v;
 return String(c.field||'')+' '+v;
}
/* Allt den enkla regelskaparen behöver: möjliga avsändare och möjliga ämnesord. */
function inboxHints(messages,{rules=[],limit=8,wordLimit=6,minCount=2,wordMinCount=3}={}){
 return {senders:suggestFrom(messages,{rules,limit,minCount}),words:suggestWords(messages,{rules,limit:wordLimit,minCount:wordMinCount})};
}
function listOf(value){return Array.isArray(value)?value.filter(v=>typeof v==='string').join(' '):typeof value==='string'?value:'';}
function valuesFor(message){const address=email(message.author);return {sender:address,domain:address.split('@')[1]||'',subject:typeof message.subject==='string'?message.subject.slice(0,20000):'',
 recipient:listOf(message.recipients),cc:[listOf(message.ccList),listOf(message.bccList)].filter(Boolean).join(' '),
 size:Number.isSafeInteger(message.size)?message.size:null,date:Number.isFinite(+new Date(message.date))?+new Date(message.date):null};}
function condHit(c,values,now=Date.now()){
 if(c.field==='size'){
  const size=values.size;if(!Number.isFinite(size))return false;
  const bytes=Number(c.value)*1024;return c.op==='larger'?size>bytes:size<bytes;
 }
 if(c.field==='date'){
  const date=values.date;if(!Number.isFinite(date))return false;
  const n=Number(c.value);
  if(c.op==='older')return date<now-n*86400000;
  if(c.op==='newer')return date>now-n*86400000;
  const year=new Date(date).getFullYear();
  if(c.op==='beforeThisYear')return year<new Date(now).getFullYear();
  if(c.op==='afterThisYear')return year>new Date(now).getFullYear();
  return c.op==='before'?year<n:year>n;
 }
 const hay=norm(values[c.field]),needle=norm(c.value);if(!hay||!needle)return false;
 if(c.op==='equals')return hay===needle;if(c.op==='contains')return hay.includes(needle);
 if(c.op==='starts')return hay.startsWith(needle);return hay.endsWith(needle);
}
function match(rule,message,includeDisabled=false,ignoreSource=false,now=Date.now()){
 if(!rule.enabled&&!includeDisabled)return false;
 if(!ignoreSource){
  const inSource=rule.scope==='account'?message.folder?.accountId===rule.sourceAccount:message.folder?.id===rule.source;
  if(!inSource)return false;
 }
 const values=valuesFor(message);const hits=rule.conditions.map(c=>condHit(c,values,now));
 return rule.match==='all'?hits.every(Boolean):hits.some(Boolean);
}
/* Årsmappar: meddelandets år, används för mål som Arkiv/2025. */
function yearOf(message){const t=+new Date(message?.date);return Number.isFinite(t)?new Date(t).getFullYear():null;}
function yearFolderName(message){const y=yearOf(message);return y?String(y):'';}
/* Ett mappnamn som bara är ett årtal (t.ex. "2025") är en årsmapp. */
function yearNameOf(text){const name=String(text==null?'':text).trim();return /^(19|20)\d{2}$/.test(name)&&+name>=1970&&+name<=9999?+name:0;}
function targetFor(rule,message){
 const values=valuesFor(message);
 for(const b of rule.branches||[])if(condHit(b.condition,values))return b.target;
 return rule.target;
}
function firstMatch(rules,message){return rules.find(r=>match(r,message)&&message.folder?.id!==targetFor(r,message))||null;}
function usableFolder(f){return !!(f&&f.id&&f.accountId&&!f.isRoot&&!f.isVirtual&&!f.isUnified&&!f.isTag&&![...(f.specialUse||[]),f.type].some(t=>['trash','junk','drafts','sent','templates','outbox'].includes(t)));}
function validatePair(source,target,sourceCaps,targetCaps){
 if(!usableFolder(source)||!usableFolder(target))fail('unsafe_folder');
 if(source.id===target.id)fail('same_folder');
 if(sourceCaps.canDeleteMessages!==true||targetCaps.canAddMessages!==true)fail('read_only');
}
function defaults(){return {schema:1,revision:0,rulesVersion:0,paused:false,dryRun:true,moveMode:'read',hourly:true,sweepMinutes:60,newInboxDirect:true,openWindow:true,verbose:true,fileLog:true,rules:[]};}
function config(raw){
 if(!raw||raw.schema!==1)fail('bad_schema');
 if(!Number.isSafeInteger(raw.revision)||raw.revision<0||!Number.isSafeInteger(raw.rulesVersion)||raw.rulesVersion<0)fail('bad_schema');
 if(typeof raw.paused!=='boolean'||typeof raw.dryRun!=='boolean')fail('bad_schema');
 if(!['read','direct'].includes(raw.moveMode))fail('bad_schema');
 if(typeof raw.hourly!=='boolean'||typeof raw.openWindow!=='boolean'||typeof raw.verbose!=='boolean')fail('bad_schema');
 const fileLog=raw.fileLog===undefined?true:raw.fileLog;if(typeof fileLog!=='boolean')fail('bad_schema');
 const sweepMinutes=raw.sweepMinutes===undefined?60:raw.sweepMinutes;if(!Number.isInteger(sweepMinutes)||sweepMinutes<15||sweepMinutes>1440||sweepMinutes%15)fail('bad_schema');
 const newInboxDirect=raw.newInboxDirect===undefined?true:raw.newInboxDirect;if(typeof newInboxDirect!=='boolean')fail('bad_schema');
 return {schema:1,revision:raw.revision,rulesVersion:raw.rulesVersion,paused:raw.paused,dryRun:raw.dryRun,moveMode:raw.moveMode,hourly:raw.hourly,sweepMinutes,newInboxDirect,openWindow:raw.openWindow,verbose:raw.verbose,fileLog,rules:validateRules(raw.rules)};
}
function fingerprint(m){return typeof m.headerMessageId==='string'&&m.headerMessageId.length<=4096&&m.headerMessageId?JSON.stringify([m.headerMessageId,+new Date(m.date),m.size]):'';}
const EVENTS=new Set(['start','settings_saved','rules_saved','restored','queued','simulated','moved','skipped','error','queue_full','backup_restored','catchup','debug']);
function event(name,count=0,now=Date.now(),detail=''){
 if(!EVENTS.has(name))return null;
 const data={count:Number.isSafeInteger(count)&&count>=0?count:0};
 if(['debug','error'].includes(name)&&typeof detail==='string'&&detail.trim())data.detail=detail.trim().replace(/[^a-zA-Z0-9åäöÅÄÖ _:=,.;+()/-]/g,'?').slice(0,500);
 return {time:new Date(now).toISOString(),app:'lasfilter',level:['error','queue_full'].includes(name)?'ERROR':'INFO',event:name,data};
}
function cleanLogs(rows,now=Date.now()){
 return (Array.isArray(rows)?rows:[]).filter(r=>r&&EVENTS.has(r.event)&&Number.isFinite(Date.parse(r.time))&&Date.parse(r.time)>=now-30*86400000&&Date.parse(r.time)<=now+60000)
 .slice(-LIMITS.logs).map(r=>event(r.event,r.data?.count,Date.parse(r.time),r.data?.detail));
}
const api={LIMITS,SEASONS,FIELD_OPS,RuleError,fail,norm,domain,email,validateRule,validateRules,match,firstMatch,targetFor,usableFolder,validatePair,defaults,config,fingerprint,event,cleanLogs,seasonOf,shouldOpenWindow,suggestFrom,suggestWords,choiceSummary,inboxHints,choiceCondition,choiceRule,ruleFromChoice,countMatches,yearOf,yearFolderName,yearNameOf};
root.LasCore=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
