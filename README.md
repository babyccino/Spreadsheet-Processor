# Spreadsheet Processor
This was made for a takeaway assessment given during a job interview. The program takes spreadsheets in CSV format with a new line marking a new row and creates a new CSV file for its output. The CSV should be given in a format similar to MS Excel, i.e., cell references are of form A1, AA1 etc., and formulas are marked with an equals sign. Formulas should be in reverse polish notation.
### Use
The program is used as such: 
```
node spreadSheetProcessor [INPUT] [OUTPUT]
```
If no output path is given the program will output to `./output.csv`
### Format
Sample input:
```
=B1 C1 +, 2, 3
4, 5, =A2 B2 /
```
Output:
```
5, 2, 3
4, 5, 0.8
```
### Features
Circular references i.e. `A1` is a function: `=A1` will be picked up and the output will display the reference list.

Sample input:
```
=A1
=B2, =A2
```
Output:
```
circular reference in function: A1 <= A1
circular reference in function: A2 <= B2 <= A2, circular reference in function: A2 <= B2 <= A2
```
