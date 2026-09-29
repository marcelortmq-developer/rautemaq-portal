const temporaryStatuses=new Set([502,503,504,520,521,522,523,524,544]);
const unavailable=()=>Object.assign(new Error('O serviço está temporariamente indisponível. Aguarde alguns instantes e tente novamente.'),{status:503});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

export async function db(path,method='GET',body){
 const base=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!base||!key)throw Object.assign(new Error('O serviço não está configurado. Contate o administrador.'),{status:503});
 // Only retry reads: a failed response does not mean a write was not committed.
 const attempts=method==='GET'?3:1;
 for(let attempt=0;attempt<attempts;attempt++){
  let r;
  try{
   r=await fetch(base+'/rest/v1/'+path,{method,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(5000)});
  }catch{
   console.error('Database request unavailable',{method,resource:path.split('?')[0],attempt:attempt+1});
   if(attempt+1<attempts){await delay(250*2**attempt);continue;}
   throw unavailable();
  }
  if(!r.ok){
   console.error('Database request failed',{status:r.status,method,resource:path.split('?')[0],attempt:attempt+1});
   const temporary=temporaryStatuses.has(r.status);
   await r.body?.cancel();
   if(temporary&&attempt+1<attempts){await delay(250*2**attempt);continue;}
   if(temporary)throw unavailable();
   throw new Error('Não foi possível salvar ou carregar os dados.');
  }
  try{return r.status===204?null:await r.json();}
  catch{
   console.error('Database response incomplete',{method,resource:path.split('?')[0],attempt:attempt+1});
   if(attempt+1<attempts){await delay(250*2**attempt);continue;}
   throw unavailable();
  }
 }
}
export async function storage(path,method,body,contentType='application/json'){
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 const r=await fetch(process.env.SUPABASE_URL+'/storage/v1/'+path,{method,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':contentType},body});
 if(!r.ok)throw new Error('Não foi possível acessar o arquivo.');return r.json();
}
