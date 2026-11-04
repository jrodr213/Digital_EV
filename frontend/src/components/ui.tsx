import {cloneElement,isValidElement,useEffect,useId,useRef} from 'react';
import type {ReactElement,ReactNode} from 'react';
import {AlertCircle,CheckCircle2,Inbox,Info,LoaderCircle,X} from 'lucide-react';
import {fmt} from '../api';

export function Field({label,hint,error,children}:{label:string;hint?:string;error?:string;children:ReactNode}){
 const generated=useId();
 const child=isValidElement(children)?children as ReactElement<Record<string,unknown>>:null;
 const id=String(child?.props.id??generated);
 return <label className={`field${error?' has-error':''}`} htmlFor={id}><span>{label}</span>{child?cloneElement(child,{id,'aria-label':child.props['aria-label']??label,'aria-invalid':error?true:undefined,'aria-describedby':error||hint?`${id}-help`:child.props['aria-describedby']}):children}{(hint||error)&&<small id={`${id}-help`} className={error?'field-error':'field-hint'}>{error??hint}</small>}</label>;
}

export function Metric({label,value,unit,detail,loading=false}:{label:string;value:unknown;unit?:string;detail?:string;loading?:boolean}){
 const available=typeof value==='number'&&Number.isFinite(value);
 return <article className="metric"><span>{label}</span><strong className={loading?'skeleton':!available?'metric-unavailable':''}>{loading?<span className="sr-only">Loading</span>:<>{fmt(value)}{available&&<small>{unit}</small>}</>}</strong><footer>{detail??(available?'':'Data not available')}</footer></article>;
}
export function StatusPill({tone='neutral',children}:{tone?:'neutral'|'success'|'warning'|'error';children:ReactNode}){
 return <span className={`status-pill is-${tone}`}><i/>{children}</span>;
}
export function Alert({tone='info',title,children,action}:{tone?:'info'|'error'|'success'|'warning';title?:string;children?:ReactNode;action?:ReactNode}){
 const Icon=tone==='success'?CheckCircle2:tone==='error'?AlertCircle:Info;
 return <div className={`notice notice-${tone}`} role={tone==='error'?'alert':'status'}><Icon size={18}/><div>{title&&<strong>{title}</strong>}{children&&<div>{children}</div>}</div>{action}</div>;
}
export function Busy({children='Loading…'}:{children?:ReactNode}){return <span className="busy" role="status"><LoaderCircle size={16} className="spin"/>{children}</span>}
export function Messages({errors=[],warnings=[]}:{errors?:string[];warnings?:string[]}){
 return <div className="messages">{errors.map((message,index)=><div className="message error" key={`e${index}`}><AlertCircle size={15}/><span>{message}</span></div>)}{warnings.map((message,index)=><div className="message warning" key={`w${index}`}><Info size={15}/><span>{message}</span></div>)}</div>;
}
export function Blank({children,title,action}:{children:ReactNode;title?:string;action?:ReactNode}){
 return <div className="blank"><Inbox size={26} strokeWidth={1.4}/>{title&&<h3>{title}</h3>}<p>{children}</p>{action}</div>;
}
export function Panel({title,description,action,children,className=''}:{title?:string;description?:string;action?:ReactNode;children:ReactNode;className?:string}){
 return <section className={`panel ${className}`}>{title&&<div className="panel-heading"><div><h2>{title}</h2>{description&&<p>{description}</p>}</div>{action}</div>}{children}</section>;
}
export function Skeleton({rows=3,label='Loading workspace'}:{rows?:number;label?:string}){
 return <div className="skeleton-block" role="status" aria-label={label}>{Array.from({length:rows},(_,index)=><div className="skeleton" key={index}/>)}<span className="sr-only">{label}</span></div>;
}
export function Modal({title,onClose,children,wide=false}:{title:string;onClose:()=>void;children:ReactNode;wide?:boolean}){
 const ref=useRef<HTMLDialogElement>(null),titleId=useId(),close=useRef(onClose);close.current=onClose;
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;ref.current?.showModal();return()=>{previous?.focus()}},[]);
 return <dialog ref={ref} className={`modal${wide?' modal-wide':''}`} aria-labelledby={titleId} onCancel={event=>{event.preventDefault();close.current()}} onClick={event=>{if(event.target===event.currentTarget){const rect=event.currentTarget.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)close.current()}}}><div className="modal-heading"><h2 id={titleId}>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={18}/></button></div>{children}</dialog>;
}
