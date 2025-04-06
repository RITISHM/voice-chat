from flask import Flask, render_template, request
from flask_socketio import SocketIO, join_room, leave_room
from rooms import RoomManager
import asyncio

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your_secret_key'
# Using eventlet for asynchronous support
socketio = SocketIO(app, async_mode='eventlet')

room_manager = RoomManager()

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('create_room')
def handle_create_room(data):
   
    room_code = room_manager.create_room()
    print("room created:",room_code)
    # Auto-join the creator to the room.
    join_room(room_code)
    socketio.emit('room_created', {'room_code': room_code}, to=request.sid)

@socketio.on('join_room')
def handle_join_room(data):
    room_code = data['room_code']
    if room_manager.room_exists(room_code):
        join_room(room_code)
        socketio.emit('user_joined', {'room_code': room_code}, to=request.sid)
        # Notify others in the room that there is a new peer.
        socketio.emit('new_peer', {'id': request.sid}, room=room_code, include_self=False)
    else:
        socketio.emit('room_not_found', {'message': 'Room does not exist'}, to=request.sid)

@socketio.on('leave_room')
def handle_leave_room(data):
    room_code = data['room_code']
    leave_room(room_code)
    socketio.emit('user_left', {'room_code': room_code}, room=room_code)

# (Optional) A 'ready' event if you prefer the client to notify readiness after capturing local media.
@socketio.on('ready')
def handle_ready(data):
    room_code = data['room_code']
    socketio.emit('new_peer', {'id': request.sid}, room=room_code, include_self=False)

# ----- Signaling for WebRTC -----

@socketio.on('webrtc_offer')
def handle_webrtc_offer(data):
    room_code = data['room_code']
    offer = data['offer']
    socketio.emit('webrtc_offer', {'offer': offer, 'sender': request.sid},
                  room=room_code, include_self=False)

@socketio.on('webrtc_answer')
def handle_webrtc_answer(data):
    room_code = data['room_code']
    answer = data['answer']
    socketio.emit('webrtc_answer', {'answer': answer, 'sender': request.sid},
                  room=room_code, include_self=False)

@socketio.on('webrtc_candidate')
def handle_webrtc_candidate(data):
    room_code = data['room_code']
    candidate = data['candidate']
    socketio.emit('webrtc_candidate', {'candidate': candidate, 'sender': request.sid},
                  room=room_code, include_self=False)

if __name__ == '__main__':
    socketio.run(app, debug=True)