import random
import string

class Room:
    def __init__(self, room_code):
        self.room_code = room_code
        self.users = set()

class RoomManager:
    def __init__(self):
        self.rooms = {}

    def create_room(self):
        room_code = self.generate_code()
        self.rooms[room_code] = Room(room_code)
        return room_code

    def room_exists(self, room_code):
        return room_code in self.rooms

    def remove_room(self, room_code):
        if room_code in self.rooms:
            del self.rooms[room_code]

    def generate_code(self):
        characters = string.ascii_letters + string.digits
        while True:
            code = ''.join(random.choice(characters) for _ in range(6))
            if code not in self.rooms:
                return code