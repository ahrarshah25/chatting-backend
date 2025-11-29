const express = require('express');
const cors = require('cors');
require('dotenv').config();
const webpush = require('web-push');

const app = express();

app.use(cors());
app.use(express.json());

webpush.setVapidDetails(
    'mailto:ahrar.0932@gmail.com',
    process.env.PUBLIC_VAPID_KEY,
    process.env.PRIVATE_VAPID_KEY
);

let subscriptions = [];

// ---------------- CONFIG ROUTE ----------------
app.get('/config', (req, res) => {
    try {
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

// ---------------- SAVE SUBSCRIPTION ----------------
app.post('/save-subscription', (req, res) => {
    try {
        const { subscription, userId } = req.body;

        if (!subscription) {
            return res.status(400).json({ error: 'subscription missing' });
        }
        if (!userId) {
            return res.status(400).json({ error: 'userId missing' });
        }

        const exists = subscriptions.find(
            s =>
                s.userId === userId &&
                s.subscription &&
                s.subscription.endpoint === subscription.endpoint
        );

        if (!exists) {
            subscriptions.push({ userId, subscription });
            console.log('Subscription saved for user', userId);
        }

        return res.status(201).json({ message: 'Subscription saved!' });
    } catch (err) {
        console.error('POST /save-subscription error', err);
        return res.status(500).json({ error: 'internal' });
    }
});

// ---------------- UNSUBSCRIBE ----------------
app.post('/unsubscribe', (req, res) => {
    try {
        const { endpoint } = req.body;

        if (!endpoint) {
            return res.status(400).json({ error: 'endpoint missing' });
        }

        const before = subscriptions.length;
        subscriptions = subscriptions.filter(
            s => s.subscription.endpoint !== endpoint
        );
        const after = subscriptions.length;

        console.log('Removed', before - after, 'subscriptions');

        return res.json({ message: 'Unsubscribed' });
    } catch (err) {
        console.error('POST /unsubscribe error', err);
        return res.status(500).json({ error: 'internal' });
    }
});

// ---------------- SEND MESSAGE NOTIFICATION ----------------
app.post('/send-message-notification', async (req, res) => {
    try {
        const { senderName, receiverId, text, url } = req.body;

        if (!senderName) {
            return res.status(400).json({ error: 'senderName missing' });
        }
        if (!receiverId) {
            return res.status(400).json({ error: 'receiverId missing' });
        }

        const payload = JSON.stringify({
            title: senderName,
            message: `You have a new message from ${senderName}: ${text || 'New message'}`,
            url: url || '/chat'
        });

        const targets = subscriptions.filter(s => s.userId === receiverId);

        if (!targets.length) {
            return res.json({ message: 'No subscribers for receiver' });
        }

        await Promise.all(
            targets.map(t =>
                webpush
                    .sendNotification(t.subscription, payload)
                    .catch(err =>
                        console.error(
                            'webpush error for subscriber endpoint:',
                            t.subscription.endpoint,
                            err
                        )
                    )
            )
        );

        return res.json({ message: 'Notification processed' });
    } catch (err) {
        console.error('POST /send-message-notification error', err);
        return res.status(500).json({ error: 'internal' });
    }
});

// ----------- EXPORT EXPRESS APP (IMPORTANT FOR VERCEL) ----------
module.exports = app;
