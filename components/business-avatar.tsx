"use client";
import Image from "next/image";
import {useState} from "react";

export default function BusinessAvatar({name,logoUrl}:{name:string;logoUrl?:string|null}) {
 const [failedUrl,setFailedUrl]=useState<string|null>(null);
 return <span className="avatar business-avatar">{logoUrl&&logoUrl!==failedUrl?<Image unoptimized src={logoUrl} alt={`Logo ${name}`} width={40} height={40} onError={()=>setFailedUrl(logoUrl)}/>:name.slice(0,1)}</span>;
}
