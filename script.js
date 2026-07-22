let is24Hour = true;
let allCountries = [];
let displayedCountries = [];
let modalCountry = null;
let favorites = [];
try { favorites = JSON.parse(localStorage.getItem('clockFavorites')) || []; } catch (e) { }
let showFavoritesOnly = false;

// Helper Functions
function getGreeting(hours) {
    if (hours >= 5 && hours < 12) return 'Guten Morgen';
    if (hours >= 12 && hours < 18) return 'Guten Tag';
    if (hours >= 18 && hours < 22) return 'Guten Abend';
    return 'Gute Nacht';
}

function getWeatherIcon(code) {
    if (code === 0) return '☀️';
    if (code >= 1 && code <= 3) return '⛅';
    if (code >= 45 && code <= 48) return '🌫️';
    if (code >= 51 && code <= 67) return '🌧️';
    if (code >= 71 && code <= 77) return '❄️';
    if (code >= 80 && code <= 82) return '🌦️';
    if (code >= 85 && code <= 86) return '🌨️';
    if (code >= 95) return '⛈️';
    return '🌡️';
}

// Fetch and Process Data
async function fetchCountries() {
    try {
        const response = await fetch('./countries.json');
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        const data = await response.json();

        if (!Array.isArray(data)) throw new Error("API returned invalid data format.");

        allCountries = data.map(c => {
            let tz = c.tz || 'UTC';
            if (typeof moment !== 'undefined' && moment.tz && moment.tz.zonesForCountry) {
                try {
                    const zones = moment.tz.zonesForCountry(c.id);
                    if (zones && zones.length > 0 && (!c.tz || c.tz === 'UTC')) tz = zones[0];
                } catch (e) { }
            }

            return {
                id: c.id,
                name: c.name,
                englishName: c.englishName || c.name,
                tz: tz,
                flag: c.flag || `https://flagcdn.com/w40/${c.id.toLowerCase()}.png`,
                capital: c.capital || 'Unbekannt',
                language: c.language || 'Unbekannt',
                currency: c.currency || 'Unbekannt',
                lat: c.lat || 0,
                lng: c.lng || 0,
                population: c.population || 0,
                region: c.region || 'Unbekannt',
                subregion: c.subregion || '',
                area: c.area || 0,
                tld: c.tld || 'Unbekannt',
                idd: c.idd || 'Unbekannt',
                car: c.car || 'Rechtsverkehr'
            };
        }).sort((a, b) => a.name.localeCompare(b.name, 'de'));

        initPage();
    } catch (e) {
        console.error("Fehler beim Laden der Länder:", e);
        const loading = document.getElementById('loading');
        if (loading) {
            loading.textContent = "Fehler beim Laden: " + e.message;
            loading.style.display = 'block';
            loading.style.color = "#ef4444";
        }
    }
}

async function loadDynamicData(country, prefix) {
    const suffix = prefix === 'detail-' ? '' : `-${country.id}`;
    // Weather
    try {
        const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${country.lat}&longitude=${country.lng}&current_weather=true`);
        const wData = await wRes.json();
        const temp = wData.current_weather.temperature;
        const code = wData.current_weather.weathercode;
        const elWeath = document.getElementById(`${prefix}weather${suffix}`);
        const elIcon = document.getElementById(`${prefix}weather-icon${suffix}`);
        if (elWeath) elWeath.textContent = `${temp}°C`;
        if (elIcon) elIcon.textContent = getWeatherIcon(code);
    } catch (e) {
        const elWeath = document.getElementById(`${prefix}weather${suffix}`);
        if (elWeath) elWeath.textContent = 'Keine Daten';
    }

    // Holiday
    try {
        const hRes = await fetch(`https://date.nager.at/api/v3/NextPublicHolidays/${country.id}`);
        if (!hRes.ok) throw new Error();
        const hData = await hRes.json();
        const elHol = document.getElementById(`${prefix}holiday${suffix}`);
        if (hData && hData.length > 0) {
            const next = hData[0];
            const parts = next.date.split('-');
            const formatted = `${parts[2]}.${parts[1]}.${parts[0]}`;
            if (elHol) elHol.textContent = `${next.localName} (${formatted})`;
        } else {
            if (elHol) elHol.textContent = 'Keine in Kürze';
        }
    } catch (e) {
        const elHol = document.getElementById(`${prefix}holiday${suffix}`);
        if (elHol) elHol.textContent = 'Keine Daten';
    }
}

