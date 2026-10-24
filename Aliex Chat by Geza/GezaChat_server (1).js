const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const rooms = new Map();

function cleanRoomId(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || `room-${Date.now()}`;
}

function getRoomList() {
  return [...rooms.values()].map((room) => ({
    id: room.id,
    name: room.name,
    users: room.members.size,
  }));
}

function createOrGetRoom(roomName) {
  const roomId = cleanRoomId(roomName);

  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      id: roomId,
      name: roomName.trim(),
      members: new Set(),
      messages: [],
    });
  }

  return rooms.get(roomId);
}

function emitRoomList() {
  io.emit("room-list", getRoomList());
}

app.use(express.static(path.join(__dirname, "public")));

io.on("connection", (socket) => {
  socket.on("create-room", ({ name }) => {
    const roomName = String(name || "").trim();

    if (!roomName) {
      socket.emit("notice", { type: "error", text: "Nama grup wajib diisi." });
      return;
    }

    const room = createOrGetRoom(roomName);

    socket.join(room.id);

    if (socket.data.roomId && socket.data.roomId !== room.id) {
      const oldRoom = rooms.get(socket.data.roomId);
      if (oldRoom) {
        oldRoom.members.delete(socket.id);
      }
      socket.leave(socket.data.roomId);
    }

    room.members.add(socket.id);
    socket.data.roomId = room.id;
    socket.data.userName = socket.data.userName || "Anonymous";

    socket.emit("room-state", {
      roomId: room.id,
      roomName: room.name,
      messages: room.messages.slice(-50),
      users: room.members.size,
    });

    io.to(room.id).emit("room-users", {
      roomId: room.id,
      roomName: room.name,
      users: room.members.size,
    });

    emitRoomList();
  });

  socket.on("join-room", ({ roomId, userName }) => {
    const targetRoomId = String(roomId || "").trim();
    const name = String(userName || "").trim() || "Anonymous";

    const room = rooms.get(targetRoomId);

    if (!room) {
      socket.emit("notice", {
        type: "error",
        text: "Grup tidak ditemukan.",
      });
      return;
    }

    socket.join(room.id);

    if (socket.data.roomId && socket.data.roomId !== room.id) {
      const oldRoom = rooms.get(socket.data.roomId);
      if (oldRoom) {
        oldRoom.members.delete(socket.id);
      }
      socket.leave(socket.data.roomId);
    }

    room.members.add(socket.id);
    socket.data.roomId = room.id;
    socket.data.userName = name;

    socket.emit("room-state", {
      roomId: room.id,
      roomName: room.name,
      messages: room.messages.slice(-50),
      users: room.members.size,
    });

    io.to(room.id).emit("room-users", {
      roomId: room.id,
      roomName: room.name,
      users: room.members.size,
    });

    emitRoomList();
  });

  socket.on("send-message", ({ roomId, text, userName }) => {
    const room = rooms.get(String(roomId || "").trim());

    if (!room) {
      socket.emit("notice", {
        type: "error",
        text: "Room tidak valid.",
      });
      return;
    }

    const messageText = String(text || "").trim();
    if (!messageText) return;

    const sender = String(userName || socket.data.userName || "Anonymous").trim() || "Anonymous";

    const msg = {
      user: sender,
      text: messageText,
      time: new Date().toISOString(),
    };

    room.messages.push(msg);

    if (room.messages.length > 200) {
      room.messages = room.messages.slice(-200);
    }

    io.to(room.id).emit("receive-message", msg);
  });

  socket.on("disconnect", () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    room.members.delete(socket.id);

    if (room.members.size === 0) {
      rooms.delete(roomId);
    } else {
      io.to(roomId).emit("room-users", {
        roomId: room.id,
        roomName: room.name,
        users: room.members.size,
      });
    }

    emitRoomList();
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});