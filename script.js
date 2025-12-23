// ==========================================
// CONFIGURATION & DATA
// ==========================================
const GEO_API_URL = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_API_URL = "https://api.open-meteo.com/v1/forecast";

const COUNTRY_DATA = {
  MA: ["Casablanca", "Marrakech", "Rabat", "Tanger", "Agadir", "Fès"],
  FR: ["Paris", "Lyon", "Marseille", "Nice", "Bordeaux", "Lille"],
  DZ: ["Alger", "Oran", "Constantine", "Annaba", "Sétif"],
  TN: ["Tunis", "Sfax", "Sousse", "Bizerte", "Gabès"],
  EG: ["Le Caire", "Alexandrie", "Gizeh", "Louxor", "Assouan"],
  LY: ["Tripoli", "Benghazi", "Misrata", "Bayda"],
  IT: ["Rome", "Milan", "Naples", "Turin", "Venise"],
  ES: ["Madrid", "Barcelone", "Séville", "Valence", "Malaga"],
  US: ["New York", "Los Angeles", "Chicago", "Miami", "San Francisco"],
  EU: ["Londres", "Berlin", "Bruxelles", "Amsterdam", "Lisbonne", "Vienne"],
};

// ==========================================
// DOM ELEMENTS
// ==========================================
const cityInput = document.getElementById("cityInput");
const searchBtn = document.getElementById("searchBtn");
const loader = document.getElementById("loader");
const mainContent = document.getElementById("mainContent");
const errorMessage = document.getElementById("errorMessage");
const countryCards = document.querySelectorAll(".country-card");
const cityChipsContainer = document.getElementById("cityChipsContainer");

const cityNameEl = document.getElementById("cityName");
const currentTimeEl = document.getElementById("currentTime");
const tempMainEl = document.getElementById("tempMain");
const weatherIconEl = document.getElementById("weatherIcon");
const humidityEl = document.getElementById("humidity");
const windEl = document.getElementById("wind");
const rainEl = document.getElementById("rain");
const hourlyContainer = document.getElementById("hourlyContainer");
const googleMap = document.getElementById("googleMap");

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  // Animations de démarrage
  animateEntrance();

  // Theme Toggle
  const themeToggle = document.getElementById("themeToggle");
  const savedTheme = localStorage.getItem("theme") || "dark";
  document.documentElement.setAttribute("data-theme", savedTheme);
  updateThemeIcon(savedTheme);

  themeToggle.addEventListener("click", () => {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
    updateThemeIcon(newTheme);
  });

  // Par défaut : Maroc / Casablanca
  updateCityChips("MA");
  fetchCoordinates("Casablanca");

  // Live Clock
  updateLiveTime();
  setInterval(updateLiveTime, 1000);

  // Event Listeners
  searchBtn.addEventListener("click", () => {
    if (cityInput.value) fetchCoordinates(cityInput.value);
  });

  cityInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && cityInput.value) fetchCoordinates(cityInput.value);
  });

  // Country selection
  countryCards.forEach((card) => {
    card.addEventListener("click", () => {
      // UI Update
      countryCards.forEach((c) => c.classList.remove("active"));
      card.classList.add("active");

      const code = card.dataset.code;
      updateCityChips(code);

      // Chargement auto de la première ville du pays
      const firstCity = COUNTRY_DATA[code][0];
      fetchCoordinates(firstCity);
    });
  });
});

// ==========================================
// CORE FUNCTIONS
// ==========================================

function updateCityChips(countryCode) {
  cityChipsContainer.innerHTML = "";
  const cities = COUNTRY_DATA[countryCode] || [];

  cities.forEach((city) => {
    const chip = document.createElement("button");
    chip.className = "city-chip";
    chip.textContent = city;
    chip.addEventListener("click", () => fetchCoordinates(city));
    cityChipsContainer.appendChild(chip);
  });
}

async function fetchCoordinates(city) {
  try {
    hideAll();
    showLoader();

    const response = await axios.get(GEO_API_URL, {
      params: { name: city, count: 1, language: "fr", format: "json" },
    });

    if (!response.data.results) throw new Error("City not found");

    const data = response.data.results[0];
    fetchWeatherData(data.latitude, data.longitude, data.name, data.country);
    updateMap(data.name, data.country);
  } catch (error) {
    showError();
  }
}

async function fetchWeatherData(lat, lon, name, country) {
  try {
    const response = await axios.get(WEATHER_API_URL, {
      params: {
        latitude: lat,
        longitude: lon,
        current_weather: true,
        hourly:
          "temperature_2m,relative_humidity_2m,precipitation_probability,weathercode",
        timezone: "auto",
      },
    });
    displayWeather(response.data, name, country);
  } catch (error) {
    showError();
  }
}

