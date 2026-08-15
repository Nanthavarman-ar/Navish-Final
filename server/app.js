const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const csrf = require('csurf');
const cookieParser = require('cookie-parser');

// Lazy load modules
let supabaseClient = null;
let iotService = null;

function getSupabaseClient() {
  if (!supabaseClient) {
    const { createClient } = require('@supabase/supabase-js');
    supabaseClient = createClient(
      process.env.SUPABASE_URL || 'your-supabase-url',
      process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key'
    );
  }
  return supabaseClient;
}

function getIoTServiceLazy() {
  if (!iotService) {
    const { getIoTService } = require('./iot_service');
    iotService = getIoTService();
  }
  return iotService;
}

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: '*' },
  pingTimeout: 30000,
});

// Import routes
const uploadRoutes = require('./routes/upload');

// Middleware
app.use(cors());
app.use(helmet());
app.use(morgan('combined'));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CSRF protection for state-changing operations
const csrfProtection = csrf({ cookie: true });

// In-memory storage (in production, use Redis or database)
const kvStore = new Map();
const userSessions = new Map();
const roomUsers = new Map();
const rooms = new Map();
const sceneStates = new Map();

// Helper function to verify admin access
async function verifyAdmin(req) {
  const accessToken = req.headers.authorization?.split(' ')[1];
  if (!accessToken) {
    return { error: 'No authorization token provided', user: null };
  }

  const supabase = getSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
  if (error || !user) {
    return { error: 'Invalid token', user: null };
  }

  // Check if user is admin from metadata or a dedicated table
  const userRole = user.user_metadata?.role || 'client';
  if (userRole !== 'admin') {
    return { error: 'Admin access required', user: null };
  }

  return { error: null, user };
}

// Helper function to verify any authenticated user
async function verifyUser(req) {
  const accessToken = req.headers.authorization?.split(' ')[1];
  if (!accessToken) {
    return { error: 'No authorization token provided', user: null };
  }

  const supabase = getSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
  if (error || !user) {
    return { error: 'Invalid token', user: null };
  }

  return { error: null, user };
}

