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
import React from 'react';
//import useGlobal from "../Data/store";
import TextField from '@mui/material/TextField';
import Checkbox from '@mui/material/Checkbox';
import Slider from '@mui/material/Slider';
import Box from '@mui/material/Box';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Switch from '@mui/material/Switch';


//import Paper from '@mui/material/Paper';
import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';
//import { makeStyles } from '@material-ui/core/styles';

import { getJson,fetchJson,setFloatParam,updateFilter,updateXover} from '../Data/jsonslice';
import { useSelector, useDispatch, shallowEqual } from 'react-redux';


// const useStyles = makeStyles({
//     card: {
//       minWidth: 275,
//       paddingBottom: 22,
//       margin: 20,
//     },
//     bullet: {
//       display: 'inline-block',
//       margin: '0 2px',
//       transform: 'scale(0.8)',
//     },
//     title: {
//       fontSize: 14,
//     },
//     pos: {
//       marginBottom: 12,
//     },
//   });

// Gain1940AlgNS

const Param = (props) => {
  const dispatch = useDispatch();
  //console.log("Param ", props.data.Name)
  const propvalue = useSelector((state) => state.json.nameToParam[props.data.Name]);
  function onChange({target: {value}}) {
      dispatch(setFloatParam({name: props.data.Name, addr: props.addr, value: value}));
  }
  return (<TextField variant="standard" onChange={onChange} value={propvalue.Value} id={propvalue.Name} label={propvalue.Name} />)
}

const CheckBoxParam = (props) => {
  const dispatch = useDispatch();
  const propvalue = useSelector((state) => state.json.nameToParam[props.name]);
  function onChange({target: {checked}}) {
      dispatch(setFloatParam({name: propvalue.Name, addr: propvalue["0Address"], value: checked ? props.pos : props.neg}));
  }
  return <span>{propvalue.Name}<Checkbox onChange={onChange} checked={(propvalue.Value==props.pos)} id={propvalue.Name} label={propvalue.Name}/> raw ({propvalue.Value})</span>
}

const SliderParam = (props) => {
  const dispatch = useDispatch();
  const propvalue = useSelector((state) => state.json.nameToParam[props.name]);
  function onChange({target: {value}}) {
      console.log("VAL IS ", value, propvalue)
      dispatch(setFloatParam({name: propvalue.Name, addr: propvalue["0Address"], value: value}));
  }
  //console.log("SLIDER", propvalue)
  return  <p>{propvalue.Value} <Slider value={propvalue.Value} id={propvalue.Name} label={propvalue.Name} onChange={onChange} min={0} max={1} step={.005}/></p>
}

//sin_lookupAlg

var fs = 48000.
const SineToneParam = (props) => {
  const dispatch = useDispatch();
  const propvalue = useSelector((state) => state.json.nameToParam[props.name]);
  function onChange({target: {value}}) {
    dispatch(setFloatParam({name: propvalue.Name, addr: propvalue["0Address"], value: value}));
}
function onChangeHz({target: {value}}) {
  dispatch(setFloatParam({name: propvalue.Name, addr: propvalue["0Address"], value: value / fs * 2}));
}
console.log("hz",propvalue.Value*fs/2);
  return  <p><TextField variant="standard" onChange={onChangeHz} value={propvalue.Value * fs / 2} id={propvalue.Name} label={"Hz"} />
            <TextField variant="standard" onChange={onChange} value={propvalue.Value} id={propvalue.Name} label={" (raw value)"} />
           <Slider value={propvalue.Value * fs / 2} id={propvalue.Name} label={propvalue.Name} onChange={onChangeHz} min={0} max={24000} step={1}/></p>
}

const XoverParam = (props => {
  return ( <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 300 }}>
      <InputLabel>Item</InputLabel>
      <Select
        value='LR24'
        
      >
        <MenuItem value="LR12">Linkwitz-Riley 12</MenuItem>
        <MenuItem value="LR24">Linkwitz-Riley 24</MenuItem>
        <MenuItem value="LR36">Linkwitz-Riley 36</MenuItem>
      </Select>

    <TextField
      label="Frequency"
      type="number"
      value={3.3}
      fullWidth
    />
  </Box>)
})

