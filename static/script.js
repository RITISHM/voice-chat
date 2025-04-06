// Connect to the server using WebSockets—adjust the URL as needed for your environment.
const socket = io("https://voice-chat-1-049c.onrender.com/", {
  transports: ["websocket"],
});

let localStream = null;
let peerConnection = null;
const config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

/* //////////////////////////// 
   ROOM CONTROLS 
/////////////////////////////// */

// Create a room. The server will assign a room code.
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

// Join a room based on the room code entered.
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

// Leave the current room and clean up local media and connection.
function leaveRoom() {
  const roomCode = document.getElementById("roomCodeInput").value;
  socket.emit("leave_room", { room_code: roomCode });
  document.getElementById("roomCodeDisplay").innerText = `Not in a room`;

  // Close the WebRTC connection if it exists.
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  // Stop local audio tracks.
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
    localStream = null;
  }

  // Remove all audio elements (local and remote).
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

/* //////////////////////////// 
   WEBRTC & SIGNALING 
/////////////////////////////// */

// When a new peer is announced by the server, if no peer connection exists, initiate an offer.
socket.on("new_peer", (data) => {
  console.log("New peer joined:", data.id);
  if (!peerConnection) {
    createOffer();
  }
});

// Handle incoming WebRTC offer.
socket.on("webrtc_offer", async (data) => {
  console.log("Received offer from", data.sender);
  if (!peerConnection) {
    await setupPeerConnection();
  }
  try {
    // Set the remote description from the offer.
    await peerConnection.setRemoteDescription(
      new RTCSessionDescription(data.offer)
    );
    // Create an answer.
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit("webrtc_answer", { room_code: getRoomCode(), answer: answer });
  } catch (e) {
    console.error("Error handling offer:", e);
  }
});

// Handle incoming WebRTC answer.
socket.on("webrtc_answer", async (data) => {
  console.log("Received answer from", data.sender);
  if (peerConnection) {
    // Only set the remote description if we're in the proper signaling state.
    if (peerConnection.signalingState === "have-local-offer") {
      try {
        await peerConnection.setRemoteDescription(
          new RTCSessionDescription(data.answer)
        );
      } catch (e) {
        console.error("Error setting remote description from answer:", e);
      }
    } else {
      console.warn(
        "Ignored answer: signaling state is not 'have-local-offer' but is",
        peerConnection.signalingState
      );
    }
  }
});

// Handle incoming ICE candidates.
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

/* //////////////////////////// 
   MEDIA & CONNECTION SETUP 
/////////////////////////////// */

// Request user media (audio) and notify the server once ready.
function startVoiceCommunication(roomCode) {
  navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((stream) => {
      localStream = stream;
      // Create a local audio element, mute it to avoid echo.
      const localAudio = document.createElement("audio");
      localAudio.srcObject = localStream;
      localAudio.muted = true;
      localAudio.autoplay = true;
      document.getElementById("audioContainer").appendChild(localAudio);
      // Notify peers that we are ready.
      socket.emit("ready", { room_code: roomCode });
    })
    .catch((err) => console.error("Error accessing microphone:", err));
}

// Sets up a new RTCPeerConnection and adds event handlers.
async function setupPeerConnection() {
  peerConnection = new RTCPeerConnection(config);

  // Add all local tracks (audio) to the connection.
  if (localStream) {
    localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream);
    });
  }

  // ICE handling: send candidate to the server.
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      const roomCode = getRoomCode();
      socket.emit("webrtc_candidate", {
        room_code: roomCode,
        candidate: event.candidate,
      });
    }
  };

  // When remote track is received, attach it unless it is our own.
  peerConnection.ontrack = (event) => {
    // Ensure that we don't attach our own audio stream.
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

// Create an offer—the initiating peer for a connection.
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

// Helper: Grab the room code from either the input or display element.
function getRoomCode() {
  let roomCode = document.getElementById("roomCodeInput").value;
  if (!roomCode) {
    const displayText = document.getElementById("roomCodeDisplay").innerText;
    roomCode = displayText.split(": ")[1];
  }
  return roomCode;
}
