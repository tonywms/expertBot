const Groq = require('groq-sdk');
require('dotenv').config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function test() {
  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: "Olá, tudo bem?" }],
      model: "llama-3.3-70b-versatile",
    });
    console.log("✅ Resposta:", completion.choices[0].message.content);
  } catch (error) {
    console.error("❌ Erro:", error.message);
  }
}

test();