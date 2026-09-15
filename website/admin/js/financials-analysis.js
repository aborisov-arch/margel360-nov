// Finance analysis uses saved event values. Payroll is separate from venue
// overtime revenue: a client's charged hours are not the manager's wage.
let managerPayRows = [], managerOvertimeRows = [], managerPayError = '';
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
  let host=document.getElementById('event-manager-overtime');
  if(!host){host=document.createElement('section');host.id='event-manager-overtime';host.className='event-overtime';document.getElementById('pnl-body').append(host);}
  if(!fe){host.innerHTML='';return;}
  const r={...(managerOvertimeRows.find(r=>r.event_id===fe.id && r.manager_email===userEmail?.toLowerCase())||{}),...(payrollDrafts.get('event:'+fe.id)||{})};
  host.innerHTML=`<h3>Извънреден труд на управителя · ${esc(fmtDateBg(fe.event_date))}</h3><p class="pay-note">Въведете реално отработените часове и часовете от касовия апарат. Линкът към камерите е по желание. Записва се отделно от офертата към клиента.</p>${managerPayError?`<p class="pay-error">${esc(managerPayError)}</p>`:`<form id="event-overtime-form" data-event="${esc(fe.id)}" class="pay-form">${payInput('hours','Мои извънредни часове',r.hours||0)}${payInput('rate_eur','Моята ставка · €/час',r.rate_eur||0)}${payInput('register_hours','Часове по касов апарат',r.register_hours)}${payInput('register_reference','Номер / час на касов бон',r.register_reference,'text')}${payInput('camera_url','Линк към камерите (https)',r.camera_url,'url')}${payInput('notes','Бележка / час за проверка',r.notes,'text')}<button class="btn btn-primary" type="submit">Запази часовете</button></form>`}${overtimeTable(managerOvertimeRows.filter(r=>r.event_id===fe.id))}`;
}
function renderFinanceCharts(income, expense) {
  let host=document.getElementById('finance-charts');
  if(!host){host=document.createElement('div');host.id='finance-charts';host.className='finance-charts';document.querySelector('#month-summary .kpi-grid').after(host);}
  const colors=['#aa7d3b','#315c61','#748668','#c27c60','#655b7b','#b1a284','#5d7792','#925d56'];
  host.innerHTML=[['Приходи',income,INCOME_LABELS],['Разходи',expense,EXPENSE_CATS]].map(([title,values,labels])=>{
    const rows=Object.entries(values).filter(([,v])=>v>0),total=rows.reduce((s,[,v])=>s+v,0);let offset=0;
    const stops=rows.map(([,v],i)=>{const start=offset;offset+=v/total*100;return `${colors[i%colors.length]} ${start}% ${offset}%`;});
    return `<div class="finance-chart"><div class="finance-pie" role="img" aria-label="${title} по категории: ${fmtEur(total)}" style="background:${total?'conic-gradient('+stops.join(',')+')':'#eee9e0'}"></div><div><h3>${title} по категории</h3><ul>${rows.map(([id,v],i)=>`<li><span style="color:${colors[i%colors.length]}">●</span> ${esc(labels.find(c=>c.id===id)?.label||id)} · ${Math.round(v/total*100)}%</li>`).join('')||'<li>Няма данни за периода.</li>'}</ul></div></div>`;
  }).join('');
}
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
document.addEventListener('click',async event=>{const button=event.target.closest('[data-pay-event]');if(!button)return;await openManualPnlFromDrill(button.dataset.payEvent);if(currentSelection()?.fe?.id!==button.dataset.payEvent)return;const host=document.getElementById('event-manager-overtime');if(host){host.classList.add('finance-focus');host.scrollIntoView({behavior:'smooth',block:'center'});}});
