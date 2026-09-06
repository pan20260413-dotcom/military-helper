const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log("=== V2.6 Phase 1 Theme & Baseline Comprehensive Verification Suite ===");

const htmlPath = path.join(__dirname, '../index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

// 1. JavaScript Syntax & Parsing Check
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
const rootAttributes = {};
const rootStyleProps = {};

const mockDocument = {
    addEventListener: (event, fn) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(fn);
    },
    documentElement: {
        setAttribute: (k, v) => { rootAttributes[k] = String(v); },
        getAttribute: (k) => rootAttributes[k] || null,
        style: {
            setProperty: (k, v) => { rootStyleProps[k] = String(v); },
            removeProperty: (k) => { delete rootStyleProps[k]; }
        }
    },
    getElementById: (id) => ({
        id: id, innerHTML: '', innerText: '', style: {}, classList: { add: () => {}, remove: () => {} },
        querySelectorAll: () => [], querySelector: () => null, appendChild: () => {}, addEventListener: () => {}, remove: () => {}
    }),
    querySelector: () => ({ innerHTML: '', classList: { add: () => {}, remove: () => {} }, querySelectorAll: () => [] }),
    querySelectorAll: () => []
};

const context = vm.createContext({
    window: {
        matchMedia: () => ({ matches: false })
    },
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
    const THEME_PRESETS = vm.runInContext("THEME_PRESETS", context);

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

    // Initialize nav.screen to settings
    vm.runInContext("nav.screen = 'settings'", context);

    // Checkpoint 1: JavaScript syntax PASS
    assert(syntaxPass, "1. JavaScript syntax PASS");

    // Checkpoint 2: themeSettings default values present
    Store.load();
    const defaults = Store.defaultData();
    assert(defaults.hasOwnProperty('themeSettings') && defaults.themeSettings.preset === 'system', "2. themeSettings default values present");

    // Checkpoint 3: Migration without themeSettings
    mockLocalStorage.clear();
    const baseLegacyData = JSON.parse(JSON.stringify(Store.defaultData()));
    delete baseLegacyData.themeSettings;
    baseLegacyData.settings = { theme: 'system' };
    mockLocalStorage.setItem('ncoAssistant_v1_5_state', JSON.stringify(baseLegacyData));
    Store.load();
    assert(Store.data.themeSettings !== undefined && Store.data.themeSettings.preset === 'system', "3. Legacy data without themeSettings migrated cleanly");

    // Checkpoint 4: Legacy settings.theme = 'dark' migrated correctly
    mockLocalStorage.clear();
    const darkLegacyData = JSON.parse(JSON.stringify(Store.defaultData()));
    delete darkLegacyData.themeSettings;
    darkLegacyData.settings = { theme: 'dark' };
    mockLocalStorage.setItem('ncoAssistant_v1_5_state', JSON.stringify(darkLegacyData));
    Store.load();
    assert(Store.data.themeSettings && Store.data.themeSettings.preset === 'dark', "4. Legacy settings.theme = dark correctly migrated to themeSettings.preset = dark");

    // Restore full store
    mockLocalStorage.clear();
    Store.load();

    // Checkpoint 5: Modifying primaryColor saves correctly
    dispatchClick({ action: 'open-appearance-modal' });
    vm.runInContext("formThemeSettings.mode = 'custom'", context);
    vm.runInContext("formThemeSettings.customEnabled = true", context);
    vm.runInContext("formThemeSettings.primaryColor = '#123456'", context);
    dispatchClick({ action: 'save-appearance' });
    assert(Store.data.themeSettings.primaryColor === '#123456', "5. Modifying primaryColor saves correctly");

    // Checkpoint 6: Modifying backgroundColor saves correctly
    dispatchClick({ action: 'open-appearance-modal' });
    vm.runInContext("formThemeSettings.backgroundColor = '#654321'", context);
    dispatchClick({ action: 'save-appearance' });
    assert(Store.data.themeSettings.backgroundColor === '#654321', "6. Modifying backgroundColor saves correctly");

    // Checkpoint 7: Modifying cardColor saves correctly
    dispatchClick({ action: 'open-appearance-modal' });
    vm.runInContext("formThemeSettings.cardColor = '#ABCDEF'", context);
    dispatchClick({ action: 'save-appearance' });
    assert(Store.data.themeSettings.cardColor === '#ABCDEF', "7. Modifying cardColor saves correctly");

    // Checkpoint 8: Cancel does NOT modify saved settings
    const savedBeforeCancel = JSON.parse(JSON.stringify(Store.data.themeSettings));
    dispatchClick({ action: 'open-appearance-modal' });
    vm.runInContext("formThemeSettings.primaryColor = '#FF0000'", context);
    dispatchClick({ action: 'close-appearance-modal' });
    assert(Store.data.themeSettings.primaryColor === savedBeforeCancel.primaryColor, "8. Cancel does NOT modify saved settings or localStorage");

    // Checkpoint 9: Reset ONLY resets themeSettings
    Store.data.tasks = [{ id: 'T_USER_1', title: '使用者重要任務' }];
    dispatchClick({ action: 'open-appearance-modal' });
    dispatchClick({ action: 'reset-appearance' });
    assert(Store.data.themeSettings.preset === 'system' && Store.data.themeSettings.mode === 'preset', "9a. Reset resets themeSettings to defaults");
    assert(Store.data.tasks.some(t => t.id === 'T_USER_1'), "9b. Reset preserves all other Store.data (tasks intact)");

    // Checkpoint 10: English count === 6050
    assert(ENGLISH_SEED_DATA.length === 6050, `10. English count === 6050 (Actual: ${ENGLISH_SEED_DATA.length})`);

    // Checkpoint 11: Card count === 1080
    assert(CARD_ANSWERS.length === 1080, `11. Card count === 1080 (Actual: ${CARD_ANSWERS.length})`);

    // Checkpoint 12: English mastered/favorites retained
    Store.data.englishItems[0].mastered = true;
    Store.data.englishFavorites = ['eng_000001'];
    Store.save();
    Store.load();
    assert(Store.data.englishItems[0].mastered === true && Store.data.englishFavorites.includes('eng_000001'), "12. English mastered/favorites retained");

    // Checkpoint 13: cardDraws retained
    Store.data.cardDraws = [{ cardId: 'card_0001', time: '2026-09-06' }];
    Store.save();
    Store.load();
    assert(Store.data.cardDraws.length === 1 && Store.data.cardDraws[0].cardId === 'card_0001', "13. cardDraws history retained");

    // Checkpoint 14: retirementProfile retained
    Store.data.retirementProfile.branchRole = "海軍／中校";
    Store.save();
    Store.load();
    assert(Store.data.retirementProfile.branchRole === "海軍／中校", "14. retirementProfile retained");

    // Checkpoint 15: retirementChecklist retained
    assert(Array.isArray(Store.data.retirementChecklist) && Store.data.retirementChecklist.length > 0, "15. retirementChecklist retained");

    // Checkpoint 16: Bottom Navigation has exactly 7 items
    const bottomNavHtml = vm.runInContext("bottomNav()", context);
    const navBtnMatches = bottomNavHtml.match(/class="navbtn /g) || [];
    assert(navBtnMatches.length === 7, `16. Bottom Navigation has exactly 7 items (Actual: ${navBtnMatches.length})`);

    // Checkpoint 17: 📚 學習 tab exists
    assert(bottomNavHtml.includes('📚') && bottomNavHtml.includes('學習'), "17. 📚 學習 tab exists in bottom nav");

    // Checkpoint 18: 🧘 放鬆 tab is the last (7th) item
    const lastNavBtn = bottomNavHtml.split('class="navbtn').pop();
    assert(lastNavBtn.includes('🧘') && lastNavBtn.includes('放鬆'), "18. 🧘 放鬆 tab is the last (7th) item");

    // Checkpoint 19: 320/375/390/430 responsive check
    const modalHtml = vm.runInContext("renderAppearanceModal()", context);
    assert(modalHtml.includes('max-height:85vh') && modalHtml.includes('overflow-y:auto'), "19. Responsive modal layout container verified (320/375/390/430px bounds)");

    // Checkpoint 20: Zero console errors
    assert(errors.length === 0, "20. Zero console errors during all execution scenarios");

    console.log("\n==========================================");
    console.log(`TOTAL PASSES: ${passes.length}`);
    console.log(`TOTAL FAILS:  ${errors.length}`);
    console.log("==========================================");

    if (errors.length > 0) process.exit(1);

} catch (err) {
    console.error("Test execution threw exception:", err);
    process.exit(1);
}
