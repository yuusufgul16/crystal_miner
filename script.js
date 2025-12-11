// Crystal Miner - Game Logic
(function () {
    'use strict';

    // DOM Elements
    const screens = {
        start: document.getElementById('start-screen'),
        levels: document.getElementById('level-screen'),
        game: document.getElementById('game-screen')
    };

    const ui = {
        playerLevel: document.getElementById('player-level'),
        xpBar: document.getElementById('xp-bar'),
        xpText: document.getElementById('xp-text'),
        levelGrid: document.getElementById('level-grid'),
        grid: document.getElementById('grid'),
        score: document.getElementById('score'),
        timer: document.getElementById('timer'),
        mission: document.querySelector('.mission .text'),
        progress: document.getElementById('progress'),
        progressText: document.getElementById('progress-text'),
        combo: document.getElementById('combo'),
        comboValue: document.getElementById('combo-value'),
        resultModal: document.getElementById('result-modal'),
        achievementsModal: document.getElementById('achievements-modal'),
        achievementsList: document.getElementById('achievements-list'),
        newAchievements: document.getElementById('new-achievements'),
        starsDisplay: document.getElementById('stars-display'),
        finalScore: document.getElementById('final-score'),
        earnedXp: document.getElementById('earned-xp')
    };

    // Game Configuration
    const LEVELS = [
        { id: 1, max: 50, time: 180, xp: 100 },
        { id: 2, max: 100, time: 300, xp: 200 }
    ];

    const ACHIEVEMENTS = {
        first_dig: { icon: '⛏️', title: 'İlk Kazı', desc: 'İlk kristalini bul', unlocked: false },
        perfect: { icon: '💎', title: 'Mükemmel Madenci', desc: 'Bir kazıda 3 yıldız kazan', unlocked: false },
        fast_hands: { icon: '⚡', title: 'Hızlı Eller', desc: '10 taş üst üste topla', unlocked: false },
        flawless: { icon: '🔮', title: 'Kusursuz Kazı', desc: 'Hata yapmadan kaz', unlocked: false },
        rich: { icon: '💰', title: 'Zengin Madenci', desc: '100 puana ulaş', unlocked: false },
        mountain: { icon: '🏔️', title: 'Dağ Fatihi', desc: 'Tüm katmanları keşfet', unlocked: false },
        lightning: { icon: '🚀', title: 'Yıldırım Madenci', desc: 'Bir kazıyı 30 saniyede bitir', unlocked: false }
    };

    // Game State
    let gameState = {
        currentLevel: 1,
        maxNumber: 20,
        grid: [],
        activePrime: null,
        score: 0,
        combo: 0,
        mistakes: 0,
        timeLeft: 90,
        timerInterval: null,
        startTime: 0,
        primes: []
    };

    // Player Data (persistent)
    let playerData = {
        level: parseInt(localStorage.getItem('cm_player_level') || '1'),
        xp: parseInt(localStorage.getItem('cm_xp') || '0'),
        stars: JSON.parse(localStorage.getItem('cm_stars') || '{}'),
        achievements: JSON.parse(localStorage.getItem('cm_achievements') || '{}'),
        // Force default structure if missing or empty
        powerups: (() => {
            const saved = JSON.parse(localStorage.getItem('cm_powerups') || 'null');
            // Check if saved is valid object and not empty
            if (!saved || typeof saved !== 'object' || Object.keys(saved).length === 0) {
                return { lightning: 1, magnifier: 1, time: 1, dynamite: 1 };
            }
            return saved;
        })(),
        tutorialsSeen: JSON.parse(localStorage.getItem('cm_tutorials_seen') || '{}')
    };

    // Ensure tutorialsSeen is an object (security check)
    if (!playerData.tutorialsSeen || typeof playerData.tutorialsSeen !== 'object') {
        playerData.tutorialsSeen = {};
    }

    // Load achievements
    Object.keys(ACHIEVEMENTS).forEach(key => {
        ACHIEVEMENTS[key].unlocked = playerData.achievements[key] || false;
    });

    // Ensure initial powerups if keys are missing (partial object fix)
    ['lightning', 'magnifier', 'time', 'dynamite'].forEach(type => {
        if (playerData.powerups[type] === undefined) {
            playerData.powerups[type] = 1;
        }
    });
    localStorage.setItem('cm_powerups', JSON.stringify(playerData.powerups));

    // Audio Context
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    let muted = localStorage.getItem('cm_muted') === 'true';

    // Sound Functions (Procedural)
    function playTone(freq, type, duration) {
        if (muted) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.value = freq;
        osc.type = type;
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    }

    const sounds = {
        crystal: () => playTone(800, 'sine', 0.1),
        combo: () => playTone(1200, 'triangle', 0.15),
        achievement: () => {
            playTone(523, 'sine', 0.1);
            setTimeout(() => playTone(659, 'sine', 0.1), 100);
            setTimeout(() => playTone(784, 'sine', 0.2), 200);
        },
        complete: () => {
            [523, 659, 784, 1046].forEach((f, i) => {
                setTimeout(() => playTone(f, 'triangle', 0.15), i * 100);
            });
        },
        error: () => playTone(150, 'sawtooth', 0.3),
        powerup: () => {
            playTone(600, 'sine', 0.1);
            setTimeout(() => playTone(800, 'square', 0.1), 100);
        }
    };

    // Particle System
    const canvas = document.getElementById('particles');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    let particles = [];

    class Particle {
        constructor(x, y, type) {
            this.x = x;
            this.y = y;
            this.vx = (Math.random() - 0.5) * 4;
            this.vy = (Math.random() - 0.5) * 4 - 2;
            this.life = 1;
            this.type = type;

            if (type === 'crystal') {
                this.color = `hsl(${180 + Math.random() * 60}, 100%, 70%)`;
                this.size = 3 + Math.random() * 5;
            } else if (type === 'combo') {
                this.color = `hsl(${30 + Math.random() * 30}, 100%, ${50 + Math.random() * 30}%)`;
                this.size = 4 + Math.random() * 6;
            } else if (type === 'star') {
                this.color = '#ffd700';
                this.size = 2 + Math.random() * 4;
            }
        }

        update() {
            this.x += this.vx;
            this.y += this.vy;
            this.vy += 0.1;
            this.life -= 0.02;
        }

        draw() {
            ctx.globalAlpha = this.life;
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function createParticles(x, y, type, count = 20) {
        for (let i = 0; i < count; i++) {
            particles.push(new Particle(x, y, type));
        }
    }

    function animateParticles() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles = particles.filter(p => p.life > 0);
        particles.forEach(p => {
            p.update();
            p.draw();
        });
        requestAnimationFrame(animateParticles);
    }

    animateParticles();

    // --- Power-up System ---
    const powerUpBtns = {
        lightning: document.getElementById('powerup-lightning'),
        magnifier: document.getElementById('powerup-magnifier'),
        time: document.getElementById('powerup-time'),
        dynamite: document.getElementById('powerup-dynamite')
    };

    const powerUpCounts = {
        lightning: document.getElementById('count-lightning'),
        magnifier: document.getElementById('count-magnifier'),
        time: document.getElementById('count-time'),
        dynamite: document.getElementById('count-dynamite')
    };

    function updatePowerUpUI() {
        Object.keys(powerUpBtns).forEach(type => {
            const count = playerData.powerups[type] || 0;
            powerUpCounts[type].textContent = count;
            powerUpBtns[type].disabled = count <= 0 || (gameState.timeLeft <= 0); // Disable if count 0 or game over
        });
    }

    // Confirm Modal Logic
    const confirmModal = {
        element: document.getElementById('confirm-modal'),
        title: document.getElementById('confirm-title'),
        message: document.getElementById('confirm-message'),
        yesBtn: document.getElementById('confirm-yes'),
        noBtn: document.getElementById('confirm-no'),
        pendingAction: null,

        show: function (titleText, messageText, onConfirm) {
            this.title.textContent = titleText;
            this.message.innerHTML = messageText;
            this.element.classList.add('active');
            this.pendingAction = onConfirm;
        },

        hide: function () {
            this.element.classList.remove('active');
            this.pendingAction = null;
        }
    };

    // Bind Confirm Modal Buttons
    if (confirmModal.yesBtn && confirmModal.noBtn) {
        confirmModal.yesBtn.addEventListener('click', () => {
            if (confirmModal.pendingAction) confirmModal.pendingAction();
            confirmModal.hide();
        });
        confirmModal.noBtn.addEventListener('click', () => {
            confirmModal.hide();
        });
    }

    function usePowerUp(type) {
        if (!playerData.powerups[type] || playerData.powerups[type] <= 0) return;
        if (gameState.timeLeft <= 0) return;

        console.log(`Checking tutorial for ${type}:`, playerData.tutorialsSeen[type]);

        // Tutorial Check (First Time Use)
        if (playerData.tutorialsSeen[type] !== true) {
            let message = "";
            let title = "";
            if (type === 'lightning') { title = "⚡ Yıldırım"; message = "Seçtiğin kristalin <strong>TÜM katlarını</strong> otomatik toplar.<br><br>Kombo yapmadan hızlıca puan toplamak için idealdir."; }
            if (type === 'magnifier') { title = "🔍 Büyüteç"; message = "Bulman gereken sıradaki <strong>en küçük asalı</strong> yeşil çerçeve ile gösterir."; }
            if (type === 'time') { title = "⏰ Zaman"; message = "Süreye anında <strong>+30 saniye</strong> ekler."; }
            if (type === 'dynamite') { title = "💣 Dinamit"; message = "Hata yapmanı önlemek için <strong>5 rastgele taşı</strong> patlatır.<br><br>Asla kristallere zarar vermez."; }

            // Show Custom Modal
            confirmModal.show(title, message, () => {
                // User Confirmed
                playerData.tutorialsSeen[type] = true;
                localStorage.setItem('cm_tutorials_seen', JSON.stringify(playerData.tutorialsSeen));
                // Call again to execute
                usePowerUp(type);
            });
            return; // Stop execution until confirmed
        }

        // Effect execution
        let success = false;
        if (type === 'lightning') success = executeLightning();
        else if (type === 'magnifier') success = executeMagnifier();
        else if (type === 'time') success = executeTime();
        else if (type === 'dynamite') success = executeDynamite();

        if (success) {
            playerData.powerups[type]--;
            localStorage.setItem('cm_powerups', JSON.stringify(playerData.powerups));
            updatePowerUpUI();
            sounds.powerup();
        } else {
            // Feedback for failed usage (e.g. no targets)
            const btn = powerUpBtns[type];
            btn.classList.add('error'); // Reuse existing error class for shake
            setTimeout(() => btn.classList.remove('error'), 400);
            sounds.error();

            // Only show generic message if specific function didn't handle it
            if (type === 'lightning') showFloatingScore(window.innerWidth / 2, window.innerHeight / 2, "Seçim Yap!");
        }
    }

    function executeLightning() {
        if (!gameState.activePrime) return false; // Must select a prime first

        // Auto-collect all multiples
        let collected = 0;
        for (let i = gameState.activePrime * 2; i <= gameState.maxNumber; i += gameState.activePrime) {
            const data = gameState.grid[i - 1];
            if (data.state !== 'eliminated') {
                const tile = getTile(i);
                data.state = 'eliminated';
                tile.classList.add('eliminated');

                // Visuals
                const rect = tile.getBoundingClientRect();
                createParticles(rect.left + rect.width / 2, rect.top + rect.height / 2, 'crystal', 5);

                // Add points (no combo bonus for auto)
                gameState.score += 5;
                collected++;
            }
        }

        if (collected > 0) {
            showFloatingScore(window.innerWidth / 2, window.innerHeight / 2, collected * 5);
            updateUI();
            checkPhaseComplete();
            return true;
        }
        return false;
    }

    function executeMagnifier() {
        // Find smallest available prime
        const availablePrimes = gameState.grid.filter(d => d.isPrime && d.state === 'normal');
        if (availablePrimes.length === 0) return false;

        const target = availablePrimes[0];
        const tile = getTile(target.value);

        tile.style.border = '3px solid #10b981';
        tile.style.transform = 'scale(1.1)';
        tile.style.zIndex = '10';

        setTimeout(() => {
            tile.style.border = '';
            tile.style.transform = '';
            tile.style.zIndex = '';
        }, 3000);

        return true;
    }

    function executeTime() {
        gameState.timeLeft += 30;
        updateTimer();

        // Visual feedback
        ui.timer.style.color = '#4facfe';
        ui.timer.style.transform = 'scale(1.2)';
        setTimeout(() => {
            ui.timer.style.color = '';
            ui.timer.style.transform = '';
        }, 500);

        return true;
    }

    function executeDynamite() {
        // Explode 5 random non-prime tiles
        // FIX: Do not target multiples of active prime if phase is active
        const targets = gameState.grid.filter(d => {
            if (d.isPrime || d.state !== 'normal') return false;
            // Protective Logic: If active prime exists, protect its multiples
            if (gameState.activePrime && d.value % gameState.activePrime === 0) return false;
            return true;
        });
        console.log(`Dynamite Usage - Targets found: ${targets.length}`); // Debug log

        if (targets.length === 0) {
            // Check why?
            const primesLeft = gameState.grid.filter(d => d.isPrime && d.state === 'normal').length;
            console.log(`Dynamite Failed - Primes left: ${primesLeft}`);

            if (primesLeft > 0) {
                showFloatingScore(window.innerWidth / 2, window.innerHeight / 2, "Sadece Taşlar!"); // Only Rocks
                return false;
            } else {
                showFloatingScore(window.innerWidth / 2, window.innerHeight / 2, "Hedef Yok!"); // No Targets
                return false;
            }
        }

        // Shuffle and pick 5
        const toExplode = targets.sort(() => 0.5 - Math.random()).slice(0, 5);

        toExplode.forEach(d => {
            d.state = 'eliminated'; // Just remove them, no points
            const tile = getTile(d.value);
            if (tile) {
                tile.classList.add('eliminated');
                const rect = tile.getBoundingClientRect();
                createParticles(rect.left + rect.width / 2, rect.top + rect.height / 2, 'combo', 10); // Red particles
            }
        });

        return true;
    }

    function grantPowerUp(type, amount = 1) {
        playerData.powerups[type] = (playerData.powerups[type] || 0) + amount;
        localStorage.setItem('cm_powerups', JSON.stringify(playerData.powerups));

        // Notify user (toast) - simple alert for now
        const name = type === 'lightning' ? '⚡ Yıldırım' : (type === 'magnifier' ? '🔍 Büyüteç' : (type === 'time' ? '⏰ Zaman' : '💣 Dinamit'));
        // alert(`🎁 Kazandın: ${name} (+${amount})`); // Removed alert for better UX later
    }

    // Initialize
    function init() {
        // Emergency refill if all powerups are 0 (Fix for user issue)
        if (playerData.powerups && Object.values(playerData.powerups).every(v => v === 0)) {
            playerData.powerups = { lightning: 1, magnifier: 1, time: 1, dynamite: 1 };
            localStorage.setItem('cm_powerups', JSON.stringify(playerData.powerups));
        }

        updatePlayerUI();
        updatePowerUpUI(); // Init powerups
        renderLevels();
        renderAchievements();

        // Event Listeners
        document.getElementById('start-btn').addEventListener('click', () => showScreen('levels'));
        document.getElementById('back-btn').addEventListener('click', () => showScreen('start'));

        // Power-up Listeners
        Object.keys(powerUpBtns).forEach(type => {
            powerUpBtns[type].addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent game click
                usePowerUp(type);
            });
        });

        document.getElementById('achievements-btn').addEventListener('click', () => {
            ui.achievementsModal.classList.add('active');
        });

        // Settings Listeners
        // Settings Listeners
        const settingsModal = document.getElementById('settings-modal');
        const ingameControls = document.getElementById('ingame-controls');

        // Main Menu Settings Button (Start Screen)
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                if (ingameControls) ingameControls.style.display = 'none'; // Hide in-game controls
                settingsModal.classList.add('active');
            });
        }

        // In-Game Settings Button
        const ingameSettingsBtn = document.getElementById('ingame-settings-btn');
        if (ingameSettingsBtn) {
            ingameSettingsBtn.addEventListener('click', () => {
                // PAUSE GAME
                if (gameState.timerInterval) {
                    clearInterval(gameState.timerInterval);
                    gameState.timerInterval = null;
                }
                if (ingameControls) ingameControls.style.display = 'flex'; // Show in-game controls
                settingsModal.classList.add('active');
            });
        }

        document.getElementById('close-settings').addEventListener('click', () => {
            settingsModal.classList.remove('active');

            // RESUME GAME if we are in game screen and have time left
            if (!screens.game.classList.contains('hidden') && gameState.timeLeft > 0 && !gameState.timerInterval && (!ui.resultModal.classList.contains('active'))) {
                startTimer();
            }
        });

        // In-Game Menu Buttons
        const restartBtn = document.getElementById('restart-level-btn');
        if (restartBtn) {
            restartBtn.addEventListener('click', () => {
                settingsModal.classList.remove('active');
                startGame(gameState.currentLevel); // Restart current level
            });
        }

        const mainMenuBtn = document.getElementById('main-menu-btn');
        if (mainMenuBtn) {
            mainMenuBtn.addEventListener('click', () => {
                settingsModal.classList.remove('active');
                clearInterval(gameState.timerInterval); // Ensure stopped
                showScreen('start');
            });
        }

        // Sound toggle
        const soundBtn = document.getElementById('toggle-sound-btn');
        soundBtn.textContent = muted ? "Ses: KAPALI 🔇" : "Ses: AÇIK 🔊";
        soundBtn.addEventListener('click', () => {
            muted = !muted;
            localStorage.setItem('cm_muted', muted);
            soundBtn.textContent = muted ? "Ses: KAPALI 🔇" : "Ses: AÇIK 🔊";
            if (!muted) {
                if (audioCtx.state === 'suspended') audioCtx.resume();
                sounds.select();
            }
        });

        document.getElementById('close-achievements').addEventListener('click', () => {
            ui.achievementsModal.classList.remove('active');
        });
        document.getElementById('next-level-btn').addEventListener('click', () => {
            ui.resultModal.classList.remove('active');
            ui.newAchievements.innerHTML = '';
            const nextLevel = Math.min(gameState.currentLevel + 1, LEVELS.length);
            startGame(nextLevel);
        });
        document.getElementById('restart-btn').addEventListener('click', () => {
            ui.resultModal.classList.remove('active');
            ui.newAchievements.innerHTML = '';
            startGame(gameState.currentLevel);
        });
        document.getElementById('menu-btn').addEventListener('click', () => {
            ui.resultModal.classList.remove('active');
            ui.newAchievements.innerHTML = '';
            showScreen('start');
        });
    }

    function showScreen(name) {
        Object.values(screens).forEach(s => s.classList.remove('active'));
        screens[name].classList.add('active');
    }

    function updatePlayerUI() {
        ui.playerLevel.textContent = playerData.level;
        const xpNeeded = playerData.level * 100;
        const xpPercent = (playerData.xp / xpNeeded) * 100;
        ui.xpBar.style.width = xpPercent + '%';
        ui.xpText.textContent = `${playerData.xp} / ${xpNeeded} XP`;
    }

    function addXP(amount) {
        playerData.xp += amount;
        const xpNeeded = playerData.level * 100;

        if (playerData.xp >= xpNeeded) {
            playerData.xp -= xpNeeded;
            playerData.level++;
            sounds.achievement();
            createParticles(window.innerWidth / 2, 100, 'star', 50);
        }

        localStorage.setItem('cm_xp', playerData.xp);
        localStorage.setItem('cm_player_level', playerData.level);
        updatePlayerUI();
    }

    function renderLevels() {
        ui.levelGrid.innerHTML = '';
        LEVELS.forEach((level, index) => {
            const btn = document.createElement('div');
            btn.className = 'level-btn';
            const stars = playerData.stars[level.id] || 0;

            // Check if level is locked (previous level not completed)
            const isLocked = index > 0 && (playerData.stars[index] || 0) === 0;

            if (isLocked) {
                btn.classList.add('locked');
            }

            btn.innerHTML = `
                <div class="level-number">${level.id}</div>
                <div class="level-range">1-${level.max}</div>
                <div class="stars">${isLocked ? '🔒' : '⭐'.repeat(stars) + '☆'.repeat(3 - stars)}</div>
            `;

            if (!isLocked) {
                btn.addEventListener('click', () => startGame(level.id));
            }

            ui.levelGrid.appendChild(btn);
        });
    }

    function renderAchievements() {
        ui.achievementsList.innerHTML = '';
        Object.entries(ACHIEVEMENTS).forEach(([key, ach]) => {
            const div = document.createElement('div');
            div.className = 'achievement' + (ach.unlocked ? ' unlocked' : '');
            div.innerHTML = `
                <div class="icon">${ach.icon}</div>
                <div><strong>${ach.title}</strong></div>
                <div>${ach.desc}</div>
            `;
            ui.achievementsList.appendChild(div);
        });
    }

    function startGame(levelId) {
        const level = LEVELS[levelId - 1];
        gameState = {
            currentLevel: levelId,
            maxNumber: level.max,
            grid: [],
            activePrime: null,
            score: 0,
            combo: 0,
            mistakes: 0,
            timeLeft: level.time,
            timerInterval: null,
            startTime: Date.now(),
            primes: []
        };

        showScreen('game');
        initGrid();
        startTimer();
        updateUI();
        updatePowerUpUI(); // Refresh state
        ui.mission.textContent = 'Bir değerli kristal seç';
        ui.combo.classList.remove('active');
    }

    function initGrid() {
        const primes = sieveOfEratosthenes(gameState.maxNumber);
        gameState.primes = primes.filter(p => p > 1);

        ui.grid.innerHTML = '';
        for (let i = 1; i <= gameState.maxNumber; i++) {
            const tile = document.createElement('div');
            tile.className = 'tile';
            tile.textContent = i;
            tile.dataset.value = i;
            tile.addEventListener('click', () => handleTileClick(i));
            ui.grid.appendChild(tile);
            gameState.grid.push({ value: i, state: 'normal', isPrime: primes.includes(i) });
        }
    }

    function sieveOfEratosthenes(max) {
        const isPrime = Array(max + 1).fill(true);
        isPrime[0] = isPrime[1] = false;
        for (let i = 2; i * i <= max; i++) {
            if (isPrime[i]) {
                for (let j = i * i; j <= max; j += i) {
                    isPrime[j] = false;
                }
            }
        }
        return isPrime.map((p, i) => p ? i : null).filter(n => n !== null);
    }

    function handleTileClick(num) {
        const tile = getTile(num);
        const data = gameState.grid[num - 1];

        if (data.state === 'eliminated' || data.state === 'completed') return;

        if (!gameState.activePrime) {
            if (data.isPrime) {
                gameState.activePrime = num;
                data.state = 'prime';
                tile.classList.add('prime');
                sounds.crystal();
                ui.mission.textContent = `${num} kristalinin taşlarını topla`;

                // Check if no multiples
                let hasMultiples = false;
                for (let i = num * 2; i <= gameState.maxNumber; i += num) {
                    if (gameState.grid[i - 1].state !== 'eliminated') {
                        hasMultiples = true;
                        break;
                    }
                }

                if (!hasMultiples) {
                    setTimeout(() => finishPrime(), 1000);
                }
            } else {
                gameState.mistakes++;
                sounds.error();
                tile.classList.add('error');
                setTimeout(() => tile.classList.remove('error'), 400);
                resetCombo();
            }
        } else {
            // Unselect if clicking the same prime again
            if (num === gameState.activePrime) {
                gameState.activePrime = null;
                data.state = 'normal';
                tile.classList.remove('prime');
                ui.mission.textContent = 'Bir değerli kristal seç';
                return;
            }

            if (num % gameState.activePrime === 0) {
                data.state = 'eliminated';
                tile.classList.add('eliminated');

                let points = 10;
                gameState.score += points;

                const rect = tile.getBoundingClientRect();
                createParticles(rect.left + rect.width / 2, rect.top + rect.height / 2, 'crystal', 15);

                gameState.combo++;
                ui.comboValue.textContent = gameState.combo;
                ui.combo.classList.add('active');

                if (gameState.combo >= 10) {
                    tryUnlockAchievement('fast_hands');
                }

                if (gameState.combo % 3 === 0) {
                    const bonus = gameState.combo * 2;
                    gameState.score += bonus;
                    points += bonus;
                    sounds.combo();
                    createParticles(window.innerWidth / 2, window.innerHeight / 2, 'combo', 30);
                }

                sounds.crystal();
                showFloatingScore(rect.left + rect.width / 2, rect.top, points);

                updateUI();
                checkPhaseComplete();
            } else {
                gameState.mistakes++;
                sounds.error();
                tile.classList.add('error');
                setTimeout(() => tile.classList.remove('error'), 400);
                resetCombo();
            }
        }
    }

    function checkPhaseComplete() {
        if (!gameState.activePrime) return;

        let remains = false;
        for (let i = gameState.activePrime * 2; i <= gameState.maxNumber; i += gameState.activePrime) {
            if (gameState.grid[i - 1].state !== 'eliminated') {
                remains = true;
                break;
            }
        }

        if (!remains) {
            finishPrime();
        }
    }

    function finishPrime() {
        // Mark current active prime as completed
        if (gameState.activePrime) {
            const primeVal = gameState.activePrime;
            const data = gameState.grid[primeVal - 1];
            data.state = 'completed';
            const tile = getTile(primeVal);
            if (tile) tile.classList.add('completed');
        }

        gameState.activePrime = null;

        const remainingPrimes = gameState.grid.filter(d => d.isPrime && d.state === 'normal').length;

        if (remainingPrimes === 0) {
            endGame(true);
        } else {
            ui.mission.textContent = 'Bir değerli kristal seç';
        }
    }

    function resetCombo() {
        gameState.combo = 0;
        ui.combo.classList.remove('active');
    }

    function showFloatingScore(x, y, points) {
        const scoreEl = document.createElement('div');
        scoreEl.className = 'floating-score';
        scoreEl.textContent = `+${points}`;
        scoreEl.style.left = x + 'px';
        scoreEl.style.top = y + 'px';
        document.body.appendChild(scoreEl);

        setTimeout(() => scoreEl.remove(), 1000);
    }

    function getTile(num) {
        return ui.grid.querySelector(`[data-value="${num}"]`);
    }

    function updateUI() {
        ui.score.textContent = gameState.score;

        const total = gameState.primes.length;
        const found = gameState.grid.filter(d => d.isPrime && d.state === 'prime').length;
        ui.progress.style.width = (found / total * 100) + '%';
        ui.progressText.textContent = `${found}/${total}`;

        if (gameState.score >= 100) {
            tryUnlockAchievement('rich');
        }
    }

    function startTimer() {
        updateTimer();
        gameState.timerInterval = setInterval(() => {
            gameState.timeLeft--;
            updateTimer();

            if (gameState.timeLeft <= 0) {
                clearInterval(gameState.timerInterval);
                endGame(false);
            }
        }, 1000);
    }

    function updateTimer() {
        const mins = Math.floor(gameState.timeLeft / 60);
        const secs = gameState.timeLeft % 60;
        ui.timer.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    function endGame(success) {
        clearInterval(gameState.timerInterval);

        const level = LEVELS[gameState.currentLevel - 1];
        const duration = (Date.now() - gameState.startTime) / 1000;

        let stars = 0;
        if (success) {
            if (gameState.mistakes === 0) stars = 3;
            else if (gameState.mistakes <= 2) stars = 2;
            else stars = 1;

            tryUnlockAchievement('first_dig');

            if (stars === 3) tryUnlockAchievement('perfect');
            if (gameState.mistakes === 0) tryUnlockAchievement('flawless');
            if (duration <= 30) tryUnlockAchievement('lightning');

            if (gameState.currentLevel === LEVELS.length) {
                const allComplete = LEVELS.every((l, i) => (playerData.stars[i + 1] || 0) > 0);
                if (allComplete) tryUnlockAchievement('mountain');
            }
        }

        const prevStars = playerData.stars[gameState.currentLevel] || 0;
        if (stars > prevStars) {
            playerData.stars[gameState.currentLevel] = stars;
            localStorage.setItem('cm_stars', JSON.stringify(playerData.stars));
        }

        const xpGained = success ? level.xp + (stars * 20) : Math.floor(level.xp / 2);
        addXP(xpGained);

        // Grant Power-ups Logic
        if (success) {
            // Every 3 levels (level 3, 6, 9...)
            if (gameState.currentLevel % 3 === 0) {
                const types = ['lightning', 'magnifier', 'time', 'dynamite'];
                const type = types[Math.floor(Math.random() * types.length)];
                grantPowerUp(type, 1);
            }
            // 3 Stars Bonus
            if (stars === 3) {
                const types = ['lightning', 'magnifier', 'time', 'dynamite'];
                const type = types[Math.floor(Math.random() * types.length)];
                grantPowerUp(type, 1);
            }
            updatePowerUpUI();
        }

        ui.starsDisplay.innerHTML = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
        ui.finalScore.textContent = gameState.score;
        ui.earnedXp.textContent = xpGained;

        sounds.complete();
        createParticles(window.innerWidth / 2, window.innerHeight / 2, 'star', 100);

        ui.resultModal.classList.add('active');
        renderLevels();
    }

    function tryUnlockAchievement(key) {
        if (ACHIEVEMENTS[key] && !ACHIEVEMENTS[key].unlocked) {
            ACHIEVEMENTS[key].unlocked = true;
            playerData.achievements[key] = true;
            localStorage.setItem('cm_achievements', JSON.stringify(playerData.achievements));

            const div = document.createElement('div');
            div.className = 'achievement-item';
            div.innerHTML = `${ACHIEVEMENTS[key].icon} <strong>${ACHIEVEMENTS[key].title}</strong> açıldı!`;
            ui.newAchievements.appendChild(div);

            sounds.achievement();
            renderAchievements();
        }
    }

    // Window resize
    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });

    // Initialize game
    init();
})();
