/* ==============================================================
   全域狀態與資料初始化
   ============================================================== */
let currentUser = localStorage.getItem('app_current_user') || '新使用者';
let usersList = JSON.parse(localStorage.getItem('app_users_list')) || ['新使用者'];
let customStores = JSON.parse(localStorage.getItem('app_custom_stores')) || [];
function getStoreKey(key) { return `${currentUser}_${key}`; }

let campaigns = [];
let activeTimers = [], historyRecords = [], tipRecords = [], costRecords = [], shiftRecords = [], activeShift = null, waitRecords = [], activeWait = null, settings = {};
let viewedWeekStart = new Date(), currentDailyContext = 'income', currentDailyDateObj = new Date();

let sideMenuOpen = false;

// 導航專用精緻向量圖示 (SVG) - 設定齒輪已修復為標準對稱外型
const NAV_ICONS = [
    // 0: 首頁 (House)
    `<svg viewBox="0 0 24 24"><path d="M3 9.5L12 3l9 6.5V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9.5z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    // 1: 收入 (Card)
    `<svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><line x1="6" y1="15" x2="10" y2="15"/></svg>`,
    // 2: 小費 (Hand with Coins)
    `<svg viewBox="0 0 24 24"><path d="M11 15h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 17"/><path d="m7 21 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9"/><circle cx="12" cy="4" r="2"/></svg>`,
    // 3: 成本 (Receipt)
    `<svg viewBox="0 0 24 24"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="13" y2="15"/></svg>`,
    // 4: 準時率 (Clock Check)
    `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 15 14"/><path d="m16 9 2 2 4-4"/></svg>`,
    // 5: 設定 (Gear - 標準對稱工業齒輪)
    `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`
];

// 瀏覽器返回鍵狀態控制
let isPopStateAction = false;
window.addEventListener('popstate', (e) => {
    isPopStateAction = true;
    if (document.getElementById('view-daily-detail').classList.contains('active')) {
        closeDailyDetail(true);
    } else if (isSearchResultOpen) {
        handleBack(true);
    } else if (currentViewIndex !== 0) {
        switchView(0, false, true);
    }
    setTimeout(() => isPopStateAction = false, 100);
});

function pushHistory() {
    if (!isPopStateAction) history.pushState({}, '');
}

// MapLibre GL 地圖變數
let mapInstance = null;
let userMarker = null;
let currentLoc = [25.0478, 121.5170]; // 預設 [緯度, 經度]
let geoWatchId = null;
let hasCenteredMapInit = false; 

/* ================== 日期與時間工具 ================== */
function getDateKey(ts) { const d = new Date(ts); return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`; }
function formatTime(dateObj) { return `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`; }
function formatDuration(ms) { const totalSecs = Math.floor(ms / 1000); return `${String(Math.floor(totalSecs / 3600)).padStart(2, '0')}:${String(Math.floor((totalSecs % 3600) / 60)).padStart(2, '0')}:${String(totalSecs % 60).padStart(2, '0')}`; }
function formatMins(mins) { const h = Math.floor(mins / 60), m = Math.floor(mins % 60); return h > 0 ? `${h}小時 ${m}分鐘` : `${m}分鐘`; }
function fmtMoney(num) { return '$' + Number(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); } 
function fmtNum(num) { return Number(num).toLocaleString('en-US'); }

/* ================== 倍率與金額計算 ================== */
const FLAME_SVG = `<svg class="boost-flame" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5c1.3 3.2 6 5.8 6 11.2a6 6 0 0 1-12 0c0-2.7 1.4-4.6 2.8-5.8.1 1.7.9 2.9 2 3.4C10.4 8.4 10.9 5.2 12 2.5z"/><path d="M12 14c1 1.2 2.1 2.1 2.1 3.4a2.1 2.1 0 0 1-4.2 0c0-1.3 1.1-2.2 2.1-3.4z"/></svg>`;
function clampMultiplier(v) { let n = parseFloat(v); if (isNaN(n)) n = 1; n = Math.min(5, Math.max(1, n)); return Math.round(n * 100) / 100; }
function getCurrentMultiplier() { return clampMultiplier(settings.multiplier); }
// 基本金額 (含最低保障) × 倍率
function calcOrderAmount(billableMins, multiplier = 1) {
    let base = Math.ceil(((billableMins / 60) * RATE_PER_HOUR) * 100 + 0.0001) / 100;
    if (base < MIN_AMOUNT) base = MIN_AMOUNT;
    return Math.round(base * clampMultiplier(multiplier) * 100) / 100;
}

/* ================== 動態注入新功能 CSS ================== */
function injectNewStyles() {
    if (document.getElementById('injected-new-styles')) return;
    const style = document.createElement('style');
    style.id = 'injected-new-styles';
    style.innerHTML = `
        .swipe-edit { position: absolute; top: 0; left: -80px; bottom: 0; width: 80px; background: var(--primary); color: var(--btn-text); display: flex; justify-content: center; align-items: center; font-weight: bold; font-size: 1rem; cursor: pointer; z-index: 10; box-shadow: inset -2px 0 5px rgba(0,0,0,0.1); }
        body:not(.map-enabled) #stats-list, 
        body:not(.map-enabled) #tips-list, 
        body:not(.map-enabled) #costs-list { padding-bottom: 80px; }
        body:not(.map-enabled) .handle-bar-wrapper { display: none !important; }
        body:not(.map-enabled) .panel-header { cursor: default !important; }
        body:not(.map-enabled) #btn-menu { display: none !important; }
        
        body.map-enabled #map {
            display: block !important;
            width: 100vw !important;
            height: 100vh !important;
        }

        body.map-enabled .bottom-nav { display: none !important; }

        body.map-enabled .bottom-panel {
            top: 0 !important;
            height: 100vh !important;
            z-index: 90 !important;
        }

        .side-menu-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.5); z-index: 2999; opacity: 0; visibility: hidden; transition: opacity 0.3s, visibility 0.3s; backdrop-filter: blur(2px); -webkit-backdrop-filter: blur(2px); }
        .side-menu-overlay.active { opacity: 1; visibility: visible; }
        
        .side-menu { position: fixed; top: 0; left: -100%; width: 280px; max-width: 80vw; height: 100vh; background: var(--card-bg); z-index: 3000; box-shadow: 4px 0 15px rgba(0,0,0,0.1); transition: left 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); display: flex; flex-direction: column; backdrop-filter: var(--card-backdrop); -webkit-backdrop-filter: var(--card-backdrop); }
        .side-menu.active { left: 0; }
        
        .side-menu-header { padding: 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
        .side-menu-header h2 { font-size: 1.2rem; color: var(--primary); margin: 0; font-weight: bold; }
        
        .side-menu-content { flex: 1; overflow-y: auto; padding: 10px 0; -webkit-overflow-scrolling: touch; }
        .side-nav-item { display: flex; align-items: center; padding: 15px 20px; color: var(--text-main); text-decoration: none; font-size: 1.05rem; cursor: pointer; transition: background 0.2s, color 0.2s; }
        .side-nav-item:active { background: var(--timer-bg); }
        .side-nav-item .nav-icon { margin-right: 15px; width: 24px; text-align: center; font-size: 1.2rem; display: flex; align-items: center; justify-content: center; }
        .side-nav-item.active { background: var(--timer-bg); color: var(--primary); font-weight: bold; border-left: 4px solid var(--primary); }

        #side-menu-shift-section {
            margin-bottom: 50px !important;
        }

        body.map-enabled.on-home-view .header {
            background: transparent !important;
            box-shadow: none !important;
            border-bottom: none !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            pointer-events: none; 
        }
        body.map-enabled.on-home-view #btn-menu {
            background: var(--card-bg) !important;
            border-radius: 50% !important;
            width: 44px !important;
            height: 44px !important;
            display: flex !important;
            justify-content: center !important;
            align-items: center !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
            pointer-events: auto !important;
            transition: opacity 0.2s;
        }
        body.map-enabled.on-home-view #btn-back {
            display: none !important;
        }
        body.map-enabled.on-home-view #header-title-wrapper {
            background: var(--card-bg) !important;
            padding: 8px 20px !important;
            border-radius: 20px !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
            pointer-events: auto !important;
            transition: opacity 0.2s;
        }
        body.map-enabled.on-home-view #btn-search {
            pointer-events: auto !important;
        }
        body.map-enabled.on-home-view #shift-status-badge,
        body.map-enabled.on-home-view #shift-status-badge-right {
            display: none !important;
        }

        .detail-tab { flex: 1; text-align: center; padding: 12px; cursor: pointer; color: var(--text-muted); font-weight: bold; border-bottom: 3px solid transparent; margin-bottom: -2px; transition: 0.2s; }
        .detail-tab.active { color: var(--primary); border-bottom: 3px solid var(--primary); }
    `;
    document.head.appendChild(style);
}

/* ================== 自訂對話框引擎 ================== */
let currentDialogResolve = null;
function showCustomDialog({ type, title, message, defaultValue = '', confirmText = '確認', cancelText = '取消', isDanger = false, isNumeric = false }) {
    return new Promise((resolve) => {
        currentDialogResolve = resolve;
        const modal = document.getElementById('custom-dialog-modal');
        const titleEl = document.getElementById('custom-dialog-title');
        const msgEl = document.getElementById('custom-dialog-msg');
        const inputGroup = document.getElementById('custom-dialog-input-group');
        const inputEl = document.getElementById('custom-dialog-input');
        const btnsEl = document.getElementById('custom-dialog-btns');

        titleEl.innerText = title;
        msgEl.innerHTML = message.replace(/\n/g, '<br>');
        btnsEl.innerHTML = '';

        if (type === 'prompt') {
            inputGroup.style.display = 'block';
            inputEl.value = defaultValue;
            if (isNumeric) {
                // isNumeric: true → 整數數字鍵盤；'decimal' → 含小數點的數字鍵盤
                inputEl.type = 'number';
                inputEl.inputMode = isNumeric === 'decimal' ? 'decimal' : 'numeric';
                inputEl.step = 'any';
            } else {
                inputEl.type = 'text';
                inputEl.inputMode = 'text';
            }
        } else {
            inputGroup.style.display = 'none';
        }

        const handleClose = (value) => {
            closeModal('custom-dialog-modal');
            currentDialogResolve = null;
            resolve(value);
        };

        if (type === 'confirm' || type === 'prompt') {
            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'btn btn-outline';
            cancelBtn.innerText = cancelText;
            cancelBtn.onclick = () => handleClose(null);
            cancelBtn.style.flex = '1';
            btnsEl.appendChild(cancelBtn);
        }

        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'btn';
        confirmBtn.innerText = confirmText;
        if (isDanger) {
            confirmBtn.style.backgroundColor = 'var(--danger)';
            confirmBtn.style.borderColor = 'var(--danger)';
            confirmBtn.style.color = 'var(--danger-text)';
        }
        confirmBtn.onclick = () => {
            if (type === 'prompt') {
                handleClose(inputEl.value);
            } else {
                handleClose(true);
            }
        };
        confirmBtn.style.flex = '1';
        btnsEl.appendChild(confirmBtn);

        modal.classList.add('active');

        if (type === 'prompt') {
            inputEl.focus();
            setTimeout(() => {
                inputEl.focus();
                inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length);
            }, 50);
        }
    });
}

async function appAlert(message, title = '提示') { return await showCustomDialog({ type: 'alert', title, message }); }
async function appConfirm(message, title = '請確認', isDanger = false) { return await showCustomDialog({ type: 'confirm', title, message, isDanger }); }
async function appPrompt(message, defaultValue = '', title = '請輸入', isNumeric = false) { return await showCustomDialog({ type: 'prompt', title, message, defaultValue, isNumeric }); }

/* ================== 載入初始化 ================== */
function loadSettingsForCurrentUser() {
    let saved = localStorage.getItem(getStoreKey('order_settings'));
    if (saved) { settings = JSON.parse(saved); } 
    else {
        let globalSaved = localStorage.getItem('order_settings');
        if (globalSaved) { settings = JSON.parse(globalSaved); if(settings.theme && !settings.colorTheme) { settings.colorTheme = settings.theme; settings.effectTheme = 'none'; delete settings.theme; } } 
        else { settings = { colorTheme: 'pink', effectTheme: 'none', fontSize: '16px', customPrimary: '#ff7597', autoNightMode: false }; }
    }
    if(settings.matrixText1 === undefined) settings.matrixText1 = '01'; if(settings.matrixText2 === undefined) settings.matrixText2 = ''; if(settings.matrixText3 === undefined) settings.matrixText3 = '';
    if(settings.customCardEnable === undefined) settings.customCardEnable = false; if(settings.customCardBg === undefined) settings.customCardBg = '#ffffff'; if(settings.customCardOpacity === undefined) settings.customCardOpacity = 85;
    if(settings.enableMap === undefined) settings.enableMap = true; 
    if(settings.confirmDelivery === undefined) settings.confirmDelivery = false; 
    if(settings.rangeCalcBasis === undefined) settings.rangeCalcBasis = 'end';
    if(settings.customTextColor === undefined) settings.customTextColor = null;
    settings.multiplier = clampMultiplier(settings.multiplier === undefined ? 1 : settings.multiplier);
}

/* ================== APP 化操作限制 (地圖除外) ================== */
function isEditableTarget(t) { return !!(t && t.closest && t.closest('input, textarea, select, [contenteditable="true"]')); }
function isMapTarget(t) { return !!(t && t.closest && t.closest('#map')); }
function initAppLikeBehavior() {
    // 禁止選取文字、長按選單、複製/剪下 (輸入框除外)
    document.addEventListener('selectstart', e => { if (!isEditableTarget(e.target)) e.preventDefault(); });
    document.addEventListener('contextmenu', e => { if (!isEditableTarget(e.target)) e.preventDefault(); });
    ['copy', 'cut'].forEach(type => document.addEventListener(type, e => { if (!isEditableTarget(e.target)) e.preventDefault(); }));
    document.addEventListener('dragstart', e => { if (!isEditableTarget(e.target)) e.preventDefault(); });
    // 禁止雙指縮放 (iOS Safari 會無視 user-scalable=no)
    ['gesturestart', 'gesturechange', 'gestureend'].forEach(type => document.addEventListener(type, e => { if (!isMapTarget(e.target)) e.preventDefault(); }, { passive: false }));
    document.addEventListener('touchmove', e => { if (e.touches.length > 1 && !isMapTarget(e.target)) e.preventDefault(); }, { passive: false });
    // 雙擊放大由 CSS touch-action: manipulation 處理 (不攔截 touchend，以免快速連點按鈕失效)
    // 桌機：Ctrl+滾輪、Ctrl +/-/0 縮放、Ctrl+A 全選
    document.addEventListener('wheel', e => { if (e.ctrlKey && !isMapTarget(e.target)) e.preventDefault(); }, { passive: false });
    document.addEventListener('keydown', e => {
        if (!(e.ctrlKey || e.metaKey)) return;
        const k = e.key.toLowerCase();
        if (['+', '=', '-', '_', '0'].includes(k)) e.preventDefault();
        if ((k === 'a' || k === 'c' || k === 'x') && !isEditableTarget(e.target)) e.preventDefault();
    });
}

window.onload = function() {
    initAppLikeBehavior();
    // 註冊 Service Worker：讓 Android Chrome 能「安裝應用程式」並以全螢幕開啟 (需在 https 網址下)
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
        navigator.serviceWorker.register('sw.js').catch(err => console.warn('Service Worker 註冊失敗', err));
    }
    history.replaceState({ view: 0 }, '');
    injectNewStyles();
    if (currentUser === '新使用者' && !localStorage.getItem(getStoreKey('order_history_records')) && localStorage.getItem('order_history_records')) {
        ['order_active_timers', 'order_history_records', 'order_tips', 'order_costs'].forEach(k => { localStorage.setItem(getStoreKey(k), localStorage.getItem(k) || '[]'); });
    }
    initWeeklyView(); 
    loadSettingsForCurrentUser(); 
    loadData(); 
    
    initMap();
    initBottomPanel();

    applySettings(); 
    updateUIState();
    
    setInterval(updateTimersDisplay, 1000); 
    setInterval(applyNightMode, 60000);
    toggleMileageInput(); 
    initSwipeNavigation(); 
    switchView(0, true);
};

/* ================== MapLibre GL 向量地圖引擎 ================== */
function generateShieldIcon() {
    const width = 64;
    const height = 36;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    const r = 4;
    const x = 1.5, y = 1.5, w = width - 3, h = height - 3;

    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();

    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.lineWidth = 1.4;
    ctx.strokeStyle = '#1e293b';
    ctx.stroke();

    return ctx.getImageData(0, 0, width, height);
}

