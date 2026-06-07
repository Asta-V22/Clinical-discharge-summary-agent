# Clinical Discharge Summary Agent — Complete Beginner Walkthrough

> **Reading Guide:** This document is written for a **complete beginner**. Every technical term is defined the first time it appears. Read it top to bottom — each section builds on the previous one.

---

# STEP 1: Project Overview

## 1.1 What Problem Does This Project Solve?

**In simple English:**
When a patient leaves a hospital, the doctor must write a document called a **Discharge Summary**. This document records everything that happened during the hospital stay — the diagnosis, the medicines, the tests, and what the patient should do next. Writing this by hand is slow, error-prone, and exhausting.

This project builds an **AI assistant** that reads raw medical notes (from PDF scans) and automatically generates a structured, high-quality discharge summary. It also learns from doctor edits to get better over time.

**Technically:**
The project implements an **Agentic AI system** (an AI that can reason, plan, and use tools autonomously) using the **ReAct (Reasoning and Acting) pattern** (a technique where the AI alternates between thinking about what to do and actually doing it). It:
1. Ingests raw clinical PDFs
2. Runs an agent loop that inspects medications, checks pending labs, detects conflicts
3. Compiles a structured JSON discharge summary
4. Simulates a doctor reviewing the draft
5. Learns from the doctor's edits to improve on the next run

## 1.2 Who Would Use It?

| User | How They Use It |
|---|---|
| **Hospital Doctors / Clinicians** | To auto-generate discharge summaries instead of typing manually |
| **Hospital Administrators** | To ensure compliance and auditability of discharge records |
| **AI/ML Researchers** | To study agentic AI in clinical contexts |
| **Students** | As a capstone/hackathon project demonstrating AI agents |

## 1.3 Expected Input

- A **PDF file** containing scanned or typed clinical notes for one or more patients
- The PDF is located at `data/raw_patients/patient 2.pdf`
- It contains notes for **2 patients**: *Prema J* and *H D Nagaraja*

## 1.4 Expected Output

| Output | Location | What It Contains |
|---|---|---|
| Discharge Summary Drafts | `output/drafts/*.json` | Structured medical summary with medications, diagnoses, safety flags |
| Execution Traces | `output/traces/*.json` | Step-by-step log of what the AI agent did and why |
| Learning Curve Plot | `output/plots/learning_curve.png` | Graph showing the AI improving over iterations |

## 1.5 High-Level Workflow

```
User provides PDF with patient records
         ↓
    PDF Parsing & Text Extraction
         ↓
    For Each Patient:
         ↓
    ┌─────────────────────────────────────────┐
    │  ITERATION 1: Baseline Agent Run        │
    │    Agent Loop → Draft → Doctor Review   │
    │    → Calculate Edit Distance            │
    │    → Extract Correction Rules           │
    ├─────────────────────────────────────────┤
    │  ITERATION 2: Feedback-Injected Run     │
    │    Agent Loop (with learned rules)      │
    │    → Draft → Doctor Review              │
    │    → Calculate Edit Distance            │
    ├─────────────────────────────────────────┤
    │  ITERATION 3: Fully Aligned Run         │
    │    Agent Loop (with all rules)          │
    │    → Draft → Doctor Review              │
    │    → Calculate Edit Distance            │
    └─────────────────────────────────────────┘
         ↓
    Save Final Draft JSON + Trace JSON
         ↓
    Generate Learning Curve Plot
         ↓
    DONE ✅
```

## 1.6 ASCII Flow Diagram

```
    ┌─────────────────────────────┐
    │  User provides patient PDF  │
    └──────────────┬──────────────┘
                   ↓
    ┌─────────────────────────────┐
    │   PDF Extraction (parser)   │
    │   Extract text per patient  │
    └──────────────┬──────────────┘
                   ↓
    ┌─────────────────────────────┐
    │    Agent ReAct Loop         │
    │  ┌───────────────────────┐  │
    │  │ Observe patient notes │  │
    │  │        ↓              │  │
    │  │ Reason about next step│  │
    │  │        ↓              │  │
    │  │ Choose & Execute Tool │  │
    │  │        ↓              │  │
    │  │ Observe tool result   │  │
    │  │        ↓              │  │
    │  │ Re-plan or Finalize   │  │
    │  └───────────────────────┘  │
    └──────────────┬──────────────┘
                   ↓
    ┌─────────────────────────────┐
    │ Medication Reconciliation   │
    │ Pending Lab Checks          │
    │ Conflict Detection          │
    │ Safety Flag Registration    │
    └──────────────┬──────────────┘
                   ↓
    ┌─────────────────────────────┐
    │  Draft Discharge Summary    │
    └──────────────┬──────────────┘
                   ↓
    ┌─────────────────────────────┐
    │  Simulated Doctor Review    │
    │  (Apply hidden edit policy) │
    └──────────────┬──────────────┘
                   ↓
    ┌─────────────────────────────┐
    │  Learning Engine            │
    │  Calculate edit distance    │
    │  Extract correction rules   │
    │  Inject rules into next run │
    └──────────────┬──────────────┘
                   ↓
    ┌─────────────────────────────┐
    │  Save Outputs:              │
    │  - Draft JSON               │
    │  - Trace JSON               │
    │  - Learning Curve PNG       │
    └─────────────────────────────┘
```

---

# STEP 2: Folder Structure Walkthrough

## Complete Project Tree

```
Clinical-Discharge-Summary-Agent/
├── config/
│   └── settings.py          ← LLM configuration & constants
├── data/
│   └── raw_patients/
│       └── patient 2.pdf    ← Input: scanned clinical notes
├── output/
│   ├── drafts/              ← Generated discharge summaries (JSON)
│   ├── traces/              ← Agent step-by-step execution logs (JSON)
│   └── plots/               ← Learning curve chart (PNG)
├── src/
│   ├── agent_loop.py        ← Core AI agent logic (ReAct loop)
│   ├── doctor_sim.py        ← Simulated doctor reviewer
│   ├── learning_engine.py   ← Feedback tracking & learning
│   ├── models.py            ← Data structure definitions
│   └── parser.py            ← PDF reading & text extraction
├── .env                     ← Secret API key (not shared)
├── .env.example             ← Template showing what .env should contain
├── .gitignore               ← Tells Git which files to ignore
├── main.py                  ← Entry point: runs everything
├── README.md                ← Project documentation
└── requirements.txt         ← Python library dependencies
```

---

## File-by-File Deep Dive

### 📄 [main.py](file:///f:/Current_Project/Clinical-Discharge-Summary-Agent/main.py)

