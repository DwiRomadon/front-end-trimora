export type FinancePerson={id:string;name:string};
export type ExpenseCategory=FinancePerson & {description:string|null;isActive:boolean};
export type Expense={id:string;expenseNumber:string;outletId:string|null;categoryId:string;description:string;amount:string;method:string;reference:string|null;notes:string|null;expenseDate:string;status:"ACTIVE"|"VOIDED";voidReason:string|null;outlet:FinancePerson|null;category:FinancePerson;createdBy:FinancePerson;cashMovement?:{id:string;movementNumber:string;reversal:{id:string;movementNumber:string}|null}|null};
export type CashMovement={id:string;requestId:string;movementNumber:string;type:string;direction:"IN"|"OUT";amount:string;description:string;reference:string|null;notes:string|null;createdAt:string;outlet:FinancePerson;shift:{id:string;shiftNumber:string;status:string};createdBy:FinancePerson;expenseId:string|null;reversal?:{id:string;movementNumber:string}|null;reversedMovement?:{id:string;movementNumber:string}|null};
export const financeMethods={CASH:"Tunai",TRANSFER:"Transfer",DEBIT:"Debit",QRIS:"QRIS",EWALLET:"E-Wallet"};
export const cashTypes={CASH_IN:"Kas masuk",CASH_OUT:"Kas keluar",OWNER_DEPOSIT:"Setoran ke owner (keluar)",ADJUSTMENT_IN:"Penyesuaian masuk",ADJUSTMENT_OUT:"Penyesuaian keluar",REVERSAL:"Pembalikan mutasi"};
export const cashChoices=(role:"OWNER"|"CASHIER")=>Object.entries(cashTypes).filter(([key])=>key!=="REVERSAL"&&(role==="OWNER"||key==="CASH_IN"||key==="CASH_OUT"));
export const financeMoney=(value:string)=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:2}).format(Number(value));
export const todayWib=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
function positiveMoney(value:string){if(!/^(0|[1-9]\d{0,11})(\.\d{1,2})?$/.test(value.trim())||Number(value)<=0)throw new Error("Nominal harus lebih dari nol, maksimal 2 desimal.");return value.trim();}
export function expensePayload(values:{outletId:string;categoryId:string;description:string;amount:string;method:string;reference:string;expenseDate:string;notes:string},requestId?:string){
    if(!values.categoryId)throw new Error("Pilih kategori aktif.");
    if(values.description.trim().length<3||values.description.trim().length>2000)throw new Error("Deskripsi harus 3–2000 karakter.");
    if(!Object.hasOwn(financeMethods,values.method))throw new Error("Pilih metode pembayaran.");
    if(values.reference.trim().length>150||values.notes.trim().length>2000)throw new Error("Referensi maksimal 150 dan catatan maksimal 2000 karakter.");
    if(!/^\d{4}-\d{2}-\d{2}$/.test(values.expenseDate))throw new Error("Isi tanggal pengeluaran.");
    return {...(requestId?{requestId}:{}),outletId:values.outletId||null,categoryId:values.categoryId,description:values.description.trim(),amount:positiveMoney(values.amount),method:values.method,reference:values.reference.trim()||null,expenseDate:values.expenseDate,notes:values.notes.trim()||null};
}
export function cashPayload(role:"OWNER"|"CASHIER",requestId:string,type:string,amount:string,description:string,reference:string,notes:string){
    if(!cashChoices(role).some(([key])=>key===type))throw new Error("Jenis mutasi tidak tersedia untuk peran Anda.");
    if(description.trim().length<5||description.trim().length>1000)throw new Error("Deskripsi harus 5–1000 karakter.");
    if(reference.trim().length>150||notes.trim().length>2000)throw new Error("Referensi atau catatan terlalu panjang.");
    return {requestId,type,amount:positiveMoney(amount),description:description.trim(),reference:reference.trim()||null,notes:notes.trim()||null};
}
export function reversalPayload(requestId:string,reason:string,confirmed:boolean){if(!confirmed)throw new Error("Konfirmasikan pergerakan uang untuk pembalikan.");if(reason.trim().length<5||reason.trim().length>1000)throw new Error("Alasan harus 5–1000 karakter.");return {requestId,reason:reason.trim()};}
export function expenseUpdatePayload(expense:Expense,values:Parameters<typeof expensePayload>[0]){
    if(!expenseEditable(expense))throw new Error("Biaya sudah terhubung ke kas atau dibatalkan; pembaruan tidak tersedia.");
    const payload=expensePayload(values);
    const original={...expense,expenseDate:new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(expense.expenseDate))};
    const changes=Object.fromEntries(Object.entries(payload).filter(([key,value])=>value!==original[key as keyof typeof original]));
    if(!Object.keys(changes).length)throw new Error("Belum ada perubahan pengeluaran.");
    return changes;
}
export const expenseEditable=(expense:Expense)=>expense.status==="ACTIVE"&&!expense.cashMovement;
export const expenseVoidable=(expense:Expense)=>expense.status==="ACTIVE"&&(!expense.cashMovement||Boolean(expense.cashMovement.reversal));
