// Basit regresyon testleri. Gerçek bir tarayıcı yerine jsdom kullanır
// (bkz. CLAUDE.md "Geliştirme" bölümü — sandbox'ta headless Chromium yok).
// Çalıştırma: npm test
"use strict";
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const HTML_PATH = path.join(__dirname, "..", "index.html");
const NAMAZLAR = ["sabah", "ogle", "ikindi", "aksam", "yatsi", "vitir"];

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error(`✗ FAIL: ${msg}`);
  }
}

function loadPage() {
  const html = fs.readFileSync(HTML_PATH, "utf8");
  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    url: "http://localhost/",
    pretendToBeVisual: true,
  });
  // jsdom eski sürümlerde URL.createObjectURL'i desteklemez; exportData()
  // bunu Blob indirmek için çağırıyor, testte gerçek indirme gerekmiyor.
  dom.window.URL.createObjectURL = () => "blob:fake";
  dom.window.URL.revokeObjectURL = () => {};
  return dom;
}

function getLS(dom, key) {
  return JSON.parse(dom.window.localStorage.getItem(key) || "null");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function testYuzdeHicNegatifeDusmez() {
  const dom = loadPage();
  const { window } = dom;

  window.editCount("sabah", "Sabah");
  window.document.getElementById("promptInput").value = "5";
  window._promptSubmit();
  assert(getLS(dom, "kazaData").sabah === 5, "editCount ile sabah=5 ayarlandı");

  // 5 tane var, 8 kere "kıldım" (change(-1)) dene: 3'ü data<=0 olduğu için no-op olmalı
  for (let i = 0; i < 8; i++) window.change("sabah", -1);

  const data = getLS(dom, "kazaData");
  const start = getLS(dom, "kazaStart");
  assert(data.sabah === 0, "data negatife düşmüyor, 0'da duruyor");
  assert(start.sabah >= data.sabah, "startData >= data değişmez kuralı korunuyor");

  const pctText = window.document.getElementById("totalPercent").textContent;
  assert(!pctText.includes("-"), `ilerleme yüzdesi negatif göstermiyor (görünen: "${pctText}")`);
}

async function testSyncStartEditCountArtinca() {
  const dom = loadPage();
  const { window } = dom;

  window.editCount("ogle", "Öğle");
  window.document.getElementById("promptInput").value = "10";
  window._promptSubmit();

  // Şimdi kalan sayıyı startData'nın da üzerine çıkaracak şekilde artır (düzeltme / "-" tuşu)
  window.editCount("ogle", "Öğle");
  window.document.getElementById("promptInput").value = "40";
  window._promptSubmit();

  const data = getLS(dom, "kazaData");
  const start = getLS(dom, "kazaStart");
  assert(start.ogle >= data.ogle, "editCount ile kalan sayı artınca syncStart() startData'yı da yükseltiyor");

  const pctText = window.document.getElementById("totalPercent").textContent;
  assert(!pctText.includes("-"), `startData yükseltildikten sonra yüzde negatif değil (görünen: "${pctText}")`);
}

async function testYedekDisaIceAktarmaTumAnahtarlariTasir() {
  const dom = loadPage();
  const { window } = dom;

  window.editCount("aksam", "Akşam");
  window.document.getElementById("promptInput").value = "12";
  window._promptSubmit();
  window.change("aksam", -1); // log'a bir kayıt düşsün

  localStorage_kazaMilestone_set(dom, "50");

  const beforeData = getLS(dom, "kazaData");
  const beforeStart = getLS(dom, "kazaStart");
  const beforeLog = getLS(dom, "kazaLog");
  const beforeMilestone = getLS(dom, "kazaMilestone");

  window.exportData(); // sadece hata fırlatmadığını doğrula (Blob/indirme mock'landı)

  // Mevcut veriyi manuel olarak bozup, gerçek importData() akışıyla geri yükle
  const payload = {
    data: beforeData,
    startData: beforeStart,
    log: beforeLog,
    lastChange: getLS(dom, "kazaLastChange"),
    profile: getLS(dom, "kazaProfile"),
    milestone: beforeMilestone,
  };
  const file = new window.File([JSON.stringify(payload)], "yedek.json", { type: "application/json" });

  window.editCount("aksam", "Akşam");
  window.document.getElementById("promptInput").value = "999";
  window._promptSubmit();
  assert(getLS(dom, "kazaData").aksam === 999, "veri bozuldu (geri yükleme öncesi kontrol)");

  window.importData({ target: { files: [file], value: "" } });
  await sleep(50); // FileReader.onload asenkron

  window._confirmYes(); // "Devam edilsin mi?" onayı

  const afterData = getLS(dom, "kazaData");
  const afterStart = getLS(dom, "kazaStart");
  const afterLog = getLS(dom, "kazaLog");
  const afterMilestone = getLS(dom, "kazaMilestone");

  assert(afterData.aksam === beforeData.aksam, "kazaData round-trip ile geri geldi");
  assert(afterStart.aksam === beforeStart.aksam, "kazaStart round-trip ile geri geldi");
  assert(afterLog.length === beforeLog.length, "kazaLog round-trip ile geri geldi");
  assert(String(afterMilestone) === String(beforeMilestone), "kazaMilestone round-trip ile geri geldi");
}

function localStorage_kazaMilestone_set(dom, val) {
  dom.window.localStorage.setItem("kazaMilestone", val);
}

async function testGirisVaktiLogaIsleniyor() {
  const dom = loadPage();
  const { window } = dom;

  window.editCount("ikindi", "İkindi");
  window.document.getElementById("promptInput").value = "3";
  window._promptSubmit();
  window.change("ikindi", -1);

  const log = getLS(dom, "kazaLog");
  const last = log[log.length - 1];
  assert(last.key === "ikindi", "log kaydı doğru vakte ait");
  assert(NAMAZLAR.includes(last.enteredVakit), `enteredVakit geçerli bir vakit anahtarı (${last.enteredVakit})`);
}

async function testGunlukHedefRoundTrip() {
  const dom = loadPage();
  const { window } = dom;

  window.setGoal();
  window.document.getElementById("promptInput").value = "5";
  window._promptSubmit();
  assert(getLS(dom, "kazaGoal") === 5, "hedef kaydedildi");

  window.editCount("vitir", "Vitir");
  window.document.getElementById("promptInput").value = "3";
  window._promptSubmit();
  window.change("vitir", -1);
  window.change("vitir", -1);

  assert(window.todayPerformedCount() === 2, "bugün kılınan sayısı doğru hesaplanıyor");
  assert(window.document.getElementById("todayVal").textContent === "2 / 5", "hedef UI'da gösteriliyor");
}

async function testIstatistikGrafigi() {
  const dom = loadPage();
  const { window } = dom;

  window.editCount("yatsi", "Yatsı");
  window.document.getElementById("promptInput").value = "3";
  window._promptSubmit();
  window.change("yatsi", -1);
  window.change("yatsi", -1);

  window.openHistoryModal();
  const bars = window.document.querySelectorAll(".chart-bar");
  assert(bars.length === 30, `grafik 30 günlük çubuk gösteriyor (bulunan: ${bars.length})`);
  const title = window.document.querySelector(".chart-title").textContent;
  assert(title.includes("toplam 2 kaza kılındı"), `grafik başlığı doğru toplamı gösteriyor (görünen: "${title}")`);
}

async function testGeriAlmaLogdanDaDusuyor() {
  const dom = loadPage();
  const { window } = dom;

  window.editCount("aksam", "Akşam");
  window.document.getElementById("promptInput").value = "10";
  window._promptSubmit();

  window.change("aksam", -1); // kıldım
  window.change("aksam", -1); // kıldım
  const midLog = getLS(dom, "kazaLog");
  assert(midLog.filter(l => l.key === "aksam").length === 2, "iki 'kıldım' iki log kaydı bıraktı");

  window.change("aksam", 1); // geri al
  window.change("aksam", 1); // geri al

  const data = getLS(dom, "kazaData");
  const log = getLS(dom, "kazaLog");
  assert(data.aksam === 10, "geri alınca kalan sayı eski haline döndü");
  assert(log.filter(l => l.key === "aksam").length === 0, "geri alınca log'daki hayalet kayıtlar da silindi");
}

async function testGeriAlmaFazlasiEksikGirisiKirpiyor() {
  const dom = loadPage();
  const { window } = dom;

  window.editCount("vitir", "Vitir");
  window.document.getElementById("promptInput").value = "5";
  window._promptSubmit();

  window.change("vitir", -1); // 1 log kaydı
  window.change("vitir", 1); // geri al
  window.change("vitir", 1); // fazladan geri al — log'da düşecek bir şey kalmadı, sessizce yok sayılmalı

  const log = getLS(dom, "kazaLog");
  assert(log.filter(l => l.key === "vitir").length === 0, "log'da eksi kayıt oluşmuyor, sadece var olanlar düşüyor");
}

async function testLogTemizlemeVeriyiEtkilemiyor() {
  const dom = loadPage();
  const { window } = dom;

  window.editCount("sabah", "Sabah");
  window.document.getElementById("promptInput").value = "20";
  window._promptSubmit();
  window.change("sabah", -1);
  window.change("sabah", -1);

  const dataBefore = getLS(dom, "kazaData");
  const startBefore = getLS(dom, "kazaStart");
  assert(dataBefore.sabah === 18, "2 kıldım sonrası kalan 18 (temizlik öncesi kontrol)");

  window.clearLog();
  window._confirmYes();

  const log = getLS(dom, "kazaLog");
  const dataAfter = getLS(dom, "kazaData");
  const startAfter = getLS(dom, "kazaStart");
  assert(log.length === 0, "clearLog() log'u tamamen boşalttı");
  assert(dataAfter.sabah === dataBefore.sabah, "kalan sayı log temizlenince değişmedi");
  assert(startAfter.sabah === startBefore.sabah, "başlangıç sayısı log temizlenince değişmedi");
}

async function main() {
  await testYuzdeHicNegatifeDusmez();
  await testSyncStartEditCountArtinca();
  await testYedekDisaIceAktarmaTumAnahtarlariTasir();
  await testGirisVaktiLogaIsleniyor();
  await testGunlukHedefRoundTrip();
  await testIstatistikGrafigi();
  await testGeriAlmaLogdanDaDusuyor();
  await testGeriAlmaFazlasiEksikGirisiKirpiyor();
  await testLogTemizlemeVeriyiEtkilemiyor();

  console.log(`\n${passed} test geçti, ${failed} test başarısız.`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
