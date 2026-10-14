"use client";
import EditorDialog from "./editor-dialog";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, ApiError, money, post } from "@/lib/api";
import { type Named } from "@/lib/resources";
import { outletLocationChoices, type StockLocation as Location } from "@/lib/stock-locations";
type Stock = {
    id: string;
    quantity: string;
    averageCost: string;
    totalValue: string;
    product: Named & {
        sku: string;
        unit: string;
        minimumStock: string;
    };
    location: Named;
};
type Movement = {
    id: string;
    type: string;
    quantityChange: string;
    balanceAfter: string;
    createdAt: string;
    product: Named & {
        unit: string;
    };
    location: Named;
};
const message = (e: unknown) => e instanceof Error ? e.message : "Terjadi kesalahan.";
async function options<T>(path: string, key: string) { const rows: T[] = []; for (let page = 1;; page++) {
    const separator = path.includes("?") ? "&" : "?";
    const d = await api<Record<string, unknown>>(`${path}${separator}limit=100&page=${page}`);
    rows.push(...d[key] as T[]);
    if (!(d.pagination as {
        hasNextPage: boolean;
    }).hasNextPage)
        break;
} return rows; }
export default function Inventory({ outlets, role }: {
    outlets: Named[];
    role: "OWNER" | "CASHIER";
}) {
    const [locations, setLocations] = useState<Location[]>([]);
    const [products, setProducts] = useState<Named[]>([]);
    const [locationId, setLocationId] = useState("");
    const [page, setPage] = useState(1);
    const [view, setView] = useState("stocks");
    const [rows, setRows] = useState<(Stock | Movement)[]>([]);
    const [pages, setPages] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [version, setVersion] = useState(0);
    const [optionsLoading,setOptionsLoading] = useState(true);
    const [locationOptionsError,setLocationOptionsError] = useState("");
    const [productOptionsError,setProductOptionsError] = useState("");
    const optionsError=[locationOptionsError,productOptionsError].filter(Boolean).join(" · ");
    const [form, setForm] = useState<"location" | "stock" | null>(null);
    const [success, setSuccess] = useState("");
    useEffect(() => {
        let live = true;
        Promise.resolve().then(()=>{if(live){setOptionsLoading(true);setLocationOptionsError("");setProductOptionsError("");}});
        Promise.allSettled([options<Location>("/stock-locations", "locations"), role === "OWNER" ? options<Named>("/products?status=ACTIVE", "products") : Promise.resolve([])]).then(([locationResult,productResult])=>{
            if(!live)return;
            if(locationResult.status === "fulfilled")setLocations(locationResult.value);else setLocationOptionsError(message(locationResult.reason));
            if(productResult.status === "fulfilled")setProducts(productResult.value);else setProductOptionsError(message(productResult.reason));
            setOptionsLoading(false);
        });
        return()=>{live=false;};
    },[role,version]);    useEffect(() => { let live = true; Promise.resolve().then(() => { if (live) {
        setLoading(true);
        setError("");
    } }); const params = new URLSearchParams({ page: String(page), limit: "10" }); if (locationId)
        params.set("locationId", locationId); api<Record<string, unknown>>(`/inventory/${view}?${params}`).then(d => { if (live) {
        setRows(d[view] as (Stock | Movement)[]);
        setPages((d.pagination as {
            totalPages: number;
        }).totalPages);
    } }).catch(e => { if (live)
        setError(message(e)); }).finally(() => { if (live)
        setLoading(false); }); return () => { live = false; }; }, [locationId, page, view, version]);
    function saved() { setForm(null); setVersion(v => v + 1); setSuccess("Data persediaan berhasil disimpan."); }
    return <><section className="panel management-header"><div><h2>Persediaan</h2><p className="muted">Pantau saldo stok dan penerimaan barang di setiap lokasi.</p></div>{role === "OWNER" && <div className="actions"><button className="secondary" disabled={!!form} onClick={() => { setForm("location"); setSuccess(""); }}>+ Lokasi stok</button><button className="primary" disabled={!!form} onClick={() => { setForm("stock"); setSuccess(""); }}>+ Catat stok masuk</button></div>}</section>{success && <div className="notice good" role="status">{success}</div>}{error && <div className="notice" role="alert">{error}<button className="text-button" onClick={() => setVersion(v => v + 1)}>Coba lagi</button></div>}{optionsError && <div className="notice" role="alert">Data pilihan belum berhasil dimuat: {optionsError}<button className="text-button" onClick={()=>setVersion(v=>v+1)}>Muat ulang pilihan</button></div>}{form && <section className="panel editor-panel"><InventoryForm kind={form} locations={locations} products={products} outlets={outlets} optionsLoading={optionsLoading} optionsError={form === "location" ? locationOptionsError : optionsError} onUseLocation={id=>{setForm(null);setLocationId(id);setPage(1);setVersion(v=>v+1);setSuccess("Menampilkan persediaan pada lokasi yang dipilih.");}} onSaved={saved} onCancel={() => setForm(null)}/></section>}
  <section className="panel"><div className="list-section-heading"><h3>{view === "stocks" ? "Saldo persediaan" : "Riwayat pergerakan barang"}</h3><p>Pilih tampilan dan lokasi stok yang ingin diperiksa.</p></div><div className="management-toolbar"><div className="tabs"><button className={view === "stocks" ? "selected" : ""} onClick={() => { setView("stocks"); setPage(1); }}>Saldo stok</button><button className={view === "movements" ? "selected" : ""} onClick={() => { setView("movements"); setPage(1); }}>Mutasi stok</button></div><label>Lokasi<select value={locationId} onChange={e => { setLocationId(e.target.value); setPage(1); }}><option value="">Semua lokasi</option>{locations.map(l => <option key={l.id} value={l.id}>{l.name}{!l.isActive ? " (nonaktif)" : ""}</option>)}</select></label></div>{loading ? <div className="skeleton"/> : !error && <><div className="table-wrap"><table><thead><tr><th>Produk</th><th>Lokasi</th><th>{view === "stocks" ? "Saldo" : "Perubahan"}</th><th>{view === "stocks" ? role === "OWNER" ? "Nilai stok" : "Kondisi" : "Jenis / waktu"}</th></tr></thead><tbody>{rows.map(row => { if (view === "stocks") {
        const s = row as Stock;
        return <tr key={s.id}><td><strong>{s.product.name}</strong><small>{s.product.sku}</small></td><td>{s.location.name}</td><td>{s.quantity} {s.product.unit}<small>Minimum {s.product.minimumStock}</small></td><td>{role === "OWNER" ? money(s.totalValue) : Number(s.quantity) <= Number(s.product.minimumStock) ? "Stok menipis" : "Tersedia"}{role === "OWNER" && <small>HPP rata-rata {money(s.averageCost)}</small>}</td></tr>;
    } const m = row as Movement; return <tr key={m.id}><td>{m.product.name}</td><td>{m.location.name}</td><td>{m.quantityChange} {m.product.unit}<small>Saldo akhir {m.balanceAfter}</small></td><td>{m.type}<small>{new Date(m.createdAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}</small></td></tr>; })}</tbody></table></div>{!rows.length && <div className="empty"><span>◎</span><p>Belum ada data persediaan yang sesuai.</p></div>}<div className="pagination"><span>Halaman {page} dari {Math.max(1, pages)}</span><div><button className="secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Sebelumnya</button><button className="secondary" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Berikutnya →</button></div></div></>}</section></>;
}

function InventoryForm({ kind, locations, products, outlets, optionsLoading, optionsError, onUseLocation, onSaved, onCancel }: {
    kind: "location" | "stock";
    locations: Location[];
    products: Named[];
    outlets: Named[];
    optionsLoading: boolean;
    optionsError: string;
    onUseLocation: (id: string) => void;
    onSaved: () => void;
    onCancel: () => void;
}) {
    const [busy,setBusy]=useState(false);
    const [error,setError]=useState("");
    const [locationType,setLocationType]=useState("OUTLET");
    const [outletId,setOutletId]=useState("");
    const [entryType,setEntryType]=useState("receipts");
    const [uncertain,setUncertain]=useState(false);
    const reference=useRef<{fingerprint:string;id:string}|null>(null);
    const pending=useRef<{path:string;body:unknown}|null>(null);
    const lock=useRef(false);
    const choices=outletLocationChoices(outlets,locations);
    const selected=choices.find(outlet=>outlet.id===outletId);
    const existing=locationType === "CENTRAL" ? locations.find(location=>location.type === "CENTRAL") : selected?.location;
    const blocked=optionsLoading || !!optionsError;
    async function submit(e:FormEvent<HTMLFormElement>) {
        e.preventDefault();if(lock.current || blocked)return;
        lock.current=true;setBusy(true);setError("");
        const data=new FormData(e.currentTarget);
        try {
            if(uncertain && pending.current)await post(pending.current.path,pending.current.body);
            else if(kind === "location") {
                if(locationType === "OUTLET" && !selected)throw new Error("Pilih outlet aktif terlebih dahulu.");
                if(existing) {
                    if(!existing.isActive)await api(`/stock-locations/${existing.id}/status`,{method:"PATCH",body:JSON.stringify({isActive:true})});
                    onUseLocation(existing.id);return;
                }
                await post(`/stock-locations/${locationType === "CENTRAL" ? "central" : `outlet/${outletId}`}`,{name:data.get("name"),code:data.get("code")});
            } else {
                const body={productId:data.get("productId"),locationId:data.get("locationId"),quantity:data.get("quantity"),unitCost:data.get("unitCost"),notes:data.get("notes")};
                const fingerprint=JSON.stringify({entryType,...body});
                if(reference.current?.fingerprint !== fingerprint)reference.current={fingerprint,id:crypto.randomUUID()};
                pending.current={path:`/inventory/${entryType}`,body:{...body,referenceId:reference.current.id}};
                await post(pending.current.path,pending.current.body);
            }
            onSaved();
        } catch(e) {
            if(kind === "stock" && e instanceof ApiError && (e.status === 0 || e.status>=500 || (e.status===409 && e.message.includes("referenceId")))) {
                setUncertain(true);setError("Status pencatatan belum dapat dipastikan. Coba ulang dengan data yang sama, atau periksa mutasi stok sebelum mencatat penerimaan baru.");
            } else {setUncertain(false);setError(message(e));}
        } finally {setBusy(false);lock.current=false;}
    }
    return <EditorDialog title={kind === "location" ? "Lokasi stok" : "Catat stok masuk"} busy={busy} onClose={onCancel}>{close => (<><div className="panel-heading"><div><h2>{kind === "location" ? "Lokasi stok" : "Catat stok masuk"}</h2><p className="muted">{kind === "location" ? "Setiap outlet memiliki satu lokasi stok. Gunakan lokasi yang ada atau buat lokasi untuk outlet baru." : "Stok awal hanya bisa dicatat sekali untuk pasangan produk dan lokasi."}</p></div><button className="secondary" disabled={busy} onClick={close}>Batal</button></div>
    {error && <div className="notice" role="alert">{error}</div>}{optionsLoading && <p className="muted" role="status">Memuat lokasi dan produk…</p>}
    <form onSubmit={submit}><fieldset className="form-grid" disabled={busy || uncertain || blocked}>
    {kind === "location" ? <><label>Jenis lokasi<select value={locationType} onChange={e=>{setLocationType(e.target.value);setError("");}}><option value="OUTLET">Outlet</option><option value="CENTRAL">Gudang pusat</option></select></label>
    {locationType === "OUTLET" && <label>Outlet<select aria-label="Outlet lokasi stok" name="outletId" required value={outletId} onChange={e=>{setOutletId(e.target.value);setError("");}}><option value="">{outlets.length ? "Pilih outlet" : "Belum ada outlet aktif"}</option>{choices.map(outlet=><option key={outlet.id} value={outlet.id}>{outlet.label}</option>)}</select>{!outlets.length && <small>Tambahkan atau aktifkan outlet di menu Outlet terlebih dahulu.</small>}</label>}
    {existing ? <div className="existing-stock-location"><span className={`pill ${existing.isActive ? "" : "inactive"}`}>{existing.isActive ? "Lokasi aktif" : "Lokasi nonaktif"}</span><h3>{existing.name}</h3><p className="muted">Kode: {existing.code}</p><p>{existing.isActive ? "Lokasi stok sudah tersedia. Gunakan lokasi ini untuk melihat stok atau mencatat penerimaan barang." : "Lokasi stok sudah ada tetapi nonaktif. Aktifkan lokasi yang sama untuk melanjutkan pencatatan stok."}</p></div> : <><label>Nama lokasi *<input name="name" required minLength={3} maxLength={150}/></label><label>Kode lokasi *<input name="code" required minLength={2} maxLength={30}/></label></>}
    </> : <><label>Jenis pencatatan<select value={entryType} onChange={e=>setEntryType(e.target.value)}><option value="receipts">Penerimaan barang</option><option value="opening-stock">Stok awal</option></select></label><label>Lokasi *<select name="locationId" required><option value="">Pilih lokasi</option>{locations.filter(location=>location.isActive).map(location=><option value={location.id} key={location.id}>{location.name}</option>)}</select></label><label>Produk *<select name="productId" required><option value="">Pilih produk</option>{products.map(product=><option value={product.id} key={product.id}>{product.name}</option>)}</select></label><label>Jumlah *<input name="quantity" required type="number" min="0.001" max="99999999999" step="0.001"/></label><label>Harga pokok per satuan (Rp) *<input name="unitCost" required type="number" min="0" max="9999999999" step="0.0001"/></label><label>Catatan<input name="notes" maxLength={1000}/></label></>}
    </fieldset><div className="form-actions"><button className="primary" disabled={busy || blocked || (kind === "location" && locationType === "OUTLET" && !selected) || (kind === "stock" && (!products.length || !locations.some(location=>location.isActive)))}>{busy ? "Memproses…" : kind === "location" && existing ? existing.isActive ? "Gunakan lokasi ini" : "Aktifkan & gunakan lokasi" : uncertain ? "Coba ulang pencatatan yang sama" : "Simpan pencatatan"}</button></div></form></>)}</EditorDialog>;
}

