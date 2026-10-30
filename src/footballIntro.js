import * as THREE from 'three';
import gsap from 'gsap';
import { buildFootballMesh } from './footballGeometry.js';

export class FootballIntro {
  constructor(container, options = {}) {
    this.container = container;
    this.onComplete = options.onComplete || null;
    this.onReveal = options.onReveal || null;
    this.isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.isPlaying = false;
    this.animationTimeline = null;
    this.rafId = null;
    this.particles = [];
    this.particlesActive = false;

    this.init();
  }

  init() {
    this.createDomElements();
    this.setupThree();
    this.loadAssetsAndBuildBall();
    this.setupEvents();
  }

  createDomElements() {
    this.container.classList.add('football-intro-container');
    this.container.style.opacity = '1';
    this.container.style.display = 'block';

    // Outer stage wrapper (receives camera shake & lens distortion)
    this.stageWrapper = document.createElement('div');
    this.stageWrapper.className = 'intro-stage-wrapper';
    this.container.appendChild(this.stageWrapper);

    // 1. Stadium Background Wrapper
    this.stadiumWrapper = document.createElement('div');
    this.stadiumWrapper.className = 'stadium-bg-wrapper';

    this.stadiumImg = document.createElement('img');
    this.stadiumImg.className = 'stadium-bg-img';
    this.stadiumImg.src = '/images/stadium.jpg';
    this.stadiumImg.alt = 'Samarth Sports Football Stadium';

    // Cinematic dark green color grade overlay (#051F20 brand palette)
    this.stadiumGrade = document.createElement('div');
    this.stadiumGrade.className = 'stadium-cinematic-grade';

    this.stadiumWrapper.appendChild(this.stadiumImg);
    this.stadiumWrapper.appendChild(this.stadiumGrade);
    this.stageWrapper.appendChild(this.stadiumWrapper);

    // 2. Three.js Canvas Wrapper
    this.canvasWrapper = document.createElement('div');
    this.canvasWrapper.className = 'football-canvas-wrapper';
    this.stageWrapper.appendChild(this.canvasWrapper);

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'football-webgl-canvas';
    this.canvasWrapper.appendChild(this.canvas);

    // 3. Impact Effects Layer
    this.effectsLayer = document.createElement('div');
    this.effectsLayer.className = 'impact-effects-layer';
    this.stageWrapper.appendChild(this.effectsLayer);

    // Expanding shockwave ring
    this.shockwave = document.createElement('div');
    this.shockwave.className = 'impact-shockwave';
    this.effectsLayer.appendChild(this.shockwave);

    // Cinematic white / green flash
    this.impactFlash = document.createElement('div');
    this.impactFlash.className = 'impact-flash';
    this.effectsLayer.appendChild(this.impactFlash);

    // 2D Canvas for high-performance grass & dust particles
    this.particleCanvas = document.createElement('canvas');
    this.particleCanvas.className = 'impact-particles-canvas';
    this.effectsLayer.appendChild(this.particleCanvas);
    this.particleCtx = this.particleCanvas.getContext('2d');
  }

  setupThree() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    // Update particle canvas size
    this.particleCanvas.width = width;
    this.particleCanvas.height = height;

    // Scene
    this.scene = new THREE.Scene();

