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

module.exports.isAddress = function(address) {
  return addressRegEx.test(address);
}

module.exports.isNumber = function(address) {
  return numberRegEx.test(address);
}

module.exports.isOperation = function(address) {
  return operationRegEx.test(address);
}

module.exports.formatFunction = function(str) {
  let numCount = 0,
      opCount = 0;
  str = str.match(allRegEx).map(el => {
    let str;
    if (module.exports.isAddress(el)) {
      ++numCount;
      return {
        type: "cellRef",
        value: el
      };
    } else if (module.exports.isNumber(el)) {
      ++numCount;
      return {
        type: "number",
        value: parseFloat(el)
      };
    } else {
      ++opCount;
      let op;
      if (el === "+")
        op = add;
      else if (el === "-" | el === "−")
        op = subtract;
      else if (el === "*" | el === "×")
        op = multiply;
      else if (el === "/" | el === "÷")
        op = divide;
      else if (el === "^")
        op = Math.pow;
      return {
        type: "op",
        value: op
      };
    }
  });
  if (numCount !== opCount + 1)
    throw new SpreadSheetError("invalid expression");
    
  return str;

  function add(operand1, operand2) {
    return operand1+operand2;
  }
  function subtract(operand1, operand2){
    return operand1-operand2;
  }
  function multiply(operand1, operand2){
    return operand1*operand2;
  }
  function divide(operand1, operand2){
    return operand1/operand2;
  }
}

module.exports.formatCell = function(cell) {
  let ret;
  try {
    if (cell.indexOf("=") !== -1) {
      ret = {
        type: 'function',
        value: module.exports.formatFunction(cell)
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
    arr[j][i].address = module.exports.coordsToAddress([i,j]);
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

module.exports.coordsToAddress = function(coords) {
  let xCoord = coords[0],
      yCoord = coords[1] + 1,
      xString = "";

  while (xCoord >= 0) {
    xString = `${String.fromCharCode(xCoord%26 + 65)}${xString}`;
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

module.exports.executeCell = function(arr, cell, visited) {
  try {
    if (cell.type === "number") return cell;
    if (cell.type === "text") throw new SpreadSheetError(`cell ${cell.address} of type text included in function`);;
    if (cell.type === "error" || cell.type !== "function") throw new SpreadSheetError(`invalid cell at ${cell.address}`);

    // visited is a stack of references to the cells which have been visited
    // this loop checks if the stack already contains a refernece to the
    // cell currently being executed. If it does it throws an exception showing which
    // cells are in the loop and sets all the cells in the loop to error cells
    for (let cellVisited of visited) {
      if (cellVisited === cell) {
        let errMessage = `circular reference in function: ${cell.address}`;
        for (i = visited.length - 1; visited[i] !== cell; --i) {
          errMessage = `${errMessage} <= ${visited[i].address}`;
        }
        errMessage = `${errMessage} <= ${cell.address}`;
        for (i = visited.length - 1; visited[i] !== cell; --i) {
          visited[i].type = "error";
          visited[i].value = errMessage;
        }
        cell.type = "error";
        cell.value = errMessage;
        throw new SpreadSheetError(errMessage);
      }
    }

    visited.push(cell);

    let input = cell.value,
        stack = [],
        token = input.shift();

    while (token) {
      if (token.type === "op") {
        let operand2 = parseFloat(stack.pop()),
            operand1 = parseFloat(stack.pop());
        if (!operand1 || !operand2)
          throw new SpreadSheetError("Invalid expression");

        let res = token.value(operand1, operand2);
        stack.push(res);
      } else if (token.type === "cellRef") {
        let cellRef = module.exports.getCell(arr, token.value);

        module.exports.executeCell(arr, cellRef, visited);

        stack.push(cellRef.value);
      } else {
        stack.push(token.value);
      }
      token = input.shift();
    }
    if (stack.length > 1)
      throw new SpreadSheetError("invalid expression");

    cell.type = "number";
    cell.value = stack.pop();

    visited.pop();

    return cell;
  } catch(e) {
    // Errors not with the spreadsheet should be thrown
    // all the way back to node
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

module.exports.executeAllExpressions = function(arr) {
  for (let row of arr)
  for (let cell of row) {
    if (cell.type === "function") {
      let visited = [];
      try {
        module.exports.executeCell(arr, cell, visited);
      } catch(e) {
        if (!(e instanceof SpreadSheetError))
          throw e;
      }
    }
  }
  return arr;
}