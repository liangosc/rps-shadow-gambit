# RPS Shadow Gambit

> A tactical, asymmetric Rock-Paper-Scissors mind game featuring Gambit/Shadow list mechanics, secure peer-to-peer (P2P) online multiplayer, and client-side cryptographic verification.

Play the game live: **[https://liangosc.github.io/rps-shadow-gambit/](https://liangosc.github.io/rps-shadow-gambit/)**

---

## 🎮 Game Rules & Asymmetric Flow

RPS Shadow Gambit elevates traditional Rock-Paper-Scissors into a strategic battle of deception and anticipation.

1. **Player 1 Turn (The Infiltration)**:
   - Selects 5 shapes for the public **Gambit** list ($L1_A$) &mdash; *visible to Player 2*.
   - Selects 5 shapes for the secret **Shadow** list ($L1_B$) &mdash; *hidden from Player 2*.
2. **Player 2 Turn (The Countermeasure)**:
   - Observes Player 1's public **Gambit** list.
   - Anticipates the hidden **Shadow** list and deploys a 5-shape **Counter** list ($L2$).
3. **The Showdown**:
   - The secret **Shadow** list ($L1_B$) is compared directly with the **Counter** list ($L2$) round-by-round.
   - The player with the most round wins wins the match.

---

## 🛠️ Technology Stack

* **Frontend Structure**: HTML5 with semantic structures and integrated SVG icon assets.
* **Styling & Theme**: Vanilla CSS3 featuring a cyberpunk dark-neon theme, glassmorphic panels, responsive flex/grid layouts, and 3D card-flip animation mechanics.
* **P2P Multiplayer**: [PeerJS CDN](https://peerjs.com/) for WebRTC data connection channels directly between players' browsers. Requires no registration, databases, or hosting servers.
* **Cryptographic Commitment**: Uses the browser's built-in **Web Crypto API** (SHA-256) to ensure fair play:
  - Player 1 commits a salted hash of their secret list: `SHA-256(L1_B + Salt)`.
  - At showdown, Player 1 reveals the clear-text list and salt, which Player 2's browser cryptographically validates. If a mismatch is detected, the showdown is aborted.
* **Audio Synthesis**: Synthesizes custom game SFX dynamically using the **Web Audio API** (includes click, hover, selection chimes, clash noises, victory fanfares, and defeat tones).

---

## 🚀 How to Run Locally

Since the game is built entirely with client-side code, it doesn't require compilation or runtime dependencies.

### Step 1: Clone the Repository
```bash
git clone https://github.com/liangosc/rps-shadow-gambit.git
cd rps-shadow-gambit
```

### Step 2: Run a Static Server
You can open `index.html` directly in your browser, but running a local server is recommended for testing WebRTC:

**Python**:
```bash
python -m http.server 8000
```

**NodeJS / npm**:
```bash
npx serve .
```

Then navigate to `http://localhost:8000` (or the port specified by your runner) in your browser.
