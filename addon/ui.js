'use strict';
const $=id=>document.getElementById(id),C=LasCore;
const DEMO=!!globalThis.LAS_DEMO||new URLSearchParams(location.search).get('demo')==='1';
const live=!!globalThis.browser?.runtime?.id;
let state=null,folders=[],selectedId='',dirty=false,editRevision=0,editToken='',activeView='rules',toastTimer;
const errors={bad_branch:'Ogiltig fördelning. Varje fördelning behöver ett villkor och en målmapp.',disabled:'Regeln är avstängd. Aktivera den först.',bad_domain:'Ange en fullständig domän, exempelvis fortnox.se.',bad_rule:'Ogiltig regel.',bad_id:'Ogiltigt regel-id.',bad_name:'Ange ett regelnamn, högst 100 tecken.',choose_source:'Välj en källmapp.',choose_target:'Välj en målmapp.',same_folder:'Källa och mål får inte vara samma mapp.',bad_match:'Välj hur villkoren ska kombineras.',bad_conditions:'En regel behöver 1–8 villkor.',bad_field:'Ogiltigt fält.',bad_operator:'Ogiltigt villkor för det valda fältet.',bad_value:'Varje villkor behöver ett värde med högst 256 tecken.',too_many_rules:'Högst 200 regler stöds.',duplicate_id:'Filen innehåller upprepade regel-id:n.',rule_cycle:'Reglerna skulle skapa en flyttloop. Ändra käll- eller målmapp.',unsafe_folder:'Välj en vanlig mapp, inte en specialmapp eller sökmapp.',same_account:'Välj källa och mål i samma konto i denna version.',read_only:'Mappen tillåter inte en riktig flytt. Ingen kopiering görs som reserv.',bad_schema:'Regelfilen har ett okänt eller ogiltigt format.',no_selection:'Öppna en mejlflik och markera ett meddelande där först.',one_message:'Markera exakt ett meddelande i den senaste mejlfliken.',stale_config:'Reglerna har ändrats. Öppna den sparade regeln igen innan du sparar.',paused:'Bevakningen är pausad eller spärrad.',unread:'Meddelandet är oläst och får inte flyttas.',no_match:'Ingen aktiv regel matchar det markerade meddelandet.',operation_running:'En flytt pågår. Vänta tills Thunderbird har svarat.',uncertain_move:'Ett flyttförsök har osäkert resultat. Kontrollera mapparna och rensa sedan spärren under Inställningar.',storage_error:'Inställningarna kunde inte sparas. Motorn är stoppad i denna session.',invalid_storage:'Lagrade inställningar kunde inte läsas. Bevakningen är stoppad.',display_error:'Visningsstatus kunde inte läsas säkert. Bevakningen är stoppad.',move_error:'Mapp eller meddelande kunde inte kontrolleras för flytt. Kontrollera regel och mappar.',sweep_error:'Kontrollen av befintliga mejl misslyckades. Kontrollera att regelns käll- och målmappar finns kvar och är skrivbara.',queue_full:'Kön nådde säkerhetsgränsen. Bevakningen är stoppad.',internal_error:'Ett tekniskt fel inträffade. Ingen automatisk omkörning görs.',not_installed:'Öppna denna app som installerat Thunderbird-tillägg.',bad_request:'Åtgärden kunde inte utföras.'};
const eventNames={start:'Bevakningen startad',debug:'Detalj',catchup:'Befintliga lästa sorterade',settings_saved:'Inställningar sparade',rules_saved:'Regler sparade',restored:'Väntande jobb återställda',queued:'Meddelande köat',simulated:'Test utfört – ingen flytt',moved:'Flytt bekräftad av Thunderbird',skipped:'Meddelande överhoppat',error:'Tekniskt fel',queue_full:'Kön full',backup_restored:'Regelkopia återställd'};
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
function toast(text,error=false){const n=$('toast');n.textContent=text;n.style.background=error?'#8e3731':'';n.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>n.hidden=true,6500);}
function alertError(err){toast(errors[err.code||err.message]||errors.internal_error,true);}
async function rpc(type,data={}){
 if(!live&&!DEMO)throw new C.RuleError('not_installed');
 const reply=DEMO?await LasDemo.request({type,...data}):await browser.runtime.sendMessage({type,...data});
 if(!reply?.success)throw new C.RuleError(reply?.error||'internal_error');return reply.data;
}
function handle(id,event,fn){$(id).addEventListener(event,async e=>{try{await fn(e);}catch(err){alertError(err);}});}
const label=id=>folders.find(f=>f.id===id)?.label||'Mapp saknas – välj igen';
function applyTheme(prefs){
 let theme=prefs.theme;if(theme==='system')theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
 document.documentElement.dataset.theme=theme;document.documentElement.style.setProperty('--base',(prefs.fontSize||14)+'px');
 $('theme').value=prefs.theme;$('fontSize').value=String(prefs.fontSize);
 if(state.moveMode!==undefined){$('moveMode').value=state.moveMode;$('openWindow').checked=true;$('hourly').checked=!!state.hourly;$('sweepMinutes').value=String(state.sweepMinutes||60);$('newInboxDirect').checked=state.newInboxDirect!==false;$('verbose').checked=!!state.config.verbose;$('fileLog').checked=state.config.fileLog!==false;}
}
function currentToken(){return JSON.stringify(state.config.rules);}
function renderStatus(next){
 state=next;applyTheme(state.prefs);
 const cfg=state.config,active=cfg.rules.filter(r=>r.enabled).length;
 $('navCount').textContent=cfg.rules.length;$('countRules').textContent=active;$('countQueue').textContent=state.queued;
 $('countMoved').textContent=state.stats.moved;$('countMatched').textContent=state.stats.matched;$('simulated').textContent=state.stats.simulated+' test';
 $('statusPill').textContent=state.fault?'STOPPAD':cfg.paused?'PAUSAD':cfg.dryRun?'TEST · FLYTTAR INGET':'AKTIV · FLYTTAR MEJL';
 $('statusPill').className='pill '+(state.fault?'red':cfg.dryRun||cfg.paused?'amber':'green');
 $('pause').textContent=cfg.paused?'Starta bevakning':'Pausa';$('mode').textContent=cfg.dryRun?'Slå på riktiga flyttar':'Byt till testläge';
 const guide=$('runGuide'),rulesReady=active>0;
 let guideClass='',icon='✓',title='Riktiga flyttar är aktiva',text=rulesReady?'Nya matchande mejl bevakas. Kör kontroll nu för att även skanna befintliga mejl.':'Skapa och aktivera minst en regel för att börja.';
 if(state.fault){guideClass='fault';icon='!';title='Flyttmotorn är stoppad';text=(errors[state.fault]||errors.internal_error)+' Öppna Aktivitet och kontrollera den senaste raden.';}
 else if(cfg.paused){guideClass='paused';icon='Ⅱ';title='Bevakningen är pausad';text='Inga nya mejl köas eller flyttas. Klicka Starta bevakning när du vill fortsätta.';}
 else if(cfg.dryRun){guideClass='test';icon='T';title='Testläge – inga mejl flyttas';text=rulesReady?'Reglerna kan matcha och räknas som test, men mapparna ändras inte. Slå på riktiga flyttar när resultatet ser rätt ut.':'Skapa en regel. Testläget är säkert och flyttar ingenting.';}
 $('runIcon').textContent=icon;$('runTitle').textContent=title;$('runText').textContent=text;guide.className='run-guide '+guideClass;
 const setup=[cfg.rules.length>0,active>0,!cfg.dryRun&&!cfg.paused&&!state.fault];
 for(let i=0;i<3;i++){$('setup'+(i+1)).className='setup-step'+(setup[i]?' done':'')+(!setup[i]&&(i===0||setup[i-1])?' current':'');$('setup'+(i+1)).querySelector('b').textContent=setup[i]?'✓':String(i+1);}
 $('sweepNow').disabled=!!state.fault||cfg.paused||!rulesReady;$('sweepNow').textContent=state.queued?'Kontrollera kön nu':'Kör kontroll nu';
 $('notice').hidden=!state.fault;$('notice').className='notice error';$('notice').textContent=state.fault?'STOPPAD: '+(errors[state.fault]||errors.internal_error)+' Inga fler automatiska försök görs innan problemet är åtgärdat.':'';
 $('lastCheck').textContent=state.lastCheck?'Senaste kontroll: '+new Date(state.lastCheck).toLocaleTimeString('sv-SE')+' · '+state.stats.checks+' mejl kontrollerade sedan start':'Bevakningen väntar på ett matchande mejl';
 if(editToken===currentToken())editRevision=cfg.revision;
 renderRules();renderActivity();renderBackups();
}
function renderRules(){
 const list=$('ruleList');list.replaceChildren();const search=C.norm($('ruleSearch').value);
 const shown=state.config.rules.filter(r=>C.norm(r.name).includes(search));
 if(!shown.length){list.append(el('p','empty',state.config.rules.length?'Ingen regel matchar sökningen.':'Börja med en ny regel. Inga exempelregler aktiveras på dina mejl.'));return;}
 for(const rule of shown){
  const row=el('div','rule-row'+(selectedId===rule.id?' selected':''));
  const check=el('input');check.type='checkbox';check.checked=rule.enabled;check.setAttribute('aria-label','Aktivera '+rule.name);
  check.addEventListener('change',async()=>{try{
   if(dirty&&!confirm('Lämna osparade ändringar i redigeraren?')){check.checked=!check.checked;return;}
   const rules=state.config.rules.map(r=>r.id===rule.id?{...r,enabled:check.checked}:r);
   const next=await rpc('saveRules',{rules,revision:state.config.revision});dirty=false;renderStatus(next);loadRule(rule.id);
  }catch(e){check.checked=!check.checked;alertError(e);}});
  const btn=el('button','rule-open');btn.type='button';btn.append(el('strong','',rule.name));
  const c=rule.conditions[0];btn.append(el('small','',({sender:'Från',domain:'Domän',subject:'Ämne'}[c.field])+' · '+c.value+(rule.conditions.length>1?'  + '+(rule.conditions.length-1)+' villkor':'')));
  const f=folders.find(f=>f.id===rule.target);btn.append(el('small','','↳ '+(f?.label||'Mapp saknas')));
  btn.append(el('span','rule-tag',rule.enabled?(rule.scope==='account'?'Hela kontot · efter läsning':'Vald mapp · efter läsning'):'Avstängd'));
  btn.addEventListener('click',()=>{if(!dirty||confirm('Lämna osparade ändringar?'))loadRule(rule.id);});
  row.append(check,btn);list.append(row);
 }
}
function selectOptions(select,items,placeholder,value=''){
 select.replaceChildren();const blank=el('option','',placeholder);blank.value='';select.append(blank);
 for(const f of items){const o=el('option','',f.label);o.value=f.id;select.append(o);}select.value=value;
}
function accounts(){const seen=new Set();return folders.filter(f=>{if(!f.accountId||seen.has(f.accountId))return false;seen.add(f.accountId);return true;}).map(f=>({id:f.accountId,label:f.accountName||f.accountId}));}
function accountOptions(value=''){selectOptions($('source'),accounts(),'Välj ett konto…',value);}
function targetOptions(value=''){
 // Mål kan ligga i samma eller ett annat konto (t.ex. IMAP → Lokala mappar).
 selectOptions($('target'),folders,'Välj en målmapp…',value);
}
function addBranchRow(b={condition:{field:'subject',op:'contains',value:''},target:''}){
 if($('branches').children.length>=8){toast('Högst åtta fördelningar per regel.');return;}
 const row=el('div','branch-row'),field=el('select'),op=el('select'),value=el('input'),target=el('select'),remove=el('button','remove-condition','×');
 field.setAttribute('aria-label','Fördelningsfält');op.setAttribute('aria-label','Fördelningsjämförelse');value.setAttribute('aria-label','Fördelningsvärde');value.maxLength=256;value.required=true;value.placeholder='Exempel: Faktura';target.setAttribute('aria-label','Fördelningsmålmapp');remove.type='button';remove.title='Ta bort fördelning';remove.setAttribute('aria-label','Ta bort fördelning');
 for(const [v,t] of [['subject','Ämne'],['sender','Från (adress)'],['domain','Avsändardomän']]){const x=el('option','',t);x.value=v;field.append(x);}field.value=b.condition.field;
 function operators(val){op.replaceChildren();for(const [v,t] of [['contains','innehåller'],['equals','är exakt'],['starts','börjar med'],['ends','slutar med']]){if(field.value==='domain'&&v!=='equals')continue;const x=el('option','',t);x.value=v;op.append(x);}op.value=[...op.options].some(o=>o.value===val)?val:'contains';}
 operators(b.condition.op);value.value=b.condition.value;
 selectOptions(target,folders,'Välj målmapp…',b.target);
 field.addEventListener('change',()=>{operators(op.value);dirty=true;});remove.addEventListener('click',()=>{row.remove();dirty=true;});
 row.append(field,op,value,target,remove);$('branches').append(row);
}
function addCondition(c={field:'domain',op:'equals',value:''}){
 if($('conditions').children.length>=8){toast('Högst åtta villkor per regel.');return;}
 const row=el('div','condition-row'),field=el('select'),op=el('select'),value=el('input'),remove=el('button','remove-condition','×');
 field.setAttribute('aria-label','Villkorsfält');op.setAttribute('aria-label','Jämförelse');value.setAttribute('aria-label','Villkorsvärde');value.maxLength=256;value.required=true;value.placeholder='Exempel: fortnox.se';remove.type='button';remove.title='Ta bort villkor';remove.setAttribute('aria-label','Ta bort villkor');
 for(const [v,t] of [['domain','Avsändardomän'],['sender','Från (adress)'],['subject','Ämne']]){const x=el('option','',t);x.value=v;field.append(x);}field.value=c.field;
 function operators(val){op.replaceChildren();for(const [v,t] of [['equals','är exakt'],['contains','innehåller'],['starts','börjar med'],['ends','slutar med']]){if(field.value==='domain'&&v!=='equals')continue;const x=el('option','',t);x.value=v;op.append(x);}op.value=[...op.options].some(o=>o.value===val)?val:'equals';}
 operators(c.op);value.value=c.value;
 field.addEventListener('change',()=>{operators(op.value);dirty=true;});remove.addEventListener('click',()=>{if($('conditions').children.length===1){toast('Behåll minst ett villkor.');return;}row.remove();dirty=true;});
 row.append(field,op,value,remove);$('conditions').append(row);
}
function draft(){const accountId=$('source').value,old=state.config.rules.find(r=>r.id===selectedId),anchor=(old?.sourceAccount===accountId&&folders.some(f=>f.id===old.source)?old.source:folders.find(f=>f.accountId===accountId)?.id)||'';return C.validateRule({id:selectedId||crypto.randomUUID(),name:$('ruleName').value,enabled:$('enabled').checked,source:anchor,sourceAccount:accountId,scope:'account',target:$('target').value,match:$('match').value,
 conditions:[...$('conditions').children].map(row=>({field:row.children[0].value,op:row.children[1].value,value:row.children[2].value})),
 branches:[...$('branches').children].map(row=>({condition:{field:row.children[0].value,op:row.children[1].value,value:row.children[2].value},target:row.children[3].value}))});}
