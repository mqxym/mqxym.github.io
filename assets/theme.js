(() => {
  const choices = ["system", "light", "dark"];
  let theme = "system";

  try {
    const saved = localStorage.getItem("theme");
    if (choices.includes(saved)) theme = saved;
  } catch (error) {
    console.warn("Theme preference could not be read; using the system theme.", error);
  }

  function applyTheme() {
    if (theme === "system") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.dataset.theme = theme;
    }
    document.querySelectorAll("[data-theme-choice]").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.themeChoice === theme));
    });
  }

  applyTheme();

  document.addEventListener("DOMContentLoaded", () => {
    const picker = document.querySelector(".theme-picker");
    picker.hidden = false;
    applyTheme();

    picker.querySelectorAll("button").forEach(button => {
      button.addEventListener("click", () => {
        theme = button.dataset.themeChoice;
        applyTheme();
        try {
          if (theme === "system") {
            localStorage.removeItem("theme");
          } else {
            localStorage.setItem("theme", theme);
          }
        } catch (error) {
          console.warn("Theme preference could not be saved; it will only apply to this page.", error);
        }
      });
    });
  });
})();