// Helper function to log audit events
async function logAuditEvent(userId, username, action, target, details, ipAddress, userAgent) {
  try {
    const auditEvent = {
      user_id: userId,
      username,
      action,
      target,
      details,
      ip_address: ipAddress,
      user_agent: userAgent,
      timestamp: new Date().toISOString(),
      severity: action.includes('DELETE') ? 'warning' : action.includes('FAIL') ? 'error' : 'info'
    };

    kvStore.set(`audit_log:${Date.now()}:${userId}`, auditEvent);
    console.log('Audit event logged:', auditEvent);
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('client connected', socket.id);

  socket.on('join', ({ room = 'default', name, userId }) => {
    socket.join(room);
    socket.data.name = name || socket.id;
    socket.data.userId = userId || socket.id;

    if (!rooms.has(room)) rooms.set(room, new Set());
    rooms.get(room).add(socket.id);

    // User session management
    const sessionInfo = {
      userId: socket.data.userId,
      username: socket.data.name,
      room,
      joinedAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      socketId: socket.id
    };
    userSessions.set(socket.id, sessionInfo);

    if (!roomUsers.has(room)) {
      roomUsers.set(room, new Map());
    }
    roomUsers.get(room).set(socket.data.userId, sessionInfo);

    // announce presence to room
    socket.to(room).emit('presence', {
      id: socket.id,
      name: socket.data.name,
      userId: socket.data.userId
    });

    // send existing participants to new client
    const roomUserMap = roomUsers.get(room);
    const others = Array.from(roomUserMap?.values() || [])
      .filter(session => session.socketId !== socket.id)
      .map(session => ({
        id: session.socketId,
        name: session.username,
        userId: session.userId
      }));
    socket.emit('people', others);

    // Send current scene state to new client
    const sceneState = sceneStates.get(room);
    if (sceneState) {
      socket.emit('scene-sync', sceneState);
    }

    console.log(`${socket.data.name} (${socket.data.userId}) joined ${room}`);
  });

  socket.on('leave', ({ room = 'default' }) => {
    socket.leave(room);
    rooms.get(room)?.delete(socket.id);

    // Clean up user session
    const session = userSessions.get(socket.id);
    if (session) {
      const roomUserMap = roomUsers.get(room);
      if (roomUserMap) {
        roomUserMap.delete(session.userId);
        if (roomUserMap.size === 0) {
          roomUsers.delete(room);
        }
      }
      userSessions.delete(socket.id);
    }

    socket.to(room).emit('user-left', {
      id: socket.id,
      userId: session?.userId
    });
  });

  socket.on('transform', (payload) => {
    const { room = 'default' } = payload;
    socket.to(room).emit('transform', payload);
  });

  socket.on('anim', (payload) => {
    const { room = 'default' } = payload;
    socket.to(room).emit('anim', payload);
  });

  socket.on('object-sync', (event) => {
    const room = event.room || 'default';
    let sceneState = sceneStates.get(room);
    if (!sceneState) {
      sceneState = { objects: [], timestamp: 0 };
      sceneStates.set(room, sceneState);
    }

    switch (event.type) {
      case 'create':
        sceneState.objects.push(event.data);
        break;
      case 'update':
      case 'transform':
      case 'material':
      case 'animation':
        const index = sceneState.objects.findIndex(obj => obj.id === event.objectId);
        if (index !== -1) {
          sceneState.objects[index] = { ...sceneState.objects[index], ...event.data };
        }
        break;
      case 'delete':
        sceneState.objects = sceneState.objects.filter(obj => obj.id !== event.objectId);
        break;
    }

    sceneState.timestamp = Date.now();
    socket.to(room).emit('object-sync', event);
  });

  socket.on('request-scene-sync', ({ room = 'default' }) => {
    const sceneState = sceneStates.get(room);
    if (sceneState) {
      socket.emit('scene-sync', sceneState);
    }
  });

  socket.on('signal', ({ to, data }) => {
    if (!to) return;
    io.to(to).emit('signal', { from: socket.id, data });
  });

  socket.on('disconnect', () => {
    const session = userSessions.get(socket.id);
    if (session) {
      const roomUserMap = roomUsers.get(session.room);
      if (roomUserMap) {
        roomUserMap.delete(session.userId);
        if (roomUserMap.size === 0) {
          roomUsers.delete(session.room);
        }
      }
      userSessions.delete(socket.id);
    }

    for (const [room, set] of rooms.entries()) {
      if (set.has(socket.id)) {
        set.delete(socket.id);
        socket.to(room).emit('user-left', {
          id: socket.id,
          userId: session?.userId
        });
      }
    }
    console.log('client disconnected', socket.id);
  });
});

// Routes
app.use('/api/upload', uploadRoutes);
const skp2gltfRoutes = require('./routes/skp2gltf');
app.use('/api/convert/skp2gltf', skp2gltfRoutes);

// Health check
app.get('/make-server-cf230d31/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Scene persistence endpoints
app.post('/api/scenes/:roomId', csrfProtection, async (req, res) => {
  const { error, user } = await verifyUser(req);

  if (error) {
    return res.status(401).json({ error });
  }

  try {
    const roomId = req.params.roomId;
    const { sceneData, thumbnail } = req.body;

    const sceneKey = `scene:${roomId}`;
    const sceneInfo = {
      id: roomId,
      data: sceneData,
      thumbnail,
      lastModified: new Date().toISOString(),
      lastModifiedBy: user.id,
      lastModifiedByUsername: user.user_metadata?.username || user.email,
      version: Date.now()
    };

    kvStore.set(sceneKey, sceneInfo);

    await logAuditEvent(
      user.id,
      user.user_metadata?.username || user.email,
      'SCENE_SAVED',
      roomId,
      `Saved scene state for room: ${roomId}`,
      req.ip,
      req.get('user-agent') || 'unknown'
    );

    res.json({
      message: 'Scene saved successfully',
      scene: sceneInfo
    });

  } catch (error) {
    console.error('Scene save error:', error);
    res.status(500).json({ error: 'Failed to save scene' });
  }
});

// IoT API Endpoints

// Get all sensors
app.get('/api/iot/sensors', async (req, res) => {
  const { error, user } = await verifyUser(req);

  if (error) {
    return res.status(401).json({ error });
  }

  try {
    const iotService = getIoTServiceLazy();
    const sensors = iotService.getAllSensors();

    res.json({ sensors });

  } catch (error) {
    console.error('IoT sensors fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch sensors' });
  }
});

