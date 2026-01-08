const { GoogleGenerativeAI } = require("@google/generative-ai");

// 1. Load the environment variables
require('dotenv').config(); 

// 2. Access the key correctly using process.env
const API_KEY = process.env.GEN_AI_KEY; 

console.log("Debug: Key loaded?", API_KEY ? "Yes (starts with " + API_KEY.substring(0,4) + "...)" : "NO - Check .env file");

const genAI = new GoogleGenerativeAI(API_KEY);

async function checkConnection() {
  console.log("1. Authenticating...");
  
  try {
    // In Node.js, we verify by trying to use a known model
    // 'gemini-1.5-flash' is the standard fast model
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    console.log("2. Sending test prompt to Gemini...");
    const result = await model.generateContent("Hello! Are you working?");
    const response = await result.response;
    
    console.log("------------------------------------------------");
    console.log("✅ SUCCESS! API Key is working.");
    console.log("Response from AI:", response.text());
    console.log("------------------------------------------------");
  } catch (error) {
    console.error("❌ ERROR: Connection failed.");
    console.error(error.message);
  }
}

checkConnection();