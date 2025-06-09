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
var master_hz = 48000;

// Given coefficientts f = [a1,a2,b0,b1,b2] and omega compute filter.
function biquad_mag(f, w) {
    var a1 = f[0];
    var a2 = f[1];
    var b0 = f[2];
    var b1 = f[3];
    var b2 = f[4];
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
    return val;
}

function fun1(x) {
    var res = 1.0;
    for (var index = 0; index < coefficients.length; index++) {
        res *= biquad_mag(coefficients[index], x);
    }
    return res;
}

function peak_to_biquad(hz, fc, q, boost, gain) {
    // TODO factor out repeated
    var Ax = Math.pow(10.0, boost / 40.0);
    var omega = 2 * Math.PI * fc / hz;
    var sn = Math.sin(omega);
    var cs = 1.0 - 2 * Math.sin(omega * .5) ** 2;
    var alpha = sn / (2 * q);

    var a0 = 1 + alpha / Ax;
    var a1 = -2 * cs / a0;
    var a2 = (1 - alpha / Ax) / a0;
    var gainlinear = Math.pow(10.0, gain / 20.0) / a0;
    var b0 = (1 + alpha * Ax) * gainlinear;
    var b1 = - 2 * cs * gainlinear;
    var b2 = (1 - alpha * Ax) * gainlinear;
    return [a1, a2, b0, b1, b2]
}

function high_shelf_to_biquad(hz, fc, q, boost, gain) {
    // TODO factor out repeated
    var Ax = Math.pow(10.0, boost / 40.0);
    var omega = 2 * Math.PI * fc / hz;
    var sn = Math.sin(omega);
    var cs = 1.0 - 2 * Math.sin(omega * .5) ** 2;
    var alpha =sn / (2*q);

    var gainlinear = Math.pow(10.0, gain / 20.0);
    var rt = 2*Math.sqrt(Ax)*alpha;
    var a0 = (Ax+1)-(Ax-1)*cs+rt;
    var b0 = Ax * ((Ax+1)+(Ax-1)*cs + rt);
    var b1 = -2*Ax * ((Ax-1)+(Ax+1)*cs) * gainlinear;
    var b2 = Ax*((Ax+1)+(Ax-1)*cs-rt) * gainlinear;
    var a1 = 2*((Ax-1)-(Ax+1)*cs) * gainlinear;
    var a2=(Ax+1)-(Ax-1)*cs-rt;
    return [a1/a0,a2/a0,b0/a0,b1/a0,b2/a0]
}

function low_shelf_to_biquad(hz, fc, q, boost, gain) {
    // TODO factor out repeated
    var Ax = Math.pow(10.0, boost / 40.0);
    var omega = 2 * Math.PI * fc / hz;
    var sn = Math.sin(omega);
    var cs = 1.0 - 2 * Math.sin(omega * .5) ** 2;
    var alpha =sn / (2*q);

    var gainlinear = Math.pow(10.0, gain / 20.0);
    var rt = 2*Math.sqrt(Ax)*alpha;
    const a0 = (Ax+1)+(Ax-1)*cs+rt;
    const b0 = Ax * ((Ax+1)-(Ax-1)*cs + rt);
    const b1 = 2*Ax * ((Ax-1)-(Ax+1)*cs) * gainlinear;
    const b2 = Ax*((Ax+1)-(Ax-1)*cs-rt) * gainlinear;
    const a1 = -2*((Ax-1)+(Ax+1)*cs) * gainlinear;
    const a2=(Ax+1)+(Ax-1)*cs-rt;
    return [a1/a0,a2/a0,b0/a0,b1/a0,b2/a0]
}

function lowpass_to_biquad(hz, fc, q, boost, gain) {
    var omega = 2 * Math.PI * fc / hz;
    var sn = Math.sin(omega);
    var cs = 1.0 - 2 * Math.sin(omega * .5) ** 2;
    var alpha =sn / (2*q);

    var a0 = 1+alpha
    var a1 = -2*cs / a0
    var a2 = (1 - alpha) / a0
    var b0 = (1-cs)/2 / a0
    var b1 = (1-cs) / a0
    var b2 = (1-cs)/2 / a0
    return [a1,a2,b0,b1,b2]
}

function highpass_to_biquad(hz, fc, q, boost, gain) {
    var omega = 2 * Math.PI * fc / hz;
    var sn = Math.sin(omega);
    var cs = 1.0 - 2 * Math.sin(omega * .5) ** 2;
    var alpha =sn / (2*q);

    var a0 = 1+alpha
    var a1 = -2*cs / a0
    var a2 = (1 - alpha) / a0
    var b0 = (1+cs)/2 / a0
    var b1 = -(1+cs) / a0
    var b2 = (1+cs)/2 / a0
    return [a1,a2,b0,b1,b2]
}



