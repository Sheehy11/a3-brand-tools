import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const worker=fs.readFileSync(new URL('../worker/src/index.js',import.meta.url),'utf8');
const schema=fs.readFileSync(new URL('../worker/schema.sql',import.meta.url),'utf8');

function expect(condition,message){if(!condition)throw new Error(message)}

for(const [index,match] of [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].entries()){
  if(match[1].trim())new vm.Script(match[1],{filename:`inline-${index}.js`});
}

expect(html.includes('本次需求与个人写作偏好'),'需求与偏好面板缺失');
for(const name of ['思雨','阳阳','APRIL','一西'])expect(html.includes(name),`身份缺失：${name}`);
expect(html.includes("首次进入必须先选择使用人"),'身份选择仍可被跳过');
expect(html.includes('【本次人工需求｜最终执行优先级】'),'人工需求最高优先级提示缺失');
expect(html.includes('高于既有产品事实、合规规则、篇幅、标题、段落、语气、结构'),'人工需求覆盖范围不完整');
expect(html.includes("collabApi('/requirements/workspace'"),'跨设备工作区同步缺失');
expect(html.includes('取消生成'),'取消生成入口缺失');
expect(html.includes('max_tokens:options.maxTokens||4096'),'前端未传递输出长度');
expect(worker.includes('stream:attempt===0'),'Worker 未开启首次流式传输与兼容重试');
expect(worker.includes('retryable.has(upstream.status)'),'Worker 缺少上游瞬时错误重试');
expect(worker.includes('520,521,522,523,524'),'Worker 未覆盖 A3 的临时渠道错误');
expect(worker.includes("reasoning_effort:reasoningEffort"),'Worker 未启用低耗时审核推理配置');
expect(!worker.includes('upstream.arrayBuffer()'),'Worker 仍在完整缓存模型响应');
expect(worker.includes("path[0]==='requirements'"),'共享需求接口缺失');
expect(schema.includes('collab_requirement_workspaces')&&schema.includes('collab_requirements'),'共享需求表缺失');

console.log('preview regression: PASS');
