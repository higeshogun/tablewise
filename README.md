# TableWise Chrome Extension

**TableWise** is a powerful Chrome Extension that allows you to instantly analyze tabular data from any webpage or your clipboard using Google's Gemini AI, openrouter model or a **Local LLM** (via Ollama).

## Screenshots
![TableWise Demo](screenshots/demo.png)

## Use Cases
- **💰 Financial Research**: Instantly summarize quarterly earnings reports or stock history from news sites.
- **🛒 Product Comparison**: Compare specs, prices, and online reviews in a clean, query-able format.
- **📊 Sports Analytics**: Extract and analyze player statistics from favorite sports websites.
- **🎓 Academic Research**: Quickly digitize and question data tables from web-based PDF viewers or reference materials.

## Features
- **Analyze Page**: Automatically detects and extracts tables (HTML or AG Grid) from the active tab.
- **Analyze Clipboard**: Paste Excel/Sheets data directly to get insights.
- **AI Chat**: Ask questions, get summaries, and identify trends using the integrated chat interface.
- **Persistent Chat History**: Previous conversations are saved and restored automatically.
- **Agentic RAG**: Uses a two-step "Planner & Executor" system to intelligently filter large datasets before answering, ensuring high accuracy.
- **Local LLM Support**: Connect to **Ollama** or **LocalAI** for private, offline analysis.
- **OpenRouter Support**: Access any model (Claude 3.5, GPT-4, Llama 3) via OpenRouter API.
- **Smart Suggestions**: Context-aware follow-up questions generated automatically.
- **Privacy Focused**: Your API Key is stored locally. Data is sent to the AI provider only when you explicitly analyze it.

## Installation
1. Clone this repository.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer Mode** (toggle in top right).
4. Click **Load Unpacked**.
5. Select this folder.

## Setup

### Option A: Google Gemini (Cloud)
1. Click the extension icon and open **Settings** (gear icon).
2. Select **Provider: Google Gemini**.
3. Enter your [Google Gemini API Key](https://aistudio.google.com/app/apikey).
4. Start analyzing!

### Option B: Local LLM (Ollama)
1. Install [Ollama](https://ollama.com).
2. **Important**: You must set `OLLAMA_ORIGINS` to allow the extension to connect.
   Run Ollama with this command:
   ```bash
   # Mac/Linux
   OLLAMA_ORIGINS="*" ollama serve
   ```
3. In TableWise Settings, select **Provider: Local LLM**.
4. Set Base URL (default is `http://localhost:11434/v1`).
5. Enter your model name (e.g., `llama3`).
6. **Max Context Rows**: Adjust this setting to control how much data is sent to the local model (Default: 50 rows).

### Option C: OpenRouter (Any Model)
1. Get an API Key from [OpenRouter](https://openrouter.ai).
2. In TableWise Settings, select **Provider: OpenRouter**.
3. Enter your **OpenRouter API Key**.
4. Set the Model Name (e.g., `google/gemini-2.0-flash-exp:free`, `anthropic/claude-3-haiku`).
5. Click **Check Models** to see what's available to your key.

## Tech Stack
- Manifest V3
- Vanilla JS / CSS
- Google Gemini API
- OpenAI-Compatible API Client (Ollama/OpenRouter)
- Agentic RAG Pipeline (Planner/Executor)

## License
MIT
