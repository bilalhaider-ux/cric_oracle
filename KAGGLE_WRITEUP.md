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

The cognitive loop of Cricket Oracle divides tasks among four specialized cognitive agents configured in a sequential pipeline via `google.adk`:

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
3. **Predictor Agent (`Agent`):** Executes on-the-fly model fitting using XGBoost. It computes the 95% Confidence Interval bounds and checks if the statistical width exceeds the safety threshold of 40 runs.
4. **Narrator Agent (`Agent`):** Translates the quantitative outputs, predictions, and historical logs into a polished, 3-sentence broadcast-quality analyst briefing.

---

## 3. Decoupled Data Layer & Custom MCP Server

The project uses a custom **Model Context Protocol (MCP)** server built with **FastMCP** to decouple the SQLite database from the LLM agent process, establishing a secure runtime isolation boundary.

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
* **Security & Environmental Sandboxing:** Start-up environment validations check for `GOOGLE_API_KEY` dynamically. No hardcoded API keys are checked into repository files, and `.env` is ignored by `.gitignore`.
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
If the interval width exceeds 60 runs, Cricket Oracle triggers a safety shutdown. The `PredictorAgent` refuses to output a point prediction, setting status to `insufficient_data` and instructing the narrator to explain the high-uncertainty factors to the user. The 60-run threshold is calibrated to T20 cricket's inherent variance — a threshold of 40 was too aggressive and flagged statistically valid players as uncertain.

---

## 6. Premium User Experience (UX)

The frontend is an interactive dashboard built using **React 18, Vite, Tailwind CSS, Framer Motion (for micro-animations), and Recharts (for charts and confidence intervals)**:
* **Live Agent Trace Logs:** Displays progress logs, tool calls, and state handoffs in real-time as the ADK pipeline runs.
* **Neon Wagon Wheel Canvas:** Draws pace vs spin strike rates and interactive vector paths showing scoring sectors.
* **Leaderboards & Stadium Profiles:** Allows users to view ELO leaderboards and stadium stats without executing runs predictions.
* **Web Audio Synthesis:** Integrates the Web Audio API to play gentle, click indicators and interface animations, giving a highly premium tactical feel.

---

## 7. Project Journey & Key Reflections

* **Phase 1 (Global Baseline):** Started with a monolithic global regression model, which suffered from severe context-averaging issues.
* **Phase 2 (MCP Architecture):** Swapped direct DB queries for typed FastMCP tools to modularize the data layer.
* **Phase 3 (ADK Orchestration):** Wired the sequential agents to share state via `ToolContext`. This allowed the final narrator to seamlessly handle predictions, warnings, and missing data states in a coherent, user-friendly manner.
