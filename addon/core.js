/* Läsfilter: rena regler, utan filåtkomst eller nätverk. */
(function(root){
'use strict';
const LIMITS=Object.freeze({rules:200,conditions:8,value:256,queue:100,logs:5000,yearFolders:12,diagnose:20000,examples:5,trialKeys:500,trialDays:7,learnDays:7,learnCount:3,learnEntries:40});
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
 /* Provkörning: en regel kan gå i testläge till ett datum. 0 betyder ingen
    provkörning. Fältet saknas i regler från tidigare versioner och blir då 0. */
 const trialUntil=raw.trialUntil===undefined||raw.trialUntil===null?0:raw.trialUntil;
 if(typeof trialUntil!=='number'||!Number.isFinite(trialUntil)||trialUntil<0)fail('bad_rule');
 const r={id:text(raw.id,80,'bad_id'),name:text(raw.name,100,'bad_name'),enabled:raw.enabled===true,
  source:text(raw.source,2048,'choose_source'),sourceAccount:scope==='account'?text(raw.sourceAccount,2048,'choose_source'):'',scope,
  target:text(raw.target,2048,'choose_target'),match:raw.match,readFilter,unreadAction,trialUntil:Math.floor(trialUntil),yearFolders:raw.yearFolders===true};
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
/* Provkörning: dagar kvar av regelns testperiod. 0 = ingen provkörning eller
   perioden är slut. Används av både motorn (flytta inte) och gränssnittet. */
function trialActive(rule,now=Date.now()){
 const until=Number(rule?.trialUntil)||0;
 return until>0&&until>now;
}
function trialDaysLeft(rule,now=Date.now()){
 const until=Number(rule?.trialUntil)||0;
 if(until<=now)return 0;
 return Math.max(1,Math.ceil((until-now)/86400000));
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
/* Ärlig räkning för snabbregeln: hur många mejl träffas, hur många av dem som är olästa och
   hur många som faktiskt skulle flyttas. Kontot måste stämma – regeln gäller bara ett konto. */
function countHits(messages,rule,{accountId=''}={}){
 if(!rule||!Array.isArray(rule.conditions)||!rule.conditions.length)return {matched:0,unread:0,read:0};
 const list=(Array.isArray(messages)?messages:[]).filter(m=>!accountId||m?.folder?.accountId===accountId);
 let matched=0,unread=0;
 for(const m of list)if(match(rule,m,true,true)){matched++;if(m.read!==true)unread++;}
 return {matched,unread,read:matched-unread};
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
/* ===== Importera domäner/adresser till en regel som redan finns ===== */
function looksLikeEmail(v){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);}
function looksLikeDomain(v){return /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(v);}
/* Ett inklistrat värde blir rätt sorts villkor: adress -> exakt, domän -> exakt, annat ord -> innehåller. */
function importedCondition(value){
 const v=String(value??'').trim().replace(/^mailto:/i,'').replace(/^[<"'(\[]+|[>"')\]]+$/g,'').trim();
 if(!v)fail('bad_value');
 if(looksLikeEmail(v))return {field:'sender',op:'equals',value:v};
 if(looksLikeDomain(v))return {field:'domain',op:'equals',value:v};
 return {field:'sender',op:'contains',value:v};
}
function addressTokens(text){
 return String(text??'').split(/[\s,;|]+/)
  .map(t=>t.trim().replace(/^[<"'([]+|[>"')\]]+$/g,'').replace(/^mailto:/i,''))
  .filter(Boolean).slice(0,200);
}
/* Klistra in en lista (nya rad, komma, semikolon eller mellanslag) -> färdiga villkor.
   Dubbletter, för långa listor och tomma rader räknas i `skipped` i stället för att tyst försvinna. */
function parseImportList(text,{limit=LIMITS.conditions,field='auto'}={}){
 const out=[],seen=new Set();let skipped=0;
 for(const token of addressTokens(text)){
  let cond=null;
  try{cond=field&&field!=='auto'?choiceCondition({field,value:token}):importedCondition(token);}catch{cond=null;}
  if(!cond||String(cond.value).length>LIMITS.value){skipped++;continue;}
  const key=cond.field+'|'+cond.op+'|'+norm(cond.value);
  if(seen.has(key)){skipped++;continue;}
  if(out.length>=limit){skipped++;continue;}
  seen.add(key);out.push(cond);
 }
 return {conditions:out,skipped};
}
/* Lägger till villkor i en befintlig regels villkor utan att röra de gamla. */
function mergeConditions(existing,added,{limit=LIMITS.conditions}={}){
 const merged=[],seen=new Set();let duplicates=0,overflow=0;
 for(const c of Array.isArray(existing)?existing:[]){
  const key=(c.field||'')+'|'+(c.op||'')+'|'+norm(c.value);
  if(seen.has(key))continue;
  seen.add(key);merged.push({field:c.field,op:c.op,value:c.value});
 }
 const addedList=[];
 for(const c of Array.isArray(added)?added:[]){
  const key=(c.field||'')+'|'+(c.op||'')+'|'+norm(c.value);
  if(seen.has(key)){duplicates++;continue;}
  if(merged.length>=limit){overflow++;continue;}
  seen.add(key);merged.push({field:c.field,op:c.op,value:c.value});addedList.push({field:c.field,op:c.op,value:c.value});
 }
 return {conditions:merged,added:addedList,duplicates,overflow,skipped:duplicates+overflow,suggestedMatch:merged.length>1?'any':'all'};
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
function defaults(){return {schema:1,revision:0,rulesVersion:0,paused:false,dryRun:true,moveMode:'read',hourly:true,sweepMinutes:60,newInboxDirect:true,openWindow:true,verbose:true,fileLog:true,autoBackup:true,autoClear:true,brake:true,rules:[]};}
function config(raw){
 if(!raw||raw.schema!==1)fail('bad_schema');
 if(!Number.isSafeInteger(raw.revision)||raw.revision<0||!Number.isSafeInteger(raw.rulesVersion)||raw.rulesVersion<0)fail('bad_schema');
 if(typeof raw.paused!=='boolean'||typeof raw.dryRun!=='boolean')fail('bad_schema');
 if(!['read','direct'].includes(raw.moveMode))fail('bad_schema');
 if(typeof raw.hourly!=='boolean'||typeof raw.openWindow!=='boolean'||typeof raw.verbose!=='boolean')fail('bad_schema');
 const fileLog=raw.fileLog===undefined?true:raw.fileLog;if(typeof fileLog!=='boolean')fail('bad_schema');
 const autoBackup=raw.autoBackup===undefined?true:raw.autoBackup;if(typeof autoBackup!=='boolean')fail('bad_schema');
 /* Cache-rensningen är på som standard, som de andra automatiska rutinerna.
    Konfigurationer från tidigare versioner saknar fältet och får true. */
 const autoClear=raw.autoClear===undefined?true:raw.autoClear;if(typeof autoClear!=='boolean')fail('bad_schema');
 /* Säkerhetsbromsen är på som standard. Konfigurationer från tidigare versioner
    saknar fältet och får då true, precis som när det infördes. */
 const brake=raw.brake===undefined?true:raw.brake;if(typeof brake!=='boolean')fail('bad_schema');
 const sweepMinutes=raw.sweepMinutes===undefined?60:raw.sweepMinutes;if(!Number.isInteger(sweepMinutes)||sweepMinutes<15||sweepMinutes>1440||sweepMinutes%15)fail('bad_schema');
 const newInboxDirect=raw.newInboxDirect===undefined?true:raw.newInboxDirect;if(typeof newInboxDirect!=='boolean')fail('bad_schema');
 return {schema:1,revision:raw.revision,rulesVersion:raw.rulesVersion,paused:raw.paused,dryRun:raw.dryRun,moveMode:raw.moveMode,hourly:raw.hourly,sweepMinutes,newInboxDirect,openWindow:raw.openWindow,verbose:raw.verbose,fileLog,autoBackup,autoClear,brake,rules:validateRules(raw.rules)};
}

/* ── Konfliktvarning: kan två regler matcha samma mejl? ────────────────────
   Analysen är medvetet försiktig: den varnar bara när den kan visa att båda
   reglerna kan träffa samma mejl och skickar det till olika mappar. Hellre
   tyst än en falsk varning. Fälten är oberoende av varandra (ett mejl har en
   avsändare, ett ämne, en storlek …), så varje fält prövas för sig. */

/* Textvillkor på samma fält: finns det någon sträng som uppfyller alla? */
function textSetPossible(conds){
 const eq=conds.filter(c=>c.op==='equals');
 if(eq.length){
  const v=norm(eq[0].value);
  if(eq.some(c=>norm(c.value)!==v))return false; /* två olika equals kan aldrig båda stämma */
  return conds.every(c=>{
   const n=norm(c.value);
   if(c.op==='equals')return true;
   if(c.op==='contains')return v.includes(n);
   if(c.op==='starts')return v.startsWith(n);
   return v.endsWith(n);
  });
 }
 const starts=conds.filter(c=>c.op==='starts').map(c=>norm(c.value));
 if(starts.length){
  const longest=starts.reduce((a,b)=>b.length>=a.length?b:a);
  if(!starts.every(x=>longest.startsWith(x)))return false; /* "anna" och "bob" kan inte båda vara början */
 }
 const ends=conds.filter(c=>c.op==='ends').map(c=>norm(c.value));
 if(ends.length){
  const longest=ends.reduce((a,b)=>b.length>=a.length?b:a);
  if(!ends.every(x=>longest.endsWith(x)))return false;
 }
 return true;
}
/* Datumvillkor blir intervall: date > low och date < high. */
function datePossible(conds,now){
 const y=new Date(now).getFullYear(),jan1=year=>new Date(year,0,1).getTime();
 let low=-Infinity,high=Infinity;
 for(const c of conds){
  const n=Number(c.value);
  if(c.op==='older')high=Math.min(high,now-n*86400000);
  else if(c.op==='newer')low=Math.max(low,now-n*86400000);
  else if(c.op==='before')high=Math.min(high,jan1(n));
  else if(c.op==='after')low=Math.max(low,jan1(n+1));
  else if(c.op==='beforeThisYear')high=Math.min(high,jan1(y));
  else if(c.op==='afterThisYear')low=Math.max(low,jan1(y+1));
 }
 return low<high;
}
/* Kan alla villkor i listan gälla för samma mejl? */
function conditionsPossible(conds,now){
 const byField=new Map();
 for(const c of conds){const key=c.field;if(!byField.has(key))byField.set(key,[]);byField.get(key).push(c);}
 for(const [field,list] of byField){
  if(field==='size'){
   let low=0,high=Infinity;
   for(const c of list){const bytes=Number(c.value)*1024;if(c.op==='larger')low=Math.max(low,bytes);else high=Math.min(high,bytes);}
   if(!(low<high))return false;
  }else if(field==='date'){if(!datePossible(list,now))return false;}
  else if(!textSetPossible(list))return false;
 }
 return true;
}
/* Ett "vittne" per regel: match='all' kräver alla villkor, match='any' räcker ett. */
function ruleWitnesses(rule){
 return rule.match==='any'?rule.conditions.map(c=>[c]):[rule.conditions];
}
function rulesCanCollide(a,b,now){
 for(const A of ruleWitnesses(a))for(const B of ruleWitnesses(b))if(conditionsPossible([...A,...B],now))return true;
 return false;
}
/* Läser samma mappar? folder+account avgörs med en uppslagning av mappens konto. */
function sourcesOverlap(a,b,accountOf){
 const af=a.scope==='folder'?a.source:'',bf=b.scope==='folder'?b.source:'';
 if(af&&bf)return af===bf;
 if(!af&&!bf)return !!a.sourceAccount&&a.sourceAccount===b.sourceAccount;
 const folder=af||bf,account=af?b.sourceAccount:a.sourceAccount;
 const owner=typeof accountOf==='function'?accountOf(folder):'';
 return !!account&&!!owner&&owner===account;
}
function sharedFields(a,b){
 const bf=new Set(b.conditions.map(c=>c.field));
 return [...new Set(a.conditions.map(c=>c.field))].filter(f=>bf.has(f));
}
/* Alla par av aktiva regler som kan träffa samma mejl och har olika mål.
   Den regel som ligger först i listan vinner – svepet kör reglerna i ordning. */
function conflicts(rules,{accountOf,now=Date.now()}={}){
 const list=Array.isArray(rules)?rules:[],out=[];
 for(let i=0;i<list.length;i++){
  const a=list[i];if(!a||a.enabled!==true)continue;
  for(let j=i+1;j<list.length;j++){
   const b=list[j];if(!b||b.enabled!==true)continue;
   if(a.target===b.target)continue; /* samma mål: ingen konflikt */
   if(!sourcesOverlap(a,b,accountOf))continue;
   if(!rulesCanCollide(a,b,now))continue;
   out.push({aId:a.id,bId:b.id,fields:sharedFields(a,b)});
  }
 }
 return out;
}

/* ── "Varför ligger det här mejlet här?" ───────────────────────────────────
   Ett omvänt uppslag: givet ett mejl, vilken regel gäller det, vad skulle
   hända, och vad stoppar det? Analytisk hjälp som i dag bara finns som
   diagnose efter en sparning – men här för ALLA regler, även de som inte
   matchar, så att man ser vilket villkor som fällde avgörandet.

   Tre listor ges ett eget villkor, så att svaret kan säga exakt vad som
   gäller: "regelns källmapp" (måste läsa mejlets mapp), "oläst" (lässtatus),
   och "regeln är avstängd". Allt annat följer av de vanliga villkoren. */

/* Ett villkor som beskriver ett läge som inte står i regeln men som kan stoppa den. */
function pseudoCondition(text){
 return {field:'rule',op:'state',value:text,pseudo:true};
}
function conditionText(c){
 if(c.pseudo)return c.value;
 const v=String(c.value??'');
 if(c.field==='size')return (c.op==='larger'?'större än ':'mindre än ')+v+' kB';
 if(c.field==='date'){
  if(c.op==='older')return 'äldre än '+v+' dagar';
  if(c.op==='newer')return 'nyare än '+v+' dagar';
  if(c.op==='beforeThisYear')return 'från ett tidigare år';
  if(c.op==='afterThisYear')return 'från ett senare år';
  return c.op==='before'?'före '+v:'efter '+v;
 }
 const field={sender:'Avsändare',domain:'Domän',subject:'Ämne',recipient:'Till',cc:'Kopia'}[c.field]||c.field;
 const op={equals:'är',contains:'innehåller',starts:'börjar med',ends:'slutar med'}[c.op]||c.op;
 return field+' '+op+' '+v;
}
/* Varför en regel inte kan gälla mejlet – eller tom sträng om den kan. */
function blockReason(rule,message,{arrived=false}={}){
 if(rule.enabled!==true)return pseudoCondition('regeln är avstängd');
 if(arrived)return '';
 if(rule.scope==='account'){
  if(message.folder?.accountId!==rule.sourceAccount)return pseudoCondition('regeln gäller ett annat konto');
 }else if(message.folder?.id!==rule.source){
  return pseudoCondition('regeln läser en annan mapp än mejlet ligger i');
 }
 return '';
}
/* Ett villkor är uppfyllt eller inte – med pseudo-villkoren ovan som "uppfyllda". */
function conditionPass(c,values,now){
 if(c.pseudo)return true; /* pseudovillkor är redan prövade i blockReason */
 return condHit(c,values,now);
}
function explainRule(rule,message,{now=Date.now(),moveMode='read',displayed=false,queueContains=false,recordsContains=false,arrived=false}={}){
 const reason=blockReason(rule,message,{arrived});
 const values=valuesFor(message);
 const rows=rule.conditions.map(c=>({text:conditionText(c),ok:conditionPass(c,values,now)}));
 const hits=rule.conditions.filter(c=>conditionPass(c,values,now)).length;
 const ruleHit=rule.match==='any'?hits>0:hits===rule.conditions.length;
 /* Lägesvillkoren prövas bara om regeln i övrigt matchar. */
 const state=[];
 const rf=rule.readFilter||'default';
 const direct=rf==='both'||rf==='unread'||(rf==='default'&&moveMode==='direct');
 const allowUnread=rf==='both'||rf==='unread'||(rf==='default'&&moveMode==='direct');
 if(ruleHit&&!reason){
  if(arrived)state.push({text:'mejlet ligger i regelns målmapp – det är hit regeln skickar det',ok:true});
  if(message.read!==true&&!allowUnread)state.push({text:'mejlet är oläst och regeln flyttar bara lästa',ok:false});
  if(message.read===true&&rf==='unread')state.push({text:'regeln flyttar bara olästa, mejlet är läst',ok:false});
  if(displayed&&!direct)state.push({text:'mejlet visas just nu – flytten väntar tills du stänger det',ok:false});
  if(recordsContains)state.push({text:'mejlet är redan hanterat av SortBro',ok:false});
  else if(queueContains)state.push({text:'mejlet ligger redan i kön',ok:true});
 }else if(!ruleHit&&!reason){
  /* Låt den som undrar se vad som fällde avgörandet: de villkor som inte stämde. */
  for(const row of rows)if(!row.ok)state.push({text:row.text+' – stämmer inte på det här mejlet',ok:false});
 }
 const target=ruleHit?targetFor(rule,message):'';
 return {id:rule.id,name:rule.name,enabled:rule.enabled,scope:rule.scope,matches:ruleHit,
  conditions:rows,state,reason:reason?reason.value:'',target,arrived:!!arrived};
}
/* Vilken regel som faktiskt skulle flytta mejlet: första aktiva träff i listordning. */
function whyHere(rules,message,{now=Date.now(),moveMode='read',displayed=false,queueContains=false,recordsContains=false,heldIds=[],sourceOk=true}={}){
 const held=new Set(heldIds);
 const list=Array.isArray(rules)?rules:[];
 const here=message.folder?.id||'';
 /* Ligger mejlet redan i en regels målmapp? Då är det den regelns förklaring –
    frågan "varför ligger det här" gäller oftast ett mejl som redan är flyttat. */
 const targetsOf=r=>[r.target,...(r.branches||[]).map(b=>b.target)];
 const all=list.map(r=>{
  const arrived=!!here&&targetsOf(r).includes(here);
  const item=explainRule(r,message,{now,moveMode,displayed,queueContains,recordsContains,arrived});
  if(held.has(r.id)&&item.matches&&!item.reason)item.state=[...item.state,{text:'regeln är stoppad av säkerhetsbromsen',ok:false}];
  /* blocked räknas om sist, när alla lägesvillkor är på plats – annars kan en regel
     se fri ut trots att den stoppas av läget (oläst, visad, bromsad). */
  item.blocked=!!(item.reason||item.state.some(x=>!x.ok));
  return item;
 });
 /* Den regel som ligger först och inte är stoppad av något annat än läget. */
 const winner=all.find(r=>r.matches&&!r.reason)||null;
 return {folderId:message.folder?.id||'',folderSourceOk:sourceOk!==false,
  matches:all.filter(r=>r.matches).map(r=>r.id),
  winner:winner?winner.id:'',winnerTarget:winner?winner.target:'',
  alreadyThere:!!(winner&&winner.target&&winner.target===here)||!!(here&&all.some(r=>r.arrived&&r.matches)),
  rules:all};
}
function fingerprint(m){return typeof m.headerMessageId==='string'&&m.headerMessageId.length<=4096&&m.headerMessageId?JSON.stringify([m.headerMessageId,+new Date(m.date),m.size]):'';}
const EVENTS=new Set(['start','settings_saved','rules_saved','restored','queued','simulated','moved','skipped','error','queue_full','backup_restored','catchup','debug','brake']);
function event(name,count=0,now=Date.now(),detail=''){
 if(!EVENTS.has(name))return null;
 const data={count:Number.isSafeInteger(count)&&count>=0?count:0};
 if(['debug','error','brake'].includes(name)&&typeof detail==='string'&&detail.trim())data.detail=detail.trim().replace(/[^a-zA-Z0-9åäöÅÄÖ _:=,.;+()/-]/g,'?').slice(0,500);
 return {time:new Date(now).toISOString(),app:'lasfilter',level:['error','queue_full'].includes(name)?'ERROR':'INFO',event:name,data};
}
function cleanLogs(rows,now=Date.now()){
 return (Array.isArray(rows)?rows:[]).filter(r=>r&&EVENTS.has(r.event)&&Number.isFinite(Date.parse(r.time))&&Date.parse(r.time)>=now-30*86400000&&Date.parse(r.time)<=now+60000)
 .slice(-LIMITS.logs).map(r=>event(r.event,r.data?.count,Date.parse(r.time),r.data?.detail));
}
const api={LIMITS,SEASONS,FIELD_OPS,RuleError,fail,norm,domain,email,validateRule,validateRules,match,firstMatch,targetFor,usableFolder,validatePair,defaults,config,fingerprint,event,cleanLogs,seasonOf,shouldOpenWindow,trialActive,trialDaysLeft,suggestFrom,suggestWords,choiceSummary,countHits,looksLikeEmail,looksLikeDomain,importedCondition,parseImportList,mergeConditions,inboxHints,choiceCondition,choiceRule,ruleFromChoice,countMatches,yearOf,yearFolderName,yearNameOf,conflicts,conditionsPossible,textSetPossible,datePossible,sourcesOverlap,rulesCanCollide,
whyHere,explainRule,conditionText,blockReason,pseudoCondition};
root.LasCore=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
