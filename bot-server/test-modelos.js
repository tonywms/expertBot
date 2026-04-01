// test-modelos.js
const Groq = require('groq-sdk');

const groq = new Groq({ 
    apiKey: "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" 
});

async function testModel(modelName) {
    try {
        console.log(`\n--- Testando modelo: ${modelName} ---`);
        const completion = await groq.chat.completions.create({
            messages: [
                { role: "user", content: "Olá, me ajude com uma dúvida sobre WMS" }
            ],
            model: modelName,
            max_tokens: 100
        });
        console.log("Resposta:", completion.choices[0].message.content);
        console.log("✅ Funcionou!");
    } catch (error) {
        console.log("❌ Erro:", error.message);
    }
}

// Teste os modelos que você quer usar
async function runTests() {
    await testModel("meta-llama/llama-4-scout-17b-16e-instruct");
    await testModel("llama-3.3-70b-versatile");
    await testModel("llama-3.1-8b-instant");
}

runTests();