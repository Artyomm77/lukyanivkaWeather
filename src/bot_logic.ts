import { GoogleGenerativeAI } from '@google/generative-ai';

export async function fetchWeather(apiKey: string, lat: number, lon: number) {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=ru`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Weather API error: ${res.status}`);
    return res.json();
}

export async function fetchExchangeRates() {
    try {
        const usdRes = await fetch('https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?valcode=USD&json');
        const usdData = await usdRes.json();
        const usdRate = usdData[0]?.rate?.toFixed(2) || 'Неизвестно';

        // Используем CoinGecko, так как Binance блокирует IP-адреса серверов Vercel в США
        const btcRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
        const btcData = await btcRes.json();
        const btcPrice = btcData.bitcoin?.usd ? btcData.bitcoin.usd.toFixed(0) : 'Неизвестно';

        return { usdRate, btcPrice };
    } catch (error) {
        console.error('Error fetching exchange rates:', error);
        return { usdRate: 'Ошибка', btcPrice: 'Ошибка' };
    }
}

async function generateWithFallback(ai: GoogleGenerativeAI, promptText: string) {
    const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest', 'gemini-pro'];
    let lastError;
    for (const modelName of models) {
        try {
            const model = ai.getGenerativeModel({ model: modelName });
            const aiResponse = await model.generateContent(promptText);
            return aiResponse;
        } catch (e: any) {
            console.error(`Model ${modelName} failed:`, e.message);
            lastError = e;
        }
    }
    throw lastError;
}

export async function generateBriefing(geminiApiKey: string, openWeatherApiKey: string): Promise<{ text: string, imageUrl: string }> {
    const ai = new GoogleGenerativeAI(geminiApiKey);

    // Получаем погоду (Лукьяновка)
    const weatherData = await fetchWeather(openWeatherApiKey, 49.5080, 30.5705);
    
    // Получаем курсы
    const rates = await fetchExchangeRates();

    const promptText = `Ты — мой личный ИИ-ассистент. Обращайся ко мне 'Артем'. Твой стиль: суровый, спортивный, дисциплинированный, 'серый' вайб. Никаких смайликов и нытья. 

Данные на текущий момент:
Погода в Лукьяновке: ${weatherData.main.temp}°C (ощущается ${weatherData.main.feels_like}°C), ${weatherData.weather[0].description}. Ветер: ${weatherData.wind.speed} м/с.
Курс НБУ (USD/UAH): ${rates.usdRate} грн.
Курс Bitcoin: $${rates.btcPrice}.

Дай жесткую короткую сводку: 
1. Погода и суровая рекомендация по экипировке.
2. Коротко курсы (биток и доллар).
3. Жесткая мотивационная фраза на день в стиле Гоггинса.`;

    const aiResponse = await generateWithFallback(ai, promptText);
    const text = aiResponse.response.text().trim() || "Сводка готова. Действуй.";

    return { text, imageUrl: "" };
}

export async function generateChatResponse(geminiApiKey: string, userMessage: string): Promise<string> {
    const ai = new GoogleGenerativeAI(geminiApiKey);
    const prompt = `Ты суровый личный ИИ-ассистент Артема. Отвечай жестко, кратко, в стиле дисциплины и Дэвида Гоггинса. Никаких смайликов. 
Вопрос Артема: "${userMessage}"`;
    const res = await generateWithFallback(ai, prompt);
    return res.response.text();
}
