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

  function placement(basePosition, bobbing, baseYaw, lean, scale) {
    return Matrix4.chain(
      Matrix4.translation(
        basePosition[0],
        basePosition[1] + bobbing,
        basePosition[2],
      ),
      Matrix4.rotationY(baseYaw),
      Matrix4.rotationX(lean * LEAN_SIGN),
      Matrix4.scaling(scale, scale, scale),
    );
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

    // 1. POSE DIAM / T-POSE
    if (animationMode === "idle") {
      return {
        placeMat: placement(basePosition, 0, baseYaw, 0, effectiveScale),
        scale: effectiveScale,
        loco: "idle",
        isRun: false,
        expr: 0,
        lr: 0,
        ll: 0,
        kr: 0,
        kl: 0,
        armL: {
          l: [-P.tPoseHandDistance, P.shoulderHeight, 0],
          pole: [-1, 0, 1],
        },
        armR: {
          l: [P.tPoseHandDistance, P.shoulderHeight, 0],
          pole: [1, 0, 1],
        },
        pose: {
          abdL: Math.PI / 2,
          abdR: Math.PI / 2,
          swL: 0,
          swR: 0,
          elbL: 0,
          elbR: 0,
          legL: 0,
          legR: 0,
          kneeL: 0,
          kneeR: 0,
        },
      };
    }

    // 2. SIKLUS JALAN ATAU LARI
    const isRunning = animationMode === "run";
    const stepFrequency = isRunning ? 2.8 : 1.5;
    const cyclePhase = elapsedTimeSeconds * stepFrequency * Math.PI * 2;
    const leftPhase = cyclePhase;
    const rightPhase = cyclePhase + Math.PI;

    // Kaki IK
    const maxLegSwing = isRunning ? 0.75 : 0.35;
    const leftLegSwing = Math.sin(leftPhase) * maxLegSwing;
    const rightLegSwing = Math.sin(rightPhase) * maxLegSwing;

    const maxKneeFlexion = isRunning ? 1.05 : 0.45;
    const stanceCushion = isRunning ? 0.08 : 0.04;
    const leftKneeBend =
      Math.max(0, Math.cos(leftPhase)) * maxKneeFlexion + stanceCushion;
    const rightKneeBend =
      Math.max(0, Math.cos(rightPhase)) * maxKneeFlexion + stanceCushion;

    // Lengan IK
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
        // Siku ~90 derajat; tangan memompa di samping rusuk BMO
        return {
          l: [
            side * (sw - 0.4),
            sh - 0.58 * L + 0.22 * L * s,
            (0.1 + 0.5 * s) * L,
          ],
          pole: [side * 0.35, -0.2, -1.0],
        };
      }
      // Jalan: lengan hampir lurus, ayunan sagital halus
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
      loco: isRunning ? "run" : (animationMode === "walk" ? "walk" : "idle"),
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
