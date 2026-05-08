/* ========================================= */
/* 1. GLOBAL VARIABLES & STATE               */
/* ========================================= */
let currentCraft = 'knitting'; 

/* ========================================= */
/* 2. TYPEWRITER ANIMATION HELPER            */
/* ========================================= */
function typeWriter(text, elementId, speed = 25) {
    const terminal = document.getElementById(elementId);
    const p = document.createElement('p');
    p.className = 'ai-reply';
    p.innerHTML = '<span class="prompt">></span> '; 
    terminal.appendChild(p);


    const colorizedText = text.replace(/(\d+(\.\d+)?\s*(METERS|%))/g, '<span class="terminal-highlight">$1</span>');
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = colorizedText;
    const nodes = Array.from(tempDiv.childNodes);
    
    function typeNode(nodeIndex, charIndex) {
        if (nodeIndex < nodes.length) {
            const currentNode = nodes[nodeIndex];
            
            if (currentNode.nodeType === Node.TEXT_NODE) {
                if (charIndex < currentNode.textContent.length) {
                    p.innerHTML += currentNode.textContent.charAt(charIndex);
                    terminal.scrollTop = terminal.scrollHeight;
                    setTimeout(() => typeNode(nodeIndex, charIndex + 1), speed);
                } else {
                    typeNode(nodeIndex + 1, 0);
                }
            } else if (currentNode.nodeType === Node.ELEMENT_NODE) {
                const span = document.createElement('span');
                span.className = currentNode.className;
                p.appendChild(span);
                
                let spanCharIndex = 0;
                function typeSpan() {
                    if (spanCharIndex < currentNode.textContent.length) {
                        span.innerHTML += currentNode.textContent.charAt(spanCharIndex);
                        terminal.scrollTop = terminal.scrollHeight;
                        spanCharIndex++;
                        setTimeout(typeSpan, speed);
                    } else {
                        typeNode(nodeIndex + 1, 0);
                    }
                }
                typeSpan();
            }
        }
    }
    typeNode(0, 0);
}

/* ========================================= */
/* 3. MATH EVALUATION HELPER                 */
/* ========================================= */
function evaluateInput(input) {
    if (!input || input.trim() === "") return null;
    try {
        return Function(`'use strict'; return (${input})`)(); 
    } catch (e) { return null; }
}

/* ========================================= */
/* 4. CRAFT TOGGLE LOGIC                     */
/* ========================================= */
window.setCraft = function(craft) {
    currentCraft = craft;
    document.getElementById('knitToggle').classList.toggle('active', craft === 'knitting');
    document.getElementById('crochetToggle').classList.toggle('active', craft === 'crochet');
    typeWriter(`Art profile updated to: ${craft.toUpperCase()}`, 'terminalChat');
};

/* ========================================= */
/* 5. AI PREDICTION CORE                     */
/* ========================================= */
window.runAILogic = async function() {
    const yarnWeight = parseFloat(document.getElementById('yarnWeightInput').value);
    const toolSize = parseFloat(document.getElementById('toolSizeInput').value);
    const sStitchesRaw = document.getElementById('swatchInput').value;
    const sMetersRaw = document.getElementById('yarnInput').value;
    const pStitchesRaw = document.getElementById('projectInput').value;

    const sStitches = evaluateInput(sStitchesRaw); 
    const sMeters = evaluateInput(sMetersRaw);     
    const pStitches = parseInt(pStitchesRaw);

    if (isNaN(yarnWeight) || isNaN(toolSize) || !sStitches || !sMeters || !pStitches) {
        typeWriter("ERROR: Invalid input data.", 'terminalChat');
        return;
    }

    typeWriter(`CONNECTING TO ML CORE [MODE: ${currentCraft.toUpperCase()}]...`, 'terminalChat');

    try {
        const response = await fetch('http://127.0.0.1:5000/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                craft: currentCraft,
                yarn_weight: yarnWeight,
                tool_size: toolSize,
                swatch_ratio: sMeters / sStitches, // Ratio passed to model
                project_stitches: pStitches
            })
        });

        const result = await response.json();
// Inside your runAILogic result block
if (result.status === "success") {
    setTimeout(() => {
        typeWriter(`ANALYSIS COMPLETE.`, 'terminalChat');
        setTimeout(() => {
            // Numbers and 'METERS' will be colorized automatically
            typeWriter(`PREDICTED REQUIREMENT: ${result.predicted_yarn} METERS.`, 'terminalChat');
            setTimeout(() => {
                typeWriter(`MODEL CONFIDENCE: ${result.accuracy}%`, 'terminalChat');
            }, 1000); 
        }, 1000); 
    }, 800); 
}
    } catch (error) {
        typeWriter(`BACKEND OFFLINE. Ratio Calculation: ${(pStitches * (sMeters / sStitches)).toFixed(2)} METERS.`, 'terminalChat');
    }
};
/* ========================================= */
/* 6. CALCULATOR TOOL LOGIC                  */
/* ========================================= */
const display = document.getElementById('calcDisplay');
window.calcInput = (v) => display.value += v;
window.calcClear = () => display.value = "";
window.calcSolve = () => {
    try { 
        let expression = display.value.replace(/×/g, '*').replace(/÷/g, '/');
        const result = eval(expression); 
        display.value = result !== undefined ? result : "Error";
    } catch (e) { display.value = "Error"; }
};

window.handleLogout = (event) => { location.href = 'login.html'; };