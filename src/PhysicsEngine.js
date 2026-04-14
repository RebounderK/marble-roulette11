import Matter from 'matter-js';

const { Engine, Render, Runner, Bodies, Composite, Events, World, Body } = Matter;

export class PhysicsEngine {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.width = options.width || 600;
        this.height = options.height || 9500;
        this.onFinish = options.onFinish || (() => { });
        this.onLeaderboardUpdate = options.onLeaderboardUpdate || (() => { });

        this.engine = Engine.create();
        this.world = this.engine.world;
        this.engine.gravity.y = 1.6;

        this.render = Render.create({
            element: this.container,
            engine: this.engine,
            options: {
                width: this.width,
                height: 800,
                wireframes: false,
                background: 'transparent',
                pixelRatio: window.devicePixelRatio
            }
        });

        this.runner = Runner.create();
        this.marbles = [];
        this.rotatingBodies = [];
        this.isRacing = false;

        this.setupCamera();
        this.initEvents();
    }

    setupCamera() {
        Events.on(this.render, 'beforeRender', () => {
            if (!this.isRacing || this.marbles.length === 0) return;
            const topMarble = [...this.marbles].sort((a, b) => b.body.position.y - a.body.position.y)[0];
            if (topMarble) {
                const targetY = topMarble.body.position.y - 200;
                const currentY = this.render.bounds.min.y;
                const newY = currentY + (targetY - currentY) * 0.1;
                Render.lookAt(this.render, {
                    min: { x: 0, y: Math.max(0, newY) },
                    max: { x: this.width, y: Math.max(800, newY + 800) }
                });
            }
        });
    }

    drawRoundedRect(ctx, x, y, width, height, radius) {
        ctx.beginPath(); ctx.moveTo(x + radius, y); ctx.lineTo(x + width - radius, y); ctx.quadraticCurveTo(x + width, y, x + width, y + radius); ctx.lineTo(x + width, y + height - radius); ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height); ctx.lineTo(x + radius, y + height); ctx.quadraticCurveTo(x, y + height, x, y + height - radius); ctx.lineTo(x, y + radius); ctx.quadraticCurveTo(x, y, x + radius, y); ctx.closePath();
    }

    initEvents() {
        Events.on(this.render, 'afterRender', () => {
            const context = this.render.context;
            const { min, max } = this.render.bounds;
            const scaleX = this.render.options.width / (max.x - min.x);
            const scaleY = this.render.options.height / (max.y - min.y);
            context.save();
            context.font = 'bold 13px Arial, sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle';
            this.marbles.forEach(m => {
                const pos = m.body.position;
                const x = (pos.x - min.x) * scaleX;
                const y = (pos.y - min.y) * scaleY;
                const textWidth = context.measureText(m.name).width;
                const bgW = textWidth + 16, bgH = 20;
                context.fillStyle = 'rgba(0, 0, 0, 0.7)';
                this.drawRoundedRect(context, x - bgW / 2, y - 40, bgW, bgH, 5);
                context.fill();
                context.fillStyle = '#ffffff';
                context.fillText(m.name, x, y - 30);
            });
            context.restore();
        });

        Events.on(this.engine, 'collisionStart', (event) => {
            event.pairs.forEach((pair) => {
                const labels = [pair.bodyA.label, pair.bodyB.label];
                if (labels.includes('finish')) {
                    const marbleBody = pair.bodyA.label === 'marble' ? pair.bodyA : pair.bodyB;
                    const marble = this.marbles.find(m => m.body === marbleBody);
                    if (marble && !marble.finished) {
                        marble.finished = true;
                        this.onFinish(marble);
                    }
                }
            });
        });

        Events.on(this.engine, 'beforeUpdate', () => {
            this.rotatingBodies.forEach(entry => {
                Body.setAngle(entry.body, entry.body.angle + entry.speed);
            });
            if (this.isRacing) {
                this.marbles.forEach(m => {
                    if (!m.finished && Math.abs(m.body.velocity.x) < 0.2 && Math.abs(m.body.velocity.y) < 0.5) {
                        Body.applyForce(m.body, m.body.position, { x: (Math.random() - 0.5) * 0.012, y: -0.002 });
                    }
                });
            }
        });

        setInterval(() => {
            if (this.isRacing) {
                // Send CURRENT active ranks to main.js
                const activeRanks = [...this.marbles]
                    .filter(m => !m.finished)
                    .sort((a, b) => b.body.position.y - a.body.position.y);
                this.onLeaderboardUpdate(activeRanks);
            }
        }, 500);
    }

    addExitFunnel() {
        const wallOptions = { isStatic: true, restitution: 0.9, render: { fillStyle: '#111', strokeStyle: '#00f2ff', lineWidth: 2 } };
        const funnelY = this.height - 700;
        const gap = 110;
        World.add(this.world, [
            Bodies.rectangle(this.width / 2 - 250, funnelY, 450, 40, { ...wallOptions, angle: 0.7, chamfer: { radius: 20 } }),
            Bodies.rectangle(this.width / 2 + 250, funnelY, 450, 40, { ...wallOptions, angle: -0.7, chamfer: { radius: 20 } }),
            Bodies.rectangle(this.width / 2 - gap / 2 - 20, funnelY + 350, 40, 600, { ...wallOptions, chamfer: { radius: 20 } }),
            Bodies.rectangle(this.width / 2 + gap / 2 + 20, funnelY + 350, 40, 600, { ...wallOptions, chamfer: { radius: 20 } }),
            Bodies.circle(this.width / 2 - 120, funnelY + 100, 40, wallOptions),
            Bodies.circle(this.width / 2 + 120, funnelY + 100, 40, wallOptions)
        ]);
        this.createRotatingCross(this.width / 2, funnelY - 200, 0.012, 300, 24);
    }

    createRotatingCross(x, y, speed, size = 150, thickness = 18) {
        const wallOptions = { isStatic: true, restitution: 0.9, render: { fillStyle: '#1a1a2e', strokeStyle: '#00f2ff', lineWidth: 2 } };
        const body1 = Bodies.rectangle(x, y, size, thickness, wallOptions);
        const body2 = Bodies.rectangle(x, y, thickness, size, wallOptions);
        const cross = Body.create({ parts: [body1, body2], isStatic: true, label: 'obstacle' });
        World.add(this.world, cross);
        this.rotatingBodies.push({ body: cross, speed });
        return cross;
    }

    generateTrack(mapType) {
        World.clear(this.world, false);
        this.marbles = []; this.rotatingBodies = [];
        const wallOptions = { isStatic: true, render: { fillStyle: '#0a0a1f', strokeStyle: '#00f2ff', lineWidth: 6 } };
        World.add(this.world, [
            Bodies.rectangle(this.width / 2, -30, this.width, 60, wallOptions),
            Bodies.rectangle(-15, this.height / 2, 30, this.height, wallOptions),
            Bodies.rectangle(this.width + 15, this.height / 2, 30, this.height, wallOptions),
            Bodies.rectangle(this.width / 2, this.height + 30, this.width, 60, { ...wallOptions, label: 'finish' })
        ]);
        this.addExitFunnel();
        this.generateMegaTrack();
        World.add(this.world, Bodies.rectangle(this.width / 2, this.height - 100, this.width, 40, {
            isStatic: true, isSensor: true, label: 'finish',
            render: { fillStyle: 'rgba(204, 255, 0, 0.1)', strokeStyle: '#ccff00', lineWidth: 4 }
        }));
    }

    generateMegaTrack() {
        const zoneHeight = 900;
        const totalZones = Math.floor((this.height - 1400) / zoneHeight);
        for (let zone = 0; zone < totalZones; zone++) {
            const startY = 500 + zone * zoneHeight;
            const endY = startY + zoneHeight;
            const style = Math.floor(Math.random() * 5);
            switch (style) {
                case 0: this.createRotatingZone(startY, endY, 7); break;
                case 1: this.createChokePoint(startY, endY); break;
                case 2: this.createSplitPath(startY, endY); break;
                case 3: this.createRampZone(startY, endY, 4); break;
                case 4: this.createMixZone(startY, endY, 15); break;
            }
        }
    }

    createChokePoint(startY, endY) {
        const midY = (startY + endY) / 2;
        const gap = 180 + Math.random() * 80;
        const wallOptions = { isStatic: true, chamfer: { radius: 15 }, render: { fillStyle: '#111', strokeStyle: '#00f2ff', lineWidth: 2 } };
        World.add(this.world, [
            Bodies.rectangle(this.width / 2 - gap / 2 - 150, midY, 300, 50 + Math.random() * 20, { ...wallOptions, angle: 0.15 }),
            Bodies.rectangle(this.width / 2 + gap / 2 + 150, midY, 300, 50 + Math.random() * 20, { ...wallOptions, angle: -0.15 })
        ]);
        this.createRotatingCross(this.width / 2, midY, 0.03 + Math.random() * 0.03, 100 + Math.random() * 40, 16);
    }

    createSplitPath(startY, endY) {
        const midY = (startY + endY) / 2;
        const wallOptions = { isStatic: true, render: { fillStyle: '#050505', strokeStyle: '#0072ff', lineWidth: 2 } };
        const centerSize = 180 + Math.random() * 60;
        World.add(this.world, Bodies.rectangle(this.width / 2, midY, centerSize, centerSize, {
            ...wallOptions, angle: Math.PI / 4, chamfer: { radius: 40 }
        }));
        this.createRotatingCross(110, midY - 100, 0.04, 120, 14);
        this.createRotatingCross(490, midY + 100, -0.04, 120, 14);
    }

    createRotatingZone(startY, endY, count) {
        for (let i = 0; i < count; i++) {
            const x = Math.random() * (this.width - 240) + 120;
            const y = startY + (i * (endY - startY) / count) + (Math.random() - 0.5) * 50;
            const size = 120 + Math.random() * 160;
            const thickness = 14 + Math.random() * 12;
            const speed = (0.025 + Math.random() * 0.045) * (Math.random() > 0.5 ? 1 : -1);
            this.createRotatingCross(x, y, speed, size, thickness);
        }
    }

    createRampZone(startY, endY, count) {
        const step = (endY - startY) / count;
        for (let i = 0; i < count; i++) {
            const isLeft = i % 2 === 0;
            const y = startY + i * step;
            const angle = 0.4 + Math.random() * 0.2;
            World.add(this.world, Bodies.rectangle(isLeft ? 160 : 440, y, 400 + Math.random() * 100, 45, {
                isStatic: true, angle: isLeft ? angle : -angle, restitution: 1, chamfer: { radius: 10 },
                render: { fillStyle: '#111', strokeStyle: '#00f2ff', lineWidth: 2 }
            }));
            this.createRotatingCross(isLeft ? 520 : 80, y + 200, isLeft ? -0.05 : 0.05, 160 + Math.random() * 60, 20);
        }
    }

    createMixZone(startY, endY, count) {
        for (let i = 0; i < count; i++) {
            const x = Math.random() * this.width;
            const y = startY + Math.random() * (endY - startY);
            if (Math.random() > 0.5) {
                const size = 100 + Math.random() * 140;
                const speed = (0.02 + Math.random() * 0.05) * (Math.random() > 0.5 ? 1 : -1);
                this.createRotatingCross(x, y, speed, size, 16);
            } else {
                World.add(this.world, Bodies.circle(x, y, 14 + Math.random() * 8, {
                    isStatic: true, render: { fillStyle: '#1a1a2e', strokeStyle: '#0072ff', lineWidth: 2 }
                }));
            }
        }
    }

    startRace(names) {
        this.isRacing = true;
        const colors = ['#00f2ff', '#7000ff', '#ff00c8', '#ffea00', '#00ff73', '#ff6a00', '#ffffff'];
        names.forEach((name, i) => {
            const marbleColor = colors[i % colors.length];
            const body = Bodies.circle((this.width / (names.length + 1)) * (i + 1), 150, 16, {
                restitution: 0.9, friction: 0.001, label: 'marble',
                render: { fillStyle: marbleColor, strokeStyle: '#fff', lineWidth: 3 }
            });
            this.marbles.push({ name, body, finished: false, color: marbleColor });
        });
        World.add(this.world, this.marbles.map(m => m.body));
        Runner.run(this.runner, this.engine);
        Render.run(this.render);
    }

    reset() {
        this.isRacing = false; this.marbles = []; this.rotatingBodies = [];
        Runner.stop(this.runner); Render.stop(this.render); World.clear(this.world, false);
        Render.lookAt(this.render, { min: { x: 0, y: 0 }, max: { x: this.width, y: 800 } });
    }
}