var biquads = [
/*    { "f": 10000.0, "gain": 0.0, "boost": 1.0, "q": 1.5, "type": "peaking" },
    { "f": 5000.0, "gain": 0.0, "boost": 2.0, "q": 0.5, "type": "peaking" },
    { "f": 50.0, "gain": 0.0, "boost": -1.0, "q": 1.5, "type": "peaking" },
    { "f": 100.0, "gain": 0.0, "boost": -1.0, "q": 1.5, "type": "peaking" }*/
    /*{ "f": 1600.0, "gain": 0.0, "boost": -2.5, "q": 2.5, "type": "peaking" },*/
    
    { "f": 5000000000000000000.0, "gain": 0.0, "boost": 0.0, "q": 0.71, "type": "lowpass" },
    { "f": 5000000000000000000.0, "gain": 0.0, "boost": 0.0, "q": 0.71, "type": "lowpass" },
    /*{ "f": 500.0, "gain": 0.0, "boost": 5.0, "q": 1.41, "type": "peaking" },
    { "f": 1600.0, "gain": 0.0, "boost": 0., "q": 2.5, "type": "peaking" },
    { "f": 10000.7, "gain": 0.0, "boost": 7.5, "q": 0.5, "type": "high_shelf" },
    { "f": 700, "gain": 0.0, "boost": 5., "q": 1.2, "type": "low_shelf" }*/
    /*{ "f": 10000, "gain": 0.0, "boost": 1., "q": 1.2, "type": "lowpass", "color": "#aa6666",},
    { "f": 700, "gain": 0.0, "boost": 1., "q": 1.2, "type": "highpass", "color": "#66aa66" }*/
]
var coefficients = [];
var woot = [{}];
function biquad_to_coefficient(biquad) {
    if(biquad["type"] == "peaking") return peak_to_biquad(master_hz, biquad.f, biquad.q, biquad.boost, biquad.gain);
    else if(biquad["type"] == "highshelf") return high_shelf_to_biquad(master_hz, biquad.f, biquad.q, biquad.boost, biquad.gain);
    else if(biquad["type"] == "lowshelf") return low_shelf_to_biquad(master_hz, biquad.f, biquad.q, biquad.boost, biquad.gain);
    else if(biquad["type"] == "lowpass") return lowpass_to_biquad(master_hz, biquad.f, biquad.q, biquad.boost, biquad.gain);
    else if(biquad["type"] == "highpass") return highpass_to_biquad(master_hz, biquad.f, biquad.q, biquad.boost, biquad.gain);
    else console.log("Invalid filter type")
}


function filter_object_to_biquad(filterdef) {
    var master_hz = 48000;
    var biquad = null;
    if(filterdef.bypass) {
        biquad=[0., 0., 1., 0., 0.]
    } else {
        if(filterdef["type"] == "lowpass") biquad = lowpass_to_biquad(master_hz, filterdef.frequency, filterdef.q, filterdef.boost, filterdef.gain);
        else if(filterdef["type"] == "highpass") biquad = highpass_to_biquad(master_hz, filterdef.frequency, filterdef.q, filterdef.boost, filterdef.gain);
        else if(filterdef["type"] == "peaking") biquad = peak_to_biquad(master_hz, filterdef.frequency, filterdef.q, filterdef.boost, filterdef.gain);
        else if(filterdef["type"] == "highshelf") biquad = high_shelf_to_biquad(master_hz, filterdef.frequency, filterdef.q, filterdef.boost, filterdef.gain);
        else if(filterdef["type"] == "lowshelf") biquad = low_shelf_to_biquad(master_hz, filterdef.frequency, filterdef.q, filterdef.boost, filterdef.gain);
        biquad[0] = -biquad[0]
        biquad[1] = -biquad[1]
    }
    return biquad;
}

function butterworth_1st_to_biquad(master_hz, freq, pass) {
    const gain = 1.
    const w0=2*Math.PI*freq/master_hz
    const c=Math.cos(w0);
    const s=Math.sin(w0);
    const a0 = s+c+1;

    if(pass == "lowpass") {
        return [-(s-c-1)/a0, -0, gain*s/a0, gain*s/a0,0.]; 
    } else if(pass == "highpass") {
        return [-(s - c - 1) / a0, 0, gain * (1+c)/a0, -gain*(1+c)/a0,0. ]
    } else {
        return [0,0,1,0,0]
    }
}


