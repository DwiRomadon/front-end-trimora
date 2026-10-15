import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createRequire } from 'node:module';
const backendRequire=createRequire(new URL('../../Back-end/apps/package.json',import.meta.url));
function moduleFile(file,require,globals={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require,FormData,BigInt,Number,JSON,Error,RegExp,URLSearchParams,...globals});return exports;}
const checkout=moduleFile('lib/checkout.ts');
const resource=moduleFile('lib/resources.ts');
const posSchema=moduleFile('../Back-end/apps/src/modules/pos/pos.validation.ts',backendRequire).checkoutSchema;
const productSchema=moduleFile('../Back-end/apps/src/modules/products/product.validation.ts',backendRequire);
const serviceSchema=moduleFile('../Back-end/apps/src/modules/services/service.validation.ts',backendRequire);
const customerSchema=moduleFile('../Back-end/apps/src/modules/customers/customer.validation.ts',backendRequire);
const id='10000000-0000-4000-8000-000000000001';const barber='10000000-0000-4000-8000-000000000002';
const cart=[{key:'product',type:'PRODUCT',id,name:'Pomade',price:'125.55',quantity:'0.125',unit:'GRAM'},{key:'service',type:'SERVICE',id,name:'Cut',price:'50000',quantity:'2',barberId:barber}];
test('fractional product amounts round per line before discounts',()=>{assert.equal(checkout.lineCents(cart[0]).toString(),'1569');const total=checkout.totals(cart,{type:'PERCENTAGE',value:'12.50'});assert.equal(total.subtotal,'100015.69');assert.equal(total.discount,'12501.96');assert.equal(total.total,'87513.73');});
test('mixed service/product checkout satisfies the real backend Zod contract',()=>{const body=checkout.checkoutPayload(id,cart,{type:'NOMINAL',value:'15.69'},{method:'CASH',cash:'100000',reference:'',confirmed:false},'CASHIER',id,'Thank you');const parsed=posSchema.safeParse({...body,requestId:barber});assert.equal(parsed.success,true,parsed.error?.message);assert.equal(typeof body.items[0].quantity,'string');assert.equal(typeof body.items[1].quantity,'number');});
test('cashier cannot submit non-cash and owner must confirm payment',()=>{assert.throws(()=>checkout.checkoutPayload(id,cart,{type:'NONE',value:'0'},{method:'QRIS',cash:'',reference:'ref',confirmed:true},'CASHIER',null,''),/owner/);assert.throws(()=>checkout.checkoutPayload(id,cart,{type:'NONE',value:'0'},{method:'QRIS',cash:'',reference:'ref',confirmed:false},'OWNER',null,''),/Konfirmasi/);});
test('over-discount, missing barber, and invalid product quantity are rejected before checkout',()=>{assert.throws(()=>checkout.totals(cart,{type:'PERCENTAGE',value:'100.01'}),/100%/);assert.throws(()=>checkout.totals(cart,{type:'NOMINAL',value:'999999'}),/subtotal/);assert.throws(()=>checkout.checkoutPayload(id,[{...cart[1],barberId:''}],{type:'NONE',value:'0'},{method:'CASH',cash:'100000',reference:'',confirmed:false},'OWNER',null,''),/barber/);assert.throws(()=>checkout.checkoutPayload(id,[{...cart[0],quantity:'0.0001'}],{type:'NONE',value:'0'},{method:'CASH',cash:'100000',reference:'',confirmed:false},'OWNER',null,''));});
test('product create/edit payloads obey immutable unit and Decimal string fields',()=>{const form=new FormData();for(const[k,v]of Object.entries({name:'Pomade',sku:'PM',categoryId:id,unit:'GRAM',sellingPrice:'125.55',minimumStock:'0.125',isForSale:'on'}))form.set(k,v);const create=resource.buildPayload('products',form,false);assert.equal(productSchema.createProductSchema.safeParse(create).success,true);const edit=resource.buildPayload('products',form,true);assert.equal('unit'in edit,false);assert.equal(productSchema.updateProductSchema.safeParse(edit).success,true);assert.equal(typeof edit.sellingPrice,'string');assert.equal(edit.isServiceSupply,false);});
test('service duration and optional customer values satisfy backend contracts',()=>{const form=new FormData();for(const[k,v]of Object.entries({name:'Haircut',code:'HC',categoryId:id,duration:'30'}))form.set(k,v);const service=resource.buildPayload('services',form,false);assert.equal(typeof service.duration,'number');assert.equal(serviceSchema.createServiceSchema.safeParse(service).success,true);const customer=new FormData();customer.set('name','Customer Test');const payload=resource.buildPayload('customers',customer,false);assert.equal(payload.phone,null);assert.equal(customerSchema.createCustomerSchema.safeParse({...payload,requestId:id}).success,true);});
const recipeTools = moduleFile('lib/recipes.ts');
const recipeSchema = moduleFile('../Back-end/apps/src/modules/service-recipes/service-recipe.validation.ts',backendRequire).saveRecipeSchema;
const supply = {id,name:'Shampoo',sku:'SH',unit:'ML',status:'ACTIVE',isServiceSupply:true,category:{id,status:'ACTIVE',name:'Bahan'}};
test('recipe payload uses Decimal strings and matches the real backend schema',()=>{const payload=recipeTools.recipePayload([{key:'local-only',productId:id,quantity:' 0.125 '}],true,[supply]);const parsed=recipeSchema.safeParse(payload);assert.equal(parsed.success,true,parsed.error?.message);assert.equal(payload.items[0].quantity,'0.125');assert.equal('key' in payload.items[0],false);});
test('recipes reject duplicate, unavailable, inactive-category and invalid materials',()=>{const line={key:'line',productId:id,quantity:'1'};assert.throws(()=>recipeTools.recipePayload([line,{...line,key:'another'}],true,[supply]),/dua kali/);assert.throws(()=>recipeTools.recipePayload([line],true,[{...supply,category:{...supply.category,status:'INACTIVE'}}]),/aktif/);assert.throws(()=>recipeTools.recipePayload([{...line,quantity:'1e2'}],true,[supply]),/desimal/);assert.throws(()=>recipeTools.recipePayload([{...line,quantity:'0.0001'}],true,[supply]),/desimal/);assert.throws(()=>recipeTools.recipePayload([{...line,quantity:'0'}],true,[supply]),/positif/);assert.throws(()=>recipeTools.recipePayload([],false,[supply]),/1–100/);});
const estimate={canFulfill:true,materials:[{productId:id,sku:'SH',name:'Shampoo',unit:'ML',requiredQuantity:'0.125',availableQuantity:'0.374',averageCost:'10',estimatedCost:'1.25',enoughStock:true,validCost:true,isUsable:true}]};
test('outlet simulation computes exact fractional shortages and capacity',()=>{const two=recipeTools.readiness(estimate,2);assert.equal(two.ready,true);assert.equal(two.capacity,'2');assert.equal(two.materials[0].requiredForServices,'0.25');const three=recipeTools.readiness(estimate,3);assert.equal(three.ready,false);assert.equal(three.materials[0].shortage,'0.001');assert.equal(three.materials[0].requiredForServices,'0.375');});
test('stock quantity alone cannot mark zero-cost or unusable materials ready',()=>{for(const flag of ['validCost','isUsable']){const result=recipeTools.readiness({...estimate,materials:[{...estimate.materials[0],[flag]:false}]},1);assert.equal(result.ready,false);assert.equal(result.capacity,'0');assert.ok(result.materials[0].reasons.length>0);}assert.throws(()=>recipeTools.readiness(estimate,0),/1–20/);assert.throws(()=>recipeTools.readiness(estimate,1.5),/1–20/);assert.equal(recipeTools.readiness({...estimate,canFulfill:false},1).ready,false);});
const receiptTools=moduleFile('lib/receipt.ts');
test('receipt item subtotal stays before discount even when allocated total is lower',()=>{assert.equal(receiptTools.receiptLineAmount({price:'75000',quantity:'1',subtotal:'75000',total:'65000'}),'75000');assert.equal(receiptTools.receiptLineAmount({price:'125.55',quantity:'0.125',total:'10'}),'15.69');assert.equal(receiptTools.receiptNumber('75000'),'75.000');});
test('receipt time uses WIB and renders correct payment labels',()=>{const date=receiptTools.receiptDate('2026-10-11T14:47:00.000Z');assert.equal(date.time,'21:47');assert.match(date.date,/11/);assert.equal(receiptTools.paymentName('CASH'),'Tunai');assert.equal(receiptTools.paymentName('EWALLET'),'E-Wallet');});
test('real backend receipt mapping keeps customer, item subtotal and payment change',async()=>{
  const Decimal=backendRequire('@prisma/client/runtime/client').Decimal;const d=value=>new Decimal(value);let query;
  const transaction={business:{name:'Test Studio',logoUrl:'data:image/png;base64,receipt-logo'},outlet:{name:'Test Outlet',address:'Test Address',phone:'08000000000'},invoiceNumber:'INV-TEST',status:'COMPLETED',completedAt:new Date('2026-10-11T14:47:00Z'),cashier:{name:'Cashier Test'},customer:{name:'Customer Test',phone:'08123456789'},notes:'Thank you',subtotal:d(75000),discountAmount:d(10000),grandTotal:d(65000),items:[{itemName:'Haircut',type:'SERVICE',barber:{name:'Barber'},quantity:d(1),unitPrice:d(75000),subtotal:d(75000),discountAmount:d(10000),total:d(65000)}],payments:[{method:'CASH',amount:d(65000),tenderedAmount:d(100000),changeAmount:d(35000)}]};
  const service=moduleFile('../Back-end/apps/src/modules/pos/pos-query.service.ts',path=>path==='../../config/database'?{prisma:{posTransaction:{findFirst:async q=>{query=q;return transaction;}}}}:{Prisma:{Decimal}}).PosQueryService;
  const result=await service.receipt({role:'OWNER',businessId:id,userId:barber},id);
  assert.equal(query.select.business.select.logoUrl,true);assert.equal(result.businessLogoUrl,transaction.business.logoUrl);assert.equal(query.select.customer.select.phone,true);assert.equal(result.customer.name,'Customer Test');assert.equal(result.items[0].barber,'Barber');assert.equal(result.items[0].subtotal,'75000');assert.equal(result.items[0].total,'65000');assert.equal(result.totalTendered,'100000');assert.equal(result.totalChange,'35000');assert.equal(result.notes,'Thank you');
});
test('fractional product quantity retains all three decimals on receipt',()=>{assert.equal(receiptTools.receiptQuantity('0.125'),'0,125');assert.equal(receiptTools.receiptQuantity('1.001'),'1,001');});
const locationTools=moduleFile('lib/stock-locations.ts');
test('outlets remain selectable when every outlet already has a stock location',()=>{const rows=locationTools.outletLocationChoices([{id,name:'Outlet Test'}],[{id:barber,name:'Stok Outlet',code:'LOC',type:'OUTLET',outletId:id,isActive:true}]);assert.equal(rows.length,1);assert.equal(rows[0].id,id);assert.equal(rows[0].location.id,barber);assert.match(rows[0].label,/tersedia/);});
test('location choices distinguish new outlets, inactive locations and central warehouses',()=>{const rows=locationTools.outletLocationChoices([{id,name:'Existing'},{id:barber,name:'New'}],[{id:'central',name:'Central',code:'C',type:'CENTRAL',outletId:null,isActive:true},{id:'inactive',name:'Old',code:'O',type:'OUTLET',outletId:id,isActive:false}]);assert.match(rows[0].label,/nonaktif/);assert.equal(rows[0].location.id,'inactive');assert.equal(rows[1].location,undefined);assert.match(rows[1].label,/belum ada/);});

