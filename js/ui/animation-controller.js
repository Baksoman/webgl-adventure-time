(function () {
  "use strict";

  const App = (window.App = window.App || {});
  App.ui = App.ui || {};

  /**
   * Pengendali UI Animasi (Animation Controller)
   * Mengatur pemilihan gerakan lokomosi karakter (Diam, Jalan, Lari, Lompat) dan rotasi otomatis panggung.
   */
  class AnimationController {
    constructor(options = {}) {
      this.currentMode = options.initialMode || "idle";
      this.isAutoRotate = options.initialAutoRotate !== undefined ? options.initialAutoRotate : false;
      this.onModeChange = options.onModeChange || null;
      this.onAutoRotateToggle = options.onAutoRotateToggle || null;
      this.onJumpTrigger = options.onJumpTrigger || null;

      this.initDomListeners();
    }

    initDomListeners() {
      // 1. Tombol Mode Gerakan (Diam, Jalan, Lari, Lompat)
      const animButtons = document.querySelectorAll("[data-anim-mode]");
      animButtons.forEach((button) => {
        button.addEventListener("click", () => {
          const selectedMode = button.getAttribute("data-anim-mode");
          this.setMode(selectedMode);
        });
      });

      // 2. Tombol Rotasi Otomatis
      const rotateButton = document.querySelector("[data-toggle-rotate]");
      if (rotateButton) {
        rotateButton.addEventListener("click", () => {
          this.toggleAutoRotate();
        });
      }
    }

    setMode(modeKey) {
      this.currentMode = modeKey;
      const animButtons = document.querySelectorAll("[data-anim-mode]");
      animButtons.forEach((btn) => {
        btn.classList.toggle("active", btn.getAttribute("data-anim-mode") === modeKey);
      });
      
      // Jika mode adalah jump, trigger callback untuk reset waktu animasi
      if (modeKey === "jump" && this.onJumpTrigger) {
        this.onJumpTrigger();
      }
      
      if (this.onModeChange) {
        this.onModeChange(modeKey);
      }
    }

    toggleAutoRotate() {
      this.isAutoRotate = !this.isAutoRotate;
      const rotateButton = document.querySelector("[data-toggle-rotate]");
      if (rotateButton) {
        rotateButton.classList.toggle("active", this.isAutoRotate);
      }
      if (this.onAutoRotateToggle) {
        this.onAutoRotateToggle(this.isAutoRotate);
      }
    }
  }

  App.ui.AnimationController = AnimationController;
  window.AT = window.AT || {};
  window.AT.AnimationController = AnimationController;
})();
