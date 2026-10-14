export type Person = { id: string; name: string; code?: string; status?: string };
export type CommissionRule = { barberId: string; barber: Person; type: "PERCENTAGE" | "FIXED"; value: string };
export type PayoutPreview = { barber: Person; entriesCount: number; grossAmount: string; outstandingRecovery: string; recoveryAmount: string; payableAmount: string; canPay: boolean };
export type Payout = { id: string; payoutNumber: string; barber: Person; method: string; grossAmount: string; recoveryAmount: string; amount: string; reference: string | null; notes?: string | null; createdAt: string; createdBy?: Person; entries?: { id: string; amount: string; commissionEntry: { transaction: {invoiceNumber: string}; transactionItem: {itemName: string} } }[]; recoveries?: { id: string; amount: string; recovery: {reason: string} }[] };
export const commissionMoney = (value: string) => new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:2}).format(Number(value));
export function commissionRulePayload(type: string, value: string) {
    const normalized = value.trim();
    if (type === "PERCENTAGE") {
        if (!/^\d+(\.\d+)?$/.test(normalized) || !Number.isFinite(Number(normalized)) || Number(normalized) > 100) throw new Error("Persentase harus 0–100.");
        return { type: "PERCENTAGE", value: Number(normalized) };
    }
    if (type !== "FIXED" || !/^(0|[1-9]\d{0,11})(\.\d{1,2})?$/.test(normalized)) throw new Error("Nominal harus positif atau nol, maksimal 2 desimal.");
    return { type: "FIXED", value: normalized };
}
export function commissionPeriod(barberId: string, dateFrom: string, dateTo: string) {
    if (!barberId) throw new Error("Pilih capster.");
    if (dateFrom && dateTo && dateFrom > dateTo) throw new Error("Tanggal akhir harus setelah atau sama dengan tanggal awal.");
    return { barberId, ...(dateFrom ? { dateFrom } : {}), ...(dateTo ? { dateTo } : {}) };
}
export function commissionPayoutPayload(period: ReturnType<typeof commissionPeriod>, preview: PayoutPreview, requestId: string, method: string, reference: string, notes: string, confirmed: boolean) {
    if (!preview.canPay || preview.barber.id !== period.barberId) throw new Error("Tidak ada komisi siap dibayar untuk capster ini.");
    if (!confirmed) throw new Error("Konfirmasikan dana sudah dibayarkan.");
    if (method !== "CASH" && method !== "TRANSFER") throw new Error("Pilih tunai atau transfer.");
    const ref = reference.trim();
    if (method === "TRANSFER" && !ref || ref && (ref.length < 3 || ref.length > 150)) throw new Error("Referensi transfer wajib, 3–150 karakter.");
    if (notes.trim().length > 1000) throw new Error("Catatan maksimal 1000 karakter.");
    return { ...period, requestId, method, confirmed: true, ...(ref ? {reference: ref} : {}), ...(notes.trim() ? {notes: notes.trim()} : {}), expected: {grossAmount: preview.grossAmount, recoveryAmount: preview.recoveryAmount, payableAmount: preview.payableAmount} };
}
