//TEST

//#region Calculations
function dayOfYear(year, month, day) {
  const dt = new Date(year, month - 1, day);
  const start = new Date(year, 0, 0);
  const diff = dt - start;
  const oneDay = 1000 * 60 * 60 * 24;
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
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const n = dayOfYear(year, month, day);
  
  const decimalHour = time.getHours() + time.getMinutes() / 60 + time.getSeconds() / 3600;
  const gamma = (2 * Math.PI / 365) * (n - 1 + (decimalHour - 12) / 24);
  
  const E = equationOfTime(gamma);
  const delta = solarDeclination(gamma);
  
  const LSTM = 15 * timezoneOffset;
  const TCF = 4 * (longitudeDeg - LSTM) + E;
  const localSolarTime = decimalHour + TCF / 60.0;
  
  const HRA_deg = 15 * (localSolarTime - 12);
  const HRA = (Math.PI / 180) * HRA_deg;
  
  const phi = (Math.PI / 180) * latitudeDeg;
  let sinAlt = Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.cos(HRA);
  sinAlt = Math.max(-1.0, Math.min(1.0, sinAlt));
  const altRad = Math.asin(sinAlt);
  const altDeg = (180 / Math.PI) * altRad;
  
  const R_arcmin = refractionCorrection(altDeg);
  const refractionDeg = R_arcmin / 60.0;
  
  return altDeg + refractionDeg;
}

function getSolarDeclination(date) {
  return 23.44 * Math.sin((360 / 365.25) * getDayOfYear(date) * Math.PI / 180);
}

function getDayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay) + 284;
}
//#endregion

//#region Formatting
function format(time_obj, display) {
  switch (display) {
      case 'd':
          return `${time_obj.getFullYear()}-${(time_obj.getMonth() + 1).toString().padStart(2, '0')}-${time_obj.getDate().toString().padStart(2, '0')}`;
      case 't':
          if (time_obj.getSeconds() == 0) {
              return `${time_obj.getHours()}:${time_obj.getMinutes().toString().padStart(2, '0')}`;
          } else {
              return `${time_obj.getHours()}:${time_obj.getMinutes().toString().padStart(2, '0')}:${time_obj.getSeconds().toString().padStart(2, '0')}`;
          }
  }
}
//#endregion

//#region Global Variables
const full_date = document.getElementById("full-date");
const latitude = document.getElementById("latitude");
const longitude = document.getElementById("longitude");
const earth = document.getElementById("earth");
const city = document.getElementById("city-input");
const UTCBox = document.getElementById("UTC-box");
const calendarIframe = document.getElementById("calendar-iframe");


let dayOfYear_var;
let timezoneOffset;
let daily_chart;
let yearly_chart;
//#endregion

//#region Updating Functions
function getCoordinates() {
  if (city.value.length <= 0) {
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
              updateAll();
          } else {
              document.getElementById("city-warn").style.display = "block";
          }
      })
      .catch(error => console.error(error));
}

function sunDegrees(date) {
  let maxDegree = 0, minDegree = 90;
  let maxTime = new Date(), minTime = new Date();

  let fiftyStart = null, fiftyEnd = null;
  let sunrise = null, sunset = null;

  let pastAlt = null;

  const yValues = [];

  for (let minute = 0; minute <= 1440; minute++) {
    const time = new Date(date.getFullYear(), date.getMonth(), date.getDate(), Math.floor(minute / 60), minute % 60, 0);
    let alt = sunAltitude(date, time, latitude.value, longitude.value, timezoneOffset);
    if (alt < 0) alt = 0;
    yValues.push(alt);

    if (alt > maxDegree) {
        maxDegree = alt;
        maxTime = time;
    }

    if (alt < minDegree) {
        minDegree = alt;
        minTime = time;
    }

    if (pastAlt === null) {
        pastAlt = alt;
        continue;
    }

    if (alt >= 50 && pastAlt <= 50) {
        fiftyStart = time;
    }

    if (alt <= 50 && pastAlt >= 50) {
        fiftyEnd = time;
    }

    if (alt > 0 && pastAlt <= 0) {
        sunrise = time;
    }

    if (alt <= 0 && pastAlt > 0) {
        sunset = time;
    }

    pastAlt = alt;
  }

  return [yValues, maxDegree, minDegree, maxTime, minTime, fiftyStart, fiftyEnd, sunrise, sunset];
}

