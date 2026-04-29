let is24Hour = true;
let allCountries = [];
let displayedCountries = [];
let modalCountry = null;

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
        const response = await fetch('https://restcountries.com/v3.1/all?fields=name,cca2,flags,capital,languages,currencies,translations,capitalInfo,latlng');
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        const data = await response.json();
        
        if (!Array.isArray(data)) throw new Error("API returned invalid data format.");
        
        allCountries = data.map(c => {
            const code = c.cca2 || 'Unknown';
            let tz = 'UTC';
            if (typeof moment !== 'undefined' && moment.tz && moment.tz.zonesForCountry) {
                try {
                    const zones = moment.tz.zonesForCountry(code);
                    if (zones && zones.length > 0) tz = zones[0];
                } catch(e) {}
            }
            
            let currencies = 'Unbekannt';
            if (c.currencies) {
                try {
                    const currNames = Object.values(c.currencies).map(curr => `${curr.name} (${curr.symbol})`);
                    currencies = currNames.join(', ');
                } catch(e) {}
            }
            
            const nameDe = (c.translations && c.translations.deu && c.translations.deu.common) ? c.translations.deu.common : (c.name && c.name.common) ? c.name.common : 'Unbekannt';
            const nameEn = (c.name && c.name.common) ? c.name.common : 'Unbekannt';
            
            let language = 'Unbekannt';
            if (c.languages) {
                try { language = Object.values(c.languages).join(', '); } catch(e){}
            }

            let lat = 0, lng = 0;
            if (c.capitalInfo && c.capitalInfo.latlng) {
                lat = c.capitalInfo.latlng[0];
                lng = c.capitalInfo.latlng[1];
            } else if (c.latlng) {
                lat = c.latlng[0];
                lng = c.latlng[1];
            }

            return {
                id: code,
                name: nameDe,
                englishName: nameEn,
                tz: tz,
                flag: c.flags?.svg || c.flags?.png || '',
                capital: (c.capital && c.capital.length > 0) ? c.capital[0] : 'Unbekannt',
                language: language,
                currency: currencies,
                lat: lat,
                lng: lng
            };
        }).sort((a, b) => a.id.localeCompare(b.id));

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
    // Weather
    try {
        const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${country.lat}&longitude=${country.lng}&current_weather=true`);
        const wData = await wRes.json();
        const temp = wData.current_weather.temperature;
        const code = wData.current_weather.weathercode;
        const elWeath = document.getElementById(`${prefix}weather-${country.id}`);
        const elIcon = document.getElementById(`${prefix}weather-icon-${country.id}`);
        if(elWeath) elWeath.textContent = `${temp}°C`;
        if(elIcon) elIcon.textContent = getWeatherIcon(code);
    } catch(e) {
        const elWeath = document.getElementById(`${prefix}weather-${country.id}`);
        if(elWeath) elWeath.textContent = 'Keine Daten';
    }

    // Holiday
    try {
        const hRes = await fetch(`https://date.nager.at/api/v3/NextPublicHolidays/${country.id}`);
        if (!hRes.ok) throw new Error();
        const hData = await hRes.json();
        const elHol = document.getElementById(`${prefix}holiday-${country.id}`);
        if (hData && hData.length > 0) {
            const next = hData[0];
            const parts = next.date.split('-');
            const formatted = `${parts[2]}.${parts[1]}.${parts[0]}`;
            if(elHol) elHol.textContent = `${next.localName} (${formatted})`;
        } else {
            if(elHol) elHol.textContent = 'Keine in Kürze';
        }
    } catch(e) {
        const elHol = document.getElementById(`${prefix}holiday-${country.id}`);
        if(elHol) elHol.textContent = 'Keine Daten';
    }
}

function createFullCardHTML(country, prefix) {
    return `
        <div class="card glass" style="position: relative; width: 100%;">
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
        </div>
    `;
}

// --- Modal Logic ---
window.openModal = function(countryId) {
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

window.closeModal = function() {
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

    allCountries.forEach(country => {
        const div = document.createElement('div');
        div.className = 'mini-card';
        div.onclick = () => openModal(country.id);
        div.innerHTML = `
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
    
    if (loading) loading.style.display = 'none';

    renderMiniGrid();

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase().trim();
            if (term.length === 0) {
                renderMiniGrid();
                return;
            }
            const matches = allCountries.filter(c => {
                const nameDe = c.name ? c.name.toLowerCase() : '';
                const nameEn = c.englishName ? c.englishName.toLowerCase() : '';
                return nameDe.includes(term) || nameEn.includes(term);
            });
            renderIndexGrid(matches.slice(0, 20));
        });
    }
}

// --- Details Page Logic ---
function initDetails() {
    const urlParams = new URLSearchParams(window.location.search);
    const countryParam = urlParams.get('country');
    const country = allCountries.find(c => c.id === countryParam);
    if(country) loadDynamicData(country, 'detail-');
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
        const elTime = document.getElementById(`${prefix}time-${country.id}`);
        const elDate = document.getElementById(`${prefix}date-${country.id}`);
        const elGreeting = document.getElementById(`${prefix}greeting-${country.id}`);
        const elTz = document.getElementById(`${prefix}tz-${country.id}`);
        
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
    } catch(e) {}
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
if(loading) loading.style.display = 'block';

fetchCountries();
setInterval(updateClocks, 1000);
