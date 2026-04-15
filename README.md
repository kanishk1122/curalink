# Curalink — AI Medical Research Assistant

Curalink is a full-stack, AI-powered medical research assistant designed to act as a **health research companion**. It understands user clinical context, retrieves high-quality medical research from global databases, and delivers structured, personalized, and source-backed answers.

---

## 🎯 Overview

Curalink goes beyond a simple chatbot. It is a **research + reasoning system** that:
- **Understands Context**: Accepts disease, user intent, and location.
- **Deep Retrieval**: Fetches data from PubMed, OpenAlex, and ClinicalTrials.gov.
- **AI Reasoning**: Uses a custom open-source LLM to synthesize research into friendly, non-technical insights.
- **Patient-Centric**: Delivers structured, non-hallucinated responses with proper source attribution.

---

## 💡 Core Features

### 1. Intelligent Search & Query Expansion
- Handles both structured and natural language queries.
- Automatically expands queries to include relevant medical terms.
- **Example**: Searching for "deep brain stimulation" automatically includes context like "Parkinson's disease" if previously discussed.

### 2. Deep Research Retrieval
Curalink demonstrates **depth first, then precision** by:
- Retrieving candidate pools of **50–300 results** across three major APIs.
- Applying intelligent **filtering and ranking** based on recency and relevance.
- Displaying the **top 8 most impactful** publications and clinical trials.

### 3. Clinical Trials Integration
- Fetches ongoing or completed trials from **ClinicalTrials.gov API**.
- Includes critical data: Title, Recruiting Status, Eligibility, and Location details.
- Helps patients discover emerging therapies and future medical advancements.

### 4. Custom LLM Reasoning (Privacy & Control)
- Powered by a custom open-source LLM orchestration (via NVIDIA NIM).
- Ensures data isn't just "pasted" but **reasoned over** to generate structured responses.
- **Source Attribution**: Every claim includes the title, authors, year, and platform URL.

---

## 🏗️ Tech Stack

### Frontend
- **React** (Vite)
- **Tailwind CSS v4** (Premium Light Mode UI/UX)
- **Framer Motion** (Smooth Transitions)
- **Lucide React** (Iconography)

### Backend
- **Node.js & Express**
- **Prisma ORM** (PostgreSQL)
- **Socket.io** (Real-time Reasoning Progress)
- **LangChain** (AI Orchestration)

### AI & Data
- **NVIDIA NIM** (Llama-3.1-70B-Instruct)
- **PubMed API** (NCBI)
- **OpenAlex API**
- **ClinicalTrials.gov API v2**

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- Docker (for PostgreSQL)
- NVIDIA NIM API Key

### Backend Setup
1. `cd server`
2. `npm install`
3. Create a `.env` file:
   ```env
   DATABASE_URL="postgresql://postgres:postgres@localhost:5433/curalink?schema=public"
   NVIDIA_API_KEY="your_key_here"
   NVIDIA_BASE_URL="https://integrate.api.nvidia.com/v1"
   NVIDIA_MODEL="meta/llama-3.1-70b-instruct"
   ```
4. Start Docker: `docker-compose up -d`
5. Run Migrations: `npx prisma migrate dev`
6. Start: `npm run dev` (Port 5000)

### Frontend Setup
1. `cd client`
2. `npm install`
3. Start: `npm run dev` (Port 5173)

---

## 🧪 Example Use Cases
- "Latest treatment for lung cancer in New York"
- "Ongoing clinical trials for Type 2 Diabetes"
- "Recent studies on heart disease and Vitamin D"

---

## 📝 Submission Evaluation Criteria
- 🧠 **AI Pipeline Quality**: How the query is expanded and reasoned.
- 🔍 **Retrieval Accuracy**: Quality of merged data from all three sources.
- ⚙️ **Engineering Depth**: Filtering, ranking, and response structure.
- 🎯 **Usability**: SMOOTHness of the UI/UX.
- 🎥 **Demo Clarity**: The Loom video walkthrough.

---

*This project was built for the **Humanity Founders - Curalink Hackathon**.*
# curalink
