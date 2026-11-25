/* Test1 reconstruction. Search objective is weighted; final selection is lexicographic.
   Runtime supplied by caller: identical model runs with local browser or Node WASM. */
export async function solve(data, runtime, {seconds=30,seed=20261118,workers=1,signal,onProgress=()=>{}}={}) {
 const {CpModel,CpSat,LinearExpr,setCloudNoticeEnabled}=runtime;
 setCloudNoticeEnabled(false);
 const model=new CpModel(), b=data.matrix, staff=data.staff, rules=data.input.rules,L=b[0].length,SH=data.shifts;
 const sum=a=>LinearExpr.sum(a),expr=x=>LinearExpr.from(x),add=(x,y)=>expr(x).plus(y),sub=(x,y)=>expr(x).minus(y),mul=(x,y)=>expr(x).times(y);
 let serial=0;const integer=(lo,hi,p)=>model.newIntVar(lo,hi,p+'_'+serial++),bool=p=>model.newBoolVar(p+'_'+serial++);
 const eq=(a,b)=>model.addEquality(a,b),le=(a,b)=>model.add(expr(a).le(b));
 const neg=v=>typeof v==='number'?1-v:v.not();
 const conjunction=terms=>{if(terms.some(v=>v===0))return 0;terms=terms.filter(v=>typeof v!=='number');if(!terms.length)return 1;const z=bool('and');model.addBoolAnd(terms).onlyEnforceIf(z);model.addBoolOr(terms.map(neg)).onlyEnforceIf(z.not());return z;};
 const ge=(v,k)=>{if(typeof v==='number')return Number(v>=k);const z=bool('ge');model.add(expr(v).ge(k)).onlyEnforceIf(z);model.add(expr(v).lt(k)).onlyEnforceIf(z.not());return z;};
 const V=staff.map((s,i)=>Array.from({length:L},(_,d)=>Object.fromEntries(SH.map(sh=>{
  if(s.locks[d].length)return [sh,Number(b[i][d]===sh)];const v=bool(`x_${i}_${d}_${sh}`);model.addHint(v,Number(b[i][d]===sh));return [sh,v];
 }))));
 for(let i=0;i<staff.length;i++)for(let d=0;d<L;d++)if(!staff[i].locks[d].length){eq(sum(SH.map(sh=>V[i][d][sh])),1);if(staff[i].nightOnly){eq(V[i][d].D,0);eq(V[i][d].E,0);}}
 // Do not use Array.at(negative) for unavailable history: it would wrap to a known date.
 const cell=(i,d)=>d<0?(d>=-staff[i].previous.length?staff[i].previous[staff[i].previous.length+d]:undefined):d>=L?staff[i].next[d-L]:b[i][d];
 const issh=(i,d,sh)=>d>=0&&d<L&&SH.includes(sh)?V[i][d][sh]:Number(cell(i,d)===sh);
 const WORK=new Set(['D','E','N','MID']);
 const work=(i,d)=>d<0||d>=L||staff[i].locks[d].length?Number(WORK.has(cell(i,d))):sum(['D','E','N'].map(sh=>V[i][d][sh]));
 const rest=(i,d)=>d<0||d>=L?Number(cell(i,d)==='OFF'):staff[i].locks[d].length?Number(!!staff[i].countsAsOff[d][b[i][d]]):sum(SH.filter(sh=>staff[i].countsAsOff[d][sh]).map(sh=>issh(i,d,sh)));
 const range=(a,z)=>Array.from({length:Math.max(0,z-a)},(_,k)=>a+k);
 const active=(i,a,z)=>range(Math.max(0,a),Math.min(L,z+1)).some(d=>staff[i].active[d]);
 for(let i=0;i<staff.length;i++)for(const days of data.monthDays)for(const sh of SH)eq(sum(days.map(d=>issh(i,d,sh))),days.filter(d=>b[i][d]===sh).length);
 for(let d=0;d<L;d++)for(const sh of ['D','E','N'])for(const kind of ['staff','senior'])eq(sum(staff.map((s,i)=>mul(issh(i,d,sh),s.coverage[d][sh][kind]))),staff.reduce((v,s,i)=>v+(b[i][d]===sh?s.coverage[d][sh][kind]:0),0));
 // A dated pre-independence link can couple two mutable cells or a mutable
 // cell to a protected one. OFF synchronisation is conditional on policy.
 for(let d=0;d<L;d++){
  for(const sh of ['D','E','N']){
   const cap=sh==='N'?rules.newbieN:rules.newbieDE;
   if(cap!=null)le(sum(staff.flatMap((s,i)=>s.training?.[d]?.cap?[issh(i,d,sh)]:[])),cap);
  }
  for(let i=0;i<staff.length;i++){
   const t=staff[i].training?.[d];if(!t?.link)continue;
   for(const [primaryShift,traineeShift] of t.required)le(issh(t.j,d,primaryShift),issh(i,d,traineeShift));
   for(const sh of ['D','E','N','MID'])le(issh(i,d,sh),sum(t.supervisors.map(j=>issh(j,d,sh))));
  }
 }
 const historical=[];
 const episodes=[],extras=[],repeat=[],density=[],overlap=[];
 for(let i=0;i<staff.length;i++){
  const s=staff[i];
  for(let st=-6;st<L;st++)le(sum(range(st,st+7).map(d=>work(i,d))),6);
  const cap=rules.maxWork;if(cap)for(let st=-cap;st<L;st++)le(sum(range(st,st+cap+1).map(d=>work(i,d))),cap);
  const nc=Math.min((s.nightOnly?Math.min(rules.maxNightStreak||3,3):rules.maxNightStreak)||L,Math.max(2,s.before.nightRun));
  for(let st=-nc;st<L;st++)le(sum(range(st,st+nc+1).map(d=>issh(i,d,'N'))),nc);
  const oc=rules.maxOff;if(oc&&!s.nightOnly)for(let st=-oc;st<L;st++)le(sum(range(st,st+oc+1).map(d=>rest(i,d))),oc);
  for(let d=0;d<=L;d++){le(add(issh(i,d-1,'E'),issh(i,d,'D')),1);le(add(issh(i,d-1,'N'),sum(['D','E','MID'].map(sh=>issh(i,d,sh)))),1);}
  for(let d=0;d<L+2;d++)for(const [sh,key]of [['D','noNOD'],['E','noNOE']])if(rules[key])le(sum([issh(i,d-2,'N'),rest(i,d-1),issh(i,d,sh)]),2);
  for(let end=-2;end<L+1;end++){const last=conjunction([issh(i,end-1,'N'),issh(i,end,'N'),neg(issh(i,end+1,'N'))]);for(const d of [end+1,end+2])le(add(last,ge(work(i,d),1)),1);if(s.forbiddenNightEnds.includes(end))eq(last,0);}
  le(sum(range(-1,L+1).map(d=>conjunction([issh(i,d,'N'),neg(issh(i,d-1,'N')),neg(issh(i,d+1,'N'))]))),s.before.singleNights);
  const nd=[];
  if(!s.dispatch&&!s.nightOnly){
   for(let start=-6;start<L;start++){
    const end=start+6;
    if(!active(i,start,end))continue;
    const days=range(start,end+1);
    const baselineNights=days.filter(day=>cell(i,day)==='N').length;
    const nights=sum(days.map(day=>issh(i,day,'N')));
    // Codex Test 1 protects each window, including known boundary shifts.
    le(nights,Math.max(3,baselineNights));
    if(baselineNights<=3)continue;
    const excess=integer(0,baselineNights-3,'n_excess');
    const square=integer(0,(baselineNights-3)**2,'n_square');
    model.addMaxEquality(excess,[0,sub(nights,3)]);
    model.addMultiplicationEquality(square,[excess,excess]);
    nd.push(square);
    const past=data.burden?.rows[i];
    if(end<L&&past?.ends[end]&&past.nightWeight)historical.push(mul(square,past.nightWeight));
   }
  }
  le(sum(nd),s.before.nightDensity);density.push(...nd);
  const events=range(0,L).map(end=>range(end-6,end+1).every(d=>cell(i,d)!=null&&cell(i,d)!=='DISPATCH')&&!s.dispatch&&active(i,end-6,end)?ge(sum(range(end-6,end+1).map(d=>work(i,d))),6):0);
  const dp=[0];for(let end=0;end<L;end++){const z=integer(0,L,'episodes');model.addMaxEquality(z,[dp.at(-1),add(dp[Math.max(0,end-6)],events[end])]);dp.push(z);}
  const ep=dp.at(-1);le(ep,Math.max(1,s.before.episodes));episodes.push(ep);overlap.push(...events);
  const past=data.burden?.rows[i];
  if(past?.sixWeight){let burdenEp=ep;if(past.skipEnds||past.ends.includes(false)){const histDP=[0];for(let end=0;end<L;end++){if(end<past.skipEnds||!past.ends[end]){histDP.push(histDP.at(-1));continue;}const z=integer(0,L,'carry_episodes');model.addMaxEquality(z,[histDP.at(-1),add(histDP[Math.max(0,end-6)],events[end])]);histDP.push(z);}burdenEp=histDP.at(-1);}
   historical.push(mul(burdenEp,past.sixWeight));}
  const extra=integer(0,L,'repeat_excess');model.addMaxEquality(extra,[0,sub(ep,1)]);extras.push(extra);repeat.push(ge(ep,2));
 }
 le(sum(episodes),data.before.totalEpisodes);const maxExtra=integer(0,L,'max_extra');model.addMaxEquality(maxExtra,extras);
 const current=[],rolling=[],squares=[];
 for(const p of data.weekend.pairs){const w=(i,d)=>add(issh(i,d,'OFF'),Number(b[i][d]==='LEAVE')),bound=Math.abs(p.pastA-p.pastB)+p.days.length;
  const diff=integer(-bound,bound,'weekend_diff');eq(diff,add(p.pastA-p.pastB,sum(p.days.map(d=>sub(w(p.a,d),w(p.b,d))))));
  const gap=integer(0,bound,'weekend_gap'),sq=integer(0,bound*bound,'weekend_square');model.addAbsEquality(gap,diff);model.addMultiplicationEquality(sq,[gap,gap]);squares.push(sq);
  if(p.scope==='current'){le(gap,2);current.push(gap);}else rolling.push(gap);
 }
 const maxCur=integer(0,2,'max_current'),maxRoll=integer(0,400,'max_rolling');model.addMaxEquality(maxCur,current.length?current:[0]);model.addMaxEquality(maxRoll,rolling.length?rolling:[0]);
 model.minimize(sum([mul(sum(density),100000),mul(maxExtra,20000),mul(sum(extras),5000),mul(sum(repeat),2000),mul(maxCur,500),mul(maxRoll,200),sum(squares),mul(sum(episodes),50),sum(overlap),sum(historical)]));
 const candidates=[],seen=new Set();let solutionsSeen=0;
 function collect(response){if(!response?.solution?.length)return;const values=response.solution;const matrix=V.map((row,i)=>row.map((vars,d)=>SH.find(sh=>typeof vars[sh]==='number'?vars[sh]:Number(values[vars[sh].index]))||b[i][d]));const key=JSON.stringify(matrix);solutionsSeen++;if(!seen.has(key)){seen.add(key);candidates.push({matrix,objective:response.objectiveValue,atSeconds:response.wallTime});if(candidates.length>200)candidates.shift();onProgress({solutionsSeen});}}
 const started=Date.now();let result,error=null;
 try{result=await CpSat.solve(model,{maxTimeInSeconds:seconds,numWorkers:workers,randomSeed:seed,executor:'worker',signal,onEvent:event=>{if(event.type==='solution')collect(event.response);}});collect(result.response);}catch(e){if(!signal?.aborted)throw e;error='cancelled';}
 return {status:error?'CANCELLED':result.statusName(),seconds:(Date.now()-started)/1000,seed,workers,limitSeconds:seconds,solutionsSeen,candidates,response:result?.responseStats(),engine:'cp-sat-wasm 2.1.0',cancelled:!!error};
}