function initMap() {
    if (typeof maplibregl === 'undefined') { console.warn('無法載入 MapLibre 地圖資源'); return; }
    if (mapInstance) return;
    
    mapInstance = new maplibregl.Map({
        container: 'map',
        style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
        center: [currentLoc[1], currentLoc[0]],
        zoom: 15,
        attributionControl: false
    });

    // 建立正圓藍色定位方向標記 (徹底修正拉伸變形)
    const markerEl = document.createElement('div');
    markerEl.className = 'custom-blue-dot-container';
    markerEl.style.width = '18px';
    markerEl.style.height = '18px';
    markerEl.style.aspectRatio = '1 / 1';
    markerEl.style.position = 'relative';
    markerEl.innerHTML = `
        <div id="map-dir-marker" style="width: 18px; height: 18px; min-width: 18px; min-height: 18px; max-width: 18px; max-height: 18px; aspect-ratio: 1 / 1; box-sizing: border-box; background-color: #007aff; border: 2.5px solid white; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.4); position: relative; transition: transform 0.2s ease-out; display: flex; justify-content: center; align-items: center;">
            <div style="position: absolute; bottom: 50%; left: 50%; transform: translateX(-50%); width: 220px; height: 100px; background: radial-gradient(circle at bottom center, rgba(0, 122, 255, 0.4) 0%, rgba(0, 122, 255, 0) 70%); clip-path: polygon(50% 100%, 0% 0%, 100% 0%); transform-origin: bottom center; pointer-events: none;"></div>
        </div>
    `;

    userMarker = new maplibregl.Marker({ element: markerEl, anchor: 'center' })
        .setLngLat([currentLoc[1], currentLoc[0]])
        .addTo(mapInstance);

    mapInstance.on('dragstart', () => { mapTouchActive = true; });
    mapInstance.on('dragend', () => { mapTouchActive = false; lastMapTouchEnd = Date.now(); });
    mapInstance.on('zoomstart', (e) => { if (e.originalEvent) mapTouchActive = true; });
    mapInstance.on('zoomend', (e) => { if (e.originalEvent) { mapTouchActive = false; lastMapTouchEnd = Date.now(); } });

    mapInstance.on('load', () => {
        mapInstance.addImage('shield-box', generateShieldIcon(), {
            content: [6, 6, 58, 30],
            stretchX: [[14, 50]],
            stretchY: [[10, 26]]
        });

        const layers = mapInstance.getStyle().layers;
        let firstSymbolId;
        for (const layer of layers) {
            if (layer.type === 'symbol') {
                firstSymbolId = layer.id;
                break;
            }
        }

        // 淨化小巷與水域
        layers.forEach(layer => {
            if (layer.id.includes('road') && layer.type === 'line') {
                mapInstance.setPaintProperty(layer.id, 'line-color', '#f1f5f9');
            }
            if (layer.id.includes('water') && layer.type === 'fill') {
                mapInstance.setPaintProperty(layer.id, 'fill-color', '#e2f1fd');
            }
        });

        const roadSource = 'carto';
        const roadSourceLayer = 'transportation';
        const majorRoadFilter = [
            'all',
            ['in', 'class', 'motorway', 'trunk', 'primary', 'secondary']
        ];

        // 1. 【外層軌道】適度加粗外線寬度，凸顯立體感
        mapInstance.addLayer({
            'id': 'uber-traffic-casing',
            'type': 'line',
            'source': roadSource,
            'source-layer': roadSourceLayer,
            'filter': majorRoadFilter,
            'layout': {
                'line-cap': 'round',
                'line-join': 'round'
            },
            'paint': {
                'line-color': [
                    'case',
                    ['==', ['%', ['id'], 17], 0], '#ef4444', // 紅色 (壅塞)
                    ['==', ['%', ['id'], 6], 0], '#f97316',  // 橙色 (車多)
                    '#22c55e'                                // 翠綠色 (順暢)
                ],
                'line-width': [
                    'interpolate', ['linear'], ['zoom'],
                    11, 6.5,
                    13, 10.5,
                    14.5, 14.5,
                    16, 20.5,
                    18, 30
                ]
            }
        }, firstSymbolId);

        // 2. 【內層路心】純白路心，保持約 2.0px~2.3px 的醒目外框厚度
        mapInstance.addLayer({
            'id': 'uber-traffic-inner',
            'type': 'line',
            'source': roadSource,
            'source-layer': roadSourceLayer,
            'filter': majorRoadFilter,
            'layout': {
                'line-cap': 'round',
                'line-join': 'round'
            },
            'paint': {
                'line-color': '#ffffff',
                'line-width': [
                    'interpolate', ['linear'], ['zoom'],
                    11, 2.0,
                    13, 4.2,
                    14.5, 6.5,
                    16, 10.5,
                    18, 16.5
                ]
            }
        }, firstSymbolId);

        // 3. 【縣鄉道盾牌標籤】
        mapInstance.addLayer({
            'id': 'road-shield-labels',
            'type': 'symbol',
            'source': roadSource,
            'source-layer': 'transportation_name',
            'filter': [
                'all',
                ['has', 'ref']
            ],
            'layout': {
                'symbol-placement': 'line',
                'text-field': ['get', 'ref'],
                'text-size': [
                    'interpolate', ['linear'], ['zoom'],
                    12, 9.5,
                    15, 10.5,
                    18, 12.5
                ],
                'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                'text-rotation-alignment': 'viewport',
                'text-pitch-alignment': 'viewport',
                'icon-image': 'shield-box',
                'icon-text-fit': 'both',
                'icon-text-fit-padding': [1.5, 3.5, 1.5, 3.5],
                'icon-rotation-alignment': 'viewport',
                'symbol-spacing': 260
            },
            'paint': {
                'text-color': '#0f172a'
            }
        });
    });
        
    if ("geolocation" in navigator) {
        geoWatchId = navigator.geolocation.watchPosition(
            (position) => {
                currentLoc = [position.coords.latitude, position.coords.longitude];
                if (userMarker) {
                    userMarker.setLngLat([currentLoc[1], currentLoc[0]]);
                    if (position.coords.heading !== null && !isNaN(position.coords.heading)) {
                        const markerDiv = document.getElementById('map-dir-marker');
                        if (markerDiv) markerDiv.style.transform = `rotate(${position.coords.heading}deg)`;
                    }
                }
                updateMovingState(position);
                if (!hasCenteredMapInit) {
                    recenterMap(true); 
                    hasCenteredMapInit = true;
                } else if (mapInstance && isUserMoving() && !isUserTouchingMap()) {
                    // 移動中：鎖定藍點在畫面中；靜止時不移動地圖，讓使用者自由瀏覽
                    recenterMap(false, 800);
                }
            },
            (error) => { console.warn("定位獲取失敗: ", error); },
            { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
        );
    }

    setTimeout(() => { if (mapInstance) mapInstance.resize(); }, 500);
}

/* ---- 移動偵測：速度 ≥ 1.5 m/s (約 5.4 km/h) 視為移動中，停下後 8 秒才解除鎖定，避免紅燈時一直切換 ---- */
const MOVING_SPEED = 1.5, MOVING_HOLD_MS = 8000;
let lastGeoFix = null, movingUntil = 0, mapTouchActive = false, lastMapTouchEnd = 0;
function geoDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000, toRad = d => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}
function updateMovingState(position) {
    const { latitude, longitude, speed, accuracy } = position.coords;
    const t = position.timestamp || Date.now();
    let v = (speed !== null && !isNaN(speed)) ? speed : null;
    if (v === null && lastGeoFix) {
        const dist = geoDistance(lastGeoFix.lat, lastGeoFix.lon, latitude, longitude), dt = (t - lastGeoFix.t) / 1000;
        // 位移需大於定位誤差才算數，避免靜止時 GPS 飄移被誤判為移動
        v = (dt > 0 && dist > Math.max(accuracy || 0, 10)) ? dist / dt : 0;
    }
    if (v !== null && v >= MOVING_SPEED) movingUntil = Date.now() + MOVING_HOLD_MS;
    lastGeoFix = { lat: latitude, lon: longitude, t };
}
function isUserMoving() { return Date.now() < movingUntil; }
// 使用者正在拖動地圖 (或剛放開 3 秒內) 時先不搶回畫面
function isUserTouchingMap() { return mapTouchActive || (Date.now() - lastMapTouchEnd < 3000); }

function recenterMap(instant = false, duration = 250) {
    if (mapInstance && currentLoc) {
        const zoom = mapInstance.getZoom() || 15;
        const point = mapInstance.project([currentLoc[1], currentLoc[0]]);
        point.y += (window.innerHeight / 4); 
        const targetLngLat = mapInstance.unproject(point);
        
        if (instant) {
            mapInstance.jumpTo({ center: targetLngLat, zoom: zoom });
        } else {
            mapInstance.easeTo({ center: targetLngLat, zoom: zoom, duration: duration });
        }
    }
}

window.updatePanelOpacity = function() {
    if (currentViewIndex !== 0 || !document.body.classList.contains('map-enabled')) return;
    const panel = document.getElementById('bottom-panel');
    if (!panel) return;
    const match = panel.style.transform.match(/translateY\(([-\d.]+)px\)/);
    const y = match ? parseFloat(match[1]) : window.innerHeight * 0.5;
    
    let opacity = Math.max(0, Math.min(1, y / 120));
    
    const els = [
        document.getElementById('btn-menu'),
        document.getElementById('header-title-wrapper'),
        document.getElementById('btn-recenter'),
        document.getElementById('btn-headset-right')
    ];
    
    els.forEach(el => {
        if (el) {
            el.style.opacity = opacity;
            el.style.pointerEvents = opacity < 0.3 ? 'none' : 'auto';
        }
    });
};

function initBottomPanel() {
    const panel = document.getElementById('bottom-panel');
    const header = document.getElementById('panel-drag-handle');
    const content = document.getElementById('panel-scroll-content');
    if (!panel || !header || !content) return;

    let isDraggingPanel = false, isContentDragging = false, startY = 0, contentStartY = 0, initialTranslateY = 0, snapPoints = [], hasMoved = false;

    function updatePanelDimensions() {
        let viewH = window.innerHeight;
        snapPoints = [
            0,
            (viewH * 0.5) + 30,
            viewH - 160
        ];
    }

    function getTranslateY() {
        const match = panel.style.transform.match(/translateY\(([-\d.]+)px\)/);
        return match ? parseFloat(match[1]) : snapPoints[1];
    }

    header.addEventListener('touchstart', (e) => {
        if (!document.body.classList.contains('map-enabled')) return;
        isDraggingPanel = true; hasMoved = false;
        updatePanelDimensions(); 
        startY = e.touches[0].clientY;
        initialTranslateY = getTranslateY();
        panel.classList.add('dragging');
    }, {passive: true});

    content.addEventListener('touchstart', (e) => {
        if (!document.body.classList.contains('map-enabled')) return;
        contentStartY = e.touches[0].clientY;
        updatePanelDimensions();
        initialTranslateY = getTranslateY();
        isContentDragging = false;
    }, {passive: true});

    document.addEventListener('touchmove', (e) => {
        if (!document.body.classList.contains('map-enabled')) return;
        const currentY = e.touches[0].clientY;

        if (isDraggingPanel) {
            const deltaY = currentY - startY;
            if (Math.abs(deltaY) > 5) hasMoved = true;
            if (e.cancelable) e.preventDefault(); 
            let newY = initialTranslateY + deltaY;
            if (newY < snapPoints[0]) newY = snapPoints[0] - (snapPoints[0] - newY) * 0.2; 
            if (newY > snapPoints[2]) newY = snapPoints[2] + (newY - snapPoints[2]) * 0.2;
            panel.style.transform = `translateY(${newY}px)`;
            window.updatePanelOpacity();
        } 
        else if (e.target.closest('#panel-scroll-content')) {
            const deltaY = currentY - contentStartY;
            const isSwipingDown = deltaY > 0; 
            const isSwipingUp = deltaY < 0; 
            
            const isAtTop = content.scrollTop <= 0;
            const isAtBottom = Math.ceil(content.scrollTop + content.clientHeight) >= content.scrollHeight - 2;
            
            let shouldDrag = false;
            
            if (isSwipingDown && isAtTop) {
                shouldDrag = true;
            }
            else if (isSwipingUp && isAtBottom) {
                shouldDrag = true;
            }
            
            if (shouldDrag) {
                if (e.cancelable) e.preventDefault(); 
                
                if (!isContentDragging) {
                    isContentDragging = true;
                    hasMoved = false;
                    startY = currentY; 
                    initialTranslateY = getTranslateY();
                    panel.classList.add('dragging');
                }
                
                const dragDelta = currentY - startY;
                if (Math.abs(dragDelta) > 5) hasMoved = true;
                
                let newY = initialTranslateY + dragDelta;
                if (newY < snapPoints[0]) newY = snapPoints[0] - (snapPoints[0] - newY) * 0.2; 
                if (newY > snapPoints[2]) newY = snapPoints[2] + (newY - snapPoints[2]) * 0.2;
                panel.style.transform = `translateY(${newY}px)`;
                window.updatePanelOpacity();
            } else if (isContentDragging) {
                if (e.cancelable) e.preventDefault();
            }
        }
    }, {passive: false});

    function handlePanelEndOrCancel() {
        if (!isDraggingPanel && !isContentDragging) return;
        const wasDragging = isDraggingPanel || isContentDragging;
        isDraggingPanel = false;
        isContentDragging = false;
        panel.classList.remove('dragging');

        if (!wasDragging || !document.body.classList.contains('map-enabled')) return;

        let endY = getTranslateY();
        let closest = snapPoints[0];
        
        if (!hasMoved) {
            closest = initialTranslateY;
        } else {
            let minDiff = Math.abs(endY - snapPoints[0]);
            for(let i=1; i<snapPoints.length; i++) {
                let diff = Math.abs(endY - snapPoints[i]);
                if(diff < minDiff) { minDiff = diff; closest = snapPoints[i]; }
            }
        }
        
        panel.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
        panel.style.transform = `translateY(${closest}px)`;
        window.updatePanelOpacity();
        
        const contentEl = document.getElementById('panel-scroll-content');
        if (contentEl) contentEl.style.paddingBottom = `${closest + 40}px`;
        
        if (mapInstance) setTimeout(() => mapInstance.resize(), 300);
    }

    document.addEventListener('touchend', handlePanelEndOrCancel);
    document.addEventListener('touchcancel', handlePanelEndOrCancel); 

    setTimeout(() => {
        updatePanelDimensions();
        if(document.body.classList.contains('map-enabled') && (!panel.style.transform || panel.style.transform === 'none')) {
            let initY = snapPoints[1];
            panel.style.transform = `translateY(${initY}px)`;
            window.updatePanelOpacity();
            const contentEl = document.getElementById('panel-scroll-content');
            if (contentEl) contentEl.style.paddingBottom = `${initY + 40}px`;
        }
    }, 300);
    window.addEventListener('resize', updatePanelDimensions);
}

function getLuminance(r, g, b) { return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }
function hexToRgb(hex) { hex = hex.replace('#', ''); if (hex.length === 3) hex = hex.split('').map(c => c + c).join(''); const num = parseInt(hex, 16); return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 }; }

function applySettings() {
    document.documentElement.style.cssText = ''; document.body.style.removeProperty('--card-bg'); document.body.style.removeProperty('--timer-bg'); document.documentElement.style.fontSize = settings.fontSize; syncFontSizeUI();
    document.getElementById('auto-night-toggle').checked = settings.autoNightMode || false; document.getElementById('color-theme-select').value = settings.colorTheme; document.getElementById('effect-theme-select').value = settings.effectTheme;
    document.getElementById('custom-matrix-text-1').value = settings.matrixText1 || ''; document.getElementById('custom-matrix-text-2').value = settings.matrixText2 || ''; document.getElementById('custom-matrix-text-3').value = settings.matrixText3 || '';
    document.getElementById('custom-matrix-input-group').style.display = (settings.effectTheme === 'canvas-matrix-custom') ? 'block' : 'none';
    document.getElementById('custom-card-toggle').checked = settings.customCardEnable; document.getElementById('custom-card-panel').style.display = settings.customCardEnable ? 'block' : 'none';
    document.getElementById('picker-card-bg').value = settings.customCardBg; document.getElementById('picker-card-opacity').value = settings.customCardOpacity; document.getElementById('card-opacity-val').innerText = settings.customCardOpacity;
    
    document.getElementById('setting-map-toggle').checked = settings.enableMap !== false;
    document.getElementById('setting-confirm-delivery').checked = settings.confirmDelivery || false;

    if (settings.colorTheme === 'custom') {
        document.body.setAttribute('data-color-theme', 'custom');
        const pColor = settings.customPrimary || '#ff7597', rgb = hexToRgb(pColor), lum = getLuminance(rgb.r, rgb.g, rgb.b), btnText = lum > 0.6 ? '#000000' : '#ffffff', autoBg = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.05)`;
        document.documentElement.style.setProperty('--primary', pColor); document.documentElement.style.setProperty('--primary-hover', pColor); document.documentElement.style.setProperty('--btn-text', btnText); document.documentElement.style.setProperty('--page-bg', autoBg); document.documentElement.style.setProperty('--bg', autoBg); document.documentElement.style.setProperty('--border', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`); document.documentElement.style.setProperty('--card-bg', '#ffffff'); document.documentElement.style.setProperty('--timer-bg', '#f8fafc'); document.documentElement.style.setProperty('--danger', `rgba(${Math.max(0, rgb.r-60)}, ${Math.max(0, rgb.g-60)}, ${Math.max(0, rgb.b-60)}, 1)`);
        document.getElementById('custom-theme-panel').style.display = 'block'; document.getElementById('picker-primary').value = pColor;
    } else { document.body.setAttribute('data-color-theme', settings.colorTheme); document.getElementById('custom-theme-panel').style.display = 'none'; }

    document.body.setAttribute('data-effect-theme', settings.effectTheme);
    if (settings.effectTheme.startsWith('canvas-')) setTimeout(() => startCanvasEngine(settings.effectTheme), 50); else stopCanvasEngine();
    document.querySelectorAll('.btn, .btn-preset').forEach(btn => btn.style.setProperty('--btn-texture-opacity', settings.effectTheme.startsWith('texture-') ? '0.4' : '0'));
    
    if (settings.customCardEnable) {
        const cardRgb = hexToRgb(settings.customCardBg || '#ffffff'), op = (settings.customCardOpacity !== undefined ? settings.customCardOpacity : 85) / 100, opTimer = Math.max(0, op - 0.15); 
        document.body.style.setProperty('--card-bg', `rgba(${cardRgb.r}, ${cardRgb.g}, ${cardRgb.b}, ${op})`, 'important'); document.body.style.setProperty('--timer-bg', `rgba(${cardRgb.r}, ${cardRgb.g}, ${cardRgb.b}, ${opTimer})`, 'important');
    }
    
    if (settings.enableMap !== false) {
        document.body.classList.add('map-enabled');
        const sideShift = document.getElementById('side-menu-shift-section');
        if (sideShift) sideShift.style.display = 'block';
        const bottomShift = document.getElementById('bottom-panel-shift-card');
        if (bottomShift) bottomShift.style.display = 'none';

        if (mapInstance) { 
            setTimeout(() => mapInstance.resize(), 300); 
            const panel = document.getElementById('bottom-panel');
            if (panel && (!panel.style.transform || panel.style.transform === 'none')) {
                const snapMiddle = window.innerHeight * 0.5;
                panel.style.transform = `translateY(${snapMiddle}px)`;
                window.updatePanelOpacity();
            }
        }
    } else {
        document.body.classList.remove('map-enabled');
        const sideShift = document.getElementById('side-menu-shift-section');
        if (sideShift) sideShift.style.display = 'none';
        const bottomShift = document.getElementById('bottom-panel-shift-card');
        if (bottomShift) bottomShift.style.display = 'block';

        const panel = document.getElementById('bottom-panel');
        if (panel) panel.style.transform = 'none';
    }
    applyNightMode();
}

function changeTheme() { settings.colorTheme = document.getElementById('color-theme-select').value; settings.effectTheme = document.getElementById('effect-theme-select').value; saveSettings(); applySettings(); }
function applyPremiumPreset(colorTheme, effectTheme) { settings.colorTheme = colorTheme; settings.effectTheme = effectTheme; settings.customCardEnable = false; saveSettings(); applySettings(); }
function applyCustomPalette() { settings.colorTheme = 'custom'; settings.customPrimary = document.getElementById('picker-primary').value; saveSettings(); applySettings(); }
function saveMatrixText() { settings.matrixText1 = document.getElementById('custom-matrix-text-1').value; settings.matrixText2 = document.getElementById('custom-matrix-text-2').value; settings.matrixText3 = document.getElementById('custom-matrix-text-3').value; saveSettings(); applySettings(); }
function toggleCustomCard() { settings.customCardEnable = document.getElementById('custom-card-toggle').checked; saveSettings(); applySettings(); }
function updateCustomCard() { settings.customCardBg = document.getElementById('picker-card-bg').value; settings.customCardOpacity = document.getElementById('picker-card-opacity').value; document.getElementById('card-opacity-val').innerText = settings.customCardOpacity; saveSettings(); applySettings(); }
function setFontSize(size) { settings.fontSize = size; saveSettings(); document.documentElement.style.fontSize = size; syncFontSizeUI(); } // 拖動時只改字體，不重跑整個主題
function saveSettings() { localStorage.setItem(getStoreKey('order_settings'), JSON.stringify(settings)); }
function applyNightMode() { 
    const hour = new Date().getHours(); 
    const isNight = settings.autoNightMode && (hour >= 18 || hour < 6);
    if (isNight) document.body.classList.add('night-mode'); 
    else document.body.classList.remove('night-mode'); 
    applyTextColor(); // 背景可能改變 → 重新檢查文字顏色是否看得到
}

/* ================== 字體大小 / 文字顏色 ================== */
function onFontSizeInput() { setFontSize(document.getElementById('font-size-range').value + 'px'); }
function syncFontSizeUI() {
    const px = parseInt(settings.fontSize, 10) || 16;
    const r = document.getElementById('font-size-range'); if (!r) return;
    r.value = px; r.style.setProperty('--fill', `${((px - 12) / 12) * 100}%`);
    document.getElementById('font-size-val').innerText = px + 'px';
}

