import { GoogleGenAI } from "@google/genai";

/**
 * AI Portfolio Analyst
 * Powered by Gemini 3 Pro for deep reasoning.
 */
export const getPortfolioSummary = async (portfolioData: any) => {
  // Always use process.env.API_KEY directly in the named parameter object as per guidelines.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `
    As an expert Enterprise Architecture AI, perform an in-depth analysis on this software delivery portfolio.
    
    PORTFOLIO DATA:
    ${JSON.stringify(portfolioData)}
    
    REQUIREMENTS:
    1. EXECUTIVE SUMMARY: High-level health and delivery posture.
    2. VENDOR VELOCITY: Comparative analysis of vendor performance and churn risks.
    3. TOP 3 CRITICAL RISKS: Immediate items requiring executive attention.
    4. MIGRATION TRENDS: Assessment of cloud-native readiness and timeline adherence.
    
    FORMATTING:
    Use professional enterprise language. Structure with clear Markdown headers and concise bullet points.
  `;

  try {
    // Calling generateContent directly on ai.models.
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 }
      }
    });
    // Accessing the .text property directly (not as a function).
    return response.text || "Portfolio analysis is currently unavailable.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Error generating AI insights. Please verify your environment configuration and API key.";
  }
};