    // Camera (Centered, 45 deg FoV for natural sports perspective)
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 200);
    this.camera.position.set(0, 0, 8.5);

    // Renderer with full alpha transparency so the stadium is visible behind
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    // Realistic Stadium Lighting matching daylight and field bounce
    // 1. Ambient sky light (cool skylight tone)
    this.ambientLight = new THREE.AmbientLight(0xbad2e8, 1.25);
    this.scene.add(this.ambientLight);

    // 2. Main Overhead Sunlight (matches bright stadium sun)
    this.sunLight = new THREE.DirectionalLight(0xfffcf5, 3.4);
    this.sunLight.position.set(5, 14, 9);
    this.scene.add(this.sunLight);

    // 3. Fill Light (balances shadows on left panels)
    this.fillLight = new THREE.DirectionalLight(0xd9e6f2, 1.4);
    this.fillLight.position.set(-8, 6, 7);
    this.scene.add(this.fillLight);

    // 4. Pitch Turf Reflection (illuminates bottom of ball with grass green #8EB69B)
    this.turfBounceLight = new THREE.DirectionalLight(0x8EB69B, 2.2);
    this.turfBounceLight.position.set(0, -9, 2);
    this.scene.add(this.turfBounceLight);

    // Render loop
    this.render = this.render.bind(this);
    this.rafId = requestAnimationFrame(this.render);
  }

  loadAssetsAndBuildBall() {
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
      '/textures/leather.jpg',
      (texture) => {
        texture.generateMipmaps = true;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        if (this.renderer) {
          texture.anisotropy = Math.min(this.renderer.capabilities.getMaxAnisotropy(), 16);
        }
        this.buildBall(texture);
      },
      undefined,
      () => {
        this.buildBall(null);
      }
    );
  }

  buildBall(leatherTexture) {
    this.football = buildFootballMesh(1.85, leatherTexture);
    this.scene.add(this.football);

    this.resetToInitialState();
    this.playAnimation();
  }

  resetToInitialState() {
    if (!this.football) return;

    this.container.style.display = 'block';
    this.container.style.opacity = '1';

    // Reset canvas & stage transforms
    gsap.set(this.canvasWrapper, { opacity: 1 });
    gsap.set(this.stageWrapper, { x: 0, y: 0, rotation: 0, scale: 1 });
    gsap.set(this.stadiumImg, { scale: 1.0, y: 0 });
    gsap.set(this.impactFlash, { opacity: 0 });
    gsap.set(this.shockwave, { scale: 0.2, opacity: 0 });

    // Start with football at a distance, centered on the screen
    this.football.position.set(0, 0, -46);
    this.football.rotation.set(-0.6, 0.4, 0.2);
    this.football.scale.set(0.38, 0.38, 0.38);

    this.particles = [];
    this.particlesActive = false;
  }

  spawnImpactParticles() {
    const width = this.particleCanvas.width;
    const height = this.particleCanvas.height;
    const cx = width / 2;
    const cy = height / 2;
    const count = 32;

    this.particles = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 14 + 6;
      const isGrass = Math.random() > 0.4;

      this.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (Math.random() * 3), // slight upward bias
        size: isGrass ? Math.random() * 5 + 3 : Math.random() * 3 + 2,
        length: isGrass ? Math.random() * 8 + 4 : 0,
        color: isGrass
          ? (Math.random() > 0.5 ? '#8EB69B' : '#4ade80')
          : (Math.random() > 0.5 ? '#ffffff' : '#d1fae5'),
        alpha: 1.0,
        decay: Math.random() * 0.035 + 0.025,
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.35,
        isGrass: isGrass
      });
    }

    this.particlesActive = true;
  }

  playAnimation() {
    if (!this.football || this.isPlaying) return;
    this.isPlaying = true;

    if (this.animationTimeline) {
      this.animationTimeline.kill();
    }

    if (this.isReducedMotion) {
      const tl = gsap.timeline({
        onComplete: () => {
          this.finishTransition();
        }
      });
      this.animationTimeline = tl;

      tl.to(this.football.rotation, {
        y: '+=1.6',
        duration: 1.8,
        ease: 'power1.inOut'
      }, 0);

      tl.to(this.container, {
        opacity: 0,
        duration: 0.8,
        ease: 'power2.out'
      }, 1.0);
      return;
    }

    // Main Master Timeline
    const tl = gsap.timeline({
      onComplete: () => {
        this.finishTransition();
      }
    });
    this.animationTimeline = tl;

    const ball = this.football;
    const impactTime = 1.45; // Fast, punchy kick approach

    // 1. Background Camera Motion (Gradual zoom + subtle parallax, synchronized with ball)
    tl.to(this.stadiumImg, {
      scale: 1.15,
      y: '-2.5%',
      duration: impactTime,
      ease: 'power2.in'
    }, 0);

    // 2. Fast 3D Football Movement
    // Rapid natural rotation across all 3 axes
    tl.to(ball.rotation, {
      x: '+=5.2',
      y: '+=7.2',
      z: '+=2.6',
      duration: impactTime,
      ease: 'power2.in'
    }, 0);

    // Rapid acceleration towards the camera - approaches camera lens without clipping
    tl.to(ball.position, {
      z: 5.95, // Front surface reaches camera lens plane (z = 8.39, near plane = 8.40)
      x: 0,
      y: 0,
      duration: impactTime,
      ease: 'power2.in'
    }, 0);

    // Scale increases dramatically as it approaches, fully covering mobile & desktop viewport
    tl.to(ball.scale, {
      x: 1.32,
      y: 1.32,
      z: 1.32,
      duration: impactTime,
      ease: 'power2.in'
    }, 0);

    // =========================================================================
    // 3. RESTORED IMPACT EFFECT (Exact moment ball strikes camera at impactTime)
    // =========================================================================

    // A. Strong, short camera shake on the stage
    tl.call(() => {
      const shakeTl = gsap.timeline();
      shakeTl
        .to(this.stageWrapper, { x: -16, y: 12, rotation: -1.2, duration: 0.035, ease: 'power2.out' })
        .to(this.stageWrapper, { x: 14, y: -10, rotation: 1.0, duration: 0.04, ease: 'power2.inOut' })
        .to(this.stageWrapper, { x: -10, y: 8, rotation: -0.7, duration: 0.045, ease: 'power2.inOut' })
        .to(this.stageWrapper, { x: 7, y: -5, rotation: 0.4, duration: 0.05, ease: 'power2.inOut' })
        .to(this.stageWrapper, { x: -3, y: 2, rotation: -0.2, duration: 0.055, ease: 'power2.inOut' })
        .to(this.stageWrapper, { x: 0, y: 0, rotation: 0, duration: 0.065, ease: 'power2.out' });

      // Spawn turf and dust particles
      this.spawnImpactParticles();
    }, null, impactTime);

    // B. Brief white/green cinematic flash
    tl.to(this.impactFlash, {
      opacity: 0.85,
      duration: 0.05,
      ease: 'power4.out'
    }, impactTime);

    tl.to(this.impactFlash, {
      opacity: 0,
      duration: 0.22,
      ease: 'power2.out'
    }, impactTime + 0.05);

    // C. Expanding Impact Shockwave
    tl.fromTo(this.shockwave, 
      { scale: 0.2, opacity: 0.95 },
      { scale: 3.2, opacity: 0, duration: 0.35, ease: 'power3.out' },
      impactTime
    );

    // D. Screen Lens Pop Distortion
    tl.to(this.stageWrapper, {
      scale: 1.04,
      duration: 0.08,
      ease: 'power2.out'
    }, impactTime);

    // E. Massive Football Expansion past viewport boundaries
    tl.to(ball.position, {
      z: 8.6,
      duration: 0.36,
      ease: 'power2.in'
    }, impactTime);

    tl.to(ball.scale, {
      x: 3.2,
      y: 3.2,
      z: 3.2,
      duration: 0.36,
      ease: 'power2.in'
    }, impactTime);

    // =========================================================================
    // 4. REVEAL STADIUM BACKGROUND & COORDINATED HOMEPAGE ENTRANCE
    // =========================================================================
    // Fade 3D canvas so the stadium photograph is revealed as the ball expands past edges
    tl.to(this.canvasWrapper, {
      opacity: 0,
      duration: 0.25,
      ease: 'power2.out'
    }, impactTime + 0.10);

    // Trigger homepage staggered reveal sequence right as stadium clears
    tl.call(() => {
      if (typeof this.onReveal === 'function') {
        this.onReveal();
      }
    }, null, impactTime + 0.15);

    // Seamless cross-fade from stadium overlay into homepage underneath
    tl.to(this.container, {
      opacity: 0,
      duration: 0.35,
      ease: 'power2.out'
    }, impactTime + 0.18);
  }

  finishTransition() {
    this.isPlaying = false;
    this.container.style.display = 'none';

    if (typeof this.onComplete === 'function') {
      this.onComplete();
    }
    window.dispatchEvent(new CustomEvent('samarth-intro-complete'));

    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  setupEvents() {
    this.handleResize = () => {
      const width = this.container.clientWidth || window.innerWidth;
      const height = this.container.clientHeight || window.innerHeight;

      if (this.camera && this.renderer) {
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      }

      if (this.particleCanvas) {
        this.particleCanvas.width = width;
        this.particleCanvas.height = height;
      }
    };
    window.addEventListener('resize', this.handleResize);

    // Replay hook
    window.replayIntro = () => {
      if (this.animationTimeline) {
        this.animationTimeline.kill();
      }
      if (!this.rafId) {
        this.rafId = requestAnimationFrame(this.render);
      }
      this.resetToInitialState();
      this.playAnimation();
    };
  }

  render() {
    if (this.isPlaying || this.container.style.display !== 'none') {
      this.rafId = requestAnimationFrame(this.render);

      // Render 3D Scene
      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }

      // Update and render 2D particles
      if (this.particlesActive && this.particleCtx) {
        this.particleCtx.clearRect(0, 0, this.particleCanvas.width, this.particleCanvas.height);
        let activeCount = 0;

        for (let i = 0; i < this.particles.length; i++) {
          const p = this.particles[i];
          if (p.alpha <= 0.01) continue;

          activeCount++;
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.35; // gravity
          p.vx *= 0.94; // air drag
          p.vy *= 0.94;
          p.alpha -= p.decay;
          p.rotation += p.vRot;

          this.particleCtx.save();
          this.particleCtx.translate(p.x, p.y);
          this.particleCtx.rotate(p.rotation);
          this.particleCtx.globalAlpha = Math.max(0, p.alpha);
          this.particleCtx.fillStyle = p.color;

          if (p.isGrass) {
            // Rectangular grass blade
            this.particleCtx.fillRect(-p.size / 2, -p.length / 2, p.size, p.length);
          } else {
            // Circular dust mote
            this.particleCtx.beginPath();
            this.particleCtx.arc(0, 0, p.size, 0, Math.PI * 2);
            this.particleCtx.fill();
          }

          this.particleCtx.restore();
        }

        if (activeCount === 0) {
          this.particlesActive = false;
        }
      }
    }
  }

  destroy() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    window.removeEventListener('resize', this.handleResize);

    if (this.animationTimeline) {
      this.animationTimeline.kill();
    }

    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}
