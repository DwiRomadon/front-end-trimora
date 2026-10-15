import Image from "next/image";

export default function BrandLogo() {
  return <span className="trimora-logo"><Image src="/branding/trimora-logo-transparent.png" alt="Trimora" width={1254} height={1254} sizes="(max-width: 640px) 180px, 260px" priority /></span>;
}

export function BrandLoading({message="Menyiapkan workspace Trimora…",compact=false}:{message?:string;compact?:boolean}) {
  return <div className={`trimora-loading${compact?" trimora-loading-compact":""}`} role="status" aria-live="polite" aria-busy="true"><BrandLogo/><div className="trimora-loading-track" aria-hidden="true"><span/></div><p>{message}</p></div>;
}
