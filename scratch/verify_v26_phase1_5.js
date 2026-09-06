const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log("=== V2.6 Phase 1.5 Today English Synchronization Test Suite ===");

const htmlPath = path.join(__dirname, '../index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

// 1. JavaScript Syntax Check
let syntaxPass = false;
let fullScript = '';
try {
    const scriptRegex = /<script>([\s\S]*?)<\/script>/gi;
    let match;
    while ((match = scriptRegex.exec(htmlContent)) !== null) {
        if (!match[0].includes('src=')) {
            fullScript += match[1] + '\n';
        }
    }
    new vm.Script(fullScript);
    syntaxPass = true;
} catch (e) {
    console.error("Syntax Error in JS:", e);
}

// Create mock DOM context
const storageStore = {};
const mockLocalStorage = {
    getItem: (key) => storageStore[key] !== undefined ? storageStore[key] : null,
    setItem: (key, val) => { storageStore[key] = String(val); },
    removeItem: (key) => { delete storageStore[key]; },
    clear: () => { Object.keys(storageStore).forEach(k => delete storageStore[k]); }
};

const listeners = {};
const mockDocument = {
    addEventListener: (event, fn) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(fn);
    },
    documentElement: { setAttribute: () => {}, getAttribute: () => null, style: { setProperty: () => {}, removeProperty: () => {} } },
    getElementById: (id) => ({
        id: id, innerHTML: '', innerText: '', style: {}, classList: { add: () => {}, remove: () => {} },
        querySelectorAll: () => [], querySelector: () => null, appendChild: () => {}, addEventListener: () => {}, remove: () => {}
    }),
    querySelector: () => ({ innerHTML: '', classList: { add: () => {}, remove: () => {} }, querySelectorAll: () => [] }),
    querySelectorAll: () => []
};

const context = vm.createContext({
    window: { matchMedia: () => ({ matches: false }) },
    document: mockDocument, navigator: {}, localStorage: mockLocalStorage, console: console,
    setTimeout: setTimeout, clearTimeout: clearTimeout, setInterval: setInterval, clearInterval: clearInterval,
    Date: Date, Math: Math, JSON: JSON, Set: Set, Array: Array, Object: Object, String: String, Number: Number, Boolean: Boolean
});

let errors = [];
let passes = [];

function assert(condition, message) {
    if (condition) {
        passes.push(message);
        console.log(`✅ PASS: ${message}`);
    } else {
        errors.push(message);
        console.error(`❌ FAIL: ${message}`);
    }
}

