import {randomBytes,scryptSync,timingSafeEqual,createHash} from 'node:crypto';
export const digest=v=>createHash('sha256').update(v).digest('hex');
export function hash(password){const salt=randomBytes(16).toString('hex');return salt+':'+scryptSync(password,salt,64).toString('hex');}
export function verify(password,value){try{const [salt,key]=value.split(':');return timingSafeEqual(Buffer.from(key,'hex'),scryptSync(password,salt,64));}catch{return false;}}
export function cleanText(v,max=10000){if(typeof v!=='string'||v.length>max)throw Object.assign(new Error('Texto inválido ou muito longo.'),{status:400});return v.trim();}
export function url(v){const s=cleanText(v,2048);try{const u=new URL(s);if(!['https:','http:'].includes(u.protocol))throw 0;return u.href;}catch{throw Object.assign(new Error('Informe um link http ou https válido.'),{status:400});}}