function createFullCardHTML(country, prefix) {
    const isFav = favorites.includes(country.id);
    return `
        <div class="card glass" style="position: relative; width: 100%;">
            <button id="${prefix}fav-${country.id}" class="fav-btn ${isFav ? 'active' : ''}" style="${prefix === 'modal-' ? 'left: 10px; right: auto;' : ''}" onclick="toggleFavorite('${country.id}', event)">${isFav ? '⭐' : '☆'}</button>
            ${prefix === 'modal-' ? '<button class="close-btn" onclick="closeModal()">×</button>' : ''}
            <div class="country-info">
                <img src="${country.flag}" width="40" alt="${country.name} Flagge" class="flag-img">
                <div class="name-box">
                    <h2 class="country-name">${country.name}</h2>
                    <span class="greeting" id="${prefix}greeting-${country.id}">Lade...</span>
                </div>
            </div>
            <div class="time-display">
                <span class="time" id="${prefix}time-${country.id}">--:--:--</span>
                <span class="date" id="${prefix}date-${country.id}">--</span>
            </div>
            
            <div class="card-divider"></div>
                
            <div class="meta-grid">
                <div class="meta-item">
                    <span class="meta-icon">🏛️</span>
                    <div class="meta-text">
                        <span class="meta-label">Hauptstadt</span>
                        <span class="meta-value" id="${prefix}capital-${country.id}">${country.capital}</span>
                    </div>
                </div>
                <div class="meta-item">
                    <span class="meta-icon" id="${prefix}weather-icon-${country.id}">🌡️</span>
                    <div class="meta-text">
                        <span class="meta-label">Wetter</span>
                        <span class="meta-value" id="${prefix}weather-${country.id}">Lade...</span>
                    </div>
                </div>
                <div class="meta-item">
                    <span class="meta-icon">🌍</span>
                    <div class="meta-text">
                        <span class="meta-label">Zeitzone</span>
                        <span class="meta-value" id="${prefix}tz-${country.id}">Lade...</span>
                    </div>
                </div>
                <div class="meta-item">
                    <span class="meta-icon">💶</span>
                    <div class="meta-text">
                        <span class="meta-label">Währung</span>
                        <span class="meta-value" id="${prefix}currency-${country.id}">${country.currency}</span>
                    </div>
                </div>
                <div class="meta-item">
                    <span class="meta-icon">🗣️</span>
                    <div class="meta-text">
                        <span class="meta-label">Sprache</span>
                        <span class="meta-value" id="${prefix}language-${country.id}">${country.language}</span>
                    </div>
                </div>
                <div class="meta-item">
                    <span class="meta-icon">🎉</span>
                    <div class="meta-text">
                        <span class="meta-label">Nächster Feiertag</span>
                        <span class="meta-value" id="${prefix}holiday-${country.id}">Lade...</span>
                    </div>
                </div>
            </div>
            
            <div style="margin-top: 1.5rem; text-align: center;">
                <a href="details.html?country=${country.id}" class="glass-btn details-btn" style="width: 100%; box-sizing: border-box;">Mehr Infos (Basisdaten)</a>
            </div>
        </div>
    `;
}

// --- Favorites Logic ---
window.toggleFavorite = function (countryId, event) {
    if (event) event.stopPropagation();
    if (favorites.includes(countryId)) {
        favorites = favorites.filter(id => id !== countryId);
    } else {
        favorites.push(countryId);
    }
    try { localStorage.setItem('clockFavorites', JSON.stringify(favorites)); } catch (e) { }

    const searchInput = document.getElementById('search-input');
    if (searchInput && searchInput.value.trim().length > 0) {
        searchInput.dispatchEvent(new Event('input'));
    } else if (document.getElementById('mini-container')?.style.display !== 'none') {
        renderMiniGrid();
    }

    if (modalCountry && modalCountry.id === countryId) {
        const btn = document.getElementById(`modal-fav-${countryId}`);
        if (btn) {
            const isFav = favorites.includes(countryId);
            btn.classList.toggle('active', isFav);
            btn.textContent = isFav ? '⭐' : '☆';
        }
    }

    const detailBtn = document.getElementById('detail-fav');
    if (detailBtn) {
        const isFav = favorites.includes(countryId);
        detailBtn.classList.toggle('active', isFav);
        detailBtn.textContent = isFav ? '⭐' : '☆';
    }
};

