import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
function source(from,to){
  const start=html.indexOf(from),end=html.indexOf(to,start);
  if(start<0||end<0)throw new Error(`未找到函数片段：${from}`);
  return html.slice(start,end);
}

if(!html.includes('id="hf-generate-count"'))throw new Error('生成页缺少1—5篇数量选择');
for(let i=1;i<=5;i++)if(!html.includes(`<option value="${i}">${i}篇</option>`))throw new Error(`缺少${i}篇选项`);
if(!html.includes('onclick="hfGenerateBatch()"'))throw new Error('生成按钮未接入批量流程');
if(!html.includes('生成阶段人工输入｜所有后续环节继续最高优先'))throw new Error('审核未继承生成阶段人工输入');
if(!html.includes('人工输入｜本环节最高优先'))throw new Error('重写未继承人工输入最高优先级');
if(!html.includes('HF.generationController=null'))throw new Error('页面加载未清理失效的生成控制器');
if(!html.includes('const{generationController,customDirection,...persisted}=HF'))throw new Error('生成控制器或临时新增方向状态仍会被写入本地状态');
if(!html.includes('自动修正后仍有 ${strictFailures.flat().length+difference.flat().length} 项需进入审核重写'))throw new Error('自动修正后仍有问题时整批稿件未被保留供审核重写');
if(!html.includes('Promise.allSettled(indices.map(i=>generateOne(i,retry)))'))throw new Error('多篇稿件未并行独立生成');
if(!html.includes('正在仅重试未完成的 ${pending.length} 篇'))throw new Error('批量生成没有只重试失败单篇');
if(!html.includes('只输出这一篇完整稿件，不要JSON'))throw new Error('单篇请求仍可能被批量JSON截断');
if(html.includes('内容服务未完整返回 ${count} 篇稿件'))throw new Error('仍保留单个JSON缺项即整批失败的旧逻辑');
if(html.includes('drafts必须正好${count}项'))throw new Error('批量生成仍依赖模型一次返回固定数组项数');

const tagCode=source('function hfTagAudit','function hfStyleAudit');
const tagContext={HQ_CONTENT_MODE:'ao'};
vm.createContext(tagContext);vm.runInContext(tagCode,tagContext);
const xCopy='正文\n#好奇 #好奇X系列 #纸尿裤';
if(tagContext.hfTagAudit(xCopy,'X系列').length)throw new Error('X系列正确Tag仍被误判');
if(!tagContext.hfTagAudit(xCopy,'X系列').every(x=>!x.includes('小森林')))throw new Error('X系列仍被错误要求小森林Tag');
const forestCopy='正文\n#好奇 #好奇小森林 #纸尿裤';
if(tagContext.hfTagAudit(forestCopy,'小森林纸尿裤').length)throw new Error('小森林纸尿裤正确Tag被误判');

const diffCode=source('function hfBatchDifferenceIssues','function hfRenderBatch');
const diffContext={
  hqHistoryTitle:x=>x.split('|')[0],
  hqHistoryBody:x=>x.split('|')[1],
  hfGramScore:(a,b)=>a===b?1:0,
  hfHasSharedRun:(a,b)=>a===b
};
vm.createContext(diffContext);vm.runInContext(diffCode,diffContext);
const duplicate=diffContext.hfBatchDifferenceIssues(['同题|同正文','同题|同正文']);
if(duplicate[1].length!==2)throw new Error('同批重复标题与正文未被同时拦截');
const distinct=diffContext.hfBatchDifferenceIssues(['标题甲|正文甲','标题乙|正文乙']);
if(distinct.some(x=>x.length))throw new Error('明显不同稿件被误判为重复');

const commentCode=source('function hfCommentLines','function hfDraftTags');
const commentContext={};
vm.createContext(commentContext);vm.runInContext(commentCode,commentContext);
const comments=commentContext.hfCommentLines('标题：测试\n\n正文。\n\n留言：\n第一条自然留言内容\n第二条自然留言内容\n第三条自然留言内容');
if(comments.length!==3)throw new Error('“留言”区块未被识别为三条评论');

const conflictCode=source('function hfIssueMayConflictHuman','function hfRenderBatch');
const conflictContext={};
vm.createContext(conflictContext);vm.runInContext(conflictCode,conflictContext);
if(conflictContext.hfIssueMayConflictHuman('评论必须正好三条','必须带Tag #好奇新品'))throw new Error('无关评论错误被人工Tag要求错误放行');
if(!conflictContext.hfIssueMayConflictHuman('缺少Tag：#好奇新品','必须带Tag #好奇新品'))throw new Error('可追溯人工Tag冲突未被识别');

console.log('batch generation regression: PASS');
