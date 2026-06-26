# CricketOracle

> **T20 Cricket Performance Predictor — Multi-Agent System built on Google ADK.**

Welcome to the developer documentation for **CricketOracle**. 

CricketOracle uses a sequential multi-agent pipeline to deliver per-player XGBoost predictions with bootstrapped confidence intervals, served through a FastMCP data layer and a React frontend.

---

## Key Features

*   **4-Agent ADK Pipeline**: PlannerAgent (SequentialAgent) → FeatureAgent → PredictorAgent → NarratorAgent, sharing state via `ToolContext.state`.
*   **Per-Player XGBoost**: Trains a fresh model on each player's career history, blended 50/50 with their rolling average to prevent dataset-mean regression.
*   **Statistical Guardrail**: CI width > 60 runs triggers autonomous retry (widens match filter) or returns `insufficient_data` if retry also fails.
*   **FastMCP Data Layer**: 4 typed tools expose the 197,620-row SQLite database to agents without raw SQL.

---

## Document Navigation

*   [**Setup Guide**](setup.md) — Get the backend FastAPI server and React client up and running locally.
*   [**Architecture**](architecture.md) — Agent connections, execution pipeline, and feature importance.
*   [**API Reference**](api.md) — Backend routes, parameters, and MCP tool bindings.
