const keys = ['TELEGRAM_BOT_TOKEN','TELEGRAM_CHAT_ID','GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASS','APPROVAL_EMAIL'];
const present = keys.filter(k => process.env[k] && process.env[k].length > 0);
const missing = keys.filter(k => !process.env[k] || process.env[k].length === 0);
console.log(`Secrets present: ${present.length}/${keys.length}`);
if (present.length > 0) console.log('Present:', present.join(', '));
if (missing.length > 0) console.log('Missing (will use demo mode):', missing.join(', '));
