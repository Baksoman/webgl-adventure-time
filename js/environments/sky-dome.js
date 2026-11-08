(function () {
  "use strict";

  const App = (window.App = window.App || {});
  App.environments = App.environments || {};

  const { T: translate, S: scale, mul: multiply } = App.math;
  const { quadrics } = App.geom;

  // Preset sinematik: cahaya utama hangat vs bayangan dingin agar kontras dan realistis.
  const SKY_PRESETS = {
    day: {
      name: "Siang",
      skyColor: [0.3, 0.55, 0.82],
      horizonColor: [0.66, 0.8, 0.92],
      lightDirection: [0.55, 0.72, 0.42],
      lightColor: [1.0, 0.94, 0.82],
      ambientSky: [0.42, 0.52, 0.68],
      ambientGround: [0.22, 0.25, 0.2],
      rimColor: [0.85, 0.92, 1.0],
      rimStrength: 0.6,
      sunColor: [1.0, 0.97, 0.88],
      sunSize: 5,
    },
    sunset: {
      name: "Sore",
      skyColor: [0.55, 0.28, 0.3],
      horizonColor: [0.95, 0.5, 0.26],
      lightDirection: [0.9, 0.18, 0.3],
      lightColor: [1.25, 0.62, 0.28],
      ambientSky: [0.3, 0.26, 0.4],
      ambientGround: [0.3, 0.18, 0.15],
      rimColor: [1.3, 0.7, 0.35],
      rimStrength: 1.4,
      sunColor: [1.0, 0.62, 0.3],
      sunSize: 9,
    },
    night: {
      name: "Malam",
      skyColor: [0.02, 0.03, 0.08],
      horizonColor: [0.07, 0.1, 0.2],
      lightDirection: [-0.4, 0.75, -0.5],
      lightColor: [0.28, 0.38, 0.68],
      ambientSky: [0.07, 0.1, 0.2],
      ambientGround: [0.04, 0.05, 0.09],
      rimColor: [0.5, 0.7, 1.1],
      rimStrength: 1.5,
      sunColor: [0.85, 0.9, 1.0],
      sunSize: 4,
    },
  };

  class SkyDome {
    constructor() {
      this.currentPresetKey = "day";
      this.domeMesh = null;
    }

    setPreset(presetKey) {
      if (SKY_PRESETS[presetKey]) {
        this.currentPresetKey = presetKey;
      }
    }

    getCurrentPreset() {
      return SKY_PRESETS[this.currentPresetKey] || SKY_PRESETS.day;
    }

    render(drawList, glContext, cameraTarget = [0, 0, 0]) {
      if (!this.domeMesh) {
        this.domeMesh = quadrics.sphereMesh(glContext, 32, 18);
      }

      const preset = this.getCurrentPreset();
      const skyRadius = 140;
      const [cx, cy, cz] = cameraTarget;

      // Kubah langit
      drawList.push([
        {
          mesh: this.domeMesh,
          color: preset.skyColor,
          spec: 0,
          ow: 0,
          unlit: true,
        },
        multiply(translate(cx, cy, cz), scale(skyRadius, skyRadius, skyRadius)),
        1,
      ]);

      // Matahari / bulan di arah cahaya utama
      const [lx, ly, lz] = preset.lightDirection;
      const length = Math.hypot(lx, ly, lz) || 1;
      const distance = skyRadius * 0.85;
      const size = preset.sunSize;

      drawList.push([
        {
          mesh: this.domeMesh,
          color: preset.sunColor,
          spec: 0,
          ow: 0,
          unlit: true,
        },
        multiply(
          translate(
            cx + (lx / length) * distance,
            cy + (ly / length) * distance,
            cz + (lz / length) * distance,
          ),
          scale(size, size, size),
        ),
        1,
      ]);
    }
  }

  App.environments.SkyDome = SkyDome;
  App.environments.SKY_PRESETS = SKY_PRESETS;
  window.AT = window.AT || {};
  window.AT.SkyDome = SkyDome;
})();
