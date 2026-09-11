import { chromium } from 'playwright';
const B='http://localhost:3022';
const errs=[];
const b=await chromium.launch({executablePath:process.env.HOME+'/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome'});
const p=await (await b.newContext({viewport:{width:1400,height:1000}})).newPage();
p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,160));});
p.on('pageerror',e=>errs.push('PE '+e.message.slice(0,160)));
let pass=0,fail=0;const F=[];
const ok=(c,l)=>{if(c){pass++;console.log('  ✓ '+l);}else{fail++;F.push(l);console.log('  ✗ '+l);}};

// 1. From DPC-2026-0007 (Alger→Constantine, validée) → complete mission, group with DPC-0008
// First reset those DPCs to VALIDEE (seed already made a grouped mission with them → TRANSFORMEE)
// use a fresh pair: create 2 DPCs Alger→Constantine axis
await fetch(B+'/api/dpc-requests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:'UIG-1',depAller:'Alger',destAller:'Constantine',dateAller:'2026-09-20',dateRetour:'2026-09-21',structure:'Eq. A',bu:'Commercial',pax:3,statut:'VALIDEE'})});
await fetch(B+'/api/dpc-requests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:'UIG-2',depAller:'Alger',destAller:'Sétif',dateAller:'2026-09-20',dateRetour:'2026-09-21',structure:'Eq. B',bu:'Logistique',pax:2,statut:'VALIDEE'})});

await p.goto(B+'/missions?dpc=UIG-1',{waitUntil:'networkidle'});
await p.waitForTimeout(1800);
const modalTxt=()=>p.locator('.modal-ov').innerText().then(t=>t.replace(/\s+/g,' '));
ok((await modalTxt()).includes('Demandes de prise en charge groupées'), 'section « Demandes groupées » affichée');
ok((await modalTxt()).includes('UIG-2'), 'la demande UIG-2 (même axe) est proposée');
// check UIG-2
await p.locator('.modal-ov input[type=checkbox]').filter({has:p.locator('..')}).nth(1).check().catch(async()=>{
  // fallback: find label with UIG-2
  const lbl=p.locator('label',{hasText:'UIG-2'}); await lbl.locator('input[type=checkbox]').check();
});
await p.waitForTimeout(2000);
const t2=await modalTxt();
ok(/Sétif/.test(t2), 'étape Sétif ajoutée au trajet');
ok(/Part frais \+ cession|part frais/i.test(t2)||/%/.test(t2), 'table de répartition affichée');
ok(/Commercial/.test(t2)&&/Logistique/.test(t2), 'les 2 BU dans la répartition');
// pick vehicle + driver
const sels=p.locator('.modal-ov select');
for(let i=0;i<await sels.count();i++){
  const lbl=await sels.nth(i).evaluate(el=>el.closest('.form-g')?.querySelector('label')?.textContent||'');
  if(/véhicule/i.test(lbl)){const o=await sels.nth(i).locator('option:not([disabled])').all();if(o.length>1)await sels.nth(i).selectOption(await o[1].getAttribute('value'));}
}
await p.waitForTimeout(300);
for(let i=0;i<await sels.count();i++){
  const lbl=await sels.nth(i).evaluate(el=>el.closest('.form-g')?.querySelector('label')?.textContent||'');
  if(/chauffeur/i.test(lbl)){const o=await sels.nth(i).locator('option:not([disabled])').all();if(o.length>1)await sels.nth(i).selectOption(await o[1].getAttribute('value'));}
}
await p.waitForTimeout(400);
await p.getByRole('button',{name:/^Enregistrer$/}).click();
await p.waitForTimeout(2000);
ok(!(await p.locator('.modal-ov').isVisible().catch(()=>true)),'mission groupée enregistrée');
// verify backend
const ms=await (await fetch(B+'/api/missions')).json();
const created=(ms.data||ms).find(m=>(m.dpcRefs||[]).includes('UIG-1')&&(m.dpcRefs||[]).includes('UIG-2'));
ok(!!created,'mission avec dpcRefs [UIG-1,UIG-2] en base');
ok(created?.costSplit?.length===2,'costSplit à 2 entrées');
ok(created?.waypoints?.includes('Sétif'),'waypoints inclut Sétif');
// facturation BU shows the split
await p.goto(B+'/facturation-bu',{waitUntil:'networkidle'});
await p.waitForTimeout(1500);
const fbTxt=(await p.locator('body').innerText()).replace(/\s+/g,' ');
ok(/demandes/i.test(fbTxt)&&(fbTxt.includes(created?.num||'@@')),'Facturation BU : mission groupée présente');

// cleanup
if(created)await fetch(B+'/api/missions/'+created.num,{method:'DELETE'});
await fetch(B+'/api/dpc-requests/UIG-1',{method:'DELETE'}); await fetch(B+'/api/dpc-requests/UIG-2',{method:'DELETE'});
console.log(`\n${pass} OK · ${fail} ÉCHEC`); F.forEach(x=>console.log('  ✗ '+x));
console.log('errs:',errs.filter(e=>!/favicon|ResizeObserver/.test(e)).join('\n')||'aucune');
await b.close();
