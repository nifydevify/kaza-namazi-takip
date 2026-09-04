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

async function main() {
  await testYuzdeHicNegatifeDusmez();
  await testSyncStartEditCountArtinca();
  await testYedekDisaIceAktarmaTumAnahtarlariTasir();

  console.log(`\n${passed} test geçti, ${failed} test başarısız.`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
