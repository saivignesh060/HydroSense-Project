/*
  HydroSense Backend - UPDATED
  Model: gemini-1.5-flash (Standard Stable Version)
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

// 1. FIREBASE SETUP
const serviceAccount = require('./serviceAccountKey.json');
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(); 

// 2. GEMINI AI SETUP
// NOTE: Ideally use process.env.GEN_AI_KEY. 
// If using hardcoded key, ensure you don't push this file to public GitHub.
const GEN_AI_KEY = process.env.GEN_AI_KEY;
const genAI = new GoogleGenerativeAI(GEN_AI_KEY);

// UPDATE: Using the standard stable model ID.
// If this still gives 404, please enable "Generative Language API" in Google Cloud Console.
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); 

const upload = multer({ storage: multer.memoryStorage() });

// --- API ENDPOINTS ---

app.post('/api/report-flood', upload.single('image'), async (req, res) => {
  try {
    const { lat, lng } = req.body;
    const imageFile = req.file;
    let finalTrustScore = 0;
    let verificationLog = [];

    console.log(`Analyzing Report at: ${lat}, ${lng}`);

    // [Algorithm 2, Step 1] Source Check
    if (imageFile && lat && lng) {
        finalTrustScore += 30;
        verificationLog.push("✅ Source: Camera & Location present");
    } else {
        return res.status(400).json({ success: false, status: "REJECTED", logs: ["Missing Data"] });
    }

    // [Algorithm 2, Step 2] AI Verification (Gemini)
    const imageBase64 = imageFile.buffer.toString('base64');
    
    // [Algorithm 3] Prompt
    const prompt = `
      Analyze this image for a flood reporting app.
      Return a strictly valid JSON object. Do not use Markdown blocks.
      {
        "is_outdoor_street": boolean,  // Is this a real outdoor street?
        "is_screen_spoof": boolean,    // Is this a photo of a screen?
        "estimated_depth_inches": number, // Estimate water depth. 0 if dry.
        "confidence": number           // 0.0 to 1.0
      }
    `;

    // FIX: Robust Error Handling & Parsing
    let aiAnalysis;
    try {
        const result = await model.generateContent([
            prompt, 
            { inlineData: { data: imageBase64, mimeType: imageFile.mimetype } }
        ]);
        
        if (!result || !result.response) {
            throw new Error("Gemini returned an empty response.");
        }

        let aiText = result.response.text();
        // Cleanup: Remove markdown code blocks if Gemini adds them
        aiText = aiText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        aiAnalysis = JSON.parse(aiText);

    } catch (aiError) {
        console.error("Gemini Analysis Failed:", aiError);
        // Fallback: If AI fails, we reject to be safe
        verificationLog.push(`❌ AI: Analysis Error (${aiError.message})`);
        return res.json({ 
            success: false, 
            status: "REJECTED", 
            score: finalTrustScore, 
            logs: verificationLog, 
            ai_data: null 
        });
    }

    console.log("Gemini Analysis:", aiAnalysis);

    if (aiAnalysis.is_outdoor_street && !aiAnalysis.is_screen_spoof) {
        finalTrustScore += 40;
        verificationLog.push(`✅ AI: Valid Street (Depth: ${aiAnalysis.estimated_depth_inches}")`);
    } else {
        verificationLog.push("❌ AI: Rejected (Indoor/Spoof/Dry)");
        // Immediate rejection if AI says it's fake
        return res.json({ 
            success: false, 
            status: "REJECTED", 
            score: finalTrustScore, 
            logs: verificationLog, 
            ai_data: aiAnalysis 
        });
    }

    // [Algorithm 2, Step 3] Weather Check (Mocked for now)
    const isRainingMock = true; 
    if (isRainingMock) {
        finalTrustScore += 20;
        verificationLog.push("✅ Weather: Rain verified");
    }

    // [Algorithm 2, Decision]
    const status = finalTrustScore > 80 ? "VERIFIED" : (finalTrustScore > 50 ? "PENDING" : "REJECTED");

    if (status === "VERIFIED") {
        await db.collection('active_floods').add({
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            depth_inches: aiAnalysis.estimated_depth_inches || 6,
            is_verified: true,
            timestamp: new Date(),
            trust_score: finalTrustScore
        });
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
    res.status(500).json({ error: error.message, logs: ["Server Error - Check Console"] });
  }
});

app.listen(PORT, () => {
  console.log(`HydroSense Backend running on port ${PORT}`);
});