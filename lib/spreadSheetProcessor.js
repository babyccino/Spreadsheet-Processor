const rpn = require('reverse-polish-notation'),
      fs = require('fs');

module.exports.loadFile = function(csv) {
  return new Promise((res, rej) => {
    fs.readFile(csv, 'utf8', (err, data) => {
      if (err) rej(err);
      else return res(data);
    })
  })
}

let allRegEx = /([A-Z]+\d+|-*\d+(\.\d)*|\+|-|−|\*|×|\/|÷|\^)/g,
    addressRegEx = /[A-Z]+\d+/,
    numberRegEx = /-*\d+(\.\d)*/,
    operationRegEx = /\+|-|−|\*|×|\/|÷|\^/;

function add(operand1, operand2) { return operand1+operand2; }
function subtract(operand1, operand2) { return operand1-operand2; }
function multiply(operand1, operand2) { return operand1*operand2; }
function divide(operand1, operand2) { return operand1/operand2; }

module.exports.isAddress = function(address) {
  return addressRegEx.test(address);
}

module.exports.isNumber = function(address) {
  return numberRegEx.test(address);
}

module.exports.isOperation = function(address) {
  return operationRegEx.test(address);
}

module.exports.formatToken = function(str) {
  if (module.exports.isAddress(str)) {
    return {
      type: "cellRef",
      value: str
    };
  } else if (module.exports.isNumber(str)) {
    return {
      type: "number",
      value: parseFloat(str)
    };
  } else {
    let op;
    if (str === "+")
      op = add;
    else if (str === "-" | str === "−")
      op = subtract;
    else if (str === "*" | str === "×")
      op = multiply;
    else if (str === "/" | str === "÷")
      op = divide;
    else if (str === "^")
      op = Math.pow;
    return {
      type: "op",
      value: op
    };
  }
}

module.exports.formatCell = function(cell) {
  let ret;
  try {
    if (cell.indexOf("=") !== -1) {
      ret = {
        type: 'function',
        value: cell.slice(1)
      };
    } else if (cell.match(/[A-Za-z]+/) != null) {
      ret = {
        type: 'text',
        value: cell
      };
    } else {
      ret = {
        type: 'number',
        value: parseFloat(cell)
      };
    }
  } catch(e) {
    ret = {
      type: "error",
      value: "Error parsing cell"
    }
  }
  return ret;
}

module.exports.toArray = function(csvString) {
  let arr = csvString.split("\n").map(str => str.split(','));
  for (let j = 0; j < arr.length; ++j)
  for (let i = 0; i < arr[j].length; ++i) {
    arr[j][i] = module.exports.formatCell(arr[j][i]);
    arr[j][i].address = module.exports.coordsToAddress(i, j);
  }
  return arr;
}

module.exports.referenceMap = function(arr) {
  let map = {};
  for (let row of arr)
  for (let cell of row) {
    map[cell.address] = cell;
  }
  return map;
}

module.exports.toCSVString = function(arr) {
  arr = arr.map(row => row.map(cell => cell.value));
  arr = arr.map(row => row.join(", "));
  arr = arr.join("\n");
  return arr;
}

module.exports.addressToCoords = function(address) {
  const xAddress = address.match(/[A-Z]+/gi)[0],
        yAddress = address.match(/[0-9]+/gi)[0],
        yCoord = parseInt(yAddress) - 1;
  let xCoord = 0;
  for (let i = 0; i < xAddress.length; ++i) {
    let letterVal = xAddress.charCodeAt(i) - 64;
    xCoord += letterVal * (Math.pow(26, (xAddress.length - i - 1)));
  }
  --xCoord;

  return [xCoord, yCoord];
}

module.exports.coordsToAddress = function(x, y) {
  let xCoord = x,
      yCoord = y + 1,
      xString = "";

  while (xCoord >= 0) {
    xString = `${String.fromCharCode(xCoord % 26 + 65)}${xString}`;
    xCoord = Math.floor(xCoord / 26) - 1
  }

  return xString + yCoord.toString();
}

class SpreadSheetError extends Error {
  constructor(...params) {
    super(...params);
    this.name = "SpreadSheetError";
  }
}

