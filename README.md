# CHARLOK — Android starter project

This is the first native Android Compose scaffold for the CHARLOK rebrand.

## Current starter scope
- App label and package namespace branded as CHARLOK (`com.charlok.assistant`).
- Dark navy + electric-blue theme.
- Initial home screen and navigation placeholders for Home, Calls, History and Settings.
- No sensitive call/contact/microphone permission is requested in this starter.

## Build
Open this folder in Android Studio (Giraffe or newer) and let Gradle sync. Build the `app` debug APK.

## Important implementation notes
The supplied Equal AI split APK manifest was statically inspected. It declares a call-screening service and permissions for phone state, contacts, microphone, notifications, and overlay/foreground services. This starter intentionally does not copy the original app's code, signing identity, backend endpoints, API keys, or private assets. A clean implementation of call screening must request the Android call-screening role and each required runtime permission with clear user consent. AI call handling, transcripts, summaries, cloud sync, and authentication still need their own backend/API integration.

REA's Android workflow is documented in the official `morluto/rea` skill, but REA analysis tools are not connected in this ChatGPT session. The current environment also has Node 22.16.0, below REA's documented minimum Node 22.19. This starter therefore does not claim to contain REA decompilation findings or a completed clone.
