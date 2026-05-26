/**
 * RPS SHADOW GAMBIT
 * Core Game Engine, WebRTC Peer-to-Peer Controller & Cryptographic Validator
 */

// ==========================================================================
// STATE & CONFIGURATION
// ==========================================================================
const SCREENS = {
    WELCOME: 'screen-welcome',
    P1_SETUP: 'screen-p1-setup',
    PASS: 'screen-pass',
    P2_SETUP: 'screen-p2-setup',
    SHOWDOWN: 'screen-showdown',
    GAME_OVER: 'screen-game-over'
};

const STATE = {
    // Game Inputs
    p1Gambit: Array(5).fill(null), // L1_A (Public)
    p1Shadow: Array(5).fill(null), // L1_B (Secret)
    p2Counter: Array(5).fill(null), // L2
    p1ShadowHash: null,             // P1's committed hash
    p1Salt: null,                   // P1's secret salt

    // Interface pointers
    activeSetupPlayer: 1, // 1 or 2
    activeSelectionType: 'gambit', // 'gambit' or 'shadow' (for P1 Setup)
    activeSlotIndex: 0, // 0 to 4

    // Audio status
    isAudioMuted: false,

    // Score & Playback
    scores: { p1: 0, p2: 0 },
    currentShowdownRound: 0,
    showdownIntervalId: null,
    isPlayingShowdown: false,

    // Online Multiplayer States
    isOnlineMode: false,
    playerRole: 'local',           // 'local', 'host' (P1), 'client' (P2)
    peer: null,                    // PeerJS instance
    conn: null,                    // PeerJS DataConnection
    myPeerId: '',
    opponentPeerId: '',
    cryptoStatus: 'local',         // 'local', 'secure', 'failed'
    iWantReplay: false,
    opponentWantsReplay: false
};

// SVG templates for Rock, Paper, Scissors used in JS renderings
const CHOICE_ICONS = {
    rock: `<svg viewBox="0 0 24 24" class="icon-choice"><use href="#icon-rock"></use></svg>`,
    paper: `<svg viewBox="0 0 24 24" class="icon-choice"><use href="#icon-paper"></use></svg>`,
    scissors: `<svg viewBox="0 0 24 24" class="icon-choice"><use href="#icon-scissors"></use></svg>`,
    lock: `<svg viewBox="0 0 24 24" class="icon-choice"><use href="#icon-lock"></use></svg>`
};

// ==========================================================================
// CRYPTOGRAPHIC UTILITIES (Web Crypto API)
// ==========================================================================

// Generates a random salt string to secure hash inputs
function generateSalt(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let salt = '';
    for (let i = 0; i < length; i++) {
        salt += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return salt;
}

// Generates SHA-256 hex string using subtle crypto
async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

// ==========================================================================
// WEB AUDIO SYNTHESIZER
// ==========================================================================
let audioCtx = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playSound(type) {
    if (STATE.isAudioMuted) return;
    try {
        initAudio();
    } catch (e) {
        console.warn("Audio Context could not start:", e);
        return;
    }

    const now = audioCtx.currentTime;
    const masterGain = audioCtx.createGain();
    masterGain.connect(audioCtx.destination);
    
    switch (type) {
        case 'click': {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(1500, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.05);
            gain.gain.setValueAtTime(0.04, now);
            gain.gain.linearRampToValueAtTime(0.0, now + 0.05);
            osc.connect(gain);
            gain.connect(masterGain);
            osc.start(now);
            osc.stop(now + 0.05);
            break;
        }
        case 'hover': {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(350, now);
            osc.frequency.exponentialRampToValueAtTime(80, now + 0.04);
            gain.gain.setValueAtTime(0.02, now);
            gain.gain.linearRampToValueAtTime(0.0, now + 0.04);
            osc.connect(gain);
            gain.connect(masterGain);
            osc.start(now);
            osc.stop(now + 0.04);
            break;
        }
        case 'select': {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(587.33, now);
            osc.frequency.setValueAtTime(880, now + 0.04);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
            osc.connect(gain);
            gain.connect(masterGain);
            osc.start(now);
            osc.stop(now + 0.15);
            break;
        }
        case 'swoop': {
            const osc = audioCtx.createOscillator();
            const filter = audioCtx.createBiquadFilter();
            const gain = audioCtx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(80, now);
            osc.frequency.exponentialRampToValueAtTime(500, now + 0.25);
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(200, now);
            filter.frequency.exponentialRampToValueAtTime(1200, now + 0.25);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.linearRampToValueAtTime(0.0, now + 0.25);
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(masterGain);
            osc.start(now);
            osc.stop(now + 0.25);
            break;
        }
        case 'reveal': {
            const osc1 = audioCtx.createOscillator();
            const osc2 = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(440, now);
            osc1.frequency.exponentialRampToValueAtTime(880, now + 0.3);
            osc2.type = 'triangle';
            osc2.frequency.setValueAtTime(554.37, now);
            osc2.frequency.exponentialRampToValueAtTime(1108.73, now + 0.3);
            gain.gain.setValueAtTime(0.07, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(masterGain);
            osc1.start(now);
            osc2.start(now);
            osc1.stop(now + 0.45);
            osc2.stop(now + 0.45);
            break;
        }
        case 'clash': {
            const noiseBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.25, audioCtx.sampleRate);
            const output = noiseBuffer.getChannelData(0);
            for (let i = 0; i < noiseBuffer.length; i++) {
                output[i] = Math.random() * 2 - 1;
            }
            const noiseNode = audioCtx.createBufferSource();
            noiseNode.buffer = noiseBuffer;
            
            const noiseFilter = audioCtx.createBiquadFilter();
            noiseFilter.type = 'bandpass';
            noiseFilter.frequency.setValueAtTime(600, now);
            noiseFilter.frequency.exponentialRampToValueAtTime(100, now + 0.2);
            
            const noiseGain = audioCtx.createGain();
            noiseGain.gain.setValueAtTime(0.12, now);
            noiseGain.gain.linearRampToValueAtTime(0.0, now + 0.22);
            
            const subOsc = audioCtx.createOscillator();
            const subGain = audioCtx.createGain();
            subOsc.type = 'sine';
            subOsc.frequency.setValueAtTime(120, now);
            subOsc.frequency.exponentialRampToValueAtTime(40, now + 0.35);
            subGain.gain.setValueAtTime(0.2, now);
            subGain.gain.linearRampToValueAtTime(0.0, now + 0.35);
            
            noiseNode.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(masterGain);
            subOsc.connect(subGain);
            subGain.connect(masterGain);
            
            noiseNode.start(now);
            subOsc.start(now);
            noiseNode.stop(now + 0.35);
            subOsc.stop(now + 0.35);
            break;
        }
        case 'victory': {
            const freqs = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
            freqs.forEach((f, idx) => {
                const noteTime = now + (idx * 0.07);
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(f, noteTime);
                gain.gain.setValueAtTime(0.0, now);
                gain.gain.setValueAtTime(0.06, noteTime);
                gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.8);
                osc.connect(gain);
                gain.connect(masterGain);
                osc.start(noteTime);
                osc.stop(noteTime + 0.8);
            });
            break;
        }
        case 'tie': {
            const osc1 = audioCtx.createOscillator();
            const osc2 = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(293.66, now);
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(297.00, now);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(masterGain);
            osc1.start(now);
            osc2.start(now);
            osc1.stop(now + 0.5);
            osc2.stop(now + 0.5);
            break;
        }
        case 'defeat': {
            const freqs = [440.00, 349.23, 293.66, 220.00];
            freqs.forEach((f, idx) => {
                const noteTime = now + (idx * 0.12);
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(f, noteTime);
                gain.gain.setValueAtTime(0.0, now);
                gain.gain.setValueAtTime(0.08, noteTime);
                gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 1.2);
                osc.connect(gain);
                gain.connect(masterGain);
                osc.start(noteTime);
                osc.stop(noteTime + 1.2);
            });
            break;
        }
    }
}

