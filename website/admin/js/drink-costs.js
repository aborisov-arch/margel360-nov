// Private purchase-price defaults; per-event unit_cost_eur lives only in finance P&L.
let drinkPurchasePrices = new Map(), drinkPurchaseError = false;
async function loadDrinkPurchasePrices() {
  const {data,error}=await db.from('drink_purchase_prices').select('*');
  drinkPurchaseError=!!error;
  drinkPurchasePrices=new Map((data||[]).map(r=>[r.drink_id,Number(r.cost_eur)]));
  renderDrinkPurchasePrices();
}
function renderDrinkPurchasePrices() {
  const host=document.getElementById('drink-purchase-body');if(!host)return;
  const catalog=Array.from(drinkCatalogById.values());
  host.innerHTML=drinkPurchaseError?'<p class="pay-error">Покупните цени не могат да се заредят. Презаредете страницата.</p>':`<p class="pay-note">Цени за една бутилка. Само за финансовия екип; клиентът вижда единствено продажната цена. Новите покупки не променят цените, запазени по минали събития.</p><form id="drink-purchase-form" class="pay-form"><label>Напитка<select name="drink_id" required><option value="">Изберете бутилка</option>${catalog.map(d=>`<option value="${esc(d.id)}">${esc(d.name_bg)}</option>`).join('')}</select></label><label>Покупна цена · €/бутилка<input name="cost_eur" type="number" min="0" max="999999.99" step="0.01" required></label><button type="submit" class="btn btn-primary">Запази покупната цена</button></form><div class="pay-scroll"><table class="pay-table"><thead><tr><th>Бутилка</th><th>Продажна цена</th><th>Покупна цена</th><th>Разлика / бутилка</th></tr></thead><tbody>${catalog.map(d=>{const cost=drinkPurchasePrices.get(d.id);return `<tr><td>${esc(d.name_bg)}</td><td>${fmtEur(d.price_eur)}</td><td>${cost==null?'Не е зададена':fmtEur(cost)}</td><td>${cost==null?'—':fmtEur(Number(d.price_eur)-cost)}</td></tr>`;}).join('')}</tbody></table></div>`;
}
document.addEventListener('change',event=>{if(event.target.matches('#drink-purchase-form select')){document.querySelector('#drink-purchase-form [name="cost_eur"]').value=drinkPurchasePrices.get(event.target.value)??'';}});
document.addEventListener('submit',async event=>{
  const form=event.target;if(form.id!=='drink-purchase-form')return;event.preventDefault();
  const button=form.querySelector('button');button.disabled=true;const values=Object.fromEntries(new FormData(form));
  try{const {error}=await db.from('drink_purchase_prices').upsert({drink_id:values.drink_id,cost_eur:Number(values.cost_eur)},{onConflict:'drink_id'});if(error)throw error;await loadDrinkPurchasePrices();showToast('Покупната цена е запазена. Старите събития не са променени.');}catch(e){button.disabled=false;showToast('Цената не беше запазена.','error');}
});
function bottleCostOf(lines) {
  let cost=0,missing=0;
  (Array.isArray(lines)?lines:[]).forEach(l=>{const qty=Number(l.qty)||0;if(!qty)return;const unit=l.unit_cost_eur;
    if(unit==null || unit==='' || !Number.isFinite(Number(unit)) || Number(unit)<0){missing++;return;}
    cost+=qty*Number(unit);
  });
  return {cost:Math.round(cost*100)/100,missing};
}
function eventBottleCost(fe,live=false) {
  if(!fe)return {cost:0,auto:0,missing:0};
  const manual=live?('drinks_cost_in_expenses' in dirtyFe?dirtyFe.drinks_cost_in_expenses:fe.drinks_cost_in_expenses):fe.drinks_cost_in_expenses;
  if(manual){const rows=(expensesByEvent.get(fe.id)||[]).filter(r=>(live?expFieldValue(r,'category'):r.category)==='drinks');const cost=rows.reduce((s,r)=>s+Number((live?expFieldValue(r,'amount_eur'):r.amount_eur)||0),0);return {cost,auto:0,missing:rows.length?0:1};}
  const enquiry=fe.enquiry_id?allEnquiries.find(e=>e.id===fe.enquiry_id):null;
  const lines=live?getWorkingDrinks():(fe.pnl_drinks??seedDrinksFromOrder(enquiry));
  const result=bottleCostOf(lines);
  if(!lines.length && Number(fe.income_drinks_eur||0)!==0)result.missing++;
  return {...result,auto:result.cost};
}
function incompleteBottleCostsInMonth(){return Array.from(financialEventsById.values()).some(fe=>(!monthFilter||fe.month===monthFilter)&&eventHasHappened(fe)&&eventBottleCost(fe).missing);}
function bottleCostDrillRow(fe){const cost=eventBottleCost(fe);return cost.auto?`<button type="button" class="drill-row" data-bottle-event="${esc(fe.id)}">${esc(fmtDateBg(fe.event_date))} · ${esc(fe.customer_name||allEnquiries.find(e=>e.id===fe.enquiry_id)?.full_name||'Събитие')} · Себестойност на бутилките <strong>${fmtEur(cost.auto)}</strong></button>`:'';}
function renderBottleCostSummary(fe) {
  const host=document.getElementById('bottle-cost-summary');if(!host||!fe)return;
  const result=eventBottleCost(fe,true),revenue=drinksTotalOf(getWorkingDrinks());
  const manual='drinks_cost_in_expenses' in dirtyFe?dirtyFe.drinks_cost_in_expenses:fe.drinks_cost_in_expenses;
  const expenseNote=document.getElementById('event-bottle-expense');if(expenseNote)expenseNote.textContent=result.missing?'Себестойност на бутилките: непълни данни.':manual?'Себестойността на бутилките е включена в ръчните разходи „Напитки / алкохол“.':`Автоматична себестойност на бутилките: ${fmtEur(result.auto)} — включена в общите разходи. Не я добавяйте повторно.`;
  host.innerHTML=`<div class="pay-kpis"><span>Приход от бутилки<strong>${fmtEur(revenue)}</strong></span><span>Себестойност<strong>${result.missing?'Непълни данни':fmtEur(result.cost)}</strong></span><span>Печалба от бутилки<strong>${result.missing?'Непълни данни':fmtEur(revenue-result.cost)}</strong></span></div><p class="pay-note">Въведете реално продадените бутилки. Покупните цени и количествата се запазват с „Запази промените“. ${result.missing?'Липсва покупна цена или разбивка на бутилките.':''}</p><button type="button" id="apply-bottle-costs" class="btn btn-outline btn-sm">Попълни липсващите покупни цени от каталога</button><label class="pay-note" style="display:block;margin-top:12px"><input type="checkbox" id="bottle-cost-manual" ${manual?'checked':''}> Себестойността вече е въведена ръчно в разходи „Напитки / алкохол“ — не я начислявай повторно.</label>${!manual&&(expensesByEvent.get(fe.id)||[]).some(r=>expFieldValue(r,'category')==='drinks')?'<p class="pay-error">Има и ръчен разход за напитки. Проверете дали е същата покупка и при нужда включете отметката, за да няма двойно броене.</p>':''}`;
}
document.addEventListener('input',event=>{
  const input=event.target.closest('[data-bottle-cost]');if(!input)return;
  const lines=ensureDrinksDraft(),index=Number(input.dataset.bottleCost);if(!lines[index])return;
  lines[index].unit_cost_eur=input.value===''?null:Number(input.value);stageDrinks(lines);updateDetailTotals();
});
document.addEventListener('change',event=>{if(event.target.id==='bottle-cost-manual'){dirtyFe.drinks_cost_in_expenses=event.target.checked;updateDetailTotals();}});
document.addEventListener('click',async event=>{
  const staffButton=event.target.closest('[data-staff-quick]');if(staffButton){staffButton.disabled=true;try{await addEventExpense(staffButton.dataset.staffQuick);}finally{staffButton.disabled=false;}return;}
  if(event.target.closest('#apply-bottle-costs')){const lines=ensureDrinksDraft();lines.forEach(l=>{if(l.unit_cost_eur==null&&drinkPurchasePrices.has(l.id))l.unit_cost_eur=drinkPurchasePrices.get(l.id);});stageDrinks(lines);renderDrinks();updateDetailTotals();}
  const button=event.target.closest('[data-bottle-event]');if(!button)return;
  const fe=financialEventsById.get(button.dataset.bottleEvent);if(!fe)return;
  if(fe.enquiry_id)await openPnlFromOffer(fe.enquiry_id);else await openManualPnlFromDrill(fe.id);
  if(currentSelection()?.fe?.id!==fe.id)return;const el=document.getElementById('pnl-drinks-lines');el.classList.add('finance-focus');el.scrollIntoView({behavior:'smooth',block:'center'});
});
