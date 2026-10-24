const socket = io();

const state = {
  userName: localStorage.getItem("chat-user-name") || "",
  currentRoomId: null,
  currentRoomName: "",
};

const userNameInput = document.getElementById("userName");
const roomNameInput = document.getElementById("roomName");
const roomListEl = document.getElementById("roomList");
const messagesEl = document.getElementById("messages");
const messageInput = document.getElementById("messageInput");
const currentRoomNameEl = document.getElementById("currentRoomName");
const userCountEl = document.getElementById("userCount");
const nameForm = document.getElementById("nameForm");
const createRoomForm = document.getElementById("createRoomForm");
const messageForm = document.getElementById("messageForm");

if (state.userName) {
  userNameInput.value = state.userName;
}

function setUserName() {
  const name = userNameInput.value.trim() || "Anonymous";
  state.userName = name;
  localStorage.setItem("chat-user-name", name);
}

function appendMessage(msg, isSelf = false) {
  const el = document.createElement("div");
  el.className = `message ${isSelf ? "self" : "other"}`;

  const date = new Date(msg.time);
  const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  el.innerHTML = `
    <span class="meta">${msg.user} • ${time}</span>
    <div>${msg.text}</div>
  `;

  messagesEl.appendChild(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function renderRoomList(rooms) {
  roomListEl.innerHTML = "";
  rooms.forEach((room) => {
    const li = document.createElement("li");
    li.textContent = `${room.name} (${room.users})`;
    li.addEventListener("click", () => {
      socket.emit("join-room", {
        roomId: room.id,
        userName: state.userName || "Anonymous",
      });
    });
    roomListEl.appendChild(li);
  });
}

function setCurrentRoom(roomId, roomName, users) {
  state.currentRoomId = roomId;
  state.currentRoomName = roomName;
  currentRoomNameEl.textContent = roomName;
  userCountEl.textContent = `${users} online`;
  messagesEl.innerHTML = "";
}

nameForm.addEventListener("submit", (e) => {
  e.preventDefault();
  setUserName();
  alert("Nama panggilan disimpan.");
});

createRoomForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const roomName = roomNameInput.value.trim();

  if (!roomName) {
    alert("Nama grup tidak boleh kosong.");
    return;
  }

  setUserName();
  socket.emit("create-room", {
    name: roomName,
    userName: state.userName,
  });

  roomNameInput.value = "";
});

messageForm.addEventListener("submit", (e) => {
  e.preventDefault();

  if (!state.currentRoomId) {
    alert("Pilih atau buat grup terlebih dahulu.");
    return;
  }

  const message = messageInput.value.trim();
  if (!message) return;

  socket.emit("send-message", {
    roomId: state.currentRoomId,
    text: message,
    userName: state.userName || "Anonymous",
  });

  messageInput.value = "";
});

socket.on("room-list", (rooms) => {
  renderRoomList(rooms);
});

socket.on("room-state", ({ roomId, roomName, messages, users }) => {
  setCurrentRoom(roomId, roomName, users);
  messages.forEach((msg) => {
    appendMessage(msg, msg.user === state.userName);
  });
});

socket.on("receive-message", (msg) => {
  appendMessage(msg, msg.user === state.userName);
});

socket.on("room-users", ({ roomId, roomName, users }) => {
  if (state.currentRoomId === roomId) {
    currentRoomNameEl.textContent = roomName;
    userCountEl.textContent = `${users} online`;
  }
});

socket.on("notice", ({ type, text }) => {
  alert(text);
});

socket.on("connect", () => {
  if (state.userName) {
    setUserName();
  }
});