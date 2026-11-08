(function () {
  "use strict";

  const App = (window.App = window.App || {});
  App.environments = App.environments || {};

  const { Mat4, T: translate, S: scale, mul: multiply } = App.math;
  const { quadrics } = App.geom;
  const rotateY = Mat4.rotationY;

  function hexToRgb(hexColor) {
    const value = parseInt(hexColor.slice(1), 16);
    return [
      ((value >> 16) & 255) / 255,
      ((value >> 8) & 255) / 255,
      (value & 255) / 255,
    ];
  }

  const COLORS = {
    floor: hexToRgb("#8a5c32"),
    floorAlt: hexToRgb("#9b683a"),
    wall: hexToRgb("#56351c"),
    wallDark: hexToRgb("#3d2412"),
    beam: hexToRgb("#462a15"),
    sofaRed: hexToRgb("#c53939"),
    sofaGold: hexToRgb("#e5a532"),
    chestWood: hexToRgb("#623a1a"),
    gold: hexToRgb("#f4bc34"),
    pillowBlue: hexToRgb("#3678c2"),
  };

  const SHADE = [0.6, 0.5, 0.54];

  // Ruangan kotak: lantai ROOM_SIZE x ROOM_SIZE, berpusat di (0, 0, 0).
  const ROOM_SIZE = 19;
  const ROOM_HALF = ROOM_SIZE / 2;
  const WALL_TOP = 7.0; // tinggi dinding; atap duduk di atas ketinggian ini
  const WALL_THICKNESS = 0.6;
  // Set true kalau sisi depan (+Z, arah kamera) ingin dibuka agar pandangan ke dalam luas.
  const OPEN_FRONT = false;

  class TreehouseInsideEnvironment {
    constructor() {
      this.meshes = null;
      this.items = null;
    }

    initMeshes(gl) {
      if (this.meshes) return this.meshes;
      this.meshes = {
        box: quadrics.roundedBoxMesh(gl, 1, 1, 1, 0.06, 2),
      };
      return this.meshes;
    }

    build(gl) {
      const meshes = this.initMeshes(gl);
      const items = [];

      const world = (mesh, color, matrix, ow = 0.25, spec = 0.1) =>
        items.push([{ mesh, color, spec, ow, shade: SHADE }, matrix, 1]);

      const box = (color, [x, y, z], [sx, sy, sz], ow = 0.25) =>
        world(
          meshes.box,
          color,
          multiply(translate(x, y, z), scale(sx, sy, sz)),
          ow,
        );

      // 1. LANTAI KOTAK (papan kayu berselang-seling)
      // Alas gelap di bawah papan supaya celah antar papan tidak tembus pandang
      box(
        COLORS.wallDark,
        [0, -0.2, 0],
        [ROOM_SIZE + WALL_THICKNESS * 2, 0.1, ROOM_SIZE + WALL_THICKNESS * 2],
        0.2,
      );

      const PLANK_COUNT = Math.ceil(ROOM_SIZE / 0.9);
      const PLANK_WIDTH = ROOM_SIZE / PLANK_COUNT;
      for (let i = 0; i < PLANK_COUNT; i++) {
        const x = -ROOM_HALF + PLANK_WIDTH * (i + 0.5);
        const plankColor = i % 2 === 0 ? COLORS.floor : COLORS.floorAlt;
        box(
          plankColor,
          [x, -0.08, 0],
          [PLANK_WIDTH * 0.94, 0.16, ROOM_SIZE],
          0.2,
        );
      }

      // 2. EMPAT DINDING KAYU (rapat, papan kayu seperti lantai)
      const edge = ROOM_HALF + WALL_THICKNESS * 0.5;
      const fullLength = ROOM_SIZE + WALL_THICKNESS * 2;
      const WALL_BOTTOM = -0.25; // menyatu dengan alas lantai
      const wallTotal = WALL_TOP - WALL_BOTTOM;
      const BOARD_COUNT = Math.ceil(wallTotal / 0.9);
      const BOARD_HEIGHT = wallTotal / BOARD_COUNT;
      const SKIN = 0.06; // papan sedikit menonjol di kedua sisi agar tampak berpapan

      // Dinding = inti solid gelap (menutup semua celah) + papan kayu horizontal bersusun.
      // axis "x": dinding memanjang searah X (depan/belakang); "z": memanjang searah Z (kiri/kanan).
      const woodWall = (axis, cx, cz, length) => {
        const sizeX = axis === "x" ? length : WALL_THICKNESS;
        const sizeZ = axis === "x" ? WALL_THICKNESS : length;
        box(
          COLORS.wallDark,
          [cx, WALL_BOTTOM + wallTotal * 0.5, cz],
          [sizeX, wallTotal, sizeZ],
          0.2,
        );
        for (let i = 0; i < BOARD_COUNT; i++) {
          const y = WALL_BOTTOM + BOARD_HEIGHT * (i + 0.5);
          const boardColor = i % 2 === 0 ? COLORS.floor : COLORS.floorAlt;
          box(
            boardColor,
            [cx, y, cz],
            [
              axis === "x" ? length : WALL_THICKNESS + SKIN,
              BOARD_HEIGHT * 0.94,
              axis === "x" ? WALL_THICKNESS + SKIN : length,
            ],
            0.25,
          );
        }
      };

      // Belakang (-Z)
      woodWall("x", 0, -edge, fullLength);
      // Depan (+Z)
      if (!OPEN_FRONT) woodWall("x", 0, edge, fullLength);
      // Kiri (-X) dan kanan (+X)
      woodWall("z", -edge, 0, ROOM_SIZE);
      woodWall("z", edge, 0, ROOM_SIZE);

      // 2b. ATAP KAYU (menutup rapat seluruh ruangan, papan di sisi atas dan bawah)
      const ROOF_THICKNESS = 0.4;
      box(
        COLORS.wallDark,
        [0, WALL_TOP + ROOF_THICKNESS * 0.5, 0],
        [fullLength, ROOF_THICKNESS, fullLength],
        0.2,
      );
      const ROOF_PLANK_COUNT = Math.ceil(fullLength / 0.9);
      const ROOF_PLANK_WIDTH = fullLength / ROOF_PLANK_COUNT;
      for (let i = 0; i < ROOF_PLANK_COUNT; i++) {
        const x = -fullLength * 0.5 + ROOF_PLANK_WIDTH * (i + 0.5);
        const plankColor = i % 2 === 0 ? COLORS.floor : COLORS.floorAlt;
        // Sisi bawah (langit-langit)
        box(
          plankColor,
          [x, WALL_TOP, 0],
          [ROOF_PLANK_WIDTH * 0.94, 0.1, fullLength],
          0.25,
        );
        // Sisi atas
        box(
          plankColor,
          [x, WALL_TOP + ROOF_THICKNESS, 0],
          [ROOF_PLANK_WIDTH * 0.94, 0.1, fullLength],
          0.25,
        );
      }

      // 3. SOFA MERAH KUNING FINN & JAKE (Living Room Couch)
      const sofaX = 3.6;
      const sofaZ = -3.2;
      const sofaYaw = -0.65;
      const sofaMat = (tx, ty, tz, sx, sy, sz) =>
        Mat4.chain(
          translate(sofaX, 0, sofaZ),
          rotateY(sofaYaw),
          translate(tx, ty, tz),
          scale(sx, sy, sz),
        );

      // Dudukan & sandaran sofa merah
      world(
        meshes.box,
        COLORS.sofaRed,
        sofaMat(0, 0.45, 0, 3.4, 0.5, 1.5),
        0.3,
      );
      world(
        meshes.box,
        COLORS.sofaRed,
        sofaMat(0, 1.15, -0.6, 3.4, 1.0, 0.35),
        0.3,
      );
      // Lengan sofa kiri & kanan
      world(
        meshes.box,
        COLORS.sofaRed,
        sofaMat(-1.6, 0.75, 0, 0.38, 0.85, 1.6),
        0.3,
      );
      world(
        meshes.box,
        COLORS.sofaRed,
        sofaMat(1.6, 0.75, 0, 0.38, 0.85, 1.6),
        0.3,
      );
      // Bantal sofa kuning & biru
      world(
        meshes.box,
        COLORS.sofaGold,
        sofaMat(-0.7, 0.8, -0.3, 0.95, 0.3, 0.9),
        0.25,
      );
      world(
        meshes.box,
        COLORS.sofaGold,
        sofaMat(0.7, 0.8, -0.3, 0.95, 0.3, 0.9),
        0.25,
      );
      world(
        meshes.box,
        COLORS.pillowBlue,
        sofaMat(1.2, 0.95, -0.38, 0.5, 0.5, 0.25),
        0.25,
      );

      // 4. PETI HARTA KARUN EMAS (Treasure Chest di Sudut Ruangan)
      const chestX = -4.5;
      const chestZ = -2.8;
      const chestYaw = 0.5;
      const chestMat = (tx, ty, tz, sx, sy, sz) =>
        Mat4.chain(
          translate(chestX, 0, chestZ),
          rotateY(chestYaw),
          translate(tx, ty, tz),
          scale(sx, sy, sz),
        );
      // Badan peti
      world(
        meshes.box,
        COLORS.chestWood,
        chestMat(0, 0.45, 0, 1.7, 0.75, 1.1),
        0.3,
      );
      // Tutup peti
      world(
        meshes.box,
        COLORS.beam,
        chestMat(0, 0.9, 0, 1.75, 0.28, 1.15),
        0.3,
      );
      // Kunci gembok emas
      world(
        meshes.box,
        COLORS.gold,
        chestMat(0, 0.65, 0.58, 0.22, 0.26, 0.1),
        0.2,
        0.6,
      );

      return items;
    }

    render(drawList, gl) {
      if (!this.items) this.items = this.build(gl);
      for (let i = 0; i < this.items.length; i++) {
        drawList.push(this.items[i]);
      }
    }
  }

  App.environments.TreehouseInsideEnvironment = TreehouseInsideEnvironment;
  window.AT = window.AT || {};
  window.AT.TreehouseInsideEnvironment = TreehouseInsideEnvironment;
})();
