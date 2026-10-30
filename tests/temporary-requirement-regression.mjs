import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
function source(from,to){
  const start=html.indexOf(from),end=html.indexOf(to,start);
  if(start<0||end<0)throw new Error(`未找到函数片段：${from}`);
  return html.slice(start,end);
}

if(!html.includes("function hfTemporaryRequirementText(){return HF.customDirection?hfVal('hf-live-raw'):'';}"))throw new Error('临时新增需求没有受当前勾选状态硬隔离');
if(!html.includes("if(staleWorkspace)await collabApi('/requirements/workspace',{method:'POST',body:{raw:'',draftItems:[]}})"))throw new Error('跨设备旧临时需求没有一次性清理迁移');
if(!html.includes('customDirection:false,pendingUrls:[]'))throw new Error('刷新后仍可能恢复旧的临时新增方向模式');
if(!html.includes('if(!on){hfClearTemporaryRequirement();return;}'))throw new Error('取消勾选没有立即清空临时需求');
if(!html.includes('if(HF.customDirection)hfClearTemporaryRequirement({resetMode:false});'))throw new Error('成功生成后没有消费临时需求');
if(!html.includes('HF.generationRequirement=requirementText;'))throw new Error('当前稿件没有保存本次实际生成要求供审核继承');
if(!html.includes('HF.generationRequirement||hfLiveRequirementText()'))throw new Error('审核与重写没有绑定当前稿件的生成要求');

const code=source('function hfTemporaryRequirementText','function hfExplicitLength');
const values={'hf-live-raw':'已经过期的临时要求','hf-special':''};
const context={
  HF:{customDirection:false,stage:'旧阶段',direction:'旧方向',product:'旧产品',sellingPoint:'旧卖点',angle:'旧切角'},
  hfVal:id=>values[id]||'',
  hfLiveActive:()=>[],
  hfLiveWorkspace:()=>context.workspace,
  hfSet:(id,value)=>{values[id]=value;},
  hfLiveSave:()=>{context.saved=true;},
  hfLiveRender:()=>{},hfRenderDirections:()=>{},hfUpdateSelection:()=>{},hfSaveState:()=>{},
  workspace:{raw:'已经过期的临时要求',draftItems:[{instruction:'旧要求'}]},saved:false
};
vm.createContext(context);vm.runInContext(code,context);

if(context.hfLiveRequirementText())throw new Error('未勾选时仍把旧临时要求送入生成');
context.HF.customDirection=true;
if(context.hfLiveRequirementText()!=='已经过期的临时要求')throw new Error('勾选后临时要求没有进入本次生成');
context.hfClearTemporaryRequirement({resetMode:false});
if(context.workspace.raw||context.workspace.draftItems.length||values['hf-live-raw'])throw new Error('本次生成完成后临时要求没有被消费清空');
if(!context.HF.customDirection||context.HF.product!=='旧产品')throw new Error('消费临时文本时破坏了当前稿件的审核上下文');
context.workspace.raw='再次输入';context.workspace.draftItems=[{instruction:'再次输入'}];
context.hfClearTemporaryRequirement();
if(context.HF.customDirection||context.HF.product||context.HF.sellingPoint||context.HF.angle)throw new Error('取消临时模式时没有完整退出旧选择');

context.HF.customDirection=false;
context.hfLiveActive=()=>[{category:'client_rule',instruction:'已明确保存的持续要求'}];
if(context.hfLiveRequirementText()!=='已明确保存的持续要求')throw new Error('清除临时需求时误伤了明确保存的持续要求');

console.log('temporary requirement regression: PASS');
