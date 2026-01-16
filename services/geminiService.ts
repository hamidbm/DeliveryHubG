
import { GoogleGenAI, Type } from "@google/genai";

/**
 * AI Portfolio Analyst
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
 * AI SRE Assistant
 * Analyzes telemetry and infrastructure for anomaly detection.
 */
export const analyzeOperationsIntelligence = async (telemetryData: any, infraData: any) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `
    TASK: As a Senior Site Reliability AI, analyze the following real-time telemetry and infrastructure state.
    
    TELEMETRY:
    ${JSON.stringify(telemetryData)}
    
    INFRASTRUCTURE:
    ${JSON.stringify(infraData)}
    
    REQUIREMENTS:
    1. IDENTIFY ANOMALIES: Look for CPU/Memory spikes or latency patterns that deviate from normal.
    2. OUTAGE PREDICTION: Is there a likelihood of a service degradation in the next 4 hours?
    3. OPTIMIZATION: Suggest instance scaling or resource redistribution.
    
    FORMAT: Professional SRE Markdown with "Observability Alert" headers where risks are found.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt
    });
    return response.text || "Ops intelligence currently unavailable.";
  } catch (error) {
    return "Operations Intelligence offline.";
  }
};

/**
 * AI Task Co-Pilot
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

/**
 * AI Adaptive Resourcing
 */
export const suggestReassignment = async (item: any, teamCapacity: any[]) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `
    TASK: Find the optimal peer engineer to take over an artifact from an overloaded resource.
    
    ARTIFACT: ${item.key} - ${item.title}
    CURRENT ASSIGNEE: ${item.assignedTo} (OVERLOADED)
    CONTEXT: ${item.description || 'General engineering task'}
    
    AVAILABLE TEAM NODES:
    ${JSON.stringify(teamCapacity)}
    
    ANALYSIS REQUIREMENTS:
    1. Identify the top 2 candidates based on lowest current load and matching skills (inferred from names/roles).
    2. Provide a "Suitability Index" (0-100) for each.
    3. Give a 1-sentence justification for the hand-off.
    
    FORMAT: Professional Markdown with a clear recommendation.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt
    });
    return response.text || "Re-allocation analysis failed.";
  } catch (error) {
    return "Resource Intelligence offline.";
  }
};
