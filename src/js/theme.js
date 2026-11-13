// Setter valgt tema før siden tegnes. Uten valg følger siden systemet (prefers-color-scheme).
(function () {
  try {
    var t = localStorage.getItem("nitd_theme");
    if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
  } catch (e) {}
})();
