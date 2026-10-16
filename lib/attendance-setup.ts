export function attendancePeriod(period:string,today:string) {
    const date = new Date(`${today}T00:00:00.000Z`);
    if(Number.isNaN(date.getTime())||date.toISOString().slice(0,10)!==today) throw new Error("Tanggal tidak valid.");
    if(period==="today") return {from:today,to:today};
    if(period==="week") {date.setUTCDate(date.getUTCDate()-6);return {from:date.toISOString().slice(0,10),to:today};}
    if(period==="month") {const from=`${today.slice(0,7)}-01`;date.setUTCMonth(date.getUTCMonth()+1,0);return {from,to:date.toISOString().slice(0,10)};}
    throw new Error("Periode tidak valid.");
}

export function attendanceSchedulePayload(form:FormData,editing:boolean) {
    const get = (key:string)=>String(form.get(key)??"").trim();
    const templateId = get("templateId"), outletId=get("outletId"), workDate=get("workDate");
    if(!outletId||!workDate||(!editing&&!get("memberId"))) throw new Error("Pilih outlet, karyawan, dan tanggal kerja.");
    const slot=Number(get("slot")||"1");
    if(!Number.isInteger(slot)||slot<1||slot>20) throw new Error("Urutan jadwal harus 1–20.");
    const shared={...(!editing?{memberId:get("memberId")} : {}),outletId,workDate,slot,notes:get("notes")||null};
    if(templateId) return {...shared,templateId};
    const startTime=get("startTime"),endTime=get("endTime"),lateToleranceMinutes=Number(get("lateToleranceMinutes")||"0");
    if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime)) throw new Error("Isi jam masuk dan pulang yang valid.");
    if(startTime===endTime) throw new Error("Jam masuk dan pulang harus berbeda.");
    if(!Number.isInteger(lateToleranceMinutes)||lateToleranceMinutes<0||lateToleranceMinutes>240) throw new Error("Toleransi terlambat harus 0–240 menit.");
    return {...shared,...(editing?{templateId:null}:{}),startTime,endTime,lateToleranceMinutes};
}