const stockTools=moduleFile('lib/stock-documents.ts');
const transferSchema=moduleFile('../Back-end/apps/src/modules/stock-transfers/stock-transfer.validation.ts',backendRequire).createTransferSchema;
const countSchema=moduleFile('../Back-end/apps/src/modules/stock-counts/stock-count.validation.ts',backendRequire).createStockCountSchema;
test('transfer and opname payloads match backend contracts with decimal strings and zero physical stock',()=>{const line={key:'ui-only',productId:id,quantity:' 0.125 '};const transfer=stockTools.stockDraftPayload('transfer',' trf-test ',id,barber,'Notes',[line]);assert.equal(transfer.transferNumber,'TRF-TEST');assert.equal(transferSchema.safeParse(transfer).success,true);assert.equal(transfer.items[0].quantity,'0.125');assert.equal('key'in transfer.items[0],false);const count=stockTools.stockDraftPayload('count','OPN-TEST',id,'','',[{...line,quantity:'0'}]);assert.equal(countSchema.safeParse(count).success,true);assert.equal(count.items[0].countedQuantity,'0');});
test('invalid stock documents reject duplicate items, equal transfer locations, and blank physical counts',()=>{const line={key:'a',productId:id,quantity:'1'};assert.throws(()=>stockTools.stockDraftPayload('transfer','TRF',id,id,'',[line]),/berbeda/);assert.throws(()=>stockTools.stockDraftPayload('transfer','TRF',id,barber,'',[{...line,quantity:'0'}]),/lebih besar/);assert.throws(()=>stockTools.stockDraftPayload('count','OPN',id,'','',[{...line,quantity:''}]),/desimal/);assert.throws(()=>stockTools.stockDraftPayload('count','OPN',id,'','',[line,{...line,key:'b'}]),/duplikat/);assert.throws(()=>stockTools.stockDraftPayload('count','OPN',id,'','',[{...line,quantity:'0.0001'}]),/desimal/);});
test('cashier stock count actions respect creator ownership and owner-only approvals',()=>{const own=stockTools.stockActions('count',{status:'DRAFT',createdById:id},'CASHIER',id);assert.equal(own.join(','),'submit,cancel');assert.equal(stockTools.stockActions('count',{status:'DRAFT',createdById:barber},'CASHIER',id).length,0);assert.equal(stockTools.stockActions('count',{status:'PENDING',createdById:id},'CASHIER',id).length,0);assert.equal(stockTools.stockActions('count',{status:'PENDING'},'OWNER',id).join(','),'approve,reject');assert.equal(stockTools.stockActions('count',{status:'APPROVED'},'OWNER',id).length,0);});
test('transfers only expose completion after approval and never to cashier',()=>{assert.equal(stockTools.stockActions('transfer',{status:'PENDING'},'OWNER',id).includes('complete'),false);assert.equal(stockTools.stockActions('transfer',{status:'APPROVED'},'OWNER',id).join(','),'complete');assert.equal(stockTools.stockActions('transfer',{status:'APPROVED'},'CASHIER',id).length,0);assert.equal(stockTools.stockActions('transfer',{status:'COMPLETED'},'OWNER',id).length,0);});
test('opname variance preserves exact positive and negative fractional quantities',()=>{assert.equal(stockTools.stockDifference('0.125','0.126'),'-0.001');assert.equal(stockTools.stockDifference('1.001','1'),'0.001');assert.equal(stockTools.stockDifference('0','12'),'-12');assert.equal(stockTools.stockDifference('10','10'),'0');});
const refundTools=moduleFile('lib/refunds.ts');
const refundSchemas=moduleFile('../Back-end/apps/src/modules/pos-refunds/pos-refund.validation.ts',backendRequire);
const refundSale={id,status:'COMPLETED',items:[{id:barber,type:'PRODUCT',productId:barber},{id,type:'SERVICE',productId:null}]};
test('refund request matches real backend schema and never supplies a partial amount',()=>{const payload=refundTools.refundPayload(refundSale,' rf-test ','QRIS','Produk dikembalikan',[barber]);assert.equal(payload.refundNumber,'RF-TEST');assert.equal(refundSchemas.createRefundSchema.safeParse(payload).success,true);assert.equal('amount' in payload,false);assert.equal(refundSchemas.createRefundSchema.safeParse({...payload,amount:'1000'}).success,false);assert.equal(refundSchemas.createRefundSchema.safeParse(refundTools.refundPayload(refundSale,'RF-NO-STOCK','CASH','Layanan dibatalkan',[])).success,true);});
test('refund rejects service returns, duplicates, short reasons and cancelled sales',()=>{assert.throws(()=>refundTools.refundPayload(refundSale,'RF-TEST','CASH','Alasan valid',[id]),/produk/);assert.throws(()=>refundTools.refundPayload(refundSale,'RF-TEST','CASH','Alasan valid',[barber,barber]),/produk/);assert.throws(()=>refundTools.refundPayload(refundSale,'RF-TEST','CASH','x',[]),/Alasan/);assert.throws(()=>refundTools.refundPayload({...refundSale,status:'CANCELLED'},'RF-TEST','CASH','Alasan valid',[]),/selesai/);});
test('refund completion requires explicit payment confirmation and validates reference',()=>{assert.throws(()=>refundTools.refundCompletion(false,'REF-123'),/Konfirmasikan/);assert.throws(()=>refundTools.refundCompletion(true,'x'),/Referensi/);assert.equal(refundSchemas.completeRefundSchema.safeParse(refundTools.refundCompletion(true,' REF-123 ')).success,true);assert.equal(refundSchemas.completeRefundSchema.safeParse(refundTools.refundCompletion(true,'')).success,true);});
test('real refund service blocks cash completion without owner shift before stock changes',async()=>{const Decimal=backendRequire('@prisma/client/runtime/client').Decimal;let changed=false;const tx={posRefund:{findFirst:async()=>({id,transactionId:id,status:'PENDING',method:'CASH',items:[]})},posTransaction:{findFirst:async()=>({id,outletId:barber})},cashierShift:{findFirst:async()=>null},productStock:{update:async()=>{changed=true;}}};const service=moduleFile('../Back-end/apps/src/modules/pos-refunds/pos-refund.service.ts',path=>path==='../../config/database'?{prisma:{$transaction:async cb=>cb(tx)}}:path.includes('prisma/client')?{Prisma:{Decimal,TransactionIsolationLevel:{Serializable:'Serializable'},PrismaClientKnownRequestError:class extends Error{}}}:path.includes('commission')?{CommissionEntryService:{}}:{AuditLogService:{}}).PosRefundService;await assert.rejects(service.complete({role:'OWNER',businessId:id,userId:barber},id,{confirmed:true}),/shift aktif Owner/);assert.equal(changed,false);await assert.rejects(service.create({role:'CASHIER'},{}),/Owner/);});
const commissionTools=moduleFile('lib/commissions.ts');
const commissionSchemas=moduleFile('../Back-end/apps/src/modules/commissions/commission.validation.ts',backendRequire);
const payoutSchemas=moduleFile('../Back-end/apps/src/modules/commissions/commission-payout.validation.ts',backendRequire);
test('commission rule types match backend numeric percentage and Decimal fixed contracts',()=>{assert.equal(commissionSchemas.saveCommissionRuleSchema.safeParse(commissionTools.commissionRulePayload('PERCENTAGE','25.125')).success,true);assert.equal(commissionSchemas.saveCommissionRuleSchema.safeParse(commissionTools.commissionRulePayload('FIXED','12500.25')).success,true);assert.throws(()=>commissionTools.commissionRulePayload('PERCENTAGE','101'),/0–100/);assert.throws(()=>commissionTools.commissionRulePayload('FIXED','1.125'),/desimal/);});
test('payout payload preserves confirmed preview, request identity and transfer reference',()=>{const period=commissionTools.commissionPeriod(id,'2026-10-01','2026-10-12');const preview={barber:{id},canPay:true,grossAmount:'125000.25',recoveryAmount:'25000',payableAmount:'100000.25'};const payload=commissionTools.commissionPayoutPayload(period,preview,barber,'TRANSFER',' BANK-REF ','Pembayaran Oktober',true);assert.equal(payoutSchemas.createPayoutSchema.safeParse(payload).success,true);assert.equal(payload.requestId,barber);assert.equal(payload.expected.payableAmount,'100000.25');assert.equal(payload.reference,'BANK-REF');assert.throws(()=>commissionTools.commissionPayoutPayload(period,preview,barber,'TRANSFER','','',true),/Referensi/);assert.throws(()=>commissionTools.commissionPayoutPayload(period,preview,barber,'CASH','','',false),/Konfirmasikan/);assert.throws(()=>commissionTools.commissionPeriod(id,'2026-10-12','2026-10-01'),/Tanggal/);assert.throws(()=>commissionTools.commissionPayoutPayload(period,{...preview,canPay:false},barber,'CASH','','',true),/Tidak ada/);});
function payoutService(tx){const Decimal=backendRequire('@prisma/client/runtime/client').Decimal;return moduleFile('../Back-end/apps/src/modules/commissions/commission-payout.service.ts',path=>path==='../../config/database'?{prisma:{$transaction:async cb=>cb(tx)}}:{Prisma:{Decimal,TransactionIsolationLevel:{Serializable:'Serializable'},PrismaClientKnownRequestError:class extends Error{}}}).CommissionPayoutService;}
test('real payout preview subtracts refund recovery outside date period and excludes paid entries',async()=>{const Decimal=backendRequire('@prisma/client/runtime/client').Decimal;let entryQuery,recoveryQuery;const tx={barber:{findFirst:async()=>({id})},barberCommissionEntry:{findMany:async q=>{entryQuery=q;return[{amount:new Decimal('50000'),baseAmount:new Decimal('100000')},{amount:new Decimal('25000.25'),baseAmount:new Decimal('50000')}];}},barberCommissionRecovery:{findMany:async q=>{recoveryQuery=q;return[{remainingAmount:new Decimal('15000')}];}}};const result=await payoutService(tx).preview({role:'OWNER',businessId:id},{barberId:id,dateFrom:'2026-10-01',dateTo:'2026-10-12'});assert.equal(result.payableAmount,'60000.25');assert.equal(result.recoveryAmount,'15000');assert.equal(entryQuery.where.status,'EARNED');assert.equal(Object.keys(entryQuery.where.payoutItems.none).length,0);assert.equal('createdAt' in recoveryQuery.where,false);assert.equal(entryQuery.where.createdAt.gte.toISOString(),'2026-09-30T17:00:00.000Z');});
test('real payout refuses changed confirmed preview and duplicates before writing payment',async()=>{const Decimal=backendRequire('@prisma/client/runtime/client').Decimal;let writes=0;const tx={barber:{findFirst:async()=>({id})},barberCommissionPayout:{findFirst:async()=>null,create:async()=>{writes++;}},barberCommissionEntry:{findMany:async()=>[{amount:new Decimal('50000')}]},barberCommissionRecovery:{findMany:async()=>[]}};const input={barberId:id,requestId:barber,method:'CASH',confirmed:true,expected:{grossAmount:'40000',recoveryAmount:'0',payableAmount:'40000'}};await assert.rejects(payoutService(tx).create({role:'OWNER',businessId:id},input),/berubah sejak pratinjau/);assert.equal(writes,0);tx.barberCommissionPayout.findFirst=async()=>({id});await assert.rejects(payoutService(tx).create({role:'OWNER',businessId:id},input),/sudah pernah/);assert.equal(writes,0);await assert.rejects(payoutService(tx).preview({role:'CASHIER'},{}),/Owner/);});
test('real commission simulation applies discount and caps fixed commission at net service revenue',async()=>{const Decimal=backendRequire('@prisma/client/runtime/client').Decimal;const prisma={outlet:{findFirst:async()=>({id})},barber:{findFirst:async()=>({id})},outletServicePrice:{findFirst:async()=>({price:new Decimal('50000'),service:{id}})},barberCommissionRule:{findUnique:async()=>({type:'FIXED',value:new Decimal('40000')})}};const service=moduleFile('../Back-end/apps/src/modules/commissions/commission.service.ts',path=>path==='../../config/database'?{prisma}:{Prisma:{Decimal}}).CommissionService;const result=await service.preview({role:'OWNER',businessId:id},{outletId:id,barberId:id,serviceId:id,quantity:2,discountAmount:'30000'});assert.equal(result.netAmount,'70000');assert.equal(result.commission,'70000');assert.equal(result.remainderBeforeOtherCosts,'0');});
const financeTools=moduleFile('lib/finance.ts');
const expenseSchemas=moduleFile('../Back-end/apps/src/modules/expenses/expense.validation.ts',backendRequire);
const cashSchemas=moduleFile('../Back-end/apps/src/modules/cash-movements/cash-movement.validation.ts',backendRequire);
const expenseValues={outletId:id,categoryId:barber,description:'Biaya kebersihan outlet',amount:'12500.25',method:'CASH',reference:'',expenseDate:'2026-10-12',notes:''};
test('expense payload obeys real schema, preserves Decimal amounts and business costs outside drawer',()=>{const payload=financeTools.expensePayload(expenseValues,id);assert.equal(expenseSchemas.createExpenseSchema.safeParse(payload).success,true);assert.equal(payload.amount,'12500.25');assert.equal(financeTools.expensePayload({...expenseValues,outletId:''},id).outletId,null);for(const amount of ['0','-1','1.125'])assert.throws(()=>financeTools.expensePayload({...expenseValues,amount},id),/Nominal/);});
test('expense editing sends only changed fields and respects cash linkage and void prerequisites',()=>{const expense={...expenseValues,outletId:null,method:'TRANSFER',expenseDate:'2026-10-11T17:00:00.000Z',reference:null,notes:null,status:'ACTIVE',cashMovement:null};const updates=financeTools.expenseUpdatePayload(expense,{...expenseValues,outletId:'',method:'TRANSFER',description:'Biaya kebersihan terkoreksi'});assert.deepEqual(Object.keys(updates),['description']);assert.equal(expenseSchemas.updateExpenseSchema.safeParse(updates).success,true);assert.equal(financeTools.expenseEditable({...expense,cashMovement:{id}}),false);assert.equal(financeTools.expenseVoidable({...expense,cashMovement:{id,reversal:null}}),false);assert.equal(financeTools.expenseVoidable({...expense,cashMovement:{id,reversal:{id}}}),true);});
test('cashier choices omit owner adjustments and reversal requires physical confirmation',()=>{assert.equal(financeTools.cashChoices('CASHIER').length,2);const payload=financeTools.cashPayload('CASHIER',id,'CASH_OUT','12500.25','Pengambilan uang laci','','');assert.equal(cashSchemas.createCashMovementSchema.safeParse(payload).success,true);assert.throws(()=>financeTools.cashPayload('CASHIER',id,'OWNER_DEPOSIT','10','Setoran uang owner','',''),/peran/);assert.throws(()=>financeTools.reversalPayload(id,'Kesalahan input',false),/Konfirmasikan/);assert.equal(cashSchemas.reverseCashMovementSchema.safeParse(financeTools.reversalPayload(id,'Kesalahan pencatatan',true)).success,true);});
function financeService(file,tx){const Decimal=backendRequire('@prisma/client/runtime/client').Decimal;return moduleFile('../Back-end/apps/src/modules/'+file,path=>path==='../../config/database'?{prisma:{$transaction:async cb=>cb(tx)}}:path.includes('prisma/client')?{Prisma:{Decimal,TransactionIsolationLevel:{Serializable:'Serializable'},PrismaClientKnownRequestError:class extends Error{}}}:{AuditLogService:{record:async()=>{}}});}
test('real cash service retries identical request without another write or requiring new shift',async()=>{const Decimal=backendRequire('@prisma/client/runtime/client').Decimal;const input={requestId:id,type:'CASH_IN',amount:'12500.25',description:'Uang masuk tambahan',reference:null,notes:null};let writes=0;const saved={...input,id,amount:new Decimal(input.amount),createdById:barber};const tx={cashMovement:{findFirst:async()=>saved,create:async()=>{writes++;}}};const service=financeService('cash-movements/cash-movement.service.ts',tx).CashMovementService;assert.equal((await service.create({role:'CASHIER',businessId:id,userId:barber},input)).id,id);assert.equal(writes,0);await assert.rejects(service.create({role:'CASHIER',businessId:id,userId:barber},{...input,amount:'10'}),/mutasi berbeda/);await assert.rejects(service.create({role:'CASHIER'},{...input,type:'ADJUSTMENT_OUT'}),/Owner/);});
test('real cash reversal requires owner shift at original outlet and cannot reverse a reversal',async()=>{let reads=0,writes=0;const tx={cashMovement:{findFirst:async()=>++reads===1?null:{id,outletId:id,type:'CASH_OUT',direction:'OUT',reversal:null},create:async()=>{writes++;}},cashierShift:{findFirst:async()=>({id,outletId:barber})}};const service=financeService('cash-movements/cash-movement.service.ts',tx).CashMovementService;await assert.rejects(service.reverse({role:'OWNER',businessId:id,userId:id},id,{requestId:barber,reason:'Pengeluaran dibatalkan'}),/outlet yang sama/);assert.equal(writes,0);reads=0;tx.cashMovement.findFirst=async()=>++reads===1?null:{id,type:'REVERSAL'};await assert.rejects(service.reverse({role:'OWNER',businessId:id,userId:id},id,{requestId:barber,reason:'Pengeluaran dibatalkan'}),/dibalik ulang/);});
test('real expense service blocks void before cash reversal and blocks editing linked cash expense',async()=>{let writes=0;const expense={id,status:'ACTIVE',cashMovement:{id,movementNumber:'CM-EXP-TEST',reversal:null}};const tx={expense:{findFirst:async()=>expense,updateMany:async()=>{writes++;}}};const service=financeService('expenses/expense.service.ts',tx).ExpenseService;await assert.rejects(service.voidExpense({role:'OWNER',businessId:id,userId:id},id,{reason:'Pengeluaran dibatalkan'}),/Balikkan mutasi/);await assert.rejects(service.update({role:'OWNER',businessId:id,userId:id},id,{description:'Perubahan biaya'}),/reversal dan void/);assert.equal(writes,0);await assert.rejects(service.create({role:'CASHIER'},{}),/Owner/);});
const adminTools=moduleFile('lib/admin.ts');
const cashierSchemas=moduleFile('../Back-end/apps/src/modules/cashiers/cashier.validation.ts',backendRequire);
const outletSchemas=moduleFile('../Back-end/apps/src/modules/outlets/outlet.validation.ts',backendRequire);
const reportSchemas=moduleFile('../Back-end/apps/src/modules/reports/report.validation.ts',backendRequire);
const dailySchema=moduleFile('../Back-end/apps/src/modules/daily-cash-reports/daily-cash-report.validation.ts',backendRequire).dailyCashReportQuerySchema;
test('cashier create/edit contracts preserve member outlet IDs and do not send email/password on edit',()=>{const values={name:'Kasir Test',email:'TEST@example.invalid',password:'local-test-pass-1234',phone:'',outletIds:[id]};const create=adminTools.cashierPayload(values,false);assert.equal(cashierSchemas.createCashierSchema.safeParse(create).success,true);assert.equal(create.email,'test@example.invalid');const edit=adminTools.cashierPayload(values,true);assert.equal(cashierSchemas.updateCashierSchema.safeParse(edit).success,true);assert.equal('password' in edit,false);assert.equal('email' in edit,false);assert.throws(()=>adminTools.cashierPayload({...values,outletIds:[]},false),/outlet/);assert.throws(()=>adminTools.cashierPayload({...values,outletIds:[id,id]},false),/duplikat/);assert.equal(cashierSchemas.assignCashierOutletsSchema.safeParse({outletIds:[]}).success,true);});
test('outlet identity contract normalizes code and optional contacts without inventing fields',()=>{const body=adminTools.outletPayload({name:'Outlet Test',code:' out-02 ',email:'',phone:'',address:'Alamat Test',city:'Jakarta'});assert.equal(outletSchemas.createOutletSchema.safeParse(body).success,true);assert.equal(outletSchemas.updateOutletSchema.safeParse(body).success,true);assert.equal(body.code,'OUT-02');assert.equal(body.email,null);});
test('report periods respect different API date limits and reject reversed ranges',()=>{const q=adminTools.periodQuery('2026-10-01','2026-10-31',id,30);assert.equal(dailySchema.safeParse(q).success,true);assert.equal(reportSchemas.reportPeriodSchema.safeParse(q).success,true);assert.throws(()=>adminTools.periodQuery('2026-10-01','2026-11-01',id,30),/Rentang maksimal/);assert.throws(()=>adminTools.periodQuery('2026-10-12','2026-10-01','',366),/tidak valid/);assert.throws(()=>adminTools.periodQuery('2025-01-01','2026-10-12','',366),/Rentang maksimal/);assert.equal('outletId' in adminTools.periodQuery('2026-10-01','2026-10-12','',366),false);});
test('cashier assignment service validates active business outlets before replacing assignments',async()=>{let writes=0;const prisma={businessMember:{findFirst:async()=>({id})},outlet:{count:async()=>0},$transaction:async()=>{writes++;}};const service=moduleFile('../Back-end/apps/src/modules/cashiers/cashier.service.ts',path=>path==='../../config/database'?{prisma}:{Prisma:{PrismaClientKnownRequestError:class extends Error{}}}).CashierService;await assert.rejects(service.assignOutlets({businessId:id},id,{outletIds:[barber]}),/tidak aktif/);assert.equal(writes,0);});
test('audit listing always scopes tenant and correctly maps WIB range plus actor filters',async()=>{let query;const Decimal=backendRequire('@prisma/client/runtime/client').Decimal;const prisma={auditLog:{findMany:q=>{query=q;return Promise.resolve([]);},count:async()=>0},$transaction:async queries=>Promise.all(queries)};const service=moduleFile('../Back-end/apps/src/modules/audit-logs/audit-log.service.ts',path=>path==='../../config/database'?{prisma}:{Prisma:{Decimal}}).AuditLogService;await service.findAll({role:'OWNER',businessId:id},{actorId:barber,dateFrom:'2026-10-12',dateTo:'2026-10-12',page:1,limit:15});assert.equal(query.where.businessId,id);assert.equal(query.where.actorId,barber);assert.equal(query.where.createdAt.gte.toISOString(),'2026-10-11T17:00:00.000Z');await assert.rejects(service.findAll({role:'CASHIER',businessId:id},{page:1,limit:15}),/Owner/);});

