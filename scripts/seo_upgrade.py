#!/usr/bin/env python3
"""Tingkatkan SEO statis DEBATRE (idempoten, aman dijalankan berulang).

Yang ditambahkan:
  1. robots.txt + sitemap.xml
  2. Open Graph + Twitter Card + canonical di setiap halaman
  3. JSON-LD: WebApplication (beranda), Article (artikel), CollectionPage (daftar artikel),
     FAQPage (beranda)
  4. Blok isi 500+ kata di beranda (cara pakai, contoh hitung, kesalahan umum)
  5. Tautan internal: artikel → kalkulator & artikel lain, beranda → artikel

Pemakaian: python3 scripts/seo_upgrade.py
"""
import html
import re
from datetime import date
from pathlib import Path

ROOT = Path("/home/dedbiznet/calc")
BASE = "https://www.debatre.com"
HARI = date.today().isoformat()
MARK = "<!-- SEO-OG -->"

HALAMAN = {
    "index.html": "/",
    "artikel/index.html": "/artikel/",
    **{f"artikel/artikel-{i}.html": f"/artikel/artikel-{i}.html" for i in range(1, 8)},
}

GAMBAR = f"{BASE}/artikel-1-thumb.png"


def ambil(pola: str, teks: str, bawaan: str = "") -> str:
    m = re.search(pola, teks, re.S | re.I)
    return html.unescape(m.group(1).strip()) if m else bawaan


def meta_seo(judul: str, deskripsi: str, url: str, tipe: str = "website") -> str:
    j = html.escape(judul, quote=True)
    d = html.escape(deskripsi, quote=True)
    return f"""{MARK}
    <link rel="canonical" href="{url}">
    <meta property="og:type" content="{tipe}">
    <meta property="og:site_name" content="DEBATRE">
    <meta property="og:locale" content="id_ID">
    <meta property="og:title" content="{j}">
    <meta property="og:description" content="{d}">
    <meta property="og:url" content="{url}">
    <meta property="og:image" content="{GAMBAR}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{j}">
    <meta name="twitter:description" content="{d}">
    <meta name="twitter:image" content="{GAMBAR}">
"""


def ld(objek: str) -> str:
    return f'\n    <script type="application/ld+json">{objek}</script>\n'


LD_APP = ld("""{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "DEBATRE - Kalkulator PLTS & Baterai LiFePO4",
  "url": "https://www.debatre.com/",
  "applicationCategory": "UtilitiesApplication",
  "operatingSystem": "Web, Android, iOS",
  "inLanguage": "id-ID",
  "description": "Kalkulator kebutuhan baterai LiFePO4, panel surya, dan SCC untuk PLTS. Menghitung Ah, Wp, dan ampere pengisian secara real-time.",
  "offers": {"@type": "Offer", "price": "0", "priceCurrency": "IDR"},
  "featureList": [
    "Hitung kapasitas baterai (Ah) dengan asumsi DoD 80%",
    "Hitung kebutuhan panel surya (Wp) memakai PSH dan faktor 1,25",
    "Hitung arus pengisian SCC dalam ampere",
    "Bekerja offline setelah dibuka pertama kali"
  ]
}""")

FAQ = [
    ("Berapa kedalaman pengosongan (DoD) yang aman untuk baterai LiFePO4?",
     "Untuk LiFePO4, kedalaman pengosongan 80% masih aman untuk pemakaian harian dan "
     "kalkulator ini memakai asumsi 80%. Menekan DoD ke 70% membuat umur siklus lebih panjang, "
     "tetapi kapasitas baterai yang dibeli harus lebih besar."),
    ("Kenapa hasil perhitungan panel surya lebih besar dari beban?",
     "Karena ada dua penyesuaian: susut inverter (asumsi 85%) dan faktor pengali 1,25 untuk "
     "mengkompensasi cuaca mendung, debu panel, serta kehilangan pada kabel dan SCC. "
     "Rumusnya: Wp = (Wh beban ÷ efisiensi inverter × 1,25) ÷ PSH."),
    ("Apa itu PSH dan berapa nilainya di Indonesia?",
     "PSH (Peak Sun Hours) adalah jumlah jam matahari efektif per hari. Sebagian besar wilayah "
     "Indonesia berada di 4–5 jam; kalkulator memakai 5 jam sebagai bawaan dan bisa diubah "
     "lewat opsi lanjutan."),
    ("Apakah kalkulator ini butuh internet?",
     "Tidak. Setelah halaman terbuka sekali, kalkulator bekerja offline dan bisa dipasang "
     "seperti aplikasi di HP."),
    ("Apakah hasil kalkulator bisa langsung dipakai untuk membeli komponen?",
     "Hasilnya adalah perkiraan perencanaan, bukan jaminan. Tambahkan margin 10–20% pada "
     "kapasitas baterai dan panel, lalu sesuaikan dengan spesifikasi SCC serta kabel yang dipakai."),
]

