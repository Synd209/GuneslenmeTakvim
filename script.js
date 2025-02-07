function dayOfYear(year, month, day) {
    let dt = new Date(year, month - 1, day);
    let start = new Date(year, 0, 0);
    let diff = dt - start;
    let oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
}

function equationOfTime(gamma) {
    return 229.18 * (0.000075 +
                     0.001868 * Math.cos(gamma) -
                     0.032077 * Math.sin(gamma) -
                     0.014615 * Math.cos(2 * gamma) -
                     0.040849 * Math.sin(2 * gamma));
}

function solarDeclination(gamma) {
    return (0.006918 - 0.399912 * Math.cos(gamma) +
            0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma) +
            0.000907 * Math.sin(2 * gamma) - 0.002697 * Math.cos(3 * gamma) +
            0.00148 * Math.sin(3 * gamma));
}

function refractionCorrection(altDeg) {
    if (altDeg > -0.575) {
        return 1.02 / Math.tan((Math.PI / 180) * (altDeg + 10.3 / (altDeg + 5.11)));
    } else {
        return 0.0;
    }
}

function sunAltitude(date, time, latitudeDeg, longitudeDeg, timezoneOffset) {
    let year = date.getFullYear();
    let month = date.getMonth() + 1;
    let day = date.getDate();
    let n = dayOfYear(year, month, day);
    
    let decimalHour = time.getHours() + time.getMinutes() / 60 + time.getSeconds() / 3600;
    let gamma = (2 * Math.PI / 365) * (n - 1 + (decimalHour - 12) / 24);
    
    let E = equationOfTime(gamma);
    let delta = solarDeclination(gamma);
    
    let LSTM = 15 * timezoneOffset;
    let TCF = 4 * (longitudeDeg - LSTM) + E;
    let localSolarTime = decimalHour + TCF / 60.0;
    
    let HRA_deg = 15 * (localSolarTime - 12);
    let HRA = (Math.PI / 180) * HRA_deg;
    
    let phi = (Math.PI / 180) * latitudeDeg;
    let sinAlt = Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.cos(HRA);
    sinAlt = Math.max(-1.0, Math.min(1.0, sinAlt));
    let altRad = Math.asin(sinAlt);
    let altDeg = (180 / Math.PI) * altRad;
    
    let R_arcmin = refractionCorrection(altDeg);
    let refractionDeg = R_arcmin / 60.0;
    
    console.log(altDeg, refractionDeg)
    return altDeg + refractionDeg;
}

function displayChart() {
  const ctx = document.getElementById('res-canvas').getContext('2d');

  // Generate data points
  const xValues = [];
  const yValues = [];
  for (let x = -10; x <= 10; x += 0.1) {
      xValues.push(x);
      yValues.push(Math.sin(x)); // Example function: sin(x)
  }

  // Create chart
  new Chart(ctx, {
      type: 'line',
      data: {
          labels: xValues,
          datasets: [{
              label: 'y = sin(x)',
              data: yValues,
              borderColor: 'blue',
              borderWidth: 2,
              fill: false,
              pointRadius: 0
          }]
      },
      options: {
          scales: {
              x: { title: { display: true, text: 'X' } },
              y: { title: { display: true, text: 'Y' } }
          }
      }
  });
}

function displaySunDegree() {
  let year = document.getElementById("year").value
  let month = document.getElementById("month").value
  let day = document.getElementById("day").value
  let date = new Date(year, month, day)
  
  
  let latitude = document.getElementById("latitude").value
  let longitude = document.getElementById("longitude").value
  
  let timezoneOffset = Math.round(longitude / 15)
  
  const ctx = document.getElementById('res-canvas').getContext('2d');

  // Generate data points
  const xValues = [];
  const yValues = [];
  for (let minute = 0; minute <= 1440; minute += 10) {
      let time = new Date(date.getFullYear(), date.getMonth(), date.getDate(), Math.floor(minute / 60), minute % 60, 0);
      let alt = sunAltitude(date, time, latitude, longitude, timezoneOffset);
    
      if (alt > 0){
        xValues.push(minute);
        yValues.push(alt);
      }
  }

  // Create chart
  new Chart(ctx, {
      type: 'line',
      data: {
          labels: xValues,
          datasets: [{
              label: 'Dereceler',
              data: yValues,
              borderColor: 'yellow',
              borderWidth: 4,
              fill: false,
              pointRadius: 0
          }]
      }
  });
}

// Set default values for year and such
const today = new Date()
document.getElementById("year").value = today.getFullYear()
document.getElementById("month").value = today.getMonth()
document.getElementById("day").value = today.getDay()


