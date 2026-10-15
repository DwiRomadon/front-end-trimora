"use client";
import { useState } from "react";

export const navigationGroups = [
    { label: "Operasional", items: ["dashboard", "pos", "history", "customers", "shifts", "attendance"] },
    { label: "Katalog & persediaan", items: ["services", "products", "inventory", "transfers", "counts"] },
    { label: "Keuangan", items: ["reports", "cash", "expenses", "refunds", "commissions"] },
    { label: "Tim & pengaturan", items: ["business", "barbers", "cashiers", "outlets", "audit", "subscriptions"] },
];

export const pageDescriptions: Record<string, string> = {
    attendance: "Kelola jadwal kerja dan kehadiran tim. Absensi terpisah dari shift kasir dan saldo kas.",
    business: "Atur logo bisnis yang ditampilkan pada struk pelanggan.",
    subscriptions: "Pilih paket, periksa masa aktif, dan kelola pesanan langganan bisnis.",
    dashboard: "Lihat perkembangan penjualan dan kinerja outlet Anda.",
    pos: "Pilih layanan atau produk, tentukan capster, lalu selesaikan pembayaran.",
    history: "Cari transaksi, lihat detail pembayaran, dan cetak ulang struk.",
    customers: "Kelola data pelanggan untuk mempercepat pelayanan berikutnya.",
    shifts: "Pantau shift kasir dan periksa kesesuaian kas saat penutupan.",
    services: "Atur layanan, harga per outlet, dan bahan yang digunakan.",
    products: "Kelola produk jual dan bahan kebutuhan layanan.",
    inventory: "Periksa stok, kelola lokasi penyimpanan, dan catat barang masuk.",
    transfers: "Pindahkan barang antar lokasi dan pantau penerimaannya.",
    counts: "Cocokkan stok fisik dengan catatan persediaan.",
    reports: "Tinjau penjualan, laba rugi, persediaan, dan rekap kas harian.",
    cash: "Catat uang masuk dan keluar, lalu periksa riwayat pergerakan kas.",
    expenses: "Catat dan kelola pengeluaran operasional bisnis.",
    refunds: "Tinjau pengembalian dana dan barang dari transaksi pelanggan.",
    commissions: "Atur komisi capster, periksa perhitungan, dan catat pembayaran.",
    barbers: "Kelola profil capster dan penugasannya di setiap outlet.",
    cashiers: "Kelola akun kasir dan akses outlet yang diberikan.",
    outlets: "Kelola informasi, kontak, dan status outlet bisnis Anda.",
    audit: "Telusuri aktivitas pengguna dan perubahan data bisnis.",
};

export default function WorkspaceNavigation({ menus, view, busy, onNavigate }: {
    menus: string[][]; view: string; busy: boolean; onNavigate: (id: string) => void;
}) {
    const [search, setSearch] = useState("");
    const [expanded, setExpanded] = useState(false);
    const query = search.trim().toLocaleLowerCase("id");
    const visible = menus.filter(([id, , label]) => `${label} ${pageDescriptions[id]}`.toLocaleLowerCase("id").includes(query));
    return <div className="navigation-shell">
        <button className="mobile-menu-toggle secondary" aria-expanded={expanded} aria-controls="workspace-navigation" onClick={() => setExpanded(!expanded)}>☰ <span>{expanded ? "Tutup menu" : "Menu fitur"}</span><strong>{menus.find(m => m[0] === view)?.[2]}</strong></button>
        <div id="workspace-navigation" className={`navigation-body ${expanded ? "is-open" : ""}`} onKeyDown={e => { if (e.key === "Escape") { setExpanded(false); e.currentTarget.parentElement?.querySelector<HTMLButtonElement>(".mobile-menu-toggle")?.focus(); } }}>
            <label className="navigation-search"><span>Cari fitur</span><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari menu atau pekerjaan…" /></label>
            <nav aria-label="Menu utama">{navigationGroups.map(group => {
                const items = group.items.flatMap(id => visible.filter(m => m[0] === id));
                return items.length > 0 && <section className="navigation-group" key={group.label}><h2>{group.label}</h2>{items.map(([id, icon, label]) => <button key={id} className={view === id ? "nav active" : "nav"} aria-current={view === id ? "page" : undefined} disabled={busy} onClick={() => { setExpanded(false); if (id !== view) onNavigate(id); }}><span aria-hidden="true">{icon}</span>{label}{id === "pos" && <small>POS</small>}</button>)}</section>;
            })}</nav>
            {!visible.length && <p className="navigation-empty" role="status">Fitur tidak ditemukan. Coba kata “stok”, “kas”, atau “pelanggan”.</p>}
        </div>
    </div>;
}
