const spreadSheetProcessor = require('./lib/spreadSheetProcessor.js'),
      fs = require('fs'),
      commandLineArgs = require('command-line-args');

const optionDefinitions = [
  { name: 'verbose', alias: 'v', type: Boolean },
  { name: 'src', type: String, multiple: true, defaultOption: true },
  { name: 'timeout', alias: 't', type: Number }
]

const input = process.argv[2],
      output = process.argv[3] || "output.csv",
      infix = process.argv[4] || "infix",
      isInfix = infix.toLowerCase() === "infix";

try {
  if (!input) throw new Error("Input filename not provided");

  fs.readFile(input, 'utf8', (err, data) => {
    if (err) throw err;

    let str = spreadSheetProcessor.process(data, isInfix);
    fs.writeFile(output, str, function (err) {
      if (err) throw err;
    });
  });
} catch(e) {
  console.log(e);
}
