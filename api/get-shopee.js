// api/get-shopee.js
export default async function handler(req, res) {
  // Mengambil keyword pencarian dari frontend (misal: "baterai lifepo4")
  const { query } = req.query; 

  if (!query) {
    return res.status(400).json({ error: 'Query pencarian tidak boleh kosong' });
  }

  // Vercel akan otomatis mengambil token yang sudah Anda simpan di Env Var kemarin
  const crawlbaseToken = process.env.CRAWLBASE_JS_TOKEN;
  
  // URL tujuan pencarian di Shopee
  const targetUrl = `https://shopee.co.id/search?keyword=${encodeURIComponent(query)}`;

  // Gabungkan ke API Crawlbase dengan rendering JavaScript aktif
  const crawlbaseApiUrl = `https://api.crawlbase.com/?token=${crawlbaseToken}&url=${encodeURIComponent(targetUrl)}&ajax_wait=true`;

  try {
    const response = await fetch(crawlbaseApiUrl);
    const htmlContent = await response.text();

    // Kirimkan HTML mentah Shopee ini kembali ke index.html untuk diproses
    return res.status(200).json({ 
      success: true, 
      html: htmlContent 
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