const MIN_TEXT_CONTRAST = 3; // 對比低於此值視為「幾乎看不見」
let colorParseCtx = null;
function parseCssColor(str) {
    if (!colorParseCtx) colorParseCtx = document.createElement('canvas').getContext('2d');
    colorParseCtx.fillStyle = '#000'; colorParseCtx.fillStyle = (str || '').trim() || '#000';
    const v = colorParseCtx.fillStyle;
    if (v.startsWith('#')) { const { r, g, b } = hexToRgb(v); return { r, g, b, a: 1 }; }
    const m = v.match(/rgba?\(([^)]+)\)/); if (!m) return { r: 0, g: 0, b: 0, a: 1 };
    const p = m[1].split(',').map(x => parseFloat(x));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
}
function blendColor(top, bottom) { const a = top.a; return { r: top.r * a + bottom.r * (1 - a), g: top.g * a + bottom.g * (1 - a), b: top.b * a + bottom.b * (1 - a), a: 1 }; }
function relLuminance({ r, g, b }) { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); }
function contrastRatio(c1, c2) { const l1 = relLuminance(c1), l2 = relLuminance(c2); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); }
// 以目前主題的背景、卡片、輸入框底色檢查文字是否看得清楚，回傳最差的對比值
function getTextContrast(hex) {
    const cs = getComputedStyle(document.body);
    const bg = blendColor(parseCssColor(cs.getPropertyValue('--bg')), { r: 255, g: 255, b: 255, a: 1 });
    const card = blendColor(parseCssColor(cs.getPropertyValue('--card-bg')), bg);
    const inner = blendColor(parseCssColor(cs.getPropertyValue('--timer-bg')), card);
    const text = parseCssColor(hex);
    return Math.min(contrastRatio(text, bg), contrastRatio(text, card), contrastRatio(text, inner));
}
function applyTextColor() {
    document.body.style.removeProperty('--text-main');
    const msg = document.getElementById('text-color-msg');
    const picker = document.getElementById('picker-text-color');
    if (picker) picker.value = settings.customTextColor || '#' + ['r','g','b'].map(k => Math.round(parseCssColor(getComputedStyle(document.body).getPropertyValue('--text-main'))[k]).toString(16).padStart(2, '0')).join('');
    if (!settings.customTextColor) { if (msg) { msg.className = 'text-color-msg'; msg.innerText = '目前使用主題預設文字色'; } return; }
    if (getTextContrast(settings.customTextColor) < MIN_TEXT_CONTRAST) {
        // 換主題 / 夜間模式後變得看不清楚 → 暫時改用主題預設色，避免畫面看不到字
        if (msg) { msg.className = 'text-color-msg warn'; msg.innerText = '⚠ 自訂文字色在目前背景下太難辨識，已暫時改用主題預設色'; }
        return;
    }
    document.body.style.setProperty('--text-main', settings.customTextColor, 'important');
    if (msg) { msg.className = 'text-color-msg'; msg.innerText = '已套用自訂文字色'; }
}
async function onTextColorChange() {
    const picker = document.getElementById('picker-text-color');
    const color = picker.value;
    const ratio = getTextContrast(color);
    if (ratio < MIN_TEXT_CONTRAST) {
        applyTextColor(); // 還原選色器
        return await appAlert(`這個顏色與背景太接近（對比 ${ratio.toFixed(1)}，需至少 ${MIN_TEXT_CONTRAST}），套用後文字會看不清楚，請選擇深一點或亮一點的顏色。`, '無法套用此顏色');
    }
    settings.customTextColor = color; saveSettings(); applyTextColor();
}
function resetTextColor() { settings.customTextColor = null; saveSettings(); applyTextColor(); }
function toggleAutoNight() { settings.autoNightMode = document.getElementById('auto-night-toggle').checked; saveSettings(); applyNightMode(); }
function toggleMapSetting() { 
    settings.enableMap = document.getElementById('setting-map-toggle').checked; 
    saveSettings(); 
    applySettings(); 
    updateUIState(); 
    updateShiftUI(); 
}
function toggleConfirmDelivery() { settings.confirmDelivery = document.getElementById('setting-confirm-delivery').checked; saveSettings(); applySettings(); }

/* ================== 耳機選單 / 倍率調整 ================== */
let currentHeadsetPane = 'menu';
function openHeadsetModal() {
    campaignEditMode = false; document.getElementById('cp-edit-mode').checked = false; currentCampaignTab = 'active';
    showHeadsetPane('menu');
    document.getElementById('headset-modal').classList.add('active');
}
function showHeadsetPane(name) {
    ['menu', 'multiplier', 'campaigns', 'campaign-edit'].forEach(p => {
        document.getElementById('headset-pane-' + p).style.display = (p === name) ? 'block' : 'none';
    });
    const titles = { 'menu': '耳機選單', 'multiplier': '倍率設定', 'campaigns': '達標活動', 'campaign-edit': editingCampaignId ? '編輯達標活動' : '新增達標活動' };
    document.getElementById('headset-title-text').innerText = titles[name];
    document.getElementById('headset-back').style.display = (name === 'menu') ? 'none' : 'flex';
    document.getElementById('headset-title-icon').style.display = (name === 'menu') ? 'block' : 'none';
    currentHeadsetPane = name;
    if (name === 'menu') renderHeadsetMenu();
    if (name === 'multiplier') updateMultiplierUI(getCurrentMultiplier());
    if (name === 'campaigns') renderCampaignList();
    document.getElementById('headset-modal-content').scrollTop = 0;
}
function headsetBack() { showHeadsetPane(currentHeadsetPane === 'campaign-edit' ? 'campaigns' : 'menu'); }
function renderHeadsetMenu() {
    document.getElementById('headset-menu-multiplier-sub').innerText = `目前倍率 ×${getCurrentMultiplier().toFixed(2)}`;
    const activeCount = campaigns.filter(c => getCampaignProgress(c).status === 'active').length;
    document.getElementById('headset-menu-campaign-sub').innerText = activeCount > 0 ? `${activeCount} 個進行中活動` : (campaigns.length > 0 ? `已儲存 ${campaigns.length} 個活動` : '尚無達標活動');
}