function displaySunDegree() {
  const date = new Date(full_date.value);

  function convertH2M(timeInHour) {
      const timeParts = timeInHour.split(":");
      if (timeParts.length == 1) return Number(timeParts[0]) * 60;
      return Number(timeParts[0]) * 60 + Number(timeParts[1]);
  }

  // Update timezone offset
  const first = UTCBox.value.at(0);
  const temp = (first == '-' ? -1 : 1) * convertH2M(UTCBox.value.slice((first == '-' || first == '+') ? 1 : 0));
  timezoneOffset = temp / 60;

  let hour = Math.trunc(Math.abs(timezoneOffset)).toString().padStart(2, '0');
  let minute = (Math.abs(temp) % 60).toString().padStart(2, '0');

  if (hour == "NaN" || minute == "NaN") {
      hour = "00";
      minute = "00";
      timezoneOffset = 0;
  }

  UTCBox.value = `${timezoneOffset >= 0 ? '+' : '-'}${hour}:${minute}`;
  
  // Update charts  
  let [yValues, maxDegree, minDegree, maxTime, minTime, fiftyStart, fiftyEnd, sunrise, sunset] = sunDegrees(date);
  
  daily_chart.data.datasets[0].data = yValues;
  daily_chart.update();

  const resBox = document.getElementById("res-box");
  resBox.innerHTML = ((maxDegree <= 0) ? "" : `Güneşin en dik geldiği saat ${String(Math.round(maxDegree * 100) / 100).replace('.', ',')} derece ile ${format(maxTime, 't')}.` + "<br>") +
      ((minDegree > 0) ?
          "Bugün gün boyu güneş göreceksiniz." :
          (maxDegree <= 0) ?
              "Bugün tek günışığı sensin :)" :
              (sunrise < sunset) ?
                  `Güneş saat ${format(sunrise, 't')} ile doğacak ve saat ${format(sunset, 't')} ile batacak.`:
                  `Güneş, ${format(sunset, 't')} ile batacak ve ${format(sunrise, 't')} ile tekrar doğacak.`) + 
      "<br>" +
      ((maxDegree <= 50) ?
          "Maalesef bugün D vitamininden mahrum kalacaksın." :
          (fiftyStart < fiftyEnd) ?
              `${format(fiftyStart, 't')} ile ${format(fiftyEnd, 't')} saatleri arasında maksimum UVB ışını alabilirsiniz.` :
              `${format(fiftyEnd, 't')}'e kadar ve ${format(fiftyStart, 't')}'dan sonra maksimum UVB ışını alabilirsiniz.`);
}

