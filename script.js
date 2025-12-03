// AR Debugger - ULTIMATE FINAL VERSION
class ARDebugger {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0f172a);
        
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        
        this.graphData = { nodes: [], edges: [] };
        this.errorData = { errors: [] };
        this.nodeMeshes = {};
        this.edgeLines = [];
        this.labelsVisible = true;
        this.isPlayingExecution = false;
        this.updateTimeout = null;
        
        this.init();
    }

    init() {
        this.initThreeJS();
        this.setupEventListeners();
        this.initialLoad();
        this.animate();
        
        // Force no line wrapping - MOVED INSIDE init() method
        setTimeout(() => {
            const editor = document.getElementById('code-editor');
            if (editor) {
                editor.style.whiteSpace = 'nowrap';
                editor.style.overflowX = 'auto';
                editor.setAttribute('wrap', 'off');
                console.log('Editor line wrapping disabled');
            }
        }, 100);
    }

    initThreeJS() {
        // Camera
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 5, 15);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        
        const canvasContainer = document.getElementById('canvas-container');
        if (canvasContainer) {
            canvasContainer.innerHTML = '';
            canvasContainer.appendChild(this.renderer.domElement);
        }

        // Controls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;

        // Lighting
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 20, 15);
        this.scene.add(directionalLight);
    }

    generateGraphFromCode(code) {
        const lines = code.split('\n');
        const nodes = [];
        const edges = [];
        let nodeId = 1;

        // Module node
        nodes.push({
            id: "N" + nodeId++,
            label: "main.py",
            type: "module",
            line: 1,
            file: "main.py"
        });

        let currentFunction = null;
        
        lines.forEach((line, index) => {
            const lineNum = index + 1;
            const trimmedLine = line.trim();
            
            if (trimmedLine === '' || trimmedLine.startsWith('#')) return;

            // Function definitions
            if (trimmedLine.startsWith('def ')) {
                const match = trimmedLine.match(/def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*:/);
                if (match) {
                    currentFunction = "N" + nodeId;
                    
                    nodes.push({
                        id: currentFunction,
                        label: match[1],
                        type: "function",
                        line: lineNum,
                        file: "main.py",
                        parameters: match[2].split(',').map(p => p.trim()).filter(p => p)
                    });
                    edges.push({source: "N1", target: currentFunction});
                    nodeId++;

                    // Parameters
                    match[2].split(',').map(p => p.trim()).filter(p => p).forEach(param => {
                        const cleanParam = param.replace(/=.*$/, '').trim();
                        if (cleanParam) {
                            const paramId = "N" + nodeId;
                            nodes.push({
                                id: paramId,
                                label: cleanParam,
                                type: "parameter",
                                line: lineNum,
                                file: "main.py"
                            });
                            edges.push({source: currentFunction, target: paramId});
                            nodeId++;
                        }
                    });
                }
            }
            
            // Variables
            if (currentFunction && trimmedLine.includes('=') && !trimmedLine.startsWith('def ')) {
                const match = trimmedLine.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=/);
                if (match) {
                    const varId = "N" + nodeId;
                    nodes.push({
                        id: varId,
                        label: match[1],
                        type: "variable",
                        line: lineNum,
                        file: "main.py"
                    });
                    edges.push({source: currentFunction, target: varId});
                    nodeId++;
                }
            }
            
            // Function calls
            if (currentFunction && trimmedLine.includes('(') && trimmedLine.includes(')')) {
                const match = trimmedLine.match(/([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/);
                if (match && !['print'].includes(match[1])) {
                    const callId = "N" + nodeId;
                    nodes.push({
                        id: callId,
                        label: match[1] + '()',
                        type: "call",
                        line: lineNum,
                        file: "main.py"
                    });
                    edges.push({source: currentFunction, target: callId});
                    nodeId++;
                }
            }
            
            // Return statements
            if (currentFunction && trimmedLine.startsWith('return ')) {
                const returnId = "N" + nodeId;
                nodes.push({
                    id: returnId,
                    label: 'return',
                    type: "return",
                    line: lineNum,
                    file: "main.py"
                });
                edges.push({source: currentFunction, target: returnId});
                nodeId++;
            }
        });

        return { nodes, edges };
    }

    analyzeCodeForErrors(code) {
        const errors = [];
        const lines = code.split('\n');
        
        const definedFunctions = new Set();
        const definedVariables = new Set();
        
        // First pass: collect definitions
        lines.forEach((line, index) => {
            const trimmedLine = line.trim();
            
            if (trimmedLine.startsWith('def ')) {
                const match = trimmedLine.match(/def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/);
                if (match) definedFunctions.add(match[1]);
            }
            
            if (trimmedLine.includes('=') && !trimmedLine.startsWith('def ')) {
                const match = trimmedLine.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=/);
                if (match) definedVariables.add(match[1]);
            }
        });
        
        // Second pass: detect errors
        lines.forEach((line, index) => {
            const lineNum = index + 1;
            const trimmedLine = line.trim();
            
            if (trimmedLine === '' || trimmedLine.startsWith('#')) return;

            // Check for syntax errors
            if ((trimmedLine.startsWith('def ') || trimmedLine.startsWith('if ') || 
                 trimmedLine.startsWith('for ') || trimmedLine.startsWith('while ')) && 
                !trimmedLine.endsWith(':')) {
                errors.push({
                    file: "main.py",
                    line: lineNum,
                    message: "SyntaxError: expected ':'",
                    type: "syntax_error"
                });
            }
            
            // Check for incomplete assignments
            if (trimmedLine.endsWith('=') && !trimmedLine.includes('==') && !trimmedLine.includes('!=')) {
                errors.push({
                    file: "main.py",
                    line: lineNum,
                    message: "SyntaxError: incomplete assignment",
                    type: "syntax_error"
                });
            }
            
            // Check for undefined names
            const words = trimmedLine.split(/[^a-zA-Z0-9_]+/);
            words.forEach(word => {
                if (word.length > 1 && /^[a-zA-Z_]/.test(word) && 
                    !definedFunctions.has(word) && 
                    !definedVariables.has(word) && 
                    !['print', 'return', 'if', 'else', 'for', 'while', 'def', 'and', 'or', 'not'].includes(word) &&
                    !line.includes('def ' + word) &&
                    !line.includes('=' + word)) {
                    
                    errors.push({
                        file: "main.py",
                        line: lineNum,
                        message: `NameError: name '${word}' is not defined`,
                        type: "undefined_variable"
                    });
                }
            });
        });

        return { errors };
    }

    calculateCodeHealth() {
        if (!this.graphData) return { score: 100, complexity: 0, coverage: 100, functions: 0, errors: 0 };
        
        const totalNodes = this.graphData.nodes.length;
        const errorCount = this.errorData.errors.length;
        const functionCount = this.graphData.nodes.filter(n => n.type === 'function').length;
        const edgeCount = this.graphData.edges.length;
        
        let score = 100;
        score -= errorCount * 20;
        
        // Structure bonus
        if (functionCount >= 2) score += 10;
        if (edgeCount >= 5) score += 5;
        
        score = Math.max(0, Math.min(100, score));
        
        const complexity = functionCount * 5 + totalNodes;
        const coverage = Math.max(0, 100 - (errorCount * 15));
        
        return { 
            score: Math.round(score), 
            complexity, 
            coverage: Math.round(coverage),
            functions: functionCount,
            errors: errorCount
        };
    }

    createNodes() {
        // Clear existing
        Object.values(this.nodeMeshes).forEach(mesh => this.scene.remove(mesh));
        this.nodeMeshes = {};
        this.edgeLines.forEach(line => this.scene.remove(line));
        this.edgeLines = [];
        
        this.graphData.nodes.forEach((node, index) => {
            const hasError = this.errorData.errors.some(e => e.file === node.file && e.line === node.line);
            
            let geometry, size, color;
            
            if (hasError) {
                size = 0.9;
                geometry = new THREE.OctahedronGeometry(size);
                color = 0xff4444;
            } else {
                switch(node.type) {
                    case 'module': size=0.8; geometry=new THREE.BoxGeometry(size,size,size); color=0x3498db; break;
                    case 'function': size=0.6; geometry=new THREE.SphereGeometry(size); color=0x2ecc71; break;
                    case 'call': size=0.5; geometry=new THREE.CylinderGeometry(size*0.7,size*0.7,size); color=0xf39c12; break;
                    case 'return': size=0.4; geometry=new THREE.TetrahedronGeometry(size); color=0x9b59b6; break;
                    case 'parameter': size=0.35; geometry=new THREE.DodecahedronGeometry(size); color=0x1abc9c; break;
                    default: size=0.4; geometry=new THREE.DodecahedronGeometry(size); color=0x95a5a6;
                }
            }
            
            const material = new THREE.MeshPhongMaterial({ 
                color: color,
                emissive: hasError ? 0x660000 : 0x000000
            });
            
            const mesh = new THREE.Mesh(geometry, material);
            mesh.castShadow = true;
            
            // Position in 3D circle
            const angle = (index / this.graphData.nodes.length) * Math.PI * 2;
            const radius = 6;
            const yPos = node.type === 'module' ? 3 : 
                        node.type === 'function' ? 1 : 
                        node.type === 'variable' ? -1 : 0;
            
            mesh.position.set(
                Math.cos(angle) * radius,
                yPos,
                Math.sin(angle) * radius
            );
            
            mesh.userData = { ...node, hasError };
            this.scene.add(mesh);
            this.nodeMeshes[node.id] = mesh;
            
            this.createNodeLabel(mesh, node, hasError);
        });
    }

    createNodeLabel(mesh, node, hasError) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 450;
        canvas.height = 128;
        
        context.fillStyle = 'rgba(15, 23, 42, 0.95)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        if (hasError) {
            context.strokeStyle = '#ff4444';
            context.lineWidth = 4;
            context.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
        }
        
        let displayLabel = node.label;
        const maxChars = 25;
        if (displayLabel.length > maxChars) {
            displayLabel = displayLabel.substring(0, maxChars) + '...';
        }
        
        context.font = 'bold 20px Arial';
        context.fillStyle = hasError ? '#ff6666' : 'white';
        context.textAlign = 'center';
        context.fillText(displayLabel, canvas.width / 2, canvas.height / 2 - 20);
        
        context.font = '14px Arial';
        context.fillStyle = hasError ? '#ff9999' : '#94a3b8';
        context.fillText(`${node.type} • line ${node.line}`, canvas.width / 2, canvas.height / 2 + 10);
        
        if (hasError) {
            context.font = 'bold 15px Arial';
            context.fillStyle = '#ff4444';
            context.fillText('🚨 ERROR', canvas.width / 2, canvas.height / 2 + 35);
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        const labelMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const labelSprite = new THREE.Sprite(labelMaterial);
        labelSprite.scale.set(7, 2, 1);
        labelSprite.position.set(0, 1.5, 0);
        mesh.add(labelSprite);
        mesh.userData.labelSprite = labelSprite;
    }

    createEdges() {
        if (!this.graphData.edges) return;
        
        this.graphData.edges.forEach(edge => {
            const sourceMesh = this.nodeMeshes[edge.source];
            const targetMesh = this.nodeMeshes[edge.target];
            
            if (sourceMesh && targetMesh) {
                const points = [sourceMesh.position.clone(), targetMesh.position.clone()];
                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                const targetHasError = targetMesh.userData.hasError;
                
                const material = new THREE.LineBasicMaterial({ 
                    color: targetHasError ? 0xff3333 : 0x475569,
                    opacity: 0.7,
                    transparent: true
                });
                
                const line = new THREE.Line(geometry, material);
                this.scene.add(line);
                this.edgeLines.push(line);
            }
        });
    }

    updateErrorCount() {
        const errorCount = this.errorData.errors.length;
        const errorElement = document.getElementById('error-count');
        if (errorElement) {
            errorElement.textContent = `${errorCount} Error${errorCount !== 1 ? 's' : ''}`;
            errorElement.style.background = errorCount === 0 ? 
                'linear-gradient(135deg, #00cc66, #00994d)' :
                errorCount <= 2 ?
                'linear-gradient(135deg, #ffcc00, #ffaa00)' :
                'linear-gradient(135deg, #ff4444, #cc0000)';
        }
    }

    updateHealthDisplay() {
        const health = this.calculateCodeHealth();
        
        const elements = {
            'health-value': health.score,
            'complexity-value': health.complexity,
            'coverage-value': health.coverage + '%',
            'function-value': health.functions,
            'error-value': health.errors
        };
        
        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });
        
        const healthFill = document.getElementById('health-fill');
        if (healthFill) {
            healthFill.style.width = health.score + '%';
            healthFill.style.background = 
                health.score >= 80 ? 'linear-gradient(90deg, #00cc66, #00ff88)' :
                health.score >= 60 ? 'linear-gradient(90deg, #ffcc00, #ffaa00)' :
                'linear-gradient(90deg, #ff4444, #ff0000)';
        }
    }

    updateAnalysisStats() {
        const stats = {
            functions: this.graphData.nodes.filter(n => n.type === 'function').length,
            variables: this.graphData.nodes.filter(n => n.type === 'variable').length,
            parameters: this.graphData.nodes.filter(n => n.type === 'parameter').length,
            connections: this.graphData.edges.length
        };
        
        const analysisStats = document.getElementById('analysis-stats');
        if (analysisStats) {
            analysisStats.innerHTML = Object.entries(stats).map(([key, value]) => `
                <div class="metric">
                    <div class="metric-label">
                        <span>${key.charAt(0).toUpperCase() + key.slice(1)}:</span>
                        <span>${value}</span>
                    </div>
                </div>
            `).join('');
        }
    }

    updateVisualization() {
        this.showLoading('🔄 Analyzing code...');
        
        setTimeout(() => {
            try {
                const code = document.getElementById('code-editor').value;
                this.graphData = this.generateGraphFromCode(code);
                this.errorData = this.analyzeCodeForErrors(code);
                
                this.createNodes();
                this.createEdges();
                this.updateErrorCount();
                this.updateHealthDisplay();
                this.updateAnalysisStats();
                
            } catch (error) {
                console.error('Update error:', error);
            } finally {
                this.hideLoading();
            }
        }, 100);
    }

    setupEventListeners() {
        const codeEditor = document.getElementById('code-editor');
        if (codeEditor) {
            // Prevent textarea line wrapping
            codeEditor.style.whiteSpace = 'nowrap';
            codeEditor.style.overflowX = 'auto';
            codeEditor.style.wordWrap = 'normal';
            codeEditor.setAttribute('wrap', 'off');
            
            codeEditor.addEventListener('input', () => {
                clearTimeout(this.updateTimeout);
                this.updateTimeout = setTimeout(() => this.updateVisualization(), 500);
            });
        }
        
        // Control buttons
        const buttons = {
            'update-visualization': () => this.updateVisualization(),
            'analyze-code': () => this.updateVisualization(),
            'reset-view': () => { 
                this.controls.reset(); 
                this.camera.position.set(0,5,15); 
            },
            'toggle-labels': () => {
                this.labelsVisible = !this.labelsVisible;
                Object.values(this.nodeMeshes).forEach(mesh => {
                    if (mesh.userData.labelSprite) mesh.userData.labelSprite.visible = this.labelsVisible;
                });
            },
            'highlight-errors': () => {
                Object.values(this.nodeMeshes).forEach(mesh => {
                    if (mesh.userData.hasError) {
                        mesh.material.emissive.setHex(0xff0000);
                        mesh.scale.set(1.5,1.5,1.5);
                        setTimeout(() => {
                            mesh.material.emissive.setHex(0x660000);
                            mesh.scale.set(1,1,1);
                        }, 2000);
                    }
                });
            },
            'play-execution': () => this.playExecutionAnimation(),
            'screenshot': () => {
                this.renderer.render(this.scene, this.camera);
                const link = document.createElement('a');
                link.href = this.renderer.domElement.toDataURL('image/png');
                link.download = 'ar-debugger.png';
                link.click();
            }
        };
        
        Object.entries(buttons).forEach(([id, handler]) => {
            const button = document.getElementById(id);
            if (button) button.addEventListener('click', handler);
        });
    }

    showLoading(message) {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.textContent = message;
            loading.style.display = 'block';
        }
    }

    hideLoading() {
        const loading = document.getElementById('loading');
        if (loading) loading.style.display = 'none';
    }

    initialLoad() {
        this.updateVisualization();
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Pulse error nodes
        Object.values(this.nodeMeshes).forEach(mesh => {
            if (mesh.userData.hasError) {
                const scale = 1 + 0.15 * Math.sin(Date.now() * 0.004);
                mesh.scale.set(scale, scale, scale);
            }
        });
        
        if (this.controls) this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    new ARDebugger();
});