// ==========================================================================
// GAME STATE MANAGEMENT & OVERLAY CONTROLS
// ==========================================================================
function setScreen(screenId) {
    if (screenId !== SCREENS.WELCOME) {
        playSound('swoop');
    }
    document.querySelectorAll('.game-screen').forEach(screen => {
        screen.classList.remove('active');
    });
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
    }
}

function showScreenLock(show, title = '', msg = '') {
    const lockOverlay = document.getElementById('screen-lock-overlay');
    if (show) {
        document.getElementById('lock-overlay-title').innerText = title.toUpperCase();
        document.getElementById('lock-overlay-msg').innerText = msg;
        lockOverlay.classList.add('active');
    } else {
        lockOverlay.classList.remove('active');
    }
}

function initGame() {
    STATE.p1Gambit.fill(null);
    STATE.p1Shadow.fill(null);
    STATE.p2Counter.fill(null);
    STATE.p1ShadowHash = null;
    STATE.p1Salt = null;
    STATE.scores.p1 = 0;
    STATE.scores.p2 = 0;
    STATE.currentShowdownRound = 0;
    STATE.isPlayingShowdown = false;
    STATE.iWantReplay = false;
    STATE.opponentWantsReplay = false;
    
    if (STATE.showdownIntervalId) {
        clearInterval(STATE.showdownIntervalId);
        STATE.showdownIntervalId = null;
    }

    // Default label adjustments
    document.getElementById('lbl-p1-badge').innerText = 'PLAYER 1 TURN';
    document.getElementById('lbl-p1-setup-instructions').innerText = 'Construct your tactical public and hidden lists.';
    document.getElementById('lbl-p2-badge').innerText = 'PLAYER 2 TURN';
    document.getElementById('lbl-p1-score-team').innerText = 'P1 SHADOW';
    document.getElementById('lbl-p2-score-team').innerText = 'P2 COUNTER';
    document.getElementById('lbl-p1-summary-col').innerText = 'P1 SHADOW ($L1_B$)';
    document.getElementById('lbl-p2-summary-col').innerText = 'P2 COUNTER ($L2$)';

    // Reset execute showdown buttons
    document.getElementById('btn-start-showdown').style.display = 'inline-flex';

    if (STATE.isOnlineMode) {
        // Clear screen locks
        showScreenLock(false);

        // Adjust badge labels based on role
        if (STATE.playerRole === 'host') {
            document.getElementById('lbl-p1-badge').innerText = 'PLAYER 1 (YOU)';
            document.getElementById('lbl-p1-setup-instructions').innerText = 'Construct your Gambit and secret Shadow lists.';
            document.getElementById('lbl-p2-badge').innerText = 'PLAYER 2 (OPPONENT)';
            document.getElementById('lbl-p1-score-team').innerText = 'YOU (SHADOW)';
            document.getElementById('lbl-p2-score-team').innerText = 'OPPONENT (COUNTER)';
            document.getElementById('lbl-p1-summary-col').innerText = 'YOU ($L1_B$)';
            document.getElementById('lbl-p2-summary-col').innerText = 'OPPONENT ($L2$)';
        } else {
            document.getElementById('lbl-p1-badge').innerText = 'PLAYER 1 (OPPONENT)';
            document.getElementById('lbl-p2-badge').innerText = 'PLAYER 2 (YOU)';
            document.getElementById('lbl-p1-score-team').innerText = 'OPPONENT (SHADOW)';
            document.getElementById('lbl-p2-score-team').innerText = 'YOU (COUNTER)';
            document.getElementById('lbl-p1-summary-col').innerText = 'OPPONENT ($L1_B$)';
            document.getElementById('lbl-p2-summary-col').innerText = 'YOU ($L2$)';
        }
    } else {
        STATE.playerRole = 'local';
    }

    setupP1Screens();
}

