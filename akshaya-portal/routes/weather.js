const express   = require('express');
const router    = express.Router();
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

router.get('/weatherdt', async (req, res) => {
    const { city } = req.query; // Get city name from query parameters
    const apiKey = process.env.WEATHER_API_KEY; // Get API key from .env

    if (!city) {
        return res.status(400).json({ error: "City is required" });
    }

    const apiUrl = `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${encodeURIComponent(city)}&aqi=no`;

    try {
        const response = await axios.get(apiUrl);
        const weatherData = response.data;

        // Extract relevant data to send back to the frontend
        const result = {
            condition: weatherData.current.condition.text,
            temp_c: weatherData.current.temp_c,
            city_name: weatherData.location.name,
            icon: weatherData.current.condition.icon,
        };

        res.json(result); // Send the extracted data to the frontend
    } catch (error) {
        console.error("Error fetching weather data from API:", error.message);
        res.status(500).json({ error: "Failed to fetch weather data" });
    }
});

// Route to fetch forecast data
router.get('/forecastdt', async (req, res) => {
    const { city } = req.query; // Get city name from query parameters
    const apiKey = process.env.WEATHER_API_KEY; // Get API key from .env

    if (!city) {
        return res.status(400).json({ error: "City is required" });
    }

    const apiUrl = `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${encodeURIComponent(city)}&days=4&aqi=no`;

    try {
        const response = await axios.get(apiUrl);
        const weatherData = response.data;

        // Extract relevant forecast data
        const forecast = weatherData.forecast.forecastday.map(dayData => {
            const date = new Date(dayData.date);
            const day = date.toLocaleDateString("en-US", { weekday: "short" });
            const temp = Math.round(dayData.day.avgtemp_c);
            const icon = dayData.day.condition.icon;
            return { day, temp, icon };
        });

        // Extract temperature range for the first day
        const firstDay = weatherData.forecast.forecastday[0];
        const maxTemp = Math.round(firstDay.day.maxtemp_c);
        const minTemp = Math.round(firstDay.day.mintemp_c);

        // Send the extracted data to the frontend
        res.json({
            forecast,
            maxTemp,
            minTemp,
        });
    } catch (error) {
        console.error("Error fetching forecast data from API:", error.message);
        res.status(500).json({ error: "Failed to fetch forecast data" });
    }
});

module.exports = router;