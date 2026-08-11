import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/auth";
import { roomRepository } from "@/data/repositories/roomRepository";
import { getActivePropertyId } from "@/lib/activeProperty";
import type { Room, CreateRoomInput, UpdateRoomInput } from "@/types/room";

export function useRooms() {
  const { user } = useAuth();
  const propertyId = getActivePropertyId(user?.propertyIds ?? []);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = roomRepository.subscribe(propertyId, (next) => {
      setRooms(next);
      setIsLoading(false);
    });
    return unsubscribe;
  }, [propertyId]);

  const createRoom = useCallback(
    (input: CreateRoomInput) => roomRepository.create(propertyId, input),
    [propertyId],
  );

  const updateRoom = useCallback(
    (id: string, input: UpdateRoomInput) => roomRepository.update(propertyId, id, input),
    [propertyId],
  );

  const deleteRoom = useCallback((id: string) => roomRepository.delete(propertyId, id), [propertyId]);

  return { rooms, isLoading, createRoom, updateRoom, deleteRoom };
}
