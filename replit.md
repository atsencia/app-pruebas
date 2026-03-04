# Registro Vecinal

A municipal neighborhood registration mobile app built with Expo React Native.

## Overview

This app allows municipal operators to register neighbor information including personal data, address, geolocation (with embedded map), and digital signature. Each submission generates a unique registration number.

## Credentials

- **Username:** `admin`
- **Password:** `registro2024`

## Features

- **Login screen** — Secure authentication with session management
- **Registration form** — Captures:
  - Neighbor full name
  - National ID (cédula)
  - Address (multiline)
  - Geolocation (native map picker with GPS + tap-to-place marker)
  - Digital signature pad (draw with finger)
- **Success screen** — Displays unique registration number (format: REG-YYYY-XXXXX) with animation

## Architecture

### Frontend (Expo Router)

- `app/_layout.tsx` — Root stack layout with AuthProvider
- `app/index.tsx` — Auth redirect logic
- `app/login.tsx` — Login screen
- `app/form.tsx` — Registration form
- `app/success.tsx` — Success/registration number screen
- `contexts/AuthContext.tsx` — Authentication context
- `components/SignaturePad.tsx` — SVG signature drawing component
- `components/MapPicker.tsx` — Web fallback for map
- `components/MapPicker.native.tsx` — Native map with react-native-maps

### Backend (Express)

- `server/routes.ts` — API routes + in-memory storage
  - `POST /api/auth/login` — Login
  - `GET /api/auth/me` — Current user
  - `POST /api/auth/logout` — Logout
  - `POST /api/registros` — Create registration (returns number)
  - `GET /api/registros` — List all registrations

## Tech Stack

- Expo SDK 54 / React Native
- expo-location for GPS
- react-native-maps@1.18.0 for native map (platform-specific import)
- react-native-svg + PanResponder for signature
- Express with express-session for auth
- @tanstack/react-query for data fetching

## Color Palette

- Primary: #1E3A5F (navy blue)
- Accent: #27AE60 (emerald green)
- Background: #F5F7FA
- Card: #FFFFFF

## Running

- Backend: `npm run server:dev` (port 5000)
- Frontend: `npm run expo:dev` (port 8081)
