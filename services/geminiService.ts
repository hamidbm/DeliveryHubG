
import { GoogleGenAI, Type } from "@google/genai";

/**
 * AI Portfolio Analyst
 * Powered by Gemini 3 Pro for deep reasoning.
 */
export const getPortfolioSummary = async (portfolioData: any) => {
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
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 }
      }
    });
    return response.text || "Portfolio analysis is currently unavailable.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Error generating AI insights.";
  }
};

/**
 * AI Task Co-Pilot
 * Refines individual work items with implementation plans and criteria.
 */
export const generateWorkPlan = async (workItem: any) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `
    As a Senior Technical Product Manager, analyze this work item and provide a structured implementation roadmap.
    
    ARTIFACT: ${workItem.key} - ${workItem.title}
    DESCRIPTION: ${workItem.description || 'No description provided.'}
    TYPE: ${workItem.type}
    
    RESPONSE REQUIREMENTS:
    1. ACCEPTANCE CRITERIA: 5 clear, testable points.
    2. IMPLEMENTATION STEPS: A logical sequence of technical tasks.
    3. POTENTIAL RISKS: 2-3 technical or delivery blockers to watch for.
    
    FORMAT: Professional Markdown.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt
    });
    return response.text || "I was unable to analyze this artifact.";
  } catch (error) {
    console.error("Gemini Task Error:", error);
    return "AI Refinement currently offline.";
  }
};

/**
 * AI Standup Synthesizer
 * Converts raw activity logs into executive status updates.
 */
export const generateStandupDigest = async (item: any) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `
    Analyze the recent activity for artifact ${item.key}: "${item.title}".
    
    ACTIVITY LOG:
    ${JSON.stringify((item.activity || []).slice(-10))}
    
    CURRENT STATUS: ${item.status}
    PRIORITY: ${item.priority}
    ASSIGNEE: ${item.assignedTo}

    TASK: Summarize the progress of this item for a daily standup.
    - Provide 3 bullet points: "Accomplishments", "Active Impediments", and "Next Protocol".
    - Use highly professional, concise language.
    - If the item is flagged or blocked, emphasize the risk.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt
    });
    return response.text || "Unable to synthesize standup update.";
  } catch (error) {
    return "Standup Intelligence offline.";
  }
};
