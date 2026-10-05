(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.SupabaseSync=api.createSyncClient({fetch:root.fetch.bind(root),authStorage:root.localStorage,events:root,document:root.document});
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const TABLE_KEYS={answer_logs:['event_id'],saved_words:['word_key'],preferences:['setting_key'],unit_sessions:['session_id'],article_states:['article_id'],opinion_drafts:['article_id','prompt_id']};
  const APPEND=new Set(['answer_logs','unit_sessions']);
  const AUTH_KEY='english-notes.auth.session.v1',LAST_KEY='english-notes.sync.last.v1';
  const quoted=value=>'"'+String(value).replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"';
  const filterValue=(column,value)=>column==='event_id'||column==='user_id'?String(value):quoted(value);
  function createSyncClient(options={}){
    const fetcher=options.fetch||globalThis.fetch.bind(globalThis),authStorage=options.authStorage;
    const now=options.now||Date.now,online=options.online||(()=>typeof navigator==='undefined'||navigator.onLine!==false);
    const listeners=new Set(),controllers=new Set();let storage,config=null,policy=null,session=null,generation=0,flight=null,queued=false,queuedFull=false,timer=null,refreshFlight=null;
    let state={enabled:false,status:'disabled',user:null,pendingCount:0,lastSyncedAt:null,error:null,migrationPreview:null,migrationResult:null};
    const current=()=>session?.user?.id||null;
    function emit(){
      state.pendingCount=storage?.pending().length||0;
      state.blockedCount=storage?.blocked?.().length||0;
      if(storage?.snapshot)state.migrationResult=storage.snapshot().migration?.importResult||null;
      const preview=storage?.migrationPreview?.();
      state.migrationPreview=preview?{...preview,guest:{counts:preview.guestCounts||preview.counts},legacy:{counts:preview.legacyCounts||{}}}:null;
      for(const fn of listeners){try{fn(getState());}catch(_){/* A UI subscriber must not stop persistence. */}}
    }
    function getState(){return {...state,user:state.user?{...state.user}:null};}
    function assertOwner(owner,epoch){if(current()!==owner||generation!==epoch){const error=new Error('Account changed');error.stale=true;throw error;}if(storage.getUser()!==owner)throw new Error('利用者別の端末保存を確認できませんでした。');}
    function persistSession(value){if(value)authStorage?.setItem(AUTH_KEY,JSON.stringify(value));else authStorage?.removeItem(AUTH_KEY);}
    function cancelRequests(){for(const controller of controllers)controller.abort();controllers.clear();}
    async function raw(path,{method='GET',body,token,headers={}}={}){
      const controller=new AbortController();controllers.add(controller);
      const timeout=setTimeout(()=>controller.abort(),options.requestTimeoutMs||20000);timeout.unref?.();
      try{
        const response=await fetcher(config.url+path,{method,signal:controller.signal,headers:{apikey:config.key,...(token?{Authorization:'Bearer '+token}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{}),...headers},...(body!==undefined?{body:JSON.stringify(body)}:{})});
        if(!response.ok){const error=new Error(response.status===401?'認証が切れました。もう一度ログインしてください。':'同期できませんでした。通信と接続設定を確認してください。');error.status=response.status;error.dataWriteRejected=method==='POST'&&path.startsWith('/rest/v1/');try{const detail=await response.json();if(typeof detail.code==='string'&&/^[a-z_]+$/.test(detail.code))error.code=detail.code;}catch(_){}throw error;}
        if(response.status===204)return null;
        return await response.json();
      }finally{clearTimeout(timeout);controllers.delete(controller);}
    }
    async function refresh(owner,epoch,force=false){
      assertOwner(owner,epoch);
      if(!force&&session.expires_at>now()/1000+60)return;
      if(!refreshFlight){
        const old=session;
        refreshFlight=raw('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:old.refresh_token}}).then(value=>{
          assertOwner(owner,epoch);if(value.user.id!==owner)throw new Error('認証された利用者が一致しません。');
          session={...value,expires_at:value.expires_at||now()/1000+value.expires_in};persistSession(session);
        }).finally(()=>{refreshFlight=null;});
      }
      await refreshFlight;assertOwner(owner,epoch);
    }
    async function request(path,opts,owner,epoch){
      await refresh(owner,epoch);
      try{const result=await raw(path,{...opts,token:session.access_token});assertOwner(owner,epoch);return result;}
      catch(error){if(error.status!==401)throw error;await refresh(owner,epoch,true);const result=await raw(path,{...opts,token:session.access_token});assertOwner(owner,epoch);return result;}
    }
    function identityQuery(table,rows,owner){const keys=TABLE_KEYS[table],query=new URLSearchParams({select:['user_id',...keys].join(','),user_id:'eq.'+owner});if(keys.length===1)query.set(keys[0],'in.('+rows.map(row=>filterValue(keys[0],row[keys[0]])).join(',')+')');else query.set('or','('+rows.map(row=>'and('+keys.map(key=>key+'.eq.'+filterValue(key,row[key])).join(',')+')').join(',')+')');return query;}
    async function sendPending(owner,epoch){
      // A snapshot prevents a continuously edited note from blocking all reads.
      for(const entry of [...storage.pending()]){
        assertOwner(owner,epoch);
        if(!TABLE_KEYS[entry.table]||entry.row.user_id!==owner)throw new Error('送信データの利用者が一致しません。');
        try{
          const row={...entry.row};delete row.server_updated_at;
          const query=new URLSearchParams({on_conflict:['user_id',...TABLE_KEYS[entry.table]].join(',')});
          let accepted=await request('/rest/v1/'+entry.table+'?'+query,{method:'POST',body:row,headers:{Prefer:'resolution='+(APPEND.has(entry.table)?'ignore-duplicates':'merge-duplicates')+',return=representation'}},owner,epoch);
          if(!Array.isArray(accepted))throw new Error('同期の応答を確認できませんでした。');
          // A successful conflict-ignored write is delivered even when no row
          // is returned. The adopted value is resolved by the normal pull.
          assertOwner(owner,epoch);storage.acknowledge(entry.table,entry.key,entry.revision);if(accepted.length)storage.merge(entry.table,accepted);
        }catch(error){
          assertOwner(owner,epoch);
          if(error.dataWriteRejected&&error.status>=400&&error.status<500&&error.status!==401&&storage.block){
            storage.block(entry.table,entry.key,entry.revision,{status:error.status,code:error.code});emit();
          }else throw error;
        }
      }
    }
    function continuation(table,last){
      const columns=['server_updated_at',...TABLE_KEYS[table]];
      return '('+columns.map((column,index)=>{
        const equal=columns.slice(0,index).map(c=>c+'.eq.'+filterValue(c,last[c]));
        const greater=column+'.gt.'+filterValue(column,last[column]);return equal.length?'and('+[...equal,greater].join(',')+')':greater;
      }).join(',')+')';
    }
    async function pullTable(table,full,owner,epoch){
      const cursor=storage.cursor(table),pageSize=options.pageSize||500,all=[];let last=null,max=cursor;
      do{
        const query=new URLSearchParams({select:'*',user_id:'eq.'+owner,order:['server_updated_at',...TABLE_KEYS[table]].map(c=>c+'.asc').join(','),limit:String(pageSize)});
        if(!full&&cursor)query.set('server_updated_at','gte.'+new Date(Date.parse(cursor)-policy.deltaOverlapMs).toISOString());
        if(last)query.set('or',continuation(table,last));
        const rows=await request('/rest/v1/'+table+'?'+query,{},owner,epoch);
        if(!Array.isArray(rows))throw new Error('同期の応答を確認できませんでした。');
        if(rows.some(row=>row.user_id!==owner))throw new Error('受信データの利用者が一致しません。');
        all.push(...rows);
        for(const row of rows)if(row.server_updated_at&&(!max||Date.parse(row.server_updated_at)>Date.parse(max)))max=row.server_updated_at;
        if(rows.length<pageSize)break;
        const next=rows.at(-1);if(last&&JSON.stringify(next)===JSON.stringify(last))throw new Error('同期ページの取得が進みませんでした。');last=next;
      }while(true);
      assertOwner(owner,epoch);storage.merge(table,all);if(max)storage.cursor(table,max);
    }
    async function cycle(full){
      const owner=current(),epoch=generation;
      if(!state.enabled||!owner)return getState();
      if(storage.getUser()!==owner){state.status='failed';state.error='利用者別の端末保存を確認できませんでした。';emit();return getState();}
      try{integrateGuest(owner,epoch);}catch(error){if(!error.stale){state.status='failed';state.error='端末の学習記録を保存できませんでした。保存領域を確認してください。';emit();}return getState();}
      if(!online()){state.status=storage.pending().length?'pending':'failed';state.error='通信が戻ると同期を再開します。';emit();return getState();}
      state.status='syncing';state.error=null;emit();
      try{
        await sendPending(owner,epoch);
        for(const table of Object.keys(TABLE_KEYS))await pullTable(table,full,owner,epoch);
        await verifyIntegration(owner,epoch);
        assertOwner(owner,epoch);state.lastSyncedAt=new Date(now()).toISOString();storage.setItem?.(LAST_KEY,state.lastSyncedAt);
        state.status=storage.blocked?.().length?'failed':storage.pending().length?'pending':'synced';state.error=storage.blocked?.().length?'送信できないデータがあります。':null;emit();
      }catch(error){if(!error.stale&&current()===owner&&generation===epoch){try{await verifyIntegration(owner,epoch,false);}catch(_){/* Local data and outbox remain available for the next cycle. */}state.status='failed';state.error=error.message&&error.status?error.message:'同期に失敗しました。未送信データは端末に残っています。';emit();}}
      return getState();
    }
    function sync({full=false}={}){
      if(flight){queued=true;queuedFull=queuedFull||full;return flight;}
      flight=(async()=>{let nextFull=full;do{queued=false;queuedFull=false;await cycle(nextFull);nextFull=queuedFull;}while(queued&&state.enabled&&current());return getState();})().finally(()=>{flight=null;});return flight;
    }
    function schedule(){
      if(!state.enabled||!current())return;
      if(storage.pending().length&&state.status!=='syncing'&&state.status!=='failed')state.status='pending';emit();
      if(timer)clearTimeout(timer);timer=setTimeout(()=>{timer=null;void sync();},120);timer.unref?.();
    }
    async function init({storage:adapter}={}){
      storage=adapter;
      try{
        const response=await fetcher('config/supabase.json',{cache:'no-store'});if(!response.ok){emit();return getState();}
        const value=await response.json(),url=String(value.url||'').trim(),key=String(value.anonKey||value.publishableKey||'').trim();
        if(!url||!key){emit();return getState();}
        if(new URL(url).protocol!=='https:')throw new Error('Invalid connection URL');
        if(key.startsWith('sb_secret_'))throw new Error('Private key is not permitted');
        if(key.split('.').length===3){try{const payload=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));if(payload.role!=='anon')throw new Error('Private key is not permitted');}catch(error){throw new Error('Public key is invalid');}}
        config={url:url.replace(/\/$/,''),key};
        const policyResponse=await fetcher('config/sync-policy.json',{cache:'no-store'});if(!policyResponse.ok)throw new Error('Sync policy is missing');policy=await policyResponse.json();if(!Number.isFinite(policy.deltaOverlapMs)||policy.deltaOverlapMs<0)throw new Error('Sync policy is invalid');
        state.enabled=true;state.status='guest';
        try{session=JSON.parse(authStorage?.getItem(AUTH_KEY)||'null');}catch(_){session=null;}
        if(session?.user?.id&&session.access_token&&session.refresh_token){storage.setUser(session.user.id);state.user={id:session.user.id,email:session.user.email};state.lastSyncedAt=storage.getItem?.(LAST_KEY)||null;}else session=null;
        let pendingSignature=JSON.stringify(storage.pending().map(entry=>[entry.table,entry.key,entry.revision]));
        storage.subscribe?.(event=>{
          const signature=JSON.stringify(storage.pending().map(entry=>[entry.table,entry.key,entry.revision]));
          const changed=signature!==pendingSignature;pendingSignature=signature;
          if(changed&&storage.pending().length||event?.reason==='guest-catalog')schedule();else emit();
        });
        options.events?.addEventListener('online',schedule);options.events?.addEventListener('pageshow',schedule);
        options.document?.addEventListener('visibilitychange',()=>{if(options.document.visibilityState==='visible')schedule();});
        emit();if(current())await sync();
      }catch(_){session=null;state.user=null;state.enabled=false;state.status='disabled';state.error='同期設定または端末の保存領域を確認してください。';emit();}
      return getState();
    }
    async function login(email,password){
      if(!state.enabled)throw new Error('接続設定がありません。');
      const previousSession=session,previousUser=storage.getUser(),previousState=getState();
      const epoch=++generation;cancelRequests();refreshFlight=null;
      try{
        const value=await raw('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});
        if(epoch!==generation)throw new Error('ログインが中断されました。');
        if(!value.user?.id||!value.access_token||!value.refresh_token)throw new Error('認証の応答を確認できませんでした。');
        const nextSession={...value,expires_at:value.expires_at||now()/1000+value.expires_in};
        storage.setUser(value.user.id);persistSession(nextSession);session=nextSession;
        state.user={id:value.user.id,email:value.user.email};state.lastSyncedAt=storage.getItem?.(LAST_KEY)||null;state.error=null;state.migrationResult=null;emit();await sync();return getState();
      }catch(error){
        if(epoch!==generation)throw new Error('ログインが中断されました。');
        try{storage.setUser(previousUser);session=previousSession;state={...previousState};}
        catch(_){session=null;state.user=null;state.enabled=false;}
        state.status='failed';state.error='ログインできませんでした。認証情報と端末の保存領域を確認してください。';emit();const failure=new Error(state.error);if(error.status)failure.status=error.status;failure.code=error.code||(error.status===401?'invalid_credentials':(error.status||error instanceof TypeError||error.name==='AbortError')?'connection_failed':'login_failed');throw failure;
      }
    }
    async function logout(){
      const previous=session;++generation;cancelRequests();session=null;refreshFlight=null;
      try{persistSession(null);}catch(_){/* In-memory authentication is still revoked. */}
      if(timer)clearTimeout(timer);timer=null;
      try{storage.setUser(null);}catch(_){state.user=null;state.status='failed';state.error='ログアウトしましたが、ゲストの保存領域を開けませんでした。保存領域を確認してください。';emit();return getState();}
      state.user=null;state.status=state.enabled?'guest':'disabled';state.lastSyncedAt=null;state.error=null;state.migrationResult=null;emit();
      if(previous&&online()){try{await raw('/auth/v1/logout?scope=local',{method:'POST',token:previous.access_token});}catch(_){/* Local logout still completes offline. */}}
      return getState();
    }
    function recordImportResult(result){
      state.migrationResult=storage.recordImportResult?.(result)||result;emit();return state.migrationResult;
    }
    function integrateGuest(owner,epoch){assertOwner(owner,epoch);const preview=storage.migrationPreview?.();if(!preview?.available)return;const result=storage.importGuest();assertOwner(owner,epoch);if(result.imported!==false)storage.markGuestImported(result.snapshotId,owner);emit();}
    async function verifyIntegration(owner,epoch,read=true){
      const target=storage.snapshot?.().migration?.pendingVerification;if(!target)return;
      const waiting=[...storage.pending(),...(storage.blocked?.()||[])],counts={},tables={};let successCount=0,failureCount=0,pendingCount=0,unverifiedCount=0;
      for(const [table,rows]of Object.entries(target.targetRows||{})){
        const found=new Set();
        // Bound URL sizes; seven imported answers use one in-filter, not seven GETs.
        if(read)for(let offset=0;offset<rows.length;offset+=100){try{const values=await request('/rest/v1/'+table+'?'+identityQuery(table,rows.slice(offset,offset+100),owner),{},owner,epoch);if(Array.isArray(values))for(const row of values)if(row.user_id===owner)found.add(JSON.stringify(TABLE_KEYS[table].map(key=>row[key])));}catch(error){if(error.stale)throw error;assertOwner(owner,epoch);}}
        const outcomes=[];counts[table]=0;let failed=0;
        for(const row of rows){const id=JSON.stringify(TABLE_KEYS[table].map(key=>row[key])),key=TABLE_KEYS[table].length===1?row[TABLE_KEYS[table][0]]:id;const outstanding=waiting.find(entry=>entry.table===table&&entry.key===key);let status;if(outstanding?.status){status='blocked';failureCount++;failed++;}else if(outstanding){status='pending';pendingCount++;}else{status=found.has(id)?'verified':'accepted';successCount++;counts[table]++;if(status==='accepted')unverifiedCount++;}outcomes.push({key,status});}
        tables[table]={successful:counts[table],failed,outcomes};
      }
      assertOwner(owner,epoch);recordImportResult({snapshotId:target.snapshotId,success:failureCount===0&&pendingCount===0,verified:failureCount===0&&pendingCount===0&&unverifiedCount===0,imported:true,targetCounts:counts,successCount,failureCount,pendingCount,unverifiedCount,tables});
    }
    // Kept as an internal compatibility entry point; the UI never asks to import.
    async function importGuest(){if(!current())throw new Error('ログインしてください。');await sync();return storage.snapshot?.().migration?.importResult||{imported:false};}
    return {init,login,logout,sync,resync:()=>sync({full:true}),getState,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},importGuest,blockedData:()=>storage.blocked?.()||[],discardBlocked:(table,key,revision)=>{if(!current())throw new Error('ログインしてください。');assertOwner(current(),generation);const removed=storage.discardBlocked(table,key,revision);emit();return removed;},exportData:()=>storage.exportData()};
  }
  return {createSyncClient};
});