const subscriptionSchema=moduleFile('../Back-end/apps/src/modules/subscriptions/subscription.validation.ts',backendRequire);
test('subscription orders accept only a plan and stable request ID, never a client price',()=>{
 assert.equal(subscriptionSchema.createSubscriptionOrderSchema.safeParse({requestId:id,plan:'ANNUAL'}).success,true);
 assert.equal(subscriptionSchema.createSubscriptionOrderSchema.safeParse({requestId:id,plan:'ANNUAL',amount:1}).success,false);
 assert.equal(subscriptionSchema.submitSubscriptionPaymentSchema.safeParse({paymentReference:'  transfer-123  '}).data.paymentReference,'transfer-123');
});
test('subscription current agrees with premium middleware for future and expired access',async()=>{
 const now=Date.now();let record;
 const service=moduleFile('../Back-end/apps/src/modules/subscriptions/subscription.service.ts',name=>{
  if(name.includes('config/database'))return {prisma:{businessSubscription:{findUnique:async()=>record}}};
  if(name.includes('generated/prisma'))return {Prisma:{}};
  if(name.includes('subscription.catalog'))return moduleFile('../Back-end/apps/src/modules/subscriptions/subscription.catalog.ts');
  throw new Error(name);
 }).SubscriptionService;
 const auth={role:'OWNER',businessId:id,userId:barber};
 record=null;assert.equal((await service.current(auth)).status,'FREE');
 record={lastPurchasedPlan:'ANNUAL',startedAt:new Date(now+86400000),expiresAt:new Date(now+86400000*30),trainingAccessUntil:new Date(now+86400000*30)};
 let d=await service.current(auth);assert.equal(d.status,'NOT_STARTED');assert.equal(d.trainingIncluded,false);
 record.startedAt=new Date(now-86400000);d=await service.current(auth);assert.equal(d.status,'ACTIVE');assert.equal(d.trainingIncluded,true);
 record.expiresAt=new Date(now-1000);assert.equal((await service.current(auth)).status,'EXPIRED');
 await assert.rejects(service.current({...auth,role:'CASHIER'}),{status:403});
});

