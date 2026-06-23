import { VercelRequest, VercelResponse } from '@vercel/node';
import { Bot } from 'grammy';
import { generateBriefing, generateChatResponse } from '../src/bot_logic';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(200).send('OK');
    }

    try {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const geminiApiKey = process.env.GEMINI_API_KEY;
        const openWeatherApiKey = process.env.OPENWEATHER_API_KEY;

        if (!botToken || !geminiApiKey || !openWeatherApiKey) {
            return res.status(500).send('Missing ENV');
        }

        const bot = new Bot(botToken);

        bot.command('now', async (ctx) => {
            await ctx.reply('Собираю данные. Жди.');
            try {
                const briefing = await generateBriefing(geminiApiKey, openWeatherApiKey);
                await ctx.reply(briefing.text);
            } catch (e: any) {
                await ctx.reply(`Ошибка: ${e.message}`);
            }
        });

        bot.on('message:text', async (ctx) => {
            const userMsg = ctx.message.text;
            if (userMsg.startsWith('/')) return;
            
            try {
                const reply = await generateChatResponse(geminiApiKey, userMsg);
                await ctx.reply(reply);
            } catch (e: any) {
                await ctx.reply(`Ошибка ИИ: ${e.message}`);
            }
        });

        // Самая простая и надежная обработка
        await bot.handleUpdate(req.body);
        
        return res.status(200).send('OK');
        
    } catch (error: any) {
        console.error('Webhook handler error:', error);
        return res.status(500).send('Internal Server Error');
    }
}
