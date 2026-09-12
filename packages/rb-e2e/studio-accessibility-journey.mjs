import { launchChromium, BASE_URL, evidenceDir } from './harness.mjs';
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const out=evidenceDir('studio-accessibility',process.env.RB_SHOT_LABEL??'current');const browser=await launchChromium();const results=[];
try {
 for(const config of [{width:1440,height:900,root:16},{width:1280,height:650,root:16},{width:1280,height:650,root:32},{width:720,height:450,root:16}]) {
  const page=await browser.newPage({viewport:config,reducedMotion:'reduce'});const tid=id=>page.getByTestId(id);page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const activate=async locator=>{await locator.scrollIntoViewIfNeeded();await locator.focus();await page.keyboard.press('Enter');};
  const measure=async locator=>{await locator.scrollIntoViewIfNeeded();return locator.evaluate(element=>{
   const rect=element.getBoundingClientRect();let clip={left:0,top:0,right:innerWidth,bottom:innerHeight};let parent=element.parentElement;
   while(parent){const s=getComputedStyle(parent);const r=parent.getBoundingClientRect();if(/auto|scroll|hidden|clip/.test(s.overflowX)){clip.left=Math.max(clip.left,r.left);clip.right=Math.min(clip.right,r.right);}if(/auto|scroll|hidden|clip/.test(s.overflowY)){clip.top=Math.max(clip.top,r.top);clip.bottom=Math.min(clip.bottom,r.bottom);}parent=parent.parentElement;}
   const area=Math.max(0,Math.min(rect.right,clip.right)-Math.max(rect.left,clip.left))*Math.max(0,Math.min(rect.bottom,clip.bottom)-Math.max(rect.top,clip.top));
   const hit=document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2);
   const rgba=value=>{const m=value.match(/[\d.]+/g)?.map(Number)??[0,0,0];return[m[0],m[1],m[2],m[3]??1];};
   const over=(a,b)=>a.slice(0,3).map((v,i)=>v*a[3]+b[i]*(1-a[3]));
   const ancestors=[];for(let p=element;p;p=p.parentElement)ancestors.push(p);let background=[255,255,255];for(const p of ancestors.reverse())background=over(rgba(getComputedStyle(p).backgroundColor),background);
   const foreground=over(rgba(getComputedStyle(element).color),background);const light=c=>c.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
   const a=light(foreground),b=light(background);return {visibleFraction:area/(rect.width*rect.height),receivesClick:hit===element||element.contains(hit),contrast:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),foreground,background,rect:rect.toJSON(),clip,hit:hit?.outerHTML.slice(0,160)};
  });};
  try {
   await page.goto(BASE_URL,{waitUntil:'networkidle'});await activate(tid('ide-project-start-a-lab-primary'));await activate(page.locator('[data-testid^="ide-project-gannon-lab-card-"]').nth(4));
   // Enter on a list option performs its primary action directly.
   if(await page.locator('[data-testid^="ide-project-gannon-lab-start-"]').count())await activate(page.locator('[data-testid^="ide-project-gannon-lab-start-"]').first());
   await page.evaluate(root=>document.documentElement.style.fontSize=root+'px',config.root);await activate(tid('mode-button-design'));await activate(tid('ide-design-test-design'));
   const lane=tid('ide-timing-lanes');await lane.focus();await page.keyboard.press('Home');
   await page.waitForFunction(()=>{const element=document.querySelector('[data-testid="ide-timing-lanes"]');return element&&parseFloat(getComputedStyle(element).outlineWidth)>0;},undefined,{timeout:2000});
   const focus=await lane.evaluate(element=>{const style=getComputedStyle(element);return {visible:element.matches(':focus-visible'),style:style.outlineStyle,width:style.outlineWidth,token:style.getPropertyValue('--wb-focus'),active:document.activeElement?.outerHTML.slice(0,160)};});
   assert.ok(focus.visible&&focus.style!=='none'&&parseFloat(focus.width)>0,'The keyboard grid has a visible focus outline '+JSON.stringify(focus));
   for(let attempt=0;attempt<8&&!/^EN ·/.test(await tid('ide-time-selection').locator('strong').innerText());attempt++)await page.keyboard.press('ArrowDown');
   assert.match(await tid('ide-time-selection').locator('strong').innerText(),/^EN ·/,'The grid keyboard selects a driven input lane');
   await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');
   const before=await tid('ide-timing-cell-en-2').getAttribute('aria-label');await page.keyboard.press('Space');assert.notEqual(await tid('ide-timing-cell-en-2').getAttribute('aria-label'),before,'Space authors a stimulus value through the grid');
   await activate(tid('ide-vcb-run'));await tid('ide-run-identity').waitFor();
   const contrasts=[];for(const id of ['ide-vcb-run','ide-vcb-reproduce','ide-run-repetition']){const measured=await measure(tid(id));assert.ok(measured.visibleFraction>.98 && measured.receivesClick,id+' remains reachable '+JSON.stringify(measured));assert.ok(measured.contrast>=4.5,id+' text contrast '+measured.contrast);contrasts.push({id,...measured});}
   if(await tid('ide-verify-fail-nav-summary').count()){const measured=await measure(tid('ide-verify-fail-nav-summary').locator('code').first());assert.ok(measured.contrast>=4.5,'Failure value contrast '+measured.contrast);contrasts.push({id:'failure-value',...measured});await activate(tid('ide-verify-fail-nav-first'));}
   await lane.focus();await page.keyboard.press('End');assert.equal(await tid('ide-time-selected-value').innerText(),'unrecorded','Keyboard navigation beyond samples never invents zero');
   await activate(tid('ide-verify-details'));await activate(page.getByLabel('Close simulation details'));await activate(tid('ide-verify-inspect-circuit'));await activate(page.getByLabel('Close circuit investigation'));
   await activate(tid('mode-button-hardware'));await activate(page.getByRole('button',{name:'Edit mapping for LD0',exact:true}));await tid('ide-hw-board-resource-summary').waitFor();
   await activate(tid('ide-hw-clear-selected-resource'));assert.match(await tid('ide-hw-mapping-overview-unassigned').innerText(),/Unassigned\s*1/);
   await activate(tid('ide-hw-use-recommended'));assert.match(await tid('ide-hw-mapping-overview-unassigned').innerText(),/Unassigned\s*0/);
   await activate(tid('mode-button-export'));const generate=page.getByRole('button',{name:/^Generate.*ZIP$/});await generate.waitFor();const packageAction=await measure(generate);assert.ok(packageAction.visibleFraction>.98&&packageAction.receivesClick,'Package primary action receives its own hit');
   await activate(tid('ide-export-open-handoff'));assert.equal(await tid('ide-export-open-handoff').innerText(),'Back to package');await activate(tid('ide-export-open-handoff'));
   assert.deepEqual(errors,[]);await page.screenshot({path:path.join(out,config.width+'x'+config.height+'-root'+config.root+'.png')});results.push({config,contrasts,packageAction,errors});
  }catch(error){await page.screenshot({path:path.join(out,'failure-'+config.width+'-root'+config.root+'.png')});throw error;}finally{await page.close();}
 }
 console.log('PASS keyboard authoring, run, inspection, Board, Package and measured contrast at '+results.length+' scales');
}finally{fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({baseUrl:BASE_URL,results},null,2));await browser.close();}
