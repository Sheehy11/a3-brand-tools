import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const expect=(value,message)=>{if(!value)throw new Error(message)};
const source=(from,to)=>{const start=html.indexOf(from),end=html.indexOf(to,start);if(start<0||end<0)throw new Error(`未找到函数片段：${from}`);return html.slice(start,end)};

expect(!html.includes('按当天状态选择更省心'),'仍存在固定短语补字');
expect(!html.includes('function syFitReferenceLine'),'仍存在前端补字/截断函数');
expect(html.includes('结合对应产品重点、参考行的信息任务以及相邻上下文'),'长度问题没有交给豆包结合产品与上下文整句重写');
expect(html.includes("status.textContent=finalIssues.length?'已返回完整稿件，仍有未关闭问题"),'好奇仍可能把未通过误报为通过');
expect(!html.includes('if(humanRequirements||!issues.length&&!closure.unresolved.length)'),'好奇全文重写仍会因存在人工要求而提前结束验收');
const hqReview=source('const HQ_KB_FACT_REVIEW_SYS','function hfMergeReviewIssues');
expect(!hqReview.includes('hfCommentAudit'),'好奇知识库审核仍在审核评论角度');
expect(!hqReview.includes('hfReferenceAudit'),'好奇知识库审核仍在对照参考稿');
expect(!hqReview.includes('hfStyleAudit'),'好奇知识库审核仍在审核风格');
expect(!hqReview.includes('标题不得超过'),'好奇知识库审核仍在执行标题字数限制');
expect(html.includes('果泥、泡芙、纸巾、购物等真实生活动作'),'好奇审核没有明确排除正常生活细节误报');
const hqReviewFlow=source('async function hfReview()','async function hfRewrite(mode)');
expect(!hqReviewFlow.includes("card.classList.add('hf-hidden')"),'好奇零问题审核仍会隐藏重写路径');
expect(hqReviewFlow.includes('未发现明确错误，可继续选择局部或全文重写'),'好奇零问题审核没有继续开放重写路径');
expect(hqReview.includes('娃爸'),'好奇知识库审核没有覆盖未授权额外人物');
expect(hqReview.includes('第([一二三])条')||html.includes("const cn={一:'1',二:'2',三:'3'}"),'好奇评论解析器不支持第一条/第二条/第三条');

const syReview=source('async function syReview()','function syRenderReview');
expect(syReview.includes('syKnowledgeValidationIssues'),'她研社审核没有使用知识库事实校验');
expect(syReview.includes('syKnowledgeReviewPrompt'),'她研社审核仍未收窄到知识库事实');
expect(!syReview.includes('syReviewPrompt()'),'她研社审核仍在对照参考稿');
const syRewrite=source('async function syRewrite(mode)','function syApplyRewrite');
expect(syRewrite.includes('syReviewIssueClosure'),'她研社全文重写没有逐项验收审核问题');
expect(syRewrite.includes('syKnowledgeRepairResult'),'她研社全文重写没有对未关闭问题定向修正');
expect(!syRewrite.includes('syReviewPrompt()'),'她研社审核后重写仍混入参考稿比较');
expect(!syRewrite.includes('syEnsureValidText'),'她研社审核后重写仍会被参考字数校验接管');

const context={
  SHEYAN_FLOWER_SCENES:['封面','A','B','C','D','E','F','G','H'],
  SHEYAN_FALLBACK_FLOWERS:Array.from({length:9},(_,i)=>[`默认主${i}`,`默认辅${i}`]),
  SHEYAN_PRODUCTS:[],SY:{history:[]},
  syParagraphs:text=>String(text||'').split(/\n+/).map(x=>x.trim()).filter(Boolean),
  syShared3:()=>true,syChars:text=>Array.from(String(text||'')).length,
  syFlowerReferenceSpec:()=>({startsWithProduct:false}),
  sySimilarity:()=>0,syReferenceSpec:()=>({paragraphs:1,lengths:[100]}),
  syFlowerTemplateAt:()=>({lineCount:2,lineChars:[30,40]}),
  syFlowerOutputLines:flower=>[flower.main,...String(flower.support||'').split(/\n+/)].filter(Boolean),
  syLengthClose:()=>true,syReferenceCopyIssue:()=>'',
  syNovelText:text=>String(text||'').replace(/\s/g,''),syGramSimilarity:()=>0
};
vm.createContext(context);
vm.runInContext(source('function syNormalizeResult','function loadSheyanModule'),context);
const flowers=context.SHEYAN_FLOWER_SCENES.map((scene,i)=>({scene,main:`自然主句${i}`,support:`自然辅助句${i}`}));
const result=context.syLocalFinalizeResult({title:'自然标题',body:'只保留这一段自然正文。',tags:[],flowers},'参考正文','参考花字');
expect(result.body==='只保留这一段自然正文。','正文被前端补写或截断');
expect(result.flowers.every((flower,i)=>flower.main===`自然主句${i}`&&flower.support===`自然辅助句${i}`),'花字被前端补写或截断');

console.log('sheyan natural rewrite regression: PASS');