// ==========================================================================
// PEER-TO-PEER MULTIPLAYER CONSOLE
// ==========================================================================
function updateConnectionStatus(status, text) {
    const dot = document.querySelector('.status-dot');
    const label = document.getElementById('connection-status-text');
    
    dot.className = 'status-dot';
    label.innerText = text.toUpperCase();

    switch (status) {
        case 'connecting':
            dot.classList.add('connecting');
            break;
        case 'active':
            dot.classList.add('active');
            break;
        case 'error':
            dot.classList.add('error');
            break;
        default:
            break;
    }
}

function handlePeerDisconnect() {
    updateConnectionStatus('error', 'CONNECTION TERMINATED');
    playSound('defeat');
    showScreenLock(true, 'CONNECTION LOST', 'Opponent disconnected. Please reload the page to host or join a new session.');
    
    const overlay = document.getElementById('screen-lock-overlay');
    const existingBtn = document.getElementById('btn-refresh-disconnect');
    if (!existingBtn) {
        const btn = document.createElement('button');
        btn.id = 'btn-refresh-disconnect';
        btn.className = 'btn primary-btn glow-cyan';
        btn.style.marginTop = '20px';
        btn.innerHTML = '<span>RELOAD GAME</span>';
        btn.addEventListener('click', () => {
            window.location.reload();
        });
        overlay.querySelector('.overlay-content').appendChild(btn);
    }
}

// Setup connection listeners for both Host & Client
function setupConnectionListeners(connection) {
    connection.on('open', () => {
        updateConnectionStatus('active', 'SECURE PEER LINK ESTABLISHED');
        playSound('select');

        if (STATE.playerRole === 'host') {
            // Handshake Client
            connection.send({
                type: 'HANDSHAKE_ACK',
                role: 'client'
            });

            // Transition Host to Setup screen
            setTimeout(() => {
                initGame();
                setScreen(SCREENS.P1_SETUP);
            }, 1200);
        }
    });

    connection.on('data', async (packet) => {
        console.log("Multiplayer Signal Received:", packet.type, packet);
        
        switch (packet.type) {
            case 'HANDSHAKE_ACK': {
                // Client gets confirmation
                STATE.playerRole = packet.role; // 'client'
                updateConnectionStatus('active', 'SECURE PEER LINK ESTABLISHED');
                playSound('select');

                setTimeout(() => {
                    initGame();
                    setScreen(SCREENS.P2_SETUP);
                    showScreenLock(true, 'DEPLOYS IN PROGRESS', 'Waiting for Player 1 to deploy their Gambit lists...');
                }, 1200);
                break;
            }

            case 'SUBMIT_P1': {
                // Client receives P1's Gambit and Shadow Hash
                STATE.p1Gambit = packet.p1Gambit;
                STATE.p1ShadowHash = packet.p1ShadowHash;

                showScreenLock(false);
                setupP2Screens(); // render slots & populate intel
                break;
            }

            case 'SUBMIT_P2': {
                // Host receives P2 Counter
                STATE.p2Counter = packet.p2Counter;
                showScreenLock(true, 'VERIFYING PROTOCOL', 'Verifying cryptography keys and executing showdown maps...');

                // Host responds back with the clear Shadow list and Salt for validation
                STATE.conn.send({
                    type: 'REVEAL_P1',
                    p1Shadow: STATE.p1Shadow,
                    salt: STATE.p1Salt
                });

                // Host advances to Showdown Screen
                STATE.cryptoStatus = 'secure';
                setTimeout(() => {
                    showScreenLock(false);
                    setupShowdown();
                    setScreen(SCREENS.SHOWDOWN);
                }, 1000);
                break;
            }

            case 'REVEAL_P1': {
                // Client receives secret choices and salt. Validate them!
                const receivedShadow = packet.p1Shadow;
                const receivedSalt = packet.salt;

                // Hash verification
                const combinedStr = `${receivedShadow.join(',')}:${receivedSalt}`;
                const calculatedHash = await sha256(combinedStr);

                if (calculatedHash === STATE.p1ShadowHash) {
                    STATE.p1Shadow = receivedShadow;
                    STATE.cryptoStatus = 'secure';
                    
                    // Render Arena
                    setupShowdown();
                    setScreen(SCREENS.SHOWDOWN);
                    
                    // Clients can't trigger Execute showdown directly to preserve timing sync
                    document.getElementById('btn-start-showdown').style.display = 'none';
                    showScreenLock(true, 'GAMBIT LOCKED', 'Host is preparing to resolve showdown protocols...');
                } else {
                    STATE.cryptoStatus = 'failed';
                    playSound('defeat');
                    
                    // Abort and warn Client
                    setupShowdown();
                    setScreen(SCREENS.SHOWDOWN);
                    document.getElementById('btn-start-showdown').style.display = 'none';
                    showScreenLock(true, 'TAMPERING DETECTED', 'Host has tampered with their secret list! Showdown sequence aborted.');
                }
                break;
            }

            case 'EXECUTE_SHOWDOWN': {
                // Client receives sync trigger
                showScreenLock(false);
                executeShowdown();
                break;
            }

            case 'REPLAY_REQUEST': {
                STATE.opponentWantsReplay = true;
                checkSyncReplay();
                break;
            }

            case 'ROOM_FULL': {
                updateConnectionStatus('error', 'ROOM COMPROMISED: FULL');
                playSound('defeat');
                break;
            }
        }
    });

    connection.on('close', () => handlePeerDisconnect());
    connection.on('error', (err) => handlePeerDisconnect());
}

