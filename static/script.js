// Connect to the Socket.IO server using websocket transport
// Use http:// for local development if you're not running HTTPS locally
const socket = io("https://voice-chat-1-049c.onrender.com", {
  transports: ["websocket"],
});

let localStream = null;
let peerConnection = null;
const config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

// -----------------------
// Room Controls
// -----------------------

// Create Room
function createRoom() {
  socket.emit("create_room", {});
}

socket.on("room_created", (data) => {
  alert(`Room Created! Code: ${data.room_code}`);
  document.getElementById(
    "roomCodeDisplay"
  ).innerText = `Room Code: ${data.room_code}`;
  joinRoomWithCode(data.room_code);
});

// Join Room
function joinRoom() {
  const roomCode = document.getElementById("roomCodeInput").value;
  joinRoomWithCode(roomCode);
}

function joinRoomWithCode(roomCode) {
  socket.emit("join_room", { room_code: roomCode });
  document.getElementById(
    "roomCodeDisplay"
  ).innerText = `Room Code: ${roomCode}`;
  startVoiceCommunication(roomCode);
}

// Leave Room
function leaveRoom() {
  const roomCode = document.getElementById("roomCodeInput").value;
  socket.emit("leave_room", { room_code: roomCode });
  document.getElementById("roomCodeDisplay").innerText = `Not in a room`;

  // Close the peerConnection if it exists and clear resources
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  // Stop local media stream tracks
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
    localStream = null;
  }

  // Remove all audio elements (both local and remote)
  const audioContainer = document.getElementById("audioContainer");
  while (audioContainer.firstChild) {
    audioContainer.removeChild(audioContainer.firstChild);
  }
}

socket.on("room_not_found", (data) => {
  alert(data.message);
});

socket.on("user_joined", (data) => {
  console.log(`Joined room: ${data.room_code}`);
});

// -----------------------
// WebRTC Handling
// -----------------------

socket.on("new_peer", (data) => {
  console.log("New peer joined:", data.id);
  if (!peerConnection) {
    createOffer();
  }
});

socket.on("webrtc_offer", async (data) => {
  console.log("Received offer from", data.sender);
  if (!peerConnection) {
    await setupPeerConnection();
  }
  try {
    await peerConnection.setRemoteDescription(
      new RTCSessionDescription(data.offer)
    );
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit("webrtc_answer", { room_code: getRoomCode(), answer: answer });
  } catch (e) {
    console.error("Error handling offer:", e);
  }
});

socket.on("webrtc_answer", async (data) => {
  console.log("Received answer from", data.sender);
  if (peerConnection) {
    try {
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(data.answer)
      );
    } catch (e) {
      console.error("Error setting remote description from answer:", e);
    }
  }
});

socket.on("webrtc_candidate", async (data) => {
  console.log("Received ICE candidate");
  if (peerConnection) {
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    } catch (e) {
      console.error("Error adding ICE candidate:", e);
    }
  }
});

// -----------------------
// Media & Connection Setup
// -----------------------

function startVoiceCommunication(roomCode) {
  navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((stream) => {
      localStream = stream;
      // Create a local audio element (muted to avoid feedback)
      const localAudio = document.createElement("audio");
      localAudio.srcObject = localStream;
      localAudio.muted = true;
      localAudio.autoplay = true;
      document.getElementById("audioContainer").appendChild(localAudio);
      // Notify peers that you're ready
      socket.emit("ready", { room_code: roomCode });
    })
    .catch((err) => console.error("Error accessing microphone:", err));
}

async function setupPeerConnection() {
  peerConnection = new RTCPeerConnection(config);

  if (localStream) {
    localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream);
    });
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
    // If the stream is actually the local stream, ignore it
    if (event.streams && event.streams[0] === localStream) {
      return;
    }
    console.log("Received remote stream");
    const remoteAudio = document.createElement("audio");
    remoteAudio.srcObject = event.streams[0];
    remoteAudio.autoplay = true;
    document.getElementById("audioContainer").appendChild(remoteAudio);
  };
}

async function createOffer() {
  if (!peerConnection) {
    await setupPeerConnection();
  }
  try {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit("webrtc_offer", { room_code: getRoomCode(), offer: offer });
  } catch (e) {
    console.error("Error creating offer:", e);
  }
}

function getRoomCode() {
  let roomCode = document.getElementById("roomCodeInput").value;
  if (!roomCode) {
    const displayText = document.getElementById("roomCodeDisplay").innerText;
    roomCode = displayText.split(": ")[1];
  }
  return roomCode;
}
