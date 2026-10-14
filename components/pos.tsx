"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, ApiError, money, post } from "@/lib/api";
import { checkoutPayload, decimal, lineCents, totals, type CartItem, type Discount } from "@/lib/checkout";
import { type Named } from "@/lib/resources";
import { CloseShift } from "./operations";
import ReceiptDialog from "./receipt";
import AdminDialog from "./admin-dialog";
type Service = {
    price: string;
    service: Named & {
        duration: number;
        category: Named;
    };
};
type Product = Named & {
    sellingPrice: string;
    unit: string;
    category: Named & {
        status: string;
    };
    status: string;
};
type Shift = {
    hasActiveShift: boolean;
    shift: {
        outletId: string;
    } | null;
};
type Customer = Named & {
    code: string;
    phone: string | null;
};
type Receipt = { id: string; invoiceNumber: string };
const message = (e: unknown) => e instanceof Error ? e.message : "Terjadi kesalahan.";
async function productsForSale() { const result: Product[] = []; for (let page = 1;; page++) {
    const data = await api<{
        products: Product[];
        pagination: {
            hasNextPage: boolean;
        };
    }>(`/products?status=ACTIVE&isForSale=true&limit=100&page=${page}`);
    result.push(...data.products.filter(p => p.category?.status === "ACTIVE" && Number(p.sellingPrice) > 0));
    if (!data.pagination.hasNextPage)
        break;
} return result; }
export default function Pos({ outletId, role, onPendingChange, onBusyChange }: {
    outletId: string;
    role: "OWNER" | "CASHIER";
    onPendingChange: (pending: boolean) => void;
    onBusyChange: (busy: boolean) => void;
}) {
    const [services, setServices] = useState<Service[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [barbers, setBarbers] = useState<Named[]>([]);
    const [shift, setShift] = useState<Shift | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [barberId, setBarberId] = useState("");
    const [search, setSearch] = useState("");
    const [tab, setTab] = useState("services");
    const [cash, setCash] = useState("");
    const [method, setMethod] = useState("CASH");
    const [reference, setReference] = useState("");
    const [confirmed, setConfirmed] = useState(false);
    const [discount, setDiscount] = useState<Discount>({ type: "NONE", value: "0" });
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [notes, setNotes] = useState("");
    const [error, setError] = useState("");
    const [catalogError, setCatalogError] = useState("");
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(true);
    const [receipt, setReceipt] = useState<Receipt | null>(null);
    const [version, setVersion] = useState(0);
    const [uncertain, setUncertain] = useState(false);
    const checkoutRequest = useRef<{
        fingerprint: string;
        id: string;
    } | null>(null);
    const openRequest = useRef<{
        fingerprint: string;
        id: string;
    } | null>(null);
    const lock = useRef(false);
    const paymentForm = useRef<HTMLFormElement>(null);
    const orderPanel = useRef<HTMLElement>(null);
    const catalogPanel = useRef<HTMLElement>(null);
    const checkoutApproved = useRef(false);
    const [confirmCheckout,setConfirmCheckout]=useState(false);
    const [paymentOpen,setPaymentOpen]=useState(false);
    useEffect(() => { let live = true; Promise.resolve().then(() => { if (live) {
        setLoading(true);
        setCatalogError("");
    } }); Promise.allSettled([api<Service[]>(`/outlets/${outletId}/services`), api<Named[]>(`/outlets/${outletId}/barbers`), api<Shift>("/shifts/current"), productsForSale()]).then(result => { if (!live)
        return; const [s, b, h, p] = result; if (s.status === "fulfilled")
        setServices(s.value); if (b.status === "fulfilled") {
        setBarbers(b.value);
        setBarberId(id => b.value.some(x => x.id === id) ? id : b.value[0]?.id ?? "");
    } if (h.status === "fulfilled")
        setShift(h.value); if (p.status === "fulfilled")
        setProducts(p.value); const failed = result.filter(r => r.status === "rejected"); if (failed.length)
        setCatalogError(failed.map(r => message((r as PromiseRejectedResult).reason)).join(" · ")); setLoading(false); }); return () => { live = false; }; }, [outletId, version]);
    const active = shift?.hasActiveShift && shift.shift?.outletId === outletId;
    let estimate = { subtotal: "0.00", discount: "0.00", total: "0.00" };
    let estimateError = "";
    try {
        estimate = totals(cart, discount);
    }
    catch (e) {
        estimateError = message(e);
    }
    const frozen = busy || uncertain;
    useEffect(() => { onBusyChange(busy); return () => { onBusyChange(false); }; }, [busy, onBusyChange]);
    useEffect(() => { onPendingChange(cart.length > 0); const guard = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; }; if (cart.length)
        window.addEventListener("beforeunload", guard); return () => { window.removeEventListener("beforeunload", guard); }; }, [cart.length, onPendingChange]);
    function add(type: "SERVICE" | "PRODUCT", id: string, name: string, price: string, unit?: string) { setReceipt(null); setCart(c => { const key = `${type}-${id}-${type === "SERVICE" ? barberId : ""}`; const found = c.find(i => i.key === key); if (found)
        return c.map(i => i === found ? { ...i, quantity: String(Math.min(type === "SERVICE" ? 20 : 99999999999, Number(i.quantity) + 1)) } : i); return [...c, { key, type, id, name, price, quantity: "1", ...(type === "SERVICE" ? { barberId } : { unit }) }]; }); }
    async function open(e: FormEvent<HTMLFormElement>) { e.preventDefault(); if (lock.current)
        return; lock.current = true; setBusy(true); setError(""); const openingCash = String(new FormData(e.currentTarget).get("openingCash")); const fingerprint = JSON.stringify({ outletId, openingCash }); if (openRequest.current?.fingerprint !== fingerprint)
        openRequest.current = { fingerprint, id: crypto.randomUUID() }; try {
        await post("/shifts/open", { requestId: openRequest.current.id, outletId, openingCash });
        setVersion(v => v + 1);
    }
    catch (e) {
        setError(message(e));
    }
    finally {
        setBusy(false);
        lock.current = false;
    } }
    async function checkout(e: FormEvent<HTMLFormElement>) { e.preventDefault(); if (lock.current)
        return; lock.current = true; setBusy(true); setError(""); try {
        const payload = checkoutPayload(outletId, cart, discount, { method, cash, reference, confirmed }, role, customer?.id ?? null, notes);
        const fingerprint = JSON.stringify(payload);
        if (checkoutRequest.current?.fingerprint !== fingerprint)
            checkoutRequest.current = { fingerprint, id: crypto.randomUUID() };
        const result = await post<Receipt>("/pos/transactions/checkout", { ...payload, requestId: checkoutRequest.current.id });
        setPaymentOpen(false);
        setConfirmCheckout(false);
        setReceipt(result);
        setCart([]);
        setCash("");
        setReference("");
        setConfirmed(false);
        setDiscount({ type: "NONE", value: "0" });
        setCustomer(null);
        setNotes("");
        setUncertain(false);
        checkoutRequest.current = null;
    }
    catch (e) {
        if (e instanceof ApiError && (e.status === 0 || e.status >= 500 || (e.status === 409 && e.message.includes("requestId")))) {
            setUncertain(true);
            setError("Status transaksi belum dapat dipastikan. Coba ulang pesanan yang sama atau periksa riwayat transaksi sebelum membuat pesanan baru.");
        }
        else {
            setUncertain(false);
            setError(message(e));
        }
    }
    finally {
        setBusy(false);
        lock.current = false;
    } }
    if (loading)
        return <div className="skeleton" aria-label="Memuat kasir"/>;
    return <>{catalogError && <div className="notice" role="alert">{catalogError} <button className="text-button" onClick={() => setVersion(v => v + 1)}>Muat ulang katalog</button></div>}{error && <div className="notice" role="alert">{error}</div>}{!active && <section className="panel shift-panel"><div><h2>{shift?.hasActiveShift ? "Shift aktif di outlet lain" : "Mulai shift Anda"}</h2><p className="muted">{shift?.hasActiveShift ? "Pilih outlet yang sesuai dengan shift Anda." : "Catat saldo awal laci kas sebelum menerima transaksi."}</p></div>{shift && !shift.hasActiveShift && <form onSubmit={open}><label>Saldo awal (Rp)<input name="openingCash" type="number" min="0" max="999999999999" step="0.01" required defaultValue="0"/></label><button className="primary" disabled={busy}>Buka shift</button></form>}</section>}{active && <CloseShift locked={frozen || cart.length > 0} onClosed={() => { setReceipt(null); setVersion(v => v + 1); }}/>}
  <div className="pos-mobile-nav"><button type="button" className="secondary" onClick={()=>catalogPanel.current?.scrollIntoView({block:"start"})}>Pilih item</button><button type="button" className="primary" onClick={()=>{orderPanel.current?.scrollIntoView({block:"start"});orderPanel.current?.focus({preventScroll:true});}}>Pesanan ({cart.length}) · {money(estimate.total)}</button></div><div className="pos-grid"><section ref={catalogPanel} className="pos-catalog"><div className="pos-selection-tools"><div className="section-intro"><span className="step-badge">1</span><div><h2>Pilih layanan & produk</h2><p>Pilih capster sebelum menambahkan layanan.</p></div></div><div className="tabs" role="tablist" aria-label="Jenis item"><button role="tab" aria-selected={tab === "services"} className={tab === "services" ? "selected" : ""} onClick={() => {setTab("services");setSearch("");}}>✂ Layanan <span>{services.length}</span></button><button role="tab" aria-selected={tab === "products"} className={tab === "products" ? "selected" : ""} onClick={() => {setTab("products");setSearch("");}}>▣ Produk <span>{products.length}</span></button></div><div className="panel catalog-tools"><label>Cari {tab === "services" ? "layanan" : "produk"}<input type="search" placeholder="Cari nama item…" value={search} onChange={e => setSearch(e.target.value)}/></label>{tab === "services" && <label>Capster untuk layanan berikutnya<select value={barberId} onChange={e => setBarberId(e.target.value)}>{!barbers.length && <option value="">Belum ada barber</option>}{barbers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select><small>Item yang sudah masuk pesanan tetap memakai capster sebelumnya.</small></label>}</div></div><div className="pos-catalog-hint"><span>Klik item untuk menambahkan ke pesanan</span><span role="status" aria-live="polite">{cart.length} baris dipilih</span></div><div className="catalog">{tab === "services" ? services.filter(s => s.service.name.toLowerCase().includes(search.toLowerCase())).map(s => <button key={s.service.id} className="service-card" disabled={!active || !barberId || frozen || cart.length >= 100} onClick={() => add("SERVICE", s.service.id, s.service.name, s.price)}><div className="service-top"><span className="tile-icon">✂</span><span className="category">{s.service.category.name}</span></div><h3>{s.service.name}</h3><p className="muted">{s.service.duration} menit</p><div className="service-bottom"><strong>{money(s.price)}</strong><span className="pos-add-label">+ Tambah</span></div></button>) : products.filter(p => p.name.toLowerCase().includes(search.toLowerCase())).map(p => <button key={p.id} className="service-card" disabled={!active || frozen || cart.length >= 100} onClick={() => add("PRODUCT", p.id, p.name, p.sellingPrice, p.unit)}><div className="service-top"><span className="tile-icon">▣</span><span className="category">{p.category.name}</span></div><h3>{p.name}</h3><p className="muted">Harga per {p.unit.toLowerCase()}</p><div className="service-bottom"><strong>{money(p.sellingPrice)}</strong><span className="pos-add-label">+ Tambah</span></div></button>)}</div>{!(tab === "services" ? services.some(s => s.service.name.toLowerCase().includes(search.toLowerCase())) : products.some(p => p.name.toLowerCase().includes(search.toLowerCase()))) && <div className="empty"><span>◎</span><p>{search ? "Item tidak ditemukan." : tab === "services" ? "Belum ada layanan aktif dengan harga outlet." : "Belum ada produk aktif dengan harga jual. Stok divalidasi saat checkout."}</p></div>}</section>
  <section ref={orderPanel} tabIndex={-1} className="panel order"><div className="panel-heading"><h2><span className="step-badge">2</span> Periksa pesanan</h2><span className="pill">{cart.length} baris</span></div><div className="pos-customer-area"><CustomerPicker value={customer} onChange={setCustomer} disabled={frozen}/></div><div className="pos-cart-lines">{!cart.length && <div className="empty"><span>◎</span><p>Pilih layanan atau produk untuk mulai membuat pesanan.</p></div>}{cart.map(i => <div className="cart-item" key={i.key}><div><strong>{i.name}</strong><small>{i.type === "SERVICE" ? barbers.find(b => b.id === i.barberId)?.name : i.unit} · {money(i.price)}</small><div className="quantity"><span className="pos-quantity-label">Jumlah</span><input aria-label={`Jumlah ${i.name}`} type="number" value={i.quantity} min={i.type === "SERVICE" ? 1 : 0.001} max={i.type === "SERVICE" ? 20 : 99999999999} step={i.type === "SERVICE" ? 1 : 0.001} disabled={frozen} onChange={e => setCart(c => c.map(x => x.key === i.key ? { ...x, quantity: e.target.value } : x))}/><button type="button" aria-label={`Hapus ${i.name}`} disabled={frozen} onClick={() => setCart(c => c.filter(x => x.key !== i.key))}>×</button></div></div><strong>{money(decimal((() => { try {
        return lineCents(i);
    }
    catch {
        return BigInt(0);
    } })()))}</strong></div>)}</div>
  <div className="pos-order-footer"><div><span>Total estimasi</span><strong>{money(estimate.total)}</strong></div><button className="primary full" disabled={busy||!active||!cart.length} onClick={()=>{setConfirmCheckout(false);setPaymentOpen(true);}}>Lanjut pembayaran →</button><small>Diskon dan metode pembayaran di langkah berikutnya.</small></div></section></div>
  {paymentOpen&&<AdminDialog brand="KASIR" title={confirmCheckout?"Konfirmasi pembayaran":"Pembayaran pesanan"} busy={busy} onClose={()=>{if(confirmCheckout)setConfirmCheckout(false);else setPaymentOpen(false);}}><div className="pos-payment-modal">{error&&<p className="notice" role="alert">{error}</p>}<form className="pos-payment-form" hidden={confirmCheckout} ref={paymentForm} onSubmit={e=>{if(checkoutApproved.current){checkoutApproved.current=false;void checkout(e);}else{e.preventDefault();setConfirmCheckout(true);}}}><div className="section-intro payment-intro"><span className="step-badge">3</span><div><h3>Pembayaran</h3><p>Periksa total dan pilih metode pembayaran.</p></div></div><fieldset className="payment-fields" disabled={frozen}><label>Diskon<select value={discount.type} onChange={e => setDiscount({ type: e.target.value as Discount["type"], value: "0" })}><option value="NONE">Tanpa diskon</option><option value="NOMINAL">Nominal (Rp)</option><option value="PERCENTAGE">Persentase (%)</option></select></label>{discount.type !== "NONE" && <label>Nilai diskon<input type="number" min="0" max={discount.type === "PERCENTAGE" ? 100 : Number(estimate.subtotal)} step="0.01" required value={discount.value} onChange={e => setDiscount(d => ({ ...d, value: e.target.value }))}/></label>}<div className="order-breakdown"><div><span>Subtotal</span><strong>{money(estimate.subtotal)}</strong></div><div><span>Diskon</span><strong>− {money(estimate.discount)}</strong></div></div><div className="total"><span>Total estimasi</span><strong>{money(estimate.total)}</strong></div>{estimateError && <p className="notice" role="alert">{estimateError}</p>}<small className="muted">Total akhir dikonfirmasi saat transaksi disimpan.</small><label>Metode pembayaran<select value={method} onChange={e => { setMethod(e.target.value); setConfirmed(false); }}>{(role === "OWNER" ? ["CASH", "QRIS", "TRANSFER", "DEBIT", "EWALLET"] : ["CASH"]).map(m => <option key={m} value={m}>{m === "CASH" ? "Tunai" : m}</option>)}</select></label>{role === "CASHIER" && <small className="muted">Pembayaran non-tunai memerlukan konfirmasi owner.</small>}{method === "CASH" ? <><label>Uang diterima (Rp)<input required type="number" min={estimate.total} max="999999999999" step="0.01" value={cash} onChange={e => setCash(e.target.value)}/></label><div className="pos-cash-shortcuts"><button type="button" className="secondary" disabled={!cart.length||!!estimateError} onClick={()=>setCash(String(estimate.total))}>Uang pas</button>{[50000,100000,150000,200000].filter(amount=>amount>=Number(estimate.total)).slice(0,3).map(amount=><button type="button" className="secondary" key={amount} onClick={()=>setCash(String(amount))}>{money(amount)}</button>)}</div><div className="change"><span>Estimasi kembalian</span><strong>{money(Math.max(0, Number(cash) - Number(estimate.total)))}</strong></div></> : <><label>Referensi pembayaran<input required minLength={3} maxLength={150} value={reference} onChange={e => setReference(e.target.value)}/></label><label className="checkbox"><input type="checkbox" required checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/>Pembayaran telah diterima</label></>}<label>Catatan<input maxLength={1000} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opsional"/></label></fieldset><button className="primary full pos-pay-button" disabled={busy || !active || !cart.length || !!estimateError || (method !== "CASH" && !confirmed)}>{busy ? "Memproses…" : uncertain ? "Coba ulang pesanan yang sama" : "Selesaikan pembayaran →"}</button></form>{confirmCheckout&&<><p>Periksa pesanan sebelum menyelesaikan transaksi.</p><div className="document-overview"><div><small>Pelanggan</small><strong>{customer?.name||"Pelanggan umum"}</strong></div><div><small>Total estimasi</small><strong>{money(estimate.total)}</strong></div><div><small>Metode</small><strong>{method==="CASH"?"Tunai":method}</strong></div>{method==="CASH"&&<div><small>Uang diterima</small><strong>{money(cash||0)}</strong></div>}</div><p className="muted">{uncertain?"Mengirim ulang pesanan yang sama untuk memeriksa hasil transaksi sebelumnya.":"Pastikan pesanan dan pembayaran sudah sesuai. Struk tersedia setelah transaksi berhasil."}</p><div className="actions"><button className="secondary" autoFocus onClick={()=>setConfirmCheckout(false)}>Periksa kembali</button><button className="primary" disabled={busy} onClick={()=>{checkoutApproved.current=true;paymentForm.current?.requestSubmit();checkoutApproved.current=false;setConfirmCheckout(false);}}>Konfirmasi & selesaikan</button></div></>}</div></AdminDialog>}
  {receipt && <ReceiptDialog transactionId={receipt.id} onClose={()=>setReceipt(null)}/>}</>;
}
function CustomerPicker({ value, onChange, disabled }: {
    value: Customer | null;
    onChange: (c: Customer | null) => void;
    disabled: boolean;
}) {
    const [search, setSearch] = useState("");
    const [query, setQuery] = useState("");
    const [rows, setRows] = useState<Customer[]>([]);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    useEffect(() => { let live = true; if (query.length >= 2) {
        Promise.resolve().then(() => { if (live) {
            setLoading(true);
            setError("");
            setRows([]);
        } });
        api<{
            customers: Customer[];
        }>(`/customers/lookup?search=${encodeURIComponent(query)}&limit=10`).then(d => { if (live)
            setRows(d.customers); }).catch(e => { if (live)
            setError(message(e)); }).finally(() => { if (live)
            setLoading(false); });
    } return () => { live = false; }; }, [query]);
    if (value)
        return <div className="selected-customer"><span className="avatar">{value.name[0]}</span><div><strong>{value.name}</strong><small>{value.phone || value.code}</small></div><button type="button" className="text-button" disabled={disabled} onClick={() => onChange(null)}>Ganti</button></div>;
    return <div className="customer-picker"><label>Pelanggan (opsional)<input placeholder="Nama atau telepon, min. 2 karakter" value={search} maxLength={100} disabled={disabled} onChange={e => setSearch(e.target.value)}/></label><button className="text-button" type="button" disabled={disabled || search.trim().length < 2 || loading} onClick={() => setQuery(search.trim())}>{loading ? "Mencari…" : "Cari pelanggan"}</button>{error && <p role="alert" className="notice">{error}</p>}{query && !loading && !error && <div className="customer-results">{rows.map(c => <button type="button" key={c.id} disabled={disabled} onClick={() => { onChange(c); setQuery(""); setRows([]); }}><strong>{c.name}</strong><small>{c.phone || c.code}</small></button>)}{!rows.length && <p className="muted">Pelanggan tidak ditemukan. Pesanan dapat dilanjutkan sebagai tamu.</p>}</div>}</div>;
}

