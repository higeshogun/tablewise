# TableWise Chrome Extension

**TableWise** is a powerful Chrome Extension that allows you to instantly analyze tabular data from any webpage or your clipboard using Google's Gemini AI.



## Use Cases
- **💰 Financial Research**: Instantly summarize quarterly earnings reports or stock history from news sites.
- **🛒 Product Comparison**: Compare specs, prices, and online reviews in a clean, query-able format.
- **📊 Sports Analytics**: Extract and analyze player statistics from favorite sports websites.
- **🎓 Academic Research**: Quickly digitize and question data tables from web-based PDF viewers or reference materials.

## Features
- **Analyze Page**: Automatically detects and extracts tables (HTML or AG Grid) from the active tab.
- **Analyze Clipboard**: Paste Excel/Sheets data directly to get insights.
- **AI Chat**: Ask questions, get summaries, and identify trends using the integrated chat interface.
- **Smart Suggestions**: Get auto-generated follow-up questions based on your data.
- **Privacy Focused**: Your API Key is stored locally. Data is sent to Gemini only when you explicitly analyze it.

## Installation
1. Clone this repository.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer Mode** (toggle in top right).
4. Click **Load Unpacked**.
5. Select this folder.

## setup
1. Click the extension icon.
2. Open **Settings** (gear icon).
3. Enter your [Google Gemini API Key](https://aistudio.google.com/app/apikey).
4. Start analyzing!

## Tech Stack
- Manifest V3
- Vanilla JS / CSS
- Google Gemini API

## License
MIT
