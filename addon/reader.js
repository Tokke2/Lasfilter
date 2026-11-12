'use strict';
/* Mail markup is parsed inertly and converted to text. It is NEVER inserted as
   HTML into the privileged extension document. No URLs, images or scripts run. */
function mailText(parts){
 return parts.map(part=>{
  if(part.type==='text/plain')return part.body.trim();
  const doc=new DOMParser().parseFromString(part.body,'text/html');
  doc.querySelectorAll('script,style,head,iframe,object,embed,template,svg,math,noscript').forEach(n=>n.remove());
  doc.querySelectorAll('br,hr').forEach(n=>n.replaceWith(doc.createTextNode('\n')));
  doc.querySelectorAll('p,div,tr,li,h1,h2,h3,h4,section,article,table').forEach(n=>n.append(doc.createTextNode('\n')));
  doc.querySelectorAll('td,th').forEach(n=>n.append(doc.createTextNode('\t')));
  return (doc.body.textContent||'').replace(/\n[ \t]*\n[ \t]*\n/g,'\n\n').trim();
 }).filter(Boolean).join('\n\n');
}
(async()=>{
 const $=id=>document.getElementById(id),token=location.hash.slice(1),B=browser;
 let en=false,pauseBusy=false,ready=false,pauseState={paused:false,until:0};
 const request=async(type,extra={})=>{
  const result=await B.runtime.sendMessage({type,token,...extra});
  if(!result?.success)throw Error('reader_unavailable');return result.data;
 };
 const renderPause=next=>{
  if(next)pauseState=next;
  const time=pauseState.until>0?new Date(pauseState.until).toLocaleString(en?'en-GB':'sv-SE',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'';
  const text=pauseState.saving?(en?'Saving pause choice…':'Sparar pausval…'):!pauseState.paused?(en?'New reading windows are not paused.':'Nya läsfönster är inte pausade.'):pauseState.until===-1?(en?'New reading windows are paused until you resume.':'Nya läsfönster är pausade tills du fortsätter.'):(en?'New reading windows are paused until '+time+'. They resume automatically.':'Nya läsfönster är pausade till '+time+'. De återupptas automatiskt.');
  if($('readerPauseStatus').textContent!==text)$('readerPauseStatus').textContent=text;
  const resumingFocus=document.activeElement===$('readerPauseResume')&&!pauseState.paused;
  $('readerPauseResume').hidden=!pauseState.paused;
  for(const id of ['readerPauseDuration','readerPauseApply','readerPauseResume'])$(id).disabled=pauseBusy||pauseState.saving===true;
  $('close').disabled=pauseBusy;
  if(resumingFocus&&!pauseBusy)$('readerPauseApply').focus();
 };
 const pauseError=()=>{
  $('readerPauseError').hidden=false;
  $('readerPauseError').textContent=en?'The pause choice could not be confirmed. Check the status in SortBro.':'Pausvalet kunde inte bekräftas. Kontrollera statusen i SortBro.';
 };
 const setPause=async mode=>{
  if(pauseBusy||!ready)return;
  pauseBusy=true;$('readerPauseError').hidden=true;renderPause();
  try{renderPause(await request('readerPause',{mode}));}catch{pauseError();}
  finally{pauseBusy=false;renderPause();if(mode==='resume'&&!pauseState.paused)$('readerPauseApply').focus();}
 };
 $('readerPauseApply').addEventListener('click',()=>setPause($('readerPauseDuration').value));
 $('readerPauseResume').addEventListener('click',()=>setPause('resume'));
 B.runtime.onMessage?.addListener((msg,sender)=>{
  if(sender?.id===B.runtime.id&&msg?.event==='readerPauseChanged')renderPause(msg.readerPause);
 });
 window.addEventListener('focus',async()=>{if(ready&&!pauseBusy)try{renderPause(await request('readerState'));}catch{pauseError();}});
 const fail=()=>{
  $('close').textContent=en?'Close message':'Stäng mejlet';
  $('readerPauseControls').hidden=true;
  $('status').textContent=en?'Display not confirmed – the move is blocked.':'Visningen är inte bekräftad – flytten är spärrad.';
  $('error').hidden=false;$('error').textContent=en?'The message could not be displayed safely. Leave it in the source folder and check it in Thunderbird.':'Mejlet kunde inte visas säkert. Låt det ligga kvar i källmappen och kontrollera det i Thunderbird.';
 };
 $('close').addEventListener('click',()=>window.close());
 try{
  const data=await request('readerData');en=data.lang==='en';document.documentElement.lang=en?'en':'sv';
  document.documentElement.style.fontSize=Math.max(12,Math.min(24,Number(data.fontSize)||16))+'px';
  if(['light','dark'].includes(data.theme))document.documentElement.dataset.theme=data.theme;
  if(en){
   $('close').textContent='Close message';$('note').textContent='Safe text view – no remote images or scripts are loaded.';$('body').setAttribute('aria-label','Message text');
   $('readerPauseTitle').textContent='Pause new reading windows';$('readerPauseDurationLabel').textContent='Pause duration';
   $('readerPauseHelp').textContent='Applies to Before-move windows. Messages waiting for display stay put during the pause. This already-open message may move when you close it and all other views are closed. Other sorting continues.';
   const labels=['15 minutes','1 hour','Until I resume'];[...$('readerPauseDuration').options].forEach((option,i)=>option.textContent=labels[i]);
   $('readerPauseApply').textContent='Pause new windows';$('readerPauseResume').textContent='Resume new reading windows';
  }
  renderPause(data.readerPause||{paused:false,until:0});
  const text=mailText(data.parts);if(!text)throw Error('empty_body');
  document.title=data.subject+' – SortBro';$('subject').textContent=data.subject;$('from').textContent=data.author;
  $('date').textContent=new Date(data.date).toLocaleString(en?'en-GB':'sv-SE');$('body').textContent=text;
  if(data.attachments.length)$('attachments').textContent=(en?'Attachments (open in Thunderbird): ':'Bilagor (öppnas i Thunderbird): ')+data.attachments.join(', ');
  $('status').textContent=en?'The message stays in the source folder until you close this window.':'Mejlet ligger kvar i källmappen tills du stänger detta fönster.';
  // A receipt comes from our populated document after a paint opportunity, not
  // from messageDisplay.getDisplayedMessages (which can report a white view).
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  if(!$('body').getBoundingClientRect().height)throw Error('not_visible');
  await request('readerReady');ready=true;
  $('close').textContent=en?'Close and move once all other views are closed':'Stäng och flytta när övriga visningar är stängda';
  $('readerPauseControls').hidden=false;
  $('body').focus();
 }catch{fail();}
})();
