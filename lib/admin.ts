export function periodQuery(dateFrom:string,dateTo:string,outletId:string,maxDays?:number){
    if(!dateFrom||!dateTo)throw new Error("Isi tanggal awal dan akhir.");
    const days=(Date.parse(dateTo)-Date.parse(dateFrom))/86400000;
    if(!Number.isFinite(days)||days<0)throw new Error("Rentang tanggal tidak valid.");
    if(maxDays!==undefined&&days>maxDays)throw new Error(`Rentang maksimal ${maxDays+1} tanggal kalender.`);
    return {dateFrom,dateTo,...(outletId?{outletId}:{})};
}
export function cashierPayload(values:{name:string;email:string;password:string;phone:string;outletIds:string[]},edit:boolean){
    if(values.name.trim().length<3||values.name.trim().length>150)throw new Error("Nama harus 3–150 karakter.");
    if(values.phone.trim().length>30)throw new Error("Telepon maksimal 30 karakter.");
    if(edit)return {name:values.name.trim(),phone:values.phone.trim()||null};
    if(values.password.length<12||values.password.length>128)throw new Error("Password harus 12–128 karakter.");
    if(!values.outletIds.length||new Set(values.outletIds).size!==values.outletIds.length)throw new Error("Pilih minimal satu outlet tanpa duplikat.");
    return {name:values.name.trim(),email:values.email.trim().toLowerCase(),password:values.password,phone:values.phone.trim()||null,outletIds:values.outletIds};
}
export function outletPayload(values:{name:string;code:string;phone:string;email:string;address:string;city:string}){
    if(values.name.trim().length<3||values.name.trim().length>150)throw new Error("Nama outlet harus 3–150 karakter.");
    if(values.code.trim().length<2||values.code.trim().length>30)throw new Error("Kode outlet harus 2–30 karakter.");
    if(values.phone.trim().length>30||values.city.trim().length>100)throw new Error("Telepon atau kota terlalu panjang.");
    return {name:values.name.trim(),code:values.code.trim().toUpperCase(),phone:values.phone.trim()||null,email:values.email.trim().toLowerCase()||null,address:values.address.trim()||null,city:values.city.trim()||null};
}
export const auditActions:Record<string,string>={CREATE:"Pembuatan",UPDATE:"Perubahan",STATUS_CHANGE:"Perubahan status",STOCK_ADJUSTMENT:"Penyesuaian stok",REFUND_COMPLETE:"Refund selesai",REFUND_REJECT:"Refund ditolak",SHIFT_OPEN:"Shift dibuka",SHIFT_CLOSE:"Shift ditutup",CASH_MOVEMENT:"Mutasi kas",CASH_REVERSAL:"Pembalikan kas",EXPENSE_VOID:"Pembatalan biaya"};
