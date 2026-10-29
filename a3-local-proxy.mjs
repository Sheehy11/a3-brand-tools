import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const HOST='127.0.0.1';
const PORT=Number(process.env.A3_LOCAL_PORT||8788);
const UPSTREAM_URL=process.env.A3_UPSTREAM_URL||'https://new-api.a3database.cn/v1/chat/completions';
const INDEX_FILE=fileURLToPath(new URL('./index.html',import.meta.url));
const MAX_BODY_BYTES=6*1024*1024;
const ALLOWED_MODELS=new Set(['doubao-seed-2-1-turbo-260628']);

function allowedOrigin(origin=''){
  return !origin||origin==='null'||/^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(origin);
}
function cors(origin=''){
  return {'Access-Control-Allow-Origin':origin||'null','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Private-Network':'true','Access-Control-Max-Age':'86400','Vary':'Origin'};
}
function sendJson(res,status,data,origin=''){
  res.writeHead(status,{...cors(origin),'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));
}
function readBody(req){return new Promise((resolve,reject)=>{const chunks=[];let size=0;req.on('data',chunk=>{size+=chunk.length;if(size>MAX_BODY_BYTES){reject(new Error('请求内容超过本机转发上限'));req.destroy();return;}chunks.push(chunk);});req.on('end',()=>resolve(Buffer.concat(chunks)));req.on('error',reject);});}

const server=http.createServer(async(req,res)=>{
  const origin=String(req.headers.origin||'');
  if(!allowedOrigin(origin)){sendJson(res,403,{error:'本机转发服务只允许本机页面访问'},origin);return;}
  if(req.method==='OPTIONS'){res.writeHead(204,cors(origin));res.end();return;}
  if(req.method==='GET'&&['/','/index.html'].includes(req.url||'')){
    try{const html=await readFile(INDEX_FILE);res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store, max-age=0'});res.end(html);}catch(error){sendJson(res,500,{error:`无法读取本地网页：${error.message}`},origin);}return;
  }
  if(req.method==='GET'&&req.url==='/health'){sendJson(res,200,{ok:true,service:'a3-brand-tools-local-proxy',models:[...ALLOWED_MODELS]},origin);return;}
  if(req.method!=='POST'||!['/v1/chat/completions','/chat/completions'].includes(req.url||'')){sendJson(res,404,{error:'未找到本机转发路径'},origin);return;}
  const authorization=String(req.headers.authorization||'');
  if(!authorization.startsWith('Bearer ')){sendJson(res,401,{error:'缺少 A3 Key'},origin);return;}
  const requestStartedAt=Date.now();
  try{
    const body=await readBody(req);let payload;
    try{payload=JSON.parse(body.toString('utf8'));}catch{sendJson(res,400,{error:'请求 JSON 无法读取'},origin);return;}
    if(!ALLOWED_MODELS.has(String(payload.model||''))){sendJson(res,400,{error:'模型名称未获授权'},origin);return;}
    delete payload.thinking;
    payload.reasoning_effort='minimal';
    const upstreamBody=JSON.stringify(payload);
    console.log(`[${new Date().toISOString()}] 转发 model=${payload.model} bytes=${Buffer.byteLength(upstreamBody)} reasoning=minimal`);
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),190000);
    const browserClosed=()=>{if(!res.writableEnded)controller.abort();};res.once('close',browserClosed);
    try{
      const upstream=await fetch(UPSTREAM_URL,{method:'POST',headers:{Authorization:authorization,'Content-Type':'application/json'},body:upstreamBody,signal:controller.signal});
      const responseBody=Buffer.from(await upstream.arrayBuffer()),headers={...cors(origin),'Content-Type':upstream.headers.get('content-type')||'application/json; charset=utf-8','Cache-Control':'no-store'};
      const requestId=upstream.headers.get('x-request-id');if(requestId)headers['X-Request-ID']=requestId;
      headers['X-A3-Upstream-Ms']=String(Date.now()-requestStartedAt);
      const errorDetail=upstream.ok?'':(()=>{try{const data=JSON.parse(responseBody.toString('utf8'));return String(typeof data.error==='string'?data.error:data.error?.message||data.message||'').slice(0,240);}catch{return'';}})();
      console.log(`[${new Date().toISOString()}] 完成 model=${payload.model} status=${upstream.status} ms=${Date.now()-requestStartedAt} responseBytes=${responseBody.length}${errorDetail?` error=${errorDetail}`:''}`);
      res.writeHead(upstream.status,headers);res.end(responseBody);
    }finally{clearTimeout(timer);res.off('close',browserClosed);}
  }catch(error){if(res.destroyed||res.writableEnded)return;console.error(`[${new Date().toISOString()}] 失败 ms=${Date.now()-requestStartedAt} error=${String(error?.message||error)}`);sendJson(res,error?.name==='AbortError'?504:530,{error:error?.name==='AbortError'?'A3 模型响应超时':`本机转发无法连接 A3：${String(error?.message||error)}`},origin);}
});

server.listen(PORT,HOST,()=>{
  console.log(`A3 内容工具本机转发已启动：http://${HOST}:${PORT}/`);
  console.log('支持模型：豆包 Seed 2.1 Turbo');
});
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`端口 ${PORT} 已被占用，请先运行“停止A3本地验收.command”。`:`本机转发启动失败：${error.message}`);process.exitCode=1;});
