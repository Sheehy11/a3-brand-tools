import fs from 'node:fs';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');

if(!html.includes('参考稿（选填，可加入多篇）'))throw new Error('页面仍未开放多参考稿');
if(!html.includes('onclick="hfAddReference()"'))throw new Error('加入参考稿按钮未接入');
if(!html.includes('referenceSamples:[]'))throw new Error('多参考稿没有持久状态');
if(!html.includes('HF.referenceSamples=Array.isArray(HF.referenceSamples)'))throw new Error('多参考稿没有从本地状态恢复');
if(!html.includes('assignedReferences=Array.from({length:count},(_,i)=>hfReferenceForDraft(references,i))'))throw new Error('批量生成没有逐篇分配参考稿');
if(!html.includes('function hfReferenceForDraft(samples,index){return samples.length?samples[index%samples.length]:\'\';}'))throw new Error('单参考多稿与多参考逐稿的循环对应规则缺失');
if(!html.includes('不得把多篇内容拼接进同一篇成稿'))throw new Error('缺少禁止多参考拼接成长文的约束');
if(!html.includes('生成第${i+1}篇必须对应参考稿${references.indexOf(assignedReferences[i])+1}'))throw new Error('生成请求没有明确写入参考稿对应编号');
if(!html.includes('不得以“差异化”为由偏离参考稿'))throw new Error('差异化规则仍可能覆盖仿写参考');
if(!html.includes('function hfGenerationSourcePriority(ref,requirementText='))throw new Error('缺少参考稿与背景资料的生成优先级');
if(!html.includes('本次人工需求与本篇对应参考稿共同决定正文重点'))throw new Error('有参考稿时未将参考内容重点与人工需求设为优先');
if(!html.includes('背景资料只用于补足参考稿或人工需求已经涉及的事实'))throw new Error('有参考稿时背景资料仍可能成为正文主线');
if(!html.includes('没有对应参考稿时，本次人工需求与背景资料同等决定正文重点'))throw new Error('无参考稿时人工需求与背景资料未设为同等重要');
if(!html.includes("if(!String(ref||'').trim()||hfNeedsConcreteMechanism(cfg.requirementText))"))throw new Error('参考稿未要求机制时仍会被机制验收强制改写');
if(!html.includes('hfGenerationMaterial(ref,requirementText)'))throw new Error('单篇生成未使用新的来源优先级');
if(!html.includes("hfGenerationMaterial(references[0]||'',requirementText)"))throw new Error('批量生成未使用新的来源优先级');
if(html.includes('>AI整理需求</button>')||html.includes('>逐条确认</label>'))throw new Error('需求整理过程仍暴露在页面');
if(!html.includes('hfLiveRequirementText()'))throw new Error('隐藏整理后原始需求未进入生成');
if(!html.includes('onclick="hfSaveCurrentRequirement()">保存为我的需求'))throw new Error('固定要求保存入口缺失');
if(!html.includes('onclick="hfLiveExportWeekly()">导出最近一周需求痕迹'))throw new Error('一周需求痕迹导出入口缺失');
if(!html.includes("hfLogRequirementTrace('生成1篇')")||!html.includes('hfLogRequirementTrace(`生成${count}篇`)'))throw new Error('单篇或批量生成没有记录临时需求使用痕迹');
if(!html.includes("x.raw||x.preference?'否（本次临时使用）':'使用已保存要求'"))throw new Error('导出记录无法区分临时需求与固定要求');
if(!html.includes("x.kind==='rewrite_feedback'?'写手审核修改意见':'生成使用痕迹'"))throw new Error('一周导出未合并审核页写手意见');
if(!html.includes('资料会持续保留并用于后续生成，只有点击“清空背景”才会删除'))throw new Error('背景资料保留规则未清晰展示');
if(!html.includes("localStorage.setItem(hfStoreKey(),JSON.stringify"))throw new Error('背景资料没有写入本地状态');
if(!html.includes('function hfClearMaterialPack()'))throw new Error('背景资料缺少唯一明确的清空入口');

console.log('multi-reference and background persistence regression: PASS');
