/* Läsfilter: rena regler, utan filåtkomst eller nätverk. */
(function(root){
'use strict';
const LIMITS=Object.freeze({rules:200,conditions:8,value:256,queue:500,logs:500});
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
 const r={id:text(raw.id,80,'bad_id'),name:text(raw.name,100,'bad_name'),enabled:raw.enabled===true,
  source:text(raw.source,2048,'choose_source'),target:text(raw.target,2048,'choose_target'),match:raw.match};
 if(!/^[a-zA-Z0-9_-]+$/.test(r.id))fail('bad_id');
 if(r.source===r.target)fail('same_folder');
 if(!['all','any'].includes(r.match))fail('bad_match');
 if(!Array.isArray(raw.conditions)||!raw.conditions.length||raw.conditions.length>LIMITS.conditions)fail('bad_conditions');
 r.conditions=raw.conditions.map(validateCondition);
 r.branches=(Array.isArray(raw.branches)?raw.branches:[]).map(b=>{
  if(!b||typeof b!=='object')fail('bad_branch');
  const target=text(b.target,2048,'choose_target');if(target===r.source)fail('same_folder');
  return {condition:validateCondition(b.condition),target};
 });
 if(r.branches.length>LIMITS.conditions)fail('bad_branch');
 return r;
}
function validateCondition(c){
 if(!c||!['sender','domain','subject'].includes(c.field))fail('bad_field');
 if(!['contains','equals','starts','ends'].includes(c.op)||(c.field==='domain'&&c.op!=='equals'))fail('bad_operator');
 let value=text(c.value,LIMITS.value,'bad_value');if(c.field==='domain')value=domain(value);
 return {field:c.field,op:c.op,value};
}
function validateRules(raw){
 if(!Array.isArray(raw)||raw.length>LIMITS.rules)fail('too_many_rules');
 const rules=raw.map(validateRule),ids=new Set();
 for(const r of rules){if(ids.has(r.id))fail('duplicate_id');ids.add(r.id);}
 const edges=new Map();for(const r of rules.filter(r=>r.enabled)){if(!edges.has(r.source))edges.set(r.source,[]);edges.get(r.source).push(r.target,...(r.branches||[]).map(b=>b.target));}
 const visiting=new Set(),visited=new Set();
 function visit(id){if(visiting.has(id))fail('rule_cycle');if(visited.has(id))return;visiting.add(id);for(const next of edges.get(id)||[])visit(next);visiting.delete(id);visited.add(id);}
 for(const id of edges.keys())visit(id);
 return rules;
}
function valuesFor(message){const address=email(message.author);return {sender:address,domain:address.split('@')[1]||'',subject:typeof message.subject==='string'?message.subject.slice(0,20000):''};}
function condHit(c,values){
 const hay=norm(values[c.field]),needle=norm(c.value);if(!hay||!needle)return false;
 if(c.op==='equals')return hay===needle;if(c.op==='contains')return hay.includes(needle);
 if(c.op==='starts')return hay.startsWith(needle);return hay.endsWith(needle);
}
function match(rule,message,includeDisabled=false,ignoreSource=false){
 if((!rule.enabled&&!includeDisabled)||(!ignoreSource&&message.folder?.id!==rule.source))return false;
 const values=valuesFor(message);const hits=rule.conditions.map(c=>condHit(c,values));
 return rule.match==='all'?hits.every(Boolean):hits.some(Boolean);
}
function targetFor(rule,message){
 const values=valuesFor(message);
 for(const b of rule.branches||[])if(condHit(b.condition,values))return b.target;
 return rule.target;
}
function firstMatch(rules,message){return rules.find(r=>match(r,message))||null;}
function usableFolder(f){return !!(f&&f.id&&f.accountId&&!f.isRoot&&!f.isVirtual&&!f.isUnified&&!f.isTag&&![...(f.specialUse||[]),f.type].some(t=>['trash','junk','drafts','sent','templates','outbox'].includes(t)));}
function validatePair(source,target,sourceCaps,targetCaps){
 if(!usableFolder(source)||!usableFolder(target))fail('unsafe_folder');
 if(source.id===target.id)fail('same_folder');
 if(sourceCaps.canDeleteMessages!==true||targetCaps.canAddMessages!==true)fail('read_only');
}
function defaults(){return {schema:1,revision:0,rulesVersion:0,paused:false,dryRun:true,moveMode:'read',hourly:true,openWindow:true,verbose:false,rules:[]};}
function config(raw){
 if(!raw||raw.schema!==1)fail('bad_schema');
 if(!Number.isSafeInteger(raw.revision)||raw.revision<0||!Number.isSafeInteger(raw.rulesVersion)||raw.rulesVersion<0)fail('bad_schema');
 if(typeof raw.paused!=='boolean'||typeof raw.dryRun!=='boolean')fail('bad_schema');
 if(!['read','direct'].includes(raw.moveMode))fail('bad_schema');
 if(typeof raw.hourly!=='boolean'||typeof raw.openWindow!=='boolean'||typeof raw.verbose!=='boolean')fail('bad_schema');
 return {schema:1,revision:raw.revision,rulesVersion:raw.rulesVersion,paused:raw.paused,dryRun:raw.dryRun,moveMode:raw.moveMode,hourly:raw.hourly,openWindow:raw.openWindow,verbose:raw.verbose,rules:validateRules(raw.rules)};
}
function fingerprint(m){return typeof m.headerMessageId==='string'&&m.headerMessageId.length<=4096&&m.headerMessageId?JSON.stringify([m.headerMessageId,+new Date(m.date),m.size]):'';}
const EVENTS=new Set(['start','settings_saved','rules_saved','restored','queued','simulated','moved','skipped','error','queue_full','backup_restored','catchup','debug']);
function event(name,count=0,now=Date.now(),detail=''){
 if(!EVENTS.has(name))return null;
 const data={count:Number.isSafeInteger(count)&&count>=0?count:0};
 if(name==='debug'&&typeof detail==='string'&&detail.trim())data.detail=detail.trim().slice(0,240);
 return {time:new Date(now).toISOString(),app:'lasfilter',level:['error','queue_full'].includes(name)?'ERROR':'INFO',event:name,data};
}
function cleanLogs(rows,now=Date.now()){
 return (Array.isArray(rows)?rows:[]).filter(r=>r&&EVENTS.has(r.event)&&Number.isFinite(Date.parse(r.time))&&Date.parse(r.time)>=now-10*86400000&&Date.parse(r.time)<=now+60000)
 .slice(-LIMITS.logs).map(r=>event(r.event,r.data?.count,Date.parse(r.time),r.data?.detail));
}
const api={LIMITS,RuleError,fail,norm,domain,email,validateRule,validateRules,match,firstMatch,targetFor,usableFolder,validatePair,defaults,config,fingerprint,event,cleanLogs};
root.LasCore=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
