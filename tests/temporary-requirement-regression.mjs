import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
function source(from,to){
  const start=html.indexOf(from),end=html.indexOf(to,start);
  if(start<0||end<0)throw new Error(`未找到函数片段：${from}`);
  return html.slice(start,end);
}

if(!html.includes("function hfTemporaryRequirementText(){return hfVal('hf-live-raw');}"))throw new Error('选择内容模板时，本次内容需求仍可能被排除');
if(!html.includes("if(staleWorkspace)await collabApi('/requirements/workspace',{method:'POST',body:{raw:'',draftItems:[]}})"))throw new Error('跨设备旧临时需求没有一次性清理迁移');
if(!html.includes("HF.customDirection=HQ_CONTENT_MODE==='ao'"))throw new Error('AO 本次需求模式没有按当前任务重置');
if(!html.includes("if(!on){HF.customDirection=false;HF.stage='';HF.direction='';HF.product='';HF.sellingPoint='';HF.angle=''"))throw new Error('取消本次需求模式没有退出临时选择');
if((html.match(/hfClearTemporaryRequirement\(\{resetMode:false\}\);/g)||[]).length<2)throw new Error('单篇或批量成功生成后没有消费本次需求');
if(!html.includes('HF.generationRequirement=requirementText;'))throw new Error('当前稿件没有保存本次实际生成要求供审核继承');
if(!html.includes('HF.generationRequirement||hfLiveRequirementText()'))throw new Error('审核与重写没有绑定当前稿件的生成要求');

const code=source('function hfTemporaryRequirementText','function hfExplicitLength');
const values={'hf-live-raw':'已经过期的临时要求','hf-special':''};
const context={
  HQ_CONTENT_MODE:'ao',
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

if(context.hfLiveRequirementText()!=='已经过期的临时要求')throw new Error('选择内容模板后，本次内容需求没有继续进入生成');
context.HF.customDirection=true;
context.hfClearTemporaryRequirement({resetMode:false});
if(context.workspace.raw||context.workspace.draftItems.length||values['hf-live-raw'])throw new Error('本次生成完成后临时要求没有被消费清空');
if(!context.HF.customDirection||context.HF.product!=='旧产品')throw new Error('消费临时文本时破坏了当前稿件的审核上下文');
context.workspace.raw='再次输入';context.workspace.draftItems=[{instruction:'再次输入'}];
context.hfClearTemporaryRequirement();
if(!context.HF.customDirection||context.HF.product||context.HF.sellingPoint||context.HF.angle)throw new Error('清空本次需求后没有恢复AO默认需求模式');

context.HF.customDirection=false;
context.hfLiveActive=()=>[{category:'client_rule',instruction:'已明确保存的持续要求'}];
if(context.hfLiveRequirementText()!=='已明确保存的持续要求')throw new Error('清除临时需求时误伤了明确保存的持续要求');

console.log('temporary requirement regression: PASS');
