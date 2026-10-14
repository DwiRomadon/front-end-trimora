"use client";
import {useEffect,useState,type ReactNode} from "react";
import AdminDialog from "./admin-dialog";
export default function EditorDialog({title,busy,onClose,children}:{title:string;busy:boolean;onClose:()=>void;children:(close:()=>void)=>ReactNode}){
 const [dirty,setDirty]=useState(false),[discard,setDiscard]=useState(false);
 function close(){if(busy)return;if(discard){setDiscard(false);return;}if(dirty)setDiscard(true);else onClose();}
 useEffect(()=>{if(!dirty&&!busy)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();};window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn);},[dirty,busy]);
 return <AdminDialog title={discard?"Buang perubahan?":title} brand="WORKSPACE" busy={busy} onClose={close}><div hidden={discard} onChangeCapture={()=>setDirty(true)}>{children(close)}</div>{discard&&<div><p>Isian belum disimpan. Kembali untuk melanjutkan, atau buang isian untuk menutup formulir.</p><p className="muted">Jika hasil penyimpanan belum pasti, periksa daftar sebelum membuat catatan ulang.</p><div className="actions"><button className="secondary" autoFocus onClick={()=>setDiscard(false)}>Lanjut mengisi</button><button className="primary" onClick={onClose}>Buang isian</button></div></div>}</AdminDialog>;
}
