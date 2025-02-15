//#region Calculations
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

function getSolarDeclination(date){
  /* Returns the declination to set the rotation of the earth. */
  return 23.44 * Math.sin( (360 / 365.25) * getDayOfYear(date) * Math.PI/180 )
}

function getDayOfYear(date){
  var start = new Date(date.getFullYear(), 0, 0);
  var diff = date - start;
  var oneDay = 1000 * 60 * 60 * 24;
  var dayOfYear = Math.floor(diff / oneDay);
  return dayOfYear + 284
}
//#endregion

//#region Formating
function format(time_obj, display) {
  /* Formats datetime objects into a more readable format. */
  // Display is either d (date) or t (time)

  switch (display){
    case 'd':
      return `${time_obj.getFullYear()}-${(time_obj.getMonth() + 1).toString().padStart(2, '0')}-${time_obj.getDate().toString().padStart(2, '0')}`

    case 't':
      if(time_obj.getSeconds() == 0)
        return `${time_obj.getHours()}:${time_obj.getMinutes().toString().padStart(2, '0')}`

      else
        return `${time_obj.getHours()}:${time_obj.getMinutes().toString().padStart(2, '0')}:${time_obj.getSeconds().toString().padStart(2, '0')}`
  }

}
//#endregion

//#region Global vars
const full_date = document.getElementById("full-date");
const latitude = document.getElementById("latitude");
const longitude = document.getElementById("longitude");
const earth = document.getElementById("earth");
const city = document.getElementById("city-input");
const UTCBox = document.getElementById("UTC-box");

let dayOfYear_var;
let timezoneOffset;
let daily_chart;
let yearly_chart;
//#endregion