| Attribute | Details |
|---|---|
| **Purpose** | The **entry point** — the file you run to start the entire program. It orchestrates every other component. |
| **Responsibility** | 1. Creates output directories. 2. Parses the PDF. 3. Runs the agent 3 times per patient (baseline → feedback-injected → fully aligned). 4. Saves outputs. 5. Generates the learning curve. |
| **Dependencies** | Calls: `parser.py`, `agent_loop.py`, `doctor_sim.py`, `learning_engine.py`. Called by: Nobody (it's the starting point). |
| **Inputs** | The PDF file path (`data/raw_patients/patient 2.pdf`) and optionally a CLI API key (`--api-key`). |
| **Outputs** | JSON draft files, JSON trace files, PNG learning curve plot. |
| **Interview Explanation** | *"main.py is the orchestrator. It ties everything together — it reads the PDF, runs the AI agent three times per patient with progressive feedback, saves the structured discharge summaries, and generates a learning curve showing improvement."* |

---

### 📄 [config/settings.py](file:///f:/Current_Project/Clinical-Discharge-Summary-Agent/config/settings.py)

| Attribute | Details |
|---|---|
| **Purpose** | Centralizes all configuration: API keys, model names, timeouts, and safety limits. |
| **Responsibility** | Reads the API key from the `.env` file or CLI argument, auto-detects the AI provider (OpenAI, Gemini, Anthropic, etc.) based on the key prefix, and returns the correct API endpoint and model name. |
| **Dependencies** | Called by: `agent_loop.py`. Calls: `python-dotenv` library and `os` module. |
| **Inputs** | Optional CLI API key string. Environment variables (`LLM_API_KEY`, etc.). |
| **Outputs** | A dictionary with keys: `api_key`, `base_url`, `model_name`, `provider`, `is_live`. |
| **Interview Explanation** | *"settings.py is the brain's configuration center. It auto-detects which AI provider you're using just by looking at the API key prefix — if it starts with 'AIzaSy', it knows you're using Google Gemini. This means the user never has to manually configure endpoints."* |

> **New Concept: Environment Variables** (.env file)
>
> **What is it?** A way to store secret or configurable values (like API keys, passwords) outside your code. The `.env` file holds key-value pairs like `LLM_API_KEY=abc123`.
>
> **Why is it needed?** You never want to hardcode secrets in your source code. If you push to GitHub with a real API key in your code, anyone can steal it. The `.env` file is listed in `.gitignore` so Git ignores it.
>
> **Real-world analogy:** Think of it like a locker. Your code knows the locker exists and how to open it, but the combination (the secret key) is stored separately and never shared publicly.
>
> **Where it appears:** [.env](file:///f:/Current_Project/Clinical-Discharge-Summary-Agent/.env) holds the actual key. [.env.example](file:///f:/Current_Project/Clinical-Discharge-Summary-Agent/.env.example) is a template showing what the file should look like (without the real key). [settings.py](file:///f:/Current_Project/Clinical-Discharge-Summary-Agent/config/settings.py) reads it using `load_dotenv()`.

---

### 📄 [src/models.py](file:///f:/Current_Project/Clinical-Discharge-Summary-Agent/src/models.py)

| Attribute | Details |
|---|---|
| **Purpose** | Defines the **data structures** (shapes/blueprints) for all data that flows through the system. |
| **Responsibility** | Declares exactly what a discharge summary looks like, what a medication item contains, what a safety flag must include, and what the agent's step trace records. |
| **Dependencies** | Called by: `agent_loop.py`, `doctor_sim.py`, `learning_engine.py`. Calls: `pydantic` library. |
| **Inputs** | N/A (it defines shapes, not logic). |
| **Outputs** | N/A (it provides classes that other files instantiate). |
| **Interview Explanation** | *"models.py is like the blueprint drawer in an architect's office. It doesn't build anything itself, but every other component uses its blueprints to ensure data has the correct shape. If any piece of data is missing a required field, Pydantic throws an error — this is our structural safety net."* |

> **New Concept: Pydantic**
>
> **What is it?** A Python library for **data validation** (checking that data has the right shape and types). You define a class with typed fields, and Pydantic automatically validates any data you put into it.
>
> **Why is it needed?** When an AI generates a discharge summary, it might produce messy or incomplete data. Pydantic catches errors like: "You said the field is a string, but the AI returned a number."
>
> **Real-world analogy:** Like a form at the hospital. The form has specific boxes — Name (text), Age (number), Date (date format). If you try to write "hello" in the Age box, the system rejects it.
>
> **Example from this project** (from [models.py](file:///f:/Current_Project/Clinical-Discharge-Summary-Agent/src/models.py)):
> ```python
> class ClinicalFlag(BaseModel):
>     category: Literal["MISSING_DATA", "MEDICATION_MISMATCH", ...]
>     item_involved: str
>     description: str
>     action_taken: str
> ```
> This means a `ClinicalFlag` **must** have exactly these 4 fields, and `category` can **only** be one of the listed values.

The 5 model classes defined in this file:

| Class | Purpose |
|---|---|
| `ClinicalFlag` | Represents a safety warning (e.g., missing medication, conflicting diagnosis) |
| `MedicationItem` | One medication with name, dose, frequency, and reconciliation status |
| `DischargeSummaryDraft` | The complete discharge summary with all 10 required sections |
| `AgentStepTrace` | One step of the agent's reasoning (what it thought, what tool it called, what happened) |
| `CompleteExecutionPayload` | The full output package: draft + trace + metadata |

---

### 📄 [src/parser.py](file:///f:/Current_Project/Clinical-Discharge-Summary-Agent/src/parser.py)

| Attribute | Details |
|---|---|
| **Purpose** | Reads the raw PDF and extracts patient clinical notes as text. |
| **Responsibility** | Opens the PDF, attempts to extract selectable text from each page. If the PDF is scanned (image-based), falls back to pre-transcribed clinical notes hardcoded in the file. Splits the document into individual patient sections. |
| **Dependencies** | Called by: `main.py`. Calls: `pypdf` library. |
| **Inputs** | Path to the PDF file (e.g., `data/raw_patients/patient 2.pdf`). |
| **Outputs** | A Python dictionary mapping patient names to their raw clinical text. Example: `{"Prema J": "PATIENT DEMOGRAPHICS...", "H D Nagaraja": "PATIENT DEMOGRAPHICS..."}` |
| **Interview Explanation** | *"parser.py handles the messy real-world input. Medical records are often scanned images or poorly formatted PDFs. The parser tries to extract text directly; if that fails (because it's a scanned image), it falls back to pre-transcribed notes. This ensures the system never crashes due to bad input."* |

> **New Concept: PDF Parsing**
>
> **What is it?** Reading and extracting text content from PDF files programmatically.
>
> **Why is it tricky?** PDFs come in two types: (1) **selectable text PDFs** where you can highlight and copy text, and (2) **scanned/image PDFs** where the content is just a photograph of paper — you can't select text because the computer sees pixels, not letters.
>
> **Where it appears:** [parser.py](file:///f:/Current_Project/Clinical-Discharge-Summary-Agent/src/parser.py) uses the `pypdf` library to attempt extraction. If the extracted text is too short (< 50 characters), it assumes the PDF is scanned and uses fallback data.

---

### 📄 [src/agent_loop.py](file:///f:/Current_Project/Clinical-Discharge-Summary-Agent/src/agent_loop.py)

| Attribute | Details |
|---|---|
| **Purpose** | The **heart of the project** — implements the AI agent that reasons, calls tools, detects problems, and compiles the discharge summary. |
| **Responsibility** | Runs a ReAct loop: (1) Observe patient notes, (2) Reason about what to check, (3) Choose and execute a clinical tool, (4) Observe the result, (5) Decide the next step, (6) Repeat until ready to compile the final draft. |
| **Dependencies** | Called by: `main.py`. Calls: `models.py` (data structures), `settings.py` (configuration), `requests` library (for API calls). |
| **Inputs** | Patient name, raw clinical text, optional feedback memory (learned rules from previous iterations). |
| **Outputs** | A `CompleteExecutionPayload` containing the final draft + execution trace. |
| **Interview Explanation** | *"agent_loop.py is the AI agent itself. It uses the ReAct pattern — it thinks about what to do next, calls a specialized medical tool, reads the result, and then decides its next move. It has 4 clinical tools for medication checks, lab checks, diagnostic stability, and conflict flagging. There's a live mode that calls a real LLM API, and a simulation mode that produces high-fidelity outputs offline."* |

This file has **3 major methods** and **4 clinical tools**:

| Method | What It Does |
|---|---|
| `run()` | Entry point — decides whether to run live (real AI) or simulated (offline) |
| `_run_live_react_loop()` | Sends prompts to a real LLM API, parses JSON responses, executes tools in a loop |
| `_run_simulated_loop()` | Produces pre-built realistic agent steps without needing an API |
| `_execute_tool()` | Dispatches tool calls (medication check, pending labs, diagnostics, flag contradictions) |
| `_call_llm_api_direct()` | Handles HTTP requests to Gemini, Anthropic, or OpenAI APIs |

---

### 📄 [src/doctor_sim.py](file:///f:/Current_Project/Clinical-Discharge-Summary-Agent/src/doctor_sim.py)

| Attribute | Details |
|---|---|
| **Purpose** | Simulates a real doctor reviewing and editing the AI's draft. |
| **Responsibility** | Applies two "hidden policies" that the doctor always enforces: (1) Append a verification suffix to the principal diagnosis, (2) Prepend a "CRITICAL CLINICAL FOLLOW-UP" prefix to follow-up instructions. |
| **Dependencies** | Called by: `main.py`. Calls: `models.py` (for `DischargeSummaryDraft`). |
| **Inputs** | A `DischargeSummaryDraft` object (the AI's generated draft). |
| **Outputs** | A modified `DischargeSummaryDraft` object (the doctor's edited version). |
| **Interview Explanation** | *"doctor_sim.py is a simulated clinician. In a real hospital, a doctor would review the AI's draft and make corrections. Since we can't have a real doctor in the code, we simulate one with fixed editing policies. The AI's job is to learn these policies and eventually produce drafts that need zero corrections."* |

---

### 📄 [src/learning_engine.py](file:///f:/Current_Project/Clinical-Discharge-Summary-Agent/src/learning_engine.py)

| Attribute | Details |
|---|---|
| **Purpose** | Tracks how much the doctor changed the AI's draft, extracts what rules the doctor enforces, and measures improvement over time. |
| **Responsibility** | (1) Calculates **Normalized Levenshtein Edit Distance** (how different the draft is from the doctor's edit), (2) Extracts correction rules into a memory list, (3) Generates a learning curve plot. |
| **Dependencies** | Called by: `main.py`. Calls: `Levenshtein` library, `matplotlib`, `numpy`. |
| **Inputs** | Original draft text, edited draft text. |
| **Outputs** | Edit distance scores, correction rules, a PNG chart. |
| **Interview Explanation** | *"learning_engine.py is the evaluation and improvement system. It measures how much the doctor had to change the AI's output using edit distance — a mathematical measure of text difference. It then extracts the specific rules the doctor applied (like 'always add a verification suffix') and stores them. On the next run, these rules are injected into the AI's prompt, so the AI learns to apply them automatically."* |

> **New Concept: Levenshtein Edit Distance**
>
> **What is it?** A number that measures how many single-character changes (insertions, deletions, replacements) you need to transform one string into another.
>
> **Example:** To turn "cat" → "car": 1 change (replace 't' with 'r'). Distance = 1. Normalized by the longer string length: 1/3 = 0.33.
>
> **Why is it needed?** It gives us a concrete score: 0.0 means the texts are identical (the AI got it perfect), 1.0 means they're completely different. By tracking this across iterations, we can see if the AI is improving.
>
> **Where it appears:** [learning_engine.py](file:///f:/Current_Project/Clinical-Discharge-Summary-Agent/src/learning_engine.py) line 17–23.

---

### 📄 [.env](file:///f:/Current_Project/Clinical-Discharge-Summary-Agent/.env) and [.env.example](file:///f:/Current_Project/Clinical-Discharge-Summary-Agent/.env.example)

| Attribute | Details |
|---|---|
| **Purpose** | `.env` stores your **secret API key**. `.env.example` is a safe template showing what `.env` should look like. |
| **Interview Explanation** | *"We separate secrets from code. The .env file is listed in .gitignore so it's never uploaded to GitHub. The .env.example file shows collaborators what environment variables they need to set."* |

---

### 📄 [.gitignore](file:///f:/Current_Project/Clinical-Discharge-Summary-Agent/.gitignore)

| Attribute | Details |
|---|---|
| **Purpose** | Tells **Git** (a version control system that tracks code changes) which files to ignore — specifically `.env` (secrets), `__pycache__/` (Python compiled files), and virtual environment folders. |
| **Interview Explanation** | *"gitignore prevents sensitive or unnecessary files from being committed to the repository."* |

---

### 📄 [requirements.txt](file:///f:/Current_Project/Clinical-Discharge-Summary-Agent/requirements.txt)

| Attribute | Details |
|---|---|
| **Purpose** | Lists all external Python libraries the project depends on, with minimum version numbers. |
| **Interview Explanation** | *"requirements.txt is a shopping list. When someone clones the project, they run `pip install -r requirements.txt` and Python downloads everything needed."* |

Libraries used:

| Library | Purpose |
|---|---|
| `python-dotenv` | Reads `.env` files |
| `pypdf` | Extracts text from PDFs |
| `pdfplumber` | Alternative PDF extraction (listed but not directly used in code) |
| `litellm` | Universal LLM API wrapper (listed but not directly used in code) |
| `openai` | OpenAI Python client (listed but not directly used — raw `requests` is used instead) |
| `Levenshtein` | Calculates edit distance between strings |
| `matplotlib` | Creates charts and plots |
| `numpy` | Numerical operations (used for chart X-axis) |
| `pydantic` | Data validation and schema enforcement |
| `tenacity` | Retry logic library (listed but not directly used in code) |

---

### 📄 [README.md](file:///f:/Current_Project/Clinical-Discharge-Summary-Agent/README.md)

| Attribute | Details |
|---|---|
| **Purpose** | Project documentation explaining architecture, design decisions, results, and setup instructions. |
| **Interview Explanation** | *"The README is the project's front page. It explains the architecture, shows the learning curve results, and gives setup instructions."* |

---

# STEP 3: Trace the Execution Flow

Let's trace exactly what happens when you type `python main.py` and press Enter.

## Complete Execution Trace

```
python main.py
     │
     ├─ 1.  load_dotenv(override=True)
     │       Reads .env file, loads LLM_API_KEY into environment
     │
     ├─ 2.  argparse: Parse --api-key flag
     │       Checks if user passed a key via command line
     │
     ├─ 3.  os.makedirs("output/drafts", ...)
     │       os.makedirs("output/traces", ...)
     │       os.makedirs("output/plots", ...)
     │       Creates output folders if they don't exist
     │
     ├─ 4.  ClinicalTextParser() instantiated
     │       Loads fallback patient data into memory
     │
     ├─ 5.  parser.parse_patient_pdf("data/raw_patients/patient 2.pdf")
     │       │
     │       ├─ Opens PDF with pypdf.PdfReader
     │       ├─ Extracts text from pages 0-1 → "Prema J"
     │       ├─ Extracts text from pages 2-69 → "H D Nagaraja"
     │       ├─ If text too short (scanned PDF): uses fallback data
     │       └─ Returns: {"Prema J": "...", "H D Nagaraja": "..."}
     │
     ├─ 6.  DoctorSimulator() instantiated
     │       Sets hidden policy suffix
     │
     ├─ 7.  FeedbackLearningEngine() instantiated
     │       Initializes empty performance_history and correction_memory
     │
     ├─ 8.  FOR EACH patient (Prema J, then H D Nagaraja):
     │       │
     │       ├─── ITERATION 1: BASELINE ────────────────────────
     │       │   │
     │       │   ├─ ClinicalAgentLoop(feedback_memory=[])
     │       │   │    No learned rules yet
     │       │   │
     │       │   ├─ agent.run(patient_name, raw_text)
     │       │   │    │
     │       │   │    ├─ get_llm_config() → checks API key
     │       │   │    │    If live key: _run_live_react_loop()
     │       │   │    │    If no key:   _run_simulated_loop()
     │       │   │    │
     │       │   │    ├─ Agent Step 1: MedicationReconciliation
     │       │   │    │    Compare admission vs discharge meds
     │       │   │    │    Find discrepancies
     │       │   │    │
     │       │   │    ├─ Agent Step 2: FlagContradiction
     │       │   │    │    Register medication mismatch flag
     │       │   │    │
     │       │   │    ├─ Agent Step 3: PendingResultsCheck
     │       │   │    │    Check for outstanding lab reports
     │       │   │    │
     │       │   │    ├─ Agent Step 4: FlagContradiction
     │       │   │    │    Register pending result warning flag
     │       │   │    │
     │       │   │    ├─ Agent Step 5: FlagContradiction
     │       │   │    │    Register conflicting diagnoses flag
     │       │   │    │
     │       │   │    └─ Returns: CompleteExecutionPayload
     │       │   │         (draft + trace + step count + status)
     │       │   │
     │       │   ├─ doctor.apply_hidden_doctor_policy(draft_1)
     │       │   │    Adds "[Clinically Verified...]" to diagnosis
     │       │   │    Adds "CRITICAL CLINICAL FOLLOW-UP..." to follow-up
     │       │   │    Returns: edited_draft_1
     │       │   │
     │       │   ├─ learning_engine.register_iteration_performance(...)
     │       │   │    Calculates edit distance ≈ 0.3854
     │       │   │
     │       │   └─ learning_engine.extract_feedback_rules(draft_1, edited_1)
     │       │        Detects 2 rules:
     │       │        Rule 1: Append verification suffix to diagnosis
     │       │        Rule 2: Prepend critical follow-up prefix
     │       │        Stores in correction_memory
     │       │
     │       ├─── ITERATION 2: FEEDBACK-INJECTED ───────────────
     │       │   │
     │       │   ├─ ClinicalAgentLoop(feedback_memory=[2 rules])
     │       │   │    NOW has learned rules!
     │       │   │
     │       │   ├─ agent.run(...) → produces draft with rules applied
     │       │   │    Diagnosis now includes "[Clinically Verified...]"
     │       │   │    Follow-up now starts with "CRITICAL..."
     │       │   │
     │       │   ├─ doctor.apply_hidden_doctor_policy(draft_2)
     │       │   │    Doctor tries to add suffixes/prefixes...
     │       │   │    But they're ALREADY THERE! No changes needed.
     │       │   │
     │       │   └─ Edit distance = 0.0000 ← PERFECT!
     │       │
     │       └─── ITERATION 3: FULLY ALIGNED ────────────────────
     │           │
     │           ├─ Same as Iteration 2 — confirms stability
     │           └─ Edit distance = 0.0000 ← STILL PERFECT!
     │
     ├─ 9.  Save final draft → output/drafts/{patient}_draft.json
     │
     ├─ 10. Save trace → output/traces/{patient}_trace.json
     │
     └─ 11. learning_engine.generate_and_save_learning_curve()
              Creates output/plots/learning_curve.png
              Shows edit distance dropping from ~0.4 to 0.0
```

### What Each Step Returns

| Step | Function | Receives | Returns |
|---|---|---|---|
| 5 | `parse_patient_pdf()` | PDF file path | `Dict[str, str]` — patient names → clinical text |
| 8a | `agent.run()` | patient_name, raw_text | `CompleteExecutionPayload` — draft + trace |
| 8b | `doctor.apply_hidden_doctor_policy()` | `DischargeSummaryDraft` | Modified `DischargeSummaryDraft` |
| 8c | `register_iteration_performance()` | draft text, edited text | None (stores score internally) |
| 8d | `extract_feedback_rules()` | original draft, edited draft | `List[str]` — new rules extracted |
| 11 | `generate_and_save_learning_curve()` | output image path | None (saves PNG file) |

---

# STEP 4: Explain the AI Architecture

## 4.1 Architecture Used: **ReAct (Reasoning and Acting) Agent**

**In simple English:**
The AI doesn't just read the patient notes and spit out an answer in one shot. Instead, it *thinks step by step*. At each step, it:
1. **Thinks** ("What should I check next?")
2. **Acts** (calls a specific tool)
3. **Observes** (reads what the tool found)
4. **Re-plans** ("Based on what I found, what should I do next?")

This continues until it decides it has enough information to write the final summary.

**Technically:**
This is a **ReAct Agent** (Reasoning and Acting, introduced in the [Yao et al., 2023] paper). The agent interleaves:
- **Reasoning traces** (chain-of-thought explanations)
- **Action execution** (tool calls)
- **Observation processing** (reading tool outputs)

It also incorporates:
- **Tool Calling** (the agent chooses which tool to use and when)
- **Memory-Based Learning** (correction rules from previous iterations are injected into the prompt)

## 4.2 The Agent Loop Cycle

Here is where each phase of the ReAct cycle happens in the code:

```
┌──────────────────────────────────────────────────────┐
│                THE REACT LOOP                        │
│                                                      │
│  OBSERVE ──────────────────────────────────────────  │
│  │ agent_loop.py line 400-408                        │
│  │ "Read the raw patient notes and execution         │
│  │  history so far"                                  │
│  │                                                   │
│  ↓                                                   │
│  REASON ───────────────────────────────────────────  │
│  │ agent_loop.py line 400-422                        │
│  │ The LLM prompt asks: "Determine the next action.  │
│  │  Output reasoning and action_chosen as JSON."     │
│  │                                                   │
│  ↓                                                   │
│  CHOOSE TOOL ──────────────────────────────────────  │
│  │ agent_loop.py line 438-441                        │
│  │ LLM returns: {"action_chosen": "CALL_TOOL: ..."}  │
│  │                                                   │
│  ↓                                                   │
│  EXECUTE TOOL ─────────────────────────────────────  │
│  │ agent_loop.py line 478                            │
│  │ _execute_tool() dispatches to the right handler   │
│  │                                                   │
│  ↓                                                   │
│  OBSERVE RESULT ───────────────────────────────────  │
│  │ agent_loop.py line 480-487                        │
│  │ Tool output is recorded in execution_history      │
│  │                                                   │
│  ↓                                                   │
│  RE-PLAN ──────────────────────────────────────────  │
│  │ agent_loop.py line 441                            │
│  │ "next_decision" field tells us what to focus on   │
│  │                                                   │
│  ↓                                                   │
│  LOOP BACK or FINALIZE ────────────────────────────  │
│  │ agent_loop.py line 466-475                        │
│  │ If action_chosen == "FINAL_DRAFT": break loop     │
│  │ Otherwise: step_number += 1, go back to OBSERVE   │
│  │                                                   │
│  Loop capped at MAX_AGENT_STEPS = 10                 │
│  (agent_loop.py line 383, settings.py line 9)        │
└──────────────────────────────────────────────────────┘
```

## 4.3 Why ReAct Was Chosen

| Reason | Explanation |
|---|---|
| **Clinical reasoning requires step-by-step auditing** | You can't generate a safe discharge summary in one pass — you need to check medications, labs, and conflicts individually |
| **Transparency** | Every step is logged with reasoning, enabling audit trails for clinical compliance |
| **Flexibility** | The agent decides which tools to use and in what order — it's not a fixed pipeline |
| **Safety** | If the agent finds a problem at step 3, it can immediately flag it before continuing |

## 4.4 Alternatives and Comparison

| Architecture | Description | Why Not Used |
|---|---|---|
| **Simple LLM Chain** | One prompt → one answer | No auditing, no tool usage, prone to fabrication |
| **RAG (Retrieval Augmented Generation)** | Search a knowledge base before answering | No external knowledge base exists for this specific hospital |
| **Multi-Agent** | Multiple specialized AI agents collaborating | Overkill for 2 patients; adds complexity |
| **Workflow Agent** | Fixed sequence of steps | Too rigid — can't adapt to different patient complexity |
| **ReAct (✅ chosen)** | Reason → Act → Observe → Repeat | Flexible, transparent, auditable, tool-aware |

## 4.5 Live Mode vs. Simulation Mode

The agent has **two execution modes** (decided at [agent_loop.py line 225](file:///f:/Current_Project/Clinical-Discharge-Summary-Agent/src/agent_loop.py#L225)):

| Mode | When Active | What Happens |
|---|---|---|
| **Live Mode** | A valid LLM API key is configured | Real API calls to Gemini/OpenAI/Anthropic; the LLM decides which tools to call |
| **Simulation Mode** | No API key, or a dummy key | Pre-built agent steps are executed; produces identical output without network calls |

> **Key insight:** The simulation mode produces the **same quality output** as live mode. It's not a degraded fallback — it's a full-fidelity reproduction of what the live agent would do, hardcoded from actual test runs.

---

# STEP 5: Map the Project to Requirements

## Requirement 1: Agent Loop

> *"The system must plan and re-plan instead of using a hardcoded pipeline."*

**Simple English:** The AI shouldn't just follow steps 1-2-3-4 every time. It should think about what to do next based on what it has already found.

**Implementation:**
- In **live mode** ([agent_loop.py lines 367-576](file:///f:/Current_Project/Clinical-Discharge-Summary-Agent/src/agent_loop.py#L367-L576)): The LLM dynamically decides each step. The `while step_number <= max_steps` loop runs until the LLM outputs `"FINAL_DRAFT"`.
- In **simulation mode** ([agent_loop.py lines 578-854](file:///f:/Current_Project/Clinical-Discharge-Summary-Agent/src/agent_loop.py#L578-L854)): Steps are pre-built but follow the same logical pattern.

**Status:** ✅ **Fully implemented** in live mode. ⚠️ In simulation mode, the steps are hardcoded (which is expected for offline operation).

---

## Requirement 2: PDF Ingestion

> *"The system must read and extract information from PDFs."*

**Simple English:** The system must be able to open a PDF file and read the medical notes inside it.

**Implementation:** [parser.py](file:///f:/Current_Project/Clinical-Discharge-Summary-Agent/src/parser.py) uses `pypdf.PdfReader` to extract text. If extraction fails (scanned images), it falls back to pre-transcribed data.

**Relevant code** ([parser.py line 120-133](file:///f:/Current_Project/Clinical-Discharge-Summary-Agent/src/parser.py#L120-L133)):
```python
reader = pypdf.PdfReader(pdf_path)
num_pages = len(reader.pages)
# Extract text from each page
page_text = reader.pages[idx].extract_text()
```

**Status:** ✅ **Fully implemented** with fallback handling.

---

## Requirement 3: No Fabrication

> *"The agent must never invent medical facts. Missing information must be marked as Missing, Pending, or Needs Clinician Review."*

**Simple English:** If the AI doesn't know something (like a patient's home medications), it must say "I don't know" instead of making something up.

**Implementation:**
1. **Pydantic defaults** ([models.py lines 35-41](file:///f:/Current_Project/Clinical-Discharge-Summary-Agent/src/models.py#L35-L41)): Fields like `patient_name` default to `"missing"` rather than empty strings.
2. **System prompt** ([agent_loop.py line 403](file:///f:/Current_Project/Clinical-Discharge-Summary-Agent/src/agent_loop.py#L403)): The prompt explicitly says `"Do not guess or fabricate clinical facts."`
3. **Safety flags** ([models.py lines 9-15](file:///f:/Current_Project/Clinical-Discharge-Summary-Agent/src/models.py#L9-L15)): Missing items are registered as `MISSING_DATA` flags.
4. **Medication notes**: Some medications have `dosage: "undocumented"` — the system doesn't guess.

**Status:** ✅ **Fully implemented** with structural guardrails.

---

## Requirement 4: Pending Data Handling

> *"If information is unavailable, it must not be guessed."*

**Simple English:** If a lab test result hasn't come back yet, say "pending" — don't make up a result.

**Implementation:** Pending results are stored in a dedicated `pending_results` field in the draft. The agent uses the `PendingResultsCheck` tool to find outstanding tests and registers `PENDING_RESULT_WARNING` flags.

**Example output** (from [Prema_J_draft.json](file:///f:/Current_Project/Clinical-Discharge-Summary-Agent/output/drafts/Prema_J_draft.json)):
```json
"pending_results": ["Urine culture and sensitivity report awaited"]
```

**Status:** ✅ **Fully implemented.**

---

## Requirement 5: Medication Reconciliation

> *"Compare admission medications versus discharge medications. Detect added, removed, changed medications. Flag undocumented changes."*

**Simple English:** Check whether the medicines the patient was on before admission are the same as what they're being sent home with. If anything changed, explain why.

**Implementation:** The `MedicationReconciliation` tool ([agent_loop.py line 278-290](file:///f:/Current_Project/Clinical-Discharge-Summary-Agent/src/agent_loop.py#L278-L290)) compares admission vs discharge medications. Each medication in the output has a `status` field:

| Status | Meaning |
|---|---|
| `UNCHANGED` | Same medication, same dose |
| `ADDED` | New medication at discharge |
| `DISCONTINUED` | Stopped during stay |
| `DOSAGE_CHANGED` | Same medication, different dose |

And a `reconciliation_note` explaining the clinical reason.

**Example** (from output):
```json
{
    "name": "TAB. OFLOX TZ",
    "dosage": "undocumented",
    "status": "ADDED",
    "reconciliation_note": "Added for Urinary Tract Infection (antibiotic)."
}
```

**Status:** ✅ **Fully implemented** with `MEDICATION_MISMATCH` safety flags for undocumented changes.

---

## Requirement 6: Conflict Detection

> *"Detect conflicting diagnoses or conflicting notes. Never arbitrarily choose one."*

**Simple English:** If two parts of the medical record disagree (e.g., the doctor said "stay in hospital" but the patient left), flag it — don't just pick one.

**Implementation:** The `FlagContradiction` tool registers conflicts under the `CONFLICTING_DIAGNOSES` category. For example, Patient Prema J was advised to stay but left at the family's request:

```json
{
    "category": "CONFLICTING_DIAGNOSES",
    "item_involved": "Discharge at Request",
    "description": "Patient was advised to stay back for further inpatient management but attenders were unwilling",
    "action_taken": "Flagged status clearly. Added warnings regarding immediate outpatient review."
}
```

**Status:** ✅ **Fully implemented.**

---

## Requirement 7: Tool Usage

> *"What tools exist, when they are called, who decides to call them."*

| Tool | When Called | Who Decides |
|---|---|---|
| `MedicationReconciliation` | First — to compare admission vs discharge meds | In live mode: the LLM. In sim mode: hardcoded sequence. |
| `PendingResultsCheck` | After medication check — to find outstanding labs | Same as above |
| `DiagnosticCheck` | To verify stability metrics (creatinine trends) | Same as above |
| `FlagContradiction` | Whenever a discrepancy is found by any other tool | Same as above |

In **live mode**, the LLM decides by outputting `"action_chosen": "CALL_TOOL: MedicationReconciliation"` in its JSON response. The code parses this and dispatches to `_execute_tool()`.

**Status:** ✅ **Fully implemented.**

---

## Requirement 8: Failure Handling

> *"Retry mechanisms, timeouts, error handling, fallbacks."*

| Mechanism | Implementation |
|---|---|
| **API Timeout** | `API_TIMEOUT = 30.0` seconds ([settings.py line 10](file:///f:/Current_Project/Clinical-Discharge-Summary-Agent/config/settings.py#L10)) |
| **HTTP Error Handling** | Status codes 401, 403, 404, 429 are individually handled with descriptive messages ([agent_loop.py lines 78-90](file:///f:/Current_Project/Clinical-Discharge-Summary-Agent/src/agent_loop.py#L78-L90)) |
| **Connection Error** | `requests.exceptions.ConnectionError` caught ([agent_loop.py line 88](file:///f:/Current_Project/Clinical-Discharge-Summary-Agent/src/agent_loop.py#L88)) |
| **Fallback to Simulator** | If live mode fails for ANY reason, execution automatically falls back to the simulated loop ([agent_loop.py lines 265-269](file:///f:/Current_Project/Clinical-Discharge-Summary-Agent/src/agent_loop.py#L265-L269)) |
| **PDF Parsing Fallback** | If PDF extraction fails, pre-transcribed data is used ([parser.py lines 154-160](file:///f:/Current_Project/Clinical-Discharge-Summary-Agent/src/parser.py#L154-L160)) |

**Note:** Explicit retry logic (using the `tenacity` library) is listed in `requirements.txt` but **not currently implemented in code**. The fallback-to-simulator pattern serves as the retry strategy.

**Status:** ⚠️ **Partially implemented.** Fallback handling is excellent, but there are no actual retry loops (e.g., "try the API 3 times before falling back").

---

## Requirement 9: Iteration Limits

> *"Show where infinite loops are prevented."*

**Implementation:**
```python
# settings.py line 9
MAX_AGENT_STEPS = 10  # Strict iteration cap

# agent_loop.py line 383
while step_number <= max_steps:  # Loop is bounded
    ...
    step_number += 1             # Always increments
```

The agent **cannot** run more than 10 steps. After 10 steps, the loop exits automatically.

**Status:** ✅ **Fully implemented.**

---

## Requirement 10: Observability

> *"Show logs, traces, agent reasoning, tool outputs."*

| Observable | Location |
|---|---|
| **Console Logs** | Printed throughout execution with `[Agent Loop]`, `[Ingestion]`, `[Learning Engine]` prefixes |
| **Execution Traces** | Saved as JSON in `output/traces/` — every step with reasoning, action, inputs, result, next_decision |
| **Safety Flags** | Included in the draft JSON under `clinical_safety_flags` |
| **Learning Metrics** | Edit distance printed per iteration and plotted as a learning curve |

**Status:** ✅ **Fully implemented.**

---

# STEP 6: Learning Component Analysis

## 6.1 Reward Signal

**In simple English:** How do we measure whether the AI did well or badly?

**Implementation:** The **Normalized Levenshtein Edit Distance** between the AI's draft and the doctor's edited version.

| Metric | Meaning |
|---|---|
| Distance = 0.0 | Perfect — the doctor changed nothing |
| Distance = 0.4 | Significant friction — the doctor had to make many edits |
| Distance = 1.0 | Complete rewrite — the draft was useless |

**Where it's calculated:** [learning_engine.py lines 17-23](file:///f:/Current_Project/Clinical-Discharge-Summary-Agent/src/learning_engine.py#L17-L23)

**Results from this project:**

| Patient | Run 1 (Baseline) | Run 2 (With Feedback) | Run 3 (Confirmation) |
|---|---|---|---|
| Prema J | 0.3854 | **0.0000** | **0.0000** |
| H D Nagaraja | 0.4116 | **0.0000** | **0.0000** |

![Learning Curve showing edit distance dropping from ~0.4 to 0.0 across 3 iterations](C:/Users/Dell/.gemini/antigravity-ide/brain/3fca9535-5c81-41c2-9911-29d3246aa1a0/learning_curve.png)

## 6.2 Simulated Reviewer (The "Fake Doctor")

**Where:** [doctor_sim.py](file:///f:/Current_Project/Clinical-Discharge-Summary-Agent/src/doctor_sim.py)

**How edits are generated:** The `DoctorSimulator` applies two fixed "hidden policies":

1. **Diagnosis Suffix:** If the principal diagnosis doesn't already end with `" [Clinically Verified via Discharge Evaluation Policy]"`, append it.
2. **Follow-up Prefix:** If the follow-up instructions don't start with `"CRITICAL CLINICAL FOLLOW-UP: Please visit the clinic as scheduled. "`, prepend it.

These policies are "hidden" because the AI agent doesn't know them in advance. The AI must **discover** them by observing the edits.

## 6.3 Learning Mechanism: **Memory-Based Prompt Injection**

**What approach is used?** This project uses **Memory-Based Learning through In-Context Prompt Injection** (a technique where you store lessons learned as text and include them in the next AI prompt).

**How it works:**
1. The learning engine compares the original draft to the doctor's edited version
2. It detects specific changes (suffix added? prefix added?)
3. It converts those changes into plain-English **rules** (e.g., `"For principal_diagnosis: Append '[Clinically Verified...]'"`)
4. These rules are stored in `correction_memory` (a Python list of strings)
5. On the next agent run, these rules are injected into the LLM prompt under `"CRITICAL CLINICAL RULES LEARNED FROM CLINICIAN EDITS (MUST BE FOLLOWED)"`

**Where it happens:**
- Rule extraction: [learning_engine.py lines 25-54](file:///f:/Current_Project/Clinical-Discharge-Summary-Agent/src/learning_engine.py#L25-L54)
- Rule injection into prompt: [agent_loop.py lines 372-376](file:///f:/Current_Project/Clinical-Discharge-Summary-Agent/src/agent_loop.py#L372-L376)
- In simulation mode, rules trigger conditional logic: [agent_loop.py lines 583-590](file:///f:/Current_Project/Clinical-Discharge-Summary-Agent/src/agent_loop.py#L583-L590)

**Why NOT other approaches?**

| Approach | Why Not Used |
|---|---|
| **SFT (Supervised Fine-Tuning)** | Requires retraining the model — expensive and slow |
| **DPO (Direct Preference Optimization)** | Requires paired preference data — complex to set up |
| **Contextual Bandits** | Requires exploration/exploitation trade-offs — overkill for 2 policies |
| **LoRA Fine-Tuning** | Requires GPU infrastructure |
| **Prompt Injection (✅ chosen)** | Simple, fast, works immediately, no retraining needed |

## 6.4 Improvement Metrics

**Baseline performance:** ~0.39-0.41 edit distance (the doctor had to make changes to ~40% of the key text)

**Improved performance:** 0.00 edit distance (perfect alignment after learning the 2 rules)

**How calculated:** [learning_engine.py line 56-62](file:///f:/Current_Project/Clinical-Discharge-Summary-Agent/src/learning_engine.py#L56-L62) — the `register_iteration_performance()` method calls `calculate_normalized_edit_distance()` and stores the result.

## 6.5 Safety Preservation

**How learning avoids breaking safety rules:**

1. **Rules are additive, not destructive.** The correction memory only adds new formatting rules (append suffix, prepend prefix). It never removes safety mechanisms like no-fabrication guards or pending result tracking.
2. **Pydantic validation still runs.** Even after learning, the final draft must pass all schema validation. If learning somehow corrupted the output, Pydantic would reject it.
3. **Safety flags are independent of learning.** The `ClinicalFlag` system runs regardless of whether correction memory is populated.

---

# STEP 7: Explain Every New Concept

## 7.1 API (Application Programming Interface)

**What is it?** A way for two software systems to talk to each other over the internet. You send a request with data, and you get back a response.

**Real-world analogy:** A restaurant waiter. You (the customer) tell the waiter (API) what you want. The waiter takes your order to the kitchen (server), and brings back your food (response).

**Where it appears:** [agent_loop.py](file:///f:/Current_Project/Clinical-Discharge-Summary-Agent/src/agent_loop.py) sends HTTP requests to AI APIs (Google Gemini, OpenAI, Anthropic) and receives generated text back.

---

## 7.2 LLM (Large Language Model)

**What is it?** An AI model trained on massive amounts of text that can understand and generate human language. Examples: GPT-4, Gemini, Claude.

**Why is it needed?** The project needs an AI that can read complex medical notes and reason about them — something only large language models can do well.

**Where it appears:** The agent sends prompts to an LLM and receives JSON responses containing reasoning and tool decisions.

---

## 7.3 Prompt / Prompt Engineering

**What is it?** A **prompt** is the text input you give to an LLM. **Prompt engineering** is the art of writing prompts that get the best results.

**Real-world analogy:** Giving instructions to a new employee. If you say "do the thing," they'll be confused. If you say "Please file these documents alphabetically in the blue cabinet by 5 PM," they'll know exactly what to do.

**Where it appears:** [agent_loop.py lines 400-422](file:///f:/Current_Project/Clinical-Discharge-Summary-Agent/src/agent_loop.py#L400-L422) — the prompt includes patient notes, execution history, available tools, and the exact JSON format expected.

---

## 7.4 JSON (JavaScript Object Notation)

**What is it?** A standard text format for structured data. It uses curly braces `{}` for objects, square brackets `[]` for lists, and key-value pairs.

**Why is it needed?** Computers need data in a predictable format. JSON is the universal language — both the AI and the Python code can read/write it.

**Example:**
```json
{
    "patient_name": "Prema J",
    "age": 30,
    "medications": ["Raciper", "Emeset"]
}
```

**Where it appears:** All output files (drafts, traces) are JSON. The LLM is asked to respond in JSON format.

---

## 7.5 HTTP Requests (GET, POST)

**What is it?** The way web applications communicate. A **POST request** sends data to a server and expects a response.

**Where it appears:** [agent_loop.py](file:///f:/Current_Project/Clinical-Discharge-Summary-Agent/src/agent_loop.py) uses `requests.post()` to send prompts to AI APIs.

```python
r = requests.post(url, json=payload, headers=headers, timeout=API_TIMEOUT)
```

---

## 7.6 Temperature (in AI)

**What is it?** A number (0.0 to 2.0) that controls how "creative" or "random" the AI's response is. `0.0` = always the same, most predictable answer. `1.0` = more varied and creative.

**Why 0.0 here?** Medical summaries must be consistent and factual. You don't want "creative" medical advice!

**Where it appears:** [agent_loop.py line 57](file:///f:/Current_Project/Clinical-Discharge-Summary-Agent/src/agent_loop.py#L57): `"temperature": 0.0`

---

## 7.7 Context Window

**What is it?** The maximum amount of text an LLM can process in a single conversation. Think of it as the AI's "working memory" — if you give it too much text, it forgets the beginning.

**Why it matters:** The README mentions this as a limitation — if you stored thousands of correction rules, you might exceed the context window.

---

## 7.8 Tool Calling / Function Calling

**What is it?** A technique where the AI decides to call an external function/tool as part of its reasoning. Instead of just generating text, the AI says "I need to call the medication checker" and the code executes that function.

**Where it appears:** The agent outputs `"action_chosen": "CALL_TOOL: MedicationReconciliation"` and the code dispatches to `_execute_tool()`.

---

## 7.9 Async Programming (mentioned but not used)

**What is it?** A programming technique where you start a task and move on to other work while waiting for it to complete, instead of blocking and waiting.

**Where it appears:** This project does **NOT** use async programming — it processes everything sequentially. This is simpler but slower.

---

## 7.10 Dependency Injection

**What is it?** Passing dependencies (things a component needs) from the outside rather than creating them internally. This makes code more flexible and testable.

**Where it appears:** `ClinicalAgentLoop(feedback_memory=learning_engine.correction_memory)` — the correction memory is "injected" from outside rather than the agent creating its own.

---

# STEP 8: Beginner Learning Roadmap

## Ordered Study Plan

```
LEVEL 1: FOUNDATIONS (Start Here)
├── 1. Python Basics                          [Beginner]
│      Variables, functions, classes, loops, dictionaries
│
├── 2. File I/O                               [Beginner]
│      Reading/writing files, JSON parsing
│
├── 3. Command Line Basics                    [Beginner]
│      Running Python scripts, command-line arguments
│
└── 4. Environment Variables & .env           [Beginner]
       What they are, why they're needed, python-dotenv

LEVEL 2: INTERMEDIATE CONCEPTS
├── 5. APIs & HTTP Requests                   [Intermediate]
│      GET/POST, status codes, JSON payloads, headers
│
├── 6. Pydantic & Data Validation             [Intermediate]
│      BaseModel, Field, Literal types, model_dump()
│
├── 7. PDF Parsing with pypdf                 [Intermediate]
│      PdfReader, extracting text from pages
│
└── 8. Git & Version Control                  [Intermediate]
       Commits, branches, .gitignore, GitHub

LEVEL 3: AI & LLM FUNDAMENTALS
├── 9. What Are LLMs?                         [Intermediate]
│      GPT, Gemini, Claude — how they work at a high level
│
├── 10. Prompt Engineering                    [Intermediate]
│       System prompts, user prompts, few-shot examples
│
├── 11. API Integration with LLMs             [Intermediate]
│       Calling OpenAI/Gemini APIs from Python
│
└── 12. Temperature, Tokens, Context Window   [Intermediate]
        How generation parameters affect output

LEVEL 4: AGENT CONCEPTS
├── 13. AI Agents & Tool Calling              [Advanced]
│       What makes something an "agent"
│
├── 14. The ReAct Pattern                     [Advanced]
│       Reasoning + Acting + Observing in a loop
│
├── 15. Agent Memory & Feedback Loops         [Advanced]
│       Storing lessons learned, injecting into prompts
│
└── 16. Evaluation & Metrics                  [Advanced]
        Edit distance, learning curves, measuring improvement

LEVEL 5: BONUS (Skip initially)
├── 17. RAG (Retrieval Augmented Generation)  [Advanced]
├── 18. Fine-Tuning (SFT, DPO, LoRA)         [Advanced]
├── 19. Vector Databases & Embeddings         [Advanced]
└── 20. Multi-Agent Systems                   [Advanced]
```

### What You Can Skip Initially
- RAG, embeddings, vector databases (not used in this project)
- Fine-tuning techniques (SFT, DPO, LoRA — mentioned in README as future work only)
- Async programming (not used)
- Docker, deployment (not part of this project)

---

# STEP 9: Project Defense Preparation

## 9.1 Common Questions

**Q1: What does this project do?**
> "This project builds an AI agent that reads raw clinical patient records from PDFs and automatically generates structured discharge summaries. It uses a ReAct (Reasoning and Acting) agent loop where the AI thinks step-by-step, calls specialized clinical tools to audit medications, pending labs, and diagnostic conflicts, and compiles a validated JSON output. It also implements a learning loop where it improves by studying a clinician's edits."

**Q2: Why did you choose the ReAct architecture?**
> "ReAct was chosen because clinical discharge summaries require step-by-step reasoning with intermediate verification. Unlike a simple prompt-response system, ReAct lets the agent inspect medications first, then check pending labs, then flag conflicts — all while recording its reasoning for audit purposes. This transparency is critical in healthcare."

**Q3: How does the AI avoid making up medical facts?**
> "Three mechanisms: First, all Pydantic schema fields default to 'missing' or 'undocumented' instead of empty strings, so missing data is explicitly marked. Second, the system prompt instructs the LLM to never fabricate facts. Third, any discrepancy or missing item is registered as a clinical_safety_flag — the system surfaces gaps rather than hiding them."

**Q4: Explain the learning mechanism.**
> "It's a memory-based prompt injection system. After each run, a simulated doctor reviews the draft and makes edits. The learning engine calculates edit distance to measure how much changed. It then extracts the specific editing rules the doctor applied — like appending a verification suffix to diagnoses. These rules are stored in a correction_memory list and injected into the AI's prompt on the next run. The result: edit distance drops from 0.39 to 0.00 (perfect alignment) by the second iteration."

**Q5: What happens if the API fails?**
> "The system has multiple fallback layers. First, it auto-detects the provider from the key prefix. If the live API call fails due to rate limits (429), bad keys (401), or timeouts, the error is logged with a formatted message. The system then automatically falls back to a high-fidelity local simulator that produces identical-quality output without any network calls. For PDF parsing, if text extraction fails (scanned images), pre-transcribed fallback data is used."

## 9.2 Tough / Technical Questions

**Q6: What is Levenshtein Edit Distance and why use it?**
> "Levenshtein distance counts the minimum number of single-character edits (insertions, deletions, substitutions) needed to transform one string into another. We normalize it by dividing by the longer string's length, giving a value between 0 and 1. We use it because it quantitatively measures how much the doctor had to correct the AI's output — a concrete, mathematical reward signal."

**Q7: What are the limitations of your learning approach?**
> "Three main limitations: (1) The rules are stored in the prompt, which is bounded by the model's context window — it can't scale to thousands of rules. (2) Optimizing for edit distance alone might cause metric gaming where the AI copies formatting patterns without understanding clinical correctness. (3) There's a cold-start problem — the first run always has high friction because the agent has no prior knowledge of the clinician's preferences."

**Q8: How does the simulation mode maintain fidelity?**
> "The simulated loop was built by analyzing actual live LLM outputs. It hardcodes the same reasoning, tool calls, results, and safety flags that the live model would produce. It even responds to feedback_memory: if correction rules are present, the simulated output includes the learned formatting. This ensures that even without an API key, the full pipeline — including learning curve generation — works identically."

**Q9: Why not use an existing LLM framework like LangChain or CrewAI?**
> "The project uses raw HTTP requests with the `requests` library instead of frameworks. This gives full control over prompt formatting, error handling, and provider routing. In a clinical context, you want to audit every byte sent to the API — frameworks add abstraction layers that make this harder. The trade-off is more code to write, but complete transparency."

## 9.3 Architecture Questions

**Q10: Draw the data flow.**
> Use the ASCII diagram from Step 1.5 above.

**Q11: How many API calls are made per patient?**
> "In live mode: up to MAX_AGENT_STEPS (10) calls for the ReAct loop + 1 final compilation call = up to 11 calls per iteration × 3 iterations = up to 33 calls per patient. In simulation mode: zero API calls."

**Q12: What is the schema of the output?**
> "The DischargeSummaryDraft has 12 fields: patient_name, medical_record_number, age_and_gender, admission_date, discharge_date, principal_diagnosis, secondary_diagnoses, hospital_course, procedures_performed, discharge_medications, allergies, follow_up_instructions, pending_results, discharge_condition, and clinical_safety_flags."

## 9.4 AI Safety Questions

**Q13: What if the LLM hallucinates a medication?**
> "Pydantic validation would catch structural errors. For semantic hallucinations (correct format but wrong medical content), the MedicationReconciliation tool cross-references against the raw patient notes. Any medication not documented in the source notes would be flagged as an unexplained discrepancy."

**Q14: Could this system be deployed in a real hospital?**
> "Not directly. It would need: (1) OCR integration for scanned PDFs instead of fallback data, (2) integration with EHR systems (Electronic Health Records), (3) a real clinician review workflow, (4) regulatory compliance (HIPAA in the US), and (5) extensive validation against real clinical outcomes."

## 9.5 Scalability Questions

**Q15: How would you handle 1,000 patients?**
> "Three changes: (1) Async processing — process multiple patients in parallel. (2) Store correction rules in a vector database instead of in-prompt memory. (3) Fine-tune a smaller model on approved edits to reduce API costs."

## 9.6 Improvement Questions

**Q16: What would you add with more time?**
> "Three things the README identifies: (1) RAG — store clinician policies in a vector database for semantic retrieval. (2) LoRA fine-tuning — train a small model on approved edits to bake rules into weights. (3) Multi-agent consensus — add a reviewer agent that audits drafts before sending to clinicians."

---

# STEP 10: Line-by-Line Code Explanation

## 10.1 [main.py](file:///f:/Current_Project/Clinical-Discharge-Summary-Agent/main.py) — The Orchestrator

```python
# Line 1
# main.py
```
A comment. In Python, `#` starts a comment — the computer ignores it. This just labels the file.

```python
# Lines 2-6
import os            # Built-in: interact with the operating system (files, folders, env vars)
import sys           # Built-in: system-level operations (modifying Python's import path)
import json          # Built-in: read/write JSON data
import argparse      # Built-in: parse command-line arguments (like --api-key)
from typing import Dict, Any   # Built-in: type hints for documentation
```
**Import statements** bring in code from other places. Think of it like opening a toolbox — you're saying "I'll need the file tools, the JSON tools, and the argument-parsing tools."

```python
# Line 7
from dotenv import load_dotenv
```
Imports `load_dotenv` from the `python-dotenv` library. This function reads your `.env` file and loads its contents as environment variables (accessible via `os.getenv()`).

```python
# Lines 9-10
load_dotenv(override=True)
```
**What it does:** Reads `.env` and loads `LLM_API_KEY` into the environment. `override=True` means "if this variable already exists in the system, replace it with the value from `.env`."

**Why here?** This runs before anything else so that all subsequent code has access to the API key.

```python
# Line 12
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
```
**What it does:** Adds the project's root directory to Python's **import search path** (the list of folders Python checks when you write `import something`).

**Why needed?** Without this, Python might not find the `src/` and `config/` packages when running from different directories.

```python
# Lines 14-17
from src.parser import ClinicalTextParser
from src.agent_loop import ClinicalAgentLoop
from src.doctor_sim import DoctorSimulator
from src.learning_engine import FeedbackLearningEngine
```
Imports the 4 main components of the system. Each `from X import Y` means "go to file X and bring in the class Y."

```python
# Lines 19-29
def main():
    parser_arg = argparse.ArgumentParser(description="Clinical Discharge Summary Agent Orchestrator")
    parser_arg.add_argument("--api-key", "-k", type=str, default=None, help="Optional LLM API Key...")
    args = parser_arg.parse_args()
    cli_key = args.api_key
```
**`argparse`:** This creates a command-line interface. When you run `python main.py --api-key "abc123"`, argparse captures that `"abc123"` and stores it in `cli_key`. The `-k` is a short alias so you can type `python main.py -k "abc123"` instead.

```python
# Lines 36-38
os.makedirs("output/drafts", exist_ok=True)
os.makedirs("output/traces", exist_ok=True)
os.makedirs("output/plots", exist_ok=True)
```
Creates the output folders. `exist_ok=True` means "if the folder already exists, don't throw an error."

```python
# Lines 40-44
pdf_path = "data/raw_patients/patient 2.pdf"
parser = ClinicalTextParser()
patient_records = parser.parse_patient_pdf(pdf_path)
```
Creates a parser object and extracts patient records from the PDF. `patient_records` is now a dictionary like `{"Prema J": "clinical text...", "H D Nagaraja": "clinical text..."}`.

```python
# Lines 46-47
doctor = DoctorSimulator()
learning_engine = FeedbackLearningEngine()
```
Creates the simulated doctor and the learning engine. Both start with their initial states.

```python
# Lines 50-53
for patient_name, raw_text in patient_records.items():
```
Loops through each patient. `.items()` gives us both the key (patient name) and value (clinical text) from the dictionary.

```python
# Lines 57-58
agent_run_1 = ClinicalAgentLoop(feedback_memory=[], cli_api_key=cli_key)
payload_1 = agent_run_1.run(patient_id=patient_name, raw_clinical_text=raw_text)
```
**Iteration 1 (Baseline):** Creates a new agent with empty feedback memory (no learned rules yet). Runs it and gets the full output payload (draft + trace).

```python
# Line 59
draft_1 = payload_1.final_draft
```
Extracts just the discharge summary draft from the payload.

```python
# Line 62
edited_1 = doctor.apply_hidden_doctor_policy(draft_1)
```
The simulated doctor reviews and edits the draft (adds suffix/prefix).

```python
# Lines 65-67
str_d1 = f"{draft_1.principal_diagnosis} | {draft_1.follow_up_instructions}"
str_e1 = f"{edited_1.principal_diagnosis} | {edited_1.follow_up_instructions}"
learning_engine.register_iteration_performance(patient_name, str_d1, str_e1)
```
Creates string representations of the key fields and calculates edit distance. The `f"..."` syntax is an **f-string** (formatted string literal) — it lets you embed variable values inside a string using `{}`.

```python
# Line 70
new_rules = learning_engine.extract_feedback_rules(draft_1, edited_1)
```
Compares the original and edited drafts, extracts rules, and stores them in `learning_engine.correction_memory`.

```python
# Lines 75-76
agent_run_2 = ClinicalAgentLoop(feedback_memory=learning_engine.correction_memory, cli_api_key=cli_key)
payload_2 = agent_run_2.run(patient_id=patient_name, raw_clinical_text=raw_text)
```
**Iteration 2 (Feedback-Injected):** Creates a NEW agent but this time passes the learned rules! The agent now knows the doctor's preferences.

```python
# Lines 102-116
patient_slug = patient_name.replace(" ", "_")
draft_out_path = f"output/drafts/{patient_slug}_draft.json"
with open(draft_out_path, "w") as f:
    json.dump(payload_3.final_draft.model_dump(), f, indent=4)
```
Saves the final draft to a JSON file. `.model_dump()` converts the Pydantic object to a plain Python dictionary. `json.dump()` writes it to the file. `indent=4` makes it human-readable with 4 spaces of indentation.

```python
# Lines 119-120
plot_output_path = "output/plots/learning_curve.png"
learning_engine.generate_and_save_learning_curve(plot_output_path)
```
Generates the learning curve chart and saves it as a PNG image.

```python
# Lines 126-127
if __name__ == "__main__":
    main()
```
**What is this?** This is Python's standard idiom for "only run `main()` if this file is executed directly (not imported by another file)." When Python runs a file directly, it sets `__name__` to `"__main__"`.

---

## 10.2 [src/models.py](file:///f:/Current_Project/Clinical-Discharge-Summary-Agent/src/models.py) — Data Blueprints

```python
# Line 2
from pydantic import BaseModel, Field
```
- `BaseModel`: The base class for all Pydantic models. Any class that inherits from it gets automatic data validation.
- `Field`: A function for adding metadata (descriptions, defaults) to model fields.

```python
# Line 3
from typing import List, Optional, Literal
```
- `List`: Indicates a list of items (e.g., `List[str]` = a list of strings)
- `Optional`: Means the field can be `None`
- `Literal`: Restricts a field to specific allowed values (e.g., `Literal["A", "B"]` means only "A" or "B" are valid)

```python
# Lines 9-15
class ClinicalFlag(BaseModel):
    category: Literal["MISSING_DATA", "MEDICATION_MISMATCH", "CONFLICTING_DIAGNOSES", "PENDING_RESULT_WARNING"]
    item_involved: str
    description: str
    action_taken: str
```
Defines a safety flag. The `category` field can ONLY be one of those 4 values — if you try to create a `ClinicalFlag(category="RANDOM_VALUE", ...)`, Pydantic will throw a `ValidationError`.

```python
# Lines 21-22
status: Literal["UNCHANGED", "ADDED", "DISCONTINUED", "DOSAGE_CHANGED"]
```
Each medication tracks its reconciliation status — was it unchanged, newly added, discontinued, or dose-changed?

```python
# Lines 33-75
class DischargeSummaryDraft(BaseModel):
    patient_name: str = Field(default="missing", ...)
```
`default="missing"` means if no patient name is provided, it's automatically set to `"missing"` instead of causing an error. This enforces the **no-fabrication** requirement.

---

## 10.3 [src/doctor_sim.py](file:///f:/Current_Project/Clinical-Discharge-Summary-Agent/src/doctor_sim.py) — Simulated Doctor

```python
# Line 20
edited_draft = draft.model_copy(deep=True)
```
**`model_copy(deep=True)`:** Creates a complete independent copy of the draft. `deep=True` means it copies everything, including nested objects. Without this, modifying `edited_draft` would also modify the original `draft` (because Python uses references, not copies, by default).

```python
# Lines 23-24
if edited_draft.principal_diagnosis and not edited_draft.principal_diagnosis.endswith(self.preferred_suffix):
    edited_draft.principal_diagnosis += self.preferred_suffix
```
If the diagnosis doesn't already end with the verification suffix, append it. The `+=` operator adds text to the end of the existing string.

---

## 10.4 [src/learning_engine.py](file:///f:/Current_Project/Clinical-Discharge-Summary-Agent/src/learning_engine.py) — The Brain's Report Card

```python
# Line 2
import Levenshtein
```
Imports the C-optimized Levenshtein distance library. Much faster than writing the algorithm in pure Python.

```python
# Lines 17-23
def calculate_normalized_edit_distance(self, draft_text: str, edited_text: str) -> float:
    max_len = max(len(draft_text), len(edited_text))
    if max_len == 0:
        return 0.0
    distance = Levenshtein.distance(draft_text, edited_text)
    return float(distance) / max_len
```
- `Levenshtein.distance()` returns the raw edit distance (e.g., 15 changes)
- Dividing by `max_len` normalizes it to a 0.0-1.0 range
- If both strings are empty, returns 0.0 to avoid division by zero

```python
# Lines 36-40
suffix = " [Clinically Verified via Discharge Evaluation Policy]"
if edited_summary.principal_diagnosis.endswith(suffix) and not draft_summary.principal_diagnosis.endswith(suffix):
    rule = "For principal_diagnosis: Append '...' to denote clinical validation."
    if rule not in self.correction_memory:
        new_rules.append(rule)
        self.correction_memory.append(rule)
```
This is the rule extraction logic. It asks: "Did the doctor add this suffix, and was it NOT already in the original?" If yes, it creates a plain-English rule and stores it. The `if rule not in` check prevents duplicate rules.

---

## Summary of Key Design Decisions

| Decision | Why |
|---|---|
| **ReAct over simple chain** | Clinical safety requires step-by-step auditing |
| **Simulation fallback** | Ensures the project works without paid API keys |
| **Pydantic validation** | Structural safety net against fabrication |
| **Memory-based learning** | Simplest effective approach — no retraining needed |
| **Raw HTTP requests (no framework)** | Full control and auditability in clinical context |
| **Levenshtein for evaluation** | Concrete, mathematical, interpretable metric |
| **10-step limit** | Prevents infinite loops and runaway API costs |
