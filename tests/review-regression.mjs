import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
if(!html.includes('id="hf-rewrite-local-feedback"'))throw new Error('局部重写缺少独立意见框');
if(!html.includes('id="hf-rewrite-full-feedback"'))throw new Error('全文重写缺少独立意见框');
if(html.includes('id="hf-rewrite-feedback"'))throw new Error('审核页仍保留冗余的共用意见框');
if(!html.includes("hfVal(mode==='local'?'hf-rewrite-local-feedback':'hf-rewrite-full-feedback')"))throw new Error('两个重写入口没有读取各自意见');
if(!html.includes("if(mode==='local'&&!writerFeedback){toast('请在局部重写框中填写问题句或位置，并说明希望怎么改')"))throw new Error('局部重写仍要求精确粘贴原句或缺少修改方法提示');
if(!html.includes('hfLogWriterFeedback(writerFeedback,mode)'))throw new Error('重写意见没有进入一周留痕');
if(!html.includes('const specialRequirementOnly=hfIsSpecialRequirementDraft(draft)'))throw new Error('审核未识别特殊需求生成稿');
if(!html.includes('if(specialRequirementOnly)issues=await hfDeterministicReviewLedger(draft,product,standingHuman,true)'))throw new Error('特殊需求稿仍可能执行字数或格式审核');
if(!html.includes('function hfSellingPointReviewFindings'))throw new Error('特殊需求稿缺少仅审核卖点的规则');
if(!html.includes('backgroundContext=hfMaterialContext()'))throw new Error('审核或重写没有继承背景资料');
if(!html.includes('不能把品牌活动缩窄成所选品线活动'))throw new Error('全文重写缺少活动主体保护');
function source(from,to){const start=html.indexOf(from),end=html.indexOf(to,start);if(start<0||end<0)throw new Error(`未找到函数片段：${from}`);return html.slice(start,end)}
const code=source('function hfNormalizeIssueLedger','function hfRenderIssueLedger')+source('async function hfFeedbackAuditAndPatch','async function hfReview');
const modelResult={
  issues:[{id:'F1',scope:'body',sourceQuote:'X系列能吸，越吸越快。',problem:'没有按人工要求改为清爽',basis:'人工原话优先；与旧事实冲突需人工复核',requiredChange:'改为清爽'}],
  patches:[{issueIds:['F1'],target:'X系列能吸，越吸越快。',replacement:'X系列清爽。'}]
};
const context={hfCallJson:async()=>modelResult};
vm.createContext(context);vm.runInContext(code,context);
const original='标题：出门前换一片\n\n孩子跑了一下午。X系列能吸，越吸越快。回家路上没有临时停下来。\n\n#好奇';
const result=await context.hfFeedbackAuditAndPatch('system',original,'改成清爽','只保留一个卖点','无历史风险');
const expected=original.replace('X系列能吸，越吸越快。','X系列清爽。');
if(result.rewrite!==expected)throw new Error('定点修改改变了人工反馈以外的内容');
if(result.issues.length!==1||result.issues[0].id!=='F1')throw new Error('人工反馈问题清单不正确');

context.hfCallJson=async()=>({...modelResult,patches:[{issueIds:['F1'],target:'不存在的原文',replacement:'X系列清爽。'}]});
let rejected=false;try{await context.hfFeedbackAuditAndPatch('system',original,'改成清爽','','')}catch{rejected=true}
if(!rejected)throw new Error('网页接受了无法在原稿中精确定位的修改');

console.log('review regression: PASS');
