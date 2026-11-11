import fs from 'node:fs';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const required=[
  'function hfEnableDropUploads(root)',
  "zone.addEventListener('drop'",
  'function hfDroppedFiles(dataTransfer)',
  'HF_PENDING_MATERIAL_FILES.push(file)',
  '拖拽或点击添加背景资料',
  '拖拽或点击添加链接文件',
  '拖拽或点击添加表现数据',
  'hfEnableDropUploads(host)'
];

for(const token of required){
  if(!html.includes(token))throw new Error(`缺少拖拽上传能力：${token}`);
}

console.log('drag upload regression: PASS');
