export async function api<T=any>(path:string,body?:unknown,method?:string):Promise<T>{
 const response=await fetch('/api'+path,{method:method??(body?'POST':'GET'),headers:body instanceof FormData?undefined:{'Content-Type':'application/json'},body:body instanceof FormData?body:body?JSON.stringify(body):undefined});
 const data=await response.json(); if(!response.ok) throw new Error(typeof data.detail==='string'?data.detail:JSON.stringify(data.detail??data));return data;
}
export const fmt=(n:unknown,d=1)=>typeof n==='number'&&Number.isFinite(n)?n.toLocaleString(undefined,{maximumFractionDigits:d}):'—';
