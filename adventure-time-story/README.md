# Adventure Time — Malam Permainan BMO yang Kacau (WebGL murni)

Buka `index.html` di Chrome/Edge (tanpa server/library). ±2 menit 48 detik, 6 babak.

**Kontrol**: Spasi jeda · R ulang · ←/→ lompat 5 dtk · C kamera bebas (seret/roda) · M suara · Q kualitas (HD/SD/LD, otomatis turun di perangkat lambat) · F layar penuh · ⏺ rekam video .webm (adegan + subtitle + emote + kartu, dengan audio).

**Struktur**
- `js/story-data.js` — semua DATA cerita: babak, subtitle, emote, ekspresi, jalur karakter, kamera. Sunting di sini.
- `js/story.js` — logika adegan (perintah aktor tiap waktu t, kamera, efek).
- `js/props.js` — ruangan, rak, meja, kaset, boneka · `js/decor.js` — dekorasi & cahaya.
- `js/jake.js`, `jake-actor.js`, `finn.js`, `bmo.js` — model & aktor · `js/engine.js` — renderer toon + outline.
- Semua gerak = fungsi waktu cerita (deterministik, PRNG berbenih) sehingga lompat waktu selalu konsisten.

**Tes visual**: `npm install && npx playwright install chromium && npm test` (`npm run test:update` untuk memperbarui baseline).
