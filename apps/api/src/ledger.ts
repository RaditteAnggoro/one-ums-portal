import {Controller,Get,Param,Query,Req,Res,NotFoundException} from '@nestjs/common';
import type {Request,Response} from 'express';
import {z} from 'zod';
import {pool,transaction} from './db.js';
import {actorFor,audit,scope,scopeValues,type Actor} from './context.js';

async function budgetFor(actor:Actor,id:string){const budget=(await pool.query(`SELECT b.*,cc.team_id FROM budgets b JOIN cost_centres cc ON cc.id=b.cost_centre_id WHERE ${scope(actor,'cc')} AND b.id=$4`,[...scopeValues(actor),id])).rows[0];if(!budget)throw new NotFoundException('Anggaran tidak ditemukan.');return budget;}
const select=`SELECT l.*,u.name AS actor_name,r.campaign_id,m.channel FROM ledger l LEFT JOIN users u ON u.id=l.actor_id LEFT JOIN runs r ON r.id=l.run_id LEFT JOIN messages m ON m.id=l.message_id WHERE l.company_id=$1 AND l.budget_id=$2`;
export function csvCell(value:unknown){let text=value===null||value===undefined?'':String(value);if(/^\s*[=+\-@]/.test(text))text=`'${text}`;return `"${text.replaceAll('"','""')}"`;}
@Controller('budgets')
export class LedgerController{
  @Get(':id/ledger') async list(@Req() req:Request,@Param('id') id:string,@Query('page') page='0'){
    const a=await actorFor(req,'budgets:read');z.uuid().parse(id);const offset=z.coerce.number().int().min(0).max(100000).parse(page);await budgetFor(a,id);
    const [rows,total]=await Promise.all([pool.query(`${select} ORDER BY l.created_at DESC,l.id LIMIT 200 OFFSET $3`,[a.company_id,id,offset*200]),pool.query('SELECT count(*)::int AS total FROM ledger WHERE company_id=$1 AND budget_id=$2',[a.company_id,id])]);return {rows:rows.rows,page:offset,total:total.rows[0].total};
  }
  @Get(':id/ledger.csv') async export(@Req() req:Request,@Param('id') id:string,@Res() response:Response){
    const a=await actorFor(req,'budgets:read');z.uuid().parse(id);const budget=await budgetFor(a,id);
    const records=(await pool.query(`${select} ORDER BY l.created_at,l.id LIMIT 100001`,[a.company_id,id])).rows;
    if(records.length>100000){response.status(400).json({message:'Ekspor lokal dibatasi 100.000 entri. Gunakan rentang laporan yang lebih kecil.'});return;}
    await transaction(db=>audit(db,{...a,team_id:budget.team_id},'financial.ledger_exported','budget',id,{rows:records.length,simulated:budget.simulated}));
    const keys=['id','created_at','kind','amount','run_id','campaign_id','message_id','channel','actor_name','reason'];
    const lines=[keys.map(csvCell).join(','),...records.map(r=>keys.map(key=>csvCell(r[key] instanceof Date?r[key].toISOString():r[key])).join(','))];
    response.setHeader('Content-Type','text/csv; charset=utf-8');response.setHeader('Content-Disposition',`attachment; filename="budget-ledger-${id}.csv"`);response.send('\uFEFF'+lines.join('\r\n'));
  }
}
