const fs = require('node:fs'), path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const dir=path.resolve(__dirname,'..');
const root=process.argv[2]||path.resolve(dir,'../..');
const html=fs.readFileSync(path.join(dir,'dist/index.html'),'utf8');
const source=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const ctx={Date,console,setTimeout,clearTimeout,structuredClone,performance};vm.createContext(ctx);
vm.runInContext(source.slice(0,source.indexOf('    window.koreanHolidays'))+'\nglobalThis.policy=RosterCPSATPolicy',ctx);
const A=ctx.policy;
const read=p=>JSON.parse(fs.readFileSync(path.join(root,'validation',p+'.json')));
(async()=>{
 const {audit}=await import('../dist/assets/raw-audit.mjs');
 for(const n of [2,5,6]){
  const prefix=n===6?'test1-gate-20261114/case-6':'cpsat-toggle-20261112/case-'+n;
  const {input,matrix}=read(prefix+(n===6?'-old':'-off'));
  const model=A.encode(input,matrix),solutions=read(prefix+(n===6?'-repair-solver':'-on-solver')).solutions;
  let passed=0;
  for(const sol of solutions){
   if(A.auditCandidate(model,sol.matrix).accepted && audit(model,sol.matrix).passed)passed++;
  }
  console.log(JSON.stringify({case:n,total:solutions.length,accepted:passed}));
 }
})().catch(e=>{console.error(e);process.exitCode=1});