// --- Modal Logic ---
window.openModal = function (countryId) {
    const country = allCountries.find(c => c.id === countryId);
    if (!country) return;

    modalCountry = country;
    const overlay = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');

    content.innerHTML = createFullCardHTML(country, 'modal-');

    updateClocks();
    loadDynamicData(country, 'modal-');
    overlay.classList.add('active');
}

window.closeModal = function () {
    document.getElementById('modal-overlay').classList.remove('active');
    modalCountry = null;
}

document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') closeModal();
});

// --- Index Page Logic ---
function renderMiniGrid() {
    const miniContainer = document.getElementById('mini-container');
    const container = document.getElementById('countries-container');
    if (!miniContainer) return;

    if (container) container.style.display = 'none';
    miniContainer.style.display = 'grid';
    miniContainer.innerHTML = '';

    const countriesToRender = showFavoritesOnly ? allCountries.filter(c => favorites.includes(c.id)) : allCountries;

    if (countriesToRender.length === 0 && showFavoritesOnly) {
        miniContainer.innerHTML = '<div style="text-align:center; padding: 2rem; color: var(--text-muted); width: 100%; grid-column: 1 / -1;">Noch keine Favoriten gespeichert.</div>';
        return;
    }

    countriesToRender.forEach(country => {
        const isFav = favorites.includes(country.id);
        const div = document.createElement('div');
        div.className = 'mini-card';
        div.onclick = () => openModal(country.id);
        div.innerHTML = `
            <button class="fav-btn ${isFav ? 'active' : ''}" onclick="toggleFavorite('${country.id}', event)">${isFav ? '⭐' : '☆'}</button>
            <img src="${country.flag}" alt="${country.name}" class="mini-flag">
            <span class="mini-code">${country.id}</span>
        `;
        miniContainer.appendChild(div);
    });

    displayedCountries = [];
}

function renderIndexGrid(countriesToRender) {
    const miniContainer = document.getElementById('mini-container');
    const container = document.getElementById('countries-container');
    if (!container) return;

    if (miniContainer) miniContainer.style.display = 'none';
    container.style.display = 'grid';

    if (countriesToRender.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding: 2rem; color: var(--text-muted);">Keine Länder gefunden.</div>';
        return;
    }

    container.innerHTML = '';

    countriesToRender.forEach(country => {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = createFullCardHTML(country, 'grid-');
        container.appendChild(wrapper.firstElementChild);
        loadDynamicData(country, 'grid-');
    });
    displayedCountries = countriesToRender;
    updateClocks();
}

function initIndex() {
    const searchInput = document.getElementById('search-input');
    const loading = document.getElementById('loading');
    const toggleFavBtn = document.getElementById('toggle-fav-filter');

    if (loading) loading.style.display = 'none';

    renderMiniGrid();

    if (toggleFavBtn) {
        toggleFavBtn.addEventListener('click', () => {
            showFavoritesOnly = !showFavoritesOnly;
            toggleFavBtn.style.background = showFavoritesOnly ? 'rgba(255, 215, 0, 0.2)' : '';
            toggleFavBtn.style.color = showFavoritesOnly ? '#ffd700' : '';

            if (searchInput && searchInput.value.trim().length > 0) {
                searchInput.dispatchEvent(new Event('input'));
            } else {
                renderMiniGrid();
            }
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase().trim();
            if (term.length === 0) {
                renderMiniGrid();
                return;
            }
            const matches = allCountries.filter(c => {
                if (showFavoritesOnly && !favorites.includes(c.id)) return false;
                const nameDe = c.name ? c.name.toLowerCase() : '';
                const nameEn = c.englishName ? c.englishName.toLowerCase() : '';
                return nameDe.includes(term) || nameEn.includes(term);
            });
            renderIndexGrid(matches.slice(0, 20));
        });
    }
}

