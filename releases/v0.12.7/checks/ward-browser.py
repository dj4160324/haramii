from pathlib import Path
import json,sys,subprocess
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
repo=Path(sys.argv[1]) if len(sys.argv)>1 else root.parents[1]
case=json.loads((repo/'validation/cpsat-toggle-20261112/case-2-off.json').read_text())
server=subprocess.Popen([sys.executable,str(root/'start.py'),'--port','0','--no-open'],stdout=subprocess.PIPE,text=True)
try:
    with sync_playwright() as p:
        b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--disable-dev-shm-usage'])
        page=b.new_page()
        page.goto(server.stdout.readline().split()[-1])
        result=page.evaluate('''async ({input,matrix})=>{
          const {run}=await import('./assets/main.mjs');
          const r=await run(window.HaramiiCPSATPolicy,input,{matrix},{seconds:20,workers:4,seed:20263786});
          const s=r.test1Recovery;
          const measures=m=>({six:m.totalEpisodes,repeated:m.distribution.repeated.length,night:m.nightDensity,weekend:m.currentWeekendGap,rolling:m.rollingWeekendGap});
          return {version:s.version,solver:s.solver?.status,seen:s.auditedCandidates,accepted:s.acceptedCandidates,adopted:s.adopted,hard:s.remainingBlockers.length,raw:r.browserCPSAT.independentAudit?.passed,before:measures(s.before),after:measures(s.after)};
        }''',dict(input=case['input'],matrix=case['matrix']))
        print(json.dumps(result),flush=True)
        assert result['version']=='0.12.7' and result['solver'] and result['raw'] and not result['hard'],result
        b.close()
finally:
    server.terminate();server.wait()
