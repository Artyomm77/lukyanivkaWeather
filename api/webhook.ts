import { VercelRequest, VercelResponse } from '@vercel/node';
import { Bot, webhookCallback } from 'grammy';
import { generateBriefing, generateChatResponse } from '../src/bot_logic';

const botToken = process.env.TELEGRAM_BOT_TOKEN!;
const geminiApiKey = process.env.GEMINI_API_KEY!;
const openWeatherApiKey = process.env.OPENWEATHER_API_KEY!;

const bot = new Bot(botToken);

bot.command('now', async (ctx) => {
    await ctx.reply('Собираю данные. Жди.');
    try {
        const briefing = await generateBriefing(geminiApiKey, openWeatherApiKey);
        await ctx.reply(briefing.text);
    } catch (e: any) {
        await ctx.reply('Ошибка: ' + e.message);
    }
});

bot.on('message:text', async (ctx) => {
    if (ctx.message.text.startsWith('/')) return;
    try {
        const reply = await generateChatResponse(geminiApiKey, ctx.message.text);
        await ctx.reply(reply);
    } catch (e: any) {
        await ctx.reply('Ошибка: ' + e.message);
    }
});

export default webhookCallback(bot, 'std/http');