// --- Details Page Logic ---
async function initDetails() {
    const urlParams = new URLSearchParams(window.location.search);
    const countryParam = urlParams.get('country');
    const country = allCountries.find(c => c.id === countryParam);
    if (country) {
        syncMinecraftVideo(country.tz, true);
        const detailFav = document.getElementById('detail-fav');
        if (detailFav) {
            const isFav = favorites.includes(country.id);
            detailFav.classList.toggle('active', isFav);
            detailFav.textContent = isFav ? '⭐' : '☆';
        }

        const elFlag = document.getElementById('detail-flag');
        if (elFlag) elFlag.src = country.flag;

        const elName = document.getElementById('detail-name');
        if (elName) elName.textContent = country.name;

        const elCap = document.getElementById('detail-capital');
        if (elCap) elCap.textContent = country.capital;

        const elLang = document.getElementById('detail-language');
        if (elLang) elLang.textContent = country.language;

        const elCurr = document.getElementById('detail-currency');
        if (elCurr) elCurr.textContent = country.currency;

        loadDynamicData(country, 'detail-');

        const popEl = document.getElementById('detail-population');
        if (popEl) popEl.textContent = new Intl.NumberFormat('de-DE').format(country.population || 0);

        const regEl = document.getElementById('detail-region');
        if (regEl) regEl.textContent = country.subregion ? `${country.region} (${country.subregion})` : country.region;

        const areaEl = document.getElementById('detail-area');
        if (areaEl) areaEl.textContent = new Intl.NumberFormat('de-DE').format(country.area || 0) + ' km²';

        const tldEl = document.getElementById('detail-tld');
        if (tldEl) tldEl.textContent = country.tld || 'Unbekannt';

        const iddEl = document.getElementById('detail-idd');
        if (iddEl) iddEl.textContent = country.idd || 'Unbekannt';

        const drivingEl = document.getElementById('detail-driving');
        if (drivingEl) drivingEl.textContent = country.car || 'Rechtsverkehr';
    }
    updateClocks();
}

function initPage() {
    const isDetailsPage = window.location.pathname.includes('details.html');
    if (isDetailsPage) {
        initDetails();
    } else {
        initIndex();
    }
}

// Clock Updates
function updateClockDOM(country, prefix, now, options, dateOptions) {
    try {
        const suffix = prefix === 'detail-' ? '' : `-${country.id}`;
        const elTime = document.getElementById(`${prefix}time${suffix}`);
        const elDate = document.getElementById(`${prefix}date${suffix}`);
        const elGreeting = document.getElementById(`${prefix}greeting${suffix}`);
        const elTz = document.getElementById(`${prefix}tz${suffix}`);

        if (elTime && elDate && elGreeting) {
            const localTime = new Date(now.toLocaleString('en-US', { timeZone: country.tz }));
            elTime.textContent = new Intl.DateTimeFormat('de-DE', { ...options, timeZone: country.tz }).format(now);
            elDate.textContent = new Intl.DateTimeFormat('de-DE', { ...dateOptions, timeZone: country.tz }).format(now);
            elGreeting.textContent = getGreeting(localTime.getHours());

            if (elTz) {
                const tzName = new Intl.DateTimeFormat('de-DE', { timeZoneName: 'long', timeZone: country.tz }).formatToParts(now).find(p => p.type === 'timeZoneName')?.value || '';
                elTz.textContent = tzName;
            }
        }
    } catch (e) { }
}

function updateClocks() {
    const now = new Date();
    const options = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: !is24Hour };
    const dateOptions = { weekday: 'long', day: 'numeric', month: 'long' };

    const isDetailsPage = window.location.pathname.includes('details.html');

    if (isDetailsPage) {
        const urlParams = new URLSearchParams(window.location.search);
        const countryParam = urlParams.get('country');
        const country = allCountries.find(c => c.id === countryParam);
        if (country) updateClockDOM(country, 'detail-', now, options, dateOptions);
    } else {
        displayedCountries.forEach(country => {
            updateClockDOM(country, 'grid-', now, options, dateOptions);
        });

        if (modalCountry) {
            updateClockDOM(modalCountry, 'modal-', now, options, dateOptions);
        }
    }
}

