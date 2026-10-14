export const platformStatuses:Record<string,string>={PENDING:"Menunggu pembayaran",AWAITING_VERIFICATION:"Perlu verifikasi",PAID:"Terverifikasi",REJECTED:"Ditolak",CANCELLED:"Dibatalkan"};
export function platformQuery(status:string,businessId:string,page:number){
 if(status&&!Object.hasOwn(platformStatuses,status))throw new Error("Status pesanan tidak valid.");
 const id=businessId.trim();if(id&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw new Error("ID bisnis harus berupa UUID yang valid.");
 if(!Number.isInteger(page)||page<1)throw new Error("Halaman tidak valid.");
 const q=new URLSearchParams({page:String(page),limit:"20"});if(status)q.set("status",status);if(id)q.set("businessId",id);return q.toString();
}
export function platformDecision(status:string,confirmed:boolean){if(status!=="AWAITING_VERIFICATION")throw new Error("Pesanan ini tidak lagi menunggu verifikasi. Perbarui statusnya.");if(!confirmed)throw new Error("Konfirmasi pemeriksaan pembayaran terlebih dahulu.");return {confirmed:true as const};}