function displayWeather(data, name, country) {
  hideLoader();
  mainContent.classList.remove("hidden");

  const current = data.current_weather;
  const hourly = data.hourly;

  cityNameEl.innerHTML = `${name} <span>${country}</span>`;
  const temperature = Math.round(current.temperature);
  tempMainEl.textContent = `${temperature}°`;

  // Dynamic Color base on temp
  if (temperature >= 25) {
    document.documentElement.setAttribute("data-weather", "warm");
  } else {
    document.documentElement.removeAttribute("data-weather");
  }

  const weatherInfo = getWeatherInfo(current.weathercode);
  weatherIconEl.className = `fas ${weatherInfo.icon}`;

  humidityEl.textContent = `${hourly.relative_humidity_2m[0]}%`;
  windEl.textContent = `${current.windspeed} km/h`;
  rainEl.textContent = `${hourly.precipitation_probability[0]}%`;

  // Hourly next 24h
  hourlyContainer.innerHTML = "";
  const currentHourIdx = new Date().getHours();

  for (let i = currentHourIdx; i < currentHourIdx + 24; i++) {
    const time = new Date(hourly.time[i]);
    const temp = hourly.temperature_2m[i];
    const code = hourly.weathercode[i];
    const info = getWeatherInfo(code);

    const item = document.createElement("div");
    item.className = "hour-item";
    item.style.opacity = 0; // Pour l'animation
    item.innerHTML = `
            <span class="time">${time.getHours()}:00</span>
            <i class="fas ${info.icon}"></i>
            <span class="temp">${Math.round(temp)}°</span>
        `;
    hourlyContainer.appendChild(item);
  }

  // Déclencher les animations de données
  animateDataUpdate();
}

function updateMap(city, country) {
  const query = encodeURIComponent(`${city}, ${country}`);
  googleMap.src = `https://maps.google.com/maps?q=${query}&t=&z=10&ie=UTF8&iwloc=&output=embed`;
}

// ==========================================
// HELPERS
// ==========================================

function getWeatherInfo(code) {
  const mapping = {
    0: { icon: "fa-sun" },
    1: { icon: "fa-cloud-sun" },
    2: { icon: "fa-cloud-sun" },
    3: { icon: "fa-cloud" },
    45: { icon: "fa-smog" },
    51: { icon: "fa-cloud-rain" },
    61: { icon: "fa-cloud-showers-heavy" },
    71: { icon: "fa-snowflake" },
    95: { icon: "fa-cloud-bolt" },
  };
  return mapping[code] || { icon: "fa-cloud" };
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function showLoader() {
  loader.classList.remove("hidden");
}
function hideLoader() {
  loader.classList.add("hidden");
}
function showError() {
  hideLoader();
  errorMessage.classList.remove("hidden");
  setTimeout(() => errorMessage.classList.add("hidden"), 5000);
}
function hideAll() {
  mainContent.classList.add("hidden");
  errorMessage.classList.add("hidden");
}

function updateLiveTime() {
  const now = new Date();
  currentTimeEl.textContent = now.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function updateThemeIcon(theme) {
  const icon = document.querySelector("#themeToggle i");
  if (!icon) return;
  if (theme === "dark") {
    icon.className = "fas fa-sun";
  } else {
    icon.className = "fas fa-moon";
  }
}

// ==========================================
// ANIMATIONS (ANIME.JS)
// ==========================================

function animateEntrance() {
  // Animation du logo et recherche
  anime
    .timeline({
      easing: "easeOutExpo",
    })
    .add({
      targets: ".brand",
      translateX: [-50, 0],
      opacity: [0, 1],
      duration: 1200,
    })
    .add(
      {
        targets: ".search-box",
        translateX: [50, 0],
        opacity: [0, 1],
        duration: 1200,
      },
      "-=1000"
    )
    .add(
      {
        targets: ".country-card",
        scale: [0.5, 1],
        opacity: [0, 1],
        delay: anime.stagger(100),
        duration: 800,
      },
      "-=800"
    );
}

function animateDataUpdate() {
  // Animation de la carte météo principale
  anime({
    targets: ".card-glass",
    translateY: [20, 0],
    opacity: [0, 1],
    duration: 1000,
    easing: "easeOutElastic(1, .8)",
  });

  // Animation au compteur pour la température
  const tempVal = parseInt(tempMainEl.textContent);
  anime({
    targets: tempMainEl,
    innerHTML: [0, tempVal],
    round: 1,
    duration: 1500,
    easing: "easeOutExpo",
    update: function (a) {
      tempMainEl.innerHTML = Math.round(a.animations[0].currentValue) + "°";
    },
  });

  // Animation staggérée des heures
  anime({
    targets: ".hour-item",
    translateY: [30, 0],
    opacity: [0, 1],
    delay: anime.stagger(50),
    duration: 800,
    easing: "easeOutQuart",
  });

  // Animation de la map
  anime({
    targets: ".map-wrapper",
    scale: [0.95, 1],
    opacity: [0, 1],
    duration: 1200,
    delay: 400,
  });
}
