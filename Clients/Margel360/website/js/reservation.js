const form = document.getElementById('reservation-form');
const successMsg = document.getElementById('form-success');

function setError(groupId, show) {
  const group = document.getElementById(groupId);
  if (group) group.classList.toggle('has-error', show);
}

function validatePhone(val) {
  return /^[\d\s+\-()\u00B7]{7,}$/.test(val.trim());
}

if (form) {
  form.addEventListener('submit', e => {
    e.preventDefault();

    const name = document.getElementById('res-name').value.trim();
    const phone = document.getElementById('res-phone').value.trim();
    const event = document.getElementById('res-event').value;
    const date = document.getElementById('res-date').value;

    let valid = true;

    setError('fg-name', !name);
    if (!name) valid = false;

    setError('fg-phone', !validatePhone(phone));
    if (!validatePhone(phone)) valid = false;

    setError('fg-event', !event);
    if (!event) valid = false;

    setError('fg-date', !date);
    if (!date) valid = false;

    if (!valid) return;

    form.style.display = 'none';
    if (successMsg) successMsg.style.display = 'block';
  });

  // Clear error on input
  [['res-name','fg-name'],['res-phone','fg-phone'],['res-event','fg-event'],['res-date','fg-date']].forEach(([inputId, groupId]) => {
    const el = document.getElementById(inputId);
    if (el) el.addEventListener('input', () => setError(groupId, false));
  });
}
