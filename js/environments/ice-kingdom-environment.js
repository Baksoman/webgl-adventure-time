(function () {
  "use strict";

  const App = (window.App = window.App || {});
  App.environments = App.environments || {};

  const { Mat4, T: translate, S: scale, mul: multiply } = App.math;
  const { quadrics } = App.geom;
  const rotateX = Mat4.rotationX;
  const rotateZ = Mat4.rotationZ;

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
    ground: hexToRgb("#d8e6ff"),
    groundFar: hexToRgb("#a9c0f0"),
    mountains: [hexToRgb("#3558d8"), hexToRgb("#2a46b8"), hexToRgb("#4a78f0")],
    snow: hexToRgb("#f4f8ff"),
    crystals: [hexToRgb("#1c2b8a"), hexToRgb("#2a46b8"), hexToRgb("#6fb4ff")],
    keep: hexToRgb("#8fb0ff"),
    spire: hexToRgb("#c4d8ff"),
    roof: hexToRgb("#4a6fe0"),
    door: hexToRgb("#1f2f94"),
    window: hexToRgb("#fff0a0"),
    pond: hexToRgb("#bfe8ff"),
    boulder: hexToRgb("#b8d0ff"),
    pine: hexToRgb("#a8ccff"),
    pineTrunk: hexToRgb("#5a6fb0"),
  };

  const SHADE = [0.66, 0.54, 0.58];

  // Gunung utama (kerucut: dasar y0, puncak y0 + H). Koordinat lokal sebelum ENV_SCALE.
  const MOUNTAIN = { x: 0, z: -30, R: 17, H: 26, y0: -2 };

  const rnd = (n) => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };

  class IceKingdomEnvironment {
    constructor() {
      this.meshes = null;
      this.items = null;
      this.snowParticles = null;
      this.lastSnowTime = 0;
    }

    initMeshes(gl) {
      if (this.meshes) return this.meshes;
      this.meshes = {
        sphere: quadrics.sphereMesh(gl, 24, 14),
        cylinder: quadrics.cylinderYMesh(gl, 1, 1, 16, 2),
        box: quadrics.roundedBoxMesh(gl, 1, 1, 1, 0.06, 2),
        mountain: quadrics.coneMesh(gl, 48, 2),
        crystal: quadrics.coneMesh(gl, 5, 1),
      };
      return this.meshes;
    }

    // Membuat partikel salju dengan posisi dan kecepatan deterministik.
    initSnowParticles() {
      const particles = [];

      for (let i = 0; i < 100; i++) {
        particles.push({
          x: (rnd(i + 300) - 0.5) * 130,
          y: 12 + rnd(i + 400) * 35,
          z: -85 + rnd(i + 500) * 120,

          size: 0.06 + rnd(i + 600) * 0.08,
          speed: 4 + rnd(i + 700) * 5,

          wind: -1.2 + rnd(i + 800) * 2.4,
          drift: -0.5 + rnd(i + 900),
        });
      }

      this.snowParticles = particles;
    }

    // Matriks dihitung sekali, lalu dipakai ulang tiap frame.
    build(gl) {
      const meshes = this.initMeshes(gl);
      const items = [];
      const baseScale = scale(ENV_SCALE, ENV_SCALE, ENV_SCALE);

      const world = (mesh, color, matrix, ow = 0.3) =>
        items.push([
          { mesh, color, spec: 0.1, ow, shade: SHADE },
          multiply(baseScale, matrix),
          1,
        ]);

      const sphere = (color, [x, y, z], [sx, sy, sz], ow = 0.3) =>
        world(
          meshes.sphere,
          color,
          multiply(translate(x, y, z), scale(sx, sy, sz)),
          ow,
        );

      const box = (color, [x, y, z], [sx, sy, sz], ow = 0.3) =>
        world(
          meshes.box,
          color,
          multiply(translate(x, y, z), scale(sx, sy, sz)),
          ow,
        );

      const pole = (color, [x, y, z], radius, height, ow = 0.3) =>
        world(
          meshes.cylinder,
          color,
          multiply(translate(x, y, z), scale(radius, height, radius)),
          ow,
        );

      // Kerucut runcing ke atas: (x, y, z) = pusat dasar.
      const cone = (
        mesh,
        color,
        [x, y, z],
        radius,
        height,
        tilt = 0,
        ow = 0.3,
      ) =>
        world(
          mesh,
          color,
          Mat4.chain(
            translate(x, y, z),
            rotateZ(tilt),
            rotateX(-Math.PI / 2),
            scale(radius, radius, height),
          ),
          ow,
        );

      const snowCap = (mesh, [x, y0, z], radius, height, k = 0.28) =>
        cone(
          mesh,
          COLORS.snow,
          [x, y0 + height * (1 - k), z],
          radius * k * 1.05,
          height * k * 1.03,
          0,
          0.3,
        );

      const mountain = (x, z, R, H, color) => {
        cone(meshes.mountain, color, [x, MOUNTAIN.y0, z], R, H, 0, 0.4);
        snowCap(meshes.mountain, [x, MOUNTAIN.y0, z], R, H);
      };

      const crystalCluster = (cx, cz, count, spread, seed) => {
        for (let i = 0; i < count; i++) {
          const angle = rnd(seed + i) * Math.PI * 2;
          const dist = rnd(seed + i + 50) * spread;
          const radius = 0.5 + rnd(seed + i + 100) * 0.7;
          const height = 2.5 + rnd(seed + i + 150) * 5.5;
          const tilt = (rnd(seed + i + 200) - 0.5) * 0.4;
          cone(
            meshes.crystal,
            COLORS.crystals[i % COLORS.crystals.length],
            [cx + Math.cos(angle) * dist, -0.4, cz + Math.sin(angle) * dist],
            radius,
            height,
            tilt,
            0.4,
          );
        }
      };

      // 1. TANAH ES
      sphere(COLORS.groundFar, [0, -1.1, 0], [135, 1, 135], 0);
      sphere(COLORS.ground, [0, -0.7, 0], [95, 0.7, 95], 0);

      // 2. GUNUNG LATAR
      [
        [-38, -34, 11, 20],
        [36, -38, 12, 22],
        [-60, -12, 13, 24],
        [62, -10, 14, 26],
        [-22, -58, 14, 28],
        [26, -60, 13, 25],
        [-78, -45, 15, 30],
        [80, -50, 16, 32],
        [0, -80, 18, 34],
        [-55, 30, 12, 20],
        [55, 32, 12, 18],
        [-30, 60, 12, 16],
        [34, 64, 13, 18],
      ].forEach(([x, z, R, H], i) => {
        mountain(x, z, R, H, COLORS.mountains[i % COLORS.mountains.length]);
      });

      // Gunung utama: sama seperti gunung lain (ada salju di puncak), kastil berdiri di atasnya
      mountain(
        MOUNTAIN.x,
        MOUNTAIN.z,
        MOUNTAIN.R,
        MOUNTAIN.H,
        COLORS.mountains[0],
      );

      // 3. (jalan dihapus: lantai es dan lereng gunung polos)

      // 4. KASTIL ES DI PUNCAK
      const cx = MOUNTAIN.x;
      const cz = MOUNTAIN.z;

      box(COLORS.keep, [cx, 22, cz], [5, 5, 5], 0.5);
      box(COLORS.door, [cx, 21.4, cz + 2.5], [1.4, 2.2, 0.2], 0.3);
      box(COLORS.window, [cx - 1.4, 23, cz + 2.5], [0.7, 1.0, 0.2], 0.2);
      box(COLORS.window, [cx + 1.4, 23, cz + 2.5], [0.7, 1.0, 0.2], 0.2);

      [
        [-2.4, -2.4],
        [2.4, -2.4],
        [-2.4, 2.4],
        [2.4, 2.4],
      ].forEach(([dx, dz]) => {
        pole(COLORS.keep, [cx + dx, 17, cz + dz], 0.8, 8.5, 0.4);
        cone(
          meshes.crystal,
          COLORS.roof,
          [cx + dx, 25.3, cz + dz],
          1.0,
          3.2,
          0,
          0.4,
        );
      });

      cone(meshes.crystal, COLORS.spire, [cx, 24.2, cz], 2.2, 11, 0, 0.5);
      snowCap(meshes.crystal, [cx, 24.2, cz], 2.2, 11, 0.2);
      cone(
        meshes.crystal,
        COLORS.spire,
        [cx - 1.3, 24, cz + 0.5],
        1.0,
        7,
        0.12,
        0.4,
      );
      cone(
        meshes.crystal,
        COLORS.spire,
        [cx + 1.3, 24, cz + 0.5],
        1.0,
        7,
        -0.12,
        0.4,
      );

      // 5. DEKORASI (dijauhkan dari jalan di x = 0)
      [
        [-9, -4],
        [9, -5],
        [-12, 6],
        [13, 5],
        [-20, -12],
        [20, -14],
        [-17, -20],
        [18, -22],
        [-7, -12],
        [8, -13],
      ].forEach(([x, z], i) => crystalCluster(x, z, 6, 2.5, 10 + i * 13));

      sphere(COLORS.pond, [10, 0, 6], [3.5, 0.08, 2.5], 0);

      [
        [-6, 3, 1.3],
        [7, 3.5, 1.0],
        [-10, -8, 1.6],
        [11, -9, 1.2],
      ].forEach(([x, z, s]) => {
        sphere(COLORS.boulder, [x, s * 0.3, z], [s, s * 0.8, s], 0.3);
      });

      [
        [-8, 8],
        [8, 9],
        [-14, -2],
        [15, -3],
        [-5, 12],
        [4, 14],
      ].forEach(([x, z]) => {
        pole(COLORS.pineTrunk, [x, 0, z], 0.25, 1.2, 0.3);
        cone(meshes.mountain, COLORS.pine, [x, 0.8, z], 1.6, 3.2, 0, 0.3);
        cone(meshes.mountain, COLORS.pine, [x, 2.6, z], 1.1, 2.6, 0, 0.3);
        cone(meshes.mountain, COLORS.snow, [x, 4.2, z], 0.7, 2.0, 0, 0.3);
      });

      return items;
    }

    render(drawList, gl) {
      if (!this.items) {
        this.items = this.build(gl);
      }

      // Render objek lingkungan yang statis.
      for (let i = 0; i < this.items.length; i++) {
        drawList.push(this.items[i]);
      }

      // Inisialisasi partikel salju satu kali.
      if (!this.snowParticles) {
        this.initSnowParticles();
      }

      // Menghitung delta time agar kecepatan konsisten.
      const now = performance.now();

      const delta = this.lastSnowTime
        ? Math.min((now - this.lastSnowTime) / 1000, 0.05)
        : 1 / 60;

      this.lastSnowTime = now;

      const baseScale = scale(ENV_SCALE, ENV_SCALE, ENV_SCALE);

      // Memperbarui posisi dan merender setiap partikel.
      for (const p of this.snowParticles) {
        // Salju jatuh ke bawah.
        p.y -= p.speed * delta;

        // Angin menggerakkan salju secara horizontal.
        p.x += p.wind * delta;
        p.z += p.drift * delta;

        // Partikel yang mencapai tanah kembali ke atas.
        if (p.y < -2) {
          p.y = 35 + rnd(p.x * 13 + p.z * 7) * 15;
        }

        // Membatasi area partikel agar tetap di sekitar lingkungan.
        if (p.x > 65) p.x = -65;
        if (p.x < -65) p.x = 65;

        if (p.z > 35) p.z = -85;
        if (p.z < -85) p.z = 35;

        const particleMatrix = multiply(
          baseScale,
          multiply(translate(p.x, p.y, p.z), scale(p.size, p.size, p.size)),
        );

        drawList.push([
          {
            mesh: this.meshes.sphere,
            color: COLORS.snow,
            spec: 0.1,
            ow: 0,
            shade: SHADE,
          },
          particleMatrix,
          1,
        ]);
      }
    }
  }

  App.environments.IceKingdomEnvironment = IceKingdomEnvironment;
  window.AT = window.AT || {};
  window.AT.IceKingdomEnvironment = IceKingdomEnvironment;
})();
