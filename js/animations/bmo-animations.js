(function () {
  "use strict";

  const App = (window.App = window.App || {});
  App.animations = App.animations || {};

  const Matrix4 = App.math.Matrix4 || window.JK.Matrix4;

  const BMO_PROPORTIONS = {
    defaultScale: 0.034,
    shoulderHeight: 7.0,
    shoulderWidth: 12.0,
    armLength: 11.2,
    tPoseHandDistance: 21.2,
  };

  const LEAN_SIGN = 1;

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

  function hangingArm(side, swing, forward) {
    const P = BMO_PROPORTIONS;
    const dx = 0.5;
    const reach = P.armLength;
    const planar = Math.sqrt(Math.max(reach * reach - dx * dx, 0));

    return {
      l: [
        side * (P.shoulderWidth + dx),
        P.shoulderHeight - Math.cos(swing) * planar,
        Math.sin(swing) * planar + forward,
      ],
      pole: [side * 0.3, -0.1, -0.9],
    };
  }

  function getBmoPose(
    animationMode,
    elapsedTimeSeconds,
    basePosition = [0, 0, 0],
    baseYaw = 0,
    baseScale = 0.034,
  ) {
    const effectiveScale = baseScale || BMO_PROPORTIONS.defaultScale;

    const P = BMO_PROPORTIONS;

    // IDLE
    if (animationMode === "idle") {
      const t = elapsedTimeSeconds;
      const breath = Math.sin(t * Math.PI * 2 * 0.35);
      const shift = Math.sin(t * Math.PI * 2 * 0.12);

      const swingL = Math.sin(t * Math.PI * 2 * 0.35 - 0.8) * 0.15;
      const swingR = Math.sin(t * Math.PI * 2 * 0.35 - 1.2) * 0.15;

      return {
        placeMat: placement(
          basePosition,
          breath * 0.006,
          baseYaw,
          0.01 + breath * 0.006,
          effectiveScale,
          shift * 0.03,
        ),
        scale: effectiveScale,
        loco: "idle",
        isRun: false,
        expr: t % 7 < 1.2 ? 1 : 0,
        lr: shift * 0.03,
        ll: -shift * 0.03,
        kr: 0.04 + Math.max(0, shift) * 0.04,
        kl: 0.04 + Math.max(0, -shift) * 0.04,
        armL: hangingArm(-1, swingL, 0.3),
        armR: hangingArm(1, swingR, 0.3),
      };
    }

    // JUMP
    if (animationMode === "jump") {
      const duration = 1.25;
      const p = Math.max(0, Math.min(elapsedTimeSeconds / duration, 1));

      const smooth = (t) => t * t * (3 - 2 * t);
      const mix = (a, b, t) => a + (b - a) * t;

      const phase = (start, end, from, to) => {
        const t = smooth(Math.max(0, Math.min((p - start) / (end - start), 1)));

        return mix(from, to, t);
      };

      // Body scaling: squash and stretch
      let scaleX = 1;
      let scaleY = 1;
      let scaleZ = 1;

      if (p < 0.16) {
        scaleX = phase(0, 0.16, 1.0, 1.1);
        scaleY = phase(0, 0.16, 1.0, 0.82);
        scaleZ = phase(0, 0.16, 1.0, 1.1);
      } else if (p < 0.32) {
        scaleX = phase(0.16, 0.32, 1.1, 0.94);
        scaleY = phase(0.16, 0.32, 0.82, 1.16);
        scaleZ = phase(0.16, 0.32, 1.1, 0.94);
      } else if (p < 0.7) {
        scaleX = phase(0.32, 0.7, 0.94, 0.97);
        scaleY = phase(0.32, 0.7, 1.16, 1.06);
        scaleZ = phase(0.32, 0.7, 0.94, 0.97);
      } else if (p < 0.84) {
        scaleX = phase(0.7, 0.84, 0.97, 1.14);
        scaleY = phase(0.7, 0.84, 1.06, 0.78);
        scaleZ = phase(0.7, 0.84, 0.97, 1.14);
      } else {
        scaleX = phase(0.84, 1.0, 1.14, 1.0);
        scaleY = phase(0.84, 1.0, 0.78, 1.0);
        scaleZ = phase(0.84, 1.0, 1.14, 1.0);
      }

      // Jump height
      const flightT = Math.max(0, Math.min((p - 0.16) / 0.68, 1));

      const jumpHeight = Math.sin(Math.PI * flightT) * 0.42;

      // Arm movement
      let armAngle;

      if (p < 0.16) {
        armAngle = phase(0, 0.16, 0.15, -0.25);
      } else if (p < 0.34) {
        armAngle = phase(0.16, 0.34, -0.25, 2.15);
      } else if (p < 0.7) {
        armAngle = phase(0.34, 0.7, 2.15, 1.85);
      } else if (p < 0.84) {
        armAngle = phase(0.7, 0.84, 1.85, 0.45);
      } else {
        armAngle = phase(0.84, 1.0, 0.45, 0.15);
      }

      function jumpArm(side, angle) {
        const dx = 0.5;
        const reach = P.armLength * 0.95;

        const planar = Math.sqrt(Math.max(reach * reach - dx * dx, 0));

        return {
          l: [
            side * (P.shoulderWidth + dx),
            P.shoulderHeight - Math.cos(angle) * planar,
            Math.sin(angle) * planar,
          ],
          pole: [side * 0.3, -0.1, -0.9],
        };
      }

      // Leg movement
      let kneeBend;

      if (p < 0.16) {
        kneeBend = phase(0, 0.16, 0.04, 0.45);
      } else if (p < 0.32) {
        kneeBend = phase(0.16, 0.32, 0.45, 0.08);
      } else if (p < 0.7) {
        kneeBend = phase(0.32, 0.7, 0.08, 0.48);
      } else if (p < 0.84) {
        kneeBend = phase(0.7, 0.84, 0.48, 0.62);
      } else {
        kneeBend = phase(0.84, 1.0, 0.62, 0.04);
      }

      const legSwing = Math.sin(p * Math.PI * 2) * 0.12;

      // Body lean
      const leanAngle =
        p < 0.32
          ? phase(0, 0.32, 0.08, -0.12)
          : p < 0.84
            ? phase(0.32, 0.84, -0.12, 0.05)
            : phase(0.84, 1.0, 0.05, 0);

      return {
        placeMat: placement(
          basePosition,
          jumpHeight,
          baseYaw,
          leanAngle,
          effectiveScale,
          0,
          [scaleX, scaleY, scaleZ],
        ),
        scale: effectiveScale,
        loco: "jump",
        isRun: false,
        expr: 1,
        lr: legSwing,
        ll: -legSwing,
        kr: kneeBend + 0.03,
        kl: kneeBend,
        armL: jumpArm(-1, armAngle + 0.08),
        armR: jumpArm(1, armAngle - 0.08),
      };
    }

    // WALK / RUN
    const isRunning = animationMode === "run";
    const stepFrequency = isRunning ? 2.8 : 1.5;
    const cyclePhase = elapsedTimeSeconds * stepFrequency * Math.PI * 2;

    const leftPhase = cyclePhase;
    const rightPhase = cyclePhase + Math.PI;

    const maxLegSwing = isRunning ? 0.75 : 0.35;
    const leftLegSwing = Math.sin(leftPhase) * maxLegSwing;
    const rightLegSwing = Math.sin(rightPhase) * maxLegSwing;

    const maxKneeFlexion = isRunning ? 1.05 : 0.45;
    const stanceCushion = isRunning ? 0.08 : 0.04;

    const leftKneeBend =
      Math.max(0, Math.cos(leftPhase)) * maxKneeFlexion + stanceCushion;

    const rightKneeBend =
      Math.max(0, Math.cos(rightPhase)) * maxKneeFlexion + stanceCushion;

    const leftS = -Math.sin(leftPhase);
    const rightS = -Math.sin(rightPhase);

    const bobbingHeight = isRunning
      ? Math.abs(Math.sin(cyclePhase)) * 0.05 - 0.015
      : Math.sin(cyclePhase * 2) * 0.02;

    const leanAngle = isRunning ? 0.18 : 0.02;

    const sh = P.shoulderHeight;
    const sw = P.shoulderWidth;
    const L = P.armLength;

    function armTarget(s, side) {
      if (isRunning) {
        return {
          l: [
            side * (sw - 0.4),
            sh - 0.58 * L + 0.22 * L * s,
            (0.1 + 0.5 * s) * L,
          ],
          pole: [side * 0.35, -0.2, -1.0],
        };
      }

      const angle = s * 0.45;
      const dx = 0.5;
      const reach = L * (0.95 - 0.05 * Math.max(0, s));

      const planar = Math.sqrt(Math.max(reach * reach - dx * dx, 0));

      return {
        l: [
          side * (sw + dx),
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
      expr: isRunning ? 1 : 0,
      loco: isRunning ? "run" : animationMode === "walk" ? "walk" : "idle",
      isRun: isRunning,
      lr: rightLegSwing,
      ll: leftLegSwing,
      kr: rightKneeBend,
      kl: leftKneeBend,
      armL: armTarget(leftS, -1),
      armR: armTarget(rightS, 1),
    };
  }

  App.animations.getBmoPose = getBmoPose;
  App.animations.bmo = getBmoPose;

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
