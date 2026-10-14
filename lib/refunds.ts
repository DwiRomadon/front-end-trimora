export type RefundSale = { id: string; invoiceNumber: string; status: string; grandTotal: string; outlet: { id: string; name: string }; items: { id: string; type: string; productId: string | null; itemName: string; quantity: string }[] };
export type Refund = { id: string; refundNumber: string; status: "PENDING" | "COMPLETED" | "REJECTED"; method: string; amount: string; reason: string; reference: string | null; rejectionReason: string | null; transaction: { invoiceNumber: string; outletId: string; status: string }; items: { id: string; quantity: string; product: { name: string; unit: string } }[] };
export const refundMethods = { CASH: "Tunai", TRANSFER: "Transfer bank", QRIS: "QRIS", DEBIT: "Debit", EWALLET: "E-Wallet" };
export const refundStatuses = { PENDING: "Menunggu pengembalian dana", COMPLETED: "Selesai", REJECTED: "Ditolak" };
export function refundPayload(sale: RefundSale, number: string, method: string, reason: string, ids: string[]) {
    if (sale.status !== "COMPLETED") throw new Error("Hanya transaksi selesai yang dapat di-refund.");
    if (!Object.hasOwn(refundMethods, method)) throw new Error("Pilih metode refund.");
    if (number.trim().length < 3 || number.trim().length > 60) throw new Error("Nomor refund harus 3–60 karakter.");
    if (reason.trim().length < 5 || reason.trim().length > 1000) throw new Error("Alasan harus 5–1000 karakter.");
    const eligible = new Set(sale.items.filter(i => i.type === "PRODUCT" && i.productId).map(i => i.id));
    if (ids.length > 100 || new Set(ids).size !== ids.length || ids.some(id => !eligible.has(id))) throw new Error("Pilihan produk pengembalian tidak valid.");
    return { transactionId: sale.id, refundNumber: number.trim().toUpperCase(), method, reason: reason.trim(), returnItemIds: ids };
}
export function refundCompletion(confirmed: boolean, reference: string) {
    if (!confirmed) throw new Error("Konfirmasikan bahwa dana sudah dikembalikan.");
    const value = reference.trim();
    if (value && (value.length < 3 || value.length > 150)) throw new Error("Referensi harus 3–150 karakter.");
    return { confirmed: true, ...(value ? { reference: value } : {}) };
}