// Boot
const toggleBtn = document.getElementById('toggle-format');
if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
        is24Hour = !is24Hour;
        updateClocks();
    });
}

const loading = document.getElementById('loading');
if (loading) loading.style.display = 'block';

fetchCountries();
setInterval(updateClocks, 1000);

// --- Analytics & Cookie Consent ---
const GA_MEASUREMENT_ID = 'G-F7HTCX5654';

function loadGoogleAnalytics() {
    if (document.getElementById('ga-script')) return;

    const script = document.createElement('script');
    script.id = 'ga-script';
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_MEASUREMENT_ID;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    function gtag() { dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', GA_MEASUREMENT_ID, { 'anonymize_ip': true });
}

function initCookieConsent() {
    let consent = null;
    try { consent = localStorage.getItem('cookieConsent'); } catch (e) { }

    if (consent === 'granted') {
        loadGoogleAnalytics();
    } else if (!consent) {
        document.body.style.overflow = 'hidden';

        const overlay = document.createElement('div');
        overlay.className = 'cookie-overlay';
        overlay.innerHTML = `
            <div class="cookie-banner glass">
                <div class="cookie-content">
                    <h3>Privatsphäre & Tracking</h3>
                    <p>Diese Website verwendet Google Analytics, um zu verstehen, welche Länder am häufigsten aufgerufen werden und wie viele Besucher wir haben. Die Daten werden anonymisiert erfasst.</p>
                    <div class="cookie-buttons">
                        <button id="cookie-accept" class="glass-btn">Erlauben & Unterstützen</button>
                        <button id="cookie-decline" class="glass-btn">Nur essenzielle</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const handleChoice = (choice) => {
            try { localStorage.setItem('cookieConsent', choice); } catch (e) { }
            document.body.style.overflow = '';
            overlay.remove();
            if (choice === 'granted') {
                loadGoogleAnalytics();
            }
        };

        document.getElementById('cookie-accept').addEventListener('click', () => handleChoice('granted'));
        document.getElementById('cookie-decline').addEventListener('click', () => handleChoice('denied'));
    }
}

let currentSyncTz = null;
let lastTargetTime = -1;

function syncMinecraftVideo(targetTz, forceSync = false) {
    if (targetTz !== undefined) {
        currentSyncTz = targetTz;
    }
    const video = document.getElementById('mc-video-bg');
    if (!video || !video.duration) return;

    // Ensure video is paused so it doesn't drift at 1x speed and force constant seek loops
    if (!video.paused) {
        video.pause();
    }

    const nowDate = new Date();
    let hours;
    
    if (currentSyncTz) {
        try {
            const countryTimeStr = nowDate.toLocaleString('en-US', { timeZone: currentSyncTz });
            const countryDate = new Date(countryTimeStr);
            hours = countryDate.getHours() + countryDate.getMinutes() / 60 + countryDate.getSeconds() / 3600;
        } catch(e) {
            hours = nowDate.getHours() + nowDate.getMinutes() / 60 + nowDate.getSeconds() / 3600;
        }
    } else {
        hours = nowDate.getHours() + nowDate.getMinutes() / 60 + nowDate.getSeconds() / 3600;
    }

    // Video 0 to 24000 ticks: 06:00 AM to 06:00 AM
    let progress;
    if (hours >= 6) {
        progress = (hours - 6) / 24;
    } else {
        progress = (hours + 18) / 24;
    }

    const targetTime = progress * video.duration;

    // Only update frame if time moved noticeably (> 0.2s) or forced, preventing decoder lag
    if (forceSync || lastTargetTime < 0 || Math.abs(targetTime - lastTargetTime) >= 0.2) {
        lastTargetTime = targetTime;
        video.currentTime = targetTime;
    }
}

function updateMinecraftSky() {
    syncMinecraftVideo();
}

document.addEventListener('DOMContentLoaded', () => {
    initCookieConsent();
    syncMinecraftVideo(undefined, true);

    // Update time-synced frame every 5 seconds (ultra lightweight, 0% CPU, 0 lag)
    setInterval(() => syncMinecraftVideo(), 5000);

    const video = document.getElementById('mc-video-bg');
    if (video) {
        video.addEventListener('loadedmetadata', () => syncMinecraftVideo(undefined, true), { once: true });
    }
});
