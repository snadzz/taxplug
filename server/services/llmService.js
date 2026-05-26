// server/services/llmService.js
import dotenv from 'dotenv';
dotenv.config();
console.log("DEBUG KEY:", process.env.OPENAI_API_KEY);
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const SYSTEM_PROMPT = `You are a helpful South African tax assistant specializing in the Income Tax Act (Act No. 58 of 1962) and SARS regulations.

Your role is to:
- Answer questions about South African tax law accurately
- Reference specific sections of the Income Tax Act when relevant
- Explain tax concepts in clear, understandable language
- Help users understand their tax obligations
- Guide users on tax return procedures

Important guidelines:
- Only provide information based on the context provided and your knowledge of SA tax law
- Always cite the relevant sections when referencing the Income Tax Act
- If you're uncertain, say so and recommend consulting a registered tax practitioner
- Never provide advice that could be construed as tax evasion
- Remind users that tax laws change and they should verify current regulations with SARS

Format your responses clearly with:
- A direct answer to the question
- Relevant legal references
- Practical guidance where appropriate`;

export async function generateAnswer(question, contextChunks) {
  const context = contextChunks
    .map((chunk, i) => `[Source ${i + 1}: ${chunk.source_file}${chunk.section ? `, ${chunk.section}` : ''}]\n${chunk.content}`)
    .join('\n\n---\n\n');

  const userMessage = `Context from the Income Tax Act and related documents:

${context}

---

User Question: ${question}

Please answer based on the context provided and your knowledge of South African tax law. If the context doesn't fully address the question, acknowledge this and provide what guidance you can.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage }
    ],
    temperature: 0.3, // Lower temperature for more factual responses
    max_tokens: 1500
  });

  return response.choices[0].message.content;
}
