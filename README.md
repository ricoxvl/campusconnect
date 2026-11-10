# CampusConnect

**Helping university students discover relevant events and feel more confident attending them.**

CampusConnect is a student-focused event discovery product developed at UT Dallas. It prioritizes personalized, schedule-aware recommendations and a simpler path from discovering an event to deciding to attend.

> **Repository status:** This page documents the product and research. The application source has **not yet been published in this repository**, so this repository is not currently a runnable demo.

## The problem

Students, especially first-semester transfers and commuters, can have difficulty finding events that fit their interests and schedules.

I explored this through **24 student interviews** and **120 surveys**. Among survey respondents:

- **81/120 (67.5%)** reported difficulty consistently finding relevant campus events.
- **76/120 (63.3%)** said event recommendations often did not match their interests, schedules, or goals.
- **69/120 (57.5%)** reported discomfort attending unfamiliar events.

These are findings from this project's research sample, not estimates for all students.

## Product approach

The experience focuses on *Your First 3 Campus Experiences*: a small set of relevant events based on interests and availability, with enough context for a student to make a decision.

Core product directions include:

- Interest- and schedule-aware event discovery
- Concise recommendations with an explanation of fit
- Bookmarks and RSVP-related actions
- Admin-supported event curation
- Simple success metrics such as discovery time, engagement, and retention

## Validation

- **15 usability tests** informed iterations to the experience.
- In those tests, task completion improved from **70% to 90%**.
- Event discovery time decreased by **36%** across the tested iterations.
- An earlier **100-student beta** produced **40% four-week retention among 75 eligible participants** (30 active).

These are project-specific observations and do not establish causality or general population performance.

## Implementation

The application has been built using **React, TypeScript, Vite, and Tailwind CSS**, with a Cloudflare Workers API and D1 database in the project implementation. This README is a **product case study**, not evidence that those source files are present in this GitHub repository.

## Next steps

- [ ] Publish a sanitized, reproducible source-code snapshot
- [ ] Add product screenshots and a short walkthrough
- [ ] Document setup, architecture, and evaluation methodology
- [ ] Add a hosted demo link if one becomes available

---

**My focus:** Problem discovery, prioritization, prototyping, usability evaluation, and making participation easier for new students.
