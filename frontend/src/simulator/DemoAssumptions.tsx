import {fmt} from '../api';
import type {DemoAssumption} from '../types';

export function DemoAssumptions({items}:{items:DemoAssumption[]}){
 return <details className="demo-assumptions"><summary>View {items.length} demo input assumptions</summary><div className="table-scroll"><table><thead><tr><th>Part / input</th><th>Demo value</th><th>Basis</th></tr></thead><tbody>{items.map((item,j)=><tr key={j}><td>{item.component_name}<small>{item.field}</small></td><td>{typeof item.value==='number'?fmt(item.value,4):String(item.value)} {item.unit}</td><td>{item.basis}</td></tr>)}</tbody></table></div></details>
}
