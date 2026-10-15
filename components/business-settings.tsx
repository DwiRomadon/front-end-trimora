"use client";
import {useEffect,useRef,useState} from "react";
import Image from "next/image";
import {api} from "@/lib/api";
import {Feedback,errorText,useDraft} from "./admin-ui";
import AdminDialog from "./admin-dialog";

type Business={id:string;name:string;logoUrl:string|null};
async function prepareLogo(file:File):Promise<string> {
 if(!["image/png","image/jpeg","image/webp"].includes(file.type))throw new Error("Gunakan gambar PNG, JPG, atau WebP.");
 if(file.size>5*1024*1024)throw new Error("Ukuran file maksimal 5 MB.");
 const url=URL.createObjectURL(file);
 try{
  const img=new window.Image();img.src=url;await img.decode();
  if(!img.naturalWidth||!img.naturalHeight)throw new Error("Gambar tidak dapat dibaca.");
  let edge=512;
  while(edge>=128){
   const scale=Math.min(1,edge/Math.max(img.naturalWidth,img.naturalHeight));
   const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
   const context=canvas.getContext("2d");if(!context)throw new Error("Browser tidak mendukung pengolahan gambar.");
   context.drawImage(img,0,0,canvas.width,canvas.height);
   const result=canvas.toDataURL("image/png");if(result.length<=349550)return result;
   edge=Math.floor(edge*0.75);
  }
  throw new Error("Logo terlalu kompleks. Gunakan gambar yang lebih sederhana.");
 }finally{URL.revokeObjectURL(url);}
}
export default function BusinessSettings({onDirtyChange,onBusyChange,onSaved}:{onSaved:(business:Business)=>void;onDirtyChange:(v:boolean)=>void;onBusyChange:(v:boolean)=>void}){
 const [business,setBusiness]=useState<Business|null>(null),[logo,setLogo]=useState<string|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[remove,setRemove]=useState(false),[retry,setRetry]=useState(0);
 const input=useRef<HTMLInputElement>(null);
 const dirty=Boolean(business&&logo!==business.logoUrl);
 useDraft(dirty,onDirtyChange);
 useEffect(()=>{onBusyChange(busy);return()=>onBusyChange(false);},[busy,onBusyChange]);
 useEffect(()=>{let live=true;api<Business>("/business").then(b=>{if(live){setBusiness(b);setLogo(b.logoUrl);setError("");}}).catch(e=>{if(live)setError(errorText(e));}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[retry]);
 async function save(){setBusy(true);setError("");setNotice("");try{const b=await api<Business>("/business/logo",{method:"PATCH",body:JSON.stringify({logoUrl:logo})});setBusiness(b);setLogo(b.logoUrl);onSaved(b);setNotice("Logo bisnis tersimpan. Struk yang dibuka berikutnya akan menggunakan logo ini.");}catch(e){setError(errorText(e));}finally{setBusy(false);}}
 if(loading)return <div className="panel" role="status">Memuat profil bisnis…</div>;
 if(!business)return <div className="panel"><Feedback error={error}/><button className="secondary" onClick={()=>setRetry(v=>v+1)}>Coba lagi</button></div>;
 return <section className="panel business-branding"><header><p className="eyebrow">IDENTITAS BISNIS</p><h2>{business.name}</h2><p className="muted">Logo milik bisnis Anda akan tampil di atas nama bisnis pada struk 58 mm dan 80 mm.</p></header><Feedback error={error} notice={notice}/><div className="business-branding-grid"><div><label htmlFor="business-logo">Logo bisnis</label><div className="business-logo-preview">{logo?<Image unoptimized src={logo} alt={`Pratinjau logo ${business.name}`} width={180} height={180}/>:<span>Belum ada logo</span>}</div><input ref={input} id="business-logo" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={async e=>{const file=e.target.files?.[0];if(!file)return;setBusy(true);setError("");setNotice("");try{setLogo(await prepareLogo(file));}catch(err){setError(errorText(err));}finally{setBusy(false);if(input.current)input.current.value="";}}}/><p className="muted">PNG, JPG, atau WebP, maksimal 5 MB. Gambar disesuaikan otomatis tanpa memotong logo. PNG transparan disarankan.</p><div className="actions"><button className="secondary" disabled={busy||!logo} onClick={()=>setRemove(true)}>Hapus logo</button></div></div><div className="business-receipt-preview"><p className="eyebrow">PRATINJAU HEADER STRUK</p><div className="thermal-brand">{logo&&<Image unoptimized className="thermal-business-logo" src={logo} alt="Pratinjau logo pada struk" width={160} height={120}/>}<h3>{business.name}</h3><p>Nama outlet</p><p>Alamat dan telepon outlet</p></div><p className="muted">Printer thermal mencetak monokrom. Gunakan logo dengan kontras yang jelas. Cetak ulang transaksi lama juga menggunakan logo bisnis terbaru.</p></div></div><div className="actions business-branding-actions"><button className="secondary" disabled={busy||!dirty} onClick={()=>{setLogo(business.logoUrl);setError("");}}>Batalkan perubahan</button><button className="primary" disabled={busy||!dirty} onClick={()=>void save()}>{busy?"Memproses…":"Simpan logo"}</button></div>{remove&&<AdminDialog brand="BISNIS" title="Hapus logo bisnis?" busy={busy} onClose={()=>setRemove(false)}><p>Struk akan tetap menampilkan nama bisnis. Klik Simpan logo setelah menghapus untuk menerapkan perubahan.</p><div className="actions"><button className="secondary" onClick={()=>setRemove(false)}>Kembali</button><button className="primary" onClick={()=>{setLogo(null);setRemove(false);setNotice("");}}>Hapus dari pratinjau</button></div></AdminDialog>}</section>;
}
