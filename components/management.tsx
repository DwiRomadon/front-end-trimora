"use client";
import EditorDialog from "./editor-dialog";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, money } from "@/lib/api";
import RecipeEditor from "./recipe-editor";
const ignoreChange = (_value: boolean) => { void _value; };
import { buildPayload, resources, type Named, type RecordRow, type Resource } from "@/lib/resources";
const message = (e: unknown) => e instanceof Error ? e.message : "Permintaan gagal diproses.";
const mutate = (path: string, method: string, body: unknown) => api(path, { method, body: JSON.stringify(body) });
type PageData = {
    rows: RecordRow[];
    total: number;
    pages: number;
};
async function loadPage(resource: Resource, page: number, search: string, status: string): Promise<PageData> {
    const params = new URLSearchParams();
    if (resources[resource].paginated) {
        params.set("page", String(page));
        params.set("limit", "10");
    }
    if (search)
        params.set("search", search);
    if (status)
        params.set("status", status);
    if (resources[resource].paginated) {
        const data = await api<Record<string, unknown>>(`/${resource}?${params}`);
        const pagination = data.pagination as {
            total: number;
            totalPages: number;
        };
        return { rows: data[resource] as RecordRow[], total: pagination.total, pages: pagination.totalPages };
    }
    const rows = await api<RecordRow[]>(`/${resource}${resource === "product-categories" ? `?${params}` : ""}`);
    const filtered = rows.filter(row => (!search || row.name.toLowerCase().includes(search.toLowerCase())) && (!status || row.status === status));
    return { rows: filtered, total: filtered.length, pages: 1 };
}
export default function Management({ resource, outlets, outletId, onRecipeDirty = ignoreChange, onRecipeBusy = ignoreChange }: {
    resource: Resource;
    outlets: Named[];
    outletId?: string;
    onRecipeDirty?: (dirty: boolean) => void;
    onRecipeBusy?: (busy: boolean) => void;
}) {
    const config = resources[resource];
    const [categoryMode, setCategoryMode] = useState(false);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [query, setQuery] = useState("");
    const [status, setStatus] = useState("");
    const [data, setData] = useState<PageData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [version, setVersion] = useState(0);
    const [editor, setEditor] = useState<RecordRow | "new" | null>(null);
    const [special, setSpecial] = useState<RecordRow | null>(null);
    const [recipeTarget, setRecipeTarget] = useState<RecordRow | null>(null);
    const [statusTarget, setStatusTarget] = useState<RecordRow | null>(null);
    const [busy, setBusy] = useState(false);
    const editorRef = useRef<HTMLElement | null>(null);
    useEffect(() => {
        let live = true;
        Promise.resolve().then(() => { if (live) {
            setLoading(true);
            setError("");
        } });
        loadPage(resource, page, query, status).then(result => { if (live)
            setData(result); }).catch(e => { if (live)
            setError(message(e)); }).finally(() => { if (live)
            setLoading(false); });
        return () => { live = false; };
    }, [resource, page, query, status, version]);
    useEffect(() => { if (editor || special || recipeTarget) {
        editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        editorRef.current?.querySelector<HTMLInputElement>("input:not([disabled]), select")?.focus();
    } }, [editor, special, recipeTarget]);
    function saved() { setEditor(null); setSpecial(null); setSuccess("Perubahan berhasil disimpan."); setVersion(v => v + 1); }
    async function changeStatus() {
        if (!statusTarget)
            return;
        setBusy(true);
        setError("");
        setSuccess("");
        const next = statusTarget.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
        const path = `/${resource}/${statusTarget.id}${resource === "service-categories" ? "" : "/status"}`;
        try {
            await mutate(path, "PATCH", { status: next });
            setStatusTarget(null);
            setVersion(v => v + 1);
            setSuccess(`Status ${config.singular} berhasil diubah.`);
        }
        catch (e) {
            setError(message(e));
        }
        finally {
            setBusy(false);
        }
    }
    if (categoryMode && config.category)
        return <><button className="secondary back-button" onClick={() => setCategoryMode(false)}>← Kembali ke {config.title.toLowerCase()}</button><Management key={config.category} resource={config.category} outlets={outlets}/></>;
    return <><section className="panel management-header"><div><h2>{config.title}</h2><p className="muted">{config.description}</p></div><div className="actions">{config.category && <button className="secondary" disabled={editor !== null || special !== null || recipeTarget !== null} onClick={() => setCategoryMode(true)}>Kelola kategori</button>}<button className="primary" disabled={busy || special !== null || editor !== null || recipeTarget !== null || statusTarget !== null} onClick={() => { setEditor("new"); setSuccess(""); }}>+ Tambah {config.singular}</button></div></section>
    {success && <div className="notice good" role="status">{success}</div>}
    {error && <div className="notice" role="alert">{error} <button className="text-button" onClick={() => setVersion(v => v + 1)}>Coba lagi</button></div>}
    {(editor || special) && <section className="panel editor-panel" ref={editorRef}>{editor && <EntityEditor key={editor === "new" ? "new" : editor.id} resource={resource} row={editor === "new" ? null : editor} outlets={outlets} onSaved={saved} onCancel={() => setEditor(null)}/>}{special && <OutletEditor key={special.id} resource={resource} row={special} outlets={outlets} onSaved={saved} onCancel={() => setSpecial(null)}/>}</section>}
    {recipeTarget && <section className="panel editor-panel" ref={editorRef}><RecipeEditor key={recipeTarget.id} service={recipeTarget} outlets={outlets} outletId={outletId} onDirtyChange={onRecipeDirty} onBusyChange={onRecipeBusy} onClosed={()=>{setRecipeTarget(null);setVersion(v=>v+1);}}/></section>}
    {statusTarget && <section className="notice status-confirm"><p>{statusTarget.status === "ACTIVE" ? `Nonaktifkan ${statusTarget.name}? Data ini tidak akan tersedia untuk transaksi baru.` : `Aktifkan kembali ${statusTarget.name}?`}</p><div className="actions"><button className="secondary" disabled={busy} onClick={() => setStatusTarget(null)}>Batal</button><button className="primary" disabled={busy} onClick={changeStatus}>{busy ? "Memproses…" : "Konfirmasi perubahan"}</button></div></section>}
    <section className="panel"><div className="management-toolbar"><form className="search-form" onSubmit={e => { e.preventDefault(); setPage(1); setQuery(search.trim()); }}><input aria-label={`Cari ${config.singular}`} type="search" placeholder={`Cari ${config.singular}…`} maxLength={100} value={search} onChange={e => setSearch(e.target.value)}/><button className="secondary">Cari</button></form><label>Status<select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">Semua status</option><option value="ACTIVE">Aktif</option><option value="INACTIVE">Nonaktif</option></select></label><span className="muted">{data?.total ?? 0} data</span></div>
    {loading ? <div className="skeleton" aria-label="Memuat data"/> : !error && <><div className="table-wrap"><table><thead><tr><th>Nama</th><th>{resource === "products" ? "Harga / satuan" : resource === "customers" ? "Kontak" : resource === "barbers" ? "Outlet" : "Informasi"}</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{data?.rows.map(row => <tr key={row.id}><td><strong>{row.name}</strong><small>{String(row.code ?? row.sku ?? row.slug ?? "")}</small></td><td><RowInfo resource={resource} row={row}/></td><td><span className={`pill ${row.status === "INACTIVE" ? "inactive" : ""}`}>{row.status === "ACTIVE" ? "Aktif" : "Nonaktif"}</span></td><td><div className="actions"><button className="text-button" disabled={busy || editor !== null || special !== null || recipeTarget !== null} onClick={() => { setEditor(row); setSuccess(""); }}>Edit</button>{(resource === "services" || resource === "barbers") && <button className="text-button" disabled={busy || editor !== null || special !== null || recipeTarget !== null} onClick={() => { setSpecial(row); setSuccess(""); }}>{resource === "services" ? "Harga outlet" : "Penugasan"}</button>}{resource === "services" && <button className="text-button" disabled={busy || editor !== null || special !== null || recipeTarget !== null} onClick={()=>{setRecipeTarget(row);setSuccess("");}}>Resep & HPP</button>}<button className="text-button" disabled={busy || editor !== null || special !== null || recipeTarget !== null} onClick={() => setStatusTarget(row)}>{row.status === "ACTIVE" ? "Nonaktifkan" : "Aktifkan"}</button></div></td></tr>)}</tbody></table></div>{!data?.rows.length && <div className="empty"><span>◎</span><p>Belum ada {config.singular} yang sesuai. Tambahkan data atau ubah pencarian Anda.</p></div>}{config.paginated && <div className="pagination"><span>Halaman {page} dari {Math.max(1, data?.pages ?? 1)}</span><div><button className="secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Sebelumnya</button><button className="secondary" disabled={page >= (data?.pages ?? 0)} onClick={() => setPage(p => p + 1)}>Berikutnya →</button></div></div>}</>}
    </section></>;
}
function RowInfo({ resource, row }: {
    resource: Resource;
    row: RecordRow;
}) {
    if (resource === "products")
        return <>{money(String(row.sellingPrice ?? "0"))}<small>{String(row.unit)} · minimum {String(row.minimumStock)}</small></>;
    if (resource === "customers")
        return <>{String(row.phone || "—")}<small>{String(row.email || "")}</small></>;
    if (resource === "barbers") {
        const assignments = row.assignments as {
            outlet: Named;
        }[];
        return <>{assignments?.map(a => a.outlet.name).join(", ") || "Belum ditugaskan"}</>;
    }
    if (resource === "services")
        return <>{String(row.duration)} menit<small>{(row.category as Named)?.name}</small></>;
    return <span className="muted">{String(row.description || "—")}</span>;
}
function EntityEditor({ resource, row, outlets, onSaved, onCancel }: {
    resource: Resource;
    row: RecordRow | null;
    outlets: Named[];
    onSaved: () => void;
    onCancel: () => void;
}) {
    const config = resources[resource];
    const [categories, setCategories] = useState<RecordRow[]>([]);
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(!!config.category);
    const [error, setError] = useState("");
    const [retry, setRetry] = useState(0);
    const request = useRef<{
        fingerprint: string;
        id: string;
    } | null>(null);
    const lock = useRef(false);
    useEffect(() => { let live = true; if (config.category)
        api<RecordRow[]>(`/${config.category}`).then(c => { if (live) {
            setCategories(c);
            setError("");
        } }).catch(e => { if (live)
            setError(message(e)); }).finally(() => { if (live)
            setLoading(false); }); return () => { live = false; }; }, [config.category, retry]);
    async function submit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (lock.current)
            return;
        lock.current = true;
        setBusy(true);
        setError("");
        const form = new FormData(e.currentTarget);
        const payload = buildPayload(resource, form, !!row);
        if (resource === "barbers" && !row)
            payload.outletIds = form.getAll("outletIds");
        if (resource === "customers" && !row) {
            const fingerprint = JSON.stringify(payload);
            if (request.current?.fingerprint !== fingerprint)
                request.current = { fingerprint, id: crypto.randomUUID() };
            payload.requestId = request.current.id;
        }
        try {
            if (resource === "barbers" && !row && !(payload.outletIds as string[]).length)
                throw new Error("Pilih setidaknya satu outlet untuk barber.");
            if (resource === "products" && !payload.isForSale && !payload.isServiceSupply)
                throw new Error("Produk harus dijual atau digunakan sebagai bahan layanan.");
            await mutate(`/${resource}${row ? `/${row.id}` : ""}`, row ? resource === "customers" ? "PUT" : "PATCH" : "POST", payload);
            onSaved();
        }
        catch (e) {
            setError(message(e));
        }
        finally {
            setBusy(false);
            lock.current = false;
        }
    }
    return <EditorDialog title={`${row ? "Edit" : "Tambah"} ${config.singular}`} busy={busy} onClose={onCancel}>{close => (<><div className="panel-heading"><div><h2>{row ? "Edit" : "Tambah"} {config.singular}</h2><p className="muted">{resource === "services" ? "Setelah disimpan, atur harga outlet agar layanan muncul di kasir." : "Isi informasi berikut. Kolom bertanda * wajib diisi."}</p></div><button className="secondary" disabled={busy} onClick={close}>Batal</button></div>{error && <div className="notice" role="alert">{error}{config.category && !categories.length && <button className="text-button" onClick={() => setRetry(v => v + 1)}>Muat ulang kategori</button>}</div>}<form className="entity-form" onSubmit={submit}><fieldset disabled={busy || loading} className="form-grid">{config.fields.map(field => {
            const initial = row?.[field.key] ?? field.default ?? "";
            const value = field.type === "date" ? String(initial).slice(0, 10) : String(initial);
            if (field.type === "checkbox")
                return <label key={field.key} className="checkbox"><input type="checkbox" name={field.key} defaultChecked={Boolean(initial)}/>{field.label}</label>;
            return <label key={field.key}>{field.label}{field.required ? " *" : ""}{field.type === "category" ? <select name={field.key} required defaultValue={value}><option value="">{loading ? "Memuat kategori…" : "Pilih kategori"}</option>{categories.filter(c => c.status === "ACTIVE" || c.id === value).map(c => <option key={c.id} value={c.id}>{c.name}{c.status !== "ACTIVE" ? " (nonaktif)" : ""}</option>)}</select> : field.type === "unit" ? <select name={field.key} defaultValue={value} disabled={!!row}><option value="PCS">PCS — buah</option><option value="ML">ML — mililiter</option><option value="GRAM">GRAM — gram</option></select> : <input name={field.key} type={field.type ?? "text"} defaultValue={value} required={field.required} min={field.min} max={field.max} step={field.step} minLength={field.minLength} maxLength={field.maxLength} pattern={field.pattern}/>}{field.immutable && row && <small>Satuan tetap setelah produk dibuat.</small>}</label>;
        })}{resource === "barbers" && !row && <fieldset className="outlet-choices"><legend>Penugasan outlet *</legend>{outlets.map(o => <label className="checkbox" key={o.id}><input type="checkbox" name="outletIds" value={o.id}/>{o.name}</label>)}{!outlets.length && <p className="muted">Buat outlet aktif terlebih dahulu.</p>}</fieldset>}</fieldset><div className="form-actions"><button className="primary" disabled={busy || loading || (!!config.category && !categories.length) || (resource === "barbers" && !row && !outlets.length)}>{busy ? "Menyimpan…" : "Simpan perubahan"}</button></div></form></>)}</EditorDialog>;
}
function OutletEditor({ resource, row, outlets, onSaved, onCancel }: {
    resource: Resource;
    row: RecordRow;
    outlets: Named[];
    onSaved: () => void;
    onCancel: () => void;
}) {
    const [detail, setDetail] = useState<RecordRow | null>(null);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [retry, setRetry] = useState(0);
    useEffect(() => { let live = true; api<RecordRow>(`/${resource}/${row.id}`).then(d => { if (live) {
        setDetail(d);
        setError("");
    } }).catch(e => { if (live)
        setError(message(e)); }); return () => { live = false; }; }, [resource, row.id, retry]);
    async function submit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setBusy(true);
        setError("");
        const form = new FormData(e.currentTarget);
        try {
            if (resource === "barbers") {
                const active = (detail?.assignments as {
                    outlet: Named;
                }[] ?? []).map(a => a.outlet.id);
                const invisible = active.filter(id => !outlets.some(o => o.id === id));
                if (invisible.length)
                    throw new Error("Barber masih memiliki penugasan ke outlet nonaktif. Aktifkan kembali outlet tersebut sebelum mengubah penugasan.");
                await mutate(`/barbers/${row.id}/outlets`, "PUT", { outletIds: [...invisible, ...form.getAll("outletIds")] });
            }
            else {
                const prices = outlets.filter(o => form.has(`include-${o.id}`)).map(o => ({ outletId: o.id, price: String(form.get(`price-${o.id}`)), isActive: form.has(`active-${o.id}`) }));
                if (!prices.length)
                    throw new Error("Pilih minimal satu outlet yang akan diperbarui.");
                await mutate(`/services/${row.id}/outlet-prices`, "PUT", { prices });
            }
            onSaved();
        }
        catch (e) {
            setError(message(e));
        }
        finally {
            setBusy(false);
        }
    }
    const assignments = (detail?.assignments ?? []) as {
        outlet: Named;
    }[];
    const prices = (detail?.outletPrices ?? []) as {
        outletId: string;
        price: string;
        isActive: boolean;
    }[];
    return <EditorDialog title={resource === "services" ? "Harga outlet" : "Penugasan capster"} busy={busy} onClose={onCancel}>{close => (<><div className="panel-heading"><div><h2>{resource === "services" ? "Harga per outlet" : "Penugasan outlet"}</h2><p className="muted">{row.name}</p></div><button className="secondary" disabled={busy} onClick={close}>Batal</button></div>{error && <div className="notice" role="alert">{error}{!detail && <button className="text-button" onClick={() => setRetry(v => v + 1)}>Coba lagi</button>}</div>}{!detail && !error ? <div className="skeleton"/> : detail && <form onSubmit={submit}><fieldset disabled={busy} className="outlet-choices">{outlets.map(o => { const price = prices.find(p => p.outletId === o.id); return resource === "barbers" ? <label key={o.id} className="checkbox"><input name="outletIds" type="checkbox" value={o.id} defaultChecked={assignments.some(a => a.outlet.id === o.id)}/>{o.name}</label> : <div className="price-row" key={o.id}><label className="checkbox"><input type="checkbox" name={`include-${o.id}`} defaultChecked={!!price}/>{o.name}</label><label>Harga (Rp)<input type="number" name={`price-${o.id}`} defaultValue={price?.price ?? "0"} min="0" max="999999999999" step="0.01" required/></label><label className="checkbox"><input name={`active-${o.id}`} type="checkbox" defaultChecked={price?.isActive ?? true}/>Tersedia di kasir</label></div>; })}</fieldset>{!outlets.length && <div className="empty">Belum ada outlet aktif.</div>}<p className="muted editor-hint">{resource === "services" ? "Centang outlet yang ingin diperbarui. Harga outlet lain tetap tersimpan." : "Barber hanya muncul di kasir outlet tempat ia ditugaskan."}</p><button className="primary" disabled={busy || !outlets.length}>{busy ? "Menyimpan…" : "Simpan pengaturan"}</button></form>}</>)}</EditorDialog>;
}


