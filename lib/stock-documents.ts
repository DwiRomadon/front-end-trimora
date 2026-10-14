import type { Named } from "./resources";
import type { StockLocation } from "./stock-locations";
export type StockDocumentMode="transfer"|"count";
export type StockStatus="DRAFT"|"PENDING"|"APPROVED"|"COMPLETED"|"REJECTED"|"CANCELLED";
export type StockAction="submit"|"approve"|"complete"|"reject"|"cancel";
export type DocumentLocation=StockLocation & {outlet?:{status:string}|null};
export type StockProduct=Named & {sku:string;unit:string;status?:string;category?:{status:string}};
export type StockBalance={productId:string;quantity:string;averageCost:string;product:StockProduct};
export type StockDraftLine={key:string;productId:string;quantity:string};
export type StockDocument={id:string;status:StockStatus;transferNumber?:string;countNumber?:string;sourceLocationId?:string;targetLocationId?:string;locationId?:string;sourceLocation?:Named;targetLocation?:Named;location?:Named;notes:string|null;requestedById?:string;createdById?:string;createdAt:string;submittedAt?:string|null;approvedAt?:string|null;completedAt?:string|null;rejectedAt?:string|null;items:{id:string;productId:string;product:Pick<StockProduct,"name"|"sku"|"unit">;quantity?:string;unitCost?:string|null;countedQuantity?:string;systemQuantity?:string|null;variance?:string|null}[]};
export const stockStatusName:Record<StockStatus,string>={DRAFT:"Draft",PENDING:"Menunggu persetujuan",APPROVED:"Disetujui",COMPLETED:"Selesai",REJECTED:"Ditolak",CANCELLED:"Dibatalkan"};
export const stockActionName:Record<StockAction,string>={submit:"Ajukan",approve:"Setujui",complete:"Selesaikan transfer",reject:"Tolak",cancel:"Batalkan"};
export const documentPath=(mode:StockDocumentMode)=>mode==="transfer"?"/stock-transfers":"/stock-counts";
export const documentNumber=(document:StockDocument)=>document.transferNumber??document.countNumber??"—";
export function stockActions(mode:StockDocumentMode,document:Pick<StockDocument,"status"|"createdById">,role:"OWNER"|"CASHIER",userId:string):StockAction[]{
  if(mode==="transfer")return role!=="OWNER"?[]:document.status==="DRAFT"?["submit","cancel"]:document.status==="PENDING"?["approve","reject","cancel"]:document.status==="APPROVED"?["complete"]:[];
  const creator=role==="OWNER"||document.createdById===userId;
  return document.status==="DRAFT"&&creator?["submit","cancel"]:document.status==="PENDING"&&role==="OWNER"?["approve","reject"]:[];
}
function scaledQuantity(value:string){if(!/^(0|[1-9]\d{0,10})(\.\d{1,3})?$/.test(value))throw new Error("Jumlah harus berupa angka positif atau nol, maksimal 3 desimal.");const[whole,fraction=""]=value.split(".");return BigInt(whole+fraction.padEnd(3,"0"));}
export function stockDifference(counted:string,system:string){const result=scaledQuantity(counted.trim())-scaledQuantity(system);const negative=result<BigInt(0);const text=(negative?-result:result).toString().padStart(4,"0");return `${negative?"-":""}${text.slice(0,-3)}.${text.slice(-3)}`.replace(/\.?0+$/,"");}
export function stockDraftPayload(mode:StockDocumentMode,number:string,sourceId:string,targetId:string,notes:string,items:StockDraftLine[]){
  if(notes.trim().length>1000)throw new Error("Catatan maksimal 1000 karakter.");
  const normalized=number.trim().toUpperCase();if(normalized.length<3||normalized.length>50)throw new Error("Nomor dokumen harus 3–50 karakter.");
  if(!sourceId||mode==="transfer"&&!targetId)throw new Error("Pilih lokasi stok yang diperlukan.");
  if(mode==="transfer"&&sourceId===targetId)throw new Error("Lokasi asal dan tujuan harus berbeda.");
  if(items.length<1||items.length>100)throw new Error("Dokumen harus berisi 1–100 produk.");
  if(new Set(items.map(item=>item.productId)).size!==items.length)throw new Error("Produk tidak boleh duplikat.");
  for(const item of items){if(!item.productId)throw new Error("Pilih produk untuk setiap baris.");const value=scaledQuantity(item.quantity.trim());if(mode==="transfer"&&value<=BigInt(0))throw new Error("Jumlah transfer harus lebih besar dari nol.");}
  return mode==="transfer"?{transferNumber:normalized,sourceLocationId:sourceId,targetLocationId:targetId,notes:notes.trim()||null,items:items.map(item=>({productId:item.productId,quantity:item.quantity.trim()}))}:{countNumber:normalized,locationId:sourceId,notes:notes.trim()||null,items:items.map(item=>({productId:item.productId,countedQuantity:item.quantity.trim()}))};
}

