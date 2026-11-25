import {history,score,measureBurden} from './burden.mjs';
import {solve} from './solver.mjs';
import {audit as rawAudit} from './raw-audit.mjs';
export async function optimize(A,input,result,runtime,options={}){
 const start=Date.now(),before=A.metrics(input,result.matrix),admission=A.admission(input,result.matrix);
 let selected=result.matrix,bestRank=admission.audit.valid?before.rank:null,adopted=false,solver=null,raw=null;
 const audits=[];let burden=null;
 if(admission.allowed){
  const model=A.encode(input,result.matrix);model.burden=history(A,input,result.matrix);const cost=m=>score(model.burden,measureBurden(model,m));
  const initialCost=cost(result.matrix);burden={...model.burden,beforeCost:initialCost,afterCost:initialCost};if(bestRank)bestRank=[...bestRank,initialCost];options.onPhase?.('solve');
  solver=await solve(model,runtime,options);options.onPhase?.('audit');
  for(const [k,c]of solver.candidates.entries()){
   const a=A.auditCandidate(model,c.matrix);let independent=null;
   if(a.accepted){independent=rawAudit(model,c.matrix);for(const key of ['totalEpisodes','overlapping','currentWeekendGap','rollingWeekendGap','weekendPairSquares','nightDensity'])if(independent.after[key]!==a.metrics[key]){a.accepted=false;a.issues.push({code:'AUDIT_DISAGREEMENT',field:key});}if(!independent.passed)a.accepted=false;}
   const candidateCost=cost(c.matrix);const rank=[...a.metrics.rank,candidateCost];
   audits.push({candidate:k,accepted:a.accepted,issues:a.issues,rank,rawPassed:independent?.passed??null});
   if(a.accepted&&(bestRank===null||A.compare(rank,bestRank)<0)){selected=c.matrix;bestRank=rank;burden.afterCost=candidateCost;raw=independent;adopted=true;}
   // Yield between full validator passes so the progress UI can paint.
   if(k%4===3)await new Promise(resolve=>setTimeout(resolve,0));
  }
  if(!raw)raw=rawAudit(model,selected);
 }
 const final=A.baseAudit(input,selected),after=A.metrics(input,selected),confirmationReady=admission.reason!=='actual-record'&&final.confirmationReady&&(raw===null||raw.passed);
 const summary={version:'0.12.7',burden,reconstruction:true,admission:{allowed:admission.allowed,reason:admission.reason,weekendOverTwoAdmitted:admission.weekendOverTwoAdmitted},adopted,status:confirmationReady?'review-ready':'unresolved',confirmationReady,actualSaved:false,solver:solver?{...solver,candidates:undefined}:null,before,after,remainingBlockers:final.blockers,decisionPending:final.decisionPending,auditedCandidates:audits.length,acceptedCandidates:audits.filter(a=>a.accepted).length,totalSeconds:(Date.now()-start)/1000};
 return {...result,matrix:selected,issues:final.issues,fairness:final.fairness,preferences:A.api.P.analyse(input,selected),carryover:A.api.E.carryover(input,selected),test1Recovery:summary,browserCPSAT:{summary,candidateAudits:audits,independentAudit:raw},confirmationReady};
}
