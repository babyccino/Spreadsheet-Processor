const sinon = require('sinon'),
			expect = require('chai').expect,
			fs = require('fs');

const spreadsheetProcessor = require('./../lib/spreadSheetProcessor'),
			sampleCSVPath = './tests/sample.csv';

function deleteAll(obj, ...properties) {
	if (Array.isArray(obj))
		for (let cell of obj)
			deleteAll(cell, ...properties);

	if (obj instanceof Object) {
		for (let prop of properties)
			delete obj[prop];

		for (var key in obj)
			if (obj.hasOwnProperty(key))
				deleteAll(obj[key], ...properties);
	}
}

describe('spreadsheetProcessor', () => {
	before(done => {
		done();
	});

	after(done => {
		done();
	});

	describe('loadFiles', () => {
		it('sample file loads', done => {
			spreadsheetProcessor.loadFile(sampleCSVPath)
				.then(res => {
					expect(res).to.eql("1,2,=A1 B1+\n2,2,=C1 A2 B2++");
					done();
				})
				.catch(done);
		});

	});

	describe('isAddress', () => {
		it('sample addresses', done => {
			expect(spreadsheetProcessor.isAddress("A1")).to.be.true;
			done();
		});

	});

	describe('addressToCoords', () => {
		it('test values', done => {
			expect(spreadsheetProcessor.addressToCoords('A1')).to.eql([0,0]);
			expect(spreadsheetProcessor.addressToCoords('Z9')).to.eql([25,8]);
			expect(spreadsheetProcessor.addressToCoords('AA10')).to.eql([26,9]);
			expect(spreadsheetProcessor.addressToCoords('AZ10')).to.eql([51,9]);
			expect(spreadsheetProcessor.addressToCoords('BA10')).to.eql([52,9]);
			expect(spreadsheetProcessor.addressToCoords('ZZ1000')).to.eql([26*26 + 26 - 1,999]);
			expect(spreadsheetProcessor.addressToCoords('AB9999')).to.eql([27,9998]);
			done();
		});

	});

	describe('coordsToAddress', () => {
		it('test values', done => {
			expect(spreadsheetProcessor.coordsToAddress([0,0])).to.equal('A1');
			expect(spreadsheetProcessor.coordsToAddress([25,8])).to.equal('Z9');
			expect(spreadsheetProcessor.coordsToAddress([26,9])).to.equal('AA10');
			expect(spreadsheetProcessor.coordsToAddress([51,9])).to.equal('AZ10');
			expect(spreadsheetProcessor.coordsToAddress([52,9])).to.equal('BA10');
			expect(spreadsheetProcessor.coordsToAddress([26*26 + 26 - 1,999])).to.equal('ZZ1000');
			expect(spreadsheetProcessor.coordsToAddress([26*26 + 26,999])).to.equal('AAA1000');
			done();
		});

	});

	describe('formatFunction', () => {
		it('sample functions', done => {
			let res = spreadsheetProcessor.formatFunction('=A1B1-3.1--');
			deleteAll(res, "value");
			expect(res)
				.to.eql([
					{ type: 'cellRef' },
					{ type: 'cellRef' },
					{ type: 'number' },
					{ type: 'op' },
					{ type: 'op' }
				]);
			res = spreadsheetProcessor.formatFunction('=A1B1- 3.1-');
			deleteAll(res, "value");
			expect(res)
				.to.eql([
					{ type: 'cellRef' },
					{ type: 'cellRef' },
					{ type: 'op' },
					{ type: 'number' },
					{ type: 'op' }
				]);
			done();
		});

	});

	describe('formatCell', () => {
		it('function cell recognised', done => {
			expect(spreadsheetProcessor.formatCell('=A1 B1 1++').type)
				.to.equal("function");
			done();
		});

		it('string cell recognised', done => {
			expect(spreadsheetProcessor.formatCell('abc2'))
				.to.eql({type: 'text', value: 'abc2'});
			done();
		});

		it('number cell recognised', done => {
			expect(spreadsheetProcessor.formatCell('2'))
				.to.eql({type: 'number', value: 2});
			done();
		});

	});

	describe('toArray', () => {
		it('newline makes new row', done => {
			expect(spreadsheetProcessor.toArray("1\n2"))
				.to.eql([
					[{address: 'A1', type: 'number', value: 1}],
					[{address: 'A2', type: 'number', value: 2}]
				]);
			done();
		});

		it('comma makes new column', done => {
			expect(spreadsheetProcessor.toArray("1,2"))
				.to.eql([[
					{address: 'A1', type: 'number', value: 1},
					{address: 'B1', type: 'number', value: 2}
				]]);
			done();
		});

	});

	describe('toCSVString', () => {
		it('newline makes new row', done => {
			let arr = [[{type: 'number', value: 1}],[{type: 'number', value: 2}]];
			expect(spreadsheetProcessor.toCSVString(arr))
				.to.equal("1\n2");
			done();
		});

	});

	describe('executeAllExpressions', () => {
		it('working expressions with no references', done => {
			let csv = "=3 4-,=5 2 3^+,=3 2*11-,=2 1 12 3/-+,=6 3- 2^11-",
					arr = spreadsheetProcessor.toArray(csv);
			spreadsheetProcessor.executeAllExpressions(arr);
			expect(arr)
				.to.eql([[
					{ type: 'number', value: -1, address: 'A1' },
					{ type: 'number', value: 13, address: 'B1' },
					{ type: 'number', value: -5, address: 'C1' },
					{ type: 'number', value: -1, address: 'D1' },
					{ type: 'number', value: -2, address: 'E1' }
				]]);
			done();
		});

		it('find self referring cell', done => {
			let func = "=A1",
					arr = spreadsheetProcessor.toArray(func);
			spreadsheetProcessor.executeAllExpressions(arr);
			expect(arr[0][0].type).to.equal("error");
			done();
		});

		it('find circular reference', done => {
			let func = "=B1,=A1",
					arr = spreadsheetProcessor.toArray(func);
			spreadsheetProcessor.executeAllExpressions(arr);

			for (let row of arr)
			for (let cell of row)
				expect(cell.type).to.equal("error");

			func = "=B1,=A2\n=B2,=A1";
			arr = spreadsheetProcessor.toArray(func);
			spreadsheetProcessor.executeAllExpressions(arr);
			
			for (let row of arr)
			for (let cell of row)
				expect(cell.type).to.equal("error");

			done();
		});

		it('find out of bounds reference', done => {
			let func = "=A2",
					arr = spreadsheetProcessor.toArray(func);
			spreadsheetProcessor.executeAllExpressions(arr);
			expect(arr[0][0].type).to.equal("error");
			done();
		});

		it('working expressions with references', done => {
			let func = "=B1 C1+,=A2 B2 +,=A2 B2 +\n2,3",
					arr = spreadsheetProcessor.toArray(func);
			spreadsheetProcessor.executeAllExpressions(arr);
			deleteAll(arr, "type", "address")
			expect(arr).to.eql([
				[{ value: 10 },{ value: 5 },{ value: 5 }],
  			[{ value: 2 },{ value: 3 }]
    	]);
			done();
		});

	});

});