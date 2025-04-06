// Connect to the Socket.IO server (adjust URL/protocol as needed)
const socket = io("https://voice-chat-1-049c.onrender.com/", {
  transports: ["websocket"],
});

let localStream = null;
let peerConnection = null;
// A flag to indicate whether we've sent an offer and are waiting for an answer.
let offerSent = false;

const config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

/* ===========================
   ROOM CONTROLS
=========================== */

// Create a new room.
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

// Join an existing room based on code.
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

// Leave the room: send leave event and perform cleanup.
function leaveRoom() {
  const roomCode = document.getElementById("roomCodeInput").value;
  socket.emit("leave_room", { room_code: roomCode });
  document.getElementById("roomCodeDisplay").innerText = "Not in a room";

  // Close the peer connection.
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
    offerSent = false;
  }

  // Stop the local media tracks.
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
    localStream = null;
  }

  // Clear all audio elements.
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

/* ===========================
   WEBRTC & SIGNALING
=========================== */

// When a new peer joins, if no connection exists, initiate an offer.
socket.on("new_peer", (data) => {
  console.log("New peer joined:", data.id);
  if (!peerConnection) {
    createOffer();
  }
});

// Handle incoming offer.
socket.on("webrtc_offer", async (data) => {
  console.log("Received offer from", data.sender);
  if (!peerConnection) {
    await setupPeerConnection();
  }
  try {
    await peerConnection.setRemoteDescription(
      new RTCSessionDescription(data.offer)
    );
    // Create an answer in response.
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit("webrtc_answer", { room_code: getRoomCode(), answer: answer });
  } catch (e) {
    console.error("Error handling offer:", e);
  }
});

// Handle incoming answer. Only apply if we've sent an offer.
socket.on("webrtc_answer", async (data) => {
  console.log("Received answer from", data.sender);
  if (peerConnection && offerSent) {
    try {
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(data.answer)
      );
      offerSent = false; // Reset our flag after a successful negotiation.
    } catch (e) {
      console.error("Error setting remote description from answer:", e);
    }
  } else {
    console.warn(
      "Ignored answer: no pending offer (offerSent:",
      offerSent,
      ") or signaling state is",
      peerConnection ? peerConnection.signalingState : "none"
    );
  }
});

// Handle ICE candidates.
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

/* ===========================
   MEDIA & CONNECTION SETUP
=========================== */

// Get user audio and notify that we’re ready for a connection.
function startVoiceCommunication(roomCode) {
  navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((stream) => {
      localStream = stream;
      // Create a local audio element (muted to avoid echo).
      const localAudio = document.createElement("audio");
      localAudio.srcObject = localStream;
      localAudio.muted = true;
      localAudio.autoplay = true;
      document.getElementById("audioContainer").appendChild(localAudio);
      // Inform peers that we're ready.
      socket.emit("ready", { room_code: roomCode });
    })
    .catch((err) => console.error("Error accessing microphone:", err));
}

// Set up the RTCPeerConnection along with event handlers.
async function setupPeerConnection() {
  peerConnection = new RTCPeerConnection(config);

  if (localStream) {
    localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream);
    });
  }

  // Relay ICE candidates to the signaling server.
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("webrtc_candidate", {
        room_code: getRoomCode(),
        candidate: event.candidate,
      });
    }
  };

  // When receiving a remote stream, attach it if it isn’t our own.
  peerConnection.ontrack = (event) => {
    if (event.streams && event.streams[0] === localStream) {
      console.log("Ignoring track corresponding to local stream.");
      return;
    }
    console.log("Received remote stream");
    const remoteAudio = document.createElement("audio");
    remoteAudio.srcObject = event.streams[0];
    remoteAudio.autoplay = true;
    document.getElementById("audioContainer").appendChild(remoteAudio);
  };
}

// Create an offer and send it to the other peer.
async function createOffer() {
  if (!peerConnection) {
    await setupPeerConnection();
  }
  try {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    // Mark that we've sent an offer so that the answer can be applied.
    offerSent = true;
    socket.emit("webrtc_offer", { room_code: getRoomCode(), offer: offer });
  } catch (e) {
    console.error("Error creating offer:", e);
  }
}

// Helper to retrieve the room code from the input or display.
function getRoomCode() {
  let roomCode = document.getElementById("roomCodeInput").value;
  if (!roomCode) {
    const displayText = document.getElementById("roomCodeDisplay").innerText;
    roomCode = displayText.split(": ")[1];
  }
  return roomCode;
}
