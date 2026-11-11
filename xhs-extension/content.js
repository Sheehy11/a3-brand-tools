const bridge = document.createElement('script');
bridge.src = chrome.runtime.getURL('page-bridge.js');
(document.head || document.documentElement).appendChild(bridge);
bridge.onload = () => bridge.remove();

window.addEventListener('message', event => {
  if (event.source !== window || !['A3_XHS_FETCH_REQUEST','A3_XHS_SEARCH_REQUEST'].includes(event.data?.type)) return;
  const {id, url, keyword, limit} = event.data,search=event.data.type==='A3_XHS_SEARCH_REQUEST';
  chrome.runtime.sendMessage(search?{type:'A3_XHS_SEARCH',keyword,limit}:{type:'A3_XHS_FETCH',url}, response => {
    const error = chrome.runtime.lastError?.message;
    window.postMessage({type:search?'A3_XHS_SEARCH_RESPONSE':'A3_XHS_FETCH_RESPONSE', id, response:error?{ok:false,message:error}:response}, '*');
  });
});
