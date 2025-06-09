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
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import {produce} from "immer"
import {filter_object_to_biquad, crossover_object_to_biquad} from "./biquad"


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

const toHex = (num) => {
  return (num >>> 0).toString(16).toUpperCase().padStart(8, '0');
};

function program_biquad(param, index, biquads) {
  const addr = param.Address + index * 5 
  const size = 5 * 4  // 5 biquads coeff *  4 bytes / coeff
  var pay = []
  var biquads2 = [biquads[4],biquads[3],biquads[2],biquads[1],biquads[0]]
  var hex2 = biquads2.map(floatToHex).map(toHex)
  
  const ret = {name: param.Name, block: param.block, index: index, addr: addr, size:size, data:hex2.reduce((acc, curr) => acc + curr)}
  console.log(param, ret);
  return ret;
}

export const fetchJson = createAsyncThunk('jsonslice/fetchJson', () => {
  console.log("starting fetch of boot.json")
  return fetch('/boot.json')
  .then(res=>res.json())
  .then(data=>data)
})



export const jsonslice = createSlice({
  name: 'jsonslice',
  initialState: {
    value: null,
    edits: [],
  },
  reducers: {
    getJson: (state) => {
    },
    updateXover: (state, {name, payload}) => {
      var paramName = payload.name;
      var key = payload.key;
      var value = payload.value;
      if(payload.create) {
        state.nameToCleanParam[paramName].Filter = {type: "bypass", frequency: 1000, pass: "lowpass"}
        return state
      } else {
        state.nameToCleanParam[paramName].Filter[key] = value
      }
      var biquads = crossover_object_to_biquad(state.nameToCleanParam[paramName].Filter)
      console.log("biquads are now ", biquads);
      state.nameToCleanParam[paramName].Filters = [];
      for(var i=0; i<biquads.length; i++) {
        state.nameToCleanParam[paramName].Filters.push({biquad:biquads[i]})
        state.edits.push(program_biquad(state.nameToCleanParam[paramName], i, biquads[i]));
      }
      console.log("edits!", state.edits.length)

      return state
    },
    updateFilter: (state, {name, payload}) => {
      var paramName = payload.name;
      if(payload.create==true) {
        console.log("CREATING!")
        //state.nameToCleanParam[paramName].Filters.length = state.nameToCleanParam[paramName].Biquads // [index] = null
        state.nameToCleanParam[paramName].Filters[payload.index] = {"q": 1.0, "type": "peaking", "boost": 0.0, "gain": 0.0, "frequency": 100, "bypass": true}
        
        return state;
      } else {
      var index = payload.index
        var attr = payload.key;
        var value = payload.value;
        
        //state.nameToCleanParam = produce(state.nameToCleanParam, draft=>{draft[paramName] = {...draft[paramName], attr:value}})
        //var curr = state.nameToCleanParam[paramName]; 
        state.nameToCleanParam[paramName].Filters[index][attr] = value

        var quads = filter_object_to_biquad(state.nameToCleanParam[paramName].Filters[index])
        state.edits.push(program_biquad(state.nameToCleanParam[paramName], index, quads));
        console.log("edits!", state.edits.length)

        state.nameToCleanParam[paramName].Filters[index].biquad = quads;
        return state;
      }
    },

    setFloatParam: (state, {name, payload}) => {
      console.log("SETTING ", name, payload)
      var wordAddr = payload.addr;
      var value = payload.value;
      var paramName = payload.name;
      const byteAddr = wordAddr * 4;
      //console.log(store);
      var json = state.json;
      // TODO(aselle): Handle more ics
      var progs = json.ics[0].progs;
      //console.log("prelook",  paramName, wordAddr, value, JSON.stringify(state.nameToParam));
      var param = state.nameToParam[paramName];
      console.log("par", JSON.stringify(param))

      //for(var i = 0; i < progs.length; i++){
      //    var prog = progs[i];
      //    console.log(prog.Name)
      //    if(prog.Name === "Param" || prog.Name === "params") {
            console.log("MATCHING")
              var padHex = (x) => {
                  return ("0" + x.toString(16)).substr(-2);
              }
              var flt = Number.parseFloat(value);
              console.log("parsery ", flt, value)
              if(!isNaN(flt)) {
                var hexValue = floatToHex(flt);
                console.log(hexValue)
                if(hexValue != undefined) {
                  console.log("val", value, "hex", hexValue.toString(16), "addr", byteAddr);
                  var bytes = [
                      padHex((hexValue >> 24) & 0xff),
                      padHex((hexValue >> 16) & 0xff),
                      padHex((hexValue >> 8) & 0xff),
                      padHex((hexValue) & 0xff),
                  ];
                  var newParam = {Value: value, Data: bytes};
                  state.nameToParam = produce(state.nameToParam , draft => {draft[paramName] = {...draft[paramName], Value: value, Data: bytes}})
                  console.log("now it is", state.nameToParam[paramName])
                }
              }
        //    }
        //}
        return state;
      }
  },
  extraReducers: (builder) => {
    builder.addCase(fetchJson.pending, (state,action) => {
      console.log("Pending...")

    })
    .addCase(fetchJson.fulfilled, (state, action) => {
      console.log("AWOOT!")
      var nameToParam = {}
      var nameToCleanParam = {}
      var json = action.payload;
      console.log("pay", action.payload)
      if(json == undefined) return;
      var modules = json.ics[0].modules;
      for(var i = 0; i < modules.length; i++) {
          // TODO(aselle): Handle more algorithms
          var params = modules[i].algorithms[0].params;
          //console.log(modules[i],params, params.length);
          for(var j = 0; j < params.length; j++) {
              // TODO(aselle): Check for duplicates.
              //console.log(j, params[j]);
              nameToParam[params[j].Name] = params[j];
          }
      }
      var clean = json.ics[0].clean_params;
      for(var i = 0; i < clean.length; i++) {
        nameToCleanParam[clean[i].Name] = clean[i];
      }
      console.log("About to store", nameToCleanParam)
      console.log(nameToParam);
      state.json =  json;
      state.nameToParam = nameToParam;
      state.nameToCleanParam = nameToCleanParam;
      state.edits = [];
    })
  }
})

// Action creators are generated for each case reducer function
export const { getJson, setFloatParam, updateFilter, updateXover } = jsonslice.actions

export default jsonslice.reducer