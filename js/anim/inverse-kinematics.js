(function () {
  "use strict";

  const App = (window.App = window.App || {});
  App.anim = App.anim || {};
  const Vector3 =
    App.math.Vector3 ||
    App.math.V3 ||
    (window.JK && (window.JK.Vector3 || window.JK.V3));
  const Matrix4 =
    App.math.Matrix4 ||
    App.math.Mat4 ||
    (window.JK && (window.JK.Matrix4 || window.JK.Mat4));

  // Menyelesaikan analytical two-bone Inverse Kinematics (IK) untuk menghitung posisi sendi siku dan pergelangan tangan.
  function solveTwoBoneInverseKinematics(
    shoulderPosition,
    targetPosition,
    poleVector,
    upperBoneLength = 0.5,
    lowerBoneLength = 0.5,
  ) {
    let directionToTarget = Vector3.subtract(targetPosition, shoulderPosition);
    let distanceToTarget = Vector3.length(directionToTarget);
    const maximumReach = upperBoneLength + lowerBoneLength;

    if (distanceToTarget > maximumReach) {
      directionToTarget = Vector3.multiplyScalar(
        directionToTarget,
        maximumReach / distanceToTarget,
      );
      distanceToTarget = maximumReach;
    }
    if (distanceToTarget < 0.1) {
      directionToTarget = Vector3.multiplyScalar(
        Vector3.normalize(directionToTarget),
        0.1,
      );
      distanceToTarget = 0.1;
    }

    const normalizedDirection = Vector3.multiplyScalar(
      directionToTarget,
      1 / distanceToTarget,
    );
    const shoulderToElbowProjection =
      (upperBoneLength * upperBoneLength -
        lowerBoneLength * lowerBoneLength +
        distanceToTarget * distanceToTarget) /
      (2 * distanceToTarget);
    const elbowHeight = Math.sqrt(
      Math.max(0, upperBoneLength * upperBoneLength - shoulderToElbowProjection * shoulderToElbowProjection),
    );

    let perpendicularPole = Vector3.subtract(
      poleVector,
      Vector3.multiplyScalar(
        normalizedDirection,
        Vector3.dot(poleVector, normalizedDirection),
      ),
    );
    perpendicularPole =
      Vector3.length(perpendicularPole) < 1e-4
        ? [0, 0, -1]
        : Vector3.normalize(perpendicularPole);

    const elbowPosition = Vector3.add(
      shoulderPosition,
      Vector3.add(
        Vector3.multiplyScalar(normalizedDirection, shoulderToElbowProjection),
        Vector3.multiplyScalar(perpendicularPole, elbowHeight),
      ),
    );
    const handPosition = Vector3.add(shoulderPosition, directionToTarget);

    return {
      elbowPosition,
      handPosition,
      E: elbowPosition,
      H: handPosition,
    };
  }

  // Menghasilkan matriks orientasi 4x4 untuk mengarahkan sendi tulang berdasarkan titik awal dan arah vektor.
  function orientLimb(originPosition, limbDirection) {
    const axisY = Vector3.multiplyScalar(Vector3.normalize(limbDirection), -1);
    let axisX = Vector3.cross(axisY, [0, 0, 1]);
    if (Vector3.length(axisX) < 0.25) {
      axisX = Vector3.cross(axisY, [1, 0, 0]);
    }
    axisX = Vector3.normalize(axisX);
    const axisZ = Vector3.cross(axisX, axisY);

    return Matrix4.fromBasis(originPosition, axisX, axisY, axisZ);
  }

  App.anim.solveTwoBoneInverseKinematics = solveTwoBoneInverseKinematics;
  App.anim.solveTwoBoneIK = solveTwoBoneInverseKinematics;
  App.anim.orientLimb = orientLimb;
})();
