// Paint the right theme before React mounts — no flash of the wrong one.
// A separate file rather than an inline script so the page can ship a
// Content-Security-Policy without 'unsafe-inline' for scripts.
(function () {
  try {
    // Light is the default; dark is opt-in through the toggle, so the OS
    // preference is deliberately not consulted.
    var t = localStorage.getItem("ohshi.theme");
    if (t !== "light" && t !== "dark") t = "light";
    document.documentElement.setAttribute("data-theme", t);
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "light");
  }
})();
