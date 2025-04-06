from flask import Flask, render_template, request
from flask_socketio import SocketIO, join_room, leave_room
from rooms import RoomManager

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your_secret_key'

# Using eventlet for asynchronous support
socketio = SocketIO(app, async_mode='eventlet')

room_manager = RoomManager()

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('create_room')
def handle_create_room(data):  # Accept event data even if empty
    room_code = room_manager.create_room()
    print("Room created:", room_code)
    join_room(room_code)
    # Add the creator (their SID) to the room
    room_manager.rooms[room_code].users.add(request.sid)
    socketio.emit('room_created', {'room_code': room_code}, to=request.sid)

@socketio.on('join_room')
def handle_join_room(data):
    room_code = data['room_code']
    if room_manager.room_exists(room_code):
        join_room(room_code)
        # Record that this SID has joined the room
        room_manager.rooms[room_code].users.add(request.sid)
        socketio.emit('user_joined', {'room_code': room_code}, to=request.sid)
        # Notify other peers in the room
        socketio.emit('new_peer', {'id': request.sid}, room=room_code, include_self=False)
    else:
        socketio.emit('room_not_found', {'message': 'Room does not exist'}, to=request.sid)

@socketio.on('leave_room')
def handle_leave_room(data):
    room_code = data['room_code']
    leave_room(room_code)
    # Remove the SID from the room's user set
    if room_manager.room_exists(room_code):
        room = room_manager.rooms[room_code]
        room.users.discard(request.sid)
        # Delete the room if no user is left
        if len(room.users) == 0:
            room_manager.remove_room(room_code)
            print("Room removed because empty:", room_code)
    # Inform the remaining users (if any) that this user left
    socketio.emit('user_left', {'room_code': room_code}, room=room_code)

@socketio.on('disconnect')
def handle_disconnect():
    # On disconnect, go through all rooms and remove this SID.
    for room_code, room in list(room_manager.rooms.items()):
        if request.sid in room.users:
            room.users.discard(request.sid)
            leave_room(room_code)
            if len(room.users) == 0:
                room_manager.remove_room(room_code)
                print("Room removed (disconnect):", room_code)

# ----- WebRTC Signaling Handlers -----
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
    socketio.run(app, debug=True, host="127.0.0.1", port=5000)