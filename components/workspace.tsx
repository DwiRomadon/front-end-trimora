"use client";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import Reports from "./reports";
import Attendance from "./attendance";
import { periodQuery } from "@/lib/admin";
import AdminDialog from "./admin-dialog";
import Subscriptions, { SubscriptionAccess } from "./subscriptions";
import WorkspaceNavigation, { navigationGroups, pageDescriptions } from "./workspace-navigation";
import PeopleAdmin from "./people-admin";
import { Shifts, AuditLogs } from "./monitoring";
import DashboardExtras from "./dashboard-extras";
import Management from "./management";
import Inventory from "./inventory";
import StockDocuments from "./stock-documents";
import Refunds from "./refunds";
import Commissions from "./commissions";
import Finance from "./finance";
import Pos from "./pos";
import ReceiptDialog from "./receipt";
import { type Resource } from "@/lib/resources";
import { api, ApiError, money, post, refresh, setToken } from "@/lib/api";
type Named = {
    id: string;
    name: string;
};
type Profile = {
    user: Named & {
        email: string;
    };
    business: Named;
    role: "OWNER" | "CASHIER" | "BARBER";
};
type Login = {
    businesses: (Named & {
        role: string;
    })[];
    selectionToken: string;
};
type Outlet = Named & {
    code: string;
    city?: string;
    address?: string;
};
type Overview = {
    totals: {
        revenue: string;
        transactions: number;
        grossMargin: string;
        averageTicket: string;
    };
    period: {
        dateFrom: string;
        dateTo: string;
    };
    byOutlet: {
        outlet: Named;
        transactions: number;
        revenue: string;
    }[];
};
type Trend = {
    data: {
        date: string;
        revenue: string;
    }[];
};
const errorText = (e: unknown) => e instanceof Error ? e.message : "Terjadi kesalahan. Silakan coba lagi.";
function Notice({ children, good = false }: {
    children: ReactNode;
    good?: boolean;
}) { return <div className={`notice ${good ? "good" : ""}`} role={good ? "status" : "alert"}>{children}</div>; }
function Empty({ children }: {
    children: ReactNode;
}) { return <div className="empty"><span>◎</span><p>{children}</p></div>; }
export default function Workspace() {
    const [accessGranted, setAccessGranted] = useState(false);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [boot, setBoot] = useState(true);
    const [error, setError] = useState("");
    const [outlets, setOutlets] = useState<Outlet[]>([]);
    const [outletId, setOutletId] = useState("");
    const [view, setView] = useState("dashboard");
    const [busy, setBusy] = useState(false);
    const [outletLoading, setOutletLoading] = useState(false);
    const [pendingOrder, setPendingOrder] = useState(false);
    const [pendingRecipe, setPendingRecipe] = useState(false);
    const [pendingStockDocument,setPendingStockDocument] = useState(false);
    const [pendingRefund,setPendingRefund] = useState(false);
    const [pendingCommission,setPendingCommission] = useState(false);
    const [pendingFinance,setPendingFinance] = useState(false);
    const [pendingAdmin,setPendingAdmin] = useState(false);
    const [navigation, setNavigation] = useState<{
        view?: string;
        outletId?: string;
        logout?: boolean;
    } | null>(null);
    function navigate(next: {
        view?: string;
        outletId?: string;
        logout?: boolean;
    }) {
        if (pendingOrder || pendingRefund || pendingCommission || pendingFinance || pendingAdmin || ((pendingRecipe || pendingStockDocument) && (next.view !== undefined || next.logout))) {
            setNavigation(next);
            return;
        }
        if (next.logout) {
            void logout();
            return;
        }
        if (next.view)
            setView(next.view);
        if (next.outletId !== undefined)
            setOutletId(next.outletId);
    }
    useEffect(() => {
        let live = true;
        refresh().then(() => api<Profile>("/auth/me")).then(p => {
            if (live) {
                setProfile(p);
                setView(p.role === "OWNER" ? "dashboard" : p.role === "BARBER" ? "attendance" : "pos");
            }
        }).catch(e => {
            if (live && (!(e instanceof ApiError) || e.status !== 401))
                setError(errorText(e));
        }).finally(() => {
            if (live)
                setBoot(false);
        });
        return () => { live = false; };
    }, []);
    async function loadOutlets() {
        setOutletLoading(true);
        setError("");
        try {
            const all: Outlet[] = [];
            for (let page = 1;; page++) {
                const data = await api<{
                    outlets: Outlet[];
                    pagination: {
                        hasNextPage: boolean;
                    };
                }>(`/outlets?status=ACTIVE&limit=100&page=${page}`);
                all.push(...data.outlets);
                if (!data.pagination.hasNextPage)
                    break;
            }
            setOutlets(all);
            setOutletId(id => all.some(o => o.id === id) ? id : all[0]?.id ?? "");
        }
        catch (e) {
            setError(errorText(e));
        }
        finally {
            setOutletLoading(false);
        }
    }
    useEffect(() => {
        let live = true;
        Promise.resolve().then(() => {
            if (live && profile && profile.role !== "BARBER" && accessGranted)
                void loadOutlets();
        });
        return () => { live = false; };
    }, [profile, accessGranted]);
    async function logout() {
        setBusy(true);
        setError("");
        try {
            await post("/auth/logout");
            setToken(null);
            setProfile(null);
            setAccessGranted(false);
            setOutlets([]);
            setOutletId("");
        }
        catch (e) {
            setError(errorText(e));
        }
        finally {
            setBusy(false);
        }
    }
    if (boot)
        return <div className="boot"><div className="brand">s<span>k</span></div><p>Menyiapkan workspace…</p></div>;
    if (!profile)
        return <Auth initialError={error} onLogin={p => { setProfile(p); setError(""); setView(p.role === "OWNER" ? "dashboard" : p.role === "BARBER" ? "attendance" : "pos"); }}/>;
    const menus = profile.role === "BARBER" ? [["attendance", "◷", "Absensi saya"]] : [["attendance", "◷", "Absensi"],...(profile.role === "OWNER" ? [["dashboard", "◫", "Ringkasan"]] : []), ["pos", "▦", "Kasir"], ["history", "◷", "Transaksi"], ["outlets", "⌂", "Outlet"], ...(profile.role === "OWNER" ? [["services", "✂", "Layanan"], ["barbers", "♙", "Tim barber"], ["products", "▣", "Produk"], ["customers", "◎", "Pelanggan"], ["inventory", "▥", "Persediaan"], ["transfers", "⇄", "Transfer stok"], ["refunds", "↶", "Refund"], ["commissions", "♧", "Komisi capster"], ["expenses", "▧", "Pengeluaran"], ["reports", "▥", "Laporan"], ["cashiers", "♟", "Tim kasir"], ["shifts", "◴", "Pemantauan shift"], ["audit", "☷", "Audit aktivitas"], ["subscriptions", "◇", "Langganan"]] : []), ["counts", "▤", "Stock opname"], ["cash", "⇅", "Kas masuk/keluar"]];
    const title = menus.find(m => m[0] === view)?.[2] ?? "Kasir";
    return <SubscriptionAccess key={profile.business.id} role={profile.role} onAllowed={setAccessGranted} onLogout={() => void logout()}><div className="workspace">
    <aside className="sidebar"><Link className="wordmark" href="/">studio<span>kasir.</span></Link><div className="business-card"><span className="avatar">{profile.business.name.slice(0, 1)}</span><div><strong>{profile.business.name}</strong><small>Barbershop workspace</small></div></div><WorkspaceNavigation menus={menus} view={view} busy={busy} onNavigate={id => navigate({ view: id })}/><div className="sidebar-bottom"><div className="user"><span className="avatar">{profile.user.name.slice(0, 1)}</span><div><strong>{profile.user.name}</strong><small>{profile.role === "OWNER" ? "Pemilik bisnis" : profile.role === "BARBER" ? "Barber" : "Kasir"}</small></div><button aria-label="Keluar" title="Keluar" onClick={() => navigate({ logout: true })} disabled={busy}>↪</button></div></div></aside>
    <main className="main" id="main-content"><header className="topbar"><span>{navigationGroups.find(group => group.items.includes(view))?.label} <span className="muted">/</span> <strong>{title}</strong></span><span className="pill">● {profile.role === "OWNER" ? "Pemilik" : profile.role === "BARBER" ? "Barber" : "Kasir"}</span></header><div className="content" data-feature={view}><div className="heading"><div><p className="eyebrow">STUDIO KASIR / {title.toUpperCase()}</p><h1>{view === "dashboard" ? "Ringkasan bisnis" : title}</h1><p className="muted">{pageDescriptions[view]}</p></div>{["dashboard", "pos", "history", "cash", "expenses", "commissions", "services", "products", "barbers", "customers"].includes(view) && <label className="outlet-select">Outlet operasional<select value={outletId} disabled={outletLoading || busy} onChange={e => navigate({ outletId: e.target.value })}>{!outlets.length && <option value="">{outletLoading ? "Memuat outlet…" : "Belum ada outlet"}</option>}{outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>}</div>
    {navigation && <AdminDialog brand="WORKSPACE" title="Perubahan belum selesai" busy={busy} onClose={()=>setNavigation(null)}><section className="workspace-navigation-confirm"><p>{pendingAdmin ? "Perubahan pengaturan belum disimpan. Meninggalkan halaman akan membuang isian. Jika pembuatan akun belum pasti, periksa email pada daftar sebelum mengulang." : pendingFinance ? "Form keuangan belum selesai. Jika status simpan belum pasti, periksa nomor catatan di riwayat sebelum mencatat ulang." : pendingCommission ? "Form komisi belum selesai. Jika pencatatan pembayaran belum pasti, periksa nomor pembayaran pada riwayat sebelum melanjutkan." : pendingRefund ? "Form refund belum disimpan. Periksa nomor refund pada daftar jika status penyimpanan belum pasti." : pendingStockDocument ? "Dokumen stok belum disimpan. Meninggalkan halaman akan membuang isian. Jika penyimpanan belum pasti, periksa nomor dokumen di daftar." : pendingRecipe ? "Perubahan resep belum disimpan. Meninggalkan halaman akan membuang perubahan tersebut." : "Pesanan belum selesai. Meninggalkan kasir akan menghapus keranjang. Jika status transaksi belum pasti, periksa riwayat sebelum membuat pesanan baru."}</p><div className="actions"><button className="secondary" onClick={() => setNavigation(null)}>{pendingAdmin ? "Lanjut edit pengaturan" : pendingFinance ? "Lanjut isi form" : pendingCommission ? "Lanjut isi komisi" : pendingRefund ? "Lanjut isi refund" : pendingStockDocument ? "Lanjut isi dokumen" : pendingRecipe ? "Lanjut edit resep" : "Tetap di kasir"}</button><button className="primary" disabled={busy} onClick={() => { const next = navigation; setNavigation(null); setPendingOrder(false); setPendingRefund(false); setPendingCommission(false); setPendingFinance(false); setPendingAdmin(false); setPendingRecipe(false); setPendingStockDocument(false); if (next.logout)
        void logout();
    else {
        if (next.view)
            setView(next.view);
        if (next.outletId !== undefined)
            setOutletId(next.outletId);
    } }}>{pendingAdmin ? "Buang perubahan pengaturan" : pendingFinance ? "Buang isian form" : pendingCommission ? "Buang isian komisi" : pendingRefund ? "Buang isian refund" : pendingStockDocument ? "Tutup form dokumen" : pendingRecipe ? "Buang perubahan resep" : "Tinggalkan kasir"}</button></div></section></AdminDialog>}
    {error && <Notice>{error} <button className="text-button" onClick={loadOutlets}>Coba lagi</button></Notice>}
    {view === "attendance" && <Attendance role={profile.role} scope={`${profile.business.id}:${profile.user.id}`} outlets={outlets} onBusyChange={setBusy} onDirtyChange={setPendingAdmin}/> }
    {view === "dashboard" && <Dashboard outletId={outletId}/>}
    {profile.role !== "BARBER" && view === "pos" && (outletId ? <Pos key={outletId} outletId={outletId} role={profile.role} onPendingChange={setPendingOrder} onBusyChange={setBusy}/> : <Empty>Pilih atau buat outlet aktif untuk memulai transaksi.</Empty>)}
    {profile.role !== "BARBER" && (view === "cash" || (view === "expenses" && profile.role === "OWNER")) && <Finance key={`${view}-${outletId}`} mode={view === "cash" ? "cash" : "expense"} role={profile.role} outletId={outletId} outlets={outlets} onDirtyChange={setPendingFinance} onBusyChange={setBusy}/>}
    {view === "subscriptions" && profile.role === "OWNER" && <Subscriptions onActivated={() => navigate({view:"dashboard"})}/>}
    {view === "reports" && profile.role === "OWNER" && <Reports/>}
    {view === "cashiers" && profile.role === "OWNER" && <PeopleAdmin mode="cashiers" onDirtyChange={setPendingAdmin} onBusyChange={setBusy} onOutletsChanged={loadOutlets}/>}
    {view === "shifts" && profile.role === "OWNER" && <Shifts/>}
    {view === "audit" && profile.role === "OWNER" && <AuditLogs/>}
    {view === "commissions" && profile.role === "OWNER" && <Commissions outletId={outletId} onDirtyChange={setPendingCommission} onBusyChange={setBusy}/>}
    {view === "refunds" && profile.role === "OWNER" && <Refunds onDirtyChange={setPendingRefund} onBusyChange={setBusy}/>}
    {view === "history" && <History key={outletId} outletId={outletId} owner={profile.role === "OWNER"} onDirtyChange={setPendingRefund} onBusyChange={setBusy}/>}
    {view === "outlets" && profile.role === "OWNER" && <PeopleAdmin mode="outlets" onDirtyChange={setPendingAdmin} onBusyChange={setBusy} onOutletsChanged={loadOutlets}/>}
    {view === "outlets" && profile.role !== "OWNER" && <div className="catalog">{outlets.map(o => <article className="panel" key={o.id}><span className="tile-icon">⌂</span><h2>{o.name}</h2><p className="muted">{o.code} · {o.city || "Kota belum diisi"}</p><p>{o.address || "Alamat belum diisi"}</p><span className="pill">● Aktif</span></article>)}{!outlets.length && <Empty>Belum ada outlet aktif yang dapat diakses.</Empty>}</div>}
    {profile.role === "OWNER" && ["services", "barbers", "products", "customers"].includes(view) && <Management key={view} resource={view as Resource} outlets={outlets} outletId={outletId} onRecipeDirty={setPendingRecipe} onRecipeBusy={setBusy}/>}
    {profile.role !== "BARBER" && view === "inventory" && <Inventory role={profile.role} outlets={outlets}/>}
    {profile.role !== "BARBER" && (view === "counts" || (view === "transfers" && profile.role === "OWNER")) && <StockDocuments key={view} mode={view === "transfers" ? "transfer" : "count"} role={profile.role} userId={profile.user.id} onDirtyChange={setPendingStockDocument} onBusyChange={setBusy}/>}
    <footer>studio kasir <span>Operasional rapi. Pelanggan happy.</span></footer></div></main></div></SubscriptionAccess>;
}
function Auth({ onLogin, initialError }: {
    onLogin: (p: Profile) => void;
    initialError: string;
}) {
    const [login, setLogin] = useState<Login | null>(null);
    const [register, setRegister] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(initialError);
    const [message, setMessage] = useState("");
    async function submit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        setBusy(true);
        setError("");
        setMessage("");
        try {
            const email = String(form.get("email")).trim();
            const password = String(form.get("password"));
            if (register) {
                await post("/auth/register-business", { business: { name: form.get("business"), slug: form.get("slug") }, owner: { name: form.get("name"), email, password } });
                setRegister(false);
                setMessage("Bisnis berhasil dibuat. Silakan masuk menggunakan akun Anda.");
            }
            else {
                setLogin(await post<Login>("/auth/login", { email, password }));
            }
        }
        catch (e) {
            setError(errorText(e));
        }
        finally {
            setBusy(false);
        }
    }
    async function select(id: string) {
        if (!login)
            return;
        setBusy(true);
        setError("");
        try {
            const p = await post<Profile & {
                accessToken: string;
            }>("/auth/select-business", { selectionToken: login.selectionToken, businessId: id });
            setToken(p.accessToken);
            onLogin(p);
        }
        catch (e) {
            setError(errorText(e));
        }
        finally {
            setBusy(false);
        }
    }
    return <div className="auth"><section className="auth-story"><Link href="/" className="wordmark">studio<span>kasir.</span></Link><div><p className="eyebrow">MADE FOR YOUR BARBERSHOP</p><h1>Bisnis tertata.<br />Fokus pada<br /><em>karya terbaik.</em></h1><p>Kelola layanan, tim, dan transaksi dalam satu workspace yang nyaman.</p><div className="story-art" aria-hidden="true"><span>✂</span><div>THE DAILY STUDIO<br /><small>GOOD CUTS. GREAT BUSINESS.</small></div></div></div><small>Teman kerja untuk setiap langkah bisnis Anda.</small></section><section className="auth-form"><div className="auth-box"><span className="pill">✦ Barbershop management</span><h2>{login ? "Pilih workspace" : register ? "Mulai perjalanan Anda" : "Selamat datang kembali"}</h2><p className="muted">{login ? "Pilih bisnis yang ingin Anda kelola." : register ? "Daftarkan bisnis dan akun pemilik Anda." : "Masuk untuk melanjutkan aktivitas barbershop Anda."}</p>
    {error && <Notice>{error}</Notice>}{message && <Notice good>{message}</Notice>}{login ? <><div className="business-options">{login.businesses.map(b => <button disabled={busy} className="business-option" key={b.id} onClick={() => select(b.id)}><span className="avatar">{b.name[0]}</span><div><strong>{b.name}</strong><small>{b.role}</small></div><span>→</span></button>)}{!login.businesses.length && <Empty>Akun ini belum memiliki akses bisnis aktif.</Empty>}</div><button className="text-button" disabled={busy} onClick={() => setLogin(null)}>← Kembali ke login</button></> : <form onSubmit={submit} key={String(register)}>{register && <><label>Nama bisnis<input name="business" required minLength={3} maxLength={150} placeholder="Contoh: Studio Barber"/></label><label>Slug bisnis<input name="slug" required minLength={3} maxLength={150} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="studio-barber"/><small>Huruf kecil, angka, dan tanda hubung.</small></label><label>Nama pemilik<input name="name" required minLength={3} maxLength={150} autoComplete="name"/></label></>}<label>Email<input name="email" type="email" required autoComplete="email" placeholder="nama@email.com"/></label><label>Password<input name="password" type="password" required minLength={register ? 12 : 1} maxLength={128} autoComplete={register ? "new-password" : "current-password"} placeholder={register ? "Minimal 12 karakter" : "Masukkan password Anda"}/></label><button className="primary full" disabled={busy}>{busy ? "Memproses…" : register ? "Buat bisnis →" : "Masuk ke workspace →"}</button><p className="switch-auth">{register ? "Sudah punya akun?" : "Baru memulai bisnis?"} <button type="button" className="text-button" disabled={busy} onClick={() => { setRegister(!register); setError(""); setMessage(""); }}>{register ? "Masuk" : "Daftar bisnis"}</button></p></form>}<p className="auth-note">Workspace terpisah untuk setiap bisnis Anda.</p></div></section></div>;
}
function Dashboard({ outletId }: {
    outletId: string;
}) {
    const [data, setData] = useState<Overview | null>(null);
    const [trend, setTrend] = useState<Trend | null>(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    const [version, setVersion] = useState(0);
    const [range,setRange]=useState(()=>{
        const to=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
        const from=new Date(Date.parse(to)-29*86400000).toISOString().slice(0,10);
        return {dateFrom:from,dateTo:to};
    });
    const [draft,setDraft]=useState(range);
    const [filterError,setFilterError]=useState("");
    function applyDates(e:FormEvent){e.preventDefault();try{periodQuery(draft.dateFrom,draft.dateTo,"",366);setRange({...draft});setFilterError("");setLoading(true);setVersion(v=>v+1);}catch(e){setFilterError(errorText(e));}}
    function preset(days:number){const to=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());const next={dateFrom:new Date(Date.parse(to)-(days-1)*86400000).toISOString().slice(0,10),dateTo:to};setDraft(next);setRange(next);setFilterError("");setLoading(true);setVersion(v=>v+1);}
    const filters=<section className="panel dashboard-date-panel"><form onSubmit={applyDates}><div><h2>Periode dashboard</h2><p className="muted">Seluruh ringkasan mengikuti periode ini · WIB</p></div><label>Dari tanggal<input type="date" required value={draft.dateFrom} onChange={e=>setDraft(v=>({...v,dateFrom:e.target.value}))}/></label><label>Sampai tanggal<input type="date" required min={draft.dateFrom} value={draft.dateTo} onChange={e=>setDraft(v=>({...v,dateTo:e.target.value}))}/></label><button className="primary" disabled={loading}>Terapkan tanggal</button></form><div className="actions">{[[1,"Hari ini"],[7,"7 hari terakhir"],[30,"30 hari terakhir"]].map(([days,label])=><button type="button" className="secondary" key={days} disabled={loading} onClick={()=>preset(Number(days))}>{label}</button>)}</div>{filterError&&<p className="notice" role="alert">{filterError}</p>}</section>;
    useEffect(() => {
        let live = true;
        Promise.resolve().then(() => {
            if (live) {
                setLoading(true);
                setError("");
            }
        });
        const query = `?${new URLSearchParams({...range,...(outletId?{outletId}:{})})}`;
        Promise.all([api<Overview>(`/dashboard/overview${query}`), api<Trend>(`/dashboard/sales-trend${query}`)]).then(([d, t]) => {
            if (live) {
                setData(d);
                setTrend(t);
            }
        }).catch(e => {
            if (live)
                setError(errorText(e));
        }).finally(() => {
            if (live)
                setLoading(false);
        });
        return () => { live = false; };
    }, [outletId, version, range]);
    if (loading)
        return <>{filters}<div className="skeleton-grid" aria-label="Memuat dashboard">{[1, 2, 3, 4].map(i => <div className="skeleton" key={i}/>)}</div></>;
    if (error)
        return <>{filters}<Notice>{error} <button className="text-button" onClick={() => setVersion(v => v + 1)}>Coba lagi</button></Notice></>;
    if (!data)
        return filters;
    const metrics = [["Pendapatan", money(data.totals.revenue), "↗"], ["Transaksi", String(data.totals.transactions), "▤"], ["Margin kotor", money(data.totals.grossMargin), "◈"], ["Rata-rata transaksi", money(data.totals.averageTicket), "◎"]];
    const max = Math.max(1, ...(trend?.data.map(t => Number(t.revenue)) ?? []));
    return <>{filters}<div className="period"><span className="pill">◷ {data.period.dateFrom} — {data.period.dateTo}</span><button className="secondary" onClick={() => setVersion(v => v + 1)}>↻ Perbarui</button></div><div className="metrics">{metrics.map(([label, value, icon], i) => <article className={`metric ${i === 0 ? "featured" : ""}`} key={label}><div><span>{label}</span><span className="metric-icon">{icon}</span></div><strong>{value}</strong><small>Dalam periode terpilih</small></article>)}</div><div className="dashboard-grid"><section className="panel"><div className="panel-heading"><div><h2>Tren pendapatan</h2><p className="muted">Penjualan harian dalam periode laporan</p></div><span className="legend">● Pendapatan</span></div>{data.totals.transactions ? <div className="chart" role="img" aria-label="Grafik pendapatan harian">{trend?.data.map(t => <div className="bar-track" key={t.date} title={`${t.date}: ${money(t.revenue)}`}><div className="bar" style={{ height: `${Math.max(1, Number(t.revenue) / max * 100)}%` }}/></div>)}</div> : <Empty>Belum ada penjualan dalam periode ini. Transaksi pertama Anda akan muncul di sini.</Empty>}<div className="chart-labels"><span>{data.period.dateFrom}</span><span>{data.period.dateTo}</span></div></section><section className="panel insight"><span className="tile-icon">✦</span><h2>Siap melayani<br />pelanggan berikutnya?</h2><p className="muted">Kelola transaksi layanan dan pembayaran melalui menu Kasir.</p><div className="insight-line"/><small>Pendapatan berasal dari transaksi selesai, sebelum penyesuaian refund.</small></section></div><section className="panel"><h2>Performa outlet</h2><div className="table-wrap"><table><thead><tr><th>Outlet</th><th>Transaksi</th><th>Pendapatan</th></tr></thead><tbody>{data.byOutlet.map(o => <tr key={o.outlet.id}><td>{o.outlet.name}</td><td>{o.transactions}</td><td>{money(o.revenue)}</td></tr>)}</tbody></table></div>{!data.byOutlet.length && <Empty>Performa outlet akan tampil setelah ada transaksi.</Empty>}</section><DashboardExtras key={`${outletId}-${version}`} outletId={outletId} dateFrom={data.period.dateFrom} dateTo={data.period.dateTo}/></>;
}
function History({ outletId, owner, onDirtyChange, onBusyChange }: { owner: boolean; onDirtyChange: (dirty: boolean) => void; onBusyChange: (busy: boolean) => void;
    outletId: string;
}) {
    type Transaction = {
        id: string;
        invoiceNumber: string;
        outlet: Named;
        grandTotal: string;
        status: string;
        completedAt: string;
        paymentMethods: string[];
    };
    const [rows, setRows] = useState<Transaction[]>([]);
    const [receiptId,setReceiptId] = useState<string|null>(null);
    const [refundId,setRefundId] = useState<string|null>(null);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [query, setQuery] = useState("");
    const [pages, setPages] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [version, setVersion] = useState(0);
    useEffect(() => {
        let live = true;
        Promise.resolve().then(() => {
            if (live) {
                setLoading(true);
                setError("");
            }
        });
        const params = new URLSearchParams({ page: String(page), limit: "10", search: query });
        if (outletId)
            params.set("outletId", outletId);
        api<{
            transactions: Transaction[];
            pagination: {
                totalPages: number;
            };
        }>(`/pos/transactions?${params}`).then(d => {
            if (live) {
                setRows(d.transactions);
                setPages(d.pagination.totalPages);
            }
        }).catch(e => {
            if (live)
                setError(errorText(e));
        }).finally(() => {
            if (live)
                setLoading(false);
        });
        return () => { live = false; };
    }, [page, query, outletId, version]);
    if (refundId && owner) return <Refunds initialTransactionId={refundId} onClose={()=>{setRefundId(null);setVersion(v=>v+1);}} onDirtyChange={onDirtyChange} onBusyChange={onBusyChange}/>;
    return <>{receiptId && <ReceiptDialog transactionId={receiptId} onClose={()=>setReceiptId(null)}/>}<section className="panel"><div className="panel-heading"><div><h2>Riwayat transaksi</h2><p className="muted">Telusuri transaksi barbershop Anda.</p></div><form className="search-form" onSubmit={e => { e.preventDefault(); setPage(1); setQuery(search); }}><input aria-label="Cari transaksi" type="search" placeholder="Cari nomor invoice…" maxLength={100} value={search} onChange={e => setSearch(e.target.value)}/><button className="secondary">Cari</button></form></div>{error ? <Notice>{error} <button className="text-button" onClick={() => setVersion(v => v + 1)}>Coba lagi</button></Notice> : loading ? <div className="skeleton"/> : <><div className="table-wrap"><table><thead><tr><th>Invoice</th><th>Waktu</th><th>Pembayaran</th><th>Status</th><th>Total</th><th>Struk</th></tr></thead><tbody>{rows.map(r => <tr key={r.id}><td><strong>{r.invoiceNumber}</strong><small>{r.outlet.name}</small></td><td>{new Date(r.completedAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}</td><td>{r.paymentMethods.join(", ")}</td><td><span className="pill">{r.status === "COMPLETED" ? "Selesai" : "Dibatalkan"}</span></td><td>{money(r.grandTotal)}</td><td><button className="text-button" onClick={()=>setReceiptId(r.id)}>Lihat struk</button>{owner && r.status === "COMPLETED" && <button className="text-button" onClick={()=>setRefundId(r.id)}>Ajukan refund</button>}</td></tr>)}</tbody></table></div>{!rows.length && <Empty>Belum ada transaksi yang sesuai dengan pencarian.</Empty>}<div className="pagination"><span>Halaman {page} dari {Math.max(1, pages)}</span><div><button className="secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Sebelumnya</button><button className="secondary" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Berikutnya →</button></div></div></>}</section></>;
}










