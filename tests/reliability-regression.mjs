import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
function source(from,to){const start=html.indexOf(from),end=html.indexOf(to,start);if(start<0||end<0)throw new Error(`未找到函数片段：${from}`);return html.slice(start,end)}
function expect(condition,message){if(!condition)throw new Error(message)}

const code=source('async function openAIOnce','async function responseError');
const replies=[
  new Response(JSON.stringify({error:'temporary'}),{status:502}),
  new Response(JSON.stringify({choices:[{message:{content:''}}]}),{status:200,headers:{'Content-Type':'application/json'}}),
  new Response(JSON.stringify({choices:[{message:{content:'有效正文'}}]}),{status:200,headers:{'Content-Type':'application/json'}})
];
let calls=0,received='';
const context={
  fetch:async()=>{calls++;return replies.shift()},
  openAIPacketText:packet=>String(packet?.choices?.[0]?.message?.content||''),
  responseError:async response=>new Error(`HTTP ${response.status}`),
  setTimeout:fn=>{fn();return 1},clearTimeout(){},Promise,JSON,Error
};
vm.createContext(context);vm.runInContext(code,context);
await context.openAIOnce('https://example.test',{}, {},text=>{received=text},null,'测试服务',true);
expect(calls===3,'一次点击没有自动跨过临时错误与空响应');
expect(received==='有效正文','重试后没有返回真实正文');

expect(html.includes("const reliableOptions={stream:false,reasoningEffort:'minimal',...options}"),'所有文本工作流没有统一使用完整低延迟响应');
expect(html.includes('async function hfCallJson'),'结构化审核结果没有格式错误自动恢复');
expect((html.match(/await hfCallJson/g)||[]).length>=3,'审核、反馈修改与改稿验收没有统一使用可靠 JSON 调用');
expect(html.includes("buttons.forEach(x=>x.disabled=true)"),'重写过程中没有阻止重复提交');
expect(html.includes("finally{buttons.forEach(x=>x.disabled=false);}"),'重写失败后按钮没有恢复');
expect(html.includes("out.textContent='正在审核…'"),'审核开始时没有清理旧结果');
expect(html.includes('客户反馈高于产品事实、合规边界、参考稿和历史设置'),'审核流程丢失人工需求最高优先级');

console.log('reliability regression: PASS');