// OLD TODO LOSE
const BiQuad = (props) => {
    //var allowed = state.json.nameToParam.keys().filter(x=>x.startsWith(this.props.name))
    //console.log("BIQU", props.algo_name, props.paramNames)
    //useSelector((state) => .fromEntries()))
    var algo = props.algo_name;
    var nameToParam = useSelector((state) => {
      var items = [];
      for(var i=0;i<props.paramNames.length;i++) {
        var name = props.paramNames[i];
        //console.log(i, name);
        items[name] = state.json.nameToParam[name];
      }
      return items;
    }, shallowEqual);

    var biquads = [];
    Object.entries(nameToParam).map(obj=> {
      if(obj[0].startsWith(props.algo_name)) {
        var stuff = obj[0].replace(algo, "");
        var prefix = stuff.substring(0, 2);
        const mapping = {"1A":0, "2A":1,"0B":2, "1B":3,"2B":4,
                         "A1":0, "A2":1,"B0":2, "B1":3,"B2":4,
        };
        var coeff = mapping[prefix];
        var filternum = parseInt(stuff.substring(2));
        //console.log("biquad ", parseInt(suffix), mapping[prefix]);
        if (!(filternum in biquads)) {
          biquads[filternum] = [];
        }
        biquads[filternum][coeff] = obj[1].Value;
      }
    });
    const ymin = -15;
    const ymax = 15.;
    const xmin=20.;
    const xmax=24000.;
    const W = 640;
    const H = 200;
    var samples = []
    var exprange = [1.0, Math.log10(24000)];
    var nsamples = 100;
    var dexp = (exprange[1] - exprange[0]) / nsamples;
    var vals = [];
    var xs = [];

    const xwindow = x => W/(Math.log10(xmax)-Math.log10(xmin)) * (Math.log10(x)-Math.log10(xmin));
    const ywindow = y => H-H/(ymax-ymin) * (y-ymin)
    for (var i = 1.0; i < Math.log10(24000); i += dexp) {
       var x = Math.pow(10.0, i);
        samples.push(x);
        vals.push(1.);
        xs.push([xwindow(x),0]);
    }
    //console.log("samples!",samples);

    var xaxis = [[xwindow(xmin),ywindow(0)],[xwindow(xmax),ywindow(0)]];
    var ygrid = "";
    var texts = [];
    for(var xbase=1; xbase < xmax; xbase *= 10) {
      texts.push(<text x={xwindow(xbase)} y={ywindow(0)+15}>{xbase}</text>)
      for(var x=xbase; x<xbase*10; x+=(xbase*10-xbase)/10){
        ygrid += "M ";
        ygrid += xwindow(x) + " "
        ygrid += ywindow(ymax) + " "
        ygrid += "L ";
        ygrid += xwindow(x) + " "
        ygrid += ywindow(ymin) + " "
      }
    }
    for(var y=Math.floor(ymin/5)*5; y<=ymax;y+=5){
      texts.push(<text x={0} y={ywindow(y)}>{y}</text>)
      ygrid += "M ";
      ygrid += xwindow(xmin) + " "
      ygrid += ywindow(y) + " "
      ygrid += "L ";
      ygrid += xwindow(xmax) + " "
      ygrid += ywindow(y) + " "
    }

    for(var ii in biquads ) {
      var b=  biquads[ii];
      var a1 = -b[0];
      var a2 = -b[1];
      var [b0, b1, b2] = [b[2], b[3], b[4]];
      for(var i = 0; i < samples.length; i++) {
        var w = samples[i] / 48000. * Math.PI*2.;
        var re1 = Math.cos(w);
        var im1 = -Math.sin(w);
        var re2 = Math.cos(2 * w);
        var im2 = -Math.sin(2 * w);
        var re_num = b0 + b1 * re1 + b2 * re2;
        var im_num = b1 * im1 + b2 * im2;
        var re_den = 1 + a1 * re1 + a2 * re2;
        var im_den = a1 * im1 + a2 * im2;
        var den = re_den * re_den + im_den * im_den;
        var re_fin = (re_num * re_den + im_num * im_den) / den;
        var im_fin = (im_num * re_den - re_num * im_den) / den;
        var val2 = im_fin * im_fin + re_fin * re_fin;
        var val = Math.sqrt(val2);
        vals[i] *= val;
      }
    }
    //console.log("vals",vals);
    for(var i = 0; i < samples.length; i++) {
      xs[i][1] = H-H/(ymax-ymin) * (Math.log10(vals[i])*20.-ymin)
     // console.log("biquads", biquads);
    }
    xs.push([xs[xs.length-1][0],H])
    xs.push([xs[0][0],H])
    //console.log(xs);
    return <span>{props.name} <svg width={640} height={200}> {texts}
       <polyline points={xaxis}  style={{fill:null,stroke:"black","stroke-width":1,"fill":"#aaaaaa"}} />
       <polyline points={xs}  style={{fill:null,stroke:"green","stroke-width":0,"fill":"#aaaaaa88"}} />
       <path d={ygrid}  fill={"none"} stroke={"#00000055"}/>
      </svg></span>
}