function initializeHostSession() {
    updateConnectionStatus('connecting', 'ALLOCATING PEER FREQUENCY...');
    
    // Create random 5-character readable session code
    const sessionId = 'SG-' + Math.floor(1000 + Math.random() * 9000);
    
    STATE.peer = new Peer(sessionId);
    
    STATE.peer.on('open', (id) => {
        STATE.myPeerId = id;
        document.getElementById('lbl-my-id').innerText = id;
        document.getElementById('host-id-display').style.display = 'block';
        updateConnectionStatus('connecting', 'TUNING DEPLOYER SIGNAL. WAITING FOR CLIENT...');
    });

    STATE.peer.on('connection', (connection) => {
        if (STATE.conn) {
            connection.on('open', () => {
                connection.send({ type: 'ROOM_FULL' });
                setTimeout(() => connection.close(), 500);
            });
            return;
        }
        STATE.playerRole = 'host';
        STATE.conn = connection;
        setupConnectionListeners(connection);
    });

    STATE.peer.on('error', (err) => {
        console.error("PeerJS Host Error:", err);
        if (err.type === 'unavailable-id') {
            // Recalculate room ID if code collision occurs
            initializeHostSession();
        } else {
            updateConnectionStatus('error', `FREQUENCY BLOCKED: ${err.type.toUpperCase()}`);
            playSound('defeat');
        }
    });
}

function establishConnection(targetId) {
    if (!targetId || targetId.trim() === '') {
        updateConnectionStatus('error', 'INVALID SESSION CODE');
        playSound('defeat');
        return;
    }
    
    updateConnectionStatus('connecting', 'INFILTRATING ROOM CODE...');
    
    // Client initiates Peer object
    STATE.peer = new Peer();
    
    STATE.peer.on('open', () => {
        const conn = STATE.peer.connect(targetId.trim().toUpperCase());
        STATE.conn = conn;
        STATE.playerRole = 'client';
        setupConnectionListeners(conn);
    });

    STATE.peer.on('error', (err) => {
        console.error("PeerJS Client Error:", err);
        updateConnectionStatus('error', `CONNECTION COMPROMISED: ${err.type.toUpperCase()}`);
        playSound('defeat');
    });
}

function requestReplay() {
    STATE.iWantReplay = true;
    if (STATE.isOnlineMode) {
        playSound('select');
        STATE.conn.send({ type: 'REPLAY_REQUEST' });
        
        const btn = document.getElementById('btn-replay');
        btn.disabled = true;
        btn.innerHTML = '<span>WAITING FOR OPPONENT...</span>';
        
        checkSyncReplay();
    } else {
        initGame();
    }
}

function checkSyncReplay() {
    if (STATE.iWantReplay && STATE.opponentWantsReplay) {
        // Redeploy
        initGame();
        
        showScreenLock(false);
        if (STATE.playerRole === 'host') {
            setScreen(SCREENS.P1_SETUP);
            setupP1Screens();
        } else {
            setScreen(SCREENS.P2_SETUP);
            setupP2Screens();
            showScreenLock(true, 'DEPLOYS IN PROGRESS', 'Waiting for Player 1 to deploy their Gambit lists...');
        }
        
        const btn = document.getElementById('btn-replay');
        btn.disabled = false;
        btn.innerHTML = '<span>REDEPLOY FORCES</span>';
    }
}

// ==========================================================================
// PLAYER 1 SETUP CONTROLLERS (Public & Secret Lists)
// ==========================================================================
function setupP1Screens() {
    STATE.activeSetupPlayer = 1;
    STATE.activeSelectionType = 'gambit';
    STATE.activeSlotIndex = 0;

    renderP1Slots();
    updateSelectionLabel(1);
    updateConfirmButtonState(1);
}

function renderP1Slots() {
    const gambitContainer = document.getElementById('p1-gambit-slots');
    const shadowContainer = document.getElementById('p1-shadow-slots');

    gambitContainer.innerHTML = '';
    shadowContainer.innerHTML = '';

    // Render Gambit Slots
    for (let i = 0; i < 5; i++) {
        const slot = document.createElement('div');
        slot.className = 'card-slot';
        if (STATE.activeSelectionType === 'gambit' && STATE.activeSlotIndex === i) {
            slot.classList.add('active');
        }
        if (STATE.p1Gambit[i]) {
            slot.classList.add('filled');
            slot.innerHTML = CHOICE_ICONS[STATE.p1Gambit[i]];
        }
        slot.addEventListener('click', () => {
            playSound('click');
            STATE.activeSelectionType = 'gambit';
            STATE.activeSlotIndex = i;
            highlightActiveSlot(1);
        });
        gambitContainer.appendChild(slot);
    }

    // Render Shadow Slots
    for (let i = 0; i < 5; i++) {
        const slot = document.createElement('div');
        slot.className = 'card-slot';
        if (STATE.activeSelectionType === 'shadow' && STATE.activeSlotIndex === i) {
            slot.classList.add('active');
        }
        if (STATE.p1Shadow[i]) {
            slot.classList.add('filled');
            slot.classList.add('shadow-hidden');
            slot.innerHTML = CHOICE_ICONS['lock'];
        }
        slot.addEventListener('click', () => {
            playSound('click');
            STATE.activeSelectionType = 'shadow';
            STATE.activeSlotIndex = i;
            highlightActiveSlot(1);
        });
        shadowContainer.appendChild(slot);
    }
}