LD_FAQ = ld("""{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
""" + ",\n".join(
    '    {"@type": "Question", "name": "%s", "acceptedAnswer": {"@type": "Answer", "text": "%s"}}'
    % (html.escape(q, quote=True), html.escape(a, quote=True)) for q, a in FAQ
) + """
  ]
}""")

LD_ARTIKEL = lambda judul, deskripsi, url: ld("""{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "%s",
  "description": "%s",
  "url": "%s",
  "image": "%s",
  "inLanguage": "id-ID",
  "author": {"@type": "Organization", "name": "DEBATRE"},
  "publisher": {"@type": "Organization", "name": "DEBATRE", "logo": {"@type": "ImageObject", "url": "%s/icon-512.png"}},
  "dateModified": "%s"
}""" % (html.escape(judul, quote=True), html.escape(deskripsi, quote=True),
          url, GAMBAR, BASE, HARI))

LD_DAFTAR = ld("""{
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "name": "Artikel DEBATRE",
  "url": "https://www.debatre.com/artikel/",
  "inLanguage": "id-ID",
  "isPartOf": {"@type": "WebSite", "name": "DEBATRE", "url": "https://www.debatre.com/"}
}""")

KONTEN_BERANDA = """
        <!-- SEO-KONTEN: blok isi untuk pengunjung & mesin pencari -->
        <section id="panduan" class="bg-slate-900/60 backdrop-blur-sm border border-slate-800 rounded-3xl p-5 sm:p-8 md:p-10 mb-8">
            <h2 class="text-2xl sm:text-3xl font-bold text-white mb-4">Cara Menghitung Kebutuhan Baterai &amp; Panel Surya</h2>
            <p class="text-slate-300 mb-4">
                Kalkulator ini menjawab satu pertanyaan yang paling sering muncul sebelum membeli
                komponen PLTS: <strong>berapa kapasitas baterai (Ah) dan berapa besar panel surya
                (Wp) yang saya butuhkan?</strong> Hasilnya muncul seketika saat Anda mengubah angka
                pemakaian.
            </p>

            <h3 class="text-xl font-semibold text-white mt-6 mb-2">Tiga angka yang perlu Anda siapkan</h3>
            <ol class="list-decimal pl-6 space-y-2 text-slate-300">
                <li><strong>Daya peralatan (watt)</strong> — jumlahkan semua alat yang akan dinyalakan bersamaan.
                    Lampu 10 W × 4, kulkas 100 W, TV 60 W berarti 200 W.</li>
                <li><strong>Lama pakai (jam)</strong> — berapa jam peralatan itu menyala setiap hari, bukan per malam saja.</li>
                <li><strong>Tegangan sistem (V)</strong> — 12 V untuk beban kecil, 24 V atau 48 V untuk beban besar.
                    Tegangan lebih tinggi membuat arus lebih kecil dan kabel lebih ringan.</li>
            </ol>

            <h3 class="text-xl font-semibold text-white mt-6 mb-2">Contoh perhitungan lengkap</h3>
            <p class="text-slate-300 mb-3">
                Misalkan beban 500 W menyala 6 jam sehari, sistem 24 V, PSH 5 jam, dan inverter
                ber-efisiensi 85%. Langkahnya:
            </p>
            <ol class="list-decimal pl-6 space-y-2 text-slate-300">
                <li>Energi beban: 500 W × 6 jam = <strong>3.000 Wh</strong>.</li>
                <li>Tambahkan susut inverter: 3.000 Wh ÷ 0,85 = <strong>±3.529 Wh</strong>.</li>
                <li>Kapasitas baterai (DoD 80%): 3.529 Wh ÷ (24 V × 0,8) = <strong>±184 Ah</strong>.</li>
                <li>Kebutuhan panel: (3.529 Wh × 1,25) ÷ 5 jam = <strong>±882 Wp</strong>.</li>
            </ol>
            <p class="text-slate-300 mt-3">
                Jadi perencanaannya: baterai LiFePO4 24 V sekitar 200 Ah, panel 900–1.000 Wp
                (misalnya 2 panel 550 Wp), dan SCC yang mampu menangani arus pengisian sesuai
                tegangan sistem. Angka pada kalkulator dibulatkan ke atas, sama seperti contoh ini.
            </p>

            <h3 class="text-xl font-semibold text-white mt-6 mb-2">Lima kesalahan yang paling sering terjadi</h3>
            <ol class="list-decimal pl-6 space-y-2 text-slate-300">
                <li><strong>Menganggap baterai bisa dikosongkan 100%.</strong> Untuk pemakaian harian,
                    gunakan asumsi DoD 80% seperti kalkulator ini.</li>
                <li><strong>Lupa susut inverter.</strong> Inverter mengubah DC ke AC dengan efisiensi
                    85–95%; mengabaikannya membuat baterai cepat habis.</li>
                <li><strong>PSH terlalu optimis.</strong> Memakai 6–7 jam matahari membuat panel terpasang
                    terlalu kecil untuk musim mendung.</li>
                <li><strong>SCC dan kabel tidak dihitung.</strong> Arus pengisian yang besar butuh SCC dengan
                    kapasitas ampere memadai dan kabel yang tidak panas.</li>
                <li><strong>Menaruh baterai di tempat panas.</strong> Suhu tinggi memperpendek umur LiFePO4;
                    sediakan ventilasi dan hindari sinar matahari langsung.</li>
            </ol>

            <h3 class="text-xl font-semibold text-white mt-6 mb-2">Kapan perlu menambah panel atau baterai</h3>
            <p class="text-slate-300">
                Jika baterai sering turun di bawah 20% sebelum pagi, tambahkan kapasitas baterai.
                Jika baterai tidak pernah penuh pada siang hari, tambahkan panel. Dua gejala ini
                berbeda dan penanganannya juga berbeda — menambah panel tidak akan menolong bila
                baterainya sudah terlalu kecil.
            </p>

            <h3 class="text-xl font-semibold text-white mt-6 mb-2">Pertanyaan yang sering diajukan</h3>
            <div class="space-y-4 text-slate-300">
""" + "\n".join(
    f"""                <div>
                    <p class="font-semibold text-white">{html.escape(q)}</p>
                    <p>{html.escape(a)}</p>
                </div>""" for q, a in FAQ
) + """
            </div>

            <p class="text-slate-300 mt-6">
                Baca lanjutan: <a class="text-cyan-400 underline" href="/artikel/artikel-7.html">5 kesalahan hitung kebutuhan panel surya</a>,
                <a class="text-cyan-400 underline" href="/artikel/artikel-2.html">arti tarif 143% bagi pembeli panel</a>, dan
                <a class="text-cyan-400 underline" href="/artikel/artikel-5.html">PLTS terapung: keunggulan dan tantangannya</a>.
            </p>
        </section>
"""


