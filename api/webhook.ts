import { VercelRequest, VercelResponse } from '@vercel/node';
import { Bot, webhookCallback } from 'grammy';
import { generateBriefing, generateChatResponse } from '../src/bot_logic';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const geminiApiKey = process.env.GEMINI_API_KEY;
        const openWeatherApiKey = process.env.OPENWEATHER_API_KEY;

        if (!botToken || !geminiApiKey || !openWeatherApiKey) {
            return res.status(500).send('Отсутствуют переменные окружения');
        }

        const bot = new Bot(botToken);

        bot.command('now', async (ctx) => {
            // Отправляем промежуточное сообщение, чтобы показать, что бот думает
            const loadingMsg = await ctx.reply('Собираю данные. Жди.');
            
            try {
                const briefing = await generateBriefing(geminiApiKey, openWeatherApiKey);
                
                await ctx.replyWithPhoto(briefing.imageUrl, { 
                    caption: briefing.text 
                });
                
                // Удаляем промежуточное сообщение
                await ctx.api.deleteMessage(ctx.chat.id, loadingMsg.message_id).catch(() => {});
            } catch (e: any) {
                await ctx.reply(`Ошибка: ${e.message}`);
            }
        });

        bot.on('message:text', async (ctx) => {
            const userMsg = ctx.message.text;
            if (userMsg.startsWith('/')) return; // игнорируем неизвестные команды
            
            try {
                const reply = await generateChatResponse(geminiApiKey, userMsg);
                await ctx.reply(reply);
            } catch (e: any) {
                await ctx.reply(`Ошибка ИИ: ${e.message}`);
            }
        });

        // Создаем обработчик webhook для Vercel
        const cb = webhookCallback(bot, 'http');
        
        return new Promise((resolve) => {
            cb(req, res).then(() => resolve(undefined)).catch((err: any) => {
                console.error('Webhook processing error:', err);
                res.status(500).send('Error');
                resolve(undefined);
            });
        });
        
    } catch (error: any) {
        console.error('Webhook handler error:', error);
        return res.status(500).send('Internal Server Error');
    }
}
