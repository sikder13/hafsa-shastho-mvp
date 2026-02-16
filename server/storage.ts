import { db } from "./db";
import { users, appointments, type User, type InsertUser, type Appointment, type InsertAppointment } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByPhone(phoneNumber: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // OTP Management (In-memory for MVP)
  saveOtp(phoneNumber: string, code: string): Promise<void>;
  verifyOtp(phoneNumber: string, code: string): Promise<boolean>;

  // Appointments
  createAppointment(appointment: InsertAppointment): Promise<Appointment>;
  getAppointmentsByPatient(patientId: number): Promise<Appointment[]>;
}

export class DatabaseStorage implements IStorage {
  // In-memory OTP store for MVP simplicity
  private otps: Map<string, string> = new Map();

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByPhone(phoneNumber: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.phoneNumber, phoneNumber));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async saveOtp(phoneNumber: string, code: string): Promise<void> {
    this.otps.set(phoneNumber, code);
    // OTP expires in 5 minutes (simple cleanup could be added here)
    setTimeout(() => this.otps.delete(phoneNumber), 5 * 60 * 1000); 
  }

  async verifyOtp(phoneNumber: string, code: string): Promise<boolean> {
    const storedOtp = this.otps.get(phoneNumber);
    if (storedOtp === code) {
      this.otps.delete(phoneNumber); // Consume OTP
      return true;
    }
    return false;
  }

  async createAppointment(appointment: InsertAppointment): Promise<Appointment> {
    const [newAppointment] = await db.insert(appointments).values(appointment).returning();
    return newAppointment;
  }

  async getAppointmentsByPatient(patientId: number): Promise<Appointment[]> {
    return await db.select().from(appointments).where(eq(appointments.patientId, patientId));
  }
}

export const storage = new DatabaseStorage();
