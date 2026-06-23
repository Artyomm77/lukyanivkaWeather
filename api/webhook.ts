import { VercelRequest, VercelResponse } from '@vercel/node';
import { Bot } from 'grammy';
import { generateBriefing, generateChatResponse } from '../src/bot_logic';

const processedUpdates = new Set<number>();

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(200).send('OK');
    }

    try {
        // Гарантируем, что update это объект
        const update = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        
        if (update && update.update_id) {
            if (processedUpdates.has(update.update_id)) {
                return res.status(200).send('OK');
            }
            processedUpdates.add(update.update_id);
            if (processedUpdates.size > 500) {
                const iterator = processedUpdates.values();
                processedUpdates.delete(iterator.next().value);
            }
        }

        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const geminiApiKey = process.env.GEMINI_API_KEY;
        const openWeatherApiKey = process.env.OPENWEATHER_API_KEY;

        if (!botToken || !geminiApiKey || !openWeatherApiKey) {
            return res.status(500).send('Отсутствуют переменные окружения');
        }

        const bot = new Bot(botToken);

        bot.command('now', async (ctx) => {
            const loadingMsg = await ctx.reply('Собираю данные. Жди.');
            try {
                const briefing = await generateBriefing(geminiApiKey, openWeatherApiKey);
                // Убрали parse_mode: 'HTML', чтобы избежать конфликтов с Markdown от Gemini
                await ctx.reply(briefing.text);
                await ctx.api.deleteMessage(ctx.chat.id, loadingMsg.message_id).catch(() => {});
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

        await bot.handleUpdate(update);
        
        return res.status(200).send('OK');
        
    } catch (error: any) {
        console.error('Webhook handler error:', error);
        return res.status(500).send('Internal Server Error');
    }
}
