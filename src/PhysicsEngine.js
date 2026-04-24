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
        this.swingingBats = [];
        this.fireBlowers = [];
        this.isRacing = false;

        this.setupCamera();
        this.initEvents();
    }

    setupCamera() {
        Events.on(this.render, 'beforeRender', () => {
            if (!this.isRacing || this.marbles.length === 0) return;
            
            // 너무 멀리 떨어진 공(맵 이탈 버그)은 카메라 추적에서 제외
            const validMarbles = this.marbles.filter(m => m.body.position.y < this.height + 150);
            if (validMarbles.length === 0) return;

            const topMarble = [...validMarbles].sort((a, b) => b.body.position.y - a.body.position.y)[0];
            if (topMarble) {
                const targetY = topMarble.body.position.y - 200;
                const currentY = this.render.bounds.min.y;
                let newY = currentY + (targetY - currentY) * 0.1;

                // 카메라가 결승점(바닥) 아래로 무한정 내려가는 것 방지
                const maxY = this.height - 800; // 화면 높이(800) 기준 하단 한계
                if (newY > maxY) newY = maxY;

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
            const time = this.engine.timing.timestamp;
            
            this.rotatingBodies.forEach(entry => {
                Body.setAngle(entry.body, entry.body.angle + entry.speed);
            });
            
            if (this.swingingBats) {
                this.swingingBats.forEach(bat => {
                    const angle = Math.sin(time * bat.speed) * bat.range + bat.baseAngle;
                    const angularVelocity = (angle - bat.body.angle);
                    Body.setAngle(bat.body, angle);
                    Body.setAngularVelocity(bat.body, angularVelocity);
                    
                    const offsetX = Math.cos(angle) * (bat.length / 2);
                    const offsetY = Math.sin(angle) * (bat.length / 2);
                    Body.setPosition(bat.body, { x: bat.pivotX + offsetX, y: bat.pivotY + offsetY });
                });
            }

            if (this.fireBlowers && this.isRacing) {
                this.fireBlowers.forEach(blower => {
                    this.marbles.forEach(m => {
                        if (!m.finished && Matter.Bounds.overlaps(blower.bounds, m.body.bounds)) {
                            if (Matter.Vertices.contains(blower.vertices, m.body.position)) {
                                Body.applyForce(m.body, m.body.position, blower.forceFn());
                            }
                        }
                    });
                });
            }
            if (this.isRacing) {
                this.marbles.forEach(m => {
                    if (!m.finished) {
                        // 벽을 뚫고 맵 밖으로 끝없이 추락하는 공을 강제 완료 처리 (경기가 안 끝나는 버그 방지)
                        if (m.body.position.y > this.height + 150) {
                            m.finished = true;
                            this.onFinish(m);
                        } else if (Math.abs(m.body.velocity.x) < 0.2 && Math.abs(m.body.velocity.y) < 0.5) {
                            Body.applyForce(m.body, m.body.position, { x: (Math.random() - 0.5) * 0.012, y: -0.002 });
                        }
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
        const wallOptions = { isStatic: true, restitution: 0.5, render: { fillStyle: '#050510', strokeStyle: '#00f2ff', lineWidth: 3 } };
        const gap = 130;
        const tubeWidth = (this.width / 2) - (gap / 2) + 60;
        const topH = 450;
        const straightH = 400; // 직선 하강 구간 
        const flareH = 200;    // 넓어지는 구간
        const botH = straightH + flareH;

        // 골인지점으로 갈수록 양옆으로 여유공간이 열리게 만든 좌측 벽 폴리곤
        const leftCurve = [
            { x: 0, y: 0 },
            { x: 0, y: topH + botH },
            { x: tubeWidth - 120, y: topH + botH }, // 밖으로 120만큼 열림
            { x: tubeWidth, y: topH + straightH },  // 여기서부터 열리기 시작
            { x: tubeWidth, y: topH }
        ];

        // 골인지점으로 갈수록 양옆으로 여유공간이 열리게 만든 우측 벽 폴리곤
        const rightCurve = [
            { x: 0, y: topH },
            { x: 0, y: topH + straightH }, // 여기서부터 열리기 시작
            { x: 120, y: topH + botH },    // 밖으로 120만큼 열림
            { x: tubeWidth, y: topH + botH },
            { x: tubeWidth, y: 0 }
        ];

        const leftBody = Bodies.fromVertices(0, 0, [leftCurve], {
            ...wallOptions,
            chamfer: { radius: 60 }
        });

        const rightBody = Bodies.fromVertices(0, 0, [rightCurve], {
            ...wallOptions,
            chamfer: { radius: 60 }
        });

        const targetLeftRightEdge = this.width / 2 - gap / 2;
        const targetRightLeftEdge = this.width / 2 + gap / 2;
        // 바닥 충돌 전선 위에 여유있게 위치시킴
        const targetBottomEdge = this.height - 20; 
        const funnelCornerY = targetBottomEdge - botH;

        Matter.Body.setPosition(leftBody, {
            x: leftBody.position.x + (targetLeftRightEdge - leftBody.bounds.max.x),
            y: leftBody.position.y + (targetBottomEdge - leftBody.bounds.max.y)
        });

        Matter.Body.setPosition(rightBody, {
            x: rightBody.position.x + (targetRightLeftEdge - rightBody.bounds.min.x),
            y: rightBody.position.y + (targetBottomEdge - rightBody.bounds.max.y)
        });

        World.add(this.world, [leftBody, rightBody]);

        // 긴 일자 형태로 퍼올리는 기둥 (십자가 대신)
        this.createRotatingBar(this.width / 2, funnelCornerY + 15, 0.04, 200, 26);
    }

    createRotatingBar(x, y, speed, length = 160, thickness = 26) {
        const wallOptions = { isStatic: true, restitution: 0.8, render: { fillStyle: '#1a1a2e', strokeStyle: '#ff0055', lineWidth: 3 } };
        const bar = Bodies.rectangle(x, y, length, thickness, { ...wallOptions, chamfer: { radius: 10 }, label: 'obstacle' });
        World.add(this.world, bar);
        this.rotatingBodies.push({ body: bar, speed });
        return bar;
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
        this.swingingBats = []; this.fireBlowers = [];
        const wallOptions = { isStatic: true, render: { fillStyle: '#0a0a1f', strokeStyle: '#00f2ff', lineWidth: 6 } };
        World.add(this.world, [
            Bodies.rectangle(this.width / 2, -30, this.width * 3, 60, wallOptions),
            Bodies.rectangle(-250, this.height / 2, 500, this.height * 2, wallOptions), // 양옆 벽을 아주 두껍게 하여 뚫고 나가는 버그 방지
            Bodies.rectangle(this.width + 250, this.height / 2, 500, this.height * 2, wallOptions),
            Bodies.rectangle(this.width / 2, this.height + 100, this.width * 3, 200, { ...wallOptions, label: 'finish' }) // 바닥을 더 두껍고 넓게
        ]);
        this.addExitFunnel();
        
        if (mapType === 'hell') {
            this.generateHellTrack();
        } else {
            this.generateMegaTrack();
        }

        World.add(this.world, Bodies.rectangle(this.width / 2, this.height - 100, this.width * 3, 40, {
            isStatic: true, isSensor: true, label: 'finish', // 센서도 양옆으로 훨씬 넓게
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

    createSwingingBat(x, y, options = {}) {
        const speed = options.speed || 0.005;
        const range = options.range || Math.PI / 1.5;
        const length = options.length || 200;
        const width = options.width || 24;
        const baseAngle = options.baseAngle || 0;
        
        const wallOptions = { isStatic: true, restitution: 0.9, friction: 0, render: { fillStyle: '#2a1a1e', strokeStyle: '#ff003c', lineWidth: 3 } };
        const bat = Bodies.rectangle(x, y, length, width, { ...wallOptions, label: 'obstacle' });
        
        World.add(this.world, bat);
        this.swingingBats.push({ body: bat, speed, range, baseAngle, pivotX: x, pivotY: y, length });
        return bat;
    }

    createFireBlower(x, y, width, height, forceFn) {
        const fireOptions = { 
            isStatic: true, 
            isSensor: true, 
            render: { fillStyle: 'rgba(255, 69, 0, 0.4)', strokeStyle: '#ff4500', lineWidth: 2 } 
        };
        const blower = Bodies.rectangle(x, y, width, height, fireOptions);
        World.add(this.world, blower);
        this.fireBlowers.push({
            bounds: blower.bounds,
            vertices: blower.vertices,
            forceFn: forceFn
        });
        return blower;
    }

    generateHellTrack() {
        const zoneHeight = 900;
        const totalZones = Math.floor((this.height - 1400) / zoneHeight);
        
        for (let zone = 0; zone < totalZones; zone++) {
            const startY = 400 + zone * zoneHeight;
            const endY = startY + zoneHeight;
            const style = zone % 4;
            
            if (style === 0) {
                // Zone 0: 촘촘하고 서로 다른 속도의 어지러운 십자 기둥들
                for (let i = 0; i < 15; i++) {
                    const x = Math.random() * (this.width - 100) + 50;
                    const y = startY + (i * (endY - startY) / 15);
                    const speed = (0.05 + Math.random() * 0.08) * (Math.random() > 0.5 ? 1 : -1);
                    this.createRotatingCross(x, y, speed, 120 + Math.random() * 80, 20);
                }
            } else if (style === 1) {
                // Zone 1: 야구 배트처럼 거세게 휘두르는 구역
                for (let i = 0; i < 6; i++) {
                    const isLeft = i % 2 === 0;
                    const x = isLeft ? 50 : this.width - 50;
                    const y = startY + i * 150 + 50;
                    this.createSwingingBat(x, y, {
                        speed: 0.003 + Math.random() * 0.004,
                        range: Math.PI / 1.2,
                        length: 300 + Math.random() * 100,
                        baseAngle: isLeft ? 0 : Math.PI
                    });
                }
            } else if (style === 2) {
                // Zone 2: 공을 위로 펑펑 튕겨버리는 거대한 불기둥과 가둠막
                const midY = (startY + endY) / 2;
                this.createFireBlower(this.width / 2, midY, this.width - 200, 100, () => ({
                    x: (Math.random() - 0.5) * 0.05,
                    y: -0.15 - Math.random() * 0.1
                }));
                this.createRotatingCross(200, midY - 150, 0.08, 160, 25);
                this.createRotatingCross(400, midY + 150, -0.08, 160, 25);
            } else if (style === 3) {
                // Zone 3: 불기둥 넉백 + 미친듯한 배트 스윙의 혼합
                for(let i=0; i<3; i++) {
                    this.createFireBlower(150 + Math.random() * 300, startY + 200 + i * 250, 150, 50, () => ({
                        x: (Math.random() - 0.5) * 0.08,
                        y: -0.1
                    }));
                    this.createSwingingBat(this.width/2, startY + 100 + i * 250, {
                        speed: 0.006, range: Math.PI, length: 250, baseAngle: Math.PI/2
                    });
                }
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
        this.swingingBats = []; this.fireBlowers = [];
        Runner.stop(this.runner); Render.stop(this.render); World.clear(this.world, false);
        Render.lookAt(this.render, { min: { x: 0, y: 0 }, max: { x: this.width, y: 800 } });
    }
}
