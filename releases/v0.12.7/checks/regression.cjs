const fs=require('node:fs'), path=require('node:path'), vm=require('node:vm'), assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'), html=fs.readFileSync(path.join(root,'dist/index.html'),'utf8');
const src=html.match(/<script>([\s\S]*?)<\/script>/)[1], ctx={console,Date,performance,setTimeout,clearTimeout,structuredClone};
vm.createContext(ctx);
vm.runInContext(src.slice(0,src.indexOf('    window.koreanHolidays'))+'\nglobalThis.A=RosterCPSATPolicy',ctx);
const A=ctx.A, {E,S}=A.api;
const fixture=()=>JSON.parse(fs.readFileSync(path.join(root,'dist/qa/synthetic-gate.json')));
const x=fixture().input,s=x.staff[0];
function checkSeven(shifts,prev=[],next=[]){
 const row=Array(x.dates.length).fill('OFF');shifts.forEach((v,i)=>row[i]=v);
 s.previousShifts=prev;s.nextShifts=next;
 return E.patternIssuesForSurplus(x,s,row).some(p=>p.code==='MANDATORY_SEVEN_WORK');
}
for(const cap of [null,5,6,10]){x.rules.maxWork=cap;assert(checkSeven(['D','E','MID','D','N','N','N']));}
assert(checkSeven(['D'],Array(6).fill('D')));
assert(!checkSeven(['D'],['D','D',null,'D','D','D']));
assert(checkSeven([...Array(x.dates.length-1).fill('OFF'),'D'],[],Array(6).fill('D')));
assert(!checkSeven(Array.from({length:14},(_,i)=>i%7===3?'OFF':'D')));
console.log('PASS mandatory seven / known boundaries / six-duty episodes');
const original=fixture();
const testInput=original.input, staff=testInput.staff[0];
staff.previousShifts=['N','N','OFF'];staff.previousShiftTimes=structuredClone(testInput.rules.shiftTimes);
const rows=testInput.staff.map(()=>Array(testInput.dates.length).fill('OFF'));
rows[0][1]='D'; // Last night ended at 06:00 on yesterday's rest day.
function flags(){return E.validate(testInput,rows).filter(q=>q.staffId===staff.id);}
assert(!flags().some(q=>q.code==='N_RECOVERY'));
testInput.rules.shiftTimes.D.start='05:59';
assert(flags().some(q=>q.code==='N_RECOVERY'));
assert.throws(()=>S.savePlan(null,testInput,{matrix:rows}),/48시간/);
testInput.rules.shiftTimes.D.start='06:00';rows[0][0]='D';
assert.throws(()=>S.savePlan(null,testInput,{matrix:rows}),/48시간/);
staff.previousShifts=[];assert(flags().some(q=>q.code==='HISTORY'));
console.log('PASS 48h / 47h59 / premature return / missing-history warning');
{
 const {input,result}=fixture(), trainee=input.staff[1];
 Object.assign(trainee,{isNewbie:true,precId:input.staff[0].id,independenceDate:input.dates[5].iso});
 input.rules.sync=true;
 let model=A.encode(input,result.matrix);
 assert(model.staff[1].training[4].required.some(([mentor,student])=>mentor==='D'&&student==='D'));
 assert.equal(model.staff[1].training[5],null);
 assert.equal(model.staff[1].locks[5].length,0);
 assert.equal(model.staff[0].locks[5].length,0);
 input.rules.sync=false;
 model=A.encode(input,result.matrix);
 assert.equal(model.staff[1].training[4].required.length,0);
 assert(model.staff[1].training[4].supervisors.includes(0));
 console.log('PASS dated independence, preceptor linkage and sync option');
}
(async()=>{
 const {audit,measure}=await import('../dist/assets/raw-audit.mjs');
 const {input,result}=fixture(), b=result.matrix.map(r=>r.map(()=> 'OFF'));
 // Move the same four-night block between equally long, fully observed windows.
 b[0].fill('N',2,6);
 const m=structuredClone(b);m[0].fill('OFF');m[0].fill('N',8,12);
 const model=A.encode(input,b);
 assert.equal(measure(model,b).nightDensity,measure(model,m).nightDensity);
 assert(audit(model,m).errors.some(q=>q.code==='N_WINDOW_WORSE'));
 const check=structuredClone(model);check.staff[0].protectedOff+=1;
 assert(A.auditCandidate(check,b).issues.some(q=>q.code==='PROTECTED_OFF'));
 console.log('PASS shifted night concentration and protected OFF audits');
})().catch(e=>{console.error(e);process.exitCode=1;});
