(function () {
  "use strict";

  const App = (window.App = window.App || {});
  App.animations = App.animations || {};

  const Matrix4 = App.math.Matrix4 || window.JK.Matrix4;

  const FINN_PROPORTIONS = {
    defaultScale: 1.0,
    shoulderHeight: 2.15,
    shoulderWidth: 0.39,
    armLength: 0.95,
    tPoseHandDistance: 1.39,
  };

  // Jika condong terlihat ke belakang, ubah menjadi -1.
  const LEAN_SIGN = 1;
  const HAND_ROLL = Math.PI / 2;

  function placement(
    basePosition,
    bobbing,
    baseYaw,
    lean,
    scale,
    roll = 0,
    bodyScale = [1, 1, 1],
  ) {
    return Matrix4.chain(
      Matrix4.translation(
        basePosition[0],
        basePosition[1] + bobbing,
        basePosition[2],
      ),
      Matrix4.rotationY(baseYaw),
      Matrix4.rotationX(lean * LEAN_SIGN),
      Matrix4.rotationZ(roll),
      Matrix4.scaling(
        scale * bodyScale[0],
        scale * bodyScale[1],
        scale * bodyScale[2],
      ),
    );
  }

  // Lengan menggantung: panjang hampir penuh, ayun sagital kecil.
  function hangingArm(side, swing, outward, forward) {
    const P = FINN_PROPORTIONS;
    const reach = P.armLength * 1.05;
    const planar = Math.sqrt(reach * reach - outward * outward);

    return {
      l: [
        side * (P.shoulderWidth + outward),
        P.shoulderHeight - Math.cos(swing) * planar,
        Math.sin(swing) * planar + forward,
      ],
      pole: [side * 0.3, -0.1, -0.9],
    };
  }

  // Target lengan saat melompat.
  function jumpArm(side, angle, outward = 0.08, forward = 0.05) {
    const P = FINN_PROPORTIONS;
    const reach = P.armLength * 0.98;
    const planar = Math.sqrt(Math.max(reach * reach - outward * outward, 0));

    return {
      l: [
        side * (P.shoulderWidth + outward),
        P.shoulderHeight - Math.cos(angle) * planar,
        Math.sin(angle) * planar + forward,
      ],
      pole: [side * 0.3, -0.1, -0.9],
    };
  }

  function smoothStep(t) {
    t = Math.max(0, Math.min(1, t));
    return t * t * (3 - 2 * t);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function getFinnPose(
    animationMode,
    elapsedTimeSeconds,
    basePosition = [0, 0, 0],
    baseYaw = 0,
    baseScale = 1.0,
  ) {
    const effectiveScale = baseScale || FINN_PROPORTIONS.defaultScale;
    const P = FINN_PROPORTIONS;

    // 1. IDLE
    if (animationMode === "idle") {
      const t = elapsedTimeSeconds;
      const breath = Math.sin(t * Math.PI * 2 * 0.28);
      const shift = Math.sin(t * Math.PI * 2 * 0.09);

      const bobbing = breath * 0.012;
      const roll = shift * 0.012;
      const lean = 0.012 + breath * 0.006;

      const kneeL = 0.05 + Math.max(0, -shift) * 0.05 + breath * 0.01;
      const kneeR = 0.05 + Math.max(0, shift) * 0.05 + breath * 0.01;

      const swingL = Math.sin(t * Math.PI * 2 * 0.28 - 0.8) * 0.07;
      const swingR = Math.sin(t * Math.PI * 2 * 0.28 - 1.2) * 0.07;

      const blinkPhase = t % 3.8;
      const blink =
        blinkPhase < 0.15
          ? 1 - Math.sin((blinkPhase / 0.15) * Math.PI) * 0.95
          : 1;

      return {
        placeMat: placement(
          basePosition,
          bobbing,
          baseYaw,
          lean,
          effectiveScale,
          roll,
        ),
        scale: effectiveScale,
        lr: shift * 0.02,
        ll: -shift * 0.02,
        kr: kneeR,
        kl: kneeL,
        bob: 0,
        twist: 0,
        lean: 0,
        sway: 0,
        blink,
        eyeK: 1,
        mouth: 1,
        loco: "idle",
        isRun: false,
        armL: hangingArm(-1, swingL, 0.1, 0.03),
        armR: hangingArm(1, swingR, 0.1, 0.03),
      };
    }

    // 2. JUMP
    if (animationMode === "jump") {
      const duration = 1.25;
      const t = Math.max(0, Math.min(elapsedTimeSeconds / duration, 1));

      // Fase 1: ancang-ancang (0 - 0.16)
      // Fase 2: lepas landas (0.16 - 0.32)
      // Fase 3: melayang (0.32 - 0.70)
      // Fase 4: mendarat (0.70 - 0.84)
      // Fase 5: pemulihan (0.84 - 1.0)

      let scaleX = 1;
      let scaleY = 1;
      let scaleZ = 1;
      let knee = 0;
      let armAngle = 0;
      let lean = 0;
      let roll = 0;

      if (t < 0.16) {
        // Tubuh merendah sebelum melompat.
        const p = smoothStep(t / 0.16);

        scaleX = lerp(1, 1.09, p);
        scaleY = lerp(1, 0.82, p);
        scaleZ = lerp(1, 1.09, p);

        knee = lerp(0.1, 0.85, p);
        armAngle = lerp(0.15, 0.55, p);
        lean = lerp(0, -0.08, p);
      } else if (t < 0.32) {
        // Tubuh meregang saat lepas landas.
        const p = smoothStep((t - 0.16) / 0.16);

        scaleX = lerp(1.09, 0.94, p);
        scaleY = lerp(0.82, 1.16, p);
        scaleZ = lerp(1.09, 0.94, p);

        knee = lerp(0.85, 0.12, p);
        armAngle = lerp(0.55, 2.0, p);
        lean = lerp(-0.08, 0.1, p);
      } else if (t < 0.7) {
        // Posisi melayang dengan tangan terangkat.
        const p = smoothStep((t - 0.32) / 0.38);

        scaleX = lerp(0.94, 0.98, p);
        scaleY = lerp(1.16, 1.06, p);
        scaleZ = lerp(0.94, 0.98, p);

        knee = lerp(0.12, 0.35, p);
        armAngle = 2.0 + Math.sin(p * Math.PI) * 0.12;
        lean = 0.1 + Math.sin(p * Math.PI) * 0.035;
      } else if (t < 0.84) {
        // Kaki bersiap menerima benturan.
        const p = smoothStep((t - 0.7) / 0.14);

        scaleX = lerp(0.98, 1.13, p);
        scaleY = lerp(1.06, 0.78, p);
        scaleZ = lerp(0.98, 1.13, p);

        knee = lerp(0.35, 0.95, p);
        armAngle = lerp(2.0, 0.8, p);
        lean = lerp(0.1, -0.06, p);
      } else {
        // Tubuh kembali ke bentuk normal.
        const p = smoothStep((t - 0.84) / 0.16);

        scaleX = lerp(1.13, 1, p);
        scaleY = lerp(0.78, 1, p);
        scaleZ = lerp(1.13, 1, p);

        knee = lerp(0.95, 0.05, p);
        armAngle = lerp(0.8, 0.15, p);
        lean = lerp(-0.06, 0, p);
      }

      // Tinggi lompatan mengikuti kurva sinus.
      const flightT = Math.max(0, Math.min((t - 0.16) / 0.68, 1));

      const jumpHeight = Math.sin(Math.PI * flightT) * 0.42;

      // Sedikit gerakan kaki saat berada di udara.
      const legSwing = Math.sin(t * Math.PI * 2) * 0.12;

      // Lengan kiri dan kanan sedikit berbeda agar tidak kaku.
      const armL = jumpArm(-1, armAngle, 0.08, 0.04);

      const armR = jumpArm(1, armAngle - 0.08, 0.08, 0.04);

      return {
        placeMat: placement(
          basePosition,
          jumpHeight,
          baseYaw,
          lean,
          effectiveScale,
          roll,
          [scaleX, scaleY, scaleZ],
        ),
        scale: effectiveScale,
        lr: -legSwing,
        ll: legSwing,
        kr: knee,
        kl: knee,
        bob: 0,
        twist: 0,
        lean: 0,
        sway: 0,
        blink: 1,
        eyeK: 1,
        mouth: 1,
        loco: "jump",
        isRun: false,
        armL,
        armR,
      };
    }

    // 3. SIKLUS JALAN ATAU LARI
    const isRunning = animationMode === "run";
    const stepFrequency = isRunning ? 2.8 : 1.5;
    const cyclePhase = elapsedTimeSeconds * stepFrequency * Math.PI * 2;

    const leftPhase = cyclePhase;
    const rightPhase = cyclePhase + Math.PI;

    const maxLegSwing = isRunning ? 0.8 : 0.36;
    const leftLegSwing = Math.sin(leftPhase) * maxLegSwing;
    const rightLegSwing = Math.sin(rightPhase) * maxLegSwing;

    const maxKneeFlexion = isRunning ? 1.15 : 0.48;
    const stanceCushion = isRunning ? 0.1 : 0.04;

    const leftKneeBend =
      Math.max(0, Math.cos(leftPhase)) * maxKneeFlexion + stanceCushion;

    const rightKneeBend =
      Math.max(0, Math.cos(rightPhase)) * maxKneeFlexion + stanceCushion;

    // s dalam [-1, 1], positif = tangan maju.
    const leftS = -Math.sin(leftPhase);
    const rightS = -Math.sin(rightPhase);

    const bobbingHeight = isRunning
      ? Math.abs(Math.sin(cyclePhase)) * 0.06 - 0.02
      : Math.sin(cyclePhase * 2) * 0.022;

    const leanAngle = isRunning ? 0.24 : 0.03;

    const sh = P.shoulderHeight;
    const L = P.armLength;

    function armTarget(s, side) {
      if (isRunning) {
        return {
          l: [
            side * (P.shoulderWidth + 0.1),
            sh - 0.58 + 0.22 * s,
            0.1 + 0.5 * s,
          ],
          pole: [side * 0.35, -0.2, -1.0],
        };
      }

      const angle = s * 0.5;
      const dx = 0.06;
      const planar = Math.sqrt(Math.max(L * L - dx * dx, 0));

      return {
        l: [
          side * (P.shoulderWidth + dx),
          sh - Math.cos(angle) * planar,
          Math.sin(angle) * planar,
        ],
        pole: [side * 0.3, -0.1, -0.9],
      };
    }

    return {
      placeMat: placement(
        basePosition,
        bobbingHeight,
        baseYaw,
        leanAngle,
        effectiveScale,
      ),
      scale: effectiveScale,
      lr: rightLegSwing,
      ll: leftLegSwing,
      kr: rightKneeBend,
      kl: leftKneeBend,
      bob: 0,
      twist: 0,
      lean: 0,
      sway: 0,
      blink: 1,
      eyeK: 1,
      mouth: 1,
      loco: isRunning ? "run" : animationMode === "walk" ? "walk" : "idle",
      isRun: isRunning,
      armL: armTarget(leftS, -1),
      armR: armTarget(rightS, 1),
    };
  }

  App.animations.getFinnPose = getFinnPose;
  App.animations.finn = getFinnPose;

  App.animations.getCharacterLocomotionPose =
    App.animations.getCharacterLocomotionPose ||
    function (characterIdentifier, ...args) {
      const handler = App.animations[characterIdentifier.toLowerCase()];

      if (handler) return handler(...args);

      throw new Error(
        `Handler animasi untuk '${characterIdentifier}' belum dimuat.`,
      );
    };

  window.AT = window.AT || {};
  window.AT.animations = App.animations;
})();
