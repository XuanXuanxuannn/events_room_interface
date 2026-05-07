# CBRIN Smart Event Space Platform

A project to design and prototype a smart event-space platform for **CBRIN** that makes room display usage easier for presenters and more valuable for staff when the screen is idle.

## Project Overview

This project focuses on improving the usability of CBRIN’s event-room display. At present, connecting to the screen can involve multiple manual steps and may require staff assistance. In addition, the display provides limited value when it is not actively being used.

The proposed solution is a two-mode platform:

- **Connection Mode**  
  Supports presenter interaction with the room display through:
  - wireless sharing
  - file upload
  - HDMI fallback

- **Billboard Mode**  
  Turns the screen into a branded digital display when idle, showing content such as:
  - upcoming events
  - partner and sponsor logos
  - community highlights
  - room-related information
 
## Sprint 1 Summary

Sprint 1 focused on defining the project direction and validating early design choices.

### Sprint 1 Outcomes

- Clarified project scope and requirements
- Developed personas, scenarios, and user stories
- Compared software implementation approaches
- Compared hardware platform options
- Produced early interface demos
- Prepared the initial proposal and sprint review evidence

### Key Research Findings

- A **web-based system** was identified as the preferred software approach for the MVP because it offers low setup friction, centralised maintenance, and flexibility for combining connection workflows with billboard content management.
- A **mini PC** remains a strong longer-term option for cleaner permanent installation.
- In Sprint 2, the team is exploring a **Raspberry Pi-based prototype path** for the simplest workable connection-flow demo.


## Sprint 2 Focus

Sprint 2 focused on establishing the technical baseline and developing an early connection demo for the prototype.

### Sprint 2 outcomes

- defined the core technology stack and local development environment
- drafted a high-level system architecture
- added initial project documentation
- designed a low-fidelity connection-mode screen
- prototyped the simplest workable connection flow
- defined the HDMI fallback user flow
- set up the backend / API connection
- ran an internal test of the early connection demo

### Key implementation findings

- A **lightweight web-based prototype** remains suitable for Sprint 2 and it allows the team to connect frontend screens, backend endpoints, and demo workflows quickly.
- A **simple backend / API layer** is useful for moving the prototype beyond static pages and supporting future dynamic features.
- The **connection-mode workflow** should remain simple and presenter-focused, with HDMI fallback clearly available when the primary connection method does not work.

## Repository Purpose

This repository is used to store project materials, prototype work, documentation, and interface development for the CBRIN Smart Event Space Platform.

It is expected to grow over the semester as the project moves from research and planning into implementation and testing.

## Planned Deliverables

The final project is expected to deliver:

1. **Working Smart Event-Space Software Prototype**  
   A prototype supporting the main system workflows, including presenter screen connection and idle billboard display.

2. **Deployable Hardware-Software Setup**  
   A working companion-device setup configured to run the prototype with the event-room display.

3. **Maintainable Staff and System Interface**  
   Presenter-facing and staff-facing interfaces that can be updated and managed after handover.

4. **Final Documentation and Delivery Plan**  
   Documentation, setup instructions, testing summary, limitations, and recommendations for future work.

## Current Status

This repository is currently in the **Sprint 2 prototype development stage**.  
At this stage, the main focus is on:

- technical baseline definition
- local development setup
- system architecture drafting
- connection-mode screen design
- early connection demo development
- backend / API connection setup
- HDMI fallback flow definition
- internal testing of the early demo

## Team

**Team member(s):**
- Yuxuan Liu, u7598939
- Yiping Zhu, u7747684
- Junnao Xiong, u7888908
- Kai Kuang, u7628326


## Client

**Client:**  
Ben Garrett, CBRIN

## Future Work

Planned next steps include:

- establishing the technical foundation for the prototype
- refining the connection-mode workflow
- developing early presenter interaction screens
- exploring billboard-mode content display
- testing hardware assumptions and deployment options

## Current MVP Status

The repository now includes a working backend + demo-page integration for:

- admin login
- admin billboard content list/create/delete
- presenter file upload (PDF/PPT/PPTX)
- admin billboard image upload
- uploaded-file listing with open links

## Setup Instructions

1. Create and activate a virtual environment

```bash
python3 -m venv .venv
source .venv/bin/activate
```

2. Install backend dependencies

```bash
pip install -r backend/requirements.txt
```

3. Initialize the database

```bash
python3 backend/init_db.py
```

4. (Optional) Seed sample data

```bash
python3 backend/seed_data.py
```

5. Run backend API server

```bash
python3 backend/app.py
```

6. In a new terminal, run demo static pages

```bash
cd demo
python3 -m http.server 5500
```

7. Open demo pages

- Admin: `http://127.0.0.1:5500/Admin_1.html`
- Presenter: `http://127.0.0.1:5500/presentation.html`

## Admin Login (Demo Defaults)

The current login endpoint uses environment variables, with defaults:

- username: `admin`
- password: `admin123`

You can override with:

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

## Backend API Overview

- `POST /api/auth/login`
- `GET /api/health`
- `GET /api/screen/state`
- `GET /api/connection/options`
- `GET /api/billboard/playlist`
- `GET /api/bookings/current-next`
- `GET /api/uploads`
- `POST /api/uploads`
- `POST /api/uploads/billboard-image`
- `GET /api/admin/content`
- `POST /api/admin/content`
- `DELETE /api/admin/content/<id>`
