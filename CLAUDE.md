# CLAUDE.md

Bu dosya, bu depoda çalışırken Claude Code'a rehberlik eder.

## Proje Özeti

Kaza Namazı Takip, kullanıcının kaza (kılınmamış) namazlarını vakitlere göre
takip etmesini sağlayan, tek sayfalık, framework içermeyen bir web
uygulamasıdır. Kullanıcı her vakit için kalan kaza sayısını girer, kıldıkça
sayacı azaltır; ayrıca büluğ tarihine dayalı otomatik hesaplama, ilerleme
istatistikleri, geçmiş kayıt ve JSON yedekleme gibi özellikler sunar.

## Mimari

- **Tek dosya**: Tüm uygulama `index.html` içinde yaşar (HTML + CSS + vanilla
  JS, tek `<script>` bloğu içinde). Build adımı, paket yöneticisi veya
  framework yoktur.
- **PWA**: `manifest.json` + `sw.js` (service worker) ile uygulama
  installable ve offline çalışabilir durumdadır. `icons/` altında hem
  köşeleri yuvarlatılmış "any" ikonlar hem de tam kare "maskable" ikon
  bulunur (kaynak `.svg` dosyaları da orada saklanır — yeni bir ikon
  boyutu gerekirse onlardan yeniden render edilebilir). `sw.js`
  network-first + cache fallback stratejisi kullanır; önbelleği
  güncellemek (örn. yeni bir statik dosya eklendiğinde) için `sw.js`
  içindeki `CACHE_NAME` değerini artırın — aksi halde kullanıcılar eski
  önbellekten servis edilmeye devam edebilir.
- **Veri saklama**: Durum tamamen tarayıcının `localStorage`'ında saklanır,
  birbirine bağlı birden fazla anahtar altında:
  - `kazaData` — her vakit için **kalan** kaza sayısı (`data`)
  - `kazaStart` — her vakit için **başlangıç/taban** sayısı (`startData`);
    ilerleme yüzdesi `(startData - data) / startData` olarak hesaplanır
  - `kazaLog` — kılınan her kaza için `{id, date, key, amount, ts,
    enteredVakit}` girişleri (streak, tahmini bitiş ve Geçmiş ekranı
    bunlardan türetilir). `enteredVakit`, kaydın günün hangi saat
    diliminde girildiğini tutar (bkz. `currentVakitKey()`) — `key`'den
    farklı olabilir (örn. ikindi vaktinde sabah kazası kılınması); sadece
    bilgi amaçlıdır, konum kullanmayan kaba bir saat aralığı tahminidir.
  - `kazaLastChange` — `{key, ts}`, en son hangi vaktin değiştiği (satır
    vurgusu ve saniyeye kadar zaman gösterimi için)
  - `kazaProfile` — "Otomatik Hesapla" modalına girilen değerler (doğum
    tarihi, cinsiyet, büluğ tarihi, eksiksiz namaza başlama tarihi vb.),
    modal her açıldığında geri doldurulur
  - `kazaMilestone` — en son kutlanan 50'lik ilerleme eşiği
  - `kazaGoal` — günlük hedef (`goal`), toplam vakit bağımsız tek bir sayı;
    0 ise hedef kapalı demektir. Stats satırındaki üçüncü kutuda
    ("Bugün kılınan") gösterilir, kutuya dokununca `setGoal()` açılır.
  - `kazaUpdatedAt` — yerel state'in en son ne zaman değiştiğini tutan bir
    epoch-ms damgası; yalnızca bulut senkron modülü tarafından kullanılır
    (bkz. aşağıdaki "Bulut senkronizasyonu" maddesi), yedekleme dosyasına
    dahil edilmez.
  - Sunucu tarafı veya ağ isteği yoktur (bulut senkron modülü hariç); her
    şey `saveAll()` üzerinden localStorage'a yazılır.
