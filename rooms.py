import asyncio

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
        # Simple logic: room codes start at 1000 and increment.
        room_code = str(len(self.rooms) + 1000)
        self.rooms[room_code] = Room(room_code)
        return room_code

    def room_exists(self, room_code):
        return room_code in self.rooms