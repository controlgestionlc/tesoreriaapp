export type Company={id:string;name:string;rut:string};
export type Account={id:string;companyId:string;bank:string;number:string;opening:number;openingDate:string};
export type Partner={id:string;companyId:string;name:string;rut:string;role:string};
export type Entry={id:string;companyId:string;accountId:string|null;partnerId:string|null;direction:string;category:string;docType:string;docNumber:string;description:string;issueDate:string;dueDate:string;amount:number;duplicateKey:string};
export type Payment={id:string;entryId:string;accountId:string;date:string;amount:number;note:string};
export type Data={companies:Company[];accounts:Account[];partners:Partner[];entries:Entry[];payments:Payment[]};
export const blank:Data={companies:[],accounts:[],partners:[],entries:[],payments:[]};
export const money=(n:number)=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(n);
export const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function addDays(s:string,n:number){let d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
export function addMonths(s:string,n:number){let d=new Date(s+'T12:00:00Z'),day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+n);let last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));return d.toISOString().slice(0,10)}
export const prettyDate=(s:string)=>s?new Date(s+'T12:00:00Z').toLocaleDateString('es-CL',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}):'—';
export const cleanRut=(s:string)=>s.replace(/[^0-9kK]/g,'').toUpperCase();
export function validRut(s:string){s=cleanRut(s);if(!/^\d{7,8}[0-9K]$/.test(s))return false;let sum=0,m=2;for(let i=s.length-2;i>=0;i--){sum+=Number(s[i])*m;m=m===7?2:m+1}let d=11-sum%11;return s.at(-1)===(d===11?'0':d===10?'K':String(d))}
export function formatRut(s:string){s=cleanRut(s);return s.length>1?s.slice(0,-1).replace(/\B(?=(\d{3})+(?!\d))/g,'.')+'-'+s.at(-1):s}
export function paid(e:Entry,d:Data,until='9999-12-31'){return d.payments.filter(p=>p.entryId===e.id&&p.date<=until).reduce((s,p)=>s+p.amount,0)}
export function balance(a:Account,d:Data,until=today()){if(a.openingDate>until)return 0;return a.opening+d.payments.filter(p=>p.accountId===a.id&&p.date<=until).reduce((s,p)=>s+p.amount*(d.entries.find(e=>e.id===p.entryId)?.direction==='ingreso'?1:-1),0)}
export const categories=['Clientes','Proveedores','Préstamo bancario','Leasing','Remuneraciones','Impuestos','Otros'];
