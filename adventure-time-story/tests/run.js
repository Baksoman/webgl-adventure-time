/* Tes visual otomatis (regresi) untuk cerita.
   Jalankan:  npm install && npx playwright install chromium && npm test
   Perbarui baseline setelah perubahan yang disengaja:  npm run test:update
   Yang diperiksa: (1) tidak ada error JS/WebGL, (2) kanvas tidak kosong, (3) deterministik (seek 2x ke waktu sama -> gambar sama),
   (4) gambar tiap momen kunci mirip dengan baseline (selisih rata-rata < ambang). */
const fs = require('fs'), path = require('path');
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { console.error('Playwright belum terpasang: npm install'); process.exit(2); }

const UPDATE = process.argv.includes('--update');
const DIR = path.join(__dirname, 'baseline');
const MOMENTS = [1, 10, 20, 35, 44, 62, 90, 105, 118, 122.6, 123.4, 130, 144, 156];   // detik cerita
const THRESH = 0.02;                                                                  // selisih rata-rata maksimum (0..1)

(async () => {
    const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
    const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
    const errors = [];
    page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/GL Driver|favicon/.test(m.text())) errors.push(m.text()); });
    await page.goto('file://' + path.join(__dirname, '..', 'index.html'));
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 15000 });
    await page.addStyleTag({ content: '#bar,#subtitle,#banner,#title,#endcard,#toast,.emote,#start{display:none!important}' });
    const shot = async (t) => { await page.evaluate(t => window.__goTo(t), t); await page.waitForTimeout(60); return page.screenshot(); };
    const diff = async (a, b) => page.evaluate(async ([A, B]) => {
        const load = (s) => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + s; });
        const [ia, ib] = await Promise.all([load(A), load(B)]);
        const px = (im) => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
        const da = px(ia), db = px(ib); let s = 0; for (let i = 0; i < da.length; i += 4) s += (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2])) / 765;
        return s / (da.length / 4);
    }, [a.toString('base64'), b.toString('base64')]);
    const spread = async (buf) => page.evaluate(async (S) => {
        const i = await new Promise(r => { const im = new Image(); im.onload = () => r(im); im.src = 'data:image/png;base64,' + S; });
        const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d'); x.drawImage(i, 0, 0);
        const d = x.getImageData(0, 0, c.width, c.height).data; let m = 0, n = d.length / 4; for (let k = 0; k < d.length; k += 4) m += d[k] + d[k + 1] + d[k + 2];
        m /= n * 3; let v = 0; for (let k = 0; k < d.length; k += 4) v += ((d[k] + d[k + 1] + d[k + 2]) / 3 - m) ** 2; return Math.sqrt(v / n);
    }, buf.toString('base64'));

    let fail = 0; const ok = (c, msg) => { console.log((c ? '  ok   ' : '  GAGAL ') + msg); if (!c) fail++; };
    for (const t of MOMENTS) {
        const buf = await shot(t), file = path.join(DIR, 't' + String(t).replace('.', '_') + '.png');
        ok((await spread(buf)) > 8, `t=${t}s kanvas tidak kosong`);
        if (UPDATE) { fs.writeFileSync(file, buf); continue; }
        if (!fs.existsSync(file)) { ok(false, `t=${t}s baseline belum ada (jalankan npm run test:update)`); continue; }
        const d = await diff(buf, fs.readFileSync(file)); ok(d < THRESH, `t=${t}s mirip baseline (selisih ${(d * 100).toFixed(2)}%)`);
    }
    // determinisme: dua kali seek ke waktu sama harus identik
    for (const t of [44, 123.4]) { const a = await shot(t); await shot(10); const b = await shot(t); const d = await diff(a, b); ok(d < 0.002, `t=${t}s deterministik setelah lompat waktu (selisih ${(d * 100).toFixed(3)}%)`); }
    ok(errors.length === 0, 'tidak ada error JS/WebGL' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
    await browser.close();
    if (UPDATE) console.log('Baseline diperbarui di', DIR); else console.log(fail ? `\n${fail} pemeriksaan gagal` : '\nSemua pemeriksaan lulus');
    process.exit(fail ? 1 : 0);
})();
