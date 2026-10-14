export type CartItem = {
    key: string;
    type: "SERVICE" | "PRODUCT";
    id: string;
    name: string;
    price: string;
    quantity: string;
    barberId?: string;
    unit?: string;
};
export type Discount = {
    type: "NONE" | "NOMINAL" | "PERCENTAGE";
    value: string;
};
export type Payment = {
    method: string;
    cash: string;
    reference: string;
    confirmed: boolean;
};
function scaled(value: string, precision: number): bigint {
    if (!new RegExp(`^(0|[1-9]\\d*)(\\.\\d{1,${precision}})?$`).test(value))
        throw new Error("Nominal atau kuantitas tidak valid.");
    const [whole, fraction = ""] = value.split(".");
    return BigInt(whole + fraction.padEnd(precision, "0"));
}
export function decimal(cents: bigint): string { const text = cents.toString().padStart(3, "0"); return `${text.slice(0, -2)}.${text.slice(-2)}`; }
export function lineCents(item: CartItem): bigint { return (scaled(item.price, 2) * scaled(item.quantity || "0", 3) + BigInt(500)) / BigInt(1000); }
export function totals(cart: CartItem[], discount: Discount) {
    const subtotal = cart.reduce((sum, item) => sum + lineCents(item), BigInt(0));
    let amount = BigInt(0);
    if (discount.type === "NOMINAL")
        amount = scaled(discount.value || "0", 2);
    if (discount.type === "PERCENTAGE") {
        const percent = scaled(discount.value || "0", 2);
        if (percent > BigInt(10000))
            throw new Error("Persentase diskon maksimal 100%.");
        amount = (subtotal * percent + BigInt(5000)) / BigInt(10000);
    }
    if (amount > subtotal)
        throw new Error("Diskon tidak boleh melebihi subtotal.");
    return { subtotal: decimal(subtotal), discount: decimal(amount), total: decimal(subtotal - amount) };
}
export function checkoutPayload(outletId: string, cart: CartItem[], discount: Discount, payment: Payment, role: "OWNER" | "CASHIER", customerId: string | null, notes: string) {
    if (!cart.length || cart.length > 100)
        throw new Error("Pesanan harus berisi 1–100 baris item.");
    const estimate = totals(cart, discount);
    const items = cart.map(item => { if (item.type === "SERVICE") {
        const qty = Number(item.quantity);
        if (!item.barberId || !Number.isInteger(qty) || qty < 1 || qty > 20)
            throw new Error("Layanan memerlukan barber dan jumlah 1–20.");
        return { type: "SERVICE", serviceId: item.id, barberId: item.barberId, quantity: qty };
    } if (!/^(0|[1-9]\d{0,10})(\.\d{1,3})?$/.test(item.quantity) || Number(item.quantity) <= 0)
        throw new Error("Jumlah produk harus positif dengan maksimal 3 desimal."); return { type: "PRODUCT", productId: item.id, quantity: item.quantity }; });
    if (payment.method !== "CASH" && role !== "OWNER")
        throw new Error("Pembayaran non-tunai memerlukan konfirmasi owner.");
    if (payment.method === "CASH" && scaled(payment.cash, 2) < scaled(estimate.total, 2))
        throw new Error("Uang yang diterima belum mencukupi.");
    if (payment.method !== "CASH" && (!payment.confirmed || payment.reference.trim().length < 3 || Number(estimate.total) <= 0))
        throw new Error("Konfirmasi dan referensi pembayaran non-tunai wajib diisi.");
    return { outletId, customerId, items, discount: discount.type === "NONE" ? { type: "NONE" } : { type: discount.type, value: discount.type === "PERCENTAGE" ? Number(discount.value || "0") : discount.value || "0" }, payment: payment.method === "CASH" ? { method: "CASH", tenderedAmount: payment.cash } : { method: payment.method, reference: payment.reference.trim(), confirmed: true }, notes: notes.trim() || null };
}
