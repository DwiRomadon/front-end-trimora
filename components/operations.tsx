"use client";
import { useState, type FormEvent } from "react";
import { api, money, post } from "@/lib/api";
type Summary = {
    summary: {
        openingCash: string;
        cashSales: string;
        cashRefunds: string;
        expectedCash: string;
        transactionCount: number;
    };
};
export function CloseShift({ onClosed, locked }: {
    onClosed: () => void;
    locked: boolean;
}) {
    const [summary, setSummary] = useState<Summary | null>(null);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [actual, setActual] = useState("");
    async function inspect() {
        setBusy(true);
        setError("");
        try {
            setSummary(await api<Summary>("/shifts/current/summary"));
        }
        catch (e) {
            setError(e instanceof Error ? e.message : "Ringkasan shift gagal dimuat.");
        }
        finally {
            setBusy(false);
        }
    }
    async function close(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
            await post("/shifts/current/close", { actualCash: actual, closingNotes: String(new FormData(e.currentTarget).get("notes") || "") });
            setSummary(null);
            onClosed();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : "Shift gagal ditutup.");
        }
        finally {
            setBusy(false);
        }
    }
    return <section className="panel shift-panel"><div><span className="pill">● Shift aktif</span><p className="muted">Selesaikan semua pesanan sebelum menutup shift.</p>{error && <p role="alert" className="notice">{error}</p>}{summary && <div className="shift-summary"><p>Transaksi: <strong>{summary.summary.transactionCount}</strong></p><p>Saldo awal: <strong>{money(summary.summary.openingCash)}</strong></p><p>Kas yang diharapkan: <strong>{money(summary.summary.expectedCash)}</strong></p></div>}</div>{!summary ? <button className="secondary" disabled={busy || locked} onClick={inspect}>{busy ? "Memuat…" : "Ringkasan & tutup shift"}</button> : <form onSubmit={close}><label>Kas aktual (Rp)<input type="number" required min="0" max="999999999999" step="0.01" value={actual} onChange={e => setActual(e.target.value)}/></label><label>Catatan penutupan<input name="notes" maxLength={1000} placeholder="Opsional"/></label><button className="primary" disabled={busy || locked}>Konfirmasi tutup shift</button><button className="secondary" type="button" disabled={busy} onClick={() => setSummary(null)}>Batal</button></form>}</section>;
}
export function CreateOutlet({ onCreated }: {
    onCreated: () => void;
}) {
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    async function submit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setBusy(true);
        setError("");
        const form = new FormData(e.currentTarget);
        try {
            await post("/outlets", { code: form.get("code"), name: form.get("name"), city: String(form.get("city") || ""), address: String(form.get("address") || "") });
            setOpen(false);
            onCreated();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : "Outlet gagal dibuat.");
        }
        finally {
            setBusy(false);
        }
    }
    return <section className="panel" style={{ marginBottom: 20 }}><div className="panel-heading"><div><h2>Outlet bisnis Anda</h2><p className="muted">Tambahkan lokasi baru untuk memulai operasional.</p></div><button className="primary" onClick={() => setOpen(!open)} disabled={busy}>{open ? "Batal" : "+ Tambah outlet"}</button></div>{open && <form className="create-outlet" onSubmit={submit}>{error && <p className="notice" role="alert">{error}</p>}<label>Nama outlet<input name="name" minLength={3} maxLength={150} required/></label><label>Kode outlet<input name="code" minLength={2} maxLength={30} required placeholder="OUT-01"/></label><label>Kota<input name="city" maxLength={100}/></label><label>Alamat<input name="address"/></label><button className="primary" disabled={busy}>{busy ? "Menyimpan…" : "Simpan outlet"}</button></form>}</section>;
}