function makeBiquad(module_i, algo_name, params) {
  //console.log("make Biquad ", algo_name)
  var paramNames = [];
  for(var i=0;i<params.length;i++) {
    if(params[i].Name.startsWith(algo_name))
      paramNames.push(params[i].Name)
  }
  return <p><BiQuad module_i={module_i} algo_name={algo_name} paramNames={paramNames}/></p>
}

function makeWidgets(module_i, algo) {
  var arr = [];
  for(var i=0;i<algo.params.length;i++) {
    var param = algo.params[i];
    //if(!algo.DetailedName.startsWith("Ch1.")) continue
    if(algo.DetailedName.startsWith("MuteNoSlew")) {
      arr.push(<CheckBoxParam pos={0} neg={1} name={param.Name}/>)
    } else if (algo.DetailedName.startsWith("Gain1940AlgNS")) {
      arr.push(<SliderParam name={param.Name}/>)
    } else if (param.Name.startsWith("sin_lookupAlg") && param.Name.endsWith("increment")) {
      arr.push(<SineToneParam name={param.Name}/>)
    } else if (param.Name.startsWith("sin_lookupAlg") && param.Name.endsWith("ison")) {
      arr.push(<CheckBoxParam neg={0} pos={1} name={param.Name}/>)
    } else if (param.Name.startsWith("EQ1940Invert") && param.Name.endsWith("gain")) {
      arr.push(<CheckBoxParam neg={1} pos={-1} name={param.Name}/>)
    }else if (param.Name.startsWith("PEQ1Chan_SinglePrec")) {
      arr.push(<Param addr={param['0Address']} key={param.Name} data={param}/>)
    }else if(param.Name.startsWith("EQGenFilterDPS300Alg1")) {
      // nothing
    } else if (algo.DetailedName.startsWith("GainAlg")) {
      arr.push(<SliderParam name={param.Name}/>)
    }else if (algo.DetailedName.startsWith("EQGenFilter")) {
    }else {
      arr.push(<Param addr={param['0Address']} key={param.Name} data={param}/>)
    }
  }
  if(algo.DetailedName.startsWith("PEQ1Chan_SinglePrec") || algo.DetailedName.startsWith("EQGenFilterDPS300")) {
    arr.push(makeBiquad(module_i, algo.DetailedName, algo.params))
  }
  if(algo.DetailedName.startsWith("EQGenFilterDPS300")) {
    arr.push(<XoverParam/>)
  }
  return arr;
  //return algo.params.map((param) => <Param addr={param.Address} key={param.Name} data={param}/>)
}

// function makeGraph(module_i, algo) {
//   const prefix = "PEQ1Chan_SinglePrec";
//   var biquads = [];

//   if (algo.DetailedName.startsWith(prefix)) {
//     var guys = ""
//     for(var i=0;i<algo.params.length;i++) {
//       var short = algo.params[i].Name.substring(algo.DetailedName.length);
//       guys += short + "=" + algo.params[i].Value + ",";
//       var biquad_param = short.substring(0,2);
//       var biquad_index = short.substring(2);
//       var biquad_index = parseInt(biquad_index)
//       var biquad_param = biquad_param == "1A" ? 0 : biquad_param == "2A" ? 1 : biquad_param == "0B" ? 2 : biquad_param == "1B" ? 3 : biquad_param == "2B" ? 4 : -1;
//       var position = biquad_param
//       if(biquads[biquad_index] == null) {
//         biquads[biquad_index] = [] // [position] =algo.params[i].Value;
//       }
//       biquads[biquad_index][biquad_param]  =algo.params[i].Value
      

