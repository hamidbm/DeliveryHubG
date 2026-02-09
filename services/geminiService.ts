import { GoogleGenAI, Type } from "@google/genai";

// Strictly use process.env.API_KEY directly during initialization.
// This service should only be called from API routes (Server Context).
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY as string });

export const getPortfolioSummary = async (portfolioData: any, model: string = 'gemini-3-pro-preview') => {
  const ai = getAI();
  const prompt = `Perform an in-depth analysis on this software delivery portfolio: ${JSON.stringify(portfolioData)}`;
  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt
    });
    return response.text || "Analysis unavailable.";
  } catch (error) { 
    console.error("Gemini Error:", error);
    return "Error generating AI insights. Check API configuration."; 
  }
};

export const analyzeOperationsIntelligence = async (telemetryData: any, infraData: any, model: string = 'gemini-3-flash-preview') => {
  const ai = getAI();
  const prompt = `As a Senior SRE AI, analyze this telemetry: ${JSON.stringify(telemetryData)} and infra: ${JSON.stringify(infraData)}. Detect anomalies and suggest scaling actions in Markdown.`;
  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt
    });
    return response.text || "Ops intelligence unavailable.";
  } catch (error) { return "Operations Intelligence offline."; }
};

export const analyzeTerraform = async (code: string, provider: string, model: string = 'gemini-3-flash-preview') => {
  const ai = getAI();
  const prompt = `Act as a Cloud Architect. Analyze this ${provider} Terraform script for: 1. Security Risks 2. Cost Optimization 3. Best Practices. Provide a structured review in Markdown. Terraform code: \n\n${code}`;
  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt
    });
    return response.text || "IaC Analysis unavailable.";
  } catch (error) { return "AI Infra Analyzer offline."; }
};

export const generateDiagramFromTerraform = async (code: string, model: string = 'gemini-3-pro-preview') => {
  const ai = getAI();
  const prompt = `As a Cloud Architect, convert this Terraform HCL code into a high-quality Mermaid.js flowchart (LR). 
  Guidelines:
  1. Use subgraphs to group tiers (e.g., Edge, App Tier, Data Layer).
  2. Create logical connections (e.g., LB to VM, VM to DB).
  3. Use clean node labels (e.g., instead of 'azurerm_kubernetes_cluster.aks', use 'AKS Cluster').
  4. Include basic Mermaid styling classes (classDef).
  Return ONLY the Mermaid code block starting with 'graph LR' or 'flowchart LR'.
  
  Terraform Code:
  ${code}`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt
    });
    
    const text = response.text || "";
    const cleanMermaid = text.replace(/```mermaid/g, '').replace(/```/g, '').trim();
    
    if (!cleanMermaid || (!cleanMermaid.toLowerCase().includes('graph') && !cleanMermaid.toLowerCase().includes('flowchart'))) {
        throw new Error("Invalid Output Format");
    }
    
    return cleanMermaid;
  } catch (error: any) {
    console.error("Gemini Diagram Error:", error);
    const errStr = error?.message || "";
    if (errStr.includes("401") || errStr.includes("403") || errStr.includes("key")) {
        return "ERROR_AUTH: API Key Unauthorized or Missing";
    }
    return "graph LR\n  Error[AI failed to parse HCL]";
  }
};

export const generateWorkPlan = async (workItem: any, model: string = 'gemini-3-flash-preview') => {
  const ai = getAI();
  const prompt = `Analyze this work item and provide a structured implementation roadmap: ${JSON.stringify(workItem)}`;
  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt
    });
    return response.text || "Unable to analyze.";
  } catch (error) { return "AI offline."; }
};

export const suggestRationalization = async (app: any, model: string = 'gemini-3-flash-preview') => {
  const ai = getAI();
  const prompt = `Act as an Enterprise Architect. Based on this application data: ${JSON.stringify(app)}, recommend one of the following TIME quadrants: INVEST, TOLERATE, MIGRATE, ELIMINATE. Provide a 2-sentence technical justification. Return JSON with 'recommendation' and 'justification' fields.`;
  try {
    const response = await ai.models.generateContent({
      model,
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

export const generateStandupDigest = async (item: any, model: string = 'gemini-3-flash-preview') => {
  const ai = getAI();
  const prompt = `Summarize progress for this item: ${JSON.stringify(item)}`;
  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt
    });
    return response.text || "Unable to synthesize.";
  } catch (error) { return "Offline."; }
};

export const suggestReassignment = async (item: any, teamCapacity: any[], model: string = 'gemini-3-flash-preview') => {
  const ai = getAI();
  const prompt = `Suggest peer for task handover: ${JSON.stringify(item)} Team: ${JSON.stringify(teamCapacity)}`;
  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt
    });
    return response.text || "Analysis failed.";
  } catch (error) { return "Offline."; }
};

export type WikiAssistTask = 'improve' | 'expand' | 'diagram' | 'summary';

export const buildWikiPrompt = (task: WikiAssistTask, content: string, format: string, title?: string) => {
  const header = title ? `Title: ${title}\n\n` : '';
  const formatHint = format === 'html' ? 'HTML' : 'Markdown';

  switch (task) {
    case 'improve':
      return `${header}Improve the clarity and flow of the following ${formatHint} content. Preserve meaning and structure, avoid adding new sections unless necessary.\n\nContent:\n${content}`;
    case 'expand':
      return `${header}Expand the following ${formatHint} outline into a richer, more detailed section. Keep the original headings and structure.\n\nContent:\n${content}`;
    case 'diagram':
      return `${header}Generate a Mermaid diagram based on the following content. Return ONLY a Mermaid code block fenced with mermaid syntax. Prefer flowchart or sequence diagrams.\n\nContent:\n${content}`;
    case 'summary':
    default:
      return `${header}Provide a concise summary (3-5 bullet points or a short paragraph) of the following content in ${formatHint}.\n\nContent:\n${content}`;
  }
};

export const generateWikiAssistance = async ({
  task,
  content,
  format,
  title,
  model
}: {
  task: WikiAssistTask;
  content: string;
  format: string;
  title?: string;
  model: string;
}) => {
  const ai = getAI();
  const prompt = buildWikiPrompt(task, content, format, title);
  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt
    });
    return response.text || "AI response unavailable.";
  } catch (error) {
    console.error("Gemini Wiki Assist Error:", error);
    return "AI response unavailable.";
  }
};
