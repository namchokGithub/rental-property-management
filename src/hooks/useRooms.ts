import { useCallback, useState } from "react";
import { roomRepository } from "@/data/repositories/roomRepository";
import type { Room, CreateRoomInput, UpdateRoomInput } from "@/types/room";

export function useRooms() {
  const [rooms, setRooms] = useState<Room[]>(() => roomRepository.getAll());

  const refresh = useCallback(() => setRooms(roomRepository.getAll()), []);

  const createRoom = useCallback(
    (input: CreateRoomInput) => {
      const room = roomRepository.create(input);
      refresh();
      return room;
    },
    [refresh]
  );

  const updateRoom = useCallback(
    (id: string, input: UpdateRoomInput) => {
      const room = roomRepository.update(id, input);
      refresh();
      return room;
    },
    [refresh]
  );

  const deleteRoom = useCallback(
    (id: string) => {
      roomRepository.delete(id);
      refresh();
    },
    [refresh]
  );

  return { rooms, refresh, createRoom, updateRoom, deleteRoom };
}
