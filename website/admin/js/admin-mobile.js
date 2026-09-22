// Readable phone tables share the same row data and actions as desktop.
document.addEventListener('DOMContentLoaded', () => {
  const nav = document.querySelector('.admin-nav');
  const current = nav?.querySelector('a.active');
  if (current && window.matchMedia('(max-width:760px)').matches) {
    requestAnimationFrame(() => {
      nav.scrollLeft = current.offsetLeft - nav.offsetLeft - 14;
    });
  }
  const root = document.querySelector('.admin-main');
  if (!root) return;
  const labelTables = () => root.querySelectorAll('.customers-table,.enquiries-table').forEach(table => {
    table.classList.add('admin-records');
    const headers = Array.from(table.querySelectorAll('thead th')).filter(th => !th.hidden);
    table.querySelectorAll('tbody tr').forEach(row => {
      Array.from(row.children).forEach((cell, i) => {
        if (cell.tagName === 'TD' && cell.colSpan === 1) cell.dataset.label = headers[i]?.textContent.trim() || '';
      });
    });
  });
  labelTables();
  new MutationObserver(labelTables).observe(root, {childList:true, subtree:true});
});
