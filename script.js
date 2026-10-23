/* =====================================================
   Weather Forecast App - script.js
   Uses the OpenWeather Current Weather and 5-day / 3-hour
   Forecast endpoints.
   NOTE: A key placed in frontend code is visible to anyone
   who opens DevTools. Use it only for demonstration and do
   not publish it in a public repository.
   ===================================================== */

const API_KEY = "e738fcb17f9bf64e9da2384538822730";
const BASE_URL = "https://api.openweathermap.org/data/2.5";
const ICON_URL = "https://openweathermap.org/img/wn/";

/* ---------- DOM references ---------- */
const form = document.getElementById("search-form");
const cityInput = document.getElementById("city-input");
const searchBtn = document.getElementById("search-btn");
const statusEl = document.getElementById("status");

const currentSection = document.getElementById("current-weather");
const locationEl = document.getElementById("location");
const dateTimeEl = document.getElementById("date-time");
const temperatureEl = document.getElementById("temperature");
const descriptionEl = document.getElementById("description");
const iconEl = document.getElementById("weather-icon");
const feelsLikeEl = document.getElementById("feels-like");
const humidityEl = document.getElementById("humidity");
const windEl = document.getElementById("wind");

const forecastSection = document.getElementById("forecast-section");
const forecastContainer = document.getElementById("forecast-container");

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* ---------- Status helpers ---------- */
function showStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function setLoading(isLoading) {
  searchBtn.disabled = isLoading;
  searchBtn.textContent = isLoading ? "Searching..." : "Search";
}

function hideResults() {
  currentSection.classList.add("hidden");
  forecastSection.classList.add("hidden");
}

/* ---------- API communication ---------- */
async function fetchJSON(endpoint, city) {
  const url =
    `${BASE_URL}/${endpoint}?q=${encodeURIComponent(city)}` +
    `&units=metric&appid=${API_KEY}`;

  const response = await fetch(url);

  if (!response.ok) {
    const error = new Error("Request failed");
    error.status = response.status;
    throw error;
  }
  return response.json();
}

function getErrorMessage(error) {
  switch (error.status) {
    case 404:
      return "City not found. Please check the spelling and try again.";
    case 401:
      return "Invalid or inactive API key. A new key can take a while to activate.";
    case 429:
      return "Too many requests. Please wait a moment and try again.";
    default:
      return error.status
        ? "The weather service returned an error. Please try again later."
        : "Network problem. Check your internet connection and try again.";
  }
}

/* ---------- Date helpers (uses the searched city's timezone) ---------- */
// OpenWeather gives UTC timestamps (seconds) and a timezone offset (seconds).
function toCityDate(unixSeconds, offsetSeconds) {
  return new Date((unixSeconds + offsetSeconds) * 1000);
}

