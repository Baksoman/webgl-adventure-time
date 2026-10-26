/* =====================================================================
   story.js - "Malam Permainan BMO yang Kacau": timeline 6 babak.
   Semua gerak karakter adalah fungsi waktu cerita t (deterministik), sehingga
   tombol restart / lompat babak / geser progress selalu menghasilkan adegan yang sama.
   ===================================================================== */
(function () {
    'use strict';
    const JK = window.JK, AT = window.AT, sfx = JK.sfx, particles = JK.particles;
    const { Mat4, V3 } = JK;
    const { clamp, lerp, seg, ease, smooth, kf, angLerp } = AT;
    const TL = AT.TL, L = AT.L;
    const T = Mat4.translation, RY = Mat4.rotationY;

    const { ACTS, WHO, SUBS, BLIP, TR, YAW, JEXPR, FEXPR, EMOTES, BEXPR, CAM, RK } = AT.StoryData;

    /* ---------------- jalur karakter ---------------- */
    function Track(keys) {
        const step = 1 / 60, n = Math.ceil(TL.total / step) + 2, D = new Float32Array(n);
        const p = (t) => kf(keys, t);
        let prev = p(0);
        for (let i = 1; i < n; i++) { const q = p(i * step); D[i] = D[i - 1] + Math.hypot(q[0] - prev[0], q[1] - prev[1]); prev = q; }
        return {
            pos: p,
            dist: (t) => { const f = clamp(t / step, 0, n - 2), i = Math.floor(f); return lerp(D[i], D[i + 1], f - i); },
            speed: (t) => { const a = p(t - 0.06), b = p(t + 0.06); return Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.12; },
            dir: (t) => { const a = p(t - 0.06), b = p(t + 0.06); return Math.atan2(b[0] - a[0], b[1] - a[1]); }
        };
    }
    const FINN = Track(TR.finn), JAKE = Track(TR.jake), BMO = Track(TR.bmo);
    const yawKey = (k, t) => kf(YAW[k], t, 'lin')[0];

    // saat-saat Jake berubah wujud (dipakai squash & stretch + semburan bintang)
    const MORPH_T = [36.3, 51.5, 89.4, 100.4, 117, 120.4, 139];
    const lookup = (arr, t, d) => { for (const r of arr) if (t >= r[0] && t < r[1]) return r[2]; return d; };

    /* ---------------- rocket ---------------- */
    const bez = (p, u) => { const m = 1 - u; return [0, 1, 2].map(k => m * m * m * p[0][k] + 3 * m * m * u * p[1][k] + 3 * m * u * u * p[2][k] + u * u * u * p[3][k]); };
    const bezD = (p, u) => { const m = 1 - u; return [0, 1, 2].map(k => 3 * m * m * (p[1][k] - p[0][k]) + 6 * m * u * (p[2][k] - p[1][k]) + 3 * u * u * (p[3][k] - p[2][k])); };

    /* ---------------- pedang dipegang Finn ---------------- */
    function swordPhi(t) {
        return lerp(0.55, -0.35, ease(seg(t, 117.5, 120.2)));
    }

    /* =====================================================================
       STORY
       ===================================================================== */
    class Story {
        constructor() {
            this.jake = new AT.JakeActor(0.55); this.finn = new AT.FinnActor(); this.bmo = new AT.BMOActor();
            this.t = 0; this.shake = 0; this.hyS = { f: 0, j: 0, b: 0 }; this.nextBlip = 0; this.prevT = 0; this.evDone = {};
            this.cam = { eye: [0, 7, 16], target: [0, 2.8, -3], fov: 42 }; this.camS = null; this.emoteList = [];
            this.acts = ACTS; this.subs = SUBS; this.who = WHO;
        }
        reset() { this.jake.reset(); this.finn.reset(); this.bmo.reset(); this.t = 0; this.prevT = 0; this.shake = 0; this.hyS = { f: 0, j: 0, b: 0 }; this.camS = null; sfx.engine(false, 0); sfx.music(false); }
        sub(t) { for (const s of SUBS) if (t >= s.t0 && t < s.t1) return s; return null; }
        actAt(t) { let a = null; for (const x of ACTS) if (t >= x.t) a = x; return a; }

        /* ---- peristiwa satu-kali (suara & guncangan) saat waktu melintasi t ---- */
        events(a, b) {
            const x = (t, fn) => { if (a < t && b >= t) fn(); };
            x(9.0, () => sfx.boot()); x(10.0, () => sfx.pop()); x(21.4, () => sfx.sad());
            x(34.4, () => sfx.gasp()); x(37.4, () => sfx.boing(1.2)); x(40.6, () => sfx.clunk && sfx.clunk());
            x(TL.hit, () => { sfx.crash(); this.shake = 0.5; }); x(TL.fall + 0.3, () => sfx.thud(0.6)); x(TL.fall + 0.55, () => sfx.thud(0.5));
            x(51.0, () => sfx.boing(0.8)); x(TL.hamStart + 1.9, () => { this.shake = 0.25; }); x(TL.hamStart + 5.5, () => { this.shake = 0.25; });
            x(67.5, () => sfx.tada()); x(TL.toyPop, () => sfx.sproing()); x(TL.snatch, () => sfx.zap());
            x(TL.hit, () => { [[4.4, -5.7], [5.7, -5.3], [5.0, -6.1], [3.7, -4.7]].forEach(q => particles.emit('dust', q[0], 0.2, q[1], 7, { size: 0.5, vy: 1.2, sy: 1, sx: 1.6, sz: 1.6 })); particles.emit('dust', 1.9, 1.8, -5.55, 8, { size: 0.5, vy: 1, sy: 1, sx: 1.4, sz: 1.2 }); });
            x(TL.toyHit, () => { const q = AT.toyState(TL.toyHit); if (q) { particles.emit('spark', q.x, q.y + 0.5, q.z, 22, { size: 0.12, vy: 3, sy: 3, sx: 3, sz: 3 }); particles.emit('dust', q.x, q.y + 0.3, q.z, 8, { size: 0.5, vy: 1, sx: 1.5, sz: 1.5 }); } });
            MORPH_T.forEach(m => x(m, () => { const q = this._jp || [0, 1, 0]; particles.emit('spark', q[0], q[1], q[2], 18, { size: 0.14, vy: 2.5, sy: 3, sx: 3, sz: 3 }); }));
            x(120.4, () => { sfx.pop(); sfx.sproing(); }); x(TL.toyHit, () => { sfx.bonk(); sfx.sproing(); this.shake = 0.45; }); x(TL.toyHit + 1.1, () => sfx.thud(0.5));
            x(TL.launch, () => sfx.rocket()); x(TL.arrive, () => sfx.tada()); x(TL.insert, () => sfx.ding());
            x(TL.dance, () => sfx.music(true)); x(TL.end + 1, () => sfx.music(false));
        }

        /* ---- bangun perintah aktor pada waktu t ---- */
        frame(dt, silent, opt) {
            const t = this.t, A = this._anchors || { jakeHandL: [3, 2, -5], jakeHandR: [3, 2, -5], finnHandR: [0, 1, 0], nose: [0, 1, 0], bmoHandR: [0, 1, 0], bmoSlot: [0, 1, 0] };
            const spk = this.sub(t);
            const fP = FINN.pos(t), jP = JAKE.pos(t), bP = BMO.pos(t);
            const toy = AT.toyState(t);
            const jc = { silent, sound: opt.sound }, fc = {}, bc = {};

            /* ----- Finn ----- */
            const fsp = FINN.speed(t);
            fc.x = fP[0]; fc.z = fP[1];
            let fyaw = yawKey('f', t); const fmv = smooth(seg(fsp, 0.3, 0.9));
            fyaw = angLerp(fyaw, FINN.dir(t), fmv);
            fc.yaw = fyaw;
            if (fsp > 0.3) fc.walkPh = FINN.dist(t) * 1.9;
            fc.mouth = spk && spk.who === 'f' ? 1 + 0.9 * Math.abs(Math.sin(t * 14)) : 1;

            /* ----- BMO ----- */
            const bsp = BMO.speed(t);
            bc.x = bP[0]; bc.z = bP[1];
            bc.yaw = angLerp(yawKey('b', t), BMO.dir(t), smooth(seg(bsp, 0.3, 0.9)));
            bc.pose = bsp > 0.3 ? AT.BMOActor.poses.walk(BMO.dist(t) * 9.5) : AT.BMOActor.poses.idle(t);
            let be = lookup(BEXPR, t, 0);
            if (spk && spk.who === 'b' && (be === 0 || be === 7)) be = Math.sin(t * 15) > 0 ? 1 : 0;
            bc.expr = be;
            bc.glow = t < 9 ? 0.4 : 1.15;
            const hopWin = (t > 31 && t < 34) || (t > 69 && t < 73) || (t > 132 && t < 135) || (t > 147 && t < 149);
            if (hopWin) bc.hop = Math.abs(Math.sin(t * 8)) * 0.1;
            if ((t > 31 && t < 34.5) || (t > 69 && t < 73) || (t > 147 && t < 149.6)) bc.pose = Object.assign({}, bc.pose, AT.BMOActor.poses.cheer(t));
            if (t >= TL.dance) { bc.pose = AT.BMOActor.poses.dance(t); bc.hop = Math.abs(Math.sin(t * 6.4)) * 0.06; }
            if (t > 85 && t < 89) bc.pose = Object.assign({}, bc.pose, { abdL: 1.0, abdR: 1.0 });   // kaget
            // BMO lebih berperan: menyoraki saat Mace, layar berdenyut mengikuti musik, loncat menangkap kaset
            if (t > 117.5 && t < 125.5) { bc.pose = Object.assign({}, bc.pose, AT.BMOActor.poses.cheer(t * 1.5)); bc.hop = (bc.hop || 0) + 0.05 * Math.abs(Math.sin(t * 7)); }
            if (t >= TL.dance) bc.glow = 1.15 + 0.5 * Math.abs(Math.sin(t * 6.4));

            /* ----- Jake: posisi & gerak dasar ----- */
            const jsp = JAKE.speed(t);
            jc.x = jP[0]; jc.z = jP[1]; jc.y = 0;
            jc.yaw = angLerp(yawKey('j', t), JAKE.dir(t), smooth(seg(jsp, 0.3, 0.9)));
            jc.loco = jsp > 0.3 ? 'walk' : 'idle';
            jc.locoClock = JAKE.dist(t) * 0.6;
            const ex = lookup(JEXPR, t, 'normal'); jc.expr = ex;
            // squash & stretch: merunduk sebelum berubah, lalu 'pop' membal setelahnya
            let sq = 1;
            for (const m of MORPH_T) {
                const u = t - m;
                if (u > -0.28 && u <= 0) sq *= 1 - 0.16 * Math.sin((u + 0.28) / 0.28 * Math.PI / 2);
                else if (u > 0 && u < 0.9) sq *= 1 + 0.2 * Math.exp(-u * 6) * Math.cos(u * 26) - 0.16 * Math.exp(-u * 40);
            }
            if (Math.abs(sq - 1) > 0.002) jc.scaleMul = sq;
            if (t >= TL.dance) jc.loco = 'dance';

            // Act 2: memanjang & menjangkau kaset
            jc.tall = t > 36.3 && t < 51.5;
            if (t > 37.0 && t < 49) {
                const k = ease(seg(t, 37.0, 39.4)) * (1 - ease(seg(t, 46.5, 49)));
                const shelfP = [4.45, 5.27, L.shelf.z + 0.1], carry = [3.9, 4.7, -5.7];
                jc.reachR = { p: V3.lerp(shelfP, carry, ease(seg(t, 40.4, 42.0))), k, bow: 0.3 };
            }
            // Act 3: palu
            if (t > 59.4 && t < 67.3) { jc.action = 'hammer'; jc.actClock = Math.max(0, t - TL.hamStart); }
            if (t >= 59.2 && t < 88.5) jc.yaw = -0.9 + (t < 62 ? 0 : 0);
            if (t >= 69 && t < 85.5) jc.yaw = -0.9 + 0.5 * ease(seg(t, 69, 72));

            /* ----- Act 4: kejar boneka (bola → mobil) ----- */
            let chasePos = null;
            if (t >= 89.4 && t < TL.a5 + 6) {
                const lag = t < 100 ? 1.7 : lerp(1.3, 0.5, seg(t, 100, 111.5));
                const run = AT.toyRun(Math.min(t - lag, TL.runEnd - 0.55));
                const k = ease(seg(t, 89.4, 91.2));
                chasePos = { x: lerp(jP[0], run.x, k), z: lerp(jP[1], run.z, k), yaw: run.yaw, dist: run.dist };
            }
            if (t >= 89.4 && t < 100.4) { jc.mode = 'ball'; }
            if (t >= 100.4 && t < 117) { jc.mode = 'car'; jc.noSpin = false; }
            if (chasePos && t < 117) {
                jc.x = chasePos.x; jc.z = chasePos.z; jc.yaw = chasePos.yaw; jc.loco = 'idle';
                jc.roll = chasePos.dist / 0.3;
                jc.expr = t < 100.4 ? 'senang' : 'marah';
            }

            /* ----- Act 5: pedang dipegang Finn ----- */
            if (t >= 117 && t < 120.4) {
                jc.mode = 'sword';
                const phi = swordPhi(t), fy = fc.yaw;
                const cy = Math.cos(fy), sy = Math.sin(fy);
                const loc = (x, y, z) => [fc.x + x * cy + z * sy, y, fc.z - x * sy + z * cy];
                const dl = [0, Math.cos(phi), Math.sin(phi)];
                const d = V3.norm([dl[0] * cy + dl[2] * sy, dl[1], -dl[0] * sy + dl[2] * cy]);
                const H = loc(0.18, 1.75, 0.72), H2 = V3.sub(H, V3.mul(d, 0.38));
                fc.armR = { w: H, pole: [0.6, -0.3, -0.5] }; fc.armL = { w: H2, pole: [-0.6, -0.3, -0.5] };
                const face = V3.norm([0.1, 0.25, 1]);
                let f = V3.sub(face, V3.mul(d, V3.dot(face, d))); f = V3.norm(f);
                const sc = 0.55 * 0.9;
                jc.placeMat = Mat4.chain(T(H[0], H[1], H[2]), Mat4.fromBasis([0, 0, 0], V3.cross(d, f), d, f), Mat4.scaling(sc, sc, sc), T(0, -1.3, 0));
                jc.swing = 0;
                jc.expr = 'ngambek';
                fc.lean = 0.1;
            }

            /* ----- Act 5b: Jake kembali & MACE (duri berputar) menghantam boneka ----- */
            if (t >= 120.4 && t < 126.4) {
                jc.x = -4.75; jc.z = -4.06; jc.yaw = -2.62; jc.loco = 'idle';
                jc.action = 'mace'; jc.actClock = Math.max(0, t - TL.maceStart);
                jc.expr = 'marah';
                const k = ease(seg(t, 122.8, 123.35)) * (1 - ease(seg(t, 124, 125.5)));
                fc.lean = 0.12; fc.mouth = t > 122.7 && t < 124.5 ? 2.2 : fc.mouth;
                fc.armR = { l: [0.55, 2.3 + 0.2 * k, 0.1], pole: [0.5, 0.3, -0.4] };
            }

            /* ----- Finn: gestur lain ----- */
            if (t > 33 && t < 37.5) fc.armR = { w: [4.6, 5.1, -6.8], pole: [0.5, 0.6, -0.2] };
            if (t > 33 && t < 37.5) { fc.hp = -0.3; }
            if (t > 59.5 && t < 68) {   // menahan kaki meja, tersentak tiap pukulan
                const leg = [2.15, 1.55, -4.75];
                fc.armR = { w: V3.add(leg, [0.12, 0, 0.1]), pole: [0.3, -0.5, 0.2] }; fc.armL = { w: V3.add(leg, [0.12, 0.25, -0.05]), pole: [-0.2, -0.5, -0.2] };
                const h1 = TL.hamStart + 1.9, h2 = TL.hamStart + 5.5;
                const flinch = Math.max(Math.exp(-(t - h1) * 6) * (t > h1), Math.exp(-(t - h2) * 6) * (t > h2));
                fc.hp = -0.4 * flinch; fc.lean = 0.25 + 0.2 * flinch; fc.mouth = 1.5 * flinch + 1;
            }
            if (t > 70 && t < 78) { fc.armR = { l: [0.6, 2.5, 0.2], pole: [0.5, 0.3, -0.5] }; fc.hy = 0.0; }          // jempol/hore
            if (t > 129 && t < 133) fc.armR = { l: [0.55, 1.85, 0.4], pole: [0.5, -0.2, -0.5] };
            if (t > 132.4 && t < 135) {  // ambil kaset di lantai
                const k = ease(seg(t, 132.4, 133.6)) * (1 - ease(seg(t, 134.1, 135.2)));
                fc.lean = 1.05 * k; fc.armR = { w: V3.lerp([fc.x - 0.4, 1.4, fc.z], [-4.85, 0.2, -3.6], k), pole: [0.4, -0.2, 0.3] };
            }
            if (t >= 135 && t < TL.attach + 0.6) fc.armR = { l: [0.55, 2.05, 0.55], pole: [0.5, 0.0, -0.4] };
            if (t > TL.attach + 0.6 && t < TL.arrive) fc.armR = { l: [0.62, 2.55, 0.15], pole: [0.5, 0.2, -0.4] };
            if (t >= TL.dance) {
                const s = Math.sin(t * 6.4), c2 = Math.cos(t * 6.4);
                fc.armR = { l: [0.55, 2.3 + 0.35 * s, 0.1], pole: [0.5, 0.3, -0.4] }; fc.armL = { l: [-0.55, 2.3 - 0.35 * s, 0.1], pole: [-0.5, 0.3, -0.4] };
                fc.bob = Math.abs(s) * 0.07; fc.twist = 0.25 * c2; fc.lr = 0.3 * s; fc.ll = -0.3 * s; fc.sway = 0.07 * s; fc.mouth = 1.8;
            }
            if (fc.x !== undefined && t > 60 && t < 67.5) fc.yaw = -1.3;

            /* ----- Act 6: roket ----- */
            let rocketPos = null, rocketDir = null;
            if (t >= 139 && t < 147.45) {
                jc.mode = 'rocket';
                jc.x = RK[0][0]; jc.z = RK[0][2]; jc.y = 0.0;
                jc.yaw = 0; jc.loco = 'idle'; jc.expr = t < 142.2 ? 'kaget' : 'senang';
                let d = [0, 1, 0.02], pos = V3.add(RK[0], [0, 0, 0]);
                if (t >= TL.launch) {
                    const u = ease(clamp((t - TL.launch) / (TL.arrive - TL.launch), 0, 1)) * 0.985 + 0.0;
                    pos = bez(RK, u); d = V3.norm(bezD(RK, Math.max(0.001, u)));
                    pos = V3.add(pos, [0, 0, 0]);
                } else {
                    const lift = 0.06 * Math.sin(t * 20) * seg(t, TL.launch - 1, TL.launch);
                    pos = [RK[0][0], RK[0][1] + lift, RK[0][2]];
                }
                rocketPos = pos; rocketDir = d;
                jc.rocketDir = d; jc.rocketFace = [0.3, 0.4, 1];
                jc.x = pos[0]; jc.y = pos[1] - 1.1; jc.z = pos[2];
                if (t >= TL.arrive) jc.y = lerp(pos[1] - 1.1, 0, seg(t, TL.arrive, TL.arrive + 0.5));
            }
            if (t >= 147.45 && t < TL.dance) {
                jc.x = RK[3][0] - 0.2; jc.z = RK[3][2] + 0.7; jc.yaw = -0.5; jc.loco = 'idle';
            }

            /* ----- ekspresi Finn + gerak 'hidup' ----- */
            for (const r of FEXPR) if (t >= r[0] && t < r[1]) { fc.eyeK = r[2]; if (!(spk && spk.who === 'f')) fc.mouth = Math.max(fc.mouth || 1, r[3]); }
            if (fsp < 0.3) {   // napas & goyang tipis saat diam
                fc.bob = (fc.bob || 0) + 0.012 * Math.sin(t * 2.4); fc.sway = (fc.sway || 0) + 0.018 * Math.sin(t * 1.3);
            }
            if (spk && spk.who === 'f' && !fc.armR && fsp < 0.3 && t < 148) {      // gestur tangan saat bicara
                const g = Math.max(0, Math.sin(t * 3.1));
                fc.armR = { l: [0.55 + 0.12 * Math.sin(t * 2.3), 1.1 + 0.9 * g, 0.4], pole: [0.5, 0, -0.4] };
                fc.hp = (fc.hp || 0) + 0.07 * Math.sin(t * 7);
            }
            // lompatan reaksi (kaget / senang)
            const hop = (t0, h) => { const u = (t - t0) / 0.55; return u > 0 && u < 1 ? h * Math.sin(Math.PI * u) : 0; };
            fc.y = hop(34.4, 0.35) + hop(41.9, 0.3) + hop(86.4, 0.45) + hop(111.6, 0.3) + hop(149.2, 0.4) + hop(73.4, 0.25) + hop(68.4, 0.2);
            bc.y = hop(146.2, 0.4) + hop(123.35, 0.3) + hop(9.3, 0.3) + hop(46.3, 0.25) + hop(80.7, 0.3) + hop(106.0, 0.2) + hop(131.5, 0.3);
            if (spk && spk.who === 'b' && bsp < 0.3) bc.hop = (bc.hop || 0) + 0.035 * Math.abs(Math.sin(t * 10));

            /* ----- tatapan kepala ----- */
            const pos3 = { f: [fc.x, fc.z], j: [jc.x, jc.z], b: [bc.x, bc.z] };
            const lookAtWho = (k, myYaw, myPos) => {
                let tgt = null;
                if (spk && spk.who !== k && pos3[spk.who]) tgt = pos3[spk.who];
                else if (toy && t > 86 && t < 124) tgt = [toy.x, toy.z];
                let want = 0;
                if (tgt) want = clamp(angLerp(0, Math.atan2(tgt[0] - myPos[0], tgt[1] - myPos[1]) - myYaw, 1), -1.1, 1.1);
                this.hyS[k] += (want - this.hyS[k]) * Math.min(1, dt * 6);
                return this.hyS[k];
            };
            if (fc.hy === undefined) fc.hy = lookAtWho('f', fc.yaw, pos3.f);
            const bHead = lookAtWho('b', bc.yaw, pos3.b);
            if (!jc.placeMat) { /* kepala Jake mengikuti badan */ }
            if (bHead) bc.sway = (bc.sway || 0) + 0; // BMO tidak punya leher; hanya menoleh badan sedikit
            if (spk && spk.who === 'j' && jc.expr === 'normal') jc.expr = 'senang';

            /* ----- jalankan aktor ----- */
            const listA = [], listP = [];
            this._jp = [jc.x, (jc.y || 0) + 1.3, jc.z];
            this.jake.frame(dt, jc, listA);
            this.finn.frame(dt, fc, listA);
            this.bmo.frame(dt, bc, listA);
            this._anchors = {
                jakeHandL: this.jake.hand.L, jakeHandR: this.jake.hand.R, finnHandR: this.finn.handW.R, nose: this.jake.nose,
                bmoHandR: this.bmo.handW.R, bmoSlot: this.bmo.slotW
            };
            AT.Props.frame(t, listP, this._anchors);
            AT.Decor.frame(t, listP);
            if (!silent) { if (dt > 0) particles.step(dt); }
            particles.push(listA);

            /* ----- suara bicara (blip) ----- */
            if (!silent && dt > 0 && spk && BLIP[spk.who] && t >= this.nextBlip && t - spk.t0 < 2.6 && opt.sound !== false) {
                sfx.blip(BLIP[spk.who] * (0.9 + Math.random() * 0.25), 0.05);
                this.nextBlip = t + 0.1 + Math.random() * 0.06;
            }
            if (!silent && dt > 0) {
                if (Math.random() < 2.2 * dt) particles.emit('spark', L.fire.x + (Math.random() - 0.5) * 0.8, 0.9, L.fire.z + 0.8, 1, { size: 0.05, vy: 2.2, sy: 1.5, sx: 0.4, sz: 0.2 });
                if (Math.random() < 1.2 * dt) particles.emit('smoke', L.fire.x, 6.5, L.fire.z + 0.1, 1, { size: 0.22, vy: 0.4, sy: 0.4, sx: 0.15, sz: 0.1 });
                if (t >= TL.dance && Math.random() < 6 * dt) { const h = Math.random() < 0.5 ? this.jake.head : this.bmo.headW; particles.emit('note', h[0], h[1] + 0.6, h[2], 1, { size: 0.3, vy: 1.4, sy: 0.6, sx: 0.9, sz: 0.5, color: [[1, 0.85, 0.3], [0.5, 1, 0.6], [0.5, 0.8, 1], [1, 0.5, 0.8]][Math.floor(Math.random() * 4)] }); }
                if (t > 59.5 && t < 67.5 && Math.random() < 3 * dt) particles.emit('sweat', fc.x, 2.8, fc.z, 1, { size: 0.08, vy: 1.5, sy: 0.5, sx: 1.0 });
                if (t > 37 && t < 40.4 && Math.random() < 6 * dt) particles.emit('sweat', jc.x + 0.1, 6.3, jc.z, 1, { size: 0.09, vy: 1.8, sy: 0.6, sx: 1.2 });
            }
            if (!silent && toy && t > TL.snatch && t < TL.runEnd && dt > 0 && Math.sin(t * 22) > 0.97) sfx.tick();

            /* ----- kamera ----- */
            const k = kf(CAM, t);
            let eye = k.slice(0, 3), target = k.slice(3, 6);
            if (rocketPos && t >= TL.launch - 0.2 && t < TL.arrive + 0.6) {
                const w = smooth(seg(t, TL.launch - 0.2, TL.launch + 0.5)) * (1 - smooth(seg(t, TL.arrive - 0.4, TL.arrive + 0.6)));
                eye = V3.lerp(eye, V3.add(rocketPos, [-2.6, 1.6, 5.2]), w); target = V3.lerp(target, rocketPos, w);
            }
            if (t > 89.4 && t < 112.5) {
                const w = smooth(seg(t, 89.4, 91)) * (1 - smooth(seg(t, 110.5, 112.5)));
                // bingkai di antara Jake dan boneka supaya keduanya terlihat; makin jauh makin mundur
                const tx = toy ? toy.x : jc.x, tz = toy ? toy.z : jc.z;
                const mx = (jc.x * 0.55 + tx * 0.45), mz = (jc.z * 0.55 + tz * 0.45), dd = Math.hypot(jc.x - tx, jc.z - tz);
                const tp = [mx, 0.8, mz], ey = [mx + 2.5 + 0.2 * dd, 4.0 + 0.35 * dd, mz + 6.8 + 0.5 * dd];
                eye = V3.lerp(eye, [Math.min(8, Math.max(-8, ey[0])), ey[1], Math.min(7.8, ey[2])], w); target = V3.lerp(target, tp, w);
            }
            this.shake *= Math.exp(-dt * 5);
            const sh = (this.shake + this.jake.shake) * (dt > 0 ? 1 : 0);
            // kamera diperhalus (redaman eksponensial) + goyang tangan tipis; fov 'menyentak' saat benturan
            const rate = (rocketPos && t > TL.launch - 0.5 && t < TL.arrive + 0.6) ? 8 : 4.5;
            if (!this.camS) this.camS = { eye: eye.slice(), target: target.slice() };
            else { const a = 1 - Math.exp(-Math.max(dt, 0) * rate); this.camS.eye = V3.lerp(this.camS.eye, eye, a); this.camS.target = V3.lerp(this.camS.target, target, a); }
            eye = V3.add(this.camS.eye, [0.05 * Math.sin(t * 0.7), 0.04 * Math.sin(t * 0.93 + 1), 0.04 * Math.sin(t * 0.51 + 2)]); target = this.camS.target;
            if (sh > 0.003) eye = [eye[0] + (Math.random() - 0.5) * sh, eye[1] + (Math.random() - 0.5) * sh, eye[2]];
            const kick = t > TL.toyHit ? 7 * Math.exp(-(t - TL.toyHit) * 4.5) : 0;
            this.cam = { eye, target, fov: 42 - kick - (t > TL.hit && t < TL.hit + 1.2 ? 3 * Math.exp(-(t - TL.hit) * 3) : 0) };
            // posisi emote (dunia) untuk overlay DOM
            this.emoteList = [];
            const heads = { j: this.jake.head, f: this.finn.headW, b: this.bmo.headW, t: toy ? [toy.x, toy.y + 0.9, toy.z] : null };
            for (const e of EMOTES) if (t >= e[0] && t < e[1] && heads[e[2]]) {
                const u = Math.min(1, (t - e[0]) / 0.3), pop = 1 + 0.35 * Math.sin(Math.min(1, u) * Math.PI) * (u < 1 ? 1 : 0), fade = Math.min(1, (e[1] - t) / 0.3);
                const h = heads[e[2]], up = e[2] === 'b' ? 0.9 : e[2] === 't' ? 0.5 : 1.15;
                this.emoteList.push({ sym: e[3], pos: [h[0], h[1] + up + 0.08 * Math.sin(t * 5), h[2]], scale: pop * (0.4 + 0.6 * Math.min(1, u * 1.5)), alpha: fade, who: e[2] });
            }
            if (opt.freeCam) this.cam = opt.freeCam(this.cam);

            return listP.concat(listA);
        }

        /* ---- maju satu langkah waktu (dt detik cerita) ---- */
        step(dt, opt) {
            if (this.t > TL.toyHit - 0.12 && this.t < TL.toyHit + 0.22) dt *= 0.3;     // hit-stop / slow-mo singkat
            const a = this.t; this.t = Math.min(TL.total, this.t + dt);
            if (!opt.silent) this.events(a, this.t);
            return this.frame(dt, !!opt.silent, opt);
        }

        /* ---- lompat ke waktu t: reset lalu "panaskan" 2 detik terakhir tanpa suara ---- */
        seek(t, opt) {
            this.reset();
            const start = Math.max(0, t - 2.2);
            this.t = start;
            let list = null;
            while (this.t < t - 1e-6) { const d = Math.min(1 / 30, t - this.t); this.t += d; list = this.frame(d, true, Object.assign({}, opt, { silent: true })); }
            this.prevT = this.t;
        }
    }
    AT.Story = Story;
    AT.ACTS = ACTS;
})();
