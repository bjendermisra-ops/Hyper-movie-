const crypto = require('node:crypto');
const {authorized,startSession}=require('../lib/access');
const send=require('./send-push');
const COLLECTION='hadapsar_auto_push';
const HOURS=Array.from({length:17},(_,i)=>i+5);
const DEFAULT={enabled:true,random:true,limit:3,hours:[5,8,12,18,21],custom:[]};
const templates=[
['🌅 हरे कृष्ण! सुप्रभात','आज के दिन की शुरुआत भगवान के स्मरण से करें।','index.html'],
['🙏 मंगलमय दिन','श्रीकृष्ण का नाम लें और दिन को भक्तिमय बनाएं।','index.html'],
['🌸 दर्शन का आनंद','कुछ क्षण भगवान के दर्शन और स्मरण के लिए निकालें।','daily_darshan.html'],
['📿 हरिनाम','आज कुछ समय हरिनाम जप के लिए समर्पित करें।','global_jap.html'],
['💛 कृष्ण स्मरण','व्यस्त दिन में भी भगवान को याद करने का एक अवसर निकालें।','index.html'],
['🪷 भक्ति का एक कदम','आज एक छोटा सा सत्कर्म भगवान को समर्पित करें।','index.html'],
['🎶 कीर्तन का आनंद','हरिनाम के साथ अपने मन को शांत और प्रसन्न करें।','index.html'],
['🙏 सेवा भाव','आज किसी की सहायता करें और प्रेम से सेवा करें।','dono.html'],
['🌼 मन की शांति','कुछ क्षण शांत बैठें और हरे कृष्ण महामंत्र का जप करें।','global_jap.html'],
['📖 आध्यात्मिक चिंतन','आज थोड़ा समय भगवद्गीता के अध्ययन के लिए निकालें।','index.html'],
['🕉️ हरिनाम संकीर्तन','हरे कृष्ण हरे कृष्ण, कृष्ण कृष्ण हरे हरे।','global_jap.html'],
['🌺 भक्तिमय संध्या','दिन के अंत में भगवान का आभार व्यक्त करें।','index.html'],
['🌙 शुभ रात्रि','श्रीकृष्ण का स्मरण करते हुए विश्राम करें। हरे कृष्ण!','index.html'],
['🪔 प्रेम और भक्ति','भगवान के प्रति प्रेम और सभी के प्रति करुणा रखें।','index.html'],
['🌿 आज की प्रेरणा','हर परिस्थिति में धैर्य, नम्रता और सेवा भाव बनाए रखें।','index.html'],
['🙏 कृतज्ञता','आज प्राप्त हर अवसर के लिए भगवान का धन्यवाद करें।','index.html'],
['🌷 हरे कृष्ण महाप्रभु','अपने घर में कुछ समय भक्तिमय वातावरण बनाएं।','index.html'],
['🎵 नाम की महिमा','हरिनाम कीर्तन सुनें और मन को भगवान की ओर लगाएं।','index.html'],
['💐 भक्तों का संग','आज परिवार के साथ भगवान की चर्चा करें।','index.html'],
['✨ भक्ति की प्रेरणा','छोटे-छोटे प्रयासों से अपनी साधना को नियमित बनाएं।','index.html'],
['🌻 प्रसन्न रहें','भगवान का स्मरण करें और अपने आसपास प्रेम बांटें।','index.html'],
['📿 जप का समय','थोड़ा समय निकालकर ध्यान से महामंत्र का जप करें।','global_jap.html'],
['🌸 आज का संकल्प','आज अपने कार्य प्रेम और ईमानदारी से करें।','index.html'],
['🙏 प्रभु का स्मरण','अपने परिवार के साथ कुछ क्षण प्रार्थना करें।','index.html']
];
const {MongoClient}=require('mongodb');
let clientPromise;
async function token(){
 if(!process.env.AUTO_MONGO_URI)throw Error('Database configuration missing');
 if(!clientPromise){const client=new MongoClient(process.env.AUTO_MONGO_URI,{serverSelectionTimeoutMS:8000,connectTimeoutMS:8000,maxPoolSize:3});clientPromise=client.connect().catch(e=>{clientPromise=null;throw e})}
 const client=await clientPromise;return client.db('hadapsar_auto').collection('notifications');
}
async function db(c,path,method='GET',body){
 const [part,query='']=path.split('?');const id=part.split('/')[1];
 if(method==='GET'){
  if(!id){await c.findOne({}, {projection:{_id:1}});return {status:200,ok:true,j:{}}}
  const d=await c.findOne({_id:id});return d?{status:200,ok:true,j:{fields:{payload:field(d.payload)}}}:{status:404,ok:false,j:{}};
 }
 const payload=JSON.parse(body.fields.payload.stringValue);
 if(method==='PATCH'){await c.updateOne({_id:id},{$set:{payload}},{upsert:true});return {status:200,ok:true,j:{}}}
 if(method==='POST'){const key=new URLSearchParams(query).get('documentId');try{await c.insertOne({_id:key,payload});return {status:200,ok:true,j:{}}}catch(e){if(e.code===11000)return {status:409,ok:false,j:{}};throw e}}
 throw Error('Unsupported database operation');
}
async function ready(c){await c.findOne({}, {projection:{_id:1}})}
function field(v){return {stringValue:JSON.stringify(v)}}
function unpack(x){return JSON.parse(x.fields.payload.stringValue)}
function valid(x){
 if(!x||typeof x.enabled!=='boolean'||typeof x.random!=='boolean'||!Number.isInteger(x.limit)||x.limit<1||x.limit>5||!Array.isArray(x.hours)||!x.hours.length||x.hours.some(h=>!HOURS.includes(h)))throw Error('Invalid settings');
 if(!Array.isArray(x.custom)||x.custom.length>50)throw Error('Invalid custom messages');
 const custom=x.custom.map(m=>{if(!m||typeof m.title!=='string'||typeof m.body!=='string'||!m.title.trim()||!m.body.trim()||m.title.length>100||m.body.length>250)throw Error('Invalid custom message');return {title:m.title.trim(),body:m.body.trim(),actionUrl:'index.html'}});
 const mode=x.mode==='custom'?'custom':'hourly';
 const times=Array.isArray(x.times)?[...new Set(x.times)].sort():[];
 if(times.some(t=>typeof t!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(t))||times.length>5||(mode==='custom'&&(!times.length||times.length>x.limit)))throw Error('Choose 1 to daily limit custom times');
 return {enabled:x.enabled,random:x.random,limit:x.limit,hours:[...new Set(x.hours)].sort((a,b)=>a-b),custom,mode,times,customSince:Number.isSafeInteger(x.customSince)?x.customSince:0};
}
async function settings(t){const r=await db(t,COLLECTION+'/settings');if(r.status===404){await ready(t);return valid(DEFAULT)}if(!r.ok)throw Error('Settings read failed');return valid(unpack(r.j))}
async function save(t,x){const r=await db(t,COLLECTION+'/settings','PATCH',{fields:{payload:field(x)}});if(!r.ok)throw Error('Settings save failed');}
function india(){const d=new Date(Date.now()+19800000);return {day:d.toISOString().slice(0,10),hour:d.getUTCHours(),minute:d.getUTCMinutes()}}
function rank(s){return crypto.createHash('sha256').update(s).digest('hex')}
function selected(s,day){return (s.random?[...s.hours].sort((a,b)=>rank(day+':'+a).localeCompare(rank(day+':'+b))):s.hours).slice(0,s.limit)}
function message(s,day,h){const pool=templates.map(([title,body,actionUrl])=>({title,body,actionUrl})).concat(s.custom);
 const ordinal=Math.floor(Date.parse(day+'T00:00:00Z')/86400000);const n=s.random?parseInt(rank(day+':'+h+':message').slice(0,8),16)%pool.length:((ordinal*17+h)%pool.length+pool.length)%pool.length;return pool[n]}