function highlightActiveSlot(playerNum) {
    if (playerNum === 1) {
        renderP1Slots();
        updateSelectionLabel(1);
    } else {
        renderP2Slots();
        updateSelectionLabel(2);
    }
}

function updateSelectionLabel(playerNum) {
    if (playerNum === 1) {
        const label = document.getElementById('current-slot-label');
        const listName = STATE.activeSelectionType === 'gambit' ? 'Public' : 'Shadow';
        label.innerText = `${listName} Slot ${STATE.activeSlotIndex + 1}`;
        label.className = `highlight-text ${STATE.activeSelectionType === 'gambit' ? 'text-cyan' : 'text-purple'}`;
    } else {
        const label = document.getElementById('p2-slot-label');
        label.innerText = `Counter Slot ${STATE.activeSlotIndex + 1}`;
        label.className = `highlight-text text-magenta`;
    }
}

async function handleChoiceSelection(choice) {
    playSound('select');

    if (STATE.activeSetupPlayer === 1) {
        if (STATE.activeSelectionType === 'gambit') {
            STATE.p1Gambit[STATE.activeSlotIndex] = choice;
        } else {
            STATE.p1Shadow[STATE.activeSlotIndex] = choice;
        }
        
        // Auto-advance logic for P1
        let nextIndex = (STATE.activeSlotIndex + 1) % 5;
        const currentList = STATE.activeSelectionType === 'gambit' ? STATE.p1Gambit : STATE.p1Shadow;
        const alternateList = STATE.activeSelectionType === 'gambit' ? STATE.p1Shadow : STATE.p1Gambit;
        
        if (currentList.includes(null)) {
            for (let j = 0; j < 5; j++) {
                let idx = (STATE.activeSlotIndex + 1 + j) % 5;
                if (currentList[idx] === null) {
                    STATE.activeSlotIndex = idx;
                    break;
                }
            }
        } else if (alternateList.includes(null)) {
            STATE.activeSelectionType = STATE.activeSelectionType === 'gambit' ? 'shadow' : 'gambit';
            STATE.activeSlotIndex = alternateList.indexOf(null);
        } else {
            STATE.activeSlotIndex = nextIndex;
        }

        renderP1Slots();
        updateSelectionLabel(1);
        updateConfirmButtonState(1);

    } else { // Player 2
        STATE.p2Counter[STATE.activeSlotIndex] = choice;

        if (STATE.p2Counter.includes(null)) {
            for (let j = 0; j < 5; j++) {
                let idx = (STATE.activeSlotIndex + 1 + j) % 5;
                if (STATE.p2Counter[idx] === null) {
                    STATE.activeSlotIndex = idx;
                    break;
                }
            }
        } else {
            STATE.activeSlotIndex = (STATE.activeSlotIndex + 1) % 5;
        }

        renderP2Slots();
        updateSelectionLabel(2);
        updateConfirmButtonState(2);
    }
}

function updateConfirmButtonState(playerNum) {
    if (playerNum === 1) {
        const isComplete = !STATE.p1Gambit.includes(null) && !STATE.p1Shadow.includes(null);
        document.getElementById('btn-p1-confirm').disabled = !isComplete;
    } else {
        const isComplete = !STATE.p2Counter.includes(null);
        document.getElementById('btn-p2-confirm').disabled = !isComplete;
    }
}

function revealShadowList(show) {
    const shadowContainer = document.getElementById('p1-shadow-slots');
    const slots = shadowContainer.children;

    for (let i = 0; i < 5; i++) {
        const val = STATE.p1Shadow[i];
        if (val && slots[i]) {
            if (show) {
                slots[i].classList.remove('shadow-hidden');
                slots[i].innerHTML = CHOICE_ICONS[val];
            } else {
                slots[i].classList.add('shadow-hidden');
                slots[i].innerHTML = CHOICE_ICONS['lock'];
            }
        }
    }
}

// ==========================================================================
// PLAYER 2 SETUP CONTROLLERS (Counter List)
// ==========================================================================
function setupP2Screens() {
    STATE.activeSetupPlayer = 2;
    STATE.activeSlotIndex = 0;

    // Display P1's Public Gambit
    const intelPublic = document.getElementById('p2-intel-public');
    intelPublic.innerHTML = '';
    for (let i = 0; i < 5; i++) {
        const slot = document.createElement('div');
        slot.className = 'card-slot read-only filled';
        slot.innerHTML = CHOICE_ICONS[STATE.p1Gambit[i]];
        intelPublic.appendChild(slot);
    }

    renderP2Slots();
    updateSelectionLabel(2);
    updateConfirmButtonState(2);
}