/* ================== 達標活動 ================== */
let editingCampaignId = null;
let campaignEditMode = false; // 開啟後才顯示 編輯 / 複製使用 / 刪除
function toggleCampaignEditMode() { campaignEditMode = document.getElementById('cp-edit-mode').checked; renderCampaignList(); }
const TROPHY_SVG = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M17 5h3v2a3 3 0 0 1-3 3"/><path d="M7 5H4v2a3 3 0 0 0 3 3"/></svg>`;
function escapeHtml(str) { return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function saveCampaigns() { localStorage.setItem(getStoreKey('order_campaigns'), JSON.stringify(campaigns)); }
function pad2(n) { return String(n).padStart(2, '0'); }
function toDateInputStr(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
// 活動區間單行顯示：同一天只寫一次日期；同年份結束日省略年份
function fmtCampaignPeriod(startTs, endTs) {
    const s = new Date(startTs), e = new Date(endTs);
    const hm = d => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    const wd = d => '日一二三四五六'[d.getDay()];
    const startStr = `${s.getFullYear()}/${pad2(s.getMonth() + 1)}/${pad2(s.getDate())}(${wd(s)}) ${hm(s)}`;
    if (getDateKey(startTs) === getDateKey(endTs)) return `${startStr}~${hm(e)}`;
    const endDate = (s.getFullYear() === e.getFullYear() ? '' : `${e.getFullYear()}/`) + `${pad2(e.getMonth() + 1)}/${pad2(e.getDate())}(${wd(e)})`;
    return `${startStr}~${endDate} ${hm(e)}`;
}
function fmtCampaignDateTime(ts) { const d = new Date(ts); return `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}(${'日一二三四五六'[d.getDay()]}) ${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }

// 訂單接單時間 (計時器開始)：新紀錄直接存有 startTs；舊紀錄由完成時間的日期 + startTimeStr 推回 (跨午夜則退一天)
function getRecordStartTs(r) {
    if (r.startTs) return r.startTs;
    const mins = timeStrToMins(r.startTimeStr);
    if (mins === null) return r.timestamp;
    const d = new Date(r.timestamp); d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
    let ts = d.getTime();
    if (ts > r.timestamp) ts -= 86400000;
    return ts;
}

// 活動進度：以「接單時間」落在區間內計算 (配送超過活動時間仍算)，已取餐取消單正常計入；只取「已達成目標中獎金最高」的一個
function getCampaignProgress(c) {
    const count = historyRecords.filter(r => { const st = getRecordStartTs(r); return st >= c.startTs && st <= c.endTs; }).length;
    const pending = activeTimers.filter(t => t.startTime >= c.startTs && t.startTime <= c.endTs).length;
    const tiers = [...c.tiers].sort((a, b) => a.target - b.target);
    let reward = 0, wonTier = null;
    tiers.forEach(t => { if (count >= t.target && (wonTier === null || t.reward >= reward)) { reward = t.reward; wonTier = t; } });
    const nextTier = tiers.find(t => count < t.target && t.reward > reward) || null;
    const now = Date.now();
    const status = now < c.startTs ? 'upcoming' : (now > c.endTs ? 'ended' : 'active');
    return { count, pending, reward, wonTier, nextTier, status, tiers };
}

// 已結束且有達標的活動 → 轉為收入用的「獎金紀錄」(算在活動結束當天，不計入件數)
function getCampaignBonusRecords() {
    const list = [];
    campaigns.forEach(c => {
        const p = getCampaignProgress(c);
        if (p.status !== 'ended' || !p.wonTier || p.reward <= 0) return;
        const d = new Date(c.endTs);
        list.push({ id: 'bonus_' + c.id, isBonus: true, campaignId: c.id, title: c.title, dateKey: getDateKey(c.endTs), year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(), timestamp: c.endTs, amount: p.reward, orderCount: p.count, target: p.wonTier.target });
    });
    return list;
}
function getBonusesBetween(startTs, endTs) { return getCampaignBonusRecords().filter(b => b.timestamp >= startTs && b.timestamp <= endTs); }

const FLAG_SVG = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/></svg>`;

// 進度軌道：起點旗子 → 各目標節點 (依單量比例擺放) → 終點獎盃 + 最高獎金
function renderCampaignTrack(c, p, pct) {
    const max = p.tiers.length ? p.tiers[p.tiers.length - 1].target : 1;
    const maxReward = Math.max(...p.tiers.map(t => t.reward));
    const counted = p.status !== 'upcoming';
    const dots = p.tiers.slice(0, -1).map(t => `<span class="cp-track-dot ${counted && p.count >= t.target ? 'done' : ''}" style="left:${(t.target / max) * 100}%;"></span>`).join('');
    const lastDone = counted && p.count >= max;
    return `<div class="cp-track">
        <span class="cp-track-start">${FLAG_SVG}</span>
        <div class="cp-track-line"><div class="cp-track-fill" style="width:${counted ? pct : 0}%;"></div>${dots}</div>
        <span class="cp-track-end ${lastDone ? 'done' : ''}">${TROPHY_SVG}</span>
    </div><div class="cp-track-max">${fmtMoney(maxReward)}</div>`;
}
function renderCampaignNextRow(p) {
    if (p.status === 'ended') {
        return p.wonTier
            ? `<div class="cp-next-row"><div><b>最終達成</b><div class="cp-next-desc">完成 ${p.count} 單，達成 ${p.wonTier.target} 單目標。</div></div><span class="cp-pill won">${fmtMoney(p.reward)}</span></div>`
            : `<div class="cp-next-row"><div><b>未達標</b><div class="cp-next-desc">完成 ${p.count} 單，距第一個目標差 ${p.tiers[0].target - p.count} 單。</div></div><span class="cp-pill">$0.00</span></div>`;
    }
    const base = p.status === 'upcoming' ? 0 : p.count;
    const next = p.tiers.find(t => base < t.target);
    if (!next) return `<div class="cp-next-row"><div><b>已達成全部目標</b><div class="cp-next-desc">完成 ${p.count} 單。</div></div><span class="cp-pill won">${fmtMoney(p.reward)}</span></div>`;
    return `<div class="cp-next-row"><div><b>下個目標</b><div class="cp-next-desc">於任務區間再達成 <b>${next.target - base}</b> 單。</div></div><span class="cp-pill">${fmtMoney(next.reward)}</span></div>`;
}

// 所有目標 (底部彈出面板)
function openCampaignTargets(id) {
    const c = campaigns.find(x => x.id === id); if (!c) return;
    const p = getCampaignProgress(c);
    const base = p.status === 'upcoming' ? 0 : p.count;
    document.getElementById('targets-sheet-title').innerText = c.title;
    document.getElementById('targets-sheet-list').innerHTML = p.tiers.map((t, i) => {
        const isLast = i === p.tiers.length - 1;
        const won = p.wonTier === t, reached = base >= t.target;
        let desc;
        if (reached) desc = won ? `已達成（${t.target} 單）・此為獲得的獎金` : `已達成（${t.target} 單）`;
        else if (p.status === 'ended') desc = `未達成（目標 ${t.target} 單，差 ${t.target - base} 單）`;
        else desc = `於任務區間再達成 <b>${t.target - base}</b> 單。<span class="sheet-total">（目標 ${t.target} 單）</span>`;
        return `<div class="sheet-row ${reached ? 'reached' : ''}">
            <div class="sheet-row-head"><span class="sheet-row-icon">${isLast ? TROPHY_SVG : FLAG_SVG}</span><b>目標 #${i + 1}</b><span class="cp-pill ${won ? 'won' : ''}">${fmtMoney(t.reward)}</span></div>
            <div class="sheet-row-desc">${desc}</div>
        </div>`;
    }).join('');
    document.getElementById('targets-sheet').classList.add('active');
}
function closeCampaignTargets() { document.getElementById('targets-sheet').classList.remove('active'); }

let currentCampaignTab = 'active';
const campaignExpanded = {}; // id → 是否展開；未設定時預設只展開「進行中」
function switchCampaignTab(tab) { currentCampaignTab = tab; renderCampaignList(); }
function toggleCampaignCard(id) {
    const card = document.querySelector(`.cp-card[data-id="${id}"]`); if (!card) return;
    const willExpand = card.classList.contains('collapsed');
    campaignExpanded[id] = willExpand;
    card.classList.toggle('collapsed', !willExpand);
}

function renderCampaignList() {
    const el = document.getElementById('campaign-list');
    const items = campaigns.map(c => ({ c, p: getCampaignProgress(c) }));
    const groups = { active: [], upcoming: [], ended: [] };
    items.forEach(x => groups[x.p.status].push(x));
    groups.active.sort((x, y) => x.c.endTs - y.c.endTs);      // 快結束的在前
    groups.upcoming.sort((x, y) => x.c.startTs - y.c.startTs); // 快開始的在前
    groups.ended.sort((x, y) => y.c.endTs - x.c.endTs);        // 最近結束的在前
    ['active', 'upcoming', 'ended'].forEach(k => { document.getElementById('cp-tab-count-' + k).innerText = groups[k].length ? `(${groups[k].length})` : ''; });
    document.querySelectorAll('.cp-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === currentCampaignTab));

    const list = groups[currentCampaignTab];
    const emptyText = { active: '目前沒有進行中的活動', upcoming: '沒有尚未開始的活動', ended: '尚無過往活動紀錄' }[currentCampaignTab];
    if (list.length === 0) { el.innerHTML = `<div class="empty-state">${emptyText}</div>`; return; }

    let html = '';
    list.forEach(({ c, p }) => {
        const statusText = { active: '進行中', upcoming: '未開始', ended: '已結束' }[p.status];
        const expanded = campaignExpanded[c.id] !== undefined ? campaignExpanded[c.id] : (p.status === 'active');
        const maxTarget = p.tiers.length ? p.tiers[p.tiers.length - 1].target : 1;
        const pct = Math.min(100, (p.count / maxTarget) * 100);
        let summary;
        if (p.status === 'upcoming') summary = `${fmtCampaignDateTime(c.startTs)} 開始`;
        else if (p.status === 'active') summary = `已完成 ${p.count} 單 · 目前 <b>${fmtMoney(p.reward)}</b>`;
        else summary = `完成 ${p.count} 單 · 獲得 <b>${fmtMoney(p.reward)}</b>`;

        let progressHtml = '';
        if (p.status === 'upcoming') {
            progressHtml = `<div class="cp-progress">尚未開始</div>`;
        } else {
            progressHtml = `<div class="cp-progress">${p.status === 'ended' ? '最終' : '已'}完成 <b>${p.count}</b> 單 · ${p.status === 'ended' ? '獲得' : '目前'}獎金 <b class="cp-reward">${fmtMoney(p.reward)}</b></div>`;
            if (p.pending > 0) progressHtml += `<div class="cp-next">另有 ${p.pending} 單配送中，送達後計入</div>`;
        }
        const targetsHtml = renderCampaignTrack(c, p, pct) + renderCampaignNextRow(p) + `<div class="cp-all-link" onclick="openCampaignTargets('${c.id}')">查看所有目標</div>`;
        const actions = campaignEditMode ? `<div class="cp-actions">
                <button class="btn btn-outline" onclick="openCampaignEditor('${c.id}')">編輯</button>
                <button class="btn btn-outline" onclick="openCampaignEditor(null, '${c.id}')">複製使用</button>
                <button class="btn btn-outline cp-del" onclick="deleteCampaign('${c.id}')">刪除</button>
            </div>` : '';

        html += `<div class="cp-card ${expanded ? '' : 'collapsed'}" data-id="${c.id}">
            <div class="cp-card-head" onclick="toggleCampaignCard('${c.id}')">
                <div class="cp-head-main"><div class="cp-card-title">${escapeHtml(c.title)}</div><div class="cp-card-summary">${summary}</div></div>
                <div class="cp-head-right"><span class="cp-status ${p.status}">${statusText}</span><span class="cp-chevron">▾</span></div>
            </div>
            <div class="cp-body-wrap"><div class="cp-body"><div class="cp-body-inner">
                ${c.content ? `<div class="cp-card-content">${escapeHtml(c.content)}</div>` : ''}
                <div class="cp-card-period">${fmtCampaignPeriod(c.startTs, c.endTs)}</div>
                ${progressHtml}
                ${targetsHtml}
                ${actions}
            </div></div></div>
        </div>`;
    });
    el.innerHTML = html;
}

function addCampaignTierRow(target = '', reward = '') {
    const row = document.createElement('div');
    row.className = 'cp-tier-row';
    row.innerHTML = `<span>完成</span><input type="number" inputmode="numeric" min="1" step="1" class="form-control cp-tier-target" placeholder="單量" value="${target}"><span>單 獎金$</span><input type="number" inputmode="decimal" min="0" step="any" class="form-control cp-tier-reward" placeholder="金額" value="${reward}"><button class="cp-tier-del" onclick="this.closest('.cp-tier-row').remove()" aria-label="刪除目標">✕</button>`;
    document.getElementById('cp-tiers').appendChild(row);
}

// id：編輯既有活動；templateId：複製既有活動當作新活動 (日期移到今天，保留時間與天數)
function openCampaignEditor(id = null, templateId = null) {
    editingCampaignId = id;
    const src = campaigns.find(c => c.id === (id || templateId));
    document.getElementById('cp-tiers').innerHTML = '';
    document.getElementById('cp-error').style.display = 'none';
    const today = new Date();
    if (src) {
        document.getElementById('cp-title').value = src.title || '';
        document.getElementById('cp-content').value = src.content || '';
        let sd = src.startDate, ed = src.endDate;
        if (!id) {
            const dayDiff = Math.round((new Date(src.endDate + 'T00:00') - new Date(src.startDate + 'T00:00')) / 86400000);
            const end = new Date(today); end.setDate(end.getDate() + dayDiff);
            sd = toDateInputStr(today); ed = toDateInputStr(end);
        }
        document.getElementById('cp-start-date').value = sd;
        document.getElementById('cp-start-time').value = src.startTime;
        document.getElementById('cp-end-date').value = ed;
        document.getElementById('cp-end-time').value = src.endTime;
        [...src.tiers].sort((a, b) => a.target - b.target).forEach(t => addCampaignTierRow(t.target, t.reward));
    } else {
        document.getElementById('cp-title').value = '';
        document.getElementById('cp-content').value = '';
        document.getElementById('cp-start-date').value = toDateInputStr(today);
        document.getElementById('cp-start-time').value = '00:00';
        document.getElementById('cp-end-date').value = toDateInputStr(today);
        document.getElementById('cp-end-time').value = '23:59';
        addCampaignTierRow(); addCampaignTierRow();
    }
    showHeadsetPane('campaign-edit');
}

function showCampaignError(msg) { const el = document.getElementById('cp-error'); el.innerText = msg; el.style.display = 'block'; el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }

function saveCampaign() {
    const sd = document.getElementById('cp-start-date').value, st = document.getElementById('cp-start-time').value;
    const ed = document.getElementById('cp-end-date').value, et = document.getElementById('cp-end-time').value;
    if (!sd || !st || !ed || !et) return showCampaignError('請完整填寫活動的開始與結束日期、時間');
    const startTs = new Date(`${sd}T${st}`).getTime();
    const endTs = new Date(`${ed}T${et}`).getTime() + 59999; // 結束時間包含該分鐘 (例如 23:59 → 23:59:59)
    if (isNaN(startTs) || isNaN(endTs)) return showCampaignError('日期或時間格式錯誤');
    if (endTs <= startTs) return showCampaignError('活動區間錯誤：結束時間必須晚於開始時間');

    const tiers = [];
    const rows = [...document.querySelectorAll('#cp-tiers .cp-tier-row')];
    for (const row of rows) {
        const tStr = row.querySelector('.cp-tier-target').value.trim(), rStr = row.querySelector('.cp-tier-reward').value.trim();
        if (tStr === '' && rStr === '') continue; // 空白列略過
        const target = Number(tStr), reward = Number(rStr);
        if (tStr === '' || !Number.isInteger(target) || target < 1) return showCampaignError('目標單量需為 1 以上的整數');
        if (rStr === '' || isNaN(reward) || reward < 0) return showCampaignError('請為每個目標輸入有效的獎勵金額');
        if (tiers.some(t => t.target === target)) return showCampaignError(`目標「${target} 單」重複，請修改`);
        tiers.push({ target, reward });
    }
    if (tiers.length === 0) return showCampaignError('請至少設定一個目標與獎勵金額');
    tiers.sort((a, b) => a.target - b.target);

    let title = document.getElementById('cp-title').value.trim();
    if (!title) { const d = new Date(startTs); title = `達標活動 ${d.getMonth() + 1}/${d.getDate()}`; }
    const data = { title, content: document.getElementById('cp-content').value.trim(), startDate: sd, startTime: st, endDate: ed, endTime: et, startTs, endTs, tiers };

    let savedId = editingCampaignId;
    if (editingCampaignId) {
        const idx = campaigns.findIndex(c => c.id === editingCampaignId);
        if (idx > -1) campaigns[idx] = { ...campaigns[idx], ...data };
    } else {
        savedId = 'cp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
        campaigns.push({ id: savedId, createdAt: Date.now(), ...data });
    }
    const savedCampaign = campaigns.find(c => c.id === savedId);
    if (savedCampaign) { currentCampaignTab = getCampaignProgress(savedCampaign).status; campaignExpanded[savedId] = true; }
    saveCampaigns();
    editingCampaignId = null;
    refreshIncomeViews();
    showHeadsetPane('campaigns');
}

async function deleteCampaign(id) {
    const c = campaigns.find(x => x.id === id); if (!c) return;
    const p = getCampaignProgress(c);
    const extra = (p.status === 'ended' && p.reward > 0) ? `\n此活動的達標獎金 ${fmtMoney(p.reward)} 也會從收入中移除。` : '';
    if (!(await appConfirm(`確定要刪除【${c.title}】嗎？${extra}`, '刪除達標活動', true))) return;
    campaigns = campaigns.filter(x => x.id !== id);
    saveCampaigns();
    refreshIncomeViews();
    renderCampaignList();
}

function refreshIncomeViews() {
    renderWeeklyData();
    if (document.getElementById('view-daily-detail').classList.contains('active') && currentDailyContext === 'income') renderDailyDetail();
}
function updateMultiplierUI(m) {
    const range = document.getElementById('multiplier-range');
    range.value = m;
    range.style.setProperty('--fill', `${((m - 1) / 4) * 100}%`);
    document.getElementById('multiplier-input').value = m.toFixed(2);
    document.getElementById('multiplier-preview').innerText = `最低金額試算：$${MIN_AMOUNT} × ${m.toFixed(2)} = ${fmtMoney(calcOrderAmount(0, m))}`;
}
function setMultiplier(v) {
    const m = clampMultiplier(v);
    settings.multiplier = m;
    saveSettings();
    updateMultiplierUI(m);
}
function onMultiplierRangeInput() { setMultiplier(document.getElementById('multiplier-range').value); }
function onMultiplierNumberChange() { setMultiplier(document.getElementById('multiplier-input').value); }

/* ================== 設定分頁 ================== */
let currentSettingsTab = 'general';
function switchSettingsTab(tab) {
    currentSettingsTab = tab;
    document.querySelectorAll('.settings-tab').forEach(el => el.classList.toggle('active', el.dataset.tab === tab));
    document.querySelectorAll('.settings-pane').forEach(el => el.style.display = (el.dataset.pane === tab) ? 'block' : 'none');
    const nameEl = document.getElementById('settings-current-user-name');
    if (nameEl) nameEl.innerText = currentUser;
    document.getElementById('view-settings').scrollTop = 0;
}

/* ================== UI 摺疊互動 ================== */
function toggleCollapse(header) {
    header.classList.toggle('collapsed');
    const wrap = header.nextElementSibling;
    if(wrap && wrap.classList.contains('collapsible-wrap')) wrap.classList.toggle('collapsed');
}

/* ================== 單號專用 Modal ================== */
let pendingOrderAction = null;
function openOrderNumberModal(title, defaultValue, callback) {
    document.getElementById('order-modal-title').innerText = title;
    const input = document.getElementById('order-number-input');
    input.value = defaultValue;
    pendingOrderAction = callback;
    document.getElementById('order-number-modal').classList.add('active');
    input.focus();
    setTimeout(() => { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }, 50);
    input.onkeypress = function(e) { if (e.key === 'Enter') confirmOrderNumber(); };
}
function confirmOrderNumber() {
    const val = document.getElementById('order-number-input').value.trim();
    if (val !== '') { closeModal('order-number-modal'); if (pendingOrderAction) { pendingOrderAction(val); pendingOrderAction = null; } }
}

/* ================== 每週油耗與圖表 (修正高低動態比例) ================== */
function calculateWeeklyFuel(startTs, endTs) {
    const allFuel = costRecords.filter(r => r.type === '加油' && r.mileage && Number(r.mileage) > 0).sort((a,b) => a.timestamp - b.timestamp);
    const weeklyFuel = allFuel.filter(r => r.timestamp >= startTs && r.timestamp <= endTs);
    if (weeklyFuel.length === 0) return null;
    const maxRecord = weeklyFuel[weeklyFuel.length - 1], firstThisWeek = weeklyFuel[0], prevRecords = allFuel.filter(r => r.timestamp < firstThisWeek.timestamp), prevRecord = prevRecords.length > 0 ? prevRecords[prevRecords.length - 1] : null;
    let distance = 0, fuelMoney = 0;
    if (prevRecord) { distance = maxRecord.mileage - prevRecord.mileage; fuelMoney = weeklyFuel.reduce((sum, r) => sum + r.amount, 0); } else if (weeklyFuel.length > 1) { distance = maxRecord.mileage - firstThisWeek.mileage; fuelMoney = weeklyFuel.slice(1).reduce((sum, r) => sum + r.amount, 0); } else return null;
    if (distance <= 0 || fuelMoney <= 0) return null; return { distance, fuelMoney, kmPerCost: (distance / fuelMoney).toFixed(2) };
}

function initWeeklyView() { const now = new Date(), day = now.getDay() || 7; now.setHours(0, 0, 0, 0); viewedWeekStart = new Date(now); viewedWeekStart.setDate(now.getDate() - day + 1); }
function prevWeek() { const sInput = document.getElementById('cost-search-input'); if(sInput) sInput.value = ''; viewedWeekStart.setDate(viewedWeekStart.getDate() - 7); renderWeeklyData(); }
function nextWeek() { const sInput = document.getElementById('cost-search-input'); if(sInput) sInput.value = ''; viewedWeekStart.setDate(viewedWeekStart.getDate() + 7); renderWeeklyData(); }
function getWeekNumber(d) { const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay()||7)); return Math.ceil(( ( (date - new Date(Date.UTC(date.getUTCFullYear(),0,1))) / 86400000) + 1)/7); }

function renderWeeklyChart(containerId, records, type) {
    const container = document.getElementById(containerId); if (!container) return;
    let dailyTotals = [0, 0, 0, 0, 0, 0, 0], dayLabels = ['一', '二', '三', '四', '五', '六', '日'];
    records.forEach(r => { let dayIdx = new Date(r.timestamp).getDay() - 1; if (dayIdx === -1) dayIdx = 6; dailyTotals[dayIdx] += r.amount; });
    const maxAmt = Math.max(...dailyTotals, 1); 
    let html = '';
    for (let i = 0; i < 7; i++) { 
        let heightPct = 0;
        if (dailyTotals[i] > 0) {
            heightPct = Math.round((dailyTotals[i] / maxAmt) * 100);
            if (heightPct < 5) heightPct = 5; // 確保極小數值依然有基礎辨識度
        }
        html += `
            <div class="chart-bar-wrap">
                <div class="chart-val">${dailyTotals[i] > 0 ? fmtNum(dailyTotals[i]) : ''}</div>
                <div class="chart-bar-track">
                    <div class="chart-bar ${type}" style="height: ${heightPct}%;"></div>
                </div>
                <div class="chart-label">${dayLabels[i]}</div>
            </div>`; 
    }
    container.innerHTML = html;
}

function filterCostRecords() {
    const keyword = document.getElementById('cost-search-input').value.trim().toLowerCase(); if (!keyword) { renderWeeklyData(); return; }
    const filtered = costRecords.filter(r => (r.type && r.type.toLowerCase().includes(keyword)) || (r.memo && r.memo.toLowerCase().includes(keyword)) || (r.mileage && String(r.mileage).includes(keyword)) );
    document.getElementById('weekly-date-range-costs').innerText = '搜尋結果'; document.getElementById('weekly-week-number-costs').innerText = `關鍵字: ${keyword}`; document.getElementById('weekly-total-amount-costs').innerText = fmtMoney(filtered.reduce((s,r)=>s+r.amount, 0));
    document.getElementById('weekly-fuel-consumption').style.display = 'none'; document.getElementById('weekly-chart-costs').innerHTML = ''; renderCosts(filtered, 'costs-list');
}

function renderWeeklyData() {
    const startStr = `${viewedWeekStart.getMonth() + 1}月${viewedWeekStart.getDate()}日週${['日','一','二','三','四','五','六'][viewedWeekStart.getDay()]}`;
    const end = new Date(viewedWeekStart); end.setDate(end.getDate() + 6); end.setHours(23, 59, 59, 999);
    const endStr = `${end.getMonth() + 1}月${end.getDate()}日週${['日','一','二','三','四','五','六'][end.getDay()]}`;
    const rangeText = `${startStr} - ${endStr}`, weekText = `第${getWeekNumber(viewedWeekStart)}週 ${viewedWeekStart.getFullYear()}`;

    ['', '-tips', '-costs'].forEach(suffix => {
        if (document.getElementById('weekly-date-range' + suffix)) document.getElementById('weekly-date-range' + suffix).innerText = rangeText;
        if (document.getElementById('weekly-week-number' + suffix)) document.getElementById('weekly-week-number' + suffix).innerText = weekText;
    });

    const startTs = viewedWeekStart.getTime(), endTs = end.getTime();
    
    const weeklyRecords = historyRecords.filter(r => r.timestamp >= startTs && r.timestamp <= endTs);
    const weeklyBonuses = getBonusesBetween(startTs, endTs);
    document.getElementById('weekly-total-amount').innerText = fmtMoney(weeklyRecords.reduce((sum, r) => sum + r.amount, 0) + weeklyBonuses.reduce((sum, b) => sum + b.amount, 0));
    document.getElementById('weekly-online-hours').innerText = `上線時數: ${formatMins(shiftRecords.filter(r => r.timestamp >= startTs && r.timestamp <= endTs).reduce((s, r) => s + r.durationMins, 0))}`;
    
    renderStats(weeklyRecords.concat(weeklyBonuses), 'stats-list'); 
    renderWeeklyChart('weekly-chart-income', weeklyRecords.concat(weeklyBonuses), 'income');

    const weeklyTips = tipRecords.filter(r => r.timestamp >= startTs && r.timestamp <= endTs);
    document.getElementById('weekly-total-amount-tips').innerText = fmtMoney(weeklyTips.reduce((sum, r) => sum + r.amount, 0));
    renderTips(weeklyTips, 'tips-list'); renderWeeklyChart('weekly-chart-tips', weeklyTips, 'tip');

    const weeklyCosts = costRecords.filter(r => r.timestamp >= startTs && r.timestamp <= endTs);
    document.getElementById('weekly-total-amount-costs').innerText = fmtMoney(weeklyCosts.reduce((sum, r) => sum + r.amount, 0));
    const fuelInfo = calculateWeeklyFuel(startTs, endTs);
    document.getElementById('weekly-fuel-consumption').style.display = fuelInfo ? 'block' : 'none'; if (fuelInfo) document.getElementById('fuel-consumption-val').innerText = `${fuelInfo.distance}km / $${fuelInfo.fuelMoney} (約 ${fuelInfo.kmPerCost} km/$)`;
    renderCosts(weeklyCosts, 'costs-list'); renderWeeklyChart('weekly-chart-costs', weeklyCosts, 'cost');
}

/* ================== Canvas 動態色彩渲染引擎 ================== */
let canvasAnimationId = null;
function stopCanvasEngine() { if(canvasAnimationId) cancelAnimationFrame(canvasAnimationId); document.getElementById('dynamic-canvas').style.display = 'none'; }
function startCanvasEngine(themeType) {
    stopCanvasEngine(); const canvas = document.getElementById('dynamic-canvas'), ctx = canvas.getContext('2d'); canvas.style.display = 'block';
    let w = canvas.width = window.innerWidth, h = canvas.height = window.innerHeight; window.onresize = () => { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; };
    const rgb = hexToRgb(getComputedStyle(document.body).getPropertyValue('--primary').trim() || '#38bdf8'), primaryRgbStr = `${rgb.r}, ${rgb.g}, ${rgb.b}`;

    if (themeType === 'canvas-ocean') {
        let bubbles = Array.from({length: 40}, () => ({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 4 + 1, speedY: Math.random() * 1.5 + 0.5, wobble: Math.random() * Math.PI * 2, wobbleSpeed: Math.random() * 0.05 }));
        let rays = Array.from({length: 5}, (_, i) => ({ x: (w / 5) * i, width: Math.random() * 100 + 50, angle: Math.random() * 0.2 - 0.1, alpha: Math.random() * 0.08 + 0.02 }));
        let time = 0;
        function draw() {
            ctx.clearRect(0, 0, w, h); time += 0.01; let bgGrad = ctx.createLinearGradient(0, 0, 0, h); bgGrad.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`); bgGrad.addColorStop(1, `rgba(0, 10, 25, 0.85)`); ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, w, h); ctx.globalCompositeOperation = 'screen';
            rays.forEach((r, i) => { let sway = Math.sin(time + i) * 60; ctx.beginPath(); ctx.moveTo(r.x + sway, 0); ctx.lineTo(r.x + r.width + sway, 0); ctx.lineTo(r.x + r.width + sway + h * Math.sin(r.angle), h); ctx.lineTo(r.x + sway + h * Math.sin(r.angle), h); let rayGrad = ctx.createLinearGradient(0, 0, 0, h); rayGrad.addColorStop(0, `rgba(255, 255, 255, ${r.alpha})`); rayGrad.addColorStop(1, `rgba(255, 255, 255, 0)`); ctx.fillStyle = rayGrad; ctx.fill(); });
            ctx.globalCompositeOperation = 'source-over';
            bubbles.forEach(b => { b.y -= b.speedY; b.wobble += b.wobbleSpeed; let bx = b.x + Math.sin(b.wobble) * 20; if (b.y < -10) { b.y = h + 10; b.x = Math.random() * w; } ctx.beginPath(); ctx.arc(bx, b.y, b.r, 0, Math.PI * 2); ctx.strokeStyle = `rgba(255, 255, 255, 0.4)`; ctx.fillStyle = `rgba(255, 255, 255, 0.1)`; ctx.stroke(); ctx.fill(); });
            canvasAnimationId = requestAnimationFrame(draw);
        } draw();
    } else if (themeType === 'canvas-matrix-custom') {
        let lines = [settings.matrixText1, settings.matrixText2, settings.matrixText3].filter(t => t && t.trim() !== ''); if (lines.length === 0) lines = ["0", "1"]; let charArray = lines.join('').split(''); const fontSize = 16, columns = Math.floor(w / fontSize) + 1;
        let streams = Array.from({length: columns}, (_, i) => ({ x: i * fontSize, y: Math.random() * -h, speed: Math.random() * 2 + 2, chars: Array.from({length: Math.floor(Math.random()*15 + 10)}, () => charArray[Math.floor(Math.random() * charArray.length)]) }));
        function draw() {
            ctx.clearRect(0,0,w,h); ctx.font = `bold ${fontSize}px monospace`;
            streams.forEach(s => { s.y += s.speed; if (s.y > h + 300) { s.y = Math.random() * -200; s.speed = Math.random() * 2 + 2; } for(let j=0; j<s.chars.length; j++) { let charY = s.y - (j * fontSize); if (charY > h || charY < 0) continue; if (Math.random() < 0.05) s.chars[j] = charArray[Math.floor(Math.random() * charArray.length)]; ctx.fillStyle = (j === 0) ? `rgba(255,255,255,1)` : `rgba(${primaryRgbStr}, ${1 - (j / s.chars.length)})`; ctx.fillText(s.chars[j], s.x, charY); } });
            canvasAnimationId = requestAnimationFrame(draw);
        } draw();
    } else if (themeType === 'canvas-stars') {
        let stars = Array.from({length: 150}, () => ({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.5, alpha: Math.random(), speed: (Math.random() * 0.03) + 0.005 })), meteors = [];
        function draw() {
            ctx.clearRect(0, 0, w, h);
            stars.forEach(s => { s.alpha += s.speed; if (s.alpha > 1 || s.alpha < 0) s.speed *= -1; ctx.globalAlpha = Math.abs(s.alpha); ctx.fillStyle = `rgba(255, 255, 255, 0.8)`; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill(); }); ctx.globalAlpha = 1; if (Math.random() < 0.02) meteors.push({ x: Math.random() * w, y: 0, len: Math.random() * 60 + 20, speed: Math.random() * 10 + 5, angle: Math.PI / 4 + (Math.random() * 0.2 - 0.1) }); ctx.lineWidth = 1.5;
            for (let i = meteors.length - 1; i >= 0; i--) { let m = meteors[i], grad = ctx.createLinearGradient(m.x, m.y, m.x - m.len * Math.cos(m.angle), m.y - m.len * Math.sin(m.angle)); grad.addColorStop(0, `rgba(255, 255, 255, 1)`); grad.addColorStop(0.2, `rgba(${primaryRgbStr}, 0.8)`); grad.addColorStop(1, `rgba(${primaryRgbStr}, 0)`); ctx.strokeStyle = grad; ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x - m.len * Math.cos(m.angle), m.y - m.len * Math.sin(m.angle)); ctx.stroke(); m.x += m.speed * Math.cos(m.angle); m.y += m.speed * Math.sin(m.angle); if (m.y > h + m.len || m.x > w + m.len) meteors.splice(i, 1); }
            canvasAnimationId = requestAnimationFrame(draw);
        } draw();
    } else if (themeType === 'canvas-particles') {
        let pts = Array.from({length: 60}, () => ({ x: Math.random()*w, y: Math.random()*h, vx: (Math.random()-0.5)*1.5, vy: (Math.random()-0.5)*1.5 }));
        function draw() { ctx.clearRect(0,0,w,h); ctx.fillStyle = `rgba(${primaryRgbStr}, 1)`; ctx.strokeStyle = `rgba(${primaryRgbStr}, 0.2)`; pts.forEach(p => { p.x += p.vx; p.y += p.vy; if(p.x<0 || p.x>w) p.vx*=-1; if(p.y<0 || p.y>h) p.vy*=-1; ctx.beginPath(); ctx.arc(p.x, p.y, 1.5, 0, Math.PI*2); ctx.fill(); }); for(let i=0; i<pts.length; i++){ for(let j=i+1; j<pts.length; j++){ let d = Math.hypot(pts[i].x-pts[j].x, pts[i].y-pts[j].y); if(d < 120) { ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke(); } } } canvasAnimationId = requestAnimationFrame(draw); } draw();
    } else if (themeType === 'canvas-beams') {
        let rot = 0; function draw() { ctx.clearRect(0,0,w,h); ctx.save(); ctx.translate(w/2, h/2); ctx.rotate(rot += 0.002); ctx.globalCompositeOperation = 'lighter'; for(let i=0; i<6; i++) { ctx.rotate((Math.PI*2)/6); let grad = ctx.createLinearGradient(0, 0, w, 0); grad.addColorStop(0, 'transparent'); grad.addColorStop(0.5, `rgba(${primaryRgbStr}, 0.04)`); grad.addColorStop(1, 'rgba(255,255,255, 0.02)'); ctx.fillStyle = grad; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(w, -200); ctx.lineTo(w, 200); ctx.fill(); } ctx.restore(); canvasAnimationId = requestAnimationFrame(draw); } draw();
    }
}

/* ==============================================================
    視圖切換與使用者管理邏輯
    ============================================================== */
function loadData() { 
    activeTimers = JSON.parse(localStorage.getItem(getStoreKey('order_active_timers'))) || []; 
    historyRecords = JSON.parse(localStorage.getItem(getStoreKey('order_history_records'))) || []; 
    tipRecords = JSON.parse(localStorage.getItem(getStoreKey('order_tips'))) || []; 
    costRecords = JSON.parse(localStorage.getItem(getStoreKey('order_costs'))) || []; 
    activeShift = JSON.parse(localStorage.getItem(getStoreKey('order_active_shift'))) || null;
    shiftRecords = JSON.parse(localStorage.getItem(getStoreKey('order_shifts'))) || [];
    activeWait = JSON.parse(localStorage.getItem(getStoreKey('order_active_wait'))) || null;
    waitRecords = JSON.parse(localStorage.getItem(getStoreKey('order_waits'))) || [];
    campaigns = JSON.parse(localStorage.getItem(getStoreKey('order_campaigns'))) || [];
    renderActiveTimers(); updateShiftUI(); initWeeklyView(); renderWeeklyData(); 
}

let currentViewIndex = 0, isSearchResultOpen = false; 
const views = ['home', 'income', 'tips', 'costs', 'rate', 'settings']; 
const viewTitles = ['新使用者', '收入', '小費', '成本', '準時率', '設定']; 
const viewHasSearch = [false, true, true, true, false, false]; 

function switchView(index, isInstant = false, fromPopState = false) { 
    document.querySelectorAll('.date-card.active').forEach(c => c.classList.remove('active')); 
    const dailyDetail = document.getElementById('view-daily-detail');
    if (dailyDetail.classList.contains('active')) { dailyDetail.style.transition = 'none'; dailyDetail.classList.remove('active'); void dailyDetail.offsetWidth; dailyDetail.style.transition = 'transform 0.3s ease-out'; }
    if (isSearchResultOpen) { const sr = document.getElementById('view-search-result'); sr.style.transition = 'none'; sr.classList.remove('active'); void sr.offsetWidth; sr.style.transition = 'transform 0.3s ease-out'; isSearchResultOpen = false; }
    if (currentViewIndex === index && !isInstant) return updateUIState();

    const oldIndex = currentViewIndex; currentViewIndex = index;
    let direction = 'right'; 
    if (oldIndex === 0 && index === views.length - 1 && !isInstant) direction = 'left'; 
    else if (oldIndex === views.length - 1 && index === 0 && !isInstant) direction = 'right'; 
    else if (index < oldIndex && !isInstant) direction = 'left';

    views.forEach((v, i) => {
        const el = document.getElementById(`view-${v}`);
        if (isInstant) { el.style.transition = 'none'; el.style.transform = i === index ? 'translateX(0)' : 'translateX(100vw)'; el.style.visibility = i === index ? 'visible' : 'hidden'; } 
        else if (i === index) { el.style.transition = 'none'; el.style.transform = direction === 'right' ? 'translateX(100vw)' : 'translateX(-100vw)'; el.style.visibility = 'visible'; void el.offsetWidth; el.style.transition = 'transform 0.3s ease-out'; el.style.transform = 'translateX(0)'; } 
        else if (i === oldIndex) { el.style.transition = 'transform 0.3s ease-out'; el.style.transform = direction === 'right' ? 'translateX(-100vw)' : 'translateX(100vw)'; setTimeout(() => { if (currentViewIndex !== i) el.style.visibility = 'hidden'; }, 300); } 
        else { el.style.transition = 'none'; el.style.visibility = 'hidden'; }
    });
    
    if([1, 2, 3].includes(index)) { initWeeklyView(); renderWeeklyData(); }
    if(index === 4) { calculatePunctuality(); }
    if(index === 5) { switchSettingsTab(currentSettingsTab); }
    
    if (index === 0 && document.body.classList.contains('map-enabled') && mapInstance) {
        setTimeout(() => mapInstance.resize(), 350);
    }
    
    if (!fromPopState && index !== 0) pushHistory();
    updateUIState(); 
}

let appTouchStartX = 0, appTouchStartY = 0, isSwipingApp = false;
function initSwipeNavigation() { 
    const appContainer = document.getElementById('app-container'); 
    appContainer.addEventListener('touchstart', (e) => { 
        if (e.target.closest('.swipe-content') || e.target.closest('.record-swipe-content') || e.target.closest('.horizontal-scroll-ignore') || e.target.type === 'range' || e.target.closest('.bottom-panel') || e.target.closest('.map-btn-recenter') || e.target.closest('#map')) return; 
        appTouchStartX = e.changedTouches[0].screenX; appTouchStartY = e.changedTouches[0].screenY; isSwipingApp = true; 
    }, {passive: true}); 
    appContainer.addEventListener('touchmove', (e) => { 
        if (!isSwipingApp) return; 
        if (Math.abs(e.changedTouches[0].screenY - appTouchStartY) > Math.abs(e.changedTouches[0].screenX - appTouchStartX)) isSwipingApp = false; 
    }, {passive: true}); 
    appContainer.addEventListener('touchend', (e) => { 
        if (!isSwipingApp) return; 
        let diffX = e.changedTouches[0].screenX - appTouchStartX; 
        if (diffX < -50) switchView(currentViewIndex < views.length - 1 ? currentViewIndex + 1 : 0, false); 
        else if (diffX > 50) switchView(currentViewIndex > 0 ? currentViewIndex - 1 : views.length - 1, false); 
        isSwipingApp = false; 
    }); 
}

function toggleSideMenu() {
    sideMenuOpen = !sideMenuOpen;
    const menu = document.getElementById('side-menu');
    const overlay = document.getElementById('side-menu-overlay');
    if (sideMenuOpen) { menu.classList.add('active'); overlay.classList.add('active'); } 
    else { menu.classList.remove('active'); overlay.classList.remove('active'); }
}

function updateUIState() { 
    // 底部導航同步 (套用向量 SVG 圖示)
    document.querySelectorAll('.bottom-nav .nav-item').forEach((el, index) => { 
        el.classList.remove('active'); 
        const iconSpan = el.querySelector('.nav-icon'); 
        if (iconSpan) { 
            iconSpan.innerHTML = NAV_ICONS[index]; 
            iconSpan.style.transform = 'scale(1)'; 
        } 
    }); 
    const activeNavBottom = document.getElementById(`nav-${currentViewIndex}`); 
    if(activeNavBottom) {
        activeNavBottom.classList.add('active'); 
        const activeIconSpan = activeNavBottom.querySelector('.nav-icon');
        if (activeIconSpan) { 
            activeIconSpan.innerHTML = NAV_ICONS[currentViewIndex]; 
            activeIconSpan.style.transform = 'scale(1.1)'; 
        }
    }

    // 側邊選單同步 (套用向量 SVG 圖示)
    document.querySelectorAll('.side-nav-item').forEach((el, index) => { 
        el.classList.remove('active'); 
        const iconSpan = el.querySelector('.nav-icon'); 
        if (iconSpan) { 
            iconSpan.innerHTML = NAV_ICONS[index]; 
            iconSpan.style.transform = 'scale(1)'; 
        } 
    }); 
    const activeNavSide = document.getElementById(`side-nav-${currentViewIndex}`); 
    if(activeNavSide) {
        activeNavSide.classList.add('active'); 
        const activeIconSpan = activeNavSide.querySelector('.nav-icon');
        if (activeIconSpan) { 
            activeIconSpan.innerHTML = NAV_ICONS[currentViewIndex]; 
            activeIconSpan.style.transform = 'scale(1.1)'; 
        }
    }

    const title = document.getElementById('header-title');
    const titleWrapper = document.getElementById('header-title-wrapper');
    const btnSearch = document.getElementById('btn-search');
    const btnBack = document.getElementById('btn-back');
    const btnMenu = document.getElementById('btn-menu');
    const btnRecenter = document.getElementById('btn-recenter');
    const shiftBadge = document.getElementById('shift-status-badge');
    const shiftBadgeRight = document.getElementById('shift-status-badge-right');

    if (btnMenu) { btnMenu.style.opacity = ''; btnMenu.style.pointerEvents = ''; }
    if (titleWrapper) { titleWrapper.style.opacity = ''; titleWrapper.style.pointerEvents = ''; }
    if (btnRecenter) { btnRecenter.style.opacity = ''; btnRecenter.style.pointerEvents = ''; }
    const headsetLeft = document.getElementById('btn-headset-left');
    const headsetRight = document.getElementById('btn-headset-right');
    if (headsetRight) { headsetRight.style.opacity = ''; headsetRight.style.pointerEvents = ''; }
    const isOverlayView = isSearchResultOpen || document.getElementById('view-daily-detail').classList.contains('active');
    const showHeadset = !isOverlayView && currentViewIndex === 0;
    const mapOn = document.body.classList.contains('map-enabled');
    if (headsetLeft) headsetLeft.style.display = (showHeadset && !mapOn) ? 'flex' : 'none';
    if (headsetRight) headsetRight.style.display = (showHeadset && mapOn) ? 'flex' : 'none';

    if (isSearchResultOpen || document.getElementById('view-daily-detail').classList.contains('active')) { 
        document.body.classList.remove('on-home-view');
        btnSearch.style.display = 'none'; btnBack.style.display = 'block'; 
        if(btnMenu) btnMenu.style.display = 'none';
        shiftBadge.style.display = 'none';
        if(shiftBadgeRight) shiftBadgeRight.style.display = 'none';
        titleWrapper.style.pointerEvents = 'none'; titleWrapper.style.cursor = 'default'; titleWrapper.onclick = null;
        title.innerHTML = document.getElementById('view-daily-detail').classList.contains('active') ? '單日明細' : '查照結果';
    } else { 
        if (currentViewIndex === 0) {
            document.body.classList.add('on-home-view');
            title.innerHTML = `${escapeHtml(currentUser)} <span style="font-size: 0.8rem; vertical-align: middle;">▾</span>`;
            titleWrapper.style.pointerEvents = 'auto'; titleWrapper.style.cursor = 'pointer'; 
            titleWrapper.onclick = () => openUserModal('switch');
            if (activeShift) updateShiftUI();
            
            if (typeof window.updatePanelOpacity === 'function') {
                window.updatePanelOpacity();
            }
        } else {
            document.body.classList.remove('on-home-view');
            title.innerHTML = viewTitles[currentViewIndex]; 
            titleWrapper.style.pointerEvents = 'none'; titleWrapper.style.cursor = 'default'; titleWrapper.onclick = null;
            shiftBadge.style.display = 'none';
            if(shiftBadgeRight) shiftBadgeRight.style.display = 'none';
        }
        btnSearch.style.display = viewHasSearch[currentViewIndex] ? 'block' : 'none'; 
        btnBack.style.display = 'none'; 
        if(btnMenu) btnMenu.style.display = 'block';
    } 
}

function handleBack(fromPopState = false) { 
    if(document.getElementById('view-daily-detail').classList.contains('active')) {
        closeDailyDetail(fromPopState); 
    } else if (isSearchResultOpen) { 
        document.getElementById('view-search-result').classList.remove('active'); 
        isSearchResultOpen = false; 
        updateUIState(); 
        if (!fromPopState) history.back();
    } 
}

function openUserModal(mode = 'switch') {
    const container = document.getElementById('user-list-container'); container.innerHTML = '';
    const title = document.getElementById('user-modal-title');
    
    if (mode === 'remove') {
        title.innerText = '移除使用者';
        usersList.forEach(u => {
            const wrap = document.createElement('div');
            wrap.style.display = 'flex'; wrap.style.gap = '8px'; wrap.style.alignItems = 'center'; wrap.style.marginBottom = '8px';
            const nameDiv = document.createElement('div');
            nameDiv.className = 'form-control'; nameDiv.style.flex = '1'; nameDiv.style.padding = '10px'; nameDiv.innerText = u;
            const delBtn = document.createElement('button');
            delBtn.className = 'btn'; delBtn.style.background = 'var(--danger)'; delBtn.style.borderColor = 'var(--danger)'; delBtn.style.padding = '10px'; delBtn.style.width = '70px'; delBtn.innerText = '移除';
            if (usersList.length <= 1) delBtn.disabled = true;
            delBtn.onclick = () => confirmDeleteUser(u);
            wrap.appendChild(nameDiv); wrap.appendChild(delBtn);
            container.appendChild(wrap);
        });
    } else {
        title.innerText = '切換使用者';
        usersList.forEach(u => {
            const btn = document.createElement('button'); btn.className = (u === currentUser) ? 'btn' : 'btn-outline';
            btn.style.width = '100%'; btn.style.padding = '12px'; btn.innerText = u; btn.onclick = () => switchUser(u); container.appendChild(btn);
        });
    }
    document.getElementById('user-modal').classList.add('active');
}

function switchUser(name) {
    currentUser = name; localStorage.setItem('app_current_user', currentUser);
    loadSettingsForCurrentUser(); applySettings(); loadData(); updateUIState(); closeModal('user-modal');
}

async function confirmDeleteUser(name) {
    if (usersList.length <= 1) return await appAlert('至少需保留一位使用者！', '錯誤');
    if (await appConfirm(`確定要永久移除使用者 [${name}] 嗎？\n此動作將清空該使用者的所有紀錄，且無法復原！`, '移除確認', true)) {
        ['order_active_timers', 'order_history_records', 'order_tips', 'order_costs', 'order_settings', 'order_last_weather', 'order_active_shift', 'order_shifts', 'order_active_wait', 'order_waits', 'order_campaigns'].forEach(key => {
            localStorage.removeItem(`${name}_${key}`);
        });
        usersList = usersList.filter(u => u !== name);
        localStorage.setItem('app_users_list', JSON.stringify(usersList));
        
        if (currentUser === name) {
            switchUser(usersList[0]);
        } else {
            openUserModal('remove'); 
        }
        await appAlert(`已移除使用者 [${name}]`, '成功');
    }
}

async function addUser() { const name = await appPrompt('請輸入新使用者名稱：', '', '新增使用者'); if (name && name.trim() !== '') { if (usersList.includes(name.trim())) return await appAlert('該使用者已存在！', '錯誤'); usersList.push(name.trim()); localStorage.setItem('app_users_list', JSON.stringify(usersList)); switchUser(name.trim()); } }
async function renameUser() { const newName = await appPrompt('請輸入新的名稱：', currentUser, '重新命名'); if (newName && newName.trim() !== '' && newName !== currentUser) { if (usersList.includes(newName.trim())) return await appAlert('該名稱已存在！', '錯誤'); const oldPrefix = `${currentUser}_`, newPrefix = `${newName.trim()}_`; ['order_active_timers', 'order_history_records', 'order_tips', 'order_costs', 'order_settings', 'order_last_weather', 'order_active_shift', 'order_shifts', 'order_active_wait', 'order_waits', 'order_campaigns'].forEach(key => { const data = localStorage.getItem(oldPrefix + key); if (data) { localStorage.setItem(newPrefix + key, data); localStorage.removeItem(oldPrefix + key); } }); usersList[usersList.indexOf(currentUser)] = newName.trim(); localStorage.setItem('app_users_list', JSON.stringify(usersList)); currentUser = newName.trim(); localStorage.setItem('app_current_user', currentUser); updateUIState(); await appAlert('重新命名成功！', '成功'); } }

/* ================== 計時器與打卡邏輯 ================== */
function toggleShift() {
    const now = Date.now();
    if (activeShift) {
        const diffMins = Math.round((now - activeShift.startTime) / 60000);
        if (diffMins >= 0) { shiftRecords.push({ id: 'shift_' + now, dateKey: getDateKey(activeShift.startTime), startTime: activeShift.startTime, endTime: now, durationMins: diffMins, timestamp: now }); localStorage.setItem(getStoreKey('order_shifts'), JSON.stringify(shiftRecords)); }
        activeShift = null; localStorage.setItem(getStoreKey('order_active_shift'), JSON.stringify(null)); if(activeWait) checkWaitState();
    } else { activeShift = { startTime: now }; localStorage.setItem(getStoreKey('order_active_shift'), JSON.stringify(activeShift)); }
    updateShiftUI(); checkWaitState(); renderWeeklyData();
}

function updateShiftUI() {
    const btns = document.querySelectorAll('.btn-shift-toggle-class');
    const durations = document.querySelectorAll('.shift-current-duration-class');
    const badgeCenter = document.getElementById('shift-status-badge');
    const badgeRight = document.getElementById('shift-status-badge-right');
    const startBtns = document.querySelectorAll('.btn-start');
    
    const isMapEnabled = document.body.classList.contains('map-enabled');

    if (activeShift) {
        btns.forEach(btn => { btn.innerHTML = '時段結束'; btn.style.background = 'transparent'; btn.style.border = '2px solid var(--danger)'; btn.style.color = 'var(--danger)'; });
        
        if (currentViewIndex === 0) {
            if (isMapEnabled) {
                badgeCenter.style.display = 'none';
                if (badgeRight) badgeRight.style.display = 'none';
            } else {
                badgeCenter.style.display = 'none';
                if (badgeRight) badgeRight.style.display = 'inline-block';
            }
        }
        durations.forEach(el => el.style.display = 'block'); 
        startBtns.forEach(b => { b.disabled = false; b.style.opacity = '1'; b.style.cursor = 'pointer'; });
    } else {
        btns.forEach(btn => { btn.innerHTML = '時段開始'; btn.style.background = 'var(--primary)'; btn.style.border = 'none'; btn.style.color = 'var(--btn-text)'; });
        badgeCenter.style.display = 'none';
        if (badgeRight) badgeRight.style.display = 'none';
        
        badgeCenter.innerText = '未上線'; badgeCenter.style.background = 'var(--timer-bg)'; badgeCenter.style.color = 'var(--text-main)'; badgeCenter.style.border = '1px solid var(--border)';

        durations.forEach(el => el.style.display = 'none'); 
        startBtns.forEach(b => { b.disabled = true; b.style.opacity = '0.5'; b.style.cursor = 'not-allowed'; });
    }
    updateActiveOrdersTitle();
}

function checkWaitState() {
    const now = Date.now(), isWaiting = (activeShift !== null) && (activeTimers.length === 0);
    if (isWaiting && !activeWait) { activeWait = { startTime: now }; localStorage.setItem(getStoreKey('order_active_wait'), JSON.stringify(activeWait)); } 
    else if (!isWaiting && activeWait) { const diffMins = Math.round((now - activeWait.startTime) / 60000); if (diffMins >= 0) { waitRecords.push({ id: 'wait_' + now, dateKey: getDateKey(activeWait.startTime), durationMins: diffMins, timestamp: now }); localStorage.setItem(getStoreKey('order_waits'), JSON.stringify(waitRecords)); } activeWait = null; localStorage.setItem(getStoreKey('order_active_wait'), JSON.stringify(null)); }
    const waitContainer = document.getElementById('wait-time-container');
    if (activeWait) { waitContainer.style.display = 'block'; document.getElementById('wait-current-duration').innerText = formatDuration(now - activeWait.startTime); } else { waitContainer.style.display = 'none'; }
}

async function startTimers(count) { if (!activeShift) return await appAlert('請先點擊「時段開始」進入上線狀態，才能開始接單！'); const now = Date.now(); for (let i = 0; i < count; i++) activeTimers.push({ id: 'timer_' + now + '_' + Math.random().toString(36).substr(2, 5), startTime: now }); localStorage.setItem(getStoreKey('order_active_timers'), JSON.stringify(activeTimers)); renderActiveTimers(); checkWaitState(); }

async function stopTimer(id) { 
    closeAllSwipes();
    if (settings.confirmDelivery) {
        const confirmed = await appConfirm('確定要完成配送並結算此訂單嗎？', '配送確認');
        if (!confirmed) return;
    }
    const index = activeTimers.findIndex(t => t.id === id); if (index === -1) return; 
    const timer = activeTimers[index], endTime = Date.now(), diffMins = Math.max(1, Math.round((endTime - timer.startTime) / 60000)); 
    const billableMins = Math.max(diffMins, timer.estimatedTime || 0);
    const multiplier = getCurrentMultiplier();
    const amount = calcOrderAmount(billableMins, multiplier);
    const endDateObj = new Date(endTime); 
    historyRecords.push({ id: timer.id, dateKey: getDateKey(endTime), year: endDateObj.getFullYear(), month: endDateObj.getMonth() + 1, day: endDateObj.getDate(), dayOfWeek: DAYS_MAP[endDateObj.getDay()], startTimeStr: formatTime(new Date(timer.startTime)), endTimeStr: formatTime(endDateObj), durationMins: diffMins, estimatedTime: timer.estimatedTime || 0, amount: Number(amount.toFixed(2)), multiplier: multiplier, startTs: timer.startTime, timestamp: endTime, storeName: timer.storeName || '', orderNumber: timer.orderNumber || '' }); 
    activeTimers.splice(index, 1); 
    localStorage.setItem(getStoreKey('order_active_timers'), JSON.stringify(activeTimers)); 
    localStorage.setItem(getStoreKey('order_history_records'), JSON.stringify(historyRecords)); 
    renderActiveTimers(); renderWeeklyData(); checkWaitState(); 
    if (currentViewIndex === 4) calculatePunctuality();
}

let pendingCancelTimerId = null;
function cancelTimer(id) { 
    closeAllSwipes(); 
    pendingCancelTimerId = id;
    document.getElementById('cancel-order-modal').classList.add('active');
}

function confirmCancelTimer(action) {
    closeModal('cancel-order-modal');
    const id = pendingCancelTimerId;
    const index = activeTimers.findIndex(t => t.id === id); 
    if (index === -1) return; 
    
    if (action === 'unpicked') {
        activeTimers.splice(index, 1);
        localStorage.setItem(getStoreKey('order_active_timers'), JSON.stringify(activeTimers)); 
        renderActiveTimers(); checkWaitState();
    } else if (action === 'picked') {
        const timer = activeTimers[index], endTime = Date.now(), diffMins = Math.max(1, Math.round((endTime - timer.startTime) / 60000)); 
        const billableMins = Math.max(diffMins, timer.estimatedTime || 0);
        const multiplier = getCurrentMultiplier();
        const amount = calcOrderAmount(billableMins, multiplier);
        const endDateObj = new Date(endTime); 
        
        historyRecords.push({ 
            id: timer.id, dateKey: getDateKey(endTime), year: endDateObj.getFullYear(), month: endDateObj.getMonth() + 1, day: endDateObj.getDate(), dayOfWeek: DAYS_MAP[endDateObj.getDay()], 
            startTimeStr: formatTime(new Date(timer.startTime)), endTimeStr: formatTime(endDateObj), durationMins: diffMins, estimatedTime: timer.estimatedTime || 0, 
            amount: Number(amount.toFixed(2)), multiplier: multiplier, startTs: timer.startTime, timestamp: endTime, storeName: timer.storeName || '', orderNumber: timer.orderNumber || '',
            isCancelled: true
        }); 
        
        activeTimers.splice(index, 1); 
        localStorage.setItem(getStoreKey('order_active_timers'), JSON.stringify(activeTimers)); 
        localStorage.setItem(getStoreKey('order_history_records'), JSON.stringify(historyRecords)); 
        renderActiveTimers(); renderWeeklyData(); checkWaitState(); 
        if (currentViewIndex === 4) calculatePunctuality();
    }
}

/* ================== 店家搜尋與綁定邏輯 ================== */
function incrementOrderNumber(str) {
    if (!str) return '1'; const match = str.match(/(\d+)$/);
    if (match) { const numLen = match[1].length; const nextNum = parseInt(match[1], 10) + 1; return str.slice(0, -numLen) + String(nextNum).padStart(numLen, '0'); }
    return str + '1';
}

function openStoreModal(id) { document.getElementById('store-target-id').value = id; const kwInput = document.getElementById('store-keyword'); kwInput.value = ''; document.getElementById('store-result-list').innerHTML = ''; document.getElementById('store-modal').classList.add('active'); kwInput.focus(); setTimeout(() => { kwInput.focus(); }, 50); }
function handleTimerTitleClick(id) { const timer = activeTimers.find(t => t.id === id); if (!timer) return; if (timer.storeName) { document.getElementById('timer-action-title').innerText = timer.storeName; document.getElementById('timer-action-id').value = id; document.getElementById('timer-action-modal').classList.add('active'); } else { openStoreModal(id); } }
function editOrderNumber() { const id = document.getElementById('timer-action-id').value, timer = activeTimers.find(t => t.id === id); if(timer) { closeModal('timer-action-modal'); openOrderNumberModal('修改單號', timer.orderNumber || '', function(newNum) { timer.orderNumber = newNum; localStorage.setItem(getStoreKey('order_active_timers'), JSON.stringify(activeTimers)); renderActiveTimers(); }); } }
async function cloneTimer() { const id = document.getElementById('timer-action-id').value, timer = activeTimers.find(t => t.id === id); if (!activeShift) { closeModal('timer-action-modal'); return await appAlert('請先點擊「時段開始」進入上線狀態，才能開始接單！'); } if(timer) { closeModal('timer-action-modal'); const nextNum = incrementOrderNumber(timer.orderNumber); openOrderNumberModal(`為【${timer.storeName}】新增訂單`, nextNum, function(orderNum) { const now = Date.now(); activeTimers.push({ id: 'timer_' + now + '_' + Math.random().toString(36).substr(2, 5), startTime: now, storeName: timer.storeName, orderNumber: orderNum }); localStorage.setItem(getStoreKey('order_active_timers'), JSON.stringify(activeTimers)); renderActiveTimers(); checkWaitState(); }); } }
function rebindTimer() { const id = document.getElementById('timer-action-id').value; closeModal('timer-action-modal'); openStoreModal(id); }

async function addCustomStore() { const kw = document.getElementById('store-keyword').value.trim(); const name = await appPrompt('請輸入新店家名稱：', kw, '新增自訂店家'); if (name && name.trim() !== '') { customStores.push({ code: '自訂', name: name.trim() }); localStorage.setItem('app_custom_stores', JSON.stringify(customStores)); searchStore(); selectStore(name.trim()); } }
function searchStore() {
    const keyword = document.getElementById('store-keyword').value.trim().toLowerCase(), listEl = document.getElementById('store-result-list'); listEl.innerHTML = '';
    if (!keyword) return; const allStores = STORE_LIST.concat(customStores); const results = allStores.filter(s => s.code.toLowerCase().includes(keyword) || s.name.toLowerCase().includes(keyword));
    if (results.length === 0) return listEl.innerHTML = '<div style="padding:10px; text-align:center; color:var(--text-muted);">無符合的店家，請點擊上方 [新增]</div>';
    results.forEach(s => {
        const div = document.createElement('div'); div.style.padding = '12px'; div.style.borderBottom = '1px solid var(--border)'; div.style.cursor = 'pointer'; div.style.color = 'var(--text-main)';
        div.innerHTML = `<span style="font-size:0.8rem; background:var(--primary); color:var(--btn-text); padding:2px 6px; border-radius:4px; margin-right:8px; box-shadow:0 1px 2px rgba(0,0,0,0.1);">${s.code}</span><strong>${escapeHtml(s.name)}</strong>`;
        div.onclick = () => selectStore(s.name); listEl.appendChild(div);
    });
}
function selectStore(storeName) {
    const id = document.getElementById('store-target-id').value, timer = activeTimers.find(t => t.id === id); if (!timer) return;
    closeModal('store-modal'); 
    openOrderNumberModal(`已選擇：${storeName}\n請輸入訂單號碼`, '', async function(orderNum) {
        timer.storeName = storeName; timer.orderNumber = orderNum; 
        const unboundTimers = activeTimers.filter(t => !t.storeName && t.id !== id);
        if (unboundTimers.length > 0) { if (await appConfirm(`您還有 ${unboundTimers.length} 個未綁定的計時器。\n是否要自動套用【${storeName}】並自動遞增單號？`, '自動綁定')) { let currentNum = timer.orderNumber; unboundTimers.forEach(ut => { currentNum = incrementOrderNumber(currentNum); ut.storeName = storeName; ut.orderNumber = currentNum; }); } }
        localStorage.setItem(getStoreKey('order_active_timers'), JSON.stringify(activeTimers)); renderActiveTimers(); 
    });
}

/* ================== 預估時間與刪除紀錄邏輯 ================== */
async function setEstimatedTime(id) { closeAllSwipes(); const timer = activeTimers.find(t => t.id === id); if (!timer) return; const val = await appPrompt('請輸入預估時間 (分鐘):', timer.estimatedTime || '', '設定預估時間', true); if (val !== null && val.trim() !== '') { const num = parseInt(val, 10); if (!isNaN(num) && num >= 0) { timer.estimatedTime = num; localStorage.setItem(getStoreKey('order_active_timers'), JSON.stringify(activeTimers)); renderActiveTimers(); } else { await appAlert('請輸入有效的數字', '錯誤'); } } }
async function editHistoryEstimatedTime(id) { 
    closeAllSwipes(); 
    const record = historyRecords.find(r => r.id === id); 
    if (!record) return; 
    const val = await appPrompt('請輸入預估時間 (分鐘):', record.estimatedTime || '', '設定預估時間', true); 
    if (val !== null && val.trim() !== '') { 
        const num = parseInt(val, 10); 
        if (!isNaN(num) && num >= 0) { 
            record.estimatedTime = num; 
            const billableMins = Math.max(record.durationMins, num); 
            const amount = calcOrderAmount(billableMins, record.multiplier || 1);
            record.amount = Number(amount.toFixed(2)); 
            localStorage.setItem(getStoreKey('order_history_records'), JSON.stringify(historyRecords)); 
            renderWeeklyData(); 
            if(document.getElementById('view-daily-detail').classList.contains('active')) renderDailyDetailList(); 
            if (currentViewIndex === 4) calculatePunctuality(); 
        } else { 
            await appAlert('請輸入有效的數字', '錯誤'); 
        } 
    } 
}
async function deleteHistoryRecord(id) { closeAllSwipes(); if(await appConfirm('確定刪除這筆收入紀錄嗎？', '刪除確認', true)) { historyRecords = historyRecords.filter(t => t.id !== id); localStorage.setItem(getStoreKey('order_history_records'), JSON.stringify(historyRecords)); renderWeeklyData(); if(document.getElementById('view-daily-detail').classList.contains('active')) renderDailyDetailList(); if (currentViewIndex === 4) calculatePunctuality(); } }

/* ================== 卡片拖曳排序邏輯 ================== */
let pressTimer = null, isDraggingItem = false, dragTarget = null, placeholder = null, initialClientY = 0, currentTouchY = 0; 
let itemSwipeStartX = 0, itemSwipeStartY = 0, itemSwipeCurrentX = 0, itemSwipingEl = null, openItemSwipeEl = null, itemSwipeDirection = null;

function closeAllSwipes() { if (openItemSwipeEl) { openItemSwipeEl.style.transition = 'transform 0.3s ease'; openItemSwipeEl.style.transform = 'translateX(0px)'; openItemSwipeEl = null; } }
function forceCleanupDrag() { isDraggingItem = false; clearTimeout(pressTimer); closeAllSwipes(); document.querySelectorAll('.drag-placeholder').forEach(el => el.remove()); const list = document.getElementById('active-timers-list'); document.querySelectorAll('.active-timer-container.dragging').forEach(el => { el.classList.remove('dragging'); el.style.position = ''; el.style.top = ''; el.style.left = ''; el.style.width = ''; el.style.margin = ''; el.style.zIndex = ''; el.style.transform = ''; if (el.parentNode === document.body && list) { list.appendChild(el); } }); if (!document.body.classList.contains('map-enabled')) { document.getElementById('view-home').style.overflowY = ''; } else { const panelScroll = document.getElementById('panel-scroll-content'); if (panelScroll) panelScroll.style.overflowY = ''; } dragTarget = null; placeholder = null; }

document.addEventListener('visibilitychange', () => { if (document.hidden) { forceCleanupDrag(); renderActiveTimers(); } }); window.addEventListener('pagehide', () => { forceCleanupDrag(); }); window.addEventListener('blur', () => { forceCleanupDrag(); });

function handleItemTouchStart(e) { 
    if (isDraggingItem) { forceCleanupDrag(); renderActiveTimers(); return; }
    clearTimeout(pressTimer);
    if (openItemSwipeEl && openItemSwipeEl !== e.currentTarget) { openItemSwipeEl.style.transform = 'translateX(0px)'; openItemSwipeEl = null; } 
    const clientX = e.touches ? e.touches[0].clientX : e.clientX; currentTouchY = e.touches ? e.touches[0].clientY : e.clientY;
    itemSwipeStartX = clientX; itemSwipeStartY = currentTouchY; itemSwipingEl = e.currentTarget; itemSwipingEl.style.transition = 'none'; itemSwipeCurrentX = window.getComputedStyle(itemSwipingEl).transform !== 'none' ? parseInt(window.getComputedStyle(itemSwipingEl).transform.split(',')[4]) || 0 : 0; itemSwipeDirection = null; 

    const isClickable = e.target.closest('button') || e.target.closest('.swipe-delete') || e.target.closest('.swipe-edit') || e.target.tagName.toLowerCase() === 'h3';
    if (!isClickable && e.currentTarget.closest('.active-timer-container')) {
        dragTarget = e.currentTarget.closest('.active-timer-container');
        pressTimer = setTimeout(() => {
            if (isDraggingItem) return;
            isDraggingItem = true;
            if (navigator.vibrate) navigator.vibrate(50);
            if (!document.body.classList.contains('map-enabled')) { document.getElementById('view-home').style.overflowY = 'hidden'; } else { document.getElementById('panel-scroll-content').style.overflowY = 'hidden'; }
            initialClientY = currentTouchY;
            const rect = dragTarget.getBoundingClientRect();
            document.querySelectorAll('.drag-placeholder').forEach(el => el.remove());
            placeholder = document.createElement('div'); placeholder.className = 'drag-placeholder'; placeholder.style.height = rect.height + 'px';
            dragTarget.parentNode.insertBefore(placeholder, dragTarget);
            dragTarget.style.position = 'fixed'; dragTarget.style.top = rect.top + 'px'; dragTarget.style.left = rect.left + 'px'; dragTarget.style.width = rect.width + 'px'; dragTarget.style.margin = '0'; dragTarget.style.zIndex = '5000'; dragTarget.classList.add('dragging');
            document.body.appendChild(dragTarget);
        }, 200); 
    }
}

function handleItemTouchMove(e) { 
    const clientX = e.touches ? e.touches[0].clientX : e.clientX; currentTouchY = e.touches ? e.touches[0].clientY : e.clientY;
    let diffX = clientX - itemSwipeStartX; let diffY = currentTouchY - itemSwipeStartY; 
    if (!isDraggingItem) {
        if (Math.abs(diffX) > 10 || Math.abs(diffY) > 10) clearTimeout(pressTimer);
        if (!itemSwipeDirection) { if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 5) itemSwipeDirection = 'horizontal'; else if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffY) > 5) itemSwipeDirection = 'vertical'; } 
        if (itemSwipeDirection === 'vertical') return; 
        if (itemSwipeDirection === 'horizontal') { 
            if (e.cancelable) e.preventDefault(); 
            let moveX = itemSwipeCurrentX + diffX; 
            let hasRightAction = itemSwipingEl.querySelector('.swipe-edit') !== null, hasLeftAction = itemSwipingEl.querySelector('.swipe-delete') !== null;
            if (!hasRightAction && moveX > 0) moveX = 0; if (!hasLeftAction && moveX < 0) moveX = 0;
            if (moveX > 90) moveX = 90; if (moveX < -90) moveX = -90; 
            itemSwipingEl.style.transform = `translateX(${moveX}px)`; 
        } 
    } else {
        if (e.cancelable) e.preventDefault(); 
        const deltaY = currentTouchY - initialClientY; dragTarget.style.transform = `translateY(${deltaY}px) scale(1.02)`;
        const list = document.getElementById('active-timers-list'), siblings = [...list.querySelectorAll('.active-timer-container:not(.dragging)')];
        let nextSibling = siblings.find(sibling => { const box = sibling.getBoundingClientRect(); return currentTouchY < box.top + box.height / 2; });
        if (placeholder) { if (nextSibling) list.insertBefore(placeholder, nextSibling); else list.appendChild(placeholder); }
    }
}

function handleItemTouchEnd(e) { 
    clearTimeout(pressTimer);
    if (isDraggingItem) {
        isDraggingItem = false;
        if (!document.body.classList.contains('map-enabled')) { document.getElementById('view-home').style.overflowY = ''; } else { const panelScroll = document.getElementById('panel-scroll-content'); if (panelScroll) panelScroll.style.overflowY = ''; }
        if (dragTarget && placeholder && placeholder.parentNode) { placeholder.parentNode.insertBefore(dragTarget, placeholder); } else if (dragTarget) { const list = document.getElementById('active-timers-list'); if (list && dragTarget.parentNode !== list) list.appendChild(dragTarget); }
        if (dragTarget) { dragTarget.classList.remove('dragging'); dragTarget.style.position = ''; dragTarget.style.top = ''; dragTarget.style.left = ''; dragTarget.style.width = ''; dragTarget.style.margin = ''; dragTarget.style.zIndex = ''; dragTarget.style.transform = ''; }
        document.querySelectorAll('.drag-placeholder').forEach(el => el.remove()); placeholder = null;
        if (navigator.vibrate) navigator.vibrate(20);
        const list = document.getElementById('active-timers-list');
        if (list) { const newOrderIds = [...list.querySelectorAll('.active-timer-container')].map(el => el.getAttribute('data-id')); if (newOrderIds.length === activeTimers.length) { activeTimers.sort((a, b) => newOrderIds.indexOf(a.id) - newOrderIds.indexOf(b.id)); localStorage.setItem(getStoreKey('order_active_timers'), JSON.stringify(activeTimers)); } }
        dragTarget = null; return;
    }
    if (!itemSwipingEl || itemSwipeDirection === 'vertical') return; 
    itemSwipingEl.style.transition = 'transform 0.3s ease'; 
    let currentX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX; 
    let finalX = itemSwipeCurrentX + (currentX - itemSwipeStartX); 
    let hasRightAction = itemSwipingEl.querySelector('.swipe-edit') !== null, hasLeftAction = itemSwipingEl.querySelector('.swipe-delete') !== null;
    if (hasLeftAction && finalX < -40) { itemSwipingEl.style.transform = `translateX(-80px)`; openItemSwipeEl = itemSwipingEl; } else if (hasRightAction && finalX > 40) { itemSwipingEl.style.transform = `translateX(80px)`; openItemSwipeEl = itemSwipingEl; } else { itemSwipingEl.style.transform = `translateX(0px)`; if (openItemSwipeEl === itemSwipingEl) openItemSwipeEl = null; } 
    itemSwipingEl = null; 
}

function openOrderQuantityModal() {
    document.getElementById('order-quantity-modal').classList.add('active');
}

function updateActiveOrdersTitle() {
    const titleEl = document.getElementById('active-orders-title');
    const hintEl = document.querySelector('#panel-drag-handle p');
    if (!titleEl) return;
    
    if (activeTimers.length === 0) {
        titleEl.innerText = '目前沒有訂單...';
        titleEl.style.color = 'inherit';
        if (hintEl) hintEl.innerText = '前往熱點地區將更有機會接到訂單';
    } else {
        titleEl.innerText = '進行中的訂單';
        titleEl.style.color = 'inherit';
        if (hintEl) hintEl.innerText = '提示：長按卡片拖曳排序，往左滑動刪除，點擊標題綁定店家';
    }
}

function renderActiveTimers() {
    forceCleanupDrag();
    const listEl = document.getElementById('active-timers-list'); 
    document.getElementById('active-count').innerText = `${activeTimers.length} 個進行中`;
    if (activeTimers.length === 0) {
        listEl.innerHTML = '<div class="empty-state">目前沒有進行中的訂單</div>';
        updateActiveOrdersTitle();
        return;
    }
    let html = '';
    const now = Date.now();
    activeTimers.forEach((timer, idx) => {
        const titleStr = timer.storeName ? `${escapeHtml(timer.storeName)} #${escapeHtml(timer.orderNumber)}` : `訂單計時 #${idx + 1}`;
        
        let estStr = '';
        if (timer.estimatedTime) {
            const isOverdue = (now - timer.startTime) > timer.estimatedTime * 60000;
            const badgeClass = isOverdue ? 'est-badge-overdue' : 'est-badge-ontime';
            estStr = `<span id="est_badge_${timer.id}" class="est-badge ${badgeClass}">預估 ${timer.estimatedTime}分鐘</span>`;
        }
        
        html += `<div class="swipe-container active-timer-container" data-id="${timer.id}"><div class="swipe-content active-timer-content" onmousedown="handleItemTouchStart(event)" ontouchstart="handleItemTouchStart(event)" onmousemove="handleItemTouchMove(event)" ontouchmove="handleItemTouchMove(event)" onmouseup="handleItemTouchEnd(event)" ontouchend="handleItemTouchEnd(event)" ontouchcancel="handleItemTouchEnd(event)" onmouseleave="handleItemTouchEnd(event)"><div class="swipe-edit" style="background:var(--success);" onclick="setEstimatedTime('${timer.id}')">預估</div><div class="timer-info"><h3 onclick="handleTimerTitleClick('${timer.id}')">${titleStr} ${estStr}</h3><p>開始時間：${formatTime(new Date(timer.startTime))}</p><div class="timer-duration" id="duration_${timer.id}">00:00:00</div></div><button class="btn-stop" onclick="stopTimer('${timer.id}')">配送</button><div class="swipe-delete" onclick="cancelTimer('${timer.id}')">刪除</div></div></div>`;
    });
    listEl.innerHTML = html; 
    updateTimersDisplay();
    updateActiveOrdersTitle();
}

function updateTimersDisplay() {
    const now = Date.now();
    activeTimers.forEach(timer => { 
        const el = document.getElementById(`duration_${timer.id}`); 
        if (el) el.innerText = formatDuration(now - timer.startTime); 
        
        if (timer.estimatedTime) {
            const estEl = document.getElementById(`est_badge_${timer.id}`);
            if (estEl) {
                const isOverdue = (now - timer.startTime) > timer.estimatedTime * 60000;
                estEl.className = `est-badge ${isOverdue ? 'est-badge-overdue' : 'est-badge-ontime'}`;
            }
        }
    });
    if (activeShift) { const shiftEls = document.querySelectorAll('.shift-current-duration-class'); shiftEls.forEach(el => el.innerText = formatDuration(now - activeShift.startTime)); } 
    checkWaitState();
}

/* ================== 修改訂單(收入)金額邏輯 ================== */
async function editIncomeAmount(id) {
    const record = historyRecords.find(r => r.id === id); if (!record) return;
    const newAmtStr = await appPrompt(`請輸入新的訂單金額\n(原金額: $${record.amount})：`, record.amount, '修改訂單金額', 'decimal');
    if (newAmtStr !== null && newAmtStr.trim() !== '') {
        const numAmt = Number(newAmtStr); if (isNaN(numAmt) || numAmt < 0) { return await appAlert('請輸入有效的數字', '輸入錯誤'); }
        record.amount = numAmt; localStorage.setItem(getStoreKey('order_history_records'), JSON.stringify(historyRecords)); renderWeeklyData(); 
        if(document.getElementById('view-daily-detail').classList.contains('active')) { renderDailyDetailList(); }
    }
}

/* ================== 小費與成本紀錄邏輯 ================== */
async function deleteTip(id) { closeAllSwipes(); if(await appConfirm('確定刪除這筆小費紀錄嗎？', '刪除確認', true)) { tipRecords = tipRecords.filter(t => t.id !== id); localStorage.setItem(getStoreKey('order_tips'), JSON.stringify(tipRecords)); renderWeeklyData(); if(document.getElementById('view-daily-detail').classList.contains('active')) renderDailyDetailList(); } } 
async function deleteCost(id) { closeAllSwipes(); if(await appConfirm('確定刪除這筆成本紀錄嗎？', '刪除確認', true)) { costRecords = costRecords.filter(t => t.id !== id); localStorage.setItem(getStoreKey('order_costs'), JSON.stringify(costRecords)); renderWeeklyData(); if(document.getElementById('view-daily-detail').classList.contains('active')) renderDailyDetailList(); } }

async function saveTip() { const amt = Number(document.getElementById('tip-amount').value); if(!amt || amt <= 0) return await appAlert('請輸入有效金額', '輸入錯誤'); const now = Date.now(), d = new Date(now); tipRecords.push({ id: 'tip_' + now, dateKey: getDateKey(now), year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(), dayOfWeek: DAYS_MAP[d.getDay()], amount: amt, method: document.getElementById('tip-method').value, timestamp: now, timeStr: formatTime(d) }); localStorage.setItem(getStoreKey('order_tips'), JSON.stringify(tipRecords)); document.getElementById('tip-amount').value = ''; renderWeeklyData(); await appAlert('小費紀錄成功！', '成功'); }
async function saveCost() { const amt = Number(document.getElementById('cost-amount').value); if(!amt || amt <= 0) return await appAlert('請輸入有效金額', '輸入錯誤'); const now = Date.now(), d = new Date(now); costRecords.push({ id: 'cost_' + now, dateKey: getDateKey(now), year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(), dayOfWeek: DAYS_MAP[d.getDay()], amount: amt, type: document.getElementById('cost-type').value, memo: document.getElementById('cost-memo').value, mileage: document.getElementById('cost-mileage').value, timestamp: now, timeStr: formatTime(d) }); localStorage.setItem(getStoreKey('order_costs'), JSON.stringify(costRecords)); document.getElementById('cost-amount').value = ''; document.getElementById('cost-memo').value = ''; document.getElementById('cost-mileage').value = ''; renderWeeklyData(); await appAlert('成本紀錄成功！', '成功'); }
function toggleMileageInput() { const type = document.getElementById('cost-type').value; document.getElementById('mileage-group').style.display = (type === '保養維修' || type === '加油') ? 'block' : 'none'; } function toggleEditMileage() { const type = document.getElementById('edit-cost-type').value; document.getElementById('edit-mileage-group').style.display = (type === '保養維修' || type === '加油') ? 'block' : 'none'; }

/* ================== 共用群組渲染函數 ================== */
function groupDataByDate(records) { const grouped = {}; records.forEach(rec => { if (!grouped[rec.dateKey]) grouped[rec.dateKey] = { dateKey: rec.dateKey, title: `${rec.year}年${rec.month}月${rec.day}日`, totalAmount: 0, records: [] }; grouped[rec.dateKey].records.push(rec); grouped[rec.dateKey].totalAmount += rec.amount; }); return grouped; }
function renderRecordGroup(data, containerId, emptyMsg, context, itemLabel, amountPrefix = '', amountColor = 'var(--success)') {
    const container = document.getElementById(containerId);
    if (data.length === 0) return container.innerHTML = `<div class="empty-state">${emptyMsg}</div>`;
    let html = '';
    Object.values(groupDataByDate(data)).sort((a,b)=>new Date(b.dateKey)-new Date(a.dateKey)).forEach(group => {
        html += `<div class="date-card" onclick="openDailyDetail('${context}', '${group.dateKey}')"><div class="date-header"><div><div class="date-title">${group.title}</div><div class="date-subtitle">${group.records.filter(r => !r.isBonus).length} ${itemLabel}</div></div><div class="date-total"><div class="date-amount" style="color:${amountColor};">${amountPrefix}${fmtMoney(group.totalAmount)}</div><div class="date-arrow">查看明細 〉</div></div></div></div>`;
    });
    container.innerHTML = html;
}
function renderTips(data = tipRecords, containerId = 'tips-list') { renderRecordGroup(data, containerId, '此區間尚無小費紀錄', 'tip', '筆小費'); }
function renderCosts(data = costRecords, containerId = 'costs-list') { renderRecordGroup(data, containerId, '此區間尚無成本紀錄', 'cost', '筆成本', '支出 ', 'var(--text-main)'); }
function renderStats(data = historyRecords, containerId = 'stats-list') { 
    // 已取餐取消單：單量與金額皆正常計算
    renderRecordGroup(data, containerId, '此區間尚無收入紀錄', 'income', '張訂單'); 
}

/* ================== 單日明細 Modal 邏輯 ================== */
let currentDailyTab = 'normal';

function openDailyDetail(context, dateKey) { 
    pushHistory();
    currentDailyContext = context; currentDailyDateObj = new Date(dateKey); 
    document.getElementById('view-daily-detail').classList.add('active'); 
    updateUIState(); renderDailyDetail(); 
}
function closeDailyDetail(fromPopState = false) { 
    document.getElementById('view-daily-detail').classList.remove('active'); 
    updateUIState(); 
    if (!fromPopState) history.back();
}
function prevDailyDetail() { currentDailyDateObj.setDate(currentDailyDateObj.getDate() - 1); renderDailyDetail(); }
function nextDailyDetail() { currentDailyDateObj.setDate(currentDailyDateObj.getDate() + 1); renderDailyDetail(); }

function switchDailyTab(tab) {
    currentDailyTab = tab;
    document.getElementById('tab-normal').classList.toggle('active', tab === 'normal');
    document.getElementById('tab-cancelled').classList.toggle('active', tab === 'cancelled');
    renderDailyDetailList();
}

function renderDailyDetail() {
    const dateKey = getDateKey(currentDailyDateObj.getTime());
    document.getElementById('daily-detail-date').innerText = `${currentDailyDateObj.getMonth() + 1}月${currentDailyDateObj.getDate()}日 ${DAYS_MAP[currentDailyDateObj.getDay()]}`;
    document.getElementById('daily-detail-week').innerText = `第${getWeekNumber(currentDailyDateObj)}週 ${currentDailyDateObj.getFullYear()}`;
    
    const statsGrid = document.getElementById('daily-detail-stats-grid');
    const tabsContainer = document.getElementById('daily-detail-tabs');
    
    currentDailyTab = 'normal';
    document.getElementById('tab-normal').classList.add('active');
    document.getElementById('tab-cancelled').classList.remove('active');
    
    if (currentDailyContext === 'income') {
        document.getElementById('daily-detail-type-label').innerText = '報酬 (當日總額)';
        const dailyRecords = historyRecords.filter(r => r.dateKey === dateKey).sort((a,b)=>b.timestamp - a.timestamp);
        const dailyBonusTotal = getCampaignBonusRecords().filter(b => b.dateKey === dateKey).reduce((s, b) => s + b.amount, 0);
        document.getElementById('daily-detail-amount').innerText = fmtMoney(dailyRecords.reduce((s,r)=>s+r.amount,0) + dailyBonusTotal);
        document.getElementById('daily-detail-amount').style.color = 'var(--success)';
        
        let totalShiftMins = shiftRecords.filter(r => r.dateKey === dateKey).reduce((s,r) => s + r.durationMins, 0) + (activeShift && getDateKey(activeShift.startTime) === dateKey ? Math.floor((Date.now() - activeShift.startTime) / 60000) : 0);
        const dailyWaits = waitRecords.filter(r => r.dateKey === dateKey);
        let totalWaitMins = dailyWaits.reduce((s,r) => s + r.durationMins, 0), maxWaitMins = dailyWaits.length > 0 ? Math.max(...dailyWaits.map(r=>r.durationMins)) : 0;
        if (activeWait && getDateKey(activeWait.startTime) === dateKey) { const currWait = Math.floor((Date.now() - activeWait.startTime) / 60000); totalWaitMins += currWait; maxWaitMins = Math.max(maxWaitMins, currWait); }

        statsGrid.style.display = 'grid';
        document.getElementById('daily-range-calc').style.display = 'block';
        resetRangeCalc();
        document.getElementById('daily-detail-online-hours').innerText = formatMins(totalShiftMins);
        document.getElementById('daily-detail-wait-total').innerText = formatMins(totalWaitMins);
        document.getElementById('daily-detail-wait-max').innerText = formatMins(maxWaitMins);
        
        tabsContainer.style.display = 'block';
    } else if (currentDailyContext === 'tip') {
        document.getElementById('daily-detail-type-label').innerText = '小費總額';
        const dailyRecords = tipRecords.filter(r => r.dateKey === dateKey).sort((a,b)=>b.timestamp - a.timestamp);
        document.getElementById('daily-detail-amount').innerText = fmtMoney(dailyRecords.reduce((s,r)=>s+r.amount,0));
        document.getElementById('daily-detail-amount').style.color = 'var(--success)';
        statsGrid.style.display = 'none';
        tabsContainer.style.display = 'none';
        document.getElementById('daily-range-calc').style.display = 'none';
    } else if (currentDailyContext === 'cost') {
        document.getElementById('daily-detail-type-label').innerText = '成本支出總額';
        const dailyRecords = costRecords.filter(r => r.dateKey === dateKey).sort((a,b)=>b.timestamp - a.timestamp);
        document.getElementById('daily-detail-amount').innerText = fmtMoney(dailyRecords.reduce((s,r)=>s+r.amount,0));
        document.getElementById('daily-detail-amount').style.color = 'var(--text-main)';
        statsGrid.style.display = 'none';
        tabsContainer.style.display = 'none';
        document.getElementById('daily-range-calc').style.display = 'none';
    }
    
    renderDailyDetailList();
}

/* ================== 單日明細：區間試算 ================== */
let rangeCalcIsCustom = false; // 使用者是否手動調整過區間 (切換日期時重置)
function timeStrToMins(str) { if (!str || !str.includes(':')) return null; const [h, m] = str.split(':').map(Number); return (isNaN(h) || isNaN(m)) ? null : h * 60 + m; }
function getRangeBasis() { const r = document.querySelector('input[name="range-calc-basis"]:checked'); return r ? r.value : 'end'; }
function getDailyValidOrders() { const dateKey = getDateKey(currentDailyDateObj.getTime()); return historyRecords.filter(r => r.dateKey === dateKey); }
function getRecordTimeStr(r, basis) { return basis === 'start' ? r.startTimeStr : r.endTimeStr; }

// 預設區間：當日第一單 ～ 最後一單的時間
function getDefaultRange(basis) {
    const mins = getDailyValidOrders().map(r => timeStrToMins(getRecordTimeStr(r, basis))).filter(v => v !== null);
    if (mins.length === 0) return null;
    const fmt = (v) => `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
    return { start: fmt(Math.min(...mins)), end: fmt(Math.max(...mins)) };
}

function resetRangeCalc() {
    rangeCalcIsCustom = false;
    document.querySelectorAll('input[name="range-calc-basis"]').forEach(r => r.checked = (r.value === (settings.rangeCalcBasis || 'end')));
    const def = getDefaultRange(getRangeBasis());
    document.getElementById('range-calc-start').value = def ? def.start : '';
    document.getElementById('range-calc-end').value = def ? def.end : '';
    calcDailyRange();
}
function onRangeCalcChange() { rangeCalcIsCustom = true; calcDailyRange(); }
function onRangeBasisChange() {
    settings.rangeCalcBasis = getRangeBasis(); saveSettings();
    if (!rangeCalcIsCustom) { resetRangeCalc(); } else { calcDailyRange(); }
}

function showRangeResult(count, total, errorMsg) {
    const errEl = document.getElementById('range-calc-error');
    const startEl = document.getElementById('range-calc-start'), endEl = document.getElementById('range-calc-end');
    startEl.classList.toggle('invalid', !!errorMsg); endEl.classList.toggle('invalid', !!errorMsg);
    if (errorMsg) {
        errEl.innerText = errorMsg; errEl.style.display = 'block';
        document.getElementById('range-calc-count').innerText = '--';
        document.getElementById('range-calc-amount').innerText = '--';
        document.getElementById('range-calc-avg').innerText = '--';
        return;
    }
    errEl.style.display = 'none';
    document.getElementById('range-calc-count').innerText = `${count}張`;
    document.getElementById('range-calc-amount').innerText = fmtMoney(total);
    document.getElementById('range-calc-avg').innerText = fmtMoney(count ? total / count : 0);
}

function calcDailyRange() {
    const orders = getDailyValidOrders();
    const sStr = document.getElementById('range-calc-start').value, eStr = document.getElementById('range-calc-end').value;
    if (orders.length === 0 && !sStr && !eStr) { showRangeResult(0, 0, null); return; }
    const s = timeStrToMins(sStr), e = timeStrToMins(eStr);
    if (s === null || e === null) { showRangeResult(0, 0, '請完整輸入開始與結束時間'); return; }
    if (s > e) { showRangeResult(0, 0, '區間錯誤：開始時間不可晚於結束時間'); return; }
    const basis = getRangeBasis();
    const list = orders.filter(r => { const t = timeStrToMins(getRecordTimeStr(r, basis)); return t !== null && t >= s && t <= e; });
    showRangeResult(list.length, list.reduce((sum, r) => sum + r.amount, 0), null);
}

function renderDailyDetailList() {
    const listContainer = document.getElementById('daily-detail-list');
    const dateKey = getDateKey(currentDailyDateObj.getTime());
    let html = '';
    
    if (currentDailyContext === 'income') {
        const allDaily = historyRecords.filter(r => r.dateKey === dateKey).sort((a,b)=>b.timestamp - a.timestamp);
        const normals = allDaily.filter(r => !r.isCancelled);
        const cancelleds = allDaily.filter(r => r.isCancelled);
        
        document.getElementById('tab-normal').innerText = `件數明細 (${normals.length})`;
        document.getElementById('tab-cancelled').innerText = `取消訂單 (${cancelleds.length})`;
        
        const targetList = currentDailyTab === 'normal' ? normals : cancelleds;
        
        // 達標獎金卡片：只在件數明細顯示，不計入件數
        if (currentDailyTab === 'normal') {
            getCampaignBonusRecords().filter(b => b.dateKey === dateKey).forEach(b => {
                html += `<div class="bonus-card"><div class="bonus-icon">${TROPHY_SVG}</div><div class="bonus-info"><div class="bonus-title">達標獎金・${escapeHtml(b.title)}</div><div class="bonus-desc">活動完成 ${b.orderCount} 單（達成 ${b.target} 單目標）</div></div><div class="bonus-amount">${fmtMoney(b.amount)}</div></div>`;
            });
        }
        if (targetList.length === 0 && html === '') {
            html = `<div class="empty-state">此分類目前無紀錄</div>`;
        } else {
            targetList.forEach(r => {
                const titleStr = r.storeName ? `<div style="font-weight:bold; color:var(--primary); margin-bottom:4px; font-size:1rem; word-break:break-word;">${escapeHtml(r.storeName)} #${escapeHtml(r.orderNumber)}</div>` : '';
                html += `<div class="swipe-container record-swipe-container" data-id="${r.id}"><div class="swipe-content record-swipe-content" ontouchstart="handleItemTouchStart(event)" ontouchmove="handleItemTouchMove(event)" ontouchend="handleItemTouchEnd(event)" ontouchcancel="handleItemTouchEnd(event)"><div class="swipe-edit" style="background:var(--success);" onclick="editHistoryEstimatedTime('${r.id}')">預估</div><div class="record-info" onclick="editIncomeAmount('${r.id}')" style="cursor:pointer;">${titleStr}<div class="record-time" style="color:var(--text-main);">${r.startTimeStr} - ${r.endTimeStr}</div><div class="record-desc" style="color:var(--text-muted);">實際 ${r.durationMins} 分鐘 ${r.estimatedTime ? ` / 預估 ${r.estimatedTime} 分鐘` : ''}</div></div><div class="record-amount-wrap" onclick="editIncomeAmount('${r.id}')"><div class="record-amount">${fmtMoney(r.amount)}</div>${(r.multiplier && r.multiplier > 1) ? FLAME_SVG : ''}</div><div class="swipe-delete" onclick="deleteHistoryRecord('${r.id}')">刪除</div></div></div>`;
            });
        }
    } else if (currentDailyContext === 'tip') {
        const dailyRecords = tipRecords.filter(r => r.dateKey === dateKey).sort((a,b)=>b.timestamp - a.timestamp);
        if (dailyRecords.length === 0) html = '<div class="empty-state">今日無小費紀錄</div>';
        else dailyRecords.forEach(r => html += `<div class="swipe-container record-swipe-container"><div class="swipe-content record-swipe-content" ontouchstart="handleItemTouchStart(event)" ontouchmove="handleItemTouchMove(event)" ontouchend="handleItemTouchEnd(event)" ontouchcancel="handleItemTouchEnd(event)"><div class="swipe-edit" onclick="openEdit('tip', '${r.id}')">編輯</div><div class="record-info"><div class="record-time">${r.timeStr}</div><div class="record-desc">支付方式: ${r.method}</div></div><div class="record-amount">${fmtMoney(r.amount)}</div><div class="swipe-delete" onclick="deleteTip('${r.id}')">刪除</div></div></div>`);
    } else if (currentDailyContext === 'cost') {
        const dailyRecords = costRecords.filter(r => r.dateKey === dateKey).sort((a,b)=>b.timestamp - a.timestamp);
        if (dailyRecords.length === 0) html = '<div class="empty-state">今日無成本紀錄</div>';
        else dailyRecords.forEach(r => { let tags = `<span class="tag">${r.type}</span>`; if((r.type === '保養維修' || r.type === '加油') && r.mileage) tags += `<span class="tag">里程:${fmtNum(r.mileage)}</span>`; html += `<div class="swipe-container record-swipe-container"><div class="swipe-content record-swipe-content" ontouchstart="handleItemTouchStart(event)" ontouchmove="handleItemTouchMove(event)" ontouchend="handleItemTouchEnd(event)" ontouchcancel="handleItemTouchEnd(event)"><div class="swipe-edit" onclick="openEdit('cost', '${r.id}')">編輯</div><div class="record-info"><div class="record-time">${r.timeStr} ${tags}</div><div class="record-desc">${r.memo || '無備註'}</div></div><div class="record-amount" style="color:var(--text-main);">- ${fmtMoney(r.amount)}</div><div class="swipe-delete" onclick="deleteCost('${r.id}')">刪除</div></div></div>`; });
    }
    listContainer.innerHTML = html;
    if (currentDailyContext === 'income') { if (rangeCalcIsCustom) calcDailyRange(); else resetRangeCalc(); }
}

