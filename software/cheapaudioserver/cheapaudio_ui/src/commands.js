/*
Copyright Andrew Selle 

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
var fs = require('fs');
var util = require('util');
var xml2js = require('xml2js');

// Given a order preserved xml2js, group repeated elements
// in a useful way.
function compact(x, depth=0) {
	if(x["_"] != undefined) return x["_"];
	if(depth > 4) return;

	var result = [];
	var out_type = "dict";
	var result = {};
	// Here are some schema specific groupings. We basically need to know which things
	// should repeat and where they go.
	// I.e. <Program> AND <Register> both should go into an ordered progs section.
	var typename_to_bucket = {
		"IC": "ics", "Module": "modules", "Register": "progs", "Program": "progs",
		"Algorithm": "algorithms", "ModuleParameter": "params",
	};

	for (k in x.$$) {
		var obj = x.$$[k];
		var typename = obj["#name"]
		var compacted = compact(obj, depth + 1);
		var bucket = typename_to_bucket[typename];
		if(typename =="Data") {
			// Make "0xA0, 0x03" => "A003"
			compacted = (compacted.split(", ").map(x => x.slice(2,4)))
		}
		if(bucket) {
			// If a bucket, make sure there is a list and then add it.
			if(result[bucket]==undefined) result[bucket] = [];
			result[bucket].push(compacted);
		} else {
			result[typename] = compacted;
		}
	}
	return result;
}

const buildJSON = (data)  => {
	console.log("Parsing...")
	var obj = {};
	console.log(data)
	var final = compact(data.Schematic);
	console.log(util.inspect(final, false, null));
	return final;
}

const convtest =  (xml_filename, json_filename) => {
	var fullpath_in = __dirname + "/" + xml_filename;
	var fullpath_out = __dirname + "/" + json_filename;
	var options = {
				valueProcessors: [xml2js.processors.parseNumbers],
				preserveChildrenOrder: true,
				explicitChildren: true
			};
	var parser = new xml2js.Parser(options);
	fs.readFile(fullpath_in, function(err, data) {

		parser.parseString(
			data,
			function (err, result) {
				if(err) throw err;
				result = buildJSON(result);
				fs.writeFile(fullpath_out, JSON.stringify(result, null), (err) => {
						if (err) throw err;
					});
				
				console.log(util.inspect(result, false, null));
				console.log('Done');
			});
	});
}


const program = require('commander');

program
  .command("testconv <xml_filename> <json_fileame>")
  .alias('f')
  .description('conv xml to a json')
  .action(function(xml_filename, json_filename) {
	  return convtest(xml_filename, json_filename);
  }); 

program.parse(process.argv)