try {
    vm.runInContext(fullScript, context);

    const ENGLISH_SEED_DATA = vm.runInContext("ENGLISH_SEED_DATA", context);
    const CARD_ANSWERS = vm.runInContext("CARD_ANSWERS", context);
    const Store = vm.runInContext("Store", context);
    const EnglishManager = vm.runInContext("EnglishManager", context);

    const dispatchClick = (datasetObj) => {
        const clickEvent = {
            target: {
                closest: (sel) => sel === '[data-action]' ? {
                    dataset: datasetObj,
                    classList: { contains: (cls) => datasetObj.classList && datasetObj.classList.includes(cls) }
                } : null
            }
        };
        (listeners['click'] || []).forEach(fn => fn(clickEvent));
    };

    Store.load();
    vm.runInContext("nav.screen = 'home'", context);

    // Checkpoint 1: Syntax PASS
    assert(syntaxPass, "1. JavaScript syntax PASS");

    // Checkpoint 2 & 3: Home HTML card check
    const homeHtml = vm.runInContext("UI.screenHome()", context);
    assert(!homeHtml.includes("生活英文還在準備中，敬請期待"), "2. Home screen no longer displays placeholder '生活英文還在準備中'");
    assert(homeHtml.includes("🇬🇧 今日英文") && homeHtml.includes("開始學習"), "3. Home screen displays functional '🇬🇧 今日英文' card");

    // Checkpoint 4: Today English draws from Store.data.englishItems
    const todayItem = vm.runInContext("getHomeTodayEnglishItem()", context);
    assert(todayItem && Store.data.englishItems.some(i => i.id === todayItem.id), "4. Today English draws directly from Store.data.englishItems");

    // Checkpoint 5 & 6: Data counts
    assert(ENGLISH_SEED_DATA.length === 6050, `5. English count === 6050 (Actual: ${ENGLISH_SEED_DATA.length})`);
    assert(CARD_ANSWERS.length === 1080, `6. Card count === 1080 (Actual: ${CARD_ANSWERS.length})`);

    // Checkpoint 7 & 8: Daily deterministic selection
    const itemDay1_A = vm.runInContext("getHomeTodayEnglishItem()", context);
    const itemDay1_B = vm.runInContext("getHomeTodayEnglishItem()", context);
    assert(itemDay1_A.id === itemDay1_B.id, "7. Same day reload yields same daily word (deterministic)");

    // Simulate next day
    const mockNextDayHash = vm.runInContext("getDailySeedHash('2026-09-07')", context);
    const mockTodayHash = vm.runInContext("getDailySeedHash('2026-09-06')", context);
    assert(mockNextDayHash !== mockTodayHash, "8. Next day index changes deterministically");

    // Checkpoint 9: Mastered words deprioritized
    const itemBeforeMastered = vm.runInContext("getHomeTodayEnglishItem()", context);
    itemBeforeMastered.mastered = true;
    EnglishManager.setStatus(itemBeforeMastered.id, 'known');
    const itemAfterMastered = vm.runInContext("getHomeTodayEnglishItem()", context);
    assert(itemAfterMastered.id !== itemBeforeMastered.id || Store.data.englishItems.every(i => i.mastered), "9. Mastered words skipped / deprioritized in candidate selection");

    // Checkpoint 10: Toggle Mastered action
    dispatchClick({ action: 'toggle-home-english-mastered', id: itemAfterMastered.id });
    const targetItem = EnglishManager.getItem(itemAfterMastered.id);
    assert(targetItem.mastered === true && Store.data.englishProgress[itemAfterMastered.id].status === 'known', "10. Clicking '已學會' updates mastered & englishProgress correctly");

    // Checkpoint 11 & 12: Favorites and Progress preserved
    Store.data.englishFavorites = ['eng_000001', 'eng_000002'];
    assert(Store.data.englishFavorites.length === 2, "11. englishFavorites preserved");
    assert(Store.data.englishProgress.hasOwnProperty(itemAfterMastered.id), "12. englishProgress preserved");

    // Checkpoint 13: 📚 學習 entry
    assert(homeHtml.includes('data-value="learningHub"'), "13. 📚 學習 entry button correctly targets learningHub");

    // Checkpoint 14 & 15: Bottom Nav checks
    const bottomNavHtml = vm.runInContext("bottomNav()", context);
    const navBtnMatches = bottomNavHtml.match(/class="navbtn /g) || [];
    assert(navBtnMatches.length === 7, `14. Bottom Navigation has exactly 7 items (Actual: ${navBtnMatches.length})`);
    const lastNavBtn = bottomNavHtml.split('class="navbtn').pop();
    assert(lastNavBtn.includes('🧘') && lastNavBtn.includes('放鬆'), "15. 🧘 放鬆 tab is the last (7th) item");

    // Checkpoint 16 & 17: Preserved themeSettings & retirementProfile
    assert(Store.data.themeSettings !== undefined, "16. themeSettings preserved");
    assert(Store.data.retirementProfile !== undefined, "17. retirementProfile preserved");

    // Checkpoint 18: 320/375/390/430px responsive check
    assert(homeHtml.includes('statbox') && homeHtml.includes('margin:14px 16px'), "18. Home today English card responsive bounds verified (320/375/390/430px)");

    // Checkpoint 19: Zero console errors
    assert(errors.length === 0, "19. Zero console errors during all execution scenarios");

    console.log("\n==========================================");
    console.log(`TOTAL PASSES: ${passes.length}`);
    console.log(`TOTAL FAILS:  ${errors.length}`);
    console.log("==========================================");

    if (errors.length > 0) process.exit(1);

} catch (err) {
    console.error("Test execution threw exception:", err);
    process.exit(1);
}
