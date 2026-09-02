/**
 * Minimal Telegram Bot API client using plain fetch (Node 18+ / Netlify
 * Functions runtime has global fetch — no extra HTTP dependency needed
 * for these three calls). The full bot webhook logic (whitelist auth,
 * inline button handling, /today command) lives in grammy — see
 * netlify/functions/telegram-webhook.js — this file is just the outbound
 * "send/edit a message" primitive, reused by both the booking-creation
 * notification and the webhook's confirm/reject message edits.
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function callTelegramApi(method, payload) {
  if (!BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN is not set');
  const res = await fetch(`${API_BASE}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Telegram API ${method} failed: ${data.description || res.status}`);
  }
  return data.result;
}

/** Sends a message with optional inline keyboard. Returns { chatId, messageId }. */
async function sendMessage(chatId, text, { inlineKeyboard } = {}) {
  const payload = { chat_id: chatId, text, parse_mode: 'HTML' };
  if (inlineKeyboard) payload.reply_markup = { inline_keyboard: inlineKeyboard };
  const result = await callTelegramApi('sendMessage', payload);
  return { chatId, messageId: result.message_id };
}

/** Edits an existing message's text/keyboard in place (audit-log style, per brief §7). */
async function editMessageText(chatId, messageId, text, { inlineKeyboard } = {}) {
  const payload = { chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML' };
  payload.reply_markup = { inline_keyboard: inlineKeyboard || [] };
  return callTelegramApi('editMessageText', payload);
}

async function answerCallbackQuery(callbackQueryId, text) {
  return callTelegramApi('answerCallbackQuery', { callback_query_id: callbackQueryId, text, show_alert: !!text });
}

module.exports = { sendMessage, editMessageText, answerCallbackQuery };
