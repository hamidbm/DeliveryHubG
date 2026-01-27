
import { GoogleGenAI, Type } from "@google/genai";

export const getPortfolioSummary = async (portfolioData: any) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Perform an in-depth analysis on this software delivery portfolio: ${JSON.stringify(portfolioData)}`;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt
    });
    return response.text || "Analysis unavailable.";
  } catch (error) { return "Error generating AI insights."; }
};

export const analyzeOperationsIntelligence = async (telemetryData: any, infraData: any) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `As a Senior SRE AI, analyze this telemetry: ${JSON.stringify(telemetryData)} and infra: ${JSON.stringify(infraData)}. Detect anomalies and suggest scaling actions in Markdown.`;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt
    });
    return response.text || "Ops intelligence unavailable.";
  } catch (error) { return "Operations Intelligence offline."; }
};

export const generateWorkPlan = async (workItem: any) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Analyze this work item and provide a structured implementation roadmap: ${JSON.stringify(workItem)}`;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt
    });
    return response.text || "Unable to analyze.";
  } catch (error) { return "AI offline."; }
};

export const suggestRationalization = async (app: any) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Act as an Enterprise Architect. Based on this application data: ${JSON.stringify(app)}, recommend one of the following TIME quadrants: INVEST, TOLERATE, MIGRATE, ELIMINATE. Provide a 2-sentence technical justification. Return JSON with 'recommendation' and 'justification' fields.`;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recommendation: { type: Type.STRING },
            justification: { type: Type.STRING }
          },
          required: ['recommendation', 'justification']
        }
      }
    });
    return JSON.parse(response.text || '{}');
  } catch (error) { 
    console.error("AI Rationalization Error", error);
    return { recommendation: 'TOLERATE', justification: 'AI analysis failed. Falling back to default baseline.' };
  }
};

export const generateStandupDigest = async (item: any) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Summarize progress for this item: ${JSON.stringify(item)}`;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt
    });
    return response.text || "Unable to synthesize.";
  } catch (error) { return "Offline."; }
};

export const suggestReassignment = async (item: any, teamCapacity: any[]) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Suggest peer for task handover: ${JSON.stringify(item)} Team: ${JSON.stringify(teamCapacity)}`;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt
    });
    return response.text || "Analysis failed.";
  } catch (error) { return "Offline."; }
};
