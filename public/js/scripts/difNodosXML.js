import { initializeCodeMirror, handleScrollSwitchChange, handleScrollSizeInputChange, clearComparisonResult, escapeHtml } from './config.js';
import { validaContenido } from "./validaContenido.js";

// Función principal para comparar los XML
export function compareNodosXML(xmlString1, xmlString2) {
    // Obtener los valores de los editores CodeMirror
    const xmlInput1 = preprocessXML(xmlString1);
    const xmlInput2 = preprocessXML(xmlString2);

    // Verificar si los XML son válidos antes de parsearlos
    const validation1 = isValidXML(xmlInput1);
    if (!validation1.isValid) {
        displayResult(`<div class="error">XML 1 tiene errores de sintaxis: ${validation1.error}<br></div><div><pre>${escapeHtml(validation1.partialContent)}</pre></div>`);
        return;
    }
    const validation2 = isValidXML(xmlInput2);
    if (!validation2.isValid) {
        displayResult(`<div class="error">XML 2 tiene errores de sintaxis: ${validation2.error}<br></div><div><pre>${escapeHtml(validation2.partialContent)}</pre></div>`);
        return;
    }

    // Parsear los XML a documentos DOM usando los valores de los editores CodeMirror
    const parser = new DOMParser();
    const xmlDoc1 = parser.parseFromString(xmlInput1, 'text/xml');
    const xmlDoc2 = parser.parseFromString(xmlInput2, 'text/xml');

    // Comparar nodos y obtener el resultado en formato HTML
    const result = compareNodes(xmlDoc1.documentElement, xmlDoc2.documentElement);
    displayResult(result);
}

// Función para preprocesar el XML eliminando CDATA y declaraciones XML
function preprocessXML(xmlString) {
    return xmlString.replace('![CDATA[', "CDATA>").replace(']]', "</CDATA").replace(/<\?xml[^>]*\?>/g, "").trim();
}

// Función para validar si un XML es válido
function isValidXML(xmlString) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
    const parserError = xmlDoc.querySelector('parsererror');
    if (parserError) {
        // Capturar la parte del XML que se puede procesar hasta el primer error
        const partialContent = getPartialContentUntilError(xmlString, parserError.textContent);
        return { isValid: false, error: parserError.textContent, partialContent: partialContent };
    }
    return { isValid: true, partialContent: xmlString };
}

// Función para obtener el contenido parcial del XML hasta el primer error
function getPartialContentUntilError(xmlString, errorMessage) {
    const lines = xmlString.split('\n');
    const errorLineMatch = errorMessage.match(/error on line (\d+)/);
    if (errorLineMatch) {
        const errorLine = parseInt(errorLineMatch[1], 10);
        return lines.slice(0, errorLine).join('\n');
    }
    return xmlString;
}

// Función para mostrar el resultado en el DOM
function displayResult(result) {
    const comparisonResultElement = document.getElementById('comparisonResult');
    comparisonResultElement.innerHTML = result; // Convertir result a HTML para mostrar diferencias
    comparisonResultElement.style.color = 'black';
    comparisonResultElement.style.fontSize = '100%';
}

