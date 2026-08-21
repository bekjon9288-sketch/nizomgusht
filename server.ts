import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, getDoc, updateDoc } from "firebase/firestore";

// Read Firebase configuration safely from the root file
const configPath = path.join(process.cwd(), "firebase-applet-config.json");
let firebaseConfig: any = {};
if (fs.existsSync(configPath)) {
  try {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    console.log("[Backup Server] Successfully loaded firebase configuration");
  } catch (err) {
    console.error("[Backup Server] Failed to parse firebase-applet-config.json:", err);
  }
} else {
  console.warn("[Backup Server] firebase-applet-config.json not found in root directory");
}

import { requireAuth, AuthRequest } from "./src/middleware/auth.ts";
import { getUsers, getOrCreateUser } from "./src/db/users.ts";

const app = express();
const PORT = 3000;

app.use(express.json());

// API Endpoints
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "NUR STROY POS Backend", database: "Cloud SQL (PostgreSQL)" });
});

app.get("/api/users", requireAuth, async (req: AuthRequest, res) => {
  try {
    const usersList = await getUsers();
    res.json(usersList);
  } catch (error: any) {
    console.error("Failed to fetch users:", error);
    res.status(500).json({ error: error.message || "Failed to fetch users" });
  }
});

app.post("/api/auth/sync", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    const user = await getOrCreateUser(req.user.uid, req.user.email || "", (req.user as any).name);
    res.json({ success: true, user });
  } catch (error: any) {
    console.error("Failed to sync user:", error);
    res.status(500).json({ error: error.message || "Failed to sync user" });
  }
});

// Endpoint to trigger manual backup for testing or instant backup
app.post("/api/backup/trigger", async (req, res) => {
  try {
    console.log("[Backup API] Manual backup triggered via API");
    await runAutoBackup(true);
    res.json({ 
      success: true, 
      message: "Zaxira nusxalash muvaffaqiyatli ishga tushirildi va Telegram kanalga yuborildi!" 
    });
  } catch (error: any) {
    console.error("[Backup API] Manual backup failed:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message || String(error) 
    });
  }
});

// Helper: Get Uzbekistan Time (Asia/Tashkent)
function getUzbekistanTime(): Date {
  const date = new Date();
  const tzString = date.toLocaleString('en-US', { timeZone: 'Asia/Tashkent' });
  return new Date(tzString);
}

// Global variable to prevent duplicate daily backups in memory
let lastRunDateString = ""; 

