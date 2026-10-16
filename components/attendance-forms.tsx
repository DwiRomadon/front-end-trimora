"use client";

import {useState} from "react";
import {attendanceDate, locateAttendance} from "@/lib/attendance";
import type {Row} from "./admin-ui";

type Named = {id:string;name:string};
export type AttendanceMember = Named & {outletIds:string[]};
export type AttendanceShift = Named & {code:string;outletId:string|null;startTime:string;endTime:string;lateToleranceMinutes:number;isActive:boolean};

export function ScheduleFields({row,members,outlets,templates,initialOutlet,onAccounts}:{row?:Row;members:AttendanceMember[];outlets:Named[];templates:AttendanceShift[];initialOutlet:string;onAccounts:()=>void}) {
    const [outlet,setOutlet] = useState(String(row?.outletId??initialOutlet??""));
    const [template,setTemplate] = useState("");
    const [start,setStart] = useState(String(row?.startTime??"09:00"));
    const [end,setEnd] = useState(String(row?.endTime??"17:00"));
    const availableMembers = members.filter(member=>member.outletIds.includes(outlet));
    const availableTemplates = templates.filter(shift=>!shift.outletId||shift.outletId===outlet);
    const selected = availableTemplates.find(shift=>shift.id===template);
    const from = selected?.startTime??start, to = selected?.endTime??end;
    return <div className="attendance-schedule-form">
        <div className="attendance-form-step"><span>1</span><div><h3>Siapa dan kapan?</h3><p>Pilih outlet, karyawan, lalu tanggal kerjanya.</p></div></div>
        <div className="attendance-fields">
            <label>Outlet<select name="outletId" required value={outlet} onChange={e=>{setOutlet(e.target.value);setTemplate("");}}><option value="">Pilih outlet</option>{outlets.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            {!row&&<label>Karyawan<select key={outlet} required name="memberId" disabled={!outlet}><option value="">{!outlet?"Pilih outlet dahulu":availableMembers.length?"Pilih karyawan":"Belum ada karyawan siap dijadwalkan"}</option>{availableMembers.map(member=><option key={member.id} value={member.id}>{member.name}</option>)}</select></label>}
            <label>Tanggal kerja<input type="date" required name="workDate" defaultValue={String(row?.workDate??attendanceDate()).slice(0,10)}/></label>
        </div>
        {!row&&outlet&&!availableMembers.length&&<div className="attendance-inline-help"><p>Karyawan harus punya akun aktif dan ditugaskan ke outlet ini.</p><button type="button" className="text-button" onClick={onAccounts}>Periksa akun karyawan →</button></div>}
        <div className="attendance-form-step"><span>2</span><div><h3>Jam kerja</h3><p>Isi langsung, atau gunakan jam yang sudah disimpan.</p></div></div>
        {availableTemplates.length>0&&<label>Gunakan jam tersimpan<select name="templateId" value={template} onChange={e=>setTemplate(e.target.value)}><option value="">Isi jam sendiri</option>{availableTemplates.map(shift=><option key={shift.id} value={shift.id}>{shift.name} · {shift.startTime}–{shift.endTime}</option>)}</select></label>}
        {!selected&&<div className="attendance-fields"><label>Masuk (WIB)<input type="time" required name="startTime" value={start} onChange={e=>setStart(e.target.value)}/></label><label>Pulang (WIB)<input type="time" required name="endTime" value={end} onChange={e=>setEnd(e.target.value)}/></label></div>}
        <div className="attendance-time-preview"><strong>{from} – {to} WIB</strong><span>{from===to?"Jam masuk dan pulang harus berbeda.":to<from?"Pulang keesokan hari":"Masuk dan pulang pada hari yang sama"}</span>{selected&&<small>Toleransi terlambat {selected.lateToleranceMinutes} menit.</small>}</div>
        <details className="attendance-advanced"><summary>Opsi tambahan</summary><div className="attendance-fields">{!selected&&<label>Toleransi terlambat (menit)<input type="number" name="lateToleranceMinutes" required min="0" max="240" defaultValue={Number(row?.lateToleranceMinutes??0)}/><small>0 berarti terlambat setelah jam masuk.</small></label>}<label>Urutan jadwal dalam sehari<input name="slot" type="number" min="1" max="20" required defaultValue={Number(row?.slot??1)}/><small>Biarkan 1 jika karyawan hanya punya satu jadwal.</small></label><label className="attendance-span">Catatan (opsional)<input name="notes" maxLength={500} defaultValue={String(row?.notes??"")}/></label></div></details>
    </div>;
}

export function LocationFields({row,busy,onBusyChange}:{row:Row;busy:boolean;onBusyChange:(v:boolean)=>void}) {
    const [latitude,setLatitude] = useState(String(row.attendanceLatitude??""));
    const [longitude,setLongitude] = useState(String(row.attendanceLongitude??""));
    const [radius,setRadius] = useState(String(row.attendanceRadiusMeters??100));
    const [error,setError] = useState("");
    const [captured,setCaptured] = useState(false);
    async function capture(){onBusyChange(true);setError("");try{const location=await locateAttendance();setLatitude(String(location.latitude));setLongitude(String(location.longitude));setCaptured(true);}catch(e){setError(e instanceof Error?e.message:"Lokasi tidak dapat diambil.");}finally{onBusyChange(false);}}
    return <div className="attendance-location-form"><p>Atur titik absensi untuk <strong>{String(row.name)}</strong>. Ambil lokasi saat Anda berada di outlet.</p><button type="button" className="primary" disabled={busy} onClick={()=>void capture()}>{busy?"Mengambil lokasi…":"⌖ Gunakan lokasi saya sekarang"}</button>{error&&<p className="notice" role="alert">{error}</p>}{captured&&<p className="notice good" role="status">Lokasi berhasil diambil. Periksa radius, lalu simpan.</p>}<label>Jarak absen yang diizinkan<select name="radiusMeters" value={radius} onChange={e=>setRadius(e.target.value)}>{Array.from(new Set(["50","100","200","500",radius])).filter(Boolean).sort((a,b)=>Number(a)-Number(b)).map(value=><option value={value} key={value}>{value} meter{value==="100"?" · standar":""}</option>)}</select><small>Karyawan harus berada dalam jarak ini dari titik outlet.</small></label><details className="attendance-advanced"><summary>{latitude&&longitude?"Lihat / ubah koordinat":"Isi koordinat secara manual"}</summary><div className="attendance-fields"><label>Latitude<input required name="latitude" type="number" step="any" min="-90" max="90" value={latitude} onChange={e=>{setLatitude(e.target.value);setCaptured(false);}}/></label><label>Longitude<input required name="longitude" type="number" step="any" min="-180" max="180" value={longitude} onChange={e=>{setLongitude(e.target.value);setCaptured(false);}}/></label></div><small>Gunakan koordinat manual jika Anda mengatur outlet dari tempat lain.</small></details>{(!latitude||!longitude)&&<p className="muted">Titik lokasi belum diisi. Gunakan GPS atau isi koordinat manual.</p>}</div>;
}

export function ShiftFields({row,outlets}:{row?:Row;outlets:Named[]}) {
    const [code] = useState(()=>String(row?.code??`JAM-${crypto.randomUUID().slice(0,8).toUpperCase()}`));
    return <div className="attendance-schedule-form"><p className="muted">Simpan jam yang sering dipakai agar tidak perlu mengisinya setiap membuat jadwal.</p><label>Nama jam kerja<input name="name" required minLength={3} maxLength={100} placeholder="Contoh: Pagi atau Seharian" defaultValue={String(row?.name??"")}/></label><div className="attendance-fields"><label>Masuk (WIB)<input name="startTime" type="time" required defaultValue={String(row?.startTime??"09:00")}/></label><label>Pulang (WIB)<input name="endTime" type="time" required defaultValue={String(row?.endTime??"17:00")}/></label></div><details className="attendance-advanced"><summary>Opsi tambahan</summary><div className="attendance-fields"><label>Berlaku di outlet<select name="outletId" defaultValue={String(row?.outletId??"")}><option value="">Semua outlet</option>{outlets.map(outlet=><option key={outlet.id} value={outlet.id}>{outlet.name}</option>)}</select></label><label>Toleransi terlambat (menit)<input name="lateToleranceMinutes" required type="number" min="0" max="240" defaultValue={Number(row?.lateToleranceMinutes??0)}/></label><label>Kode internal<input name="code" required minLength={2} maxLength={30} defaultValue={code}/></label></div></details></div>;
}
