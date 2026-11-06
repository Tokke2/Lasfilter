/* Mappträd för visning. Endast riktiga Thunderbird-ID:n får väljas som mål. */
(function(root){
'use strict';
const norm=s=>String(s??'').normalize('NFKC').toLocaleLowerCase('sv-SE');
const parts=f=>String(f.path||f.name||'').split('/').filter(Boolean);
function build(folders,accountId,locale='sv'){
 const nodes=new Map(),byId=new Map(),byPath=new Map();
 for(const f of folders){
  if(f.accountId!==accountId||!f.id||byId.has(f.id))continue;
  const path=parts(f),node={key:'folder:'+f.id,id:f.id,name:f.name||path.at(-1)||f.id,path:path.join('/'),parent:null,children:[],selectable:true};
  nodes.set(node.key,node);byId.set(f.id,{folder:f,node,path});
  const key=JSON.stringify(path);if(!byPath.has(key))byPath.set(key,[]);byPath.get(key).push(node);
 }
 function parentFor(path){
  if(!path.length)return null;
  const key=JSON.stringify(path),real=byPath.get(key);
  if(real?.length===1)return real[0];
  const virtualKey='path:'+key;
  if(nodes.has(virtualKey))return nodes.get(virtualKey);
  const node={key:virtualKey,id:null,name:path.at(-1),path:path.join('/'),parent:null,children:[],selectable:false};
  nodes.set(node.key,node);node.parent=parentFor(path.slice(0,-1));return node;
 }
 for(const {folder,node,path} of byId.values())node.parent=byId.get(folder.parentId)?.node||parentFor(path.slice(0,-1));
 // Defensivt: felaktiga föräldrakedjor får inte låsa gränssnittet.
 for(const node of nodes.values()){
  const seen=new Set([node]);let parent=node.parent;
  while(parent){if(seen.has(parent)){node.parent=null;break;}seen.add(parent);parent=parent.parent;}
 }
 const roots=[];
 for(const node of nodes.values())(node.parent?node.parent.children:roots).push(node);
 const compare=(a,b)=>a.name.localeCompare(b.name,locale,{numeric:true})||a.path.localeCompare(b.path,locale)||a.key.localeCompare(b.key);
 roots.sort(compare);for(const node of nodes.values())node.children.sort(compare);
 return {nodes,roots};
}
function matches(node,query){const text=norm(node.name+' '+node.path);return norm(query).trim().split(/\s+/).filter(Boolean).every(w=>text.includes(w));}
function visible(model,expanded=new Set(),query=''){
 const searching=!!query.trim(),included=new Set();
 if(searching)for(const node of model.nodes.values())if(matches(node,query)){
  let parent=node;while(parent){included.add(parent.key);parent=parent.parent;}
 }
 const rows=[],stack=model.roots.map(node=>({node,depth:1})).reverse();
 while(stack.length){
  const {node,depth}=stack.pop();if(searching&&!included.has(node.key))continue;
  const open=node.children.length>0&&(searching||expanded.has(node.key));
  rows.push({node,depth,open});
  if(open)for(let i=node.children.length-1;i>=0;i--)stack.push({node:node.children[i],depth:depth+1});
 }
 return rows;
}
const api={build,visible,matches};root.LasFolderTree=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
