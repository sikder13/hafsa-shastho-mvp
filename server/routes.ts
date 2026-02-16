import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api, errorSchemas } from "@shared/routes";
import { z } from "zod";
import session from "express-session";
import MemoryStore from "memorystore";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Session setup
  const SessionStore = MemoryStore(session);
  app.use(
    session({
      secret: "hafsa-shastho-secret", // In prod, use environment variable
      resave: false,
      saveUninitialized: false,
      store: new SessionStore({
        checkPeriod: 86400000,
      }),
      cookie: { 
        secure: app.get("env") === "production",
        maxAge: 24 * 60 * 60 * 1000 // 1 day
      },
    })
  );

  // === AUTH ROUTES ===

  app.post(api.auth.sendOtp.path, async (req, res) => {
    try {
      const { phoneNumber } = api.auth.sendOtp.input.parse(req.body);
      
      // Generate 6-digit OTP (Mock: 123456 for simplicity, or random)
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Save OTP
      await storage.saveOtp(phoneNumber, otp);
      
      // LOG OTP FOR DEMO PURPOSES
      console.log(`[AUTH] OTP for ${phoneNumber}: ${otp}`);

      res.json({ message: "OTP sent successfully" });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid phone number" });
      } else {
        res.status(500).json({ message: "Failed to send OTP" });
      }
    }
  });

  app.post(api.auth.verifyOtp.path, async (req, res) => {
    try {
      const { phoneNumber, otp } = api.auth.verifyOtp.input.parse(req.body);

      const isValid = await storage.verifyOtp(phoneNumber, otp);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid or expired OTP" });
      }

      // Check if user exists, else create
      let user = await storage.getUserByPhone(phoneNumber);
      if (!user) {
        user = await storage.createUser({ phoneNumber, name: "New User" });
      }

      // Set session
      (req.session as any).userId = user.id;

      res.json({ user });
    } catch (err) {
      res.status(400).json({ message: "Invalid request" });
    }
  });

  app.post(api.auth.logout.path, (req, res) => {
    req.session.destroy(() => {
      res.sendStatus(200);
    });
  });

  app.get(api.auth.me.path, async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(200).json(null);
    }
    const user = await storage.getUser(userId);
    res.json(user || null);
  });

  // === APPOINTMENT ROUTES ===

  app.get(api.appointments.list.path, async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const appointments = await storage.getAppointmentsByPatient(userId);
    res.json(appointments);
  });

  app.post(api.appointments.create.path, async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const input = api.appointments.create.input.parse(req.body);
      const appointment = await storage.createAppointment({
        ...input,
        patientId: userId, // Enforce current user
      });
      res.status(201).json(appointment);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data" });
      } else {
        res.status(500).json({ message: "Server error" });
      }
    }
  });

  // Seed Data
  if (app.get("env") === "development") {
    await seedDatabase();
  }

  return httpServer;
}

async function seedDatabase() {
  const existingUsers = await storage.getUserByPhone("+8801700000000");
  if (!existingUsers) {
    const user = await storage.createUser({
      name: "Demo Patient",
      phoneNumber: "+8801700000000",
      role: "patient",
    });
    console.log("Seeded demo user:", user);

    await storage.createAppointment({
      patientId: user.id,
      date: new Date(Date.now() + 86400000), // Tomorrow
      status: "confirmed",
      notes: "General checkup",
    });
  }
}
