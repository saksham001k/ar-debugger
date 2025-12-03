#LogiBloom 
#AR Debugger - Live Code Visualization

A powerful 3D visualization tool that transforms Python code into interactive graphs, making debugging intuitive and visually engaging.

## Features

- **Live Code Editor**: Real-time code editing with instant visualization updates
- **3D Graph Visualization**: Interactive 3D representation of code structure
- **Error Detection**: Advanced error detection with helpful suggestions
- **Code Health Metrics**: Comprehensive code quality analysis
- **Execution Animation**: Visual code execution simulation
- **Interactive Controls**: Orbit controls, labels toggle, error highlighting

## Supported Python Constructs

- Function definitions and calls
- Variables and assignments
- Parameters and return statements
- Import statements
- Conditional statements
- Basic syntax validation

## Error Detection

- Undefined variables and functions
- Syntax errors
- Indentation errors
- Parameter mismatches
- Unclosed parentheses/brackets
- Missing colons

## Getting Started

1. Open `index.html` in a modern web browser
2. Write or paste Python code in the editor
3. Watch the 3D visualization update in real-time
4. Use controls to interact with the visualization

## Controls

- **🔄 Update**: Force refresh visualization
- **🔍 Analyze**: Detailed code analysis
- **🎯 Reset View**: Reset camera position
- **📝 Labels**: Toggle node labels
- **🚨 Highlight Errors**: Pulse error nodes
- **▶️ Play**: Execute code animation
- **📸 Screenshot**: Capture visualization

## Technology Stack

- **Three.js**: 3D graphics rendering
- **JavaScript**: Core application logic
- **HTML/CSS**: User interface
- **Python**: Code parsing and analysis

## File Structure

The debugger will show:

🔴 Red pulsing nodes for errors

🟢 Green nodes for functions

🟠 Orange nodes for function calls

🔵 Blue nodes for modules

🟣 Purple nodes for return statements

And many more color-coded node types!
-future 
Add more language support (JavaScript, Java, etc.)

Implement AR mode with WebXR

Add collaborative features

Create plugin system

Add more advanced code metrics
#DEMO
print("Hello")
a="10"
b=58
c=a+b
print(c)

def s(x,y):
    return x+y


print(s(10,89))
