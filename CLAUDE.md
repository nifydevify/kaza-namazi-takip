# CLAUDE.md

Bu dosya, bu depoda çalışırken Claude Code'a rehberlik eder.

## Proje Özeti

Kaza Namazı Takip, kullanıcının kaza (kılınmamış) namazlarını vakitlere göre
takip etmesini sağlayan, tek sayfalık, framework içermeyen bir web
uygulamasıdır. Kullanıcı her vakit için kalan kaza sayısını girer, kıldıkça
sayacı azaltır.

## Mimari

- **Tek dosya**: Tüm uygulama `index.html` içinde yaşar (HTML + CSS + vanilla
  JS, tek `<script>` bloğu içinde). Build adımı, paket yöneticisi veya
  framework yoktur.
- **Veri saklama**: Durum tamamen tarayıcının `localStorage`'ında
  `kazaData` anahtarı altında JSON olarak tutulur. Sunucu tarafı veya ağ
  isteği yoktur.
- **Vakitler**: `NAMAZLAR` dizisi altı sabit vakti tanımlar: sabah, öğle,
  ikindi, akşam, yatsı, vitir (`index.html` içinde ~satır 112). Yeni bir
  vakit eklemek/çıkarmak gerekirse sadece bu diziyi güncellemek yeterlidir;
  render mantığı diziye göre otomatik çalışır.
- **Render döngüsü**: Her veri değişikliğinden sonra `save()` çağrılır, o da
  `localStorage`'ı günceller ve `render()`'ı tetikler. `render()` DOM'u
  sıfırdan yeniden oluşturur (satır ~143). Küçük ölçek için bu yaklaşım
  yeterlidir; performans optimizasyonuna gerek yok.

## Geliştirme

- Kurulum veya build gerekmez. `index.html` dosyasını doğrudan tarayıcıda
  açarak veya basit bir statik sunucu ile (`python3 -m http.server`)
  test edin.
- Test framework'ü yoktur. Değişiklikleri tarayıcıda manuel olarak,
  localStorage değerlerini de kontrol ederek doğrulayın.

## Kod Stili ve Kurallar

- Uygulama dili ve tüm kullanıcıya görünen metinler **Türkçe**'dir
  (değişken/anahtar adları hariç, onlar İngilizce/Türkçe karışık olabilir,
  örn. `NAMAZLAR`, `ad`).
- Mevcut basitliği koru: yeni bir framework, bundler veya bağımlılık
  eklemeden önce gerçekten gerekli olup olmadığını değerlendir. Proje
  bilinçli olarak sıfır bağımlılıklı tutulmaktadır.
- Var olan CSS custom property'lerini (`--bg`, `--accent`, `--accent2`,
  `--text`, `--muted`, `--border`, `--card`) kullanarak tema tutarlılığını
  koru.
- Gereksiz soyutlama veya yorum ekleme; kod zaten küçük ve okunabilir
  durumda.
