(function () {
  "use strict";

  const App = (window.App = window.App || {});
  App.environments = App.environments || {};

  const { Mat4, T: translate, S: scale, mul: multiply } = App.math;
  const { quadrics } = App.geom;
  const rotateY = Mat4.rotationY;
  const rotateZ = Mat4.rotationZ;

  function hexToRgb(hexColor) {
    const value = parseInt(hexColor.slice(1), 16);
    return [
      ((value >> 16) & 255) / 255,
      ((value >> 8) & 255) / 255,
      (value & 255) / 255,
    ];
  }

  const COLORS = {
    grass: hexToRgb("#6fc24e"),
    grassFar: hexToRgb("#58a83e"),
    path: hexToRgb("#e0b070"),
    water: hexToRgb("#6cc7cf"),
    lily: hexToRgb("#4fa83f"),
    trunk: hexToRgb("#7a5230"),
    trunkDark: hexToRgb("#5a3d26"),
    foliage: hexToRgb("#4fb03f"),
    foliageLight: hexToRgb("#66c850"),
    foliageDark: hexToRgb("#3d9a33"),
    wall: hexToRgb("#9a6a3c"),
    roof: hexToRgb("#4a6d8c"),
    door: hexToRgb("#5a3826"),
    window: hexToRgb("#d8f070"),
    wood: hexToRgb("#a87a48"),
    flagRed: hexToRgb("#d6433f"),
    umbrella: hexToRgb("#f0a030"),
    chimney: hexToRgb("#d98c3a"),
    flowerYellow: hexToRgb("#ffd152"),
    flowerRed: hexToRgb("#e84a5f"),
    flowerWhite: hexToRgb("#fff4f0"),
  };

  const SHADE = [0.66, 0.54, 0.58];

  // Pohon berada di belakang titik tengah (X = 0) agar karakter yang spawn
  // di titik tengah dunia (0, 0, 0) berdiri tepat di depannya, tidak menembus batang.
  // Ubah angka Z ini kalau ingin pohon lebih dekat/jauh dari karakter.
  const TREE_POSITION = [0, 0, -8];
  const TREE_SCALE = 1;

  class TreehouseEnvironment {
    constructor() {
      this.meshes = null;
    }

    // Semua bentuk dari quadrics.js, dibuat sekali lalu dipakai ulang lewat translate/scale/rotate
    initMeshes(gl) {
      if (this.meshes) return this.meshes;
      this.meshes = {
        sphere: quadrics.sphereMesh(gl, 28, 18),
        cylinder: quadrics.cylinderYMesh(gl, 1, 1, 24, 2), // tegak, dasar y=0, tinggi 1
        box: quadrics.roundedBoxMesh(gl, 1, 1, 1, 0.06, 2),
        roofPrism: quadrics.prismMesh(
          gl,
          [
            [-2.7, 0],
            [2.7, 0],
            [0, 2.1],
          ],
          4.0,
          false,
        ),
      };
      return this.meshes;
    }

    render(drawList, gl) {
      const meshes = this.initMeshes(gl);

      // ---------- Helper: objek dunia (tidak ikut skala pohon) ----------
      const world = (mesh, color, matrix, ow = 0.3) =>
        drawList.push([
          { mesh, color, spec: 0.05, ow, shade: SHADE },
          matrix,
          1,
        ]);

      const worldSphere = (color, [x, y, z], [sx, sy, sz], ow = 0.3) =>
        world(
          meshes.sphere,
          color,
          multiply(translate(x, y, z), scale(sx, sy, sz)),
          ow,
        );

      // ---------- Helper: objek pohon (koordinat lokal, asal = dasar pohon) ----------
      const root = multiply(
        translate(TREE_POSITION[0], TREE_POSITION[1], TREE_POSITION[2]),
        scale(TREE_SCALE, TREE_SCALE, TREE_SCALE),
      );
      const part = (mesh, color, local, ow) =>
        world(mesh, color, multiply(root, local), ow);

      const sphere = (color, [x, y, z], [sx, sy, sz], ow = 0.4) =>
        part(
          meshes.sphere,
          color,
          multiply(translate(x, y, z), scale(sx, sy, sz)),
          ow,
        );

      const box = (color, [x, y, z], [sx, sy, sz], tiltZ = 0, ow = 0.4) =>
        part(
          meshes.box,
          color,
          Mat4.chain(translate(x, y, z), rotateZ(tiltZ), scale(sx, sy, sz)),
          ow,
        );

      // Silinder tegak: titik (x,y,z) adalah dasar, tiltZ > 0 memiringkan ke arah -X
      const pole = (color, [x, y, z], radius, height, tiltZ = 0, ow = 0.3) =>
        part(
          meshes.cylinder,
          color,
          Mat4.chain(
            translate(x, y, z),
            rotateZ(tiltZ),
            scale(radius, height, radius),
          ),
          ow,
        );

      // Cincin luar lebih gelap memberi kesan padang rumput tak berujung
      worldSphere(COLORS.grassFar, [0, -1.1, 0], [135, 1, 135], 0.2);
      worldSphere(COLORS.grass, [0, -0.7, 0], [95, 0.7, 95], 0.25);

      // Jalan setapak dari pohon ke titik spawn karakter
      worldSphere(COLORS.path, [0, 0, 2], [2.2, 0.06, 10], 0.3);

      // Kolam kecil dengan daun teratai
      worldSphere(COLORS.water, [9, 0, 6], [3.5, 0.08, 2.5], 0.3);
      worldSphere(COLORS.lily, [8, 0.08, 5.6], [0.5, 0.05, 0.4], 0.4);
      worldSphere(COLORS.lily, [10.2, 0.08, 6.6], [0.45, 0.05, 0.4], 0.4);

      // Bukit-bukit jauh sebagai latar
      [
        [-55, -8, -60, 26],
        [10, -10, -75, 32],
        [65, -8, -50, 26],
        [-80, -8, 10, 24],
        [85, -8, 20, 26],
        [-30, -6, 70, 22],
        [40, -6, 75, 24],
      ].forEach(([x, y, z, r]) => {
        worldSphere(COLORS.grassFar, [x, y, z], [r, r * 0.65, r], 0.2);
      });

      // Pohon-pohon kecil tersebar di padang
      [
        [-20, -4],
        [22, -8],
        [-16, 14],
        [18, 16],
        [-30, -20],
        [32, 6],
      ].forEach(([x, z]) => {
        world(
          meshes.cylinder,
          COLORS.trunk,
          multiply(translate(x, 0, z), scale(0.4, 3, 0.4)),
          0.4,
        );
        worldSphere(COLORS.foliage, [x, 4.2, z], [2.2, 2.2, 2.2], 0.4);
      });

      // Semak
      [
        [-7, 4],
        [6, 9],
        [-10, 9],
        [12, -2],
        [-12, -4],
      ].forEach(([x, z]) => {
        worldSphere(COLORS.foliageDark, [x, 0.4, z], [1.1, 0.8, 1.1], 0.3);
      });

      // Bunga kecil (batang + kepala bunga), dijauhkan dari area karakter
      [
        [-5, 5, COLORS.flowerYellow],
        [-6, 6.5, COLORS.flowerRed],
        [5.5, 5, COLORS.flowerRed],
        [6.5, 6.2, COLORS.flowerWhite],
        [-8, 2, COLORS.flowerWhite],
        [8, 1, COLORS.flowerYellow],
        [-4, 9, COLORS.flowerRed],
        [3, 10, COLORS.flowerYellow],
      ].forEach(([x, z, color]) => {
        world(
          meshes.cylinder,
          COLORS.foliageDark,
          multiply(translate(x, 0, z), scale(0.03, 0.3, 0.03)),
          0,
        );
        worldSphere(color, [x, 0.34, z], [0.16, 0.16, 0.16], 0.15);
      });

      // 2. BATANG & CABANG POHON
      sphere(COLORS.trunkDark, [0, 0.4, 0], [3.4, 1.4, 3.4], 0.4); // pangkal melebar
      pole(COLORS.trunk, [0, 0, 0], 2.2, 9, 0, 0.5); // batang utama

      // Cabang menuju polong kiri dan kanan
      pole(COLORS.trunk, [-1.5, 3, 0], 0.5, 6.95, 1.04, 0.4);
      pole(COLORS.trunk, [1.5, 3, 0], 0.5, 7.46, -1.0, 0.4);

      // 3. KANOPI RAKSASA (ciri khas: massa hijau tinggi + polong menjuntai)
      sphere(COLORS.foliage, [0, 14, 0], [6.5, 9.5, 6.5], 0.5); // badan kanopi
      sphere(COLORS.foliageLight, [0.5, 21.5, 0], [3.8, 4, 3.8], 0.5); // puncak membulat

      // Polong hijau menjuntai di sisi-sisi kanopi
      sphere(COLORS.foliageDark, [-8, 10.5, 0.5], [2.6, 5, 2.6]); // kiri
      sphere(COLORS.foliageLight, [8.2, 12, -0.5], [2.7, 5.5, 2.7]); // kanan
      sphere(COLORS.foliage, [5, 8, 5], [2.4, 4.2, 2.4]); // depan-kanan
      sphere(COLORS.foliageDark, [-4.5, 9, -5.5], [2.3, 4.2, 2.3]); // belakang-kiri

      // Jendela menyala pada polong dan kanopi
      box(COLORS.window, [-8, 11.5, 2.95], [0.8, 1.1, 0.25], 0, 0.2);
      box(COLORS.window, [8.2, 13, 2.15], [0.8, 1.1, 0.25], 0, 0.2);
      box(COLORS.window, [5, 9, 7.3], [0.8, 1.1, 0.25], 0, 0.2);
      box(COLORS.window, [-2.2, 12, 5.9], [0.9, 1.3, 0.25], 0, 0.2);
      box(COLORS.window, [2.2, 15, 6.0], [0.9, 1.3, 0.25], 0, 0.2);

      // Jembatan kayu kecil + pagar di sisi kanopi
      box(COLORS.wood, [-6.6, 12.6, 2.4], [3.2, 0.25, 1.6], 0, 0.3);
      box(COLORS.wood, [-6.6, 12.93, 3.15], [3.2, 0.4, 0.1], 0, 0.2);
      box(COLORS.wood, [6.8, 14.8, 1.8], [3.2, 0.25, 1.6], 0, 0.3);
      box(COLORS.wood, [6.8, 15.13, 2.55], [3.2, 0.4, 0.1], 0, 0.2);

      // 4. PUNCAK: PERAHU + PAYUNG, CEROBONG, BENDERA
      pole(COLORS.trunk, [-2.5, 20, 0], 0.35, 5.9, 1.05, 0.3); // cabang ke perahu
      box(COLORS.wood, [-7.5, 23.2, 0], [2.6, 0.7, 1.2], 0.08, 0.3); // perahu
      pole(COLORS.trunkDark, [-7.5, 23.5, 0], 0.07, 2.2, 0, 0); // tiang payung
      sphere(COLORS.umbrella, [-7.5, 25.8, 0], [1.8, 0.5, 1.8], 0.3); // payung

      pole(COLORS.chimney, [5.5, 17, -1], 0.3, 8, 0, 0.3); // cerobong
      sphere(COLORS.chimney, [5.5, 25, -1], [0.45, 0.45, 0.45], 0.2);

      pole(COLORS.trunkDark, [8.2, 17.2, -0.5], 0.07, 3, 0, 0); // tiang bendera
      box(COLORS.flagRed, [8.9, 19.6, -0.5], [1.4, 0.8, 0.08], 0, 0.2); // bendera

      // 5. RUMAH KAYU DI PANGKAL POHON
      const houseX = -1.2;
      const houseZ = 3.3;
      box(COLORS.wall, [houseX, 1.6, houseZ], [4.4, 3.2, 3.4], 0, 0.5); // dinding
      // Atap segitiga (prisma): z lokal 0..4, jadi digeser -2 agar terpusat
      part(
        meshes.roofPrism,
        COLORS.roof,
        translate(houseX, 3.2, houseZ - 2.0),
        0.5,
      );
      box(COLORS.door, [houseX, 1.1, houseZ + 1.75], [1.1, 2.2, 0.15], 0, 0.3); // pintu
      box(
        COLORS.window,
        [houseX + 1.5, 2.0, houseZ + 1.75],
        [0.9, 0.9, 0.15],
        0,
        0.2,
      ); // jendela
    }
  }

  App.environments.TreehouseEnvironment = TreehouseEnvironment;
  window.AT = window.AT || {};
  window.AT.TreehouseEnvironment = TreehouseEnvironment;
})();