- **Bulut senkronizasyonu (opsiyonel)**: `index.html` sonunda ayrı bir
  `<script type="module">` bloğu, Google girişi yapan kullanıcılar için
  Firebase Auth + Firestore üzerinden cihazlar arası senkron sağlar. Bu
  blok ana (module olmayan) script'ten bağımsızdır; köprü iki noktadan
  kurulur: `saveAll()` sonunda `window.__onLocalSave?.()` çağrılır (yerel
  değişikliği buluta iter), uzaktan gelen değişiklik `applyCloudPayload()`
  → `reloadStateFromStorage()` (yalnızca localStorage'ı okuyup `render()`
  çağırır, tekrar buluta yazmaz — döngü olmasın diye `saveAll()` DEĞİL bu
  çağrılır) ile yerel duruma yansır.
  **Giriş anında çakışma çözümü**: `handleSignedIn()` yalnızca zaman
  damgasına göre otomatik/sessiz seçim YAPMAZ — içerik (data/startData/
  log/lastChange/profile/milestone/goal) buluttakiyle birebir aynıysa
  hiçbir şey yapmadan dinlemeye geçer, farklıysa `showSyncConflictModal()`
  ile kullanıcıya her iki tarafın özetini (toplam kalan, kayıt sayısı, son
  güncelleme) gösterip elle seçtirir. Bunun nedeni gerçek bir olay: eski
  sürüm yalnızca `updatedAt`'a bakıp "daha yeni" olanı otomatik buluta
  yazıyordu; kullanıcı çıkış yapıp yerelde veriyi sıfırlayınca (bu da
  `saveAll()` → `touchUpdatedAt()` ile zaman damgasını ilerletiyordu), o
  sıfırlanmış hal "daha yeni" sayılıp tekrar giriş yapılınca buluttaki
  gerçek veriyi sessizce ezdi. Bu onayı asla kaldırmayın/otomatikleştirmeyin.
  Seçim butonlarına tıklamak doğrudan uygulamaz — `showConfirm()` ile
  ikinci bir "Emin misin?" onayı ister (yanlışlıkla tıklamayı önlemek
  için; bu geri alınamaz bir üzerine yazma). Not: yalnızca giriş anındaki
  ilk uzlaşma bu şekilde korunuyor;
  `beginListening()`'teki canlı `onSnapshot` dinleyicisi (ikisi de zaten
  giriş yapmış durumdayken) hâlâ `updatedAt` karşılaştırmasıyla otomatik
  uygular (her canlı güncellemede sormak kullanılamaz derecede rahatsız
  edici olurdu) — bu kabul edilen, kasıtlı bir risktir.
  Firebase config (apiKey vb.) bilerek client-side'da public'tir — gerçek
  erişim kontrolü `firestore.rules` ile sağlanır (her kullanıcı yalnızca
  `users/{kendi uid'si}` belgesine erişebilir). Bu proje Firebase CLI ile
  deploy edilmiyor (build adımı yok, sıfır bağımlılık ilkesi korunuyor);
  `firestore.rules` sadece referans, Firebase Console'a elle
  yapıştırılmalı. Yeni bir kalıcı localStorage anahtarı eklerseniz
  `buildCloudPayload()`/`applyCloudPayload()`'a da eklemeyi unutmayın —
  aksi halde o alan cihazlar arasında senkronlanmaz.
- **Değişmez kural — `startData[key] >= data[key]`**: İlerleme yüzdesi bu
  varsayıma dayanır. `data[key]`'i artıran (kalan sayıyı yükselten) **her**
  işlemden sonra `syncStart()` çağrılmalıdır (`change()`, `editCount()`,
  `applyBulkPerform()`, `deleteLogDay()` içinde olduğu gibi) — aksi halde
  yüzde hesabı eksiye düşebilir. `bulkSet()` ve `applyCalc()` ise
  `data`/`startData`'yı aynı anda aynı değere sıfırladığı için ayrıca
  `syncStart()` gerektirmez.
- **"+"/"−" buton anlamı (kasıtlı, sezgisel isim değil)**: "+" tuşu
  **"kıldım"** anlamına gelir (kalan sayıyı azaltır, log'a işler); "−" tuşu
  **geri alma/düzeltme** içindir (kalan sayıyı artırır). Bu, kullanıcı
  isteğiyle kasıtlı olarak tersine çevrildi (yeşil "+" = olumlu eylem) —
  standart artı/eksi sezgisiyle karıştırıp geri çevirmeyin. "−" ayrıca
  `removeFromLog()` ile o vakte ait en son log kayıtlarından (LIFO) aynı
  miktarı düşer — aksi halde "+" ile işaretleyip "−" ile geri almak,
  kalan sayıyı doğru gösterse de log'da hayalet kayıtlar bırakır (streak,
  Geçmiş ve 30 günlük grafik hep log'dan türediği için gerçekte olmayan
  kılınmış namazlar gösterirdi — bir keresinde yaşanmış gerçek bir hataydı).
- **Vakitler**: `NAMAZLAR` dizisi altı sabit vakti tanımlar: sabah, öğle,
  ikindi, akşam, yatsı, vitir. Yeni bir vakit eklemek/çıkarmak gerekirse
  sadece bu diziyi güncellemek yeterlidir; render mantığı diziye göre
  otomatik çalışır.
- **Log temizleme**: Geçmiş modalinde "Log Geçmişini Temizle" butonu
  `clearLog()`'u çağırır — yalnızca `log`'u boşaltır, `data`/`startData`'ya
  dokunmaz. Satır başına gösterilen "kılındı" sayısı ve ilerleme yüzdesi
  `startData - data`'dan gelir (log'dan DEĞİL), bu yüzden log'u temizlemek
  onları etkilemez; etkilenenler yalnızca log'dan türeyenler: streak,
  tahmini bitiş, Geçmiş listesi, 30 günlük grafik.
