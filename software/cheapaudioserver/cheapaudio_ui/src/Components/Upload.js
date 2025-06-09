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
import React, { Component } from 'react'
import Dropzone from 'react-dropzone';
import {UploadJson} from '../Data/store'

// var util = require('util');
var xml2js = require('xml2js');

const dropzoneStyle = {
    padding: '10px',
    "marginLeft": '5px',
    "marginRight": '5px',
    width: "100%",
    height: "20%",
    "background": '#eeeeaa',
    border: "1px solid black"
};

// Given a order preserved xml2js, group repeated elements
// in a useful way.
function compact(x, depth = 0) {
    if (x["_"] !== undefined) return x["_"];
    if (depth > 4) return;

    // var result = [];
    // var out_type = "dict";
    var result = {};
    // Here are some schema specific groupings. We basically need to know which things
    // should repeat and where they go.
    // I.e. <Program> AND <Register> both should go into an ordered progs section.
    var typename_to_bucket = {
        "IC": "ics", "Module": "modules", "Register": "progs", "Program": "progs",
        "Algorithm": "algorithms", "ModuleParameter": "params",
    };

    for (var k in x.$$) {
        var obj = x.$$[k];
        var typename = obj["#name"]
        var compacted = compact(obj, depth + 1);
        var bucket = typename_to_bucket[typename];
        if (typename === "Data") {
            // Make "0xA0, 0x03" => "A003"
            compacted = (compacted.split(", ").map(x => x.slice(2, 4)))
        }
        if (bucket) {
            // If a bucket, make sure there is a list and then add it.
            if (result[bucket] === undefined) result[bucket] = [];
            result[bucket].push(compacted);
        } else {
            result[typename] = compacted;
        }
    }
    return result;
}

const BuildJSONFromParsedXML = (data) => {
    console.log("Parsing...")
    console.log(data)
    var final = compact(data.Schematic);
    //console.log(util.inspect(final, false, null));
    return final;
}

const ParseXMLAndConvertToJson = (data,result_fn) => {
    var options = {
        valueProcessors: [xml2js.processors.parseNumbers],
        preserveChildrenOrder: true,
        explicitChildren: true
    };
    var parser = new xml2js.Parser(options);
    parser.parseString(
        data,
        function (err, result) {
            if (err) throw err;
            result = BuildJSONFromParsedXML(result);
            result_fn(result);
        });
}



class UploadDrop extends Component {


    onDrop(files) {
        fetch('/')


        files.forEach(file => {
            if (file.type === "application/json" || file.type === "text/xml") {
                var file_type = file.type;
                console.log("Accepted " + file.name)
                const reader = new FileReader()
                reader.onload = () => {
                    var result = reader.result;
                    if (file_type === "text/xml") {
                        result = ParseXMLAndConvertToJson(reader.result,
                            result => UploadJson(JSON.stringify(result)));
                    } else {
                        UploadJson(reader.result);
                    }
                }
                reader.readAsText(file)
            } else {
                console.log("Rejected " + file.name)
            }

        })
    }
    render() {
        return <Dropzone onDrop={this.onDrop.bind()}>
            {({ getRootProps, getInputProps }) => (
                <section>
                    <div style={dropzoneStyle} {...getRootProps()}>
                        <input {...getInputProps()} />
                        <p>Drop a new SigmaStudio Model or a CheapskateDSP JSON Model</p>
                    </div>
                </section>
            )}
        </Dropzone>
    }
}

export default UploadDrop