const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log("=== V2.6 Phase 2 Emotion Reset Center Comprehensive Verification Suite ===");

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

// 1. Verify no localStorage.clear() in code
assert(!htmlContent.includes('localStorage.clear()'), '1. Code contains no localStorage.clear()');

// Extract script content
let fullScript = '';
const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
let match;
while ((match = scriptRegex.exec(htmlContent)) !== null) {
  if (!match[0].includes('src=')) {
    fullScript += match[1] + '\n';
  }
}

// Mock Browser Environment
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
    setAttribute: () => {},
    getAttribute: () => null,
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
  assert(true, '2. JavaScript syntax PASS');
} catch (e) {
  assert(false, `2. JavaScript syntax execution failed: ${e.message}`);
  process.exit(1);
}

// Extract objects via vm.runInContext
const ENGLISH_SEED_DATA = vm.runInContext("ENGLISH_SEED_DATA", context);
const CARD_ANSWERS = vm.runInContext("CARD_ANSWERS", context);
const Store = vm.runInContext("Store", context);
const UI = vm.runInContext("UI", context);
const HealthManager = vm.runInContext("HealthManager", context);
const EmotionManager = vm.runInContext("EmotionManager", context);
const RelaxManager = vm.runInContext("RelaxManager", context);
const MindfulnessManager = vm.runInContext("MindfulnessManager", context);
const GratitudeManager = vm.runInContext("GratitudeManager", context);
const SelfAwarenessManager = vm.runInContext("SelfAwarenessManager", context);
const CardManager = vm.runInContext("CardManager", context);
const TaskManager = vm.runInContext("TaskManager", context);

// Check Data Counts
assert(ENGLISH_SEED_DATA && ENGLISH_SEED_DATA.length === 6050, `3. English count === 6050 (Actual: ${ENGLISH_SEED_DATA ? ENGLISH_SEED_DATA.length : 0})`);
assert(CARD_ANSWERS && CARD_ANSWERS.length === 1080, `4. Book of Answers card count === 1080 (Actual: ${CARD_ANSWERS ? CARD_ANSWERS.length : 0})`);

// Initialize Store
Store.load();

// Check 7 Navigation Tabs via bottomNav() HTML
const bottomNavHtml = vm.runInContext("bottomNav()", context);
const navMatches = bottomNavHtml.match(/class="navbtn/g) || [];
assert(navMatches.length === 7, `5. Bottom Navigation has exactly 7 items (Actual: ${navMatches.length})`);
assert(bottomNavHtml.includes('data-value="relaxHub"') && bottomNavHtml.includes('放鬆'), '6. 7th navigation tab includes 🧘 放鬆 (relaxHub)');

// Render Emotion Reset Center
const relaxHubHtml = UI.screenRelaxHub();
assert(relaxHubHtml.includes('情緒重置中心'), '7. 情緒重置中心 (Emotion Reset Center) header present');

// Check 8 Emotion options
const emotions = ['還不錯', '普普通通', '有點煩', '壓力很大', '很疲累', '有點生氣', '心情低落', '腦袋很亂'];
const allEmotionsPresent = emotions.every(e => relaxHubHtml.includes(e));
assert(allEmotionsPresent, '8. All 8 emotion options present in 情緒重置中心');

// Check Quick Emotion Logging uses existing Store
const initialMoodCount = Store.data.healthLogs.mood.length;
const initialEmotionCount = Store.data.emotions.length;

HealthManager.addLog('mood', { score: 20, note: '壓力很大', date: HealthManager.todayStr() });
EmotionManager.add({ emotion: '壓力很大', note: '情緒重置中心快速紀錄', date: TaskManager.todayDateStr() });

assert(Store.data.healthLogs.mood.length === initialMoodCount + 1, '9. Quick emotion logging appends to existing Store.data.healthLogs.mood');
assert(Store.data.emotions.length === initialEmotionCount + 1, '10. Quick emotion logging appends to existing Store.data.emotions');

// Check Quick Reset entrances
assert(relaxHubHtml.includes('60 秒呼吸') && relaxHubHtml.includes('data-value="relax"'), '11. 60秒呼吸 entrance present');
assert(relaxHubHtml.includes('2 分鐘正念') && relaxHubHtml.includes('data-value="twoMin"'), '12. 2分鐘正念 entrance present');

// Verify RelaxManager & MindfulnessManager work
const initRelaxCount = Store.data.relaxSessions.length;
RelaxManager.add({ durationKey: '1', feel: 'relaxed' });
assert(Store.data.relaxSessions.length === initRelaxCount + 1, '13. relaxSessions appends log cleanly');

const initMindfulCount = Store.data.mindfulnessSessions.length;
MindfulnessManager.add({ type: 'twoMin', date: TaskManager.todayDateStr() });
assert(Store.data.mindfulnessSessions.length === initMindfulCount + 1, '14. mindfulnessSessions appends log cleanly');

// Verify Gratitude & SelfAwareness use existing Store
const initGratitudeCount = Store.data.gratitude.length;
GratitudeManager.add({ text: '感謝當下平靜的心', tags: ['平靜'] });
assert(Store.data.gratitude.length === initGratitudeCount + 1, '15. gratitude uses existing Store');

const initSelfCount = Store.data.selfAwareness.length;
SelfAwarenessManager.add({ emotion: '安心', needs: ['休息'] });
assert(Store.data.selfAwareness.length === initSelfCount + 1, '16. selfAwareness uses existing Store');

// Check Book of Answers entry & cardDraws integration
assert(relaxHubHtml.includes('📖 給現在的自己一句話'), '17. Book of Answers entry header present in 情緒重置中心');

const drawnCard = CardManager.draw('random') || CardManager.draw();
assert(drawnCard && (drawnCard.answer || drawnCard.text), '18. Book of Answers draws from 1,080 cards successfully');

const initDrawCount = Store.data.cardDraws.length;
CardManager.draws.add({
  cardId: drawnCard.id,
  category: drawnCard.category || 'today',
  question: '給現在的自己一句話',
  answer: drawnCard.answer || drawnCard.text,
  feeling: 5,
  note: '情緒重置中心：❤️ 有共鳴',
  date: TaskManager.todayDateStr()
});
assert(Store.data.cardDraws.length === initDrawCount + 1, '19. Book of Answers appends to existing cardDraws');

// Check themeSettings & User Data Preservation
assert(Store.data.themeSettings && Store.data.themeSettings.preset, '20. themeSettings preserved intact');
assert(Store.data.retirementProfile, '21. retirementProfile preserved intact');
assert(Array.isArray(Store.data.retirementChecklist), '22. retirementChecklist preserved intact');

// Summary Output
console.log("\n==========================================");
console.log(`TOTAL PASSES: ${passCount}`);
console.log(`TOTAL FAILS:  ${failCount}`);
console.log("==========================================");

if (failCount > 0) {
  process.exit(1);
}
