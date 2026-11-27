const crypto = require('node:crypto');
let pending;
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
async function database() {
  if (!process.env.AUTO_MONGO_URI) throw Error('Analytics storage not configured');
  if (!pending) {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(process.env.AUTO_MONGO_URI,{serverSelectionTimeoutMS:2000,connectTimeoutMS:2000,socketTimeoutMS:3000,waitQueueTimeoutMS:2000,maxPoolSize:4});
    pending = client.connect().then(async c => {
      const db=c.db('hadapsar_auto');
      await db.collection('push_device_events').createIndex({notificationId:1});
      await db.collection('push_campaigns').createIndex({createdAt:-1,_id:-1});
      return db;
    }).catch(async e=>{pending=undefined;await client.close().catch(()=>{});throw e});
  }
  return pending;
}
async function begin(meta, data, maxBytes) {
  const id=crypto.randomUUID(), token=crypto.randomBytes(24).toString('base64url');
  const fields={notification_id:id,analytics_token:token};
  const tracking=Buffer.byteLength(JSON.stringify({...data,...fields}),'utf8')<=maxBytes;
  const db=await database();
  await db.collection('push_campaigns').insertOne({_id:id,...meta,createdAt:new Date(),status:'attempting',tracking,tokenHash:tracking?digest(token):null});
  return {id,fields:tracking?fields:{},tracking};
}
async function finish(id,status,extra={}) {
  if (!id) return;
  const db=await database();
  await db.collection('push_campaigns').updateOne({_id:id},{$set:{status,...extra,updatedAt:new Date()}});
}
async function event({notification_id,analytics_token,installation_id,event}) {
  const db=await database();
  const c=await db.collection('push_campaigns').findOne({_id:notification_id,tracking:true,status:{$in:['attempting','accepted','unknown']}},{projection:{tokenHash:1}});
  if(!c||c.tokenHash!==digest(analytics_token))return false;
  const device=digest(notification_id+':'+installation_id);
  const key=notification_id+':'+device;
  const now=new Date();
  const update={$setOnInsert:{notificationId:notification_id,firstReportAt:now},$min:{[event+'At']:now}};
  const collection=db.collection('push_device_events');
  try{await collection.updateOne({_id:key},update,{upsert:true});}
  catch(e){if(e.code!==11000)throw e;await collection.updateOne({_id:key},update);}
  return true;
}
async function history(before) {
  const db=await database();
  const filter=before?{createdAt:{$lt:before}}:{};
  const rows=await db.collection('push_campaigns').find(filter,{projection:{tokenHash:0}}).sort({createdAt:-1,_id:-1}).limit(50).toArray();
  const ids=rows.map(r=>r._id);
  const grouped=ids.length?await db.collection('push_device_events').aggregate([
    {$match:{notificationId:{$in:ids}}},
    {$group:{_id:'$notificationId',
      received:{$sum:{$cond:[{$ne:[{$ifNull:['$receivedAt',null]},null]},1,0]}},
      displayed:{$sum:{$cond:[{$ne:[{$ifNull:['$displayedAt',null]},null]},1,0]}},
      clicked:{$sum:{$cond:[{$ne:[{$ifNull:['$clickedAt',null]},null]},1,0]}},
      receivedAndClicked:{$sum:{$cond:[{$and:[{$ne:[{$ifNull:['$receivedAt',null]},null]},{$ne:[{$ifNull:['$clickedAt',null]},null]}]},1,0]}}
    }}
  ]).toArray():[];
  const counts=new Map(grouped.map(x=>[x._id,x]));
  return {items:rows.map(r=>{const g=counts.get(r._id);return {...r,counts:r.tracking?{received:g?.received||0,displayed:g?.displayed||0,clicked:g?.clicked||0,receivedAndClicked:g?.receivedAndClicked||0}:null,ctr:g?.received?100*g.receivedAndClicked/g.received:null}}),next:rows.length===50?rows[49].createdAt.toISOString():null};
}
module.exports={begin,finish,event,history,database};
