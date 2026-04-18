/**
 * Runtime config shared by all frontend modules.
 *
 * API base resolution order:
 * 1) ?api=... query parameter
 * 2) localStorage.API_BASE (set once, reused)
 * 3) same-origin when served by Flask (:5001)
 * 4) localhost Flask fallback for static hosts (GitHub Pages, file://, etc.)
 */
(function () {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const apiFromQuery = params.get('api');
  const apiFromStorage = localStorage.getItem('API_BASE');

  if (apiFromQuery) {
    localStorage.setItem('API_BASE', apiFromQuery);
  }

  const resolved =
    apiFromQuery ||
    apiFromStorage ||
    (window.location.port === '5001' ? '' : 'http://localhost:5001');

  window.APP_CONFIG = {
    apiBase: resolved,
  };
})();
