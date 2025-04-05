from flask import Flask, render_template
from flask_socketio import SocketIO, join_room, leave_room, emit
from flask_cors import CORS
import eventlet

class VoiceChatApp:
    def __init__(self):
        self.app = Flask(__name__)
        CORS(self.app)  # Enable Cross-Origin Requests
        self.socketio = SocketIO(self.app, cors_allowed_origins="*", async_mode='eventlet')
        self.rooms = set()  # Track created rooms
        self.configure_routes()
        self.configure_socket_events()

    def configure_routes(self):
        @self.app.route('/')
        def index():
            return render_template('index.html')

    def configure_socket_events(self):
        @self.socketio.on('create_room')
        def handle_create_room(data):
            room = data['room']
            if room not in self.rooms:
                self.rooms.add(room)
                emit('message', f"Room {room} has been created!", broadcast=True)

        @self.socketio.on('join_room')
        def handle_join_room(data):
            room = data['room']
            if room in self.rooms:
                join_room(room)
                emit('message', f"{data['username']} has joined room {room}.", to=room)

        @self.socketio.on('leave_room')
        def handle_leave_room(data):
            room = data['room']
            leave_room(room)
            emit('message', f"{data['username']} has left room {room}.", to=room)

        @self.socketio.on('audio_data')
        def handle_audio_data(data):
            room = data['room']
            emit('audio_data', data['audio'], to=room)

    def run(self):
        self.socketio.run(self.app, debug=True, host='0.0.0.0', port=5000)

if __name__ == '__main__':
    chat_app = VoiceChatApp()
    chat_app.run()