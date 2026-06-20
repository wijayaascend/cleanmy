/* Clean.my — legal pages: set year + basic anti-clickjacking fallback.
   (Real frame protection should come from the X-Frame-Options / CSP
   frame-ancestors header set at the CDN/edge — see project notes.) */
(function () {
  'use strict';
  try { if (window.top !== window.self) window.top.location = window.location.href; } catch (e) {}
  document.addEventListener('DOMContentLoaded', function () {
    var y = document.getElementById('year');
    if (y) y.textContent = new Date().getFullYear();
  });
})();