function dateKey(d) {
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

/* ---------- Display: current weather ---------- */
function displayCurrent(data) {
  const weather = data.weather[0];
  const local = toCityDate(data.dt, data.timezone);

  locationEl.textContent = `${data.name}, ${data.sys.country}`;
  dateTimeEl.textContent =
    `${DAYS[local.getUTCDay()]}, ${local.getUTCDate()} ${MONTHS[local.getUTCMonth()]} ` +
    `${String(local.getUTCHours()).padStart(2, "0")}:${String(local.getUTCMinutes()).padStart(2, "0")} (local time)`;
  temperatureEl.textContent = `${Math.round(data.main.temp)}°C`;
  descriptionEl.textContent = weather.description;
  iconEl.src = `${ICON_URL}${weather.icon}@2x.png`;
  iconEl.alt = weather.description;
  feelsLikeEl.textContent = `${Math.round(data.main.feels_like)}°C`;
  humidityEl.textContent = `${data.main.humidity}%`;
  windEl.textContent = `${data.wind.speed} m/s`;

  currentSection.classList.remove("hidden");
}

/* ---------- Display: forecast ---------- */
// Group 3-hourly entries by date and pick the entry closest to 12:00.
function pickDailyEntries(forecastData) {
  const offset = forecastData.city.timezone;
  const byDate = new Map();

  forecastData.list.forEach((entry) => {
    const local = toCityDate(entry.dt, offset);
    const key = dateKey(local);
    const distanceFromNoon = Math.abs(local.getUTCHours() - 12);

    const existing = byDate.get(key);
    if (!existing || distanceFromNoon < existing.distance) {
      byDate.set(key, { entry, local, distance: distanceFromNoon });
    }
  });

  let days = Array.from(byDate.values());

  // Skip today (already shown in the current-weather card) if enough days remain
  if (days.length > 5) {
    days = days.slice(1);
  }
  return days.slice(0, 5);
}

function createForecastCard({ entry, local }) {
  const weather = entry.weather[0];

  const card = document.createElement("div");
  card.className = "forecast-card";

  const day = document.createElement("p");
  day.className = "forecast-day";
  day.textContent = DAYS[local.getUTCDay()];

  const date = document.createElement("p");
  date.className = "forecast-date";
  date.textContent = `${local.getUTCDate()} ${MONTHS[local.getUTCMonth()]}`;

  const icon = document.createElement("img");
  icon.src = `${ICON_URL}${weather.icon}@2x.png`;
  icon.alt = weather.description;

  const temp = document.createElement("p");
  temp.className = "forecast-temp";
  temp.textContent = `${Math.round(entry.main.temp)}°C`;

  const desc = document.createElement("p");
  desc.className = "forecast-desc";
  desc.textContent = weather.description;

  card.append(day, date, icon, temp, desc);
  return card;
}

function displayForecast(forecastData) {
  forecastContainer.replaceChildren(); // clear old cards

  pickDailyEntries(forecastData).forEach((day) => {
    forecastContainer.appendChild(createForecastCard(day));
  });

  forecastSection.classList.remove("hidden");
}

/* ---------- Main search flow ---------- */
async function searchWeather(city) {
  if (!API_KEY || API_KEY === "YOUR_API_KEY_HERE") {
    showStatus("API key is not configured in script.js.", true);
    return;
  }

  setLoading(true);
  showStatus("Loading weather data...");
  hideResults();

  try {
    const [current, forecast] = await Promise.all([
      fetchJSON("weather", city),
      fetchJSON("forecast", city),
    ]);

    displayCurrent(current);
    displayForecast(forecast);
    showStatus(""); // success: clear message
  } catch (error) {
    showStatus(getErrorMessage(error), true);
  } finally {
    setLoading(false);
  }
}

/* ---------- Event listeners ---------- */
form.addEventListener("submit", (event) => {
  event.preventDefault(); // stop page reload

  const city = cityInput.value.trim();

  if (!city) {
    showStatus("Please enter a city name.", true);
    hideResults();
    cityInput.focus();
    return;
  }

  searchWeather(city);
});


/* =====================================================
   Carousel: climate of five states, one slide at a time
   Order: Jaipur > Mumbai > Jharkhand > Noida > Hyderabad,
   then it slides on to Jaipur again and keeps repeating.
   Jharkhand is a state, so its capital Ranchi is used
   for the weather.

   How the endless loop works:
   the track holds  [copy of last] [1] [2] [3] [4] [5] [copy of first]
   When the carousel slides onto a copy, we quietly jump
   (with no animation) to the real slide that looks identical.
   ===================================================== */

(function () {
  const states = [
    { state: "Rajasthan", city: "Jaipur", query: "Jaipur,IN", image: "images/jaipur.jpg" },
    { state: "Maharashtra", city: "Mumbai", query: "Mumbai,IN", image: "images/mumbai.jpg" },
    { state: "Jharkhand", city: "Ranchi", query: "Ranchi,IN", image: "images/jharkhand.jpg" },
    { state: "Uttar Pradesh", city: "Noida", query: "Noida,IN", image: "images/noida.jpg" },
    { state: "Telangana", city: "Hyderabad", query: "Hyderabad,IN", image: "images/hyderabad.jpg" },
  ];

  const total = states.length;
  const SLIDE_TIME = 4000;   // how long each slide stays (ms)
  const MOVE_TIME = 650;     // a little longer than the 0.6s CSS transition

  const carousel = document.getElementById("carousel");
  const track = document.getElementById("track");
  const dotsBox = document.getElementById("dots");

  let position = 1;   // 0 = copy of last, 1..total = real slides, total + 1 = copy of first
  let moving = false; // true while a slide animation is running
  let timer = null;
  const dots = [];

  // Small helper: makes an element and sets text safely (no innerHTML)
  function makeEl(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
  }

  function createSlide(item, isCopy) {
    const photo = makeEl("img");
    photo.src = item.image;
    photo.alt = `${item.state} (${item.city})`;

    const icon = makeEl("img", "slide-icon");
    icon.alt = "";
    const temp = makeEl("p", "slide-temp", "--");
    const desc = makeEl("p", "slide-desc", "Loading weather...");
    const extra = makeEl("p", "slide-extra");

    const row = makeEl("div", "slide-row");
    row.append(icon, temp);

    const info = makeEl("div", "slide-info");
    info.append(makeEl("h3", "", item.state), makeEl("p", "slide-city", item.city), row, desc, extra);

    const slide = makeEl("div", "slide");
    slide.append(photo, info);
    if (isCopy) slide.setAttribute("aria-hidden", "true");

    // Remember these elements so the weather can be filled in later
    item.parts.push({ icon, temp, desc, extra });
    return slide;
  }

  function build() {
    states.forEach((item) => { item.parts = []; });

    track.appendChild(createSlide(states[total - 1], true));
    states.forEach((item) => track.appendChild(createSlide(item, false)));
    track.appendChild(createSlide(states[0], true));

    states.forEach((item, index) => {
      const dot = makeEl("button", "dot");
      dot.type = "button";
      dot.setAttribute("aria-label", `Show ${item.state}`);
      dot.addEventListener("click", () => goToSlide(index));
      dotsBox.appendChild(dot);
      dots.push(dot);
    });
  }

  // Places the track at the current position, with or without animation
  function placeTrack(animate) {
    track.style.transition = animate ? "" : "none";
    track.style.transform = `translateX(-${position * 100}%)`;
  }

  function updateDots() {
    // The extra modulo keeps the number right even for the two copies
    const active = (((position - 1) % total) + total) % total;
    dots.forEach((dot, i) => dot.classList.toggle("active", i === active));
  }

  // Runs when a slide animation is over
  function finishMove() {
    if (position === 0) position = total;            // was on the copy of last
    if (position === total + 1) position = 1;        // was on the copy of first

    placeTrack(false);   // quiet jump to the matching real slide
    track.offsetWidth;   // forces the browser to apply the jump before animating again
    track.style.transition = "";
    moving = false;
  }

  function startMove() {
    moving = true;
    placeTrack(true);
    updateDots();
    setTimeout(finishMove, MOVE_TIME);
  }

  function move(step) {
    if (moving) return;   // ignore clicks while a slide is still moving
    position += step;
    startMove();
  }

  function goToSlide(index) {
    if (moving) return;
    position = index + 1;
    startMove();
    restartTimer();
  }

  function restartTimer() {
    clearInterval(timer);
    // No automatic sliding for people who prefer reduced motion
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    timer = setInterval(() => move(1), SLIDE_TIME);
  }

  async function loadWeather(item) {
    try {
      const url = `${BASE_URL}/weather?q=${encodeURIComponent(item.query)}&units=metric&appid=${API_KEY}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Request failed");

      const data = await response.json();
      const weather = data.weather[0];

      // Fill both the real slide and its copy
      item.parts.forEach((part) => {
        part.temp.textContent = `${Math.round(data.main.temp)}°C`;
        part.desc.textContent = weather.description;
        part.extra.textContent =
          `Feels like ${Math.round(data.main.feels_like)}°C · Humidity ${data.main.humidity}% · Wind ${data.wind.speed} m/s`;
        part.icon.src = `${ICON_URL}${weather.icon}.png`;
        part.icon.alt = weather.description;
      });
    } catch (error) {
      item.parts.forEach((part) => {
        part.desc.textContent = "Weather unavailable right now";
      });
    }
  }

  document.getElementById("prev-btn").addEventListener("click", () => {
    move(-1);
    restartTimer();
  });

  document.getElementById("next-btn").addEventListener("click", () => {
    move(1);
    restartTimer();
  });

  // Pause while the mouse is on the carousel
  carousel.addEventListener("mouseenter", () => clearInterval(timer));
  carousel.addEventListener("mouseleave", restartTimer);

  // Start
  build();
  placeTrack(false);
  updateDots();
  restartTimer();
  states.forEach(loadWeather);
})();
