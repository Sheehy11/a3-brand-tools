import fs from 'node:fs';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const worker=fs.readFileSync(new URL('../worker/src/index.js',import.meta.url),'utf8');
const localProxy=fs.readFileSync(new URL('../a3-local-proxy.mjs',import.meta.url),'utf8');
const wrangler=fs.readFileSync(new URL('../wrangler.toml',import.meta.url),'utf8');
function expect(condition,message){if(!condition)throw new Error(message)}

expect(html.includes("const CONTENT_MODEL={id:'doubao-seed-2-1-turbo-260628',label:'豆包 Seed 2.1 Turbo'}"),'页面没有把豆包设为唯一内容模型');
expect(html.includes("model:'doubao-seed-2-1-turbo-260628'"),'页面默认模型不是豆包');
expect(!html.includes("'gpt-5.6-sol'"),'页面仍保留 GPT 模型调用配置');
expect(html.includes('const text=await callSingleModel(CONTENT_MODEL.id,sys,usr,signal,options)'),'统一 AI 层没有直接调用豆包');
expect(!html.includes('const chosen=await runBattleRound(sys,usr,signal,options)'),'统一 AI 层仍进入双模型 Battle');
expect(!html.includes('id="battle-modal"'),'页面仍显示双模型选择弹窗');
expect(html.includes("el.textContent='豆包 Seed 2.1 Turbo'"),'在线模型状态没有显示豆包');
expect(html.includes('A3 连接与豆包响应正常'),'本地连通性测试仍按双模型提示');
expect(html.includes('maxAttempts=2'),'豆包短暂异常缺少自动重试');
expect(html.includes('nonRetryable=/欠费|余额不足|额度不足|无权限'),'欠费或权限类错误仍会被当作短暂异常重复发送');
expect(html.includes('A3 上游计费账户当前欠费'),'欠费错误仍被误报为模型权限问题');
expect(html.includes('A3 Key 没有调用当前模型的权限'),'真实权限错误缺少独立提示');
expect(html.includes('return Math.max(180000,Number(options.timeoutMs)||0)'),'豆包完整生成等待时间不足三分钟');
expect(html.includes('maxTokens:batchMaxTokens,timeoutMs:180000'),'批量生成没有使用完整等待时间');
expect(html.includes('await ensureLocalProxyReady(signal)'),'请求前没有检查本机转发');
expect(html.includes("reasoning_effort:options.reasoningEffort||'minimal'"),'页面没有使用低延迟推理档位');
expect(!html.includes("thinking:{type:'disabled'}"),'页面仍发送 A3 网关不兼容的 thinking 字段');
expect((html.match(/new Function\('root','callAI'/g)||[]).length===3,'拜耳三个内嵌工作台没有共用统一 AI 层');
expect(html.includes('=>callAI(sys,usr,cb,signal)'),'霞湖工作台没有共用统一 AI 层');

for(const fn of ['doWrite','doReview','hqlApplyFeedback','hfGenerate','hfGenerateBatch','hfReview','hfRewrite','hfApplyHumanFeedback','collabAIRevision']){
  expect(html.includes(`function ${fn}`),`原有流程被删除：${fn}`);
}

expect(worker.includes("new Set(['doubao-seed-2-1-turbo-260628'])"),'Worker 没有把白名单收敛为豆包');
expect(worker.includes("env.A3_MODEL||'doubao-seed-2-1-turbo-260628'"),'Worker 默认模型不是豆包');
expect(worker.includes("models:['doubao-seed-2-1-turbo-260628']"),'Worker 健康检查仍暴露其他模型');
expect(worker.includes('model:requestedModel'),'Worker 没有把豆包模型传给上游');
expect(worker.includes('reasoning_effort:reasoningEffort'),'Worker 没有传递低延迟推理档位');
expect(!worker.includes("thinking:{type:'disabled'}"),'Worker 仍发送 A3 网关不兼容的 thinking 字段');
expect(localProxy.includes("new Set(['doubao-seed-2-1-turbo-260628'])"),'本机转发没有收敛为豆包');
expect(localProxy.includes('delete payload.thinking'),'本机转发没有移除 A3 网关不兼容字段');
expect(localProxy.includes("payload.reasoning_effort='minimal'"),'本机转发没有强制使用低延迟推理档位');
expect(localProxy.includes('X-A3-Upstream-Ms'),'本机转发没有记录上游耗时');
expect(wrangler.includes('A3_MODEL = "doubao-seed-2-1-turbo-260628"'),'部署默认模型不是豆包');
expect(html.includes("A3_LOCAL_PROXY_URL='http://127.0.0.1:8788/v1/chat/completions'"),'页面没有使用本机转发端口');
expect(fs.existsSync(new URL('../启动A3本地验收.command',import.meta.url)),'交付目录缺少本机转发启动入口');
expect(fs.existsSync(new URL('../停止A3本地验收.command',import.meta.url)),'交付目录缺少本机转发停止入口');

console.log('doubao model regression: PASS');