const platformTools=moduleFile('lib/platform.ts');
const platformSchema=moduleFile('../Back-end/apps/src/modules/platform-subscriptions/platform-subscription.validation.ts',backendRequire);
test('platform filters match strict API schema and reject invalid business IDs',()=>{
 const query=platformTools.platformQuery('AWAITING_VERIFICATION',id,2);
 assert.equal(platformSchema.platformOrderListSchema.safeParse(Object.fromEntries(new URLSearchParams(query))).success,true);
 assert.throws(()=>platformTools.platformQuery('PAID','invalid',1),/UUID/);
 assert.equal(new URLSearchParams(platformTools.platformQuery('','',1)).has('businessId'),false);
});
test('platform decisions require explicit review and an awaiting-verification order',()=>{
 assert.equal(platformSchema.platformDecisionSchema.safeParse(platformTools.platformDecision('AWAITING_VERIFICATION',true)).success,true);
 assert.throws(()=>platformTools.platformDecision('AWAITING_VERIFICATION',false),/Konfirmasi/);
 for(const status of ['PAID','PENDING','CANCELLED','REJECTED'])assert.throws(()=>platformTools.platformDecision(status,true),/tidak lagi/);
 assert.equal(platformSchema.platformDecisionSchema.safeParse({confirmed:true,confirmedBy:'forged'}).success,false);
});
test('platform service verifies superadmin before approval and attributes operator from auth',async()=>{
 let allowed=false,called=false;
 const service=moduleFile('../Back-end/apps/src/modules/platform-subscriptions/platform-subscription.service.ts',name=>{
 if(name.includes('config/database'))return {prisma:{user:{findFirst:async()=>allowed?{id}:null}}};
 if(name.includes('subscription.service'))return {SubscriptionService:{approvePayment:async(order,operator)=>{called=true;return {order,operator};}}};
 if(name.includes('generated/prisma'))return {Prisma:{}};
 throw new Error(name);
 }).PlatformSubscriptionService;
 const auth={userId:id,businessId:barber,role:'OWNER'};
 await assert.rejects(service.approve(auth,barber),{status:403});assert.equal(called,false);
 allowed=true;const result=await service.approve(auth,barber);assert.equal(result.operator,id);assert.equal(result.order,barber);
});

