import { launchChromium, BASE_URL, evidenceDir } from './harness.mjs';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
const out=evidenceDir('board-check-composition',process.env.RB_SHOT_LABEL??'current');
const browser=await launchChromium();
try {
 const page=await browser.newPage({viewport:{width:1280,height:650}}); const tid=id=>page.getByTestId(id);
 await page.goto(BASE_URL,{waitUntil:'networkidle'});
 await tid('ide-project-start-a-lab-primary').click();
 await page.locator('[data-testid^="ide-project-gannon-lab-card-"]').nth(4).click();
 await page.locator('[data-testid^="ide-project-gannon-lab-start-"]').first().click();
 await tid('mode-button-verify').click(); await tid('ide-vcb-run').click();
 await tid('mode-button-hardware').click();
 await page.screenshot({path:path.join(out,'board-1280x650.png')});
 await tid('ide-hw-mode-btn-bringup').click();
 const geometry=await tid('ide-hw-bringup-next').evaluate(button=>{
  const r=button.getBoundingClientRect();const hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
  const board=document.querySelector('.rb-board-check-canvas').getBoundingClientRect();
  return {button:r.toJSON(),board:board.toJSON(),receivesClick:button===hit||button.contains(hit),height:innerHeight};
 });
 assert.ok(geometry.receivesClick && geometry.button.bottom<geometry.height-28,'Next is directly reachable before scrolling');
 assert.ok(geometry.button.top>=geometry.board.bottom,'Step controls belong below the board');
 await page.screenshot({path:path.join(out,'board-check-1280x650.png')});
 assert.equal(await tid('ide-mode-body').getByTestId('ide-hw-bringup-step').count(),1,'Actual check steps belong under the board in the main workspace');
 const first=await tid('ide-hw-bringup-step').innerText();
 await tid('ide-hw-bringup-next').click();
 assert.notEqual(await tid('ide-hw-bringup-step').innerText(),first,'Next shows the next actual check step');
 await tid('ide-hw-board-check-exit').click();
 await tid('ide-hw-board-resource-summary').waitFor();
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({baseUrl:BASE_URL,viewport:'1280x650',stepsWorked:true,geometry},null,2));
 console.log('PASS Board Check composition: '+out);
}finally{await browser.close();}
