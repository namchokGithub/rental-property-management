export type RoomStatus = "available" | "occupied" | "maintenance" | "inactive";

export interface Room {
  id: string;
  roomNumber: string;
  floor?: string;
  type?: string;
  monthlyRent: number;
  status: RoomStatus;
  description?: string;
  electricityRate: number;
  waterRate: number;
  createdAt: string;
  updatedAt: string;
}

export type CreateRoomInput = Omit<Room, "id" | "createdAt" | "updatedAt" | "status"> & {
  status?: RoomStatus;
};
export type UpdateRoomInput = Partial<Omit<Room, "id" | "createdAt" | "updatedAt">>;
