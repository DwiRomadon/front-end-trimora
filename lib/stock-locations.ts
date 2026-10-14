import type { Named } from "./resources";
export type StockLocation = Named & { code: string; type: string; outletId: string|null; isActive: boolean };
export function outletLocationChoices(outlets: Named[], locations: StockLocation[]) {
  return outlets.map(outlet => {
    const location = locations.find(row => row.type === "OUTLET" && row.outletId === outlet.id);
    return { ...outlet, location, label: `${outlet.name}${location ? location.isActive ? " — lokasi stok tersedia" : " — lokasi stok nonaktif" : " — belum ada lokasi stok"}` };
  });
}
