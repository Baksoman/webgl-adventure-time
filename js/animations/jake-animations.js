(function () {
  "use strict";

  const App = (window.App = window.App || {});
  App.animations = App.animations || {};

  const Matrix4 = App.math.Matrix4 || window.JK.Matrix4;

  const JAKE_PROPORTIONS = {
    defaultScale: 0.42,
    shoulderHeight: 3.47,
    shoulderWidth: 0.75,
    armLength: 1.92,
  };

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

  // Lengan menggantung lurus dan terbuka keluar.
  function hangingArm(side, swing, forward) {
    const P = JAKE_PROPORTIONS;
    const reach = P.armLength + 0.9;
    const dx = 0.6;
    const dy = -Math.cos(swing) * reach;
    const dz = Math.sin(swing) * reach + forward;
    const scaleToReach = reach / Math.hypot(dx, dy, dz);

    return {
      l: [
        side * (P.shoulderWidth + dx * scaleToReach),
        P.shoulderHeight + dy * scaleToReach,
        dz * scaleToReach,
      ],
      pole: [0, -0.1, -0.9],
    };
  }

  // Target lengan ketika Jake melompat.
  function jumpArm(side, angle, outward = 0.6, forward = 0.1) {
    const P = JAKE_PROPORTIONS;
    const reach = P.armLength + 0.7;
    const planar = Math.sqrt(Math.max(reach * reach - outward * outward, 0));

    return {
      l: [
        side * (P.shoulderWidth + outward),
        P.shoulderHeight - Math.cos(angle) * planar,
        Math.sin(angle) * planar + forward,
      ],
      pole: [0, -0.1, -0.9],
    };
  }

  function smoothStep(t) {
    t = Math.max(0, Math.min(1, t));
    return t * t * (3 - 2 * t);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function getJakePose(
    animationMode,
    elapsedTimeSeconds,
    basePosition = [0, 0, 0],
    baseYaw = 0,
    baseScale = 0.42,
  ) {
    const effectiveScale = baseScale || JAKE_PROPORTIONS.defaultScale;
    const P = JAKE_PROPORTIONS;

    // 1. IDLE
    if (animationMode === "idle") {
      const t = elapsedTimeSeconds;
      const breath = Math.sin(t * Math.PI * 2 * 0.3);
      const shift = Math.sin(t * Math.PI * 2 * 0.1);

      const swingL = Math.sin(t * Math.PI * 2 * 0.3 - 0.8) * 0.14;
      const swingR = Math.sin(t * Math.PI * 2 * 0.3 - 1.2) * 0.14;

      return {
        placeMat: placement(
          basePosition,
          breath * 0.014,
          baseYaw,
          0.012 + breath * 0.006,
          effectiveScale,
          shift * 0.014,
        ),
        scale: effectiveScale,
        lr: shift * 0.02,
        ll: -shift * 0.02,
        kr: 0.05 + Math.max(0, shift) * 0.05 + breath * 0.01,
        kl: 0.05 + Math.max(0, -shift) * 0.05 + breath * 0.01,
        loco: "idle",
        isRun: false,
        action: "none",
        tall: 0,
        noSpin: true,
        armL: hangingArm(-1, swingL, 0.6),
        armR: hangingArm(1, swingR, 0.6),
      };
    }

    // 2. JUMP
    if (animationMode === "jump") {
      const duration = 1.35;
      const t = Math.max(0, Math.min(elapsedTimeSeconds / duration, 1));

      let scaleX = 1;
      let scaleY = 1;
      let scaleZ = 1;
      let knee = 0;
      let armAngle = 0;
      let lean = 0;
      let roll = 0;

      if (t < 0.16) {
        // Antisipasi: Jake merendahkan tubuh.
        const p = smoothStep(t / 0.16);

        scaleX = lerp(1, 1.12, p);
        scaleY = lerp(1, 0.82, p);
        scaleZ = lerp(1, 1.12, p);

        knee = lerp(0.1, 0.85, p);
        armAngle = lerp(0.1, 0.65, p);
        lean = lerp(0, -0.06, p);
      } else if (t < 0.32) {
        // Lepas landas: tubuh meregang ke atas.
        const p = smoothStep((t - 0.16) / 0.16);

        scaleX = lerp(1.12, 0.91, p);
        scaleY = lerp(0.82, 1.2, p);
        scaleZ = lerp(1.12, 0.91, p);

        knee = lerp(0.85, 0.1, p);
        armAngle = lerp(0.65, 2.0, p);
        lean = lerp(-0.06, 0.08, p);
      } else if (t < 0.7) {
        // Melayang: lengan terangkat dan kaki sedikit menekuk.
        const p = smoothStep((t - 0.32) / 0.38);

        scaleX = lerp(0.91, 0.97, p);
        scaleY = lerp(1.2, 1.08, p);
        scaleZ = lerp(0.91, 0.97, p);

        knee = lerp(0.1, 0.4, p);
        armAngle = 2.0 + Math.sin(p * Math.PI) * 0.12;
        lean = 0.08 + Math.sin(p * Math.PI) * 0.025;
      } else if (t < 0.84) {
        // Mendarat: tubuh kembali memampat.
        const p = smoothStep((t - 0.7) / 0.14);

        scaleX = lerp(0.97, 1.15, p);
        scaleY = lerp(1.08, 0.78, p);
        scaleZ = lerp(0.97, 1.15, p);

        knee = lerp(0.4, 1.0, p);
        armAngle = lerp(2.0, 0.8, p);
        lean = lerp(0.08, -0.05, p);
      } else {
        // Pemulihan: kembali ke bentuk normal.
        const p = smoothStep((t - 0.84) / 0.16);

        scaleX = lerp(1.15, 1, p);
        scaleY = lerp(0.78, 1, p);
        scaleZ = lerp(1.15, 1, p);

        knee = lerp(1.0, 0.05, p);
        armAngle = lerp(0.8, 0.1, p);
        lean = lerp(-0.05, 0, p);
      }

      // Tinggi lompatan mengikuti kurva sinus.
      const flightT = Math.max(0, Math.min((t - 0.16) / 0.68, 1));

      const jumpHeight = Math.sin(Math.PI * flightT) * 0.48;

      // Gerakan kaki kecil selama berada di udara.
      const legSwing = Math.sin(t * Math.PI * 2) * 0.15;

      const armL = jumpArm(-1, armAngle, 0.6, 0.1);

      const armR = jumpArm(1, armAngle - 0.1, 0.6, 0.1);

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
        loco: "jump",
        isRun: false,
        action: "none",
        tall: 0,
        noSpin: true,
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

    const leftS = -Math.sin(leftPhase);
    const rightS = -Math.sin(rightPhase);

    const bobbingHeight = isRunning
      ? Math.abs(Math.sin(cyclePhase)) * 0.06 - 0.02
      : Math.sin(cyclePhase * 2) * 0.024;

    const leanAngle = isRunning ? 0.22 : 0.03;

    const sh = P.shoulderHeight;
    const L = P.armLength;

    function armTarget(s, side) {
      if (isRunning) {
        return {
          l: [
            side * (P.shoulderWidth + 0.6),
            sh - 0.58 * (L / 0.95) + 0.22 * (L / 0.95) * s,
            (0.1 + 0.5 * s) * (L / 0.95),
          ],
          pole: [0, -0.1, -1.0],
        };
      }

      const angle = s * 0.5;
      const dx = 0.06;
      const reach = L + 0.7;
      const planar = Math.sqrt(Math.max(reach * reach - dx * dx, 0));

      return {
        l: [
          side * (P.shoulderWidth + 0.6),
          sh - Math.cos(angle) * planar,
          Math.sin(angle) * planar,
        ],
        pole: [0, -0.1, -0.9],
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
      loco: isRunning ? "run" : animationMode === "walk" ? "walk" : "idle",
      isRun: isRunning,
      action: "none",
      tall: 0,
      noSpin: true,
      armL: armTarget(leftS, -1),
      armR: armTarget(rightS, 1),
    };
  }

  App.animations.getJakePose = getJakePose;
  App.animations.jake = getJakePose;

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
