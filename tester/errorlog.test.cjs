const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../addon/core.js');

test('felloggen samlar fel och äldre debugfel, inte normal aktivitet',()=>{
 const rows=[C.event('error',0,Date.now(),'move_error'),C.event('queue_full'),C.event('debug',0,Date.now(),'diagnos_query_failed'),C.event('moved',30),C.event('debug',0,Date.now(),'allt klart'),C.event('brake')];
 assert.deepEqual(C.cleanErrorLogs(rows).map(x=>x.event),['error','queue_full','debug']);
});
test('fel gallras efter 30 dagar och begränsas till 5000, oberoende av normal logg',()=>{
 const now=Date.now(),old=C.event('error',0,now-31*86400000,'gammalt');
 const kept=C.event('error',0,now,'behalls');
 assert.deepEqual(C.cleanErrorLogs([old,kept,...Array(6000).fill(C.event('moved'))],now),[kept]);
 assert.equal(C.cleanErrorLogs(Array(6000).fill(kept),now).length,5000);
 assert.deepEqual(C.cleanErrorLogs([null,{},C.event('error',0,now+120000)],now),[]);
});
test('texten visar senaste fel först, tid, kod, antal och aktuella versioner',()=>{
 const text=C.errorLogText([C.event('error',2,Date.now()-5000,'aldre'),C.event('error',1,Date.now(),'nyare')],{version:'1.2.3',tbVersion:'140.5',installType:'normal'});
 assert.match(text,/Antal felposter: 2/);
 assert.match(text,/error: 2/);
 assert.match(text,/Version \(aktuell session\): 1\.2\.3/);
 assert.match(text,/Thunderbird: 140\.5/);
 assert.match(text,/Installation: normal/);
 assert.ok(text.indexOf('nyare')<text.indexOf('aldre'));
 assert.match(text,/\terror\t2\taldre/);
});
test('tom eller skadad historik ger en ärlig tomrapport',()=>{
 assert.match(C.errorLogText(null),/Inga registrerade fel i den sparade historiken/);
 assert.match(C.errorLogText([{event:'error',time:'invalid'}]),/Antal felposter: 0/);
});
