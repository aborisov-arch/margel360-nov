// Private finance-only purchase prices. Never stored in the public drinks row.
const catalogCosts={allowed:false,error:false,prices:new Map(),drafts:new Map(),saving:new Set()};
async function loadCatalogCosts(){
  try{
  const role=await db.rpc('is_finance_admin');
  catalogCosts.allowed=!role.error&&role.data===true;
  if(!catalogCosts.allowed)return;
  const {data,error}=await db.from('drink_purchase_prices').select('*');
  catalogCosts.error=!!error;
  catalogCosts.prices=new Map((data||[]).map(r=>[r.drink_id,Number(r.cost_eur)]));
  }catch(error){catalogCosts.error=true;}
}
function catalogMargin(sale,cost){
  if(cost==null||cost===''||!Number.isFinite(Number(cost))||Number(cost)<0||!Number.isFinite(Number(sale)))return {profit:'—',margin:'—'};
  const profit=Number(sale)-Number(cost);
  return {profit:'€'+profit.toFixed(2),margin:Number(sale)>0?(profit/Number(sale)*100).toFixed(1)+'%':'—'};
}
function catalogPurchaseCells(row){
  if(!catalogCosts.allowed||activeTab!=='drinks')return '';
  if(catalogCosts.error)return '<td colspan="3">Покупните цени не се заредиха. Презаредете страницата.</td>';
  const cost=catalogCosts.drafts.has(row.id)?catalogCosts.drafts.get(row.id):catalogCosts.prices.get(row.id);
  const result=catalogMargin(row.price_eur,cost);
  return `<td><div class="catalog-cost-entry"><input type="number" min="0" max="999999.99" step="0.01" data-purchase-input="${esc(row.id)}" value="${esc(cost??'')}" placeholder="Не е зададена" aria-label="Покупна цена за ${esc(row.name_bg)}" ${catalogCosts.saving.has(row.id)?'disabled':''}><button type="button" class="btn btn-outline btn-sm" data-purchase-save="${esc(row.id)}" ${catalogCosts.saving.has(row.id)?'disabled':''}>Запази</button></div><small data-purchase-status="${esc(row.id)}">${catalogCosts.drafts.has(row.id)?'Незаписана промяна':'€/бутилка · само за екипа'}</small></td><td data-purchase-profit="${esc(row.id)}">${result.profit}</td><td data-purchase-margin="${esc(row.id)}">${result.margin}</td>`;
}
function syncCatalogCostHeaders(){
  const visible=catalogCosts.allowed&&activeTab==='drinks';
  document.querySelectorAll('[data-purchase-header]').forEach(el=>el.hidden=!visible);
  document.getElementById('catalog-cost-note').hidden=!visible;
}
document.addEventListener('input',event=>{
  const input=event.target.closest('[data-purchase-input]');if(!input)return;
  const id=input.dataset.purchaseInput,row=rows.drinks.find(r=>r.id===id);if(!row)return;
  catalogCosts.drafts.set(id,input.value);const result=catalogMargin(row.price_eur,input.value);
  const tr=input.closest('tr');tr.querySelector('[data-purchase-profit]').textContent=result.profit;tr.querySelector('[data-purchase-margin]').textContent=result.margin;tr.querySelector('[data-purchase-status]').textContent='Незаписана промяна';
});
document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-purchase-save]');if(!button)return;
  const id=button.dataset.purchaseSave;if(catalogCosts.saving.has(id))return;
  const tr=button.closest('tr'),input=tr.querySelector('[data-purchase-input]'),raw=input.value,cost=Number(raw);
  if(raw===''||!Number.isFinite(cost)||cost<0||cost>=1000000||!input.checkValidity()){showToast('Въведете валидна покупна цена за бутилка.','error');return;}
  catalogCosts.saving.add(id);button.disabled=true;input.disabled=true;
  try{
    const {error}=await db.from('drink_purchase_prices').upsert({drink_id:id,cost_eur:cost},{onConflict:'drink_id'});if(error)throw error;
    catalogCosts.prices.set(id,cost);if(catalogCosts.drafts.get(id)===raw)catalogCosts.drafts.delete(id);
    showToast('Покупната цена е запазена. Цената за клиента и старите събития не са променени.');
  }catch(error){showToast('Покупната цена не беше запазена. Опитайте отново.','error');}
  finally{catalogCosts.saving.delete(id);renderTable();}
});
window.addEventListener('beforeunload',event=>{if(catalogCosts.drafts.size||catalogCosts.saving.size){event.preventDefault();event.returnValue='';}});
