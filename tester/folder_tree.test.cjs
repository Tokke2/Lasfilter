const {test}=require('node:test'),assert=require('node:assert/strict');
const F=require('../addon/folder-tree.js');
const folders=[
 {id:'root-a',accountId:'a',name:'Arkiv',path:'/Arkiv'},
 {id:'child/å&42',accountId:'a',parentId:'root-a',name:'Årsöversikt',path:'/Arkiv/Årsöversikt'},
 {id:'nested',accountId:'a',name:'2025',path:'/Räkenskaper/Årsöversikt/2025'},
 {id:'same-b',accountId:'b',name:'Årsöversikt',path:'/Arkiv/Årsöversikt'}
];
test('mappträdet använder riktiga ID:n och isolerar konton med samma mappnamn',()=>{
 const m=F.build(folders,'a');assert.equal(m.nodes.get('folder:child/å&42').parent.id,'root-a');
 assert.equal(m.nodes.has('folder:same-b'),false);assert.equal(m.nodes.get('folder:child/å&42').id,'child/å&42');
 assert.equal(F.build(folders,'b').nodes.get('folder:same-b').id,'same-b');assert.equal(F.build(folders,'missing').roots.length,0);
});
test('saknade föräldramappar ger navigering utan påhittade valbara ID:n',()=>{
 const m=F.build(folders,'a'),node=m.nodes.get('folder:nested');
 assert.equal(node.parent.name,'Årsöversikt');assert.equal(node.parent.parent.name,'Räkenskaper');
 assert.equal(node.parent.selectable,false);assert.equal(node.parent.id,null);
 assert.equal(node.selectable,true);
});
test('grenarna kan fällas ut och ihop utan att något mål väljs',()=>{
 const m=F.build(folders,'a'),collapsed=F.visible(m);
 assert.equal(collapsed.some(r=>r.node.id==='child/å&42'),false);
 const open=F.visible(m,new Set(['folder:root-a']));
 assert.equal(open.find(r=>r.node.id==='child/å&42').depth,2);
 assert.equal(open.find(r=>r.node.id==='root-a').open,true);assert.equal(F.visible(m).length,collapsed.length);
});
test('sökning hittar svenska Unicode-varianter och visar deras föräldrar',()=>{
 const m=F.build(folders,'a');const rows=F.visible(m,new Set(),'RÄKENSKAPER ÅRSÖVERSIKT'.normalize('NFD'));
 assert.ok(rows.some(r=>r.node.id==='nested'));assert.ok(rows.some(r=>r.node.name==='Räkenskaper'));
 assert.ok(!rows.some(r=>r.node.id==='child/å&42'));assert.equal(F.visible(m,new Set(),'arsoversikt').length,0);
});
test('verkliga mappar med samma sökväg får skilda ID:n, inte ett godtyckligt mål',()=>{
 const m=F.build([{id:'one',accountId:'a',name:'Arkiv',path:'/Arkiv'},{id:'two',accountId:'a',name:'Arkiv',path:'/Arkiv'}],'a');
 assert.equal(m.roots.length,2);assert.deepEqual(new Set(m.roots.map(n=>n.id)),new Set(['one','two']));
});
test('felaktiga föräldracirklar och dubblerade poster låser inte trädet',()=>{
 const items=[{id:'one',parentId:'two',accountId:'a',name:'Ett'},{id:'two',parentId:'one',accountId:'a',name:'Två'}];
 const m=F.build([...items,items[0]],'a'),rows=F.visible(m,new Set(m.nodes.keys()));
 assert.equal(rows.length,2);assert.equal(new Set(rows.map(r=>r.node.id)).size,2);
});
test('svensk och numerisk sortering fungerar och mapplistan ändras aldrig',()=>{
 const data=['Övrigt','Mapp 10','Ärenden','Mapp 2','År','Zebra'].map((name,i)=>Object.freeze({id:String(i),accountId:'a',name,path:'/'+name}));Object.freeze(data);
 const before=JSON.stringify(data),m=F.build(data,'a','sv');
 assert.deepEqual(m.roots.map(n=>n.name),['Mapp 2','Mapp 10','Zebra','År','Ärenden','Övrigt']);
 assert.equal(JSON.stringify(data),before);
});
test('explicit förälder går före en ofullständig sökväg',()=>{
 const m=F.build([{id:'p',accountId:'a',name:'Arkiv'},{id:'c',accountId:'a',parentId:'p',name:'Kvitton'}],'a');
 assert.equal(m.nodes.get('folder:c').parent.id,'p');assert.equal(m.roots.length,1);
});
