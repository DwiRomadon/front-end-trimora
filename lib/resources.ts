export type Named = {
    id: string;
    name: string;
};
export type RecordRow = Named & {
    status: "ACTIVE" | "INACTIVE";
    [key: string]: unknown;
};
export type Resource = "services" | "barbers" | "products" | "customers" | "service-categories" | "product-categories";
export type Field = {
    key: string;
    label: string;
    type?: "text" | "number" | "email" | "tel" | "date" | "checkbox" | "category" | "unit";
    required?: boolean;
    min?: number;
    max?: number;
    step?: string;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    default?: string | boolean;
    nullable?: boolean;
    immutable?: boolean;
};
export type ResourceConfig = {
    title: string;
    singular: string;
    description: string;
    paginated: boolean;
    category?: Resource;
    fields: Field[];
};
const name: Field = { key: "name", label: "Nama", required: true, minLength: 2, maxLength: 150 };
const code: Field = { key: "code", label: "Kode", required: true, minLength: 2, maxLength: 30 };
const description: Field = { key: "description", label: "Deskripsi", nullable: true };
const category: Field = { key: "categoryId", label: "Kategori", type: "category", required: true };
export const resources: Record<Resource, ResourceConfig> = {
    services: { title: "Layanan", singular: "layanan", description: "Atur katalog layanan dan harga di setiap outlet.", paginated: true, category: "service-categories", fields: [name, code, category, { key: "duration", label: "Durasi (menit)", type: "number", required: true, min: 1, max: 1440, step: "1", default: "30" }, description] },
    barbers: { title: "Tim barber", singular: "barber", description: "Kelola tim dan penugasan mereka ke outlet.", paginated: true, fields: [{ ...name, minLength: 3 }, code, { key: "phone", label: "Telepon", type: "tel", maxLength: 30, nullable: true }, { key: "address", label: "Alamat", nullable: true }] },
    products: { title: "Produk", singular: "produk", description: "Kelola produk jual dan bahan yang digunakan untuk layanan.", paginated: true, category: "product-categories", fields: [name, { ...code, key: "sku", label: "SKU", maxLength: 50 }, category, { key: "unit", label: "Satuan", type: "unit", required: true, default: "PCS", immutable: true }, { key: "sellingPrice", label: "Harga jual (Rp)", type: "number", min: 0, max: 999999999999, step: "0.01", default: "0", required: true }, { key: "minimumStock", label: "Stok minimum", type: "number", min: 0, max: 99999999999, step: "0.001", default: "0", required: true }, { key: "isForSale", label: "Dijual di kasir", type: "checkbox", default: true }, { key: "isServiceSupply", label: "Bahan layanan", type: "checkbox", default: false }, description] },
    customers: { title: "Pelanggan", singular: "pelanggan", description: "Kenali pelanggan Anda dan simpan informasi kunjungannya.", paginated: true, fields: [name, { key: "phone", label: "Telepon", type: "tel", minLength: 9, maxLength: 20, pattern: "\\+?[0-9]+", nullable: true }, { key: "address", label: "Alamat", maxLength: 1000, nullable: true }, { key: "email", label: "Email", type: "email", maxLength: 255, nullable: true }, { key: "birthDate", label: "Tanggal lahir", type: "date", nullable: true }, { key: "notes", label: "Catatan", maxLength: 2000, nullable: true }] },
    "service-categories": { title: "Kategori layanan", singular: "kategori layanan", description: "Kelompokkan layanan agar katalog lebih mudah ditelusuri.", paginated: false, fields: [{ ...name, maxLength: 100 }, { key: "slug", label: "Slug", required: true, minLength: 2, maxLength: 100, pattern: "[a-z0-9]+(-[a-z0-9]+)*" }, description] },
    "product-categories": { title: "Kategori produk", singular: "kategori produk", description: "Kelompokkan produk jual dan bahan layanan.", paginated: false, fields: [{ ...name, maxLength: 100 }, description] },
};
export function buildPayload(resource: Resource, form: FormData, editing: boolean): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const field of resources[resource].fields) {
        if (editing && field.immutable)
            continue;
        const value = String(form.get(field.key) ?? "").trim();
        result[field.key] = field.type === "checkbox" ? form.has(field.key) : field.key === "duration" ? Number(value) : !value && field.nullable ? null : value;
    }
    return result;
}
