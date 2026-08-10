import { roomRepository } from "@/data/repositories/roomRepository";
import { tenantRepository } from "@/data/repositories/tenantRepository";
import { assignmentRepository } from "@/data/repositories/assignmentRepository";
import { billingRepository } from "@/data/repositories/billingRepository";
import { settingsRepository } from "@/data/repositories/settingsRepository";

export function seedIfEmpty(): void {
  if (roomRepository.getAll().length > 0) return;

  settingsRepository.update({
    propertyName: "Sunrise Apartments",
    propertyAddress: "123 Sukhumvit Road, Bangkok 10110",
    phone: "02-123-4567",
  });

  const rooms = [
    roomRepository.create({ roomNumber: "101", floor: "1", type: "Studio", monthlyRent: 4500, electricityRate: 8, waterRate: 18, status: "available" }),
    roomRepository.create({ roomNumber: "102", floor: "1", type: "Studio", monthlyRent: 4500, electricityRate: 8, waterRate: 18 }),
    roomRepository.create({ roomNumber: "201", floor: "2", type: "1 Bedroom", monthlyRent: 6500, electricityRate: 8, waterRate: 18 }),
    roomRepository.create({ roomNumber: "202", floor: "2", type: "1 Bedroom", monthlyRent: 6500, electricityRate: 8, waterRate: 18 }),
    roomRepository.create({ roomNumber: "203", floor: "2", type: "1 Bedroom", monthlyRent: 6800, electricityRate: 8, waterRate: 18, status: "maintenance", description: "Waiting on plumbing repair" }),
    roomRepository.create({ roomNumber: "301", floor: "3", type: "2 Bedroom", monthlyRent: 9500, electricityRate: 8, waterRate: 18, status: "inactive", description: "Under renovation, not yet listed" }),
  ];

  const tenants = [
    tenantRepository.create({ firstName: "Somchai", lastName: "Jaidee", phone: "081-111-2222", email: "somchai@example.com" }),
    tenantRepository.create({ firstName: "Nari", lastName: "Suksawat", phone: "082-222-3333", email: "nari@example.com" }),
    tenantRepository.create({ firstName: "Kittipong", lastName: "Rattana", phone: "083-333-4444" }),
    tenantRepository.create({ firstName: "Ploy", lastName: "Wongsa", phone: "084-444-5555", status: "inactive" }),
  ];

  assignmentRepository.assign({ roomId: rooms[1].id, tenantId: tenants[0].id, startDate: "2026-05-01" });
  assignmentRepository.assign({ roomId: rooms[2].id, tenantId: tenants[1].id, startDate: "2026-04-01" });
  assignmentRepository.assign({ roomId: rooms[3].id, tenantId: tenants[2].id, startDate: "2026-06-01" });

  assignmentRepository.assign({ roomId: rooms[0].id, tenantId: tenants[3].id, startDate: "2026-01-01" });
  assignmentRepository.endByRoomId(rooms[0].id, "2026-06-30");

  billingRepository.create({
    roomId: rooms[1].id, tenantId: tenants[0].id, billingMonth: "2026-06",
    electricityPreviousMeter: 1200, electricityCurrentMeter: 1340, electricityRate: 8,
    waterPreviousMeter: 300, waterCurrentMeter: 320, waterRate: 18,
    rentAmount: 4500, garbageFee: 50, electricityMeterMaintenanceFee: 30, waterMeterMaintenanceFee: 30,
    otherCharges: [], dueDate: "2026-07-05", status: "paid",
  });
  billingRepository.create({
    roomId: rooms[2].id, tenantId: tenants[1].id, billingMonth: "2026-06",
    electricityPreviousMeter: 2100, electricityCurrentMeter: 2260, electricityRate: 8,
    waterPreviousMeter: 410, waterCurrentMeter: 435, waterRate: 18,
    rentAmount: 6500, garbageFee: 50, electricityMeterMaintenanceFee: 30, waterMeterMaintenanceFee: 30,
    otherCharges: [], dueDate: "2026-07-05", status: "issued",
  });
  billingRepository.create({
    roomId: rooms[3].id, tenantId: tenants[2].id, billingMonth: "2026-06",
    electricityPreviousMeter: 980, electricityCurrentMeter: 1085, electricityRate: 8,
    waterPreviousMeter: 210, waterCurrentMeter: 228, waterRate: 18,
    rentAmount: 6500, garbageFee: 50, electricityMeterMaintenanceFee: 30, waterMeterMaintenanceFee: 30,
    otherCharges: [{ name: "Parking", amount: 300 }], dueDate: "2026-06-20", status: "issued",
  });
  billingRepository.create({
    roomId: rooms[1].id, tenantId: tenants[0].id, billingMonth: "2026-07",
    electricityPreviousMeter: 1340, electricityCurrentMeter: 1470, electricityRate: 8,
    waterPreviousMeter: 320, waterCurrentMeter: 342, waterRate: 18,
    rentAmount: 4500, garbageFee: 50, electricityMeterMaintenanceFee: 30, waterMeterMaintenanceFee: 30,
    otherCharges: [], dueDate: "2026-08-05", status: "draft",
  });
}