/* ================== 編輯與查詢邏輯 ================== */
function openEdit(category, id) { closeAllSwipes(); document.getElementById('edit-modal').classList.add('active'); document.getElementById('edit-id').value = id; document.getElementById('edit-category').value = category; if (category === 'tip') { document.getElementById('edit-modal-title').innerText = '編輯小費'; document.getElementById('edit-tip-fields').style.display = 'block'; document.getElementById('edit-cost-fields').style.display = 'none'; const record = tipRecords.find(t => t.id === id); document.getElementById('edit-amount').value = record.amount; document.getElementById('edit-tip-method').value = record.method; } else { document.getElementById('edit-modal-title').innerText = '編輯成本'; document.getElementById('edit-tip-fields').style.display = 'none'; document.getElementById('edit-cost-fields').style.display = 'block'; const record = costRecords.find(t => t.id === id); document.getElementById('edit-amount').value = record.amount; document.getElementById('edit-cost-type').value = record.type; document.getElementById('edit-cost-memo').value = record.memo || ''; toggleEditMileage(); if(record.type === '保養維修' || record.type === '加油') document.getElementById('edit-cost-mileage').value = record.mileage || ''; } }
async function saveEdit() { const id = document.getElementById('edit-id').value, category = document.getElementById('edit-category').value, amount = Number(document.getElementById('edit-amount').value); if (!amount || amount <= 0) return await appAlert('請輸入有效金額', '輸入錯誤'); if (category === 'tip') { const idx = tipRecords.findIndex(t => t.id === id); if(idx > -1) { tipRecords[idx].amount = amount; tipRecords[idx].method = document.getElementById('edit-tip-method').value; localStorage.setItem(getStoreKey('order_tips'), JSON.stringify(tipRecords)); renderWeeklyData(); if(document.getElementById('view-daily-detail').classList.contains('active')) renderDailyDetailList(); } } else { const idx = costRecords.findIndex(t => t.id === id); if(idx > -1) { const type = document.getElementById('edit-cost-type').value; costRecords[idx].amount = amount; costRecords[idx].type = type; costRecords[idx].memo = document.getElementById('edit-cost-memo').value; costRecords[idx].mileage = (type === '保養維修' || type === '加油') ? document.getElementById('edit-cost-mileage').value : ''; localStorage.setItem(getStoreKey('order_costs'), JSON.stringify(costRecords)); renderWeeklyData(); if(document.getElementById('view-daily-detail').classList.contains('active')) renderDailyDetailList(); } } closeModal('edit-modal'); }

