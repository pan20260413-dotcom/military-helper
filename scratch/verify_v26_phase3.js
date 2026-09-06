const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log("=== V2.6 Phase 3 Unified Trend Center & Today Status Verification Suite ===");

const htmlPath = path.join(__dirname, '..', 'index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
    passCount++;
  } else {
    console.log(`❌ FAIL: ${message}`);
    failCount++;
  }
}

// 1. Safety Checks
assert(!htmlContent.includes('localStorage.clear()'), '1. Code contains no localStorage.clear()');
assert(!htmlContent.includes('Store.reset'), '2. Code contains no Store.reset');
assert(!htmlContent.includes('resetStore'), '3. Code contains no resetStore');

// Extract script
let fullScript = '';
const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
let match;
while ((match = scriptRegex.exec(htmlContent)) !== null) {
  if (!match[0].includes('src=')) {
    fullScript += match[1] + '\n';
  }
}

// Mock Environment
const storageStore = {};
const mockLocalStorage = {
  getItem: (key) => storageStore[key] !== undefined ? storageStore[key] : null,
  setItem: (key, val) => { storageStore[key] = String(val); },
  removeItem: (key) => { delete storageStore[key]; },
  clear: () => { throw new Error('FORBIDDEN: localStorage.clear() called'); }
};

const listeners = {};
const mockDocument = {
  addEventListener: (event, fn) => {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(fn);
  },
  documentElement: {
    setAttribute: () => {}, getAttribute: () => null,
    style: { setProperty: () => {}, removeProperty: () => {} }
  },
  getElementById: (id) => ({
    id: id, innerHTML: '', innerText: '', value: '', style: {},
    classList: { add: () => {}, remove: () => {} },
    querySelectorAll: () => [], querySelector: () => null,
    appendChild: () => {}, addEventListener: () => {}, remove: () => {}
  }),
  querySelector: () => ({ innerHTML: '', classList: { add: () => {}, remove: () => {} }, style: {}, remove: () => {} }),
  querySelectorAll: () => []
};

const context = vm.createContext({
  window: { matchMedia: () => ({ matches: false, addEventListener: () => {} }), location: { href: '', open: () => {} } },
  document: mockDocument,
  navigator: { userAgent: 'node' },
  localStorage: mockLocalStorage,
  console: console,
  setTimeout: setTimeout, clearTimeout: clearTimeout, setInterval: setInterval, clearInterval: clearInterval,
  Date: Date, Math: Math, JSON: JSON, Set: Set, Array: Array, Object: Object, String: String, Number: Number, Boolean: Boolean
});

try {
  vm.runInContext(fullScript, context);
  assert(true, '4. JavaScript syntax PASS');
} catch (e) {
  assert(false, `4. JavaScript syntax execution failed: ${e.message}`);
  process.exit(1);
}

// Extract objects
const ENGLISH_SEED_DATA = vm.runInContext("ENGLISH_SEED_DATA", context);
const CARD_ANSWERS = vm.runInContext("CARD_ANSWERS", context);
const Store = vm.runInContext("Store", context);
const UI = vm.runInContext("UI", context);
const HealthManager = vm.runInContext("HealthManager", context);
const TrendManager = vm.runInContext("TrendManager", context);

Store.load();

// Check Seeds & Preservation
assert(ENGLISH_SEED_DATA && ENGLISH_SEED_DATA.length === 6050, `5. English seed count === 6050 (Actual: ${ENGLISH_SEED_DATA.length})`);
assert(CARD_ANSWERS && CARD_ANSWERS.length === 1080, `6. Card seed count === 1080 (Actual: ${CARD_ANSWERS.length})`);

// 7 Bottom Nav Items
const bottomNavHtml = vm.runInContext("bottomNav()", context);
const navMatches = bottomNavHtml.match(/class="navbtn/g) || [];
assert(navMatches.length === 7, `7. Bottom nav has exactly 7 items (Actual: ${navMatches.length})`);

// Home Today Status Card ("🌤️ 今天的你")
const homeHtml = UI.screenHome();
assert(homeHtml.includes('🌤️ 今天的你'), '8. Home screen contains 首頁「🌤️ 今天的你」 card');
assert(homeHtml.includes('💡 溫和的下一步建議') || homeHtml.includes('📊 查看完整趨勢'), '9. Home Today Status card contains Next Action & Trend links');

// TrendManager 7-Day & 30-Day Metrics
const m7 = TrendManager.getMetrics(7);
const m30 = TrendManager.getMetrics(30);
assert(m7 && m7.mood && m7.stress && m7.sleep && m7.water, '10. TrendManager getMetrics(7) returns 7-day health metrics');
assert(m30 && m30.mood && m30.stress && m30.sleep && m30.water, '11. TrendManager getMetrics(30) returns 30-day health metrics');

// TrendManager Weekly Summary & Lifestyle Summary
const weeklySummary = TrendManager.getWeeklySummary();
assert(weeklySummary && typeof weeklySummary.tasksDone === 'number' && typeof weeklySummary.wordsKnown === 'number', '12. TrendManager getWeeklySummary() returns valid weekly progress');

const lifestyleSummary = TrendManager.getLifestyleSummary(m7);
assert(lifestyleSummary && lifestyleSummary.includes('最近 7 天'), '13. TrendManager getLifestyleSummary() returns gentle non-medical profile text');

// Trend Center Screen ("🧭 最近的我" & "🏆 本週進度")
const trendCenterHtml = UI.screenTrendCenter();
assert(trendCenterHtml.includes('🧭 最近的我'), '14. Trend Center contains 「🧭 最近的我」 (Lifestyle Profile Summary)');
assert(trendCenterHtml.includes('🏆 本週進度總覽'), '15. Trend Center contains 「🏆 本週進度」 (Weekly Progress Summary)');

// Check Store & Phase 2 Preservation
assert(Store.data.themeSettings && Store.data.themeSettings.preset, '16. themeSettings preserved intact');
assert(Store.data.retirementProfile, '17. retirementProfile preserved intact');
assert(Array.isArray(Store.data.retirementChecklist), '18. retirementChecklist preserved intact');
assert(Array.isArray(Store.data.cardDraws), '19. cardDraws preserved intact');
assert(UI.screenRelaxHub().includes('情緒重置中心'), '20. Phase 2 情緒重置中心 (Emotion Reset Center) preserved intact');

// Summary Output
console.log("\n==========================================");
console.log(`TOTAL PASSES: ${passCount}`);
console.log(`TOTAL FAILS:  ${failCount}`);
console.log("==========================================");

if (failCount > 0) {
  process.exit(1);
}