//     }
//     console.log("BIQUAD!!!", biquads)
//     return <p><svg/>{guys}</p>;
//   }else{
//     return ""
//   }
// }

const Module = (props) => {
    const value = useSelector((state) => state.json.json)

    //console.log("Module ", props.CellName, props)
    var algos = props.data.algorithms;
    if(algos === undefined) return "";
    var algo = algos[0];
    
      if(!props.CellName.startsWith("Ch1.")) return;
    return  <Card  variant="outlined"><CardHeader title={props.CellName} subheader={algo.DetailedName}/>
       {/*makeGraph(props.module_i, algo)*/}
       {makeWidgets(props.module_i, algo)}
       <br/></Card>
       /*{algo.params.map((param) => <Param addr={param.Address} key={param.Name} data={param}/>)}*/
    
}

const filterTypes = ["lowpass", "highpass", "bandpass", "notch", "peaking", "allpass", "lowshelf", "highshelf"];


const PEQGraph = (props) => {
    //var allowed = state.json.nameToParam.keys().filter(x=>x.startsWith(this.props.name))
    //console.log("BIQU", props.algo_name, props.paramNames)
    //useSelector((state) => .fromEntries()))

    const propvalue = useSelector((state) => state.json.nameToCleanParam[props.Name]);

    var filters = propvalue.Filters;
    var biquads = [];
    if(filters) {
      for(var i=0;i<filters.length;i++) {
        if(filters[i].biquad)  {
          biquads.push(filters[i].biquad);
        }
      }
    }

    const ymin = -15;
    const ymax = 15.;
    const xmin=20.;
    const xmax=24000.;
    const W = 640;
    const H = 200;
    var samples = []
    var exprange = [1.0, Math.log10(24000)];
    var nsamples = 100;
    var dexp = (exprange[1] - exprange[0]) / nsamples;
    var vals = [];
    var xs = [];

    const xwindow = x => W/(Math.log10(xmax)-Math.log10(xmin)) * (Math.log10(x)-Math.log10(xmin));
    const ywindow = y => H-H/(ymax-ymin) * (y-ymin)
    for (var i = 1.0; i < Math.log10(24000); i += dexp) {
       var x = Math.pow(10.0, i);
        samples.push(x);
        vals.push(1.);
        xs.push([xwindow(x),0]);
    }
    //console.log("samples!",samples);

    var xaxis = [[xwindow(xmin),ywindow(0)],[xwindow(xmax),ywindow(0)]];
    var ygrid = "";
    var texts = [];
    for(var xbase=1; xbase < xmax; xbase *= 10) {
      texts.push(<text x={xwindow(xbase)} y={ywindow(0)+15}>{xbase}</text>)
      for(var x=xbase; x<xbase*10; x+=(xbase*10-xbase)/10){
        ygrid += "M ";
        ygrid += xwindow(x) + " "
        ygrid += ywindow(ymax) + " "
        ygrid += "L ";
        ygrid += xwindow(x) + " "
        ygrid += ywindow(ymin) + " "
      }
    }
    for(var y=Math.floor(ymin/5)*5; y<=ymax;y+=5){
      texts.push(<text x={0} y={ywindow(y)}>{y}</text>)
      ygrid += "M ";
      ygrid += xwindow(xmin) + " "
      ygrid += ywindow(y) + " "
      ygrid += "L ";
      ygrid += xwindow(xmax) + " "
      ygrid += ywindow(y) + " "
    }

    for(var ii in biquads ) {
      var b=  biquads[ii];
      var a1 = -b[0];
      var a2 = -b[1];
      var [b0, b1, b2] = [b[2], b[3], b[4]];
      for(var i = 0; i < samples.length; i++) {
        var w = samples[i] / 48000. * Math.PI*2.;
        var re1 = Math.cos(w);
        var im1 = -Math.sin(w);
        var re2 = Math.cos(2 * w);
        var im2 = -Math.sin(2 * w);
        var re_num = b0 + b1 * re1 + b2 * re2;
        var im_num = b1 * im1 + b2 * im2;
        var re_den = 1 + a1 * re1 + a2 * re2;
        var im_den = a1 * im1 + a2 * im2;
        var den = re_den * re_den + im_den * im_den;
        var re_fin = (re_num * re_den + im_num * im_den) / den;
        var im_fin = (im_num * re_den - re_num * im_den) / den;
        var val2 = im_fin * im_fin + re_fin * re_fin;
        var val = Math.sqrt(val2);
        vals[i] *= val;
      }
    }
    //console.log("vals",vals);
    for(var i = 0; i < samples.length; i++) {
      xs[i][1] = H-H/(ymax-ymin) * (Math.log10(vals[i])*20.-ymin)
     // console.log("biquads", biquads);
    }
    xs.push([xs[xs.length-1][0],H])
    xs.push([xs[0][0],H])
    //console.log(xs);
    return <span>{props.name} <svg width={640} height={200}> {texts}
       <polyline points={xaxis}  style={{fill:null,stroke:"black","stroke-width":1,"fill":"#aaaaaa"}} />
       <polyline points={xs}  style={{fill:null,stroke:"green","stroke-width":0,"fill":"#aaaaaa88"}} />
       <path d={ygrid}  fill={"none"} stroke={"#00000055"}/>
      </svg></span>

}

