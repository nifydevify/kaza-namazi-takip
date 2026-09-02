# Kaza Namazı Takip

Kaza (kılınmamış) namazlarınızı vakitlere göre takip etmenizi sağlayan basit,
tek sayfalık bir web uygulaması.

## Özellikler

- Sabah, öğle, ikindi, akşam, yatsı ve vitir vakitleri için ayrı ayrı kaza
  sayacı
- Her vakit için tek tek `+` / `−` ile sayaç güncelleme
- "Toplu Başlangıç Sayısı Gir" ile tüm vakitlere aynı anda başlangıç değeri
  atama
- Toplam kalan kaza sayısının üstte özet kart olarak gösterilmesi
- Veriler yalnızca kendi cihazınızda, tarayıcı hafızasında (`localStorage`)
  saklanır — hesap veya internet bağlantısı gerekmez

## Kullanım

Depoyu klonlayıp `index.html` dosyasını herhangi bir tarayıcıda açmanız
yeterlidir:

```bash
git clone <repo-url>
cd kaza-namazi-takip
# index.html dosyasını tarayıcıda açın, veya:
python3 -m http.server
# ardından http://localhost:8000 adresine gidin
```

## Teknoloji

- Sade HTML, CSS ve JavaScript — framework, build adımı veya bağımlılık
  yoktur.
- Veriler tarayıcının `localStorage`'ında saklanır; sunucu tarafı bileşen
  yoktur.

## Katkı

Değişiklik yapmadan önce `CLAUDE.md` dosyasındaki proje yapısı ve
kurallarına göz atın.
