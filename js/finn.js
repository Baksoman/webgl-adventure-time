/* =====================================================================
   finn.js - Model Finn (dari finn.html): superellipsoid, paraboloid (telinga topi),
   hyperboloid (celana), toroid (tali ransel) dan mulut Bezier - dipasang ke renderer bersama.
   Lengan memakai IK dua-ruas supaya tangan Finn bisa menuju titik dunia (menunjuk, memegang pedang).
   ===================================================================== */
(function () {
    'use strict';
    const JK = window.JK, AT = window.AT;
    const { Mat4, V3, T, S, mul } = JK;
    const PI = Math.PI, nrm = V3.norm;
    const RX = Mat4.rotationX, RY = Mat4.rotationY, RZ = Mat4.rotationZ;

    /* ---------- mesh (rumus sama dengan finn.html) ---------- */
    const pn = (nu, nv, f) => JK.gridMesh(nu, nv, (u, v) => f(u, v)[0], (u, v) => nrm(f(u, v)[1]));
    const C_ = (w, m) => { const v = Math.cos(w); return Math.sign(v) * Math.pow(Math.abs(v), m); };
    const S_ = (w, m) => { const v = Math.sin(w); return Math.sign(v) * Math.pow(Math.abs(v), m); };
    const sq = (a, b, c, e1, e2, nu = 32, nv = 18) => pn(nu, nv, (s, r) => {
        const u = -PI + 2 * PI * s, v = -PI / 2 + PI * r;
        return [[a * C_(v, e1) * C_(u, e2), b * S_(v, e1), c * C_(v, e1) * S_(u, e2)],
        [C_(v, 2 - e1) * C_(u, 2 - e2) / a, S_(v, 2 - e1) / b, C_(v, 2 - e1) * S_(u, 2 - e2) / c]];
    });
    const memo = {}, G = (...a) => memo[a] || (memo[a] = sq(...a));
    // paraboloid eliptik (telinga topi) - normal numerik
    const para = (a, c, h, flat = 0.3) => JK.gridMesh(24, 8, (s, r) => {
        const u = 2 * PI * s, rr = Math.min(r, 1 - flat);
        return [a * rr * Math.cos(u), h * (1 - r ** 3), c * rr * Math.sin(u)];
    });
    // hyperboloid 1 sheet (celana pendek)
    const hyp = (a, c, b, V) => pn(32, 10, (s, r) => {
        const u = 2 * PI * s, v = -V + 2 * V * r;
        const x = a * Math.cosh(v) * Math.cos(u), y = b * Math.sinh(v), z = c * Math.cosh(v) * Math.sin(u);
        return [[x, y, z], [x / (a * a), -y / (b * b), z / (c * c)]];
    });
    // toroid lintasan elips (tali ransel)
    const torus = (az, ay, r) => pn(40, 10, (s, w) => {
        const u = 2 * PI * s, v = 2 * PI * w, Qz = az * Math.cos(u), Qy = ay * Math.sin(u);
        const nz = ay * Math.cos(u), ny = az * Math.sin(u), l = Math.hypot(nz, ny), Nz = nz / l, Ny = ny / l, cv = Math.cos(v), sv = Math.sin(v);
        return [[r * sv, Qy + r * cv * Ny, Qz + r * cv * Nz], [sv, cv * Ny, cv * Nz]];
    });
    // mulut: permukaan antara dua kurva Bezier kubik, menempel di ellipsoid wajah
    const bz = (p, s) => { const m = 1 - s; return [0, 1].map(k => m * m * m * p[0][k] + 3 * m * m * s * p[1][k] + 3 * m * s * s * p[2][k] + s * s * s * p[3][k]); };
    const FA = 0.26, FB = 0.22, FC = 0.11;
    const patch = (Uc, Lc, zo) => pn(20, 6, (s, w) => {
        const u = bz(Uc, s), l = bz(Lc, s);
        const x = u[0] + (l[0] - u[0]) * (-0.14 + 1.24 * w), y = u[1] + (l[1] - u[1]) * (-0.14 + 1.24 * w);
        const zz = FC * Math.sqrt(Math.max(0, 1 - (x / FA) ** 2 - (y / FB) ** 2));
        return [[x, y, zz + zo], [x / (FA * FA), y / (FB * FB), zz / (FC * FC)]];
    });
    const patchIn = (Uc, Lc, zo) => pn(20, 6, (s, w) => {
        const u = bz(Uc, s), l = bz(Lc, s);
        const x = u[0] + (l[0] - u[0]) * w, y = u[1] + (l[1] - u[1]) * w;
        const zz = FC * Math.sqrt(Math.max(0, 1 - (x / FA) ** 2 - (y / FB) ** 2));
        return [[x, y, zz + zo], [x / (FA * FA), y / (FB * FB), zz / (FC * FC)]];
    });
    const MU = [[-0.12, -0.02], [-0.14, -0.095], [0.14, -0.095], [0.12, -0.02]];
    const ML = [[-0.12, 0], [-0.08, -0.035], [0.08, -0.035], [0.12, 0]];
    const M = { mOut: patch(MU, ML, 0.004), mIn: patchIn(MU, ML, 0.012), ear: para(0.1, 0.1, 0.14), short: hyp(0.05, 0.05, 0.2, 0.4), strap: torus(0.25, 0.08, 0.02) };

    /* ---------- bahan ---------- */
    const hx = (c) => { const n = parseInt(c.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
    const K = {
        skin: hx('#f8cfb0'), limb: hx('#f4d2b8'), hat: hx('#f2f3f7'), shirt: hx('#1a8ee0'), shorts: hx('#1b55c2'),
        sock: hx('#ffffff'), shoe: hx('#131316'), green: hx('#4fae3a'), dgreen: hx('#3b8a2a'), strap: hx('#7fd04c'),
        mouth: hx('#8a1f2b'), eye: hx('#0c0c0e')
    };
    const mk = AT.mk;
    const I = {
        legMesh: mk(G(0.05, 0.415, 0.05, 0.2, 1, 16, 10), K.limb, 0.1, 0.36),
        sock: mk(G(0.055, 0.1, 0.055, 0.2, 1, 20, 10), K.sock, 0.1, 0.45),
        shoe: mk(G(0.1, 0.085, 0.17, 1, 1), K.shoe, 0.4, 0.45),
        short: mk(M.short, K.shorts, 0.1, 0.55),
        hips: mk(G(0.39, 0.12, 0.21, 0.9, 1), K.shorts, 0.1, 0.55),
        torso: mk(G(0.4, 0.38, 0.22, 0.18, 1, 36, 14), K.shirt, 0.1, 0.55),
        pack: mk(G(0.37, 0.37, 0.15, 0.6, 0.5), K.green, 0.1, 0.55),
        pack2: mk(G(0.1, 0.1, 0.05, 0.35, 0.5), K.dgreen, 0.1, 0.55),
        strap: mk(M.strap, K.strap, 0.2, 0.36),
        shoulder: mk(G(0.05, 0.075, 0.05, 1, 1, 20, 12), K.shirt, 0.1, 0.45),
        sleeve: mk(G(0.05, 0.09, 0.05, 0.2, 1, 20, 8), K.shirt, 0.1, 0.45),
        uarm: mk(G(0.05, 0.17, 0.05, 0.2, 1, 16, 8), K.limb, 0.1, 0.36),
        elbow: mk(G(0.05, 0.05, 0.05, 1, 1, 16, 10), K.limb, 0.1, 0.36),
        farm: mk(G(0.05, 0.2, 0.05, 0.2, 1, 16, 8), K.limb, 0.1, 0.36),
        hand: mk(G(0.05, 0.085, 0.05, 1, 1, 20, 12), K.limb, 0.1, 0.36),
        neck: mk(G(0.09, 0.1, 0.09, 0.3, 1, 16, 8), K.limb, 0.1, 0.36),
        hat: mk(G(0.36, 0.3, 0.22, 0.22, 0.7, 40, 56), K.hat, 0.25, 0.64),
        ear: mk(M.ear, K.hat, 0.25, 0.55),
        face: mk(G(FA, FB, FC, 1, 1, 40, 24), K.skin, 0.2, 0.45),
        eye: mk(G(0.022, 0.034, 0.025, 1, 1, 12, 8), K.eye, 0.6, 0),
        mOut: mk(M.mOut, K.eye, 0, 0), mIn: mk(M.mIn, K.mouth, 0.2, 0)
    };

    /* ---------- IK dua ruas ---------- */
    const L1 = 0.5, L2 = 0.5;
    function ik(Sh, Tg, pole) {
        let d = V3.sub(Tg, Sh), dist = V3.len(d);
        const maxR = L1 + L2 - 0.002;
        if (dist > maxR) { d = V3.mul(d, maxR / dist); dist = maxR; }
        if (dist < 0.1) { d = V3.mul(V3.norm(d), 0.1); dist = 0.1; }
        const dn = V3.mul(d, 1 / dist);
        const a = (L1 * L1 - L2 * L2 + dist * dist) / (2 * dist), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
        let pp = V3.sub(pole, V3.mul(dn, V3.dot(pole, dn)));
        pp = V3.len(pp) < 1e-4 ? [0, 0, -1] : V3.norm(pp);
        const E = V3.add(Sh, V3.add(V3.mul(dn, a), V3.mul(pp, h)));
        return { E, H: V3.add(Sh, d) };
    }
    // matriks anggota badan yang menjuntai ke -Y lokal, diarahkan ke 'dir'
    function limb(o, dir) {
        const y = V3.mul(V3.norm(dir), -1);
        let x = V3.cross(y, [0, 0, 1]);
        if (V3.len(x) < 0.25) x = V3.cross(y, [1, 0, 0]);
        x = V3.norm(x);
        return Mat4.fromBasis(o, x, y, V3.cross(x, y));
    }

    class FinnActor {
        constructor() { this.reset(); }
        reset() { this.st = { t: 0, nextBlink: 1.6, blinkStart: -9 }; this.handW = { L: [0, 0, 0], R: [0, 0, 0] }; this.headW = [0, 0, 0]; }

        /* c: x,y,z,yaw,scale | placeMat | bob,twist,lean,sway | hy,ht,hp (kepala) | walkPh | lr,ll |
           armL/armR = {w:[x,y,z] dunia | l:[x,y,z] lokal, pole:[..]} | mouth (1 = normal) | eyeK */
        frame(dt, c, list) {
            const s = this.st; s.t += dt;
            const sc = c.scale || 1;
            const Pl = c.placeMat || Mat4.chain(T(c.x || 0, c.y || 0, c.z || 0), RY(c.yaw || 0), S(sc, sc, sc));
            let bob = c.bob || 0, twist = c.twist || 0, lr = c.lr || 0, ll = c.ll || 0;
            const walking = c.walkPh !== undefined;
            let swR = 0, swL = 0;
            if (walking) {
                const sn = Math.sin(c.walkPh);
                lr = sn * 0.55; ll = -sn * 0.55; bob += Math.abs(Math.cos(c.walkPh)) * 0.04; twist += sn * 0.12;
                swR = -sn * 0.55; swL = sn * 0.55;
            }
            const root = T(0, bob, 0);
            const hip0 = mul(Pl, mul(root, T(0, 1.5, 0)));
            const B = Mat4.chain(Pl, root, T(0, 1.5, 0), RY(twist), RX(c.lean || 0), RZ(c.sway || 0), T(0, -1.5, 0));
            const push = (it, m) => list.push([it, m, 1]);

            // kaki (FK seperti aslinya)
            for (const sd of [1, -1]) {
                const hip = mul(hip0, mul(T(sd * 0.29, 0.05, 0), RX(sd > 0 ? lr : ll)));
                push(I.legMesh, mul(hip, T(0, -0.665 + 0.0, 0)));
                push(I.sock, mul(hip, T(0, -1.18, 0)));
                push(I.shoe, mul(hip, T(0, -1.36, 0.05)));
                push(I.short, mul(hip, T(0, -0.175, 0)));
            }
            push(I.hips, hip0);
            push(I.torso, mul(B, T(0, 1.88, 0)));
            push(I.pack, mul(B, T(0, 1.93, -0.35)));
            push(I.pack2, mul(B, T(0, 1.78, -0.5)));
            for (const sd of [1, -1]) push(I.strap, mul(B, mul(T(sd * 0.36, 2.15, -0.13), RY(sd * 0.2))));

            // lengan dengan IK
            let invB = null;
            for (const sd of [1, -1]) {
                const sh = [sd * 0.39, 2.15, 0], key = sd > 0 ? 'armR' : 'armL', a = c[key];
                let tg, pole = [sd * 0.5, -0.3, -0.7];
                if (a && a.w) { invB = invB || Mat4.invert(B); tg = Mat4.point(invB, a.w); }
                else if (a && a.l) tg = a.l;
                else {
                    const ang = sd > 0 ? swR : swL;
                    tg = [sh[0] + sd * 0.1, sh[1] - 0.9 * Math.cos(ang), sh[2] + 0.9 * Math.sin(ang) + 0.03];
                    if (walking) pole = [sd * 0.2, -0.3, -1];
                }
                if (a && a.pole) pole = a.pole;
                const r = ik(sh, tg, pole);
                const u = V3.sub(r.E, sh), f = V3.sub(r.H, r.E);
                const A = mul(B, limb(sh, u)), E = mul(B, limb(r.E, f));
                push(I.shoulder, A);
                push(I.sleeve, mul(A, T(0, -0.085, 0)));
                push(I.uarm, mul(A, T(0, -0.335, 0)));
                push(I.elbow, E);
                push(I.farm, mul(E, T(0, -0.2, 0)));
                push(I.hand, mul(E, T(0, -0.42, 0)));
                this.handW[sd > 0 ? 'R' : 'L'] = Mat4.point(B, V3.add(r.E, V3.mul(V3.norm(f), 0.46)));
            }

            // kepala
            if (c.blink === undefined && s.t > s.nextBlink) { s.blinkStart = s.t; s.nextBlink = s.t + 2 + Math.random() * 3; }
            let blink = 1; const bp = (s.t - s.blinkStart) / 0.14;
            if (c.blink !== undefined) blink = c.blink; else if (bp >= 0 && bp <= 1) blink = 1 - 0.9 * Math.sin(PI * bp);
            const Hm = Mat4.chain(B, T(0, 2.2, 0), RY(c.hy || 0), RZ(c.ht || 0), RX(c.hp || 0), T(0, -2.2, 0));
            push(I.neck, mul(Hm, T(0, 2.2, 0)));
            push(I.hat, mul(Hm, T(0, 2.48, 0)));
            for (const sd of [1, -1]) push(I.ear, mul(Hm, T(sd * 0.27, 2.76, 0)));
            const F = mul(Hm, T(0, 2.45, 0.18));
            push(I.face, F);
            const ek = (c.eyeK || 1) * blink;
            for (const sd of [1, -1]) push(I.eye, mul(F, mul(T(sd * 0.1, 0.07, 0.085), S(1, Math.max(0.08, ek), 1))));
            const mo = Math.max(0.35, c.mouth === undefined ? 1 : c.mouth);
            const Fm = Mat4.chain(F, T(0, -0.03, 0), S(1, mo, 1), T(0, 0.03, 0));
            push(I.mOut, Fm); push(I.mIn, Fm);
            this.headW = Mat4.point(Hm, [0, 2.6, 0]);
            this.B = B;
            AT.shadow(list, Pl[12], Pl[14], 0.5 * sc, 0.38 * sc);
        }
    }
    AT.FinnActor = FinnActor;
})();