function changeEarthRotation() {
  const date = new Date(full_date.value);
  earth.style.transform = `rotate(${getSolarDeclination(date)}deg)`;
  dayOfYear_var = dayOfYear(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function updateYearChart() {
  const yValues = [];
  const date = new Date(full_date.value);
  const year = date.getFullYear();
  const lat = latitude.value;

  const maxVal = isLeapYear(year) ? 367 : 366;
  for (let day = 1; day < maxVal; day++) {
      const solarDec = getSolarDeclination(new Date(year, 0, day));
      let maxSolarDegree = 90 - Math.abs(solarDec - lat);
      if (maxSolarDegree < 0) maxSolarDegree = 0;
      yValues.push(maxSolarDegree);
  }

  yearly_chart.data.datasets[0].data = yValues;
  yearly_chart.update();
}

function updateCalendar() {
    console.log("Updating calendar");
    if(typeof calendarIframe.contentWindow.resetAll == "function")
        calendarIframe.contentWindow.resetAll();

    if(typeof calendarIframe.contentWindow.updateHours == "function")
        calendarIframe.contentWindow.updateHours();

    let calendarItem = calendarIframe.contentDocument.getElementById(format(new Date(full_date.value), 'd'));

    if(calendarItem === null) return;

    calendarItem.style.backgroundColor = "lightgrey";
}

function updateAll() {
  displaySunDegree();
  changeEarthRotation();
  updateYearChart();
  updateCalendar();
}
//#endregion

function showLabels() {
  return window.innerWidth > 500;
}

function isLeapYear(year) {
  return (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0);
}

function numToMonth(num, reverse = false) {
  const months = [
      "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
      "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
  ];
  return reverse ? months.indexOf(num) : months[num];
}

function numToDay(num) {
  const days = [ // Pazar'dan başlıyor
    "Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"
  ]

  return days[num];
}

//#region Initialize
function initialize() {
  const daily_canvas = document.getElementById('res-canvas').getContext('2d');

  daily_chart = new Chart(daily_canvas, {
      type: 'line',
      data: {
          labels: Array.from({ length: 24 * 60 }, (_, i) => {
              const hours = Math.floor(i / 60);
              const minutes = i % 60;
              return `${hours}:${minutes.toString().padStart(2, '0')}`;
          }),
          datasets: [{
              label: "Güneşin geliş açısı",
              data: Array.from({ length: 24 * 60 }, () => 0),
              borderColor: 'yellow',
              borderWidth: 4,
              fill: true,
              pointRadius: 0,
              pointHitRadius: 15,
              segment: {
                  borderColor: ctx => ctx.p0.raw >= 50 ? 'lime' : 'grey'
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
                      callback: function (value) {
                          const hours = Math.floor(value / 60);
                          const minutes = value % 60;
                          return minutes === 0 ? `${hours}:00` : null;
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
                      callback: value => `${value}°`
                  }
              }
          },
          plugins: {
              legend: {
                  display: false
              },
              tooltip: {
                  callbacks: {
                      label: context => (Math.round(context.raw * 100) / 100 + '°').replace('.', ',')
                  }
              }
          }
      }
  });

  const yearly_canvas = document.getElementById('year-canvas').getContext('2d');

  yearly_chart = new Chart(yearly_canvas, {
      type: 'line',
      data: {
          labels: Array.from({ length: 365 }, (_, i) => {
              const date = new Date(1, 0, i + 1);
              return `${date.getDate()} ${numToMonth(date.getMonth())}`;
          }),
          datasets: [{
              label: "Güneşin geliş açısı",
              data: Array.from({ length: 365 }, () => 0),
              borderColor: ctx => ctx.dataIndex == dayOfYear_var ? "purple" : "yellow",
              borderWidth: 4,
              fill: true,
              pointRadius: ctx => ctx.dataIndex == dayOfYear_var ? 2 : 0,
              pointHitRadius: 15
          }]
      },
      options: {
          onClick: function (event, elements) {
              if (elements.length > 0) {
                  const element = elements[0];
                  const dataIndex = element.index;
                  const xValue = yearly_chart.data.labels[dataIndex];

                  const [day, month] = xValue.split(' ');
                  const year = new Date(full_date.value).getFullYear();
                  const numMonth = numToMonth(month, true);

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
                      callback: function (value) {
                          const date = new Date(1, 0, value);
                          return date.getDate() == 15 ? `${numToMonth(date.getMonth())}` : null;
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
                      callback: value => `${value}°`
                  }
              }
          },
          plugins: {
              legend: {
                  display: false
              },
              tooltip: {
                  callbacks: {
                      label: context => (Math.round(context.raw * 100) / 100 + '°').replace('.', ',')
                  }
              }
          }
      }
  });

  const today = new Date();
  full_date.value = format(today, 'd');
  const hourOffset = -today.getTimezoneOffset() / 60;
  dayOfYear_var = dayOfYear(today.getFullYear(), today.getMonth() + 1, today.getDate());

  const hour = Math.floor(Math.abs(hourOffset)).toString().padStart(2, '0');
  const minute = (Math.abs(today.getTimezoneOffset()) % 60).toString().padStart(2, '0');

  UTCBox.value = `${hourOffset >= 0 ? '+' : '-'}${hour}:${minute}`;
  timezoneOffset = hourOffset;

  latitude.value = 0;
  longitude.value = 0;
  changeEarthRotation();

  navigator.geolocation.getCurrentPosition(setPos, fail);

  function setPos(pos) {
      latitude.value = pos.coords.latitude;
      longitude.value = pos.coords.longitude;
      updateAll();
  }

  function fail() {
      updateAll();
  }

  // Add listeners for losing focus and update
  full_date.addEventListener("change", updateAll);
  latitude.addEventListener("change", updateAll);
  longitude.addEventListener("change", updateAll);
  UTCBox.addEventListener("change", updateAll);
  city.addEventListener("change", getCoordinates);

  window.addEventListener("resize", () => {
    const showLabel = showLabels();
    daily_chart.options.scales.x.title.display = showLabel;
    daily_chart.options.scales.y.title.display = showLabel;
    daily_chart.update();

    yearly_chart.options.scales.x.title.display = showLabel;
    yearly_chart.options.scales.y.title.display = showLabel;
    yearly_chart.update();
  });
}

initialize();
