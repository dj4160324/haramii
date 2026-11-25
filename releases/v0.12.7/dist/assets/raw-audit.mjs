/* Raw counting independent of engine metric functions. Eligibility/locks/common
   dates are shared exported metadata, NOT independently inferred. */
export function measure(data,m){
 const L=m[0].length,W=new Set(['D','E','N','MID']);
 const rows=data.staff.map((s,i)=>{
  const get=d=>d<0?(d>=-s.previous.length?s.previous[s.previous.length+d]:null):d>=L?s.next[d-L]??null:m[i][d];
  const mandatory=[],nightWindows=[],windows=[];let nightDensity=0;
  for(let start=-6;start<L;start++){
   const cells=Array.from({length:7},(_,k)=>get(start+k)),end=start+6,active=s.active.slice(Math.max(0,start),Math.min(L,end+1)).some(Boolean);
   if(cells.every(c=>W.has(c)))mandatory.push({from:start,to:end});
   if(!s.dispatch&&!s.nightOnly&&active){const n=cells.filter(c=>c==='N').length,e=Math.max(0,n-3);nightDensity+=e*e;if(e)nightWindows.push({from:start,to:end,nights:n});}
   if(!s.dispatch&&end>=0&&end<L&&active&&cells.every(c=>c!=null&&c!=='DISPATCH')&&cells.filter(c=>W.has(c)).length>=6)windows.push({from:start,to:end});
  }
  let last=-Infinity;const episodeWindows=windows.filter(w=>{if(w.from>last){last=w.to;return true;}return false;});
  return {id:s.id,episodes:episodeWindows.length,episodeWindows,overlapping:windows.length,nightDensity,nightWindows,mandatorySevenWindows:mandatory};
 });
 const pairs=data.weekend.pairs.map(p=>{const own=p.pastA+p.days.filter(d=>['OFF','LEAVE'].includes(m[p.a][d])).length,other=p.pastB+p.days.filter(d=>['OFF','LEAVE'].includes(m[p.b][d])).length;return {...p,own,other,gap:own-other};});
 const rolling=pairs.filter(p=>p.scope==='rolling');
 return {rows,totalEpisodes:rows.reduce((a,r)=>a+r.episodes,0),overlapping:rows.reduce((a,r)=>a+r.overlapping,0),nightDensity:rows.reduce((a,r)=>a+r.nightDensity,0),currentWeekendGap:Math.max(0,...pairs.filter(p=>p.scope==='current').map(p=>Math.abs(p.gap))),rollingWeekendGap:rolling.length?Math.max(...rolling.map(p=>Math.abs(p.gap))):null,weekendPairSquares:pairs.reduce((a,p)=>a+p.gap*p.gap,0),weekendPairs:pairs};
}
export function audit(data,m){
 const b=data.matrix,L=b[0].length,errors=[];if(m.length!==b.length||m.some(r=>r.length!==L))return {passed:false,errors:[{code:'SHAPE'}]};
 const before=measure(data,b),after=measure(data,m);
 data.staff.forEach((s,i)=>{
  if(after.rows[i].mandatorySevenWindows.length)errors.push({code:'MANDATORY_SEVEN_WORK',i});
  for(let d=0;d<L;d++)if(s.locks[d].length&&m[i][d]!==b[i][d])errors.push({code:'LOCK',i,d});
  for(const days of data.monthDays)for(const sh of data.shifts)if(days.filter(d=>m[i][d]===sh).length!==days.filter(d=>b[i][d]===sh).length)errors.push({code:'MONTH_COUNT',i,sh});
  if(after.rows[i].episodes>Math.max(1,before.rows[i].episodes))errors.push({code:'PERSON_REPETITION',i});
  const originalWindows=new Map(before.rows[i].nightWindows.map(w=>[w.from,w.nights]));
  for(const w of after.rows[i].nightWindows){
   if(w.nights>(originalWindows.get(w.from)??3))
    errors.push({code:'N_WINDOW_WORSE',i,from:w.from,to:w.to});
  }
  if(after.rows[i].nightDensity>before.rows[i].nightDensity)errors.push({code:'N_DENSITY',i});
 });
 for(let d=0;d<L;d++)for(const sh of ['D','E','N'])for(const kind of ['staff','senior']){const count=z=>data.staff.reduce((v,s,i)=>v+(z[i][d]===sh?s.coverage[d][sh][kind]:0),0);if(count(m)!==count(b))errors.push({code:'DAILY_COUNT',d,sh,kind});}
 for(let d=0;d<L;d++){
  const counts={D:0,E:0,N:0};
  data.staff.forEach((s,i)=>{const t=s.training?.[d],sh=m[i][d];if(t?.cap&&sh in counts)counts[sh]++;
   if(!t?.link)return;
   if(t.required.some(([from,to])=>m[t.j]?.[d]===from&&sh!==to))errors.push({code:'TRAINING_SYNC',i,d});
   if(['D','E','N','MID'].includes(sh)&&!t.supervisors.some(j=>m[j][d]===sh))errors.push({code:'TRAINING_SUPERVISOR',i,d});
  });
  for(const [sh,count] of Object.entries(counts)){const cap=sh==='N'?data.input.rules.newbieN:data.input.rules.newbieDE;if(cap!=null&&count>cap)errors.push({code:'TRAINING_CAP',sh,d});}
 }
 if(after.totalEpisodes>before.totalEpisodes)errors.push({code:'TOTAL_REPETITION'});if(after.currentWeekendGap>2)errors.push({code:'WEEKEND_LIMIT'});
 return {passed:!errors.length,errors,before,after};
}
