import fs from 'node:fs';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
function expect(condition,message){if(!condition)throw new Error(message)}
function same(actual,expected){return actual.length===expected.length&&expected.every(x=>actual.includes(x))}

const productsMatch=html.match(/const HQ_AO_PRODUCTS=(\[[^\n]+\]);/);
expect(productsMatch,'无法读取 AO 全品线产品池');
const products=Function(`return ${productsMatch[1]}`)();
const smallForest=['小森林纸尿裤','小森林拉拉裤'];
const all=['小森林纸尿裤','小森林拉拉裤','深睡大师','X系列','屁屁面膜','小桃裤','小龙裤','小黑洞'];
expect(same(products,all),'AO 产品池没有完整覆盖八个品线/形态');

const bindingsMatch=html.match(/const HQ_AO_EXECUTION_BINDINGS=(\{[\s\S]*?\n\});\nfunction hfAoExecutionBinding/);
expect(bindingsMatch,'无法读取 AO 执行表绑定矩阵');
const bindings=Function('HQ_AO_PRODUCTS','HQ_AO_SMALL_FOREST_PRODUCTS',`return (${bindingsMatch[1]})`)(products,smallForest);
const expected={
  '巩固高端与大牌信任':[...smallForest,'深睡大师','X系列','屁屁面膜'],
  '降低焦虑，恢复熟悉感与购买确定性':all,
  '重新争夺好奇的首选位置':[...smallForest,'深睡大师','X系列','屁屁面膜','小桃裤','小龙裤'],
  '提供外部判断依据，降低检测信息理解门槛':[...smallForest,'深睡大师','X系列','屁屁面膜','小黑洞'],
  '用同类用户经验坚定继续使用':all,
  '强化消费者对既有选择的自我确认':[...smallForest,'深睡大师','X系列','屁屁面膜'],
  '过去积累的手感、版型、使用习惯很难被替代。\n好奇是纸尿裤里的“白月光”。':smallForest,
  '降低替换焦虑与重新试错成本':all,
  '降低换牌吸引力，强化高端制造信心':[...smallForest,'屁屁面膜'],
  '强化差异化和不可替代\n【好奇确实有人无我有的优势，真的找不到替代】':[...smallForest,'X系列','屁屁面膜','小桃裤','小龙裤','小黑洞'],
  '内容上要抢占“换好奇/好奇替代/小森林对比”等老客再决策搜索词':smallForest
};
for(const [task,list] of Object.entries(expected))expect(bindings[task]&&same(bindings[task].products,list),`执行表品线绑定错误：${task}`);

const angleMap=bindings['强化差异化和不可替代\n【好奇确实有人无我有的优势，真的找不到替代】'].angleMap;
expect(same(Object.keys(angleMap['不是没想过换牌，但尿便分区真的只有好奇有啊']),['X系列','屁屁面膜']),'尿便分区切角没有限定 X系列/屁屁面膜');
expect(same(Object.keys(angleMap['好奇的便便兜真的是别的牌子没法替代的']),[...smallForest,'小桃裤','小龙裤','小黑洞']),'便便兜切角品线绑定错误');
expect(html.includes('function hfAoSelectionValid(rule,product,key,angleLabel)'),'缺少任务—产品—卖点—切角组合校验');
expect(html.includes('hfAoPointMatches(rule,x,HF.sellingPoint,HF.product)'),'页面切角渲染没有使用完整四层绑定');
expect(!html.includes("if(product&&!String(product).includes('小森林'))"),'仍存在非小森林品线绕过切角约束的逻辑');
for(const guard of ['当前组合不属于执行表分配','当前审核配置不属于执行表分配','当前重写配置不属于执行表分配'])expect(html.includes(guard),`缺少流程守卫：${guard}`);
for(const product of ['X系列','屁屁面膜','深睡大师','小桃裤','小龙裤','小黑洞'])expect(html.includes(`'${product}':[`),`好奇知识库缺少 ${product} 的卖点`);

console.log('haoqi execution binding regression: PASS');
