(function () {
  "use strict";

  const App = (window.App = window.App || {});
  App.animations = App.animations || {};

  const Matrix4 = App.math.Matrix4 || window.JK.Matrix4;

  const JAKE_PROPORTIONS = {
    defaultScale: 0.42,
    shoulderHeight: 3.47,
    shoulderWidth: 0.75,
    armLength: 1.92, // dipendekkan 20% secara menyeluruh (sebelumnya 2.4)
  };

  const LEAN_SIGN = 1; // -1 jika condong terlihat ke belakang
  const HAND_ROLL = Math.PI / 2;

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

  function getJakePose(
    animationMode,
    elapsedTimeSeconds,
    basePosition = [0, 0, 0],
    baseYaw = 0,
    baseScale = 0.42,
  ) {
    const effectiveScale = baseScale || JAKE_PROPORTIONS.defaultScale;
    const P = JAKE_PROPORTIONS;

    if (animationMode === "idle") {
      return {
        placeMat: placement(basePosition, 0, baseYaw, 0, effectiveScale),
        scale: effectiveScale,
        lr: 0,
        ll: 0,
        kr: 0,
        kl: 0,
        loco: "idle",
        isRun: false,
        action: "none",
        tall: 0,
        noSpin: true,
      };
    }

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
          pole: [side * 0, -0.1, -1.0],
        };
      }
      // Jalan: lengan hampir lurus, panjang konstan, ayun sagital halus (persis pola Finn)
      const angle = s * 0.5;
      const dx = 0.06;
      const reach = L * (0.95 - 0.05 * Math.max(0, s));
      const planar = Math.sqrt(Math.max(reach * reach - dx * dx, 0));
      return {
        l: [
          side * (P.shoulderWidth + 0.6),
          sh - Math.cos(angle) * planar,
          Math.sin(angle) * planar,
        ],
        pole: [side * 0, -0.1, -0.9],
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
      loco: isRunning ? "run" : (animationMode === "walk" ? "walk" : "idle"),
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
