import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import mqtt from 'mqtt';

const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);

const mqttUri = (process.env.MQTT_URI || 'wss://gd1f212e.ala.asia-southeast1.emqxsl.com:8084/mqtt');

const clientId = 'emqx_nodejs_' + Math.random().toString(16).substring(2, 8)
const username = 'server_side'
const password = 'server_side'

// MQTT setup
const client = mqtt.connect(mqttUri, {
  clientId,
  username,
  password,
  clean: true,
  connectTimeout: 4000,
  reconnectPeriod: 5000,
})

// MQTT topics
const LED_STATUS_TOPIC = 'ledStatus';
const LED_COMMAND_TOPIC = 'ledCommand';

// Store the LED state
let ledState = {
  status: false
};

// Connect to MQTT broker
client.on('connect', () => {
  console.log('Connected to MQTT broker');

  // Subscribe to LED status topic
  client.subscribe(LED_STATUS_TOPIC, (err) => {
    if (!err) {
      console.log(`Subscribed to ${LED_STATUS_TOPIC}`);
      client.publish(LED_STATUS_TOPIC, JSON.stringify(ledState), { retain: true });

      // Publish initial LED state
      // publishLedState();
    }
  });
});

// Handle MQTT messages
client.on('message', (topic, message) => {
  console.log(`Message received on topic ${topic}: ${message.toString()}`);

  // if (topic === LED_STATUS_TOPIC) {
  //   try {
  //     const data = JSON.parse(message.toString());
  //     if (typeof data.status === 'boolean') {
  //       ledState.status = data.status;
  //       console.log('LED state updated via MQTT:', ledState.status);
  //     }
  //   } catch (error) {
  //     console.error('Error parsing MQTT message:', error);
  //   }
  // }
});

// Publish LED state to MQTT
function publishLedState() {
  client.publish(LED_STATUS_TOPIC, JSON.stringify(ledState), { retain: true });
}

// API endpoints
app.get('/api/led', (req, res) => {
  res.json(ledState);
});

app.post('/api/led', (req, res) => {
  const { status } = req.body;
  if (typeof status === 'boolean') {
    ledState.status = status;

    // Publish command to MQTT
    client.publish(LED_COMMAND_TOPIC, JSON.stringify({ status }));

    res.json(ledState);
  } else {
    res.status(400).json({ error: 'Invalid status value' });
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 