const attendanceTools=moduleFile('lib/attendance.ts');
const attendanceSchedule=moduleFile('../Back-end/apps/src/modules/attendance/attendance-schedule.validation.ts',backendRequire);
const attendanceReport=moduleFile('../Back-end/apps/src/modules/attendance/attendance-report.validation.ts',backendRequire);
test('attendance overnight windows use WIB independent of the device timezone',()=>{
 const w=attendanceTools.attendanceWindow({workDate:'2026-10-13T00:00:00.000Z',startMinute:22*60,endMinute:6*60,crossesMidnight:true});
 assert.equal(new Date(w.start).toISOString(),'2026-10-13T15:00:00.000Z');
 assert.equal(new Date(w.end).toISOString(),'2026-10-13T23:00:00.000Z');
});
test('attendance schedules accept template or manual times, never both',()=>{
 const base={memberId:id,outletId:barber,workDate:'2026-10-13',slot:1,notes:null};
 assert.equal(attendanceSchedule.createScheduleSchema.safeParse({...base,templateId:id}).success,true);
 assert.equal(attendanceSchedule.createScheduleSchema.safeParse({...base,startTime:'22:00',endTime:'06:00',lateToleranceMinutes:10}).success,true);
 assert.equal(attendanceSchedule.createScheduleSchema.safeParse({...base,templateId:id,startTime:'22:00',endTime:'06:00'}).success,false);
 assert.equal(attendanceSchedule.updateScheduleSchema.safeParse({templateId:null,startTime:'09:00',endTime:'17:00',lateToleranceMinutes:0}).success,true);
});
test('attendance report rejects excessive date range and accepts explicit WIB corrections',()=>{
 assert.equal(attendanceReport.attendanceReportQuerySchema.safeParse({startDate:'2026-10-01',endDate:'2026-10-31'}).success,true);
 assert.equal(attendanceReport.attendanceReportQuerySchema.safeParse({startDate:'2026-10-01',endDate:'2026-11-01'}).success,false);
 assert.equal(attendanceReport.attendanceAdjustmentSchema.safeParse({checkInAt:'2026-10-13T09:00:00+07:00',notes:null,reason:'Koreksi berdasarkan bukti kehadiran'}).success,true);
});
test('attendance controllers preserve domain errors when Hono invokes an unbound handler',async()=>{
 for(const [moduleName,className,serviceName,errorName,method,input] of [
  ['shift','AttendanceShiftController','AttendanceShiftService','AttendanceShiftError','create',{code:'PG',name:'Pagi',outletId:null,startTime:'09:00',endTime:'17:00',lateToleranceMinutes:0}],
  ['schedule','AttendanceScheduleController','AttendanceScheduleService','AttendanceScheduleError','create',{memberId:id,outletId:barber,workDate:'2026-10-13',startTime:'09:00',endTime:'17:00'}],
  ['qr','AttendanceQrController','AttendanceQrService','AttendanceQrError','start',{outletId:id}],
 ]){
  class DomainError extends Error {status=409;}
  const validation=moduleFile(`../Back-end/apps/src/modules/attendance/attendance-${moduleName}.validation.ts`,backendRequire);
  const controller=moduleFile(`../Back-end/apps/src/modules/attendance/attendance-${moduleName}.controller.ts`,path=>{
   if(path.endsWith('.validation'))return validation;
   if(path.includes('utils/response'))return {response:{error:message=>({success:false,message})}};
   if(path.endsWith('.service'))return {[errorName]:DomainError,[serviceName]:new Proxy({}, {get:()=>async()=>{throw new DomainError('Konflik absensi');}})};
   return backendRequire(path);
  })[className];
  const handler=controller[method];const result=await handler({req:{json:async()=>input},get:()=>({}),json:(body,status)=>({body,status})});
  assert.equal(result.status,409);assert.equal(result.body.message,'Konflik absensi');
 }
});

