"use client";
import {useEffect,useId,useRef,type ReactNode} from "react";
import {createPortal} from "react-dom";
export default function AdminDialog({title,busy=false,onClose,children,brand="PLATFORM"}:{title:string;brand?:string;busy?:boolean;onClose:()=>void;children:ReactNode}){
 const ref=useRef<HTMLDialogElement>(null);const titleId=useId();
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;const dialog=ref.current;const overflow=document.body.style.overflow;dialog?.showModal();document.body.style.overflow="hidden";return()=>{dialog?.close();document.body.style.overflow=overflow;if(previous?.isConnected)previous.focus();};},[]);
 if(typeof document==="undefined")return null;
 return createPortal(<dialog ref={ref} className="admin-dialog" aria-labelledby={titleId} aria-busy={busy} onCancel={e=>{e.preventDefault();if(!busy)onClose();}}><header className="admin-dialog-header"><div><p className="eyebrow">TRIMORA · {brand}</p><h2 id={titleId}>{title}</h2></div><button type="button" className="secondary" aria-label="Tutup pop-up" disabled={busy} onClick={onClose}>×</button></header><div className="admin-dialog-body">{children}</div>{busy&&<p className="admin-dialog-progress" role="status">Sedang memproses, mohon tunggu…</p>}</dialog>,document.body);
}
