import { VercelRequest, VercelResponse } from '@vercel/node';
import { Bot } from 'grammy';
import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        // Проверка необходимых переменных окружения
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const geminiApiKey = process.env.GEMINI_API_KEY;
        const chatId = process.env.CHAT_ID;
        const openWeatherApiKey = process.env.OPENWEATHER_API_KEY;

        if (!botToken || !geminiApiKey || !chatId || !openWeatherApiKey) {
            throw new Error('Отсутствуют необходимые переменные окружения (ENV)');
        }

        // Инициализация Telegram Bot
        const bot = new Bot(botToken);

        // Инициализация Gemini API
        const ai = new GoogleGenerativeAI(geminiApiKey);

        // 1. Запрос погоды для села Лукьяновка (Белоцерковский район)
        // Координаты: 49.5080, 30.5705 (бывший Таращанский район)
        const lat = 49.5080;
        const lon = 30.5705;
        const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${openWeatherApiKey}&units=metric&lang=ru`;
        
        const weatherResponse = await fetch(weatherUrl);
        if (!weatherResponse.ok) {
            throw new Error(`Ошибка OpenWeather API: ${weatherResponse.status} ${weatherResponse.statusText}`);
        }
        
        const weatherData = await weatherResponse.json();
        
        // 2. Генерация ответа через Gemini API
        const prompt = `Ты — мой личный ИИ-ассистент. Обращайся ко мне 'Артем'. Твой стиль: суровый, серьезный, спортивный, дисциплинированный, 'серый' вайб. Никаких смайликов, сюсюканий и лишних эмоций. Проанализируй погоду и дай короткую, сухую рекомендацию по экипировке.

Текущая погода (село Лукьяновка):
Температура: ${weatherData.main.temp}°C (ощущается как ${weatherData.main.feels_like}°C)
Погодные условия: ${weatherData.weather[0].description}
Влажность: ${weatherData.main.humidity}%
Ветер: ${weatherData.wind.speed} м/с`;

        const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const aiResponse = await model.generateContent(prompt);

        const recommendation = aiResponse.response.text();

        if (!recommendation) {
            throw new Error('Gemini API вернул пустой ответ');
        }

        // 3. Отправка ответа в Telegram
        await bot.api.sendMessage(chatId, recommendation);

        return res.status(200).json({ success: true, message: 'Cron executed successfully' });
    } catch (error: any) {
        console.error('Ошибка при выполнении cron:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}
