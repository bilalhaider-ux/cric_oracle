# 🏏 Cricket Oracle: Multi-Agent T20 Batting Performance Predictor

**A production-grade, multi-agent AI statistical reasoning system built on the Google Agent Development Kit (ADK), powered by Gemini 2.5 Flash, served through a custom Model Context Protocol (MCP) runtime, with zero data leakage by construction.**

> **Capstone Track:** Freestyle (Built for the Kaggle × Google 5-Day AI Agents Intensive Capstone)

---

## 1. Executive Solution Overview & Value Proposition

### The Problem: The "Context-Averaging" Bias in Sports Analytics
In professional T20 cricket, predicting a batsman's runs in an upcoming match is challenging due to high variance. Most sports analytics tools fall into the **Context-Averaging Bias**. This occurs when a model is trained globally across a whole dataset containing thousands of players. Because it averages the features across all rows, it predicts a regression toward the mean—somewhere around **~30 to 35 runs**—regardless of whether the batsman is a top-order anchor like Babar Azam or a lower-order tail-ender. The prediction is technically "not wrong," but it lacks player-specific significance.

### The Solution: Cricket Oracle
**Cricket Oracle** addresses this critical flaw by employing a **local, per-player modeling strategy**. Instead of relying on one global model, Cricket Oracle splits the 197,620-row feature table down to the specific player's career trajectory and dynamically trains a customized **XGBoost Regressor** on that individual’s history on-the-fly.

### The Core Value
* **Per-Player Model Fitting:** Models learn unique career signals, separating elite run-scorers from lower-order batsmen.
* **Bootstrapped Honesty:** Generates a **95% bootstrapped confidence interval** using 100 resamples to output reliable uncertainty bounds.
* **Low-Confidence Guardrail:** If the confidence interval width exceeds 60 runs, the system activates a guardrail, explicitly returning `insufficient_data` instead of guessing, protecting downstream decisions from high-uncertainty environments.
* **Zero-Leakage Feature Pipeline:** Computes ELO ratings, recent form, and venue strike rates strictly chronologically using *pre-match-only* data (strict chronological backtesting).

---

## 2. The Multi-Agent Pipeline (Sequential ADK)

Cricket Oracle divides work across four specialized agents in a sequential pipeline via `google.adk`:

```
┌─────────────────┐      ┌───────────────┐      ┌─────────────────┐      ┌───────────────┐
│  PlannerAgent   │ ───> │ FeatureAgent  │ ───> │ PredictorAgent  │ ───> │ NarratorAgent │
└─────────────────┘      └───────────────┘      └─────────────────┘      └───────────────┘
 Decomposes query          Queries MCP           Fits XGBoost &           Synthesizes 3-
 into execution plan       database tools        computes 95% CIs         sentence insights
```

### Agent Roles & Workflows:
1. **Planner Agent (`SequentialAgent`):** Receives the natural language query, plans the data execution path, and sequences sub-agent invocation.
2. **Feature Agent (`Agent`):** Connects to the custom MCP server to query database tables. It extracts features like `rolling_10_bat_avg`, `rolling_10_bat_sr`, `recent_form_score`, and `elo_rating`, storing them inside the shared `ToolContext.state`.
3. **Predictor Agent (`Agent`):** Executes on-the-fly model fitting using XGBoost. It computes the 95% Confidence Interval bounds and checks if the statistical width exceeds the safety threshold of 60 runs.
4. **Narrator Agent (`Agent`):** Translates the quantitative outputs, predictions, and historical logs into a polished, 3-sentence broadcast-quality analyst briefing.

---

## 3. Decoupled Data Layer & Custom MCP Server

The project uses a custom **Model Context Protocol (MCP)** server built with **FastMCP** to decouple the SQLite database from the LLM agent process. Agents call typed tools instead of raw SQL — the data layer is completely swappable without touching agent logic.

### MCP Tools Exposed:
* `get_player_stats(player_name)`: Fetches latest career averages, ELO rating, and venue strike rate.
* `get_player_last10(player_name)`: Returns the detailed scorecard of the player's last 10 T20 matches.
* `get_top_players(metric, n)`: Ranks the top N players sorted by ELO rating, form score, or strike rate.
* `get_venue_stats(venue_name)`: Queries aggregated match stats, average team scores, and run-rates at the stadium.

The SQLite database (`cricket_oracle.db`) indexes **197,620 engineered feature rows** from matches played globally. Indexing on `player`, `venue`, and `date` fields ensures queries execute in sub-milliseconds.

---

## 4. Technical Implementation & Best Practices

The codebase applies the core concepts taught in Kaggle's 5-Day Intensive course:

* **ADK Multi-Agent Architecture:** Custom `google.adk` sequence loops with isolated instructions and tool registries.
* **Decoupled System Nodes:** FastMCP server acts as the secure query interface, keeping the database logic separated from LLM reasoning.
* **Environment validation:** API key is checked at startup; no credentials are hardcoded. `.env` is gitignored.
* **Clean Code & Comments:** Inline annotations document validation rules, data classifications, and state parameters.

