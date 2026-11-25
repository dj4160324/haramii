"""Run against the included local launcher using a clean Chromium profile."""
from pathlib import Path
import subprocess, sys, json, tempfile
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
server=subprocess.Popen([sys.executable,str(root/'start.py'),'--port','0','--no-open'],stdout=subprocess.PIPE,text=True)
try:
    url=server.stdout.readline().split()[-1]
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--disable-dev-shm-usage'])
        page=browser.new_page()
        page.goto(url+'qa/runtime-check.html')
        page.locator('#test').click()
        page.wait_for_function("!['대기','계산 중'].includes(document.querySelector('#result').textContent)",timeout=90000)
        smoke=json.loads(page.locator('#result').inner_text())
        assert smoke['adopted'] and smoke['rawAudit'] and smoke['confirmationReady'],smoke
        print('WASM',smoke,flush=True)
        page.goto(url)
        alerts=[]
        def dialog(d):
            alerts.append(d.message)
            d.accept()
        page.on('dialog',dialog)
        data=json.loads((root/'dist/qa/synthetic-gate.json').read_text())
        staff=data['input']['staff']
        controls=dict(useWeekdayQuota=True,useWeekendQuota=True,minSeniorPerShift=0,surplusEnabled=False,ruleMaxNight=False,ruleMaxConsecutive=False,ruleMaxOffLimit=False,ruleSleepingOff=False,ruleNightLimit=False,ruleWeekendOff=False,ruleHolidayAddOff=False,fallbackMinOffCount=4)
        for day in ('Weekday','Weekend'):
            for shift,value in (('Day',1),('Eve',0),('Nit',0)):
                controls['minStaff'+shift+day]=value
        saved=dict(format='ward-roster-v11',scheduleType='4WEEK',controls=controls,staff=staff,dirty=True)
        page.locator('#importFile').set_input_files(dict(name='ward.json',mimeType='application/json',buffer=json.dumps(saved).encode()))
        page.wait_for_function("window.globalStaffData.length===4",timeout=10000)
        page.evaluate('goToStep3()')
        page.locator('#submitBtn').click()
        try:
            page.wait_for_function('typeof lastResult!=="undefined" && lastResult?.test1Recovery?.version==="0.12.7"',timeout=135000)
        except Exception:
            print('diagnosis', alerts, page.locator('#progressText').inner_text(),page.locator('#cpSatStatus').text_content(),flush=True)
            raise
        out=page.evaluate('({days:lastResult.matrix[0].length,staff:lastResult.matrix.length,solver:lastResult.test1Recovery.solver?.status,ready:lastResult.confirmationReady,blockers:lastResult.test1Recovery.remainingBlockers,decision:lastResult.test1Recovery.decisionPending,status:lastResult.test1Recovery.status})')
        assert out['solver'] in ('OPTIMAL','FEASIBLE') and not out['blockers'] and (out['ready'] or out['decision']),out
        with page.expect_download() as dl:page.evaluate('saveFile()')
        with tempfile.TemporaryDirectory() as tmp:
            file=Path(tmp)/'roundtrip.json'
            dl.value.save_as(file)
            m=json.loads(file.read_text())['result']['matrix']
            page.reload()
            page.locator('#importFile').set_input_files(str(file))
            page.wait_for_function('typeof lastResult!=="undefined" && lastResult?.matrix?.length===4')
            assert page.evaluate('lastResult.matrix')==m
        print('Generate / save / reopen',out,flush=True)
        browser.close()
finally:
    server.terminate()
    server.wait()
