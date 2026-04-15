const { ChatOpenAI } = require('@langchain/openai');
const { PromptTemplate } = require('@langchain/core/prompts');
const { StringOutputParser } = require('@langchain/core/output_parsers');
const { Annotation, StateGraph, START, END } = require('@langchain/langgraph');
const { HumanMessage, AIMessage, SystemMessage } = require('@langchain/core/messages');
const dotenv = require('dotenv');

dotenv.config();

// Define the state for our reasoning graph
const ReasoningState = Annotation.Root({
  messages: Annotation({
    reducer: (x, y) => x.concat(y),
  }),
  research_results: Annotation({
    reducer: (x, y) => y ?? x,
  }),
  intent: Annotation({
    reducer: (x, y) => y ?? x,
  }),
  response: Annotation({
    reducer: (x, y) => y ?? x,
  }),
  is_follow_up: Annotation({
    reducer: (x, y) => y ?? x,
  }),
  location: Annotation({
    reducer: (x, y) => y ?? x,
  })
});

class AIService {
  constructor() {
    this.model = new ChatOpenAI({
      azureOpenAIApiKey: process.env.NVIDIA_API_KEY,
      apiKey: process.env.NVIDIA_API_KEY,
      configuration: {
        baseURL: process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1",
      },
      modelName: process.env.NVIDIA_MODEL || "meta/llama-3.1-70b-instruct",
      temperature: 0.05, 
      maxTokens: 4096, 
      stop: ["References:", "Conclusion:", "Sources:"] // PHYSICAL KILL-SWITCH
    });
    
    this.graph = this._buildGraph();
  }

  _buildGraph() {
    const workflow = new StateGraph(ReasoningState)
      .addNode("analyzer", this._analyzeIntent.bind(this))
      .addNode("synthesizer", this._synthesizeResponse.bind(this))
      .addEdge(START, "analyzer")
      .addEdge("analyzer", "synthesizer")
      .addEdge("synthesizer", END);

    return workflow.compile();
  }

  async _analyzeIntent(state) {
    const historyCount = state.messages.length;
    return { is_follow_up: historyCount > 1 };
  }

  async _synthesizeResponse(state) {
    return state;
  }

  /**
   * Expand user query into structured search terms.
   */
  async expandQuery(userQuery, userContext = {}) {
    const prompt = PromptTemplate.fromTemplate(`
      You are a specialized medical research assistant. Extract CORE AGENTS.
      Context: {disease} | {location}
      Query: {query}
      Respond ONLY in JSON:
      {{
        "pubmed_query": "search query",
        "clinical_trials_condition": "condition",
        "location": "location",
        "keywords": ["agents"]
      }}
    `);

    try {
      const response = await this.model.invoke(await prompt.format({
        disease: userContext.disease || "Unknown",
        location: userContext.location || "Global",
        query: userQuery
      }));
      
      const content = response.content;
      const startIdx = content.indexOf('{');
      const endIdx = content.lastIndexOf('}');
      if (startIdx === -1) throw new Error("No JSON found");
      const parsed = JSON.parse(content.substring(startIdx, endIdx + 1));
      
      return {
        pubmed_query: parsed.pubmed_query || userQuery,
        clinical_trials_condition: parsed.clinical_trials_condition || userContext.disease || userQuery,
        location: parsed.location && !['empty', 'global'].includes(parsed.location.toLowerCase()) ? parsed.location : userContext.location || "",
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [userQuery]
      };
    } catch (error) {
      console.error('Query Expansion Error:', error.message);
      return {
        pubmed_query: userQuery,
        clinical_trials_condition: userContext.disease || userQuery,
        location: userContext.location || "",
        keywords: [userQuery]
      };
    }
  }

  /**
   * Reason over research results with High-Fidelity Formatting and Stop Sequences.
   */
  async *reasonOverResearchStream(userQuery, researchResults, history = [], userLocation = '') {
    const messages = history.map(m => 
      m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content)
    );
    messages.push(new HumanMessage(userQuery));

    const isFollowUp = messages.length > 2;

    const systemPrompt = isFollowUp 
      ? `You are Curalink. Respond with medical precision. Use Markdown Headers and internal links [ID](Link). NEVER write a bibliography.`
      : `You are Curalink, a world-class health companion.
         
         FORMATTING RULE (WALL-OF-TEXT PREVENTION):
         - You MUST use Markdown Headers (##) for every section.
         - You MUST use double newlines (\\n\\n) between every paragraph and section.
         - NO BIBLIOGRAPHY: Do NOT write "References:" or any source list at the end.
         
         EVIDENCE LOCKING:
         - CITE every claim using a markdown link by copying the EXACT [LABEL](URL) provided in the Research Database below.
         - Format: [LABEL](URL). Do NOT use [1], [2], etc. No link = no claim.
         - Accuracy is paramount for metabolic and rare disease synthesis.

         STRUCTURE (Double Newline Required between each):
         ## 📋 Executive Summary
         [Brief overview]
         
         ## 🧬 Deep Biochemical Analysis
         [Molecular mechanics and pathways]
         
         ## 🩺 Clinical Status & Context
         [Current trials and ${userLocation || 'Global'} status]
         
         ## 🎯 Next Steps`;

    const researchStr = researchResults.length > 0 
      ? researchResults.map((r, i) => {
          return `[CITATION: [${r.title}](${r.url})] | Details: ${r.snippet || ''}`;
        }).join('\n')
      : "NO ACTIVE RESEARCH DATA. DO NOT CITE NON-EXISTENT PAPERS.";

    const fullPrompt = [
      new SystemMessage(systemPrompt),
      new SystemMessage(`STRICT RESEARCH CONTEXT:\n${researchStr}`),
      ...messages.slice(-5)
    ];

    try {
      const stream = await this.model.stream(fullPrompt);
      for await (const chunk of stream) {
        if (chunk.content) yield chunk.content;
      }
    } catch (error) {
      console.error('AI Streaming Error:', error.message);
      yield "I'm sorry, I encountered an error during synthesis. Please check the clinical trials listed below.";
    }
  }
}

module.exports = new AIService();
