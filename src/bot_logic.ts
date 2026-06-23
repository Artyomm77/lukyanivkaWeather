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

        const btcRes = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT');
        const btcData = await btcRes.json();
        const btcPrice = parseFloat(btcData.price).toFixed(0) || 'Неизвестно';

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

    const promptText = `Ты — мой личный ИИ-ассистент. Обращайся ко мне 'Артем'. Твой стиль: суровый, спортивный, дисциплинированный, 'серый' вайб. Стиль Дэвида Гоггинса. Никаких смайликов и нытья. 

Данные на текущий момент:
Погода в Лукьяновке: ${weatherData.main.temp}°C (ощущается ${weatherData.main.feels_like}°C), ${weatherData.weather[0].description}. Ветер: ${weatherData.wind.speed} м/с.
Курс НБУ (USD/UAH): ${rates.usdRate} грн.
Курс Bitcoin: $${rates.btcPrice}.

Дай жесткую короткую сводку: 
1. Погода и суровая рекомендация по экипировке.
2. Коротко курсы (биток и доллар).
3. Жесткая мотивационная фраза на день в стиле Гоггинса.`;

    const aiResponse = await model.generateContent(promptText);
    const text = aiResponse.response.text();

    // Генерируем промпт для картинки
    const imagePromptInstruction = `Создай короткий промпт (до 15 слов) НА АНГЛИЙСКОМ ЯЗЫКЕ для генерации атмосферной картинки. Картинка должна отражать текущую погоду: ${weatherData.weather[0].description}, ${weatherData.main.temp}°C. Стиль: dark cinematic, brutalist, realistic, grey vibe. Никакого текста на картинке. Только пейзаж. Выведи ТОЛЬКО промпт на английском. Никаких лишних слов.`;
    
    const imageAiResponse = await model.generateContent(imagePromptInstruction);
    let imagePrompt = imageAiResponse.response.text().trim();
    
    // Удаляем возможные кавычки и переводы строк
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
