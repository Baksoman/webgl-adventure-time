(function () {
  "use strict";

  const App = (window.App = window.App || {});
  App.math = App.math || {};

  const Vector3 = {
    // Menjumlahkan dua vektor 3 dimensi (vectorA + vectorB).
    add: (vectorA, vectorB) => [
      vectorA[0] + vectorB[0],
      vectorA[1] + vectorB[1],
      vectorA[2] + vectorB[2],
    ],

    // Mengurangkan dua vektor 3 dimensi (vectorA - vectorB).
    subtract: (vectorA, vectorB) => [
      vectorA[0] - vectorB[0],
      vectorA[1] - vectorB[1],
      vectorA[2] - vectorB[2],
    ],

    // Mengalikan vektor 3 dimensi dengan bilangan skalar.
    multiplyScalar: (vector, scalarValue) => [
      vector[0] * scalarValue,
      vector[1] * scalarValue,
      vector[2] * scalarValue,
    ],

    // Menghitung hasil kali titik (dot product) antara dua vektor 3 dimensi.
    dot: (vectorA, vectorB) =>
      vectorA[0] * vectorB[0] +
      vectorA[1] * vectorB[1] +
      vectorA[2] * vectorB[2],

    // Menghitung hasil kali silang (cross product) antara dua vektor 3 dimensi.
    cross: (vectorA, vectorB) => [
      vectorA[1] * vectorB[2] - vectorA[2] * vectorB[1],
      vectorA[2] * vectorB[0] - vectorA[0] * vectorB[2],
      vectorA[0] * vectorB[1] - vectorA[1] * vectorB[0],
    ],

    // Menghitung panjang atau magnitudo dari vektor 3 dimensi.
    length: (vector) => Math.hypot(vector[0], vector[1], vector[2]),

    // Mengubah vektor 3 dimensi menjadi vektor satuan dengan panjang bernilai 1.
    normalize: (vector) => {
      const vectorLength = Math.hypot(vector[0], vector[1], vector[2]) || 1;
      return [
        vector[0] / vectorLength,
        vector[1] / vectorLength,
        vector[2] / vectorLength,
      ];
    },

    // Menghitung interpolasi linear (lerp) antara dua vektor 3 dimensi.
    lerp: (vectorStart, vectorEnd, interpolationFactor) => [
      vectorStart[0] + (vectorEnd[0] - vectorStart[0]) * interpolationFactor,
      vectorStart[1] + (vectorEnd[1] - vectorStart[1]) * interpolationFactor,
      vectorStart[2] + (vectorEnd[2] - vectorStart[2]) * interpolationFactor,
    ],
  };

  // Alias kompatibilitas
  Vector3.sub = Vector3.subtract;
  Vector3.mul = Vector3.multiplyScalar;
  Vector3.len = Vector3.length;
  Vector3.norm = Vector3.normalize;

  App.math.Vector3 = Vector3;
  App.math.V3 = Vector3;

  window.JK = window.JK || {};
  window.JK.Vector3 = Vector3;
  window.JK.V3 = Vector3;
})();
