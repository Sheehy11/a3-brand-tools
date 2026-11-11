function decodeHtml(value=''){
  return String(value).replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
}
function cleanText(value=''){
  return decodeHtml(String(value)).replace(/\\n/g,'\n').replace(/\\u([0-9a-f]{4})/gi,(_,h)=>String.fromCharCode(parseInt(h,16))).trim();
}
function findNote(value,depth=0){
  if(!value||depth>12)return null;
  if(Array.isArray(value)){for(const row of value){const hit=findNote(row,depth+1);if(hit)return hit;}return null;}
  if(typeof value!=='object')return null;
  const title=value.title||value.noteTitle||value.displayTitle,content=value.desc||value.content||value.noteDesc;
  if(typeof content==='string'&&cleanText(content).replace(/\s/g,'').length>=12)return{title:cleanText(title||''),content:cleanText(content)};
  for(const row of Object.values(value)){const hit=findNote(row,depth+1);if(hit)return hit;}
  return null;
}
function parsePage(html,finalUrl,liveNote){
  if(liveNote?.content&&cleanText(liveNote.content).replace(/\s/g,'').length>=12)return{title:cleanText(liveNote.title||''),content:cleanText(liveNote.content),url:finalUrl,finalUrl};
  const state=html.match(/window\.__INITIAL_STATE__\s*=\s*([\s\S]*?)<\/script>/i)?.[1]?.replace(/;\s*$/,'').replace(/:\s*undefined\b/g,':null').replace(/\bundefined\b/g,'null');
  if(state){try{const hit=findNote(JSON.parse(state));if(hit)return{...hit,url:finalUrl,finalUrl};}catch{}}
  const title=cleanText(html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([\s\S]*?)["']/i)?.[1]||html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]||'');
  const content=cleanText(html.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([\s\S]*?)["']/i)?.[1]||'');
  if(content.replace(/\s/g,'').length>=12)return{title,content,url:finalUrl,finalUrl};
  throw new Error(/登录|login|验证|captcha/i.test(html)?'小红书要求登录或安全验证，请先在 Edge 或 Chrome 打开原链接确认可见':'页面已返回，但没有找到笔记正文');
}
function collectNotes(value,rows=[],depth=0){
  if(!value||depth>14||rows.length>=40)return rows;
  if(Array.isArray(value)){value.forEach(x=>collectNotes(x,rows,depth+1));return rows;}
  if(typeof value!=='object')return rows;
  const card=value.noteCard||value.note;
  if(card&&typeof card==='object'){
    const rawId=card.noteId||card.id||value.noteId||value.id,title=card.displayTitle||card.title,content=card.desc||card.content,xsecToken=value.xsecToken||value.xsec_token||card.xsecToken||card.xsec_token;
    if(rawId&&(title||content)){const id=String(rawId),cleanTitle=cleanText(title||''),cleanContent=cleanText(content||''),token=xsecToken?String(xsecToken):'',url=`https://www.xiaohongshu.com/explore/${id}${token?`?xsec_token=${encodeURIComponent(token)}&xsec_source=pc_search`:''}`;if(cleanTitle||cleanContent)rows.push({id,title:cleanTitle,content:cleanContent,url,time:card.time||card.updateTime||value.time||value.updateTime||''});}
  }
  Object.values(value).forEach(x=>collectNotes(x,rows,depth+1));return rows;
}
function parseSearchPage(html){
  const state=html.match(/window\.__INITIAL_STATE__\s*=\s*([\s\S]*?)<\/script>/i)?.[1]?.replace(/;\s*$/,'').replace(/:\s*undefined\b/g,':null').replace(/\bundefined\b/g,'null');
  if(!state)throw new Error('搜索页没有返回可读取内容');let parsed;try{parsed=JSON.parse(state);}catch{throw new Error('搜索页内容暂时无法解析');}
  const seen=new Set;return collectNotes(parsed).filter(x=>x.id&&!seen.has(x.id)&&seen.add(x.id)).slice(0,20);
}
function delay(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
function matchesSearchIntent(item,keyword){const query=cleanText(keyword).toLowerCase(),text=cleanText(`${item?.title||''}\n${item?.content||''}`).toLowerCase();if(/好奇|huggies/i.test(query)&&!/(?:好奇|huggies|小森林|深睡大师|金装|铂金装|皇家御裤|心钻装)/i.test(text))return false;const topicTerms=[];if(/双十(?:一|1)|双11/i.test(query))topicTerms.push(/双十(?:一|1)|双11|11\.11/i);if(/优惠|券|促销|满减|直降|活动|机制/i.test(query))topicTerms.push(/优惠|券|促销|满减|直降|活动|机制|赠品|送|到手价|价保|凑单/i);return topicTerms.every(pattern=>pattern.test(text));}
async function mapLimit(rows,limit,worker){const output=new Array(rows.length),cursor={value:0};await Promise.all(Array.from({length:Math.min(limit,rows.length)},async()=>{while(cursor.value<rows.length){const index=cursor.value++;output[index]=await worker(rows[index],index);}}));return output;}
async function readPageInBackgroundTab(url){
  const tab=await chrome.tabs.create({url,active:false});
  if(!tab?.id)throw new Error('无法打开备用读取页');
  try{
    if(tab.status!=='complete')await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{chrome.tabs.onUpdated.removeListener(listener);reject(new Error('备用读取页加载超时'));},30000);
      const listener=(tabId,changeInfo)=>{if(tabId!==tab.id||changeInfo.status!=='complete')return;clearTimeout(timer);chrome.tabs.onUpdated.removeListener(listener);resolve();};
      chrome.tabs.onUpdated.addListener(listener);
    });
    let page=null;
    for(let attempt=0;attempt<8;attempt++){
      await delay(attempt?800:1200);
      const result=await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>{
        const tidy=value=>String(value||'').replace(/\s+/g,' ').trim(),candidates=[
          document.querySelector('#detail-desc')?.textContent,
          document.querySelector('.note-content')?.textContent,
          document.querySelector('[class*="note-content"]')?.textContent,
          document.querySelector('[class*="noteContent"]')?.textContent,
          document.querySelector('.desc')?.textContent,
          document.querySelector('[class*="desc"]')?.textContent,
          document.querySelector('meta[property="og:description"]')?.content,
          document.querySelector('meta[name="description"]')?.content
        ].map(tidy).filter(text=>text.length>=12),title=tidy(document.querySelector('#detail-title')?.textContent||document.querySelector('[class*="title"]')?.textContent||document.querySelector('meta[property="og:title"]')?.content||document.title);
        return{html:document.documentElement?.outerHTML||'',finalUrl:location.href,note:candidates.length?{title,content:candidates.sort((a,b)=>b.length-a.length)[0]}:null};
      }});
      page=result?.[0]?.result;
      if(page?.note?.content)break;
    }
    if(!page?.html)throw new Error('备用读取页没有返回内容');
    return page;
  }finally{try{await chrome.tabs.remove(tab.id);}catch{}}
}
async function readSearchCards(url,limit=12){
  const tab=await chrome.tabs.create({url,active:false});
  if(!tab?.id)throw new Error('无法打开小红书搜索页');
  try{
    if(tab.status!=='complete')await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{chrome.tabs.onUpdated.removeListener(listener);reject(new Error('小红书搜索页加载超时'));},30000);
      const listener=(tabId,changeInfo)=>{if(tabId!==tab.id||changeInfo.status!=='complete')return;clearTimeout(timer);chrome.tabs.onUpdated.removeListener(listener);resolve();};
      chrome.tabs.onUpdated.addListener(listener);
    });
    const merged=new Map();
    for(let attempt=0;attempt<10&&merged.size<limit;attempt++){
      await delay(attempt?700:1600);
      const result=await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>{
        const tidy=value=>String(value||'').replace(/\s+/g,' ').trim(),rows=[];
        for(const link of document.querySelectorAll('a[href*="/explore/"],a[href*="/search_result/"]')){
          const href=link.href||'',match=href.match(/\/(?:explore|search_result)\/([a-zA-Z0-9]+)/);if(!match)continue;
          const root=link.closest('section')||link.closest('[class*="note-item"]')||link.closest('[class*="feed-card"]')||link.parentElement?.parentElement?.parentElement||link;
          const titleNode=root.querySelector?.('[class*="title"],.title,[data-v-a264b01a]')||null,img=root.querySelector?.('img')||link.querySelector?.('img'),lines=tidy(root.innerText).split(/\n+/).map(tidy).filter(Boolean),fallback=lines.find(text=>text.length>=2&&text.length<=100&&!/^(?:赞|收藏|评论|分享|关注|\d+(?:\.\d+)?[万w]?)$/.test(text)),title=tidy(titleNode?.textContent||img?.alt||link.title||fallback||'');
          rows.push({id:match[1],title,url:href});
        }
        window.scrollBy(0,Math.max(700,window.innerHeight*.8));
        const score=row=>(/xsec_token=/.test(row.url)?20:0)+(/\/search_result\//.test(row.url)?10:0)+(row.title?2:0);
        return rows.sort((a,b)=>score(b)-score(a));
      }});
      for(const row of result?.[0]?.result||[]){if(!row.id)continue;const prior=merged.get(row.id),score=item=>(/xsec_token=/.test(item?.url||'')?20:0)+(/\/search_result\//.test(item?.url||'')?10:0)+(item?.title?2:0);if(!prior||score(row)>score(prior))merged.set(row.id,row);}
    }
    const cards=[...merged.values()].slice(0,limit);
    if(!cards.length)throw new Error('搜索页已打开，但未发现真实笔记链接；请确认页面没有出现验证提示');
    return cards;
  }finally{try{await chrome.tabs.remove(tab.id);}catch{}}
}
async function readXhsPage(url,parser){
  try{
    const response=await fetch(url,{credentials:'include',redirect:'follow'});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const html=await response.text();
    return parser(html,response.url);
  }catch(directError){
    console.warn('A3 direct XHS read failed, using background tab',directError);
    try{const page=await readPageInBackgroundTab(url);return parser(page.html,page.finalUrl,page.note);}catch(tabError){console.warn('A3 background-tab XHS read failed',tabError);throw new Error('小红书读取失败，请确认已在当前浏览器登录后重试');}
  }
}
chrome.runtime.onMessage.addListener((message,_sender,sendResponse)=>{
  if(!['A3_XHS_FETCH','A3_XHS_SEARCH'].includes(message?.type))return;
  (async()=>{try{const search=message.type==='A3_XHS_SEARCH',url=search?`https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(message.keyword||'')}&source=web_search_result_notes`:message.url;if(search){const limit=Math.max(1,Math.min(12,Number(message.limit)||8)),cards=await readSearchCards(url,limit),items=await mapLimit(cards,3,async card=>{try{const note=await readXhsPage(card.url,(html,finalUrl,liveNote)=>parsePage(html,finalUrl,liveNote));return{...card,title:note.title||card.title,content:note.content||'',url:note.finalUrl||card.url,readOk:Boolean(note.content)};}catch(error){return{...card,content:'',readOk:false,readError:error?.message||'未读取到正文'};}}),withBody=items.filter(item=>item.readOk&&cleanText(item.content).replace(/\s/g,'').length>=12),usable=withBody.filter(item=>matchesSearchIntent(item,message.keyword||''));if(!withBody.length)throw new Error(`已打开 ${cards.length} 条真实笔记，但正文读取失败；小红书页面可能出现验证提示`);if(!usable.length)throw new Error(`已读取 ${withBody.length} 条正文，但均与关键词“${message.keyword||''}”不够相关，已全部剔除`);sendResponse({ok:true,items:usable});}else sendResponse({ok:true,note:await readXhsPage(url,(html,finalUrl,liveNote)=>parsePage(html,finalUrl,liveNote))});}catch(error){sendResponse({ok:false,code:'READ_FAILED',message:error?.message||'小红书读取失败，请确认已登录后重试'});}})();
  return true;
});