test('attendance GPS rejects denied or imprecise location and uses fresh precise readings',async()=>{
 let options;
 const loadGps=get=>moduleFile('lib/attendance.ts',undefined,{window:{isSecureContext:true},navigator:{geolocation:{getCurrentPosition:get}}});
 const precise=loadGps((ok,fail,o)=>{options=o;ok({coords:{latitude:-5.4,longitude:105.2,accuracy:12}});});
 assert.equal((await precise.locateAttendance()).accuracy,12);assert.equal(options.maximumAge,0);assert.equal(options.enableHighAccuracy,true);
 await assert.rejects(loadGps(ok=>ok({coords:{latitude:0,longitude:0,accuracy:51}})).locateAttendance(),/akurat/);
 await assert.rejects(loadGps((ok,fail)=>fail({code:1})).locateAttendance(),/Izin lokasi ditolak/);
});
test('locally generated attendance QR decodes to the exact API token',async()=>{
 const {create}=await import('qrcode');
 const {RGBLuminanceSource,HybridBinarizer,BinaryBitmap,QRCodeReader}=await import('@zxing/library');
 const token='attendance-contract-token-1234567890abcdef1234567890abcdef';
 const qr=create(token,{errorCorrectionLevel:'M'}),scale=5,margin=4,width=(qr.modules.size+margin*2)*scale;
 const luminance=new Uint8ClampedArray(width*width).fill(255);
 for(let y=0;y<qr.modules.size;y++)for(let x=0;x<qr.modules.size;x++)if(qr.modules.get(y,x))for(let dy=0;dy<scale;dy++)for(let dx=0;dx<scale;dx++)luminance[((y+margin)*scale+dy)*width+(x+margin)*scale+dx]=0;
 const bitmap=new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(luminance,width,width)));
 assert.equal(new QRCodeReader().decode(bitmap).getText(),token);
});

