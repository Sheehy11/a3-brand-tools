const enc = new TextEncoder();

const COLLAB_ACTORS = Object.freeze({
  yangyang: {id:'yangyang', name:'阳阳', role:'writer'},
  april: {id:'april', name:'APRIL', role:'writer'},
  yixi: {id:'yixi', name:'一西', role:'reviewer'}
});
const COLLAB_MODULES = new Set([
  'haoqi_ao','haoqi_opinion','haoqi_legacy',
  'bayer_timepro','bayer_liquid','bayer_heart'
]);

function allowedOrigin(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean);
  if (origin === 'null' && env.ALLOW_LOCAL_FILE === 'true') return 'null';
  return allowed.includes(origin) ? origin : '';
}
function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400'
  };
}
function json(data, status, origin) {
  return new Response(JSON.stringify(data), {status, headers:{'Content-Type':'application/json; charset=utf-8', ...cors(origin)}});
}
function b64url(bytes) {
  let s=''; for (const b of bytes) s+=String.fromCharCode(b);
  return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function fromB64url(s) {
  const raw=atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4));
  return Uint8Array.from(raw,c=>c.charCodeAt(0));
}
async function hmac(value, secret) {
  const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(value)));
}
async function makeToken(env) {
  const payload=b64url(enc.encode(JSON.stringify({exp:Date.now()+8*60*60*1000,nonce:crypto.randomUUID()})));
  return `${payload}.${b64url(await hmac(payload,env.SESSION_SECRET))}`;
}
async function validToken(request, env) {
  const token=(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
  const [payload,sig]=token.split('.'); if(!payload||!sig)return false;
  const expected=await hmac(payload,env.SESSION_SECRET),actual=fromB64url(sig);
  if(actual.length!==expected.length)return false;
  let diff=0;for(let i=0;i<actual.length;i++)diff|=actual[i]^expected[i];if(diff)return false;
  try{return JSON.parse(new TextDecoder().decode(fromB64url(payload))).exp>Date.now();}catch{return false;}
}
function sameSecret(a,b) {
  a=enc.encode(String(a||''));b=enc.encode(String(b||''));let diff=a.length^b.length;
  const n=Math.max(a.length,b.length);for(let i=0;i<n;i++)diff|=(a[i]||0)^(b[i]||0);return diff===0;
}

function collabActor(value) {
  return COLLAB_ACTORS[String(value||'').toLowerCase()] || null;
}
function collabText(value, max) {
  return String(value||'').trim().slice(0,max);
}
function collabStatusLabel(status) {
  return ({review_pending:'等待一西审核',writer_action:'等待写手修改',confirmed:'已完成'}[status]||status);
}
function collabTaskAllowed(task, actor) {
  return actor.role==='reviewer' || task.writer_id===actor.id;
}
function collabCode() {
  const d=new Date(),date=[d.getUTCFullYear(),String(d.getUTCMonth()+1).padStart(2,'0'),String(d.getUTCDate()).padStart(2,'0')].join('');
  return `A3-${date}-${crypto.randomUUID().slice(0,6).toUpperCase()}`;
}
async function collabBody(request) {
  return request.json().catch(()=>({}));
}
async function collabTask(db,id) {
  return db.prepare('SELECT * FROM collab_tasks WHERE id=?').bind(id).first();
}
async function handleCollab(request, env, url, origin) {
  const db=env.COLLAB_DB;
  if(!db)return json({error:'共享协作数据库尚未配置'},503,origin);
  const path=url.pathname.replace(/^\/api\/collab\/?/,'').split('/').filter(Boolean);
  const method=request.method;
  const input=method==='POST'?await collabBody(request):{};
  const actor=collabActor(input.actor||url.searchParams.get('actor'));
  if(!actor)return json({error:'请选择当前使用人'},400,origin);

  try{
    if(path[0]==='actors'&&method==='GET')return json({actors:Object.values(COLLAB_ACTORS)},200,origin);

    if(path[0]==='tasks'&&path.length===1&&method==='GET'){
      const query=actor.role==='reviewer'
        ?db.prepare(`SELECT id,code,brand,module,writer_id,writer_name,status,current_version,reuse_as_fewshot,writer_unread,reviewer_unread,created_at,updated_at,confirmed_at FROM collab_tasks ORDER BY updated_at DESC LIMIT 120`)
        :db.prepare(`SELECT id,code,brand,module,writer_id,writer_name,status,current_version,reuse_as_fewshot,writer_unread,reviewer_unread,created_at,updated_at,confirmed_at FROM collab_tasks WHERE writer_id=? ORDER BY updated_at DESC LIMIT 120`).bind(actor.id);
      const result=await query.all();
      return json({actor,tasks:(result.results||[]).map(x=>({...x,statusLabel:collabStatusLabel(x.status)}))},200,origin);
    }

    if(path[0]==='tasks'&&path.length===1&&method==='POST'){
      if(actor.role!=='writer')return json({error:'只有写手可以提交初稿'},403,origin);
      const module=collabText(input.module,40),brand=collabText(input.brand,20);
      const initialDraft=collabText(input.initialDraft,80000),aiDraft=collabText(input.aiDraft,80000);
      if(!COLLAB_MODULES.has(module)||!['haoqi','bayer'].includes(brand))return json({error:'当前模块尚未接入共享协作'},400,origin);
      if(!initialDraft)return json({error:'写手初稿不能为空'},400,origin);
      const id=crypto.randomUUID(),code=collabCode(),now=new Date().toISOString();
      await db.batch([
        db.prepare(`INSERT INTO collab_tasks (id,code,brand,module,writer_id,writer_name,status,ai_draft,initial_draft,current_version,reuse_as_fewshot,writer_unread,reviewer_unread,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,1,0,0,1,?,?)`).bind(id,code,brand,module,actor.id,actor.name,'review_pending',aiDraft,initialDraft,now,now),
        db.prepare(`INSERT INTO collab_versions (task_id,version_no,content,author_id,author_name,source,created_at) VALUES (?,1,?,?,?,?,?)`).bind(id,initialDraft,actor.id,actor.name,'writer_initial',now)
      ]);
      return json({ok:true,id,code,status:'review_pending',statusLabel:collabStatusLabel('review_pending')},201,origin);
    }

    if(path[0]==='tasks'&&path[1]&&path.length===2&&method==='GET'){
      const task=await collabTask(db,path[1]);
      if(!task)return json({error:'稿件不存在'},404,origin);
      if(!collabTaskAllowed(task,actor))return json({error:'无权查看这篇稿件'},403,origin);
      const [versions,feedback]=await Promise.all([
        db.prepare('SELECT id,version_no,content,author_id,author_name,source,created_at FROM collab_versions WHERE task_id=? ORDER BY version_no ASC').bind(task.id).all(),
        db.prepare('SELECT id,round_no,content,author_id,author_name,created_at FROM collab_feedback WHERE task_id=? ORDER BY round_no ASC').bind(task.id).all()
      ]);
      return json({task:{...task,statusLabel:collabStatusLabel(task.status)},versions:versions.results||[],feedback:feedback.results||[]},200,origin);
    }

    if(path[0]==='tasks'&&path[1]&&path[2]==='read'&&method==='POST'){
      const task=await collabTask(db,path[1]);
      if(!task)return json({error:'稿件不存在'},404,origin);
      if(!collabTaskAllowed(task,actor))return json({error:'无权查看这篇稿件'},403,origin);
      const column=actor.role==='reviewer'?'reviewer_unread':'writer_unread';
      await db.prepare(`UPDATE collab_tasks SET ${column}=0 WHERE id=?`).bind(task.id).run();
      return json({ok:true},200,origin);
    }

    if(path[0]==='tasks'&&path[1]&&path[2]==='feedback'&&method==='POST'){
      if(actor.role!=='reviewer')return json({error:'只有一西可以提交审核反馈'},403,origin);
      const task=await collabTask(db,path[1]),content=collabText(input.content,12000);
      if(!task)return json({error:'稿件不存在'},404,origin);
      if(task.status!=='review_pending')return json({error:'当前稿件不在待审核状态'},409,origin);
      if(!content)return json({error:'反馈内容不能为空'},400,origin);
      const row=await db.prepare('SELECT COALESCE(MAX(round_no),0) AS n FROM collab_feedback WHERE task_id=?').bind(task.id).first();
      const round=Number(row?.n||0)+1,now=new Date().toISOString();
      await db.batch([
        db.prepare('INSERT INTO collab_feedback (task_id,round_no,content,author_id,author_name,created_at) VALUES (?,?,?,?,?,?)').bind(task.id,round,content,actor.id,actor.name,now),
        db.prepare(`UPDATE collab_tasks SET status='writer_action',writer_unread=1,reviewer_unread=0,updated_at=? WHERE id=?`).bind(now,task.id)
      ]);
      return json({ok:true,round,status:'writer_action',statusLabel:collabStatusLabel('writer_action')},201,origin);
    }

    if(path[0]==='tasks'&&path[1]&&path[2]==='versions'&&method==='POST'){
      const task=await collabTask(db,path[1]),content=collabText(input.content,80000);
      if(!task)return json({error:'稿件不存在'},404,origin);
      if(actor.role!=='writer'||task.writer_id!==actor.id)return json({error:'只有该稿件写手可以提交修改稿'},403,origin);
      if(task.status!=='writer_action')return json({error:'当前没有待处理的审核反馈'},409,origin);
      if(!content)return json({error:'修改稿不能为空'},400,origin);
      const version=Number(task.current_version||1)+1,source=input.source==='ai'?'ai_feedback':'writer_revision',now=new Date().toISOString();
      await db.batch([
        db.prepare('INSERT INTO collab_versions (task_id,version_no,content,author_id,author_name,source,created_at) VALUES (?,?,?,?,?,?,?)').bind(task.id,version,content,actor.id,actor.name,source,now),
        db.prepare(`UPDATE collab_tasks SET status='review_pending',current_version=?,writer_unread=0,reviewer_unread=1,updated_at=? WHERE id=?`).bind(version,now,task.id)
      ]);
      return json({ok:true,version,status:'review_pending',statusLabel:collabStatusLabel('review_pending')},201,origin);
    }

    if(path[0]==='tasks'&&path[1]&&path[2]==='confirm'&&method==='POST'){
      if(actor.role!=='reviewer')return json({error:'只有一西可以完成内部确认'},403,origin);
      const task=await collabTask(db,path[1]);
      if(!task)return json({error:'稿件不存在'},404,origin);
      if(task.status!=='review_pending')return json({error:'请等待写手提交修改稿'},409,origin);
      const reuse=input.reuseAsFewshot===true?1:0,now=new Date().toISOString();
      await db.prepare(`UPDATE collab_tasks SET status='confirmed',reuse_as_fewshot=?,confirmed_by=?,confirmed_at=?,writer_unread=1,reviewer_unread=0,updated_at=? WHERE id=?`).bind(reuse,actor.name,now,now,task.id).run();
      return json({ok:true,status:'confirmed',reuseAsFewshot:!!reuse,statusLabel:collabStatusLabel('confirmed')},200,origin);
    }

    if(path[0]==='few-shots'&&method==='GET'){
      const brand=collabText(url.searchParams.get('brand'),20),module=collabText(url.searchParams.get('module'),40);
      if(!['haoqi','bayer'].includes(brand)||!COLLAB_MODULES.has(module))return json({fewShots:[]},200,origin);
      const result=await db.prepare(`SELECT t.id,t.code,t.brand,t.module,t.writer_name,t.confirmed_at,v.content FROM collab_tasks t JOIN collab_versions v ON v.task_id=t.id AND v.version_no=t.current_version WHERE t.status='confirmed' AND t.reuse_as_fewshot=1 AND t.brand=? AND t.module=? ORDER BY t.confirmed_at DESC LIMIT 3`).bind(brand,module).all();
      return json({fewShots:result.results||[]},200,origin);
    }

    return json({error:'协作接口不存在'},404,origin);
  }catch(error){
    console.error('collab_error',error);
    return json({error:'共享协作服务暂时异常'},500,origin);
  }
}

export default {
  async fetch(request, env) {
    const url=new URL(request.url),origin=allowedOrigin(request,env);
    if(!origin)return new Response('Origin not allowed',{status:403});
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors(origin)});
    if(url.pathname==='/api/health'&&request.method==='GET')return json({ok:true,model:env.A3_MODEL||'gpt-5.6-terra',collaboration:!!env.COLLAB_DB},200,origin);
    if(url.pathname==='/api/session'&&request.method==='POST'){
      const body=await request.json().catch(()=>({}));
      if(!sameSecret(body.password,env.ACCESS_PASSWORD))return json({error:'密码错误'},401,origin);
      return json({token:await makeToken(env),expiresIn:28800},200,origin);
    }
    if(url.pathname.startsWith('/api/collab/')){
      if(!await validToken(request,env))return json({error:'登录已过期'},401,origin);
      return handleCollab(request,env,url,origin);
    }
    if(url.pathname!=='/api/chat'||request.method!=='POST')return json({error:'Not found'},404,origin);
    if(!await validToken(request,env))return json({error:'登录已过期'},401,origin);
    const declared=Number(request.headers.get('Content-Length')||0);if(declared>180000)return json({error:'请求内容过大'},413,origin);
    const raw=await request.text();if(raw.length>180000)return json({error:'请求内容过大'},413,origin);
    const input=JSON.parse(raw||'{}');
    const messages=[];
    if(typeof input.system==='string'&&input.system.trim())messages.push({role:'system',content:input.system.slice(0,120000)});
    for(const m of Array.isArray(input.messages)?input.messages:[]){if(['user','assistant'].includes(m?.role)&&typeof m.content==='string')messages.push({role:m.role,content:m.content.slice(0,60000)});}
    if(!messages.some(m=>m.role==='user'))return json({error:'缺少用户内容'},400,origin);
    const upstream=await fetch(env.A3_API_URL||'https://new-api.a3database.cn/v1/chat/completions',{
      method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${env.A3_API_KEY}`},
      // A3 的部分兼容模型会保持 SSE 连接但不发送结束帧。共享服务与本地验收
      // 统一使用非流式完整响应，避免内容已经生成、页面却一直等待直至超时。
      body:JSON.stringify({model:env.A3_MODEL||'gpt-5.6-terra',messages,stream:false,max_tokens:4096})
    });
    if(!upstream.ok)return json({error:'内容服务请求失败',status:upstream.status},502,origin);
    const headers=new Headers(upstream.headers);Object.entries(cors(origin)).forEach(([k,v])=>headers.set(k,v));headers.set('Cache-Control','no-store');
    return new Response(upstream.body,{status:upstream.status,headers});
  }
};
