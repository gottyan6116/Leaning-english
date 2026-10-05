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
  function createSyncClient(options={}){
    const fetcher=options.fetch||globalThis.fetch.bind(globalThis),authStorage=options.authStorage;
    const now=options.now||Date.now,online=options.online||(()=>typeof navigator==='undefined'||navigator.onLine!==false);
    const listeners=new Set(),controllers=new Set();let storage,config=null,policy=null,session=null,generation=0,flight=null,queued=false,queuedFull=false,timer=null,refreshFlight=null;
    let state={enabled:false,status:'disabled',user:null,pendingCount:0,lastSyncedAt:null,error:null,migrationPreview:null,migrationResult:null};
    const current=()=>session?.user?.id||null;
    function emit(){
      state.pendingCount=storage?.pending().length||0;
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
        if(!response.ok){const error=new Error(response.status===401?'認証が切れました。もう一度ログインしてください。':'同期できませんでした。通信と接続設定を確認してください。');error.status=response.status;throw error;}
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
    function rowQuery(table,row,owner){const query=new URLSearchParams({select:'*',user_id:'eq.'+owner});for(const key of TABLE_KEYS[table])query.set(key,'eq.'+quoted(row[key]));return query;}
    async function sendPending(owner,epoch){
      // A snapshot prevents a continuously edited note from blocking all reads.
      for(const entry of storage.pending()){
        assertOwner(owner,epoch);
        if(!TABLE_KEYS[entry.table]||entry.row.user_id!==owner)throw new Error('送信データの利用者が一致しません。');
        const row={...entry.row};delete row.server_updated_at;
        const query=new URLSearchParams({on_conflict:['user_id',...TABLE_KEYS[entry.table]].join(',')});
        let accepted=await request('/rest/v1/'+entry.table+'?'+query,{method:'POST',body:row,headers:{Prefer:'resolution='+(APPEND.has(entry.table)?'ignore-duplicates':'merge-duplicates')+',return=representation'}},owner,epoch);
        if(!Array.isArray(accepted))throw new Error('同期の応答を確認できませんでした。');
        if(!accepted.length)accepted=await request('/rest/v1/'+entry.table+'?'+rowQuery(entry.table,row,owner),{},owner,epoch);
        if(!accepted.length)throw new Error('送信したデータを確認できませんでした。');
        assertOwner(owner,epoch);storage.acknowledge(entry.table,entry.key,entry.revision);storage.merge(entry.table,accepted);
      }
    }
    function continuation(table,last){
      const columns=['server_updated_at',...TABLE_KEYS[table]];
      return '('+columns.map((column,index)=>{
        const equal=columns.slice(0,index).map(c=>c+'.eq.'+quoted(last[c]));
        const greater=column+'.gt.'+quoted(last[column]);return equal.length?'and('+[...equal,greater].join(',')+')':greater;
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
      if(!online()){state.status=storage.pending().length?'pending':'failed';state.error='通信が戻ると同期を再開します。';emit();return getState();}
      state.status='syncing';state.error=null;emit();
      try{
        await sendPending(owner,epoch);
        for(const table of Object.keys(TABLE_KEYS))await pullTable(table,full,owner,epoch);
        assertOwner(owner,epoch);state.lastSyncedAt=new Date(now()).toISOString();storage.setItem?.(LAST_KEY,state.lastSyncedAt);
        state.status=storage.pending().length?'pending':'synced';emit();
      }catch(error){if(!error.stale&&current()===owner&&generation===epoch){state.status='failed';state.error=error.message&&error.status?error.message:'同期に失敗しました。未送信データは端末に残っています。';emit();}}
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
        storage.subscribe?.(()=>{
          const signature=JSON.stringify(storage.pending().map(entry=>[entry.table,entry.key,entry.revision]));
          const changed=signature!==pendingSignature;pendingSignature=signature;
          if(changed&&storage.pending().length)schedule();else emit();
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
        state.status='failed';state.error='ログインできませんでした。認証情報と端末の保存領域を確認してください。';emit();throw new Error(state.error);
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
    function download(data,name){
      if(options.download)return options.download(data,name);
      if(!options.document)return;
      const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=options.document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
    async function performImport(){
      if(!current())throw new Error('ログインしてください。');const owner=current(),epoch=generation,preview=storage.migrationPreview();
      if(!preview.available)return {targetCounts:preview.counts,imported:false};
      const backup=storage.exportData('guest');download(backup,'english-notes-before-import.json');
      const result=storage.importGuest();emit();await sync();assertOwner(owner,epoch);
      if(state.status==='failed'||state.pendingCount)throw new Error('取り込みデータの同期が完了していません。再同期してください。');
      const counts={};
      for(const [table,rows]of Object.entries(result.targetRows||{})){
        counts[table]=0;for(const row of rows){const found=await request('/rest/v1/'+table+'?'+rowQuery(table,row,owner),{},owner,epoch);if(found.length)counts[table]++;}
        if(counts[table]!==rows.length)throw new Error('取り込み件数が一致しません。再同期してください。');
      }
      storage.markGuestImported(result.snapshotId,owner);state.migrationResult={success:true,verified:true,targetCounts:counts,imported:true};emit();return state.migrationResult;
    }
    async function importGuest(){
      const owner=current(),epoch=generation;
      try{return await performImport();}
      catch(error){if(owner===current()&&epoch===generation){state.status='failed';state.error=error.message;state.migrationResult=null;emit();}throw error;}
    }
    return {init,login,logout,sync,resync:()=>sync({full:true}),getState,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},importGuest,exportData:()=>storage.exportData()};
  }
  return {createSyncClient};
});
