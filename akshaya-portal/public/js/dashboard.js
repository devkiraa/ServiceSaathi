// Fetch weather data dynamically using the backend endpoint
async function fetchWeatherData(city = "Ernakulam") {
  const apiUrl = `api/weatherdt?city=${encodeURIComponent(city)}`; // Backend endpoint
  try {
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error("Failed to fetch weather data");
    const data = await response.json();
    
    // Update DOM with fetched data
    document.getElementById("weather-condition").textContent = data.condition;
    document.getElementById("current-temperature").textContent = `${Math.round(data.temp_c)}°`;
    document.getElementById("temperature-range").textContent = `--°/--°`; // Range will be updated by forecast data
    document.getElementById("city-name").textContent = data.city_name; // Displays the city name
    
    // Set weather icon dynamically
    const iconUrl = data.icon;
    document.getElementById("weather-icon").innerHTML = `<img src="https:${iconUrl}" alt="Weather Icon" class="w-12 h-12">`;
    
    // Fetch forecast data
    fetchForecastData(city);
  } catch (error) {
    console.error("Error fetching weather data:", error);
    document.getElementById("weather-condition").textContent = "Error";
    document.getElementById("current-temperature").textContent = "--°";
    document.getElementById("temperature-range").textContent = "--°/--°";
    document.getElementById("city-name").textContent = "City Not Found";
  }
}

// Fetch forecast data dynamically using the backend endpoint
async function fetchForecastData(city) {
  const apiUrl = `api/forecastdt?city=${encodeURIComponent(city)}`; // Backend endpoint
  try {
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error("Failed to fetch forecast data");
    const data = await response.json();
    
    // Extract forecast for the next 4 days
    const forecastSection = document.getElementById("forecast-section");
    forecastSection.innerHTML = ""; // Clear previous forecast
    data.forecast.forEach((dayData) => {
      const button = document.createElement("button");
      button.innerHTML = `
        <span class="day">${dayData.day}</span>
        <span class="icon-weather-day">
          <img src="https:${dayData.icon}" alt="Weather Icon" class="w-6 h-6">
        </span>
        <span>${dayData.temp}°</span>
      `;
      forecastSection.appendChild(button);
    });
    
    // Update temperature range (min/max) for the first day
    const maxTemp = Math.round(data.maxTemp);
    const minTemp = Math.round(data.minTemp);
    document.getElementById("temperature-range").textContent = `${maxTemp}°/${minTemp}°`;
  } catch (error) {
    console.error("Error fetching forecast data:", error);
  }
}

// Update current time and date dynamically
function updateDateTime() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const day = now.toLocaleDateString("en-US", { weekday: "short" });
  const month = now.toLocaleDateString("en-US", { month: "short" });
  const date = now.getDate();
  document.getElementById("current-time").textContent = `${hours}:${minutes}`;
  document.getElementById("current-date").textContent = `${day} ${month} ${date}`;
}

// Dynamically adjust the height of Card 3 and Card 4
function adjustDoughnutHeights() {
  const container3 = document.getElementById("container-3");
  const card4 = document.getElementById("card-4");

  // Get dimensions of the parent container
  const parentRect = container3.getBoundingClientRect();
  const parentHeight = parentRect.height;

  // Calculate total height of existing cards
  let occupiedHeight = 0;

  Array.from(container3.children).forEach(child => {
    occupiedHeight += child.getBoundingClientRect().height;
  });

  // Calculate remaining space
  const remainingSpace = parentHeight - occupiedHeight;

  // Adjust the height of Card 3 and Card 4
  if (remainingSpace > 0) {
    // Calculate the new height for Card 3 and Card 4
    const newHeight = 220+remainingSpace// Ensure a minimum height of 180px

    card4.classList.forEach((className) => {
      if (className.startsWith("min-h-")) {
        card4.classList.remove(className);
      }
    });
  
    card4.classList.add(`min-h-[${newHeight}px]`);
  } else {
    console.log("Not enough space to adjust card heights.");
  }
}

// Dynamically adjust the height of Card 3 and Card 4
function adjustLineHeights() {
  const container4 = document.getElementById("container-4");
  const card5 = document.getElementById("card-5");
  const linegr = document.getElementById("lineChart");

  // Get dimensions of the parent container
  const parentRect = container4.getBoundingClientRect();
  const parentHeight = parentRect.height;

  // Calculate total height of existing cards
  let occupiedHeight = 0;

  Array.from(container4.children).forEach(child => {
    occupiedHeight += child.getBoundingClientRect().height;
  });

  // Calculate remaining space
  const remainingSpace = parentHeight - occupiedHeight + 36;

  // Adjust the height of Card 3 and Card 4
  if (remainingSpace > 0) {
    // Calculate the new height for Card 3 and Card 4
    const newHeight = 250+remainingSpace// Ensure a minimum height of 180px
    
    card5.classList.forEach((className) => {
      if (className.startsWith("min-h-")) {
        card5.classList.remove(className);
        linegr.classList.remove('h-full');
      }
    });
  
    card5.classList.add(`min-h-[${newHeight}px]`);
    linegr.classList.add(`min-h-[${newHeight-76}px]`);
  } else {
    console.log("Not enough space to adjust card heights.");
  }
}

async function redirect(direction) {
  if(direction === 'logout'){
    window.location.href = '/logout';
  } else if (direction === 'profile'){
    window.location.href = '/profile';
  } else if (direction === 'change-pass'){
    window.location.href = '/change-password';
  } else {
    console.error("Invalid Redirection!");
  }
}

// Initialize the app
function init() {
  // fetchWeatherData(); // Fetch weather data for a default city
  updateDateTime(); // Update time and date
  setInterval(updateDateTime, 1000); // Update time every second
  setInterval(fetchWeatherData, 3600000); // Update Weather every hour

  // Adjust card heights on page load and window resize
  adjustDoughnutHeights();
  window.addEventListener("resize", adjustDoughnutHeights);
  
  adjustLineHeights();
  window.addEventListener("resize", adjustLineHeights);
}
// Start the app
document.addEventListener("DOMContentLoaded", function () {
  init();
});  