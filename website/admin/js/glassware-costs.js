// Посуда cost of goods: for every held event, pieces of glassware booked
// (enquiry addons with category 'glassware') × the private purchase cost per
// piece (addon_purchase_prices, finance-only). Counted once in the event P&L,
// month expense/profit and the "Посуда" expense category - like the automatic
// bottle cost in drink-costs.js. Uses the CURRENT purchase price (there is no
// per-event snapshot). Manual events have no glassware lines.
let addonPurchasePrices = new Map(), addonPurchaseError = false;
async function loadAddonPurchasePrices() {
  const {data,error}=await db.from('addon_purchase_prices').select('*');
  addonPurchaseError=!!error;
  addonPurchasePrices=new Map((data||[]).map(r=>[r.addon_id,Number(r.cost_eur)]));
}
// Stored add-ons carry category 'glassware' (stamped by the server since the
// Посуда release); the live catalog and the cost table cover older rows.
function isGlasswareLine(a){
  if(!a||!a.id)return false;
  if(a.category==='glassware')return true;
  const cat=(window.addonServices||[]).find(s=>s.id===a.id);
  return cat?cat.category==='glassware':addonPurchasePrices.has(a.id);
}
function eventGlasswareCost(fe){
  const out={auto:0,missing:0,pieces:0,lines:[]};
  if(!fe||!fe.enquiry_id)return out;
  const enquiry=allEnquiries.find(e=>e.id===fe.enquiry_id);
  (Array.isArray(enquiry?.addons)?enquiry.addons:[]).filter(isGlasswareLine).forEach(a=>{
    const qty=Number(a.qty)||0;if(!qty)return;
    const unit=addonPurchasePrices.get(a.id);
    const known=!addonPurchaseError&&unit!=null&&Number.isFinite(unit);
    if(!known)out.missing++;else out.auto+=qty*unit;
    out.pieces+=qty;
    out.lines.push({id:a.id,name:itemNameBg(a),qty,unit:known?unit:null});
  });
  out.auto=Math.round(out.auto*100)/100;
  return out;
}
function glasswareGapText(fe){
  const n=eventGlasswareCost(fe).missing;
  if(addonPurchaseError)return 'покупните цени на посудата не се заредиха';
  return `липсва покупна цена за ${n} ${n===1?'вид посуда':'вида посуда'} (Каталог → Посуда)`;
}
function glasswareDrillRow(fe){
  const cost=eventGlasswareCost(fe);if(!cost.auto)return '';
  return `<button type="button" class="drill-row" data-glassware-event="${esc(fe.id)}">${esc(fmtDateBg(fe.event_date))} · ${esc(fe.customer_name||allEnquiries.find(e=>e.id===fe.enquiry_id)?.full_name||'Събитие')} · Посуда ${cost.pieces} бр. <strong>${fmtEur(cost.auto)}</strong></button>`;
}
function renderGlasswareNote(fe){
  const el=document.getElementById('event-glassware-expense');if(!el)return;
  const cost=eventGlasswareCost(fe);
  if(!cost.lines.length){el.hidden=true;el.textContent='';return;}
  el.hidden=false;
  const detail=cost.lines.map(l=>`${l.name} × ${l.qty}${l.unit!=null?` · ${fmtEur(l.unit)}/бр.`:' · няма покупна цена'}`).join('; ');
  el.textContent=`Себестойност на посудата: ${fmtEur(cost.auto)} — включена в разходите (${detail}).`+(cost.missing?` Липсва покупна цена: ${glasswareGapText(fe)}.`:'');
}
document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-glassware-event]');if(!button)return;
  const fe=financialEventsById.get(button.dataset.glasswareEvent);if(!fe)return;
  if(fe.enquiry_id)await openPnlFromOffer(fe.enquiry_id);else await openManualPnlFromDrill(fe.id);
  if(currentSelection()?.fe?.id!==fe.id)return;
  const el=document.getElementById('event-glassware-expense');if(el){el.classList.add('finance-focus');el.scrollIntoView({behavior:'smooth',block:'center'});}
});
