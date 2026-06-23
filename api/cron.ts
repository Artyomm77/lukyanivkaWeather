import { VercelRequest, VercelResponse } from '@vercel/node';
import { Bot } from 'grammy';
import { generateBriefing } from '../src/bot_logic';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const geminiApiKey = process.env.GEMINI_API_KEY;
        const chatId = process.env.CHAT_ID;
        const openWeatherApiKey = process.env.OPENWEATHER_API_KEY;

        if (!botToken || !geminiApiKey || !chatId || !openWeatherApiKey) {
            throw new Error('Отсутствуют необходимые переменные окружения (ENV)');
        }

        const bot = new Bot(botToken);

        // Генерируем сводку и картинку
        const briefing = await generateBriefing(geminiApiKey, openWeatherApiKey);

        try {
            // Отправляем картинку с текстом
            await bot.api.sendPhoto(chatId, briefing.imageUrl, { 
                caption: briefing.text,
                parse_mode: 'HTML' // На всякий случай
            });
        } catch (photoError: any) {
            console.error("Failed to send photo in cron:", photoError.message);
            await bot.api.sendMessage(chatId, briefing.text, { parse_mode: 'HTML' });
        }

        return res.status(200).json({ success: true, message: 'Cron executed successfully' });
    } catch (error: any) {
        console.error('Ошибка при выполнении cron:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}
