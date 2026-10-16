export type ReceiptData = {
  businessName: string;
  businessLogoUrl?: string|null;
  outlet: { name: string; address: string|null; phone: string|null };
  invoiceNumber: string; status: string; date: string; cashier: string;
  customer?: { name: string; phone: string|null }|null;
  notes?: string|null;
  items: { name: string; type: string; barber: string|null; quantity: string; price: string; subtotal?: string; discountName?: string|null; discount: string; total: string }[];
  subtotal: string; discountAmount: string; grandTotal: string;
  payments: { method: string; amount: string; tenderedAmount: string|null; changeAmount: string }[];
  totalTendered: string; totalChange: string; footer: string;
};
export const receiptNumber = (value: string) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(Number(value));
export const receiptQuantity = (value: string) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 }).format(Number(value));
export const paymentName = (method: string) => ({ CASH:"Tunai", QRIS:"QRIS · GoPay", TRANSFER:"Transfer", DEBIT:"Kartu debit", EWALLET:"E-Wallet" }[method] ?? method);
export function receiptDate(value: string) {
  const date = new Date(value);
  if(Number.isNaN(date.getTime())) return { date:"—", time:"—" };
  return { date: new Intl.DateTimeFormat("id-ID", { timeZone:"Asia/Jakarta", day:"2-digit", month:"short", year:"numeric" }).format(date), time: new Intl.DateTimeFormat("id-ID", { timeZone:"Asia/Jakarta", hour:"2-digit", minute:"2-digit", hourCycle:"h23" }).format(date).replace(".",":") };
}
export function receiptLineAmount(item: ReceiptData["items"][number]) {
  if(item.subtotal !== undefined) return item.subtotal;
  const [priceWhole,priceFraction=""] = item.price.split("."); const [qtyWhole,qtyFraction=""] = item.quantity.split(".");
  const cents = (BigInt(priceWhole+priceFraction.padEnd(2,"0"))*BigInt(qtyWhole+qtyFraction.padEnd(3,"0"))+BigInt(500))/BigInt(1000);
  const value=cents.toString().padStart(3,"0");return `${value.slice(0,-2)}.${value.slice(-2)}`;
}

