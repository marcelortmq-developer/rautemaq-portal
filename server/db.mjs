export async function db(path,method='GET',body){
 const base=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!base||!key)throw Object.assign(new Error('Configure o Supabase para entrar no portal.'),{status:503});
 const r=await fetch(base+'/rest/v1/'+path,{method,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body)});
 if(!r.ok){console.error('Database request failed',r.status);throw new Error('Não foi possível salvar ou carregar os dados.');}return r.status===204?null:r.json();
}
export async function storage(path,method,body,contentType='application/json'){
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 const r=await fetch(process.env.SUPABASE_URL+'/storage/v1/'+path,{method,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':contentType},body});
 if(!r.ok)throw new Error('Não foi possível acessar o arquivo.');return r.json();
}
