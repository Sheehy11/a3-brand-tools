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
if(html.includes('批量稿未通过交付验收，已停止展示')||html.includes('生成稿未通过交付验收，已停止展示'))throw new Error('内部验收仍会丢弃已经生成的真实稿件');
if(!html.includes('hfCompleteGenerationAudit(copy,cfg,ref)'))throw new Error('批量稿没有接入完整内容方向与确定性验收');
if(!html.includes('try{directionIssues=await hfSelectedDirectionAudit(copy,cfg);}catch{}'))throw new Error('语义验收服务异常仍会阻断真实稿件交付');
if(html.includes('与既有边界冲突或仍需人工复核'))throw new Error('普通验收问题仍使用含混的人工复核提示');
if(!html.includes('Promise.allSettled(indices.map(i=>generateOne(i,retry)))'))throw new Error('多篇稿件未并行独立生成');
if(!html.includes('正在自动补齐未完成的 ${pending.length} 篇'))throw new Error('批量生成没有自动补齐失败单篇');
if(!html.includes('retry<=3'))throw new Error('失败单篇没有进行足够的自动重试');
if(!html.includes('正在为剩余 ${pending.length} 篇启用精简恢复通道'))throw new Error('并行重试后仍缺稿时没有最终恢复通道');
if(!html.includes('Promise.allSettled(pending.map(i=>hfCallText'))throw new Error('最终恢复通道未并行补齐所有缺失稿件');
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
const implicitComments=commentContext.hfCommentLines('标题：测试\n\n正文第一段。\n正文第二段。\n\n#好奇 #好奇小森林 #纸尿裤\n\n我家也是用完才发现已经习惯这款了\n换其他款总要适应几天还是熟悉的省心\n每天换尿裤顺手就拿它已经不用多想了');
if(implicitComments.length!==3)throw new Error('Tag 后三条无标题、无编号的自然评论仍被误判为缺失');

const bodyCode=source('function hqExtractBody','function hqNormalize');
const bodyContext={};
vm.createContext(bodyContext);vm.runInContext(bodyCode,bodyContext);
const bodyOnly=bodyContext.hqExtractBody('标题：测试\n\n正文第一段。\n正文第二段。\n\n#好奇 #好奇小森林 #纸尿裤\n\n这是一条无编号评论\n这是第二条无编号评论\n这是第三条无编号评论');
if(bodyOnly!=='正文第一段。正文第二段。')throw new Error('正文统计仍错误包含 Tag 后的无编号评论');

const conflictCode=source('function hfIssueMayConflictHuman','function hfRenderBatch');
const conflictContext={};
vm.createContext(conflictContext);vm.runInContext(conflictCode,conflictContext);
if(conflictContext.hfIssueMayConflictHuman('评论必须正好三条','必须带Tag #好奇新品'))throw new Error('无关评论错误被人工Tag要求错误放行');
if(!conflictContext.hfIssueMayConflictHuman('缺少Tag：#好奇新品','必须带Tag #好奇新品'))throw new Error('可追溯人工Tag冲突未被识别');

if(!html.includes("HF.customDirection&&requirementText?finalIssues.filter"))throw new Error('单篇人工复核提醒没有限定为当前新增需求模式');
if(!html.includes("HF.customDirection&&requirementText?rows.filter"))throw new Error('批量人工复核提醒没有限定为当前新增需求模式');
if(!html.includes('未落实所选消费者阶段')||!html.includes('未落实所选核心召回任务')||!html.includes('未落实所选内容切角'))throw new Error('好奇生成后未逐项验收消费者阶段、核心召回任务和内容切角');
if(!html.includes('hfDeterministicReviewLedger'))throw new Error('AI审核缺少模型格式异常时的本地知识库兜底');
if(!html.includes("if(!has){\n      try{const issues=await hfDeterministicReviewLedger"))throw new Error('AI审核外层异常仍会丢失真实本地审查结果');
if(!html.includes('for(let attempt=0;attempt<2&&!feedbackRewrite;attempt++)'))throw new Error('人工反馈修改缺少完整稿件恢复重试');
if(html.includes('未生成可验收的修改稿'))throw new Error('人工反馈修改仍会用空结果覆盖真实原稿');

console.log('batch generation regression: PASS');
