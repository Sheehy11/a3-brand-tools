import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const worker=fs.readFileSync(new URL('../worker/src/index.js',import.meta.url),'utf8');
const schema=fs.readFileSync(new URL('../worker/schema.sql',import.meta.url),'utf8');
const start=html.indexOf('const A3_CLOUD_STATE_DENY');
const end=html.indexOf("const COLLAB_LOCAL_STORAGE",start);
if(start<0||end<0)throw new Error('未找到跨设备历史同步代码');

class Storage {
  constructor(seed={}){this.values=new Map(Object.entries(seed).map(([key,value])=>[key,String(value)]))}
  get length(){return this.values.size}
  key(index){return [...this.values.keys()][index]??null}
  getItem(key){return this.values.get(String(key))??null}
  setItem(key,value){this.values.set(String(key),String(value))}
  removeItem(key){this.values.delete(String(key))}
}

const localStorage=new Storage({a3_collab_actor:'yangyang',local_only_history:'本机旧记录',remote_deleted:'待删除',a3_session:'secret'});
const posts=[];
const context={
  Storage,localStorage,location:{reload(){}},Date,Map,Set,String,Boolean,Array,Promise,
  clearTimeout(){},setTimeout(){return 1},toast(){},
  window:{a3IsLocalPreview:()=>false,addEventListener(){}},
  collabActor:()=>({id:localStorage.getItem('a3_collab_actor')}),
  collabApi:async(path,options={})=>{
    if(path!=='/state')throw new Error('请求了错误的同步接口');
    if((options.method||'GET')==='GET')return{entries:[{key:'remote_history',value:'云端记录',deleted:false},{key:'remote_deleted',value:null,deleted:true}]};
    posts.push(...options.body.changes);return{ok:true};
  }
};
context.window.window=context.window;
vm.createContext(context);
vm.runInContext(html.slice(start,end),context);

const changed=await context.a3CloudStateBootstrap('yangyang');
if(!changed)throw new Error('云端记录变化没有触发页面重载标记');
if(localStorage.getItem('remote_history')!=='云端记录')throw new Error('云端历史没有恢复到新设备');
if(localStorage.getItem('remote_deleted')!==null)throw new Error('云端删除记录没有清理本机旧值');
if(!posts.some(x=>x.key==='local_only_history'&&x.value==='本机旧记录'))throw new Error('首次上线没有迁移本机历史');
if(posts.some(x=>x.key==='a3_session'))throw new Error('会话令牌被错误上传');

localStorage.setItem('new_history','新记录');
await context.a3CloudStateFlush();
if(!posts.some(x=>x.key==='new_history'&&x.value==='新记录'&&!x.deleted))throw new Error('新历史没有进入同步队列');
localStorage.removeItem('new_history');
await context.a3CloudStateFlush();
if(!posts.some(x=>x.key==='new_history'&&x.deleted))throw new Error('删除操作没有同步为云端墓碑');

if(!worker.includes("path[0]==='state'"))throw new Error('Worker 缺少浏览器状态接口');
if(!worker.includes('ON CONFLICT(actor_id,storage_key)'))throw new Error('Worker 缺少状态幂等更新');
if(!schema.includes('collab_browser_state'))throw new Error('D1 缺少浏览器状态表');

console.log('cloud state regression: PASS');
