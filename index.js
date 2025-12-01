const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());

const PORT = process.env.PORT || 5000;

app.get('/', (req, res) => {
  return res.json({
    ok: true,
    message: 'Chatting-backend online (Vercel-compatible).'
  });
});

app.post('/send-message-notification', async (req, res) => {
  try {
    const { senderName, receiverId, text, url } = req.body;
    const safeSenderName = senderName || 'Unknown User';
    if (!receiverId) return res.status(400).json({ error: 'receiverId missing' });

    const notificationData = {
      app_id: process.env.ONESIGNAL_APP_ID,
      include_external_user_ids: [receiverId.toString()],
      headings: { "en": "New Message from " + safeSenderName },
      contents: { "en": text || "You have a new message" },
      url: url || "/chat"
    };

    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=utf-8",
        "Authorization": `Basic ${process.env.ONESIGNAL_REST_KEY}`
      },
      body: JSON.stringify(notificationData)
    });

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('POST /send-message-notification error', err);
    return res.status(500).json({ error: 'internal' });
  }
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`Backend running locally on http://localhost:${PORT}`));
}

module.exports = app;
