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

import React from "react";
import globalHook from "use-global-hook";
import useGlobalHook from "use-global-hook";


// TODO: This is not the "right" way.
var currentJson = null;

function UploadJson(jsonString) {
    console.log("Upload file ", jsonString)
    // Here is where we are done
    const formData = new FormData();
    var file = new File([jsonString], "program.json", {type: "text/plain"});
    formData.append('file', file);
    const options = {
        method: 'POST',
        mode: 'no-cors',
        body: formData,
    };
    fetch("http://192.168.1.215/upload", options);

}

function UploadCurrentJson() {
    UploadJson(JSON.stringify(currentJson));
}


// https://medium.com/javascript-in-plain-english/state-management-with-react-hooks-no-redux-or-context-api-8b3035ceecf8

const initial = {
    aux: false,
    counter: 0,
    json: null
};

// Convert float to integer 5.23 fixed point.
function floatToHex(val) {
    if (val < -16.0 || val > 16.0) return undefined;
    return Math.round((1<<23) * val) & 0x0fffffff;
}

// Convert an intetger hex 5.23 to a float
function hexToFloat(val) {
    if(val & 0x08000000) {
        var res = ((val ^ 0xffffffff) + 1) & 0x0fffffff
        return -res / (1<<23);
    } else {
        return val / (1<<23);
    }
}

// transmit parameter update
// TODO: safe update
function transferParam(param) {
    var param = {"progs": [param]};
    fetch("/send", {
        method: 'POST',
        body: JSON.stringify(param),
        headers: {'Content-type': 'application/json'}
    }).then( response => console.log(response));
}

const actions = {
    setAux: (store, val) => {

        store.setState({aux: val})
        console.log("AUX SET ", store.state.aux)
    },
    addToCounter: (store, amount) => {
        const newCounterValue = store.state.counter + amount;
        store.setState({ counter: newCounterValue });

        console.log("WOOT!", store.state.counter)
      },

    get: (store) => {
        console.log(store);
        if(store.state.json === null) {
            fetch('/boot.json')
            .then(function(response) {
                return response.json();
                //values["stat"] = "ready";
            }).then(function(json) {
                // Make a param name to param map
                // TODO(aselle): Handle more ics
                var nameToParam = {}
                if(json == undefined) return;
                var modules = json.ics[0].modules;
                for(var i = 0; i < modules.length; i++) {
                    // TODO(aselle): Handle more algorithms
                    var params = modules[i].algorithms[0].params;
                    //console.log(modules[i],params, params.length);
                    for(var j = 0; j < params.length; j++) {
                        // TODO(aselle): Check for duplicates.
                        console.log("build nameToParam", j, params[j]);
                        nameToParam[params[j].Name] = params[j];
                    }
                }
                console.log("about to store...")
                store.setState({"json": json, "stat": "good", "nameToParam": nameToParam});
                console.log("stored!")
                currentJson = json;

            })
            return null;
        } else {
            return store.state.json;
        }
    },
    setFloatParam: (store, paramName, wordAddr, value) => {
        console.log("SET FLOAT PARAM ", paramName, wordAddr, value)
        const byteAddr = wordAddr * 4;
        //console.log(store);
        var json = store.state.json;
        // TODO(aselle): Handle more ics
        var progs = json.ics[0].progs;

        var param = store.state.nameToParam[paramName];

        for(var i = 0; i < progs.length; i++){
            var prog = progs[i];
            if(prog.Name === "Param") {
                var padHex = (x) => {
                    return ("0" + x.toString(16)).substr(-2);
                }
                var hexValue = floatToHex(Number.parseFloat(value));
                console.log("hex", hexValue.toString(16), "addr", byteAddr);
                var bytes = [
                    padHex((hexValue >> 24) & 0xff),
                    padHex((hexValue >> 16) & 0xff),
                    padHex((hexValue >> 8) & 0xff),
                    padHex((hexValue) & 0xff),
                ];
                // Update aggregated version
                for(var k = 0; k < 4; k++) prog.Data[byteAddr+k] = bytes[k];
                // Update individual parameter.
                param.Value = value;
                param.Data = bytes;
                console.log(param);
                // TODO(aselle): Transmit
                //transferParam(param);

            }
        }
    },

};

// const Store = () => {
//     const [globalState, globalActions] = useGlobal();
// }

// TODO what is htis
// const useGlobal = useGlobalHook(React, initial, actions);
const useGlobal = globalHook(initial, actions);


//var my_store, my_act = useGlobal((s) => null);


export {UploadJson, UploadCurrentJson};
export default useGlobal;