// Función recursiva para comparar nodos XML
function compareNodes(node1, node2) {
    console.log("comparaNodes")
    // Inicializar el resultado para este nivel de nodos
    let result = '';

    // Comparar los nombres de los nodos
    if (node1.nodeName !== node2.nodeName) {
        result += `<div class="mismatch">Los nodos &#60;${node1.nodeName}&#62; de XML1 y &#60;${node2.nodeName}&#62; de XML2 no coinciden</div>`;
        return result; // Salir de la función si los nombres de los nodos no coinciden
    }

    // Manejar las secciones CDATA
    if (node1.nodeType === Node.CDATA_SECTION_NODE || node2.nodeType === Node.CDATA_SECTION_NODE) {
        if (node1.nodeValue !== node2.nodeValue) {
            result += `<div class="mismatch">Las secciones CDATA de ${node1.nodeName} no coinciden</div>`;
        } else {
            result += `<div class="match">Las secciones CDATA de ${node1.nodeName} coinciden</div>`;
        }
        return result; // Salir de la función después de manejar CDATA
    }

    // Comparar los nombres de los nodos
    if (node1.nodeName !== node2.nodeName) {
        result += `<div class="mismatch">Los nodos &#60;${node1.nodeName}&#62; y &#60;${node2.nodeName}&#62; no coinciden</div>`;
        return result; // Salir de la función si los nombres de los nodos no coinciden
    }

    // Verificar la sintaxis de las etiquetas de apertura y cierre
    const syntaxValidation1 = validateTagSyntax(node1);
    const syntaxValidation2 = validateTagSyntax(node2);

    // Manejar errores de sintaxis de etiquetas
    if (typeof syntaxValidation1 === 'string') result += `<div class="error">${syntaxValidation1}</div>`;
    if (typeof syntaxValidation2 === 'string') result += `<div class="error">${syntaxValidation2}</div>`;

    if (result !== '') return result; // Salir de la función si hay errores de sintaxis


    // Comparar la cantidad de hijos
    const children1 = Array.from(node1.children);
    const children2 = Array.from(node2.children);

    if (children1.length !== children2.length) {
        result += `<div class="mismatch">La cantidad de hijos del nodo &#60;${node1.nodeName}&#62; del XML Base no coinciden con los hijos del nodo XML a Comparar.</div>`;
    }

    // Verificar los nombres de los hijos en ambos conjuntos
    const childNames1 = children1.map(child => child.nodeName);
    const childNames2 = children2.map(child => child.nodeName);

    // Validar que las longitudes de los nodos hijos cumpla que node1 >= node2
    children1.length == children2.length
                        ? result+=recorrernode1(children1, children2,result,node2,node1)
                        : console.log("No coincide lalongitud de los nodos hijos");
    

    // Si no se han encontrado discrepancias, agregar mensaje de coincidencia
    if (result === '') {
        result += `<div class="match">Los nodos &#60;${node1.nodeName}&#62; coinciden</div>`;
        result = validaContenido(node1, node2, result);
    }

    // Retornar el resultado para este nivel de nodos
    return result;
}

// funcion para Recorrer cada hijo de node1 y buscar un equivalente en node2
const recorrernode1 = (children1, children2,result,node2,node1)=>{
    // console.log("node2:",node2, node2.nodeName,"\n")
    for (let i = 0; i < children1.length; i++) {
        const child1 = children1[i];
        let child2 = children2[i]
        console.log(children1, children2)
        
        
        //Valida primero sí coincide la posición del nodo1 y nodo2
        if(child1.nodeName === child2.nodeName){
            result += compareNodes(child1, child2);
        } else{
            console.log("no coincide:")
            child2 = children2.find(child => child.nodeName === child1.nodeName);
            // Si no se encuentra el equivalente del hijo en node2, agregar mensaje de desacuerdo
            if (!child2) {
                result += `<div class="mismatch">Los nombres de los nodos hijos de &#60;${node1.nodeName}&#62; no coinciden.<br>No se encontró el nodo hijo &#60;${child1.nodeName}&#62; del XML Base en el nodo &#60;${node2.nodeName}&#62; del XML a comparar.</div>`;
            } else {
                // Comparar recursivamente los hijos
                result += compareNodes(child1, child2);
            }
        }
    }
    console.log(result)
    return result;
}

// Función para comparar secciones CDATA
function compareCData(node1, node2) {
    if (node1.nodeValue !== node2.nodeValue) {
        return `<div class="mismatch">Las secciones CDATA de ${node1.nodeName} no coinciden</div>`;
    }
    return `<div class="match">Las secciones CDATA de ${node1.nodeName} coinciden</div>`;
}

// Función para validar la sintaxis de las etiquetas de apertura y cierre de un nodo XML
function validateTagSyntax(node) {
    const serializer = new XMLSerializer();
    const xmlString = serializer.serializeToString(node);

    try {
        // Intentar crear un nuevo documento XML a partir de la cadena serializada
        new DOMParser().parseFromString(xmlString, 'text/xml');
        return true; // La sintaxis es válida
    } catch (error) {
        // Capturar cualquier error de sintaxis XML y devolver un mensaje descriptivo
        console.error(`Error de sintaxis en la etiqueta ${node.nodeName}:`, error);
        return `Error de sintaxis en la etiqueta ${node.nodeName}: ${error.message}`;
    }
}

// Función para comparar dos arrays
function arraysEqual(arr1, arr2) {
    // Verificar la longitud de los arrays
    if (arr1.length !== arr2.length) return false;

    // Comparar elemento por elemento
    for (let i = 0; i < arr1.length; i++) {
        if (arr1[i] !== arr2[i]) return false;
    }

    // Si todos los elementos son iguales, retornar true
    return true;
}