# Translate Helper

Kompakt, cümle cümle çeviri çalışma alanı. React ve Vite ile hazırlanmış tek sayfalık bir uygulamadır.

## Kullanım

1. Belgeye bir başlık verin, kaynak dilini seçin ve metni yapıştırın.
2. Cümle sonları ve satır sonları için ayırma seçeneklerini belirleyin. İngilizce/Türkçe kısaltmalar varsayılan olarak korunur.
3. **Çeviriye başla** ile her cümlenin karşısına çevirisini yazın. **Ctrl + Enter / Cmd + Enter** sonraki cümleye; Shift eklenirse önceki cümleye geçer.
4. **PDF indir** ile özgün metin üstte, çeviri altta olacak şekilde bir PDF indirin. Yan yana veya yalnızca çeviri düzeni de seçilebilir. PDF metni seçilebilir ve Türkçe karakterler desteklenir.

Çalışma bu tarayıcının `localStorage` alanına otomatik kaydedilir. Tarayıcı verileri silinirse veya farklı bir cihaza geçilirse kayıt taşınmaz; **Dosya → JSON yedeği indir** ile yedekleyin ve **JSON yedeği aç** ile geri yükleyin. TXT dışa aktarımı ve toplu kopyalama boş çevirileri atlar, paragraf aralarını korur.

Tamamlanan cümle, çeviri alanında boşluk dışında en az bir karakter bulunan cümledir. Uygulama manuel çeviri içindir; otomatik çeviri servisi veya API anahtarı gerekmez. Metinler bir sunucuya gönderilmez.

Normal uzunluktaki cümle çiftleri PDF’de aynı sayfada tutulur. Tek bir cümle çifti bir sayfadan uzunsa, metin satır sınırlarında ve “devam” etiketiyle sonraki sayfaya aktarılır. Tarayıcının yazdırma seçeneğinde de `break-inside: avoid` kuralları uygulanır.

## Geliştirme

Node.js 22.12 veya üzeri:

```bash
npm ci
npm run dev
npm test
npm run build
```

## Cloudflare Pages

GitHub deposunu Cloudflare Pages’e bağlayın ve şu ayarları kullanın:

| Ayar | Değer |
| --- | --- |
| Framework preset | Vite |
| Production branch | `main` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | Boş / depo kökü |
| Node.js | 22 veya üzeri (`NODE_VERSION=22`) |

Sunucu, veritabanı, Pages Functions veya gizli ortam değişkeni gerekmez. Cloudflare Pages, sonraki `main` commit’lerinde uygulamayı yeniden derleyip yayımlar.

Resmî dağıtım rehberi: https://developers.cloudflare.com/pages/framework-guides/deploy-a-vite3-project/

PDF’de kullanılan DejaVu yazı tiplerinin lisansı `public/fonts/LICENSE.txt` dosyasındadır.