function crossover_object_to_biquad(xoverdef) {
    console.log("XOVER", xoverdef)
    const max_n = 4;
    const null_filter = [0., 0., 1., 0., 0.]
    var biquads = [];
    function get_q(n, N) {
        return 1/( 2*Math.sin((Math.PI/N)*(n + 1/2)))
    }
    console.log("xoverdef", xoverdef, xoverdef.pass)
    var general_filter = xoverdef.pass == "lowpass" ? lowpass_to_biquad 
            : xoverdef.pass == "highpass" ? highpass_to_biquad : null

    if(xoverdef.type.startsWith("butterworth")) {
        var order = xoverdef.type=="butterworth-12" ? 2
                  : xoverdef.type=="butterworth-24" ? 4 : 0
        var biquads = [];
        const nbiquads = (order-1)/2
        for(var i=0;i<nbiquads; i++) {
            var q = get_q(i, order);
            console.log("butter q=",q, " i=", i, " order=", order)
            biquads[i] = general_filter(master_hz, xoverdef.frequency, q, 0., 0.)
        }
        for(; i < max_n; i++) {
            biquads[i] = null_filter;
        }
        console.log("butter", order, nbiquads, i, biquads)
    } else if(xoverdef.type.startsWith("lr")) {
        var order = xoverdef.type=="lr-12" ? 2
                  : xoverdef.type=="lr-24" ? 4
                  //: xoverdef.type=="lr-36" ? 6
                  : xoverdef.type=="lr-48" ? 8
                  : 0

        var butterworth_order = order / 2;
        var biquads = []
        const nbiquads = Math.ceil((butterworth_order-1)/2)
        if(nbiquads == 0){
            // special handling
            //biquads[0] = linkwitz_12_to_biquad(master_hz, xoverdef.frequency);
            biquads[0] = butterworth_1st_to_biquad(master_hz, xoverdef.frequency, xoverdef.pass)
            biquads[1] = biquads[0] // general_filter(master_hz, xoverdef.frequency, .5, 0., 0.);
            for(var i=2;i<max_n;i++) biquads[i] = null_filter;
        }else {
            console.log("n biquad", nbiquads)
            for(var i=0;i<nbiquads; i++) {
                var butterq = get_q(i, butterworth_order)
                console.log("butter q", i, butterq)
                biquads[i] =general_filter(master_hz, xoverdef.frequency, butterq, 0., 0.);
                biquads[i+nbiquads] =general_filter(master_hz, xoverdef.frequency, butterq, 0., 0.);
            }
            for(i=2*i;i<max_n;i++) biquads[i] = null_filter;
        }
        console.log("l-r", i, biquads)
    } else {
        biquads = [null_filter, null_filter, null_filter, null_filter]
    }
    // negate a
    for(var i=0;i<max_n;i++) {
        biquads[i][0] = -biquads[i][0]
        biquads[i][1] = -biquads[i][1]
    }
    return biquads;
}

var addFilter = null;


