const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

async function testar() {
    // Forçamos a versão 'v1' da API para evitar o erro 404 da v1beta
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    try {
        // Usando o nome padrão do modelo
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        console.log("Tentando falar com o Google (API v1)...");
        const result = await model.generateContent("Oi, responda apenas 'SISTEMA ONLINE'");
        const response = await result.response;
        console.log("Resposta do Google:", response.text());
    } catch (e) {
        console.error("ERRO:", e.message);
    }
}

testar();