let currentCalDate = new Date(), calSelStart = null, calSelEnd = null;
function openFilterModal() { pushHistory(); calSelStart = null; calSelEnd = null; renderCalendar(); document.getElementById('filter-modal').classList.add('active'); } 
function closeModal(id) { document.getElementById(id).classList.remove('active'); } 
function calPrevMonth() { currentCalDate.setMonth(currentCalDate.getMonth() - 1); renderCalendar(); } 
function calNextMonth() { currentCalDate.setMonth(currentCalDate.getMonth() + 1); renderCalendar(); }

function renderCalendar() { 
    const y = currentCalDate.getFullYear(), m = currentCalDate.getMonth(); 
    document.getElementById('cal-month-year').innerText = `${y}年${m + 1}月`; 
    const firstDay = new Date(y, m, 1).getDay(); 
    let emptyDays = firstDay === 0 ? 6 : firstDay - 1; 

    const daysInMonth = new Date(y, m + 1, 0).getDate(); 
    const grid = document.getElementById('cal-days'); 
    grid.innerHTML = ''; 
    
    for (let i = 0; i < emptyDays; i++) grid.innerHTML += `<div class="cal-day empty"></div>`; 
    for (let i = 1; i <= daysInMonth; i++) { 
        const dayTime = new Date(y, m, i, 0, 0, 0).getTime(); 
        let classes = 'cal-day'; 
        if (calSelStart === dayTime || calSelEnd === dayTime) classes += ' selected'; 
        if (calSelStart && calSelEnd && dayTime > calSelStart && dayTime < calSelEnd) classes += ' in-range'; 
        grid.innerHTML += `<div class="${classes}" onclick="selectCalDate(${y}, ${m}, ${i})">${i}</div>`; 
    } 
    document.getElementById('cal-selection-text').innerText = !calSelStart ? '請點選開始日期' : (!calSelEnd ? '請點選結束日期 (單日請直接按確認)' : '已選擇範圍，請點擊確認查詢'); 
}

