// Private finance-only purchase prices. Never stored in the public drinks /
// addon_services rows. Drinks: drink_purchase_prices (per bottle, used for
// event bottle costs). Посуда: addon_purchase_prices (per piece).
const COST_TABLES={
  drinks:{table:'drink_purchase_prices',key:'drink_id',unit:'бутилка',unitShort:'€/бутилка'},
  glassware:{table:'addon_purchase_prices',key:'addon_id',unit:'брой',unitShort:'€/брой'},
};
const catalogCosts={allowed:false,error:false,prices:{drinks:new Map(),glassware:new Map()},drafts:new Map(),saving:new Set()};
function costTab(){return COST_TABLES[activeTab]?activeTab:null;}
async function loadCatalogCosts(){
  try{
  const role=await db.rpc('is_finance_admin');
  catalogCosts.allowed=!role.error&&role.data===true;
  if(!catalogCosts.allowed)return;
  const results=await Promise.all(Object.entries(COST_TABLES).map(async([tab,c])=>[tab,c,await db.from(c.table).select('*')]));
  results.forEach(([tab,c,{data,error}])=>{
    if(error)catalogCosts.error=true;
    catalogCosts.prices[tab]=new Map((data||[]).map(r=>[r[c.key],Number(r.cost_eur)]));
  });
  }catch(error){catalogCosts.error=true;}
}
function catalogMargin(sale,cost){
  if(cost==null||cost===''||!Number.isFinite(Number(cost))||Number(cost)<0||!Number.isFinite(Number(sale)))return {profit:'—',margin:'—'};
  const profit=Number(sale)-Number(cost);
  return {profit:'€'+profit.toFixed(2),margin:Number(sale)>0?(profit/Number(sale)*100).toFixed(1)+'%':'—'};
}
function catalogPurchaseCells(row){
  const tab=costTab();
  if(!catalogCosts.allowed||!tab)return '';
  if(catalogCosts.error)return '<td colspan="3">Покупните цени не се заредиха. Презаредете страницата.</td>';
  const draftKey=tab+':'+row.id;
  const cost=catalogCosts.drafts.has(draftKey)?catalogCosts.drafts.get(draftKey):catalogCosts.prices[tab].get(row.id);
  const result=catalogMargin(row.price_eur,cost);
  const busy=catalogCosts.saving.has(draftKey)?'disabled':'';
  return `<td><div class="catalog-cost-entry"><input type="number" min="0" max="999999.99" step="0.01" data-purchase-input="${esc(row.id)}" value="${esc(cost??'')}" placeholder="Не е зададена" aria-label="Покупна цена за ${esc(row.name_bg)}" ${busy}><button type="button" class="btn btn-outline btn-sm" data-purchase-save="${esc(row.id)}" ${busy}>Запази</button></div><small data-purchase-status="${esc(row.id)}">${catalogCosts.drafts.has(draftKey)?'Незаписана промяна':COST_TABLES[tab].unitShort+' · само за екипа'}</small></td><td data-purchase-profit="${esc(row.id)}">${result.profit}</td><td data-purchase-margin="${esc(row.id)}">${result.margin}</td>`;
}
function syncCatalogCostHeaders(){
  const tab=costTab(),visible=catalogCosts.allowed&&!!tab;
  document.querySelectorAll('[data-purchase-header]').forEach(el=>{
    el.hidden=!visible;
    if(visible&&el.dataset.purchaseHeader)el.textContent=el.dataset.purchaseHeader.replace('{unit}',COST_TABLES[tab].unit);
  });
  document.getElementById('catalog-cost-note').hidden=!visible;
}
document.addEventListener('input',event=>{
  const input=event.target.closest('[data-purchase-input]');if(!input)return;
  const tab=costTab();if(!tab)return;
  const id=input.dataset.purchaseInput,row=rows[tab].find(r=>r.id===id);if(!row)return;
  catalogCosts.drafts.set(tab+':'+id,input.value);const result=catalogMargin(row.price_eur,input.value);
  const tr=input.closest('tr');tr.querySelector('[data-purchase-profit]').textContent=result.profit;tr.querySelector('[data-purchase-margin]').textContent=result.margin;tr.querySelector('[data-purchase-status]').textContent='Незаписана промяна';
});
document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-purchase-save]');if(!button)return;
  const tab=costTab();if(!tab)return;
  const c=COST_TABLES[tab],id=button.dataset.purchaseSave,draftKey=tab+':'+id;if(catalogCosts.saving.has(draftKey))return;
  const tr=button.closest('tr'),input=tr.querySelector('[data-purchase-input]'),raw=input.value,cost=Number(raw);
  if(raw===''||!Number.isFinite(cost)||cost<0||cost>=1000000||!input.checkValidity()){showToast(`Въведете валидна покупна цена за ${c.unit}.`,'error');return;}
  catalogCosts.saving.add(draftKey);button.disabled=true;input.disabled=true;
  try{
    const {error}=await db.from(c.table).upsert({[c.key]:id,cost_eur:cost},{onConflict:c.key});if(error)throw error;
    catalogCosts.prices[tab].set(id,cost);if(catalogCosts.drafts.get(draftKey)===raw)catalogCosts.drafts.delete(draftKey);
    showToast('Покупната цена е запазена. Цената за клиента и старите събития не са променени.');
  }catch(error){showToast('Покупната цена не беше запазена. Опитайте отново.','error');}
  finally{catalogCosts.saving.delete(draftKey);renderTable();}
});
window.addEventListener('beforeunload',event=>{if(catalogCosts.drafts.size||catalogCosts.saving.size){event.preventDefault();event.returnValue='';}});
