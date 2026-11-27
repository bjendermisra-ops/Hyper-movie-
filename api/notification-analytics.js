const {authorized,startSession}=require('../lib/access');
const {history}=require('../lib/notification-analytics');
module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Robots-Tag','noindex, nofollow');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  if(req.body?.action==='session')return startSession(req,res);
  if(!authorized(req))return res.status(401).json({error:'Admin access required'});
  const before=req.body?.before?new Date(req.body.before):null;
  if(before&&!Number.isFinite(before.getTime()))return res.status(400).json({error:'Invalid cursor'});
  try{return res.status(200).json(await history(before));}
  catch(e){console.error('analytics: storage unavailable');return res.status(503).json({error:'Analytics database unavailable'});}
};
