const { GoogleGenerativeAI } = require("@google/generative-ai");

// PASTE YOUR API KEY HERE (from the image you showed)
const API_KEY = "AIzaSyCTMMkIPWrZYN1_Q_EWHJ8uLS7pRjXFPb4"; 

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