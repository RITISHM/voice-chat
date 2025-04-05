const socket = io("https://voice-chat-1-049c.onrender.com", {
  transports: ["websocket"],
});

let localStream;
let peerConnection = null;
const config = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

// Create or join room
function createRoom() {
  socket.emit("create_room", {});
}

socket.on("room_created", (data) => {
  alert(`Room Created! Code: ${data.room_code}`);
  document.getElementById(
    "roomCodeDisplay"
  ).innerText = `Room Code: ${data.room_code}`;
  // Auto-join the room using the displayed code.
  joinRoomWithCode(data.room_code);
});

function joinRoom() {
  const roomCode = document.getElementById("roomCodeInput").value;
  joinRoomWithCode(roomCode);
}

function joinRoomWithCode(roomCode) {
  socket.emit("join_room", { room_code: roomCode });
  startVoiceCommunication(roomCode);
}

socket.on("room_not_found", (data) => {
  alert(data.message);
});

socket.on("user_joined", (data) => {
  console.log(`Joined room: ${data.room_code}`);
});

// When a new peer connects, initiate an offer if no connection exists.
socket.on("new_peer", (data) => {
  if (!peerConnection) {
    createOffer();
  }
});

// ----- WebRTC Signaling Handlers -----

socket.on("webrtc_offer", async (data) => {
  console.log("Received offer from", data.sender);
  if (!peerConnection) {
    await setupPeerConnection();
  }
  await peerConnection.setRemoteDescription(
    new RTCSessionDescription(data.offer)
  );
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  const roomCode = getRoomCode();
  socket.emit("webrtc_answer", { room_code: roomCode, answer: answer });
});

socket.on("webrtc_answer", async (data) => {
  console.log("Received answer from", data.sender);
  if (peerConnection) {
    await peerConnection.setRemoteDescription(
      new RTCSessionDescription(data.answer)
    );
  }
});

socket.on("webrtc_candidate", async (data) => {
  console.log("Received candidate");
  if (peerConnection) {
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    } catch (e) {
      console.error("Error adding received candidate", e);
    }
  }
});

// ----- Media and Connection Setup -----

function startVoiceCommunication(roomCode) {
  navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((stream) => {
      localStream = stream;
      // Play local audio (muted to avoid feedback)
      const localAudio = document.createElement("audio");
      localAudio.srcObject = localStream;
      localAudio.muted = true;
      localAudio.autoplay = true;
      document.getElementById("audioContainer").appendChild(localAudio);
      // Notify readiness after accessing the microphone.
      socket.emit("ready", { room_code: roomCode });
    })
    .catch((err) => console.error("Error accessing microphone:", err));
}

async function setupPeerConnection() {
  peerConnection = new RTCPeerConnection(config);
  // Add local stream tracks to the connection.
  if (localStream) {
    localStream
      .getTracks()
      .forEach((track) => peerConnection.addTrack(track, localStream));
  }
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      const roomCode = getRoomCode();
      socket.emit("webrtc_candidate", {
        room_code: roomCode,
        candidate: event.candidate,
      });
    }
  };
  peerConnection.ontrack = (event) => {
    console.log("Received remote stream");
    const remoteAudio = document.createElement("audio");
    remoteAudio.srcObject = event.streams[0];
    remoteAudio.autoplay = true;
    document.getElementById("audioContainer").appendChild(remoteAudio);
  };
}

async function createOffer() {
  if (peerConnection) {
    await setupPeerConnection();
  }
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  const roomCode = getRoomCode();
  socket.emit("webrtc_offer", { room_code: roomCode, offer: offer });
}

function getRoomCode() {
  // Attempt to retrieve the room code from either the input or the displayed code.
  let roomCode = document.getElementById("roomCodeInput").value;
  if (roomCode) {
    const displayText = document.getElementById("roomCodeDisplay").innerText;
    roomCode = displayText.split(": ")[1];
  }
  return roomCode;
}
