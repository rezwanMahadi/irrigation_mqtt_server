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

let tempSensorData = '';
let soilMoistureData = '';
let waterLevelData = '';

async function saveDataToDatabase() {
  if (tempSensorData && soilMoistureData && waterLevelData) {
    await prisma.sensorsData.create({
      data: { temperature: tempSensorData, soilMoisture: soilMoistureData, waterLevel: waterLevelData }
    });
    tempSensorData = '';
    soilMoistureData = '';
    waterLevelData = '';
  }
  else {
    return;
  }
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
});

// Handle MQTT messages
client.on('message', async (topic, message) => {
  console.log(`Message received on topic ${topic}: ${message.toString()}`);
  
  if (topic === TEMP_SENSOR_TOPIC) {
    saveDataToDatabase();
  }
  
  if (topic === SOIL_MOISTURE_TOPIC) {
    saveDataToDatabase();
  }
  
  if (topic === WATER_LEVEL_TOPIC) {
    saveDataToDatabase();
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