import type {ReactNode} from 'react';
import {fmt} from '../api';
export function Field({label,children}:{label:string;children:ReactNode}){return <label className="field"><span>{label}</span>{children}</label>}
export function Metric({label,value,unit,detail}:{label:string;value:unknown;unit:string;detail?:string}){return <article className="metric"><span>{label}</span><strong>{fmt(value)}<small>{unit}</small></strong><footer>{detail??'Awaiting validated configuration'}</footer></article>}
export function Messages({errors=[],warnings=[]}:{errors?:string[];warnings?:string[]}){return <div className="messages">{errors.map((s,j)=><div className="message error" key={'e'+j}><b>Input required</b>{s}</div>)}{warnings.map((s,j)=><div className="message warning" key={'w'+j}><b>Model note</b>{s}</div>)}</div>}
export const Blank=({children}:{children:ReactNode})=><div className="blank">{children}</div>;
