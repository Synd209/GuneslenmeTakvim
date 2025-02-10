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
    
    return altDeg + refractionDeg;
}

let chart;
function displaySunDegree() {
  let date = new Date(document.getElementById("full-date").value)
  
  
  let latitude = document.getElementById("latitude").value
  let longitude = document.getElementById("longitude").value
  
  let timezoneOffset = Math.round(longitude / 15)
  
  // Generate data points
  const yValues = [];
  
  for (let minute = 0; minute <= 1440; minute++) {
      let time = new Date(date.getFullYear(), date.getMonth(), date.getDate(), Math.floor(minute / 60), minute % 60, 0);
      let alt = sunAltitude(date, time, latitude, longitude, timezoneOffset);
      
      
    
      if (alt > 0)
        yValues.push(alt);
      
      else
        yValues.push(0)
  }

  chart.data.datasets[0].data = yValues; // Update dataset
  chart.update();
  
}

function initialize() {
  const xValues = [];
  
  const canvas = document.getElementById('res-canvas').getContext('2d');
  
  chart = new Chart(canvas, {
      type: 'line',
      data: {
          labels: Array.from({ length: 24 * 60 }, (_, i) => { // Generate time labels for every minute
            let hours = Math.floor(i / 60);
            let minutes = i % 60;
            return `${hours}:${minutes.toString().padStart(2, '0')}`; // Format as HH:MM
        }),
          datasets: [{
              label: 'Dereceler',
              data: Array.from({ length: 24 * 60 }, () => {return 0;}),
              borderColor: 'yellow',
              borderWidth: 4,
              fill: true,
              pointRadius: 0
          }]
      },
      options: {
          responsive: false,
          maintainAspectRatio: true,
          scales: {
            x: {
              type: "category",
              ticks: {
                callback: function (value, index, values) {
                  let hours = Math.floor(value / 60);  // Convert minutes to hours
                  let minutes = value % 60;            // Get the remainder for minutes
                  return minutes === 0 ? `${hours}:00` : null; // Only show hour labels

                }
              }
            },
            y: {
                min: 0,
                max: 90
            }
          }
      }
  });
}

initialize()

// Set default values for year and such
const today = new Date()
document.getElementById("full-date").value = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`
  
// Set default values for coordinates
navigator.geolocation.getCurrentPosition(setPos);

function setPos(pos) {
  document.getElementById("latitude").value = pos.coords.latitude
  document.getElementById("longitude").value = pos.coords.longitude
  displaySunDegree()
}



