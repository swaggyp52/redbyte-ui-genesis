// A visual comparison tool, not a functional acceptance gate. The same starter,
// authored edit, selected tick and viewport are used on both source revisions.
import { launchChromium, BASE_URL, evidenceDir } from './harness.mjs';
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const label=process.env.RB_SHOT_LABEL??'after';const out=evidenceDir('studio-matched',label);
const browser=await launchChromium();const captures=[];
try {
 const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});const tid=id=>page.getByTestId(id);page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 async function shot(name){await page.waitForFunction(()=>!/Loading (Design|Simulate|Board|Project|Package) workspace/.test(document.body.innerText));await page.waitForTimeout(650);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.screenshot({path:path.join(out,name+'.png')});captures.push({name,viewport:page.viewportSize(),state:await page.evaluate(()=>{const s=window.__RB_PROJECT_RUNTIME__.getState();return{project:s.projectId,example:s.activeExampleId,nodes:s.circuit.nodes.length,run:s.verifyLastRun?.runId,checks:s.verifyLastRun?.assertionStatus,rootPx:getComputedStyle(document.documentElement).fontSize,bodyWidth:document.body.scrollWidth};})});}
 async function timeView(){if(await tid('ide-verify-view-timeline').count())await tid('ide-verify-view-timeline').click();}
 async function run(){await tid('ide-vcb-run').click();await page.waitForFunction(()=>!!window.__RB_PROJECT_RUNTIME__.getState().verifyLastRun);await timeView();}
 await page.goto(BASE_URL,{waitUntil:'networkidle',timeout:60000});
 await tid('ide-project-start-a-lab-primary').click();await page.locator('[data-testid^="ide-project-gannon-lab-card-"]').nth(4).click();await page.locator('[data-testid^="ide-project-gannon-lab-start-"]').first().click();
 await tid('mode-button-design').click();await shot('01-design-normal-1440x900');
 await tid('ide-design-view-toggle').getByRole('button',{name:'Split',exact:true}).click();await shot('02-design-split-1440x900');
 await tid('ide-design-view-toggle').getByRole('button',{name:'Schematic',exact:true}).click();
 await tid('mode-button-verify').click();await timeView();await shot('03-simulate-before-run-1440x900');
 if(await tid('ide-vcb-use-saved-checks').count())await tid('ide-vcb-use-saved-checks').click();await run();
 assert.equal(await page.evaluate(()=>window.__RB_PROJECT_RUNTIME__.getState().verifyLastRun.status),'pass','Same starter passes its authored checks');
 await shot('04-simulate-passing-1440x900');
 const cell=page.getByRole('gridcell',{name:/^EN at t2:/});await cell.click();await run();
 assert.equal(await page.evaluate(()=>window.__RB_PROJECT_RUNTIME__.getState().verifyLastRun.status),'fail','Same EN edit fails the retained expected values');
 await shot('05-simulate-failing-1440x900');
 const inspect=await tid('ide-verify-inspect-circuit').count()?tid('ide-verify-inspect-circuit'):tid('ide-verify-open-circuit-replay');await inspect.click();
 await page.getByLabel('Recorded circuit signal').selectOption('LD0');
 if(await tid('ide-timing-lanes').count()) {
  await tid('ide-timing-lanes').press('Home');await tid('ide-timing-lanes').press('ArrowRight');await tid('ide-timing-lanes').press('ArrowRight');
 } else await tid('ide-verify-tick-scrubber').fill('2');
 await shot('06-linked-investigation-1440x900');
 await page.getByLabel('Close circuit investigation').click();
 await tid('mode-button-project').click();await tid('ide-project-row-doc:overview').click();await shot('07-project-overview-1440x900');
 await tid('ide-project-row-doc:runs').click();await shot('08-project-runs-1440x900');
 await tid('mode-button-hardware').click();await shot('09-board-1440x900');
 await tid('ide-hw-mode-btn-bringup').click();await shot('10-board-check-1440x900');
 await tid('mode-button-export').click();await tid('ide-export-package-files').waitFor();await shot('11-package-1440x900');
 await page.setViewportSize({width:1280,height:650});await tid('mode-button-verify').click();await timeView();await shot('12-stress-1280x650');
 await page.evaluate(()=>document.documentElement.style.fontSize='32px');await shot('13-text200-1280x650');
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({label,baseUrl:BASE_URL,captures,errors},null,2));
 console.log('Captured '+captures.length+' matched states: '+out);
}finally{await browser.close();}
