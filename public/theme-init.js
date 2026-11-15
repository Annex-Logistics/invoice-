// Runs in <head> before first paint (loaded with the CSP nonce) so dark
// mode never flashes light. Keep in sync with lib/theme.ts.
(function () {
  try {
    var t = localStorage.getItem("annexinvoice.theme.v1");
    var dark =
      t === "dark" ||
      ((!t || t === "system") && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
  } catch {
    /* storage blocked: stay light */
  }
})();
