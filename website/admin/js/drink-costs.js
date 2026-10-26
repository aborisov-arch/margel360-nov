// Private purchase prices per bottle (drink_purchase_prices, finance-only).
// A P&L line without a cost entered for the event follows the CURRENT catalog
// price by drink id - like glassware-costs.js, no per-event snapshot - so a
// price the manager enters in Каталог → Напитки reaches every event at once.
// A cost typed on the line (per-event unit_cost_eur) overrides it.
let drinkPurchasePrices = new Map(), drinkPurchaseError = false;
async function loadDrinkPurchasePrices() {
  const {data,error}=await db.from('drink_purchase_prices').select('*');
  drinkPurchaseError=!!error;
  drinkPurchasePrices=new Map((data||[]).map(r=>[r.drink_id,Number(r.cost_eur)]));
}
// Current catalog purchase price for a line's drink, or null (manual line,
// drink without a price, or the price table failed to load).
function drinkCatalogCost(line){
  if(!line||!line.id||drinkPurchaseError||!drinkPurchasePrices.has(line.id))return null;
  return drinkPurchasePrices.get(line.id);
}
// Purchase cost per bottle used for a line: the cost entered for this event
// wins; otherwise the catalog price. null = unknown (counts as missing).
// Mirror of lineCost() in supabase/functions/_shared/finance-gaps.ts.
function drinkUnitCost(line){
  const unit=line?.unit_cost_eur;
  if(unit!=null && unit!=='' && Number.isFinite(Number(unit)) && Number(unit)>=0)return Number(unit);
  return drinkCatalogCost(line);
}
function bottleCostOf(lines) {
  let cost=0,missing=0;
  (Array.isArray(lines)?lines:[]).forEach(l=>{const qty=Number(l.qty)||0;if(!qty)return;const unit=drinkUnitCost(l);
    if(unit==null){missing++;return;}
    cost+=qty*unit;
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
// What is missing for an event's bottle cost, in words (finance gaps list,
// event note and the month-end reminder email use the same three cases).
function bottleGapText(fe,live=false){
  const manual=live?('drinks_cost_in_expenses' in dirtyFe?dirtyFe.drinks_cost_in_expenses:fe.drinks_cost_in_expenses):fe.drinks_cost_in_expenses;
  if(manual)return 'няма въведен разход „Напитки / алкохол“';
  const enquiry=fe.enquiry_id?allEnquiries.find(e=>e.id===fe.enquiry_id):null;
  const lines=live?getWorkingDrinks():(fe.pnl_drinks??seedDrinksFromOrder(enquiry));
  const n=eventBottleCost(fe,live).missing;
  if(!lines.length)return 'липсва разбивка на продадените напитки';
  if(drinkPurchaseError)return 'покупните цени на бутилките не се заредиха (презаредете страницата)';
  return `липсва покупна цена за ${n} ${n===1?'напитка':'напитки'}`;
}
function incompleteBottleCostsInMonth(){return Array.from(financialEventsById.values()).some(fe=>(!monthFilter||fe.month===monthFilter)&&eventHasHappened(fe)&&eventBottleCost(fe).missing);}
function bottleCostDrillRow(fe){const cost=eventBottleCost(fe);return cost.auto?`<button type="button" class="drill-row" data-bottle-event="${esc(fe.id)}">${esc(fmtDateBg(fe.event_date))} · ${esc(fe.customer_name||allEnquiries.find(e=>e.id===fe.enquiry_id)?.full_name||'Събитие')} · Себестойност на бутилките <strong>${fmtEur(cost.auto)}</strong></button>`:'';}
function renderBottleCostSummary(fe) {
  const host=document.getElementById('bottle-cost-summary');if(!host||!fe)return;
  const result=eventBottleCost(fe,true),revenue=revenueForDisplay(drinksTotalOf(getWorkingDrinks()));   // follows the VAT toggle
  const manual='drinks_cost_in_expenses' in dirtyFe?dirtyFe.drinks_cost_in_expenses:fe.drinks_cost_in_expenses;
  const expenseNote=document.getElementById('event-bottle-expense');if(expenseNote)expenseNote.textContent=result.missing?`Себестойност на бутилките: ${fmtEur(result.cost)} от наличните цени — ${bottleGapText(fe,true)}.${drinkPurchaseError?'':' Попълнете липсващите цени по-долу или в каталога.'}`:manual?'Себестойността на бутилките е включена в ръчните разходи „Напитки / алкохол“.':`Автоматична себестойност на бутилките: ${fmtEur(result.auto)} — включена в общите разходи. Не я добавяйте повторно.`;
  host.innerHTML=`<div class="pay-kpis"><span>Приход от бутилки<strong>${fmtEur(revenue)}</strong></span><span>Себестойност<strong>${fmtEur(result.cost)}</strong>${result.missing?'<small>без липсващите цени</small>':''}</span><span>Печалба от бутилки<strong>${fmtEur(revenue-result.cost)}</strong>${result.missing?'<small>без липсващите цени</small>':''}</span></div><p class="pay-note">Въведете реално продадените бутилки. Бутилки без въведена покупна цена ползват текущата цена от <a href="catalog.html">Каталог → Напитки</a>; въведете цена на реда само ако за това събитие е платена друга. Количествата и въведените цени се запазват с „Запази промените“. ${result.missing?'Липсва покупна цена (в каталога или на реда) или разбивка на бутилките.':''}</p><label class="pay-note" style="display:block;margin-top:12px"><input type="checkbox" id="bottle-cost-manual" ${manual?'checked':''}> Себестойността вече е въведена ръчно в разходи „Напитки / алкохол“ — не я начислявай повторно.</label>${!manual&&(expensesByEvent.get(fe.id)||[]).some(r=>expFieldValue(r,'category')==='drinks')?'<p class="pay-error">Има и ръчен разход за напитки. Проверете дали е същата покупка и при нужда включете отметката, за да няма двойно броене.</p>':''}`;
}
document.addEventListener('input',event=>{
  const input=event.target.closest('[data-bottle-cost]');if(!input)return;
  const lines=ensureDrinksDraft(),index=Number(input.dataset.bottleCost);if(!lines[index])return;
  lines[index].unit_cost_eur=input.value===''?null:Number(input.value);stageDrinks(lines);updateDetailTotals();
});
document.addEventListener('change',event=>{if(event.target.id==='bottle-cost-manual'){dirtyFe.drinks_cost_in_expenses=event.target.checked;updateDetailTotals();}});
document.addEventListener('click',async event=>{
  const staffButton=event.target.closest('[data-staff-quick]');if(staffButton){staffButton.disabled=true;try{await addEventExpense(staffButton.dataset.staffQuick);}finally{staffButton.disabled=false;}return;}
  const button=event.target.closest('[data-bottle-event]');if(!button)return;
  const fe=financialEventsById.get(button.dataset.bottleEvent);if(!fe)return;
  if(fe.enquiry_id)await openPnlFromOffer(fe.enquiry_id);else await openManualPnlFromDrill(fe.id);
  if(currentSelection()?.fe?.id!==fe.id)return;const el=document.getElementById('pnl-drinks-lines');el.classList.add('finance-focus');el.scrollIntoView({behavior:'smooth',block:'center'});
});
