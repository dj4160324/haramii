// Past burden is read from actual cells only. A common observation calendar
// prevents missing history, training, or a changed role from implying zero load.
const DAY=86400000,work=new Set(['D','E','N','MID']);
const known=new Set([...work,'OFF','LEAVE','M-LEAVE','SICK']);
const iso=t=>new Date(t).toISOString().slice(0,10);
function kind(A,x,s,d){return s.isDispatch||s.isPregnant||A.api.T.trainee(x,s,d)?null:s.isNightOnly?'night':'ordinary';}
export function history(A,x,m){
 const first=x.dates[0].iso,end=x.dates.at(-1).iso,[y,mo]=end.split('-').map(Number);
 const start=iso(Date.UTC(y,mo-3,1)),lo=Date.parse(start),anchor=Date.parse(first);
 const rows=x.staff.map((s,i)=>({key:A.api.S.identity(s),role:kind(A,x,s,0),cells:new Map(),comparable:false,days:0,pastSix:null,pastNight:null,sixWeight:0,nightWeight:0,skipEnds:0}));
 const byKey=new Map(rows.map(r=>[r.key,r]));
 for(const p of x.surplusHistory?.periods||[]){
  if(p.status!=='actual'||p.end>=first||Date.parse(p.end)<lo-6*DAY||!p.actual||!p.input)continue;
  const old=p.input;
  old.staff.forEach((s,i)=>{const r=byKey.get(A.api.S.identity(s));if(!r?.role)return;
   old.dates.forEach((t,d)=>{const v=p.actual[i]?.[d];if(t.iso>=first||!known.has(v)||kind(A,old,s,d)!==r.role)return;
    r.cells.set(t.iso,r.cells.has(t.iso)&&r.cells.get(t.iso)!==v?null:v);
   });});
 }
 const groups=new Map();
 rows.forEach((r,i)=>{let mask='',last=-Infinity,six=0,n=0;
  for(let t=lo;t<anchor;t+=DAY){const cells=Array.from({length:7},(_,k)=>r.cells.get(iso(t-(6-k)*DAY)));
   if(!cells.every(c=>known.has(c))){mask+='0';continue;}mask+='1';r.days++;
   if(t-last>=7*DAY&&cells.filter(v=>work.has(v)).length>=6){six++;last=t;}
   if(r.role==='ordinary')n+=Math.max(0,cells.filter(v=>v==='N').length-3)**2;
  }
  if(r.days){r.pastSix=six;r.pastNight=r.role==='ordinary'?n:null;r.skipEnds=Math.max(0,(last+7*DAY-anchor)/DAY);}
  const prev=x.staff[i].previousShifts||[];
  const elig=(d)=>{if(d>=0)return kind(A,x,x.staff[i],d)===r.role&&known.has(m[i][d]);
   const observed=r.cells.get(iso(anchor+d*DAY));return known.has(observed)&&prev[prev.length+d]===observed;};
  r.ends=x.dates.map((_,end)=>Array.from({length:7},(_,k)=>end-k).every(elig));
  delete r.cells;
  if(!r.days||!r.role)return;
  const cur=r.ends.map(Number).join('');
  if(!cur.includes('1'))return;
  const k=r.role+':'+mask+':'+cur;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);
 });
 for(const g of groups.values()){if(g.length<2)continue;
  for(const r of g){r.comparable=true;
   // Signed peer contrasts; unknown histories stay neutral, never a zero-benefit score.
   for(const [field,w] of [['pastSix','sixWeight'],['pastNight','nightWeight']]){
    if(r[field]==null)continue;r[w]=Math.round(10*g.reduce((a,p)=>a+Math.sign(r[field]-p[field]),0)/(g.length-1));
   }
  }
 }
 return {start,end,rows};
}
export function score(h,metrics){
 let total=0;for(let i=0;i<h.rows.length;i++){const r=h.rows[i],row=metrics.rows[i];if(!r.comparable)continue;
  // Recount the nonoverlapping windows after the last selected historical episode.
  let last=r.skipEnds-7,count=0;for(const w of row.windows){if(w.to-last>=7){count++;last=w.to;}}
  total+=r.sixWeight*count+r.nightWeight*row.night;
 }return total;
}
export function measureBurden(model,m){
 const L=m[0].length;
 return {rows:model.staff.map((s,i)=>{const windows=[];let night=0;
  const get=d=>d<0?s.previous[s.previous.length+d]:m[i][d];
  for(let end=0;end<L;end++){if(!model.burden.rows[i].ends[end])continue;const cells=Array.from({length:7},(_,k)=>get(end-6+k));if(!s.active.slice(Math.max(0,end-6),end+1).some(Boolean))continue;
   if(!s.dispatch&&cells.every(v=>v!=null&&v!=='DISPATCH')&&cells.filter(v=>work.has(v)).length>=6)windows.push({to:end});
   if(!s.dispatch&&!s.nightOnly)night+=Math.max(0,cells.filter(v=>v==='N').length-3)**2;
  }return {windows,night};})};
}
