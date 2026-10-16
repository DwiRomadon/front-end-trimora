export type CartItem = {
    key: string;
    type: "SERVICE" | "PRODUCT";
    id: string;
    name: string;
    price: string;
    quantity: string;
    barberId?: string;
    unit?: string;
    commissionRequired?: boolean;
    discount?: { id: string; name: string; type: "FIXED" | "PERCENTAGE"; value: string };
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
export function itemDiscountCents(item: CartItem): bigint {
    if (!item.discount) return BigInt(0);
    const value = scaled(item.discount.value, 2), subtotal = lineCents(item);
    if (item.discount.type === "PERCENTAGE" && value > BigInt(10000)) throw new Error("Persentase diskon maksimal 100%.");
    const amount = item.discount.type === "FIXED" ? value : (subtotal * value + BigInt(5000)) / BigInt(10000);
    if (amount > subtotal) throw new Error(`Diskon ${item.name} melebihi nilai item.`);
    return amount;
}
export function lineNetCents(item: CartItem): bigint { return lineCents(item) - itemDiscountCents(item); }
export function totals(cart: CartItem[], discount: Discount) {
    const subtotal = cart.reduce((sum, item) => sum + lineCents(item), BigInt(0));
    const amount = cart.reduce((sum, item) => sum + itemDiscountCents(item), BigInt(0));
    if (discount.type !== "NONE") throw new Error("Pilih master diskon pada masing-masing item.");
    return { subtotal: decimal(subtotal), discount: decimal(amount), total: decimal(subtotal - amount) };
}
export type NewCustomer = { name: string; phone: string; address: string };
export function checkoutPayload(outletId: string, cart: CartItem[], discount: Discount, payment: Payment, role: "OWNER" | "CASHIER", customerId: string | null, notes: string, customer?: NewCustomer) {
    if (role !== "OWNER" && role !== "CASHIER") throw new Error("Akses kasir diperlukan.");
    if (!cart.length || cart.length > 100) throw new Error("Pesanan harus berisi 1–100 baris item.");
    if (!customerId && !customer?.name.trim()) throw new Error("Nama pelanggan wajib diisi.");
    if (!customerId && customer) {
        if (customer.name.trim().length > 150 || customer.address.trim().length > 1000) throw new Error("Nama atau alamat pelanggan terlalu panjang.");
        if (customer.phone.trim() && !/^\+?[0-9]{9,20}$/.test(customer.phone.trim())) throw new Error("No. HP harus berisi 9–20 digit, boleh diawali +.");
    }
    const estimate = totals(cart, discount);
    const items = cart.map(item => {
        const reduction = item.discount ? { discountId: item.discount.id } : {};
        if (item.type === "SERVICE") {
            const quantity = Number(item.quantity);
            if (!item.barberId || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw new Error("Layanan memerlukan barber dan jumlah 1–20.");
            return { type: "SERVICE", serviceId: item.id, barberId: item.barberId, quantity, ...reduction };
        }
        if (!/^(0|[1-9]\d{0,10})(\.\d{1,3})?$/.test(item.quantity) || Number(item.quantity) <= 0) throw new Error("Jumlah produk harus positif dengan maksimal 3 desimal.");
        if (item.commissionRequired && !item.barberId) throw new Error(`Pilih penerima komisi untuk ${item.name}.`);
        return { type: "PRODUCT", productId: item.id, quantity: item.quantity, ...(item.commissionRequired ? { barberId: item.barberId } : {}), ...reduction };
    });
    if (!["CASH","QRIS","TRANSFER","DEBIT","EWALLET"].includes(payment.method)) throw new Error("Metode pembayaran tidak valid.");
    if (payment.method === "CASH" && scaled(payment.cash, 2) < scaled(estimate.total, 2)) throw new Error("Uang yang diterima belum mencukupi.");
    if (payment.method !== "CASH" && (!payment.confirmed || Number(estimate.total) <= 0)) throw new Error("Konfirmasi pembayaran non-tunai wajib diisi dan total harus positif.");
    return { outletId, expectedTotal: estimate.total, ...(customerId ? {customerId} : {customer:{name:customer!.name.trim(),phone:customer!.phone.trim()||null,address:customer!.address.trim()||null}}), items, discount: { type: "NONE" }, payment: payment.method === "CASH" ? { method: "CASH", tenderedAmount: payment.cash } : { method: payment.method, confirmed: true }, notes: notes.trim() || null };
}
