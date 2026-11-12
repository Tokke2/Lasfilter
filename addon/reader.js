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
 let en=false;
 const request=async type=>{
  const result=await B.runtime.sendMessage({type,token});
  if(!result?.success)throw Error('reader_unavailable');return result.data;
 };
 const fail=()=>{
  $('status').textContent=en?'Display not confirmed – the move is blocked.':'Visningen är inte bekräftad – flytten är spärrad.';
  $('error').hidden=false;$('error').textContent=en?'The message could not be displayed safely. Leave it in the source folder and check it in Thunderbird.':'Mejlet kunde inte visas säkert. Låt det ligga kvar i källmappen och kontrollera det i Thunderbird.';
 };
 $('close').addEventListener('click',()=>window.close());
 try{
  const data=await request('readerData');en=data.lang==='en';document.documentElement.lang=en?'en':'sv';
  document.documentElement.style.fontSize=Math.max(12,Math.min(24,Number(data.fontSize)||16))+'px';
  if(['light','dark'].includes(data.theme))document.documentElement.dataset.theme=data.theme;
  if(en){$('close').textContent='Close message';$('note').textContent='Safe text view – no remote images or scripts are loaded.';$('body').setAttribute('aria-label','Message text');}
  const text=mailText(data.parts);if(!text)throw Error('empty_body');
  document.title=data.subject+' – SortBro';$('subject').textContent=data.subject;$('from').textContent=data.author;
  $('date').textContent=new Date(data.date).toLocaleString(en?'en-GB':'sv-SE');$('body').textContent=text;
  if(data.attachments.length)$('attachments').textContent=(en?'Attachments (open in Thunderbird): ':'Bilagor (öppnas i Thunderbird): ')+data.attachments.join(', ');
  $('status').textContent=en?'The message stays in the source folder until you close this window.':'Mejlet ligger kvar i källmappen tills du stänger detta fönster.';
  // A receipt comes from our populated document after a paint opportunity, not
  // from messageDisplay.getDisplayedMessages (which can report a white view).
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  if(!$('body').getBoundingClientRect().height)throw Error('not_visible');
  await request('readerReady');
  $('body').focus();
 }catch{fail();}
})();
