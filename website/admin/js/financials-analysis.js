// Finance analysis uses saved event values. Payroll is separate from venue
// overtime revenue: a client's charged hours are not the manager's wage.
let managerPayRows = [], managerOvertimeRows = [], managerPayError = '';
let electricityRows = [], electricityError = false;
const electricityDrafts = new Map();
function renderStaffAllocations(totals) {
 const host=document.getElementById('staff-allocations-body');if(!host)return;
 const categories=[['ivan_fee','Иван хонорар'],['ivan_salary','Иван твърда'],['ivan_overtime','Иван овъртайм'],['eli_fee','Ели хонорар'],['eli_overtime','Ели овъртайм'],['electricity','Ток']];
 const events=Array.from(financialEventsById.values()).filter(fe=>!monthFilter||fe.month===monthFilter).sort((a,b)=>(b.event_date||'').localeCompare(a.event_date||''));
 host.innerHTML=`<p class="pay-note">Хонорари и овъртайм: по събитие. Ток: по месец. Сумите за събитията влизат в реализираните разходи след провеждането им. Твърдата заплата на Иван още не е зададена и не се начислява.</p><div class="pay-scroll"><table class="pay-table"><thead><tr><th>Разход</th><th>Сума за периода</th><th>Разбивка</th></tr></thead><tbody>${categories.map(([id,label])=>`${['ivan_fee','eli_fee','electricity'].includes(id)?`<tr class="staff-group"><th colspan="3"><h3>${id==='ivan_fee'?'Иван':id==='eli_fee'?'Ели':'Ток'}</h3></th></tr>`:'' }<tr data-staff-category="${id}"><td>${label}</td><td><strong>${id==='ivan_salary'?'Не е зададена':id==='electricity'?(electricityError?'Непълни данни':fmtEur(electricityTotal())):fmtEur(totals[id]||0)}</strong></td><td>${id==='ivan_salary'?'Очаква сума':id==='electricity'?'<button type="button" data-staff-electricity>Месечна сметка</button>':`<button type="button" data-chart-kind="expense" data-chart-cat="${id}">Виж събитията</button>`}</td></tr>`).join('')}</tbody></table></div><h3>Разпределяне на разход по събитие</h3><form id="staff-allocation-form" class="pay-form"><label>Разход<select name="category">${categories.filter(([id])=>!['ivan_salary','electricity'].includes(id)).map(([id,label])=>`<option value="${id}">${label}</option>`).join('')}</select></label><label>Събитие<select name="event" required><option value="">Изберете събитие</option>${events.map(fe=>`<option value="${esc(fe.id)}">${esc(fmtDateBg(fe.event_date))} · ${esc(fe.customer_name||allEnquiries.find(e=>e.id===fe.enquiry_id)?.full_name||'Събитие')}</option>`).join('')}</select></label><button class="btn btn-primary" type="submit" ${events.length?'':'disabled'}>Добави разход към събитието</button></form><p class="pay-note">След добавяне въведете сумата и бележка в маркирания ред и натиснете „Запази промените“. За овъртайм запишете часовете и периода в бележката. Старите общи разходи и записите за възнаграждения не са разпределени автоматично; при прехвърляне променете категорията на съществуващия разход, без да го дублирате.</p>`;
}
document.addEventListener('click',event=>{if(event.target.closest('[data-staff-electricity]'))document.getElementById('monthly-electricity').scrollIntoView({behavior:'smooth',block:'center'});});
document.addEventListener('submit',async event=>{
 const f=event.target;if(f.id!=='staff-allocation-form')return;event.preventDefault();const v=Object.fromEntries(new FormData(f));if(!v.event)return;
 const b=f.querySelector('button');b.disabled=true;
 try{const fe=financialEventsById.get(v.event);if(fe?.enquiry_id)await openPnlFromOffer(fe.enquiry_id);else await openManualPnlFromDrill(v.event);if(currentSelection()?.fe?.id!==v.event)return;await addEventExpense(v.category);const line=document.querySelector('#pnl-expense-lines li:last-child');if(line){line.classList.add('finance-focus');line.scrollIntoView({behavior:'smooth',block:'center'});}}finally{b.disabled=false;}
});
async function loadElectricity() {
  const {data,error}=await db.from('monthly_electricity').select('*');
  electricityRows=data||[];electricityError=!!error;
}
function electricityScope(){return electricityRows.filter(r=>!monthFilter||r.month.slice(0,7)===monthFilter);}
function electricityTotal(){return electricityScope().reduce((s,r)=>s+Number(r.amount_eur),0);}
function electricityDrillRows(sign=1){return electricityScope().filter(r=>Number(r.amount_eur)!==0).map(r=>`<button type="button" class="drill-row" data-electricity-month="${esc(r.month.slice(0,7))}">Електроенергия · ${esc(r.month.slice(0,7))} · ${esc(r.reference)} <strong>${fmtEur(sign*Number(r.amount_eur))}</strong></button>`).join('');}
function renderElectricity(){
 const host=document.getElementById('electricity-body');if(!host)return;
 if(electricityError){host.innerHTML='<p class="pay-error">Сметките за ток не могат да се заредят. Презаредете преди работа с общите разходи.</p>';return;}
 const r={...(electricityRows.find(r=>r.month===monthFilter+'-01')||{}),...(electricityDrafts.get(monthFilter)||{})};
 host.innerHTML=`<p class="pay-note">Месечен разход за залата, включен веднъж в разходите, печалбата и категория „Сметки / комунални“. Не го добавяйте повторно към събитие.</p>${monthFilter?`<form id="electricity-form" data-month="${esc(monthFilter)}" class="pay-form">${payInput('amount_eur','Месечна сметка · €',r.amount_eur??0)}${payInput('reference','Фактура / бележка',r.reference,'text')}<button class="btn btn-primary" type="submit">Запази сметката</button></form>`:'<p>Изберете месец, за да въведете сметка.</p>'}<div class="pay-scroll"><table class="pay-table"><thead><tr><th>Месец</th><th>Фактура / бележка</th><th>Разход</th></tr></thead><tbody>${electricityScope().map(r=>`<tr><td>${esc(r.month.slice(0,7))}</td><td>${esc(r.reference)}</td><td><strong>${fmtEur(r.amount_eur)}</strong></td></tr>`).join('')||'<tr><td colspan="3">Няма въведена сметка.</td></tr>'}</tbody></table></div>`;
}
document.addEventListener('input',event=>{const f=event.target.closest('#electricity-form');if(f)electricityDrafts.set(f.dataset.month,Object.fromEntries(new FormData(f)));});
window.addEventListener('beforeunload',event=>{if(electricityDrafts.size){event.preventDefault();event.returnValue='';}});
document.addEventListener('submit',async event=>{
 const f=event.target;if(f.id!=='electricity-form')return;event.preventDefault();const b=f.querySelector('button');b.disabled=true;
 const v=Object.fromEntries(new FormData(f));
 try{const {error}=await db.from('monthly_electricity').upsert({month:f.dataset.month+'-01',amount_eur:Number(v.amount_eur),reference:v.reference},{onConflict:'month'});if(error)throw error;electricityDrafts.delete(f.dataset.month);await loadElectricity();renderMonthSummary();showToast('Сметката е запазена.');}catch(e){b.disabled=false;showToast('Сметката не беше запазена. Проверете връзката и стойностите.','error');}
});
document.addEventListener('click',event=>{const b=event.target.closest('[data-electricity-month]');if(!b)return;monthFilter=b.dataset.electricityMonth;document.getElementById('fin-month').value=monthFilter;document.getElementById('fin-month').dispatchEvent(new Event('change'));closeDrill();const el=document.getElementById('monthly-electricity');el.classList.add('finance-focus');el.scrollIntoView({behavior:'smooth',block:'center'});});
const payrollDrafts = new Map();
window.addEventListener('beforeunload', event => { if(payrollDrafts.size){event.preventDefault();event.returnValue='';} });
function payrollDraftKey(form) { return form.id==='monthly-pay-form' ? 'month:'+monthFilter : 'event:'+form.dataset.event; }
document.addEventListener('input', event => { const form=event.target.closest('#monthly-pay-form,#event-overtime-form'); if(form) payrollDrafts.set(payrollDraftKey(form),Object.fromEntries(new FormData(form))); });
async function loadManagerPay() {
  const [pay, overtime] = await Promise.all([db.from('manager_monthly_pay').select('*'), db.from('manager_event_overtime').select('*')]);
  managerPayError = pay.error || overtime.error ? 'Възнагражденията не могат да се заредят. Презаредете страницата.' : '';
  managerPayRows = pay.data || []; managerOvertimeRows = overtime.data || [];
}
function payrollScope() {
  return managerOvertimeRows.filter(r => { const fe = financialEventsById.get(r.event_id); return fe && (!monthFilter || fe.month === monthFilter); });
}
function payInput(name, label, value, type='number') {
  return `<label>${esc(label)}<input name="${name}" type="${type}" ${type==='number'?'min="0" step="0.01"':''} value="${esc(value ?? '')}"></label>`;
}
function renderManagerPay() {
  const host = document.getElementById('manager-pay-body'); if (!host) return;
  if (managerPayError) { host.innerHTML = `<p class="pay-error">${esc(managerPayError)}</p>`; return; }
  const own = {...(managerPayRows.find(r => r.month === monthFilter+'-01' && r.manager_email === userEmail?.toLowerCase()) || {}),...(payrollDrafts.get('month:'+monthFilter)||{})};
  const pay = managerPayRows.filter(r => !monthFilter || r.month.slice(0,7)===monthFilter);
  const ot = payrollScope();
  const wage = pay.reduce((s,r)=>s+Number(r.wage_eur),0), commission = pay.reduce((s,r)=>s+Number(r.commission_eur),0);
  const overtime = ot.reduce((s,r)=>s+Number(r.hours)*Number(r.rate_eur),0);
  host.innerHTML = `<p class="pay-note">Месечна заплата и комисион на управителя. Извънредният труд се записва по събитие и се сумира автоматично. Тези суми са отделни от разходите по събития, за да няма двойно осчетоводяване.</p>
    <div class="pay-kpis"><span>Заплати<strong>${fmtEur(wage)}</strong></span><span>Комисиони<strong>${fmtEur(commission)}</strong></span><span>Извънреден труд<strong>${fmtEur(overtime)}</strong></span><span>Общо възнаграждения<strong>${fmtEur(wage+commission+overtime)}</strong></span></div>
    ${monthFilter?`<form id="monthly-pay-form" class="pay-form">${payInput('wage_eur','Моята месечна заплата · €',own.wage_eur||0)}${payInput('commission_eur','Моят месечен комисион · €',own.commission_eur||0)}<button class="btn btn-primary" type="submit">Запази възнаграждение</button></form>`:'<p class="pay-note">Изберете месец, за да въведете възнаграждение.</p>'}
    <div class="pay-scroll"><table class="pay-table"><thead><tr><th>Управител / месец</th><th>Заплата</th><th>Комисион</th></tr></thead><tbody>${pay.map(r=>`<tr><td>${esc(r.manager_email)} · ${esc(r.month.slice(0,7))}</td><td>${fmtEur(r.wage_eur)}</td><td>${fmtEur(r.commission_eur)}</td></tr>`).join('')||'<tr><td colspan="3">Няма записани възнаграждения.</td></tr>'}</tbody></table></div>
    <h3>Проверка на извънредния труд по събития</h3>${overtimeTable(ot)}`;
}
function overtimeTable(rows) {
  return `<div class="pay-scroll"><table class="pay-table"><thead><tr><th>Дата / събитие</th><th>Управител</th><th>Заявени часове</th><th>Часове към клиента</th><th>Касов апарат</th><th>Разлика</th><th>Възнаграждение</th><th>Проверка</th></tr></thead><tbody>${rows.map(r=>{
    const fe=financialEventsById.get(r.event_id); if(!fe)return '';
    const delta=r.register_hours==null?null:Number(r.hours)-Number(r.register_hours);
    const camera=/^https:\/\//i.test(r.camera_url||'')?`<a href="${esc(r.camera_url)}" target="_blank" rel="noopener noreferrer">Камери ↗</a>`:'';
    return `<tr><td><button data-pay-event="${esc(fe.id)}">${esc(fmtDateBg(fe.event_date))} · ${esc(fe.customer_name||allEnquiries.find(e=>e.id===fe.enquiry_id)?.full_name||'Събитие')}</button></td><td>${esc(r.manager_email)}</td><td><strong>${r.hours} ч.</strong></td><td>${Number(fe.income_overtime_hours||0)} ч.</td><td>${r.register_hours==null?'Не е въведено':r.register_hours+' ч.'}<br>${esc(r.register_reference)}</td><td class="${delta===0?'pay-match':'pay-mismatch'}">${delta==null?'Непроверено':delta===0?'Съвпада':delta+' ч.'}</td><td>${fmtEur(Number(r.hours)*Number(r.rate_eur))}</td><td>${camera}<br>${esc(r.notes)}</td></tr>`;
  }).join('')||'<tr><td colspan="8">Няма записан извънреден труд. Отворете събитие, за да добавите часове.</td></tr>'}</tbody></table></div>`;
}
function renderEventOvertime(fe) {
  // The standalone event overtime panel was retired. Preserve historical
  // payroll records and their monthly totals; staff expenses remain editable.
  document.getElementById('event-manager-overtime')?.remove();
}
function renderFinanceCharts(income, expense) {
  let host=document.getElementById('finance-charts');
  if(!host){host=document.createElement('div');host.id='finance-charts';host.className='finance-charts';document.querySelector('#month-summary .kpi-grid').after(host);}
  const colors=['#2e57bc','#4e9e61','#e2b73f','#8b78ba','#8b919a','#ce765b','#3b929b','#a55c80'];
  host.innerHTML=[['Приходи',income,INCOME_LABELS,'income'],['Разходи',expense,EXPENSE_CATS,'expense']].map(([title,values,labels,kind])=>{
    // Stable category colors, even when another category has no values this month.
    const rows=labels.map((c,i)=>({...c,value:Number(values[c.id]||0),color:colors[i%colors.length]})).filter(r=>r.value!==0);
    const total=rows.reduce((s,r)=>s+r.value,0),positiveTotal=rows.reduce((s,r)=>s+Math.max(0,r.value),0);
    let offset=0;
    const arcs=rows.filter(r=>r.value>0).map(r=>{
      const share=r.value/positiveTotal*100,start=offset;offset+=share;
      return `<circle cx="120" cy="120" r="98" pathLength="100" fill="none" stroke="${r.color}" stroke-width="25" stroke-dasharray="${share} ${100-share}" stroke-dashoffset="${-start}" transform="rotate(-90 120 120)"><title>${esc(r.label)}: ${fmtEur(r.value)}</title></circle>`;
    }).join('');
    return `<section class="finance-chart" aria-labelledby="chart-${kind}-title"><header><h3 id="chart-${kind}-title">${title} по категории</h3><p>Реализирани · ${esc(monthFilter||'всички месеци')}</p></header>
      <div class="finance-pie"><svg viewBox="0 0 240 240" role="img" aria-label="${title}: ${fmtEur(total)}. Разбивка в списъка отдолу."><circle cx="120" cy="120" r="98" fill="none" stroke="#eceef2" stroke-width="25"/>${arcs}</svg><div class="finance-donut-total"><span>Общо ${title.toLowerCase()}</span><strong data-chart-total="${kind}">${fmtEur(total)}</strong></div></div>
      <ul class="finance-chart-legend">${rows.map(r=>`<li><button type="button" data-chart-kind="${kind}" data-chart-cat="${esc(r.id)}"><span class="finance-chart-dot" style="background:${r.color}"></span><span class="finance-chart-label">${esc(r.label)}</span><strong>${fmtEur(r.value)}</strong><small>${r.value>0?new Intl.NumberFormat('bg-BG',{maximumFractionDigits:1}).format(r.value/positiveTotal*100)+'%':'корекция'}</small></button></li>`).join('')||'<li class="finance-chart-empty">Няма данни за периода.</li>'}</ul>
      <p class="finance-chart-foot">${rows.some(r=>r.value<0)?'Сумата включва корекциите. Пръстенът показва само положителните стойности.':'Изберете категория, за да видите събитията.'}</p></section>`;
  }).join('');
}
document.addEventListener('click',event=>{const button=event.target.closest('[data-chart-cat]');if(button)openCategoryBreakdown(button.dataset.chartKind,button.dataset.chartCat);});
async function openCategoryEvent(enquiryId,feId,expenseId) {
  const context={...lastDrill};
  if(enquiryId)await openPnlFromOffer(enquiryId);else await openManualPnlFromDrill(feId);
  const selected=currentSelection();if(!selected || (enquiryId?selected.fe?.enquiry_id!==enquiryId:selected.fe?.id!==feId))return;
  document.querySelectorAll('.finance-focus').forEach(el=>el.classList.remove('finance-focus'));
  const fields={rent:'income_rent_eur',overtime:'income_overtime_hours',dj:'income_dj_eur',employees:'income_employees_eur'};
  let el=context.catKind==='expense'?document.querySelector(`#pnl-expense-lines [data-id="${CSS.escape(expenseId||'')}"]`):context.catId==='drinks'?document.getElementById('pnl-drinks-lines'):context.catId==='addons'?document.getElementById('pnl-income-lines-services'):document.querySelector(`[data-fe-field="${fields[context.catId]}"]`)?.closest('li');
  if(el){el.classList.add('finance-focus');el.scrollIntoView({behavior:'smooth',block:'center'});}
}
document.addEventListener('submit',async event=>{
  const form=event.target;if(!['monthly-pay-form','event-overtime-form'].includes(form.id))return;
  event.preventDefault();const button=form.querySelector('button');button.disabled=true;
  const values=Object.fromEntries(new FormData(form));let table,payload;
  if(form.id==='monthly-pay-form'){table='manager_monthly_pay';payload={month:monthFilter+'-01',manager_email:userEmail.toLowerCase(),wage_eur:Number(values.wage_eur),commission_eur:Number(values.commission_eur)};}
  else {table='manager_event_overtime';payload={...values,event_id:form.dataset.event,manager_email:userEmail.toLowerCase(),hours:Number(values.hours),rate_eur:Number(values.rate_eur),register_hours:values.register_hours===''?null:Number(values.register_hours)};}
  const savedKey=payrollDraftKey(form);
  try{const {error}=await db.from(table).upsert(payload,{onConflict:table==='manager_monthly_pay'?'month,manager_email':'event_id,manager_email'});if(error)throw error;payrollDrafts.delete(savedKey);await loadManagerPay();renderManagerPay();renderEventOvertime(currentSelection()?.fe);showToast('Запазено.');}catch(error){showToast('Записът не успя. Проверете стойностите и връзката.','error');button.disabled=false;}
});
document.addEventListener('click',async event=>{const button=event.target.closest('[data-pay-event]');if(!button)return;const fe=financialEventsById.get(button.dataset.payEvent);if(fe?.enquiry_id)await openPnlFromOffer(fe.enquiry_id);else await openManualPnlFromDrill(button.dataset.payEvent);if(currentSelection()?.fe?.id!==button.dataset.payEvent)return;const host=document.getElementById('event-manager-overtime');if(host){host.classList.add('finance-focus');host.scrollIntoView({behavior:'smooth',block:'center'});}});
