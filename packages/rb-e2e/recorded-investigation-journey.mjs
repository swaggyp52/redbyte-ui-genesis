// One connected experiment: zero checks, check failure/repair, real gate defect,
// immutable historical investigation, Project ledger, a real package, and reload.
// All changes use visible controls; runtime reads only assert evidence ownership.
import { launchChromium, BASE_URL, evidenceDir } from './harness.mjs';
import assert from 'node:assert/strict';import path from 'node:path';import fs from 'node:fs';import {createHash} from 'node:crypto';
const out=evidenceDir('recorded-investigation',process.env.RB_SHOT_LABEL??'current');
const browser=await launchChromium();const results=[];let page;
try{
 for(const viewport of [{width:1440,height:900},{width:1280,height:650}]){
  const context=await browser.newContext({viewport});page=await context.newPage();page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const tid=id=>page.getByTestId(id);const shot=name=>page.screenshot({path:path.join(out,`${name}-${viewport.width}x${viewport.height}.png`)});
  const selectedRun=()=>page.evaluate(()=>JSON.parse(JSON.stringify(window.__RB_PROJECT_RUNTIME__.getState().verifyLastRun??null)));
  const run=async()=>{const previous=(await selectedRun())?.runId;await tid('ide-vcb-run').click();await page.waitForFunction(id=>window.__RB_PROJECT_RUNTIME__.getState().verifyLastRun?.runId!==id,previous);return selectedRun();};
  const tick=async n=>{await tid('ide-timing-lanes').press('Home');for(let i=0;i<n;i++)await tid('ide-timing-lanes').press('ArrowRight');};
  const editor=async()=>{const d=tid('ide-scenario-event-editor-details');if((await d.getAttribute('open'))===null)await d.locator('summary').click();};
  const setCheck=async value=>{await tick(3);await editor();const c=tid('ide-scenario-check-q0');for(let i=0;i<4;i++){if((await c.locator('strong').innerText()).trim()===value)return;await c.click();}assert.equal((await c.locator('strong').innerText()).trim(),value);};
  await page.goto(BASE_URL,{waitUntil:'networkidle'});await tid('ide-project-start-a-lab-primary').click();await page.locator('[data-testid^="ide-project-gannon-lab-card-"]').nth(4).click();await page.locator('[data-testid^="ide-project-gannon-lab-start-"]').first().click();
  await tid('mode-button-design').click();await tid('ide-design-test-design').click();await tid('ide-vcb-run').waitFor();assert.equal(await selectedRun(),null,'Design handoff does not auto-run');
  await shot('counter-before-run');
  await tid('ide-verify-details').click();await tid('ide-sim-clear-checks').click();await page.getByLabel('Close simulation details').click();
  const observed=await run();assert.equal(observed.assertionStatus,'not-configured');assert.match(await tid('ide-run-check-result').innerText(),/No checks/);assert.doesNotMatch(await tid('ide-run-check-result').innerText(),/passed/i);
  await tick(3);await tid('ide-timing-check-q0-3').click();const actual=await tid('ide-time-selected-value').innerText();assert.match(actual,/^[01]$/);
  await shot('counter-observed');
  const wrong=actual==='0'?'1':'0';await setCheck(wrong);const failed=await run();assert.equal(failed.status,'fail');assert.equal(failed.report.rows.length,1);assert.equal(failed.report.rows[0].actual,actual);
  await tid('ide-verify-inspect-circuit').click();await page.getByLabel('Recorded circuit signal').selectOption('LD0');await tick(3);
  assert.match(await tid('ide-recorded-circuit-context').innerText(),new RegExp('t3.*LD0[\\s\\S]*LD0 = '+actual));
  assert.ok(await tid('ide-recorded-circuit-svg').locator('[data-wire-selected="1"]').count()>0);
  await shot('counter-failed-check');await page.getByLabel('Close circuit investigation').click();
  await setCheck(actual);const repaired=await run();assert.equal(repaired.status,'pass');await shot('counter-passing');
  const picker=page.getByLabel('Recorded run',{exact:true});await picker.selectOption(failed.runId);{ const selected=await selectedRun(); fs.writeFileSync(path.join(out,'retained-comparison.json'),JSON.stringify({failed,selected},null,2));
    // Persisted evidence is JSON; optional undefined clone properties do not alter it.
    assert.deepEqual(JSON.parse(JSON.stringify(selected)),JSON.parse(JSON.stringify(failed)),'The failed record is immutable after check repair'); }
  await picker.selectOption(repaired.runId);
  await tid('mode-button-design').click();await page.locator('[data-node-id="xor0"]').first().click();await tid('ide-design-swap-or').click();await tid('ide-design-test-design').click();
  assert.match(await tid('ide-run-input-changes').innerText(),/Design changed.*XOR.*OR/);
  const defect=await run();assert.equal(defect.status,'fail','Replacing XOR0 by OR causes a real output mismatch at t3');assert.ok(defect.circuitSnapshot.nodes.some(n=>n.id==='xor0'&&n.type==='OR'));
  await tid('ide-verify-inspect-circuit').click();await page.getByLabel('Recorded circuit signal').selectOption('LD0');await tick(3);await shot('counter-design-defect');
  await page.getByRole('button',{name:'Edit current design',exact:true}).click();await page.locator('[data-node-id="xor0"]').first().click();await tid('ide-design-swap-xor').click();await tid('ide-design-test-design').click();
  const restored=await run();assert.equal(restored.status,'pass');assert.equal(restored.outputDigest,observed.outputDigest,'Repair restores the original circuit output digest');
  await picker.selectOption(defect.runId);assert.deepEqual(await selectedRun(),defect,'Historical OR topology and failed samples survive repair');
  // The Project explorer is the one document navigator and every retained recording opens exactly.
  await tid('mode-button-project').click();await shot('project-overview');await tid('ide-project-row-doc:runs').click();await shot('project-runs');
  assert.equal(await tid('ide-project-explorer').getByTestId('ide-project-row-doc:runs').count(),1);
  await tid(`ide-project-run-evidence-${defect.runId}`).click();assert.deepEqual(await selectedRun(),defect);assert.equal(await tid('mode-button-verify').getAttribute('aria-selected'),'true');
  await picker.selectOption(restored.runId);
  await tid('mode-button-export').click();await tid('ide-export-package-files').waitFor();await shot('counter-package-before');
  const [download]=await Promise.all([page.waitForEvent('download',{timeout:30000}),tid('ide-export-package-build-v1').click()]);const zip=path.join(out,`counter-package-${viewport.width}x${viewport.height}.zip`);await download.saveAs(zip);await tid('ide-export-download-success').waitFor();
  const sha=(await tid('ide-export-package-sha256').innerText()).trim();
  assert.equal(sha,createHash('sha256').update(fs.readFileSync(zip)).digest('hex'),'The visible package digest identifies the downloaded bytes');
  assert.equal(await tid('ide-export-package-inspector-v1').getAttribute('data-export-verification-trust'),'trusted');await shot('counter-package');await tid('ide-export-open-handoff').click();assert.equal(await tid('ide-export-open-handoff').innerText(),'Back to package');await shot('counter-package-report');await tid('ide-export-open-handoff').click();
  await page.reload({waitUntil:'networkidle'});await tid('ide-export-package-inspector-v1').waitFor();assert.equal(await tid('ide-export-package-inspector-v1').getAttribute('data-export-verification-trust'),'trusted');
  await tid('mode-button-verify').click();assert.equal((await selectedRun()).runId,restored.runId);await picker.selectOption(defect.runId);assert.deepEqual(await selectedRun(),defect,'Reload retains the exact failed recording');
  await tid('ide-verify-inspect-circuit').click();await page.getByLabel('Recorded circuit signal').selectOption('LD0');await tick(3);await shot('counter-retained-failure');
  await page.evaluate(()=>document.documentElement.style.fontSize='32px');await page.getByRole('button',{name:'Circuit focus',exact:true}).click();await page.getByRole('button',{name:'Fit circuit',exact:true}).click();await shot('counter-large-text');
  assert.deepEqual(errors,[]);results.push({viewport,observed:observed.runId,failed:failed.runId,defect:defect.runId,restored:restored.runId,originalDigest:observed.outputDigest,repairedDigest:restored.outputDigest,packageSha256:sha,errors});await context.close();
 }
}catch(error){if(page&&!page.isClosed()){await page.screenshot({path:path.join(out,'failure.png')});console.log((await page.locator('body').innerText()).slice(-4000));}throw error;}
finally{fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({baseUrl:BASE_URL,results},null,2));await browser.close();}
console.log(`PASS connected recording repair at ${results.length} viewports: ${out}`);
