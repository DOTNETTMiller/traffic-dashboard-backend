/**
 * V2X Message Consumer for ITS JPO ODE
 *
 * Consumes V2X messages from Kafka topics published by the ODE platform
 * and processes them for the DOT Corridor Communicator.
 *
 * Supported Message Types:
 * - BSM (Basic Safety Message) - Vehicle position, speed, heading
 * - TIM (Traveler Information Message) - Road conditions, incidents, advisories
 * - SPaT (Signal Phase and Timing) - Traffic signal status
 * - MAP (Map Data) - Intersection geometry
 */

const { Kafka } = require('kafkajs');
const axios = require('axios');

// Configuration
const KAFKA_BROKER = process.env.KAFKA_BROKER || 'kafka:29092';
const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://backend:3001';
const CONSUMER_GROUP = process.env.CONSUMER_GROUP || 'v2x-consumer-group';

// ODE Kafka Topics (standard topic names from jpo-ode)
const TOPICS = {
  BSM: 'topic.OdeBsmJson',
  TIM: 'topic.OdeTimJson',
  SPAT: 'topic.OdeSpatJson',
  MAP: 'topic.OdeMapJson',
  PSM: 'topic.OdePsmJson',
  SSM: 'topic.OdeSsmJson',
  SRM: 'topic.OdeSrmJson'
};

// Initialize Kafka client
const kafka = new Kafka({
  clientId: 'v2x-consumer',
  brokers: [KAFKA_BROKER],
  retry: {
    initialRetryTime: 100,
    retries: 8
  }
});

const consumer = kafka.consumer({
  groupId: CONSUMER_GROUP,
  sessionTimeout: 30000,
  heartbeatInterval: 3000
});

// Message processors for different V2X message types
const messageProcessors = {

  /**
   * Process Basic Safety Message (BSM)
   * Contains vehicle position, speed, heading, and status
   */
  processBSM: async (message) => {
    try {
      const data = JSON.parse(message.value.toString());
      const payload = data.payload;

      if (!payload || !payload.data) {
        console.log('Invalid BSM payload');
        return;
      }

      const coreData = payload.data.coreData;
      const bsmData = {
        messageType: 'BSM',
        timestamp: data.metadata.odeReceivedAt || new Date().toISOString(),
        temporaryId: coreData.id,
        latitude: coreData.lat,
        longitude: coreData.long,
        elevation: coreData.elev,
        speed: coreData.speed,
        heading: coreData.heading,
        accuracy: {
          semiMajor: coreData.accuracy?.semiMajor,
          semiMinor: coreData.accuracy?.semiMinor
        },
        transmission: coreData.transmission,
        brakeStatus: coreData.brakes,
        vehicleSize: coreData.size
      };

      // Send to backend API for storage/processing
      await sendToBackend('/api/v2x/bsm', bsmData);
      console.log(`✓ Processed BSM from vehicle ${bsmData.temporaryId}`);

    } catch (error) {
      console.error('Error processing BSM:', error.message);
    }
  },

  /**
   * Process Traveler Information Message (TIM)
   * Contains road conditions, incidents, advisories
   */
  processTIM: async (message) => {
    try {
      const data = JSON.parse(message.value.toString());
      const payload = data.payload;

      if (!payload || !payload.data) {
        console.log('Invalid TIM payload');
        return;
      }

      const timData = {
        messageType: 'TIM',
        timestamp: data.metadata.odeReceivedAt || new Date().toISOString(),
        msgId: payload.data.msgId,
        frameType: payload.data.dataframes?.[0]?.frameType,
        startTime: payload.data.dataframes?.[0]?.startTime,
        durationTime: payload.data.dataframes?.[0]?.durationTime,
        priority: payload.data.dataframes?.[0]?.priority,
        regions: payload.data.dataframes?.[0]?.regions || [],
        content: payload.data.dataframes?.[0]?.content,
        sspTimRights: payload.data.dataframes?.[0]?.sspTimRights
      };

      await sendToBackend('/api/v2x/tim', timData);
      console.log(`✓ Processed TIM message ${timData.msgId}`);

    } catch (error) {
      console.error('Error processing TIM:', error.message);
    }
  },

  /**
   * Process Signal Phase and Timing (SPaT)
   * Contains traffic signal status and timing
   */
  processSPaT: async (message) => {
    try {
      const data = JSON.parse(message.value.toString());
      const payload = data.payload;

      if (!payload || !payload.data) {
        console.log('Invalid SPaT payload');
        return;
      }

      const intersections = payload.data.intersections || [];

      for (const intersection of intersections) {
        const spatData = {
          messageType: 'SPaT',
          timestamp: data.metadata.odeReceivedAt || new Date().toISOString(),
          intersectionId: intersection.id,
          status: intersection.status,
          moy: intersection.moy,
          timeStamp: intersection.timeStamp,
          states: intersection.states?.movementList || []
        };

        await sendToBackend('/api/v2x/spat', spatData);
        console.log(`✓ Processed SPaT for intersection ${spatData.intersectionId}`);
      }

    } catch (error) {
      console.error('Error processing SPaT:', error.message);
    }
  },

  /**
   * Process MAP Data
   * Contains intersection geometry and lane configuration
   */
  processMAP: async (message) => {
    try {
      const data = JSON.parse(message.value.toString());
      const payload = data.payload;

      if (!payload || !payload.data) {
        console.log('Invalid MAP payload');
        return;
      }

      const intersections = payload.data.intersections || [];

      for (const intersection of intersections) {
        const mapData = {
          messageType: 'MAP',
          timestamp: data.metadata.odeReceivedAt || new Date().toISOString(),
          intersectionId: intersection.id,
          refPoint: intersection.refPoint,
          laneWidth: intersection.laneWidth,
          speedLimits: intersection.speedLimits,
          laneSet: intersection.laneSet || []
        };

        await sendToBackend('/api/v2x/map', mapData);
        console.log(`✓ Processed MAP for intersection ${mapData.intersectionId}`);
      }

    } catch (error) {
      console.error('Error processing MAP:', error.message);
    }
  }
};

