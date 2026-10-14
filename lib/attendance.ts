export const attendanceTime = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
export const attendanceDate = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
export const attendanceStamp = (value?: string | null) => value ? new Date(value).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" }) : "—";
export function attendanceWindow(s: {workDate:string; startMinute:number; endMinute:number; crossesMidnight:boolean}) {
 const base = Date.parse(`${s.workDate.slice(0,10)}T00:00:00+07:00`);
 return {start:base+s.startMinute*60000,end:base+s.endMinute*60000+(s.crossesMidnight?86400000:0)};
}
export function locateAttendance(): Promise<{latitude:number;longitude:number;accuracy:number}> {
 return new Promise((resolve,reject)=>{
  if(!window.isSecureContext || !navigator.geolocation) return reject(new Error("GPS memerlukan HTTPS atau localhost dan browser yang mendukung lokasi."));
  navigator.geolocation.getCurrentPosition(p=>{
   if(p.coords.accuracy>50)return reject(new Error("Lokasi belum cukup akurat (lebih dari 50 m). Aktifkan lokasi presisi lalu coba kembali."));
   resolve({latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy});
  },e=>reject(new Error(e.code===1?"Izin lokasi ditolak. Izinkan lokasi presisi di pengaturan browser.":"Lokasi tidak tersedia. Aktifkan GPS dan coba kembali.")),{enableHighAccuracy:true,timeout:20000,maximumAge:0});
 });
}