def baca_meta(nama: str) -> tuple[str, str, str]:
    teks = (ROOT / nama).read_text(encoding="utf-8")
    judul = ambil(r"<title[^>]*>(.*?)</title>", teks, "DEBATRE")
    deskripsi = ambil(r'name=["\']description["\'][^>]*content=["\'](.*?)["\']', teks, "") or \
        ambil(r'content=["\'](.*?)["\'][^>]*name=["\']description["\']', teks, "")
    return judul, deskripsi, teks


def proses(nama: str) -> str:
    judul, deskripsi, teks = baca_meta(nama)
    url = BASE + HALAMAN[nama]
    tipe = "article" if nama.startswith("artikel/artikel-") else "website"

    # buang blok lama agar idempoten
    teks = re.sub(re.escape(MARK) + r".*?<meta name=\"twitter:image\"[^>]*>\n", "", teks, flags=re.S)
    teks = re.sub(r'\n?\s*<script type="application/ld\+json">.*?</script>\n', "\n", teks, flags=re.S)
    teks = re.sub(r'\n?\s*<!-- SEO-KONTEN.*?</section>\n', "\n", teks, flags=re.S)
    teks = re.sub(r'\n?\s*<!-- SEO-BACA-JUGA -->.*?</nav>\n', "\n", teks, flags=re.S)

    # 2) meta OG/Twitter + canonical
    if "</title>" in teks:
        teks = teks.replace("</title>", "</title>\n" + meta_seo(judul, deskripsi, url, tipe), 1)

    # 3) JSON-LD
    ld_blok = LD_APP + LD_FAQ if nama == "index.html" else (
        LD_DAFTAR if nama == "artikel/index.html" else LD_ARTIKEL(judul, deskripsi, url))
    teks = teks.replace("</head>", ld_blok + "</head>", 1)

    # 4) blok isi beranda
    if nama == "index.html":
        anchor = '<section id="artikelSection"'
        if anchor in teks:
            teks = teks.replace(anchor, KONTEN_BERANDA + "\n        " + anchor, 1)

    # 5) tautan internal artikel → kalkulator + artikel lain
    if nama.startswith("artikel/artikel-"):
        nomor = int(re.search(r"artikel-(\d+)", nama).group(1))
        lain = [n for n in range(1, 8) if n != nomor][:3]
        tautan = "\n".join(
            f'                <li><a class="text-cyan-400 underline" href="/artikel/artikel-{n}.html">'
            f'{html.escape(ambil(r"<title[^>]*>(.*?)</title>", (ROOT / f"artikel/artikel-{n}.html").read_text(encoding="utf-8"), f"Artikel {n}").split(" - ")[0])}'
            f'</a></li>' for n in lain)
        blok = f"""
        <!-- SEO-BACA-JUGA -->
        <nav class="mt-10 p-5 rounded-2xl border border-slate-800 bg-slate-900/60">
            <p class="font-semibold text-white mb-3">Baca juga &amp; hitung kebutuhan Anda</p>
            <ul class="list-disc pl-5 space-y-2 text-slate-300">
{tautan}
                <li><a class="text-cyan-400 underline" href="/">Buka kalkulator PLTS &amp; baterai LiFePO4</a></li>
            </ul>
        </nav>
"""
        if "</article>" in teks:
            teks = teks.replace("</article>", blok + "        </article>", 1)

    (ROOT / nama).write_text(teks, encoding="utf-8")
    return f"{nama:32} judul={judul[:45]!r} desc={len(deskripsi)} char"


def tulis_robots_sitemap() -> str:
    robots = f"""User-agent: *
Allow: /
Disallow: /analytics.html
Disallow: /api/
Disallow: /tracker.js

Sitemap: {BASE}/sitemap.xml
"""
    (ROOT / "robots.txt").write_text(robots, encoding="utf-8")

    url = [f"{BASE}/", f"{BASE}/artikel/"] + [f"{BASE}/artikel/artikel-{i}.html" for i in range(1, 8)]
    isi = ['<?xml version="1.0" encoding="UTF-8"?>',
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for u in url:
        pr = "1.0" if u == f"{BASE}/" else ("0.8" if "/artikel/" in u else "0.6")
        isi.append(f"  <url>\n    <loc>{u}</loc>\n    <lastmod>{HARI}</lastmod>\n"
                   f"    <changefreq>weekly</changefreq>\n    <priority>{pr}</priority>\n  </url>")
    isi.append("</urlset>")
    (ROOT / "sitemap.xml").write_text("\n".join(isi) + "\n", encoding="utf-8")
    return f"robots.txt + sitemap.xml ditulis ({len(url)} URL)"


if __name__ == "__main__":
    print(tulis_robots_sitemap())
    for nama in HALAMAN:
        print(" ", proses(nama))