- **Render döngüsü**: Hemen hemen her mutasyon fonksiyonu sonunda
  `saveAll()` çağrılır; o da localStorage'a yazar, `checkMilestone()`'ı
  çalıştırır ve `render()`'ı tetikler. `render()` `#list` DOM'unu sıfırdan
  yeniden oluşturur; küçük ölçek için bu yaklaşım yeterlidir.
- **Tarih ayrıştırma**: `<input type="date">` değerleri (`"YYYY-MM-DD"`)
  asla çıplak `new Date(str)` ile ayrıştırılmaz — bu, UTC gece yarısı
  varsayar ve sonradan yerel `getFullYear`/`setFullYear` gibi metodlarla
  karıştırılırsa negatif UTC farklı saat dilimlerinde tarih bir gün kayar.
  Bunun yerine `parseLocalDate(str)` kullanılır (yerel gece yarısı olarak
  ayrıştırır, `fmtDate()` ile simetriktir). Tarih girişi ayrıştıran yeni kod
  eklerken de `parseLocalDate` kullanın, çıplak `new Date(dateInputValue)`
  değil.
- **Yedekleme bütünlüğü**: `exportData()`/`importData()` yukarıdaki *tüm*
  localStorage anahtarlarını (data, startData, log, lastChange, profile,
  milestone) kapsar. Yeni bir kalıcı durum (yeni bir localStorage anahtarı)
  eklerseniz, onu da bu ikisine ekleyin — aksi halde kullanıcı yedeği başka
  bir cihaza geri yüklediğinde o veri sessizce kaybolur.

## Geliştirme

- Kurulum veya build gerekmez. `index.html` dosyasını doğrudan tarayıcıda
  açarak veya basit bir statik sunucu ile (`python3 -m http.server`)
  test edin.
- Test framework'ü yoktur. Bu ortamda (sandbox) headless Chromium/Playwright
  çalıştırmak için gereken sistem kütüphaneleri (örn. `libnspr4.so`) eksik
  ve `sudo` yok — gerçek bir tarayıcıda ekran görüntüsü almak mümkün
  olmayabilir. Bunun yerine `jsdom` (scratchpad dizinine `npm install
  jsdom` ile kurulabilir) kullanarak sayfayı yükleyip `dispatchEvent` ile
  buton tıklamalarını, modal açma/kapamayı ve `localStorage`/DOM sonuçlarını
  doğrulayın. Bkz. bu depoda daha önce yazılmış `scratchpad/test*.js`
  betikleri (geçici dizindedir, kalıcı değildir) örnek olarak.
- Mantık değişikliklerinden sonra en azından şunları test edin: ilerleme
  yüzdesinin hiçbir senaryoda negatife düşmediğini, `syncStart()`'ın
  gerektiği her yerde çağrıldığını ve yedekleme dışa/içe aktarmanın tüm
  localStorage anahtarlarını round-trip ettiğini.

## Kod Stili ve Kurallar

- Uygulama dili ve tüm kullanıcıya görünen metinler **Türkçe**'dir
  (değişken/anahtar adları hariç, onlar İngilizce/Türkçe karışık olabilir,
  örn. `NAMAZLAR`, `ad`).
- Mevcut basitliği koru: yeni bir framework, bundler veya bağımlılık
  eklemeden önce gerçekten gerekli olup olmadığını değerlendir. Proje
  bilinçli olarak sıfır bağımlılıklı tutulmaktadır.
- Var olan CSS custom property'lerini (`--bg`, `--accent`, `--accent2`,
  `--text`, `--muted`, `--border`, `--card`, `--gold`) kullanarak tema
  tutarlılığını koru.
- Sayfa düzeni kasıtlı olarak kompakt tutulur: başlık → son işaretlenen
  bandı → 6 vakit satırı → toplam/seri/tahmini bitiş/bugün kılınan paneli →
  eylem butonları → footer. Vakit satırlarının ilk ekranda (kaydırmadan)
  görünür olması öncelikli tutuldu; özet panelleri kasıtlı olarak listenin
  altına taşındı. Boyutlar kullanıcı geri bildirimiyle birkaç kez
  büyütüldü — yeniden küçültmeden önce mevcut `<style>` bloğundaki
  değerleri kontrol edin, eski (küçük) değerleri varsaymayın. İstisna:
  `.stats-row` üç kutuya (seri, tahmini bitiş, günlük hedef) çıkarılırken
  `.stat-box`/`.stat-val`/`.stat-lbl` bilinçli olarak biraz küçültüldü —
  bu, üçüncü kutu eklemenin gerektirdiği bir ayardır, geri almayın.
- Gereksiz soyutlama veya yorum ekleme; kod zaten küçük ve okunabilir
  durumda. Yorum yalnızca WHY açık olmadığında (örn. tarih ayrıştırma
  tuzağı, `syncStart()` çağrı sırası) eklenir.
