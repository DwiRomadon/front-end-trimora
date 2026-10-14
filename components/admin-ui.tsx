"use client";
import {useEffect,type ReactNode} from "react";
import {api} from "@/lib/api";
import {financeMoney} from "@/lib/finance";
export type Row=Record<string,unknown>;
export type Column={label:string;path:string;kind?:"money"|"date"|"boolean";render?:(row:Row)=>ReactNode};
export const errorText=(e:unknown)=>e instanceof Error?e.message:"Permintaan gagal diproses.";
export function value(row:unknown,path:string):unknown{return path.split(".").reduce<unknown>((item,key)=>item&&typeof item==="object"?(item as Row)[key]:undefined,row);}
export function display(v:unknown,kind?:Column["kind"]){if(v===null||v===undefined)return "—";if(kind==="money")return financeMoney(String(v));if(kind==="date")return new Date(String(v)).toLocaleString("id-ID",{timeZone:"Asia/Jakarta"});if(kind==="boolean")return v?"Ya":"Tidak";return typeof v==="object"?JSON.stringify(v):String(v);}
export function DataTable({rows,columns,action}:{rows:Row[];columns:Column[];action?:(row:Row)=>ReactNode}){return <><div className="table-wrap"><table><thead><tr>{columns.map(c=><th key={c.label}>{c.label}</th>)}{action&&<th>Detail / aksi</th>}</tr></thead><tbody>{rows.map((row,i)=><tr key={String(row.id??i)}>{columns.map(c=><td key={c.label}>{c.render?c.render(row):display(value(row,c.path),c.kind)}</td>)}{action&&<td>{action(row)}</td>}</tr>)}</tbody></table></div>{!rows.length&&<p className="empty">Belum ada data yang sesuai dengan filter.</p>}</>;}
export function MetricRows({data,fields}:{data:unknown;fields:Column[]}){return <div className="document-overview">{fields.map(c=><div key={c.label}><span>{c.label}</span><strong>{display(value(data,c.path),c.kind)}</strong></div>)}</div>;}
export function Pager({page,pages,change,disabled=false}:{page:number;pages:number;change:(p:number)=>void;disabled?:boolean}){return <div className="pagination"><span>Halaman {page} dari {Math.max(1,pages)}</span><div><button className="secondary" disabled={disabled||page<=1} onClick={()=>change(page-1)}>← Sebelumnya</button><button className="secondary" disabled={disabled||page>=pages} onClick={()=>change(page+1)}>Berikutnya →</button></div></div>;}
export function Feedback({error,notice}:{error:string;notice?:string}){return <>{error&&<p className="notice" role="alert">{error}</p>}{notice&&<p className="recipe-info" role="status">{notice}</p>}</>;}
export function useDraft(dirty:boolean,callback:(v:boolean)=>void){useEffect(()=>{callback(dirty);return()=>callback(false);},[dirty,callback]);useEffect(()=>{if(!dirty)return;const prevent=(e:BeforeUnloadEvent)=>e.preventDefault();window.addEventListener("beforeunload",prevent);return()=>window.removeEventListener("beforeunload",prevent);},[dirty]);}
export async function allRows<T>(path:string,key:string){const rows:T[]=[];for(let page=1;;page++){const d=await api<Row>(`${path}?limit=100&page=${page}`);rows.push(...d[key] as T[]);if(page>=Number(value(d,"pagination.totalPages")??1))return rows;}}
export function Notes({notes}:{notes:unknown}){return Array.isArray(notes)?<details className="report-notes"><summary>Dasar perhitungan laporan</summary><ul>{notes.map((n,i)=><li key={i}>{String(n)}</li>)}</ul></details>:null;}
