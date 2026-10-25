/* =====================================================================
   jake.js - INTI JAKE (diambil dari jake.js asli): math, config, shapes, gl, audio, particles,
   scene (badan + morph + mode + lengan), anim. UI, dunia kastil, interaksi mouse dan main-loop lama
   TIDAK disertakan - digantikan oleh jake-actor.js + story.js.
   Semua modul berbagi satu namespace: JK (window.JK).
   ===================================================================== */
(function () {
'use strict';
// ================= modul: math.js =================
    /* =====================================================================
       math.js - Utilitas matematika: skalar, vektor 3D, dan matriks 4x4
       (ditulis manual tanpa library; matriks disimpan column-major seperti WebGL)
       Semua modul berbagi satu namespace global: JK
       ===================================================================== */
    'use strict';
    const JK = {};
    window.JK = JK;   // opsional: memudahkan debugging dari console browser

    const clamp = (x, a, b) => Math.min(Math.max(x, a), b);
    // smoothstep: 0 di a, 1 di b, halus di antaranya
    const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
    const lerpArr = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
    const lerp1 = (a, b, t) => a + (b - a) * t;

    const V3 = {
        add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
        sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
        mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
        dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
        cross: (a, b) => [
            a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0]
        ],
        len: (a) => Math.hypot(a[0], a[1], a[2]),
        norm: (a) => {
            const l = Math.hypot(a[0], a[1], a[2]) || 1;
            return [a[0] / l, a[1] / l, a[2] / l];
        },
        lerp: (a, b, t) => [
            a[0] + (b[0] - a[0]) * t,
            a[1] + (b[1] - a[1]) * t,
            a[2] + (b[2] - a[2]) * t
        ]
    };

    const Mat4 = {
        identity: () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),

        // transformasi sebuah titik oleh matriks
        point: (m, p) => [
            m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
            m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
            m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]
        ],

        // hasil = a * b  (b diterapkan lebih dulu ke vertex)
        multiply: (a, b) => {
            const o = new Float32Array(16);
            for (let c = 0; c < 4; c++) {
                for (let r = 0; r < 4; r++) {
                    o[c * 4 + r] =
                        a[r] * b[c * 4] +
                        a[4 + r] * b[c * 4 + 1] +
                        a[8 + r] * b[c * 4 + 2] +
                        a[12 + r] * b[c * 4 + 3];
                }
            }
            return o;
        },
        chain: (...ms) => ms.reduce((acc, m) => Mat4.multiply(acc, m)),

        translation: (x, y, z) => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]),
        scaling: (x, y, z) => new Float32Array([x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1]),
        rotationX: (a) => {
            const c = Math.cos(a), s = Math.sin(a);
            return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]);
        },
        rotationY: (a) => {
            const c = Math.cos(a), s = Math.sin(a);
            return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);
        },
        rotationZ: (a) => {
            const c = Math.cos(a), s = Math.sin(a);
            return new Float32Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
        },

        // Matriks dari basis (sumbu X, Y, Z lokal) + titik asal
        fromBasis: (o, x, y, z) => new Float32Array([
            x[0], x[1], x[2], 0,
            y[0], y[1], y[2], 0,
            z[0], z[1], z[2], 0,
            o[0], o[1], o[2], 1
        ]),

        // Silinder satuan (jari-jari 1, panjang 1 sepanjang +Z) diregangkan dari titik a ke b
        // dengan jari-jari r. Basis dijaga right-handed supaya culling tidak terbalik.
        segment: (a, b, r) => {
            const d = V3.sub(b, a);
            const len = V3.len(d) || 1e-6;
            const z = V3.mul(d, 1 / len);
            const ref = Math.abs(z[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
            const x = V3.norm(V3.cross(ref, z));
            const y = V3.cross(z, x);
            return Mat4.fromBasis(a, V3.mul(x, r), V3.mul(y, r), V3.mul(z, len));
        },

        perspective: (fovy, aspect, near, far) => {
            const f = 1 / Math.tan(fovy / 2);
            const nf = 1 / (near - far);
            const o = new Float32Array(16);
            o[0] = f / aspect;
            o[5] = f;
            o[10] = (far + near) * nf;
            o[11] = -1;
            o[14] = 2 * far * near * nf;
            return o;
        },

        lookAt: (eye, target, up) => {
            const z = V3.norm(V3.sub(eye, target));
            const x = V3.norm(V3.cross(up, z));
            const y = V3.cross(z, x);
            return new Float32Array([
                x[0], y[0], z[0], 0,
                x[1], y[1], z[1], 0,
                x[2], y[2], z[2], 0,
                -V3.dot(x, eye), -V3.dot(y, eye), -V3.dot(z, eye), 1
            ]);
        },

        // Invers matriks 4x4 umum (dipakai untuk "menembakkan sinar" dari kursor mouse ke dunia 3D)
        invert: (m) => {
            const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3];
            const a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
            const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
            const a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
            const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10;
            const b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
            const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30;
            const b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
            let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
            if (!det) return Mat4.identity();
            det = 1 / det;
            const o = new Float32Array(16);
            o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
            o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
            o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
            o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
            o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
            o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
            o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
            o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
            o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
            o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
            o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
            o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
            o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
            o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
            o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
            o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
            return o;
        },

        // Matriks normal = inverse-transpose dari 3x3 kiri-atas model (wajib untuk skala non-uniform)
        normalMatrix: (m) => {
            const a00 = m[0], a10 = m[1], a20 = m[2];
            const a01 = m[4], a11 = m[5], a21 = m[6];
            const a02 = m[8], a12 = m[9], a22 = m[10];
            const c00 = a11 * a22 - a12 * a21;
            const c01 = -(a10 * a22 - a12 * a20);
            const c02 = a10 * a21 - a11 * a20;
            const c10 = -(a01 * a22 - a02 * a21);
            const c11 = a00 * a22 - a02 * a20;
            const c12 = -(a00 * a21 - a01 * a20);
            const c20 = a01 * a12 - a02 * a11;
            const c21 = -(a00 * a12 - a02 * a10);
            const c22 = a00 * a11 - a01 * a10;
            const det = a00 * c00 + a01 * c01 + a02 * c02;
            const id = Math.abs(det) > 1e-12 ? 1 / det : 0;
            return new Float32Array([
                c00 * id, c01 * id, c02 * id,
                c10 * id, c11 * id, c12 * id,
                c20 * id, c21 * id, c22 * id
            ]);
        }
    };

    // singkatan yang sering dipakai
    const S = Mat4.scaling, T = Mat4.translation, mul = Mat4.multiply;

    Object.assign(JK, { clamp, sstep, lerpArr, lerp1, V3, Mat4, S, T, mul });

    // ================= modul: config.js =================
    /* =====================================================================
       config.js - Konstanta yang bisa diutak-atik: warna, ukuran, kamera
       ===================================================================== */
    'use strict';

    const cfg = {
        // warna
        JAKE: [0.98, 0.73, 0.17],
        BLACK: [0.04, 0.03, 0.04],
        WHITE: [1, 1, 1],
        GRASS: [0.56, 0.79, 0.38],
        MOUTH_RED: [0.36, 0.05, 0.08],
        TONGUE: [0.90, 0.30, 0.36],
        SHADE_WARM: [0.66, 0.54, 0.58],
        SHADE_EYE: [0.84, 0.87, 0.95],
        ROCKET_LIGHT: [0.98, 0.94, 0.82], ROCKET_DARK: [0.22, 0.20, 0.21], ROCKET_BAND: [0.92, 0.42, 0.16],

        GROW_MAX: 2.4,          // skala saat "Membesar"
        OUTLINE_BASE: 0.05,     // tebal garis luar dasar (unit dunia)
        DEFAULT_CAM: { yaw: 0, pitch: 0.12, dist: 12 },
        CAM_TARGET: [0, 2.6, 0],
        // tinggi & setengah-lebar tiap mode -> dipakai kamera supaya bentuknya selalu muat di layar
        MODE_CAM: {
            car: { top: 3.4, half: 2.4 }, sword: { top: 7.7, half: 2.0 },
            ball: { top: 4.8, half: 1.8 },
            rocket: { top: 4.6, half: 3.6 }
        },
        PMAX: 180              // jumlah partikel maksimum
    };

    JK.cfg = cfg;

    const { BLACK, CAM_TARGET, DEFAULT_CAM, GRASS, GROW_MAX, JAKE, MODE_CAM, MOUTH_RED, OUTLINE_BASE, SHADE_EYE, TONGUE, WHITE } = cfg;

    // ================= modul: shapes.js =================
    /* =====================================================================
       shapes.js - Definisi bentuk (tanpa GL): badan Jake, bentuk-bentuk mode (mobil, pedang, jembatan, ...),
       permukaan tempat wajah menempel, dan tata letak mata / hidung / mulut untuk tiap mode.
       ===================================================================== */
    'use strict';

    // Badan Jake = "persegi panjang tumpul": sisi hampir lurus, bahu membulat, tanpa leher
    const BODY = {
        base: 1.55,     // tinggi dasar badan dari tanah (kaki ada di bawahnya)
        height: 3.35,
        rmax: 1.40,
        depth: 0.76,    // setengah kedalaman = 1.40 * 0.76 = 1.06 (sama dengan model 3D)
        sharpTop: 2.2,  // makin besar makin "kotak"
        sharpBot: 3.6,
        taper: 0.0
    };
    const LEG_X = 0.62;   // jarak kaki dari tengah badan

    function bodyRadius(yl) { // yl = tinggi lokal di atas dasar badan
        const t = clamp(yl / BODY.height, 0, 1);
        const s = 2 * t - 1;
        const n = s > 0 ? BODY.sharpTop : BODY.sharpBot;
        const e = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(s), n)), 1 / n);
        return BODY.rmax * e * (1 - BODY.taper * t);
    }
    // Permukaan depan badan z(x, y) dalam koordinat dunia
    function bodyZ(x, y) {
        const r = bodyRadius(y - BODY.base);
        const q = 1 - (x * x) / (r * r);
        return q > 0 ? r * BODY.depth * Math.sqrt(q) : 0;
    }

    // ------------------------------------------------------------------
    // BENTUK SASARAN untuk MORPH badan. Semua bentuk memakai grid parametrik (u, v) yang SAMA,
    // jadi titik ke-i milik Jake bisa dipindah mulus ke titik ke-i milik kap mobil, bilah pedang, dst.
    // ------------------------------------------------------------------
    const sgnp = (x, p) => Math.sign(x) * Math.pow(Math.abs(x), p);

    // Kotak membulat (superellipsoid): n = kekotakan penampang, m = kekotakan ujung atas/bawah,
    // taper = menyempit ke atas, ridge = rusuk tengah menonjol, slant = ujung atas miring, arch = melengkung
    function shapeFn(sh) {
        return (u, v) => {
            const t = 0.5 - 0.5 * Math.cos(Math.PI * v), yl = 2 * t - 1;
            const e = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(yl), sh.m)), 1 / sh.m);
            const tp = 1 - (sh.taper || 0) * t, a = 2 * Math.PI * u;
            const xn = sgnp(Math.cos(a), 2 / sh.n) * e, zn = sgnp(Math.sin(a), 2 / sh.n) * e;
            const x = sh.cx + sh.hx * tp * xn;
            let z = sh.hz * zn;
            if (sh.ridge) z *= 1 + sh.ridge * Math.exp(-Math.pow(xn * tp / 0.22, 2));
            const dxr = (x - sh.cx) / sh.hx;
            return [x, sh.cy + sh.hy * yl + (sh.slant || 0) * (x - sh.cx) * t + (sh.arch || 0) * (1 - dxr * dxr), sh.cz + z];
        };
    }
    // Paraboloid sejati: r(s) = rmax * sqrt(1 - s), s = tinggi ternormalisasi 0 (dasar) .. 1 (puncak).
    // Berbeda dari shapeFn (superellipsoid) - profil jari-jarinya kuadratik terhadap tinggi, ciri
    // khas paraboloid. taper2 = radius sisa di puncak (0 = lancip sempurna), lean = puncak condong ke +x.
    function paraboloidFn(sh) {
        return (u, v) => {
            const s = clamp(v, 0, 1), yl = 2 * s - 1, a = 2 * Math.PI * u;
            const rN = Math.sqrt(Math.max(0, 1 - s)) * (1 - (sh.taper2 || 0)) + (sh.taper2 || 0);
            const x = sh.cx + (sh.lean || 0) * s + sh.hx * rN * Math.cos(a);
            const z = sh.cz + sh.hz * rN * Math.sin(a);
            return [x, sh.cy + sh.hy * yl, z];
        };
    }
    // permukaan depan z(x, y) untuk paraboloid di atas (dipakai menempel wajah)
    function paraboloidZ(sh, x, y) {
        const yl = (y - sh.cy) / sh.hy;
        if (Math.abs(yl) >= 1) return 0;
        const s = (yl + 1) / 2;
        const rN = Math.sqrt(Math.max(0, 1 - s)) * (1 - (sh.taper2 || 0)) + (sh.taper2 || 0);
        if (rN <= 1e-4) return 0;
        const xr = (x - sh.cx - (sh.lean || 0) * s) / (sh.hx * rN);
        if (Math.abs(xr) >= 1) return 0;
        return sh.cz + sh.hz * rN * Math.sqrt(1 - xr * xr);
    }
    // Pengalih: setiap bentuk mode punya sh.kind ('paraboloid' atau superellipsoid/default)
    function modeFn(sh) { return sh.kind === 'paraboloid' ? paraboloidFn(sh) : shapeFn(sh); }
    function modeZ(sh, x, y) { return sh.kind === 'paraboloid' ? paraboloidZ(sh, x, y) : shapeZ(sh, x, y); }

    // permukaan depan z(x, y) dari bentuk di atas (untuk menempel wajah)
    function shapeZ(sh, x, y) {
        const dxr = (x - sh.cx) / sh.hx;
        if (Math.abs(dxr) >= 1) return 0;
        const yl = (y - (sh.arch || 0) * (1 - dxr * dxr) - sh.cy) / sh.hy;
        if (Math.abs(yl) >= 1) return 0;
        const e = Math.pow(1 - Math.pow(Math.abs(yl), sh.m), 1 / sh.m);
        const tp = 1 - (sh.taper || 0) * ((yl + 1) / 2);
        const xr = (x - sh.cx) / (sh.hx * tp * e);
        if (Math.abs(xr) >= 1) return 0;
        let z = sh.hz * e * Math.pow(1 - Math.pow(Math.abs(xr), sh.n), 1 / sh.n);
        if (sh.ridge) z *= 1 + sh.ridge * Math.exp(-Math.pow(xr * tp / 0.22 * e, 2));
        return sh.cz + z;
    }

    // Mobil ("Jake Cruiser"): kap mesin lebar membulat; kabin, kaca depan, dan roda ditambahkan terpisah.
    const CAR_HOOD = { cx: 0, cy: 1.30, cz: 0, hx: 1.75, hy: 0.82, hz: 1.45, n: 3.4, m: 5 };
    // Pedang: bilah lebar dengan rusuk tengah dan ujung atas miring; wajah di pangkal bilah.
    const BLADE = { cx: 0, cy: 4.85, cz: 0, hx: 1.0, hy: 2.55, hz: 0.30, n: 3.0, m: 9, taper: 0.10, ridge: 0.10, slant: -0.35 };
    // Jembatan: papan panjang yang melengkung ke atas (kedua ujung menapak tanah).
    // Perahu: lambung lonjong dengan ujung-ujung sedikit terangkat.
    // Bola: bola pantul.
    const BALL = { cx: 0, cy: 1.55, cz: 0, hx: 1.55, hy: 1.55, hz: 1.55, n: 2, m: 2 };
    // Parasut: kanopi lebar berbentuk lensa di atas.

    // Jubah "Gnome": paraboloid sejati (lebar di bawah, meruncing halus ke atas). taper2 kecil
    // menyisakan sedikit radius di puncak supaya menyambung rapi ke leher/topi.
    // Badan roket = paraboloid memanjang: pangkal lebar (y kecil, tempat thruster) membulat halus
    // ke hidung di ujung atas (taper2 disisakan supaya hidungnya bulat, bukan lancip runcing).
    // Lebih pendek & bulat (kesan gagah, bukan jarum) dibanding versi awal; taper2 lebih besar
    // supaya hidungnya membulat lembut, bukan meruncing tajam.
    const ROCKET_BODY = { cx: 0, cy: 2.0, cz: 0, hx: 1.45, hy: 1.85, hz: 1.05, taper2: 0.30, kind: 'paraboloid' };
    const MODE_SHAPES = { car: CAR_HOOD, sword: BLADE, ball: BALL, rocket: ROCKET_BODY };
    const MODE_NAMES = Object.keys(MODE_SHAPES);
    const MODES = ['jake', ...MODE_NAMES];                 // urutan ini = urutan bobot (wts)
    const zOf = { jake: bodyZ };
    MODE_NAMES.forEach(n => { zOf[n] = (x, y) => modeZ(MODE_SHAPES[n], x, y); });

    function surfaceFrame(x, y, zAt = bodyZ) {
        const h = 0.01;
        const P = (xx, yy) => [xx, yy, zAt(xx, yy)];
        const p = P(x, y);
        const tx = V3.norm(V3.sub(P(x + h, y), P(x - h, y)));
        const ty0 = V3.sub(P(x, y + h), P(x, y - h));
        const n = V3.norm(V3.cross(tx, ty0));
        const ty = V3.cross(n, tx);
        return { p, tx, ty, n };
    }

    // ---- Mata: cincin hitam + putih polos (TANPA pupil, seperti di serial).
    // Tiap mode punya layout sendiri: Jake (besar di kepala), Mobil (jadi LAMPU DEPAN), Pedang (kecil di pangkal bilah), dst.
    const EYE_LAY = {
        jake:   { x: 0.70, y: 3.95, white: [0.465, 0.425, 0.30], whiteZ: -0.12, rim: [0.495, 0.455, 0.30], rimZ: -0.145 },
        car:    { x: 1.18, y: 1.10, white: [0.47, 0.47, 0.20], whiteZ: -0.08, rim: [0.53, 0.53, 0.20], rimZ: -0.10 },
        sword:  { x: 0.40, y: 3.72, white: [0.27, 0.26, 0.13], whiteZ: -0.05, rim: [0.31, 0.30, 0.13], rimZ: -0.07 },
        ball:   { x: 0.58, y: 1.95, white: [0.36, 0.35, 0.16], whiteZ: -0.06, rim: [0.405, 0.395, 0.16], rimZ: -0.08 },
        rocket: { x: 0.58, y: 2.55, white: [0.40, 0.37, 0.18], whiteZ: -0.06, rim: [0.44, 0.41, 0.18], rimZ: -0.08 }
    };
    MODES.forEach(m => { EYE_LAY[m].zAt = zOf[m]; });
    const EYE_FR = { '-1': [], '1': [] };
    [-1, 1].forEach(sd => {
        MODES.forEach(m => {
            const L = EYE_LAY[m], F = surfaceFrame(sd * L.x, L.y, L.zAt);
            EYE_FR[sd].push(Mat4.fromBasis(F.p, F.tx, F.ty, F.n));
        });
    });
    // campur banyak matriks / angka berdasarkan bobot w (urutan = MODES)
    const mixMats = (arr, w) => {
        const o = new Float32Array(16);
        for (let k = 0; k < arr.length; k++) {
            if (Math.abs(w[k]) < 1e-4) continue;
            for (let i = 0; i < 16; i++) o[i] += arr[k][i] * w[k];
        }
        return o;
    };
    const mixVals = (key, w) => {
        const first = EYE_LAY.jake[key];
        if (typeof first === 'number') {
            let r = 0;
            MODES.forEach((m, k) => { r += EYE_LAY[m][key] * w[k]; });
            return r;
        }
        const r = first.map(() => 0);
        MODES.forEach((m, k) => { EYE_LAY[m][key].forEach((v, i) => { r[i] += v * w[k]; }); });
        return r;
    };
    const eyeDims = (w) => ({
        white: mixVals('white', w), whiteZ: mixVals('whiteZ', w), rim: mixVals('rim', w), rimZ: mixVals('rimZ', w)
    });

    // ---- Moncong: dua "tiang" kuning tebal yang disatukan lengkungan (∩); hidung hitam kecil di bawah lengkungan
    const FACE = {
        arch: { top: 3.72, halfW: 0.60, bottom: 2.80, r: 0.29, sink: 0.05 },
        nose: { y: 3.37, s: [0.23, 0.125, 0.10] }
    };
    function muzzleZ(x, y) { return bodyZ(x, y); }
    const NOSE_LAY = {
        jake:   { y: 3.37, s: [0.23, 0.125, 0.10], off: 0.05 },
        car:    { y: 1.34, s: [0.36, 0.21, 0.14], off: 0.04 },
        sword:  { y: 3.20, s: [0.20, 0.12, 0.09], off: 0.04 },
        ball:   { y: 1.60, s: [0.25, 0.14, 0.11], off: 0.04 },
        rocket: { y: 2.15, s: [0.24, 0.14, 0.11], off: 0.04 }
    };
    MODES.forEach(m => { NOSE_LAY[m].zAt = zOf[m]; });

    // ---- Mulut: bentuk berubah tiap frame (buka-tutup & senyum/cemberut); titik-titiknya dicampur berdasarkan bobot mode.
    const MOUTH = { nu: 24, nv: 6 };
    const MOUTH_LAY = {
        jake:   { y: 3.23, w: 0.34, lift: 0.10, hmax: 0.30 },
        car:    { y: 0.90, w: 0.80, lift: 0.14, hmax: 0.22 },
        sword:  { y: 2.90, w: 0.50, lift: 0.10, hmax: 0.26 },
        ball:   { y: 1.22, w: 0.48, lift: 0.10, hmax: 0.26 },
        rocket: { y: 1.85, w: 0.44, lift: 0.10, hmax: 0.24 }
    };
    MODES.forEach(m => { MOUTH_LAY[m].zAt = zOf[m]; });
    // ekspresi mulut tiap mode (Jake mengikuti pose): mobil & pedang cemberut/marah, yang lain ceria
    const MODE_FACE = {
        car: { open: 0.08, smile: -1 }, sword: { open: 0.42, smile: -0.7 },
        ball: { open: 0.55, smile: 1 },
        rocket: { open: 0.40, smile: 1 }
    };
    const MODE_LID = { car: 1, sword: 1 };      // mode yang memakai kelopak marah
    const mouthThick = (L, open, u) => (0.03 + open * L.hmax) * Math.sqrt(Math.max(0, 1 - u * u));
    // titik di mulut: u = -1..1 melintang, v = 0 (bibir atas) .. 1 (bawah)
    function mouthPos(L, open, smile, u, v) {
        const x = L.w * u, top = L.y + smile * L.lift * u * u;
        const y = top - mouthThick(L, open, u) * v;
        return [x, y, L.zAt(x, y) + 0.015];
    }
    function mouthNormal(L, x, y) {
        const h = 0.01;
        const dzx = (L.zAt(x + h, y) - L.zAt(x - h, y)) / (2 * h);
        const dzy = (L.zAt(x, y + h) - L.zAt(x, y - h)) / (2 * h);
        return V3.norm([-dzx, -dzy, 1]);
    }
    // c.mp[i] = {open, smile} untuk layout ke-i; c.wts = bobot
    function mouthBlend(c) {
        const P = [], N = [];
        for (let j = 0; j <= MOUTH.nv; j++) {
            for (let i = 0; i <= MOUTH.nu; i++) {
                const u = 2 * i / MOUTH.nu - 1, v = j / MOUTH.nv;
                let p = [0, 0, 0], n = [0, 0, 0];
                MODES.forEach((m, k) => {
                    const w = c.wts[k];
                    if (Math.abs(w) < 1e-3) return;
                    const L = MOUTH_LAY[m], q = mouthPos(L, c.mp[k].open, c.mp[k].smile, u, v);
                    p = V3.add(p, V3.mul(q, w));
                    n = V3.add(n, V3.mul(mouthNormal(L, q[0], q[1]), w));
                });
                P.push(p); N.push(V3.norm(n));
            }
        }
        return { P, N };
    }

    Object.assign(JK, {
        BODY, LEG_X, bodyRadius, bodyZ, sgnp, shapeFn, shapeZ, paraboloidFn, paraboloidZ, modeFn, modeZ,
        MODE_SHAPES, MODE_NAMES, MODES, zOf, surfaceFrame,
        EYE_LAY, EYE_FR, mixMats, mixVals, eyeDims, FACE, muzzleZ, NOSE_LAY, MOUTH, MOUTH_LAY, MODE_FACE, MODE_LID,
        mouthThick, mouthPos, mouthNormal, mouthBlend
    });

    // ================= modul: gl.js =================
    /* =====================================================================
       gl.js - Konteks WebGL, shader, program langit, dan generator mesh parametrik
       ===================================================================== */
    'use strict';

    const canvas = document.getElementById('stage');
    const gl = canvas.getContext('webgl', { antialias: true, alpha: false });
    if (!gl) {
        alert('Browser Anda tidak mendukung WebGL');
        throw new Error('WebGL tidak tersedia');
    }

    // =====================================================================
    // SHADER UTAMA (toon / cel shading + outline metode "inverted hull" + RIM LIGHT tipis)
    // =====================================================================
    const vsSource = `
        attribute vec3 aPosition;
        attribute vec3 aNormal;
        uniform mat4 uModelMatrix;
        uniform mat4 uViewMatrix;
        uniform mat4 uProjectionMatrix;
        uniform mat3 uNormalMatrix;
        uniform float uOutline;       // 0 = pass isi, >0 = tebal outline (unit dunia)
        varying vec3 vNormal;
        varying vec3 vWorldPos;
        void main() {
            vec3 n = normalize(uNormalMatrix * aNormal);
            vec4 wp = uModelMatrix * vec4(aPosition, 1.0);
            wp.xyz += n * uOutline;   // pass outline: dorong vertex sepanjang normal
            vWorldPos = wp.xyz;
            vNormal = n;
            gl_Position = uProjectionMatrix * uViewMatrix * wp;
        }
    `;

    const fsSource = `
        precision mediump float;
        varying vec3 vNormal;
        varying vec3 vWorldPos;
        uniform vec3 uColor;
        uniform vec3 uLightDir;       // arah MENUJU cahaya (world space)
        uniform vec3 uEye;            // posisi kamera (world space)
        uniform float uSpec;          // kekuatan highlight (0 = matte)
        uniform float uUnlit;         // 1 = warna datar tanpa lighting
        uniform float uAlpha;
        uniform float uToon;          // 1 = toon, 0 = shading halus
        uniform float uIsOutline;     // 1 = pass outline
        uniform float uRim;           // 1 = rim light aktif
        uniform vec3 uShade;          // pengali warna area bayangan (toon)
        uniform vec4 uCutA;           // (pusat x, setengah lebar, y min, y max): outline dibuang di area ini
        uniform vec4 uCutB;
        void main() {
            if (uIsOutline > 0.5) {
                if (abs(vWorldPos.x - uCutA.x) < uCutA.y && vWorldPos.y > uCutA.z && vWorldPos.y < uCutA.w) discard;
                if (abs(vWorldPos.x - uCutB.x) < uCutB.y && vWorldPos.y > uCutB.z && vWorldPos.y < uCutB.w) discard;
                gl_FragColor = vec4(0.07, 0.05, 0.06, 1.0);
                return;
            }
            if (uUnlit > 0.5) {
                gl_FragColor = vec4(uColor, uAlpha);
                return;
            }
            vec3 n = normalize(vNormal);
            vec3 L = normalize(uLightDir);
            vec3 V = normalize(uEye - vWorldPos);
            float ndl = dot(n, L);

            vec3 col;
            float sp = pow(max(dot(n, normalize(L + V)), 0.0), 48.0);
            if (uToon > 0.5) {
                vec3 shade = uColor * uShade;
                vec3 mid   = uColor * 0.90;
                vec3 lit   = min(uColor * 1.08, vec3(1.0));
                col = mix(shade, mid, smoothstep(0.02, 0.07, ndl));
                col = mix(col, lit, smoothstep(0.58, 0.64, ndl));
                sp = step(0.55, sp);
            } else {
                col = uColor * (0.42 + 0.66 * max(ndl, 0.0));
                sp = sp * 0.8;
            }
            // RIM LIGHT: pita cahaya tipis di tepi siluet yang menghadap cahaya, supaya bentuk Jake
            // terpisah jelas dari latar. Dibuat "keras" (smoothstep sempit) agar tetap bergaya kartun.
            float rimD = 1.0 - max(dot(n, V), 0.0);
            float rimBand = smoothstep(0.66, 0.74, rimD) * clamp(ndl + 0.5, 0.0, 1.0);
            col = mix(col, vec3(1.0, 0.97, 0.78), rimBand * 0.6 * uRim);
            col = mix(col, vec3(1.0), sp * uSpec);
            gl_FragColor = vec4(col, uAlpha);
        }
    `;

    function compileShader(type, source) {
        const s = gl.createShader(type);
        gl.shaderSource(s, source);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
            const msg = gl.getShaderInfoLog(s);
            console.error('Shader error:', msg);
            alert('Shader error:\n' + msg);
        }
        return s;
    }
    function makeProgram(vs, fs, attribs) {
        const p = gl.createProgram();
        gl.attachShader(p, compileShader(gl.VERTEX_SHADER, vs));
        gl.attachShader(p, compileShader(gl.FRAGMENT_SHADER, fs));
        attribs.forEach((a, i) => gl.bindAttribLocation(p, i, a));   // lokasi atribut dipastikan 0,1,...
        gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) console.error('Link error:', gl.getProgramInfoLog(p));
        return p;
    }

    const program = makeProgram(vsSource, fsSource, ['aPosition', 'aNormal']);
    gl.useProgram(program);
    const aPos = 0, aNorm = 1;
    gl.enableVertexAttribArray(aPos);
    gl.enableVertexAttribArray(aNorm);

    const U = {};
    ['uModelMatrix', 'uViewMatrix', 'uProjectionMatrix', 'uNormalMatrix', 'uOutline',
        'uColor', 'uLightDir', 'uEye', 'uSpec', 'uUnlit', 'uAlpha', 'uToon', 'uIsOutline', 'uRim', 'uShade', 'uCutA', 'uCutB']
        .forEach(n => { U[n] = gl.getUniformLocation(program, n); });

    // =====================================================================
    // LANGIT: segitiga layar-penuh, gradien + matahari + awan kartun yang bergerak (semua di fragment shader)
    // =====================================================================
    const skyVS = `
        attribute vec2 aP;
        varying vec2 vUV;
        void main() { vUV = aP * 0.5 + 0.5; gl_Position = vec4(aP, 0.9999, 1.0); }
    `;
    const skyFS = `
        precision mediump float;
        varying vec2 vUV;
        uniform float uHor;       // tinggi garis cakrawala di layar (0..1)
        uniform float uAspect;
        uniform float uTime;
        uniform float uYaw;       // sudut orbit kamera -> awan bergeser (parallax)
        uniform vec3 uColHor, uColMid, uColTop;   // palet musiman (dicampur di JS dari world.js)
        uniform float uSun;       // kekuatan matahari (0..1, redup saat musim dingin)
        uniform float uDark;      // pengali gelap tambahan (musim dingin/malam)
        float circ(vec2 p, vec2 c, float r) { return length(p - c) - r; }
        // awan = 3 lingkaran bergabung dengan dasar rata (jarak bertanda, negatif = di dalam)
        float cloud(vec2 p, vec2 c, float s) {
            p = (p - c) / s;
            float d = min(min(circ(p, vec2(-0.55, 0.0), 0.45), circ(p, vec2(0.0, 0.18), 0.6)), circ(p, vec2(0.6, 0.0), 0.42));
            d = max(d, -p.y - 0.30);
            return d * s;
        }
        vec3 addCloud(vec3 col, vec2 p, float x0, float yo, float sc, float sp, float par) {
            float span = 2.6 * uAspect;
            float cx = mod(x0 * uAspect + uTime * sp + uYaw * par, span) - 0.3 * uAspect;
            vec2 c = vec2(cx, uHor + yo);
            float d = cloud(p, c, sc);
            float a = smoothstep(0.004, -0.004, d);
            col = mix(col, vec3(1.0), a);
            float shade = smoothstep(0.0, -0.09 * sc * 4.0, (p.y - c.y) + 0.25 * sc) * a;   // dasar awan sedikit kebiruan
            return mix(col, vec3(0.83, 0.92, 1.0), shade * 0.85);
        }
        void main() {
            vec2 p = vec2(vUV.x * uAspect, vUV.y);
            float t = clamp((vUV.y - uHor) / (1.0 - uHor + 0.001), 0.0, 1.0);
            vec3 col = mix(uColHor, uColMid, smoothstep(0.0, 0.32, t));
            col = mix(col, uColTop, smoothstep(0.22, 1.0, t));
            col *= 1.0 - 0.45 * uDark;
            // matahari + cahaya lembut di sekitarnya (meredup saat musim dingin)
            vec2 sunP = vec2(0.17 * uAspect, uHor + 0.30);
            float ds = length(p - sunP);
            col += vec3(1.0, 0.88, 0.55) * smoothstep(0.42, 0.0, ds) * 0.28 * uSun;
            col = mix(col, vec3(1.0, 0.96, 0.62), smoothstep(0.066, 0.058, ds) * uSun);
            // awan-awan dengan kecepatan & ukuran berbeda
            col = addCloud(col, p, 0.10, 0.34, 0.075, 0.010, 0.30);
            col = addCloud(col, p, 0.55, 0.50, 0.105, 0.006, 0.20);
            col = addCloud(col, p, 0.85, 0.24, 0.060, 0.014, 0.40);
            col = addCloud(col, p, 0.32, 0.62, 0.085, 0.008, 0.25);
            col = addCloud(col, p, 0.72, 0.42, 0.070, 0.011, 0.35);
            gl_FragColor = vec4(col, 1.0);
        }
    `;
    const skyProg = makeProgram(skyVS, skyFS, ['aP']);
    const skyU = {};
    ['uHor', 'uAspect', 'uTime', 'uYaw', 'uColHor', 'uColMid', 'uColTop', 'uSun', 'uDark']
        .forEach(n => { skyU[n] = gl.getUniformLocation(skyProg, n); });
    const skyBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, skyBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);   // 1 segitiga menutupi layar

    // palette = { hor:[r,g,b], mid:[...], top:[...], sun, dark } - dari JK.world.skyPalette(zw)
    function drawSky(hor, aspect, time, yaw, palette) {
        gl.useProgram(skyProg);
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);
        gl.uniform1f(skyU.uHor, hor);
        gl.uniform1f(skyU.uAspect, aspect);
        gl.uniform1f(skyU.uTime, time);
        gl.uniform1f(skyU.uYaw, yaw);
        gl.uniform3fv(skyU.uColHor, palette.hor);
        gl.uniform3fv(skyU.uColMid, palette.mid);
        gl.uniform3fv(skyU.uColTop, palette.top);
        gl.uniform1f(skyU.uSun, palette.sun);
        gl.uniform1f(skyU.uDark, palette.dark);
        gl.bindBuffer(gl.ARRAY_BUFFER, skyBuf);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);
        gl.useProgram(program);
    }

    // =====================================================================
    // GENERATOR GEOMETRI PARAMETRIK
    // =====================================================================
    // Urutan indeks segitiga untuk grid (uSeg x vSeg); arah winding dikoreksi lewat normal.
    function gridIndices(P, N, uSeg, vSeg) {
        const idx = [];
        const stride = uSeg + 1;
        const pushTri = (a, b, c) => {
            const g = V3.cross(V3.sub(P[b], P[a]), V3.sub(P[c], P[a]));
            const navg = V3.add(V3.add(N[a], N[b]), N[c]);
            if (V3.dot(g, navg) < 0) idx.push(a, c, b);
            else idx.push(a, b, c);
        };
        for (let j = 0; j < vSeg; j++) {
            for (let i = 0; i < uSeg; i++) {
                const a = j * stride + i, b = a + 1, c = a + stride, d = c + 1;
                pushTri(a, c, b);
                pushTri(b, c, d);
            }
        }
        return idx;
    }

    // Hitung titik + normal + indeks sebuah grid parametrik TANPA upload ke GPU (dipakai juga untuk morph)
    function gridData(uSeg, vSeg, fn, analyticNormal) {
        const P = [], N = [];
        const e = 1e-4;
        let vote = 0;

        for (let j = 0; j <= vSeg; j++) {
            const v = j / vSeg;
            const vc = Math.min(Math.max(v, 0.003), 0.997); // hindari kutub (degenerate)
            const ring = [];
            for (let i = 0; i <= uSeg; i++) {
                const u = i / uSeg;
                const p = fn(u, v);
                let n;
                if (analyticNormal) {
                    n = analyticNormal(u, v, p);
                } else {
                    const du = V3.sub(fn(u + e, vc), fn(u - e, vc));
                    const dv = V3.sub(fn(u, vc + e), fn(u, vc - e));
                    n = V3.norm(V3.cross(du, dv));
                }
                P.push(p);
                N.push(n);
                if (i < uSeg) ring.push(p);
            }
            if (!analyticNormal && j > 0 && j < vSeg) {
                const c = [0, 0, 0];
                ring.forEach(p => { c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; });
                const k = 1 / ring.length;
                const center = [c[0] * k, c[1] * k, c[2] * k];
                for (let i = 0; i < uSeg; i++) {
                    const idx = j * (uSeg + 1) + i;
                    vote += V3.dot(N[idx], V3.sub(P[idx], center));
                }
            }
        }
        if (vote < 0) {
            for (let i = 0; i < N.length; i++) N[i] = V3.mul(N[i], -1);
        }
        return { P, N, idx: gridIndices(P, N, uSeg, vSeg) };
    }

    function gridMesh(uSeg, vSeg, fn, analyticNormal) {
        const g = gridData(uSeg, vSeg, fn, analyticNormal);
        return uploadMesh(g.P, g.N, g.idx);
    }

    function fillBuffers(P, N) {
        const pos = new Float32Array(P.length * 3);
        const nor = new Float32Array(N.length * 3);
        P.forEach((p, i) => { pos[i * 3] = p[0]; pos[i * 3 + 1] = p[1]; pos[i * 3 + 2] = p[2]; });
        N.forEach((n, i) => { nor[i * 3] = n[0]; nor[i * 3 + 1] = n[1]; nor[i * 3 + 2] = n[2]; });
        return { pos, nor };
    }

    function uploadMesh(P, N, idx, dynamic = false) {
        if (P.length > 65535) throw new Error('Mesh terlalu besar untuk indeks 16-bit');
        const { pos, nor } = fillBuffers(P, N);
        const usage = dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW;

        const pBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, pBuf);
        gl.bufferData(gl.ARRAY_BUFFER, pos, usage);

        const nBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, nBuf);
        gl.bufferData(gl.ARRAY_BUFFER, nor, usage);

        const iBuf = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuf);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);

        return { pBuf, nBuf, iBuf, count: idx.length };
    }

    // Mesh yang titik-titiknya diperbarui tiap frame (mulut)
    function updateMesh(m, P, N) {
        const { pos, nor } = fillBuffers(P, N);
        gl.bindBuffer(gl.ARRAY_BUFFER, m.pBuf);
        gl.bufferData(gl.ARRAY_BUFFER, pos, gl.DYNAMIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, m.nBuf);
        gl.bufferData(gl.ARRAY_BUFFER, nor, gl.DYNAMIC_DRAW);
    }
    // Versi cepat: isi buffer dari Float32Array yang dipakai ulang (tanpa alokasi) - dipakai lengan
    function updateMeshRaw(m, pos, nor) {
        gl.bindBuffer(gl.ARRAY_BUFFER, m.pBuf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, pos);
        gl.bindBuffer(gl.ARRAY_BUFFER, m.nBuf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, nor);
    }

    // Bola satuan (radius 1) - dipakai ulang lewat skala model
    function sphereMesh(uSeg = 48, vSeg = 32) {
        return gridMesh(uSeg, vSeg, (u, v) => {
            const th = Math.PI * v, ph = 2 * Math.PI * u;
            return [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
        }, (u, v, p) => p);
    }

    // Silinder satuan terbuka (r = 1, z dari 0..1). Ujungnya ditutup bola oleh pemanggil.
    function cylinderMesh(uSeg = 14) {
        return gridMesh(uSeg, 2, (u, v) => {
            const a = 2 * Math.PI * u;
            return [Math.cos(a), Math.sin(a), v];
        }, (u, v, p) => [p[0], p[1], 0]);
    }

    // Kepala palu: silinder tertutup dengan tepi membulat (superellipse). Radius 1, panjang -1..1 di sumbu Z.
    function hammerHeadMesh(n = 6) {
        return gridMesh(28, 40, (u, v) => {
            const th = Math.PI * v, c = Math.cos(th), s = Math.sin(th);
            const z = Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
            const r = Math.pow(Math.abs(s), 2 / n);
            const a = 2 * Math.PI * u;
            return [r * Math.cos(a), r * Math.sin(a), z];
        });
    }

    // Kurva Catmull-Rom yang melewati semua titik kontrol; v in [0,1]
    function catmullRom(pts) {
        const n = pts.length;
        return (v) => {
            const s = Math.min(Math.max(v, 0), 1) * (n - 1);
            const i = Math.min(Math.floor(s), n - 2);
            const t = s - i;
            const p0 = pts[Math.max(i - 1, 0)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(i + 2, n - 1)];
            return [0, 1, 2].map(k => 0.5 * (
                2 * p1[k] +
                (-p0[k] + p2[k]) * t +
                (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t * t +
                (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t * t * t));
        };
    }

    // Kurva Bezier kubik dari 4 titik kontrol
    function bezier(p, t) {
        const u = 1 - t;
        const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
        return [0, 1, 2].map(k => a * p[0][k] + b * p[1][k] + c * p[2][k] + d * p[3][k]);
    }

    // Tabung mengikuti kurva, jari-jari bisa berubah (radius(v)), kedua ujung membulat.
    // Dipakai untuk telinga, ekor, kumis berbentuk U terbalik, dan pegangan jembatan.
    function tubeMesh({ points, radius, ref = [0, 0, 1], capLen = 0.1, uSeg = 14, vSeg = 48 }) {
        const path = catmullRom(points);
        let len = 0, prev = path(0);
        for (let k = 1; k <= 50; k++) {
            const q = path(k / 50);
            len += V3.len(V3.sub(q, prev));
            prev = q;
        }
        const cl = Math.min(0.45, capLen / Math.max(len, 1e-6));
        const remap = (v) => {
            if (v < 0.15) return cl * (v / 0.15);
            if (v > 0.85) return 1 - cl * ((1 - v) / 0.15);
            return cl + (1 - 2 * cl) * ((v - 0.15) / 0.7);
        };
        const capped = (v) => {
            let r = radius(v);
            if (v < cl) { const s = 1 - v / cl; r *= Math.sqrt(Math.max(0, 1 - s * s)); }
            else if (v > 1 - cl) { const s = 1 - (1 - v) / cl; r *= Math.sqrt(Math.max(0, 1 - s * s)); }
            return r;
        };
        return gridMesh(uSeg, vSeg, (u, v0) => {
            const v = Math.min(Math.max(remap(Math.min(Math.max(v0, 0), 1)), 0), 1);
            const c = path(v);
            const T = V3.norm(V3.sub(path(Math.min(v + 0.002, 1)), path(Math.max(v - 0.002, 0))));
            const Nn = V3.norm(V3.cross(T, ref));
            const B = V3.cross(T, Nn);
            const a = 2 * Math.PI * u, r = capped(v);
            return [
                c[0] + (Math.cos(a) * Nn[0] + Math.sin(a) * B[0]) * r,
                c[1] + (Math.cos(a) * Nn[1] + Math.sin(a) * B[1]) * r,
                c[2] + (Math.cos(a) * Nn[2] + Math.sin(a) * B[2]) * r
            ];
        });
    }

    // Kerucut satuan: alas radius 1 di z=0, ujung meruncing di z=1 (dipakai duri mace, menara/puncak kastil)
    function coneMesh(uSeg = 14) {
        return gridMesh(uSeg, 6, (u, v) => {
            const a = 2 * Math.PI * u, r = 1 - v;
            return [r * Math.cos(a), r * Math.sin(a), v];
        });
    }

    // statistik render (diisi renderer, dibaca overlay FPS)
    const stats = { draws: 0 };

    Object.assign(JK, {
        canvas, gl, U, aPos, aNorm, drawSky, stats,
        gridIndices, gridData, gridMesh, uploadMesh, updateMesh, updateMeshRaw,
        sphereMesh, cylinderMesh, hammerHeadMesh, coneMesh, catmullRom, bezier, tubeMesh
    });

    // ================= modul: audio.js =================
    /* =====================================================================
       audio.js - SUARA lewat Web Audio API. Semua bunyi disintesis dari osilator & derau (noise),
       tanpa file audio. Browser baru mengizinkan suara setelah interaksi pengguna, jadi
       AudioContext dibuat saat klik / tekan tombol pertama (sfx.unlock()).
       ===================================================================== */
    'use strict';

    const AC = window.AudioContext || window.webkitAudioContext;
    let ac = null, master = null, noiseBuf = null, eng = null, on = true;

    function unlock() {
        if (!AC) return false;
        if (!ac) {
            ac = new AC();
            master = ac.createGain();
            master.gain.value = 0.35;
            master.connect(ac.destination);
            const n = ac.sampleRate;
            noiseBuf = ac.createBuffer(1, n, ac.sampleRate);
            const d = noiseBuf.getChannelData(0);
            for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
        }
        if (ac.state === 'suspended' && ac.resume) ac.resume();
        return true;
    }
    const ready = () => on && ac && ac.state !== 'closed';

    // nada tunggal dengan envelope; f1 (opsional) = frekuensi akhir (meluncur)
    function tone(f0, dur, type = 'sine', vol = 0.3, f1 = null, delay = 0) {
        if (!ready()) return;
        const t0 = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
        o.type = type;
        o.frequency.setValueAtTime(f0, t0);
        if (f1) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(vol, t0 + Math.min(0.02, dur / 4));
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(g); g.connect(master);
        o.start(t0); o.stop(t0 + dur + 0.05);
    }
    // derau (noise) yang disaring; frekuensi filter meluncur f0 -> f1
    function noise(dur, vol, ftype, f0, f1, delay = 0) {
        if (!ready()) return;
        const t0 = ac.currentTime + delay, src = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
        src.buffer = noiseBuf;
        fl.type = ftype;
        fl.frequency.setValueAtTime(f0, t0);
        fl.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(vol, t0 + Math.min(0.03, dur / 3));
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        src.connect(fl); fl.connect(g); g.connect(master);
        src.start(t0); src.stop(t0 + dur + 0.05);
    }
    // suara mesin mobil: sawtooth + lowpass yang terus berbunyi selama mode mobil aktif
    function engine(active, rpm) {
        if (!ac) return;
        if (active && on) {
            if (!eng) {
                const o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
                o.type = 'sawtooth'; f.type = 'lowpass'; f.frequency.value = 380; g.gain.value = 0.0001;
                o.connect(f); f.connect(g); g.connect(master); o.start();
                eng = { o, g };
            }
            eng.o.frequency.setTargetAtTime(48 + rpm * 40, ac.currentTime, 0.05);
            eng.g.gain.setTargetAtTime(0.10, ac.currentTime, 0.1);
        } else if (eng) {
            eng.g.gain.setTargetAtTime(0.0001, ac.currentTime, 0.08);
            eng.o.stop(ac.currentTime + 0.5);
            eng = null;
        }
    }

    const sfx = {
        unlock, engine,
        isOn: () => on,
        setOn(v) { on = v; if (!v) engine(false, 0); },
        boing(k = 1) {                          // "boing" membal: sinus meluncur + getaran (vibrato) yang meredam
            if (!ready()) return;
            const t0 = ac.currentTime, o = ac.createOscillator(), lfo = ac.createOscillator(), lg = ac.createGain(), g = ac.createGain();
            o.type = 'sine';
            o.frequency.setValueAtTime(260 * k, t0);
            o.frequency.exponentialRampToValueAtTime(520 * k, t0 + 0.12);
            o.frequency.exponentialRampToValueAtTime(200 * k, t0 + 0.7);
            lfo.frequency.value = 16;
            lg.gain.setValueAtTime(90 * k, t0);
            lg.gain.exponentialRampToValueAtTime(1, t0 + 0.7);
            lfo.connect(lg); lg.connect(o.frequency);
            g.gain.setValueAtTime(0.0001, t0);
            g.gain.linearRampToValueAtTime(0.35, t0 + 0.02);
            g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.7);
            o.connect(g); g.connect(master);
            o.start(t0); lfo.start(t0); o.stop(t0 + 0.75); lfo.stop(t0 + 0.75);
        },
        poof() { noise(0.55, 0.5, 'lowpass', 1400, 180); tone(170, 0.4, 'sine', 0.3, 60); },
        whoosh() { noise(0.35, 0.35, 'bandpass', 500, 2000); },
        thud(k = 1) { tone(130, 0.3, 'sine', 0.5 * k, 42); noise(0.15, 0.3 * k, 'lowpass', 400, 90); },
        pop() { tone(600, 0.09, 'sine', 0.25, 950); },
        clap() { noise(0.07, 0.55, 'highpass', 1500, 3000); },
        snore() { noise(0.9, 0.25, 'lowpass', 260, 110); tone(90, 0.8, 'sine', 0.12, 70); },
        gasp() { tone(400, 0.22, 'triangle', 0.3, 900); },
        honk() { tone(349, 0.4, 'square', 0.18); tone(440, 0.4, 'square', 0.18); },
        // tawa "ha-ha-ha": empat suku kata, tiap suku kata = derau napas + nada segitiga turun
        laugh() {
            for (let i = 0; i < 4; i++) {
                const d = i * 0.17, f = 340 - i * 28;
                noise(0.12, 0.28, 'bandpass', 900, 500, d);
                tone(f, 0.13, 'triangle', 0.28, f * 0.72, d);
            }
        },
        violaNote(freq, dur = 0.8) {           // nada biola: sawtooth + vibrato + lowpass
            if (!ready()) return;
            const t0 = ac.currentTime, o = ac.createOscillator(), lfo = ac.createOscillator(), lg = ac.createGain(),
                f = ac.createBiquadFilter(), g = ac.createGain();
            o.type = 'sawtooth';
            o.frequency.setValueAtTime(freq, t0);
            lfo.frequency.value = 5.5; lg.gain.value = freq * 0.012;
            lfo.connect(lg); lg.connect(o.frequency);
            f.type = 'lowpass'; f.frequency.value = 2200;
            g.gain.setValueAtTime(0.0001, t0);
            g.gain.linearRampToValueAtTime(0.16, t0 + 0.08);
            g.gain.setValueAtTime(0.16, t0 + dur * 0.75);
            g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
            o.connect(f); f.connect(g); g.connect(master);
            o.start(t0); lfo.start(t0); o.stop(t0 + dur + 0.05); lfo.stop(t0 + dur + 0.05);
        }
    };

    // ---- Efek suara tambahan untuk cerita (memakai tone/noise di atas)
    let mTimer = null, mStep = 0, mNext = 0;
    const MEL = [0, null, 4, null, 7, null, 9, 7, 4, null, 2, null, 0, null, null, null,
        5, null, 9, null, 12, null, 9, 5, 7, null, 4, null, 2, 0, 2, 4];
    const BAS = [0, 0, 5, 7];
    const hz = (n) => 261.63 * Math.pow(2, n / 12);
    function musicPump() {
        if (!ready()) return;
        const spb = 60 / 138 / 2;
        if (mNext < ac.currentTime) mNext = ac.currentTime + 0.05;
        while (mNext < ac.currentTime + 0.3) {
            const d = mNext - ac.currentTime, m = MEL[mStep % MEL.length];
            if (m !== null) tone(hz(m), spb * 1.6, 'square', 0.06, null, d);
            if (mStep % 4 === 0) tone(hz(BAS[(mStep / 4 | 0) % 4] - 24), spb * 3, 'triangle', 0.16, null, d);
            if (mStep % 2 === 1) noise(0.04, 0.05, 'highpass', 6000, 8000, d);
            mStep++; mNext += spb;
        }
    }
    Object.assign(sfx, {
        ding() { tone(988, 0.5, 'sine', 0.25); tone(1480, 0.7, 'sine', 0.18, null, 0.08); },
        crash() { noise(0.6, 0.6, 'lowpass', 2500, 120); tone(90, 0.4, 'square', 0.22, 40); },
        bonk() { tone(300, 0.18, 'square', 0.3, 90); noise(0.1, 0.3, 'lowpass', 900, 200); },
        blip(f = 300, d = 0.05) { tone(f, d, 'square', 0.06); },
        boot() { tone(220, 0.08, 'square', 0.14); tone(440, 0.1, 'square', 0.14, null, 0.09); tone(880, 0.22, 'square', 0.14, null, 0.2); },
        zap() { tone(1200, 0.12, 'sawtooth', 0.12, 300); },
        sproing() { tone(180, 0.35, 'sine', 0.3, 900); tone(900, 0.3, 'sine', 0.2, 200, 0.3); },
        tick() { tone(1500, 0.02, 'square', 0.07); },
        rocket() { noise(1.6, 0.45, 'bandpass', 300, 1800); tone(70, 1.4, 'sawtooth', 0.12, 160); },
        tada() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'square', 0.12, null, i * 0.1)); },
        sad() { tone(392, 0.25, 'triangle', 0.2, 330); tone(330, 0.4, 'triangle', 0.2, 262, 0.25); },
        music(on) {
            if (on && !mTimer && ready()) { mStep = 0; mNext = 0; mTimer = setInterval(musicPump, 80); musicPump(); }
            else if (!on && mTimer) { clearInterval(mTimer); mTimer = null; }
        }
    });
    JK.audioCtx = () => ac;


    JK.sfx = sfx;

    // ================= modul: particles.js =================
    /* =====================================================================
       particles.js - Sistem partikel umum: debu, asap, percikan, keringat, riak air,
       not musik, huruf "Z", dan efek musiman (permen, salju, daun).
       ===================================================================== */
    'use strict';

    const boxMeshP = gridMesh(20, 16, shapeFn({ cx: 0, cy: 0, cz: 0, hx: 1, hy: 1, hz: 1, n: 3.2, m: 5 }));
    const sphereLowP = sphereMesh(12, 8);
    const PMAX = JK.cfg.PMAX, parts = [];

    const PKIND = {
        dust:   { color: [0.86, 0.80, 0.62], a: 0.65, grow: 1.6, grav: -0.3, drag: 2.0, life: 0.7 },
        smoke:  { color: [0.62, 0.62, 0.66], a: 0.55, grow: 2.2, grav: -0.9, drag: 1.0, life: 1.1 },
        spark:  { color: [1.0, 0.95, 0.55], a: 1.0, grow: -0.6, grav: 5.0, drag: 0.5, life: 0.5 },
        sweat:  { color: [0.55, 0.78, 1.0], a: 0.9, grow: 0, grav: 9.0, drag: 0.2, life: 0.8 },
        ripple: { color: [0.85, 0.95, 1.0], a: 0.55, grow: 5.0, grav: 0, drag: 0, life: 1.2, flat: true },
        note:   { color: [1.0, 0.85, 0.3], a: 0.95, grow: 0, grav: -0.6, drag: 0.4, life: 1.6 },
        z:      { color: [1, 1, 1], a: 0.9, grow: 0.4, grav: -0.5, drag: 0.6, life: 2.2, glyph: 'z' },
        flame:  { color: [1.0, 0.55, 0.10], a: 0.9, grow: -0.5, grav: 0, drag: 0.9, life: 0.35 },
        candy:  { color: [1.0, 0.55, 0.80], a: 0.95, grow: 0, grav: -3.2, drag: 0.15, life: 3.2, glyph: 'candy' },
        snow:   { color: [0.95, 0.98, 1.0], a: 0.85, grow: 0, grav: -1.1, drag: 0.4, life: 4.5 },
        leaf:   { color: [0.85, 0.45, 0.12], a: 0.9, grow: 0, grav: -1.6, drag: 0.3, life: 3.6, glyph: 'leaf' }
    };
    // emit(jenis, x, y, z, jumlah, {size, vx, vy, vz, sx, sy, sz (sebaran acak), color})
    function emit(kind, x, y, z, n, o = {}) {
        const K = PKIND[kind];
        for (let i = 0; i < n; i++) {
            if (parts.length >= PMAX) parts.shift();
            const life = K.life * (0.8 + Math.random() * 0.4);
            parts.push({
                kind, x, y, z, life, max: life, size: o.size || 0.2, color: o.color || K.color, spin: Math.random() * 6.28,
                vx: (o.vx || 0) + (Math.random() - 0.5) * 2 * (o.sx === undefined ? 1 : o.sx),
                vy: (o.vy || 0) + Math.random() * (o.sy === undefined ? 1 : o.sy),
                vz: (o.vz || 0) + (Math.random() - 0.5) * 2 * (o.sz === undefined ? 1 : o.sz)
            });
        }
    }
    function step(dt) {
        for (let i = parts.length - 1; i >= 0; i--) {
            const p = parts[i], K = PKIND[p.kind];
            p.life -= dt;
            if (p.life <= 0) { parts.splice(i, 1); continue; }
            const d = Math.exp(-K.drag * dt);
            p.vx *= d; p.vz *= d; p.vy = p.vy * d - K.grav * dt;
            p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
            p.spin += dt * (K.glyph ? 1.5 : 0);
            if (K.grav > 0 && p.y < 0.03) { p.y = 0.03; p.life = Math.min(p.life, 0.05); }   // percikan/keringat lenyap saat kena tanah
            if (K.grav < 0 && p.y < 0.02 && p.vy < 0) { p.y = 0.02; p.life = Math.min(p.life, K.glyph ? 0.6 : 0.05); }   // hujan musiman mendarat
        }
    }

    // gambar semua partikel (objek unlit transparan, ditaruh di akhir daftar gambar)
    function push(list) {
        parts.forEach(p => {
            const K = PKIND[p.kind], f = p.life / p.max;
            const sz = p.size * (1 + K.grow * (1 - f)), al = K.a * Math.min(1, f * 3);
            if (sz <= 0.001) return;
            const base = Mat4Chain(p, sz);
            if (K.glyph === 'z') {                    // huruf "Z" dari 3 balok pipih
                const it = { mesh: boxMeshP, color: p.color, spec: 0, ow: 0, unlit: true, alpha: al, group: 'world' };
                list.push([it, mul(base, mul(T(0, 0.9, 0), S(1.0, 0.16, 0.12)))]);
                list.push([it, mul(base, mul(T(0, -0.9, 0), S(1.0, 0.16, 0.12)))]);
                list.push([it, mul(base, mul(JK.Mat4.rotationZ(0.73), S(1.35, 0.16, 0.12)))]);
                return;
            }
            if (K.glyph === 'candy') {                 // permen: dua bola kecil (seperti permen bulat kembar)
                const it = { mesh: sphereLowP, color: p.color, spec: 0.4, ow: 0, unlit: false, alpha: al, group: 'world', shade: [0.6, 0.5, 0.7] };
                list.push([it, mul(base, S(0.55, 0.55, 0.55))]);
                return;
            }
            if (K.glyph === 'leaf') {                  // daun: balok pipih oval yang berputar jatuh
                const it = { mesh: boxMeshP, color: p.color, spec: 0, ow: 0, unlit: true, alpha: al, group: 'world' };
                list.push([it, mul(base, S(1.0, 0.65, 0.10))]);
                return;
            }
            const it = { mesh: sphereLowP, color: p.color, spec: 0, ow: 0, unlit: true, alpha: al, group: 'world' };
            list.push([it, K.flat ? mul(T(p.x, p.y, p.z), S(sz, 0.02, sz)) : mul(T(p.x, p.y, p.z), S(sz, sz, sz))]);
        });
    }
    function Mat4Chain(p, sz) {
        return mul(T(p.x, p.y, p.z), mul(JK.Mat4.rotationZ(p.spin), S(sz, sz, sz)));
    }

    JK.particles = { emit, step, push };

    // ================= modul: scene.js =================
    /* =====================================================================
       scene.js - Membangun semua objek Jake: badan (dengan morph ke mode lain), mata, moncong,
       mulut, telinga, ekor, kaki, bagian mode (mobil/pedang/jembatan/perahu/bola/parasut/biola), dan lengan.
       ===================================================================== */
    'use strict';

    const items = [];
    function add(mesh, m, o = {}) {
        const it = Object.assign({ mesh, m, color: JAKE, spec: 0, ow: 1, unlit: false, alpha: 1, group: 'body' }, o);
        items.push(it);
        return it;
    }
    const ellipsoid = (frame, s) => Mat4.multiply(frame, S(s[0], s[1], s[2]));

    const sphere = sphereMesh();
    const sphereLow = sphereMesh(16, 10);   // untuk sambungan lengan
    const cylinder = cylinderMesh(20);
    const hammerMesh = hammerHeadMesh();
    const coneMeshU = coneMesh(14);

    // =====================================================================
    // BADAN + MORPH ke semua mode sekaligus
    // =====================================================================
    const bodyJake = gridData(72, 96, (u, v) => {
        const t = 0.5 - 0.5 * Math.cos(Math.PI * v);
        const yl = t * BODY.height;
        const r = bodyRadius(yl), a = 2 * Math.PI * u;
        return [r * Math.cos(a), BODY.base + yl, r * BODY.depth * Math.sin(a)];
    });
    const flatten = (g) => ({ P: Float32Array.from(g.P.flat()), N: Float32Array.from(g.N.flat()) });
    const BJ = flatten(bodyJake);
    const BT = {};
    MODE_NAMES.forEach(n => { BT[n] = flatten(gridData(72, 96, modeFn(MODE_SHAPES[n]))); });
    const bodyGeo = uploadMesh(bodyJake.P, bodyJake.N, bodyJake.idx, true);
    const bodyPos = new Float32Array(BJ.P.length), bodyNor = new Float32Array(BJ.N.length);
    let lastMorph = null;

    // Campur SEMUA bentuk: posisi = Jake + sum(w_i * (Bentuk_i - Jake)); normal dicampur lalu dinormalkan.
    function morphBody(w) {
        if (lastMorph && MODE_NAMES.every(n => Math.abs(w[n] - lastMorph[n]) < 1e-4)) return;
        lastMorph = Object.assign({}, w);
        const act = MODE_NAMES.filter(n => Math.abs(w[n]) > 1e-4);
        const TT = act.map(n => BT[n]), WW = act.map(n => w[n]), nA = act.length;
        for (let i = 0; i < BJ.P.length; i += 3) {
            let nx = BJ.N[i], ny = BJ.N[i + 1], nz = BJ.N[i + 2];
            let px = BJ.P[i], py = BJ.P[i + 1], pz = BJ.P[i + 2];
            for (let a = 0; a < nA; a++) {
                const t = TT[a], wa = WW[a];
                px += wa * (t.P[i] - BJ.P[i]); py += wa * (t.P[i + 1] - BJ.P[i + 1]); pz += wa * (t.P[i + 2] - BJ.P[i + 2]);
                nx += wa * (t.N[i] - BJ.N[i]); ny += wa * (t.N[i + 1] - BJ.N[i + 1]); nz += wa * (t.N[i + 2] - BJ.N[i + 2]);
            }
            const l = Math.hypot(nx, ny, nz) || 1;
            bodyPos[i] = px; bodyPos[i + 1] = py; bodyPos[i + 2] = pz;
            bodyNor[i] = nx / l; bodyNor[i + 1] = ny / l; bodyNor[i + 2] = nz / l;
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, bodyGeo.pBuf);
        gl.bufferData(gl.ARRAY_BUFFER, bodyPos, gl.DYNAMIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, bodyGeo.nBuf);
        gl.bufferData(gl.ARRAY_BUFFER, bodyNor, gl.DYNAMIC_DRAW);
    }

    // ---- Tanah & bayangan. Tanah ikut membesar sedikit (c.gs) supaya Jake raksasa tidak berdiri di luar pulau.
    add(sphere, null, {
        group: 'world', skip: true, color: GRASS, ow: 0,
        dyn: (c) => mul(T(0, -0.12, 0), S(3.9 * c.gs, 0.12, 3.9 * c.gs))
    });
    add(sphere, null, {
        group: 'world', color: [0.05, 0.14, 0.2], unlit: true, alpha: 0.24, ow: 0,
        dyn: (c) => mul(T(0, 0.0, 0.05 * c.g),
            S(Math.min(1.9 * c.g * c.wx * (1 + 0.9 * c.m.car - 0.35 * c.m.sword - 0.2 * c.m.ball), 3.6 * c.gs), 0.02,
                Math.min(1.5 * c.g * (1 + 0.6 * c.m.car - 0.45 * c.m.sword - 0.1 * c.m.ball), 3.4 * c.gs)))
    });

    // ---- Hiasan tanah yang bergeser saat Jake berjalan (efek "treadmill")
    const DECOR = [
        { x: -2.5, z: 0.0, s: [0.34, 0.20, 0.34], c: [0.36, 0.62, 0.25] },
        { x: 2.6, z: 1.6, s: [0.30, 0.18, 0.30], c: [0.36, 0.62, 0.25] },
        { x: -2.2, z: 3.0, s: [0.26, 0.16, 0.26], c: [0.42, 0.68, 0.30] },
        { x: 2.3, z: -1.4, s: [0.36, 0.22, 0.36], c: [0.36, 0.62, 0.25] },
        { x: -2.7, z: -2.2, s: [0.28, 0.17, 0.28], c: [0.42, 0.68, 0.30] },
        { x: 2.0, z: -3.0, s: [0.24, 0.15, 0.24], c: [0.42, 0.68, 0.30] },
        { x: -1.9, z: 1.5, s: [0.14, 0.10, 0.14], c: [0.95, 0.95, 0.98] },
        { x: 1.9, z: 0.1, s: [0.14, 0.10, 0.14], c: [0.98, 0.55, 0.7] }
    ];
    const SPAN = 7.0;
    DECOR.forEach(d => {
        add(sphere, null, {
            group: 'world', skip: true, color: d.c, ow: 0.6, dyn: (c) => {
                const span = SPAN * c.gs, sz = Math.sqrt(c.gs);
                const z = ((d.z * c.gs - c.dist) % span + span * 1.5) % span - span / 2;
                const k = clamp((3.2 * c.gs - Math.abs(z)) / (0.6 * c.gs), 0, 1);
                return Mat4.chain(T(d.x * c.gs, 0.0, z), S(d.s[0] * sz * k, d.s[1] * sz * k, d.s[2] * sz * k));
            }
        });
    });

    // ---- Gelombang debu di tanah saat palu menghantam
    const impactItem = add(sphere, null, {
        group: 'world', skip: true, color: [1, 1, 1], unlit: true, alpha: 0.5, ow: 0,
        vis: (c) => c.impact > 0.01,
        dyn: (c) => {
            const r = (0.35 + 0.6 * c.impact) * c.g;
            return Mat4.chain(T(c.impactPos[0], 0.03, c.impactPos[2]), S(r, 0.02, r));
        }
    });

    // ---- Badan
    const bodyItem = add(bodyGeo, Mat4.identity(), {
        ow: 1.0,
        cuts: (c) => c.mw > 0.3 ? [] : [-1, 1].map(sd =>
            [sd * LEG_X * c.wx * c.g, 0.16 * c.g, (1.3 - c.drop) * c.g, (1.95 - c.drop) * c.g])
    });

    // ---- Mata: cincin hitam + putih polos (TANPA pupil)
    [-1, 1].forEach(sd => {
        add(sphere, null, {
            color: BLACK, ow: 0, dyn: (c) =>
                Mat4.chain(c.Bm, c.eyeE[sd], T(0, 0, c.eyeD.rimZ), S(c.eyeD.rim[0], c.eyeD.rim[1] * c.eye, c.eyeD.rim[2]))
        });
        add(sphere, null, {
            color: WHITE, ow: 0, spec: 0.35, shade: SHADE_EYE, dyn: (c) =>
                Mat4.chain(c.Bm, c.eyeE[sd], T(0, 0, c.eyeD.whiteZ), S(c.eyeD.white[0], c.eyeD.white[1] * c.eye, c.eyeD.white[2]))
        });
        // Kelopak atas kuning yang miring: mata mobil & pedang terlihat MARAH; di mode Jake bisa dipakai ekspresi
        add(sphere, null, {
            ow: 0.6, vis: (c) => c.lidK > 0.03, dyn: (c) => {
                const d = c.eyeD, k = c.lidK;
                return Mat4.chain(c.Bm, c.eyeE[sd],
                    T(0, d.white[1] * 0.66 * c.eye, d.whiteZ + d.white[2] * 0.75),
                    Mat4.rotationZ(sd * c.lidAng),
                    S(d.white[0] * 1.30 * k, d.white[1] * 0.40 * k, d.white[2] * 0.55));
            }
        });
    });

    // ---- Moncong (∩) + hidung
    const A = FACE.arch;
    const ARCH = [
        [-A.halfW * 0.97, A.bottom], [-A.halfW, A.bottom + 0.32], [-A.halfW * 0.87, A.top - 0.28],
        [-A.halfW * 0.5, A.top - 0.06], [0, A.top],
        [A.halfW * 0.5, A.top - 0.06], [A.halfW * 0.87, A.top - 0.28], [A.halfW, A.bottom + 0.32],
        [A.halfW * 0.97, A.bottom]
    ];
    add(tubeMesh({
        points: ARCH.map(([x, y]) => [x, y, muzzleZ(x, y) - A.sink]),
        radius: (v) => A.r - 0.03 * (1 - Math.abs(2 * v - 1)),
        ref: [0, 0, 1], capLen: 0.22, uSeg: 20, vSeg: 70
    }), Mat4.identity(), { ow: 1.9, fade: [0, 3.3, 0.9] });

    add(sphere, null, {
        color: BLACK, ow: 0, spec: 0.7, dyn: (c) => {
            let y = 0, z = 0, sx = 0, sy = 0, sz = 0;
            MODES.forEach((m, i) => {
                const L = NOSE_LAY[m], w = c.wts[i];
                if (Math.abs(w) < 1e-3) return;
                y += w * L.y; z += w * (L.zAt(0, L.y) + L.off);
                sx += w * L.s[0]; sy += w * L.s[1]; sz += w * L.s[2];
            });
            return Mat4.chain(c.Bm, T(0, y, z), S(sx, sy, sz));
        }
    });

    // Gelembung ingus saat tidur
    add(sphere, null, {
        color: [0.85, 0.95, 1.0], ow: 0, alpha: 0.42, spec: 0.7, shade: [0.8, 0.9, 1.0],
        vis: (c) => c.bubble > 0.03 && c.wts[0] > 0.5,
        dyn: (c) => {
            const r = 0.06 + 0.5 * c.bubble;
            return Mat4.chain(c.Bm, T(0.17, FACE.nose.y - 0.03, muzzleZ(0, FACE.nose.y) + 0.10 + r * 0.75), S(r, r, r));
        }
    });

    // ---- Mulut (dinamis) + lidah + gigi
    const mouthInit = mouthBlend({ wts: MODES.map((m, i) => i === 0 ? 1 : 0), mp: MODES.map(() => ({ open: 1, smile: 1 })) });
    const mouthMesh = uploadMesh(mouthInit.P, mouthInit.N, gridIndices(mouthInit.P, mouthInit.N, MOUTH.nu, MOUTH.nv), true);
    const mouthItem = add(mouthMesh, Mat4.identity(), { color: MOUTH_RED, ow: 0, vis: () => true });

    add(sphere, null, {
        color: TONGUE, ow: 0, spec: 0.3, vis: (c) => c.mouth > 0.3 && c.wts[0] > 0.5,
        dyn: (c) => {
            const L = MOUTH_LAY.jake, mp = c.mp[0];
            const t0 = mouthThick(L, mp.open, 0), ry = 0.40 * t0;
            const yc = L.y - t0 + ry * 1.05;
            return Mat4.chain(c.Bm, T(0, yc, bodyZ(0, yc) + 0.025), S(0.09 + 0.05 * mp.open, ry, 0.03));
        }
    });
    [-0.20, -0.07, 0.07, 0.20].forEach(x => {
        const uj = x / 0.34;
        add(sphere, null, {
            color: WHITE, ow: 0, spec: 0.3, shade: SHADE_EYE, vis: (c) => c.openB > 0.14,
            dyn: (c) => {
                let pos = [0, 0, 0], hh = 0, ws = 0;
                MODES.forEach((m, k) => {
                    const w = c.wts[k];
                    if (Math.abs(w) < 1e-3) return;
                    const L = MOUTH_LAY[m], mp = c.mp[k];
                    const th = mouthThick(L, mp.open, uj), h = Math.min(0.12, 0.75 * th);
                    const q = JK.mouthPos(L, mp.open, mp.smile, uj, th > 1e-4 ? h / (2 * th) : 0);
                    pos = V3.add(pos, V3.mul(q, w)); hh += w * h; ws += w * L.w / 0.34;
                });
                return Mat4.chain(c.Bm, T(pos[0], pos[1], pos[2] + 0.015), S(0.055 * ws, Math.max(hh / 2, 1e-3), 0.035));
            }
        });
    });

    // ---- Telinga (menggantung ke bawah, bisa berayun sebagai pendulum lewat c.earA)
    [-1, 1].forEach(sd => {
        const pts = [[0.98, 4.45, -0.02], [1.20, 4.37, -0.02], [1.31, 4.16, -0.02], [1.33, 3.92, -0.02]].map(p => [p[0] * sd, p[1], p[2]]);
        const ear = tubeMesh({ points: pts, radius: (v) => 0.18 * (1 - 0.62 * v), ref: [0, 0, 1], capLen: 0.10, uSeg: 16, vSeg: 40 });
        add(ear, S(1, 1, 0.5), { ow: 0.9, fade: [sd * 1.2, 4.2, 0], hinge: [sd * 0.98, 4.45, 0], hs: sd });
    });

    // ---- Ekor
    const tailPivot = [0, 2.15, -0.9];
    add(tubeMesh({
        points: [[0, 2.15, -0.8], [0, 1.8, -1.5], [0, 1.7, -2.0], [0, 2.15, -2.2], [0, 2.65, -2.0]],
        radius: (v) => 0.17 - 0.08 * v, ref: [1, 0, 0], capLen: 0.12, uSeg: 14, vSeg: 48
    }), Mat4.identity(), { group: 'tail', ow: 0.8, fade: tailPivot });

    // ---- Kaki
    const HIP_Y = 1.85, ANKLE_Y = 0.2, LEG_L = HIP_Y - ANKLE_Y;
    [-1, 1].forEach(sd => {
        const x = sd * LEG_X, g = sd < 0 ? 'legL' : 'legR', gf = sd < 0 ? 'footL' : 'footR';
        add(cylinder, Mat4.segment([x, ANKLE_Y, 0], [x, HIP_Y, 0], 0.13), { group: g, ow: 0.7, vis: (c) => c.legK > 0.03 });
        add(sphere, Mat4.chain(T(x, 0.17, 0.42), Mat4.rotationX(-0.06), S(0.27, 0.17, 0.72)), {
            group: gf, ow: 0.7, vis: (c) => c.legK > 0.03,
            cuts: (c) => [[x * c.wx * c.g, 0.15 * c.g, 0.24 * c.g, 0.9 * c.g]]
        });
    });

    // =====================================================================
    // BAGIAN MODE (mobil, pedang, jembatan, perahu, bola, parasut) - efek "pop" saat berubah bentuk
    // =====================================================================
    const unitShape = (n, m, taper = 0) => ({ cx: 0, cy: 0, cz: 0, hx: 1, hy: 1, hz: 1, n, m, taper });
    const boxMesh = gridMesh(40, 30, shapeFn(unitShape(3.2, 5)));
    const cabinMesh = gridMesh(40, 30, shapeFn(unitShape(3.2, 5, 0.2)));
    const panelMesh = gridMesh(32, 20, shapeFn(unitShape(4, 4)));
    const wheelMesh = gridMesh(36, 20, shapeFn(unitShape(2, 6)));
    const CAR_C = [0, 1.2, 0], SWORD_C = [0, 2.3, 0];
    const MODE_ANCHOR = { car: CAR_C, sword: SWORD_C, ball: [0, 1.5, 0], rocket: [0, 2.0, 0] };
    const popM = (c, k, a) => Mat4.chain(c.Bm, T(a[0], a[1], a[2]), S(k, k, k), T(-a[0], -a[1], -a[2]));
    const addPart = (mode, mesh, m, o = {}) => add(mesh, m, Object.assign({ mode, anchor: MODE_ANCHOR[mode] }, o));

    const GLASS = [1.0, 0.93, 0.72], DARK = [0.10, 0.09, 0.10], BUMP = [0.34, 0.30, 0.30];
    addPart('car', cabinMesh, mul(T(0, 2.62, -0.2), S(1.28, 0.62, 0.95)), { ow: 1.0 });
    addPart('car', panelMesh, mul(T(0, 2.66, 0.76), S(0.98, 0.36, 0.05)), { color: GLASS, ow: 0.5 });
    [[-0.62, 2.62, [0.26, 0.26, 0.07], [0.95, 0.62, 0.12]],
        [-0.10, 2.66, [0.34, 0.28, 0.09], [0.85, 0.50, 0.14]],
        [0.42, 2.66, [0.32, 0.27, 0.09], [0.80, 0.45, 0.12]],
        [0.86, 2.60, [0.16, 0.20, 0.07], [0.80, 0.82, 0.92]]].forEach(([x, y, sz, col]) =>
        addPart('car', sphere, mul(T(x, y, 0.83), S(sz[0], sz[1], sz[2])), { color: col, ow: 0.4 }));
    addPart('car', boxMesh, mul(T(0, 0.44, 1.48), S(1.55, 0.11, 0.14)), { color: BUMP, ow: 0.6 });

    [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sz]) => {
        const pos = [sx * 1.70, 0.55, sz * 0.95];
        const base = (c, extra) => c.m.car < 0.02 ? null : mul(popM(c, c.m.car, CAR_C), mul(T(pos[0], pos[1], pos[2]), extra(c)));
        addPart('car', wheelMesh, null, { color: DARK, ow: 0.7, dyn: (c) => base(c, (cc) => Mat4.chain(Mat4.rotationX(cc.roll), Mat4.rotationZ(Math.PI / 2), S(0.55, 0.19, 0.55))) });
        addPart('car', sphere, null, { ow: 0.5, dyn: (c) => base(c, (cc) => Mat4.chain(Mat4.rotationX(cc.roll), T(sx * 0.2, 0, 0), S(0.06, 0.32, 0.32))) });
        addPart('car', sphere, null, { color: DARK, ow: 0, dyn: (c) => base(c, (cc) => Mat4.chain(Mat4.rotationX(cc.roll), T(sx * 0.24, 0.20, 0), S(0.06, 0.08, 0.08))) });
    });

    addPart('sword', boxMesh, mul(T(0, 2.10, 0), S(1.40, 0.17, 0.34)), { ow: 1.0 });
    addPart('sword', wheelMesh, mul(T(0, 1.30, 0), S(0.21, 0.65, 0.21)), { ow: 0.9 });
    addPart('sword', sphere, mul(T(0, 0.55, 0), S(0.34, 0.34, 0.34)), { ow: 0.9 });

    // ---- Mode Roket: badan paraboloid horizontal, hidung menghadap kamera (diputar di main.js).
    // Semua koordinat berikut dalam ruang badan SEBELUM diputar (paraboloid masih "berdiri": pangkal
    // lebar di y kecil = ekor/thruster, hidung membulat di y besar / y=3.85).
    const { ROCKET_LIGHT, ROCKET_DARK, ROCKET_BAND } = cfg;
    const rocketPart = (mesh, m, o = {}) => add(mesh, null, Object.assign({
        vis: (c) => c.m.rocket > 0.02,
        dyn: (c) => c.m.rocket < 0.02 ? null : mul(popM(c, c.m.rocket, MODE_ANCHOR.rocket), m)
    }, o));
    // tutup hidung krem/putih (skema cat dua-warna khas roket mainan) menutup sepertiga bagian atas
    rocketPart(sphere, mul(T(0, 3.55, 0), S(1.05, 0.85, 0.78)), { color: ROCKET_LIGHT, ow: 0.8 });
    rocketPart(sphere, mul(T(0, 3.98, 0), S(0.62, 0.55, 0.48)), { color: ROCKET_LIGHT, ow: 0.6 });
    // pita oranye di leher (batas antara badan kuning & tutup hidung krem) - aksen khas roket mainan
    rocketPart(sphere, mul(T(0, 2.95, 0), S(1.30, 0.14, 1.00)), { color: ROCKET_BAND, ow: 0.5 });
    // 3 sirip segitiga di pangkal (ekor), agak menjuntai ke belakang supaya terlihat dinamis
    [0, 1, 2].forEach(i => {
        const a = i * (2 * Math.PI / 3) + Math.PI / 6;
        const fx = Math.cos(a) * 1.30, fz = Math.sin(a) * 1.30;
        rocketPart(boxMesh, mul(T(fx, 0.30, fz), mul(Mat4.rotationY(-a), mul(Mat4.rotationX(0.35), S(0.06, 0.62, 0.40)))),
            { color: ROCKET_BAND, ow: 0.6 });
    });
    // nosel thruster: cincin logam luar + corong gelap dalam + cincin api mesin yang selalu menyala
    rocketPart(sphere, mul(T(0, -0.10, 0), S(0.95, 0.34, 0.95)), { color: [0.42, 0.40, 0.42], ow: 0.7, spec: 0.4 });
    rocketPart(sphere, mul(T(0, -0.22, 0), S(0.62, 0.24, 0.62)), { color: ROCKET_DARK, ow: 0 });
    add(sphere, null, {
        color: [1.0, 0.55, 0.15], unlit: true, alpha: 0.85, ow: 0, vis: (c) => c.m.rocket > 0.3,
        dyn: (c) => mul(popM(c, c.m.rocket, MODE_ANCHOR.rocket),
            mul(T(0, -0.32 - 0.05 * Math.sin(c.t * 20), 0), S(0.30 + 0.05 * Math.sin(c.t * 24), 0.10, 0.30 + 0.05 * Math.sin(c.t * 24))))
    });

    // Asap "poof" putih saat berubah bentuk
    const puffs = [];
    for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4, d = [Math.cos(a), 0.35 * Math.sin(2 * a + 1), Math.sin(a)];
        puffs.push(add(sphere, null, {
            group: 'world', color: [1, 1, 1], unlit: true, alpha: 0.7, ow: 0, vis: (c) => c.poof > 0.03,
            dyn: (c) => {
                const sp = (0.6 + 2.6 * (1 - c.poof)) * c.g, r = (0.45 + 0.6 * (1 - c.poof)) * c.g * (0.8 + 0.2 * Math.sin(i * 2.3));
                return Mat4.chain(T(d[0] * sp, 2.4 * c.g + d[1] * sp * 0.8, d[2] * sp), S(r, r, r));
            }
        }));
    }

    // =====================================================================
    // LENGAN "MIE" yang bisa melar
    // =====================================================================
    const ARM_SEG = { mesh: cylinder, color: JAKE, spec: 0, ow: 0.7, unlit: false, alpha: 1 };
    const ARM_JOINT = { mesh: sphereLow, color: JAKE, spec: 0, ow: 0.7, unlit: false, alpha: 1 };
    const HAND = { mesh: sphere, color: JAKE, spec: 0, ow: 0.6, unlit: false, alpha: 1 };
    const FINGER = { mesh: sphere, color: JAKE, spec: 0, ow: 0.5, unlit: false, alpha: 1 };
    const ARM_R = 0.115, ARM_N = 12;
    const HAMMER = { mesh: hammerMesh, color: JAKE, spec: 0.15, ow: 0.9, unlit: false, alpha: 1 };
    const HEAD_R = 0.46, HEAD_L = 0.66;
    const MACE_BALL = { mesh: sphere, color: JAKE, spec: 0.2, ow: 0.9, unlit: false, alpha: 1 };
    const MACE_SPIKE = { mesh: coneMeshU, color: JAKE, spec: 0.1, ow: 0.6, unlit: false, alpha: 1 };
    const MACE_R = 0.46, SPIKE_LEN = 0.38, SPIKE_R = 0.12;
    const MACE_DIRS = [];
    for (let i = 0, N = 14; i < N; i++) {
        const y = 1 - 2 * (i + 0.5) / N, rr = Math.sqrt(1 - y * y), th = i * 2.399963;
        const d = [y, rr * Math.cos(th), rr * Math.sin(th)];
        if (d[0] > -0.7) MACE_DIRS.push(d);
    }

    // wfn = transformasi POSISI titik lengan saat badan memanjang (ketebalan lengan tetap seragam).
    // simTime = waktu untuk memutar duri mace (diberikan main.js). targetOverride = titik kontrol
    // pengganti dalam RUANG DUNIA-BADAN (dipakai interact.js saat lengan ditarik mouse) - kalau ada,
    // sd TIDAK dipakai untuk mencerminkan x (titiknya sudah dalam ruang final).
    function pushArm(list, sd, P, Bm, wfn, tuck, simTime, targetOverride) {
        if (tuck > 0.92) return;
        const f = targetOverride || (sd < 0 ? P.armL : P.armR);
        const fist = sd < 0 ? P.fistL : P.fistR;
        let ctrl = targetOverride
            ? [0, 1, 2, 3].map(i => [f[i * 3], f[i * 3 + 1], f[i * 3 + 2]])
            : [0, 1, 2, 3].map(i => wfn([f[i * 3] * sd, f[i * 3 + 1], f[i * 3 + 2]]));
        if (tuck > 0.001) {
            const tp = wfn([sd * 0.3, 1.3, 0.2]), tk = sstep(0, 0.6, tuck);
            ctrl = ctrl.map(p => V3.lerp(p, tp, tk));
        }
        let plen = 0;
        for (let i = 0; i < 3; i++) plen += V3.len(V3.sub(ctrl[i + 1], ctrl[i]));
        const N = clamp(Math.round(plen / 0.17), ARM_N, 60);
        const q = [];
        for (let k = 0; k <= N; k++) q.push(bezier(ctrl, k / N));

        for (let k = 0; k < N; k++) list.push([ARM_SEG, mul(Bm, Mat4.segment(q[k], q[k + 1], ARM_R))]);
        for (let k = 1; k <= N; k++) list.push([ARM_JOINT, mul(Bm, mul(T(q[k][0], q[k][1], q[k][2]), S(ARM_R * 0.97, ARM_R * 0.97, ARM_R * 0.97)))]);

        const end = q[N];
        const Tg = V3.norm(V3.sub(end, q[N - 1]));
        const a = clamp(Math.abs(Tg[0]) * 1.5, 0, 1);
        const ref = V3.norm(V3.add(V3.mul([0, 1, 0], a), V3.mul([sd, 0, 0], 1 - a)));
        let Ud = V3.sub(ref, V3.mul(Tg, V3.dot(ref, Tg)));
        Ud = V3.len(Ud) < 1e-3 ? [0, 0, 1] : V3.norm(Ud);
        const Bd = V3.cross(Tg, Ud);

        const hm = sd > 0 ? P.hammerR : P.hammerL;
        const mm = sd > 0 ? P.maceR : P.maceL;
        const hs = 1 - clamp(Math.max(hm, mm) * 1.15, 0, 1);
        if (mm > 0.02) {
            const g = Math.pow(mm, 0.6), Rm = MACE_R * g;
            const Hc = V3.add(end, V3.mul(Tg, Rm * 0.8));
            list.push([MACE_BALL, mul(Bm, mul(T(Hc[0], Hc[1], Hc[2]), S(Rm, Rm, Rm)))]);
            const sp = sstep(0.55, 1.0, mm);
            if (sp > 0.02) {
                const spin = simTime * 9, cs = Math.cos(spin), sn = Math.sin(spin);
                MACE_DIRS.forEach(d => {
                    const dy = d[1] * cs - d[2] * sn, dz = d[1] * sn + d[2] * cs;
                    const dir = V3.norm(V3.add(V3.add(V3.mul(Tg, d[0]), V3.mul(Ud, dy)), V3.mul(Bd, dz)));
                    const a0 = V3.add(Hc, V3.mul(dir, Rm * 0.85));
                    const tip = V3.add(Hc, V3.mul(dir, Rm + SPIKE_LEN * sp));
                    list.push([MACE_SPIKE, mul(Bm, Mat4.segment(a0, tip, SPIKE_R * sp))]);
                });
            }
        }
        if (hm > 0.02) {
            const g = Math.pow(hm, 0.6), Rh = HEAD_R * g, Lh = HEAD_L * g;
            let Uh = V3.sub([1, 0, 0], V3.mul(Tg, Tg[0]));
            Uh = V3.len(Uh) < 0.25 ? V3.norm(V3.cross(Tg, [0, 0, 1])) : V3.norm(Uh);
            const B2 = V3.cross(Tg, Uh);
            const Hc = V3.add(end, V3.mul(Tg, Rh * 0.55));
            list.push([HAMMER, mul(Bm, ellipsoid(Mat4.fromBasis(Hc, B2, Tg, Uh), [Rh, Rh, Lh]))]);
        }
        if (hs < 0.02) return end;
        const C = V3.add(end, V3.mul(Tg, 0.06));
        const ps = (1 + 0.3 * fist) * hs;
        list.push([HAND, mul(Bm, ellipsoid(Mat4.fromBasis(C, Tg, Ud, Bd), [0.17 * ps, 0.145 * ps, 0.13 * ps]))]);
        [-1, 0, 1].forEach(k => {
            const ang = k * 0.30 * (1 - 0.7 * fist), ca = Math.cos(ang), sa = Math.sin(ang);
            const dir = V3.add(V3.mul(Tg, ca), V3.mul(Ud, sa));
            const up = V3.sub(V3.mul(Ud, ca), V3.mul(Tg, sa));
            const base = V3.add(V3.add(C, V3.mul(Tg, 0.08)), V3.mul(Ud, k * 0.06));
            const center = V3.add(base, V3.mul(dir, 0.07 * (1 - 0.45 * fist)));
            const s = (1 - 0.45 * fist) * hs, th = 1 + 0.6 * fist;
            list.push([FINGER, mul(Bm, ellipsoid(Mat4.fromBasis(center, dir, up, Bd), [0.095 * s, 0.042 * th, 0.038 * th]))]);
        });
        return end;   // posisi ujung tangan (ruang badan) - dipakai interact.js untuk drag
    }

    Object.assign(JK, {
        items, add, sphere, sphereLow, cylinder, boxMesh, morphBody, mouthMesh, mouthItem, bodyItem, impactItem, puffs,
        tailPivot, HIP_Y, ANKLE_Y, LEG_L, pushArm, MODE_ANCHOR, popM
    });

    // ================= modul: anim.js =================
    /* =====================================================================
       anim.js - Semua ANIMASI (idle, walk, punch, ..., viola), EKSPRESI WAJAH, dan
       fungsi pencampur pose (crossfade dua layer: Gerak + Aksi).
       Modul ini murni matematika pose - tidak menyentuh GL sama sekali.
       ===================================================================== */
    'use strict';

    // Titik kontrol Bezier lengan (sisi +X; sisi -X dicerminkan). Format: [x,y,z] x 4.
    const ARM_T = [[1.1, 3.25, 0.0], [1.9, 3.27, 0.04], [2.6, 3.25, 0.06], [3.1, 3.25, 0.06]];
    const ARM_RELAX = [[1.1, 3.25, 0.05], [1.75, 3.2, 0.1], [1.85, 2.6, 0.2], [1.85, 1.95, 0.25]];
    const ARM_GUARD = [[1.1, 3.25, 0.05], [1.95, 3.0, 0.3], [1.8, 3.25, 0.95], [1.05, 3.55, 1.15]];
    const ARM_PUNCH = [[1.1, 3.25, 0.05], [1.7, 3.35, 1.3], [1.9, 3.45, 2.9], [1.7, 3.55, 4.4]];
    const ARM_UP = [[1.1, 3.25, 0.05], [1.75, 3.65, 0.1], [1.95, 4.45, 0.15], [1.85, 5.35, 0.2]];
    const ARM_HUP = [[1.1, 3.25, 0.05], [1.9, 4.3, 0.05], [1.6, 5.3, -0.1], [0.9, 6.0, -0.2]];
    const ARM_HSLAM = [[1.1, 3.25, 0.05], [2.2, 3.9, 1.2], [1.9, 2.6, 2.6], [1.1, 1.1, 3.0]];
    const F12 = (pts) => pts.flat();
    const RELAX = F12(ARM_RELAX);

    let poseState = 1;   // 0 = T-Pose, 1 = lengan santai (dikontrol UI, dipakai idle)
    const restArm = () => lerpArr(F12(ARM_T), RELAX, poseState);
    function setPose(v) { poseState = v; }

    // ayun lengan maju/mundur (f > 0 = tangan ke depan) di sekitar bahu
    function swingArm(a, f) {
        const o = a.slice(), c = Math.cos(f), s = Math.sin(f);
        const sy = a[1], sz = a[2];
        for (let i = 1; i < 4; i++) {
            const y = a[i * 3 + 1] - sy, z = a[i * 3 + 2] - sz;
            o[i * 3 + 1] = sy + c * y + s * z;
            o[i * 3 + 2] = sz - s * y + c * z;
        }
        return o;
    }

    const basePose = () => ({
        bob: 0, lean: 0, twist: 0, sway: 0, squash: 0, tail: 0,
        mouth: 0.4, smile: 1, eye: 1, fistL: 0, fistR: 0, hammerL: 0, hammerR: 0, maceL: 0, maceR: 0,
        impact: 0, bubble: 0, beat: 0,
        legL: [0, 0, 0], legR: [0, 0, 0],          // [ayun, angkat, kemiringan telapak]
        armL: RELAX, armR: RELAX
    });

    const ANIMS = {
        idle: (t) => {
            const P = basePose(), br = Math.sin(t * 2.2);
            const sw = 0.05 * Math.sin(t * 2.2 + 0.6);
            P.squash = 0.014 * br;
            P.tail = 0.35 * Math.sin(t * 3.2);
            P.armL = swingArm(restArm(), sw);
            P.armR = swingArm(restArm(), sw);
            P.mouth = 0.5 + 0.08 * br;
            return P;
        },
        walk: (t) => {
            const P = basePose(), ph = t * 7.2, s = Math.sin(ph), c = Math.cos(ph);
            P.bob = 0.05 * Math.cos(2 * ph);
            P.lean = 0.05;
            P.twist = -0.09 * s;
            P.sway = 0.03 * c;
            P.squash = 0.012 * Math.cos(2 * ph);
            P.tail = 0.55 * Math.sin(t * 6);
            const fR = Math.max(0, c), fL = Math.max(0, -c);
            P.legR = [0.4 * s, 0.16 * fR, -0.30 * fR];
            P.legL = [-0.4 * s, 0.16 * fL, -0.30 * fL];
            P.armR = swingArm(RELAX, -0.55 * s);
            P.armL = swingArm(RELAX, 0.55 * s);
            P.mouth = 0.42 + 0.10 * Math.cos(2 * ph);
            return P;
        },
        dance: (t) => {
            const P = basePose(), ph = t * 6.4, s = Math.sin(ph);
            const up = 0.5 + 0.5 * s;
            P.bob = 0.07 * Math.abs(s);
            P.sway = 0.14 * s;
            P.twist = 0.20 * Math.cos(ph);
            P.squash = -0.03 * Math.cos(2 * ph);
            P.armR = lerpArr(swingArm(RELAX, 0.2), F12(ARM_UP), up);
            P.armL = lerpArr(swingArm(RELAX, 0.2), F12(ARM_UP), 1 - up);
            const fR = Math.max(0, s), fL = Math.max(0, -s);
            P.legR = [0.12 * s, 0.16 * fR, -0.2 * fR];
            P.legL = [-0.12 * s, 0.16 * fL, -0.2 * fL];
            P.mouth = 0.85 + 0.15 * Math.sin(ph * 3);
            P.eye = 0.85;
            P.tail = 0.7 * Math.sin(ph * 2);
            return P;
        },
        hammer: (t) => {
            const P = basePose(), per = 3.6, u = t % per;
            const rise = sstep(0.4, 1.3, u);
            const slam = Math.pow(clamp((u - 1.7) / 0.15, 0, 1), 2);
            const back = sstep(2.6, 3.3, u);
            let arm = lerpArr(RELAX, F12(ARM_HUP), rise);
            arm = lerpArr(arm, F12(ARM_HSLAM), slam);
            arm = lerpArr(arm, RELAX, back);
            P.armR = arm;
            P.hammerR = sstep(0.55, 1.1, u) * (1 - sstep(2.75, 3.2, u));

            const up = sstep(0.4, 1.3, u) * (1 - sstep(1.7, 1.85, u));
            const hit = sstep(1.68, 1.85, u) * (1 - sstep(2.2, 3.0, u));
            const thud = u > 1.85 ? Math.exp(-(u - 1.85) * 7) * Math.cos((u - 1.85) * 22) : 0;
            P.lean = -0.12 * up + 0.14 * hit;
            P.bob = -0.10 * hit - 0.05 * Math.max(0, thud);
            P.squash = 0.05 * up - 0.05 * hit - 0.05 * thud;
            P.twist = 0.12 * up - 0.10 * hit;
            P.armL = swingArm(RELAX, -0.10 * up + 0.15 * hit);
            P.legR = [-0.08 * hit, 0, 0];
            P.legL = [0.08 * hit, 0, 0];
            P.mouth = 0.4 + 0.4 * up + 0.6 * hit;
            P.smile = 1 - 0.85 * Math.max(up, hit);
            P.eye = 1 - 0.30 * up - 0.15 * hit;
            P.tail = 0.5 * Math.sin(t * 6);
            P.impact = (u > 1.85 && u < 2.55) ? (u - 1.85) / 0.7 : 0;
            return P;
        },
        mace: (t) => {
            const P = basePose(), per = 4.0, u = t % per;
            const armAt = (al) => {
                const pt = (r, f, y) => [r * Math.cos(al * f), y, r * Math.sin(al * f)];
                return [1.1, 3.25, 0.05, ...pt(1.8, 0.35, 3.1), ...pt(2.7, 0.7, 2.9), ...pt(3.2, 1.0, 2.7)];
            };
            const rise = sstep(0.4, 1.1, u);
            const out = sstep(1.5, 2.15, u);
            const back = sstep(2.5, 3.3, u);
            const fall = sstep(3.3, 3.9, u);
            const al = -0.5 + 4.1 * out - 4.1 * back;
            let arm = lerpArr(RELAX, armAt(al), rise);
            arm = lerpArr(arm, RELAX, fall);
            P.armR = arm;
            P.beat = out > 0.25 && out < 0.9 ? 1 : 0;
            P.maceR = sstep(0.5, 1.1, u) * (1 - sstep(3.3, 3.85, u));

            const ph = rise * (1 - fall);
            P.twist = ph * (0.35 - 0.7 * (al + 0.5) / 4.1);
            P.lean = 0.06 * ph;
            P.bob = -0.04 * ph;
            P.sway = 0.05 * ph * Math.sin(al);
            P.armL = swingArm(RELAX, 0.10 * ph);
            P.legR = [-0.06 * ph, 0, 0];
            P.legL = [0.06 * ph, 0, 0];
            P.mouth = 0.4 + 0.35 * ph;
            P.smile = 1 - 0.3 * ph;
            P.eye = 1 - 0.2 * ph;
            P.tail = 0.5 * Math.sin(t * 6);
            return P;
        },
    };

    // Lengan mana saja yang dikendalikan tiap animasi aksi (lengan lain tetap ikut animasi gerak)
    const ACTION_ARMS = {
        hammer: { R: 1 }, mace: { R: 1 }
    };

    // Gabungkan layer gerak (L) dan layer aksi (A)
    function composePoses(L, A, act, armW, move) {
        if (!A || act < 0.002) return L;
        const P = {};
        const lm = (a, b, t) => typeof a === 'number' ? a + (b - a) * t : lerpArr(a, b, t);
        ['mouth', 'smile', 'eye', 'tail', 'impact', 'bubble', 'beat'].forEach(k => { P[k] = lm(L[k], A[k], act); });
        ['bob', 'lean', 'twist', 'sway', 'squash'].forEach(k => { P[k] = L[k] + A[k] * act; });
        const la = act * (1 - clamp(move, 0, 1));
        P.legL = lm(L.legL, A.legL, la);
        P.legR = lm(L.legR, A.legR, la);
        ['L', 'R'].forEach(sd => {
            const t = act * armW[sd];
            P['arm' + sd] = lm(L['arm' + sd], A['arm' + sd], t);
            ['fist', 'hammer', 'mace'].forEach(k => { P[k + sd] = lm(L[k + sd], A[k + sd], t); });
        });
        return P;
    }
    function mixPoses(list) {
        const out = {};
        list.forEach(([w, P]) => {
            for (const k in P) {
                const v = P[k];
                if (typeof v === 'number') out[k] = (out[k] || 0) + v * w;
                else {
                    if (!out[k]) out[k] = new Array(v.length).fill(0);
                    for (let i = 0; i < v.length; i++) out[k][i] += v[i] * w;
                }
            }
        });
        return out;
    }

    // =====================================================================
    // EKSPRESI WAJAH: mata (skala tinggi), mulut (bukaan & senyum) + kelopak (lid = tutupan, ang = kemiringan)
    // =====================================================================
    const EXPR = {
        normal:  { eye: 1, mouth: 0.4, smile: 1, lid: 0, ang: 0 },
        senang:  { eye: 0.62, mouth: 0.75, smile: 1, lid: 0, ang: 0 },
        marah:   { eye: 0.95, mouth: 0.45, smile: -0.8, lid: 1, ang: 0.5 },
        sedih:   { eye: 0.95, mouth: 0.12, smile: -1, lid: 0.85, ang: -0.45 },
        kaget:   { eye: 1.3, mouth: 1.0, smile: 0, lid: 0, ang: 0 },
        ngambek: { eye: 0.8, mouth: 0.10, smile: -0.6, lid: 0.7, ang: 0.05 }
    };
    const AUTO_EXPR = {
        hammer: 'marah', mace: 'marah'
    };

    // Pegas kurang teredam (underdamped): melewati target sedikit lalu menetap -> efek "membal"
    function stepSpring(o, key, vkey, target, k, c, dt) {
        const n = Math.max(1, Math.ceil(dt / 0.01)), h = dt / n;
        for (let i = 0; i < n; i++) {
            o[vkey] += ((target - o[key]) * k - o[vkey] * c) * h;
            o[key] += o[vkey] * h;
        }
    }

    Object.assign(JK, {
        ANIMS, ACTION_ARMS, EXPR, AUTO_EXPR, composePoses, mixPoses, basePose, swingArm, restArm, setPose,
        RELAX, stepSpring, F12
    });

    
})();