function loadRule(id=''){
 const rule=state.config.rules.find(r=>r.id===id);selectedId=rule?.id||'';
 $('editorTitle').textContent=rule?'Redigera regel':'Ny regel';$('ruleName').value=rule?.name||'';$('enabled').checked=rule?.enabled??true;
 $('match').value=rule?.match||'all';const ruleAccount=rule?.sourceAccount||folders.find(f=>f.id===rule?.source)?.accountId||'';accountOptions(ruleAccount);targetOptions(rule?.target||'');
 $('conditions').replaceChildren();for(const c of rule?.conditions||[{field:'domain',op:'equals',value:''}])addCondition(c);
 $('branches').replaceChildren();for(const b of rule?.branches||[])addBranchRow(b);
 $('testResult').hidden=true;$('delete').disabled=!rule;const i=state.config.rules.findIndex(r=>r.id===selectedId);$('up').disabled=i<=0;$('down').disabled=i<0||i>=state.config.rules.length-1;
 dirty=false;editRevision=state.config.revision;editToken=currentToken();renderRules();
 rpc('prefs',{prefs:{lastRule:selectedId}}).catch(()=>{});
}
function renderActivity(){
 $('logRows').replaceChildren();for(const log of [...state.logs].reverse()){
  const tr=el('tr');for(const text of [new Date(log.time).toLocaleString('sv-SE'),(eventNames[log.event]||'Teknisk händelse')+(log.data.detail?' – '+log.data.detail:''),log.level,log.data.count])tr.append(el('td','',text));$('logRows').append(tr);
 }
 if(!state.logs.length){const tr=el('tr'),td=el('td','','Inga händelser ännu.');td.colSpan=4;tr.append(td);$('logRows').append(tr);}
}
function renderBackups(){
 $('backupList').replaceChildren();for(const b of state.backups){const row=el('div','backup');row.append(el('span','',new Date(b.time).toLocaleString('sv-SE')+' · '+b.count+' regler'));const btn=el('button','text-button','Återställ');btn.addEventListener('click',async()=>{if(!confirm('Återställ denna regelversion? Nuvarande regler säkerhetskopieras. Bevakningen blir pausad i testläge.'))return;try{const s=await rpc('restoreBackup',{index:b.index,revision:state.config.revision});dirty=false;renderStatus(s);loadRule();toast('Regelversion återställd. Testa innan du aktiverar.');}catch(e){alertError(e);}});row.append(btn);$('backupList').append(row);}
 if(!state.backups.length)$('backupList').append(el('p','muted','En kopia skapas när du sparar din första regeländring.'));
 $('blockedInfo').textContent=state.blocked?state.blocked+' spärrade/osäkra försök. Kontrollera mapparna i Thunderbird innan spärrarna rensas.':'Inga osäkra flyttförsök.';
 $('clearBlocked').disabled=!state.blocked||!!state.inflight;
}
async function download(data,filename){
 const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
 try{if(live&&!DEMO)await browser.downloads.download({url,filename,saveAs:true});else{const a=el('a');a.href=url;a.download=filename;a.click();}}
 finally{setTimeout(()=>URL.revokeObjectURL(url),60000);}
}
function showView(view){activeView=view;document.querySelectorAll('.view').forEach(n=>n.hidden=n.id!=='view-'+view);document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('active',n.dataset.view===view));}
for(const nav of document.querySelectorAll('[data-view]'))nav.addEventListener('click',()=>showView(nav.dataset.view));
$('ruleForm').addEventListener('input',()=>dirty=true);$('ruleForm').addEventListener('change',()=>dirty=true);
handle('newRule','click',()=>{if(!dirty||confirm('Lämna osparade ändringar?'))loadRule();});
handle('ruleSearch','input',renderRules);
handle('source','change',()=>{dirty=true;});
handle('addCondition','click',()=>{addCondition({field:'subject',op:'contains',value:''});dirty=true;});
handle('addBranch','click',()=>{addBranchRow();dirty=true;});
handle('ruleForm','submit',async e=>{
 e.preventDefault();const rule=draft();$('save').disabled=true;
 try{const rules=[...state.config.rules],i=rules.findIndex(r=>r.id===rule.id);if(i<0)rules.push(rule);else rules[i]=rule;
 const next=await rpc('saveRules',{rules,revision:editRevision});dirty=false;renderStatus(next);loadRule(rule.id);toast('Regeln sparad. Testa den på ett markerat mejl.');}
 finally{$('save').disabled=false;}
});
handle('fromSelected','click',async()=>{
 const m=await rpc('selected');if(!folders.some(f=>f.accountId===m.sourceAccount))throw new C.RuleError('unsafe_folder');
 $('source').value=m.sourceAccount;targetOptions($('target').value);
 const row=$('conditions').children[0],field=row.children[0].value;
 row.children[2].value=field==='domain'?m.domain:field==='sender'?m.email:m.subject.slice(0,256);
 if(!$('ruleName').value)$('ruleName').value=('Mejl från '+(m.domain||'avsändaren')).slice(0,100);
 dirty=true;$('target').focus();toast('Klart! Exempelmejlet är hämtat. Välj nu målmappen och tryck Spara.');
});
handle('test','click',async()=>{
 const result=await rpc('testRule',{rule:draft()});
 const reasons={no_match:'Villkoren matchar inte det markerade mejlet.',disabled:'Villkoren matchar, men regeln är avstängd.',unread:'Villkoren matchar, men mejlet är oläst. Ingen flytt får ske.',displayed:'Villkoren matchar. Mejlet är läst men fortfarande öppet i en mejlflik eller ett fönster.',eligible:'Villkoren matchar. Mejlet är läst och visas inte längre.'};
 $('testResult').textContent='TEST · '+reasons[result.reason]+' Testet flyttar ingenting. '+(result.matches?'Mål: '+label(result.target)+'. ':'')+'Testet gäller bara regeln i redigeraren och bortser från vilken mapp mejlet ligger i.'+(result.outsideSource?' Mejlet ligger just nu utanför källmappen: bevakningen flyttar nya mejl som kommer till källmappen, och "Sortera befintliga lästa" flyttar redan befintliga mejl oavsett mapp.':'');$('testResult').hidden=false;
});
handle('delete','click',async()=>{if(!selectedId||!confirm('Ta bort regeln? En regelkopia sparas. Inga mejl tas bort.'))return;const next=await rpc('saveRules',{rules:state.config.rules.filter(r=>r.id!==selectedId),revision:editRevision});dirty=false;renderStatus(next);loadRule();});
for(const [id,step] of [['up',-1],['down',1]])handle(id,'click',async()=>{
 if(dirty){toast('Spara regeln innan du ändrar prioritet.');return;}const rules=[...state.config.rules],i=rules.findIndex(r=>r.id===selectedId),j=i+step;if(i<0||j<0||j>=rules.length)return;
 [rules[i],rules[j]]=[rules[j],rules[i]];renderStatus(await rpc('saveRules',{rules,revision:editRevision}));loadRule(selectedId);
});
handle('pause','click',async()=>{renderStatus(await rpc('setMode',{revision:state.config.revision,paused:!state.config.paused,dryRun:state.config.dryRun}));});
handle('mode','click',async()=>{
 const becomingLive=state.config.dryRun;
 if(becomingLive&&!confirm('Aktivera riktiga mejlflyttar enligt dina aktiva regler?\n\nBörja med en provmapp och granska Testa-resultaten. Väntande testjobb rensas. Befintliga olästa mejl flyttas inte.'))return;
 renderStatus(await rpc('setMode',{revision:state.config.revision,paused:false,dryRun:!becomingLive}));toast(becomingLive?'Flyttläge aktiverat för nya läsmarkeringar.':'Testläge aktiverat. Inga nya flyttar startas.');
});
handle('queueSelected','click',async()=>{const r=await rpc('queueSelected');toast(r.queued?'Mejlet väntar nu på att lämnas i alla mejlflikar.':'Redan hanterat eller köat i denna session.');});
handle('showActivity','click',()=>showView('activity'));
handle('sweepNow','click',async()=>{
 $('sweepNow').disabled=true;$('sweepNow').textContent='Kontrollerar…';
 try{
  const r=await rpc('sweepNow');renderStatus(await rpc('status'));
  const mode=state.config.dryRun?' Testläge: inga mejl flyttas.':' Matchande mejl flyttas när de inte längre visas.';
  toast('Kontrollen är klar: '+r.scanned+' mejl granskade i '+(r.searchedFolders??'kontots')+' mappar, '+r.queued+' matchade och köade.'+(r.deferred?' '+r.deferred+' väntar till nästa timsvep eftersom flyttkön tar 500 åt gången.':'')+(r.skippedFolders?' '+r.skippedFolders+' otillgängliga mappar hoppades över.':'')+mode);
 }finally{if(state)$('sweepNow').disabled=!!state.fault||state.config.paused||!state.config.rules.some(r=>r.enabled);}
});
handle('catchUp','click',async()=>{
 if(dirty){toast('Spara regeln först.');return;}
 if(!selectedId){toast('Öppna eller skapa en regel först.');return;}
 if(!confirm('Skanna kontots mappar, inklusive undermappar men utan regelns målmappar, efter befintliga lästa mejl som matchar den sparade regeln?\n\nOlästa mejl röras inte. I testläge räknas träffar som prov utan flytt.'))return;
 const r=await rpc('catchUp',{ruleId:selectedId});renderStatus(await rpc('status'));
 toast('Skannade '+r.scanned+' meddelanden i '+(r.searchedFolders??'kontots')+' mappar, köade '+r.queued+'.'+(r.deferred?' '+r.deferred+' väntar till nästa timsvep (500 per batch).':'')+(r.skippedFolders?' '+r.skippedFolders+' otillgängliga mappar hoppades över.':'')+(state.config.dryRun?' Testläge: inga flyttar utfördes.':''));
});
handle('export','click',async()=>download(await rpc('export'),'lasfilter-regler-'+new Date().toISOString().slice(0,10)+'.json'));
handle('exportLog','click',async()=>download(await rpc('exportLog'),'lasfilter-tekniklogg-'+new Date().toISOString().slice(0,10)+'.json'));
handle('import','change',async()=>{
 try{const file=$('import').files[0];if(!file)return;if(file.size>1048576)throw new C.RuleError('bad_schema');let data;try{data=JSON.parse(await file.text());}catch{throw new C.RuleError('bad_schema');}
 if(!confirm('Ersätt reglerna med denna fil? Nuvarande regler kopieras. Efter import blir bevakningen pausad i testläge.'))return;
 const next=await rpc('import',{backup:data,revision:state.config.revision});dirty=false;renderStatus(next);loadRule();toast('Regler importerade. Granska mappar och villkor.');}finally{$('import').value='';}
});
handle('clearBlocked','click',async()=>{if(!confirm('Har du kontrollerat de berörda mapparna?\n\nSpärrarna rensas utan ångring eller omförsök. Bevakningen blir pausad.'))return;renderStatus(await rpc('clearBlocked'));});
handle('theme','change',async()=>{state.prefs=await rpc('prefs',{prefs:{theme:$('theme').value}});applyTheme(state.prefs);});
handle('fontSize','change',async()=>{state.prefs=await rpc('prefs',{prefs:{fontSize:Number($('fontSize').value)}});applyTheme(state.prefs);});
handle('themeQuick','click',async()=>{state.prefs=await rpc('prefs',{prefs:{theme:document.documentElement.dataset.theme==='dark'?'light':'dark'}});applyTheme(state.prefs);});
handle('moveMode','change',async()=>{renderStatus(await rpc('setOptions',{revision:state.config.revision,moveMode:$('moveMode').value,hourly:$('hourly').checked,sweepMinutes:Number($('sweepMinutes').value),newInboxDirect:$('newInboxDirect').checked,openWindow:true,verbose:$('verbose').checked,fileLog:$('fileLog').checked}));toast($('moveMode').value==='direct'?'Direktläge: nya matchande mejl flyttas även olästa och öppnas i eget fönster.':'Nya mejl flyttas när de är lästa och lämnade.');});
for(const id of ['openWindow','hourly','sweepMinutes','newInboxDirect','verbose','fileLog'])handle(id,'change',async()=>{renderStatus(await rpc('setOptions',{revision:state.config.revision,moveMode:$('moveMode').value,hourly:$('hourly').checked,sweepMinutes:Number($('sweepMinutes').value),newInboxDirect:$('newInboxDirect').checked,openWindow:true,verbose:$('verbose').checked,fileLog:$('fileLog').checked}));if(id==='verbose')toast($('verbose').checked?'Detaljlogg på: händelser syns under Aktivitet och i exporten.':'Detaljlogg av.');if(id==='fileLog')toast($('fileLog').checked?'Loggfil på: Hämtade filer/Lasfilter/lasfilter-logg.txt uppdateras automatiskt.':'Automatisk loggfil av.');if(id==='sweepMinutes')toast('Kontosvep körs var '+$('sweepMinutes').value+':e minut.');if(id==='newInboxDirect')toast($('newInboxDirect').checked?'Nya matchande mejl i Inkorgen flyttas direkt.':'Direktflytt av nyinkomna mejl är avstängd.');});
handle('refreshFolders','click',async()=>{folders=await rpc('folders');const src=$('source').value,target=$('target').value;accountOptions(src);targetOptions(target);renderRules();toast('Konton och mappar uppdaterade.');});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if(state)applyTheme(state.prefs);});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
async function refresh(){try{renderStatus(await rpc('status'));}catch(e){alertError(e);}}
if(live&&!DEMO)browser.runtime.onMessage.addListener(msg=>{if(msg?.event==='statusChanged')refresh();});
(async()=>{
 try{if(DEMO)$('demoBanner').hidden=false;folders=await rpc('folders');renderStatus(await rpc('status'));loadRule(state.prefs.lastRule||state.config.rules[0]?.id||'');}
 catch(e){$('statusPill').textContent='Inte ansluten';$('notice').hidden=false;$('notice').textContent=errors[e.code]||errors.internal_error;$('notice').className='notice error';}
})();
