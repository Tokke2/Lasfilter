/* Failure metadata only: never retain exception messages, mail bodies or stacks. */
(function(root){
'use strict';
const phases=['unknown','message_read','target_resolve','source_read','target_read','source_capabilities','target_capabilities','source_validate','target_validate','accounts_read','accounts_validate','folder_query','display_check','window_check','reader_identity','reader_body','reader_create','reader_receipt','journal_before','message_recheck','journal_attempt','final_gate','move_call','move_receipt','journal_confirmation','restore_attempted'];
const reasons=['timeout','read_only','unsafe_folder','same_folder','storage_error','display_error','window_error','uncertain_move','invalid_storage','api_error','invalid_response','not_confirmed','missing_account'];
const codes=['move_error','display_error','window_error','storage_error','uncertain_move','invalid_storage','internal_error','sweep_error'];
function reason(error){const code=error?.reason||error?.code;return reasons.includes(code)?code:error?.name==='TimeoutError'?'timeout':'api_error';}
function cleanIssue(raw){
 if(!raw||typeof raw!=='object'||!['global','account','folder'].includes(raw.scope)||!phases.includes(raw.phase)||!reasons.includes(raw.reason)||!codes.includes(raw.code)||!Number.isSafeInteger(raw.at)||raw.at<0||![true,false,null].includes(raw.called))throw Error('invalid_failure');
 const out={};for(const key of ['id','accountId','folderId','source','target','ruleId']){if(typeof raw[key]!=='string'||raw[key].length>2048)throw Error('invalid_failure');out[key]=raw[key];}
 if(!/^incident-[0-9]+-[0-9]+$/.test(out.id)||raw.scope==='account'&&!out.accountId||raw.scope==='folder'&&!out.folderId||raw.scope!=='global'&&raw.called!==false)throw Error('invalid_failure');
 return {...out,scope:raw.scope,phase:raw.phase,reason:raw.reason,code:raw.code,at:raw.at,called:raw.called};
}
function cleanState(raw){
 if(raw===undefined)return {global:null,holds:[]};
 if(!raw||!Array.isArray(raw.holds)||raw.holds.length>100)throw Error('invalid_failure');
 const global=raw.global===null?null:cleanIssue(raw.global),holds=raw.holds.map(cleanIssue);
 if(global&&global.scope!=='global'||holds.some(x=>x.scope==='global')||new Set(holds.map(x=>x.scope+':'+(x.scope==='account'?x.accountId:x.folderId))).size!==holds.length)throw Error('invalid_failure');
 return {global,holds};
}
const api={phases,reasons,codes,reason,cleanIssue,cleanState};root.LasHealth=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
