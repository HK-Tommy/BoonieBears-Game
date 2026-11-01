import React, { useEffect, useRef, useState, useCallback } from 'react';
import Matter from 'matter-js';
import confetti from 'canvas-confetti';
import { CHARACTER_TIERS, MAX_TIER } from '../data/characters';
import { CharacterTier, FloatingText, Particle } from '../types/game';
import { soundManager } from '../utils/audio';

interface GameBoardProps {
  onScoreUpdate: (scoreDelta: number, newMaxTier: number) => void;
  onRevivalEarned: () => void;
  onGameOver: (finalScore: number, maxTier: number) => void;
  revivalCoins: number;
  onUseRevivalCoin: () => boolean;
  score: number;
}

const BOARD_WIDTH = 420;
const BOARD_HEIGHT = 650;
const DANGER_Y = 120;
const DROP_Y = 55;
const WALL_THICKNESS = 18;

export const GameBoard: React.FC<GameBoardProps> = ({
  onScoreUpdate,
  onRevivalEarned,
  onGameOver,
  revivalCoins,
  onUseRevivalCoin,
  score,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Matter engine refs
  const engineRef = useRef<Matter.Engine | null>(null);
  const worldRef = useRef<Matter.World | null>(null);
  const requestRef = useRef<number | null>(null);

  // Game state refs
  const aimXRef = useRef<number>(BOARD_WIDTH / 2);
  const isPointerDownRef = useRef<boolean>(false);
  const canDropRef = useRef<boolean>(true);
  const currentTierRef = useRef<CharacterTier>(CHARACTER_TIERS[0]);
  const nextTierRef = useRef<CharacterTier>(CHARACTER_TIERS[0]);
  const imagesMapRef = useRef<Map<number, HTMLImageElement>>(new Map());

  // Particles & Floating text
  const particlesRef = useRef<Particle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);

  // Danger tracking
  const dangerTimerRef = useRef<number>(0); // in seconds
  const isDangerActiveRef = useRef<boolean>(false);
  const [dangerCountdown, setDangerCountdown] = useState<number | null>(null);

  // Combo tracking
  const comboCountRef = useRef<number>(0);
  const lastMergeTimeRef = useRef<number>(0);
  const maxTierAchievedRef = useRef<number>(1);

  // UI state for previews
  const [currentTierUI, setCurrentTierUI] = useState<CharacterTier>(CHARACTER_TIERS[0]);
  const [nextTierUI, setNextTierUI] = useState<CharacterTier>(CHARACTER_TIERS[0]);
  const [showRevivePrompt, setShowRevivePrompt] = useState<boolean>(false);

  // Random character tier from all 12 characters (1 to 12)
  const getRandomTier = useCallback((): CharacterTier => {
    const randomIdx = Math.floor(Math.random() * CHARACTER_TIERS.length);
    return CHARACTER_TIERS[randomIdx];
  }, []);

  // Preload all 12 character images
  useEffect(() => {
    CHARACTER_TIERS.forEach((char) => {
      const img = new Image();
      img.src = char.image;
      img.onload = () => {
        imagesMapRef.current.set(char.tier, img);
      };
    });
  }, []);

  // Initialize initial tiers
  useEffect(() => {
    const initialCurrent = getRandomTier();
    const initialNext = getRandomTier();
    currentTierRef.current = initialCurrent;
    nextTierRef.current = initialNext;
    setCurrentTierUI(initialCurrent);
    setNextTierUI(initialNext);
  }, [getRandomTier]);

  // Spawn particle effect
  const spawnParticles = (x: number, y: number, color: string, count: number = 16) => {
    const colors = [color, '#ffd700', '#ffffff', '#ff7675', '#74b9ff'];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4.5 + 1.5;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        radius: Math.random() * 4 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        decay: Math.random() * 0.025 + 0.015,
        rotation: Math.random() * Math.PI,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
      });
    }
  };

  // Add floating score / combo text
  const addFloatingText = (x: number, y: number, text: string, color: string = '#f59e0b') => {
    floatingTextsRef.current.push({
      id: Math.random().toString(),
      x,
      y,
      text,
      color,
      opacity: 1,
      scale: 1.2,
      velocityY: -2.2,
    });
  };

  // Use Revival Coin effect
  const triggerRevivalBlast = useCallback(() => {
    if (!engineRef.current || !worldRef.current) return;
    const world = worldRef.current;
    soundManager.playRevival();

    // Remove bodies that are near or above the danger zone
    const allBodies = Matter.Composite.allBodies(world);
    let removedCount = 0;

    allBodies.forEach((body) => {
      if (body.isStatic) return;
      // If body is in the upper 40% of the board
      if (body.position.y < DANGER_Y + 140) {
        spawnParticles(body.position.x, body.position.y, '#ffd700', 20);
        Matter.World.remove(world, body);
        removedCount++;
      }
    });

    dangerTimerRef.current = 0;
    isDangerActiveRef.current = false;
    setDangerCountdown(null);
    setShowRevivePrompt(false);

    addFloatingText(BOARD_WIDTH / 2, DANGER_Y + 40, `✨ 復活成功！清除 ${removedCount} 個頂部障礙`, '#10b981');
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.3 },
    });
  }, []);

  // Handle game revival button click
  const handleUseRevival = useCallback(() => {
    if (revivalCoins > 0 && onUseRevivalCoin()) {
      triggerRevivalBlast();
    }
  }, [revivalCoins, onUseRevivalCoin, triggerRevivalBlast]);

  // Drop current character
  const dropCharacter = useCallback(() => {
    if (!canDropRef.current || !engineRef.current || !worldRef.current) return;

    canDropRef.current = false;
    const tierData = currentTierRef.current;
    const world = worldRef.current;

    // Constrain drop x within walls
    const minX = WALL_THICKNESS + tierData.radius + 2;
    const maxX = BOARD_WIDTH - WALL_THICKNESS - tierData.radius - 2;
    const clampedX = Math.max(minX, Math.min(maxX, aimXRef.current));

    // Create physics circle
    const ball = Matter.Bodies.circle(clampedX, DROP_Y, tierData.radius, {
      restitution: 0.22,
      friction: 0.12,
      frictionAir: 0.003,
      density: 0.0012,
      label: 'character_ball',
    });

    (ball as unknown as { customData: { tier: number; justSpawned: boolean; isMerged: boolean; id: string } }).customData = {
      tier: tierData.tier,
      justSpawned: true,
      isMerged: false,
      id: Math.random().toString(),
    };

    Matter.World.add(world, ball);
    soundManager.playDrop();

    // After 1 second, remove "justSpawned" flag so it can be evaluated for danger line
    setTimeout(() => {
      const data = (ball as unknown as { customData?: { justSpawned: boolean } }).customData;
      if (data) {
        data.justSpawned = false;
      }
    }, 1000);

    // Prepare next character
    currentTierRef.current = nextTierRef.current;
    setCurrentTierUI(nextTierRef.current);

    const newNext = getRandomTier();
    nextTierRef.current = newNext;
    setNextTierUI(newNext);

    // Cooldown before next drop allowed
    setTimeout(() => {
      canDropRef.current = true;
    }, 450);
  }, [getRandomTier]);

  // Initialize Matter.js Physics Engine
  useEffect(() => {
    const engine = Matter.Engine.create({
      gravity: { x: 0, y: 1.18 },
      positionIterations: 8,
      velocityIterations: 8,
    });
    const world = engine.world;
    engineRef.current = engine;
    worldRef.current = world;

    // Boundaries
    const ground = Matter.Bodies.rectangle(BOARD_WIDTH / 2, BOARD_HEIGHT - 8, BOARD_WIDTH, 16, {
      isStatic: true,
      friction: 0.5,
      restitution: 0.15,
      render: { visible: false },
    });

    const leftWall = Matter.Bodies.rectangle(WALL_THICKNESS / 2, BOARD_HEIGHT / 2, WALL_THICKNESS, BOARD_HEIGHT, {
      isStatic: true,
      friction: 0.3,
      restitution: 0.2,
      render: { visible: false },
    });

    const rightWall = Matter.Bodies.rectangle(BOARD_WIDTH - WALL_THICKNESS / 2, BOARD_HEIGHT / 2, WALL_THICKNESS, BOARD_HEIGHT, {
      isStatic: true,
      friction: 0.3,
      restitution: 0.2,
      render: { visible: false },
    });

    Matter.World.add(world, [ground, leftWall, rightWall]);

    // Collision handling for merges
    Matter.Events.on(engine, 'collisionStart', (event) => {
      const pairs = event.pairs;

      for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i];
        const bodyA = pair.bodyA as unknown as { customData?: { tier: number; isMerged: boolean; id: string }; position: Matter.Vector };
        const bodyB = pair.bodyB as unknown as { customData?: { tier: number; isMerged: boolean; id: string }; position: Matter.Vector };

        if (!bodyA.customData || !bodyB.customData) {
          // One is boundary, play bounce sound if dynamic body hit boundary
          const dynamicBody = bodyA.customData ? bodyA : bodyB.customData ? bodyB : null;
          if (dynamicBody) {
            soundManager.playBounce(dynamicBody.customData?.tier || 1);
          }
          continue;
        }

        // Both are character balls
        if (bodyA.customData.tier === bodyB.customData.tier && !bodyA.customData.isMerged && !bodyB.customData.isMerged) {
          // Flag as merging so no duplicate merge
          bodyA.customData.isMerged = true;
          bodyB.customData.isMerged = true;

          const tier = bodyA.customData.tier;
          const midX = (bodyA.position.x + bodyB.position.x) / 2;
          const midY = (bodyA.position.y + bodyB.position.y) / 2;

          // Process merge asynchronously on next microtask so physics step finishes cleanly
          setTimeout(() => {
            if (!worldRef.current) return;
            Matter.World.remove(worldRef.current, pair.bodyA);
            Matter.World.remove(worldRef.current, pair.bodyB);

            // Combo calculation
            const now = Date.now();
            if (now - lastMergeTimeRef.current < 1600) {
              comboCountRef.current += 1;
            } else {
              comboCountRef.current = 1;
            }
            lastMergeTimeRef.current = now;

            const comboBonus = comboCountRef.current > 1 ? comboCountRef.current * 5 : 0;
            const currentTierConfig = CHARACTER_TIERS[tier - 1];
            const baseScore = currentTierConfig ? currentTierConfig.score : tier * 4;
            const pointsAwarded = baseScore + comboBonus;

            // Update score
            const nextTierNum = tier < MAX_TIER ? tier + 1 : MAX_TIER;
            if (nextTierNum > maxTierAchievedRef.current) {
              maxTierAchievedRef.current = nextTierNum;
            }
            onScoreUpdate(pointsAwarded, maxTierAchievedRef.current);

            // Effects
            const tierColor = currentTierConfig ? currentTierConfig.color : '#f59e0b';
            spawnParticles(midX, midY, tierColor, 22);

            let floatingMsg = `+${pointsAwarded}`;
            if (comboCountRef.current > 1) {
              floatingMsg += ` (Combo x${comboCountRef.current}!)`;
              soundManager.playCombo(comboCountRef.current);
            }
            addFloatingText(midX, midY - 20, floatingMsg, comboCountRef.current > 1 ? '#ef4444' : tierColor);

            if (tier < MAX_TIER) {
              // Spawn next tier
              const newTierConfig = CHARACTER_TIERS[tier]; // next tier
              const newBody = Matter.Bodies.circle(midX, midY, newTierConfig.radius, {
                restitution: 0.2,
                friction: 0.15,
                frictionAir: 0.003,
                density: 0.0012,
                label: 'character_ball',
              });

              (newBody as unknown as { customData: { tier: number; justSpawned: boolean; isMerged: boolean; id: string } }).customData = {
                tier: newTierConfig.tier,
                justSpawned: false,
                isMerged: false,
                id: Math.random().toString(),
              };

              Matter.World.add(worldRef.current, newBody);
              soundManager.playMerge(newTierConfig.tier);

              // Celebration for high tiers (Tier 9+)
              if (newTierConfig.tier >= 9) {
                confetti({
                  particleCount: 30,
                  spread: 45,
                  origin: { x: midX / BOARD_WIDTH, y: midY / BOARD_HEIGHT },
                });
              }
            } else {
              // Two Tier 12 characters merged: Ultimate Explosion!
              soundManager.playUltimateMerge();
              onScoreUpdate(500, MAX_TIER);
              onRevivalEarned();
              addFloatingText(midX, midY - 40, '✨ 終極合體！+500分 & 獲得復活幣！', '#ffd700');
              confetti({
                particleCount: 100,
                spread: 100,
                origin: { x: 0.5, y: 0.5 },
              });
            }
          }, 0);
        } else {
          // Different tiers collided, play gentle bounce sound
          soundManager.playBounce(bodyA.customData?.tier || 1);
        }
      }
    });

    return () => {
      Matter.World.clear(world, false);
      Matter.Engine.clear(engine);
    };
  }, [onScoreUpdate, onRevivalEarned]);

  // Main Render & Physics Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const dt = Math.min((currentTime - lastTime) / 1000, 0.033);
      lastTime = currentTime;

      // Update Matter physics
      if (engineRef.current) {
        Matter.Engine.update(engineRef.current, 1000 / 60);
      }

      // Check danger line condition
      if (worldRef.current) {
        const bodies = Matter.Composite.allBodies(worldRef.current);
        let hasBodyInDanger = false;

        for (let i = 0; i < bodies.length; i++) {
          const body = bodies[i];
          if (body.isStatic) continue;

          const data = (body as unknown as { customData?: { tier: number; justSpawned: boolean } }).customData;
          if (!data || data.justSpawned) continue;

          const radius = (body as { circleRadius?: number }).circleRadius || 20;
          const topEdge = body.position.y - radius;

          // If top edge is above the danger line and body has settled
          if (topEdge < DANGER_Y && Math.abs(body.velocity.y) < 0.22 && Math.abs(body.velocity.x) < 0.22) {
            hasBodyInDanger = true;
            break;
          }
        }

        if (hasBodyInDanger) {
          isDangerActiveRef.current = true;
          dangerTimerRef.current += dt;
          const timeLeft = Math.max(0, 3.0 - dangerTimerRef.current);
          setDangerCountdown(Math.ceil(timeLeft));

          if (dangerTimerRef.current >= 3.0) {
            // Trigger game over or revival
            if (revivalCoins > 0) {
              setShowRevivePrompt(true);
            } else {
              onGameOver(score, maxTierAchievedRef.current);
            }
          }
        } else {
          if (dangerTimerRef.current > 0) {
            dangerTimerRef.current = Math.max(0, dangerTimerRef.current - dt * 2);
            if (dangerTimerRef.current === 0) {
              isDangerActiveRef.current = false;
              setDangerCountdown(null);
            }
          }
        }
      }

      // CLEAR & RENDER CANVAS
      ctx.clearRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

      // 1. Board Interior Background
      const bgGrad = ctx.createLinearGradient(0, 0, 0, BOARD_HEIGHT);
      bgGrad.addColorStop(0, '#fefbf3');
      bgGrad.addColorStop(0.5, '#fcf7ec');
      bgGrad.addColorStop(1, '#f8f1de');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(WALL_THICKNESS, 0, BOARD_WIDTH - WALL_THICKNESS * 2, BOARD_HEIGHT - 8);

      // Subtle horizontal floor grid pattern
      ctx.strokeStyle = '#f0e6d2';
      ctx.lineWidth = 1;
      for (let y = 160; y < BOARD_HEIGHT - 10; y += 45) {
        ctx.beginPath();
        ctx.moveTo(WALL_THICKNESS, y);
        ctx.lineTo(BOARD_WIDTH - WALL_THICKNESS, y);
        ctx.stroke();
      }

      // 2. Aim guide line
      if (canDropRef.current) {
        const curTier = currentTierRef.current;
        const minX = WALL_THICKNESS + curTier.radius + 2;
        const maxX = BOARD_WIDTH - WALL_THICKNESS - curTier.radius - 2;
        const clampedAimX = Math.max(minX, Math.min(maxX, aimXRef.current));

        ctx.save();
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = isDangerActiveRef.current ? 'rgba(239, 68, 68, 0.4)' : 'rgba(217, 119, 6, 0.35)';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(clampedAimX, DROP_Y + curTier.radius);
        ctx.lineTo(clampedAimX, BOARD_HEIGHT - 10);
        ctx.stroke();
        ctx.restore();
      }

      // 3. Danger Warning Line
      ctx.save();
      const isDanger = isDangerActiveRef.current;
      ctx.setLineDash([8, 6]);
      ctx.strokeStyle = isDanger ? '#ef4444' : '#e2a075';
      ctx.lineWidth = isDanger ? 2.5 : 1.5;
      if (isDanger) {
        ctx.shadowColor = 'rgba(239, 68, 68, 0.6)';
        ctx.shadowBlur = 8;
      }
      ctx.beginPath();
      ctx.moveTo(WALL_THICKNESS, DANGER_Y);
      ctx.lineTo(BOARD_WIDTH - WALL_THICKNESS, DANGER_Y);
      ctx.stroke();

      // Danger text label
      ctx.font = '500 11px sans-serif';
      ctx.fillStyle = isDanger ? '#ef4444' : '#c27e53';
      ctx.textAlign = 'right';
      ctx.fillText(isDanger ? `⚠️ 警戒中 (${dangerCountdown}s)` : '警戒線', BOARD_WIDTH - WALL_THICKNESS - 8, DANGER_Y - 6);
      ctx.restore();

      // 4. Render All Physics Bodies (Characters)
      if (worldRef.current) {
        const bodies = Matter.Composite.allBodies(worldRef.current);

        bodies.forEach((body) => {
          if (body.isStatic) return;

          const data = (body as unknown as { customData?: { tier: number } }).customData;
          if (!data) return;

          const tierNum = data.tier;
          const tierConfig = CHARACTER_TIERS[tierNum - 1] || CHARACTER_TIERS[0];
          const radius = (body as { circleRadius?: number }).circleRadius || tierConfig.radius;
          const img = imagesMapRef.current.get(tierNum);

          ctx.save();
          ctx.translate(body.position.x, body.position.y);
          ctx.rotate(body.angle);

          // Outer shadow
          ctx.shadowColor = 'rgba(0, 0, 0, 0.12)';
          ctx.shadowBlur = 6;
          ctx.shadowOffsetY = 3;

          // Base circular container with tier color
          ctx.beginPath();
          ctx.arc(0, 0, radius, 0, Math.PI * 2);
          ctx.fillStyle = tierConfig.color;
          ctx.fill();

          // Reset shadow for inner clipping
          ctx.shadowColor = 'transparent';

          // Clip to circle for character rendering
          ctx.save();
          ctx.beginPath();
          ctx.arc(0, 0, radius, 0, Math.PI * 2);
          ctx.clip();

          // Inner soft gradient
          const circleGrad = ctx.createRadialGradient(-radius * 0.3, -radius * 0.3, radius * 0.1, 0, 0, radius);
          circleGrad.addColorStop(0, '#ffffff');
          circleGrad.addColorStop(0.7, tierConfig.color);
          circleGrad.addColorStop(1, '#333333');
          ctx.fillStyle = circleGrad;
          ctx.fill();

          // Draw uploaded image if available
          if (img && img.complete && img.naturalWidth > 0 && tierNum !== 6) {
            // Fitted image maintaining aspect ratio
            const scale = (radius * 2.05) / Math.max(img.naturalWidth, img.naturalHeight);
            const drawW = img.naturalWidth * scale;
            const drawH = img.naturalHeight * scale;
            ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
          } else {
            // Fallback for Tier 6 or when loading: beautiful illustrated avatar badge
            ctx.font = `${Math.round(radius * 0.9)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(tierConfig.emoji, 0, 0);

            // Small text label
            ctx.font = `bold ${Math.max(10, Math.round(radius * 0.28))}px sans-serif`;
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = 'rgba(0,0,0,0.5)';
            ctx.lineWidth = 2.5;
            ctx.strokeText(tierConfig.name, 0, radius * 0.55);
            ctx.fillText(tierConfig.name, 0, radius * 0.55);
          }

          // Glossy highlight reflection
          ctx.beginPath();
          ctx.ellipse(0, -radius * 0.52, radius * 0.6, radius * 0.24, 0, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
          ctx.fill();

          ctx.restore(); // end clip

          // Crisp rim border
          ctx.beginPath();
          ctx.arc(0, 0, radius, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.lineWidth = 2.5;
          ctx.stroke();

          ctx.restore();
        });
      }

      // 5. Draw Currently Aimed Character at the top
      if (canDropRef.current) {
        const curTier = currentTierRef.current;
        const minX = WALL_THICKNESS + curTier.radius + 2;
        const maxX = BOARD_WIDTH - WALL_THICKNESS - curTier.radius - 2;
        const clampedAimX = Math.max(minX, Math.min(maxX, aimXRef.current));
        const img = imagesMapRef.current.get(curTier.tier);

        // Gentle breathing float effect
        const floatY = DROP_Y + Math.sin(currentTime * 0.005) * 2;

        ctx.save();
        ctx.translate(clampedAimX, floatY);

        ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 4;

        ctx.beginPath();
        ctx.arc(0, 0, curTier.radius, 0, Math.PI * 2);
        ctx.fillStyle = curTier.color;
        ctx.fill();
        ctx.shadowColor = 'transparent';

        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, curTier.radius, 0, Math.PI * 2);
        ctx.clip();

        if (img && img.complete && img.naturalWidth > 0 && curTier.tier !== 6) {
          const scale = (curTier.radius * 2.05) / Math.max(img.naturalWidth, img.naturalHeight);
          const drawW = img.naturalWidth * scale;
          const drawH = img.naturalHeight * scale;
          ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
        } else {
          ctx.font = `${Math.round(curTier.radius * 0.9)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(curTier.emoji, 0, 0);
        }

        // Gloss highlight
        ctx.beginPath();
        ctx.ellipse(0, -curTier.radius * 0.52, curTier.radius * 0.6, curTier.radius * 0.24, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.fill();

        ctx.restore();

        ctx.beginPath();
        ctx.arc(0, 0, curTier.radius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.restore();
      }

      // 6. Draw Left and Right Wooden Frame Walls
      const woodGrad = ctx.createLinearGradient(0, 0, WALL_THICKNESS, 0);
      woodGrad.addColorStop(0, '#8c532b');
      woodGrad.addColorStop(0.5, '#ba7a48');
      woodGrad.addColorStop(1, '#8c532b');

      ctx.fillStyle = woodGrad;
      // Left Wall
      ctx.fillRect(0, 0, WALL_THICKNESS, BOARD_HEIGHT);
      // Right Wall
      ctx.fillRect(BOARD_WIDTH - WALL_THICKNESS, 0, WALL_THICKNESS, BOARD_HEIGHT);
      // Bottom Base
      ctx.fillRect(0, BOARD_HEIGHT - 12, BOARD_WIDTH, 12);

      // Bevel highlights
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.fillRect(WALL_THICKNESS - 2, 0, 2, BOARD_HEIGHT);
      ctx.fillRect(BOARD_WIDTH - WALL_THICKNESS, 0, 2, BOARD_HEIGHT);

      // 7. Update and Draw Particles
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.12; // particle gravity
        p.alpha -= p.decay;
        p.rotation += p.rotationSpeed;

        if (p.alpha <= 0) {
          particlesRef.current.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;

        ctx.beginPath();
        ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 8. Update and Draw Floating Texts
      for (let i = floatingTextsRef.current.length - 1; i >= 0; i--) {
        const ft = floatingTextsRef.current[i];
        ft.y += ft.velocityY;
        ft.opacity -= 0.018;
        ft.scale = Math.max(1, ft.scale - 0.015);

        if (ft.opacity <= 0) {
          floatingTextsRef.current.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, ft.opacity);
        ctx.font = `900 ${Math.round(18 * ft.scale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = ft.color;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 4;
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
      }

      requestRef.current = requestAnimationFrame(loop);
    };

    requestRef.current = requestAnimationFrame(loop);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [dangerCountdown, onGameOver, revivalCoins, score]);

  // Pointer Movement Handlers
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scale = BOARD_WIDTH / rect.width;
    const clientX = e.clientX - rect.left;
    aimXRef.current = clientX * scale;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isPointerDownRef.current = true;
    handlePointerMove(e);
  };

  const handlePointerUp = () => {
    if (isPointerDownRef.current) {
      isPointerDownRef.current = false;
      dropCharacter();
    }
  };

  // Keyboard navigation: Left/Right arrow to adjust, Space to drop
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        aimXRef.current = Math.max(WALL_THICKNESS + 25, aimXRef.current - 18);
      } else if (e.key === 'ArrowRight') {
        aimXRef.current = Math.min(BOARD_WIDTH - WALL_THICKNESS - 25, aimXRef.current + 18);
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        dropCharacter();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dropCharacter]);

  return (
    <div ref={containerRef} className="relative flex flex-col items-center select-none touch-none">
      {/* Game Canvas Container */}
      <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-[#593016] p-1.5 border-4 border-[#8c532b]">
        <canvas
          ref={canvasRef}
          width={BOARD_WIDTH}
          height={BOARD_HEIGHT}
          onPointerMove={handlePointerMove}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          className="cursor-crosshair rounded-xl block max-w-full h-auto"
          style={{ width: BOARD_WIDTH, height: BOARD_HEIGHT }}
        />

        {/* Next character preview at top-right inside board */}
        <div className="absolute top-3 right-4 flex items-center gap-1.5 bg-amber-50/90 backdrop-blur-xs px-2.5 py-1 rounded-full shadow-sm border border-amber-200 pointer-events-none text-xs font-medium text-amber-900">
          <span>下一個:</span>
          <span className="text-base leading-none">{nextTierUI.emoji}</span>
        </div>

        {/* Revival Coin Emergency Prompt Overlay */}
        {showRevivePrompt && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center animate-fade-in z-20">
            <div className="bg-amber-50 rounded-2xl p-6 shadow-2xl max-w-xs border-2 border-amber-400">
              <div className="text-4xl mb-2">🪙</div>
              <h3 className="text-lg font-bold text-amber-950 mb-1">即將觸發遊戲結束！</h3>
              <p className="text-xs text-amber-800 mb-4">
                您目前擁有 <span className="font-bold text-emerald-600 text-sm">{revivalCoins}</span> 枚復活幣，立即使用清除頂部積壓的角色？
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleUseRevival}
                  className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-98 text-white font-bold text-sm shadow-md transition-transform"
                >
                  立即消耗 1 枚復活幣重生
                </button>
                <button
                  onClick={() => {
                    setShowRevivePrompt(false);
                    onGameOver(score, maxTierAchievedRef.current);
                  }}
                  className="w-full py-2 px-4 rounded-xl text-xs text-slate-500 hover:text-slate-700 transition-colors"
                >
                  放棄並結束遊戲
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Touch / Mouse Help Tip */}
      <div className="mt-2 text-center text-xs text-stone-500 font-medium">
        拖動或移動瞄準 · 點擊投放 · 空格鍵投放
      </div>
    </div>
  );
};