function renderP2Slots() {
    const counterContainer = document.getElementById('p2-counter-slots');
    counterContainer.innerHTML = '';

    for (let i = 0; i < 5; i++) {
        const slot = document.createElement('div');
        slot.className = 'card-slot';
        if (STATE.activeSlotIndex === i) {
            slot.classList.add('active');
        }
        if (STATE.p2Counter[i]) {
            slot.classList.add('filled');
            slot.innerHTML = CHOICE_ICONS[STATE.p2Counter[i]];
        }
        slot.addEventListener('click', () => {
            playSound('click');
            STATE.activeSlotIndex = i;
            highlightActiveSlot(2);
        });
        counterContainer.appendChild(slot);
    }
}

// ==========================================================================
// SHOWDOWN LOGIC & FLIP TIMERS
// ==========================================================================
function setupShowdown() {
    STATE.scores.p1 = 0;
    STATE.scores.p2 = 0;
    STATE.currentShowdownRound = 0;
    STATE.isPlayingShowdown = false;

    document.getElementById('score-p1').innerText = '0';
    document.getElementById('score-p2').innerText = '0';

    const tracksContainer = document.getElementById('showdown-tracks');
    tracksContainer.innerHTML = '';

    // Security Status Badges
    const badgeText = STATE.isOnlineMode ? '🛡️ CRYPTOGRAPHIC INTEGRITY VERIFIED' : '🛡️ LOCAL SECURITY VALIDATED';
    const badgeClass = STATE.isOnlineMode ? 'security-badge badge-secure' : 'security-badge badge-neutral';

    document.getElementById('showdown-security-badge').innerText = badgeText;
    document.getElementById('showdown-security-badge').className = badgeClass;
    document.getElementById('gameover-security-badge').innerText = badgeText;
    document.getElementById('gameover-security-badge').className = badgeClass;

    // Render 5 ShowdownTracks
    for (let i = 0; i < 5; i++) {
        const track = document.createElement('div');
        track.className = 'duel-track';
        track.id = `duel-track-${i}`;

        track.innerHTML = `
            <div class="track-round-badge">ROUND ${i + 1}</div>
            
            <div class="card-flip-container p1-card">
                <div class="card-flip-inner" id="p1-card-inner-${i}">
                    <div class="card-face card-face-back">
                        ${CHOICE_ICONS['lock']}
                    </div>
                    <div class="card-face card-face-front">
                        ${CHOICE_ICONS[STATE.p1Shadow[i]]}
                    </div>
                </div>
            </div>

            <div class="duel-clash-zone">
                <span class="vs-text">VS</span>
            </div>

            <div class="card-flip-container p2-card">
                <div class="card-flip-inner" id="p2-card-inner-${i}">
                    <div class="card-face card-face-back">
                        ${CHOICE_ICONS['lock']}
                    </div>
                    <div class="card-face card-face-front">
                        ${CHOICE_ICONS[STATE.p2Counter[i]]}
                    </div>
                </div>
            </div>

            <div class="outcome-text" id="outcome-text-${i}">DRAW</div>
        `;
        tracksContainer.appendChild(track);
    }

    // Host/Local controls showdown
    if (STATE.isOnlineMode && STATE.playerRole === 'client') {
        document.getElementById('btn-start-showdown').style.display = 'none';
    } else {
        document.getElementById('btn-start-showdown').style.display = 'inline-flex';
        document.getElementById('btn-start-showdown').disabled = false;
    }
    document.getElementById('btn-showdown-results').style.display = 'none';
}

function checkRoundWinner(p1Choice, p2Choice) {
    if (p1Choice === p2Choice) return 'tie';
    if (
        (p1Choice === 'rock' && p2Choice === 'scissors') ||
        (p1Choice === 'paper' && p2Choice === 'rock') ||
        (p1Choice === 'scissors' && p2Choice === 'paper')
    ) {
        return 'p1';
    }
    return 'p2';
}

function executeShowdown() {
    if (STATE.isPlayingShowdown) return;
    STATE.isPlayingShowdown = true;

    // Host broadcasts sync command
    if (STATE.isOnlineMode && STATE.playerRole === 'host') {
        STATE.conn.send({ type: 'EXECUTE_SHOWDOWN' });
    }

    document.getElementById('btn-start-showdown').disabled = true;

    let round = 0;
    const intervalTime = 1300;

    function flipNextRound() {
        if (round >= 5) {
            clearInterval(STATE.showdownIntervalId);
            STATE.showdownIntervalId = null;
            
            setTimeout(() => {
                document.getElementById('btn-start-showdown').style.display = 'none';
                document.getElementById('btn-showdown-results').style.display = 'inline-flex';
                playSound('select');
            }, 500);
            return;
        }

        const p1Choice = STATE.p1Shadow[round];
        const p2Choice = STATE.p2Counter[round];
        const winner = checkRoundWinner(p1Choice, p2Choice);

        const p1CardInner = document.getElementById(`p1-card-inner-${round}`);
        const p2CardInner = document.getElementById(`p2-card-inner-${round}`);
        const outcomeLabel = document.getElementById(`outcome-text-${round}`);
        const trackRow = document.getElementById(`duel-track-${round}`);

        playSound('reveal');
        p1CardInner.classList.add('flipped');
        p2CardInner.classList.add('flipped');

        setTimeout(() => {
            playSound('clash');

            if (winner === 'p1') {
                STATE.scores.p1++;
                document.getElementById('score-p1').innerText = STATE.scores.p1;
                outcomeLabel.innerText = STATE.isOnlineMode && STATE.playerRole === 'client' ? 'P1 WIN' : 'YOU WIN';
                if (STATE.playerRole === 'local') outcomeLabel.innerText = 'P1 WIN';
                outcomeLabel.className = 'outcome-text show text-p1-win';
                trackRow.classList.add('p1-wins');
            } else if (winner === 'p2') {
                STATE.scores.p2++;
                document.getElementById('score-p2').innerText = STATE.scores.p2;
                outcomeLabel.innerText = STATE.isOnlineMode && STATE.playerRole === 'host' ? 'P2 WIN' : 'YOU WIN';
                if (STATE.playerRole === 'local') outcomeLabel.innerText = 'P2 WIN';
                outcomeLabel.className = 'outcome-text show text-p2-win';
                trackRow.classList.add('p2-wins');
            } else {
                outcomeLabel.innerText = 'TIE';
                outcomeLabel.className = 'outcome-text show text-draw';
                trackRow.classList.add('draw');
            }
        }, 550);

        round++;
    }

    flipNextRound();
    STATE.showdownIntervalId = setInterval(flipNextRound, intervalTime);
}

