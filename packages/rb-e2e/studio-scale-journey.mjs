import { launchChromium, BASE_URL, evidenceDir } from './harness.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const out=evidenceDir('studio-scale',process.env.RB_SHOT_LABEL??'current');
const browser=await launchChromium(); const results=[];
try {
 for(const config of [
  {width:1920,height:1080,text:1},{width:1440,height:900,text:1},{width:1366,height:768,text:1},
  {width:1280,height:650,text:1},{width:1280,height:650,text:2},{width:720,height:450,text:1},
 ]) {
  const name=`${config.width}x${config.height}-text${config.text}`;
  const page=await browser.newPage({viewport:config});const tid=id=>page.getByTestId(id);const errors=[];
  page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(8000);
  try {
   await page.goto(BASE_URL,{waitUntil:'networkidle'});
   await tid('ide-project-start-a-lab-primary').click();
   await page.locator('[data-testid^="ide-project-gannon-lab-card-"]').nth(4).click();
   await page.locator('[data-testid^="ide-project-gannon-lab-start-"]').first().click();
   await page.evaluate(scale=>document.documentElement.style.fontSize=`${16*scale}px`,config.text);
   await tid('mode-button-design').click();
   await tid('ide-design-explore').click();await tid('ide-design-live-step').click();
   assert.match(await tid('ide-design-live-tick').innerText(),/1 clock edge/);
   await tid('ide-design-live-reset').click();await tid('ide-design-explore').click();
   await page.screenshot({path:path.join(out,`${name}-design.png`)});
   await tid('ide-design-test-design').click();await tid('ide-vcb-run').click();
   const before=await tid('ide-run-output-digest').getAttribute('data-digest');
   const cell=page.locator('[data-testid^="ide-timing-cell-"][data-testid$="-2"]:not([data-generated="true"])').first();
   const value=await cell.getAttribute('aria-label');await cell.click();
   assert.notEqual(await cell.getAttribute('aria-label'),value);
   await tid('ide-vcb-run').click();
   assert.notEqual(await tid('ide-run-output-digest').getAttribute('data-digest'),before);
   await tid('ide-verify-details').click();await page.getByLabel('Close simulation details').click();
   await cell.scrollIntoViewIfNeeded();
   await page.screenshot({path:path.join(out,`${name}-simulate.png`)});
   const geometry=await page.evaluate(()=>({viewport:innerWidth,body:document.body.scrollWidth,root:document.documentElement.scrollWidth,
    instrument:document.querySelector('[data-testid="ide-timing-lanes"]').getBoundingClientRect().toJSON()}));
   assert.ok(geometry.root<=config.width+2,`No page-wide horizontal overflow: ${JSON.stringify(geometry)}`);
   assert.deepEqual(errors,[]);
   results.push({config,passed:true,geometry,errors});
  }catch(error){await page.screenshot({path:path.join(out,`${name}-failure.png`)}).catch(()=>{});results.push({config,passed:false,error:String(error),errors});}
  await page.close();
 }
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({baseUrl:BASE_URL,results},null,2));
 console.log(JSON.stringify(results.map(({config,passed,error})=>({config,passed,error})),null,2));
 assert.ok(results.every(result=>result.passed),'Every scale supports a meaningful edit and run');
}finally{await browser.close();}
