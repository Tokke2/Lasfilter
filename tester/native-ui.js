/* TEST ONLY: exercises the actual extension UI and its runtime-message bridge. */
(async()=>{
 const results=[];const delay=ms=>new Promise(r=>setTimeout(r,ms));
 const assert=(condition,name)=>{if(!condition)throw Error(name);results.push({name,pass:true});};
 async function until(fn){const end=Date.now()+8000;while(Date.now()<end){if(fn())return;await delay(100);}throw Error('UI timeout');}
 try{
  await until(()=>document.getElementById('ruleName').value==='Fakturor · provkonto');
  assert(document.querySelectorAll('.rule-row').length===1,'native rule list loaded');
  assert(document.getElementById('source').options.length>1,'native account folders populated');
  document.getElementById('fromSelected').click();
  await until(()=>document.getElementById('toast').textContent.includes('Hämtat från'));
  assert(document.querySelector('.condition-row input').value==='example.invalid','actual selected sender fetched into rule');
  document.getElementById('test').click();await until(()=>!document.getElementById('testResult').hidden);
  assert(document.getElementById('testResult').textContent.includes('Villkoren matchar'),'real selected-message dry test responds');
  document.getElementById('themeQuick').click();await until(()=>document.documentElement.dataset.theme==='dark');
  assert(document.documentElement.dataset.theme==='dark','native theme preference saved');
 }catch(e){results.push({name:e.message,pass:false});}
 dump('LF_UI_RESULT '+JSON.stringify({results,pass:results.filter(r=>r.pass).length,fail:results.filter(r=>!r.pass).length})+'\n');
})();
