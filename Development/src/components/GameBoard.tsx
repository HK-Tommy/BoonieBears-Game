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
const BOARD_HEIGHT = 640;
const DANGER_Y = 115;
const DROP_Y = 52;
const WALL_THICKNESS = 16;
const BOUNDARY_THICKNESS = 120; // Extra thick static boundaries to prevent tunneling

// Elastic spring easing for juicy entrance animation
function getSpringScale(t: number): number {
  if (t >= 1) return 1;
  if (t <= 0) return 0.2;
  const c4 = (2 * Math.PI) / 3;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

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

  // Keep latest callbacks and props in refs so physics and render loops NEVER need to reset!
  const onScoreUpdateRef = useRef(onScoreUpdate);
  onScoreUpdateRef.current = onScoreUpdate;
  const onRevivalEarnedRef = useRef(onRevivalEarned);
  onRevivalEarnedRef.current = onRevivalEarned;
  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;
  const scoreRef = useRef(score);
  scoreRef.current = score;
  const revivalCoinsRef = useRef(revivalCoins);
  revivalCoinsRef.current = revivalCoins;

  // Matter engine refs
  const engineRef = useRef<Matter.Engine | null>(null);
  const worldRef = useRef<Matter.World | null>(null);
  const requestRef = useRef<number | null>(null);

  // Game state refs
  const aimXRef = useRef<number>(BOARD_WIDTH / 2);
  const isPointerDownRef = useRef<boolean>(false);
  const canDropRef = useRef<boolean>(true);
  const maxTierAchievedRef = useRef<number>(1);
  const currentTierRef = useRef<CharacterTier>(CHARACTER_TIERS[0]);
  const nextTierRef = useRef<CharacterTier>(CHARACTER_TIERS[0]);
  const imagesMapRef = useRef<Map<number, HTMLImageElement>>(new Map());

  // Tactile Drop Entrance Animation Progress (0 to 1)
  const aimEntranceProgressRef = useRef<number>(1);

  // Particles & Floating text
  const particlesRef = useRef<Particle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);

  // Danger tracking
  const dangerTimerRef = useRef<number>(0);
  const isDangerActiveRef = useRef<boolean>(false);
  const [dangerCountdown, setDangerCountdown] = useState<number | null>(null);

  // Combo tracking
  const comboCountRef = useRef<number>(0);
  const lastMergeTimeRef = useRef<number>(0);

  // Set of body IDs currently undergoing merge (prevents duplicate triggers)
  const mergingBodyIdsRef = useRef<Set<number>>(new Set());

  // UI state for previews
  const [currentTierUI, setCurrentTierUI] = useState<CharacterTier>(CHARACTER_TIERS[0]);
  const [nextTierUI, setNextTierUI] = useState<CharacterTier>(CHARACTER_TIERS[0]);
  const [nextAnimKey, setNextAnimKey] = useState<number>(0);
  const [showRevivePrompt, setShowRevivePrompt] = useState<boolean>(false);

  // Progressive Drop Algorithm:
  // Strictly drops characters of tier <= maxTierAchieved (never above!)
  const getRandomTier = useCallback((maxUnlocked: number): CharacterTier => {
    const limit = Math.max(1, Math.min(CHARACTER_TIERS.length, maxUnlocked));
    if (limit === 1) {
      return CHARACTER_TIERS[0];
    }

    const weights: number[] = [];
    let sum = 0;
    for (let i = 0; i < limit; i++) {
      const w = Math.pow(0.72, i);
      weights.push(w);
      sum += w;
    }

    let r = Math.random() * sum;
    for (let i = 0; i < limit; i++) {
      if (r < weights[i]) {
        return CHARACTER_TIERS[i];
      }
      r -= weights[i];
    }

    return CHARACTER_TIERS[limit - 1];
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

  // Initialize initial tiers (starting at tier 1)
  useEffect(() => {
    maxTierAchievedRef.current = 1;
    const initialCurrent = CHARACTER_TIERS[0];
    const initialNext = CHARACTER_TIERS[0];
    currentTierRef.current = initialCurrent;
    nextTierRef.current = initialNext;
    setCurrentTierUI(initialCurrent);
    setNextTierUI(initialNext);
    aimEntranceProgressRef.current = 0;
  }, []);

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

    const allBodies = Matter.Composite.allBodies(world);
    let removedCount = 0;

    allBodies.forEach((body) => {
      if (body.isStatic) return;
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
    if (revivalCoinsRef.current > 0 && onUseRevivalCoin()) {
      triggerRevivalBlast();
    }
  }, [onUseRevivalCoin, triggerRevivalBlast]);

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

    // Spawn subtle soft puff at drop origin
    spawnParticles(clampedX, DROP_Y, tierData.color, 6);

    // After 1 second, remove "justSpawned" flag
    setTimeout(() => {
      const data = (ball as unknown as { customData?: { justSpawned: boolean } }).customData;
      if (data) {
        data.justSpawned = false;
      }
    }, 1000);

    // Prepare next character based on current maxTierAchieved
    currentTierRef.current = nextTierRef.current;
    setCurrentTierUI(nextTierRef.current);
    aimEntranceProgressRef.current = 0; // Trigger elastic entrance animation!

    const newNext = getRandomTier(maxTierAchievedRef.current);
    nextTierRef.current = newNext;
    setNextTierUI(newNext);
    setNextAnimKey((prev) => prev + 1);

    // Cooldown before next drop allowed
    setTimeout(() => {
      canDropRef.current = true;
    }, 400);
  }, [getRandomTier]);

  // Initialize Matter.js Physics Engine ONCE on mount
  // (Empty dependency array ensures the world and existing characters are NEVER cleared mid-game!)
  useEffect(() => {
    const engine = Matter.Engine.create({
      gravity: { x: 0, y: 1.18 },
      positionIterations: 10,
      velocityIterations: 10,
    });
    const world = engine.world;
    engineRef.current = engine;
    worldRef.current = world;

    // Thick boundaries (120px deep) prevent any high-speed body tunneling/disappearing!
    const ground = Matter.Bodies.rectangle(
      BOARD_WIDTH / 2,
      BOARD_HEIGHT + BOUNDARY_THICKNESS / 2 - 6,
      BOARD_WIDTH * 2,
      BOUNDARY_THICKNESS,
      {
        isStatic: true,
        friction: 0.6,
        restitution: 0.12,
        label: 'boundary_ground',
      }
    );

    const leftWall = Matter.Bodies.rectangle(
      WALL_THICKNESS - BOUNDARY_THICKNESS / 2,
      BOARD_HEIGHT / 2,
      BOUNDARY_THICKNESS,
      BOARD_HEIGHT * 2,
      {
        isStatic: true,
        friction: 0.35,
        restitution: 0.15,
        label: 'boundary_left',
      }
    );

    const rightWall = Matter.Bodies.rectangle(
      BOARD_WIDTH - WALL_THICKNESS + BOUNDARY_THICKNESS / 2,
      BOARD_HEIGHT / 2,
      BOUNDARY_THICKNESS,
      BOARD_HEIGHT * 2,
      {
        isStatic: true,
        friction: 0.35,
        restitution: 0.15,
        label: 'boundary_right',
      }
    );

    Matter.World.add(world, [ground, leftWall, rightWall]);

    // Precise Collision Handling: ONLY merge the two colliding bodies, NEVER destroy others!
    Matter.Events.on(engine, 'collisionStart', (event) => {
      const pairs = event.pairs;

      for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i];
        const bodyA = pair.bodyA as Matter.Body & { customData?: { tier: number; isMerged: boolean; id: string } };
        const bodyB = pair.bodyB as Matter.Body & { customData?: { tier: number; isMerged: boolean; id: string } };

        if (!bodyA.customData || !bodyB.customData) {
          const dynamicBody = bodyA.customData ? bodyA : bodyB.customData ? bodyB : null;
          if (dynamicBody) {
            soundManager.playBounce(dynamicBody.customData?.tier || 1);
          }
          continue;
        }

        // Check if both are strictly the same tier, and neither is already being merged
        if (
          bodyA.customData.tier === bodyB.customData.tier &&
          !bodyA.customData.isMerged &&
          !bodyB.customData.isMerged &&
          !mergingBodyIdsRef.current.has(bodyA.id) &&
          !mergingBodyIdsRef.current.has(bodyB.id)
        ) {
          // Lock these two specific bodies immediately
          bodyA.customData.isMerged = true;
          bodyB.customData.isMerged = true;
          mergingBodyIdsRef.current.add(bodyA.id);
          mergingBodyIdsRef.current.add(bodyB.id);

          const tier = bodyA.customData.tier;
          const midX = (bodyA.position.x + bodyB.position.x) / 2;
          const midY = (bodyA.position.y + bodyB.position.y) / 2;

          // Process the merge safely: strictly remove ONLY bodyA and bodyB!
          setTimeout(() => {
            if (!worldRef.current) return;

            // Remove strictly ONLY bodyA and bodyB from the world
            Matter.World.remove(worldRef.current, bodyA);
            Matter.World.remove(worldRef.current, bodyB);
            mergingBodyIdsRef.current.delete(bodyA.id);
            mergingBodyIdsRef.current.delete(bodyB.id);

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

            // Update unlocked tier progression
            const nextTierNum = tier < MAX_TIER ? tier + 1 : MAX_TIER;
            const isNewUnlock = nextTierNum > maxTierAchievedRef.current;
            if (isNewUnlock) {
              maxTierAchievedRef.current = nextTierNum;
            }
            onScoreUpdateRef.current(pointsAwarded, maxTierAchievedRef.current);

            // Visual effects
            const tierColor = currentTierConfig ? currentTierConfig.color : '#f59e0b';
            spawnParticles(midX, midY, tierColor, 20);

            let floatingMsg = `+${pointsAwarded}`;
            if (comboCountRef.current > 1) {
              floatingMsg += ` (Combo x${comboCountRef.current}!)`;
              soundManager.playCombo(comboCountRef.current);
            }
            addFloatingText(midX, midY - 20, floatingMsg, comboCountRef.current > 1 ? '#ef4444' : tierColor);

            if (tier < MAX_TIER) {
              // Spawn ONLY the single next-tier body at collision midpoint
              const newTierConfig = CHARACTER_TIERS[tier];
              const newBody = Matter.Bodies.circle(midX, midY, newTierConfig.radius, {
                restitution: 0.18,
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

              if (isNewUnlock) {
                addFloatingText(midX, midY - 45, `✨ 解鎖【${newTierConfig.name}】！已加入掉落隊列`, '#10b981');
              }

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
              onScoreUpdateRef.current(500, MAX_TIER);
              onRevivalEarnedRef.current();
              addFloatingText(midX, midY - 40, '✨ 終極合體！+500分 & 獲得復活幣！', '#ffd700');
              confetti({
                particleCount: 100,
                spread: 100,
                origin: { x: 0.5, y: 0.5 },
              });
            }
          }, 0);
        } else {
          soundManager.playBounce(bodyA.customData?.tier || 1);
        }
      }
    });

    return () => {
      Matter.World.clear(world, false);
      Matter.Engine.clear(engine);
    };
  }, []); // Mount ONCE! NEVER clear world during game session!

  // Main Render Loop (Mount ONCE, uses refs to avoid resetting)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const dt = Math.min((currentTime - lastTime) / 1000, 0.033);
      lastTime = currentTime;

      // Update aim entrance animation progress
      if (aimEntranceProgressRef.current < 1) {
        aimEntranceProgressRef.current = Math.min(1, aimEntranceProgressRef.current + dt * 4.2);
      }

      // Update Matter physics
      if (engineRef.current) {
        Matter.Engine.update(engineRef.current, 1000 / 60);
      }

      // Physics boundary safety check & danger line tracking
      if (worldRef.current) {
        const bodies = Matter.Composite.allBodies(worldRef.current);
        let hasBodyInDanger = false;

        for (let i = 0; i < bodies.length; i++) {
          const body = bodies[i];
          if (body.isStatic) continue;

          const data = (body as unknown as { customData?: { tier: number; justSpawned: boolean } }).customData;
          if (!data) continue;

          const radius = (body as { circleRadius?: number }).circleRadius || 20;

          // Boundary Guard: Clamp bodies within boundaries, never let them escape!
          const minSafeX = WALL_THICKNESS + radius;
          const maxSafeX = BOARD_WIDTH - WALL_THICKNESS - radius;
          const maxSafeY = BOARD_HEIGHT - 6 - radius;

          if (body.position.x < minSafeX || body.position.x > maxSafeX || body.position.y > maxSafeY) {
            Matter.Body.setPosition(body, {
              x: Math.max(minSafeX, Math.min(maxSafeX, body.position.x)),
              y: Math.min(maxSafeY, body.position.y),
            });
            Matter.Body.setVelocity(body, {
              x: body.velocity.x * 0.5,
              y: Math.min(0, body.velocity.y),
            });
          }

          if (data.justSpawned) continue;

          const topEdge = body.position.y - radius;
          if (topEdge < DANGER_Y && Math.abs(body.velocity.y) < 0.22 && Math.abs(body.velocity.x) < 0.22) {
            hasBodyInDanger = true;
          }
        }

        if (hasBodyInDanger) {
          isDangerActiveRef.current = true;
          dangerTimerRef.current += dt;
          const timeLeft = Math.max(0, 3.0 - dangerTimerRef.current);
          setDangerCountdown(Math.ceil(timeLeft));

          if (dangerTimerRef.current >= 3.0) {
            if (revivalCoinsRef.current > 0) {
              setShowRevivePrompt(true);
            } else {
              onGameOverRef.current(scoreRef.current, maxTierAchievedRef.current);
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
      ctx.fillRect(WALL_THICKNESS, 0, BOARD_WIDTH - WALL_THICKNESS * 2, BOARD_HEIGHT - 6);

      // Subtle horizontal floor grid lines
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
        ctx.strokeStyle = isDangerActiveRef.current ? 'rgba(239, 68, 68, 0.45)' : 'rgba(217, 119, 6, 0.4)';
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

      ctx.font = '500 11px sans-serif';
      ctx.fillStyle = isDanger ? '#ef4444' : '#c27e53';
      ctx.textAlign = 'right';
      ctx.fillText(isDanger ? `⚠️ 警戒中 (${dangerCountdown}s)` : '警戒線', BOARD_WIDTH - WALL_THICKNESS - 8, DANGER_Y - 6);
      ctx.restore();

      // 4. Render All Physics Bodies: DIRECT CHARACTER BODY CUTOUT
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

          // Soft natural drop shadow under the character torso/body
          ctx.shadowColor = 'rgba(0, 0, 0, 0.22)';
          ctx.shadowBlur = Math.max(4, radius * 0.15);
          ctx.shadowOffsetY = Math.max(2, radius * 0.1);

          if (img && img.complete && img.naturalWidth > 0 && tierNum !== 6) {
            const aspect = img.naturalWidth / img.naturalHeight;
            let drawW = radius * 2.25;
            let drawH = drawW / aspect;
            if (drawH > radius * 2.6) {
              drawH = radius * 2.6;
              drawW = drawH * aspect;
            }
            ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
          } else {
            ctx.font = `${Math.round(radius * 1.7)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(tierConfig.emoji, 0, 0);

            ctx.font = `bold ${Math.max(10, Math.round(radius * 0.32))}px sans-serif`;
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = 'rgba(0,0,0,0.6)';
            ctx.lineWidth = 2.5;
            ctx.strokeText(tierConfig.name, 0, radius * 0.65);
            ctx.fillText(tierConfig.name, 0, radius * 0.65);
          }

          ctx.restore();
        });
      }

      // 5. Draw Currently Aimed Character at the top with ELASTIC SCALE-IN ENTRANCE ANIMATION
      if (canDropRef.current) {
        const curTier = currentTierRef.current;
        const minX = WALL_THICKNESS + curTier.radius + 2;
        const maxX = BOARD_WIDTH - WALL_THICKNESS - curTier.radius - 2;
        const clampedAimX = Math.max(minX, Math.min(maxX, aimXRef.current));
        const img = imagesMapRef.current.get(curTier.tier);

        // Calculate elastic spring entrance scale
        const entranceScale = getSpringScale(aimEntranceProgressRef.current);

        // Gentle breathing float effect
        const floatY = DROP_Y + Math.sin(currentTime * 0.005) * 2;

        ctx.save();
        ctx.translate(clampedAimX, floatY);

        // Soft target glow under the character while aiming
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, curTier.radius * entranceScale * 1.08, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();

        ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 4;

        if (img && img.complete && img.naturalWidth > 0 && curTier.tier !== 6) {
          const aspect = img.naturalWidth / img.naturalHeight;
          let drawW = curTier.radius * 2.25 * entranceScale;
          let drawH = drawW / aspect;
          if (drawH > curTier.radius * 2.6 * entranceScale) {
            drawH = curTier.radius * 2.6 * entranceScale;
            drawW = drawH * aspect;
          }
          ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
        } else {
          ctx.font = `${Math.round(curTier.radius * 1.7 * entranceScale)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(curTier.emoji, 0, 0);
        }

        ctx.restore();
      }

      // 6. Draw Left, Right and Bottom Wooden Bevel Frame
      const woodGrad = ctx.createLinearGradient(0, 0, WALL_THICKNESS, 0);
      woodGrad.addColorStop(0, '#8c532b');
      woodGrad.addColorStop(0.5, '#ba7a48');
      woodGrad.addColorStop(1, '#8c532b');

      ctx.fillStyle = woodGrad;
      ctx.fillRect(0, 0, WALL_THICKNESS, BOARD_HEIGHT);
      ctx.fillRect(BOARD_WIDTH - WALL_THICKNESS, 0, WALL_THICKNESS, BOARD_HEIGHT);
      ctx.fillRect(0, BOARD_HEIGHT - 10, BOARD_WIDTH, 10);

      // Bevel highlights
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.fillRect(WALL_THICKNESS - 2, 0, 2, BOARD_HEIGHT);
      ctx.fillRect(BOARD_WIDTH - WALL_THICKNESS, 0, 2, BOARD_HEIGHT);

      // 7. Update and Draw Particles
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.12;
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
        ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
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
  }, []); // Mount ONCE! Continuous render loop!

  // Touch & Pointer Movement Handlers
  const updateAimPosition = (clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scale = BOARD_WIDTH / rect.width;
    aimXRef.current = (clientX - rect.left) * scale;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    updateAimPosition(e.clientX);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isPointerDownRef.current = true;
    updateAimPosition(e.clientX);
  };

  const handlePointerUp = () => {
    if (isPointerDownRef.current) {
      isPointerDownRef.current = false;
      dropCharacter();
    }
  };

  const handlePointerCancel = () => {
    isPointerDownRef.current = false;
  };

  // Keyboard navigation
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
    <div ref={containerRef} className="relative w-full flex flex-col items-center select-none touch-none">
      {/* Responsive Canvas Frame */}
      <div className="relative w-full max-w-[420px] aspect-[420/640] max-h-[calc(100dvh-130px)] rounded-2xl overflow-hidden shadow-2xl bg-[#593016] p-1.5 border-4 border-[#8c532b] flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={BOARD_WIDTH}
          height={BOARD_HEIGHT}
          onPointerMove={handlePointerMove}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          className="cursor-crosshair rounded-xl block w-full h-full object-contain touch-none"
        />

        {/* Next character preview at top-right with Spring Pop tactile animation */}
        <div
          key={nextAnimKey}
          className="animate-spring-pop absolute top-2.5 right-3.5 flex items-center gap-1.5 bg-amber-50/95 backdrop-blur-xs px-2.5 py-1 rounded-full shadow-sm border border-amber-300 pointer-events-none text-xs font-semibold text-amber-950"
        >
          <span>下一個:</span>
          {nextTierUI.tier !== 6 ? (
            <img
              src={nextTierUI.image}
              alt={nextTierUI.name}
              className="w-5 h-5 object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : null}
          <span className="text-sm leading-none">{nextTierUI.emoji}</span>
        </div>

        {/* Revival Coin Emergency Prompt Overlay */}
        {showRevivePrompt && (
          <div className="absolute inset-0 bg-black/65 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center animate-fade-in z-20">
            <div className="bg-amber-50 rounded-2xl p-5 shadow-2xl max-w-xs border-2 border-amber-400">
              <div className="text-4xl mb-2">🪙</div>
              <h3 className="text-base font-bold text-amber-950 mb-1">即將觸發遊戲結束！</h3>
              <p className="text-xs text-amber-800 mb-4">
                您目前擁有 <span className="font-bold text-emerald-600 text-sm">{revivalCoins}</span> 枚復活幣，立即使用清除頂部障礙？
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleUseRevival}
                  className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-98 text-white font-bold text-xs shadow-md transition-transform"
                >
                  立即消耗 1 枚復活幣重生
                </button>
                <button
                  onClick={() => {
                    setShowRevivePrompt(false);
                    onGameOverRef.current(scoreRef.current, maxTierAchievedRef.current);
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

      {/* Touch / Mouse Guide Tip */}
      <div className="mt-1.5 text-center text-[11px] sm:text-xs text-stone-500 font-medium">
        拖動或移動瞄準 · 鬆手投放 · 空格鍵投放
      </div>
    </div>
  );
};
