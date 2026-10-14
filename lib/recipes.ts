import type { Named } from "./resources";
export type Supply = Named & { sku: string; unit: string; status: string; isServiceSupply: boolean; category?: Named & { status: string } };
export type RecipeLine = { key: string; productId: string; quantity: string };
export type Recipe = { id: string; serviceId: string; isActive: boolean; items: { id: string; productId: string; quantity: string; product: Supply }[] };
export type Material = { productId: string; sku: string; name: string; unit: string; requiredQuantity: string; availableQuantity: string; averageCost: string; estimatedCost: string; enoughStock: boolean; validCost: boolean; isUsable: boolean };
export type MaterialEstimate = { outletId: string; serviceId: string; sellingPrice: string; estimatedMaterialCost: string; estimatedMarginBeforeOtherCosts: string; canFulfill: boolean; materials: Material[] };
export const isAvailableSupply = (supply: Supply) => supply.status === "ACTIVE" && supply.isServiceSupply && supply.category?.status === "ACTIVE";
export function recipePayload(items: RecipeLine[], isActive: boolean, supplies: Supply[]) {
  if(items.length < 1 || items.length > 100) throw new Error("Resep harus berisi 1–100 bahan.");
  if(new Set(items.map(item => item.productId)).size !== items.length) throw new Error("Bahan yang sama tidak boleh ditambahkan dua kali.");
  const available = new Set(supplies.filter(isAvailableSupply).map(supply => supply.id));
  for(const item of items) {
    if(!available.has(item.productId)) throw new Error("Pilih bahan aktif yang tersedia untuk setiap baris.");
    if(!/^(0|[1-9]\d{0,10})(\.\d{1,3})?$/.test(item.quantity.trim()) || Number(item.quantity) <= 0) throw new Error("Jumlah bahan harus positif, maksimal 3 angka desimal.");
  }
  return { isActive, items: items.map(({ productId, quantity }) => ({ productId, quantity: quantity.trim() })) };
}
function quantity(value: string) {
  if(!/^(0|[1-9]\d*)(\.\d{1,3})?$/.test(value)) throw new Error("Kuantitas stok tidak valid.");
  const [whole, fraction = ""] = value.split("."); return BigInt(whole + fraction.padEnd(3,"0"));
}
function formatQuantity(value: bigint) { const text = value.toString().padStart(4,"0"); return `${text.slice(0,-3)}.${text.slice(-3)}`.replace(/\.?0+$/, ""); }
export function readiness(estimate: MaterialEstimate, services: number) {
  if(!Number.isInteger(services) || services < 1 || services > 20) throw new Error("Simulasi jumlah layanan harus 1–20.");
  const materials = estimate.materials.map(material => {
    const needed = quantity(material.requiredQuantity) * BigInt(services); const available = quantity(material.availableQuantity);
    const enough = available >= needed;
    const reasons = [...(!material.isUsable ? ["Bahan tidak aktif / bukan bahan layanan"] : []), ...(!material.validCost ? ["Harga pokok belum valid"] : []), ...(!enough ? ["Stok tidak cukup"] : [])];
    return { ...material, requiredForServices: formatQuantity(needed), enoughForServices: enough, reasons, shortage: formatQuantity(needed > available ? needed - available : BigInt(0)), capacity: quantity(material.requiredQuantity) > BigInt(0) ? available / quantity(material.requiredQuantity) : BigInt(0) };
  });
  const ready = estimate.canFulfill && materials.length > 0 && materials.every(material => material.reasons.length === 0);
  const capacity = !estimate.canFulfill || materials.some(material => !material.isUsable || !material.validCost) || !materials.length ? BigInt(0) : materials.reduce((min,material) => material.capacity < min ? material.capacity : min, materials[0].capacity);
  return { ready, capacity: capacity.toString(), materials };
}
