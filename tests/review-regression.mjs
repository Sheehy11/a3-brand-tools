import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
function source(from,to){const start=html.indexOf(from),end=html.indexOf(to,start);if(start<0||end<0)throw new Error(`未找到函数片段：${from}`);return html.slice(start,end)}
const code=source('function hfNormalizeIssueLedger','function hfRenderIssueLedger')+source('async function hfFeedbackAuditAndPatch','async function hfReview');
const modelResult={
  issues:[{id:'F1',scope:'body',sourceQuote:'X系列能吸，越吸越快。',problem:'没有按人工要求改为清爽',basis:'人工原话优先；与旧事实冲突需人工复核',requiredChange:'改为清爽'}],
  patches:[{issueIds:['F1'],target:'X系列能吸，越吸越快。',replacement:'X系列清爽。'}]
};
const context={hfCallText:async()=>JSON.stringify(modelResult),hfLiveParseJson:JSON.parse};
vm.createContext(context);vm.runInContext(code,context);
const original='标题：出门前换一片\n\n孩子跑了一下午。X系列能吸，越吸越快。回家路上没有临时停下来。\n\n#好奇';
const result=await context.hfFeedbackAuditAndPatch('system',original,'改成清爽','只保留一个卖点','无历史风险');
const expected=original.replace('X系列能吸，越吸越快。','X系列清爽。');
if(result.rewrite!==expected)throw new Error('定点修改改变了人工反馈以外的内容');
if(result.issues.length!==1||result.issues[0].id!=='F1')throw new Error('人工反馈问题清单不正确');

context.hfCallText=async()=>JSON.stringify({...modelResult,patches:[{issueIds:['F1'],target:'不存在的原文',replacement:'X系列清爽。'}]});
let rejected=false;try{await context.hfFeedbackAuditAndPatch('system',original,'改成清爽','','')}catch{rejected=true}
if(!rejected)throw new Error('网页接受了无法在原稿中精确定位的修改');

console.log('review regression: PASS');
