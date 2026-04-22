// DataForge v2 - Compact Data Analysis & Visualization Toolkit
// Zero-dependency: statistics, regression, correlation, charts, clustering
(function() {
"use strict";

// === Series: 1D labeled numeric array ===
function Series(data, name) {
  var d = data.slice().map(Number);
  var s = {};
  s.name = name || 'Series';
  s.values = d;
  s.length = d.length;
  s.sum = function() { var t = 0; for (var i = 0; i < d.length; i++) t += d[i]; return t; };
  s.mean = function() { return s.sum() / d.length; };
  s.min = function() { return Math.min.apply(null, d); };
  s.max = function() { return Math.max.apply(null, d); };
  s.sorted = function() { return d.slice().sort(function(a,b){return a-b;}); };
  s.median = function() { var v = s.sorted(), m = Math.floor(v.length/2); return v.length%2 ? v[m] : (v[m-1]+v[m])/2; };
  s.percentile = function(p) { var v = s.sorted(), i = (p/100)*(v.length-1), lo = Math.floor(i), hi = Math.ceil(i); return lo===hi ? v[lo] : v[lo]+(v[hi]-v[lo])*(i-lo); };
  s.variance = function() { var m = s.mean(), t = 0; for (var i = 0; i < d.length; i++) t += (d[i]-m)*(d[i]-m); return t/(d.length-1); };
  s.std = function() { return Math.sqrt(s.variance()); };
  s.skewness = function() { var m = s.mean(), sd = s.std(), n = d.length, t = 0; for (var i = 0; i < n; i++) t += Math.pow((d[i]-m)/sd,3); return (n/((n-1)*(n-2)))*t; };
  s.kurtosis = function() { var m = s.mean(), sd = s.std(), n = d.length, t = 0; for (var i = 0; i < n; i++) t += Math.pow((d[i]-m)/sd,4); return ((n*(n+1))/((n-1)*(n-2)*(n-3)))*t - (3*(n-1)*(n-1))/((n-2)*(n-3)); };
  s.describe = function() {
    return {count:d.length,mean:s.mean(),std:s.std(),min:s.min(),'25%':s.percentile(25),
      '50%':s.median(),'75%':s.percentile(75),max:s.max(),skew:s.skewness(),kurt:s.kurtosis()};
  };
  s.outliers = function() {
    var q1 = s.percentile(25), q3 = s.percentile(75), iqr = q3-q1;
    var lo = q1-1.5*iqr, hi = q3+1.5*iqr;
    return {lower:lo, upper:hi, outliers:d.filter(function(v){return v<lo||v>hi;})};
  };
  s.zScores = function() { var m = s.mean(), sd = s.std(); return d.map(function(v){return (v-m)/sd;}); };
  s.normalize = function() { var mn = s.min(), mx = s.max(), r = mx-mn||1; return d.map(function(v){return (v-mn)/r;}); };
  return s;
}

// === DataFrame: 2D table ===
function DataFrame(rows, cols) {
  var df = {};
  df.rows = rows;
  df.columns = cols || (rows.length ? Object.keys(rows[0]) : []);
  df.shape = [rows.length, df.columns.length];
  df.col = function(name) { return Series(rows.map(function(r){return r[name];}), name); };
  df.select = function(names) { return DataFrame(rows.map(function(r){ var o={}; names.forEach(function(n){o[n]=r[n];}); return o; }), names); };
  df.filter = function(fn) { return DataFrame(rows.filter(fn), df.columns); };
  df.sort = function(col, asc) { var m = asc === false ? -1 : 1; return DataFrame(rows.slice().sort(function(a,b){ return a[col]<b[col]?-m:a[col]>b[col]?m:0; }), df.columns); };
  df.addColumn = function(name, fn) { var newCols = df.columns.concat([name]); return DataFrame(rows.map(function(r,i){var o={}; for(var k in r) o[k]=r[k]; o[name]=fn(r,i); return o;}), newCols); };
  df.groupBy = function(col) {
    var groups = {};
    rows.forEach(function(r) { var k = r[col]; if (!groups[k]) groups[k] = []; groups[k].push(r); });
    return {
      agg: function(specs) {
        var result = [];
        Object.keys(groups).forEach(function(k) {
          var row = {}; row[col] = k;
          Object.keys(specs).forEach(function(c) {
            var vals = groups[k].map(function(r){return Number(r[c]);});
            var fn = specs[c];
            if (fn === 'mean') row[c+'_mean'] = vals.reduce(function(a,b){return a+b;},0)/vals.length;
            else if (fn === 'sum') row[c+'_sum'] = vals.reduce(function(a,b){return a+b;},0);
            else if (fn === 'count') row[c+'_count'] = vals.length;
            else if (fn === 'min') row[c+'_min'] = Math.min.apply(null,vals);
            else if (fn === 'max') row[c+'_max'] = Math.max.apply(null,vals);
          });
          result.push(row);
        });
        return DataFrame(result);
      }
    };
  };
  df.describe = function() {
    var numCols = df.columns.filter(function(c){return typeof rows[0][c] === 'number';});
    var stats = {};
    numCols.forEach(function(c) { stats[c] = df.col(c).describe(); });
    return stats;
  };
  df.head = function(n) { return DataFrame(rows.slice(0, n||5), df.columns); };
  df.print = function(maxRows) {
    var mr = maxRows || 10;
    var widths = {};
    df.columns.forEach(function(c) { widths[c] = c.length; });
    var show = rows.slice(0, mr);
    show.forEach(function(r) { df.columns.forEach(function(c) { var l = String(r[c]).length; if (l > widths[c]) widths[c] = Math.min(l, 12); }); });
    var hdr = '#     ';
    df.columns.forEach(function(c) { hdr += (c + '            ').substring(0, Math.max(widths[c]+2, c.length+2)); });
    console.log(hdr);
    console.log(new Array(hdr.length+1).join('-'));
    show.forEach(function(r, i) {
      var line = (i + '     ').substring(0,6);
      df.columns.forEach(function(c) { line += (String(r[c]) + '            ').substring(0, Math.max(widths[c]+2, c.length+2)); });
      console.log(line);
    });
    if (rows.length > mr) console.log('... (' + (rows.length-mr) + ' more rows)');
    console.log('[' + rows.length + ' rows x ' + df.columns.length + ' columns]');
  };
  df.corr = function() {
    var numCols = df.columns.filter(function(c){return typeof rows[0][c] === 'number';});
    var matrix = {};
    numCols.forEach(function(a) {
      matrix[a] = {};
      numCols.forEach(function(b) { matrix[a][b] = pearson(rows.map(function(r){return r[a];}), rows.map(function(r){return r[b];})); });
    });
    return matrix;
  };
  return df;
}

// === CSV Parser ===
function parseCSV(text) {
  var lines = text.trim().split('\n');
  var headers = lines[0].split(',').map(function(h){return h.trim().replace(/^"|"$/g,'');});
  var rows = [];
  for (var i = 1; i < lines.length; i++) {
    var vals = lines[i].split(','), row = {};
    for (var j = 0; j < headers.length; j++) {
      var v = (vals[j]||'').trim().replace(/^"|"$/g,'');
      var n = Number(v);
      row[headers[j]] = (v !== '' && !isNaN(n)) ? n : v;
    }
    rows.push(row);
  }
  return DataFrame(rows, headers);
}

// === Statistics ===
function pearson(x, y) {
  var n = x.length, sx = 0, sy = 0, sxy = 0, sx2 = 0, sy2 = 0;
  for (var i = 0; i < n; i++) { sx += x[i]; sy += y[i]; sxy += x[i]*y[i]; sx2 += x[i]*x[i]; sy2 += y[i]*y[i]; }
  var num = n*sxy - sx*sy, den = Math.sqrt((n*sx2-sx*sx)*(n*sy2-sy*sy));
  return den === 0 ? 0 : num/den;
}

function linearRegression(x, y) {
  var n = x.length, sx = 0, sy = 0, sxy = 0, sx2 = 0;
  for (var i = 0; i < n; i++) { sx += x[i]; sy += y[i]; sxy += x[i]*y[i]; sx2 += x[i]*x[i]; }
  var slope = (n*sxy - sx*sy) / (n*sx2 - sx*sx);
  var intercept = (sy - slope*sx) / n;
  var yMean = sy/n, ssRes = 0, ssTot = 0;
  for (var i = 0; i < n; i++) { var pred = slope*x[i]+intercept; ssRes += (y[i]-pred)*(y[i]-pred); ssTot += (y[i]-yMean)*(y[i]-yMean); }
  var rSquared = ssTot === 0 ? 1 : 1 - ssRes/ssTot;
  var se = Math.sqrt(ssRes/(n-2));
  return {slope:slope, intercept:intercept, rSquared:rSquared, se:se, predict:function(v){return slope*v+intercept;}};
}

function tTest(sample, mu0) {
  var s = Series(sample);
  var m = s.mean(), sd = s.std(), n = s.length;
  var t = (m - mu0) / (sd / Math.sqrt(n));
  var df = n - 1;
  var p = tDistP(Math.abs(t), df);
  var ci = 1.96 * sd / Math.sqrt(n);
  return {mean:m, tStat:t, df:df, pValue:p, ci:[m-ci, m+ci]};
}

function tDistP(t, df) {
  var x = df/(df+t*t);
  return incompleteBeta(x, df/2, 0.5);
}

function incompleteBeta(x, a, b) {
  if (x <= 0) return 0; if (x >= 1) return 1;
  var bt = Math.exp(lnGamma(a+b) - lnGamma(a) - lnGamma(b) + a*Math.log(x) + b*Math.log(1-x));
  if (x < (a+1)/(a+b+2)) return bt * betaCF(x, a, b) / a;
  return 1 - bt * betaCF(1-x, b, a) / b;
}

function betaCF(x, a, b) {
  var m, m2, aa, c = 1, d = 1 - (a+b)*x/(a+1);
  if (Math.abs(d) < 1e-30) d = 1e-30; d = 1/d; var h = d;
  for (var i = 1; i <= 100; i++) {
    m = i; m2 = 2*m;
    aa = m*(b-m)*x/((a+m2-1)*(a+m2));
    d = 1+aa*d; if (Math.abs(d)<1e-30) d=1e-30; c = 1+aa/c; if (Math.abs(c)<1e-30) c=1e-30;
    d = 1/d; h *= d*c;
    aa = -(a+m)*(a+b+m)*x/((a+m2)*(a+m2+1));
    d = 1+aa*d; if (Math.abs(d)<1e-30) d=1e-30; c = 1+aa/c; if (Math.abs(c)<1e-30) c=1e-30;
    d = 1/d; var del = d*c; h *= del;
    if (Math.abs(del-1) < 3e-7) break;
  }
  return h;
}

function lnGamma(z) {
  var c = [76.18009172947146,-86.50532032941677,24.01409824083091,-1.231739572450155,0.001208650973866179,-5.395239384953e-6];
  var x = z, y = z, tmp = x + 5.5; tmp -= (x+0.5)*Math.log(tmp);
  var ser = 1.000000000190015;
  for (var j = 0; j < 6; j++) ser += c[j]/++y;
  return -tmp + Math.log(2.5066282746310005*ser/x);
}

// === K-Means Clustering ===
function kMeans(data, k, maxIter) {
  maxIter = maxIter || 50;
  var n = data.length, dim = data[0].length;
  // K-means++ init
  var centroids = [data[Math.floor(Math.random()*n)]];
  for (var c = 1; c < k; c++) {
    var dists = data.map(function(p) {
      return Math.min.apply(null, centroids.map(function(ct) {
        var d = 0; for (var i = 0; i < dim; i++) d += (p[i]-ct[i])*(p[i]-ct[i]); return d;
      }));
    });
    var total = dists.reduce(function(a,b){return a+b;},0);
    var r = Math.random()*total, cum = 0;
    for (var i = 0; i < n; i++) { cum += dists[i]; if (cum >= r) { centroids.push(data[i]); break; } }
  }
  var labels = new Array(n), iter;
  for (iter = 0; iter < maxIter; iter++) {
    var changed = false;
    for (var i = 0; i < n; i++) {
      var best = 0, bestD = Infinity;
      for (var j = 0; j < k; j++) {
        var d = 0; for (var d2 = 0; d2 < dim; d2++) d += (data[i][d2]-centroids[j][d2])*(data[i][d2]-centroids[j][d2]);
        if (d < bestD) { bestD = d; best = j; }
      }
      if (labels[i] !== best) { labels[i] = best; changed = true; }
    }
    if (!changed) break;
    for (var j = 0; j < k; j++) {
      var cnt = 0, sums = new Array(dim);
      for (var d2 = 0; d2 < dim; d2++) sums[d2] = 0;
      for (var i = 0; i < n; i++) { if (labels[i]===j) { cnt++; for (var d2=0;d2<dim;d2++) sums[d2]+=data[i][d2]; }}
      if (cnt > 0) { centroids[j] = sums.map(function(s){return s/cnt;}); }
    }
  }
  var inertia = 0;
  for (var i = 0; i < n; i++) { for (var d2 = 0; d2 < dim; d2++) inertia += (data[i][d2]-centroids[labels[i]][d2])*(data[i][d2]-centroids[labels[i]][d2]); }
  return {labels:labels, centroids:centroids, iterations:iter, inertia:inertia, k:k};
}

// === ASCII Charts ===
function barChart(labels, values, opts) {
  opts = opts || {};
  var w = opts.width || 40, title = opts.title || '';
  var mx = Math.max.apply(null, values);
  if (title) console.log('\n  ' + title);
  for (var i = 0; i < labels.length; i++) {
    var bar = Math.round((values[i]/mx)*w);
    var lbl = (labels[i] + '            ').substring(0, 12);
    var blocks = '';
    for (var j = 0; j < bar; j++) blocks += '#';
    console.log('  ' + lbl + '|' + blocks + ' ' + values[i]);
  }
}

function histogram(data, bins, opts) {
  opts = opts || {};
  bins = bins || 10;
  var mn = Math.min.apply(null, data), mx = Math.max.apply(null, data);
  var step = (mx - mn) / bins, counts = new Array(bins);
  for (var i = 0; i < bins; i++) counts[i] = 0;
  for (var i = 0; i < data.length; i++) {
    var b = Math.min(Math.floor((data[i]-mn)/step), bins-1);
    counts[b]++;
  }
  var labels = [];
  for (var i = 0; i < bins; i++) labels.push((mn + i*step).toFixed(0) + '-' + (mn+(i+1)*step).toFixed(0));
  barChart(labels, counts, {title: opts.title || 'Histogram', width: opts.width || 30});
}

function scatterPlot(x, y, opts) {
  opts = opts || {};
  var w = opts.width || 40, h = opts.height || 15;
  var xMin = Math.min.apply(null,x), xMax = Math.max.apply(null,x);
  var yMin = Math.min.apply(null,y), yMax = Math.max.apply(null,y);
  var grid = [];
  for (var r = 0; r < h; r++) { grid[r] = []; for (var c = 0; c < w; c++) grid[r][c] = ' '; }
  for (var i = 0; i < x.length; i++) {
    var c = Math.min(Math.floor((x[i]-xMin)/(xMax-xMin||1)*(w-1)), w-1);
    var r = Math.min(Math.floor((1-(y[i]-yMin)/(yMax-yMin||1))*(h-1)), h-1);
    grid[r][c] = '*';
  }
  if (opts.title) console.log('\n  ' + opts.title);
  for (var r = 0; r < h; r++) {
    var yLabel = (yMax - r*(yMax-yMin)/(h-1)).toFixed(0);
    console.log(('        '+yLabel).slice(-8) + ' |' + grid[r].join(''));
  }
  console.log('         +' + new Array(w+1).join('-'));
}

function boxPlot(datasets, labels) {
  console.log('\n  Box Plot Comparison');
  for (var i = 0; i < datasets.length; i++) {
    var s = Series(datasets[i]);
    var mn = s.min(), q1 = s.percentile(25), med = s.median(), q3 = s.percentile(75), mx = s.max();
    var lbl = (labels[i] + '         ').substring(0, 10);
    console.log('  ' + lbl + '  min=' + mn.toFixed(0) + '  Q1=' + q1.toFixed(0) + '  med=' + med.toFixed(0) + '  Q3=' + q3.toFixed(0) + '  max=' + mx.toFixed(0));
  }
}

// === Time Series ===
function movingAvg(data, window) {
  var result = [];
  for (var i = 0; i < data.length; i++) {
    if (i < window - 1) { result.push(null); continue; }
    var s = 0; for (var j = i-window+1; j <= i; j++) s += data[j];
    result.push(s/window);
  }
  return result;
}

function ema(data, span) {
  var alpha = 2/(span+1), result = [data[0]];
  for (var i = 1; i < data.length; i++) result.push(alpha*data[i] + (1-alpha)*result[i-1]);
  return result;
}

// === DEMO: End-to-end data analysis ===
console.log('DataForge - Zero-dependency Data Analysis & Visualization\n');

var csv = 'name,dept,age,salary,perf,tenure\n' +
'Alice,Eng,32,95000,88,5\nBob,Mkt,28,72000,75,3\nCharlie,Eng,45,125000,92,12\n' +
'Diana,Sales,35,85000,81,7\nEve,Eng,29,88000,85,2\nFrank,Mkt,42,78000,70,10\n' +
'Grace,Sales,31,82000,90,4\nHank,Eng,38,115000,95,9\nIvy,Mkt,26,65000,68,1\n' +
'Jack,Sales,39,92000,79,8\nKate,Eng,33,98000,87,6\nLeo,Mkt,37,76000,73,6\n' +
'Mia,Sales,40,88000,92,8\nNick,Eng,44,120000,91,11\nOlivia,Mkt,30,68000,74,3';

console.log('=== 1. CSV Parsing & DataFrame ===');
var df = parseCSV(csv);
console.log('Loaded ' + df.shape[0] + ' rows x ' + df.shape[1] + ' cols');
df.print(5);

console.log('\n--- Descriptive Statistics ---');
var nc = ['age','salary','perf','tenure'];
var stats = df.describe();
nc.forEach(function(c) {
  var s = stats[c];
  console.log(c + ': mean=' + s.mean.toFixed(1) + ' std=' + s.std.toFixed(1) + ' [' + s.min + ', ' + s.max + ']');
});

console.log('\n=== 2. Department Insights ===');
var agg = df.groupBy('dept').agg({salary:'mean', perf:'mean'});
agg.rows.forEach(function(r) { console.log(r.dept + ': $' + Math.round(r.salary_mean) + ' avg, perf=' + r.perf_mean.toFixed(1)); });
barChart(agg.rows.map(function(r){return r.dept;}), agg.rows.map(function(r){return Math.round(r.salary_mean);}), {title:'Salary by Department'});

var top = df.filter(function(r){return r.perf>=85;}).sort('perf',false).addColumn('bonus', function(r){return Math.round(r.salary*r.perf/1000);});
console.log('\nTop performers with bonus:');
top.print(6);

console.log('\n=== 3. Correlation & Regression ===');
var corr = df.corr();
nc.forEach(function(a) {
  var line = (a+'        ').substring(0,8);
  nc.forEach(function(b) { line += (corr[a][b].toFixed(2)+'      ').substring(0,8); });
  console.log(line);
});
console.log('KEY: tenure-salary r=' + corr.tenure.salary.toFixed(3) + ', perf-salary r=' + corr.perf.salary.toFixed(3));

var ten = df.rows.map(function(r){return r.tenure;}), sal = df.rows.map(function(r){return r.salary;});
var reg = linearRegression(ten, sal);
console.log('\nRegression: salary = ' + reg.slope.toFixed(0) + '*tenure + ' + reg.intercept.toFixed(0) + ' (R2=' + reg.rSquared.toFixed(3) + ')');
console.log('Predict 15yr: $' + Math.round(reg.predict(15)));
scatterPlot(ten, sal, {title:'Tenure vs Salary', width:30, height:8});

console.log('\n=== 4. Hypothesis Testing ===');
var tt = tTest(sal, 85000);
console.log('t-test H0: mean=$85K | t=' + tt.tStat.toFixed(3) + ' p=' + tt.pValue.toFixed(4) + ' CI=[$' + Math.round(tt.ci[0]) + ',$' + Math.round(tt.ci[1]) + '] ' + (tt.pValue<0.05?'REJECT':'FAIL TO REJECT'));

console.log('\n=== 5. Visualizations ===');
histogram(sal, 5, {title:'Salary Distribution'});
boxPlot([df.filter(function(r){return r.dept==='Eng';}).rows.map(function(r){return r.salary;}),
  df.filter(function(r){return r.dept==='Mkt';}).rows.map(function(r){return r.salary;}),
  df.filter(function(r){return r.dept==='Sales';}).rows.map(function(r){return r.salary;})],
  ['Engineering','Marketing','Sales']);

console.log('\n=== 6. K-Means Clustering ===');
var cd = df.rows.map(function(r){return [r.salary/1000, r.perf];});
var km = kMeans(cd, 3, 30);
console.log('k=3, iters=' + km.iterations + ', inertia=' + km.inertia.toFixed(1));
km.centroids.forEach(function(c,i) {
  console.log('C'+i+': $'+Math.round(c[0]*1000)+' perf='+c[1].toFixed(1)+' n='+km.labels.filter(function(l){return l===i;}).length);
});
df.addColumn('cluster', function(r,i){return km.labels[i];}).print(15);

console.log('\n=== 7. Time Series ===');
var ts = []; for (var t=0;t<24;t++) ts.push(100+t*5+20*Math.sin(t*Math.PI/6)+(Math.random()-0.5)*10);
var sma = movingAvg(ts,6), em = ema(ts,6);
console.log('24-month revenue with SMA(6) and EMA(6):');
for (var i=0;i<24;i+=4) console.log('m'+i+': val='+ts[i].toFixed(0)+' sma='+(sma[i]!==null?sma[i].toFixed(0):'--')+' ema='+em[i].toFixed(0));

console.log('\n=== Summary ===');
console.log('13 exports: Series, DataFrame, parseCSV, pearson, linearRegression,');
console.log('tTest, kMeans, barChart, histogram, scatterPlot, boxPlot, movingAvg, ema');
console.log('All zero-dependency pure JavaScript.');

module.exports = {
  Series: Series,
  DataFrame: DataFrame,
  parseCSV: parseCSV,
  pearson: pearson,
  linearRegression: linearRegression,
  tTest: tTest,
  kMeans: kMeans,
  barChart: barChart,
  histogram: histogram,
  scatterPlot: scatterPlot,
  boxPlot: boxPlot,
  movingAvg: movingAvg,
  ema: ema
};

})();
