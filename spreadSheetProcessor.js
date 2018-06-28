const spreadSheetProcessor = require('./lib/spreadSheetProcessor.js'),
			fs = require('fs');

const input = process.argv[2],
			output = process.argv[3] || "output.csv";

try {
	if (!input) throw new Error("Input filename not provided");

	spreadSheetProcessor.loadFile(input).then(res => {
		let arr = spreadSheetProcessor.toArray(res);
		arr = spreadSheetProcessor.executeAllExpressions(arr);
		
		let str = spreadSheetProcessor.toCSVString(arr);
		fs.writeFile(output, str, function (err) {
		  if (err) throw err;
		});
	}).catch(err => console.log(err));
} catch(e) {
	console.log(e);
}
