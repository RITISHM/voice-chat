import asyncio
import random
import string

class Room:
    def __init__(self, room_code):
        self.room_code = room_code
        self.users = set()

    async def handle_event(self, event_data):
        # Handle room-specific events asynchronously
        await asyncio.sleep(0.1)  # Simulated async processing delay
        print(f"Room {self.room_code} handling event: {event_data}")

class RoomManager:
    def __init__(self):
        self.rooms = {}

    def create_room(self):

        room_code =self.create_code()
        self.rooms[room_code] = Room(room_code)
        return room_code

    def room_exists(self, room_code):
        return room_code in self.rooms
    
    def room_leave(self, room_code):
        if room_code in self.rooms:
          del self.rooms[room_code]


    def create_code(self):
      # Combine uppercase, lowercase letters, and digits
      characters = string.ascii_letters + string.digits
      code=''.join(random.choice(characters) for _ in range(6))
      while(code not in list(self.rooms.keys())):
        code=''.join(random.choice(characters) for _ in range(6))

      return code 

  