// Main backup execution function
async function runAutoBackup(manualTrigger = false) {
  console.log("[Backup Engine] Executing backup...");
  if (!firebaseConfig || !firebaseConfig.apiKey) {
    throw new Error("Firebase config is missing or incomplete.");
  }

  const firebaseApp = initializeApp(firebaseConfig);
  const db = getFirestore(firebaseApp);

  // Get settings/global document
  const settingsRef = doc(db, "settings", "global");
  const settingsSnap = await getDoc(settingsRef);
  if (!settingsSnap.exists()) {
    throw new Error("Tizim sozlamalari (settings/global) topilmadi. Zaxira bekor qilindi.");
  }
  const settings = settingsSnap.data() as any;

  const isEnabled = settings.isAutoBackupEnabled || false;
  const botToken = settings.backupTelegramToken || "";
  const chatId = settings.backupTelegramChatId || "";

  if (!isEnabled && !manualTrigger) {
    console.log("[Backup Engine] Auto-backup is disabled in Firestore settings.");
    return;
  }

  if (!botToken || !chatId) {
    throw new Error("Telegram Bot Token yoki Kanal ID kiritilmagan. Sozlamalarni tekshiring.");
  }

  // Gather data from all primary collections
  const collectionsToBackup = [
    "materials",
    "transactions",
    "credits",
    "loyalty_cards",
    "reminders",
    "staff_members"
  ];

  const backupData: Record<string, any> = {
    timestamp: new Date().toISOString(),
    shopName: settings.shopName || "NUR STROY",
    version: "v3",
    data: {}
  };

  for (const colName of collectionsToBackup) {
    try {
      const colRef = collection(db, colName);
      const snapshot = await getDocs(colRef);
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      backupData.data[colName] = docs;
    } catch (err) {
      console.error(`[Backup Engine] Failed to back up collection ${colName}:`, err);
      backupData.data[colName] = [];
    }
  }

  // Include global settings in the backup
  backupData.data["settings"] = settings;

  // Generate pretty printed JSON string
  const jsonString = JSON.stringify(backupData, null, 2);

  // Stats calculation for nice summary
  const todayStr = getUzbekistanTime().toLocaleDateString('uz-UZ');
  const materialsCount = backupData.data["materials"]?.length || 0;
  const txCount = backupData.data["transactions"]?.length || 0;
  const creditsCount = backupData.data["credits"]?.length || 0;
  
  const totalStockItems = (backupData.data["materials"] || []).reduce((acc: number, m: any) => acc + (Number(m.stock) || 0), 0);
  const totalStockValue = (backupData.data["materials"] || []).reduce((acc: number, m: any) => acc + ((Number(m.stock) || 0) * (Number(m.sellingPrice) || 0)), 0);
  const totalDebts = (backupData.data["credits"] || []).reduce((acc: number, c: any) => acc + (Number(c.totalDebt) || 0), 0);

  const caption = `📊 *NUR STROY - AVTOMATIK ZAXIRA HISOBOTI*\n` +
    `📅 Sana: ${todayStr}\n` +
    `----------------------------------------\n` +
    `📦 Maxsulotlar turlari: *${materialsCount} ta*\n` +
    `📦 Jami mahsulotlar soni: *${totalStockItems.toLocaleString()} dona*\n` +
    `💵 Jami mahsulotlar qiymati: *${totalStockValue.toLocaleString()} so'm*\n` +
    `💰 Tranzaksiyalar soni: *${txCount} ta*\n` +
    `👥 Nasiyalar daftari: *${creditsCount} ta* mijoz\n` +
    `👥 Umumiy qarzlar miqdori: *${totalDebts.toLocaleString()} so'm*\n` +
    `----------------------------------------\n` +
    `⚡ _Tizim tunda bazani avtomatik nusxaladi va xavfsiz Google Drive / Telegram kanalga yubordi._`;

  // 1. Send overview text
  const sendMessageUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const textResponse = await fetch(sendMessageUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: caption,
      parse_mode: "Markdown"
    })
  });

  if (!textResponse.ok) {
    const errText = await textResponse.text();
    throw new Error(`Telegram text send failed: ${errText}`);
  }

  // 2. Send JSON document file
  const sendDocUrl = `https://api.telegram.org/bot${botToken}/sendDocument`;
  const fileBlob = new Blob([jsonString], { type: "application/json" });
  const formData = new FormData();
  formData.append("chat_id", chatId);
  
  const filename = `nurstroy_auto_backup_${new Date().toISOString().slice(0, 10)}.json`;
  formData.append("document", fileBlob, filename);
  formData.append("caption", `📝 Nur Stroy To'liq Tizim Zaxirasi (${todayStr})`);

  const docResponse = await fetch(sendDocUrl, {
    method: "POST",
    body: formData
  });

  if (!docResponse.ok) {
    const errText = await docResponse.text();
    throw new Error(`Telegram document upload failed: ${errText}`);
  }

  console.log("[Backup Engine] Auto-backup successfully sent to Telegram!");

  // Update success status in settings
  const uzTimeStr = getUzbekistanTime().toLocaleString('uz-UZ');
  await updateDoc(settingsRef, {
    lastAutoBackupAt: uzTimeStr,
    lastAutoBackupStatus: "success",
    lastAutoBackupError: null
  });
}

// Background scheduler
function checkAndRunBackup() {
  const uzTime = getUzbekistanTime();
  const currentHour = uzTime.getHours();
  const dateString = uzTime.toISOString().slice(0, 10);

  // Run auto backup at 02:00 AM (night/tunda)
  if (currentHour === 2) {
    if (lastRunDateString !== dateString) {
      lastRunDateString = dateString;
      console.log(`[Backup Scheduler] Triggering automatic night backup at 02:00 AM Uzbek Time for ${dateString}...`);
      runAutoBackup().catch(err => {
        console.error("[Backup Scheduler] Automatic backup failed:", err);
      });
    }
  }
}

// Start background task timer (runs every 10 minutes)
setInterval(checkAndRunBackup, 10 * 60 * 1000);
console.log("[Backup Scheduler] Daily background backup scheduler initialized (runs every 10 minutes, triggers at 02:00 AM Tashkent Time)");

// Vite middleware and server initialization
async function startServer() {
  // Serve API routes first
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
