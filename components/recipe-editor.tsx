"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import type { Named } from "@/lib/resources";
import { isAvailableSupply, readiness, recipePayload, type MaterialEstimate, type Recipe, type RecipeLine, type Supply } from "@/lib/recipes";
const message = (e: unknown) => e instanceof Error ? e.message : "Permintaan gagal diproses.";
const currency = (value: string) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0, maximumFractionDigits: 4 }).format(Number(value));
async function loadSupplies() {
  const rows: Supply[] = [];
  for(let page = 1; ; page++) {
    const data = await api<{ products: Supply[]; pagination: { hasNextPage: boolean } }>(`/products?status=ACTIVE&isServiceSupply=true&limit=100&page=${page}`);
    rows.push(...data.products.filter(isAvailableSupply));
    if(!data.pagination.hasNextPage) return rows;
  }
}
const fingerprint = (items: RecipeLine[], isActive: boolean) => JSON.stringify({ isActive, items: items.map(({ productId, quantity }) => ({ productId, quantity })) });
export default function RecipeEditor({ service, outlets, outletId, onClosed, onDirtyChange, onBusyChange }: { service: Named; outlets: Named[]; outletId?: string; onClosed: () => void; onDirtyChange: (dirty: boolean) => void; onBusyChange: (busy: boolean) => void }) {
  const [recipe, setRecipe] = useState<Recipe | null>(null); const [supplies, setSupplies] = useState<Supply[]>([]); const [items, setItems] = useState<RecipeLine[]>([]); const [isActive, setIsActive] = useState(true);
  const [baseline, setBaseline] = useState(fingerprint([],true)); const [loading, setLoading] = useState(true); const [loadError, setLoadError] = useState(""); const [error, setError] = useState(""); const [success, setSuccess] = useState(""); const [busy, setBusy] = useState(false); const [retry, setRetry] = useState(0); const [discard, setDiscard] = useState(false); const lock = useRef(false); const formRef = useRef<HTMLFormElement>(null);
  const dirty = fingerprint(items,isActive) !== baseline;
  useEffect(() => {
    let live = true;
    Promise.resolve().then(() => { if(live) { setLoading(true); setLoadError(""); } });
    const loadRecipe = api<Recipe>(`/services/${service.id}/recipe`).catch(e => { if(e instanceof ApiError && e.status === 404 && e.message === "Resep layanan belum dibuat") return null; throw e; });
    Promise.all([loadRecipe,loadSupplies()]).then(([saved,products]) => {
      if(!live) return;
      const lines = saved?.items.map(item => ({ key:item.id, productId:item.productId, quantity:item.quantity })) ?? [];
      setRecipe(saved); setSupplies(products); setItems(lines); setIsActive(saved?.isActive ?? true); setBaseline(fingerprint(lines,saved?.isActive ?? true));
    }).catch(e => { if(live) setLoadError(message(e)); }).finally(() => { if(live) setLoading(false); });
    return () => { live = false; };
  },[service.id,retry]);
  useEffect(() => { onDirtyChange(dirty); const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue=""; }; if(dirty) window.addEventListener("beforeunload",warn); return () => { window.removeEventListener("beforeunload",warn); onDirtyChange(false); }; },[dirty,onDirtyChange]);
  useEffect(() => { onBusyChange(busy); return () => { onBusyChange(false); }; },[busy,onBusyChange]);
  useEffect(() => { if(!loading && !loadError) formRef.current?.querySelector<HTMLSelectElement>("select")?.focus(); },[loading,loadError]);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if(lock.current) return; lock.current = true; setBusy(true); setError(""); setSuccess("");
    try {
      const body = recipePayload(items,isActive,supplies);
      const saved = await api<Recipe>(`/services/${service.id}/recipe`, { method:"PUT", body:JSON.stringify(body) });
      const lines = saved.items.map(item => ({ key:item.id, productId:item.productId, quantity:item.quantity }));
      setRecipe(saved); setItems(lines); setIsActive(saved.isActive); setBaseline(fingerprint(lines,saved.isActive)); setSuccess("Resep berhasil disimpan. Estimasi outlet memakai resep terbaru.");
    } catch(e) { setError(message(e)); } finally { setBusy(false); lock.current = false; }
  }
  function add() { const available = supplies.find(supply => !items.some(item => item.productId === supply.id)); if(available) { setItems(lines => [...lines,{key:crypto.randomUUID(),productId:available.id,quantity:"1"}]); setSuccess(""); } }
  function close() { if(dirty) setDiscard(true); else onClosed(); }
  const product = (id: string) => supplies.find(supply => supply.id === id) ?? recipe?.items.find(item => item.productId === id)?.product;
  return <div className="recipe-editor"><div className="panel-heading"><div><p className="eyebrow">RESEP LAYANAN</p><h2>{service.name}</h2><p className="muted">Atur pemakaian bahan untuk satu kali layanan.</p></div><button className="secondary" disabled={busy} onClick={close}>Tutup resep</button></div>
    {discard && <div className="notice status-confirm"><p>Perubahan resep belum disimpan. Tutup dan buang perubahan?</p><div className="actions"><button className="secondary" onClick={() => setDiscard(false)}>Lanjut edit</button><button className="primary" onClick={onClosed}>Buang perubahan</button></div></div>}
    {loadError && <div className="notice" role="alert">{loadError}<button className="text-button" onClick={() => setRetry(v=>v+1)}>Muat ulang resep</button></div>}
    {loading ? <div className="skeleton" aria-label="Memuat resep dan bahan"/> : !loadError && <>
      {!recipe && <div className="recipe-info"><span className="tile-icon">✦</span><div><strong>Mulai resep pertama</strong><p>Layanan ini belum memiliki resep. Tambahkan bahan agar stok dan HPP pemakaian bisa dihitung saat checkout.</p></div></div>}
      {success && <div className="notice good" role="status">{success}</div>}{error && <div className="notice" role="alert">{error}</div>}
      <form onSubmit={save} ref={formRef}><fieldset disabled={busy} className="recipe-fields"><div className="recipe-toolbar"><div><h3>Bahan per layanan</h3><p className="muted">{items.length} dari maksimal 100 bahan · jumlah mengikuti satuan produk</p></div><button type="button" className="secondary" disabled={items.length >= 100 || supplies.every(supply => items.some(item=>item.productId === supply.id))} onClick={add}>+ Tambah bahan</button></div>
        {items.map((item,index) => { const selected = product(item.productId); const usable = supplies.some(supply => supply.id === item.productId); return <div className="recipe-line" key={item.key}><span className="line-number">{String(index+1).padStart(2,"0")}</span><label>Bahan {index+1}<select aria-label={`Bahan ${index+1}`} required value={item.productId} onChange={e => { setItems(lines => lines.map(line => line.key === item.key ? {...line,productId:e.target.value} : line)); setSuccess(""); }}><option value="">Pilih bahan</option>{!usable && item.productId && <option value={item.productId}>{selected?.name ?? "Bahan lama"} — tidak tersedia</option>}{supplies.map(supply => <option key={supply.id} value={supply.id} disabled={supply.id !== item.productId && items.some(line=>line.productId === supply.id)}>{supply.name} ({supply.sku})</option>)}</select>{!usable && <small className="recipe-warning">Ganti bahan ini: produk atau kategorinya tidak aktif, atau bukan bahan layanan.</small>}</label><label>Jumlah per layanan<input aria-label={`Jumlah bahan ${index+1}`} type="number" required min="0.001" max="99999999999" step="0.001" value={item.quantity} onChange={e => { setItems(lines => lines.map(line => line.key === item.key ? {...line,quantity:e.target.value} : line)); setSuccess(""); }}/></label><span className="recipe-unit">{selected?.unit ?? "—"}</span><button type="button" className="secondary remove-line" aria-label={`Hapus bahan ${index+1}`} onClick={() => { setItems(lines => lines.filter(line => line.key !== item.key)); setSuccess(""); }}>×</button></div>; })}
        {!items.length && <div className="empty"><span>◎</span><p>{supplies.length ? "Tambahkan bahan pertama untuk menyusun resep." : "Belum ada bahan aktif. Di menu Produk, aktifkan opsi Bahan layanan dan pastikan kategorinya aktif."}</p></div>}
        <label className="checkbox recipe-active"><input type="checkbox" checked={isActive} onChange={e=>{setIsActive(e.target.checked);setSuccess("");}}/>Resep aktif</label>{!isActive && <div className="recipe-info warning"><p>Resep nonaktif akan membuat checkout layanan ini ditolak oleh backend. Aktifkan resep kembali agar layanan dapat dijual.</p></div>}
      </fieldset><div className="form-actions recipe-save"><span className="muted">{dirty ? "Ada perubahan yang belum disimpan" : recipe ? "Resep tersimpan" : "Belum ada resep tersimpan"}</span><button className="primary" disabled={busy || !items.length || !supplies.length || (!dirty && !!recipe)}>{busy ? "Menyimpan…" : "Simpan resep"}</button></div></form>
      <OutletEstimate key={`${recipe?.id ?? "new"}-${baseline}-${outletId ?? ""}`} recipe={recipe} serviceId={service.id} outlets={outlets} initialOutletId={outletId} dirty={dirty}/>
    </>}
  </div>;
}
function OutletEstimate({ recipe, serviceId, outlets, initialOutletId, dirty }: { recipe: Recipe|null; serviceId:string; outlets:Named[]; initialOutletId?:string; dirty:boolean }) {
  const [outletId,setOutletId] = useState(outlets.some(outlet => outlet.id === initialOutletId) ? initialOutletId! : outlets[0]?.id ?? ""); const [data,setData] = useState<MaterialEstimate|null>(null); const [loading,setLoading] = useState(false); const [error,setError] = useState(""); const [version,setVersion] = useState(0); const [count,setCount] = useState("1");
  useEffect(() => { let live = true; if(recipe?.isActive && outletId) { Promise.resolve().then(()=>{if(live){setLoading(true);setError("");setData(null);}}); api<MaterialEstimate>(`/outlets/${outletId}/services/${serviceId}/material-cost`).then(result=>{if(live)setData(result);}).catch(e=>{if(live)setError(message(e));}).finally(()=>{if(live)setLoading(false);}); } return()=>{live=false;}; },[recipe?.isActive,outletId,serviceId,version]);
  let simulation: ReturnType<typeof readiness>|null = null; let simulationError = "";
  if(data) try { simulation = readiness(data,Number(count)); } catch(e) { simulationError=message(e); }
  return <section className="recipe-estimate"><div className="panel-heading"><div><p className="eyebrow">KESIAPAN OUTLET</p><h2>Estimasi bahan & HPP</h2><p className="muted">HPP berdasarkan biaya rata-rata stok outlet. Margin belum memperhitungkan komisi dan biaya operasional.</p></div><button className="secondary" disabled={loading || !recipe?.isActive || !outletId} onClick={()=>setVersion(v=>v+1)}>↻ Perbarui stok</button></div>
    {dirty && <div className="recipe-info"><p>Estimasi berikut memakai resep terakhir yang tersimpan. Simpan perubahan untuk memperbarui perhitungan.</p></div>}
    {!recipe || !recipe.isActive ? <div className="empty"><span>◎</span><p>{!recipe ? "Simpan resep terlebih dahulu untuk memeriksa HPP dan ketersediaan bahan per outlet." : "Estimasi tersedia setelah resep aktif disimpan."}</p></div> : !outlets.length ? <div className="empty">Buat outlet aktif dan atur harga layanan terlebih dahulu.</div> : <>
      <div className="recipe-cost-controls"><label>Outlet untuk diperiksa<select aria-label="Outlet untuk diperiksa" value={outletId} onChange={e=>setOutletId(e.target.value)}>{outlets.map(outlet=><option key={outlet.id} value={outlet.id}>{outlet.name}</option>)}</select></label><label>Simulasi jumlah layanan<input type="number" min="1" max="20" step="1" value={count} onChange={e=>setCount(e.target.value)}/></label></div>
      {loading ? <div className="skeleton" aria-label="Menghitung HPP outlet"/> : error ? <div className="notice" role="alert">{error}<p>Pastikan layanan memiliki harga aktif dan outlet mempunyai lokasi stok aktif.</p><button className="text-button" onClick={()=>setVersion(v=>v+1)}>Coba lagi</button></div> : data && <>
        <div className="recipe-cost-metrics"><div><small>Harga satu layanan</small><strong>{currency(data.sellingPrice)}</strong></div><div><small>Estimasi HPP satu layanan</small><strong>{currency(data.estimatedMaterialCost)}</strong></div><div><small>Margin sebelum biaya lainnya</small><strong>{currency(data.estimatedMarginBeforeOtherCosts)}</strong></div></div>
        {simulationError && <div className="notice" role="alert">{simulationError}</div>}{simulation && <><div className={`recipe-readiness ${simulation.ready ? "ready" : "not-ready"}`} role="status"><div><strong>{simulation.ready ? `Bahan siap untuk ${count} layanan` : "Bahan belum siap untuk jumlah layanan ini"}</strong><p>Kapasitas berdasarkan bahan dan HPP saat diperiksa: {simulation.capacity} layanan.</p></div><span>{simulation.ready ? "✓" : "!"}</span></div><div className="table-wrap"><table><thead><tr><th>Bahan</th><th>Dipakai untuk {count} layanan</th><th>Stok tersedia</th><th>HPP / satuan</th><th>Kondisi</th></tr></thead><tbody>{simulation.materials.map(material=><tr key={material.productId}><td><strong>{material.name}</strong><small>{material.sku}</small></td><td>{material.requiredForServices} {material.unit}<small>{material.requiredQuantity} per layanan</small></td><td>{material.availableQuantity} {material.unit}</td><td>{currency(material.averageCost)}</td><td>{!material.reasons.length ? <span className="pill">Siap</span> : <><span className="pill inactive">Perlu diperiksa</span>{material.reasons.map(reason=><small key={reason}>{reason}</small>)}{!material.enoughForServices && <small>Kurang {material.shortage} {material.unit}</small>}</>}</td></tr>)}</tbody></table></div></>}
        <p className="muted editor-hint">Pemeriksaan ini tidak mengurangi atau memesan stok. Stok dan biaya aktual dihitung ulang oleh backend saat checkout.</p>
      </>}
    </>}
  </section>;
}

