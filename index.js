const express = require('express');
const cors = require('cors');
const webpush = require('web-push');

require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  return res.json({
    ok: true,
    message: 'Chatting-backend online (Vercel-compatible).',
    env: {
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      hasSupabaseKey: !!process.env.SUPABASE_KEY,
      hasVapid: !!(process.env.PUBLIC_VAPID_KEY && process.env.PRIVATE_VAPID_KEY)
    }
  });
});

const PUBLIC_VAPID = process.env.PUBLIC_VAPID_KEY;
const PRIVATE_VAPID = process.env.PRIVATE_VAPID_KEY;

if (PUBLIC_VAPID && PRIVATE_VAPID) {
  try {
    webpush.setVapidDetails('mailto:ahrar.0932@gmail.com', PUBLIC_VAPID, PRIVATE_VAPID);
    console.log('web-push VAPID keys set.');
  } catch (err) {
    console.error('web-push setVapidDetails error:', err);
  }
} else {
  console.warn('VAPID keys missing — push notifications disabled until keys are set.');
}
let subscriptions = [];

app.get('/config', (req, res) => {
  try {
    return res.json({
      supabaseUrl: process.env.SUPABASE_URL || '',
      supabaseKey: process.env.SUPABASE_KEY || '',
      publicVapidKey: PUBLIC_VAPID || ''
    });
  } catch (err) {
    console.error('GET /config error', err);
    return res.status(500).json({ error: 'internal' });
  }
});

app.post('/save-subscription', (req, res) => {
  try {
    const { subscription, userId } = req.body;
    if (!subscription) return res.status(400).json({ error: 'subscription missing' });
    if (!userId) return res.status(400).json({ error: 'userId missing' });

    const exists = subscriptions.find(
      s => s.userId === userId && s.subscription && s.subscription.endpoint === subscription.endpoint
    );
    if (!exists) {
      subscriptions.push({ userId, subscription });
      console.log('Subscription saved for user', userId);
    } else {
      console.log('Subscription already exists for user', userId);
    }
    return res.status(201).json({ message: 'Subscription saved!' });
  } catch (err) {
    console.error('POST /save-subscription error', err);
    return res.status(500).json({ error: 'internal' });
  }
});

app.post('/unsubscribe', (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'endpoint missing' });

    const before = subscriptions.length;
    subscriptions = subscriptions.filter(s => !s.subscription || s.subscription.endpoint !== endpoint);
    const after = subscriptions.length;
    console.log('Removed', before - after, 'subscriptions');
    return res.json({ message: 'Unsubscribed' });
  } catch (err) {
    console.error('POST /unsubscribe error', err);
    return res.status(500).json({ error: 'internal' });
  }
});

app.post('/send-message-notification', async (req, res) => {
  try {
    const { senderName, receiverId, text, url } = req.body;
    if (!senderName) return res.status(400).json({ error: 'senderName missing' });
    if (!receiverId) return res.status(400).json({ error: 'receiverId missing' });

    const payload = JSON.stringify({
      title: senderName,
      message: `You have a new message from ${senderName}: ${text || 'New message'}`,
      url: url || '/chat'
    });

    const targets = subscriptions.filter(s => s.userId === receiverId);
    if (!targets.length) {
      console.log('send-message-notification: no subscribers for', receiverId);
      return res.json({ message: 'No subscribers for receiver' });
    }

    await Promise.all(
      targets.map(t =>
        webpush
          .sendNotification(t.subscription, payload)
          .then(() => console.log('Notification sent to', t.subscription.endpoint))
          .catch(err => {
            console.error('webpush error for endpoint', t.subscription && t.subscription.endpoint, err && err.stack ? err.stack : err);
          })
      )
    );

    return res.json({ message: 'Notification processed' });
  } catch (err) {
    console.error('POST /send-message-notification error', err && err.stack ? err.stack : err);
    return res.status(500).json({ error: 'internal' });
  }
});

module.exports = app;
