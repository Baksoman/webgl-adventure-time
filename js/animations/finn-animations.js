(function () {
  "use strict";

  const App = (window.App = window.App || {});
  App.animations = App.animations || {};

  const Matrix4 = App.math.Matrix4 || window.JK.Matrix4;

  /**
   * Modul Animasi FINN THE HUMAN (versi diperbaiki)
   *
   * Perbaikan:
   * 1. Jalan  : lengan hampir lurus (siku hanya menekuk sedikit), ayunan halus
   *             dan jangkauan hand dihitung dengan panjang lengan tetap sehingga
   *             tidak tampak bersudut.
   * 2. Lari   : siku menekuk ~90 derajat, tangan memompa dari depan dada sampai
   *             ke samping pinggul (jangkauan ayun lebih jauh, tidak terlalu ke belakang).
   * 3. Lari   : badan condong ke depan (pivot di telapak kaki, sehingga kaki tetap menapak).
   */

  const FINN_PROPORTIONS = {
    defaultScale: 1.0,
    shoulderHeight: 2.15,
    shoulderWidth: 0.39,
    armLength: 0.95, // panjang lengan efektif (dari bahu ke tangan)
    tPoseHandDistance: 1.39,
  };

  // Jika condong terlihat ke belakang, ubah menjadi -1.
  const LEAN_SIGN = 1;
  // Roll telapak tangan (radian) -> dikirim sebagai handRollL / handRollR.
  const HAND_ROLL = Math.PI / 2;

  function placement(basePosition, bobbing, baseYaw, lean, scale) {
    return Matrix4.chain(
      Matrix4.translation(
        basePosition[0],
        basePosition[1] + bobbing,
        basePosition[2],
      ),
      Matrix4.rotationY(baseYaw),
      Matrix4.rotationX(lean * LEAN_SIGN), // pivot di kaki (origin lokal)
      Matrix4.scaling(scale, scale, scale),
    );
  }

  /**
   * @param {string} animationMode - 'idle', 'walk', atau 'run'.
   * @param {number} elapsedTimeSeconds
   * @param {Array<number>} basePosition
   * @param {number} baseYaw
   * @param {number} [baseScale=1.0]
   */
  function getFinnPose(
    animationMode,
    elapsedTimeSeconds,
    basePosition = [0, 0, 0],
    baseYaw = 0,
    baseScale = 1.0,
  ) {
    const effectiveScale = baseScale || FINN_PROPORTIONS.defaultScale;
    const P = FINN_PROPORTIONS;

    // 1. POSE DIAM / T-POSE
    if (animationMode === "idle") {
      return {
        placeMat: placement(basePosition, 0, baseYaw, 0, effectiveScale),
        scale: effectiveScale,
        lr: 0,
        ll: 0,
        kr: 0,
        kl: 0,
        bob: 0,
        twist: 0,
        lean: 0,
        sway: 0,
        blink: 1,
        eyeK: 1,
        mouth: 1,
        loco: "idle",
        isRun: false,
        armL: {
          l: [-P.tPoseHandDistance, P.shoulderHeight, 0.0],
          pole: [-1, 0, 1],
        },
        armR: {
          l: [P.tPoseHandDistance, P.shoulderHeight, 0.0],
          pole: [1, 0, 1],
        },
      };
    }

    // 2. SIKLUS JALAN ATAU LARI
    const isRunning = animationMode === "run";
    const stepFrequency = isRunning ? 2.8 : 1.5;
    const cyclePhase = elapsedTimeSeconds * stepFrequency * Math.PI * 2;
    const leftPhase = cyclePhase;
    const rightPhase = cyclePhase + Math.PI;

    // Kaki
    const maxLegSwing = isRunning ? 0.8 : 0.36;
    const leftLegSwing = Math.sin(leftPhase) * maxLegSwing;
    const rightLegSwing = Math.sin(rightPhase) * maxLegSwing;

    const maxKneeFlexion = isRunning ? 1.15 : 0.48;
    const stanceCushion = isRunning ? 0.1 : 0.04;
    const leftKneeBend =
      Math.max(0, Math.cos(leftPhase)) * maxKneeFlexion + stanceCushion;
    const rightKneeBend =
      Math.max(0, Math.cos(rightPhase)) * maxKneeFlexion + stanceCushion;

    // Lengan: s dalam [-1, 1], positif = tangan maju (kontralateral dengan kaki)
    const leftS = -Math.sin(leftPhase);
    const rightS = -Math.sin(rightPhase);

    // Bobbing & condong badan
    const bobbingHeight = isRunning
      ? Math.abs(Math.sin(cyclePhase)) * 0.06 - 0.02
      : Math.sin(cyclePhase * 2) * 0.022;
    const leanAngle = isRunning ? 0.24 : 0.03;

    const sh = P.shoulderHeight;
    const L = P.armLength;

    function armTarget(s, side) {
      if (isRunning) {
        // Siku ~90 derajat; tangan memompa dari depan dada ke samping pinggul.
        return {
          l: [
            side * (P.shoulderWidth + 0.1),
            sh - 0.58 + 0.22 * s,
            0.1 + 0.5 * s,
          ],
          pole: [side * 0.35, -0.2, -1.0],
        };
      }
      // Jalan: lengan hampir lurus, panjang konstan, ayun sagital halus.
      const angle = s * 0.5;
      const dx = 0.06;
      const reach = L * (0.95 - 0.05 * Math.max(0, s)); // siku sedikit menekuk saat maju
      const planar = Math.sqrt(Math.max(reach * reach - dx * dx, 0));
      return {
        l: [
          side * (P.shoulderWidth + 0.06),
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
      loco: isRunning ? "run" : (animationMode === "walk" ? "walk" : "idle"),
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
