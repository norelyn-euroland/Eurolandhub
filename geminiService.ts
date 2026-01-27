
import { GoogleGenAI, Type } from "@google/genai";
import { Applicant } from "./types";

export const analyzeApplicant = async (applicant: Applicant) => {
  // Always initialize GoogleGenAI inside the function to ensure the latest API key is used.
  // Use named parameter as required by the SDK.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    Analyze the following investor profile for potential risks or inconsistencies.
    
    Investor Profile:
    - Name: ${applicant.fullName}
    - Type: ${applicant.type}
    - Email: ${applicant.email}
    - Status: ${applicant.status}
    - Submission Date: ${applicant.submissionDate}

    Return a JSON response evaluating:
    1. A risk score from 0-100 (100 being highest risk).
    2. A brief executive summary.
    3. Any flagged discrepancies.
    4. A final recommendation (APPROVE, REJECT, or FURTHER_INFO).
  `;

  try {
    const response = await ai.models.generateContent({
      // Using gemini-3-pro-preview for complex reasoning and risk assessment tasks.
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            riskScore: { type: Type.NUMBER },
            summary: { type: Type.STRING },
            discrepancies: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            recommendation: { type: Type.STRING }
          },
          required: ["riskScore", "summary", "discrepancies", "recommendation"]
        }
      }
    });

    // Access the .text property directly (it is not a method).
    const text = response.text;
    return text ? JSON.parse(text) : null;
  } catch (error) {
    console.error("AI Analysis failed:", error);
    return null;
  }
};
