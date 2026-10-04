(function(root){
 'use strict';
 function createView(saved,review,statusFor){const scheduled=new Set(review.map(item=>item.id));
  const status=item=>item.id&&scheduled.has(item.id)?'復習予定':statusFor(item);
  const items=filter=>filter==='復習予定'?review:filter==='すべて'?saved:saved.filter(item=>status(item)===filter);
  const sections=()=>['復習予定','学習中','未学習','定着'].map(state=>({state,items:items(state)})).filter(section=>section.items.length);
  return {status,items,count:filter=>items(filter).length,sections};
 }
 const api={createView};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.EnglishVocabulary=api;
})(typeof window!=='undefined'?window:globalThis);
