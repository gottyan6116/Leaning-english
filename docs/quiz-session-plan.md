# Quiz session implementation plan

Goal: implement the approved full-screen vocabulary session and results without changing the existing vocabulary, articles, learning history, synchronization, or time accounting.

Architecture: add a dedicated material file, a standalone answer-log/session engine, and isolated session UI/CSS. Existing home launch calls the session. Session duration is a result-only elapsed duration, not learning-time accounting. Existing application data objects remain intact.

Tech stack: existing static HTML/CSS/classic JavaScript, no dependencies. There is no existing persistent storage; add versioned localStorage keys for answer logs, session settings and session bookmarks only. No cloud calls.

1. Write behavioral tests for priority queues, mode-isolated scores, SKIP, duplicate submission, pending mode, retries, persistence, and validated choices. Observe failure before implementation.
2. Add 30 separately identified development vocabulary items with per-mode verified four-option questions. Map the existing five words by headword without altering their fields.
3. Implement additive storage/session engine, failure-aware persistence and immutable answer events.
4. Implement isolated full-screen session, correct timer, wrong-answer sheet, interruption confirmation, three-item menu, keyboard and vibration.
5. Implement results/retry/next set/home and home launch binding only. Keep all unrelated screen markup/styles unchanged.
6. Test interactions and storage reload, capture 390px and 1280px session/results, audit scope and acceptance list, and record QA.
