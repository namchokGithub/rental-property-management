import { readCollection, writeCollection, STORAGE_KEYS } from "@/data/storage/storage";
import type { Room, CreateRoomInput, UpdateRoomInput } from "@/types/room";

function all(): Room[] {
  return readCollection<Room>(STORAGE_KEYS.rooms);
}

export const roomRepository = {
  getAll(): Room[] {
    return all();
  },
  getById(id: string): Room | undefined {
    return all().find((r) => r.id === id);
  },
  create(input: CreateRoomInput): Room {
    const now = new Date().toISOString();
    const room: Room = { ...input, status: input.status ?? "available", id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    writeCollection(STORAGE_KEYS.rooms, [...all(), room]);
    return room;
  },
  update(id: string, input: UpdateRoomInput): Room {
    const rooms = all();
    const index = rooms.findIndex((r) => r.id === id);
    if (index === -1) throw new Error(`Room ${id} not found`);
    const updated: Room = { ...rooms[index], ...input, updatedAt: new Date().toISOString() };
    rooms[index] = updated;
    writeCollection(STORAGE_KEYS.rooms, rooms);
    return updated;
  },
  delete(id: string): void {
    writeCollection(STORAGE_KEYS.rooms, all().filter((r) => r.id !== id));
  },
};
