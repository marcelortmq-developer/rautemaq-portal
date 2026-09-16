import {randomBytes,randomUUID} from 'node:crypto';
import {db,storage} from '../server/db.mjs';
import {hash,verify,digest,cleanText,url} from '../server/security.mjs';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const safe=u=>({id:u.id,username:u.username,name:u.name,is_admin:u.is_admin,avatar:u.avatar});
const id=v=>{if(!/^[0-9a-f-]{36}$/.test(v||''))fail('Identificador inválido.');return v;};
const admin=u=>{if(!u.is_admin||!['vitor','marcelo'].includes(u.username))fail('Acesso exclusivo aos administradores.',403);};
const allowed=['notes','faq','versions','tax','files','drive'];
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 try{
 const q=new URL(req.url,'http://local').searchParams,action=q.get('action')||'state',method=req.method;
 if(!['GET','POST'].includes(method))fail('Método não permitido.',405);
 if(method==='POST'&&req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)fail('Origem inválida.',403);
 const b=req.body||{};
 if(action==='login'&&method==='POST'){
 const username=cleanText(b.username,40).toLowerCase();if(!/^[a-z0-9_]{2,40}$/.test(username))fail('Usuário ou senha incorretos.',401);
 const password=cleanText(b.password,128);
 const ip=req.headers['x-real-ip']||req.socket?.remoteAddress||'unknown';
 const limit=await db('rpc/portal_allow_login','POST',{p_key:digest(ip+':'+username)});if(!limit)fail('Muitas tentativas. Aguarde 15 minutos.',429);
 const [u]=await db('portal_users?username=eq.'+username);if(!u||!verify(password,u.password_hash))fail('Usuário ou senha incorretos.',401);
 const token=randomBytes(32).toString('hex');await db('portal_sessions','POST',{token_hash:digest(token),user_id:u.id,expires_at:new Date(Date.now()+86400000).toISOString()});
 res.setHeader('Set-Cookie',`session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${process.env.VERCEL?'; Secure':''}`);return res.json({user:safe(u)});
 }
 const token=(req.headers.cookie||'').match(/(?:^|;\s*)session=([a-f0-9]{64})/)?.[1];if(!token)fail('Entre para continuar.',401);
 const [session]=await db('portal_sessions?token_hash=eq.'+digest(token)+'&expires_at=gt.'+encodeURIComponent(new Date().toISOString()));if(!session)fail('Sessão expirada. Entre novamente.',401);
 const [u]=await db('portal_users?id=eq.'+session.user_id);if(!u)fail('Usuário não encontrado.',401);
 if(action==='state'&&method==='GET'){
 const [items,settings]=await Promise.all([db('portal_items?or=(kind.neq.notes,owner_id.eq.'+u.id+')&order=created_at.desc'),db('portal_settings?id=eq.1')]);return res.json({user:safe(u),items,currentTax:settings[0]?.current_tax});
 }
 if(action==='users'&&method==='GET'){admin(u);return res.json(await db('portal_users?select=id,username,name,is_admin,avatar&order=name'));}
 if(action==='file'&&method==='GET'){
 const path=q.get('path')||'';const items=await db('portal_items?file_path=eq.'+encodeURIComponent(path));const users=await db('portal_users?avatar=eq.'+encodeURIComponent(path));
 if(!items.some(i=>i.kind!=='notes'||i.owner_id===u.id)&&!users.length)fail('Arquivo não encontrado.',404);
 const signed=await storage('object/sign/portal/'+path,'POST',JSON.stringify({expiresIn:60}));return res.redirect(302,process.env.SUPABASE_URL+'/storage/v1'+signed.signedURL);
 }
 if(method!=='POST')fail('Ação inválida.',404);
 if(action==='logout'){await db('portal_sessions?token_hash=eq.'+digest(token),'DELETE');res.setHeader('Set-Cookie','session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return res.json({ok:true});}
 if(action==='user-save'){
 admin(u);const username=cleanText(b.username,40).toLowerCase(),name=cleanText(b.name,100);if(!/^[a-z0-9_]{2,40}$/.test(username)||!name)fail('Nome ou usuário inválido.');
 let old;if(b.id){[old]=await db('portal_users?id=eq.'+id(b.id));if(!old)fail('Usuário não encontrado.',404);if(old.is_admin&&username!==old.username)fail('O login dos administradores é fixo.');}
 if(!old&&['vitor','marcelo'].includes(username))fail('Login reservado.');const data={username,name};if(b.password)data.password_hash=hash(cleanText(b.password,128));if(!old&&!data.password_hash)fail('Informe a senha.');
 await db('portal_users'+(old?'?id=eq.'+old.id:''),old?'PATCH':'POST',data);if(old&&b.password)await db('portal_sessions?user_id=eq.'+old.id,'DELETE');return res.json({ok:true});
 }
 if(action==='user-delete'){admin(u);const [old]=await db('portal_users?id=eq.'+id(b.id));if(!old||old.is_admin)fail('Os administradores iniciais não podem ser excluídos.');await db('portal_users?id=eq.'+old.id,'DELETE');return res.json({ok:true});}
 if(action==='upload'){
 const type=cleanText(b.type,100),name=cleanText(b.name,200);if(!['avatar','faq','tax','files'].includes(b.kind))fail('Destino inválido.');
 if(b.kind!=='files'&&!['image/png','image/jpeg','image/webp'].includes(type))fail('Use uma imagem PNG, JPG ou WebP.');
 if(typeof b.data!=='string'||b.data.length>2800000)fail('O limite é 2 MB.');const bytes=Buffer.from(b.data,'base64');if(bytes.length>2097152||!bytes.length)fail('Arquivo vazio ou maior que 2 MB.');
 const path=u.id+'/'+randomUUID()+'/'+name.replace(/[^a-zA-Z0-9._-]/g,'_');await storage('object/portal/'+path,'POST',bytes,type);
 if(b.kind==='avatar')await db('portal_users?id=eq.'+u.id,'PATCH',{avatar:path});return res.json({path});
 }
 if(action==='save'){
 if(!allowed.includes(b.kind))fail('Seção inválida.');let old;if(b.id){[old]=await db('portal_items?id=eq.'+id(b.id));if(!old||old.kind!==b.kind||(old.kind==='notes'&&old.owner_id!==u.id))fail('Registro não encontrado.',404);}
 const data={kind:b.kind,title:cleanText(b.title,180),content:cleanText(b.content||'',30000),url:b.url?url(b.url):'',color:['lime','yellow','blue','pink'].includes(b.color)?b.color:'lime',file_path:cleanText(b.file_path||'',500),owner_id:b.kind==='notes'?u.id:null};
 if(!data.title)fail('Informe um título.');if(['versions','drive'].includes(b.kind)&&!data.url)fail('Informe o link.');if(['files','tax'].includes(b.kind)&&!data.file_path)fail('Selecione um arquivo.');
 if(data.file_path&&data.file_path!==old?.file_path&&!data.file_path.startsWith(u.id+'/'))fail('Arquivo inválido.',403);
 return res.json(await db('portal_items'+(old?'?id=eq.'+old.id:''),old?'PATCH':'POST',data));
 }
 if(action==='delete'){const [item]=await db('portal_items?id=eq.'+id(b.id));if(!item||(item.kind==='notes'&&item.owner_id!==u.id))fail('Registro não encontrado.',404);await db('portal_items?id=eq.'+item.id,'DELETE');return res.json({ok:true});}
 if(action==='tax-current'){const [item]=await db('portal_items?id=eq.'+id(b.id)+'&kind=eq.tax');if(!item)fail('Tabela não encontrada.',404);await db('portal_settings?id=eq.1','PATCH',{current_tax:item.id});return res.json({ok:true});}
 fail('Ação não encontrada.',404);
 }catch(e){res.status(e.status||500).json({error:e.status?e.message:'Não foi possível concluir. Confira a conexão e a configuração do Supabase.'});}
}