//#region Updating
function getCoordinates() {
  /* Enters the coor */
  if (city.value.length <= 0){
    document.getElementById("city-warn").style.display = "none";
    return;
  }
  
  fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${city.value}`)
    .then(response => response.json())
    .then(data => {
      if (data.length > 0) {
        latitude.value = data[0].lat;
        longitude.value = data[0].lon;
        document.getElementById("city-warn").style.display = "none";
        updateAll()
      } else {
        document.getElementById("city-warn").style.display = "block";
      }
    })
    .catch(error => console.error(error));
}

function displaySunDegree() {
  let date = new Date(full_date.value)
  let maxDegree = 0, minDegree = 90;
  let maxTime = new Date(), minTime = new Date();
  let fiftyStart = null, fiftyEnd = null;
  let sunrise = null, sunset = null;

  // Get timezone
  function convertH2M(timeInHour){
    let timeParts = timeInHour.split(":");
    if(timeParts.length == 1)
      return Number(timeParts[0]) * 60;

    return Number(timeParts[0]) * 60 + Number(timeParts[1]);
  }

  let first = UTCBox.value.at(0)
  let temp = (first == '-'? -1 : 1) * convertH2M(UTCBox.value.slice((first == '-' || first == '+')? 1 : 0));
  timezoneOffset = temp / 60;

  let hour = Math.trunc(Math.abs(timezoneOffset)).toString().padStart(2, '0');
  let minute = (Math.abs(temp) % 60).toString().padStart(2, '0');

  if(hour == "NaN" || minute == "NaN") {
    hour = "00";
    minute = "00";
    timezoneOffset = 0;
  }

  UTCBox.value = `${timezoneOffset >= 0? '+': '-'}${hour}:${minute}`

  // Generate data points 
  const yValues = [];
  
  let pastAlt = null;
  for (let minute = 0; minute <= 1440; minute++) {
      let time = new Date(date.getFullYear(), date.getMonth(), date.getDate(), Math.floor(minute / 60), minute % 60, 0);
      let alt = sunAltitude(date, time, latitude.value, longitude.value, timezoneOffset);
      
      // Modify alt
      if (alt < 0)
        alt = 0;
      
      yValues.push(alt)

      // Get min and max degree
      if(alt > maxDegree){
        maxDegree = alt;
        maxTime = time
      }

      if(alt < minDegree){
        minDegree = alt;
        minTime = time
      }

      // to avoid comparing nothing
      if (pastAlt === null){
        pastAlt = alt
        continue
      }

      // Get fify start and end
      if(alt >= 50 && pastAlt <= 50){
        fiftyStart = time
      }

      if(alt <= 50 && pastAlt >= 50){
        fiftyEnd = time
      }

      // Get sunrise and sunset
      if(alt > 0 && pastAlt <= 0){
        sunrise = time
      }

      if(alt <= 0 && pastAlt > 0){
        sunset = time
      }

      pastAlt = alt
  }

  daily_chart.data.datasets[0].data = yValues; // Update dataset
  daily_chart.update();
  
  // Update res-box
  let resBox = document.getElementById("res-box");

  // If the sun never gets there then we leave a space
  resBox.innerHTML = ((maxDegree <= 0)? "" : `Güneşin en dik geldiği saat ${String(Math.round(maxDegree * 100) / 100).replace('.', ',')} derece ile ${format(maxTime, 't')}.` + "<br>") + 
  ((minDegree > 0)?
    "Bugün gün boyu güneş göreceksiniz." : 
    (maxDegree <= 0)?
      "Bugün tek günışığı sensin :)":
      (sunrise > sunset)?  
        `Güneş, ${format(sunset, 't')} ile batacak ve ${format(sunrise, 't')} ile tekrar doğacak.`:
        `Güneş saat ${format(sunrise, 't')} ile doğacak ve saat ${format(sunset, 't')} ile batacak.`) +
  "<br>" +
  ((maxDegree <= 50)?
    "Maalesef bugün D vitamininden mahrum kalacaksın." :
    `${format(fiftyStart, 't')} ile ${format(fiftyEnd, 't')} saatleri arasında maksimum UVB ışını alabilirsiniz.`)  
}

function changeEarthRotation(){
  let date = new Date(full_date.value)
  
  earth.style.transform = `rotate(${getSolarDeclination(date)}deg)`;
  dayOfYear_var = dayOfYear(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function updateYearChart() {
  console.log("Entered")
  const yValues = [];
  let date = new Date(full_date.value);
  let year = date.getFullYear();
  let lat = latitude.value;

  let maxVal = isLeapYear(year)? 367 : 366; // Plus one as it stars from day 1
  for(let day = 1; day < maxVal; day++) {
    let solarDec = getSolarDeclination(new Date(year, 0, day));
    let maxSolarDegree = 90 - Math.abs(solarDec - lat);
    
    if(maxSolarDegree < 0) maxSolarDegree = 0;

    yValues.push(maxSolarDegree);
  }

  yearly_chart.data.datasets[0].data = yValues; // Update dataset
  yearly_chart.update();
}

function updateAll(){
  displaySunDegree();
  changeEarthRotation();
  updateYearChart();
}
//#endregion

function showLabels() {
  return window.innerWidth > 500;
}

function isLeapYear(year) {
  return (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0);
}

function numToMonth(num, reverse=false) {
  const months = [
    "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
  ];
  return reverse? months.indexOf(num) : months[num];
}

//#region initialize
function initialize() {  
  const daily_canvas = document.getElementById('res-canvas').getContext('2d');

  daily_chart = new Chart(daily_canvas, {
      type: 'line',
      data: {
          labels: Array.from({ length: 24 * 60 }, (_, i) => { // Generate time labels for every minute
            let hours = Math.floor(i / 60);
            let minutes = i % 60;
            return `${hours}:${minutes.toString().padStart(2, '0')}`; // Format as HH:MM
        }),
          datasets: [{
            label: "Güneşin geliş açısı",
            data: Array.from({ length: 24 * 60 }, () => {return 0;}),
            borderColor: 'yellow',
            borderWidth: 4,
            fill: true,
            pointRadius: 0,
            pointHitRadius: 15,
            segment: {
              borderColor: ctx => {
                return ctx.p0.raw >= 50 ? 'lime' : 'grey';
              }
            }
          }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
          x: {
            title: {
              display: showLabels(),
              text: "Saat"
            },
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
            title: {
              display: showLabels(),
              text: "Açı"
            },
            min: 0,
            max: 90,
            ticks: {
              callback: function(value, index, values) {
                return value + '°';
              } 
            }
          }
        },
          
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return (Math.round(context.raw * 100) / 100 + '°').replace('.', ',');
              }
            }
          }
        }
      }
  });


  const yearly_canvas = document.getElementById('year-canvas').getContext('2d');

  yearly_chart = new Chart(yearly_canvas, {
    type: 'line',
    data: {
        labels: Array.from({ length: 365 }, (_, i) => { // Generate time labels for every month
          let date = new Date(1, 0, i+1)
          return date.getDate() + ' ' + numToMonth(date.getMonth());
      }),
        datasets: [{
          label: "Güneşin geliş açısı",
          data: Array.from({ length: 365 }, () => {return 0;}),
          borderColor: ctx => {
            return (ctx.dataIndex == dayOfYear_var)? "purple" : "yellow";
          },
          borderWidth: 4,
          fill: true,
          pointRadius: ctx => {
            return (ctx.dataIndex == dayOfYear_var)? 2 : 0;
          },
          pointHitRadius: 15,
          
        }]
    },
    options: {
      onClick: function(event, elements) {

        if (elements.length > 0) {
          const element = elements[0]; // Get the clicked element
          const dataIndex = element.index; // Get the data index of the clicked point
          const xValue = yearly_chart.data.labels[dataIndex]; // Get the x-value (label)

          const [day, month] = xValue.split(' ');
          const year = new Date(full_date.value).getFullYear();
          const numMonth = numToMonth(month, reverse=true);

          const new_date = new Date(year, numMonth, day);
          full_date.value = format(new_date, 'd');

          dayOfYear_var = dayOfYear(year, parseInt(numMonth) + 1, parseInt(day));

          updateAll();
        }
      },
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        x: {
          grid: { display: false },
          offset: true,
          title: {
            display: true,
            text: "Tarih"
          },
          type: "category",
          ticks: {
            callback: function (value, index, values) {
              let date = new Date(1, 0, value)
              return date.getDate() == 15 ? `${numToMonth(date.getMonth())}`: null; // Only show months
            }
          }
        },
        y: {
          title: {
            display: showLabels(),
            text: "Açı"
          },
          min: 0,
          max: 90,
          ticks: {
            callback: function(value, index, values) {
              return value + '°';
            } 
          }
        }
      },
        
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return (Math.round(context.raw * 100) / 100 + '°').replace('.', ',');
            }
          }
        }
      }
    }
});
  // Set default values for year and such
  const today = new Date()
  full_date.value = format(today, 'd');
  let hourOffset = -today.getTimezoneOffset() / 60;
  dayOfYear_var = dayOfYear(today.getFullYear(), today.getMonth() + 1, today.getDate());

  let hour = Math.floor(Math.abs(hourOffset)).toString().padStart(2, '0')
  let minute = (Math.abs(today.getTimezoneOffset()) % 60).toString().padStart(2, '0')

  UTCBox.value = `${hourOffset >= 0? '+': '-'}${hour}:${minute}`
  timezoneOffset = hourOffset;

  // In case we cant get the position
  latitude.value = 0
  longitude.value = 0
  changeEarthRotation()

  
  // Set default values for coordinates
  navigator.geolocation.getCurrentPosition(setPos, fail);

  function setPos(pos) {
    latitude.value = pos.coords.latitude
    longitude.value = pos.coords.longitude
    updateAll()
  }

  function fail() {
    updateAll();
  }
}

// initialize
initialize()

// Add listeners for losing focus and update
full_date.addEventListener("change", updateAll);
latitude.addEventListener("change", updateAll);
longitude.addEventListener("change", updateAll);
UTCBox.addEventListener("change", displaySunDegree);

city.addEventListener("change", getCoordinates);

// 
window.addEventListener("resize", () => {
  const showLabel = showLabels();
  daily_chart.options.scales.x.title.display = showLabel;
  daily_chart.options.scales.y.title.display = showLabel;
  daily_chart.update();

  yearly_chart.options.scales.x.title.display = showLabel;
  yearly_chart.options.scales.y.title.display = showLabel;
  yearly_chart.update();
});

//#endregion
