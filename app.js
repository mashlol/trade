var path = require("path");
var express = require("express");
var app = express();

var companies = require("./companies.json");

var test = companies[0].name.indexOf("Adarsh");


app.use(express.static(path.resolve(path.dirname(require.main.filename), 'public')));

var generateNameAndSymbolFromIndices = function(nameIndex, symbolIndex, company, searchString) {
	var name = company.name;
	var symbol = company.symbol;

	if (nameIndex != -1) {
		// name = company.name.substring(0, nameIndex) + "[strong]" + company.name.substr(nameIndex, searchString.length) + "[/strong]" + company.name.substr(nameIndex + searchString.length);
	}

	if (symbolIndex != -1) {
		// symbol = company.symbol.substring(0, symbolIndex) + "[strong]" + company.symbol.substr(symbolIndex, searchString.length) + "[/strong]" + company.symbol.substr(symbolIndex + searchString.length);
	}

	return {
		name: name,
		symbol: symbol
	}
}

app.get("/search", function(req, res) {
	var searchString = req.param("q");

	if (!searchString || searchString.length <= 1) {
		res.json({error: "Query string must be >= 1 letters long."})
		return;
	}

	searchString = searchString.toLowerCase();

	var relevantCompanies = [];
	for (var x in companies) {
		var symbolIndex = companies[x].symbol.toLowerCase().indexOf(searchString);
		var nameIndex = companies[x].name.toLowerCase().indexOf(searchString);
		if (symbolIndex != -1) {
			relevantCompanies.push({
				company: generateNameAndSymbolFromIndices(nameIndex, symbolIndex, companies[x], searchString),
				priority: symbolIndex
			});
		} else if (nameIndex != -1) {
			relevantCompanies.push({
				company: generateNameAndSymbolFromIndices(nameIndex, symbolIndex, companies[x], searchString),
				priority: 30 + nameIndex
			});
		}
	}

	relevantCompanies.sort(function(a, b) {
		return a.priority - b.priority;
	});

	var companiesOnly = [];
	for (var x in relevantCompanies) {
		companiesOnly.push(relevantCompanies[x].company);
	}

	res.json({companies: companiesOnly});
});

var server = app.listen(80);