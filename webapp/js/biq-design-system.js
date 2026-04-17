(() => {
  'use strict';

  const toast = document.getElementById('biqToast');
  const showToastBtn = document.getElementById('showToast');
  const openModalBtn = document.getElementById('openModal');
  const closeModalBtn = document.getElementById('closeModal');
  const modal = document.getElementById('componentModal');

  if (showToastBtn && toast) {
    showToastBtn.addEventListener('click', () => {
      toast.classList.add('is-visible');
      clearTimeout(toast._timer);
      toast._timer = setTimeout(() => toast.classList.remove('is-visible'), 2200);
    });
  }

  if (openModalBtn && modal) {
    openModalBtn.addEventListener('click', () => modal.showModal());
  }

  if (closeModalBtn && modal) {
    closeModalBtn.addEventListener('click', () => modal.close());
  }

  document.querySelectorAll('.biq-segmented').forEach(segmented => {
    segmented.addEventListener('click', event => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) return;

      segmented.querySelectorAll('button').forEach(btn => btn.classList.remove('is-active'));
      target.classList.add('is-active');

      const status = target.dataset.seg;
      document.querySelectorAll('.biq-action-row').forEach(row => {
        const shouldShow = status === 'all' || row.dataset.status === status;
        row.style.display = shouldShow ? '' : 'none';
      });
    });
  });

  const notifyBtn = document.getElementById('demoNotify');
  if (notifyBtn && toast) {
    notifyBtn.addEventListener('click', () => {
      toast.textContent = '3 new actions are waiting in queue';
      toast.classList.add('is-visible');
      clearTimeout(toast._timer);
      toast._timer = setTimeout(() => {
        toast.classList.remove('is-visible');
        toast.textContent = 'Action added to queue';
      }, 2200);
    });
  }
})();
