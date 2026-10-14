import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const match=html.match(/<script>\s*(window\.a3IsLocalPreview=[\s\S]*?)<\/script>/);
if(!match)throw new Error('未找到登录脚本');

function storage(seed={}){
  const values=new Map(Object.entries(seed));
  return{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key),value:key=>values.get(key)};
}
function token(exp){
  const payload=Buffer.from(JSON.stringify({exp,nonce:'test'})).toString('base64url');
  return`${payload}.test-signature`;
}
function run({local={},session={}}={}){
  const gate={style:{display:'flex'}},localStorage=storage(local),sessionStorage=storage(session);
  const context={window:{},location:{protocol:'https:',hostname:'sheehy11.github.io'},localStorage,sessionStorage,document:{getElementById:id=>id==='pw-gate'?gate:{style:{},focus(){}},querySelector:()=>({content:'https://a3-brand-tools.pages.dev'})},TextDecoder,Uint8Array,atob:value=>Buffer.from(value,'base64').toString('binary'),crypto:globalThis.crypto,fetch:()=>{throw new Error('unexpected fetch')},setTimeout};
  context.window=context;vm.runInNewContext(match[1],context);
  return{context,gate,localStorage,sessionStorage};
}

const valid=token(Date.now()+60_000),legacy=run({session:{a3_session:valid}});
if(legacy.gate.style.display!=='none')throw new Error('有效旧会话没有自动解锁');
if(legacy.localStorage.value('a3_session')!==valid)throw new Error('旧会话没有迁移到本机持久存储');

const expired=run({local:{a3_session:token(Date.now()-1),a3_unlocked:'1'}});
if(expired.gate.style.display==='none')throw new Error('过期会话仍然解锁');
if(expired.localStorage.value('a3_session'))throw new Error('过期会话没有清理');

console.log('session regression: PASS');