async function deliver(p){let result;const res={status(n){this.code=n;return this},json(x){result={code:this.code||200,data:x};return this},end(){return this}};await send({method:'POST',body:{app:'hadapsar',topic:'all',title:p.title,body:p.body,actionUrl:p.actionUrl,isLoudAlert:false}},res);return result||{code:500,data:{success:false,reason:'No FCM response'}}}
function safeEq(a,b){return typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b))}
async function claim(t,id,p,limit){
 const dayId='day_'+p.day;
 try{await t.updateOne({_id:dayId},{$setOnInsert:{count:0,slots:[]}},{upsert:true})}catch(e){if(e.code!==11000)throw e}
 const r=await t.updateOne({_id:dayId,count:{$lt:limit},slots:{$ne:p.slot??p.hour}},{$inc:{count:1},$addToSet:{slots:p.slot??p.hour}});
 if(!r.modifiedCount)return false;
 await t.insertOne({_id:id,payload:p});return true;
}
async function log(t,id,p){const r=await db(t,COLLECTION+'/'+id,'PATCH',{fields:{payload:field(p)}});if(!r.ok)console.error('auto-push: log write failed',id,r.status)}
const OIDC_ISSUER='https://token.actions.githubusercontent.com';
const OIDC_AUD='hadapsar-auto-push';
async function trustedWorkflow(header){
 try{
  if(typeof header!=='string'||!header.startsWith('Bearer ')||header.length>20000)return false;
  const parts=header.slice(7).split('.');if(parts.length!==3)return false;
  const j=JSON.parse(Buffer.from(parts[0],'base64url')),p=JSON.parse(Buffer.from(parts[1],'base64url'));
  const now=Math.floor(Date.now()/1000);
  if(j.alg!=='RS256'||typeof j.kid!=='string'||p.iss!==OIDC_ISSUER||p.aud!==OIDC_AUD||p.repository_id!=='1400948244'||p.repository!=='bjendermisra-ops/Hyper-movie-'||p.ref!=='refs/heads/main'||p.event_name!=='schedule'||p.workflow_ref!=='bjendermisra-ops/Hyper-movie-/.github/workflows/auto-notify.yml@refs/heads/main'||typeof p.exp!=='number'||p.exp<=now||typeof p.nbf!=='number'||p.nbf>now+30)return false;
  const r=await fetch(OIDC_ISSUER+'/.well-known/jwks',{signal:AbortSignal.timeout(5000)});if(!r.ok)return false;
  const keys=await r.json(),key=keys.keys.find(k=>k.kid===j.kid&&k.kty==='RSA');
  return !!key&&crypto.verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),crypto.createPublicKey({key,format:'jwk'}),Buffer.from(parts[2],'base64url'));
 }catch{return false}
}
async function runCustom(t,s,source){
 if(!s.enabled||s.mode!=='custom')return {skipped:'custom schedule inactive'};
 const {day,hour,minute}=india(),now=Date.now(),results=[];
 // Only send once due; expired slots are not replayed. Both schedulers share the same atomic lock.
 for(const time of s.times){
  const [hh,mm]=time.split(':').map(Number),delay=hour*60+minute-hh*60-mm;
  const due=Date.parse(day+'T'+time+':00+05:30');
  if(delay<0||delay>90||due<s.customSince)continue;
  const p=message(s,day,hh*60+mm),id='slot_'+day+'_custom_'+time.replace(':','');
  const entry={day,hour:hh,slot:time,title:p.title,status:'attempted',source,at:new Date(now).toISOString()};
  if(!await claim(t,id,entry,s.limit))continue;
  const out=await deliver(p);await log(t,id,{...entry,status:out.data.success?'FCM accepted':'failed',reason:out.data.reason||null,messageId:out.data.messageId||null});
  results.push({slot:time,accepted:!!out.data.success});
 }
 return {results};
}
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 const action=req.query?.action;
 try{
  if(req.method==='GET'&&action==='health'){try{const t=await token();await ready(t);return res.status(200).json({storage:'ready',schedulerConfigured:!!process.env.CRON_SECRET})}catch(e){return res.status(503).json({storage:'unavailable',reason:'Database connection unavailable',schedulerConfigured:!!process.env.CRON_SECRET})}}
  if(req.method==='POST'&&action==='tick'){
   if(!await trustedWorkflow(req.headers.authorization))return res.status(401).json({error:'Unauthorized scheduler'});
   const t=await token(),s=await settings(t);const out=await runCustom(t,s,'github-actions');
   return res.status(out.results?.some(x=>!x.accepted)?502:200).json(out);
  }
  if(req.method==='GET'&&req.query?.slot!==undefined){
   if(!process.env.CRON_SECRET||!safeEq(req.headers.authorization,'Bearer '+process.env.CRON_SECRET))return res.status(401).json({error:'Unauthorized'});
   const h=Number(req.query.slot);if(!Number.isInteger(h)||h<0||h>23)return res.status(400).json({error:'Invalid slot'});
   const {day,hour}=india();if(hour!==h&&hour!==(h+23)%24)return res.status(200).json({skipped:'outside scheduled window'});
   const t=await token(),s=await settings(t);if(s.mode==='custom'){const out=await runCustom(t,s,'vercel-fallback');return res.status(out.results?.some(x=>!x.accepted)?502:200).json(out)}if(!HOURS.includes(h)||!s.enabled||!selected(s,day).includes(h))return res.status(200).json({skipped:'not selected'});
   const p=message(s,day,h),id='slot_'+day+'_'+h;const entry={day,hour:h,title:p.title,status:'attempted',at:new Date().toISOString()};
   if(!await claim(t,id,entry,s.limit))return res.status(200).json({skipped:'already attempted or daily limit reached'});
   const out=await deliver(p);await log(t,id,{...entry,status:out.data.success?'FCM accepted':'failed',reason:out.data.reason||null,messageId:out.data.messageId||null});
   return res.status(out.data.success?200:502).json({accepted:!!out.data.success});
  }
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  if(req.body?.action==='session')return startSession(req,res,process.env.AUTO_ADMIN_INVITE);
  if(!authorized(req))return res.status(401).json({error:'Open your private access link to continue'});
  const t=await token();await ready(t);
  if(req.body?.action==='save'){const s=valid(req.body.settings),previous=await settings(t);s.customSince=previous.mode!==s.mode||JSON.stringify(previous.times)!==JSON.stringify(s.times)||!previous.enabled&&s.enabled?Date.now():previous.customSince;await save(t,s);return res.status(200).json({settings:s})}
  const s=await settings(t);const {day,hour}=india();
  if(req.body?.action==='random'){const pool=templates.map(([title,body,actionUrl])=>({title,body,actionUrl})).concat(s.custom);return res.status(200).json({message:pool[crypto.randomInt(pool.length)]})}
  if(req.body?.action==='status'){
   const rows=await t.find({_id:{$regex:'^slot_'+day+'_'}}).sort({'payload.at':1}).limit(30).toArray();
   const logs=rows.map(r=>r.payload);
   return res.status(200).json({settings:s,planned:s.mode==='custom'?s.times:selected(s,day),logs,poolSize:templates.length+s.custom.length})}
  return res.status(400).json({error:'Unknown action'});
 }catch(e){console.error('auto-push:',e.message);return res.status(503).json({error:e.message==='Invalid settings'||e.message==='Invalid custom messages'||e.message==='Invalid custom message'||e.message==='Choose 1 to daily limit custom times'?e.message:'Automation unavailable; check server configuration and logs'})}
};