const PEQFilter = (props) => {
  const dispatch = useDispatch();
  const handleChange = (key, value) => {
    dispatch(updateFilter({ name: props.Name, index: props.Index, key: key, value: value }));
  };

  var filter = useSelector((state) => state.json.nameToCleanParam[props.Name].Filters[props.Index]);
  //console.log("FILTER", filter)
  if (filter == undefined) {
    dispatch(updateFilter({ name: props.Name, create: true, index: props.Index }))
    return <p></p>
  }

  return (
    <CardContent sx={{ padding: 0, width: "100%" }}>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "nowrap", overflowX: "auto", overflowY: "hidden" }}>
        <FormControl sx={{ minWidth: 120 }}>
          <InputLabel>Type</InputLabel>
          <Select inputProps={{ style: { height: 5, padding: "5px" } }} value={filter.type} onChange={(e) => handleChange("type", e.target.value)}>
            {filterTypes.map((type) => (
              <MenuItem key={type} value={type}>{type}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl sx={{ width: 150 }}>
          <Typography sx={{ fontSize: 12 }}>Freq (Hz)</Typography>
          <TextField type="number" inputProps={{ style: { height: 10, padding: "5px" } }} value={filter.frequency} onChange={(e) => handleChange("frequency", Number(e.target.value))} />
          <Slider min={20} max={20000} step={1} value={filter.frequency} onChange={(_, val) => handleChange("frequency", val)} />
        </FormControl>

        <FormControl sx={{ width: 120 }}>
          <Typography sx={{ fontSize: 12 }}>Boost (dB)</Typography>
          <TextField type="number" inputProps={{ style: { height: 10, padding: "5px" } }} value={filter.boost} onChange={(e) => handleChange("boost", Number(e.target.value))} />
          <Slider min={-24} max={24} step={0.1} value={filter.boost} onChange={(_, val) => handleChange("boost", val)} />
        </FormControl>

        <FormControl sx={{ width: 120 }}>
          <Typography sx={{ fontSize: 12 }}>Gain (dB)</Typography>
          <TextField type="number" inputProps={{ style: { height: 10, padding: "5px" } }} value={filter.gain} onChange={(e) => handleChange("gain", Number(e.target.value))} />
          <Slider min={-24} max={24} step={0.1} value={filter.gain} onChange={(_, val) => handleChange("gain", val)} />
        </FormControl>

        <FormControl sx={{ width: 120 }}>
          <Typography sx={{ fontSize: 12 }}>Q</Typography>
          <TextField type="number" inputProps={{ style: { height: 10, padding: "5px" } }} value={filter.q} onChange={(e) => handleChange("q", Number(e.target.value))} />
          <Slider min={0.1} max={10} step={0.1} value={filter.q} onChange={(_, val) => handleChange("q", val)} />
        </FormControl>

        <FormControl sx={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
          <Typography sx={{ fontSize: 12 }}>Bypass</Typography>
          <Switch checked={filter.bypass} onChange={(e) => handleChange("bypass", e.target.checked)} />
        </FormControl>
      </Box>


    </CardContent>
  );
}



const crossoverTypes = [
  { name: "Bypass", value: "bypass" },
  { name: "Butterworth 12", value: "butterworth-12" },
  { name: "Butterworth 24", value: "butterworth-24" },
  { name: "Linkwitz-Riley 12", value: "lr-12" },
  { name: "Linkwitz-Riley 24", value: "lr-24" },
//{ name: "Linkwitz-Riley 36", value: "lr-36" },
  { name: "Linkwitz-Riley 48", value: "lr-48" },
];

const pass = [
  { name: "Low Pass", value: "lowpass" },
  { name: "High Pass", value: "highpass" },
];


const XOverWidget = (props) => {
  const dispatch = useDispatch();
  var filter = useSelector((state) => state.json.nameToCleanParam[props.Name].Filter);
  if (filter == undefined) {
    dispatch(updateXover({name: props.Name, create: true}))
    return <p></p>
  }
  const handleChange = (key, value) => {
    dispatch(updateXover({ name: props.Name, key: key, value: value }));
  };

  return (
    <Card sx={{ padding: 1, width: "100%" }}>
      <CardContent>
        <PEQGraph Name={props.Name}/>;
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "nowrap", overflowX: "auto", overflowY: "hidden" }}>
          <FormControl sx={{ minWidth: 100 }}>
            <InputLabel>Type</InputLabel>
            <Select value={filter.type} onChange={(e) => handleChange("type", e.target.value)}>
              {crossoverTypes.map((type, index) => (
                <MenuItem key={index} value={type.value}>{type.name}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 80 }}>
            <InputLabel>Pass</InputLabel>
            <Select value={filter.pass} onChange={(e) => handleChange("pass", e.target.value)}>
              {pass.map((pass, index) => (
                <MenuItem key={index} value={pass.value}>{pass.name}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField 
            label="Freq" 
            type="number" 
            value={filter.frequency} 
            onChange={(e) => handleChange("frequency", Number(e.target.value))} 
            sx={{ width: 70, '& .MuiInputBase-root': { height: 30 } }}
          />
        </Box>
      </CardContent>
    </Card>
  );

};

const PEQ = (props) => {
  const propvalue = useSelector((state) => state.json.nameToCleanParam[props.Name]);
  var stuff = [];
  stuff.push(<PEQGraph Name={propvalue.Name} id={propvalue.Name}/>);
  for(var i=0;i<propvalue.Biquads;i++) {
    stuff.push(<PEQFilter Name={propvalue.Name} Index={i} id={propvalue.Name+i}/>)
  }
  return stuff;
}

const CleanParam = (props) => {


  const propvalue = useSelector((state) => state.json.nameToCleanParam[props.Name]);
  return  <Card  variant="outlined"><CardHeader title={props.Name}/>
    {
      propvalue.Type=="PEQ" ? <PEQ Name={props.Name}/> : 
      propvalue.Type=="Crossover" ? <XOverWidget Name={props.Name}/>: <p>Unknown</p>
    }</Card>

}

const Edits = (props) => {
  const eds = useSelector((state) => state.json.edits)
  var stuff = [<h3>Edits</h3>]
  console.log("REDRAW")
  if(eds) {
    console.log("EDITS count", eds.length)
    for(var i=0;i<eds.length;i++) {
      stuff.push(<p>{JSON.stringify(eds[i])}</p>)
    }
  } else{
    console.log("EDITS INVALID")
  }
  return stuff
};



const Modules = (props) => {
  const value = useSelector((state) => state.json.json)
  
  //const [globalState, globalActions] = useGlobal();
  //console.log(globalActions)
  //console.log(globalActions.get)
  //var v = globalActions.get();
  //console.log("IN REDRAW", value)

  if(value===null || value===undefined){
      return <p>Don't have JSON</p>
  } else {
    // console.log("IN MODULE REDRAW", value)
    var modules_created =["HI"];

    var modules = value.ics[0].modules;
    var clean_params = value.ics[0].clean_params;
    for(var i=0;i<modules.length; i++) {
      var element = modules[i];
      modules_created.push(<Module module_i={i} key={element.CellName} CellName={element.CellName} data={element}/>)
    }

    for(var i=0;i<clean_params.length; i++) {
      var element = clean_params[i];
      modules_created.push(<CleanParam key={element.Name} Name={element.Name}/>)
    }

    modules_created.push(<Edits/>);
    return modules_created;
      //return v.ics[0].modules.map((element)  =>
           //<Module key={element.CellName} CellName={element.CellName} data={element}/>)
      
  }
  
};

//export default Modules;

export {Modules};