function selectCalDate(y, m, d) { const t = new Date(y, m, d, 0, 0, 0).getTime(); if (!calSelStart || (calSelStart && calSelEnd)) { calSelStart = t; calSelEnd = null; } else { if (t >= calSelStart) calSelEnd = t; else { calSelStart = t; calSelEnd = null; } } renderCalendar(); }

async function applyFilter() { 
    if (!calSelStart) return await appAlert('請先選擇日期', '操作錯誤'); 
    const sTime = calSelStart, eTime = (calSelEnd || calSelStart) + 86399999; 
    const fInc = historyRecords.filter(r => r.timestamp >= sTime && r.timestamp <= eTime), fTip = tipRecords.filter(r => r.timestamp >= sTime && r.timestamp <= eTime), fCost = costRecords.filter(r => r.timestamp >= sTime && r.timestamp <= eTime); 
    
    document.getElementById('search-total-orders').innerText = fInc.length + '張'; 
    const fBonus = getBonusesBetween(sTime, eTime);
    document.getElementById('search-total-income').innerText = fmtMoney(fInc.reduce((s, r)=>s+r.amount,0) + fBonus.reduce((s, b)=>s+b.amount,0)); 
    document.getElementById('search-total-tips').innerText = fmtMoney(fTip.reduce((s, r)=>s+r.amount,0)); 
    document.getElementById('search-total-costs').innerText = '-' + fmtMoney(fCost.reduce((s, r)=>s+r.amount,0)); 
    const sd = new Date(sTime), ed = new Date(eTime), sStr = `${sd.getFullYear()}/${sd.getMonth()+1}/${sd.getDate()}`, eStr = `${ed.getFullYear()}/${ed.getMonth()+1}/${ed.getDate()}`; 
    document.getElementById('search-date-range').innerText = sStr === eStr ? sStr : `${sStr} ~ ${eStr}`; 
    renderStats(fInc.concat(fBonus), 'search-income-list'); 
    renderTips(fTip, 'search-tips-list'); 
    renderCosts(fCost, 'search-costs-list'); 
    closeModal('filter-modal'); 
    isSearchResultOpen = true; 
    document.getElementById('view-search-result').classList.add('active'); 
    updateUIState(); 
}

