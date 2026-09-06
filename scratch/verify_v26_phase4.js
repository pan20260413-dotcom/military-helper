const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log("=== V2.6 Phase 4 Daily Action Center & Smart Portal Verification Suite ===");

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

// Safety Scan
assert(!htmlContent.includes('localStorage.clear()'), '1. Code contains no localStorage.clear()');
assert(!htmlContent.includes('Store.reset'), '2. Code contains no Store.reset');
assert(!htmlContent.includes('resetStore'), '3. Code contains no resetStore');
assert(!htmlContent.includes('clearStore'), '4. Code contains no clearStore');

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
  assert(true, '5. JavaScript syntax PASS');
} catch (e) {
  assert(false, `5. JavaScript syntax execution failed: ${e.message}`);
  process.exit(1);
}

// Extract objects
const ENGLISH_SEED_DATA = vm.runInContext("ENGLISH_SEED_DATA", context);
const CARD_ANSWERS = vm.runInContext("CARD_ANSWERS", context);
const Store = vm.runInContext("Store", context);
const UI = vm.runInContext("UI", context);
const HealthManager = vm.runInContext("HealthManager", context);
const TrendManager = vm.runInContext("TrendManager", context);
const TaskManager = vm.runInContext("TaskManager", context);
const DailyActionManager = vm.runInContext("DailyActionManager", context);

Store.load();

// Check Seeds & Navigation
assert(ENGLISH_SEED_DATA && ENGLISH_SEED_DATA.length === 6050, `6. English seed count === 6050 (Actual: ${ENGLISH_SEED_DATA.length})`);
assert(CARD_ANSWERS && CARD_ANSWERS.length === 1080, `7. Card seed count === 1080 (Actual: ${CARD_ANSWERS.length})`);

const bottomNavHtml = vm.runInContext("bottomNav()", context);
const navMatches = bottomNavHtml.match(/class="navbtn/g) || [];
assert(navMatches.length === 7, `8. Bottom nav has exactly 7 items (Actual: ${navMatches.length})`);

// Check Home UI rendering of Phase 4 components
const homeHtml = UI.screenHome();
assert(homeHtml.includes('🌤️ 今天的你'), '9. Home screen includes 「🌤️ 今天的你」');
assert(homeHtml.includes('🧭 現在最適合做什麼？'), '10. Home screen includes 「🧭 現在最適合做什麼？」 card');
assert(homeHtml.includes('📌 今日完成進度'), '11. Home screen includes 「📌 今日完成進度」 grid');

// Dynamic Priority Recommendation Test (Scenarios A -> B -> C -> D -> E)
const todayStr = HealthManager.todayStr();
Store.data.healthLogs = { sleep: [], water: [], mood: [], stress: [] };
Store.data.relaxSessions = [];
Store.data.mindfulnessSessions = [];
Store.data.gratitude = [];

// Scenario A: No sleep -> Priority 1 (Record Sleep)
const recA = DailyActionManager.getPrimaryRecommendation();
assert(recA.priority === 1 && recA.value === 'healthForm', '12a. Scenario A (No sleep) recommends 😴 記錄今天睡眠');

// Scenario B: Sleep recorded, no water -> Priority 2 (Record Water)
HealthManager.addLog('sleep', { hours: 7.5, date: todayStr });
const recB = DailyActionManager.getPrimaryRecommendation();
assert(recB.priority === 2 && recB.value === 'water', '12b. Scenario B (No water) recommends 💧 記一杯水');

// Scenario C: Water recorded, high stress -> Priority 3 (60s Breath)
HealthManager.addLog('water', { amount: 300, date: todayStr });
HealthManager.addLog('stress', { score: 30, date: todayStr }); // low score = high stress
const recC = DailyActionManager.getPrimaryRecommendation();
assert(recC.priority === 3 && recC.value === 'relax', '12c. Scenario C (High stress) recommends 😮‍💨 做 60 秒呼吸');

// Scenario D: Low stress, no English -> Priority 4 (Learn English)
Store.data.healthLogs.stress[0].score = 80; // low stress
const recD = DailyActionManager.getPrimaryRecommendation();
assert(recD.priority === 4 && recD.value === 'learningHub', '12d. Scenario D (No English) recommends 🇬🇧 學今日英文短語');

// Scenario E: All completed -> Priority 7 (Review Trend)
Store.data.englishProgress = { 'e1': { lastReviewed: todayStr } };
Store.data.gratitude.push({ date: todayStr, text: '感謝' });
Store.data.relaxSessions.push({ date: todayStr, durationKey: '1' });
const recE = DailyActionManager.getPrimaryRecommendation();
assert(recE.priority === 7 && recE.value === 'trendCenter', '12e. Scenario E (All completed) gracefully recommends 📊 查看完整趨勢');

// Today Completion List Helper Test
const completionList = DailyActionManager.getTodayCompletionList();
assert(Array.isArray(completionList) && completionList.length === 7, '13. DailyActionManager.getTodayCompletionList() returns 7 status items');
assert(completionList.every(item => item.action && item.value), '14. All Today completion items have valid action/value CTAs');

// Check Preserved State
assert(Store.data.themeSettings && Store.data.themeSettings.preset, '15. themeSettings preserved intact');
assert(Store.data.retirementProfile, '16. retirementProfile preserved intact');
assert(Array.isArray(Store.data.retirementChecklist), '17. retirementChecklist preserved intact');
assert(UI.screenRelaxHub().includes('情緒重置中心'), '18. Phase 2 情緒重置中心 (Emotion Reset Center) preserved intact');
assert(UI.screenTrendCenter().includes('🧭 最近的我'), '19. Phase 3 統一趨勢中心 (Unified Trend Center) preserved intact');

// Summary Output
console.log("\n==========================================");
console.log(`TOTAL PASSES: ${passCount}`);
console.log(`TOTAL FAILS:  ${failCount}`);
console.log("==========================================");

if (failCount > 0) {
  process.exit(1);
}
