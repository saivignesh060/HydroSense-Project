/*
  HydroSense Backend - DEMO MODE
  Strategy: Real Gemini Analysis + Simulated Context Checks
  (Ensures demo works even during dry season)
*/

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 5000;

// --- CONFIGURATION ---
// SET THIS TO TRUE FOR THE HACKATHON DEMO
// It forces Weather & Topography to always return positive results.
const DEMO_MODE = true; 

// 1. FIREBASE SETUP
const serviceAccount = require('./serviceAccountKey.json');
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// 2. GEMINI AI SETUP
const GEN_AI_KEY = process.env.GEN_AI_KEY;
const genAI = new GoogleGenerativeAI(GEN_AI_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/report-flood', upload.single('image'), async (req, res) => {
  try {
    const { lat, lng } = req.body;
    const imageFile = req.file;
    
    let finalTrustScore = 0;
    let verificationLog = [];

    console.log(`Analyzing Report at: ${lat}, ${lng} [DEMO_MODE: ${DEMO_MODE}]`);

    // --- STEP 1: SOURCE CHECK (+10) ---
    if (imageFile && lat && lng) {
        finalTrustScore += 10;
        verificationLog.push("✅ Source: Metadata Verified");
    } else {
        return res.status(400).json({ success: false, status: "REJECTED", logs: ["Missing Data"] });
    }

    // --- STEP 2: GEMINI AI VERIFICATION (The Real Logic - +50) ---
    // We rely heavily on this for the actual decision.
    let aiAnalysis;
    try {
        const imageBase64 = imageFile.buffer.toString('base64');
        const prompt = `
          Analyze this image for a flood reporting app.
          Return a strictly valid JSON object.
          {
            "is_outdoor_street": boolean,
            "is_screen_spoof": boolean,
            "estimated_depth_inches": number,
            "confidence": number
          }
        `;

        const result = await model.generateContent([
            prompt,
            { inlineData: { data: imageBase64, mimeType: imageFile.mimetype } }
        ]);

        let aiText = result.response.text();
        aiText = aiText.replace(/```json/g, '').replace(/```/g, '').trim();
        aiAnalysis = JSON.parse(aiText);

        console.log("Gemini Analysis:", aiAnalysis);

        if (aiAnalysis.is_outdoor_street && !aiAnalysis.is_screen_spoof) {
            finalTrustScore += 50; // Big boost if AI says yes
            verificationLog.push(`✅ AI: Valid Street (Depth: ${aiAnalysis.estimated_depth_inches}")`);
        } else {
            verificationLog.push("❌ AI: Rejected (Indoor/Spoof/Dry)");
            // If AI rejects it, we kill the report immediately, even in Demo Mode
            return res.json({ 
                success: false, status: "REJECTED", score: 0, 
                logs: verificationLog, ai_data: aiAnalysis 
            });
        }
    } catch (aiError) {
        console.error("Gemini Error:", aiError);
        verificationLog.push("⚠️ AI: Analysis Failed (Network Error)");
    }

    // --- STEP 3: WEATHER CONTEXT (Simulated - +20) ---
    if (DEMO_MODE) {
        // HACKATHON SAFEGUARD: Always pass weather check
        finalTrustScore += 20;
        verificationLog.push("✅ Weather (Simulated): Heavy Rain Detected (Past 24h)");
    } else {
        // PRODUCTION LOGIC (Disabled for MVP to prevent "Dry Season" rejection)
        // const weatherRes = await fetch(`https://api.open-meteo.com...`);
        // if (rain > 0) score += 20;
    }

    // --- STEP 4: TOPOGRAPHY / BOWL ZONES (Simulated - +20) ---
    if (DEMO_MODE) {
        // HACKATHON SAFEGUARD: Always pass topography check
        finalTrustScore += 20;
        verificationLog.push("✅ Topography (Simulated): Low-lying 'Bowl Zone' Risk Verified");
    } else {
        // PRODUCTION LOGIC: Check Elevation API
    }

    // --- FINAL DECISION ---
    // With Demo Mode, a valid photo gets: 10 (Source) + 50 (AI) + 20 (Weather) + 20 (Topo) = 100
    // An invalid photo gets rejected at Step 2.
    
    const status = finalTrustScore >= 60 ? "VERIFIED" : "PENDING";

    if (status === "VERIFIED") {
        await db.collection('active_floods').add({
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            depth_inches: aiAnalysis?.estimated_depth_inches || 6,
            is_verified: true,
            timestamp: new Date(),
            trust_score: finalTrustScore,
            reporter_id: "demo_user_123" // Placeholder for Gamification
        });
        
        verificationLog.push("🏆 HydroPoints: +30 Added (Simulated)");
    }

    res.json({
        success: true,
        status: status,
        score: finalTrustScore,
        ai_data: aiAnalysis,
        logs: verificationLog
    });

  } catch (error) {
    console.error("Backend Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`HydroSense Backend running on port ${PORT}`);
});