/* ================== 準時率 / 兩週週期計算邏輯 ================== */
function getPunctualityStats(records, startMs, endMs, buffer) {
    const validRecords = records.filter(r => r.estimatedTime && r.estimatedTime > 0 && r.timestamp >= startMs && r.timestamp <= endMs);
    if (validRecords.length === 0) return null;

    let onTimeCount = 0, singleTimeoutRates = [], totalActual = 0, totalEstimatedWithBuffer = 0;
    let totalActualAmount = 0, totalEstimatedAmount = 0;

    validRecords.forEach(r => {
        let limit = r.estimatedTime + buffer;
        let actual = r.durationMins;
        if (actual <= limit) { onTimeCount++; singleTimeoutRates.push(0); } else { singleTimeoutRates.push((actual - limit) / limit); }
        totalActual += actual; totalEstimatedWithBuffer += limit;
        
        totalActualAmount += r.amount;
        totalEstimatedAmount += calcOrderAmount(r.estimatedTime, r.multiplier || 1);
    });

    const onTimeRate = (onTimeCount / validRecords.length) * 100;
    const avgTimeoutRate = (singleTimeoutRates.reduce((a, b) => a + b, 0) / validRecords.length) * 100;
    let totalTimeoutRate = 0;
    if (totalActual > totalEstimatedWithBuffer && totalEstimatedWithBuffer > 0) { totalTimeoutRate = ((totalActual - totalEstimatedWithBuffer) / totalEstimatedWithBuffer) * 100; }
    
    let diffAmount = totalActualAmount - totalEstimatedAmount;
    if (diffAmount < 0) diffAmount = 0;

    return { onTimeRate, avgTimeoutRate, totalTimeoutRate, diffAmount };
}

function calculatePunctuality() {
    const buffer = Number(document.getElementById('rate-buffer-time').value) || 0;
    const now = Date.now();
    
    const anchor = new Date(2026, 7, 17).setHours(0,0,0,0);
    const cycleMs = 14 * 24 * 60 * 60 * 1000;
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    
    let startMs = anchor;
    let diff = now - anchor;
    if (diff >= 0) { startMs = anchor + Math.floor(diff / cycleMs) * cycleMs; } else { startMs = anchor - Math.ceil(Math.abs(diff) / cycleMs) * cycleMs; }
    let endMs = startMs + cycleMs - 1;
    let isWeek2 = (now - startMs) >= weekMs;
    
    const d1 = new Date(startMs), d2 = new Date(endMs);
    const cycleStr = `${d1.getFullYear()}/${d1.getMonth()+1}/${d1.getDate()} - ${d2.getMonth()+1}/${d2.getDate()}`;
    const weekStr = isWeek2 ? '第二週' : '第一週';
    
    let cycleInfoEl = document.getElementById('punctuality-cycle-info');
    if (!cycleInfoEl) {
        cycleInfoEl = document.createElement('div');
        cycleInfoEl.id = 'punctuality-cycle-info';
        cycleInfoEl.style.fontSize = '0.85rem';
        cycleInfoEl.style.color = 'var(--text-muted)';
        cycleInfoEl.style.marginBottom = '10px';
        document.getElementById('card-punctuality').insertBefore(cycleInfoEl, document.getElementById('punctuality-ontime').parentNode.parentNode);
    }
    cycleInfoEl.innerHTML = `週期: <b style="color:var(--primary);">${cycleStr}</b> (目前為${weekStr})`;

    const currentStats = getPunctualityStats(historyRecords, startMs, endMs, buffer);
    if (!currentStats) {
        document.getElementById('punctuality-ontime').innerText = '--%';
        document.getElementById('punctuality-avg-timeout').innerText = '--%';
        document.getElementById('punctuality-total-timeout').innerText = '--%';
        document.getElementById('punctuality-diff-amount').innerText = '$0.00';
    } else {
        document.getElementById('punctuality-ontime').innerText = currentStats.onTimeRate.toFixed(1) + '%';
        document.getElementById('punctuality-avg-timeout').innerText = currentStats.avgTimeoutRate.toFixed(1) + '%';
        document.getElementById('punctuality-total-timeout').innerText = currentStats.totalTimeoutRate.toFixed(1) + '%';
        document.getElementById('punctuality-diff-amount').innerText = fmtMoney(currentStats.diffAmount);
    }

    // 計算前一期
    const prevStartMs = startMs - cycleMs;
    const prevEndMs = endMs - cycleMs;
    const p1 = new Date(prevStartMs), p2 = new Date(prevEndMs);
    document.getElementById('prev-punctuality-cycle-info').innerText = `${p1.getFullYear()}/${p1.getMonth()+1}/${p1.getDate()} - ${p2.getMonth()+1}/${p2.getDate()}`;
    
    const prevStats = getPunctualityStats(historyRecords, prevStartMs, prevEndMs, buffer);
    if (!prevStats) {
        document.getElementById('prev-punctuality-ontime').innerText = '--%';
        document.getElementById('prev-punctuality-avg-timeout').innerText = '--%';
        document.getElementById('prev-punctuality-total-timeout').innerText = '--%';
        document.getElementById('prev-punctuality-diff-amount').innerText = '$0.00';
    } else {
        document.getElementById('prev-punctuality-ontime').innerText = prevStats.onTimeRate.toFixed(1) + '%';
        document.getElementById('prev-punctuality-avg-timeout').innerText = prevStats.avgTimeoutRate.toFixed(1) + '%';
        document.getElementById('prev-punctuality-total-timeout').innerText = prevStats.totalTimeoutRate.toFixed(1) + '%';
        document.getElementById('prev-punctuality-diff-amount').innerText = fmtMoney(prevStats.diffAmount);
    }
}

async function clearAllData() {
    if (!(await appConfirm(`確定要清除使用者 [${currentUser}] 的所有紀錄嗎？\n包含：進行中訂單、收入、小費、成本、上線時段、等單紀錄。\n（外觀設定、倍率與達標活動會保留）\n\n此動作無法復原，建議先匯出備份！`, '清除紀錄', true))) return;
    if (!(await appConfirm('請再確認一次：真的要清除所有紀錄嗎？', '最後確認', true))) return;
    ['order_active_timers', 'order_history_records', 'order_tips', 'order_costs', 'order_active_shift', 'order_shifts', 'order_active_wait', 'order_waits'].forEach(k => localStorage.removeItem(getStoreKey(k)));
    loadData();
    if (currentViewIndex === 4) calculatePunctuality();
    await appAlert('已清除當前使用者的所有紀錄。', '完成');
}

function exportData() { const data = {}; for(let i=0; i<localStorage.length; i++){ const key = localStorage.key(i); if(key.includes('order_') || key.includes('app_')) data[key] = localStorage.getItem(key); } const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), url = URL.createObjectURL(blob), a = document.createElement('a'), d = new Date(); a.href = url; a.download = `訂單統計備份_${d.getFullYear()}${(d.getMonth()+1).toString().padStart(2,'0')}${d.getDate().toString().padStart(2,'0')}.json`; a.click(); URL.revokeObjectURL(url); }
function importData(event) { const file = event.target.files[0]; if(!file) return; const reader = new FileReader(); reader.onload = async function(e) { try { const data = JSON.parse(e.target.result); let valid = false; Object.keys(data).forEach(k => { if(k.includes('order_') || k.includes('app_')) { localStorage.setItem(k, data[k]); valid = true; } }); if(valid) { await appAlert('資料匯入成功！即將重新載入頁面。', '匯入成功'); location.reload(); } else await appAlert('無效的備份檔案格式。', '匯入失敗'); } catch(err) { await appAlert('匯入失敗：檔案損毀或格式錯誤。', '錯誤'); } }; reader.readAsText(file); }