---

## 5. Machine Learning & Safety Guardrails

### Model Training Details:
When predicting performance:
1. **Feature Matrix:** The training matrix uses: `rolling_10_bat_avg`, `rolling_10_bat_sr`, `recent_form_score`, `venue_adjusted_sr`, and `elo_rating`.
2. **Regressor Configuration:** `XGBoostRegressor(n_estimators=100, max_depth=4, learning_rate=0.08)`.
3. **Rolling-Average Anchor:** The XGBoost point prediction is blended 50/50 with the player's `rolling_10_bat_avg`. This anchors predictions to individual career trajectory, preventing regression toward the dataset mean (~30 runs) common in high-variance T20 data.
4. **Bootstrap Resampling:** 100 random resamples with replacement compute the 95% CI (2.5th and 97.5th percentiles). The same rolling-average blend is applied to each bootstrap prediction for CI consistency.

### Statistical Guardrail Activation:
$$\text{CI Width} = \text{Upper CI} - \text{Lower CI}$$
If the interval width exceeds 60 runs, the `PredictorAgent` first attempts an **autonomous recovery**: if the user queried a specific match type (international/league), the agent automatically widens the training set to all match types and re-runs. Only if the retry also produces a wide CI does it return `insufficient_data`. This makes the system genuinely agentic — it recovers from uncertainty without user intervention.

### Walk-Forward Backtesting Results
Validated on 12 top players × last 20 matches each (240 predictions total):

| Method | MAE (runs) |
|--------|-----------|
| Dumb baseline (always predict 25) | 18.9 |
| Naive rolling average only | 16.5 |
| **Cricket Oracle (XGBoost + rolling blend)** | **14.4** |

Cricket Oracle achieves **14.4 MAE** — 23% better than a dumb baseline and 12% better than rolling average alone. In T20 cricket where scores range 0–175+, a 14-run mean error is competitive with published sports forecasting benchmarks.

---

## 6. Premium User Experience (UX)

The frontend is an interactive dashboard built using **React 18, Vite, Tailwind CSS, Framer Motion (for micro-animations), and Recharts (for charts and confidence intervals)**:
* **Live Agent Trace Logs:** Displays progress logs, tool calls, and state handoffs in real-time as the ADK pipeline runs.
* **Neon Wagon Wheel Canvas:** Draws pace vs spin strike rates and interactive vector paths showing scoring sectors.
* **Leaderboards & Stadium Profiles:** Allows users to view ELO leaderboards and stadium stats without executing runs predictions.
* **Web Audio Synthesis:** Integrates the Web Audio API to play gentle, click indicators and interface animations, giving a highly premium tactical feel.

---

## 7. Why Multi-Agent? (The ADK Justification)

A common question: *"Could this be a single Python script?"* Technically yes — but the multi-agent architecture solves real engineering problems:

**Problem 1 — Separation of reasoning and computation**
A single script cannot distinguish *"I need more data"* from *"the data is insufficient."* The `PredictorAgent` makes that judgment call and signals back to the `NarratorAgent` via `ToolContext.state`, which then adjusts its language accordingly. A script would require hardcoded `if/else` chains.

**Problem 2 — Autonomous error recovery**
When the CI exceeds the confidence threshold, the `PredictorAgent` autonomously retries with a broader dataset — a true agent decision loop. In a script, this would be a function call with no reasoning; here it's a deliberate agent-level choice.

**Problem 3 — Decoupled data access**
The FastMCP server lets the `FeatureAgent` call typed, validated tools without knowing SQL. Swapping the database (SQLite → BigQuery, for example) requires only changing the MCP server — not touching any agent logic. This is impossible in a monolithic script.

**Problem 4 — Natural language as glue**
The `NarratorAgent` writes cricket commentary that adapts to prediction success, insufficient data, and agent fallback events — all from the same instruction set. A script would need a template for each case.

---

## 8. Project Journey & Key Reflections

* **Phase 1 (Global Baseline):** Started with a monolithic global regression model, which suffered from severe context-averaging bias — predicting ~30 runs for every player regardless of form or quality.
* **Phase 2 (MCP Architecture):** Swapped direct DB queries for typed FastMCP tools to modularize the data layer. This decoupled SQLite from agent logic and made the data layer independently testable.
* **Phase 3 (ADK Orchestration):** Wired the sequential agents to share state via `ToolContext`. Added the rolling-average blend to make predictions player-specific, and autonomous retry logic so the `PredictorAgent` recovers from low-confidence states without user input.
* **Key insight:** The biggest challenge was not the ML — it was making the agents genuinely *reason* rather than just *execute*. The retry logic and the `insufficient_data` branching in the NarratorAgent are the moments where ADK's agent model adds real value over a pipeline.
