// Force Bootstrap 5 dropdowns to close when clicking anywhere outside.
// This makes dropdown UX consistent even when forms/interactive content are inside.

(function () {
  function closeAllDropdowns(exceptMenuEl) {
    if (!window.bootstrap || !window.bootstrap.Dropdown) {
      return;
    }

    const openToggles = document.querySelectorAll(
      '[data-bs-toggle="dropdown"].show'
    );

    openToggles.forEach((toggle) => {
      const menu = toggle.nextElementSibling;
      if (exceptMenuEl && menu && menu.contains(exceptMenuEl)) {
        return;
      }

      const instance = window.bootstrap.Dropdown.getInstance(toggle);
      if (instance) {
        instance.hide();
      } else {
        // If Bootstrap created instance lazily, create then hide.
        new window.bootstrap.Dropdown(toggle).hide();
      }
    });
  }

  document.addEventListener(
    "click",
    function (evt) {
      const target = evt.target;
      if (!target) return;

      // Click on a dropdown toggle => let Bootstrap handle toggle behavior.
      if (target.closest && target.closest('[data-bs-toggle="dropdown"]')) {
        return;
      }

      // Click inside an open dropdown menu => keep it open.
      const menu = target.closest && target.closest(".dropdown-menu");
      if (menu) {
        return;
      }

      closeAllDropdowns();
    },
    true
  );
})();
