(function () {
  "use strict";

  const App = (window.App = window.App || {});
  App.animations = App.animations || {};

  const Matrix4 = App.math.Matrix4 || window.JK.Matrix4;

  const FULL_TURN = Math.PI * 2;
  const LEAN_SIGN = 1;

  const BMO_PROPORTIONS = {
    defaultScale: 0.034,
    shoulderHeight: 7.0,
    shoulderWidth: 12.0,
    armLength: 11.2,
    tPoseHandDistance: 21.2,
  };

  const DANCE_SETTINGS = {
    beatsPerSecond: 2,
    beatsPerCycle: 8,
    twirlStartBeat: 6,
    swayAxis: [0.35, 1, 0.25],
    swayAngle: 0.35,
    twirlAxis: [0.12, 1, 0.08],
    bounceHeight: 0.06,
    baseKneeBend: 0.08,
    stepKneeBend: 0.6,
    stepLegSwing: 0.3,
    armOutwardAngle: 1.2,
    armLowElevation: 0.15,
    armHighElevation: 1.0,
    armTwirlElevation: 1.3,
  };

  // Membatasi nilai agar tetap di antara batas bawah dan batas atas
  function clampValue(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  // Menginterpolasi nilai dari start ke end secara linear
  function linearInterpolate(start, end, factor) {
    return start + (end - start) * factor;
  }

  // Easing halus di awal dan di akhir (smoothstep)
  function smoothStep(factor) {
    return factor * factor * (3 - 2 * factor);
  }

  // Easing halus di awal dan di akhir (ease-in-out cubic)
  function easingCubicInOut(factor) {
    return factor < 0.5
      ? 4 * factor * factor * factor
      : 1 - Math.pow(-2 * factor + 2, 3) / 2;
  }

  // Menginterpolasi nilai dengan halus hanya di dalam rentang progress start sampai end
  function interpolatePhase(progress, start, end, fromValue, toValue) {
    const phaseFactor = clampValue((progress - start) / (end - start), 0, 1);
    return linearInterpolate(fromValue, toValue, smoothStep(phaseFactor));
  }

  // Membuat matriks penempatan BMO: posisi, putaran Y, condong, miring samping, lalu skala tubuh
  function createBodyPlacement(
    basePosition,
    bobbingHeight,
    baseYaw,
    leanAngle,
    scale,
    rollAngle = 0,
    bodyScale = [1, 1, 1],
  ) {
    return Matrix4.chain(
      Matrix4.translation(
        basePosition[0],
        basePosition[1] + bobbingHeight,
        basePosition[2],
      ),
      Matrix4.rotationY(baseYaw),
      Matrix4.rotationX(leanAngle * LEAN_SIGN),
      Matrix4.rotationZ(rollAngle),
      Matrix4.scaling(
        scale * bodyScale[0],
        scale * bodyScale[1],
        scale * bodyScale[2],
      ),
    );
  }

  // Membuat matriks penempatan BMO untuk menari: dua rotasi sumbu sembarang (goyang dan putar) lalu skala tubuh
  function createDancePlacement(
    basePosition,
    bounceHeight,
    baseYaw,
    swayRotation,
    twirlRotation,
    scale,
    bodyScale,
  ) {
    return Matrix4.chain(
      Matrix4.translation(
        basePosition[0],
        basePosition[1] + bounceHeight,
        basePosition[2],
      ),
      Matrix4.rotationY(baseYaw),
      swayRotation,
      twirlRotation,
      Matrix4.scaling(
        scale * bodyScale[0],
        scale * bodyScale[1],
        scale * bodyScale[2],
      ),
    );
  }

  // Membuat target lengan yang menggantung lurus di samping badan dan mengayun pelan
  function createHangingArm(side, swingAngle, forwardOffset) {
    const proportions = BMO_PROPORTIONS;
    const outwardOffset = 0.5;
    const reach = proportions.armLength;
    const planarReach = Math.sqrt(
      Math.max(reach * reach - outwardOffset * outwardOffset, 0),
    );

    return {
      l: [
        side * (proportions.shoulderWidth + outwardOffset),
        proportions.shoulderHeight - Math.cos(swingAngle) * planarReach,
        Math.sin(swingAngle) * planarReach + forwardOffset,
      ],
      pole: [side * 0.3, -0.1, -0.9],
    };
  }

  // Membuat target lengan untuk lompat: sudut 0 menggantung, makin besar makin terangkat ke atas
  function createJumpArm(side, raiseAngle) {
    const proportions = BMO_PROPORTIONS;
    const outwardOffset = 0.5;
    const reach = proportions.armLength * 0.95;
    const planarReach = Math.sqrt(
      Math.max(reach * reach - outwardOffset * outwardOffset, 0),
    );

    return {
      l: [
        side * (proportions.shoulderWidth + outwardOffset),
        proportions.shoulderHeight - Math.cos(raiseAngle) * planarReach,
        Math.sin(raiseAngle) * planarReach,
      ],
      pole: [side * 0.3, -0.1, -0.9],
    };
  }

  // Membuat target lengan menari lewat arah bola: sudut ke samping dan sudut angkat dari bahu
  function createDanceArm(side, elevationAngle, outwardAngle) {
    const proportions = BMO_PROPORTIONS;
    const reach = proportions.armLength * 0.95;
    const direction = [
      side * Math.sin(outwardAngle) * Math.cos(elevationAngle),
      Math.sin(elevationAngle),
      Math.cos(outwardAngle) * Math.cos(elevationAngle),
    ];

    return {
      l: [
        side * proportions.shoulderWidth + direction[0] * reach,
        proportions.shoulderHeight + direction[1] * reach,
        direction[2] * reach,
      ],
      pole: [side * 0.3, -0.5, -0.6],
    };
  }

  // Membuat target lengan untuk jalan atau lari berdasarkan sinyal ayunan -1 sampai 1
  function createLocomotionArm(side, swingSignal, isRunning) {
    const proportions = BMO_PROPORTIONS;
    const shoulderHeight = proportions.shoulderHeight;
    const shoulderWidth = proportions.shoulderWidth;
    const armLength = proportions.armLength;

    if (isRunning) {
      return {
        l: [
          side * (shoulderWidth - 0.4),
          shoulderHeight - 0.58 * armLength + 0.22 * armLength * swingSignal,
          (0.1 + 0.5 * swingSignal) * armLength,
        ],
        pole: [side * 0.35, -0.2, -1.0],
      };
    }

    const swingAngle = swingSignal * 0.45;
    const outwardOffset = 0.5;
    const reach = armLength * (0.95 - 0.05 * Math.max(0, swingSignal));
    const planarReach = Math.sqrt(
      Math.max(reach * reach - outwardOffset * outwardOffset, 0),
    );

    return {
      l: [
        side * (shoulderWidth + outwardOffset),
        shoulderHeight - Math.cos(swingAngle) * planarReach,
        Math.sin(swingAngle) * planarReach,
      ],
      pole: [side * 0.3, -0.1, -0.9],
    };
  }

  // Membuat pose diam: napas, goyang pelan, lengan menggantung, sesekali tersenyum
  function createIdlePose(
    elapsedTimeSeconds,
    basePosition,
    baseYaw,
    effectiveScale,
  ) {
    const breath = Math.sin(elapsedTimeSeconds * Math.PI * 2 * 0.35);
    const weightShift = Math.sin(elapsedTimeSeconds * Math.PI * 2 * 0.12);

    const leftArmSwing =
      Math.sin(elapsedTimeSeconds * Math.PI * 2 * 0.35 - 0.8) * 0.15;
    const rightArmSwing =
      Math.sin(elapsedTimeSeconds * Math.PI * 2 * 0.35 - 1.2) * 0.15;

    return {
      placeMat: createBodyPlacement(
        basePosition,
        breath * 0.006,
        baseYaw,
        0.01 + breath * 0.006,
        effectiveScale,
        weightShift * 0.03,
      ),
      scale: effectiveScale,
      loco: "idle",
      isRun: false,
      expr: elapsedTimeSeconds % 7 < 1.2 ? 1 : 0,
      lr: weightShift * 0.03,
      ll: -weightShift * 0.03,
      kr: 0.04 + Math.max(0, weightShift) * 0.04,
      kl: 0.04 + Math.max(0, -weightShift) * 0.04,
      armL: createHangingArm(-1, leftArmSwing, 0.3),
      armR: createHangingArm(1, rightArmSwing, 0.3),
    };
  }

  // Membuat pose lompat: jongkok, melayang, lalu mendarat dengan squash dan stretch
  function createJumpPose(
    elapsedTimeSeconds,
    basePosition,
    baseYaw,
    effectiveScale,
  ) {
    const jumpDuration = 1.25;
    const progress = clampValue(elapsedTimeSeconds / jumpDuration, 0, 1);

    let scaleX;
    let scaleY;
    if (progress < 0.16) {
      scaleX = interpolatePhase(progress, 0, 0.16, 1.0, 1.1);
      scaleY = interpolatePhase(progress, 0, 0.16, 1.0, 0.82);
    } else if (progress < 0.32) {
      scaleX = interpolatePhase(progress, 0.16, 0.32, 1.1, 0.94);
      scaleY = interpolatePhase(progress, 0.16, 0.32, 0.82, 1.16);
    } else if (progress < 0.7) {
      scaleX = interpolatePhase(progress, 0.32, 0.7, 0.94, 0.97);
      scaleY = interpolatePhase(progress, 0.32, 0.7, 1.16, 1.06);
    } else if (progress < 0.84) {
      scaleX = interpolatePhase(progress, 0.7, 0.84, 0.97, 1.14);
      scaleY = interpolatePhase(progress, 0.7, 0.84, 1.06, 0.78);
    } else {
      scaleX = interpolatePhase(progress, 0.84, 1.0, 1.14, 1.0);
      scaleY = interpolatePhase(progress, 0.84, 1.0, 0.78, 1.0);
    }

    const flightProgress = clampValue((progress - 0.16) / 0.68, 0, 1);
    const jumpHeight = Math.sin(Math.PI * flightProgress) * 0.42;

    let armAngle;
    if (progress < 0.16) {
      armAngle = interpolatePhase(progress, 0, 0.16, 0.15, -0.25);
    } else if (progress < 0.34) {
      armAngle = interpolatePhase(progress, 0.16, 0.34, -0.25, 2.15);
    } else if (progress < 0.7) {
      armAngle = interpolatePhase(progress, 0.34, 0.7, 2.15, 1.85);
    } else if (progress < 0.84) {
      armAngle = interpolatePhase(progress, 0.7, 0.84, 1.85, 0.45);
    } else {
      armAngle = interpolatePhase(progress, 0.84, 1.0, 0.45, 0.15);
    }

    let kneeBend;
    if (progress < 0.16) {
      kneeBend = interpolatePhase(progress, 0, 0.16, 0.04, 0.45);
    } else if (progress < 0.32) {
      kneeBend = interpolatePhase(progress, 0.16, 0.32, 0.45, 0.08);
    } else if (progress < 0.7) {
      kneeBend = interpolatePhase(progress, 0.32, 0.7, 0.08, 0.48);
    } else if (progress < 0.84) {
      kneeBend = interpolatePhase(progress, 0.7, 0.84, 0.48, 0.62);
    } else {
      kneeBend = interpolatePhase(progress, 0.84, 1.0, 0.62, 0.04);
    }

    const legSwing = Math.sin(progress * Math.PI * 2) * 0.12;

    let leanAngle;
    if (progress < 0.32) {
      leanAngle = interpolatePhase(progress, 0, 0.32, 0.08, -0.12);
    } else if (progress < 0.84) {
      leanAngle = interpolatePhase(progress, 0.32, 0.84, -0.12, 0.05);
    } else {
      leanAngle = interpolatePhase(progress, 0.84, 1.0, 0.05, 0);
    }

    return {
      placeMat: createBodyPlacement(
        basePosition,
        jumpHeight,
        baseYaw,
        leanAngle,
        effectiveScale,
        0,
        [scaleX, scaleY, scaleX],
      ),
      scale: effectiveScale,
      loco: "jump",
      isRun: false,
      expr: 1,
      lr: legSwing,
      ll: -legSwing,
      kr: kneeBend + 0.03,
      kl: kneeBend,
      armL: createJumpArm(-1, armAngle + 0.08),
      armR: createJumpArm(1, armAngle - 0.08),
    };
  }

  // Membuat pose menari: melangkah di tempat, goyang pinggul, tangan bergantian, dan berputar tiap 8 ketukan
  function createDancePose(
    elapsedTimeSeconds,
    basePosition,
    baseYaw,
    effectiveScale,
  ) {
    const settings = DANCE_SETTINGS;
    const beats = elapsedTimeSeconds * settings.beatsPerSecond;
    const stepPhase = beats * Math.PI;
    const stepSignal = Math.sin(stepPhase);
    const cycleBeat = beats % settings.beatsPerCycle;

    const twirlProgress = clampValue(
      (cycleBeat - settings.twirlStartBeat) /
        (settings.beatsPerCycle - settings.twirlStartBeat),
      0,
      1,
    );
    const twirlAngle = easingCubicInOut(twirlProgress) * FULL_TURN;
    const armsUpBlend = Math.sin(twirlProgress * Math.PI);

    const swayRotation = Matrix4.rotationAxis(
      settings.swayAxis,
      stepSignal * settings.swayAngle,
    );
    const twirlRotation = Matrix4.rotationAxis(settings.twirlAxis, twirlAngle);

    const bounceFactor = Math.abs(stepSignal);
    const bodyScale = [
      1.04 - 0.05 * bounceFactor,
      0.94 + 0.1 * bounceFactor,
      1.04 - 0.05 * bounceFactor,
    ];

    const leftArmFactor = stepSignal * 0.5 + 0.5;
    const rightArmFactor = -stepSignal * 0.5 + 0.5;
    const leftArmElevation = linearInterpolate(
      linearInterpolate(
        settings.armLowElevation,
        settings.armHighElevation,
        leftArmFactor,
      ),
      settings.armTwirlElevation,
      armsUpBlend,
    );
    const rightArmElevation = linearInterpolate(
      linearInterpolate(
        settings.armLowElevation,
        settings.armHighElevation,
        rightArmFactor,
      ),
      settings.armTwirlElevation,
      armsUpBlend,
    );

    const leftLegLift = Math.max(0, stepSignal);
    const rightLegLift = Math.max(0, -stepSignal);

    return {
      placeMat: createDancePlacement(
        basePosition,
        bounceFactor * settings.bounceHeight,
        baseYaw,
        swayRotation,
        twirlRotation,
        effectiveScale,
        bodyScale,
      ),
      scale: effectiveScale,
      loco: "dance",
      isRun: false,
      expr: 1,
      lr: rightLegLift * settings.stepLegSwing,
      ll: leftLegLift * settings.stepLegSwing,
      kr: settings.baseKneeBend + rightLegLift * settings.stepKneeBend,
      kl: settings.baseKneeBend + leftLegLift * settings.stepKneeBend,
      armL: createDanceArm(-1, leftArmElevation, settings.armOutwardAngle),
      armR: createDanceArm(1, rightArmElevation, settings.armOutwardAngle),
    };
  }

  // Membuat pose jalan atau lari dengan ayunan kaki, tekukan lutut, dan ayunan lengan
  function createLocomotionPose(
    animationMode,
    elapsedTimeSeconds,
    basePosition,
    baseYaw,
    effectiveScale,
  ) {
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

    const leftSwingSignal = -Math.sin(leftPhase);
    const rightSwingSignal = -Math.sin(rightPhase);

    const bobbingHeight = isRunning
      ? Math.abs(Math.sin(cyclePhase)) * 0.05 - 0.015
      : Math.sin(cyclePhase * 2) * 0.02;
    const leanAngle = isRunning ? 0.18 : 0.02;

    return {
      placeMat: createBodyPlacement(
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
      armL: createLocomotionArm(-1, leftSwingSignal, isRunning),
      armR: createLocomotionArm(1, rightSwingSignal, isRunning),
    };
  }

  // Menghasilkan pose BMO untuk mode idle, jump, dance, walk, atau run
  function getBmoPose(
    animationMode,
    elapsedTimeSeconds,
    basePosition = [0, 0, 0],
    baseYaw = 0,
    baseScale = 0.034,
  ) {
    const effectiveScale = baseScale || BMO_PROPORTIONS.defaultScale;

    if (animationMode === "idle") {
      return createIdlePose(
        elapsedTimeSeconds,
        basePosition,
        baseYaw,
        effectiveScale,
      );
    }
    if (animationMode === "jump") {
      return createJumpPose(
        elapsedTimeSeconds,
        basePosition,
        baseYaw,
        effectiveScale,
      );
    }
    if (animationMode === "dance") {
      return createDancePose(
        elapsedTimeSeconds,
        basePosition,
        baseYaw,
        effectiveScale,
      );
    }
    return createLocomotionPose(
      animationMode,
      elapsedTimeSeconds,
      basePosition,
      baseYaw,
      effectiveScale,
    );
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