const logoValidation=moduleFile('../Back-end/apps/src/modules/business/business.validation.ts',backendRequire,{Buffer});
const tinyLogo='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=';
test('business logo accepts bounded PNG or removal and rejects URLs, SVG, oversized dimensions and foreign business IDs',()=>{
 assert.equal(logoValidation.businessLogoSchema.safeParse({logoUrl:tinyLogo}).success,true);
 assert.equal(logoValidation.businessLogoSchema.safeParse({logoUrl:null}).success,true);
 for(const v of ['https://example.com/logo.png','data:image/svg+xml;base64,PHN2Zz4=','data:image/png;base64,aGVsbG8='])assert.equal(logoValidation.businessLogoSchema.safeParse({logoUrl:v}).success,false);
 assert.equal(logoValidation.businessLogoSchema.safeParse({logoUrl:tinyLogo,businessId:barber}).success,false);
 const bytes=Buffer.from(tinyLogo.slice(22),'base64');bytes.writeUInt32BE(513,16);
 assert.equal(logoValidation.validBusinessLogo('data:image/png;base64,'+bytes.toString('base64')),false);
 assert.equal(logoValidation.validBusinessLogo('data:image/png;base64,'+Buffer.alloc(262145).toString('base64')),false);
});
test('business logo routes require owner and update only the authenticated business',async()=>{
 const {Hono}=backendRequire('hono');let updated;
 const roles=moduleFile('../Back-end/apps/src/middlewares/role.middleware.ts',backendRequire);
 const response=moduleFile('../Back-end/apps/src/utils/response.ts',backendRequire);
 const route=moduleFile('../Back-end/apps/src/modules/business/business.route.ts',p=>{
  if(p==='../../config/database')return {prisma:{business:{update:async q=>{updated=q;return {id:q.where.id,name:'Business',logoUrl:q.data.logoUrl};}}}};
  if(p.endsWith('business.validation'))return logoValidation;
  if(p.endsWith('role.middleware'))return roles;
  if(p.endsWith('origin.middleware'))return {trustedOrigin:async(c,next)=>next()};
  if(p.endsWith('utils/response'))return response;
  return backendRequire(p);
 }).default;
 const app=new Hono();app.use('*',async(c,next)=>{c.set('auth',{businessId:id,role:c.req.header('X-Test-Role')});await next();});app.route('/business',route);
 const request=role=>app.request('/business/logo',{method:'PATCH',headers:{'Content-Type':'application/json','X-Test-Role':role},body:JSON.stringify({logoUrl:tinyLogo})});
 assert.equal((await request('CASHIER')).status,403);assert.equal(updated,undefined);
 assert.equal((await request('BARBER')).status,403);
 assert.equal((await request('OWNER')).status,200);assert.equal(updated.where.id,id);assert.equal(updated.data.logoUrl,tinyLogo);
});
