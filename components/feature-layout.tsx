import type { FormHTMLAttributes, HTMLAttributes } from "react";

export function FilterForm({ children, className, ...props }: FormHTMLAttributes<HTMLFormElement>) {
    return <form {...props} className="filter-block"><div className="filter-heading"><h3>Filter data</h3><p>Atur pilihan, lalu tekan tombol untuk menampilkan hasil.</p></div><div className={`${className ?? ""} filter-fields`}>{children}</div></form>;
}

export function FilterArea({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
    return <div {...props} className="filter-block"><div className="filter-heading"><h3>Tampilkan data</h3><p>Daftar diperbarui saat pilihan diubah.</p></div><div className={`${className ?? ""} filter-fields`}>{children}</div></div>;
}
