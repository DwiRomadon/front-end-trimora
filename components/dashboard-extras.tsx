"use client";
import {useEffect,useState} from "react";
import {api} from "@/lib/api";
import {DataTable,errorText,Feedback,type Row} from "./admin-ui";
export default function DashboardExtras({outletId,dateFrom,dateTo}:{outletId:string;dateFrom:string;dateTo:string}){
    const [items,setItems]=useState<Row|null>(null),[barbers,setBarbers]=useState<Row[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(""),[version,setVersion]=useState(0);
    useEffect(()=>{let live=true;const q=new URLSearchParams({dateFrom,dateTo});if(outletId)q.set("outletId",outletId);Promise.all([api<Row>(`/dashboard/top-items?${q}`),api<{barbers:Row[]}>(`/dashboard/barber-performance?${q}`)]).then(([d,r])=>{if(live){setItems(d);setBarbers(r.barbers);}}).catch(e=>{if(live)setError(errorText(e));}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[outletId,dateFrom,dateTo,version]);
    const columns=[{label:"Nama",path:"name"},{label:"Jumlah",path:"quantity"},{label:"Pendapatan",path:"revenue",kind:"money" as const}];
    return <section className="panel dashboard-extras"><div className="panel-heading"><h2>Item terlaris & performa capster</h2><button className="secondary" onClick={()=>{setLoading(true);setError("");setVersion(v=>v+1);}}>Perbarui performa</button></div><Feedback error={error}/>{loading?<p>Memuat performa…</p>:!error&&items?<><h3>Layanan terlaris</h3><DataTable rows={items.services as Row[]} columns={columns}/><h3>Produk terlaris</h3><DataTable rows={items.products as Row[]} columns={columns}/><h3>Performa capster</h3><DataTable rows={barbers} columns={[{label:"Capster",path:"barber.name"},{label:"Item layanan",path:"serviceItemCount"},{label:"Jumlah layanan",path:"serviceQuantity"},{label:"Pendapatan layanan",path:"serviceRevenue",kind:"money"}]}/><p className="muted">Mengikuti periode ringkasan, transaksi selesai, dan filter outlet dashboard.</p></>:null}</section>;
}
