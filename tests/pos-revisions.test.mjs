import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {createRequire} from 'node:module';
const be=createRequire(new URL('../../Back-end/apps/package.json',import.meta.url));
const runtime=be('@prisma/client/runtime/client');
const Prisma={Decimal:runtime.Decimal,sql:runtime.sqltag,PrismaClientKnownRequestError:runtime.PrismaClientKnownRequestError,TransactionIsolationLevel:{Serializable:'Serializable'}};
const D=v=>new Prisma.Decimal(v);
function load(file,require=be,globals={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require,Date,Map,Set,URLSearchParams,Uint8Array,Uint8ClampedArray,...globals});return exports;}
const business='10000000-0000-4000-8000-000000000001',id='10000000-0000-4000-8000-000000000002',barber='10000000-0000-4000-8000-000000000003';
function routes(file,prisma,role='OWNER'){
 const require=p=>p.includes('prisma/client')?{Prisma}:p.includes('config/database')?{prisma}:p.includes('role.middleware')?{requireRole:(...roles)=>async(c,next)=>roles.includes(c.get('auth').role)?next():c.json({message:'Forbidden'},403)}:p.includes('utils/response')?{response:{success:(message,data)=>({message,data}),error:message=>({message})}}:be(p);
 const loaded=load(file,require);const {Hono}=be('hono');const app=new Hono();app.use('*',async(c,next)=>{c.set('auth',{businessId:business,userId:id,role});await next();});app.route('/',loaded.default);return {app,module:loaded};
}
const reportFile='../Back-end/apps/src/modules/business-reports/business-reports.route.ts';
test('monthly handles deduplicate repeated services per visit and customer, with WIB boundaries',async()=>{
 let query;const transaction={customerId:id,invoiceNumber:'POS-1',completedAt:new Date('2026-10-02T00:00:00Z'),customer:{name:'Malik'},outlet:{name:'Outlet'}};
 const row={barberId:barber,barber:{name:'Andi'},quantity:D(1),total:D(50000),transactionId:'sale1',transaction};
 const {app,module}=routes(reportFile,{posTransactionItem:{findMany:async q=>{query=q;return[row,row,{...row,transactionId:'sale2',transaction:{...transaction,invoiceNumber:'POS-2'}}];}}});
 const res=await app.request('/customer-handles?month=2026-10');assert.equal(res.status,200);const {data}=await res.json();assert.equal(data.summary[0].visits,2);assert.equal(data.summary[0].uniqueCustomers,1);assert.equal(data.summary[0].services,'3');assert.equal(data.rows.length,2);assert.equal(query.where.businessId,business);assert.equal(query.where.transaction.status,'COMPLETED');assert.equal(module.monthWindow('2026-10').start.toISOString(),'2026-09-30T17:00:00.000Z');assert.equal(module.monthWindow('2026-12').end.toISOString(),'2026-12-31T17:00:00.000Z');
 assert.equal((await app.request('/customer-handles?month=2026-13')).status,400);
});
test('owner reports deny cashier access and invalid filters before database reads',async()=>{
 const {app}=routes(reportFile,{},'CASHIER');assert.equal((await app.request('/cash-book?month=2026-10')).status,403);
 const owner=routes(reportFile,{}).app;assert.equal((await owner.request('/cash-book?month=2026-10&outletId='+id)).status,400);assert.equal((await owner.request('/cash-book?month=2026-10&page=0')).status,400);
});
test('master discounts and commission routes validate ranges and preserve tenant scope',async()=>{
 let where;const file='../Back-end/apps/src/modules/pos-settings/pos-settings.route.ts';const {app,module}=routes(file,{discountMaster:{updateMany:async q=>{where=q.where;return{count:0};}}});
 const value={name:'Promo',target:'PRODUCT',type:'PERCENTAGE',value:'101',isActive:true};assert.equal(module.discountSchema.safeParse(value).success,false);assert.equal(module.ruleSchema.safeParse({type:'FIXED',value:'-1',isActive:true}).success,false);
 const res=await app.request('/discounts/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({...value,value:'10'})});assert.equal(res.status,404);assert.equal(where.businessId,business);
 assert.equal((await routes(file,{},'CASHIER').app.request('/discounts',{method:'POST'})).status,403);
});
test('product commission uses net discounted price, fixed quantity, and caps amount; no service query',async()=>{
 let itemQuery;const saved=[];const tx={posTransactionItem:{findMany:async q=>{itemQuery=q;return[{id:'a',productId:id,barberId:barber,quantity:D(2),total:D(70000)},{id:'b',productId:business,barberId:barber,quantity:D('.125'),total:D(10000)}];}},productCommissionRule:{findMany:async()=>[{productId:id,type:'FIXED',value:D(40000)},{productId:business,type:'PERCENTAGE',value:D(10)}]},barberCommissionEntry:{create:async q=>{saved.push(q.data);}}};
 const service=load('../Back-end/apps/src/modules/commissions/commission-entry.service.ts',()=>({Prisma})).CommissionEntryService;
 await service.recordForCheckout(tx,business,id);assert.equal(itemQuery.where.type,'PRODUCT');assert.equal(saved[0].amount.toString(),'70000');assert.equal(saved[1].amount.toString(),'1000');assert.equal(saved[0].baseAmount.toString(),'70000');
 tx.productCommissionRule.findMany=async()=>[];saved.length=0;await service.recordForCheckout(tx,business,id);assert.equal(saved.length,0);
});
function checkoutHarness(rule){const saved={items:[]};const tx={posTransaction:{findFirst:async()=>null,create:async q=>{saved.sale=q.data;return{id,invoiceNumber:'POS-X'};},findUniqueOrThrow:async()=>saved.sale},outlet:{findFirst:async()=>({id})},stockLocation:{findFirst:async()=>({id})},cashierShift:{findFirst:async()=>({id}),updateMany:async()=>({count:1})},customer:{findFirst:async()=>null,create:async q=>{saved.customer=q.data;return{id};}},outletServicePrice:{findFirst:async()=>({serviceId:id,price:D(50000),service:{id,code:'CUT',name:'Cut',serviceRecipe:null}})},barber:{findFirst:async()=>({id:barber})},discountMaster:{findFirst:async()=>rule},product:{findMany:async()=>[]},productStock:{findMany:async()=>[]},posTransactionItem:{create:async q=>{saved.items.push(q.data);return{id};}},posPayment:{findFirst:async()=>null,create:async q=>{saved.payment=q.data;}}};
 const service=load('../Back-end/apps/src/modules/pos/pos.service.ts',p=>p.includes('database')?{prisma:{$transaction:async cb=>cb(tx)}}:p.includes('commission-entry')?{CommissionEntryService:{recordForCheckout:async()=>{}}}:{Prisma}).PosService;
 const input={requestId:id,outletId:id,customer:{name:'Malik',phone:null,address:'Jl. A'},items:[{type:'SERVICE',serviceId:id,barberId:barber,quantity:2,discountId:id}],discount:{type:'NONE'},payment:{method:'QRIS',confirmed:true},expectedTotal:'90000'};
 return{saved,tx,service,input,auth:{businessId:business,userId:id,role:'CASHIER'}};
}
test('real checkout saves inline customer, item discount snapshot and automatic GoPay reference',async()=>{const h=checkoutHarness({target:'SERVICE',type:'PERCENTAGE',value:D(10),name:'Promo 10%'});await h.service.checkout(h.auth,h.input);assert.equal(h.saved.customer.address,'Jl. A');assert.equal(h.saved.sale.customerId,id);assert.equal(h.saved.sale.grandTotal.toString(),'90000');assert.equal(h.saved.items[0].discountAmount.toString(),'10000');assert.equal(h.saved.items[0].discountName,'Promo 10%');assert.equal(h.saved.payment.reference,'GOPAY-'+id);});
test('checkout rejects wrong-scope discount and stale total before payment or sale write',async()=>{const h=checkoutHarness({target:'PRODUCT',type:'FIXED',value:D(1000),name:'Produk'});await assert.rejects(h.service.checkout(h.auth,h.input),/jenis item/);assert.equal(h.saved.sale,undefined);h.tx.discountMaster.findFirst=async()=>({target:'SERVICE',type:'FIXED',value:D(5000),name:'Promo'});await assert.rejects(h.service.checkout(h.auth,h.input),/berubah/);assert.equal(h.saved.payment,undefined);});
test('thermal raster packs black dots correctly, keeps transparent pixels white, and splits bands',()=>{const receipt=load('lib/receipt.ts');const thermal=load('lib/thermal.ts',()=>receipt);const rgba=new Uint8ClampedArray(8*129*4);rgba.fill(255);rgba[0]=rgba[1]=rgba[2]=0;rgba[4]=rgba[5]=rgba[6]=0;rgba[7]=0;const bytes=thermal.rasterCommands(rgba,8,129);assert.deepEqual(Array.from(bytes.slice(0,13)),[27,64,27,97,0,29,118,48,0,1,0,128,0]);assert.equal(bytes[13],128);assert.deepEqual(Array.from(bytes.slice(141,149)),[29,118,48,0,1,0,1,0]);assert.deepEqual(Array.from(bytes.slice(-3)),[27,100,4]);});

// Optional real PostgreSQL verification. All fixtures are TEMP tables and rolled back.
test('cash book SQL: opening balance, GoPay, refund and expense deduplication', {skip:process.env.TRIMORA_TEST_DATABASE!=='1'},async()=>{
 process.loadEnvFile('../Back-end/apps/.env');const {Client}=be('pg');const client=new Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:5000});await client.connect();
 try{await client.query('BEGIN');const {app}=routes(reportFile,{$queryRaw:async q=>(await client.query(q.text,q.values)).rows});
 // First validate SQL against actual table definitions without reading any tenant's data.
 const schemaCheck=await app.request('/cash-book?month=2026-10');assert.equal(schemaCheck.status,200);
 await client.query(`CREATE TEMP TABLE businesses (id uuid PRIMARY KEY); CREATE TEMP TABLE products (id uuid,"businessId" uuid,UNIQUE("businessId",id)); CREATE TEMP TABLE customers (id uuid); CREATE TEMP TABLE pos_transaction_items (id uuid); SET LOCAL search_path = pg_temp, public;`);
 const migration=fs.readFileSync('../Back-end/apps/prisma/migrations/20261016090000_pos_customer_discounts_product_commissions/migration.sql','utf8');
 await client.query(migration.replaceAll('CREATE TABLE','CREATE TEMP TABLE'));
 await client.query('INSERT INTO businesses VALUES ($1)',[business]);
 await client.query(`INSERT INTO discount_masters (id,"businessId",name,target,type,value,"updatedAt") VALUES ($1,$2,'Promo','BOTH','PERCENTAGE',10,NOW())`,[id,business]);
 await client.query('SAVEPOINT invalid_discount');
 await assert.rejects(client.query('UPDATE discount_masters SET value=101 WHERE id=$1',[id]),e=>e.code==='23514');
 await client.query('ROLLBACK TO SAVEPOINT invalid_discount');
 await client.query(`CREATE TEMP TABLE pos_transactions (id uuid,"businessId" uuid,"invoiceNumber" text);
 CREATE TEMP TABLE pos_payments (id uuid,"businessId" uuid,"transactionId" uuid,"createdAt" timestamp,method text,amount numeric);
 CREATE TEMP TABLE pos_refunds (id uuid,"businessId" uuid,"completedAt" timestamp,"refundNumber" text,method text,amount numeric,status text);
 CREATE TEMP TABLE cash_movements (id uuid,"businessId" uuid,"createdAt" timestamp,"movementNumber" text,description text,direction text,amount numeric,"expenseId" uuid);
 CREATE TEMP TABLE expenses (id uuid,"businessId" uuid,"expenseDate" timestamp,"expenseNumber" text,description text,method text,amount numeric,status text,"voidedAt" timestamp);
 CREATE TEMP TABLE barber_commission_payouts (id uuid,"businessId" uuid,"createdAt" timestamp,"payoutNumber" text,method text,amount numeric);`);
 await client.query('INSERT INTO pos_transactions VALUES ($1,$2,$3)',[id,business,'POS-1']);
 await client.query(`INSERT INTO pos_payments VALUES ($1,$2,$1,'2026-09-29','CASH',100),($3,$2,$1,'2026-10-01','QRIS',200)`,[id,business,barber]);
 await client.query(`INSERT INTO pos_refunds VALUES ($1,$2,'2026-10-02','RF-1','QRIS',50,'COMPLETED')`,[id,business]);
 await client.query(`INSERT INTO expenses VALUES ($1,$2,'2026-10-03','EXP-1','Biaya','CASH',20,'ACTIVE',NULL)`,[id,business]);
 await client.query(`INSERT INTO cash_movements VALUES ($1,$2,'2026-10-03','CM-1','Biaya','OUT',20,$1)`,[id,business]);
 const result=await app.request('/cash-book?month=2026-10');assert.equal(result.status,200);const {data}=await result.json();assert.equal(Number(data.opening),100);assert.equal(Number(data.incoming),200);assert.equal(Number(data.outgoing),70);assert.equal(Number(data.closing),230);assert.equal(data.total,3);
 const account=(await (await app.request('/cash-book?month=2026-10&account=GOPAY')).json()).data;assert.equal(Number(account.closing),150);assert.equal(account.total,2);
 }finally{await client.query('ROLLBACK');await client.end();}
});
