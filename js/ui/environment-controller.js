(function () {
  "use strict";

  const App = (window.App = window.App || {});
  App.ui = App.ui || {};

  /**
   * Pengendali UI Lingkungan (Environment Controller)
   * Mengatur pemilihan tema dunia 3D, waktu/pencahayaan, dan preset kamera.
   */
  class EnvironmentController {
    constructor(options = {}) {
      this.currentEnvironment = options.initialEnvironment || "treehouse";
      this.currentTimePreset = options.initialTime || "day";
      this.onEnvironmentChange = options.onEnvironmentChange || null;
      this.onTimeChange = options.onTimeChange || null;
      this.onCameraPresetSelect = options.onCameraPresetSelect || null;

      this.initDomListeners();
    }

    initDomListeners() {
      // 1. Tombol Tema Environment
      const envButtons = document.querySelectorAll("[data-env]");
      envButtons.forEach((button) => {
        button.addEventListener("click", () => {
          const selectedTheme = button.getAttribute("data-env");
          this.setEnvironment(selectedTheme);
        });
      });

      // 2. Tombol Waktu / Pencahayaan (Siang, Sore, Malam)
      const timeButtons = document.querySelectorAll("[data-time]");
      timeButtons.forEach((button) => {
        button.addEventListener("click", () => {
          const selectedTime = button.getAttribute("data-time");
          this.setTime(selectedTime);
        });
      });

      // 3. Tombol Preset Kamera (Semua, Finn, Jake, BMO)
      const cameraButtons = document.querySelectorAll("[data-cam-preset]");
      cameraButtons.forEach((button) => {
        button.addEventListener("click", () => {
          const selectedPreset = button.getAttribute("data-cam-preset");
          if (this.onCameraPresetSelect) {
            this.onCameraPresetSelect(selectedPreset);
          }
          this.updateActiveButton(cameraButtons, button);
        });
      });
    }

    setEnvironment(themeKey) {
      this.currentEnvironment = themeKey;
      const envButtons = document.querySelectorAll("[data-env]");
      envButtons.forEach((btn) => {
        btn.classList.toggle("active", btn.getAttribute("data-env") === themeKey);
      });
      if (this.onEnvironmentChange) {
        this.onEnvironmentChange(themeKey);
      }
    }

    setTime(timeKey) {
      this.currentTimePreset = timeKey;
      const timeButtons = document.querySelectorAll("[data-time]");
      timeButtons.forEach((btn) => {
        btn.classList.toggle("active", btn.getAttribute("data-time") === timeKey);
      });
      if (this.onTimeChange) {
        this.onTimeChange(timeKey);
      }
    }

    updateActiveButton(buttonNodeList, activeButton) {
      buttonNodeList.forEach((btn) => btn.classList.remove("active"));
      activeButton.classList.add("active");
    }
  }

  App.ui.EnvironmentController = EnvironmentController;
  window.AT = window.AT || {};
  window.AT.EnvironmentController = EnvironmentController;
})();
