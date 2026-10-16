import {paymentName,receiptDate,receiptNumber,receiptQuantity,type ReceiptData} from "./receipt";

// ESC/POS GS v 0, split into small bands so low-memory printers can accept it.
export function rasterCommands(rgba:Uint8ClampedArray,width:number,height:number):Uint8Array {
 if(width<=0||width%8!==0||height<=0||rgba.length!==width*height*4)throw new Error("Ukuran raster printer tidak valid.");
 const bytes:number[]=[27,64,27,97,0],stride=width/8;
 for(let top=0;top<height;top+=128){const rows=Math.min(128,height-top);bytes.push(29,118,48,0,stride&255,stride>>8,rows&255,rows>>8);
  for(let y=top;y<top+rows;y++)for(let x=0;x<width;x+=8){let value=0;for(let bit=0;bit<8;bit++){const i=(y*width+x+bit)*4,alpha=rgba[i+3]/255;const brightness=(rgba[i]*0.299+rgba[i+1]*0.587+rgba[i+2]*0.114)*alpha+255*(1-alpha);if(brightness<175)value|=128>>bit;}bytes.push(value);}
 }
 bytes.push(27,100,4);return new Uint8Array(bytes);
}
export async function thermalReceipt(data:ReceiptData,paper:"58"|"80"):Promise<Uint8Array>{
 const width=paper==="58"?384:576,margin=12,lineHeight=26,fontSize=20;
 const canvas=document.createElement("canvas");canvas.width=width;canvas.height=1;const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Perangkat tidak mendukung gambar struk.");
 type Line={text:string;center?:boolean;bold?:boolean};const lines:Line[]=[];
 ctx.font=`${fontSize}px monospace`;
 function text(value:string,center=false,bold=false){for(const paragraph of value.replace(/\r/g,"").split("\n")){let current="";for(const char of paragraph){if(ctx!.measureText(current+char).width>width-margin*2){lines.push({text:current,center,bold});current="";}current+=char;}lines.push({text:current,center,bold});}}
 function pair(label:string,value:string){const space=ctx!.measureText(" ").width;const count=Math.floor((width-margin*2-ctx!.measureText(label+value).width)/space);if(count<1){text(label);text(value);}else text(label+" ".repeat(count)+value);}
 const rule=()=>text("-".repeat(Math.floor((width-margin*2)/ctx!.measureText("-").width)));
 let logo:HTMLImageElement|null=null;
 if(data.businessLogoUrl){logo=new Image();logo.src=data.businessLogoUrl;try{await logo.decode();}catch{throw new Error("Logo struk gagal dimuat. Muat ulang sebelum mencetak.");}}
 const logoHeight=logo?Math.round(Math.min(110,logo.height*(180/logo.width))):0;
 text(data.businessName,true,true);if(data.outlet.name!==data.businessName)text(data.outlet.name,true);if(data.outlet.address)text(data.outlet.address,true);if(data.outlet.phone)text(data.outlet.phone,true);rule();const date=receiptDate(data.date);pair(date.date,date.time+" WIB");text(data.invoiceNumber);text("Pelanggan: "+(data.customer?.name||"Pelanggan umum"));if(data.customer?.phone)text("HP: "+data.customer.phone);text("Kasir: "+data.cashier);if(data.status!=="COMPLETED")text("TRANSAKSI DIBATALKAN",true,true);rule();
 for(const item of data.items){text(item.name,false,true);if(item.barber)text("Capster: "+item.barber);pair(`${receiptQuantity(item.quantity)} x ${receiptNumber(item.price)}`,receiptNumber(item.subtotal??item.total));if(Number(item.discount)>0){pair(item.discountName||"Diskon item","-"+receiptNumber(item.discount));pair("Bersih",receiptNumber(item.total));}}
 rule();pair("Subtotal",receiptNumber(data.subtotal));pair("Diskon","-"+receiptNumber(data.discountAmount));pair("TOTAL",receiptNumber(data.grandTotal));for(const p of data.payments)pair(paymentName(p.method),receiptNumber(p.method==="CASH"?p.tenderedAmount??p.amount:p.amount));if(data.payments.some(p=>p.method==="CASH"))pair("Kembalian",receiptNumber(data.totalChange));rule();if(data.notes)text("Catatan: "+data.notes);text(data.footer||"Terima kasih!",true);text("Powered by Trimora",true);
 canvas.height=margin*2+logoHeight+(logo?12:0)+lines.length*lineHeight;ctx.fillStyle="#fff";ctx.fillRect(0,0,width,canvas.height);let y=margin;
 if(logo){const logoWidth=logo.width*logoHeight/logo.height;ctx.drawImage(logo,(width-logoWidth)/2,y,logoWidth,logoHeight);y+=logoHeight+12;}
 ctx.fillStyle="#000";ctx.textBaseline="top";for(const line of lines){ctx.font=`${line.bold?"bold ":""}${fontSize}px monospace`;ctx.textAlign=line.center?"center":"left";ctx.fillText(line.text,line.center?width/2:margin,y);y+=lineHeight;}
 return rasterCommands(ctx.getImageData(0,0,width,canvas.height).data,width,canvas.height);
}
export function rawBtLink(bytes:Uint8Array){let binary="";for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return "rawbt:base64,"+btoa(binary);}
type PrinterPort={open:(options:{baudRate:number;flowControl:string})=>Promise<void>;close:()=>Promise<void>;writable:WritableStream<Uint8Array>|null};
type SerialNavigator=Navigator&{serial?:{requestPort:()=>Promise<PrinterPort>}};
async function bounded<T>(work:Promise<T>):Promise<T>{let timer:ReturnType<typeof setTimeout>|undefined;try{return await Promise.race([work,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error("Printer tidak merespons dalam 20 detik. Periksa koneksi dan hasil cetak sebelum mencoba ulang.")),20000);})]);}finally{clearTimeout(timer);}}
export function supportsSerial(){return window.isSecureContext&&!!(navigator as SerialNavigator).serial;}
export async function printSerial(bytes:Uint8Array,baudRate:number){
 const serial=(navigator as SerialNavigator).serial;if(!window.isSecureContext)throw new Error("Gunakan HTTPS agar izin printer tersedia.");if(!serial)throw new Error("Cetak Bluetooth laptop memerlukan Chrome/Edge desktop dengan Web Serial. HP Android: gunakan RawBT.");
 // Must be the first asynchronous operation: browser permission needs a user gesture.
 const port=await serial.requestPort();let writer:WritableStreamDefaultWriter<Uint8Array>|undefined;
 try{await bounded(port.open({baudRate,flowControl:"none"}));if(!port.writable)throw new Error("Printer tidak menyediakan koneksi tulis.");writer=port.writable.getWriter();for(let i=0;i<bytes.length;i+=512){await bounded(writer.write(bytes.slice(i,i+512)));await new Promise(resolve=>setTimeout(resolve,20));}}
 finally{writer?.releaseLock();await bounded(port.close()).catch(()=>{});}
}
