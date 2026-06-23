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

export async function generateBriefing(geminiApiKey: string, openWeatherApiKey: string): Promise<{ text: string, imageUrl: string }> {
    const ai = new GoogleGenerativeAI(geminiApiKey);
    const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Получаем погоду (Лукьяновка)
    const weatherData = await fetchWeather(openWeatherApiKey, 49.5080, 30.5705);
    
    // Получаем курсы
    const rates = await fetchExchangeRates();

    const promptText = `Ты — мой личный ИИ-ассистент. Обращайся ко мне 'Артем'. Твой стиль: суровый, спортивный, дисциплинированный, 'серый' вайб. Никаких смайликов и нытья. 

Данные на текущий момент:
Погода в Лукьяновке: ${weatherData.main.temp}°C (ощущается ${weatherData.main.feels_like}°C), ${weatherData.weather[0].description}. Ветер: ${weatherData.wind.speed} м/с.
Курс НБУ (USD/UAH): ${rates.usdRate} грн.
Курс Bitcoin: $${rates.btcPrice}.

Сформируй ответ строго в формате JSON, содержащий два поля:
1. "text" - жесткая короткая сводка (погода, курсы, жесткая мотивация на день в стиле Гоггинса).
2. "image_prompt" - промпт ДО 15 СЛОВ НА АНГЛИЙСКОМ для генерации атмосферной картинки погоды (стиль: dark cinematic, brutalist, realistic, grey vibe). Никакого текста на картинке.

Верни только валидный JSON, без маркдауна и лишних символов. Пример:
{"text": "Сводка...", "image_prompt": "dark sky..."}`;

    const aiResponse = await model.generateContent(promptText);
    let responseText = aiResponse.response.text().trim();
    
    // Очистка от маркдауна, если ИИ всё же его добавит
    if (responseText.startsWith('```json')) {
        responseText = responseText.replace(/```json\n?/, '').replace(/```/g, '').trim();
    }

    let parsedResponse;
    try {
        parsedResponse = JSON.parse(responseText);
    } catch (e) {
        console.error("Failed to parse Gemini JSON:", responseText);
        parsedResponse = {
            text: responseText, // Если не JSON, отдаем как текст
            image_prompt: "dark cinematic grey sky, realistic, brutalist" // Дефолтный промпт
        };
    }

    const text = parsedResponse.text || "Сводка готова. Действуй.";
    let imagePrompt = parsedResponse.image_prompt || "dark cinematic grey sky, realistic, brutalist";
    
    imagePrompt = imagePrompt.replace(/['"]/g, '').replace(/\n/g, ' ');

    const encodedPrompt = encodeURIComponent(imagePrompt);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=800&height=800&nologo=true`;

    return { text, imageUrl };
}

export async function generateChatResponse(geminiApiKey: string, userMessage: string): Promise<string> {
    const ai = new GoogleGenerativeAI(geminiApiKey);
    const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const prompt = `Ты суровый личный ИИ-ассистент Артема. Отвечай жестко, кратко, в стиле дисциплины и Дэвида Гоггинса. Никаких смайликов. 
Вопрос Артема: "${userMessage}"`;
    const res = await model.generateContent(prompt);
    return res.response.text();
}
