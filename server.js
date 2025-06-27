import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import mqtt from 'mqtt';
import { PrismaClient } from '@prisma/client';


const prisma = new PrismaClient();
const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);

const mqttUri = (process.env.MQTT_URI || 'wss://gd1f212e.ala.asia-southeast1.emqxsl.com:8084/mqtt');

const clientId = 'server_side'
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
const TEMP_SENSOR_TOPIC = 'tempSensorData';
const SOIL_MOISTURE_TOPIC = 'soilMoistureData';
const WATER_LEVEL_TOPIC = 'waterLevelData';
const ESP_CONNECTED_TOPIC = 'espConnected';

let tempSensorData = '';
let soilMoistureData = '';
let waterLevelData = '';
let espConnected = 'false';

async function saveDataToDatabase() {
  try {
    if (tempSensorData && soilMoistureData && waterLevelData) {
      console.log('Saving data to database');
      await prisma.sensorsData.create({
        data: { temperature: tempSensorData, soilMoisture: soilMoistureData, waterLevel: waterLevelData }
      });
      tempSensorData = '';
      soilMoistureData = '';
      waterLevelData = '';
      console.log('Data saved to database');
    }
    else {
      console.log('Data not saved to database');
      return;
    }
  } catch (error) {
    console.error('Error saving data to database:', error);
  }
}

async function getLimit() {
  const limit = await prisma.limit.findUnique({
    where: {
      id: 1
    }
  });
  return limit;
}

// Connect to MQTT broker
client.on('connect', () => {
  console.log('Connected to MQTT broker');

  // Subscribe to sensor data topics
  client.subscribe(TEMP_SENSOR_TOPIC, (err) => {
    if (!err) console.log(`Subscribed to ${TEMP_SENSOR_TOPIC}`);
  });

  client.subscribe(SOIL_MOISTURE_TOPIC, (err) => {
    if (!err) console.log(`Subscribed to ${SOIL_MOISTURE_TOPIC}`);
  });

  client.subscribe(WATER_LEVEL_TOPIC, (err) => {
    if (!err) console.log(`Subscribed to ${WATER_LEVEL_TOPIC}`);
  });

  client.subscribe(ESP_CONNECTED_TOPIC, (err) => {
    if (!err) console.log(`Subscribed to ${ESP_CONNECTED_TOPIC}`);
  });
});

// Handle MQTT messages
client.on('message', async (topic, message) => {
  console.log(`Message received on topic ${topic}: ${message.toString()}`);

  if (topic === TEMP_SENSOR_TOPIC) {
    tempSensorData = message.toString();
    saveDataToDatabase();
  }

  if (topic === SOIL_MOISTURE_TOPIC) {
    soilMoistureData = message.toString();
    saveDataToDatabase();
  }

  if (topic === WATER_LEVEL_TOPIC) {
    waterLevelData = message.toString();
    saveDataToDatabase();
  }

  if (topic === ESP_CONNECTED_TOPIC) {
    espConnected = message.toString();
    if (espConnected === 'true') {
      const limit = await getLimit();
      client.publish('soilMoistureUpperLimit', limit.soilMoistureUpperLimit.toString());
      client.publish('soilMoistureLowerLimit', limit.soilMoistureLowerLimit.toString());
      client.publish('waterLevelLimit', limit.waterLevelLimit.toString());
    }
  }
});

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

// API endpoint to get sensor data
app.get('/api/sensor-data', async (req, res) => {
  try {
    const [latestTemp, latestMoisture, latestWaterLevel] = await Promise.all([
      prisma.temperatureSensor.findFirst({
        orderBy: { timestamp: 'desc' }
      }),
      prisma.soilMoistureSensor.findFirst({
        orderBy: { timestamp: 'desc' }
      }),
      prisma.waterLevelSensor.findFirst({
        orderBy: { timestamp: 'desc' }
      })
    ]);

    res.json({
      temperature: latestTemp,
      soilMoisture: latestMoisture,
      waterLevel: latestWaterLevel
    });
  } catch (error) {
    console.error('Error fetching sensor data:', error);
    res.status(500).json({ error: 'Failed to fetch sensor data' });
  }
});

// Error handling for Prisma
prisma.$on('error', (e) => {
  console.error('Prisma error:', e);
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
}); 