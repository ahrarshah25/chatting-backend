const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: '.env.local' });
const webpush = require('web-push');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

webpush.setVapidDetails(
    'mailto:ahrar.0932@gmail.com',
    process.env.PUBLIC_VAPID_KEY,
    process.env.PRIVATE_VAPID_KEY
);

let subscriptions = [];

app.get('/config', (req, res) => {
    try {
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY || !process.env.PUBLIC_VAPID_KEY) {
            console.log('Missing config environment variables');
        }
        return res.json({
            supabaseUrl: process.env.SUPABASE_URL || '',
            supabaseKey: process.env.SUPABASE_KEY || '',
            publicVapidKey: process.env.PUBLIC_VAPID_KEY || ''
        });
    } catch (err) {
        console.error('GET /config error', err);
        return res.status(500).json({ error: 'internal' });
    }
});

app.post('/save-subscription', (req, res) => {
    try {
        if (!req.body) {
            console.log('save-subscription: no body');
            return res.status(400).json({ error: 'no body' });
        }
        const { subscription, userId } = req.body;
        if (!subscription) {
            console.log('save-subscription: subscription missing');
            return res.status(400).json({ error: 'subscription missing' });
        }
        if (!userId) {
            console.log('save-subscription: userId missing');
            return res.status(400).json({ error: 'userId missing' });
        }
        const exists = subscriptions.find(s => s.userId === userId && s.subscription && s.subscription.endpoint === subscription.endpoint);
        if (exists) {
            console.log('save-subscription: already exists for user', userId);
        } else {
            subscriptions.push({ userId, subscription });
            console.log('save-subscription: saved for user', userId);
        }
        return res.status(201).json({ message: 'Subscription saved!' });
    } catch (err) {
        console.error('POST /save-subscription error', err);
        return res.status(500).json({ error: 'internal' });
    }
});

app.post('/unsubscribe', (req, res) => {
    try {
        if (!req.body) {
            console.log('unsubscribe: no body');
            return res.status(400).json({ error: 'no body' });
        }
        const { endpoint } = req.body;
        if (!endpoint) {
            console.log('unsubscribe: endpoint missing');
            return res.status(400).json({ error: 'endpoint missing' });
        }
        const before = subscriptions.length;
        subscriptions = subscriptions.filter(s => !s.subscription || s.subscription.endpoint !== endpoint);
        const after = subscriptions.length;
        console.log('unsubscribe: removed', before - after, 'subscriptions');
        return res.json({ message: 'Unsubscribed' });
    } catch (err) {
        console.error('POST /unsubscribe error', err);
        return res.status(500).json({ error: 'internal' });
    }
});

app.post('/send-message-notification', async (req, res) => {
    try {
        if (!req.body) {
            console.log('send-message-notification: no body');
            return res.status(400).json({ error: 'no body' });
        }
        const { senderName, receiverId, text, url } = req.body;
        if (!senderName) {
            console.log('send-message-notification: senderName missing');
            return res.status(400).json({ error: 'senderName missing' });
        }
        if (!receiverId) {
            console.log('send-message-notification: receiverId missing');
            return res.status(400).json({ error: 'receiverId missing' });
        }
        const payload = JSON.stringify({
            title: senderName,
            message: `You have a new message from ${senderName}: ${text || 'New message'}`,
            url: url || '/chat'
        });
        const targets = subscriptions.filter(s => s.userId === receiverId);
        if (!targets || targets.length === 0) {
            console.log('send-message-notification: no subscriptions found for', receiverId);
            return res.json({ message: 'No subscribers for receiver' });
        }
        await Promise.all(targets.map(t => webpush.sendNotification(t.subscription, payload).catch(err => {
            console.error('webpush error for endpoint', (t && t.subscription && t.subscription.endpoint) || '<no endpoint>', err);
        })));
        console.log('send-message-notification: notifications attempted for', targets.length, 'subscriber(s)');
        return res.json({ message: 'Notification processed' });
    } catch (err) {
        console.error('POST /send-message-notification error', err);
        return res.status(500).json({ error: 'internal' });
    }
});

app.listen(PORT, () => {
    console.log(`Backend running at http://localhost:${PORT}`);
});
