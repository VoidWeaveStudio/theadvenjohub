const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Комнаты игроков
const rooms = new Map();
const MAX_PLAYERS_PER_ROOM = 10;

// Генерация ID комнаты
function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Найти свободную комнату
function findAvailableRoom() {
  for (const [roomId, room] of rooms.entries()) {
    if (room.players.length < MAX_PLAYERS_PER_ROOM) {
      return roomId;
    }
  }
  return null;
}

// Создать новую комнату
function createRoom() {
  const roomId = generateRoomId();
  rooms.set(roomId, {
    players: [],
    createdAt: Date.now()
  });
  console.log(`Room created: ${roomId}`);
  return roomId;
}

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Присоединение к комнате
  socket.on('joinRoom', (data) => {
    let roomId = findAvailableRoom();
    
    if (!roomId) {
      roomId = createRoom();
    }

    const room = rooms.get(roomId);
    
    // Определяем команду
    const team1Count = room.players.filter(p => p.team === 1).length;
    const team2Count = room.players.filter(p => p.team === 2).length;
    const team = team1Count <= team2Count ? 1 : 2;

    const player = {
      id: socket.id,
      wallet: data.wallet,
      username: data.username || `Player_${socket.id.substring(0, 4)}`,
      team: team,
      position: { x: team === 1 ? -20 : 20, y: 1, z: 0 },
      rotation: { x: 0, y: team === 1 ? 0 : Math.PI, z: 0 },
      health: 100,
      kills: 0,
      deaths: 0,
      isAlive: true
    };

    room.players.push(player);
    socket.join(roomId);
    socket.roomId = roomId;

    console.log(`Player ${player.username} joined room ${roomId} (Team ${team})`);

    // Отправить текущее состояние комнаты
    socket.emit('roomJoined', {
      roomId: roomId,
      player: player,
      players: room.players
    });

    // Уведомить других игроков
    socket.to(roomId).emit('playerJoined', player);
  });

  // Движение игрока
  socket.on('playerMove', (data) => {
    if (!socket.roomId) return;
    
    const room = rooms.get(socket.roomId);
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    player.position = data.position;
    player.rotation = data.rotation;

    socket.to(socket.roomId).emit('playerMoved', {
      id: socket.id,
      position: data.position,
      rotation: data.rotation
    });
  });

  // Стрельба
  socket.on('shoot', (data) => {
    if (!socket.roomId) return;
    
    const room = rooms.get(socket.roomId);
    if (!room) return;

    const shooter = room.players.find(p => p.id === socket.id);
    if (!shooter || !shooter.isAlive) return;

    // Проверка попадания (клиент-авторитетная)
    const hitPlayer = room.players.find(p => p.id === data.targetId);
    
    if (hitPlayer && hitPlayer.isAlive && hitPlayer.team !== shooter.team) {
      hitPlayer.health -= data.damage || 25;
      
      if (hitPlayer.health <= 0) {
        hitPlayer.health = 0;
        hitPlayer.isAlive = false;
        hitPlayer.deaths++;
        shooter.kills++;

        io.to(socket.roomId).emit('playerKilled', {
          killerId: shooter.id,
          killerName: shooter.username,
          victimId: hitPlayer.id,
          victimName: hitPlayer.username
        });

        // Респавн через 3 секунды
        setTimeout(() => {
          hitPlayer.health = 100;
          hitPlayer.isAlive = true;
          hitPlayer.position = { 
            x: hitPlayer.team === 1 ? -20 : 20, 
            y: 1, 
            z: Math.random() * 10 - 5 
          };

          io.to(socket.roomId).emit('playerRespawned', {
            id: hitPlayer.id,
            position: hitPlayer.position
          });
        }, 3000);
      }

      io.to(socket.roomId).emit('playerHit', {
        targetId: hitPlayer.id,
        damage: data.damage || 25,
        health: hitPlayer.health
      });
    }

    socket.to(socket.roomId).emit('playerShot', {
      shooterId: socket.id,
      origin: data.origin,
      direction: data.direction
    });
  });

  // Отключение
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    
    if (socket.roomId) {
      const room = rooms.get(socket.roomId);
      if (room) {
        room.players = room.players.filter(p => p.id !== socket.id);
        
        socket.to(socket.roomId).emit('playerLeft', socket.id);

        // Удалить пустую комнату
        if (room.players.length === 0) {
          rooms.delete(socket.roomId);
          console.log(`Room deleted: ${socket.roomId}`);
        }
      }
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    rooms: rooms.size,
    players: Array.from(rooms.values()).reduce((sum, room) => sum + room.players.length, 0)
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Game server running on port ${PORT}`);
});