// ==========================================================================
// RESULTS & RESET CONTROLLERS
// ==========================================================================
function populateGameOverScreen() {
    const title = document.getElementById('game-result-title');
    const subtitle = document.getElementById('game-result-detail');
    
    const p1Score = STATE.scores.p1;
    const p2Score = STATE.scores.p2;

    if (STATE.cryptoStatus === 'failed') {
        title.innerText = 'BATTLE ABORTED';
        title.className = 'game-over-banner text-draw';
        subtitle.innerText = 'Illegal modifications detected in Shadow packets.';
        return;
    }

    if (STATE.isOnlineMode) {
        if (p1Score > p2Score) {
            title.innerText = STATE.playerRole === 'host' ? 'YOU ARE VICTORIOUS' : 'OPPONENT VICTORIOUS';
            title.className = STATE.playerRole === 'host' ? 'game-over-banner text-cyan' : 'game-over-banner text-magenta';
            subtitle.innerText = `Player 1 secured dominance with a ${p1Score} - ${p2Score} result.`;
            if (STATE.playerRole === 'host') playSound('victory'); else playSound('defeat');
        } else if (p2Score > p1Score) {
            title.innerText = STATE.playerRole === 'client' ? 'YOU ARE VICTORIOUS' : 'OPPONENT VICTORIOUS';
            title.className = STATE.playerRole === 'client' ? 'game-over-banner text-cyan' : 'game-over-banner text-magenta';
            subtitle.innerText = `Player 2 successfully countered with a ${p2Score} - ${p1Score} result.`;
            if (STATE.playerRole === 'client') playSound('victory'); else playSound('defeat');
        } else {
            title.innerText = 'SYSTEM TIE';
            title.className = 'game-over-banner text-draw';
            subtitle.innerText = `Balanced operations resolved in a tie: ${p1Score} - ${p2Score}.`;
            playSound('tie');
        }
    } else { // Local hot-seat
        if (p1Score > p2Score) {
            title.innerText = 'PLAYER 1 VICTORIOUS';
            title.className = 'game-over-banner text-cyan';
            subtitle.innerText = `Secured a ${p1Score} - ${p2Score} dominance against Player 2.`;
            playSound('victory');
        } else if (p2Score > p1Score) {
            title.innerText = 'PLAYER 2 VICTORIOUS';
            title.className = 'game-over-banner text-magenta';
            subtitle.innerText = `Successfully countered the shadow forces with ${p2Score} - ${p1Score}.`;
            playSound('victory');
        } else {
            title.innerText = 'SYSTEM TIE';
            title.className = 'game-over-banner text-draw';
            subtitle.innerText = `Both minds resolved in a balanced tie: ${p1Score} - ${p2Score}.`;
            playSound('tie');
        }
    }

    // Populate grid breakdown
    const gridContainer = document.getElementById('summary-rows-container');
    gridContainer.innerHTML = '';

    for (let i = 0; i < 5; i++) {
        const row = document.createElement('div');
        row.className = 'summary-row';

        const p1Choice = STATE.p1Shadow[i];
        const p2Choice = STATE.p2Counter[i];
        const winner = checkRoundWinner(p1Choice, p2Choice);

        let outcomeText = 'TIE';
        let outcomeClass = 'text-draw';
        if (winner === 'p1') {
            outcomeText = STATE.isOnlineMode && STATE.playerRole === 'client' ? 'LOSS' : 'WIN';
            if (STATE.playerRole === 'local') outcomeText = 'P1 WIN';
            outcomeClass = 'text-p1-win';
        } else if (winner === 'p2') {
            outcomeText = STATE.isOnlineMode && STATE.playerRole === 'host' ? 'LOSS' : 'WIN';
            if (STATE.playerRole === 'local') outcomeText = 'P2 WIN';
            outcomeClass = 'text-p2-win';
        }

        row.innerHTML = `
            <div class="summary-round">#${i + 1}</div>
            <div class="summary-choice p1-col">
                ${CHOICE_ICONS[p1Choice]}
                <span>${p1Choice.toUpperCase()}</span>
            </div>
            <div class="summary-result ${outcomeClass}">${outcomeText}</div>
            <div class="summary-choice p2-col">
                ${CHOICE_ICONS[p2Choice]}
                <span>${p2Choice.toUpperCase()}</span>
            </div>
        `;
        gridContainer.appendChild(row);
    }
}