module.exports.getCell = function(arr, cell) {
  let cellCoords = cell;
  if (typeof cell === "string") cellCoords = module.exports.addressToCoords(cell);
  if (!arr[cellCoords[1]])
    throw new SpreadSheetError(`Cell ${cell} out of bounds`);
  if (!arr[cellCoords[1]][cellCoords[0]])
    throw new SpreadSheetError(`Cell ${cell} out of bounds`);
  return arr[cellCoords[1]][cellCoords[0]];
}

function getLoopErrorMessage(origCell, curCell) {
  if (origCell == curCell) return origCell.address;
  else return `${curCell.address} -> ${getLoopErrorMessage(origCell, curCell.firstRef)}`;
}

function setLoopErrorCells(origCell, curCell, errMessage) {
  curCell.type = "error";
  curCell.value = errMessage;
  if (origCell == curCell) return;
  else return setLoopErrorCells(origCell, curCell.firstRef, errMessage);
}

module.exports.loopError = function(origCell) {
  let errMessage = `circular reference in function: ${origCell.address} -> ${getLoopErrorMessage(origCell, origCell.firstRef)}`;
  setLoopErrorCells(origCell, origCell.firstRef, errMessage);
  return errMessage;
}

module.exports.executeCellRPN = function(arr, cell, visited) {
  try {
    if (cell.type === "number") return cell;
    if (cell.type === "text") throw new SpreadSheetError(`cell ${cell.address} of type text included in function`);;
    if (cell.type !== "function") throw new SpreadSheetError(`invalid cell at ${cell.address}`);

    // visited is a map references to the cells which have been visited
    // if the current cell is already in the map then there is a loop
    // If there is a loop it throws an exception showing which
    // cells are in the loop and sets all the cells in the loop to error cells
    if (visited[cell.address] != undefined) {
      let errMessage = module.exports.loopError(cell);
      throw new SpreadSheetError(errMessage);
    }

    visited[cell.address] = cell;

    let stack = [];

    str = cell.value.match(allRegEx).map(el => {
      let token = module.exports.formatToken(el);

      if (token.type === "op") {
        let operand2 = stack.pop(),
            operand1 = stack.pop();
        if (!operand1 || !operand2)
          throw new SpreadSheetError("Invalid expression");

        let res = token.value(operand1, operand2);
        stack.push(res);
      } else if (token.type === "cellRef") {
        let cellRef = module.exports.getCell(arr, token.value);

        cell.firstRef = cellRef;
        module.exports.executeCellRPN(arr, cellRef, visited);
        cell.firstRef = null;

        stack.push(cellRef.value);
      } else {
        stack.push(parseFloat(token.value));
      }
    });

    if (stack.length != 1)
      throw new SpreadSheetError("invalid expression");

    cell.type = "number";
    cell.value = stack.pop();

    delete visited[cell.address];

    return cell;
  } catch(e) {
    // Non-spreadsheet errors should not be intercepted.
    // Ex. syntax errors.
    if (!(e instanceof SpreadSheetError))
      throw e;

    // Cells with special error messages will be set already, otherwise
    // a generic message will be set.
    if (cell.type !== "error") {
      cell.type = "error";
      e.message = `function error in cell ${cell.address}: ${e.message}`;
      cell.value = e.message;
    }

    // rethrow so all cells refering to this are labeled as error cells
    throw e;
  }
}

module.exports.executeCellInfix = function(arr, cell, visited) {

}

module.exports.executeAllExpressions = function(arr, isInfix) {
  for (let row of arr)
  for (let cell of row) {
    if (cell.type === "function") {
      let visited = {};
      try {
        if (isInfix)
          module.exports.executeCellInfix(arr, cell, visited);
        else
          module.exports.executeCellRPN(arr, cell, visited);
      } catch(e) {
        if (!(e instanceof SpreadSheetError))
          throw e;
      }
    }
  }
  return arr;
}

module.exports.process = function(CSVStr, isInfix) {
    let arr = module.exports.toArray(CSVStr);
    arr = module.exports.executeAllExpressions(arr, isInfix);
    
    return module.exports.toCSVString(arr);
}