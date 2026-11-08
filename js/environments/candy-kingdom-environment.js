(function () {
  "use strict";

  const App = (window.App = window.App || {});
  App.environments = App.environments || {};

  const { Mat4, T: translate, S: scale, mul: multiply } = App.math;
  const { quadrics } = App.geom;
  const HALF_PI = Math.PI / 2;

  // Skala seluruh lingkungan (2 = dua kali lebih besar).
  const ENV_SCALE = 2;

  function hexToRgb(hexColor) {
    const value = parseInt(hexColor.slice(1), 16);
    return [
      ((value >> 16) & 255) / 255,
      ((value >> 8) & 255) / 255,
      (value & 255) / 255,
    ];
  }

  const COLORS = {
    ground: hexToRgb("#c9dd7c"),
    path: hexToRgb("#f39a3d"),
    cream: hexToRgb("#fff1e0"),
    pink: hexToRgb("#f6a6c1"),
    red: hexToRgb("#e63946"),
    gold: hexToRgb("#ffc233"),
    gate: hexToRgb("#8c2f39"),
    cloudA: hexToRgb("#fde7ee"),
    cloudB: hexToRgb("#fff6f0"),
    bushA: hexToRgb("#f2a1d2"),
    bushB: hexToRgb("#d9a0f0"),
    bushC: hexToRgb("#f9c4e4"),
    treeLeaf: hexToRgb("#4cb8a0"),
    treeTrunk: hexToRgb("#b0705a"),
    mountainLight: hexToRgb("#e8998d"),
    mountainDark: hexToRgb("#b8645a"),
    rainbow: [hexToRgb("#ff7b7b"), hexToRgb("#ffd36b"), hexToRgb("#7bc8ff")],
  };

  // Angka acak deterministik agar variasi objek selalu sama.
  const rand = (n) => {
    const s = Math.sin(n * 127.1) * 43758.5453;
    return s - Math.floor(s);
  };

  const place = (x, y, z, sx, sy, sz) =>
    multiply(translate(x, y, z), scale(sx, sy, sz));

  // Kerucut quadric menghadap sumbu Z; diputar agar puncaknya ke atas (+Y).
  const coneUp = (x, y, z, radius, height) =>
    Mat4.chain(
      translate(x, y, z),
      Mat4.rotationX(-HALF_PI),
      scale(radius, radius, height),
    );

  class CandyKingdomEnvironment {
    constructor() {
      this.meshes = null;
      this.items = null;
    }

    // Segmen mesh dikurangi agar lebih ringan.
    initMeshes(glContext) {
      if (this.meshes) return this.meshes;

      this.meshes = {
        sphere: quadrics.sphereMesh(glContext, 16, 10),
        solid: quadrics.superellipsoidMesh(glContext, 1, 1, 1, 0.25, 1, 20, 6),
        cone: quadrics.coneMesh(glContext, 16, 2),
        dome: quadrics.ellipticParaboloidMesh(glContext, 1, 1, 1, 16, 5),
        rainbow: [15, 14.3, 13.6].map((r) =>
          quadrics.torusMesh(glContext, r, r, 0.3, 40, 6),
        ),
      };
      return this.meshes;
    }

    // Matriks dihitung sekali saja, lalu dipakai ulang tiap frame.
    build(glContext) {
      const meshes = this.initMeshes(glContext);
      const items = [];
      const baseScale = scale(ENV_SCALE, ENV_SCALE, ENV_SCALE);

      const add = (mesh, color, matrix, outlineWidth = 0.4) => {
        items.push([
          {
            mesh,
            color,
            spec: 0.12,
            ow: outlineWidth,
            shade: [0.75, 0.52, 0.65],
          },
          multiply(baseScale, matrix),
          1,
        ]);
      };

      // 1. TANAH + JALAN BERKELOK
      add(meshes.solid, COLORS.ground, place(0, -0.6, 0, 32, 0.6, 32), 0.3);

      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        const x = 2.6 * Math.sin(t * Math.PI * 2.2);
        const z = -5.4 + t * 17;
        add(meshes.solid, COLORS.path, place(x, 0, z, 1.8, 0.1, 1.8), 0.2);
      }

      // 2. PEGUNUNGAN
      for (let i = 0; i < 7; i++) {
        const angle = Math.PI * (1.08 + (i / 6) * 0.84);
        const radius = 7.5 + rand(i + 1) * 3;
        const height = 20 + rand(i + 20) * 8;
        const color = i % 2 === 0 ? COLORS.mountainLight : COLORS.mountainDark;
        add(
          meshes.cone,
          color,
          coneUp(
            40 * Math.cos(angle),
            -6,
            40 * Math.sin(angle),
            radius,
            height,
          ),
          0.5,
        );
      }

      // 3. PELANGI (setengah bawah tertutup tanah)
      meshes.rainbow.forEach((mesh, i) => {
        add(
          mesh,
          COLORS.rainbow[i],
          Mat4.chain(translate(0, 2, -17), Mat4.rotationY(HALF_PI)),
          0.2,
        );
      });

      // 4. KASTIL
      const [cx, , cz] = [0, 0, -11];

      [
        [8.2, 1.0, 5.2, 1.0, COLORS.cream],
        [6.4, 0.85, 4.2, 2.75, COLORS.pink],
        [4.6, 0.8, 3.2, 4.3, COLORS.cream],
      ].forEach(([rx, ry, rz, y, color]) => {
        add(meshes.solid, color, place(cx, y, cz, rx, ry, rz), 0.5);
      });

      [
        [6.7, 4.5, 2.0],
        [4.9, 3.4, 3.6],
      ].forEach(([rx, rz, y]) => {
        add(meshes.solid, COLORS.red, place(cx, y, cz, rx, 0.12, rz), 0.3);
      });

      add(
        meshes.sphere,
        COLORS.gate,
        place(cx, 1.2, cz + 5.0, 1.1, 1.3, 0.5),
        0.3,
      );

      // Menara kecil: x, z, dasar y, setengah tinggi, warna badan, warna atap
      [
        [-6.3, 0.3, 2.0, 1.6, COLORS.pink, COLORS.gold],
        [6.3, 0.3, 2.0, 1.6, COLORS.pink, COLORS.gold],
        [-3.8, 1.8, 3.6, 1.8, COLORS.cream, COLORS.gold],
        [3.8, 1.8, 3.6, 1.8, COLORS.cream, COLORS.gold],
        [-2.9, -1.6, 5.1, 1.6, COLORS.pink, COLORS.red],
        [2.9, -1.6, 5.1, 1.6, COLORS.pink, COLORS.red],
      ].forEach(([x, z, baseY, halfH, bodyColor, roofColor]) => {
        const top = baseY + halfH * 2 - 0.15;
        add(
          meshes.solid,
          bodyColor,
          place(cx + x, baseY + halfH - 0.15, cz + z, 0.9, halfH, 0.9),
          0.5,
        );
        add(
          meshes.cone,
          roofColor,
          coneUp(cx + x, top, cz + z, 1.25, 2.4),
          0.5,
        );
      });

      add(meshes.solid, COLORS.cream, place(cx, 7.9, cz, 1.8, 3.0, 1.8), 0.5);
      add(meshes.dome, COLORS.red, place(cx, 10.7, cz, 2.6, 1.8, 2.6), 0.5);

      // Awan permen di puncak
      [
        [0, 13.4, 0, 2.8, COLORS.cloudA],
        [-2.2, 13.1, 0.4, 1.9, COLORS.cloudB],
        [2.2, 13.1, 0.4, 1.9, COLORS.cloudB],
        [0, 15.4, 0.2, 2.0, COLORS.cloudB],
      ].forEach(([x, y, z, r, color]) => {
        add(
          meshes.sphere,
          color,
          place(cx + x, y, cz + z, r, r * 0.85, r),
          0.5,
        );
      });

      // 5. SEMAK PERMEN DI TEPI TANAH (sisi depan lebih rendah)
      const bushColors = [COLORS.bushA, COLORS.bushB, COLORS.bushC];
      for (let i = 0; i < 14; i++) {
        const angle = (i / 14) * Math.PI * 2;
        const x = 27 * Math.cos(angle);
        const z = 27 * Math.sin(angle);
        const size = (3.6 + rand(i + 50) * 2.4) * (z > 10 ? 0.55 : 1);
        add(
          meshes.sphere,
          bushColors[i % 3],
          place(x, size * 0.6, z, size * 1.2, size * 0.9, size * 1.2),
          0.4,
        );
      }

      // 6. POHON BULAT
      [
        [-18, 6],
        [18, 3],
        [-14, -4],
        [14, -4],
      ].forEach(([x, z]) => {
        add(
          meshes.solid,
          COLORS.treeTrunk,
          place(x, 1.0, z, 0.25, 1.0, 0.25),
          0.3,
        );
        add(
          meshes.sphere,
          COLORS.treeLeaf,
          place(x, 3.0, z, 1.4, 1.5, 1.4),
          0.4,
        );
      });

      return items;
    }

    render(drawList, glContext) {
      if (!this.items) this.items = this.build(glContext);
      for (let i = 0; i < this.items.length; i++) {
        drawList.push(this.items[i]);
      }
    }
  }

  App.environments.CandyKingdomEnvironment = CandyKingdomEnvironment;
  window.AT = window.AT || {};
  window.AT.CandyKingdomEnvironment = CandyKingdomEnvironment;
})();
