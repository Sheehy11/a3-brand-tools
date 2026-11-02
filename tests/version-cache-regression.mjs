import fs from 'node:fs';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const version=JSON.parse(fs.readFileSync(new URL('../version.json',import.meta.url),'utf8'));
const buildMeta=html.match(/<meta name="a3-build" content="([^"]+)">/)?.[1];
const buildCode=html.match(/const BUILD='([^']+)',VERSION_PARAM/)?.[1];

if(!version.build)throw new Error('version.json 缺少构建号');
if(buildMeta!==version.build||buildCode!==version.build)throw new Error('HTML 与 version.json 构建号不一致');
if(html.indexOf('name="a3-build"')>html.indexOf('xlsx.full.min.js'))throw new Error('版本核对脚本没有在大型依赖前执行');
if(!html.includes("fetch(versionUrl,{cache:'no-store'})"))throw new Error('版本清单仍可能命中浏览器缓存');
if(!html.includes("versionUrl.searchParams.set('_',Date.now().toString(36))"))throw new Error('版本清单请求缺少唯一参数');
if(!html.includes("target.searchParams.set(VERSION_PARAM,latest)"))throw new Error('发现新版本后没有请求唯一 HTML 地址');
if(!html.includes("history.replaceState(null,'',current.pathname"))throw new Error('临时版本参数不会自动从地址栏清除');
if(!html.includes("[VERSION_PARAM,'v'].forEach"))throw new Error('旧 v 参数没有自动清除');
if(!html.includes("buildId:window.A3_BUILD_ID||''"))throw new Error('工作台状态没有记录构建号');
if(!html.includes("if(saved.buildId!==(window.A3_BUILD_ID||''))"))throw new Error('加载状态时没有识别旧版本数据');
for(const key of ['latest','latestBatch','generationRequirement','reviewReport','reviewIssues','reviewRewrite']){
  if(!html.includes(`'${key}'`))throw new Error(`旧版本临时字段 ${key} 没有失效规则`);
}
if(!html.includes("HF.generatedDrafts=Array.isArray(HF.generatedDrafts)"))throw new Error('跨版本历史稿件没有保留');

console.log('version cache regression: PASS');