/*
function buildGraph() {
    var width = 900;
    var height = 480;
    var margin = { "left": 50, "top": 50, "bottom": 100, "right": 50 }
    var svg = d3.select("body").append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    var x = d3.scaleLog().base(10).domain([22.0, 24000.]).range([0, width]).clamp(true)
    var y = d3.scaleLinear().domain([-60, 20.]).range([height, 0]).clamp(true)

    /// Axes
    var yAxis = d3.axisLeft(y)
    var xAxis = d3.axisBottom(x)  // .ticks(3).tickFormat(d3.format('e'))

    // Build data
    var table = d3.select("body").append("table");
    var header = table.append("tr");
    header.append("th").text("Color")
    header.append("th").text("Freq (Hz)")
    header.append("th").text("Q")
    header.append("th").text("Boost (dB)")
    header.append("th").text("Gain (dB)")
    header.append("th").text("Type")

    // Axes and gridlines
    svg.append("g")
        .attr("class", "axis axis--y")
        .attr("transform", "translate(-10,0)")
        .call(yAxis);
    svg.append("g")
        .attr("class", "axis axis--y")
        .attr("transform", "translate(-10,0)")
        .call(yAxis);
    svg.append("g")
        .attr("class", "axis axis--x")
        .attr("transform", "translate(0," + (height + 10) + ")")
        .call(xAxis);
    svg.append("g")
        .attr("class", "gridlines")
        .attr("transform", "translate(0," + (height) + ")")
        .call(xAxis.tickSize(-height).tickFormat(""));
    svg.append("g")
        .attr("class", "gridlines")
        .call(yAxis.ticks(5).tickSize(-width).tickFormat(""));

    // Workaround bad sampling
    //var sampling_x = d3.scaleLinear().domain([1.0, 24000.]).nice(2000).range([1.0, 24000.])
    //var samples = sampling_x.ticks(2000).filter(function(x){return x>0.0;});
    var samples = []
    var exprange = [1.0, Math.log10(24000)];
    var nsamples = 50;
    var dexp = (exprange[1] - exprange[0]) / nsamples;
    for (var i = 1.0; i < Math.log10(24000); i += dexp) {
        samples.push(Math.pow(10.0, i));
    }

    // Add graph curve
    svg.append("path")
        .attr("class", "responsecurve")
        .attr("stroke", "steelblue")
        .attr("stroke-width", 2)
        .attr("fill","#0000aa22")

    var cpFreqDragHandler = d3.drag()
        .on("drag", function (d) {
            d.f = x.invert(x(d.f) + d3.event.x);
            d.boost = y.invert(y(d.boost) + d3.event.y);
            d3.select(this.parentNode).attr("transform", function (d) {
                return "translate(" + x(d.f) + "," + y(d.boost) + ")"
            })
            rebuildGraph();
            rebuildCp();
            rebuildTable();

        });

    var qDragHandler = d3.drag()
        .on("drag", function (d) {
            d.q = 50 / d3.event.x;
            d3.select(this).attr("cx", d3.event.x);
            rebuildGraph();
            rebuildCp();
            rebuildTable();
        });

    function sample_box_it() {
        var woot = []
        var miny = 10
        var ws = []
        for(var i=0;i<samples.length;i++) {
            var xx = samples[i];
            var sample = xx / master_hz * 2 * Math.PI;
            ws.push(sample)
            var yy = 20*Math.log10(fun1(sample));
            miny = Math.min(miny, yy)
            woot.push([x(xx), y(yy)]) 
        }
        //console.log(samples)
        //console.log(ws)
        miny = Math.min(miny, -200);
        for(var i=samples.length-1;i>=0;i--) {
            var xx = samples[i];
            woot.push([x(xx), y(miny)])
        }
        return woot;
    
    }

    function rebuildGraph() {
        console.log("Graph reb")
        coefficients = biquads.map(biquad_to_coefficient);
        console.log(coefficients)
        d3.select(".responsecurve")
        // .attr("d", d3.line()
        //     .x([3e1,2e+4])
        //     .y([-2.,3.])
        // )
           .attr("d", d3.line()(
   
                sample_box_it()
           ));
    }
    
    // Arbitrary mapping between q and pixels!
    function qToOffset(d) { return 50 / d }
    function rebuildCp() {
        var cp = svg.selectAll(".cp").data(biquads)
        cp = cp.enter()
            .append("g")
            .attr("transform", function (d) {
                return "translate(" + x(d.f) + "," + y(d.boost) + ")"
            })
            .attr("class", "cp");
        cp.append("line")
            .attr("stroke", function(d) {return  d.color;}) // "#aaa") //d.color)
            .attr("stroke-width", "1px")
            .attr("class", "conn")
            .attr("x1", 0)
            .attr("y1", 0)
            .attr("x2", function (d) { return qToOffset(d.q) })
            .attr("y2", 0)
        cp.append("circle")
            .attr("r", 5)
            .attr("class", "cp_freq")
            .attr("fill", function(d){return d.color;})
        cp.append("circle")
            .attr("r", 3)
            .attr("fill", function(d){return d.color;})
            .attr("class", "cp_q")
            .attr("cx", function (d) { return qToOffset(d.q) })
        svg.selectAll(".cp").data(biquads).selectAll(".conn")
            .attr("x2", function (d) {
                return qToOffset(d.q)
            })


        cpFreqDragHandler(cp.selectAll(".cp_freq"))
        qDragHandler(cp.selectAll(".cp_q"));


    }

    function rebuildTable() {
        var rows = table.selectAll(".filterRow").data(biquads)
        rows.enter().append("tr").attr("class", "filterRow")//.style("background-color", function(d){return d.color;});

        var col = rows.selectAll("td").data(function (row) {
            return ["<span style=\"background-color: "+row.color+"\">&nbsp;&nbsp;&nbsp;&nbsp;</span>", row.f, row.q, row.boost, row.gain, row.type];
        })
        col.enter().append("td").attr("align","right")
        col.html(function (d) {
            return typeof (d) == "number" ?
                Math.round(d * 100, 1) / 100 : d;
        });

    }

    function addFilterImpl() {
        //console.log("woo")
        biquads.push({ "f": 5000.0, "gain": 0.0, "boost": 2.0, "q": 0.5, "type": "peaking" })
        //#biquads.push({ "f": 500.0, "gain": 0.0, "boost": 5.0, "q": 1.41, "type": "peaking" })

        rebuildGraph();
        rebuildTable();
        rebuildCp();
    }
    addFilter = addFilterImpl;

    // Do inittial build
    rebuildGraph();
    rebuildCp();
    // Why 3 are required update() vs enter() probably.
    rebuildTable();
    rebuildTable();
    rebuildTable();

}

*/

export {filter_object_to_biquad, crossover_object_to_biquad}
    