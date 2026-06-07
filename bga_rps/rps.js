/**
 * ------
 * BGA rps.js for rps
 * ------
 */

define([
    "dojo",
    "dojo/_base/declare",
    "ebg/core/gamegui",
    "ebg/webaudio"
],
function (dojo, declare) {
    return declare("bgagame.rps", ebg.core.gamegui, {
        constructor: function(){
            console.log('rps constructor');
            
            // Client state buffers
            this.p1_id = null;
            this.p2_id = null;
            this.activeSetupPlayer = null;
            this.activeSelectionType = 'gambit'; 
            this.activeSlotIndex = 0;
            this.p1Gambit = Array(5).fill(null);
            this.p1Shadow = Array(5).fill(null);
            this.p2Counter = Array(5).fill(null);
            
            // Web Audio Synth Context
            this.audioCtx = null;
            this.isAudioMuted = false;

            this.CHOICE_ICONS = {
                rock: '<svg viewBox="0 0 24 24" class="icon-choice"><use href="#icon-rock"></use></svg>',
                paper: '<svg viewBox="0 0 24 24" class="icon-choice"><use href="#icon-paper"></use></svg>',
                scissors: '<svg viewBox="0 0 24 24" class="icon-choice"><use href="#icon-scissors"></use></svg>',
                lock: '<svg viewBox="0 0 24 24" class="icon-choice"><use href="#icon-lock"></use></svg>'
            };
        },
        
        setup: function( gamedatas )
        {
            console.log( "Starting game setup", gamedatas );
            
            this.p1_id = gamedatas.p1_id;
            this.p2_id = gamedatas.p2_id;
            
            // Load slots state
            this.p1Gambit = gamedatas.p1Gambit;
            this.p1Shadow = gamedatas.p1Shadow;
            this.p2Counter = gamedatas.p2Counter;
            
            // Bind input selectors
            dojo.query("#screen-p1-setup .sg-choice-btn").connect("onclick", this, "onChoiceSelect");
            dojo.query("#screen-p2-setup .sg-choice-btn").connect("onclick", this, "onChoiceSelect");

            dojo.connect( $('btn-p1-confirm'), 'onclick', this, 'onConfirmP1' );
            dojo.connect( $('btn-p2-confirm'), 'onclick', this, 'onConfirmP2' );
            dojo.connect( $('btn-p1-random'), 'onclick', this, 'onRandomP1' );
            dojo.connect( $('btn-p2-random'), 'onclick', this, 'onRandomP2' );
            
            // Bind hover audio triggers
            dojo.query(".btn, .choice-btn, .card-slot").connect("onmouseenter", this, "onBtnHover");

            // Shadow reveal button bindings
            var revealBtn = $('btn-reveal-shadow');
            dojo.connect(revealBtn, 'onmousedown', this, function() { this.revealShadowList(true); });
            dojo.connect(revealBtn, 'onmouseup', this, function() { this.revealShadowList(false); });
            dojo.connect(revealBtn, 'onmouseleave', this, function() { this.revealShadowList(false); });
            
            dojo.connect(revealBtn, 'ontouchstart', this, function(e) { e.preventDefault(); this.revealShadowList(true); });
            dojo.connect(revealBtn, 'ontouchend', this, function(e) { e.preventDefault(); this.revealShadowList(false); });

            // Setup notification subscriptions
            this.setupNotifications();
        },

        // ==========================================================================
        // BGA STATE TRANSITION EVENT HANDLERS
        // ==========================================================================
        onEnteringState: function( stateName, state )
        {
            console.log( 'Entering state: '+stateName, state );
            
            // Clear screens and overlays
            dojo.query(".sg-screen").removeClass("active");
            this.showScreenLock(false);
            
            switch( stateName )
            {
                case 'p1Setup':
                    dojo.addClass('screen-p1-setup', 'active');
                    this.activeSetupPlayer = 1;
                    this.activeSelectionType = 'gambit';
                    this.activeSlotIndex = 0;
                    this.renderP1Slots();
                    this.updateSelectionLabel(1);
                    this.updateConfirmButtonState(1);
                    
                    if (this.player_id == this.p2_id) {
                        this.showScreenLock(true, 'DEPLOYS IN PROGRESS', 'Waiting for Player 1 to deploy their Gambit lists...');
                    }
                    break;
                    
                case 'p2Setup':
                    dojo.addClass('screen-p2-setup', 'active');
                    this.activeSetupPlayer = 2;
                    this.activeSlotIndex = 0;
                    
                    if (state.args && state.args.p1Gambit) {
                        this.p1Gambit = state.args.p1Gambit;
                    }
                    this.renderP1PublicIntel();
                    this.renderP2Slots();
                    this.updateSelectionLabel(2);
                    this.updateConfirmButtonState(2);
                    
                    if (this.player_id == this.p1_id) {
                        this.showScreenLock(true, 'DEPLOYS LOCKED', 'Gambits submitted. Waiting for Player 2 Counter selection...');
                    }
                    break;
                    
                case 'showdown':
                    dojo.addClass('screen-showdown', 'active');
                    break;
            }
        },
        
        onLeavingState: function( stateName )
        {
            console.log( 'Leaving state: '+stateName );
        },

        // ==========================================================================
        // UI RENDERING UTILITIES
        // ==========================================================================
        renderP1Slots: function() {
            var gambitContainer = $('p1-gambit-slots');
            var shadowContainer = $('p1-shadow-slots');
            
            gambitContainer.innerHTML = '';
            shadowContainer.innerHTML = '';
            
            var self = this;
            
            // Render Gambit Slots
            for (var i = 0; i < 5; i++) {
                var slot = document.createElement('div');
                slot.className = 'card-slot';
                if (this.activeSelectionType === 'gambit' && this.activeSlotIndex === i) {
                    slot.classList.add('active');
                }
                if (this.p1Gambit[i]) {
                    slot.classList.add('filled');
                    slot.innerHTML = this.CHOICE_ICONS[this.p1Gambit[i]];
                }
                
                // Closure binding for slots selection
                (function(idx){
                    dojo.connect(slot, 'onclick', self, function() {
                        self.playAudioSound('click');
                        self.activeSelectionType = 'gambit';
                        self.activeSlotIndex = idx;
                        self.renderP1Slots();
                        self.updateSelectionLabel(1);
                    });
                })(i);
                
                gambitContainer.appendChild(slot);
            }
            
            // Render Shadow Slots
            for (var i = 0; i < 5; i++) {
                var slot = document.createElement('div');
                slot.className = 'card-slot';
                if (this.activeSelectionType === 'shadow' && this.activeSlotIndex === i) {
                    slot.classList.add('active');
                }
                if (this.p1Shadow[i]) {
                    slot.classList.add('filled');
                    slot.classList.add('shadow-hidden');
                    slot.innerHTML = this.CHOICE_ICONS['lock'];
                }
                
                (function(idx){
                    dojo.connect(slot, 'onclick', self, function() {
                        self.playAudioSound('click');
                        self.activeSelectionType = 'shadow';
                        self.activeSlotIndex = idx;
                        self.renderP1Slots();
                        self.updateSelectionLabel(1);
                    });
                })(i);
                
                shadowContainer.appendChild(slot);
            }
        },

        renderP2Slots: function() {
            var counterContainer = $('p2-counter-slots');
            counterContainer.innerHTML = '';
            
            var self = this;
            
            for (var i = 0; i < 5; i++) {
                var slot = document.createElement('div');
                slot.className = 'card-slot';
                if (this.activeSlotIndex === i) {
                    slot.classList.add('active');
                }
                if (this.p2Counter[i]) {
                    slot.classList.add('filled');
                    slot.innerHTML = this.CHOICE_ICONS[this.p2Counter[i]];
                }
                
                (function(idx){
                    dojo.connect(slot, 'onclick', self, function() {
                        self.playAudioSound('click');
                        self.activeSlotIndex = idx;
                        self.renderP2Slots();
                        self.updateSelectionLabel(2);
                    });
                })(i);
                
                counterContainer.appendChild(slot);
            }
        },

        renderP1PublicIntel: function() {
            var intelPublic = $('p2-intel-public');
            intelPublic.innerHTML = '';
            for (var i = 0; i < 5; i++) {
                var slot = document.createElement('div');
                slot.className = 'card-slot read-only filled';
                slot.innerHTML = this.CHOICE_ICONS[this.p1Gambit[i]];
                intelPublic.appendChild(slot);
            }
        },

        revealShadowList: function(show) {
            var slots = $('p1-shadow-slots').children;
            for (var i = 0; i < 5; i++) {
                var val = this.p1Shadow[i];
                if (val && slots[i]) {
                    if (show) {
                        slots[i].classList.remove('shadow-hidden');
                        slots[i].innerHTML = this.CHOICE_ICONS[val];
                    } else {
                        slots[i].classList.add('shadow-hidden');
                        slots[i].innerHTML = this.CHOICE_ICONS['lock'];
                    }
                }
            }
        },

        updateSelectionLabel: function(playerNum) {
            if (playerNum === 1) {
                var label = $('current-slot-label');
                var listName = (this.activeSelectionType === 'gambit') ? 'Public' : 'Shadow';
                label.innerText = listName + ' Slot ' + (this.activeSlotIndex + 1);
                label.className = 'highlight-text ' + ((this.activeSelectionType === 'gambit') ? 'text-cyan' : 'text-purple');
            } else {
                var label = $('p2-slot-label');
                label.innerText = 'Counter Slot ' + (this.activeSlotIndex + 1);
                label.className = 'highlight-text text-magenta';
            }
        },

        updateConfirmButtonState: function(playerNum) {
            if (playerNum === 1) {
                var isComplete = !this.p1Gambit.includes(null) && !this.p1Shadow.includes(null);
                $('btn-p1-confirm').disabled = !isComplete;
            } else {
                var isComplete = !this.p2Counter.includes(null);
                $('btn-p2-confirm').disabled = !isComplete;
            }
        },

        showScreenLock: function(show, title, msg) {
            var lockOverlay = $('sg-lock-overlay');
            if (show) {
                $('sg-lock-title').innerText = title.toUpperCase();
                $('sg-lock-msg').innerText = msg;
                dojo.addClass(lockOverlay, 'active');
            } else {
                dojo.removeClass(lockOverlay, 'active');
            }
        },

        // ==========================================================================
        // CLIENT INTERACTION HANDLERS
        // ==========================================================================
        onBtnHover: function() {
            this.playAudioSound('hover');
        },

        onChoiceSelect: function(evt) {
            evt.preventDefault();
            var choice = evt.currentTarget.dataset.choice;
            
            if (this.activeSetupPlayer == 1 && this.player_id == this.p1_id) {
                var type = this.activeSelectionType;
                var index = this.activeSlotIndex;
                
                if (type == 'gambit') {
                    this.p1Gambit[index] = choice;
                } else {
                    this.p1Shadow[index] = choice;
                }
                
                this.selectChoiceOnServer(type, index, choice);
                this.playAudioSound('select');
                
                // Auto-advance logic
                var currentList = (type == 'gambit') ? this.p1Gambit : this.p1Shadow;
                var alternateList = (type == 'gambit') ? this.p1Shadow : this.p1Gambit;
                
                if (currentList.includes(null)) {
                    for (var j = 0; j < 5; j++) {
                        var idx = (index + 1 + j) % 5;
                        if (currentList[idx] === null) {
                            this.activeSlotIndex = idx;
                            break;
                        }
                    }
                } else if (alternateList.includes(null)) {
                    this.activeSelectionType = (type == 'gambit') ? 'shadow' : 'gambit';
                    this.activeSlotIndex = alternateList.indexOf(null);
                } else {
                    this.activeSlotIndex = (index + 1) % 5;
                }
                
                this.renderP1Slots();
                this.updateSelectionLabel(1);
                this.updateConfirmButtonState(1);
                
            } else if (this.activeSetupPlayer == 2 && this.player_id == this.p2_id) {
                var index = this.activeSlotIndex;
                this.p2Counter[index] = choice;
                
                this.selectChoiceOnServer('counter', index, choice);
                this.playAudioSound('select');
                
                if (this.p2Counter.includes(null)) {
                    for (var j = 0; j < 5; j++) {
                        var idx = (index + 1 + j) % 5;
                        if (this.p2Counter[idx] === null) {
                            this.activeSlotIndex = idx;
                            break;
                        }
                    }
                } else {
                    this.activeSlotIndex = (index + 1) % 5;
                }
                
                this.renderP2Slots();
                this.updateSelectionLabel(2);
                this.updateConfirmButtonState(2);
            }
        },

        onConfirmP1: function(evt) {
            evt.preventDefault();
            this.playAudioSound('select');
            this.confirmDeploymentOnServer();
        },

        onConfirmP2: function(evt) {
            evt.preventDefault();
            this.playAudioSound('select');
            this.confirmDeploymentOnServer();
        },

        onRandomP1: function(evt) {
            evt.preventDefault();
            var choices = ['rock', 'paper', 'scissors'];
            for (var i = 0; i < 5; i++) {
                var cG = choices[Math.floor(Math.random() * 3)];
                var cS = choices[Math.floor(Math.random() * 3)];
                this.p1Gambit[i] = cG;
                this.p1Shadow[i] = cS;
                this.selectChoiceOnServer('gambit', i, cG);
                this.selectChoiceOnServer('shadow', i, cS);
            }
            this.activeSelectionType = 'gambit';
            this.activeSlotIndex = 0;
            this.renderP1Slots();
            this.updateSelectionLabel(1);
            this.updateConfirmButtonState(1);
            this.playAudioSound('select');
        },

        onRandomP2: function(evt) {
            evt.preventDefault();
            var choices = ['rock', 'paper', 'scissors'];
            for (var i = 0; i < 5; i++) {
                var cC = choices[Math.floor(Math.random() * 3)];
                this.p2Counter[i] = cC;
                this.selectChoiceOnServer('counter', i, cC);
            }
            this.activeSlotIndex = 0;
            this.renderP2Slots();
            this.updateSelectionLabel(2);
            this.updateConfirmButtonState(2);
            this.playAudioSound('select');
        },

        // ==========================================================================
        // AJAX REQUEST DISPATCHERS
        // ==========================================================================
        selectChoiceOnServer: function(type, index, choice) {
            this.ajaxcall("/rps/rps/playCard.html", {
                type: type,
                index: index,
                choice: choice
            }, this, function(result){});
        },
        
        confirmDeploymentOnServer: function() {
            this.ajaxcall("/rps/rps/confirmDeployment.html", {}, this, function(result){});
        },

        // ==========================================================================
        // SHOWDOWN ANIMATIONS
        // ==========================================================================
        setupShowdownArena: function() {
            $('score-p1').innerText = '0';
            $('score-p2').innerText = '0';

            var tracksContainer = $('showdown-tracks');
            tracksContainer.innerHTML = '';

            for (var i = 0; i < 5; i++) {
                var track = document.createElement('div');
                track.className = 'duel-track';
                track.id = 'duel-track-' + i;

                track.innerHTML = '\
                    <div class="track-round-badge">ROUND '+(i+1)+'</div>\
                    <div class="card-flip-container p1-card">\
                        <div class="card-flip-inner" id="p1-card-inner-'+i+'">\
                            <div class="card-face card-face-back">'+this.CHOICE_ICONS['lock']+'</div>\
                            <div class="card-face card-face-front">'+this.CHOICE_ICONS[this.p1Shadow[i]]+'</div>\
                        </div>\
                    </div>\
                    <div class="duel-clash-zone">\
                        <span class="vs-text">VS</span>\
                    </div>\
                    <div class="card-flip-container p2-card">\
                        <div class="card-flip-inner" id="p2-card-inner-'+i+'">\
                            <div class="card-face card-face-back">'+this.CHOICE_ICONS['lock']+'</div>\
                            <div class="card-face card-face-front">'+this.CHOICE_ICONS[this.p2Counter[i]]+'</div>\
                        </div>\
                    </div>\
                    <div class="outcome-text" id="outcome-text-'+i+'">DRAW</div>\
                ';
                tracksContainer.appendChild(track);
            }
        },

        executeShowdownAnimation: function(rounds, scores) {
            var round = 0;
            var intervalTime = 1300;
            var self = this;
            
            var p1ScoreAccumulator = 0;
            var p2ScoreAccumulator = 0;

            function flipNextRound() {
                if (round >= 5) {
                    clearInterval(self.showdownIntervalId);
                    self.showdownIntervalId = null;
                    return;
                }

                var p1Choice = self.p1Shadow[round];
                var p2Choice = self.p2Counter[round];
                var winner = rounds[round];

                var p1CardInner = $('p1-card-inner-' + round);
                var p2CardInner = $('p2-card-inner-' + round);
                var outcomeLabel = $('outcome-text-' + round);
                var trackRow = $('duel-track-' + round);

                self.playAudioSound('reveal');
                p1CardInner.classList.add('flipped');
                p2CardInner.classList.add('flipped');

                setTimeout(function() {
                    self.playAudioSound('clash');

                    if (winner === 'p1') {
                        p1ScoreAccumulator++;
                        $('score-p1').innerText = p1ScoreAccumulator;
                        outcomeLabel.innerText = (self.player_id == self.p1_id) ? 'YOU WIN' : 'P1 WIN';
                        outcomeLabel.className = 'outcome-text show text-p1-win';
                        trackRow.classList.add('p1-wins');
                    } else if (winner === 'p2') {
                        p2ScoreAccumulator++;
                        $('score-p2').innerText = p2ScoreAccumulator;
                        outcomeLabel.innerText = (self.player_id == self.p2_id) ? 'YOU WIN' : 'P2 WIN';
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
            this.showdownIntervalId = setInterval(flipNextRound, intervalTime);
        },

        // ==========================================================================
        // WEB AUDIO SYNTHESIZER
        // ==========================================================================
        initAudio: function() {
            if (!this.audioCtx) {
                this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }
        },

        playAudioSound: function(type) {
            if (this.isAudioMuted) return;
            try {
                this.initAudio();
            } catch (e) {
                console.warn("Audio Context could not start:", e);
                return;
            }

            var now = this.audioCtx.currentTime;
            var masterGain = this.audioCtx.createGain();
            masterGain.connect(this.audioCtx.destination);
            
            switch (type) {
                case 'click': {
                    var osc = this.audioCtx.createOscillator();
                    var gain = this.audioCtx.createGain();
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
                    var osc = this.audioCtx.createOscillator();
                    var gain = this.audioCtx.createGain();
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
                    var osc = this.audioCtx.createOscillator();
                    var gain = this.audioCtx.createGain();
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
                case 'reveal': {
                    var osc1 = this.audioCtx.createOscillator();
                    var osc2 = this.audioCtx.createOscillator();
                    var gain = this.audioCtx.createGain();
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
                    var noiseBuffer = this.audioCtx.createBuffer(1, this.audioCtx.sampleRate * 0.25, this.audioCtx.sampleRate);
                    var output = noiseBuffer.getChannelData(0);
                    for (var i = 0; i < noiseBuffer.length; i++) {
                        output[i] = Math.random() * 2 - 1;
                    }
                    var noiseNode = this.audioCtx.createBufferSource();
                    noiseNode.buffer = noiseBuffer;
                    
                    var noiseFilter = this.audioCtx.createBiquadFilter();
                    noiseFilter.type = 'bandpass';
                    noiseFilter.frequency.setValueAtTime(600, now);
                    noiseFilter.frequency.exponentialRampToValueAtTime(100, now + 0.2);
                    
                    var noiseGain = this.audioCtx.createGain();
                    noiseGain.gain.setValueAtTime(0.12, now);
                    noiseGain.gain.linearRampToValueAtTime(0.0, now + 0.22);
                    
                    var subOsc = this.audioCtx.createOscillator();
                    var subGain = this.audioCtx.createGain();
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
            }
        },

        // ==========================================================================
        // BGA NOTIFICATION STREAM MANAGER
        // ==========================================================================
        setupNotifications: function()
        {
            console.log( 'Setting up game notifications' );
            dojo.subscribe( 'p1Deployed', this, "notif_p1Deployed" );
            dojo.subscribe( 'showdownResolved', this, "notif_showdownResolved" );
        },

        notif_p1Deployed: function(notif) {
            console.log("p1Deployed", notif);
            this.p1Gambit = notif.args.p1Gambit;
            this.showScreenLock(false);
        },

        notif_showdownResolved: function(notif) {
            console.log("showdownResolved", notif);
            
            this.p1Shadow = notif.args.p1Shadow;
            this.p2Counter = notif.args.p2Counter;
            
            // Set up Showdown Arena UI slots
            this.showScreenLock(false);
            this.setupShowdownArena();
            
            // Execute sequential flip animations
            this.executeShowdownAnimation(notif.args.rounds, notif.args.scores);
        }

    });
});
