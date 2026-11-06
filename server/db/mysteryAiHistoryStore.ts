import type {Pool,PoolClient} from 'pg';
import {isAiReplyStyle,redactAiSavedText} from '../../shared/mysteryAiPrivacy.js';

const table='mysteryhub_ai_private';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export class AiHistoryError extends Error {
  constructor(readonly status:number,message:string){super(message);}
}
const notFound=()=>new AiHistoryError(404,'Saved chat not found.');
const validId=(value:unknown)=>{
  if(typeof value!=='string'||!uuid.test(value))throw new AiHistoryError(400,'Invalid chat identifier.');
  return value;
};
const safeText=(value:unknown,max:number)=>{
  if(typeof value!=='string'||!value.trim()||value.length>max||value.includes('\0'))throw new AiHistoryError(400,'Invalid chat text.');
  return redactAiSavedText(value.trim()).slice(0,max);
};

export class AiHistoryStore {
  constructor(private db:Pool){}
  private async scoped<T>(owner:string,work:(client:PoolClient)=>Promise<T>,lock=false):Promise<T> {
    const client=await this.db.connect();
    try {
      await client.query('BEGIN');
      await client.query("SET LOCAL lock_timeout = '2s'; SET LOCAL statement_timeout = '5s'");
      const active=await client.query(`SELECT id FROM public.users WHERE id=$1 AND role='customer' AND status='active' AND NOT must_change_password ${lock?'FOR UPDATE':'FOR SHARE'}`,[owner]);
      if(!active.rowCount)throw new AiHistoryError(403,'Saved chats require an active customer account.');
      const result=await work(client);
      await client.query('COMMIT');
      return result;
    } catch(error) {
      await client.query('ROLLBACK').catch(()=>{});
      throw error;
    } finally {client.release();}
  }
  list(owner:string){
    return this.scoped(owner,async c=>{
      const {rows}=await c.query(`SELECT id,title,updated_at AS "updatedAt" FROM ${table}.conversations WHERE owner_id=$1 ORDER BY updated_at DESC,id LIMIT 20`,[owner]);
      const style=(await c.query(`SELECT style FROM ${table}.preferences WHERE owner_id=$1`,[owner])).rows[0]?.style;
      return {conversations:rows,style:isAiReplyStyle(style)?style:null};
    });
  }
  create(owner:string,id:unknown,title:unknown){
    const conversationId=validId(id), label=safeText(title,80);
    return this.scoped(owner,async c=>{
      const existing=(await c.query(`SELECT id,title FROM ${table}.conversations WHERE id=$1 AND owner_id=$2`,[conversationId,owner])).rows[0];
      if(existing)return existing;
      const count=(await c.query(`SELECT count(*)::int AS count FROM ${table}.conversations WHERE owner_id=$1`,[owner])).rows[0].count;
      if(count>=20)throw new AiHistoryError(409,'You have 20 saved chats. Delete one before creating another.');
      const created=(await c.query(`INSERT INTO ${table}.conversations(id,owner_id,title) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING id,title`,[conversationId,owner,label])).rows[0];
      if(!created)throw new AiHistoryError(409,'Could not start this chat. Try again.');
      return created;
    },true);
  }
  read(owner:string,id:unknown){
    const chatId=validId(id);
    return this.scoped(owner,async c=>{
      const chat=(await c.query(`SELECT id,title FROM ${table}.conversations WHERE id=$1 AND owner_id=$2 FOR SHARE`,[chatId,owner])).rows[0];
      if(!chat)throw notFound();
      const {rows}=await c.query(`SELECT request_id AS id,question,reply,created_at AS "createdAt" FROM ${table}.turns WHERE conversation_id=$1 ORDER BY position LIMIT 50`,[chatId]);
      return {...chat,turns:rows};
    });
  }
  append(owner:string,id:unknown,input:unknown){
    const chatId=validId(id);
    const body=input as {requestId?:unknown;question?:unknown;reply?:unknown}|null;
    const requestId=validId(body?.requestId), question=safeText(body?.question,2000), reply=safeText(body?.reply,4000);
    return this.scoped(owner,async c=>{
      const chat=await c.query(`SELECT id FROM ${table}.conversations WHERE id=$1 AND owner_id=$2 FOR UPDATE`,[chatId,owner]);
      if(!chat.rowCount)throw notFound();
      const old=(await c.query(`SELECT question,reply FROM ${table}.turns WHERE conversation_id=$1 AND request_id=$2`,[chatId,requestId])).rows[0];
      if(old){
        if(old.question!==question||old.reply!==reply)throw new AiHistoryError(409,'This turn was already saved with different text.');
        return {saved:true};
      }
      const position=(await c.query(`SELECT COALESCE(max(position),0)+1 AS next FROM ${table}.turns WHERE conversation_id=$1`,[chatId])).rows[0].next;
      if(position>50)throw new AiHistoryError(409,'This chat has reached 50 turns. Start a new chat to keep saving replies.');
      await c.query(`INSERT INTO ${table}.turns(conversation_id,request_id,position,question,reply) VALUES ($1,$2,$3,$4,$5)`,[chatId,requestId,position,question,reply]);
      await c.query(`UPDATE ${table}.conversations SET updated_at=now() WHERE id=$1 AND owner_id=$2`,[chatId,owner]);
      return {saved:true};
    });
  }
  rename(owner:string,id:unknown,title:unknown){
    const chatId=validId(id), label=safeText(title,80);
    return this.scoped(owner,async c=>{
      const row=(await c.query(`UPDATE ${table}.conversations SET title=$3 WHERE id=$1 AND owner_id=$2 RETURNING id,title`,[chatId,owner,label])).rows[0];
      if(!row)throw notFound();
      return row;
    });
  }
  remove(owner:string,id:unknown){
    const chatId=validId(id);
    return this.scoped(owner,async c=>{
      const {rowCount}=await c.query(`DELETE FROM ${table}.conversations WHERE id=$1 AND owner_id=$2`,[chatId,owner]);
      if(!rowCount)throw notFound();
      return {deleted:true};
    });
  }
  setStyle(owner:string,style:unknown){
    if(style!==null&&!isAiReplyStyle(style))throw new AiHistoryError(400,'Select a supported reply style.');
    return this.scoped(owner,async c=>{
      if(style===null)await c.query(`DELETE FROM ${table}.preferences WHERE owner_id=$1`,[owner]);
      else await c.query(`INSERT INTO ${table}.preferences(owner_id,style) VALUES ($1,$2) ON CONFLICT (owner_id) DO UPDATE SET style=EXCLUDED.style`,[owner,style]);
      return {style};
    },true);
  }
}