// ==========================================================================
// EVENT LISTENERS & ACTION REGISTER
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    
    // Choose Local Mode
    document.getElementById('btn-mode-local').addEventListener('click', () => {
        initAudio();
        playSound('select');
        STATE.isOnlineMode = false;
        initGame();
        setScreen(SCREENS.P1_SETUP);
    });

    // Choose Online Mode
    document.getElementById('btn-mode-online').addEventListener('click', () => {
        initAudio();
        playSound('select');
        STATE.isOnlineMode = true;
        document.getElementById('mode-selector-panel').style.display = 'none';
        document.getElementById('online-connection-panel').style.display = 'block';
        updateConnectionStatus('disconnected', 'AWAITING ACTION...');
    });

    // Back to Mode Selection
    document.getElementById('btn-back-welcome').addEventListener('click', () => {
        playSound('click');
        document.getElementById('online-connection-panel').style.display = 'none';
        document.getElementById('mode-selector-panel').style.display = 'grid';
        if (STATE.peer) {
            STATE.peer.destroy();
            STATE.peer = null;
            STATE.conn = null;
        }
    });

    // Host online game session
    document.getElementById('btn-host-game').addEventListener('click', () => {
        initAudio();
        playSound('select');
        initializeHostSession();
    });

    // Copy Session ID
    document.getElementById('btn-copy-id').addEventListener('click', () => {
        const idText = document.getElementById('lbl-my-id').innerText;
        if (idText && idText !== '------') {
            navigator.clipboard.writeText(idText).then(() => {
                playSound('click');
                const btn = document.getElementById('btn-copy-id');
                btn.innerText = '✓';
                setTimeout(() => btn.innerText = '📋', 1500);
            }).catch(err => {
                console.warn("Failed to copy clipboard, selection fallback", err);
            });
        }
    });

    // Join online game session
    document.getElementById('btn-join-game').addEventListener('click', () => {
        initAudio();
        playSound('select');
        const codeInput = document.getElementById('input-session-id').value;
        establishConnection(codeInput);
    });

    // Player 1 setup confirmation
    document.getElementById('btn-p1-confirm').addEventListener('click', async () => {
        playSound('select');
        if (STATE.isOnlineMode) {
            // Generate secret salt & SHA-256 commit hash
            STATE.p1Salt = generateSalt(8);
            const combinedString = `${STATE.p1Shadow.join(',')}:${STATE.p1Salt}`;
            const commitHash = await sha256(combinedString);
            STATE.p1ShadowHash = commitHash;

            // Send public lists + hash to Client
            STATE.conn.send({
                type: 'SUBMIT_P1',
                p1Gambit: STATE.p1Gambit,
                p1ShadowHash: commitHash
            });

            // Show lockout screen while waiting for Player 2
            showScreenLock(true, 'DEPLOYS LOCKED', 'Gambits submitted. Waiting for Player 2 Counter selection...');
        } else {
            // Hot-seat pass screen
            setScreen(SCREENS.PASS);
        }
    });

    // Device Pass Confirm Ready (Local Mode only)
    document.getElementById('btn-pass-ready').addEventListener('click', () => {
        playSound('select');
        setupP2Screens();
        setScreen(SCREENS.P2_SETUP);
    });

    // Player 2 setup confirmation
    document.getElementById('btn-p2-confirm').addEventListener('click', () => {
        playSound('select');
        if (STATE.isOnlineMode) {
            // Send client counter selections to P1
            STATE.conn.send({
                type: 'SUBMIT_P2',
                p2Counter: STATE.p2Counter
            });
            showScreenLock(true, 'ENGAGING TRANSLATION', 'Sharing countermeasures. Awaiting Host reveal data...');
        } else {
            setupShowdown();
            setScreen(SCREENS.SHOWDOWN);
        }
    });

    // Showdown triggers
    document.getElementById('btn-start-showdown').addEventListener('click', () => {
        executeShowdown();
    });

    // Navigate showdown to results
    document.getElementById('btn-showdown-results').addEventListener('click', () => {
        playSound('select');
        populateGameOverScreen();
        setScreen(SCREENS.GAME_OVER);
    });

    // Play again / Reset requests
    document.getElementById('btn-replay').addEventListener('click', () => {
        requestReplay();
    });

    // Choice Pad binds (Player 1)
    document.querySelectorAll('#screen-p1-setup .choice-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const choice = btn.dataset.choice;
            handleChoiceSelection(choice);
        });
        btn.addEventListener('mouseenter', () => playSound('hover'));
    });

    // Choice Pad binds (Player 2)
    document.querySelectorAll('#screen-p2-setup .choice-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const choice = btn.dataset.choice;
            handleChoiceSelection(choice);
        });
        btn.addEventListener('mouseenter', () => playSound('hover'));
    });

    // Hold-to-reveal event handlers for Shadow List
    const revealBtn = document.getElementById('btn-reveal-shadow');
    
    revealBtn.addEventListener('mousedown', () => {
        playSound('click');
        revealShadowList(true);
    });
    revealBtn.addEventListener('mouseup', () => {
        revealShadowList(false);
    });
    revealBtn.addEventListener('mouseleave', () => {
        revealShadowList(false);
    });

    revealBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        playSound('click');
        revealShadowList(true);
    });
    revealBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        revealShadowList(false);
    });

    // Audio toggle
    const audioToggle = document.getElementById('audio-toggle');
    audioToggle.addEventListener('click', () => {
        STATE.isAudioMuted = !STATE.isAudioMuted;
        if (STATE.isAudioMuted) {
            audioToggle.innerText = '🔇 SOUNDS MUTED';
            audioToggle.classList.add('muted');
        } else {
            audioToggle.innerText = '🔊 SOUNDS ACTIVE';
            audioToggle.classList.remove('muted');
            initAudio();
            playSound('click');
        }
    });
});
