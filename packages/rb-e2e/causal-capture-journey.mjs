import { launchChromium, BASE_URL, evidenceDir } from './harness.mjs';
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
const out=evidenceDir('causal-capture',process.env.RB_SHOT_LABEL??'current');const browser=await launchChromium();let page;
try{
 page=await browser.newPage({viewport:{width:1280,height:650}});page.setDefaultTimeout(10000);const tid=id=>page.getByTestId(id);
 await page.goto(BASE_URL,{waitUntil:'networkidle'});await tid('ide-project-start-a-lab-primary').click();await page.locator('[data-testid^="ide-project-gannon-lab-card-"]').nth(4).click();await page.locator('[data-testid^="ide-project-gannon-lab-start-"]').first().click();await tid('mode-button-verify').click();
 await tid('ide-scenario-generators-disclosure').locator('summary').first().click();
 const policy=tid('ide-verify-clock-policy-panel');if(!(await policy.getAttribute('open')))await policy.locator('summary').click();
 await tid('ide-verify-clock-mode-manual').click();
 await tid('ide-scenario-generators-disclosure').locator('summary').first().click();
 const cells=await page.locator('[data-testid^="ide-timing-cell-"]').evaluateAll(nodes=>nodes.slice(0,40).map(node=>({id:node.dataset.testid,label:node.getAttribute('aria-label')})));
 fs.writeFileSync(path.join(out,'cells.json'),JSON.stringify(cells,null,2));
 // Author a visible rising edge at t1 and enable the counter for that capture.
 for(const [label,tick,target]of [['CLK100MHZ',1,1],['RST',1,0],['EN',1,1]]){
  const cell=page.getByRole('gridcell',{name:new RegExp('^'+label+' at t'+tick+':')});
  assert.equal(await cell.count(),1,'The actual '+label+' stimulus has an editable cell');
  if(!(await cell.getAttribute('aria-label')).includes(': '+target))await cell.click();
 }
 await tid('ide-vcb-run').click();
 await tid('ide-verify-inspect-circuit').click();await page.getByLabel('Recorded circuit signal').selectOption('LD0');
 await tid('ide-timing-lanes').press('Home');await tid('ide-timing-lanes').press('ArrowRight');await tid('ide-timing-lanes').press('ArrowRight');
 const threeDrawings=[];
 for(const tick of [2,9]) {
  await tid('ide-timing-lanes').press('Home');
  for(let step=0;step<tick;step++)await tid('ide-timing-lanes').press('ArrowRight');
  const value=await tid('ide-time-selected-value').innerText();
  if(tick===9)assert.equal(value,'unrecorded');else assert.match(value,/^[01]$/);
  const wire=tid('ide-recorded-circuit-svg').locator('[data-recorded-wire-value]:has([data-wire-selected="1"])').first();
  assert.equal(await wire.getAttribute('data-recorded-wire-value'),value,'Recorded wire agrees with time instrument at t'+tick);
  await tid('mode-button-hardware').click();await tid('ide-hw-mode-btn-live').click();
  assert.equal(await tid('ide-hw-ld-0').getAttribute('data-observed-value'),value,'Board agrees with waveform and wire at t'+tick);
  assert.equal(await tid('ide-hw-ld-2').getAttribute('data-observed-value'),'unrecorded','Unused resource never displays zero');
  await page.screenshot({path:path.join(out,'three-drawings-board-t'+tick+'.png')});
  threeDrawings.push({tick,value});
  await tid('mode-button-verify').click();if(!(await tid('ide-recorded-circuit').count()))await tid('ide-verify-inspect-circuit').click();
  await page.getByLabel('Recorded circuit signal').selectOption('LD0');
 }
 await tid('ide-timing-lanes').press('Home');await tid('ide-timing-lanes').press('ArrowRight');await tid('ide-timing-lanes').press('ArrowRight');
 await tid('ide-causal-walk').locator('[data-causal-kind="driver"]').first().click();
 const driver=await tid('ide-recorded-circuit-context').innerText();
 await tid('ide-causal-walk').locator('[data-causal-kind="capture"]').click();
 const capture=await tid('ide-recorded-circuit-context').innerText();
 await tid('ide-causal-walk').locator('[data-causal-kind="stimulus"]').click();
 assert.match(await tid('ide-causal-walk').innerText(),/No earlier cause/);
 await page.screenshot({path:path.join(out,'walked-cause-1280x650.png')});
 const evidence=await page.evaluate(()=>{const r=window.__RB_PROJECT_RUNTIME__.getState().verifyLastRun;return{runId:r.runId,waveform:r.waveform,inputs:r.executionInput.vectors}});
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({baseUrl:BASE_URL,driver,capture,threeDrawings,evidence},null,2));console.log('PASS clickable actual capture: '+out);
}catch(error){if(page){await page.screenshot({path:path.join(out,'failure.png')});console.log((await page.locator('body').innerText()).slice(-6500));}throw error;}finally{await browser.close();}
