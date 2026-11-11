import fs from 'node:fs';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const expect=(value,message)=>{if(!value)throw new Error(message)};

expect(html.includes('其他已确认信息'),'资料区没有显示实际可用信息');
expect(html.includes('需要人工确认'),'资料区没有列出具体待确认项');
expect(html.includes('小红书搜索证据'),'页面没有展示可核验的小红书搜索结果');
expect(html.includes('打开原内容核对'),'搜索结果没有提供原链接');
expect(html.includes('本次生成会使用的具体机制'),'页面没有明确展示会进入生成的机制');
expect(html.includes('第二天需求相同不用重新上传'),'资料包没有说明跨天沿用规则');
expect(html.includes('HF.materialDigest=await hfCallJson'),'资料摘要没有使用结构化结果');
expect(html.includes("let materials=(HF.materials||[]).filter"),'再次读取会丢失此前已经提取的上传资料');
expect(html.includes('具体缺失、模糊或冲突的机制字段'),'待确认项仍可能只显示含糊结论');
expect(html.includes('hfMechanismUseAudit'),'生成后没有验收具体机制是否真正进入正文');
expect(html.includes('本次要求需要具体机制，但当前搜索结果没有提取到可用规则'),'缺少机制时仍会生成言之无物的文案');
expect(html.includes('从历史定稿与客户删改中提炼的方法'),'生成没有调用历史稿提炼的写作方法');
expect(html.includes('正文写成日记式小作文'),'缺少日记式小作文拦截');
expect(html.includes('hfHardKnowledgeConflictIssues'),'生成提示没有限定为知识库硬边界冲突');

console.log('material digest and writing-method regression: PASS');