/**
 * Send processed V2X data to backend API
 */
async function sendToBackend(endpoint, data) {
  try {
    await axios.post(`${BACKEND_API_URL}${endpoint}`, data, {
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    // Log error but don't crash - backend might be temporarily unavailable
    if (error.code === 'ECONNREFUSED') {
      console.error('Backend API unavailable:', endpoint);
    } else {
      console.error('Error sending to backend:', error.message);
    }
  }
}

/**
 * Main message handler
 */
async function handleMessage(topic, message) {
  const topicName = topic.split('.').pop(); // Extract message type from topic name

  switch(topic) {
    case TOPICS.BSM:
      await messageProcessors.processBSM(message);
      break;
    case TOPICS.TIM:
      await messageProcessors.processTIM(message);
      break;
    case TOPICS.SPAT:
      await messageProcessors.processSPaT(message);
      break;
    case TOPICS.MAP:
      await messageProcessors.processMAP(message);
      break;
    default:
      console.log(`Received message from unknown topic: ${topic}`);
  }
}

/**
 * Start the consumer
 */
async function start() {
  console.log('🚀 Starting V2X Consumer Service...\n');
  console.log(`Kafka Broker: ${KAFKA_BROKER}`);
  console.log(`Backend API: ${BACKEND_API_URL}`);
  console.log(`Consumer Group: ${CONSUMER_GROUP}\n`);

  try {
    // Connect to Kafka
    await consumer.connect();
    console.log('✓ Connected to Kafka broker\n');

    // Subscribe to all V2X topics
    const subscribedTopics = [
      TOPICS.BSM,
      TOPICS.TIM,
      TOPICS.SPAT,
      TOPICS.MAP
    ];

    for (const topic of subscribedTopics) {
      await consumer.subscribe({
        topic,
        fromBeginning: false // Only consume new messages
      });
      console.log(`✓ Subscribed to ${topic}`);
    }

    console.log('\n📡 Listening for V2X messages...\n');

    // Run the consumer
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        await handleMessage(topic, message);
      },
    });

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

/**
 * Graceful shutdown
 */
async function shutdown() {
  console.log('\n🛑 Shutting down V2X consumer...');
  try {
    await consumer.disconnect();
    console.log('✓ Consumer disconnected');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

// Handle shutdown signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start the consumer
start();
