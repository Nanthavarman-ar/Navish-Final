// server.js
// Simple signaling server using socket.io and an optional HTTP interface.
// Usage: node server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { helmet, csrfProtection, sanitizeInput } = require('./middleware/security');
const app = express();
const server = http.createServer(app);

// Security middleware
app.use(helmet);
app.use(express.json({ limit: '10mb' }));
app.use(sanitizeInput);
app.use(csrfProtection);

// socket.io for signalling
const io = new Server(server, {
  cors: { origin: '*' },
  pingTimeout: 30000,
});

const PORT = process.env.PORT || 3004;

// In-memory room / presence (simple)
const rooms = new Map(); // roomId -> Set(socket.id)

// In-memory scene state per room for persistence
const sceneStates = new Map(); // roomId -> { objects: [], timestamp: number }

// User session management
const userSessions = new Map(); // socketId -> { userId, username, room, joinedAt, lastActivity }
const roomUsers = new Map(); // roomId -> Map(userId -> sessionInfo)

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
    // payload: { room, id, transform }
    const { room = 'default' } = payload;
    socket.to(room).emit('transform', payload);
  });

  socket.on('cursor', (payload) => {
    // payload: { room, id, point: {x,y,z} | null, meshName }
    const { room = 'default' } = payload;
    socket.to(room).emit('cursor', payload);
  });

  socket.on('chat', (payload) => {
    // payload: { room, id, name, text, timestamp }
    const { room = 'default' } = payload;
    io.to(room).emit('chat', payload); // echo to sender too, so their own message appears
  });

  socket.on('anim', (payload) => {
    const { room = 'default' } = payload;
    socket.to(room).emit('anim', payload);
  });

  socket.on('object-sync', (event) => {
    // Update scene state for the room
    const room = event.room || 'default';
    let sceneState = sceneStates.get(room);
    if (!sceneState) {
      sceneState = { objects: [], timestamp: 0 };
      sceneStates.set(room, sceneState);
    }

    // Update or add object based on event type
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

    // Broadcast to others in room
    socket.to(room).emit('object-sync', event);
  });

  socket.on('request-scene-sync', ({ room = 'default' }) => {
    const sceneState = sceneStates.get(room);
    if (sceneState) {
      socket.emit('scene-sync', sceneState);
    }
  });

  socket.on('signal', ({ to, data }) => {
    // forward signaling message to `to` socket id
    if (!to) return;
    io.to(to).emit('signal', { from: socket.id, data });
  });

  socket.on('disconnect', () => {
    // Clean up user session
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

    // broadcast user-left to all rooms
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

// Optional minimal HTTP endpoints for STT/TTS proxy (the stt_tts service should handle heavy work).
// This server can proxy requests if you want to centralize endpoints, but in our docker-compose the stt_tts service will be separate.
app.get('/', (req, res) => res.send('Signaling server is running'));
server.listen(PORT, () => console.log(`Signaling server listening on ${PORT}`));
