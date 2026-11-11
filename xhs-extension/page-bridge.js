(() => {
  const pending = new Map();
  window.xhsFetchDirect = url => new Promise((resolve, reject) => {
    const id = `a3-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('扩展读取超时')); }, 30000);
    pending.set(id, {resolve, reject, timer});
    window.postMessage({type:'A3_XHS_FETCH_REQUEST', id, url}, '*');
  });
  window.xhsSearchDirect = (keyword, options={}) => new Promise((resolve, reject) => {
    const id = `a3-search-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('扩展搜索超时')); }, 30000);
    pending.set(id, {resolve, reject, timer, search:true});
    window.postMessage({type:'A3_XHS_SEARCH_REQUEST', id, keyword, limit:options.limit||12}, '*');
  });
  window.addEventListener('message', event => {
    if (event.source !== window || !['A3_XHS_FETCH_RESPONSE','A3_XHS_SEARCH_RESPONSE'].includes(event.data?.type)) return;
    const job = pending.get(event.data.id);if(!job)return;
    clearTimeout(job.timer);pending.delete(event.data.id);
    const response=event.data.response||{};
    if(response.ok)job.resolve(job.search?{ok:true,items:response.items||[]}:response.note);else job.reject(Object.assign(new Error(response.message||'扩展未读取到内容'),{code:response.code||'EXTENSION_ERROR'}));
  });
  window.dispatchEvent(new CustomEvent('a3-xhs-extension-ready'));
})();
