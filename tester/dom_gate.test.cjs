const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),{spawnSync}=require('node:child_process');
test('ett misslyckat DOM-test ger felkod och stoppar releasekedjan', {timeout:60000},()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'sortbro-dom-gate-'));
 try{
  fs.cpSync(path.join(__dirname,'../addon'),temp,{recursive:true});
  const p=path.join(temp,'ui.html');
  fs.writeFileSync(p,fs.readFileSync(p,'utf8').replace('© Rickard Längkvist','Felaktig copyright för regressionstest'));
  const result=spawnSync(process.execPath,[path.join(__dirname,'dom_check.cjs'),temp],{encoding:'utf8',timeout:50000});
  assert.equal(result.error,undefined);
  assert.equal(result.status,1,result.stdout+'\n'+result.stderr);
  assert.match(result.stdout,/FAIL: copyright/);
  assert.match(result.stdout,/misslyckade/);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
