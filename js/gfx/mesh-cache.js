(function () {
  "use strict";

  const App = (window.App = window.App || {});
  App.gfx = App.gfx || {};

  const meshStorageMap = new Map();

  const MeshCache = {
    // Mengambil mesh geometri dari memori cache atau membuatnya lewat factory function jika belum ada.
    get(cacheKey, createMeshFactory) {
      if (meshStorageMap.has(cacheKey)) {
        return meshStorageMap.get(cacheKey);
      }
      const createdMesh = createMeshFactory();
      meshStorageMap.set(cacheKey, createdMesh);
      return createdMesh;
    },

    // Memeriksa apakah sebuah mesh dengan kunci tertentu sudah tersimpan di cache.
    has(cacheKey) {
      return meshStorageMap.has(cacheKey);
    },

    // Menghapus dan membersihkan seluruh mesh yang tersimpan di dalam cache.
    clear() {
      meshStorageMap.clear();
    },
  };

  App.gfx.MeshCache = MeshCache;
})();