// Get all devices
app.get('/api/iot/devices', async (req, res) => {
  const { error, user } = await verifyUser(req);

  if (error) {
    return res.status(401).json({ error });
  }

  try {
    const iotService = getIoTServiceLazy();
    const devices = iotService.getAllDevices();

    res.json({ devices });

  } catch (error) {
    console.error('IoT devices fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

// Get sensor value
app.get('/api/iot/sensors/:sensorId', async (req, res) => {
  const { error, user } = await verifyUser(req);

  if (error) {
    return res.status(401).json({ error });
  }

  try {
    const sensorId = req.params.sensorId;
    const iotService = getIoTServiceLazy();
    const value = iotService.getSensorValue(sensorId);

    if (value === null) {
      return res.status(404).json({ error: 'Sensor not found' });
    }

    res.json({ sensorId, value });

  } catch (error) {
    console.error('IoT sensor value fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch sensor value' });
  }
});

// Control device
app.post('/api/iot/devices/:deviceId/control', csrfProtection, async (req, res) => {
  const { error, user } = await verifyUser(req);

  if (error) {
    return res.status(401).json({ error });
  }

  try {
    const deviceId = req.params.deviceId;
    const { command } = req.body;

    if (!['on', 'off', 'toggle'].includes(command)) {
      return res.status(400).json({ error: 'Invalid command' });
    }

    const iotService = getIoTServiceLazy();
    const success = await iotService.controlDevice(deviceId, command);

    if (!success) {
      return res.status(400).json({ error: 'Failed to control device' });
    }

    res.json({ message: 'Device controlled successfully', deviceId, command });

  } catch (error) {
    console.error('IoT device control error:', error);
    res.status(500).json({ error: 'Failed to control device' });
  }
});

// Get energy history
app.get('/api/iot/energy-history', async (req, res) => {
  const { error, user } = await verifyUser(req);

  if (error) {
    return res.status(401).json({ error });
  }

  try {
    const hours = parseInt(req.query.hours || '24');
    const iotService = getIoTService();
    const history = iotService.getEnergyHistory(hours);

    res.json({ history });

  } catch (error) {
    console.error('IoT energy history fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch energy history' });
  }
});

// Get sensor alerts
app.get('/api/iot/alerts', async (req, res) => {
  const { error, user } = await verifyUser(req);

  if (error) {
    return res.status(401).json({ error });
  }

  try {
    const iotService = getIoTService();
    const alerts = iotService.getSensorAlerts();

    res.json({ alerts });

  } catch (error) {
    console.error('IoT alerts fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// Get simulation status
app.get('/api/iot/simulation/status', async (req, res) => {
  const { error, user } = await verifyUser(req);

  if (error) {
    return res.status(401).json({ error });
  }

  try {
    const iotService = getIoTService();
    const status = iotService.getSimulationStatus();

    res.json({ status });

  } catch (error) {
    console.error('IoT simulation status fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch simulation status' });
  }
});

// Start simulation
app.post('/api/iot/simulation/start', csrfProtection, async (req, res) => {
  const { error, user } = await verifyUser(req);

  if (error) {
    return res.status(401).json({ error });
  }

  try {
    const iotService = getIoTService();
    iotService.startSimulation();

    res.json({ message: 'IoT simulation started' });

  } catch (error) {
    console.error('IoT simulation start error:', error);
    res.status(500).json({ error: 'Failed to start simulation' });
  }
});

// Stop simulation
app.post('/api/iot/simulation/stop', csrfProtection, async (req, res) => {
  const { error, user } = await verifyUser(req);

  if (error) {
    return res.status(401).json({ error });
  }

  try {
    const iotService = getIoTService();
    iotService.stopSimulation();

    res.json({ message: 'IoT simulation stopped' });

  } catch (error) {
    console.error('IoT simulation stop error:', error);
    res.status(500).json({ error: 'Failed to stop simulation' });
  }
});

// Update simulation config
app.put('/api/iot/simulation/config', csrfProtection, async (req, res) => {
  const { error, user } = await verifyUser(req);

  if (error) {
    return res.status(401).json({ error });
  }

  try {
    const config = req.body;
    const iotService = getIoTService();
    iotService.updateSimulationConfig(config);

    res.json({ message: 'Simulation config updated' });

  } catch (error) {
    console.error('IoT simulation config update error:', error);
    res.status(500).json({ error: 'Failed to update simulation config' });
  }
});

// Export IoT data
app.get('/api/iot/export', async (req, res) => {
  const { error, user } = await verifyUser(req);

  if (error) {
    return res.status(401).json({ error });
  }

  try {
    const iotService = getIoTService();
    const data = iotService.exportIoTData();

    res.json({ data });

  } catch (error) {
    console.error('IoT data export error:', error);
    res.status(500).json({ error: 'Failed to export IoT data' });
  }
});

// Simulate environmental conditions
app.post('/api/iot/environment/simulate', async (req, res) => {
  const { error, user } = await verifyUser(req);

  if (error) {
    return res.status(401).json({ error });
  }

  try {
    const iotService = getIoTService();
    const conditions = await iotService.simulateEnvironmentalConditions();

    res.json({ conditions });

  } catch (error) {
    console.error('IoT environmental simulation error:', error);
    res.status(500).json({ error: 'Failed to simulate environmental conditions' });
  }
});

// Create automation rule
app.post('/api/iot/automation/rules', async (req, res) => {
  const { error, user } = await verifyUser(req);

  if (error) {
    return res.status(401).json({ error });
  }

  try {
    const { trigger, action } = req.body;
    const iotService = getIoTService();
    const ruleId = await iotService.createAutomationRule(trigger, action);

    res.json({ message: 'Automation rule created', ruleId });

  } catch (error) {
    console.error('IoT automation rule creation error:', error);
    res.status(500).json({ error: 'Failed to create automation rule' });
  }
});

// Execute automation rule
app.post('/api/iot/automation/rules/:ruleId/execute', async (req, res) => {
  const { error, user } = await verifyUser(req);

  if (error) {
    return res.status(401).json({ error });
  }

  try {
    const ruleId = req.params.ruleId;
    const iotService = getIoTService();
    const success = await iotService.executeAutomationRule(ruleId);

    if (!success) {
      return res.status(404).json({ error: 'Rule not found or execution failed' });
    }

    res.json({ message: 'Automation rule executed successfully' });

  } catch (error) {
    console.error('IoT automation rule execution error:', error);
    res.status(500).json({ error: 'Failed to execute automation rule' });
  }
});

// Energy optimization
app.get('/api/iot/energy/optimize', async (req, res) => {
  const { error, user } = await verifyUser(req);

  if (error) {
    return res.status(401).json({ error });
  }

  try {
    const iotService = getIoTService();
    const optimization = await iotService.optimizeEnergyUsage();

    res.json({ optimization });

  } catch (error) {
    console.error('IoT energy optimization error:', error);
    res.status(500).json({ error: 'Failed to optimize energy usage' });
  }
});

// Predictive maintenance
app.get('/api/iot/maintenance/predict', async (req, res) => {
  const { error, user } = await verifyUser(req);

  if (error) {
    return res.status(401).json({ error });
  }

  try {
    const iotService = getIoTService();
    const predictions = await iotService.predictMaintenanceNeeds();

    res.json({ predictions });

  } catch (error) {
    console.error('IoT predictive maintenance error:', error);
    res.status(500).json({ error: 'Failed to predict maintenance needs' });
  }
});

// Create smart schedule
app.post('/api/iot/schedules', async (req, res) => {
  const { error, user } = await verifyUser(req);

  if (error) {
    return res.status(401).json({ error });
  }

  try {
    const { deviceId, schedule } = req.body;
    const iotService = getIoTService();
    const success = await iotService.createSmartSchedule(deviceId, schedule);

    if (!success) {
      return res.status(400).json({ error: 'Failed to create smart schedule' });
    }

    res.json({ message: 'Smart schedule created successfully' });

  } catch (error) {
    console.error('IoT smart schedule creation error:', error);
    res.status(500).json({ error: 'Failed to create smart schedule' });
  }
});

// Environmental impact analysis
app.get('/api/iot/environment/impact', async (req, res) => {
  const { error, user } = await verifyUser(req);

  if (error) {
    return res.status(401).json({ error });
  }

  try {
    const iotService = getIoTService();
    const impact = await iotService.calculateEnvironmentalImpact();

    res.json({ impact });

  } catch (error) {
    console.error('IoT environmental impact analysis error:', error);
    res.status(500).json({ error: 'Failed to calculate environmental impact' });
  }
});

// Add custom sensor
app.post('/api/iot/sensors', async (req, res) => {
  const { error, user } = await verifyUser(req);

  if (error) {
    return res.status(401).json({ error });
  }

  try {
    const sensor = req.body;
    const iotService = getIoTService();
    iotService.addSensor(sensor);

    res.json({ message: 'Sensor added successfully' });

  } catch (error) {
    console.error('IoT sensor addition error:', error);
    res.status(500).json({ error: 'Failed to add sensor' });
  }
});

// Add custom device
app.post('/api/iot/devices', async (req, res) => {
  const { error, user } = await verifyUser(req);

  if (error) {
    return res.status(401).json({ error });
  }

  try {
    const device = req.body;
    const iotService = getIoTService();
    iotService.addDevice(device);

    res.json({ message: 'Device added successfully' });

  } catch (error) {
    console.error('IoT device addition error:', error);
    res.status(500).json({ error: 'Failed to add device' });
  }
});

// Food Expiry Tracking API Endpoints

// Get all food items
app.get('/api/food-items', async (req, res) => {
  const { error, user } = await verifyUser(req);

  if (error) {
    return res.status(401).json({ error });
  }

  try {
    const foodItemsKey = `food_items:${user.id}`;
    const foodItems = JSON.parse(kvStore.get(foodItemsKey) || '[]');

    res.json({ foodItems });

  } catch (error) {
    console.error('Food items fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch food items' });
  }
});

// Add food item
app.post('/api/food-items', async (req, res) => {
  const { error, user } = await verifyUser(req);

  if (error) {
    return res.status(401).json({ error });
  }

  try {
    const foodItem = req.body;
    const foodItemsKey = `food_items:${user.id}`;
    const existingItems = JSON.parse(kvStore.get(foodItemsKey) || '[]');

    const newItem = {
      id: `food_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...foodItem,
      userId: user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    existingItems.push(newItem);
    kvStore.set(foodItemsKey, JSON.stringify(existingItems));

    await logAuditEvent(
      user.id,
      user.user_metadata?.username || user.email,
      'FOOD_ITEM_ADDED',
      newItem.id,
      `Added food item: ${newItem.name}`,
      req.ip,
      req.get('user-agent') || 'unknown'
    );

    res.json({ message: 'Food item added successfully', foodItem: newItem });

  } catch (error) {
    console.error('Food item addition error:', error);
    res.status(500).json({ error: 'Failed to add food item' });
  }
});

// Update food item
app.put('/api/food-items/:itemId', async (req, res) => {
  const { error, user } = await verifyUser(req);

  if (error) {
    return res.status(401).json({ error });
  }

  try {
    const itemId = req.params.itemId;
    const updates = req.body;
    const foodItemsKey = `food_items:${user.id}`;
    const existingItems = JSON.parse(kvStore.get(foodItemsKey) || '[]');

    const itemIndex = existingItems.findIndex(item => item.id === itemId && item.userId === user.id);

    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Food item not found' });
    }

    existingItems[itemIndex] = {
      ...existingItems[itemIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    kvStore.set(foodItemsKey, JSON.stringify(existingItems));

    await logAuditEvent(
      user.id,
      user.user_metadata?.username || user.email,
      'FOOD_ITEM_UPDATED',
      itemId,
      `Updated food item: ${existingItems[itemIndex].name}`,
      req.ip,
      req.get('user-agent') || 'unknown'
    );

    res.json({ message: 'Food item updated successfully', foodItem: existingItems[itemIndex] });

  } catch (error) {
    console.error('Food item update error:', error);
    res.status(500).json({ error: 'Failed to update food item' });
  }
});

// Delete food item
app.delete('/api/food-items/:itemId', async (req, res) => {
  const { error, user } = await verifyUser(req);

  if (error) {
    return res.status(401).json({ error });
  }

  try {
    const itemId = req.params.itemId;
    const foodItemsKey = `food_items:${user.id}`;
    const existingItems = JSON.parse(kvStore.get(foodItemsKey) || '[]');

    const itemIndex = existingItems.findIndex(item => item.id === itemId && item.userId === user.id);

    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Food item not found' });
    }

    const deletedItem = existingItems.splice(itemIndex, 1)[0];
    kvStore.set(foodItemsKey, JSON.stringify(existingItems));

    await logAuditEvent(
      user.id,
      user.user_metadata?.username || user.email,
      'FOOD_ITEM_DELETED',
      itemId,
      `Deleted food item: ${deletedItem.name}`,
      req.ip,
      req.get('user-agent') || 'unknown'
    );

    res.json({ message: 'Food item deleted successfully' });

  } catch (error) {
    console.error('Food item deletion error:', error);
    res.status(500).json({ error: 'Failed to delete food item' });
  }
});

// Get expiring soon items
app.get('/api/food-items/expiring-soon', async (req, res) => {
  const { error, user } = await verifyUser(req);

  if (error) {
    return res.status(401).json({ error });
  }

  try {
    const days = parseInt(req.query.days || '3');
    const foodItemsKey = `food_items:${user.id}`;
    const existingItems = JSON.parse(kvStore.get(foodItemsKey) || '[]');

    const today = new Date();
    const expiringSoonDate = new Date();
    expiringSoonDate.setDate(today.getDate() + days);

    const expiringSoonItems = existingItems.filter(item => {
      const expiryDate = new Date(item.expiryDate);
      return expiryDate >= today && expiryDate <= expiringSoonDate && item.status !== 'consumed';
    });

    res.json({ expiringSoonItems, days });

  } catch (error) {
    console.error('Expiring soon items fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch expiring soon items' });
  }
});

// Get expired items
app.get('/api/food-items/expired', async (req, res) => {
  const { error, user } = await verifyUser(req);

  if (error) {
    return res.status(401).json({ error });
  }

  try {
    const foodItemsKey = `food_items:${user.id}`;
    const existingItems = JSON.parse(kvStore.get(foodItemsKey) || '[]');

    const today = new Date();
    const expiredItems = existingItems.filter(item => {
      const expiryDate = new Date(item.expiryDate);
      return expiryDate < today && item.status !== 'consumed';
    });

    res.json({ expiredItems });

  } catch (error) {
    console.error('Expired items fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch expired items' });
  }
});

// Bulk update food items
app.put('/api/food-items/bulk-update', async (req, res) => {
  const { error, user } = await verifyUser(req);

  if (error) {
    return res.status(401).json({ error });
  }

  try {
    const { updates } = req.body; // Array of { id, updates } objects
    const foodItemsKey = `food_items:${user.id}`;
    const existingItems = JSON.parse(kvStore.get(foodItemsKey) || '[]');

    let updatedCount = 0;
    updates.forEach(({ id, updates: itemUpdates }) => {
      const itemIndex = existingItems.findIndex(item => item.id === id && item.userId === user.id);
      if (itemIndex !== -1) {
        existingItems[itemIndex] = {
          ...existingItems[itemIndex],
          ...itemUpdates,
          updatedAt: new Date().toISOString()
        };
        updatedCount++;
      }
    });

    if (updatedCount > 0) {
      kvStore.set(foodItemsKey, JSON.stringify(existingItems));
    }

    res.json({
      message: 'Bulk update completed',
      updatedCount,
      totalCount: updates.length
    });

  } catch (error) {
    console.error('Bulk update error:', error);
    res.status(500).json({ error: 'Failed to perform bulk update' });
  }
});

// Get food items by category
app.get('/api/food-items/category/:category', async (req, res) => {
  const { error, user } = await verifyUser(req);

  if (error) {
    return res.status(401).json({ error });
  }

  try {
    const category = req.params.category;
    const foodItemsKey = `food_items:${user.id}`;
    const existingItems = JSON.parse(kvStore.get(foodItemsKey) || '[]');

    const categoryItems = existingItems.filter(item => item.category === category);

    res.json({ categoryItems, category });

  } catch (error) {
    console.error('Category items fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch category items' });
  }
});

// Get food items by storage location
app.get('/api/food-items/location/:location', async (req, res) => {
  const { error, user } = await verifyUser(req);

  if (error) {
    return res.status(401).json({ error });
  }

  try {
    const location = req.params.location;
    const foodItemsKey = `food_items:${user.id}`;
    const existingItems = JSON.parse(kvStore.get(foodItemsKey) || '[]');

    const locationItems = existingItems.filter(item => item.storageLocation === location);

    res.json({ locationItems, location });

  } catch (error) {
    console.error('Location items fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch location items' });
  }
});

// Get food statistics
app.get('/api/food-items/statistics', async (req, res) => {
  const { error, user } = await verifyUser(req);

  if (error) {
    return res.status(401).json({ error });
  }

  try {
    const foodItemsKey = `food_items:${user.id}`;
    const existingItems = JSON.parse(kvStore.get(foodItemsKey) || '[]');

    const today = new Date();
    const stats = {
      total: existingItems.length,
      fresh: 0,
      expiringSoon: 0,
      expired: 0,
      consumed: 0,
      byCategory: {},
      byLocation: {},
      expiringInNext7Days: 0
    };

    existingItems.forEach(item => {
      const expiryDate = new Date(item.expiryDate);
      const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));

      if (item.status === 'consumed') {
        stats.consumed++;
      } else if (expiryDate < today) {
        stats.expired++;
      } else if (daysUntilExpiry <= 3) {
        stats.expiringSoon++;
      } else {
        stats.fresh++;
      }

      // Category stats
      stats.byCategory[item.category] = (stats.byCategory[item.category] || 0) + 1;

      // Location stats
      stats.byLocation[item.storageLocation] = (stats.byLocation[item.storageLocation] || 0) + 1;

      // Expiring in next 7 days
      if (daysUntilExpiry <= 7 && daysUntilExpiry > 0) {
        stats.expiringInNext7Days++;
      }
    });

    res.json({ statistics: stats });

  } catch (error) {
    console.error('Food statistics fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch food statistics' });
  }
});

// Export food items
app.get('/api/food-items/export', async (req, res) => {
  const { error, user } = await verifyUser(req);

  if (error) {
    return res.status(401).json({ error });
  }

  try {
    const foodItemsKey = `food_items:${user.id}`;
    const existingItems = JSON.parse(kvStore.get(foodItemsKey) || '[]');

    const exportData = {
      userId: user.id,
      exportDate: new Date().toISOString(),
      totalItems: existingItems.length,
      items: existingItems
    };

    res.json({ exportData });

  } catch (error) {
    console.error('Food items export error:', error);
    res.status(500).json({ error: 'Failed to export food items' });
  }
});

// Import food items
app.post('/api/food-items/import', async (req, res) => {
  const { error, user } = await verifyUser(req);

  if (error) {
    return res.status(401).json({ error });
  }

  try {
    const { items } = req.body;
    const foodItemsKey = `food_items:${user.id}`;
    const existingItems = JSON.parse(kvStore.get(foodItemsKey) || '[]');

    // Add userId and timestamps to imported items
    const importedItems = items.map(item => ({
      ...item,
      id: `food_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));

    const updatedItems = [...existingItems, ...importedItems];
    kvStore.set(foodItemsKey, JSON.stringify(updatedItems));

    await logAuditEvent(
      user.id,
      user.user_metadata?.username || user.email,
      'FOOD_ITEMS_IMPORTED',
      'bulk_import',
      `Imported ${importedItems.length} food items`,
      req.ip,
      req.get('user-agent') || 'unknown'
    );

    res.json({
      message: 'Food items imported successfully',
      importedCount: importedItems.length,
      totalCount: updatedItems.length
    });

  } catch (error) {
    console.error('Food items import error:', error);
    res.status(500).json({ error: 'Failed to import food items' });
  }
});

// Remove sensor
app.delete('/api/iot/sensors/:sensorId', async (req, res) => {
  const { error, user } = await verifyUser(req);

  if (error) {
    return res.status(401).json({ error });
  }

  try {
    const sensorId = req.params.sensorId;
    const iotService = getIoTService();
    const success = iotService.removeSensor(sensorId);

    if (!success) {
      return res.status(404).json({ error: 'Sensor not found' });
    }

    res.json({ message: 'Sensor removed successfully' });

  } catch (error) {
    console.error('IoT sensor removal error:', error);
    res.status(500).json({ error: 'Failed to remove sensor' });
  }
});

// Remove device
app.delete('/api/iot/devices/:deviceId', async (req, res) => {
  const { error, user } = await verifyUser(req);

  if (error) {
    return res.status(401).json({ error });
  }

  try {
    const deviceId = req.params.deviceId;
    const iotService = getIoTService();
    const success = iotService.removeDevice(deviceId);

    if (!success) {
      return res.status(404).json({ error: 'Device not found' });
    }

    res.json({ message: 'Device removed successfully' });

  } catch (error) {
    console.error('IoT device removal error:', error);
    res.status(500).json({ error: 'Failed to remove device' });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`IoT Server listening on port ${PORT}`);
});

module.exports = { app, server, io };
