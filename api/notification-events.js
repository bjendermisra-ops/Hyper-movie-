const {event}=require('../lib/notification-analytics');
let appCheck;
function verifier(){
  if(!appCheck){
    const {initializeApp,cert,getApps}=require('firebase-admin/app');
    const {getAppCheck}=require('firebase-admin/app-check');
    const account=JSON.parse(process.env.HADAPSAR_SERVICE_ACCOUNT||'null');
    if(account?.project_id!=='iskcon-hadapsar-645be')throw Error('App Check configuration missing');
    const app=getApps().find(a=>a.name==='notification-analytics')||initializeApp({credential:cert(account),projectId:account.project_id},'notification-analytics');
    appCheck=getAppCheck(app);
  }
  return appCheck;
}
module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const b=req.body;
  if(!b||typeof b!=='object'||!['received','displayed','clicked'].includes(b.event)||
    typeof b.notification_id!=='string'||!/^([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})$/i.test(b.notification_id)||
    typeof b.analytics_token!=='string'||!(/^[A-Za-z0-9_-]{32}$/).test(b.analytics_token)||
    typeof b.installation_id!=='string'||!(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i).test(b.installation_id))
    return res.status(400).json({error:'Invalid event'});
  const token=req.headers['x-firebase-appcheck'];
  if(typeof token!=='string'||!token||token.length>16384)return res.status(401).json({error:'Firebase App Check required'});
  try{
    const verified=await verifier().verifyToken(token);
    if(!verified.appId||!verified.appId.includes(':android:')||(process.env.ANALYTICS_ANDROID_APP_ID&&verified.appId!==process.env.ANALYTICS_ANDROID_APP_ID))return res.status(403).json({error:'Android app not authorized'});
  }catch{return res.status(401).json({error:'App Check verification failed'});}
  try{
    if(!await event({...b,notification_id:b.notification_id.toLowerCase(),installation_id:b.installation_id.toLowerCase()}))return res.status(404).json({error:'Unknown or untracked notification'});
    return res.status(200).json({success:true});
  }catch(e){console.error('notification-events: storage unavailable');return res.status(503).json({error:'Retry later'});}
};
