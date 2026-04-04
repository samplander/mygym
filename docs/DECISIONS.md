# Decision Log

Track durable decisions here so we do not keep re-deciding the same things.

---

## 2026-04-03 — Create a dedicated `dev` branch
- Decision: active work will happen on `dev`, created from `main`
- Why: keeps experimentation and changes separate from the stable branch

## 2026-04-03 — Use the repo workspace as the project home
- Decision: clone and work on the project inside `~/.openclaw/workspace/development/mygym`
- Why: keeps collaboration, file access, and project docs inside the assistant workspace

## 2026-04-03 — Establish a mini protocol for MyGym / repEtition
- Decision: run the project through a small operating system with dedicated docs for brief, GTM, backlog, decisions, code readiness, and feature inventory
- Why: combine messy idea capture with structured product, engineering, and go-to-market execution

## 2026-04-03 — Track unanswered foundational questions without blocking setup
- Decision: open strategy and engineering questions will be recorded now and answered later
- Why: maintain momentum while preserving important unknowns

## 2026-04-04 — Exercise library edits should propagate everywhere
- Decision: changes made in the exercise library should propagate across active workouts, workout history, exercise history, and reporting
- Why: the current name-based hybrid model creates trust issues, uncategorized reporting drift, and broken continuity after renames

## 2026-04-04 — Add a manual history propagation / repair flow
- Decision: add a user-triggered flow to propagate or update all history after imports or historical cleanup
- Why: older backups and legacy records may need alignment with the current exercise library definitions

## 2026-04-04 — Move toward stable exercise identity
- Decision: exercise identity should move away from fragile name-only matching toward a stable canonical reference model
- Why: exercise rename/category changes need a durable way to stay coherent across logging, history, and reporting
