(function () {
  "use strict";

  const App = (window.App = window.App || {});
  App.gfx = App.gfx || {};

  const FONT_FAMILY =
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

  const AXES = [
    { label: "X", color: "#ff5c7a", vector: [1, 0, 0], isNegative: false },
    { label: "-X", color: "#ff5c7a", vector: [-1, 0, 0], isNegative: true },
    { label: "Y", color: "#3ddc97", vector: [0, 1, 0], isNegative: false },
    { label: "-Y", color: "#3ddc97", vector: [0, -1, 0], isNegative: true },
    { label: "Z", color: "#4dabf7", vector: [0, 0, 1], isNegative: false },
    { label: "-Z", color: "#4dabf7", vector: [0, 0, -1], isNegative: true },
  ];

  class AxisGizmo {
    constructor(options = {}) {
      this.size = options.size || 120;
      this.length = options.length || 38;
      this.canvas = options.canvas || null;

      if (!this.canvas) {
        this.canvas = document.createElement("canvas");
        this.canvas.id = "axis-gizmo";
        Object.assign(this.canvas.style, {
          position: "absolute",
          top: "16px",
          right: "16px",
          zIndex: "20",
          pointerEvents: "none",
          borderRadius: "50%",
          background: "rgba(20, 22, 32, 0.85)",
          backdropFilter: "blur(8px)",
          webkitBackdropFilter: "blur(8px)",
          border: "1px solid rgba(255, 255, 255, 0.18)",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.35)",
        });
        document.body.appendChild(this.canvas);
      }

      // Ukuran CSS selalu diatur, termasuk untuk canvas yang dibuat pemanggil
      this.canvas.style.width = `${this.size}px`;
      this.canvas.style.height = `${this.size}px`;

      this.ctx = this.canvas.getContext("2d");
      const pixelRatio = window.devicePixelRatio || 1;
      this.canvas.width = Math.round(this.size * pixelRatio);
      this.canvas.height = Math.round(this.size * pixelRatio);
      this.ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    }

    // Menggambar titik pusat (origin) sumbu
    drawOrigin(centerX, centerY) {
      const context = this.ctx;
      context.beginPath();
      context.arc(centerX, centerY, 3.5, 0, Math.PI * 2);
      context.fillStyle = "#f0f2fa";
      context.fill();
    }

    // Menggambar satu sumbu: garis dari pusat, lalu bulatan label di ujungnya
    drawAxis(axis, centerX, centerY) {
      const context = this.ctx;
      const depthFade = 0.6 + 0.4 * ((axis.towardViewer + 1) / 2);
      const badgeRadius = axis.isNegative ? 9 : 11;
      const fontSize = axis.isNegative ? 10 : 13;

      context.save();
      context.globalAlpha = depthFade;

      context.beginPath();
      context.moveTo(centerX, centerY);
      context.lineTo(axis.screenX, axis.screenY);
      context.strokeStyle = axis.color;
      context.lineWidth = axis.isNegative ? 2 : 3;
      context.lineCap = "round";
      context.setLineDash(axis.isNegative ? [3, 3] : []);
      context.stroke();
      context.setLineDash([]);

      // Sumbu positif berisi warna penuh, sumbu negatif berisi gelap dengan cincin berwarna
      context.beginPath();
      context.arc(axis.screenX, axis.screenY, badgeRadius, 0, Math.PI * 2);
      context.fillStyle = axis.isNegative ? "#1b1f2e" : axis.color;
      context.fill();
      context.strokeStyle = axis.isNegative ? axis.color : "#ffffff";
      context.lineWidth = 2;
      context.stroke();

      // Teks putih dengan kontur gelap supaya terbaca di semua warna sumbu
      context.font = `bold ${fontSize}px ${FONT_FAMILY}`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.lineJoin = "round";
      context.lineWidth = 3;
      context.strokeStyle = "rgba(0, 0, 0, 0.55)";
      context.strokeText(axis.label, axis.screenX, axis.screenY + 0.5);
      context.fillStyle = "#ffffff";
      context.fillText(axis.label, axis.screenX, axis.screenY + 0.5);

      context.restore();
    }

    update(yaw, pitch) {
      const size = this.size;
      const centerX = size / 2;
      const centerY = size / 2;
      const axisLength = this.length;

      this.ctx.clearRect(0, 0, size, size);

      const cosPitch = Math.cos(pitch);
      const sinPitch = Math.sin(pitch);
      const cosYaw = Math.cos(yaw);
      const sinYaw = Math.sin(yaw);

      // Proyeksi koordinat 3D ke 2D canvas berdasarkan orientasi kamera
      const projectedAxes = AXES.map((axis) => {
        const [x, y, z] = axis.vector;
        const screenX = centerX + (x * cosYaw - z * sinYaw) * axisLength;
        const screenY =
          centerY +
          (x * sinYaw * sinPitch - y * cosPitch + z * cosYaw * sinPitch) *
            axisLength;
        // Positif berarti sumbu mengarah ke penonton, negatif berarti menjauh
        const towardViewer =
          x * cosPitch * sinYaw + y * sinPitch + z * cosPitch * cosYaw;
        return { ...axis, screenX, screenY, towardViewer };
      });

      // Urutkan dari yang terjauh ke yang terdekat agar sumbu depan menimpa sumbu belakang
      projectedAxes.sort(
        (axisA, axisB) => axisA.towardViewer - axisB.towardViewer,
      );

      // Titik pusat digambar setelah sumbu belakang dan sebelum sumbu depan
      let hasDrawnOrigin = false;
      projectedAxes.forEach((axis) => {
        if (!hasDrawnOrigin && axis.towardViewer >= 0) {
          this.drawOrigin(centerX, centerY);
          hasDrawnOrigin = true;
        }
        this.drawAxis(axis, centerX, centerY);
      });
      if (!hasDrawnOrigin) this.drawOrigin(centerX, centerY);
    }
  }

  App.gfx.AxisGizmo = AxisGizmo;
  window.AT = window.AT || {};
  window.AT.AxisGizmo = AxisGizmo;
  window.JK = window.JK || {};
  window.JK.AxisGizmo = AxisGizmo;
})();
