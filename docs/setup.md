# Setup Guide

Follow these instructions to configure and run the CricketOracle stack locally.

---

## Prerequisites

Ensure you have the following installed:

*   **Python 3.10+**
*   **Node.js 18+ & npm**
*   **pip** (Python package installer)

---

## 1. Clone & Environment Setup

Clone the project repository and create a `.env` file at the root folder:

```bash
# Create local configuration registry
touch .env
```

Add your credentials to `.env`:

```env
# CricketOracle Local Config
GOOGLE_API_KEY="your-gemini-api-key-here"
```

---

## 2. Backend Installation & Run

1.  Install Python dependencies:
    ```bash
    pip install fastapi uvicorn pandas numpy xgboost google-genai python-dotenv mcp
    ```
2.  Start the FastAPI server on port `8001`:
    ```bash
    python api.py
    ```

---

## 3. Frontend Installation & Run

1.  Navigate to the frontend directory:
    ```bash
    cd frontend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Launch the Vite developer server:
    ```bash
    npm run dev
    ```

Open `http://localhost:3000` in your web browser to access the app interface.
