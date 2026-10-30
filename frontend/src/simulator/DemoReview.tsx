import type {DemoReview as Review} from '../types';

const statuses={shortfall:'Modeled shortfall',uncertain:'Needs verification',observed:'Observed in this run'};

export function DemoReview({review}:{review?:Review}){
 if(!review)return null;
 return <section className="panel padded demo-review" aria-label="Demo shortfalls and improvement summary">
  <div className="demo-review-heading"><div><span className="eyebrow">UNDERSTAND THIS DEMO</span><h2>{review.title}</h2></div><div className="demo-review-counts"><span>{review.shortfall_count} modeled {review.shortfall_count===1?'shortfall':'shortfalls'}</span><span>{review.assumption_count} assumed inputs</span></div></div>
  <p className="demo-review-headline">{review.headline}</p>
  <p>{review.overview}</p>
  <p className="demo-review-layout">{review.layout_note}</p>
  <div className="demo-review-findings">{review.findings.map(item=><article className={`demo-finding is-${item.status}`} key={item.id}>
   <span className="demo-finding-status">{statuses[item.status]}</span>
   <h3>{item.title}</h3><p className="demo-finding-evidence">{item.evidence}</p>
   <p><b>What this means</b>{item.impact}</p>
   <p className="demo-finding-improvement"><b>Room for improvement</b>{item.improvement}</p>
  </article>)}</div>
  <div className="demo-next-steps"><h3>Suggested order of work</h3><ol>{review.next_steps.map(item=><li key={item.title}><b>{item.title}</b><p>{item.detail}</p></li>)}</ol></div>
  <p className="demo-review-basis">{review.basis}</p>
 </section>
}
